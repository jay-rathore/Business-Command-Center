"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/apiClient";
import { useDebounce } from "@/hooks/useDebounce";
import { useDrawerStore } from "@/lib/stores/drawerStore";
import {
  useCreateLeadFromCard,
  useLeadDuplicates,
  useLeadExecutives,
  useLeadStatuses,
  useLeadTypes,
  useScanBusinessCard,
} from "@/lib/query/useLeads";
import { BusinessCardFieldsForm } from "./BusinessCardFieldsForm";
import {
  applyDraftToCardFormState,
  buildDefaultCardFormState,
  BusinessCardFormState,
  cardFormStateIsReadyToSubmit,
} from "./business-card-form-state";

type Step = "capture" | "extracting" | "review" | "created";

export function ScanBusinessCardDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const statusesQuery = useLeadStatuses();
  const leadTypesQuery = useLeadTypes();
  const executivesQuery = useLeadExecutives();
  const scanCard = useScanBusinessCard();
  const checkDuplicates = useLeadDuplicates();
  const createLead = useCreateLeadFromCard();
  const openDrawer = useDrawerStore((s) => s.open);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("capture");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [form, setForm] = useState<BusinessCardFormState>(buildDefaultCardFormState());
  const [error, setError] = useState<string | null>(null);
  const [createdLead, setCreatedLead] = useState<{ id: string } | null>(null);

  const debouncedPhone = useDebounce(form.phone);
  const debouncedEmail = useDebounce(form.email);

  useEffect(() => {
    if (!open) {
      setStep("capture");
      setImageDataUrl(null);
      setForm(buildDefaultCardFormState());
      setError(null);
      setCreatedLead(null);
    }
  }, [open]);

  // Preselect a sensible default status once the lookup list loads, without overriding a
  // user-chosen value.
  useEffect(() => {
    if (step === "review" && !form.statusId && statusesQuery.data && statusesQuery.data.length > 0) {
      setForm((f) => (f.statusId ? f : { ...f, statusId: statusesQuery.data![0].id }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, statusesQuery.data]);

  useEffect(() => {
    if (step !== "review" || !debouncedPhone.trim()) return;
    checkDuplicates.mutate({ phone: debouncedPhone, email: debouncedEmail || null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, debouncedPhone, debouncedEmail]);

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => setImageDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleScan() {
    if (!imageDataUrl) return;
    setError(null);
    setStep("extracting");
    try {
      const draft = await scanCard.mutateAsync(imageDataUrl);
      setForm((f) => applyDraftToCardFormState(f, draft));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Card scan failed — please enter details manually.");
    } finally {
      setStep("review");
    }
  }

  async function handleCreate() {
    setError(null);
    try {
      const lead = await createLead.mutateAsync({
        name: form.name,
        company: form.company || null,
        phone: form.phone,
        email: form.email || null,
        website: form.website || null,
        address: form.address || null,
        state: form.state,
        city: form.city,
        leadTypeId: form.leadTypeId || null,
        assignedExecId: form.assignedExecId || null,
        statusId: form.statusId || null,
        notes: form.notes || null,
        saveImage: form.saveImage,
        imageDataUrl: form.saveImage ? imageDataUrl : null,
      });
      setCreatedLead(lead);
      setStep("created");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create the lead.");
    }
  }

  const duplicates = checkDuplicates.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Scan Business Card</DialogTitle>
          <DialogDescription>Capture or upload a card image to create an offline-marketing lead.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5">
          {error && (
            <p className="mb-3 rounded-sm bg-critical-tint px-3 py-2 text-xs text-critical" role="alert">
              {error}
            </p>
          )}

          {step === "capture" && (
            <div className="flex flex-col gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
              <label
                onClick={() => fileInputRef.current?.click()}
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-sm border border-dashed border-border p-8 text-center text-xs text-text-muted hover:bg-surface-hover"
              >
                {imageDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageDataUrl} alt="Business card preview" className="max-h-56 rounded-sm object-contain" />
                ) : (
                  <span>Tap to take a photo or choose an image of the business card</span>
                )}
              </label>
              <Button type="button" size="sm" className="self-end" disabled={!imageDataUrl} onClick={handleScan}>
                Scan Card
              </Button>
            </div>
          )}

          {step === "extracting" && (
            <div className="flex flex-col items-center gap-3 py-10 text-xs text-text-muted">
              <span>Reading card details…</span>
            </div>
          )}

          {step === "review" && (
            <>
              <p className="mb-3 rounded-sm bg-accent-tint px-3 py-2 text-xs text-accent-strong">
                AI-scanned — please review every field before creating the lead.
              </p>
              {duplicates.length > 0 && (
                <p className="mb-3 rounded-sm bg-warning-tint px-3 py-2 text-xs text-warning" role="alert">
                  Possible duplicate: {duplicates.map((d) => `${d.name} (${d.leadCode})`).join(", ")}
                </p>
              )}
              <BusinessCardFieldsForm
                state={form}
                onChange={setForm}
                statuses={statusesQuery.data ?? []}
                leadTypes={leadTypesQuery.data ?? []}
                executives={executivesQuery.data ?? []}
              />
            </>
          )}

          {step === "created" && createdLead && (
            <div className="flex flex-col items-center gap-3 py-8">
              <p className="text-sm text-text-primary">Lead created successfully.</p>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  openDrawer("lead", createdLead);
                }}
              >
                View lead
              </Button>
            </div>
          )}
        </div>

        {step === "review" && (
          <div className="flex justify-end gap-2 border-t border-border p-4">
            <Button type="button" variant="ghost" size="sm" onClick={() => setStep("capture")}>
              Back
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!cardFormStateIsReadyToSubmit(form) || createLead.isPending}
              onClick={handleCreate}
            >
              {createLead.isPending ? "Creating…" : "Create Lead"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
