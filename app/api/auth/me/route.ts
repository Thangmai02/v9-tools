import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { readSession } from "@/lib/session";

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ role: null });
  if (session.role === "admin") return NextResponse.json({ role: "admin" });

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    include: {
      licenseKeys: { where: { status: "active" }, take: 1 },
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
      pro: user.plan === "pro" && user.licenseKeys.length > 0,
    },
    facebook: user.facebook ? { name: user.facebook.name } : null,
  });
}
