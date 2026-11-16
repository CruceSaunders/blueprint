// Interaction test driver. Runs INSIDE the Blueprint main process (`Blueprint --ui-test scripts/interaction-test.cjs`),
// against a hidden offscreen window. Every action is a genuine input event (webContents.sendInputEvent): no state calls.
// Assertions read the DOM and the visual file on disk. Started by scripts/interaction-test.mjs (throwaway BLUEPRINT_HOME).
module.exports = async function run({ win }) {
  const fs = require("node:fs");
  const path = require("node:path");
  const wc = win.webContents;
  const HOME = process.env.BLUEPRINT_HOME;
  const VFILE = path.join(HOME, "projects/uitest/systems/main/visuals/canvas.json");
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const js = (code) => wc.executeJavaScript(code);
  const doc = () => JSON.parse(fs.readFileSync(VFILE, "utf8"));
  const node = (id) => doc().nodes.find((n) => n.id === id);
  let failed = 0;
  const check = (name, ok, detail = "") => {
    if (!ok) failed++;
    process.stdout.write(`RESULT\t${ok ? "PASS" : "FAIL"}\t${name}\t${String(detail).replace(/\s+/g, " ").slice(0, 160)}\n`);
  };
  const waitFor = async (fn, ms = 2500) => { const t = Date.now(); for (;;) { let v; try { v = await fn(); } catch { v = false; } if (v) return v; if (Date.now() - t > ms) return v; await sleep(60); } };

  // ---- genuine input
  const mouse = (type, x, y, extra = {}) => wc.sendInputEvent({ type, x: Math.round(x), y: Math.round(y), button: "left", clickCount: 1, ...extra });
  const move = (x, y, mods = []) => mouse("mouseMove", x, y, { modifiers: mods });
  async function click(p, mods = []) { move(p.x, p.y); await sleep(40); mouse("mouseDown", p.x, p.y, { modifiers: mods }); await sleep(50); mouse("mouseUp", p.x, p.y, { modifiers: mods }); await sleep(250); }
  async function dblclick(p) {
    move(p.x, p.y); await sleep(40);
    mouse("mouseDown", p.x, p.y); mouse("mouseUp", p.x, p.y); await sleep(40);
    mouse("mouseDown", p.x, p.y, { clickCount: 2 }); mouse("mouseUp", p.x, p.y, { clickCount: 2 }); await sleep(250);
  }
  async function drag(a, b, opts = {}) {
    const steps = opts.steps ?? 14;
    move(a.x, a.y); await sleep(40); mouse("mouseDown", a.x, a.y); await sleep(60);
    for (let i = 1; i <= steps; i++) {
      move(a.x + ((b.x - a.x) * i) / steps, a.y + ((b.y - a.y) * i) / steps, ["leftButtonDown"]);
      await sleep(25);
      if (opts.during && i === Math.ceil(steps / 2)) await opts.during();
    }
    mouse("mouseUp", b.x, b.y); await sleep(300);
  }
  const key = async (keyCode, mods = []) => {
    wc.sendInputEvent({ type: "keyDown", keyCode, modifiers: mods });
    if (keyCode === "Enter") wc.sendInputEvent({ type: "char", keyCode: "\r", modifiers: mods });
    await sleep(20); wc.sendInputEvent({ type: "keyUp", keyCode, modifiers: mods }); await sleep(150);
  };
  // multi-select the way a person does it: hold Shift (React Flow watches the key, not the click modifier)
  const shiftClick = async (p) => { wc.sendInputEvent({ type: "keyDown", keyCode: "Shift", modifiers: ["shift"] }); await sleep(40); await click(p, ["shift"]); wc.sendInputEvent({ type: "keyUp", keyCode: "Shift" }); await sleep(80); };
  const type = async (text) => { for (const ch of text) { wc.sendInputEvent({ type: "keyDown", keyCode: ch }); wc.sendInputEvent({ type: "char", keyCode: ch }); wc.sendInputEvent({ type: "keyUp", keyCode: ch }); await sleep(15); } await sleep(100); };
  const wheel = async (p, deltaY) => { wc.sendInputEvent({ type: "mouseWheel", x: p.x, y: p.y, deltaX: 0, deltaY, canScroll: true }); await sleep(300); };

  // ---- DOM probes
  const rect = (sel) => js(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, l: r.x, t: r.y, w: r.width, h: r.height }; })()`);
  const nodeAt = (id) => rect(`.react-flow__node[data-id="${id}"]`);
  const byText = (scope, text, contains = false, tags = "button,[role=menuitem]") => js(`(() => { const s = document.querySelector(${JSON.stringify(scope)}) || document; const t = ${JSON.stringify(text.toLowerCase())};
    const m = (x) => ${contains ? "x.includes(t)" : "x === t"};
    const el = [...s.querySelectorAll(${JSON.stringify(tags)})].find((e) => m((e.textContent || "").trim().toLowerCase()) || (e.getAttribute("aria-label") || "").toLowerCase() === t);
    if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
  const panel = () => js(`(() => { const p = document.querySelector('[data-testid=detail-panel]'); return p ? p.innerText : null; })()`);
  const edgeMid = (id) => js(`(() => { const p = document.querySelector('.react-flow__edge[data-id="${id}"] path.react-flow__edge-interaction') || document.querySelector('.react-flow__edge[data-id="${id}"] path'); if (!p) return null;
    const L = p.getTotalLength(); const m = p.getPointAtLength(L * 0.5); const pt = new DOMPoint(m.x, m.y).matrixTransform(p.getScreenCTM()); return { x: pt.x, y: pt.y }; })()`);
  const viewport = () => js(`getComputedStyle(document.querySelector('.react-flow__viewport')).transform`);
  const emptySpot = async () => { const c = await rect(".react-flow__pane"); return { x: c.l + c.w - 120, y: c.t + 90 }; };

  await waitFor(() => nodeAt("alpha"), 8000);
  await sleep(500);
  if (process.env.BLUEPRINT_PROBE) { return await eval(`(async () => { ${fs.readFileSync(process.env.BLUEPRINT_PROBE, "utf8")} })()`); }
  check("canvas loads fixture", await nodeAt("alpha") && await nodeAt("beta") && await nodeAt("gamma"));

  // 1. drag a node: position changes on disk, panel never opens (during or after)
  {
    const before = node("alpha").position;
    const a = await nodeAt("alpha");
    let openDuring = null;
    await drag({ x: a.x, y: a.y }, { x: a.x + 140, y: a.y + 70 }, { during: async () => { openDuring = await panel(); } });
    const moved = await waitFor(() => { const p = node("alpha").position; return p.x !== before.x || p.y !== before.y; });
    check("drag node: position saved to disk", moved, JSON.stringify(node("alpha").position));
    check("drag node: detail panel closed during drag", openDuring === null);
    check("drag node: detail panel closed after drag", (await panel()) === null);
  }
  // 2. click a node: panel opens, node under the cursor does not move
  {
    const a = await nodeAt("alpha");
    await click({ x: a.x, y: a.y });
    const txt = await waitFor(() => panel());
    const a2 = await nodeAt("alpha");
    check("click node: detail panel opens", txt && txt.includes("Alpha"), txt?.slice(0, 60));
    check("opening the panel does not move the clicked node", Math.abs(a2.l - a.l) < 1 && Math.abs(a2.t - a.t) < 1, `${a.l},${a.t} -> ${a2.l},${a2.t}`);
  }
  // 3. dragging another node while the panel is open does not switch or re-open it
  {
    const b = await nodeAt("beta");
    let during = null;
    await drag({ x: b.x, y: b.y }, { x: b.x + 60, y: b.y + 120 }, { during: async () => { during = await panel(); } });
    const after = await panel();
    check("drag another node: panel does not switch mid-drag", during && during.includes("Alpha") && !during.includes("Beta"), during?.slice(0, 40));
    check("drag another node: panel does not switch after drag", after && after.includes("Alpha") && !after.includes("Beta"), after?.slice(0, 40));
  }
  // 4. empty-canvas click closes; fresh grab and drag of a selected node never open/switch the panel
  {
    await click(await emptySpot());
    check("click empty canvas: panel closes", (await waitFor(async () => (await panel()) === null)) === true);
    const g = await nodeAt("gamma");
    await drag({ x: g.x, y: g.y }, { x: g.x + 40, y: g.y + 40 });
    check("drag a node (fresh grab): panel stays closed", (await panel()) === null);
    const g2 = await nodeAt("gamma");
    await click({ x: g2.x, y: g2.y });
    const before = await panel();
    let during = null;
    await drag({ x: g2.x, y: g2.y }, { x: g2.x - 30, y: g2.y + 30 }, { during: async () => { during = await panel(); } });
    check("drag the already-selected node: panel unchanged", before && before.includes("Gamma") && during === before && (await panel()) === before);
    await click(await emptySpot());
  }
  // 5. click an edge: panel opens with the relationship in plain words
  {
    const m = await edgeMid("e1");
    await click(m);
    const txt = await waitFor(() => panel());
    check("click edge: panel opens in plain words", txt && /leads to/.test(txt), txt?.replace(/\n/g, " ").slice(0, 80));
    // 6. change the edge kind from the panel
    const inc = await byText("[data-testid=detail-panel]", "Increases", true);
    if (inc) await click(inc);
    const kind = await waitFor(() => doc().edges.find((e) => e.id === "e1")?.kind === "increases");
    check("change edge kind in panel: saved", kind, doc().edges.find((e) => e.id === "e1")?.kind);
    const undo = await byText("body", "Undo");
    await click(undo);
    check("undo edge-kind change", await waitFor(() => doc().edges.find((e) => e.id === "e1")?.kind === "flow"));
    await click(await byText("body", "Redo"));
    check("redo edge-kind change", await waitFor(() => doc().edges.find((e) => e.id === "e1")?.kind === "increases"));
    await click(await emptySpot());
  }
  // 7. resize a node with its resize handle
  {
    const g = await nodeAt("gamma");
    await click({ x: g.x, y: g.y });
    await sleep(200);
    const h = await rect(`.react-flow__node[data-id="gamma"] .react-flow__resize-control.handle.bottom.right`);
    const before = node("gamma").size;
    if (h) await drag({ x: h.x, y: h.y }, { x: h.x + 70, y: h.y + 40 }, { steps: 10 });
    const sz = await waitFor(() => { const s = node("gamma").size; return s && (!before || s.w !== before.w) ? s : null; });
    check("resize node: size saved", !!h && !!sz, JSON.stringify(sz));
    const p = await panel();
    check("resize: panel did not switch", p && p.includes("Gamma"));
    await click(await byText("body", "Undo"));
    check("undo resize", await waitFor(() => JSON.stringify(node("gamma").size) === JSON.stringify(before)), JSON.stringify(node("gamma").size));
    await click(await byText("body", "Redo"));
    check("redo resize", await waitFor(() => JSON.stringify(node("gamma").size) === JSON.stringify(sz)));
    await click(await emptySpot());
  }
  // 8. connect two nodes handle to handle
  {
    const nEdges = doc().edges.length;
    const hs = await rect(`.react-flow__node[data-id="gamma"] .react-flow__handle-right`);
    const hb = await rect(`.react-flow__node[data-id="beta"] .react-flow__handle-left`);
    let during = "unset";
    if (hs && hb) await drag({ x: hs.x, y: hs.y }, { x: hb.x, y: hb.y }, { steps: 16, during: async () => { during = await panel(); } });
    const ok = await waitFor(() => doc().edges.length === nEdges + 1);
    const ne = doc().edges.find((e) => e.source === "gamma" && e.target === "beta");
    check("connect handle to handle: edge created", ok && !!ne, `${doc().edges.length} edges`);
    check("connect: panel not opened while connecting", during === null, String(during).slice(0, 40));
    const txt = await panel();
    check("connect: kind picker shown for the new edge", txt && txt.includes("Requires") && /leads to/.test(txt));
    const req = await byText("[data-testid=detail-panel]", "Requires", true);
    if (req) await click(req);
    check("connect: kind picker usable", await waitFor(() => doc().edges.find((e) => e.id === ne?.id)?.kind === "requires"));
    await click(await byText("body", "Undo"));
    await click(await byText("body", "Undo"));
    check("undo connect", await waitFor(() => doc().edges.length === nEdges), `${doc().edges.length} edges`);
    await click(await byText("body", "Redo"));
    check("redo connect", await waitFor(() => doc().edges.length === nEdges + 1));
    await click(await emptySpot());
  }
  // 9. inline text edit
  {
    const t = await rect(`.react-flow__node[data-id="beta"] .font-semibold`);
    await dblclick({ x: t.x, y: t.y });
    const editing = await waitFor(() => js(`!!document.querySelector('.react-flow__node[data-id="beta"] textarea')`));
    await type("Bravo");
    await key("Enter");
    check("inline edit: title saved", editing && await waitFor(() => node("beta").title === "Bravo"), `editing=${editing} title=${node("beta").title}`);
    await click(await byText("body", "Undo"));
    check("undo inline edit", await waitFor(() => node("beta").title === "Beta"), node("beta").title);
    await click(await byText("body", "Redo"));
    check("redo inline edit", await waitFor(() => node("beta").title === "Bravo"));
    await click(await emptySpot());
  }
  // 10. delete with the keyboard
  {
    const g = await nodeAt("gamma");
    await click({ x: g.x, y: g.y });
    await click(await emptySpot());
    await click({ x: g.x, y: g.y });
    await key("Backspace");
    check("delete node (Backspace)", await waitFor(() => !node("gamma")));
    await click(await byText("body", "Undo"));
    check("undo delete", await waitFor(() => !!node("gamma")));
    await click(await byText("body", "Redo"));
    check("redo delete", await waitFor(() => !node("gamma")));
    await click(await byText("body", "Undo"));
    await click(await emptySpot());
  }
  // 11. group and ungroup
  {
    const a = await nodeAt("alpha"), b = await nodeAt("beta");
    await click({ x: a.x, y: a.y });
    await shiftClick({ x: b.x, y: b.y });
    await click(await byText("body", "Group"));
    const grouped = await waitFor(() => { const d = doc(); const g = d.nodes.find((n) => n.kind === "group"); return g && node("alpha").parent === g.id && node("beta").parent === g.id ? g : null; });
    check("group selected nodes", !!grouped, grouped?.id);
    await click(await byText("body", "Undo"));
    check("undo group", await waitFor(() => !doc().nodes.some((n) => n.kind === "group") && !node("alpha").parent));
    await click(await byText("body", "Redo"));
    const g = await waitFor(() => doc().nodes.find((n) => n.kind === "group"));
    check("redo group", !!g);
    await click(await emptySpot());
    const gr = await rect(`.react-flow__node[data-id="${g?.id}"]`);
    if (gr) await click({ x: gr.l + gr.w - 12, y: gr.t + gr.h - 10 });
    await click(await byText("body", "Ungroup"));
    check("ungroup", await waitFor(() => !doc().nodes.some((n) => n.kind === "group") && !node("alpha").parent));
    await click(await byText("body", "Undo"));
    check("undo ungroup", await waitFor(() => doc().nodes.some((n) => n.kind === "group")));
    await click(await byText("body", "Redo"));
    check("redo ungroup", await waitFor(() => !doc().nodes.some((n) => n.kind === "group")));
    await click(await emptySpot());
  }
  // 12. Tidy
  {
    const before = JSON.stringify(doc().nodes.map((n) => n.position));
    await click(await byText("body", "Tidy"));
    await sleep(250);
    await click(await byText("body", "Arrange top to bottom"));
    const ok = await waitFor(() => JSON.stringify(doc().nodes.map((n) => n.position)) !== before && doc().edges.every((e) => Array.isArray(e.route)), 4000);
    check("Tidy: re-arranged and routed", ok);
    await click(await byText("body", "Undo"));
    check("undo Tidy", await waitFor(() => JSON.stringify(doc().nodes.map((n) => n.position)) === before));
    await click(await byText("body", "Redo"));
    check("redo Tidy", await waitFor(() => JSON.stringify(doc().nodes.map((n) => n.position)) !== before));
  }
  // 13. zoom and pan
  {
    const v0 = await viewport();
    const spot = await emptySpot();
    await wheel(spot, -300);
    const v1 = await viewport();
    check("zoom with the wheel", v1 !== v0, `${v0} -> ${v1}`);
    await drag(spot, { x: spot.x - 150, y: spot.y + 80 }, { steps: 10 });
    const v2 = await viewport();
    check("pan by dragging empty canvas", v2 !== v1 && (await panel()) === null, `${v1} -> ${v2}`);
  }
  // 14. add each node kind from the toolbar
  {
    const kinds = [["Card", "card"], ["Drawing", "visual"], ["Image", "image"], ["Symbol", "operator"], ["Note", "note"], ["Frame", "group"]];
    for (const [label, kind] of kinds) {
      const n0 = doc().nodes.filter((n) => n.kind === kind).length;
      const b = await byText("body", label);
      if (b) await click(b);
      check(`toolbar adds ${label} (${kind})`, await waitFor(() => doc().nodes.filter((n) => n.kind === kind).length === n0 + 1));
      check(`toolbar add ${label}: panel stays closed`, (await panel()) === null);
    }
  }
  // 15. sidebar: create, rename, delete
  {
    const projects = () => fs.readdirSync(path.join(HOME, "projects"));
    const n0 = projects().length;
    await click(await byText("body", "New project"));
    await sleep(300);
    await type("Scratch idea");
    await key("Enter");
    const made = await waitFor(() => projects().length === n0 + 1);
    const pid = projects().find((p) => p.startsWith("scratch-idea"));
    check("sidebar: create project", made && !!pid, `${pid} ${projects().join(",")}`);
    // rename via the row's More menu
    const more = await js(`(() => { const row = [...document.querySelectorAll('aside *')].find((e) => e.children.length === 0 && e.textContent.trim() === 'Scratch idea'); const r = row?.closest('div'); const b = r?.querySelector('button[aria-label=More]'); if (!b) return null; const q = b.getBoundingClientRect(); return { x: q.x + q.width / 2, y: q.y + q.height / 2 }; })()`);
    if (more) { move(more.x, more.y); await sleep(100); await click(more); }
    await sleep(250);
    const ren = await byText("body", "Rename");
    if (ren) await click(ren);
    await sleep(300);
    await type("Scratch renamed");
    await key("Enter");
    const renamed = await waitFor(() => { try { return JSON.parse(fs.readFileSync(path.join(HOME, "projects", pid, "project.json"), "utf8")).title === "Scratch renamed"; } catch { return false; } });
    check("sidebar: rename project", !!more && renamed, `more=${JSON.stringify(more)} renameItem=${JSON.stringify(ren)} title=${(() => { try { return JSON.parse(fs.readFileSync(path.join(HOME, "projects", pid, "project.json"), "utf8")).title; } catch (e) { return e.message; } })()}`);
    const more2 = await js(`(() => { const row = [...document.querySelectorAll('aside *')].find((e) => e.children.length === 0 && e.textContent.trim() === 'Scratch renamed'); const b = row?.closest('div')?.querySelector('button[aria-label=More]'); if (!b) return null; const q = b.getBoundingClientRect(); return { x: q.x + q.width / 2, y: q.y + q.height / 2 }; })()`);
    if (more2) { move(more2.x, more2.y); await sleep(100); await click(more2); }
    await sleep(250);
    const del = await byText("body", "Move to Trash");
    if (del) await click(del);
    await sleep(300);
    const confirm = await byText("[role=dialog]", "Move to Trash");
    if (confirm) await click(confirm);
    check("sidebar: delete project", await waitFor(() => !fs.existsSync(path.join(HOME, "projects", pid))), `menuItem=${!!del} confirm=${!!confirm}`);
  }
  return failed ? 1 : 0;
};
