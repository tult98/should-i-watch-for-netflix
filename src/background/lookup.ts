import type { LookupRequest } from '../shared/messages';
import { normalizeTitle } from '../shared/normalize';
import type { Settings } from '../shared/settings';
import type { AnimeInfo, LookupResult, Score } from '../shared/types';
import type { AnimeAdapter } from './adapters/AnimeAdapter';
import { canUseMalOfficial } from './adapters/MalOfficialAdapter';
import type { OmdbAdapter } from './adapters/OmdbAdapter';
import type { TmdbAdapter, TmdbDetails, TmdbMatch } from './adapters/TmdbAdapter';
import { lookupCacheKey, type LookupCache } from './cache';
import { RequestError } from './requestQueue';
import { route } from './routing';

export interface LookupDeps {
  cache: LookupCache;
  loadSettings: () => Promise<Settings>;
  jikan: AnimeAdapter;
  malOfficial: (clientId: string) => AnimeAdapter;
  tmdb: (key: string) => TmdbAdapter;
  omdb: (key: string) => OmdbAdapter;
  log?: (message: string) => void;
}

export type Lookup = (request: LookupRequest) => Promise<LookupResult>;

function toError(err: unknown): LookupResult {
  if (err instanceof RequestError) return { status: 'error', reason: err.reason };
  return { status: 'error', reason: 'network' };
}

function errorReason(err: unknown): string {
  return err instanceof RequestError ? err.reason : 'network';
}

function isAnimeLike(match: TmdbMatch): boolean {
  return match.animated || match.japanese;
}

export function createLookup(deps: LookupDeps): Lookup {
  const log = deps.log ?? (() => {});
  const inFlight = new Map<string, Promise<LookupResult>>();

  function searchAnime(title: string, year: number | undefined, settings: Settings): Promise<AnimeInfo | null> {
    const clientId = settings.malClientId;
    const official = clientId && canUseMalOfficial(title) ? deps.malOfficial(clientId) : null;
    log(`[sw] fetch ${official ? 'mal-official' : 'jikan'} ${title}`);
    return (official ?? deps.jikan).search(title, year);
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
    tmdb: TmdbAdapter | null,
    match: TmdbMatch | null,
    omdb: OmdbAdapter | null,
    known: TmdbDetails | undefined,
  ): Promise<AnimeInfo> {
    if (anime.format !== 'Movie' || !omdb || !tmdb || match?.mediaType !== 'movie') return anime;
    let details = known;
    try {
      details ??= await tmdb.details(match);
    } catch (err) {
      log(`[sw] omdb skipped tmdb_${errorReason(err)}`);
      return anime;
    }
    const imdb = (await omdbScores(omdb, details.imdbId)).filter((s) => s.source === 'imdb');
    return imdb.length ? { ...anime, scores: [...anime.scores, ...imdb] } : anime;
  }

  async function resolve(request: LookupRequest): Promise<LookupResult> {
    try {
      const settings = await deps.loadSettings();
      const tmdb = settings.tmdbKey ? deps.tmdb(settings.tmdbKey) : null;
      const omdb = settings.omdbKey ? deps.omdb(settings.omdbKey) : null;
      if (tmdb) log(`[sw] fetch tmdb ${request.title}`);
      const [animeResult, tmdbResult] = await Promise.allSettled([
        searchAnime(request.title, request.year, settings),
        tmdb ? tmdb.search(request.title, request.year, request.lang) : Promise.resolve(null),
      ]);

      // A failed side only blocks the result when its answer could change the route.
      if (tmdbResult.status === 'rejected') return toError(tmdbResult.reason);
      const tmdbMatch = tmdbResult.value;
      if (animeResult.status === 'rejected' && (!tmdbMatch || isAnimeLike(tmdbMatch))) {
        return toError(animeResult.reason);
      }
      let anime = animeResult.status === 'fulfilled' ? animeResult.value : null;

      let details: TmdbDetails | undefined;
      if (!anime && tmdb && tmdbMatch && isAnimeLike(tmdbMatch)) {
        details = await tmdb.details(tmdbMatch);
        anime = await secondAnimePass(request, details.englishName, settings);
      }

      const decision = route(anime?.match ?? null, tmdbMatch);
      log(`[sw] route ${decision} ${request.title}`);

      if (decision === 'anime' && anime) {
        return { status: 'match', info: await withImdb(anime, tmdb, tmdbMatch, omdb, details) };
      }
      if (decision === 'tmdb' && tmdb && tmdbMatch) {
        details ??= await tmdb.details(tmdbMatch);
        const extra = omdb ? await omdbScores(omdb, details.imdbId) : [];
        return { status: 'match', info: { ...details.info, scores: [...details.info.scores, ...extra] } };
      }
      if (!tmdb) log('[sw] no tmdb key');
      return { status: 'no_match' };
    } catch (err) {
      return toError(err);
    }
  }

  async function lookup(request: LookupRequest, key: string): Promise<LookupResult> {
    const cached = await deps.cache.get(key);
    if (cached) {
      log(`[sw] cache hit ${key}`);
      return cached;
    }
    const result = await resolve(request);
    await deps.cache.set(key, result);
    return result;
  }

  return (request) => {
    const key = lookupCacheKey(request.lang, request.title, request.year);
    const pending = inFlight.get(key);
    if (pending) return pending;
    const promise = lookup(request, key).finally(() => inFlight.delete(key));
    inFlight.set(key, promise);
    return promise;
  };
}
