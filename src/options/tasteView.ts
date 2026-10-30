import type { TasteProfile } from '../background/taste/tasteProfile';
import { h } from '../content/popover/dom';
import { strings } from '../shared/strings.vi';

const t = strings.options;

export interface Tile {
  label: string;
  value: string;
  note: string;
}

export function tasteTiles(profile: TasteProfile): Tile[] {
  const { up, down } = profile.count;
  const kind = t.kindLower[profile.kind];
  const minutes = profile.kind === 'movie';
  const unit = minutes ? t.unitMinutes : t.unitEpisodes;
  const length: Tile =
    profile.preferredLength !== undefined
      ? {
          label: minutes ? t.tasteLengthMinutes : t.tasteLengthEpisodes,
          value: t.tasteLengthValue(profile.preferredLength, unit),
          note: t.tasteLengthNote(kind),
        }
      : { label: minutes ? t.tasteLengthMinutes : t.tasteLengthEpisodes, value: t.notEnough, note: t.tasteLengthNeed(unit) };
  const era: Tile = profile.era
    ? { label: t.tasteEra, value: t.era[profile.era], note: t.eraNote[profile.era](kind) }
    : { label: t.tasteEra, value: t.notEnough, note: t.eraNeed };
  return [{ label: t.tasteRated, value: String(up + down), note: t.tasteCounts(up, down) }, length, era];
}

function tile({ label, value, note }: Tile): HTMLElement {
  return h(
    'div',
    { class: 'tile' },
    h('span', { class: 'tile-label' }, label),
    h('span', { class: 'tile-value' }, value),
    h('span', { class: 'tile-note' }, note),
  );
}

function chipRow(genres: string[], cls: string): HTMLElement {
  if (!genres.length) return h('div', { class: 'chips' }, h('span', { class: 'chips-empty' }, t.noGenres));
  return h('div', { class: 'chips' }, ...genres.map((g) => h('span', { class: `chip ${cls}` }, g)));
}

export function renderTasteBody(profile: TasteProfile): HTMLElement {
  return h(
    'div',
    { class: 'taste-body' },
    h('div', { class: 'tiles' }, ...tasteTiles(profile).map(tile)),
    h(
      'div',
      { class: 'genres' },
      h('span', { class: 'genres-label' }, t.likedGenres),
      chipRow(profile.likedGenres, 'chip-liked'),
      h('span', { class: 'genres-label genres-label-gap' }, t.dislikedGenres),
      chipRow(profile.dislikedGenres, 'chip-disliked'),
    ),
  );
}
