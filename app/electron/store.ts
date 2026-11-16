// File store for ~/Blueprint per SPEC.md. Atomic writes (tmp + rename), rev bump, re-read before write.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { shell } from "electron";
import type {
  Project, System, Visual, TreeProject, TreeSystem, VisualIds, SearchHit, SaveResult,
} from "../src/lib/types";

export const ROOT = path.resolve(process.env.BLUEPRINT_HOME || path.join(os.homedir(), "Blueprint"));
// Interaction tests run against a throwaway BLUEPRINT_HOME and delete for real instead of filling the user's Trash.
const trashItem = (p: string) => (process.env.BLUEPRINT_TEST === "1" && process.env.BLUEPRINT_HOME ? Promise.resolve(fs.rmSync(p, { recursive: true, force: true })) : shell.trashItem(p));
export const PROJECTS = path.join(ROOT, "projects");

export function ensureRoot() {
  fs.mkdirSync(PROJECTS, { recursive: true });
}

const SLUG_RE = /^[a-z0-9_]+(?:-[a-z0-9_]+)*$/;
function assertId(id: string | undefined, what: string): string {
  if (!id || !SLUG_RE.test(id)) throw new Error(`Invalid ${what} id: ${JSON.stringify(id)}`);
  return id;
}

export function slugify(title: string): string {
  const s = title.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
  return s || "untitled";
}

function uniqueId(base: string, taken: (id: string) => boolean): string {
  if (!taken(base)) return base;
  for (let i = 2; ; i++) if (!taken(`${base}-${i}`)) return `${base}-${i}`;
}

/**
 * Containment for any path the app touches: lexically under ROOT, no symbolic link in any existing component
 * below ROOT, and the deepest existing ancestor's real path under realpath(ROOT). Throws otherwise.
 */
export function guard(p: string): string {
  const full = path.resolve(p);
  if (full !== ROOT && !full.startsWith(ROOT + path.sep)) throw new Error("Path is outside the Blueprint store.");
  const rel = path.relative(ROOT, full);
  let cur = ROOT;
  for (const seg of rel ? rel.split(path.sep) : []) {
    cur = path.join(cur, seg);
    let st: fs.Stats;
    try { st = fs.lstatSync(cur); } catch { break; }
    if (st.isSymbolicLink()) throw new Error("Refusing to follow a symbolic link inside the Blueprint store.");
  }
  let probe = full;
  while (!fs.existsSync(probe) && probe !== ROOT) probe = path.dirname(probe);
  const realRoot = fs.realpathSync(ROOT);
  const real = fs.realpathSync(probe);
  if (real !== realRoot && !real.startsWith(realRoot + path.sep)) throw new Error("Path is outside the Blueprint store.");
  return full;
}

const projectDir = (p: string) => guard(path.join(PROJECTS, assertId(p, "project")));
const systemDir = (p: string, s: string) => guard(path.join(projectDir(p), "systems", assertId(s, "system")));
const visualFile = (p: string, s: string, v: string) => guard(path.join(systemDir(p, s), "visuals", `${assertId(v, "visual")}.json`));
export const assetsDir = (p: string) => guard(path.join(projectDir(p), "assets"));

const MAX_JSON_BYTES = 32 * 1024 * 1024;
function readJson<T>(file: string): T | null {
  try {
    guard(file);
    const st = fs.lstatSync(file);
    if (!st.isFile() || st.size > MAX_JSON_BYTES) return null;
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

function writeAtomic(file: string, data: unknown) {
  guard(file);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  guard(file);
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n");
  fs.renameSync(tmp, file);
}

const now = () => new Date().toISOString();

/** Re-read, apply mutation, bump rev, write atomically. */
function mutate<T extends { rev: number; updatedAt: string }>(file: string, fn: (cur: T) => T | void): T {
  const cur = readJson<T>(file);
  if (!cur) throw new Error(`Not found: ${path.relative(ROOT, file)}`);
  const next = (fn(cur) as T) ?? cur;
  next.rev = (cur.rev ?? 0) + 1;
  next.updatedAt = now();
  writeAtomic(file, next);
  return next;
}

function listDirs(dir: string): string[] {
  try {
    guard(dir);
    return fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory() && SLUG_RE.test(d.name)).map((d) => d.name);
  } catch {
    return [];
  }
}

function ordered(ids: string[], order: string[] | undefined): string[] {
  const o = (order ?? []).filter((id) => ids.includes(id));
  const rest = ids.filter((id) => !o.includes(id)).sort();
  return [...o, ...rest];
}

export function tree(): TreeProject[] {
  ensureRoot();
  const out: TreeProject[] = [];
  for (const pid of listDirs(PROJECTS)) {
    const p = readJson<Project>(path.join(PROJECTS, pid, "project.json"));
    if (!p) continue;
    const sids = ordered(listDirs(path.join(PROJECTS, pid, "systems")), p.systemOrder);
    const systems: TreeSystem[] = [];
    for (const sid of sids) {
      const s = readJson<System>(path.join(PROJECTS, pid, "systems", sid, "system.json"));
      if (!s) continue;
      const vdir = path.join(PROJECTS, pid, "systems", sid, "visuals");
      let vids: string[] = [];
      try {
        guard(vdir);
        vids = fs.readdirSync(vdir, { withFileTypes: true }).filter((d) => d.isFile() && d.name.endsWith(".json") && SLUG_RE.test(d.name.slice(0, -5))).map((d) => d.name.slice(0, -5));
      } catch { /* none */ }
      const visuals = ordered(vids, s.visualOrder).map((vid) => {
        const v = readJson<Visual>(path.join(vdir, `${vid}.json`));
        return { id: vid, title: v?.title ?? vid, rev: v?.rev ?? 0 };
      });
      systems.push({ id: sid, title: s.title ?? sid, summary: s.summary, primaryVisual: s.primaryVisual ?? null, visuals });
    }
    out.push({ id: pid, title: p.title ?? pid, description: p.description, systems });
  }
  return out.sort((a, b) => a.title.localeCompare(b.title));
}

export function readVisual(ids: VisualIds): Visual | null {
  return readJson<Visual>(visualFile(ids.projectId, ids.systemId, ids.visualId));
}

export function saveVisual(ids: VisualIds, doc: Visual, baseRev: number): SaveResult {
  const file = visualFile(ids.projectId, ids.systemId, ids.visualId);
  const cur = readJson<Visual>(file); // re-read immediately before write
  if (!cur) return { ok: false, error: "Visual no longer exists on disk." };
  if ((cur.rev ?? 0) > baseRev) return { ok: false, conflict: true, current: cur };
  const next: Visual = { ...doc, id: cur.id, createdAt: cur.createdAt, rev: (cur.rev ?? 0) + 1, updatedAt: now() };
  writeAtomic(file, next);
  return { ok: true, rev: next.rev };
}

export function readSystem(p: string, s: string): System | null {
  return readJson<System>(path.join(systemDir(p, s), "system.json"));
}

export function updateSystem(p: string, s: string, patch: Partial<System>): System {
  const { title, summary, notes, primaryVisual } = patch;
  return mutate<System>(path.join(systemDir(p, s), "system.json"), (cur) => {
    if (title !== undefined) cur.title = title;
    if (summary !== undefined) cur.summary = summary;
    if (notes !== undefined) cur.notes = notes;
    if (primaryVisual !== undefined) cur.primaryVisual = primaryVisual;
  });
}

export function updateProject(p: string, patch: Partial<Project>): Project {
  const { title, description, notes } = patch;
  return mutate<Project>(path.join(projectDir(p), "project.json"), (cur) => {
    if (title !== undefined) cur.title = title;
    if (description !== undefined) cur.description = description;
    if (notes !== undefined) cur.notes = notes;
  });
}

export function createProject(title: string): string {
  ensureRoot();
  const id = uniqueId(slugify(title), (x) => fs.existsSync(path.join(PROJECTS, x)));
  const t = now();
  const p: Project = { id, title, description: "", notes: "", systemOrder: [], rev: 1, createdAt: t, updatedAt: t };
  writeAtomic(path.join(PROJECTS, id, "project.json"), p);
  return id;
}

export function createSystem(p: string, title: string): string {
  const sysRoot = path.join(projectDir(p), "systems");
  const id = uniqueId(slugify(title), (x) => fs.existsSync(path.join(sysRoot, x)));
  const t = now();
  const s: System = { id, title, summary: "", notes: "", primaryVisual: null, visualOrder: [], rev: 1, createdAt: t, updatedAt: t };
  writeAtomic(path.join(sysRoot, id, "system.json"), s);
  mutate<Project>(path.join(projectDir(p), "project.json"), (cur) => {
    cur.systemOrder = [...(cur.systemOrder ?? []).filter((x) => x !== id), id];
  });
  return id;
}

export function createVisual(p: string, s: string, title: string): string {
  const vdir = path.join(systemDir(p, s), "visuals");
  const id = uniqueId(slugify(title), (x) => fs.existsSync(path.join(vdir, `${x}.json`)));
  const t = now();
  const v: Visual = { id, title, description: "", rev: 1, createdAt: t, updatedAt: t, viewport: { x: 0, y: 0, zoom: 1 }, nodes: [], edges: [] };
  writeAtomic(path.join(vdir, `${id}.json`), v);
  mutate<System>(path.join(systemDir(p, s), "system.json"), (cur) => {
    cur.visualOrder = [...(cur.visualOrder ?? []).filter((x) => x !== id), id];
    if (!cur.primaryVisual) cur.primaryVisual = id;
  });
  return id;
}

export function renameVisual(ids: VisualIds, title: string) {
  mutate<Visual>(visualFile(ids.projectId, ids.systemId, ids.visualId), (cur) => {
    cur.title = title;
  });
}

/** Deletes go to the macOS Trash (recoverable), never a hard delete. */
export async function remove(kind: "project" | "system" | "visual", ids: Partial<VisualIds>) {
  const p = ids.projectId!;
  if (kind === "project") {
    await trashItem(projectDir(p));
  } else if (kind === "system") {
    await trashItem(systemDir(p, ids.systemId!));
    mutate<Project>(path.join(projectDir(p), "project.json"), (cur) => {
      cur.systemOrder = (cur.systemOrder ?? []).filter((x) => x !== ids.systemId);
    });
  } else {
    await trashItem(visualFile(p, ids.systemId!, ids.visualId!));
    mutate<System>(path.join(systemDir(p, ids.systemId!), "system.json"), (cur) => {
      cur.visualOrder = (cur.visualOrder ?? []).filter((x) => x !== ids.visualId);
      if (cur.primaryVisual === ids.visualId) cur.primaryVisual = cur.visualOrder[0] ?? null;
    });
  }
}

export function reorder(kind: "system" | "visual", ids: Partial<VisualIds>, dir: -1 | 1) {
  const t = tree().find((x) => x.id === ids.projectId);
  if (!t) return;
  const move = (list: string[], id: string) => {
    const i = list.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return list;
    const c = [...list];
    [c[i], c[j]] = [c[j], c[i]];
    return c;
  };
  if (kind === "system") {
    const current = t.systems.map((s) => s.id);
    mutate<Project>(path.join(projectDir(ids.projectId!), "project.json"), (cur) => {
      cur.systemOrder = move(current, ids.systemId!);
    });
  } else {
    const sys = t.systems.find((s) => s.id === ids.systemId);
    if (!sys) return;
    const current = sys.visuals.map((v) => v.id);
    mutate<System>(path.join(systemDir(ids.projectId!, ids.systemId!), "system.json"), (cur) => {
      cur.visualOrder = move(current, ids.visualId!);
    });
  }
}

export function search(query: string): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hits: SearchHit[] = [];
  const match = (...xs: (string | undefined)[]) => xs.some((x) => x?.toLowerCase().includes(q));
  const snippet = (s: string | undefined) => {
    if (!s) return "";
    const i = s.toLowerCase().indexOf(q);
    if (i < 0) return s.slice(0, 80);
    return (i > 30 ? "…" : "") + s.slice(Math.max(0, i - 30), i + 60).replace(/\s+/g, " ");
  };
  for (const pid of listDirs(PROJECTS)) {
    const p = readJson<Project>(path.join(PROJECTS, pid, "project.json"));
    if (!p) continue;
    if (match(p.title, p.description, p.notes)) hits.push({ type: "project", projectId: pid, title: p.title, context: snippet(match(p.title) ? p.description : p.notes ?? p.description) });
    for (const sid of listDirs(path.join(PROJECTS, pid, "systems"))) {
      const s = readJson<System>(path.join(PROJECTS, pid, "systems", sid, "system.json"));
      if (!s) continue;
      const firstVisual = s.primaryVisual ?? s.visualOrder?.[0];
      if (match(s.title, s.summary, s.notes)) hits.push({ type: "system", projectId: pid, systemId: sid, visualId: firstVisual ?? undefined, title: s.title, context: `${p.title} · ${snippet(s.summary || s.notes)}` });
      const vdir = path.join(PROJECTS, pid, "systems", sid, "visuals");
      let files: string[] = [];
      try { guard(vdir); files = fs.readdirSync(vdir, { withFileTypes: true }).filter((d) => d.isFile() && d.name.endsWith(".json") && SLUG_RE.test(d.name.slice(0, -5))).map((d) => d.name); } catch { /* none */ }
      for (const f of files) {
        const v = readJson<Visual>(path.join(vdir, f));
        if (!v) continue;
        const vid = f.slice(0, -5);
        if (match(v.title, v.description)) hits.push({ type: "visual", projectId: pid, systemId: sid, visualId: vid, title: v.title, context: `${p.title} › ${s.title}` });
        for (const n of v.nodes ?? []) {
          if (match(n.title, n.subtitle, n.explanation, n.caption)) {
            hits.push({ type: "node", projectId: pid, systemId: sid, visualId: vid, nodeId: n.id, title: n.title || n.caption || n.id, context: `${s.title} › ${v.title}` });
          }
        }
      }
    }
  }
  return hits.slice(0, 60);
}

export function resolveAsset(projectId: string, file: string): string | null {
  const dir = assetsDir(projectId);
  const full = path.resolve(dir, file);
  if (!full.startsWith(dir + path.sep) || path.dirname(full) !== dir) return null;
  try {
    guard(full);
    const st = fs.lstatSync(full);
    return st.isFile() ? full : null;
  } catch {
    return null;
  }
}
