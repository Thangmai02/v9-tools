import { NextResponse } from "next/server";
import { resolveMember } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const user = await resolveMember();
  if (!user) {
    return NextResponse.json({ error: "Bạn cần đăng nhập." }, { status: 401 });
  }

  const rows = await prisma.announcementReceipt.findMany({
    where: { userId: user.id },
    orderBy: { announcement: { createdAt: "desc" } },
    take: 20,
    include: { announcement: true },
  });

  return NextResponse.json({
    notices: rows.map((row) => ({
      id: row.id,
      title: row.announcement.title,
      body: row.announcement.body,
      at: row.announcement.createdAt,
      presented: Boolean(row.presentedAt),
      read: Boolean(row.readAt),
    })),
  });
}

export async function POST(request: Request) {
  const user = await resolveMember();
  if (!user) {
    return NextResponse.json({ error: "Bạn cần đăng nhập." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    action?: unknown;
    ids?: unknown;
  } | null;
  const action = body?.action === "read" ? "read" : body?.action === "presented" ? "presented" : "";
  const ids = Array.isArray(body?.ids) ? body.ids.map((id) => String(id)).slice(0, 20) : [];
  if (!action || !ids.length) {
    return NextResponse.json({ ok: true });
  }

  const now = new Date();
  await prisma.announcementReceipt.updateMany({
    where: {
      userId: user.id,
      id: { in: ids },
      ...(action === "presented" ? { presentedAt: null } : { readAt: null }),
    },
    data: action === "presented" ? { presentedAt: now } : { readAt: now },
  });

  return NextResponse.json({ ok: true });
}
