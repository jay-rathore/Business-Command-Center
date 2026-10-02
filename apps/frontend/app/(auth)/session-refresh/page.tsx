"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { tryRefresh } from "@/lib/api/apiClient";

function SessionRefresh() {
  const params = useSearchParams();

  useEffect(() => {
    const next = params.get("next") ?? "/dashboard";
    // Same-site paths only — never let ?next= bounce the user to another origin.
    const target = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
    tryRefresh().then((ok) => {
      // Hard navigation so the server sees the freshly set cookies.
      window.location.replace(ok ? target : `/login?next=${encodeURIComponent(target)}`);
    });
  }, [params]);

  return <p className="text-sm text-text-muted">Restoring your session…</p>;
}

export default function SessionRefreshPage() {
  return (
    <Suspense>
      <SessionRefresh />
    </Suspense>
  );
}
