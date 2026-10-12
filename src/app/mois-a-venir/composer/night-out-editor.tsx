"use client";

import { useRef, useState } from "react";
import type { ProspectivePersonRef, ProspectivePlaceRef } from "@/domain/phase2/planned-contract";
import { prospectivePersonIdentity } from "@/domain/phase2/planned-product";
import { decisionAmount } from "@/domain/phase2/month-decision-contract";
import { declareComponentQuantity } from "@/domain/phase2/planner/component-quantity";
import { assetsForModule, PLANNED_ASSET_CATALOG_VERSION, type PlannedAsset, type PlannedAssetRef } from "@/domain/phase2/planned-assets";
import type { ComponentSelectionV1 } from "@/domain/phase2/planner/component-contract";
import type { PlannedContextState, PlanSemanticStateV1 } from "@/domain/phase2/planner/semantic-state";
import type { ComposerOperation } from "@/domain/phase2/planner/composer-ui-contract";
import type { NightOutBeforeEdit } from "@/domain/phase2/planner/night-out-edit";
import type { CardKnowledgeRead } from "@/domain/phase2/planner/card-knowledge-contract";
import type { PlannerJson } from "@/domain/phase2/planner/json";
import { PlannedContactField } from "../planned-people-fields";
import { CardKnowledgePanel } from "./card-knowledge-panel";
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
    : ref.contactKey;
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

export function NightOutEditor({ context, semanticState, householdPersons, knowledge, busy, onSave, onCancel }: {
  context: PlannedContextState; semanticState: PlanSemanticStateV1;
  householdPersons: readonly { personId: string; displayName: string }[]; knowledge?: CardKnowledgeRead;
  busy: boolean; onSave: (operation: ComposerOperation) => void; onCancel: () => void;
}) {
  const originalBefore = items(context, "before")[0];
  const beforeChild = originalBefore?.kind === "CHILD_CONTEXT"
    ? semanticState.contexts.find(c => c.contextOccurrenceId === originalBefore.childContextOccurrenceId && c.templateKey === "activity") : undefined;
  const originalBottle = beforeChild ? component(items(beforeChild, "main")[0]) : originalBefore?.kind === "COMPONENT" ? originalBefore : undefined;
  const [label, setLabel] = useState(typeof context.fields.label === "string" ? context.fields.label : "");
  const [plannedDate, setPlannedDate] = useState(typeof context.fields.plannedDate === "string" ? context.fields.plannedDate : "");
  const [endDate, setEndDate] = useState(typeof context.fields.endDate === "string" ? context.fields.endDate : "");
  const [timingNote, setTimingNote] = useState(typeof context.fields.timingNote === "string" ? context.fields.timingNote : "");
  const [participants, setParticipants] = useState<ProspectivePersonRef[]>(Array.isArray(context.fields.participantRefs)
    ? context.fields.participantRefs.filter(isPerson) : []);
  const originalPlace = record(context.fields.placeRef) as ProspectivePlaceRef | null;
  const [placeMode, setPlaceMode] = useState(originalPlace?.kind === "KNOWN" ? "KNOWN" : originalPlace?.kind === "TEXT" ? "TEXT" : "UNKNOWN");
  const [placeText, setPlaceText] = useState(originalPlace?.kind === "TEXT" ? originalPlace.label : "");
  const [beforeEnabled, setBeforeEnabled] = useState(!!originalBottle);
  const [bottle, setBottle] = useState<Row>(() => originalBottle ? fromSelection(originalBottle) : fresh("Bouteille"));
  const [diluents, setDiluents] = useState<Row[]>(beforeChild ? items(beforeChild, "extras").flatMap(item => item.kind === "COMPONENT" ? [fromSelection(item)] : []) : []);
  const [beforeDirty, setBeforeDirty] = useState(false);
  const existingMain = items(context, "main")[0];
  const [main, setMain] = useState<Row | null>(existingMain?.kind === "COMPONENT" ? fromSelection(existingMain) : null);
  const [mainDirty, setMainDirty] = useState(false);
  const existingFood = items(context, "food")[0];
  const [food, setFood] = useState<{ optionKey: string; row: Row } | null>(existingFood?.kind === "COMPONENT" ? { optionKey: existingFood.optionKey, row: fromSelection(existingFood) } : null);
  const [foodDirty, setFoodDirty] = useState(false);
  const [extras, setExtras] = useState<Row[]>(items(context, "extras").flatMap(item => item.kind === "COMPONENT" ? [fromSelection(item)] : []));
  const [extrasDirty, setExtrasDirty] = useState(false);
  const [error, setError] = useState("");
  const scroll = useRef<HTMLDivElement>(null);
  const changeRow = (rows: Row[], setRows: (rows: Row[]) => void, id: string, updated: Row) => setRows(rows.map(row => row.id === id ? updated : row));
  const build = buildComponentRow;
  const save = () => {
    try {
      setError("");
      if (participants.some(ref => ref.kind === "TEXT" && !ref.label.trim())) throw new Error("Terminez le nom des participants ou retirez la ligne vide.");
      if (new Set(participants.map(prospectivePersonIdentity)).size !== participants.length) throw new Error("Un participant figure plusieurs fois.");
      if (placeMode === "TEXT" && !placeText.trim()) throw new Error("Indiquez le lieu ou sélectionnez « à préciser ».");
      if ([plannedDate, endDate].some(date => date && !date.startsWith(`${semanticState.targetMonth}-`)))
        throw new Error("Les dates doivent rester dans le mois composé. Les soirées intermois restent à préciser.");
      if (plannedDate && endDate && endDate < plannedDate) throw new Error("La fin de la soirée doit suivre son début.");
      const fields: Record<string, PlannerJson> = {};
      for (const [key, value] of Object.entries({ label: label.trim(), plannedDate, endDate, timingNote: timingNote.trim() })) {
        if (value !== (typeof context.fields[key] === "string" ? context.fields[key] : "")) fields[key] = value;
      }
      if (JSON.stringify(participants) !== JSON.stringify(Array.isArray(context.fields.participantRefs) ? context.fields.participantRefs : [])) fields.participantRefs = participants;
      const nextPlace = placeMode === "KNOWN" ? originalPlace : placeMode === "TEXT"
        ? { kind: "TEXT" as const, label: placeText.trim(), provenance: "USER_DECLARED_PROSPECTIVE" as const } : null;
      if (JSON.stringify(nextPlace) !== JSON.stringify(originalPlace)) fields.placeRef = nextPlace ?? "";
      const slots: Record<string, readonly ComponentSelectionV1[]> = {};
      if (mainDirty) slots.main = main ? [build(main, "main")] : [];
      if (foodDirty) slots.food = food ? [build(food.row, food.optionKey)] : [];
      if (extrasDirty) slots.extras = extras.map(row => build(row, "extra"));
      let before: NightOutBeforeEdit | null | undefined;
      if (beforeDirty) before = beforeEnabled ? {
        childContextOccurrenceId: beforeChild?.contextOccurrenceId ?? crypto.randomUUID(),
        selectionId: originalBefore?.selectionId ?? crypto.randomUUID(),
        bottle: { ...build(bottle, "activity"), ...(originalBefore?.kind === "COMPONENT" && !beforeChild ? { selectionId: crypto.randomUUID() } : {}) },
        extras: diluents.map(row => build(row, "extra")) } : null;
      onSave({ kind: "EDIT_NIGHT_OUT", edit: { contextOccurrenceId: context.contextOccurrenceId, fields, slots,
        ...(before === undefined ? {} : { before }) } });
    } catch (failure) { setError(failure instanceof Error ? failure.message === "MONTH_DECISION_AMOUNT_INVALID"
      ? "Renseignez un nombre positif ou nul, avec deux décimales au maximum."
      : failure.message === "PLANNER_QUANTITY_INVALID" ? "La quantité totale doit être positive et ne pas dépasser 9 999 unités."
      : failure.message === "COMPOSER_CONTEXT_LOCKED" ? "Ce moment est préservé. Libérez-le avant de modifier ses composants."
      : failure.message === "CONTEXT_PRODUCT_ASSET_UNKNOWN" ? "Le type sélectionné n’est plus disponible dans le catalogue. Choisissez un type actuel ou un libellé libre."
      : failure.message : "Vérifiez les choix de la soirée."); }
  };
  return <div data-night-out-editor className={styles.nightEditor}>
    <CardKnowledgePanel knowledge={knowledge} />
    <p className={styles.helper}>La soirée regroupe ses composants ; elle n’ajoute aucun coût propre. Les suggestions restent exploratoires jusqu’à votre validation.</p>
    <nav className={styles.nightNav} aria-label="Sections de la soirée">{[["context", "Participants"], ["before", "Before"], ["main", "Activité et repas"], ["extras", "Boissons"], ["travel", "Transports"]].map(([key, label]) =>
      <button type="button" key={key} onClick={() => {
        const section = scroll.current?.querySelector<HTMLElement>(`[data-night-section="${key}"]`);
        section?.scrollIntoView({ block: "start" }); section?.focus({ preventScroll: true });
      }}>{label}</button>)}</nav>
    <div ref={scroll} className={styles.nightEditorScroll}>
      <section className={styles.nightSection} data-night-section="context" tabIndex={-1}><h3>Qui, où et quand ?</h3>
        <div className={styles.nightComponentGrid}>
          <label>Nom de la soirée<input value={label} onChange={event => setLabel(event.target.value)} maxLength={120} /></label>
          <label>Date (facultative)<input type="date" value={plannedDate} onChange={event => setPlannedDate(event.target.value)} /></label>
          <label>Date de fin (facultative)<input type="date" value={endDate} onChange={event => setEndDate(event.target.value)} /></label>
          <label>Lieu<select value={placeMode} onChange={event => setPlaceMode(event.target.value)}>
            <option value="UNKNOWN">À préciser</option>{originalPlace?.kind === "KNOWN" && <option value="KNOWN">Conserver le lieu lié</option>}
            <option value="TEXT">Saisir un lieu</option></select></label>
          {placeMode === "TEXT" && <label>Lieu prévu<input value={placeText} onChange={event => setPlaceText(event.target.value)} maxLength={160} /></label>}
          <label>Repère de temps<input value={timingNote} onChange={event => setTimingNote(event.target.value)} maxLength={160} placeholder="Par exemple : après le dîner" /></label>
        </div>
        <div className={styles.nightParticipants}><h4>Participants</h4>
          {participants.map((ref, index) => <div key={index} className={styles.nightParticipant}>
            <PlannedContactField label={`Personne ${index + 1}`} value={ref} householdPersons={householdPersons}
              onChange={next => setParticipants(current => next ? current.map((item, position) => position === index ? next : item) : current.filter((_, position) => position !== index))} />
            <button type="button" className={styles.secondary} onClick={() => setParticipants(current => current.filter((_, position) => position !== index))}>Retirer {refLabel(ref, householdPersons)}</button>
          </div>)}
          <button type="button" className={styles.secondary} onClick={() => setParticipants(current => [...current, { kind: "TEXT", label: "" }])}>Ajouter une personne</button>
        </div>
      </section>
      <section className={styles.nightSection} data-night-section="before" tabIndex={-1}><h3>Before</h3>
        <p className={styles.helper}>Bouteille et diluant sont deux composants distincts d’une activité enfant autorisée.</p>
        {originalBefore?.kind === "CHILD_CONTEXT" && !beforeChild && <p role="alert">Le before lié n’est plus disponible. Il reste conservé tant que vous ne le modifiez pas.</p>}
        <label className={styles.nightCheck}><input type="checkbox" checked={beforeEnabled} onChange={event => { setBeforeEnabled(event.target.checked); setBeforeDirty(true); }} /> Préparer un before</label>
        {beforeEnabled && <><ComponentRow title="Bouteille ou élément principal" row={bottle} participantCount={participants.length} productAssets={beforeAssets}
          onChange={row => { setBottle(row); setBeforeDirty(true); }} onRemove={() => { setBeforeEnabled(false); setBeforeDirty(true); }} />
          {diluents.map(row => <ComponentRow key={row.id} title="Diluant ou complément" row={row} participantCount={participants.length} productAssets={beforeAssets}
            onChange={next => { changeRow(diluents, setDiluents, row.id, next); setBeforeDirty(true); }}
            onRemove={() => { setDiluents(current => current.filter(item => item.id !== row.id)); setBeforeDirty(true); }} />)}
          <button type="button" className={styles.secondary} onClick={() => { setDiluents(current => [...current, fresh("Diluant")]); setBeforeDirty(true); }}>Ajouter un diluant ou complément</button></>}
      </section>
      <section className={styles.nightSection} data-night-section="main" tabIndex={-1}><h3>Activité principale et repas</h3>
        {existingMain?.kind === "CHILD_CONTEXT" ? <p className={styles.helper}>L’activité enfant reste liée et se configure avec ses propres équipements R6 après fermeture.</p>
          : main ? <ComponentRow title="Entrée ou activité" row={main} participantCount={participants.length} productAssets={eventAssets}
            onChange={row => { setMain(row); setMainDirty(true); }} onRemove={() => { setMain(null); setMainDirty(true); }} />
          : <button type="button" className={styles.secondary} onClick={() => { setMain(fresh("Entrée ou activité")); setMainDirty(true); }}>Ajouter une entrée ou activité</button>}
        {existingFood?.kind === "CHILD_CONTEXT" ? <p className={styles.helper}>Le repas enfant reste lié et se configure avec ses propres équipements R6 après fermeture.</p>
          : food ? <><label>Type de repas<select value={food.optionKey} onChange={event => { setFood({ ...food, optionKey: event.target.value }); setFoodDirty(true); }}>
            <option value="restaurant">Restaurant</option><option value="fast-food">Restauration rapide</option><option value="delivery">Livraison</option></select></label>
            <ComponentRow title="Repas" row={food.row} participantCount={participants.length} bindingChoices
              onChange={row => { setFood({ ...food, row }); setFoodDirty(true); }} onRemove={() => { setFood(null); setFoodDirty(true); }} /></>
          : <button type="button" className={styles.secondary} onClick={() => { setFood({ optionKey: "restaurant", row: fresh("Restaurant") }); setFoodDirty(true); }}>Ajouter un repas</button>}
      </section>
      <section className={styles.nightSection} data-night-section="extras" tabIndex={-1}><h3>Boissons et autres extras</h3>
        <p className={styles.helper}>Choisissez des unités au total, par personne ou partagées. Un budget global utilise une seule unité. Aucun prix historique n’est appliqué automatiquement.</p>
        {extras.map(row => <ComponentRow key={row.id} title="Boisson ou extra" row={row} participantCount={participants.length} productAssets={extraAssets}
          onChange={next => { changeRow(extras, setExtras, row.id, next); setExtrasDirty(true); }}
          onRemove={() => { setExtras(current => current.filter(item => item.id !== row.id)); setExtrasDirty(true); }} />)}
        <button type="button" className={styles.secondary} onClick={() => { setExtras(current => [...current, fresh("Boisson")]); setExtrasDirty(true); }}>Ajouter une boisson ou un extra</button>
      </section>
      <section className={styles.nightSection} data-night-section="travel" tabIndex={-1}><h3>Aller et retour</h3>
        <p className={styles.helper}>Les transports se choisissent séparément dans les équipements en bas de la carte Soirée. Un retour ne remplace pas l’aller. Le prix reste évalué par Mobility/Compiler.</p>
        <p>{items(context, "outbound").length ? "Aller configuré" : "Aller à préciser"} · {items(context, "return").length ? "Retour configuré" : "Retour à préciser"}</p>
      </section>
    </div>
    {error && <p role="alert" className={styles.formError}>{error}</p>}
    <footer><button type="button" className={styles.secondary} disabled={busy} onClick={onCancel}>Retour au mois</button>
      <button type="button" data-night-save className={styles.primary} disabled={busy} onClick={save}>Prévisualiser la soirée</button></footer>
  </div>;
}
