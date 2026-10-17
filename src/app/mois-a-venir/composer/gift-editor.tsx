"use client";

import { useRef, useState } from "react";
import { useWorkshopRaw } from "./inline-edit-registry";
import { useWorkshopQuestion } from "./workshop-choices";
import { SOCIAL_CONTACTS_V1 } from "@/domain/phase2/planned-rules";
import { WorkshopDock } from "./workshop-dock";
import type { ContextPalette } from "./context-palette";
import type { ProspectivePersonRef } from "@/domain/phase2/planned-contract";
import { prospectivePersonLabel } from "@/domain/phase2/planned-product";
import { assetsForModule, PLANNED_ASSET_CATALOG_VERSION, type PlannedAssetRef } from "@/domain/phase2/planned-assets";
import type { ComponentSelectionV1 } from "@/domain/phase2/planner/component-contract";
import type { PlannedContextState } from "@/domain/phase2/planner/semantic-state";
import type { ComposerOperation, ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import { WorkshopComponentRow } from "./workshop-component-row";
import { fresh, fromSelection, buildComponentRow } from "./night-out-components";
import type { CardKnowledgeRead } from "@/domain/phase2/planner/card-knowledge-contract";
import { builderInput } from "../planned-builder-primitives";
import styles from "./composer.module.css";
import { CardKnowledgePanel } from "./card-knowledge-panel";

const occasionChoices = ["Sans occasion particulière", "Anniversaire", "Noël", "Fête ou célébration"];
const giftAssets = assetsForModule("gift").filter(asset => !/(?:delivery_fee|service_fee)$/u.test(asset.assetKey));
const string = (value: unknown): string => typeof value === "string" ? value : "";

export function GiftEditor({ context, householdPersons, knowledge, busy, dockHost, model, choose, onSave, onCancel }: {
  context: PlannedContextState; householdPersons: readonly { personId: string; displayName: string }[];
  knowledge?: CardKnowledgeRead;
  model: ComposerUiModel; choose: Parameters<typeof ContextPalette>[0]["choose"];
  busy: boolean; dockHost?: HTMLElement | null; onSave: (operation: ComposerOperation) => boolean; onCancel: () => void;
}) {
  const existing = (Array.isArray(context.slotSelections.item?.items) ? context.slotSelections.item.items : [])
    .find((entry): entry is ComponentSelectionV1 => !!entry && typeof entry === "object" && !Array.isArray(entry)
      && entry.kind === "COMPONENT" && entry.optionKey === "gift") as Extract<ComponentSelectionV1, { kind: "COMPONENT" }> | undefined;
  const [recipient, setRecipient] = useState<ProspectivePersonRef | undefined>(
    context.fields.recipientRef && typeof context.fields.recipientRef === "object" && !Array.isArray(context.fields.recipientRef)
      ? context.fields.recipientRef as ProspectivePersonRef : undefined);
  const [occasion, setOccasion] = useState(string(context.fields.occasion));
  const rawAssetRef = context.fields.objectAssetRef;
  const existingAssetRef = rawAssetRef && typeof rawAssetRef === "object" && !Array.isArray(rawAssetRef)
    ? rawAssetRef as PlannedAssetRef : undefined;
  const [assetKey, setAssetKey] = useState(existingAssetRef?.assetKey ?? "");
  const [objectLabel, setObjectLabel] = useState(string(context.fields.objectLabel) || (existing?.label === "Cadeau" ? "" : existing?.label) || "");
  const [date, setDate] = useState(string(context.fields.plannedDate));
  const [row, setRow] = useState(() => existing ? fromSelection(existing) : fresh("Cadeau"));
  const [error, setError] = useState("");
  const [section, setSection] = useState<"summary" | "recipient" | "occasion" | "object" | "budget" | "date">("summary");
  const buffer = { recipient, occasion, assetKey, objectLabel, date, row };
  const acceptedBuffer = useRef(buffer), initial = acceptedBuffer.current;
  useWorkshopRaw(context.contextOccurrenceId, JSON.stringify(buffer) !== JSON.stringify(initial), () => {
    setRecipient(initial.recipient); setOccasion(initial.occasion); setAssetKey(initial.assetKey);
    setObjectLabel(initial.objectLabel); setDate(initial.date); setRow(initial.row); setError("");
  });
  const [query,setQuery] = useState("");
  const selectedAsset = giftAssets.find(asset => asset.assetKey === assetKey);
  const save = () => { try {
    if (recipient?.kind === "TEXT" && !recipient.label.trim()) throw Error("Indiquez le nom du destinataire ou retirez cette sélection.");
    const values = { recipientRef: recipient ?? "", occasion: occasion.trim(), plannedDate: date || "", objectLabel: objectLabel.trim(),
      ...(assetKey === (existingAssetRef?.assetKey ?? "") ? {} : { objectAssetRef: assetKey
        ? { catalogVersion: PLANNED_ASSET_CATALOG_VERSION, assetKey, labelAtSelection: selectedAsset?.label ?? "", provenance: "EXPLICIT_USER_DECISION" } : "" }) };
    const patch = Object.fromEntries(Object.entries(values).filter(([key, value]) => JSON.stringify(value || null) !== JSON.stringify(context.fields[key] ?? null)));
    const needsItem = !!existing || !!objectLabel.trim() || section === "budget";
    const item = needsItem ? buildComponentRow({ ...row, label: objectLabel.trim() || "Cadeau",
      edited: row.edited || (objectLabel.trim() || "Cadeau") !== (existing?.label ?? "") }, "gift") : undefined;
    const admitted = item ? onSave({ kind: "EDIT_GIFT", contextOccurrenceId: context.contextOccurrenceId, values: patch, item })
      : !Object.keys(patch).length || onSave({ kind: "EDIT_CONTEXT", contextOccurrenceId: context.contextOccurrenceId, values: patch });
    if (admitted) { acceptedBuffer.current = buffer; setError(""); setSection("summary"); }
    else setError("Ce choix n’a pas été admis. Le brouillon local reste disponible.");
  } catch (failure) { setError(failure instanceof Error && !/^[A-Z_]+$/.test(failure.message) ? failure.message : "Vérifiez le prix, la quantité et le financement. Votre saisie est conservée."); } };
  const match = (label:string) => label.normalize("NFD").replace(/\p{Diacritic}/gu,"").toLowerCase().includes(query.normalize("NFD").replace(/\p{Diacritic}/gu,"").toLowerCase());
  const tile=(key:string,label:string,choose:()=>void,selected=false,hint?:string)=>({key,label,choose,selected,hint,iconKey:"gift"});
  useWorkshopQuestion(section==="object"?{title:"Quel cadeau as-tu en tête ?",search:{value:query,change:setQuery,label:"Rechercher un objet cadeau"},choices:[
    ...giftAssets.filter(asset=>match(asset.label)).map(asset=>tile(asset.assetKey,asset.label,()=>{setAssetKey(asset.assetKey);if(!objectLabel.trim())setObjectLabel(asset.label);},assetKey===asset.assetKey)),
    tile("free","Objet libre",()=>setAssetKey(""),!assetKey,"Le nom reste indépendant de la catégorie"),tile("price","Passer au prix",()=>setSection("budget"))]}
    :section==="occasion"?{title:"Quelle occasion ?",choices:[...occasionChoices.map(label=>tile(label,label,()=>setOccasion(label),occasion===label)),tile("other","Autre occasion",()=>setOccasion("")),tile("summary","Résumé",()=>setSection("summary"))]}
    :section==="recipient"?{title:"Pour qui ?",search:{value:query,change:setQuery,label:"Rechercher un destinataire"},choices:[
      ...householdPersons.filter(p=>match(p.displayName)).map(p=>tile(p.personId,p.displayName,()=>setRecipient({kind:"HOUSEHOLD_PERSON",personId:p.personId}))),
      ...SOCIAL_CONTACTS_V1.filter(p=>match(p.label)).map(p=>tile(p.key,p.label,()=>setRecipient({kind:"CONTACT",contactKey:p.key}))),
      tile("text","Autre personne",()=>setRecipient({kind:"TEXT",label:""})),tile("later","Plus tard",()=>setRecipient(undefined))]}:null);
  return <form data-gift-editor className={styles.nightEditor} onSubmit={event => { event.preventDefault(); save(); }}>
    {section === "summary" && <section className={styles.nightSection} data-gift-summary><h3>{objectLabel || "Cadeau à préciser"}</h3>
      <p>Le cadeau reste dans votre brouillon, même si sa date ou son prix sont inconnus.</p>
      {recipient && <p>Destinataire : {recipient.kind === "HOUSEHOLD_PERSON" ? householdPersons.find(person => person.personId === recipient.personId)?.displayName ?? "Personne indisponible" : prospectivePersonLabel(recipient) ?? "Contact indisponible"}</p>}
      {occasion && <p>Occasion : {occasion}</p>}
      {existing && <p>Prix : {existing.cost.kind === "MANUAL" ? `${existing.cost.unitAmount} €` : "inconnu ou devis conservé"}</p>}
      <div className={styles.restaurantSummaryActions}><button type="button" className={styles.primary} onClick={() => setSection("object")}>Choisir l’objet</button>
        <button type="button" onClick={() => setSection("budget")}>Préciser le prix</button></div></section>}
    {section === "budget" && <details><summary>Repères historiques · ne décident aucun prix</summary><CardKnowledgePanel knowledge={knowledge} /></details>}
    {section !== "summary" && <p className={styles.helper}>Le coût provient uniquement de l’objet et de ses éventuels compléments.</p>}
    <div className={styles.formFields}>
      {section === "recipient" && <label>Destinataire{recipient?.kind==="TEXT"?<input value={recipient.label} onChange={event=>setRecipient({kind:"TEXT",label:event.target.value})} placeholder="Nom libre"/>:<p>{recipient?prospectivePersonLabel(recipient)??householdPersons.find(p=>p.personId===(recipient.kind==="HOUSEHOLD_PERSON"?recipient.personId:""))?.displayName:"Choisis une personne dans le dock, ou laisse inconnu."}</p>}</label>}
      {section === "occasion" && <label>Occasion choisie<input className={builderInput} value={occasion} onChange={event=>setOccasion(event.target.value)} maxLength={120} placeholder="Choisir dans le dock ou saisir" /></label>}
      {section === "object" && <>
      <p>{selectedAsset?"Type choisi : "+selectedAsset.label:"Aucune classification imposée · choisis une tuile ou un nom libre."}</p>
      {assetKey && !selectedAsset && <p role="status" className={styles.helper}>Cette référence de catalogue n’est plus disponible. Elle reste conservée tant que vous ne choisissez pas un autre type.</p>}
      <label>Quel objet ou produit ?<input value={objectLabel} onChange={event => setObjectLabel(event.target.value)} maxLength={120} /></label></>}
      {section === "date" && <label>Date prévue (facultative)<input type="date" value={date} onChange={event => setDate(event.target.value)} /></label>}
      {section === "budget" && <WorkshopComponentRow title="Cadeau" row={{ ...row, label: objectLabel || row.label }} onChange={next => {
        if (next.label !== (objectLabel || row.label)) setObjectLabel(next.label);
        setRow(next);
      }} onSave={save} busy={busy} participantCount={0} />}
    </div>
    {error && <p role="alert" className={styles.formError}>{error}</p>}
    <footer><button type="button" className={styles.secondary} disabled={busy} onClick={section === "summary" ? onCancel : () => setSection("summary")}>{section === "summary" ? "Retour au mois" : "Retour au résumé"}</button>
      {section !== "budget" && <button data-submit className={styles.primary} disabled={busy}>{objectLabel.trim() ? "Conserver et prévisualiser" : "Conserver cette intention"}</button>}</footer>
    <WorkshopDock host={dockHost} contextId={context.contextOccurrenceId} model={model} busy={busy} choose={choose} summary={() => setSection("summary")}
      choices={(["summary", "recipient", "occasion", "object", "budget", "date"] as const).map(key => ({ key,
        label: ({ summary: "Résumé", recipient: "Destinataire", occasion: "Occasion", object: "Objet", budget: "Prix", date: "Date" } as const)[key],
        iconKey: "gift", selected: section === key, choose: () => setSection(key) }))} />
  </form>;
}
