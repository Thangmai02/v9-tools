import { NextResponse } from "next/server";
import { memberHasPro } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { readSession } from "@/lib/session";

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ role: null });
  if (session.role === "admin") return NextResponse.json({ role: "admin" });

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    include: {
      facebook: true,
    },
  });
  if (!user) return NextResponse.json({ role: null });

  return NextResponse.json({
    role: "member",
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      plan: user.plan,
      pro: await memberHasPro(user.id, user.plan),
    },
    facebook: user.facebook ? { name: user.facebook.name } : null,
  });
}
