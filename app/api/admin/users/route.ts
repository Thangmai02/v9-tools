import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { decrypt } from "@/lib/crypto";

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const users = await prisma.user.findMany({
    where: {
      role: "member",
      NOT: {
        OR: [{ email: "ban@local" }, { email: { startsWith: "key-" } }],
      },
    },
    orderBy: { createdAt: "desc" },
    include: {
      licenseKeys: { where: { status: "active" }, take: 1 },
      facebookKey: true,
    },
  });

  return NextResponse.json({
    users: users.map((user) => {
      const license = user.licenseKeys[0];
      let licenseKey: string | null = null;
      if (license) {
        try {
          licenseKey = decrypt(license.keyEncrypted);
        } catch {
          licenseKey = "(không đọc được)";
        }
      }
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        plan: user.plan,
        createdAt: user.createdAt,
        licenseKey,
        facebookKeyId: user.facebookKeyId,
        facebookKey: user.facebookKey
          ? {
              id: user.facebookKey.id,
              label: user.facebookKey.label,
              color: user.facebookKey.color,
            }
          : null,
      };
    }),
  });
}
