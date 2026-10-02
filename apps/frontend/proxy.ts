import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ALL_TIME_FROM, isDateAwareRoute } from "@/lib/dateRange";

// Cheap redirect gate only — presence of the access_token cookie, not validity (its actual
// validity is checked server-side per-request via /api/auth/me in the (app) layout, and per-call
// by every API request). Note: refresh_token is NOT usable here — its cookie Path is scoped to
// /api/auth (narrow on purpose, since only the backend's refresh/logout endpoints need it), so
// the browser never attaches it to frontend page requests at all, on any path.
const PUBLIC_PATHS = ["/login", "/session-refresh"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path));
  const hasSession = request.cookies.has("access_token");

  // Access cookie expired (15 min) but the session_hint cookie says a 30-day refresh token exists:
  // renew silently via /session-refresh (the refresh cookie is only sent to /api/auth, so the browser
  // — not this gate — has to make that call) instead of logging the user out mid-use.
  if (!hasSession && !isPublicPath && request.cookies.has("session_hint")) {
    const back = request.nextUrl.clone();
    back.searchParams.delete("_rsc");
    const refreshUrl = new URL("/session-refresh", request.url);
    refreshUrl.searchParams.set("next", back.pathname + back.search);
    return NextResponse.redirect(refreshUrl);
  }

  if (!hasSession && !isPublicPath) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (hasSession && pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // A date-aware page opened with no range would otherwise show each endpoint's own default
  // (the current month for overview/KPI endpoints) while the picker says "All time" — so the
  // page looked empty until someone picked a range. Make "All time" an explicit range up front.
  if (hasSession && isDateAwareRoute(pathname) && !request.nextUrl.searchParams.has("dateFrom") && !request.nextUrl.searchParams.has("dateTo")) {
    const url = request.nextUrl.clone();
    url.searchParams.set("dateFrom", ALL_TIME_FROM);
    // Tomorrow (UTC) so "today" is included whatever the server/browser timezone offset.
    url.searchParams.set("dateTo", new Date(Date.now() + 86400000).toISOString().slice(0, 10));
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
