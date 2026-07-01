import React, { useState } from "react";
import { Challenge, TestCase } from "../types";
import { Plus, Pencil, Trash2, LogIn, LogOut, Save, X, ChevronDown, ChevronUp } from "lucide-react";

// ── Auth helpers ──────────────────────────────────────────────────────────
function getToken() { return localStorage.getItem("admin_token") ?? ""; }
function setToken(t: string) { localStorage.setItem("admin_token", t); }
function clearToken() { localStorage.removeItem("admin_token"); }

function authHeaders() {
  return { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` };
}

// ── Empty challenge template ──────────────────────────────────────────────
function emptyChallenge(): Omit<Challenge, "id"> & { id: string } {
  return {
    id: "",
    level: 1,
    title: "",
    category: "REQUIRED",
    difficulty: 2,
    xp: "100.0 B",
    filesToSubmit: "",
    allowedFunctions: "--allow-builtin",
    instructions: [""],
    expectedSignature: "func YourFunction() {\n\n}",
    testTemplate:
      'package main\n\nimport (\n\t"fmt"\n\t"piscine"\n)\n\nfunc main() {\n\tfmt.Println(piscine.YourFunction())\n}',
    initialStudentCode:
      "package piscine\n\nfunc YourFunction() {\n\t// Write your code here\n}",
    testCases: [{ input: "", expectedOutput: "" }],
  };
}

// ── Small form field components ───────────────────────────────────────────
function Field({
  label, children,
}: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] text-slate-500 font-mono uppercase font-bold tracking-wider">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "bg-slate-900 text-xs text-slate-200 placeholder-slate-600 border border-slate-800 rounded px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 transition-all font-mono";

const textareaCls =
  inputCls + " resize-none whitespace-pre font-mono leading-relaxed";

// ── Challenge form ────────────────────────────────────────────────────────
function ChallengeForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: Challenge;
  onSave: (c: Challenge) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Challenge>({ ...initial });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const set = (key: keyof Challenge, val: unknown) =>
    setForm((f) => ({ ...f, [key]: val }));

  const setInstruction = (i: number, v: string) => {
    const arr = [...form.instructions];
    arr[i] = v;
    set("instructions", arr);
  };

  const addInstruction = () => set("instructions", [...form.instructions, ""]);
  const removeInstruction = (i: number) =>
    set("instructions", form.instructions.filter((_, j) => j !== i));

  const setTestCase = (i: number, key: keyof TestCase, v: string) => {
    const arr = [...form.testCases];
    arr[i] = { ...arr[i], [key]: v };
    set("testCases", arr);
  };
  const addTestCase = () =>
    set("testCases", [...form.testCases, { input: "", expectedOutput: "" }]);
  const removeTestCase = (i: number) =>
    set("testCases", form.testCases.filter((_, j) => j !== i));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.id.trim() || !form.title.trim()) {
      setErr("ID and Title are required.");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      await onSave(form);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-4 p-4 overflow-y-auto flex-1">
      {err && (
        <p className="text-[11px] text-rose-400 bg-rose-500/5 border border-rose-500/20 rounded p-2">
          {err}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="ID (slug)">
          <input
            className={inputCls}
            value={form.id}
            onChange={(e) => set("id", e.target.value.toLowerCase().replace(/\s+/g, "-"))}
            placeholder="camel-to-snake-case"
            required
          />
        </Field>
        <Field label="Title (function name)">
          <input
            className={inputCls}
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="CamelToSnakeCase"
            required
          />
        </Field>
        <Field label="File to submit">
          <input
            className={inputCls}
            value={form.filesToSubmit}
            onChange={(e) => set("filesToSubmit", e.target.value)}
            placeholder="cameltosnakecase.go"
          />
        </Field>
        <Field label="XP">
          <input
            className={inputCls}
            value={form.xp}
            onChange={(e) => set("xp", e.target.value)}
            placeholder="100.0 B"
          />
        </Field>
        <Field label="Level">
          <input
            type="number" min={1} max={50}
            className={inputCls}
            value={form.level}
            onChange={(e) => set("level", Number(e.target.value))}
          />
        </Field>
        <Field label="Difficulty (1-5)">
          <input
            type="number" min={1} max={5}
            className={inputCls}
            value={form.difficulty}
            onChange={(e) => set("difficulty", Number(e.target.value))}
          />
        </Field>
        <Field label="Category">
          <select
            className={inputCls}
            value={form.category}
            onChange={(e) => set("category", e.target.value)}
          >
            <option>REQUIRED</option>
            <option>BONUS</option>
          </select>
        </Field>
        <Field label="Allowed functions">
          <input
            className={inputCls}
            value={form.allowedFunctions}
            onChange={(e) => set("allowedFunctions", e.target.value)}
            placeholder="--allow-builtin"
          />
        </Field>
      </div>

      {/* Instructions */}
      <Field label="Instructions">
        <div className="space-y-1.5">
          {form.instructions.map((inst, i) => (
            <div key={i} className="flex gap-1.5">
              <input
                className={inputCls + " flex-1"}
                value={inst}
                onChange={(e) => setInstruction(i, e.target.value)}
                placeholder={`Instruction ${i + 1}`}
              />
              <button
                type="button"
                onClick={() => removeInstruction(i)}
                className="p-1.5 text-slate-600 hover:text-rose-400 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addInstruction}
            className="text-[11px] text-indigo-400 hover:text-indigo-300 font-mono flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> Add instruction
          </button>
        </div>
      </Field>

      {/* Expected signature */}
      <Field label="Expected function signature">
        <textarea
          className={textareaCls}
          rows={4}
          value={form.expectedSignature}
          onChange={(e) => set("expectedSignature", e.target.value)}
        />
      </Field>

      {/* Initial student code */}
      <Field label="Initial student code (package piscine)">
        <textarea
          className={textareaCls}
          rows={6}
          value={form.initialStudentCode}
          onChange={(e) => set("initialStudentCode", e.target.value)}
        />
      </Field>

      {/* Test template */}
      <Field label="Test template (package main)">
        <textarea
          className={textareaCls}
          rows={10}
          value={form.testTemplate}
          onChange={(e) => set("testTemplate", e.target.value)}
        />
      </Field>

      {/* Test cases */}
      <Field label="Test cases">
        <div className="space-y-2">
          {form.testCases.map((tc, i) => (
            <div key={i} className="flex gap-1.5 items-center">
              <input
                className={inputCls + " flex-1"}
                value={tc.input}
                onChange={(e) => setTestCase(i, "input", e.target.value)}
                placeholder="Input description"
              />
              <span className="text-slate-600 text-xs font-mono shrink-0">→</span>
              <input
                className={inputCls + " flex-1"}
                value={tc.expectedOutput}
                onChange={(e) => setTestCase(i, "expectedOutput", e.target.value)}
                placeholder="Expected output"
              />
              <button
                type="button"
                onClick={() => removeTestCase(i)}
                className="p-1.5 text-slate-600 hover:text-rose-400 transition-colors shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addTestCase}
            className="text-[11px] text-indigo-400 hover:text-indigo-300 font-mono flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> Add test case
          </button>
        </div>
      </Field>

      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t border-slate-800">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-mono rounded cursor-pointer transition-all"
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? "Saving…" : "Save challenge"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono rounded cursor-pointer transition-all"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── Main AdminPanel component ─────────────────────────────────────────────
interface AdminPanelProps {
  challenges: Challenge[];
  onChallengesChanged: (updated: Challenge[]) => void;
}

export default function AdminPanel({ challenges, onChallengesChanged }: AdminPanelProps) {
  const [token, setTokenState] = useState(getToken());
  const [loginUser, setLoginUser] = useState("admin");
  const [loginPass, setLoginPass] = useState("");
  const [loginErr, setLoginErr] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [view, setView] = useState<"list" | "create" | "edit">("list");
  const [editingChallenge, setEditingChallenge] = useState<Challenge | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const isAuthed = !!token;

  // ── Login ───────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginErr("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: loginUser, password: loginPass }),
      });
      if (!res.ok) throw new Error("Invalid credentials");
      const data = await res.json();
      setToken(data.token);
      setTokenState(data.token);
      setLoginPass("");
    } catch (e: any) {
      setLoginErr(e.message);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    clearToken();
    setTokenState("");
    setView("list");
  };

  // ── CRUD operations ─────────────────────────────────────────────────
  const handleCreate = async (c: Challenge) => {
    const res = await fetch("/api/admin/challenges", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(c),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to create");
    }
    const created: Challenge = await res.json();
    onChallengesChanged([...challenges, created]);
    setView("list");
  };

  const handleUpdate = async (c: Challenge) => {
    const res = await fetch(`/api/admin/challenges/${c.id}`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify(c),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to update");
    }
    const updated: Challenge = await res.json();
    onChallengesChanged(challenges.map((x) => (x.id === updated.id ? updated : x)));
    setView("list");
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/admin/challenges/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (!res.ok && res.status !== 204) {
      alert("Failed to delete challenge");
      return;
    }
    onChallengesChanged(challenges.filter((c) => c.id !== id));
    setDeleteId(null);
  };

  // ── Not logged in ───────────────────────────────────────────────────
  if (!isAuthed) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-4">
        <div className="w-10 h-10 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
          <LogIn className="w-5 h-5" />
        </div>
        <p className="text-xs text-slate-400 font-mono text-center">
          Admin login required
        </p>
        <form onSubmit={handleLogin} className="w-full space-y-3">
          <input
            className={inputCls + " w-full"}
            value={loginUser}
            onChange={(e) => setLoginUser(e.target.value)}
            placeholder="Username"
            autoComplete="username"
          />
          <input
            type="password"
            className={inputCls + " w-full"}
            value={loginPass}
            onChange={(e) => setLoginPass(e.target.value)}
            placeholder="Password"
            autoComplete="current-password"
          />
          {loginErr && (
            <p className="text-[11px] text-rose-400">{loginErr}</p>
          )}
          <button
            type="submit"
            disabled={loginLoading}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-mono rounded cursor-pointer"
          >
            {loginLoading ? "Logging in…" : "Login"}
          </button>
        </form>
        <p className="text-[10px] text-slate-600 font-mono text-center">
          Default: admin / admin123
          <br />Set ADMIN_PASSWORD_HASH env var for production.
        </p>
      </div>
    );
  }

  // ── Create form ─────────────────────────────────────────────────────
  if (view === "create") {
    return (
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-800 shrink-0 flex items-center justify-between">
          <span className="text-xs font-mono text-slate-300 font-bold">New Challenge</span>
          <button onClick={() => setView("list")} className="text-slate-500 hover:text-slate-300">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <ChallengeForm
          initial={emptyChallenge() as Challenge}
          onSave={handleCreate}
          onCancel={() => setView("list")}
        />
      </div>
    );
  }

  // ── Edit form ───────────────────────────────────────────────────────
  if (view === "edit" && editingChallenge) {
    return (
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-800 shrink-0 flex items-center justify-between">
          <span className="text-xs font-mono text-slate-300 font-bold">
            Editing: {editingChallenge.title}
          </span>
          <button onClick={() => setView("list")} className="text-slate-500 hover:text-slate-300">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <ChallengeForm
          initial={editingChallenge}
          onSave={handleUpdate}
          onCancel={() => setView("list")}
        />
      </div>
    );
  }

  // ── Challenge list ──────────────────────────────────────────────────
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Toolbar */}
      <div className="px-4 py-2.5 border-b border-slate-800 shrink-0 flex items-center justify-between">
        <span className="text-[10px] font-mono text-slate-500">
          {challenges.length} challenge{challenges.length !== 1 ? "s" : ""}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView("create")}
            className="flex items-center gap-1 px-2.5 py-1 bg-indigo-600/20 hover:bg-indigo-600/35 border border-indigo-500/25 text-indigo-300 text-[11px] font-mono rounded cursor-pointer transition-all"
          >
            <Plus className="w-3 h-3" /> New
          </button>
          <button
            onClick={handleLogout}
            className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
            title="Logout"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {challenges.length === 0 && (
          <p className="text-[11px] text-slate-500 font-mono text-center py-8">
            No challenges yet. Click "New" to add one.
          </p>
        )}
        {challenges.map((c) => (
          <div key={c.id} className="bg-slate-900/60 border border-slate-800 rounded-lg">
            <div className="flex items-center justify-between p-3">
              <div className="flex items-center gap-2 overflow-hidden">
                <span className="text-[10px] text-slate-500 font-mono shrink-0">
                  Lvl {c.level}
                </span>
                <span className="text-xs text-slate-200 font-medium truncate">
                  {c.title}
                </span>
                <span className={`text-[9px] font-bold px-1.5 rounded shrink-0 ${
                  c.category === "BONUS"
                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    : "bg-slate-700/50 text-slate-400"
                }`}>
                  {c.category}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => { setEditingChallenge(c); setView("edit"); }}
                  className="p-1.5 text-slate-500 hover:text-indigo-400 transition-colors cursor-pointer"
                  title="Edit"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setDeleteId(deleteId === c.id ? null : c.id)}
                  className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            {/* Delete confirm inline */}
            {deleteId === c.id && (
              <div className="px-3 pb-3 flex items-center gap-2">
                <span className="text-[11px] text-rose-400 font-mono flex-1">
                  Delete "{c.title}"?
                </span>
                <button
                  onClick={() => handleDelete(c.id)}
                  className="px-2.5 py-1 bg-rose-600/20 hover:bg-rose-600/35 border border-rose-500/25 text-rose-400 text-[11px] font-mono rounded cursor-pointer"
                >
                  Yes, delete
                </button>
                <button
                  onClick={() => setDeleteId(null)}
                  className="px-2.5 py-1 bg-slate-800 text-slate-400 text-[11px] font-mono rounded cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
