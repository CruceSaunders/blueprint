---
name: visualize
description: Draw visual maps of ideas and systems in Blueprint, a local Mac app. Use when the user says "visualize this", "map this system", "add this to Blueprint", "diagram this in Blueprint", or types "/visualize <what they want>".
---

# /visualize: put it in Blueprint

Blueprint is a local Mac app (files in ~/Blueprint/) for storing visual maps of ideas and systems as Project -> System -> Visual. You drive it through the `blueprint` MCP server. Treat `$ARGUMENTS` (or the user's request) as what to visualize.

## Procedure
1. Call the `blueprint` MCP tool `guide` first and follow it (the same text is reproduced below). If the drawing fits one of the topics it lists, call `guide({topic})` for that method too. If no `blueprint` tools are loaded in this session, say so plainly (the MCP server is not connected here; run `Blueprint --connect` or restart the client) and stop; do not fake it.
2. `list_projects`, then `list_systems`. Reuse the fitting project/system. Create what is missing (`create_project`, `create_system`, `create_visual`). Ask only if it is genuinely ambiguous which project this belongs to.
3. Build the visual with `apply` (omit positions; auto-layout handles it). Fix any validation errors it returns and resend.
4. Call `snapshot`, actually look at the image, fix overlaps, clutter or wrong relationships with another `apply`, and re-snapshot if you changed much.
5. Call `open` (background, does not steal focus), then report in two lines: what you drew and where it lives (project / system / visual).

## Images and capability
- An agent that can generate images may add them with `add_asset` and an `image` node.
- An agent that cannot draws inline SVG/HTML `visual` nodes instead.
- Never block on image generation.
