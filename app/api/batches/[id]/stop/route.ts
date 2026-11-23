import { NextResponse } from "next/server";
import { stopBatch } from "@/lib/batch-run";
import { requireProUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireProUser();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  const { id } = await context.params;
  const owned = await prisma.postBatch.findFirst({
    where: { id, userId: gate.user.id },
    select: { id: true },
  });
  if (!owned) {
    return NextResponse.json({ error: "Không thấy đợt đăng." }, { status: 404 });
  }
  try {
    const result = await stopBatch(id);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không dừng được.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
