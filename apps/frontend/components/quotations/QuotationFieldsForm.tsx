"use client";

import { CompanyProfileOption, ProductCatalogOption } from "@hpl/shared";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { computeTotals, FormItemRow, newItemRow, QuotationFormState } from "./quotation-form-state";

const inputClass =
  "h-8 w-full rounded-sm border border-border bg-surface px-2 text-xs outline-none focus:border-accent";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-text-muted">{label}</span>
      {children}
    </label>
  );
}

export function QuotationFieldsForm({
  state,
  onChange,
  companyProfiles,
  productCatalog,
}: {
  state: QuotationFormState;
  onChange: (next: QuotationFormState) => void;
  companyProfiles: CompanyProfileOption[];
  productCatalog: ProductCatalogOption[];
}) {
  function patch(partial: Partial<QuotationFormState>) {
    onChange({ ...state, ...partial });
  }

  function patchItem(key: string, partial: Partial<FormItemRow>) {
    onChange({ ...state, items: state.items.map((item) => (item.key === key ? { ...item, ...partial } : item)) });
  }

  function removeItem(key: string) {
    onChange({ ...state, items: state.items.filter((item) => item.key !== key) });
  }

  function addItem() {
    onChange({ ...state, items: [...state.items, newItemRow()] });
  }

  function applyProduct(key: string, productId: string) {
    const product = productCatalog.find((p) => p.id === productId);
    if (!product) {
      patchItem(key, { productId: null });
      return;
    }
    patchItem(key, { productId: product.id, itemName: product.name, unitRate: product.unitPrice });
  }

  const totals = computeTotals(state.items, state.advancePercent, state.beforeDispatchPercent);

  return (
    <div className="flex flex-col gap-4">
      <Field label="Company detail template">
        <select
          className={inputClass}
          value={state.companyProfileId}
          onChange={(e) => {
            const profile = companyProfiles.find((p) => p.id === e.target.value);
            patch({
              companyProfileId: e.target.value,
              advancePercent: profile?.defaultAdvancePercent ?? state.advancePercent,
              beforeDispatchPercent: profile?.defaultBeforeDispatchPercent ?? state.beforeDispatchPercent,
              termsAndConditions: state.termsAndConditions || profile?.defaultTermsAndConditions || "",
            });
          }}
        >
          <option value="">Select…</option>
          {companyProfiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
              {p.isDefault ? " (default)" : ""}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Customer name">
          <input className={inputClass} value={state.name} onChange={(e) => patch({ name: e.target.value })} />
        </Field>
        <Field label="Company">
          <input className={inputClass} value={state.company} onChange={(e) => patch({ company: e.target.value })} />
        </Field>
        <Field label="Contact">
          <input className={inputClass} value={state.contact} onChange={(e) => patch({ contact: e.target.value })} />
        </Field>
        <Field label="GSTIN (optional)">
          <input className={inputClass} value={state.gstin} onChange={(e) => patch({ gstin: e.target.value })} />
        </Field>
        <Field label="City">
          <input className={inputClass} value={state.city} onChange={(e) => patch({ city: e.target.value })} />
        </Field>
        <Field label="State">
          <input className={inputClass} value={state.state} onChange={(e) => patch({ state: e.target.value })} />
        </Field>
      </div>
      <Field label="Address">
        <input className={inputClass} value={state.address} onChange={(e) => patch({ address: e.target.value })} />
      </Field>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-text-muted">Items</span>
        <div className="flex flex-col gap-2">
          {state.items.map((item) => (
            <div key={item.key} className="grid grid-cols-[1.6fr_1fr_0.6fr_0.7fr_0.7fr_0.6fr_auto] items-end gap-1.5 rounded-sm border border-border p-2">
              <Field label="Item">
                <input
                  className={inputClass}
                  value={item.itemName}
                  onChange={(e) => patchItem(item.key, { itemName: e.target.value, productId: null })}
                  placeholder="Or pick from catalog below"
                />
              </Field>
              <Field label="Catalog">
                <select className={inputClass} value={item.productId ?? ""} onChange={(e) => applyProduct(item.key, e.target.value)}>
                  <option value="">Free text</option>
                  {productCatalog.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="HSN">
                <input className={inputClass} value={item.hsnCode ?? ""} onChange={(e) => patchItem(item.key, { hsnCode: e.target.value })} />
              </Field>
              <Field label="Qty">
                <input
                  type="number"
                  min={1}
                  className={inputClass}
                  value={item.quantity}
                  onChange={(e) => patchItem(item.key, { quantity: Number(e.target.value) || 0 })}
                />
              </Field>
              <Field label="Rate">
                <input
                  type="number"
                  min={0}
                  className={inputClass}
                  value={item.unitRate ?? ""}
                  placeholder="—"
                  onChange={(e) => patchItem(item.key, { unitRate: e.target.value === "" ? null : Number(e.target.value) })}
                />
              </Field>
              <Field label="Tax %">
                <input
                  type="number"
                  min={0}
                  className={inputClass}
                  value={item.taxPercent}
                  onChange={(e) => patchItem(item.key, { taxPercent: Number(e.target.value) || 0 })}
                />
              </Field>
              <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(item.key)} disabled={state.items.length === 1}>
                Remove
              </Button>
            </div>
          ))}
        </div>
        <Button type="button" variant="secondary" size="sm" className="self-start" onClick={addItem}>
          + Add item
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Field label="Advance %">
          <input
            type="number"
            min={0}
            max={100}
            className={inputClass}
            value={state.advancePercent}
            onChange={(e) => {
              const advancePercent = Math.min(100, Math.max(0, Number(e.target.value) || 0));
              patch({ advancePercent, beforeDispatchPercent: 100 - advancePercent });
            }}
          />
        </Field>
        <Field label="Before dispatch %">
          <input type="number" className={inputClass} value={state.beforeDispatchPercent} disabled />
        </Field>
        <Field label="Valid until">
          <input type="date" className={inputClass} value={state.validUntil} onChange={(e) => patch({ validUntil: e.target.value })} />
        </Field>
      </div>

      <Field label="Terms & conditions (one per line)">
        <textarea
          rows={4}
          className="resize-none rounded-sm border border-border bg-surface px-2 py-1.5 text-xs outline-none focus:border-accent"
          value={state.termsAndConditions}
          onChange={(e) => patch({ termsAndConditions: e.target.value })}
        />
      </Field>

      <div className="flex flex-col gap-1 rounded-sm border border-border bg-bg p-3 text-xs">
        <div className="flex justify-between"><span className="text-text-muted">Subtotal</span><span>{formatCurrency(totals.subtotal)}</span></div>
        <div className="flex justify-between"><span className="text-text-muted">GST</span><span>{formatCurrency(totals.gstAmount)}</span></div>
        <div className="flex justify-between border-t border-border pt-1 font-semibold text-text-primary"><span>Total (est.)</span><span>{formatCurrency(totals.totalAmount)}</span></div>
        <div className="flex justify-between text-text-muted"><span>{state.advancePercent}% advance</span><span>{formatCurrency(totals.advanceAmount)}</span></div>
        <div className="flex justify-between text-text-muted"><span>{state.beforeDispatchPercent}% before dispatch</span><span>{formatCurrency(totals.beforeDispatchAmount)}</span></div>
      </div>
    </div>
  );
}
