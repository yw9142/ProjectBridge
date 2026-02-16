import { clearAuthCookies, getAccessToken, getRefreshToken, redirectToLogin, setAuthCookies } from "./auth";

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080";

const REQUEST_TIMEOUT_MS = 15000;
const REFRESH_TIMEOUT_MS = 10000;
const LOGOUT_TIMEOUT_MS = 8000;

type ApiEnvelope<T> = {
  data: T;
  meta?: Record<string, unknown>;
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
};

export class ApiAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiAuthError";
  }
}

let refreshPromise: Promise<string | null> | null = null;

function normalizePath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

function withTimeout(signal: AbortSignal | null | undefined, timeoutMs: number): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const abortFromOutside = () => controller.abort();
  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener("abort", abortFromOutside, { once: true });
    }
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timeoutId);
      if (signal) {
        signal.removeEventListener("abort", abortFromOutside);
      }
    },
  };
}

function parseEnvelope<T>(raw: string): ApiEnvelope<T> | undefined {
  if (!raw) {
    return undefined;
  }
  try {
    return JSON.parse(raw) as ApiEnvelope<T>;
  } catch {
    return undefined;
  }
}

function buildErrorMessage<T>(response: Response, payload: ApiEnvelope<T> | undefined, raw: string): string {
  const fallback = `HTTP ${response.status}`;
  const textFallback = raw.trim();
  return payload?.error?.message ?? (textFallback || fallback);
}

async function rawFetch(path: string, init?: RequestInit, token?: string | null) {
  const headers = new Headers(init?.headers ?? {});

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (!headers.has("Content-Type") && init?.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const { signal, cleanup } = withTimeout(init?.signal, REQUEST_TIMEOUT_MS);

  try {
    return await fetch(`${API_BASE}${normalizePath(path)}`, {
      ...init,
      headers,
      signal,
      cache: "no-store",
    });
  } finally {
    cleanup();
  }
}

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      return null;
    }

    const { signal, cleanup } = withTimeout(undefined, REFRESH_TIMEOUT_MS);

    try {
      const response = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
        signal,
        cache: "no-store",
      });

      if (!response.ok) {
        clearAuthCookies();
        return null;
      }

      const raw = await response.text();
      const envelope = parseEnvelope<{ accessToken: string; refreshToken: string }>(raw);
      const nextAccess = envelope?.data?.accessToken;
      const nextRefresh = envelope?.data?.refreshToken;

      if (!nextAccess || !nextRefresh) {
        clearAuthCookies();
        return null;
      }

      setAuthCookies(nextAccess, nextRefresh);
      return nextAccess;
    } catch {
      clearAuthCookies();
      return null;
    } finally {
      cleanup();
    }
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let accessToken = getAccessToken();
  let response = await rawFetch(path, init, accessToken);

  if (response.status === 401) {
    accessToken = await refreshAccessToken();
    if (accessToken) {
      response = await rawFetch(path, init, accessToken);
    }
  }

  const raw = await response.text();
  const payload = parseEnvelope<T>(raw);

  if (!response.ok) {
    const message = buildErrorMessage(response, payload, raw);
    if (response.status === 401) {
      clearAuthCookies();
      throw new ApiAuthError(message);
    }
    throw new Error(message);
  }

  if (payload && "data" in payload) {
    return payload.data as T;
  }

  if (!raw || response.status === 204) {
    return undefined as T;
  }

  throw new Error("Unexpected API response format.");
}

export function handleAuthError(error: unknown, loginPath: string) {
  if (error instanceof ApiAuthError) {
    redirectToLogin(loginPath);
    return true;
  }
  return false;
}

export async function logout(loginPath: string) {
  const refreshToken = getRefreshToken();
  const { signal, cleanup } = withTimeout(undefined, LOGOUT_TIMEOUT_MS);

  try {
    if (refreshToken) {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
        signal,
        cache: "no-store",
      });
    }
  } catch {
    // ignore logout request failures and clear local session anyway
  } finally {
    cleanup();
    clearAuthCookies();
    if (typeof window !== "undefined") {
      window.location.href = loginPath;
    }
  }
}

