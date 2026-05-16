import { Router } from "express";
import bcrypt from "bcryptjs";
import { v4 as uuid } from "uuid";
import { db } from "../db.js";
import { requireAuth, signToken } from "../auth.js";
import type { Profile } from "../types.js";

const router = Router();

function uniqueHandle(base: string): string {
  let handle = base;
  let attempt = 0;
  while (
    db.prepare("SELECT 1 FROM profiles WHERE handle = ? COLLATE NOCASE").get(handle)
  ) {
    attempt += 1;
    handle = `${base}_${String(attempt).padStart(4, "0")}`;
    if (attempt > 50) break;
  }
  return handle;
}

router.post("/register", (req, res) => {
  const { email, password, display_name, handle } = req.body as {
    email?: string;
    password?: string;
    display_name?: string;
    handle?: string;
  };

  if (!email?.trim() || !password || password.length < 6) {
    res.status(400).json({ error: "Valid email and password (6+ chars) required" });
    return;
  }

  const maxUsers = Number(process.env.MAX_USERS ?? 0);
  if (maxUsers > 0) {
    const count = db.prepare("SELECT COUNT(*) as c FROM users").get() as { c: number };
    if (count.c >= maxUsers) {
      res.status(403).json({ error: "Archive is full — only two nodes allowed" });
      return;
    }
  }

  const cleanHandle = (handle ?? email.split("@")[0])
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
  if (!cleanHandle) {
    res.status(400).json({ error: "Pick a handle (letters, numbers, underscores)" });
    return;
  }

  const name = (display_name ?? cleanHandle).trim();
  if (!name) {
    res.status(400).json({ error: "Display name required" });
    return;
  }

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email.toLowerCase());
  if (existing) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }

  const id = uuid();
  const passwordHash = bcrypt.hashSync(password, 10);
  const finalHandle = uniqueHandle(cleanHandle);

  const insertUser = db.prepare(
    "INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)",
  );
  const insertProfile = db.prepare(
    "INSERT INTO profiles (id, display_name, handle) VALUES (?, ?, ?)",
  );

  const tx = db.transaction(() => {
    insertUser.run(id, email.toLowerCase(), passwordHash);
    insertProfile.run(id, name, finalHandle);
  });

  try {
    tx();
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Registration failed" });
    return;
  }

  const token = signToken({ id, email: email.toLowerCase() });
  const profile = db.prepare("SELECT * FROM profiles WHERE id = ?").get(id) as Profile;

  res.status(201).json({
    token,
    user: { id, email: email.toLowerCase() },
    profile,
  });
});

router.post("/login", (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: "Email and password required" });
    return;
  }

  const row = db
    .prepare("SELECT id, email, password_hash FROM users WHERE email = ?")
    .get(email.toLowerCase()) as { id: string; email: string; password_hash: string } | undefined;

  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const profile = db.prepare("SELECT * FROM profiles WHERE id = ?").get(row.id) as Profile;
  const token = signToken({ id: row.id, email: row.email });

  res.json({
    token,
    user: { id: row.id, email: row.email },
    profile,
  });
});

router.get("/me", requireAuth, (req, res) => {
  const profile = db.prepare("SELECT * FROM profiles WHERE id = ?").get(req.user!.id) as
    | Profile
    | undefined;
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  res.json({ user: req.user, profile });
});

export default router;
