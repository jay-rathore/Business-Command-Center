import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Cheap redirect gate only — presence of the access_token cookie, not validity (its actual
// validity is checked server-side per-request via /api/auth/me in the (app) layout, and per-call
// by every API request). Note: refresh_token is NOT usable here — its cookie Path is scoped to
// /api/auth (narrow on purpose, since only the backend's refresh/logout endpoints need it), so
// the browser never attaches it to frontend page requests at all, on any path.
const PUBLIC_PATHS = ["/login"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path));
  const hasSession = request.cookies.has("access_token");

  if (!hasSession && !isPublicPath) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (hasSession && pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
