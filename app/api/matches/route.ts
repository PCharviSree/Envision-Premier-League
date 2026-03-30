import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/auth/session";

const CreateMatchSchema = z.object({
  gameId: z.string().min(1),
  team1FranchiseId: z.string().min(1),
  team2FranchiseId: z.string().min(1),
  // Browser `datetime-local` often omits timezone; we'll parse with `new Date()` server-side.
  startTime: z.string().min(1),
  endTime: z.string().min(1),
});

function getMatchStatus(start: Date, end: Date) {
  const now = new Date();
  if (now >= start && now <= end) return "LIVE";
  if (now < start) return "UPCOMING";
  return "ENDED";
}

export async function POST(req: Request) {
  const session = getSessionFromCookies();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = CreateMatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const start = new Date(parsed.data.startTime);
  const end = new Date(parsed.data.endTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return NextResponse.json({ error: "Invalid startTime/endTime" }, { status: 400 });
  }
  if (start >= end) {
    return NextResponse.json({ error: "startTime must be before endTime" }, { status: 400 });
  }

  const match = await prisma.match.create({
    data: {
      gameId: parsed.data.gameId,
      team1FranchiseId: parsed.data.team1FranchiseId,
      team2FranchiseId: parsed.data.team2FranchiseId,
      startTime: start,
      endTime: end,
    },
    select: {
      id: true,
      gameId: true,
      team1FranchiseId: true,
      team2FranchiseId: true,
      startTime: true,
      endTime: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ ok: true, match });
}

export async function GET(req: Request) {
  const session = getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const gameId = url.searchParams.get("gameId");

  const matches = await prisma.match.findMany({
    where: {
      ...(gameId ? { gameId } : {}),
    },
    orderBy: { startTime: "asc" },
    select: {
      id: true,
      gameId: true,
      team1FranchiseId: true,
      team2FranchiseId: true,
      startTime: true,
      endTime: true,
    },
  });

  const franchiseIds = Array.from(
    new Set(matches.flatMap((m) => [m.team1FranchiseId, m.team2FranchiseId]))
  );
  const franchises = franchiseIds.length
    ? await prisma.franchiseProfile.findMany({
        where: { id: { in: franchiseIds } },
        select: { id: true, name: true },
      })
    : [];
  const franchiseById = new Map(franchises.map((f) => [f.id, f.name]));

  return NextResponse.json({
    ok: true,
    matches: matches.map((m) => ({
      ...m,
      status: getMatchStatus(m.startTime, m.endTime),
      team1Name: franchiseById.get(m.team1FranchiseId) ?? null,
      team2Name: franchiseById.get(m.team2FranchiseId) ?? null,
    })),
  });
}

