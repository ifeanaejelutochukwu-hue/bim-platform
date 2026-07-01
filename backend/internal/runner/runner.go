package runner

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"goexam/internal/store"
)

const goModContent = "module goexam\ngo 1.21\n"

// Run compiles and executes the student's code against the test template.
// It creates a real Go module in a temp directory, builds it, runs it,
// and compares the output line-by-line to the expected test case outputs.
func Run(challengeID, filename, studentCode, mainCode string, testCases []store.TestCase, args string) store.ExecutionResult {
	// 1. Create a temp directory for this run.
	dir, err := os.MkdirTemp("", "goexam-run-")
	if err != nil {
		return errorResult(fmt.Sprintf("failed to create temp dir: %v", err))
	}
	defer os.RemoveAll(dir)

	piscineDir := filepath.Join(dir, "piscine")
	if err := os.Mkdir(piscineDir, 0o755); err != nil {
		return errorResult(fmt.Sprintf("failed to create piscine dir: %v", err))
	}

	// 2. Write go.mod
	if err := os.WriteFile(filepath.Join(dir, "go.mod"), []byte(goModContent), 0o644); err != nil {
		return errorResult(fmt.Sprintf("failed to write go.mod: %v", err))
	}

	// 3. Write student code as piscine/solution.go
	if err := os.WriteFile(filepath.Join(piscineDir, "solution.go"), []byte(studentCode), 0o644); err != nil {
		return errorResult(fmt.Sprintf("failed to write solution.go: %v", err))
	}

	// 4. Write main.go — replace "piscine" import with the local module path.
	fixedMain := strings.ReplaceAll(mainCode, `"piscine"`, `"goexam/piscine"`)
	if err := os.WriteFile(filepath.Join(dir, "main.go"), []byte(fixedMain), 0o644); err != nil {
		return errorResult(fmt.Sprintf("failed to write main.go: %v", err))
	}

	// 5. Build (gives clean compiler errors before we try to run).
	buildCmd := exec.Command("go", "build", "./...")
	buildCmd.Dir = dir
	buildOut, buildErr := buildCmd.CombinedOutput()
	if buildErr != nil {
		cleaned := cleanError(string(buildOut), filename)
		return store.ExecutionResult{
			CompilationError: cleaned,
			TestResults:      noResultsFor(testCases),
		}
	}

	// 6. Run the program.
	runArgs := []string{"run", "."}
	if args != "" {
		for _, a := range strings.Fields(args) {
			runArgs = append(runArgs, a)
		}
	}
	runCmd := exec.Command("go", runArgs...)
	runCmd.Dir = dir
	runOut, runErr := runCmd.CombinedOutput()
	stdout := strings.TrimRight(string(runOut), "\n")

	if runErr != nil {
		// Runtime panic or non-zero exit — show stderr but still run test matching.
		cleaned := cleanError(stdout, filename)
		return store.ExecutionResult{
			CompilationError: cleaned,
			Stdout:           stdout,
			TestResults:      noResultsFor(testCases),
		}
	}

	// 7. Compare output lines to expected outputs.
	outputLines := strings.Split(stdout, "\n")
	testResults := make([]store.TestResult, len(testCases))
	allPassed := len(testCases) > 0

	for i, tc := range testCases {
		var actual string
		if i < len(outputLines) {
			actual = strings.TrimRight(outputLines[i], "\r")
		}
		expected := strings.TrimRight(tc.ExpectedOutput, "\r\n")
		passed := actual == expected
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
		// Skip the module header line "# goexam/piscine"
		if strings.HasPrefix(line, "# goexam") {
			continue
		}
		// Replace the internal path with the student filename
		line = strings.ReplaceAll(line, "piscine/solution.go", filename)
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
