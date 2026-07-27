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

function statePath(sessionId) {
  return path.join(os.tmpdir(), `superstack-turn-${sanitize(sessionId)}.json`);
}

function bridgePath(sessionId) {
  return path.join(os.tmpdir(), `ecc-metrics-${sanitize(sessionId)}.json`);
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

function nameFor(toolName, toolInput) {
  toolInput = toolInput || {};
  if (toolName === 'Skill') return `skill:${toolInput.skill || toolInput.command || '?'}`;
  if (toolName === 'Task') return `agent:${toolInput.subagent_type || '?'}`;
  const mcpPlugin = /^mcp__plugin_([^_]+)__/.exec(toolName || '');
  if (mcpPlugin) return `plugin:${mcpPlugin[1]}`;
  if (/^mcp__/.test(toolName || '')) return `mcp:${toolName}`;
  return null;
}

function cmdSnapshot(input) {
  const sessionId = input.session_id;
  if (!sessionId) return;
  const bridge = readJson(bridgePath(sessionId));
  writeJsonAtomic(statePath(sessionId), {
    tools: [],
    cost0: bridge && typeof bridge.total_cost_usd === 'number' ? bridge.total_cost_usd : null,
    in0: bridge && typeof bridge.total_input_tokens === 'number' ? bridge.total_input_tokens : null,
    out0: bridge && typeof bridge.total_output_tokens === 'number' ? bridge.total_output_tokens : null,
  });
}

function cmdTrack(input) {
  const sessionId = input.session_id;
  if (!sessionId) return;
  const state = readJson(statePath(sessionId));
  if (!state) return; // no snapshot this turn -> no-op
  const name = nameFor(input.tool_name, input.tool_input);
  if (name && !state.tools.includes(name)) {
    state.tools.push(name);
    if (state.tools.length > 40) state.tools.shift();
  }
  writeJsonAtomic(statePath(sessionId), state);
}

// Full detail has no truncation constraint, unlike the live systemMessage
// banner, so it gets a proper Markdown table — one row per turn, header
// written once. Silently no-ops in projects that aren't SuperStack-
// initialized (no .vault/), matching the existing vault-hook convention.
function appendTurnLog(usedList, skippedCount, totalRepos, dCost, dIn, dOut) {
  const projectDir = process.env.CLAUDE_PROJECT_DIR;
  if (!projectDir) return;
  const vaultDir = path.join(projectDir, '.vault');
  if (!fs.existsSync(vaultDir)) return;
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

function cmdReport(input) {
  const sessionId = input.session_id;
  if (!sessionId) return;
  const sp = statePath(sessionId);
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

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ss-turn-selftest-'));
  const sid = 'selftest';
  const origTmpdir = os.tmpdir;
  os.tmpdir = () => tmp;
  try {
    writeJsonAtomic(bridgePath(sid), { total_cost_usd: 1, total_input_tokens: 100, total_output_tokens: 50 });
    cmdSnapshot({ session_id: sid });
    cmdTrack({ session_id: sid, tool_name: 'Skill', tool_input: { skill: 'ponytail' } });
    writeJsonAtomic(bridgePath(sid), { total_cost_usd: 1.02, total_input_tokens: 150, total_output_tokens: 80 });
    const state = readJson(statePath(sid));
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

      // Second turn appends a row without rewriting the header.
      cmdSnapshot({ session_id: sid });
      cmdReport({ session_id: sid });
      const afterSecond = fs.readFileSync(logPath, 'utf8');
      assert.strictEqual((afterSecond.match(/^# SuperStack Turn Log$/gm) || []).length, 1, 'header written only once');
      const dataRows = afterSecond.split('\n').filter((l) => l.startsWith('| ') && !l.startsWith('| Time'));
      assert.strictEqual(dataRows.length, 2, 'two data rows after two turns');

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
