package handler

import (
	"net/http"

	"goexam/internal/auth"
	"goexam/internal/store"
)

type UserHandler struct {
	users *store.UserStore
}

func NewUserHandler(us *store.UserStore) *UserHandler {
	return &UserHandler{users: us}
}

type registerRequest struct {
	Email    string `json:"email"`
	Username string `json:"username"`
	Password string `json:"password"`
}

// POST /api/auth/register
func (h *UserHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req registerRequest
	if err := readJSON(r, &req); err != nil {
		errJSON(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	if req.Email == "" || req.Username == "" || req.Password == "" {
		errJSON(w, http.StatusBadRequest, "email, username and password are required")
		return
	}
	if len(req.Password) < 6 {
		errJSON(w, http.StatusBadRequest, "password must be at least 6 characters")
		return
	}

	user, err := h.users.Register(req.Email, req.Username, req.Password)
	if err != nil {
		errJSON(w, http.StatusConflict, err.Error())
		return
	}

	token, err := auth.IssueToken(user)
	if err != nil {
		errJSON(w, http.StatusInternalServerError, "failed to issue token")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{
		"token": token,
		"user":  user.Public(),
	})
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// POST /api/auth/login
func (h *UserHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := readJSON(r, &req); err != nil {
		errJSON(w, http.StatusBadRequest, "invalid JSON")
		return
	}

	user, err := h.users.Login(req.Email, req.Password)
	if err != nil {
		errJSON(w, http.StatusUnauthorized, "invalid credentials")
		return
	}

	token, err := auth.IssueToken(user)
	if err != nil {
		errJSON(w, http.StatusInternalServerError, "failed to issue token")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"token": token,
		"user":  user.Public(),
	})
}

// GET /api/auth/me  (requires auth)
func (h *UserHandler) Me(w http.ResponseWriter, r *http.Request) {
	claims, ok := auth.ClaimsFromContext(r.Context())
	if !ok {
		errJSON(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	userID, _ := claims["sub"].(string)
	user, err := h.users.GetByID(userID)
	if err != nil {
		errJSON(w, http.StatusNotFound, "user not found")
		return
	}
	writeJSON(w, http.StatusOK, user.Public())
}

// GET /api/admin/users  (admin only)
func (h *UserHandler) ListAll(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, h.users.ListAll())
}
