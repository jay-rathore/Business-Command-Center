"use client";

import { ReferralPartnerListItem } from "@hpl/shared";
import { useBuilderDetail } from "@/lib/query/useBuilders";
import { SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { formatCurrency, formatNumber } from "@/lib/format";

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
}

export function BuilderDrawerContent({ data }: { data: ReferralPartnerListItem }) {
  const detailQuery = useBuilderDetail(data.id);
  const builder = detailQuery.data ?? data;

  return (
    <>
      <SheetHeader>
        <SheetTitle>{builder.name}</SheetTitle>
        <SheetDescription>
          {builder.company ?? "Independent"} · {builder.city}, {builder.state}
        </SheetDescription>
      </SheetHeader>

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-5">
        <section className="grid grid-cols-2 gap-3">
          <Stat label="Projects referred" value={formatNumber(builder.projectsReferred)} />
          <Stat label="Leads referred" value={formatNumber(builder.leadsReferred)} />
          <Stat label="Sample requests" value={formatNumber(builder.sampleRequestsSent)} />
          <Stat label="Project value" value={formatCurrency(builder.projectValue)} />
          <Stat label="Revenue influenced" value={formatCurrency(builder.revenueInfluenced)} />
        </section>

        <section className="flex flex-col gap-2">
          <h4 className="text-xs font-medium text-text-muted">Contact details</h4>
          <DetailRow label="Phone" value={builder.phone ?? "—"} />
          <DetailRow label="Email" value={builder.email ?? "—"} />
          <DetailRow label="Joined" value={formatDate(builder.joinedAt)} />
          <DetailRow label="Last activity" value={formatDate(builder.lastActivityAt)} />
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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-2 text-xs last:border-0">
      <span className="text-text-muted">{label}</span>
      <span className="font-medium text-text-primary">{value}</span>
    </div>
  );
}
