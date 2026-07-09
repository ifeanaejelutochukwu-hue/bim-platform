import React, { useState } from "react";
import { User, Challenge } from "../types";
import {
  LogOut, BookOpen, Clock, ArrowRight, Search, CheckSquare,
  Square, X, ChevronLeft,
} from "lucide-react";

interface HomePageProps {
  user: User | null;
  token: string | null;
  challenges: Challenge[];
  selectedChallengeIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onStartPractice: (ids: string[]) => void;
  onStartExam: (numQuestions: number, timeLimitMinutes: number, ids: string[]) => void;
  onLogout: () => void;
}

// ── Challenge selector screen ─────────────────────────────────────────────
interface ChallengeSelectorProps {
  mode: "practice" | "exam";
  challenges: Challenge[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  // exam-only config
  numQuestions: number;
  timeLimitMinutes: number;
  onNumQuestionsChange: (n: number) => void;
  onTimeLimitChange: (t: number) => void;
  onConfirm: () => void;
  onBack: () => void;
}

function ChallengeSelector({
  mode,
  challenges,
  selectedIds,
  onSelectionChange,
  numQuestions,
  timeLimitMinutes,
  onNumQuestionsChange,
  onTimeLimitChange,
  onConfirm,
  onBack,
}: ChallengeSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = searchQuery.trim() === ""
    ? challenges
    : challenges.filter(c =>
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.id.toLowerCase().includes(searchQuery.toLowerCase())
      );

  const toggle = (id: string) =>
    onSelectionChange(
      selectedIds.includes(id)
        ? selectedIds.filter(s => s !== id)
        : [...selectedIds, id]
    );

  const selectAllVisible = () => {
    const visibleIds = filtered.map(c => c.id);
    onSelectionChange(Array.from(new Set([...selectedIds, ...visibleIds])));
  };

  const clearAllVisible = () => {
    const visibleSet = new Set(filtered.map(c => c.id));
    onSelectionChange(selectedIds.filter(id => !visibleSet.has(id)));
  };

  const clearAll = () => onSelectionChange([]);

  const allVisibleSelected =
    filtered.length > 0 && filtered.every(c => selectedIds.includes(c.id));

  const poolSize = selectedIds.length > 0 ? selectedIds.length : challenges.length;
  const cappedQ = Math.min(numQuestions, poolSize);

  const isPractice = mode === "practice";
  const accentColor = isPractice ? "emerald" : "indigo";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
        <div className="h-5 w-px bg-gray-200" />
        <div className="flex items-center gap-2">
          {isPractice
            ? <BookOpen className="w-4 h-4 text-emerald-600" />
            : <Clock className="w-4 h-4 text-indigo-600" />
          }
          <span className="font-bold text-gray-900">
            {isPractice ? "Practice Checkpoint" : "Take Exam"} — Select Challenges
          </span>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center px-4 py-10 gap-6">
        {/* Exam-only config */}
        {!isPractice && (
          <div className="w-full max-w-3xl bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row gap-4">
            <div className="flex-1 flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
              <div>
                <label className="text-sm text-gray-600 font-medium">Questions</label>
                {poolSize < numQuestions && (
                  <p className="text-[10px] text-amber-600 mt-0.5">capped to pool of {poolSize}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => onNumQuestionsChange(Math.max(1, numQuestions - 5))}
                  className="w-7 h-7 rounded-md bg-white border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 cursor-pointer font-bold">−</button>
                <span className="text-sm font-bold text-indigo-700 font-mono w-6 text-center">{cappedQ}</span>
                <button type="button" onClick={() => onNumQuestionsChange(Math.min(Math.max(30, poolSize), numQuestions + 5))}
                  className="w-7 h-7 rounded-md bg-white border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 cursor-pointer font-bold">+</button>
              </div>
            </div>

            <div className="flex-1 flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
              <label className="text-sm text-gray-600 font-medium">Time limit</label>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => onTimeLimitChange(Math.max(5, timeLimitMinutes - 5))}
                  className="w-7 h-7 rounded-md bg-white border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 cursor-pointer font-bold">−</button>
                <span className="text-sm font-bold text-indigo-700 font-mono w-14 text-center">{timeLimitMinutes} min</span>
                <button type="button" onClick={() => onTimeLimitChange(Math.min(120, timeLimitMinutes + 5))}
                  className="w-7 h-7 rounded-md bg-white border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 cursor-pointer font-bold">+</button>
              </div>
            </div>
          </div>
        )}

        {/* Challenge browser */}
        <div className="w-full max-w-3xl bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex flex-col gap-4">

          {/* Top bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-gray-900">Choose challenges</h2>
              <span className="text-xs text-gray-400 font-normal">
                — leave none selected to use all
              </span>
            </div>
            <div className="flex items-center gap-2">
              {selectedIds.length > 0 && (
                <button onClick={clearAll}
                  className="flex items-center gap-1 text-xs text-rose-500 hover:text-rose-700 border border-rose-200 hover:border-rose-300 px-2 py-1 rounded-lg transition-colors cursor-pointer">
                  <X className="w-3 h-3" /> Clear all
                </button>
              )}
              {filtered.length > 0 && (
                <button onClick={allVisibleSelected ? clearAllVisible : selectAllVisible}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 px-2.5 py-1 rounded-lg transition-colors cursor-pointer">
                  {allVisibleSelected
                    ? <><Square className="w-3.5 h-3.5" /> Deselect visible</>
                    : <><CheckSquare className="w-3.5 h-3.5" /> Select visible</>
                  }
                </button>
              )}
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by title, category, or ID…"
              className="w-full pl-9 pr-9 py-2.5 border border-gray-300 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {searchQuery && (
            <p className="text-xs text-gray-500 -mt-2">
              {filtered.length} of {challenges.length} challenges match
            </p>
          )}

          {/* Grid */}
          {filtered.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[420px] overflow-y-auto pr-1">
              {filtered.map(c => {
                const isSelected = selectedIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => toggle(c.id)}
                    className={`text-left border rounded-lg p-4 transition-all cursor-pointer relative ${
                      isSelected
                        ? `bg-${accentColor}-50 border-${accentColor}-300 ring-1 ring-${accentColor}-200`
                        : "bg-gray-50 border-gray-200 hover:border-gray-300 hover:bg-white"
                    }`}
                  >
                    {/* Checkbox */}
                    <div className={`absolute top-3 right-3 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                      isSelected
                        ? accentColor === "emerald"
                          ? "bg-emerald-600 border-emerald-600"
                          : "bg-indigo-600 border-indigo-600"
                        : "bg-white border-gray-300"
                    }`}>
                      {isSelected && (
                        <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none"
                          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="10 3 5 8 2 5" />
                        </svg>
                      )}
                    </div>

                    <div className="flex items-start gap-2 mb-1.5 pr-6">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">{c.title}</h3>
                        <p className="text-[11px] text-gray-500 font-mono mt-0.5">Lvl {c.level} • {c.xp}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ${
                        c.category === "BONUS"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-emerald-100 text-emerald-700"
                      }`}>
                        {c.category}
                      </span>
                    </div>
                    <p className="text-[12px] text-gray-500 line-clamp-2">{c.instructions[0]}</p>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400 text-sm">
              No challenges match your search.
            </div>
          )}
        </div>

        {/* Confirm button */}
        <div className="w-full max-w-3xl">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-500">
              {selectedIds.length > 0
                ? <>
                    <span className={`font-semibold ${isPractice ? "text-emerald-600" : "text-indigo-600"}`}>{selectedIds.length}</span>
                    {" "}challenge{selectedIds.length !== 1 ? "s" : ""} selected
                  </>
                : <>All <span className="font-semibold text-gray-700">{challenges.length}</span> challenges will be used (default)</>
              }
              {!isPractice && (
                <span className="text-gray-400">
                  {" "}— drawing <span className="font-semibold text-gray-600">{cappedQ}</span> for your exam
                </span>
              )}
            </p>
          </div>
          <button
            onClick={onConfirm}
            className={`w-full py-3.5 text-white font-semibold text-sm rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm ${
              isPractice
                ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20"
                : "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20"
            }`}
          >
            {isPractice ? <BookOpen className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
            {isPractice ? "Start Practicing" : "Start Exam"}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </main>
    </div>
  );
}

// ── HomePage ──────────────────────────────────────────────────────────────
type InternalView = "home" | "select-practice" | "select-exam";

export default function HomePage({
  user,
  token: _token,
  challenges,
  selectedChallengeIds,
  onSelectionChange,
  onStartPractice,
  onStartExam,
  onLogout,
}: HomePageProps) {
  const [internalView, setInternalView] = useState<InternalView>("home");
  const [numQuestions, setNumQuestions] = useState(10);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(30);

  const isGuest = user === null;
  const displayName = isGuest ? "Guest" : user.username;

  // ── Challenge selector screens ───────────────────────────────────────
  if (internalView === "select-practice") {
    return (
      <ChallengeSelector
        mode="practice"
        challenges={challenges}
        selectedIds={selectedChallengeIds}
        onSelectionChange={onSelectionChange}
        numQuestions={numQuestions}
        timeLimitMinutes={timeLimitMinutes}
        onNumQuestionsChange={setNumQuestions}
        onTimeLimitChange={setTimeLimitMinutes}
        onConfirm={() => onStartPractice(selectedChallengeIds)}
        onBack={() => { onSelectionChange([]); setInternalView("home"); }}
      />
    );
  }

  if (internalView === "select-exam") {
    return (
      <ChallengeSelector
        mode="exam"
        challenges={challenges}
        selectedIds={selectedChallengeIds}
        onSelectionChange={onSelectionChange}
        numQuestions={numQuestions}
        timeLimitMinutes={timeLimitMinutes}
        onNumQuestionsChange={setNumQuestions}
        onTimeLimitChange={setTimeLimitMinutes}
        onConfirm={() => onStartExam(numQuestions, timeLimitMinutes, selectedChallengeIds)}
        onBack={() => { onSelectionChange([]); setInternalView("home"); }}
      />
    );
  }

  // ── Main home view ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">

      {/* Nav bar */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-white border-2 border-emerald-500 flex items-center justify-center shadow-[0_0_12px_rgba(16,185,129,0.2)]">
            <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round"
              className="w-5 h-5 text-emerald-500">
              <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="3" />
            </svg>
          </div>
          <span className="font-black text-xl text-gray-900 tracking-tight" style={{ letterSpacing: "-0.02em" }}>
            BIM
          </span>
        </div>

        <div className="flex items-center gap-3">
          {!isGuest && (
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full font-mono">
              {Math.round(user.xp)} XP
            </span>
          )}
          <span className="text-sm text-gray-500 hidden sm:block">
            {isGuest ? "Guest" : user.email}
          </span>
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isGuest ? "Exit" : "Sign Out"}</span>
          </button>
        </div>
      </header>

      {/* Guest banner */}
      {isGuest && (
        <div className="bg-amber-50 border-b border-amber-200 px-5 py-2.5 text-center text-sm text-amber-700">
          You're browsing as a guest —{" "}
          <a href="#" onClick={onLogout} className="font-semibold underline cursor-pointer">sign in</a>{" "}
          to save your progress and track scores
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-14">

        {/* Welcome heading */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
              {isGuest ? "Guest Session" : "Dashboard"}
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-gray-900 tracking-tight mb-3" style={{ letterSpacing: "-0.03em" }}>
            {isGuest ? "Welcome," : "Welcome back,"}{" "}
            <span className="text-emerald-600">{displayName}</span>
          </h1>
          <p className="text-gray-500 text-base max-w-md mx-auto">
            {isGuest
              ? "Explore challenges and try exam mode without creating an account."
              : "Choose your mode and start writing Go code."}
          </p>
        </div>

        {/* Mode cards */}
        <div className="w-full max-w-3xl grid grid-cols-1 sm:grid-cols-2 gap-6 mb-10">

          {/* Practice card */}
          <div
            onClick={() => { onSelectionChange([]); setInternalView("select-practice"); }}
            className="bg-white border-2 border-gray-100 hover:border-emerald-300 rounded-2xl p-7 flex flex-col gap-5 transition-all shadow-sm hover:shadow-md group cursor-pointer"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center shrink-0 group-hover:border-emerald-400 group-hover:bg-emerald-100 transition-all">
                <BookOpen className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-xl font-black text-gray-900 tracking-tight">Practice Checkpoint</h2>
                <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
                  Browse challenges at your own pace. Switch freely and learn without pressure.
                </p>
              </div>
            </div>

            <ul className="space-y-2 text-sm text-gray-500">
              {["Free navigation between challenges", "Unlimited run attempts", "Progress tracked per question"].map(f => (
                <li key={f} className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center shrink-0">
                    <svg className="w-2.5 h-2.5 text-emerald-600" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="10 3 5 8 2 5" />
                    </svg>
                  </span>
                  {f}
                </li>
              ))}
            </ul>

            <div className="mt-auto w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm shadow-emerald-500/20">
              Select Challenges <ArrowRight className="w-4 h-4" />
            </div>
          </div>

          {/* Exam card */}
          <div
            onClick={() => { onSelectionChange([]); setInternalView("select-exam"); }}
            className="bg-white border-2 border-gray-100 hover:border-indigo-300 rounded-2xl p-7 flex flex-col gap-5 transition-all shadow-sm hover:shadow-md group cursor-pointer"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 border-2 border-indigo-200 flex items-center justify-center shrink-0 group-hover:border-indigo-400 group-hover:bg-indigo-100 transition-all">
                <Clock className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-xl font-black text-gray-900 tracking-tight">Take Exam</h2>
                <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
                  Test yourself under real exam conditions. Timed session with a final score at the end.
                </p>
              </div>
            </div>

            <ul className="space-y-2 text-sm text-gray-500">
              {["Countdown timer", "Score recorded on completion", "Per-question breakdown"].map(f => (
                <li key={f} className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-indigo-100 border border-indigo-300 flex items-center justify-center shrink-0">
                    <svg className="w-2.5 h-2.5 text-indigo-600" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="10 3 5 8 2 5" />
                    </svg>
                  </span>
                  {f}
                </li>
              ))}
            </ul>

            <div className="mt-auto w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm shadow-indigo-500/20">
              Select Challenges <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Stats */}
        {!isGuest && (
          <div className="mt-4 flex items-center gap-8 text-sm text-gray-400">
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-2xl font-black text-gray-800">{user.completed.length}</span>
              <span>completed</span>
            </div>
            <div className="w-px h-10 bg-gray-200" />
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-2xl font-black text-emerald-600">{Math.round(user.xp)}</span>
              <span>total XP</span>
            </div>
          </div>
        )}
      </main>

      <footer className="bg-white border-t border-gray-200 px-6 py-4 text-center text-xs text-gray-400">
        © 2025 BIM · Where coders sharpen their edge
      </footer>
    </div>
  );
}
