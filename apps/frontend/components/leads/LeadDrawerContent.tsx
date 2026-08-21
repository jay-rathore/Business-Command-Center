"use client";

import { useState } from "react";
import { LeadListItem } from "@hpl/shared";
import { useAddLeadActivity, useLeadDetail, useLeadStatuses } from "@/lib/query/useLeads";
import { useLeadQuotations, quotationPdfUrl } from "@/lib/query/useQuotations";
import { SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ActivityTimeline } from "@/components/shared/ActivityTimeline";
import { SendQuotationDialog } from "@/components/quotations/SendQuotationDialog";
import { LeadStatusBadge } from "./LeadStatusBadge";
import { formatCurrency } from "@/lib/format";

const ACTIVITY_TYPES = ["CALL", "EMAIL", "WHATSAPP", "MEETING", "SITE_VISIT", "SAMPLE_SENT", "QUOTE_SENT", "NOTE"];

export function LeadDrawerContent({ data }: { data: LeadListItem }) {
  const detailQuery = useLeadDetail(data.id);
  const statusesQuery = useLeadStatuses();
  const addActivity = useAddLeadActivity();
  const quotationsQuery = useLeadQuotations(data.id);
  const lead = detailQuery.data ?? data;

  const [activityType, setActivityType] = useState("CALL");
  const [note, setNote] = useState("");
  const [newStatusId, setNewStatusId] = useState<string>("");
  const [quotationDialogOpen, setQuotationDialogOpen] = useState(false);

  function handleLogActivity(e: React.FormEvent) {
    e.preventDefault();
    addActivity.mutate(
      { leadId: lead.id, type: activityType, note: note || undefined, newStatusId: newStatusId || undefined },
      { onSuccess: () => setNote("") },
    );
  }

  return (
    <>
      <SheetHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <SheetTitle>{lead.name}</SheetTitle>
            <SheetDescription>
              {lead.leadCode} {lead.company ? `· ${lead.company}` : ""}
            </SheetDescription>
          </div>
          <LeadStatusBadge status={lead.status} />
        </div>
        <div className="mt-2 flex items-end gap-3">
          <span className="font-display text-2xl font-semibold text-text-primary">{lead.score}</span>
          <span className="pb-0.5 text-xs text-text-muted">lead score</span>
        </div>
      </SheetHeader>

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-5">
        <section className="grid grid-cols-2 gap-3">
          <Stat label="Estimated value" value={lead.estimatedValue ? formatCurrency(lead.estimatedValue) : "—"} />
          <Stat label="Source" value={lead.sources.length > 0 ? lead.sources.map((s) => s.name).join(", ") : "—"} />
        </section>

        <Button type="button" size="sm" className="self-start" onClick={() => setQuotationDialogOpen(true)}>
          Send Quotation
        </Button>

        <section className="flex flex-col gap-2">
          <h4 className="text-xs font-medium text-text-muted">Lead details</h4>
          <DetailRow label="Phone" value={lead.phone} />
          <DetailRow label="Location" value={`${lead.city}, ${lead.state}`} />
          <DetailRow label="Type" value={lead.leadType?.name ?? "—"} />
          <DetailRow label="Assigned to" value={lead.assignedExecName ?? "Unassigned"} />
          <DetailRow
            label="Next follow-up"
            value={lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
          />
          {detailQuery.data?.notes && <DetailRow label="Notes" value={detailQuery.data.notes} />}
          {detailQuery.data?.lostReason && <DetailRow label="Lost reason" value={detailQuery.data.lostReason} />}
        </section>

        <section className="flex flex-col gap-3">
          <h4 className="text-xs font-medium text-text-muted">Log activity</h4>
          <form onSubmit={handleLogActivity} className="flex flex-col gap-2 rounded-sm border border-border p-3">
            <div className="flex gap-2">
              <select
                value={activityType}
                onChange={(e) => setActivityType(e.target.value)}
                className="h-8 flex-1 rounded-sm border border-border bg-surface px-2 text-xs outline-none focus:border-accent"
              >
                {ACTIVITY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
              <select
                value={newStatusId}
                onChange={(e) => setNewStatusId(e.target.value)}
                className="h-8 flex-1 rounded-sm border border-border bg-surface px-2 text-xs outline-none focus:border-accent"
              >
                <option value="">Keep status</option>
                {(statusesQuery.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    Move to {s.name}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note (optional)…"
              rows={2}
              className="resize-none rounded-sm border border-border bg-surface px-2 py-1.5 text-xs outline-none focus:border-accent"
            />
            <Button type="submit" size="sm" disabled={addActivity.isPending} className="self-end">
              {addActivity.isPending ? "Logging…" : "Log activity"}
            </Button>
          </form>
        </section>

        <section className="flex flex-col gap-3">
          <h4 className="text-xs font-medium text-text-muted">Activity timeline</h4>
          <ActivityTimeline entries={detailQuery.data?.activities ?? []} />
        </section>

        <section className="flex flex-col gap-2">
          <h4 className="text-xs font-medium text-text-muted">Quotations</h4>
          {quotationsQuery.data && quotationsQuery.data.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {quotationsQuery.data.map((q) => (
                <div key={q.id} className="flex items-center justify-between gap-2 rounded-sm border border-border p-2 text-xs">
                  <div className="flex flex-col">
                    <span className="font-medium text-text-primary">{q.quotationCode}</span>
                    <span className="text-text-muted">{formatCurrency(q.totalAmount)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={q.status === "SENT" ? "good" : q.status === "SEND_FAILED" ? "critical" : "neutral"}>
                      WhatsApp {q.status === "SENT" ? "sent" : q.status === "SEND_FAILED" ? "failed" : "—"}
                    </Badge>
                    <Badge variant={q.emailStatus === "SENT" ? "good" : q.emailStatus === "FAILED" ? "critical" : "neutral"}>
                      Email {q.emailStatus === "SENT" ? "sent" : q.emailStatus === "FAILED" ? "failed" : "—"}
                    </Badge>
                    <a href={quotationPdfUrl(q.id)} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                      View PDF
                    </a>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-text-muted">No quotations sent yet.</p>
          )}
        </section>
      </div>

      <SendQuotationDialog lead={lead} open={quotationDialogOpen} onOpenChange={setQuotationDialogOpen} />
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-sm border border-border bg-bg p-3">
      <span className="text-xs text-text-muted">{label}</span>
      <span className="text-sm font-semibold capitalize text-text-primary">{value}</span>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border py-2 text-xs last:border-0">
      <span className="shrink-0 text-text-muted">{label}</span>
      <span className="text-right font-medium capitalize text-text-primary">{value}</span>
    </div>
  );
}
