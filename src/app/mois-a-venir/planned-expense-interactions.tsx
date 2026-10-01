"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

export type ExistingExpenseAction = "EDIT" | "DECLARE" | "CORRECT" | "RESTORE" | "REPORT" | "DELETE";
export type PlannedExpenseInteraction = { id: string; action: ExistingExpenseAction }
  | { action: "CREATE"; plannedDate?: string } | { action: "SIMULATE" };
const InteractionContext = createContext<{ pending: PlannedExpenseInteraction | null;
  request: (action: PlannedExpenseInteraction) => void; consume: () => void } | null>(null);

/** Local navigation only. The existing builder owns drafts and server actions. */
export function PlannedExpenseInteractions({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PlannedExpenseInteraction | null>(null);
  const request = useCallback((action: PlannedExpenseInteraction) => setPending(action), []);
  const consume = useCallback(() => setPending(null), []);
  return <InteractionContext.Provider value={{ pending, request, consume }}>{children}</InteractionContext.Provider>;
}
export const usePlannedExpenseInteractions = () => useContext(InteractionContext);
