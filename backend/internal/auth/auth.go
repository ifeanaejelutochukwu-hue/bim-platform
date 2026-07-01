package auth

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"goexam/internal/store"
)

type contextKey string

const UserClaimsKey contextKey = "userClaims"

var jwtSecret = func() []byte {
	s := os.Getenv("JWT_SECRET")
	if s == "" {
		s = "goexam-jwt-secret-change-in-prod"
	}
	return []byte(s)
}()

// IssueToken creates a signed JWT for a user.
func IssueToken(user store.User) (string, error) {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":      user.ID,
		"username": user.Username,
		"email":    user.Email,
		"role":     user.Role,
		"exp":      time.Now().Add(24 * time.Hour).Unix(),
		"iat":      time.Now().Unix(),
	})
	return token.SignedString(jwtSecret)
}

// ParseToken validates a JWT string and returns the claims.
func ParseToken(tokenStr string) (jwt.MapClaims, error) {
	token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return jwtSecret, nil
	})
	if err != nil || !token.Valid {
		return nil, fmt.Errorf("invalid token")
	}
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, fmt.Errorf("invalid claims")
	}
	return claims, nil
}

// RequireAuth is middleware that validates the Bearer JWT.
// It attaches the claims to the request context.
func RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims, err := extractClaims(r)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}
		ctx := context.WithValue(r.Context(), UserClaimsKey, claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// RequireAdmin is middleware that validates the JWT AND checks role == admin.
func RequireAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims, err := extractClaims(r)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}
		if claims["role"] != "admin" {
			w.Header().Set("Content-Type", "application/json")
			http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
			return
		}
		ctx := context.WithValue(r.Context(), UserClaimsKey, claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func extractClaims(r *http.Request) (jwt.MapClaims, error) {
	header := r.Header.Get("Authorization")
	if !strings.HasPrefix(header, "Bearer ") {
		return nil, fmt.Errorf("no bearer token")
	}
	return ParseToken(strings.TrimPrefix(header, "Bearer "))
}

// ClaimsFromContext retrieves the JWT claims stored by RequireAuth.
func ClaimsFromContext(ctx context.Context) (jwt.MapClaims, bool) {
	c, ok := ctx.Value(UserClaimsKey).(jwt.MapClaims)
	return c, ok
}

// AttachClaims stores JWT claims into a request's context and returns the new request.
func AttachClaims(r *http.Request, claims any) *http.Request {
	ctx := context.WithValue(r.Context(), UserClaimsKey, claims)
	return r.WithContext(ctx)
}
