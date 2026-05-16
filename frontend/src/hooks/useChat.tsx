import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { api, connectRealtime } from "@/lib/api";
import type {
  ConversationListItem,
  DbMessage,
  DbMessageReaction,
  Profile,
} from "@/lib/api-types";

export type { Profile, DbMessage, ConversationListItem };

export function useMyProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    api
      .getProfile(userId)
      .then((data) => {
        if (!cancelled) setProfile(data);
      })
      .catch(() => {
        if (!cancelled) setProfile(null);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, tick]);

  const applyProfile = useCallback((next: Profile) => {
    setProfile(next);
  }, []);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!userId) return;
    const disconnect = connectRealtime((type, payload) => {
      if (type !== "profile_updated") return;
      const { profile } = payload as { profile: Profile };
      if (profile.id === userId) setProfile(profile);
    });
    return disconnect;
  }, [userId]);

  return { profile, applyProfile, reload };
}

export function useConversations(userId: string | undefined) {
  const [items, setItems] = useState<ConversationListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const list = await api.getConversations();
      setItems(list);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!userId) return;
    const disconnect = connectRealtime((type, payload) => {
      if (type === "messages" || type === "conversation_members") {
        void load();
        return;
      }
      if (type === "profile_updated") {
        const { profile } = payload as { profile: Profile };
        setItems((prev) =>
          prev.map((it) => (it.other?.id === profile.id ? { ...it, other: profile } : it)),
        );
      }
    });
    return disconnect;
  }, [userId, load]);

  return { items, loading, reload: load };
}

export function useMessages(conversationId: string | undefined) {
  const [messages, setMessages] = useState<DbMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api
      .getMessages(conversationId)
      .then((data) => {
        if (!cancelled) {
          setMessages(
            data.map((m) => ({ ...m, reactions: m.reactions ?? [] })),
          );
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMessages([]);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) return;
    const disconnect = connectRealtime((type, payload) => {
      if (type === "message") {
        const data = payload as { message: DbMessage };
        if (data.message.conversation_id !== conversationId) return;
        const msg = {
          ...data.message,
          reactions: data.message.reactions ?? [],
        };
        setMessages((prev) =>
          prev.find((x) => x.id === msg.id)
            ? prev.map((x) =>
                x.id === msg.id ? { ...x, ...msg, reactions: msg.reactions } : x,
              )
            : [...prev, msg],
        );
      }
      if (type === "message_reaction") {
        const d = payload as {
          conversation_id: string;
          message_id: string;
          reactions: DbMessageReaction[];
        };
        if (d.conversation_id !== conversationId) return;
        setMessages((prev) =>
          prev.map((m) => (m.id === d.message_id ? { ...m, reactions: d.reactions } : m)),
        );
      }
      if (type === "message_deleted") {
        const d = payload as { conversation_id: string; message_id: string };
        if (d.conversation_id !== conversationId) return;
        setMessages((prev) => prev.filter((m) => m.id !== d.message_id));
      }
    });
    return disconnect;
  }, [conversationId]);

  const send = useCallback(
    async (
      content: string,
      _senderId: string,
      media?: { url: string; media_type: string },
    ) => {
      if (!conversationId) return;
      const text = content.trim();
      if (!text && !media) return;
      return api.sendMessage({
        conversation_id: conversationId,
        content: text,
        media_url: media?.url ?? null,
        media_type: media?.media_type ?? null,
      });
    },
    [conversationId],
  );

  const toggleReaction = useCallback(async (messageId: string, emoji: string) => {
    try {
      const result = await api.toggleMessageReaction(messageId, emoji);
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, reactions: result.reactions } : m)),
      );
    } catch {
      toast.error("Could not update reaction");
    }
  }, []);

  const deleteMessageFn = useCallback(async (messageId: string) => {
    try {
      await api.deleteMessage(messageId);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch {
      toast.error("Could not delete message");
    }
  }, []);

  return { messages, loading, send, toggleReaction, deleteMessage: deleteMessageFn };
}
