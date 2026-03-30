import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/auth/session";

const SkillTypeSchema = z.enum(["BATTER", "DEFENDER", "MIDFIELDER", "GOALKEEPER", "OTHER"]);

const SkillSchema = z.object({
  gameId: z.string().min(1),
  skillType: SkillTypeSchema,
  rating: z.number().int().min(0).max(100),
});

export async function POST(req: Request) {
  const session = getSessionFromCookies();
  if (!session || session.role !== "PLAYER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = SkillSchema.safeParse(json);
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

  const enrollment = await prisma.gameEnrollment.findUnique({
    where: { gameId_playerId: { gameId: parsed.data.gameId, playerId: player.id } },
    select: { id: true },
  });
  if (!enrollment) return NextResponse.json({ error: "Enroll in the game first" }, { status: 400 });

  const skill = await prisma.playerSkill.upsert({
    where: {
      gameId_playerId_skillType: {
        gameId: parsed.data.gameId,
        playerId: player.id,
        skillType: parsed.data.skillType,
      },
    },
    create: {
      gameId: parsed.data.gameId,
      playerId: player.id,
      skillType: parsed.data.skillType,
      rating: parsed.data.rating,
    },
    update: { rating: parsed.data.rating },
    select: { id: true, gameId: true, playerId: true, skillType: true, rating: true },
  });

  return NextResponse.json({ ok: true, skill });
}

