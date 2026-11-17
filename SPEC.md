# Blueprint — spec

Local-only Mac app: a bird's-eye place to build and store visuals of ideas and systems.
Mostly driven by AI through an MCP server; also fully editable by hand. Accuracy and clarity above all.
No model picker, no accounts, no cloud.

## Layout of this repo
- `SPEC.md`  this file
- `app/`     Electron + Vite + React + TypeScript desktop app; its main process also serves MCP (`--mcp`) and runs `--connect`
- `mcp/`     the MCP server (`mcp/src`, one implementation for both hosts), guide text, bundled skills (`mcp/skills/*.md`)
- `setup.sh` build-from-source installer; `README.md`, `LICENSE` (MIT)

## Hierarchy
Project → System → Visual (a canvas). A project is an existing project or a new idea. A system is one
idea/mechanism inside it, with a title, a one-line summary and markdown notes. A system has one primary
visual and may have more.

## Store (single source of truth, plain files) — `~/Blueprint/`, or `$BLUEPRINT_HOME` when set
```
~/Blueprint/projects/<projectId>/project.json
~/Blueprint/projects/<projectId>/systems/<systemId>/system.json
~/Blueprint/projects/<projectId>/systems/<systemId>/visuals/<visualId>.json
~/Blueprint/projects/<projectId>/assets/<file>        images, svg files
```
Ids match `^[a-z0-9_]+(-[a-z0-9_]+)*$` (lowercase letters, digits, underscores; single hyphens between parts),
unique within their parent. Both writers refuse symbolic links anywhere below the store root and any path whose real
path leaves `realpath(store root)`; JSON files over 32 MB are not read. All writes are atomic (write `*.tmp`, rename).
Every JSON has `rev` (integer, +1 on each write) and ISO `createdAt`/`updatedAt`.
Both the app and the MCP server read and write these files directly; the app watches the folder and
live-reloads, so AI edits appear on screen within about a second. Last write wins; a writer re-reads the
file immediately before applying a change.

project.json: `{ id, title, description, notes, systemOrder: string[], rev, createdAt, updatedAt }`
system.json:  `{ id, title, summary, notes, primaryVisual: string|null, visualOrder: string[], rev, ... }`
visual.json:
```
{ id, title, description, rev, createdAt, updatedAt,
  viewport: { x, y, zoom },
  arrangement?: Arrangement,           // the top-level canvas's arrangement (set via apply layout.arrangement)
  direction?: "DOWN"|"RIGHT",          // main direction of flow/tree (set via apply layout.direction)
  nodes:  Node[], edges: Edge[] }
```

### Node
```
{ id, kind, position?: {x,y}, size?: {w,h}, parent?: groupNodeId,   // size omitted = computed from the text; groups auto-fit their children
  title?, subtitle?,                 // short; title ≤ 5 words, subtitle ≤ 8 words
  explanation?,                      // markdown; shown in the detail panel when clicked. REQUIRED for AI-made nodes
  icon?,                             // lucide icon name, e.g. "brain"
  tone?: "neutral"|"accent"|"good"|"warn"|"bad"|"muted",
  state?: "idea"|"question"|"decided"|"built",
  weight?: "sm"|"md"|"lg",           // visual importance
  // kind-specific:
  operator?: "+"|"-"|"×"|"÷"|"="|"&"|"or"|"≠"|">"|"<",   // kind=operator
  shape?: "card"|"pill"|"circle"|"diamond"|"plain",       // kind=card; default card
  art?: { svg?: string, html?: string, asset?: string,     // kind=card: its own drawing, exactly one of svg/html/asset,
          size?: "sm"|"md"|"lg" },                         //   drawn inside the card above the title (56/96/136 px tall)
  groupKind?: "group"|"layer"|"option"|"boundary",        // kind=group
  arrangement?: Arrangement,                               // kind=group: how its children are placed
  treatment?: "frame"|"band"|"tint"|"bracket"|"none",      // kind=group: how it is drawn
  svg?: string,                      // kind=visual: inline SVG markup (sanitised before render)
  html?: string,                     // kind=visual: self-contained HTML, rendered in a sandboxed iframe, no network
  asset?: string,                    // kind=image: file name inside the project's assets/
  caption?: string }
```
Node kinds:
- `card`     title + optional subtitle + optional icon. The default variable/thing. `shape` by meaning: `card` (a part),
             `pill` (a step, state or tool), `circle` (an actor or loop stage), `diamond` (a decision), `plain` (no container:
             art or icon with the label under it). `art` puts a drawing ON the card (the part is drawn as itself); it
             replaces the icon. A part is never depicted by a separate visual/image node joined to it by `relates`.
- `visual`   custom-drawn vector or coded visual (svg or html) that is its own element (a picture of the whole, a legend).
             To depict one part, use that card's `art`.
- `image`    raster or svg file from assets/.
- `operator` small round symbol node: lets you say `A + B = C` literally.
- `note`     free text sticky; not part of the logic.
- `group`    a frame containing other nodes (children set `parent`). groupKind: `group` = belong together,
             `layer` = a tier/band in a stack, `option` = one of several alternatives, `boundary` = inside vs outside the system.
             Groups nest (depth 1 is the norm). `treatment` defaults: layer = `band` (hairline top/bottom, faint tint, small-caps
             label), group = `tint` (soft region, no border), option/boundary = `frame` (outlined box with kind label);
             `bracket` = a side rule with ticks; `none` = label only.

### Edge (relationship)
```
{ id, source, target, kind, label?, explanation?, both?: boolean,
  sourceHandle?, targetHandle?,       // "top"|"right"|"bottom"|"left" only; omit and Blueprint picks facing sides
  route?: {x,y}[] }                   // computed by Blueprint on every apply (absolute canvas px); callers do not write it
```
`explanation` is REQUIRED for AI-made edges: one or two sentences saying what this relationship means.
Relationship kinds (the whole vocabulary — do not invent others):
| kind      | reads as                         | drawn as |
|-----------|----------------------------------|----------|
| flow      | A then B / A feeds B             | solid arrow |
| increases | more A → more B                  | arrow with a + badge, good tone |
| decreases | more A → less B                  | arrow with a − badge, bad tone |
| requires  | A needs B to exist/work          | dashed arrow |
| becomes   | A turns into B                   | thick arrow with ⇒ badge |
| equals    | A is the same thing as B         | double line, = badge, no arrowheads |
| versus    | A or B, a tradeoff               | dotted line, "vs" badge, no arrowheads |
| blocks    | A prevents B                     | line ending in a flat bar, bad tone |
| relates   | connected, nature unspecified    | thin plain line, no arrowheads |
`both: true` draws arrowheads at both ends (two-way flow, feedback).
The other relationship mediums are structural, not edges: operator nodes (combination, equations),
groups (belonging, tiers, alternatives, boundaries), tone/state/weight (status and importance), notes.

## Auto-layout (symmetry first; `mcp/src/layout.ts`, copied 1:1 to `app/src/lib/layout.ts`; no dependencies)
Positions are optional when AI creates nodes. If any new node lacks `position`, the MCP server lays the visual out and
writes positions back. Existing hand-placed nodes keep their positions unless `layout.relayout: true` (re-places every
node). A new `layout.arrangement` or `layout.direction` (both stored on the visual) re-places everything; patching a
group's `arrangement` or `treatment` re-places that group's children. Nodes without `size` are sized from their content
(sizes are multiples of 8; card widths sm 176, md 224, lg 256); groups fit their children with equal left/right margins
unless the group's `size` is given in the same batch. A patch value of `null` clears that field.

Every container (the canvas or a group) has an arrangement. Default: `flow` when ordering edges or 2+ `layer` groups are
present, else `row` (DOWN) / `column` (RIGHT) for up to 5 children, else `grid`.
| arrangement | placement |
|---|---|
| `flow` | ranks along `direction`, longest-path ranking (sources pulled next to their first consumer), barycenter ordering. The longest chain (spine) sits dead centre on the axis; other ranks are centred on it; equal gaps. A node whose only way out is a back edge (a feedback step) goes to the outer gutter beside the flow, level with the midpoint of what it connects. Top-level `layer` groups chain in insertion order and get one common width. |
| `stack` | children in insertion order along the direction, centred, `layer` bands equal width. In a stack or flow of bands, each band's row of parts takes the column grid of the widest band (same count) or spreads evenly across its span (other counts). |
| `row` / `column` | one centred line, equal gaps (or equal centre spacing on a column grid); cards of one shape in a row share one height |
| `ring` | members evenly round an ellipse starting at the top, in cycle order |
| `hub` | most-connected child in the centre; spokes: 1-2 left/right, 3 adds top, 4 = cross, more = mirrored columns (+ top when odd) |
| `tree` | tidy tree, parents centred over their children |
| `grid` | equal cells, rows centred |
| `free` | nothing moves; new nodes go in a row below |
Nodes tied only by `requires`/`equals`/`versus`/`relates` sit beside their partner (right, then left, mirrored; the
partner keeps its place on the axis). Edge kinds that drive order: `flow`, `becomes`, `increases`, `decreases`, `blocks`.

Routing: lines attach at the midpoint of a side; several on one side spread symmetrically about it, except that a line
running dead straight keeps the centre. Same-kind lines leaving or entering one side in the same direction share one
port and split as a trunk. Sides are chosen for the fewest bends: straight, L (one elbow), Z (one jog, the channel slid
clear of obstacles) or C through an outer gutter; a search router is the fallback. Lines never pass through cards, group
titles or a group that holds neither end. Consecutive `ring` members are joined by a curve (a quarter ellipse between
side midpoints, bulging outward); its badge and label sit on the arc (stacked when the arc runs steeply). Labels and kind badges sit centred on the line's main stretch (stacked along a
vertical one), never on a stretch shared with another line. Rank gaps leave room for labels; a labelled fan gets twice.

Tidiness (`tidiness(nodes, edges, {arrangement, direction})`, returned by apply, get_visual and snapshot):
`defects` (off-centre attachments, more than two bends on an orthogonal line, unequal sibling gaps, ranks off the axis,
satellites not level with their partner, ring/hub members without a mirror partner, lines through a group that holds
neither end, group contents with unequal left/right margins, `row-uneven-height`, `row-misaligned` (a band's row off the
widest band's columns), `ring-off-arc` (members off one ellipse, or an arc's badge/label off its arc) and
`ring-unequal-angles`) and `metrics` (counts plus total and max bends).

## App behaviour
- Left sidebar: projects → systems → visuals tree; create, rename, delete (confirm, to the Trash), reorder. Search.
- Main: infinite canvas (React Flow / @xyflow/react): pan, zoom, minimap, fit view, zoom controls.
- Manual editing: add any node kind from a small toolbar, drag, resize, edit text inline, connect nodes by
  dragging handle to handle, pick/change relationship kind from a compact picker, delete, group/ungroup,
  undo/redo, Tidy (auto-layout).
- Click a node or an edge → right detail panel with its title, kind in plain words and `explanation` as markdown; editable.
- System notes (markdown) viewable/editable from the header of a system.
- Live reload when files change on disk; never clobber a newer `rev` (re-read before write, debounce saves ~400ms).
- Legend popover explaining the nine relationship kinds and four group kinds. Light and dark.
- First-run screen and the menu item **Blueprint > Connect AI tools…** list detected tools with one Connect button
  (same code as `--connect`).

## Command line (one binary: `Blueprint.app/Contents/MacOS/Blueprint`)
- `--snapshot <projectId>/<systemId>/<visualId> --out <png> [--width 1800] [--theme dark] [--scale 1|2|3]`: renders the visual in a hidden
  offscreen window (no Dock icon, no focus), fits the view, writes a PNG, prints `<path> <w>x<h>`, exits 0.
- `--open <p>/<s>/<v>` and the deep link `blueprint://open/<p>/<s>/<v>` select that visual. The parser never throws and
  never shows a dialog; ids must match the id pattern, otherwise the link is ignored.
- `--mcp`: serves the MCP server over stdio from the Electron main process (headless: no window, no Dock icon, no dialogs;
  stdout carries only protocol bytes, logs go to stderr; exits when stdin closes). Needs no Node install and works with
  the RunAsNode fuse off. Snapshots run this same binary.
- Headless modes and LaunchServices: `--mcp`, `--snapshot`, `--connect` and `--disconnect` run background-only (activation
  policy `prohibited`, no Dock icon) and never take the single-instance lock or claim `blueprint://`. macOS still checks them
  in under the app's bundle id before any code runs, so a Dock click, Finder open, `open -a`, or a `blueprint://` link may be
  delivered to one of them. They forward it: start the GUI from their own executable (detached, stdio ignored, so it outlives
  them and `--mcp` stdout stays protocol-only) with `--activate` or `--open=<p>/<s>/<v>`. The GUI's single-instance lock
  dedupes; a running GUI receives the request as `second-instance`, shows its window (focus only for `--activate`) and
  navigates. Regression test: `app/scripts/launch-test.mjs` (packaged build).
- Test probe: with `BLUEPRINT_GUI_STATUS=1` the GUI writes `<store>/.gui-status.json`, uses a profile under the store (its
  own single-instance lock), never takes focus and does not claim `blueprint://`.
- `--connect [--tools claude,cursor,codex] [--dry-run]`: registers `<this binary> --mcp` as MCP server `blueprint` in
  each detected (or listed) tool and installs the skills; prints every change. Claude Code: `~/.claude.json`
  `mcpServers`; Cursor: `~/.cursor/mcp.json`; Codex: `~/.codex/config.toml` `[mcp_servers.blueprint]`. Skills:
  `~/.claude/skills/<name>/SKILL.md` (Claude Code) and `~/.agents/skills/<name>/SKILL.md` (Cursor, Codex). Each config is
  backed up next to itself (`.blueprint-backup-<UTC time>`) before a change; other entries are never touched; re-running
  is a no-op. A different existing skill of the same name is moved to `<skills>-backups/` and reported.
- `--disconnect [--tools ...] [--dry-run]`: removes exactly what `--connect` added and restores any moved skill.
- Development builds only (absent from packaged apps, which exit 2): `--ui-test <driver>`, `--ui-shot <png> [--scale n]`, `--ui-eval <js>`.
  `--scale` sets device pixels per CSS pixel of the PNG (default 1).
- Environment: `BLUEPRINT_HOME` (store root), `BLUEPRINT_APP_BIN` (snapshot binary for the Node-hosted server).

## Security
- Every window: `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`; navigation, new windows, webviews,
  downloads and permission requests denied; DevTools and Reload only in development builds.
- Network: `host-resolver-rules MAP * ~NOTFOUND`, proxy `127.0.0.1:9` with loopback not bypassed, WebRTC policy
  `disable_non_proxied_udp` on every webContents, http/https/ws/wss/ftp requests cancelled, on every session.
- HTML visuals: `sandbox="allow-scripts"` iframe (opaque origin) loading a `bp-frame:` document that the main process
  serves with a CSP response header (`default-src 'none'`, inline script/style only). Not srcdoc: that would inherit the
  app's CSP, which forbids inline scripts. SVG: DOMPurify, no script, style,
  foreignObject, use, image, a, href or src.
- Limits: 500 ops per `apply`, 1,000 nodes / 2,000 edges per visual, `svg`/`html` 200,000 characters, explanation 20,000.
- `add_asset`: `fromPath` must be absolute, a regular file (lstat; no symlink, device or FIFO), not inside a dot-directory,
  at most 10 MB; bytes must match the extension (PNG/JPEG/GIF/WEBP signature, SVG by content); SVG with script, style,
  foreignObject, event handlers, external href/url() or entities is refused. Errors never contain absolute paths.
- Release: hardened runtime, entitlement `com.apple.security.cs.allow-jit` only, Developer ID signature + notarization
  (opt-in via `BLUEPRINT_SIGN_IDENTITY` and `APPLE_KEYCHAIN_PROFILE`), fuses: RunAsNode off, NodeOptions off,
  NodeCliInspect off, EmbeddedAsarIntegrityValidation on, OnlyLoadAppFromAsar on. Targets: `Blueprint.dmg` and
  `Blueprint-mac-arm64.zip` (stable names for a permanent latest-release link).
  Bundle id `com.cruce.blueprint`.

## MCP server — name `blueprint`, stdio
Hosts: `Blueprint --mcp` (installed app) or `node mcp/dist/index.js` (from source). One implementation (`mcp/src/server.ts`).
The `instructions` field is a short router (under 2,000 characters): what Blueprint is, call `guide` first, the topic index.
Tools (keep names exactly):
- `guide({topic?})` → no topic: the design philosophy + vocabulary + how to work + worked example, plus a one-line index of
  topics. `topic`: the body of that bundled skill (`mcp/skills/<name>.md`, topic = name without `blueprint-`). Unknown topic:
  error listing the valid ones. The same source files generate the installed SKILL.md files, so text cannot drift.
- `list_projects()`, `create_project({title, description?, notes?})`, `update_project`, `delete_project` (requires `confirm:true`)
- `list_systems({projectId})`, `create_system({projectId, title, summary?, notes?})`, `update_system`, `delete_system` (confirm)
- `list_visuals({projectId, systemId})`, `create_visual({projectId, systemId, title, description?, primary?})`,
  `update_visual`, `get_visual({...ids})` → full JSON plus `boxes` (absolute `[x,y,w,h]` per node), `warnings` and `tidiness`,
  `delete_visual` (confirm)
- `apply({ids, ops: Op[], layout?: {direction?: "DOWN"|"RIGHT", relayout?: boolean}})` — the one write tool for canvas
  content. Ops: `add_node`, `update_node`, `remove_node`, `add_edge`, `update_edge`, `remove_edge`, `set_viewport`.
  `layout`: `{direction?, relayout?, arrangement?}`.
  Whole batch validated first (unknown kinds, dangling edge endpoints, missing explanation on new nodes/edges, duplicate ids,
  parent not a group, size limits, `shape`/`art` only on cards, `art` with exactly one of svg/html/asset, `arrangement`/
  `treatment` only on groups) and rejected atomically with precise, fixable error messages. Returns the new rev,
  a compact summary, `boxes`, `warnings` (overlaps, clipped text, edges crossing cards, labels on cards or on other
  edges' labels/lines, crowding, `illustration-node`: a visual/image whose only edge is a `relates` to one card) and
  `tidiness`.
- `add_asset({projectId, fromPath? | svg? | base64? + filename})` → writes into assets/ (checks above), returns the file name.
- `snapshot({ids, width?})` → runs the app's headless snapshot mode and returns the PNG as an MCP image block plus `warnings`
  and the tidiness defects.
  The app binary is found from `BLUEPRINT_APP_BIN`, the running app itself, a repo build, or the Applications folders.
- `open({ids})` → opens the app at that visual (`open -g blueprint://open/...`, background, no focus steal).
- `search({query})` → matches across project/system/visual titles, notes, node and edge text.
Server validates everything with zod and never writes outside the store.

## Design philosophy for AI-made visuals (in guide() and the visualize skill)
- Accuracy first: every node and relationship must be true to what the user described or to the real system; never
  invent components to make a diagram look fuller. If unsure, add a node with state `question`.
- One visual = one idea at one altitude. Aim for 5–12 nodes. More than ~15: split into several visuals of the same system
  (an overview plus detail visuals) instead of crowding one.
- The picture takes the system's shape: ring for a loop, hub for a centre, tree for a breakdown, flow for a sequence;
  tiers only when the system is layered. No boxes in boxes; one group level is the norm.
- Show, don't caption, and put the art on the part: a drawing of a part is that card's `art`. Text on canvas stays short;
  depth goes in `explanation`, which appears on click.
- Symmetry: centred ranks, straight main line, midpoint attachments; fix every warning and tidiness defect.
- Pick the relationship kind that is literally true. Use `relates` only when nothing more specific is known.
  Use operator nodes for combinations ("A + B = C"), groups for belonging/tiers/alternatives/boundaries.
- Every node and edge gets an `explanation` so a click answers "what does this mean and why is it here".
- After writing, call `snapshot`, look at the result, and fix overlaps, ambiguity or clutter before reporting.
- Images: an agent that can generate images may add them via `add_asset`; one that cannot should draw SVG or
  code the visual instead. Never block on image generation.
