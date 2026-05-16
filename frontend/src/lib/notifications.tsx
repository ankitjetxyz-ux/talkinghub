import { toast } from "sonner";

import { SITE_LOGO_SRC, SITE_NAME } from "@/lib/brand";

export interface ArchiveNotification {
  top: string;
  message: string;
  bottom: string;
}

export function parseNotification(raw: string | ArchiveNotification): ArchiveNotification {
  if (typeof raw !== "string") return raw;
  const lines = raw.split("\n").filter(Boolean);
  if (lines.length >= 3) {
    return { top: lines[0], message: lines.slice(1, -1).join("\n"), bottom: lines.at(-1)! };
  }
  if (lines.length === 2) return { top: lines[0], message: lines[1], bottom: "" };
  return { top: SITE_NAME, message: raw, bottom: "" };
}

export function ArchiveNotificationCard({
  data,
  onDismiss,
}: {
  data: ArchiveNotification;
  onDismiss?: () => void;
}) {
  return (
    <motionlessNotificationCardInner data={data} onDismiss={onDismiss} />
  );
}

function motionlessNotificationCardInner({
  data,
  onDismiss,
}: {
  data: ArchiveNotification;
  onDismiss?: () => void;
}) {
  return (
    <div
      role="alert"
      className="w-[min(100vw-2rem,380px)] overflow-hidden rounded-2xl border border-border/80 bg-card shadow-lg"
    >
      <div className="flex items-center justify-between border-b border-border/50 bg-muted/40 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <img
            src={SITE_LOGO_SRC}
            alt=""
            width={28}
            height={28}
            className="size-7 shrink-0 rounded-md object-cover object-[center_22%]"
          />
          <span className="text-sm font-semibold lowercase tracking-tight text-foreground">{SITE_NAME}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">now</span>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="rounded p-0.5 text-muted-foreground hover:text-foreground"
              aria-label="Dismiss"
            >
              ×
            </button>
          )}
        </div>
      </div>
      <div className="space-y-2 px-4 pb-4 pt-1">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground sm:text-sm">
          {data.top}
        </p>
        <p className="text-base font-medium leading-snug text-foreground sm:text-lg">{data.message}</p>
        {data.bottom ? (
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground sm:text-sm">
            {data.bottom}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function showArchiveNotification(
  raw: string | ArchiveNotification,
  opts?: { push?: boolean },
) {
  const data = parseNotification(raw);

  toast.custom(
    (id) => <ArchiveNotificationCard data={data} onDismiss={() => toast.dismiss(id)} />,
    { duration: 5000, position: "top-center" },
  );

  if (opts?.push !== false && typeof window !== "undefined" && "Notification" in window) {
    if (Notification.permission === "granted" && document.visibilityState !== "visible") {
      const body = [data.top, "", data.message, data.bottom].filter(Boolean).join("\n");
      new Notification(SITE_NAME, {
        body,
        icon:
          typeof window !== "undefined" ? new URL(SITE_LOGO_SRC, window.location.origin).href : SITE_LOGO_SRC,
        tag: "talkinghub-message",
      });
    }
  }
}
