import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveMember } from "@/lib/auth";
import { resolvePageOwnerIds } from "@/lib/facebook-keys";

export async function GET() {
  const member = await resolveMember();
  if (!member) {
    return NextResponse.json({ error: "Bạn cần đăng nhập." }, { status: 401 });
  }
  const ownerIds = await resolvePageOwnerIds(member.id);
  const pages =
    ownerIds.length > 0
      ? await prisma.page.findMany({
          where: { account: { userId: { in: ownerIds } } },
          orderBy: { name: "asc" },
          select: { id: true, name: true, category: true, pictureUrl: true },
        })
      : [];
  return NextResponse.json({ pages });
}
