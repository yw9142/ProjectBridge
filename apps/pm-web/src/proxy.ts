import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ACCESS_COOKIE, sanitizeNextPath } from "./lib/auth";

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isPublic = path === "/login" || path.startsWith("/_next") || path.startsWith("/favicon");
  const token = request.cookies.get(ACCESS_COOKIE)?.value;

  if (!isPublic && !token) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", `${path}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }

  if (path === "/login" && token) {
    const next = sanitizeNextPath(request.nextUrl.searchParams.get("next"), "/pm/projects");
    return NextResponse.redirect(new URL(next, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

