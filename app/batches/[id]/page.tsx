import { redirect } from "next/navigation";
import { BatchView } from "@/components/batch-view";
import { TopBar } from "@/components/top-bar";
import { Waiting } from "@/components/waiting";
import { userHasAdminRole } from "@/lib/admin";
import { memberHasPro, resolveMember } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function BatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await resolveMember();
  if (!user) redirect("/login");
  const isPro = await memberHasPro(user.id, user.plan);
  if (!isPro) {
    return (
      <Waiting
        name={user.name}
        email={user.email}
        avatarUrl={user.avatarUrl}
        admin={userHasAdminRole(user)}
      />
    );
  }
  const { id } = await params;
  return (
    <TopBar
      email={user.email}
      name={user.name}
      avatarUrl={user.avatarUrl}
      pro
      admin={userHasAdminRole(user)}
    >
      <main className="mx-auto h-full w-full max-w-4xl overflow-y-auto px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <BatchView id={id} />
      </main>
    </TopBar>
  );
}
