# Blueprint

A local Mac app for visual maps of ideas and systems, built to be drawn by your AI assistant and edited by hand.
You ask Claude Code, Cursor or Codex to `/visualize` something; it builds a canvas of cards, groups and typed
relationships (flow, increases, requires, blocks, …) in Blueprint, looks at a snapshot of what it drew, fixes it,
and opens it for you. Everything stays on your Mac as plain JSON files.

![A Blueprint visual](docs/screenshot.png)

## What's new in 0.2.2

- **Apps, websites and businesses.** Two new guide topics. `product-map` draws an app or site idea as a
  concept hub, a screen map, user flows through low-fidelity wireframe screens, and a Now / Next / Later scope.
  `business-map` draws sales pipelines, go-to-market, business models, teams that mix people and AI agents,
  and agent crews with their human approval gates.
- **Ideate or review.** `/visualize` now files work into the Project > System > Visual dropdowns where you would
  look for it, marks undecided parts as ideas while you brainstorm, and draws what is true today when you review.
- **Two more review checks:** split an overfull map instead of shrinking its labels, and check every part and link
  you asked for is on the canvas. Adapted from [fireworks-tech-graph](https://github.com/yizhiyanhua-ai/fireworks-tech-graph) (MIT).

## What's new in 0.2.1

- **A drawing picker for the AI.** A new `choose-the-drawing` guide topic maps 19 common diagram types
  (swimlane, timeline, state machine, org chart, quadrant, Venn, funnel, dependency graph, data model and more)
  onto Blueprint's arrangements, shapes and line kinds, and says when a sentence or table is better than a drawing.
- **Six behaviour patterns.** A queue at a bottleneck, a trust boundary, a lifecycle with retries, loose input
  becoming a record, safeguards with leftover risk, and two traces compared.
- **Draw less.** The guide now aims for 5-9 nodes per visual, splits above 12, and keeps emphasis to 1-2 focal nodes.
- The picker and patterns adapt ideas from [diagram-design](https://github.com/cathrynlavery/diagram-design) by
  Cathryn Lavery (MIT); see `mcp/skills/ATTRIBUTION.md`.

## What's new in 0.2.0

- **A new layout engine.** Maps are laid out symmetrically and deterministically: tiers share one column grid,
  rows share one height, rings are true circles, and lines route around cards with room for their labels.
  Every write reports a tidiness check (overlaps, crossings, misaligned rows, nodes off a ring) so the AI fixes
  layout problems before you see them.
- **Shapes, on-card drawings and arrangements.** A card can be a card, pill, circle, diamond or plain text and
  can carry its own small drawing. A frame (or the whole visual) can be arranged as a flow, stack, row, column,
  ring, hub, tree or grid, and drawn as a band, tint, frame or bracket.
- **A simpler app.** Click anything to see what it means in a small card placed in empty space beside it; one
  **+** adds things; **⌘K** finds and runs everything; first launch is three steps.
- **Older visuals** open as they are, with the new frame styles. Nothing is rewritten until you ask:
  **⌘K > Tidy with new layout** re-places a whole visual, and **Make this the card's art** moves a separate drawing
  onto the card it belongs to.
- `Blueprint --mcp` now exits as soon as the AI session that started it ends.

## Install (DMG)

1. Download `Blueprint.dmg` from the latest release (Apple silicon; signed and notarized).
2. Open it and drag **Blueprint** to **Applications**, then open Blueprint.
3. The first-run screen lists the AI tools it found (Claude Code, Cursor, Codex). Click **Connect**.
   You can do this later from **Blueprint > Connect AI tools…**, or from a terminal:

   ```sh
   /Applications/Blueprint.app/Contents/MacOS/Blueprint --connect --dry-run   # show the plan, change nothing
   /Applications/Blueprint.app/Contents/MacOS/Blueprint --connect            # apply it
   /Applications/Blueprint.app/Contents/MacOS/Blueprint --connect --tools claude,codex
   ```

Connecting backs up each tool's config file next to itself (`*.blueprint-backup-<time>`), adds a `blueprint` MCP
server that runs `Blueprint --mcp` (no Node.js needed), leaves every other server alone, and installs the
`visualize` skill plus the bundled `blueprint-*` method skills into `~/.claude/skills/` (Claude Code) and
`~/.agents/skills/` (Cursor and Codex). An existing skill with the same name is moved to a `skills-backups`
folder beside it, and the output says so. Restart the AI tool afterwards.

## Use

In your AI tool:

```
/visualize how our signup flow works, from landing page to first project
/visualize the tradeoffs between Postgres and DynamoDB for this service
```

Or just ask it to "map this in Blueprint". The assistant reads Blueprint's guide (and a method topic such as
`system-map`, `process-flow`, `feedback-map` or `options-compare`), writes the visual, checks a rendered
snapshot, and opens the app at it in the background. A new visual opens by itself as soon as it lands.

In the app:

- **First launch** shows three steps: connect your AI tools (one Connect button), type `/visualize …` in your
  AI, and watch the visual appear. The "AI connected" pill in the top right opens the same steps later.
- **Click a card or line** to see what it means. Press **Edit** in that panel to change its colour, status,
  size, icon, shape or drawing, or a line's kind and direction. On a frame, Edit also sets how its contents are
  arranged and how the frame is drawn. Dragging never opens the panel. Shift-click adds cards to the selection.
- **+** at the bottom adds a card, drawing, image, symbol, note or frame. Select two or more cards and a
  **Group** button appears next to it.
- **⋯ (More)** holds tidy-up, the layout of the whole visual, notes, how to read lines and frames, the overview
  map and appearance.
- **⌘K** finds anything and runs any action. **⌘\\** hides the sidebar. **⌘Z** undoes.

## Where your data lives

`~/Blueprint/projects/<project>/systems/<system>/visuals/<visual>.json`, plus images in each project's `assets/`.
Set `BLUEPRINT_HOME` to use another folder. Deleting in the app moves items to the Trash.

## Disconnect and uninstall

```sh
/Applications/Blueprint.app/Contents/MacOS/Blueprint --disconnect   # removes the server entries and the skills it installed
```

`--disconnect` puts back any skill that `--connect` moved aside. Then drag Blueprint.app to the Trash. Your
visuals in `~/Blueprint` are left in place; delete that folder too if you want them gone.

## Security model

- Local only: no accounts, no telemetry, no update checks; your files never leave the Mac.
- No network: DNS resolves nothing, all traffic goes to a dead local proxy, WebRTC cannot use UDP, and web requests are cancelled; a test proves an HTML visual cannot reach even 127.0.0.1.
- Sandboxed visuals: every window runs with the Chromium sandbox and context isolation; AI-drawn HTML runs in a script-only iframe with its own CSP; SVG is sanitised (no scripts, styles, foreignObject or external references).
- Contained files: the app and the MCP server refuse symbolic links and anything outside the store; `add_asset` reads only regular image files whose bytes match their extension.
- Hardened release: signed, notarized, hardened runtime with one entitlement (`allow-jit`), and Electron fuses that disable `ELECTRON_RUN_AS_NODE`, `NODE_OPTIONS` and the inspector.

## Build from source

Requires macOS on Apple silicon, Node.js 22+, and pnpm.

```sh
git clone <this repo> blueprint && cd blueprint
./setup.sh                 # installs deps (frozen lockfiles), builds, installs to /Applications, then offers --connect
./setup.sh --no-install    # build only; the app is in app/release/
```

From-source builds are ad-hoc signed. To produce a signed and notarized release, set
`BLUEPRINT_SIGN_IDENTITY` (a Developer ID Application identity, without the "Developer ID Application: " prefix,
e.g. `Example Inc. (TEAMID1234)`) and `APPLE_KEYCHAIN_PROFILE`
(a `xcrun notarytool store-credentials` profile) before `cd app && npm run package`.

The MCP server also runs straight from source with Node: `node mcp/dist/index.js`.

Tests:

- `cd mcp && npm run smoke -- --cmd <path/to/Blueprint binary> --mcp` (MCP over stdio; the app must be named
  explicitly, there is no fallback to an installed copy)
- `cd app && npm run test:ui` (interaction test against the development build)
- `cd mcp && npm run spec-check` (every field in SPEC.md exists in the schema, and the other way round)
- against the packaged app in `app/release/`: `node app/scripts/network-test.mjs`, `node app/scripts/connect-test.mjs`,
  `node app/scripts/launch-test.mjs` and `node app/scripts/mcp-exit-test.mjs`

See [SPEC.md](SPEC.md) for the file format, tools and node/edge vocabulary.

## Credits and licence

MIT, see [LICENSE](LICENSE). The bundled skills adapt ideas from other open-source projects; see
[mcp/skills/ATTRIBUTION.md](mcp/skills/ATTRIBUTION.md).
