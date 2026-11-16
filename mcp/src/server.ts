// The Blueprint MCP server. One implementation, two hosts:
//  - `node mcp/dist/index.js` (from source), and
//  - `Blueprint --mcp` (the Electron main process of the installed app; no Node install needed).
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { GUIDE, SKILLS } from "./content.generated.js";
import * as S from "./store.js";
import { applyOps, boxesOf } from "./apply.js";
import { diagnose } from "./layout.js";
import { ASSET_EXTS, checkContent, readSource } from "./assets.js";

export const VERSION = "0.1.0";

/** How to run the app for `snapshot`: a binary plus any leading args (e.g. the app dir for an unpackaged Electron). */
export interface AppLauncher { bin: string; args: string[] }

export interface ServerOptions {
  /** Launcher for headless snapshots. Default: resolved by {@link defaultLauncher}. */
  app?: AppLauncher | null;
}

/** Topic index line used by guide() and the server instructions. */
export function topicIndex(): string {
  return SKILLS.map((s) => `${s.topic}: ${firstSentence(s.description)}`).join("\n");
}
function firstSentence(d: string): string {
  const t = d.replace(/^Load (when|before)\s+/i, "").replace(/\s+/g, " ");
  const cut = t.search(/(?<=[a-z0-9)"'])[.;] /i);
  const s = cut > 0 ? t.slice(0, cut) : t;
  return s.length > 150 ? s.slice(0, 147).trimEnd() + "..." : s;
}

/** Short router sent as the MCP `instructions` field. Kept under 2,000 characters. */
export function instructions(): string {
  const head = "Blueprint is a local Mac app for visual maps of ideas and systems (Project > System > Visual canvas of nodes and edges), stored as plain files on this machine. " +
    "Before drawing, call `guide` once: it returns the vocabulary, rules and a worked example. Build with `apply`, check with `snapshot`, fix warnings, then `open`.";
  const topics = SKILLS.map((s) => s.topic);
  let out = head + (topics.length ? ` For a specific kind of drawing, also call guide({topic}) with one of: ${topics.join(", ")}.` : "");
  for (const s of SKILLS) {
    const line = `\n- ${s.topic}: ${firstSentence(s.description)}`;
    if (out.length + line.length > 1950) break;
    out += line;
  }
  return out;
}

/**
 * Find the app binary for snapshots without a hardcoded install path:
 *  1. BLUEPRINT_APP_BIN, 2. this process when it *is* the app (Electron), 3. the bundle that contains this file,
 *  4. a repo build next to this source tree, 5. the standard Applications folders.
 */
export function defaultLauncher(): AppLauncher | null {
  if (process.env.BLUEPRINT_APP_BIN) return { bin: process.env.BLUEPRINT_APP_BIN, args: [] };
  const here = typeof __filename !== "undefined" ? __filename : (() => { try { return fileURLToPath((import.meta as any).url); } catch { return process.argv[1] ?? ""; } })();
  const m = /^(.*?\.app)\/Contents\//.exec(here);
  if (m) { const b = path.join(m[1], "Contents/MacOS/Blueprint"); if (fs.existsSync(b)) return { bin: b, args: [] }; }
  const candidates: string[] = [];
  if (here) {
    const repo = path.resolve(path.dirname(here), "../..");
    for (const arch of ["mac-arm64", "mac", "mac-universal"]) candidates.push(path.join(repo, "app/release", arch, "Blueprint.app/Contents/MacOS/Blueprint"));
  }
  candidates.push("/Applications/Blueprint.app/Contents/MacOS/Blueprint", path.join(os.homedir(), "Applications/Blueprint.app/Contents/MacOS/Blueprint"));
  const hit = candidates.find((c) => fs.existsSync(c));
  return hit ? { bin: hit, args: [] } : null;
}

export function createServer(opts: ServerOptions = {}): McpServer {
const APP = opts.app === undefined ? defaultLauncher() : opts.app;
const server = new McpServer({ name: "blueprint", version: VERSION }, { instructions: instructions() });

type Content = { type: "text"; text: string } | { type: "image"; data: string; mimeType: string };
const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });
const json = (o: unknown) => text(JSON.stringify(o, null, 2));
const fail = (t: string) => ({ isError: true, content: [{ type: "text" as const, text: t }] });
function tool<A extends z.ZodRawShape>(name: string, description: string, shape: A, fn: (a: z.infer<z.ZodObject<A>>) => Promise<any> | any) {
  (server as any).registerTool(name, { description, inputSchema: shape }, async (args: any) => {
    try { return await fn(args); }
    catch (e: any) { return fail(S.scrub(e instanceof S.StoreError ? e.message : `Unexpected error: ${e?.message ?? e}`)); }
  });
}
const id = z.string().describe("kebab-case slug id");
const vIds = { projectId: id, systemId: id, visualId: id };
const confirmField = z.boolean().optional().describe("must be true to delete");
const needConfirm = (c: unknown, what: string) => {
  if (c !== true) throw new S.StoreError(`Refusing to delete ${what} without confirm:true. Deletion is permanent; ask the user, then retry with confirm:true.`);
};

const readProject = (pid: string) => S.readJson(S.projectFile(pid), `Project '${pid}'`);
const readSystem = (pid: string, sid: string) => S.readJson(S.systemFile(pid, sid), `System '${sid}' in project '${pid}'`);
const readVisual = (pid: string, sid: string, vid: string) => S.readJson(S.visualFile(pid, sid, vid), `Visual '${vid}' in '${pid}/${sid}'`);

// ---- guide
const topicNames = SKILLS.map((s) => s.topic);
tool("guide",
  "Call this first. Returns Blueprint's design philosophy, the full node/edge vocabulary, how to work, a worked apply example, and an index of method topics. " +
  (topicNames.length ? `Call again with {topic} for one method: ${topicNames.join(", ")}.` : ""),
  { topic: z.string().max(80).optional().describe(topicNames.length ? `one of: ${topicNames.join(", ")}` : "method topic") }, (a) => {
    if (a.topic === undefined || a.topic === "") {
      const idx = SKILLS.length ? `\n\n## Topics\nCall guide({topic}) for the method that fits the drawing:\n${SKILLS.map((s) => `- \`${s.topic}\`: ${firstSentence(s.description)}`).join("\n")}\n` : "";
      return text(GUIDE.trimEnd() + idx);
    }
    const want = a.topic.trim().toLowerCase();
    const hit = SKILLS.find((s) => s.topic === want || s.name === want);
    if (!hit) return fail(`Unknown topic '${a.topic.slice(0, 80)}'. Valid topics: ${topicNames.join(", ") || "(none bundled)"}. Call guide() with no topic for the base guide.`);
    return text(`# Topic: ${hit.topic}\n\n${hit.body}`);
  });

// ---- projects
tool("list_projects", "List all projects (id, title, description, system count).", {}, () => {
  const projects = S.listDirs(S.safe("projects")).flatMap((pid) => {
    try { const p = readProject(pid); return [{ id: p.id, title: p.title, description: p.description, systems: p.systemOrder?.length ?? 0, rev: p.rev }]; }
    catch { return []; }
  });
  return json(projects);
});
tool("create_project", "Create a project (an existing project or a new idea). Id is a slug of the title.",
  { title: z.string().min(1), description: z.string().optional(), notes: z.string().optional() }, (a) => {
    const pid = S.uniqueId(S.slugify(a.title), (x) => S.exists(S.projectFile(x)));
    S.createJson(S.projectFile(pid), { id: pid, title: a.title, description: a.description ?? "", notes: a.notes ?? "", systemOrder: [] });
    return json({ projectId: pid, title: a.title });
  });
tool("update_project", "Update a project's title, description, notes or systemOrder.",
  { projectId: id, title: z.string().optional(), description: z.string().optional(), notes: z.string().optional(), systemOrder: z.array(z.string()).optional() },
  async (a) => {
    const p = await S.updateJson(S.projectFile(a.projectId), `Project '${a.projectId}'`, (cur) => {
      for (const k of ["title", "description", "notes"] as const) if (a[k] !== undefined) cur[k] = a[k];
      if (a.systemOrder) {
        const have = new Set(cur.systemOrder), want = new Set(a.systemOrder);
        if (have.size !== want.size || [...have].some((x: any) => !want.has(x))) throw new S.StoreError(`systemOrder must be a permutation of the existing system ids: ${[...have].join(", ")}.`);
        cur.systemOrder = a.systemOrder;
      }
      return cur;
    });
    return json({ projectId: p.id, rev: p.rev });
  });
tool("delete_project", "Permanently delete a project and everything in it. Requires confirm:true.", { projectId: id, confirm: confirmField }, (a) => {
  needConfirm(a.confirm, `project '${a.projectId}'`);
  readProject(a.projectId);
  S.removeTree(S.projectDir(a.projectId));
  return text(`Deleted project '${a.projectId}'.`);
});

// ---- systems
tool("list_systems", "List systems in a project.", { projectId: id }, (a) => {
  const p = readProject(a.projectId);
  const dirs = S.listDirs(path.join(S.projectDir(a.projectId), "systems"));
  const order = [...(p.systemOrder ?? []).filter((x: string) => dirs.includes(x)), ...dirs.filter((d) => !(p.systemOrder ?? []).includes(d))];
  return json(order.flatMap((sid) => {
    try { const s = readSystem(a.projectId, sid); return [{ id: s.id, title: s.title, summary: s.summary, primaryVisual: s.primaryVisual, visuals: s.visualOrder?.length ?? 0 }]; }
    catch { return []; }
  }));
});
tool("create_system", "Create a system (one idea/mechanism) inside a project.",
  { projectId: id, title: z.string().min(1), summary: z.string().optional(), notes: z.string().optional() }, async (a) => {
    readProject(a.projectId);
    const sid = S.uniqueId(S.slugify(a.title), (x) => S.exists(S.systemFile(a.projectId, x)));
    S.createJson(S.systemFile(a.projectId, sid), { id: sid, title: a.title, summary: a.summary ?? "", notes: a.notes ?? "", primaryVisual: null, visualOrder: [] });
    await S.updateJson(S.projectFile(a.projectId), "Project", (p) => { p.systemOrder = [...(p.systemOrder ?? []), sid]; return p; });
    return json({ projectId: a.projectId, systemId: sid });
  });
tool("update_system", "Update a system's title, summary, notes, primaryVisual or visualOrder.",
  { projectId: id, systemId: id, title: z.string().optional(), summary: z.string().optional(), notes: z.string().optional(),
    primaryVisual: z.string().nullable().optional(), visualOrder: z.array(z.string()).optional() }, async (a) => {
    const s = await S.updateJson(S.systemFile(a.projectId, a.systemId), `System '${a.systemId}'`, (cur) => {
      for (const k of ["title", "summary", "notes"] as const) if (a[k] !== undefined) cur[k] = a[k];
      if (a.primaryVisual !== undefined) {
        if (a.primaryVisual !== null && !S.exists(S.visualFile(a.projectId, a.systemId, a.primaryVisual))) throw new S.StoreError(`primaryVisual '${a.primaryVisual}' does not exist in this system.`);
        cur.primaryVisual = a.primaryVisual;
      }
      if (a.visualOrder) {
        const have = new Set(cur.visualOrder), want = new Set(a.visualOrder);
        if (have.size !== want.size || [...have].some((x: any) => !want.has(x))) throw new S.StoreError(`visualOrder must be a permutation of the existing visual ids: ${[...have].join(", ")}.`);
        cur.visualOrder = a.visualOrder;
      }
      return cur;
    });
    return json({ systemId: s.id, rev: s.rev });
  });
tool("delete_system", "Permanently delete a system and its visuals. Requires confirm:true.", { projectId: id, systemId: id, confirm: confirmField }, async (a) => {
  needConfirm(a.confirm, `system '${a.systemId}'`);
  readSystem(a.projectId, a.systemId);
  S.removeTree(S.systemDir(a.projectId, a.systemId));
  await S.updateJson(S.projectFile(a.projectId), "Project", (p) => { p.systemOrder = (p.systemOrder ?? []).filter((x: string) => x !== a.systemId); return p; });
  return text(`Deleted system '${a.systemId}'.`);
});

// ---- visuals
tool("list_visuals", "List visuals in a system.", { projectId: id, systemId: id }, (a) => {
  const s = readSystem(a.projectId, a.systemId);
  const files = S.listJsonFiles(path.join(S.systemDir(a.projectId, a.systemId), "visuals"));
  const order = [...(s.visualOrder ?? []).filter((x: string) => files.includes(x)), ...files.filter((f) => !(s.visualOrder ?? []).includes(f))];
  return json(order.flatMap((vid) => {
    try { const v = readVisual(a.projectId, a.systemId, vid); return [{ id: v.id, title: v.title, description: v.description, nodes: v.nodes.length, edges: v.edges.length, primary: s.primaryVisual === vid, rev: v.rev }]; }
    catch { return []; }
  }));
});
tool("create_visual", "Create an empty visual (canvas) in a system. primary:true makes it the system's primary visual (the first visual is primary automatically).",
  { ...vIds, visualId: z.string().optional(), title: z.string().min(1), description: z.string().optional(), primary: z.boolean().optional() }, async (a) => {
    readSystem(a.projectId, a.systemId);
    const vid = a.visualId ? S.assertId("visual", a.visualId) : S.uniqueId(S.slugify(a.title), (x) => S.exists(S.visualFile(a.projectId, a.systemId, x)));
    if (S.exists(S.visualFile(a.projectId, a.systemId, vid))) throw new S.StoreError(`Visual '${vid}' already exists in this system.`);
    S.createJson(S.visualFile(a.projectId, a.systemId, vid), { id: vid, title: a.title, description: a.description ?? "", viewport: { x: 0, y: 0, zoom: 1 }, nodes: [], edges: [] });
    await S.updateJson(S.systemFile(a.projectId, a.systemId), "System", (s) => {
      s.visualOrder = [...(s.visualOrder ?? []), vid];
      if (a.primary || !s.primaryVisual) s.primaryVisual = vid;
      return s;
    });
    return json({ projectId: a.projectId, systemId: a.systemId, visualId: vid });
  });
tool("update_visual", "Update a visual's title or description (use apply for canvas content).",
  { ...vIds, title: z.string().optional(), description: z.string().optional() }, async (a) => {
    const v = await S.updateJson(S.visualFile(a.projectId, a.systemId, a.visualId), "Visual", (cur) => {
      if (a.title !== undefined) cur.title = a.title;
      if (a.description !== undefined) cur.description = a.description;
      return cur;
    });
    return json({ visualId: v.id ?? a.visualId, rev: v.rev });
  });
tool("get_visual", "Return the full visual JSON (nodes, edges, viewport, rev) plus `boxes`: each node's absolute bounding box [x, y, w, h] in canvas pixels, and `warnings` (overlaps, clipped text, edges crossing cards).", vIds, (a) => {
  const v = readVisual(a.projectId, a.systemId, a.visualId);
  return json({ ...v, boxes: boxesOf(v.nodes ?? []), warnings: diagnose(v.nodes ?? [], v.edges ?? []) });
});
tool("delete_visual", "Permanently delete a visual. Requires confirm:true.", { ...vIds, confirm: confirmField }, async (a) => {
  needConfirm(a.confirm, `visual '${a.visualId}'`);
  readVisual(a.projectId, a.systemId, a.visualId);
  fs.rmSync(S.visualFile(a.projectId, a.systemId, a.visualId));
  await S.updateJson(S.systemFile(a.projectId, a.systemId), "System", (s) => {
    s.visualOrder = (s.visualOrder ?? []).filter((x: string) => x !== a.visualId);
    if (s.primaryVisual === a.visualId) s.primaryVisual = s.visualOrder[0] ?? null;
    return s;
  });
  return text(`Deleted visual '${a.visualId}'.`);
});

// ---- apply
tool("apply",
  "The one write tool for canvas content. Ops: add_node{node}, update_node{id,patch}, remove_node{id}, add_edge{edge}, update_edge{id,patch}, remove_edge{id}, set_viewport{viewport}. " +
  "Whole batch is validated first and rejected atomically with fixable errors. New nodes without position are auto-laid-out; layout is optional per call ({direction, relayout:true} re-places every node). " +
  "Returns rev, summary, `boxes` (each node's absolute [x,y,w,h]) and `warnings` (overlaps, clipped text, edges crossing cards, crowding): fix them. Call guide for shapes and an example.",
  { ...vIds, ops: z.array(z.unknown()).describe("array of operations"),
    layout: z.object({ direction: z.enum(["DOWN", "RIGHT"]).optional(), relayout: z.boolean().optional() }).optional() },
  async (a) => {
    const file = S.visualFile(a.projectId, a.systemId, a.visualId);
    readVisual(a.projectId, a.systemId, a.visualId);
    const assetOk = (n: string) => { try { return S.exists(path.join(S.assetsDir(a.projectId), path.basename(n))); } catch { return false; } };
    let result: any, rejected: any;
    try {
      const v = await S.updateJson(file, "Visual", async (cur) => {
        const r = await applyOps(cur, a.ops as unknown[], a.layout ?? {}, assetOk);
        if (!r.ok) { rejected = r; throw new S.StoreError("__rejected__"); }
        result = r;
        return r.visual;
      });
      return json({ ok: true, rev: v.rev, summary: result.summary, warnings: result.warnings, boxes: result.boxes });
    } catch (e: any) {
      if (rejected) return fail(`apply rejected; nothing was written (rev unchanged). Fix all ${rejected.errors.length} error(s) and resend the whole batch:\n` + rejected.errors.map((x: string) => `- ${x}`).join("\n"));
      throw e;
    }
  });

// ---- assets
tool("add_asset", "Add an image/svg to the project's assets/. Give exactly one of fromPath (absolute path to a regular image file, max 10 MB), svg, or base64 (+ filename). Content must match the extension (PNG, JPEG, GIF, WEBP or SVG; SVG may not contain scripts, styles, event handlers or external references). Returns the file name to use as a node's `asset`.",
  { projectId: id, fromPath: z.string().max(4096).optional(), svg: z.string().max(10 * 1024 * 1024).optional(), base64: z.string().max(14 * 1024 * 1024).optional(), filename: z.string().max(200).optional() }, (a) => {
    readProject(a.projectId);
    const given = [a.fromPath, a.svg, a.base64].filter((x) => x !== undefined).length;
    if (given !== 1) throw new S.StoreError("Provide exactly one of fromPath, svg, or base64.");
    let name = a.filename ?? (a.fromPath ? path.basename(a.fromPath) : a.svg !== undefined ? "drawing.svg" : "");
    if (!name) throw new S.StoreError("`filename` is required with base64 (e.g. diagram.png).");
    name = path.basename(name).replace(/\s+/g, "-").replace(/[^A-Za-z0-9._-]/g, "").slice(0, 120);
    if (!name || name.startsWith(".")) throw new S.StoreError("Invalid filename.");
    const ext = path.extname(name).toLowerCase();
    if (!(ASSET_EXTS as readonly string[]).includes(ext)) throw new S.StoreError("Asset must be .png, .jpg, .jpeg, .gif, .webp or .svg.");
    let data: Buffer;
    if (a.fromPath !== undefined) data = readSource(a.fromPath);
    else if (a.svg !== undefined) data = Buffer.from(a.svg, "utf8");
    else data = Buffer.from(a.base64!, "base64");
    data = checkContent(data, ext);
    const dir = S.assetsDir(a.projectId);
    const base = name.slice(0, -ext.length);
    let final = name, n = 2;
    while (S.exists(path.join(dir, final))) final = `${base}-${n++}${ext}`;
    S.writeBytesAtomic(path.join(dir, final), data);
    return json({ asset: final, bytes: data.length });
  });

// ---- snapshot / open
const pathOf = (a: { projectId: string; systemId: string; visualId: string }) => {
  readVisual(a.projectId, a.systemId, a.visualId);
  return `${a.projectId}/${a.systemId}/${a.visualId}`;
};
tool("snapshot", "Render the visual headlessly with the Blueprint app and return a PNG image so you can look at it and fix problems.",
  { ...vIds, width: z.number().int().positive().optional() }, async (a) => {
    const p = pathOf(a);
    if (!APP || !fs.existsSync(APP.bin)) return fail("Blueprint app not found, so snapshot is unavailable. Install Blueprint.app (or set BLUEPRINT_APP_BIN). The visual itself was saved fine.");
    const out = path.join(os.tmpdir(), `blueprint-snap-${process.pid}-${Date.now()}.png`);
    const args = [...APP.args, "--snapshot", p, "--out", out, ...(a.width ? ["--width", String(Math.min(6000, a.width))] : [])];
    const err = await new Promise<string | null>((resolve) => {
      execFile(APP.bin, args, { timeout: 90_000, maxBuffer: 4 * 1024 * 1024 }, (e, _so, se) => resolve(e ? `${(e as any).killed ? "timed out after 90s" : `exit code ${(e as any).code}`}: ${S.scrub(String(se).trim().slice(0, 600))}` : null));
    });
    if (err) { fs.rmSync(out, { force: true }); return fail(`Snapshot failed (${err}).`); }
    if (!fs.existsSync(out)) return fail("Snapshot command exited 0 but wrote no PNG.");
    const data = fs.readFileSync(out).toString("base64");
    fs.rmSync(out, { force: true });
    const v = readVisual(a.projectId, a.systemId, a.visualId);
    const warns = diagnose(v.nodes ?? [], v.edges ?? []);
    const content: Content[] = [
      { type: "image", data, mimeType: "image/png" },
      { type: "text", text: warns.length ? `warnings (${warns.length}):\n` + warns.map((w) => `- ${w}`).join("\n") : "warnings: none" },
    ];
    return { content };
  });
tool("open", "Open the Blueprint app at this visual (background; does not steal focus).", vIds, async (a) => {
  const p = pathOf(a);
  const err = await new Promise<string | null>((resolve) =>
    execFile("/usr/bin/open", ["-g", `blueprint://open/${p}`], { timeout: 15_000 }, (e, _o, se) => resolve(e ? String(se || e.message).trim() : null)));
  if (err) return fail(`Could not open Blueprint (${S.scrub(err)}). Is Blueprint.app installed?`);
  return text(`Opened blueprint://open/${p} (in the background).`);
});

// ---- search
tool("search", "Search project/system/visual titles, notes and descriptions, and node titles/subtitles/explanations and edge labels/explanations.",
  { query: z.string().min(1).max(200) }, (a) => {
    const toks = a.query.toLowerCase().split(/\s+/).filter(Boolean);
    const hits: any[] = [];
    const test = (s: unknown) => typeof s === "string" && s && toks.every((t) => s.toLowerCase().includes(t));
    const snip = (s: string) => { const i = s.toLowerCase().indexOf(toks[0]); const st = Math.max(0, i - 40); return (st ? "…" : "") + s.slice(st, st + 140).replace(/\s+/g, " "); };
    const hit = (type: string, ids: Record<string, string>, field: string, s: string) => hits.push({ type, ...ids, field, snippet: snip(s) });
    for (const pid of S.listDirs(S.safe("projects"))) {
      let p: any; try { p = readProject(pid); } catch { continue; }
      for (const f of ["title", "description", "notes"]) if (test(p[f])) hit("project", { projectId: pid }, f, p[f]);
      for (const sid of S.listDirs(path.join(S.projectDir(pid), "systems"))) {
        let s: any; try { s = readSystem(pid, sid); } catch { continue; }
        for (const f of ["title", "summary", "notes"]) if (test(s[f])) hit("system", { projectId: pid, systemId: sid }, f, s[f]);
        for (const vid of S.listJsonFiles(path.join(S.systemDir(pid, sid), "visuals"))) {
          let v: any; try { v = readVisual(pid, sid, vid); } catch { continue; }
          const ids = { projectId: pid, systemId: sid, visualId: vid };
          for (const f of ["title", "description"]) if (test(v[f])) hit("visual", ids, f, v[f]);
          for (const n of v.nodes ?? []) for (const f of ["title", "subtitle", "explanation", "caption"]) if (test(n[f])) hit("node", { ...ids, nodeId: n.id }, f, n[f]);
          for (const e of v.edges ?? []) for (const f of ["label", "explanation"]) if (test(e[f])) hit("edge", { ...ids, edgeId: e.id }, f, e[f]);
        }
      }
    }
    return json({ query: a.query, count: hits.length, hits });
  });

return server;
}

/** Serve over stdio until stdin closes. Only protocol bytes go to stdout. */
export async function runStdio(opts: ServerOptions = {}): Promise<void> {
  const server = createServer(opts);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  await new Promise<void>((resolve) => {
    transport.onclose = () => resolve();
    process.stdin.on("end", () => resolve());
    process.stdin.on("close", () => resolve());
  });
}
