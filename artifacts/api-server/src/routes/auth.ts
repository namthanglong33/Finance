import { Router, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { signToken, verifyToken } from "../lib/jwt.js";
import { requireAdmin, requireAuth } from "../middlewares/requireAuth.js";

const router = Router();

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  maxAge: 8 * 60 * 60 * 1000,
  secure: process.env.NODE_ENV === "production",
};

router.post("/auth/login", async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) {
    res.status(400).json({ error: "Vui lòng nhập tài khoản và mật khẩu" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
  if (!user || !user.isActive) {
    res.status(401).json({ error: "Tài khoản không tồn tại hoặc đã bị khóa" });
    return;
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Mật khẩu không đúng" });
    return;
  }
  const token = signToken({ userId: user.id, username: user.username, role: user.role });
  res.cookie("token", token, COOKIE_OPTS);
  res.json({ username: user.username, role: user.role });
});

router.post("/auth/logout", (_req: Request, res: Response): void => {
  res.clearCookie("token");
  res.json({ ok: true });
});

router.get("/auth/me", requireAuth, (req: Request, res: Response): void => {
  const token = req.cookies?.token as string;
  const payload = verifyToken(token);
  res.json({ username: payload.username, role: payload.role });
});

router.post("/auth/users", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const { username, password, role } = req.body as { username?: string; password?: string; role?: string };
  if (!username || !password) {
    res.status(400).json({ error: "Cần nhập tài khoản và mật khẩu" });
    return;
  }
  if (role && role !== "admin" && role !== "user") {
    res.status(400).json({ error: "Role phải là admin hoặc user" });
    return;
  }
  const existing = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "Tài khoản đã tồn tại" });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const adminToken = req.cookies?.token as string;
  const adminPayload = verifyToken(adminToken);
  const [newUser] = await db.insert(usersTable).values({
    username,
    passwordHash,
    role: (role as "admin" | "user") ?? "user",
    createdBy: adminPayload.username,
  }).returning({ id: usersTable.id, username: usersTable.username, role: usersTable.role, createdAt: usersTable.createdAt });
  res.status(201).json(newUser);
});

router.get("/auth/users", requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  const users = await db.select({
    id: usersTable.id,
    username: usersTable.username,
    role: usersTable.role,
    isActive: usersTable.isActive,
    createdAt: usersTable.createdAt,
    createdBy: usersTable.createdBy,
  }).from(usersTable).orderBy(usersTable.createdAt);
  res.json(users);
});

router.patch("/auth/users/:id", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id);
  const { isActive, password } = req.body as { isActive?: boolean; password?: string };
  const updates: Partial<{ isActive: boolean; passwordHash: string }> = {};
  if (isActive !== undefined) updates.isActive = isActive;
  if (password) updates.passwordHash = await bcrypt.hash(password, 12);
  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "Không có gì để cập nhật" });
    return;
  }
  const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning({ id: usersTable.id, username: usersTable.username, isActive: usersTable.isActive });
  if (!updated) {
    res.status(404).json({ error: "Không tìm thấy tài khoản" });
    return;
  }
  res.json(updated);
});

export default router;
