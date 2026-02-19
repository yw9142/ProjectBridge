import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { sanitizeNextPath } from "./lib/auth";

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  // Allow entering signing pages directly so users can see guidance even without a session.
  // Actual signing APIs still enforce authentication/authorization.
  const isPublic =
    path === "/login" || path.startsWith("/_next") || path.startsWith("/favicon") || path === "/sign" || path.startsWith("/sign/");
  const token = request.cookies.get("bridge_client_access_token")?.value;

  if (!isPublic && !token) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", `${path}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }

  if (path === "/login" && token) {
    const next = sanitizeNextPath(request.nextUrl.searchParams.get("next"), "/client/projects");
    return NextResponse.redirect(new URL(next, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

