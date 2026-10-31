# Netflix hover popover

On netflix.com, hovering a title card for 300 ms looks the title up and opens a popover with scores and a verdict badge (Anime from MyAnimeList, movies and series from TMDB with optional OMDb). The popover has an AI opinion button, and thumbs up and down to rate the title.

**Status: not proved.** This recipe was not executed. It needs a Netflix account, a TMDB key and network access to third-party APIs, none of which the proof run had. Every step below is untested, and the first run should fix whatever fails here.

## Sub-features

- `hover-lookup` opens the popover after a 300 ms hover and logs `[hover]` then `[lookup]`.
- `hover-badge` shows one of four verdicts from the thresholds.
- `hover-disabled` shows nothing while the popup switch is off.
- `hover-ai` runs only on clicking the AI button.
- `hover-rate` toggles a thumbs rating, stored for the taste profile.
- `hover-skip-episode` shows nothing for an episode card.

## How to get to it (user POV)

- Open `https://www.netflix.com/browse`, hover a title card and wait 300 ms.

## Driving it with playwright-core

Preconditions:

- `VERIFY_PROFILE_DIR` points at a profile signed in to Netflix, `VERIFY_SHOULD_I_WATCH_FOR_NETFLIX_TMDB_KEY` is set. `EV` is exported.
- The TMDB key is entered through the options page (`#tmdb-key`, then `Save data sources`), never written to a file. Reuse `s.type` on `#tmdb-key` with the value `process.env.VERIFY_SHOULD_I_WATCH_FOR_NETFLIX_TMDB_KEY`. `s.label` must not receive it.

- **Start.** Write a scenario next to the others: `const s = await start('netflix-hover', { warmPath: 'options.html' })`. With `VERIFY_PROFILE_DIR` set it reuses the signed-in profile.
- **Open Netflix.** `await s.page.goto('https://www.netflix.com/browse')`, then wait for `a[data-uia$="-card"]` (the card anchors, see `src/content/netflixSelectors.ts`). Expect a profile gate on a fresh profile: choose the profile first.
- **Hover.** `await s.page.locator('a[data-uia$="-card"]:not([data-uia="episodic-card"])').first().hover()`, then `s.pause(1500)`. A fixed, zero-size `div` (`position: fixed; width: 0; height: 0; z-index: 2147483647`, created in `src/content/popover/host.ts`) holds the popover in a **closed** shadow root, so no Playwright locator can see inside it. Prove the popover through a screenshot and the page console, which prints `[hover] <lang> <title> <year or -> <id>`, then `[lookup] <title> -> <result>`. Capture the console via `s.page.on('console', ...)`.
- **Switch off.** In the popup tab, turn the switch off, hover again. No popover and no new `[hover]` line.
- **AI opinion and rating.** The buttons are inside the closed shadow root, so locators cannot click them. Click by screenshot coordinates with `s.page.mouse.click(x, y)`, which is the one place coordinates are acceptable, and keep the pointer on the popover so it stays open. The AI button needs a real AI key, so mock the provider request with `ctx.route` on the provider URL and state it in the proof. Expect `[popover] ai <id> -> <outcome>`, and for a thumbs click `[popover] rated <id> -> up`, the popup then shows the rated count.
- **Proof.** A screenshot with the popover open and the card visible, the `[hover]`/`[lookup]` console lines, and the stored rating via `s.storage`.

## Gotchas

- Netflix selectors change. They live only in `src/content/netflixSelectors.ts` and use `data-uia`, `aria-label` and `href`. Class names are hashes, never use them.
- A tab that was open during an extension reload still runs the old content script and logs `[hover] extension was reloaded, refresh this tab`. Always open a fresh page after a rebuild.
- The extension skips episode cards on purpose. A card with no confident match shows nothing, which is not a failure.
- Netflix may block or challenge automated browsers. If it does, report that as the unmet precondition instead of working around it.
- Real lookups spend the user's TMDB, OMDb and MAL quotas. Hover a few cards, not a sweep.
- The shadow root is closed, so a recipe that tries `getByRole` inside the popover fails. If the change under test needs it, a test build with `mode: 'open'` in `host.ts` is a source edit, which this skill does not make.
- The AI button label and the thumbs positions were not checked against `src/content/popover/render.ts`. Read it before the first run.
