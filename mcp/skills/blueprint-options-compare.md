---
name: blueprint-options-compare
description: Load before drawing a decision or tradeoff in Blueprint - "compare A and B", "which should we pick", pros and cons, build vs buy, option analysis, "what do we give up", or recording a choice that was made. Not for how a system is built (use blueprint-system-map) or for steps in order (use blueprint-process-flow).
---

# Options compare

**Use when** there are two to four alternatives and the reader must see what differs and what was (or is still to be) chosen.
**Do not use** for one option explained in depth (concept explainer) or for more than four options (shortlist first, or make one visual per pair).

## Method
1. Write the decision as a question in the visual `description` ("Drive or take the train to work?").
2. List the criteria that matter to the user (time, cost, risk...). Use only criteria the user named or clearly implied.
3. Make one `option` group per alternative. Inside each, give every criterion its own card **in the same order and with parallel wording**, so the difference shows at a glance ("40 min each way" vs "55 min each way").
4. Join the option groups with one `versus` edge. Put the core tradeoff in its `label` ("time vs cost").
5. If the reasoning combines facts, say it literally with an operator node: cheaper `+` usable time `→` choice.
6. Add the choice as a card: `state: "decided"` once made, otherwise `state: "question"` with the open question as title. Unknown facts that could change the answer are separate `question` cards, linked from the choice with `requires`.
7. Apply (`direction: "RIGHT"` reads well for side-by-side), snapshot, review.

## Mapping onto Blueprint
| Concept | Blueprint |
|---|---|
| An alternative | `group`, `groupKind: "option"`, title = the option |
| A criterion's value for that option | `card` inside the group; `tone: "good"`/`"bad"` only for a clear win or loss |
| The tradeoff | `versus` between option groups (or between two matched cards) |
| Same thing under two names | `equals` |
| A combining argument | `operator` node (`+`, `>`, `<`, `or`, `&`) with `flow` in and out |
| The open question | `card`, `state: "question"` |
| The choice made | `card`, `state: "decided"`, `tone: "accent"` |
| A fact the choice depends on | `requires` from the choice to that fact |
| A dealbreaker | `blocks` from the fact to the option it rules out |

## Common mistakes
- **Unmatched sides**: option A shows cost, option B shows speed. Fix: same criteria, same order, in every group.
- **A verdict without its reasons**: a lone "Pick B" card. Fix: link the deciding cards into it (via an operator if several combine) and put the reasoning in its `explanation`.
- **Presenting a guess as decided**: Fix: `decided` only when the user decided; otherwise `question`.

## Worked example (commute choice)
```json
{
  "projectId": "demo", "systemId": "commute", "visualId": "drive-vs-train",
  "layout": { "direction": "RIGHT" },
  "ops": [
    { "op": "add_node", "node": { "id": "drive", "kind": "group", "groupKind": "option", "title": "Drive",
      "explanation": "Commute by car, door to door." } },
    { "op": "add_node", "node": { "id": "drive-time", "kind": "card", "parent": "drive", "title": "40 min each way", "icon": "clock",
      "explanation": "Typical door-to-door time in normal traffic." } },
    { "op": "add_node", "node": { "id": "drive-cost", "kind": "card", "parent": "drive", "title": "160 a month", "subtitle": "Fuel and parking", "icon": "wallet", "tone": "bad",
      "explanation": "Fuel plus a monthly parking permit." } },
    { "op": "add_node", "node": { "id": "drive-use", "kind": "card", "parent": "drive", "title": "Ride time is lost", "subtitle": "Hands on the wheel", "icon": "book-open", "tone": "bad",
      "explanation": "Driving time cannot be used for anything else." } },
    { "op": "add_node", "node": { "id": "train", "kind": "group", "groupKind": "option", "title": "Train",
      "explanation": "Commute by train plus a short walk." } },
    { "op": "add_node", "node": { "id": "train-time", "kind": "card", "parent": "train", "title": "55 min each way", "icon": "clock",
      "explanation": "Includes the walk to and from the stations." } },
    { "op": "add_node", "node": { "id": "train-cost", "kind": "card", "parent": "train", "title": "90 a month", "subtitle": "Monthly pass", "icon": "wallet", "tone": "good",
      "explanation": "Price of an unlimited monthly pass." } },
    { "op": "add_node", "node": { "id": "train-use", "kind": "card", "parent": "train", "title": "Ride time is free", "subtitle": "Read or rest", "icon": "book-open", "tone": "good",
      "explanation": "On the train the ride time can be used for reading." } },
    { "op": "add_node", "node": { "id": "plus", "kind": "operator", "operator": "+",
      "explanation": "Lower cost together with usable ride time outweigh the extra 15 minutes." } },
    { "op": "add_node", "node": { "id": "choice", "kind": "card", "title": "Take the train", "state": "decided", "tone": "accent", "weight": "lg",
      "explanation": "Chosen: saves 70 a month and turns commute time into reading time, at 15 minutes more each way." } },
    { "op": "add_node", "node": { "id": "reliability", "kind": "card", "title": "Is the train punctual?", "state": "question",
      "explanation": "On-time rate is unknown. Frequent delays would erase the advantage." } },
    { "op": "add_edge", "edge": { "id": "e-vs", "source": "drive", "target": "train", "kind": "versus", "label": "time vs cost",
      "explanation": "Driving is faster; the train is cheaper." } },
    { "op": "add_edge", "edge": { "id": "e-cost-plus", "source": "train-cost", "target": "plus", "kind": "flow", "label": "cheaper",
      "explanation": "The train costs 70 a month less." } },
    { "op": "add_edge", "edge": { "id": "e-use-plus", "source": "train-use", "target": "plus", "kind": "flow", "label": "usable time",
      "explanation": "Ride time can be spent reading." } },
    { "op": "add_edge", "edge": { "id": "e-plus-choice", "source": "plus", "target": "choice", "kind": "flow",
      "explanation": "Together these two reasons decide it." } },
    { "op": "add_edge", "edge": { "id": "e-choice-rel", "source": "choice", "target": "reliability", "kind": "requires",
      "explanation": "The choice holds only if the train usually runs on time." } }
  ]
}
```
