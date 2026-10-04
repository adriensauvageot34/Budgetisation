"use client";
import { createContext, useContext, type ReactNode } from "react";
import type { MonthControlSection } from "@/domain/phase2/month-control-contract";

export type LocalControlFocus = { section: MonthControlSection; entity: string | null; openEntity: (entity: string | null) => void };
const FocusContext = createContext<LocalControlFocus>({ section: "choices", entity: null, openEntity() {} });
/** Children can change only the entity inside their current tab. No tab navigation API. */
export function MonthLocalFocusProvider({ value, children }: { value: LocalControlFocus; children: ReactNode }) {
  return <FocusContext.Provider value={value}>{children}</FocusContext.Provider>;
}
export const useMonthLocalFocus = () => useContext(FocusContext);
export function ControlBack({ label }: { label: string }) {
  const { openEntity } = useMonthLocalFocus();
  return <button type="button" className="mb-6 text-sm font-bold text-violet-900" onClick={() => openEntity(null)}>← Retour à {label}</button>;
}
