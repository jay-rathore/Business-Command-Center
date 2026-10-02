"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { LeadSourcePerformance, LeadSourcePerformanceRow, SourceRating } from "@hpl/shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/EmptyState";
import { cn } from "@/lib/utils";
import { formatNumber, formatPercent } from "@/lib/format";

const RATING: Record<SourceRating, { label: string; tone: string; hint: string }> = {
  strong: { label: "Strong", tone: "bg-good-tint text-good", hint: "Clearly more interest than the pipeline average, and no more losses" },
  average: { label: "Average", tone: "bg-surface-2 text-text-secondary", hint: "In line with the pipeline average" },
  weak: { label: "Weak", tone: "bg-critical-tint text-critical", hint: "Far less interest than average, or clearly more losses" },
  unworked: { label: "Unworked", tone: "bg-warning-tint text-warning", hint: "Most of its leads haven't been worked yet — can't be judged until they are" },
  low_volume: { label: "Low volume", tone: "bg-surface-2 text-text-muted", hint: "Too few leads to judge" },
};

type SortKey = "source" | "leads" | "contactRate" | "interestRate" | "won" | "winRate" | "lostRate";

const COLUMNS: { key: SortKey; label: string; align: "left" | "right"; title?: string }[] = [
  { key: "source", label: "Source", align: "left" },
  { key: "leads", label: "Leads", align: "right" },
  { key: "contactRate", label: "Worked", align: "right", title: "Leads the team has worked ÷ leads" },
  { key: "interestRate", label: "Interested", align: "right", title: "Interested + Qualified + Won ÷ worked leads" },
  { key: "won", label: "Won", align: "right" },
  { key: "winRate", label: "Win rate", align: "right", title: "Won ÷ (Won + Lost)" },
  { key: "lostRate", label: "Lost", align: "right", title: "Lost leads ÷ leads" },
];

/** Which sources bring good leads and which don't: volume, how many got worked, turned interested, won
 * and lost, a rating against the pipeline average, and the main reason that source's leads get lost. */
export function SourcePerformanceCard({
  data,
  isLoading,
  onViewSource,
}: {
  data: LeadSourcePerformance | undefined;
  isLoading: boolean;
  onViewSource: (sourceId: string) => void;
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "leads", dir: "desc" });

  const rows = useMemo(() => {
    const list = [...(data?.sources ?? [])];
    const value = (r: LeadSourcePerformanceRow) => (sort.key === "source" ? r.source.toLowerCase() : (r[sort.key] ?? -1));
    list.sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [data, sort]);

  function toggleSort(key: SortKey) {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "desc" ? "asc" : "desc" } : { key, dir: key === "source" ? "asc" : "desc" }));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Source Performance</CardTitle>
        <CardDescription>
          Which sources bring leads that get worked, turn interested and are won — and which don&apos;t. A lead with several
          sources counts under each.
          {data && (
            <>
              {" "}
              Rated against the whole pipeline: {formatPercent(data.baseline.interestRate)} interested, {formatPercent(data.baseline.lostRate)} lost.
              Sources under {data.minLeads} leads are &quot;Low volume&quot;.
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!data ? (
          isLoading ? <p className="text-sm text-text-muted">Loading…</p> : <EmptyState title="No source data yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-text-muted">
                  {COLUMNS.map((c) => (
                    <th key={c.key} title={c.title} className={cn("py-2 font-medium", c.align === "right" ? "text-right" : "text-left")}>
                      <button type="button" onClick={() => toggleSort(c.key)} className="inline-flex items-center gap-1 hover:text-text-primary">
                        {c.label}
                        {sort.key === c.key && (sort.dir === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />)}
                      </button>
                    </th>
                  ))}
                  <th className="py-2 pl-4 text-left font-medium">Main loss reason</th>
                  <th className="py-2 pl-4 text-left font-medium">Rating</th>
                  <th className="w-12" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const rating = RATING[r.rating];
                  return (
                    <tr key={r.sourceId ?? "none"} className="border-b border-border last:border-0">
                      <td className="py-2.5 font-medium text-text-primary">{r.source}</td>
                      <td className="py-2.5 text-right tabular-nums">{formatNumber(r.leads)}</td>
                      <td className="py-2.5 text-right tabular-nums text-text-secondary">{formatPercent(r.contactRate)}</td>
                      <td className="py-2.5 text-right tabular-nums text-text-secondary">{formatPercent(r.interestRate)}</td>
                      <td className="py-2.5 text-right tabular-nums">{formatNumber(r.won)}</td>
                      <td className="py-2.5 text-right tabular-nums text-text-secondary">{formatPercent(r.winRate)}</td>
                      <td className="py-2.5 text-right tabular-nums text-text-secondary">{formatPercent(r.lostRate)}</td>
                      <td className="py-2.5 pl-4 text-xs text-text-muted">{r.topLostReason ?? "—"}</td>
                      <td className="py-2.5 pl-4">
                        <span title={rating.hint} className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", rating.tone)}>
                          {rating.label}
                        </span>
                      </td>
                      <td className="py-2.5 text-right">
                        {r.sourceId && (
                          <button type="button" onClick={() => onViewSource(r.sourceId!)} className="text-xs font-medium text-accent-strong hover:underline">
                            View
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
