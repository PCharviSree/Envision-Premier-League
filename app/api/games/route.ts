import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/auth/session";

const CreateGameSchema = z.object({
  name: z.string().min(1).max(100),
  rules: z.string().min(1).max(2000),
  maxPlayersPerTeam: z.number().int().min(1).max(50),
  requiredPlayers: z.number().int().min(1).max(50),
});

export async function POST(req: Request) {
  const session = getSessionFromCookies();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = CreateGameSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const game = await prisma.game.create({
    data: parsed.data,
    select: {
      id: true,
      name: true,
      rules: true,
      maxPlayersPerTeam: true,
      requiredPlayers: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ ok: true, game });
}

export async function GET() {
  const games = await prisma.game.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      rules: true,
      maxPlayersPerTeam: true,
      requiredPlayers: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ ok: true, games });
}

