import { initLocale, locale } from '../shared/i18n';
import type { LookupRequest } from '../shared/messages';
import { MATCH_THRESHOLD, normalizeTitle } from '../shared/normalize';
import type { Settings } from '../shared/settings';
import type { AnimeInfo, LookupResult, Score } from '../shared/types';
import type { AnimeAdapter } from './adapters/AnimeAdapter';
import type { FilmAdapter, FilmDetails, FilmMatch } from './adapters/FilmAdapter';
import { canUseMalOfficial } from './adapters/MalOfficialAdapter';
import type { OmdbAdapter } from './adapters/OmdbAdapter';
import { lookupCacheKey, type LookupCache } from './cache';
import { RequestError } from './requestQueue';
import { route } from './routing';

export interface LookupDeps {
  cache: LookupCache;
  loadSettings: () => Promise<Settings>;
  anilist: AnimeAdapter;
  malOfficial: (clientId: string) => AnimeAdapter;
  tmdb: (key: string) => FilmAdapter;
  cinemeta: () => FilmAdapter;
  omdb: (key: string) => OmdbAdapter;
  log?: (message: string) => void;
}

interface Resolved {
  result: LookupResult;
  cacheable: boolean;
}

export type Lookup = (request: LookupRequest) => Promise<LookupResult>;

function toError(err: unknown): LookupResult {
  if (err instanceof RequestError) return { status: 'error', reason: err.reason };
  return { status: 'error', reason: 'network' };
}

function errorReason(err: unknown): string {
  return err instanceof RequestError ? err.reason : 'network';
}

// A score from the extra source replaces the base one, so Cinemeta's vote-less IMDb score gives way to OMDb's.
function mergeScores(base: Score[], extra: Score[]): Score[] {
  const replaced = new Set(extra.map((s) => s.source));
  return [...base.filter((s) => !replaced.has(s.source)), ...extra];
}

function isAnimeLike(match: FilmMatch): boolean {
  return match.animated || match.japanese;
}

export function createLookup(deps: LookupDeps): Lookup {
  const log = deps.log ?? (() => {});
  const inFlight = new Map<string, Promise<LookupResult>>();

  function searchAnime(title: string, year: number | undefined, settings: Settings): Promise<AnimeInfo | null> {
    const clientId = settings.malClientId;
    const official = clientId && canUseMalOfficial(title) ? deps.malOfficial(clientId) : null;
    log(`[sw] fetch ${official ? 'mal-official' : 'anilist'} ${title}`);
    return (official ?? deps.anilist).search(title, year);
  }

  // Confidence stays against the TMDB name; only the query is reset to the card title.
  async function secondAnimePass(
    request: LookupRequest,
    name: string | undefined,
    settings: Settings,
  ): Promise<AnimeInfo | null> {
    if (!name || normalizeTitle(name) === normalizeTitle(request.title)) return null;
    log(`[sw] second pass ${name}`);
    const found = await searchAnime(name, request.year, settings);
    return found && { ...found, match: { ...found.match, query: request.title } };
  }

  async function omdbScores(omdb: OmdbAdapter, imdbId: string | undefined): Promise<Score[]> {
    if (!imdbId) {
      log('[sw] omdb skipped no_imdb_id');
      return [];
    }
    const result = await omdb.scores(imdbId);
    if (result.status === 'skipped') {
      log(`[sw] omdb skipped ${result.reason}`);
      return [];
    }
    return result.scores;
  }

  async function withImdb(
    anime: AnimeInfo,
    film: FilmAdapter,
    match: FilmMatch | null,
    omdb: OmdbAdapter | null,
    known: FilmDetails | undefined,
  ): Promise<AnimeInfo> {
    if (anime.format !== 'Movie' || !omdb || match?.mediaType !== 'movie') return anime;
    let details = known;
    try {
      details ??= await film.details(match);
    } catch (err) {
      log(`[sw] omdb skipped tmdb_${errorReason(err)}`);
      return anime;
    }
    const imdb = (await omdbScores(omdb, details.imdbId)).filter((s) => s.source === 'imdb');
    return imdb.length ? { ...anime, scores: mergeScores(anime.scores, imdb) } : anime;
  }

  async function resolve(request: LookupRequest): Promise<Resolved> {
    try {
      const settings = await deps.loadSettings();
      const filmName = settings.tmdbKey ? 'tmdb' : 'cinemeta';
      const film = settings.tmdbKey ? deps.tmdb(settings.tmdbKey) : deps.cinemeta();
      const omdb = settings.omdbKey ? deps.omdb(settings.omdbKey) : null;
      log(`[sw] fetch ${filmName} ${request.title}`);
      const [animeResult, filmResult] = await Promise.allSettled([
        searchAnime(request.title, request.year, settings),
        film.search(request.title, request.year, request.lang),
      ]);

      // A failed side only blocks the result when its answer could change the route.
      if (filmResult.status === 'rejected') {
        const found = animeResult.status === 'fulfilled' ? animeResult.value : null;
        if (found && found.match.confidence >= MATCH_THRESHOLD) {
          log(`[sw] ${filmName} failed ${errorReason(filmResult.reason)}, using anime`);
          log(`[sw] route anime ${request.title}`);
          return { result: { status: 'match', info: found }, cacheable: false };
        }
        return { result: toError(filmResult.reason), cacheable: false };
      }
      const filmMatch = filmResult.value;
      if (animeResult.status === 'rejected' && (!filmMatch || isAnimeLike(filmMatch))) {
        return { result: toError(animeResult.reason), cacheable: false };
      }
      let anime = animeResult.status === 'fulfilled' ? animeResult.value : null;

      let details: FilmDetails | undefined;
      if (!anime && filmMatch && isAnimeLike(filmMatch)) {
        details = await film.details(filmMatch);
        anime = await secondAnimePass(request, details.englishName, settings);
      }

      const decision = route(anime?.match ?? null, filmMatch);
      log(`[sw] route ${decision} ${request.title}`);

      if (decision === 'anime' && anime) {
        return {
          result: { status: 'match', info: await withImdb(anime, film, filmMatch, omdb, details) },
          cacheable: true,
        };
      }
      if (decision === 'tmdb' && filmMatch) {
        details ??= await film.details(filmMatch);
        const extra = omdb ? await omdbScores(omdb, details.imdbId) : [];
        return {
          result: { status: 'match', info: { ...details.info, scores: mergeScores(details.info.scores, extra) } },
          cacheable: true,
        };
      }
      return { result: { status: 'no_match' }, cacheable: true };
    } catch (err) {
      return { result: toError(err), cacheable: false };
    }
  }

  async function lookup(request: LookupRequest, key: string): Promise<LookupResult> {
    const cached = await deps.cache.get(key);
    if (cached) {
      log(`[sw] cache hit ${key}`);
      return cached;
    }
    const { result, cacheable } = await resolve(request);
    if (cacheable) await deps.cache.set(key, result);
    return result;
  }

  return async (request) => {
    // The service worker restarts, so the saved language is applied per lookup before the key and TMDB language depend on it.
    await deps.loadSettings().then(initLocale, () => undefined);
    const key = lookupCacheKey(locale, request.lang, request.title, request.year);
    const pending = inFlight.get(key);
    if (pending) return pending;
    const promise = lookup(request, key).finally(() => inFlight.delete(key));
    inFlight.set(key, promise);
    return promise;
  };
}
