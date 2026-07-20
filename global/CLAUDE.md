# CLAUDE-SUPERSTACK — GLOBAL MASTER ROUTER
# Version 1.0.0 | Applies to EVERY project and EVERY prompt.
# https://github.com/shantosaha/claude_superstack

You are running inside the SuperStack framework: 10 integrated repos
(ECC, Superpowers, GSD Core, Ponytail, Graphify, claude-obsidian,
obsidian-skills, andrej-karpathy-skills, ui-ux-pro-max, open-design).
Follow this router on EVERY prompt, in order.

---

## STEP 0 — ALWAYS-ON DISCIPLINE (Karpathy Guidelines)

Apply on every prompt, every task, no exceptions:
1. **Goal-driven execution**: Convert instructions into success criteria.
   Loop until criteria verifiably met. Don't stop at "looks done."
2. **No silent assumptions**: If anything is ambiguous, ASK before acting.
   Never invent requirements, paths, names, or behavior.
3. **Anti-overcomplication**: Prefer 100 lines over 1000. No unrequested
   abstractions, layers, or "future-proofing."
4. **Preserve comments & code you don't fully understand**: Never delete
   or rewrite them without explicit confirmation.

## STEP 1 — MEMORY FIRST (silent — never preview, never announce)

Before asking the user for ANY context, check local memory (0 tokens):
1. Read `.vault/hot.md` (recent session context)
2. Read `.vault/index.md` (what the vault knows)
3. If code-related: query graphify (`graphify query "<topic>"`) or read
   `.graphify/` outputs to locate relevant files
4. Only if memory has nothing: ask the user.

Use obsidian-skills conventions for ALL vault file operations
(OFM markdown, wikilinks, Bases, JSON Canvas).

## STEP 2 — PONYTAIL AUTO-LEVEL (every prompt)

Check `.superstack.json` for a user override first (`ponytail_level`).
If set to anything other than "auto", use it. Otherwise decide:
- Quick fix / small script / one function        → ultra
- Normal feature work (default)                  → full
- Complex architecture / unfamiliar domain       → lite
User can override any time with `/ponytail lite|full|ultra` (persist
the choice into `.superstack.json` under "ponytail_level").
Apply YAGNI, stdlib-first, minimal-solution principles at the chosen level.

## STEP 3 — INTENT ROUTING

Match the prompt's intent and select the tool chain:

| Intent | Chain |
|---|---|
| New feature | graphify query → plan (see planner rule) → [uipro search if UI] → /execute-plan → /ecc:code-review |
| Bug fix | graphify query → /gsd-plan-bugfix → fix (ponytail ultra) → /ecc:quality-gate |
| Debug/build error | graphify query → /ecc:build-fix → /ecc:checkpoint |
| Refactor/cleanup | /ponytail-audit → /ecc:refactor-clean → /ecc:test-coverage |
| Tests | graphify query → ECC tdd-workflow skill → /ecc:test-coverage |
| Security | /ecc:security-scan → security-review skill |
| UI/design | uipro search "<pattern>" → build with result → [od plugin apply if artifact needed & open-design installed] |
| Research | /autoresearch <topic> → results filed into .vault/ |
| Memory question ("what do we know about X") | vault + graphify only, cited answer, SILENT (no preview) |
| Remember/save | vault ingest or /save — SILENT |
| Ship/release | /gsd-ready-to-ship → /ecc:quality-gate → graphify diff → /save |
| Understand codebase | /graphify . or graphify query → summarize from graph |

**Planner rule** (when intent = plan/feature): decide intelligently —
- Multi-phase / large / risky → /gsd-plan-feature (GSD)
- Small, well-understood → /ecc:plan (ECC)
- Exploratory / unclear requirements → /brainstorm (Superpowers)
State which planner you chose and why in one line.

If a command from the chain is unavailable in this environment, do the
equivalent work manually following that repo's methodology, and say so
in one line.

## STEP 4 — PREVIEW + CONFIRMATION PROTOCOL

Task classification:
- **DESTRUCTIVE**: deleting files, git reset/force-push, dropping data,
  uninstalling, overwriting vault content, rewriting history.
- **HEAVY**: >10 files edited/created, or whole-codebase operations
  (mass rename, full refactor, full re-index).
- **NORMAL**: everything else.
- **SILENT**: memory reads, vault reads, graphify queries, hot-cache
  updates — never previewed, never announced.

Rules:
1. NORMAL and HEAVY and DESTRUCTIVE → show a preview BEFORE executing:
   one line per command in the chain: `→ /command (what it does)`,
   plus estimated files affected. Then ask: "Proceed?"
2. If the prompt contains `/skip` → skip the preview for THIS prompt
   only — but ONLY for NORMAL tasks. HEAVY and DESTRUCTIVE tasks ALWAYS
   show the preview and require explicit confirmation, /skip or not.
3. `/skip` is never persistent. Next prompt previews again.

## STEP 5 — EXECUTE

Run the chain. Keep output minimal (ponytail). Verify success criteria
(karpathy). Use ECC quality gates before declaring done.

## STEP 6 — MEMORY WRITE (silent)

After completing meaningful work:
1. Append a 2-5 line summary to `.vault/hot.md` (rotate: keep last ~50 lines)
2. Add/refresh entries in `.vault/index.md` if new topics were created
3. If code changed: note affected files; re-run graphify on changed dirs
   when convenient (or on /ship).
Never announce these writes.

## SUPERSTACK USER COMMANDS

| Command | Behavior |
|---|---|
| /skip | Skip preview for this prompt (NORMAL tasks only) |
| /ponytail lite\|full\|ultra\|auto | Set + persist ponytail level in .superstack.json |
| /superstack-status | Report: active repos, ponytail level, vault + graph health |
| /save [name] | File this conversation into .vault/ |

## PROJECT BOOTSTRAP RULE

If the current directory has no `.vault/` or `.superstack.json`, offer ONCE:
"This project isn't SuperStack-initialized. Run `superstack migrate .` to
enable memory + routing, or continue without it." Then respect the choice.
