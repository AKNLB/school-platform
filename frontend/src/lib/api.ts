export type Params = Record<string, string | number | boolean | undefined | null>;

function qs(params?: Params) {
  if (!params) return "";
  const sp = new URLSearchParams();

  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    sp.set(k, String(v));
  }

  const s = sp.toString();
  return s ? `?${s}` : "";
}

const API_BASE = "";

let csrfToken: string | null = null;

async function ensureCsrfToken() {
  if (csrfToken) return csrfToken;

  const res = await fetch(`${API_BASE}/api/csrf-token`, {
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch CSRF token");
  }

  const data = await res.json().catch(() => null);
  csrfToken = data?.csrf_token || null;

  if (!csrfToken) {
    throw new Error("Missing CSRF token");
  }

  return csrfToken;
}

type RequestOpts = {
  params?: Params;
  data?: any;
  body?: BodyInit;
  headers?: Record<string, string>;
};

function isExpiredCsrfResponse(parsed: any, status: number) {
  if (status !== 400) return false;

  if (typeof parsed === "string") {
    return parsed.toLowerCase().includes("csrf token has expired");
  }

  if (parsed && typeof parsed === "object") {
    const msg = `${parsed?.error || ""} ${parsed?.message || ""}`.toLowerCase();
    return msg.includes("csrf token has expired");
  }

  return false;
}

async function request(
  method: string,
  path: string,
  opts?: RequestOpts,
  retrying = false
) {
  const p = path.startsWith("/") ? path : `/${path}`;
  const urlPath = p.startsWith("/api") ? p : `/api${p}`;
  const url = `${API_BASE}${urlPath}${qs(opts?.params)}`;

  const headers: Record<string, string> = { ...(opts?.headers || {}) };

  let body: BodyInit | undefined = opts?.body;

  if (opts?.data !== undefined && body === undefined) {
    if (opts.data instanceof FormData) {
      body = opts.data;
    } else {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(opts.data);
    }
  }

  if (!["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())) {
    const token = await ensureCsrfToken();
    headers["X-CSRFToken"] = token;
  }

  const res = await fetch(url, {
    method,
    credentials: "include",
    headers,
    body,
  });

  const text = await res.text();

  let parsed: any = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text || null;
  }

  if (isExpiredCsrfResponse(parsed, res.status) && !retrying) {
    clearApiSessionState();
    return request(method, path, opts, true);
  }

  if (!res.ok) {
    const msg =
      parsed?.error ||
      parsed?.message ||
      (typeof parsed === "string" ? parsed : "") ||
      `Request failed (${res.status})`;

    const err: any = new Error(msg);
    err.response = { status: res.status, data: parsed };
    throw err;
  }

  return { data: parsed };
}

export function clearApiSessionState() {
  csrfToken = null;
}

export const api = {
  get: (
    path: string,
    opts?: { params?: Params; headers?: Record<string, string> }
  ) => request("GET", path, { params: opts?.params, headers: opts?.headers }),

  post: (
    path: string,
    data?: any,
    opts?: { params?: Params; headers?: Record<string, string> }
  ) => request("POST", path, { params: opts?.params, data, headers: opts?.headers }),

  put: (
    path: string,
    data?: any,
    opts?: { params?: Params; headers?: Record<string, string> }
  ) => request("PUT", path, { params: opts?.params, data, headers: opts?.headers }),

  patch: (
    path: string,
    data?: any,
    opts?: { params?: Params; headers?: Record<string, string> }
  ) => request("PATCH", path, { params: opts?.params, data, headers: opts?.headers }),

  delete: (
    path: string,
    opts?: { params?: Params; headers?: Record<string, string> }
  ) => request("DELETE", path, { params: opts?.params, headers: opts?.headers }),
};

export default api;