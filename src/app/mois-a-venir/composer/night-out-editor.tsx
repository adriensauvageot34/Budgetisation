"use client";

import { useEffect, useRef, useState } from "react";
import type { ProspectivePersonRef, ProspectivePlaceRef } from "@/domain/phase2/planned-contract";
import { prospectivePersonIdentity } from "@/domain/phase2/planned-product";
import { SOCIAL_CONTACTS_V1 } from "@/domain/phase2/planned-rules";
import { decisionAmount } from "@/domain/phase2/month-decision-contract";
import { declareComponentQuantity } from "@/domain/phase2/planner/component-quantity";
import { assetsForModule, PLANNED_ASSET_CATALOG_VERSION, type PlannedAsset, type PlannedAssetRef } from "@/domain/phase2/planned-assets";
import type { ComponentSelectionV1 } from "@/domain/phase2/planner/component-contract";
import type { PlannedContextState, PlanSemanticStateV1 } from "@/domain/phase2/planner/semantic-state";
import type { ComposerOperation } from "@/domain/phase2/planner/composer-ui-contract";
import type { NightOutBeforeEdit } from "@/domain/phase2/planner/night-out-edit";
import type { CardKnowledgeRead } from "@/domain/phase2/planner/card-knowledge-contract";
import type { PlannerJson } from "@/domain/phase2/planner/json";
import { ContextPalette } from "./context-palette";
import { selectionValues } from "./interactions";
import { PlannedPlaceField } from "../planned-place-field";
import { PlannedContactField } from "../planned-people-fields";
import { CardKnowledgePanel } from "./card-knowledge-panel";
import { useInlineEditRegistry } from "./inline-edit-registry";
import { money } from "./display";
import styles from "./composer.module.css";

type Component = Extract<ComponentSelectionV1, { kind: "COMPONENT" }>;
export type Row = { id: string; existing?: Component; edited: boolean; label: string; quantity: string; unitBasis: "ITEM" | "PERSON" | "SHARED" | "LEGACY_PERSON";
  personCount: string; costMode: "MANUAL" | "UNKNOWN" | "QUOTE"; amount: string; fundingMode: "UNDECIDED" | "BANK" | "EXISTING";
  fundingAmount: string; binding: "AUTO" | "CONFIRMED_CONSUMPTION" | "EXTRA_TO_SLOT" | "NO_RELATED_SLOT"; assetRef?: PlannedAssetRef };
const beforeAssets = assetsForModule("house_party");
const extraAssets = [...assetsForModule("bar"), ...assetsForModule("club")].filter(asset => !/(?:parking|uber_out|uber_back|entry|ticket)$/u.test(asset.assetKey));
const eventAssets = [...assetsForModule("bar"), ...assetsForModule("club")].filter(asset => /(?:entry|ticket)$/u.test(asset.assetKey));
const record = (value: unknown): Record<string, unknown> | null => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
const component = (value: unknown): Component | undefined => {
  const item = record(value);
  return item?.kind === "COMPONENT" ? item as Component : undefined;
};
const items = (context: PlannedContextState, key: string): readonly ComponentSelectionV1[] =>
  (context.slotSelections[key]?.items as ComponentSelectionV1[] | undefined) ?? [];
export const fresh = (label = ""): Row => ({ id: crypto.randomUUID(), edited: true, label, quantity: "1", unitBasis: "ITEM", personCount: "",
  costMode: "UNKNOWN", amount: "", fundingMode: "UNDECIDED", fundingAmount: "", binding: "AUTO" });
export const fromSelection = (selection: Component): Row => ({ id: selection.selectionId, existing: selection, edited: false, label: selection.label,
  quantity: selection.quantityPerPerson ?? selection.quantity, unitBasis: selection.unitBasis === "PERSON" && !selection.quantityPerPerson ? "LEGACY_PERSON" : selection.unitBasis ?? "ITEM",
  personCount: selection.pricedParticipantCount?.toString() ?? "", costMode: selection.cost.kind,
  amount: selection.cost.kind === "MANUAL" ? selection.cost.unitAmount : "",
  fundingMode: selection.fundingAllocations?.some(part => part.source !== "BANK") ? "EXISTING"
    : selection.fundingAllocations?.length ? "BANK" : "UNDECIDED",
  fundingAmount: selection.fundingAllocations?.find(part => part.source === "BANK")?.amount ?? "",
  binding: selection.binding?.mode ?? "AUTO", assetRef: selection.productAssetRef });
const refLabel = (ref: ProspectivePersonRef, persons: readonly { personId: string; displayName: string }[]) =>
  ref.kind === "TEXT" ? ref.label : ref.kind === "HOUSEHOLD_PERSON" ? persons.find(person => person.personId === ref.personId)?.displayName ?? "Personne liée indisponible"
    : SOCIAL_CONTACTS_V1.find(contact => contact.key === ref.contactKey)?.label ?? "Proche lié indisponible";
const isPerson = (value: unknown): value is ProspectivePersonRef => !!record(value) && ["TEXT", "HOUSEHOLD_PERSON", "CONTACT"].includes(String(record(value)?.kind));

export function ComponentRow({ title, row, participantCount, onChange, onRemove, removable = true, bindingChoices = false, productAssets = [], fixedQuantity = false, priceLabel }: {
  title: string; row: Row; participantCount: number; onChange: (row: Row) => void; onRemove: () => void; removable?: boolean; bindingChoices?: boolean;
  productAssets?: readonly PlannedAsset[]; fixedQuantity?: boolean; priceLabel?: string;
}) {
  const update = <K extends keyof Row>(key: K, value: Row[K]) => onChange({ ...row, edited: true, [key]: value });
  return <fieldset className={styles.nightComponent} data-night-component={title}>
    <legend>{title}</legend>
    {row.existing?.provenance === "PERSONAL_SUGGESTION" && <p className={styles.helper}>Suggestion exploratoire : elle ne devient une décision que si vous modifiez et validez ce composant.</p>}
    <div className={styles.nightComponentGrid}>
      {productAssets.length > 0 && <label>Type du catalogue Budgetisation<select value={row.assetRef?.assetKey ?? ""} onChange={event => {
        const asset = productAssets.find(candidate => candidate.assetKey === event.target.value);
        onChange({ ...row, edited: true, assetRef: asset ? { catalogVersion: PLANNED_ASSET_CATALOG_VERSION, assetKey: asset.assetKey,
          labelAtSelection: asset.label, provenance: "EXPLICIT_USER_DECISION" } : undefined,
          label: asset && (!row.label.trim() || ["Bouteille", "Diluant", "Boisson", "Entrée ou activité"].includes(row.label)) ? asset.label : row.label });
      }}><option value="">Libellé libre, sans type lié</option>
        {row.assetRef && !productAssets.some(asset => asset.assetKey === row.assetRef?.assetKey) && <option value={row.assetRef.assetKey}>Référence indisponible · {row.assetRef.labelAtSelection}</option>}
        {productAssets.map(asset => <option key={asset.assetKey} value={asset.assetKey}>{asset.label} · {asset.module === "bar" ? "bar" : asset.module === "club" ? "club" : "before"}</option>)}</select></label>}
      <label>Produit ou activité<input value={row.label} maxLength={120} onChange={event => update("label", event.target.value)} /></label>
      {!fixedQuantity && <><label>Mode de quantité<select value={row.unitBasis} onChange={event => onChange({ ...row, edited: true, unitBasis: event.target.value as Row["unitBasis"],
        personCount: event.target.value === "PERSON" && !row.personCount && participantCount ? String(participantCount) : row.personCount })}>
        <option value="ITEM">Unités au total</option><option value="PERSON">Unités par personne</option><option value="SHARED">Prix partagé / budget global</option>
        {row.existing?.unitBasis === "PERSON" && !row.existing.quantityPerPerson && <option value="LEGACY_PERSON">Quantité totale antérieure · prix individuel</option>}</select></label>
      <label>{row.unitBasis === "PERSON" ? "Unités par personne" : row.unitBasis === "SHARED" ? "Lots partagés (1 pour un budget global)" : "Quantité totale"}
        <input type="number" min="0.01" max="9999" step="0.01" value={row.quantity} onChange={event => update("quantity", event.target.value)} /></label>
      {row.unitBasis === "PERSON" && <label>Personnes concernées<input type="number" min="1" max="50" step="1"
        value={row.personCount} placeholder={participantCount ? String(participantCount) : "À indiquer"}
        onChange={event => update("personCount", event.target.value)} /></label>}
      </>}
      <label>Prix<select value={row.costMode} onChange={event => update("costMode", event.target.value as Row["costMode"])}>
        <option value="UNKNOWN">Encore inconnu</option><option value="MANUAL">Déclaré par moi</option>
        {row.existing?.cost.kind === "QUOTE" && <option value="QUOTE">Conserver le devis</option>}</select></label>
      {row.costMode === "MANUAL" && <label>{priceLabel ?? (row.unitBasis === "SHARED" ? "Montant par lot partagé (€)" : "Prix par unité (€)")}
        <input inputMode="decimal" value={row.amount} onChange={event => update("amount", event.target.value)} /></label>}
      <label>Financement<select value={row.fundingMode} onChange={event => update("fundingMode", event.target.value as Row["fundingMode"])}>
        <option value="UNDECIDED">À préciser</option><option value="BANK">Banque déclarée</option>
        {row.existing?.fundingAllocations?.some(part => part.source !== "BANK") && <option value="EXISTING">Conserver le financement antérieur</option>}</select></label>
      {row.fundingMode === "BANK" && <label>Montant Banque (€)<input inputMode="decimal" value={row.fundingAmount}
        onChange={event => update("fundingAmount", event.target.value)} /></label>}
      {bindingChoices && <label>Relation avec l’habitude du mois<select value={row.binding}
        onChange={event => update("binding", event.target.value as Row["binding"])}>
        <option value="AUTO">Selon l’habitude compatible publiée</option><option value="CONFIRMED_CONSUMPTION">Remplace une occurrence habituelle</option>
        <option value="EXTRA_TO_SLOT">Repas supplémentaire à l’habitude</option><option value="NO_RELATED_SLOT">Sans relation avec l’habitude</option></select></label>}
    </div>
    {productAssets.length > 0 && <p className={styles.helper}>Le type choisi conserve sa référence. Le catalogue ne décide aucun prix, quantité ou financement pour vous.</p>}
    {row.unitBasis === "PERSON" && <p className={styles.helper}>La quantité totale est enregistrée explicitement avec le nombre de personnes retenu ; changer les participants ne multiplie pas silencieusement le prix.</p>}
    {row.unitBasis === "LEGACY_PERSON" && <p className={styles.helper}>Cette ancienne décision contient une quantité totale. Elle est conservée sans multiplication ; choisissez « unités par personne » pour préciser un nouveau nombre de personnes.</p>}
    {removable && <button type="button" className={styles.secondary} onClick={onRemove}>Retirer ce composant</button>}
  </fieldset>;
}

export const buildComponentRow = (row: Row, optionKey: string): Component => {
    if (row.existing && !row.edited && row.existing.optionKey === optionKey) return row.existing;
    if (!row.label.trim()) throw new Error("Indiquez le nom de chaque composant.");
    const count = row.unitBasis === "PERSON" ? Number(row.personCount) : 0;
    if (row.unitBasis === "PERSON" && (!Number.isInteger(count) || count < 1 || count > 50))
      throw new Error("Indiquez le nombre de personnes concernées par le prix individuel.");
    const declaredQuantity = declareComponentQuantity(row.unitBasis === "PERSON" ? "PER_PERSON" : "TOTAL_UNITS",
      row.quantity.trim().replace(",", "."), count);
    if (row.costMode === "MANUAL" && !row.amount.trim()) throw new Error("Indiquez un prix ou choisissez « encore inconnu ».");
    if (row.fundingMode === "BANK" && !row.fundingAmount.trim()) throw new Error("Indiquez le montant Banque déclaré.");
    const cost = row.costMode === "QUOTE" && row.existing?.cost.kind === "QUOTE" ? row.existing.cost
      : row.costMode === "MANUAL" ? { kind: "MANUAL" as const, unitAmount: decisionAmount(row.amount.trim().replace(",", ".")) } : { kind: "UNKNOWN" as const };
    const { quantityEvidenceVersion: _oldVersion, quantityPerPerson: _oldUnits, pricedParticipantCount: _oldCount, productAssetRef: _oldAsset, ...preserved } = row.existing ?? {};
    return { ...preserved, selectionId: row.id, optionKey, kind: "COMPONENT", provenance: "EXPLICIT_USER_DECISION",
      label: row.label.trim(), ...declaredQuantity, unitBasis: row.unitBasis === "LEGACY_PERSON" ? "PERSON" : row.unitBasis, cost,
      ...(row.assetRef ? { productAssetRef: row.assetRef } : {}),
      fundingAllocations: row.fundingMode === "EXISTING" ? row.existing?.fundingAllocations ?? []
        : row.fundingMode === "BANK" ? [{ source: "BANK", amount: decisionAmount(row.fundingAmount.trim().replace(",", ".")) }] : [],
      binding: { mode: row.binding } };
  };

type NightSection = "main" | "participants" | "extras" | "before" | "food" | "details" | "travel" | "palette" | null;
type Equipment = { asset: import("@/domain/phase2/planner/composer-contract").ComposerAssetView; target: import("@/domain/phase2/planner/composer-contract").DropTarget; selection?: ComponentSelectionV1 };
const selectionCaption = (selection: ComponentSelectionV1) => selection.kind === "COMPONENT"
  ? `${selection.label} · ${selection.quantityPerPerson ? `${selection.quantityPerPerson} par personne (${selection.pricedParticipantCount} personnes)` : `${selection.quantity} ${selection.unitBasis === "SHARED" ? "lot(s) partagé(s)" : "unité(s)"}`} · ${selection.cost.kind === "MANUAL" ? money(selection.cost.unitAmount) : selection.cost.kind === "QUOTE" ? "Devis conservé" : "Prix à préciser"}${selection.provenance === "PERSONAL_SUGGESTION" ? " · suggestion non retenue" : ""}`
  : selection.kind === "MOBILITY_INTENT" ? `${({car:"Voiture",train:"Train / tram",bus:"Bus",taxi:"Taxi",free:"Déplacement gratuit déclaré",other:"Autre transport",unknown:"Mode à préciser"} as Record<string,string>)[selection.optionKey] ?? "Transport"} · ${selection.pricing?.fare.kind === "MANUAL" ? money(selection.pricing.fare.unitAmount) : "Prix évalué par Mobility ou à préciser"}`
  : selection.kind === "CHILD_CONTEXT" ? "Moment lié, conservé avec ses propres choix" : "À préciser";

/** A presentation pilot over the existing semantic adapter, not a questionnaire engine. */
export function NightOutEditor({ context, semanticState, householdPersons, knowledge, creating = false, model, card, fresh: isFresh = false, saveStatus = "MEMORY", busy, onSave, onCancel, onOpenChild }: {
  context: PlannedContextState; semanticState: PlanSemanticStateV1;
  householdPersons: readonly { personId: string; displayName: string }[]; knowledge?: CardKnowledgeRead;
  creating?: boolean; model?: import("@/domain/phase2/planner/composer-ui-contract").ComposerUiModel;
  card?: import("@/domain/phase2/planner/composer-contract").ComposerContextCardView; fresh?: boolean;
  saveStatus?: string;
  busy: boolean; onSave: (operation: ComposerOperation) => boolean; onCancel: () => void; onOpenChild?: (id: string) => void;
}) {
  const originalMain = items(context, "main")[0], originalFood = items(context, "food")[0], originalBefore = items(context, "before")[0];
  const beforeChild = originalBefore?.kind === "CHILD_CONTEXT" ? semanticState.contexts.find(c => c.contextOccurrenceId === originalBefore.childContextOccurrenceId) : undefined;
  const originalBottle = beforeChild?.templateKey === "activity" ? component(items(beforeChild, "main")[0]) : component(originalBefore);
  const mainRow = () => originalMain?.kind === "COMPONENT" ? fromSelection(originalMain) : { ...fresh("Entrées et événement"), unitBasis: "SHARED" as const, costMode: "MANUAL" as const };
  const originalPeople = Array.isArray(context.fields.participantRefs) ? context.fields.participantRefs.filter(isPerson) : [];
  const [section, setSection] = useState<NightSection>(creating && originalMain?.kind !== "COMPONENT" ? "main" : null);
  const [main, setMain] = useState<Row>(mainRow), [detailed, setDetailed] = useState(originalMain?.kind === "COMPONENT" && (originalMain.unitBasis !== "SHARED" || !["1", "1.00"].includes(originalMain.quantity)));
  const [participants, setParticipants] = useState<ProspectivePersonRef[]>(originalPeople);
  const [extras, setExtras] = useState<Row[]>(() => items(context, "extras").flatMap(item => item.kind === "COMPONENT" ? [fromSelection(item)] : []));
  const [food, setFood] = useState<Row | null>(() => originalFood?.kind === "COMPONENT" ? fromSelection(originalFood) : null);
  const [foodOption, setFoodOption] = useState(originalFood?.optionKey ?? "restaurant");
  const [beforeEnabled, setBeforeEnabled] = useState(!!originalBefore && originalBefore.kind !== "UNRESOLVED");
  const [bottle, setBottle] = useState<Row>(() => originalBottle ? fromSelection(originalBottle) : { ...fresh("Avant la soirée"), unitBasis:"SHARED", costMode:"MANUAL" });
  const [diluents, setDiluents] = useState<Row[]>(() => beforeChild ? items(beforeChild, "extras").flatMap(item => item.kind === "COMPONENT" ? [fromSelection(item)] : []) : []);
  const [beforeIdentity] = useState(() => ({ child: beforeChild?.contextOccurrenceId ?? crypto.randomUUID(), link: originalBefore?.selectionId ?? crypto.randomUUID(), promoted: crypto.randomUUID() }));
  const [details, setDetails] = useState({ label: String(context.fields.label ?? ""), plannedDate: String(context.fields.plannedDate ?? ""), endDate: String(context.fields.endDate ?? ""), timingNote: String(context.fields.timingNote ?? "") });
  const originalPlace = record(context.fields.placeRef) as ProspectivePlaceRef | null;
  const [place, setPlace] = useState<ProspectivePlaceRef | undefined>(originalPlace ?? undefined);
  const [equipment, setEquipment] = useState<Equipment | null>(null), [formKey, setFormKey] = useState(0);
  const [dirty, setDirty] = useState(false), [error, setError] = useState("");
  const registry = useInlineEditRegistry(), focus = useRef<HTMLElement>(null);
  const reset = () => {
    setMain(mainRow()); setParticipants(originalPeople); setExtras(items(context,"extras").flatMap(item => item.kind === "COMPONENT" ? [fromSelection(item)] : []));
    setFood(originalFood?.kind === "COMPONENT" ? fromSelection(originalFood) : null); setFoodOption(originalFood?.optionKey ?? "restaurant");
    setBeforeEnabled(!!originalBefore && originalBefore.kind !== "UNRESOLVED"); setBottle(originalBottle ? fromSelection(originalBottle) : { ...fresh("Avant la soirée"), unitBasis:"SHARED", costMode:"MANUAL" });
    setDiluents(beforeChild ? items(beforeChild,"extras").flatMap(item => item.kind === "COMPONENT" ? [fromSelection(item)] : []) : []);
    setDetails({label:String(context.fields.label ?? ""),plannedDate:String(context.fields.plannedDate ?? ""),endDate:String(context.fields.endDate ?? ""),timingNote:String(context.fields.timingNote ?? "")});
    setPlace(originalPlace ?? undefined); setEquipment(null); setDirty(false); setError("");
  };
  const discard = useRef(() => {}); discard.current = () => { reset(); setSection(null); };
  useEffect(() => {
    const key = `night-editor:${context.contextOccurrenceId}`;
    registry?.set(key, dirty ? { targetRef:context.contextOccurrenceId, dimension:"night-editor", kind:"RAW", discard:() => discard.current(), flush:() => {} } : null);
    return () => registry?.set(key,null);
  }, [registry,dirty,context.contextOccurrenceId]);
  useEffect(() => { if (section === "main") focus.current?.querySelector<HTMLInputElement>("input")?.focus(); else focus.current?.focus(); }, [section,formKey]);
  const open = (next: NightSection) => {
    if (dirty && !(registry ? registry.confirmDiscard(window.confirm) : window.confirm("Abandonner la saisie non confirmée ?"))) return;
    reset(); setSection(next); setFormKey(key => key + 1);
  };
  const send = (operation: ComposerOperation) => {
    // A false local stage delegates to the existing authoritative server path.
    // It is not a rejection: keep the input until the response installs the Draft,
    // or the shell reports the actual failure. Never announce a false save/error.
    if (!onSave(operation)) { setError(""); return false; }
    registry?.set(`night-editor:${context.contextOccurrenceId}`,null); setDirty(false); setSection(null); setEquipment(null); setError(""); return true;
  };
  const save = () => {
    try {
      const fields: Record<string,PlannerJson> = {}, slots: Record<string, readonly ComponentSelectionV1[]> = {};
      let before: NightOutBeforeEdit | null | undefined;
      if (section === "main") slots.main = [buildComponentRow({...main,edited:true},"main")];
      if (section === "participants") {
        if (participants.some(ref => ref.kind === "TEXT" && !ref.label.trim())) throw Error("Terminez le nom des personnes ou retirez la ligne vide.");
        if (new Set(participants.map(prospectivePersonIdentity)).size !== participants.length) throw Error("Une personne figure plusieurs fois.");
        fields.participantRefs = participants;
      }
      if (section === "extras") slots.extras = [...items(context,"extras").filter(item => item.kind !== "COMPONENT"), ...extras.map(row => buildComponentRow(row,"extra"))];
      if (section === "food" && originalFood?.kind !== "CHILD_CONTEXT") slots.food = food ? [buildComponentRow(food,foodOption)] : [];
      if (section === "before") before = beforeEnabled ? { childContextOccurrenceId:beforeIdentity.child, selectionId:beforeIdentity.link,
        bottle:{...buildComponentRow(bottle,"activity"), ...(originalBefore?.kind === "COMPONENT" ? {selectionId:beforeIdentity.promoted} : {})},
        extras:[...(beforeChild ? items(beforeChild,"extras").filter(item => item.kind !== "COMPONENT") : []), ...diluents.map(row => buildComponentRow(row,"extra"))] } : null;
      if (section === "details") {
        if ([details.plannedDate,details.endDate].some(date => date && !date.startsWith(`${semanticState.targetMonth}-`))) throw Error("Choisissez des dates dans ce mois, ou gardez-les à préciser. Les soirées intermois sont différées.");
        if (details.plannedDate && details.endDate && details.endDate < details.plannedDate) throw Error("La fin doit suivre le début de la soirée.");
        for (const [key,value] of Object.entries(details)) if (value !== String(context.fields[key] ?? "")) fields[key] = value.trim();
        if (JSON.stringify(place ?? null) !== JSON.stringify(originalPlace)) fields.placeRef = place as unknown as PlannerJson ?? "";
      }
      send({kind:"EDIT_NIGHT_OUT",edit:{contextOccurrenceId:context.contextOccurrenceId,fields,slots,...(before === undefined ? {} : {before})}});
    } catch (failure) { const message = failure instanceof Error ? failure.message : "Vérifiez vos choix.";
      setError(({MONTH_DECISION_AMOUNT_INVALID:"Indiquez un montant positif ou nul avec deux décimales au maximum.", PLANNER_QUANTITY_INVALID:"La quantité doit être positive et ne pas dépasser 9 999 unités."} as Record<string,string>)[message] ?? message); }
  };
  const permitted = (slot: string) => !card || !!model?.presentation.sockets[`${context.contextOccurrenceId}:${slot}`]?.canAdd;
  const choose = (asset: Equipment["asset"], target: Equipment["target"], selection?: ComponentSelectionV1) => {
    if (dirty && !registry?.confirmDiscard(window.confirm)) return;
    reset(); setSection("travel"); setEquipment({asset,target,selection}); setFormKey(key => key+1);
  };
  const childButton = (selection: ComponentSelectionV1 | undefined) => selection?.kind === "CHILD_CONTEXT" && <button type="button" className={styles.secondary}
    disabled={!onOpenChild || dirty || busy} onClick={() => onOpenChild?.(selection.childContextOccurrenceId)}>Ouvrir {semanticState.contexts.find(c => c.contextOccurrenceId === selection.childContextOccurrenceId)?.fields.label as string ?? "le moment lié"}</button>;
  const summaryRow = (key: Exclude<NightSection,null>, title: string, lines: readonly string[]) => <button type="button" className={styles.nightSummaryRow} onClick={() => open(key)}>
    <span><strong>{title}</strong>{lines.map((line,index) => <small key={index}>{line}</small>)}</span><span>Modifier</span></button>;
  const currentTransport = equipment?.selection?.kind === "MOBILITY_INTENT" ? equipment.selection : undefined;
  const transportValues = currentTransport ? selectionValues(currentTransport) : {};
  const sameTransport = currentTransport?.optionKey === equipment?.asset.optionKey;
  if (!sameTransport) for (const key of ["amount","funding","fundingAmount","targetIntentId","parkingAmount","parkingMode","preference"]) delete transportValues[key];
  const eventCost = model?.nightOutSummaries?.find(item => item.contextOccurrenceId === context.contextOccurrenceId);
  return <div data-night-out-editor className={`${styles.nightEditor} ${styles.nightRichEditor}`}>
    <div className={styles.nightEditorScroll}>
      {section === null ? <section data-night-summary className={styles.nightSummary}>
        <h3 ref={focus as React.RefObject<HTMLHeadingElement>} tabIndex={-1}>Votre soirée, en un coup d’œil</h3>
        {summaryRow("main","Entrées et événement",items(context,"main").length ? items(context,"main").map(selectionCaption) : ["Budget ou entrée à préciser"])}
        {summaryRow("participants","Participants",originalPeople.length ? originalPeople.map(ref => refLabel(ref,householdPersons)) : ["Non définis · facultatifs"])}
        {summaryRow("extras","Boissons et compléments",items(context,"extras").length ? items(context,"extras").map(selectionCaption) : ["Aucun complément ajouté"])}
        {summaryRow("before","Avant la soirée",originalBefore && originalBefore.kind !== "UNRESOLVED" ? [originalBottle ? selectionCaption(originalBottle) : "Moment lié",...diluents.map(row=>row.label)] : ["Aucune dépense ajoutée"])}
        {summaryRow("food","Repas",originalFood ? [selectionCaption(originalFood)] : ["Aucun repas ajouté"])}
        {summaryRow("travel","Aller et retour",[...(["outbound","return"] as const).map((slot,index) => `${index ? "Retour" : "Aller"} · ${items(context,slot)[0] ? selectionCaption(items(context,slot)[0]) : "Non prévu"}`)])}
        {summaryRow("details","Date, lieu et nom",[context.fields.plannedDate ? String(context.fields.plannedDate) : "Date non renseignée", originalPlace?.kind === "TEXT" ? originalPlace.label : originalPlace?.kind === "KNOWN" ? "Lieu enregistré" : "Lieu non renseigné"])}
        <div className={styles.nightCost} data-night-official-cost><strong>Coût connu de l’événement : {isFresh && eventCost ? money(eventCost.knownAmount) : "Actualisation en cours"}</strong>
          <small>{isFresh && eventCost ? eventCost.incomplete ? "Des composantes restent à préciser. Ce montant n’est pas un total définitif." : "Composantes évaluées par le Compiler, sans coût supplémentaire du parent." : "Vos nouvelles décisions sont conservées ; la simulation autoritaire est en attente."}</small>
          <small>Impact sur le mois : consulter la projection officielle dans le bandeau.</small></div>
        <button type="button" className={styles.secondary} onClick={() => open("palette")}>Ajouter à ma soirée · autres options</button>
      </section> : <section ref={focus} tabIndex={-1} className={styles.nightSection} data-night-section={section} key={formKey} onChangeCapture={() => setDirty(true)}>
        <button type="button" className={styles.secondary} onClick={() => open(null)}>← Résumé de la soirée</button>
        {section === "main" && <><h3>Quel budget pour la soirée ou les entrées ?</h3><p className={styles.helper}>Un seul coût principal. Vous pouvez compléter la soirée plus tard.</p>
          {originalMain?.kind === "CHILD_CONTEXT" ? <>{childButton(originalMain)}<p>Les choix de l’événement lié sont conservés.</p></> : <>
            {!detailed ? <><label>Budget principal (€)<input autoFocus inputMode="decimal" value={main.amount} onChange={event => setMain({...main,edited:true,amount:event.target.value,costMode:"MANUAL"})} /></label>
              <label className={styles.nightCheck}><input type="checkbox" checked={main.costMode === "UNKNOWN"} onChange={event => setMain({...main,edited:true,costMode:event.target.checked ? "UNKNOWN" : "MANUAL"})} />Prix encore inconnu</label></>
              : <ComponentRow title="Entrées et événement" row={main} participantCount={participants.length} productAssets={eventAssets} onChange={setMain} removable={false} onRemove={() => {}} />}
            <button type="button" className={styles.secondary} onClick={() => {
              if (detailed && !window.confirm("Remplacer le détail des entrées par un budget global à préciser ? Les autres composantes restent conservées.")) return;
              setDetailed(!detailed); setDirty(true); if (detailed) setMain({...main,edited:true,unitBasis:"SHARED",quantity:"1",personCount:"",amount:"",costMode:"UNKNOWN"});
            }}>{detailed ? "Revenir à un budget global" : "Détailler les entrées ou le prix par personne"}</button>
            {main.unitBasis === "PERSON" && participants.length !== Number(main.personCount) && <p className={styles.helper}>Les participants et le nombre de personnes tarifées sont distincts. Confirmez ce dernier dans « Personnes concernées » si votre programme change.</p>}
            <button type="button" className={styles.primary} disabled={busy || !permitted("main")} onClick={save}>Confirmer le budget</button></>}
          <CardKnowledgePanel knowledge={knowledge} /></>}
        {section === "participants" && <><h3>Qui participe ?</h3><p className={styles.helper}>Facultatif. Les quantités partagées restent inchangées. Les prix par personne gardent leur nombre tarifé jusqu’à une modification explicite des entrées ou consommations.</p>
          {participants.map((ref,index) => <div key={index} className={styles.nightParticipant}><PlannedContactField label={`Personne ${index+1}`} value={ref} householdPersons={householdPersons} onChange={next => {setParticipants(current => next ? current.map((item,position)=>position===index ? next : item) : current.filter((_,position)=>position!==index));setDirty(true);}} />
            <button type="button" onClick={() => {setParticipants(current=>current.filter((_,position)=>position!==index));setDirty(true);}}>Retirer cette personne</button></div>)}
          <button type="button" className={styles.secondary} onClick={() => {setParticipants(current=>[...current,{kind:"TEXT",label:""}]);setDirty(true);}}>Ajouter une personne</button>
          <button type="button" className={styles.primary} disabled={busy} onClick={save}>Confirmer les participants</button></>}
        {section === "extras" && <><h3>Boissons et compléments</h3><p className={styles.helper}>Ces choix s’ajoutent au budget principal : renseignez uniquement ce qui n’est pas déjà compris. Une bouteille commune utilise un lot partagé, indépendant du nombre de participants.</p>
          {extras.map(row=><ComponentRow key={row.id} title={row.label || "Consommation"} row={row} participantCount={participants.length} productAssets={extraAssets} onChange={next=>setExtras(current=>current.map(item=>item.id===row.id ? next : item))} onRemove={()=>{setExtras(current=>current.filter(item=>item.id!==row.id));setDirty(true);}} />)}
          <button type="button" className={styles.secondary} disabled={!permitted("extras")} onClick={()=>{setExtras(current=>[...current,{...fresh("Consommation"),costMode:"MANUAL"}]);setDirty(true);}}>Ajouter une consommation individuelle</button>
          <button type="button" className={styles.secondary} disabled={!permitted("extras")} onClick={()=>{setExtras(current=>[...current,{...fresh("Bouteille commune"),unitBasis:"SHARED",costMode:"MANUAL"}]);setDirty(true);}}>Ajouter une bouteille partagée</button>
          <button type="button" className={styles.primary} disabled={busy} onClick={save}>Confirmer les boissons et compléments</button></>}
        {section === "before" && <><h3>Prévoir un moment avant la soirée ?</h3><p className={styles.helper}>Facultatif : seuls les éléments retenus ajoutent leur propre coût.</p>
          {beforeChild && beforeChild.templateKey !== "activity" ? <>{childButton(originalBefore)}<p>Ce moment possède son propre éditeur ; ses réponses restent conservées.</p></> : <>
            <label className={styles.nightCheck}><input type="checkbox" checked={beforeEnabled} onChange={event=>{
              if (!event.target.checked && originalBefore && !window.confirm("Retirer le moment avant la soirée et ses composants ? Les entrées, boissons, repas et trajets indépendants seront conservés. Vous pourrez annuler cette décision.")) return;
              setBeforeEnabled(event.target.checked);setDirty(true);
            }} />Prévoir un before</label>
            {beforeEnabled && <><ComponentRow title="Avant la soirée" row={bottle} participantCount={participants.length} productAssets={beforeAssets} onChange={setBottle} removable={false} onRemove={()=>{}} />
              {diluents.map(row=><ComponentRow key={row.id} title="Complément avant la soirée" row={row} participantCount={participants.length} productAssets={beforeAssets} onChange={next=>setDiluents(current=>current.map(item=>item.id===row.id ? next : item))} onRemove={()=>{setDiluents(current=>current.filter(item=>item.id!==row.id));setDirty(true);}} />)}
              <button type="button" className={styles.secondary} onClick={()=>{setDiluents(current=>[...current,fresh("Diluant")]);setDirty(true);}}>Ajouter un diluant ou complément</button></>}
            <button type="button" className={styles.primary} disabled={busy} onClick={save}>Confirmer le moment avant la soirée</button></> }</>}
        {section === "food" && <><h3>Un repas en plus ?</h3>{originalFood?.kind === "CHILD_CONTEXT" ? <>{childButton(originalFood)}<p>Ce repas est un seul objet économique, conservé avec ses propres choix.</p></> : <>
          {food ? <><label>Type de repas<select value={foodOption} onChange={event=>setFoodOption(event.target.value)}>{["restaurant","fast-food","delivery"].filter(option=>!card || model?.library.searchableAssets.some(asset=>asset.assetKey===`option:night-out:food:${option}` && model.dropCapabilities.some(drop=>drop.sourceAssetKey===asset.assetKey && drop.target.contextOccurrenceId===context.contextOccurrenceId && drop.resolution!=="BLOCKED"))).map(option=><option key={option} value={option}>{{restaurant:"Restaurant","fast-food":"Restauration rapide",delivery:"Livraison"}[option]}</option>)}</select></label>
            <ComponentRow title="Repas" row={food} participantCount={participants.length} bindingChoices onChange={setFood} onRemove={()=>{setFood(null);setDirty(true);}} /></>
            : <button type="button" className={styles.secondary} disabled={!permitted("food")} onClick={()=>{setFood({...fresh("Restaurant"),costMode:"MANUAL"});setDirty(true);}}>Ajouter un repas</button>}
          <button type="button" className={styles.primary} disabled={busy} onClick={save}>Confirmer le repas</button></>}</>}
        {section === "details" && <><h3>Nom, date et lieu · facultatifs</h3>{([['label','Nom de la soirée'],['plannedDate','Date'],['endDate','Date de fin'],['timingNote','Repère de temps']] as const).map(([key,title])=><label key={key}>{title}<input type={key.includes('Date') ? 'date' : 'text'} value={details[key]} maxLength={160} onChange={event=>setDetails(current=>({...current,[key]:event.target.value}))} /></label>)}
          <PlannedPlaceField label="Lieu prévu" value={place} places={model?.mobilityOptions?.places ?? []} onChange={next=>{setPlace(next);setDirty(true);}} />
          <button type="button" className={styles.primary} disabled={busy} onClick={save}>Confirmer ces précisions</button></>}
        {(section === "travel" || section === "palette") && <><h3>{section === "travel" ? "Aller et retour indépendants" : "Ajouter à ma soirée"}</h3><p className={styles.helper}>Choisissez seulement les compléments utiles. Un coût d’usage de voiture n’est pas un plein bancaire ; les distances ou tarifs absents restent inconnus.</p>
          {section === "travel" && !equipment && (["outbound","return"] as const).map(slot=><div key={slot}><strong>{slot === "outbound" ? "Aller" : "Retour"}</strong><p>{items(context,slot).map(selectionCaption).join(" · ") || "Aucun trajet ajouté"}</p>
            <div className={styles.nightTravelChoices}>{card && model?.library.searchableAssets.filter(asset=>asset.optionKind==="MOBILITY_INTENT" && asset.assetKey.startsWith(`option:night-out:${slot}:`) && model.dropCapabilities.some(drop=>drop.sourceAssetKey===asset.assetKey && drop.target.contextOccurrenceId===context.contextOccurrenceId && drop.target.slotKey===slot && drop.resolution!=="BLOCKED")).map(asset=><button key={asset.assetKey} type="button" className={styles.secondary} onClick={()=>choose(asset,{kind:"CONTEXT_SOCKET",contextOccurrenceId:context.contextOccurrenceId,slotKey:slot},items(context,slot)[0])}>{asset.label}</button>)}</div>
            {items(context,slot).length>0 && <button type="button" className={styles.secondary} onClick={()=>send({kind:"CLEAR_SOCKET",contextOccurrenceId:context.contextOccurrenceId,slotKey:slot,selectionId:items(context,slot)[0].selectionId})}>Retirer {slot==="outbound" ? "l’aller" : "le retour"}</button>}</div>)}
          {equipment && <form key={formKey} onSubmit={event=>{event.preventDefault();try{send({kind:"DROP",assetKey:equipment.asset.assetKey,target:equipment.target,values:Object.fromEntries(new FormData(event.currentTarget).entries()) as Record<string,string>,identity:crypto.randomUUID(),selectionId:equipment.selection?.selectionId ?? crypto.randomUUID()});}catch{setError("Vérifiez les informations du trajet. Votre saisie est conservée.");}}}>
            <h4>{equipment.target.slotKey === "return" ? "Retour" : "Aller"} · {equipment.asset.label}</h4>
            {!sameTransport && currentTransport && <p>Ce mode remplace le précédent sur ce trajet uniquement. Son ancien prix ne sera pas repris.</p>}
            {model?.editors.find(editor=>editor.assetKey===equipment.asset.assetKey)?.fields.map(field=><label key={field.key}>{field.label}{field.kind==="CHOICE" ? <select name={field.key} defaultValue={transportValues[field.key] ?? field.choices?.[0]?.value ?? ""}>
              {field.choices?.map(choice=><option key={choice.value} value={choice.value}>{choice.label.replace(" · outbound"," · Aller").replace(" · return"," · Retour")}</option>)}{field.key==="funding" && transportValues.funding==="EXISTING" && <option value="EXISTING">Conserver le financement antérieur</option>}</select>
              : <input name={field.key} defaultValue={transportValues[field.key] ?? field.initial ?? ""} inputMode={field.kind==="AMOUNT" ? "decimal" : undefined} />}</label>)}
            <button type="submit" className={styles.primary} disabled={busy}>Confirmer ce trajet</button></form>}
          {section==="palette" && card && model && <ContextPalette card={card} model={model} busy={busy} close={()=>open(null)} choose={(asset,target,selection)=>{
            if(asset.optionKind==="MOBILITY_INTENT"){choose(asset,target,selection);return;}
            if(asset.kind==="CONTEXT_ASSET"){if(target.slotKey && items(context,target.slotKey).some(item=>item.kind!=="UNRESOLVED") && !window.confirm("Remplacer ce choix par un moment lié ? Les autres rubriques seront conservées."))return; send({kind:"DROP",assetKey:asset.assetKey,target,values:{},identity:crypto.randomUUID(),selectionId:crypto.randomUUID()});return;}
            open(target.slotKey==="extras" ? "extras" : target.slotKey==="before" ? "before" : target.slotKey==="food" ? "food" : "main");
          }} />}</>}
      </section>}
    </div>
    {error && <p role="alert" className={styles.formError}>{error}</p>}
    <footer><p className={styles.helper} role="status" data-night-persistence>{dirty ? "Saisie non confirmée · aucun nouveau choix enregistré" : ({SAVED:"Brouillon sauvegardé",SAVING:"Sauvegarde en cours",ERROR:"Erreur de sauvegarde · choix conservés dans cette page",CONFLICT:"Conflit de sauvegarde · version à vérifier",MEMORY:"Brouillon en mémoire"} as Record<string,string>)[saveStatus] ?? "Modifications à sauvegarder"} · {isFresh ? "Projection actualisée" : "Projection à actualiser"}</p><button type="button" className={styles.secondary} disabled={busy} onClick={onCancel}>Retour au mois</button></footer>
  </div>;
}
