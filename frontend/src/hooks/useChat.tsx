import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { api, connectRealtime } from "@/lib/api";
import type { ArchiveNotification } from "@/lib/notifications";
import type {
  ConversationListItem,
  DbMessage,
  Profile,
} from "@/lib/api-types";

export type { Profile, DbMessage, ConversationListItem };

const PROFILE_HARD_DEADLINE_MS = 28_000;
const PROFILE_POLL_MS = 220;

/**
 * Loads `profiles` row; uses `archive_ensure_profile` RPC once per attempt if REST read fails,
 * until deadline (covers missing trigger / race after Google sign-in).
 */
async function loadMyProfileRow(userId: string): Promise<Profile> {
  const deadline = Date.now() + PROFILE_HARD_DEADLINE_MS;

  async function attempt(): Promise<Profile> {
    try {
      return await api.getProfile(userId);
    } catch {
      await api.ensureProfileRow();
      const p = await api.getProfile(userId);
      return p;
    }
  }

  let lastErr = new Error("Profile not loaded");
  while (Date.now() < deadline) {
    try {
      return await attempt();
    } catch (e) {
      lastErr = e instanceof Error ? e : lastErr;
      await new Promise((r) => setTimeout(r, PROFILE_POLL_MS));
    }
  }

  throw lastErr;
}

export function useMyProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [phase, setPhase] = useState<"idle" | "pending" | "resolved" | "error">(
    "idle",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setPhase("idle");
      setErrorMessage(null);
      return;
    }
    let cancelled = false;

    setPhase("pending");
    setErrorMessage(null);

    loadMyProfileRow(userId)
      .then((p) => {
        if (!cancelled) {
          setProfile(p);
          setPhase("resolved");
        }
      })
      .catch((e: unknown) => {
        console.warn("[useMyProfile]", e);
        if (!cancelled) {
          setProfile(null);
          setPhase("error");
          setErrorMessage(
            e instanceof Error ? e.message : "Could not load profile",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [userId, tick]);

  const applyProfile = useCallback((next: Profile) => {
    setProfile(next);
    setPhase("resolved");
    setErrorMessage(null);
  }, []);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!userId) return;
    const disconnect = connectRealtime((type, payload) => {
      if (type !== "profile_updated") return;
      const { profile } = payload as { profile: Profile };
      if (profile.id === userId) {
        setProfile(profile);
        setPhase("resolved");
        setErrorMessage(null);
      }
    });
    return disconnect;
  }, [userId]);

  const loadingProfile = phase === "pending";

  return {
    profile,
    applyProfile,
    reload,
    loadingProfile,
    profileError: phase === "error" ? errorMessage : null,
  };
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
    const disconnect = connectRealtime((type) => {
      if (
        type === "messages" ||
        type === "conversation_members" ||
        type === "profile_updated"
      )
        void load();
    });
    return disconnect;
  }, [userId, load]);

  return { items, loading, reload: load };
}

export function useMessages(conversationId: string | undefined) {
  const [messages, setMessages] = useState<DbMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      if (!conversationId) {
        setMessages([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const msgs = await api.getMessages(conversationId);
        if (!cancelled) setMessages(msgs);
      } catch {
        if (!cancelled) setMessages([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void refresh();

    const disconnect = connectRealtime((type, payload) => {
      if (!conversationId) return;
      if (type === "messages") {
        void refresh();
        return;
      }
      if (type === "message") {
        const msg = (
          payload as { message?: { conversation_id?: string } }
        ).message;
        if (msg?.conversation_id === conversationId) void refresh();
        return;
      }
      if (type === "message_deleted") {
        const cid = (
          payload as {
            conversation_id?: string;
          }
        ).conversation_id;
        if (cid === conversationId) void refresh();
        return;
      }
      if (type === "message_reaction") {
        const cid = (
          payload as {
            conversation_id?: string;
          }
        ).conversation_id;
        if (cid === conversationId) void refresh();
      }
    });

    return () => {
      cancelled = true;
      disconnect();
    };
  }, [conversationId]);

  const toggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (!conversationId) return;
      try {
        await api.toggleMessageReaction(messageId, emoji);
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Could not update reaction",
        );
      }
    },
    [conversationId],
  );

  const deleteMessage = useCallback(async (messageId: string) => {
    try {
      await api.deleteMessage(messageId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete");
    }
  }, []);

  const send = useCallback(
    async (
      text: string,
      _userId: string,
      media?: { url: string; media_type: string },
    ): Promise<{
      message: DbMessage;
      notification: ArchiveNotification;
    }> => {
      if (!conversationId) throw new Error("No conversation selected");
      return api.sendMessage({
        conversation_id: conversationId,
        content: text,
        media_url: media?.url,
        media_type: media?.media_type,
      });
    },
    [conversationId],
  );

  return { messages, loading, send, toggleReaction, deleteMessage };
}
