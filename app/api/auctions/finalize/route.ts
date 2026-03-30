import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/auth/session";

const FinalizeAuctionSchema = z.object({
  gameId: z.string().min(1),
});

function clampNonNegative(n: number) {
  return n < 0 ? 0 : n;
}

export async function POST(req: Request) {
  const session = getSessionFromCookies();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = FinalizeAuctionSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const maxAssignments = 500; // basic safety

  const result = await prisma.$transaction(async (tx) => {
    const game = await tx.game.findUnique({
      where: { id: parsed.data.gameId },
      select: { id: true, maxPlayersPerTeam: true },
    });
    if (!game) return { ok: false as const, error: "Game not found" };

    const openAuctions = await tx.auction.findMany({
      where: { gameId: game.id, status: "OPEN" },
      select: { id: true, playerId: true },
      take: maxAssignments,
    });
    if (openAuctions.length === 0) return { ok: true as const, finalizedCount: 0, assignedCount: 0 };

    const auctionIds = openAuctions.map((a) => a.id);

    const bids = await tx.bid.findMany({
      where: { auctionId: { in: auctionIds } },
      select: { auctionId: true, franchiseId: true, amount: true },
    });

    const bidsByAuction = new Map<string, Array<{ franchiseId: string; amount: number }>>();
    for (const b of bids) {
      const arr = bidsByAuction.get(b.auctionId) ?? [];
      arr.push({ franchiseId: b.franchiseId, amount: b.amount });
      bidsByAuction.set(b.auctionId, arr);
    }

    const winners = openAuctions
      .map((a) => {
        const list = bidsByAuction.get(a.id) ?? [];
        if (list.length === 0) return null;
        list.sort((x, y) => y.amount - x.amount);
        const top = list[0];
        return { auction: a, topBid: top };
      })
      .filter(Boolean) as Array<{ auction: { id: string; playerId: string }; topBid: { franchiseId: string; amount: number } }>;

    const uniqueWinnerFranchiseIds = Array.from(new Set(winners.map((w) => w.topBid.franchiseId)));

    const [teamPlayers, franchises] = await Promise.all([
      tx.teamPlayer.findMany({
        where: {
          gameId: game.id,
          ...(uniqueWinnerFranchiseIds.length
            ? { franchiseId: { in: uniqueWinnerFranchiseIds } }
            : {}),
        },
        select: { franchiseId: true, bidAmount: true },
      }),
      tx.franchiseProfile.findMany({
        where: {
          ...(uniqueWinnerFranchiseIds.length ? { id: { in: uniqueWinnerFranchiseIds } } : {}),
        },
        select: { id: true, budget: true },
      }),
    ]);

    const budgetByFranchise = new Map<string, number>();
    for (const f of franchises) budgetByFranchise.set(f.id, f.budget);

    const rosterCountByFranchise = new Map<string, number>();
    const spendByFranchise = new Map<string, number>();

    for (const tp of teamPlayers) {
      rosterCountByFranchise.set(tp.franchiseId, (rosterCountByFranchise.get(tp.franchiseId) ?? 0) + 1);
      spendByFranchise.set(tp.franchiseId, (spendByFranchise.get(tp.franchiseId) ?? 0) + tp.bidAmount);
    }

    // Allocate highest bid winners first (deterministic, budget-aware).
    winners.sort((a, b) => b.topBid.amount - a.topBid.amount);

    let assignedCount = 0;
    let skippedBudget = 0;
    let skippedSlots = 0;
    const finalizedAuctionIds: string[] = [];

    for (const openAuction of openAuctions) {
      const win = winners.find((w) => w.auction.id === openAuction.id);
      if (!win) {
        await tx.auction.update({
          where: { id: openAuction.id },
          data: { status: "FINALIZED", winnerFranchiseId: null, finalizedAt: new Date() },
        });
        finalizedAuctionIds.push(openAuction.id);
        continue;
      }

      const { franchiseId } = win.topBid;
      const amount = win.topBid.amount;
      const budget = budgetByFranchise.get(franchiseId) ?? 0;

      const rosterCount = rosterCountByFranchise.get(franchiseId) ?? 0;
      const spend = spendByFranchise.get(franchiseId) ?? 0;
      const remainingBudget = clampNonNegative(budget - spend);

      if (rosterCount >= game.maxPlayersPerTeam) {
        skippedSlots += 1;
        await tx.auction.update({
          where: { id: openAuction.id },
          data: { status: "FINALIZED", winnerFranchiseId: null, finalizedAt: new Date() },
        });
        finalizedAuctionIds.push(openAuction.id);
        continue;
      }

      if (remainingBudget < amount) {
        skippedBudget += 1;
        await tx.auction.update({
          where: { id: openAuction.id },
          data: { status: "FINALIZED", winnerFranchiseId: null, finalizedAt: new Date() },
        });
        finalizedAuctionIds.push(openAuction.id);
        continue;
      }

      // Assign player to the franchise.
      await tx.teamPlayer.create({
        data: {
          gameId: game.id,
          franchiseId,
          playerId: openAuction.playerId,
          auctionId: openAuction.id,
          bidAmount: amount,
        },
      });

      rosterCountByFranchise.set(franchiseId, rosterCount + 1);
      spendByFranchise.set(franchiseId, spend + amount);

      await tx.auction.update({
        where: { id: openAuction.id },
        data: { status: "FINALIZED", winnerFranchiseId: franchiseId, finalizedAt: new Date() },
      });

      assignedCount += 1;
      finalizedAuctionIds.push(openAuction.id);
    }

    return {
      ok: true as const,
      finalizedCount: finalizedAuctionIds.length,
      assignedCount,
      skippedBudget,
      skippedSlots,
    };
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}

