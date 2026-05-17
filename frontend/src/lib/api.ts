import { supabase } from "@/integrations/supabase/client";
import type {
  ArchiveNotification,
} from "./notifications";
import type {
  AuthUser,
  ConversationListItem,
  DbMessage,
  DbMessageReaction,
  Profile,
  Session,
} from "./api-types";
import type { Tables } from "@/integrations/supabase/types";
import { buildNotificationPayload } from "./notificationPayload";
import {
  subscribeArchiveRealtime,
  teardownArchiveRealtime,
} from "./archiveRealtime";

export type { ArchiveNotification };

function mapProfile(row: Tables<"profiles">): Profile {
  return {
    id: row.id,
    display_name: row.display_name,
    handle: String(row.handle),
    avatar_url: row.avatar_url,
    status: row.status,
    profile_setup_completed: row.profile_setup_completed ?? true,
    created_at: row.created_at,
  };
}

async function hydrateMessages(rows: Tables<"messages">[]): Promise<DbMessage[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const { data: rx } = await supabase
    .from("message_reactions")
    .select("message_id,user_id,emoji")
    .in("message_id", ids);
  const grouped = new Map<string, DbMessageReaction[]>();
  for (const r of rx ?? []) {
    const list = grouped.get(r.message_id) ?? [];
    list.push({ user_id: r.user_id, emoji: r.emoji });
    grouped.set(r.message_id, list);
  }
  return rows.map((m) => ({
    id: m.id,
    conversation_id: m.conversation_id,
    sender_id: m.sender_id,
    content: m.content,
    original_message: m.original_message,
    media_url: m.media_url,
    media_type: m.media_type,
    created_at: m.created_at,
    reactions: grouped.get(m.id) ?? [],
  }));
}

/** @deprecated Prefer supabase.auth.getSession(); kept for callers that probe sync token. */
export function getStoredToken(): string | null {
  return null;
}

/** @deprecated No-op with Supabase session storage. */
export function setStoredToken(_token: string | null) {
  /* no-op — session managed by Supabase Auth */
}

function normalizeEmoji(raw: string): string | null {
  const t = raw.trim().replace(/\s+/g, "");
  if (!t || t.length > 16) return null;
  if (/[<>'"&\\]/.test(t)) return null;
  if (/[\u0000-\u001f]/.test(t)) return null;
  return t;
}

function safeStorageFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

function publicAvatarUrlAllowed(url: string): boolean {
  const base = (
    import.meta.env.VITE_SUPABASE_URL ??
    ""
  ).replace(/\/$/, "");
  const prefix = `${base}/storage/v1/object/public/avatars/`;
  return Boolean(base) && url.startsWith(prefix);
}

export const api = {
  /**
   * Google OAuth only (PKCE). Browser redirects away then returns to `/auth`.
   */
  async signInWithGoogle() {
    if (typeof window === "undefined") {
      throw new Error("Google sign-in runs in the browser only.");
    }

    const redirectTo = `${window.location.origin}/auth`;

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: { prompt: "select_account" },
      },
    });

    if (error) throw new Error(error.message || "Could not start Google sign-in.");
    if (data.url) window.location.assign(data.url);
    else throw new Error("Google sign-in did not return a redirect URL.");
  },

  async me() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) throw new Error("Unauthorized");

    const { data: profileRow, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .maybeSingle();

    if (error || !profileRow) throw new Error("Profile not found");

    return {
      user: { id: session.user.id, email: session.user.email! },
      profile: mapProfile(profileRow),
    };
  },

  async getProfile(id: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message ?? "Profile request failed");
    if (!data) throw new Error("Profile not found");
    return mapProfile(data);
  },

  /** Creates `public.profiles` from `auth.users` if trigger missed it (SECURITY DEFINER RPC). */
  async ensureProfileRow(): Promise<Profile> {
    const { data, error } = await supabase.rpc("archive_ensure_profile");
    if (error) throw new Error(error.message ?? "Could not ensure profile row");
    if (!data) throw new Error("Could not ensure profile row");
    return mapProfile(data as Tables<"profiles">);
  },

  async updateProfile(body: {
    display_name?: string;
    handle?: string;
    avatar_url?: string | null;
    profile_setup_completed?: boolean;
  }) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const patch: {
      display_name?: string;
      handle?: string;
      avatar_url?: string | null;
      profile_setup_completed?: boolean;
    } = {};

    if (body.display_name !== undefined) {
      const name = body.display_name.trim();
      if (!name) throw new Error("Name cannot be empty");
      patch.display_name = name;
    }

    if (body.handle !== undefined) {
      const clean = body.handle.toLowerCase().replace(/[^a-z0-9_]/g, "");
      if (!clean) throw new Error("Username invalid");
      const { data: taken } = await supabase
        .from("profiles")
        .select("id")
        .neq("id", user.id)
        .eq("handle", clean)
        .maybeSingle();
      if (taken) throw new Error("Username is already taken");
      patch.handle = clean;
    }

    if (body.profile_setup_completed !== undefined) {
      patch.profile_setup_completed = body.profile_setup_completed;
    }

    if (body.avatar_url !== undefined) {
      const v = body.avatar_url;
      if (v === null || v === "") patch.avatar_url = null;
      else if (typeof v === "string" && publicAvatarUrlAllowed(v.trim()))
        patch.avatar_url = v.trim();
      else {
        throw new Error(
          "Avatar must use the avatars bucket (upload from the editor).",
        );
      }
    }

    if (Object.keys(patch).length === 0) {
      const { data: current, error: curErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      if (curErr || !current) throw new Error("Profile not found");
      return mapProfile(current);
    }

    const { data: updated, error } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", user.id)
      .select("*")
      .single();

    if (error || !updated) {
      const msg =
        error?.code === "23505"
          ? "Username is already taken"
          : error?.message ?? "Update failed";
      throw new Error(msg);
    }
    return mapProfile(updated);
  },

  async getConversations(): Promise<ConversationListItem[]> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { data: mems } = await supabase
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", user.id);
    const convIds = (mems ?? []).map((m) => m.conversation_id);
    if (!convIds.length) return [];

    const { data: convs } = await supabase
      .from("conversations")
      .select("*")
      .in("id", convIds)
      .order("last_message_at", { ascending: false });

    const items: ConversationListItem[] = [];
    for (const c of convs ?? []) {
      const { data: members } = await supabase
        .from("conversation_members")
        .select("user_id")
        .eq("conversation_id", c.id);
      let otherProf: Tables<"profiles"> | null = null;
      if (!c.is_group) {
        const otherId =
          members?.find((m) => m.user_id !== user.id)?.user_id ?? null;
        if (otherId) {
          const { data: p } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", otherId)
            .maybeSingle();
          if (p) otherProf = p;
        }
      }
      const { data: last } = await supabase
        .from("messages")
        .select("content")
        .eq("conversation_id", c.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      items.push({
        id: c.id,
        is_group: c.is_group,
        name: c.name,
        last_message_at: c.last_message_at,
        other: otherProf ? mapProfile(otherProf) : null,
        preview: last?.content ?? "No messages yet",
      });
    }
    return items;
  },

  async startDm(handle: string) {
    const h = handle.trim().replace(/^@/, "");
    const { data, error } = await supabase.rpc("archive_start_dm", {
      _handle: h,
    });
    if (error) {
      const msg = (error.message ?? "").toLowerCase();
      if (
        msg.includes("handle_not_found") ||
        msg.includes("no rows") ||
        msg.includes("not found")
      ) {
        throw new Error(`No such handle: ${h}`);
      }
      if (
        msg.includes("cannot dm yourself") ||
        msg.includes("yourself") ||
        msg.includes("same user")
      ) {
        throw new Error("Cannot DM yourself");
      }
      throw new Error(error.message ?? "Could not start chat");
    }
    if (data == null) throw new Error("Could not start chat");
    return { conversation_id: String(data) };
  },

  async getMessages(conversationId: string) {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return hydrateMessages(data ?? []);
  },

  async sendMessage(body: {
    conversation_id: string;
    content: string;
    media_url?: string | null;
    media_type?: string | null;
  }) {
    const { data, error } = await supabase.rpc("archive_send_message", {
      conv_id: body.conversation_id,
      p_plain: body.content.trim(),
      p_media_url: body.media_url ?? null,
      p_media_type: body.media_type ?? null,
    });

    if (error) throw new Error(error.message);
    const row = data as Tables<"messages">;
    const notification = buildNotificationPayload(row.original_message);

    const [message] = await hydrateMessages([row]);
    return { message, notification };
  },

  async uploadMedia(file: File) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const ext = safeStorageFileName(file.name || "file");
    const path = `${user.id}/${globalThis.crypto.randomUUID()}-${ext}`;

    const { error: upErr } = await supabase.storage
      .from("chat-media")
      .upload(path, file, { cacheControl: "3600", upsert: false });
    if (upErr) throw new Error(upErr.message);

    const { data: pub } = supabase.storage
      .from("chat-media")
      .getPublicUrl(path);

    const url = pub.publicUrl;
    return { url, media_type: file.type || "application/octet-stream" };
  },

  async uploadAvatar(file: File) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const ext = safeStorageFileName(file.name || "avatar");
    const path = `${user.id}/${globalThis.crypto.randomUUID()}-${ext}`;

    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, { cacheControl: "3600", upsert: false });
    if (upErr) throw new Error(upErr.message);

    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    return { url: pub.publicUrl };
  },

  async toggleMessageReaction(messageId: string, emoji: string) {
    const normalized = normalizeEmoji(emoji);
    if (!normalized) throw new Error("Emoji invalid");

    const { data: raw, error } = await supabase.rpc(
      "archive_toggle_reaction",
      { p_message_id: messageId, p_emoji: normalized },
    );
    if (error) throw new Error(error.message);

    let reactions: DbMessageReaction[] = [];

    try {
      const parsed =
        typeof raw === "string"
          ? (JSON.parse(raw) as unknown)
          : raw;
      const arr = Array.isArray(parsed) ? parsed : [];
      for (const row of arr) {
        if (
          row &&
          typeof row === "object" &&
          "user_id" in row &&
          "emoji" in row &&
          typeof (row as { user_id: unknown }).user_id === "string" &&
          typeof (row as { emoji: unknown }).emoji === "string"
        ) {
          reactions.push({
            user_id: (row as { user_id: string }).user_id,
            emoji: (row as { emoji: string }).emoji,
          });
        }
      }
    } catch {
      reactions = [];
    }

    return { reactions };
  },

  async deleteMessage(messageId: string) {
    const { error } = await supabase.rpc("archive_delete_message", {
      p_message_id: messageId,
    });
    if (error) throw new Error(error.message);
  },
};

export function createSession(token: string, user: AuthUser): Session {
  return { access_token: token, user };
}

export async function teardownChatRealtime() {
  await teardownArchiveRealtime();
}

export function connectRealtime(
  onEvent: (type: string, payload: unknown) => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  return subscribeArchiveRealtime(onEvent);
}

export async function requestNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window))
    return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}
