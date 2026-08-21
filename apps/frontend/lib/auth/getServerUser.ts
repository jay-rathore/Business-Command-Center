import "server-only";
import { serverApiFetch } from "../api/serverApi";
import { AuthUser } from "./types";

export async function getServerUser(): Promise<AuthUser | null> {
  return serverApiFetch<AuthUser>("/api/auth/me");
}
