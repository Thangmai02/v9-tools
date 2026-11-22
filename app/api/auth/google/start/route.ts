import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { googleAuthUrl, googleConfigured } from "@/lib/google-auth";
import { absoluteUrl } from "@/lib/request-origin";

export async function GET(request: Request) {
  if (!googleConfigured()) {
    return NextResponse.redirect(absoluteUrl(request, "/login?google=missing"));
  }
  const state = randomBytes(16).toString("hex");
  const response = NextResponse.redirect(googleAuthUrl(state));
  response.cookies.set("google_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });
  return response;
}
