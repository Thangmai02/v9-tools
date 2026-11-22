import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { ensureDesk } from "@/lib/desk";
import { getMe } from "@/lib/facebook";
import { connectFacebook } from "@/lib/sync-pages";

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }
  const user = await ensureDesk();
  const body = (await request.json().catch(() => null)) as { token?: string } | null;
  const token = body?.token?.trim() ?? "";
  if (token.length < 20) {
    return NextResponse.json(
      { error: "Dán mã khóa Facebook vào ô rồi tải Page." },
      { status: 400 },
    );
  }

  try {
    const me = await getMe(token);
    await connectFacebook({
      userId: user.id,
      token,
      fbUserId: me.id,
      name: me.name || "Facebook",
      expiresAt: null,
    });
    return NextResponse.json({ ok: true, name: me.name || "Facebook" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không tải được Page.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
