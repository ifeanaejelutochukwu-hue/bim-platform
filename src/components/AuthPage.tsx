import React, { useState } from "react";
import { User } from "../types";

interface AuthPageProps {
  onAuth: (user: User, token: string) => void;
  onQuickVisit: () => void;
}

export default function AuthPage({ onAuth, onQuickVisit }: AuthPageProps) {
  const [formMode, setFormMode] = useState<"login" | "register" | null>(null);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const openForm = (mode: "login" | "register") => {
    setFormMode(mode);
    setError("");
    setEmail("");
    setUsername("");
    setPassword("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formMode) return;
    setError("");
    setLoading(true);
    try {
      const endpoint = formMode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body =
        formMode === "login"
          ? { email, password }
          : { email, username, password };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }
      onAuth(data.user as User, data.token as string);
    } catch {
      setError("Network error — is the Go backend running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">

      {/* ── Nav bar ───────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        {/* BIM Logo */}
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
          <button
            onClick={() => openForm("login")}
            className="px-4 py-2 text-sm font-semibold text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
          >
            Sign In
          </button>
          <button
            onClick={() => openForm("register")}
            className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors cursor-pointer shadow-sm"
          >
            Get Started
          </button>
        </div>
      </header>

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16 text-center">

        {/* Badge */}
        <div className="inline-flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-white border-2 border-emerald-500 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.25)]">
            <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round"
              className="w-6 h-6 text-emerald-500">
              <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="3" />
            </svg>
          </div>
          <span className="text-4xl font-black text-gray-900 tracking-tight" style={{ letterSpacing: "-0.03em" }}>
            BIM
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-5xl sm:text-6xl font-black text-gray-900 tracking-tight mb-5 max-w-2xl" style={{ letterSpacing: "-0.03em" }}>
          Code. Practice.{" "}
          <span className="text-emerald-600">Succeed.</span>
        </h1>
        <p className="text-lg text-gray-500 max-w-xl mb-8 leading-relaxed">
          Write real code, get real results. Every submission runs against the actual compiler — no tricks, no shortcuts.
        </p>

        {/* Feature pills */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
          {["✓ Real compiler", "✓ Instant feedback", "✓ Exam simulation"].map(pill => (
            <span key={pill} className="px-4 py-1.5 bg-white border border-emerald-200 text-emerald-700 text-sm font-semibold rounded-full shadow-sm">
              {pill}
            </span>
          ))}
        </div>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 mb-6">
          <button
            onClick={() => openForm("login")}
            className="w-full sm:w-auto px-8 py-3.5 text-sm font-semibold text-gray-800 bg-white border-2 border-gray-800 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
          >
            Sign In
          </button>
          <button
            onClick={() => openForm("register")}
            className="w-full sm:w-auto px-8 py-3.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-colors cursor-pointer shadow-md shadow-emerald-500/25"
          >
            Create Account
          </button>
          <button
            onClick={onQuickVisit}
            className="w-full sm:w-auto px-8 py-3.5 text-sm font-semibold text-gray-400 hover:text-gray-600 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span>Quick Visit</span>
            <span>→</span>
            <span className="text-xs text-gray-400 font-normal">No account needed</span>
          </button>
        </div>

        {/* Divider */}
        {formMode && (
          <div className="w-full max-w-sm flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 font-medium">
              {formMode === "login" ? "Sign in to your account" : "Create a new account"}
            </span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
        )}

        {/* Collapsible auth form */}
        {formMode && (
          <div className="w-full max-w-sm bg-white border border-gray-200 rounded-2xl shadow-lg p-7">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-gray-900">
                {formMode === "login" ? "Welcome back" : "Join BIM"}
              </h2>
              <button
                onClick={() => setFormMode(null)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer text-lg leading-none"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">
                  Email
                </label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all"
                />
              </div>

              {formMode === "register" && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">
                    Username
                  </label>
                  <input
                    type="text"
                    required
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Choose a username"
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">
                  Password
                </label>
                <input
                  type="password"
                  required
                  autoComplete={formMode === "login" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={formMode === "register" ? "At least 6 characters" : "Your password"}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all text-sm cursor-pointer"
              >
                {loading
                  ? "Please wait…"
                  : formMode === "login"
                  ? "Sign In"
                  : "Create Account"}
              </button>
            </form>

            <p className="text-center text-xs text-gray-400 mt-4">
              {formMode === "login" ? (
                <>
                  Don't have an account?{" "}
                  <button onClick={() => openForm("register")} className="text-emerald-600 hover:underline cursor-pointer">
                    Create one
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button onClick={() => openForm("login")} className="text-emerald-600 hover:underline cursor-pointer">
                    Sign in
                  </button>
                </>
              )}
            </p>
          </div>
        )}

        {/* Stats bar */}
        {!formMode && (
          <div className="mt-10 flex items-center gap-6 text-sm text-gray-400">
            <div className="flex items-center gap-1.5">
              <span className="text-gray-300">📚</span>
              <span>Real Challenges</span>
            </div>
            <div className="w-px h-4 bg-gray-200" />
            <div className="flex items-center gap-1.5">
              <span className="text-gray-300">⚙️</span>
              <span>Real Compiler</span>
            </div>
            <div className="w-px h-4 bg-gray-200" />
            <div className="flex items-center gap-1.5">
              <span className="text-gray-300">⚡</span>
              <span>Instant Results</span>
            </div>
          </div>
        )}
      </main>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="bg-white border-t border-gray-200 px-6 py-4 text-center text-xs text-gray-400">
        © 2025 BIM · Where coders sharpen their edge
      </footer>
    </div>
  );
}
