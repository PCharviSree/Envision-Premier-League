import jwt from "jsonwebtoken";

export const JWT_COOKIE_NAME = "token";

export type JwtPayload = {
  sub: string;
  role: "ADMIN" | "FRANCHISE_OWNER" | "PLAYER";
};

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Missing JWT_SECRET");
  return secret;
}

export function signJwt(payload: JwtPayload) {
  const expiresInSeconds = Number(process.env.JWT_EXPIRES_IN_SECONDS ?? "604800");
  return jwt.sign(payload, getJwtSecret(), { expiresIn: expiresInSeconds });
}

export function verifyJwt(token: string): JwtPayload {
  const decoded = jwt.verify(token, getJwtSecret());
  if (typeof decoded === "string" || !decoded) throw new Error("Invalid token");
  const { sub, role } = decoded as JwtPayload;
  if (!sub || !role) throw new Error("Invalid token payload");
  return { sub, role };
}

