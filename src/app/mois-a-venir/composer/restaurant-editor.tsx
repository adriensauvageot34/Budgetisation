"use client";

import { guidedContextShape, type GuidedContextEdit } from "@/domain/phase2/planner/guided-context-edit";
import { presetForContext } from "@/domain/phase2/planner/composer-presets";
import type { RestaurantEdit } from "@/domain/phase2/planner/restaurant-edit";
import { PresetIllustration } from "./preset-illustration";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronRight, X, Users, MapPin, CalendarDays, Receipt, Plus } from "lucide-react";
import type { ComposerAssetView, ComposerContextCardView, DropTarget } from "@/domain/phase2/planner/composer-contract";
import type { ComposerOperation, ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import type { PlannedContextState } from "@/domain/phase2/planner/semantic-state";
import type { ComponentSelectionV1 } from "@/domain/phase2/planner/component-contract";
import type { ProspectivePersonRef, ProspectivePlaceRef } from "@/domain/phase2/planned-contract";
import type { PlannerJson } from "@/domain/phase2/planner/json";
import { prospectivePersonIdentity } from "@/domain/phase2/planned-product";
import { nextUnansweredQuestion } from "@/domain/phase2/question-navigation";
import { decisionAmount } from "@/domain/phase2/month-decision-contract";

import { PlannedContactField } from "../planned-people-fields";
import { PlannedPlaceField } from "../planned-place-field";
import { ComponentRow, fresh, fromSelection, buildComponentRow, type Row } from "./night-out-editor";
import { CardKnowledgePanel } from "./card-knowledge-panel";
import { ContextPalette } from "./context-palette";
import { PlannerIcon } from "./planner-icons/planner-icon";
import { money } from "./display";
import styles from "./composer.module.css";

type Component = Extract<ComponentSelectionV1, { kind: "COMPONENT" }>;
type Step = "product" | "participants" | "place" | "date" | "budget" | "binding" | "complete" | null;
const restaurantQuestions = [{ id: "participants", key: "participantRefs", title: "Qui vient au restaurant ?" },
  { id: "place", key: "placeRef", title: "Où allez-vous manger ?" },
  { id: "date", key: "plannedDate", title: "Quand est prévu ce restaurant ?" },
  { id: "budget", key: "meal", title: "Quel budget pour l’addition ?" },
  { id: "binding", key: "binding", title: "Dans quel budget ?" }] as const;
const items = (context: PlannedContextState, slot: string) => (context.slotSelections[slot]?.items ?? []) as readonly ComponentSelectionV1[];
const components = (context: PlannedContextState, slot: string) => items(context, slot).filter((item): item is Component => item.kind === "COMPONENT");
const isDetailed = (context: PlannedContextState) => components(context, "extras").length > 0
  || components(context, guidedContextShape(context.templateKey).slot).some(item => item.quantity !== "1" && item.quantity !== "1.00" || item.unitBasis === "PERSON");
const priceCaption = (item?: Component) => !item ? "À préciser" : item.cost.kind === "MANUAL"
  ? `${item.quantity === "1" || item.quantity === "1.00" ? "" : `${item.quantity} × `}${money(item.cost.unitAmount)}`
  : item.cost.kind === "QUOTE" ? "Devis conservé" : "Prix à préciser";

/** Guided presentation shared with three admitted L2 recipes; one existing semantic Draft/scheduler. */
export function RestaurantEditor({ context, card, model, creating, busy, decide, close }: {
  context: PlannedContextState; card: ComposerContextCardView; model: ComposerUiModel; creating: boolean; busy: boolean;
  decide: (operation: ComposerOperation) => boolean; close: () => void;
}) {
  const shape = guidedContextShape(context.templateKey), preset = presetForContext(context);
  const mainSlot = shape.slot, heading = card.label;
  const operation = (edit: GuidedContextEdit): ComposerOperation => context.templateKey === "restaurant" ? { kind: "EDIT_RESTAURANT", edit: edit as RestaurantEdit } : { kind: "EDIT_PRESET_CONTEXT", edit };
  const questions: readonly {id: Exclude<Step,null>; key: string; title:string}[] = [
    ...(context.templateKey === "purchase" ? [{id:"product" as const,key:"productLabel",title:"Quel vêtement ou achat préparez-vous ?"}] : []),
    ...restaurantQuestions.filter(q => (q.id !== "participants" || shape.participants) && (q.id !== "binding" || !!shape.envelope)).map(q => ({...q,key:q.key === "meal" ? mainSlot : q.key,title:preset ? ({participants:"Qui est concerné ?",place:"Où prévoyez-vous ce moment ?",date:"Quand ? Vous pouvez décider plus tard.",budget:"Quel budget souhaitez-vous prévoir ?",binding:"Dans quelle enveloppe ?"}[q.id]) : q.title}))];
  const main = components(context, mainSlot)[0], extras = components(context, "extras");
  const answered = (id: string) => id === "budget" ? !!main && main.provenance === "EXPLICIT_USER_DECISION"
    : id === "binding" ? !!main?.binding && main.binding.mode !== "AUTO"
      : Object.hasOwn(context.fields, questions.find(q => q.id === id)!.key);
  const [step, setStep] = useState<Step>(() => creating ? nextUnansweredQuestion(questions, null, answered)?.id ?? "complete" : null);
  const [formKey, setFormKey] = useState(0);
  const [person, setPerson] = useState<ProspectivePersonRef>();
  const [place, setPlace] = useState<ProspectivePlaceRef | undefined>(context.fields.placeRef as ProspectivePlaceRef | undefined ?? undefined);
  const [date, setDate] = useState(String(context.fields.plannedDate ?? ""));
  const [row, setRow] = useState<Row>(() => main ? fromSelection(main) : { ...fresh(shape.total), unitBasis: "SHARED" });
  const [detail, setDetail] = useState(isDetailed(context));
  const [extraRow, setExtraRow] = useState<Row | null>(null);
  const [equipment, setEquipment] = useState<{ asset: ComposerAssetView; target: DropTarget } | null>(null);
  const [allOptions, setAllOptions] = useState(false), [error, setError] = useState("");
  const panel = useRef<HTMLElement>(null);
  const mealSignature = JSON.stringify(main), priorMeal = useRef(mealSignature);
  // A confirmed semantic change (including Undo/Redo) supersedes the input buffer.
  // An ordinary Preview of the same decision must not erase text being entered.
  useEffect(() => {
    if (priorMeal.current === mealSignature) return;
    priorMeal.current = mealSignature;
    setRow(main ? fromSelection(main) : { ...fresh(shape.total), unitBasis: "SHARED" });
    setDetail(isDetailed(context)); setExtraRow(null);
  }, [mealSignature, main, context, shape.total]);
  const refs = Array.isArray(context.fields.participantRefs) ? context.fields.participantRefs as ProspectivePersonRef[] : [];
  const personLabel = (ref: ProspectivePersonRef) => ref.kind === "HOUSEHOLD_PERSON"
    ? model.householdPersons.find(p => p.personId === ref.personId)?.displayName ?? "Personne indisponible" : ref.kind === "TEXT" ? ref.label : ref.contactKey;
  const placeLabel = context.fields.placeRef as ProspectivePlaceRef | null | undefined;
  const binding = main?.binding?.mode;
  const bindingLabel = binding === "CONFIRMED_CONSUMPTION" ? "Inclus dans Restaurants habituels"
    : binding === "EXTRA_TO_SLOT" ? "Une dépense en plus" : binding === "NO_RELATED_SLOT" ? "Sans enveloppe liée" : "Selon l’enveloppe · à confirmer";
  const known = model.cardKnowledge[`template:${context.templateKey}`];
  const suggestion = known?.dimensions.find(d => d.key === "UNIT_PRICE" && d.value !== null && d.suggestionPolicy === "OFFER_PREFILL");
  const open = (next: Step) => {
    setStep(next); setError(""); setExtraRow(null); setEquipment(null); setFormKey(k => k + 1);
    setDate(String(context.fields.plannedDate ?? "")); setPlace(context.fields.placeRef as ProspectivePlaceRef | undefined ?? undefined);
    setRow(main ? fromSelection(main) : { ...fresh(shape.total), unitBasis: "SHARED" }); setDetail(isDetailed(context));
  };
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      panel.current?.querySelector<HTMLElement>(step === null ? "h2" : "[data-restaurant-focus]")?.focus({ preventScroll: step === null });
      if (step === null && panel.current) panel.current.scrollTop = 0;
    });
    return () => cancelAnimationFrame(frame);
  }, [step, formKey]);
  const send = (operation: ComposerOperation) => {
    setError("");
    try { if (!decide(operation)) { setError("Ce choix ne peut pas être admis. Votre brouillon est conservé."); return false; } return true; }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Vérifiez ce choix."); return false; }
  };
  const advance = (answeredStep: Step) => {
    const position = questions.findIndex(q => q.id === answeredStep);
    setStep(creating ? questions.slice(position + 1).find(q => !answered(q.id))?.id ?? "complete" : null);
  };
  const fields = (patch: Record<string, PlannerJson>, id: Step) => {
    if (send(operation({ contextOccurrenceId: context.contextOccurrenceId, fields: patch }))) advance(id);
  };
  const saveBudget = (selectedRow = row) => {
    try {
      const item = buildComponentRow({ ...selectedRow, edited: true }, shape.option);
      if (!detail && extras.length && !window.confirm("Remplacer le détail par ce total ? Les compléments seront retirés. Undo permet de revenir au détail.")) return;
      if (send(operation({ contextOccurrenceId: context.contextOccurrenceId,
        slots: { [mainSlot]: [item], ...(!detail ? { extras: [] } : {}) } }))) advance("budget");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Vérifiez le budget."); }
  };
  const chooseMode = (next: boolean) => {
    if (next === detail) return;
    if (!window.confirm(next ? "Remplacer le montant global par un détail ? Le premier élément sera à préciser ; aucun total ne sera ajouté aux lignes."
      : "Remplacer le détail par un total ? Validez ensuite la nouvelle addition. Aucun changement n’est encore enregistré.")) return;
    setDetail(next);
    setRow(previous => ({ ...previous, label: next ? "Élément hors compléments" : shape.total, quantity: "1", unitBasis: "SHARED",
      personCount: "", amount: "", costMode: "UNKNOWN", edited: true, fundingMode: "UNDECIDED", fundingAmount: "" }));
  };
  const equip = (asset: ComposerAssetView, target: DropTarget) => {
    setError("");
    if (asset.optionKind === "COMPONENT") {
      if (target.slotKey === mainSlot) { open("budget"); return; }
      const existing = extras.find(item => item.optionKey === asset.optionKey);
      if (!existing && !detail && main && !window.confirm("Ce complément s’ajoutera au montant. Confirmez qu’il n’est pas déjà inclus.")) return;
      setExtraRow(existing ? fromSelection(existing) : fresh(shape.complement));
    } else { setExtraRow(null); setEquipment({ asset, target }); setFormKey(k => k + 1); }
    setAllOptions(false); setStep("complete");
  };
  const currentTransport = items(context, "transport").find(item => item.kind === "MOBILITY_INTENT");
  const transportValues: Record<string, string> = currentTransport ? {
    origin: currentTransport.origin?.kind === "TEXT" ? currentTransport.origin.label : "",
    destination: currentTransport.destination?.kind === "TEXT" ? currentTransport.destination.label : "",
    returnRequired: String(!!currentTransport.returnRequired), plannedTime: currentTransport.plannedTime ?? "", returnTime: currentTransport.returnTime ?? "",
    ...(equipment?.asset.optionKey === currentTransport.optionKey ? {
      amount: currentTransport.pricing?.fare.kind === "MANUAL" ? currentTransport.pricing.fare.unitAmount : "",
      funding: currentTransport.pricing?.fundingAllocations.length ? currentTransport.pricing.fundingAllocations.some(a => a.source !== "BANK") ? "EXISTING" : "BANK" : "",
      fundingAmount: currentTransport.pricing?.fundingAllocations[0]?.amount ?? "", preference: currentTransport.pricing?.preference ?? "FASTEST",
      parkingMode: currentTransport.pricing?.parking.kind === "MANUAL" ? Number(currentTransport.pricing.parking.unitAmount) === 0 ? "NO" : "YES" : currentTransport.pricing?.parking.kind === "QUOTE" ? "EXISTING" : "UNKNOWN",
      parkingAmount: currentTransport.pricing?.parking.kind === "MANUAL" ? currentTransport.pricing.parking.unitAmount : "",
      targetIntentId: currentTransport.journey?.targetIntentId ?? "" } : {}) } : {};
  const panelContent = <aside ref={panel} className={styles.restaurantInspector} role="dialog" aria-modal="false" aria-labelledby="restaurant-heading" data-restaurant-editor data-guided-template={context.templateKey}
    onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); close(); } }}>
    <header>{preset ? <PresetIllustration preset={preset} className={styles.presetInspectorImage} /> : <PlannerIcon iconKey="restaurant" scale="SATELLITE" />}<div><small>Votre mois, à votre façon</small><h2 id="restaurant-heading" tabIndex={-1}>{heading}</h2></div>
      <button type="button" className={styles.iconButton} onClick={close} aria-label={`Fermer ${heading}`}><X size={18} /></button></header>
    <p className={styles.restaurantIntro}>{creating ? "Quelques choix suffisent. Vous pouvez compléter plus tard." : "Retrouvez vos choix et modifiez seulement ce qui change."}</p>
    {preset && <p className={styles.restaurantIntro}>{preset.guidance}</p>}
    <nav aria-label={`Choix de ${heading}`} className={styles.restaurantSummary}>
      {[...(context.templateKey === "purchase" ? [["product", <Receipt key="p" size={16}/>, "Article et vendeur", context.fields.productLabel ? String(context.fields.productLabel) : "À préciser"]] : []),
      ...(shape.participants ? [["participants", <Users key="i" size={16} />, "Participants", refs.length ? refs.map(personLabel).join(", ") : "À préciser"]] : []),
        ["place", <MapPin key="i" size={16} />, "Lieu", placeLabel?.kind === "TEXT" ? placeLabel.label : placeLabel?.kind === "KNOWN"
          ? model.mobilityOptions?.places.find(p => p.placeId === placeLabel.placeId)?.name ?? "Lieu lié indisponible" : "À préciser"],
        ["date", <CalendarDays key="i" size={16} />, "Date", context.fields.plannedDate ? String(context.fields.plannedDate) : "À préciser"],
        ["budget", <Receipt key="i" size={16} />, detail ? "Détail et compléments" : shape.total, `${priceCaption(main)}${extras.length ? ` + ${extras.length} complément(s)` : ""}`],
        ...(shape.envelope ? [["binding", <Check key="i" size={16} />, "Budget", bindingLabel.replaceAll("Restaurants", shape.envelope)]] : []),
        ...(shape.transport ? [["complete", <MapPin key="i" size={16} />, "Transport", currentTransport
          ? model.library.searchableAssets.find(a => a.templateKey === context.templateKey && a.optionKey === currentTransport.optionKey && a.optionKind === "MOBILITY_INTENT")?.label ?? "Trajet à préciser"
          : "Aucun trajet ajouté"]] : [])].map(([id, icon, label, caption]) => <button key={String(id)} type="button" aria-current={step === id ? "step" : undefined}
          onClick={() => open(id as Step)}>{icon}<span><small>{label}</small><strong>{caption}</strong></span><ChevronRight size={14} /></button>)}
    </nav>
    <div className={styles.restaurantQuestion} key={`${step}:${formKey}`}>
      <h3 data-restaurant-focus tabIndex={-1}>{questions.find(q => q.id === step)?.title ?? (step === "complete" ? "Les petits plus" : "Votre intention est dans le brouillon")}</h3>
      {step === "product" && <><label>Article ou commande<input defaultValue={String(context.fields.productLabel ?? "")} name="productLabel" /></label><label>Vendeur facultatif<input defaultValue={String(context.fields.merchantLabel ?? "")} name="merchantLabel" /></label><button type="button" onClick={() => { const product = panel.current?.querySelector<HTMLInputElement>('input[name="productLabel"]')?.value ?? ""; const merchant = panel.current?.querySelector<HTMLInputElement>('input[name="merchantLabel"]')?.value ?? ""; fields({productLabel:product || null,merchantLabel:merchant || null},"product"); }}>Conserver ces précisions</button></>}
      {step === "participants" && <><PlannedContactField label="Ajouter une personne" value={person} householdPersons={model.householdPersons} onChange={setPerson} />
        <button type="button" disabled={!person || person.kind === "TEXT" && !person.label.trim()} onClick={() => {
          if (person && !refs.some(ref => prospectivePersonIdentity(ref) === prospectivePersonIdentity(person))) fields({ participantRefs: [...refs, person] }, "participants");
        }}>Ajouter aux participants</button><p>Les participants ne multiplient pas le montant prévu.</p></>}
      {step === "place" && <><PlannedPlaceField label={context.templateKey === "restaurant" ? "Lieu du Restaurant" : "Lieu ou destination (facultatif)"} places={model.mobilityOptions?.places ?? []} value={place} exact onChange={setPlace} />
        <button type="button" disabled={!place || place.kind === "TEXT" && !place.label.trim()} onClick={() => fields({ placeRef: place! }, "place")}>Choisir ce lieu</button></>}
      {step === "date" && <><label>Date facultative<input type="date" value={date} min={`${model.semanticState.targetMonth}-01`} max={`${model.semanticState.targetMonth}-31`} onChange={event => setDate(event.target.value)} /></label>
        <button type="button" onClick={() => { if (date && !date.startsWith(`${model.semanticState.targetMonth}-`)) setError("Choisissez une date dans le mois composé."); else fields({ plannedDate: date || null }, "date"); }}>Confirmer la date</button></>}
      {step === "budget" && <><div className={styles.restaurantModes}><button type="button" aria-pressed={!detail} onClick={() => chooseMode(false)}>Montant total</button>
        <button type="button" aria-pressed={detail} onClick={() => chooseMode(true)}>Détailler les éléments</button></div>
        {suggestion && <p className={styles.restaurantReference}>Repère historique : {money(suggestion.value)} par occurrence.
          <button type="button" onClick={() => setRow(r => ({ ...r, amount: suggestion.value!, costMode: "MANUAL", edited: true }))}>Reprendre ce montant</button>
          <small>{suggestion.sourceAuthority} · {suggestion.coverageFrom} – {suggestion.coverageTo} · {suggestion.nCoveredMonths ?? "?"} mois</small></p>}
        {detail ? <ComponentRow title="Élément hors compléments" row={row} participantCount={refs.length} removable={false} onRemove={() => {}} onChange={setRow} />
          : <><label>{shape.total}<select value={row.costMode} onChange={e => setRow(r => ({ ...r, edited: true, costMode: e.target.value as Row["costMode"] }))}>
            <option value="UNKNOWN">Encore inconnu</option><option value="MANUAL">Montant choisi par moi</option>{row.costMode === "QUOTE" && <option value="QUOTE">Conserver le devis</option>}</select></label>
            {row.costMode === "MANUAL" && <label>{shape.total} à notre charge (€)<input inputMode="decimal" value={row.amount} onChange={e => setRow(r => ({ ...r, amount: e.target.value, edited: true }))} /></label>}
            <details><summary>Financement</summary><label>Source<select value={row.fundingMode} onChange={e => setRow(r => ({ ...r, fundingMode: e.target.value as Row["fundingMode"], edited: true }))}>
              <option value="UNDECIDED">À préciser</option><option value="BANK">Banque déclarée</option>{row.fundingMode === "EXISTING" && <option value="EXISTING">Conserver le financement antérieur</option>}</select></label>
              {row.fundingMode === "BANK" && <label>Montant Banque (€)<input inputMode="decimal" value={row.fundingAmount} onChange={e => setRow(r => ({ ...r, fundingAmount: e.target.value, edited: true }))} /></label>}</details></>}
        <p>{detail ? "Les éléments et les compléments constituent le budget. Aucun total parent ne s’y ajoute." : "Un seul montant à notre charge, quel que soit le nombre de participants."}</p>
        <button type="button" className={styles.primary} onClick={() => saveBudget()}>Valider le budget</button>
        {detail && extras.map(item => <button key={item.selectionId} type="button" onClick={() => { setStep("complete"); setExtraRow(fromSelection(item)); }}>{item.label} · {priceCaption(item)}</button>)}</>}
      {step === "binding" && <p>Le Compiler vérifie l’enveloppe réellement disponible. Sans enveloppe admissible, la relation restera à préciser. Les compléments libres sont des postes distincts.</p>}
      {(step === "complete" || step === null) && <><p>Ajoutez uniquement les compléments qui ne sont pas déjà compris dans le montant.</p>
        {extras.map(item => <button type="button" key={item.selectionId} onClick={() => setExtraRow(fromSelection(item))}>{item.label} · {priceCaption(item)}</button>)}
        <button type="button" onClick={() => { if (!detail && main && !window.confirm("Ce complément s’ajoutera au montant. Confirmez qu’il n’est pas déjà inclus.")) return;
          setDetail(true); setExtraRow(fresh(shape.complement)); }}>Ajouter un complément</button>
        {currentTransport && <button type="button" onClick={() => send(operation({ contextOccurrenceId: context.contextOccurrenceId, slots: { transport: [] } }))}>Retirer le trajet</button>}</>}
      {extraRow && <><ComponentRow title={shape.complement} row={extraRow} participantCount={refs.length} onChange={setExtraRow} onRemove={() => {
        if (send(operation({ contextOccurrenceId: context.contextOccurrenceId, slots: { extras: extras.filter(item => item.selectionId !== extraRow.id) } }))) setExtraRow(null);
      }} />
        <button type="button" onClick={() => { try { const item = buildComponentRow(extraRow, "extra");
          if (send(operation({ contextOccurrenceId: context.contextOccurrenceId, slots: { extras: [...extras.filter(old => old.selectionId !== item.selectionId), item] } }))) setExtraRow(null);
        } catch (failure) { setError(failure instanceof Error ? failure.message : "Vérifiez ce complément."); } }}>Valider le complément</button></>}
      {equipment && <form onSubmit={event => {
        event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget).entries()) as Record<string, string>;
        try {
          const sameMode = currentTransport?.optionKey === equipment.asset.optionKey;
          const placeValue = (raw: string, old: ProspectivePlaceRef | null | undefined): ProspectivePlaceRef | null => raw.trim()
            ? old?.kind === "TEXT" && old.label === raw.trim() ? old : { kind: "TEXT", label: raw.trim(), provenance: "USER_DECLARED_PROSPECTIVE" } : old ?? null;
          const origin = placeValue(values.origin ?? "", currentTransport?.origin), destination = placeValue(values.destination ?? "", currentTransport?.destination);
          const returnRequired = values.returnRequired === "true";
          const sameRoute = sameMode && JSON.stringify(origin) === JSON.stringify(currentTransport?.origin ?? null)
            && JSON.stringify(destination) === JSON.stringify(currentTransport?.destination ?? null) && returnRequired === !!currentTransport?.returnRequired
            && (values.plannedTime || null) === (currentTransport?.plannedTime ?? null) && (values.returnTime || null) === (currentTransport?.returnTime ?? null);
          const cost = values.costMode === "UNKNOWN" ? { kind: "UNKNOWN" as const }
            : values.amount?.trim() ? { kind: "MANUAL" as const, unitAmount: decisionAmount(values.amount.replace(",", ".")) }
              : sameRoute ? currentTransport?.pricing?.fare ?? { kind: "UNKNOWN" as const } : { kind: "UNKNOWN" as const };
          const parking = values.parkingMode === "EXISTING" && sameRoute ? currentTransport?.pricing?.parking ?? { kind: "UNKNOWN" as const }
            : values.parkingMode === "NO" ? { kind: "MANUAL" as const, unitAmount: "0.00" }
            : values.parkingAmount?.trim() ? { kind: "MANUAL" as const, unitAmount: decisionAmount(values.parkingAmount.replace(",", ".")) } : { kind: "UNKNOWN" as const };
          const selection: Extract<ComponentSelectionV1, { kind: "MOBILITY_INTENT" }> = {
            selectionId: currentTransport?.selectionId ?? crypto.randomUUID(), kind: "MOBILITY_INTENT", optionKey: equipment.asset.optionKey!, provenance: "EXPLICIT_USER_DECISION",
            origin, destination, returnRequired, plannedTime: values.plannedTime || null, returnTime: values.returnTime || null,
            ...(values.targetIntentId ? { journey: sameRoute && currentTransport?.journey?.relation === "SHARES_JOURNEY" && currentTransport.journey.targetIntentId === values.targetIntentId
              ? currentTransport.journey : { relation: "SHARES_JOURNEY", certainty: "CERTAIN", targetIntentId: values.targetIntentId, externalExpenseId: null, externalCostLineIds: [], choice: null, stopIndex: null, accessLegIndex: null } }
              : sameRoute && currentTransport?.journey?.relation === "SHARES_JOURNEY" && !currentTransport.journey.targetIntentId
                ? { journey: currentTransport.journey }
              : { pricing: { fare: cost, parking: equipment.asset.optionKey === "car" ? parking : { kind: "UNKNOWN" },
                fundingAllocations: values.funding === "EXISTING" && sameMode ? currentTransport?.pricing?.fundingAllocations ?? []
                  : values.funding === "BANK" ? [{ source: "BANK", amount: decisionAmount(values.fundingAmount.replace(",", ".")) }] : [], preference: values.preference === "AVOID_TOLLS" ? "AVOID_TOLLS" : "FASTEST" } }),
            ...(sameRoute && currentTransport?.journey?.relation === "OWNS_JOURNEY" && !values.targetIntentId ? { journey: currentTransport.journey } : {}),
            ...(sameRoute && equipment.asset.optionKey === "car" && currentTransport?.route && !values.targetIntentId ? { route: currentTransport.route } : {}) };
          if (send(operation({ contextOccurrenceId: context.contextOccurrenceId, slots: { transport: [selection] } }))) setEquipment(null);
        } catch (failure) { setError(failure instanceof Error ? failure.message : "Vérifiez le trajet."); }
      }}><h4>{equipment.asset.label}</h4><p>Un coût d’usage n’est pas un plein bancaire. Les données absentes restent inconnues.</p>
        {model.editors.find(e => e.assetKey === equipment.asset.assetKey)?.fields.map(field => <label key={field.key}>{field.label}{field.kind === "CHOICE"
          ? <select name={field.key} defaultValue={transportValues[field.key] ?? field.choices?.[0]?.value ?? ""}>{field.choices?.map(choice => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
            {field.key === "funding" && transportValues.funding === "EXISTING" && <option value="EXISTING">Conserver le financement antérieur</option>}
            {field.key === "parkingMode" && transportValues.parkingMode === "EXISTING" && <option value="EXISTING">Conserver le devis de stationnement</option>}</select>
          : <input name={field.key} defaultValue={transportValues[field.key] ?? field.initial ?? ""} inputMode={field.kind === "AMOUNT" ? "decimal" : undefined} />}</label>)}
        <button type="submit" disabled={busy}>Valider ce trajet</button></form>}
      {error && <p role="alert" className={styles.formError}>{error}</p>}
    </div>
    {known && <details className={styles.restaurantDiagnostics}><summary>Repères et provenance</summary><CardKnowledgePanel knowledge={known} /></details>}
    <footer><button type="button" onClick={close}>Retour au Board</button><span>Les choix validés sont conservés dans le brouillon.</span></footer>
  </aside>;
  const modes = card.sockets.find(s => s.slotKey === "transport")?.choiceAssetKeys ?? [];
  return <>{typeof document !== "undefined" && createPortal(panelContent, document.body)}
    {allOptions ? <ContextPalette card={card} model={model} busy={busy} configure choose={equip} close={() => setAllOptions(false)} />
      : <section className={`${styles.contextPalette} ${styles.restaurantPalette}`} data-restaurant-palette={step ?? "summary"} aria-label={`Guide ${heading}`}><header><div><h3>{questions.find(q => q.id === step)?.title ?? `Compléter ${heading}`}</h3>
        <p>Choisissez ici, votre intention reste visible sur le Board.</p></div><button type="button" onClick={() => setAllOptions(true)}>Autres options</button></header>
        <div className={styles.restaurantAnswers}>
          {step === "product" ? <><button type="button" onClick={() => panel.current?.querySelector<HTMLElement>("input")?.focus()}>Préciser l’article</button><button type="button" onClick={() => fields({productLabel:null,merchantLabel:null},"product")}>Décider plus tard</button></> : step === "participants" ? <>{model.householdPersons.map(p => <button key={p.personId} type="button" aria-pressed={refs.some(ref => ref.kind === "HOUSEHOLD_PERSON" && ref.personId === p.personId)} onClick={() => fields({ participantRefs: [{ kind: "HOUSEHOLD_PERSON", personId: p.personId }] }, "participants")}><Users size={18} />{p.displayName}</button>)}
            {model.householdPersons.length === 2 && <button type="button" onClick={() => fields({ participantRefs: model.householdPersons.map(p => ({ kind: "HOUSEHOLD_PERSON", personId: p.personId })) }, "participants")}><Users size={18} />Nous deux</button>}
            <button type="button" onClick={() => panel.current?.querySelector<HTMLElement>("input,select")?.focus()}><Plus size={18} />Ajouter une personne</button><button type="button" onClick={() => fields({ participantRefs: [] }, "participants")}>À préciser</button></>
            : step === "place" ? <><button type="button" onClick={() => panel.current?.querySelector<HTMLElement>("input,select")?.focus()}>Choisir ou saisir un lieu</button><button type="button" onClick={() => fields({ placeRef: null }, "place")}>Pas encore décidé</button></>
              : step === "date" ? <><button type="button" onClick={() => panel.current?.querySelector<HTMLElement>('input[type="date"]')?.focus()}>Choisir une date</button><button type="button" onClick={() => fields({ plannedDate: null }, "date")}>Pas encore décidé</button></>
                : step === "budget" ? <><button type="button" aria-pressed={!detail} onClick={() => chooseMode(false)}>Montant total</button><button type="button" aria-pressed={detail} onClick={() => chooseMode(true)}>Détailler</button><button type="button" onClick={() => {
                  saveBudget({ ...row, costMode: "UNKNOWN", edited: true });
                }}>Prix à préciser</button></>
                  : step === "binding" ? <>{[["CONFIRMED_CONSUMPTION", `Inclus dans mon budget ${shape.envelope ?? ""}`], ["EXTRA_TO_SLOT", "Une dépense en plus"]].map(([mode, label]) => <button key={mode} type="button" disabled={!main} onClick={() => {
                    if (main && send(operation({ contextOccurrenceId: context.contextOccurrenceId,
                      slots: { [mainSlot]: [{ ...main, binding: { mode: mode as "CONFIRMED_CONSUMPTION" | "EXTRA_TO_SLOT" } }] } }))) advance("binding");
                  }}>{label}</button>)}<button type="button" onClick={() => setStep("complete")}>Décider plus tard</button></>
                    : <><button type="button" onClick={() => open("budget")}><Receipt size={18} />Détail et compléments</button>{modes.map(assetKey => {
                      const asset = model.library.searchableAssets.find(a => a.assetKey === assetKey);
                      return asset ? <button type="button" key={asset.assetKey} aria-pressed={currentTransport?.optionKey === asset.optionKey} onClick={() => equip(asset, { kind: "CONTEXT_SOCKET", contextOccurrenceId: context.contextOccurrenceId, slotKey: "transport" })}><PlannerIcon iconKey={asset.iconKey} scale="SATELLITE" />{asset.label}</button> : null;
                    })}</>}
        </div></section>}</>;
}
