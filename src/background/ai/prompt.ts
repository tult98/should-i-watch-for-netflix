import { locale, type Locale } from '../../shared/i18n';
import type { OpinionInput } from './AIProvider';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const LANGUAGE: Record<Locale, string> = { vi: 'Vietnamese', en: 'English' };
const READER: Record<Locale, string> = { vi: 'a Vietnamese Netflix user', en: 'an English-speaking Netflix user' };

function example(language: string): string {
  return JSON.stringify({
    summary_vi: `<2 to 3 sentences in ${language}>`,
    verdict: 'recommended',
    reason_vi: `<2 to 3 sentences in ${language}>`,
  });
}

function summaryWrite(language: string): string {
  return (
    `summary_vi: a spoiler-free ${language} summary of title.synopsis in 2 to 3 sentences. ` +
    'If the synopsis is missing, summarise what the title is about from what you know, without spoilers.'
  );
}

function summaryCopy(language: string): string {
  return `summary_vi: copy title.synopsis.text exactly as given, unchanged. It is already an overview in ${language}.`;
}

export function systemPrompt(needSummary: boolean, loc: Locale = locale): string {
  const language = LANGUAGE[loc];
  return [
    `You are a viewing advisor for ${READER[loc]} deciding whether to watch a title.`,
    'Reply with ONLY one json object and nothing else, no markdown fences, shaped exactly like this example:',
    example(language),
    'Fields:',
    needSummary ? summaryWrite(language) : summaryCopy(language),
    'verdict: exactly one of "highly_recommended", "recommended", "maybe", "skip".',
    `reason_vi: 2 to 3 sentences in ${language} that weigh the scores and vote counts against the taste profile. ` +
      'quick_badge is a rule-based verdict from score thresholds alone; you may differ from it when the taste profile gives a reason.',
    'A score with no votes field comes from a source that does not publish a vote count. Treat the count as unknown, never as zero or as few votes.',
    'If taste_profile.count.up and taste_profile.count.down are both 0, the user has not rated anything yet: ' +
      'judge from the scores and do not claim to know their taste.',
    `The _vi suffix in summary_vi and reason_vi is a legacy name. Write both values in ${language}.`,
    `All text values must be in ${language}. Keep proper names as they are.`,
  ].join('\n');
}

export function userPayload({ info, taste, badge }: OpinionInput): string {
  const { match: _match, id: _id, ...title } = info;
  const quick_badge = badge.verdict && {
    verdict: badge.verdict,
    source: badge.source,
    score: badge.score.value,
    votes: badge.score.votes,
    low_votes: badge.lowVotes,
  };
  const { kind: _kind, version: _version, ...taste_profile } = taste;
  return JSON.stringify({ title, quick_badge, taste_profile });
}

export function buildMessages(input: OpinionInput, loc: Locale = locale): ChatMessage[] {
  return [
    { role: 'system', content: systemPrompt(input.needSummary, loc) },
    { role: 'user', content: userPayload(input) },
  ];
}

export function correctionMessage(error: string): string {
  return `That reply was rejected: ${error}. Reply again with ONLY the json object in the exact shape of the example.`;
}
