import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { Profile } from "@/lib/api-types";
import { BrandMark } from "@/components/BrandMark";

export function ProfileSetupGate({
  draft,
  onDone,
}: {
  draft: Profile;
  onDone: (profile: Profile) => void;
}) {
  const [name, setName] = useState(draft.display_name);
  const [username, setUsername] = useState(draft.handle);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const cleanHandle = username.toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (!cleanHandle) {
      toast.error("Username: letters, numbers, and underscores only.");
      return;
    }
    if (!name.trim()) {
      toast.error("Display name is required.");
      return;
    }
    setBusy(true);
    try {
      const updated = await api.updateProfile({
        display_name: name.trim(),
        handle: cleanHandle,
        profile_setup_completed: true,
      });
      onDone(updated);
      toast.success("Profile saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save profile");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background px-4">
      <div className="mb-10 text-center">
        <BrandMark variant="compact" />
        <h1 className="mt-6 text-lg font-semibold text-foreground">
          Finish your profile
        </h1>
        <p className="mt-2 max-w-xs text-center text-sm text-muted-foreground">
          Choose how you appear in ARCHIVE. You can edit this anytime from the sidebar.
        </p>
      </div>

      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-3 rounded-2xl border border-border/60 bg-card/40 p-5"
      >
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">
            Display name
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm text-foreground outline-none transition focus:border-border"
            autoComplete="name"
            placeholder="Your name"
            required
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">
            Username / handle
          </span>
          <input
            value={username}
            onChange={(e) =>
              setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
            }
            className="w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm text-foreground outline-none transition focus:border-border"
            autoComplete="off"
            placeholder="your_handle"
            required
          />
          <span className="mt-1 block text-xs text-muted-foreground">
            Others start DMs with this handle. Lowercase, numbers, underscores.
          </span>
        </label>
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-foreground py-2.5 text-sm font-semibold text-background transition hover:opacity-90 disabled:opacity-40"
        >
          {busy ? "Saving…" : "Continue to chat"}
        </button>
      </form>
    </div>
  );
}
