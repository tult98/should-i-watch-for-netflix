import type { Kind } from '../../shared/types';

export interface TasteProfile {
  kind: Kind;
  version: number;
  count: { up: number; down: number };
  likedGenres: string[];
  dislikedGenres: string[];
  preferredLength?: number;
  era?: 'new' | 'old' | 'mixed';
}

export async function getTasteProfile(kind: Kind): Promise<TasteProfile> {
  return { kind, version: 0, count: { up: 0, down: 0 }, likedGenres: [], dislikedGenres: [] };
}
