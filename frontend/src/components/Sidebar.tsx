import { useState } from "react";
import type { ConversationListItem, Profile } from "@/hooks/useChat";
import { usernameLabel } from "@/lib/display";
import { ProfileEditDialog } from "@/components/ProfileEditDialog";
import { Avatar } from "@/components/Avatar";

interface Props {
  me: Profile | null;
  onProfileUpdated?: (profile: Profile) => void;
  conversations: ConversationListItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  open: boolean;
  onClose: () => void;
}

export function Sidebar({
  me,
  onProfileUpdated,
  conversations,
  activeId,
  onSelect,
  onNewChat,
  open,
  onClose,
}: Props) {
  const [profileOpen, setProfileOpen] = useState(false);

  if (!open) return null;

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-30 bg-background/50 backdrop-blur-[2px]"
        aria-hidden
      />
      <aside className="fixed inset-y-0 left-0 z-40 flex w-[22rem] flex-col border-r border-border bg-sidebar text-sidebar-foreground shadow-xl">
        <SidebarTop
          conversations={conversations}
          onNewChat={onNewChat}
          onEditProfile={me ? () => setProfileOpen(true) : undefined}
          onClose={onClose}
        />

        <nav className="flex-1 overflow-y-auto scrollbar-hidden px-2 py-2">
          {conversations.length === 0 ? (
            <SidebarEmpty onNewChat={onNewChat} />
          ) : (
            conversations.map((c) => (
              <ConversationItem
                key={c.id}
                item={c}
                active={c.id === activeId}
                onSelect={() => {
                  onSelect(c.id);
                  onClose();
                }}
              />
            ))
          )}
        </nav>
      </aside>

      {me && onProfileUpdated && (
        <ProfileEditDialog
          profile={me}
          open={profileOpen}
          onClose={() => setProfileOpen(false)}
          onUpdated={onProfileUpdated}
        />
      )}
    </>
  );
}

function SidebarTop({
  conversations,
  onNewChat,
  onEditProfile,
  onClose,
}: {
  conversations: ConversationListItem[];
  onNewChat: () => void;
  onEditProfile?: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-4">
      <div className="min-w-0 flex-1">
        <h2 className="text-base font-semibold text-foreground">Chats</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {conversations.length === 0
            ? "No conversations"
            : `${conversations.length} conversation${conversations.length === 1 ? "" : "s"}`}
        </p>
      </div>
      <div className="flex items-center gap-1">
        {onEditProfile && (
          <button
            type="button"
            onClick={onEditProfile}
            className="rounded-lg p-2 text-muted-foreground transition hover:bg-sidebar-accent hover:text-foreground"
            aria-label="Edit profile"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path
                d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
        <button
          type="button"
          onClick={onNewChat}
          className="rounded-lg p-2 text-muted-foreground transition hover:bg-sidebar-accent hover:text-foreground"
          aria-label="New chat"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-muted-foreground transition hover:bg-sidebar-accent hover:text-foreground"
          aria-label="Close menu"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function SidebarEmpty({ onNewChat }: { onNewChat: () => void }) {
  return (
    <div className="px-3 py-12 text-center">
      <p className="text-sm text-muted-foreground">No chats yet</p>
      <button
        type="button"
        onClick={onNewChat}
        className="mt-3 text-sm font-medium text-foreground hover:underline"
      >
        Start a chat
      </button>
    </div>
  );
}

function ConversationItem({
  item,
  active,
  onSelect,
}: {
  item: ConversationListItem;
  active: boolean;
  onSelect: () => void;
}) {
  const label = item.is_group && item.name ? item.name : usernameLabel(item.other);
  const preview = stripWrapper(item.preview);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        "mb-0.5 flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition",
        active ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/50",
      ].join(" ")}
    >
      {item.other ? (
        <Avatar size="sm" avatarUrl={item.other.avatar_url} handle={item.other.handle} className="shrink-0" />
      ) : (
        <div className="size-9 shrink-0 rounded-full border border-border/40 bg-muted/50" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-semibold text-foreground">{label}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{formatRelative(item.last_message_at)}</span>
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">{preview}</p>
      </div>
    </button>
  );
}

function stripWrapper(text: string): string {
  if (text.includes("no messages yet")) return "No messages yet";
  const match = text.match(/::\s*(.+?)\s*::/);
  return match?.[1]?.trim() ?? text;
}

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.round(diff / 1000);
  if (s < 60) return "now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}
