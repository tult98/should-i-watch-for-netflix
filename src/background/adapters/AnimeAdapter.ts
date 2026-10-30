import type { AnimeInfo } from '../../shared/types';

export interface AnimeAdapter {
  search(title: string, year?: number): Promise<AnimeInfo | null>;
}

export function present<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined && value !== '';
}
