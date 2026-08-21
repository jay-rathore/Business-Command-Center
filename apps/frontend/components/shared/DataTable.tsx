"use client";

import {
  ColumnDef,
  OnChangeFn,
  SortingState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { AlertOctagon, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, RotateCw, Search } from "lucide-react";
import { PaginationMeta } from "@hpl/shared";
import { cn } from "@/lib/utils";

interface DataTableProps<T> {
  columns: ColumnDef<T, any>[];
  data: T[];
  meta: PaginationMeta;
  page: number;
  onPageChange: (page: number) => void;
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
  query: string;
  onQueryChange: (q: string) => void;
  onRowClick?: (row: T) => void;
  searchPlaceholder?: string;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  emptyMessage?: string;
  toolbarExtra?: React.ReactNode;
}

/** Generic search+sort+paginate table, server-driven (manualPagination/Sorting/Filtering) —
 * the one reusable pattern behind every module's "All X" table (Products first, then
 * Leads/Dealers/Projects/Sales as each is built). Parent owns query state via useTableState
 * and re-fetches on change; this component only renders. */
export function DataTable<T>({
  columns,
  data,
  meta,
  page,
  onPageChange,
  sorting,
  onSortingChange,
  query,
  onQueryChange,
  onRowClick,
  searchPlaceholder = "Search…",
  isLoading,
  isError,
  onRetry,
  emptyMessage = "No records found.",
  toolbarExtra,
}: DataTableProps<T>) {
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange,
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="flex flex-1 items-center gap-2 rounded-sm border border-border bg-surface px-3 py-2">
          <Search className="h-4 w-4 text-text-muted" />
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
          />
        </div>
        {toolbarExtra}
      </div>

      <div className="overflow-x-auto rounded-md border border-border bg-surface">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-border">
                {hg.headers.map((header) => {
                  const sortable = header.column.columnDef.enableSorting !== false;
                  const sortState = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      onClick={sortable ? header.column.getToggleSortingHandler() : undefined}
                      className={cn(
                        "whitespace-nowrap px-4 py-2.5 text-left text-xs font-medium text-text-muted",
                        sortable && "cursor-pointer select-none hover:text-text-secondary",
                      )}
                    >
                      <span className="inline-flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {sortState === "asc" && <ChevronUp className="h-3 w-3" />}
                        {sortState === "desc" && <ChevronDown className="h-3 w-3" />}
                      </span>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {isError ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10">
                  <div className="flex flex-col items-center gap-2 text-center">
                    <AlertOctagon className="h-5 w-5 text-critical" />
                    <span className="text-sm font-medium text-text-primary">Couldn&apos;t load this data</span>
                    <span className="text-xs text-text-muted">Check your connection and try again.</span>
                    {onRetry && (
                      <button
                        type="button"
                        onClick={onRetry}
                        className="mt-1 flex items-center gap-1.5 rounded-sm border border-border px-2.5 py-1 text-xs font-medium text-text-secondary hover:bg-surface-hover"
                      >
                        <RotateCw className="h-3 w-3" />
                        Retry
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              data.length === 0 &&
              !isLoading && (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-text-muted">
                    {emptyMessage}
                  </td>
                </tr>
              )
            )}
            {!isError &&
              table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => onRowClick?.(row.original)}
                className={cn(
                  "border-b border-border last:border-0",
                  onRowClick && "cursor-pointer hover:bg-surface-hover",
                )}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="whitespace-nowrap px-4 py-2.5 text-text-primary">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={cn("flex items-center justify-between text-xs text-text-muted", isError && "invisible")}>
        <span>
          {meta.total === 0
            ? "0 results"
            : `${(page - 1) * meta.pageSize + 1}–${Math.min(page * meta.pageSize, meta.total)} of ${meta.total}`}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="flex h-7 w-7 items-center justify-center rounded-sm border border-border hover:bg-surface-hover disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span>
            Page {page} of {Math.max(1, meta.totalPages)}
          </span>
          <button
            type="button"
            disabled={page >= meta.totalPages}
            onClick={() => onPageChange(page + 1)}
            className="flex h-7 w-7 items-center justify-center rounded-sm border border-border hover:bg-surface-hover disabled:opacity-40"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
