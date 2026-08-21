import { BusinessCardDraft } from "@hpl/shared";

export interface BusinessCardFormState {
  name: string;
  company: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  city: string;
  state: string;
  leadTypeId: string;
  assignedExecId: string;
  statusId: string;
  notes: string;
  saveImage: boolean;
}

export function buildDefaultCardFormState(): BusinessCardFormState {
  return {
    name: "",
    company: "",
    phone: "",
    email: "",
    website: "",
    address: "",
    city: "",
    state: "",
    leadTypeId: "",
    assignedExecId: "",
    statusId: "",
    notes: "",
    saveImage: true,
  };
}

export function applyDraftToCardFormState(base: BusinessCardFormState, draft: BusinessCardDraft): BusinessCardFormState {
  return {
    ...base,
    name: draft.name || base.name,
    company: draft.company ?? base.company,
    phone: draft.phone || base.phone,
    email: draft.email ?? base.email,
    website: draft.website ?? base.website,
    address: draft.address ?? base.address,
    city: draft.city ?? base.city,
    state: draft.state ?? base.state,
  };
}

export function cardFormStateIsReadyToSubmit(state: BusinessCardFormState): boolean {
  return !!state.name.trim() && !!state.phone.trim() && !!state.city.trim() && !!state.state.trim();
}
