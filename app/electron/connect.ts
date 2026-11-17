// `Blueprint --connect` / `--disconnect`: register the bundled MCP server and install the bundled skills into the
// user's AI tools. Explicit and consented only (CLI flag, first-run screen, or menu item); never a build side effect.
// Every config file is backed up next to itself before it changes; other servers and settings are left alone.
import fs from "node:fs";
import path from "node:path";
import { GUIDE, SKILLS, VISUALIZE_HEAD } from "../../mcp/src/content.generated";

export type ToolId = "claude" | "cursor" | "codex";
export const TOOL_IDS: ToolId[] = ["claude", "cursor", "codex"];
const NAMES: Record<ToolId, string> = { claude: "Claude Code", cursor: "Cursor", codex: "Codex" };
const SERVER = "blueprint";
const MARKER = ".blueprint-managed";

export interface Launch { command: string; args: string[] }
export interface ToolInfo { id: ToolId; name: string; detected: boolean; evidence: string; config: string; skillsDir: string }
export interface Report { ok: boolean; lines: string[] }

const tilde = (home: string, p: string) => (p === home || p.startsWith(home + path.sep) ? "~" + p.slice(home.length) : p);
const stamp = (d = new Date()) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");

/**
 * Where each tool reads its MCP config and user-level skills.
 * Claude Code: ~/.claude.json (user-scope mcpServers) and ~/.claude/skills/<name>/SKILL.md.
 * Cursor: ~/.cursor/mcp.json; Cursor and Codex both read user skills from ~/.agents/skills/<name>/SKILL.md.
 * Codex: ~/.codex/config.toml [mcp_servers.<name>].
 */
export function tools(home: string): ToolInfo[] {
  const has = (p: string) => fs.existsSync(path.join(home, p));
  const claudeEv = has(".claude.json") ? "~/.claude.json" : has(".claude") ? "~/.claude/" : "";
  return [
    { id: "claude", name: NAMES.claude, detected: !!claudeEv, evidence: claudeEv, config: path.join(home, ".claude.json"), skillsDir: path.join(home, ".claude/skills") },
    { id: "cursor", name: NAMES.cursor, detected: has(".cursor"), evidence: has(".cursor") ? "~/.cursor/" : "", config: path.join(home, ".cursor/mcp.json"), skillsDir: path.join(home, ".agents/skills") },
    { id: "codex", name: NAMES.codex, detected: has(".codex"), evidence: has(".codex") ? "~/.codex/" : "", config: path.join(home, ".codex/config.toml"), skillsDir: path.join(home, ".agents/skills") },
  ];
}

/** The skill folders to install: `visualize` (base guide + topic index) and one per bundled skill. */
export function skillFiles(): { name: string; content: string }[] {
  const index = SKILLS.length
    ? `\n\n## Topics\nFor a specific kind of drawing, call the \`guide\` tool with {topic} (or read the matching installed skill):\n${SKILLS.map((s) => `- \`${s.topic}\` (skill \`${s.name}\`): ${s.description}`).join("\n")}\n`
    : "";
  return [
    { name: "visualize", content: VISUALIZE_HEAD.trimEnd() + "\n\n---\n\n" + GUIDE.trimEnd() + index + "\n" },
    ...SKILLS.map((s) => ({ name: s.name, content: s.raw.endsWith("\n") ? s.raw : s.raw + "\n" })),
  ];
}

// ---------- file helpers ----------
function readText(file: string): string | null {
  try {
    const st = fs.lstatSync(file);
    if (st.isSymbolicLink()) { const real = fs.realpathSync(file); if (!fs.statSync(real).isFile()) return null; }
    else if (!st.isFile()) return null;
    return fs.readFileSync(file, "utf8");
  } catch { return null; }
}
/** Write through a symlink to its target (dotfile managers link these files), atomically, after backing up. */
function writeWithBackup(file: string, next: string, prev: string | null, ts: string): string | null {
  let target = file;
  try { if (fs.lstatSync(file).isSymbolicLink()) target = fs.realpathSync(file); } catch { /* new file */ }
  let backup: string | null = null;
  if (prev !== null) {
    backup = `${target}.blueprint-backup-${ts}`;
    fs.copyFileSync(target, backup);
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  let mode: number | undefined;
  try { mode = fs.statSync(target).mode & 0o777; } catch { /* new */ }
  const tmp = `${target}.blueprint-tmp-${process.pid}`;
  fs.writeFileSync(tmp, next, { mode: mode ?? 0o600 });
  fs.renameSync(tmp, target);
  return backup;
}
function indentOf(text: string): string | number {
  const m = /\n([ \t]+)"/.exec(text);
  return m ? m[1] : 2;
}
const deepEq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// ---------- JSON configs (Claude Code, Cursor) ----------
function jsonEntry(tool: ToolId, launch: Launch) {
  return tool === "claude" ? { type: "stdio", command: launch.command, args: launch.args, env: {} } : { command: launch.command, args: launch.args };
}
function planJson(file: string, tool: ToolId, launch: Launch | null): { next: string | null; prev: string | null; note: string } {
  const prev = readText(file);
  let obj: any = {};
  if (prev !== null && prev.trim()) {
    try { obj = JSON.parse(prev); } catch { throw new Error(`${path.basename(file)} is not valid JSON; not touching it. Fix it or add the server by hand.`); }
    if (typeof obj !== "object" || obj === null || Array.isArray(obj)) throw new Error(`${path.basename(file)} is not a JSON object; not touching it.`);
  }
  const servers = obj.mcpServers && typeof obj.mcpServers === "object" ? obj.mcpServers : undefined;
  if (launch) {
    const want = jsonEntry(tool, launch);
    if (servers && deepEq(servers[SERVER], want)) return { next: null, prev, note: "already registered" };
    const had = !!servers?.[SERVER];
    obj.mcpServers = { ...(servers ?? {}), [SERVER]: want };
    const nl = prev === null || prev.endsWith("\n") ? "\n" : "";
    return { next: JSON.stringify(obj, null, prev ? indentOf(prev) : 2) + nl, prev, note: had ? "update the `blueprint` server entry" : "add the `blueprint` server entry" };
  }
  if (!servers || !(SERVER in servers)) return { next: null, prev, note: "not registered" };
  delete servers[SERVER];
  if (!Object.keys(servers).length) delete obj.mcpServers; // connect created it; leave no empty shell
  const nl = prev!.endsWith("\n") ? "\n" : "";
  return { next: JSON.stringify(obj, null, indentOf(prev!)) + nl, prev, note: "remove the `blueprint` server entry" };
}

// ---------- TOML (Codex) ----------
const tomlStr = (s: string) => JSON.stringify(s); // a JSON string is a valid TOML basic string for these values
function codexBlock(launch: Launch): string {
  return `[mcp_servers.${SERVER}]\ncommand = ${tomlStr(launch.command)}\nargs = [${launch.args.map(tomlStr).join(", ")}]\n`;
}
/** Locate the [mcp_servers.blueprint] table and its sub-tables: [start, end) line indexes, or null. */
function findBlock(lines: string[]): [number, number] | null {
  const head = /^\s*\[\s*mcp_servers\s*\.\s*("blueprint"|blueprint)\s*\]\s*(#.*)?$/;
  const sub = /^\s*\[\s*mcp_servers\s*\.\s*("blueprint"|blueprint)\s*\./;
  const start = lines.findIndex((l) => head.test(l));
  if (start < 0) return null;
  let end = start + 1;
  while (end < lines.length && !(/^\s*\[/.test(lines[end]) && !sub.test(lines[end]))) end++;
  while (end > start + 1 && lines[end - 1].trim() === "") end--; // leave trailing blank lines to the next table
  return [start, end];
}
function planToml(file: string, launch: Launch | null): { next: string | null; prev: string | null; note: string } {
  const prev = readText(file);
  const text = prev ?? "";
  const lines = text.split("\n");
  const blk = findBlock(lines);
  if (launch) {
    const want = codexBlock(launch);
    if (blk) {
      const cur = lines.slice(blk[0], blk[1]).join("\n") + "\n";
      if (cur === want) return { next: null, prev, note: "already registered" };
      const out = [...lines.slice(0, blk[0]), ...want.trimEnd().split("\n"), ...lines.slice(blk[1])].join("\n");
      return { next: out, prev, note: "update [mcp_servers.blueprint]" };
    }
    const base = text === "" ? "" : text.endsWith("\n") ? text : text + "\n";
    return { next: base + (base ? "\n" : "") + want, prev, note: "add [mcp_servers.blueprint]" };
  }
  if (!blk) return { next: null, prev, note: "not registered" };
  let [s, e] = blk;
  if (s > 0 && lines[s - 1].trim() === "") s--; // the blank line connect added before the table
  if (e < lines.length && lines[e].trim() === "" && e === lines.length - 1) e++; // trailing newline at EOF
  const out = [...lines.slice(0, s), ...lines.slice(e)].join("\n");
  return { next: out.endsWith("\n") || out === "" ? out : out + "\n", prev, note: "remove [mcp_servers.blueprint]" };
}

// ---------- skills ----------
function isManaged(dir: string): boolean { return fs.existsSync(path.join(dir, MARKER)); }
function planSkills(dir: string, home: string, install: boolean, dry: boolean, ts: string, out: string[]) {
  for (const sk of skillFiles()) {
    const target = path.join(dir, sk.name);
    const file = path.join(target, "SKILL.md");
    let lst: fs.Stats | null = null;
    try { lst = fs.lstatSync(target); } catch { /* absent */ }
    if (install) {
      if (lst && !lst.isSymbolicLink() && lst.isDirectory() && isManaged(target) && readText(file) === sk.content) { out.push(`  = skill ${sk.name}: up to date`); continue; }
      if (lst && !(lst.isDirectory() && !lst.isSymbolicLink() && isManaged(target))) {
        // Someone else's skill with the same name: move it aside (outside the skills folder, so it is not loaded twice).
        const bdir = path.join(path.dirname(dir), `${path.basename(dir)}-backups`);
        const dest = path.join(bdir, `${sk.name}.${ts}`);
        out.push(`  ! skill ${sk.name}: an existing skill with this name is moved to ${tilde(home, dest)} (restore it by moving it back)`);
        if (!dry) { fs.mkdirSync(bdir, { recursive: true }); fs.renameSync(target, dest); }
      } else out.push(`  + skill ${sk.name}: ${lst ? "update" : "install"} ${tilde(home, file)}`);
      if (!dry) {
        fs.mkdirSync(target, { recursive: true });
        fs.writeFileSync(path.join(target, "SKILL.md"), sk.content);
        fs.writeFileSync(path.join(target, MARKER), "Installed by Blueprint --connect. Removed by Blueprint --disconnect.\n");
      }
    } else {
      if (!lst) continue;
      if (lst.isDirectory() && !lst.isSymbolicLink() && isManaged(target)) {
        out.push(`  - skill ${sk.name}: remove ${tilde(home, target)}`);
        if (!dry) fs.rmSync(target, { recursive: true, force: true });
        // Put back the skill that connect moved aside, if any (newest backup wins).
        const bdir = path.join(path.dirname(dir), `${path.basename(dir)}-backups`);
        let prev: string[] = [];
        try { prev = fs.readdirSync(bdir).filter((n) => n.startsWith(sk.name + ".")).sort(); } catch { /* none */ }
        if (prev.length) {
          const src = path.join(bdir, prev[prev.length - 1]);
          out.push(`  + skill ${sk.name}: restore the earlier skill from ${tilde(home, src)}`);
          if (!dry) { fs.renameSync(src, target); try { fs.rmdirSync(bdir); } catch { /* not empty */ } }
        }
      } else out.push(`  = skill ${sk.name}: not installed by Blueprint; left alone`);
    }
  }
}

/** Read-only: does this tool's config already list the `blueprint` server? (Used by the app's AI status.) */
export function registered(t: ToolInfo): boolean {
  const text = readText(t.config);
  if (!text) return false;
  if (t.id === "codex") return findBlock(text.split("\n")) !== null;
  try { const o = JSON.parse(text); return !!(o && typeof o === "object" && o.mcpServers && o.mcpServers[SERVER]); } catch { return false; }
}

// ---------- entry points ----------
export interface RunOptions { home: string; launch: Launch; tools?: ToolId[]; dryRun?: boolean; now?: Date }

function run(opts: RunOptions, install: boolean): Report {
  const { home, launch } = opts;
  const dry = !!opts.dryRun;
  const ts = stamp(opts.now);
  const all = tools(home);
  const picked = opts.tools?.length ? all.filter((t) => opts.tools!.includes(t.id)) : all.filter((t) => t.detected);
  const lines: string[] = [];
  let ok = true;
  lines.push(`${dry ? "Plan (dry run, nothing changed)" : install ? "Connecting Blueprint" : "Disconnecting Blueprint"}: server command ${[launch.command, ...launch.args].map((x) => (/\s/.test(x) ? JSON.stringify(x) : x)).join(" ")}`);
  if (!picked.length) lines.push("No supported AI tools found (looked for ~/.claude.json or ~/.claude/, ~/.cursor/, ~/.codex/). Nothing to do.");
  const skillDirsDone = new Set<string>();
  for (const t of picked) {
    lines.push(`${t.name}${t.detected ? ` (found ${t.evidence})` : " (not detected)"}`);
    if (!t.detected) { lines.push(`  skipped: ${t.name} does not appear to be installed`); continue; }
    try {
      const plan = t.id === "codex" ? planToml(t.config, install ? launch : null) : planJson(t.config, t.id, install ? launch : null);
      if (plan.next === null) lines.push(`  = ${tilde(home, t.config)}: ${plan.note}`);
      else {
        lines.push(`  ${install ? "+" : "-"} ${tilde(home, t.config)}: ${plan.note}${plan.prev !== null ? " (backup saved next to it)" : " (new file)"}`);
        if (!dry) {
          const b = writeWithBackup(t.config, plan.next, plan.prev, ts);
          if (b) lines.push(`    backup: ${tilde(home, b)}`);
        }
      }
      if (!skillDirsDone.has(t.skillsDir)) { skillDirsDone.add(t.skillsDir); planSkills(t.skillsDir, home, install, dry, ts, lines); }
      else lines.push(`  = skills: shared folder ${tilde(home, t.skillsDir)} already handled`);
    } catch (e: any) {
      ok = false;
      lines.push(`  ! error: ${String(e?.message ?? e).split(home).join("~")}`);
    }
  }
  if (!dry && picked.some((t) => t.detected)) lines.push(install ? "Done. Restart the AI tool (or start a new session) to load Blueprint; then try /visualize <idea>." : "Done. Restart the AI tool to drop Blueprint.");
  return { ok, lines };
}

export const connect = (o: RunOptions) => run(o, true);
export const disconnect = (o: RunOptions) => run(o, false);

/** Parse `--tools claude,cursor` (also `--tools=...`). Returns an error string for unknown names. */
export function parseTools(argv: string[]): ToolId[] | string | undefined {
  const i = argv.findIndex((a) => a === "--tools" || a.startsWith("--tools="));
  if (i < 0) return undefined;
  const raw = argv[i].includes("=") ? argv[i].slice(8) : argv[i + 1] ?? "";
  const names = raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const bad = names.filter((n) => !TOOL_IDS.includes(n as ToolId));
  if (!names.length || bad.length) return `--tools expects a comma list of ${TOOL_IDS.join(", ")}${bad.length ? ` (unknown: ${bad.join(", ")})` : ""}`;
  return names as ToolId[];
}
