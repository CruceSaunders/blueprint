import { app, BrowserWindow, dialog, ipcMain, Menu, nativeTheme, net, protocol, session, shell } from "electron";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { watch } from "chokidar";
import * as store from "./store";
import type { VisualIds } from "../src/lib/types";
import * as connectTools from "./connect";

// ---------- argv ----------
function argValue(argv: string[], flag: string): string | undefined {
  const i = argv.indexOf(flag);
  if (i >= 0 && i + 1 < argv.length) return argv[i + 1];
  const eq = argv.find((a) => a.startsWith(flag + "="));
  return eq ? eq.slice(flag.length + 1) : undefined;
}

const ID_RE = /^[a-z0-9_]+(?:-[a-z0-9_]+)*$/;
/** `<projectId>/<systemId>/<visualId>` -> ids, or null. Never throws; every id must be a valid slug. */
function parseIds(p: string | undefined): VisualIds | null {
  try {
    if (typeof p !== "string" || p.length > 400) return null;
    const parts = p.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
    if (parts.length !== 3) return null;
    const ids = parts.map((x) => decodeURIComponent(x));
    if (!ids.every((x) => x.length <= 80 && ID_RE.test(x))) return null;
    const [projectId, systemId, visualId] = ids;
    return { projectId, systemId, visualId };
  } catch {
    return null;
  }
}

/** blueprint://open/<projectId>/<systemId>/<visualId> -> ids, or null. Never throws, never shows UI. */
function parseDeepLink(url: unknown): VisualIds | null {
  try {
    if (typeof url !== "string") return null;
    const m = /^blueprint:\/\/open\/([^?#]+)$/i.exec(url.trim());
    return m ? parseIds(m[1]) : null;
  } catch {
    return null;
  }
}

const argv = process.argv;
const has = (flag: string) => argv.some((a) => a === flag || a.startsWith(flag + "="));
/** Test hooks exist only in unpackaged (development) builds; a packaged app rejects them. */
const DEV = !app.isPackaged;
const TEST_FLAGS = ["--ui-test", "--ui-eval", "--ui-shot"];
if (!DEV) {
  const bad = TEST_FLAGS.find(has);
  if (bad) {
    process.stderr.write(`blueprint: unknown option ${bad} (test hooks are not available in release builds)\n`);
    process.exit(2);
  }
}
const MCP = has("--mcp");
const CONNECT = has("--connect");
const DISCONNECT = has("--disconnect");
const CLI = MCP || CONNECT || DISCONNECT;
const snapshotArg = argValue(argv, "--snapshot");
const SNAPSHOT = snapshotArg !== undefined;
// Dev/test: `--ui-shot <png> [--open p/s/v] [--select id] [--delay ms] [--theme dark]` renders the full app UI offscreen, captures it, exits.
const uiShotArg = DEV ? argValue(argv, "--ui-shot") : undefined;
// Dev/test: `--ui-test <driver.cjs>` loads the full app UI in a hidden offscreen window and hands it to the driver,
// which sends genuine input events (webContents.sendInputEvent). Exit code = driver result.
const uiTestArg = DEV ? argValue(argv, "--ui-test") : undefined;
const SCALE = Math.max(1, Math.min(3, Math.round(Number(argValue(argv, "--scale") ?? 1) || 1)));
const HEADLESS = CLI || SNAPSHOT || uiShotArg !== undefined || uiTestArg !== undefined;

// MCP speaks JSON-RPC on stdout: nothing else may be written there.
if (MCP) {
  const toErr = (...a: unknown[]) => process.stderr.write(a.map((x) => (typeof x === "string" ? x : String(x))).join(" ") + "\n");
  console.log = toErr; console.info = toErr; console.debug = toErr; console.warn = toErr;
}

// ---------- network isolation: nothing leaves the machine, from any page, frame or session ----------
// DNS for every host name fails, WebRTC may not use UDP outside a proxy, and the proxy is a dead local port.
app.commandLine.appendSwitch("host-resolver-rules", "MAP * ~NOTFOUND");
app.commandLine.appendSwitch("force-webrtc-ip-handling-policy", "disable_non_proxied_udp");
app.commandLine.appendSwitch("proxy-server", "127.0.0.1:9");
app.commandLine.appendSwitch("proxy-bypass-list", "<-loopback>");
app.commandLine.appendSwitch("disable-background-networking");
app.commandLine.appendSwitch("disable-component-update");
app.commandLine.appendSwitch("disable-domain-reliability");
app.commandLine.appendSwitch("no-pings");

// ---------- headless modes: no Dock icon, no focus, never a dialog ----------
if (HEADLESS) {
  // Background-only from the first line: no Dock icon, no menu bar, never activates. (macOS still lists the process
  // under this bundle id - LaunchServices checks it in before any JS runs - so see forwardToGui below.)
  app.setActivationPolicy("prohibited");
  dialog.showErrorBox = (title: string, content: string) => {
    process.stderr.write(`blueprint: ${title} ${content}\n`);
  };
  process.on("uncaughtException", (err) => {
    process.stderr.write(`blueprint: uncaught ${err?.stack ?? err}\n`);
    app.exit(1);
  });
  process.on("unhandledRejection", (err) => {
    process.stderr.write(`blueprint: unhandled rejection ${String(err)}\n`);
    app.exit(1);
  });
  app.dock?.hide();
  // `--scale 1|2|3` (snapshot and ui-shot): device pixels per CSS pixel of the captured PNG. Default 1.
  app.commandLine.appendSwitch("force-device-scale-factor", String(SCALE));
  app.commandLine.appendSwitch("disable-renderer-backgrounding");
  // Separate profile so a snapshot runs while the main app is open. The folder name carries our pid so a later run
  // can sweep folders left by runs that were killed (SIGKILL cannot be caught).
  const tmpRoot = os.tmpdir();
  for (const name of (() => { try { return fs.readdirSync(tmpRoot); } catch { return []; } })()) {
    const m = /^blueprint-snapshot-(\d+)-/.exec(name);
    if (!name.startsWith("blueprint-snapshot-")) continue;
    let alive = false;
    if (m) { try { process.kill(Number(m[1]), 0); alive = true; } catch (e: any) { alive = e?.code === "EPERM"; } }
    else {
      // legacy unnamed folders: remove when older than 10 minutes
      try { alive = Date.now() - fs.statSync(path.join(tmpRoot, name)).mtimeMs < 10 * 60_000; } catch { alive = true; }
    }
    if (!alive) try { fs.rmSync(path.join(tmpRoot, name), { recursive: true, force: true }); } catch { /* best effort */ }
  }
  const tmpProfile = fs.mkdtempSync(path.join(tmpRoot, `blueprint-snapshot-${process.pid}-`));
  app.setPath("userData", tmpProfile);
  const cleanup = () => { try { fs.rmSync(tmpProfile, { recursive: true, force: true }); } catch { /* best effort */ } };
  // Chromium writes Session Storage etc. into the profile while shutting down, after any in-process cleanup has run.
  // A tiny detached reaper waits for this process to be gone (any exit, even SIGKILL), then removes the folder.
  try {
    spawn("/bin/sh", ["-c", 'while kill -0 "$0" 2>/dev/null; do sleep 0.3; done; rm -rf "$1"', String(process.pid), tmpProfile], { detached: true, stdio: "ignore" }).unref();
  } catch { /* the sweep above catches it next run */ }
  const realExit = app.exit.bind(app);
  app.exit = (code?: number) => { cleanup(); realExit(code); };
  process.on("exit", cleanup);
  for (const sig of ["SIGTERM", "SIGINT", "SIGHUP"] as const) process.on(sig, () => { cleanup(); realExit(1); });
  app.on("will-quit", cleanup);
}

protocol.registerSchemesAsPrivileged([
  { scheme: "bp-asset", privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
  { scheme: "bp-frame", privileges: { standard: true, secure: true } },
]);

/** CSP for HTML visuals, sent as a header on bp-frame: documents: inline script/style only, no network of any kind. */
const FRAME_CSP = "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'";
const MAX_FRAME_BYTES = 600_000;

let failed = false;
/** Report on stderr and exit with a code. Never throws (a throw would surface an Electron error dialog). */
function fail(msg: string, code = 1): void {
  if (failed) return;
  failed = true;
  process.stderr.write(`blueprint snapshot: ${msg}\n`);
  app.exit(code);
}

let mainWindow: BrowserWindow | null = null;
let rendererReady = false;
let pendingOpen: VisualIds | null = HEADLESS && uiShotArg === undefined && uiTestArg === undefined ? null : parseIds(argValue(argv, "--open"));
let launchedForLink = pendingOpen !== null;

const idsPath = (ids: VisualIds) => `${ids.projectId}/${ids.systemId}/${ids.visualId}`;
let lastDelivered: string | null = null;
let opensDelivered = 0;

/**
 * Test probe: when BLUEPRINT_GUI_STATUS=1, the GUI writes `<store>/.gui-status.json` (pid, executable, window count,
 * last visual delivered to the renderer). Off by default; nothing else reads it.
 */
function writeStatus() {
  if (HEADLESS || process.env.BLUEPRINT_GUI_STATUS !== "1") return;
  try {
    const wins = BrowserWindow.getAllWindows();
    const body = { pid: process.pid, exe: process.execPath, windows: wins.length, visible: wins.filter((w) => w.isVisible()).length, lastOpen: lastDelivered, opens: opensDelivered, at: new Date().toISOString() };
    const f = path.join(store.ROOT, ".gui-status.json");
    fs.writeFileSync(f + ".tmp", JSON.stringify(body) + "\n");
    fs.renameSync(f + ".tmp", f);
  } catch { /* probe only */ }
}

function sendOpen(ids: VisualIds) {
  if (mainWindow && rendererReady) {
    mainWindow.webContents.send("open-path", ids);
    lastDelivered = idsPath(ids);
    opensDelivered++;
    writeStatus();
  } else pendingOpen = ids;
}

/** Bring the GUI window back (create it if the app is running with none). `focus` only for user activation. */
function surface(focus: boolean) {
  if (!app.isReady()) return;
  if (QUIET) focus = false;
  if (!mainWindow) { if (!focus) launchedForLink = true; createMainWindow(); }
  else if (focus) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.show(); }
  else if (!mainWindow.isVisible()) mainWindow.showInactive();
  if (focus) app.focus({ steal: true });
}
/** Test mode (BLUEPRINT_GUI_STATUS=1): the GUI never takes focus, so automated LaunchServices tests stay in the background. */
const QUIET = process.env.BLUEPRINT_GUI_STATUS === "1";
const ACTIVATE = !HEADLESS && !QUIET && has("--activate");

if (!HEADLESS && QUIET) {
  // Test mode gets its own profile (and so its own single-instance lock), so a test GUI can never hand its
  // arguments to a Blueprint the user has open.
  app.setPath("userData", path.join(store.ROOT, ".gui-profile"));
}

if (!HEADLESS) {
  app.on("will-finish-launching", () => {
    app.on("open-url", (event, url) => {
      event.preventDefault();
      const ids = parseDeepLink(url);
      if (!ids) return;
      if (!mainWindow) launchedForLink = true;
      sendOpen(ids);
      surface(false);
    });
  });
  if (!app.requestSingleInstanceLock()) {
    // Another GUI owns the lock; Electron has already forwarded our argv to it as `second-instance`.
    app.exit(0);
  } else {
    app.on("second-instance", (_e, args) => {
      const ids = parseIds(argValue(args, "--open")) ?? parseDeepLink(args.find((a) => a.startsWith("blueprint://")) ?? "");
      if (ids) sendOpen(ids);
      surface(!ids || args.includes("--activate"));
      writeStatus();
    });
  }
  // Only the GUI claims blueprint:// links (headless modes never call this).
  if (app.isPackaged && process.env.BLUEPRINT_GUI_STATUS !== "1") app.setAsDefaultProtocolClient("blueprint");
}

/**
 * Headless processes (`--mcp`, `--snapshot`, `--connect`) share the GUI's bundle id, and macOS registers them with
 * LaunchServices before any JS runs. So while one is alive, a Dock click, Finder open, `open -a Blueprint` or a
 * blueprint:// link can be delivered to it instead of starting the GUI. Forward every such request to the real GUI:
 * start it from this same executable (detached, so it outlives this process and the AI session that started it;
 * stdio ignored, so `--mcp` stdout stays protocol-only). The GUI's single-instance lock dedupes: if a GUI is already
 * running, the new one hands over its argv via `second-instance` and exits.
 */
let lastForward = 0;
function forwardToGui(extra: string[]) {
  const now = Date.now();
  if (now - lastForward < 750) return;
  lastForward = now;
  try {
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    const args = [...(app.isPackaged ? [] : [app.getAppPath()]), ...extra];
    const child = spawn(process.execPath, args, { detached: true, stdio: "ignore", env, cwd: os.homedir() });
    child.on("error", (e) => process.stderr.write(`blueprint: could not start the app window: ${e.message}\n`));
    child.unref();
    process.stderr.write(`blueprint: forwarded ${extra.join(" ") || "launch"} to the app window process\n`);
  } catch (e: any) {
    process.stderr.write(`blueprint: could not start the app window: ${String(e?.message ?? e)}\n`);
  }
}
if (HEADLESS && (CLI || SNAPSHOT)) {
  app.on("will-finish-launching", () => {
    app.on("open-url", (event, url) => {
      event.preventDefault();
      const ids = parseDeepLink(url);
      forwardToGui(ids ? [`--open=${idsPath(ids)}`] : ["--activate"]); // one token: Chromium may reorder argv
    });
    app.on("open-file", (event) => {
      event.preventDefault();
      forwardToGui(["--activate"]);
    });
  });
  // macOS "reopen" (Dock click, `open -a`, Finder double-click on a running app).
  app.on("activate", () => forwardToGui(["--activate"]));
}

const rendererIndex = path.join(__dirname, "..", "dist", "index.html");
const preload = path.join(__dirname, "preload.js");

/** Apply the no-network policy to a session: dead proxy (loopback included), request blocking, no permissions. */
async function isolateSession(ses: Electron.Session) {
  ses.webRequest.onBeforeRequest(
    { urls: ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*", "ftp://*/*"] },
    (_d, cb) => cb({ cancel: true }),
  );
  ses.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
  ses.setPermissionCheckHandler(() => false);
  ses.setDevicePermissionHandler?.(() => false);
  ses.on("will-download", (e) => e.preventDefault());
  await ses.setProxy({ mode: "fixed_servers", proxyRules: "127.0.0.1:9", proxyBypassRules: "<-loopback>" });
}

function hardenContents(wc: Electron.WebContents) {
  wc.setWebRTCIPHandlingPolicy("disable_non_proxied_udp");
  wc.setWindowOpenHandler(({ url }) => {
    if (!HEADLESS && /^https:\/\//.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  wc.on("will-navigate", (e) => e.preventDefault());
  wc.on("will-attach-webview", (e) => e.preventDefault());
  if (!DEV) wc.on("devtools-opened", () => wc.closeDevTools());
}
app.on("web-contents-created", (_e, wc) => hardenContents(wc));
app.on("session-created", (ses) => void isolateSession(ses));

function registerAssetProtocol() {
  protocol.handle("bp-asset", (req) => {
    const u = new URL(req.url);
    const projectId = u.hostname;
    const file = decodeURIComponent(u.pathname.replace(/^\/+/, ""));
    let full: string | null = null;
    try {
      full = store.resolveAsset(projectId, file);
    } catch {
      full = null;
    }
    if (!full) return new Response("not found", { status: 404 });
    return net.fetch(pathToFileURL(full).toString());
  });
}

/** How AI tools should launch this binary as an MCP server. */
function mcpLaunch(): connectTools.Launch {
  return app.isPackaged ? { command: process.execPath, args: ["--mcp"] } : { command: process.execPath, args: [app.getAppPath(), "--mcp"] };
}
const promptedFlag = () => path.join(app.getPath("userData"), "connect-prompted");
const tildeHome = (p: string) => (p.startsWith(os.homedir()) ? "~" + p.slice(os.homedir().length) : p);

/** Serves an HTML visual's document (carried base64url-encoded in the URL) with a strict CSP header. Echo only: reads nothing. */
function registerFrameProtocol() {
  protocol.handle("bp-frame", (req) => {
    try {
      const h = new URL(req.url).searchParams.get("h") ?? "";
      if (h.length > MAX_FRAME_BYTES * 1.4) return new Response("too large", { status: 413 });
      const html = Buffer.from(h, "base64url").toString("utf8");
      return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "content-security-policy": FRAME_CSP, "x-content-type-options": "nosniff" } });
    } catch {
      return new Response("bad request", { status: 400 });
    }
  });
}

function registerIpc() {
  ipcMain.handle("root", () => tildeHome(store.ROOT));
  ipcMain.handle("connectState", () => ({
    firstRun: !HEADLESS && !fs.existsSync(promptedFlag()),
    tools: connectTools.tools(os.homedir()).map((t) => ({ id: t.id, name: t.name, detected: t.detected, evidence: t.evidence })),
  }));
  ipcMain.handle("connectDismiss", () => {
    try { fs.mkdirSync(path.dirname(promptedFlag()), { recursive: true }); fs.writeFileSync(promptedFlag(), new Date().toISOString() + "\n"); } catch { /* best effort */ }
    return true;
  });
  ipcMain.handle("connectRun", (_e, ids: unknown) => {
    if (HEADLESS) return { ok: false, lines: ["Not available in this mode."] };
    const picked = Array.isArray(ids) ? ids.filter((x): x is connectTools.ToolId => connectTools.TOOL_IDS.includes(x)) : [];
    if (!picked.length) return { ok: false, lines: ["Pick at least one tool."] };
    try {
      return connectTools.connect({ home: os.homedir(), launch: mcpLaunch(), tools: picked });
    } catch (e: any) {
      return { ok: false, lines: [String(e?.message ?? e).split(os.homedir()).join("~")] };
    }
  });
  ipcMain.handle("tree", () => store.tree());
  ipcMain.handle("readVisual", (_e, ids) => store.readVisual(ids));
  ipcMain.handle("saveVisual", (_e, ids, doc, baseRev) => {
    try {
      return store.saveVisual(ids, doc, baseRev);
    } catch (err) {
      return { ok: false, error: String(err).split(store.ROOT).join("<store>") };
    }
  });
  ipcMain.handle("readSystem", (_e, p, s) => store.readSystem(p, s));
  ipcMain.handle("updateSystem", (_e, p, s, patch) => store.updateSystem(p, s, patch));
  ipcMain.handle("updateProject", (_e, p, patch) => store.updateProject(p, patch));
  ipcMain.handle("createProject", (_e, title) => store.createProject(title));
  ipcMain.handle("createSystem", (_e, p, title) => store.createSystem(p, title));
  ipcMain.handle("createVisual", (_e, p, s, title) => store.createVisual(p, s, title));
  ipcMain.handle("renameVisual", (_e, ids, title) => store.renameVisual(ids, title));
  ipcMain.handle("remove", (_e, kind, ids) => store.remove(kind, ids));
  ipcMain.handle("reorder", (_e, kind, ids, dir) => store.reorder(kind, ids, dir));
  ipcMain.handle("search", (_e, q) => store.search(q));
  ipcMain.on("renderer-ready", () => {
    rendererReady = true;
    if (pendingOpen && mainWindow) {
      const ids = pendingOpen;
      pendingOpen = null;
      sendOpen(ids);
    }
    writeStatus();
  });
}

function startWatcher(win: BrowserWindow) {
  let timer: NodeJS.Timeout | null = null;
  const changed = new Set<string>();
  const w = watch(store.PROJECTS, {
    ignoreInitial: true,
    ignored: (p: string) => p.endsWith(".tmp"),
  });
  w.on("all", (_evt, p) => {
    changed.add(p);
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      if (!win.isDestroyed()) win.webContents.send("store-changed", [...changed]);
      changed.clear();
    }, 120);
  });
  win.on("closed", () => void w.close());
}

function buildMenu() {
  const send = (ch: string) => () => mainWindow?.webContents.send(ch);
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: "about" },
        { type: "separator" },
        { label: "Connect AI tools…", click: send("menu-connect") },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" }, { role: "hideOthers" }, { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { label: "Undo", accelerator: "CmdOrCtrl+Z", click: send("menu-undo") },
        { label: "Redo", accelerator: "Shift+CmdOrCtrl+Z", click: send("menu-redo") },
        { type: "separator" },
        { role: "cut" }, { role: "copy" }, { role: "paste" }, { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { label: "Search…", accelerator: "CmdOrCtrl+K", click: send("menu-search") },
        { type: "separator" },
        ...(DEV ? ([{ role: "reload" }, { role: "toggleDevTools" }, { type: "separator" }] as Electron.MenuItemConstructorOptions[]) : []),
        { role: "resetZoom" }, { role: "zoomIn" }, { role: "zoomOut" }, { type: "separator" }, { role: "togglefullscreen" },
      ],
    },
    { role: "windowMenu" },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 560,
    show: false,
    title: "Blueprint",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#111113" : "#fafafa",
    webPreferences: { preload, contextIsolation: true, nodeIntegration: false, sandbox: true, devTools: DEV, webSecurity: true },
  });
  mainWindow = win;
  win.once("ready-to-show", () => {
    // Opened by a deep link / --open (e.g. from the MCP server's `open -g`): appear without stealing focus.
    if ((launchedForLink && !ACTIVATE) || QUIET) win.showInactive();
    else { win.show(); if (ACTIVATE) app.focus({ steal: true }); }
    writeStatus();
  });
  win.on("closed", () => {
    mainWindow = null;
    rendererReady = false;
    writeStatus();
  });
  void win.loadFile(rendererIndex);
  startWatcher(win);
}

// ---------- snapshot ----------
function runSnapshot() {
  const ids = parseIds(snapshotArg);
  const out = argValue(argv, "--out");
  const width = Math.max(400, Math.min(6000, Number(argValue(argv, "--width") ?? 1800) || 1800));
  const theme = argValue(argv, "--theme") === "dark" ? "dark" : "light";
  if (!ids) return fail(`--snapshot needs <projectId>/<systemId>/<visualId>, got ${JSON.stringify(snapshotArg)}`, 2);
  if (!out) return fail("--out <file.png> is required", 2);
  let doc;
  try {
    doc = store.readVisual(ids);
  } catch (e) {
    return fail(String(e).split(store.ROOT).join("<store>"), 2);
  }
  if (!doc) return fail(`visual not found: ${ids.projectId}/${ids.systemId}/${ids.visualId}`, 3);

  const timeout = setTimeout(() => fail("timed out after 30s waiting for render", 4), 30_000);
  const win = new BrowserWindow({
    width,
    height: Math.round(width * 0.625),
    show: false,
    focusable: false,
    skipTaskbar: true,
    paintWhenInitiallyHidden: true,
    enableLargerThanScreen: true,
    backgroundColor: theme === "dark" ? "#111113" : "#ffffff",
    webPreferences: { preload, contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false, offscreen: { deviceScaleFactor: SCALE } },
  });
  if (process.env.BLUEPRINT_DEBUG) {
    win.webContents.on("console-message", (e) => process.stderr.write(`[renderer] ${e.message}\n`));
    win.webContents.on("did-finish-load", () => process.stderr.write("[main] did-finish-load\n"));
    win.webContents.on("render-process-gone", (_e, d) => process.stderr.write(`[main] renderer gone ${d.reason}\n`));
  }
  ipcMain.on("snapshot-ready", (_e, info: { aspect: number }) => {
    const aspect = Math.max(0.3, Math.min(2.5, info?.aspect || 0.625));
    win.setContentSize(width, Math.round(width * aspect), false);
    setTimeout(() => win.webContents.send("snapshot-fit"), 60);
  });
  ipcMain.on("snapshot-rendered", async () => {
    try {
      const img = await win.webContents.capturePage();
      fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
      fs.writeFileSync(path.resolve(out), img.toPNG());
      clearTimeout(timeout);
      const { width: w, height: h } = img.getSize();
      process.stdout.write(`${path.resolve(out)} ${w}x${h}\n`);
      app.exit(0);
    } catch (e) {
      fail(`capture failed: ${String(e)}`, 5);
    }
  });
  ipcMain.on("snapshot-error", (_e, msg: string) => fail(msg, 5));
  const q = new URLSearchParams({ snapshot: `${ids.projectId}/${ids.systemId}/${ids.visualId}`, theme });
  void win.loadFile(rendererIndex, { search: q.toString() });
}

// ---------- headless CLI modes ----------
function runCli(): Promise<number> | number {
  if (MCP) {
    // Serve MCP over stdio from this binary: no window, no Dock icon, no dialogs; logs go to stderr.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { runStdio } = require("./mcp-server.js") as typeof import("../../mcp/src/server");
    const exe = process.execPath;
    const appArgs = app.isPackaged ? [] : [app.getAppPath()];
    return runStdio({ app: { bin: exe, args: appArgs } }).then(() => 0);
  }
  const tools = connectTools.parseTools(argv);
  if (typeof tools === "string") { process.stderr.write(`blueprint: ${tools}\n`); return 2; }
  const opts = { home: os.homedir(), launch: mcpLaunch(), tools, dryRun: has("--dry-run") };
  const r = CONNECT ? connectTools.connect(opts) : connectTools.disconnect(opts);
  process.stdout.write(r.lines.join("\n") + "\n");
  return r.ok ? 0 : 1;
}

if (CLI) {
  if (CONNECT && DISCONNECT) { process.stderr.write("blueprint: use --connect or --disconnect, not both\n"); process.exit(2); }
  Promise.resolve()
    .then(runCli)
    .then((code) => app.exit(code), (e) => { process.stderr.write(`blueprint: ${String(e?.message ?? e)}\n`); app.exit(1); });
}

app.whenReady().then(async () => {
  if (CLI) return;
  store.ensureRoot();
  await isolateSession(session.defaultSession);
  registerAssetProtocol();
  registerFrameProtocol();
  registerIpc();
  if (SNAPSHOT) {
    runSnapshot();
    return;
  }
  if (uiShotArg !== undefined) {
    runUiShot(uiShotArg);
    return;
  }
  if (uiTestArg !== undefined) {
    runUiTest(uiTestArg);
    return;
  }
  app.setName("Blueprint");
  // Info.plist sets LSUIElement so snapshot runs never show a Dock icon; a normal launch becomes a regular app.
  app.setActivationPolicy("regular");
  buildMenu();
  createMainWindow();
  app.on("activate", () => surface(true));
});

function runUiShot(out: string) {
  const delay = Number(argValue(argv, "--delay") ?? 2500) || 2500;
  const theme = argValue(argv, "--theme") === "dark" ? "dark" : "light";
  const select = argValue(argv, "--select") ?? "";
  const win = new BrowserWindow({
    width: 1440, height: 900, show: false, focusable: false, skipTaskbar: true, paintWhenInitiallyHidden: true,
    webPreferences: { preload, contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false, offscreen: { deviceScaleFactor: SCALE } },
  });
  mainWindow = win;
  if (process.env.BLUEPRINT_DEBUG) win.webContents.on("console-message", (e) => process.stderr.write(`[renderer] ${e.message}\n`));
  const evalFile = argValue(argv, "--ui-eval");
  win.webContents.on("did-finish-load", () => {
    if (evalFile) {
      setTimeout(() => {
        win.webContents.executeJavaScript(fs.readFileSync(evalFile, "utf8")).then(
          (r) => process.stdout.write(`ui-eval: ${JSON.stringify(r)}\n`),
          (e) => process.stderr.write(`ui-eval error: ${String(e)}\n`),
        );
      }, Math.round(delay / 2));
    }
    setTimeout(async () => {
      try {
        const img = await win.webContents.capturePage();
        fs.writeFileSync(path.resolve(out), img.toPNG());
        process.stdout.write(`${path.resolve(out)}\n`);
        app.exit(0);
      } catch (e) {
        fail(`ui capture failed: ${String(e)}`, 5);
      }
    }, delay);
  });
  const q = new URLSearchParams({ uitest: "1", theme, select });
  void win.loadFile(rendererIndex, { search: q.toString() });
  startWatcher(win);
}

function runUiTest(driverPath: string) {
  const win = new BrowserWindow({
    width: 1440, height: 900, show: false, focusable: false, skipTaskbar: true, paintWhenInitiallyHidden: true,
    webPreferences: { preload, contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false, offscreen: { deviceScaleFactor: SCALE } },
  });
  mainWindow = win;
  win.webContents.on("console-message", (e) => { if (process.env.BLUEPRINT_DEBUG || e.level === "error") process.stderr.write(`[renderer] ${e.message}\n`); });
  win.webContents.once("did-finish-load", async () => {
    rendererReady = true;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const driver = require(path.resolve(driverPath));
      const code = await driver({ win, store, fs, path });
      app.exit(typeof code === "number" ? code : 1);
    } catch (e: any) {
      process.stderr.write(`ui-test crashed: ${e?.stack ?? e}\n`);
      app.exit(2);
    }
  });
  const q = new URLSearchParams({ uitest: "1", theme: "light", select: "" });
  void win.loadFile(rendererIndex, { search: q.toString() });
  startWatcher(win);
}

app.on("window-all-closed", () => {
  if (HEADLESS) return;
  app.quit();
});
