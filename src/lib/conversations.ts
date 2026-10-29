import type { ConversationSummary, MessageDTO } from "@/types/sms";

export function buildConversations(
  messages: MessageDTO[]
): ConversationSummary[] {
  const map = new Map<string, ConversationSummary>();

  for (const message of messages) {
    const peer = message.peer;
    const existing = map.get(peer);
    const unreadInc =
      message.direction === "inbound" && !message.read ? 1 : 0;

    if (!existing) {
      map.set(peer, {
        peer,
        lastText: message.text,
        lastDate: message.date,
        unreadCount: unreadInc,
      });
      continue;
    }

    if (new Date(message.date) >= new Date(existing.lastDate)) {
      existing.lastText = message.text;
      existing.lastDate = message.date;
    }
    existing.unreadCount += unreadInc;
  }

  return Array.from(map.values()).sort(
    (a, b) => new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime()
  );
}

export function upsertMessage(
  messages: MessageDTO[],
  incoming: MessageDTO
): MessageDTO[] {
  const idx = messages.findIndex((m) => m.id === incoming.id);
  if (idx === -1) {
    return [...messages, incoming].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }
  const next = [...messages];
  next[idx] = incoming;
  return next;
}
