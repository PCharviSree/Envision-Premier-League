import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/auth/session";

export async function GET(req: Request) {
  const session = getSessionFromCookies();
  if (!session || (session.role !== "FRANCHISE_OWNER" && session.role !== "ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const gameId = url.searchParams.get("gameId");
  if (!gameId) return NextResponse.json({ error: "Missing gameId" }, { status: 400 });

  const openAuctions = await prisma.auction.findMany({
    where: { gameId, status: "OPEN" },
    select: { id: true, playerId: true },
    orderBy: { id: "asc" },
  });

  const auctionIds = openAuctions.map((a) => a.id);
  const playerIds = openAuctions.map((a) => a.playerId);

  const [players, bids] = await Promise.all([
    playerIds.length
      ? prisma.playerProfile.findMany({
          where: { id: { in: playerIds } },
          select: { id: true, psid: true, isBanned: true },
        })
      : Promise.resolve([]),
    auctionIds.length
      ? prisma.bid.findMany({
          where: { auctionId: { in: auctionIds } },
          select: { auctionId: true, franchiseId: true, amount: true },
          orderBy: { amount: "desc" },
        })
      : Promise.resolve([]),
  ]);

  const playerById = new Map(players.map((p) => [p.id, p]));
  const myFranchise =
    session.role === "FRANCHISE_OWNER"
      ? await prisma.franchiseProfile.findUnique({
          where: { userId: session.sub },
          select: { id: true },
        })
      : null;

  const highestBidByAuction = new Map<string, { franchiseId: string; amount: number }>();
  const myBidByAuction = new Map<string, number>();
  for (const b of bids) {
    if (!highestBidByAuction.has(b.auctionId)) {
      highestBidByAuction.set(b.auctionId, { franchiseId: b.franchiseId, amount: b.amount });
    }
    if (myFranchise && b.franchiseId === myFranchise.id && !myBidByAuction.has(b.auctionId)) {
      myBidByAuction.set(b.auctionId, b.amount);
    }
  }

  return NextResponse.json({
    ok: true,
    auctions: openAuctions.map((a) => {
      const p = playerById.get(a.playerId);
      const hb = highestBidByAuction.get(a.id);
      const myBid = myBidByAuction.get(a.id);
      return {
        auctionId: a.id,
        playerId: a.playerId,
        psid: p?.psid ?? null,
        isBanned: p?.isBanned ?? false,
        highestBidAmount: hb?.amount ?? null,
        highestBidFranchiseId: hb?.franchiseId ?? null,
        myBidAmount: myBid ?? null,
      };
    }),
  });
}

