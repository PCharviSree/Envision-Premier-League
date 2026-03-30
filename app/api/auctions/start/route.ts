import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/auth/session";

const StartAuctionSchema = z.object({
  gameId: z.string().min(1),
});

export async function POST(req: Request) {
  const session = getSessionFromCookies();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = StartAuctionSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const game = await prisma.game.findUnique({ where: { id: parsed.data.gameId }, select: { id: true } });
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });

  const enrollments = await prisma.gameEnrollment.findMany({
    where: { gameId: game.id },
    select: { playerId: true },
  });

  const results = await Promise.all(
    enrollments.map((e) =>
      prisma.auction.upsert({
        where: { gameId_playerId: { gameId: game.id, playerId: e.playerId } },
        create: { gameId: game.id, playerId: e.playerId, status: "OPEN" },
        update: { status: "OPEN", winnerFranchiseId: null, finalizedAt: null },
      })
    )
  );

  return NextResponse.json({ ok: true, auctionsStarted: results.length });
}

