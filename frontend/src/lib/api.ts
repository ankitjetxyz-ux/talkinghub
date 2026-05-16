import type { ArchiveNotification } from "./notifications";
import type {
  AuthUser,
  ConversationListItem,
  DbMessage,
  DbMessageReaction,
  Profile,
  Session,
} from "./api-types";

export type { ArchiveNotification };

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000";
const WS_URL = import.meta.env.VITE_WS_URL ?? API_URL.replace(/^http/, "ws");

const TOKEN_KEY = "archive_token";

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  auth = true,
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (auth) {
    const token = getStoredToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  let data: unknown = null;
  if (res.status !== 204 && res.headers.get("Content-Length") !== "0") {
    try {
      data = await res.json();
    } catch {
      data = {};
    }
  }

  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return data as T;
}

export const api = {
  register(body: {
    email: string;
    password: string;
    display_name: string;
    handle: string;
  }) {
    return request<{ token: string; user: AuthUser; profile: Profile }>(
      "/api/auth/register",
      { method: "POST", body: JSON.stringify(body) },
      false,
    );
  },

  login(body: { email: string; password: string }) {
    return request<{ token: string; user: AuthUser; profile: Profile }>(
      "/api/auth/login",
      { method: "POST", body: JSON.stringify(body) },
      false,
    );
  },

  me() {
    return request<{ user: AuthUser; profile: Profile }>("/api/auth/me");
  },

  getProfile(id: string) {
    return request<Profile>(`/api/profiles/${id}`);
  },

  updateProfile(body: { display_name?: string; handle?: string; avatar_url?: string | null }) {
    return request<Profile>("/api/profiles/me", {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  getConversations() {
    return request<ConversationListItem[]>("/api/conversations");
  },

  startDm(handle: string) {
    return request<{ conversation_id: string }>("/api/conversations/dm", {
      method: "POST",
      body: JSON.stringify({ handle }),
    });
  },

  getMessages(conversationId: string) {
    return request<DbMessage[]>(`/api/conversations/${conversationId}/messages`);
  },

  sendMessage(body: {
    conversation_id: string;
    content: string;
    media_url?: string | null;
    media_type?: string | null;
  }) {
    return request<{ message: DbMessage; notification: ArchiveNotification }>("/api/messages", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  uploadMedia(file: File) {
    const form = new FormData();
    form.append("file", file);
    return request<{ url: string; media_type: string }>("/api/media/upload", {
      method: "POST",
      body: form,
    });
  },

  toggleMessageReaction(messageId: string, emoji: string) {
    return request<{ reactions: DbMessageReaction[] }>(
      `/api/messages/${encodeURIComponent(messageId)}/react`,
      { method: "POST", body: JSON.stringify({ emoji }) },
    );
  },

  deleteMessage(messageId: string) {
    return request<void>(`/api/messages/${encodeURIComponent(messageId)}`, {
      method: "DELETE",
    });
  },
};

export function createSession(token: string, user: AuthUser): Session {
  return { access_token: token, user };
}

export function connectRealtime(
  onEvent: (type: string, payload: unknown) => void,
): () => void {
  const token = getStoredToken();
  if (!token || typeof window === "undefined") return () => {};

  const ws = new WebSocket(`${WS_URL}/ws?token=${encodeURIComponent(token)}`);

  ws.onmessage = (ev) => {
    try {
      const { type, payload } = JSON.parse(ev.data) as { type: string; payload: unknown };
      onEvent(type, payload);
    } catch {
      /* ignore malformed */
    }
  };

  return () => {
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close();
    }
  };
}

export async function requestNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

