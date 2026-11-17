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
  const floatRect = () => rect("[data-testid=detail-panel]");
  const overlaps = (a, b) => !!a && !!b && a.l < b.l + b.w && b.l < a.l + a.w && a.t < b.t + b.h && b.t < a.t + a.h;
  const winW = () => js("innerWidth"), winH = () => js("innerHeight");
  const mode = () => js(`document.querySelector('[data-testid=detail-panel]')?.dataset.mode ?? null`);
  const panel = () => js(`(() => { const p = document.querySelector('[data-testid=detail-panel]'); return p ? p.innerText : null; })()`);
  const edgeMid = (id) => js(`(() => { const p = document.querySelector('.react-flow__edge[data-id="${id}"] path.react-flow__edge-interaction') || document.querySelector('.react-flow__edge[data-id="${id}"] path'); if (!p) return null;
    const L = p.getTotalLength(); const m = p.getPointAtLength(L * 0.5); const pt = new DOMPoint(m.x, m.y).matrixTransform(p.getScreenCTM()); return { x: pt.x, y: pt.y }; })()`);
  // Everything the popover must stay off: cards (and the title strip of a frame), line labels.
  const obstacles = () => js(`(() => { const out = []; document.querySelectorAll('.react-flow__node').forEach((n) => { const r = n.getBoundingClientRect(); const g = n.classList.contains('react-flow__node-group'); out.push({ id: n.dataset.id, l: r.x, t: r.y, w: r.width, h: g ? Math.min(r.height, 44) : r.height }); });
    document.querySelectorAll('[data-testid=edge-label]').forEach((n) => { const r = n.getBoundingClientRect(); out.push({ id: 'label', l: r.x, t: r.y, w: r.width, h: r.height }); }); return out; })()`);
  const selectedIds = () => js(`[...document.querySelectorAll('.react-flow__node.selected')].map((n) => n.dataset.id)`);
  const inPanel = (label, text) => js(`(() => { const g = document.querySelector('[data-testid=detail-panel] [aria-label=${JSON.stringify(label)}]'); const t = ${JSON.stringify(text.toLowerCase())};
    const el = g && [...g.querySelectorAll('button')].find((b) => b.textContent.trim().toLowerCase() === t); if (!el) return null; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
  const viewport = () => js(`getComputedStyle(document.querySelector('.react-flow__viewport')).transform`);
  const emptySpot = async () => { const c = await rect(".react-flow__pane"); return { x: c.l + c.w - 120, y: c.t + 90 }; };

  await waitFor(() => nodeAt("alpha"), 8000);
  await sleep(500);
  if (process.env.BLUEPRINT_PROBE) { return await eval(`(async () => { ${fs.readFileSync(process.env.BLUEPRINT_PROBE, "utf8")} })()`); }
  check("canvas loads fixture", await nodeAt("alpha") && await nodeAt("beta") && await nodeAt("gamma"));
  check("shape: pill card renders as a pill", await js(`!!document.querySelector('.react-flow__node[data-id="step"] [data-shape="pill"]')`));
  {
    const art = await js(`(() => { const n = document.querySelector('.react-flow__node[data-id="pic"]'); const a = n && n.querySelector('[data-testid=node-art]'); if (!a) return null;
      const nr = n.getBoundingClientRect(), ar = a.getBoundingClientRect(); return { svg: !!a.querySelector('svg circle'), script: !!a.querySelector('script'), inside: ar.top >= nr.top && ar.bottom <= nr.bottom && ar.left >= nr.left && ar.right <= nr.right }; })()`);
    check("art: drawn inside its own card", art && art.svg && art.inside, JSON.stringify(art));
    check("art: svg sanitised (no script)", art && !art.script, JSON.stringify(art));
  }

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
    // floating card: next to the card, never on it, inside the window
    const fr = await waitFor(async () => { const f = await floatRect(); return f && f.w > 0 && (await js(`getComputedStyle(document.querySelector('[data-testid=detail-float]')).visibility`)) === "visible" ? f : null; });
    check("card popover: floats beside the card, not covering it", !!fr && !overlaps(fr, a2), `${JSON.stringify(fr)} vs ${JSON.stringify(a2)}`);
    {
      // prefers empty canvas: no card, line label or frame title under it, and the selected card's neighbour (Beta) stays clear
      const obs = await obstacles(), beta = await nodeAt("beta");
      const hits = obs.filter((o) => overlaps(fr, o));
      check("card popover: sits on empty canvas (no card, label or title under it)", hits.length === 0, hits.map((o) => o.id).join(","));
      check("card popover: does not cover the card's connected neighbour", !overlaps(fr, beta), JSON.stringify(fr));
    }
    check("card popover: no full-height dock (canvas keeps its width)", !!fr && fr.h < (await winH()) * 0.6 && (await rect(".react-flow__pane")).w > (await winW()) - 300);
    // details first: title + explanation only, properties hidden until "Edit"
    check("card details: meaning only, no properties", (await mode()) === "view" && txt.includes("Alpha node.") && !/Colour|Status|Icon/.test(txt), txt?.replace(/\n/g, " ").slice(0, 80));
    await click(await byText("[data-testid=detail-panel]", "Edit"));
    const ed = await waitFor(async () => ((await mode()) === "edit" ? panel() : null));
    check("card Edit: properties shown one step behind Edit", !!ed && /Colour/.test(ed) && /Status/.test(ed) && /Icon/.test(ed), ed?.replace(/\n/g, " ").slice(0, 80));
    await sleep(150);
    const er = await floatRect();
    {
      // the taller Edit card may move to stay on empty canvas; it must never cover the card or its neighbour, and stays inside the window
      const nb = await nodeAt("beta");
      check("card Edit: grows beside the card, never over it or its neighbour", !!er && !!fr && !overlaps(er, await nodeAt("alpha")) && !overlaps(er, nb) && er.t >= 0 && er.t + er.h <= (await winH()) + 1 && er.l + er.w <= (await winW()) + 1, `${JSON.stringify(fr)} -> ${JSON.stringify(er)}`);
    }
    await click(await byText("[data-testid=detail-panel]", "Done"));
    check("card Done: back to details", (await waitFor(async () => (await mode()) === "view")) === true);
    await key("Escape");
    check("Escape closes the popover", (await waitFor(async () => (await panel()) === null)) === true);
    // a card near the right edge: the popover flips to the other side and stays inside the window
    const d = await nodeAt("delta");
    await click({ x: d.x, y: d.y });
    const dr = await waitFor(async () => { const f = await floatRect(); return f && (await panel())?.includes("Delta") ? f : null; });
    await sleep(100);
    const dr2 = await floatRect();
    check("right-edge card: popover inside the window, not covering the card", !!dr && !!dr2 && dr2.l >= 0 && dr2.l + dr2.w <= (await winW()) && !overlaps(dr2, await nodeAt("delta")), `${JSON.stringify(dr2)} vs ${JSON.stringify(await nodeAt("delta"))}`);
    await key("Escape");
    await click({ x: a2.x, y: a2.y });
    await waitFor(() => panel());
  }
  // 2b. Shift-click a second card while the popover is open: the click reaches the card, both are selected, the card closes cleanly
  {
    const b0 = await nodeAt("beta");
    const o = await obstacles();
    const open = await panel();
    check("popover open before the Shift-click", !!open && open.includes("Alpha"));
    const fl = await floatRect();
    check("shift-click target is not under the popover", !overlaps(fl, b0), JSON.stringify(fl));
    await shiftClick({ x: b0.x, y: b0.y });
    const sel = await waitFor(async () => { const s2 = await selectedIds(); return s2.length === 2 ? s2 : null; });
    check("shift-click a second card with the popover open: 2 selected", !!sel && sel.includes("alpha") && sel.includes("beta"), JSON.stringify(await selectedIds()));
    check("2+ selected: the details card closes cleanly, selection stays", (await waitFor(async () => (await panel()) === null)) === true && (await selectedIds()).length === 2);
    void o;
    await click(await emptySpot());
    await click({ x: (await nodeAt("alpha")).x, y: (await nodeAt("alpha")).y });
    await waitFor(() => panel());
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
    check("line details: kind picker hidden until Edit", (await mode()) === "view" && !txt.includes("Increases"));
    const lr = await floatRect();
    check("line popover: floats, does not cover the line's middle", !!lr && !(m.x > lr.l && m.x < lr.l + lr.w && m.y > lr.t && m.y < lr.t + lr.h), `${JSON.stringify(lr)} mid ${JSON.stringify(m)}`);
    // 6. change the edge kind from the panel (one step behind Edit)
    await click(await byText("[data-testid=detail-panel]", "Edit"));
    await waitFor(async () => (await mode()) === "edit");
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
    check("connect: kind picker shown for the new edge", txt && txt.includes("Requires") && (await mode()) === "edit", txt?.replace(/\n/g, " ").slice(0, 60));
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
    // start from the right-hand card: its popover opens beside it, away from the card shift-clicked next
    await click({ x: b.x, y: b.y });
    await shiftClick({ x: a.x, y: a.y });
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
  // 11b. look controls (Edit), ⌘K look actions, migration actions. Everything is undone at the end so later steps see the fixture.
  {
    const cmd = async (label, id) => {
      await key("K", ["meta"]);
      await waitFor(() => js(`!!document.querySelector('[cmdk-root]')`));
      await type(label);
      const present = await waitFor(() => js(`!!document.querySelector('[data-command=${JSON.stringify(id)}]')`), 1500);
      await key("Enter");
      return present;
    };
    const undo = async () => click(await byText("body", "Undo"));
    // the card re-places itself for a frame or two after it grows; let it settle before aiming at a button
    const pick = async (label, text, until) => {
      for (let i = 0; i < 3; i++) {
        await sleep(450);
        const p = await inPanel(label, text);
        if (p) await click(p);
        if (!until || (await waitFor(until, 900))) return true;
      }
      return false;
    };
    // A hidden window never has page focus, so blur events (which commit text fields) would not fire: emulate focus around text entry only.
    const focusEmu = async (on) => { try { wc.debugger.attach("1.3"); } catch { /* already attached */ } await wc.debugger.sendCommand("Emulation.setFocusEmulationEnabled", { enabled: on }); };
    // -- card: shape (Edit)
    const al = await nodeAt("alpha");
    await click({ x: al.x, y: al.y });
    await waitFor(() => panel());
    await click(await byText("[data-testid=detail-panel]", "Edit"));
    await waitFor(async () => (await mode()) === "edit");
    check("Edit: card shows Shape and no drawing size until it has a drawing", !!(await inPanel("Shape", "Pill")) && !(await inPanel("Drawing size", "Large")));
    await pick("Shape", "Circle");
    check("Edit: Shape writes node.shape", await waitFor(() => node("alpha").shape === "circle"), node("alpha").shape);
    await pick("Shape", "Card");
    check("Edit: Shape: Card clears node.shape", await waitFor(() => node("alpha").shape === undefined), String(node("alpha").shape));
    // -- ⌘K shape on the selection
    await click(await byText("[data-testid=detail-panel]", "Done"));
    check("⌘K: Shape: Pill sets the selected card's shape", (await cmd("Shape: Pill", "shape-pill")) && await waitFor(() => node("alpha").shape === "pill"), String(node("alpha").shape));
    await undo();
    check("undo shape", await waitFor(() => node("alpha").shape === undefined));
    await click(await emptySpot());
    // -- card: art size, svg box, remove
    const pic = await nodeAt("pic");
    await click({ x: pic.x, y: pic.y });
    await waitFor(async () => (await panel())?.includes("Drawn part"));
    await click(await byText("[data-testid=detail-panel]", "Edit"));
    await waitFor(async () => (await mode()) === "edit");
    await pick("Drawing size", "Large");
    check("Edit: Drawing size writes art.size", await waitFor(() => node("pic").art?.size === "lg"), JSON.stringify(node("pic").art?.size));
    const svgBox = await js(`(() => { const t = document.querySelector('[data-testid=detail-panel] textarea[aria-label="Drawing SVG"]'); const d = t?.closest('details'); if (!d) return null; d.open = true; const r = t.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, closedByDefault: true }; })()`);
    check("Edit: the drawing's SVG text sits behind a disclosure", !!svgBox);
    if (svgBox) {
      await focusEmu(true);
      await js(`document.querySelector('[data-testid=detail-panel] textarea[aria-label="Drawing SVG"]').scrollIntoView({ block: 'center' })`);
      await sleep(200);
      const tb = await rect('[data-testid=detail-panel] textarea[aria-label="Drawing SVG"]');
      await click({ x: tb.x, y: tb.y });
      await js(`document.querySelector('[data-testid=detail-panel] textarea[aria-label="Drawing SVG"]').select()`);
      wc.insertText('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#c33"/></svg>');
      await sleep(150);
      await click(await byText("[data-testid=detail-panel]", "Done")); // the blur commits the text (the card may re-mount, so check below)
      await sleep(300);
      await focusEmu(false);
    }
    check("Edit: SVG box writes art.svg and keeps the size", await waitFor(() => /fill="#c33"/.test(node("pic").art?.svg || "") && node("pic").art?.size === "lg"), JSON.stringify(node("pic").art).slice(0, 80));
    if ((await mode()) !== "edit") { await click(await byText("[data-testid=detail-panel]", "Edit")); await waitFor(async () => (await mode()) === "edit"); }
    await sleep(350);
    await js(`[...document.querySelectorAll('[data-testid=detail-panel] button')].find((b) => b.textContent.includes('Remove drawing'))?.scrollIntoView({ block: 'center' })`);
    await click(await byText("[data-testid=detail-panel]", "Remove drawing"));
    check("Edit: Remove drawing deletes node.art", await waitFor(() => node("pic").art === undefined), JSON.stringify(node("pic").art));
    await undo();
    check("undo remove drawing", await waitFor(() => !!node("pic").art));
    await click(await emptySpot());
    await click({ x: (await nodeAt("pic")).x, y: (await nodeAt("pic")).y });
    await waitFor(() => panel());
    await click(await byText("[data-testid=detail-panel]", "Done").then(async (r) => r || { x: 0, y: 0 }));
    check("⌘K: Remove art removes the selected card's drawing", (await cmd("Remove art", "remove-art")) && await waitFor(() => node("pic").art === undefined));
    await undo(); await undo(); await undo();
    await click(await emptySpot());
    // -- group: arrangement + treatment (Edit)
    const a1 = await nodeAt("alpha"), b1 = await nodeAt("beta");
    await click({ x: b1.x, y: b1.y });
    await shiftClick({ x: a1.x, y: a1.y });
    await click(await byText("body", "Group"));
    const g = await waitFor(() => doc().nodes.find((n) => n.kind === "group"));
    await click(await emptySpot());
    const gr = await rect(`.react-flow__node[data-id="${g?.id}"]`);
    if (gr) await click({ x: gr.l + gr.w - 12, y: gr.t + gr.h - 10 });
    await waitFor(async () => (await panel())?.includes("Group"));
    await click(await byText("[data-testid=detail-panel]", "Edit"));
    await waitFor(async () => (await mode()) === "edit");
    const kids0 = JSON.stringify(doc().nodes.filter((n) => n.parent === g?.id).map((n) => n.position));
    await pick("Arrangement", "Column");
    check("Edit: group Arrangement writes node.arrangement", await waitFor(() => doc().nodes.find((n) => n.id === g?.id)?.arrangement === "column"), String(doc().nodes.find((n) => n.id === g?.id)?.arrangement));
    check("Edit: changing a group's arrangement re-places its children", await waitFor(() => JSON.stringify(doc().nodes.filter((n) => n.parent === g?.id).map((n) => n.position)) !== kids0));
    await pick("Frame style", "Bracket", () => doc().nodes.find((n) => n.id === g?.id)?.treatment === "bracket");
    check("Edit: group Frame style writes node.treatment", await waitFor(() => doc().nodes.find((n) => n.id === g?.id)?.treatment === "bracket"), String(doc().nodes.find((n) => n.id === g?.id)?.treatment));
    check("⌘K: Group style: Band sets the selected frame's treatment", (await click(await byText("[data-testid=detail-panel]", "Done")), await cmd("Group style: Band", "treatment-band")) && await waitFor(() => doc().nodes.find((n) => n.id === g?.id)?.treatment === "band"));
    check("⌘K: Arrange as ring sets the selected frame's arrangement", (await cmd("Arrange as ring", "arrange-ring")) && await waitFor(() => doc().nodes.find((n) => n.id === g?.id)?.arrangement === "ring"));
    await click(await emptySpot());
    // -- the visual itself: arrangement (More menu and ⌘K)
    await click(await byText("body", "More options"));
    await sleep(250);
    await click(await byText("body", "Layout of this visual", true, "[role=menuitem]"));
    await sleep(300);
    const gridItem = await js(`(() => { const e = document.querySelector('[role=menuitem][data-arrangement="grid"]'); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
    if (gridItem) await click(gridItem);
    check("More ▸ Layout of this visual ▸ Grid writes the visual's arrangement", await waitFor(() => doc().arrangement === "grid"), String(doc().arrangement));
    await undo();
    check("undo restores the visual's previous arrangement", await waitFor(() => doc().arrangement === undefined && JSON.stringify(doc().nodes.map((n) => [n.id, n.position])) !== ""), String(doc().arrangement));
    check("⌘K: Arrange as ring (nothing selected) sets the visual's arrangement", (await cmd("Arrange as ring", "arrange-ring")) && await waitFor(() => doc().arrangement === "ring"), String(doc().arrangement));
    // -- tidy with new layout: drag a card off its place, run the action, it comes back
    const ringPos = JSON.stringify(node("gamma").position);
    const ga = await nodeAt("gamma");
    await drag({ x: ga.x, y: ga.y }, { x: ga.x + 90, y: ga.y + 50 });
    await waitFor(() => JSON.stringify(node("gamma").position) !== ringPos);
    await click(await emptySpot());
    check("⌘K: Tidy with new layout re-places everything with the visual's own arrangement", (await cmd("Tidy with new layout", "tidy-new")) && await waitFor(() => JSON.stringify(node("gamma").position) === ringPos), JSON.stringify(node("gamma").position));
    // -- migration: Make this the card's art
    const fit = await byText("body", "fit view");
    if (fit) await click(fit);
    await sleep(500);
    const sk = await nodeAt("sketch");
    await click({ x: sk.x, y: sk.y });
    await waitFor(async () => (await panel())?.includes("Sketch"));
    await click(await byText("[data-testid=detail-panel]", "Edit"));
    await waitFor(async () => (await mode()) === "edit");
    const mk = await byText("[data-testid=detail-panel]", "Make this the card's art");
    check("Edit: a drawing joined by one relates line to one card offers 'Make this the card's art'", !!mk);
    if (mk) await click(mk);
    const moved = await waitFor(() => !node("sketch") && !doc().edges.some((e) => e.id === "e2") && /<rect/.test(node("part")?.art?.svg || ""), 3000);
    check("Make art (Edit): svg moved onto the card, drawing and line deleted", moved, JSON.stringify(node("part")?.art).slice(0, 60));
    await undo();
    check("undo Make art: drawing, line back and the card has no art (one step)", await waitFor(() => !!node("sketch") && doc().edges.some((e) => e.id === "e2") && !node("part").art));
    await click(await emptySpot());
    const sk2 = await nodeAt("sketch");
    await click({ x: sk2.x, y: sk2.y });
    await waitFor(async () => (await panel())?.includes("Sketch"));
    check("⌘K: Make this the card's art works on the selected drawing", (await cmd("Make this the card's art", "make-art")) && await waitFor(() => !node("sketch") && !!node("part")?.art?.svg, 3000));
    // -- put everything back
    const restored = () => { const d = doc(); return !d.nodes.some((n) => n.kind === "group") && !!node("sketch") && d.edges.some((e) => e.id === "e2") && !node("part").art && node("pic").art?.size === "sm" && /circle/.test(node("pic").art?.svg || "") && d.arrangement === undefined && !node("alpha").shape; };
    for (let i = 0; i < 30 && !restored(); i++) { const u = await byText("body", "Undo"); if (!u) break; await click(u); }
    check("look + migration steps fully undone (nothing left behind)", await waitFor(restored), `sketch=${!!node("sketch")} e2=${doc().edges.some((e) => e.id === "e2")} pic=${JSON.stringify(node("pic").art)?.slice(0, 40)} shape=${node("alpha").shape}`);
    await click(await emptySpot());
    await click(await byText("body", "fit view").then((r) => r || { x: 0, y: 0 }));
  }
  // 12. Tidy
  {
    const before = JSON.stringify(doc().nodes.map((n) => n.position));
    await click(await byText("body", "More options"));
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
  // 14. "+" expands to all six kinds; add each one
  {
    const kinds = [["Card", "card"], ["Drawing", "visual"], ["Image", "image"], ["Symbol", "operator"], ["Note", "note"], ["Frame", "group"]];
    const collapsed = await js(`(() => { const t = document.querySelector('[data-testid=add-toolbar]'); return t ? t.innerText.trim() : null; })()`);
    check("toolbar: collapsed to a single +", collapsed === "", JSON.stringify(collapsed));
    await click(await byText("body", "Add"));
    const shown = await js(`[...document.querySelectorAll('[data-testid=add-toolbar] button')].map((b) => b.textContent.trim()).filter(Boolean)`);
    check("+ expands to all six kinds", kinds.every(([l]) => shown.includes(l)), shown.join(","));
    await key("Escape");
    for (const [label, kind] of kinds) {
      const n0 = doc().nodes.filter((n) => n.kind === kind).length;
      await click(await byText("body", "Add"));
      const b = await byText("[data-testid=add-toolbar]", label);
      if (b) await click(b);
      check(`toolbar adds ${label} (${kind})`, await waitFor(() => doc().nodes.filter((n) => n.kind === kind).length === n0 + 1));
      check(`toolbar add ${label}: panel stays closed`, (await panel()) === null);
    }
  }
  // 15. sidebar: create, rename, delete
  {
    const projects = () => fs.readdirSync(path.join(HOME, "projects"));
    const n0 = projects().length;
    // Escape cancels a new name without creating anything
    await click(await byText("body", "New project"));
    await sleep(300);
    const field = await js(`!!document.querySelector('[data-testid=sidebar] [data-testid=inline-name]') && !document.querySelector('[role=dialog]')`);
    check("new project: named in place in the sidebar (no pop-up)", field);
    await type("Never mind");
    await key("Escape");
    check("inline name: Escape cancels", await waitFor(() => js(`!document.querySelector('[data-testid=inline-name]')`)) && projects().length === n0, projects().join(","));
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
    check("rename: edits in place in the sidebar", await js(`(document.querySelector('[data-testid=sidebar] [data-testid=inline-name]')?.value) === 'Scratch idea'`));
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
  // 16. ⌘K reaches every action that moved off the screen, and runs them from the keyboard
  {
    await click(await emptySpot());
    await key("K", ["meta"]);
    const open = await waitFor(() => js(`!!document.querySelector('[cmdk-root]')`));
    const ids = await js(`[...document.querySelectorAll('[data-command]')].map((e) => e.getAttribute('data-command'))`);
    const want = ["add-card", "add-visual", "add-image", "add-operator", "add-note", "add-group", "group", "ungroup", "tidy-down", "tidy-right", "legend", "notes", "map", "undo", "redo", "shape-pill", "shape-circle", "arrange-ring", "arrange-grid", "treatment-frame", "treatment-band", "remove-art", "make-art", "tidy-new", "theme-light", "theme-dark", "theme-system", "sidebar", "connect", "copy-prompt", "new-project", "new-system", "new-visual"];
    const missing = want.filter((w) => !(ids || []).includes(w));
    check("⌘K opens the command menu", !!open);
    check("⌘K lists every moved action", open && !missing.length, `missing: ${missing.join(",")}`);
    await type("notes");
    await key("Enter");
    check("⌘K runs a command (Notes opens beside the canvas)", await waitFor(() => js(`!!document.querySelector('[data-testid=side-sheet]')`)));
    await click(await byText("[data-testid=side-sheet]", "Close"));
    await key("K", ["meta"]);
    await waitFor(() => js(`!!document.querySelector('[cmdk-root]')`));
    await type("hide sidebar");
    await key("Enter");
    check("⌘K: hide sidebar", await waitFor(() => js(`!document.querySelector('[data-testid=sidebar]')`)));
    await key("\\", ["meta"]);
    check("⌘\\ shows the sidebar again", await waitFor(() => js(`!!document.querySelector('[data-testid=sidebar]')`)));
  }
  // 17. a visual your AI writes to disk opens by itself
  {
    const vdir = path.dirname(VFILE);
    const t = new Date().toISOString();
    fs.writeFileSync(path.join(vdir, "from-ai.json"), JSON.stringify({ id: "from-ai", title: "From AI", description: "", rev: 1, createdAt: t, updatedAt: t, viewport: { x: 0, y: 0, zoom: 1 },
      nodes: [{ id: "ai1", kind: "card", title: "Drawn by AI", position: { x: 0, y: 0 } }], edges: [] }));
    check("new AI visual opens automatically", !!(await waitFor(() => nodeAt("ai1"), 5000)));
    check("new AI visual: sidebar row highlighted", await waitFor(() => js(`!!document.querySelector('[data-testid=sidebar] .bp-arrived')`), 1500));
  }
  // 18. first run: three steps, one Connect button that really connects (throwaway HOME) and updates the status
  {
    const P = path.join(HOME, "projects"), PARK = path.join(HOME, "parked");
    fs.mkdirSync(PARK, { recursive: true });
    for (const d of fs.readdirSync(P)) fs.renameSync(path.join(P, d), path.join(PARK, d));
    const fr = await waitFor(() => js(`!!document.querySelector('[data-testid=first-run]')`), 4000);
    const steps = await js(`[...document.querySelectorAll('[data-testid=first-run] [data-step]')].map((e) => e.innerText.replace(/\\s+/g, ' ').trim())`);
    check("first run: three steps render", fr && steps?.length === 3 && /Connect/.test(steps[0]) && /visualize/.test(steps[1]), JSON.stringify(steps));
    check("first run: example prompt shown", await js(`(document.querySelector('[data-testid=first-run] [data-testid=example-prompt]')?.innerText || '').includes('/visualize')`));
    const states = () => js(`Object.fromEntries([...document.querySelectorAll('[data-testid=first-run] [data-tool]')].map((e) => [e.dataset.tool, e.dataset.state]))`);
    const s0 = await waitFor(async () => { const s = await states(); return s && s.claude ? s : null; });
    check("first run: detects installed tools", s0 && s0.claude === "found" && s0.cursor === "found" && s0.codex === "missing", JSON.stringify(s0));
    await click(await byText("[data-testid=first-run]", "Connect"));
    const s1 = await waitFor(async () => { const s = await states(); return s && s.claude === "connected" && s.cursor === "connected" ? s : null; }, 5000);
    let cfg = null; try { cfg = JSON.parse(fs.readFileSync(path.join(process.env.HOME, ".claude.json"), "utf8")); } catch { /* none */ }
    check("Connect button: tools connected and status updated", !!s1 && !!cfg?.mcpServers?.blueprint, JSON.stringify(s1));
    check("Connect: wrote only to the throwaway HOME", process.env.HOME.includes("blueprint-uitest-home-"), process.env.HOME);
    for (const d of fs.readdirSync(PARK)) fs.renameSync(path.join(PARK, d), path.join(P, d));
    check("after first run: canvas returns", !!(await waitFor(() => js(`!!document.querySelector('.react-flow__node')`), 4000)));
  }
  return failed ? 1 : 0;
};
