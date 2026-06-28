import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET ?? "ntl-financial-secret-key-change-in-prod";
const EXPIRES_IN = "8h";

export interface JwtPayload {
  userId: number;
  username: string;
  role: "admin" | "user";
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, SECRET) as JwtPayload;
}
