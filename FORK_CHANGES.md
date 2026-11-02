# Fork changes

Changes from upstream [ddkbs/sketchy](https://github.com/ddkbs/sketchy) v0.1.6.

## Security: pinned, integrity-checked bundle

Upstream's skill loads `sketchy.js` from `jsdelivr.net/gh/ddkbs/sketchy@cdn/<minor>/`. That is a mutable branch folder that every patch release overwrites, with no integrity check, so any push to the `cdn` branch runs in every installed skill.

This fork:

- Pins the script to an exact commit of the `cdn` branch and version folder, and adds a `sha384` Subresource Integrity hash of the bundle built in the same CI job. The browser refuses to run anything else.
- Publishes exact-version folders only and fails the release if the folder already exists, so nothing is overwritten after release.
- Uses the fork's own repository for the CDN path (`${{ github.repository }}`), so you load code you built, not upstream's.
- `SKETCHY_CDN_CHANNEL=minor` restores upstream's auto-update behavior, if you deliberately want it.

The tradeoff: you get fixes only by building and uploading a new skill zip.

## Correctness: scene embedding

The scene now sits in a `<script type="text/plain">` block and is read with `textContent`, instead of a JS template literal. Backticks and `${...}` in labels can no longer break the widget or inject code. The only forbidden sequence is `</script`, which the SKILL.md calls out.

## Parser fixes (`src/scene/compact.ts`, with tests)

- `in <word>` in a node line is a group only if that group is declared somewhere in the scene. Before, "Data in transit" became label "Data" in a nonexistent group "transit".
- Steps accept `\:` and `\|` for a literal colon or pipe. An unescaped extra `|` now gives a clear error instead of silently corrupting the highlight list.

## SKILL.md

- A narrower trigger description, plus a "When not to draw" section: short answers, text deliverables, numeric data, fewer than 3 nodes, and precision drawings.
- A "Rules that prevent parse errors" section: reserved ids, the `in` ambiguity, `@`/`()` tokens, step escapes, and comments.
- Mobile guidance: `dir right` only for chains of 5 nodes or fewer.
- Circuits: don't guess part types or pins without code execution; fall back to text or a block diagram.
- A blank widget (blocked script) means: say so once, then answer in text instead of retrying.

## Not changed

- Icons and the sql.js WASM still load from npm on jsDelivr at exact versions. npm versions are immutable, so the risk there is low.
- `parts.json` loads next to the script, so it is covered by the commit pin, though not by SRI.
- The MCP server and desktop extension are untouched.

## Building your release

1. Push this repo to your own GitHub account and create an empty `cdn` branch:
   `git switch --orphan cdn && git commit --allow-empty -m cdn && git push -u origin cdn && git switch main`
2. Tag and push: `git tag v0.1.6-fork.1 && git push --tags`. The Release workflow publishes the bundle and builds `sketchy-skill-*.zip` pinned to that commit.
3. Upload that zip from the draft release in Claude under Settings → Capabilities → Skills.

Do not upload a zip built locally without `SKETCHY_CDN_REF`. Its hash matches your local bundle, not anything on the CDN, so it will refuse to load.
