import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { BrandMark } from "@/components/BrandMark";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function oauthErrorToast() {
  if (typeof window === "undefined") return;
  const sp = new URLSearchParams(window.location.search);
  const hash = window.location.hash.replace(/^#/, "");
  const h = new URLSearchParams(hash.includes("=") ? hash : "");
  const err =
    sp.get("error_description") ??
    sp.get("error_code") ??
    sp.get("error") ??
    h.get("error_description") ??
    h.get("error");
  if (!err) return;
  toast.error(decodeURIComponent(err.replace(/\+/g, " ")));
  const clean = `${window.location.pathname}${window.location.hash.split("?")[0] ?? ""}`;
  window.history.replaceState({}, "", clean);
}

function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    oauthErrorToast();
  }, []);

  useEffect(() => {
    if (!user) return;
    const { search, hash, pathname } = window.location;
    if (search || (hash && hash.length > 1)) {
      window.history.replaceState({}, "", pathname);
    }
  }, [user]);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/", replace: true });
  }, [loading, user, navigate]);

  async function continueWithGoogle() {
    setBusy(true);
    try {
      await api.signInWithGoogle();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not start Google sign-in",
      );
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <BrandMark variant="compact" />
          <p className="mt-5 text-sm text-muted-foreground">
            Sign in with your Google account to use Talkinghub.
          </p>
        </div>

        <button
          type="button"
          disabled={busy || loading}
          onClick={() => void continueWithGoogle()}
          className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-border/80 bg-background py-2.5 text-sm font-semibold text-foreground transition hover:bg-muted/40 disabled:opacity-40"
        >
          <GoogleGlyph />
          {busy ? "Redirecting…" : "Continue with Google"}
        </button>
      </div>
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.196-5.238A11.907 11.907 0 0 1 24 36c-5.185 0-9.591-3.319-11.284-7.946l-6.519 5.02C9.505 39.556 16.276 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083 42 20 24 20v8h11.303a12.04 12.04 0 0 1-4.087 5.571l6.194 5.238C43.068 39.086 46 34.086 46 24c0-1.342-.139-2.652-.389-3.917z"
      />
    </svg>
  );
}
