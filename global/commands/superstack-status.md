# SuperStack Status Command

Report health of the SuperStack framework for this project.

## Usage

`/superstack-status`

## Behavior

Report, concisely, in this order:

1. **Active repos**: run `superstack doctor` (the installed CLI) if available,
   otherwise check `~/.claude/plugins/` for: ecc, superpowers, ponytail,
   claude-obsidian, obsidian-skills, karpathy, ui-ux-pro-max, gsd-core,
   graphify, open-design. List each as installed/missing.
2. **Ponytail level**: read `.superstack.json` → `ponytail_level` (or "auto"
   if unset/missing).
3. **Vault health**: does `.vault/hot.md` and `.vault/index.md` exist in the
   current project? Report present/missing and rough size (line count) of
   `hot.md`.
4. **Graph health**: does `graphify-out/` exist? If so, note when it was last
   updated (mtime of newest file inside).

Output as a short plain-text block, no more than ~10 lines. Do not run any
destructive or write operations — this is read-only.
