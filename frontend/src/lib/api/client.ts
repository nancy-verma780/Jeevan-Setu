export class ApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

type Body = BodyInit | Record<string, unknown> | unknown[] | undefined;

function detailMessage(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as { msg?: string };
    return (first.msg ?? "").replace(/^Value error, /, "");
  }
  return "";
}

export async function api<T>(
  path: string,
  options: { method?: string; body?: Body; headers?: Record<string, string>; signal?: AbortSignal } = {},
): Promise<T> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new ApiError(0, "", "offline");
  }
  const headers: Record<string, string> = { Accept: "application/json", ...options.headers };
  let body: BodyInit | undefined;
  if (options.body instanceof FormData) {
    body = options.body;
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetch(path, {
      method: options.method ?? (body ? "POST" : "GET"),
      credentials: "same-origin",
      headers,
      body,
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(0, "", "network");
  }

  if (response.status === 204) return undefined as T;
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const payload = (data ?? {}) as { detail?: unknown; code?: string };
    throw new ApiError(response.status, detailMessage(payload.detail), payload.code);
  }
  return data as T;
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID().replace(/-/g, "");
}
