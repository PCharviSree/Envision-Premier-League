import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/auth/session";

export async function GET() {
  const session = getSessionFromCookies();
  if (!session || session.role !== "FRANCHISE_OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const franchise = await prisma.franchiseProfile.findUnique({
    where: { userId: session.sub },
    select: { id: true, userId: true, name: true, budget: true, createdAt: true },
  });
  if (!franchise) return NextResponse.json({ error: "No franchise profile" }, { status: 404 });

  const [spendAgg, rosterAgg] = await Promise.all([
    prisma.teamPlayer.aggregate({
      where: { franchiseId: franchise.id },
      _sum: { bidAmount: true },
    }),
    prisma.teamPlayer.aggregate({
      where: { franchiseId: franchise.id },
      _count: { id: true },
    }),
  ]);

  const spend = spendAgg._sum.bidAmount ?? 0;
  const rosterCount = rosterAgg._count.id;

  return NextResponse.json({
    ok: true,
    franchise,
    spend,
    rosterCount,
    remainingBudget: franchise.budget - spend,
  });
}

