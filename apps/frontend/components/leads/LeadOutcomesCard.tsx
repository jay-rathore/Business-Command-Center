"use client";

import { LeadOutcomes } from "@hpl/shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/EmptyState";
import { cn } from "@/lib/utils";
import { formatNumber, formatPercent } from "@/lib/format";

const BAR_TONE: Record<string, string> = { won: "bg-good", lost: "bg-critical", other: "bg-text-muted" };

/** Where every lead currently stands. The rows are mutually exclusive and add up to the total, so
 * "how many came in / were worked / were lost, and why" can be read straight off the page. */
export function LeadOutcomesCard({
  outcomes,
  isLoading,
  onViewStage,
}: {
  outcomes: LeadOutcomes | undefined;
  isLoading: boolean;
  onViewStage: (stage: "WON" | "LOST") => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Lead Outcomes</CardTitle>
        <CardDescription>
          Where every lead stands right now (by its current CRM status). The rows add up to the total
          {outcomes ? ` — ${formatNumber(outcomes.total)} leads` : ""}.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {!outcomes ? (
          isLoading ? <p className="text-sm text-text-muted">Loading…</p> : <EmptyState title="No lead data yet" />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
              {outcomes.rates.map((r) => (
                <div key={r.key} className="rounded-sm border border-border p-3" title={r.description}>
                  <div className="text-[11px] font-medium text-text-muted">{r.label}</div>
                  <div className="mt-1 text-lg font-semibold text-text-primary">{formatPercent(r.value)}</div>
                </div>
              ))}
            </div>

            <ul className="flex flex-col divide-y divide-border">
              {outcomes.buckets.map((b) => (
                <li key={b.key} className="flex flex-col gap-1.5 py-2.5">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm sm:flex-nowrap">
                    <span className="w-full shrink-0 font-medium text-text-primary sm:w-44">{b.label}</span>
                    <div className="h-2 min-w-[5rem] flex-1 rounded-full bg-surface-2">
                      <div
                        className={cn("h-full rounded-full", BAR_TONE[b.key] ?? "bg-accent")}
                        style={{ width: `${Math.max(b.count > 0 ? 0.6 : 0, b.pctOfTotal)}%` }}
                      />
                    </div>
                    <span className="w-16 shrink-0 text-right tabular-nums text-text-primary">{formatNumber(b.count)}</span>
                    <span className="w-14 shrink-0 text-right text-xs tabular-nums text-text-muted">{formatPercent(b.pctOfTotal)}</span>
                    {b.stage ? (
                      <button
                        type="button"
                        onClick={() => onViewStage(b.stage!)}
                        className="w-12 shrink-0 text-right text-xs font-medium text-accent-strong hover:underline"
                      >
                        View
                      </button>
                    ) : (
                      <span className="w-12 shrink-0" />
                    )}
                  </div>
                  {b.statuses.length > 1 || b.key === "lost" ? (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 sm:pl-44 text-xs text-text-muted">
                      {b.statuses.map((s) => (
                        <span key={s.name}>
                          {s.name} <span className="tabular-nums text-text-secondary">{formatNumber(s.count)}</span>
                          {b.count > 0 && <span className="tabular-nums"> ({formatPercent((s.count / b.count) * 100)})</span>}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
