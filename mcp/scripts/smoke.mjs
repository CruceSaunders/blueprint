// Scripted MCP client run over stdio against a throwaway BLUEPRINT_HOME. Exits 0 only if every check passes.
// Usage: BLUEPRINT_APP_BIN=<app binary> node scripts/smoke.mjs   (runs node dist/index.js; snapshots use that binary)
//        node scripts/smoke.mjs --cmd <binary> [args]  (e.g. --cmd /path/Blueprint.app/Contents/MacOS/Blueprint --mcp)
// The app used for snapshots must be named explicitly: the smoke test never falls back to an installed
// /Applications/Blueprint.app, which may be a different version.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(here, "../dist");
const { sizeOf } = await import(pathToFileURL(path.join(dist, "layout.js")).href);

const ci = process.argv.indexOf("--cmd");
const [command, ...cmdArgs] = ci >= 0 ? process.argv.slice(ci + 1) : [process.execPath, path.join(dist, "index.js")];
if (ci < 0 && !process.env.BLUEPRINT_APP_BIN) {
  console.error("smoke: name the app to test. Either --cmd <path/to/Blueprint.app/Contents/MacOS/Blueprint> --mcp,\n" +
    "       or BLUEPRINT_APP_BIN=<that binary> to run node dist/index.js with snapshots from it.\n" +
    "       (No implicit fallback to an installed /Applications/Blueprint.app.)");
  process.exit(2);
}
if (ci >= 0 && !fs.existsSync(command)) { console.error(`smoke: no binary at ${command}`); process.exit(2); }
if (process.env.BLUEPRINT_APP_BIN && !fs.existsSync(process.env.BLUEPRINT_APP_BIN)) { console.error(`smoke: BLUEPRINT_APP_BIN does not exist: ${process.env.BLUEPRINT_APP_BIN}`); process.exit(2); }
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), "blueprint-smoke-"));
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "blueprint-smoke-src-"));
console.log(`server: ${[command, ...cmdArgs].join(" ")}\nstore: ${HOME}`);
const env = { ...process.env, BLUEPRINT_HOME: HOME };
delete env.ELECTRON_RUN_AS_NODE;
let stderrBytes = 0;
const transport = new StdioClientTransport({ command, args: cmdArgs, env, stderr: "pipe" });
transport.stderr?.on("data", (d) => { stderrBytes += d.length; if (process.env.SMOKE_VERBOSE) process.stderr.write(d); });
const client = new Client({ name: "smoke", version: "1" });
await client.connect(transport);
let failed = 0, step = 0;
const ok = (c, m) => { step++; if (c) console.log(`ok   ${step}. ${m}`); else { failed++; console.log(`FAIL ${step}. ${m}`); } };
const call = async (name, args = {}) => {
  const r = await client.callTool({ name, arguments: args });
  const t = r.content.find((c) => c.type === "text")?.text;
  return { r, t, j: (() => { try { return JSON.parse(t); } catch { return null; } })() };
};
let pid;
try {
  const tools = (await client.listTools()).tools.map((t) => t.name);
  const want = "guide list_projects create_project update_project delete_project list_systems create_system update_system delete_system list_visuals create_visual update_visual get_visual delete_visual apply add_asset snapshot open search".split(" ");
  ok(want.every((w) => tools.includes(w)), `all ${want.length} tools registered (${want.filter((w) => !tools.includes(w)).join(",") || "none missing"})`);

  const g = await call("guide");
  ok(g.t.includes("Design philosophy") && g.t.includes("blocks") && g.t.includes("add_node"), "guide returns philosophy + vocabulary + example");
  const instr = client.getInstructions?.() ?? "";
  ok(instr.length > 100 && instr.length < 2000 && /guide/.test(instr), `server instructions present and short (${instr.length} chars)`);
  const topics = [...(g.t.split("## Topics")[1] ?? "").matchAll(/^- `([a-z0-9-]+)`:/gm)].map((m) => m[1]);
  ok(topics.length >= 1 && g.t.includes("## Topics"), `guide() lists ${topics.length} topic(s): ${topics.join(", ")}`);
  let topicsOk = true;
  for (const t of topics) { const r = await call("guide", { topic: t }); if (r.r.isError || !r.t.startsWith(`# Topic: ${t}`) || r.t.length < 200) topicsOk = false; }
  ok(topicsOk, "guide({topic}) returns each topic body");
  const unk = await call("guide", { topic: "nope" });
  ok(unk.r.isError && unk.t.includes("Valid topics") && topics.every((t) => unk.t.includes(t)), "unknown topic lists the valid ones");

  const p = await call("create_project", { title: "_smoke-test", description: "temporary" });
  pid = p.j.projectId; ok(!!pid, `create_project -> ${pid}`);
  const s = await call("create_system", { projectId: pid, title: "Smoke system", summary: "s" });
  const sid = s.j.systemId; ok(!!sid, `create_system -> ${sid}`);
  const v = await call("create_visual", { projectId: pid, systemId: sid, title: "Smoke visual", primary: true });
  const vid = v.j.visualId; ok(!!vid, `create_visual -> ${vid}`);
  const ids = { projectId: pid, systemId: sid, visualId: vid };

  const asset = await call("add_asset", { projectId: pid, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="18" fill="#4f46e5"/></svg>', filename: "dot.svg" });
  ok(asset.j?.asset === "dot.svg", "add_asset wrote dot.svg");

  // ---- add_asset fromPath hardening
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  fs.writeFileSync(path.join(scratch, "ok.png"), png);
  const good = await call("add_asset", { projectId: pid, fromPath: path.join(scratch, "ok.png") });
  ok(good.j?.asset === "ok.png", "add_asset fromPath: real PNG accepted");
  const noLeak = (r) => !r.t.includes(scratch) && !r.t.includes(os.homedir()) && !r.t.includes(HOME);
  fs.mkdirSync(path.join(scratch, ".ssh")); fs.writeFileSync(path.join(scratch, ".ssh/id_ed25519.png"), png);
  const dot = await call("add_asset", { projectId: pid, fromPath: path.join(scratch, ".ssh/id_ed25519.png") });
  ok(dot.r.isError && /hidden \(dot\)/.test(dot.t) && noLeak(dot), "add_asset refuses a source inside a dot-directory (~/.ssh style)");
  const zero = await call("add_asset", { projectId: pid, fromPath: "/dev/zero", filename: "z.png" });
  ok(zero.r.isError && /not a regular file/.test(zero.t), "add_asset refuses /dev/zero");
  const fifo = path.join(scratch, "pipe.png");
  (await import("node:child_process")).execFileSync("/usr/bin/mkfifo", [fifo]);
  const ff = await call("add_asset", { projectId: pid, fromPath: fifo });
  ok(ff.r.isError && /not a regular file/.test(ff.t), "add_asset refuses a FIFO (no hang)");
  fs.symlinkSync(path.join(scratch, "ok.png"), path.join(scratch, "link.png"));
  const ln = await call("add_asset", { projectId: pid, fromPath: path.join(scratch, "link.png") });
  ok(ln.r.isError && /symbolic link/.test(ln.t), "add_asset refuses a symlinked source");
  fs.writeFileSync(path.join(scratch, "fake.png"), "#!/bin/sh\necho not an image\n");
  const fake = await call("add_asset", { projectId: pid, fromPath: path.join(scratch, "fake.png") });
  ok(fake.r.isError && /not a PNG/.test(fake.t), "add_asset refuses content that is not an image");
  const mism = await call("add_asset", { projectId: pid, base64: png.toString("base64"), filename: "x.jpg" });
  ok(mism.r.isError && /is PNG but/.test(mism.t), "add_asset refuses PNG bytes named .jpg");
  fs.writeFileSync(path.join(scratch, "big.png"), Buffer.concat([png, Buffer.alloc(11 * 1024 * 1024)]));
  const big = await call("add_asset", { projectId: pid, fromPath: path.join(scratch, "big.png") });
  ok(big.r.isError && /larger than/.test(big.t), "add_asset refuses files over the size cap");
  const sty = await call("add_asset", { projectId: pid, svg: '<svg xmlns="http://www.w3.org/2000/svg"><style>*{display:none}</style></svg>', filename: "s.svg" });
  ok(sty.r.isError && /<style>/.test(sty.t), "add_asset refuses SVG with <style>");
  const rel = await call("add_asset", { projectId: pid, fromPath: "ok.png" });
  ok(rel.r.isError && /absolute path/.test(rel.t), "add_asset requires an absolute fromPath");

  const E = (t) => `Explains ${t}: smoke-test text, zebrafish marker.`.replace("zebrafish marker", t === "alpha" ? "quokka detail" : "plain");
  const nodes = [
    { id: "g-outer", kind: "group", groupKind: "layer", title: "Outer layer", explanation: "Outer tier." },
    { id: "g-inner", kind: "group", groupKind: "option", parent: "g-outer", title: "Inner option", explanation: "Nested option group." },
    { id: "alpha", kind: "card", parent: "g-inner", title: "Alpha", subtitle: "first", icon: "brain", explanation: E("alpha") },
    { id: "beta", kind: "card", parent: "g-inner", title: "Beta", state: "question", explanation: E("beta") },
    { id: "gamma", kind: "card", parent: "g-outer", title: "Gamma", tone: "good", explanation: E("gamma") },
    { id: "plus", kind: "operator", operator: "×", explanation: "Multiplication of inputs." },
    { id: "pic", kind: "visual", title: "Sketch", svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60"><rect width="100" height="60" fill="#eef"/><path d="M5 50 L50 10 L95 50" stroke="#336" fill="none"/></svg>', explanation: "A drawn mountain." },
    { id: "photo", kind: "image", asset: "dot.svg", caption: "dot", explanation: "An image from assets." },
    { id: "sticky", kind: "note", title: "Remember", explanation: "Free sticky note." },
    { id: "delta", kind: "card", title: "Delta", explanation: E("delta") },
  ];
  const kinds = ["flow", "increases", "decreases", "requires", "becomes", "equals", "versus", "blocks", "relates"];
  const pairs = [["alpha", "beta"], ["beta", "gamma"], ["gamma", "plus"], ["plus", "delta"], ["delta", "pic"], ["pic", "photo"], ["photo", "sticky"], ["alpha", "gamma"], ["delta", "alpha"]];
  const edges = kinds.map((k, i) => ({ id: `e-${k}`, source: pairs[i][0], target: pairs[i][1], kind: k, explanation: `Edge of kind ${k}.`, ...(k === "flow" ? { both: true } : {}) }));
  const ops = [...nodes.map((node) => ({ op: "add_node", node })), ...edges.map((edge) => ({ op: "add_edge", edge }))];
  const ap = await call("apply", { ...ids, ops, layout: { direction: "RIGHT" } });
  ok(ap.j?.ok === true && ap.j.rev === 2, `apply ok, rev=${ap.j?.rev} (${ap.j?.summary ?? ap.t})`);
  ok(ap.j?.boxes && ap.j.boxes.alpha?.length === 4 && Array.isArray(ap.j.warnings), "apply returns absolute boxes and a warnings array");
  ok(!(ap.j?.warnings ?? []).some((w) => /^(overlap|edge-crossing|clipped-text|outside-frame)/.test(w)), `no layout warnings (${(ap.j?.warnings ?? []).join(" | ") || "none"})`);

  const gv = (await call("get_visual", ids)).j;
  ok(gv.nodes.length === 10 && gv.nodes.every((n) => n.position && Number.isFinite(n.position.x) && Number.isFinite(n.position.y)), "get_visual: all 10 nodes have a position");
  ok(new Set(gv.nodes.map((n) => n.kind)).size === 6, "six node kinds present");
  ok(new Set(gv.edges.map((e) => e.kind)).size === 9, "nine edge kinds present");
  ok(gv.edges.every((e) => Array.isArray(e.route) && e.route.length >= 2), "every edge has a computed route");
  ok(gv.boxes && gv.boxes["g-outer"] && Array.isArray(gv.warnings), "get_visual returns boxes + warnings");
  const byId = new Map(gv.nodes.map((n) => [n.id, n]));
  ok(byId.get("g-inner").parent === "g-outer" && byId.get("alpha").parent === "g-inner" && byId.get("g-inner").size && byId.get("g-outer").size, "nested group kept, group sizes set");
  // overlap check among non-group siblings (same parent)
  let overlaps = [];
  const sib = new Map();
  for (const n of gv.nodes) if (n.kind !== "group") (sib.get(n.parent ?? "") ?? sib.set(n.parent ?? "", []).get(n.parent ?? "")).push(n);
  for (const [, list] of sib) for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j], sa = sizeOf(a), sb = sizeOf(b);
    if (a.position.x < b.position.x + sb.w && b.position.x < a.position.x + sa.w && a.position.y < b.position.y + sb.h && b.position.y < a.position.y + sa.h) overlaps.push(`${a.id}/${b.id}`);
  }
  ok(overlaps.length === 0, `no overlapping non-group siblings (${overlaps.join(",") || "0 overlaps"})`);
  // children fit inside their group
  const inside = gv.nodes.filter((n) => n.parent).every((n) => { const p = byId.get(n.parent), z = sizeOf(n); return n.position.x >= 0 && n.position.y >= 0 && n.position.x + z.w <= p.size.w && n.position.y + z.h <= p.size.h; });
  ok(inside, "children lie inside their parent group frame");

  // hand-placed nodes keep position; new node placed clear of them
  const before = byId.get("alpha").position;
  const ap2 = await call("apply", { ...ids, ops: [{ op: "add_node", node: { id: "late", kind: "card", title: "Late", explanation: "Added later without a position." } }] });
  const gv2 = (await call("get_visual", ids)).j;
  const late = gv2.nodes.find((n) => n.id === "late"), alpha2 = gv2.nodes.find((n) => n.id === "alpha");
  ok(ap2.j?.ok && late.position && alpha2.position.x === before.x && alpha2.position.y === before.y, "incremental add: existing positions unchanged, new node positioned");

  // invalid apply
  const revBefore = (await call("get_visual", ids)).j.rev;
  const bad = await call("apply", { ...ids, ops: [
    { op: "add_node", node: { id: "ok-one", kind: "card", title: "Fine", explanation: "fine" } },
    { op: "add_node", node: { id: "weird", kind: "hexagon", title: "Bad kind", explanation: "x" } },
    { op: "add_node", node: { id: "silent", kind: "card", title: "No explanation" } },
    { op: "add_edge", edge: { id: "dangle", source: "alpha", target: "nowhere", kind: "flow", explanation: "to nothing" } },
  ] });
  console.log("---- rejection text ----\n" + bad.t + "\n------------------------");
  ok(bad.r.isError === true, "invalid apply flagged isError");
  ok(/unknown node kind 'hexagon'/.test(bad.t), "error names unknown kind");
  ok(/'silent'.*missing required `explanation`/.test(bad.t), "error names missing explanation");
  ok(/ops\[3\] edge 'dangle': dangling target 'nowhere'/.test(bad.t), "dangling-edge error carries its ops[n] index");
  ok(!/Valid node ids:[^\n]*ok-one/.test(bad.t), "valid-id list excludes ids from the rejected batch");
  const badPos = await call("apply", { ...ids, ops: [{ op: "add_node", node: { id: "snake_case-ok", kind: "card", title: "P", explanation: "p", position: { x: "10" } } }] });
  ok(badPos.r.isError && /`position` must be \{"x": number, "y": number\}/.test(badPos.t) && !/invalid node id/.test(badPos.t), "bad position gets a human message; underscore id accepted");
  const gv3 = (await call("get_visual", ids)).j;
  ok(gv3.rev === revBefore && !gv3.nodes.some((n) => n.id === "ok-one"), `rejected atomically; rev unchanged (${revBefore})`);

  // ---- visual v2: shapes, art on the part, arrangements, tidiness, illustration warning
  const v2 = (await call("create_visual", { projectId: pid, systemId: sid, title: "Ring visual" })).j.visualId;
  const ids2 = { projectId: pid, systemId: sid, visualId: v2 };
  const ringOps = ["a", "b", "c", "d"].flatMap((x, i, all) => [
    { op: "add_node", node: { id: x, kind: "card", shape: i % 2 ? "circle" : "pill", title: x.toUpperCase(), explanation: `Step ${x}.` } },
    { op: "add_edge", edge: { id: `e-${x}`, source: x, target: all[(i + 1) % all.length], kind: "flow", explanation: "next" } }]);
  ringOps.push({ op: "add_node", node: { id: "art-card", kind: "card", title: "Drawn", art: { svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>', size: "sm" }, explanation: "Has art." } });
  const ring = await call("apply", { ...ids2, ops: ringOps, layout: { arrangement: "ring" } });
  ok(ring.j?.ok && ring.j.tidiness && Array.isArray(ring.j.tidiness.defects), `apply returns tidiness (${ring.j?.tidiness?.defects.length} defects)`);
  const gv4 = (await call("get_visual", ids2)).j;
  ok(gv4.arrangement === "ring" && gv4.nodes.find((n) => n.id === "art-card").art.size === "sm" && gv4.tidiness, "arrangement persisted on the visual; art kept; get_visual returns tidiness");
  ok(gv4.edges.filter((e) => ["e-a", "e-b"].includes(e.id)).every((e) => e.route.length > 4), "ring steps between offset members are drawn as curves");
  const badArt = await call("apply", { ...ids2, ops: [{ op: "add_node", node: { id: "x1", kind: "note", title: "n", art: { svg: "<svg/>" }, explanation: "x" } }, { op: "add_node", node: { id: "x2", kind: "card", title: "c", art: { svg: "<svg/>", html: "<b>" }, explanation: "x" } }, { op: "add_node", node: { id: "x3", kind: "card", shape: "hexagon", explanation: "x" } }] });
  ok(badArt.r.isError && /`art` only applies to kind 'card'/.test(badArt.t) && /exactly one of svg, html or asset/.test(badArt.t) && /`shape` must be one of/.test(badArt.t), "bad art/shape rejected with fixable messages");
  const ill = await call("apply", { ...ids2, ops: [{ op: "add_node", node: { id: "pic2", kind: "visual", svg: "<svg/>", title: "Picture", explanation: "x" } }, { op: "add_edge", edge: { id: "ill", source: "pic2", target: "a", kind: "relates", label: "illustrates", explanation: "x" } }] });
  ok(ill.j?.warnings.some((w) => /^illustration-node: 'pic2'/.test(w)), "a drawing joined to one card by relates is flagged (art belongs on the part)");

  // ---- tidiness rules: tiers share columns, rows share heights, rings are true and their labels on the arc
  ok(!ring.j.tidiness.defects.some((d) => /^ring-/.test(d)), "an auto-laid ring has no ring-off-arc / ring-unequal-angles defects");
  const v3 = (await call("create_visual", { projectId: pid, systemId: sid, title: "Tiers" })).j.visualId;
  const ids3 = { projectId: pid, systemId: sid, visualId: v3 };
  const tierOps = (pos) => [
    { op: "add_node", node: { id: "t1", kind: "group", groupKind: "layer", title: "Top", explanation: "x", ...(pos ? { position: { x: 0, y: 0 } } : {}) } },
    { op: "add_node", node: { id: "t2", kind: "group", groupKind: "layer", title: "Bottom", explanation: "x", ...(pos ? { position: { x: 0, y: 300 } } : {}) } },
    ...["a", "b", "c"].map((x, i) => ({ op: "add_node", node: { id: `u${x}`, kind: "card", parent: "t1", title: `Up ${x}`, ...(i === 1 ? { subtitle: "a much longer subtitle that wraps onto two lines" } : {}), explanation: "x", ...(pos ? { position: { x: 24 + i * 272, y: i === 1 ? 28 : 48 } } : {}) } })),
    ...["a", "b", "c"].map((x, i) => ({ op: "add_node", node: { id: `d${x}`, kind: "card", shape: "pill", parent: "t2", title: `Down ${x}`, explanation: "x", ...(pos ? { position: { x: 60 + i * 200, y: 48 } } : {}) } })),
    { op: "add_edge", edge: { id: "tt", source: "t1", target: "t2", kind: "flow", explanation: "x" } }];
  const tiersAuto = await call("apply", { ...ids3, ops: tierOps(false) });
  ok(tiersAuto.j?.ok && !tiersAuto.j.tidiness.defects.some((d) => /^row-/.test(d)), `auto layout: tier rows share columns and heights (${tiersAuto.j?.tidiness?.defects.join(" | ") || "0 defects"})`);
  const v4 = (await call("create_visual", { projectId: pid, systemId: sid, title: "Tiers by hand" })).j.visualId;
  const tiersHand = await call("apply", { projectId: pid, systemId: sid, visualId: v4, ops: tierOps(true) });
  const hd = tiersHand.j?.tidiness?.defects ?? [];
  ok(hd.some((d) => /^row-misaligned: .*'t2'/.test(d)) && hd.some((d) => /^row-uneven-height: .*'t1'/.test(d)), `hand-placed tiers off the column grid / with uneven heights are flagged (${hd.join(" | ")})`);
  const v5 = (await call("create_visual", { projectId: pid, systemId: sid, title: "Ring by hand" })).j.visualId;
  const at = [[0, -200], [260, 0], [0, 230], [-200, 40]];
  const ids5 = { projectId: pid, systemId: sid, visualId: v5 };
  await call("apply", { ...ids5, layout: { arrangement: "ring" }, ops: ["p", "q", "r", "s"].flatMap((x, i, all) => [
    { op: "add_node", node: { id: x, kind: "card", shape: "pill", title: x, explanation: "x" } },
    { op: "add_edge", edge: { id: `r-${x}`, source: x, target: all[(i + 1) % 4], kind: "flow", explanation: "x" } }]) });
  const ringHand = await call("apply", { ...ids5, ops: ["p", "q", "r", "s"].map((x, i) => ({ op: "update_node", id: x, patch: { position: { x: at[i][0], y: at[i][1] } } })) });
  const rd = ringHand.j?.tidiness?.defects ?? [];
  ok(rd.some((d) => /^ring-off-arc:/.test(d)) || rd.some((d) => /^ring-unequal-angles:/.test(d)), `a lopsided hand-placed ring is flagged (${rd.filter((d) => /^ring-/.test(d)).length} ring defects)`);

  const sr = await call("search", { query: "quokka" });
  ok(sr.j.hits.some((h) => h.type === "node" && h.nodeId === "alpha" && h.field === "explanation"), "search finds node by a word in its explanation");

  const lp = (await call("list_projects")).j;
  ok(lp.some((x) => x.id === pid), "list_projects shows it");
  const noconf = await call("delete_project", { projectId: pid });
  ok(noconf.r.isError && fs.existsSync(path.join(HOME, "projects", pid)), "delete_project without confirm refused");
  const snap = await call("snapshot", ids);
  const img = snap.r.content.find((c) => c.type === "image");
  if (process.env.SMOKE_REQUIRE_SNAPSHOT) ok(!snap.r.isError && img && Buffer.from(img.data, "base64").subarray(1, 4).toString() === "PNG", "snapshot returns a PNG image");
  else console.log(`info snapshot: isError=${snap.r.isError} ${img ? `PNG ${img.data.length} b64 chars` : snap.t?.slice(0, 160)}`);
  if (img && process.env.SMOKE_SNAPSHOT_OUT) fs.writeFileSync(process.env.SMOKE_SNAPSHOT_OUT, Buffer.from(img.data, "base64"));

  // ---- store symlink containment
  const vdir = path.join(HOME, "projects", pid, "systems", sid, "visuals");
  const outside = path.join(scratch, "outside.json");
  fs.writeFileSync(outside, JSON.stringify({ id: "evil", title: "Outside", rev: 1, nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } }));
  fs.symlinkSync(outside, path.join(vdir, "evil.json"));
  const ev = await call("get_visual", { projectId: pid, systemId: sid, visualId: "evil" });
  ok(ev.r.isError && /symbolic link/.test(ev.t) && noLeak(ev), "get_visual refuses a symlinked visual json (no path leak)");
  const lv = (await call("list_visuals", { projectId: pid, systemId: sid })).j;
  ok(Array.isArray(lv) && !lv.some((x) => x.id === "evil"), "list_visuals skips the symlinked visual");
  const ad = path.join(HOME, "projects", pid, "assets");
  fs.renameSync(ad, ad + "-real"); fs.mkdirSync(path.join(scratch, "elsewhere"));
  fs.symlinkSync(path.join(scratch, "elsewhere"), ad);
  const sa = await call("add_asset", { projectId: pid, svg: '<svg xmlns="http://www.w3.org/2000/svg"/>', filename: "y.svg" });
  ok(sa.r.isError && /symbolic link/.test(sa.t) && fs.readdirSync(path.join(scratch, "elsewhere")).length === 0, "add_asset refuses a symlinked assets dir and writes nothing outside");
  fs.rmSync(ad); fs.renameSync(ad + "-real", ad);
  fs.rmSync(path.join(vdir, "evil.json"));
  const del = await call("delete_project", { projectId: pid, confirm: true });
  ok(!del.r.isError && !fs.existsSync(path.join(HOME, "projects", pid)), "delete_project confirm:true removed it");
  pid = null;
} catch (e) { failed++; console.log("EXCEPTION", e); }
finally {
  if (pid) await client.callTool({ name: "delete_project", arguments: { projectId: pid, confirm: true } }).catch(() => {});
  await client.close();
  fs.rmSync(HOME, { recursive: true, force: true });
  fs.rmSync(scratch, { recursive: true, force: true });
}
console.log(failed ? `\n${failed} FAILED` : `\nALL ${step} CHECKS PASSED`);
process.exit(failed ? 1 : 0);
