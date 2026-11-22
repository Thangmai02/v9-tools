import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  createFacebookKey,
  KEY_COLORS,
  listFacebookKeys,
  revealHint,
} from "@/lib/facebook-keys";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }
  const keys = await listFacebookKeys();
  return NextResponse.json({
    colors: KEY_COLORS,
    keys: keys.map((key) => ({
      id: key.id,
      label: key.label,
      color: key.color,
      name: key.name,
      pageCount: key.pageCount,
      userCount: key._count.users,
      hint: revealHint(key.tokenEnc),
      createdAt: key.createdAt,
    })),
  });
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }
  const body = (await request.json().catch(() => null)) as {
    label?: string;
    color?: string;
    token?: string;
  } | null;
  try {
    const key = await createFacebookKey({
      label: body?.label ?? "Mã mới",
      color: body?.color ?? KEY_COLORS[0],
      token: body?.token ?? "",
    });
    return NextResponse.json({
      ok: true,
      key: {
        id: key.id,
        label: key.label,
        color: key.color,
        name: key.name,
        pageCount: key.pageCount,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không thêm được mã.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
