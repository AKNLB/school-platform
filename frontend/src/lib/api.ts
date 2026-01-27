// frontend/src/lib/api.ts

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

type RequestOpts = {
  params?: Params;
  data?: any; // JSON or FormData
  body?: BodyInit;
  headers?: Record<string, string>;
};

async function request(method: string, path: string, opts?: RequestOpts) {
  // normalize path so you can pass "/api/..." or "/announcements"
  const isAlreadyApi = path.startsWith("/api/");
  const url = `${isAlreadyApi ? "" : "/api"}${path}${qs(opts?.params)}`;

  const headers: Record<string, string> = { ...(opts?.headers || {}) };

  let body: BodyInit | undefined = opts?.body;

  // If user passed "data" (axios-style)
  if (opts?.data !== undefined && body === undefined) {
    if (opts.data instanceof FormData) {
      body = opts.data;
      // Don't set Content-Type for FormData; browser sets boundary automatically
      delete headers["Content-Type"];
    } else {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(opts.data);
    }
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

export const api = {
  get: (path: string, opts?: { params?: Params; headers?: Record<string, string> }) =>
    request("GET", path, { params: opts?.params, headers: opts?.headers }),

  post: (path: string, data?: any, opts?: { params?: Params; headers?: Record<string, string> }) =>
    request("POST", path, { params: opts?.params, data, headers: opts?.headers }),

  put: (path: string, data?: any, opts?: { params?: Params; headers?: Record<string, string> }) =>
    request("PUT", path, { params: opts?.params, data, headers: opts?.headers }),

  patch: (path: string, data?: any, opts?: { params?: Params; headers?: Record<string, string> }) =>
    request("PATCH", path, { params: opts?.params, data, headers: opts?.headers }),

  delete: (path: string, opts?: { params?: Params; headers?: Record<string, string> }) =>
    request("DELETE", path, { params: opts?.params, headers: opts?.headers }),
};

export default api;
