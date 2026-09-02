"use client";

import { useState } from "react";
import { SalesTargetItem, SalesTargetScope, TargetPeriodType, UpsertSalesTargetRequest } from "@hpl/shared";
import { useLeadExecutives } from "@/lib/query/useLeads";
import { useDealersList } from "@/lib/query/useDealers";
import { useProductCategories } from "@/lib/query/useProducts";
import { Button } from "@/components/ui/button";

const inputClass = "h-8 w-full rounded-sm border border-border bg-surface px-2 text-xs outline-none focus:border-accent";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-text-muted">{label}</span>
      {children}
    </label>
  );
}

const SCOPE_LABEL: Record<SalesTargetScope, string> = {
  COMPANY: "Company-wide",
  SALES_EXECUTIVE: "Sales Executive",
  DEALER: "Dealer",
  PRODUCT_CATEGORY: "Product Category",
};

function toDateInput(iso: string): string {
  return iso.slice(0, 10);
}

function blank(): UpsertSalesTargetRequest {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    scope: "COMPANY",
    periodType: "MONTHLY",
    periodStart: periodStart.toISOString().slice(0, 10),
    periodEnd: periodEnd.toISOString().slice(0, 10),
    targetRevenue: 0,
    targetOrders: undefined,
  };
}

export function SalesTargetForm({
  initial,
  onSubmit,
  onCancel,
  submitting,
}: {
  initial?: SalesTargetItem;
  onSubmit: (value: UpsertSalesTargetRequest) => void;
  onCancel: () => void;
  submitting: boolean;
}) {
  const [value, setValue] = useState<UpsertSalesTargetRequest>(
    initial
      ? {
          scope: initial.scope,
          salesExecutiveId: initial.salesExecutiveId ?? undefined,
          dealerId: initial.dealerId ?? undefined,
          productCategoryId: initial.productCategoryId ?? undefined,
          periodType: initial.periodType,
          periodStart: toDateInput(initial.periodStart),
          periodEnd: toDateInput(initial.periodEnd),
          targetRevenue: initial.targetRevenue,
          targetOrders: initial.targetOrders ?? undefined,
        }
      : blank(),
  );

  const executivesQuery = useLeadExecutives();
  const dealersQuery = useDealersList({ page: 1, pageSize: 100, sortBy: "name", sortDir: "asc", q: "" });
  const categoriesQuery = useProductCategories();

  function patch(partial: Partial<UpsertSalesTargetRequest>) {
    setValue((prev) => ({ ...prev, ...partial }));
  }

  function handleScopeChange(scope: SalesTargetScope) {
    patch({ scope, salesExecutiveId: undefined, dealerId: undefined, productCategoryId: undefined });
  }

  return (
    <form
      className="flex flex-col gap-3 rounded-sm border border-border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(value);
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Scope">
          <select
            className={inputClass}
            value={value.scope}
            onChange={(e) => handleScopeChange(e.target.value as SalesTargetScope)}
          >
            {(Object.keys(SCOPE_LABEL) as SalesTargetScope[]).map((s) => (
              <option key={s} value={s}>
                {SCOPE_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>

        {value.scope === "SALES_EXECUTIVE" && (
          <Field label="Sales Executive">
            <select
              className={inputClass}
              required
              value={value.salesExecutiveId ?? ""}
              onChange={(e) => patch({ salesExecutiveId: e.target.value })}
            >
              <option value="" disabled>
                Select an executive…
              </option>
              {(executivesQuery.data ?? []).map((exec) => (
                <option key={exec.id} value={exec.id}>
                  {exec.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        {value.scope === "DEALER" && (
          <Field label="Dealer">
            <select className={inputClass} required value={value.dealerId ?? ""} onChange={(e) => patch({ dealerId: e.target.value })}>
              <option value="" disabled>
                Select a dealer…
              </option>
              {(dealersQuery.data?.data ?? []).map((dealer) => (
                <option key={dealer.id} value={dealer.id}>
                  {dealer.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        {value.scope === "PRODUCT_CATEGORY" && (
          <Field label="Product Category">
            <select
              className={inputClass}
              required
              value={value.productCategoryId ?? ""}
              onChange={(e) => patch({ productCategoryId: e.target.value })}
            >
              <option value="" disabled>
                Select a category…
              </option>
              {(categoriesQuery.data ?? []).map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label="Period type">
          <select
            className={inputClass}
            value={value.periodType}
            onChange={(e) => patch({ periodType: e.target.value as TargetPeriodType })}
          >
            <option value="MONTHLY">Monthly</option>
            <option value="QUARTERLY">Quarterly</option>
            <option value="YEARLY">Yearly</option>
          </select>
        </Field>
        <Field label="Period start">
          <input
            type="date"
            className={inputClass}
            required
            value={value.periodStart}
            onChange={(e) => patch({ periodStart: e.target.value })}
          />
        </Field>
        <Field label="Period end">
          <input
            type="date"
            className={inputClass}
            required
            value={value.periodEnd}
            onChange={(e) => patch({ periodEnd: e.target.value })}
          />
        </Field>
        <Field label="Target revenue (₹)">
          <input
            type="number"
            min={0}
            className={inputClass}
            required
            value={value.targetRevenue}
            onChange={(e) => patch({ targetRevenue: Number(e.target.value) || 0 })}
          />
        </Field>
        <Field label="Target orders (optional)">
          <input
            type="number"
            min={0}
            className={inputClass}
            value={value.targetOrders ?? ""}
            onChange={(e) => patch({ targetOrders: e.target.value ? Number(e.target.value) : undefined })}
          />
        </Field>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={submitting}>
          {submitting ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
