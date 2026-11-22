import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ensureDesk } from "@/lib/desk";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }
  const desk = await ensureDesk();
  const account = await prisma.facebookAccount.findUnique({
    where: { userId: desk.id },
    include: { _count: { select: { pages: true } } },
  });
  return NextResponse.json({
    connected: Boolean(account),
    name: account?.name ?? null,
    pageCount: account?._count.pages ?? 0,
  });
}
