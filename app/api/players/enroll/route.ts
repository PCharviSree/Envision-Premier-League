import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/auth/session";

const EnrollSchema = z.object({
  gameId: z.string().min(1),
});

export async function POST(req: Request) {
  const session = getSessionFromCookies();
  if (!session || session.role !== "PLAYER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = EnrollSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const player = await prisma.playerProfile.findUnique({
    where: { userId: session.sub },
    select: { id: true, isBanned: true },
  });
  if (!player) return NextResponse.json({ error: "Create your player profile first" }, { status: 400 });
  if (player.isBanned) return NextResponse.json({ error: "You are banned" }, { status: 403 });

  const game = await prisma.game.findUnique({
    where: { id: parsed.data.gameId },
    select: { id: true },
  });
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });

  const enrollment = await prisma.gameEnrollment.create({
    data: { gameId: game.id, playerId: player.id },
    select: { id: true, gameId: true, playerId: true },
  });

  return NextResponse.json({ ok: true, enrollment });
}

