import { cookies } from "next/headers";
import { openSession, SESSION_COOKIE, type Session } from "@/lib/session-token";

export async function readSession(): Promise<Session | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return openSession(token);
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
}
