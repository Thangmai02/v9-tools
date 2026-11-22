import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth-card";
import { resolveMember } from "@/lib/auth";
import { readSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await readSession();
  if (session?.role === "admin") redirect("/admin");
  const user = await resolveMember();
  if (user) redirect("/tool");
  return <LoginForm />;
}
