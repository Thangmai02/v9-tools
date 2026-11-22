import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
try {
  const user = await prisma.user.create({
    data: {
      name: "t",
      email: `t-google-test-${Date.now()}@example.com`,
      googleId: `g-test-${Date.now()}`,
      passwordHash: null,
      role: "member",
      plan: "free",
    },
  });
  console.log("ok", user.id);
  await prisma.user.delete({ where: { id: user.id } });
} catch (error) {
  console.error("ERR", error.message);
} finally {
  await prisma.$disconnect();
}
