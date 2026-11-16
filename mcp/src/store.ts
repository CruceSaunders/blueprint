import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export const ROOT = path.resolve(process.env.BLUEPRINT_HOME || path.join(os.homedir(), "Blueprint"));
const ID_RE = /^[a-z0-9_]+(-[a-z0-9_]+)*$/;

export class StoreError extends Error {}

export function assertId(kind: string, id: string): string {
  if (typeof id !== "string" || !ID_RE.test(id) || id.length > 80)
    throw new StoreError(`${kind} id "${String(id).slice(0, 100)}" is invalid: ids must match ^[a-z0-9_]+(-[a-z0-9_]+)*$ (lowercase letters, digits, underscores, single hyphens between parts).`);
  return id;
}
export function slugify(s: string): string {
  const slug = s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return slug || "item";
}

/** Path shown to the agent: relative to the store, never absolute. */
export function shown(p: string): string {
  const rel = path.relative(ROOT, p);
  return rel && !rel.startsWith("..") && !path.isAbsolute(rel) ? rel : "(outside the store)";
}

/** Replace absolute store/home paths in any message with neutral names. */
export function scrub(msg: string): string {
  let out = msg.split(ROOT).join("<store>");
  const home = os.homedir();
  if (home && home.length > 1) out = out.split(home).join("~");
  return out;
}

let realRootCache: string | null = null;
function realRoot(): string {
  if (realRootCache) return realRootCache;
  fs.mkdirSync(ROOT, { recursive: true });
  realRootCache = fs.realpathSync(ROOT);
  return realRootCache;
}

/**
 * Containment check for a path inside the store: lexical check, then every existing component below the
 * store root must be a real directory/file (no symlinks), and the real path must stay under realpath(ROOT).
 */
export function safe(...parts: string[]): string {
  const p = path.resolve(ROOT, ...parts);
  if (p !== ROOT && !p.startsWith(ROOT + path.sep)) throw new StoreError("Refusing to touch a path outside the Blueprint store.");
  const rr = realRoot();
  const rel = path.relative(ROOT, p);
  let cur = ROOT;
  for (const seg of rel ? rel.split(path.sep) : []) {
    cur = path.join(cur, seg);
    let st: fs.Stats;
    try { st = fs.lstatSync(cur); } catch { break; } // does not exist yet: nothing below it can be a link
    if (st.isSymbolicLink()) throw new StoreError(`Refusing to follow a symbolic link inside the store (${shown(cur)}).`);
  }
  // Belt and braces: the deepest existing ancestor must resolve under the real root.
  let probe = p;
  while (!fs.existsSync(probe) && probe !== ROOT) probe = path.dirname(probe);
  const real = fs.realpathSync(probe);
  if (real !== rr && !real.startsWith(rr + path.sep)) throw new StoreError("Refusing to touch a path outside the Blueprint store.");
  return p;
}
export const projectDir = (pid: string) => safe("projects", assertId("project", pid));
export const projectFile = (pid: string) => safe("projects", assertId("project", pid), "project.json");
export const systemDir = (pid: string, sid: string) => safe("projects", assertId("project", pid), "systems", assertId("system", sid));
export const systemFile = (pid: string, sid: string) => safe("projects", assertId("project", pid), "systems", assertId("system", sid), "system.json");
export const visualFile = (pid: string, sid: string, vid: string) =>
  safe("projects", assertId("project", pid), "systems", assertId("system", sid), "visuals", assertId("visual", vid) + ".json");
export const assetsDir = (pid: string) => safe("projects", assertId("project", pid), "assets");

export const now = () => new Date().toISOString();

const MAX_JSON_BYTES = 32 * 1024 * 1024;

export function readJson<T = any>(file: string, what: string): T {
  let raw: string;
  try {
    safe(path.relative(ROOT, file));
    const st = fs.lstatSync(file);
    if (!st.isFile()) throw new Error("not a regular file");
    if (st.size > MAX_JSON_BYTES) throw new StoreError(`${what} is larger than ${MAX_JSON_BYTES / 1048576} MB; refusing to read it.`);
    raw = fs.readFileSync(file, "utf8");
  } catch (e) {
    if (e instanceof StoreError && /symbolic link|outside|larger/.test(e.message)) throw e;
    throw new StoreError(`${what} not found. Use the list_* tools to see what exists.`);
  }
  try { return JSON.parse(raw); }
  catch { throw new StoreError(`${what} file is not valid JSON (${shown(file)}); it may be mid-write by the app. Retry.`); }
}
export function exists(file: string) {
  try { safe(path.relative(ROOT, file)); return fs.existsSync(file); } catch { return false; }
}

export function writeAtomic(file: string, data: unknown) {
  safe(path.relative(ROOT, file)); // containment + symlink check
  fs.mkdirSync(path.dirname(file), { recursive: true });
  safe(path.relative(ROOT, file)); // re-check after mkdir (a racing writer could have planted a link)
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n", { flag: "wx" });
  fs.renameSync(tmp, file);
}

/** Write raw bytes atomically inside the store (assets). */
export function writeBytesAtomic(file: string, data: Buffer) {
  safe(path.relative(ROOT, file));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  safe(path.relative(ROOT, file));
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, data, { flag: "wx" });
  fs.renameSync(tmp, file);
}

/** Create a new JSON file (rev 1). */
export function createJson(file: string, data: Record<string, any>) {
  const t = now();
  writeAtomic(file, { ...data, rev: 1, createdAt: t, updatedAt: t });
}

/**
 * Read-modify-write with rev bump. Re-reads immediately before writing; if the file changed
 * underneath (rev differs), recomputes from the fresh copy (up to 5 tries).
 */
export async function updateJson<T extends { rev: number; id?: string } = any>(
  file: string, what: string, mutate: (cur: any) => any | Promise<any>,
): Promise<T> {
  for (let i = 0; i < 5; i++) {
    const cur = readJson<any>(file, what);
    const next = await mutate(structuredClone(cur));
    const fresh = readJson<any>(file, what);
    if (fresh.rev !== cur.rev || fresh.updatedAt !== cur.updatedAt) continue;
    next.rev = (cur.rev ?? 0) + 1;
    next.updatedAt = now();
    writeAtomic(file, next);
    return next;
  }
  throw new StoreError(`${what} kept changing while writing (another writer is active). Retry.`);
}

/** Real (non-symlink) directories whose names are valid ids. */
export function listDirs(dir: string): string[] {
  try {
    safe(path.relative(ROOT, dir));
    return fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory() && ID_RE.test(d.name)).map((d) => d.name).sort();
  } catch { return []; }
}
/** Real (non-symlink) `<id>.json` files. */
export function listJsonFiles(dir: string): string[] {
  try {
    safe(path.relative(ROOT, dir));
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isFile() && d.name.endsWith(".json") && ID_RE.test(d.name.slice(0, -5)))
      .map((d) => d.name.slice(0, -5)).sort();
  } catch { return []; }
}
export function uniqueId(base: string, taken: (id: string) => boolean): string {
  let id = base, n = 2;
  while (taken(id)) id = `${base}-${n++}`;
  return id;
}
export function removeTree(p: string) {
  safe(path.relative(ROOT, p));
  if (p === ROOT) throw new StoreError("Refusing to delete the store root.");
  fs.rmSync(p, { recursive: true, force: true });
}
