# Ponytail Command

Set and persist the ponytail (YAGNI/minimal-solution) intensity level.

## Usage

`/ponytail lite|full|ultra|auto`

## Behavior

1. Parse `$ARGUMENTS` as one of: `lite`, `full`, `ultra`, `auto`.
   - If missing or invalid, ask the user which level they want.
2. Write the choice into `.superstack.json` in the project root under the key
   `"ponytail_level"`. Create the file with `{ "ponytail_level": "<level>" }`
   if it doesn't exist; otherwise update just that key, preserving the rest
   of the file.
3. `auto` means: remove/ignore any override and let STEP 2 of the router
   (task-size heuristic) decide per-prompt.
4. Confirm in one line: `Ponytail level set to <level>.`
5. Apply the new level starting with the very next response.
