package store

// TestCase is a single input/expected-output pair.
type TestCase struct {
	Input          string `json:"input"`
	ExpectedOutput string `json:"expectedOutput"`
}

// Challenge is the full definition of a coding challenge.
type Challenge struct {
	ID               string     `json:"id"`
	Level            int        `json:"level"`
	Title            string     `json:"title"`
	Category         string     `json:"category"`   // "REQUIRED" | "BONUS"
	Difficulty       int        `json:"difficulty"` // 1-5
	XP               string     `json:"xp"`         // e.g. "100.0 B"
	FilesToSubmit    string     `json:"filesToSubmit"`
	AllowedFunctions string     `json:"allowedFunctions"`
	Instructions     []string   `json:"instructions"`
	ExpectedSig      string     `json:"expectedSignature"`
	TestTemplate     string     `json:"testTemplate"`
	InitialCode      string     `json:"initialStudentCode"`
	TestCases        []TestCase `json:"testCases"`
}

// LeaderboardEntry is a single row on the leaderboard.
type LeaderboardEntry struct {
	ID             string  `json:"id"`
	Name           string  `json:"name"`
	XP             float64 `json:"xp"`
	Rank           int     `json:"rank"`
	CompletedCount int     `json:"completedCount"`
	CurrentStreak  int     `json:"currentStreak"`
	IsCurrentUser  bool    `json:"isCurrentUser,omitempty"`
}

// ExecutionResult is returned by /api/run and /api/submit.
type ExecutionResult struct {
	Success          bool         `json:"success"`
	CompilationError string       `json:"compilationError,omitempty"`
	Stdout           string       `json:"stdout"`
	TestResults      []TestResult `json:"testResults"`
}

// TestResult is one test case outcome.
type TestResult struct {
	Input    string `json:"input"`
	Expected string `json:"expected"`
	Actual   string `json:"actual"`
	Passed   bool   `json:"passed"`
}
