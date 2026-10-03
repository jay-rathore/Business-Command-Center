"use client";

import { ColumnDef, SortingState } from "@tanstack/react-table";
import { InvoiceListItem } from "@hpl/shared";
import { useTableState } from "@/hooks/useTableState";
import { useDebounce } from "@/hooks/useDebounce";
import { useAllInvoices } from "@/lib/query/useInvoices";
import { useDrawerStore } from "@/lib/stores/drawerStore";
import { DataTable } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import { formatRupees } from "@/lib/format";

const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

/** Every invoice raised from a quotation — the second tab of the Quotations page. */
export function InvoicesPanel() {
  const { state, setPage, setSort, setQuery } = useTableState({ pageSize: 10 });
  const debouncedQuery = useDebounce(state.q);
  const openDrawer = useDrawerStore((s) => s.open);
  const listQuery = useAllInvoices({ ...state, q: debouncedQuery });
  const sorting: SortingState = state.sortBy ? [{ id: state.sortBy, desc: state.sortDir === "desc" }] : [];

  const columns: ColumnDef<InvoiceListItem, any>[] = [
    { accessorKey: "invoiceCode", header: "Invoice" },
    { id: "quotation", header: "Quotation", enableSorting: false, cell: (c) => c.row.original.quotationCode },
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
    {
      accessorKey: "totalAmount",
      header: "Total",
      cell: (c) => {
        const row = c.row.original;
        return (
          <span>
            {formatRupees(row.totalAmount)}
            {row.isNegotiated && row.quotedTotalAmount !== row.totalAmount && (
              <span className="ml-1 text-[11px] text-text-muted line-through">{formatRupees(row.quotedTotalAmount)}</span>
            )}
          </span>
        );
      },
    },
    {
      id: "negotiated",
      header: "Price",
      enableSorting: false,
      cell: (c) => <Badge variant={c.row.original.isNegotiated ? "warning" : "neutral"}>{c.row.original.isNegotiated ? "Negotiated" : "As quoted"}</Badge>,
    },
    {
      accessorKey: "status",
      header: "WhatsApp",
      enableSorting: false,
      cell: (c) => {
        const s = c.getValue<InvoiceListItem["status"]>();
        return <Badge variant={s === "SENT" ? "good" : s === "SEND_FAILED" ? "critical" : "neutral"}>{s === "SENT" ? "Sent" : s === "SEND_FAILED" ? "Failed" : "—"}</Badge>;
      },
    },
    {
      accessorKey: "emailStatus",
      header: "Email",
      enableSorting: false,
      cell: (c) => {
        const s = c.getValue<InvoiceListItem["emailStatus"]>();
        return <Badge variant={s === "SENT" ? "good" : s === "FAILED" ? "critical" : "neutral"}>{s === "SENT" ? "Sent" : s === "FAILED" ? "Failed" : "—"}</Badge>;
      },
    },
    { accessorKey: "dueDate", header: "Due", cell: (c) => shortDate(c.getValue<string>()) },
    { accessorKey: "invoiceDate", header: "Date", cell: (c) => shortDate(c.getValue<string>()) },
  ];

  return (
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
      onRowClick={(row) => openDrawer("invoice", row)}
      searchPlaceholder="Search invoice or quotation code, customer, or company…"
      isLoading={listQuery.isLoading}
      isError={listQuery.isError}
      onRetry={() => listQuery.refetch()}
      emptyMessage="No invoices yet — open a quotation once the customer confirms and click Create invoice."
    />
  );
}
