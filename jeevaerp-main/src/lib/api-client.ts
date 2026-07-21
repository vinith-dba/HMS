/**
 * Browser -> API helper. Always sends cookies (same-origin) and surfaces the
 * server's error message. On a 401 it transparently tries one refresh, then
 * replays the original request once.
 */
export class ApiClientError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

const BASE = "/api/v1";

async function raw(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    ...init,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
}

export async function apiFetch<T = unknown>(
  path: string,
  init?: RequestInit & { retryOn401?: boolean }
): Promise<T> {
  const retryOn401 = init?.retryOn401 ?? true;
  let res = await raw(path, init);

  if (res.status === 401 && retryOn401 && path !== "/auth/refresh") {
    const refreshed = await raw("/auth/refresh", { method: "POST" });
    if (refreshed.ok) {
      res = await raw(path, init);
    }
  }

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await res.json() : null;

  if (!res.ok) {
    throw new ApiClientError(
      res.status,
      (body && (body.error as string)) || `Request failed (${res.status})`,
      body?.details
    );
  }
  return body as T;
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path, { method: "GET" }),
  put: <T>(path: string, data?: unknown) =>
    apiFetch<T>(path, { method: "PUT", body: data === undefined ? undefined : JSON.stringify(data) }),
  patch: <T>(path: string, data?: unknown) =>
    apiFetch<T>(path, { method: "PATCH", body: data === undefined ? undefined : JSON.stringify(data) }),
  del: <T>(path: string, data?: unknown) =>
    apiFetch<T>(path, { method: "DELETE", body: data === undefined ? undefined : JSON.stringify(data) }),
  post: <T>(path: string, data?: unknown) =>
    apiFetch<T>(path, { method: "POST", body: data ? JSON.stringify(data) : undefined }),
};
