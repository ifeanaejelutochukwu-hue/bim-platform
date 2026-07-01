package handler

import (
	"net/http"
	"strconv"

	"goexam/internal/auth"
	"goexam/internal/runner"
	"goexam/internal/store"
)

type RunHandler struct {
	challenges  *store.ChallengeStore
	leaderboard *store.LeaderboardStore
	users       *store.UserStore
}

func NewRunHandler(cs *store.ChallengeStore, lb *store.LeaderboardStore, us *store.UserStore) *RunHandler {
	return &RunHandler{challenges: cs, leaderboard: lb, users: us}
}

type runRequest struct {
	ChallengeID string           `json:"challengeId"`
	Filename    string           `json:"filename"`
	StudentCode string           `json:"studentCode"`
	MainCode    string           `json:"mainCode"`
	Args        string           `json:"args"`
	TestCases   []store.TestCase `json:"testCases"`
}

// POST /api/run
func (h *RunHandler) Run(w http.ResponseWriter, r *http.Request) {
	var req runRequest
	if err := readJSON(r, &req); err != nil {
		errJSON(w, http.StatusBadRequest, err.Error())
		return
	}
	if req.StudentCode == "" {
		errJSON(w, http.StatusBadRequest, "studentCode is required")
		return
	}

	filename, testCases, mainCode := resolveChallenge(h.challenges, req.ChallengeID, req.Filename, req.TestCases, req.MainCode)
	result := runner.Run(req.ChallengeID, filename, req.StudentCode, mainCode, testCases, req.Args)
	writeJSON(w, http.StatusOK, result)
}

type submitRequest struct {
	ChallengeID string           `json:"challengeId"`
	Filename    string           `json:"filename"`
	XPValue     string           `json:"xpValue"`
	StudentCode string           `json:"studentCode"`
	MainCode    string           `json:"mainCode"`
	TestCases   []store.TestCase `json:"testCases"`
}

// POST /api/submit
func (h *RunHandler) Submit(w http.ResponseWriter, r *http.Request) {
	var req submitRequest
	if err := readJSON(r, &req); err != nil {
		errJSON(w, http.StatusBadRequest, err.Error())
		return
	}
	if req.StudentCode == "" {
		errJSON(w, http.StatusBadRequest, "studentCode is required")
		return
	}

	filename, testCases, mainCode := resolveChallenge(h.challenges, req.ChallengeID, req.Filename, req.TestCases, req.MainCode)
	result := runner.Run(req.ChallengeID, filename, req.StudentCode, mainCode, testCases, "")

	type submitResponse struct {
		store.ExecutionResult
		Leaderboard []store.LeaderboardEntry `json:"leaderboard"`
	}

	lb := h.leaderboard.List()
	if result.Success {
		xp, _ := strconv.ParseFloat(req.XPValue, 64)
		if xp == 0 {
			xp = 100
		}
		lb = h.leaderboard.AddXP(xp)

		// Also update the user's persistent XP if they are logged in
		if claims, ok := auth.ClaimsFromContext(r.Context()); ok {
			if userID, ok := claims["sub"].(string); ok && userID != "" {
				_ = h.users.AddXP(userID, xp, req.ChallengeID)
			}
		}
	}

	writeJSON(w, http.StatusOK, submitResponse{
		ExecutionResult: result,
		Leaderboard:     lb,
	})
}

// resolveChallenge fills in missing fields from the stored challenge.
func resolveChallenge(cs *store.ChallengeStore, challengeID, filename string, testCases []store.TestCase, mainCode string) (string, []store.TestCase, string) {
	if challengeID != "" {
		if c, err := cs.GetByID(challengeID); err == nil {
			if filename == "" {
				filename = c.FilesToSubmit
			}
			if len(testCases) == 0 {
				testCases = c.TestCases
			}
			if mainCode == "" {
				mainCode = c.TestTemplate
			}
		}
	}
	if filename == "" {
		filename = challengeID + ".go"
	}
	return filename, testCases, mainCode
}
