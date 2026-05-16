import type { Message } from "@/lib/types";
import { formatMessage } from "@/lib/formatMessage";

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function MessageBubble({
  message,
  compact,
}: {
  message: Message;
  /** Omit outer alignment row — parent aligns like WhatsApp rails */
  compact?: boolean;
}) {
  const isMe = message.author === "me";

  const bubbleShape = isMe
    ? "rounded-2xl rounded-br-md border-emerald-800/35 bg-emerald-950/80 text-foreground"
    : "rounded-2xl rounded-bl-md border-border/35 bg-muted/70 text-foreground";

  const inner = (
    <div
      className={`group relative flex w-fit max-w-full flex-col gap-1 ${isMe ? "items-end" : "items-start"}`}
    >
      <div className={[bubbleShape, "inline-flex max-w-full flex-col border px-3.5 py-2 text-sm leading-relaxed shadow-sm"].join(" ")}>
        {formatMessage(message.text)}
      </div>
      <span
        className={[
          "text-[11px] text-muted-foreground opacity-70 transition-opacity",
          "px-1 opacity-0 group-hover:opacity-100 sm:opacity-100",
          isMe ? "pr-1 text-right" : "pl-1 text-left",
        ].join(" ")}
      >
        {formatTime(message.timestamp)}
      </span>
    </div>
  );

  if (compact) return inner;

  return (
    <div className={`flex w-full ${isMe ? "justify-end" : "justify-start"}`}>
      <div className="max-w-[min(85%,28rem)]">{inner}</div>
    </div>
  );
}
