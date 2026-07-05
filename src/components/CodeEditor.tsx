import React, { useState, useRef, useEffect } from "react";
import { Challenge, ExecutionResult } from "../types";
import { Trash2, Check, Info, Play, Send, RotateCcw } from "lucide-react";

// ---------------------------------------------------------------------------
// VS Code Dark+ Go syntax highlighter
// ---------------------------------------------------------------------------
function highlightGo(code: string): string {
  const goRegex =
    /(?<comment>\/\/.*|\/\*[\s\S]*?\*\/)|(?<string>"[^"\\]*(?:\\.[^"\\]*)*"|`[^`]*`|'[^'\\]*(?:\\.[^'\\]*)*')|(?<number>\b\d+(?:\.\d+)?\b|\b0x[a-fA-F0-9]+\b)|(?<keyword>\b(?:package|import|func|return|var|const|type|struct|interface|chan|map|go|select|case|default|if|else|for|range|switch|defer|fallthrough|goto|break|continue)\b)|(?<type>\b(?:int|int8|int16|int32|int64|uint|uint8|uint16|uint32|uint64|uintptr|float32|float64|complex64|complex128|string|bool|byte|rune|error|any)\b)|(?<builtin>\b(?:make|new|len|cap|append|copy|close|delete|panic|recover|print|println|nil|true|false)\b)|(?<funcCall>\b[a-zA-Z_]\w*(?=\s*\())|(?<identifier>\b[a-zA-Z_]\w*\b)/g;

  let lastIndex = 0;
  let html = "";
  goRegex.lastIndex = 0;
  let match;

  const esc = (t: string) =>
    t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  while ((match = goRegex.exec(code)) !== null) {
    if (match.index > lastIndex) html += esc(code.substring(lastIndex, match.index));
    const g = match.groups || {};
    const t = match[0];
    const e = esc(t);
    if (g.comment)     html += `<span style="color:#6a9955;font-style:italic">${e}</span>`;
    else if (g.string)  html += `<span style="color:#ce9178">${e}</span>`;
    else if (g.number)  html += `<span style="color:#b5cea8">${e}</span>`;
    else if (g.keyword) html += `<span style="color:#c586c0;font-weight:500">${e}</span>`;
    else if (g.type)    html += `<span style="color:#4ec9b0">${e}</span>`;
    else if (g.builtin) {
      if (t === "nil" || t === "true" || t === "false")
        html += `<span style="color:#569cd6;font-weight:500">${e}</span>`;
      else
        html += `<span style="color:#dcdcaa">${e}</span>`;
    }
    else if (g.funcCall)    html += `<span style="color:#dcdcaa">${e}</span>`;
    else if (g.identifier)  html += `<span style="color:#9cdcfe">${e}</span>`;
    else html += e;
    lastIndex = goRegex.lastIndex;
  }
  if (lastIndex < code.length) html += esc(code.substring(lastIndex));
  return html;
}

// ---------------------------------------------------------------------------
// Shared editor styles
// ---------------------------------------------------------------------------
const editorStyle: React.CSSProperties = {
  fontFamily: 'Consolas, Menlo, Monaco, "Courier New", Courier, monospace',
  fontSize: "14px",
  lineHeight: "22px",
  paddingTop: "16px",
  paddingBottom: "16px",
  paddingLeft: "16px",
  paddingRight: "16px",
  margin: 0,
  tabSize: 4,
  border: 0,
  boxSizing: "border-box",
  letterSpacing: "0px",
};

// ---------------------------------------------------------------------------
// Terminal line types
// ---------------------------------------------------------------------------
type TermLine =
  | { kind: "info"; text: string }
  | { kind: "allpass" }                   // bold green PASS banner
  | { kind: "error"; text: string }
  | { kind: "dim"; text: string }
  | { kind: "stdout"; text: string }
  | { kind: "divider" }
  | { kind: "testPass"; index: number; input: string }
  | { kind: "testFail"; index: number; input: string; expected: string; actual: string }
  | { kind: "summary"; passed: number; total: number };

// ---------------------------------------------------------------------------
// Terminal renderer
// ---------------------------------------------------------------------------
function Terminal({
  lines,
  isRunning,
  isSubmitting,
}: {
  lines: TermLine[];
  isRunning: boolean;
  isSubmitting: boolean;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines, isRunning, isSubmitting]);

  return (
    <div className="bg-[#0d0e14] border border-[#1e2030] rounded-lg p-4 overflow-y-auto font-mono text-[13px] select-text flex-1 min-h-[80px]">
      {(isRunning || isSubmitting) && (
        <div className="flex items-center gap-2 text-indigo-400 py-1 animate-pulse">
          <span className="inline-block w-2 h-2 rounded-full bg-indigo-400 animate-ping shrink-0" />
          <span>{isRunning ? "Compiling and running Go…" : "Submitting to checker…"}</span>
        </div>
      )}

      {!isRunning && !isSubmitting && lines.length === 0 && (
        <span className="text-slate-600 italic">
          Press <span className="text-slate-500 not-italic">run</span> to execute your code.
        </span>
      )}

      {!isRunning && !isSubmitting && lines.map((line, i) => {
        if (line.kind === "divider") {
          return <div key={i} className="border-t border-slate-800/60 my-2" />;
        }

        // ── Bold bright green PASS banner ──────────────────────────────
        if (line.kind === "allpass") {
          return (
            <div key={i} className="my-2 flex items-center gap-3 px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
              <span className="text-2xl font-black text-emerald-400 drop-shadow-[0_0_12px_rgba(52,211,153,0.8)]">✔</span>
              <span className="text-emerald-300 font-black text-base tracking-wide drop-shadow-[0_0_10px_rgba(52,211,153,0.6)]">
                PASS
              </span>
              <span className="text-emerald-500 text-xs font-semibold ml-1">All tests passed</span>
            </div>
          );
        }

        if (line.kind === "summary") {
          const allPassed = line.passed === line.total;
          return (
            <div key={i} className={`text-xs font-semibold mt-1 ${allPassed ? "text-emerald-400" : "text-rose-400"}`}>
              {line.passed}/{line.total} tests passed
            </div>
          );
        }

        if (line.kind === "testPass") {
          return (
            <div key={i} className="flex items-center gap-2 py-0.5">
              <span className="text-emerald-400 font-bold text-base leading-none">✓</span>
              <span className="text-slate-500 text-xs">Test {line.index + 1}</span>
              {line.input && <span className="text-slate-600 text-xs">({line.input})</span>}
              <span className="text-emerald-400 font-bold text-xs">PASS</span>
            </div>
          );
        }

        if (line.kind === "testFail") {
          return (
            <div key={i} className="py-1">
              <div className="flex items-center gap-2">
                <span className="text-rose-400 font-bold text-base leading-none">✗</span>
                <span className="text-slate-500 text-xs">Test {line.index + 1}</span>
                {line.input && <span className="text-slate-600 text-xs">({line.input})</span>}
                <span className="text-rose-400 font-bold text-xs">FAIL</span>
              </div>
              <div className="ml-5 mt-1 pl-3 border-l-2 border-rose-500/30 space-y-0.5 text-xs">
                <div className="flex gap-2">
                  <span className="text-slate-600 w-16 shrink-0">expected</span>
                  <span className="text-emerald-300 font-semibold">{line.expected}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-slate-600 w-16 shrink-0">got</span>
                  <span className="text-rose-300 font-semibold">{line.actual}</span>
                </div>
              </div>
            </div>
          );
        }

        const colorMap: Record<string, string> = {
          info:   "text-slate-300",
          error:  "text-rose-400",
          dim:    "text-slate-500",
          stdout: "text-slate-200",
        };
        return (
          <div key={i} className={`whitespace-pre-wrap leading-relaxed py-0.5 ${colorMap[line.kind] ?? "text-slate-300"}`}>
            {(line as any).text}
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// CodeEditor component
// ---------------------------------------------------------------------------
interface CodeEditorProps {
  challenge: Challenge;
  studentCode: string;
  setStudentCode: (code: string) => void;
  onRun: (args: string, mainCode: string) => Promise<ExecutionResult>;
  onSubmit: (mainCode: string) => Promise<ExecutionResult & { leaderboard?: any }>;
  hideSubmit?: boolean;
}

export default function CodeEditor({
  challenge,
  studentCode,
  setStudentCode,
  onRun,
  onSubmit,
  hideSubmit = false,
}: CodeEditorProps) {
  const [activeTab, setActiveTab] = useState<"main" | "student">("student");
  const [mainCode, setMainCode] = useState(challenge.testTemplate);
  const [programArgs, setProgramArgs] = useState("");
  const [termLines, setTermLines] = useState<TermLine[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  // Resizable terminal: percentage of total height used by the editor body (vs terminal panel)
  const [editorHeightPct, setEditorHeightPct] = useState(55);
  const containerRef = useRef<HTMLDivElement>(null);
  const termDragging = useRef(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mainTextareaRef = useRef<HTMLTextAreaElement>(null);
  const mainHighlightRef = useRef<HTMLPreElement>(null);
  const numbersRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);

  // Reset terminal & tab on challenge switch — key on id only to avoid
  // resetting when parent re-renders with a new object reference
  useEffect(() => {
    setActiveTab("student");
    setProgramArgs("");
    setMainCode(challenge.testTemplate);
    // Don't clear termLines here — keep last output visible
  }, [challenge.id]);
  // Terminal resize drag
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!termDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((e.clientY - rect.top) / rect.height) * 100;
      setEditorHeightPct(Math.min(85, Math.max(25, pct)));
    };
    const onUp = () => {
      termDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  const codeToShow = activeTab === "student" ? studentCode : mainCode;
  const lineCount = codeToShow.split("\n").length;

  // Sync scroll between textarea, highlight layer, and line numbers
  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const { scrollTop, scrollLeft } = e.currentTarget;
    if (numbersRef.current) numbersRef.current.scrollTop = scrollTop;
    if (highlightRef.current) {
      highlightRef.current.scrollTop = scrollTop;
      highlightRef.current.scrollLeft = scrollLeft;
    }
  };
  const handleTextareaSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    const before = el.value.substring(0, el.selectionStart);
    const lines = before.split("\n");
    setCursorPos({ line: lines.length, col: lines[lines.length - 1].length + 1 });
  };

  // ── VS Code-style smart editor key bindings ──────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    const start = el.selectionStart;
    const end   = el.selectionEnd;
    const value  = activeTab === "student" ? studentCode : mainCode;
    const setter = activeTab === "student" ? setStudentCode : setMainCode;
    const ref    = activeTab === "student" ? textareaRef : mainTextareaRef;

    const charBefore = value[start - 1] ?? "";
    const charAfter  = value[end]       ?? "";

    // Helper: apply a new value and set cursor/selection in next frame
    const apply = (newValue: string, cursorAt: number, selectEnd?: number) => {
      setter(newValue);
      requestAnimationFrame(() => {
        if (!ref.current) return;
        ref.current.selectionStart = cursorAt;
        ref.current.selectionEnd   = selectEnd ?? cursorAt;
      });
    };

    // Helper: get the indentation of the line containing position pos
    const lineIndent = (pos: number): string => {
      const lineStart = value.lastIndexOf("\n", pos - 1) + 1;
      return value.substring(lineStart, pos).match(/^[\t ]*/)?.[0] ?? "";
    };

    // ── Tab / Shift+Tab — indent or unindent selected lines ───────────
    if (e.key === "Tab") {
      e.preventDefault();
      if (start === end) {
        // No selection: insert a single tab at cursor
        apply(value.substring(0, start) + "\t" + value.substring(end), start + 1);
      } else {
        // Selection: indent every selected line
        const lineStart = value.lastIndexOf("\n", start - 1) + 1;
        const lineEnd   = value.indexOf("\n", end - 1);
        const block     = value.substring(lineStart, lineEnd === -1 ? undefined : lineEnd);
        if (e.shiftKey) {
          // Unindent: remove one leading tab (or up to 4 spaces) per line
          const unindented = block.replace(/^(\t| {1,4})/gm, "");
          const newValue   = value.substring(0, lineStart) + unindented + (lineEnd === -1 ? "" : value.substring(lineEnd));
          const delta      = block.length - unindented.length;
          apply(newValue, Math.max(lineStart, start - (block.substring(0, start - lineStart).match(/^(\t| {1,4})/m)?.[0].length ?? 0)), end - delta);
        } else {
          // Indent: add a tab at the start of every line
          const indented = block.replace(/^/gm, "\t");
          const newValue = value.substring(0, lineStart) + indented + (lineEnd === -1 ? "" : value.substring(lineEnd));
          const addedBefore = start === lineStart ? 1 : 1; // one tab added before selection start
          apply(newValue, start + 1, end + (indented.length - block.length));
        }
      }
      return;
    }

    // ── Enter — auto-indent + smart { } expansion ─────────────────────
    if (e.key === "Enter") {
      e.preventDefault();
      const indent = lineIndent(start);

      if (charBefore === "{" && charAfter === "}") {
        // Cursor is between { } — expand with indented body, closing brace below
        // Result:
        //   {
        //       <cursor here>
        //   }
        const insert = "\n" + indent + "\t\n" + indent;
        apply(
          value.substring(0, start) + insert + value.substring(end),
          start + 1 + indent.length + 1   // land inside the body
        );
      } else if (charBefore === "{") {
        // Opening brace at end of line, no auto-close yet — add closing brace
        // Result:
        //   {
        //       <cursor here>
        //   }
        const insert = "\n" + indent + "\t\n" + indent + "}";
        apply(
          value.substring(0, start) + insert + value.substring(end),
          start + 1 + indent.length + 1
        );
      } else {
        // Normal enter — carry forward the current line's indentation
        const insert = "\n" + indent;
        apply(
          value.substring(0, start) + insert + value.substring(end),
          start + insert.length
        );
      }
      return;
    }

    // ── { — auto-close and place cursor inside ────────────────────────
    if (e.key === "{") {
      e.preventDefault();
      apply(
        value.substring(0, start) + "{}" + value.substring(end),
        start + 1   // cursor between { and }
      );
      return;
    }

    // ── } — skip over auto-inserted } rather than doubling it ─────────
    if (e.key === "}" && charAfter === "}") {
      e.preventDefault();
      apply(value, start + 1);   // just move past it
      return;
    }

    // ── Backspace — delete matching pair when cursor is between them ───
    if (e.key === "Backspace" && start === end) {
      const allPairs: Record<string, string> = {
        "{": "}", "(": ")", "[": "]", '"': '"', "`": "`",
      };
      if (allPairs[charBefore] && charAfter === allPairs[charBefore]) {
        e.preventDefault();
        apply(value.substring(0, start - 1) + value.substring(end + 1), start - 1);
        return;
      }
    }

    // ── ) ] — skip over auto-inserted closing char ────────────────────
    if ((e.key === ")" || e.key === "]") && start === end && charAfter === e.key) {
      e.preventDefault();
      apply(value, start + 1);
      return;
    }

    // ── Auto-pair: ( [ " ` ─────────────────────────────────────────────
    const openPairs: Record<string, string> = {
      "(": ")", "[": "]", '"': '"', "`": "`",
    };
    if (e.key in openPairs) {
      // Don't double-close quotes
      if ((e.key === '"' || e.key === "`") && charAfter === e.key) return;
      e.preventDefault();
      apply(
        value.substring(0, start) + e.key + openPairs[e.key] + value.substring(end),
        start + 1
      );
      return;
    }

    // ── Home — jump to first non-whitespace char (VS Code behaviour) ──
    if (e.key === "Home" && !e.ctrlKey) {
      e.preventDefault();
      const lineStart    = value.lastIndexOf("\n", start - 1) + 1;
      const firstNonWS   = lineStart + (value.substring(lineStart).match(/^[\t ]*/)?.[0].length ?? 0);
      // If already at first non-WS, go to true line start; otherwise go to first non-WS
      const target = start === firstNonWS ? lineStart : firstNonWS;
      if (e.shiftKey) {
        apply(value, Math.min(start, target), Math.max(start, target));
      } else {
        apply(value, target);
      }
      return;
    }
  };

  // Build terminal lines from an ExecutionResult
  function buildTermLines(
    res: ExecutionResult,
    mode: "run" | "submit",
    elapsed: number
  ): TermLine[] {
    const lines: TermLine[] = [];

    lines.push({ kind: "dim", text: `$ go run .  (${elapsed}ms)` });
    lines.push({ kind: "divider" });

    if (res.compilationError) {
      // Show a header line then every line of the compiler/runtime output
      // exactly as Go would print it — file:line:col: message
      lines.push({ kind: "error", text: "# build error" });
      lines.push({ kind: "divider" });
      res.compilationError.split("\n").forEach(l => {
        if (l.trim()) {
          // Lines like "ft_islower.go:5:2: undefined: fmt" stay as-is
          lines.push({ kind: "error", text: l });
        }
      });
      // If there was also runtime stdout (panic trace etc.), show it too
      if (res.stdout?.trim()) {
        lines.push({ kind: "divider" });
        lines.push({ kind: "dim", text: "output:" });
        res.stdout.split("\n").forEach(l => {
          if (l.trim()) lines.push({ kind: "error", text: l });
        });
      }
      return lines;
    }

    // Individual test results
    if (res.testResults && res.testResults.length > 0) {
      res.testResults.forEach((t, i) => {
        if (t.passed) {
          lines.push({ kind: "testPass", index: i, input: t.input });
        } else {
          lines.push({ kind: "testFail", index: i, input: t.input, expected: t.expected, actual: t.actual });
        }
      });
      lines.push({ kind: "divider" });

      const passed = res.testResults.filter(t => t.passed).length;
      const total = res.testResults.length;

      // Bold green PASS banner when all pass
      if (passed === total) {
        lines.push({ kind: "allpass" });
        if (mode === "submit") {
          lines.push({ kind: "dim", text: "XP awarded · leaderboard updated" });
        }
      } else {
        lines.push({ kind: "summary", passed, total });
      }
    } else if (res.stdout?.trim()) {
      // No test cases — just show stdout
      res.stdout.split("\n").forEach(l => lines.push({ kind: "stdout", text: l }));
    }

    // Show stdout underneath if present and there were test cases
    if (res.stdout?.trim() && res.testResults && res.testResults.length > 0) {
      lines.push({ kind: "divider" });
      lines.push({ kind: "dim", text: "stdout:" });
      res.stdout.split("\n").forEach(l => lines.push({ kind: "stdout", text: l }));
    }

    return lines;
  }

  const handleRun = async () => {
    if (isRunning || isSubmitting) return;
    setIsRunning(true);
    // Don't clear — keep previous output visible while running
    const t0 = Date.now();
    try {
      const res = await onRun(programArgs, mainCode);
      setTermLines(buildTermLines(res, "run", Date.now() - t0));
    } catch (err: any) {
      setTermLines([{ kind: "error", text: `Connection error: ${err.message}` }]);
    } finally {
      setIsRunning(false);
    }
  };

  const handleSubmit = async () => {
    if (isRunning || isSubmitting) return;
    setIsSubmitting(true);
    // Don't clear — keep previous output visible while submitting
    const t0 = Date.now();
    try {
      const res = await onSubmit(mainCode);
      setTermLines(buildTermLines(res, "submit", Date.now() - t0));
    } catch (err: any) {
      setTermLines([{ kind: "error", text: `Connection error: ${err.message}` }]);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div ref={containerRef} className="flex flex-col bg-[#1e1f29] border border-slate-800 rounded-xl overflow-hidden shadow-2xl h-full select-none">

      {/* ── Tab bar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between bg-[#15161d] border-b border-slate-800/60 px-3 py-1 shrink-0">
        <div className="flex items-center gap-1">

          {/* main.go tab — only shown for piscine (function) challenges */}
          {challenge.testTemplate && (
            <button
              onClick={() => setActiveTab("main")}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-mono font-medium border-r border-slate-800/60 transition-all ${
                activeTab === "main"
                  ? "bg-[#1e1f29] text-slate-200 border-t-2 border-t-indigo-400"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              <span>main.go</span>
              <Info className="w-3.5 h-3.5 text-slate-500" />
            </button>
          )}

          {/* student file tab */}
          <button
            onClick={() => setActiveTab("student")}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-mono font-medium border-r border-slate-800/60 transition-all ${
              activeTab === "student"
                ? "bg-[#1e1f29] text-slate-200 border-t-2 border-t-indigo-400"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <span>{challenge.filesToSubmit}</span>
            <span className="text-[10px] text-slate-600">×</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[9px] bg-indigo-500/10 text-indigo-400/85 border border-indigo-500/15 font-mono px-2 py-0.5 rounded">
            EDITABLE
          </span>
          {activeTab === "student" && (
            <button
              onClick={() => {
                if (confirm("Reset to initial code? Your current code will be lost.")) {
                  setStudentCode(challenge.initialStudentCode);
                }
              }}
              className="flex items-center gap-1 text-[11px] font-mono text-slate-600 hover:text-amber-400 transition-colors cursor-pointer"
              title="Reset to initial code"
            >
              <RotateCcw className="w-3 h-3" />
              <span>reset</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Code editor body ─────────────────────────────────────────────── */}
      <div className="relative flex bg-[#1e1f29] font-mono overflow-hidden" style={{ height: `${editorHeightPct}%`, minHeight: "120px" }}>
        {/* Line numbers */}
        <div
          ref={numbersRef}
          className="w-11 bg-[#15161d] text-slate-600 text-right pr-3 pt-4 pb-4 select-none border-r border-slate-800/40 overflow-hidden font-mono text-xs shrink-0"
          style={{ fontFamily: editorStyle.fontFamily, lineHeight: editorStyle.lineHeight }}
        >
          {Array.from({ length: lineCount }).map((_, i) => (
            <div key={i} style={{ height: "22px", lineHeight: "22px" }}>
              {i + 1}
            </div>
          ))}
        </div>

        {/* Editor / preview */}
        <div className="flex-1 relative overflow-hidden">
          {activeTab === "student" ? (
            <>
              {/* Highlighted layer — must mirror textarea scroll exactly */}
              <pre
                ref={highlightRef}
                aria-hidden="true"
                style={{ ...editorStyle, color: "#d4d4d4", backgroundColor: "transparent" }}
                className="absolute inset-0 w-full h-full whitespace-pre overflow-auto pointer-events-none select-none"
                dangerouslySetInnerHTML={{ __html: highlightGo(studentCode) + "\n" }}
              />
              {/* Editable textarea — transparent text, visible caret */}
              <textarea
                ref={textareaRef}
                value={studentCode}
                onChange={(e) => setStudentCode(e.target.value)}
                onScroll={handleScroll}
                onSelect={handleTextareaSelect}
                onKeyUp={handleTextareaSelect}
                onKeyDown={handleKeyDown}
                style={{
                  ...editorStyle,
                  color: "transparent",
                  WebkitTextFillColor: "transparent",
                  backgroundColor: "transparent",
                  caretColor: "#f1f5f9",
                }}
                className="absolute inset-0 w-full h-full outline-none resize-none overflow-auto whitespace-pre focus:ring-0 select-text"
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
                placeholder="// Write your Go implementation here"
              />
            </>
          ) : (
            <>
              {/* Highlighted layer for main.go */}
              <pre
                ref={mainHighlightRef}
                aria-hidden="true"
                style={{ ...editorStyle, color: "#d4d4d4", backgroundColor: "transparent" }}
                className="absolute inset-0 w-full h-full whitespace-pre overflow-auto pointer-events-none select-none"
                dangerouslySetInnerHTML={{ __html: highlightGo(mainCode) + "\n" }}
              />
              {/* Editable textarea for main.go */}
              <textarea
                ref={mainTextareaRef}
                value={mainCode}
                onChange={(e) => setMainCode(e.target.value)}
                onScroll={(e) => {
                  const { scrollTop, scrollLeft } = e.currentTarget;
                  if (numbersRef.current) numbersRef.current.scrollTop = scrollTop;
                  if (mainHighlightRef.current) {
                    mainHighlightRef.current.scrollTop = scrollTop;
                    mainHighlightRef.current.scrollLeft = scrollLeft;
                  }
                }}
                onSelect={handleTextareaSelect}
                onKeyUp={handleTextareaSelect}
                onKeyDown={handleKeyDown}
                style={{
                  ...editorStyle,
                  color: "transparent",
                  WebkitTextFillColor: "transparent",
                  backgroundColor: "transparent",
                  caretColor: "#f1f5f9",
                }}
                className="absolute inset-0 w-full h-full outline-none resize-none overflow-auto whitespace-pre focus:ring-0 select-text"
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
              />
            </>
          )}
        </div>
      </div>

      {/* ── Terminal resize handle ─────────────────────────────────────────── */}
      <div
        onMouseDown={(e) => {
          e.preventDefault();
          termDragging.current = true;
          document.body.style.cursor = "row-resize";
          document.body.style.userSelect = "none";
        }}
        className="h-1.5 shrink-0 bg-slate-800/60 hover:bg-indigo-500/60 transition-colors cursor-row-resize flex items-center justify-center group"
        title="Drag to resize terminal"
      >
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {[0,1,2,3,4].map(i => <div key={i} className="w-1 h-1 rounded-full bg-indigo-400/80" />)}
        </div>
      </div>

      {/* ── Terminal panel ────────────────────────────────────────────────── */}
      <div className="bg-[#13141a] border-t border-slate-800/80 p-4 font-sans select-text space-y-3 overflow-y-auto flex-1">

        {/* Args row */}
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono text-slate-500 shrink-0 flex items-center gap-1">
            <span className="text-indigo-400 text-[10px]">$</span> args:
          </span>
          <input
            type="text"
            value={programArgs}
            onChange={(e) => setProgramArgs(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRun()}
            placeholder="Optional program arguments (press Enter to run)"
            className="flex-1 bg-[#1e1f29]/80 text-xs font-mono text-slate-300 border border-slate-800 hover:border-slate-700 focus:border-indigo-500 rounded px-3 py-1.5 transition-all outline-none"
          />
        </div>

        {/* Terminal header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500/60" />
            <span className="text-[11px] font-mono text-slate-400 font-medium">terminal</span>
            <span className="text-[10px] text-slate-600 font-mono">— real Go {"`go run .`"}</span>
          </div>
          <button
            onClick={() => setTermLines([])}
            className="flex items-center gap-1 text-[11px] font-mono text-slate-600 hover:text-slate-300 transition-colors cursor-pointer"
            title="Clear terminal"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>clear</span>
          </button>
        </div>

        {/* Terminal output */}
        <Terminal lines={termLines} isRunning={isRunning} isSubmitting={isSubmitting} />
      </div>

      {/* ── Footer action bar ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between bg-[#0f1017] border-t border-slate-800/60 px-4 py-2.5 text-xs shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={handleRun}
            disabled={isRunning || isSubmitting}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/50 rounded cursor-pointer font-mono text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Play className="w-3 h-3" />
            <span>run</span>
          </button>

          {!hideSubmit && (
          <button
            onClick={handleSubmit}
            disabled={isRunning || isSubmitting}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/35 text-indigo-300 border border-indigo-500/25 rounded cursor-pointer font-mono text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="w-3 h-3" />
            <span>submit</span>
          </button>
          )}
        </div>

        {/* Status / cursor */}
        <div className="flex items-center gap-3 text-slate-600 font-mono text-[11px]">
          <span className="truncate max-w-[130px]">{challenge.filesToSubmit}</span>
          <span>Ln {cursorPos.line}, Col {cursorPos.col}</span>
          <span className="text-indigo-500 font-bold">Go</span>
        </div>
      </div>
    </div>
  );
}
