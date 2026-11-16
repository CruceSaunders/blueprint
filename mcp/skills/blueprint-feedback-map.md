---
name: blueprint-feedback-map
description: Load before drawing cause and effect that circles back in Blueprint - "why does X keep happening", vicious or virtuous cycles, growth that stalls, a fix that backfires, side effects, "what drives what", feedback loops, systems thinking. Not for ordered steps (use blueprint-process-flow) or for what the parts are (use blueprint-system-map).
---

# Feedback map (causal loops)

**Use when** things push each other up or down and the effect returns to its cause: growth spirals, limits, backlash, habits.
**Do not use** for "first A, then B" sequences, for who-sends-what, or when no link returns to its start (then it is a plain chain; a process or concept visual fits better).

## Method
1. Name the behaviour to explain in the visual `description` ("why the backlog keeps growing").
2. List the **variables**: quantities that can rise or fall. Phrase each as a neutral noun: "Backlog", "Fatigue", "Price". Not "Increase backlog", not "Lack of time".
3. Link causes to effects. For every link ask: if the cause goes up, does the effect go up (`increases`) or down (`decreases`), all else equal? If you cannot answer, the link is unknown: leave it out or use a `question` card.
4. Find each closed loop. Count its `decreases` links: an even count (including zero) makes a **reinforcing** loop (R, it amplifies); an odd count makes a **balancing** loop (B, it seeks a limit).
5. Label each loop with a short `note`: title "R1 Burnout spiral" or "B1 Catch-up", caption one sentence telling the story around the loop.
6. Mark slow links: put the delay in the edge `label` ("delay: weeks") and say how long in `explanation`. Delays are where loops overshoot.
7. Apply with the default `DOWN` layout (tried `RIGHT`: loop badges crowd on long return lines); return links pointing back up are fine. Snapshot; check every loop can be traced by eye.

## Mapping onto Blueprint
| Concept | Blueprint |
|---|---|
| Variable | `card`, noun title; optional `tone` (`bad` for a harm, `good` for a goal) |
| Positive link (same direction) | `increases` |
| Negative link (opposite direction) | `decreases` |
| Delay | edge `label` "delay: ..." plus `explanation` |
| Loop name and type | `note` (title "R1 ..." / "B1 ..."), not connected by edges |
| Unknown cause or sign | `card` with `state: "question"` |
| A small picture of the loop | `visual` with the loop motif from blueprint-svg-motifs |

Do not use `both: true` to mean a loop; a loop is two or more separate one-way links. Do not use `flow` here: material moving is not causation.

## Common mistakes
- **Actions as nodes** ("Hire people"): an action has no "more or less". Fix: name the quantity it changes ("Team size").
- **Mixing flow with causation**: "Order → Shipping → Delivery" is a process. Fix: keep only links that answer "if more, then more or less"; move the steps to a process visual.
- **Loops unlabelled**: the reader cannot tell spiral from limit. Fix: count `decreases` per loop and add the R/B note.

## Worked example (a team's workload loops)
B1: more backlog leads to overtime, which completes work and shrinks the backlog (one `decreases`, balancing). R1: overtime also raises fatigue after a delay, fatigue raises errors, errors create rework that grows the backlog (no `decreases`, reinforcing).
```json
{
  "projectId": "demo", "systemId": "workload", "visualId": "loops",
  "ops": [
    { "op": "add_node", "node": { "id": "backlog", "kind": "card", "title": "Backlog", "icon": "inbox", "weight": "lg",
      "explanation": "Amount of work waiting to be done." } },
    { "op": "add_node", "node": { "id": "overtime", "kind": "card", "title": "Overtime hours", "icon": "clock",
      "explanation": "Hours worked beyond the normal week to catch up." } },
    { "op": "add_node", "node": { "id": "done", "kind": "card", "title": "Work completed", "tone": "good",
      "explanation": "Tasks finished per week." } },
    { "op": "add_node", "node": { "id": "fatigue", "kind": "card", "title": "Fatigue", "tone": "warn",
      "explanation": "How tired the team is. Builds up slowly over weeks of overtime." } },
    { "op": "add_node", "node": { "id": "errors", "kind": "card", "title": "Error rate", "tone": "bad",
      "explanation": "Share of finished work that turns out to be wrong." } },
    { "op": "add_node", "node": { "id": "rework", "kind": "card", "title": "Rework", "tone": "bad",
      "explanation": "Work that must be redone because of errors. It lands back in the backlog." } },
    { "op": "add_node", "node": { "id": "b1", "kind": "note", "title": "B1 Catch-up", "caption": "More backlog, more overtime, more done, less backlog.",
      "explanation": "Balancing loop: one decreases link, so it pulls the backlog back toward zero." } },
    { "op": "add_node", "node": { "id": "r1", "kind": "note", "title": "R1 Burnout spiral", "caption": "Overtime breeds fatigue, errors and rework, which grow the backlog.",
      "explanation": "Reinforcing loop: no decreases links, so it amplifies. Its delay hides it at first." } },
    { "op": "add_edge", "edge": { "id": "e-backlog-overtime", "source": "backlog", "target": "overtime", "kind": "increases",
      "explanation": "A bigger backlog pushes the team to work longer hours." } },
    { "op": "add_edge", "edge": { "id": "e-overtime-done", "source": "overtime", "target": "done", "kind": "increases",
      "explanation": "Extra hours finish more work in the short run." } },
    { "op": "add_edge", "edge": { "id": "e-done-backlog", "source": "done", "target": "backlog", "kind": "decreases",
      "explanation": "Finished work leaves the backlog." } },
    { "op": "add_edge", "edge": { "id": "e-overtime-fatigue", "source": "overtime", "target": "fatigue", "kind": "increases", "label": "delay: weeks",
      "explanation": "Fatigue rises only after several weeks of sustained overtime." } },
    { "op": "add_edge", "edge": { "id": "e-fatigue-errors", "source": "fatigue", "target": "errors", "kind": "increases",
      "explanation": "Tired people make more mistakes." } },
    { "op": "add_edge", "edge": { "id": "e-errors-rework", "source": "errors", "target": "rework", "kind": "increases",
      "explanation": "Each error has to be found and fixed." } },
    { "op": "add_edge", "edge": { "id": "e-rework-backlog", "source": "rework", "target": "backlog", "kind": "increases",
      "explanation": "Rework is new work added to the backlog." } }
  ]
}
```
