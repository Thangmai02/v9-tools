import { PrismaClient } from "@prisma/client";

const email = (process.argv[2] || "maivanthang10a6@gmail.com").trim().toLowerCase();
const prisma = new PrismaClient();

const users = await prisma.user.findMany({
  select: { id: true, email: true, name: true, role: true, plan: true },
});
console.log("users:", users);

const updated = await prisma.user.updateMany({
  where: { email },
  data: { role: "admin" },
});
console.log(`set role=admin for ${email}: ${updated.count} row(s)`);

const after = await prisma.user.findUnique({
  where: { email },
  select: { id: true, email: true, name: true, role: true, plan: true },
});
console.log("result:", after);

await prisma.$disconnect();
