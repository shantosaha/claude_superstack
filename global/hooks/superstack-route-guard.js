#!/usr/bin/env node
'use strict';
// SuperStack routing ENFORCEMENT (PreToolUse on Edit|Write|MultiEdit).
//
// The CLAUDE.md router is advisory — it can't force tool use. This gate makes
// "the workflow uses skills/agents/plugins by itself" actually true: it blocks
// an edit/write until the turn has routed through at least one SuperStack
// skill, agent, or plugin. It reads the same per-turn state file the turn-report
// system writes (skill:/agent:/plugin: names tracked on every PostToolUse).
//
// SAFETY — this can never brick editing:
//   • Only enforces inside a SuperStack project (a .superstack.json exists at or
//     above cwd). No .superstack.json  -> allow (not a SuperStack project).
//   • .superstack.json "enforce_routing": false  -> allow (opted out).
//   • Prompt contained /skip  -> allow (per-prompt bypass).
//   • No turn-state file (report system inactive)  -> allow.
//   • ANY error  -> allow (fail-open).
const fs = require('fs');
const os = require('os');
const path = require('path');

function sanitize(id) { return String(id || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64); }
function statePath(sid) { return path.join(os.tmpdir(), `superstack-turn-${sanitize(sid)}.json`); }
function readJson(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } }
function readStdin() { try { return JSON.parse(fs.readFileSync(0, 'utf8')); } catch { return {}; } }

// Walk up from a starting dir to find the nearest .superstack.json (project root).
function findConfig(startDir) {
  let dir = startDir || process.cwd();
  for (let i = 0; i < 8 && dir; i++) {
    const p = path.join(dir, '.superstack.json');
    if (fs.existsSync(p)) return readJson(p) || {};
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null; // not a SuperStack project
}

function allow() { process.exit(0); } // no stdout => allow

function deny(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  }));
  process.exit(0);
}

function decide(input) {
  const sid = input.session_id;
  if (!sid) return allow();

  // Scope: enforce only inside a SuperStack-initialized project.
  const startDir = input.cwd || (input.tool_input && input.tool_input.file_path
    ? path.dirname(input.tool_input.file_path) : process.cwd());
  const cfg = findConfig(startDir);
  if (!cfg) return allow();                 // not a SuperStack project
  if (cfg.enforce_routing === false) return allow(); // explicitly opted out

  const state = readJson(statePath(sid));
  if (!state) return allow();               // report system inactive -> don't brick
  if (state.skip) return allow();           // user included /skip this prompt

  const routed = (state.tools || []).some((t) => /^(skill|agent|plugin):/.test(t));
  if (routed) return allow();

  return deny(
    'SuperStack: route through the framework before editing. This turn has not ' +
    'invoked any SuperStack skill, agent, or plugin yet. Per the CLAUDE.md router, ' +
    'first invoke the relevant one for this intent — e.g. a Skill (ponytail, graphify, ' +
    'a domain skill), an agent via the Task tool, or an ECC/plugin skill — then retry ' +
    'the edit. Bypass for this prompt: include /skip. Disable for this project: set ' +
    '"enforce_routing": false in .superstack.json.'
  );
}

function selftest() {
  const assert = require('assert');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ss-guard-'));
  const origTmp = os.tmpdir;
  os.tmpdir = () => dir;
  const sid = 'guard-test';
  const sp = statePath(sid);
  // run decide() without exiting the process
  function run(input) {
    let out = null;
    const realWrite = process.stdout.write.bind(process.stdout);
    const realExit = process.exit;
    process.stdout.write = (s) => { out = s; return true; };
    process.exit = () => { throw { __exit: true }; };
    try { decide(input); } catch (e) { if (!e || !e.__exit) throw e; }
    process.stdout.write = realWrite;
    process.exit = realExit;
    return out ? JSON.parse(out) : null; // null = allow, object = deny
  }

  const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'proj-'));

  // 1. No .superstack.json anywhere -> allow (not a SuperStack project)
  fs.writeFileSync(sp, JSON.stringify({ tools: [] }));
  assert.strictEqual(run({ session_id: sid, cwd: proj }), null, 'non-superstack project allows');

  // Make it a SuperStack project
  fs.writeFileSync(path.join(proj, '.superstack.json'), JSON.stringify({ ponytail_level: 'auto' }));

  // 2. SuperStack project, no skill ran -> DENY
  fs.writeFileSync(sp, JSON.stringify({ tools: [] }));
  const d = run({ session_id: sid, cwd: proj });
  assert.ok(d && d.hookSpecificOutput.permissionDecision === 'deny', 'blocks when no skill ran');

  // 3. A skill ran this turn -> allow
  fs.writeFileSync(sp, JSON.stringify({ tools: ['skill:ponytail'] }));
  assert.strictEqual(run({ session_id: sid, cwd: proj }), null, 'allows after a skill ran');

  // 4. An agent ran -> allow
  fs.writeFileSync(sp, JSON.stringify({ tools: ['agent:general-purpose'] }));
  assert.strictEqual(run({ session_id: sid, cwd: proj }), null, 'allows after an agent ran');

  // 5. /skip this prompt -> allow even with no skill
  fs.writeFileSync(sp, JSON.stringify({ tools: [], skip: true }));
  assert.strictEqual(run({ session_id: sid, cwd: proj }), null, '/skip bypasses');

  // 6. enforce_routing:false -> allow even with no skill
  fs.writeFileSync(path.join(proj, '.superstack.json'), JSON.stringify({ enforce_routing: false }));
  fs.writeFileSync(sp, JSON.stringify({ tools: [] }));
  assert.strictEqual(run({ session_id: sid, cwd: proj }), null, 'enforce_routing:false opts out');

  // 7. No state file -> allow (report system inactive)
  fs.writeFileSync(path.join(proj, '.superstack.json'), JSON.stringify({ ponytail_level: 'auto' }));
  try { fs.unlinkSync(sp); } catch {}
  assert.strictEqual(run({ session_id: sid, cwd: proj }), null, 'no state file fails open');

  // 8. finds config via parent walk (edit deep in project)
  fs.writeFileSync(path.join(proj, '.superstack.json'), JSON.stringify({ ponytail_level: 'auto' }));
  const deep = path.join(proj, 'a', 'b', 'c');
  fs.mkdirSync(deep, { recursive: true });
  fs.writeFileSync(sp, JSON.stringify({ tools: [] }));
  const d8 = run({ session_id: sid, tool_input: { file_path: path.join(deep, 'x.js') } });
  assert.ok(d8 && d8.hookSpecificOutput.permissionDecision === 'deny', 'walks up to find .superstack.json');

  os.tmpdir = origTmp;
  fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(proj, { recursive: true, force: true });
  console.log('route-guard selftest OK');
}

if (require.main === module) {
  if (process.argv[2] === '--selftest') selftest();
  else { try { decide(readStdin()); } catch { process.exit(0); } }
}
