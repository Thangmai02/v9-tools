export const GRAPH_VERSION = "v22.0";
export const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

export class GraphError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GraphError";
  }
}

export function facebookEnv(name: "FACEBOOK_APP_ID" | "FACEBOOK_APP_SECRET" | "FACEBOOK_REDIRECT_URI") {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new GraphError(`Chưa cấu hình ${name}.`);
  }
  return value;
}

export async function graphRequest(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const body = (await response.json().catch(() => ({}))) as {
    error?: { message?: string };
    [key: string]: unknown;
  };
  if (!response.ok || body.error) {
    throw new GraphError(body.error?.message || "Facebook từ chối yêu cầu.");
  }
  return body;
}
