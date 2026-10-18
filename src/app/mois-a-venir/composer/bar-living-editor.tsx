"use client";
import {useCallback,useEffect,useRef,useState,type ComponentProps} from "react";
import {createPortal} from "react-dom";
import type {ProspectivePersonRef,ProspectivePlaceRef} from "@/domain/phase2/planned-contract";
import {assetsForModule,PLANNED_ASSET_CATALOG_VERSION,type PlannedAsset} from "@/domain/phase2/planned-assets";
import {stopForPlace} from "@/domain/phase2/planned-routes";
import {decisionAmount} from "@/domain/phase2/month-decision-contract";
import type {ComponentSelectionV1} from "@/domain/phase2/planner/component-contract";
import type {ComposerOperation} from "@/domain/phase2/planner/composer-ui-contract";
import {NightOutEditor} from "./night-out-workshop";
import {ContextPalette,type PaletteQuestion} from "./context-palette";
import {barItems,barLeg,barEndpoint,barPlaceOperation,barSameModeReturn,assertBarRouteEditable,barEndpointCosts,type BarTarget,type BarLeg} from "./bar-living-operations";
import {barPlaceLabel,barModeLabel,barPeopleLabel} from "./bar-living-card";
import {fresh,fromSelection,buildComponentRow,type Row} from "./night-out-components";
import {WorkshopComponentRow} from "./workshop-component-row";
import {useActiveWorkshopQuestion} from "./workshop-choices";
import {useCommittedEvent} from "./use-committed-event";
import {useWorkshopRaw} from "./inline-edit-registry";
import {useWorkshopConfirmation} from "./workshop-confirmation";
import {useComposerInteractions} from "./interactions";
import {barPlaces,barPlaceHint,barEndpointPlaces,barHomePlaces} from "./bar-place-knowledge";
import {BarPlaceSearch,type BarPlaceSearchState} from "./bar-place-search";
import {barSearchText} from "./bar-search";
import {barBefore,barBeforePatch} from "./bar-before";
import {money} from "./display";
import {BarMetadata,BarRouteLine,BarComponentFace,barPersonLabel} from "./bar-living-details";
import {SOCIAL_CONTACTS_V1} from "@/domain/phase2/planned-rules";
import {prospectivePersonIdentity} from "@/domain/phase2/planned-product";
import {BarPageControls} from "./bar-pages";
import {Trash2} from "lucide-react";
import styles from "./composer.module.css";

type Page=Exclude<BarTarget,`component:${string}:${string}`>|"manual-place"|"google"|"row"|"endpoint"|"legacy"|"fare"|"quick"|"coverage"|"before"|"more";
type Component=Extract<ComponentSelectionV1,{kind:"COMPONENT"}>;
const catalog=assetsForModule("bar").filter(asset=>!/(?:parking|entry)$/u.test(asset.assetKey));
const beforeCatalog=assetsForModule("house_party");
export function BarLivingEditor(props:ComponentProps<typeof NightOutEditor>&{initialTarget?:BarTarget}) {
  const {context,model,card,dockHost,onSave,serverError}=props;
  const busy=props.busy||!!card?.readOnly||props.semanticState.preferences.anchors.includes(context.contextOccurrenceId)||props.semanticState.preferences.flexibility[context.contextOccurrenceId]==="PRESERVE";
  const initialComponent=props.initialTarget?.startsWith("component:")?props.initialTarget.split(":"):null;
  const initialBefore=barBefore(props.semanticState,context);
  const initialItems=initialComponent?.[1]==="before-main"?initialBefore?[initialBefore.bottle]:[]:initialComponent?.[1]==="before-extras"?initialBefore?.extras??[]:initialComponent?barItems(context,initialComponent[1]):[];
  const initialSelection=initialComponent?initialItems.find(item=>item.selectionId===initialComponent[2]):undefined;
  const [page,setPage]=useState<Page>(()=>initialSelection?.kind==="COMPONENT"?"row":props.initialTarget?.startsWith("component:")?"summary":props.initialTarget as Page??"summary");
  const [legacy,setLegacy]=useState<"people"|"calendar"|"menu"|"main">("menu"),[legacyKey,setLegacyKey]=useState(0);
  const [row,setRow]=useState<Row>(()=>initialSelection?.kind==="COMPONENT"?fromSelection(initialSelection):fresh()),[slot,setSlot]=useState(initialComponent?.[1]??"extras"),[dirty,setDirty]=useState(false);
  const [advancedRow,setAdvancedRow]=useState(false),[manual,setManual]=useState(""),[allPlaces,setAllPlaces]=useState(false),[error,setError]=useState("");
  const [queries,setQueries]=useState<Record<string,string>>({});
  const [googleSearch,setGoogleSearch]=useState<BarPlaceSearchState>();
  const [calendarFocus,setCalendarFocus]=useState(()=>typeof context.fields.plannedDate==="string"?context.fields.plannedDate:props.semanticState.targetMonth+"-01");
  const [fare,setFare]=useState("");
  const [itemPage,setItemPage]=useState(0);
  const [people,setPeople]=useState<ProspectivePersonRef[]>(()=>Array.isArray(context.fields.participantRefs)?context.fields.participantRefs as ProspectivePersonRef[]:[]);
  const [personName,setPersonName]=useState("");
  const [quickAmount,setQuickAmount]=useState(()=>{const item=barItems(context,"main")[0];return props.initialTarget==="quick"&&item?.kind==="COMPONENT"&&item.cost.kind==="MANUAL"?item.cost.unitAmount:"";}),[quickTotal,setQuickTotal]=useState(props.initialTarget==="quick"),[pendingAsset,setPendingAsset]=useState<PlannedAsset|null>(null),[pendingShared,setPendingShared]=useState(false);
  const [direction,setDirection]=useState<"outbound"|"return">(props.initialTarget==="return"?"return":"outbound"),[endpoint,setEndpoint]=useState<"origin"|"destination">("origin");
  const searchScope=page==="endpoint"?`endpoint:${direction}:${endpoint}`:page;
  const query=queries[searchScope]??"";
  const setQuery=(value:string)=>{setQueries(previous=>({...previous,[searchScope]:value}));if(searchScope==="place")setGoogleSearch(undefined);};
  const saveGoogleSearch=useCallback((state:BarPlaceSearchState)=>{setGoogleSearch(previous=>previous?.query===state.query&&previous.city===state.city&&previous.resultPage===state.resultPage?previous:state);setQueries(previous=>previous.place===state.query?previous:{...previous,place:state.query});},[]);
  const savedPages=useRef<Record<string,number>>({});
  const previousPage=useRef(page);
  const requestConfirmation=useWorkshopConfirmation(),activeQuestion=useActiveWorkshopQuestion(),interaction=useComposerInteractions();
  const before=barBefore(props.semanticState,context);
  const rowItems=(target:string)=>target==="before-main"?before?[before.bottle]:[]:target==="before-extras"?before?.extras??[]:barItems(context,target);
  const beforeLocked=!!before&&(props.semanticState.preferences.anchors.includes(before.child.contextOccurrenceId)||props.semanticState.preferences.flexibility[before.child.contextOccurrenceId]==="PRESERVE");
  // A confirmation must also become stale if a linked descendant or protection changes.
  const decisionSnapshot=()=>JSON.stringify(props.semanticState);
  const currentContext=useCommittedEvent(decisionSnapshot);
  const confirm=(question:Parameters<typeof requestConfirmation>[0])=>{
    const expected=decisionSnapshot();
    requestConfirmation({...question,accept:()=>{
      if(currentContext()!==expected){setError("La carte a changé entre-temps. Relisez la décision avant de confirmer ; aucune modification supplémentaire n’a été admise.");return;}
      question.accept();
    }});
  };
  const rawGuard=useWorkshopRaw(context.contextOccurrenceId,dirty,()=>{
    const original=rowItems(slot).find(item=>item.selectionId===row.id);
    if(original?.kind==="COMPONENT")setRow(fromSelection(original));
    setManual("");setPersonName("");setPeople(Array.isArray(context.fields.participantRefs)?context.fields.participantRefs as ProspectivePersonRef[]:[]);
    setFare("");setQuickAmount("");setDirty(false);
  },"bar-living",canSaveBuffer()?{label:page==="row"&&row.costMode==="MANUAL"?`Enregistrer ${row.amount} €`:"Enregistrer cette saisie",run:()=>saveBuffer(),
    bufferKey:JSON.stringify({page,row,slot,manual,people,personName,fare,quickAmount,quickTotal,direction,slots:context.slotSelections,fields:context.fields,before:before?.child,busy})}:undefined);
  const [resume,setResume]=useState<(()=>void)|null>(null);
  const resumeGo=useCommittedEvent((next:Page)=>go(next));
  const resumeOpen=useCommittedEvent((target:BarTarget)=>open(target));
  const resumeAdd=useCommittedEvent((asset:PlannedAsset,included?:boolean)=>add(asset,included));
  const resumeEdit=useCommittedEvent((target:string,id:string)=>{const item=rowItems(target).find(i=>i.selectionId===id);if(item?.kind==="COMPONENT")editComponent(target,item);});
  const resumeLegacy=useCommittedEvent((target:typeof legacy)=>startLegacy(target));
  const resumeQuick=useCommittedEvent(()=>startQuick());
  const resumeEndpoint=useCommittedEvent((key:"origin"|"destination")=>targetEndpoint(key));
  const resumeTogglePerson=useCommittedEvent((person:ProspectivePersonRef)=>togglePerson(person));
  const resumeEndpointChoice=useCommittedEvent((place:ProspectivePlaceRef|null)=>chooseEndpoint(place));
  const resumeBefore=useCommittedEvent((asset:PlannedAsset)=>addBefore(asset));
  const resumeShared=useCommittedEvent((included?:boolean)=>addShared(included));
  const resumeRemoveBefore=useCommittedEvent(()=>removeBefore());
  const resumeFare=useCommittedEvent(()=>targetFare());
  // Resume after the admitted Draft has committed, using current handlers rather
  // than a closure that still contains the pre-save slot arrays.
  const guard=(continuation:()=>void)=>rawGuard(()=>setResume(()=>continuation));
  useEffect(()=>{if(resume){setResume(null);resume();}},[resume]);
  const editorRoot=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(page!=="row")return;const tile=editorRoot.current?.querySelector<HTMLElement>('[data-bar-active-tile="true"]');tile?.scrollIntoView?.({block:"nearest",inline:"nearest"});},[page,row.id]);
  const [pendingEndpoint,setPendingEndpoint]=useState<{leg:BarLeg;key:"origin"|"destination";place:ProspectivePlaceRef|null}|null>(null);
  function canSaveBuffer(){try{
    if(busy||page==="row"&&slot.startsWith("before-")&&beforeLocked)return false;
    if(page==="row"){buildComponentRow(row,row.existing?.optionKey??"extra");return true;}
    if(page==="manual-place"||page==="endpoint")return !!manual.trim();
    if(page==="people")return !personName.trim();
    if(page==="fare"){decisionAmount(fare.trim().replace(",","."));return !!fare.trim();}
    if(page==="quick"){decisionAmount(quickAmount.trim().replace(",","."));return !!quickAmount.trim()&&!(quickTotal&&barItems(context,"extras").length);}
    return false;
  }catch{return false;}}
  useEffect(()=>{
    if(page!=="row"||dirty)return;
    const current=rowItems(slot).find(item=>item.selectionId===row.id);
    // A RAW continuation may already have selected a new tile in this commit.
    // Refresh only the row this effect observed, never overwrite that new target.
    if(current?.kind==="COMPONENT")setRow(previous=>previous.id===row.id?fromSelection(current):previous);else setPage("drinks");
  },[context.slotSelections,props.semanticState.contexts,page,slot,dirty,row.id]);
  if(!model||!card)return <p role="status">Chargement de la carte…</p>;
  const move=(next:Page)=>{savedPages.current[previousPage.current]=itemPage;previousPage.current=next;setPendingEndpoint(null);if(next==="outbound"||next==="return")setDirection(next);setPage(next);setItemPage(savedPages.current[next]??0);setError("");};
  const go=(next:Page)=>{if(guard(()=>resumeGo(next)))move(next);};
  const decide=(operation:ComposerOperation,next:Page="summary")=>{
    try{if(busy){setError("Cette carte est protégée ou une opération est en cours. Aucun choix n’a été admis.");return false;}if(onSave(operation)){setDirty(false);move(next);return true;}setError("Ce choix n’a pas été admis. Votre saisie est conservée ; vérifiez le message du Board.");}
    catch(failure){setError(failure instanceof Error?failure.message:"Choix non admis. Votre saisie est conservée.");}
    return false;
  };
  const startLegacy=(target:typeof legacy)=>{if(!guard(()=>resumeLegacy(target)))return;setLegacy(target);setLegacyKey(k=>k+1);move("legacy");};
  const open=(target:BarTarget)=>{if(!guard(()=>resumeOpen(target)))return;
    if(target==="quick"){const item=barItems(context,"main")[0];setQuickAmount(item?.kind==="COMPONENT"&&item.cost.kind==="MANUAL"?item.cost.unitAmount:"");setQuickTotal(true);move("quick");return;}
    if(target==="people"){setPeople(Array.isArray(context.fields.participantRefs)?context.fields.participantRefs as ProspectivePersonRef[]:[]);move("people");return;}
    if(target.startsWith("component:")){const [,slot,id]=target.split(":");const item=rowItems(slot).find(item=>item.selectionId===id);if(item?.kind==="COMPONENT")editComponent(slot,item);return;}
    move(target as Page);
  };
  const selectedPlace=context.fields.placeRef as ProspectivePlaceRef|undefined;
  const homes=barHomePlaces(model.mobilityOptions?.places??[]);
  const homeCities=[...new Set(homes.map(place=>place.commune?.trim()).filter((value):value is string=>!!value))];
  const searchCity=selectedPlace?.kind==="KNOWN"?model.mobilityOptions?.places.find(place=>place.placeId===selectedPlace.placeId)?.commune??undefined:homes.length===1&&homeCities.length===1?homeCities[0]:undefined;
  const choosePlace=(place:ProspectivePlaceRef)=>decide(barPlaceOperation(context,place),"summary");
  const editComponent=(target:string,selection:Component)=>{if(!guard(()=>resumeEdit(target,selection.selectionId)))return;setSlot(target);setAdvancedRow(false);setRow(fromSelection(selection));move("row");};
  const add=(asset:PlannedAsset,included?:boolean)=>{
    if(!guard(()=>resumeAdd(asset,included)))return;
    if(included===undefined&&barItems(context,"main").some(item=>item.kind==="COMPONENT")) {setPendingAsset(asset);move("coverage");return;}
    const value=buildComponentRow({...fresh(asset.label),assetRef:{catalogVersion:PLANNED_ASSET_CATALOG_VERSION,assetKey:asset.assetKey,labelAtSelection:asset.label,provenance:"EXPLICIT_USER_DECISION"}},"extra");
    if(decide({kind:"EDIT_NIGHT_OUT",edit:{contextOccurrenceId:context.contextOccurrenceId,fields:{},slots:{...(included?{main:[]}:{}),extras:[...barItems(context,"extras"),value]}}},"row")){setPendingAsset(null);setSlot("extras");setAdvancedRow(false);setRow(fromSelection(value));}
  };
  const startQuick=()=>{if(!guard(resumeQuick))return;setQuickAmount("");setQuickTotal(false);move("quick");};
  const addBefore=(asset:PlannedAsset)=>{
    if(!guard(()=>resumeBefore(asset))||busy||beforeLocked)return;
    try{const value=buildComponentRow({...fresh(asset.label),unitBasis:asset.quantityStrategy==="SHARED"?"SHARED":"ITEM",assetRef:{catalogVersion:PLANNED_ASSET_CATALOG_VERSION,assetKey:asset.assetKey,labelAtSelection:asset.label,provenance:"EXPLICIT_USER_DECISION"}},before?"extra":"activity");
      if(decide(barBeforePatch(props.semanticState,context,before?.bottle??value,before?[...before.extras,value]:[]),"row")){setSlot(before?"before-extras":"before-main");setAdvancedRow(false);setRow(fromSelection(value));}
    }catch(failure){setError((failure as Error).message);}
  };
  const removeBefore=()=>{if(!guard(resumeRemoveBefore)||!before)return;confirm({message:`Retirer le Before et ses ${1+before.extras.length} éléments, ainsi que ses éventuels trajets liés ? Les choix du bar restent conservés. Undo restitue le groupe et ses identités.`,acceptLabel:"Retirer le Before",accept:()=>decide({kind:"EDIT_NIGHT_OUT",edit:{contextOccurrenceId:context.contextOccurrenceId,fields:{},before:null}})});};
  const addShared=(included?:boolean)=>{if(!guard(()=>resumeShared(included)))return;if(included===undefined&&barItems(context,"main").some(item=>item.kind==="COMPONENT")){setPendingShared(true);setPendingAsset(null);move("coverage");return;}const value=buildComponentRow({...fresh("Bouteille partagée"),unitBasis:"SHARED"},"extra");if(decide({kind:"EDIT_NIGHT_OUT",edit:{contextOccurrenceId:context.contextOccurrenceId,fields:{},slots:{...(included?{main:[]}:{}),extras:[...barItems(context,"extras"),value]}}},"row")){setPendingShared(false);setSlot("extras");setAdvancedRow(false);setRow(fromSelection(value));}};
  const saveQuick=()=>{try{
    const original=barItems(context,"main")[0];if(original&&original.kind!=="COMPONENT"){setError("Un moment lié occupe les entrées. Rééditez-le depuis Autres choix avant de le remplacer.");return;}
    const value=buildComponentRow({...fresh(quickTotal?"Consommations regroupées":"Entrées / contribution"),...(original?.kind==="COMPONENT"?{id:original.selectionId,existing:original}:{}),unitBasis:"SHARED",quantity:"1",costMode:"MANUAL",amount:quickAmount},"main");
    const apply=()=>decide({kind:"EDIT_NIGHT_OUT",edit:{contextOccurrenceId:context.contextOccurrenceId,fields:{},slots:{main:[value],...(quickTotal?{extras:[]}: {})}}},"summary");
    if(quickTotal&&barItems(context,"extras").length){confirm({message:"Remplacer les consommations détaillées par ce total ? Leur coût ne sera pas additionné. Repas, before et trajets restent indépendants et conservés. Undo permet de revenir aux détails.",acceptLabel:"Remplacer par le total",accept:apply});return false;}return apply();
  }catch(failure){setError(failure instanceof Error?failure.message:"Vérifiez le montant.");return false;}};
  const remove=()=>{
    if(slot==="before-main"){setError("Le Before exige un composant principal. Modifiez-le ou retirez le groupe entier avec sa confirmation.");return;}
    const apply=()=>slot==="before-extras"?before&&decide(barBeforePatch(props.semanticState,context,before.bottle,before.extras.filter(item=>item.selectionId!==row.id)),"before")
      :decide({kind:"EDIT_NIGHT_OUT",edit:{contextOccurrenceId:context.contextOccurrenceId,fields:{},slots:{[slot]:barItems(context,slot).filter(item=>item.selectionId!==row.id)}}},"drinks");
    if(dirty)confirm({message:"Retirer ce poste et abandonner sa saisie non validée ? Undo permet de rétablir la dernière décision conservée.",acceptLabel:"Retirer",accept:apply});else apply();
  };
  const saveRow=(candidate:Row=row,next:Page="drinks")=>{try{
    if(!rowItems(slot).some(item=>item.selectionId===row.id)){setError("Ce poste n’existe plus. Revenez à la carte ; il ne sera pas recréé silencieusement.");return;}
    const value=buildComponentRow(candidate,candidate.existing?.optionKey??"extra");
    if(slot.startsWith("before-")&&before)return decide(barBeforePatch(props.semanticState,context,slot==="before-main"?value:before.bottle,slot==="before-extras"?before.extras.map(item=>item.selectionId===row.id?value:item):before.extras),next==="drinks"?"before":next);
    return decide({kind:"EDIT_NIGHT_OUT",edit:{contextOccurrenceId:context.contextOccurrenceId,fields:{},slots:{[slot]:barItems(context,slot).map(item=>item.selectionId===row.id?value:item)}}},next);
  }catch(failure){setError(failure instanceof Error?failure.message:"Vérifiez la saisie.");return false;}};
  const adjustQuantity=(delta:number)=>{
    const value=Number(row.quantity);if(!Number.isFinite(value)||value+delta<1||busy)return;
    const candidate={...row,quantity:String(value+delta),edited:true};
    if(dirty){setRow(candidate);return;}
    if(saveRow(candidate,"row"))setRow({...candidate,edited:false});
  };
  const leg=barLeg(context,direction);
  const patchLeg=(value:BarLeg,next:Page="summary")=>{try{if(leg&&leg.selectionId===value.selectionId&&JSON.stringify(leg)!==JSON.stringify(value))assertBarRouteEditable(leg);return decide({kind:"EDIT_NIGHT_OUT",edit:{contextOccurrenceId:context.contextOccurrenceId,fields:{},slots:{[direction]:barItems(context,direction).some(item=>item.selectionId===value.selectionId)?barItems(context,direction).map(item=>item.selectionId===value.selectionId?value:item):[...barItems(context,direction),value]}}},next);}catch(failure){setError((failure as Error).message);return false;}};
  const chooseEndpoint=(place:ProspectivePlaceRef|null,fromBuffer=false)=>{if(!leg)return false;if(!fromBuffer&&!guard(()=>resumeEndpointChoice(place)))return false;try{
    // Validate representability before proposing any destructive price choice.
    const costs=barEndpointCosts(leg,endpoint);
    const next=barEndpoint(leg,endpoint,place,"UNKNOWN");
    if(next!==leg&&costs.length){setPendingEndpoint({leg,key:endpoint,place});return false;}
    return patchLeg(next,direction);
  }catch(failure){setError(failure instanceof Error?failure.message:"Ce lieu ne peut pas être retenu. Le trajet est conservé.");}};
  const resolveEndpoint=(choice:"UNKNOWN"|"RETAIN_MANUAL")=>{if(!pendingEndpoint||!leg)return;
    if(JSON.stringify(leg)!==JSON.stringify(pendingEndpoint.leg)){setPendingEndpoint(null);setError("Ce trajet a changé entre-temps. Relisez-le avant de choisir son nouveau prix.");return;}
    try{patchLeg(barEndpoint(leg,pendingEndpoint.key,pendingEndpoint.place,choice),direction);}catch(failure){setError((failure as Error).message);}
  };
  const saveFare=()=>{if(!leg)return false;try{return patchLeg({...leg,pricing:{fare:{kind:"MANUAL",unitAmount:decisionAmount(fare.trim().replace(",","."))},parking:leg.pricing?.parking??{kind:"UNKNOWN"},fundingAllocations:leg.pricing?.fundingAllocations??[],preference:leg.pricing?.preference??"FASTEST"}},direction);}catch(failure){setError(failure instanceof Error?failure.message:"Vérifiez le prix.");return false;}};
  function saveBuffer():boolean {
    if(page==="row")return !!saveRow();
    if(page==="endpoint")return !!chooseEndpoint({kind:"TEXT",label:manual.trim(),provenance:"USER_DECLARED_PROSPECTIVE"},true);
    if(page==="manual-place")return choosePlace({kind:"TEXT",label:manual.trim(),provenance:"USER_DECLARED_PROSPECTIVE"});
    if(page==="people")return decide({kind:"EDIT_NIGHT_OUT",edit:{contextOccurrenceId:context.contextOccurrenceId,fields:{participantRefs:people}}},"summary");
    if(page==="fare")return saveFare();
    if(page==="quick")return !!saveQuick();
    return false;
  }
  const targetEndpoint=(key:"origin"|"destination")=>{if(!guard(()=>resumeEndpoint(key)))return;setEndpoint(key);setManual("");move("endpoint");};
  const targetFare=()=>{if(!guard(resumeFare))return;setFare(leg?.pricing?.fare.kind==="MANUAL"?leg.pricing.fare.unitAmount:"");move("fare");};
  const chooseVehicle=()=>{
    const vehicle=model.mobilityOptions?.vehicle;if(!leg||!vehicle?.vehicleId)return;
    try{assertBarRouteEditable(leg);}catch(failure){setError((failure as Error).message);return;}
    const apply=()=>patchLeg({...leg,route:{version:"composer-mobility-route@v1",vehicleRef:{vehicleId:vehicle.vehicleId!,labelAtSelection:vehicle.label,provenance:"EXPLICIT_USER_DECISION"},
      ...(leg.route?.manualFuelPrice?{manualFuelPrice:leg.route.manualFuelPrice}:{}),
      ...(leg.route?.toll?{toll:leg.route.toll}:{}),stops:leg.route?.stops.length?leg.route.stops.map(stop=>{
        if(leg.route?.vehicleRef?.vehicleId===vehicle.vehicleId)return stop;
        const {estimatedFuelLiters:_fuel,...retained}=stop;return retained;
      }):leg.origin&&leg.destination?[stopForPlace(leg.origin,barPlaceLabel(leg.origin,model),"DIRECT_PLACE"),stopForPlace(leg.destination,barPlaceLabel(leg.destination,model),"ROOT_PLACE")]:[]}},direction);
    if(leg.route?.vehicleRef&&leg.route.vehicleRef.vehicleId!==vehicle.vehicleId)confirm({message:`Changer de véhicule conserve les lieux et les arrêts. Mobility réestimera le coût d’usage avec le véhicule choisi.${leg.route?.toll?.kind==="MANUAL"?` Le péage de ${leg.route.toll.unitAmount} € sera conservé comme estimation déclarée ; aucune classe tarifaire n’est attestée ici.`:""}`,acceptLabel:"Changer de véhicule",accept:apply});else apply();
  };
  const chooseMode=(optionKey:string,fromHome=false)=>{
    if(fromHome&&(leg||homes.length!==1||selectedPlace?.kind!=="KNOWN"||!model.mobilityOptions?.vehicleIsUnique||!model.mobilityOptions.vehicle?.vehicleId))return;
    if(leg&&leg.optionKey!==optionKey){try{assertBarRouteEditable(leg);
      if((leg.route?.stops.length??0)>2||leg.pricing?.fundingAllocations.length)throw Error("Ce trajet possède des arrêts intermédiaires ou un financement. Utilisez les options détaillées ; ils sont conservés.");
    }catch(failure){setError((failure as Error).message);return;}}
    const value:BarLeg=leg?.optionKey===optionKey?leg:{kind:"MOBILITY_INTENT",selectionId:leg?.selectionId??crypto.randomUUID(),optionKey,provenance:"EXPLICIT_USER_DECISION",returnRequired:false,
      ...(leg?.plannedTime!==undefined?{plannedTime:leg.plannedTime}:{}),...(leg?.returnTime!==undefined?{returnTime:leg.returnTime}:{}),
      origin:leg?(leg.origin??null):fromHome?{kind:"KNOWN",placeId:homes[0]!.placeId}:(direction==="return"?selectedPlace:null)??null,destination:leg?(leg.destination??null):(direction==="outbound"?selectedPlace:null)??null,
      journey:{relation:"OWNS_JOURNEY",certainty:"CERTAIN",targetIntentId:null,externalExpenseId:null,externalCostLineIds:[],choice:null,stopIndex:null,accessLegIndex:null},
      pricing:{fare:{kind:"UNKNOWN"},parking:{kind:"UNKNOWN"},fundingAllocations:[],preference:"FASTEST"},...(optionKey==="car"?{route:{version:"composer-mobility-route@v1" as const,vehicleRef:fromHome?{vehicleId:model.mobilityOptions!.vehicle!.vehicleId!,labelAtSelection:model.mobilityOptions!.vehicle!.label,provenance:"EXPLICIT_USER_DECISION" as const}:null,stops:fromHome?[stopForPlace({kind:"KNOWN",placeId:homes[0]!.placeId},homes[0]!.name,"DIRECT_PLACE"),stopForPlace(selectedPlace!,barPlaceLabel(selectedPlace,model),"ROOT_PLACE")]:[]}}:{})};
    const apply=()=>patchLeg(value,direction);
    if(leg&&leg.optionKey!==optionKey)confirm({message:`Changer de mode pour ${direction==="outbound"?"l’aller":"le retour"} remet ses prix à préciser et retire les données propres à son ancien mode. Les lieux et l’autre trajet sont conservés.${leg.pricing?.fare.kind==="MANUAL"?` Tarif concerné : ${leg.pricing.fare.unitAmount} € déclaré.`:leg.pricing?.fare.kind==="QUOTE"?" Le devis de ce trajet sera retiré.":""}`,acceptLabel:"Changer de mode",accept:apply});else apply();
  };
  const togglePerson=(person:ProspectivePersonRef)=>{
    if(!guard(()=>resumeTogglePerson(person)))return;
    const refs=Array.isArray(context.fields.participantRefs)?context.fields.participantRefs as ProspectivePersonRef[]:[];
    const next=refs.some(p=>prospectivePersonIdentity(p)===prospectivePersonIdentity(person))?refs.filter(p=>prospectivePersonIdentity(p)!==prospectivePersonIdentity(person)):[...refs,person];
    if(decide({kind:"EDIT_NIGHT_OUT",edit:{contextOccurrenceId:context.contextOccurrenceId,fields:{participantRefs:next}}},"people"))setPeople(next);
  };
  const choice=(key:string,label:string,choose:()=>void,iconKey="night-out",hint?:string,symbol?:string)=>({key,label,choose,iconKey,hint,symbol});
  const later=choice("later","Plus tard",()=>go("summary"),"activity");
  const beer=catalog.find(asset=>asset.assetKey==="bar:beer")!;
  const beerChoice=choice(beer.assetKey,"Bière",()=>add(beer),"night-out",undefined,beer.icon);
  const drinkChoices=catalog.map(asset=>choice(asset.assetKey,asset.label,()=>add(asset),"night-out",undefined,asset.icon));
  const beforeChoice=choice("before","Before",()=>go("before"),"activity","Bouteille et compléments avant de sortir");
  const sharedChoice=choice("shared","Bouteille partagée",()=>addShared(),"night-out","Un lot, sans multiplier par les présents","🍾");
  const neutralChoices=[choice("place","Lieu",()=>open("place"),"activity",undefined,"📍"),beerChoice,
    choice("date","Date",()=>open("date"),"activity",undefined,"📅"),choice("quick","Montant direct",startQuick,"night-out",undefined,"◈"),choice("more","Autre",()=>go("more"),"activity",undefined,"＋")];
  let question:PaletteQuestion={title:"Composer",choices:neutralChoices};
  const knownBars=barPlaces(model.mobilityOptions?.places??[],query);
  if(page==="summary"&&selectedPlace)question={title:"La suite de ta sortie",choices:[choice(barLeg(context,"outbound")?"return":"outbound",barLeg(context,"outbound")?barLeg(context,"return")?"Modifier le retour":"Retour":"Aller",()=>open(barLeg(context,"outbound")?"return":"outbound"),"activity"),choice("drinks","Boissons",()=>go("drinks")),...neutralChoices.filter(c=>!["place",beer.assetKey].includes(c.key))]};
  if(page==="place")question={title:"Où prendre un verre ?",choices:[
    ...knownBars.slice(0,query.trim()||allPlaces?knownBars.length:3).map(place=>({...choice(place.placeId,place.name,()=>choosePlace({kind:"KNOWN",placeId:place.placeId}),"activity",barPlaceHint(place,model.mobilityOptions?.placeKnowledge)),showHint:true})),
    ...(!query.trim()&&!allPlaces&&knownBars.length>3?[choice("all","Tous les bars enregistrés",()=>setAllPlaces(true),"activity")]:[]),
    choice("google","Chercher un bar",()=>go("google"),"activity"),choice("manual","Nom libre",()=>{if(guard(()=>go("manual-place"))){setManual("");move("manual-place");}},"activity"),later,
    choice("drinks","Commencer par les consommations",()=>go("drinks")),choice("quick","Saisir un coût direct",startQuick)]};
  if(page==="more")question={title:"Compléter ta sortie",choices:[beforeChoice,sharedChoice,choice("drinks","Boissons",()=>go("drinks")),choice("details","Repas et options détaillées",()=>startLegacy("menu"),"activity")]};
  if(page==="before")question={title:"Avant de sortir",choices:[...beforeCatalog.map(asset=>choice(asset.assetKey,asset.label,()=>addBefore(asset),"night-out",undefined,asset.icon)),choice("drinks","Au bar",()=>go("drinks"))]};
  if(page==="drinks")question={title:"Consommations",choices:[sharedChoice,beforeChoice,...catalog.map(asset=>choice(asset.assetKey,asset.label,()=>add(asset),"night-out",undefined,asset.icon)),choice("quick","Saisir un coût direct",startQuick),choice("more","Repas, before et autres choix",()=>startLegacy("menu"))]};
  if(page==="outbound"||page==="return"){
    const actualDirection=page; // setDirection also keeps endpoint editing attached to this leg.
    question={title:page==="outbound"?"Aller":"Retour",choices:[
      ...(page==="outbound"&&!leg&&homes.length===1&&selectedPlace?.kind==="KNOWN"&&barPlaces(model.mobilityOptions?.places??[]).some(p=>p.placeId===selectedPlace.placeId)&&model.mobilityOptions?.vehicleIsUnique&&model.mobilityOptions.vehicle?.vehicleId&&model.dropCapabilities.some(drop=>drop.sourceAssetKey==="option:night-out:outbound:car"&&drop.target.contextOccurrenceId===context.contextOccurrenceId&&drop.resolution!=="BLOCKED")?[choice("home-car",`Maison → ${barPlaceLabel(selectedPlace,model)} · ${model.mobilityOptions.vehicle.label}`,()=>chooseMode("car",true),"car","Voiture · aller uniquement · coût à estimer")]:[]),
      ...(page==="return"&&barLeg(context,"outbound")&&!barItems(context,"return").length?[choice("same","Même mode au retour",()=>{try{decide(barSameModeReturn(context,crypto.randomUUID()),"return");}catch(failure){setError((failure as Error).message);}})]:[]),
      ...model.library.searchableAssets.filter(asset=>asset.optionKind==="MOBILITY_INTENT"&&asset.assetKey.startsWith(`option:night-out:${actualDirection}:`)
        &&model.dropCapabilities.some(drop=>drop.sourceAssetKey===asset.assetKey&&drop.target.contextOccurrenceId===context.contextOccurrenceId&&drop.target.slotKey===actualDirection&&drop.resolution!=="BLOCKED"))
        .map(asset=>({...choice(asset.assetKey,asset.label,()=>chooseMode(asset.optionKey!),asset.iconKey,undefined,({car:"🚗",taxi:"🚕",train:"🚆",bus:"🚌",free:"🚶",other:"↗",unknown:"?"} as Record<string,string>)[asset.optionKey??""]),selected:leg?.optionKey===asset.optionKey})),later]};
  }
  if(page==="endpoint")question={title:endpoint==="origin"?"Point de départ":"Destination",search:{value:query,change:setQuery,label:"Chercher un point du trajet"},choices:[
    ...(selectedPlace?.kind==="TEXT"?[choice("bar-text",selectedPlace.label,()=>chooseEndpoint(selectedPlace),"activity","Repère libre de cette sortie · itinéraire à préciser")]:[]),
    ...(selectedPlace?.kind==="KNOWN"&&model.mobilityOptions?.places.some(p=>p.placeId===selectedPlace.placeId)?[choice("bar-known",barPlaceLabel(selectedPlace,model),()=>chooseEndpoint(selectedPlace),"activity","Lieu retenu pour cette sortie · choix de ce point uniquement")]:[]),
    ...barEndpointPlaces(model.mobilityOptions?.places??[],model.householdPersons).filter(({place})=>selectedPlace?.kind!=="KNOWN"||place.placeId!==selectedPlace.placeId).filter(({place})=>`${place.name} ${place.commune??""}`.toLocaleLowerCase("fr").includes(query.toLocaleLowerCase("fr"))).map(({place,hint})=>choice(place.placeId,place.name,()=>chooseEndpoint({kind:"KNOWN",placeId:place.placeId}),"activity",hint)),
    choice("unknown","Garder à préciser",()=>chooseEndpoint(null),"activity")]};
  if(page==="date")question={title:"Date de la sortie",choices:[]};
  if(page==="people"){
    const candidates:ProspectivePersonRef[]=[...props.householdPersons.map(p=>({kind:"HOUSEHOLD_PERSON" as const,personId:p.personId})),...SOCIAL_CONTACTS_V1.map(p=>({kind:"CONTACT" as const,contactKey:p.key}))];
    question={title:"Avec qui ?",search:{value:query,change:setQuery,label:"Chercher une personne"},choices:candidates.filter(p=>barSearchText(barPersonLabel(p,model)).includes(barSearchText(query))).map(p=>({...choice(prospectivePersonIdentity(p),barPersonLabel(p,model),()=>togglePerson(p),"family-visit"),selected:people.some(x=>prospectivePersonIdentity(x)===prospectivePersonIdentity(p))}))};
  }
  if(page==="manual-place"||page==="google")question={title:"Le lieu de ta sortie",choices:[choice("known","Lieux enregistrés",()=>go("place"),"activity"),choice("manual","Nom libre",()=>{if(guard(()=>go("manual-place")))move("manual-place");},"activity"),later]};
  if(page==="fare")question={title:"Coût prévu du trajet · sans paiement",choices:[choice("unknown","Prix encore inconnu",()=>{if(leg)patchLeg({...leg,pricing:{fare:{kind:"UNKNOWN"},parking:leg.pricing?.parking??{kind:"UNKNOWN"},fundingAllocations:leg.pricing?.fundingAllocations??[],preference:leg.pricing?.preference??"FASTEST"}},direction);})]};
  if(page==="row")question=advancedRow?activeQuestion??{title:"Détails du poste",choices:[]}: {title:slot.startsWith("before-")?"Avant de sortir":"Consommations",choices:slot.startsWith("before-")?[...beforeCatalog.map(asset=>choice(asset.assetKey,asset.label,()=>addBefore(asset),"night-out",undefined,asset.icon)),choice("drinks","Au bar",()=>go("drinks"))]:[...drinkChoices,sharedChoice,beforeChoice]};
  if(page==="quick")question={title:"Que couvre ce coût prévu ?",choices:[{...choice("entry","Entrées / contribution",()=>setQuickTotal(false),"night-out","Hors boissons, repas et trajets"),selected:!quickTotal},{...choice("total","Consommations regroupées",()=>setQuickTotal(true),"night-out","Remplace leurs détails, hors repas et trajets"),selected:quickTotal}]};
  if(page==="coverage")question={title:"Ce poste est-il déjà compris dans le coût retenu ?",choices:[choice("included","Détailler à la place",()=>pendingShared?addShared(true):pendingAsset&&add(pendingAsset,true),"night-out","Retire le coût regroupé pour ne pas le compter deux fois"),choice("extra","Ajouter en plus",()=>pendingShared?addShared(false):pendingAsset&&add(pendingAsset,false),"night-out","Coût indépendant des entrées / contribution"),choice("cancel","Ne rien ajouter",()=>{setPendingAsset(null);setPendingShared(false);go("drinks");},"activity")]};
  const activeRow=<fieldset className={styles.barEditableBody} disabled={busy||slot.startsWith("before-")&&beforeLocked}>{!advancedRow && (row.unitBasis==="ITEM"||row.unitBasis==="SHARED") ? <div data-bar-short-row>
          <div className={styles.barRowControls}>
          <label><span className={styles.barVisuallyHidden}>Quantité {row.unitBasis==="SHARED"?"de lots":"totale"}</span><span className={styles.workshopStepper}>
            <button type="button" aria-label="Réduire la quantité" disabled={Number(row.quantity)<=1} onClick={()=>adjustQuantity(-1)}>−</button>
            <input aria-label={row.unitBasis==="SHARED"?"Quantité de lots":"Quantité totale"} inputMode="decimal" value={row.quantity} onChange={e=>{setRow(r=>({...r,quantity:e.target.value,edited:true}));setDirty(true);}}/>
            <button type="button" aria-label="Augmenter la quantité" onClick={()=>adjustQuantity(1)}>+</button>
          </span></label>
          <label className={styles.barInlinePrice}><span className={styles.barVisuallyHidden}>{row.unitBasis==="SHARED"?"Prix par lot (€)":"Prix unitaire (€)"}</span><span aria-hidden="true">{row.unitBasis==="SHARED"?"Prix / lot":"Prix / unité"}</span><input aria-label={row.unitBasis==="SHARED"?"Prix par lot (€)":"Prix unitaire (€)"} inputMode="decimal" placeholder="À préciser" value={row.costMode==="MANUAL"?row.amount:""} onChange={e=>{setRow(r=>({...r,amount:e.target.value,costMode:e.target.value.trim()?"MANUAL":"UNKNOWN",edited:true}));setDirty(true);}}/><span aria-hidden="true">€</span></label>
          <details className={styles.barItemMenu} data-bar-item-details><summary>Détails du poste</summary><div><button type="button" onClick={()=>setAdvancedRow(true)}>Unité, financement et nom</button><button type="button" disabled={busy} onClick={remove} aria-label="Retirer ce poste"><Trash2 size={14}/> Retirer</button></div></details></div>
          {row.costMode==="QUOTE"&&<p>Devis conservé ; saisir un prix le remplacera explicitement.</p>}
          {dirty&&<button type="button" disabled={!canSaveBuffer()} onClick={()=>saveRow()}>Enregistrer</button>}
          </div>
          : <><WorkshopComponentRow title={row.label} row={row} onChange={next=>{setRow(next);setDirty(true);}} onSave={()=>saveRow()} onRemove={remove} busy={busy}/><button type="button" onClick={()=>go("drinks")}>Voir les consommations</button></>}</fieldset>;
  const sectionLabels={extras:"Au bar",before:"Avant de sortir",food:"Repas",main:barItems(context,"main").some(item=>item.kind==="COMPONENT"&&item.label==="Consommations regroupées")?"Consommations regroupées":"Entrées / contribution"};
  const freshProjection=model.nightOutSummaries?.find(s=>s.contextOccurrenceId===context.contextOccurrenceId)?.semanticStateDigest===model.board.draft.semanticStateDigest;
  const listPage=(items:readonly ComponentSelectionV1[])=>{const index=Math.min(itemPage,Math.max(0,Math.ceil(items.length/4)-1));return page==="row"?items.filter(item=>item.selectionId===row.id):page==="summary"?items.slice(0,2):items.slice(index*4,(index+1)*4);};
  const pagesFor=(items:readonly ComponentSelectionV1[],label:string)=><BarPageControls index={Math.min(itemPage,Math.max(0,Math.ceil(items.length/4)-1))} count={Math.ceil(items.length/4)} onChange={setItemPage} label={label}/>;
  const beforeScene=page==="summary"||page==="before"||page==="row"&&slot.startsWith("before-");
  const peoplePage=Math.min(itemPage,Math.max(0,Math.ceil(people.length/4)-1));
  return <div ref={editorRoot} className={styles.barLivingEditor} data-bar-living-editor data-bar-step={page} data-inline-dirty={dirty}
    onKeyDown={event=>{if(event.key==="Escape"&&!document.querySelector("dialog[open],[popover]:popover-open")){event.preventDefault();event.stopPropagation();if(page!=="summary")go("summary");else props.onCancel();}}}>
    <fieldset className={styles.barEditableBody} disabled={busy} aria-label="Composition de la sortie">
    <BarMetadata fields={context.fields} model={model} open={open} editing active={page} disabled={busy}>
      {page!=="summary"&&<button type="button" className={styles.barBackArrow} title="Ma sortie" onClick={()=>go("summary")}>←<span className={styles.barVisuallyHidden}> Ma sortie</span></button>}
      {!barLeg(context,"outbound")&&!barLeg(context,"return")&&<button type="button" data-bar-add-route="outbound" className={styles.barMetaTrip} disabled={busy} onClick={()=>open("outbound")}>+ Trajet</button>}
    </BarMetadata>
    {(page==="summary"||["outbound","return","endpoint","fare"].includes(page))&&<div className={styles.barLivingRoutes} aria-label="Déplacements">
      {(["outbound","return"] as const).map(key=>(page==="summary"||key===direction)&&barLeg(context,key)?<BarRouteLine key={key} slot={key} contextId={context.contextOccurrenceId} leg={barLeg(context,key)} model={model} disabled={busy} active={direction===key&&["outbound","return","endpoint","fare"].includes(page)} open={()=>open(key)}/>:null)}
      {barLeg(context,"outbound")&&!barLeg(context,"return")&&!barLeg(context,"outbound")!.returnRequired&&<button type="button" data-bar-add-route="return" className={styles.barInlineAdd} disabled={busy} onClick={()=>open("return")}>+ Retour</button>}
      {barLeg(context,"return")&&!barLeg(context,"outbound")&&<button type="button" data-bar-add-route="outbound" className={styles.barInlineAdd} disabled={busy} onClick={()=>open("outbound")}>+ Aller</button>}
    </div>
    }
    <div className={styles.barLivingSections} data-scene={page}>
    {before&&beforeScene&&<section className={styles.barItemSection} data-bar-before data-bar-section="before" aria-label="Avant de sortir">
      <header><h4>Avant de sortir</h4><button type="button" className={styles.barInlineAdd} aria-label="Compléter le Before" disabled={busy||beforeLocked} onClick={()=>go("before")}>+ Ajouter</button><details><summary aria-label="Actions du Before">⋯</summary><button type="button" disabled={busy||beforeLocked} onClick={removeBefore}>Retirer le Before</button></details></header>
      {beforeLocked&&<p>Ce Before est protégé. Ses composants restent consultables.</p>}
      <div className={styles.barLivingTiles}>{listPage([before.bottle,...before.extras]).map(item=>item.kind==="COMPONENT"?<div key={item.selectionId} data-bar-before-item={item.selectionId} data-bar-active-tile={page==="row"&&item.selectionId===row.id} className={page==="row"&&item.selectionId===row.id?styles.barActiveTile:styles.barEconomicTile}>
        <button type="button" disabled={busy||beforeLocked} aria-expanded={page==="row"&&item.selectionId===row.id} onClick={()=>editComponent(item.selectionId===before.bottle.selectionId?"before-main":"before-extras",item)}><BarComponentFace item={item} fresh={freshProjection}/></button>{page==="row"&&item.selectionId===row.id&&activeRow}
      </div>:<p key={item.selectionId}>Composant lié conservé · options détaillées</p>)}</div>
    {page==="before"&&pagesFor([before.bottle,...before.extras],"Pages du Before")}
    {page==="summary"&&before.extras.length>1&&<button type="button" onClick={()=>go("before")}>Voir les {1+before.extras.length} objets du Before</button>}
    </section>}
    {!before&&page==="before"&&<p>Choisissez une bouteille, une boisson ou un snack pour commencer.</p>}
    {(["extras","before","food","main"] as const).map(key=>{
      const items=barItems(context,key).filter(item=>item.kind==="COMPONENT"||item.kind==="CHILD_CONTEXT");
      if(key==="before"&&before)return null;
      if(page!=="summary"&&!(page==="drinks"&&key==="extras")&&!(page==="row"&&key===slot))return null;
      if(!items.length&&key!=="extras")return null;
      return <section key={key} className={styles.barItemSection} data-bar-section={key} aria-label={sectionLabels[key]}>
        <header><h4>{sectionLabels[key]}</h4>{key==="extras"&&<button type="button" className={styles.barInlineAdd} disabled={busy} aria-label="Ajouter une consommation" onClick={()=>go("drinks")}>+ Ajouter</button>}{page==="summary"&&items.length>2&&<button type="button" onClick={()=>{if(key==="extras")go("drinks");else startLegacy("menu");}}>Voir les {items.length} postes</button>}</header>
        <div className={styles.barLivingTiles} aria-label="Composants économiques">{listPage(items).map(item=><div key={item.selectionId} data-bar-tile={item.selectionId} data-bar-active-tile={page==="row"&&item.selectionId===row.id} className={page==="row"&&item.selectionId===row.id?styles.barActiveTile:styles.barEconomicTile}>
          <button type="button" disabled={busy} aria-expanded={page==="row"&&item.selectionId===row.id}
            draggable={!busy&&!!model.presentation.dragSources[`satellite:${context.contextOccurrenceId}:${key}:${item.selectionId}`]}
            data-drag-source={`satellite:${context.contextOccurrenceId}:${key}:${item.selectionId}`}
            onDragStart={event=>{event.stopPropagation();interaction?.start(`satellite:${context.contextOccurrenceId}:${key}:${item.selectionId}`,event);}}
            onDragEnd={()=>interaction?.end()} onClick={()=>item.kind==="COMPONENT"&&key!=="before"?editComponent(key,item):startLegacy("menu")}>
            <BarComponentFace item={item} amount={card.sockets.find(socket=>socket.slotKey===key)?.evaluations?.find(e=>e.selectionId===item.selectionId)?.economicAmount} fresh={freshProjection}/>
          </button>{page==="row"&&item.selectionId===row.id&&activeRow}
          {item.kind==="CHILD_CONTEXT"&&key==="before"&&<ul className={styles.barChildPreview}>{props.semanticState.contexts.find(child=>child.contextOccurrenceId===item.childContextOccurrenceId)?.slotSelections&&Object.values(props.semanticState.contexts.find(child=>child.contextOccurrenceId===item.childContextOccurrenceId)!.slotSelections).flatMap(selection=>(selection.items as readonly ComponentSelectionV1[]).filter(value=>value.kind==="COMPONENT").map(value=><li key={value.selectionId}>{value.kind==="COMPONENT"?value.label:""}</li>))}</ul>}
        </div>)}</div>
        {page==="drinks"&&pagesFor(items,"Pages des consommations")}
      </section>;
    })}
    </div>
    <section className={styles.barLivingQuestion} aria-label="Décision en cours">
      {page==="place"&&<section data-bar-local-places><label>Chercher dans les lieux enregistrés<input value={query} onChange={e=>{setQuery(e.target.value);setItemPage(0);}} placeholder="Nom, ville…"/></label><p>Lieux enregistrés · <button type="button" onClick={()=>go("google")}>Chercher avec Google Maps</button></p>
        <p>{knownBars.length} lieu(x) correspondant(s) · choisissez une proposition dans le dock.</p>
        <details data-bar-knowledge><summary>Historique et sources</summary>{model.mobilityOptions?.placeKnowledge?<p>{model.mobilityOptions.placeKnowledge.fromDate} – {model.mobilityOptions.placeKnowledge.throughDate} · jours enregistrés, couverture non exhaustive{model.mobilityOptions.placeKnowledge.placesTruncated?" · 500 lieux chargés":""}</p>:<p>Historique non disponible ; lieux enregistrés seulement.</p>}</details></section>}
      {page==="row"?null:page==="legacy"?<NightOutEditor {...props} key={legacyKey} embedded initialView={legacy} onSave={operation=>{const admitted=!busy&&onSave(operation);if(admitted){setDirty(false);move(legacy==="calendar"?"drinks":"summary");}return admitted;}} onCancel={()=>go("summary")}/>
        :page==="quick"?<section data-bar-quick><label>Coût prévu (€)<input autoFocus inputMode="decimal" value={quickAmount} onChange={e=>{setQuickAmount(e.target.value);setDirty(true);}}/></label><p>{quickTotal?"Les détails des consommations seront remplacés, sans double compte. Repas, before et trajets sont en plus.":"Entrées ou contribution, hors consommations, repas et trajets. Ce n’est ni un plafond ni un paiement."}</p><button type="button" disabled={busy||!quickAmount.trim()} onClick={saveQuick}>Retenir ce coût</button></section>
        :page==="date"?<div className={styles.barInlineCalendar} data-bar-calendar onKeyDown={event=>{
          const keys=["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End"];if(!keys.includes(event.key))return;
          const button=(event.target as HTMLElement).closest<HTMLButtonElement>("[data-bar-day]");if(!button)return;
          event.preventDefault();event.stopPropagation();const day=Number(button.dataset.barDay),count=new Date(Number(props.semanticState.targetMonth.slice(0,4)),Number(props.semanticState.targetMonth.slice(5)),0).getDate();
          const weekday=(new Date(`${props.semanticState.targetMonth}-${String(day).padStart(2,"0")}T12:00:00Z`).getUTCDay()+6)%7;
          const delta=({ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7,Home:-weekday,End:6-weekday} as Record<string,number>)[event.key];
          const next=props.semanticState.targetMonth+"-"+String(Math.max(1,Math.min(count,day+delta))).padStart(2,"0");setCalendarFocus(next);
          requestAnimationFrame(()=>editorRoot.current?.querySelector<HTMLButtonElement>(`[data-bar-calendar] button[aria-label="${next}"]`)?.focus());
        }}><h4>{new Intl.DateTimeFormat("fr-FR",{month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(props.semanticState.targetMonth+"-01T12:00:00Z"))}</h4><div role="group" aria-label="Jours du mois · flèches pour naviguer">
          {["L","M","M","J","V","S","D"].map((label,index)=><small key={index}>{label}</small>)}
          {Array.from({length:(new Date(props.semanticState.targetMonth+"-01T12:00:00Z").getUTCDay()+6)%7},(_,i)=><span key={"blank"+i}/>)}
          {Array.from({length:new Date(Number(props.semanticState.targetMonth.slice(0,4)),Number(props.semanticState.targetMonth.slice(5)),0).getDate()},(_,i)=>{const date=props.semanticState.targetMonth+"-"+String(i+1).padStart(2,"0");return <button type="button" key={date} data-bar-day={i+1} tabIndex={calendarFocus===date?0:-1} aria-label={date} aria-pressed={context.fields.plannedDate===date} onClick={()=>{setCalendarFocus(date);decide({kind:"EDIT_NIGHT_OUT",edit:{contextOccurrenceId:context.contextOccurrenceId,fields:{plannedDate:date}}},"date");}}>{i+1}</button>;})}
        </div>{context.fields.plannedDate&&<button type="button" className={styles.barInlineAdd} disabled={busy} onClick={()=>decide({kind:"EDIT_NIGHT_OUT",edit:{contextOccurrenceId:context.contextOccurrenceId,fields:{plannedDate:null}}},"date")}>Retirer la date</button>}</div>
        :page==="people"?<section data-bar-people><h4>Personnes</h4><div className={styles.barLivingMetadata}>{people.slice(peoplePage*4,(peoplePage+1)*4).map(p=><button type="button" key={prospectivePersonIdentity(p)} onClick={()=>togglePerson(p)}>{barPersonLabel(p,model)} ×</button>)}</div><BarPageControls index={Math.min(itemPage,Math.max(0,Math.ceil(people.length/4)-1))} count={Math.ceil(people.length/4)} onChange={setItemPage} label="Pages des participants"/><label>Autre prénom<input value={personName} maxLength={120} onChange={e=>{setPersonName(e.target.value);setDirty(true);}}/></label><button type="button" disabled={busy||!personName.trim()} onClick={()=>{const person={kind:"TEXT" as const,label:personName.trim()};if(!people.some(p=>prospectivePersonIdentity(p)===prospectivePersonIdentity(person))){const next=[...people,person];if(decide({kind:"EDIT_NIGHT_OUT",edit:{contextOccurrenceId:context.contextOccurrenceId,fields:{participantRefs:next}}},"people")){setPeople(next);setPersonName("");}}}}>Ajouter ce prénom</button></section>
        :page==="google"?<BarPlaceSearch initialCity={searchCity} initialSearch={googleSearch??{query:queries.place??"",city:searchCity??"",resultPage:0}} onSearchChange={saveGoogleSearch} places={model.mobilityOptions?.places??[]} onKnown={id=>choosePlace({kind:"KNOWN",placeId:id})} onText={label=>choosePlace({kind:"TEXT",label,provenance:"USER_DECLARED_PROSPECTIVE"})}/>
        :page==="manual-place"?<><label>Nom ou adresse libre<input autoFocus maxLength={120} value={manual} onChange={e=>{setManual(e.target.value);setDirty(true);}}/></label><button type="button" disabled={!manual.trim()||busy} onClick={()=>choosePlace({kind:"TEXT",label:manual.trim(),provenance:"USER_DECLARED_PROSPECTIVE"})}>Retenir ce repère</button><small>Repère textuel uniquement · distance et itinéraire à préciser.</small></>
        :page==="endpoint"?<><label>Autre point du trajet<input maxLength={120} value={manual} onChange={e=>{setManual(e.target.value);setDirty(true);}}/></label><button type="button" disabled={busy||!manual.trim()} onClick={()=>chooseEndpoint({kind:"TEXT",label:manual.trim(),provenance:"USER_DECLARED_PROSPECTIVE"},true)}>Retenir ce point libre</button><small>Repère textuel uniquement · itinéraire et distance à préciser.</small></>
        :page==="fare"&&leg?<><label>Coût prévu du billet ou de la course (€)<input autoFocus inputMode="decimal" value={fare} placeholder="Encore inconnu" onChange={event=>{setFare(event.target.value);setDirty(true);}}/></label>
          {leg.pricing?.fare.kind==="QUOTE"&&<p>Le devis reste conservé tant qu’un prix de remplacement n’est pas validé.</p>}
          <button type="button" disabled={busy||!fare.trim()} onClick={saveFare}>Retenir le coût du trajet</button>
          <p>Prix du billet ou de la course, hors carburant estimé, péage et stationnement. Le financement existant reste à vérifier.</p></>
        :page==="outbound"||page==="return"?<>
          {leg&&<div className={styles.barLivingMetadata}>{(["origin","destination"] as const).map(key=><button type="button" key={key} onClick={()=>targetEndpoint(key)}>{key==="origin"?"Départ":"Arrivée"} · {barPlaceLabel(leg[key],model)}</button>)}
            {leg.optionKey==="car"&&model.mobilityOptions?.vehicle?.vehicleId&&<button type="button" onClick={chooseVehicle}>Utiliser {model.mobilityOptions.vehicle.label}</button>}
            <button type="button" onClick={()=>confirm({message:"Retirer uniquement ce trajet ? Les consommations et l’autre sens restent conservés.",acceptLabel:"Retirer le trajet",accept:()=>decide({kind:"EDIT_NIGHT_OUT",edit:{contextOccurrenceId:context.contextOccurrenceId,fields:{},slots:{[direction]:barItems(context,direction).filter(item=>item.selectionId!==leg.selectionId)}}})})}>Retirer ce trajet</button>
            <button type="button" onClick={targetFare}>Préciser le prix du trajet</button>
            <button type="button" onClick={()=>startLegacy("menu")}>Financement ou relation détaillée</button></div>}</>
        :null}
      {pendingEndpoint&&<section data-bar-price-arbitration aria-label="Prix affectés de ce trajet">
        <p>Ce point change pour {direction==="outbound"?"l’aller":"le retour"}. À revoir : {barEndpointCosts(pendingEndpoint.leg,pendingEndpoint.key).join(", ")}. Le trajet et ses prix sont encore inchangés.</p>
        {pendingEndpoint.leg.pricing?.fare.kind==="MANUAL"&&barEndpointCosts(pendingEndpoint.leg,pendingEndpoint.key).length===1&&<button type="button" disabled={busy} onClick={()=>resolveEndpoint("RETAIN_MANUAL")}>Retenir {pendingEndpoint.leg.pricing.fare.unitAmount} € comme nouvelle estimation</button>}
        <button type="button" disabled={busy} onClick={()=>resolveEndpoint("UNKNOWN")}>Mettre ces prix à préciser</button>
        <button type="button" onClick={()=>setPendingEndpoint(null)}>Conserver cet itinéraire</button>
      </section>}
      {(error||serverError)&&<p role="alert">{error||serverError}</p>}
    </section>
    </fieldset>
    {page!=="legacy"&&question.choices.length>0&&dockHost&&createPortal(<ContextPalette card={card} model={model} busy={busy} configure appearance="bar" question={question} choose={()=>{}} close={()=>go("summary")}/>,dockHost)}
  </div>;
}
