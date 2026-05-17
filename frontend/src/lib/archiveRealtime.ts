import { supabase } from "@/integrations/supabase/client";

type Handler = (type: string, payload: unknown) => void;

const handlers = new Set<Handler>();
let channel: ReturnType<typeof supabase.channel> | null = null;
/** One in-flight bootstrap; overlapping calls used to `.on()` after `subscribe()` and crash. */
let ensureInflight: Promise<void> | null = null;

function notify(type: string, payload: unknown) {
  handlers.forEach((h) => h(type, payload));
}

function removeChannelSafely(ch: NonNullable<typeof channel>) {
  try {
    supabase.removeChannel(ch);
  } catch {
    /* noop */
  }
}

function unsubscribeAll() {
  if (channel) {
    removeChannelSafely(channel);
    channel = null;
  }
}

export async function teardownArchiveRealtime() {
  if (ensureInflight) {
    try {
      await ensureInflight;
    } catch {
      /* session / subscribe errors during teardown */
    }
  }
  handlers.clear();
  ensureInflight = null;
  unsubscribeAll();
}

export function subscribeArchiveRealtime(onEvent: Handler) {
  handlers.add(onEvent);
  void ensureChannel();
  return () => {
    handlers.delete(onEvent);
    if (handlers.size === 0) void teardownArchiveRealtime();
  };
}

async function fetchReactionsBatch(
  messageIds: string[],
): Promise<Map<string, { user_id: string; emoji: string }[]>> {
  const map = new Map<string, { user_id: string; emoji: string }[]>();
  if (messageIds.length === 0) return map;
  const { data, error } = await supabase
    .from("message_reactions")
    .select("message_id,user_id,emoji")
    .in("message_id", messageIds);
  if (error || !data) return map;
  for (const row of data) {
    const list = map.get(row.message_id) ?? [];
    list.push({ user_id: row.user_id, emoji: row.emoji });
    map.set(row.message_id, list);
  }
  return map;
}

async function fetchConversationId(messageId: string): Promise<string | null> {
  const { data } = await supabase
    .from("messages")
    .select("conversation_id")
    .eq("id", messageId)
    .maybeSingle();
  return data?.conversation_id ?? null;
}

async function ensureChannel() {
  if (typeof window === "undefined") return;
  if (channel) return;
  if (ensureInflight) {
    await ensureInflight;
    return;
  }

  ensureInflight = (async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;
      if (channel) return;

      const ch = supabase
        .channel("archive-realtime")
        .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages" },
      (payload) => {
        const row = payload.new as Record<string, unknown>;
        const message = {
          id: row.id as string,
          conversation_id: row.conversation_id as string,
          sender_id: row.sender_id as string,
          content: row.content as string,
          original_message: row.original_message as string,
          media_url: row.media_url as string | null,
          media_type: row.media_type as string | null,
          created_at: row.created_at as string,
          reactions: [] as { user_id: string; emoji: string }[],
        };
        notify("message", { message });
        notify("messages", {});
      },
    )
    .on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "messages" },
      async (payload) => {
        const row = payload.old as Record<string, unknown>;
        const messageId = row.id as string;
        const convId =
          row.conversation_id != null ? (row.conversation_id as string) : await fetchConversationId(messageId);
        if (convId) {
          notify("message_deleted", {
            conversation_id: convId,
            message_id: messageId,
          });
        }
        notify("messages", {});
      },
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "message_reactions" },
      async (payload) => {
        const raw = payload.new ?? payload.old;
        if (!raw || typeof raw !== "object") return;
        const messageId = (raw as { message_id?: string }).message_id;
        if (!messageId) return;
        const convId = await fetchConversationId(messageId);
        if (!convId) return;
        const map = await fetchReactionsBatch([messageId]);
        const reactions = map.get(messageId) ?? [];
        notify("message_reaction", {
          conversation_id: convId,
          message_id: messageId,
          reactions,
        });
      },
    )
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "conversation_members" },
      () => notify("conversation_members", {}),
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "profiles" },
      (payload) => {
        const row = payload.new as Record<string, unknown>;
        notify("profile_updated", {
          profile: {
            id: row.id as string,
            display_name: row.display_name as string,
            handle: row.handle as string,
            avatar_url: row.avatar_url as string | null,
            status: row.status as string,
            profile_setup_completed:
              typeof row.profile_setup_completed === "boolean"
                ? row.profile_setup_completed
                : true,
            created_at: row.created_at as string,
          },
        });
      },
    );

      channel = ch;
      const { error } = await ch.subscribe();
      if (error) {
        console.error("[archive-realtime] subscribe failed:", error.message);
        removeChannelSafely(ch);
        channel = null;
      }
    } finally {
      ensureInflight = null;
    }
  })();

  await ensureInflight;
}
