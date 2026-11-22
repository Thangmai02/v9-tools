import { AdminDesk, AdminLogin } from "@/components/admin-desk";
import { isAdminEmail, syncAdminRoleByEmail, userHasAdminRole } from "@/lib/admin";
import { memberHasPro } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { readSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await readSession();
  if (session?.role === "admin") {
    return <AdminDesk />;
  }
  if (session?.role === "member") {
    const user = await prisma.user.findUnique({ where: { id: session.sub } });
    if (user && userHasAdminRole(user)) {
      if (user.role !== "admin" && isAdminEmail(user.email)) {
        await syncAdminRoleByEmail(user.id, user.email);
      }
      const pro = await memberHasPro(user.id, user.plan);
      return (
        <AdminDesk
          actor={{
            name: user.name,
            email: user.email,
            avatarUrl: user.avatarUrl,
            pro,
          }}
        />
      );
    }
  }
  return <AdminLogin />;
}
