---
name: blueprint-choose-the-drawing
description: Load when you are unsure which drawing fits in Blueprint, or the user names a diagram type - swimlane, timeline, sequence, state machine, org chart, layer stack, quadrant, Venn, funnel, dependency graph, data model, user journey, cause and effect. Also when behaviour is the point (a bottleneck, a trust boundary, retries, leftover risk). Maps each onto Blueprint arrangements, shapes, groups and edge kinds, and says when not to draw at all.
---

# Choose the drawing

**Use when** the request names a diagram type, or you cannot tell which arrangement fits.
**Skip** when another topic plainly fits already; go straight to it.

## First: should this be a drawing?
- Fewer than 4 things, or a list with no links between them: write the sentence or a small table. Do not draw.
- Exact numbers the reader must compare: a table in the reply, or one chart as a `visual` (bar trend or gauge in svg-motifs).
- Otherwise say the plan in one line (arrangement, shapes, what you left out), then build it. Do not wait for an answer.

## Type picker
| If the reader must see... | Draw in Blueprint | Then load |
|---|---|---|
| An app or website idea: its screens, a user flow, wireframes, MVP scope | `tree` of screens or `flow` RIGHT of screens; wireframe `art` on the key screens | product-map |
| A sales pipeline, go-to-market, business model, a team or AI agent crew | `column` of stages, `hub` around the company, or `tree` of roles | business-map |
| The parts and what connects them (architecture) | `flow` RIGHT, or `hub` when one part is central; parts as `card`s; a `boundary` group for inside vs outside | system-map |
| Steps in order with branches (process, flowchart) | `flow`; steps as `pill`s, decisions as `diamond`s with one labelled edge per answer | process-flow |
| States and what moves between them (state machine, lifecycle) | `flow` DOWN; states as `pill`s; `becomes` with the trigger as label; end states toned | process-flow |
| Messages between actors in time order (sequence) | `flow` DOWN of `pill`s, one per message, sender and receiver in the subtitle ("Shop to Bank"). There are no lifelines; actors joined by numbered lines make labels collide | process-flow |
| Who does each step (swimlane) | `flow` RIGHT; one `layer` group per actor holding its steps, so lanes stand side by side as columns; at most 4 lanes | process-flow |
| Events in time (timeline) | `row` of `pill`s, the date in the subtitle, `flow` between them; `accent` on the one moment that matters | process-flow |
| A breakdown, or who reports to whom (tree, org chart) | `tree`; unlabelled `flow` from parent to child; people as `card`s with `icon: "user"` (a `circle` breaks titles over about 10 letters) | system-map |
| Tiers where each talks only to the next (layer stack) | `stack` of `layer` groups, each a `row`; `flow` down through the tiers | system-map |
| Inside vs outside (nested, scope) | one `boundary` group drawn as a frame; outside parts stay top level; one level of nesting only | system-map |
| A cycle that feeds itself (loop, flywheel) | `ring`; variables as `pill`s; `increases` / `decreases` | feedback-map |
| One thing everything touches (hub) | `hub`; the centre gets `weight: "lg"` | system-map |
| Items placed on two axes (quadrant, 2x2) | `stack` of two `layer` bands named for axis 1 (top band high), each a `row` of two cards (left card low on axis 2); card title = quadrant, subtitle = its items. `grid` puts 4 cells in one row, so it cannot make a 2x2 | options-compare |
| Options side by side (comparison) | one `option` group per option, the same criteria in the same order, one `versus` | options-compare |
| What two sets share (Venn) | `row` of three `group`s: only A, both, only B; `accent` on the shared items. True overlapping circles only as a `visual` | concept-explainer |
| Ranked levels or drop-off (pyramid, funnel) | `column` of `pill`s with counts in the subtitle and rates as `flow` labels; when the narrowing is the point, the funnel or stack motif as `art` on the first card | svg-motifs |
| What depends on what (dependency graph) | `flow` DOWN; `flow` from the thing used to what uses it, label "used by". `requires` never ranks: a graph of only `requires` lines collapses into one row of looping lines | system-map |
| Entities and how they relate (data model) | a `card` per entity, key fields in the subtitle and the rest in `explanation`; `relates` with the cardinality as label ("has 1..n") | system-map |
| What a person does and feels at each stage (user journey) | `row` of `pill` stages; the feeling in words in the subtitle, backed by `tone` good / warn / bad | process-flow |
| The causes of one effect (cause and effect, fishbone) | `flow` RIGHT; one `group` per cause category, each joined to the effect card by `increases`. If the effect feeds back into a cause, it is a loop | feedback-map |
| Numbers compared (bar, line, scatter, pie) | Not a canvas job. One `visual` (bar trend, gauge), or a table in the reply | svg-motifs |
| A list, or a fact one sentence says | Not a drawing. Write it, or use a 3-column table | none |

## Behaviour patterns
When behaviour is the point (waiting, blocking, retrying, risk that remains), pick the pattern first, then the nearest type above. One pattern per visual.

**Queue at a bottleneck.** Several sources feed one limited reviewer, service or resource, and the story is the wait.
Parts: 2-5 source cards with `flow` into one queue card that states count and rate ("40 waiting, 8 per hour"), one service card (`weight: "lg"`), two outcome `pill`s (`good`, `warn`).
Budget: 5 sources at most (merge the rest into one card), 8 nodes. Main mistake: capacity left unsaid. Write the number and its unit.

**Trust boundary.** Which routes cross a border and which are stopped.
Parts: one `boundary` group with its entry point inside; outside actors top level; the allowed route is `flow` labelled with what it carries ("HTTPS + token"); a stopped route is `blocks` from the outsider to the boundary group itself, so the bar ends at the frame.
Budget: 1-2 boundaries, 2 stopped routes, 8 nodes. Main mistake: a stopped line that runs on to a part inside the frame.

**Lifecycle with waits and retries.** One thing moves through states, and waits, retries and the ways it can end all matter.
Parts: `pill` states joined by `becomes` with the trigger as label; main states straight down, waits beside them; each end state toned (`good` done, `bad` failed, `muted` cancelled).
Budget: 4-5 main states, 2 waits, 2-3 end states. Main mistake: a retry drawn as two opposite lines between the same two states, whose labels collide. Send the retry back to an earlier state.

**Loose input into a record.** Notes, a call or a chat turns into a structured record.
Parts: a source card, one step `pill`, `becomes` into the record card (its fields in the subtitle), each missing field as a `question` card tied to the record by `requires`.
Budget: one source, one step, 6 fields named at most. Main mistake: fields that appear from nowhere, or unknowns filled in as if known.

**Safeguards with leftover risk.** Each layer catches what the one before missed, and some risk still gets through.
Parts: the risk card (`bad`) first, one `pill` per layer in a `flow` column, each edge labelled with what slips past ("misses scale"), the last edge into a leftover-risk card (`warn`).
Budget: 3-5 layers, one risk thread. Main mistake: ending at "safe". The leftover card is always there.

**Two traces compared.** Two similar cases end differently, and the reader needs the first point where they part.
Parts: two `option` groups (`column`), the same checks in the same order with the result in each title ("Has role: fail"), one `versus` between the first pair that differs, labelled "first difference"; outcomes toned.
Budget: 3-5 checks per side, one divergence marked. Main mistake: marking every difference. Later ones follow from the first.

## Worked example (who gets into a shared workshop's tool room)
Plan: flow RIGHT, one boundary frame, two outside actors; the alarm and opening hours are left out.
```json
{
  "projectId": "demo", "systemId": "workshop", "visualId": "tool-room-access",
  "layout": { "direction": "RIGHT" },
  "ops": [
    {"op": "add_node", "node": {"id": "member", "kind": "card", "shape": "circle", "title": "Member", "icon": "user", "explanation": "Someone who has paid this month and holds the current door code."}},
    {"op": "add_node", "node": {"id": "visitor", "kind": "card", "shape": "circle", "title": "Visitor", "icon": "user", "explanation": "Anyone without the code, such as a guest of a member."}},
    {"op": "add_node", "node": {"id": "room", "kind": "group", "groupKind": "boundary", "title": "Tool room", "explanation": "The locked room. Everything inside is only reachable through the keypad door."}},
    {"op": "add_node", "node": {"id": "door", "kind": "card", "parent": "room", "title": "Keypad door", "icon": "lock", "weight": "lg", "explanation": "The only way in. It opens for the current monthly code."}},
    {"op": "add_node", "node": {"id": "racks", "kind": "card", "parent": "room", "title": "Tool racks", "icon": "wrench", "explanation": "Shared hand and power tools."}},
    {"op": "add_node", "node": {"id": "sheet", "kind": "card", "parent": "room", "title": "Sign-out sheet", "icon": "clipboard-list", "explanation": "Each tool taken out is written down with the member's name."}},
    {"op": "add_edge", "edge": {"id": "e-member-door", "source": "member", "target": "door", "kind": "flow", "label": "enters code", "explanation": "Members open the door with the monthly code."}},
    {"op": "add_edge", "edge": {"id": "e-door-racks", "source": "door", "target": "racks", "kind": "flow", "label": "opens", "explanation": "Once inside, members can reach the racks."}},
    {"op": "add_edge", "edge": {"id": "e-racks-sheet", "source": "racks", "target": "sheet", "kind": "flow", "label": "logged", "explanation": "Taking a tool means writing it on the sheet."}},
    {"op": "add_edge", "edge": {"id": "e-visitor-room", "source": "visitor", "target": "room", "kind": "blocks", "label": "no code", "explanation": "Without the code a visitor cannot get past the door, so the stopped line ends at the room's edge."}}
  ]
}
```
The allowed route runs straight through the frame; the stopped one ends in a bar on the frame. Only the door is emphasised.
