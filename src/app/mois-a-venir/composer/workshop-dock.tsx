"use client";
import { useState } from "react";
import { createPortal } from "react-dom";
import type { ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import { ContextPalette, type PaletteQuestion } from "./context-palette";
import { useActiveWorkshopQuestion } from "./workshop-choices";

/** One R6 dock: focused decisions first, compatible equipment on demand. */
export function WorkshopDock({ host, contextId, model, busy, choices, choose, summary, question }: {
  host?: HTMLElement | null; contextId: string; model: ComposerUiModel; busy: boolean;
  choices: PaletteQuestion["choices"]; choose: Parameters<typeof ContextPalette>[0]["choose"]; summary: () => void;
  question?: PaletteQuestion;
}) {
  const [equipment, setEquipment] = useState(false);
  const activeQuestion = useActiveWorkshopQuestion();
  if (!host) return null;
  const card = model.board.contexts.find(card => card.contextOccurrenceId === contextId);
  if (!card) return null;
  return createPortal(<ContextPalette card={card} model={model} busy={busy} configure choose={choose}
    close={() => { setEquipment(false); summary(); }} onConfigure={equipment ? () => { setEquipment(false); summary(); } : undefined}
    question={activeQuestion ?? (equipment ? card.sockets.length ? undefined : { title: "Lecture des composants admissibles…", choices: [
      { key: "summary", label: "Retour au résumé", iconKey: "activity", choose: () => { setEquipment(false); summary(); } }] } : question ?? { title: `Composer · ${card.label}`, choices: [...choices,
      { key: "equipment", label: "Ajouter un poste", iconKey: "activity", choose: () => setEquipment(true) }] })} />, host);
}
