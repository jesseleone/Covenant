"use client";

// Global UI state: which "New" dialog or the command palette is open.

import { create } from "zustand";

export type NewKind = "deal" | "company" | "person";

type UIState = {
  modal: { kind: NewKind; prefill?: Record<string, string> } | null;
  palette: boolean;
};

export const useUI = create<UIState>(() => ({ modal: null, palette: false }));

export const openNew = (kind: NewKind, prefill?: Record<string, string>) => useUI.setState({ modal: { kind, prefill }, palette: false });
export const closeNew = () => useUI.setState({ modal: null });
export const setPalette = (palette: boolean) => useUI.setState({ palette });
