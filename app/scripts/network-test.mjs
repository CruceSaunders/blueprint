// Network-isolation test. Renders an HTML visual that tries fetch, WebSocket, an <img> beacon and a WebRTC STUN
// request against listeners this script opens on 127.0.0.1 (TCP + UDP), and asserts that nothing arrives.
// A positive control first loads the same probe page in a plain, unprotected Electron window and must see traffic,
// which proves the probe works and the listeners are reachable.
// Usage: node scripts/network-test.mjs [path/to/Blueprint binary [app dir]]   (default: the packaged app in release/)
import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import net from "node:net"; import dgram from "node:dgram";
import { spawn } from "node:child_process"; import { createRequire } from "node:module"; import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const BIN = process.argv[2] || path.resolve(here, "../release/mac-arm64/Blueprint.app/Contents/MacOS/Blueprint");
const PRE = process.argv[3] ? [process.argv[3]] : []; // app dir when BIN is a development Electron
const ELECTRON = createRequire(import.meta.url)("electron");

const hits = { tcp: 0, udp: 0, log: [] };
const tcp = net.createServer((s) => { hits.tcp++; s.once("data", (d) => hits.log.push(`tcp ${d.toString("latin1").split("\r\n")[0]}`)); s.on("error", () => {}); s.end(); });
await new Promise((r) => tcp.listen(0, "127.0.0.1", r));
const udp = dgram.createSocket("udp4");
udp.on("message", (_m, rinfo) => { hits.udp++; hits.log.push(`udp ${rinfo.size}B`); });
await new Promise((r) => udp.bind(0, "127.0.0.1", r));
const P = tcp.address().port, U = udp.address().port;

// The probe writes its attempt count into the page, so the snapshot PNG proves the script really ran.
const probe = `<div id="n" style="font:16px system-ui;padding:8px">probe script did not run</div><script>
var n=0;
function go(){
  n++;document.getElementById("n").textContent="probe attempts: "+n;
  try{fetch("http://127.0.0.1:${P}/fetch").catch(function(){})}catch(e){}
  try{fetch("http://localhost:${P}/fetch-name").catch(function(){})}catch(e){}
  try{var w=new WebSocket("ws://127.0.0.1:${P}/ws");w.onerror=function(){}}catch(e){}
  try{var i=new Image();i.src="http://127.0.0.1:${P}/img?"+Date.now()}catch(e){}
  try{var pc=new RTCPeerConnection({iceServers:[{urls:"stun:127.0.0.1:${U}"}]});pc.createDataChannel("x");pc.createOffer().then(function(o){return pc.setLocalDescription(o)}).catch(function(){})}catch(e){}
}
go();setInterval(go,150);
</script>`;

const run = (cmd, args, env, ms) => new Promise((resolve) => {
  const t0 = Date.now();
  const c = spawn(cmd, args, { env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
  let err = "";
  c.stderr.on("data", (d) => (err += d));
  const k = setTimeout(() => c.kill("SIGTERM"), ms);
  c.on("exit", (code) => { clearTimeout(k); resolve({ code, ms: Date.now() - t0, err }); });
});
const settle = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
const ok = (c, m) => { console.log(`${c ? "ok  " : "FAIL"} ${m}`); if (!c) failed++; };

// ---- positive control: same probe, unprotected window, ~2.5 s
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "blueprint-nettest-"));
fs.writeFileSync(path.join(tmp, "probe.html"), `<!doctype html><html><body>${probe}</body></html>`);
fs.writeFileSync(path.join(tmp, "control.cjs"), `const { app, BrowserWindow } = require("electron");
app.dock && app.dock.hide();
app.whenReady().then(() => { const w = new BrowserWindow({ show: false, webPreferences: { offscreen: true } }); w.loadFile(${JSON.stringify(path.join(tmp, "probe.html"))}); setTimeout(() => app.exit(0), 2500); });`);
const ctl = await run(ELECTRON, [path.join(tmp, "control.cjs")], { ELECTRON_ENABLE_LOGGING: "" }, 20000);
await settle(500);
const control = { ...hits };
ok(control.tcp > 0 && control.udp > 0, `positive control: unprotected window reached the listeners (tcp ${control.tcp}, udp ${control.udp}, exit ${ctl.code}, ${ctl.ms} ms)`);
hits.tcp = 0; hits.udp = 0; hits.log = [];

// ---- Blueprint: render the probe as an HTML visual through --snapshot
const home = path.join(tmp, "store");
const t = new Date().toISOString(), meta = { rev: 1, createdAt: t, updatedAt: t };
const vdir = path.join(home, "projects/net/systems/main/visuals");
fs.mkdirSync(vdir, { recursive: true });
fs.writeFileSync(path.join(home, "projects/net/project.json"), JSON.stringify({ id: "net", title: "Net", description: "", notes: "", systemOrder: ["main"], ...meta }));
fs.writeFileSync(path.join(home, "projects/net/systems/main/system.json"), JSON.stringify({ id: "main", title: "Main", summary: "", notes: "", primaryVisual: "probe", visualOrder: ["probe"], ...meta }));
fs.writeFileSync(path.join(vdir, "probe.json"), JSON.stringify({ id: "probe", title: "Probe", description: "", ...meta, viewport: { x: 0, y: 0, zoom: 1 },
  nodes: [
    { id: "html", kind: "visual", title: "HTML probe", html: probe, position: { x: 0, y: 0 }, size: { w: 320, h: 200 }, explanation: "probe" },
    { id: "svg", kind: "visual", title: "SVG probe", svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><image href="http://127.0.0.1:${P}/svg-image" width="10" height="10"/><rect width="10" height="10" fill="url(http://127.0.0.1:${P}/svg-fill)"/></svg>`, position: { x: 400, y: 0 }, size: { w: 200, h: 200 }, explanation: "probe" },
  ], edges: [] }));
const out = path.join(tmp, "snap.png");
const snap = await run(BIN, [...PRE, "--snapshot", "net/main/probe", "--out", out], { BLUEPRINT_HOME: home }, 60000);
await settle(1500);
if (process.env.NETTEST_PNG && fs.existsSync(out)) fs.copyFileSync(out, process.env.NETTEST_PNG);
ok(snap.code === 0 && fs.existsSync(out), `snapshot rendered the probe visual (exit ${snap.code}, ${snap.ms} ms)${snap.code ? `: ${snap.err.slice(0, 300)}` : ""}`);
ok(hits.tcp === 0, `no TCP connection reached 127.0.0.1:${P} (fetch, fetch by name, WebSocket, img, svg refs): ${hits.tcp}`);
ok(hits.udp === 0, `no UDP packet reached 127.0.0.1:${U} (WebRTC STUN): ${hits.udp}`);
if (hits.log.length) console.log(hits.log.slice(0, 10).join("\n"));
tcp.close(); udp.close();
fs.rmSync(tmp, { recursive: true, force: true });
console.log(failed ? `\n${failed} FAILED` : "\nnetwork isolation: PASS");
process.exit(failed ? 1 : 0);
