"use client";
import { useState } from "react";
import type { ComponentSelectionV1 } from "@/domain/phase2/planner/component-contract";
import type { ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import type { ComposerAssetView, DropTarget } from "@/domain/phase2/planner/composer-contract";
import { fresh, fromSelection, buildComponentRow, type Row } from "./night-out-components";
import { WorkshopComponentRow } from "./workshop-component-row";
import { CardKnowledgePanel } from "./card-knowledge-panel";
import type { CardKnowledgeRead } from "@/domain/phase2/planner/card-knowledge-contract";
import { WorkshopDock } from "./workshop-dock";
import { editMascaraPriceAndQuantity } from "./mascara-edit";
import styles from "./composer.module.css";

/** Presentation adapter only: the existing DROP operation validates/adopts these values. */
export function componentEditorValues(row: Row, original: Record<string,string>): Record<string,string> {
  return {...original,label:row.label,quantity:row.quantity,unitBasis:row.unitBasis==="LEGACY_PERSON"?"PERSON":row.unitBasis,
    personCount:row.personCount,costMode:row.costMode==="UNKNOWN"?"UNKNOWN":"AUTO",amount:row.amount.trim().replace(",","."),
    funding:row.fundingMode==="UNDECIDED"?"":row.fundingMode,fundingAmount:row.fundingAmount,binding:row.binding};
}
export function EquipmentComponentEditor({asset,target,model,values,selection,knowledge,busy,host,mascara=false,onValues,onSave,onSummary}:{
  asset:ComposerAssetView;target:DropTarget;model:ComposerUiModel;values:Record<string,string>;
  selection?:Extract<ComponentSelectionV1,{kind:"COMPONENT"}>;knowledge?:CardKnowledgeRead;busy:boolean;host?:HTMLElement|null;mascara?:boolean;
  onValues:(values:Record<string,string>)=>void;onSave:(values:Record<string,string>,component:Extract<ComponentSelectionV1,{kind:"COMPONENT"}>)=>void;onSummary:()=>void;
}) {
  const [error,setError]=useState("");
  const [advanced,setAdvanced]=useState(false);
  const [row,setRow]=useState<Row>(()=>{
    if (selection) {
      const selected = fromSelection(selection);
      return mascara ? { ...selected, amount: selected.amount.replace(".", ","), quantity: selected.quantity.replace(".", ",") } : selected;
    }
    return {...fresh(values.label||String(model.semanticState.contexts.find(c=>c.contextOccurrenceId===target.contextOccurrenceId)?.fields.label||asset.label)),
      amount:values.amount??"",costMode:values.amount?.trim()?"MANUAL":"UNKNOWN",quantity:values.quantity||"1"};
  });
  const shortSelection = mascara && selection && !advanced && (!selection.unitBasis || selection.unitBasis === "ITEM") ? selection : undefined;
  const reference=mascara?undefined:knowledge?.dimensions.find(d=>d.key==="UNIT_PRICE"&&d.suggestionPolicy==="OFFER_PREFILL"&&d.value!==null);
  const update = (next: Row) => {setRow(next);onValues(componentEditorValues(next,values));};
  const save = () => {
    try {
      setError("");
      const component = shortSelection ? editMascaraPriceAndQuantity(shortSelection, row.quantity, row.amount, row.costMode)
        : buildComponentRow({...row,edited:mascara?row.edited:true},asset.optionKey!);
      onSave(componentEditorValues(row,values),component);
    } catch(failure) {setError(failure instanceof Error?failure.message:"Vérifiez ce poste. Votre saisie est conservée.");}
  };
  return <>
    {mascara ? <section className={styles.nightSection} data-mascara-reference aria-label="Prix historique">
      <strong>Prix historique · repère uniquement</strong><p>Aucun prix historique daté et rattaché à ce produit n’est publié.</p>
    </section> : <details><summary>Repères et provenance</summary><CardKnowledgePanel knowledge={knowledge}/></details>}
    {shortSelection ? <form className={styles.nightSection} data-mascara-price-editor={shortSelection.selectionId} onSubmit={event => {event.preventDefault(); if (!busy) save();}}>
      <div className={styles.formFields}>
        <label>Prix unitaire prévu (€)<input autoFocus inputMode="decimal" autoComplete="off" placeholder="Encore inconnu"
          value={row.amount} onChange={event => {
            const amount = event.target.value;
            update({ ...row, amount, costMode: amount.trim() ? "MANUAL" : "UNKNOWN", edited: true });
          }}/></label>
        <label>Quantité totale<input inputMode="decimal" autoComplete="off" value={row.quantity}
          onChange={event => update({ ...row, quantity: event.target.value, edited: true })}/></label>
      </div>
      <p className={styles.helper}>{row.costMode === "QUOTE" ? "Devis conservé tant que vous ne saisissez pas un autre prix."
        : row.costMode === "UNKNOWN" ? "Prix à préciser. Un champ vide garde le prix inconnu." : "Le prix sera retenu dans le brouillon à la validation."}</p>
      <button className={styles.primary} type="submit" disabled={busy}>Conserver ce poste</button>
      <button className={styles.nightLink} type="button" disabled={busy} onClick={() => setAdvanced(true)}>Autres réglages du produit</button>
    </form> : <WorkshopComponentRow title={asset.label} row={row} busy={busy}
      reference={reference?.value?{value:reference.value,caption:reference.sourceAuthority,period:[reference.coverageFrom,reference.coverageTo].filter(Boolean).join(" – ")}:undefined}
      onChange={update} onSave={save} bindingChoices={model.editors.find(e=>e.assetKey===asset.assetKey)?.fields.some(f=>f.key==="binding")}/>}
    {error&&<p role="alert">{error}</p>}
    <button type="button" onClick={onSummary}>Retour au résumé</button>
    <WorkshopDock host={host} contextId={target.contextOccurrenceId??""} model={model} busy={busy} choices={[]} choose={()=>{}} summary={onSummary}/>
  </>;
}
