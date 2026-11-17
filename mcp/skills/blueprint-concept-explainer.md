---
name: blueprint-concept-explainer
description: Load before drawing a visual whose job is to make an idea understood in Blueprint - "explain how X works", "teach me", "help me understand", "make this intuitive", "what is X", an intuition picture, a one-glance summary of a mechanism or principle. Not for mapping a real system's parts (use blueprint-system-map), a procedure (use blueprint-process-flow) or a decision (use blueprint-options-compare).
---

# Concept explainer

**Use when** the reader should come away understanding one idea: why compound interest snowballs, what a cache is for, how a vaccine primes the body.
**Do not use** when the user needs an inventory, a runbook or a verdict.

## Method
1. **Focus question first.** Write the one question the visual answers in the visual `description` ("Why does compound interest grow faster each year?"). Every node must help answer it; cut the rest.
2. **Pick 5-9 concepts.** Short noun phrases, each a card. Fewer is better. Order them from the most general to the most specific.
3. **Link as propositions.** Each edge plus its two cards should read as a true sentence: "Balance × Rate becomes Interest". Put the linking phrase in `label` (1-4 words) and the full sentence in `explanation`. If an edge reads as nonsense out loud, it is wrong.
4. **Give the idea its shape.** A mechanism that repeats is a `ring` (whole canvas, or a group with `arrangement: "ring"`); one idea with many facets is a `hub`; a cause chain is a `flow`. The arrangement itself should already suggest the idea.
5. **Draw the key picture on the part it shows.** Find the one place where a shape beats words (a curve, a balance, a before/after) and put it on that concept's card as `art` (inline SVG; recipes in blueprint-svg-motifs, rules in blueprint-declutter-and-svg-craft). The card's title names the concept; the drawing shows its behaviour. Use a standalone `visual` only for a picture of the whole idea, never one joined to a card by a line.
6. **Combinations as operators.** When two concepts combine into a third, use an `operator` node rather than prose.
7. **Self-test:** hide all text in your head. Do the shapes and arrows still suggest the idea (a loop, a growing curve, a split)? If the structure is a list of boxes, the visual is not explaining yet.
8. Apply, read `warnings` and `tidiness`, snapshot, review.

## Mapping onto Blueprint
| Concept | Blueprint |
|---|---|
| Concept | `card`; the central one `weight: "lg"` |
| Linking phrase | edge `label`; kind chosen by meaning (`becomes`, `requires`, `increases`, `flow`...) |
| "A and B make C" | `operator` node |
| Same idea, two names | `equals` |
| Key intuition about one concept | that card's `art` (`svg`, or `html` for a small animation) |
| A picture of the whole idea | `visual` with `svg`, not joined to any card |
| A repeating mechanism | `ring` arrangement (canvas or group) |
| Example or edge case | `card` with `tone: "muted"`, `requires`/`equals` to what it exemplifies |
| A claim you could not verify | `card` with `state: "question"` |
| Aside that is not part of the logic | `note` |

## Common mistakes
- **Sentences in boxes**: a card titled with a whole sentence. Fix: noun phrase in the title, sentence in `explanation`.
- **A string of boxes**: one long chain, no picture, no cross-links. Fix: give it its shape (ring, hub) and the key drawing as `art`.
- **Picture beside the part**: a drawing node joined to the card it depicts by an "illustrates" line. Fix: move the drawing into that card's `art`.
- **Decorative picture**: a generic icon-like drawing that does not show the mechanism. Fix: draw the thing that changes (the curve bending up), or drop the visual.

## Worked example (why compound interest snowballs)
```json
{
  "projectId": "demo", "systemId": "interest", "visualId": "compound",
  "ops": [
    {"op": "add_node", "node": {"id": "principal", "kind": "card", "title": "Starting deposit", "icon": "piggy-bank", "explanation": "The money put in at the start."}},
    {"op": "add_node", "node": {"id": "rate", "kind": "card", "title": "Interest rate", "subtitle": "e.g. 5% a year", "icon": "percent", "explanation": "The share of the balance paid as interest each period."}},
    {"op": "add_node", "node": {"id": "loop", "kind": "group", "groupKind": "group", "title": "Every year", "arrangement": "ring", "explanation": "The loop that repeats once per period. Going round it is what makes the growth speed up."}},
    {"op": "add_node", "node": {"id": "balance", "kind": "card", "parent": "loop", "title": "Balance", "weight": "lg", "art": {"size": "md", "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 240 120\"><line x1=\"20\" y1=\"104\" x2=\"224\" y2=\"104\" stroke=\"currentColor\" stroke-opacity=\".4\"/><line x1=\"20\" y1=\"104\" x2=\"20\" y2=\"10\" stroke=\"currentColor\" stroke-opacity=\".4\"/><line x1=\"20\" y1=\"86\" x2=\"220\" y2=\"50\" stroke=\"#64748b\" stroke-width=\"2.5\" stroke-dasharray=\"6 5\"/><path d=\"M20 86C90 76 160 58 220 14\" fill=\"none\" stroke=\"#10b981\" stroke-width=\"4\" stroke-linecap=\"round\"/></svg>"}, "explanation": "Everything in the account now. The drawing: dashed, interest on the deposit alone grows by the same step each year; green, interest on interest makes each step bigger."}},
    {"op": "add_node", "node": {"id": "times", "kind": "operator", "parent": "loop", "operator": "×", "explanation": "Interest for a period is the balance multiplied by the rate."}},
    {"op": "add_node", "node": {"id": "interest", "kind": "card", "parent": "loop", "shape": "pill", "title": "Interest earned", "tone": "good", "explanation": "Money paid for this period. It is added to the balance, so next period's interest is bigger."}},
    {"op": "add_edge", "edge": {"id": "e-prin-bal", "source": "principal", "target": "balance", "kind": "becomes", "label": "starts as", "explanation": "The deposit is the first balance."}},
    {"op": "add_edge", "edge": {"id": "e-rate-times", "source": "rate", "target": "times", "kind": "flow", "explanation": "The rate is the other input to each period's multiplication."}},
    {"op": "add_edge", "edge": {"id": "e-bal-times", "source": "balance", "target": "times", "kind": "flow", "explanation": "The current balance is one input to the interest calculation."}},
    {"op": "add_edge", "edge": {"id": "e-times-int", "source": "times", "target": "interest", "kind": "becomes", "explanation": "Balance times rate is the interest for the period."}},
    {"op": "add_edge", "edge": {"id": "e-int-bal", "source": "interest", "target": "balance", "kind": "increases", "label": "added back", "explanation": "Interest joins the balance, so the next period multiplies a bigger number. This loop is the whole idea."}}
  ]
}
```
The repeating part is a ring inside a soft group; the inputs flow into it from above. The growth curve is the Balance card's own drawing, not a separate picture joined by a line.
