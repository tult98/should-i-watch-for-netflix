# Build plan

This plan covers the Chrome extension described in the brief and drawn in `Netflix Info Popover.html`. It names the data shapes first, then the folder layout, then the six build steps. Each step ends in something you can check on real Netflix.

## Where the brief and the design disagree

The design file has seven boards: the hover layout, the anime popover, the anime states (quick, AI, loading, skip), the movie and series popover, the movie and series states, the options page, and the icon. Most of it matches the brief. Four things don't.

| Topic | Brief says | Design shows | Plan |
|---|---|---|---|
| Movie and series badge | IMDb score, votes 100k / 20k, warning under 5k | TMDB score as the big number, thresholds 8.0 / 5000, 7.2 / 2000, 6.5, warning under 500 | Keep three threshold sets: MAL, IMDb, TMDB. The badge uses IMDb when OMDb returns a score and TMDB otherwise, labeled with its source. The big number shows the score the badge used. Every data source is free (see "Free sources"). |
| Metacritic | Shown for movies | Not on the board. The stats row is IMDb, Rotten Tomatoes, age rating. | Movie stats row becomes IMDb, Rotten Tomatoes, Metacritic. Age rating moves to the detail grid. Confirmed. |
| Anime synopsis | "Synopsis (Vietnamese)" | English MAL synopsis labeled "Tóm tắt (MAL, tiếng Anh)", replaced by the Vietnamese `summary_vi` after "AI nhận xét" | Follow the design. MAL has no Vietnamese synopsis, and the brief forbids calling the AI automatically. |
| Options page heading | Name lives only in `manifest.json` | Heading reads "Netflix Anime Info Popover" | The heading reads `chrome.runtime.getManifest().name`. |

## Free sources

Every data source runs on a free tier. No paid wrapper such as CollectAPI.

| Source | Cost | Limit | Effect on the extension |
|---|---|---|---|
| MyAnimeList API v2 | Free Client ID | not published, the queue sends 3 per second | Used when the options page has a Client ID. `MalOfficialAdapter.ts` |
| Jikan (MAL) | Free, no key | about 3 per second, 60 per minute | Fallback without a Client ID, and for titles under 3 characters. `JikanAdapter.ts` |
| TMDB | Free key | about 50 per second | Required for movies and series. The options page takes either the v3 API key or the v4 read access token. |
| OMDb | Free key | 1,000 per day | Optional. One call per new movie or series, then cached 7 days |
| AI provider | DeepSeek, paid per request | Depends on your DeepSeek balance | Only called on click. Any OpenAI-compatible provider works by changing the base URL and model. |

The OMDb and TMDB limits are from their published docs as I remember them, not checked this session. When OMDb returns `Request limit reached!`, the adapter returns no IMDb score and the badge falls back to TMDB for the rest of the day.

The official MAL API exists because Jikan was unreachable from your network on 2026-10-30. A TCP connect to `api.jikan.moe` timed out on IPv4 and IPv6, while `api.myanimelist.net` answered in 0.3 s. Both adapters implement `AnimeAdapter` and return the same `AnimeInfo`, so nothing after the adapter knows which one ran. `lookup.ts` reads `settings` on every cache miss. The MAL API rejects a `q` under 3 characters, as far as I remember, so those titles go to Jikan. The MAL field names and the 3 character rule come from memory and still need one live call to confirm.

## Data shapes

### `TitleInfo`

Every adapter returns this type. The popover never imports an adapter.

```ts
type Kind = 'anime' | 'movie' | 'series';
type ScoreSource = 'mal' | 'imdb' | 'tmdb' | 'rt' | 'metacritic';

interface Score { source: ScoreSource; value: number; votes?: number }

interface MatchInfo {
  query: string;          // text read from the Netflix card
  matchedName: string;    // name shown as "Khớp MAL: ..." or "Khớp TMDB: ..."
  confidence: number;     // 0..1, shown as a percentage
  source: 'mal' | 'tmdb';
}

interface BaseInfo {
  id: string;             // "mal:52991", "tmdb:movie:550", "tmdb:tv:1399"
  kind: Kind;
  title: string;
  year?: number;
  synopsis?: { text: string; lang: 'vi' | 'en' };
  genres: string[];
  scores: Score[];
  match: MatchInfo;
}

interface AnimeInfo extends BaseInfo {
  kind: 'anime';
  format: string;         // TV, Movie, OVA, ONA
  episodes?: number;
  status: string;
  demographic?: string;
  rank?: number;
  popularity?: number;
  members?: number;
  season?: string;        // "Fall 2023"
  aired: { from?: string; to?: string };
  studios: string[];
}

interface MovieInfo extends BaseInfo {
  kind: 'movie';
  runtimeMin?: number;
  directors: string[];
  cast: string[];
  certification?: string;
  releaseDate?: string;
}

interface SeriesInfo extends BaseInfo {
  kind: 'series';
  seasons?: number;
  episodes?: number;
  status: 'ongoing' | 'ended';
  startYear?: number;
  endYear?: number;
  creators: string[];
  cast: string[];
  certification?: string;
}

type TitleInfo = AnimeInfo | MovieInfo | SeriesInfo;

type LookupResult =
  | { status: 'match'; info: TitleInfo }
  | { status: 'no_match' }
  | { status: 'error'; reason: 'network' | 'rate_limited' | 'bad_mal_client_id' | 'bad_tmdb_key' };
```

An anime movie stays `kind: 'anime'` and gets an extra `imdb` entry in `scores` when an OMDb key exists.

A missing TMDB key is not an error. Without one, the lookup works like step (b): anime only, and `no_match` for everything else. The service worker logs `[sw] no tmdb key` when that `no_match` happens. OMDb never fails a lookup. A bad OMDb key, the daily limit, or any other OMDb failure only means no extra scores, and the service worker logs `[sw] omdb skipped <reason>`.

### Hover state machine

The content script holds one state value instead of loose flags. A new hover while a popover is open goes straight to `armed`, so the popover stays up and swaps content. That swap is what stops the flicker on fast hovering.

| State | Enter on | Leave on |
|---|---|---|
| `idle` | start, or hide timer fires | pointer enters a card |
| `armed` | pointer enters a card | 300 ms passes (to `loading`) or pointer leaves (to `idle`) |
| `loading` | debounce fires; sends `lookup` with a request id | response arrives (to `shown`, or `empty` on `no_match` and `error`) |
| `shown` | response for the current request id | pointer leaves card, preview and popover for 150 ms (to `idle`) |
| `empty` | `no_match` or `error` for the current request id | pointer leaves the card (to `idle`) |

The content script renders only the response for the current request id. It still logs a late response, with ` (stale)` at the end.

`empty` keeps the card current with the popover hidden. Without it, every move between the card's children would arm the card again and send another lookup.

The skeleton appears only when the response takes 150 ms or more, so a cached result opens straight into its content. While the popover is up, leaving the card, the Netflix preview, or the popover starts a 150 ms hide timer, and entering any of the three cancels it. With no popover up, leaving the card goes straight to `idle`, as in step (a). When the pointer crosses another card on its way to the popover, entering the popover returns to the card the popover shows and drops the other card's timer.

### Quick badge rules

The rules are a table per threshold set, checked top to bottom. The first row that passes wins, and "Bỏ qua" is the fallback.

```ts
interface ThresholdSet {
  highly:      { score: number; votes: number; rankMax?: number };
  recommended: { score: number; votes: number };
  maybe:       { score: number };
  lowVotesBelow: number;
}

interface Thresholds { mal: ThresholdSet; imdb: ThresholdSet; tmdb: ThresholdSet }

function quickVerdict(info: TitleInfo, t: Thresholds):
  { verdict: Verdict; source: 'mal' | 'imdb' | 'tmdb'; lowVotes: boolean };
```

The content script computes the badge at render time from cached `TitleInfo` and current settings. A threshold change applies on the next hover without clearing the cache.

### Routing

`route()` is a pure function over the two best matches. The adapters run in parallel and feed it.

| MAL best match | TMDB best match | Result |
|---|---|---|
| Confidence ≥ threshold | None | Anime, MAL primary |
| Confidence ≥ threshold | Genre 16 (Animation), or `origin_country` has `JP`, or `original_language` is `ja` | Anime, MAL primary. If MAL `type` is Movie and an OMDb key exists, add IMDb from TMDB's `imdb_id`. |
| Confidence ≥ threshold | Live action, not Japanese | TMDB and OMDb |
| Below threshold or none | Confident match | TMDB and OMDb |
| Below threshold or none | None | `no_match`, popover stays hidden |

Netflix cards with both versions in their catalog break the naive rule. "One Piece" matches the anime on MAL and the 2023 live action on TMDB. The year from the Netflix card decides it when present. Without a year, the result with more TMDB votes wins.

`route()` needs no extra rule for that. The card year is already part of both confidences, so a year more than one off drops a candidate under the threshold. With year 1999 the live action fails on TMDB, and with year 2023 the anime fails on MAL. Without a year both pass, and the third row sends a live action TMDB match to TMDB. TMDB picks its own best match among same-name results by `vote_count`, so a year-less "One Piece" goes to TMDB only when the live action has more TMDB votes than the anime.

The IMDb score for an anime movie comes only from a TMDB match of type `movie`. A TMDB `tv` match would carry the IMDb id of a different title.

A failed search only fails the lookup when its answer could change the route. A TMDB failure can, so it returns its error, with one exception. When the first anime search has a confident match, the lookup routes as anime and treats TMDB as having no result. It skips the anime movie IMDb step and logs `[sw] tmdb failed <reason>, using anime`. A bad TMDB key therefore only surfaces for titles with no confident anime match. The cache only holds results computed with both sources, so that degraded match is returned but not stored. An anime search failure next to a live action TMDB match cannot, because rows 3 and 4 both pick TMDB, so that lookup still answers from TMDB.

### Name matching

The extension works with a Netflix profile in any language. Netflix shows titles in the profile language, and the content script reads that language from `document.documentElement.lang`.

`normalizeTitle()` lowercases, applies Unicode NFKD, strips combining marks, and replaces anything that isn't a letter or digit in any script (`\p{L}\p{N}`) with a space. Japanese, Korean, Thai and other scripts survive normalization. `matchConfidence(query, candidate)` returns the best score across every name the source has for the title. That score is 1.0 for an exact normalized match, otherwise a Dice coefficient over character bigrams. Bigrams work for scripts without spaces between words, where a token-based score fails. A matching year adds 0.05. A year more than one off subtracts 0.2. Results under 0.85 count as no match. The unit tests pin these numbers with titles in English, Vietnamese, Japanese, Korean and German. Tune them after step (b) with real Netflix titles.

TMDB is the bridge between languages. It stores a title in many languages, so a search in the profile language finds it. The search uses `/3/search/multi` with `language=<profile language>`, skips `person` results, and compares against `title` or `name` and `original_title` or `original_name`. If nothing passes and the profile language is not English, the adapter retries once with `language=en-US`. The details call then uses `language=vi-VN` so the overview is Vietnamese. It appends `translations`, which gives the English overview when the Vietnamese one is empty and the English name for the anime search.

MAL only knows the Japanese, romaji, English, and a few synonym names. A German or Vietnamese card title usually finds nothing there. The lookup handles that in two passes:

1. The anime search and TMDB search both run with the card title, in parallel.
2. If the anime search has no confident match and TMDB's match is animated or Japanese, the lookup fetches TMDB details and searches anime once more with TMDB's English title, or the original title when TMDB has no English one. Confidence for that second search comes from comparing against the TMDB name, not the card title. The second pass is skipped when that name normalizes to the card title.

For an English profile like yours, the second pass almost never runs. For other languages it adds one TMDB details call and one anime search per new anime title, and only on a cache miss. When the second pass finds nothing, the TMDB route reuses the details it already fetched.

### Cache

`chrome.storage.local` holds one entry per key.

| Key | Value | TTL |
|---|---|---|
| `lookup:<profile language>\|<normalized title>\|<year or ->` | `LookupResult` | 7 days for `match`, 1 day for `no_match` |
| `ai:<title id>\|<kind>\|v<taste version>\|<model>` | validated AI response with provider label, model and rating count | none, the key changes when taste or model changes |
| `taste:ratings` | list of `RatedTitle` | none |
| `settings` | `Settings` | none |

Caching `no_match` is how an unmatched title stays silent on the second hover without another API call. Errors are never cached. Saving a changed MAL Client ID, TMDB key or OMDb key on the options page clears every `lookup:` entry. AI settings never clear it, so a `no_match` computed before the key existed does not linger. The options page also has a button that clears them by hand.

### Taste profile

```ts
interface RatedTitle {
  id: string; kind: Kind; rating: 'up' | 'down';
  genres: string[]; year?: number;
  length?: number;          // episodes for anime and series, minutes for movies
  makers: string[];         // studios for anime, directors or creators otherwise
  ratedAt: number;
}

interface TasteProfile {
  kind: Kind;
  version: number;          // bumped on every rating of this kind
  count: { up: number; down: number };
  likedGenres: string[];    // sorted by net count
  dislikedGenres: string[];
  preferredLength?: number; // median length of liked titles
  era?: 'new' | 'old' | 'mixed';
}
```

`buildProfile(ratings, kind)` is a pure function. A rating only bumps the version for its own kind, so a movie rating doesn't invalidate cached anime AI verdicts.

### AI provider

```ts
interface AIProvider {
  id: string;
  opinion(input: { info: TitleInfo; taste: TasteProfile; needSummary: boolean }):
    Promise<AIOpinion>;
}

interface AIOpinion {
  summary_vi: string;
  verdict: 'highly_recommended' | 'recommended' | 'maybe' | 'skip';
  reason_vi: string;
}
```

`OpenAICompatibleProvider` sends `response_format: { type: 'json_object' }`, validates the reply against `AIOpinion`, and retries once on a parse or shape failure. `needSummary` is true for anime and for any TMDB title whose synopsis is missing or has `lang: 'en'`. When it is false, the prompt tells the model to return the TMDB overview unchanged.

## Folder structure

```
should-i-watch-for-netflix/
  manifest.json                  the only place the name lives
  package.json
  tsconfig.json
  build.mjs                      esbuild, four entry points
  vitest.config.ts
  public/
    options.html
    popup.html
    icons/icon16.png icon32.png icon48.png icon128.png
  src/
    shared/
      types.ts                   TitleInfo, LookupResult, Verdict
      messages.ts                typed messages between content script and service worker
      strings.vi.ts              every user-facing string
      appName.ts                 reads chrome.runtime.getManifest().name
      settings.ts                Settings type, defaults, load and save
      normalize.ts               normalizeTitle, matchConfidence
      quickBadge.ts              quickVerdict
      needSummary.ts             whether the AI writes the Vietnamese summary
      ageLabel.ts                New, A few years ago, Old/classic
    content/
      index.ts
      netflixSelectors.ts        every Netflix selector and the title and year readers
      hoverController.ts         the state machine above
      describeResult.ts          the [lookup] console line
      enabledSwitch.ts           follows Settings.enabled through chrome.storage.onChanged
      themeWatcher.ts            follows Settings.theme and prefers-color-scheme
      popover/
        host.ts                  Shadow DOM host and positioning
        render.ts                TitleInfo to DOM, one function per section
        styles.ts                CSS from the design
        dom.ts                   small h() element helper
        ai.ts                    AI block, error line and button states
    background/
      index.ts                   message router
      lookup.ts                  parallel search, route, cache
      routing.ts                 route()
      cache.ts                   TTL wrapper over chrome.storage.local
      requestQueue.ts            per-host rate limit and 429 retry
      adapters/
        AnimeAdapter.ts            interface both anime adapters implement
        MalOfficialAdapter.ts      MyAnimeList API v2, needs a Client ID
        JikanAdapter.ts            Jikan, no key, the fallback
        TmdbAdapter.ts
        OmdbAdapter.ts
      ai/
        AIProvider.ts
        OpenAICompatibleProvider.ts
        prompt.ts
        validate.ts
        aiCache.ts                 ai: cache key and reader
        aiService.ts               cache first, then the provider; answers ai-opinion and ai-cached
      taste/
        tasteStore.ts
        tasteProfile.ts
    options/
      options.ts
      options.css
      save.ts                    save, cache invalidation and the AI origin permission
      ai.ts                      AI origin permission and Thử kết nối
    popup/
      popup.ts                   reads storage and wires the chrome calls
      popup.css
      model.ts                   popupModel(settings, ratings), pure
      view.ts                    renderPopup(model, handlers)
  tests/
    normalize.test.ts
    matching.test.ts
    jikanAdapter.test.ts
    malOfficialAdapter.test.ts
    tmdbAdapter.test.ts
    omdbAdapter.test.ts
    describeResult.test.ts
    requestQueue.test.ts
    lookup.test.ts
    settings.test.ts
    routing.test.ts
    quickBadge.test.ts
    tasteProfile.test.ts
    aiValidate.test.ts
  README.md
```

## Build tool

| | esbuild with a small `build.mjs` | Vite with `@crxjs/vite-plugin` |
|---|---|---|
| Content script format | IIFE bundle, which MV3 content scripts need | Plugin generates a loader for ESM |
| Moving parts | one dependency, about 40 lines of config | Vite, the plugin, and the plugin's MV3 quirks |
| Reload during work | `--watch`, then reload the extension | HMR, but the content script still needs a page reload |
| Tests | Vitest runs on its own | Vitest shares the config |

Pick esbuild. The extension has four entry points and no framework, so HMR saves little, and the plugin is one more thing that can break on a Chrome update.

## Request queue

`requestQueue.ts` keeps one queue per host. Jikan gets 3 requests per second and 60 per minute, enforced with two sliding windows. The MAL API gets 3 per second. TMDB gets 20 per second. OMDb gets 5 per second. A 429 reply waits for `Retry-After` when the header is present, otherwise 1 s, 2 s, then 4 s, and gives up after three retries with `rate_limited`. Every request aborts after 10 s and fails with `network`, so an unreachable host can't hang a lookup. The AI host gets 30 s, through a per-host `timeoutFor` option, because a chat completion takes several seconds. The queue lives in service worker memory. Chrome can stop the worker after 30 s idle, which loses only queued requests the user has already moved past.

## Permissions

`manifest.json` asks for `storage` and these hosts: `https://www.netflix.com/*`, `https://api.jikan.moe/*`, `https://api.myanimelist.net/*`, `https://api.themoviedb.org/*`, `https://www.omdbapi.com/*`, `https://api.deepseek.com/*`. A custom AI base URL goes in `optional_host_permissions` as `https://*/*`. The options page calls `chrome.permissions.request` for that one origin when you save it.

## Build steps

Each step leaves a loadable extension. You test it on real Netflix before the next one starts, because the check needs your logged-in account.

### (a) Hover detection and title extraction

Files: `manifest.json`, `build.mjs`, `content/index.ts`, `content/netflixSelectors.ts`, `content/hoverController.ts`.

The content script logs `[hover] <lang> <title> <year?>` to the page console after 300 ms on a card. Nothing else happens yet.

Check on Netflix: hover ten cards across the home page, a genre row, search results, and "My List". Every log line shows the right title, with no duplicate log for one hover and no log when you sweep across a row.

Netflix's DOM is not in the design file, so the first selectors are guesses: `.title-card` and `.slider-item` for cards, `a[aria-label]` and `.fallback-text` for the title, and the preview modal for the year. If a guess fails, paste the card's `outerHTML` and the step fixes the selectors from it.

### (b) MAL adapter and name matching

Files: `shared/normalize.ts`, `background/adapters/JikanAdapter.ts`, `background/adapters/MalOfficialAdapter.ts`, `shared/settings.ts`, a minimal options page with the MAL Client ID field, `background/requestQueue.ts`, `background/cache.ts`, `background/index.ts`, and the `normalize` and `matching` tests.

Hover logs the MAL match and its confidence, or `no_match`.

Check on Netflix: a well-known anime logs the right MAL entry. A live-action film logs `no_match` or a low confidence. The second hover of a title logs `cache hit` and no network request in the service worker's DevTools.

### (c) TMDB and OMDb adapters and routing

Files: `TmdbAdapter.ts`, `OmdbAdapter.ts`, `routing.ts`, `lookup.ts`, `content/describeResult.ts`, the TMDB and OMDb key fields on the options page, and the `routing`, `tmdbAdapter`, `omdbAdapter`, `describeResult` and `lookup` tests.

`TmdbAdapter` sends a key that starts with `eyJ` as `Authorization: Bearer`, since that is a v4 read access token. Any other key goes in `api_key`. A 401 fails the lookup with `bad_tmdb_key`. The search result carries the routing signals: `animated` when `genre_ids` has 16, and `japanese` when `origin_country` has `JP` or `original_language` is `ja`. Routing needs no details call. A series gets `endYear` only when its status is `Ended` or `Canceled`, since `last_air_date` of a running show is just its latest episode.

`OmdbAdapter` reads `imdbRating`, `imdbVotes`, `Metascore`, and the `Ratings` list. It returns `imdb`, `rt` and `metacritic` scores, and drops every `N/A`. It never throws.

The service worker logs `[sw] route <anime|tmdb|none> <title>`. The page console logs `[lookup] <title> -> <kind> <matched name> <confidence>% <id> <scores>`, for example `movie The Irishman 100% tmdb:movie:398978 imdb=7.8(1.2M) rt=95% mc=94 tmdb=7.6(8.2k)`.

Check on Netflix: an anime routes to MAL, a film and a series route to TMDB, an anime film such as a Ghibli title routes to MAL with an IMDb score, and "One Piece" picks the version the card's year points to.

The TMDB and OMDb field names come from memory and the test fixtures are hand-written. One live call to each API still needs to confirm them. A cached `no_match` from step (b) stays for up to a day, so a film hovered before the TMDB key was set stays silent until it expires.

### (d) Popover and quick badge

Files: `content/popover/*`, `shared/strings.vi.ts`, `shared/quickBadge.ts`, `shared/ageLabel.ts`, and the `quickBadge`, `ageLabel`, `format`, `position`, `render`, `popoverHost` and `hoverController` tests.

The popover follows the design: 380 px wide, `#181818` background, the loading skeleton, the low-votes warning, and the source pill. It opens beside the card on the side with more room and never overlaps the card's box. It renders inside a closed Shadow DOM.

Check on Netflix: the four anime states and the three movie and series states from the design appear for real titles. Sweeping fast across a row shows no flashing. Moving the pointer from the card onto the popover keeps it open.

Decisions made while building it:

- The big score is the score the badge used, labeled with its source. Anime always use MAL. Movies and series use IMDb when OMDb returned a score, and TMDB otherwise. The design's TMDB number is the fallback case.
- The stats row never repeats the big score and drops any cell without a value instead of showing a placeholder. A movie lists IMDb, Rotten Tomatoes and Metacritic. A series lists IMDb, Rotten Tomatoes and TMDB. A row left with no cells is hidden. An anime lists Ranked, Popularity and Members, plus IMDb when an anime movie has one.
- The design has no "Cân nhắc" badge. It uses a yellow outline, `#f5c542`, the same yellow as the low votes warning, between the green "Nên xem" outline and the grey "Bỏ qua".
- Missing votes count as zero, so a score without votes never reaches "Rất nên xem" and always shows the low votes warning. An anime with no MAL rank cannot pass the `rankMax` rule.
- The threshold sets live in `Settings.thresholds`. Until step (f) adds the editor, they are `DEFAULT_THRESHOLDS` in `settings.ts`. A malformed stored set falls back to its default.
- `SeriesInfo` carries only years, so the series time row reads "2021 – 2024" or "2023 – nay", not the design's month and year.
- The skeleton has no source pill, because the source is unknown until the response arrives. Its note reads "Đang tra cứu…".
- The popover sits beside the Netflix preview when the preview is open, otherwise beside the card. It goes right with a 12 px gap when it fits, then left, then on the side with more room. It is clamped 8 px inside the viewport vertically and never overlaps the anchor horizontally. The host re-reads the anchor every animation frame while the popover is up, because the preview grows after the popover opens.
- "AI nhận xét", 👍 and 👎 render per the design and only log `[popover] ai <id>`, `[popover] rate up <id>` and `[popover] rate down <id>` until steps (e) and (f).

### (e) AI opinion

Files: `background/ai/*`, `background/taste/tasteProfile.ts` as a placeholder, `shared/needSummary.ts`, `content/popover/ai.ts`, the AI fields on the options page, and the `aiValidate`, `aiPrompt`, `aiProvider`, `aiService` and `optionsAi` tests.

Clicking "AI nhận xét" shows the AI block from the design, and the button then reads "Đánh giá lại theo gu". A second click with an unchanged taste version reads the cache.

Check on Netflix: the output is Vietnamese, the verdict is one of the four values, and an anime's English synopsis becomes Vietnamese.

Decisions made while building it:

- Settings gain `aiBaseUrl`, `aiModel` and `aiKey`. The base URL is the full chat completions URL, default `https://api.deepseek.com/chat/completions`, and the model defaults to `deepseek-chat`. Only `https` URLs are kept, because the optional host permission is `https://*/*`. Saving them never clears the lookup cache.
- When the base URL's origin is not `https://api.deepseek.com`, the save click calls `chrome.permissions.request` for `<origin>/*` before its first `await`, since Chrome grants the request only inside the user gesture. A denied request refuses the save. "Thử kết nối" asks the same way, then sends a 16 token request built from the form values, saved or not.
- The system prompt is in English and demands Vietnamese output. It contains the word "json", lists the three fields with an example, and switches the `summary_vi` rule on `needSummary`. The user message is compact JSON with the title minus `id` and `match`, the quick badge, and the taste profile minus `kind` and `version`. With no ratings the prompt tells the model not to claim it knows the user's taste.
- The validator strips code fences and parses the outermost `{...}`. A failed check sends the bad reply back as an assistant turn plus one correction message. A second failure is `ai_bad_response`.
- HTTP 401 is `bad_ai_key`, 402 is `ai_no_balance`, 429 is `rate_limited` after the queue's own retries, and any other status or a timeout is `network`. The service worker log line carries the HTTP status and body start for those.
- `getTasteProfile(kind)` returns an empty profile with `version: 0` until step (f). The AI cache key includes the kind, the taste version and the model, so changing the model asks again. Cache entries keep the provider label and the rating count from when they were made.
- When a popover opens, the content script reads `ai-cached` before showing it, so a cached opinion appears with the popover and never pops in later. `ai-cached` only reads storage.
- While the AI request runs the hover controller holds the popover: leaving it does not hide it, and the hide runs 150 ms after the answer if the pointer is still away. Hovering another card still swaps the popover, and the late answer is dropped because its popover root is no longer in the document.
- When `needSummary` is true, `summary_vi` replaces the synopsis text and the label becomes "Tóm tắt". A title with no synopsis gains that section. A Vietnamese TMDB overview stays as it was.
- Errors show one yellow line in the AI slot. A missing or rejected key adds "mở trang cài đặt", which asks the service worker to call `chrome.runtime.openOptionsPage()`, since content scripts cannot.
- The 👍 button's filled state in the AI variant of the design belongs to step (f), so it was not drawn in this step.

The DeepSeek request shape, the 402 status for an empty balance, and JSON mode needing the word "json" come from memory of DeepSeek's docs. One live call still needs to confirm them.

### (f) Taste profile and options page

Files: `background/taste/*`, `content/popover/rating.ts`, the full `options/*`, and the `tasteStore`, `tasteProfile`, `thresholds`, `optionsView` and `rating` tests.

The options page follows the design board: AI settings with "Thử kết nối", the data source keys, all three threshold sets with "Về mặc định", the taste profile tabs per kind, "Xem dữ liệu đã lưu", "Xóa toàn bộ hồ sơ gu", and "Xóa cache".

Check on Netflix: rate three anime 👍 that share a genre, then ask the AI about a fourth anime. The reason mentions that genre. A movie's AI verdict stays the same as before the anime ratings.

Decisions made while building it:

- `tasteStore.ts` keeps the ratings as one list under `taste:ratings` and the per-kind versions under `taste:versions` as `{ anime, movie, series }`. A rating that changes nothing (👍 on a title already 👍) writes nothing and keeps the version. Writes run one after another inside the service worker, so two fast clicks cannot drop each other.
- A `RatedTitle` takes episodes as the length for anime and series and `runtimeMin` for movies. A zero runtime counts as missing. Makers are studios, directors, or creators.
- "Xóa toàn bộ hồ sơ gu" removes the ratings, the versions and every `ai:` entry. Versions restart at 0 after it, so an old `ai:` entry under a reused version number must not survive.
- `buildProfile(ratings, kind, version, nowMs)` nets each genre as up minus down, counting a genre once per title. Positive nets go to `likedGenres`, negative to `dislikedGenres`, a zero net to neither. Each list is sorted by magnitude then name and capped at 6. `preferredLength` is the median of liked lengths, rounded, once two liked titles have one. `era` needs three liked titles with a year: 70% or more within 10 calendar years is `new`, 30% or less is `old`, otherwise `mixed`.
- The profile gains `topMakers`: up to 3 studios, directors or creators that appear on at least two liked titles. A maker liked once says little. It reaches the prompt without a prompt change, since the payload sends the whole profile minus `kind` and `version`.
- Messages `rate { info, rating }` and `rating-get { id, kind }` both answer `{ rating, tasteCount }`, where `tasteCount` counts ratings of that kind. A failed write answers with the stored state.
- The popover reads `rating-get` together with `ai-cached` before it shows, so a pressed 👍 never pops in. A click flips the button at once and only the answer to the newest click may correct it. A failed message puts the old state back. Both buttons carry `aria-pressed`, and the pressed style is the design's white fill, `#ffffff` with `#141414` icon, for 👍 and 👎 alike.
- A rating does not re-run the AI. A new popover for a title of the same kind no longer shows the old cached opinion, because its cache key carries the old version. "Đánh giá lại theo gu" asks again with the new profile.
- The options page is built in TypeScript with `h()`, and `options.html` is an empty `<main>`. Each section follows `design/options.html`, including its inline sizes and colours, with the font stack of the popover. The design's provider dropdown is left out, since the base URL field already picks the provider. AI settings and data source keys save with their own buttons, "Lưu cài đặt AI" and "Lưu nguồn dữ liệu". Only the second can clear the lookup cache.
- Three threshold sections: MAL, IMDb, and TMDB. Scores accept `0` to `10` with a dot decimal. Votes and rank accept whole numbers only. Anything else, a negative, or an empty field marks the input with `aria-invalid` and lists the error under the rows. An empty rank turns the rank rule off. "Về mặc định" fills the defaults and saves them at once. The popover already reads `Settings.thresholds` on every lookup, so a saved change applies on the next hover.
- The taste section recomputes from storage on `chrome.storage.onChanged`, so a 👍 on Netflix shows without a reload. "Xem dữ liệu đã lưu" toggles a `<pre>` with every stored rating as JSON.
- The page ends with the TMDB attribution line in English, as TMDB's terms ask.

### (g) Toolbar popup

Files: `public/popup.html`, `src/popup/popup.ts`, `src/popup/popup.css`, a new esbuild entry, and `action.default_popup` in `manifest.json`.

Clicking the toolbar icon opens a small status panel. The design file has no board for it, so it uses the popover's dark theme: `#181818` background, the same font stack, chips and buttons. It is a status panel, not a launcher, because the main action already happens on hover.

The panel shows, from top to bottom:

1. The extension icon and name. The name comes from `appName()`.
2. An on/off switch stored as `Settings.enabled`, on by default. When it is off, the content script stops showing the popover and sends no lookups. The switch takes effect on the next hover without a page refresh, through `chrome.storage.onChanged`.
3. A status row for each key: MyAnimeList Client ID, TMDB, OMDb and DeepSeek. Each row says "Đã cài" or "Chưa cài" and what a missing key costs, for example "Phim và series cần TMDB key". It checks only whether a key is saved, not whether it works.
4. The number of rated titles per kind, for example "Anime 8 · Phim lẻ 3 · Series 2". It reads `taste:ratings` from step (f).
5. Two buttons: "Mở cài đặt", which calls `chrome.runtime.openOptionsPage()`, and "Xóa cache", which reuses `clearLookupCache`.

All strings live in `strings.vi.ts`. The popup needs no new permission.

Decisions made while building it:

- The popup uses the options page palette rather than the popover's `#181818`, since it is a small settings surface: `#141414` page, `#1f1f1f` cards with a `1px solid rgba(255,255,255,0.1)` border and 10 px radius, `#2b2b2b` tiles, a white primary button and an outlined secondary one. It is 340 px wide.
- `manifest.json` gets `action.default_popup` and no `default_title`, so the toolbar tooltip falls back to the manifest name and the name still lives in one place.
- `Settings.enabled` is kept only when it is a boolean, and `enabledOf` treats anything but `false` as on. The switch saves through `saveEnabled`, which loads the stored settings and merges. The options page saves already merge over the stored settings, so they keep `enabled`.
- The switch is a `button` with `role="switch"` and `aria-checked`, labelled by the visible text. It flips at once and flips back with "Không lưu được" when the write fails.
- The hover controller gains `setEnabled`. Off drops a pending hover and any lookup in flight and hides the popover at once, even one held open by an AI request. While off, hovers do nothing, so no `[hover]` or `[lookup]` line appears.
- The content script starts with the controller off and turns it on once the stored switch is read, so a hover in the first moments cannot send a lookup while the switch is off. `watchEnabled` reads the new value straight from the `chrome.storage.onChanged` event. A change that arrives before the first read wins over that read. A failed read counts as on.
- Each key row shows a chip with a green `#46d369` dot for "Đã cài" or a grey dot for "Chưa cài", and a note only when the key is missing. The AI row is labelled "AI (DeepSeek)" because the key also works with another base URL.
- The ratings line always lists all three kinds, zeros included, so it reads the same every time. With no ratings at all it shows a hint to use 👍 and 👎.
- "Mở cài đặt" closes the popup after `openOptionsPage` resolves. "Xóa cache" reuses `clearLookupCache` and the options page's status strings, and shows how many entries it removed.
- The view model and the DOM are split into `model.ts` and `view.ts` so tests run them without `chrome`. `popup.ts` only reads storage and passes the chrome calls in.

Check: click the icon with no keys saved and every key row reads "Chưa cài". Save a TMDB key on the options page and reopen the popup; the TMDB row reads "Đã cài". Turn the switch off and hover a card on Netflix; no popover and no `[lookup]` line. Turn it on and hover again; the popover returns without a refresh.

### (h) Light theme

Files: `src/shared/theme.ts`, `src/content/themeWatcher.ts`, `src/options/themeView.ts`, plus `settings.ts`, `popover/styles.ts`, `popover/host.ts`, `options.css` and `options.ts`. The design boards are the light popover for anime, film and series, the states board, and the light options page with its "Giao diện popover" section.

Decisions made while building it:

- `Settings.theme` is `'dark' | 'light' | 'system'`. `parseSettings` keeps it only when it is one of the three, and `themeOf` returns `'system'` when unset. `saveTheme` loads the stored settings and merges, like `saveEnabled`. `resolveTheme(pref, systemPrefersLight)` in `shared/theme.ts` turns a pref into `'dark'` or `'light'`.
- The popover CSS reads custom properties declared on `.panel`. The dark values are the default and keep the old look. `.panel[data-theme="light"]` overrides every one of them, and a test fails when a used property is missing from either block. The pills, the red AI button and the green "Rất nên xem" badge keep their colours in both themes.
- `PopoverHost.setTheme` sets `data-theme` on the panel, so it also restyles a popover that is already open.
- `watchTheme` follows the shape of `watchEnabled`. It resolves the pref with `matchMedia('(prefers-color-scheme: light)')`, applies on load, on `chrome.storage.onChanged` for `settings`, and on the media query `change` event. A storage change that lands before the first load wins over the load, and a failed load resolves as `system`.
- The options page uses the same `watchTheme` and sets `data-theme` on `<html>`. Its CSS has the same custom property split with `color-scheme` set per theme. The theme section sits right after the AI section as in the design. It has the `.tab` pills with `aria-selected`, saves on click with no save button, and shows the "Đã lưu" status line.
- The toolbar popup has no light design and stays dark and unchanged.
- Values the design does not show were chosen to match its palette. Light scrollbar thumb `#bdbdbd`. Light "Cân nhắc" outline badge and the AI error line use `#8a5a00`, the colour the options page badge uses. Options status ok `#12803a`, error `#c40d17`, and the taste data block `#f2f2f2` on `#2b2b2b` text.
- The AI sparkle icon now strokes with `currentColor`, so it follows the text colour in both themes.

Check: set "Sáng" on the options page and the page turns light at once. Hover a card on Netflix and the popover is light. Set "Theo hệ thống" and switch the OS appearance; the popover and the options page follow without a reload.

## Tests

Vitest runs `npm test` with no browser. The tests cover `normalizeTitle`, `matchConfidence` with real title pairs such as "Frieren: Beyond Journey's End" against "Sousou no Frieren", every row of the routing table, every threshold boundary in `quickVerdict`, `buildProfile` per kind, and AI reply validation for good JSON, bad JSON, and a wrong verdict value.

## README

The README covers loading the unpacked `dist/` folder, getting a MyAnimeList Client ID, a TMDB key, an OMDb key, and a DeepSeek key, every options page setting, and a section titled "When Netflix changes its UI". That section says which function in `netflixSelectors.ts` to edit, how to find the new selector in DevTools, and which console line confirms the fix.

## Open decisions

None. DeepSeek stays the default AI provider.
