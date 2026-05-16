import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { AuthUser } from "./types.js";

const secret = process.env.JWT_SECRET ?? "dev-secret-change-me";

export function signToken(user: AuthUser): string {
  return jwt.sign({ sub: user.id, email: user.email }, secret, { expiresIn: "30d" });
}

export function verifyToken(token: string): AuthUser | null {
  try {
    const payload = jwt.verify(token, secret) as { sub: string; email: string };
    return { id: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const user = verifyToken(token);
  if (!user) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
  req.user = user;
  next();
}
