export const MATCH_THRESHOLD = 0.85;
export const YEAR_BONUS = 0.05;
export const YEAR_PENALTY = 0.2;

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    // Keep the kana voicing marks so "バ" and "ハ" stay distinct; NFC below recomposes them and Hangul.
    .replace(/(?![\u3099\u309A])\p{M}/gu, '')
    .normalize('NFC')
    // NFKD has no decomposition for the Vietnamese "đ", so it would survive as a distinct letter.
    .replace(/đ/g, 'd')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function bigrams(s: string): Map<string, number> {
  const counts = new Map<string, number>();
  const chars = Array.from(s);
  for (let i = 0; i < chars.length - 1; i++) {
    const gram = chars[i]! + chars[i + 1]!;
    counts.set(gram, (counts.get(gram) ?? 0) + 1);
  }
  return counts;
}

function dice(a: string, b: string): number {
  const ga = bigrams(a);
  const gb = bigrams(b);
  let sizeA = 0;
  let sizeB = 0;
  let overlap = 0;
  for (const n of ga.values()) sizeA += n;
  for (const n of gb.values()) sizeB += n;
  if (sizeA === 0 || sizeB === 0) return 0;
  for (const [gram, n] of ga) overlap += Math.min(n, gb.get(gram) ?? 0);
  return (2 * overlap) / (sizeA + sizeB);
}

export function nameSimilarity(query: string, name: string): number {
  const a = normalizeTitle(query);
  const b = normalizeTitle(name);
  if (!a || !b) return 0;
  if (a === b) return 1;
  return dice(a.replace(/ /g, ''), b.replace(/ /g, ''));
}

function yearAdjustment(queryYear: number | undefined, candidateYear: number | undefined): number {
  if (queryYear === undefined || candidateYear === undefined) return 0;
  const diff = Math.abs(queryYear - candidateYear);
  if (diff === 0) return YEAR_BONUS;
  if (diff > 1) return -YEAR_PENALTY;
  return 0;
}

export interface MatchCandidate {
  names: string[];
  year?: number;
  tieBreak: number;
}

export interface Confidence {
  confidence: number;
  matchedName: string;
}

export function matchConfidence(
  query: string,
  queryYear: number | undefined,
  candidate: Pick<MatchCandidate, 'names' | 'year'>,
): Confidence | null {
  let best: Confidence | null = null;
  for (const name of candidate.names) {
    const similarity = nameSimilarity(query, name);
    if (!best || similarity > best.confidence) best = { confidence: similarity, matchedName: name };
  }
  if (!best) return null;
  const adjusted = best.confidence + yearAdjustment(queryYear, candidate.year);
  return { ...best, confidence: Math.min(1, Math.max(0, adjusted)) };
}

export function bestMatch<C extends MatchCandidate>(
  query: string,
  queryYear: number | undefined,
  candidates: readonly C[],
): (Confidence & { candidate: C }) | null {
  let best: (Confidence & { candidate: C }) | null = null;
  for (const candidate of candidates) {
    const score = matchConfidence(query, queryYear, candidate);
    if (!score || score.confidence < MATCH_THRESHOLD) continue;
    if (
      !best ||
      score.confidence > best.confidence ||
      (score.confidence === best.confidence && candidate.tieBreak > best.candidate.tieBreak)
    ) {
      best = { ...score, candidate };
    }
  }
  return best;
}
