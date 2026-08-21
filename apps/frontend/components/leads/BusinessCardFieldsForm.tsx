"use client";

import { ExecutiveOption, LeadStatusOption, LeadTypeOption } from "@hpl/shared";
import { BusinessCardFormState } from "./business-card-form-state";

const inputClass = "h-8 w-full rounded-sm border border-border bg-surface px-2 text-xs outline-none focus:border-accent";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-text-muted">{label}</span>
      {children}
    </label>
  );
}

export function BusinessCardFieldsForm({
  state,
  onChange,
  statuses,
  leadTypes,
  executives,
}: {
  state: BusinessCardFormState;
  onChange: (next: BusinessCardFormState) => void;
  statuses: LeadStatusOption[];
  leadTypes: LeadTypeOption[];
  executives: ExecutiveOption[];
}) {
  function patch(partial: Partial<BusinessCardFormState>) {
    onChange({ ...state, ...partial });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name">
          <input className={inputClass} value={state.name} onChange={(e) => patch({ name: e.target.value })} />
        </Field>
        <Field label="Company">
          <input className={inputClass} value={state.company} onChange={(e) => patch({ company: e.target.value })} />
        </Field>
        <Field label="Phone">
          <input className={inputClass} value={state.phone} onChange={(e) => patch({ phone: e.target.value })} />
        </Field>
        <Field label="Email">
          <input type="email" className={inputClass} value={state.email} onChange={(e) => patch({ email: e.target.value })} />
        </Field>
        <Field label="Website">
          <input className={inputClass} value={state.website} onChange={(e) => patch({ website: e.target.value })} />
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

      <div className="grid grid-cols-3 gap-3">
        <Field label="Status">
          <select className={inputClass} value={state.statusId} onChange={(e) => patch({ statusId: e.target.value })}>
            <option value="">Select…</option>
            {statuses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Lead type">
          <select className={inputClass} value={state.leadTypeId} onChange={(e) => patch({ leadTypeId: e.target.value })}>
            <option value="">Select…</option>
            {leadTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Assigned to">
          <select className={inputClass} value={state.assignedExecId} onChange={(e) => patch({ assignedExecId: e.target.value })}>
            <option value="">Unassigned</option>
            {executives.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Notes (optional)">
        <textarea
          rows={2}
          className="resize-none rounded-sm border border-border bg-surface px-2 py-1.5 text-xs outline-none focus:border-accent"
          value={state.notes}
          onChange={(e) => patch({ notes: e.target.value })}
        />
      </Field>

      <label className="flex items-center gap-2 text-xs text-text-primary">
        <input type="checkbox" checked={state.saveImage} onChange={(e) => patch({ saveImage: e.target.checked })} />
        Save card image for later reference
      </label>
    </div>
  );
}
