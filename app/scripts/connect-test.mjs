// Tests `Blueprint --connect` / `--disconnect` against a throwaway HOME holding fake tool configs.
// Never touches the real home folder. Usage: node scripts/connect-test.mjs [path/to/Blueprint binary [app dir]]
// Default binary: the packaged app in release/.
import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const BIN = process.argv[2] || path.resolve(here, "../release/mac-arm64/Blueprint.app/Contents/MacOS/Blueprint");
const PRE = process.argv[3] ? [process.argv[3]] : [];
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), "blueprint-connect-"));
let failed = 0;
const ok = (c, m) => { console.log(`${c ? "ok  " : "FAIL"} ${m}`); if (!c) failed++; };
const run = (...args) => {
  const env = { ...process.env, HOME };
  delete env.ELECTRON_RUN_AS_NODE;
  const r = spawnSync(BIN, [...PRE, ...args], { env, encoding: "utf8", timeout: 60000 });
  return { code: r.status, out: r.stdout ?? "", err: r.stderr ?? "" };
};
const p = (x) => path.join(HOME, x);
const read = (x) => fs.readFileSync(p(x), "utf8");
const snapshotTree = () => {
  const out = {};
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else out[path.relative(HOME, f)] = fs.readFileSync(f, "utf8"); } };
  walk(HOME); return out;
};

// fake configs with other servers and settings that must survive
fs.writeFileSync(p(".claude.json"), JSON.stringify({ numStartups: 7, mcpServers: { other: { type: "stdio", command: "/usr/bin/true", args: [] } }, projects: { "/x": { a: 1 } } }, null, 2) + "\n");
fs.mkdirSync(p(".cursor")); fs.writeFileSync(p(".cursor/mcp.json"), JSON.stringify({ mcpServers: { keep: { command: "keep-me" } } }, null, 2) + "\n");
fs.mkdirSync(p(".codex")); fs.writeFileSync(p(".codex/config.toml"), '# my codex config\nmodel = "x"\n\n[mcp_servers.other]\ncommand = "other"\nargs = ["a"]\n');
fs.mkdirSync(p(".claude/skills/visualize"), { recursive: true }); fs.writeFileSync(p(".claude/skills/visualize/SKILL.md"), "---\nname: visualize\ndescription: someone else's skill\n---\nmine\n");
fs.mkdirSync(p(".claude/skills/unrelated"), { recursive: true }); fs.writeFileSync(p(".claude/skills/unrelated/SKILL.md"), "keep\n");
const before = snapshotTree();

const dry = run("--connect", "--dry-run");
console.log(dry.out.trim().split("\n").map((l) => "    | " + l).join("\n"));
ok(dry.code === 0 && /dry run/.test(dry.out) && /Claude Code/.test(dry.out) && /Cursor/.test(dry.out) && /Codex/.test(dry.out), `--connect --dry-run exit ${dry.code} and lists all three tools`);
ok(JSON.stringify(snapshotTree()) === JSON.stringify(before), "--dry-run changed nothing on disk");
ok(dry.out.includes("--mcp") && dry.out.includes(BIN), "plan names this binary with --mcp");
ok(!/\/Users\//.test(PRE.reduce((o, x) => o.split(x).join(""), dry.out.split(BIN).join(""))), "plan prints ~-relative paths only");

const c1 = run("--connect");
ok(c1.code === 0, `--connect exit ${c1.code}${c1.code ? ": " + c1.err + c1.out : ""}`);
const cj = JSON.parse(read(".claude.json"));
ok(cj.mcpServers.other && cj.numStartups === 7 && cj.projects["/x"].a === 1, "~/.claude.json: other servers and settings untouched");
ok(cj.mcpServers.blueprint?.command === BIN && cj.mcpServers.blueprint.args.at(-1) === "--mcp", "~/.claude.json: blueprint server added");
const cu = JSON.parse(read(".cursor/mcp.json"));
ok(cu.mcpServers.keep?.command === "keep-me" && cu.mcpServers.blueprint?.args.at(-1) === "--mcp", "~/.cursor/mcp.json: merged, other server kept");
const toml = read(".codex/config.toml");
ok(toml.startsWith('# my codex config\nmodel = "x"\n\n[mcp_servers.other]') && /\[mcp_servers\.blueprint\]\ncommand = ".*"\nargs = \[.*"--mcp"\]/.test(toml), "~/.codex/config.toml: [mcp_servers.blueprint] appended, rest untouched");
const backups = (d) => fs.readdirSync(p(d)).filter((f) => f.includes(".blueprint-backup-"));
ok(backups(".").length === 1 && backups(".cursor").length === 1 && backups(".codex").length === 1, "each changed config backed up next to itself");
const skillNames = fs.readdirSync(p(".claude/skills")).filter((n) => fs.existsSync(p(`.claude/skills/${n}/.blueprint-managed`)));
ok(skillNames.includes("visualize") && skillNames.filter((n) => n.startsWith("blueprint-")).length >= 6, `Claude skills installed: ${skillNames.join(", ")}`);
ok(read(".claude/skills/visualize/SKILL.md").includes("## Topics") && read(".claude/skills/visualize/SKILL.md").startsWith("---\nname: visualize"), "visualize SKILL.md has frontmatter + guide + topic index");
const agents = fs.readdirSync(p(".agents/skills"));
ok(agents.includes("visualize") && agents.length === skillNames.length, `~/.agents/skills (Cursor, Codex) has the same ${agents.length} skills`);
const moved = fs.readdirSync(p(".claude/skills-backups"));
ok(moved.length === 1 && moved[0].startsWith("visualize.") && /moved to/.test(c1.out), "pre-existing different 'visualize' skill backed up and reported");
ok(read(".claude/skills/unrelated/SKILL.md") === "keep\n", "unrelated skill untouched");

const afterFirst = snapshotTree();
const c2 = run("--connect");
ok(c2.code === 0 && JSON.stringify(snapshotTree()) === JSON.stringify(afterFirst) && /already registered/.test(c2.out), "second --connect is a no-op (idempotent, no new backups)");

const d = run("--disconnect");
ok(d.code === 0, `--disconnect exit ${d.code}`);
ok(read(".claude.json") === before[".claude.json"], "~/.claude.json restored byte for byte");
ok(read(".cursor/mcp.json") === before[".cursor/mcp.json"], "~/.cursor/mcp.json restored byte for byte");
ok(read(".codex/config.toml") === before[".codex/config.toml"], "~/.codex/config.toml restored byte for byte");
ok(!fs.readdirSync(p(".claude/skills")).some((n) => fs.existsSync(p(`.claude/skills/${n}/.blueprint-managed`))) && fs.readdirSync(p(".agents/skills")).length === 0, "installed skills removed");
ok(fs.existsSync(p(".claude/skills/unrelated/SKILL.md")), "unrelated skill still there");
ok(read(".claude/skills/visualize/SKILL.md").endsWith("mine\n") && !fs.existsSync(p(".claude/skills-backups")), "the user's own 'visualize' skill was put back");
const bad = run("--connect", "--tools", "claude,emacs");
ok(bad.code === 2 && /unknown: emacs/.test(bad.err), "--tools rejects unknown names");
const only = run("--connect", "--dry-run", "--tools", "codex");
ok(only.code === 0 && /Codex/.test(only.out) && !/Cursor/.test(only.out), "--tools codex limits the plan to Codex");

fs.rmSync(HOME, { recursive: true, force: true });
console.log(failed ? `\n${failed} FAILED` : "\nconnect/disconnect: PASS");
process.exit(failed ? 1 : 0);
