"use client";

import { ProjectListItem, ProjectStage } from "@hpl/shared";
import { useProjectDetail, useUpdateProjectStage } from "@/lib/query/useProjects";
import { SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ActivityTimeline } from "@/components/shared/ActivityTimeline";
import { ProjectStageBadge } from "./ProjectStageBadge";
import { formatCurrency, formatNumber } from "@/lib/format";

const STAGES: ProjectStage[] = ["LEAD", "DISCOVERY", "SAMPLE", "DESIGN_APPROVAL", "QUOTATION", "NEGOTIATION", "ORDER", "COMPLETED", "LOST"];
const STAGE_LABEL: Record<ProjectStage, string> = {
  LEAD: "Lead",
  DISCOVERY: "Discovery",
  SAMPLE: "Sample",
  DESIGN_APPROVAL: "Design Approval",
  QUOTATION: "Quotation",
  NEGOTIATION: "Negotiation",
  ORDER: "Order",
  COMPLETED: "Completed",
  LOST: "Lost",
};

export function ProjectDrawerContent({ data }: { data: ProjectListItem }) {
  const detailQuery = useProjectDetail(data.id);
  const updateStage = useUpdateProjectStage();
  const project = detailQuery.data ?? data;

  return (
    <>
      <SheetHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <SheetTitle>{project.name}</SheetTitle>
            <SheetDescription>{project.projectCode}</SheetDescription>
          </div>
          <ProjectStageBadge stage={project.stage} />
        </div>
        <div className="mt-2 flex items-end gap-3">
          <span className="font-display text-2xl font-semibold text-text-primary">{formatCurrency(project.estimatedValue)}</span>
          <span className="pb-0.5 text-xs text-text-muted">est. value · {formatCurrency(project.weightedValue)} weighted</span>
        </div>
      </SheetHeader>

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-5">
        <section className="flex flex-col gap-2">
          <h4 className="text-xs font-medium text-text-muted">Move stage</h4>
          <select
            value={project.stage}
            onChange={(e) => updateStage.mutate({ id: project.id, toStage: e.target.value as ProjectStage })}
            disabled={updateStage.isPending}
            className="h-9 rounded-sm border border-border bg-surface px-2 text-sm outline-none focus:border-accent"
          >
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABEL[s]}
              </option>
            ))}
          </select>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <Stat label="Probability" value={`${project.probability}%`} />
          <Stat label="Days in stage" value={String(project.daysInStage)} />
          <Stat label="HPL quantity" value={project.expectedHplQty ? `${formatNumber(project.expectedHplQty)} sheets` : "—"} />
          <Stat
            label="Expected close"
            value={project.expectedCloseAt ? new Date(project.expectedCloseAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"}
          />
        </section>

        <section className="flex flex-col gap-2">
          <h4 className="text-xs font-medium text-text-muted">Project details</h4>
          <DetailRow label="Location" value={`${project.city}, ${project.state}`} />
          <DetailRow label="Category" value={`${project.category} · ${project.typeLabel}`} />
          <DetailRow label="Customer" value={project.customerName ?? "—"} />
          <DetailRow label="Architect" value={project.architectName ?? "—"} />
          <DetailRow label="Builder" value={project.builderName ?? "—"} />
          <DetailRow label="Dealer" value={project.dealerName ?? "—"} />
          <DetailRow label="Sales executive" value={project.salesExecName ?? "Unassigned"} />
          {detailQuery.data?.notes && <DetailRow label="Notes" value={detailQuery.data.notes} />}
        </section>

        <section className="flex flex-col gap-3">
          <h4 className="text-xs font-medium text-text-muted">Activity timeline</h4>
          <ActivityTimeline entries={detailQuery.data?.activities ?? []} />
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
    <div className="flex items-center justify-between gap-3 border-b border-border py-2 text-xs last:border-0">
      <span className="shrink-0 text-text-muted">{label}</span>
      <span className="text-right font-medium text-text-primary">{value}</span>
    </div>
  );
}
