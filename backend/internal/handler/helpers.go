package handler

import (
	"encoding/json"
	"net/http"

	"goexam/internal/store"
)

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func readJSON(r *http.Request, v any) error {
	return json.NewDecoder(r.Body).Decode(v)
}

func errJSON(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

// WriteLeaderboard is exported so main.go can use it for the /api/leaderboard route.
func WriteLeaderboard(w http.ResponseWriter, entries []store.LeaderboardEntry) {
	writeJSON(w, http.StatusOK, entries)
}
