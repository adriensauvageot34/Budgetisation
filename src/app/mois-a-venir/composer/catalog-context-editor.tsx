"use client";

import { useRef, useState } from "react";
import { SOCIAL_CONTACTS_V1 } from "@/domain/phase2/planned-rules";
import { useWorkshopRaw } from "./inline-edit-registry";
import type { ProspectivePersonRef, ProspectivePlaceRef } from "@/domain/phase2/planned-contract";
import { prospectivePersonIdentity } from "@/domain/phase2/planned-product";
import type { PlannerJson } from "@/domain/phase2/planner/json";
import type { PlannedContextState } from "@/domain/phase2/planner/semantic-state";
import type { ComponentSelectionV1 } from "@/domain/phase2/planner/component-contract";
import { componentId } from "@/domain/phase2/planner/identity";
import { presetForContext, composerPreset } from "@/domain/phase2/planner/composer-presets";
import type { ComposerEditor, ComposerOperation, ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import type { DropTarget } from "@/domain/phase2/planner/composer-contract";
import { PlannedContactField } from "../planned-people-fields";
import { ContactPlaceReference } from "./workshop-place-reference";
import { CardKnowledgePanel } from "./card-knowledge-panel";
import type { CardKnowledgeRead } from "@/domain/phase2/planner/card-knowledge-contract";
import { WorkshopDock } from "./workshop-dock";
import type { ContextPalette, PaletteQuestion } from "./context-palette";
import { beautyProductPresentation, beautyProductEquipment, beautyProductSuggestions } from "./beauty-product-edit";
import { SuggestionControls, type SuggestionDismissal } from "./suggestion-controls";
import { IntentBudgetImpact } from "./intent-budget-impact";
import { intentionNavigationEntries, WorkshopNavigation } from "./workshop-navigation";
import { LinkedIntentions } from "./linked-intentions";
import { ProjectCompletion } from "./project-completion";
import { useWorkshopConfirmation } from "./workshop-confirmation";
import { useCommittedEvent } from "./use-committed-event";
import { publishedDrop } from "./interactions";
import { money } from "./display";
import styles from "./composer.module.css";

type Values = Record<string, PlannerJson>;
const person = (value: PlannerJson | undefined): ProspectivePersonRef | undefined => value && typeof value === "object" && !Array.isArray(value)
  && ["HOUSEHOLD_PERSON", "CONTACT", "TEXT"].includes(String((value as Record<string, PlannerJson>).kind)) ? value as ProspectivePersonRef : undefined;
const place = (value: PlannerJson | undefined): ProspectivePlaceRef | undefined => value && typeof value === "object" && !Array.isArray(value)
  && ["KNOWN", "TEXT"].includes(String((value as Record<string, PlannerJson>).kind)) ? value as ProspectivePlaceRef : undefined;
const participants = (value: PlannerJson | undefined): ProspectivePersonRef[] => Array.isArray(value)
  ? value.flatMap(item => person(item) ? [person(item)!] : []) : [];

/** Edits only published context fields. Equipment remains attached through its R6 sockets. */
export function CatalogContextEditor({ context, editor, targetMonth, householdPersons, options, knowledge, busy, model, dockHost, choose, focusSelectionId, placeDeclines = [], declinePlace = () => {}, onSave, onCancel, onOpenChild, dismissedSuggestions, updateSuggestionDismissal }: {
  context: PlannedContextState; editor: ComposerEditor; targetMonth: string;
  householdPersons: ComposerUiModel["householdPersons"]; options?: ComposerUiModel["mobilityOptions"];
  knowledge?: CardKnowledgeRead;
  placeDeclines?: readonly string[]; declinePlace?: (key: string) => void;
  model: ComposerUiModel; dockHost?: HTMLElement | null; choose: Parameters<typeof ContextPalette>[0]["choose"];
  focusSelectionId?: string;
  onOpenChild?: (id: string) => void;
  busy: boolean; onSave: (operation: ComposerOperation) => boolean; onCancel: () => void;
} & SuggestionDismissal) {
  const [values, setValues] = useState<Values>(() => Object.fromEntries(editor.fields.map(field => [field.key, context.fields[field.key] ?? null])) as Values);
  const [query,setQuery]=useState("");
  const [error, setError] = useState("");
  const acceptedValues = useRef(values), initialValues = acceptedValues.current;
  const leaveRaw = useWorkshopRaw(context.contextOccurrenceId, JSON.stringify(values) !== JSON.stringify(initialValues), () => {
    setValues(initialValues); setError("");
  });
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [summaryPage, setSummaryPage] = useState(0);
  const posts = Object.entries(context.slotSelections).flatMap(([slotKey, slot]) =>
    ((slot.items ?? []) as readonly ComponentSelectionV1[]).flatMap(item => item.kind === "COMPONENT" ? [{ slotKey, item }] : []));
  const card = model.board.contexts.find(item => item.contextOccurrenceId === context.contextOccurrenceId);
  const protectedRef = (ref: string) => model.semanticState.preferences.anchors.includes(ref)
    || model.semanticState.preferences.flexibility[ref] === "PRESERVE";
  const confirm = useWorkshopConfirmation();
  const project = presetForContext(context)?.presetKey;
  const childSlot = project === "composed-outing" ? "children" : project === "visit-friends" ? "activities" : null;
  const childTarget: DropTarget = { kind: "CONTEXT_SOCKET", contextOccurrenceId: context.contextOccurrenceId, slotKey: childSlot ?? undefined };
  const childSocket = childSlot && card?.sockets.find(socket => socket.slotKey === childSlot
    && socket.capabilityRefs.includes(`${context.templateKey}:${childSlot}:ATTACH_CHILD_CONTEXT`));
  const canAttach = !!childSocket && !busy && !card?.readOnly && !!card?.capabilityRefs.includes("PATCH_CONTEXT")
    && !protectedRef(context.contextOccurrenceId);
  const candidates = canAttach ? intentionNavigationEntries(model.board.contexts.filter(child =>
    child.contextOccurrenceId !== context.contextOccurrenceId && !child.parentContextOccurrenceId && !child.readOnly && !protectedRef(child.contextOccurrenceId)
    && publishedDrop(model, `context-occurrence:${child.contextOccurrenceId}`, childTarget)?.choices.includes("REPARENT_PRESERVE_ID"))) : [];
  const additions = project === "visit-friends" ? ["museum-exhibition", "restaurant-for-two"] : ["cinema", "restaurant-for-two"];
  const addOptions = canAttach ? additions.map(composerPreset).flatMap(preset => {
    const assetKey = `template:${preset?.templateKey}`;
    return preset && publishedDrop(model, assetKey, childTarget)?.semanticAction === "PATCH_CONTEXT" ? [{ preset, assetKey }] : [];
  }) : [];
  const attach = useCommittedEvent((operation: ComposerOperation) => {
    if (!canAttach || operation.kind !== "DROP") return;
    const candidate = operation.presetKey ? addOptions.some(option => option.preset.presetKey === operation.presetKey)
      : candidates.some(item => item.id === operation.identity);
    if (candidate) onSave(operation);
  });
  const confirmAttachment = (label: string, operation: () => ComposerOperation) => {
    const open = () => confirm({ message: `Associer « ${label} » à cette intention ?`, acceptLabel: "Associer cette intention",
      accept: () => attach(operation()) });
    if (leaveRaw(open)) open();
  };
  const componentRoute = (slotKey: string, optionKey: string, selection?: ComponentSelectionV1) => {
    if (!card || card.readOnly || !card.capabilityRefs.includes("PATCH_CONTEXT") || protectedRef(card.contextOccurrenceId)) return null;
    const target = { kind: "CONTEXT_SOCKET" as const, contextOccurrenceId: card.contextOccurrenceId, slotKey };
    const assetKey = `option:${context.templateKey}:${slotKey}:${optionKey}`;
    const socket = card.sockets.find(candidate => candidate.slotKey === slotKey && candidate.contextOccurrenceId === card.contextOccurrenceId);
    const asset = model.library.searchableAssets.find(candidate => candidate.assetKey === assetKey && candidate.optionKind === "COMPONENT");
    if (!asset || !socket?.choiceAssetKeys?.includes(assetKey) || publishedDrop(model, assetKey, target)?.semanticAction !== "PATCH_CONTEXT") return null;
    if (selection && (!socket.currentItems.some(item => item.selectionId === selection.selectionId && item.kind === selection.kind && item.optionKey === optionKey)
      || protectedRef(componentId(card.contextOccurrenceId, slotKey, selection.selectionId)))) return null;
    return { asset, target, selection };
  };
  const beautyProduct = beautyProductPresentation(context);
  const mascaraPreset = beautyProduct?.key === "mascara";
  const [showChoices, setShowChoices] = useState(false);
  const [needKey, setNeedKey] = useState<string | null>(null);
  const suggestions = beautyProduct ? beautyProductSuggestions(context, model) : [];
  const ranked = suggestions.filter(candidate => !dismissedSuggestions?.includes(candidate.key)).slice(0, 4);
  const activeNeed = suggestions.find(candidate => candidate.kind === "NEED" && candidate.key === needKey);
  const openProductSuggestion = useCommittedEvent((key: string) => {
    if (busy) return;
    const suggestion = suggestions.find(candidate => candidate.key === key);
    if (suggestion?.kind === "NEED") setNeedKey(key);
    if (suggestion?.kind === "PRODUCT") choose(suggestion.route.asset, suggestion.route.target, suggestion.route.selection);
  });
  const [summaryTab, setSummaryTab] = useState<"fields" | "posts">(posts.length ? "posts" : "fields");
  const [postPage, setPostPage] = useState(() => focusSelectionId
    ? Math.floor(Math.max(0, posts.findIndex(({ item }) => item.selectionId === focusSelectionId)) / 3) : 0);
  const [personPage, setPersonPage] = useState(0);
  const update = (key: string, value: PlannerJson) => setValues(previous => ({ ...previous, [key]: value }));
  const save = () => {
    try {
      setError("");
      const patch: Values = {};
      for (const field of editor.fields) {
        const raw = values[field.key] ?? null;
        const value = typeof raw === "string" ? raw.trim() : raw;
        const personValue = person(value), placeValue = place(value);
        if (field.kind === "PERSON_REF" && personValue?.kind === "TEXT" && !personValue.label.trim()
          || field.kind === "PLACE_REF" && placeValue?.kind === "TEXT" && !placeValue.label.trim())
          throw Error("Précisez le nom de la personne ou du lieu, ou laissez ce champ inconnu.");
        if (field.kind === "PERSON_REFS") {
          const refs = participants(value);
          if (refs.some(ref => ref.kind === "TEXT" && !ref.label.trim()) || new Set(refs.map(prospectivePersonIdentity)).size !== refs.length)
            throw Error("Précisez chaque participant une seule fois, ou retirez la ligne vide.");
        }
        if (field.kind === "DATE" && value && typeof value === "string" && !value.startsWith(`${targetMonth}-`))
          throw Error("La date doit appartenir au mois composé.");
        const normalized = field.kind === "COUNT" ? value === "" || value === null ? null : Number(value) : value;
        if (field.kind === "COUNT" && normalized !== null && (typeof normalized !== "number" || !Number.isInteger(normalized) || normalized < 1 || normalized > 366))
          throw Error("Indiquez un nombre entier admissible, ou laissez-le inconnu.");
        const original = context.fields[field.key] ?? null;
        if (JSON.stringify(normalized) !== JSON.stringify(original)) patch[field.key] = normalized;
      }
      if (!Object.keys(patch).length) { acceptedValues.current = values; setActiveKey(null); return; }
      if (onSave({ kind: "EDIT_CONTEXT", contextOccurrenceId: context.contextOccurrenceId, values: patch })) { acceptedValues.current = values; setActiveKey(null); }
      else setError("Ce choix n’a pas été admis. Le brouillon local reste disponible.");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Vérifiez les champs du moment."); }
  };
  const directOptions = beautyProduct ? [] : (card?.sockets ?? []).flatMap(socket => {
    if (socket.currentItems.length > 1) return [];
    const selection = socket.currentItems[0];
    if (selection && selection.kind !== "COMPONENT") return [];
    return model.library.searchableAssets.flatMap(asset => {
      if (asset.optionKind !== "COMPONENT" || !asset.optionKey || !socket.choiceAssetKeys?.includes(asset.assetKey)
        || selection && selection.optionKey !== asset.optionKey) return [];
      const route = componentRoute(socket.slotKey, asset.optionKey, selection);
      return route ? [route] : [];
    });
  });
  const directPost = directOptions.length === 1 && posts.length <= 1 ? directOptions[0] : null;
  const productShortcut = beautyProduct && posts.length <= 1
    ? beautyProductEquipment(model, model.semanticState, context.contextOccurrenceId, posts[0]?.item) : undefined;
  const directChoice = productShortcut && beautyProduct ? { key: "beauty-product-price",
    catalogAssetKey: beautyProduct.catalogAssetKey,
    label: productShortcut.selection ? "Prix et quantité" : "Ajouter un produit", iconKey: productShortcut.asset.iconKey,
    choose: () => choose(productShortcut.asset, productShortcut.target, productShortcut.selection) }
    : directPost ? { key: "direct-price", label: "Prix direct", iconKey: directPost.asset.iconKey,
      choose: () => choose(directPost.asset, directPost.target, directPost.selection) } : null;
  const selectedField=editor.fields.find(field=>field.key===activeKey);
  const match=(label:string)=>label.normalize("NFD").replace(/\p{Diacritic}/gu,"").toLowerCase().includes(query.normalize("NFD").replace(/\p{Diacritic}/gu,"").toLowerCase());
  const tile=(key:string,label:string,choose:()=>void,selected=false)=>({key,label,choose,selected,iconKey:"activity"});
  const returnChoice=tile("summary","Résumé",()=>setActiveKey(null));
  const question:PaletteQuestion|undefined = selectedField?.kind==="CHOICE"?{title:selectedField.label,choices:[
    ...(selectedField.choices??[]).map(c=>tile(c.value,c.label,()=>update(selectedField.key,c.value),values[selectedField.key]===c.value)),
    tile("unknown","À préciser",()=>update(selectedField.key,null)),returnChoice]}
    :selectedField?.kind==="PERSON_REF"?{title:selectedField.label,search:{value:query,change:setQuery,label:"Rechercher une personne"},choices:[
      ...householdPersons.filter(p=>match(p.displayName)).map(p=>tile(p.personId,p.displayName,()=>update(selectedField.key,{kind:"HOUSEHOLD_PERSON",personId:p.personId}))),
      ...SOCIAL_CONTACTS_V1.filter(p=>match(p.label)).map(p=>tile(p.key,p.label,()=>update(selectedField.key,{kind:"CONTACT",contactKey:p.key}))),
      tile("free","Autre personne",()=>update(selectedField.key,{kind:"TEXT",label:""})),tile("unknown","À préciser",()=>update(selectedField.key,null)),returnChoice]}
    :selectedField?.kind==="PLACE_REF"?{title:selectedField.label,search:{value:query,change:setQuery,label:"Rechercher un lieu connu"},choices:[
      ...(options?.places??[]).filter(p=>match(p.name)).map(p=>tile(p.placeId,p.name,()=>update(selectedField.key,{kind:"KNOWN",placeId:p.placeId}))),
      tile("free","Autre destination",()=>update(selectedField.key,{kind:"TEXT",label:"",provenance:"USER_DECLARED_PROSPECTIVE"})),tile("unknown","À préciser",()=>update(selectedField.key,null)),returnChoice]}
    : activeKey === null && beautyProduct && !showChoices && !activeNeed && ranked.length ? {
      title: mascaraPreset ? "Suggestions pour ce mascara" : `Suggestions · ${beautyProduct.label}`,
      nature: "DECISION", identity: "beauty-product-suggestions",
      choices: ranked.map(candidate => ({ ...candidate, showHint: true, choose: () => {
        const open = () => openProductSuggestion(candidate.key);
        if (leaveRaw(open)) open();
      } })),
    } : undefined;
  return <div data-catalog-context-editor={context.templateKey} data-beauty-product={beautyProduct?.key} data-mascara-catalog={mascaraPreset || undefined}
    data-mascara-suggestions={mascaraPreset && question?.identity === "beauty-product-suggestions" || undefined} className={styles.nightEditor}>
    <WorkshopNavigation contextId={context.contextOccurrenceId} />
    <p className={styles.helper}>Les informations restent liées à ce moment. La palette propose les postes compatibles ; seuls ces postes peuvent porter un coût.</p>
    {activeKey === null && <section className={styles.nightSection} data-catalog-summary><h3>{String(context.fields.label ?? "Votre intention")}</h3>
      <p>Choisissez uniquement la précision utile maintenant. Les autres informations restent inconnues.</p>
      {activeNeed?.kind === "NEED" && <section aria-label="Besoin de renouvellement lié">
        <p>{activeNeed.caption}</p>
        <button type="button" onClick={() => setNeedKey(null)}>Retour aux suggestions</button>
      </section>}
      {beautyProduct && !activeNeed && ranked.length > 0 && <button type="button" aria-pressed={showChoices}
        onClick={() => setShowChoices(value => !value)}>{showChoices ? "Revenir aux suggestions" : mascaraPreset ? "Tous les choix du mascara" : "Tous les choix du produit"}</button>}
      {beautyProduct && !activeNeed && <SuggestionControls occurrenceId={context.contextOccurrenceId} choices={ranked} busy={busy}
        dismissedSuggestions={dismissedSuggestions} updateSuggestionDismissal={updateSuggestionDismissal} />}
      {beautyProduct && !activeNeed && <IntentBudgetImpact model={model} contextId={context.contextOccurrenceId} />}
      {childSlot && <>
        <LinkedIntentions model={model} parentId={context.contextOccurrenceId} busy={busy} open={onOpenChild} />
        <ProjectCompletion model={model} parentId={context.contextOccurrenceId} busy={busy} decide={onSave} />
        {(candidates.length > 0 || addOptions.length > 0) && <details>
          <summary>Associer une intention</summary>
          {candidates.map(child => <button key={child.id} type="button" onClick={() => confirmAttachment(child.label, () => ({
            kind: "DROP", assetKey: `context-occurrence:${child.id}`, target: childTarget, identity: child.id, selectionId: crypto.randomUUID(), values: {},
          }))}>Rattacher {child.label}</button>)}
          {addOptions.map(({ preset, assetKey }) => <button key={preset.presetKey} type="button" onClick={() => confirmAttachment(preset.label, () => ({
            kind: "DROP", assetKey, presetKey: preset.presetKey, target: childTarget, identity: crypto.randomUUID(), selectionId: crypto.randomUUID(), values: {},
          }))}>Ajouter {preset.label}</button>)}
        </details>}
      </>}
      {!!posts.length && <nav className={styles.nightNav} aria-label="Résumé de l’intention"><button type="button" aria-pressed={summaryTab === "fields"} onClick={() => setSummaryTab("fields")}>Informations</button><button type="button" aria-pressed={summaryTab === "posts"} onClick={() => setSummaryTab("posts")}>Postes ({posts.length})</button></nav>}
      {summaryTab === "fields" && editor.fields.slice(summaryPage * 3, summaryPage * 3 + 3).map(field => <button key={field.key} type="button" onClick={() => setActiveKey(field.key)}>
        {field.label} · {typeof values[field.key] === "string" || typeof values[field.key] === "number" ? String(values[field.key] || "À préciser") : values[field.key] ? "Choix conservé" : "À préciser"}</button>)}
      {summaryTab === "fields" && editor.fields.length > 3 && <div className={styles.nightPage}><button type="button" disabled={summaryPage === 0} onClick={() => setSummaryPage(page => page - 1)}>Précédent</button><span>{summaryPage + 1} / {Math.ceil(editor.fields.length / 3)}</span><button type="button" disabled={(summaryPage + 1) * 3 >= editor.fields.length} onClick={() => setSummaryPage(page => page + 1)}>Suivant</button></div>}
      {summaryTab === "posts" && posts.slice(postPage * 3, postPage * 3 + 3).map(({slotKey, item}, index) => {
        if (beautyProduct) {
          const writable = beautyProductEquipment(model, model.semanticState, context.contextOccurrenceId, item);
          const price = item.cost.kind === "MANUAL" ? money(item.cost.unitAmount)
            : item.cost.kind === "QUOTE" ? "Devis conservé" : "Prix inconnu";
          return <button key={item.selectionId} type="button" data-mascara-post={item.selectionId}
            autoFocus={focusSelectionId === item.selectionId && !!writable} disabled={busy || !writable}
            onClick={() => { if (writable) choose(writable.asset, writable.target, writable.selection); }}>
            {writable ? "Prix et quantité" : "Modification indisponible"} · {item.label} · {item.quantity.replace(".", ",")} × {price}
            {posts.length > 1 && ` · Poste ${postPage * 3 + index + 1}`}
          </button>;
        }
        const route = componentRoute(slotKey, item.optionKey, item);
        return <button key={item.selectionId} type="button" disabled={busy || !route}
          onClick={() => { if (route) choose(route.asset, route.target, route.selection); }}>
          {route ? "Modifier" : "Consulter"} {item.label} · {item.cost.kind === "MANUAL" ? `${item.quantity} × ${item.cost.unitAmount} €` : "Prix inconnu ou devis conservé"}</button>;
      })}
      {summaryTab === "posts" && posts.length > 3 && <div className={styles.nightPage}><button type="button" disabled={postPage === 0} onClick={() => setPostPage(page => page - 1)}>Précédent</button><span>{postPage + 1} / {Math.ceil(posts.length / 3)}</span><button type="button" disabled={(postPage + 1) * 3 >= posts.length} onClick={() => setPostPage(page => page + 1)}>Suivant</button></div>}
      <p>Choisissez les composants réels et leur prix dans le dock sous le Board.</p></section>}
    {activeKey !== null && <details><summary>Repères et provenance</summary><CardKnowledgePanel knowledge={knowledge} /></details>}
    <div className={styles.nightEditorScroll}><div className={styles.formFields}>{editor.fields.filter(field => field.key === activeKey).map(field => {
      const value = values[field.key];
      if (field.kind === "PERSON_REF") return <PlannedContactField key={field.key} label={field.label} value={person(value)} householdPersons={householdPersons}
        onChange={ref => update(field.key, ref ?? null)} />;
      if (field.kind === "PLACE_REF") return <div key={field.key}>
        {context.templateKey === "friend-visit" && <ContactPlaceReference declined={placeDeclines} decline={declinePlace} contact={person(values.personVisitedRef)} places={options?.places ?? []} value={place(value)} friend onChoose={ref => update(field.key, ref)} />}
        {place(value)?.kind==="TEXT"?<label>Destination libre<input value={(place(value) as Extract<ProspectivePlaceRef,{kind:"TEXT"}>).label} onChange={event=>update(field.key,{kind:"TEXT",label:event.target.value,provenance:"USER_DECLARED_PROSPECTIVE"})}/></label>:<p>{place(value)?.kind==="KNOWN"?options?.places.find(p=>p.placeId===(place(value) as Extract<ProspectivePlaceRef,{kind:"KNOWN"}>).placeId)?.name??"Lieu lié indisponible":"Choisis une destination dans le dock, ou laisse inconnu."}</p>}</div>;
      if (field.kind === "PERSON_REFS") return <fieldset key={field.key}><legend>{field.label}</legend>
        {participants(value).slice(personPage, personPage + 1).map((ref, offset) => { const index = personPage + offset; return <div key={`${prospectivePersonIdentity(ref)}:${index}`}>
          <PlannedContactField label={`Personne ${index + 1}`} value={ref} householdPersons={householdPersons}
            onChange={next => update(field.key, participants(value).map((current, i) => i === index ? next ?? { kind: "TEXT", label: "" } : current))} />
          <button type="button" onClick={() => update(field.key, participants(value).filter((_, i) => i !== index))}>Retirer cette personne</button>
        </div>; })}
        <div className={styles.nightPage}><button type="button" disabled={personPage === 0} onClick={() => setPersonPage(page => page - 1)}>Précédent</button><span>{participants(value).length ? personPage + 1 : 0} / {participants(value).length}</span><button type="button" disabled={personPage + 1 >= participants(value).length} onClick={() => setPersonPage(page => page + 1)}>Suivant</button></div>
        <button type="button" onClick={() => { setPersonPage(participants(value).length); update(field.key, [...participants(value), { kind: "TEXT", label: "" }]); }}>Ajouter une personne</button>
      </fieldset>;
      return <label key={field.key}>{field.label}{field.kind === "CHOICE" ? <p>{field.choices?.find(c=>c.value===value)?.label??"À préciser"} · choix dans le dock</p>
        : <input type={field.kind === "DATE" ? "date" : field.kind === "COUNT" ? "number" : "text"} min={field.kind === "COUNT" ? 1 : undefined}
          max={field.kind === "COUNT" ? 366 : undefined} value={typeof value === "string" || typeof value === "number" ? value : ""}
          onChange={event => update(field.key, event.target.value)} autoComplete="off" />}</label>;
    })}</div></div>
    <WorkshopDock question={question} host={dockHost} contextId={context.contextOccurrenceId} model={model} busy={busy} choose={choose} summary={() => setActiveKey(null)}
      choices={[...(directChoice ? [directChoice] : []),{ key: "summary", label: "Résumé", iconKey: "activity", selected: activeKey === null, choose: () => setActiveKey(null) },
        ...editor.fields.map(field => ({ key: field.key, label: field.label, iconKey: "activity", selected: activeKey === field.key, choose: () => setActiveKey(field.key) }))]} />
    {error && <p role="alert" className={styles.formError}>{error}</p>}
    <footer><button type="button" className={styles.secondary} disabled={busy} onClick={activeKey === null ? onCancel : () => setActiveKey(null)}>{activeKey === null ? "Retour au mois" : "Retour au résumé"}</button>
      {activeKey !== null && <button type="button" className={styles.primary} disabled={busy} onClick={save}>Conserver et prévisualiser</button>}</footer>
  </div>;
}
