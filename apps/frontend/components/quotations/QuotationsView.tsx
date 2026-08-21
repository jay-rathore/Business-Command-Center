"use client";

import { useState } from "react";
import { ColumnDef, SortingState } from "@tanstack/react-table";
import { LeadListItem, PaginatedResponse, QuotationListItem } from "@hpl/shared";
import { useTableState } from "@/hooks/useTableState";
import { useDebounce } from "@/hooks/useDebounce";
import { useAllQuotations } from "@/lib/query/useQuotations";
import { useDrawerStore } from "@/lib/stores/drawerStore";
import { DataTable } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { NewQuotationDialog } from "./NewQuotationDialog";
import { SendQuotationDialog } from "./SendQuotationDialog";

export function QuotationsView({ initialList }: { initialList: PaginatedResponse<QuotationListItem> | null }) {
  const { state, setPage, setSort, setQuery } = useTableState({ pageSize: 10 });
  const debouncedQuery = useDebounce(state.q);
  const openDrawer = useDrawerStore((s) => s.open);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadListItem | null>(null);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);

  const listQuery = useAllQuotations({ ...state, q: debouncedQuery }, initialList ?? undefined);

  const sorting: SortingState = state.sortBy ? [{ id: state.sortBy, desc: state.sortDir === "desc" }] : [];

  const columns: ColumnDef<QuotationListItem, any>[] = [
    { accessorKey: "quotationCode", header: "Quotation" },
    {
      id: "customer",
      header: "Lead / Customer",
      enableSorting: false,
      cell: (c) => {
        const row = c.row.original;
        return (
          <span>
            {row.leadName} {row.leadCompany ? <span className="text-text-muted">· {row.leadCompany}</span> : null}
          </span>
        );
      },
    },
    { accessorKey: "totalAmount", header: "Total", cell: (c) => formatCurrency(c.getValue()) },
    {
      accessorKey: "status",
      header: "WhatsApp",
      enableSorting: false,
      cell: (c) => {
        const status = c.getValue<QuotationListItem["status"]>();
        return (
          <Badge variant={status === "SENT" ? "good" : status === "SEND_FAILED" ? "critical" : "neutral"}>
            {status === "SENT" ? "Sent" : status === "SEND_FAILED" ? "Failed" : "—"}
          </Badge>
        );
      },
    },
    {
      accessorKey: "emailStatus",
      header: "Email",
      enableSorting: false,
      cell: (c) => {
        const status = c.getValue<QuotationListItem["emailStatus"]>();
        return (
          <Badge variant={status === "SENT" ? "good" : status === "FAILED" ? "critical" : "neutral"}>
            {status === "SENT" ? "Sent" : status === "FAILED" ? "Failed" : "—"}
          </Badge>
        );
      },
    },
    {
      accessorKey: "quotationDate",
      header: "Date",
      // Fixed timeZone so SSR (container, usually UTC) and client hydration (browser's local
      // zone) always agree — otherwise a date near midnight IST renders as a different day on
      // each side and React throws a hydration mismatch.
      cell: (c) =>
        new Date(c.getValue<string>()).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
          timeZone: "Asia/Kolkata",
        }),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold text-text-primary">Quotations</h1>
          <p className="text-sm text-text-muted">Every quotation generated across all leads — search, resend, or start a new one.</p>
        </div>
        <Button type="button" onClick={() => setPickerOpen(true)}>
          + New Quotation
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={listQuery.data?.data ?? []}
        meta={listQuery.data?.meta ?? { page: 1, pageSize: state.pageSize, total: 0, totalPages: 1 }}
        page={state.page}
        onPageChange={setPage}
        sorting={sorting}
        onSortingChange={(updater) => {
          const next = typeof updater === "function" ? updater(sorting) : updater;
          if (next[0]) setSort(next[0].id);
        }}
        query={state.q}
        onQueryChange={setQuery}
        onRowClick={(row) => openDrawer("quotation", row)}
        searchPlaceholder="Search quotation code, customer, or company…"
        isLoading={listQuery.isLoading}
        isError={listQuery.isError}
        onRetry={() => listQuery.refetch()}
        emptyMessage="No quotations yet — click New Quotation to send your first one."
      />

      <NewQuotationDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onLeadSelected={(lead) => {
          setSelectedLead(lead);
          setPickerOpen(false);
          setSendDialogOpen(true);
        }}
      />

      {selectedLead && <SendQuotationDialog lead={selectedLead} open={sendDialogOpen} onOpenChange={setSendDialogOpen} />}
    </div>
  );
}
