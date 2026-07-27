#!/usr/bin/env node
'use strict';
// Register SuperStack's hooks in ~/.claude/settings.json — the ONLY location
// Claude Code reads user-level hooks from. ~/.claude/hooks/hooks.json is never
// loaded (SuperStack <=1.1.0 wrote there and its hooks never fired).
//
//   merge-hooks.js install <src-hooks.json> <settings.json>
//   merge-hooks.js uninstall <settings.json>
//   merge-hooks.js --selftest
//
// settings.json is SHARED with other tools (pixel-agents, GSD). Every write is
// append-only for our entries, backed up first, and atomic. Entries belonging to
// other tools are passed through untouched — including a MISSING `matcher` key,
// which must never be normalized.
const fs = require('fs');
const path = require('path');

// Shell comment appended to every SuperStack command. Inert to bash, invisible
// to the settings validator, and the single predicate shared by install/doctor/
// uninstall. Substring matching on script names is NOT sufficient: the vault
// Stop-trim command names no SuperStack file at all.
const MARKER = 'SUPERSTACK-HOOK';

const isOurs = (h) => !!h && typeof h.command === 'string' && h.command.includes(MARKER);

// Remove every SuperStack hook entry; prune groups and events left empty.
function strip(hooks) {
  let n = 0;
  for (const event of Object.keys(hooks)) {
    if (!Array.isArray(hooks[event])) continue;
    const groups = [];
    for (const g of hooks[event]) {
      if (!g || !Array.isArray(g.hooks)) { groups.push(g); continue; }
      const kept = g.hooks.filter((h) => (isOurs(h) ? (n++, false) : true));
      if (kept.length === g.hooks.length) groups.push(g);       // untouched, same object
      else if (kept.length) groups.push({ ...g, hooks: kept }); // partial: preserve key order
    }
    if (groups.length) hooks[event] = groups;
    else delete hooks[event];
  }
  return n;
}

function append(hooks, srcHooks) {
  let n = 0;
  for (const [event, groups] of Object.entries(srcHooks)) {
    if (!Array.isArray(groups)) continue;
    const dest = (hooks[event] = Array.isArray(hooks[event]) ? hooks[event] : []);
    for (const g of groups) {
      for (const h of g.hooks) {
        // Guard: an untagged hook could never be removed again by uninstall.
        if (!isOurs(h)) throw new Error(`source hook is missing the ${MARKER} tag: ${h.command}`);
      }
      dest.push(JSON.parse(JSON.stringify(g))); // deep copy, no shared refs
      n += g.hooks.length;
    }
  }
  return n;
}

function loadSettings(p) {
  if (!fs.existsSync(p)) return {};
  let s;
  try {
    s = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    console.error(`refusing to modify malformed JSON: ${p}\n  ${e.message}\n  Fix it by hand, then re-run.`);
    process.exit(1);
  }
  if (!s || typeof s !== 'object' || Array.isArray(s)) {
    console.error(`refusing to modify ${p}: top level is not a JSON object`);
    process.exit(1);
  }
  return s;
}

function save(p, settings) {
  if (fs.existsSync(p)) {
    const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14); // YYYYMMDDHHMMSS
    const bak = `${p}.superstack-bak-${ts}`;
    fs.copyFileSync(p, bak);
    console.log(`  backup: ${path.basename(bak)}`);
  } else {
    fs.mkdirSync(path.dirname(p), { recursive: true });
  }
  const tmp = `${p}.superstack.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(settings, null, 2) + '\n');
  JSON.parse(fs.readFileSync(tmp, 'utf8')); // never rename in something unparseable
  fs.renameSync(tmp, p);                    // atomic swap, same filesystem
}

// install = strip-then-append. Idempotent AND upgrade-safe: dedupe-on-command
// would orphan the old entry forever whenever a command string changes.
function apply(mode, srcPath, settingsPath) {
  const settings = loadSettings(settingsPath);
  const had = !!settings.hooks;
  if (!settings.hooks || typeof settings.hooks !== 'object' || Array.isArray(settings.hooks)) settings.hooks = {};

  const removed = strip(settings.hooks);
  const added = mode === 'install'
    ? append(settings.hooks, JSON.parse(fs.readFileSync(srcPath, 'utf8')).hooks || {})
    : 0;

  if (!Object.keys(settings.hooks).length && !had) delete settings.hooks;
  if (removed === 0 && added === 0) { console.log('  settings.json already correct — no change'); return; }
  save(settingsPath, settings);
  console.log(`  settings.json: +${added} / -${removed} SuperStack hook entries`);
}

function selftest() {
  const assert = require('assert');
  const os = require('os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ss-merge-'));
  const sp = path.join(dir, 'settings.json');
  const src = path.join(dir, 'hooks.json');

  // Fixture mirrors the real shared file: a matcher-LESS GSD entry + a pixel entry.
  fs.writeFileSync(sp, JSON.stringify({
    permissions: { allow: ['Bash'] },
    hooks: {
      Stop: [
        { hooks: [{ type: 'command', command: '/opt/homebrew/bin/node "gsd-context-monitor.js"', timeout: 10 }] },
        { matcher: '', hooks: [{ type: 'command', command: 'node "claude-hook.js"', timeout: 5 }] },
      ],
    },
    statusLine: { type: 'command', command: 'x' },
  }, null, 2));
  fs.writeFileSync(src, JSON.stringify({
    hooks: { Stop: [{ matcher: '', hooks: [{ type: 'command', command: `node r.js report # ${MARKER}` }] }] },
  }));

  apply('install', src, sp);
  const once = JSON.parse(fs.readFileSync(sp, 'utf8'));
  apply('install', src, sp);
  const twice = JSON.parse(fs.readFileSync(sp, 'utf8'));
  assert.deepStrictEqual(twice, once, 'install must be idempotent');
  assert.strictEqual(twice.hooks.Stop.length, 3);
  assert.ok(!('matcher' in twice.hooks.Stop[0]), 'must not add matcher to a matcher-less entry');
  assert.strictEqual(twice.hooks.Stop[0].hooks[0].timeout, 10, 'foreign entry preserved verbatim');
  assert.ok(twice.permissions && twice.statusLine, 'other top-level keys preserved');
  assert.ok(fs.readFileSync(sp, 'utf8').includes(MARKER));

  apply('uninstall', null, sp);
  const gone = JSON.parse(fs.readFileSync(sp, 'utf8'));
  assert.strictEqual(gone.hooks.Stop.length, 2, 'only SuperStack entries removed');
  assert.ok(!JSON.stringify(gone).includes(MARKER));
  assert.ok(gone.permissions && gone.statusLine, 'uninstall preserves other keys');

  // Malformed input must not be clobbered.
  const bad = path.join(dir, 'bad.json');
  fs.writeFileSync(bad, '{ nope');
  const r = require('child_process').spawnSync(process.execPath, [__filename, 'uninstall', bad]);
  assert.strictEqual(r.status, 1, 'malformed settings.json must exit 1');
  assert.strictEqual(fs.readFileSync(bad, 'utf8'), '{ nope', 'malformed file left byte-identical');

  // Untagged source hook must be refused, not silently made unremovable.
  assert.throws(
    () => append({}, { Stop: [{ matcher: '', hooks: [{ command: 'oops' }] }] }),
    /missing the SUPERSTACK-HOOK tag/
  );

  // Empty event arrays pruned.
  fs.writeFileSync(sp, JSON.stringify({ hooks: { Stop: [{ matcher: '', hooks: [{ command: `x # ${MARKER}` }] }] } }));
  apply('uninstall', null, sp);
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(sp, 'utf8')).hooks, {}, 'empty events pruned');

  fs.rmSync(dir, { recursive: true, force: true });
  console.log('merge-hooks selftest OK');
}

if (require.main === module) {
  const [mode, a, b] = process.argv.slice(2);
  if (mode === '--selftest') selftest();
  else if (mode === 'install' && a && b) apply('install', a, b);
  else if (mode === 'uninstall' && a) apply('uninstall', null, a);
  else {
    console.error('usage: merge-hooks.js install <hooks.json> <settings.json> | uninstall <settings.json> | --selftest');
    process.exit(2);
  }
}
