export type PendingChatOpen = {
  chatId: string;
  messageId?: string;
};

let pending: PendingChatOpen | null = null;
const listeners = new Set<() => void>();

function notifyPendingChatOpen() {
  for (const listener of listeners) {
    try {
      listener();
    } catch {}
  }
}

/** Chat to open after navigating to the Synq tab (e.g. from a push notification). */
export function setPendingChatOpen(chatId: string, messageId?: string) {
  pending = { chatId, messageId };
  notifyPendingChatOpen();
}

export function consumePendingChatOpen(): PendingChatOpen | null {
  const value = pending;
  pending = null;
  return value;
}

export function subscribePendingChatOpen(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
