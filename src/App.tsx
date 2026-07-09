import React, { useState, useEffect, useRef, useCallback } from "react";
import { Challenge, ExecutionResult, User, AppView } from "./types";
import CodeEditor from "./components/CodeEditor";
import AuthPage from "./components/AuthPage";
import HomePage from "./components/HomePage";
import ExamMode from "./components/ExamMode";
import AdminDashboard from "./components/AdminDashboard";
import { ChevronRight, Check, BookOpen, X, LogOut, Shield } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// ── View/session persistence helpers ─────────────────────────────────────
function getStoredView(): AppView {
  try {
    const v = localStorage.getItem("goexam_view") as AppView | null;
    // Only restore meaningful views — don't restore exam mid-session
    if (v && ["home", "practice", "landing"].includes(v)) return v;
  } catch { /* ignore */ }
  return "landing";
}
function storeView(v: AppView) {
  try { localStorage.setItem("goexam_view", v); } catch { /* ignore */ }
}
function getStoredFlags(): { adminMode: boolean; isGuest: boolean } {
  try {
    const raw = localStorage.getItem("goexam_flags");
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { adminMode: false, isGuest: false };
}
function storeFlags(adminMode: boolean, isGuest: boolean) {
  try { localStorage.setItem("goexam_flags", JSON.stringify({ adminMode, isGuest })); } catch { /* ignore */ }
}

// ── Auth helpers ──────────────────────────────────────────────────────────
function getStoredAuth(): { user: User; token: string } | null {
  try {
    const raw = localStorage.getItem("goexam_auth");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}
function storeAuth(user: User, token: string) {
  localStorage.setItem("goexam_auth", JSON.stringify({ user, token }));
}
function clearAuth() { localStorage.removeItem("goexam_auth"); }

// ── BIM Logo (exported for shared use) ───────────────────────────────────
export function BimLogo({ size = "sm" }: { size?: "sm" | "lg" }) {
  const isLg = size === "lg";
  return (
    <div className={`flex items-center ${isLg ? "gap-3" : "gap-1.5"}`}>
      <div className={`relative flex items-center justify-center ${isLg ? "w-12 h-12 rounded-2xl" : "w-8 h-8 rounded-xl"} bg-emerald-500/10 border border-emerald-500/30`}>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`${isLg ? "w-6 h-6" : "w-4 h-4"} text-emerald-400`}
          style={{ filter: "drop-shadow(0 0 6px rgba(52,211,153,0.7))" }}
        >
          <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="3" />
        </svg>
      </div>
      <span
        className={`font-black tracking-tight text-white ${isLg ? "text-2xl" : "text-base"}`}
        style={{ letterSpacing: "-0.02em" }}
      >
        BIM
      </span>
    </div>
  );
}

// ── App root ──────────────────────────────────────────────────────────────
export default function App() {
  const [auth, setAuth] = useState<{ user: User; token: string } | null>(() => getStoredAuth());
  const [isGuest, setIsGuest] = useState(() => {
    if (!getStoredAuth()) return false;
    return getStoredFlags().isGuest;
  });
  const [view, setView] = useState<AppView>(() => {
    if (!getStoredAuth()) return "landing";
    return getStoredView();
  });
  const [adminMode, setAdminMode] = useState(() => {
    if (!getStoredAuth()) return false;
    return getStoredFlags().adminMode;
  });
  const [numExamQuestions, setNumExamQuestions] = useState(10);
  const [examTimeLimitMinutes, setExamTimeLimitMinutes] = useState(30);
  const [challenges, setChallenges] = useState<Challenge[]>([]);

  // Persist view and flags whenever they change
  useEffect(() => { storeView(view); }, [view]);
  useEffect(() => { storeFlags(adminMode, isGuest); }, [adminMode, isGuest]);

  // Fetch challenges — on mount when home, on window focus, and every 60s
  const fetchChallenges = useCallback(() => {
    fetch("/api/challenges")
      .then((r) => r.json())
      .then((data: Challenge[]) => setChallenges(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (view === "home" || view === "practice" || view === "exam") {
      fetchChallenges();
    }
  }, [view, fetchChallenges]);

  useEffect(() => {
    const onFocus = () => fetchChallenges();
    window.addEventListener("focus", onFocus);
    const interval = setInterval(fetchChallenges, 60_000);
    return () => {
      window.removeEventListener("focus", onFocus);
      clearInterval(interval);
    };
  }, [fetchChallenges]);

  const handleAuth = (user: User, token: string) => {
    storeAuth(user, token);
    setAuth({ user, token });
    setIsGuest(false);
    // Always go to "home" first — the routing below will redirect admins
    // to their dashboard once adminMode is set. Never leave view as "landing".
    if (user.role === "admin") {
      setAdminMode(true);
    }
    setView("home");
  };

  const handleQuickVisit = () => {
    setIsGuest(true);
    setAuth(null);
    setView("home");
  };

  const handleLogout = () => {
    clearAuth();
    localStorage.removeItem("goexam_view");
    localStorage.removeItem("goexam_flags");
    setAuth(null);
    setIsGuest(false);
    setAdminMode(false);
    setView("landing");
  };

  // ── Routing ──────────────────────────────────────────────────────────

  // Landing
  if (view === "landing") {
    return <AuthPage onAuth={handleAuth} onQuickVisit={handleQuickVisit} />;
  }

  // Admin dashboard
  if (adminMode && auth?.user.role === "admin") {
    return (
      <AdminDashboard
        token={auth.token}
        currentUser={auth.user}
        onLogout={handleLogout}
        onGoToPlatform={() => { setAdminMode(false); setView("home"); }}
      />
    );
  }

  // Home / dashboard
  if (view === "home") {
    return (
      <HomePage
        user={isGuest ? null : (auth?.user ?? null)}
        token={auth?.token ?? null}
        challenges={challenges}
        onStartPractice={() => setView("practice")}
        onStartExam={(n, t) => { setNumExamQuestions(n); setExamTimeLimitMinutes(t); setView("exam"); }}
        onLogout={handleLogout}
      />
    );
  }

  // Exam mode
  if (view === "exam") {
    const handleExamRun = async (
      challengeId: string,
      studentCode: string,
      args: string,
      mainCode: string
    ): Promise<ExecutionResult> => {
      const challenge = challenges.find((c) => c.id === challengeId);
      if (!challenge) throw new Error("Challenge not found");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (auth?.token) headers["Authorization"] = `Bearer ${auth.token}`;
      const res = await fetch("/api/run", {
        method: "POST",
        headers,
        body: JSON.stringify({
          challengeId: challenge.id,
          filename: challenge.filesToSubmit,
          studentCode,
          mainCode,
          testCases: challenge.testCases,
          args,
        }),
      });
      if (!res.ok) throw new Error("Server error");
      return res.json();
    };

    return (
      <ExamMode
        challenges={challenges}
        numQuestions={numExamQuestions}
        timeLimitMinutes={examTimeLimitMinutes}
        user={isGuest ? null : (auth?.user ?? null)}
        token={auth?.token ?? null}
        onRun={handleExamRun}
        onExit={() => setView("home")}
      />
    );
  }

  // Practice mode
  return (
    <Platform
      auth={auth}
      challenges={challenges}
      onChallengesLoaded={setChallenges}
      onLogout={handleLogout}
      onGoHome={() => setView("home")}
      onGoAdmin={auth?.user.role === "admin" ? () => setAdminMode(true) : undefined}
    />
  );
}

// ── Platform ──────────────────────────────────────────────────────────────
interface PlatformProps {
  auth: { user: User; token: string } | null;
  challenges: Challenge[];
  onChallengesLoaded: (challenges: Challenge[]) => void;
  onLogout: () => void;
  onGoHome: () => void;
  onGoAdmin?: () => void;
}

function Platform({ auth, challenges, onChallengesLoaded, onLogout, onGoHome, onGoAdmin }: PlatformProps) {
  const [loading, setLoading] = useState(challenges.length === 0);
  const [activeChallengeIndex, setActiveChallengeIndex] = useState(0);
  const [catalogOpen, setCatalogOpen] = useState(false);

  const [solutions, setSolutions] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem("go_exam_solutions") || "{}"); } catch { return {}; }
  });
  const [completedChallenges, setCompletedChallenges] = useState<string[]>(
    () => auth?.user.completed ?? []
  );
  const [successAnimation, setSuccessAnimation] = useState(false);

  // Resizable split (percentage width of the left panel, 20–80)
  const [splitPct, setSplitPct] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setSplitPct(Math.min(80, Math.max(20, pct)));
    };
    const onUp = () => {
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  useEffect(() => {
    if (challenges.length > 0) { setLoading(false); return; }
    fetch("/api/challenges")
      .then((r) => r.json())
      .then((data: Challenge[]) => { onChallengesLoaded(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [challenges.length, onChallengesLoaded]);

  useEffect(() => { localStorage.setItem("go_exam_solutions", JSON.stringify(solutions)); }, [solutions]);

  const currentChallenge = challenges[activeChallengeIndex] ?? null;
  const currentCode = currentChallenge
    ? (solutions[currentChallenge.id] ?? currentChallenge.initialStudentCode)
    : "";

  const handleUpdateCode = (code: string) => {
    if (!currentChallenge) return;
    setSolutions((p) => ({ ...p, [currentChallenge.id]: code }));
  };

  const handleRun = async (args: string, mainCode: string): Promise<ExecutionResult> => {
    if (!currentChallenge) throw new Error("No challenge selected");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (auth?.token) headers["Authorization"] = `Bearer ${auth.token}`;
    const res = await fetch("/api/run", {
      method: "POST",
      headers,
      body: JSON.stringify({
        challengeId: currentChallenge.id,
        filename: currentChallenge.filesToSubmit,
        studentCode: currentCode,
        mainCode,
        testCases: currentChallenge.testCases,
        args,
      }),
    });
    if (!res.ok) throw new Error("Server error");
    return res.json();
  };

  const handleSubmit = async (mainCode: string): Promise<ExecutionResult & { leaderboard?: unknown }> => {
    if (!currentChallenge) throw new Error("No challenge selected");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (auth?.token) headers["Authorization"] = `Bearer ${auth.token}`;
    const res = await fetch("/api/submit", {
      method: "POST",
      headers,
      body: JSON.stringify({
        challengeId: currentChallenge.id,
        filename: currentChallenge.filesToSubmit,
        xpValue: currentChallenge.xp,
        studentCode: currentCode,
        mainCode,
        testCases: currentChallenge.testCases,
      }),
    });
    if (!res.ok) throw new Error("Server error");
    const data = await res.json();
    if (data.success) {
      setCompletedChallenges((p) => p.includes(currentChallenge.id) ? p : [...p, currentChallenge.id]);
      setSuccessAnimation(true);
      setTimeout(() => {
        setSuccessAnimation((cur) => {
          if (cur) setActiveChallengeIndex((i) => (i + 1) % challenges.length);
          return false;
        });
      }, 2500);
    }
    return data;
  };

  if (loading) {
    return (
      <div className="h-screen w-screen bg-[#0c0d12] flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400 font-mono text-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          Loading…
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-[#121319] flex flex-col font-sans overflow-hidden selection:bg-indigo-500/25">

      {/* ── Top nav bar ─────────────────────────────────────────────────── */}
      <header className="h-11 bg-[#0e0f14] border-b border-slate-800/80 flex items-center justify-between px-4 shrink-0 z-40">
        <div className="flex items-center gap-4">
          <button onClick={onGoHome} className="cursor-pointer">
            <BimLogo size="sm" />
          </button>
          <div className="h-4 w-px bg-slate-800" />
          <button
            onClick={() => setCatalogOpen((o) => !o)}
            className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="font-medium">{currentChallenge?.title ?? "Select challenge"}</span>
            <svg className={`w-3 h-3 transition-transform ${catalogOpen ? "rotate-180" : ""}`} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="2 4 6 8 10 4"/></svg>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 font-mono hidden sm:block">
            {auth ? auth.user.username : "Guest"}
          </span>
          {currentChallenge && completedChallenges.includes(currentChallenge.id) && (
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Check className="w-3 h-3 stroke-[3]" /> PASS
            </span>
          )}
          <button onClick={onGoHome} title="Back to Home"
            className="p-1.5 text-slate-500 hover:text-indigo-400 transition-colors cursor-pointer rounded-lg hover:bg-slate-800">
            <ChevronRight className="w-3.5 h-3.5 rotate-180" />
          </button>
          {onGoAdmin && (
            <button onClick={onGoAdmin} title="Admin Dashboard"
              className="p-1.5 text-slate-500 hover:text-indigo-400 transition-colors cursor-pointer rounded-lg hover:bg-slate-800">
              <Shield className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={onLogout} title="Sign Out"
            className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer rounded-lg hover:bg-slate-800">
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* ── Challenge catalog dropdown ──────────────────────────────────── */}
      <AnimatePresence>
        {catalogOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute top-11 left-0 right-0 z-50 bg-[#111218] border-b border-slate-800 shadow-2xl"
          >
            <div className="max-w-2xl mx-auto py-3 px-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Challenges</span>
                <button onClick={() => setCatalogOpen(false)} className="text-slate-500 hover:text-slate-300 cursor-pointer">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-72 overflow-y-auto">
                {challenges.map((c, idx) => {
                  const isActive = idx === activeChallengeIndex;
                  const isDone = completedChallenges.includes(c.id);
                  return (
                    <button key={c.id}
                      onClick={() => { setActiveChallengeIndex(idx); setCatalogOpen(false); }}
                      className={`text-left px-3 py-2.5 rounded-lg border text-xs transition-all cursor-pointer flex items-center gap-2 ${
                        isActive ? "bg-indigo-600/10 border-indigo-500/40 text-indigo-300"
                        : isDone ? "bg-emerald-950/10 border-emerald-500/15 text-emerald-400/90"
                        : "bg-slate-900/50 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                      }`}
                    >
                      {isDone
                        ? <Check className="w-3 h-3 shrink-0 stroke-[3.5] text-emerald-400" />
                        : <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? "bg-indigo-400" : "bg-slate-600"}`} />
                      }
                      <div className="overflow-hidden">
                        <div className="truncate font-medium">{c.title}</div>
                        <div className="text-[10px] text-slate-600 font-mono">Lvl {c.level} · {c.xp}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main resizable split panel ─────────────────────────────────── */}
      {currentChallenge ? (
        <div ref={containerRef} className="flex flex-1 overflow-hidden relative">

          {/* Left: Question panel */}
          <div
            className="overflow-y-auto flex flex-col select-text bg-[#121319] shrink-0"
            style={{ width: `${splitPct}%` }}
          >
            {/* Spec bar */}
            <div className="bg-[#eae8f0] border-b border-[#dad6e5] shrink-0">
              <div className="flex items-center justify-between px-5 py-2.5 border-b border-[#dad6e5]">
                <div className="flex items-center gap-4">
                  <span className="text-[10px] font-mono font-extrabold text-[#5c5970] uppercase tracking-wider">
                    LEVEL {currentChallenge.level}
                  </span>
                  <span className="text-[10px] font-mono font-extrabold text-[#5c5970] uppercase tracking-wider">
                    {currentChallenge.category}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-0.5 text-[#5c5970]">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <span key={i} className="text-xs">{i < currentChallenge.difficulty ? "★" : "☆"}</span>
                    ))}
                  </div>
                  <span className="text-[10px] font-mono font-bold text-[#5c5970]">{currentChallenge.xp}</span>
                  <span className="text-[10px] font-mono text-[#5c5970] truncate max-w-[120px]">{currentChallenge.filesToSubmit}</span>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 flex flex-col gap-7">
              <div className="flex items-center gap-3 pb-2 border-b border-slate-800/60">
                <h1 className="text-xl font-extrabold text-slate-100 tracking-tight">{currentChallenge.title}</h1>
                {completedChallenges.includes(currentChallenge.id) && (
                  <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                    <Check className="w-3 h-3 stroke-[3]" /> PASS
                  </span>
                )}
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold text-slate-100 text-sm">Instructions</h3>
                <div className="h-px bg-slate-800/85" />
                <ul className="space-y-3">
                  {currentChallenge.instructions.map((inst, i) => (
                    <li key={i} className="text-sm text-slate-200 leading-relaxed flex items-start gap-3">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0 mt-2" />
                      <span>{inst}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {currentChallenge.expectedSignature && (
              <div className="space-y-2">
                <h3 className="font-semibold text-slate-300 text-xs uppercase tracking-wider">Expected function</h3>
                <div className="h-px bg-slate-800/85" />
                <pre className="bg-[#101116] border border-slate-800/80 rounded-lg p-4 font-mono text-sm text-indigo-400 overflow-x-auto">
                  {currentChallenge.expectedSignature}
                </pre>
              </div>
              )}

              {currentChallenge.testTemplate && (
              <div className="space-y-2">
                <h3 className="font-semibold text-slate-100 text-sm">Usage</h3>
                <div className="h-px bg-slate-800/85" />
                <p className="text-sm text-slate-400">Here is a possible program to test your function:</p>
                <pre className="bg-[#101116] border border-slate-700/80 rounded-lg p-4 font-mono text-sm text-slate-100 overflow-x-auto whitespace-pre leading-relaxed">
                  {currentChallenge.testTemplate}
                </pre>
              </div>
              )}

              {currentChallenge.testCases.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-slate-100 text-sm">Expected output</h3>
                  <div className="h-px bg-slate-800/85" />
                  <div className="bg-[#101116] border border-slate-700/80 rounded-lg overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-800/60 bg-[#0d0e14]">
                      <span className="w-2 h-2 rounded-full bg-rose-500/60" />
                      <span className="w-2 h-2 rounded-full bg-amber-500/60" />
                      <span className="w-2 h-2 rounded-full bg-emerald-500/60" />
                      <span className="ml-2 text-[11px] font-mono text-slate-500">$ go run .</span>
                    </div>
                    <pre className="p-4 font-mono text-sm text-slate-100 leading-relaxed whitespace-pre">
                      {currentChallenge.testCases.map((tc) => tc.expectedOutput).join("\n")}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Drag handle ────────────────────────────────────────────── */}
          <div
            onMouseDown={onDragStart}
            className="w-1 shrink-0 bg-slate-800/60 hover:bg-indigo-500/60 transition-colors cursor-col-resize relative group z-10"
            title="Drag to resize"
          >
            <div className="absolute inset-y-0 -left-1.5 -right-1.5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="flex flex-col gap-1">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="w-1 h-1 rounded-full bg-indigo-400/80" />
                ))}
              </div>
            </div>
          </div>

          {/* Right: Code editor */}
          <div className="flex flex-col overflow-hidden flex-1 min-w-0">
            <CodeEditor
              challenge={currentChallenge}
              studentCode={currentCode}
              setStudentCode={handleUpdateCode}
              onRun={handleRun}
              onSubmit={handleSubmit}
            />
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-slate-500 font-mono text-sm">
          No challenges found. Ask your admin to add some.
        </div>
      )}

      {/* ── Success overlay ────────────────────────────────────────────── */}
      <AnimatePresence>
        {successAnimation && currentChallenge && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none">
            <motion.div initial={{ scale: 0.95, y: 15 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 15 }}
              className="bg-[#1a1b24] border border-emerald-500/30 rounded-2xl p-8 max-w-sm text-center shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-emerald-500 to-indigo-500" />
              <div className="w-14 h-14 bg-emerald-500/15 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/30">
                <Check className="w-7 h-7 stroke-[3]" />
              </div>
              <h2 className="font-black text-xl text-slate-100 tracking-tight mb-2">Challenge Cleared!</h2>
              <p className="text-slate-400 text-xs leading-relaxed mb-5">Your solution passed all test cases.</p>
              <div className="bg-[#111218] rounded-xl p-3.5 border border-slate-800 flex items-center justify-between mb-5 font-mono text-xs">
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-bold">XP Gain</span>
                  <span className="text-emerald-400 font-bold text-sm block mt-0.5">+{currentChallenge.xp}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 text-[10px] uppercase font-bold">Level</span>
                  <span className="text-indigo-400 font-bold text-sm block mt-0.5">{currentChallenge.level}</span>
                </div>
              </div>
              <button
                onClick={() => { setSuccessAnimation(false); setActiveChallengeIndex((i) => (i + 1) % challenges.length); }}
                className="w-full py-2 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer">
                <span>Next Challenge</span><ChevronRight className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
