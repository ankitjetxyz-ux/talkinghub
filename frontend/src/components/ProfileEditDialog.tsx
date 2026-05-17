import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { Profile } from "@/lib/api-types";
import { Avatar } from "@/components/Avatar";

interface Props {
  profile: Profile;
  open: boolean;
  onClose: () => void;
  onUpdated: (profile: Profile) => void;
}

export function ProfileEditDialog({
  profile,
  open,
  onClose,
  onUpdated,
}: Props) {
  const [name, setName] = useState(profile.display_name);
  const [username, setUsername] = useState(profile.handle);
  const [busy, setBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setName(profile.display_name);
      setUsername(profile.handle);
    }
  }, [open, profile]);

  if (!open) return null;

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const updated = await api.updateProfile({
        display_name: name.trim(),
        handle: username.toLowerCase().replace(/[^a-z0-9_]/g, ""),
      });
      onUpdated(updated);
      onClose();
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function onPickAvatar(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    setAvatarBusy(true);
    try {
      const { url } = await api.uploadAvatar(file);
      const updated = await api.updateProfile({ avatar_url: url });
      onUpdated(updated);
      toast.success("Photo updated");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not upload photo",
      );
    } finally {
      setAvatarBusy(false);
    }
  }

  async function removeAvatar() {
    setAvatarBusy(true);
    try {
      const updated = await api.updateProfile({ avatar_url: null });
      onUpdated(updated);
      toast.success("Photo removed");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not remove photo",
      );
    } finally {
      setAvatarBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-background/70 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={save}
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-xl"
      >
        <h2 className="text-lg font-semibold text-foreground">
          Profile &amp; settings
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Your username and photo can be visible to others in chats.
        </p>

        <div className="mt-5 flex flex-col items-center gap-3">
          <Avatar
            avatarUrl={profile.avatar_url}
            handle={profile.handle}
            size="lg"
          />
          <div className="flex flex-wrap items-center justify-center gap-2">
            <label className="cursor-pointer rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-muted">
              {avatarBusy ? "Working…" : "Change photo"}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={avatarBusy}
                onChange={(e) => void onPickAvatar(e.target.files?.[0] ?? null)}
              />
            </label>
            {profile.avatar_url ? (
              <button
                type="button"
                disabled={avatarBusy}
                onClick={() => void removeAvatar()}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-40"
              >
                Remove photo
              </button>
            ) : null}
          </div>
        </div>

        <label className="mt-5 block">
          <span className="mb-2 block text-sm font-medium">Name (private)</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            required
          />
        </label>

        <label className="mt-4 block">
          <span className="mb-2 block text-sm font-medium">Username</span>
          <input
            value={username}
            onChange={(e) =>
              setUsername(
                e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""),
              )
            }
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            required
          />
        </label>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || avatarBusy}
            className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-40"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
