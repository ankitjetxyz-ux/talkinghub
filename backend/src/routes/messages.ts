import { Router } from "express";
import { v4 as uuid } from "uuid";
import { db } from "../db.js";
import { requireAuth } from "../auth.js";
import { formatMessage } from "../lib/formatMessage.js";
import { buildNotificationPayload } from "../lib/notificationTemplates.js";
import type { Message } from "../types.js";
import { notifyConversationMembers } from "../ws.js";
import { getReactionsForMessage } from "../lib/messagesHydrate.js";

const router = Router();

router.use(requireAuth);

function isMember(conversationId: string, userId: string): boolean {
  const row = db
    .prepare(
      "SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?",
    )
    .get(conversationId, userId);
  return Boolean(row);
}

function memberIds(conversationId: string): string[] {
  const rows = db
    .prepare("SELECT user_id FROM conversation_members WHERE conversation_id = ?")
    .all(conversationId) as { user_id: string }[];
  return rows.map((r) => r.user_id);
}

function normalizeEmoji(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim().replace(/\s+/g, "");
  if (!t || t.length > 16) return null;
  if (/[<>'"&\\]/.test(t)) return null;
  if (/[\u0000-\u001f]/.test(t)) return null;
  return t;
}

router.post("/", (req, res) => {
  const userId = req.user!.id;
  const { conversation_id, content, media_url, media_type } = req.body as {
    conversation_id?: string;
    content?: string;
    media_url?: string | null;
    media_type?: string | null;
  };

  if (!conversation_id) {
    res.status(400).json({ error: "conversation_id required" });
    return;
  }

  if (!isMember(conversation_id, userId)) {
    res.status(403).json({ error: "Not a member of this conversation" });
    return;
  }

  const original = (content ?? "").trim();
  if (!original && !media_url) {
    res.status(400).json({ error: "Message content or media required" });
    return;
  }

  const displayOriginal = original || (media_type?.startsWith("video") ? "[video]" : "[media]");
  const formatted = original ? formatMessage(original) : formatMessage(displayOriginal);

  const id = uuid();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO messages (id, conversation_id, sender_id, content, original_message, media_url, media_type, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, conversation_id, userId, formatted, displayOriginal, media_url ?? null, media_type ?? null, now);

  db.prepare("UPDATE conversations SET last_message_at = ? WHERE id = ?").run(now, conversation_id);

  const message: Message = {
    id,
    conversation_id,
    sender_id: userId,
    content: formatted,
    original_message: displayOriginal,
    media_url: media_url ?? null,
    media_type: media_type ?? null,
    created_at: now,
    reactions: [],
  };

  const members = memberIds(conversation_id);
  const notification = buildNotificationPayload(displayOriginal);

  notifyConversationMembers(members, "message", { message, notification });
  notifyConversationMembers(members, "messages", {});

  res.status(201).json({ message, notification });
});

router.post("/:id/react", (req, res) => {
  const userId = req.user!.id;
  const { id } = req.params;
  const emoji = normalizeEmoji((req.body as { emoji?: string }).emoji);
  if (!emoji) {
    res.status(400).json({ error: "Emoji required" });
    return;
  }

  const row = db.prepare("SELECT * FROM messages WHERE id = ?").get(id) as Message | undefined;
  if (!row) {
    res.status(404).json({ error: "Message not found" });
    return;
  }
  if (!isMember(row.conversation_id, userId)) {
    res.status(403).json({ error: "Not a member of this conversation" });
    return;
  }

  const existed = db
    .prepare(
      "SELECT 1 FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?",
    )
    .get(id, userId, emoji);

  if (existed) {
    db.prepare("DELETE FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?").run(
      id,
      userId,
      emoji,
    );
  } else {
    db.prepare(
      "INSERT INTO message_reactions (message_id, user_id, emoji, created_at) VALUES (?, ?, ?, ?)",
    ).run(id, userId, emoji, new Date().toISOString());
  }

  const reactions = getReactionsForMessage(id);
  const members = memberIds(row.conversation_id);

  notifyConversationMembers(members, "message_reaction", {
    conversation_id: row.conversation_id,
    message_id: id,
    reactions,
  });

  res.json({ reactions });
});

router.delete("/:id", (req, res) => {
  const userId = req.user!.id;
  const { id } = req.params;

  const row = db.prepare("SELECT * FROM messages WHERE id = ?").get(id) as Message | undefined;
  if (!row) {
    res.status(404).json({ error: "Message not found" });
    return;
  }
  if (!isMember(row.conversation_id, userId)) {
    res.status(403).json({ error: "Not a member of this conversation" });
    return;
  }
  if (row.sender_id !== userId) {
    res.status(403).json({ error: "You can only delete your own messages" });
    return;
  }

  const members = memberIds(row.conversation_id);
  db.prepare("DELETE FROM messages WHERE id = ?").run(id);

  notifyConversationMembers(members, "message_deleted", {
    conversation_id: row.conversation_id,
    message_id: id,
  });
  notifyConversationMembers(members, "messages", {});

  res.status(204).send();
});

export default router;
