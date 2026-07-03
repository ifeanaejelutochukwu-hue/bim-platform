import React, { useState } from "react";
import { User } from "../types";
import { LogOut, BookOpen, Clock, ArrowRight } from "lucide-react";

interface HomePageProps {
  user: User | null;
  token: string | null;
  onStartPractice: () => void;
  onStartExam: (numQuestions: number, timeLimitMinutes: number) => void;
  onLogout: () => void;
}

export default function HomePage({ user, token: _token, onStartPractice, onStartExam, onLogout }: HomePageProps) {
  const [numQuestions, setNumQuestions] = useState(10);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(30);
  const isGuest = user === null;
  const displayName = isGuest ? "Guest" : user.username;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">

      {/* ── Nav bar ────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        {/* BIM Logo — keep emerald untouched */}
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
            <span className="text-xs font-semibold text-[#800020] bg-[#800020]/8 border border-[#800020]/25 px-2.5 py-1 rounded-full font-mono">
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

      {/* ── Guest banner ─────────────────────────────────────────────────── */}
      {isGuest && (
        <div className="bg-amber-50 border-b border-amber-200 px-5 py-2.5 text-center text-sm text-amber-700">
          You're browsing as a guest — <a href="#" onClick={onLogout} className="font-semibold underline cursor-pointer">sign in</a> to save your progress and track scores
        </div>
      )}

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-14">

        {/* Welcome heading */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#800020]/8 border border-[#800020]/25 rounded-full mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#800020]" />
            <span className="text-xs font-semibold text-[#800020] uppercase tracking-wider">
              {isGuest ? "Guest Session" : "Dashboard"}
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-gray-900 tracking-tight mb-3" style={{ letterSpacing: "-0.03em" }}>
            {isGuest ? "Welcome," : "Welcome back,"}{" "}
            <span className="text-[#800020]">{displayName}</span>
          </h1>
          <p className="text-gray-500 text-base max-w-md mx-auto">
            {isGuest
              ? "Explore challenges and try exam mode without creating an account."
              : "Choose your mode and start writing Go code."}
          </p>
        </div>

        {/* Mode cards */}
        <div className="w-full max-w-3xl grid grid-cols-1 sm:grid-cols-2 gap-6">

          {/* ── Practice Checkpoint card ────────────────────────────── */}
          <div
            className="bg-white border-2 border-gray-100 hover:border-[#800020]/40 rounded-2xl p-7 flex flex-col gap-5 transition-all shadow-sm hover:shadow-md group cursor-pointer"
            onClick={onStartPractice}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#800020]/6 border-2 border-[#800020]/20 flex items-center justify-center shrink-0 group-hover:border-[#800020]/40 group-hover:bg-[#800020]/10 transition-all">
                <BookOpen className="w-6 h-6 text-[#800020]" />
              </div>
              <div>
                <h2 className="text-xl font-black text-gray-900 tracking-tight">Practice Checkpoint</h2>
                <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
                  Browse all challenges at your own pace. Switch freely between questions and learn without pressure.
                </p>
              </div>
            </div>

            <ul className="space-y-2 text-sm text-gray-500">
              {[
                "Free navigation between challenges",
                "Unlimited run attempts",
                "Progress tracked per question",
              ].map(f => (
                <li key={f} className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-[#800020]/8 border border-[#800020]/30 flex items-center justify-center shrink-0">
                    <svg className="w-2.5 h-2.5 text-[#800020]" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="10 3 5 8 2 5" />
                    </svg>
                  </span>
                  {f}
                </li>
              ))}
            </ul>

            <button
              onClick={onStartPractice}
              className="mt-auto w-full py-3 bg-[#800020] hover:bg-[#6b001b] text-white font-semibold text-sm rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm shadow-[#800020]/20"
            >
              Start Practicing <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* ── Take Exam card ──────────────────────────────────────── */}
          <div className="bg-white border-2 border-gray-100 hover:border-indigo-300 rounded-2xl p-7 flex flex-col gap-5 transition-all shadow-sm hover:shadow-md group">
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
              {[
                "Countdown timer",
                "Score recorded on completion",
                "Per-question breakdown",
              ].map(f => (
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

            {/* Exam config */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5">
                <label className="text-sm text-gray-600 font-medium">Questions</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setNumQuestions(q => Math.max(5, q - 5))}
                    className="w-6 h-6 rounded-md bg-white border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 cursor-pointer font-bold text-sm leading-none"
                  >−</button>
                  <span className="text-sm font-bold text-indigo-700 font-mono w-6 text-center">{numQuestions}</span>
                  <button
                    type="button"
                    onClick={() => setNumQuestions(q => Math.min(30, q + 5))}
                    className="w-6 h-6 rounded-md bg-white border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 cursor-pointer font-bold text-sm leading-none"
                  >+</button>
                </div>
              </div>

              <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5">
                <label className="text-sm text-gray-600 font-medium">Time limit</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setTimeLimitMinutes(t => Math.max(5, t - 5))}
                    className="w-6 h-6 rounded-md bg-white border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 cursor-pointer font-bold text-sm leading-none"
                  >−</button>
                  <span className="text-sm font-bold text-indigo-700 font-mono w-14 text-center">{timeLimitMinutes} min</span>
                  <button
                    type="button"
                    onClick={() => setTimeLimitMinutes(t => Math.min(120, t + 5))}
                    className="w-6 h-6 rounded-md bg-white border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 cursor-pointer font-bold text-sm leading-none"
                  >+</button>
                </div>
              </div>
            </div>

            <button
              onClick={() => onStartExam(numQuestions, timeLimitMinutes)}
              className="mt-auto w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm shadow-indigo-500/20"
            >
              Start Exam <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stats row for logged-in users */}
        {!isGuest && (
          <div className="mt-10 flex items-center gap-8 text-sm text-gray-400">
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-2xl font-black text-gray-800">{user.completed.length}</span>
              <span>completed</span>
            </div>
            <div className="w-px h-10 bg-gray-200" />
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-2xl font-black text-[#800020]">{Math.round(user.xp)}</span>
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
