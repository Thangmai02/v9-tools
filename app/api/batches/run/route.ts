import { NextResponse } from "next/server";
import { requireProUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  const gate = await requireProUser();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  const body = await request.json().catch(() => null);
  const runKey = String(body?.runKey ?? "");
  const runTotal = Number(body?.runTotal);
  if (!/^run_[a-zA-Z0-9_-]{4,80}$/.test(runKey) || !Number.isInteger(runTotal) || runTotal < 1 || runTotal > 100) {
    return NextResponse.json({ error: "Lượt đăng không hợp lệ." }, { status: 400 });
  }
  await prisma.postBatch.updateMany({
    where: { userId: gate.user.id, runKey },
    data: { runTotal },
  });
  return NextResponse.json({ ok: true });
}
