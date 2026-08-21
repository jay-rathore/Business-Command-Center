import "server-only";
import { cookies } from "next/headers";

const INTERNAL_API_URL = process.env.INTERNAL_API_URL ?? "http://localhost:4000";

/** Server Component fetch helper — forwards the incoming request's cookies to the backend
 * (running inside Docker, reached via the internal service URL) for first-paint data. Returns
 * null on any non-2xx response rather than throwing, so pages can render an empty/error state
 * instead of crashing the whole SSR pass. */
export async function serverApiFetch<T>(path: string, init: RequestInit = {}): Promise<T | null> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const res = await fetch(`${INTERNAL_API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
      ...init.headers,
    },
    cache: "no-store",
  });

  if (!res.ok) return null;
  return res.json() as Promise<T>;
}
