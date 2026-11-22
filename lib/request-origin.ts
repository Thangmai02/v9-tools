/** Public site origin behind reverse proxies (Render binds 0.0.0.0). */
export function publicOrigin(request: Request) {
  const env =
    process.env.APP_URL?.trim() ||
    process.env.PUBLIC_APP_URL?.trim() ||
    process.env.GOOGLE_REDIRECT_URI?.trim();
  if (env) {
    try {
      return new URL(env).origin;
    } catch {
      /* fall through */
    }
  }

  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host")?.trim();
  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    (host?.includes("localhost") || host?.startsWith("127.") ? "http" : "https");

  if (host && !host.startsWith("0.0.0.0") && host !== "localhost") {
    return `${proto}://${host}`;
  }

  return new URL(request.url).origin;
}

export function absoluteUrl(request: Request, path: string) {
  return new URL(path, publicOrigin(request));
}
