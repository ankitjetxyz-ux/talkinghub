import type { DbMessage } from "@/lib/api-types";
import type { Message } from "@/lib/types";
import { MessageBubble } from "@/components/MessageBubble";
import { summarizeReactions } from "@/lib/reactionsSummary";

export const QUICK_REACTION_EMOJI = ["👍", "❤️", "😂", "😮", "🔥", "🙏"] as const;

export function MessageActions({
  messageId,
  isMine,
  onToggleReaction,
  onDeleteMessage,
}: {
  messageId: string;
  isMine: boolean;
  onToggleReaction: (messageId: string, emoji: string) => void;
  onDeleteMessage?: (messageId: string) => void;
}) {
  return (
    <div
      className={[
        "flex items-center gap-0.5 rounded-full border border-border/70 bg-black/85 px-1 py-0.5 shadow-xl backdrop-blur-sm",
        "opacity-95 sm:pointer-events-none sm:opacity-0 sm:transition-opacity sm:duration-150",
        "sm:group-hover/msg:pointer-events-auto sm:group-hover/msg:opacity-100 sm:focus-within:pointer-events-auto sm:focus-within:opacity-100",
      ].join(" ")}
      role="toolbar"
      aria-label="Quick actions"
    >
      {QUICK_REACTION_EMOJI.map((emoji) => (
        <button
          key={emoji}
          type="button"
          className="flex size-9 items-center justify-center rounded-full text-base leading-none text-foreground hover:bg-muted/80 active:scale-95 max-sm:size-10 max-sm:text-lg sm:size-9 sm:text-base"
          onClick={(e) => {
            e.stopPropagation();
            onToggleReaction(messageId, emoji);
          }}
          title="React"
        >
          <span aria-hidden>{emoji}</span>
        </button>
      ))}
      {isMine && onDeleteMessage ? (
        <button
          type="button"
          className="ml-0.5 flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/25 hover:text-destructive-foreground active:scale-95 sm:size-9"
          onClick={(e) => {
            e.stopPropagation();
            onDeleteMessage(messageId);
          }}
          aria-label="Delete message"
          title="Delete message"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" strokeLinecap="round" strokeLinejoin="round" />
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

  return (
    <div className={`group/msg relative flex w-full flex-col gap-1 ${isMe ? "items-end" : "items-start"}`}>
      <div className={`flex w-full px-0.5 ${isMe ? "justify-end" : "justify-start"}`}>
        <MessageActions
          messageId={message.id}
          isMine={isMe}
          onToggleReaction={onToggleReaction}
          onDeleteMessage={onDeleteMessage}
        />
      </div>

      <MessageBubble compact message={bubble} />

      {rows.length > 0 ? (
        <div
          className={`mt-1 flex w-full max-w-full flex-wrap gap-2 px-0.5 ${isMe ? "justify-end" : "justify-start"}`}
        >
          {rows.map((r) => (
            <button
              key={`${message.id}.${r.emoji}`}
              type="button"
              onClick={() => onToggleReaction(message.id, r.emoji)}
              className={[
                "rounded-full border px-2.5 py-0.5 text-sm transition active:scale-95 hover:bg-muted/60",
                r.iReacted
                  ? "border-foreground/50 bg-muted/40 font-medium"
                  : "border-border/50 bg-muted/20 text-muted-foreground",
              ].join(" ")}
            >
              <span>{r.emoji}</span>
              {r.count > 1 ? <span className="ml-2 text-muted-foreground tabular-nums">{r.count}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
