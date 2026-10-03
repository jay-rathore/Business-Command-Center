"use client";

import { useEffect, useState } from "react";
import { QuotationListItem } from "@hpl/shared";
import { useQuotationDetail, useSendQuotationEmail, useSendQuotationWhatsApp, quotationPdfUrl } from "@/lib/query/useQuotations";
import { SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/apiClient";
import { formatCurrency, formatRupees } from "@/lib/format";
import { useDrawerStore } from "@/lib/stores/drawerStore";
import { useAuthUser } from "@/lib/auth/AuthUserContext";
import { InvoiceDialog } from "@/components/invoices/InvoiceDialog";

export function QuotationDrawerContent({ data }: { data: QuotationListItem }) {
  const detailQuery = useQuotationDetail(data.id);
  const quotation = detailQuery.data;
  const sendWhatsApp = useSendQuotationWhatsApp();
  const sendEmail = useSendQuotationEmail();

  const [phone, setPhone] = useState(data.sentToPhone ?? "");
  const [email, setEmail] = useState(data.emailSentTo ?? "");
  const [error, setError] = useState<string | null>(null);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const openDrawer = useDrawerStore((s) => s.open);
  const canWrite = useAuthUser().permissions.includes("leads:write");

  // Prefill the phone field with the customer's contact once the full detail loads, if the
  // operator hasn't already typed something and it hasn't been sent yet.
  useEffect(() => {
    if (quotation && !phone && !data.sentToPhone) {
      setPhone(quotation.customer.contact);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotation]);

  async function handleSendWhatsApp() {
    setError(null);
    try {
      await sendWhatsApp.mutateAsync({ id: data.id, leadId: data.leadId, phone });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to send via WhatsApp.");
    }
  }

  async function handleSendEmail() {
    setError(null);
    try {
      await sendEmail.mutateAsync({ id: data.id, leadId: data.leadId, email: email || undefined });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to send via email.");
    }
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>{data.quotationCode}</SheetTitle>
        <SheetDescription>
          {data.leadName} {data.leadCompany ? `· ${data.leadCompany}` : ""}
        </SheetDescription>
        <div className="mt-2 flex items-end gap-3">
          <span className="font-display text-2xl font-semibold text-text-primary">{formatCurrency(data.totalAmount)}</span>
          <span className="pb-0.5 text-xs text-text-muted">total</span>
        </div>
      </SheetHeader>

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-5">
        <div className="overflow-hidden rounded-sm border border-border" style={{ height: 360 }}>
          <iframe src={quotationPdfUrl(data.id)} className="h-full w-full" title="Quotation PDF preview" />
        </div>

        {error && (
          <p className="rounded-sm bg-critical-tint px-3 py-2 text-xs text-critical" role="alert">
            {error}
          </p>
        )}

        {quotation && (
          <section className="flex flex-col gap-2 rounded-sm border border-border p-3" data-testid="invoice-section">
            <h4 className="text-xs font-medium text-text-muted">Invoice</h4>
            {quotation.invoice ? (
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs">
                  <span className="font-medium text-text-primary">{quotation.invoice.invoiceCode}</span>
                  <span className="ml-2 text-text-muted">{formatRupees(quotation.invoice.totalAmount)}</span>
                  <Badge className="ml-2" variant={quotation.invoice.status === "SENT" ? "good" : "neutral"}>
                    {quotation.invoice.status === "SENT" ? "Sent" : "Draft"}
                  </Badge>
                </div>
                <Button type="button" size="sm" onClick={() => openDrawer("invoice", { id: quotation.invoice!.id, invoiceCode: quotation.invoice!.invoiceCode })}>
                  Open invoice
                </Button>
              </div>
            ) : canWrite ? (
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-text-muted">Customer confirmed — or negotiated? Raise the invoice at the agreed prices.</p>
                <Button type="button" size="sm" className="shrink-0" onClick={() => setInvoiceOpen(true)}>
                  Create invoice
                </Button>
              </div>
            ) : (
              <p className="text-xs text-text-muted">No invoice has been raised for this quotation yet.</p>
            )}
          </section>
        )}

        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-medium text-text-muted">WhatsApp</h4>
            <Badge variant={data.status === "SENT" ? "good" : data.status === "SEND_FAILED" ? "critical" : "neutral"}>
              {data.status === "SENT" ? "Sent" : data.status === "SEND_FAILED" ? "Failed" : "Not sent"}
            </Badge>
          </div>
          <div className="flex items-end gap-2">
            <input
              className="h-8 flex-1 rounded-sm border border-border bg-surface px-2 text-xs outline-none focus:border-accent"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <Button type="button" size="sm" disabled={!phone || sendWhatsApp.isPending} onClick={handleSendWhatsApp}>
              {sendWhatsApp.isPending ? "Sending…" : "Send"}
            </Button>
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-medium text-text-muted">Email</h4>
            <Badge variant={data.emailStatus === "SENT" ? "good" : data.emailStatus === "FAILED" ? "critical" : "neutral"}>
              {data.emailStatus === "SENT" ? "Sent" : data.emailStatus === "FAILED" ? "Failed" : "Not sent"}
            </Badge>
          </div>
          <div className="flex items-end gap-2">
            <input
              type="email"
              placeholder="Enter an email address"
              className="h-8 flex-1 rounded-sm border border-border bg-surface px-2 text-xs outline-none focus:border-accent"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button type="button" variant="secondary" size="sm" disabled={!email || sendEmail.isPending} onClick={handleSendEmail}>
              {sendEmail.isPending ? "Sending…" : "Send"}
            </Button>
          </div>
        </section>

        {quotation && (
          <section className="flex flex-col gap-2">
            <h4 className="text-xs font-medium text-text-muted">Items</h4>
            <div className="flex flex-col gap-1">
              {quotation.items.map((item) => (
                <div key={item.srNo} className="flex items-center justify-between border-b border-border py-1.5 text-xs last:border-0">
                  <span className="text-text-primary">
                    {item.itemName} <span className="text-text-muted">× {item.quantity}</span>
                  </span>
                  <span className="text-text-primary">{formatCurrency(item.lineTotal)}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <Button type="button" variant="secondary" size="sm" className="self-start" asChild>
          <a href={quotationPdfUrl(data.id)} target="_blank" rel="noreferrer">
            Download PDF
          </a>
        </Button>
      </div>
      {quotation && (
        <InvoiceDialog
          quotation={quotation}
          open={invoiceOpen}
          onOpenChange={setInvoiceOpen}
          onSaved={(invoice) => openDrawer("invoice", { id: invoice.id, invoiceCode: invoice.invoiceCode })}
        />
      )}
    </>
  );
}
