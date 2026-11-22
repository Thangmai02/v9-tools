import { memberHasPro } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { readSession } from "@/lib/session";

/** Tài khoản member đang Pro (có license active). */
export async function currentUserIsPro() {
  const session = await readSession();
  if (!session || session.role !== "member") return false;
  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { id: true, plan: true },
  });
  if (!user) return false;
  return memberHasPro(user.id, user.plan);
}
