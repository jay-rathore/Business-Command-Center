"use client";

import { useState } from "react";
import { RoleName, SalesTargetItem } from "@hpl/shared";
import { useAuthUser } from "@/lib/auth/AuthUserContext";
import { useCreateSalesTarget, useDeleteSalesTarget, useSalesTargets, useUpdateSalesTarget } from "@/lib/query/useSalesTargets";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCurrency, formatPercent } from "@/lib/format";
import { SalesTargetForm } from "./SalesTargetForm";

const SCOPE_LABEL: Record<SalesTargetItem["scope"], string> = {
  COMPANY: "Company",
  SALES_EXECUTIVE: "Exec",
  DEALER: "Dealer",
  PRODUCT_CATEGORY: "Category",
};

function scopeName(target: SalesTargetItem): string {
  return target.salesExecutiveName ?? target.dealerName ?? target.productCategoryName ?? "Company-wide";
}

function periodLabel(target: SalesTargetItem): string {
  const start = new Date(target.periodStart).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
  return start;
}

export function SalesTargetsSettings() {
  const user = useAuthUser();
  const canManage = user.role === RoleName.OWNER || user.role === RoleName.ADMIN;

  const targets = useSalesTargets();
  const create = useCreateSalesTarget();
  const update = useUpdateSalesTarget();
  const remove = useDeleteSalesTarget();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  if (!canManage) return null;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle>Sales Targets</CardTitle>
          <CardDescription>Revenue goals by company, sales executive, dealer, or product category.</CardDescription>
        </div>
        {!creating && (
          <Button type="button" size="sm" variant="secondary" onClick={() => setCreating(true)}>
            + New Target
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {creating && (
          <SalesTargetForm
            onSubmit={(value) => create.mutate(value, { onSuccess: () => setCreating(false) })}
            onCancel={() => setCreating(false)}
            submitting={create.isPending}
          />
        )}

        {targets.data?.data.map((target) =>
          editingId === target.id ? (
            <SalesTargetForm
              key={target.id}
              initial={target}
              onSubmit={(value) => update.mutate({ id: target.id, ...value }, { onSuccess: () => setEditingId(null) })}
              onCancel={() => setEditingId(null)}
              submitting={update.isPending}
            />
          ) : (
            <div key={target.id} className="flex items-center justify-between gap-3 rounded-sm border border-border p-3 text-xs">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-accent-tint px-2 py-0.5 text-[10px] font-medium text-accent-strong">
                    {SCOPE_LABEL[target.scope]}
                  </span>
                  <span className="font-medium text-text-primary">{scopeName(target)}</span>
                  <span className="text-text-muted">· {periodLabel(target)}</span>
                </div>
                <span className="text-text-muted">
                  {formatCurrency(target.achievedRevenue)} of {formatCurrency(target.targetRevenue)}
                  {" · "}
                  <span
                    className={cn(
                      "font-medium",
                      target.achievementPct == null
                        ? "text-text-muted"
                        : target.achievementPct >= 100
                          ? "text-good"
                          : target.achievementPct >= 70
                            ? "text-warning"
                            : "text-critical",
                    )}
                  >
                    {formatPercent(target.achievementPct)}
                  </span>
                </span>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button type="button" size="sm" variant="ghost" onClick={() => setEditingId(target.id)}>
                  Edit
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => remove.mutate(target.id)}>
                  Delete
                </Button>
              </div>
            </div>
          ),
        )}

        {targets.data && targets.data.data.length === 0 && !creating && (
          <p className="text-xs text-text-muted">No sales targets yet — add one to start tracking achievement.</p>
        )}
      </CardContent>
    </Card>
  );
}
