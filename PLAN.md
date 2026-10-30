# Build plan

This plan covers the Chrome extension described in the brief and drawn in `Netflix Info Popover.html`. It names the data shapes first, then the folder layout, then the six build steps. Each step ends in something you can check on real Netflix.

## Where the brief and the design disagree

The design file has seven boards: the hover layout, the anime popover, the anime states (quick, AI, loading, skip), the movie and series popover, the movie and series states, the options page, and the icon. Most of it matches the brief. Four things don't.

| Topic | Brief says | Design shows | Plan |
|---|---|---|---|
| Movie and series badge | IMDb score, votes 100k / 20k, warning under 5k | TMDB score as the big number, thresholds 8.0 / 5000, 7.2 / 2000, 6.5, warning under 500 | Keep three threshold sets: MAL, IMDb, TMDB. The badge uses IMDb when OMDb returns a score and TMDB otherwise, labeled with its source. The big number shows the score the badge used. Every data source is free (see "Free sources"). |
| Metacritic | Shown for movies | Not on the board. The stats row is IMDb, Rotten Tomatoes, age rating. | Movie stats row becomes IMDb, Rotten Tomatoes, Metacritic. Age rating moves to the detail grid. Confirmed. |

## Free sources

Every data source runs on a free tier. No paid wrapper such as CollectAPI.

| Source | Cost | Limit | Effect on the extension |
|---|---|---|---|
| Jikan (MAL) | Free, no key | about 3 per second, 60 per minute | `requestQueue.ts` enforces it |
| TMDB | Free key | about 50 per second | Required for movies and series |
| OMDb | Free key | 1,000 per day | Optional. One call per new movie or series, then cached 7 days |
| AI provider | DeepSeek, paid per request | Depends on your DeepSeek balance | Only called on click. Any OpenAI-compatible provider works by changing the base URL and model. |

The OMDb and TMDB limits are from their published docs as I remember them, not checked this session. When OMDb returns `Request limit reached!`, the adapter returns no IMDb score and the badge falls back to TMDB for the rest of the day.
| Anime synopsis | "Synopsis (Vietnamese)" | English MAL synopsis labeled "Tóm tắt (MAL, tiếng Anh)", replaced by the Vietnamese `summary_vi` after "AI nhận xét" | Follow the design. MAL has no Vietnamese synopsis, and the brief forbids calling the AI automatically. |
| Options page heading | Name lives only in `manifest.json` | Heading reads "Netflix Anime Info Popover" | The heading reads `chrome.runtime.getManifest().name`. |

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
  | { status: 'error'; reason: 'missing_tmdb_key' | 'network' | 'rate_limited' };
```

An anime movie stays `kind: 'anime'` and gets an extra `imdb` entry in `scores` when an OMDb key exists.

### Hover state machine

The content script holds one state value instead of loose flags. A new hover while a popover is open goes straight to `armed`, so the popover stays up and swaps content. That swap is what stops the flicker on fast hovering.

| State | Enter on | Leave on |
|---|---|---|
| `idle` | start, or hide timer fires | pointer enters a card |
| `armed` | pointer enters a card | 300 ms passes (to `loading`) or pointer leaves (to `idle`) |
| `loading` | debounce fires; sends `lookup` with a request id | response arrives (to `shown`, or `idle` on `no_match`) |
| `shown` | response for the current request id | pointer leaves card and popover for 150 ms (to `idle`) |

The content script drops any response whose request id isn't the current one.

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

| Jikan best match | TMDB best match | Result |
|---|---|---|
| Confidence ≥ threshold | None | Anime, MAL primary |
| Confidence ≥ threshold | Genre 16 (Animation), or `origin_country` has `JP`, or `original_language` is `ja` | Anime, MAL primary. If MAL `type` is Movie and an OMDb key exists, add IMDb from TMDB's `imdb_id`. |
| Confidence ≥ threshold | Live action, not Japanese | TMDB and OMDb |
| Below threshold or none | Confident match | TMDB and OMDb |
| Below threshold or none | None | `no_match`, popover stays hidden |

Netflix cards with both versions in their catalog break the naive rule. "One Piece" matches the anime on MAL and the 2023 live action on TMDB. The year from the Netflix card decides it when present. Without a year, TMDB's live-action result wins.

### Name matching

The extension works with a Netflix profile in any language. Netflix shows titles in the profile language, and the content script reads that language from `document.documentElement.lang`.

`normalizeTitle()` lowercases, applies Unicode NFKD, strips combining marks, and replaces anything that isn't a letter or digit in any script (`\p{L}\p{N}`) with a space. Japanese, Korean, Thai and other scripts survive normalization. `matchConfidence(query, candidate)` returns the best score across every name the source has for the title. That score is 1.0 for an exact normalized match, otherwise a Dice coefficient over character bigrams. Bigrams work for scripts without spaces between words, where a token-based score fails. A matching year adds 0.05. A year more than one off subtracts 0.2. Results under 0.85 count as no match. The unit tests pin these numbers with titles in English, Vietnamese, Japanese, Korean and German. Tune them after step (b) with real Netflix titles.

TMDB is the bridge between languages. It stores a title in many languages, so a search in the profile language finds it. The search runs with `language=<profile language>`, and matching compares against `title` and `original_title`. If nothing passes, the adapter retries once with `language=en-US`. The details call then uses `language=vi-VN` so the overview is Vietnamese, and adds `alternative_titles` so the English and romaji names are available for Jikan.

Jikan only knows the Japanese, romaji, English, and a few synonym names. A German or Vietnamese card title usually finds nothing there. The lookup handles that in two passes:

1. Jikan with the card title and TMDB with the card title run in parallel.
2. If Jikan has no confident match and TMDB's match is animated or Japanese, Jikan runs once more with TMDB's English or original title. Confidence for that second search comes from comparing against the TMDB name, not the card title.

For an English profile like yours, the second pass almost never runs. For other languages it adds one Jikan request per new anime title, and only on a cache miss. Live testing of Jikan with non-English queries is still to do in step (b). Jikan didn't respond from this machine when I tried.

### Cache

`chrome.storage.local` holds one entry per key.

| Key | Value | TTL |
|---|---|---|
| `lookup:<profile language>\|<normalized title>\|<year or ->` | `LookupResult` | 7 days for `match`, 1 day for `no_match` |
| `ai:<title id>\|<taste version>` | validated AI response | none, the key changes when taste changes |
| `taste:ratings` | list of `RatedTitle` | none |
| `settings` | `Settings` | none |

Caching `no_match` is how an unmatched title stays silent on the second hover without another API call. Errors are never cached.

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
  build.mjs                      esbuild, three entry points
  vitest.config.ts
  public/
    options.html
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
      ageLabel.ts                New, A few years ago, Old/classic
    content/
      index.ts
      netflixSelectors.ts        every Netflix selector and the title and year readers
      hoverController.ts         the state machine above
      popover/
        host.ts                  Shadow DOM host and positioning
        render.ts                TitleInfo to DOM, one function per section
        styles.ts                CSS from the design
        dom.ts                   small h() element helper
    background/
      index.ts                   message router
      lookup.ts                  parallel search, route, cache
      routing.ts                 route()
      cache.ts                   TTL wrapper over chrome.storage.local
      requestQueue.ts            per-host rate limit and 429 retry
      adapters/
        MalAdapter.ts
        TmdbAdapter.ts
        OmdbAdapter.ts
      ai/
        AIProvider.ts
        OpenAICompatibleProvider.ts
        prompt.ts
        validate.ts
      taste/
        tasteStore.ts
        tasteProfile.ts
    options/
      options.ts
      options.css
  tests/
    normalize.test.ts
    matching.test.ts
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

Pick esbuild. The extension has three entry points and no framework, so HMR saves little, and the plugin is one more thing that can break on a Chrome update.

## Request queue

`requestQueue.ts` keeps one queue per host. Jikan gets 3 requests per second and 60 per minute, enforced with two sliding windows. TMDB gets 20 per second. OMDb gets 5 per second. A 429 reply waits for `Retry-After` when the header is present, otherwise 1 s, 2 s, then 4 s, and gives up after three retries with `rate_limited`. The queue lives in service worker memory. Chrome can stop the worker after 30 s idle, which loses only queued requests the user has already moved past.

## Permissions

`manifest.json` asks for `storage` and these hosts: `https://www.netflix.com/*`, `https://api.jikan.moe/*`, `https://api.themoviedb.org/*`, `https://www.omdbapi.com/*`, `https://api.deepseek.com/*`. A custom AI base URL goes in `optional_host_permissions` as `https://*/*`. The options page calls `chrome.permissions.request` for that one origin when you save it.

## Build steps

Each step leaves a loadable extension. You test it on real Netflix before the next one starts, because the check needs your logged-in account.

### (a) Hover detection and title extraction

Files: `manifest.json`, `build.mjs`, `content/index.ts`, `content/netflixSelectors.ts`, `content/hoverController.ts`.

The content script logs `[hover] <lang> <title> <year?>` to the page console after 300 ms on a card. Nothing else happens yet.

Check on Netflix: hover ten cards across the home page, a genre row, search results, and "My List". Every log line shows the right title, with no duplicate log for one hover and no log when you sweep across a row.

Netflix's DOM is not in the design file, so the first selectors are guesses: `.title-card` and `.slider-item` for cards, `a[aria-label]` and `.fallback-text` for the title, and the preview modal for the year. If a guess fails, paste the card's `outerHTML` and the step fixes the selectors from it.

### (b) MAL adapter and name matching

Files: `shared/normalize.ts`, `background/adapters/MalAdapter.ts`, `background/requestQueue.ts`, `background/cache.ts`, `background/index.ts`, and the `normalize` and `matching` tests.

Hover logs the MAL match and its confidence, or `no_match`.

Check on Netflix: a well-known anime logs the right MAL entry. A live-action film logs `no_match` or a low confidence. The second hover of a title logs `cache hit` and no network request in the service worker's DevTools.

### (c) TMDB and OMDb adapters and routing

Files: `TmdbAdapter.ts`, `OmdbAdapter.ts`, `routing.ts`, `lookup.ts`, a minimal options page with the two key fields, and the `routing` test.

Check on Netflix: an anime routes to MAL, a film and a series route to TMDB, an anime film such as a Ghibli title routes to MAL with an IMDb score, and "One Piece" picks the version the card's year points to.

### (d) Popover and quick badge

Files: `content/popover/*`, `shared/strings.vi.ts`, `shared/quickBadge.ts`, `shared/ageLabel.ts`, and the `quickBadge` test.

The popover follows the design: 380 px wide, `#181818` background, the loading skeleton, the low-votes warning, and the source pill. It opens beside the card on the side with more room and never overlaps the card's box. It renders inside a closed Shadow DOM.

Check on Netflix: the four anime states and the three movie and series states from the design appear for real titles. Sweeping fast across a row shows no flashing. Moving the pointer from the card onto the popover keeps it open.

### (e) AI opinion

Files: `background/ai/*` and the `aiValidate` test.

Clicking "AI nhận xét" shows the AI block from the design, and the button then reads "Đánh giá lại theo gu". A second click with an unchanged taste version reads the cache.

Check on Netflix: the output is Vietnamese, the verdict is one of the four values, and an anime's English synopsis becomes Vietnamese.

### (f) Taste profile and options page

Files: `background/taste/*`, the full `options/*`, and the `tasteProfile` test.

The options page follows the design board: AI settings with "Thử kết nối", the data source keys, both threshold sets with "Về mặc định", the taste profile tabs per kind, "Xem dữ liệu đã lưu", "Xóa toàn bộ hồ sơ gu", and "Xóa cache".

Check on Netflix: rate three anime 👍 that share a genre, then ask the AI about a fourth anime. The reason mentions that genre. A movie's AI verdict stays the same as before the anime ratings.

## Tests

Vitest runs `npm test` with no browser. The tests cover `normalizeTitle`, `matchConfidence` with real title pairs such as "Frieren: Beyond Journey's End" against "Sousou no Frieren", every row of the routing table, every threshold boundary in `quickVerdict`, `buildProfile` per kind, and AI reply validation for good JSON, bad JSON, and a wrong verdict value.

## README

The README covers loading the unpacked `dist/` folder, getting a TMDB key, an OMDb key, and a DeepSeek key, every options page setting, and a section titled "When Netflix changes its UI". That section says which function in `netflixSelectors.ts` to edit, how to find the new selector in DevTools, and which console line confirms the fix.

## Open decisions

None. DeepSeek stays the default AI provider.
