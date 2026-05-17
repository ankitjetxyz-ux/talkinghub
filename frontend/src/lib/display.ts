import type { Profile } from "@/lib/api-types";

/** Public label — username only (no display name). */
export function usernameLabel(
  profile: Pick<Profile, "handle"> | null | undefined,
): string {
  if (!profile?.handle) return "unknown";
  return `@${profile.handle}`;
}
