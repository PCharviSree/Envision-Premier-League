import { NextResponse } from "next/server";
import { getSessionFromCookies } from "./session";
import type { JwtPayload } from "./jwt";

export function requireRole(
  session: ReturnType<typeof getSessionFromCookies>,
  allowed: Array<JwtPayload["role"]>
) {
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!allowed.includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return session;
}

