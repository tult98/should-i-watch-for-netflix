import { describe, expect, it, vi } from 'vitest';
import { createOmdbAdapter, toScores } from '../src/background/adapters/OmdbAdapter';
import { RequestError, type FetchFn } from '../src/background/requestQueue';
import irishman from './fixtures/omdb-irishman.json';
import invalidKey from './fixtures/omdb-invalid-key.json';
import limit from './fixtures/omdb-limit.json';
import na from './fixtures/omdb-na.json';

function respondWith(body: unknown, status = 200) {
  return vi.fn<FetchFn>(async () => new Response(JSON.stringify(body), { status }));
}

describe('OmdbAdapter', () => {
  it('requests by IMDb id and maps IMDb, RT and Metacritic', async () => {
    const fetch = respondWith(irishman);
    const result = await createOmdbAdapter(fetch, 'k&1').scores('tt1302006');
    expect(fetch).toHaveBeenCalledWith('https://www.omdbapi.com/?i=tt1302006&apikey=k%261');
    expect(result).toEqual({
      status: 'ok',
      scores: [
        { source: 'imdb', value: 7.8, votes: 1234567 },
        { source: 'rt', value: 95 },
        { source: 'metacritic', value: 94 },
      ],
    });
  });

  it('drops N/A values', async () => {
    expect(await createOmdbAdapter(respondWith(na), 'k').scores('tt0000001')).toEqual({ status: 'ok', scores: [] });
  });

  it('falls back to the Ratings list and keeps a rating without votes', () => {
    expect(
      toScores({
        imdbRating: 'N/A',
        imdbVotes: 'N/A',
        Ratings: [
          { Source: 'Internet Movie Database', Value: '6.1/10' },
          { Source: 'Metacritic', Value: '55/100' },
        ],
      }),
    ).toEqual([
      { source: 'imdb', value: 6.1 },
      { source: 'metacritic', value: 55 },
    ]);
  });

  it('skips on an invalid key, even with HTTP 401', async () => {
    expect(await createOmdbAdapter(respondWith(invalidKey, 401), 'bad').scores('tt1')).toEqual({
      status: 'skipped',
      reason: 'bad_omdb_key',
    });
  });

  it('skips when the daily limit is reached', async () => {
    expect(await createOmdbAdapter(respondWith(limit, 401), 'k').scores('tt1')).toEqual({
      status: 'skipped',
      reason: 'limit_reached',
    });
  });

  it('skips on an unknown id, a network failure, a 429, or a non-JSON body', async () => {
    const notFound = respondWith({ Response: 'False', Error: 'Incorrect IMDb ID.' });
    expect(await createOmdbAdapter(notFound, 'k').scores('x')).toEqual({ status: 'skipped', reason: 'not_found' });
    const down = vi.fn<FetchFn>(async () => {
      throw new RequestError('network');
    });
    expect(await createOmdbAdapter(down, 'k').scores('tt1')).toEqual({ status: 'skipped', reason: 'network' });
    const limited = vi.fn<FetchFn>(async () => {
      throw new RequestError('rate_limited');
    });
    expect(await createOmdbAdapter(limited, 'k').scores('tt1')).toEqual({ status: 'skipped', reason: 'rate_limited' });
    const html = vi.fn<FetchFn>(async () => new Response('<html>', { status: 503 }));
    expect(await createOmdbAdapter(html, 'k').scores('tt1')).toEqual({ status: 'skipped', reason: 'network' });
  });
});
