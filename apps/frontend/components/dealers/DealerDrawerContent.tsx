"use client";

import { RotateCw } from "lucide-react";
import { DealerListItem } from "@hpl/shared";
import { useDealerDetail, useRecomputeDealerScore } from "@/lib/query/useDealers";
import { SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { DealerStatusBadge } from "./DealerStatusBadge";
import { formatCurrency, formatNumber } from "@/lib/format";

export function DealerDrawerContent({ data }: { data: DealerListItem }) {
  const detailQuery = useDealerDetail(data.id);
  const recompute = useRecomputeDealerScore();
  const dealer = detailQuery.data ?? data;
  const breakdown = detailQuery.data?.healthScoreBreakdown;

  return (
    <>
      <SheetHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <SheetTitle>{dealer.name}</SheetTitle>
            <SheetDescription>
              {dealer.dealerCode} · {dealer.city}, {dealer.state}
            </SheetDescription>
          </div>
          <DealerStatusBadge status={dealer.status} />
        </div>
        <div className="mt-2 flex items-end gap-3">
          <span className="font-display text-2xl font-semibold text-text-primary">{dealer.healthScore ?? "—"}</span>
          <span className="pb-0.5 text-xs text-text-muted">health score · {formatCurrency(dealer.revenue)} lifetime</span>
        </div>
      </SheetHeader>

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-5">
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-medium text-text-muted">Health score breakdown</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => recompute.mutate(dealer.id)}
              disabled={recompute.isPending}
              className="h-6 px-2 text-xs"
            >
              <RotateCw className={`h-3 w-3 ${recompute.isPending ? "animate-spin" : ""}`} />
              Recompute
            </Button>
          </div>
          {breakdown ? (
            <div className="flex flex-col gap-2">
              <FactorRow label="Order frequency" value={breakdown.orderFrequency.label} sub={`${breakdown.orderFrequency.orderCount} lifetime orders`} />
              <FactorRow label="Revenue" value={breakdown.revenue.label} sub={formatCurrency(breakdown.revenue.trailing30dRevenue) + " (30d)"} />
              <FactorRow
                label="Recent activity"
                value={breakdown.recentActivity.label}
                sub={breakdown.recentActivity.daysSinceLastOrder != null ? `${breakdown.recentActivity.daysSinceLastOrder} days since last order` : "No orders yet"}
              />
              <FactorRow
                label="Growth"
                value={breakdown.growth.label}
                sub={breakdown.growth.growthPct != null ? `${breakdown.growth.growthPct.toFixed(1)}% MoM` : "—"}
              />
              <FactorRow label="Relationship" value={breakdown.recency.label} sub={`${breakdown.recency.tenureYears} years`} />
            </div>
          ) : (
            <p className="text-xs text-text-muted">Score breakdown not available yet.</p>
          )}
        </section>

        <section className="grid grid-cols-2 gap-3">
          <Stat label="Total orders" value={formatNumber(dealer.totalOrders)} />
          <Stat label="Growth" value={dealer.growth != null ? `${dealer.growth.toFixed(1)}%` : "—"} />
        </section>

        <section className="flex flex-col gap-2">
          <h4 className="text-xs font-medium text-text-muted">Dealer details</h4>
          <DetailRow label="Contact" value={dealer.contactName ?? "—"} />
          {detailQuery.data?.phone && <DetailRow label="Phone" value={detailQuery.data.phone} />}
          <DetailRow label="Manager" value={dealer.managerName ?? "Unassigned"} />
          <DetailRow label="Joined" value={new Date(dealer.joinedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} />
          <DetailRow
            label="Last order"
            value={dealer.lastOrderAt ? new Date(dealer.lastOrderAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
          />
        </section>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-sm border border-border bg-bg p-3">
      <span className="text-xs text-text-muted">{label}</span>
      <span className="text-sm font-semibold text-text-primary">{value}</span>
    </div>
  );
}

function FactorRow({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="flex items-center justify-between rounded-sm border border-border px-3 py-2">
      <span className="text-xs text-text-secondary">{label}</span>
      <span className="text-right">
        <span className="block text-xs font-medium text-text-primary">{value}</span>
        <span className="block text-[11px] text-text-muted">{sub}</span>
      </span>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-2 text-xs last:border-0">
      <span className="text-text-muted">{label}</span>
      <span className="font-medium text-text-primary">{value}</span>
    </div>
  );
}
