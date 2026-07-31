# CLAUDE-SUPERSTACK — GLOBAL MASTER ROUTER
# Version 1.6.0 | Applies to EVERY project and EVERY prompt.
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
   `graphify-out/` outputs to locate relevant files
4. Only if memory has nothing: ask the user.

SILENT means literally that: do NOT narrate this step in any form — no
"reading vault", "checking memory", "memory shows...", not even a one-line
mention before your real answer. Tool calls will show in the transcript
regardless; the rule is about your PROSE, not the tool call itself. This does
NOT conflict with Step 0's "no silent assumptions" — that rule is about
requirements and decisions you make, not about narrating routine file reads.
If you catch yourself writing a sentence that starts with "Checking..." or
"Reading..." before this step's output, delete it before responding.

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
STATE the level being used in one short line before executing (not a silent
internal decision) — e.g. "Ponytail: ultra (quick fix)." SILENT tasks (pure
memory reads) are exempt.

## STEP 3 — INTENT ROUTING

Match the prompt's intent and select the tool chain:

Chain entries prefixed `skill:` are invoked via the Skill tool (they are NOT
shell commands or slash commands, even when named like one) — GSD-core and
ui-ux-pro-max ship as skills, not CLIs. Entries prefixed `/` are real ECC
slash commands. Verify names against `~/.claude/skills/` and
`~/.claude/plugins/cache/*/commands/` if a chain ever 404s — do not guess.

| Intent | Chain |
|---|---|
| New feature | graphify query → plan (see planner rule) → [skill:ui-ux-pro-max:design if UI] → skill:gsd-execute-phase → /ecc:code-review |
| Bug fix | graphify query → skill:gsd-debug (or skill:gsd-quick for small fixes) → fix (ponytail ultra) → /ecc:quality-gate |
| Debug/build error | graphify query → /ecc:build-fix → /ecc:checkpoint |
| Refactor/cleanup | skill:ponytail:ponytail-audit → /ecc:refactor-clean → /ecc:test-coverage |
| Tests | graphify query → skill:ecc tdd-workflow → /ecc:test-coverage |
| Security | /ecc:security-scan → skill:ecc security-review |
| UI/design | skill:ui-ux-pro-max:design (or :ui-styling) → build with result → [skill:ecc:accessibility if a11y-specific] → [open-design skill if artifact needed & repos_enabled.open-design is true] |
| Research | skill:claude-obsidian:autoresearch <topic> → results filed into .vault/ |
| Memory question ("what do we know about X") | vault + graphify only, cited answer, SILENT (no preview) |
| Remember/save | vault ingest or /save — SILENT |
| Ship/release | skill:gsd-ship → /ecc:quality-gate → graphify diff → /save |
| Understand codebase | graphify query → summarize from graph; if genuinely unfamiliar (first time in this repo) → skill:gsd-onboard → skill:gsd-map-codebase first (graphify has no separate `.` subcommand — `graphify run .` builds the graph, `graphify query` reads it) |
| Documentation (write/update docs) | graphify query → /ecc:update-docs |
| Database/schema change | skill:ecc:database-migrations → agent:database-reviewer (review the migration) |
| Review an existing PR | /ecc:review-pr (or /ecc:pr for the PR workflow itself) |
| Deep/intermittent bug (not a simple build failure) | skill:superpowers:systematic-debugging → skill:gsd-debug |
| Extract/save a reusable pattern | skill:ecc:learn → vault ingest |
| Project status/progress | skill:gsd-progress (or skill:gsd-stats for metrics) |

**Planner rule** (when intent = plan/feature): decide intelligently —
- Multi-phase / large / risky → skill:gsd-plan-phase (or skill:gsd-new-project if greenfield) (GSD)
- Small, well-understood → /ecc:plan (ECC)
- Exploratory / unclear requirements → skill:superpowers:brainstorming (Superpowers)
State which planner you chose and why in one line.

ANNOUNCE the matched chain before running it, one line: "→ routing: <chain>"
(not silent — this is what makes routing legible, not just aspirational).
SILENT-classified tasks (Step 4) are exempt from this announcement too.

If a command from the chain is unavailable in this environment, do the
equivalent work manually following that repo's methodology, and say so
in one line.

**Run the EXACT items named in the matched row — never a nearby-sounding
substitute.** A similarly-named skill from the same repo is NOT interchangeable
with the one the table names, even when it feels "close enough": if the row
says `skill:ponytail:ponytail-audit`, running `skill:ponytail:ponytail-review`
instead is a router violation, not a reasonable stand-in — they do different
things and the PreToolUse guard cannot tell them apart (it only checks that
*some* SuperStack skill ran this turn, not that the *right* one did). This
applies per item: if a chain has three steps, run all three, in order — do
not collapse "Bug fix" into a single quality-pass skill instead of
`skill:gsd-debug → fix → /ecc:quality-gate`, and do not silently drop the
security row's `/ecc:security-scan` step just because `skill:ecc:security-review`
also ran. Only the "unavailable in this environment" fallback above licenses
a substitution — and even then it must be disclosed in one line, not silent.

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
4. THIS IS NOT OPTIONAL. Skipping the preview on a NORMAL/HEAVY/DESTRUCTIVE
   task without `/skip` is a router violation, not a shortcut — treat "did I
   show the preview?" as part of goal-verification (Step 0), not an
   afterthought. A `PreToolUse` hook enforces routing mechanically in
   SuperStack projects (blocks Edit/Write until a skill/agent/plugin has run
   this turn) — but it cannot verify you announced the chain or preview, so
   that half is still on you to actually do, every time.

## STEP 5 — EXECUTE

Run the chain — the full chain, the exact items, per the anti-substitution
rule in Step 3, not just the first step or a close-enough alternative. Keep
output minimal (ponytail). Verify success criteria (karpathy). Use ECC
quality gates before declaring done.

**Routing is ENFORCED, not advisory.** In a SuperStack project (one with a
`.superstack.json`), a `PreToolUse` hook (`superstack-route-guard.js`) BLOCKS
`Edit`/`Write`/`MultiEdit` until the turn has invoked at least one SuperStack
skill, agent, or plugin. So actually route through the relevant one for the
intent before editing — don't shortcut straight to a raw edit. Bypass a single
prompt with `/skip`; disable for a project with `"enforce_routing": false` in
`.superstack.json`. Outside a SuperStack project the gate does nothing.

On READ-ONLY turns (explain/understand/research/memory questions) there is no
edit for that guard to block, so a second check backstops them: the Stop hook
compares the prompt's intent against the repos actually used and prints a
`⚠ routing-miss: expected <repo> for <intent>, none ran` warning in the banner
when the matching skill was skipped. It is a warning, not a block (nothing can
block "just answering"), but treat a routing-miss as a real violation to
correct next turn, not noise. `/skip` suppresses it for that prompt.

## STEP 6 — MEMORY WRITE (silent)

After completing meaningful work you MUST persist memory — this is not optional,
it is how the next session inherits context:
1. Append a substantive 2-5 line summary to `.vault/hot.md` — what changed, why,
   and which files were affected (rotate: the Stop hook keeps the last ~50 lines).
2. Add/refresh entries in `.vault/index.md` if new topics were created.
3. If code changed: note affected files; re-run graphify on changed dirs
   when convenient (or on /ship).
Never announce these writes — no "updating memory", "saving to vault", or
similar line before or after the write. Same rule as Step 1: the file write
itself is fine and expected, narrating it in your response is not.

The Stop hook ALSO records one factual trace line automatically each turn
(`- [time] used: <tools> — <prompt>`), so memory is never empty even if a turn
was light. That auto-line is complementary — it does NOT replace your own
substantive summary above, which carries the reasoning the trace can't.

## STEP 7 — REPORT

A Stop hook shows a one-line "SuperStack: used ... | skipped n/10 | Δ ..."
banner (tools/skills/agents used, router repos skipped, token/cost delta for
this turn). Do NOT suppress or duplicate it in prose — the hook's numbers are
ground truth, your own token/cost estimates are not. If the hook prints
nothing, ECC's cost bridge is unavailable this session; do not fabricate
numbers to fill the gap. Full per-turn detail (same data, no line-length
limit) is also logged as a Markdown table in `.vault/turn-log.md` for
projects that are SuperStack-initialized.

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
