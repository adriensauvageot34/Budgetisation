"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ComposerContextCardView } from "@/domain/phase2/planner/composer-contract";
import type { ComposerOperation, ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import type { PlannedContextState } from "@/domain/phase2/planner/semantic-state";
import { clothingItem, clothingItemWritable } from "@/domain/phase2/planner/composer-library-index";
import { canonicalPlannerJson } from "@/domain/phase2/planner/json";
import { fromSelection, buildComponentRow, type Row } from "./night-out-components";
import { WorkshopComponentRow } from "./workshop-component-row";
import { ContextPalette } from "./context-palette";
import { useActiveWorkshopQuestion } from "./workshop-choices";
import { useWorkshopRaw } from "./inline-edit-registry";
import { PurchaseDelivery } from "./purchase-delivery";
import { money } from "./display";
import type { GuidedCatalogChoice } from "./catalog-discovery";
import { EnablePurchaseBasket } from "./purchase-basket-editor";
import { SuggestionControls, type SuggestionDismissal } from "./suggestion-controls";
import styles from "./composer.module.css";

/** One existing purchase item. No cart, product catalogue or new writer. */
export function ClothingItemEditor({ context, card, model, busy, decide, close, catalogChoice, dismissedSuggestions, updateSuggestionDismissal }: {
  context: PlannedContextState; card: ComposerContextCardView; model: ComposerUiModel; busy: boolean;
  decide: (operation: ComposerOperation) => boolean; close: () => void;
  catalogChoice?: GuidedCatalogChoice;
} & SuggestionDismissal) {
  const item = clothingItem(context), writable = clothingItemWritable(model, context, card);
  const [row, setRow] = useState<Row | null>(null), [shipping, setShipping] = useState(false), [error, setError] = useState("");
  const [showChoices, setShowChoices] = useState(false);
  const expected = useRef(""), opened = useRef(""), heading = useRef<HTMLHeadingElement>(null);
  const activeQuestion = useActiveWorkshopQuestion();
  const signature = canonicalPlannerJson([context, model.semanticState.targetMonth]);
  const leaveRaw = useWorkshopRaw(context.contextOccurrenceId, !!row && JSON.stringify(row) !== opened.current,
    () => { setRow(null); setError(""); }, "clothing-item");
  useEffect(() => { if (!row && !shipping) heading.current?.focus({ preventScroll: true }); }, [row === null, shipping]);
  const summary = () => { if (!leaveRaw(summary)) return; setRow(null); setShipping(false); setError(""); };
  const edit = () => {
    if (!item || !writable || !leaveRaw(edit)) return;
    const initial = fromSelection(item);
    const next = { ...initial, amount: initial.amount.replace(".", ","), quantity: initial.quantity.replace(".", ",") };
    expected.current = signature; opened.current = JSON.stringify(next); setRow(next); setShipping(false); setError("");
  };
  const handledCatalogChoice = useRef<GuidedCatalogChoice | undefined>(undefined);
  useEffect(() => {
    if (catalogChoice?.kind !== "socket" || handledCatalogChoice.current === catalogChoice) return;
    handledCatalogChoice.current = catalogChoice;
    if (catalogChoice.target.contextOccurrenceId === context.contextOccurrenceId && catalogChoice.target.slotKey === "item"
      && catalogChoice.selection?.selectionId === item?.selectionId) edit();
  });
  const fees = () => { if (!leaveRaw(fees)) return; setRow(null); setShipping(true); setError(""); };
  const save = () => {
    if (!row || busy) return;
    try {
      if (!writable || signature !== expected.current || !item || item.selectionId !== row.id)
        throw Error("Cet article ou ses droits ont changé. Votre saisie est conservée ; rouvrez la bonne occurrence.");
      const next = buildComponentRow(row, "item");
      if (!decide({ kind: "EDIT_PRESET_CONTEXT", edit: { contextOccurrenceId: context.contextOccurrenceId, slots: { item: [next] } } }))
        throw Error("Cet article n’est plus modifiable. Votre saisie est conservée.");
      setRow(null); setError("");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Vérifiez l’article. Votre saisie est conservée."); }
  };
  const short = row && (!row.existing?.unitBasis || row.existing.unitBasis === "ITEM");
  const change = (key: "label" | "quantity" | "amount", value: string) => {
    if (!row) return;
    setRow({ ...row, [key]: value, ...(key === "amount" ? { costMode: value.trim() ? "MANUAL" as const : "UNKNOWN" as const } : {}), edited: true });
  };
  const choice = (key: string, label: string, choose: () => void) => ({ key, label, choose, iconKey: "purchase" });
  const suggestions = writable && item ? [{
    ...choice(`${context.contextOccurrenceId}:clothing:${item.selectionId}`,
      item.cost.kind === "UNKNOWN" ? "Préciser le prix du vêtement" : "Modifier ce vêtement", edit),
    hint: item.label + " · ligne existante", showHint: true,
  }].filter(candidate => !dismissedSuggestions?.includes(candidate.key)) : [];
  const useSuggestions = !row && !shipping && !showChoices && suggestions.length > 0;
  const question = useSuggestions ? { title: "Suggestions pour ce vêtement", nature: "DECISION" as const, choices: suggestions }
    : { title: row ? "Cet article uniquement" : "Préparer cet achat de vêtement", choices: row ? [
    choice("unknown", "Prix inconnu · Laisser à préciser", () => { if (row) setRow({ ...row, amount: "", costMode: "UNKNOWN", edited: true }); }),
    choice("summary", "Retour à la fiche", summary),
  ] : [ ...(writable ? [choice("edit", "Article · Modifier pour cet achat", edit)] : []),
    choice("fees", "Vendeur et livraison · Consulter cet achat", fees),
  ] };
  const panel = <aside className={styles.restaurantInspector} data-restaurant-editor data-purchase-editor data-clothing-editor
    data-basket-suggestions={useSuggestions || undefined}
    role="dialog" aria-modal="false" aria-labelledby="clothing-heading" onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); close(); } }}>
    <header><h2 id="clothing-heading" ref={heading} tabIndex={-1}>{item?.label || "Article non renseigné"}</h2>
      <button type="button" onClick={close} aria-label="Fermer la fiche du vêtement">×</button></header>
    {shipping ? <PurchaseDelivery context={context} card={card} model={model} busy={busy} decide={decide} back={summary} /> : <>
      {!row && <section className={styles.nightSection} data-clothing-summary>
        <EnablePurchaseBasket context={context} card={card} model={model} busy={busy} decide={decide} />
        <p>Projet : {card.label}. Une ligne existante de cet achat, sans nouvelle commande.</p>
        {typeof context.fields.productLabel === "string" && context.fields.productLabel.trim() && context.fields.productLabel !== item?.label && <p>Article indiqué dans le projet : {context.fields.productLabel}.</p>}
        <p>Quantité déclarée : {item?.quantity ?? "Non renseignée"}{item?.unitBasis === "SHARED" ? " lot(s) partagé(s)" : item?.unitBasis === "PERSON" ? " · base par personne conservée" : " unité(s)"}.</p>
        <p>{item?.cost.kind === "MANUAL" ? `Prix déclaré${item.unitBasis === "SHARED" ? " par lot" : " par unité"} : ${money(item.cost.unitAmount)}`
          : item?.cost.kind === "QUOTE" ? "Devis conservé · aucune preuve d’achat" : "Prix non renseigné · encore inconnu"}.</p>
        <p>Taille : non renseignée · modification indisponible dans ce parcours.</p>
        <p>Marque : non renseignée. Vendeur déclaré : {typeof context.fields.merchantLabel === "string" && context.fields.merchantLabel.trim() ? context.fields.merchantLabel : "Non renseigné"}.</p>
        <p className={styles.helper}>Prix de référence daté pour cet article : non renseigné dans ce parcours. Aucun prix historique n’est adopté. SKU, stock et disponibilité ne sont pas publiés.</p>
        {!writable && <p role="status">Lecture seule : la ligne ou ses capacités d’édition ne sont pas disponibles.</p>}
        {writable && <button type="button" disabled={busy} onClick={edit}>Modifier cet article</button>}
        <button type="button" disabled={busy} onClick={fees}>Vendeur, livraison et frais de cet achat</button>
        {suggestions.length > 0 && <button type="button" aria-pressed={showChoices}
          onClick={() => setShowChoices(value => !value)}>{showChoices ? "Revenir aux suggestions" : "Tous les choix du vêtement"}</button>}
        <SuggestionControls occurrenceId={context.contextOccurrenceId} choices={suggestions} busy={busy}
          dismissedSuggestions={dismissedSuggestions} updateSuggestionDismissal={updateSuggestionDismissal} />
      </section>}
      {row && (short ? <form className={styles.nightSection} data-clothing-item={row.id} onSubmit={event => { event.preventDefault(); save(); }}>
        <div className={styles.formFields}>
          <label>Article<input autoFocus autoComplete="off" maxLength={1024} value={row.label} onChange={event => change("label", event.target.value)} /></label>
          <label>Quantité totale<input inputMode="decimal" autoComplete="off" value={row.quantity} onChange={event => change("quantity", event.target.value)} /></label>
          <label>Prix unitaire prévu (€)<input inputMode="decimal" autoComplete="off" placeholder="Encore inconnu" value={row.amount} onChange={event => change("amount", event.target.value)} /></label>
        </div>
        <p className={styles.helper}>{row.costMode === "QUOTE" ? "Devis conservé tant que vous ne saisissez pas un autre prix." : row.costMode === "UNKNOWN" ? "Un prix vide reste inconnu." : "Prix retenu seulement après validation."}</p>
        <button type="submit" disabled={busy || !writable}>Conserver cet article</button>
        <button type="button" disabled={busy} onClick={summary}>Retour à la fiche</button>
      </form> : <><p>La base de quantité existante est conservée. Utilisez les réglages déjà publiés.</p>
        <WorkshopComponentRow title="Article existant" row={row} onChange={setRow} onSave={save} busy={busy || !writable} back={{ label: "Retour à la fiche", action: summary }} /></>)}
    </>}
    {error && <p role="alert">{error}</p>}
    <footer><button type="button" onClick={close}>Retour au Board</button></footer>
  </aside>;
  return <>{typeof document !== "undefined" && createPortal(panel, document.body)}
    <ContextPalette card={card} model={model} busy={busy} configure choose={() => {}} close={close} question={activeQuestion ?? question} />
  </>;
}
