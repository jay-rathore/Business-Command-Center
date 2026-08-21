"use client";

import { useState } from "react";
import { LeadListItem } from "@hpl/shared";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useDebounce } from "@/hooks/useDebounce";
import { useLeadsList } from "@/lib/query/useLeads";

/** A search-and-pick step in front of SendQuotationDialog, for starting a quotation directly
 * from the standalone Quotations section rather than drilling into a specific lead first. */
export function NewQuotationDialog({
  open,
  onOpenChange,
  onLeadSelected,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLeadSelected: (lead: LeadListItem) => void;
}) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query);
  const leadsQuery = useLeadsList({ page: 1, pageSize: 8, sortDir: "desc", q: debouncedQuery });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Quotation</DialogTitle>
          <DialogDescription>Search for the customer/lead to quote.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 p-5">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, company, or phone…"
            className="h-9 rounded-sm border border-border bg-surface px-3 text-sm outline-none focus:border-accent"
          />

          <div className="flex max-h-80 flex-col gap-1 overflow-y-auto">
            {leadsQuery.isLoading && <p className="p-2 text-xs text-text-muted">Searching…</p>}
            {leadsQuery.data && leadsQuery.data.data.length === 0 && (
              <p className="p-2 text-xs text-text-muted">No leads match.</p>
            )}
            {leadsQuery.data?.data.map((lead) => (
              <button
                key={lead.id}
                type="button"
                onClick={() => onLeadSelected(lead)}
                className="flex flex-col items-start gap-0.5 rounded-sm border border-border p-2.5 text-left text-xs hover:bg-surface-hover"
              >
                <span className="font-medium text-text-primary">
                  {lead.name} {lead.company ? `· ${lead.company}` : ""}
                </span>
                <span className="text-text-muted">
                  {lead.phone} · {lead.city}, {lead.state}
                </span>
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
