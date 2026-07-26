# Skip Command

Skip the preview/confirmation step for the current prompt only (SuperStack router STEP 4).

## Usage

`/skip` — appended or issued alongside a request

## Behavior

1. Applies ONLY to the current prompt, and ONLY to tasks classified as NORMAL.
2. HEAVY (>10 files, whole-codebase ops) and DESTRUCTIVE (delete, reset --hard,
   force-push, uninstall, history rewrite) tasks ALWAYS show the preview and
   require explicit confirmation — `/skip` does not override this.
3. Do not persist this — the very next prompt previews again unless `/skip`
   is issued again.
4. Proceed directly to execution for the current NORMAL task without printing
   the `→ /command (what it does)` preview list or asking "Proceed?".
