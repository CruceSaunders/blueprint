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

## Method
1. Write the one question this visual answers in the visual `description`.
2. Choose the altitude. List only parts that exist at that altitude and that the user stated or the source shows.
3. Draw the border first: one `boundary` group for "inside the system"; outside actors stay top-level.
4. Add the parts as cards inside it. Use `layer` groups only when the parts really form tiers (interface over logic over storage).
5. Connect with the most literal edge kind, a short verb or protocol as `label` ("reads", "HTTPS", "nightly sync").
6. Put each unknown (an unclear owner, a component mentioned but not explained) as a card with state `question`.
7. Apply, snapshot, then run the blueprint-declutter-and-svg-craft review.

## Mapping onto Blueprint
| Real thing | Blueprint |
|---|---|
| Person, role, outside system | top-level `card` (icon e.g. `user`, `globe`) |
| Running piece, store, team | `card` inside the boundary (icon e.g. `server`, `database`) |
| The system's edge / trust or ownership line | `group` with `groupKind: "boundary"` |
| Tiers in a stack | `group` with `groupKind: "layer"`, one per tier |
| Parts that belong together without being a tier | `group` with `groupKind: "group"` |
| Calls, sends, writes to | `flow` with a verb label |
| Cannot run without | `requires` (dashed) |
| Two names for one thing | `equals`; better, merge into one card |
| Not yet built / unclear | `state: "idea"` / `state: "question"` |
| Already running | `state: "built"` only if the user said so |

Gates and conditions belong on the edge they qualify (label "if paid", explanation says the rule), not on a floating card.

## Common mistakes
- **Mixed altitude**: a class name next to a whole outside company. Fix: move the detail to its own visual.
- **Invented plumbing**: adding a cache, load balancer or queue because systems "usually" have one. Fix: draw only what was stated; ask with a `question` card.
- **Everything `relates`**: lines with no meaning. Fix: say what moves (`flow` + verb) or what depends (`requires`); delete the line if neither is known.

## Worked example (containers of a generic online bookshop)
```json
{
  "projectId": "demo", "systemId": "bookshop", "visualId": "containers",
  "layout": { "direction": "RIGHT" },
  "ops": [
    { "op": "add_node", "node": { "id": "shopper", "kind": "card", "title": "Shopper", "icon": "user",
      "explanation": "A person browsing and buying books. Outside the system." } },
    { "op": "add_node", "node": { "id": "shop", "kind": "group", "groupKind": "boundary", "title": "Bookshop system",
      "explanation": "Everything the bookshop runs itself. Lines that cross this border reach outside parties." } },
    { "op": "add_node", "node": { "id": "web", "kind": "card", "parent": "shop", "title": "Web store", "subtitle": "Pages shoppers use", "icon": "monitor",
      "explanation": "The site shoppers see. It holds no data itself and asks the API for everything." } },
    { "op": "add_node", "node": { "id": "api", "kind": "card", "parent": "shop", "title": "Store API", "icon": "server", "weight": "lg",
      "explanation": "Central service: catalogue, carts and orders. Every other part talks to it." } },
    { "op": "add_node", "node": { "id": "db", "kind": "card", "parent": "shop", "title": "Orders database", "icon": "database",
      "explanation": "Stores books, stock levels and orders. Only the API reads and writes it." } },
    { "op": "add_node", "node": { "id": "search", "kind": "card", "parent": "shop", "title": "Search index", "icon": "search",
      "explanation": "Copy of the catalogue tuned for fast title and author search." } },
    { "op": "add_node", "node": { "id": "covers", "kind": "card", "parent": "shop", "title": "Cover image storage?", "state": "question",
      "explanation": "The brief mentions cover images but not where they are kept. Unknown until confirmed." } },
    { "op": "add_node", "node": { "id": "payments", "kind": "card", "title": "Payment provider", "icon": "credit-card",
      "explanation": "Outside company that charges cards. The bookshop never stores card numbers." } },
    { "op": "add_node", "node": { "id": "email", "kind": "card", "title": "Email service", "icon": "mail",
      "explanation": "Outside service that delivers order receipts." } },
    { "op": "add_edge", "edge": { "id": "e-shopper-web", "source": "shopper", "target": "web", "kind": "flow", "label": "browses, orders",
      "explanation": "The shopper uses the web store in a browser." } },
    { "op": "add_edge", "edge": { "id": "e-web-api", "source": "web", "target": "api", "kind": "flow", "label": "HTTPS",
      "explanation": "Every page asks the API for data and sends orders to it." } },
    { "op": "add_edge", "edge": { "id": "e-api-db", "source": "api", "target": "db", "kind": "flow", "label": "reads, writes",
      "explanation": "The API is the only writer of orders and stock." } },
    { "op": "add_edge", "edge": { "id": "e-api-search", "source": "api", "target": "search", "kind": "flow", "label": "queries",
      "explanation": "Search requests go to the index, not the database." } },
    { "op": "add_edge", "edge": { "id": "e-api-covers", "source": "api", "target": "covers", "kind": "relates",
      "explanation": "Some link must exist for covers to show, but its form is not known yet." } },
    { "op": "add_edge", "edge": { "id": "e-api-pay", "source": "api", "target": "payments", "kind": "flow", "label": "charges card",
      "explanation": "At checkout the API asks the provider to take payment." } },
    { "op": "add_edge", "edge": { "id": "e-api-email", "source": "api", "target": "email", "kind": "flow", "label": "sends receipt",
      "explanation": "After a paid order the API asks the email service to send a receipt." } }
  ]
}
```
