"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export interface DateRangeParams {
  dateFrom?: string;
  dateTo?: string;
}

/** Reads/writes the global date range (`dateFrom`/`dateTo`) that lives in the URL's query
 * string, so the range is shareable/bookmarkable and drives both the server-rendered first
 * paint (via `page.tsx`'s `searchParams`) and live client refetching. */
export function useDateRangeParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const dateFrom = searchParams.get("dateFrom") ?? undefined;
  const dateTo = searchParams.get("dateTo") ?? undefined;

  function setRange(next: DateRangeParams) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.dateFrom) params.set("dateFrom", next.dateFrom);
    else params.delete("dateFrom");
    if (next.dateTo) params.set("dateTo", next.dateTo);
    else params.delete("dateTo");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return { dateFrom, dateTo, setRange };
}
