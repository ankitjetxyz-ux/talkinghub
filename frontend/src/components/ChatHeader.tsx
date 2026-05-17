import { Ghost } from "lucide-react";
import type { Profile } from "@/hooks/useChat";
import { usernameLabel } from "@/lib/display";
import { Avatar } from "@/components/Avatar";

interface Props {
  other: Profile | null;
  groupName?: string | null;
  onOpenMenu: () => void;
  onOpenDecoy?: () => void;
  onSignOut?: () => void;
}

export function ChatHeader({ other, groupName, onOpenMenu, onOpenDecoy, onSignOut }: Props) {
  const label = groupName ?? (other ? usernameLabel(other) : "Select a chat");
  const dmPeer = groupName ? null : other;

  return (
    <header className="glass sticky top-0 z-20 border-b border-border">
      <div className="flex items-center gap-3 px-4 py-3.5">
        <button
          type="button"
          onClick={onOpenMenu}
          className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          aria-label="Open menu"
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
          </svg>
        </button>

        {dmPeer ? (
          <Avatar avatarUrl={dmPeer.avatar_url} handle={dmPeer.handle} size="md" />
        ) : null}

        <p className="min-w-0 flex-1 truncate text-base font-semibold tracking-tight text-foreground">{label}</p>

        {onOpenDecoy ? (
          <button
            type="button"
            onClick={onOpenDecoy}
            className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="Open Snapchat cover"
            title="Snapchat cover"
          >
            <Ghost className="h-5 w-5" strokeWidth={1.5} />
          </button>
        ) : null}

        <button
          type="button"
          onClick={onSignOut}
          className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          aria-label="Sign out"
          title="Sign out"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M15 17l5-5-5-5M20 12H9M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </header>
  );
}
