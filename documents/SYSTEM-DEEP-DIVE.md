# CLAUDE-SUPERSTACK — Complete System Deep-Dive (A-Z)
### The definitive technical breakdown of the entire SuperStack architecture

> This document explains everything: what SuperStack is, how it's structured, how
> it behaves on every single prompt, every command it uses, every design decision,
> and why. Read top to bottom for full understanding, or jump to any section.

---

## Table of Contents

1. [What Is SuperStack](#1-what-is-superstack)
2. [The 10 Repos & Their Roles](#2-the-10-repos--their-roles)
3. [Global Architecture](#3-global-architecture)
4. [Per-Project Architecture](#4-per-project-architecture)
5. [The Master Router (The Brain)](#5-the-master-router-the-brain)
6. [The Full Prompt Lifecycle](#6-the-full-prompt-lifecycle)
7. [Memory System (Vault + Graphify)](#7-memory-system-vault--graphify)
8. [Preview & Confirmation Protocol](#8-preview--confirmation-protocol)
9. [Ponytail: Token & Code Optimization](#9-ponytail-token--code-optimization)
10. [Skills, Agents & Sub-Agents](#10-skills-agents--sub-agents)
11. [Hooks: The Automation Layer](#11-hooks-the-automation-layer)
12. [Intent Routing Table (Full)](#12-intent-routing-table-full)
13. [The CLI Tool (superstack)](#13-the-cli-tool-superstack)
14. [Installation Flow, Step by Step](#14-installation-flow-step-by-step)
15. [Update Flow, Step by Step](#15-update-flow-step-by-step)
16. [File-by-File Reference](#16-file-by-file-reference)
17. [Design Decisions & Trade-offs](#17-design-decisions--trade-offs)
18. [Known Gaps & Limitations](#18-known-gaps--limitations)
19. [Visual Diagrams Index](#19-visual-diagrams-index)

---

## 1. What Is SuperStack

**claude_superstack** is a unification layer that sits on top of Claude Code and
wires together 10 independent open-source frameworks so they act as ONE coherent
system instead of 10 separate tools you'd have to remember to invoke.

Without SuperStack, using these 10 repos looks like this:

```
You: "add auth to login page"
You manually think: "should I use GSD or ECC to plan this?"
You manually type: /gsd-plan-feature
You manually think: "I should check the design system"
You manually type: uipro search "auth form"
You manually type: /execute-plan
You manually remember: "did I run code review?"
You manually type: /ecc:code-review
You manually think: "should I save this to my notes?"
You manually type: /save
```

With SuperStack, it looks like this:

```
You: "add auth to login page"
Claude: "→ Plan: /gsd-plan-feature, Design: uipro search 'auth form',
         Build: /execute-plan, Review: /ecc:code-review. Proceed?"
You: "yes"
[everything runs, memory auto-updates]
```

SuperStack does NOT replace any of the 10 repos. It does not fork or modify their
code. It is a **routing + memory + discipline layer** written as instructions
(`CLAUDE.md`), automation (`hooks.json`), and a small CLI (`superstack`) that
installs, initializes, and maintains the whole stack.

### The Core Idea in One Sentence

> Talk to Claude normally. SuperStack decides which of the 10 frameworks (and
> which specific commands, skills, and agents inside them) should handle your
> request, shows you a one-line preview, and remembers everything for next time.

---

## 2. The 10 Repos & Their Roles

| # | Repo | GitHub | Role | Fires When |
|---|------|--------|------|------------|
| 1 | **ECC** | affaan-m/ECC | Quality, security, optimization | Code review, security scan, build fix, quality gates |
| 2 | **Superpowers** | obra/superpowers | Workflow methodology | Brainstorm → plan → execute structure |
| 3 | **GSD Core** | open-gsd/gsd-core | Long-feature context management | Multi-phase features, big/risky work |
| 4 | **Ponytail** | DietrichGebert/ponytail | Code minimalism, token efficiency | EVERY prompt (always-on) |
| 5 | **Graphify** | Graphify-Labs/graphify | Code knowledge graph | Understanding codebase, locating files |
| 6 | **claude-obsidian** | AgriciDaniel/claude-obsidian | Personal knowledge vault | Memory read/write, research, notes |
| 7 | **obsidian-skills** | kepano/obsidian-skills | Correct vault file operations | Any vault/markdown/canvas operation |
| 8 | **andrej-karpathy-skills** | multica-ai/andrej-karpathy-skills | Coding discipline | EVERY prompt (always-on) |
| 9 | **ui-ux-pro-max-skill** | nextlevelbuilder/ui-ux-pro-max-skill | Design intelligence database | UI/UX/design-related work |
| 10 | **open-design** | nexu-io/open-design | Design artifact generation | Generating prototypes/decks/images (optional) |

### Why These 10 and Not More/Fewer

Each repo covers a **distinct layer** with minimal overlap:

```
KNOWLEDGE LAYER      →  claude-obsidian, obsidian-skills, graphify
DISCIPLINE LAYER     →  andrej-karpathy-skills
MINIMIZATION LAYER   →  ponytail
WORKFLOW LAYER       →  superpowers
CONTEXT LAYER        →  gsd-core
QUALITY LAYER        →  ecc
DESIGN LAYER         →  ui-ux-pro-max-skill, open-design
```

No repo is redundant. If you removed any one, you'd lose a distinct capability
(e.g., remove Graphify → Claude can't map your codebase; remove Ponytail →
no automatic token/code minimalism).

---

## 3. Global Architecture

Everything SuperStack installs globally lives under `~/.claude/`:

```
~/.claude/                                   ← Claude Code's global config folder
│
├── CLAUDE.md                                ← MASTER ROUTER (read every session)
│   (this is the "brain" — see Section 5)
│
├── hooks/
│   └── hooks.json                           ← SessionStart + Stop automation
│
├── plugins/                                 ← installed by `claude plugin install`
│   ├── ecc/
│   ├── superpowers/
│   ├── ponytail/
│   ├── claude-obsidian/
│   ├── obsidian-skills/
│   ├── andrej-karpathy-skills/
│   └── ui-ux-pro-max/
│
├── commands/                                ← gsd-core's slash commands land here
│   ├── gsd-new-project.md
│   ├── gsd-plan-feature.md
│   └── ...
│
└── superstack/                              ← SuperStack's own home
    ├── bin/
    │   ├── superstack                       ← CLI (Mac/Linux)
    │   └── superstack.ps1                   ← CLI (Windows)
    ├── global/
    │   ├── CLAUDE.md                        ← source copy of the router
    │   └── hooks/hooks.json                 ← source copy of hooks
    └── templates/                           ← copied into every new project
        ├── CLAUDE.project.md
        ├── superstack.json
        └── vault/
            ├── hot.md
            ├── index.md
            ├── log.md
            └── wiki/
```

**Key principle:** everything global applies to **every project on your
machine**, automatically. You install once; every folder you ever run
`superstack init` or `superstack migrate` on inherits it.

---

## 4. Per-Project Architecture

Every SuperStack-enabled project looks like this:

```
my-project/
├── CLAUDE.md              ← inherits global router + project-specific notes
├── .vault/                ← THIS project's Obsidian vault (memory)
│   ├── hot.md              ← rolling recent-context cache (last ~50 lines)
│   ├── index.md            ← table of contents: what topics exist
│   ├── log.md               ← history of ingestions/sessions
│   └── wiki/                ← individual knowledge pages (Markdown)
├── .graphify/              ← THIS project's code knowledge graph
│   ├── graph.json
│   ├── graph.html          ← open in browser to visually explore
│   └── GRAPH_REPORT.md
├── .superstack.json        ← per-project config (ponytail level, toggles)
└── src/... (your actual code, untouched)
```

**Why per-project instead of one shared vault:** each project's memory stays
isolated and portable. Clone/fork the project → the memory comes with it.
Open `.vault/` directly in the Obsidian app to visually browse that project's
knowledge graph.

---

## 5. The Master Router (The Brain)

The single most important file in SuperStack is `~/.claude/CLAUDE.md`. This is
not code — it's a **set of natural-language instructions** that Claude reads at
the start of every session and follows on every single prompt. Claude Code
supports this natively: any `CLAUDE.md` in the global config or project root is
automatically loaded into context.

The router contains 7 numbered steps that Claude executes, in order, for every
prompt:

```
STEP 0 → Always-on discipline (Karpathy guidelines)
STEP 1 → Memory-first check (vault + graphify, silent)
STEP 2 → Ponytail auto-leveling
STEP 3 → Intent routing (match prompt → tool chain)
STEP 4 → Preview + confirmation
STEP 5 → Execute the chain
STEP 6 → Silent memory write-back
```

Think of it as a **flowchart written in English** that Claude follows instead
of a human following a checklist. Because Claude is a language model, it can
interpret "detect intent" and "classify heavy vs normal" using judgment — this
is both the router's power (handles vague/messy prompts) and its limit (not
100% mechanically deterministic — see Section 18).

### Why a Markdown File Instead of Code

Claude Code's actual behavior is steered by natural-language system files, not
by executable logic for "what Claude should think about." The deterministic
parts (loading a file, running a script) ARE code — that's what hooks are for
(Section 11). But routing decisions ("is this a bug fix or a feature?") require
judgment, which only the router-as-instructions approach can provide.

---

## 6. The Full Prompt Lifecycle

Here is EXACTLY what happens, in order, every time you type a prompt into
Claude Code with SuperStack active.

```
┌───────────────────────────────────────────────────────────────┐
│  YOU TYPE A PROMPT                                             │
└───────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌───────────────────────────────────────────────────────────────┐
│ (Only on session start, not every prompt)                      │
│ SessionStart HOOK fires automatically:                         │
│   • cat .vault/hot.md        → recent context, 0 tokens        │
│   • cat .vault/index.md      → what topics exist, 0 tokens     │
│ This is injected into Claude's context before you even type.   │
└───────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌───────────────────────────────────────────────────────────────┐
│ STEP 0 — ALWAYS-ON DISCIPLINE (karpathy-skills)                │
│   • No silent assumptions — ask if ambiguous                   │
│   • Goal-driven execution — verify, don't just "look done"     │
│   • Anti-overcomplication — minimum necessary code              │
│   • Never delete/rewrite code you don't understand              │
└───────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌───────────────────────────────────────────────────────────────┐
│ STEP 1 — MEMORY FIRST CHECK (claude-obsidian + graphify)       │
│ If the prompt needs context Claude doesn't have:                │
│   • Read .vault/wiki/ pages related to the topic                │
│   • Query graphify: "which files relate to X?"                  │
│   • Only if nothing found → ask the user                        │
│ This step is SILENT — no preview, because it costs 0 tokens     │
│ (these are local file reads, not API calls).                    │
└───────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌───────────────────────────────────────────────────────────────┐
│ STEP 2 — PONYTAIL AUTO-LEVEL (ponytail)                         │
│ Check .superstack.json:                                         │
│   if ponytail_level != "auto": use that value                  │
│   else decide from task type:                                  │
│     quick fix/one function      → ultra                        │
│     normal feature work         → full  (default)              │
│     complex/unfamiliar domain   → lite                         │
└───────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌───────────────────────────────────────────────────────────────┐
│ STEP 3 — INTENT ROUTING (the router's core logic)               │
│ Claude matches your prompt against the intent table             │
│ (Section 12) and picks a tool chain, e.g.:                      │
│   "add auth to login" → feature+UI →                            │
│   graphify query → /gsd-plan-feature → uipro search →           │
│   /execute-plan → /ecc:code-review                               │
│ If it's a planning task, Claude picks GSD vs ECC vs Superpowers  │
│ intelligently based on size/risk/clarity of the task.            │
└───────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌───────────────────────────────────────────────────────────────┐
│ STEP 4 — PREVIEW + CONFIRM                                       │
│ Claude classifies the task:                                     │
│   SILENT      → memory reads (never previewed)                  │
│   NORMAL      → preview shown, /skip works                      │
│   HEAVY       → >10 files or whole-codebase — preview ALWAYS     │
│   DESTRUCTIVE → deletes/overwrites/resets — preview ALWAYS       │
│ Preview looks like:                                              │
│   "→ /gsd-plan-feature (structure work), uipro search            │
│      (design pattern), /execute-plan (build),                    │
│      /ecc:code-review (verify). ~4 files. Proceed?"              │
└───────────────────────────────────────────────────────────────┘
                    │  (you confirm, or say /skip for NORMAL tasks)
                    ▼
┌───────────────────────────────────────────────────────────────┐
│ STEP 5 — EXECUTE                                                 │
│ The chain runs. Skills auto-apply (Section 10). Agents launch    │
│ where relevant. Ponytail keeps output minimal. ECC quality        │
│ gates verify before declaring done.                               │
└───────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌───────────────────────────────────────────────────────────────┐
│ STEP 6 — SILENT MEMORY WRITE-BACK                                │
│   • Append 2-5 line summary to .vault/hot.md                    │
│   • Update .vault/index.md if new topics were created             │
│   • Note affected files for the next graphify re-index           │
│ Never announced. Happens automatically via the Stop hook.        │
└───────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌───────────────────────────────────────────────────────────────┐
│ Stop HOOK fires automatically:                                   │
│   • Trims hot.md to the last ~50 lines (keeps it small)           │
└───────────────────────────────────────────────────────────────┘
```

---

## 7. Memory System (Vault + Graphify)

SuperStack's memory is **two complementary systems**, both local and free to read:

### A) The Vault (claude-obsidian + obsidian-skills)

A folder of plain Markdown files that acts like a wiki about your project.

```
.vault/
├── hot.md      → "what happened recently" — rolling ~50-line cache
├── index.md    → table of contents — what topics/pages exist
├── log.md      → history of every ingestion/session
└── wiki/       → individual pages, one topic per file, cross-linked
```

- **Writing to it**: `ingest [file]` reads a source and breaks it into 8-15
  linked wiki pages. `/save` files the current conversation as a note.
- **Reading from it**: "what do we know about X?" makes Claude read `index.md`,
  open relevant `wiki/` pages, and answer with citations to its own notes.
- **Why Markdown, not a database**: it's human-readable, git-friendly, and
  directly viewable/editable in the Obsidian app.

### B) Graphify (code structure)

A knowledge graph built by analyzing your actual source code — not your notes,
your code.

```
.graphify/
├── graph.json        → machine-readable node/edge graph
├── graph.html         → open in a browser — interactive visual graph
└── GRAPH_REPORT.md    → human-readable summary: key files, "god nodes", clusters
```

- **Built by**: `graphify run .` (parses code, extracts symbols/calls/imports)
- **Queried by**: `graphify query "<question>"` — e.g. "what handles login?"
- **Why this matters**: when you ask "why is this breaking," Claude can check
  the graph for what recently connected to the broken file, instead of
  guessing or re-reading your entire codebase from scratch.

### Why Two Systems Instead of One

Vault = knowledge ABOUT the project (decisions, research, notes).
Graphify = structure OF the project (which file calls which function).
They answer different questions and are read together at Step 1.

---

## 8. Preview & Confirmation Protocol

Every action Claude is about to take is classified into one of four buckets:

| Class | Examples | Preview Shown? | `/skip` Works? |
|---|---|---|---|
| **SILENT** | Reading vault/graph, answering from memory | Never | N/A |
| **NORMAL** | Writing a function, fixing a small bug, a plan | Always, by default | ✅ Yes — skips for this prompt only |
| **HEAVY** | >10 files touched, full-codebase refactor, mass rename | Always | ❌ No — shows regardless |
| **DESTRUCTIVE** | Deleting files, `git reset`, dropping data, overwriting the vault | Always | ❌ No — shows regardless |

**The `/skip` rule, precisely:** typing `/skip` anywhere in your prompt skips
the preview step ONLY if the task is classified NORMAL. It is never persistent
— the very next prompt previews again unless you type `/skip` again. This is
intentional: heavy/destructive actions must always get a human's eyes on them,
no matter what.

**Preview format** — always one line per command, plus a file-count estimate:

```
→ /gsd-plan-feature (structure the work)
→ uipro search "auth form" (find a design pattern)
→ /execute-plan (implement)
→ /ecc:code-review (verify quality)
~4 files affected. Proceed?
```

---

## 9. Ponytail: Token & Code Optimization

Ponytail is active on **every single prompt**, not just when explicitly
requested. It enforces:

- **YAGNI** — "You Ain't Gonna Need It." Question whether a piece of code
  needs to exist before writing it.
- **Standard library first** — reach for built-in language/platform features
  before adding a dependency.
- **Minimal solution** — the shortest correct implementation wins. No
  unrequested abstractions, no "future-proofing" nobody asked for.

### Auto-Level Decision Logic

```
IF .superstack.json has ponytail_level != "auto":
    USE that saved value
ELSE decide from the task:
    quick fix / one function        → ultra  (maximum minimalism)
    normal feature work             → full   (balanced — the default)
    complex/unfamiliar architecture  → lite   (more room to explore safely)
```

You can override anytime: `/ponytail lite|full|ultra|auto` — the choice is
saved to `.superstack.json` and persists until you change it again.

### Why This Also Saves Tokens

Minimal code means fewer tokens generated per response AND fewer tokens spent
re-reading/re-explaining bloated code later. It compounds: less code to review,
less code to maintain, less context needed to understand it next session.

---

## 10. Skills, Agents & Sub-Agents

These are the three "working units" that actually do tasks. You never call
them directly — the router selects them automatically at Step 3/5.

### Skills — "how to do X"

A skill is a set of instructions/templates for a specific kind of work.
Example: `tdd-workflow` (ECC) teaches "write the failing test first, then
the implementation." When the router detects "write tests" intent, it applies
this skill so Claude follows that specific method instead of improvising.

### Agents — "do X autonomously"

An agent is a self-contained worker that completes one job end-to-end without
needing step-by-step instructions from you. Example: `wiki-ingest` (claude-
obsidian) takes a raw source file and independently decides how to split it
into 8-15 linked wiki pages, choosing titles, links, and placement itself.

### Sub-Agents — "split X into parallel pieces"

For large or multi-part work, an agent can spawn several sub-agents that each
handle one slice of the job simultaneously. Example: ECC's `/ecc:multi-plan`
spawns separate planning sub-agents for backend, frontend, and database work
at the same time instead of sequentially.

### How They Chain Together (real example)

Prompt: *"add auth to the login page"*

```
Skills applied:      gsd-planning-skill, ui-ux-pro-max design-intelligence,
                      ponytail-minimal-solution
Agents launched:      gsd-planner (phases the work)
                      ui-design-agent (finds the pattern)
                      executor (writes the code)
                      verifier (ECC — reviews before done)
Sub-agents used:      only if the feature is large enough to parallelize
                      (e.g., backend + frontend split)
```

---

## 11. Hooks: The Automation Layer

Hooks are the only genuinely deterministic (code, not judgment) part of
SuperStack. They live in `~/.claude/hooks/hooks.json` and run automatically —
Claude doesn't decide whether to run them, the Claude Code runtime does.

```json
SessionStart  → runs when you open a project in Claude Code
                cats .vault/hot.md and .vault/index.md into context
                (this is the "silent memory injection" from Step 1)

Stop          → runs when a session/turn ends
                trims .vault/hot.md down to the last ~50 lines
                (keeps the memory file small and fast to read)
```

**Why so few hooks:** hooks are best for simple, always-true actions (load
this file, trim that file). Anything requiring judgment (which skill to use,
whether to preview) belongs in the router (CLAUDE.md), not a hook — that's a
deliberate design boundary, not an oversight.

---

## 12. Intent Routing Table (Full)

This is the actual table Claude follows at Step 3, verbatim from the router:

| Your Intent | Tool Chain |
|---|---|
| New feature | graphify query → planner (see rule below) → [uipro search if UI] → `/execute-plan` → `/ecc:code-review` |
| Bug fix | graphify query → `/gsd-plan-bugfix` → fix (ponytail ultra) → `/ecc:quality-gate` |
| Debug/build error | graphify query → `/ecc:build-fix` → `/ecc:checkpoint` |
| Refactor/cleanup | `/ponytail-audit` → `/ecc:refactor-clean` → `/ecc:test-coverage` |
| Write tests | graphify query → ECC tdd-workflow skill → `/ecc:test-coverage` |
| Security check | `/ecc:security-scan` → security-review skill |
| UI/design work | `uipro search "<pattern>"` → build → [`od plugin apply` if open-design installed] |
| Research a topic | `/autoresearch <topic>` → results filed into `.vault/` |
| "What do we know about X" | vault + graphify only — silent, cited answer |
| "Remember this" / save | vault ingest — silent |
| Ship/release | `/gsd-ready-to-ship` → `/ecc:quality-gate` → `graphify diff` → `/save` |
| Understand the codebase | `graphify .` or `graphify query` → summarize |

**Planner selection rule** (used whenever intent = "plan"):
- Multi-phase, large, or risky → **GSD Core** (`/gsd-plan-feature`)
- Small and well-understood → **ECC** (`/ecc:plan`)
- Requirements still unclear → **Superpowers** (`/brainstorm`)
Claude states which one it picked and why, in one line.

---

## 13. The CLI Tool (`superstack`)

A single executable script (`bin/superstack` for Mac/Linux, `bin/superstack.ps1`
for Windows) that you run from your terminal — separate from Claude Code chat.

```
superstack install [--with-design]   Installs/verifies all 10 repos + router + hooks
superstack init <name>               Creates a new SuperStack-enabled project
superstack migrate <path>            Adds SuperStack to an existing project
superstack doctor                    Health-checks the entire stack
superstack update                    Pulls the latest version of all 10 repos
superstack uninstall                 Removes SuperStack's global files
superstack version                   Prints the version number
```

Each subcommand is a shell function inside one script — there's no separate
binary per command. `install.sh` (the one-liner) is a thin wrapper that clones
this script to `~/.claude/superstack/`, links it onto your PATH, then calls
`superstack install` itself.

---

## 14. Installation Flow, Step by Step

```
1. User runs: curl ... install.sh | bash   (or install.ps1 on Windows)
2. Script checks for git → clones/updates the superstack scripts to
   ~/.claude/superstack/
3. Adds `superstack` to PATH (~/.local/bin, added to .bashrc/.zshrc if needed)
4. Calls `superstack install`, which:
   a. Checks git, node, npx are present (hard requirement)
   b. For each of the 10 repos: checks if already installed
      → if yes, skip (idempotent — safe to re-run)
      → if no, install from its official GitHub/npm/plugin source
   c. Copies the global CLAUDE.md router into ~/.claude/CLAUDE.md
      → if one already exists, backs it up first, then merges
   d. Copies hooks.json into ~/.claude/hooks/
5. Prints next steps: `superstack init <name>` or `superstack doctor`
```

open-design is skipped by default (it needs a full Node 24 + pnpm dev
environment) — pass `--with-design` to include it.

---

## 15. Update Flow, Step by Step

```
User runs: superstack update

1. Updates the Claude Code plugin marketplace, then updates each plugin:
   ecc, superpowers, ponytail, claude-obsidian, obsidian-skills,
   andrej-karpathy-skills, ui-ux-pro-max
2. Re-runs the gsd-core installer (always pulls its @latest tag)
3. Upgrades graphify via `uv tool upgrade` (or pipx)
4. Updates the uipro CLI via npm, if installed
5. If open-design was installed: `git pull --ff-only` inside ~/open-design
6. Pulls the latest superstack scripts themselves, then re-copies the
   router + hooks in case they changed
7. Tells you to run `superstack doctor` to confirm everything is healthy
```

Nothing here touches your projects' `.vault/` or `.graphify/` — updates only
affect the global tools, never your project memory.

---

## 16. File-by-File Reference

| File | Location | Purpose |
|---|---|---|
| `CLAUDE.md` | `~/.claude/` (global) | The Master Router — read every session |
| `hooks.json` | `~/.claude/hooks/` | SessionStart memory load + Stop cache trim |
| `superstack` | `~/.claude/superstack/bin/` | The CLI tool (Mac/Linux) |
| `superstack.ps1` | `~/.claude/superstack/bin/` | The CLI tool (Windows) |
| `CLAUDE.project.md` | `templates/` | Copied as `CLAUDE.md` into every new project |
| `superstack.json` | `templates/` → project root | Per-project config: ponytail level, enabled repos |
| `hot.md` | `templates/vault/` → `.vault/` | Rolling recent-context cache |
| `index.md` | `templates/vault/` → `.vault/` | Table of contents of vault knowledge |
| `log.md` | `templates/vault/` → `.vault/` | Ingestion/session history |
| `wiki/` | `templates/vault/` → `.vault/` | Individual knowledge pages |

---

## 17. Design Decisions & Trade-offs

| Decision | Why | Trade-off Accepted |
|---|---|---|
| Vault lives inside each project | Portable — clones/forks keep memory | Vault becomes part of your git history (can `.gitignore` it if unwanted) |
| Install downloads live from official sources (no bundling) | Always latest, respects each repo's license, keeps SuperStack's own repo tiny | Requires internet at install/update time |
| Router is a Markdown file, not code | Only way to encode judgment-based routing | Not 100% mechanically deterministic (see Section 18) |
| Preview shown for NORMAL by default | Matches "confirm before acting" preference | Adds one extra confirmation step per prompt (mitigated by `/skip`) |
| Heavy/destructive always preview, `/skip` can't bypass | Safety net for irreversible or large-blast-radius actions | Slightly slower for legitimately-repeated heavy operations |
| Only ~30% of each repo's commands are auto-routed | Keeps the router simple and reliable | The other ~70% of specialized commands must be called by name |
| open-design excluded by default | It requires a heavy Node 24 + pnpm dev setup | Must opt in explicitly with `--with-design` |

---

## 18. Known Gaps & Limitations

Stated plainly, with no hedging:

1. **Routing consistency is not mechanically guaranteed.** The router is
   instructions for Claude to follow, not compiled logic. The same prompt
   asked twice will *usually* route the same way, but Claude's judgment can
   occasionally classify a task differently (e.g., miss that something
   qualifies as "heavy"). A script always behaves identically; Claude's
   judgment does not.
2. **Only common commands are auto-triggered.** Roughly 30% of the commands
   across all 10 repos are wired into the intent table. The rest (e.g.
   `/ecc:go-review`, `/ecc:instinct-export`, most `od plugin` variants) work
   fine but only if you call them by name yourself.
3. **Hooks can't read intent.** `SessionStart`/`Stop` only run fixed shell
   commands (cat a file, trim a file) — they cannot decide "was this prompt
   vague." Judgment always lives in the router, never in a hook.
4. **Plugin install commands can vary by Claude Code version.** If a
   `/plugin install` call fails during `superstack install`, the script
   prints the exact manual command to run instead of failing silently.
5. **open-design is heavy.** It needs Node 24 and pnpm and is excluded from
   the default install specifically because of this weight.

---

**End of Deep-Dive. For step-by-step usage, see the User Guide. For every
command with a one-line description, see the Command List.**

