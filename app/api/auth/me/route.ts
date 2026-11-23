import { NextResponse } from "next/server";
import { userHasAdminRole } from "@/lib/admin";
import { memberHasPro } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { resolvePageOwnerIds } from "@/lib/facebook-keys";
import { readSession } from "@/lib/session";

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ role: null });
  if (session.role === "admin") return NextResponse.json({ role: "admin" });

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    include: {
      facebook: true,
      facebookKey: true,
    },
  });
  if (!user) return NextResponse.json({ role: null });

  const pro = await memberHasPro(user.id, user.plan);
  const ownerIds = await resolvePageOwnerIds(user.id);
  let accounts: { name: string }[] = [];
  let pageCount = 0;
  if (ownerIds.length) {
    [accounts, pageCount] = await Promise.all([
      prisma.facebookAccount.findMany({
        where: { userId: { in: ownerIds } },
        select: { name: true },
      }),
      prisma.page.count({ where: { account: { userId: { in: ownerIds } } } }),
    ]);
  }
  const sourceName = userHasAdminRole(user)
    ? accounts.length
      ? `Admin · ${accounts.length} mã khóa`
      : null
    : accounts[0]?.name ?? user.facebookKey?.label ?? null;

  return NextResponse.json({
    role: "member",
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      plan: user.plan,
      pro,
    },
    facebook: user.facebook ? { name: user.facebook.name } : null,
    access: {
      pro,
      facebookKeyId: user.facebookKeyId,
      sourceName,
      pageCount,
    },
  });
}
