import { redirectToLogin } from "./auth";

function normalizeApiBase(base: string): string {
  return base.replace(/\/+$/, "");
}

export const API_BASE = normalizeApiBase(process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080");
const APP_HEADER_VALUE = "admin";

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

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

let refreshPromise: Promise<boolean> | null = null;

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

async function rawFetch(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers ?? {});
  if (!headers.has("X-Bridge-App")) {
    headers.set("X-Bridge-App", APP_HEADER_VALUE);
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
      credentials: "include",
    });
  } finally {
    cleanup();
  }
}

async function refreshAccessToken(): Promise<boolean> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const { signal, cleanup } = withTimeout(undefined, REFRESH_TIMEOUT_MS);
    try {
      const response = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: "POST",
        headers: { "X-Bridge-App": APP_HEADER_VALUE },
        signal,
        cache: "no-store",
        credentials: "include",
      });
      return response.ok;
    } catch {
      return false;
    } finally {
      cleanup();
    }
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let response = await rawFetch(path, init);

  if (response.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      response = await rawFetch(path, init);
    }
  }

  const raw = await response.text();
  const payload = parseEnvelope<T>(raw);

  if (!response.ok) {
    const message = buildErrorMessage(response, payload, raw);
    if (response.status === 401) {
      throw new ApiAuthError(message);
    }
    throw new ApiRequestError(message, response.status, payload?.error?.code, payload?.error?.details);
  }

  if (payload && "data" in payload) {
    return payload.data as T;
  }

  if (!raw || response.status === 204) {
    return undefined as T;
  }

  throw new Error("Unexpected API response format.");
}

export async function apiFetchResponse(path: string, init?: RequestInit): Promise<Response> {
  let response = await rawFetch(path, init);

  if (response.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      response = await rawFetch(path, init);
    }
  }

  if (!response.ok) {
    const raw = await response.clone().text();
    const payload = parseEnvelope<unknown>(raw);
    const message = buildErrorMessage(response, payload, raw);
    if (response.status === 401) {
      throw new ApiAuthError(message);
    }
    throw new ApiRequestError(message, response.status, payload?.error?.code, payload?.error?.details);
  }

  return response;
}

export function handleAuthError(error: unknown, loginPath: string) {
  if (error instanceof ApiAuthError) {
    redirectToLogin(loginPath);
    return true;
  }
  return false;
}

export async function logout(loginPath: string) {
  const { signal, cleanup } = withTimeout(undefined, LOGOUT_TIMEOUT_MS);
  try {
    await fetch(`${API_BASE}/api/auth/logout`, {
      method: "POST",
      headers: { "X-Bridge-App": APP_HEADER_VALUE },
      signal,
      cache: "no-store",
      credentials: "include",
    });
  } catch {
    // ignore logout request failures and redirect anyway
  } finally {
    cleanup();
    if (typeof window !== "undefined") {
      window.location.href = loginPath;
    }
  }
}
