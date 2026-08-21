"use client";

import { useState } from "react";

export interface TableState {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortDir: "asc" | "desc";
  q: string;
}

export function useTableState(initial: Partial<TableState> = {}) {
  const [state, setState] = useState<TableState>({
    page: 1,
    pageSize: 10,
    sortDir: "desc",
    q: "",
    ...initial,
  });

  return {
    state,
    setPage: (page: number) => setState((s) => ({ ...s, page })),
    setSort: (sortBy: string) =>
      setState((s) => ({
        ...s,
        sortBy,
        sortDir: s.sortBy === sortBy && s.sortDir === "desc" ? "asc" : "desc",
        page: 1,
      })),
    setQuery: (q: string) => setState((s) => ({ ...s, q, page: 1 })),
    patch: (fields: Partial<TableState>) => setState((s) => ({ ...s, ...fields, page: 1 })),
  };
}
