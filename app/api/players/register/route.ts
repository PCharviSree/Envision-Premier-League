import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/auth/session";

const RegisterPlayerSchema = z.object({
  psid: z.string().min(1).max(100),
});

export async function POST(req: Request) {
  const session = getSessionFromCookies();
  if (!session || session.role !== "PLAYER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = RegisterPlayerSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await prisma.playerProfile.findUnique({
    where: { userId: session.sub },
  });
  if (existing) return NextResponse.json({ error: "Player profile exists" }, { status: 409 });

  const profile = await prisma.playerProfile.create({
    data: { userId: session.sub, psid: parsed.data.psid },
    select: { id: true, userId: true, psid: true, isBanned: true, createdAt: true },
  });

  return NextResponse.json({ ok: true, profile });
}

