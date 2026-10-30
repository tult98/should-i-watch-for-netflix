import type { QuickBadge } from '../../shared/quickBadge';
import type { AIErrorReason, AIOpinion, TitleInfo } from '../../shared/types';
import type { TasteProfile } from '../taste/tasteProfile';

export type { AIErrorReason, AIOpinion };

export interface OpinionInput {
  info: TitleInfo;
  taste: TasteProfile;
  badge: QuickBadge;
  needSummary: boolean;
}

export interface AIProvider {
  id: string;
  opinion(input: OpinionInput): Promise<AIOpinion>;
}

export class AIError extends Error {
  constructor(readonly reason: AIErrorReason, message?: string) {
    super(message ?? reason);
    this.name = 'AIError';
  }
}
