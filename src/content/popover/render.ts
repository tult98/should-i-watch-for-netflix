import { ageLabel } from '../../shared/ageLabel';
import type { QuickBadge } from '../../shared/quickBadge';
import { locale, strings } from '../../shared/i18n';
import type { AnimeInfo, MovieInfo, Rating, Score, ScoreSource, SeriesInfo, TitleInfo } from '../../shared/types';
import { h, icon, type Child } from './dom';
import { scoreIcon } from './scoreIcons';
import {
  formatAired,
  formatCompact,
  formatCount,
  formatRuntime,
  formatScore,
  formatReleaseDate,
  formatYears,
  kindLabel,
  malStatusLabel,
  seriesStatusLabel,
} from './format';

const t = strings.popover;

const STAR = ['M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z'];
const WARN = ['M12 3l10 18H2z', 'M12 10v5', 'M12 18.5v.01'];
export const SPARKLE = ['M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z'];
const THUMB_UP = ['M7 11v9H3v-9z', 'M7 11l4-8c1.7 0 3 1.3 3 3v4h5.5a2 2 0 0 1 2 2.3l-1.2 7a2 2 0 0 1-2 1.7H7'];
const THUMB_DOWN = ['M17 13V4h4v9z', 'M17 13l-4 8c-1.7 0-3-1.3-3-3v-4H4.5a2 2 0 0 1-2-2.3l1.2-7a2 2 0 0 1 2-1.7H17'];

const MAX_CAST = 3;
const MAX_MAKERS = 2;

interface Cell {
  label: string;
  value: string;
  icon?: SVGSVGElement;
}

function cell(label: string, value: string | undefined, badge?: SVGSVGElement): Cell | null {
  return value === undefined || value === '' ? null : { label, value, icon: badge };
}

function cells(list: (Cell | null)[]): Cell[] {
  return list.filter((c): c is Cell => c !== null);
}

function findScore(info: TitleInfo, source: ScoreSource): Score | undefined {
  return info.scores.find((s) => s.source === source);
}

function joinNames(names: string[], max: number): string | undefined {
  return names.length ? names.slice(0, max).join(', ') : undefined;
}

function topBar(pill: { text: string; cls: string } | null, note: string, badge: QuickBadge | null): HTMLElement {
  return h(
    'div',
    { class: 'top' },
    h('div', { class: 'top-left' }, pill && h('span', { class: `pill ${pill.cls}` }, pill.text), h('span', { class: 'note' }, note)),
    badge?.verdict && h('span', { class: `badge badge-${badge.verdict}` }, strings.verdict[badge.verdict]),
  );
}

function heading(info: TitleInfo, sourceLabel: string): HTMLElement {
  const title = info.year !== undefined ? `${info.title} (${info.year})` : info.title;
  const { matchedName, confidence } = info.match;
  return h(
    'div',
    { class: 'heading' },
    h('h2', { class: 'title' }, title),
    h('div', { class: 'sub' }, t.matched(sourceLabel, matchedName, Math.round(confidence * 100))),
  );
}

function scoreBlock(badge: QuickBadge, sourceName: string | null, votesText: (count: string) => string): HTMLElement | null {
  if (badge.score === null) return null;
  const { votes } = badge.score;
  return h(
    'div',
    { class: 'score' },
    h('div', { class: 'score-main' }, icon(STAR, { size: 26, fill: '#f5c518' }), h('span', { class: 'score-value' }, formatScore(badge.score))),
    h(
      'div',
      { class: 'score-meta' },
      sourceName &&
        badge.source &&
        h('span', { class: 'score-label' }, scoreIcon(badge.source, badge.score.value), h('span', { class: 'score-source' }, sourceName)),
      votes !== undefined && h('span', null, votesText(formatCount(votes))),
    ),
  );
}

function lowVotesWarning(badge: QuickBadge): HTMLElement | null {
  if (!badge.lowVotes) return null;
  return h('div', { class: 'warn' }, icon(WARN, { size: 18, stroke: 'currentColor' }), h('span', null, t.lowVotes));
}

function statsRow(list: Cell[]): HTMLElement | null {
  if (!list.length) return null;
  const row = h(
    'div',
    { class: 'stats' },
    ...list.map((c) =>
      h('div', { class: 'stat' }, h('div', { class: 'stat-head' }, c.icon, h('span', { class: 'label' }, c.label)), h('span', { class: 'stat-value' }, c.value)),
    ),
  );
  // A lone cell takes half the row, not all of it.
  row.style.setProperty('--cols', String(list.length === 4 ? 2 : Math.max(list.length, 2)));
  return row;
}

export interface PopoverHooks {
  onAi?: () => void;
  onRate?: (clicked: Rating) => void;
}

function synopsisBlock(info: TitleInfo, foreignLabel: string): HTMLElement | null {
  const synopsis = info.synopsis;
  if (!synopsis?.text.trim()) return null;
  const foreign = synopsis.lang !== locale;
  return h(
    'div',
    { class: 'section synopsis-section' },
    h('span', { class: 'label' }, foreign ? foreignLabel : t.synopsis),
    h('p', { class: foreign ? 'synopsis synopsis-en' : 'synopsis' }, synopsis.text),
  );
}

function field(c: Cell): HTMLElement {
  return h('div', { class: 'field' }, h('span', { class: 'label' }, c.label), h('span', { class: 'field-value' }, c.value));
}

function fieldGrid(list: Cell[], cls: string): HTMLElement | null {
  return list.length ? h('div', { class: cls }, ...list.map(field)) : null;
}

function timeRow(label: string, value: string | undefined, age: string | undefined): HTMLElement | null {
  if (!value) return null;
  return h(
    'div',
    { class: 'section' },
    h('span', { class: 'label' }, label),
    h('div', { class: 'row' }, h('span', { class: 'field-value' }, value), age && h('span', { class: 'age' }, age)),
  );
}

function chips(genres: string[], outlined?: string): HTMLElement | null {
  if (!genres.length && !outlined) return null;
  return h(
    'div',
    { class: 'chips' },
    ...genres.map((g) => h('span', { class: 'chip' }, g)),
    outlined && h('span', { class: 'chip chip-outline' }, outlined),
  );
}

function aiSlot(): HTMLElement {
  return h('div', { class: 'ai-slot' });
}

function rateButton(info: TitleInfo, rating: Rating, label: string, paths: string[], hooks: PopoverHooks): HTMLElement {
  return h(
    'button',
    {
      type: 'button',
      class: 'btn btn-icon btn-rate',
      'data-rating': rating,
      'aria-label': label,
      'aria-pressed': 'false',
      onclick: () => {
        console.log(`[popover] rate ${rating} ${info.id}`);
        hooks.onRate?.(rating);
      },
    },
    icon(paths, { size: 20, stroke: 'currentColor' }),
  );
}

function actions(info: TitleInfo, hooks: PopoverHooks): HTMLElement {
  const anime = info.kind === 'anime';
  return h(
    'div',
    { class: 'actions' },
    h(
      'button',
      {
        type: 'button',
        class: 'btn btn-ai',
        onclick: () => {
          console.log(`[popover] ai ${info.id}`);
          hooks.onAi?.();
        },
      },
      icon(SPARKLE, { size: 16, stroke: 'currentColor' }),
      h('span', { class: 'btn-ai-label' }, t.ai),
    ),
    rateButton(info, 'up', anime ? t.likeAnime : t.likeTitle, THUMB_UP, hooks),
    rateButton(info, 'down', anime ? t.dislikeAnime : t.dislikeTitle, THUMB_DOWN, hooks),
  );
}

function shell(top: HTMLElement, sections: Child[]): HTMLElement {
  return h('div', { class: 'pop' }, top, h('div', { class: 'body' }, ...sections));
}

function renderAnime(info: AnimeInfo, badge: QuickBadge, now: Date, hooks: PopoverHooks): HTMLElement {
  const imdb = findScore(info, 'imdb');
  const stats = cells([
    cell(t.ranked, info.rank !== undefined ? `#${formatCount(info.rank)}` : undefined),
    cell(t.popularity, info.popularity !== undefined ? `#${formatCount(info.popularity)}` : undefined),
    cell(t.members, info.members !== undefined ? formatCompact(info.members) : undefined),
    cell(t.imdb, imdb && formatScore(imdb), imdb && scoreIcon('imdb', imdb.value)),
  ]);
  const meta = cells([
    cell(t.type, info.format === 'Unknown' ? undefined : info.format),
    cell(t.episodes, info.episodes !== undefined ? String(info.episodes) : undefined),
    cell(t.status, malStatusLabel(info.status)),
    cell(t.season, info.season),
  ]);
  const aired = formatAired(info.aired, info.status === 'Currently Airing');
  const anilist = info.match.source === 'anilist';
  const pill = anilist ? { text: t.anilistName, cls: 'pill-anilist' } : { text: t.malPill, cls: 'pill-mal' };
  return shell(topBar(pill, anilist ? t.anilistName : t.malName, badge), [
    heading(info, pill.text),
    scoreBlock(badge, badge.source && t.sourceName[badge.source], t.animeVotes),
    lowVotesWarning(badge),
    statsRow(stats),
    synopsisBlock(info, anilist ? t.synopsisAniListEn : t.synopsisMalEn),
    aiSlot(),
    fieldGrid(meta, 'meta'),
    timeRow(t.aired, aired, ageLabel(info.year, now)),
    chips(info.genres, info.demographic),
    actions(info, hooks),
  ]);
}

function filmStats(info: MovieInfo | SeriesInfo, badge: QuickBadge): Cell[] {
  const order: ScoreSource[] = info.kind === 'movie' ? ['imdb', 'rt', 'metacritic'] : ['imdb', 'rt', 'tmdb'];
  const labels: Record<ScoreSource, string> = { mal: t.malPill, anilist: t.anilistName, imdb: t.imdb, rt: t.rt, metacritic: t.metacritic, tmdb: t.tmdb };
  return cells(
    order
      .filter((source) => source !== badge.source)
      .map((source) => {
        const score = findScore(info, source);
        return cell(labels[source], score && formatScore(score), score && scoreIcon(source, score.value));
      }),
  );
}

function filmMeta(info: MovieInfo | SeriesInfo): Cell[] {
  if (info.kind === 'movie') {
    return cells([
      cell(t.type, kindLabel('movie')),
      cell(t.runtime, info.runtimeMin ? formatRuntime(info.runtimeMin) : undefined),
      cell(t.certification, info.certification),
    ]);
  }
  return cells([
    cell(t.type, kindLabel('series')),
    cell(t.seasons, info.seasons !== undefined ? String(info.seasons) : undefined),
    cell(t.episodes, info.episodes !== undefined ? String(info.episodes) : undefined),
    cell(t.status, seriesStatusLabel(info.status)),
    cell(t.certification, info.certification),
  ]);
}

function filmTime(info: MovieInfo | SeriesInfo, now: Date): HTMLElement | null {
  const age = ageLabel(info.year, now);
  if (info.kind === 'movie') {
    const released = formatReleaseDate(info.releaseDate) ?? (info.year !== undefined ? String(info.year) : undefined);
    return timeRow(t.released, released, age);
  }
  return timeRow(t.aired, formatYears(info.startYear ?? info.year, info.endYear, info.status === 'ongoing'), age);
}

function filmCredits(info: MovieInfo | SeriesInfo): Cell[] {
  const makers = info.kind === 'movie' ? info.directors : info.creators;
  return cells([
    cell(info.kind === 'movie' ? t.director : t.creator, joinNames(makers, MAX_MAKERS)),
    cell(t.cast, joinNames(info.cast, MAX_CAST)),
  ]);
}

function renderFilm(info: MovieInfo | SeriesInfo, badge: QuickBadge, now: Date, hooks: PopoverHooks): HTMLElement {
  const sourceName = badge.source && t.sourceName[badge.source];
  const pill =
    info.match.source === 'cinemeta' ? { text: t.cinemetaPill, cls: 'pill-cinemeta' } : { text: t.tmdbPill, cls: 'pill-tmdb' };
  return shell(topBar(pill, kindLabel(info.kind), badge), [
    heading(info, pill.text),
    scoreBlock(badge, sourceName, t.filmVotes),
    lowVotesWarning(badge),
    statsRow(filmStats(info, badge)),
    synopsisBlock(info, t.synopsisEn),
    aiSlot(),
    fieldGrid(filmMeta(info), 'meta'),
    filmTime(info, now),
    fieldGrid(filmCredits(info), 'credits'),
    chips(info.genres),
    actions(info, hooks),
  ]);
}

export function renderTitle(info: TitleInfo, badge: QuickBadge, now: Date, hooks: PopoverHooks = {}): HTMLElement {
  return info.kind === 'anime' ? renderAnime(info, badge, now, hooks) : renderFilm(info, badge, now, hooks);
}

function sk(cls: string, width?: string): HTMLElement {
  const el = h('div', { class: `sk ${cls}` });
  if (width) el.style.width = width;
  return el;
}

export function renderLoading(): HTMLElement {
  return h(
    'div',
    { class: 'pop', 'aria-busy': 'true' },
    topBar(null, t.loading, null),
    h(
      'div',
      { class: 'skeleton' },
      sk('sk-strong', '70%'),
      sk('', '45%'),
      h('div', { class: 'sk-score' }, sk('sk-strong sk-btn', '84px'), sk('', '120px')),
      h('div', { class: 'sk-grid' }, sk('sk-box'), sk('sk-box'), sk('sk-box')),
      sk('', '100%'),
      sk('', '92%'),
      sk('', '60%'),
      h('div', { class: 'sk-actions' }, sk('sk-strong sk-btn sk-grow'), sk('sk-box sk-btn', '44px'), sk('sk-box sk-btn', '44px')),
    ),
  );
}
