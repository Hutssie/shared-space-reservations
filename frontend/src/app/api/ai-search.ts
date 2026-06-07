import { apiPost } from './client';
import type { Space } from './spaces';

export interface AIChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AISearchMeta {
  resultType: 'clarify' | 'exact' | 'close' | 'none';
  knownFilters: Record<string, unknown>;
  missingForCards?: string[];
  suggestFollowUp: boolean;
  missingRefinements?: string[];
}

export interface AIChatResponse {
  message: string;
  spaces?: Space[];
  followUp?: string;
  searchMeta?: AISearchMeta;
  bookingPrefill?: {
    date?: string | null;
    startTime?: string | null;
    endTime?: string | null;
  };
}

export function chatWithAI(messages: AIChatMessage[]): Promise<AIChatResponse> {
  return apiPost<AIChatResponse>('/api/ai-search/chat', { messages });
}
