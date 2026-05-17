import { useCallback, useEffect, useRef, useState } from "react";
import type { DbMessage } from "@/lib/api-types";
import type { Message } from "@/lib/types";
import { MessageBubble } from "@/components/MessageBubble";
import { summarizeReactions } from "@/lib/reactionsSummary";
import { useLongPress } from "@/hooks/useLongPress";

export const QUICK_REACTION_EMOJI = [
  "👍",
  "❤️",
  "😂",
  "😮",
  "🔥",
  "🙏",
] as const;

export function MessageActions({
  messageId,
  isMine,
  open,
  onToggleReaction,
  onDeleteMessage,
  onClose,
}: {
  messageId: string;
  isMine: boolean;
  open: boolean;
  onToggleReaction: (messageId: string, emoji: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="flex items-center gap-0.5 rounded-full border border-border/70 bg-black/90 px-1 py-0.5 shadow-xl backdrop-blur-sm animate-in fade-in zoom-in-95 duration-150"
      role="toolbar"
      aria-label="React to message"
    >
      {QUICK_REACTION_EMOJI.map((emoji) => (
        <button
          key={emoji}
          type="button"
          className="flex size-10 items-center justify-center rounded-full text-lg leading-none text-foreground hover:bg-muted/80 active:scale-95"
          onClick={(e) => {
            e.stopPropagation();
            onToggleReaction(messageId, emoji);
            onClose();
          }}
          title="React"
        >
          <span aria-hidden>{emoji}</span>
        </button>
      ))}
      {isMine && onDeleteMessage ? (
        <button
          type="button"
          className="ml-0.5 flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/25 hover:text-destructive-foreground active:scale-95"
          onClick={(e) => {
            e.stopPropagation();
            onDeleteMessage(messageId);
            onClose();
          }}
          aria-label="Delete message"
          title="Delete message"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path
              d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M10 11v6M14 11v6" strokeLinecap="round" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}

export function MessageRow({
  message,
  bubble,
  currentUserId,
  onToggleReaction,
  onDeleteMessage,
}: {
  message: DbMessage;
  bubble: Message;
  currentUserId: string;
  onToggleReaction: (messageId: string, emoji: string) => void;
  onDeleteMessage?: (messageId: string) => void;
}) {
  const isMe = bubble.author === "me";
  const rows = summarizeReactions(message.reactions, currentUserId);
  const [actionsOpen, setActionsOpen] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);

  const openActions = useCallback(() => setActionsOpen(true), []);
  const closeActions = useCallback(() => setActionsOpen(false), []);

  const longPress = useLongPress(openActions);

  useEffect(() => {
    if (!actionsOpen) return;

    const onPointerDown = (e: PointerEvent) => {
      if (rowRef.current?.contains(e.target as Node)) return;
      closeActions();
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeActions();
    };

    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [actionsOpen, closeActions]);

  return (
    <div
      ref={rowRef}
      className={`group/msg relative flex w-full flex-col gap-1 ${isMe ? "items-end" : "items-start"}`}
    >
      <div
        className={`flex w-full px-0.5 ${isMe ? "justify-end" : "justify-start"}`}
      >
        <MessageActions
          messageId={message.id}
          isMine={isMe}
          open={actionsOpen}
          onToggleReaction={onToggleReaction}
          onDeleteMessage={onDeleteMessage}
          onClose={closeActions}
        />
      </div>

      <div
        className={[
          "select-none rounded-2xl transition-transform duration-150",
          actionsOpen ? "scale-[0.98] ring-2 ring-foreground/15" : "",
        ].join(" ")}
        {...longPress}
        aria-label="Long press to react"
      >
        <MessageBubble compact message={bubble} />
      </div>

      {rows.length > 0 ? (
        <div
          className={`mt-1 flex w-full max-w-full flex-wrap gap-2 px-0.5 ${isMe ? "justify-end" : "justify-start"}`}
        >
          {rows.map((r) => (
            <span
              key={`${message.id}.${r.emoji}`}
              className={[
                "rounded-full border px-2.5 py-0.5 text-sm",
                r.iReacted
                  ? "border-foreground/50 bg-muted/40 font-medium"
                  : "border-border/50 bg-muted/20 text-muted-foreground",
              ].join(" ")}
            >
              <span>{r.emoji}</span>
              {r.count > 1 ? (
                <span className="ml-2 text-muted-foreground tabular-nums">
                  {r.count}
                </span>
              ) : null}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
