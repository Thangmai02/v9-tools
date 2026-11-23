import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

const memberWhere = {
  role: { in: ["member", "admin"] },
  NOT: {
    OR: [{ email: "ban@local" }, { email: { startsWith: "key-" } }],
  },
};

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const rows = await prisma.announcement.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      _count: { select: { receipts: true } },
    },
  });

  return NextResponse.json({
    announcements: rows.map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      createdAt: row.createdAt,
      recipients: row._count.receipts,
    })),
  });
}

export async function POST(request: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const body = (await request.json().catch(() => null)) as {
    title?: unknown;
    body?: unknown;
    userIds?: unknown;
    all?: unknown;
  } | null;

  const title = String(body?.title ?? "").trim();
  const message = String(body?.body ?? "").trim();
  if (!title || !message) {
    return NextResponse.json({ error: "Nhập tiêu đề và nội dung." }, { status: 400 });
  }
  if (title.length > 120 || message.length > 2000) {
    return NextResponse.json({ error: "Tiêu đề hoặc nội dung quá dài." }, { status: 400 });
  }

  const members = await prisma.user.findMany({
    where: memberWhere,
    select: { id: true },
  });
  const allowed = new Set(members.map((user) => user.id));
  const requested = Array.isArray(body?.userIds)
    ? body.userIds.map((id) => String(id)).filter((id) => allowed.has(id))
    : [];
  const userIds = body?.all === true ? [...allowed] : [...new Set(requested)];
  if (!userIds.length) {
    return NextResponse.json({ error: "Chọn ít nhất một tài khoản." }, { status: 400 });
  }

  const created = await prisma.announcement.create({
    data: {
      title,
      body: message,
      receipts: {
        create: userIds.map((userId) => ({ userId })),
      },
    },
  });

  return NextResponse.json({ ok: true, id: created.id, recipients: userIds.length });
}
