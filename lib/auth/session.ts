import { cookies } from "next/headers";
import { JWT_COOKIE_NAME, type JwtPayload, verifyJwt } from "./jwt";

export type SessionUser = Pick<JwtPayload, "sub" | "role">;

export function getSessionFromCookies(): SessionUser | null {
  const cookieStore = cookies();
  const token = cookieStore.get(JWT_COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const payload = verifyJwt(token);
    return payload;
  } catch {
    return null;
  }
}

