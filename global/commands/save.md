# Save Command

File the current conversation/session into the project vault (SuperStack STEP 6, on demand).

## Usage

`/save`
`/save <name>`

## Behavior

1. Determine the session name: use `$ARGUMENTS` if provided, otherwise derive
   a short kebab-case name from the current task/topic.
2. Ensure `.vault/` exists in the project root; if not, create it.
3. Append a 2-5 line summary of this session's work to `.vault/hot.md`
   (rotate: keep roughly the last ~50 lines, dropping oldest first).
4. If new topics/entities/decisions were introduced, add or refresh an entry
   in `.vault/index.md` pointing to them.
5. If `<name>` was given, also write a dated snapshot file, e.g.
   `.vault/sessions/<YYYY-MM-DD>-<name>.md`, containing the fuller session
   summary.
6. Confirm with one line: `Saved session to .vault/ as "<name>".` — do not
   dump the full vault contents back to the user.
