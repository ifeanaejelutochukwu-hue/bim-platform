package runner

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"goexam/internal/store"
)

const goModContent = "module goexam\ngo 1.21\n"

// execTimeout is the maximum time a student's program is allowed to run.
// This prevents infinite loops from hanging the server.
const execTimeout = 10 * time.Second

// Run compiles and executes the student's code against the test template.
// It creates a real Go module in a temp directory, builds it, runs it,
// and compares the output line-by-line to the expected test case outputs.
//
// Standalone mode: if mainCode is empty, the student's code IS the main
// package (no piscine subdirectory). Used for "write a program" challenges.
func Run(challengeID, filename, studentCode, mainCode string, testCases []store.TestCase, args string) store.ExecutionResult {
	// 1. Create a temp directory for this run.
	dir, err := os.MkdirTemp("", "goexam-run-")
	if err != nil {
		return errorResult(fmt.Sprintf("failed to create temp dir: %v", err))
	}
	defer os.RemoveAll(dir)

	// 2. Write go.mod
	if err := os.WriteFile(filepath.Join(dir, "go.mod"), []byte(goModContent), 0o644); err != nil {
		return errorResult(fmt.Sprintf("failed to write go.mod: %v", err))
	}

	standalone := strings.TrimSpace(mainCode) == ""

	if standalone {
		// ── Standalone mode: student writes the full main package ──────────
		if err := os.WriteFile(filepath.Join(dir, "main.go"), []byte(studentCode), 0o644); err != nil {
			return errorResult(fmt.Sprintf("failed to write main.go: %v", err))
		}
	} else {
		// ── Library mode: student implements a piscine function ─────────────
		piscineDir := filepath.Join(dir, "piscine")
		if err := os.Mkdir(piscineDir, 0o755); err != nil {
			return errorResult(fmt.Sprintf("failed to create piscine dir: %v", err))
		}
		if err := os.WriteFile(filepath.Join(piscineDir, "solution.go"), []byte(studentCode), 0o644); err != nil {
			return errorResult(fmt.Sprintf("failed to write solution.go: %v", err))
		}
		// Write main.go — replace "piscine" import with the local module path.
		fixedMain := strings.ReplaceAll(mainCode, `"piscine"`, `"goexam/piscine"`)
		if err := os.WriteFile(filepath.Join(dir, "main.go"), []byte(fixedMain), 0o644); err != nil {
			return errorResult(fmt.Sprintf("failed to write main.go: %v", err))
		}
	}

	// 3. Build — gives clean compiler errors before we try to run.
	buildCtx, buildCancel := context.WithTimeout(context.Background(), execTimeout)
	defer buildCancel()
	buildCmd := exec.CommandContext(buildCtx, "go", "build", "./...")
	buildCmd.Dir = dir
	buildOut, buildErr := buildCmd.CombinedOutput()
	if buildErr != nil {
		cleaned := cleanError(string(buildOut), filename)
		return store.ExecutionResult{
			CompilationError: cleaned,
			TestResults:      noResultsFor(testCases),
		}
	}

	// 4. Run the program with a hard timeout.
	runArgs := []string{"run", "."}
	if args != "" {
		for _, a := range strings.Fields(args) {
			runArgs = append(runArgs, a)
		}
	}
	runCtx, runCancel := context.WithTimeout(context.Background(), execTimeout)
	defer runCancel()
	runCmd := exec.CommandContext(runCtx, "go", runArgs...)
	runCmd.Dir = dir
	runOut, runErr := runCmd.CombinedOutput()

	// Detect timeout
	if runCtx.Err() == context.DeadlineExceeded {
		return store.ExecutionResult{
			CompilationError: fmt.Sprintf("program exceeded time limit (%s) — possible infinite loop", execTimeout),
			TestResults:      noResultsFor(testCases),
		}
	}

	// Normalise the raw output: replace all \r\n → \n, strip trailing newline.
	rawStdout := strings.ReplaceAll(string(runOut), "\r\n", "\n")
	rawStdout = strings.ReplaceAll(rawStdout, "\r", "\n")
	stdout := strings.TrimRight(rawStdout, "\n")

	if runErr != nil {
		// Runtime panic or non-zero exit — show the error output.
		cleaned := cleanError(stdout, filename)
		return store.ExecutionResult{
			CompilationError: cleaned,
			Stdout:           stdout,
			TestResults:      noResultsFor(testCases),
		}
	}

	// 5. Split output into lines and compare against test cases.
	//    Each output line is trimmed of any stray \r (Windows CRLF residue).
	var outputLines []string
	if stdout != "" {
		for _, l := range strings.Split(stdout, "\n") {
			outputLines = append(outputLines, strings.TrimRight(l, "\r"))
		}
	}

	testResults := make([]store.TestResult, len(testCases))
	allPassed := len(testCases) > 0

	for i, tc := range testCases {
		expected := strings.TrimRight(tc.ExpectedOutput, "\r\n")

		var actual string
		if i < len(outputLines) {
			actual = outputLines[i]
		}

		var passed bool
		if strings.Contains(expected, "...") {
			// Truncated expected output — the question displays "A, B, ..., Y, Z"
			// Split on " ..., " and check that actual starts with the prefix
			// and ends with the suffix. This handles challenges where the full
			// output is too long to type out but has a known start and end.
			parts := strings.SplitN(expected, "...", 2)
			prefix := strings.TrimSpace(parts[0])
			suffix := ""
			if len(parts) == 2 {
				suffix = strings.TrimSpace(parts[1])
				// strip leading ", " from suffix if present
				suffix = strings.TrimPrefix(suffix, ", ")
			}
			actualTrimmed := strings.TrimSpace(actual)
			passed = strings.HasPrefix(actualTrimmed, prefix) &&
				(suffix == "" || strings.HasSuffix(actualTrimmed, suffix))
		} else {
			// Exact match (trim surrounding whitespace only)
			passed = strings.TrimSpace(actual) == strings.TrimSpace(expected)
		}

		if !passed {
			allPassed = false
		}
		testResults[i] = store.TestResult{
			Input:    tc.Input,
			Expected: expected,
			Actual:   actual,
			Passed:   passed,
		}
	}

	return store.ExecutionResult{
		Success:     allPassed,
		Stdout:      stdout,
		TestResults: testResults,
	}
}

// cleanError strips internal temp paths and module prefixes from compiler output
// so the student sees their filename and real line numbers.
func cleanError(raw, filename string) string {
	lines := strings.Split(raw, "\n")
	var out []string
	for _, line := range lines {
		// Skip the module header line "# goexam/piscine" or "# goexam"
		if strings.HasPrefix(line, "# goexam") {
			continue
		}
		// Replace the internal path with the student filename
		line = strings.ReplaceAll(line, "piscine/solution.go", filename)
		line = strings.ReplaceAll(line, "main.go", filename)
		if line != "" {
			out = append(out, line)
		}
	}
	return strings.Join(out, "\n")
}

func errorResult(msg string) store.ExecutionResult {
	return store.ExecutionResult{CompilationError: msg}
}

func noResultsFor(testCases []store.TestCase) []store.TestResult {
	r := make([]store.TestResult, len(testCases))
	for i, tc := range testCases {
		r[i] = store.TestResult{
			Input:    tc.Input,
			Expected: tc.ExpectedOutput,
			Actual:   "[not run]",
		}
	}
	return r
}
