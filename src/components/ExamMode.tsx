import React, { useState, useEffect, useRef, useCallback } from "react";
import { Challenge, ExecutionResult, User, ExamResult } from "../types";
import CodeEditor from "./CodeEditor";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

interface ExamModeProps {
  challenges: Challenge[];
  numQuestions: number;
  timeLimitMinutes: number;
  user: User | null;
  token: string | null;
  onRun: (challengeId: string, studentCode: string, args: string, mainCode: string) => Promise<ExecutionResult>;
  onExit: () => void;
}

// BIM Logo for dark background
function BimLogo() {
  return (
    <div className="flex items-center gap-2">
      <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
        <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round"
          className="w-3.5 h-3.5 text-emerald-400"
          style={{ filter: "drop-shadow(0 0 5px rgba(52,211,153,0.7))" }}>
          <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="3" />
        </svg>
      </div>
      <span className="font-black text-sm text-white tracking-tight" style={{ letterSpacing: "-0.02em" }}>BIM</span>
    </div>
  );
}

/** Pick `n` random challenges from the pool (without replacement) */
function pickRandom(pool: Challenge[], n: number): Challenge[] {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, shuffled.length));
}

/** Format seconds as MM:SS */
function formatTime(secs: number): string {
  const m = Math.floor(Math.max(0, secs) / 60);
  const s = Math.max(0, secs) % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ── Exam Results Modal ────────────────────────────────────────────────────
interface ExamResultsModalProps {
  result: ExamResult;
  onRetry: () => void;
  onHome: () => void;
}

function ExamResultsModal({ result, onRetry, onHome }: ExamResultsModalProps) {
  const passed = result.score >= 70;
  const mm = Math.floor(result.timeTaken / 60);
  const ss = result.timeTaken % 60;
  const timeStr = `${mm}m ${ss}s`;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#13141c] border border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden">

        {/* Header stripe */}
        <div className={`h-1.5 w-full ${passed ? "bg-gradient-to-r from-emerald-500 to-teal-400" : "bg-gradient-to-r from-rose-500 to-orange-400"}`} />

        <div className="p-7">
          {/* Score */}
          <div className="text-center mb-6">
            <h2 className={`text-3xl font-black mb-1 ${passed ? "text-emerald-400" : "text-rose-400"}`}>
              {passed ? "Passed!" : "Keep Practicing"}
            </h2>
            <div className="text-6xl font-black text-white my-4" style={{ letterSpacing: "-0.03em" }}>
              {result.score}%
            </div>
            <div className="flex items-center justify-center gap-6 text-sm text-slate-400">
              <span>
                <span className="font-bold text-white">{result.correctAnswers}</span> / {result.totalQuestions} passed
              </span>
              <span className="text-slate-700">·</span>
              <span>
                Time: <span className="font-bold text-white">{timeStr}</span>
              </span>
            </div>
          </div>

          {/* Per-question breakdown */}
          <div className="space-y-1.5 max-h-52 overflow-y-auto mb-6">
            {result.details.map((d, i) => (
              <div key={d.challengeId}
                className={`flex items-center justify-between px-4 py-2.5 rounded-xl border text-sm ${
                  d.passed
                    ? "bg-emerald-500/5 border-emerald-500/20"
                    : "bg-rose-500/5 border-rose-500/20"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-slate-600 font-mono text-xs w-5">Q{i + 1}</span>
                  <span className="text-slate-200 font-medium truncate max-w-[220px]">{d.title}</span>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                  d.passed
                    ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                    : "text-rose-400 bg-rose-500/10 border-rose-500/20"
                }`}>
                  {d.passed ? "PASS" : "FAIL"}
                </span>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onRetry}
              className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm rounded-xl transition-colors cursor-pointer"
            >
              Try Again
            </button>
            <button
              onClick={onHome}
              className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm rounded-xl transition-colors cursor-pointer"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ExamMode ──────────────────────────────────────────────────────────────
export default function ExamMode({ challenges, numQuestions, timeLimitMinutes, user, token, onRun, onExit }: ExamModeProps) {
  const [examChallenges, setExamChallenges] = useState<Challenge[]>(() =>
    pickRandom(challenges, numQuestions)
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [studentCodes, setStudentCodes] = useState<Record<string, string>>({});
  // Track which question indices have been solved (at least one passing run)
  const [solvedIndices, setSolvedIndices] = useState<Set<number>>(new Set());
  const [timeLeft, setTimeLeft] = useState(timeLimitMinutes * 60);
  const [examStartTime] = useState(() => Date.now());
  const [examResult, setExamResult] = useState<ExamResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Submit confirmation dialog
  const [showConfirm, setShowConfirm] = useState(false);

  // Resizable split
  const [splitPct, setSplitPct] = useState(45);
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
      setSplitPct(Math.min(70, Math.max(25, pct)));
    };
    const onUp = () => {
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  // Countdown timer
  useEffect(() => {
    if (examResult) return;
    const id = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(id);
          handleSubmitExam();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examResult]);

  const currentChallenge = examChallenges[currentIndex];
  const currentCode = currentChallenge
    ? (studentCodes[currentChallenge.id] ?? currentChallenge.initialStudentCode)
    : "";

  const handleUpdateCode = (code: string) => {
    if (!currentChallenge) return;
    setStudentCodes((prev) => ({ ...prev, [currentChallenge.id]: code }));
  };

  const handleRunCurrent = async (args: string, mainCode: string): Promise<ExecutionResult> => {
    if (!currentChallenge) throw new Error("No challenge");
    const code = studentCodes[currentChallenge.id] ?? currentChallenge.initialStudentCode;
    const result = await onRun(currentChallenge.id, code, args, mainCode);
    // If all tests pass, mark this question as solved so Next unlocks
    const allPassed = result.success ||
      (result.testResults != null &&
       result.testResults.length > 0 &&
       result.testResults.every(t => t.passed));
    if (allPassed) {
      setSolvedIndices(prev => new Set([...prev, currentIndex]));
    }
    return result;
  };

  const handleSubmitExam = async () => {
    if (isSubmitting || examResult) return;
    setIsSubmitting(true);

    const timeTaken = Math.floor((Date.now() - examStartTime) / 1000);
    const details: ExamResult["details"] = [];

    for (const challenge of examChallenges) {
      const code = studentCodes[challenge.id] ?? challenge.initialStudentCode;
      let passed = false;
      try {
        const result = await onRun(challenge.id, code, "", challenge.testTemplate);
        passed = !!(result.success || (result.testResults && result.testResults.every((t) => t.passed)));
      } catch {
        passed = false;
      }
      details.push({ challengeId: challenge.id, title: challenge.title, passed });
    }

    const correctAnswers = details.filter((d) => d.passed).length;
    const totalQuestions = examChallenges.length;
    const score = Math.round((correctAnswers / totalQuestions) * 100);

    const result: ExamResult = { totalQuestions, correctAnswers, score, timeTaken, details };

    // POST score if authenticated
    if (user && token) {
      try {
        await fetch("/api/scores", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            userId: user.id,
            score,
            totalQuestions,
            correct: correctAnswers,
            timeTaken,
            details,
          }),
        });
      } catch {
        // Non-fatal: score submission failure doesn't block showing results
      }
    }

    setExamResult(result);
    setIsSubmitting(false);
  };

  const handleRetry = () => {
    setExamChallenges(pickRandom(challenges, numQuestions));
    setCurrentIndex(0);
    setStudentCodes({});
    setSolvedIndices(new Set());
    setTimeLeft(timeLimitMinutes * 60);
    setExamResult(null);
    setIsSubmitting(false);
    setShowConfirm(false);
  };

  if (!currentChallenge) {
    return (
      <div className="h-screen w-screen bg-[#0c0d12] flex items-center justify-center text-slate-500 font-mono text-sm">
        No challenges available for exam.
      </div>
    );
  }

  const isLowTime = timeLeft < 120;
  const totalTime = timeLimitMinutes * 60;
  const progressPct = ((totalTime - timeLeft) / totalTime) * 100;

  return (
    <div className="h-screen w-screen bg-[#121319] flex flex-col font-sans overflow-hidden">

      {/* ── Exam top bar ──────────────────────────────────────────────── */}
      <header className="h-12 bg-[#0e0f14] border-b border-slate-800/80 flex items-center justify-between px-4 shrink-0 z-40">
        <div className="flex items-center gap-4">
          <BimLogo />
          <div className="h-4 w-px bg-slate-800" />
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Exam in Progress</span>
        </div>

        <div className="flex items-center gap-4">
          {/* Timer */}
          <div className={`flex items-center gap-2 font-mono font-bold text-sm tabular-nums ${
            isLowTime ? "text-rose-400 animate-pulse" : "text-slate-200"
          }`}>
            <span>⏱</span>
            <span>{formatTime(timeLeft)}</span>
          </div>

          {/* Question counter */}
          <span className="text-xs text-slate-500 font-mono">
            Q {currentIndex + 1}/{examChallenges.length}
          </span>

          {/* Exit */}
          <button
            onClick={onExit}
            title="Exit Exam"
            className="p-1.5 text-slate-600 hover:text-rose-400 hover:bg-slate-800/60 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Timer progress bar */}
      <div className="h-0.5 bg-slate-800/60 shrink-0">
        <div
          className={`h-full transition-all duration-1000 ${isLowTime ? "bg-rose-500" : "bg-emerald-500"}`}
          style={{ width: `${100 - progressPct}%` }}
        />
      </div>

      {/* ── Main split panel ──────────────────────────────────────────── */}
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
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-0.5 text-[#5c5970]">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span key={i} className="text-xs">{i < currentChallenge.difficulty ? "★" : "☆"}</span>
                  ))}
                </div>
                <span className="text-[10px] font-mono font-bold text-[#5c5970]">{currentChallenge.xp}</span>
              </div>
            </div>
          </div>

          <div className="p-6 flex flex-col gap-7">
            <div className="flex items-center gap-3 pb-2 border-b border-slate-800/60">
              <h1 className="text-xl font-extrabold text-slate-100 tracking-tight">{currentChallenge.title}</h1>
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

            <div className="space-y-2">
              <h3 className="font-semibold text-slate-300 text-xs uppercase tracking-wider">Expected function</h3>
              <div className="h-px bg-slate-800/85" />
              <pre className="bg-[#101116] border border-slate-800/80 rounded-lg p-4 font-mono text-sm text-indigo-400 overflow-x-auto">
                {currentChallenge.expectedSignature}
              </pre>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold text-slate-100 text-sm">Usage</h3>
              <div className="h-px bg-slate-800/85" />
              <pre className="bg-[#101116] border border-slate-700/80 rounded-lg p-4 font-mono text-sm text-slate-100 overflow-x-auto whitespace-pre leading-relaxed">
                {currentChallenge.testTemplate}
              </pre>
            </div>

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

        {/* Drag handle */}
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

        {/* Right: Code editor (exam mode — no submit button) */}
        <div className="flex flex-col overflow-hidden flex-1 min-w-0">
          <CodeEditor
            challenge={currentChallenge}
            studentCode={currentCode}
            setStudentCode={handleUpdateCode}
            onRun={handleRunCurrent}
            onSubmit={(mainCode: string) => handleRunCurrent("", mainCode)}
            hideSubmit={true}
          />
        </div>
      </div>

      {/* ── Exam bottom nav bar ───────────────────────────────────────── */}
      <div className="h-12 bg-[#0e0f14] border-t border-slate-800/80 flex items-center justify-between px-4 shrink-0">
        {/* Previous — always allowed (can review solved questions) */}
        <button
          onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          disabled={currentIndex === 0}
          className="flex items-center gap-1.5 px-4 py-1.5 text-xs text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed bg-slate-800/60 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Previous
        </button>

        {/* Question dots — only solved / current are clickable */}
        <div className="flex items-center gap-1.5">
          {examChallenges.map((_, i) => {
            const isCurrent = i === currentIndex;
            const isSolved = solvedIndices.has(i);
            // Can navigate to: current, previous (any index ≤ current), or solved
            const canClick = i <= currentIndex || isSolved;
            return (
              <button
                key={i}
                onClick={() => canClick && setCurrentIndex(i)}
                disabled={!canClick}
                className={`transition-all rounded-full ${
                  isCurrent
                    ? "w-3 h-3 bg-indigo-400 scale-125 cursor-pointer"
                    : isSolved
                    ? "w-2.5 h-2.5 bg-emerald-500 cursor-pointer hover:scale-110"
                    : i < currentIndex
                    ? "w-2 h-2 bg-slate-500 cursor-pointer hover:bg-slate-400"
                    : "w-2 h-2 bg-slate-700 cursor-not-allowed opacity-40"
                }`}
                title={
                  isSolved ? `Q${i + 1} — solved ✓` :
                  isCurrent ? `Q${i + 1} — current` :
                  i < currentIndex ? `Q${i + 1} — attempted` :
                  `Q${i + 1} — locked (solve current first)`
                }
              />
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {/* Next — locked unless current question is solved */}
          <div className="relative group/next">
            <button
              onClick={() => setCurrentIndex((i) => Math.min(examChallenges.length - 1, i + 1))}
              disabled={currentIndex === examChallenges.length - 1 || !solvedIndices.has(currentIndex)}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed bg-slate-800/60 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            {/* Tooltip when locked */}
            {!solvedIndices.has(currentIndex) && currentIndex < examChallenges.length - 1 && (
              <div className="absolute bottom-full right-0 mb-2 px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-[10px] text-slate-300 whitespace-nowrap opacity-0 group-hover/next:opacity-100 transition-opacity pointer-events-none">
                Solve this question first to proceed
              </div>
            )}
          </div>

          {/* Submit Exam — shows confirm dialog */}
          <button
            onClick={() => setShowConfirm(true)}
            disabled={isSubmitting}
            className="flex items-center gap-1.5 px-5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors cursor-pointer"
          >
            {isSubmitting ? "Submitting…" : "Submit Exam"}
          </button>
        </div>
      </div>

      {/* ── Submit confirmation dialog ────────────────────────────────── */}
      {showConfirm && !isSubmitting && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#13141c] border border-slate-700 rounded-2xl p-7 max-w-sm w-full shadow-2xl">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 mx-auto mb-4">
              <svg className="w-6 h-6 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h2 className="text-lg font-black text-white text-center mb-2">Submit your exam?</h2>
            <p className="text-sm text-slate-400 text-center leading-relaxed mb-2">
              This will run your code against all {examChallenges.length} questions and record your final score.
            </p>
            <p className="text-xs text-slate-600 text-center mb-6">
              Solved: {solvedIndices.size} / {examChallenges.length} · You cannot go back after submitting.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-xl cursor-pointer transition-colors"
              >
                Keep Working
              </button>
              <button
                onClick={() => { setShowConfirm(false); handleSubmitExam(); }}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl cursor-pointer transition-colors"
              >
                Yes, Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Results modal ─────────────────────────────────────────────── */}
      {examResult && (
        <ExamResultsModal
          result={examResult}
          onRetry={handleRetry}
          onHome={onExit}
        />
      )}
    </div>
  );
}
