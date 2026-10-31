# should-i-watch-for-netflix verification map

This directory is the maintained source for verifying the user-facing behavior of the extension. Read the index before driving, then use the matching feature file as the recipe. The harness, evidence dir, pacing and cleanup rules are in `../SKILL.md`.

## Baseline preconditions

- `npm run build` has produced a `dist/` newer than `src/`. `scripts/doctor.sh` exits 0.
- `EV` is exported (see `../SKILL.md`, Evidence dir).
- Each scenario starts a fresh Chromium profile: default settings, no API keys, `enabled` on, theme `system`, language `auto`, browser locale `en-US`.
- The Netflix feature additionally needs `VERIFY_PROFILE_DIR` (a profile signed in to Netflix) and, for movies and series, `VERIFY_SHOULD_I_WATCH_FOR_NETFLIX_TMDB_KEY`.
- Never drive the developer's own Chrome profile. Never run the options or popup scenarios against `VERIFY_PROFILE_DIR`.

## Driving conventions

- Start every recipe from the baseline state. Scenarios do, because the profile is new each run.
- Prefer ARIA roles and accessible names, then the stable ids and section classes listed in `../SKILL.md`. Never use coordinates.
- Run scenarios as `node .claude/skills/verify-should-i-watch-for-netflix/scripts/scenarios/<name>.mjs`. Treat each command as literal.
- Wait for the status line text before reading storage.
- Do not remove proof artifacts during cleanup.

## Proof and skip reporting

- Capture the user action and the resulting state: a screenshot before and after, and the clip.
- Mutation proof includes a second read: `s.storage('settings')` (the stored value), not only the status line.
- Record the feature ID and entry point used with every artifact.
- Report an unreachable path with the attempted command and the unmet precondition. Do not report a skipped entry point as verified through a different path. In particular, the popup opened as a tab is not the toolbar bubble.
- State when a third-party API (TMDB, MAL, OMDb, an AI provider) was mocked.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the user-visible behavior. It then uses exactly four H2 sections in this order.

1. `Sub-features` lists short IDs with one line for each behavior.
2. `How to get to it (user POV)` lists every user entry point.
3. `Driving it with playwright-core` starts with `Preconditions:` and uses labeled bullets that pair each user action with an exact command and observable result.
4. `Gotchas` lists traps that can waste or invalidate a verification run.

Keep implementation details out of the map. Name only user paths, stable handles, required state, commands, and observable proof.

## Features

- [Toolbar popup](./toolbar-popup.md) covers the on/off switch, key status rows, rating counts and Clear cache. Proved end to end.
- [Appearance settings](./options-appearance.md) covers the popover theme and the language of the extension. Proved end to end.
- [Quick badge thresholds](./options-thresholds.md) covers editing, rejecting and resetting the MAL, IMDb and TMDB limits. Proved for the MAL set.
- [AI provider settings](./options-ai-provider.md) covers the provider list, presets, the permission note and saving. Proved for DeepSeek and the OpenAI preset.
- [Netflix hover popover](./netflix-hover-popover.md) covers the hover lookup, verdict badge, AI opinion and ratings on netflix.com. **Not proved**: needs a Netflix login.
- _Not yet mapped_: data sources keys and cache invalidation on key change, taste profile (view, show data, clear), Test connection, the other AI formats (Anthropic, Gemini, Ollama, custom), the service worker lookup and matching pipeline.
