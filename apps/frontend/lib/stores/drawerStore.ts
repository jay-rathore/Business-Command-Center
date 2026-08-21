"use client";

import { create } from "zustand";

interface DrawerState {
  isOpen: boolean;
  type: string | null;
  data: unknown;
  open: (type: string, data: unknown) => void;
  close: () => void;
}

/** Single global drawer instance driven by {type, data} — every module opens the same
 * drawer with a different payload shape instead of building a bespoke modal per page. */
export const useDrawerStore = create<DrawerState>((set) => ({
  isOpen: false,
  type: null,
  data: null,
  open: (type, data) => set({ isOpen: true, type, data }),
  close: () => set({ isOpen: false }),
}));
