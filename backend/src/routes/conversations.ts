import { Router } from "express";
import { v4 as uuid } from "uuid";
import { db } from "../db.js";
import { requireAuth } from "../auth.js";
import type { Conversation, Message, Profile } from "../types.js";
import { notifyConversationMembers } from "../ws.js";
import { hydrateMessagesReactions } from "../lib/messagesHydrate.js";

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

router.get("/", (req, res) => {
  const userId = req.user!.id;

  const convRows = db
    .prepare(
      `SELECT c.* FROM conversations c
       JOIN conversation_members m ON m.conversation_id = c.id
       WHERE m.user_id = ?
       ORDER BY c.last_message_at DESC`,
    )
    .all(userId) as Conversation[];

  const items = convRows.map((c) => {
    const other = db
      .prepare(
        `SELECT p.* FROM profiles p
         JOIN conversation_members m ON m.user_id = p.id
         WHERE m.conversation_id = ? AND m.user_id != ?`,
      )
      .get(c.id, userId) as Profile | undefined;

    const lastMsg = db
      .prepare(
        `SELECT content FROM messages
         WHERE conversation_id = ?
         ORDER BY created_at DESC LIMIT 1`,
      )
      .get(c.id) as { content: string } | undefined;

    return {
      id: c.id,
      is_group: Boolean(c.is_group),
      name: c.name,
      last_message_at: c.last_message_at,
      other: other ?? null,
      preview: lastMsg?.content ?? "No messages yet",
    };
  });

  res.json(items);
});

router.post("/dm", (req, res) => {
  const userId = req.user!.id;
  const handle = String((req.body as { handle?: string }).handle ?? "")
    .trim()
    .replace(/^@/, "");

  if (!handle) {
    res.status(400).json({ error: "Handle required" });
    return;
  }

  const other = db
    .prepare("SELECT id FROM profiles WHERE handle = ? COLLATE NOCASE")
    .get(handle) as { id: string } | undefined;

  if (!other) {
    res.status(404).json({ error: `No such handle: ${handle}` });
    return;
  }
  if (other.id === userId) {
    res.status(400).json({ error: "Cannot DM yourself" });
    return;
  }

  const existing = db
    .prepare(
      `SELECT c.id FROM conversations c
       JOIN conversation_members m1 ON m1.conversation_id = c.id AND m1.user_id = ?
       JOIN conversation_members m2 ON m2.conversation_id = c.id AND m2.user_id = ?
       WHERE c.is_group = 0 LIMIT 1`,
    )
    .get(userId, other.id) as { id: string } | undefined;

  if (existing) {
    res.json({ conversation_id: existing.id });
    return;
  }

  const convId = uuid();
  const insertConv = db.prepare(
    "INSERT INTO conversations (id, is_group, created_by) VALUES (?, 0, ?)",
  );
  const insertMember = db.prepare(
    "INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?)",
  );

  const tx = db.transaction(() => {
    insertConv.run(convId, userId);
    insertMember.run(convId, userId);
    insertMember.run(convId, other.id);
  });
  tx();

  notifyConversationMembers([userId, other.id], "conversation_members", {
    conversation_id: convId,
  });

  res.status(201).json({ conversation_id: convId });
});

router.get("/:id/messages", (req, res) => {
  const userId = req.user!.id;
  const { id } = req.params;

  if (!isMember(id, userId)) {
    res.status(403).json({ error: "Not a member of this conversation" });
    return;
  }

  const raw = db
    .prepare(
      `SELECT id, conversation_id, sender_id, content, original_message, media_url, media_type, created_at
       FROM messages WHERE conversation_id = ? ORDER BY created_at ASC`,
    )
    .all(id) as Message[];

  const messages = hydrateMessagesReactions(raw);

  res.json(messages);
});

export default router;
