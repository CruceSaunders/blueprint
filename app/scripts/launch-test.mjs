// LaunchServices regression test (packaged build): with `--mcp` processes alive, a normal launch must still produce
// exactly one GUI with a window, links must reach it, and quitting it must leave the `--mcp` servers working.
// Usage: node scripts/launch-test.mjs [path/to/Blueprint.app]   (default: release/mac-arm64/Blueprint.app)
//
// Uses `open -g` (background: no focus change) because the bug only reproduces through LaunchServices. The GUI runs in
// test mode (BLUEPRINT_GUI_STATUS=1): it never takes focus, does not claim the blueprint:// scheme, and writes
// <store>/.gui-status.json. If another copy with the same bundle id is running (e.g. an installed Blueprint in use),
// LaunchServices could route our requests to it, so the test runs against a temporary clone with a test bundle id
// (ad-hoc re-signed) and says so. Only processes this script started are ever killed, by pid.
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process"; import { fileURLToPath, pathToFileURL } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const SRC_APP = path.resolve(process.argv[2] || path.join(here, "../release/mac-arm64/Blueprint.app"));
const sdk = (p) => import(pathToFileURL(path.resolve(here, "../../mcp/node_modules/@modelcontextprotocol/sdk/dist/esm", p)).href);
const { Client } = await sdk("client/index.js");
const { StdioClientTransport } = await sdk("client/stdio.js");

const BUNDLE_ID = execFileSync("/usr/libexec/PlistBuddy", ["-c", "Print :CFBundleIdentifier", path.join(SRC_APP, "Contents/Info.plist")], { encoding: "utf8" }).trim();
const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "blueprint-launch-")));
const HOME = path.join(tmp, "store");
let failed = 0;
const ok = (c, m) => { console.log(`${c ? "ok  " : "FAIL"} ${m}`); if (!c) failed++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const lsPids = (bid) => {
  const out = spawnSync("/usr/bin/lsappinfo", ["list"], { encoding: "utf8" }).stdout;
  const res = [];
  for (const block of out.split(/\n(?=\s*\d+\) ")/)) {
    if (!block.includes(`"${bid}"`)) continue;
    const pid = /pid = (\d+)/.exec(block)?.[1], exe = /executable path="([^"]+)"/.exec(block)?.[1];
    if (pid) res.push({ pid: Number(pid), exe, type: /type="(\w+)"/.exec(block)?.[1] });
  }
  return res;
};

// ---- isolate from any other running copy with the same bundle id
let APP = SRC_APP, BID = BUNDLE_ID, cloned = false;
const foreign = lsPids(BUNDLE_ID).filter((x) => x.exe && !x.exe.startsWith(SRC_APP + "/"));
if (foreign.length) {
  cloned = true;
  BID = `${BUNDLE_ID}.lstest`;
  APP = path.join(tmp, "Blueprint LSTest.app");
  execFileSync("/usr/bin/ditto", [SRC_APP, APP]);
  const plist = path.join(APP, "Contents/Info.plist");
  execFileSync("/usr/bin/plutil", ["-replace", "CFBundleIdentifier", "-string", BID, plist]);
  execFileSync("/usr/bin/plutil", ["-remove", "CFBundleURLTypes", plist]);
  // Ad-hoc re-sign without the hardened runtime: ad-hoc code has no team id, so library validation would refuse the framework.
  execFileSync("/usr/bin/codesign", ["--force", "--deep", "--sign", "-", APP], { stdio: "ignore" });
  console.log(`note: ${foreign.length} other process(es) with bundle id ${BUNDLE_ID} are running from another copy; testing a clone with bundle id ${BID} (ad-hoc signed) so LaunchServices cannot route to them.`);
}
const BIN = fs.realpathSync(path.join(APP, "Contents/MacOS/Blueprint")); // processes report the real path (/private/var/...)
console.log(`app: ${APP}\nstore: ${HOME}`);

// fixture visual for the link
const t = new Date().toISOString(), meta = { rev: 1, createdAt: t, updatedAt: t };
const vdir = path.join(HOME, "projects/lt/systems/main/visuals");
fs.mkdirSync(vdir, { recursive: true });
fs.writeFileSync(path.join(HOME, "projects/lt/project.json"), JSON.stringify({ id: "lt", title: "Launch test", description: "", notes: "", systemOrder: ["main"], ...meta }));
fs.writeFileSync(path.join(HOME, "projects/lt/systems/main/system.json"), JSON.stringify({ id: "main", title: "Main", summary: "", notes: "", primaryVisual: "one", visualOrder: ["one", "two"], ...meta }));
for (const v of ["one", "two"]) fs.writeFileSync(path.join(vdir, `${v}.json`), JSON.stringify({ id: v, title: v, description: "", ...meta, viewport: { x: 0, y: 0, zoom: 1 }, nodes: [{ id: "a", kind: "card", title: v, explanation: "x", position: { x: 0, y: 0 } }], edges: [] }));

const env = { ...process.env, BLUEPRINT_HOME: HOME, BLUEPRINT_GUI_STATUS: "1" };
delete env.ELECTRON_RUN_AS_NODE;
const statusFile = path.join(HOME, ".gui-status.json");
const status = () => { try { return JSON.parse(fs.readFileSync(statusFile, "utf8")); } catch { return null; } };
const guiPids = () => spawnSync("/bin/ps", ["-axo", "pid=,args="], { encoding: "utf8" }).stdout.split("\n")
  .map((l) => /^\s*(\d+)\s+(.*)$/.exec(l)).filter(Boolean)
  .filter((m) => m[2].startsWith(BIN) && !/ --(mcp|snapshot|connect|disconnect)\b/.test(m[2])).map((m) => Number(m[1]));
const openArgs = (...a) => ["-g", "--env", `BLUEPRINT_HOME=${HOME}`, "--env", "BLUEPRINT_GUI_STATUS=1", ...a];
const waitFor = async (fn, ms = 10000) => { const end = Date.now() + ms; while (Date.now() < end) { const v = fn(); if (v) return v; await sleep(200); } return fn(); };

const clients = [], started = new Set();
try {
  // ---- two headless MCP servers first
  for (let i = 0; i < 2; i++) {
    const tr = new StdioClientTransport({ command: BIN, args: ["--mcp"], env, stderr: "pipe" });
    const c = new Client({ name: `launch-test-${i}`, version: "1" });
    await c.connect(tr);
    tr.stderr?.on("data", (d) => { for (const l of String(d).split("\n")) if (/forwarded|could not/.test(l)) console.log(`    [mcp ${i} stderr] ${l.trim()}`); });
    clients.push({ c, tr });
  }
  const mcpPids = clients.map((x) => x.tr.pid);
  ok(mcpPids.every(Boolean), `two --mcp servers running (pids ${mcpPids.join(", ")})`);
  await sleep(1000);
  const reg = lsPids(BID);
  console.log(`lsappinfo entries for ${BID} while only --mcp runs: ${reg.map((x) => `pid ${x.pid} ${x.type}`).join("; ") || "none"}`);

  // ---- LaunchServices launch with --mcp alive
  spawnSync("/usr/bin/open", openArgs(APP), { stdio: "ignore" });
  const s1 = await waitFor(() => { const s = status(); return s && s.windows >= 1 && guiPids().length ? s : null; });
  const g1 = guiPids(); g1.forEach((p) => started.add(p));
  ok(!!s1 && s1.windows >= 1, `GUI came up with a window within 10 s (windows=${s1?.windows ?? 0})`);
  ok(g1.length === 1 && s1?.pid === g1[0] && s1?.exe === BIN, `exactly one GUI process (${g1.join(", ") || "none"}), it is this build`);

  const snapImg = async () => { const r = await clients[1].c.callTool({ name: "snapshot", arguments: { projectId: "lt", systemId: "main", visualId: "one" } }); return !r.isError && r.content.some((x) => x.type === "image"); };
  ok(await snapImg() && guiPids().length === 1, "snapshot through --mcp works while the GUI is open, and leaves exactly one GUI");

  // ---- again: still exactly one
  spawnSync("/usr/bin/open", openArgs(APP), { stdio: "ignore" });
  await sleep(3000);
  const g2 = guiPids(); g2.forEach((p) => started.add(p));
  ok(g2.length === 1 && g2[0] === g1[0], `second open: still exactly one GUI (${g2.join(", ")})`);

  // ---- link
  spawnSync("/usr/bin/open", openArgs("-a", APP, "blueprint://open/lt/main/two"), { stdio: "ignore" });
  const s3 = await waitFor(() => { const s = status(); return s?.lastOpen === "lt/main/two" ? s : null; });
  const g3 = guiPids(); g3.forEach((p) => started.add(p));
  ok(s3?.lastOpen === "lt/main/two" && g3.length === 1, `blueprint:// link delivered to the GUI (lastOpen=${status()?.lastOpen}, GUIs=${g3.length})`);

  // ---- quit the GUI; --mcp servers must survive and answer
  for (const p of guiPids()) { if (started.has(p)) process.kill(p, "SIGTERM"); }
  await waitFor(() => guiPids().length === 0, 8000);
  ok(guiPids().length === 0, "GUI quit");
  const alive = mcpPids.every((p) => { try { process.kill(p, 0); return true; } catch { return false; } });
  ok(alive, "--mcp servers still alive after the GUI quit");
  let listed = 0;
  for (const { c } of clients) { const r = await c.listTools(); if (r.tools.some((x) => x.name === "apply")) listed++; }
  ok(listed === 2, `both --mcp servers still answer tools/list (${listed}/2)`);
  ok(await snapImg() && guiPids().length === 0, "snapshot through --mcp works with the GUI closed, and starts no GUI");

  // ---- relaunch after quit, with --mcp still alive
  fs.rmSync(statusFile, { force: true });
  await sleep(1000);
  console.log(`lsappinfo entries after the GUI quit: ${lsPids(BID).map((x) => `pid ${x.pid} ${x.type}`).join("; ")}`);
  const r = spawnSync("/usr/bin/open", openArgs(APP), { encoding: "utf8" });
  if (r.status || r.stderr) console.log(`    open: exit ${r.status} ${r.stderr.trim()}`);
  const s4 = await waitFor(() => { const s = status(); return s && s.windows >= 1 ? s : null; });
  const g4 = guiPids(); g4.forEach((p) => started.add(p));
  ok(!!s4 && g4.length === 1, `GUI relaunches after quitting while --mcp lives (GUIs=${g4.length})`);

  // ---- the GUI must outlive the --mcp processes (the AI sessions) that started it
  for (const { tr } of clients) { try { process.kill(tr.pid, "SIGTERM"); } catch { /* gone */ } }
  await sleep(2500);
  const mcpGone = mcpPids.every((p) => { try { process.kill(p, 0); return false; } catch { return true; } });
  const g5 = guiPids();
  ok(mcpGone && g5.length === 1 && g5[0] === g4[0], `GUI survives its --mcp parents ending (mcp gone: ${mcpGone}, GUI ${g5.join(", ") || "gone"})`);
} catch (e) {
  failed++; console.log("EXCEPTION", e);
} finally {
  for (const p of guiPids()) if (started.has(p)) { try { process.kill(p, "SIGTERM"); } catch { /* gone */ } }
  for (const { c } of clients) await c.close().catch(() => {});
  await sleep(500);
  for (const p of guiPids()) if (started.has(p)) { try { process.kill(p, "SIGKILL"); } catch { /* gone */ } }
  if (cloned) spawnSync("/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister", ["-u", APP], { stdio: "ignore" });
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(failed ? `\n${failed} FAILED` : "\nlaunch with --mcp alive: PASS");
process.exit(failed ? 1 : 0);
