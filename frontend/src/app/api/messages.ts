import { apiGet, apiPost } from './client';

export type ConversationSummary = {
  id: string;
  user: string;
  role: string;
  avatar: string | null;
  online: boolean;
  lastMessage: string;
  time: string;
  unread: boolean;
  lastMessageAt?: string | null;
};

export type ChatMessage = {
  id: string;
  type: 'sent' | 'received';
  text: string;
  time: string;
  createdAt?: string;
};

export async function fetchConversations(): Promise<ConversationSummary[]> {
  const res = await apiGet<{ conversations: ConversationSummary[] }>('/api/messages/conversations');
  return res.conversations;
}

export async function createOrGetConversation(otherUserId: string): Promise<ConversationSummary> {
  const res = await apiPost<{ conversation: ConversationSummary }>('/api/messages/conversations', { otherUserId });
  return res.conversation;
}

export async function fetchMessages(
  conversationId: string,
  opts: { cursor?: string; limit?: number } = {}
): Promise<{ messages: ChatMessage[]; nextCursor: string | null; otherParticipantLastReadAt: string | null }> {
  const qs = new URLSearchParams();
  if (opts.cursor) qs.set('cursor', opts.cursor);
  if (opts.limit) qs.set('limit', String(opts.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiGet<{ messages: ChatMessage[]; nextCursor: string | null; otherParticipantLastReadAt: string | null }>(
    `/api/messages/conversations/${conversationId}/messages${suffix}`
  );
}

export async function sendMessage(conversationId: string, text: string): Promise<{ id: string }> {
  return apiPost<{ id: string }>(`/api/messages/conversations/${conversationId}/messages`, { text });
}

export async function markConversationRead(conversationId: string): Promise<{ success: true }> {
  return apiPost<{ success: true }>(`/api/messages/conversations/${conversationId}/read`);
}

export async function deleteConversationForMe(conversationId: string): Promise<{ success: true }> {
  return apiPost<{ success: true }>(`/api/messages/conversations/${conversationId}/delete`);
}

export type MessageStreamEvent =
  | { event: 'ready' }
  | { event: 'ping'; data?: unknown }
  | { event: 'message.created'; data: { conversationId: string; message: { id: string; senderId: string; text: string; createdAt: string } } }
  | { event: 'conversation.read'; data: { conversationId: string; lastReadAt: string } }
  | { event: 'conversation.updated'; data: { conversationId: string } };

function getToken(): string | null {
  return localStorage.getItem('token');
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export function subscribeToMessageStream(onEvent: (evt: MessageStreamEvent) => void): () => void {
  const token = getToken();
  if (!token) return () => {};

  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch(`${API_BASE}/api/messages/stream`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      });
      if (!res.ok || !res.body) return;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const emit = (event: string, dataRaw: string | null) => {
        if (event === 'ready') {
          onEvent({ event: 'ready' });
          return;
        }
        if (event === 'ping') {
          onEvent({ event: 'ping' });
          return;
        }
        if (!dataRaw) return;
        try {
          const data = JSON.parse(dataRaw);
          if (event === 'message.created') onEvent({ event: 'message.created', data });
          else if (event === 'conversation.read') onEvent({ event: 'conversation.read', data });
          else if (event === 'conversation.updated') onEvent({ event: 'conversation.updated', data });
        } catch {
          // ignor payload-uri malformed
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // evenimentele SSE sunt separate printr-o linie goala
        while (true) {
          const idx = buffer.indexOf('\n\n');
          if (idx === -1) break;
          const rawEvent = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);

          const lines = rawEvent.split('\n').map((l) => l.trimEnd());
          let eventName = '';
          let dataLine: string | null = null;
          for (const line of lines) {
            if (line.startsWith('event:')) eventName = line.slice('event:'.length).trim();
            if (line.startsWith('data:')) dataLine = line.slice('data:'.length).trim();
          }
          if (eventName) emit(eventName, dataLine);
        }
      }
    } catch {
      // ignor
    }
  })();

  return () => controller.abort();
}

