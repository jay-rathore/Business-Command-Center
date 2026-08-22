"use client";

import { RotateCw } from "lucide-react";
import { CustomerListItem } from "@hpl/shared";
import { useCustomerDetail, useRecomputeCustomerMetrics } from "@/lib/query/useCustomers";
import { SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { CustomerSegmentBadge } from "./CustomerSegmentBadge";
import { formatCurrency, formatNumber } from "@/lib/format";

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
}

export function CustomerDrawerContent({ data }: { data: CustomerListItem }) {
  const detailQuery = useCustomerDetail(data.id);
  const recompute = useRecomputeCustomerMetrics();
  const customer = detailQuery.data ?? data;

  return (
    <>
      <SheetHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <SheetTitle>{customer.companyName ?? customer.name}</SheetTitle>
            <SheetDescription>
              {customer.customerCode} · {customer.city}, {customer.state}
            </SheetDescription>
          </div>
          <CustomerSegmentBadge segment={customer.segment} />
        </div>
        <div className="mt-2 flex items-end gap-3">
          <span className="font-display text-2xl font-semibold text-text-primary">{formatCurrency(customer.lifetimeValue)}</span>
          <span className="pb-0.5 text-xs text-text-muted">lifetime value · {formatNumber(customer.totalOrders)} orders</span>
        </div>
      </SheetHeader>

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-5">
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-medium text-text-muted">Metrics</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => recompute.mutate(customer.id)}
              disabled={recompute.isPending}
              className="h-6 px-2 text-xs"
            >
              <RotateCw className={`h-3 w-3 ${recompute.isPending ? "animate-spin" : ""}`} />
              Recompute
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="First purchase" value={formatDate(customer.firstPurchaseAt)} />
            <Stat label="Last purchase" value={formatDate(customer.lastPurchaseAt)} />
            {detailQuery.data && <Stat label="Open complaints" value={formatNumber(detailQuery.data.openComplaints)} />}
            {detailQuery.data && <Stat label="Active warranty claims" value={formatNumber(detailQuery.data.activeWarrantyClaims)} />}
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <h4 className="text-xs font-medium text-text-muted">Customer details</h4>
          <DetailRow label="Type" value={customer.type} />
          <DetailRow label="Phone" value={customer.phone} />
          {detailQuery.data?.email && <DetailRow label="Email" value={detailQuery.data.email} />}
          {detailQuery.data?.address && <DetailRow label="Address" value={detailQuery.data.address} />}
        </section>

        {detailQuery.data && detailQuery.data.recentOrders.length > 0 && (
          <section className="flex flex-col gap-2">
            <h4 className="text-xs font-medium text-text-muted">Recent orders</h4>
            {detailQuery.data.recentOrders.map((o) => (
              <div key={o.id} className="flex items-center justify-between rounded-sm border border-border px-3 py-2 text-xs">
                <span className="text-text-secondary">
                  {o.orderCode} · {formatDate(o.orderDate)}
                </span>
                <span className="font-medium text-text-primary">{formatCurrency(o.totalAmount)}</span>
              </div>
            ))}
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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-2 text-xs last:border-0">
      <span className="text-text-muted">{label}</span>
      <span className="font-medium text-text-primary">{value}</span>
    </div>
  );
}
