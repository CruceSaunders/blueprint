---
name: blueprint-declutter-and-svg-craft
description: Load for the review pass after any Blueprint visual is written, and whenever a canvas looks messy, crowded, wordy or hard to read ("clean this up", "too busy", "declutter", "simplify"). Also load before drawing an inline SVG or HTML `visual` node, an illustration, icon-like drawing or small chart. Recipes for common shapes live in blueprint-svg-motifs.
---

# Declutter review and SVG craft

## Part 1: the review pass (run on every visual)
**Use** after every `apply` that adds or moves more than a couple of nodes, and whenever the user says it is hard to read. **Skip** only for a one-node edit.

### Method
1. **Snapshot and look.** Call `snapshot` and actually read the image. Act on every warning `apply` and `snapshot` return (overlap, clipped text, edge through a card or a group title, label touching a card, crowding).
2. **Purpose test per node and edge.** Each must help answer the visual's question (in `description`). If it does not change what the reader understands, remove it or move the fact into a neighbour's `explanation`.
3. **One home per fact.** A number or claim appears once on the canvas. If a card subtitle repeats an edge label or a note repeats a card, keep the clearest one.
4. **Short text on canvas.** Title 5 words or fewer, subtitle 8 or fewer, edge label 1-4 words. If a title and subtitle split one thought, merge them into one title. Everything else goes in `explanation`.
5. **Count.** Over ~15 non-group nodes: split into an overview visual plus detail visuals in the same system. Under 4: maybe it does not need a canvas.
6. **Emphasis budget.** At most one `weight: "lg"` node per visual (two if there are two real centres). `tone` only where it means something (good result, risk, harm); not as decoration.
7. **Check accuracy last.** Every node and edge is stated by the user or the source. Guesses become `state: "question"`. Edge kinds are literal (`relates` only when nothing better is known).
8. Fix, re-apply (use `layout: {"relayout": true}` after big changes), snapshot again. Stop when no warnings remain and the main path reads without hunting.

### Common mistakes
- **Fixing layout by hand first.** Fix: remove clutter and relayout; place by hand only what auto-layout still gets wrong.
- **Explanations on canvas.** A note restating what a card's `explanation` says. Fix: delete the note.
- **Splitting too late.** 20 nodes "because it is all related". Fix: overview with one card per area, then a visual per area.

## Part 2: drawing `visual` nodes
**Use** a `visual` when a shape says it faster than words: a trend, a proportion, a cycle, a stack, a before/after, a physical arrangement. **Do not** draw an icon substitute (use the card `icon` field) or decorate a card that already reads.

### Rules the app enforces or needs
- The app sanitises SVG: `<script>`, `<foreignObject>`, event handlers (`onclick`...), `href` and `xlink:href` are removed. So: no scripts, no links, no `<use>`, no external images or fonts, no `<image>`.
- Do not use `<style>` blocks or CSS classes; set presentation attributes on each element (`fill`, `stroke`, `stroke-width`, `font-size`, `opacity`). This survives sanitising and stays self-contained.
- Avoid `id`-based features (`<defs>` gradients, `<marker>` arrowheads, `<clipPath>`): every SVG shares one page, so ids collide between nodes. Draw arrowheads as small `<polygon>`s.
- `html` visuals run in a sandboxed iframe with no network; use them only for small interactive or animated pieces, inline everything.

### Sizing and legibility
- Use `viewBox="0 0 240 140"` and no `width`/`height`: the drawing scales to the node (default about 260 x 190 including the title strip). For a tall drawing use `0 0 240 200` and give the node `size`.
- Keep a 10-unit margin. Text 11-13 units; never under 10. At most about 6 text labels; one word each where possible. Text does not wrap in SVG: keep each label short.
- Strokes 1.5-3 units. Shapes simple enough to read at half size.

### Colour that works in light and dark
- Ink (outlines, text, axes): `currentColor`. It follows the app theme.
- Fills: one mid-tone accent at partial opacity (`fill="#3b82f6" fill-opacity=".3"`). Mid-tones `#3b82f6` blue, `#10b981` green, `#f59e0b` amber, `#ef4444` red, `#8b5cf6` violet, `#64748b` slate read on both backgrounds.
- No black, white or very light fills; no background rectangle (the card supplies it).
- Never rely on colour alone: add a label, a dash pattern, a filled vs hollow shape.

### Common mistakes
- **Clip art.** A generic drawing that does not show the mechanism. Fix: draw what changes (the level, the curve, the split).
- **Tiny text.** A 240-wide drawing with 8-unit labels is unreadable in the snapshot. Fix: fewer, larger labels; details into `caption` or `explanation`.
- **Hard-coded dark ink.** `fill="#111"` disappears in dark mode. Fix: `currentColor`.

## Worked example (how a water tower keeps pressure steady)
```json
{
  "projectId": "demo", "systemId": "water", "visualId": "tower",
  "ops": [
    { "op": "add_node", "node": { "id": "pump", "kind": "card", "title": "Pump station", "icon": "zap",
      "explanation": "Lifts treated water up into the tower tank." } },
    { "op": "add_node", "node": { "id": "tower", "kind": "visual", "title": "Height makes pressure", "caption": "Water falls to taps under its own weight",
      "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 240 140\" font-family=\"system-ui, sans-serif\" font-size=\"12\"><rect x=\"80\" y=\"10\" width=\"80\" height=\"58\" rx=\"6\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"/><rect x=\"82\" y=\"32\" width=\"76\" height=\"34\" rx=\"4\" fill=\"#3b82f6\" fill-opacity=\".45\"/><g stroke=\"currentColor\" stroke-width=\"2\"><line x1=\"90\" y1=\"68\" x2=\"80\" y2=\"128\"/><line x1=\"150\" y1=\"68\" x2=\"160\" y2=\"128\"/><line x1=\"86\" y1=\"96\" x2=\"154\" y2=\"96\"/></g><line x1=\"150\" y1=\"124\" x2=\"212\" y2=\"124\" stroke=\"#3b82f6\" stroke-width=\"3\"/><polygon points=\"210,118 210,130 220,124\" fill=\"#3b82f6\"/><text x=\"186\" y=\"114\" text-anchor=\"middle\" fill=\"currentColor\">to taps</text><line x1=\"56\" y1=\"32\" x2=\"56\" y2=\"128\" stroke=\"currentColor\" stroke-opacity=\".6\" stroke-dasharray=\"3 3\"/><line x1=\"50\" y1=\"32\" x2=\"62\" y2=\"32\" stroke=\"currentColor\" stroke-opacity=\".6\"/><line x1=\"50\" y1=\"128\" x2=\"62\" y2=\"128\" stroke=\"currentColor\" stroke-opacity=\".6\"/><text x=\"48\" y=\"84\" text-anchor=\"end\" fill=\"currentColor\">height</text></svg>",
      "explanation": "Water pressure at a tap depends on how far the water surface sits above it, so the tank is put high and kept partly full." } },
    { "op": "add_node", "node": { "id": "level", "kind": "card", "title": "Tank level", "icon": "gauge",
      "explanation": "How full the tank is. A higher level means slightly more pressure and more reserve." } },
    { "op": "add_node", "node": { "id": "pressure", "kind": "card", "title": "Tap pressure", "tone": "good", "weight": "lg",
      "explanation": "The pressure households get. Stays steady because the tank buffers changes in demand." } },
    { "op": "add_node", "node": { "id": "demand", "kind": "card", "title": "Peak demand", "subtitle": "Mornings and evenings", "icon": "users",
      "explanation": "Times when many households draw water at once." } },
    { "op": "add_node", "node": { "id": "sensor", "kind": "card", "title": "Level sensor", "icon": "activity",
      "explanation": "Measures the tank level and switches the pump on when it drops below a set point." } },
    { "op": "add_node", "node": { "id": "backup", "kind": "card", "title": "Backup during power cut?", "state": "question",
      "explanation": "Not stated whether the pump station has backup power. Without it the tank only lasts as long as its reserve." } },
    { "op": "add_edge", "edge": { "id": "e-pump-tower", "source": "pump", "target": "tower", "kind": "flow", "label": "fills",
      "explanation": "The pump pushes water up into the tank." } },
    { "op": "add_edge", "edge": { "id": "e-tower-level", "source": "tower", "target": "level", "kind": "relates", "label": "blue fill",
      "explanation": "The blue fill in the drawing is the tank level." } },
    { "op": "add_edge", "edge": { "id": "e-level-pressure", "source": "level", "target": "pressure", "kind": "increases",
      "explanation": "A fuller tank sits higher, giving a little more pressure at the taps." } },
    { "op": "add_edge", "edge": { "id": "e-demand-level", "source": "demand", "target": "level", "kind": "decreases",
      "explanation": "Heavy use drains the tank faster than the pump refills it." } },
    { "op": "add_edge", "edge": { "id": "e-sensor-pump", "source": "sensor", "target": "pump", "kind": "flow", "label": "switches on",
      "explanation": "When the level falls below the set point, the sensor starts the pump." } },
    { "op": "add_edge", "edge": { "id": "e-pump-backup", "source": "pump", "target": "backup", "kind": "requires",
      "explanation": "The pump needs power; whether a backup supply exists is the open question." } }
  ]
}
```
