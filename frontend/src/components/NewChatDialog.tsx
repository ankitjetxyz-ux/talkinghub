import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (conversationId: string) => void;
}

export function NewChatDialog({ open, onClose, onCreated }: Props) {
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const clean = handle.trim().replace(/^@/, "");
      const { conversation_id } = await api.startDm(clean);
      onCreated(conversation_id);
      setHandle("");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start chat");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 px-4 backdrop-blur-sm"
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-border/60 bg-card p-5 shadow-xl"
      >
        <h2 className="text-lg font-semibold text-foreground">New chat</h2>
        <p className="mt-2 text-sm text-muted-foreground">Enter a username to start chatting.</p>
        <input
          autoFocus
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="username"
          className="mt-5 w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-border"
        />
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || !handle.trim()}
            className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-40"
          >
            {busy ? "Starting…" : "Start chat"}
          </button>
        </div>
      </form>
    </div>
  );
}
