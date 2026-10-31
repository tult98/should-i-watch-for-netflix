import { describe, expect, it, vi } from 'vitest';
import { createAniListAdapter, plainText, toAnimeInfo } from '../src/background/adapters/AniListAdapter';
import { RequestError, type FetchFn } from '../src/background/requestQueue';
import attackOnTitan from './fixtures/anilist-attack-on-titan.json';
import frieren from './fixtures/anilist-frieren.json';
import onePiece from './fixtures/anilist-one-piece.json';
import spiritedAway from './fixtures/anilist-spirited-away.json';

function respondWith(body: unknown, status = 200) {
  return vi.fn<FetchFn>(async () => new Response(JSON.stringify(body), { status }));
}

describe('AniListAdapter', () => {
  it('posts the title as a GraphQL variable', async () => {
    const fetch = respondWith(attackOnTitan);
    await createAniListAdapter(fetch).search('Attack on Titan: "Junior" High?');
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe('https://graphql.anilist.co');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({ 'Content-Type': 'application/json' });
    const body = JSON.parse(String(init?.body));
    expect(body.variables).toEqual({ q: 'Attack on Titan: "Junior" High?' });
    expect(body.query).toContain('media(search: $q, type: ANIME)');
  });

  it('maps the matched entry to AnimeInfo with a score out of 10 and no votes', async () => {
    const info = await createAniListAdapter(respondWith(attackOnTitan)).search('Attack on Titan');
    expect(info).toMatchObject({
      id: 'mal:16498',
      kind: 'anime',
      title: 'Attack on Titan',
      year: 2013,
      scores: [{ source: 'anilist', value: 8.5 }],
      match: { query: 'Attack on Titan', matchedName: 'Attack on Titan', confidence: 1, source: 'anilist' },
      format: 'TV',
      episodes: 25,
      status: 'Finished Airing',
      members: 1072805,
      season: 'Spring 2013',
      aired: { from: '2013-04-07', to: '2013-09-28' },
    });
    expect(info?.scores[0]).not.toHaveProperty('votes');
    expect(info).not.toHaveProperty('rank');
    expect(info).not.toHaveProperty('popularity');
    expect(info?.studios).toContain('WIT STUDIO');
    expect(info?.synopsis?.lang).toBe('en');
    expect(info?.synopsis?.text).toMatch(/^Several hundred years ago/);
    expect(info?.synopsis?.text).not.toMatch(/<br>/);
  });

  it('matches a localized title through the synonyms', async () => {
    const info = await createAniListAdapter(respondWith(frieren)).search('Frieren – Nach dem Ende der Reise', 2023);
    expect(info).toMatchObject({
      id: 'mal:52991',
      title: 'Frieren: Beyond Journey’s End',
      year: 2023,
      scores: [{ source: 'anilist', value: 9.1 }],
      match: { matchedName: 'Frieren – Nach dem Ende der Reise', confidence: 1 },
    });
  });

  it('separates a season from its parent with the year', async () => {
    const info = await createAniListAdapter(respondWith(frieren)).search('Sousou no Frieren 2nd Season', 2026);
    expect(info).toMatchObject({ id: 'mal:59978', year: 2026 });
  });

  it('keeps a title without a score or an English name', async () => {
    const info = await createAniListAdapter(respondWith(frieren)).search('Sousou no Frieren 3rd Season');
    expect(info).toMatchObject({
      title: 'Sousou no Frieren 3rd Season',
      scores: [],
      status: 'Not yet aired',
      aired: { from: '2027-10', to: undefined },
    });
  });

  it('prefers the entry with the exact year when two share a title', async () => {
    const info = await createAniListAdapter(respondWith(onePiece)).search('One Piece', 1999);
    expect(info).toMatchObject({ id: 'mal:21', status: 'Currently Airing', scores: [{ value: 8.7 }] });
  });

  it('maps MOVIE to the Movie format the IMDb merge looks for', async () => {
    const info = await createAniListAdapter(respondWith(spiritedAway)).search('Spirited Away', 2001);
    expect(info).toMatchObject({ id: 'mal:199', format: 'Movie', episodes: 1 });
  });

  it('returns null when nothing is close enough, or the page is empty', async () => {
    expect(await createAniListAdapter(respondWith(onePiece)).search('Breaking Bad')).toBeNull();
    expect(await createAniListAdapter(respondWith({ data: { Page: { media: [] } } })).search('Nothing')).toBeNull();
  });

  it('falls back to the AniList id when there is no MAL id', () => {
    const info = toAnimeInfo(
      { id: 189513, title: { romaji: 'Sparse Show' } },
      { query: 'Sparse Show', matchedName: 'Sparse Show', confidence: 1 },
    );
    expect(info).toMatchObject({
      id: 'anilist:189513',
      format: 'Unknown',
      status: 'Unknown',
      genres: [],
      studios: [],
      scores: [],
      aired: {},
    });
  });

  it('maps an HTTP error and a GraphQL error to a network RequestError', async () => {
    await expect(createAniListAdapter(respondWith({}, 500)).search('X')).rejects.toBeInstanceOf(RequestError);
    await expect(createAniListAdapter(respondWith({ errors: [{ message: 'boom' }] })).search('X')).rejects.toMatchObject({
      reason: 'network',
    });
  });

  it('strips tags and entities from a description', () => {
    expect(plainText('A<br><br>\nB <i>it</i> &amp; &quot;q&quot;<br>')).toBe('A\n\nB it & "q"');
  });
});
