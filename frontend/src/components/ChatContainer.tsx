import { useEffect, useRef } from "react";
import type { DbMessage } from "@/hooks/useChat";
import type { Profile } from "@/lib/api-types";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { MessageRow } from "./MessageRow";
import { Avatar } from "./Avatar";

interface Props {
  messages: DbMessage[];
  currentUserId: string;
  peer: Profile | null;
  meProfile: Profile | null;
  loading?: boolean;
  emptyHint?: string;
  onToggleReaction: (messageId: string, emoji: string) => void;
  onDeleteMessage: (messageId: string) => void;
}

export function ChatContainer({
  messages,
  currentUserId,
  peer,
  meProfile,
  loading,
  emptyHint,
  onToggleReaction,
  onDeleteMessage,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  return (
    <main className="flex-1 overflow-y-auto scrollbar-hidden">
      <div className="mx-auto flex max-w-3xl flex-col gap-1.5 px-3 py-6 sm:gap-2 sm:px-4">
        {loading && (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
        )}

        {!loading && messages.length === 0 && (
          <p className="py-16 text-center text-sm text-muted-foreground">
            {emptyHint ?? "No messages yet. Say hello."}
          </p>
        )}

        {messages.map((m) => {
          const isMe = m.sender_id === currentUserId;
          const theirAvatarUrl = peer?.avatar_url ?? null;
          const theirHandle = peer?.handle ?? "?";
          const myAvatarUrl = meProfile?.avatar_url ?? null;
          const myHandle = meProfile?.handle ?? "?";

          return (
            <div
              key={m.id}
              className={`flex w-full flex-row gap-2 sm:gap-2.5 ${
                isMe ? "justify-end" : "justify-start"
              }`}
            >
              {!isMe && (
                <Avatar
                  size="sm"
                  avatarUrl={theirAvatarUrl}
                  handle={theirHandle}
                  className="mt-px shrink-0 self-end"
                />
              )}

              <div
                className={`flex min-w-0 flex-col gap-2 ${
                  isMe ? "max-w-[min(85%,28rem)] items-end" : "max-w-[min(85%,28rem)] items-start"
                }`}
              >
                {m.media_url && (
                  <div
                    className={`w-full max-w-[min(85vw,420px)] overflow-hidden rounded-2xl border border-border/40 ${
                      isMe ? "ml-auto" : ""
                    }`}
                  >
                    <ChatMedia url={m.media_url} mediaType={m.media_type} />
                  </div>
                )}
                <MessageRow
                  message={m}
                  bubble={{
                    id: m.id,
                    author: isMe ? "me" : "them",
                    text: m.content,
                    timestamp: new Date(m.created_at).getTime(),
                  }}
                  currentUserId={currentUserId}
                  onToggleReaction={onToggleReaction}
                  onDeleteMessage={isMe ? onDeleteMessage : undefined}
                />
              </div>

              {isMe && (
                <Avatar
                  size="sm"
                  avatarUrl={myAvatarUrl}
                  handle={myHandle}
                  className="mt-px shrink-0 self-end"
                />
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </main>
  );
}

function ChatMedia({ url, mediaType }: { url: string; mediaType: string | null }) {
  const src = resolveMediaUrl(url) ?? url;
  return mediaType?.startsWith("video") ? (
    <video src={src} controls className="max-h-72 w-full bg-black" />
  ) : (
    <img src={src} alt="" className="max-h-72 w-full object-cover" loading="lazy" decoding="async" />
  );
}
