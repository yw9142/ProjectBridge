export const ACCESS_COOKIE = "bridge_pm_access_token";

function isBrowser(): boolean {
  return typeof window !== "undefined";
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
