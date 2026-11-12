"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ComposerContextCardView } from "@/domain/phase2/planner/composer-contract";
import type { ComposerOperation, ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import { componentId } from "@/domain/phase2/planner/identity";
import { plannerDigest } from "@/domain/phase2/planner/json";
import {
  BASKET_UNITS, DELIVERY_COVERAGES, DELIVERY_MODES, isPurchaseBasket, legacyDeliveryFee, MAX_PURCHASE_ARTICLES, purchaseComponents,
  type BasketConcept, type BasketUnit, type BasketDeliveryMode, type BasketDeliveryCoverage,
  type PurchaseBasketChange, type PurchaseComponent,
} from "@/domain/phase2/planner/purchase-basket";
import { isBasketCatalogProduct } from "@/domain/phase2/planner/purchase-catalog";
import type { PlannedContextState } from "@/domain/phase2/planner/semantic-state";
import { clayCatalogArtwork, loadClayV22Collection, type ClayCatalogEntry } from "../clay-v22-catalog";
import { CatalogOpenButton } from "./catalog-discovery-provider";
import { catalogRefLocked, normalizeCatalog } from "./catalog-discovery";
import { ContextPalette, type PaletteQuestion } from "./context-palette";
import { purchaseSuggestions } from "./purchase-suggestions";
import { SuggestionControls, type SuggestionDismissal } from "./suggestion-controls";
import { IntentBudgetImpact } from "./intent-budget-impact";
import { WorkshopNavigation } from "./workshop-navigation";
import { useCommittedEvent } from "./use-committed-event";
import { useWorkshopRaw } from "./inline-edit-registry";
import { useWorkshopConfirmation } from "./workshop-confirmation";
import { money } from "./display";
import styles from "./purchase-basket.module.css";
import composer from "./composer.module.css";

const unitLabels = { UNIT: "Unité", PACK: "Lot ou pack", KG: "Kilogramme", L: "Litre" };
const modeLabels = { UNKNOWN: "À préciser", DELIVERY: "Livraison", PICKUP: "Retrait", IN_STORE: "Sur place" };
const coverageLabels = { UNKNOWN: "Frais à préciser", INCLUDED: "Frais compris", FREE: "Sans frais", ADDITIONAL: "Frais en plus" };
type Coverage = "AUTO" | "CONFIRMED_CONSUMPTION" | "EXTRA_TO_SLOT";
type ArticleForm = { kind: "article"; id: string; label: string; quantity: string; unit: BasketUnit; price: string; concept?: BasketConcept; existing?: PurchaseComponent };
type Form = ArticleForm | { kind: "extra"; selectionId: string; label: string; price: string }
  | { kind: "details"; merchant: string; date: string; coverage: Coverage }
  | { kind: "delivery"; mode: BasketDeliveryMode; coverage: BasketDeliveryCoverage; price: string; selectionId: string };
type Props = { context: PlannedContextState; card: ComposerContextCardView; model: ComposerUiModel; busy: boolean;
  decide: (operation: ComposerOperation) => boolean; close: () => void; initialConcept?: BasketConcept };
const text = (value: unknown) => typeof value === "string" ? value : "";
const articleUnit = (item?: PurchaseComponent) => item?.basketArticle?.unit ?? (item?.unitBasis === "SHARED" ? "PACK" : "UNIT");

export function EnablePurchaseBasket({ context, card, model, busy, decide }: Omit<Props, "close">) {
  const confirm = useWorkshopConfirmation();
  const guard = useWorkshopRaw(context.contextOccurrenceId, false, () => {}, "basket-upgrade");
  if (card.readOnly || !card.capabilityRefs.includes("PATCH_CONTEXT") || catalogRefLocked(model, context.contextOccurrenceId)) return null;
  const upgrade = () => confirm({ message: "Ouvrir cet achat dans le panier ? La ligne, son prix et les frais existants seront conservés.",
    acceptLabel: "Ouvrir dans le panier", accept: () => decide({ kind: "EDIT_PURCHASE_BASKET",
      edit: { contextOccurrenceId: context.contextOccurrenceId, expectedContextDigest: plannerDigest(context), change: { kind: "UPGRADE" } } }) });
  return <button type="button" disabled={busy} onClick={() => { if (guard(upgrade)) upgrade(); }}>Passer au panier multi-articles</button>;
}

export function PurchaseBasketEditor({ context, card, model, busy, decide, close, initialConcept, dismissedSuggestions, updateSuggestionDismissal }: Props & SuggestionDismissal) {
  const id = context.contextOccurrenceId;
  const digest = plannerDigest(context);
  const groceries = context.fields.budgetDomain === "groceries";
  const clothing = context.fields.budgetDomain === "clothing";
  const writable = context.status === "ACTIVE" && card.contextOccurrenceId === id && isPurchaseBasket(card)
    && !card.readOnly && card.externalIntentId === null && card.capabilityRefs.includes("PATCH_CONTEXT") && !catalogRefLocked(model, id);
  const articles = purchaseComponents(context, "item");
  const delivery = purchaseComponents(context, "shipping")[0];
  const extras = purchaseComponents(context, "extras");
  const historicalDelivery = extras.some(legacyDeliveryFee);
  const summary = card.purchaseSummary;
  const [entries, setEntries] = useState<readonly ClayCatalogEntry[]>([]);
  const seed = initialConcept?.label ?? (!articles.length ? text(context.fields.productLabel) : "");
  const [form, setForm] = useState<Form | null>(() => seed ? { kind: "article", id: crypto.randomUUID(),
    label: seed, quantity: "1", unit: "UNIT", price: "", concept: initialConcept } : null);
  const [openedDigest, setOpenedDigest] = useState(seed ? digest : "");
  const [showChoices, setShowChoices] = useState(false);
  const [selectionPrompt, setSelectionPrompt] = useState<{ key: string; digest: string } | null>(null);
  const promptHeading = useRef<HTMLHeadingElement>(null);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const confirm = useWorkshopConfirmation();
  const discard = () => { setForm(null); setSelectionPrompt(null); setDirty(false); setError(""); };
  const guard = useWorkshopRaw(id, dirty, discard, "purchase-basket");
  const hasCatalogArticles = articles.some(item => item.basketArticle?.concept);
  useEffect(() => {
    if (selectionPrompt) promptHeading.current?.focus();
  }, [selectionPrompt]);
  useEffect(() => {
    if (!hasCatalogArticles) return;
    let active = true;
    void loadClayV22Collection().then(collection => { if (active) setEntries(collection.entries); }).catch(() => {});
    return () => { active = false; };
  }, [hasCatalogArticles]);
  const protectedLine = (slot: string, item: PurchaseComponent) => catalogRefLocked(model, componentId(id, slot, item.selectionId));
  const canChooseArticle = (item: PurchaseComponent) => !protectedLine("item", item)
    && card.sockets.some(socket => socket.slotKey === "item" && socket.currentItems.some(current => current.selectionId === item.selectionId));
  const open = (next: Form) => {
    if (!writable || busy || !guard(() => open(next))) return;
    setOpenedDigest(digest); setForm(next); setSelectionPrompt(null); setDirty(false); setError("");
  };
  const edit = (item?: PurchaseComponent, concept?: BasketConcept) => open({
    kind: "article", id: item?.selectionId ?? crypto.randomUUID(), label: item?.label ?? concept?.label ?? "",
    quantity: item?.quantity ?? "1", unit: articleUnit(item),
    price: item?.cost.kind === "MANUAL" ? item.cost.unitAmount : "",
    concept: item?.basketArticle?.concept ?? concept, existing: item,
  });
  const details = () => open({ kind: "details", merchant: text(context.fields.merchantLabel), date: text(context.fields.plannedDate),
    coverage: (context.fields.basketCoverage as Coverage | undefined) ?? "AUTO" });
  const editDelivery = () => open({ kind: "delivery", mode: (context.fields.deliveryMode as BasketDeliveryMode | undefined) ?? "UNKNOWN",
    coverage: (context.fields.deliveryCoverage as BasketDeliveryCoverage | undefined) ?? "UNKNOWN",
    price: delivery?.cost.kind === "MANUAL" ? delivery.cost.unitAmount : "", selectionId: delivery?.selectionId ?? crypto.randomUUID() });
  const editExtra = (item?: PurchaseComponent) => open({ kind: "extra", selectionId: item?.selectionId ?? crypto.randomUUID(),
    label: item?.label ?? "", price: item?.cost.kind === "MANUAL" ? item.cost.unitAmount : "" });
  const send = (change: PurchaseBasketChange, expectedContextDigest: string) => {
    if (!writable || busy) return;
    try {
      if (decide({ kind: "EDIT_PURCHASE_BASKET", edit: { contextOccurrenceId: id, expectedContextDigest, change } })) discard();
      else setError("Ce choix n’a pas été conservé. Vérifiez l’état du panier et réessayez.");
    } catch (failure) {
      const code = failure instanceof Error ? failure.message : "";
      setError(code === "PURCHASE_BASKET_CHANGED" ? "Le panier a changé. Rouvrez ce poste pour poursuivre."
        : code === "PURCHASE_BASKET_LEGACY_DELIVERY" ? "Un poste de livraison existe déjà dans les frais historiques. Vérifiez-le sur la carte avant d’en déclarer un nouveau."
        : code === "PURCHASE_BASKET_USE_DELIVERY" ? "Utilisez « Livraison et frais » pour déclarer la livraison."
          : code === "PURCHASE_BASKET_LIMIT" ? "Ce panier a atteint sa limite de 500 articles."
        : code === "PURCHASE_BASKET_WHOLE_QUANTITY_REQUIRED" ? "Indiquez un nombre entier d’unités ou de lots."
          : "Vérifiez le nom, la quantité, le prix ou la date. La saisie est conservée.");
    }
  };
  const save = () => {
    if (form?.kind === "article") send({ kind: "SAVE_ITEM", selectionId: form.id, label: form.label, quantity: form.quantity,
      unit: form.unit, price: form.price, ...(form.concept ? { concept: form.concept } : {}) }, openedDigest);
    if (form?.kind === "details") send({ kind: "SET_DETAILS", merchant: form.merchant, date: form.date, coverage: form.coverage }, openedDigest);
    if (form?.kind === "extra") send({ kind: "SAVE_EXTRA", selectionId: form.selectionId, label: form.label, price: form.price }, openedDigest);
    if (form?.kind === "delivery") send({ kind: "SET_DELIVERY", mode: form.mode, coverage: form.coverage,
      ...(form.coverage === "ADDITIONAL" ? { selectionId: form.selectionId, price: form.price } : {}) }, openedDigest);
  };
  const remove = (item: PurchaseComponent, extra = false) => {
    const ask = () => confirm({ message: `Retirer « ${item.label} » de ce panier ?`,
      acceptLabel: extra ? "Retirer le supplément" : "Retirer l’article",
      accept: () => send({ kind: extra ? "REMOVE_EXTRA" : "REMOVE_ITEM", selectionId: item.selectionId }, digest) });
    if (guard(ask)) ask();
  };
  const update = (next: Form) => { setForm(next); setDirty(true); };
  const evaluations = card.sockets.find(socket => socket.slotKey === "item")?.evaluations;
  const visibleTotal = summary?.knownAmount;
  const suggestions = purchaseSuggestions(context, card, model);
  const ranked = suggestions.filter(suggestion => !dismissedSuggestions?.includes(suggestion.key)).slice(0, 4);
  const openSuggestion = useCommittedEvent((key: string, expected: string, selectionId?: string) => {
    if (busy || !writable || expected !== digest) return;
    const suggestion = suggestions.find(candidate => candidate.key === key);
    if (!suggestion) return;
    if (suggestion.kind === "ADD") edit();
    if (suggestion.kind === "DETAILS") details();
    if (suggestion.kind === "DELIVERY") editDelivery();
    if (suggestion.kind === "LEGACY_FEE") {
      const fee = extras.find(item => item.selectionId === suggestion.selectionIds[0] && !protectedLine("extras", item));
      if (fee) editExtra(fee);
    }
    if (suggestion.kind === "ITEM" || suggestion.kind === "CHOOSE_ITEM" && selectionId) {
      const item = articles.find(item => item.selectionId === (selectionId ?? suggestion.selectionIds[0])
        && suggestion.selectionIds.includes(item.selectionId) && canChooseArticle(item));
      if (item) edit(item);
    }
    if (suggestion.kind === "CHOOSE_ITEM" && !selectionId) {
      setForm(null); setError(""); setSelectionPrompt({ key, digest });
    }
  });
  const chooseSuggestion = (key: string, expected: string, selectionId?: string) => {
    const activate = () => openSuggestion(key, expected, selectionId);
    if (guard(activate)) activate();
  };
  const prompted = selectionPrompt?.digest === digest ? suggestions.find(suggestion => suggestion.key === selectionPrompt.key) : undefined;
  const noun = groceries ? "courses" : clothing ? "vêtements" : "cet achat";
  const showSuggestions = !form && !selectionPrompt && !showChoices && ranked.length > 0;
  const question: PaletteQuestion = showSuggestions ? {
    title: "Suggestions pour " + (groceries || clothing ? "vos " : "") + noun,
    identity: "purchase-suggestions", nature: "DECISION",
    choices: ranked.map(suggestion => ({ ...suggestion, showHint: true, choose: () => chooseSuggestion(suggestion.key, digest) })),
  } : { title: groceries ? "Préparer mes courses" : "Composer cet achat", choices: [
    { key: "details", label: "Vendeur, date et budget", iconKey: "purchase", choose: details },
    ...(!delivery || !protectedLine("shipping", delivery) ? [
      { key: "delivery", label: "Livraison et frais", iconKey: "purchase", choose: editDelivery },
    ] : []),
  ] };
  const lineCaption = (item: PurchaseComponent) => item.quantity + " · " + unitLabels[articleUnit(item)] + " · "
    + (item.cost.kind === "MANUAL" ? money(item.cost.unitAmount) : item.cost.kind === "QUOTE" ? "Devis" : "Prix à préciser");
  const canAdd = writable && articles.length < MAX_PURCHASE_ARTICLES;
  const nameCounts = new Map<string, number>();
  for (const item of articles) {
    const name = normalizeCatalog(item.label);
    nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
  }
  const panel = <aside className={`${composer.restaurantInspector} ${styles.panel}`} role="dialog" aria-modal="false"
    aria-labelledby="basket-heading" data-restaurant-editor data-purchase-basket data-basket-suggestions={showSuggestions || undefined}>
    <header><div><small>{groceries ? "Panier de courses" : clothing ? "Panier vêtements et chaussures" : "Panier d’achat"}</small>
      <h2 id="basket-heading" tabIndex={-1}>{card.label}</h2></div>
      <button type="button" aria-label="Fermer le panier" onClick={close}>Fermer</button></header>
    <WorkshopNavigation contextId={id} />
    {!form && !selectionPrompt && <IntentBudgetImpact model={model} contextId={id} />}
    <div className={styles.actions}>
      {writable && <CatalogOpenButton target={{ contextId: id, scope: groceries ? "courses" : undefined, moment: "article",
        resolveCommands: entry => {
          if (!isBasketCatalogProduct(entry, context.fields.budgetDomain)) return [];
          const concept = { id: entry.visualConceptId, label: entry.label };
          const matches = articles.filter(item => item.basketArticle?.concept?.id === concept.id);
          return [
            ...matches.flatMap((item, index) => protectedLine("item", item) ? [] : [{
              key: item.selectionId, visualConceptId: concept.id, label: `Modifier ${item.label}${matches.length > 1 ? ` · ligne ${index + 1}` : ""}`,
              editsExisting: true, run: () => edit(item),
            }]),
            ...(canAdd ? [{ key: "new", visualConceptId: concept.id, label: matches.length ? `Ajouter un autre ${entry.label}` : `Préparer ${entry.label} dans ce panier`,
              allowRepeat: true, run: () => edit(undefined, concept) }] : []),
          ];
        } }}>Ajouter depuis le catalogue</CatalogOpenButton>}
      {canAdd && <button type="button" disabled={busy} onClick={() => edit()}>Saisir un article</button>}
      {!form && !selectionPrompt && ranked.length > 0 && <button type="button" aria-pressed={showChoices}
        onClick={() => setShowChoices(value => !value)}>{showChoices ? "Revenir aux suggestions" : "Tous les choix du panier"}</button>}
    </div>
    {!form && !selectionPrompt && <SuggestionControls occurrenceId={id} choices={ranked} busy={busy}
      dismissedSuggestions={dismissedSuggestions} updateSuggestionDismissal={updateSuggestionDismissal} />}
    {selectionPrompt && <section className={styles.form} aria-label="Choisir la ligne du panier">
      <h3 ref={promptHeading} tabIndex={-1}>Quelle ligne voulez-vous modifier ?</h3>
      {prompted ? articles.flatMap((item, index) => prompted.selectionIds.includes(item.selectionId) ? [
        <button type="button" key={item.selectionId} data-basket-choice={item.selectionId}
          disabled={busy || !canChooseArticle(item)}
          onClick={() => chooseSuggestion(prompted.key, selectionPrompt.digest, item.selectionId)}>
          {item.label} · Ligne {index + 1} · {lineCaption(item)}
        </button>,
      ] : []) : <p role="status">Le panier a changé. Rouvrez la suggestion pour choisir la ligne actuelle.</p>}
      <button type="button" onClick={discard}>Retour au panier</button>
    </section>}
    {form && <form className={styles.form} onSubmit={event => { event.preventDefault(); save(); }}>
      {form.kind === "article" && <>
        <h3>{form.existing ? "Modifier l’article" : "Nouvel article"}</h3>
        <label>Nom de l’article<input autoFocus required maxLength={1024} value={form.label} onChange={event => update({ ...form, label: event.target.value })} /></label>
        <div className={styles.columns}>
          <label>Quantité<input required inputMode="decimal" value={form.quantity} onChange={event => update({ ...form, quantity: event.target.value })} /></label>
          <label>Unité<select value={form.unit} onChange={event => update({ ...form, unit: event.target.value as BasketUnit })}>
            {BASKET_UNITS.map(unit => <option key={unit} value={unit}>{unitLabels[unit]}</option>)}</select></label>
        </div>
        <label>Prix par {unitLabels[form.unit].toLocaleLowerCase("fr")} (€)<input inputMode="decimal" value={form.price}
          placeholder={form.existing?.cost.kind === "QUOTE" ? "Devis conservé" : "Prix à préciser"}
          onChange={event => update({ ...form, price: event.target.value })} /></label>
      </>}
      {form.kind === "details" && <>
        <h3>Vendeur et date{groceries ? " des courses" : ""}</h3>
        <label>Vendeur<input autoFocus maxLength={1024} value={form.merchant} onChange={event => update({ ...form, merchant: event.target.value })} /></label>
        <label>Date prévue<input type="date" value={form.date} onChange={event => update({ ...form, date: event.target.value })} /></label>
        {groceries && <label>Enveloppe Courses<select value={form.coverage} onChange={event => update({ ...form, coverage: event.target.value as Coverage })}>
          <option value="AUTO">À préciser</option><option value="CONFIRMED_CONSUMPTION">Compris dans l’enveloppe mensuelle</option>
          <option value="EXTRA_TO_SLOT">En plus de l’enveloppe mensuelle</option></select></label>}
        {groceries && <p>Ce choix indique comment traiter le panier si une enveloppe Courses est disponible. Le total brut du panier reste affiché séparément.</p>}
      </>}
      {form.kind === "extra" && <>
        <h3>Supplément distinct</h3>
        <label>Nom du supplément<input autoFocus required maxLength={1024} value={form.label}
          onChange={event => update({ ...form, label: event.target.value })} /></label>
        <label>Prix du supplément (€)<input inputMode="decimal" placeholder="Prix à préciser" value={form.price}
          onChange={event => update({ ...form, price: event.target.value })} /></label>
      </>}
      {form.kind === "delivery" && <>
        <h3>Livraison et frais</h3>
        <label>Modalité<select value={form.mode} onChange={event => update({ ...form, mode: event.target.value as BasketDeliveryMode })}>
          {DELIVERY_MODES.map(mode => <option key={mode} value={mode}>{modeLabels[mode]}</option>)}</select></label>
        <label>Frais de livraison<select value={form.coverage} onChange={event => update({ ...form, coverage: event.target.value as BasketDeliveryCoverage })}>
          {DELIVERY_COVERAGES.map(coverage => <option key={coverage} value={coverage}>{coverageLabels[coverage]}</option>)}</select></label>
        {form.coverage === "ADDITIONAL" && <label>Frais distincts (€)<input inputMode="decimal" value={form.price} placeholder="Prix à préciser"
          onChange={event => update({ ...form, price: event.target.value })} /></label>}
      </>}
      <div className={styles.actions}><button type="submit" disabled={!writable || busy}>Conserver {form.kind === "article" ? "l’article" : form.kind === "delivery" ? "la livraison" : form.kind === "extra" ? "le supplément" : "les détails"}</button>
        <button type="button" onClick={() => { if (guard(discard)) discard(); }}>Retour au panier</button></div>
    </form>}
    {error && <p role="alert">{error}</p>}
    <section aria-label="Articles du panier">
      {articles.length === 0 && <p>Panier vide. Ajoutez les articles à prévoir.</p>}
      <ul className={styles.lines}>{articles.map((item, index) => {
        const artwork = entries.find(entry => entry.visualConceptId === item.basketArticle?.concept?.id);
        const image = artwork && clayCatalogArtwork(artwork);
        const amount = summary && evaluations?.find(evaluation => evaluation.selectionId === item.selectionId)?.economicAmount;
        const duplicate = (nameCounts.get(normalizeCatalog(item.label)) ?? 0) > 1;
        const line = duplicate ? `${item.label} · ligne ${index + 1} · ${lineCaption(item)}` : item.label;
        return <li key={item.selectionId} data-basket-line={item.selectionId}>
          {image && <img src={image.src} alt="" width={44} height={44} />}
          <div><strong>{item.label}</strong><small>{duplicate && `Ligne ${index + 1} · `}{lineCaption(item)}{amount != null ? ` · Total ${money(amount)}` : ""}</small></div>
          {writable && !protectedLine("item", item) && <div className={styles.actions}>
            <button type="button" disabled={busy} onClick={() => edit(item)} aria-label={`Modifier ${line}`}>Modifier</button>
            <button type="button" disabled={busy} onClick={() => remove(item)} aria-label={`Retirer ${line}`}>Retirer</button></div>}
        </li>;
      })}</ul>
    </section>
    <footer className={styles.footer}>
      {typeof context.fields.merchantLabel === "string" && <p>Vendeur · {context.fields.merchantLabel}</p>}
      {!model.budgetReading && <p>{visibleTotal == null ? "Total à préciser" : summary?.complete ? `Total brut · ${money(visibleTotal)}` : `Montant connu · ${money(visibleTotal)} · total à préciser`}</p>}
      <p>{coverageLabels[(context.fields.deliveryCoverage as BasketDeliveryCoverage | undefined) ?? "UNKNOWN"]}{delivery?.cost.kind === "MANUAL" ? ` · ${money(delivery.cost.unitAmount)}` : ""}</p>
      {extras.length > 0 && <ul className={styles.lines} aria-label="Suppléments distincts">{extras.map(item => <li key={item.selectionId}>
        <div><strong>{item.label}</strong><small>{item.cost.kind === "MANUAL" ? `${item.quantity} × ${money(item.cost.unitAmount)}` : "Prix à préciser"}</small></div>
        {writable && !protectedLine("extras", item) && <div className={styles.actions}>
          <button type="button" disabled={busy} onClick={() => editExtra(item)} aria-label={`Modifier le supplément ${item.label}`}>Modifier</button>
          <button type="button" disabled={busy} onClick={() => remove(item, true)} aria-label={`Retirer le supplément ${item.label}`}>Retirer</button>
        </div>}
      </li>)}</ul>}
      {historicalDelivery && <p>Ce panier possède déjà un poste de livraison historique.</p>}
      <div className={styles.actions}>
        {writable && <button type="button" disabled={busy} onClick={details}>Vendeur, date et budget</button>}
        {writable && <button type="button" disabled={busy || !!delivery && protectedLine("shipping", delivery)} onClick={editDelivery}>Livraison et frais</button>}
        {writable && <button type="button" disabled={busy} onClick={() => editExtra()}>Ajouter un supplément</button>}
        <button type="button" onClick={close}>Retour au Board</button>
      </div>
    </footer>
  </aside>;
  return <>{typeof document !== "undefined" && createPortal(panel, document.body)}
    {writable && <ContextPalette card={card} model={model} busy={busy} configure choose={() => {}} close={close} question={question} />}</>;
}
