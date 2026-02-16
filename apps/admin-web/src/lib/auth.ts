export const ACCESS_COOKIE = "bridge_admin_access_token";
export const REFRESH_COOKIE = "bridge_admin_refresh_token";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function secureAttr(): string {
  if (!isBrowser()) {
    return "";
  }
  return window.location.protocol === "https:" ? "; Secure" : "";
}

export function setAuthCookies(accessToken: string, refreshToken: string) {
  if (!isBrowser()) {
    return;
  }
  const secure = secureAttr();
  document.cookie = `${ACCESS_COOKIE}=${encodeURIComponent(accessToken)}; Path=/; Max-Age=900; SameSite=Lax${secure}`;
  document.cookie = `${REFRESH_COOKIE}=${encodeURIComponent(refreshToken)}; Path=/; Max-Age=2592000; SameSite=Lax${secure}`;
}

export function clearAuthCookies() {
  if (!isBrowser()) {
    return;
  }
  const secure = secureAttr();
  document.cookie = `${ACCESS_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
  document.cookie = `${REFRESH_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
}

export function getCookieValue(name: string): string | null {
  if (!isBrowser()) {
    return null;
  }

  const raw =
    document.cookie
      .split(";")
      .map((value) => value.trim())
      .find((value) => value.startsWith(`${name}=`))
      ?.slice(name.length + 1) ?? null;
  if (!raw) {
    return null;
  }

  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}

export function getAccessToken(): string | null {
  return getCookieValue(ACCESS_COOKIE);
}

export function getRefreshToken(): string | null {
  return getCookieValue(REFRESH_COOKIE);
}

export function redirectToLogin(loginPath: string) {
  if (!isBrowser()) {
    return;
  }

  const next = `${window.location.pathname}${window.location.search}`;
  const url = `${loginPath}?next=${encodeURIComponent(sanitizeNextPath(next, "/"))}`;
  window.location.href = url;
}

export function sanitizeNextPath(nextPath: string | null | undefined, fallback: string): string {
  if (!nextPath) {
    return fallback;
  }
  const trimmed = nextPath.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return fallback;
  }
  return trimmed;
}
