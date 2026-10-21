import "server-only";
import Big from "big.js";
import type { MonthComposerReadModel } from "@/domain/phase2/planner/composer-contract";
import {componentPresentationGroups,type ComponentGroupProjection} from '@/domain/phase2/planner/component-group-presentation';
import type {ComponentSelectionV1} from '@/domain/phase2/planner/component-contract';
import {componentId} from '@/domain/phase2/planner/identity';

/** Roll up already evaluated Compiler facts. Never re-price a selection. */
export function nightOutComponentGroups(model:MonthComposerReadModel):ComponentGroupProjection[]{
  const contexts=model.semanticState.contexts;
  const owners=new Set(contexts.filter(c=>c.templateKey==='night-out').map(c=>c.contextOccurrenceId));
  for(let size=-1;size!==owners.size;){size=owners.size;for(const c of contexts)if(c.parentContextOccurrenceId&&owners.has(c.parentContextOccurrenceId))owners.add(c.contextOccurrenceId);}
  const compiled=new Map(model.preview.compiled.components.map(c=>[c.componentId,c]));
  return contexts.filter(c=>owners.has(c.contextOccurrenceId)).flatMap(context=>{
    const slots=Object.entries(context.slotSelections).map(([slotKey,slot])=>({slotKey,items:Array.isArray(slot.items)?slot.items as readonly ComponentSelectionV1[]:[]}));
    const parent=contexts.find(c=>c.contextOccurrenceId===context.parentContextOccurrenceId);
    const beforeItems=parent?.templateKey==='night-out'&&Array.isArray(parent.slotSelections.before?.items)&&parent.slotSelections.before.items.some(i=>i&&typeof i==='object'&&!Array.isArray(i)&&i.kind==='CHILD_CONTEXT'&&i.childContextOccurrenceId===context.contextOccurrenceId)
      ?slots.filter(s=>s.slotKey==='main'||s.slotKey==='extras'):[];
    const sourceSlots=new Map(slots.flatMap(s=>s.items.map(i=>[i.selectionId,s.slotKey] as const)));
    return [...slots,...(beforeItems.length?[{slotKey:'$before',items:beforeItems.flatMap(s=>s.items)}]:[])].flatMap(({slotKey,items})=>{
    const slot={items};
    if(!Array.isArray(slot.items))return [];
    return componentPresentationGroups(slot.items as readonly ComponentSelectionV1[]).map(group=>{
      const lines=group.items.map(item=>compiled.get(componentId(context.contextOccurrenceId,slotKey==='$before'?sourceSlots.get(item.selectionId)!:slotKey,item.selectionId)));
      const amounts=lines.map(line=>line?.selectionProvenance!=='PERSONAL_SUGGESTION'?line?.evaluation.economicAmount??null:null);
      const known=amounts.filter((v):v is string=>v!==null);
      const components=group.items.filter(item=>item.kind==='COMPONENT');
      return {contextOccurrenceId:context.contextOccurrenceId,slotKey,groupKey:group.key,selectionIds:group.items.map(i=>i.selectionId),semanticStateDigest:model.preview.semanticStateDigest,
        quantity:components.length===group.items.length?components.reduce((sum,item)=>sum.plus(item.quantity),new Big(0)).toString():null,
        unitBasis:components[0]?.unitBasis??'ITEM',knownAmount:known.length?known.reduce((sum,v)=>sum.plus(v),new Big(0)).toFixed(2):null,
        incomplete:amounts.some(v=>v===null)};
    });
  });});
}

/** Presentation of the Compiler's existing evaluations, with one physical journey per owner.
 * No pricing, source read, participant conversion, binding or financial projection occurs here. */
export function nightOutSummaries(model: MonthComposerReadModel) {
  const compiled = model.preview.compiled;
  return model.semanticState.contexts.filter(context => context.templateKey === "night-out").map(context => {
    const ids = new Set([context.contextOccurrenceId]);
    for (let size = -1; size !== ids.size;) { size = ids.size;
      for (const child of model.semanticState.contexts) if (child.parentContextOccurrenceId && ids.has(child.parentContextOccurrenceId)) ids.add(child.contextOccurrenceId);
    }
    const journeys = compiled.journeys.filter(journey => ids.has(journey.ownerContextOccurrenceId) && !journey.externalExpenseId);
    const journeyIds = new Set(journeys.map(journey => journey.physicalJourneyRequirementId));
    const amounts = compiled.components.filter(component => component.selectionProvenance !== "PERSONAL_SUGGESTION"
      && (component.contextOccurrenceId !== null && ids.has(component.contextOccurrenceId)
        || !!component.physicalJourneyRequirementId && journeyIds.has(component.physicalJourneyRequirementId)))
      .map(component => component.evaluation.economicAmount);
    let incomplete = model.board.contexts.some(card => ids.has(card.contextOccurrenceId) && card.knowledge !== "KNOWN");
    let costIncomplete = amounts.some(amount => amount === null);
    for (const journey of journeys) {
      const price = compiled.journeyPrices.find(price => price.journeyId === journey.physicalJourneyRequirementId);
      if (!price || price.status !== "RESOLVED") { incomplete = true; costIncomplete = true; }
    }
    const known = amounts.filter((amount): amount is string => amount !== null);
    return {contextOccurrenceId:context.contextOccurrenceId,semanticStateDigest:model.preview.semanticStateDigest,knownAmount:known.length ? known.reduce((total,amount)=>total.plus(amount),new Big(0)).toFixed(2) : null,
      incomplete:incomplete || costIncomplete,costIncomplete};
  });
}
