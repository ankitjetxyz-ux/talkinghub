import { useEffect } from "react";
import { Ghost } from "lucide-react";
import { DecoySnapScreen } from "@/components/decoy/DecoySnapScreen";
import { useHorizontalSwipe } from "@/hooks/useHorizontalSwipe";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  /** Attach swipe listeners to this wrapper (chat column). */
  children: React.ReactNode;
}

export function DecoyOverlay({ open, onOpen, onClose, children }: Props) {
  const swipeChat = useHorizontalSwipe(onOpen, undefined);
  const swipeDecoy = useHorizontalSwipe(undefined, onClose);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <div
        className="relative flex min-h-0 min-w-0 flex-1 flex-col"
        {...swipeChat}
      >
        {children}

        {!open ? (
          <button
            type="button"
            onClick={onOpen}
            className="absolute bottom-20 right-3 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-border/80 bg-background/95 text-muted-foreground shadow-lg backdrop-blur-sm transition hover:bg-muted hover:text-foreground md:bottom-6"
            aria-label="Open Snapchat cover"
            title="Snapchat cover (swipe left)"
          >
            <Ghost className="h-5 w-5" strokeWidth={1.5} />
          </button>
        ) : null}
      </div>

      <div
        className={cn(
          "fixed inset-0 z-[200] transition-transform duration-300 ease-out will-change-transform",
          open ? "translate-x-0" : "pointer-events-none translate-x-full",
        )}
        aria-hidden={!open}
        {...(open ? swipeDecoy : {})}
      >
        <DecoySnapScreen onClose={onClose} />
      </div>
    </>
  );
}
