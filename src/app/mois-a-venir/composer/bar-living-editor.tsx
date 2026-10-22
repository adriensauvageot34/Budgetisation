"use client";
import {useCallback,useEffect,useRef,useState,type ComponentProps} from "react";
import {createPortal} from "react-dom";
import type {PersonalGooglePlace} from "@/domain/phase2/personal-google-place";
import type {ProspectivePersonRef,ProspectivePlaceRef} from "@/domain/phase2/planned-contract";
import {assetsForModule,PLANNED_ASSET_CATALOG_VERSION,type PlannedAsset} from "@/domain/phase2/planned-assets";
import {stopForPlace} from "@/domain/phase2/planned-routes";
import {decisionAmount} from "@/domain/phase2/month-decision-contract";
import type {ComponentSelectionV1} from "@/domain/phase2/planner/component-contract";
import type {ComposerOperation} from "@/domain/phase2/planner/composer-ui-contract";
import {NightOutEditor} from "./night-out-workshop";
import {ContextPalette,type PaletteQuestion} from "./context-palette";
import {barItems,barLeg,barEndpoint,barPlaceOperation,barVenueAdaptations,barSameModeReturn,barReverseLeg,assertBarRouteEditable,barEndpointCosts,type BarTarget,type BarLeg} from "./bar-living-operations";
import {parseNightOutVenue,venueBinding,type NightOutVenueDecision,type BarGoogleRef,type VenueEndpointBinding} from "@/domain/phase2/planner/night-out-venue";
import {substituteNightOutCoverage} from "@/domain/phase2/planner/night-out-edit";
import {barPlaceLabel,barModeLabel,barPeopleLabel} from "./bar-living-card";
import {fresh,fromSelection,buildComponentRow,type Row} from "./night-out-components";
import {WorkshopComponentRow} from "./workshop-component-row";
import {useActiveWorkshopQuestion} from "./workshop-choices";
import {useCommittedEvent} from "./use-committed-event";
import {useWorkshopRaw} from "./inline-edit-registry";
import {useWorkshopConfirmation} from "./workshop-confirmation";
import {useComposerInteractions} from "./interactions";
import {barPlaces,barPlaceHint,barEndpointSuggestions,barHomePlaces,barEndpointLabel,barResolvablePlace} from "./bar-place-knowledge";
import {BarPlaceSearch,type BarPlaceSearchState} from "./bar-place-search";
import {barSearchText} from "./bar-search";
import {barBefore,barBeforePatch,barBeforeRemove} from "./bar-before";
import {money} from "./display";
import {BarRouteLine,BarComponentFace,barPersonLabel,type BarRouteAction} from "./bar-living-details";
import {SOCIAL_CONTACTS_V1} from "@/domain/phase2/planned-rules";
import {prospectivePersonIdentity} from "@/domain/phase2/planned-product";
import {BarPageControls} from "./bar-pages";
import type {BarViewMemory} from "./bar-view-memory";
import {MoreHorizontal,Pencil,Route,MapPin,ArrowLeftRight,Clock3,CarFront,Ticket,Trash2} from "lucide-react";
import {AtomicPopover} from "./atomic-popover";
import styles from "./composer.module.css";
import {componentPresentationGroups} from '@/domain/phase2/planner/component-group-presentation';
import {BarComponentGroup} from './bar-component-group';
import {BarMomentRail} from './bar-moment-rail';
import {barDockDrag} from './bar-dock-drag';
import {nightOutConsumption,globalConsumptionCovers} from '@/domain/phase2/planner/night-out-consumption';
import {plannerDigest} from '@/domain/phase2/planner/json';
import {BarRouteEndpointSearch} from './bar-route-endpoint-search';
import type {RouteEndpointBinding} from '@/domain/phase2/planner/route-endpoint';

type Page=Exclude<BarTarget,`component:${string}:${string}`|`route:${string}:${string}`>|"manual-place"|"google"|"row"|"endpoint"|"endpoint-free"|"return-choice"|"route-time"|"legacy"|"fare"|"vehicle"|"quick"|"coverage"|"before"|"more"|"venue-change"|"known-routes";
type Component=Extract<ComponentSelectionV1,{kind:"COMPONENT"}>;
// Reuse published compatible food definitions, under this Bar's component owner.
// EDIT_NIGHT_OUT admits bar/club/house_party refs; Restaurant remains a separate event.
const catalog=[...assetsForModule("bar").filter(asset=>!/(?:parking|entry)$/u.test(asset.assetKey)),
  ...assetsForModule("house_party").filter(asset=>["snack","chips"].includes(asset.assetKey.split(":").at(-1)??"")),
  ...assetsForModule("club").filter(asset=>asset.assetKey==="club:food")];
const beforeCatalog=assetsForModule("house_party");
export function BarLivingEditor(props:ComponentProps<typeof NightOutEditor>&{initialTarget?:BarTarget;targetRequest?:number;initialBarView?:BarViewMemory;previewPending?:boolean;onViewChange?:(view:BarViewMemory)=>void}) {
  const {context,model,card,dockHost,onSave,serverError}=props;
  const busy=props.busy||!!card?.readOnly||props.semanticState.preferences.anchors.includes(context.contextOccurrenceId)||props.semanticState.preferences.flexibility[context.contextOccurrenceId]==="PRESERVE";
  const initialRoute=props.initialTarget?.startsWith("route:")?props.initialTarget.split(":"):null;
  const initialComponent=props.initialTarget?.startsWith("component:")?props.initialTarget.split(":"):null;
  const initialBefore=barBefore(props.semanticState,context);
  const consumptionState=nightOutConsumption(context);
  const consumption=consumptionState?.version==="night-out-consumption@v1"?consumptionState:null;
  const globalConsumption=consumptionState?.version==="night-out-consumption@v2"?consumptionState:null;
  const globalActive=globalConsumption?.mode==="GLOBAL";
  const inlineStateDigest=useRef("");
  const [inlineEditing,setInlineEditing]=useState(false),[detailsChosen,setDetailsChosen]=useState(false);
  const [openMoments,setOpenMoments]=useState({before:!!initialBefore,bar:barItems(context,"extras").some(i=>i.selectionId!==consumption?.directSelectionId)});
  const [amountHost,setAmountHost]=useState<HTMLElement|null>(null),[routeHost,setRouteHost]=useState<HTMLElement|null>(null);
  const inlineCommitted=useRef(false);
  const composingAmount=useRef(false);
  const initialItems=initialComponent?.[1]==="before-main"?initialBefore?[initialBefore.bottle]:[]:initialComponent?.[1]==="before-extras"?initialBefore?.extras??[]:initialComponent?barItems(context,initialComponent[1]):[];
  const initialSelection=initialComponent?initialItems.find(item=>item.selectionId===initialComponent[2]):undefined;
  const [page,setPage]=useState<Page>(()=>initialSelection?.kind==="COMPONENT"?"row":props.initialTarget?.startsWith("component:")?"summary":initialRoute?(initialRoute[2]==="fare"?"fare":initialRoute[2]==="vehicle"?"vehicle":"endpoint"):props.initialTarget as Page??"summary");
  const [legacy,setLegacy]=useState<"people"|"calendar"|"menu"|"main">("menu"),[legacyKey,setLegacyKey]=useState(0);
  const [row,setRow]=useState<Row>(()=>initialSelection?.kind==="COMPONENT"?fromSelection(initialSelection):fresh()),[slot,setSlot]=useState(initialComponent?.[1]??"extras"),[dirty,setDirty]=useState(false);
  const [families,setFamilies]=useState<Record<"bar"|"before","drinks"|"food"|null>>(()=>props.initialBarView?.families??{bar:props.initialBarView?.family??null,before:null});
  const [moment,setMoment]=useState<'before'|'bar'>(()=>props.initialTarget==='before'||initialComponent?.[1]?.startsWith('before-')?'before':props.initialBarView?.moment??'bar');
  const activeMoment=page==="before"||page==="row"&&slot.startsWith("before-")?"before":page==="drinks"?'bar':moment;
  const family=families[activeMoment];
  const setFamily=(value:"drinks"|"food"|null)=>setFamilies(previous=>({...previous,[activeMoment]:value}));
  const [advancedRow,setAdvancedRow]=useState(false),[manual,setManual]=useState(""),[allPlaces,setAllPlaces]=useState(props.initialBarView?.allPlaces??false),[allEndpoints,setAllEndpoints]=useState(false),[allBefore,setAllBefore]=useState(props.initialBarView?.allBefore??false),[error,setError]=useState("");
  const [queries,setQueries]=useState<Record<string,string>>(()=>props.initialBarView?.queries??{});
  const [personalPlaces,setPersonalPlaces]=useState<readonly PersonalGooglePlace[]>([]);
  const savePersonalSuggestions=useCallback((places:readonly PersonalGooglePlace[])=>setPersonalPlaces(previous=>JSON.stringify(previous)===JSON.stringify(places)?previous:places),[]);
  const [googleSearch,setGoogleSearch]=useState<BarPlaceSearchState|undefined>(()=>props.initialBarView?.googleSearch);
  const [pendingVenue,setPendingVenue]=useState<{venue:NightOutVenueDecision;snapshot:string}|null>(null);
  const [calendarFocus,setCalendarFocus]=useState(()=>typeof context.fields.plannedDate==="string"?context.fields.plannedDate:props.semanticState.targetMonth+"-01");
  const [fare,setFare]=useState(()=>{const leg=initialRoute&&barLeg(context,initialRoute[1] as "outbound"|"return");return initialRoute?.[2]==="fare"&&leg&&leg.pricing?.fare.kind==="MANUAL"?leg.pricing.fare.unitAmount:"";});
  const [itemPage,setItemPage]=useState(()=>props.initialBarView?.pages[props.initialTarget??"summary"]??0);
  const [dockScroll,setDockScroll]=useState<Record<string,number>>(()=>props.initialBarView?.dockScroll??{});
  const saveDockScroll=useCallback((key:string,index:number)=>setDockScroll(previous=>({...previous,[key]:index})),[]);
  const [people,setPeople]=useState<ProspectivePersonRef[]>(()=>Array.isArray(context.fields.participantRefs)?context.fields.participantRefs as ProspectivePersonRef[]:[]);
  const [personName,setPersonName]=useState("");
  const [quickAmount,setQuickAmount]=useState(()=>{const item=barItems(context,"main")[0];return props.initialTarget==="quick"&&item?.kind==="COMPONENT"&&item.cost.kind==="MANUAL"?item.cost.unitAmount:"";}),[pendingAsset,setPendingAsset]=useState<PlannedAsset|null>(null),[pendingShared,setPendingShared]=useState(false);
  const [routeModes,setRouteModes]=useState(props.initialTarget==="outbound"||props.initialTarget==="return");

  const [routeTime,setRouteTime]=useState("");
  const [direction,setDirection]=useState<"outbound"|"return">(props.initialTarget==="return"||initialRoute?.[1]==="return"?"return":"outbound"),[endpoint,setEndpoint]=useState<"origin"|"destination">(initialRoute?.[2]==="destination"?"destination":"origin");

  const searchScope=page==="endpoint"?`endpoint:${direction}:${endpoint}`:(page==="row"?slot.startsWith("before-")?"before":"drinks":page)+((page==="row"||page==="before"||page==="drinks")?":"+(family??"families"):"");
  const query=queries[searchScope]??"";
  const setQuery=(value:string)=>{setQueries(previous=>({...previous,[searchScope]:value}));if(searchScope==="place")setGoogleSearch(undefined);};
  const saveGoogleSearch=useCallback((state:BarPlaceSearchState)=>{setGoogleSearch(previous=>previous?.query===state.query&&previous.city===state.city&&previous.googleOn===state.googleOn&&previous.resultPage===state.resultPage&&previous.detail===state.detail&&previous.detailReadAt===state.detailReadAt&&previous.personalPlacesEnabled===state.personalPlacesEnabled?previous:state);setQueries(previous=>previous.place===state.query?previous:{...previous,place:state.query});},[]);
  const savedPages=useRef<Record<string,number>>({...props.initialBarView?.pages});
  const previousPage=useRef(page);
  useEffect(()=>{
    savedPages.current[page]=itemPage;
    props.onViewChange?.({queries,googleSearch,pages:{...savedPages.current},dockScroll,allPlaces,allBefore,family,families,moment:activeMoment});
  },[page,itemPage,queries,googleSearch,dockScroll,allPlaces,allBefore,family,families,activeMoment,props.onViewChange]);
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
    setFare("");setRouteTime("");setQuickAmount("");setInlineEditing(false);setDirty(false);
  },"bar-living",canSaveBuffer()?{label:page==="row"&&row.costMode==="MANUAL"?`Enregistrer ${row.amount} €`:"Enregistrer cette saisie",run:()=>saveBuffer(),
    bufferKey:JSON.stringify({page,row,slot,manual,people,personName,fare,routeTime,quickAmount,direction,slots:context.slotSelections,fields:context.fields,before:before?.child,busy})}:undefined);
  const [resume,setResume]=useState<(()=>void)|null>(null);
  const resumeGo=useCommittedEvent((next:Page)=>go(next));
  const resumeOpen=useCommittedEvent((target:BarTarget)=>open(target));
  // Header navigation changes the target, not the lifetime of this editor.
  // The shell guards RAW first; keep scoped searches and paging in memory.
  const lastTargetRequest=useRef(props.targetRequest);
  useEffect(()=>{if(lastTargetRequest.current===props.targetRequest)return;lastTargetRequest.current=props.targetRequest;resumeOpen(props.initialTarget??"summary");},[props.targetRequest,props.initialTarget,resumeOpen]);
  const resumeAdd=useCommittedEvent((asset:PlannedAsset,included?:boolean)=>add(asset,included));
  const resumeEdit=useCommittedEvent((target:string,id:string)=>{const item=rowItems(target).find(i=>i.selectionId===id);if(item?.kind==="COMPONENT")editComponent(target,item);});
  const resumeLegacy=useCommittedEvent((target:typeof legacy)=>startLegacy(target));
  const resumeEndpoint=useCommittedEvent((key:"origin"|"destination")=>targetEndpoint(key));
  const resumeTogglePerson=useCommittedEvent((person:ProspectivePersonRef)=>togglePerson(person));
  const resumeEndpointChoice=useCommittedEvent((place:ProspectivePlaceRef|null,bind:boolean=false,googleId?:string)=>chooseEndpoint(place,false,bind,googleId));

  const resumeBefore=useCommittedEvent((asset:PlannedAsset)=>addBefore(asset));
  const resumeShared=useCommittedEvent((included?:boolean)=>addShared(included));
  const resumeRemoveBefore=useCommittedEvent(()=>removeBefore());
  const resumeInline=useCommittedEvent(()=>beginInline());
  const resumeDetails=useCommittedEvent(()=>revealDetails());
  const resumeDirect=useCommittedEvent(()=>returnDirect());
  const resumeMoment=useCommittedEvent((target:"before"|"bar")=>selectMoment(target));
  const resumeFare=useCommittedEvent(()=>targetFare());
  const resumeRouteAction=useCommittedEvent((slot:"outbound"|"return",action:BarRouteAction)=>routeAction(slot,action));
  const resumeMode=useCommittedEvent((key:string,fromHome:boolean)=>chooseMode(key,fromHome));
  // Resume after the admitted Draft has committed, using current handlers rather
  // than a closure that still contains the pre-save slot arrays.
  const guard=(continuation:()=>void)=>rawGuard(()=>setResume(()=>continuation));
  useEffect(()=>{if(resume){setResume(null);resume();}},[resume]);
  const editorRoot=useRef<HTMLDivElement>(null);
  useEffect(()=>{const card=editorRoot.current?.closest('[data-bar-living-card]');setAmountHost(card?.querySelector<HTMLElement>('[data-bar-open-amount]')??null);setRouteHost(card?.querySelector<HTMLElement>('[data-bar-route-host]')??null);},[]);
  useEffect(()=>{if(page==="quick"){setPage("summary");returnDirect();}},[page]);
  const sceneTrigger=useRef<HTMLElement|null>(null);
  useEffect(()=>{
    const trigger=sceneTrigger.current;sceneTrigger.current=null;
    // A scene may remove its own trigger (Back, a dock answer). Keep keyboard
    // navigation inside this card, without stealing focus from surviving inputs.
    if(trigger&&typeof document!=="undefined"&&!trigger.isConnected&&document.activeElement===document.body)editorRoot.current?.focus({preventScroll:true});
  },[page]);
  // Selection must not scroll the Board or its ancestors. Only reveal a newly
  // added/off-screen product inside its own moment rail.
  useEffect(()=>{if(page!=="row")return;const tile=editorRoot.current?.querySelector<HTMLElement>('[data-bar-active-tile="true"]'),rail=tile?.closest<HTMLElement>('[data-bar-moment-rail]');if(!tile||!rail)return;const item=tile.getBoundingClientRect(),bounds=rail.getBoundingClientRect();if(item.left<bounds.left)rail.scrollLeft-=bounds.left-item.left;else if(item.right>bounds.right)rail.scrollLeft+=item.right-bounds.right;},[page,row.id]);
  const [pendingEndpoint,setPendingEndpoint]=useState<{leg:BarLeg;key:"origin"|"destination";place:ProspectivePlaceRef|null;binding?:VenueEndpointBinding;routeBinding?:RouteEndpointBinding}|null>(null);
  function canSaveBuffer(){try{
    if(inlineEditing)return !busy&&!composingAmount.current&&!!quickAmount.trim()&&!/[.,]$/u.test(quickAmount.trim())&&(decisionAmount(quickAmount.trim().replace(",",".")),true);
    if(busy||page==="row"&&slot.startsWith("before-")&&beforeLocked)return false;
    if(page==="row"){if(/[.,]$/u.test(row.quantity)||row.costMode==="MANUAL"&&/[.,]$/u.test(row.amount))return false;buildComponentRow(row,row.existing?.optionKey??"extra");return true;}
    if(page==="manual-place"||page==="endpoint-free")return !!manual.trim();
    if(page==="people")return !personName.trim();
    if(page==="fare"){decisionAmount(fare.trim().replace(",","."));return !!fare.trim();}
    if(page==="route-time")return !routeTime||/^(?:[01]\d|2[0-3]):[0-5]\d$/u.test(routeTime);

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
  const move=(next:Page)=>{if(next==='before')setMoment('before');if(next==='drinks')setMoment('bar');if(next!==page&&typeof document!=="undefined"&&typeof HTMLElement!=="undefined"&&document.activeElement instanceof HTMLElement)sceneTrigger.current=document.activeElement;savedPages.current[previousPage.current]=itemPage;previousPage.current=next;setPendingEndpoint(null);if(next==="outbound"||next==="return")setDirection(next);setPage(next);setItemPage(savedPages.current[next]??0);setError("");};
  const go=(next:Page)=>{if(guard(()=>resumeGo(next)))move(next);};
  const decide=(operation:ComposerOperation,next:Page="summary")=>{
    try{if(busy){setError("Cette carte est protégée ou une opération est en cours. Aucun choix n’a été admis.");return false;}if(onSave(operation)){setDirty(false);move(next);return true;}setError("Ce choix n’a pas été admis. Votre saisie est conservée ; vérifiez le message du Board.");}
    catch(failure){setError(failure instanceof Error?failure.message:"Choix non admis. Votre saisie est conservée.");}
    return false;
  };
  const startLegacy=(target:typeof legacy)=>{if(!guard(()=>resumeLegacy(target)))return;setLegacy(target);setLegacyKey(k=>k+1);move("legacy");};
  const modeOperation=(mode:"DIRECT"|"DETAILED",extra:{amount?:string;selectionId?:string;acceptLegacy?:boolean}={}):ComposerOperation=>({kind:"EDIT_NIGHT_OUT",edit:{contextOccurrenceId:context.contextOccurrenceId,fields:{},consumption:{expectedContextDigest:plannerDigest(context),mode,...extra}}});
  function saveInline():boolean {
    if(inlineCommitted.current)return true;
    try{
      if(composingAmount.current||!quickAmount.trim()||/[.,]$/u.test(quickAmount.trim()))throw Error("Terminez le montant ; la saisie reste disponible.");
      const amount=decisionAmount(quickAmount.trim().replace(",","."));
      const operation:ComposerOperation={kind:"EDIT_NIGHT_OUT",edit:{contextOccurrenceId:context.contextOccurrenceId,fields:{},globalConsumption:{version:"night-out-consumption@v2",mode:"GLOBAL",expectedStateDigest:inlineStateDigest.current,amount,selectionId:crypto.randomUUID(),confirmed:true}}};
      if(!decide(operation))return false;
      inlineCommitted.current=true;setInlineEditing(false);return true;
    }catch(failure){setError(failure instanceof Error?failure.message:"Vérifiez le montant.");return false;}
  }
  const beginInline=()=>{
    if(busy||inlineEditing||!guard(resumeInline))return;
    if(consumption?.mode==="DIRECT"){setError("Ce montant historique couvre seulement Au bar. Revenez d’abord aux prix détaillés pour choisir un global Before + Au bar.");return;}
    const begin=()=>{inlineStateDigest.current=plannerDigest(props.semanticState);setQuickAmount(globalConsumption?.amount??"");setError("");inlineCommitted.current=false;setInlineEditing(true);};
    if(!globalActive)confirm({message:"Utiliser un prix global pour les consommations ? Les consommations Before et Au bar restent présentes ; leurs prix individuels ne seront plus comptés. Vous pourrez revenir au détail. Les trajets, repas et contributions indépendantes restent additionnels.",cancelLabel:"Annuler",acceptLabel:"Utiliser un prix global",accept:begin});else begin();
  };
  const detailed=!!globalConsumption||consumption?.mode==="DETAILED"||!consumption&&barItems(context,"extras").length>0;
  const showMoments=detailsChosen||detailed||!!before;
  const revealDetails=()=>{if(!guard(resumeDetails))return;
    if(globalConsumption){if(decide({kind:"EDIT_NIGHT_OUT",edit:{contextOccurrenceId:context.contextOccurrenceId,fields:{},globalConsumption:{version:"night-out-consumption@v2",mode:"DETAILED",expectedStateDigest:plannerDigest(props.semanticState)}}},"drinks")){setDetailsChosen(true);setOpenMoments(v=>({...v,bar:true}));}return;}
    const apply=()=>{if(decide(modeOperation("DETAILED",{...(!consumption?{acceptLegacy:true}:{})}),"drinks")){setDetailsChosen(true);setOpenMoments(v=>({...v,bar:true}));}};
    if(consumption?.mode==='DIRECT')confirm({message:"Détailler les consommations Au bar ? Le montant direct ne sera plus utilisé pour ce moment. Il restera conservé pour pouvoir revenir en arrière. Le Before, les trajets et les autres contributions restent inchangés.",cancelLabel:"Annuler",acceptLabel:"Détailler Au bar",accept:apply});
    else if(!consumption&&barItems(context,"extras").length)confirm({message:"Conserver les consommations existantes comme détails ? Aucun poste ni financement ne sera remplacé.",acceptLabel:"Conserver les détails",accept:apply});else apply();
  };
  const returnDirect=()=>{beginInline();};
  const selectMoment=(target:"before"|"bar")=>{if(!guard(()=>resumeMoment(target)))return;if(target==="bar"&&consumption?.mode==="DIRECT"){revealDetails();return;}setOpenMoments(v=>({...v,[target]:true}));move(target==="before"?"before":"drinks");};
  const summary=model?.nightOutSummaries?.find(s=>s.contextOccurrenceId===context.contextOccurrenceId);
  const amountControls=<div data-r72-inline className={styles.barProgressiveAmount}>
    {inlineEditing?<label className={styles.barInlineAmountLabel}><span className={styles.barVisuallyHidden}>Coût prévu des consommations (€)</span><input data-bar-inline-amount autoFocus aria-label="Coût prévu des consommations (€)" inputMode="decimal" value={quickAmount} disabled={busy}
      onChange={e=>{inlineCommitted.current=false;setQuickAmount(e.target.value);setDirty(true);}}
      onCompositionStart={()=>{composingAmount.current=true;}} onCompositionEnd={()=>{composingAmount.current=false;}}
      onBlur={()=>{if(dirty)saveInline();else setInlineEditing(false);}}
      onKeyDown={e=>{if(composingAmount.current||e.nativeEvent?.isComposing)return;if(e.key==="Enter"){e.preventDefault();e.stopPropagation();saveInline();}if(e.key==="Escape"){e.preventDefault();e.stopPropagation();inlineCommitted.current=true;setInlineEditing(false);setDirty(false);setQuickAmount("");setError("");}}}/></label>
      :<button type="button" data-bar-derived-amount data-bar-inline-trigger disabled={busy} aria-label="Modifier le prix global des consommations" title="Total de sortie ; modifier le global des consommations Before + Au bar, hors trajets" onClick={returnDirect}>{summary?.knownAmount!=null?money(summary.knownAmount)+(summary.costIncomplete?" + ?":""):"… €"}</button>}
    {inlineEditing&&<small>Consommations Before + Au bar · hors trajets</small>}
    {globalConsumption&&!inlineEditing&&<small>{globalActive?'Consommations : '+money(globalConsumption.amount)+' global · hors trajets':'Prix détaillés'} <button type="button" disabled={busy||beforeLocked} onClick={globalActive?revealDetails:beginInline}>{globalActive?'Revenir aux prix détaillés':'Reprendre le prix global'}</button></small>}
  </div>;
  const open=(target:BarTarget)=>{if(!guard(()=>resumeOpen(target)))return;
    if(target.startsWith("route:")){const [,dir,key]=target.split(":");setDirection(dir as "outbound"|"return");setAllEndpoints(false);setManual("");if(key==="vehicle"){move("vehicle");}else if(key==="fare"){const actual=barLeg(context,dir as "outbound"|"return");setFare(actual?.pricing?.fare.kind==="MANUAL"?actual.pricing.fare.unitAmount:"");move("fare");}else{setEndpoint(key as "origin"|"destination");move("endpoint");}return;}
    if(target==="quick"&&(!consumption||consumption.mode==="DIRECT")){beginInline();return;}
    if(target==="quick"){returnDirect();return;}
    if(target==="return"&&!barLeg(context,"return")&&barLeg(context,"outbound")){setDirection("return");move("return-choice");return;}
    if(target==="outbound"||target==="return")setRouteModes(true);
    if(target==="people"){setPeople(Array.isArray(context.fields.participantRefs)?context.fields.participantRefs as ProspectivePersonRef[]:[]);move("people");return;}
    if(target.startsWith("component:")){const [,slot,id]=target.split(":");const item=rowItems(slot).find(item=>item.selectionId===id);if(item?.kind==="COMPONENT")editComponent(slot,item);return;}
    move(target as Page);
  };
  const selectedPlace=context.fields.placeRef as ProspectivePlaceRef|undefined;
  const routeVenue=selectedPlace?.kind==='KNOWN'&&model.mobilityOptions?.places.some(p=>p.placeId===selectedPlace.placeId&&barResolvablePlace(p))||selectedPlace?.kind==='TEXT'&&!!context.fields.venueDecision&&!!parseNightOutVenue(context.fields.venueDecision).google?selectedPlace:undefined;
  const homes=barHomePlaces(model.mobilityOptions?.places??[]);
  const homeCities=[...new Set(homes.map(place=>place.commune?.trim()).filter((value):value is string=>!!value))];
  // A household address is not consent to constrain a public-place search.
  const selectedVenue=context.fields.venueDecision?parseNightOutVenue(context.fields.venueDecision):null;
  const choosePlace=(place:ProspectivePlaceRef,google?:BarGoogleRef)=>{
    const venue=parseNightOutVenue({version:"night-out-venue@v1",decisionId:crypto.randomUUID(),place,...(google?{google}:{}),provenance:"EXPLICIT_USER_DECISION"});
    if(barVenueAdaptations(context).length){setPendingVenue({venue,snapshot:decisionSnapshot()});move("venue-change");return false;}
    return decide(barPlaceOperation(context,place,venue),"summary");
  };
  const commitVenue=(adapt:boolean)=>{if(!pendingVenue)return;if(pendingVenue.snapshot!==decisionSnapshot()){setError("La sortie a changé. Choisissez à nouveau le bar avant d’adapter ses trajets.");return;}
    try{if(decide(barPlaceOperation(context,pendingVenue.venue.place,pendingVenue.venue,adapt),"summary"))setPendingVenue(null);}catch(failure){setError((failure as Error).message);}};
  const editComponent=(target:string,selection:Component)=>{if(!guard(()=>resumeEdit(target,selection.selectionId)))return;setSlot(target);setAdvancedRow(false);setRow(fromSelection(selection));move("row");};
  const add=(asset:PlannedAsset,included?:boolean)=>{
    if(!guard(()=>resumeAdd(asset,included)))return;
    if(included===undefined&&!!coveredMain) {setPendingAsset(asset);move("coverage");return;}
    const value=buildComponentRow({...fresh(asset.label),assetRef:{catalogVersion:PLANNED_ASSET_CATALOG_VERSION,assetKey:asset.assetKey,labelAtSelection:asset.label,provenance:"EXPLICIT_USER_DECISION"}},"extra");
    try{const edit=included?substituteNightOutCoverage(context,coveredMain?.selectionId??"",value):{contextOccurrenceId:context.contextOccurrenceId,fields:{},slots:{extras:[...barItems(context,"extras"),value]}};
      if(decide({kind:"EDIT_NIGHT_OUT",edit},"row")){setPendingAsset(null);setSlot("extras");setAdvancedRow(false);setRow(fromSelection(value));}
    }catch(failure){setError("Ce poste ancien n’a pas de portée de remplacement certaine, ou possède un financement. Conservez-le, choisissez « Ajouter en plus » ou rééditez explicitement son coût. Aucun poste n’est supprimé.");}
  };

  const addBefore=(asset:PlannedAsset)=>{
    if(!guard(()=>resumeBefore(asset))||busy||beforeLocked)return;
    try{const value=buildComponentRow({...fresh(asset.label),unitBasis:asset.quantityStrategy==="SHARED"?"SHARED":"ITEM",assetRef:{catalogVersion:PLANNED_ASSET_CATALOG_VERSION,assetKey:asset.assetKey,labelAtSelection:asset.label,provenance:"EXPLICIT_USER_DECISION"}},before?"extra":"activity");
      if(decide(barBeforePatch(props.semanticState,context,before?.bottle??value,before?[...before.extras,value]:[]),"row")){setSlot(before?"before-extras":"before-main");setAdvancedRow(false);setRow(fromSelection(value));}
    }catch(failure){setError((failure as Error).message);}
  };
  const removeBefore=()=>{if(!guard(resumeRemoveBefore)||!before)return;confirm({message:`Retirer le Before et ses ${1+before.extras.length} éléments, ainsi que ses éventuels trajets liés ? Les choix du bar restent conservés. Undo restitue le groupe et ses identités.`,acceptLabel:"Retirer le Before",accept:()=>decide({kind:"EDIT_NIGHT_OUT",edit:{contextOccurrenceId:context.contextOccurrenceId,fields:{},before:null}})});};
  const beforeSource=before&&model.presentation.dragSources[`context-occurrence:${before.child.contextOccurrenceId}`];
  const beforeDraggable=!!(!busy&&!beforeLocked&&!dirty&&beforeSource&&!beforeSource.protected&&beforeSource.removeOperation);
  const addShared=(included?:boolean)=>{
    if(!guard(()=>resumeShared(included)))return;
    if(included===undefined&&coveredMain){setPendingShared(true);setPendingAsset(null);move("coverage");return;}
    const value=buildComponentRow({...fresh("Bouteille"),unitBasis:"SHARED"},"extra");
    try{const edit=included?substituteNightOutCoverage(context,coveredMain?.selectionId??"",value):{contextOccurrenceId:context.contextOccurrenceId,fields:{},slots:{extras:[...barItems(context,"extras"),value]}};
      if(decide({kind:"EDIT_NIGHT_OUT",edit},"row")){setPendingShared(false);setSlot("extras");setAdvancedRow(false);setRow(fromSelection(value));}
    }catch{setError("Ce poste n’a pas de couverture substitutive certaine ou possède un financement. Aucun poste n’est supprimé ; « Ajouter en plus » reste disponible.");}
  };
  const remove=()=>{
    if(slot==="before-main"&&before&&!before.extras.some(item=>item.kind==="COMPONENT")){removeBefore();return;}
    const apply=()=>slot.startsWith("before-")?before&&decide(barBeforeRemove(props.semanticState,context,row.id),"before")
      :decide({kind:"EDIT_NIGHT_OUT",edit:{contextOccurrenceId:context.contextOccurrenceId,fields:{},slots:{[slot]:barItems(context,slot).filter(item=>item.selectionId!==row.id)}}},"drinks");
    if(dirty)confirm({message:"Retirer ce poste et abandonner sa saisie non validée ? Undo permet de rétablir la dernière décision conservée.",acceptLabel:"Retirer",accept:apply});else apply();
  };
  const saveRow=(candidate:Row=row,next:Page="drinks")=>{try{
    if(/[.,]$/u.test(candidate.quantity)||candidate.costMode==="MANUAL"&&/[.,]$/u.test(candidate.amount))throw Error("Terminez le nombre avant de le retenir.");
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
  const chooseEndpoint=(place:ProspectivePlaceRef|null,fromBuffer=false,bindVenue=false,googleId?:string)=>{if(!leg)return false;if(!fromBuffer&&!guard(()=>resumeEndpointChoice(place,bindVenue,googleId)))return false;try{
    // Validate representability before proposing any destructive price choice.
    const costs=barEndpointCosts(leg,endpoint);
    const unbound=barEndpoint(leg,endpoint,place,"UNKNOWN",!!googleId);
    const venueBound=bindVenue&&selectedVenue&&place
      ?{...unbound,venueEndpoints:{...unbound.venueEndpoints,[endpoint]:venueBinding(selectedVenue)}}:unbound;
    const routeBinding:RouteEndpointBinding|undefined=googleId&&place?.kind==="TEXT"?{version:"route-endpoint@v1",decisionId:crypto.randomUUID(),selectionId:leg.selectionId,endpoint,place:{kind:"TEXT",label:place.label,provenance:"USER_DECLARED_PROSPECTIVE"},google:{provider:"google_places",kind:"ROUTE_ENDPOINT",placeId:googleId},provenance:"EXPLICIT_USER_DECISION"}:undefined;
    const bound=routeBinding?{...venueBound,routeEndpointBindings:{...venueBound.routeEndpointBindings,[endpoint]:routeBinding}}:venueBound;
    // Selecting the vehicle before the home must still finish the same declared
    // two-stop route. Empty stops are an incomplete intention, not a route quote.
    const next:BarLeg=bound.optionKey==="car"&&bound.route&&bound.route.stops.length===0&&bound.origin&&bound.destination
      ?{...bound,route:{...bound.route,stops:[stopForPlace(bound.origin,barPlaceLabel(bound.origin,model),"DIRECT_PLACE"),stopForPlace(bound.destination,barPlaceLabel(bound.destination,model),"ROOT_PLACE")]}}:bound;
    if(next!==leg&&costs.length){setPendingEndpoint({leg,key:endpoint,place,...(bindVenue&&selectedVenue?{binding:venueBinding(selectedVenue)}:{}),...(routeBinding?{routeBinding}:{})});return false;}
    const admitted=patchLeg(next,direction);if(admitted&&place&&endpoint==="origin"&&!next.destination){setEndpoint("destination");setAllEndpoints(false);setManual("");move("endpoint");}return admitted;
  }catch(failure){setError(failure instanceof Error?failure.message:"Ce lieu ne peut pas être retenu. Le trajet est conservé.");}};
  const resolveEndpoint=(choice:"UNKNOWN"|"RETAIN_MANUAL")=>{if(!pendingEndpoint||!leg)return;
    if(JSON.stringify(leg)!==JSON.stringify(pendingEndpoint.leg)){setPendingEndpoint(null);setError("Ce trajet a changé entre-temps. Relisez-le avant de choisir son nouveau prix.");return;}
    if(pendingEndpoint.binding&&pendingEndpoint.binding.venue.decisionId!==selectedVenue?.decisionId){setError("Le bar a changé. Choisissez à nouveau le point du trajet.");return;}
    try{const next=barEndpoint(leg,pendingEndpoint.key,pendingEndpoint.place,choice,!!pendingEndpoint.routeBinding);patchLeg({...next,...(pendingEndpoint.binding?{venueEndpoints:{...next.venueEndpoints,[pendingEndpoint.key]:pendingEndpoint.binding}}:{}),...(pendingEndpoint.routeBinding?{routeEndpointBindings:{...next.routeEndpointBindings,[pendingEndpoint.key]:pendingEndpoint.routeBinding}}:{})},direction);}catch(failure){setError((failure as Error).message);}
  };
  const saveFare=()=>{if(!leg)return false;try{return patchLeg({...leg,pricing:{fare:{kind:"MANUAL",unitAmount:decisionAmount(fare.trim().replace(",","."))},parking:leg.pricing?.parking??{kind:"UNKNOWN"},fundingAllocations:leg.pricing?.fundingAllocations??[],preference:leg.pricing?.preference??"FASTEST"}},direction);}catch(failure){setError(failure instanceof Error?failure.message:"Vérifiez le prix.");return false;}};
  function saveBuffer():boolean {
    if(inlineEditing)return saveInline();
    if(page==="row")return !!saveRow();
    if(page==="endpoint-free")return !!chooseEndpoint({kind:"TEXT",label:manual.trim(),provenance:"USER_DECLARED_PROSPECTIVE"},true);
    if(page==="manual-place")return choosePlace({kind:"TEXT",label:manual.trim(),provenance:"USER_DECLARED_PROSPECTIVE"});
    if(page==="people")return decide({kind:"EDIT_NIGHT_OUT",edit:{contextOccurrenceId:context.contextOccurrenceId,fields:{participantRefs:people}}},"summary");
    if(page==="fare")return saveFare();
    if(page==="route-time")return saveRouteTime();
    return false;
  }
  const targetEndpoint=(key:"origin"|"destination")=>{if(!guard(()=>resumeEndpoint(key)))return;setEndpoint(key);setAllEndpoints(false);setManual("");move("endpoint");};
  const targetFare=()=>{if(!guard(resumeFare))return;setFare(leg?.pricing?.fare.kind==="MANUAL"?leg.pricing.fare.unitAmount:"");move("fare");};
  const chooseVehicle=(actual=leg,slot=direction)=>{
    const vehicle=model.mobilityOptions?.vehicle;if(!actual||!vehicle?.vehicleId)return;
    try{assertBarRouteEditable(actual);}catch(failure){setError((failure as Error).message);return;}
    const apply=()=>{const value:BarLeg={...actual,route:{version:"composer-mobility-route@v1",vehicleRef:{vehicleId:vehicle.vehicleId!,labelAtSelection:vehicle.presentation?.displayName??vehicle.label,provenance:"EXPLICIT_USER_DECISION"},
      ...(actual.route?.manualFuelPrice?{manualFuelPrice:actual.route.manualFuelPrice}:{}),
      ...(actual.route?.toll?{toll:actual.route.toll}:{}),stops:actual.route?.stops.length?actual.route.stops.map(stop=>{
        if(actual.route?.vehicleRef?.vehicleId===vehicle.vehicleId)return stop;
        const {estimatedFuelLiters:_fuel,...retained}=stop;return retained;
      }):actual.origin&&actual.destination?[stopForPlace(actual.origin,barPlaceLabel(actual.origin,model),"DIRECT_PLACE"),stopForPlace(actual.destination,barPlaceLabel(actual.destination,model),"ROOT_PLACE")]:[]}};
      if(decide({kind:"EDIT_NIGHT_OUT",edit:{contextOccurrenceId:context.contextOccurrenceId,fields:{},slots:{[slot]:barItems(context,slot).map(item=>item.selectionId===actual.selectionId?value:item)}}},slot)&&(!value.origin||!value.destination)){setEndpoint(!value.origin?"origin":"destination");setManual("");setAllEndpoints(false);move("endpoint");}
    };
    if(actual.route?.vehicleRef&&actual.route.vehicleRef.vehicleId!==vehicle.vehicleId)confirm({message:`Changer de véhicule conserve les lieux et les arrêts. Mobility réestimera le coût d’usage avec le véhicule choisi.${actual.route?.toll?.kind==="MANUAL"?` Le péage de ${actual.route.toll.unitAmount} € sera conservé comme estimation déclarée ; aucune classe tarifaire n’est attestée ici.`:""}`,acceptLabel:"Changer de véhicule",accept:apply});else apply();
  };
  const routeAction=(slot:"outbound"|"return",action:BarRouteAction)=>{
    if(!guard(()=>resumeRouteAction(slot,action)))return;
    const actual=barLeg(context,slot);if(!actual)return;setDirection(slot);
    if(action==="mode"){setRouteModes(true);move(slot);return;}
    if(action==="advanced"){startLegacy("menu");return;}
    if(action==="time"){setRouteTime(actual.plannedTime??"");move("route-time");return;}
    if(action==="vehicle"){if(!actual.route?.vehicleRef&&model.mobilityOptions?.vehicleIsUnique)chooseVehicle(actual,slot);else move("vehicle");return;}
    const admit=(items:readonly ComponentSelectionV1[])=>decide({kind:"EDIT_NIGHT_OUT",edit:{contextOccurrenceId:context.contextOccurrenceId,fields:{},slots:{[slot]:items}}},"summary");
    if(action==="remove"){confirm({message:"Retirer uniquement ce trajet ? Les consommations et l’autre sens restent conservés. Undo permet de le retrouver.",acceptLabel:"Retirer le trajet",accept:()=>admit(barItems(context,slot).filter(item=>item.selectionId!==actual.selectionId))});return;}
    try{const reversed=barReverseLeg(actual),apply=()=>admit(barItems(context,slot).map(item=>item.selectionId===actual.selectionId?reversed:item));
      if(barEndpointCosts(actual,"destination").length)confirm({message:"Inverser les points de ce seul trajet remet ses prix à préciser. L’autre sens et ses coûts restent conservés.",acceptLabel:"Inverser ces points",accept:apply});else apply();
    }catch(failure){setError((failure as Error).message);}
  };
  const saveRouteTime=()=>{
    if(!leg)return false;
    try{
      assertBarRouteEditable(leg);
      if(routeTime&&!/^(?:[01]\d|2[0-3]):[0-5]\d$/u.test(routeTime))throw Error("Saisissez une heure complète au format HH:MM.");
      if(routeTime&&!(direction==="return"?context.fields.endDate??context.fields.plannedDate:context.fields.plannedDate))throw Error("Choisissez d’abord une date pour ce sens. Aucune heure n’a été inventée.");
      if(leg.pricing?.fundingAllocations.length||barEndpointCosts(leg,"destination").length||(leg.route?.stops.length??0)>2)throw Error("Ce trajet possède des prix, un financement ou des étapes à vérifier. Modifiez son horaire dans les options avancées ; toutes ses décisions sont conservées.");
      return patchLeg({...leg,plannedTime:routeTime||null},direction);
    }catch(failure){setError((failure as Error).message);return false;}
  };
  const chooseMode=(optionKey:string,fromHome=false)=>{
    if(!guard(()=>resumeMode(optionKey,fromHome)))return;
    if(fromHome&&(leg||homes.length!==1||selectedPlace?.kind!=="KNOWN"||!model.mobilityOptions?.vehicleIsUnique||!model.mobilityOptions.vehicle?.vehicleId))return;
    if(leg&&leg.optionKey!==optionKey){try{assertBarRouteEditable(leg);
      if((leg.route?.stops.length??0)>2||leg.pricing?.fundingAllocations.length)throw Error("Ce trajet possède des arrêts intermédiaires ou un financement. Utilisez les options détaillées ; ils sont conservés.");
    }catch(failure){setError((failure as Error).message);return;}}
    let inverseOperation:ComposerOperation|null=null;
    if(!leg&&direction==="return"&&barLeg(context,"outbound"))try{assertBarRouteEditable(barLeg(context,"outbound")!);inverseOperation=barSameModeReturn(context,crypto.randomUUID());}catch(failure){setError((failure as Error).message);return;}
    const inverse=inverseOperation?.kind==="EDIT_NIGHT_OUT"?inverseOperation.edit.slots?.return?.[0] as BarLeg|undefined:undefined;
    const seed=leg??inverse;
    const value:BarLeg=seed?.optionKey===optionKey?seed:{kind:"MOBILITY_INTENT",selectionId:seed?.selectionId??crypto.randomUUID(),optionKey,provenance:"EXPLICIT_USER_DECISION",returnRequired:false,
      ...(seed?.venueEndpoints?{venueEndpoints:seed.venueEndpoints}:!seed&&routeVenue&&selectedVenue?{venueEndpoints:{[direction==="outbound"?"destination":"origin"]:venueBinding(selectedVenue)}}:{}),
      ...(seed?.routeEndpointBindings?{routeEndpointBindings:seed.routeEndpointBindings}:{}),
      ...(leg?.plannedTime!==undefined?{plannedTime:leg.plannedTime}:{}),...(leg?.returnTime!==undefined?{returnTime:leg.returnTime}:{}),
      origin:seed?(seed.origin??null):fromHome?{kind:"KNOWN",placeId:homes[0]!.placeId}:(direction==="return"?routeVenue:null)??null,destination:seed?(seed.destination??null):(direction==="outbound"?routeVenue:null)??null,
      journey:{relation:"OWNS_JOURNEY",certainty:"CERTAIN",targetIntentId:null,externalExpenseId:null,externalCostLineIds:[],choice:null,stopIndex:null,accessLegIndex:null},
      pricing:{fare:{kind:"UNKNOWN"},parking:{kind:"UNKNOWN"},fundingAllocations:[],preference:"FASTEST"},...(optionKey==="car"?{route:{version:"composer-mobility-route@v1" as const,vehicleRef:fromHome?{vehicleId:model.mobilityOptions!.vehicle!.vehicleId!,labelAtSelection:model.mobilityOptions!.vehicle!.label,provenance:"EXPLICIT_USER_DECISION" as const}:null,stops:fromHome?[stopForPlace({kind:"KNOWN",placeId:homes[0]!.placeId},homes[0]!.name,"DIRECT_PLACE"),stopForPlace(selectedPlace!,barPlaceLabel(selectedPlace,model),"ROOT_PLACE")]:[]}}:{})};
    const apply=()=>{if(!patchLeg(value,direction))return;setRouteModes(false);if(!value.origin||!value.destination){setEndpoint(!value.origin?"origin":"destination");setAllEndpoints(false);setManual("");move("endpoint");}};
    if(leg&&leg.optionKey!==optionKey)confirm({message:`Changer de mode pour ${direction==="outbound"?"l’aller":"le retour"} remet ses prix à préciser et retire les données propres à son ancien mode. Les lieux et l’autre trajet sont conservés.${leg.pricing?.fare.kind==="MANUAL"?` Tarif concerné : ${leg.pricing.fare.unitAmount} € déclaré.`:leg.pricing?.fare.kind==="QUOTE"?" Le devis de ce trajet sera retiré.":""}`,acceptLabel:"Changer de mode",accept:apply});else apply();
  };
  const togglePerson=(person:ProspectivePersonRef)=>{
    if(!guard(()=>resumeTogglePerson(person)))return;
    const refs=Array.isArray(context.fields.participantRefs)?context.fields.participantRefs as ProspectivePersonRef[]:[];
    const next=refs.some(p=>prospectivePersonIdentity(p)===prospectivePersonIdentity(person))?refs.filter(p=>prospectivePersonIdentity(p)!==prospectivePersonIdentity(person)):[...refs,person];
    if(decide({kind:"EDIT_NIGHT_OUT",edit:{contextOccurrenceId:context.contextOccurrenceId,fields:{participantRefs:next}}},"people"))setPeople(next);
  };
  const coveredMain=[...barItems(context,"main"),...barItems(context,"extras")].find((item):item is Component=>item.kind==="COMPONENT"&&item.economicScope?.kind==="AGGREGATED_SUBSTITUTIVE_ESTIMATE")??barItems(context,"main").find((item):item is Component=>item.kind==="COMPONENT"&&!item.economicScope);
  const choice=(key:string,label:string,choose:()=>void,iconKey="night-out",hint?:string,symbol?:string)=>({key,label,choose,iconKey,hint,symbol});
  const beer=catalog.find(asset=>asset.assetKey==="bar:beer")!;
  const consumptionChoice=(asset:PlannedAsset)=>({...choice(asset.assetKey,asset.label,()=>add(asset),"night-out","Nouvelle ligne · rééditez une tuile pour changer sa quantité",asset.icon),showHint:false});
  const isFood=(asset:PlannedAsset)=>["tapas","snack","chips","food"].includes(asset.assetKey.split(":").at(-1)??"");
  const familyChoices=(moment:"bar"|"before")=>[
    choice("drinks","Boissons",()=>{if(guard(()=>{setFamilies(previous=>({...previous,[moment]:"drinks"}));move(moment==="bar"?"drinks":"before");})){setFamily("drinks");move(moment==="bar"?"drinks":"before");}},"night-out"),
    choice("food","Restauration",()=>{if(guard(()=>{setFamilies(previous=>({...previous,[moment]:"food"}));move(moment==="bar"?"drinks":"before");})){setFamily("food");move(moment==="bar"?"drinks":"before");}},"restaurant")
  ];
  const drinkChoices=catalog.filter(asset=>isFood(asset)===(family==="food")).map(consumptionChoice);
  const beforeChoices=()=>beforeCatalog.filter(asset=>isFood(asset)===(family==="food")).map(asset=>choice(asset.assetKey,asset.label,()=>addBefore(asset),"night-out",undefined,asset.icon));
  const sharedChoice=choice("shared","Bouteille",()=>addShared(),"night-out","Coût du lot, sans partage financier implicite","🍾");
  let question:PaletteQuestion={title:"Choisir une famille",nature:"FAMILIES",choices:familyChoices("bar")};
  const knownBars=barPlaces(model.mobilityOptions?.places??[]);
  if(page==="place")question={title:"Lieux enregistrés",nature:"PLACE_FAVORITES",identity:context.contextOccurrenceId+":place",choices:query.trim()?[]:[
    ...knownBars.map(place=>({...choice(place.placeId,place.name,()=>choosePlace({kind:"KNOWN",placeId:place.placeId}),"activity",[place.commune,place.address].filter(Boolean).join(" · ")||"Lieu enregistré",place.name.trim().split(/\s+/u).slice(0,2).map(word=>word[0]).join("").toLocaleUpperCase("fr")),showHint:true})),
    ...personalPlaces.filter(place=>!knownBars.some(known=>known.googlePlaceId===place.googlePlaceId)).map(place=>({...choice("personal:"+place.id,place.userLabel,()=>choosePlace({kind:"TEXT",label:place.userLabel,provenance:"USER_DECLARED_PROSPECTIVE"},{provider:"google_places",kind:"BAR_APERO",placeId:place.googlePlaceId}),"activity","Lieu personnel"),showHint:true}))
  ]};
  if(page==="more"||page==="summary")question=family?{title:family==="food"?"Restauration":"Boissons",nature:"OBJECTS",choices:activeMoment==="before"?beforeChoices():family==="drinks"?[...drinkChoices,sharedChoice]:drinkChoices}:{title:"Choisir une famille",nature:"FAMILIES",choices:familyChoices(activeMoment)};
  if(page==="before"||page==="drinks")question=family?{title:family==="food"?"Restauration":"Boissons",nature:"OBJECTS",choices:page==="before"?beforeChoices():family==="drinks"?[...drinkChoices,sharedChoice]:drinkChoices,search:{value:query,change:setQuery,label:"Chercher un objet"}}:{title:"Choisir une famille",nature:"FAMILIES",choices:familyChoices(page==="before"?"before":"bar")};
  if(page==="outbound"||page==="return"){
    const actualDirection=page; // setDirection also keeps endpoint editing attached to this leg.
    question={title:"Choisir un transport",nature:"MODES",choices:[
      ...model.library.searchableAssets.filter(asset=>asset.optionKind==="MOBILITY_INTENT"&&!["unknown","other"].includes(asset.optionKey??"")&&asset.assetKey.startsWith(`option:night-out:${actualDirection}:`)
        &&model.dropCapabilities.some(drop=>drop.sourceAssetKey===asset.assetKey&&drop.target.contextOccurrenceId===context.contextOccurrenceId&&drop.target.slotKey===actualDirection&&drop.resolution!=="BLOCKED"))
        .map(asset=>({...choice(asset.assetKey,asset.label,()=>chooseMode(asset.optionKey!),asset.iconKey,undefined,({car:"🚗",taxi:"🚕",train:"🚆",bus:"🚌",free:"🚶",other:"↗",unknown:"?"} as Record<string,string>)[asset.optionKey??""]),selected:leg?.optionKey===asset.optionKey}))]};
  }
  if(page==="return-choice")question={title:"Préparer le retour",nature:"DECISION",choices:[
    choice("inverse","Reprendre l’inverse",()=>{try{if(!guard(()=>resumeOpen("return")))return;assertBarRouteEditable(barLeg(context,"outbound")!);if(decide(barSameModeReturn(context,crypto.randomUUID()),"summary"))setRouteModes(false);}catch(failure){setError((failure as Error).message);}},"car","Nouveau retour · ses prix restent à préciser"),
    choice("other-mode","Choisir un autre transport",()=>{setRouteModes(true);move("return");},"train","Points inverses · tarif indépendant")
  ]};
  if((page==="outbound"||page==="return")&&leg&&!routeModes)question={title:"Trajet retenu",choices:[]};
  if(page==="endpoint"||page==="endpoint-free"){
    const venueGoogle=selectedVenue?.google?.placeId??(routeVenue?.kind==='KNOWN'?model.mobilityOptions?.places.find(p=>p.placeId===routeVenue.placeId)?.googlePlaceId:undefined);
    const venueCandidate=routeVenue&&((direction==='outbound'&&endpoint==='destination')||(direction==='return'&&endpoint==='origin'))&&(!query.trim()||barSearchText(barPlaceLabel(routeVenue,model)).includes(barSearchText(query)));
    question={title:direction==='outbound'?'Aller · adresse':'Retour · adresse',identity:context.contextOccurrenceId+':'+direction+':'+endpoint,search:{value:query,change:setQuery,label:'Rechercher une adresse ou un lieu'},choices:[
      ...(venueCandidate?[{...choice(venueGoogle?'google-route:'+venueGoogle:routeVenue.kind==='KNOWN'?routeVenue.placeId:'venue',barPlaceLabel(routeVenue,model),()=>chooseEndpoint(routeVenue,false,!!selectedVenue),'activity','Lieu de la sortie · identité conservée'),showHint:true}]:[]),
      ...barEndpointSuggestions(model.mobilityOptions?.places??[],model.householdPersons,direction,endpoint,leg?.[endpoint==='origin'?'destination':'origin'],selectedPlace,query,allEndpoints)
        .filter(({place})=>!venueCandidate||!(routeVenue?.kind==='KNOWN'&&place.placeId===routeVenue.placeId||venueGoogle&&place.googlePlaceId===venueGoogle))
        .map(({place,hint})=>({...choice(place.googlePlaceId?'google-route:'+place.googlePlaceId:place.placeId,barEndpointLabel(place),()=>chooseEndpoint({kind:'KNOWN',placeId:place.placeId}),'activity',hint),visualKey:homes.some(home=>home.placeId===place.placeId)?'home':undefined,showHint:true}))
    ]};
  }
  if(page==="date")question={title:"Date de la sortie",choices:[]};
  const candidates:ProspectivePersonRef[]=[...props.householdPersons.map(p=>({kind:"HOUSEHOLD_PERSON" as const,personId:p.personId})),...SOCIAL_CONTACTS_V1.map(p=>({kind:"CONTACT" as const,contactKey:p.key}))];
  const matchingPeople=candidates.filter(p=>barSearchText(barPersonLabel(p,model)).includes(barSearchText(query)));
  if(page==="people"){
    question={title:"Avec qui ?",nature:"PEOPLE",search:{value:query,change:setQuery,label:"Chercher une personne"},choices:matchingPeople.map(p=>({...choice(prospectivePersonIdentity(p),barPersonLabel(p,model),()=>togglePerson(p),"family-visit"),selected:(Array.isArray(context.fields.participantRefs)?context.fields.participantRefs as ProspectivePersonRef[]:[]).some(x=>prospectivePersonIdentity(x)===prospectivePersonIdentity(p))}))};
  }
  if(page==="manual-place"||page==="google")question={title:"Lieux",choices:[]};
  if(page==="vehicle")question={title:"Véhicule de ce trajet",choices:leg?.optionKey==="car"&&model.mobilityOptions?.vehicle?.vehicleId?[choice("vehicle",model.mobilityOptions.vehicle.presentation?.displayName??model.mobilityOptions.vehicle.label,()=>chooseVehicle(),"car","Retenir explicitement · ne change pas l’autre sens")]:[]};
  if(page==="fare")question={title:"Coût prévu du trajet · sans paiement",choices:[choice("unknown","Prix encore inconnu",()=>{if(leg)patchLeg({...leg,pricing:{fare:{kind:"UNKNOWN"},parking:leg.pricing?.parking??{kind:"UNKNOWN"},fundingAllocations:leg.pricing?.fundingAllocations??[],preference:leg.pricing?.preference??"FASTEST"}},direction);})]};
  if(page==="route-time")question={title:"Heure facultative de ce sens",choices:[]};
  if(page==="row")question=advancedRow?activeQuestion??{title:"Détails du poste",choices:[]}:family?{title:family==="food"?"Restauration":"Boissons",nature:"OBJECTS",choices:slot.startsWith("before-")?beforeChoices():family==="drinks"?[...drinkChoices,sharedChoice]:drinkChoices,search:{value:queries[(slot.startsWith("before-")?"before":"drinks")+":"+(family??"families")]??"",change:value=>setQueries(previous=>({...previous,[(slot.startsWith("before-")?"before":"drinks")+":"+(family??"families")]:value})),label:"Chercher un objet"}}:{title:"Choisir une famille",nature:"FAMILIES",choices:familyChoices(slot.startsWith("before-")?"before":"bar")};
  if(page==="quick")question={title:"Coût prévu",choices:[]};
  // Bar/Before products have one navigation control in the dock. The RAW
  // guard must run before changing families, including during row editing.
  if(question.nature==="OBJECTS")question={...question,search:undefined,backToFamilies:()=>{if(guard(()=>setFamily(null)))setFamily(null);}};
  if(question.nature==='OBJECTS'&&!busy&&!dirty){
    const owner=activeMoment==='before'?!beforeLocked&&before?.child.contextOccurrenceId
      :consumption?.mode!=='DIRECT'&&!coveredMain&&context.contextOccurrenceId;
    if(owner)question={...question,choices:question.choices.map(item=>{
      const asset=(activeMoment==='before'?beforeCatalog:catalog).find(a=>a.assetKey===item.key);
      return asset?{...item,drag:barDockDrag(model,{kind:'CONTEXT_SOCKET',contextOccurrenceId:owner,slotKey:'extras'},asset)}:item;
    })};
  }
  if(page==='summary'&&coveredMain)question={title:'Consommations regroupées',choices:[]};
  if(page==="coverage")question={title:`Remplacer ${coveredMain?.label??"le coût retenu"}${coveredMain?.cost.kind==="MANUAL"?" · "+money(coveredMain.cost.unitAmount)+" / lot":""} ?`,choices:[{...choice("included","Détailler à la place",()=>pendingShared?addShared(true):pendingAsset&&add(pendingAsset,true),"night-out","Retire uniquement ce regroupement ; contribution, trajets, Before et repas conservés"),showHint:true},{...choice("extra","Ajouter en plus",()=>pendingShared?addShared(false):pendingAsset&&add(pendingAsset,false),"night-out","Coût supplémentaire indépendant du poste conservé"),showHint:true},choice("cancel","Ne rien ajouter",()=>{setPendingAsset(null);setPendingShared(false);go("drinks");},"activity")]};
  if(["summary","quick"].includes(page)&&(!showMoments||!(openMoments.before||openMoments.bar)))question={title:"",choices:[]};
  question={...question,identity:question.identity??`${context.contextOccurrenceId}:${page==="row"?(slot.startsWith("before-")?"before":"drinks"):page}:${family??"families"}:${question.nature??"decision"}`};
  const descriptiveRow=globalActive&&globalConsumptionCovers(props.semanticState.contexts,slot.startsWith("before-")?before?.child.contextOccurrenceId??"":context.contextOccurrenceId,slot==="before-main"?"main":slot==="before-extras"?"extras":slot,row.id);
  const activeRow=<fieldset className={styles.barEditableBody} disabled={busy||slot.startsWith("before-")&&beforeLocked} onKeyDown={event=>{if(event.key==="Enter"&&!event.nativeEvent?.isComposing&&event.target instanceof HTMLInputElement&&dirty){event.preventDefault();event.stopPropagation();if(canSaveBuffer())saveRow();}}}><div data-bar-short-row>
          <div className={styles.barRowControls}>
          <label><span className={styles.barVisuallyHidden}>Quantité {row.unitBasis==="SHARED"?"de lots":row.unitBasis==="PERSON"?"par personne":"totale"}</span><span className={styles.workshopStepper}>
            <button type="button" aria-label="Réduire la quantité" disabled={Number(row.quantity)<=1} onClick={()=>adjustQuantity(-1)}>−</button>
            <input aria-label={row.unitBasis==="SHARED"?"Quantité de lots":row.unitBasis==="PERSON"?"Quantité par personne":"Quantité totale"} inputMode="decimal" value={row.quantity} onChange={e=>{setRow(r=>({...r,quantity:e.target.value,edited:true}));setDirty(true);}}/>
            <button type="button" aria-label="Augmenter la quantité" onClick={()=>adjustQuantity(1)}>+</button>
          </span></label>
          {!descriptiveRow&&<label className={styles.barInlinePrice}><span className={styles.barVisuallyHidden}>{row.unitBasis==="SHARED"?"Prix par lot (€)":"Prix unitaire (€)"}</span><input aria-label={row.unitBasis==="SHARED"?"Prix par lot (€)":"Prix unitaire (€)"} title={row.costMode==="QUOTE"?"Devis conservé ; saisir un prix le remplacera explicitement.":row.unitBasis==="SHARED"?"Prix par lot":"Prix unitaire"} inputMode="decimal" placeholder={row.costMode==="QUOTE"?"Devis":"À préciser"} value={row.costMode==="MANUAL"?row.amount:""} onChange={e=>{setRow(r=>({...r,amount:e.target.value,costMode:e.target.value.trim()?"MANUAL":"UNKNOWN",edited:true}));setDirty(true);}}/><span aria-hidden="true">€</span></label>}
          </div>

          </div></fieldset>;
  const sectionLabels={extras:"Au bar",before:"Avant de sortir",food:"Repas",main:barItems(context,"main").some(item=>item.kind==="COMPONENT"&&item.label==="Consommations regroupées")?"Consommations regroupées":"Entrées / contribution"};
  const listGroups=(items:readonly ComponentSelectionV1[])=>componentPresentationGroups(items);

  const beforeScene=page==="summary"&&activeMoment==='before'||page==="before"||page==="row"&&slot.startsWith("before-");
  const momentItems=beforeScene?before?[before.bottle,...before.extras]:[]:barItems(context,'extras').filter(item=>item.selectionId!==consumption?.directSelectionId);
  const displayedGroups=page==='row'?1:beforeScene||page==='drinks'||page==='summary'?componentPresentationGroups(momentItems).length:0;
  const sceneDensity=displayedGroups>2?'dense':displayedGroups?'partial':'empty';
  const admittedPeople=Array.isArray(context.fields.participantRefs)?context.fields.participantRefs as ProspectivePersonRef[]:[];
  const peoplePage=Math.min(itemPage,Math.max(0,Math.ceil(admittedPeople.length/4)-1));
  // Structural admission is a valid packing checkpoint (also on Undo/Redo).
  // Prices, quantities, RAW and provider replies never change this identity key.
  const geometryItems=[...Object.keys(context.slotSelections).flatMap(key=>barItems(context,key).map(item=>`${key}:${item.selectionId}`)),
    ...(before?[before.bottle,...before.extras].map(item=>`before:${item.selectionId}`):[])].sort().join("|");
  return <div ref={editorRoot} className={styles.barLivingEditor} tabIndex={-1} aria-label="Configuration de Bar / Apéro" data-bar-living-editor data-bar-step={page} data-inline-dirty={dirty}
    data-bar-task={!['summary','before','drinks'].includes(page)||undefined}
    data-bar-progressive data-bar-geometry-key={`${showMoments}:${openMoments.before}:${openMoments.bar}:${page}:${activeMoment}:${advancedRow}:${itemPage}:${geometryItems}`} data-bar-advanced={advancedRow} data-bar-scene-density={sceneDensity}
    onKeyDown={event=>{if(event.key==="Escape"&&!document.querySelector("dialog[open],[popover]:popover-open")){event.preventDefault();event.stopPropagation();if(page!=="summary")go("summary");else props.onCancel();}}}>
    <fieldset className={styles.barEditableBody} disabled={busy} aria-label="Composition de la sortie">
    {/* The Bar title is the guarded return to summary; no duplicate navigation row. */}
    {['place','google','manual-place'].includes(page)&&context.fields.placeRef&&<button type="button" aria-label="Retirer le lieu de la sortie" disabled={busy} onClick={()=>{const clear=()=>decide({kind:'EDIT_NIGHT_OUT',edit:{contextOccurrenceId:context.contextOccurrenceId,fields:{placeRef:null,venueDecision:null}}});if(!guard(clear))return;if(barVenueAdaptations(context).length)confirm({message:'Retirer uniquement le lieu ? Les trajets et leurs coûts restent conservés.',acceptLabel:'Retirer uniquement le lieu',accept:clear});else clear();}}>Retirer le lieu</button>}
    {amountHost?createPortal(amountControls,amountHost):amountControls}
    {!detailed&&<div className={styles.barConsumptionMode}><button type="button" disabled={busy} onClick={revealDetails}>Détailler les consommations</button></div>}
    {routeHost&&createPortal(<>
      {(['outbound','return'] as const).map(key=>barLeg(context,key)?<BarRouteLine compact key={key} slot={key} contextId={context.contextOccurrenceId} leg={barLeg(context,key)} model={model} disabled={busy} pending={props.previewPending} failed={!!serverError} open={()=>open(key)}/>:null)}
      {!barLeg(context,'outbound')&&!barLeg(context,'return')&&<button type="button" data-bar-add-route="outbound" aria-label="Ajouter un trajet" disabled={busy} onClick={()=>open('outbound')}><Route size={14}/><span aria-hidden="true">+</span></button>}
      {barLeg(context,'outbound')&&!barLeg(context,'return')&&!barLeg(context,'outbound')!.returnRequired&&<button type="button" data-bar-add-route="return" disabled={busy} onClick={()=>open('return')}>+ Retour</button>}
      {barLeg(context,'return')&&!barLeg(context,'outbound')&&<button type="button" data-bar-add-route="outbound" disabled={busy} onClick={()=>open('outbound')}>+ Aller</button>}
    </>,routeHost)}
    <div className={styles.barLivingSections} data-scene={page}>
    {before&&["summary","before","drinks","row"].includes(page)&&<section className={styles.barItemSection} data-bar-before data-bar-section="before" aria-label="Avant de sortir">
      <header><h4 draggable={beforeDraggable} data-bar-before-drag={beforeDraggable?beforeSource?.sourceKey:undefined}
        aria-label="Before · moment entier, déplaçable vers la corbeille" onDragStart={event=>{event.stopPropagation();if(!beforeDraggable||!beforeSource){event.preventDefault();return;}interaction?.start(beforeSource.sourceKey,event);}} onDragEnd={()=>interaction?.end()}>Before</h4>
        <AtomicPopover utility label="Actions du Before" state="MOMENT" focus={()=>{}} icon={<MoreHorizontal size={14}/>}>
          {close=><button type="button" disabled={busy||beforeLocked} onClick={()=>{close();removeBefore();}}>Retirer le Before</button>}
        </AtomicPopover></header>
      {beforeLocked&&<p>Ce Before est protégé. Ses composants restent consultables.</p>}
      <BarMomentRail label="Objets Before" addLabel="Ajouter un objet au Before" disabled={busy||beforeLocked} dropBlocked={dirty} add={()=>selectMoment("before")} model={model} owner={before.child.contextOccurrenceId} slot="extras">{listGroups([before.bottle,...before.extras]).map(group=>{const item=group.items[0];return <div key={group.key} data-bar-before-item={item.selectionId} data-bar-active-tile={page==='row'&&group.items.some(i=>i.selectionId===row.id)} className={page==='row'&&group.items.some(i=>i.selectionId===row.id)?styles.barActiveTile:styles.barEconomicTile}><BarComponentGroup group={group} model={model} owner={before.child.contextOccurrenceId} slot="$before" disabled={busy||beforeLocked} choose={chosen=>chosen.kind==='COMPONENT'&&editComponent(chosen.selectionId===before.bottle.selectionId?'before-main':'before-extras',chosen)}>{page==='row'&&group.items.some(i=>i.selectionId===row.id)&&activeRow}</BarComponentGroup></div>;})}</BarMomentRail>

    </section>}
    {!before&&["summary","before","drinks","row"].includes(page)&&<section className={styles.barItemSection} data-bar-section="before" data-bar-empty="true"><h4>Before</h4><button type="button" className={styles.barInlineAdd} disabled={busy} onClick={()=>selectMoment("before")}>+ Before</button></section>}
    {(["extras","before","food","main"] as const).map(key=>{
      const items=barItems(context,key).filter(item=>(item.kind==="COMPONENT"||item.kind==="CHILD_CONTEXT")&&item.selectionId!==consumption?.directSelectionId);
      if(key==="before"&&before)return null;
      if(page!=="summary"&&!(key==="extras"&&["drinks","before","row"].includes(page))&&!(page==="row"&&key===slot))return null;
      // An empty moment is still an entry point, independent of transient
      // navigation flags. Rendering it never switches DIRECT or creates data.
      if(key==='extras'&&(!detailed||!items.length))return <section key={key} className={styles.barItemSection} data-bar-section="extras" data-bar-empty="true" aria-label="Au bar"><h4>Au bar</h4><button type="button" className={styles.barInlineAdd} disabled={busy} onClick={()=>selectMoment("bar")}>+ Au bar</button></section>;
      if(!items.length&&key!=="extras")return null;
      return <section key={key} className={styles.barItemSection} data-bar-section={key} aria-label={sectionLabels[key]}>
        <header><h4>{sectionLabels[key]}</h4>{key==="extras"&&<button type="button" className={styles.barInlineAdd} disabled={busy} aria-label="Ajouter une consommation" onClick={()=>go("drinks")}>+ Ajouter</button>}{page==="summary"&&items.length>2&&<button type="button" onClick={()=>{if(key==="extras")go("drinks");else startLegacy("menu");}}>Voir les {items.length} postes</button>}</header>
        <BarMomentRail label={sectionLabels[key]} addLabel="Ajouter une consommation" disabled={busy} dropBlocked={dirty} add={()=>selectMoment("bar")} model={key==="extras"?model:undefined} owner={context.contextOccurrenceId} slot="extras" showAdd={key==="extras"}>{listGroups(items).map(group=>{const item=group.items[0];return <div key={group.key} data-bar-tile={item.selectionId} data-bar-active-tile={page==='row'&&group.items.some(i=>i.selectionId===row.id)} className={page==='row'&&group.items.some(i=>i.selectionId===row.id)?styles.barActiveTile:styles.barEconomicTile}>
          <BarComponentGroup group={group} model={model} owner={context.contextOccurrenceId} slot={key} disabled={busy} choose={chosen=>chosen.kind==='COMPONENT'&&key!=='before'?editComponent(key,chosen):startLegacy('menu')}>{page==='row'&&group.items.some(i=>i.selectionId===row.id)&&activeRow}</BarComponentGroup>
        </div>;})}</BarMomentRail>
      </section>;
    })}
    </div>
    <section className={styles.barLivingQuestion} aria-label="Décision en cours">
      {(page==='outbound'||page==='return')&&leg&&<section className={styles.barRouteEditor} data-bar-route-controls aria-label={`Réglages de ${direction==='outbound'?'l’aller':'retour'}`}>
        <div className={styles.barRoutePoints}>
          <button type="button" disabled={busy} aria-label="Modifier le départ" onClick={()=>targetEndpoint('origin')}><MapPin size={16}/><span><small>Départ</small><strong>{leg.origin?barPlaceLabel(leg.origin,model):'À préciser'}</strong></span></button>
          <button type="button" disabled={busy} aria-label="Modifier l’arrivée" onClick={()=>targetEndpoint('destination')}><MapPin size={16}/><span><small>Arrivée</small><strong>{leg.destination?barPlaceLabel(leg.destination,model):'À préciser'}</strong></span></button>
        </div>
        <div className={styles.barRouteTools}>
          <button type="button" disabled={busy} aria-label="Changer le transport" onClick={()=>routeAction(direction,'mode')}><Route size={15}/>Transport</button>
          {leg.optionKey==='car'?<button type="button" disabled={busy} onClick={()=>routeAction(direction,'vehicle')}><CarFront size={15}/>Choisir le véhicule</button>:<button type="button" disabled={busy} onClick={targetFare}><Ticket size={15}/>Prix du trajet</button>}
          <button type="button" disabled={busy} onClick={()=>routeAction(direction,'time')}><Clock3 size={15}/>Heure de départ</button>
          <button type="button" disabled={busy} onClick={()=>routeAction(direction,'advanced')}><Route size={15}/>Étapes, péages et financement</button>
          <button type="button" disabled={busy} onClick={()=>routeAction(direction,'reverse')}><ArrowLeftRight size={15}/>Inverser ce sens</button>
          <button type="button" disabled={busy} onClick={()=>routeAction(direction,'remove')}><Trash2 size={15}/>Retirer ce trajet</button>
        </div>
      </section>}
      {(page==="place"||page==="google")&&<BarPlaceSearch rawTargetRef={context.contextOccurrenceId} personalPlacesCapability={model.personalGooglePlacesEnabled===true} initialSearch={googleSearch??{query:queries.place??"",city:"",resultPage:0}} onSearchChange={saveGoogleSearch} onPersonalSuggestions={savePersonalSuggestions} commitOnVerified decisionKey={JSON.stringify(context)} onManual={()=>go("manual-place")} places={model.mobilityOptions?.places??[]} onKnown={id=>choosePlace({kind:"KNOWN",placeId:id})} onText={label=>choosePlace({kind:"TEXT",label,provenance:"USER_DECLARED_PROSPECTIVE"})} onGoogle={(label,ref)=>choosePlace({kind:"TEXT",label,provenance:"USER_DECLARED_PROSPECTIVE"},ref)}/>}
      {page==="row"?advancedRow&&!descriptiveRow&&<WorkshopComponentRow key={row.id} title={row.label} row={row} onChange={next=>{setRow(next);setDirty(true);}} onSave={()=>saveRow()} busy={busy} participantCount={admittedPeople.length} back={{label:"Retour à la tuile",action:()=>setAdvancedRow(false)}}/>:page==="legacy"?<NightOutEditor {...props} key={legacyKey} embedded initialView={legacy} onSave={operation=>{const admitted=!busy&&onSave(operation);if(admitted){setDirty(false);move(legacy==="calendar"?"drinks":"summary");}return admitted;}} onCancel={()=>go("summary")}/>
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
          {Array.from({length:new Date(Number(props.semanticState.targetMonth.slice(0,4)),Number(props.semanticState.targetMonth.slice(5)),0).getDate()},(_,i)=>{const date=props.semanticState.targetMonth+"-"+String(i+1).padStart(2,"0");return <button type="button" key={date} data-bar-day={i+1} tabIndex={calendarFocus===date?0:-1} aria-label={date} aria-pressed={context.fields.plannedDate===date} onClick={()=>{setCalendarFocus(date);decide({kind:"EDIT_NIGHT_OUT",edit:{contextOccurrenceId:context.contextOccurrenceId,fields:{plannedDate:context.fields.plannedDate===date?null:date}}},"summary");}}>{i+1}</button>;})}
        </div></div>
        :page==="people"?<section data-bar-people><h4>Personnes</h4><div className={styles.barLivingMetadata}>{admittedPeople.slice(peoplePage*4,(peoplePage+1)*4).map(p=><button type="button" key={prospectivePersonIdentity(p)} onClick={()=>togglePerson(p)}>{barPersonLabel(p,model)} ×</button>)}</div><BarPageControls index={Math.min(itemPage,Math.max(0,Math.ceil(admittedPeople.length/4)-1))} count={Math.ceil(admittedPeople.length/4)} onChange={setItemPage} label="Pages des participants"/>{query.trim()&&matchingPeople.length===0&&<button type="button" disabled={busy||query.trim().length>120} onClick={()=>{const person={kind:"TEXT" as const,label:query.trim()};if(!admittedPeople.some(p=>prospectivePersonIdentity(p)===prospectivePersonIdentity(person)))decide({kind:"EDIT_NIGHT_OUT",edit:{contextOccurrenceId:context.contextOccurrenceId,fields:{participantRefs:[...admittedPeople,person]}}},"people");}}>Ajouter « {query.trim()} »</button>}</section>
        :page==="venue-change"&&pendingVenue?<section data-bar-venue-change><h4>Adapter les trajets au nouveau bar ?</h4><p>{barPlaceLabel(pendingVenue.venue.place,model)} · seuls les points explicitement liés sont concernés.</p>
          <ul>{barVenueAdaptations(context).map(change=><li key={change.slot+change.key}>{change.slot==="outbound"?"Aller":"Retour"} · {change.key==="origin"?"départ":"arrivée"} · {barEndpointCosts(change.leg,change.key).join(", ")||"estimation d’itinéraire à recalculer"}</li>)}</ul>
          <p>Adapter remet à préciser les prix du trajet concernés. Les autres points, coûts et identités sont conservés. Undo rétablit le bar et les trajets ensemble.</p><button type="button" disabled={busy} onClick={()=>commitVenue(false)}>Conserver les trajets</button><button type="button" disabled={busy} onClick={()=>commitVenue(true)}>Adapter les trajets liés</button></section>
        :page==="manual-place"?<><label>Nom ou adresse libre<input autoFocus maxLength={120} value={manual} onChange={e=>{setManual(e.target.value);setDirty(true);}}/></label><button type="button" disabled={!manual.trim()||busy} onClick={()=>choosePlace({kind:"TEXT",label:manual.trim(),provenance:"USER_DECLARED_PROSPECTIVE"})}>Retenir ce repère</button><small>Repère textuel uniquement · distance et itinéraire à préciser.</small></>
        :page==="endpoint"&&leg?<BarRouteEndpointSearch key={leg.selectionId+':'+direction+':'+endpoint} identity={leg.selectionId+':'+direction+':'+endpoint} decisionKey={JSON.stringify(leg)} query={query} change={setQuery} choose={(label,googleId)=>chooseEndpoint({kind:'TEXT',label,provenance:'USER_DECLARED_PROSPECTIVE'},false,false,googleId)} known={question.choices} disabled={busy}/>
        :page==="route-time"?<><label>Heure de départ {direction==="outbound"?"de l’aller":"du retour"} (facultative)<input type="time" value={routeTime} onChange={event=>{setRouteTime(event.target.value);setDirty(true);}}/></label><button type="button" disabled={busy} onClick={saveRouteTime}>Retenir cet horaire</button><small>Une date est nécessaire pour retenir une heure. L’estimation reste possible sans heure.</small><button type="button" onClick={()=>startLegacy("menu")}>Horaire et options avancées</button></>
        :page==="endpoint-free"?<><label>Nom libre du point de trajet<input maxLength={120} value={manual} onChange={e=>{setManual(e.target.value);setDirty(true);}}/></label><button type="button" disabled={busy||!manual.trim()} onClick={()=>chooseEndpoint({kind:"TEXT",label:manual.trim(),provenance:"USER_DECLARED_PROSPECTIVE"},true)}>Retenir ce point libre</button><small>Repère textuel uniquement · itinéraire et distance à préciser.</small></>
        :page==="vehicle"?<section data-bar-vehicle>{model.mobilityOptions?.vehicle?.presentation&&<details><summary>Caractéristiques du véhicule</summary><p data-bar-vehicle-technical>{model.mobilityOptions.vehicle.presentation.technicalLabel} · profil officiel {model.mobilityOptions.vehicle.presentation.modelRef}</p></details>}{!model.mobilityOptions?.vehicle?.vehicleId&&<p>Pas de véhicule estimable dans les références disponibles. Les lieux et les autres coûts restent conservés. <button type="button" onClick={()=>startLegacy("menu")}>Options du véhicule</button></p>}</section>
        :page==="fare"&&leg?<><label>Coût prévu du billet ou de la course (€)<input autoFocus inputMode="decimal" value={fare} placeholder="Encore inconnu" onChange={event=>{setFare(event.target.value);setDirty(true);}}/></label>
          {leg.pricing?.fare.kind==="QUOTE"&&<p>Le devis reste conservé tant qu’un prix de remplacement n’est pas validé.</p>}
          <button type="button" disabled={busy||!fare.trim()} onClick={saveFare}>Retenir le coût du trajet</button>
          <p>Prix du billet ou de la course, hors carburant estimé, péage et stationnement. Le financement existant reste à vérifier.</p></>
        :null}
      {pendingEndpoint&&<section data-bar-price-arbitration aria-label="Prix affectés de ce trajet">
        <p>Ce point change pour {direction==="outbound"?"l’aller":"le retour"}. À revoir : {barEndpointCosts(pendingEndpoint.leg,pendingEndpoint.key).join(", ")}. Le trajet et ses prix sont encore inchangés.</p>
        {pendingEndpoint.leg.pricing?.fare.kind==="MANUAL"&&barEndpointCosts(pendingEndpoint.leg,pendingEndpoint.key).length===1&&<button type="button" disabled={busy} onClick={()=>resolveEndpoint("RETAIN_MANUAL")}>Retenir {pendingEndpoint.leg.pricing.fare.unitAmount} € comme nouvelle estimation</button>}
        <button type="button" disabled={busy} onClick={()=>resolveEndpoint("UNKNOWN")}>Mettre ces prix à préciser</button>
        <button type="button" onClick={()=>setPendingEndpoint(null)}>Conserver cet itinéraire</button>
      </section>}
      {['return-choice','vehicle','fare'].includes(page)&&<div className={styles.barRouteTools} data-bar-route-choices aria-label={question.title}>{question.choices.map(item=><button type="button" key={item.key} disabled={busy} onClick={item.choose}>{item.label}</button>)}</div>}
      {(error||serverError)&&<p role="alert">{error||serverError}</p>}
    </section>
    </fieldset>
    {!['legacy','endpoint','return-choice','vehicle','fare'].includes(page)&&(question.choices.length>0||!!question.search)&&dockHost&&createPortal(<ContextPalette card={card} model={model} busy={busy} configure appearance="bar" question={question} questionScroll={dockScroll} onQuestionScrollChange={saveDockScroll} choose={()=>{}} close={()=>go("summary")}/>,dockHost)}
  </div>;
}
