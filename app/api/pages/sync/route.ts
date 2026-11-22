import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { ensureDesk } from "@/lib/desk";
import { syncPages } from "@/lib/sync-pages";

export async function POST() {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }
  const user = await ensureDesk();
  try {
    const count = await syncPages(user.id);
    return NextResponse.json({ ok: true, count });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không đồng bộ được Page.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
