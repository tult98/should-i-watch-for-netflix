import { describe, expect, it, vi } from 'vitest';
import {
  MAL_FIELDS,
  canUseMalOfficial,
  createMalOfficialAdapter,
} from '../src/background/adapters/MalOfficialAdapter';
import { RequestError, type FetchFn } from '../src/background/requestQueue';
import attackOnTitan from './fixtures/mal-official-attack-on-titan.json';
import sparse from './fixtures/mal-official-sparse.json';

function respondWith(body: unknown, status = 200) {
  return vi.fn<FetchFn>(async () => new Response(JSON.stringify(body), { status }));
}

function adapter(fetch: FetchFn) {
  return createMalOfficialAdapter(fetch, 'client-123');
}

describe('MalOfficialAdapter', () => {
  it('queries MAL v2 anime search with the client id header', async () => {
    const fetch = respondWith(attackOnTitan);
    await adapter(fetch).search('Attack on Titan?');
    expect(fetch).toHaveBeenCalledWith(
      `https://api.myanimelist.net/v2/anime?q=Attack%20on%20Titan%3F&limit=5&fields=${MAL_FIELDS}`,
      { headers: { 'X-MAL-CLIENT-ID': 'client-123' } },
    );
    expect(MAL_FIELDS).toBe(
      'id,title,alternative_titles,start_date,end_date,synopsis,mean,rank,popularity,num_list_users,num_scoring_users,media_type,status,genres,num_episodes,start_season,studios',
    );
  });

  it('maps the matched node to the same AnimeInfo shape as Jikan', async () => {
    const info = await adapter(respondWith(attackOnTitan)).search('Attack on Titan');
    expect(info).toEqual({
      id: 'mal:16498',
      kind: 'anime',
      title: 'Shingeki no Kyojin',
      year: 2013,
      synopsis: {
        text: 'Centuries ago, mankind was slaughtered to near extinction by monstrous humanoid creatures called Titans.',
        lang: 'en',
      },
      genres: ['Action', 'Award Winning', 'Drama', 'Gore', 'Military', 'Suspense'],
      scores: [{ source: 'mal', value: 8.55, votes: 2900000 }],
      match: { query: 'Attack on Titan', matchedName: 'Attack on Titan', confidence: 1, source: 'mal' },
      format: 'TV',
      episodes: 25,
      status: 'Finished Airing',
      demographic: 'Shounen',
      rank: 117,
      popularity: 1,
      members: 4100000,
      season: 'Spring 2013',
      aired: { from: '2013-04-07', to: '2013-09-29' },
      studios: ['Wit Studio'],
    });
  });

  it('matches through a synonym and the Japanese title', async () => {
    const season4 = await adapter(respondWith(attackOnTitan)).search('Attack on Titan Season 4');
    expect(season4?.id).toBe('mal:40028');
    expect(season4?.season).toBe('Winter 2021');
    const japanese = await adapter(respondWith(attackOnTitan)).search('進撃の巨人');
    expect(japanese?.id).toBe('mal:16498');
  });

  it('maps an OVA with missing fields', async () => {
    const info = await adapter(respondWith(attackOnTitan)).search('Attack on Titan OVA');
    expect(info).toMatchObject({
      id: 'mal:18397',
      format: 'OVA',
      year: 2013,
      season: undefined,
      scores: [],
      genres: [],
      demographic: undefined,
      studios: [],
      aired: { from: '2013-12-09', to: undefined },
    });
  });

  it('tolerates a node with only id and title', async () => {
    const info = await adapter(respondWith(sparse)).search('Sparse Show');
    expect(info).toEqual({
      id: 'mal:1',
      kind: 'anime',
      title: 'Sparse Show',
      year: undefined,
      synopsis: undefined,
      genres: [],
      scores: [],
      match: { query: 'Sparse Show', matchedName: 'Sparse Show', confidence: 1, source: 'mal' },
      format: 'Unknown',
      episodes: undefined,
      status: 'Unknown',
      demographic: undefined,
      rank: undefined,
      popularity: undefined,
      members: undefined,
      season: undefined,
      aired: { from: undefined, to: undefined },
      studios: [],
    });
  });

  it('reads the year from start_date and treats 0 episodes as unknown', async () => {
    const info = await adapter(respondWith(sparse)).search('Upcoming Film');
    expect(info).toMatchObject({
      year: 2027,
      format: 'Movie',
      status: 'Not yet aired',
      episodes: undefined,
      demographic: 'Kids',
      genres: ['Comedy'],
    });
  });

  it('returns null when nothing passes the threshold or data is empty', async () => {
    expect(await adapter(respondWith(attackOnTitan)).search('The Irishman')).toBeNull();
    expect(await adapter(respondWith({ data: [] })).search('Anything')).toBeNull();
    expect(await adapter(respondWith({})).search('Anything')).toBeNull();
  });

  it('reports 401 and 403 as a bad client id', async () => {
    for (const status of [401, 403]) {
      const search = adapter(respondWith({ error: 'invalid_client' }, status)).search('One Piece');
      await expect(search).rejects.toBeInstanceOf(RequestError);
      await expect(search).rejects.toMatchObject({ reason: 'bad_mal_client_id' });
    }
  });

  it('reports other non-OK responses as network errors', async () => {
    await expect(adapter(respondWith({}, 500)).search('One Piece')).rejects.toMatchObject({ reason: 'network' });
  });
});

describe('canUseMalOfficial', () => {
  it('needs at least 3 characters after trimming', () => {
    expect(canUseMalOfficial('K')).toBe(false);
    expect(canUseMalOfficial(' 86 ')).toBe(false);
    expect(canUseMalOfficial('Ran')).toBe(true);
    expect(canUseMalOfficial('進撃の')).toBe(true);
  });
});
