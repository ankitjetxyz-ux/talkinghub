import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useConversations, useMessages, useMyProfile } from "@/hooks/useChat";
import { ProfileSetupGate } from "@/components/ProfileSetupGate";
import { Sidebar } from "@/components/Sidebar";
import { ChatHeader } from "@/components/ChatHeader";
import { ChatContainer } from "@/components/ChatContainer";
import { MessageInput } from "@/components/MessageInput";
import { NewChatDialog } from "@/components/NewChatDialog";
import { BrandMark } from "@/components/BrandMark";
import { DecoyOverlay } from "@/components/decoy/DecoyOverlay";
import { showArchiveNotification } from "@/lib/notifications";
import type { Profile } from "@/lib/api-types";

export const Route = createFileRoute("/_authenticated/")({
  component: ChatPage,
});

function ChatPage() {
  const { user, signOut } = useAuth();
  const {
    profile: me,
    applyProfile,
    loadingProfile,
    profileError,
    reload: retryProfileLoad,
  } = useMyProfile(user?.id);
  const { items: conversations, reload } = useConversations(user?.id);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [decoyOpen, setDecoyOpen] = useState(false);

  useEffect(() => {
    if (!activeId && conversations.length > 0) setActiveId(conversations[0].id);
  }, [activeId, conversations]);

  const active = conversations.find((c) => c.id === activeId) ?? null;
  const { messages, loading, send, toggleReaction, deleteMessage } =
    useMessages(activeId ?? undefined);

  function handleProfileUpdated(profile: Profile) {
    applyProfile(profile);
    void reload();
  }

  async function handleSend(
    text: string,
    media?: { url: string; media_type: string },
  ) {
    if (!user || !activeId) return;
    try {
      const result = await send(text, user.id, media);
      if (result?.notification) {
        showArchiveNotification(result.notification, { push: false });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send");
    }
  }

  async function handleNewChatCreated(conversationId: string) {
    await reload();
    setActiveId(conversationId);
    setMenuOpen(false);
    toast.success("Chat started");
  }

  if (loadingProfile && !profileError) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-2 bg-background px-6">
        <p className="text-sm text-muted-foreground">Loading profile…</p>
        <p className="max-w-xs text-center text-xs text-muted-foreground/80">
          If this hangs, confirm you ran the SQL patches in SUPABASE.md
          (including archive_ensure_profile) after signing in with Google.
        </p>
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-5 bg-background px-6">
        <p className="text-center text-sm font-semibold text-foreground">
          Could not load your profile
        </p>
        <p className="max-w-md text-center text-sm text-muted-foreground">
          {profileError}. Run{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            supabase/patch_archive_ensure_profile.sql
          </code>{" "}
          in the Supabase SQL Editor (RPC{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            archive_ensure_profile
          </code>
          ), then tap Retry.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => void retryProfileLoad()}
            className="rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-background"
          >
            Retry
          </button>
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  if (!me) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Almost ready…</p>
      </div>
    );
  }

  if (!me.profile_setup_completed) {
    return <ProfileSetupGate draft={me} onDone={(p) => applyProfile(p)} />;
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <Sidebar
        me={me}
        onProfileUpdated={handleProfileUpdated}
        conversations={conversations}
        activeId={activeId}
        onSelect={setActiveId}
        onNewChat={() => {
          setNewOpen(true);
          setMenuOpen(false);
        }}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
      />

      <DecoyOverlay
        open={decoyOpen}
        onOpen={() => setDecoyOpen(true)}
        onClose={() => setDecoyOpen(false)}
      >
        <ChatHeader
          other={active?.other ?? null}
          groupName={active?.name ?? null}
          onOpenMenu={() => setMenuOpen(true)}
          onOpenDecoy={() => setDecoyOpen(true)}
          onSignOut={signOut}
        />

        {activeId ? (
          <>
            <ChatContainer
              messages={messages}
              currentUserId={user?.id ?? ""}
              peer={active?.other ?? null}
              meProfile={me}
              loading={loading}
              onToggleReaction={toggleReaction}
              onDeleteMessage={deleteMessage}
            />
            <MessageInput onSend={handleSend} />
          </>
        ) : (
          <main className="flex flex-1 items-center justify-center px-6 text-center">
            <div className="flex max-w-sm flex-col items-center">
              <BrandMark variant="hero" />
              <p className="mt-8 text-base font-semibold text-foreground">
                Select a chat
              </p>
              <p className="mt-3 text-sm text-muted-foreground">
                Open the menu to pick a chat or start a new one.
              </p>
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                className="mt-6 rounded-xl bg-foreground px-5 py-2.5 text-sm font-medium text-background transition hover:opacity-90"
              >
                Open menu
              </button>
            </div>
          </main>
        )}
      </DecoyOverlay>

      <NewChatDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={handleNewChatCreated}
      />
    </div>
  );
}
