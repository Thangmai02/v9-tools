import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "dp_session";

export type Session = { role: "admin" } | { role: "member"; sub: string };

function secretKey() {
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret || secret.length < 16) {
    throw new Error("SESSION_SECRET cần ít nhất 16 ký tự.");
  }
  return new TextEncoder().encode(secret);
}

export async function sealSession(session: Session) {
  const jwt = new SignJWT({ role: session.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d");
  if (session.role === "member") {
    jwt.setSubject(session.sub);
  }
  return jwt.sign(secretKey());
}

export async function openSession(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (payload.role === "admin") return { role: "admin" };
    if (payload.role === "member" && typeof payload.sub === "string") {
      return { role: "member", sub: payload.sub };
    }
    return null;
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  };
}
