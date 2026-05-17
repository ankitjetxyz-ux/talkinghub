/** Resolve stored media URLs for <img /> (full Supabase public URLs or legacy relative paths). */

function stripTrailingSlash(s: string): string {
  return s.endsWith("/") ? s.slice(0, -1) : s;
}

/** Legacy `/uploads/...` paths from the old API use this origin when not absolute. */
function relativeAssetOrigin(): string {
  const api =
    typeof import.meta.env.VITE_API_URL === "string"
      ? import.meta.env.VITE_API_URL.trim()
      : "";
  if (api) return stripTrailingSlash(api);

  if (import.meta.env.DEV) return "http://localhost:5000";

  if (typeof window !== "undefined")
    return window.location.origin.replace(/\/$/, "");

  return "";
}

export function resolveMediaUrl(url: string | null | undefined): string | null {
  if (url == null) return null;
  const t = String(url).trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  if (t.startsWith("//")) {
    if (typeof window === "undefined") return `https:${t}`;
    return `${window.location.protocol}${t}`;
  }
  const path = t.startsWith("/") ? t : `/${t}`;
  const origin = relativeAssetOrigin();
  return origin ? `${origin}${path}` : path;
}
