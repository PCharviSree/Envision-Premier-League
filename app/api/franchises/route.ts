import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/auth/session";

const CreateFranchiseSchema = z.object({
  name: z.string().min(1).max(100),
  budget: z.number().int().min(0).max(1000000),
});

export async function POST(req: Request) {
  const session = getSessionFromCookies();
  if (!session || session.role !== "FRANCHISE_OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = CreateFranchiseSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await prisma.franchiseProfile.findUnique({
    where: { userId: session.sub },
  });
  if (existing) {
    return NextResponse.json({ error: "Franchise already exists" }, { status: 409 });
  }

  const franchise = await prisma.franchiseProfile.create({
    data: { userId: session.sub, name: parsed.data.name, budget: parsed.data.budget },
    select: { id: true, userId: true, name: true, budget: true, createdAt: true },
  });

  return NextResponse.json({ ok: true, franchise });
}

export async function GET() {
  const session = getSessionFromCookies();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const franchises = await prisma.franchiseProfile.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, userId: true, name: true, budget: true, createdAt: true },
  });

  return NextResponse.json({ ok: true, franchises });
}

