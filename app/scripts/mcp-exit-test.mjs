// `--mcp` exit test: a headless MCP server must go away promptly when its parent AI session ends.
// For each way a session can end (SIGTERM, SIGINT, stdin closed) this starts `--mcp`, completes the MCP initialize
// handshake (so the server is really serving), ends it that way, and requires the process to exit within 5 s.
// The orphan trial models a session that dies while another process still holds the server's stdin open (no EOF):
// `sh -c 'sleep 600 | Blueprint --mcp'`, then the sh is SIGKILLed; the server must notice it was re-parented.
// Only the processes this script starts are signalled, by pid. A survivor is SIGKILLed and the test fails.
// Usage: node scripts/mcp-exit-test.mjs [path/to/Blueprint binary [app dir]]   (default: the packaged app in release/)
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import { spawn } from "node:child_process"; import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const BIN = process.argv[2] || path.resolve(here, "../release/mac-arm64/Blueprint.app/Contents/MacOS/Blueprint");
const PRE = process.argv[3] ? [process.argv[3]] : []; // app dir when BIN is a development Electron
if (!fs.existsSync(BIN)) { console.error(`mcp-exit-test: no binary at ${BIN}`); process.exit(2); }
const home = fs.mkdtempSync(path.join(os.tmpdir(), "blueprint-mcp-exit-"));
const LIMIT_MS = 5000;

async function trial(how) {
  const child = spawn(BIN, [...PRE, "--mcp"], { env: { ...process.env, BLUEPRINT_HOME: home }, stdio: ["pipe", "pipe", "pipe"] });
  let out = "", err = "";
  child.stdout.on("data", (d) => { out += d; });
  child.stderr.on("data", (d) => { err += d; });
  const exited = new Promise((r) => child.on("exit", (code, signal) => r({ code, signal })));
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "exit-test", version: "1" } } }) + "\n");
  const t0 = Date.now();
  while (!/"id":1/.test(out) && Date.now() - t0 < 20000 && child.exitCode === null) await new Promise((r) => setTimeout(r, 50));
  const ready = /"id":1/.test(out);
  const t1 = Date.now();
  if (how === "stdin") child.stdin.end(); else child.kill(how);
  const res = await Promise.race([exited, new Promise((r) => setTimeout(() => r(null), LIMIT_MS))]);
  const ms = Date.now() - t1;
  if (!res) { try { process.kill(child.pid, "SIGKILL"); } catch { /* gone */ } await exited; }
  const ok = ready && !!res;
  console.log(`${ok ? "PASS" : "FAIL"}  ${how}: ${ready ? "served initialize" : "never answered initialize"}; ${res ? `exited in ${ms} ms (code ${res.code}, signal ${res.signal})` : `still running after ${LIMIT_MS} ms (SIGKILLed)`}`);
  if (!ok && err.trim()) console.log(err.trim().split("\n").slice(-5).map((l) => "    " + l).join("\n"));
  return ok;
}

async function orphan() {
  const q = (a) => `'${a.replace(/'/g, `'\\''`)}'`;
  const sh = spawn("/bin/sh", ["-c", `sleep 600 | ${[BIN, ...PRE, "--mcp"].map(q).join(" ")}`], { env: { ...process.env, BLUEPRINT_HOME: home }, stdio: ["ignore", "ignore", "ignore"] });
  const kids = async () => { const p = spawn("/usr/bin/pgrep", ["-P", String(sh.pid)]); let o = ""; p.stdout.on("data", (d) => { o += d; }); await new Promise((r) => p.on("exit", r)); return o.split(/\s+/).filter(Boolean).map(Number); };
  const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
  let pids = [];
  for (let i = 0; i < 40 && pids.length < 2; i++) { await new Promise((r) => setTimeout(r, 100)); pids = await kids(); }
  await new Promise((r) => setTimeout(r, 2500)); // let the server start serving
  const cmd = async (pid) => { const p = spawn("/bin/ps", ["-o", "command=", "-p", String(pid)]); let o = ""; p.stdout.on("data", (d) => { o += d; }); await new Promise((r) => p.on("exit", r)); return o; };
  let server, sleeper;
  for (const pid of pids) { if (/--mcp/.test(await cmd(pid))) server = pid; else sleeper = pid; }
  const ready = !!server && alive(server);
  process.kill(sh.pid, "SIGKILL");
  const t1 = Date.now();
  while (server && alive(server) && Date.now() - t1 < LIMIT_MS) await new Promise((r) => setTimeout(r, 50));
  const gone = !server || !alive(server);
  const ms = Date.now() - t1;
  if (server && !gone) try { process.kill(server, "SIGKILL"); } catch { /* gone */ }
  if (sleeper) try { process.kill(sleeper, "SIGKILL"); } catch { /* gone */ }
  const ok = ready && gone;
  console.log(`${ok ? "PASS" : "FAIL"}  orphaned (stdin still held open): ${ready ? "server running" : "server never started"}; ${gone ? `exited in ${ms} ms` : `still running after ${LIMIT_MS} ms (SIGKILLed)`}`);
  return ok;
}

const results = [];
for (const how of ["SIGTERM", "SIGINT", "stdin"]) results.push(await trial(how));
results.push(await orphan());
fs.rmSync(home, { recursive: true, force: true });
const pass = results.filter(Boolean).length;
console.log(`\n${pass}/${results.length} passed`);
process.exit(pass === results.length ? 0 : 1);
