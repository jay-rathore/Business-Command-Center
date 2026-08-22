"use client";

import { RotateCw } from "lucide-react";
import { CampaignListItem } from "@hpl/shared";
import { useCampaignDetail, useRecomputeMetaSync } from "@/lib/query/useMarketing";
import { SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { CampaignPlatformBadge } from "./CampaignPlatformBadge";
import { CampaignStatusBadge } from "./CampaignStatusBadge";
import { CampaignSourceBadge } from "./CampaignSourceBadge";
import { formatCurrency, formatNumber } from "@/lib/format";

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
}

export function CampaignDrawerContent({ data }: { data: CampaignListItem }) {
  const detailQuery = useCampaignDetail(data.id);
  const resync = useRecomputeMetaSync();
  const campaign = detailQuery.data ?? data;

  return (
    <>
      <SheetHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <SheetTitle>{campaign.name}</SheetTitle>
            <SheetDescription>
              {formatDate(campaign.startDate)} — {formatDate(campaign.endDate)}
            </SheetDescription>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <CampaignStatusBadge status={campaign.status} />
            <CampaignSourceBadge source={campaign.source} />
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <CampaignPlatformBadge platform={campaign.platform} />
        </div>
      </SheetHeader>

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-5">
        {campaign.source === "live" && (
          <div className="flex items-center justify-between rounded-sm bg-accent-tint px-3 py-2">
            <p className="text-xs text-accent-strong">Live data synced from Meta Ads.</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => resync.mutate()}
              disabled={resync.isPending}
              className="h-6 px-2 text-xs"
            >
              <RotateCw className={`h-3 w-3 ${resync.isPending ? "animate-spin" : ""}`} />
              Resync
            </Button>
          </div>
        )}

        <section className="grid grid-cols-2 gap-3">
          <Stat label="Spend" value={formatCurrency(campaign.spend)} />
          <Stat label="Leads" value={formatNumber(campaign.leadsCount)} />
          <Stat label="Cost per Lead" value={campaign.cpl != null ? formatCurrency(campaign.cpl) : "—"} />
          <Stat label="ROAS" value={campaign.roas != null ? `${campaign.roas.toFixed(2)}x` : "—"} />
        </section>

        {campaign.source === "demo" && (
          <p className="text-xs text-text-muted">
            Revenue ({formatCurrency(campaign.revenue)}) and ROAS are placeholder figures pending real Sales data.
          </p>
        )}

        {detailQuery.data?.notes && (
          <section className="flex flex-col gap-2">
            <h4 className="text-xs font-medium text-text-muted">Notes</h4>
            <p className="text-xs text-text-secondary">{detailQuery.data.notes}</p>
          </section>
        )}
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
