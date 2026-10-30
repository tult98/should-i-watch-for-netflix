# Extension for Netflix ratings

## What it does

The extension is a Chrome extension for netflix.com. When you hover a title, it opens a dark popover with scores and a quick verdict. Anime come from MyAnimeList. Movies and series come from TMDB, with optional scores from OMDb. If you click the AI button, an AI provider gives its opinion based on a taste profile built from your thumbs up and thumbs down. The popover text is in Vietnamese.

## Install

1. Run `npm install`.
2. Run `npm run build`. The build writes the extension to the `dist` folder.
3. Open `chrome://extensions` and turn on **Developer mode**.
4. Click **Load unpacked** and choose the `dist` folder.

After each rebuild, reload the extension on `chrome://extensions` and refresh the Netflix tab. A Netflix tab that was open during the reload still runs the old content script, and its calls to the extension fail with "Extension context invalidated". The content script catches that error, stops itself, and logs `[hover] extension was reloaded, refresh this tab` to the page console.

## Get your API keys

TMDB is required for movies and series. The other keys are optional. You paste each key on the options page, see "Configure the extension".

### Get a MyAnimeList Client ID

Without a Client ID, the extension falls back to Jikan, which may be unreachable on some networks. It timed out for the author.

1. Sign in at myanimelist.net and open myanimelist.net/apiconfig.
2. Click **Create ID**.
3. Set the app type to web, the redirect URL to `http://localhost`, and the purpose to non-commercial, hobbyist.
4. Copy the Client ID. Do not copy the client secret.

### Get a TMDB key

1. Create an account at themoviedb.org and confirm your email address.
2. Open themoviedb.org/settings/api.
3. Request a Developer key and choose personal use.
4. Copy the API Key, which is 32 characters long. A read access token that starts with `eyJ` also works.

TMDB asks for the following attribution line, and the options page shows it. "This product uses the TMDB API but is not endorsed or certified by TMDB."

### Get an OMDb key (optional)

OMDb adds IMDb, Rotten Tomatoes, and Metacritic scores.

1. Open omdbapi.com/apikey.aspx and request a free key.
2. Open the email from OMDb and activate the key.
3. Copy the key.

The free tier allows 1,000 requests per day, as the OMDb site showed when this was written. Check OMDb's current terms before you rely on that number.

### Get a DeepSeek key (optional)

DeepSeek is paid per request. The extension calls it only when you click the AI button.

1. Open platform.deepseek.com/api_keys.
2. Create a key and copy it.

Any provider with an OpenAI-compatible chat completions URL also works. Set it through the base URL and model fields.

## Configure the extension

1. Open the options page. Open the extension menu in the Chrome toolbar and choose **Options**, or open the extension card on `chrome://extensions`, click **Details**, and click **Extension options**.
2. In the AI section, enter the model, the base URL, and the API key. The defaults are `deepseek-chat` and `https://api.deepseek.com/chat/completions`. The base URL must be the full chat completions URL and must start with `https`. Click **Thử kết nối** to send a 16 token test request with the form values, saved or not. Click **Lưu cài đặt AI** to save. If the base URL is not on `api.deepseek.com`, Chrome asks you to grant access to that origin, and a refusal cancels the save.
3. In the data sources section, enter the MyAnimeList Client ID, the TMDB key, and the OMDb key. Click **Lưu nguồn dữ liệu**.
4. In the three threshold sections (MAL, IMDb, and TMDB), edit the limits for each verdict. Click **Lưu ngưỡng** to save a section, or **Về mặc định** to restore and save the defaults. Scores accept 0 to 10. Votes and rank accept whole numbers. A bad value marks the field and lists the error under the rows. An empty rank turns the rank rule off.
5. The taste profile section shows your ratings per kind (anime, movie, series). **Xem dữ liệu đã lưu** shows every stored rating as JSON. **Xóa toàn bộ hồ sơ gu** deletes the ratings and every saved AI opinion.
6. The cache section has **Xóa cache**, which deletes the saved lookup results and shows how many entries it removed.

Saving a changed MyAnimeList Client ID, TMDB key, or OMDb key clears the lookup cache. Saving AI settings or thresholds does not. A threshold change applies on the next hover.

## Use the extension

1. Open netflix.com and hover a title card for 300 ms. The extension then looks the title up.
2. Read the popover. It opens next to the Netflix preview when the preview is open, otherwise next to the card. It opens on the right when there is room, and on the left otherwise.
3. Move the pointer onto the popover to keep it open.
4. To get an AI opinion, click **AI nhận xét**. After the answer, the button reads **Đánh giá lại theo gu**. Click it to ask again with your current taste profile.
5. To rate a title, click the thumbs up or thumbs down button. Click the same button again to clear the rating.

The badge shows one of four verdicts. The scores and thresholds behind it follow these rules.

- Anime use the MAL score.
- Movies and series use the IMDb score when OMDb returned one, and the TMDB score otherwise. The badge names the source it used.
- The verdicts are "Rất nên xem", "Nên xem", "Cân nhắc", and "Bỏ qua", checked in that order. The first verdict whose limits pass wins.
- A title with too few votes shows the warning "Ít người chấm, điểm chưa đáng tin". Missing votes count as zero.

The AI opinion runs only when you click the button. It adds a conclusion and a reason in Vietnamese. For anime, and for any title whose synopsis is missing or in English, it also writes the Vietnamese synopsis.

To turn the extension off without removing it, click the toolbar icon. The popup has these parts.

- An on/off switch. It takes effect on the next hover, with no page refresh. While it is off, no popover opens and no lookup runs.
- A status row for each key. A row says whether a key is saved. It does not check that the key works.
- The number of rated titles per kind.
- **Mở cài đặt**, which opens the options page.
- **Xóa cache**, which clears the lookup cache.

Known limits.

- The extension skips episode cards on purpose. The card text is the episode name, and a lookup would match an unrelated title.
- A title with no confident match shows nothing.
- Netflix cards rarely show a year, so most lookups run without one.

## When Netflix changes its UI

Every Netflix selector lives in `src/content/netflixSelectors.ts`. Nothing else reads Netflix markup. The selectors were last verified on 2026-10-30.

If the `[hover]` lines stop appearing or show the wrong title, find the function that no longer matches.

| Function | Reads | Depends on |
|---|---|---|
| `findCard` | The card under the pointer | An `<a>` with an `aria-label` and a `data-uia` of `progress-card`, `standard-card`, or `ranked-card`. A fallback accepts any `data-uia` ending in `-card` except `episodic-card`. |
| `readTitle` | The title text | The `aria-label` of the card anchor |
| `readNetflixId` | The Netflix title id | The `jbv` query parameter, or a `/title/<id>` path, in the card `href` |
| `findPreview` | The Netflix preview around a target | An element with `data-uia="modal-motion-container-MINI_MODAL"` |
| `findOpenPreview` | The open preview for a card | The same element, and a matching title id when both sides have one |
| `readPreviewId` | The title id in the preview | A link to `/title/<id>` or `/watch/<id>` |
| `readYear` | The release year | A four-digit year in the `data-uia="videoMetadata--container"` element inside the open preview |
| `readProfileLanguage` | The profile language | The `lang` attribute of `<html>`, or `en` when empty |

To find the new selector, follow these steps.

1. Open DevTools on netflix.com and select the **Elements** panel.
2. Inspect a title card and check which element carries the `aria-label`, the `data-uia` value, and the `href`.
3. Hover the card until Netflix opens its preview. The preview is an element with `role="dialog"` and `data-uia="modal-motion-container-MINI_MODAL"`. Inspect it for the metadata container and the title link.
4. Edit the matching constant or function in `src/content/netflixSelectors.ts`. Class names are generated hashes that change between Netflix deploys, so use only `data-uia`, `aria-label`, and `href`.
5. Run `npm test`, then `npm run build`. Reload the extension and refresh the Netflix tab.

To confirm the fix, hover a card and check the page console. A correct fix logs `[hover] <lang> <title> <year or -> <id>` followed by `[lookup] ...`.

## Reference

### Settings

The options page and the toolbar popup write these keys to one `settings` object in `chrome.storage.local`.

| Key | Default | Set on |
|---|---|---|
| `malClientId` | none, Jikan is used | Options page, data sources |
| `tmdbKey` | none | Options page, data sources |
| `omdbKey` | none | Options page, data sources |
| `aiBaseUrl` | `https://api.deepseek.com/chat/completions` | Options page, AI |
| `aiModel` | `deepseek-chat` | Options page, AI |
| `aiKey` | none | Options page, AI |
| `thresholds` | `DEFAULT_THRESHOLDS`, see below | Options page, threshold sections |
| `enabled` | `true` | Toolbar popup |

### Permissions

| Permission | Why |
|---|---|
| `storage` | Settings, the lookup cache, AI opinions, and ratings in `chrome.storage.local` |
| `https://www.netflix.com/*` | The content script runs on Netflix |
| `https://api.jikan.moe/*` | Jikan, the anime lookup without a Client ID |
| `https://api.myanimelist.net/*` | The official MyAnimeList API |
| `https://api.themoviedb.org/*` | TMDB lookups |
| `https://www.omdbapi.com/*` | OMDb scores |
| `https://api.deepseek.com/*` | The default AI provider |
| `https://*/*` (optional) | Requested only when you save an AI base URL on another host |

### Data sources and limits

| Source | Key | Cost | Limit |
|---|---|---|---|
| MyAnimeList API v2 | Client ID | Free | The request queue sends 3 requests per second. MyAnimeList does not publish a limit. |
| Jikan | None | Free | The request queue sends 3 requests per second and 60 per minute. |
| TMDB | API key or read access token | Free | The request queue sends 20 requests per second. |
| OMDb | API key | Free tier | 1,000 requests per day on the free tier. The extension makes one call per new movie or series. |
| AI provider | API key | DeepSeek bills per request | Depends on your balance. Called only on click. |

A 429 reply waits for the `Retry-After` header, or 1, 2, and 4 seconds, and gives up after three retries. A request that takes longer than 10 seconds fails, and an AI request fails after 30 seconds. When OMDb reports that its limit is reached, the extension shows no IMDb score and the badge uses TMDB. The MyAnimeList API rejects queries shorter than 3 characters, so those titles go to Jikan.

### Default verdict thresholds

A title gets the first verdict whose limits all pass.

| Set | Rất nên xem | Nên xem | Cân nhắc | Few votes below |
|---|---|---|---|---|
| MAL | score 8.0, 100,000 votes, rank 500 or better | score 7.5, 30,000 votes | score 7.0 | 10,000 |
| IMDb | score 8.0, 100,000 votes | score 7.2, 20,000 votes | score 6.5 | 5,000 |
| TMDB | score 8.0, 5,000 votes | score 7.2, 2,000 votes | score 6.5 | 500 |

A title that passes none of them gets "Bỏ qua". An anime without a MAL rank cannot pass the rank rule.

### Console log lines

| Line | Where | Meaning |
|---|---|---|
| `[hover] <lang> <title> <year or -> <id>` | Netflix page | The card the extension read after the 300 ms delay |
| `[hover] enabled` and `[hover] disabled` | Netflix page | The toolbar switch changed |
| `[hover] extension was reloaded, refresh this tab` | Netflix page | The content script lost its extension, refresh the tab |
| `[lookup] <title> -> <result>` | Netflix page | The lookup result. A late answer ends with `(stale)`. |
| `[popover] ai <id> -> <outcome>` | Netflix page | The result of an AI click |
| `[popover] rated <id> -> <rating or none>` | Netflix page | The rating after a thumbs click |
| `[popover] rate <rating> <id>` and `[popover] ai <id>` | Netflix page | A click on a thumbs or AI button |
| `[sw] fetch mal-official <title>` and `[sw] fetch jikan <title>` | Service worker | Which anime source ran |
| `[sw] fetch tmdb <title>` | Service worker | A TMDB search |
| `[sw] second pass <name>` | Service worker | A second anime search with the TMDB name |
| `[sw] route <anime, tmdb, or none> <title>` | Service worker | The routing decision |
| `[sw] cache hit <key>` | Service worker | A lookup answered from the cache |
| `[sw] no tmdb key` | Service worker | A title had no anime match and no TMDB key is set |
| `[sw] tmdb failed <reason>, using anime` | Service worker | TMDB failed and the anime match was kept |
| `[sw] omdb skipped <reason>` | Service worker | OMDb returned no scores |
| `[sw] ai fetch <id>`, `[sw] ai cache hit <id>`, and `[sw] ai error <reason>` | Service worker | An AI request, a cached opinion, and a failed request |
| `[sw] rate <rating or clear> <id> (<kind> <count>)` | Service worker | A stored rating |

To read the `[sw]` lines, open `chrome://extensions` and click **service worker** on the extension card.

### Project layout

```
manifest.json            permissions, entry points, the extension name
package.json
build.mjs                esbuild, four entry points
tsconfig.json
vitest.config.ts
PLAN.md                  the build plan
public/                  options.html, popup.html, icons
assets/icon.svg
design/                  HTML boards the UI follows
src/
  shared/                types, messages, settings, normalize, quickBadge, strings.vi
  content/               hover controller, netflixSelectors, popover/
  background/            service worker, lookup, routing, cache, requestQueue
    adapters/            MalOfficialAdapter, JikanAdapter, TmdbAdapter, OmdbAdapter
    ai/                  AI provider, prompt, validation, cache, service
    taste/               tasteStore, tasteProfile
  options/               options page
  popup/                 toolbar popup
tests/                   Vitest tests and fixtures
```

### Commands

| Command | What it does |
|---|---|
| `npm run build` | Builds the extension into `dist` |
| `npm run watch` | Rebuilds `dist` when a source file changes |
| `npm run typecheck` | Runs `tsc --noEmit` |
| `npm test` | Runs the Vitest tests, which need no browser |

## How routing and caching work

For each hover, the service worker searches MyAnimeList (or Jikan) and TMDB in parallel. A title routes to anime when the MyAnimeList match is confident and TMDB either says the title is animated or Japanese or has no match. Otherwise a confident TMDB match routes to movie or series, and no confident match gives nothing. When the year on the card points to one version of a title, as with the anime and live action "One Piece", that version wins. If the anime search finds nothing and TMDB says the title is animated or Japanese, a second anime search uses the TMDB name. That helps profiles in languages MyAnimeList does not index.

A match needs a confidence of at least 0.85. The extension lowercases both titles, strips accents, and replaces everything that is not a letter or digit with a space. It then scores them with the Dice coefficient over character bigrams, which also works for scripts without spaces between words. An exact normalized match scores 1.0. A matching year adds 0.05 and a year more than one off subtracts 0.2.

Lookup results are cached per profile language, normalized title, and year. A match lasts 7 days and a no-match lasts 1 day, which keeps an unmatched title silent on the second hover. Errors are never cached. An AI opinion is cached per title, kind, taste version, and model, so changing the model or rating a title of the same kind asks the AI again.

The taste profile is built per kind. A rating of an anime does not change the profile used for movies, so an anime habit does not skew a movie verdict. Ratings, the cache, and all settings stay in `chrome.storage.local` in your browser. The only data that leaves it is the title text sent to the data sources, and for an AI click, the title details and your taste profile sent to the AI provider.

## Credits and licensing

This product uses the TMDB API but is not endorsed or certified by TMDB.

Anime data comes from MyAnimeList through its official API, with Jikan as the fallback. IMDb, Rotten Tomatoes, and Metacritic scores come from OMDb.

The names and marks of IMDb, Rotten Tomatoes, Metacritic, TMDB, and MyAnimeList belong to their owners. The icons in the popover are simple drawings and not official logos, and this project is not affiliated with any of them.

License: MIT. See the `LICENSE` file.
