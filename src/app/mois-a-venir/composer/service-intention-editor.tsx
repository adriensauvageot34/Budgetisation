"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { createPortal } from "react-dom";
import type { ComposerContextCardView } from "@/domain/phase2/planner/composer-contract";
import type { ComposerOperation, ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import type { PlannedContextState } from "@/domain/phase2/planner/semantic-state";
import type { ComponentSelectionV1 } from "@/domain/phase2/planner/component-contract";
import { componentId } from "@/domain/phase2/planner/identity";
import { canonicalPlannerJson, type PlannerJson } from "@/domain/phase2/planner/json";
import { presetForContext } from "@/domain/phase2/planner/composer-presets";
import { derivePlannedPlaceRoles } from "@/domain/phase2/planned-place-rules";
import type { ProspectivePlaceRef } from "@/domain/phase2/planned-contract";
import { PlannedPlaceField } from "../planned-place-field";
import { buildComponentRow, fresh, fromSelection } from "./night-out-components";
import { useWorkshopRaw } from "./inline-edit-registry";
import { WorkshopNavigation } from "./workshop-navigation";
import { CommerceBadges } from "./commerce-badges";
import { IntentBudgetImpact } from "./intent-budget-impact";
import { workshopErrorMessage } from "./workshop-error";
import { catalogRefLocked, catalogSocket } from "./catalog-discovery";
import styles from "./composer.module.css";

const suggestions = ["Coupe", "Brushing", "Couleur", "Soin capillaire"];
const text = (value: unknown) => typeof value === "string" ? value : "";

export function ServiceIntentionEditor({ context, card, model, busy, decide, close }: {
  context: PlannedContextState; card: ComposerContextCardView; model: ComposerUiModel; busy: boolean;
  decide: (operation: ComposerOperation) => boolean; close: () => void;
}) {
  const id = context.contextOccurrenceId;
  const hairdresser = presetForContext(context)?.presetKey === "hairdresser-service";
  const existing = (context.slotSelections.main?.items as readonly ComponentSelectionV1[] | undefined)
    ?.find(item => item.kind === "COMPONENT");
  const initial = {
    name: existing?.label ?? "", provider: text(context.fields.providerLabel),
    place: (context.fields.placeRef ?? undefined) as ProspectivePlaceRef | undefined,
    date: text(context.fields.plannedDate), time: text(context.fields.plannedTime),
    considering: context.fields.appointmentIntent === "CONSIDERING",
    price: existing?.cost.kind === "MANUAL" ? existing.cost.unitAmount : "",
  };
  const [form, setForm] = useState(initial);
  const [error, setError] = useState("");
  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm(current => ({ ...current, [key]: value }));
  };
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  useWorkshopRaw(id, dirty, () => setForm(initial), "service-intention");
  const writable = !card.readOnly && card.capabilityRefs.includes("PATCH_CONTEXT") && !catalogRefLocked(model, id);
  const tariffWritable = writable && !!catalogSocket(model, id, "main", "option:activity:main:activity")
    && (!existing || !catalogRefLocked(model, componentId(id, "main", existing.selectionId)));
  const places = (model.mobilityOptions?.places ?? []).filter(place => !place.privatePlace
    && (!hairdresser || derivePlannedPlaceRoles(place).includes("HAIRDRESSER")));
  const save = () => {
    if (busy || !writable || !dirty) return;
    try {
      const { name, provider, place, date, time, considering, price } = form;
      if (place?.kind === "TEXT" && !place.label.trim()) throw Error("Précisez le nom de l’établissement ou retirez ce lieu.");
      const posted: Record<string, PlannerJson> = { providerLabel: provider.trim(), placeRef: place ?? "",
        plannedDate: date, plannedTime: time, appointmentIntent: considering ? "CONSIDERING" : "" };
      const fields = Object.fromEntries(Object.entries(posted).filter(([key, value]) =>
        canonicalPlannerJson(value || null) !== canonicalPlannerJson(context.fields[key] ?? null)));
      const tariffChanged = tariffWritable && (name !== initial.name || price !== initial.price);
      const slots = tariffChanged ? { main: [buildComponentRow({
        ...(existing ? fromSelection(existing) : fresh(name || card.label)),
        label: name.trim() || (hairdresser ? "Prestation coiffure" : "Prestation"), amount: price,
        costMode: price.trim() ? "MANUAL" : existing?.cost.kind === "QUOTE" ? "QUOTE" : "UNKNOWN", edited: true,
      }, "activity")] } : undefined;
      if (!slots && !Object.keys(fields).length) { setForm(initial); return; }
      if (!decide({ kind: "EDIT_PRESET_CONTEXT", edit: { contextOccurrenceId: id, fields, ...(slots ? { slots } : {}) } }))
        throw Error("La prestation a changé. Rouvrez cette intention pour poursuivre.");
      setError("");
    } catch (failure) { setError(workshopErrorMessage(failure)); }
  };
  const panel = <aside className={styles.restaurantInspector} data-restaurant-editor data-service-editor={id}
    role="dialog" aria-modal="false" aria-labelledby="service-intention-title"
    onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); close(); } }}>
    <header><h2 id="service-intention-title" tabIndex={-1}>{card.label}</h2>
      <button type="button" className={styles.iconButton} onClick={close} aria-label="Fermer la prestation"><X size={18} /></button></header>
    <WorkshopNavigation contextId={id} />
    <CommerceBadges context={context} model={model} expanded />
    <form onSubmit={event => { event.preventDefault(); save(); }} className={styles.formFields}>
      {hairdresser && tariffWritable && <div className={styles.linkedFilters} aria-label="Prestations de coiffure">
        {suggestions.map(label => <button key={label} type="button" disabled={busy}
          aria-pressed={form.name === label} onClick={() => update("name", label)}>{label}</button>)}
      </div>}
      <label>Prestation<input maxLength={120} value={form.name} disabled={busy || !tariffWritable}
        onChange={event => update("name", event.target.value)} /></label>
      <label>Prestataire (facultatif)<input maxLength={120} value={form.provider} disabled={busy || !writable}
        onChange={event => update("provider", event.target.value)} /></label>
      {writable && !busy && <PlannedPlaceField label="Établissement" places={places} value={form.place} exact onChange={value => update("place", value)} />}
      <label>Date envisagée<input type="date" value={form.date} min={model.semanticState.targetMonth + "-01"} disabled={busy || !writable}
        onChange={event => update("date", event.target.value)} /></label>
      <label>Heure envisagée<input type="time" value={form.time} disabled={busy || !writable}
        onChange={event => update("time", event.target.value)} /></label>
      <label><input type="checkbox" checked={form.considering} disabled={busy || !writable}
        onChange={event => update("considering", event.target.checked)} /> Rendez-vous envisagé</label>
      <p>La réservation se fait auprès du prestataire.</p>
      <label>Tarif prévu (€)<input inputMode="decimal" placeholder={existing?.cost.kind === "QUOTE" ? "Devis conservé" : "Prix inconnu"}
        disabled={busy || !tariffWritable} value={form.price} onChange={event => update("price", event.target.value)} /></label>
      {error && <p role="alert">{error}</p>}
      <button className={styles.primary} disabled={busy || !writable || !dirty}>Conserver la prestation</button>
    </form>
    <IntentBudgetImpact model={model} contextId={id} />
  </aside>;
  return typeof document === "undefined" ? null : createPortal(panel, document.body);
}
