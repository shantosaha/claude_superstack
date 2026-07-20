# SuperStack — Simple User Guide

A plain-language guide to installing and using SuperStack. No jargon, no
complicated diagrams — just what to do, in order.

---

## What Is This, In One Sentence

SuperStack makes Claude Code smarter by connecting 10 helpful tools together,
so you just talk normally and the right tools kick in by themselves.

---

## Before You Install — What You Need

Check these are installed on your computer:

- **Git** — for downloading things
- **Node.js** (version 20 or higher) — Claude Code needs this anyway
- **Claude Code** — you should already have this

If you're not sure, don't worry — the installer checks for you and tells you
what's missing.

---

## Step 1: Install SuperStack (one time only)

### On Mac or Linux

Open your terminal and paste this:

```bash
curl -fsSL https://raw.githubusercontent.com/shantosaha/claude_superstack/main/install.sh | bash
```

### On Windows

Open PowerShell and paste this:

```powershell
irm https://raw.githubusercontent.com/shantosaha/claude_superstack/main/install.ps1 | iex
```

**What happens:** it downloads the 10 tools, sets everything up, and takes
about 5 minutes. You'll see checkmarks (✅) as each tool installs. If
something can't install automatically, it tells you the exact command to
run yourself — nothing fails silently.

**You only do this once per computer.**

### Prefer to clone the repo yourself first?

Any of these work the same way:

```bash
# HTTPS
git clone https://github.com/shantosaha/claude_superstack.git

# SSH
git clone git@github.com:shantosaha/claude_superstack.git

# GitHub CLI
gh repo clone shantosaha/claude_superstack
```

Then run: `cd claude_superstack && bash install.sh` (or `install.ps1` on
Windows).

---

## Step 2: Create Your First Project

```bash
superstack init my-project
```

Replace `my-project` with whatever you want to call it. This creates a new
folder with everything set up — memory, code understanding, and rules — ready
to use.

**Already have a project you want to add this to instead?**

```bash
cd my-existing-project
superstack migrate .
```

The dot (`.`) means "this current folder."

---

## Step 3: Open Claude Code and Just Talk

That's it. Open your project in Claude Code and type normally, like you're
talking to a helpful coworker. No special syntax needed.

---

## Real Example #1: Building a Feature

**You type:**
> add auth to the login page

**Claude replies:**
> → Plan: /gsd-plan-feature (structure the work)
> → Design: search for an auth form pattern
> → Build: implement it
> → Review: check code quality
> ~4 files affected. Proceed?

**You type:**
> yes

Claude builds it, using the right tools automatically. You didn't have to
know which tool does what — SuperStack figured it out.

---

## Real Example #2: The Messy, Real-Life Prompt

You don't have to write perfect instructions. Real prompts are often vague,
and that's fine.

**You type:**
> I don't know what happened, it was working before but now it's broken

**What Claude does:**
1. Checks its memory of your project first (silently, free, instant)
2. Looks at what changed recently in your code
3. If it's still unsure, asks you ONE clarifying question (not twenty)
4. Shows a quick preview of how it plans to investigate
5. Fixes it

You don't need to explain "please use the debugging skill" — Claude
recognizes this as a bug-hunting request on its own.

---

## Real Example #3: Multiple Requests in One Prompt

**You type:**
> can you fix the broken button, also clean up this messy file, and write a couple tests

**What Claude does:**
Splits this into three separate tasks, shows you all three in one preview,
and does them in order:

> → Fix: repair the broken button
> → Cleanup: simplify the messy file
> → Tests: write tests for it
> Proceed?

---

## Real Example #4: Just Asking a Question

**You type:**
> what do we know about the payment system?

**What Claude does:**
Reads your project's memory (instantly, no preview needed — this never
costs anything) and answers directly, citing what it found in your notes.

---

## The Preview — Why You See It, and How to Skip It

Before doing most things, Claude shows you a one-line summary of what it's
about to do and asks "Proceed?" This is so you're never surprised.

**Want to skip it for something small?** Add `/skip` to your prompt:

> fix this typo /skip

Claude just does it, no confirmation needed.

**Important:** for anything big or risky — deleting files, touching more
than 10 files at once, or big codebase-wide changes — Claude will ALWAYS
show you the preview, even if you type `/skip`. This is on purpose, to keep
you safe from accidents.

---

## Commands You Can Type Inside Claude Code

| Command | What It Does |
|---|---|
| `/skip` | Skip the preview for this one message |
| `/ponytail lite` | Make Claude write more exploratory, less minimal code |
| `/ponytail full` | Balanced code style (this is the default) |
| `/ponytail ultra` | Maximum minimal, shortest-possible code |
| `/ponytail auto` | Let Claude pick the level automatically again |
| `/superstack-status` | Show what's currently active and healthy |
| `/save` | Save this conversation into your project's memory |
| `/save my-notes` | Save it with a specific name |

You don't have to use these often — the system usually figures things out on
its own. They're there for when you want to take control.

---

## Commands You Type in Your Terminal (Not Inside Claude Code)

| Command | What It Does |
|---|---|
| `superstack init <name>` | Create a brand new project |
| `superstack migrate <path>` | Add SuperStack to a project you already have |
| `superstack doctor` | Check that everything is healthy |
| `superstack update` | Get the latest version of all 10 tools |
| `superstack uninstall` | Remove SuperStack |

---

## Keeping Things Updated

Every once in a while (say, once a month), run:

```bash
superstack update
```

This grabs the newest version of every tool in the stack. Takes a couple
minutes. Your projects and their memory are never touched — only the tools
themselves get updated.

---

## Checking If Everything Is Working

If something feels off, run:

```bash
superstack doctor
```

It checks each of the 10 tools and tells you what's healthy (✅) and what
needs attention (⚠️), with the exact fix to run.

---

## Your Project's Memory — What It Looks Like

Every project you set up gets a `.vault` folder — think of it as a personal
notebook for that project. You never have to touch it directly, but if
you're curious:

- Open the `.vault` folder in the free **Obsidian** app to see your notes
  visually, with everything linked together
- Open `.graphify/graph.html` in your web browser to see a visual map of how
  your code connects

You don't need to manage these files by hand — Claude reads and updates them
for you automatically.

---

## Frequently Asked "Wait, What About...?"

**Q: Can I still use the original commands from each of the 10 tools directly?**
Yes. Nothing is hidden or blocked. If you know a specific command like
`/ecc:security-scan`, you can type it any time. SuperStack just also picks
the common ones automatically so you don't have to remember them.

**Q: What if Claude picks the wrong tool for my request?**
Just tell it — "actually, use GSD for this instead" or "skip the design
search." Claude adjusts immediately. You're always in control; the
automatic routing is a starting suggestion, not a locked-in decision.

**Q: Does this slow things down?**
Memory checks are instant and free (just reading files on your computer).
The only extra step is the one-line preview before bigger actions, which
you can skip for small stuff with `/skip`.

**Q: Is my project data sent anywhere?**
Your project's memory (`.vault`, `.graphify`) lives on your own computer.
Nothing about your local memory files is uploaded anywhere by SuperStack
itself.

---

## Quick Start Recap (Copy-Paste Cheat Sheet)

```bash
# Install once
curl -fsSL https://raw.githubusercontent.com/shantosaha/claude_superstack/main/install.sh | bash

# New project
superstack init my-project

# Existing project
cd my-existing-project && superstack migrate .

# Check health anytime
superstack doctor

# Update everything monthly
superstack update
```

Then just open Claude Code and talk normally. That's the whole system.
