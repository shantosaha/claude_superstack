#!/usr/bin/env node
// SuperStack per-turn execution report.
// snapshot (UserPromptSubmit) -> track (PostToolUse) -> report (Stop).
// Reuses the ECC plugin's cost bridge for token/cost deltas (ground truth);
// tracks its own skill/agent/plugin log since the ECC bridge only keeps a
// 5-entry rolling tool-name buffer, not names of skills/agents/plugins.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const REFERENCE_REPOS = [
  'ecc', 'superpowers', 'ponytail', 'claude-obsidian', 'obsidian-skills',
  'karpathy', 'ui-ux-pro-max', 'gsd-core', 'graphify', 'open-design',
];

function sanitize(id) {
  return String(id || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
}

// Project-scoped, NOT session-scoped: a dispatched subagent (e.g. via
// superpowers:subagent-driven-development or the Task tool) inherits
// CLAUDE_PROJECT_DIR from the parent process but its own tool-use hooks fire
// under a DIFFERENT session_id — keying on session_id silently dropped every
// subagent's tool calls from the parent turn's tally (confirmed live: the
// meta-skill invocation tracked fine, then 37 consecutive turns of actual
// subagent-done work all showed "used none"). Keying on project dir instead
// means parent + subagent tool calls land in the same state file. Trade-off:
// two DIFFERENT Claude Code sessions open in the SAME project directory at
// once would now share one state file — accepted as rarer than the subagent
// blind spot it fixes.
function statePath() {
  const dir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  return path.join(os.tmpdir(), `superstack-turn-${sanitize(dir)}.json`);
}

function bridgePath(sessionId) {
  return path.join(os.tmpdir(), `ecc-metrics-${sanitize(sessionId)}.json`);
}

// Walk up from CLAUDE_PROJECT_DIR (or cwd) to the first ancestor holding a
// .vault/ dir — mirrors superstack-route-guard.js so memory hooks resolve the
// vault the same way in subdirs/monorepos. Returns the .vault path or null.
function findVaultDir(startDir) {
  let dir = startDir || process.env.CLAUDE_PROJECT_DIR || process.cwd();
  for (let i = 0; i < 8; i++) {
    const vault = path.join(dir, '.vault');
    if (fs.existsSync(vault)) return vault;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function writeJsonAtomic(file, data) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data));
  fs.renameSync(tmp, file);
}

function readStdin() {
  try {
    return JSON.parse(fs.readFileSync(0, 'utf8'));
  } catch {
    return {};
  }
}

// Skills/agents are often invoked by a BARE name (Skill(security-review)) that
// drops the owning repo, so the skip-counter couldn't tell ECC's skill ran.
// Resolve a name (namespaced or bare) back to a REFERENCE_REPOS token.
const NS_REPO = {
  ecc: 'ecc', superpowers: 'superpowers', ponytail: 'ponytail', graphify: 'graphify',
  'ui-ux-pro-max': 'ui-ux-pro-max', 'claude-obsidian': 'claude-obsidian',
  obsidian: 'obsidian-skills', 'andrej-karpathy-skills': 'karpathy', karpathy: 'karpathy',
};
// Only the skills the SuperStack router actually routes to — not a catalog of
// every plugin skill. Unknown bare names stay unattributed (no false credit).
const SKILL_REPO = {
  'security-review': 'ecc', 'security-scan': 'ecc', 'code-review': 'ecc',
  'quality-gate': 'ecc', 'build-fix': 'ecc', 'checkpoint': 'ecc',
  'refactor-clean': 'ecc', 'test-coverage': 'ecc', 'tdd-workflow': 'ecc',
  'autoresearch': 'claude-obsidian', 'canvas': 'claude-obsidian',
  'save': 'claude-obsidian', 'think': 'claude-obsidian',
  'design': 'ui-ux-pro-max', 'ui-styling': 'ui-ux-pro-max',
  'banner-design': 'ui-ux-pro-max', 'brand': 'ui-ux-pro-max',
  'slides': 'ui-ux-pro-max', 'design-system': 'ui-ux-pro-max',
  'karpathy-guidelines': 'karpathy',
};
const SUPERPOWERS_SKILLS = /^(brainstorming|executing-plans|writing-plans|systematic-debugging|test-driven-development|subagent-driven-development|requesting-code-review|receiving-code-review|verification-before-completion|using-git-worktrees|dispatching-parallel-agents|writing-skills|using-superpowers|finishing-a-development-branch)$/;

function repoForSkill(raw) {
  const s = String(raw || '');
  if (s.includes(':')) {
    const ns = s.slice(0, s.indexOf(':'));
    if (NS_REPO[ns]) return NS_REPO[ns];
  }
  const name = s.includes(':') ? s.slice(s.lastIndexOf(':') + 1) : s;
  if (/^gsd-/.test(name)) return 'gsd-core';
  if (/^ponytail/.test(name)) return 'ponytail';
  if (/^wiki/.test(name)) return 'claude-obsidian';
  if (/^obsidian-/.test(name) || name === 'json-canvas') return 'obsidian-skills';
  if (SUPERPOWERS_SKILLS.test(name)) return 'superpowers';
  return SKILL_REPO[name] || null;
}

// Embed the owning repo token so the skip filter (`t.includes(repo)`) matches.
// base === repo collapses to `prefix:repo` (avoids "skill:ponytail:ponytail").
function tag(prefix, raw) {
  const s = String(raw || '?');
  const repo = repoForSkill(s);
  const base = s.includes(':') ? s.slice(s.lastIndexOf(':') + 1) : s;
  if (!repo) return `${prefix}:${s}`;
  return base === repo ? `${prefix}:${repo}` : `${prefix}:${repo}:${base}`;
}

function nameFor(toolName, toolInput) {
  toolInput = toolInput || {};
  if (toolName === 'Skill') return tag('skill', toolInput.skill || toolInput.command || '?');
  if (toolName === 'Task') return tag('agent', toolInput.subagent_type || '?');
  const mcpPlugin = /^mcp__plugin_([^_]+)__/.exec(toolName || '');
  if (mcpPlugin) return `plugin:${mcpPlugin[1]}`;
  if (/^mcp__/.test(toolName || '')) return `mcp:${toolName}`;
  // graphify is a Bash CLI (`graphify query …`), not a Skill/plugin call — the
  // only reference repo invoked that way. Detect it so read-only "understand"
  // turns don't misreport `used none` when graphify actually ran.
  if (toolName === 'Bash' && /(^|[;&|]\s*)graphify\b/.test(String(toolInput.command || ''))) {
    return 'graphify';
  }
  return null;
}

function cmdSnapshot(input) {
  const sessionId = input.session_id;
  if (!sessionId) return;
  const bridge = readJson(bridgePath(sessionId));
  writeJsonAtomic(statePath(), {
    tools: [],
    // First ~80 chars of the prompt — the factual half of Step-6 auto-save.
    // Strip tag-wrapped system/notification content (e.g. a background
    // <task-notification> delivered as the turn's "prompt") before truncating,
    // so hot.md only ever gets real human text, never raw internal XML.
    prompt0: String(input.prompt || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80),
    // Recorded for the route-guard: a /skip in the prompt bypasses enforcement.
    skip: /(^|\s)\/skip(\s|$)/.test(String(input.prompt || '')),
    cost0: bridge && typeof bridge.total_cost_usd === 'number' ? bridge.total_cost_usd : null,
    in0: bridge && typeof bridge.total_input_tokens === 'number' ? bridge.total_input_tokens : null,
    out0: bridge && typeof bridge.total_output_tokens === 'number' ? bridge.total_output_tokens : null,
  });
}

function cmdTrack(input) {
  // No session_id requirement here (unlike snapshot/report): a subagent's
  // PostToolUse hook may carry a different or absent session_id, but its
  // tool calls still belong to this project's in-flight turn. See statePath().
  const state = readJson(statePath());
  if (!state) return; // no snapshot this turn -> no-op
  const name = nameFor(input.tool_name, input.tool_input);
  if (name && !state.tools.includes(name)) {
    state.tools.push(name);
    if (state.tools.length > 40) state.tools.shift();
  }
  writeJsonAtomic(statePath(), state);
}

// Full detail has no truncation constraint, unlike the live systemMessage
// banner, so it gets a proper Markdown table — one row per turn, header
// written once. Silently no-ops in projects that aren't SuperStack-
// initialized (no .vault/), matching the existing vault-hook convention.
function appendTurnLog(usedList, skippedCount, totalRepos, dCost, dIn, dOut) {
  const vaultDir = findVaultDir();
  if (!vaultDir) return;
  const logPath = path.join(vaultDir, 'turn-log.md');
  const time = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const usedStr = usedList.length ? usedList.join(', ') : 'none';
  const costStr = dCost === null ? '—' : `$${dCost.toFixed(4)}`;
  const tokStr = dCost === null ? '—' : `${dIn}in/${dOut}out`;
  const row = `| ${time} | ${usedStr} | ${skippedCount}/${totalRepos} | ${costStr} | ${tokStr} |\n`;
  try {
    if (!fs.existsSync(logPath)) {
      fs.writeFileSync(
        logPath,
        '# SuperStack Turn Log\n\n| Time | Used | Skipped | Cost | Tokens |\n|---|---|---|---|---|\n' + row
      );
    } else {
      fs.appendFileSync(logPath, row);
    }
  } catch {
    // never block the session over a log-write failure
  }
}

// Deterministic half of Step-6 auto-save: append ONE factual line to hot.md per
// turn so memory persists without relying on the model electing to write. The
// model still adds richer 2-5 line summaries (router Step 6); these are
// complementary. No-ops silently when no vault, nothing ran, or on write error.
function appendHotLog(usedList, promptExcerpt) {
  if (!usedList.length) return;
  const vaultDir = findVaultDir();
  if (!vaultDir) return;
  const hotPath = path.join(vaultDir, 'hot.md');
  const time = new Date().toISOString().replace('T', ' ').slice(0, 16);
  const tail = promptExcerpt ? ` — ${promptExcerpt}` : '';
  const line = `- [${time}] used: ${usedList.join(', ')}${tail}\n`;
  try {
    fs.appendFileSync(hotPath, line);
  } catch {
    // never block the session over a memory-write failure
  }
}

// Routing-fidelity check. The PreToolUse guard only gates Edit/Write, so it
// can't catch a read-only turn that answered without routing. This maps the
// prompt's intent to the repo(s) the router table says should handle it, and
// (at Stop) warns when NONE of them ran — the only enforcement possible on a
// turn that never edits anything. Heuristic by design: first matching row wins,
// unrecognized prompts get no opinion (returns null).
const INTENT_EXPECT = [
  [/\b(security|vulnerab|exploit|owasp|cve|injection)\b/i, ['ecc'], 'security'],
  [/\b(refactor|clean ?up|simplif|over-?engineer|declutter|tidy)\b/i, ['ponytail', 'ecc'], 'refactor'],
  [/\b(bug|broken|not working|off-?by-?one|regression|crash|failing|fix)\b/i, ['gsd-core', 'ecc'], 'bug fix'],
  [/\b(research|best practice|investigate|state of the art|compare options)\b/i, ['claude-obsidian'], 'research'],
  [/\b(explain|understand|what does|how does|walk me through|onboard|unfamiliar)\b/i, ['graphify', 'gsd-core'], 'understand'],
  [/\b(unit ?test|coverage|tdd|write tests?)\b/i, ['ecc'], 'tests'],
  [/\b(ui|ux|design|style|layout|component|button|form|theme|dark mode)\b/i, ['ui-ux-pro-max'], 'ui/design'],
  [/\b(document|readme|docs|changelog)\b/i, ['ecc'], 'docs'],
  [/\b(ship|release|deploy|pre-?release)\b/i, ['gsd-core', 'ecc'], 'ship'],
];

function routingMiss(prompt, used) {
  const p = String(prompt || '');
  for (const [re, repos, label] of INTENT_EXPECT) {
    if (re.test(p)) {
      const hit = repos.some((r) => used.some((t) => t.includes(r)));
      return hit ? null : { label, repos };
    }
  }
  return null; // no recognized intent -> no opinion
}

function cmdReport(input) {
  const sessionId = input.session_id;
  if (!sessionId) return;
  const sp = statePath();
  const state = readJson(sp);
  if (!state) return; // nothing snapshotted -> print nothing

  const bridge = readJson(bridgePath(sessionId));
  const used = state.tools;
  const skipped = REFERENCE_REPOS.filter(
    (repo) => !used.some((t) => t.includes(repo))
  );

  const segs = [
    `used ${used.length ? used.join(', ') : 'none'}`,
    `skipped ${skipped.length}/${REFERENCE_REPOS.length}`,
  ];

  // Surface an intent/tool mismatch loudly — the one enforcement signal that
  // works on read-only turns. /skip suppresses it (user opted out this prompt).
  const miss = state.skip ? null : routingMiss(state.prompt0, used);
  if (miss) segs.push(`⚠ routing-miss: expected ${miss.repos.join('/')} for ${miss.label}, none ran`);

  let dCost = null, dIn = null, dOut = null;
  if (
    bridge &&
    state.cost0 !== null &&
    typeof bridge.total_cost_usd === 'number'
  ) {
    dCost = bridge.total_cost_usd - state.cost0;
    dIn = (bridge.total_input_tokens || 0) - (state.in0 || 0);
    dOut = (bridge.total_output_tokens || 0) - (state.out0 || 0);
    // No fake $0.00 when the ECC bridge is absent — a missing plugin must not
    // read as a free turn, so the segment is omitted entirely instead.
    segs.push(`Δ ~$${dCost.toFixed(4)} (${dIn}in/${dOut}out tok)`);
  }

  appendTurnLog(used, skipped.length, REFERENCE_REPOS.length, dCost, dIn, dOut);
  appendHotLog(used, state.prompt0);

  // Unlink before returning so a throw while building the string still cleans up.
  try { fs.unlinkSync(sp); } catch {}
  if (!used.length && segs.length === 2) return null; // nothing ran, no cost data
  return `SuperStack: ${segs.join(' | ')}`;
}

function run() {
  const mode = process.argv[2];
  const input = readStdin();
  try {
    if (mode === 'snapshot') cmdSnapshot(input);
    else if (mode === 'track') cmdTrack(input);
    else if (mode === 'report') {
      // Stop hooks: stderr is discarded at exit 0, plain stdout goes only to the
      // debug log, and hookSpecificOutput.additionalContext is REJECTED on Stop.
      // A top-level systemMessage on stdout is the only human-visible channel.
      const msg = cmdReport(input);
      if (msg) process.stdout.write(JSON.stringify({ systemMessage: msg }));
    }
  } catch {
    // never block or error out the session
  }
}

function selftest() {
  const assert = require('assert');
  assert.strictEqual(nameFor('Skill', { skill: 'ponytail' }), 'skill:ponytail');
  assert.strictEqual(nameFor('Task', { subagent_type: 'general-purpose' }), 'agent:general-purpose');
  assert.strictEqual(nameFor('mcp__plugin_ecc__foo', {}), 'plugin:ecc');
  assert.strictEqual(nameFor('Bash', { command: 'ls' }), null);

  // Skip-counter fix: a BARE ECC skill must be attributed to ecc so the banner
  // doesn't report ecc as skipped when its skill actually ran.
  assert.strictEqual(nameFor('Skill', { skill: 'security-review' }), 'skill:ecc:security-review');
  assert.strictEqual(nameFor('Skill', { skill: 'ecc:security-review' }), 'skill:ecc:security-review');
  assert.strictEqual(nameFor('Skill', { skill: 'gsd-plan-phase' }), 'skill:gsd-core:gsd-plan-phase');
  assert.strictEqual(nameFor('Skill', { skill: 'ui-ux-pro-max:design' }), 'skill:ui-ux-pro-max:design');
  assert.strictEqual(nameFor('Skill', { skill: 'brainstorming' }), 'skill:superpowers:brainstorming');
  assert.strictEqual(nameFor('Skill', { skill: 'some-unknown-skill' }), 'skill:some-unknown-skill');

  // graphify CLI (Bash) must be tracked so read-only turns don't misreport none.
  assert.strictEqual(nameFor('Bash', { command: 'graphify query "login"' }), 'graphify');
  assert.strictEqual(nameFor('Bash', { command: 'cd x && graphify update .' }), 'graphify');
  assert.strictEqual(nameFor('Bash', { command: 'echo not-graphify-related' }), null);

  // Routing-fidelity: intent recognized but no expected repo ran -> miss.
  assert.deepStrictEqual(routingMiss('do a security check on the page', []), { label: 'security', repos: ['ecc'] });
  // Intent recognized and a right repo ran -> no miss.
  assert.strictEqual(routingMiss('do a security check', ['skill:ecc:security-review']), null);
  // Refactor accepts ponytail OR ecc.
  assert.strictEqual(routingMiss('refactor this function', ['skill:ponytail:ponytail-audit']), null);
  // Understand accepts graphify (CLI now tracked).
  assert.strictEqual(routingMiss('explain what index.js does', ['graphify']), null);
  // Unrecognized intent -> no opinion, never a false alarm.
  assert.strictEqual(routingMiss('say hello', []), null);

  // hot.md corruption fix: a raw <task-notification> delivered as the prompt
  // must never survive into prompt0 — only real human text should.
  {
    const tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), 'ss-prompt0-selftest-'));
    const origTmpdir2 = os.tmpdir;
    os.tmpdir = () => tmp2;
    try {
      cmdSnapshot({ session_id: 'p0test', prompt: '<task-notification><task-id>abc</task-id></task-notification>' });
      const state = readJson(statePath());
      assert.ok(!state.prompt0.includes('<'), 'prompt0 must not contain raw tag content');
      assert.ok(!state.prompt0.includes('task-notification'));
    } finally {
      os.tmpdir = origTmpdir2;
      fs.rmSync(tmp2, { recursive: true, force: true });
    }
  }
  {
    const used = ['skill:ecc:security-review'];
    const skipped = REFERENCE_REPOS.filter((r) => !used.some((t) => t.includes(r)));
    assert.ok(!skipped.includes('ecc'), 'ecc must NOT be counted skipped when its skill ran');
    assert.strictEqual(skipped.length, 9, 'exactly one repo (ecc) credited');
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ss-turn-selftest-'));
  const sid = 'selftest';
  const origTmpdir = os.tmpdir;
  os.tmpdir = () => tmp;
  try {
    writeJsonAtomic(bridgePath(sid), { total_cost_usd: 1, total_input_tokens: 100, total_output_tokens: 50 });
    cmdSnapshot({ session_id: sid });
    cmdTrack({ session_id: sid, tool_name: 'Skill', tool_input: { skill: 'ponytail' } });
    writeJsonAtomic(bridgePath(sid), { total_cost_usd: 1.02, total_input_tokens: 150, total_output_tokens: 80 });
    const state = readJson(statePath());
    assert.deepStrictEqual(state.tools, ['skill:ponytail']);
    const skipped = REFERENCE_REPOS.filter((r) => !state.tools.some((t) => t.includes(r)));
    assert.ok(skipped.includes('graphify'));
    assert.ok(!skipped.includes('ponytail'));

    // Report must be exactly one line — systemMessage renders as a single-line banner.
    const msg = cmdReport({ session_id: sid });
    assert.ok(!/\n/.test(msg), 'report must be exactly one line');
    assert.strictEqual(msg, 'SuperStack: used skill:ponytail | skipped 9/10 | Δ ~$0.0200 (50in/30out tok)');
    const env = JSON.parse(JSON.stringify({ systemMessage: msg }));
    assert.strictEqual(typeof env.systemMessage, 'string');
    assert.ok(!('hookSpecificOutput' in env), 'additionalContext/hookSpecificOutput is invalid on Stop');

    // Bridge absent -> omit the Δ segment entirely, never fake $0.00.
    writeJsonAtomic(bridgePath(sid), { total_cost_usd: 1, total_input_tokens: 100, total_output_tokens: 50 });
    cmdSnapshot({ session_id: sid });
    cmdTrack({ session_id: sid, tool_name: 'Skill', tool_input: { skill: 'ponytail' } });
    fs.unlinkSync(bridgePath(sid));
    assert.strictEqual(cmdReport({ session_id: sid }), 'SuperStack: used skill:ponytail | skipped 9/10');

    // Nothing ran and no cost data -> stay silent rather than show an empty banner.
    cmdSnapshot({ session_id: sid });
    assert.strictEqual(cmdReport({ session_id: sid }), null);

    // Turn log: table with header written once, rows appended after.
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ss-turn-project-'));
    fs.mkdirSync(path.join(projectDir, '.vault'));
    const origProjectDir = process.env.CLAUDE_PROJECT_DIR;
    process.env.CLAUDE_PROJECT_DIR = projectDir;
    try {
      writeJsonAtomic(bridgePath(sid), { total_cost_usd: 1, total_input_tokens: 100, total_output_tokens: 50 });
      cmdSnapshot({ session_id: sid });
      cmdTrack({ session_id: sid, tool_name: 'Skill', tool_input: { skill: 'ponytail' } });
      writeJsonAtomic(bridgePath(sid), { total_cost_usd: 1.02, total_input_tokens: 150, total_output_tokens: 80 });
      cmdReport({ session_id: sid });
      const logPath = path.join(projectDir, '.vault', 'turn-log.md');
      const afterFirst = fs.readFileSync(logPath, 'utf8');
      assert.match(afterFirst, /^# SuperStack Turn Log\n\n\| Time \| Used \| Skipped \| Cost \| Tokens \|\n\|---\|---\|---\|---\|---\|\n\| .+ \| skill:ponytail \| 9\/10 \| \$0\.0200 \| 50in\/30out \|\n$/);

      // Auto-save: cmdReport appends a factual line to hot.md.
      const hotPath = path.join(projectDir, '.vault', 'hot.md');
      assert.match(fs.readFileSync(hotPath, 'utf8'), /^- \[.+\] used: skill:ponytail\n$/);

      // findVaultDir walks up: a nested subdir resolves to the project's .vault.
      const sub = path.join(projectDir, 'a', 'b');
      fs.mkdirSync(sub, { recursive: true });
      assert.strictEqual(findVaultDir(sub), path.join(projectDir, '.vault'));

      // Second turn appends a row without rewriting the header.
      cmdSnapshot({ session_id: sid });
      cmdReport({ session_id: sid });
      const afterSecond = fs.readFileSync(logPath, 'utf8');
      assert.strictEqual((afterSecond.match(/^# SuperStack Turn Log$/gm) || []).length, 1, 'header written only once');
      const dataRows = afterSecond.split('\n').filter((l) => l.startsWith('| ') && !l.startsWith('| Time'));
      assert.strictEqual(dataRows.length, 2, 'two data rows after two turns');

      // Subagent-tracking fix: track() fired under a DIFFERENT session_id
      // (or none at all) than the parent's snapshot/report must still land in
      // the same project-scoped state — this is what a dispatched subagent's
      // tool-use hook looks like (inherits CLAUDE_PROJECT_DIR, not session_id).
      writeJsonAtomic(bridgePath(sid), { total_cost_usd: 2, total_input_tokens: 200, total_output_tokens: 100 });
      cmdSnapshot({ session_id: sid });
      cmdTrack({ session_id: 'a-different-subagent-session-id', tool_name: 'Skill', tool_input: { skill: 'gsd-execute-phase' } });
      cmdTrack({ tool_name: 'Skill', tool_input: { skill: 'ecc:code-review' } }); // no session_id at all
      const subagentMsg = cmdReport({ session_id: sid });
      assert.ok(subagentMsg.includes('skill:gsd-core:gsd-execute-phase'), 'subagent tool call under a different session_id must be counted');
      assert.ok(subagentMsg.includes('skill:ecc:code-review'), 'subagent tool call with no session_id must be counted');

      // No .vault/ -> silently no-op, no crash.
      const bareDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ss-turn-bare-'));
      process.env.CLAUDE_PROJECT_DIR = bareDir;
      cmdSnapshot({ session_id: sid });
      cmdTrack({ session_id: sid, tool_name: 'Skill', tool_input: { skill: 'ponytail' } });
      cmdReport({ session_id: sid });
      assert.ok(!fs.existsSync(path.join(bareDir, '.vault')), 'must not create .vault/ itself');
      fs.rmSync(bareDir, { recursive: true, force: true });
    } finally {
      if (origProjectDir === undefined) delete process.env.CLAUDE_PROJECT_DIR;
      else process.env.CLAUDE_PROJECT_DIR = origProjectDir;
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  } finally {
    os.tmpdir = origTmpdir;
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log('selftest OK');
}

if (require.main === module) {
  if (process.argv[2] === '--selftest') selftest();
  else run();
}
