package handler

import (
	"net/http"
	"strings"

	"goexam/internal/store"
)

type ChallengesHandler struct {
	store *store.ChallengeStore
}

func NewChallengesHandler(s *store.ChallengeStore) *ChallengesHandler {
	return &ChallengesHandler{store: s}
}

// GET /api/challenges
func (h *ChallengesHandler) List(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, h.store.List())
}

// GET /api/challenges/{id}
func (h *ChallengesHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/challenges/")
	c, err := h.store.GetByID(id)
	if err != nil {
		errJSON(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, c)
}

// POST /api/admin/challenges  (create)
func (h *ChallengesHandler) Create(w http.ResponseWriter, r *http.Request) {
	var c store.Challenge
	if err := readJSON(r, &c); err != nil {
		errJSON(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
		return
	}
	if c.ID == "" || c.Title == "" {
		errJSON(w, http.StatusBadRequest, "id and title are required")
		return
	}
	if err := h.store.Create(c); err != nil {
		errJSON(w, http.StatusConflict, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, c)
}

// PUT /api/admin/challenges/{id}  (update)
func (h *ChallengesHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/admin/challenges/")
	var c store.Challenge
	if err := readJSON(r, &c); err != nil {
		errJSON(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
		return
	}
	c.ID = id // ensure URL id wins
	if err := h.store.Update(c); err != nil {
		errJSON(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, c)
}

// DELETE /api/admin/challenges/{id}
func (h *ChallengesHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/admin/challenges/")
	if err := h.store.Delete(id); err != nil {
		errJSON(w, http.StatusNotFound, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
