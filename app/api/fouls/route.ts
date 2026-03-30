import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/auth/session";

const CreateFoulSchema = z.object({
  gameId: z.string().min(1),
  playerId: z.string().min(1),
  penaltyPoints: z.number().int().min(0).max(1000),
  reason: z.string().min(1).max(500),
});

export async function POST(req: Request) {
  const session = getSessionFromCookies();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = CreateFoulSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const foul = await prisma.foul.create({
    data: parsed.data,
    select: {
      id: true,
      gameId: true,
      playerId: true,
      penaltyPoints: true,
      reason: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ ok: true, foul });
}

