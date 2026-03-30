import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/auth/session";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export async function GET(req: Request) {
  const session = getSessionFromCookies();
  if (!session || session.role !== "FRANCHISE_OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const gameId = url.searchParams.get("gameId");
  if (!gameId) return NextResponse.json({ error: "Missing gameId" }, { status: 400 });

  const franchise = await prisma.franchiseProfile.findUnique({
    where: { userId: session.sub },
    select: { id: true },
  });
  if (!franchise) {
    return NextResponse.json({ error: "Create your franchise first" }, { status: 400 });
  }

  const assigned = await prisma.teamPlayer.findMany({
    where: { gameId, franchiseId: franchise.id },
    select: { playerId: true },
  });
  const assignedIds = assigned.map((a) => a.playerId);

  const enrollments = await prisma.gameEnrollment.findMany({
    where: {
      gameId,
      ...(assignedIds.length ? { playerId: { notIn: assignedIds } } : {}),
    },
    select: { playerId: true },
  });

  const candidatePlayerIds = enrollments.map((e) => e.playerId);
  if (candidatePlayerIds.length === 0) {
    return NextResponse.json({ ok: true, recommendations: [] });
  }

  const [profiles, skills, fouls] = await Promise.all([
    prisma.playerProfile.findMany({
      where: { id: { in: candidatePlayerIds } },
      select: { id: true, psid: true, isBanned: true },
    }),
    prisma.playerSkill.findMany({
      where: { gameId, playerId: { in: candidatePlayerIds } },
      select: { playerId: true, skillType: true, rating: true },
    }),
    prisma.foul.findMany({
      where: { gameId, playerId: { in: candidatePlayerIds } },
      select: { playerId: true, penaltyPoints: true },
    }),
  ]);

  const profileById = new Map(profiles.map((p) => [p.id, p]));

  const bestSkillByPlayer = new Map<string, { skillType: string; rating: number }>();
  for (const s of skills) {
    const prev = bestSkillByPlayer.get(s.playerId);
    if (!prev || s.rating > prev.rating) {
      bestSkillByPlayer.set(s.playerId, { skillType: s.skillType, rating: s.rating });
    }
  }

  const penaltySumByPlayer = new Map<string, number>();
  for (const f of fouls) {
    penaltySumByPlayer.set(
      f.playerId,
      (penaltySumByPlayer.get(f.playerId) ?? 0) + f.penaltyPoints
    );
  }

  const performance = 50; // MVP mock until you record match-by-match stats
  const recommendations = candidatePlayerIds
    .map((playerId) => {
      const p = profileById.get(playerId);
      if (!p || p.isBanned) return null;

      const bestSkill = bestSkillByPlayer.get(playerId);
      const skillRating = bestSkill?.rating ?? 0;
      const bestSkillType = bestSkill?.skillType ?? null;

      const totalPenaltyPoints = penaltySumByPlayer.get(playerId) ?? 0;
      const disciplineRating = clamp(100 - totalPenaltyPoints, 0, 100);

      const score = 0.4 * skillRating + 0.4 * performance + 0.2 * disciplineRating;

      return {
        playerId,
        psid: p.psid,
        bestSkillType,
        skillRating,
        disciplineRating,
        score,
      };
    })
    .filter(Boolean) as Array<{
      playerId: string;
      psid: string;
      bestSkillType: string | null;
      skillRating: number;
      disciplineRating: number;
      score: number;
    }>;

  recommendations.sort((a, b) => b.score - a.score);

  return NextResponse.json({
    ok: true,
    recommendations: recommendations.slice(0, 10),
  });
}

