import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ensureDesk } from "@/lib/desk";

export async function POST() {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }
  const user = await ensureDesk();
  await prisma.facebookAccount.deleteMany({ where: { userId: user.id } });
  return NextResponse.json({ ok: true });
}
