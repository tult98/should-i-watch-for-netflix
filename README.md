# Extension for Netflix ratings

## What it does

The extension is a Chrome extension for netflix.com. When you hover a title, it opens a dark popover with scores and a quick verdict. It works with no API key at all. Without keys, anime come from AniList and movies and series come from Cinemeta, which carries IMDb ratings. Optional keys upgrade the data: a MyAnimeList Client ID gives real MyAnimeList scores, a TMDB key gives Vietnamese titles and TMDB scores, and an OMDb key adds IMDb votes, Rotten Tomatoes and Metacritic. If you click the AI button, an AI provider gives its opinion based on a taste profile built from your thumbs up and thumbs down. The interface follows your browser language by default: Vietnamese when the browser is set to Vietnamese, English otherwise. The Language section on the options page lets you pick Tiếng Việt or English instead, and the choice applies to the options page, the toolbar popup, the Netflix popover and AI opinions.

## Install

1. Run `npm install`.
2. Run `npm run build`. The build writes the extension to the `dist` folder.
3. Open `chrome://extensions` and turn on **Developer mode**.
4. Click **Load unpacked** and choose the `dist` folder.

After each rebuild, reload the extension on `chrome://extensions` and refresh the Netflix tab. A Netflix tab that was open during the reload still runs the old content script, and its calls to the extension fail with "Extension context invalidated". The content script catches that error, stops itself, and logs `[hover] extension was reloaded, refresh this tab` to the page console.

## Get your API keys

You need no key to use the extension. Every key below is an optional upgrade, and the AI key is optional too. Without keys, anime come from AniList and movies and series from Cinemeta. Both are free and keyless, but they have limits. AniList publishes no vote count and no rank. Cinemeta publishes the IMDb rating without its vote count, and it is English only. When a source gives no vote count, the badge skips the vote checks and shows no "few votes" warning, instead of treating the count as zero.

You paste each key on the options page, see "Configure the extension".

### Get a MyAnimeList Client ID (optional)

A Client ID gives real MyAnimeList scores, vote counts and ranks for anime. Without one, the extension uses AniList.

1. Sign in at myanimelist.net and open myanimelist.net/apiconfig.
2. Click **Create ID**.
3. Set the app type to web, the redirect URL to `http://localhost`, and the purpose to non-commercial, hobbyist.
4. Copy the Client ID. Do not copy the client secret.

### Get a TMDB key (optional)

A TMDB key gives Vietnamese titles and synopses and TMDB scores for movies and series. Without one, the extension uses Cinemeta.

1. Create an account at themoviedb.org and confirm your email address.
2. Open themoviedb.org/settings/api.
3. Request a Developer key and choose personal use.
4. Copy the API Key, which is 32 characters long. A read access token that starts with `eyJ` also works.

TMDB asks for the following attribution line, and the options page shows it. "This product uses the TMDB API but is not endorsed or certified by TMDB."

### Get an OMDb key (optional)

OMDb adds IMDb vote counts, Rotten Tomatoes, and Metacritic scores.

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
3. In the popover theme section (**Giao diện popover**), choose **Tối**, **Sáng** or **Theo hệ thống**. It saves at once and applies to open Netflix tabs without a reload. The options page and the toolbar popup follow the same choice.
4. In the data sources section, optionally enter the MyAnimeList Client ID, the TMDB key, and the OMDb key. Leave a field empty to keep using the keyless source. Click **Lưu nguồn dữ liệu**.
5. In the three threshold sections (MAL and AniList, IMDb, and TMDB), edit the limits for each verdict. Click **Lưu ngưỡng** to save a section, or **Về mặc định** to restore and save the defaults. Scores accept 0 to 10. Votes and rank accept whole numbers. A bad value marks the field and lists the error under the rows. An empty rank turns the rank rule off.
6. The taste profile section shows your ratings per kind (anime, movie, series). **Xem dữ liệu đã lưu** shows every stored rating as JSON. **Xóa toàn bộ hồ sơ gu** deletes the ratings and every saved AI opinion.
7. The cache section has **Xóa cache**, which deletes the saved lookup results and shows how many entries it removed.

Saving a changed MyAnimeList Client ID, TMDB key, or OMDb key clears the lookup cache. Saving AI settings or thresholds does not. A threshold change applies on the next hover.

## Use the extension

1. Open netflix.com and hover a title card for 300 ms. The extension then looks the title up.
2. Read the popover. It opens next to the Netflix preview when the preview is open, otherwise next to the card. It opens on the right when there is room, and on the left otherwise.
3. Move the pointer onto the popover to keep it open.
4. To get an AI opinion, click **AI nhận xét**. After the answer, the button reads **Đánh giá lại theo gu**. Click it to ask again with your current taste profile.
5. To rate a title, click the thumbs up or thumbs down button. Click the same button again to clear the rating.

The badge shows one of four verdicts. The scores and thresholds behind it follow these rules.

- Anime use the MAL score when a Client ID is set, and the AniList score otherwise. AniList scores use the MAL thresholds.
- Movies and series use the IMDb score, from Cinemeta or OMDb, and the TMDB score when there is no IMDb score. The badge names the source it used.
- The verdicts are "Rất nên xem", "Nên xem", "Cân nhắc", and "Bỏ qua", checked in that order. The first verdict whose limits pass wins.
- A title with too few votes shows the warning "Ít người chấm, điểm chưa đáng tin". For MAL and TMDB scores, missing votes count as zero. IMDb scores from Cinemeta and AniList scores carry no vote count, so their vote checks, and AniList's rank check, are skipped and the warning never shows.

The AI opinion is optional. It runs only when you click the button, and with no AI key the popover shows nothing about it until you click. It adds a conclusion and a reason in the interface language. For any title whose synopsis is missing or not in that language (all anime in Vietnamese, none in English), it also writes the synopsis.

To turn the extension off without removing it, click the toolbar icon. The popup has these parts.

- An on/off switch. It takes effect on the next hover, with no page refresh. While it is off, no popover opens and no lookup runs.
- A status row for each optional key. A row says whether a key is saved and what you get without it. It does not check that the key works.
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
| `malClientId` | none, AniList is used | Options page, data sources |
| `tmdbKey` | none, Cinemeta is used | Options page, data sources |
| `omdbKey` | none | Options page, data sources |
| `aiBaseUrl` | `https://api.deepseek.com/chat/completions` | Options page, AI |
| `aiModel` | `deepseek-chat` | Options page, AI |
| `aiKey` | none | Options page, AI |
| `thresholds` | `DEFAULT_THRESHOLDS`, see below | Options page, threshold sections |
| `enabled` | `true` | Toolbar popup |
| `theme` | `system` | Options page, popover theme |

### Permissions

| Permission | Why |
|---|---|
| `storage` | Settings, the lookup cache, AI opinions, and ratings in `chrome.storage.local` |
| `https://www.netflix.com/*` | The content script runs on Netflix |
| `https://graphql.anilist.co/*` | AniList, the anime lookup without a Client ID |
| `https://v3-cinemeta.strem.io/*` and `https://cinemeta-live.strem.io/*` | Cinemeta, the movie and series lookup without a TMDB key. Some ids redirect to the second host. |
| `https://api.myanimelist.net/*` | The official MyAnimeList API |
| `https://api.themoviedb.org/*` | TMDB lookups |
| `https://www.omdbapi.com/*` | OMDb scores |
| `https://api.deepseek.com/*` | The default AI provider |
| `https://*/*` (optional) | Requested only when you save an AI base URL on another host |

### Data sources and limits

| Source | Key | Cost | Limit |
|---|---|---|---|
| MyAnimeList API v2 | Client ID | Free | The request queue sends 3 requests per second. MyAnimeList does not publish a limit. |
| AniList GraphQL | None | Free | The request queue sends 30 requests per minute. |
| Cinemeta | None | Free | The request queue sends 5 requests per second. It is a community service with no published limit. |
| TMDB | API key or read access token | Free | The request queue sends 20 requests per second. |
| OMDb | API key | Free tier | 1,000 requests per day on the free tier. The extension makes one call per new movie or series. |
| AI provider | API key | DeepSeek bills per request | Depends on your balance. Called only on click. |

A 429 reply waits for the `Retry-After` header, or 1, 2, and 4 seconds, and gives up after three retries. A request that takes longer than 10 seconds fails, and an AI request fails after 30 seconds. When OMDb reports that its limit is reached, the extension keeps the IMDb score it already has. With a TMDB key that is the TMDB score, and without one it is Cinemeta's IMDb rating. The MyAnimeList API rejects queries shorter than 3 characters, so those titles go to AniList.

### Default verdict thresholds

A title gets the first verdict whose limits all pass.

| Set | Rất nên xem | Nên xem | Cân nhắc | Few votes below |
|---|---|---|---|---|
| MAL | score 8.0, 100,000 votes, rank 500 or better | score 7.5, 30,000 votes | score 7.0 | 10,000 |
| IMDb | score 8.0, 100,000 votes | score 7.2, 20,000 votes | score 6.5 | 5,000 |
| TMDB | score 8.0, 5,000 votes | score 7.2, 2,000 votes | score 6.5 | 500 |

A title that passes none of them gets "Bỏ qua". An anime with a MAL score but no MAL rank cannot pass the rank rule. AniList scores use the MAL row and skip the votes and rank checks. Cinemeta IMDb scores use the IMDb row and skip the votes check.

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
| `[sw] fetch mal-official <title>` and `[sw] fetch anilist <title>` | Service worker | Which anime source ran |
| `[sw] fetch tmdb <title>` and `[sw] fetch cinemeta <title>` | Service worker | Which film source ran |
| `[sw] second pass <name>` | Service worker | A second anime search with the film source's name |
| `[sw] route <anime, tmdb, or none> <title>` | Service worker | The routing decision |
| `[sw] cache hit <key>` | Service worker | A lookup answered from the cache |
| `[sw] tmdb failed <reason>, using anime` and `[sw] cinemeta failed <reason>, using anime` | Service worker | The film source failed and the anime match was kept |
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
  shared/                types, messages, settings, normalize, quickBadge, strings.vi, strings.en, i18n
  content/               hover controller, netflixSelectors, popover/
  background/            service worker, lookup, routing, cache, requestQueue
    adapters/            MalOfficialAdapter, AniListAdapter, TmdbAdapter, CinemetaAdapter, OmdbAdapter
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

For each hover, the service worker searches the anime source (MyAnimeList with a Client ID, AniList otherwise) and the film source (TMDB with a key, Cinemeta otherwise) in parallel. A title routes to anime when the anime match is confident and the film source either says the title is animated (TMDB genre 16, or the Animation genre on Cinemeta) or has no match. A Japanese live action title goes to the film source like any other live action. Otherwise a confident film match routes to movie or series, and no confident match gives nothing. When the year on the card points to one version of a title, as with the anime and live action "One Piece", that version wins. If the anime search finds nothing and the film source says the title is animated or Japanese, a second anime search uses the film source's English name. That helps profiles in languages the anime source does not index. Cinemeta is searched by title only, because it returns nothing when the query holds a year, so the year only ranks its results.

A match needs a confidence of at least 0.85. The extension lowercases both titles, strips accents, and replaces everything that is not a letter or digit with a space. It then scores them with the Dice coefficient over character bigrams, which also works for scripts without spaces between words. An exact normalized match scores 1.0. A matching year adds 0.05 and a year more than one off subtracts 0.2.

Lookup results are cached per profile language, normalized title, and year. A match lasts 7 days and a no-match lasts 1 day, which keeps an unmatched title silent on the second hover. Errors are never cached. An AI opinion is cached per title, kind, taste version, and model, so changing the model or rating a title of the same kind asks the AI again.

The taste profile is built per kind. A rating of an anime does not change the profile used for movies, so an anime habit does not skew a movie verdict. Ratings, the cache, and all settings stay in `chrome.storage.local` in your browser. The only data that leaves it is the title text sent to the data sources, and for an AI click, the title details and your taste profile sent to the AI provider.

## Credits and licensing

This product uses the TMDB API but is not endorsed or certified by TMDB.

Anime data comes from MyAnimeList through its official API when you set a Client ID, and from AniList otherwise. Movie and series data comes from TMDB when you set a key, and from Cinemeta otherwise. Cinemeta carries IMDb ratings. IMDb votes, Rotten Tomatoes, and Metacritic scores come from OMDb.

The names and marks of IMDb, Rotten Tomatoes, Metacritic, TMDB, MyAnimeList, AniList, and Cinemeta belong to their owners. The icons in the popover are simple drawings and not official logos, and this project is not affiliated with any of them.

License: MIT. See the `LICENSE` file.
