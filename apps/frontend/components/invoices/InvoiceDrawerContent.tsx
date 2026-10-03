"use client";

import { useEffect, useState } from "react";
import { InvoiceListItem } from "@hpl/shared";
import {
  invoicePdfUrl,
  invoiceQuotationPdfUrl,
  useInvoiceDetail,
  useSendInvoiceEmail,
  useSendInvoiceWhatsApp,
} from "@/lib/query/useInvoices";
import { useQuotationDetail } from "@/lib/query/useQuotations";
import { SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/apiClient";
import { formatRupees } from "@/lib/format";
import { useAuthUser } from "@/lib/auth/AuthUserContext";
import { InvoiceDialog } from "./InvoiceDialog";

const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

/** Drawer payload only needs the id — everything else is loaded fresh, so it is also correct right after an edit. */
export function InvoiceDrawerContent({ data }: { data: Pick<InvoiceListItem, "id"> & Partial<InvoiceListItem> }) {
  const detailQuery = useInvoiceDetail(data.id);
  const invoice = detailQuery.data;
  const quotationQuery = useQuotationDetail(invoice?.quotationId);
  const sendEmail = useSendInvoiceEmail();
  const sendWhatsApp = useSendInvoiceWhatsApp();
  const canWrite = useAuthUser().permissions.includes("leads:write");

  const [doc, setDoc] = useState<"invoice" | "quotation">("invoice");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!invoice) return;
    setPhone((p) => p || invoice.sentToPhone || invoice.customer.contact);
    setEmail((e) => e || invoice.emailSentTo || "");
  }, [invoice]);

  if (!invoice) {
    return (
      <SheetHeader>
        <SheetTitle>{data.invoiceCode ?? "Invoice"}</SheetTitle>
        <SheetDescription>{detailQuery.isError ? "Couldn't load this invoice." : "Loading…"}</SheetDescription>
      </SheetHeader>
    );
  }

  const quotedLabel = invoice.revisedQuotationCode ?? invoice.quotationCode;
  const saving = invoice.quotedTotalAmount - invoice.totalAmount;

  async function run(action: () => Promise<{ attachmentsSent: string[] }>, what: string) {
    setMessage(null);
    try {
      const res = await action();
      setMessage({ kind: "ok", text: `${what} sent: ${res.attachmentsSent.join(" + ")}` });
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof ApiError ? err.message : `Failed to send via ${what}.` });
    }
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>{invoice.invoiceCode}</SheetTitle>
        <SheetDescription>
          {invoice.customer.name} {invoice.customer.company ? `· ${invoice.customer.company}` : ""} · against {invoice.quotationCode}
        </SheetDescription>
        <div className="mt-2 flex flex-wrap items-end gap-3">
          <span className="font-display text-2xl font-semibold text-text-primary">{formatRupees(invoice.totalAmount)}</span>
          <Badge variant={invoice.isNegotiated ? "warning" : "neutral"}>{invoice.isNegotiated ? "Negotiated" : "As quoted"}</Badge>
          <Badge variant={invoice.locked ? "good" : "neutral"}>{invoice.locked ? "Sent" : "Draft"}</Badge>
        </div>
      </SheetHeader>

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-5">
        {invoice.isNegotiated && (
          <div className="rounded-sm border border-border bg-surface-2 p-3 text-xs" data-testid="negotiation-summary">
            <div className="flex flex-wrap items-center gap-x-2">
              <span className="text-text-muted">Quoted</span>
              <span>{formatRupees(invoice.quotedTotalAmount)}</span>
              <span className="text-text-muted">→ agreed</span>
              <span className="font-semibold text-text-primary">{formatRupees(invoice.totalAmount)}</span>
              {saving !== 0 && (
                <span className={saving > 0 ? "font-medium text-good" : "font-medium text-critical"}>
                  ({saving > 0 ? "discount" : "increase"} {formatRupees(Math.abs(saving))})
                </span>
              )}
            </div>
            {invoice.negotiationNote && <p className="mt-1 text-text-secondary">“{invoice.negotiationNote}”</p>}
          </div>
        )}

        <section className="flex flex-col gap-2">
          <div className="inline-flex w-fit gap-1 rounded-sm border border-border p-0.5 text-xs">
            {(
              [
                ["invoice", `Tax invoice ${invoice.invoiceCode}`],
                ["quotation", invoice.revisedQuotationCode ? `Updated quotation ${quotedLabel}` : `Quotation ${quotedLabel}`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setDoc(key)}
                className={`rounded-sm px-2.5 py-1 font-medium ${doc === key ? "bg-accent-tint text-accent-strong" : "text-text-muted hover:text-text-primary"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="overflow-hidden rounded-sm border border-border" style={{ height: 380 }}>
            <iframe src={doc === "invoice" ? invoicePdfUrl(invoice.id) : invoiceQuotationPdfUrl(invoice.id)} className="h-full w-full" title={doc === "invoice" ? "Invoice PDF preview" : "Updated quotation PDF preview"} />
          </div>
        </section>

        {message && (
          <p className={`rounded-sm px-3 py-2 text-xs ${message.kind === "ok" ? "bg-good-tint text-good" : "bg-critical-tint text-critical"}`} role={message.kind === "ok" ? "status" : "alert"}>
            {message.text}
          </p>
        )}

        {canWrite && (
        <section className="flex flex-col gap-3 rounded-sm border border-border p-3">
          <p className="text-xs text-text-muted">
            Sending delivers <b className="text-text-primary">both documents together</b>: the tax invoice and {invoice.revisedQuotationCode ? "the quotation updated with the agreed prices" : "the original quotation"}.
          </p>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-medium text-text-muted">WhatsApp</h4>
              <Badge variant={invoice.status === "SENT" ? "good" : invoice.status === "SEND_FAILED" ? "critical" : "neutral"}>
                {invoice.status === "SENT" ? "Sent" : invoice.status === "SEND_FAILED" ? "Failed" : "Not sent"}
              </Badge>
            </div>
            <div className="flex items-end gap-2">
              <input aria-label="WhatsApp number" className="h-8 flex-1 rounded-sm border border-border bg-surface px-2 text-xs outline-none focus:border-accent" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <Button type="button" size="sm" disabled={!phone || sendWhatsApp.isPending} onClick={() => run(() => sendWhatsApp.mutateAsync({ id: invoice.id, phone }), "WhatsApp")}>
                {sendWhatsApp.isPending ? "Sending…" : "Send"}
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-medium text-text-muted">Email</h4>
              <Badge variant={invoice.emailStatus === "SENT" ? "good" : invoice.emailStatus === "FAILED" ? "critical" : "neutral"}>
                {invoice.emailStatus === "SENT" ? "Sent" : invoice.emailStatus === "FAILED" ? "Failed" : "Not sent"}
              </Badge>
            </div>
            <div className="flex items-end gap-2">
              <input aria-label="Email address" type="email" placeholder="Enter an email address" className="h-8 flex-1 rounded-sm border border-border bg-surface px-2 text-xs outline-none focus:border-accent" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Button type="button" variant="secondary" size="sm" disabled={!email || sendEmail.isPending} onClick={() => run(() => sendEmail.mutateAsync({ id: invoice.id, email }), "Email")}>
                {sendEmail.isPending ? "Sending…" : "Send"}
              </Button>
            </div>
          </div>
        </section>
        )}

        <section className="flex flex-col gap-2">
          <h4 className="text-xs font-medium text-text-muted">Items — quoted vs agreed</h4>
          <div className="flex flex-col">
            {invoice.items.map((item) => {
              const changed = item.quotedUnitRate !== null && item.quotedUnitRate !== item.unitRate;
              return (
                <div key={item.srNo} className="flex items-center justify-between gap-3 border-b border-border py-1.5 text-xs last:border-0">
                  <span className="text-text-primary">
                    {item.itemName} <span className="text-text-muted">× {item.quantity}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    {changed && <span className="mr-2 text-text-muted line-through">{formatRupees(item.quotedUnitRate!)}</span>}
                    {item.quotedUnitRate === null && <span className="mr-2 text-text-muted">added</span>}
                    <span className="text-text-primary">{formatRupees(item.unitRate)}</span>
                    <span className="ml-3 font-medium text-text-primary">{formatRupees(item.lineTotal)}</span>
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between pt-1 text-xs text-text-muted">
            <span>
              {invoice.isIntraState ? `CGST ${formatRupees(invoice.cgst)} + SGST ${formatRupees(invoice.sgst)}` : `IGST ${formatRupees(invoice.igst)}`}
            </span>
            <span>Due {shortDate(invoice.dueDate)}</span>
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-2">
          {canWrite && (
            <Button type="button" size="sm" disabled={invoice.locked || !quotationQuery.data} onClick={() => setEditing(true)} title={invoice.locked ? "Already sent — sent invoices can't be edited" : undefined}>
              Edit / re-negotiate
            </Button>
          )}
          <Button type="button" variant="secondary" size="sm" asChild>
            <a href={invoicePdfUrl(invoice.id)} target="_blank" rel="noreferrer">Download invoice</a>
          </Button>
          <Button type="button" variant="secondary" size="sm" asChild>
            <a href={invoiceQuotationPdfUrl(invoice.id)} target="_blank" rel="noreferrer">Download quotation</a>
          </Button>
          {invoice.locked && <span className="text-xs text-text-muted">Sent invoices are locked.</span>}
        </div>
      </div>

      {quotationQuery.data && (
        <InvoiceDialog quotation={quotationQuery.data} invoice={invoice} open={editing} onOpenChange={setEditing} onSaved={() => setMessage({ kind: "ok", text: "Invoice updated — both PDFs were regenerated." })} />
      )}
    </>
  );
}
