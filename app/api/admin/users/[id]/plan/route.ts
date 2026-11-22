import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { grantPro, revokePro } from "@/lib/license";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdmin();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const { id } = await context.params;
  const user = await prisma.user.findFirst({
    where: { id, role: "member" },
  });
  if (!user) {
    return NextResponse.json({ error: "Không thấy tài khoản." }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as {
    action?: string;
  } | null;

  if (body?.action === "upgrade") {
    const licenseKey = await grantPro(user.id);
    return NextResponse.json({ ok: true, plan: "pro", licenseKey });
  }
  if (body?.action === "downgrade") {
    await revokePro(user.id);
    return NextResponse.json({ ok: true, plan: "free", licenseKey: null });
  }
  return NextResponse.json({ error: "Thao tác không hợp lệ." }, { status: 400 });
}
