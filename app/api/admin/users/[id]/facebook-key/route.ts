import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { assignFacebookKey } from "@/lib/facebook-keys";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    facebookKeyId?: string | null;
  } | null;
  try {
    await assignFacebookKey(id, body?.facebookKeyId ?? null);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không gán được mã.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
