# Toolbar popup

The popup is the small window under the toolbar icon. It has an on/off switch for the hover popover, a status row per API key (MyAnimeList, TMDB, OMDb and the active AI provider), the number of rated titles per kind, an Open settings button and a Clear cache button.

## Sub-features

- `popup-switch` toggles `enabled` and persists it across reopening.
- `popup-keys` shows Set or Not set per key, with a note when missing.
- `popup-ratings` shows rated counts per kind, or a hint when there are none.
- `popup-clear-cache` clears the lookup cache and reports how many entries.
- `popup-open-settings` opens the options page in a tab.

## How to get to it (user POV)

- Click the extension's toolbar icon in Chrome.
- Harness stand-in: open `chrome-extension://<id>/popup.html` in a tab (`s.url('popup.html')`).

## Driving it with playwright-core

Preconditions:

- Baseline from `README.md`. `doctor.sh` exits 0.

- **Run the whole recipe.** `node .claude/skills/verify-should-i-watch-for-netflix/scripts/scenarios/popup-switch.mjs`. Six `PASS` lines, a clip, a `PACING OK` line and a `PASS` line in `clips.md`.
- **Initial state.** `await s.page.goto(s.url('popup.html'))`. `getByRole('switch')` has `aria-checked="true"`, the text reads `On`, and `.key-row` has 4 rows (`data-key` `malClientId`, `tmdbKey`, `omdbKey`, `aiKey`), all `Not set`.
- **Switch off.** `await s.click(sw, 'Turn the switch off')`. `aria-checked` becomes `false`, the text reads `Off`, and `(await s.storage('settings')).enabled` is `false`.
- **Persistence.** `await page.reload()`. The switch is still off. This is the reopen proof.
- **Switch on.** Click again. `enabled` is `true`.
- **Clear cache.** `await s.click(page.getByRole('button', { name: 'Clear cache' }), ...)`. A status matching `Cleared N entries` (`entry` for 1) appears.
- **Proof.** Screenshots `shots/popup-switch-{before,off,after}.png` and `video/popup-switch.webm`.

## Gotchas

- Run as a tab, the popup does not close or size itself like the toolbar bubble. `Open settings` then calls `window.close()` on the tab.
- The status row for the AI key is named after the active provider (`AI (DeepSeek)`), and a provider with no key requirement (Ollama) shows `Ready`, not `Not set`.
- A fresh profile has no ratings, so only the hint `Nothing rated yet…` is reachable. Rating counts need the Netflix feature or seeded `chrome.storage.local` data, and seeding is not a user path.
- The switch is disabled while the save is in flight. Wait for `aria-checked` to settle before the next click.
