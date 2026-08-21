"use client";

import { ProductListItem } from "@hpl/shared";
import { useProductDetail } from "@/lib/query/useProducts";
import { SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { RankedBarList } from "@/components/shared/RankedBarList";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";

const DEMAND_TIER_VARIANT = { High: "good", Medium: "warning", Low: "neutral" } as const;

export function ProductDrawerContent({ data }: { data: ProductListItem }) {
  const detailQuery = useProductDetail(data.id);
  const product = detailQuery.data ?? data;

  return (
    <>
      <SheetHeader>
        <SheetTitle>{product.sku}</SheetTitle>
        <SheetDescription>{product.categoryName}</SheetDescription>
        <div className="mt-2 flex items-end gap-3">
          <span className="font-display text-2xl font-semibold text-text-primary">
            {formatNumber(product.units)}
          </span>
          <span className="pb-0.5 text-xs text-text-muted">units sold · {formatNumber(product.orders)} orders</span>
        </div>
      </SheetHeader>

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-5">
        <section className="grid grid-cols-2 gap-3">
          <Stat label="Revenue" value={formatCurrency(product.revenue)} />
          <Stat
            label="Growth"
            value={formatPercent(product.growth, { signed: true })}
            tone={product.growth === null ? "neutral" : product.growth >= 0 ? "good" : "critical"}
          />
          <Stat label="Unit price" value={formatCurrency(product.unitPrice)} />
          <Stat
            label="Demand tier"
            value={<Badge variant={DEMAND_TIER_VARIANT[product.demandTier]}>{product.demandTier}</Badge>}
          />
        </section>

        <section className="flex flex-col gap-2">
          <h4 className="text-xs font-medium text-text-muted">Product details</h4>
          <DetailRow label="Category" value={product.categoryName} />
          <DetailRow label="Shade" value={product.shadeName ?? "—"} />
          <DetailRow label="Design" value={product.design ?? "—"} />
        </section>

        <section className="flex flex-col gap-3">
          <h4 className="text-xs font-medium text-text-muted">Demand by state</h4>
          {detailQuery.data && detailQuery.data.demandByState.length > 0 ? (
            <RankedBarList
              entries={detailQuery.data.demandByState.map((d) => ({
                label: d.state,
                value: d.units,
                displayValue: `${formatNumber(d.units)} (${d.pct.toFixed(0)}%)`,
              }))}
            />
          ) : (
            <p className="text-xs text-text-muted">
              No order data yet for this SKU — demand-by-state fills in once orders are recorded.
            </p>
          )}
        </section>
      </div>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "good" | "critical" | "neutral" }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-sm border border-border bg-bg p-3">
      <span className="text-xs text-text-muted">{label}</span>
      <span
        className={
          "text-sm font-semibold " +
          (tone === "good" ? "text-good" : tone === "critical" ? "text-critical" : "text-text-primary")
        }
      >
        {value}
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
