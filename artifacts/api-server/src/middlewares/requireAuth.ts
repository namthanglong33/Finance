import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/jwt.js";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.token as string | undefined;
  if (!token) {
    res.status(401).json({ error: "Chưa đăng nhập" });
    return;
  }
  try {
    const payload = verifyToken(token);
    (req as Request & { user: typeof payload }).user = payload;
    next();
  } catch {
    res.status(401).json({ error: "Phiên đăng nhập hết hạn" });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.token as string | undefined;
  if (!token) {
    res.status(401).json({ error: "Chưa đăng nhập" });
    return;
  }
  try {
    const payload = verifyToken(token);
    if (payload.role !== "admin") {
      res.status(403).json({ error: "Không có quyền admin" });
      return;
    }
    (req as Request & { user: typeof payload }).user = payload;
    next();
  } catch {
    res.status(401).json({ error: "Phiên đăng nhập hết hạn" });
  }
}
