# Blueprint design guide

Blueprint is a local Mac app where the user keeps visual maps of ideas and systems. Hierarchy: Project -> System -> Visual (a canvas of nodes and edges). A system is one idea/mechanism with a title, one-line summary and markdown notes. Files live in ~/Blueprint/ (or $BLUEPRINT_HOME); the app live-reloads when you write.

## Design philosophy
- Accuracy first: every node and relationship must be true to what the user described or to the real system. Never invent components to make a diagram look fuller. If unsure, add a node with state `question`.
- One visual = one idea at one altitude. Aim for 5-12 nodes. More than ~15: split into an overview plus detail visuals of the same system.
- **The picture takes the system's own shape.** A loop is drawn as a ring, a central thing as a hub with spokes, a breakdown as a tree, a sequence as a straight flow. Tiers (stacked layer groups) only when the system really is layered. Never default to "boxes inside boxes".
- **Art lives on the part.** When a drawing shows what a part does (a funnel for a filter, a cup for cups sold), put it on that card as `art`: the card IS the funnel, with its name under it. Never draw a part as a separate `visual` node joined to it by a `relates` / "illustrates" line; apply warns when it sees one.
- **Symmetry and calm.** Blueprint centres every rank on one axis, spaces siblings evenly, attaches lines at side midpoints and keeps the main line straight. Your job is to give it a clean structure: few crossings, short labels, nothing placed by hand.
- Text on canvas stays short (title <= 5 words, subtitle <= 8 words, edge label 1-4 words). Depth goes in `explanation` (markdown, shown on click). Every node and edge gets one.
- Pick the relationship kind that is literally true; `relates` only when nothing more specific is known.
- After writing, `snapshot`, look, and fix every warning and tidiness defect before reporting.
- Images: an agent that can generate images may add them via `add_asset`; one that cannot draws SVG. Never block on image generation.

## Choose the arrangement from the system's shape
Pass it for the whole canvas as `layout: {"arrangement": ...}` (remembered on the visual), or on a group as its `arrangement` field.
| The system is... | arrangement | how it draws |
|---|---|---|
| steps, a pipeline, cause and effect in one direction | `flow` (default when edges order things) | ranks along `direction` DOWN or RIGHT, each rank centred on one axis; back steps go to an outer gutter |
| a short sequence (2-6) | `row` / `column` | one straight line, equal gaps |
| a cycle that returns to its start | `ring` | members evenly round a loop, consecutive ones joined by curved arrows |
| one central thing everything touches | `hub` | the most-connected node in the middle, the rest as mirrored spokes |
| a breakdown or hierarchy | `tree` | parents centred over their children |
| tiers that really are layers | `stack` (or `flow` with `layer` groups) | full-width bands stacked in the order added |
| peers with no order | `grid` (default for 6+ unordered) | equal cells, rows centred |
| a layout the user arranged by hand | `free` | nothing moves; new nodes go below |
When NOT to use tiers: parts that merely belong together (use a `tint` group or no group), a process (use `flow`), a loop (use `ring`). Nest groups at most one level deep.

## Node kinds and fields
- `card`: the default thing/part. title, optional subtitle, icon (lucide name, e.g. "brain"), and optionally:
  - `shape` by meaning: `card` (a part or thing, default), `pill` (a step, state or tool), `circle` (an actor, or a stage of a loop), `diamond` (a decision; title it as the question), `plain` (no container: just the art or icon with the label under it).
  - `art`: the card's own drawing, drawn inside it above the title: `{"svg": "<svg ...>"}` or `{"html": "..."}` (sandboxed) or `{"asset": "file.png"}`, plus optional `"size": "sm"|"md"|"lg"`. Art replaces the icon.
- `visual`: a drawing that is its own element (a chart summarising the whole map, a legend). `svg` or `html`. Not for depicting one part: that is `art`.
- `image`: a file from the project's assets/ (`asset` from add_asset). Optional `caption`.
- `operator`: small round symbol (`operator`: + - × ÷ = & or ≠ > <) to say A + B = C literally.
- `note`: free text sticky; not part of the logic.
- `group`: contains nodes (children set `parent`). `groupKind`: `group` belong together, `layer` a tier, `option` an alternative, `boundary` inside vs outside. Optional `arrangement` (above) and `treatment` (how it is drawn): `band` (hairline band, default for `layer`), `tint` (soft region, default for `group`), `frame` (outlined box, default for `option`/`boundary`), `bracket` (a side rule), `none` (label only).

All node fields: id, kind, position, size, parent, title, subtitle, explanation, icon, tone (neutral|accent|good|warn|bad|muted), state (idea|question|decided|built), weight (sm|md|lg), shape, art, operator, groupKind, arrangement, treatment, svg, html, asset, caption. Leave out `position` and `size`.

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

Edge fields: id, source, target, kind, label, explanation (required), both (arrowheads at both ends), sourceHandle/targetHandle (leave out; Blueprint picks sides), route (computed; do not write). `flow`, `becomes`, `increases`, `decreases` and `blocks` decide order; `requires`, `equals`, `versus` and `relates` never reorder, and a node tied only by them sits beside its partner.

## How to work
1. `list_projects` / `list_systems`; reuse what fits. `create_visual` (primary:true for a system's first).
2. Decide the shape first: which arrangement, which nodes are steps (pill), actors (circle), decisions (diamond), and which part deserves its own drawing (`art`).
3. `apply({projectId, systemId, visualId, ops, layout?})`. Ops: add_node, update_node, remove_node, add_edge, update_edge, remove_edge, set_viewport. The batch is validated whole and rejected atomically with fixable messages. `layout`: `{arrangement?, direction?: "DOWN"|"RIGHT", relayout?: true}`; a new arrangement or direction re-places everything, and so does relayout. A group whose `arrangement`/`treatment` you patch re-places its own contents.
4. `apply` returns `warnings` (overlap, clipped text, a line through a card or title, label clashes, crowding, `illustration-node`) and `tidiness` (`defects`: off-centre attachments, more than two bends, unequal gaps, off-axis ranks, lines through a group that holds neither end; plus `metrics`). Fix both to zero: usually by removing clutter, choosing a better arrangement, or turning an illustration node into `art`. Positions by hand are a last resort.
5. Ids match `^[a-z0-9_]+(-[a-z0-9_]+)*$`, unique within the visual. Child positions are relative to the parent group. A patch value of `null` clears a field (`position: null` hands a node back to layout).
6. `snapshot` -> look at the image -> fix -> `open` -> report in two lines.

## Worked example (a bakery's daily revenue)
```json
{
  "projectId": "bakery", "systemId": "pricing", "visualId": "overview",
  "layout": { "direction": "RIGHT" },
  "ops": [
    { "op": "add_node", "node": { "id": "loaves", "kind": "card", "title": "Loaves sold", "subtitle": "Per day",
      "art": { "size": "sm", "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 120 60\"><path d=\"M22 44 Q20 18 60 16 Q100 18 98 44 Z\" fill=\"#f59e0b\" fill-opacity=\".35\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linejoin=\"round\"/><g stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-opacity=\".6\"><path d=\"M44 24 L40 34\"/><path d=\"M62 22 L58 33\"/><path d=\"M80 24 L76 34\"/></g></svg>" },
      "explanation": "Number of loaves sold on a typical day. Drives revenue directly." } },
    { "op": "add_node", "node": { "id": "price", "kind": "card", "title": "Price per loaf", "icon": "tag",
      "explanation": "Price charged for each loaf." } },
    { "op": "add_node", "node": { "id": "times", "kind": "operator", "operator": "×",
      "explanation": "Loaves multiplied by price." } },
    { "op": "add_node", "node": { "id": "revenue", "kind": "card", "title": "Daily revenue", "icon": "banknote", "tone": "good", "weight": "lg",
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
The two inputs sit in one rank, mirrored about the axis, and meet at the × as one symmetric merge; the result runs straight on. The loaf drawing is the "Loaves sold" card itself.
