import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { deleteFacebookKey } from "@/lib/facebook-keys";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }
  const { id } = await context.params;
  try {
    await deleteFacebookKey(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không xóa được mã.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
