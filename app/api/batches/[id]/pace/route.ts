import { NextResponse } from "next/server";
import { readPaceSeconds, setBatchPace } from "@/lib/batch-run";
import { requireProUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(
  request: Request,
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
    const body = (await request.json().catch(() => ({}))) as { delaySeconds?: unknown };
    const delaySeconds = readPaceSeconds(body.delaySeconds);
    const result = await setBatchPace(id, delaySeconds);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không đổi được nhịp đăng.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
