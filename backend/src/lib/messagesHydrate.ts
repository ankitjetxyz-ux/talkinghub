import { db } from "../db.js";
import type { Message, MessageReaction } from "../types.js";

export function hydrateMessagesReactions(messages: Message[]): Message[] {
  if (messages.length === 0) return messages;
  const ids = [...new Set(messages.map((m) => m.id))];
  const placeholders = ids.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT message_id, user_id, emoji FROM message_reactions
       WHERE message_id IN (${placeholders})`,
    )
    .all(...ids) as { message_id: string; user_id: string; emoji: string }[];

  const byMsg = new Map<string, MessageReaction[]>();
  for (const id of ids) byMsg.set(id, []);
  for (const r of rows) {
    const arr = byMsg.get(r.message_id);
    if (arr) arr.push({ user_id: r.user_id, emoji: r.emoji });
  }

  return messages.map((m) => ({ ...m, reactions: [...(byMsg.get(m.id) ?? [])] }));
}

export function getReactionsForMessage(messageId: string): MessageReaction[] {
  return db
    .prepare(
      "SELECT user_id, emoji FROM message_reactions WHERE message_id = ? ORDER BY created_at ASC",
    )
    .all(messageId) as MessageReaction[];
}
