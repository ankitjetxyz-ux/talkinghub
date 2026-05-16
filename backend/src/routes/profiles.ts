import { Router } from "express";
import { db } from "../db.js";
import { requireAuth } from "../auth.js";
import type { Profile } from "../types.js";
import { notifyMemberIds } from "../ws.js";

const router = Router();

router.use(requireAuth);

function publicOrigin(): string {
  const port = process.env.PORT ?? "5000";
  return process.env.PUBLIC_URL ?? `http://localhost:${port}`;
}

/** Only allow uploads served from our own origin — prevents phishing / open redirect in profile URLs. */
function isAllowedAvatarUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    return false;
  }
  try {
    if (u.origin !== new URL(publicOrigin()).origin) return false;
  } catch {
    return false;
  }
  if (!u.pathname.startsWith("/uploads/")) return false;
  const slug = u.pathname.slice("/uploads/".length);
  if (!slug || slug.includes("/") || slug.includes("..")) return false;
  return /^[\w.-]+$/.test(slug);
}

function watchersFor(userId: string): string[] {
  const rows = db
    .prepare(
      `SELECT DISTINCT m2.user_id AS id FROM conversation_members m1
       JOIN conversation_members m2 ON m2.conversation_id = m1.conversation_id
       WHERE m1.user_id = ?`,
    )
    .all(userId) as { id: string }[];
  return rows.map((r) => r.id);
}

router.get("/handle/:handle", (req, res) => {
  const profile = db
    .prepare("SELECT * FROM profiles WHERE handle = ? COLLATE NOCASE")
    .get(req.params.handle) as Profile | undefined;
  if (!profile) {
    res.status(404).json({ error: "No such username" });
    return;
  }
  res.json(profile);
});

router.patch("/me", (req, res) => {
  const userId = req.user!.id;
  const body = req.body as {
    display_name?: string;
    handle?: string;
    avatar_url?: string | null;
  };

  const current = db.prepare("SELECT * FROM profiles WHERE id = ?").get(userId) as
    | Profile
    | undefined;
  if (!current) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  let nextName = current.display_name;
  let nextHandle = current.handle;
  let nextAvatar = current.avatar_url;

  if (body.display_name !== undefined) {
    const name = body.display_name.trim();
    if (!name) {
      res.status(400).json({ error: "Name cannot be empty" });
      return;
    }
    nextName = name;
  }

  if (body.handle !== undefined) {
    const clean = body.handle.toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (!clean) {
      res.status(400).json({ error: "Username can only use letters, numbers, and underscores" });
      return;
    }
    const taken = db
      .prepare("SELECT id FROM profiles WHERE handle = ? COLLATE NOCASE AND id != ?")
      .get(clean, userId);
    if (taken) {
      res.status(409).json({ error: "Username is already taken" });
      return;
    }
    nextHandle = clean;
  }

  if (body.avatar_url !== undefined) {
    const v = body.avatar_url;
    if (v === null || v === "") {
      nextAvatar = null;
    } else if (typeof v !== "string" || !isAllowedAvatarUrl(v)) {
      res.status(400).json({ error: "Avatar must be an image uploaded to this server (invalid URL)." });
      return;
    } else {
      nextAvatar = v.trim();
    }
  }

  db.prepare("UPDATE profiles SET display_name = ?, handle = ?, avatar_url = ? WHERE id = ?").run(
    nextName,
    nextHandle,
    nextAvatar,
    userId,
  );

  const profile = db.prepare("SELECT * FROM profiles WHERE id = ?").get(userId) as Profile;
  notifyMemberIds(watchersFor(userId), "profile_updated", { profile });

  res.json(profile);
});

router.get("/:id", (req, res) => {
  const profile = db.prepare("SELECT * FROM profiles WHERE id = ?").get(req.params.id) as
    | Profile
    | undefined;
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  res.json(profile);
});

export default router;
