import { describe, expect, it, vi } from 'vitest';
import { createJikanAdapter } from '../src/background/adapters/JikanAdapter';
import { RequestError, type FetchFn } from '../src/background/requestQueue';
import attackOnTitan from './fixtures/jikan-attack-on-titan.json';
import irishman from './fixtures/jikan-irishman.json';
import nulls from './fixtures/jikan-nulls.json';
import onePiece from './fixtures/jikan-one-piece.json';

function respondWith(body: unknown, status = 200) {
  return vi.fn<FetchFn>(async () => new Response(JSON.stringify(body), { status }));
}

describe('JikanAdapter', () => {
  it('queries Jikan anime search with the title and limit 5', async () => {
    const fetch = respondWith(attackOnTitan);
    await createJikanAdapter(fetch).search('Attack on Titan: Junior High?');
    expect(fetch).toHaveBeenCalledWith(
      'https://api.jikan.moe/v4/anime?q=Attack%20on%20Titan%3A%20Junior%20High%3F&limit=5',
    );
  });

  it('maps the matched entry to AnimeInfo', async () => {
    const info = await createJikanAdapter(respondWith(attackOnTitan)).search('Attack on Titan');
    expect(info).toEqual({
      id: 'mal:16498',
      kind: 'anime',
      title: 'Shingeki no Kyojin',
      year: 2013,
      synopsis: {
        text: 'Centuries ago, mankind was slaughtered to near extinction by monstrous humanoid creatures called Titans.',
        lang: 'en',
      },
      genres: ['Action', 'Drama', 'Suspense', 'Gore', 'Military', 'Survival'],
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
      aired: { from: '2013-04-07T00:00:00+00:00', to: '2013-09-29T00:00:00+00:00' },
      studios: ['Wit Studio'],
    });
  });

  it('matches through a localized titles[] entry', async () => {
    const info = await createJikanAdapter(respondWith(attackOnTitan)).search("L'Attaque des Titans");
    expect(info?.id).toBe('mal:16498');
    expect(info?.match.matchedName).toBe("L'Attaque des Titans");
  });

  it('matches through a synonym', async () => {
    const info = await createJikanAdapter(respondWith(attackOnTitan)).search('Attack on Titan Season 4');
    expect(info?.id).toBe('mal:40028');
    expect(info?.season).toBe('Winter 2021');
  });

  it('matches the Japanese title', async () => {
    const info = await createJikanAdapter(respondWith(attackOnTitan)).search('進撃の巨人');
    expect(info?.id).toBe('mal:16498');
  });

  it('picks the TV series over a film with the same name', async () => {
    const info = await createJikanAdapter(respondWith(onePiece)).search('One Piece');
    expect(info?.id).toBe('mal:21');
    expect(info?.episodes).toBeUndefined();
    expect(info?.aired).toEqual({ from: '1999-10-20T00:00:00+00:00', to: undefined });
  });

  it('lets the card year pick the film', async () => {
    const info = await createJikanAdapter(respondWith(onePiece)).search('One Piece', 2000);
    expect(info?.id).toBe('mal:459');
    expect(info?.year).toBe(2000);
    expect(info?.season).toBeUndefined();
  });

  it('returns null when nothing passes the threshold', async () => {
    expect(await createJikanAdapter(respondWith(irishman)).search('The Irishman', 2019)).toBeNull();
  });

  it('returns null for an empty result', async () => {
    expect(await createJikanAdapter(respondWith({ data: [] })).search('Anything')).toBeNull();
    expect(await createJikanAdapter(respondWith({ data: null })).search('Anything')).toBeNull();
  });

  it('tolerates null fields', async () => {
    const info = await createJikanAdapter(respondWith(nulls)).search('Sparse Show');
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

  it('throws a network error on a non-OK response', async () => {
    const search = createJikanAdapter(respondWith({}, 503)).search('One Piece');
    await expect(search).rejects.toBeInstanceOf(RequestError);
    await expect(search).rejects.toMatchObject({ reason: 'network' });
  });
});
