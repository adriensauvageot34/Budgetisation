"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, CalendarDays, Check, MapPin, Plus, Users } from "lucide-react";
import type { ProspectivePersonRef, ProspectivePlaceRef } from "@/domain/phase2/planned-contract";
import { prospectivePersonIdentity } from "@/domain/phase2/planned-product";
import { SOCIAL_CONTACTS_V1 } from "@/domain/phase2/planned-rules";
import { assetsForModule, PLANNED_ASSET_CATALOG_VERSION, type PlannedAsset } from "@/domain/phase2/planned-assets";
import type { ComponentSelectionV1 } from "@/domain/phase2/planner/component-contract";
import type { PlannedContextState, PlanSemanticStateV1 } from "@/domain/phase2/planner/semantic-state";
import type { ComposerOperation, ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import type { ComposerAssetView, ComposerContextCardView, DropTarget } from "@/domain/phase2/planner/composer-contract";
import type { PlannerJson } from "@/domain/phase2/planner/json";
import type { CardKnowledgeRead } from "@/domain/phase2/planner/card-knowledge-contract";
import { ContextPalette, type PaletteQuestion } from "./context-palette";
import { presetForContext } from "@/domain/phase2/planner/composer-presets";
import { buildComponentRow, fresh, fromSelection, type Row } from "./night-out-components";
import { selectionValues } from "./interactions";
import { PlannerIcon } from "./planner-icons/planner-icon";
import { WorkshopComponentRow } from "./workshop-component-row";
import { useActiveWorkshopQuestion } from "./workshop-choices";
import { useWorkshopConfirmation } from "./workshop-confirmation";
import { useInlineEditRegistry } from "./inline-edit-registry";
import { money } from "./display";
import styles from "./composer.module.css";

type Component = Extract<ComponentSelectionV1,{kind:"COMPONENT"}>;
type View = "date"|"calendar"|"people"|"people-pick"|"person-text"|"place"|"place-pick"|"place-text"|"menu"|"summary"|"added"|"main"|"extras"|"shared"|"before"|"before-components"|"food"|"quantity"|"price"|"funding"|"travel"|"transport"|"other"|"details"|"essentials";
const items = (c:PlannedContextState, slot:string) => (c.slotSelections[slot]?.items ?? []) as readonly ComponentSelectionV1[];
const extrasCatalog = [...assetsForModule("bar"),...assetsForModule("club")].filter(a=>!/(?:parking|uber_out|uber_back|entry|ticket)$/u.test(a.assetKey));
const beforeCatalog = assetsForModule("house_party");
const normalize = (text:string) => text.normalize("NFD").replace(/\p{Diacritic}/gu,"").toLocaleLowerCase("fr");
const caption = (s:ComponentSelectionV1) => s.kind==="COMPONENT" ? `${s.label} · ${s.quantityPerPerson ? `${s.quantityPerPerson}/personne (${s.pricedParticipantCount})` : `${s.quantity} ${s.unitBasis==="SHARED"?"lot partagé":"unité(s)"}`} · ${s.cost.kind==="MANUAL"?money(s.cost.unitAmount):s.cost.kind==="QUOTE"?"devis conservé":"prix inconnu"}${s.provenance==="PERSONAL_SUGGESTION"?" · suggestion non retenue":""}`
  : s.kind==="MOBILITY_INTENT" ? `${({car:"Voiture",train:"Train / tram",bus:"Bus",taxi:"Taxi",free:"Gratuité déclarée",other:"Autre transport",unknown:"Mode à préciser"} as Record<string,string>)[s.optionKey]??"Trajet"} · ${s.journey?.relation==="SHARES_JOURNEY"?"coût du trajet lié":s.pricing?.fare.kind==="MANUAL"?money(s.pricing.fare.unitAmount):"prix à préciser"}` : s.kind==="CHILD_CONTEXT"?"Moment lié":"À préciser";

/** Local presentation steps only. All accepted decisions use the existing semantic/owner operations. */
export function NightOutEditor({context,semanticState,householdPersons,creating=false,model,card,fresh:isFresh=false,saveStatus="MEMORY",busy,onSave,onCancel,onOpenChild,dockHost,admission=0,serverError,embedded=false,initialView="summary"}: {
  context:PlannedContextState;semanticState:PlanSemanticStateV1;householdPersons:readonly {personId:string;displayName:string}[];knowledge?:CardKnowledgeRead;
  creating?:boolean;model?:ComposerUiModel;card?:ComposerContextCardView;fresh?:boolean;saveStatus?:string;busy:boolean;
  onSave:(operation:ComposerOperation)=>boolean;onCancel:()=>void;onOpenChild?:(id:string)=>void;dockHost?:HTMLElement|null;admission?:number;serverError?:string|null;embedded?:boolean;initialView?:"summary"|"people"|"calendar"|"menu"|"main";
}) {
  const confirm = useWorkshopConfirmation(), activeQuestion = useActiveWorkshopQuestion();
  const [view,setView]=useState<View>(initialView),[dirty,setDirty]=useState(false),[error,setError]=useState("");
  const [repeatView,setRepeatView]=useState<View>("extras");
  const presetKey=presetForContext(context)?.presetKey;
  const feedback=error||serverError, summaryPageSize=feedback?2:3;
  const [people,setPeople]=useState<ProspectivePersonRef[]>(()=>Array.isArray(context.fields.participantRefs)?context.fields.participantRefs as ProspectivePersonRef[]:[]);
  const [query,setQuery]=useState(""),[manual,setManual]=useState(""),[page,setPage]=useState(0),[couple,setCouple]=useState(false);
  const [row,setRow]=useState<Row>(()=>fresh("Entrées et événement")),[slot,setSlot]=useState("main"),[beforeExtra,setBeforeExtra]=useState(false);
  const [componentOption,setComponentOption]=useState("main");
  const [direction,setDirection]=useState<"outbound"|"return">("outbound"),[transport,setTransport]=useState<{asset:ComposerAssetView;selection?:ComponentSelectionV1}|null>(null);
  const [travelValues,setTravelValues]=useState<Record<string,string>>({}),[travelPage,setTravelPage]=useState(0);
  const [details,setDetails]=useState({label:String(context.fields.label??""),endDate:String(context.fields.endDate??""),timingNote:String(context.fields.timingNote??"")});
  const focus=useRef<HTMLFieldSetElement>(null),registry=useInlineEditRegistry(),pending=useRef<{next:View;admission:number}|null>(null);
  const before=items(context,"before")[0],beforeChild=before?.kind==="CHILD_CONTEXT"?semanticState.contexts.find(c=>c.contextOccurrenceId===before.childContextOccurrenceId):undefined;
  const bottle=beforeChild?.templateKey==="activity"?items(beforeChild,"main")[0]:before;
  const [beforeIdentity]=useState(()=>({child:beforeChild?.contextOccurrenceId??crypto.randomUUID(),link:before?.selectionId??crypto.randomUUID(),promoted:crypto.randomUUID()}));
  const clearRaw=()=>{registry?.set(`night-editor:${context.contextOccurrenceId}`,null);setDirty(false);};
  const move=(next:View)=>{setView(next);setQuery("");setPage(0);setError("");};
  const discard=useRef(()=>{});discard.current=()=>{setDirty(false);setError("");};
  useEffect(()=>{const key=`night-editor:${context.contextOccurrenceId}`;registry?.set(key,dirty?{targetRef:context.contextOccurrenceId,dimension:"night-editor",kind:"RAW",discard:()=>discard.current(),flush:()=>{}}:null);return()=>registry?.set(key,null);},[registry,dirty,context.contextOccurrenceId]);
  useEffect(()=>{if(pending.current && admission>pending.current.admission){const next=pending.current.next;pending.current=null;clearRaw();move(next);}},[admission]);
  useEffect(()=>{focus.current?.focus();},[view,travelPage,page]);
  const go=(next:View)=>{if(dirty && !(registry?.guard(()=>go(next))))return;clearRaw();move(next);};
  const decide=(operation:ComposerOperation,next:View="menu")=>{setError("");if(onSave(operation)){pending.current=null;clearRaw();move(next);}else pending.current={next,admission};};
  const editFields=(fields:Record<string,PlannerJson>,next:View)=>decide({kind:"EDIT_NIGHT_OUT",edit:{contextOccurrenceId:context.contextOccurrenceId,fields}},next);
  const nextFoundation=(_next:View):View=>"summary";
  const knownPeople=Array.isArray(context.fields.participantRefs)?context.fields.participantRefs as ProspectivePersonRef[]:[];
  const personLabel=(p:ProspectivePersonRef)=>p.kind==="TEXT"?p.label:p.kind==="HOUSEHOLD_PERSON"?householdPersons.find(h=>h.personId===p.personId)?.displayName??"Personne liée":SOCIAL_CONTACTS_V1.find(c=>c.key===p.contactKey)?.label??"Contact lié";
  const choice=(label:string,icon:string,action:()=>void,hint?:string)=> <button type="button" className={styles.nightChoice} disabled={busy} onClick={action}><PlannerIcon iconKey={icon} scale="LIBRARY"/><strong>{label}</strong>{hint&&<small>{hint}</small>}</button>;
  const updateRow=(patch:Partial<Row>)=>{setRow(current=>({...current,...patch,edited:true}));setDirty(true);};
  const beginRow=(target:string,selection?:Component,newShared=false,asset?:PlannedAsset,extraBefore=false,optionKey?:string)=>{
    setSlot(target);setBeforeExtra(extraBefore);setComponentOption(optionKey??selection?.optionKey??(target==="main"?"main":target==="food"?"restaurant":"extra"));setRow(selection?fromSelection(selection):{...fresh(target==="before"?"Avant la soirée":target==="main"?"Entrées et événement":target==="food"?"Repas":newShared?"Bouteille commune":"Consommation"),unitBasis:newShared||target==="main"||target==="before"?"SHARED":"ITEM",costMode:"MANUAL",
      ...(asset?{label:asset.label,assetRef:{catalogVersion:PLANNED_ASSET_CATALOG_VERSION,assetKey:asset.assetKey,labelAtSelection:asset.label,provenance:"EXPLICIT_USER_DECISION" as const}}:{})});
    setDirty(false);move("price");
  };
  const startMain=(global:boolean,confirmed=false)=>{const selected=items(context,"main")[0];if(selected?.kind==="CHILD_CONTEXT"&&!confirmed){confirm({message:"Remplacer cet événement lié par un coût d’entrée ? Ses composants seront retirés seulement lors de la validation. Les autres choix restent conservés.",acceptLabel:"Préparer le remplacement",accept:()=>startMain(global,true)});return;}beginRow("main",selected?.kind==="COMPONENT"?selected:undefined);setRow(r=>({...r,unitBasis:global?"SHARED":r.unitBasis==="SHARED"?"ITEM":r.unitBasis,quantity:global?"1":r.quantity,...(global&&r.unitBasis!=="SHARED"||!global&&r.unitBasis==="SHARED"?{costMode:"UNKNOWN",amount:""}: {})}));};
  const removeBefore=()=>confirm({message:"Retirer le before et ses composants ? Les autres choix restent conservés. Undo permet de revenir en arrière.",acceptLabel:"Retirer le before",accept:()=>decide({kind:"EDIT_NIGHT_OUT",edit:{contextOccurrenceId:context.contextOccurrenceId,fields:{},before:null}})});
  const removeRow=()=>{
    if(slot==="before"){
      if(!beforeExtra||bottle?.kind!=="COMPONENT"){setError("Pour retirer le before, utilise son choix de retrait. Les autres composants restent conservés.");return;}
      decide({kind:"EDIT_NIGHT_OUT",edit:{contextOccurrenceId:context.contextOccurrenceId,fields:{},before:{childContextOccurrenceId:beforeChild?.contextOccurrenceId??beforeIdentity.child,selectionId:before?.selectionId??beforeIdentity.link,bottle,extras:(beforeChild?items(beforeChild,"extras"):[]).filter(s=>s.selectionId!==row.id)}}});return;
    }
    decide({kind:"EDIT_NIGHT_OUT",edit:{contextOccurrenceId:context.contextOccurrenceId,fields:{},slots:{[slot]:items(context,slot).filter(s=>s.selectionId!==row.id)}}});
  };
  const saveRow=()=>{try{
    const option=slot==="before"?beforeExtra?"extra":"activity":componentOption;
    const value=buildComponentRow({...row,edited:true},option);
    const repeat:View|null=slot==="extras"?"extras":slot==="before"?"before-components":null;
    if(repeat)setRepeatView(repeat);
    const after:View=repeat&&!row.existing?"added":"summary";
    if(slot==="before"){
      const previousExtras=beforeChild?items(beforeChild,"extras"):[];
      const extras=beforeExtra?[...previousExtras.filter(s=>s.selectionId!==value.selectionId),value]:previousExtras;
      const main=beforeExtra?bottle:value;
      if(main?.kind!=="COMPONENT")throw Error("Précisez d’abord le composant principal du before.");
      decide({kind:"EDIT_NIGHT_OUT",edit:{contextOccurrenceId:context.contextOccurrenceId,fields:{},before:{childContextOccurrenceId:beforeChild?.contextOccurrenceId??beforeIdentity.child,selectionId:before?.selectionId??beforeIdentity.link,
        bottle:{...main,...(before?.kind==="COMPONENT"?{selectionId:beforeIdentity.promoted}:{})},extras}}},after);
    }else {const old=items(context,slot);const selections=slot==="extras"?[...old.filter(s=>s.selectionId!==value.selectionId),value]:[value];decide({kind:"EDIT_NIGHT_OUT",edit:{contextOccurrenceId:context.contextOccurrenceId,fields:{},slots:{[slot]:selections}}},after);}
  }catch(failure){setError(failure instanceof Error && !/^[A-Z_]+$/.test(failure.message)?failure.message:"Vérifiez le montant, la quantité et le financement. Votre saisie est conservée.");}};
  const startTransport=(asset:ComposerAssetView,selection?:ComponentSelectionV1,leg=direction)=>{
    const current=selection??items(context,leg)[0],same=current?.kind==="MOBILITY_INTENT"&&current.optionKey===asset.optionKey;
    const values=current?selectionValues(current):{};
    if(!same)for(const key of ["amount","funding","fundingAmount","targetIntentId","parkingAmount","parkingMode","preference"])delete values[key];
    for(const field of model?.editors.find(e=>e.assetKey===asset.assetKey)?.fields??[])if(values[field.key]===undefined)values[field.key]=field.initial??field.choices?.[0]?.value??"";
    setTransport({asset,selection:current});setTravelValues(values);setTravelPage(0);move("transport");
  };
  const child=(selection:ComponentSelectionV1)=>selection.kind==="CHILD_CONTEXT" && <button type="button" className={styles.nightAction} disabled={busy} onClick={()=>onOpenChild?.(selection.childContextOccurrenceId)}>Ouvrir le moment lié</button>;
  const slotName:Record<string,string>={main:"Entrées",extras:"Compléments",before:"Avant la soirée",food:"Repas",outbound:"Aller",return:"Retour"};
  const chooseAsset=(asset:ComposerAssetView,target:DropTarget,selection?:ComponentSelectionV1)=>{
    if(asset.optionKind==="MOBILITY_INTENT"){const leg=target.slotKey==="return"?"return":"outbound";setDirection(leg);startTransport(asset,selection??items(context,leg)[0],leg);return;}
    if(asset.kind==="CONTEXT_ASSET"){
      const linked=items(context,target.slotKey??"main").find(s=>s.kind==="CHILD_CONTEXT"&&semanticState.contexts.some(c=>c.contextOccurrenceId===s.childContextOccurrenceId&&c.templateKey===asset.templateKey));
      if(linked?.kind==="CHILD_CONTEXT"){onOpenChild?.(linked.childContextOccurrenceId);return;}
      const replace=()=>decide({kind:"DROP",assetKey:asset.assetKey,target,values:{},identity:crypto.randomUUID(),selectionId:crypto.randomUUID()});
      if(items(context,target.slotKey??"main").some(s=>s.kind!=="UNRESOLVED"))confirm({message:"Remplacer ce choix et son moment lié ? Les autres décisions restent conservées.",acceptLabel:"Remplacer ce choix",accept:replace});else replace();return;
    }
    beginRow(target.slotKey??"extras",selection?.kind==="COMPONENT"?selection:undefined,false,undefined,false,asset.optionKey??undefined);
  };
  const dockChoice=(key:string,label:string,choose:()=>void,iconKey="night-out",selected?:boolean,hint?:string)=>({key,label,choose,iconKey,selected,hint});
  let question:PaletteQuestion={title:"Compléter ma soirée",choices:[]};
  if(view==="people-pick"){
    const candidates:ProspectivePersonRef[]=[...householdPersons.map(p=>({kind:"HOUSEHOLD_PERSON" as const,personId:p.personId})),...SOCIAL_CONTACTS_V1.filter(c=>query.trim()?true:!couple&&c.kind==="FRIEND").map(c=>({kind:"CONTACT" as const,contactKey:c.key}))];
    question={title:"Qui vient avec toi ?",search:{value:query,change:setQuery,label:"Rechercher une personne"},choices:[...candidates.filter(p=>normalize(personLabel(p)).includes(normalize(query))).map(p=>dockChoice(prospectivePersonIdentity(p),personLabel(p),()=>{const id=prospectivePersonIdentity(p);setPeople(old=>old.some(v=>prospectivePersonIdentity(v)===id)?old.filter(v=>prospectivePersonIdentity(v)!==id):[...old,p]);setDirty(true);},"family-visit",people.some(v=>prospectivePersonIdentity(v)===prospectivePersonIdentity(p)))),dockChoice("manual","Saisir un autre nom",()=>{setManual("");move("person-text");},"family-visit")]};
  }else if(view==="place-pick")question={title:"Un lieu pour cette soirée",search:{value:query,change:setQuery,label:"Rechercher un lieu enregistré"},choices:[...(model?.mobilityOptions?.places??[]).filter(p=>normalize(`${p.name} ${p.commune??""}`).includes(normalize(query))).map(p=>dockChoice(p.placeId,p.name,()=>editFields({placeRef:{kind:"KNOWN",placeId:p.placeId}},nextFoundation("menu")),"activity",false,p.commune??undefined)),dockChoice("manual","Saisir un lieu",()=>{setManual("");move("place-text");},"activity")]};
  else if(["extras","shared","before-components"].includes(view)){
    const catalog=view==="before-components"?beforeCatalog:extrasCatalog;
    question={title:view==="shared"?"Une bouteille commune":view==="before-components"?"Compléter le before":"Choisir une consommation",choices:[...catalog.map(a=>dockChoice(a.assetKey,a.label,()=>beginRow(view==="before-components"?"before":"extras",undefined,view==="shared",a,view==="before-components"),"night-out")),dockChoice("free","Mon choix, à saisir",()=>beginRow(view==="before-components"?"before":"extras",undefined,view==="shared",undefined,view==="before-components"),"activity")]};
  }else if(view==="travel")question={title:`Choisir le moyen de transport · ${direction==="outbound"?"Aller":"Retour"}`,choices:(model?.library.searchableAssets??[]).filter(a=>a.optionKind==="MOBILITY_INTENT"&&a.assetKey.startsWith(`option:night-out:${direction}:`)&&model?.dropCapabilities.some(d=>d.sourceAssetKey===a.assetKey&&d.target.contextOccurrenceId===context.contextOccurrenceId&&d.resolution!=="BLOCKED")).map(a=>dockChoice(a.assetKey,a.label,()=>startTransport(a),a.iconKey))};
  else if(view==="food"||view==="other")question={title:view==="food"?"Choisir un repas":"Autres compléments admissibles",choices:(model?.dropCapabilities??[]).filter(d=>d.target.contextOccurrenceId===context.contextOccurrenceId&&d.target.kind==="CONTEXT_SOCKET"&&d.resolution!=="BLOCKED"&&(view!=="food"||d.target.slotKey==="food")).flatMap(d=>{const a=model?.library.searchableAssets.find(a=>a.assetKey===d.sourceAssetKey);return a?[dockChoice(`${a.assetKey}:${d.target.slotKey}`,a.label,()=>chooseAsset(a,d.target,items(context,d.target.slotKey??"")[0]),a.iconKey,false,slotName[d.target.slotKey??""])]:[];})};
  else {
    const choices=[dockChoice("extras",presetKey==="friends-evening"?"Apporter":presetKey==="home-evening"?"À boire":"Consommations",()=>go("extras")),
      dockChoice("main",presetKey==="home-evening"||presetKey==="friends-evening"?"Contribution":"Entrées / coût",()=>go("main")),
      dockChoice("shared","Bouteille partagée",()=>go("shared")),dockChoice("food",presetKey==="home-evening"?"À manger":"Repas",()=>go("food"),"restaurant"),
      ...(presetKey==="home-evening"?[]:[dockChoice("travel","Transport",()=>go("travel"),"family-visit")]),
      dockChoice("before","Before",()=>go("before")),dockChoice("essentials","Date, lieu, personnes",()=>go("essentials"),"activity"),dockChoice("other","Autres compléments",()=>go("other"),"activity")];
    question={title:"Choisir ce qui compte pour cette soirée",choices:presetKey==="nightclub"?[choices[1],choices[0],...choices.filter(choice=>!([choices[0].key,choices[1].key].includes(choice.key)))]:choices};
  }
  if(view==="date")question={title:"La date de ta soirée",choices:[dockChoice("yes","Choisir une date",()=>move("calendar"),"activity"),dockChoice("later","Pas encore",()=>go(nextFoundation("people")))]};
  if(view==="calendar")question={title:"Choisis une date dans le calendrier",choices:[dockChoice("later","Garder la date à préciser",()=>context.fields.plannedDate?editFields({plannedDate:null},nextFoundation("people")):go(nextFoundation("people")))]};
  if(view==="people")question={title:"Avec qui sortir ?",choices:[dockChoice("couple","En couple",()=>{setCouple(true);setPeople([...knownPeople]);move("people-pick");},"family-visit"),dockChoice("friends","Avec des amis",()=>{setCouple(false);setPeople([...knownPeople]);move("people-pick");},"family-visit"),dockChoice("later","À préciser",()=>go(nextFoundation("place")))]};
  if(view==="place")question={title:"Le lieu de ta soirée",choices:[dockChoice("known","Lieu connu",()=>move("place-pick"),"activity"),dockChoice("search","Chercher ou saisir",()=>move("place-pick"),"activity"),dockChoice("later","Pas encore",()=>go(nextFoundation("menu")))]};
  if(view==="quantity")question={title:"La quantité de ce choix",choices:[...['1','2','3','4','6'].map(n=>dockChoice(n,`${n} ${row.unitBasis==="SHARED"?"lot(s) partagé(s)":"unité(s)"}`,()=>updateRow({quantity:n}),"activity",row.quantity===n))]};
  if(view==="price")question={title:"Le prix de ce choix",choices:[dockChoice("known","Prix connu",()=>updateRow({costMode:row.existing?.cost.kind==="QUOTE"?"QUOTE":"MANUAL"}),"night-out",row.costMode!=="UNKNOWN"),dockChoice("unknown","Encore inconnu",()=>updateRow({costMode:"UNKNOWN"}),"activity",row.costMode==="UNKNOWN"),dockChoice("funding","Financement",()=>move("funding"),"activity")]};
  if(view==="funding")question={title:"Financement déclaré",choices:[dockChoice("later","À préciser",()=>updateRow({fundingMode:"UNDECIDED"}),"activity",row.fundingMode==="UNDECIDED"),dockChoice("bank","Banque",()=>updateRow({fundingMode:"BANK"}),"activity",row.fundingMode==="BANK")]};
  if(view==="main"||view==="before"||view==="transport"||view==="person-text"||view==="place-text"||view==="details"||view==="essentials")question={title:"Les précisions de ton choix",choices:[],emptyLabel:"Réponds à la question dans le panneau. Tu peux revenir en arrière ou compléter plus tard."};
  const summary:{key:string;label:string;text:string;open:()=>void}[]=[];
  if(context.fields.plannedDate)summary.push({key:"date",label:"Date",text:String(context.fields.plannedDate),open:()=>go("calendar")});
  if(knownPeople.length)summary.push({key:"people",label:"Participants",text:knownPeople.map(personLabel).join(", "),open:()=>{setPeople([...knownPeople]);go("people");}});
  const place=context.fields.placeRef as ProspectivePlaceRef|undefined;
  if(place)summary.push({key:"place",label:"Lieu",text:place.kind==="TEXT"?place.label:model?.mobilityOptions?.places.find(p=>p.placeId===place.placeId)?.name??"Lieu enregistré",open:()=>go("place")});
  for(const s of ["main","before","food","extras","outbound","return"])for(const selection of items(context,s).filter(s=>s.kind!=="UNRESOLVED"))summary.push({key:selection.selectionId,label:slotName[s],text:caption(selection),open:()=>{
    if(s==="before"||selection.kind==="CHILD_CONTEXT"){go(s==="before"?"before":s==="food"?"food":"main");return;}
    if(selection.kind==="COMPONENT")beginRow(s,selection);else {setDirection(s==="return"?"return":"outbound");go("travel");}
  }});
  const cost=model?.nightOutSummaries?.find(c=>c.contextOccurrenceId===context.contextOccurrenceId);
  const transportFields=model?.editors.find(e=>e.assetKey===transport?.asset.assetKey)?.fields??[],travelGroups=Math.max(1,Math.ceil(transportFields.length/2));
  if(view==="main"&&items(context,"main")[0]?.kind==="CHILD_CONTEXT")question={title:"Événement lié",choices:[dockChoice("child","Modifier l’événement lié",()=>{const selected=items(context,"main")[0];if(selected.kind==="CHILD_CONTEXT")onOpenChild?.(selected.childContextOccurrenceId);}),dockChoice("replace","Remplacer par un coût d’entrée",()=>startMain(true)),dockChoice("summary","Résumé",()=>go("summary"))]};
  else if(view==="main")question={title:"Quel coût veux-tu prévoir ?",choices:[dockChoice("total","Coût direct",()=>startMain(true),"night-out",false,"Pour la contribution ou les entrées · hors autres postes"),dockChoice("units","Tarif à l’unité",()=>startMain(false),"night-out",false,"Préciser la quantité tarifée"),dockChoice("summary","Résumé",()=>go("summary"),"activity")]};
  if(view==="added")question={title:"Continuer à composer",choices:[dockChoice("more","Ajouter encore",()=>go(repeatView)),dockChoice("summary","Terminer",()=>go("summary"),"activity")]};
  if(view==="essentials")question={title:"Quelle précision est utile ?",choices:[dockChoice("date","Date",()=>go("date"),"activity"),dockChoice("people","Personnes",()=>{setPeople([...knownPeople]);go("people");},"family-visit"),dockChoice("place","Lieu",()=>go("place"),"activity"),dockChoice("details","Nom et repère",()=>go("details")),dockChoice("summary","Résumé",()=>go("summary"))]};
  if(view==="people")question={title:"Avec qui ?",choices:[dockChoice("couple","En couple",()=>{setCouple(true);setPeople([...knownPeople]);move("people-pick");},"family-visit"),dockChoice("friends","Avec des amis",()=>{setCouple(false);setPeople([...knownPeople]);move("people-pick");},"family-visit"),dockChoice("alone","Seul",()=>knownPeople.length?editFields({participantRefs:[]},"summary"):go("summary")),dockChoice("later","Décider plus tard",()=>go("summary"))]};
  if(view==="place")question={title:"Un lieu pour cette soirée ?",choices:[dockChoice("known","Lieu enregistré",()=>move("place-pick"),"activity"),dockChoice("free","Nom ou adresse libre",()=>{setManual("");move("place-text");},"activity"),dockChoice("later","Plus tard",()=>go("summary"))]};
  if(view==="before")question={title:"Le before est facultatif",choices:[dockChoice("before",before?"Modifier le before":"Prévoir un before",()=>before&&before.kind!=="UNRESOLVED"?before.kind==="CHILD_CONTEXT"&&beforeChild?.templateKey!=="activity"?onOpenChild?.(before.childContextOccurrenceId):go("before-components"):beginRow("before")),dockChoice("none",before?"Retirer le before":"Sans before",()=>before?removeBefore():go("summary")),dockChoice("summary","Résumé",()=>go("summary"))]};
  if(activeQuestion)question=activeQuestion;
  const goBack=()=>{if(["price","funding","quantity"].includes(view)){go("summary");return;}if(view==="transport"&&travelPage>0){setTravelPage(p=>p-1);return;}go(view==="calendar"?"date":view==="person-text"?"people-pick":view==="place-text"?"place-pick":"menu");};
  const savePeople=()=>{if(people.some(p=>p.kind==="TEXT"&&!p.label.trim())){setError("Terminez les noms avant de confirmer.");return;}editFields({participantRefs:people},nextFoundation("place"));};
  const title:Record<View,string>={date:"Tu connais déjà la date ?",calendar:"Choisis la date de ta soirée",people:"Avec qui comptes-tu sortir ?","people-pick":"Choisis les personnes dans le dock","person-text":"Comment s’appelle cette personne ?",place:"Tu connais le lieu ?","place-pick":"Choisis un lieu dans le dock","place-text":"Où comptes-tu sortir ?",menu:"Que veux-tu prévoir ?",summary:"Ta soirée, en un coup d’œil",added:"Choix ajouté à ta soirée",main:"Quel budget pour les entrées ?",extras:"Quelles consommations prévoir ?",shared:"Une bouteille à partager ?",before:"Prévoir un before ?","before-components":"Les choix de ton before",food:"Un repas pour cette soirée ?",quantity:slot==="main"?"Comment compter les entrées ?":"Quelle quantité prévoir ?",price:"Tu connais le prix ?",funding:"Quel financement retenir ?",travel:"Quel trajet veux-tu préparer ?",transport:`${direction==="outbound"?"Aller":"Retour"} · ${transport?.asset.label??"Transport"}`,other:"Choisis un complément dans le dock",details:"Les précisions de ta soirée",essentials:"Quelle précision veux-tu modifier ?"};
  return <div data-night-out-editor data-night-workshop data-night-step={view} className={styles.nightWorkshop}>
    {!embedded&&<div className={styles.nightQuestionTop}><span><PlannerIcon iconKey="night-out" scale="SATELLITE"/>À ton rythme · tout reste modifiable</span><button type="button" onClick={goBack} disabled={busy} aria-label="Question précédente"><ArrowLeft size={17}/></button></div>}
    <fieldset ref={focus} tabIndex={-1} disabled={busy} className={styles.nightQuestion} aria-label={title[view]}>
      <h3>{title[view]}</h3>
      {view==="essentials"&&<p className={styles.nightHint}>Choisis la précision dans le dock. Rien n’est obligatoire.</p>}{view==="date"&&<p className={styles.nightHint}>Tu peux choisir une date ou décider plus tard.</p>}
      {view==="calendar"&&<div className={styles.nightCalendar}><strong><CalendarDays size={17}/>{new Intl.DateTimeFormat("fr-FR",{month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(`${semanticState.targetMonth}-01T12:00:00Z`))}</strong><div className={styles.nightDays}>
        {["L","M","M","J","V","S","D"].map((d,i)=><span key={i}>{d}</span>)}
        {Array.from({length:(new Date(`${semanticState.targetMonth}-01T12:00:00Z`).getUTCDay()+6)%7},(_,i)=><span key={`blank${i}`}/>)}
        {Array.from({length:new Date(Number(semanticState.targetMonth.slice(0,4)),Number(semanticState.targetMonth.slice(5)),0).getDate()},(_,i)=>{const date=`${semanticState.targetMonth}-${String(i+1).padStart(2,"0")}`;return <button type="button" key={date} disabled={busy} aria-label={date} aria-pressed={context.fields.plannedDate===date} onClick={()=>editFields({plannedDate:date},nextFoundation("people"))}>{i+1}</button>;})}
      </div><button type="button" className={styles.nightLink} onClick={()=>context.fields.plannedDate?editFields({plannedDate:null},nextFoundation("people")):go(nextFoundation("people"))}>Garder la date à préciser</button></div>}
      {view==="people"&&<p className={styles.nightHint}>Les accompagnants ne multiplient aucun prix automatiquement.</p>}
      {view==="people-pick"&&<><p><Users size={18}/> {people.length} personne(s) retenue(s)</p><div className={styles.nightMiniList}>{people.slice(page*3,page*3+3).map(p=><button type="button" key={prospectivePersonIdentity(p)} onClick={()=>{setPeople(old=>old.filter(x=>prospectivePersonIdentity(x)!==prospectivePersonIdentity(p)));setDirty(true);}}>{personLabel(p)} · retirer</button>)}</div>{people.length>3&&<button type="button" className={styles.nightLink} onClick={()=>setPage(p=>(p+1)%Math.ceil(people.length/3))}>Voir les autres personnes</button>}<p className={styles.nightHint}>Le nombre tarifé des entrées ne change pas automatiquement.</p><button type="button" className={styles.nightAction} onClick={savePeople} disabled={busy}>Retenir ces personnes <Check size={16}/></button></>}
      {view==="person-text"&&<><label>Son nom<input autoFocus value={manual} maxLength={120} onChange={e=>{setManual(e.target.value);setDirty(true);}}/></label><button type="button" className={styles.nightAction} disabled={!manual.trim()} onClick={()=>{const next={kind:"TEXT" as const,label:manual.trim()};if(people.some(p=>prospectivePersonIdentity(p)===prospectivePersonIdentity(next))){setError("Cette personne est déjà retenue.");return;}setPeople(p=>[...p,next]);move("people-pick");}}>Ajouter à ma sélection</button></>}
      {view==="place"&&<p className={styles.nightHint}>Le lieu ne décide pas d’un déplacement.</p>}
      {view==="place-pick"&&<p className={styles.nightHint}><MapPin size={18}/> Les lieux déjà disponibles sont dans le dock. Une recherche explicite permet de trouver les autres ; tu peux aussi saisir le nom librement.</p>}
      {view==="place-text"&&<><label>Nom ou adresse<input autoFocus maxLength={120} value={manual} onChange={e=>{setManual(e.target.value);setDirty(true);}}/></label><button type="button" className={styles.nightAction} disabled={!manual.trim()||busy} onClick={()=>editFields({placeRef:{kind:"TEXT",label:manual.trim(),provenance:"USER_DECLARED_PROSPECTIVE"}},nextFoundation("menu"))}>Retenir ce lieu</button></>}
      {view==="menu"&&<p className={styles.nightHint}>Choisis une idée dans le dock sous le Board. Toutes les précisions restent facultatives.</p>}
      {view==="main"&&<p className={styles.nightHint}>Choisis le coût direct ou le tarif à l’unité dans le dock. Aucun participant ni date obligatoire.</p>}
      {(view==="extras"||view==="shared")&&<><p className={styles.nightHint}>Choisis dans le dock, ou modifie une consommation existante. Ajoute uniquement ce qui n’est pas déjà compris dans le budget principal.</p><div className={styles.nightMiniList}>{items(context,"extras").slice(page*3,page*3+3).map(s=><button type="button" key={s.selectionId} onClick={()=>s.kind==="COMPONENT"?beginRow("extras",s):undefined}>{caption(s)}</button>)}</div>{items(context,"extras").length>3&&<button type="button" className={styles.nightLink} onClick={()=>setPage(p=>(p+1)%Math.ceil(items(context,"extras").length/3))}>Consommations suivantes →</button>}</>}
      {view==="before"&&<p className={styles.nightHint}>Le before regroupe ses composants. Aucun coût parent ne s’y ajoute.</p>}
      {view==="before-components"&&<><div className={styles.nightMiniList}>{[...(bottle?.kind==="COMPONENT"?[bottle]:[]),...(beforeChild?items(beforeChild,"extras"):[])].slice(page*3,page*3+3).map(s=><button type="button" key={s.selectionId} onClick={()=>s.kind==="COMPONENT"&&beginRow("before",s,false,undefined,s.selectionId!==bottle?.selectionId)}>{caption(s)}</button>)}</div><p className={styles.nightHint}>Ajoute un diluant ou un complément depuis le dock. Les autres choix du before sont conservés.</p>{(beforeChild?items(beforeChild,"extras").length:0)>2&&<button type="button" className={styles.nightLink} onClick={()=>setPage(p=>(p+1)%Math.ceil(((beforeChild?items(beforeChild,"extras").length:0)+1)/3))}>Composants suivants →</button>}</>}
      {view==="food"&&<>{items(context,"food").length?<><p>{caption(items(context,"food")[0])}</p>{items(context,"food")[0].kind==="CHILD_CONTEXT"?child(items(context,"food")[0]):<button type="button" className={styles.nightAction} onClick={()=>beginRow("food",items(context,"food")[0] as Component)}>Modifier ce repas</button>}<button type="button" className={styles.nightLink} onClick={()=>confirm({message:"Retirer ce repas et ses composants liés ? Les autres postes restent conservés. Undo permet de le rétablir.",acceptLabel:"Retirer le repas",accept:()=>decide({kind:"CLEAR_SOCKET",contextOccurrenceId:context.contextOccurrenceId,slotKey:"food",selectionId:items(context,"food")[0].selectionId})})}>Retirer ce repas</button></>:<p className={styles.nightHint}>Le dock propose les repas admissibles, comme composant ou moment lié. Le parent n’ajoute pas un deuxième coût.</p>}</>}
      {(["quantity","price","funding"] as View[]).includes(view)&&<WorkshopComponentRow key={row.id} title={row.label} row={row} participantCount={knownPeople.length} bindingChoices={slot==="food"}
        onChange={next=>{setRow(next);setDirty(true);}} onSave={saveRow} onRemove={row.existing?removeRow:undefined} busy={busy} />}
      {view==="travel"&&<><div className={styles.nightChoices}>{choice("Aller","family-visit",()=>setDirection("outbound"),direction==="outbound"?"Sélectionné · modes dans le dock":undefined)}{choice("Retour","family-visit",()=>setDirection("return"),direction==="return"?"Sélectionné · modes dans le dock":undefined)}</div><p className={styles.nightHint}>{items(context,direction)[0]?caption(items(context,direction)[0]):"Aucun trajet retenu pour ce sens."}</p>{items(context,direction)[0]&&<button type="button" className={styles.nightLink} onClick={()=>decide({kind:"CLEAR_SOCKET",contextOccurrenceId:context.contextOccurrenceId,slotKey:direction,selectionId:items(context,direction)[0].selectionId})}>Retirer {direction==="outbound"?"l’aller":"le retour"}</button>}</>}
      {view==="transport"&&transport&&<><p className={styles.nightHint}>Trajet facultatif · {travelPage+1}/{travelGroups}. Un nouveau mode ne reprend pas l’ancien tarif incompatible.</p><div className={styles.nightTravelFields}>{transportFields.slice(travelPage*2,travelPage*2+2).map(field=><label key={field.key}>{field.label.replace('outbound','Aller').replace('return','Retour')}{field.kind==="CHOICE"?<select value={travelValues[field.key]??""} onChange={e=>{setTravelValues(v=>({...v,[field.key]:e.target.value}));setDirty(true);}}>{field.choices?.map(c=><option value={c.value} key={c.value}>{c.label.replace(' · outbound',' · Aller').replace(' · return',' · Retour')}</option>)}{field.key==="funding"&&travelValues.funding==="EXISTING"&&<option value="EXISTING">Conserver l’antérieur</option>}</select>:<input value={travelValues[field.key]??""} inputMode={field.kind==="AMOUNT"?"decimal":undefined} onChange={e=>{setTravelValues(v=>({...v,[field.key]:e.target.value}));setDirty(true);}}/>}</label>)}</div><div className={styles.nightActions}>{travelPage<travelGroups-1&&<button type="button" className={styles.nightLink} onClick={()=>setTravelPage(p=>p+1)}>Précisions suivantes →</button>}<button type="button" className={styles.nightAction} disabled={busy} onClick={()=>decide({kind:"DROP",assetKey:transport.asset.assetKey,target:{kind:"CONTEXT_SOCKET",contextOccurrenceId:context.contextOccurrenceId,slotKey:direction},values:travelValues,identity:crypto.randomUUID(),selectionId:transport.selection?.selectionId??crypto.randomUUID()})}>Conserver ce trajet</button></div></>}
      {view==="summary"&&<><div className={styles.nightMiniList} data-night-summary>{summary.slice(page*summaryPageSize,page*summaryPageSize+summaryPageSize).map(item=><button type="button" key={item.key} onClick={item.open}><strong>{item.label}</strong><span>{item.text}</span></button>)}{!summary.length&&<p>Ton intention est créée. Ajoute seulement les choix utiles, maintenant ou plus tard.</p>}</div>{summary.length>summaryPageSize&&<div className={styles.nightPage}><button type="button" disabled={!page} onClick={()=>setPage(p=>p-1)} aria-label="Choix précédents"><ArrowLeft size={16}/></button><span>{page+1} / {Math.ceil(summary.length/summaryPageSize)}</span><button type="button" disabled={(page+1)*summaryPageSize>=summary.length} onClick={()=>setPage(p=>p+1)} aria-label="Choix suivants"><ArrowRight size={16}/></button></div>}<button type="button" className={styles.nightAction} onClick={()=>go("menu")}><Plus size={17}/> Compléter ma soirée</button><button type="button" className={styles.nightLink} onClick={()=>go("essentials")}>Dates, personnes et lieu</button></>}
      {view==="added"&&<p className={styles.nightHint}>Ce poste est retenu. Ajoute un autre choix ou reviens au résumé dans le dock.</p>}
      {view==="details"&&<>{([['label','Nom de la soirée'],['endDate','Date de fin · facultative'],['timingNote','Repère de temps']] as const).map(([key,label])=><label key={key}>{label}<input type={key==="endDate"?'date':'text'} maxLength={120} value={details[key]} onChange={e=>{setDetails(d=>({...d,[key]:e.target.value}));setDirty(true);}}/></label>)}<button type="button" className={styles.nightAction} onClick={()=>{if(details.endDate&&!details.endDate.startsWith(semanticState.targetMonth+'-')){setError("Les soirées intermois restent différées. Conservez une date de ce mois.");return;}editFields(details,"summary");}}>Confirmer ces précisions</button></>}
    </fieldset>
    {embedded&&feedback&&<p role="alert">{feedback}</p>}
    {!embedded&&<footer className={styles.nightWorkshopFooter}><span data-night-persistence role={feedback?"alert":"status"} className={feedback?styles.nightWorkshopError:undefined}>{feedback??(dirty?"Saisie non confirmée":({SAVED:"Brouillon sauvegardé",SAVING:"Sauvegarde en cours",ERROR:"Erreur de sauvegarde · choix conservés",CONFLICT:"Conflit à vérifier",MEMORY:"Brouillon en mémoire"} as Record<string,string>)[saveStatus]??"À sauvegarder")}<small>{isFresh?`Coût connu : ${money(cost?.knownAmount??null)}${cost?.incomplete?" · à compléter":""}`:"Projection à actualiser"} · impact officiel dans le bandeau</small></span><div><button type="button" onClick={()=>{if(dirty){go("summary");return;}move("summary");}} disabled={busy}>Résumé</button><button type="button" onClick={onCancel} disabled={busy}>Quitter</button></div></footer>}
    {dockHost&&card&&model&&createPortal(<ContextPalette card={card} model={model} busy={busy} configure question={question} choose={chooseAsset} close={()=>go("menu")}/>,dockHost)}
  </div>;
}
