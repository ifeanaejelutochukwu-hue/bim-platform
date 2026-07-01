import React, { useState, useEffect, useRef } from "react";
import { Challenge, User } from "../types";
import {
  Plus, Pencil, Trash2, Save, X, LogOut, Users, BookOpen,
  ChevronRight, BarChart2, RefreshCw, ClipboardPaste,
} from "lucide-react";

// ── Question Paste Parser ─────────────────────────────────────────────────
// Handles both plain-text (PDF copy-paste) and markdown (GitHub) formats.

/** Infer a sensible return value from a Go return type string */
function inferReturnDefault(sig: string): string {
  const m = sig.match(/\)\s*([\w*\[\]]+)\s*\{/);
  if (!m) return `return ""`;
  const t = m[1].trim();
  if (t === "bool") return "return false";
  if (t === "int" || t === "int64" || t === "int32" || t === "float64" || t === "float32") return "return 0";
  if (t === "string") return `return ""`;
  return `return ""`;
}

/** Reconstruct squished Go code (PDF copy-paste collapses newlines/indent) */
function reconstructGoMain(squished: string): string {
  // Already has newlines? Return as-is (was proper markdown)
  if (squished.includes("\n")) return squished.trim();

  // Typical squished pattern: `package main  import (   "fmt" )  func main() {  ...  }`
  let s = squished.trim();
  // Insert newline after package line
  s = s.replace(/^(package\s+\w+)\s+/, "$1\n\n");
  // import ( ... ) → multi-line
  s = s.replace(/import\s*\(\s*([\s\S]*?)\s*\)/g, (_m, inner) => {
    const pkgs = inner.split(/\s+/).filter(Boolean).map((p: string) => `\t${p}`).join("\n");
    return `import (\n${pkgs}\n)`;
  });
  // Newline before func
  s = s.replace(/\)\s+(func\s)/g, ")\n\nfunc ");
  // { at end of func line → newline
  s = s.replace(/(\{)\s+/g, "{\n\t");
  // Calls on same line separated by spaces → newlines
  s = s.replace(/(\))\s+(fmt\.|piscine\.)/g, ")\n\t$2");
  // Closing brace on its own line
  s = s.replace(/\s+\}$/, "\n}");
  return s;
}

function parseQuestion(raw: string): Partial<Challenge> | string {
  if (!raw.trim()) return "Paste is empty.";

  const text = raw.replace(/\r\n/g, "\n");
  const lines = text.split("\n");
  const result: Partial<Challenge> = {
    category: "REQUIRED",
    difficulty: 2,
    level: 10,
    xp: "100.0 B",
    allowedFunctions: "--allow-builtin",
    instructions: [],
    testCases: [],
  };

  // ── 1. Extract title: prefer func name from signature, else first heading ──
  const funcNameMatch = text.match(/func\s+([A-Z][a-zA-Z0-9]*)\s*\(/);
  if (funcNameMatch) {
    result.title = funcNameMatch[1];
  } else {
    const headingLine = lines.find(l => /^##?\s/.test(l));
    if (headingLine) {
      result.title = headingLine.replace(/^#+\s*/, "").trim();
    } else {
      // Plain-text: first non-empty line before "Instructions"
      const instrIdx = lines.findIndex(l => /^instructions$/i.test(l.trim()));
      const candidates = (instrIdx > 0 ? lines.slice(0, instrIdx) : lines).filter(l => l.trim());
      result.title = candidates[0]?.trim() ?? "";
    }
  }

  if (result.title) {
    result.id = result.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    result.filesToSubmit = result.title.toLowerCase().replace(/[^a-z0-9]/g, "") + ".go";
  }


  // ── 2. Extract instructions ────────────────────────────────────────
  // Grab text between "Instructions" and next section keyword
  const sectionBoundary = /^(#{1,3}\s*)?(expected function|expected functions|usage|expected|func )/i;
  const instrStartIdx = lines.findIndex(l => /^(#{1,3}\s*)?instructions?$/i.test(l.trim()));
  if (instrStartIdx >= 0) {
    const instrLines: string[] = [];
    for (let i = instrStartIdx + 1; i < lines.length; i++) {
      if (sectionBoundary.test(lines[i].trim())) break;
      const t = lines[i].replace(/^[-*•]\s*/, "").replace(/^`{3}.*/, "").trim();
      if (t && !t.startsWith("#")) instrLines.push(t);
    }
    result.instructions = instrLines.length > 0 ? instrLines : ["Implement the function as described."];
  } else {
    result.instructions = ["Implement the function as described."];
  }

  // ── 3. Extract expected signature ─────────────────────────────────
  // Find func line(s) in the text (skip package main context)
  const funcLineIdx = lines.findIndex(l => l.trim().startsWith("func ") && !/func main\(\)/.test(l));
  if (funcLineIdx >= 0) {
    const funcLine = lines[funcLineIdx].trim();
    // Build clean stub: `func Foo(...) RetType {\n\n}`
    const stubBody = funcLine.replace(/\{.*\}$/, "").replace(/\{\s*$/, "").trim();
    result.expectedSignature = `${stubBody} {\n\n}`;
  }

  // ── 4 & 7. Build initialStudentCode ───────────────────────────────
  if (result.expectedSignature) {
    const retDefault = inferReturnDefault(result.expectedSignature);
    const sig = result.expectedSignature.replace(/\{\s*\n?\s*\}/, "").trim();
    result.initialStudentCode =
      `package piscine\n\n${sig} {\n\t// Write your code here\n\t${retDefault}\n}`;
  }

  // ── 5. Extract main.go test template ──────────────────────────────
  // Try markdown code fences first
  const codeBlockRx = /```(?:go|golang)?\n?([\s\S]*?)```/g;
  let codeMatch: RegExpExecArray | null;
  let mainBlock = "";
  codeBlockRx.lastIndex = 0;
  while ((codeMatch = codeBlockRx.exec(text)) !== null) {
    if (codeMatch[1].includes("package main")) {
      mainBlock = codeMatch[1].trim();
      break;
    }
  }
  // Fall back: plain-text squished main block
  if (!mainBlock) {
    const mainLineIdx = lines.findIndex(l => /package main/.test(l));
    if (mainLineIdx >= 0) {
      mainBlock = reconstructGoMain(lines.slice(mainLineIdx).join(" ").trim());
    }
  }
  if (mainBlock) {
    // Ensure piscine import and qualified calls
    if (!mainBlock.includes('"piscine"')) {
      mainBlock = mainBlock.replace(
        /import\s*\(\n?([\s\S]*?)\n?\)/,
        (_, inner) => `import (\n${inner.trim()}\n\t"piscine"\n)`
      );
      if (!mainBlock.includes("import")) {
        mainBlock = mainBlock.replace(
          /package main\n/,
          `package main\n\nimport (\n\t"fmt"\n\t"piscine"\n)\n`
        );
      }
    }
    // Qualify unqualified calls to the parsed function name
    if (result.title) {
      const fnRx = new RegExp(`(?<!piscine\\.)\\b(${result.title})\\(`, "g");
      mainBlock = mainBlock.replace(fnRx, `piscine.$1(`);
    }
    result.testTemplate = mainBlock;
  }

  // ── 6. Extract expected output lines ──────────────────────────────
  let outputLines: string[] = [];
  // Look for output in a fenced block after "And its output:" or "### Output"
  const outputBlockRx = /(?:and its output:|###\s*(?:output|expected output))[^\n]*\n(?:```[^\n]*\n)?([\s\S]*?)(?:```|\n\n|$)/i;
  const outMatch = text.match(outputBlockRx);
  if (outMatch) {
    outputLines = outMatch[1].split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("$") && l !== "```");
  }
  // Fall back: lines between `$ go run .` and next `$`
  if (outputLines.length === 0) {
    const goRunRx = /\$\s*go run\s*\.?\s*\n([\s\S]*?)(?=\$|$)/;
    const goRunMatch = text.match(goRunRx);
    if (goRunMatch) {
      outputLines = goRunMatch[1].split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("$"));
    }
  }

  // ── 8. Build test cases ────────────────────────────────────────────
  if (outputLines.length > 0) {
    result.testCases = outputLines.map((line, i) => ({
      input: `output_${i + 1}`,
      expectedOutput: line,
    }));
  }

  if (!result.title) return "Could not detect a title. Make sure the paste contains a func declaration or a ## FunctionName heading.";
  if (!result.instructions || result.instructions.length === 0) return "Could not parse instructions.";

  return result;
}

// ── PasteImport view ──────────────────────────────────────────────────────
function PasteImportView({
  token,
  onSaved,
  onCancel,
}: {
  token: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [raw, setRaw] = useState("");
  const [parsed, setParsed] = useState<Partial<Challenge> | null>(null);
  const [parseError, setParseError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-parse with 500ms debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!raw.trim()) { setParsed(null); setParseError(""); return; }
    debounceRef.current = setTimeout(() => {
      const result = parseQuestion(raw);
      if (typeof result === "string") {
        setParseError(result);
        setParsed(null);
      } else {
        setParseError("");
        setParsed(result);
      }
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [raw]);


  const handleSave = async () => {
    if (!parsed) return;
    setSaving(true);
    setSaveError("");
    const challenge: Challenge = {
      id: parsed.id ?? "challenge-" + Date.now(),
      level: parsed.level ?? 10,
      title: parsed.title ?? "Untitled",
      category: parsed.category ?? "REQUIRED",
      difficulty: parsed.difficulty ?? 2,
      xp: parsed.xp ?? "100.0 B",
      filesToSubmit: parsed.filesToSubmit ?? "solution.go",
      allowedFunctions: parsed.allowedFunctions ?? "--allow-builtin",
      instructions: parsed.instructions ?? ["Implement the function."],
      expectedSignature: parsed.expectedSignature ?? "func Solution() {\n\n}",
      testTemplate: parsed.testTemplate ?? 'package main\n\nimport (\n\t"fmt"\n\t"piscine"\n)\n\nfunc main() {\n\tfmt.Println("TODO")\n}',
      initialStudentCode: parsed.initialStudentCode ?? `package piscine\n\n${parsed.expectedSignature ?? "func Solution() {\n\t// Write your code here\n}"}`,
      testCases: parsed.testCases ?? [],
    };
    try {
      const res = await fetch("/api/admin/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(challenge),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save");
      }
      onSaved();
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const iaCls = "bg-[#0e0f17] text-sm text-slate-200 placeholder-slate-600 border border-slate-700/60 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 transition-all font-mono resize-none";

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-8 py-5 border-b border-slate-800 flex items-center gap-3 shrink-0">
        <button onClick={onCancel} className="text-slate-500 hover:text-slate-300 cursor-pointer">
          <ChevronRight className="w-4 h-4 rotate-180" />
        </button>
        <ClipboardPaste className="w-5 h-5 text-indigo-400" />
        <h1 className="text-lg font-black text-white">Paste Question</h1>
        <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded font-mono">auto-parses as you type</span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left — raw paste */}
        <div className="flex-1 flex flex-col p-6 gap-3 border-r border-slate-800 overflow-y-auto">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Paste your question here (markdown or plain text)
          </label>
          <textarea
            className={`w-full ${iaCls}`}
            rows={28}
            value={raw}
            onChange={e => setRaw(e.target.value)}
            placeholder={"Paste markdown or plain-text question here.\n\nSupports:\n  ## FunctionName / plain first-line title\n  func FunctionName(...) Type { }\n  package main { ... }\n  $ go run .\n  output_line\n  $"}
          />
          {parseError && (
            <p className="text-xs text-rose-400 bg-rose-500/5 border border-rose-500/20 rounded-lg p-3">
              ⚠ {parseError}
            </p>
          )}
        </div>

        {/* Right — parsed preview + edit */}
        <div className="flex-1 flex flex-col p-6 gap-4 overflow-y-auto">
          {!parsed ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-600 text-sm gap-3">
              <ClipboardPaste className="w-10 h-10 opacity-20" />
              <p>Paste a question on the left — preview appears here automatically.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Preview</h2>
                <div className="flex items-center gap-2">
                  {saveError && <span className="text-xs text-rose-400">{saveError}</span>}
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl cursor-pointer transition-all"
                  >
                    <Save className="w-4 h-4" /> {saving ? "Saving…" : "Save Challenge"}
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {/* Title */}
                <ParsedField label="Title" value={parsed.title ?? ""} onChange={v => setParsed(p => ({ ...p, title: v, id: v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""), filesToSubmit: v.toLowerCase().replace(/[^a-z0-9]/g, "") + ".go" }))} />

                {/* Instructions */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                    Instructions ({parsed.instructions?.length ?? 0})
                  </span>
                  {parsed.instructions?.map((inst, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        className="flex-1 bg-[#0e0f17] text-xs text-slate-200 border border-slate-700/60 rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500 font-mono"
                        value={inst}
                        onChange={e => {
                          const a = [...(parsed.instructions ?? [])];
                          a[i] = e.target.value;
                          setParsed(p => ({ ...p, instructions: a }));
                        }}
                      />
                      <button type="button"
                        onClick={() => setParsed(p => ({ ...p, instructions: (p.instructions ?? []).filter((_, j) => j !== i) }))}
                        className="text-slate-600 hover:text-rose-400 p-1 cursor-pointer">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <button type="button"
                    onClick={() => setParsed(p => ({ ...p, instructions: [...(p.instructions ?? []), ""] }))}
                    className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 mt-0.5 cursor-pointer">
                    <Plus className="w-3 h-3" /> Add instruction
                  </button>
                </div>

                {/* Expected signature */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Expected function signature</span>
                  <textarea
                    className="bg-[#0e0f17] text-xs text-slate-200 border border-slate-700/60 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500 font-mono resize-none"
                    rows={3}
                    value={parsed.expectedSignature ?? ""}
                    onChange={e => setParsed(p => ({ ...p, expectedSignature: e.target.value }))}
                  />
                </div>

                {/* Test cases */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                    Test cases ({parsed.testCases?.length ?? 0} extracted)
                  </span>
                  {(parsed.testCases ?? []).map((tc, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        className="flex-1 bg-[#0e0f17] text-xs text-slate-300 border border-slate-700/60 rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500 font-mono"
                        value={tc.input}
                        placeholder="Input label"
                        onChange={e => {
                          const a = [...(parsed.testCases ?? [])];
                          a[i] = { ...a[i], input: e.target.value };
                          setParsed(p => ({ ...p, testCases: a }));
                        }}
                      />
                      <span className="text-slate-600 font-mono shrink-0 text-xs">→</span>
                      <input
                        className="flex-1 bg-[#0e0f17] text-xs text-emerald-300 border border-slate-700/60 rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500 font-mono"
                        value={tc.expectedOutput}
                        placeholder="Expected output"
                        onChange={e => {
                          const a = [...(parsed.testCases ?? [])];
                          a[i] = { ...a[i], expectedOutput: e.target.value };
                          setParsed(p => ({ ...p, testCases: a }));
                        }}
                      />
                      <button type="button"
                        onClick={() => setParsed(p => ({ ...p, testCases: (p.testCases ?? []).filter((_, j) => j !== i) }))}
                        className="text-slate-600 hover:text-rose-400 p-1 cursor-pointer">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setParsed(p => ({ ...p, testCases: [...(p.testCases ?? []), { input: "", expectedOutput: "" }] }))}
                    className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 mt-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Add test case
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ParsedField({
  label, value, onChange, mono = false,
}: {
  label: string; value: string; onChange: (v: string) => void; mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">{label}</span>
      <input
        className={`bg-[#0e0f17] text-sm text-slate-200 border border-slate-700/60 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500 transition-all w-full ${mono ? "font-mono" : ""}`}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────
function authHeaders(token: string) {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

const inputCls =
  "bg-[#0e0f17] text-sm text-slate-200 placeholder-slate-600 border border-slate-700/60 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500 transition-all font-mono w-full";
const textareaCls = inputCls + " resize-none leading-relaxed";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}

function emptyChallenge(): Challenge {
  return {
    id: "", level: 1, title: "", category: "REQUIRED", difficulty: 2,
    xp: "100.0 B", filesToSubmit: "", allowedFunctions: "--allow-builtin",
    instructions: [""],
    expectedSignature: "func YourFunction() {\n\n}",
    testTemplate: 'package main\n\nimport (\n\t"fmt"\n\t"piscine"\n)\n\nfunc main() {\n\tfmt.Println(piscine.YourFunction())\n}',
    initialStudentCode: "package piscine\n\nfunc YourFunction() {\n\t// Write your code here\n}",
    testCases: [{ input: "", expectedOutput: "" }],
  };
}

// ── Challenge Form ────────────────────────────────────────────────────────
function ChallengeForm({ initial, onSave, onCancel }: {
  initial: Challenge;
  onSave: (c: Challenge) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Challenge>({ ...initial });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const set = (k: keyof Challenge, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.id.trim() || !form.title.trim()) { setErr("ID and Title are required."); return; }
    setSaving(true); setErr("");
    try { await onSave(form); } catch (e: any) { setErr(e.message); } finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSave} className="space-y-5 overflow-y-auto flex-1 p-6">
      {err && <p className="text-xs text-rose-400 bg-rose-500/5 border border-rose-500/20 rounded-lg p-3">{err}</p>}

      <div className="grid grid-cols-2 gap-4">
        <Field label="ID (slug)">
          <input className={inputCls} value={form.id}
            onChange={e => set("id", e.target.value.toLowerCase().replace(/\s+/g, "-"))}
            placeholder="camel-to-snake-case" required />
        </Field>
        <Field label="Title (function name)">
          <input className={inputCls} value={form.title}
            onChange={e => set("title", e.target.value)} placeholder="CamelToSnakeCase" required />
        </Field>
        <Field label="File to submit">
          <input className={inputCls} value={form.filesToSubmit}
            onChange={e => set("filesToSubmit", e.target.value)} placeholder="cameltosnakecase.go" />
        </Field>
        <Field label="XP reward">
          <input className={inputCls} value={form.xp}
            onChange={e => set("xp", e.target.value)} placeholder="100.0 B" />
        </Field>
        <Field label="Level (1–50)">
          <input type="number" min={1} max={50} className={inputCls} value={form.level}
            onChange={e => set("level", Number(e.target.value))} />
        </Field>
        <Field label="Difficulty (1–5)">
          <input type="number" min={1} max={5} className={inputCls} value={form.difficulty}
            onChange={e => set("difficulty", Number(e.target.value))} />
        </Field>
        <Field label="Category">
          <select className={inputCls} value={form.category} onChange={e => set("category", e.target.value)}>
            <option>REQUIRED</option><option>BONUS</option>
          </select>
        </Field>
        <Field label="Allowed functions">
          <input className={inputCls} value={form.allowedFunctions}
            onChange={e => set("allowedFunctions", e.target.value)} placeholder="--allow-builtin" />
        </Field>
      </div>

      <Field label="Instructions">
        <div className="space-y-2">
          {form.instructions.map((inst, i) => (
            <div key={i} className="flex gap-2">
              <input className={inputCls + " flex-1"} value={inst}
                onChange={e => { const a = [...form.instructions]; a[i] = e.target.value; set("instructions", a); }}
                placeholder={`Instruction ${i + 1}`} />
              <button type="button" onClick={() => set("instructions", form.instructions.filter((_, j) => j !== i))}
                className="text-slate-600 hover:text-rose-400 transition-colors shrink-0 p-1">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <button type="button" onClick={() => set("instructions", [...form.instructions, ""])}
            className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
            <Plus className="w-3 h-3" /> Add instruction
          </button>
        </div>
      </Field>

      <Field label="Expected function signature">
        <textarea className={textareaCls} rows={4} value={form.expectedSignature}
          onChange={e => set("expectedSignature", e.target.value)} />
      </Field>

      <Field label="Initial student code (package piscine)">
        <textarea className={textareaCls} rows={6} value={form.initialStudentCode}
          onChange={e => set("initialStudentCode", e.target.value)} />
      </Field>

      <Field label="Test template (package main — uses 'piscine' import)">
        <textarea className={textareaCls} rows={10} value={form.testTemplate}
          onChange={e => set("testTemplate", e.target.value)} />
      </Field>

      <Field label="Test cases  (input → expected output, one line each)">
        <div className="space-y-2">
          {form.testCases.map((tc, i) => (
            <div key={i} className="flex items-center gap-2">
              <input className={inputCls + " flex-1"} value={tc.input}
                onChange={e => { const a = [...form.testCases]; a[i] = { ...a[i], input: e.target.value }; set("testCases", a); }}
                placeholder="Input description" />
              <span className="text-slate-600 font-mono shrink-0">→</span>
              <input className={inputCls + " flex-1"} value={tc.expectedOutput}
                onChange={e => { const a = [...form.testCases]; a[i] = { ...a[i], expectedOutput: e.target.value }; set("testCases", a); }}
                placeholder="Expected stdout line" />
              <button type="button" onClick={() => set("testCases", form.testCases.filter((_, j) => j !== i))}
                className="text-slate-600 hover:text-rose-400 shrink-0 p-1">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <button type="button" onClick={() => set("testCases", [...form.testCases, { input: "", expectedOutput: "" }])}
            className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
            <Plus className="w-3 h-3" /> Add test case
          </button>
        </div>
      </Field>

      <div className="flex gap-3 pt-2 border-t border-slate-800">
        <button type="submit" disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl cursor-pointer transition-all">
          <Save className="w-4 h-4" /> {saving ? "Saving…" : "Save Challenge"}
        </button>
        <button type="button" onClick={onCancel}
          className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-xl cursor-pointer transition-all">
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── Main AdminDashboard ───────────────────────────────────────────────────
interface AdminDashboardProps {
  token: string;
  currentUser: User;
  onLogout: () => void;
  onGoToPlatform: () => void;
}

type AdminView = "overview" | "challenges" | "challenge-new" | "challenge-edit" | "challenge-paste" | "students";

export default function AdminDashboard({ token, currentUser, onLogout, onGoToPlatform }: AdminDashboardProps) {
  const [view, setView] = useState<AdminView>("overview");
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [editingChallenge, setEditingChallenge] = useState<Challenge | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [loadingChallenges, setLoadingChallenges] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);

  const loadChallenges = () => {
    setLoadingChallenges(true);
    fetch("/api/challenges")
      .then(r => r.json())
      .then(d => { setChallenges(d); setLoadingChallenges(false); })
      .catch(() => setLoadingChallenges(false));
  };

  const loadStudents = () => {
    setLoadingStudents(true);
    fetch("/api/admin/users", { headers: authHeaders(token) })
      .then(r => r.json())
      .then(d => { setStudents(d); setLoadingStudents(false); })
      .catch(() => setLoadingStudents(false));
  };

  useEffect(() => { loadChallenges(); loadStudents(); }, []);

  const handleCreate = async (c: Challenge) => {
    const res = await fetch("/api/admin/challenges", {
      method: "POST", headers: authHeaders(token), body: JSON.stringify(c),
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Failed"); }
    await loadChallenges(); setView("challenges");
  };

  const handleUpdate = async (c: Challenge) => {
    const res = await fetch(`/api/admin/challenges/${c.id}`, {
      method: "PUT", headers: authHeaders(token), body: JSON.stringify(c),
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Failed"); }
    await loadChallenges(); setView("challenges");
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/admin/challenges/${id}`, { method: "DELETE", headers: authHeaders(token) });
    setChallenges(prev => prev.filter(c => c.id !== id));
    setDeleteId(null);
  };

  const studentCount = students.filter(s => s.role === "student").length;
  const totalXP = students.reduce((a, s) => a + (s.xp || 0), 0);

  return (
    <div className="min-h-screen bg-[#0c0d12] flex font-sans text-slate-200">

      {/* ── Sidebar ────────────────────────────────────────────────────── */}
      <aside className="w-60 bg-[#0e0f17] border-r border-slate-800 flex flex-col shrink-0">
        {/* Brand */}
        <div className="px-5 py-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center" style={{ boxShadow: "0 0 12px rgba(52,211,153,0.1)" }}>
              <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round"
                className="w-4.5 h-4.5 w-[18px] h-[18px] text-emerald-400"
                style={{ filter: "drop-shadow(0 0 5px rgba(52,211,153,0.7))" }}>
                <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="3" />
              </svg>
            </div>
            <div>
              <div className="text-base font-black text-white tracking-tight" style={{ letterSpacing: "-0.02em" }}>BIM</div>
              <div className="text-[10px] text-slate-500 truncate max-w-[110px]">{currentUser.email}</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          {([
            { id: "overview", label: "Overview", icon: <BarChart2 className="w-4 h-4" /> },
            { id: "challenges", label: "Challenges", icon: <BookOpen className="w-4 h-4" /> },
            { id: "challenge-paste", label: "Paste Import", icon: <ClipboardPaste className="w-4 h-4" /> },
            { id: "students", label: "Students", icon: <Users className="w-4 h-4" /> },
          ] as { id: AdminView; label: string; icon: React.ReactNode }[]).map(item => (
            <button key={item.id}
              onClick={() => setView(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                view === item.id || (item.id === "challenges" && (view === "challenge-new" || view === "challenge-edit"))
                  ? "bg-indigo-600/15 text-indigo-300 border border-indigo-500/20"
                  : item.id === "challenge-paste" && view === "challenge-paste"
                  ? "bg-emerald-600/15 text-emerald-300 border border-emerald-500/20"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
              }`}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </nav>

        {/* Bottom actions */}
        <div className="p-3 border-t border-slate-800 space-y-1">
          <button onClick={onGoToPlatform}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 transition-all cursor-pointer">
            <ChevronRight className="w-4 h-4" /> Go to Platform
          </button>
          <button onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-rose-400/70 hover:bg-rose-500/10 hover:text-rose-400 transition-all cursor-pointer">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main content ───────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">

        {/* Overview */}
        {view === "overview" && (
          <div className="p-8 space-y-8">
            <div>
              <h1 className="text-2xl font-black text-white">Welcome back, {currentUser.username} 👋</h1>
              <p className="text-slate-500 text-sm mt-1">Here's what's happening on your platform.</p>
            </div>

            <div className="grid grid-cols-3 gap-5">
              {[
                { label: "Total Challenges", value: challenges.length, color: "indigo" },
                { label: "Registered Students", value: studentCount, color: "emerald" },
                { label: "Total XP Awarded", value: Math.round(totalXP), color: "amber" },
              ].map(stat => (
                <div key={stat.label} className={`bg-[#13141c] border border-slate-800 rounded-2xl p-6`}>
                  <div className="text-3xl font-black text-white mb-1">{stat.value}</div>
                  <div className="text-sm text-slate-500">{stat.label}</div>
                </div>
              ))}
            </div>

            <div>
              <h2 className="text-lg font-bold text-white mb-4">Quick actions</h2>
              <div className="flex gap-4 flex-wrap">
                <button onClick={() => setView("challenge-new")}
                  className="flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl cursor-pointer transition-all">
                  <Plus className="w-4 h-4" /> Add Challenge
                </button>
                <button onClick={() => setView("challenge-paste")}
                  className="flex items-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl cursor-pointer transition-all">
                  <ClipboardPaste className="w-4 h-4" /> Paste Question
                </button>
                <button onClick={() => setView("challenges")}
                  className="flex items-center gap-2 px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold rounded-xl cursor-pointer transition-all">
                  <BookOpen className="w-4 h-4" /> Manage Challenges
                </button>
                <button onClick={() => setView("students")}
                  className="flex items-center gap-2 px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold rounded-xl cursor-pointer transition-all">
                  <Users className="w-4 h-4" /> View Students
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Challenge list */}
        {view === "challenges" && (
          <div className="p-8 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-black text-white">Challenges</h1>
                <p className="text-slate-500 text-sm mt-1">{challenges.length} total</p>
              </div>
              <div className="flex gap-3">
                <button onClick={loadChallenges}
                  className="p-2.5 text-slate-400 hover:text-slate-200 bg-slate-800 rounded-xl cursor-pointer">
                  <RefreshCw className={`w-4 h-4 ${loadingChallenges ? "animate-spin" : ""}`} />
                </button>
                <button onClick={() => setView("challenge-paste")}
                  className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl cursor-pointer transition-all">
                  <ClipboardPaste className="w-4 h-4" /> Paste
                </button>
                <button onClick={() => setView("challenge-new")}
                  className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl cursor-pointer transition-all">
                  <Plus className="w-4 h-4" /> New
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {challenges.map(c => (
                <div key={c.id} className="bg-[#13141c] border border-slate-800 rounded-xl">
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-4">
                      <span className="text-xs font-mono text-slate-500 bg-slate-800 px-2 py-0.5 rounded">Lvl {c.level}</span>
                      <div>
                        <div className="text-sm font-semibold text-white">{c.title}</div>
                        <div className="text-xs text-slate-500 font-mono">{c.filesToSubmit}  ·  {c.xp}</div>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                        c.category === "BONUS"
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          : "bg-slate-700/40 text-slate-400 border-slate-700"
                      }`}>{c.category}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => { setEditingChallenge(c); setView("challenge-edit"); }}
                        className="p-2 text-slate-500 hover:text-indigo-400 bg-slate-800/60 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setDeleteId(deleteId === c.id ? null : c.id)}
                        className="p-2 text-slate-500 hover:text-rose-400 bg-slate-800/60 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {deleteId === c.id && (
                    <div className="px-4 pb-4 flex items-center gap-3 border-t border-slate-800 pt-3">
                      <span className="text-sm text-rose-400 flex-1">Delete "{c.title}"? This cannot be undone.</span>
                      <button onClick={() => handleDelete(c.id)}
                        className="px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-rose-400 text-xs font-semibold rounded-lg cursor-pointer">
                        Delete
                      </button>
                      <button onClick={() => setDeleteId(null)}
                        className="px-3 py-1.5 bg-slate-800 text-slate-400 text-xs font-semibold rounded-lg cursor-pointer">
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {challenges.length === 0 && !loadingChallenges && (
                <div className="text-center py-16 text-slate-500">
                  <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>No challenges yet.</p>
                  <button onClick={() => setView("challenge-new")}
                    className="mt-3 text-indigo-400 hover:text-indigo-300 text-sm cursor-pointer">
                    Add your first challenge →
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* New challenge */}
        {view === "challenge-new" && (
          <div className="flex flex-col h-full">
            <div className="px-8 py-5 border-b border-slate-800 flex items-center gap-3">
              <button onClick={() => setView("challenges")} className="text-slate-500 hover:text-slate-300 cursor-pointer">
                <ChevronRight className="w-4 h-4 rotate-180" />
              </button>
              <h1 className="text-lg font-black text-white">New Challenge</h1>
            </div>
            <ChallengeForm initial={emptyChallenge()} onSave={handleCreate} onCancel={() => setView("challenges")} />
          </div>
        )}

        {/* Edit challenge */}
        {view === "challenge-edit" && editingChallenge && (
          <div className="flex flex-col h-full">
            <div className="px-8 py-5 border-b border-slate-800 flex items-center gap-3">
              <button onClick={() => setView("challenges")} className="text-slate-500 hover:text-slate-300 cursor-pointer">
                <ChevronRight className="w-4 h-4 rotate-180" />
              </button>
              <h1 className="text-lg font-black text-white">Edit: {editingChallenge.title}</h1>
            </div>
            <ChallengeForm initial={editingChallenge} onSave={handleUpdate} onCancel={() => setView("challenges")} />
          </div>
        )}

        {/* Paste import */}
        {view === "challenge-paste" && (
          <PasteImportView
            token={token}
            onSaved={() => { loadChallenges(); setView("challenges"); }}
            onCancel={() => setView("challenges")}
          />
        )}

        {/* Students */}
        {view === "students" && (
          <div className="p-8 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-black text-white">Students</h1>
                <p className="text-slate-500 text-sm mt-1">{studentCount} registered</p>
              </div>
              <button onClick={loadStudents}
                className="p-2.5 text-slate-400 hover:text-slate-200 bg-slate-800 rounded-xl cursor-pointer">
                <RefreshCw className={`w-4 h-4 ${loadingStudents ? "animate-spin" : ""}`} />
              </button>
            </div>
            <div className="bg-[#13141c] border border-slate-800 rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-left">
                    <th className="px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Username</th>
                    <th className="px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                    <th className="px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</th>
                    <th className="px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">XP</th>
                    <th className="px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Completed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {students.map(s => (
                    <tr key={s.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-5 py-3.5 font-medium text-white">{s.username}</td>
                      <td className="px-5 py-3.5 text-slate-400 font-mono text-xs">{s.email}</td>
                      <td className="px-5 py-3.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                          s.role === "admin"
                            ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                            : "bg-slate-700/40 text-slate-400 border-slate-700"
                        }`}>{s.role}</span>
                      </td>
                      <td className="px-5 py-3.5 text-emerald-400 font-mono font-semibold">{Math.round(s.xp || 0)}</td>
                      <td className="px-5 py-3.5 text-slate-400">{(s.completed || []).length}</td>
                    </tr>
                  ))}
                  {students.length === 0 && !loadingStudents && (
                    <tr>
                      <td colSpan={5} className="px-5 py-10 text-center text-slate-500">No users yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
