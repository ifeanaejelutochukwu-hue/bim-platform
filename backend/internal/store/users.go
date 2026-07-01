package store

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"golang.org/x/crypto/bcrypt"
)

// User represents a registered user.
type User struct {
	ID           string    `json:"id"`
	Username     string    `json:"username"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"passwordHash"`
	Role         string    `json:"role"` // "student" | "admin"
	XP           float64   `json:"xp"`
	Completed    []string  `json:"completed"`
	CreatedAt    time.Time `json:"createdAt"`
}

// PublicUser is safe to return over the API (no password hash).
type PublicUser struct {
	ID        string   `json:"id"`
	Username  string   `json:"username"`
	Email     string   `json:"email"`
	Role      string   `json:"role"`
	XP        float64  `json:"xp"`
	Completed []string `json:"completed"`
}

func (u User) Public() PublicUser {
	return PublicUser{
		ID:        u.ID,
		Username:  u.Username,
		Email:     u.Email,
		Role:      u.Role,
		XP:        u.XP,
		Completed: u.Completed,
	}
}

// UserStore persists users to a JSON file.
type UserStore struct {
	mu       sync.RWMutex
	filePath string
	users    []User
}

func NewUserStore(filePath string) (*UserStore, error) {
	s := &UserStore{filePath: filePath}
	if err := os.MkdirAll(filepath.Dir(filePath), 0o755); err != nil {
		return nil, err
	}
	if _, err := os.Stat(filePath); err == nil {
		b, err := os.ReadFile(filePath)
		if err != nil {
			return nil, err
		}
		if err := json.Unmarshal(b, &s.users); err != nil {
			return nil, err
		}
	}
	return s, nil
}

func (s *UserStore) save() error {
	b, err := json.MarshalIndent(s.users, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.filePath, b, 0o644)
}

// SeedAdmin creates the admin user if not already present.
func (s *UserStore) SeedAdmin(email, username, password string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, u := range s.users {
		if u.Email == email {
			return nil // already seeded
		}
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		return err
	}
	admin := User{
		ID:           "admin-seed",
		Username:     username,
		Email:        email,
		PasswordHash: string(hash),
		Role:         "admin",
		XP:           0,
		Completed:    []string{},
		CreatedAt:    time.Now(),
	}
	s.users = append(s.users, admin)
	return s.save()
}

// Register creates a new student user.
func (s *UserStore) Register(email, username, password string) (User, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	for _, u := range s.users {
		if u.Email == email {
			return User{}, errors.New("email already registered")
		}
		if u.Username == username {
			return User{}, errors.New("username already taken")
		}
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		return User{}, err
	}

	user := User{
		ID:           fmt.Sprintf("user-%d", time.Now().UnixNano()),
		Username:     username,
		Email:        email,
		PasswordHash: string(hash),
		Role:         "student",
		XP:           0,
		Completed:    []string{},
		CreatedAt:    time.Now(),
	}
	s.users = append(s.users, user)
	if err := s.save(); err != nil {
		return User{}, err
	}
	return user, nil
}

// Login verifies credentials and returns the user.
func (s *UserStore) Login(email, password string) (User, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, u := range s.users {
		if u.Email == email {
			if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(password)); err != nil {
				return User{}, errors.New("invalid credentials")
			}
			return u, nil
		}
	}
	return User{}, errors.New("invalid credentials")
}

// GetByID returns a user by ID.
func (s *UserStore) GetByID(id string) (User, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, u := range s.users {
		if u.ID == id {
			return u, nil
		}
	}
	return User{}, fmt.Errorf("user %q not found", id)
}

// AddXP awards xp and marks a challenge complete for a user.
func (s *UserStore) AddXP(userID string, xp float64, challengeID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i, u := range s.users {
		if u.ID == userID {
			s.users[i].XP += xp
			// avoid duplicates
			for _, c := range s.users[i].Completed {
				if c == challengeID {
					goto save
				}
			}
			s.users[i].Completed = append(s.users[i].Completed, challengeID)
		save:
			return s.save()
		}
	}
	return fmt.Errorf("user %q not found", userID)
}

// ListAll returns all users as PublicUser (for admin).
func (s *UserStore) ListAll() []PublicUser {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]PublicUser, len(s.users))
	for i, u := range s.users {
		out[i] = u.Public()
	}
	return out
}
