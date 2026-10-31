# Appearance settings

The options page has a Popover theme section (Dark, Light, Follow system) and a Language section (Auto, Tiếng Việt, English). The theme applies at once to the options page, the popup and open Netflix tabs. The language rebuilds the options page and also drives the popup, popover and AI opinions.

## Sub-features

- `theme-pick` sets the theme and applies it without a reload.
- `language-pick` sets the language and reloads the options page in it.
- `language-auto` follows the browser language (Vietnamese for `vi`, English otherwise).

## How to get to it (user POV)

- Toolbar popup, Open settings, then the Popover theme and Language cards.
- `chrome://extensions`, extension Details, Extension options.
- Harness: `s.url('options.html')`.

## Driving it with playwright-core

Preconditions:

- Baseline from `README.md`. Browser locale `en-US`, so `Auto` resolves to English.

- **Run the whole recipe.** `node .claude/skills/verify-should-i-watch-for-netflix/scripts/scenarios/options-appearance.mjs`. Six `PASS` lines, clip, `PACING OK`.
- **Theme Light.** `await s.click(page.locator('section.theme').getByRole('tab', { name: 'Light' }), 'Theme: Light')`. `<html data-theme>` becomes `light`, and `(await s.storage('settings')).theme` is `light`. No reload happened.
- **Theme Dark.** Same with `Dark`. `data-theme` is `dark`, `theme` is `dark`.
- **Language Vietnamese.** `await s.click(page.locator('section.language').getByRole('tab', { name: 'Tiếng Việt' }), ...)`. The page reloads, `section.language h2` reads `Ngôn ngữ`, `language` is `vi`.
- **Language English.** Click `English`. The heading reads `Language`, `language` is `en`, and `theme` is still `dark`.
- **Proof.** `shots/options-appearance-{before,light,vi,after}.png`, `video/options-appearance.webm`.

## Gotchas

- `public/options.html` ships `lang="vi"`. Do not assert `<html lang>` to know the language has loaded. Assert a heading.
- After the language save the page reloads, so locators from before the click are stale. Re-query after waiting for the new heading.
- The tab labels for language stay native in both languages (`Tiếng Việt`, `English`), the theme labels do not (`Tối`, `Sáng`). Change the theme first in English.
- The theme's effect on a Netflix tab and on a real popover is not covered here, see the Netflix feature.
- `Auto` with a Vietnamese browser locale is not driven (the harness forces `en-US`). Set `VERIFY_CHROMIUM` plus a `--lang=vi` run only if that path is the change under test.
