---
name: blueprint-feedback-map
description: Load before drawing cause and effect that circles back in Blueprint - "why does X keep happening", vicious or virtuous cycles, growth that stalls, a fix that backfires, side effects, "what drives what", feedback loops, systems thinking. Not for ordered steps (use blueprint-process-flow) or for what the parts are (use blueprint-system-map).
---

# Feedback map (causal loops)

**Use when** things push each other up or down and the effect returns to its cause: growth spirals, limits, backlash, habits.
**Do not use** for "first A, then B" sequences, for who-sends-what, or when no link returns to its start (then it is a plain chain; a process or concept visual fits better).

## Draw the loop as a loop
A single loop is drawn with `layout.arrangement: "ring"`: its variables sit evenly round a circle in loop order and each link is a curved arrow along the ring, so the eye travels round it. Give each variable `shape: "pill"` (or `circle` for a short name) and keep 3-6 variables per ring. Two loops that share a variable: one visual per loop (same system), or a `flow` visual where the return links go round the outer gutter.

## Method
1. Name the behaviour to explain in the visual `description` ("why the backlog keeps growing").
2. List the **variables**: quantities that can rise or fall, phrased as neutral nouns ("Backlog", "Fatigue", "Price"), not actions.
3. Link causes to effects in loop order. For each link ask: if the cause goes up, does the effect go up (`increases`) or down (`decreases`)? If you cannot answer, leave the link out or add a `question` card.
4. Count `decreases` links round the loop: even (or zero) = **reinforcing** (R, amplifies); odd = **balancing** (B, seeks a limit). Put "R" or "B" and the loop's story in the visual `description` and in the closing link's `explanation`.
5. Mark slow links with a `label` ("delay: weeks") and say how long in `explanation`.
6. Apply with `{"arrangement": "ring"}`, snapshot, and check the loop reads round in one direction.

## Mapping onto Blueprint
| Concept | Blueprint |
|---|---|
| Variable | `card` with `shape: "pill"`, noun title; `tone` `bad`/`good` for harm/goal |
| Positive link | `increases` |
| Negative link | `decreases` |
| Delay | edge `label` "delay: ..." plus `explanation` |
| Unknown cause or sign | `card` with `state: "question"` |
| The loop itself | `layout.arrangement: "ring"` (no separate loop drawing) |

Do not use `both: true` to mean a loop; a loop is separate one-way links. Do not use `flow` for causation unless something literally moves.

## Common mistakes
- **A loop drawn as a column**: the return link climbs back up the page and the cycle is hard to see. Fix: `ring`.
- **Actions as nodes** ("Hire people"): name the quantity it changes ("Team size").
- **Unmarked loop type**: say R or B in the description.

## Worked example (the habit loop, reinforcing)
```json
{
  "projectId": "demo", "systemId": "habits", "visualId": "loop",
  "layout": { "arrangement": "ring" },
  "ops": [
    { "op": "add_node", "node": { "id": "cue", "kind": "card", "shape": "pill", "title": "Cue", "icon": "bell",
      "explanation": "Something in the surroundings that starts the habit: a time, a place, a notification." } },
    { "op": "add_node", "node": { "id": "craving", "kind": "card", "shape": "pill", "title": "Craving", "icon": "sparkles",
      "explanation": "The wish for the change the habit brings. The cue only matters because of it." } },
    { "op": "add_node", "node": { "id": "response", "kind": "card", "shape": "pill", "title": "Response", "icon": "hand",
      "explanation": "The habit itself: the action taken." } },
    { "op": "add_node", "node": { "id": "reward", "kind": "card", "shape": "pill", "title": "Reward", "icon": "gift", "tone": "good",
      "explanation": "What the action pays back. It teaches the brain to notice the cue next time." } },
    { "op": "add_edge", "edge": { "id": "e1", "source": "cue", "target": "craving", "kind": "flow", "explanation": "The cue sets off the craving." } },
    { "op": "add_edge", "edge": { "id": "e2", "source": "craving", "target": "response", "kind": "flow", "explanation": "The craving drives the action." } },
    { "op": "add_edge", "edge": { "id": "e3", "source": "response", "target": "reward", "kind": "flow", "explanation": "The action earns the reward." } },
    { "op": "add_edge", "edge": { "id": "e4", "source": "reward", "target": "cue", "kind": "increases", "label": "strengthens",
      "explanation": "Each reward makes the cue more noticeable, so the loop runs again more easily." } }
  ]
}
```
Three `flow` steps and one `increases` link close the loop; no `decreases`, so it reinforces: every reward makes the next cue stronger.
