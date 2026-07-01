package store

import (
	"sort"
	"sync"
)

// LeaderboardStore manages an in-memory leaderboard.
type LeaderboardStore struct {
	mu      sync.Mutex
	entries []LeaderboardEntry
}

func NewLeaderboardStore() *LeaderboardStore {
	return &LeaderboardStore{
		entries: []LeaderboardEntry{
			{ID: "1", Name: "Sofia", XP: 450, Rank: 1, CompletedCount: 5, CurrentStreak: 5},
			{ID: "2", Name: "Alex", XP: 320, Rank: 2, CompletedCount: 4, CurrentStreak: 3},
			{ID: "3", Name: "Chloe", XP: 280, Rank: 3, CompletedCount: 3, CurrentStreak: 2},
			{ID: "4", Name: "Devon", XP: 180, Rank: 4, CompletedCount: 2, CurrentStreak: 1},
			{ID: "user", Name: "You (Student)", XP: 0, Rank: 5, IsCurrentUser: true},
		},
	}
}

func (l *LeaderboardStore) List() []LeaderboardEntry {
	l.mu.Lock()
	defer l.mu.Unlock()
	out := make([]LeaderboardEntry, len(l.entries))
	copy(out, l.entries)
	return out
}

// AddXP awards xp to the current user and re-sorts.
func (l *LeaderboardStore) AddXP(xp float64) []LeaderboardEntry {
	l.mu.Lock()
	defer l.mu.Unlock()
	for i := range l.entries {
		if l.entries[i].IsCurrentUser {
			l.entries[i].XP += xp
			l.entries[i].CompletedCount++
			l.entries[i].CurrentStreak++
			break
		}
	}
	sort.Slice(l.entries, func(i, j int) bool {
		return l.entries[i].XP > l.entries[j].XP
	})
	for i := range l.entries {
		l.entries[i].Rank = i + 1
	}
	out := make([]LeaderboardEntry, len(l.entries))
	copy(out, l.entries)
	return out
}
