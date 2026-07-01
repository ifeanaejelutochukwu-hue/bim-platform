package store

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
)

// ChallengeStore reads and writes challenges to a JSON file.
type ChallengeStore struct {
	mu       sync.RWMutex
	filePath string
	data     []Challenge
}

// NewChallengeStore opens (or creates) the JSON file at filePath.
func NewChallengeStore(filePath string) (*ChallengeStore, error) {
	s := &ChallengeStore{filePath: filePath}

	// Ensure the parent directory exists.
	if err := os.MkdirAll(filepath.Dir(filePath), 0o755); err != nil {
		return nil, fmt.Errorf("store: create dir: %w", err)
	}

	// Load existing data if the file exists.
	if _, err := os.Stat(filePath); err == nil {
		b, err := os.ReadFile(filePath)
		if err != nil {
			return nil, fmt.Errorf("store: read file: %w", err)
		}
		if err := json.Unmarshal(b, &s.data); err != nil {
			return nil, fmt.Errorf("store: parse JSON: %w", err)
		}
	}

	return s, nil
}

func (s *ChallengeStore) save() error {
	b, err := json.MarshalIndent(s.data, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.filePath, b, 0o644)
}

// List returns all challenges (read-only slice).
func (s *ChallengeStore) List() []Challenge {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]Challenge, len(s.data))
	copy(out, s.data)
	return out
}

// GetByID returns a challenge by ID, or an error if not found.
func (s *ChallengeStore) GetByID(id string) (Challenge, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, c := range s.data {
		if c.ID == id {
			return c, nil
		}
	}
	return Challenge{}, fmt.Errorf("challenge %q not found", id)
}

// Create adds a new challenge and persists.
func (s *ChallengeStore) Create(c Challenge) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, existing := range s.data {
		if existing.ID == c.ID {
			return fmt.Errorf("challenge with id %q already exists", c.ID)
		}
	}
	s.data = append(s.data, c)
	return s.save()
}

// Update replaces a challenge by ID and persists.
func (s *ChallengeStore) Update(c Challenge) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i, existing := range s.data {
		if existing.ID == c.ID {
			s.data[i] = c
			return s.save()
		}
	}
	return fmt.Errorf("challenge %q not found", c.ID)
}

// Delete removes a challenge by ID and persists.
func (s *ChallengeStore) Delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i, c := range s.data {
		if c.ID == id {
			s.data = append(s.data[:i], s.data[i+1:]...)
			return s.save()
		}
	}
	return fmt.Errorf("challenge %q not found", id)
}
