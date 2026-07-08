package runner

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
	"unicode"

	"goexam/internal/store"
)

const goModContent = "module goexam\ngo 1.21\n"

// execTimeout is the maximum time a student's program is allowed to run.
const execTimeout = 10 * time.Second

// Run compiles and executes the student's code against the test cases.
//
// Two modes based on the test case structure:
//
//  1. "Program mode" (mainCode is empty): the student writes the full main
//     package. Each test case has its own Args that are passed to the program.
//     The program is compiled once and run once per test case.
//
//  2. "Library mode" (mainCode is non-empty): the student implements a piscine
//     function. The main template is run once (with optional extra args) and
//     output lines are matched to test cases in order.
func Run(challengeID, filename, studentCode, mainCode string, testCases []store.TestCase, args string) store.ExecutionResult {
	dir, err := os.MkdirTemp("", "goexam-run-")
	if err != nil {
		return errorResult(fmt.Sprintf("failed to create temp dir: %v", err))
	}
	defer os.RemoveAll(dir)

	if err := os.WriteFile(filepath.Join(dir, "go.mod"), []byte(goModContent), 0o644); err != nil {
		return errorResult(fmt.Sprintf("failed to write go.mod: %v", err))
	}

	standalone := strings.TrimSpace(mainCode) == ""

	if standalone {
		if err := os.WriteFile(filepath.Join(dir, "main.go"), []byte(studentCode), 0o644); err != nil {
			return errorResult(fmt.Sprintf("failed to write main.go: %v", err))
		}
	} else {
		piscineDir := filepath.Join(dir, "piscine")
		if err := os.Mkdir(piscineDir, 0o755); err != nil {
			return errorResult(fmt.Sprintf("failed to create piscine dir: %v", err))
		}
		if err := os.WriteFile(filepath.Join(piscineDir, "solution.go"), []byte(studentCode), 0o644); err != nil {
			return errorResult(fmt.Sprintf("failed to write solution.go: %v", err))
		}
		fixedMain := strings.ReplaceAll(mainCode, `"piscine"`, `"goexam/piscine"`)
		if err := os.WriteFile(filepath.Join(dir, "main.go"), []byte(fixedMain), 0o644); err != nil {
			return errorResult(fmt.Sprintf("failed to write main.go: %v", err))
		}
	}

	// Build once — shared across all test runs
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

	// ── Program mode: run once per test case with its own args ────────────
	if standalone {
		return runPerTestCase(dir, filename, testCases, args)
	}

	// ── Library mode: single run, match output lines to test cases ────────
	return runOnce(dir, filename, testCases, args)
}

// runPerTestCase runs the compiled binary once per test case, passing each
// test case's Input as command-line arguments. The expected output for each
// test case is compared to the program's entire stdout for that run.
func runPerTestCase(dir, filename string, testCases []store.TestCase, globalArgs string) store.ExecutionResult {
	testResults := make([]store.TestResult, len(testCases))
	allPassed := len(testCases) > 0
	var combinedStdout strings.Builder

	for i, tc := range testCases {
		// Parse the test case input as shell-like args (respects quoted strings)
		tcArgs := splitArgs(tc.Input)

		runArgs := []string{"run", "."}
		runArgs = append(runArgs, tcArgs...)
		// Also append any global extra args (rare for standalone mode)
		if globalArgs != "" {
			runArgs = append(runArgs, splitArgs(globalArgs)...)
		}

		runCtx, runCancel := context.WithTimeout(context.Background(), execTimeout)
		runCmd := exec.CommandContext(runCtx, "go", runArgs...)
		runCmd.Dir = dir
		runOut, runErr := runCmd.CombinedOutput()
		runCancel()

		if runCtx.Err() == context.DeadlineExceeded {
			testResults[i] = store.TestResult{
				Input:    tc.Input,
				Expected: tc.ExpectedOutput,
				Actual:   "[timeout — possible infinite loop]",
				Passed:   false,
			}
			allPassed = false
			continue
		}

		stdout := normalise(string(runOut))
		if runErr != nil && stdout == "" {
			// Runtime panic with no output
			stdout = normalise(string(runOut))
		}

		combinedStdout.WriteString(stdout)
		combinedStdout.WriteString("\n")

		expected := strings.TrimSpace(tc.ExpectedOutput)
		actual := strings.TrimSpace(stdout)
		passed := matchOutput(actual, expected)
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
		Stdout:      strings.TrimRight(combinedStdout.String(), "\n"),
		TestResults: testResults,
	}
}

// runOnce runs the program once (library/piscine mode) and matches output
// lines in order to test cases.
func runOnce(dir, filename string, testCases []store.TestCase, args string) store.ExecutionResult {
	runArgs := []string{"run", "."}
	if args != "" {
		runArgs = append(runArgs, splitArgs(args)...)
	}

	runCtx, runCancel := context.WithTimeout(context.Background(), execTimeout)
	defer runCancel()
	runCmd := exec.CommandContext(runCtx, "go", runArgs...)
	runCmd.Dir = dir
	runOut, runErr := runCmd.CombinedOutput()

	if runCtx.Err() == context.DeadlineExceeded {
		return store.ExecutionResult{
			CompilationError: fmt.Sprintf("program exceeded time limit (%s) — possible infinite loop", execTimeout),
			TestResults:      noResultsFor(testCases),
		}
	}

	stdout := normalise(string(runOut))

	if runErr != nil && stdout == "" {
		cleaned := cleanError(stdout, filename)
		return store.ExecutionResult{
			CompilationError: cleaned,
			Stdout:           stdout,
			TestResults:      noResultsFor(testCases),
		}
	}

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
		passed := matchOutput(strings.TrimSpace(actual), strings.TrimSpace(expected))
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

// matchOutput compares actual vs expected output.
// Supports "..." as a wildcard for truncated expected output.
func matchOutput(actual, expected string) bool {
	if !strings.Contains(expected, "...") {
		return actual == expected
	}
	parts := strings.SplitN(expected, "...", 2)
	prefix := strings.TrimSpace(parts[0])
	suffix := ""
	if len(parts) == 2 {
		suffix = strings.TrimSpace(parts[1])
		suffix = strings.TrimPrefix(suffix, ", ")
	}
	return strings.HasPrefix(actual, prefix) &&
		(suffix == "" || strings.HasSuffix(actual, suffix))
}

// normalise cleans up raw program output: CRLF → LF, trim trailing newline.
func normalise(raw string) string {
	s := strings.ReplaceAll(raw, "\r\n", "\n")
	s = strings.ReplaceAll(s, "\r", "\n")
	return strings.TrimRight(s, "\n")
}

// splitArgs splits a string into shell-like arguments, respecting single and
// double quoted strings so that spaces inside quotes are preserved as one arg.
//
// Examples:
//
//	`123 456`                    → ["123", "456"]
//	`"hello world" foo`          → ["hello world", "foo"]
//	`'quarante deux' abc`        → ["quarante deux", "abc"]
func splitArgs(s string) []string {
	var args []string
	var current strings.Builder
	inSingle := false
	inDouble := false

	for _, r := range s {
		switch {
		case r == '\'' && !inDouble:
			inSingle = !inSingle
		case r == '"' && !inSingle:
			inDouble = !inDouble
		case unicode.IsSpace(r) && !inSingle && !inDouble:
			if current.Len() > 0 {
				args = append(args, current.String())
				current.Reset()
			}
		default:
			current.WriteRune(r)
		}
	}
	if current.Len() > 0 {
		args = append(args, current.String())
	}
	return args
}

// cleanError strips internal temp paths from compiler output.
func cleanError(raw, filename string) string {
	lines := strings.Split(raw, "\n")
	var out []string
	for _, line := range lines {
		if strings.HasPrefix(line, "# goexam") {
			continue
		}
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
