"use client";
import {useEffect,useState,type ComponentProps} from "react";
import {createPortal} from "react-dom";
import type {ProspectivePlaceRef} from "@/domain/phase2/planned-contract";
import {assetsForModule,PLANNED_ASSET_CATALOG_VERSION,type PlannedAsset} from "@/domain/phase2/planned-assets";
import {stopForPlace} from "@/domain/phase2/planned-routes";
import {decisionAmount} from "@/domain/phase2/month-decision-contract";
import type {ComponentSelectionV1} from "@/domain/phase2/planner/component-contract";
import type {ComposerOperation} from "@/domain/phase2/planner/composer-ui-contract";
import {NightOutEditor} from "./night-out-workshop";
import {ContextPalette,type PaletteQuestion} from "./context-palette";
import {barItems,barLeg,barEndpoint,barPlaceOperation,barSameModeReturn,type BarTarget,type BarLeg} from "./bar-living-operations";
import {barPlaceLabel,barModeLabel,barPeopleLabel} from "./bar-living-card";
import {fresh,fromSelection,buildComponentRow,type Row} from "./night-out-components";
import {WorkshopComponentRow} from "./workshop-component-row";
import {useActiveWorkshopQuestion} from "./workshop-choices";
import {useWorkshopRaw} from "./inline-edit-registry";
import {useWorkshopConfirmation} from "./workshop-confirmation";
import {useComposerInteractions} from "./interactions";
import {BarPlaceSearch} from "./bar-place-search";
import {money} from "./display";
import styles from "./composer.module.css";

type Page=Exclude<BarTarget,`component:${string}:${string}`>|"manual-place"|"google"|"row"|"endpoint"|"legacy"|"fare";
type Component=Extract<ComponentSelectionV1,{kind:"COMPONENT"}>;
const catalog=assetsForModule("bar").filter(asset=>!/(?:parking|entry)$/u.test(asset.assetKey));
export function BarLivingEditor(props:ComponentProps<typeof NightOutEditor>&{initialTarget?:BarTarget}) {
  const {context,model,card,dockHost,busy,onSave,serverError}=props;
  const initialComponent=props.initialTarget?.startsWith("component:")?props.initialTarget.split(":"):null;
  const initialSelection=initialComponent?barItems(context,initialComponent[1]).find(item=>item.selectionId===initialComponent[2]):undefined;
  const [page,setPage]=useState<Page>(()=>initialSelection?.kind==="COMPONENT"?"row":props.initialTarget?.startsWith("component:")?"summary":props.initialTarget as Page??"place");
  const [legacy,setLegacy]=useState<"people"|"calendar"|"menu"|"main">("menu"),[legacyKey,setLegacyKey]=useState(0);
  const [row,setRow]=useState<Row>(()=>initialSelection?.kind==="COMPONENT"?fromSelection(initialSelection):fresh()),[slot,setSlot]=useState(initialComponent?.[1]??"extras"),[dirty,setDirty]=useState(false);
  const [advancedRow,setAdvancedRow]=useState(false),[manual,setManual]=useState(""),[query,setQuery]=useState(""),[error,setError]=useState("");
  const [fare,setFare]=useState("");
  const [direction,setDirection]=useState<"outbound"|"return">(props.initialTarget==="return"?"return":"outbound"),[endpoint,setEndpoint]=useState<"origin"|"destination">("origin");
  const confirm=useWorkshopConfirmation(),activeQuestion=useActiveWorkshopQuestion(),interaction=useComposerInteractions();
  const guard=useWorkshopRaw(context.contextOccurrenceId,dirty,()=>{setDirty(false);setManual("");},"bar-living");
  useEffect(()=>{
    if(page!=="row"||dirty)return;
    const current=barItems(context,slot).find(item=>item.selectionId===row.id);
    if(current?.kind==="COMPONENT")setRow(fromSelection(current));else setPage("drinks");
  },[context.slotSelections,page,slot,dirty,row.id]);
  if(!model||!card)return <p role="status">Chargement de la carte…</p>;
  const move=(next:Page)=>{if(next==="outbound"||next==="return")setDirection(next);setPage(next);setError("");setQuery("");};
  const go=(next:Page)=>{if(guard(()=>go(next)))move(next);};
  const decide=(operation:ComposerOperation,next:Page="summary")=>{
    try{if(onSave(operation)){setDirty(false);move(next);return true;}setError("Ce choix n’a pas été admis. Votre saisie est conservée ; vérifiez le message du Board.");}
    catch(failure){setError(failure instanceof Error?failure.message:"Choix non admis. Votre saisie est conservée.");}
    return false;
  };
  const startLegacy=(target:typeof legacy)=>{if(!guard(()=>startLegacy(target)))return;setLegacy(target);setLegacyKey(k=>k+1);move("legacy");};
  const open=(target:BarTarget)=>{if(!guard(()=>open(target)))return;
    if(target==="people"||target==="date"){startLegacy(target==="date"?"calendar":"people");return;}
    if(target.startsWith("component:")){const [,slot,id]=target.split(":");const item=barItems(context,slot).find(item=>item.selectionId===id);if(item?.kind==="COMPONENT")editComponent(slot,item);return;}
    if(target==="outbound"||target==="return")setDirection(target);move(target as Page);
  };
  const selectedPlace=context.fields.placeRef as ProspectivePlaceRef|undefined;
  const choosePlace=(place:ProspectivePlaceRef)=>{
    const apply=()=>decide(barPlaceOperation(context,place),"outbound");
    if(barLeg(context,"outbound")||barLeg(context,"return"))confirm({message:"Changer le lieu actualisera la destination de l’aller et le départ du retour. Leurs devis, frais et financements liés seront remis à préciser. Modes, autres décisions et historique Undo sont conservés.",acceptLabel:"Changer le lieu",accept:apply});else apply();
  };
  const editComponent=(target:string,selection:Component)=>{if(!guard(()=>editComponent(target,selection)))return;setSlot(target);setAdvancedRow(false);setRow(fromSelection(selection));move("row");};
  const add=(asset:PlannedAsset)=>{
    if(!guard(()=>add(asset)))return;
    const value=buildComponentRow({...fresh(asset.label),assetRef:{catalogVersion:PLANNED_ASSET_CATALOG_VERSION,assetKey:asset.assetKey,labelAtSelection:asset.label,provenance:"EXPLICIT_USER_DECISION"}},"extra");
    if(decide({kind:"EDIT_NIGHT_OUT",edit:{contextOccurrenceId:context.contextOccurrenceId,fields:{},slots:{extras:[...barItems(context,"extras"),value]}}},"row")){setSlot("extras");setAdvancedRow(false);setRow(fromSelection(value));}
  };
  const remove=()=>confirm({message:"Retirer ce poste ? Les autres choix restent conservés. Undo peut le rétablir.",acceptLabel:"Retirer",accept:()=>decide({kind:"EDIT_NIGHT_OUT",edit:{contextOccurrenceId:context.contextOccurrenceId,fields:{},slots:{[slot]:barItems(context,slot).filter(item=>item.selectionId!==row.id)}}},"drinks")});
  const saveRow=()=>{try{
    if(!barItems(context,slot).some(item=>item.selectionId===row.id)){setError("Ce poste n’existe plus. Revenez à la carte ; il ne sera pas recréé silencieusement.");return;}
    const value=buildComponentRow(row,row.existing?.optionKey??"extra");
    decide({kind:"EDIT_NIGHT_OUT",edit:{contextOccurrenceId:context.contextOccurrenceId,fields:{},slots:{[slot]:barItems(context,slot).map(item=>item.selectionId===row.id?value:item)}}},"drinks");
  }catch(failure){setError(failure instanceof Error?failure.message:"Vérifiez la saisie.");}};
  const leg=barLeg(context,direction);
  const patchLeg=(value:BarLeg,next:Page="summary")=>decide({kind:"EDIT_NIGHT_OUT",edit:{contextOccurrenceId:context.contextOccurrenceId,fields:{},slots:{[direction]:[value]}}},next);
  const chooseEndpoint=(place:ProspectivePlaceRef|null)=>{if(!leg)return;try{patchLeg(barEndpoint(leg,endpoint,place),direction);}catch(failure){setError(failure instanceof Error?failure.message:"Ce lieu ne peut pas être retenu. Le trajet est conservé.");}};
  const chooseVehicle=()=>{
    const vehicle=model.mobilityOptions?.vehicle;if(!leg||!vehicle?.vehicleId)return;
    if(leg.returnRequired){setError("Ce trajet couvre déjà l’aller-retour. Rééditez son véhicule dans les options détaillées ; ses arrêts restent conservés.");return;}
    const apply=()=>patchLeg({...leg,route:{version:"composer-mobility-route@v1",vehicleRef:{vehicleId:vehicle.vehicleId!,labelAtSelection:vehicle.label,provenance:"EXPLICIT_USER_DECISION"},
      ...(leg.route?.manualFuelPrice?{manualFuelPrice:leg.route.manualFuelPrice}:{}),
      ...(leg.route?.toll?{toll:leg.route.toll}:{}),stops:leg.route?.stops.length?leg.route.stops.map(stop=>{
        if(leg.route?.vehicleRef?.vehicleId===vehicle.vehicleId)return stop;
        const {estimatedFuelLiters:_fuel,...retained}=stop;return retained;
      }):leg.origin&&leg.destination?[stopForPlace(leg.origin,barPlaceLabel(leg.origin,model),"DIRECT_PLACE"),stopForPlace(leg.destination,barPlaceLabel(leg.destination,model),"ROOT_PLACE")]:[]}},direction);
    if(leg.route?.vehicleRef&&leg.route.vehicleRef.vehicleId!==vehicle.vehicleId)confirm({message:"Changer de véhicule conserve les lieux et les arrêts. Mobility réestimera le coût d’usage avec le véhicule choisi.",acceptLabel:"Changer de véhicule",accept:apply});else apply();
  };
  const chooseMode=(optionKey:string)=>{
    if(leg?.returnRequired){setError("Cet ancien trajet couvre déjà l’aller-retour. Rééditez sa relation depuis les options détaillées avant de le remplacer.");return;}
    const value:BarLeg=leg?.optionKey===optionKey?leg:{kind:"MOBILITY_INTENT",selectionId:leg?.selectionId??crypto.randomUUID(),optionKey,provenance:"EXPLICIT_USER_DECISION",returnRequired:false,
      origin:leg?.origin??(direction==="return"?selectedPlace:null)??null,destination:leg?.destination??(direction==="outbound"?selectedPlace:null)??null,
      journey:{relation:"OWNS_JOURNEY",certainty:"CERTAIN",targetIntentId:null,externalExpenseId:null,externalCostLineIds:[],choice:null,stopIndex:null,accessLegIndex:null},
      pricing:{fare:{kind:"UNKNOWN"},parking:{kind:"UNKNOWN"},fundingAllocations:[],preference:"FASTEST"},...(optionKey==="car"?{route:{version:"composer-mobility-route@v1" as const,vehicleRef:null,stops:[]}}:{})};
    const apply=()=>patchLeg(value,direction==="outbound"?"return":leg?"summary":"date");
    if(leg&&leg.optionKey!==optionKey)confirm({message:"Changer de mode retire les coûts, devis et liens de l’ancien mode. Les lieux sont conservés ; aucun nouveau prix ne sera inventé.",acceptLabel:"Changer de mode",accept:apply});else apply();
  };
  const choice=(key:string,label:string,choose:()=>void,iconKey="night-out",hint?:string)=>({key,label,choose,iconKey,hint});
  const later=choice("later","Plus tard",()=>go("drinks"),"activity");
  let question:PaletteQuestion={title:"Que veux-tu prévoir ?",choices:[choice("place","Lieu",()=>open("place"),"activity"),choice("drinks","Consommations",()=>go("drinks")),choice("quick","Montant rapide",()=>startLegacy("main")),choice("more","Autres choix",()=>startLegacy("menu"))]};
  if(page==="place")question={title:"Où prendre un verre ?",search:{value:query,change:setQuery,label:"Chercher parmi les lieux enregistrés"},choices:[
    ...(model.mobilityOptions?.places??[]).filter(place=>`${place.name} ${place.commune??""}`.toLocaleLowerCase("fr").includes(query.toLocaleLowerCase("fr"))).map(place=>choice(place.placeId,place.name,()=>choosePlace({kind:"KNOWN",placeId:place.placeId}),"activity",place.commune??undefined)),
    choice("google","Chercher un bar",()=>go("google"),"activity"),choice("manual","Nom libre",()=>{setManual("");go("manual-place");},"activity"),later,
    choice("drinks","Commencer par les consommations",()=>go("drinks")),choice("quick","Saisir un coût direct",()=>startLegacy("main"))]};
  if(page==="drinks")question={title:"Quelles consommations ?",choices:[...catalog.map(asset=>choice(asset.assetKey,asset.label,()=>add(asset))),choice("quick","Saisir un coût direct",()=>startLegacy("main")),choice("more","Repas, before et autres choix",()=>startLegacy("menu"))]};
  if(page==="outbound"||page==="return"){
    const actualDirection=page; // setDirection also keeps endpoint editing attached to this leg.
    question={title:page==="outbound"?"Comment y aller ?":"Et le retour ?",choices:[
      ...(page==="return"&&barLeg(context,"outbound")&&!barItems(context,"return").length?[choice("same","Même mode au retour",()=>{try{decide(barSameModeReturn(context,crypto.randomUUID()),"date");}catch(failure){setError((failure as Error).message);}})]:[]),
      ...model.library.searchableAssets.filter(asset=>asset.optionKind==="MOBILITY_INTENT"&&asset.assetKey.startsWith(`option:night-out:${actualDirection}:`)
        &&model.dropCapabilities.some(drop=>drop.sourceAssetKey===asset.assetKey&&drop.target.contextOccurrenceId===context.contextOccurrenceId&&drop.target.slotKey===actualDirection&&drop.resolution!=="BLOCKED"))
        .map(asset=>choice(asset.assetKey,asset.label,()=>chooseMode(asset.optionKey!),asset.iconKey)),later]};
  }
  if(page==="endpoint")question={title:endpoint==="origin"?"Point de départ":"Destination",choices:[...(model.mobilityOptions?.places??[]).map(place=>choice(place.placeId,place.name,()=>chooseEndpoint({kind:"KNOWN",placeId:place.placeId}),"activity")),
    choice("unknown","Garder à préciser",()=>chooseEndpoint(null),"activity")]};
  if(page==="date")question={title:"Quand sortir ?",choices:[choice("date","Choisir une date",()=>startLegacy("calendar"),"activity"),choice("later","Pas encore décidé",()=>go("drinks"),"activity")]};
  if(page==="people")question={title:"Avec qui ?",choices:[choice("people","Choisir les personnes",()=>startLegacy("people"),"family-visit"),later]};
  if(page==="manual-place"||page==="google")question={title:"Le lieu de ta sortie",choices:[choice("known","Lieux enregistrés",()=>go("place"),"activity"),choice("manual","Nom libre",()=>{if(guard(()=>go("manual-place")))move("manual-place");},"activity"),later]};
  if(page==="fare")question={title:"Coût prévu du trajet · sans paiement",choices:[choice("unknown","Prix encore inconnu",()=>{if(leg)patchLeg({...leg,pricing:{fare:{kind:"UNKNOWN"},parking:leg.pricing?.parking??{kind:"UNKNOWN"},fundingAllocations:leg.pricing?.fundingAllocations??[],preference:leg.pricing?.preference??"FASTEST"}},direction);})]};
  if(page==="row")question=advancedRow?activeQuestion??{title:"Préciser cette consommation",choices:[]}: {title:"Préciser ce poste",choices:[choice("unknown","Prix encore inconnu",()=>{setRow(current=>({...current,costMode:"UNKNOWN",amount:"",edited:true}));setDirty(true);}),choice("advanced","Unité, financement et nom",()=>setAdvancedRow(true))]};
  const economic=context.slotSelections;
  return <div className={styles.barLivingEditor} data-bar-living-editor data-bar-step={page} data-inline-dirty={dirty}>
    <nav className={styles.barLivingMetadata} aria-label="Précisions de la sortie">
      <button type="button" onClick={()=>open("place")}>{barPlaceLabel(selectedPlace,model)}</button>
      <button type="button" onClick={()=>open("date")}>{String(context.fields.plannedDate??"Date à préciser")}</button>
      <button type="button" onClick={()=>open("people")}>{barPeopleLabel(context.fields.participantRefs,model)}</button>
    </nav>
    <div className={styles.barLivingRoutes}>{(["outbound","return"] as const).map(key=>{const item=barLeg(context,key);return <button type="button" key={key} onClick={()=>open(key)}>
      <b>{key==="outbound"?"Aller":"Retour"} · {item?barModeLabel(item.optionKey):"À préciser"}</b><span>{item?`${barPlaceLabel(item.origin,model)} → ${barPlaceLabel(item.destination,model)}`:"Aucun trajet décidé"}</span></button>;})}</div>
    <div className={styles.barLivingTiles} aria-label="Composants économiques">{Object.entries(economic).flatMap(([key])=>barItems(context,key).filter(item=>item.kind==="COMPONENT"||item.kind==="CHILD_CONTEXT").map(item=><button type="button" key={item.selectionId}
      draggable={!busy&&!!model.presentation.dragSources[`satellite:${context.contextOccurrenceId}:${key}:${item.selectionId}`]}
      data-drag-source={`satellite:${context.contextOccurrenceId}:${key}:${item.selectionId}`}
      onDragStart={event=>{event.stopPropagation();interaction?.start(`satellite:${context.contextOccurrenceId}:${key}:${item.selectionId}`,event);}}
      onDragEnd={()=>interaction?.end()} onClick={()=>item.kind==="COMPONENT"&&key!=="before"?editComponent(key,item):startLegacy("menu")}>
      <strong>{item.kind==="COMPONENT"?item.label:"Moment lié"}</strong><small>{item.kind==="COMPONENT"?`${item.quantity} · ${item.cost.kind==="MANUAL"?money(item.cost.unitAmount)+" / unité":item.cost.kind==="QUOTE"?"Devis conservé":"Prix à préciser"}`:"Modifier le moment"}</small></button>))}
      <button type="button" onClick={()=>go("drinks")}>+ Consommation</button></div>
    <section className={styles.barLivingQuestion} aria-label="Décision en cours">
      {page==="row"?<>{!advancedRow && (row.unitBasis==="ITEM"||row.unitBasis==="SHARED") ? <div data-bar-short-row>
          <strong>{row.label}</strong><div className={styles.barLivingMetadata}>
          <label>Quantité {row.unitBasis==="SHARED"?"de lots":"totale"}<span className={styles.workshopStepper}>
            <button type="button" aria-label="Réduire la quantité" disabled={Number(row.quantity)<=1} onClick={()=>{setRow(r=>({...r,quantity:String(Number(r.quantity)-1),edited:true}));setDirty(true);}}>−</button>
            <input inputMode="decimal" value={row.quantity} onChange={e=>{setRow(r=>({...r,quantity:e.target.value,edited:true}));setDirty(true);}}/>
            <button type="button" aria-label="Augmenter la quantité" onClick={()=>{setRow(r=>({...r,quantity:String(Number(r.quantity)+1),edited:true}));setDirty(true);}}>+</button>
          </span></label>
          <label>{row.unitBasis==="SHARED"?"Prix par lot (€)":"Prix unitaire (€)"}<input autoFocus inputMode="decimal" placeholder="Prix à préciser" value={row.costMode==="MANUAL"?row.amount:""} onChange={e=>{setRow(r=>({...r,amount:e.target.value,costMode:e.target.value.trim()?"MANUAL":"UNKNOWN",edited:true}));setDirty(true);}}/></label></div>
          {row.costMode==="QUOTE"&&<p>Devis conservé ; saisir un prix le remplacera explicitement.</p>}
          <button type="button" disabled={busy} onClick={()=>dirty?saveRow():go("drinks")}>Terminé</button>
          <button type="button" disabled={busy} onClick={remove}>Retirer</button></div>
          : <><WorkshopComponentRow title={row.label} row={row} onChange={next=>{setRow(next);setDirty(true);}} onSave={saveRow} onRemove={remove} busy={busy}/><button type="button" onClick={()=>go("drinks")}>Terminé</button></>}</>:page==="legacy"?<NightOutEditor {...props} key={legacyKey} embedded initialView={legacy} onSave={operation=>{const admitted=onSave(operation);if(admitted){setDirty(false);move(legacy==="calendar"?"drinks":"summary");}return admitted;}} onCancel={()=>go("summary")}/>
        :page==="google"?<BarPlaceSearch places={model.mobilityOptions?.places??[]} onKnown={id=>choosePlace({kind:"KNOWN",placeId:id})}/>
        :page==="manual-place"?<><label>Nom ou adresse libre<input autoFocus maxLength={120} value={manual} onChange={e=>{setManual(e.target.value);setDirty(true);}}/></label><button type="button" disabled={!manual.trim()||busy} onClick={()=>choosePlace({kind:"TEXT",label:manual.trim(),provenance:"USER_DECLARED_PROSPECTIVE"})}>Retenir ce repère</button><small>Repère textuel uniquement · distance et itinéraire à préciser.</small></>
        :page==="fare"&&leg?<><label>Coût prévu du billet ou de la course (€)<input autoFocus inputMode="decimal" value={fare} placeholder="Encore inconnu" onChange={event=>{setFare(event.target.value);setDirty(true);}}/></label>
          {leg.pricing?.fare.kind==="QUOTE"&&<p>Le devis reste conservé tant qu’un prix de remplacement n’est pas validé.</p>}
          <button type="button" disabled={busy||!fare.trim()} onClick={()=>{try{patchLeg({...leg,pricing:{fare:{kind:"MANUAL",unitAmount:decisionAmount(fare.trim().replace(",","."))},parking:leg.pricing?.parking??{kind:"UNKNOWN"},fundingAllocations:leg.pricing?.fundingAllocations??[],preference:leg.pricing?.preference??"FASTEST"}},direction);}catch(failure){setError(failure instanceof Error?failure.message:"Vérifiez le prix.");}}}>Retenir le coût du trajet</button>
          <p>Prix du billet ou de la course, hors carburant estimé, péage et stationnement. Le financement existant reste à vérifier.</p></>
        :page==="outbound"||page==="return"?<><p>{page==="outbound"?"Choisis le mode dans le dock. Le retour restera une décision distincte.":"Même mode, autre mode ou plus tard : le retour n’est jamais supposé."}</p>
          {leg&&<div className={styles.barLivingMetadata}>{(["origin","destination"] as const).map(key=><button type="button" key={key} onClick={()=>{setEndpoint(key);go("endpoint");}}>{key==="origin"?"Départ":"Arrivée"} · {barPlaceLabel(leg[key],model)}</button>)}
            {leg.optionKey==="car"&&model.mobilityOptions?.vehicle?.vehicleId&&<button type="button" onClick={chooseVehicle}>Utiliser {model.mobilityOptions.vehicle.label}</button>}
            <button type="button" onClick={()=>confirm({message:"Retirer uniquement ce trajet ? Les consommations et l’autre sens restent conservés.",acceptLabel:"Retirer le trajet",accept:()=>decide({kind:"EDIT_NIGHT_OUT",edit:{contextOccurrenceId:context.contextOccurrenceId,fields:{},slots:{[direction]:barItems(context,direction).filter(item=>item.selectionId!==leg.selectionId)}}})})}>Retirer ce trajet</button>
            <button type="button" onClick={()=>{setFare(leg.pricing?.fare.kind==="MANUAL"?leg.pricing.fare.unitAmount:"");go("fare");}}>Préciser le prix du trajet</button>
            <button type="button" onClick={()=>startLegacy("menu")}>Financement ou relation détaillée</button></div>}</>
        :<p>{page==="place"?"Choisis un lieu dans le dock, ou commence directement par une consommation.":page==="drinks"?"Un clic ajoute une consommation au prix inconnu. Précise seulement ce que tu sais.":page==="date"?"La date reste facultative.":"Continue avec les choix du dock. Tout reste modifiable ici."}</p>}
      {(error||serverError)&&<p role="alert">{error||serverError}</p>}
    </section>
    {page!=="legacy"&&dockHost&&createPortal(<ContextPalette card={card} model={model} busy={busy} configure question={question} choose={()=>{}} close={()=>go("summary")}/>,dockHost)}
  </div>;
}
