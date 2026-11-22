import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { decrypt } from "@/lib/crypto";
import { prisma } from "@/lib/db";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }
  const { id } = await context.params;
  const key = await prisma.facebookKey.findUnique({ where: { id } });
  if (!key) {
    return NextResponse.json({ error: "Không thấy mã khóa." }, { status: 404 });
  }
  try {
    return NextResponse.json({ token: decrypt(key.tokenEnc) });
  } catch {
    return NextResponse.json({ error: "Không đọc được token." }, { status: 500 });
  }
}
