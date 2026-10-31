---
name: verify-should-i-watch-for-netflix
description: Launch, health-check and drive should-i-watch-for-netflix (an MV3 Chrome extension: options page, toolbar popup, Netflix hover popover) the way a user does, and capture evidence. Use when verifying a change in the extension works in a real browser, reproducing a bug, or before recording evidence. Read features/ for the recipe per feature.
---

# verify-should-i-watch-for-netflix

The app is a Chrome extension, not a server. There is no dev server and no port. "Launch" means: build `dist/`, start a **fresh** Chromium with `dist/` loaded, and open the extension's own pages (`chrome-extension://<id>/options.html`, `popup.html`). The Netflix hover popover is a content script that only runs on netflix.com and needs a Netflix login (see `features/netflix-hover-popover.md`).

Surfaces: options page (`src/options`), toolbar popup (`src/popup`), Netflix content script (`src/content`), service worker (`src/background`). The first two are driven end to end here. The repo has no e2e framework, so the harness is `playwright-core` (found in the global `@playwright/cli` install, or in the repo if it is ever added) driving Playwright's Chromium. Why Chromium: Chrome 137+ ignores `--load-extension`, and the headless shell cannot load extensions. The harness uses the full "Chrome for Testing" build with `--headless=new`.

## Evidence dir

One per run. It holds profiles (storage, possibly auth), so it must not be inside the repo. Use the OS temp dir.

```bash
export EV="${TMPDIR:-/tmp}/verify-should-i-watch-for-netflix/$(date +%Y%m%d-%H%M%S)"; mkdir -p "$EV"
```

Every Bash call starts a new shell, so re-export `EV` (reuse the same value) in each call, or chain commands with `&&`. Scripts read `EV` and refuse to run without it.

## Launch

No port check is needed because nothing listens. Isolation comes from a throwaway browser profile (`$EV/profile-<scenario>`), so a run never touches the developer's own Chrome, its extensions, or its storage.

1. `npm install` if `node_modules/` is missing.
2. Build: `npm run build` (about 1 s; writes `dist/`). Rebuild after any source change, `doctor.sh` fails on a stale `dist/`.
3. Ready means the extension's service worker registered and `options.html` renders its `section.language`. `session.mjs` waits for both, so a scenario that starts has launched.

Nothing else is needed: no seed data, services or migrations. A fresh profile means default settings (`enabled` on, theme `system`, language `auto`, no API keys), and the browser locale is forced to `en-US`, so UI strings are English.

## Doctor

Read-only. Run first, and whenever anything looks off.

```bash
.claude/skills/verify-should-i-watch-for-netflix/scripts/doctor.sh
```

It checks: repo identity, `node_modules`, `dist/` exists and is newer than `src/`, `playwright-core` resolvable, a Chromium binary, `ffprobe`, `EV` set (and git-ignored if inside the repo), and whether the optional Netflix variables are set (presence only, never values). Exit 0 means ready. If Chromium is missing: `npx playwright install chromium`, or point `VERIFY_CHROMIUM` at any Chromium/Chrome-for-Testing binary. If `playwright-core` is missing: `npm i -g @playwright/cli`.

## Auth

The options page and popup need no sign-in. Only the Netflix feature does.

| Variable | Used for | Where to set |
|---|---|---|
| `VERIFY_PROFILE_DIR` | A persistent browser profile that is already signed in to Netflix (kept outside the repo, e.g. `~/.cache/verify-siwfn-netflix`) | Developer's shell |
| `VERIFY_SHOULD_I_WATCH_FOR_NETFLIX_TMDB_KEY` | A TMDB key typed into the options page so a hover can resolve a movie or series | Developer's shell |

Sign in to Netflix once by hand in a headed run that uses `VERIFY_PROFILE_DIR` (Netflix needs a human, a CAPTCHA or device check can appear). Later runs reuse the profile. Missing variables means ask the user, never guess, never echo the values, never write them into the repo. The API keys and AI key the extension stores live in the profile's `chrome.storage.local`, which is why the evidence dir stays out of git.

## Drive

Each scenario is one script in `scripts/scenarios/` that imports `scripts/session.mjs`:

```bash
export EV=...   # see Evidence dir
node .claude/skills/verify-should-i-watch-for-netflix/scripts/scenarios/popup-switch.mjs
```

Scenarios: `popup-switch`, `options-appearance`, `options-thresholds`, `options-ai-provider`. Each prints `PASS`/`FAIL` per check, the clip's pacing verdict, and exits non-zero on failure. Run them sequentially, not in parallel (each has its own profile, so they would not collide, but the output is easier to read).

What `session.mjs` gives a scenario (`const s = await start('<name>', { warmPath })`):

| Helper | Does |
|---|---|
| `s.page`, `s.ctx`, `s.url(path)` | The scenario page, its browser context, and an extension URL builder |
| `s.click(locator, label)` / `s.type(locator, value, label)` | Label the step, pause, act (typing char by char), pause. Counts as one action |
| `s.title(text)`, `s.label(text)` | Title card and step overlay (`pointer-events:none`, literal text only) |
| `s.storage('settings')` | Reads `chrome.storage.local` from the extension page. This is the "second read" that proves the side effect |
| `s.shot(name)` | Screenshot to `$EV/shots/<scenario>-<name>.png` |
| `s.check(name, ok)` | Records a PASS/FAIL line |
| `s.finish(proves)` | Holds the final state, closes the page, saves the clip, pacing check, writes `clips.md`, closes the browser |

Handles to prefer, in order: ARIA roles (`getByRole('switch')`, `getByRole('tab', { name })`, `getByRole('button', { name })`, `getByRole('status')`), stable ids (`#ai-provider`, `#ai-key`, `#th-<set>-<field>`, `#th-<set>-errors`, `#tmdb-key`), section classes (`section.ai`, `section.theme`, `section.language`, `section.thresholds-mal|imdb|tmdb`, `section.taste`, `section.cache`), `data-provider`, `data-key`. Visible text is English in the harness (locale forced to `en-US`).

Rules the proof run taught:

- **Wait for a result, then read.** The status line (`getByRole('status')`) updates asynchronously after a save. `waitFor` the expected text before reading storage. Do not read storage right after the click.
- **The language save reloads the page.** `saveLanguage` calls `location.reload()`. Wait for the new heading text (`section.language h2` with `Ngôn ngữ` or `Language`). Do not wait on `<html lang>`: `public/options.html` ships `lang="vi"`, so it is already `vi` before the script runs.
- **Provider list and API format are custom listboxes**, not `<select>`. Click `#ai-provider`, then `[data-provider=<id>]` (format: `#ai-format`, `[data-format=<id>]`). The base URL and format fields are inside the collapsed `Advanced options` `<details>`, open it before reading `#ai-base-url`.
- **Saving a provider on a new host asks Chrome for a permission** (non-default hosts such as `api.openai.com`). Headless cannot answer it, so such a save returns "Access to … was not granted". Only save DeepSeek (already in `host_permissions`), or assert the refusal.
- **"Has not happened yet" is one read taken while the request is in flight**, not a polling wait. A poll that outlasts the request sees the later, legitimate state. The extension's fetches go to real APIs; mock by intercepting the request on the page (`page.route`) before the action, and delay the fulfilled response when a loading state has to stay on screen long enough to assert. The service worker's own fetches are not visible to `page.route`, use `ctx.route`.
- **Optional steps:** an "is it visible" read that does not wait must follow a wait for either outcome. Branch only after one has appeared.
- The popup is a normal tab here (`chrome-extension://<id>/popup.html`). `Open settings` calls `chrome.runtime.openOptionsPage()` and `window.close()`, which behaves differently from a real toolbar bubble.

## Evidence

Everything lands in `$EV`:

- `shots/<scenario>-<step>.png`: before, key intermediate, after.
- `video/<scenario>.webm` and `clips.md` (see Record).
- Console output of each scenario (`tee "$EV/<scenario>.log"` if you want to keep it). `session.mjs` fails a scenario on any page console error or uncaught page error.

Proof standards:

- Exercise the real user path: click the tabs, type into the inputs, press Save. Never set `chrome.storage` to fake the state, never use a test-only entry point.
- Capture the action and the resulting state: a screenshot before and after, not only the last screen.
- Verify the side effect alongside the visible result: the status line **and** the stored value read back through `s.storage`. For the Netflix feature, also the service worker's `[sw] ...` and the page's `[hover] ...` / `[lookup] ...` console lines.
- Mock only what the test account cannot reach (TMDB, MAL, OMDb, AI are live third-party APIs), and say in the proof that it was mocked.
- Observe what a "safe" path actually skips. The AI **Test connection** button sends a real 16 token request with the form values and costs money on a real key. Do not click it with a real key unless asked.

## Record

Native recorder: the browser context's `recordVideo` option, already set up in `session.mjs`:

```js
chromium.launchPersistentContext(profile, { recordVideo: { dir: rawVideo, size: { width: 1100, height: 800 } }, ... })
// at the end:
const video = page.video(); await page.close(); await video.saveAs('<EV>/video/<scenario>.webm')
```

A clip is complete only once its page closes. `s.finish()` does that, then reads the file back with `ffprobe`. Rules, all enforced by `session.mjs`:

- One page per scenario gives one clip, saved as `$EV/video/<scenario>.webm`.
- `$EV/clips.md` gets one line per clip: `- video/<scenario>.webm | <what it proves> | PASS|FAIL`. It is written after the checks ran. A failing scenario or a too-fast clip is `FAIL`.
- A clip is as long as the script's browser time. The script is written before it runs, so agent thinking time is not recorded. The dead time in a clip is the app's own. The warm page (a visit before recording, `warmPath`) removes the first-load cost, and its video is discarded.
- Pacing is in `PACE` at the top of `scripts/session.mjs`, tune it there:

| Name | Value | Meaning |
|---|---|---|
| `pauseBefore` | 1000 ms | Pause so the viewer sees the target before an action |
| `pauseAfter` | 1000 ms | Pause so the result is readable |
| `keyDelay` | 120 ms | Per character when typing, never snap a value in |
| `finalHold` | 2000 ms | Hold on the final state |
| `titleHold` | 1500 ms | Opening title card |
| `minSecPerAction` | 2 s | Pacing self-check threshold |

- Every action is labeled with a `pointer-events:none` overlay built from script literals. Never pass page text, API output or user input to `s.label`.
- Hold on transient states (a toast, an error, a status line) with `s.pause()` until readable. Put the whole scenario in one script so no agent latency lands as frozen frames, and make every wait deliberate.
- Pacing self-check, run automatically by `finish()`: `duration / actions >= PACE.minSecPerAction`. If a clip prints `PACING TOO FAST`, raise the pauses and re-record. To check by hand: `ffprobe -v error -show_entries format=duration -of csv=p=0 "$EV/video/<scenario>.webm"`, then divide by the number of `s.click`/`s.type` calls.
- Screenshots and the stored-value reads are kept alongside because a clip shows the UI and not the storage.

## Cleanup

`s.finish()` closes the page and the browser context, so a normal run leaves nothing running. After a crashed or interrupted run, stop only the browsers this run started, identified by the unique profile path in their command line (never by process name, never every Chrome):

```bash
pgrep -f "user-data-dir=$EV/" | while read -r p; do kill "$p"; done
sleep 1; pgrep -f "user-data-dir=$EV/" || echo "no leftover browsers"
```

The runs create no records outside their throwaway profile, so there is nothing to delete in an app or API. `VERIFY_PROFILE_DIR` is a persistent profile meant for the Netflix feature only. Do not run the options or popup scenarios against it: they write settings (theme, language, thresholds, a placeholder AI key) and do not restore them. Unset it for those. Cleanup never touches `$EV`: the evidence must survive.

## Helpers

- `scripts/doctor.sh`: read-only health check, run as `.claude/skills/verify-should-i-watch-for-netflix/scripts/doctor.sh`.
- `scripts/session.mjs`: module imported by scenarios, not run directly.
- `scripts/scenarios/<name>.mjs`: one scenario each, run as `node .claude/skills/verify-should-i-watch-for-netflix/scripts/scenarios/<name>.mjs` with `EV` exported.
