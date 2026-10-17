"use client";
import { createContext, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import type { PaletteQuestion } from "./context-palette";

type ActiveQuestion = { id: string; question: PaletteQuestion };
const QuestionContext = createContext<{ active: ActiveQuestion | null; set: (value: ActiveQuestion | null, id: string) => void } | null>(null);
/** One transient presentation question for the existing dock, never a semantic state. */
export function WorkshopChoicesProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<ActiveQuestion | null>(null);
  const set = useMemo(() => (value: ActiveQuestion | null, id: string) => setActive(old => value ?? (old?.id === id ? null : old)), []);
  return <QuestionContext.Provider value={{ active, set }}>{children}</QuestionContext.Provider>;
}
export const useActiveWorkshopQuestion = () => useContext(QuestionContext)?.active?.question;
export function useWorkshopQuestion(question: PaletteQuestion | null) {
  const host = useContext(QuestionContext), id = useId(), latest = useRef(question);
  useEffect(() => { latest.current = question; });
  const signature = question ? JSON.stringify({ title: question.title, choices: question.choices.map(({choose: _choose,...choice})=>choice), search: question.search?.value }) : "";
  useEffect(() => {
    if (!host) return;
    const current = question;
    host.set(current ? { id, question: { ...current, choices: current.choices.map(choice => ({ ...choice,
      choose: () => latest.current?.choices.find(candidate => candidate.key === choice.key)?.choose() })),
      ...(current.search ? { search: { ...current.search, change: value => latest.current?.search?.change(value) } } : {}) } } : null, id);
    return () => host.set(null, id);
  }, [host?.set, id, signature]);
  return !!host;
}
