---
name: blueprint-system-map
description: Load before drawing how the parts of a system fit together in Blueprint - software or service architecture, an organisation's units, a product's components, "what talks to what", "map this codebase/service/stack", "what are the pieces". Not for step-by-step processes (use blueprint-process-flow) or cause-and-effect loops (use blueprint-feedback-map).
---

# System map

**Use when** the question is "what are the parts, where are the borders, and what connects to what".
**Do not use** for an ordered sequence of steps, a decision between options, or "why does X keep rising".

## Pick one altitude per visual
Zoom levels, adapted from the C4 model (Simon Brown, c4model.com):
1. **Context**: the whole system as one box, plus the people and outside systems it deals with. Answers "who and what does it touch".
2. **Containers**: the separately running or separately stored pieces inside the system (an app, a service, a database, a queue, a team). Answers "what is it made of".
3. **Components**: the main parts inside ONE container. Answers "how does this piece work inside".
4. Code-level detail rarely belongs on a canvas; describe it in `explanation`.

Never mix levels on one visual (a database next to a whole partner company). If the user needs two levels, make two visuals in the same system: an overview (context or containers) and one detail visual per container that matters. Name the altitude in the visual `title` or `description`.

## Choose the shape before the boxes
- **One part everything touches** (a central service, a shared record, a coordinator): `layout.arrangement: "hub"`. It sits in the middle; the rest become mirrored spokes.
- **Requests that pass through in order** (browser to API to database): `flow`, `direction` DOWN or RIGHT. The main path runs straight down the axis.
- **Real tiers** (interface over logic over storage, where each tier only talks to the next): `layer` groups stacked in `flow`; they draw as light bands. Only when the system truly is layered; parts that merely belong together get a `tint` group or no group.
- **A breakdown** (an organisation's units, a product's modules): `tree`.
- **Peers with no order**: `grid` or `row`.
Nest groups one level deep at most. A drawing of a part (a funnel for a filter, a database cylinder) goes on that card as `art`, never as a separate node joined by a line.

## Method
1. Write the one question this visual answers in the visual `description`.
2. Choose the altitude and list only parts that exist at it and that the user stated or the source shows.
3. Pick the arrangement from the list above.
4. If inside vs outside matters, add one `boundary` group (drawn as a frame); outside actors stay top-level.
5. Connect with the most literal edge kind and a short verb or protocol as `label` ("reads", "HTTPS").
6. Unknowns (an unclear owner, a part mentioned but not explained) are cards with state `question`.
7. Apply, read `warnings` and `tidiness`, snapshot, then run the blueprint-declutter-and-svg-craft review.

## Mapping onto Blueprint
| Real thing | Blueprint |
|---|---|
| Person, role, outside system | top-level `card` (icon e.g. `user`, `globe`); `shape: "circle"` for a person |
| Running piece, store, team | `card` (icon e.g. `server`, `database`) |
| A part whose look explains it | `card` with `art` |
| The system's edge / trust line | `group`, `groupKind: "boundary"` |
| Tiers in a stack | `group`, `groupKind: "layer"` (band), one per tier |
| Parts that belong together | `group`, `groupKind: "group"` (soft tint) |
| Calls, sends, writes to | `flow` with a verb label |
| Cannot run without | `requires` (dashed) |
| Not yet built / unclear | `state: "idea"` / `state: "question"` |

Gates and conditions belong on the edge they qualify (label "if paid", explanation says the rule), not on a floating card.

## Common mistakes
- **Boxes in boxes**: every part inside a tier inside a frame. Fix: pick the arrangement that matches the system (hub, flow, tree); keep at most one group level.
- **Mixed altitude**: a class name next to a whole outside company. Fix: move the detail to its own visual.
- **Invented plumbing**: adding a cache or queue because systems "usually" have one. Fix: draw only what was stated; ask with a `question` card.
- **Everything `relates`**: say what moves (`flow` + verb) or what depends (`requires`).

## Worked example (one customer record shared by every team)
```json
{
  "projectId": "demo", "systemId": "crm", "visualId": "hub",
  "layout": { "arrangement": "hub" },
  "ops": [
    { "op": "add_node", "node": { "id": "record", "kind": "card", "title": "Customer record", "subtitle": "One per customer", "icon": "contact", "weight": "lg",
      "explanation": "The single shared record of a customer. Every team reads and writes the same one." } },
    { "op": "add_node", "node": { "id": "sales", "kind": "card", "title": "Sales", "icon": "handshake", "explanation": "Logs deals and contacts." } },
    { "op": "add_node", "node": { "id": "support", "kind": "card", "title": "Support", "icon": "life-buoy", "explanation": "Logs tickets and fixes." } },
    { "op": "add_node", "node": { "id": "billing", "kind": "card", "title": "Billing", "icon": "receipt", "explanation": "Logs invoices and payments." } },
    { "op": "add_node", "node": { "id": "marketing", "kind": "card", "title": "Marketing", "icon": "megaphone", "explanation": "Reads the record to choose who hears about what." } },
    { "op": "add_edge", "edge": { "id": "e-sales", "source": "sales", "target": "record", "kind": "flow", "label": "writes", "explanation": "Sales adds deals to the record." } },
    { "op": "add_edge", "edge": { "id": "e-support", "source": "support", "target": "record", "kind": "flow", "label": "writes", "explanation": "Support adds tickets to the record." } },
    { "op": "add_edge", "edge": { "id": "e-billing", "source": "billing", "target": "record", "kind": "flow", "label": "writes", "explanation": "Billing adds invoices to the record." } },
    { "op": "add_edge", "edge": { "id": "e-marketing", "source": "record", "target": "marketing", "kind": "flow", "label": "reads", "explanation": "Marketing only reads the record." } }
  ]
}
```
The record is the hub; three teams write to it and one reads, so four spokes sit left, right, above and below, each joined by one straight line.
