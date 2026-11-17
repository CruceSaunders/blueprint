---
name: blueprint-declutter-and-svg-craft
description: Load for the review pass after any Blueprint visual is written, and whenever a canvas looks messy, crowded, wordy or hard to read ("clean this up", "too busy", "declutter", "simplify"). Also load before drawing an inline SVG or HTML `visual` node, an illustration, icon-like drawing or small chart. Recipes for common shapes live in blueprint-svg-motifs.
---

# Declutter review and SVG craft

## Part 1: the review pass (run on every visual)
**Use** after every `apply` that adds or moves more than a couple of nodes, and whenever the user says it is hard to read. **Skip** only for a one-node edit.

### Method
1. **Snapshot and look.** Call `snapshot` and actually read the image. Act on every warning (overlap, clipped text, edge through a card or a group title, label touching a card, crowding, illustration node) and every `tidiness` defect (off-centre attachment, more than two bends, unequal gaps, off-axis rank, a line through a group that holds neither end). Target: zero of both.
2. **Shape test.** Does the arrangement match the system (ring for a loop, hub for a centre, flow for a sequence, tiers only for real layers)? Are there boxes inside boxes inside boxes? Change the arrangement before moving anything. Is a part drawn as a separate picture joined by a line? Move the drawing into the part's `art`.
3. **Purpose test per node and edge.** Each must help answer the visual's question (in `description`). If it does not change what the reader understands, remove it or move the fact into a neighbour's `explanation`. Merge two nodes that always appear together. A line the layout or a group already shows can go.
4. **One home per fact.** A number or claim appears once on the canvas. If a card subtitle repeats an edge label or a note repeats a card, keep the clearest one.
5. **Short text on canvas.** Title 5 words or fewer, subtitle 8 or fewer, edge label 1-4 words. If a title and subtitle split one thought, merge them into one title. Everything else goes in `explanation`.
6. **Count.** Aim for 5-9 non-group nodes. Above 12: split into an overview visual plus detail visuals in the same system. Under 4, or a list a sentence or small table says as well: do not draw it.
7. **Emphasis budget.** 1-2 focal nodes per visual (`tone: "accent"` or `weight: "lg"`); the rest stay neutral. Other `tone`s only where they mean something (good result, risk, harm), never as decoration.
8. **Check accuracy last.** Every node and edge is stated by the user or the source. Guesses become `state: "question"`. Edge kinds are literal (`relates` only when nothing better is known).
9. Fix, re-apply (`layout: {"relayout": true}` after big changes), snapshot again. Stop when warnings and tidiness defects are zero, the picture is symmetric about its axis and the main path reads without hunting.

### Common mistakes
- **Fixing layout by hand first.** Fix: remove clutter, choose a better arrangement and relayout; hand placement breaks symmetry and is a last resort.
- **Explanations on canvas.** A note restating what a card's `explanation` says. Fix: delete the note.
- **Splitting too late.** 20 nodes "because it is all related". Fix: overview with one card per area, then a visual per area.

## Part 2: drawing art
**Where the drawing goes.** A drawing of one part (a funnel for a filter, a tank for a store) is that card's `art`: `{"svg": "...", "size": "sm"|"md"|"lg"}`, drawn inside the card above its title. With `shape: "plain"` the drawing stands on the canvas with its name under it and no box. A standalone `visual` node is only for a picture of the whole (a summary chart, a legend), never joined to one card by a `relates` line.
**Use** a drawing when a shape says it faster than words: a trend, a proportion, a stack, a before/after, a physical arrangement. **Do not** draw an icon substitute (use the card `icon` field) or decorate a card that already reads.

### Rules the app enforces or needs
- The app sanitises SVG: `<script>`, `<foreignObject>`, event handlers (`onclick`...), `href` and `xlink:href` are removed. So: no scripts, no links, no `<use>`, no external images or fonts, no `<image>`.
- Do not use `<style>` blocks or CSS classes; set presentation attributes on each element (`fill`, `stroke`, `stroke-width`, `font-size`, `opacity`). This survives sanitising and stays self-contained.
- Avoid `id`-based features (`<defs>` gradients, `<marker>` arrowheads, `<clipPath>`): every SVG shares one page, so ids collide between nodes. Draw arrowheads as small `<polygon>`s.
- `html` visuals run in a sandboxed iframe with no network; use them only for small interactive or animated pieces, inline everything.

### Sizing and legibility
- Use `viewBox="0 0 240 140"` (or `0 0 240 120` for art) and no `width`/`height`: the drawing scales into its area (art: the card's width by 56/96/136 px for sm/md/lg; a `visual` node: about 256 x 150). Draw edge to edge with a small margin; wide, short drawings suit art best.
- Keep a 10-unit margin. Text 11-13 units; never under 10. At most about 6 text labels; one word each where possible. Text does not wrap in SVG: keep each label short.
- Strokes 1.5-3 units. Shapes simple enough to read at half size.

### Colour that works in light and dark
- Ink (outlines, text, axes): `currentColor`. It follows the app theme.
- Fills: one mid-tone accent at partial opacity (`fill="#3b82f6" fill-opacity=".3"`). Mid-tones `#3b82f6` blue, `#10b981` green, `#f59e0b` amber, `#ef4444` red, `#8b5cf6` violet, `#64748b` slate read on both backgrounds.
- No black, white or very light fills; no background rectangle (the card supplies it).
- Never rely on colour alone: add a label, a dash pattern, a filled vs hollow shape.

### Common mistakes
- **Clip art.** A generic drawing that does not show the mechanism. Fix: draw what changes (the level, the curve, the split).
- **Tiny text.** A 240-wide drawing with 8-unit labels is unreadable in the snapshot. Fix: in art, no text at all (the card's title is the label); elsewhere fewer, larger labels.
- **Hard-coded dark ink.** `fill="#111"` disappears in dark mode. Fix: `currentColor`.

## Worked example (how a water tower keeps pressure steady)
The tower is drawn on its own card; nothing else needs a picture.
```json
{
  "projectId": "demo", "systemId": "water", "visualId": "tower",
  "ops": [
    {"op": "add_node", "node": {"id": "sensor", "kind": "card", "shape": "pill", "title": "Level sensor", "icon": "activity", "explanation": "Measures the tank level and switches the pump on when it drops below a set point."}},
    {"op": "add_node", "node": {"id": "pump", "kind": "card", "title": "Pump station", "icon": "zap", "explanation": "Lifts treated water up into the tower tank."}},
    {"op": "add_node", "node": {"id": "backup", "kind": "card", "title": "Backup power?", "state": "question", "explanation": "Not stated whether the pump station has backup power. Without it the tank only lasts as long as its reserve."}},
    {"op": "add_node", "node": {"id": "tower", "kind": "card", "title": "Water tower", "subtitle": "Height makes pressure", "weight": "lg", "art": {"size": "lg", "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 240 120\"><rect x=\"84\" y=\"6\" width=\"72\" height=\"50\" rx=\"6\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\"/><rect x=\"87\" y=\"26\" width=\"66\" height=\"27\" rx=\"3\" fill=\"#3b82f6\" fill-opacity=\".45\"/><g stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\"><line x1=\"94\" y1=\"56\" x2=\"84\" y2=\"114\"/><line x1=\"146\" y1=\"56\" x2=\"156\" y2=\"114\"/><line x1=\"90\" y1=\"84\" x2=\"150\" y2=\"84\"/></g><line x1=\"152\" y1=\"110\" x2=\"214\" y2=\"110\" stroke=\"#3b82f6\" stroke-width=\"3\"/><polygon points=\"212,104 212,116 222,110\" fill=\"#3b82f6\"/></svg>"}, "explanation": "Water pressure at a tap depends on how far the water surface sits above it, so the tank is put high and kept partly full. The blue fill is the tank level."}},
    {"op": "add_node", "node": {"id": "demand", "kind": "card", "title": "Peak demand", "subtitle": "Mornings and evenings", "icon": "users", "explanation": "Times when many households draw water at once."}},
    {"op": "add_node", "node": {"id": "pressure", "kind": "card", "title": "Tap pressure", "icon": "gauge", "tone": "good", "explanation": "The pressure households get. Stays steady because the tank buffers changes in demand."}},
    {"op": "add_edge", "edge": {"id": "e-sensor-pump", "source": "sensor", "target": "pump", "kind": "flow", "label": "switches on", "explanation": "When the level falls below the set point, the sensor starts the pump."}},
    {"op": "add_edge", "edge": {"id": "e-pump-backup", "source": "pump", "target": "backup", "kind": "requires", "explanation": "The pump needs power; whether a backup supply exists is the open question."}},
    {"op": "add_edge", "edge": {"id": "e-pump-tower", "source": "pump", "target": "tower", "kind": "flow", "label": "fills", "explanation": "The pump pushes water up into the tank."}},
    {"op": "add_edge", "edge": {"id": "e-demand-tower", "source": "demand", "target": "tower", "kind": "decreases", "explanation": "Heavy use drains the tank faster than the pump refills it."}},
    {"op": "add_edge", "edge": {"id": "e-tower-pressure", "source": "tower", "target": "pressure", "kind": "increases", "explanation": "A fuller tank sits higher, giving a little more pressure at the taps."}}
  ]
}
```
