# Blueprint design guide

Blueprint is a local Mac app where the user keeps visual maps of ideas and systems. Hierarchy: Project -> System -> Visual (a canvas of nodes and edges). A system is one idea/mechanism with a title, one-line summary and markdown notes. Files live in ~/Blueprint/ (or $BLUEPRINT_HOME); the app live-reloads when you write.

## Design philosophy
- Accuracy first: every node and relationship must be true to what the user described or to the real system. Never invent components to make a diagram look fuller. If unsure, add a node with state `question`.
- One visual = one idea at one altitude. Aim for 5-12 nodes. More than ~15: split into several visuals of the same system (an overview plus detail visuals) instead of crowding one.
- Show, don't caption: when a drawn vector or coded visual communicates faster than words, use a `visual` node (inline SVG/HTML). Text on canvas stays short (title <= 5 words, subtitle <= 8 words); depth goes in `explanation`, which appears on click.
- Pick the relationship kind that is literally true. Use `relates` only when nothing more specific is known. Use operator nodes for combinations ("A + B = C"), groups for belonging/tiers/alternatives/boundaries.
- Every node and edge gets an `explanation` (markdown) so a click answers "what does this mean and why is it here".
- After writing, call `snapshot`, look at the result, and fix overlaps, ambiguity or clutter before reporting.
- Images: an agent that can generate images may add them via `add_asset` (then an `image` node with `asset`); one that cannot should draw SVG or code the visual instead. Never block on image generation.

## Node kinds
- `card`: title + optional subtitle + optional icon. The default variable/thing.
- `visual`: custom-drawn vector or coded visual. `svg` (inline SVG markup, sanitised before render) or `html` (self-contained, sandboxed iframe, no network). Preferred over text when a picture says it better.
- `image`: raster or svg file from the project's assets/ (`asset` = file name returned by add_asset). Optional `caption`.
- `operator`: small round symbol node; set `operator` to one of + - × ÷ = & or ≠ > <. Lets you say A + B = C literally.
- `note`: free text sticky; not part of the logic.
- `group`: a frame containing other nodes (children set `parent` to the group's id). `groupKind`: `group` = belong together, `layer` = a tier/band in a stack, `option` = one of several alternatives, `boundary` = inside vs outside the system. Groups nest.

Node fields: id, kind, position {x,y} (optional: omit and Blueprint auto-lays-out), size {w,h} (optional: omit and Blueprint sizes the node from its text so nothing clips), parent, title, subtitle, explanation, icon (lucide icon name e.g. "brain"), tone (neutral|accent|good|warn|bad|muted), state (idea|question|decided|built), weight (sm|md|lg), operator, groupKind, svg, html, asset, caption.

## Relationship kinds (edges; the whole vocabulary, do not invent others)
| kind | reads as | drawn as |
|---|---|---|
| flow | A then B / A feeds B | solid arrow |
| increases | more A -> more B | arrow with + badge, good tone |
| decreases | more A -> less B | arrow with - badge, bad tone |
| requires | A needs B to exist/work | dashed arrow |
| becomes | A turns into B | thick arrow with => badge |
| equals | A is the same thing as B | double line, = badge, no arrowheads |
| versus | A or B, a tradeoff | dotted line, "vs" badge, no arrowheads |
| blocks | A prevents B | line ending in a flat bar, bad tone |
| relates | connected, nature unspecified | thin plain line, no arrowheads |

Edge fields: id, source, target, kind, label, explanation, both (true = arrowheads at both ends), sourceHandle, targetHandle, route. `explanation` (one or two sentences on what the relationship means) is required on edges you create.
- `sourceHandle` / `targetHandle`: which side of the node the line leaves/enters: `top`, `right`, `bottom` or `left`. Leave them out; Blueprint picks the facing sides.
- `route`: computed by Blueprint on every `apply` (orthogonal bend points in absolute canvas pixels that avoid unrelated cards and group titles). Do not write it; it is recomputed. The app redraws it when someone drags a node.
- `label`: 1-4 words. It is drawn with the kind badge on the longest straight stretch of the line.
- Note text lives in `title`, `subtitle` and `caption` (caption is the body; newlines allowed).

## How to work
1. Call `list_projects` / `list_systems` first; reuse the right project and system. Create new ones only if none fit. Ask the user only if it is genuinely ambiguous which project.
2. `create_visual` (use primary:true for a system's first visual), then build with `apply`.
3. `apply` takes {projectId, systemId, visualId, ops, layout?}. Ops: add_node, update_node, remove_node, add_edge, update_edge, remove_edge, set_viewport. The whole batch is validated first and rejected atomically with fixable error messages; read them, correct, resend.
4. Layout is optional per call and you should almost never place things by hand. Omit `position` and `size`: Blueprint lays the visual out (direction "DOWN" default, or "RIGHT"), sizes each node from its text, fits every group around its children and routes every line around cards and titles.
   - What decides the order: `flow`, `becomes`, `increases`, `decreases` and `blocks` edges point down the page (or right). `requires`, `equals`, `versus` and `relates` never reorder anything. Top-level `layer` groups stack in the order you added them, full width, whatever the edges say, so a feedback edge pointing back up is fine.
   - A node linked only by `relates`/`equals`/`versus`/`requires` is placed beside its partner.
   - Children inside a group sit in tidy rows unless ordering edges link them.
   - `layout: {"relayout": true}` re-places every node from scratch (use it after big changes or when warnings report overlaps). Without it, nodes that already have a position stay put and only new ones are placed.
   - To override: give `position` (relative to the parent group's top-left when the node has a `parent`) on add_node or in an update_node patch. To hand a node back to auto-layout, patch `position: null` (and `size: null` to auto-size it again). A group's frame always grows to fit its children unless you pass the group's `size` in the same batch.
5. Ids must match `^[a-z0-9_]+(-[a-z0-9_]+)*$` (lowercase letters, digits, underscores; single hyphens between parts), e.g. `core-me`. Within one visual, node and edge ids are unique.
6. `apply` returns `boxes` (each node's absolute [x, y, w, h]) and `warnings`: overlaps, text that would clip, edges whose route crosses a card or group title, labels touching cards, more than ~15 nodes. Warnings do not block the write; fix them.
7. `snapshot` -> look at the image (its warnings come back too) -> fix -> `open` -> report in two lines.

## Worked example
```json
{
  "projectId": "bakery", "systemId": "pricing", "visualId": "overview",
  "layout": { "direction": "RIGHT" },
  "ops": [
    { "op": "add_node", "node": { "id": "loaves", "kind": "card", "title": "Loaves sold", "subtitle": "Per day", "icon": "shopping-bag",
      "explanation": "Number of loaves sold on a typical day. Drives revenue directly." } },
    { "op": "add_node", "node": { "id": "price", "kind": "card", "title": "Price per loaf",
      "explanation": "Price charged for each loaf." } },
    { "op": "add_node", "node": { "id": "times", "kind": "operator", "operator": "×",
      "explanation": "Loaves multiplied by price." } },
    { "op": "add_node", "node": { "id": "revenue", "kind": "card", "title": "Daily revenue", "tone": "good", "weight": "lg",
      "explanation": "What the bakery takes in per day." } },
    { "op": "add_edge", "edge": { "id": "e1", "source": "loaves", "target": "times", "kind": "flow",
      "explanation": "Loaves sold feed the multiplication." } },
    { "op": "add_edge", "edge": { "id": "e2", "source": "price", "target": "times", "kind": "flow",
      "explanation": "Price feeds the multiplication." } },
    { "op": "add_edge", "edge": { "id": "e3", "source": "times", "target": "revenue", "kind": "becomes",
      "explanation": "The product is the revenue." } }
  ]
}
```
Op shapes: {op:"add_node", node}, {op:"update_node", id, patch}, {op:"remove_node", id} (also removes edges touching it; a group's children must be removed or re-parented in the same batch), {op:"add_edge", edge}, {op:"update_edge", id, patch}, {op:"remove_edge", id}, {op:"set_viewport", viewport:{x,y,zoom}}.

Positions of nodes with a `parent` are relative to the parent group's top-left corner; other positions are canvas coordinates. Auto-layout sets group sizes too. update_node patches may set a field to `null` to clear it.
