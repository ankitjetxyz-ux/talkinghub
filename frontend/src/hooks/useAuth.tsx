import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  api,
  connectRealtime,
  createSession,
  getStoredToken,
  requestNotificationPermission,
  setStoredToken,
} from "@/lib/api";
import { showArchiveNotification } from "@/lib/notifications";
import type { ArchiveNotification } from "@/lib/notifications";
import type { AuthUser, Session } from "@/lib/api-types";

interface AuthContextValue {
  session: Session | null;
  user: AuthUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
  setSessionFromAuth: (token: string, user: AuthUser) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }

    api
      .me()
      .then(({ user }) => {
        setSession(createSession(token, user));
      })
      .catch(() => {
        setStoredToken(null);
        setSession(null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!session) return;

    void requestNotificationPermission();

    const disconnect = connectRealtime((type, payload) => {
      if (type === "message") {
        const data = payload as {
          notification?: ArchiveNotification;
          message?: { sender_id: string };
        };
        if (
          data.notification &&
          data.message?.sender_id &&
          data.message.sender_id !== session.user.id
        ) {
          showArchiveNotification(data.notification);
        }
      }
    });

    return disconnect;
  }, [session]);

  const signOut = async () => {
    setStoredToken(null);
    setSession(null);
  };

  const setSessionFromAuth = (token: string, user: AuthUser) => {
    setStoredToken(token);
    setSession(createSession(token, user));
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        signOut,
        setSessionFromAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
