// Runs the interaction test against a throwaway BLUEPRINT_HOME (never touches ~/Blueprint), hidden window, real input.
// Usage: node scripts/interaction-test.mjs [path/to/electron binary]   (default: the dev Electron running this app folder)
// Test hooks exist only in unpackaged builds, so this always runs the app from source (after `npm run build`).
import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const { createRequire } = await import("node:module");
const BIN = process.argv[2] || createRequire(import.meta.url)("electron");
const APP_DIR = path.resolve(here, "..");
const home = fs.mkdtempSync(path.join(os.tmpdir(), "blueprint-uitest-"));
const t = new Date().toISOString(), meta = { rev: 1, createdAt: t, updatedAt: t };
const vdir = path.join(home, "projects/uitest/systems/main/visuals");
fs.mkdirSync(vdir, { recursive: true });
fs.writeFileSync(path.join(home, "projects/uitest/project.json"), JSON.stringify({ id: "uitest", title: "UI test", description: "", notes: "", systemOrder: ["main"], ...meta }));
fs.writeFileSync(path.join(home, "projects/uitest/systems/main/system.json"), JSON.stringify({ id: "main", title: "Main", summary: "", notes: "", primaryVisual: "canvas", visualOrder: ["canvas"], ...meta }));
const card = (id, title, x, y) => ({ id, kind: "card", title, subtitle: "test card", icon: "box", explanation: `${title} node.`, position: { x, y } });
fs.writeFileSync(path.join(vdir, "canvas.json"), JSON.stringify({ id: "canvas", title: "Canvas", description: "", ...meta, viewport: { x: 80, y: 80, zoom: 1 },
  nodes: [card("alpha", "Alpha", 0, 0), card("beta", "Beta", 420, 0), card("gamma", "Gamma", 0, 260)],
  edges: [{ id: "e1", source: "alpha", target: "beta", kind: "flow", explanation: "Alpha leads to Beta." }] }));
const rows = [];
const child = spawn(BIN, [APP_DIR, "--ui-test", path.resolve(here, "interaction-test.cjs")], { env: { ...process.env, BLUEPRINT_HOME: home, BLUEPRINT_TEST: "1" }, stdio: ["ignore", "pipe", "pipe"] });
let buf = "";
child.stdout.on("data", (d) => { buf += d; let i; while ((i = buf.indexOf("\n")) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); if (!line.startsWith("RESULT\t")) { if (line.trim()) console.log(line); } else { const [, r, name, detail] = line.split("\t"); rows.push({ r, name, detail }); console.log(`${r}  ${name}${r === "FAIL" && detail ? `  (${detail})` : ""}`); } } });
child.stderr.on("data", (d) => process.stderr.write(d));
const killer = setTimeout(() => { console.log("TIMEOUT after 240s"); child.kill("SIGTERM"); }, 240_000);
const code = await new Promise((r) => child.on("exit", (c) => r(c ?? 1)));
clearTimeout(killer);
fs.rmSync(home, { recursive: true, force: true });
const fail = rows.filter((x) => x.r === "FAIL").length;
console.log(`\n${rows.length - fail}/${rows.length} passed; driver exit ${code}`);
process.exit(code === 0 && fail === 0 && rows.length > 0 ? 0 : 1);
