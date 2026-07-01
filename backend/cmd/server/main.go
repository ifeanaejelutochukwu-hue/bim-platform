package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"goexam/internal/auth"
	"goexam/internal/handler"
	"goexam/internal/store"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	dataDir := os.Getenv("DATA_DIR")
	if dataDir == "" {
		exe, _ := os.Executable()
		dataDir = filepath.Join(filepath.Dir(exe), "..", "data")
	}

	// ── Open stores ───────────────────────────────────────────────────────
	cs, err := store.NewChallengeStore(filepath.Join(dataDir, "challenges.json"))
	if err != nil {
		log.Fatalf("challenge store: %v", err)
	}

	us, err := store.NewUserStore(filepath.Join(dataDir, "users.json"))
	if err != nil {
		log.Fatalf("user store: %v", err)
	}

	lb := store.NewLeaderboardStore()

	// ── Seed admin account ────────────────────────────────────────────────
	// In production these MUST be set as environment variables.
	// The hardcoded fallbacks below are for local development only.
	adminEmail := os.Getenv("ADMIN_EMAIL")
	if adminEmail == "" {
		adminEmail = "ifeanaejelutochukwu@gmail.com"
		log.Println("⚠  ADMIN_EMAIL not set — using development default")
	}
	adminUname := os.Getenv("ADMIN_USERNAME")
	if adminUname == "" {
		adminUname = "ifeanyi"
	}
	adminPass := os.Getenv("ADMIN_PASSWORD")
	if adminPass == "" {
		adminPass = "Bigben"
		log.Println("⚠  ADMIN_PASSWORD not set — using development default (CHANGE IN PRODUCTION)")
	}
	if err := us.SeedAdmin(adminEmail, adminUname, adminPass); err != nil {
		log.Printf("warn: seeding admin: %v", err)
	}

	// ── Handlers ──────────────────────────────────────────────────────────
	ch := handler.NewChallengesHandler(cs)
	rh := handler.NewRunHandler(cs, lb, us)
	uh := handler.NewUserHandler(us)

	mux := http.NewServeMux()

	// ── Auth routes (public) ─────────────────────────────────────────────
	mux.HandleFunc("/api/auth/register", methodOnly(http.MethodPost, uh.Register))
	mux.HandleFunc("/api/auth/login", methodOnly(http.MethodPost, uh.Login))
	mux.Handle("/api/auth/me", auth.RequireAuth(http.HandlerFunc(uh.Me)))

	// ── Public routes ─────────────────────────────────────────────────────
	mux.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintln(w, `{"status":"ok","runtime":"go"}`)
	})

	mux.HandleFunc("/api/leaderboard", func(w http.ResponseWriter, r *http.Request) {
		handler.WriteLeaderboard(w, lb.List())
	})

	mux.HandleFunc("/api/challenges", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			ch.List(w, r)
			return
		}
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	})

	mux.HandleFunc("/api/challenges/", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			ch.Get(w, r)
			return
		}
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	})

	// /api/run and /api/submit: optional auth — works without token, but tracks XP if logged in
	mux.HandleFunc("/api/run", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		withOptionalAuth(rh.Run)(w, r)
	})

	mux.HandleFunc("/api/submit", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		withOptionalAuth(rh.Submit)(w, r)
	})

	// ── Admin routes (admin JWT required) ────────────────────────────────
	adminMux := http.NewServeMux()

	adminMux.HandleFunc("/api/admin/users", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			uh.ListAll(w, r)
			return
		}
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	})

	adminMux.HandleFunc("/api/admin/challenges", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			ch.List(w, r)
		case http.MethodPost:
			ch.Create(w, r)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})

	adminMux.HandleFunc("/api/admin/challenges/", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			ch.Get(w, r)
		case http.MethodPut:
			ch.Update(w, r)
		case http.MethodDelete:
			ch.Delete(w, r)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})

	mux.Handle("/api/admin/", auth.RequireAdmin(adminMux))

	log.Printf("🟢  Go backend :%s  |  data: %s  |  admin: %s", port, dataDir, adminEmail)
	if err := http.ListenAndServe(":"+port, corsMiddleware(mux)); err != nil {
		log.Fatal(err)
	}
}

// methodOnly rejects requests that don't match the given method.
func methodOnly(m string, fn http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != m {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		fn(w, r)
	}
}

// withOptionalAuth tries to attach JWT claims to the context but never rejects the request.
func withOptionalAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		header := r.Header.Get("Authorization")
		if strings.HasPrefix(header, "Bearer ") {
			tokenStr := strings.TrimPrefix(header, "Bearer ")
			if claims, err := auth.ParseToken(tokenStr); err == nil {
				r = auth.AttachClaims(r, claims)
			}
		}
		next(w, r)
	}
}

func corsMiddleware(next http.Handler) http.Handler {
	// Allowed origins: all localhost ports (dev) + the production Vercel domain.
	allowedOrigins := map[string]bool{}
	if prod := os.Getenv("ALLOWED_ORIGIN"); prod != "" {
		for _, o := range strings.Split(prod, ",") {
			allowedOrigins[strings.TrimSpace(o)] = true
		}
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		allowed := strings.Contains(origin, "localhost") ||
			strings.Contains(origin, "127.0.0.1") ||
			allowedOrigins[origin]

		if allowed && origin != "" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
