"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { CalendarRange, ChevronDown } from "lucide-react";
import { endOfMonth, format, startOfMonth, subDays, subMonths } from "date-fns";
import { useDateRangeParams } from "@/hooks/useDateRangeParams";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Only these pages have period-scoped data (KPIs/trends/breakdowns) — everywhere else the
// picker would be inert, so it renders as nothing rather than a dead control.
const DATE_AWARE_ROUTES = ["/dashboard", "/marketing", "/sales", "/leads", "/customers"];

function toDateKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

interface Preset {
  label: string;
  range: () => { dateFrom: string; dateTo: string };
}

const PRESETS: Preset[] = [
  {
    label: "Today",
    range: () => ({ dateFrom: toDateKey(new Date()), dateTo: toDateKey(new Date()) }),
  },
  {
    label: "Last 7 days",
    range: () => ({ dateFrom: toDateKey(subDays(new Date(), 6)), dateTo: toDateKey(new Date()) }),
  },
  {
    label: "Last 30 days",
    range: () => ({ dateFrom: toDateKey(subDays(new Date(), 29)), dateTo: toDateKey(new Date()) }),
  },
  {
    label: "This month",
    range: () => ({ dateFrom: toDateKey(startOfMonth(new Date())), dateTo: toDateKey(new Date()) }),
  },
  {
    label: "Last month",
    range: () => {
      const lastMonth = subMonths(new Date(), 1);
      return { dateFrom: toDateKey(startOfMonth(lastMonth)), dateTo: toDateKey(endOfMonth(lastMonth)) };
    },
  },
];

export function DateRangePicker() {
  const pathname = usePathname();
  const { dateFrom, dateTo, setRange } = useDateRangeParams();
  const [open, setOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const isDateAware = DATE_AWARE_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
  if (!isDateAware) return null;

  const activePreset = dateFrom && dateTo ? PRESETS.find((p) => { const r = p.range(); return r.dateFrom === dateFrom && r.dateTo === dateTo; }) : undefined;
  const label = !dateFrom && !dateTo ? "All time" : activePreset ? activePreset.label : `${dateFrom} – ${dateTo}`;

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setCustomFrom(dateFrom ?? "");
      setCustomTo(dateTo ?? "");
      setCustomOpen(false);
    }
  }

  function applyCustomRange() {
    if (!customFrom || !customTo) return;
    setRange({ dateFrom: customFrom, dateTo: customTo });
    setCustomOpen(false);
    setOpen(false);
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-9 shrink-0 items-center gap-2 rounded-sm border border-border bg-bg px-3 text-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary"
        >
          <CalendarRange className="h-4 w-4" />
          <span className="hidden truncate sm:inline">{label}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuItem onSelect={() => setRange({})}>All time</DropdownMenuItem>
        <DropdownMenuSeparator />
        {PRESETS.map((preset) => (
          <DropdownMenuItem key={preset.label} onSelect={() => setRange(preset.range())}>
            {preset.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        {!customOpen ? (
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setCustomOpen(true);
            }}
          >
            Custom range…
          </DropdownMenuItem>
        ) : (
          <div className="flex flex-col gap-2 px-2.5 py-2" onKeyDown={(e) => e.stopPropagation()}>
            <label className="flex flex-col gap-1 text-xs text-text-muted">
              From
              <input
                type="date"
                value={customFrom}
                max={customTo || undefined}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="rounded-sm border border-border bg-bg px-2 py-1 text-sm text-text-primary"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-text-muted">
              To
              <input
                type="date"
                value={customTo}
                min={customFrom || undefined}
                onChange={(e) => setCustomTo(e.target.value)}
                className="rounded-sm border border-border bg-bg px-2 py-1 text-sm text-text-primary"
              />
            </label>
            <button
              type="button"
              disabled={!customFrom || !customTo}
              onClick={applyCustomRange}
              className="mt-1 h-8 rounded-sm bg-accent text-sm font-medium text-white hover:bg-accent-strong disabled:opacity-50"
            >
              Apply
            </button>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
