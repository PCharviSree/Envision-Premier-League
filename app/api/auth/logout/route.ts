import { NextResponse } from "next/server";
import { JWT_COOKIE_NAME } from "@/lib/auth/jwt";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(JWT_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return res;
}

