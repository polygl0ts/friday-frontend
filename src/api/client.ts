export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/**
 * localStorage key for the rCTF auth token.
 *
 * Renamed off the design mockup's `nb_auth_token` prefix, which meant nothing
 * here. Safe to change only because nothing is deployed yet: this key *is* the
 * session, so renaming it after players have logged in signs all of them out
 * (and, since rCTF tokens don't expire and can't be revoked, leaves the old
 * value sitting in their browsers). Don't touch it again after go-live.
 */
const AUTH_TOKEN_KEY = "polygl0ts_auth_token";

let authToken: string | null | undefined;

export function getAuthToken(): string | null {
  if (authToken === undefined) {
    authToken = localStorage.getItem(AUTH_TOKEN_KEY);
  }
  return authToken;
}

export function setAuthToken(token: string | null): void {
  authToken = token;
  if (token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  }
}

/**
 * Readable message out of an error body.
 *
 * FastAPI sends `detail` as a string for its own aborts but as a list of
 * `{loc, msg}` for schema failures, and rCTF sends `message` - so reading
 * `detail` alone renders "[object Object]" at every error surface.
 */
export function errorMessage(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const { detail, message } = body as { detail?: unknown; message?: unknown };

  if (typeof detail === "string" && detail) return detail;

  if (Array.isArray(detail)) {
    const parts = detail.flatMap((item) => {
      if (typeof item !== "object" || item === null) return [];
      const { loc, msg } = item as { loc?: unknown; msg?: unknown };
      if (typeof msg !== "string") return [];
      // `loc` starts with where the value came from; only the field is useful.
      const field = Array.isArray(loc)
        ? loc.filter((p) => typeof p === "string" && !["body", "query", "path"].includes(p)).join(".")
        : "";
      return [field ? `${field}: ${msg}` : msg];
    });
    if (parts.length) return parts.join("; ");
  }

  if (typeof message === "string" && message) return message;
  return null;
}

export async function request<T>(
  origin: string,
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  // A FormData body goes to fetch untouched and *without* a Content-Type of
  // our own: multipart needs a `boundary=` parameter that only the browser
  // knows, so setting the header here strips it and the server sees an
  // unparseable body. Everything else is still JSON.
  const isFormData = options.body instanceof FormData;
  if (options.body !== undefined && !isFormData) {
    headers["Content-Type"] = "application/json";
  }
  const token = getAuthToken();
  if (options.auth !== false && token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${origin}${path}`, {
    method: options.method ?? "GET",
    headers,
    body:
      options.body === undefined
        ? undefined
        : isFormData
          ? (options.body as FormData)
          : JSON.stringify(options.body),
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const data = await res.json();
      detail = errorMessage(data) ?? JSON.stringify(data);
    } catch {
      // response body wasn't JSON
    }
    throw new ApiError(detail, res.status);
  }

  if (res.status === 204) {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}
