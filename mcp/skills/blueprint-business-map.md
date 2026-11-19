---
name: blueprint-business-map
description: Load before drawing how a business or team runs in Blueprint - a sales process or pipeline, a go-to-market or marketing funnel, a business model (who pays whom for what), a team or org chart that mixes people and AI agents, an agent crew and its hand-offs, or an operating cadence. For the software behind it use blueprint-system-map; for one product's screens use blueprint-product-map.
---

# Business map (sales, teams, agents, business models)

**Use when** the reader runs the business and needs to see how work, money or customers move, or who (person or agent) owns what.
**Do not use** for screens (product-map) or for software architecture (system-map). A loop that feeds itself (a flywheel, word of mouth) is feedback-map.

## Pick the view
| The question | View | Build |
|---|---|---|
| How a stranger becomes a paying customer | **sales pipeline** | `column` (or `flow` DOWN) of `pill` stages: Lead, Qualified, Demo, Proposal, Won. Count and conversion in each subtitle ("40 / mo, 25%"); the stage that leaks most gets `tone: "warn"`; Won `good`, Lost `bad` off to the side |
| Where customers come from | **go-to-market** | `flow` RIGHT: channel cards (2-5) into one pipeline entry card; each channel edge labelled with what it brings ("12 leads / mo"); unproven channels `state: "question"` |
| Who pays whom for what | **business model** | `hub`: the company card (`weight: "lg"`) in the middle; customers, suppliers, partners as spokes; `flow` edges labelled with what moves ("$49 / mo", "data", "referrals"); money edges carry the amount |
| Who owns what | **team / org** | `tree`; one `card` per role, the person or agent in the subtitle; people `icon: "user"`, AI agents `icon: "bot"`; an open hire `state: "question"` |
| How agents hand work to each other | **agent crew** | `flow` RIGHT: trigger card, then one `card` per agent (`icon: "bot"`, its model or tool in the subtitle), `flow` edges labelled with the artefact handed over ("brief", "draft", "PR"); human approval gates as `diamond`s ("Founder approves?"); tools and data stores the agents share as `muted` cards tied by `requires` |
| What happens on a rhythm | **cadence** | `ring` of `pill`s (Mon plan, daily standup, Fri review) when it repeats; `row` when it does not |

## Rules that keep a business map honest
- **Numbers or a question mark.** A stage, channel or price without a real number gets `state: "question"` and "?" in the subtitle. Never invent conversion rates, revenue or headcount.
- **Owner on every stage.** Each pipeline stage or step says who does it in the subtitle ("Founder", "SDR agent"). If one owner does everything, say it once in the description instead.
- **Agents are team members.** Draw an AI agent like a person (a card with an owner role), not as a tool. Say what it decides on its own and where a human signs off: that gate is a diamond, not a note.
- **Money is a labelled flow.** Show direction and amount on the edge. A business model without amounts is a sketch: mark it `idea`.
- **One bottleneck.** Find the stage where the most is lost or waits longest and give it `tone: "warn"` plus the reason in `explanation`. If that is the story, use the queue-at-a-bottleneck pattern from choose-the-drawing.
- Over ~8 stages or roles: an overview here, one detail visual per busy stage or team.

## Ideation and review
- Ideation: `state: "idea"` on everything not yet true; the map is a proposal. Put the open bets as `question` cards next to the stage they affect.
- Review: update counts in subtitles, flip `idea` to `decided` or `built`, and mark the stage that moved most. Keep the same node ids across reviews so the visual stays comparable.

## Mapping onto Blueprint
| Concept | Blueprint |
|---|---|
| Pipeline stage, funnel step | `pill`, count and rate in subtitle |
| Conversion to next stage | `flow`, rate as label |
| Lost / churned | `pill`, `tone: "bad"`, edge labelled with the reason |
| Channel, source | `card` with an `icon` (megaphone, mail, users) |
| Person / role | `card`, `icon: "user"` |
| AI agent | `card`, `icon: "bot"`, model or tool in subtitle |
| Human approval | `card`, `shape: "diamond"`, titled as the question |
| Money, data, goods moving | `flow`, label = what and how much |
| Shared tool, CRM, data store | `card`, `tone: "muted"`, `requires` from each user of it |
| A team or department | `tint` group; `layer` only when it is a real tier |

## Worked example (founder-led sales with two agents)
Plan: flow RIGHT, five nodes, one approval gate; marketing channels left out.
```json
{
  "projectId": "startup", "systemId": "sales", "visualId": "agent-pipeline",
  "layout": { "direction": "RIGHT" },
  "ops": [
    {"op": "add_node", "node": {"id": "leads", "kind": "card", "title": "Inbound leads", "subtitle": "? per month", "icon": "inbox", "state": "question", "explanation": "Demo requests from the site. Volume not measured yet."}},
    {"op": "add_node", "node": {"id": "researcher", "kind": "card", "title": "Research agent", "subtitle": "Enriches and scores", "icon": "bot", "explanation": "Looks up the company, scores fit and writes a one-page brief."}},
    {"op": "add_node", "node": {"id": "approve", "kind": "card", "shape": "diamond", "title": "Founder approves?", "explanation": "The founder reads the brief and decides whether to book a call. Nothing is sent without this."}},
    {"op": "add_node", "node": {"id": "demo", "kind": "card", "shape": "pill", "title": "Demo call", "subtitle": "Founder", "weight": "lg", "tone": "warn", "explanation": "The bottleneck: the founder has about five call slots a week."}},
    {"op": "add_node", "node": {"id": "won", "kind": "card", "shape": "pill", "title": "Closed won", "subtitle": "$?/mo", "tone": "good", "explanation": "Signed contract. Price not fixed yet."}},
    {"op": "add_edge", "edge": {"id": "e1", "source": "leads", "target": "researcher", "kind": "flow", "label": "form data", "explanation": "Each request goes to the research agent."}},
    {"op": "add_edge", "edge": {"id": "e2", "source": "researcher", "target": "approve", "kind": "flow", "label": "brief", "explanation": "The agent hands over a scored brief."}},
    {"op": "add_edge", "edge": {"id": "e3", "source": "approve", "target": "demo", "kind": "flow", "label": "yes", "explanation": "Approved leads get a call booked."}},
    {"op": "add_edge", "edge": {"id": "e4", "source": "demo", "target": "won", "kind": "flow", "label": "? close rate", "explanation": "Close rate not measured yet."}}
  ]
}
```
Unknown numbers stay visible as "?", the agent is drawn as a team member, and the founder's call slots are the one marked bottleneck.
