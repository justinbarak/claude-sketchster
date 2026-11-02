---
name: sketchy
description: Draws hand-sketched, interactive diagrams (architecture, flows with step-by-step walkthroughs, comparisons, metaphors, Arduino circuits) inline in the chat. Use when the user asks for a sketch, diagram, drawing or visual walkthrough, or asks how a multi-part system, process or comparison works and its structure would be clearer drawn than written. Do not use for simple factual questions, short definitions, text deliverables (emails, code, documents, files), data charts, or when the user asked for a file. In the regular Claude chat, use this skill even if Sketchy MCP tools are connected, because the chat does not display their drawings.
---

# Sketchy

In the regular Claude chat, always use this skill instead of the Sketchy MCP tools: the chat runs those tools but does not show their drawings.

You describe **what** to draw in a few short lines; Sketchy computes every position and renders it in a hand-drawn style with hover details and step navigation. Never pass coordinates.

## When not to draw

Answer in text instead when any of these hold:

- The answer fits in a few sentences, or is a single fact, number or definition.
- The user wants text to use elsewhere: an email, code, a document or a file.
- The content is numeric data. A chart tool fits better than boxes and arrows.
- The answer would need fewer than 3 nodes. That is a sentence, not a diagram.
- A diagram would need engineering precision (to-scale drawings, P&IDs, schematics with values that matter). Sketchy's style is deliberately loose.

## Workflow

Draw inline with your visualization tool (the one that renders HTML widgets in the conversation). Pass this HTML as the widget code, with the scene inside the first `<script>` block:

```html
<h2 class="sr-only">One-sentence summary of the drawing</h2>
<div id="sketchy" style="min-height: 320px"></div>
<script type="text/plain" id="sketchy-scene">
  title How a web request works
  dir right
  group net The internet
  browser Browser @globe ~ Shown on hover
  server Server @server in net !accent
  db Database (cylinder) in net
  browser -> server HTTPS
  server --> db query
  step Request: The browser asks the server | browser server browser->server
</script>
{{SCRIPT}}
<script>
  Sketchy.draw("#sketchy", document.getElementById("sketchy-scene").textContent);
</script>
```

Keep the widget code exactly like this: no other markup, styles or text, and do not edit the script tag that loads Sketchy (its integrity hash must match). The scene is plain text, so backticks, quotes and `${...}` are safe in it. The one sequence it must never contain is `</script`; write `< /script` if you truly need it.

Then explain the drawing in 2–4 sentences in your reply instead of describing it again. If the widget shows "Sketchy could not draw this", fix the line the message names and draw again. If the widget stays blank, the script was blocked; say so briefly and answer in text instead of retrying.

To change an earlier drawing, draw the whole scene again with the same ids.

Without a visualization tool, write the scene to a file and render a standalone page with the script in this skill's folder (Node.js, no network needed), then share the file:

```bash
node <skill-folder>/scripts/render.mjs /tmp/scene.txt /mnt/user-data/outputs/<short-name>.html
```

## Scene syntax

One element per line:

```
title <text>            subtitle <text>            dir right|down
group <id> <label> [in <parent group>]
<id> <label> [@icon] [(shape)] [in <group>] [!accent|!muted] [~ hover text]
<a> -> <b> [label] [!accent|!muted]      (--> dashed, <-> arrowheads on both ends)
label <id>[.<pin>] <text>
step <title>: <text> | <ids to highlight; edges as a->b>
part <id> <type> [key=value] [caption]
wire <part.pin> -> <part.pin> [red|black|blue|green|yellow|orange|purple|gray|white]
```

- Labels are 1–4 words; put details after `~`.
- Icons: `@globe`, `@server`, `@database` (Lucide) or `@simple-icons:react`.
- Shapes: `(cylinder)` storage, `(person)` actor, `(note)`, `(circle)`, `(rounded)`, `(text)`.
- Ids are letters, digits, `_` or `-`, unique across the scene; arrows, labels and steps may only use ids defined in it.

### Rules that prevent parse errors

- Never use these words as ids: `title`, `subtitle`, `dir`, `group`, `label`, `step`, `part`, `wire`, `image`. A line starting with one is read as that keyword.
- In a node line, `in <word>` means "inside group <word>" whenever a group with that id exists. Do not name a group with a word that also appears after "in" in a label (a group `transit` plus a node "Data in transit" will misfire).
- In a node label, any word starting with `@` is an icon and `(word)` may be a shape. Rephrase labels that need those literally.
- In a step, the first `:` ends the title and the single `|` starts the ids. Write `\:` or `\|` for a literal colon or pipe in the title or text.
- `~` (space, tilde, space) starts hover text; arrows have no hover text.
- A line starting with `#` is a comment.

## Explanation patterns

Pick one per drawing:

- **structure** ("what is it made of?"): components as nodes, groups for areas, labels for the important bits; `dir down` for hierarchies.
- **flow** ("how does it work?"): a chain of nodes and arrows plus one step per stage.
- **comparison** ("X vs Y"): one group per option with parallel nodes in the same order; `!muted` for what is equal, `!accent` for the key difference.
- **metaphor** ("explain it simply"): one group for the real thing, one for an everyday counterpart, dashed arrows between matching elements.

Quality rules: 3–12 nodes; `!accent` on at most one or two elements; icons sparingly; 3–7 steps of one or two sentences each.

Narrow screens: many readers are on a phone, where a long `dir right` chain shrinks to unreadable text. Use `dir right` only for chains of 5 nodes or fewer; for longer flows use `dir down`, or split the chain into groups so it wraps.

## Circuits

Circuits need code execution to look up real part types and pin names:

```bash
node <skill-folder>/scripts/render.mjs --parts "distance sensor"
node <skill-folder>/scripts/render.mjs --parts arduino-uno
```

Then add `part uno arduino-uno`, `part r1 resistor value=220` and `wire uno.13 -> r1.1 green`. Red wires for power, black for GND, other colors for signals; a resistor in series with every LED.

If you cannot run the lookup (no code execution), do not guess part types or pin names. A wrong pin on a wiring diagram is worse than no diagram. Explain the wiring in text, or draw a plain block diagram with nodes and arrows instead of parts and wires.
