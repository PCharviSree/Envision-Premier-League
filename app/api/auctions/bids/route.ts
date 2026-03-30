import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/auth/session";

const PlaceBidSchema = z.object({
  auctionId: z.string().min(1),
  amount: z.number().int().min(0).max(100000000),
});

export async function POST(req: Request) {
  const session = getSessionFromCookies();
  if (!session || session.role !== "FRANCHISE_OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = PlaceBidSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const franchise = await prisma.franchiseProfile.findUnique({
    where: { userId: session.sub },
    select: { id: true },
  });
  if (!franchise) return NextResponse.json({ error: "Create your franchise first" }, { status: 400 });

  const auction = await prisma.auction.findUnique({
    where: { id: parsed.data.auctionId },
    select: { status: true, player: { select: { isBanned: true } } },
  });
  if (!auction) return NextResponse.json({ error: "Auction not found" }, { status: 404 });
  if (auction.status !== "OPEN") return NextResponse.json({ error: "Auction is not open" }, { status: 400 });
  if (auction.player.isBanned) return NextResponse.json({ error: "Player is banned" }, { status: 403 });

  const bid = await prisma.bid.upsert({
    where: { auctionId_franchiseId: { auctionId: parsed.data.auctionId, franchiseId: franchise.id } },
    create: { auctionId: parsed.data.auctionId, franchiseId: franchise.id, amount: parsed.data.amount },
    update: { amount: parsed.data.amount },
    select: { id: true, auctionId: true, franchiseId: true, amount: true },
  });

  return NextResponse.json({ ok: true, bid });
}

