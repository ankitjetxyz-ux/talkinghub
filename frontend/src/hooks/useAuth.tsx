import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  connectRealtime,
  createSession,
  requestNotificationPermission,
} from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { teardownArchiveRealtime } from "@/lib/archiveRealtime";
import { showArchiveNotification } from "@/lib/notifications";
import { buildNotificationPayload } from "@/lib/notificationPayload";
import type { Session } from "@/lib/api-types";

interface AuthContextValue {
  session: Session | null;
  user: import("@/lib/api-types").AuthUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, sess) => {
      if (sess?.user) {
        setSession(
          createSession(sess.access_token, {
            id: sess.user.id,
            email: sess.user.email ?? "",
          }),
        );
      } else {
        void teardownArchiveRealtime();
        setSession(null);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (s?.user) {
        setSession(
          createSession(s.access_token, {
            id: s.user.id,
            email: s.user.email ?? "",
          }),
        );
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;

    void requestNotificationPermission();

    const disconnect = connectRealtime((type, payload) => {
      if (type === "message") {
        const data = payload as {
          message?: {
            sender_id: string;
            original_message?: string;
            content?: string;
          };
        };
        const snippet =
          data.message?.original_message?.trim() ||
          data.message?.content?.trim() ||
          "";
        if (
          data.message?.sender_id &&
          data.message.sender_id !== session.user.id &&
          snippet
        ) {
          showArchiveNotification(buildNotificationPayload(snippet));
        }
      }
    });

    return disconnect;
  }, [session]);

  const signOut = async () => {
    await teardownArchiveRealtime();
    await supabase.auth.signOut();
    setSession(null);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        signOut,
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
