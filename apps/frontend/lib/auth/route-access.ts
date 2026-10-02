import { AuthUser } from "./types";

// Permission code (same `module:action` codes the backend guards check) each route needs.
// Routes not listed (coming-soon placeholders) are open to everyone.
const ROUTE_PERMISSION: Record<string, string> = {
  "/dashboard": "dashboard:read",
  "/sales": "sales:read",
  "/leads": "leads:read",
  "/scan-card": "leads:write",
  "/quotations": "leads:read",
  "/marketing": "marketing:read",
  "/sales-team": "sales_team:read",
  "/dealers": "dealers:read",
  "/architects": "architects:read",
  "/builders": "builders:read",
  "/projects": "projects:read",
  "/customers": "customers:read",
  "/products": "products:read",
  "/notifications": "notifications:read",
  "/settings": "settings:read",
};

export function canAccess(user: AuthUser, route: string): boolean {
  if (route.startsWith("/platform-admin")) return user.isPlatformAdmin;
  const base = "/" + route.split("/")[1];
  const needed = ROUTE_PERMISSION[base];
  return !needed || user.permissions.includes(needed);
}
