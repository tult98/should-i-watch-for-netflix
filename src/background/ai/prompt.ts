import type { OpinionInput } from './AIProvider';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const EXAMPLE = JSON.stringify({
  summary_vi: '<2 to 3 sentences in Vietnamese>',
  verdict: 'recommended',
  reason_vi: '<2 to 3 sentences in Vietnamese>',
});

const SUMMARY_WRITE =
  'summary_vi: a spoiler-free Vietnamese summary of title.synopsis in 2 to 3 sentences. ' +
  'If the synopsis is missing, summarise what the title is about from what you know, without spoilers.';

const SUMMARY_COPY =
  'summary_vi: copy title.synopsis.text exactly as given, unchanged. It is already a Vietnamese overview.';

export function systemPrompt(needSummary: boolean): string {
  return [
    'You are a viewing advisor for a Vietnamese Netflix user deciding whether to watch a title.',
    'Reply with ONLY one json object and nothing else, no markdown fences, shaped exactly like this example:',
    EXAMPLE,
    'Fields:',
    needSummary ? SUMMARY_WRITE : SUMMARY_COPY,
    'verdict: exactly one of "highly_recommended", "recommended", "maybe", "skip".',
    'reason_vi: 2 to 3 sentences in Vietnamese that weigh the scores and vote counts against the taste profile. ' +
      'quick_badge is a rule-based verdict from score thresholds alone; you may differ from it when the taste profile gives a reason.',
    'If taste_profile.count.up and taste_profile.count.down are both 0, the user has not rated anything yet: ' +
      'judge from the scores and do not claim to know their taste.',
    'All text values must be in Vietnamese. Keep proper names as they are.',
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

export function buildMessages(input: OpinionInput): ChatMessage[] {
  return [
    { role: 'system', content: systemPrompt(input.needSummary) },
    { role: 'user', content: userPayload(input) },
  ];
}

export function correctionMessage(error: string): string {
  return `That reply was rejected: ${error}. Reply again with ONLY the json object in the exact shape of the example.`;
}
