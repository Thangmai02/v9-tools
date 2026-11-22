import { prisma } from "@/lib/db";
import { grantPro } from "@/lib/license";

const DESK_EMAIL = "ban@local";

export async function ensureDesk() {
  let user = await prisma.user.findUnique({ where: { email: DESK_EMAIL } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        name: "Bàn đăng",
        email: DESK_EMAIL,
        passwordHash: "local-desk",
        role: "member",
        plan: "free",
      },
    });
  }

  const license = await prisma.licenseKey.findFirst({
    where: { userId: user.id, status: "active" },
  });
  if (user.plan !== "pro" || !license) {
    await grantPro(user.id);
  }

  return prisma.user.findUniqueOrThrow({ where: { id: user.id } });
}
