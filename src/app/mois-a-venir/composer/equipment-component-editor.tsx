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

/** Presentation adapter only: the existing DROP operation validates/adopts these values. */
export function componentEditorValues(row: Row, original: Record<string,string>): Record<string,string> {
  return {...original,label:row.label,quantity:row.quantity,unitBasis:row.unitBasis==="LEGACY_PERSON"?"PERSON":row.unitBasis,
    personCount:row.personCount,costMode:row.costMode==="UNKNOWN"?"UNKNOWN":"AUTO",amount:row.amount,
    funding:row.fundingMode==="UNDECIDED"?"":row.fundingMode,fundingAmount:row.fundingAmount,binding:row.binding};
}
export function EquipmentComponentEditor({asset,target,model,values,selection,knowledge,busy,host,onValues,onSave,onSummary}:{
  asset:ComposerAssetView;target:DropTarget;model:ComposerUiModel;values:Record<string,string>;
  selection?:Extract<ComponentSelectionV1,{kind:"COMPONENT"}>;knowledge?:CardKnowledgeRead;busy:boolean;host?:HTMLElement|null;
  onValues:(values:Record<string,string>)=>void;onSave:(values:Record<string,string>,component:Extract<ComponentSelectionV1,{kind:"COMPONENT"}>)=>void;onSummary:()=>void;
}) {
  const [error,setError]=useState("");
  const [row,setRow]=useState<Row>(()=>selection?fromSelection(selection):{...fresh(values.label||String(model.semanticState.contexts.find(c=>c.contextOccurrenceId===target.contextOccurrenceId)?.fields.label||asset.label)),
    amount:values.amount??"",costMode:values.amount?.trim()?"MANUAL":"UNKNOWN",quantity:values.quantity||"1"});
  const reference=knowledge?.dimensions.find(d=>d.key==="UNIT_PRICE"&&d.suggestionPolicy==="OFFER_PREFILL"&&d.value!==null);
  return <>
    <details><summary>Repères et provenance</summary><CardKnowledgePanel knowledge={knowledge}/></details>
    <WorkshopComponentRow title={asset.label} row={row} busy={busy} reference={reference?.value?{value:reference.value,caption:reference.sourceAuthority,period:[reference.coverageFrom,reference.coverageTo].filter(Boolean).join(" – ")}:undefined} onChange={next=>{setRow(next);onValues(componentEditorValues(next,values));}}
      onSave={()=>{try{setError("");onSave(componentEditorValues(row,values),buildComponentRow({...row,edited:true},asset.optionKey!));}catch(failure){setError(failure instanceof Error?failure.message:"Vérifiez ce poste. Votre saisie est conservée.");}}} bindingChoices={model.editors.find(e=>e.assetKey===asset.assetKey)?.fields.some(f=>f.key==="binding")}/>
    {error&&<p role="alert">{error}</p>}
    <button type="button" onClick={onSummary}>Retour au résumé</button>
    <WorkshopDock host={host} contextId={target.contextOccurrenceId??""} model={model} busy={busy} choices={[]} choose={()=>{}} summary={onSummary}/>
  </>;
}
