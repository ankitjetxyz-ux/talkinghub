/** Turn stored avatar/media paths into full URLs when the SPA is served from another origin/port. */
const API_BASE = (import.meta.env.VITE_API_URL ?? "http://localhost:5000").replace(/\/$/, "");

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
  return `${API_BASE}${path}`;
}
