"use client";

import { useEffect, useRef, useState } from "react";
import { LeadListItem, QuotationInputMode } from "@hpl/shared";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/apiClient";
import {
  useCompanyProfileOptions,
  useCreateQuotation,
  useParseQuotationText,
  useQuotationProductCatalog,
  useSendQuotationEmail,
  useSendQuotationWhatsApp,
  quotationPdfUrl,
} from "@/lib/query/useQuotations";
import { QuotationFieldsForm } from "./QuotationFieldsForm";
import { applyDraftToFormState, buildDefaultFormState, formStateIsReadyToSubmit, QuotationFormState } from "./quotation-form-state";

type Mode = typeof QuotationInputMode.MANUAL | typeof QuotationInputMode.CHAT_AI | typeof QuotationInputMode.VOICE_AI;
type Step = "compose" | "review" | "sent";

function useSpeechRecognition() {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognitionCtor = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;
    setSupported(true);
    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-IN";
    recognition.onresult = (event: any) => {
      let text = "";
      for (let i = 0; i < event.results.length; i++) text += event.results[i][0].transcript;
      setTranscript(text);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
  }, []);

  function start() {
    if (!recognitionRef.current) return;
    setTranscript("");
    setListening(true);
    recognitionRef.current.start();
  }

  function stop() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  return { supported, listening, transcript, start, stop };
}

export function SendQuotationDialog({
  lead,
  open,
  onOpenChange,
}: {
  lead: LeadListItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const companyProfiles = useCompanyProfileOptions();
  const productCatalog = useQuotationProductCatalog();
  const parseText = useParseQuotationText();
  const createQuotation = useCreateQuotation();
  const sendWhatsApp = useSendQuotationWhatsApp();
  const sendEmail = useSendQuotationEmail();
  const speech = useSpeechRecognition();

  const [mode, setMode] = useState<Mode>(QuotationInputMode.MANUAL);
  const [step, setStep] = useState<Step>("compose");
  const [chatText, setChatText] = useState("");
  const [rawInputText, setRawInputText] = useState<string | null>(null);
  const [form, setForm] = useState<QuotationFormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phone, setPhone] = useState(lead.phone);
  const [email, setEmail] = useState(lead.email ?? "");
  const [createdId, setCreatedId] = useState<string | null>(null);

  const defaultProfile = companyProfiles.data?.find((p) => p.isDefault) ?? companyProfiles.data?.[0];

  useEffect(() => {
    if (!open) {
      // Reset everything when the dialog is closed so reopening starts fresh.
      setMode(QuotationInputMode.MANUAL);
      setStep("compose");
      setChatText("");
      setRawInputText(null);
      setForm(null);
      setError(null);
      setPhone(lead.phone);
      setEmail(lead.email ?? "");
      setCreatedId(null);
    }
  }, [open, lead.phone, lead.email]);

  useEffect(() => {
    if (open && mode === QuotationInputMode.MANUAL && step === "compose" && !form && companyProfiles.data) {
      setForm(buildDefaultFormState(lead, defaultProfile));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, step, form, companyProfiles.data]);

  async function handleParse(text: string, parseMode: typeof QuotationInputMode.CHAT_AI | typeof QuotationInputMode.VOICE_AI) {
    setError(null);
    try {
      const draft = await parseText.mutateAsync({ leadId: lead.id, text, mode: parseMode });
      const base = buildDefaultFormState(lead, defaultProfile);
      setForm(applyDraftToFormState(base, draft));
      setRawInputText(text);
      setStep("review");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "AI parsing failed. Please try the manual form instead.");
    }
  }

  async function handleCreate() {
    if (!form) return;
    setError(null);
    try {
      const created = await createQuotation.mutateAsync({
        leadId: lead.id,
        companyProfileId: form.companyProfileId,
        customer: {
          name: form.name,
          company: form.company || null,
          address: form.address,
          city: form.city,
          state: form.state,
          gstin: form.gstin || null,
          contact: form.contact,
        },
        items: form.items.map((item) => ({
          productId: item.productId,
          itemName: item.itemName,
          hsnCode: item.hsnCode || null,
          quantity: item.quantity,
          unitRate: item.unitRate ?? 0,
          taxPercent: item.taxPercent,
        })),
        advancePercent: form.advancePercent,
        beforeDispatchPercent: form.beforeDispatchPercent,
        termsAndConditions: form.termsAndConditions,
        validUntil: new Date(form.validUntil).toISOString(),
        inputMode: mode,
        rawInputText,
      });
      setCreatedId(created.id);
      setStep("sent");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to generate the quotation.");
    }
  }

  async function handleSendWhatsApp() {
    if (!createdId) return;
    setError(null);
    try {
      await sendWhatsApp.mutateAsync({ id: createdId, leadId: lead.id, phone });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to send via WhatsApp.");
    }
  }

  async function handleSendEmail() {
    if (!createdId) return;
    setError(null);
    try {
      await sendEmail.mutateAsync({ id: createdId, leadId: lead.id, email: email || undefined });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to send via email.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Send Quotation</DialogTitle>
          <DialogDescription>
            {lead.name} {lead.company ? `· ${lead.company}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5">
          {step !== "sent" && (
            <Tabs
              value={mode}
              onValueChange={(v) => {
                setMode(v as Mode);
                setStep("compose");
                setForm(null);
                setError(null);
              }}
              className="mb-4"
            >
              <TabsList>
                <TabsTrigger value={QuotationInputMode.MANUAL}>Manual</TabsTrigger>
                <TabsTrigger value={QuotationInputMode.CHAT_AI}>Chat AI</TabsTrigger>
                <TabsTrigger value={QuotationInputMode.VOICE_AI}>Voice AI</TabsTrigger>
              </TabsList>
            </Tabs>
          )}

          {error && (
            <p className="mb-3 rounded-sm bg-critical-tint px-3 py-2 text-xs text-critical" role="alert">
              {error}
            </p>
          )}

          {step === "compose" && mode === QuotationInputMode.MANUAL && form && companyProfiles.data && (
            <QuotationFieldsForm
              state={form}
              onChange={setForm}
              companyProfiles={companyProfiles.data}
              productCatalog={productCatalog.data ?? []}
            />
          )}

          {step === "compose" && mode === QuotationInputMode.CHAT_AI && (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-text-muted">
                Describe the quotation in plain language — customer details, items, quantities, rates if known. The AI will
                fill in a draft for you to review before anything is created.
              </p>
              <textarea
                rows={6}
                className="resize-none rounded-sm border border-border bg-surface px-2 py-1.5 text-xs outline-none focus:border-accent"
                placeholder="e.g. Quote for Vivek Interiors, Palghar — 20 sheets Walnut Brown HPL and 5 custom cladding panels, standard terms"
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
              />
              <Button
                type="button"
                size="sm"
                className="self-end"
                disabled={chatText.trim().length < 3 || parseText.isPending}
                onClick={() => handleParse(chatText, QuotationInputMode.CHAT_AI)}
              >
                {parseText.isPending ? "Parsing…" : "Parse with AI"}
              </Button>
            </div>
          )}

          {step === "compose" && mode === QuotationInputMode.VOICE_AI && (
            <div className="flex flex-col gap-3">
              {!speech.supported ? (
                <p className="rounded-sm bg-warning-tint px-3 py-2 text-xs text-warning">
                  Voice input isn&apos;t supported in this browser — try Chrome or Edge, or use the Chat AI tab instead.
                </p>
              ) : (
                <>
                  <p className="text-xs text-text-muted">Speak the quotation requirements — customer, items, quantities, rates if known.</p>
                  <div className="min-h-24 rounded-sm border border-border bg-surface px-2 py-1.5 text-xs text-text-primary">
                    {speech.transcript || <span className="text-text-muted">Transcript will appear here…</span>}
                  </div>
                  <div className="flex items-center justify-between">
                    <Button type="button" variant={speech.listening ? "destructive" : "secondary"} size="sm" onClick={speech.listening ? speech.stop : speech.start}>
                      {speech.listening ? "Stop recording" : "Start recording"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={speech.transcript.trim().length < 3 || parseText.isPending}
                      onClick={() => handleParse(speech.transcript, QuotationInputMode.VOICE_AI)}
                    >
                      {parseText.isPending ? "Parsing…" : "Parse with AI"}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {step === "review" && form && companyProfiles.data && (
            <>
              <p className="mb-3 rounded-sm bg-accent-tint px-3 py-2 text-xs text-accent-strong">
                AI-parsed — please review every field before generating the quotation.
              </p>
              <QuotationFieldsForm
                state={form}
                onChange={setForm}
                companyProfiles={companyProfiles.data}
                productCatalog={productCatalog.data ?? []}
              />
            </>
          )}

          {step === "sent" && createdId && (
            <div className="flex flex-col gap-4">
              <div className="overflow-hidden rounded-sm border border-border" style={{ height: 420 }}>
                <iframe src={quotationPdfUrl(createdId)} className="h-full w-full" title="Quotation PDF preview" />
              </div>
              <div className="flex items-end gap-2">
                <label className="flex flex-1 flex-col gap-1">
                  <span className="text-xs text-text-muted">Send to WhatsApp number</span>
                  <input
                    className="h-8 rounded-sm border border-border bg-surface px-2 text-xs outline-none focus:border-accent"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </label>
                <Button type="button" size="sm" disabled={sendWhatsApp.isPending} onClick={handleSendWhatsApp}>
                  {sendWhatsApp.isPending ? "Sending…" : "Send via WhatsApp"}
                </Button>
              </div>
              {sendWhatsApp.isSuccess && (
                <p className="rounded-sm bg-good-tint px-3 py-2 text-xs text-good" role="status">
                  Sent via WhatsApp to {phone}.
                </p>
              )}

              <div className="flex items-end gap-2">
                <label className="flex flex-1 flex-col gap-1">
                  <span className="text-xs text-text-muted">Send to email address</span>
                  <input
                    type="email"
                    className="h-8 rounded-sm border border-border bg-surface px-2 text-xs outline-none focus:border-accent"
                    placeholder={lead.email ? undefined : "No email on file — enter one"}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
                <Button type="button" variant="secondary" size="sm" disabled={!email || sendEmail.isPending} onClick={handleSendEmail}>
                  {sendEmail.isPending ? "Sending…" : "Send via Email"}
                </Button>
                <Button type="button" variant="secondary" size="sm" asChild>
                  <a href={quotationPdfUrl(createdId)} target="_blank" rel="noreferrer">
                    Download PDF
                  </a>
                </Button>
              </div>
              {sendEmail.isSuccess && (
                <p className="rounded-sm bg-good-tint px-3 py-2 text-xs text-good" role="status">
                  Emailed to {email}.
                </p>
              )}
            </div>
          )}
        </div>

        {(step === "compose" && mode !== QuotationInputMode.MANUAL) || step === "sent" ? null : (
          <div className="flex justify-end gap-2 border-t border-border p-4">
            {step === "review" && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setStep("compose")}>
                Back
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              disabled={!form || !formStateIsReadyToSubmit(form) || createQuotation.isPending}
              onClick={handleCreate}
            >
              {createQuotation.isPending ? "Generating…" : "Confirm & Generate Quotation"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
