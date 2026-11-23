export const GRAPH_VERSION = "v22.0";
export const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

export class GraphError extends Error {
  code?: number;
  subcode?: number;
  userTitle?: string;
  userMsg?: string;
  fbtraceId?: string;

  constructor(
    message: string,
    details?: {
      code?: number;
      subcode?: number;
      userTitle?: string;
      userMsg?: string;
      fbtraceId?: string;
    },
  ) {
    super(message);
    this.name = "GraphError";
    this.code = details?.code;
    this.subcode = details?.subcode;
    this.userTitle = details?.userTitle;
    this.userMsg = details?.userMsg;
    this.fbtraceId = details?.fbtraceId;
  }
}

export function facebookEnv(name: "FACEBOOK_APP_ID" | "FACEBOOK_APP_SECRET" | "FACEBOOK_REDIRECT_URI") {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new GraphError(`Chưa cấu hình ${name}.`);
  }
  return value;
}

function formatGraphError(error: {
  message?: string;
  code?: number;
  error_subcode?: number;
  error_user_title?: string;
  error_user_msg?: string;
  fbtrace_id?: string;
}) {
  const parts = [
    error.message || "Facebook từ chối yêu cầu.",
    error.error_user_title,
    error.error_user_msg,
    error.code != null ? `code ${error.code}` : null,
    error.error_subcode != null ? `subcode ${error.error_subcode}` : null,
  ].filter(Boolean);
  return {
    message: parts.join(" — "),
    details: {
      code: error.code,
      subcode: error.error_subcode,
      userTitle: error.error_user_title,
      userMsg: error.error_user_msg,
      fbtraceId: error.fbtrace_id,
    },
  };
}

export async function graphRequest(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const body = (await response.json().catch(() => ({}))) as {
    error?: {
      message?: string;
      code?: number;
      error_subcode?: number;
      error_user_title?: string;
      error_user_msg?: string;
      fbtrace_id?: string;
    };
    [key: string]: unknown;
  };
  if (!response.ok || body.error) {
    const formatted = formatGraphError(body.error || {});
    throw new GraphError(formatted.message, formatted.details);
  }
  return body;
}
