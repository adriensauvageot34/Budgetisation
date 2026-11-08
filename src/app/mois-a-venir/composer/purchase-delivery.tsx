"use client";

import { useEffect, useRef, useState } from "react";
import type { ComponentSelectionV1 } from "@/domain/phase2/planner/component-contract";
import type { ComposerContextCardView } from "@/domain/phase2/planner/composer-contract";
import type { ComposerOperation, ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import type { PlannedContextState } from "@/domain/phase2/planner/semantic-state";
import { presetForContext } from "@/domain/phase2/planner/composer-presets";
import { canonicalPlannerJson } from "@/domain/phase2/planner/json";
import { componentId } from "@/domain/phase2/planner/identity";
import { publishedDrop } from "./interactions";
import { useWorkshopRaw } from "./inline-edit-registry";
import { useWorkshopQuestion } from "./workshop-choices";
import { fresh, fromSelection, buildComponentRow, type Row } from "./night-out-components";
import { money } from "./display";
import styles from "./composer.module.css";

type Component = Extract<ComponentSelectionV1, { kind: "COMPONENT" }>;
const isDeliveryFee = (item: ComponentSelectionV1) => item.kind === "COMPONENT" && item.optionKey === "extra"
  && ["livraison", "frais de livraison"].includes(item.label.trim().toLocaleLowerCase("fr"));
const caption = (item: Component) => item.cost.kind === "MANUAL" ? `${item.quantity} × ${money(item.cost.unitAmount)}`
  : item.cost.kind === "QUOTE" ? "Devis conservé" : "Frais inconnus";

export function PurchaseDelivery({ context, card, model, busy, decide, back }: {
  context: PlannedContextState; card: ComposerContextCardView; model: ComposerUiModel; busy: boolean;
  decide: (operation: ComposerOperation) => boolean; back: () => void;
}) {
  const id = context.contextOccurrenceId;
  const ownerSignature = canonicalPlannerJson([id, context.templateKey, context.fields.composerPresentation ?? null,
    context.parentContextOccurrenceId, context.status]);
  const originalOwner = useRef(ownerSignature);
  const locked = (ref: string) => model.semanticState.preferences.anchors.includes(ref)
    || model.semanticState.preferences.flexibility[ref] === "PRESERVE";
  const writable = context.templateKey === "purchase" && !!presetForContext(context) && ownerSignature === originalOwner.current
    && card.templateKey === "purchase" && card.contextOccurrenceId === id
    && presetForContext(card)?.presetKey === presetForContext(context)?.presetKey
    && !card.readOnly && card.capabilityRefs.includes("PATCH_CONTEXT") && !locked(id);
  const sellerAllowed = writable && !!model.editors.find(editor => editor.assetKey === "template:purchase")?.fields
    .some(field => field.key === "merchantLabel");
  const target = { kind: "CONTEXT_SOCKET" as const, contextOccurrenceId: id, slotKey: "extras" };
  const socket = card.sockets.find(slot => slot.contextOccurrenceId === id && slot.slotKey === "extras");
  const feesAllowed = writable && socket?.cardinality === "REPEATING"
    && socket.capabilityRefs.includes("purchase:extras:SELECT_COMPONENT")
    && !!socket.choiceAssetKeys?.includes("option:purchase:extras:extra")
    && publishedDrop(model, "option:purchase:extras:extra", target)?.semanticAction === "PATCH_CONTEXT";
  const items = (context.slotSelections.extras?.items ?? []) as readonly ComponentSelectionV1[];
  const fees = items.filter((item): item is Component => isDeliveryFee(item));
  const otherFees = items.filter((item): item is Component => item.kind === "COMPONENT" && !isDeliveryFee(item));
  const canEdit = (item: Component) => feesAllowed && !locked(componentId(id, "extras", item.selectionId));
  const [scene, setScene] = useState<"summary" | "seller" | "fees">("summary");
  const [seller, setSeller] = useState(String(context.fields.merchantLabel ?? ""));
  const [row, setRow] = useState<Row | null>(null);
  const [raw, setRaw] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const expected = useRef("");
  const expectedItem = useRef("");
  const heading = useRef<HTMLHeadingElement>(null);
  const leaveRaw = useWorkshopRaw(id, raw, () => { setRow(null); setRaw(false); setError(""); }, "purchase-delivery");
  useEffect(() => {
    if (!row && scene !== "seller") heading.current?.focus({ preventScroll: true });
  }, [scene, row === null]);
  const openSeller = () => {
    if (!sellerAllowed || !leaveRaw(openSeller)) return;
    expected.current = canonicalPlannerJson(context.fields.merchantLabel ?? null);
    expectedItem.current = canonicalPlannerJson(context.slotSelections.item ?? null);
    setSeller(String(context.fields.merchantLabel ?? "")); setScene("seller"); setRow(null); setError(""); setNotice("");
  };
  const openFees = () => {
    if (!leaveRaw(openFees)) return;
    setScene("fees"); setRow(null); setError(""); setNotice("");
  };
  const prepareFee = (item?: Component) => {
    if (!feesAllowed || item && !canEdit(item) || !item && fees.length || !leaveRaw(() => prepareFee(item))) return;
    expected.current = canonicalPlannerJson(item ?? items);
    expectedItem.current = canonicalPlannerJson(context.slotSelections.item ?? null);
    setScene("fees"); setRow(item ? fromSelection(item) : fresh("Frais de livraison")); setError(""); setNotice("");
  };
  const send = (operation: ComposerOperation) => {
    try {
      if (!decide(operation)) { setError("Ce choix est indisponible. Votre saisie est conservée."); return false; }
      setRaw(false); setError(""); return true;
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Vérifiez ce choix."); return false; }
  };
  const saveSeller = () => {
    if (!sellerAllowed || expected.current !== canonicalPlannerJson(context.fields.merchantLabel ?? null)
      || expectedItem.current !== canonicalPlannerJson(context.slotSelections.item ?? null)) {
      setError("Le vendeur ou cet achat a changé. Votre saisie est conservée."); return;
    }
    if (send({ kind: "EDIT_PRESET_CONTEXT", edit: { contextOccurrenceId: id, fields: { merchantLabel: seller.trim() || null } } })) {
      setScene("summary");
    }
  };
  const saveFee = () => {
    if (!row) return;
    const current = items.find(item => item.selectionId === row.id);
    const stale = row.existing ? !canEdit(row.existing) || canonicalPlannerJson(current ?? null) !== expected.current
      : !feesAllowed || fees.length > 0 || canonicalPlannerJson(items) !== expected.current;
    if (!writable || stale || expectedItem.current !== canonicalPlannerJson(context.slotSelections.item ?? null)) {
      setError("Ces frais ou cet achat ont changé. Votre saisie est conservée."); return;
    }
    try {
      const built = buildComponentRow(row, "extra");
      const item = row.existing ? { ...row.existing, cost: built.cost,
        ...(row.edited ? { provenance: "EXPLICIT_USER_DECISION" as const } : {}) } : built;
      if (send({ kind: "EDIT_PRESET_CONTEXT", edit: { contextOccurrenceId: id,
        slots: { extras: row.existing ? items.map(old => old.selectionId === item.selectionId ? item : old) : [...items, item] } } })) {
        setRow(null); setNotice("Poste conservé dans le brouillon de cet achat.");
      }
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Vérifiez les frais."); }
  };
  const explain = (message: string) => {
    if (!leaveRaw(() => explain(message))) return;
    setRow(null); setNotice(message); setError("");
    heading.current?.focus();
  };
  const choice = (key: string, label: string, choose: () => void, hint?: string) => ({ key, label, choose, hint, iconKey: "purchase" });
  useWorkshopQuestion({ title: row ? "Frais distincts de cet achat" : "Vendeur et livraison de cet achat", choices: row ? [
    choice("unknown", "Frais inconnus — Laisser le prix à préciser", () => { setRow({ ...row, costMode: "UNKNOWN", amount: "", edited: true }); setRaw(true); }),
    choice("back", "Retour aux frais", openFees),
  ] : scene === "seller" ? [
    choice("back", "Retour aux frais", openFees),
  ] : [
    ...(sellerAllowed ? [choice("seller", "Vendeur — Préciser pour cet achat", openSeller)] : []),
    ...(scene === "summary" ? [choice("fees", "Livraison — Examiner les frais", openFees, "Règle métier · aucune dépense ajoutée")] : [
      ...(feesAllowed && fees.length === 0 ? [choice("extra", "Livraison — Préparer des frais distincts", () => prepareFee(),
        "Règle métier · montant à confirmer")] : []),
      choice("included", "Frais compris — Consulter", () => explain("Si la livraison est comprise dans le prix décidé, gardez ce prix. Aucun poste supplémentaire n’a été créé.")),
    ]),
    choice("summary", "Retour au résumé de l’achat", back),
  ] });
  return <section data-purchase-delivery className={styles.purchaseDelivery}>
    <h4 ref={heading} tabIndex={-1}>{row ? row.label : scene === "seller" ? "Vendeur de cet achat"
      : scene === "fees" ? "Frais de livraison" : "Précisions de cet achat"}</h4>
    {!row && <><p>Vendeur déclaré · {String(context.fields.merchantLabel ?? "").trim() || "À préciser"}</p>
      <p>Modalité de livraison · indisponible ici. Consultez les conditions du vendeur.</p></>}
    {scene === "seller" ? <form onSubmit={event => { event.preventDefault(); if (!busy) saveSeller(); }}>
      <label>Vendeur facultatif<input autoFocus autoComplete="off" maxLength={1024} value={seller}
        onChange={event => { setRaw(true); setSeller(event.target.value); }} /></label>
      <button type="submit" disabled={busy || !sellerAllowed}>Conserver le vendeur</button>
    </form> : !row && <>
      {sellerAllowed && <button type="button" disabled={busy} onClick={openSeller}>Préciser le vendeur</button>}
      {!sellerAllowed && <p>La modification du vendeur est indisponible pour cet achat.</p>}
      {scene === "summary" && <button type="button" disabled={busy} onClick={openFees}>Examiner les frais de livraison</button>}
      {scene === "fees" && !row && <>
        <p>Les frais supplémentaires sont des postes distincts. Les frais déjà compris restent dans le prix de l’achat.</p>
        {fees.map((item, index) => <button key={item.selectionId} type="button" disabled={busy || !canEdit(item)}
          data-delivery-fee={item.selectionId} onClick={() => prepareFee(item)}>
          Modifier {item.label} · {caption(item)}{fees.length > 1 ? ` · Poste ${index + 1}` : ""}
        </button>)}
        {fees.length === 0 && <p>Aucun poste nommé livraison n’est déclaré. Les frais peuvent être compris, absents ou encore inconnus.</p>}
        {otherFees.length > 0 && <p>Autres compléments conservés : {otherFees.map(item => item.label).join(", ")}. Vérifiez qu’ils ne couvrent pas déjà ces frais.</p>}
        {feesAllowed && fees.length === 0 && <button type="button" disabled={busy} onClick={() => prepareFee()}>Préparer des frais distincts</button>}
        {!feesAllowed && <p>La modification des frais est indisponible pour cet achat.</p>}
        <button type="button" disabled={busy} onClick={() => explain("Si la livraison est comprise dans le prix décidé, gardez ce prix. Aucun poste supplémentaire n’a été créé.")}>Comprendre les frais déjà compris</button>
        <button type="button" disabled={busy} onClick={() => explain("Des frais inconnus ne prouvent pas une livraison gratuite. Si un supplément est certain mais son prix inconnu, préparez un poste distinct en laissant son prix à préciser.")}>Que faire si les frais sont inconnus ?</button>
        <p>Le détail des frais compris et la modalité de livraison ne sont pas enregistrables ici.</p>
      </>}
    </>}
    {row && <form data-delivery-fee-editor={row.id} onSubmit={event => { event.preventDefault(); if (!busy) saveFee(); }}>
      <p>Ce poste s’ajoute au prix de l’achat. Vérifiez qu’il est réellement facturé en plus.</p>
      <label>{row.unitBasis === "SHARED" ? "Montant par lot prévu (€)" : "Prix unitaire prévu (€)"}
        <input autoFocus inputMode="decimal" autoComplete="off" placeholder="Encore inconnu"
          value={row.costMode === "MANUAL" ? row.amount : ""} onChange={event => {
            const amount = event.target.value;
            setRow({ ...row, amount, costMode: amount.trim() ? "MANUAL" : "UNKNOWN", edited: true }); setRaw(true);
          }} /></label>
      <p>{row.existing?.quantity ?? row.quantity} {row.unitBasis === "SHARED" ? "lot(s)" : "unité(s)"} conservé(s).
        {row.costMode === "QUOTE" ? " Devis conservé." : row.costMode === "UNKNOWN" ? " Frais inconnus, à préciser." : " Montant retenu seulement après validation."}</p>
      <button type="submit" disabled={busy || !feesAllowed}>Conserver ces frais</button>
    </form>}
    {notice && <p role="status">{notice}</p>}
    {error && <p role="alert">{error}</p>}
    <button type="button" disabled={busy} onClick={row || scene === "seller" ? openFees : back}>
      {row || scene === "seller" ? "Retour aux frais" : "Retour au résumé de l’achat"}
    </button>
  </section>;
}
