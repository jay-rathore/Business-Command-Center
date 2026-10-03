"use client";

import { useEffect, useMemo, useState } from "react";
import { computeLine, computeTotals, InvoiceDetail, QuotationDetail, SaveInvoiceRequest } from "@hpl/shared";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/apiClient";
import { useCreateInvoice, useUpdateInvoice } from "@/lib/query/useInvoices";
import { formatRupees } from "@/lib/format";

interface Row {
  key: string;
  quotationItemId: string | null;
  productId: string | null;
  hsnCode: string | null;
  itemName: string;
  quantity: string;
  unitRate: string;
  taxPercent: string;
  quotedRate: number | null;
}

const inputClass = "h-8 w-full rounded-sm border border-border bg-surface px-2 text-xs outline-none focus:border-accent";
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

function rowsFrom(quotation: QuotationDetail, invoice?: InvoiceDetail): Row[] {
  if (invoice) {
    return invoice.items.map((i) => ({
      key: `i${i.srNo}`,
      quotationItemId: i.quotationItemId ?? null,
      productId: i.productId,
      hsnCode: i.hsnCode,
      itemName: i.itemName,
      quantity: String(i.quantity),
      unitRate: String(i.unitRate),
      taxPercent: String(i.taxPercent),
      quotedRate: i.quotedUnitRate,
    }));
  }
  return quotation.items.map((i) => ({
    key: `q${i.id}`,
    quotationItemId: i.id,
    productId: i.productId,
    hsnCode: i.hsnCode,
    itemName: i.itemName,
    quantity: String(i.quantity),
    unitRate: String(i.unitRate), // starts at the quoted price; the operator types the agreed one
    taxPercent: String(i.taxPercent),
    quotedRate: i.unitRate,
  }));
}

/** Creates (or, before it is sent, re-negotiates) the invoice for a quotation. The operator enters the AGREED
 * rate per line; the totals shown are the same shared maths the server uses, so what you see is what is billed. */
export function InvoiceDialog({
  quotation,
  invoice,
  open,
  onOpenChange,
  onSaved,
}: {
  quotation: QuotationDetail;
  invoice?: InvoiceDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (invoice: InvoiceDetail) => void;
}) {
  const create = useCreateInvoice();
  const update = useUpdateInvoice();
  const saving = create.isPending || update.isPending;

  const [rows, setRows] = useState<Row[]>([]);
  const [advancePercent, setAdvancePercent] = useState("50");
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setRows(rowsFrom(quotation, invoice));
    setAdvancePercent(String(invoice?.advancePercent ?? quotation.advancePercent));
    setDueDate(invoice ? invoice.dueDate.slice(0, 10) : isoDay(new Date(Date.now() + 15 * 864e5)));
    setNote(invoice?.negotiationNote ?? "");
    setError(null);
  }, [open, quotation, invoice]);

  const num = (v: string) => (v.trim() === "" ? NaN : Number(v));
  const advance = Math.min(100, Math.max(0, Math.round(num(advancePercent) || 0)));

  const preview = useMemo(() => {
    const lines = rows.map((r) => computeLine({ quantity: num(r.quantity) || 0, unitRate: num(r.unitRate) || 0, taxPercent: num(r.taxPercent) || 0 }));
    return { lines, totals: computeTotals(lines, advance) };
  }, [rows, advance]);

  const quotedTotal = quotation.totalAmount;
  const diff = preview.totals.totalAmount - quotedTotal;

  function patchRow(key: string, partial: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...partial } : r)));
  }

  function validate(): string | null {
    if (rows.length === 0) return "An invoice needs at least one line.";
    for (const [i, r] of rows.entries()) {
      if (!r.itemName.trim()) return `Line ${i + 1}: enter an item name.`;
      const qty = num(r.quantity);
      if (!Number.isInteger(qty) || qty < 1) return `Line ${i + 1}: quantity must be a whole number, at least 1.`;
      if (!(num(r.unitRate) >= 0)) return `Line ${i + 1}: enter the agreed rate.`;
      const tax = num(r.taxPercent);
      if (!(tax >= 0 && tax <= 100)) return `Line ${i + 1}: GST must be between 0 and 100.`;
    }
    if (!dueDate) return "Pick a due date.";
    return null;
  }

  async function handleSave() {
    const problem = validate();
    if (problem) return setError(problem);
    setError(null);
    const body: SaveInvoiceRequest = {
      items: rows.map((r) => ({
        quotationItemId: r.quotationItemId,
        productId: r.productId,
        hsnCode: r.hsnCode,
        itemName: r.itemName.trim(),
        quantity: num(r.quantity),
        unitRate: num(r.unitRate),
        taxPercent: num(r.taxPercent),
      })),
      advancePercent: advance,
      beforeDispatchPercent: 100 - advance,
      dueDate,
      negotiationNote: note.trim() || null,
    };
    try {
      const saved = invoice ? await update.mutateAsync({ id: invoice.id, ...body }) : await create.mutateAsync({ quotationId: quotation.id, ...body });
      onSaved(saved);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save the invoice.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{invoice ? `Edit ${invoice.invoiceCode}` : `Create invoice from ${quotation.quotationCode}`}</DialogTitle>
          <DialogDescription>
            Enter the prices the customer agreed to. If they differ from the quotation, an updated quotation is generated and sent with the invoice.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 overflow-y-auto p-5">
          {error && (
            <p className="rounded-sm bg-critical-tint px-3 py-2 text-xs text-critical" role="alert">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-2">
            <div className="hidden grid-cols-[1fr_4rem_6rem_7rem_4rem_6.5rem_2rem] gap-2 text-[11px] font-medium text-text-muted md:grid">
              <span>Item</span>
              <span>Qty</span>
              <span className="text-right">Quoted rate</span>
              <span>Agreed rate (₹)</span>
              <span>GST %</span>
              <span className="text-right">Amount</span>
              <span />
            </div>
            {rows.map((r, idx) => {
              const changed = r.quotedRate !== null && Number(r.unitRate) !== r.quotedRate;
              return (
                <div key={r.key} className="grid grid-cols-2 items-center gap-2 border-b border-border pb-2 md:grid-cols-[1fr_4rem_6rem_7rem_4rem_6.5rem_2rem]">
                  <input className={`${inputClass} col-span-2 md:col-span-1`} aria-label={`Item name ${idx + 1}`} value={r.itemName} onChange={(e) => patchRow(r.key, { itemName: e.target.value })} />
                  <input className={inputClass} type="number" min={1} step={1} aria-label={`Quantity ${idx + 1}`} value={r.quantity} onChange={(e) => patchRow(r.key, { quantity: e.target.value })} />
                  <span className="text-right text-xs text-text-muted">{r.quotedRate === null ? "new line" : formatRupees(r.quotedRate)}</span>
                  <input
                    className={`${inputClass} ${changed ? "border-accent" : ""}`}
                    type="number"
                    min={0}
                    step="0.01"
                    aria-label={`Agreed rate ${idx + 1}`}
                    value={r.unitRate}
                    onChange={(e) => patchRow(r.key, { unitRate: e.target.value })}
                  />
                  <input className={inputClass} type="number" min={0} max={100} aria-label={`GST percent ${idx + 1}`} value={r.taxPercent} onChange={(e) => patchRow(r.key, { taxPercent: e.target.value })} />
                  <span className="text-right text-xs font-medium text-text-primary">{formatRupees(preview.lines[idx]?.lineTotal ?? 0)}</span>
                  <Button type="button" variant="ghost" size="sm" aria-label={`Remove line ${idx + 1}`} disabled={rows.length === 1} onClick={() => setRows((prev) => prev.filter((x) => x.key !== r.key))}>
                    ✕
                  </Button>
                </div>
              );
            })}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="self-start"
              onClick={() =>
                setRows((prev) => [...prev, { key: `n${Date.now()}`, quotationItemId: null, productId: null, hsnCode: null, itemName: "", quantity: "1", unitRate: "0", taxPercent: "18", quotedRate: null }])
              }
            >
              + Add a line
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-text-muted">Due date</span>
                <input className={inputClass} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-text-muted">Advance %</span>
                  <input className={inputClass} type="number" min={0} max={100} value={advancePercent} onChange={(e) => setAdvancePercent(e.target.value)} />
                </label>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-text-muted">Before dispatch %</span>
                  <span className="flex h-8 items-center text-xs text-text-primary">{100 - advance}%</span>
                </div>
              </div>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-text-muted">Negotiation note (printed on the invoice)</span>
                <textarea
                  className="min-h-16 resize-none rounded-sm border border-border bg-surface px-2 py-1.5 text-xs outline-none focus:border-accent"
                  maxLength={1000}
                  placeholder="e.g. Customer asked for a better rate on volume"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
            </div>

            <div className="flex flex-col gap-1 rounded-sm border border-border p-3 text-xs">
              <div className="flex justify-between"><span className="text-text-muted">Taxable value</span><span>{formatRupees(preview.totals.subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-text-muted">GST</span><span>{formatRupees(preview.totals.gstAmount)}</span></div>
              <div className="flex justify-between"><span className="text-text-muted">Roundoff</span><span>{formatRupees(preview.totals.roundoff)}</span></div>
              <div className="mt-1 flex justify-between border-t border-border pt-2 text-sm font-semibold"><span>Invoice total</span><span data-testid="invoice-total">{formatRupees(preview.totals.totalAmount)}</span></div>
              <div className="flex justify-between text-text-muted"><span>Quotation total</span><span>{formatRupees(quotedTotal)}</span></div>
              {diff !== 0 && (
                <div className={`flex justify-between font-medium ${diff < 0 ? "text-good" : "text-critical"}`} data-testid="invoice-diff">
                  <span>{diff < 0 ? "Agreed discount" : "Increase over quotation"}</span>
                  <span>
                    {formatRupees(Math.abs(diff))} ({Math.abs((diff / quotedTotal) * 100).toFixed(1)}%)
                  </span>
                </div>
              )}
              <div className="mt-2 flex justify-between text-text-muted"><span>{advance}% advance</span><span>{formatRupees(preview.totals.advanceAmount)}</span></div>
              <div className="flex justify-between text-text-muted"><span>{100 - advance}% before dispatch</span><span>{formatRupees(preview.totals.beforeDispatchAmount)}</span></div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border p-4">
          <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" size="sm" disabled={saving} onClick={handleSave}>
            {saving ? "Saving…" : invoice ? "Save changes" : "Create invoice"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
