#!/usr/bin/env bash
# Proves the hook REGISTRATION path, not just that files were copied — the
# exact class of bug that shipped a "working" per-turn report which never
# actually fired. CI cannot prove hooks fire in a real session; this proves
# the merge is valid/idempotent/non-destructive and the installer targets
# the right file.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== merge-hooks.js selftest =="
node global/hooks/merge-hooks.js --selftest

echo "== superstack-turn-report.js selftest =="
node global/hooks/superstack-turn-report.js --selftest

echo "== global/hooks/hooks.json is valid JSON =="
node -e 'JSON.parse(require("fs").readFileSync("global/hooks/hooks.json","utf8"))'

echo "== every source hook command carries the removal tag =="
node -e '
const h = JSON.parse(require("fs").readFileSync("global/hooks/hooks.json", "utf8")).hooks;
const cmds = Object.values(h).flat().flatMap((g) => g.hooks).map((x) => x.command);
if (cmds.length !== 5) throw new Error("expected 5 hook commands, got " + cmds.length);
for (const c of cmds) {
  if (!c.includes("SUPERSTACK-HOOK")) throw new Error("untagged command (uninstall would orphan it): " + c);
}
'

echo "== regression guard: installer must target settings.json, never the dead hooks/hooks.json path =="
grep -q 'merge-hooks.js" install' bin/superstack || { echo "FAIL: installer does not register hooks in settings.json"; exit 1; }
if grep -qE 'cp "\$SS_HOME/global/hooks/hooks\.json" "\$CLAUDE_DIR/hooks/hooks\.json"' bin/superstack; then
  echo "FAIL: installer still copies hooks.json to the dead, unread path"; exit 1
fi

echo "== regression guard: Stop hook must not rely on stderr or additionalContext =="
grep -q 'console.error' global/hooks/superstack-turn-report.js && { echo "FAIL: report still writes to stderr (discarded on Stop at exit 0)"; exit 1; }
if grep -qE 'JSON\.stringify\(\s*\{\s*hookSpecificOutput' global/hooks/superstack-turn-report.js; then
  echo "FAIL: emits hookSpecificOutput.additionalContext, which Stop rejects"; exit 1
fi

echo "verify-install OK"
