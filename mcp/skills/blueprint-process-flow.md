---
name: blueprint-process-flow
description: Load before drawing anything that happens in order in Blueprint - a workflow, procedure, pipeline, request path, user journey, approval chain, lifecycle, or state machine ("what states can an order be in", "walk me through the steps", "what happens when"). Not for cause-and-effect loops (use blueprint-feedback-map) or for the parts of a system at rest (use blueprint-system-map).
---

# Process flow

**Use when** the reader needs order: what comes first, where it branches, what stops it, where it loops back.
**Do not use** when nothing is ordered (parts and connections: system map) or when links mean "more A, more B" (feedback map).

## Steps or states? Decide first
- **Steps** are things done ("Check stock"). Cards are verbs-plus-object; edges are `flow` ("then").
- **States** are conditions something is in ("On loan"). Cards are nouns or adjectives; edges are `becomes` with the trigger as `label` ("after 21 days").
Keep one kind per visual. If both matter, make one visual for each.

## Method
1. Write the start and the end in the visual `description` ("from request to book returned").
2. Lay out the **happy path** first: the usual route, one line from start to finish.
3. Add branches off it. A decision is a card titled as the question ("Copy on shelf?", icon `git-branch`) with one outgoing edge per answer, each with the answer as `label` ("yes", "no").
4. Add guards: a condition that stops a step is a card with a `blocks` edge into that step. A precondition that must already exist uses `requires` (dashed, does not change order).
5. Add returns: a step that goes back (retry, rework, waitlist) gets a plain edge back to the earlier card with a `label` saying when. Two steps that hand back and forth on one link use `both: true`.
6. Keep one direction: `DOWN` for long sequences, `RIGHT` for short wide ones. Never draw part of the chain against the grain.
7. Over ~12 steps: draw the top-level stages here and give each busy stage its own detail visual.
8. Apply, snapshot, review. Trace the happy path by eye; it must read without crossing.

## Mapping onto Blueprint
| Concept | Blueprint |
|---|---|
| Step / state | `card` (`tone: "good"` for success end, `"bad"` for failure end) |
| Then / next step | `flow`, optional label |
| Changes into another state | `becomes`, trigger as label |
| Decision point | `card` titled as a question; one labelled `flow` per answer |
| Must exist first | `requires` |
| Stops or forbids | `blocks` |
| Return, retry | `flow` back to the earlier card, label the condition |
| Phase or swimlane (who does it) | `group` (`groupKind: "group"`) per actor or phase |
| Unknown rule or step | `card`, `state: "question"` |

## Common mistakes
- **Unlabelled branches**: two arrows leave a decision and the reader guesses which is "yes". Fix: label every outgoing edge of a decision.
- **Steps and states mixed**: "Send invoice" next to "Paid". Fix: pick one; the other goes in edge labels or a second visual.
- **Happy path hidden**: exceptions drawn as large as the main route. Fix: main route first and `weight: "lg"` on its key card; exceptions as short side branches.

## Worked example (lending a library book, states)
```json
{
  "projectId": "demo", "systemId": "library", "visualId": "loan-lifecycle",
  "ops": [
    { "op": "add_node", "node": { "id": "card", "kind": "card", "title": "Valid library card", "icon": "id-card",
      "explanation": "Members must hold a current card before they can request anything." } },
    { "op": "add_node", "node": { "id": "requested", "kind": "card", "title": "Requested", "icon": "hand",
      "explanation": "A member has asked for a book." } },
    { "op": "add_node", "node": { "id": "shelf", "kind": "card", "title": "Copy on shelf?", "icon": "git-branch",
      "explanation": "The library checks whether any copy is free right now." } },
    { "op": "add_node", "node": { "id": "waitlist", "kind": "card", "title": "Waitlisted", "icon": "list-ordered",
      "explanation": "No copy is free, so the member queues for the next returned copy." } },
    { "op": "add_node", "node": { "id": "loan", "kind": "card", "title": "On loan", "icon": "book-open", "weight": "lg",
      "explanation": "The member has the book. The loan period is 21 days." } },
    { "op": "add_node", "node": { "id": "overdue", "kind": "card", "title": "Overdue", "tone": "warn",
      "explanation": "The loan period ended and the book is still out." } },
    { "op": "add_node", "node": { "id": "fine", "kind": "card", "title": "Unpaid fine", "tone": "bad",
      "explanation": "A late return leaves a fine on the account until it is paid." } },
    { "op": "add_node", "node": { "id": "returned", "kind": "card", "title": "Returned", "tone": "good",
      "explanation": "The book is back and the loan is closed." } },
    { "op": "add_edge", "edge": { "id": "e-req-card", "source": "requested", "target": "card", "kind": "requires",
      "explanation": "A request is accepted only from a member with a valid card." } },
    { "op": "add_edge", "edge": { "id": "e-req-shelf", "source": "requested", "target": "shelf", "kind": "flow",
      "explanation": "Every request starts with an availability check." } },
    { "op": "add_edge", "edge": { "id": "e-shelf-loan", "source": "shelf", "target": "loan", "kind": "becomes", "label": "yes",
      "explanation": "If a copy is free, the request becomes a loan when the member collects it." } },
    { "op": "add_edge", "edge": { "id": "e-shelf-wait", "source": "shelf", "target": "waitlist", "kind": "becomes", "label": "no",
      "explanation": "If no copy is free, the request becomes a waitlist place." } },
    { "op": "add_edge", "edge": { "id": "e-wait-loan", "source": "waitlist", "target": "loan", "kind": "becomes", "label": "copy back",
      "explanation": "When a copy is returned, the first person in the queue gets it on loan." } },
    { "op": "add_edge", "edge": { "id": "e-loan-ret", "source": "loan", "target": "returned", "kind": "becomes", "label": "on time",
      "explanation": "Returned within 21 days: the loan simply closes." } },
    { "op": "add_edge", "edge": { "id": "e-loan-over", "source": "loan", "target": "overdue", "kind": "becomes", "label": "after 21 days",
      "explanation": "Not returned by the due date." } },
    { "op": "add_edge", "edge": { "id": "e-over-fine", "source": "overdue", "target": "fine", "kind": "becomes", "label": "returned late",
      "explanation": "A late return closes the loan but leaves a fine." } },
    { "op": "add_edge", "edge": { "id": "e-fine-req", "source": "fine", "target": "requested", "kind": "blocks",
      "explanation": "Members with an unpaid fine cannot make new requests." } }
  ]
}
```
