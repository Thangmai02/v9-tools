import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveMember } from "@/lib/auth";
import { resolvePageSourceUserId } from "@/lib/facebook-keys";

export async function GET() {
  const member = await resolveMember();
  if (!member) {
    return NextResponse.json({ error: "Bạn cần đăng nhập." }, { status: 401 });
  }
  const sourceUserId = await resolvePageSourceUserId(member.id);
  const pages = sourceUserId
    ? await prisma.page.findMany({
        where: { account: { userId: sourceUserId } },
        orderBy: { name: "asc" },
        select: { id: true, name: true, category: true, pictureUrl: true },
      })
    : [];
  return NextResponse.json({ pages });
}
