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
4. **Draw the key picture.** Find the one place where a shape beats words (a curve, a cycle, a balance, a before/after) and make it a `visual` node with inline SVG; use a recipe from blueprint-svg-motifs or draw one per blueprint-declutter-and-svg-craft. Title the visual with the claim it shows ("Growth speeds up"), not with its type ("Chart").
5. **Combinations as operators.** When two concepts combine into a third, use an `operator` node rather than prose.
6. **Self-test:** hide all text in your head. Do the shapes and arrows still suggest the idea (a loop, a growing curve, a split)? If the structure is a list of boxes, the visual is not explaining yet.
7. Apply, snapshot, review.

## Mapping onto Blueprint
| Concept | Blueprint |
|---|---|
| Concept | `card`; the central one `weight: "lg"` |
| Linking phrase | edge `label`; kind chosen by meaning (`becomes`, `requires`, `increases`, `flow`...) |
| "A and B make C" | `operator` node |
| Same idea, two names | `equals` |
| Key intuition | `visual` with `svg` (or `html` for a small animation or interactive) |
| Example or edge case | `card` with `tone: "muted"` linked by `relates` |
| A claim you could not verify | `card` with `state: "question"` |
| Aside that is not part of the logic | `note` |

## Common mistakes
- **Sentences in boxes**: a card titled with a whole sentence. Fix: noun phrase in the title, sentence in `explanation`.
- **A string of boxes**: one long chain, no picture, no cross-links. Fix: add the key `visual` and the one or two cross-links that make the idea click.
- **Decorative picture**: a generic icon-like drawing that does not show the mechanism. Fix: draw the thing that changes (the curve bending up), or drop the visual.

## Worked example (why compound interest snowballs)
```json
{
  "projectId": "demo", "systemId": "interest", "visualId": "compound",
  "ops": [
    { "op": "add_node", "node": { "id": "principal", "kind": "card", "title": "Starting deposit", "icon": "piggy-bank",
      "explanation": "The money put in at the start." } },
    { "op": "add_node", "node": { "id": "balance", "kind": "card", "title": "Balance", "icon": "wallet", "weight": "lg",
      "explanation": "Everything in the account right now: the deposit plus all interest added so far." } },
    { "op": "add_node", "node": { "id": "rate", "kind": "card", "title": "Interest rate", "subtitle": "e.g. 5% a year", "icon": "percent",
      "explanation": "The share of the balance paid as interest each period." } },
    { "op": "add_node", "node": { "id": "times", "kind": "operator", "operator": "×",
      "explanation": "Interest for a period is the balance multiplied by the rate." } },
    { "op": "add_node", "node": { "id": "interest", "kind": "card", "title": "Interest earned", "tone": "good",
      "explanation": "Money paid for this period. It is added to the balance, so next period's interest is bigger." } },
    { "op": "add_node", "node": { "id": "curve", "kind": "visual", "title": "Growth speeds up", "caption": "Same rate, bigger steps each year",
      "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 240 140\" font-family=\"system-ui, sans-serif\" font-size=\"11\"><line x1=\"24\" y1=\"118\" x2=\"224\" y2=\"118\" stroke=\"currentColor\" stroke-opacity=\".4\"/><line x1=\"24\" y1=\"118\" x2=\"24\" y2=\"12\" stroke=\"currentColor\" stroke-opacity=\".4\"/><line x1=\"24\" y1=\"96\" x2=\"220\" y2=\"52\" stroke=\"#64748b\" stroke-width=\"2\" stroke-dasharray=\"5 4\"/><path d=\"M24 96C90 81 160 62 220 18\" fill=\"none\" stroke=\"#10b981\" stroke-width=\"3\"/><text x=\"214\" y=\"78\" text-anchor=\"end\" fill=\"currentColor\">simple</text><text x=\"200\" y=\"16\" text-anchor=\"end\" fill=\"currentColor\">compound</text><text x=\"124\" y=\"134\" text-anchor=\"middle\" fill=\"currentColor\">years</text></svg>",
      "explanation": "Dashed line: interest paid only on the deposit grows by the same amount each year. Green curve: interest on interest makes each year's step larger." } },
    { "op": "add_node", "node": { "id": "rule72", "kind": "card", "title": "Rule of 72", "subtitle": "Years to double ≈ 72 ÷ rate", "tone": "muted",
      "explanation": "A rough shortcut: at 6% a year money doubles in about 12 years. Approximate, best for rates under about 15%." } },
    { "op": "add_edge", "edge": { "id": "e-prin-bal", "source": "principal", "target": "balance", "kind": "becomes", "label": "starts as",
      "explanation": "The deposit is the first balance." } },
    { "op": "add_edge", "edge": { "id": "e-bal-times", "source": "balance", "target": "times", "kind": "flow",
      "explanation": "The current balance is one input to the interest calculation." } },
    { "op": "add_edge", "edge": { "id": "e-rate-times", "source": "rate", "target": "times", "kind": "flow",
      "explanation": "The rate is the other input." } },
    { "op": "add_edge", "edge": { "id": "e-times-int", "source": "times", "target": "interest", "kind": "becomes",
      "explanation": "Balance times rate is the interest for the period." } },
    { "op": "add_edge", "edge": { "id": "e-int-bal", "source": "interest", "target": "balance", "kind": "increases", "label": "added back",
      "explanation": "Interest joins the balance, so the next period multiplies a bigger number. This loop is the whole idea." } },
    { "op": "add_edge", "edge": { "id": "e-int-curve", "source": "interest", "target": "curve", "kind": "relates", "label": "over time",
      "explanation": "Repeating the loop year after year produces the upward-bending curve." } },
    { "op": "add_edge", "edge": { "id": "e-rate-72", "source": "rate", "target": "rule72", "kind": "relates",
      "explanation": "The rule of 72 turns the rate into a doubling time." } }
  ]
}
```
