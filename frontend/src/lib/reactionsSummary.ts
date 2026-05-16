import type { DbMessageReaction } from "@/lib/api-types";

export function summarizeReactions(
  list: DbMessageReaction[] | undefined,
  userId: string,
): { emoji: string; count: number; iReacted: boolean }[] {
  const byEmoji = new Map<string, Set<string>>();
  for (const r of list ?? []) {
    let set = byEmoji.get(r.emoji);
    if (!set) {
      set = new Set();
      byEmoji.set(r.emoji, set);
    }
    set.add(r.user_id);
  }

  return [...byEmoji.entries()]
    .map(([emoji, users]) => ({
      emoji,
      count: users.size,
      iReacted: users.has(userId),
    }))
    .sort((a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji));
}
