"use client";
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { plannedAsset, rootAssetModule, type AssetModule } from "@/domain/phase2/planned-assets";
import { acceptBuilderChild, availableBuilderChildren, changeBuilderContext, changeBuilderRoot, commitBuilderCost, deriveBuilderReadiness, discardSuspended,
  editBuilderDraft, fundBuilderTotal, itemizeBuilderCosts, materializeBuilderDraft, setBuilderChildPlace, setQuickTotal, splitRestaurantQuickTotal,
  suggestedBuilderChildren, undoBuilderChange, addBuilderChildRouteStop, type BuilderState } from "@/domain/phase2/planned-builder";
import { applyProjectAnswer, answerWizard, compatibleProjectLinks, nextUsefulQuestion, projectNights, changeProjectSubtype, wizardKnowledge, jumpWizard, visibleProjectQuestions, projectRepairQuestion,
  type QuestionContext, type QuestionId, type WizardAnswer, type WizardEnvironment, type WizardSession } from "@/domain/phase2/planned-question-engine";
import { BUILDER_INTENTS, compatibleWallets, draftSummary, intentForDraft, projectPlaceLabel, visibleUxAssets } from "@/domain/phase2/planned-ux";
import { builderAssetChoices, isRootCost, prospectivePersonLabel } from "@/domain/phase2/planned-product";
import { DELIVERY_PROVIDERS, SOCIAL_CONTACTS_V1, plannedContextModifiers, resolvePlannedContext } from "@/domain/phase2/planned-rules";
import { placesForChildModule } from "@/domain/phase2/planned-places";
import { restaurantPriceRange } from "@/domain/phase2/planned-restaurant";
import { useRestaurantEstimate } from "@/domain/phase2/planned-restaurant-builder";
import type { PlannedPriceSuggestion, PlannedWalletOption } from "@/domain/phase2/planned-contract";
import { IntentTile } from "./planned-builder-primitives";
import { InlineExpandableAssetGrid } from "./inline-expandable-asset-grid";
import { DateTimeDecision, ParticipantSelector, ProjectEntitySearch } from "./project-wizard-fields";
import { plannedExpenseTemporalSummary } from "@/domain/phase2/planned-dates";
import { ProjectTransportEditor } from "./project-transport-editor";
import { WizardBackdrop } from "./planned-wizard-visuals";
import styles from "./project-wizard.module.css";
import oldStyles from "./planned-wizard.module.css";

const money = (v: string) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(v));
export function ProjectIntentHub({ onChoose }: { onChoose: (key: string) => void }) {
  return <div className={styles.shell}><h4 className={styles.question}>Qu’avez-vous prévu ?</h4><div className={oldStyles.choices}>{BUILDER_INTENTS.map(i => <IntentTile key={i.key} intent={i} onClick={() => onChoose(i.key)} />)}</div></div>;
}
type Choice = { key: string; label: string; hint?: string };
function PagedChoices({ choices, onChoose }: { choices: readonly Choice[]; onChoose: (v: string) => void }) {
  const [page, setPage] = useState(0);
  return <div><div className={styles.choiceGrid}>{choices.slice(page * 9, page * 9 + 9).map(c => <button className={styles.choice} type="button" key={c.key} onClick={() => onChoose(c.key)}>{c.label}{c.hint && <small>{c.hint}</small>}</button>)}</div>{choices.length > 9 && <div className={styles.pagination}><button aria-label="Choix précédents" disabled={!page} onClick={() => setPage(page - 1)}>←</button><button aria-label="Autres choix" disabled={(page + 1) * 9 >= choices.length} onClick={() => setPage(page + 1)}>→</button></div>}</div>;
}
type Props = { builder: BuilderState; setBuilder: Dispatch<SetStateAction<BuilderState>>; session: WizardSession; setSession: Dispatch<SetStateAction<WizardSession>>;
  env: WizardEnvironment; wallets: readonly PlannedWalletOption[]; prices: readonly PlannedPriceSuggestion[]; targetMonth: string; busy: boolean;
  onPreview: () => void; repairRequest?: { target: string; serial: number } };

function QuickBudget({ builder, setBuilder, wallets, onContinue }: Pick<Props, "builder" | "setBuilder" | "wallets"> & { onContinue: () => void }) {
  const [amount, setAmount] = useState(builder.quickTotal), [meal, setMeal] = useState(""), [split, setSplit] = useState(false);
  const [wallet, setWallet] = useState<"SWILE" | "EDENRED" | "">(""), [partial, setPartial] = useState(false), [walletAmount, setWalletAmount] = useState("");
  const [error, setError] = useState("");
  const root = rootAssetModule(builder.draft.familyKey, builder.draft.subtypeKey), mealRoot = ["restaurant", "fast_food", "work_meal", "groceries"].includes(root);
  const commit = () => {
    try { let next = setQuickTotal(builder, amount);
      if (wallet) next = fundBuilderTotal(next, wallet, partial ? walletAmount : meal || amount, meal || undefined);
      else if (split && root === "restaurant") next = splitRestaurantQuickTotal(next, meal);
      if (root === "restaurant") next = editBuilderDraft(next, { ...next.draft, context: { ...next.draft.context, restaurant: { ...next.draft.context.restaurant, priceBasis: split ? "DETAILED" : "KNOWN" } } });
      setBuilder(next); onContinue();
    } catch { setError("Vérifiez le total et la part éligible au titre-resto."); }
  };
  return <div className={styles.assetModule}><div className={styles.editorFields}><label>Budget total (€)<input autoFocus className={styles.input} type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} /></label>
      {(split || wallet && ["restaurant", "groceries"].includes(root)) && <label>{root === "restaurant" ? "Repas et boissons sans alcool (€)" : "Part alimentaire éligible (€)"}<input className={styles.input} type="number" min="0.01" step="0.01" value={meal} onChange={e => setMeal(e.target.value)} /></label>}</div>
    {root === "restaurant" && <button className={styles.textButton} onClick={() => setSplit(!split)}>{split ? "Garder le total" : "Distinguer la part d’alcool"}</button>}
    {mealRoot && wallets.length > 0 && <div className={styles.fundingRow}><span className={styles.small}>Paiement en banque par défaut</span>{wallets.map(w => <button type="button" className={styles.walletCard} key={w.source} aria-pressed={wallet === w.source} onClick={() => setWallet(wallet === w.source ? "" : w.source)}>▰ {w.source === "SWILE" ? "Swile" : "Edenred"}</button>)}
      {wallet && <><button className={styles.pill} aria-pressed={!partial} onClick={() => setPartial(false)}>Entier</button><button className={styles.pill} aria-pressed={partial} onClick={() => setPartial(true)}>Partiel</button>{partial && <input className={styles.shortInput} aria-label="Montant titre-resto" type="number" step="0.01" min="0.01" value={walletAmount} onChange={e => setWalletAmount(e.target.value)} />}</>}</div>}
    <p className={styles.small}>Le total est remplacé par ses parts lorsque vous les distinguez.</p>{error && <p className={styles.error} role="alert">{error}</p>}<button className={styles.primary} disabled={!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/u.test(amount) || Number(amount) <= 0 || (split || !!wallet && ["restaurant", "groceries"].includes(root)) && !meal} onClick={commit}>Continuer</button></div>;
}

function Addons({ builder, setBuilder, context, wallets, prices, onContinue, initialChild }: Pick<Props, "builder" | "setBuilder" | "wallets" | "prices"> & { context: QuestionContext; onContinue: () => void; initialChild?: AssetModule | null }) {
  const [child, setChild] = useState<AssetModule | null>(initialChild ?? null), [other, setOther] = useState(false), [view, setView] = useState<"CATALOG" | "PLACE" | "GIFT">(initialChild === "gift" && !builder.draft.context.gift?.recipient ? "GIFT" : "CATALOG");
  const [recipient, setRecipient] = useState(builder.draft.context.gift?.recipient ?? ""), [occasion, setOccasion] = useState(builder.draft.context.gift?.occasion ?? "");
  const [textPlace, setTextPlace] = useState("");
  const root = rootAssetModule(builder.draft.familyKey, builder.draft.subtypeKey), c = builder.draft.context;
  const resolved = resolvePlannedContext({ familyKey: builder.draft.familyKey, subtypeKey: builder.draft.subtypeKey, modifiers: plannedContextModifiers(c) });
  const suggestions = suggestedBuilderChildren(builder), available = availableBuilderChildren(builder);
  const labels: Record<string, string> = { restaurant: "Restaurant", activity: "Activité", gift: "Cadeau", bar: "Bar", club: "Club", house_party: "Avant-soirée", groceries: "Courses", household: "Entretien", beauty: "Beauté", home: "Maison", tech: "Tech", clothing: "Vêtements" };
  const choose = (key: string) => {
    const module = key as AssetModule;
    if (!builder.acceptedChildren.includes(module)) setBuilder(s => acceptBuilderChild(s, module));
    setChild(module); setView(module === "gift" && !c.gift?.recipient ? "GIFT" : "CATALOG");
  };
  const edge = resolved.children.find(e => e.childModule === child);
  if (child && view === "PLACE") return <div className={styles.entityModule}><PagedChoices choices={placesForChildModule(context.env.places, child).map(p => ({ key: p.placeId, label: p.name, hint: p.commune ?? undefined }))} onChoose={placeId => { setBuilder(s => setBuilderChildPlace(s, child, { kind: "KNOWN", placeId })); setView("CATALOG"); }} />
    <div className={styles.editorFields}><label>Autre lieu<input className={styles.input} value={textPlace} onChange={e => setTextPlace(e.target.value)} /></label><button className={styles.textButton} disabled={!textPlace.trim()} onClick={() => { setBuilder(s => setBuilderChildPlace(s, child, { kind: "TEXT", label: textPlace, provenance: "USER_DECLARED_PROSPECTIVE" })); setView("CATALOG"); }}>Utiliser</button><button className={styles.textButton} onClick={() => setView("CATALOG")}>Pas encore</button></div></div>;
  if (child && view === "GIFT") return <div className={styles.manual}><label>Pour qui ?<input className={styles.input} value={recipient} onChange={e => setRecipient(e.target.value)} /></label><label>Occasion<input className={styles.input} value={occasion} onChange={e => setOccasion(e.target.value)} /></label><button className={styles.primary} disabled={!recipient.trim() || !occasion.trim()} onClick={() => { setBuilder(s => changeBuilderContext(s, { ...s.draft.context, gift: { recipient, occasion } })); setView("CATALOG"); }}>Continuer</button></div>;
  if (child) return <div className={styles.assetModule}><div className={styles.entityActions}><strong>{labels[child] ?? child}</strong><span className={styles.small}>Date et personnes du projet principal</span>{edge?.localPlacePolicy !== "HIDDEN" && <button className={styles.textButton} disabled={!builder.draft.costItems.some(i => i.modulePath?.[1] === child)} onClick={() => setView("PLACE")}>{c.childLocalPlaceRefs?.[child] ? "Modifier le lieu" : "Préciser le lieu"}</button>}
    {edge?.rootTransportStopAvailability !== "NEVER" && c.childLocalPlaceRefs?.[child] && c.route && !c.route.stops.some(s => s.childModule === child) && <button className={styles.textButton} onClick={() => setBuilder(s => addBuilderChildRouteStop(s, child, c.childLocalPlaceRefs?.[child]?.kind === "TEXT" ? c.childLocalPlaceRefs[child]!.label : context.env.places.find(p => p.placeId === (c.childLocalPlaceRefs?.[child] as { placeId: string })?.placeId)?.name ?? "Arrêt"))}>Ajouter à notre trajet</button>}</div>
    <InlineExpandableAssetGrid builder={builder} setBuilder={setBuilder} path={[root, child]} assets={visibleUxAssets(builderAssetChoices(resolved, child, c), c)} wallets={edge?.fundingOverride === "BANK_ONLY" ? [] : wallets} prices={prices} />
    <button className={styles.primary} onClick={onContinue}>Revenir à votre projet</button></div>;
  const choices = [...builder.acceptedChildren, ...suggestions, ...(other ? available : [])];
  return <div className={styles.entityModule}><PagedChoices choices={[...new Set(choices)].map(key => ({ key, label: labels[key] ?? key, hint: suggestions.includes(key) ? "Suggestion · à ajouter si utile" : builder.acceptedChildren.includes(key) ? "Modifier" : undefined }))} onChoose={choose} />
    {!other && available.length > 0 && <button className={styles.textButton} onClick={() => setOther(true)}>Ajouter autre chose</button>}
    {c.purchaseMode === "DELIVERY" || c.purchaseMode === "ONLINE" ? <p className={styles.small}>Les frais éventuels se renseignent dans le détail du budget. Aucun montant n’est ajouté automatiquement.</p> : null}
    <button className={styles.primary} onClick={onContinue}>Voir le résumé</button></div>;
}

export function ContextualProjectWizard({ builder, setBuilder, session, setSession, env, wallets, prices, targetMonth, busy, onPreview, repairRequest }: Props) {
  const draft = builder.draft, c = draft.context, intent = intentForDraft(draft), root = rootAssetModule(draft.familyKey, draft.subtypeKey);
  const context: QuestionContext = { draft, session, env, intent }, question = nextUsefulQuestion(context);
  const title = typeof question.title === "function" ? question.title(context) : question.title;
  const heading = useRef<HTMLHeadingElement>(null);
  const sessionBeforeChange = useRef<WizardSession | null>(null);
  const [otherOccasion, setOtherOccasion] = useState(false), [occasionLabel, setOccasionLabel] = useState(c.occasionLabel ?? "");
  const [manualContact, setManualContact] = useState(false), [contactName, setContactName] = useState("");
  const [recipient, setRecipient] = useState(c.gift?.recipient ?? ""), [giftOccasion, setGiftOccasion] = useState(c.gift?.occasion ?? "");
  const [addonChild, setAddonChild] = useState<AssetModule | null>(null), [moreAddons, setMoreAddons] = useState(false), [moreFacts, setMoreFacts] = useState(false);
  const resolved = resolvePlannedContext({ familyKey: draft.familyKey, subtypeKey: draft.subtypeKey, modifiers: plannedContextModifiers(c, env.persons.find(p => p.personId === c.participantPersonIds?.[0])?.displayName) });
  const eligible = compatibleWallets(wallets, c, intent === "work_meal"), readiness = deriveBuilderReadiness(builder, { places: env.places, workMealPersonName: env.persons.find(p => p.personId === c.participantPersonIds?.[0])?.displayName });
  const summary = draftSummary(materializeBuilderDraft(builder).costItems), basket = prices.find(p => p.assetKey === "groceries:food");
  const choose = (answer: WizardAnswer) => {
    sessionBeforeChange.current = session;
    setBuilder(state => {
      let next = applyProjectAnswer(state, question.id, answer, env);
      return next;
    });
    setSession(s => answerWizard(s, question.id, answer));
  };
  const done = () => setSession(s => answerWizard(s, question.id, "DONE"));
  const jump = (id: QuestionId) => setSession(s => jumpWizard(s, id));
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [question.id]);
  useEffect(() => { if (!repairRequest?.target) return; const target = repairRequest.target;
    jump(projectRepairQuestion(context, target));
  }, [repairRequest?.serial]);
  let content;
  const choices = (values: readonly Choice[], action: (key: string) => void = choose) => <PagedChoices key={question.id} choices={values} onChoose={action} />;
  if (question.id === "partyKind") content = choices([{ key: "bar", label: "Bar / apéro" }, { key: "club_festival", label: "Club / boîte" }, { key: "house_party", label: "Soirée privée" }, { key: "EVENT", label: "Festival / événement" }]);
  if (question.id === "groceriesNature") content = choices([{ key: "USUAL", label: "Courses habituelles" }, { key: "TOP_UP", label: "Petites courses / complément" }, { key: "OCCASION", label: "Repas ou occasion" }]);
  if (question.id === "groceryFocus") content = choices([{ key: "FOOD", label: "Alimentation" }, { key: "HYGIENE", label: "Hygiène" }, { key: "CLEANING", label: "Entretien" }, { key: "DRINKS", label: "Boissons" }, { key: "OTHER", label: "Autre" }]);
  if (question.id === "automotiveKind") content = choices([{ key: "PRODUCT", label: "Pièce ou accessoire" }, { key: "SERVICE", label: "Entretien ou service" }]);
  if (question.id === "tripKind") content = choices([{ key: "STAY", label: "Un séjour" }, { key: "PUNCTUAL", label: "Un déplacement ponctuel" }]);
  if (question.id === "participants" || question.id === "workPerson") content = choices([...env.persons.map(p => ({ key: p.personId, label: p.displayName })), ...(question.id === "workPerson" ? [] : [{ key: "BOTH", label: "Nous deux" }, { key: "GROUP", label: "Avec d’autres personnes", hint: "Budget du foyer par défaut" }])]);
  if (question.id === "socialParticipants") content = <ParticipantSelector key={question.id} context={context} onChoose={choose} />;
  if (question.id === "channel") content = choices(intent === "fast_food" ? [{ key: "STORE", label: "Sur place" }, { key: "PICKUP", label: "À emporter" }, { key: "DELIVERY", label: "Livraison" }]
    : [{ key: "STORE", label: "En magasin" }, { key: "PICKUP", label: intent === "groceries" ? "Drive / retrait" : "Retrait" }, { key: "DELIVERY", label: intent === "groceries" ? "Livraison" : "En ligne, livré" }, ...(intent === "purchase" ? [{ key: "SECOND_HAND", label: "Seconde main" }, { key: "UNDECIDED", label: "Pas encore décidé" }] : [])]);
  if (question.id === "workMode") content = choices([{ key: "BOUGHT", label: "Acheté près du travail" }, { key: "DELIVERED", label: "Livré au travail" }, { key: "FROM_HOME", label: "Apporté de chez nous", hint: "Sans achat spécifique par défaut" }]);
  if (question.id === "contact" || question.id === "host") content = manualContact ? <div className={styles.manual}><label>Son nom<input autoFocus className={styles.input} value={contactName} onChange={e => setContactName(e.target.value)} /></label><button className={styles.primary} disabled={!contactName.trim()} onClick={() => { choose({ kind: "TEXT", label: contactName }); setManualContact(false); }}>Continuer</button></div>
    : choices([...(question.id === "host" ? [{ key: "OWN_HOME", label: "Chez nous" }] : []), ...SOCIAL_CONTACTS_V1.map(p => ({ key: p.key, label: p.label, hint: p.relationLabel })), { key: "TEXT", label: "Quelqu’un d’autre" }], key => key === "TEXT" ? setManualContact(true) : choose(key));
  if (question.id === "format") content = choices([{ key: "SIMPLE", label: intent === "groceries" ? "Pour nous deux" : "Une visite simple" }, { key: "APERO_PARTY", label: "Un apéro" }, { key: "MEAL", label: "Un repas" }, { key: "STAY", label: intent === "groceries" ? "Pour plusieurs personnes" : "Rester dormir" }]);
  if (question.id === "occasion") content = otherOccasion ? <div className={styles.manual}><label>Quelle occasion ?<input autoFocus className={styles.input} value={occasionLabel} maxLength={100} onChange={e => setOccasionLabel(e.target.value)} /></label><button className={styles.primary} disabled={!occasionLabel.trim()} onClick={() => { choose({ label: occasionLabel }); setOtherOccasion(false); }}>Continuer</button></div> : choices([{ key: "NONE", label: "Aucune occasion particulière" }, { key: "BIRTHDAY", label: "Anniversaire" }, { key: "VALENTINE", label: "Saint-Valentin" }, { key: "REUNION", label: "Retrouvailles" }, { key: "CELEBRATION", label: "Célébration" }, { key: "OTHER_SPECIAL", label: "Autre" }], key => key === "OTHER_SPECIAL" ? setOtherOccasion(true) : choose(key));
  if (question.id === "entity") content = <ProjectEntitySearch key={question.id} context={context} onChoose={choose} onCategory={subtype => setBuilder(s => changeProjectSubtype(s, subtype))} />;
  if (question.id === "seller") content = <ProjectEntitySearch key={question.id} seller context={context} onChoose={choose} />;
  if (question.id === "date") content = <DateTimeDecision key={question.id} context={context} month={targetMonth} onChoose={choose} />;
  if (question.id === "provider") content = choices(DELIVERY_PROVIDERS.map(p => ({ key: p.key, label: p.label })), key => { const p = DELIVERY_PROVIDERS.find(p => p.key === key)!; choose({ key, label: p.label }); });
  if (question.id === "giftRecipient") content = <div className={styles.manual}><label>Pour qui ?<input className={styles.input} value={recipient} onChange={e => setRecipient(e.target.value)} /></label><label>Occasion<input className={styles.input} value={giftOccasion} onChange={e => setGiftOccasion(e.target.value)} /></label><button className={styles.primary} disabled={!recipient.trim() || !giftOccasion.trim()} onClick={() => choose({ recipient, occasion: giftOccasion })}>Continuer</button></div>;
  if (question.id === "link") content = choices([{ key: "NONE", label: "Un projet indépendant" }, ...compatibleProjectLinks(context).map(p => ({ key: p.id, label: p.draft.title, hint: "Hériter de la date et du contexte" }))]);
  if (question.id === "transport") content = choices([{ key: "CAR", label: "Voiture", hint: wizardKnowledge(context).transport.state === "LIKELY" ? "Souvent observée pour ce lieu · à confirmer" : undefined }, ...intent === "trip" ? [{ key: "TRAIN", label: "Train" }, { key: "PLANE", label: "Avion" }] : [], { key: "BUS", label: "Bus / transport payant" }, { key: "TAXI", label: "Taxi / Uber" }, { key: "FREE", label: "À pied, vélo ou tram gratuit" }, { key: "LATER", label: "Pas encore décidé" }]);
  if (question.id === "transportDetails") content = <ProjectTransportEditor builder={builder} setBuilder={setBuilder} places={env.places} targetMonth={targetMonth} onContinue={done} />;
  if (question.id === "lodging") content = choices([{ key: "RELATIVE", label: "Chez un proche", hint: "Sans coût d’hébergement par défaut" }, { key: "HOTEL", label: "Hôtel" }, { key: "HOSTEL", label: "Auberge" }, { key: "RENTAL", label: "Appartement / location" }, { key: "OTHER", label: "Autre" }, { key: "LATER", label: "Pas encore" }]);
  if (question.id === "lodgingCost") content = <div className={styles.assetModule}><p className={styles.small}>{projectNights(draft)} nuit(s) · ajustez le nombre de chambres ou de nuitées si utile.</p><InlineExpandableAssetGrid builder={builder} setBuilder={setBuilder} assets={c.project?.lodging === "HOTEL" ? [plannedAsset("trip:hotel")!] : c.project?.lodging === "RENTAL" ? [plannedAsset("trip:airbnb")!] : []} path={[root]} wallets={[]} customLabel="Hébergement" quantityDefaults={{ "trip:hotel": String(Math.max(1, projectNights(draft))), "trip:airbnb": String(Math.max(1, projectNights(draft))), CUSTOM: String(Math.max(1, projectNights(draft))) }} /><button className={styles.primary} onClick={done}>Continuer</button><button className={styles.textButton} onClick={done}>Budget à préciser</button></div>;
  if (question.id === "costMode") content = choices([{ key: "TOTAL", label: "Je connais le total" }, { key: "DETAIL", label: intent === "restaurant" ? "Détailler la note" : "Détailler les éléments" }, ...(intent === "restaurant" || intent === "groceries" && !!basket ? [{ key: "ESTIMATE", label: "Partir d’une estimation", hint: basket && intent === "groceries" ? basket.sourceLabel : "Hypothèse de prix explicite" }] : []), ...(["activity", "visit", "trip"].includes(intent) ? [{ key: "FREE", label: "Sans dépense principale" }] : []), { key: "LATER", label: "Budget à préciser" }]);
  if (question.id === "costTotal") content = <QuickBudget key={question.id} builder={builder} setBuilder={setBuilder} wallets={eligible} onContinue={done} />;
  if (question.id === "costDetails") {
    const assets = visibleUxAssets(builderAssetChoices(resolved, root, c, intent === "visit" ? "BRING_ITEMS" : "MODULE"), c);
    const selected = draft.costItems.filter(isRootCost).flatMap(i => i.assetKey && !assets.some(a => a.assetKey === i.assetKey) && plannedAsset(i.assetKey) ? [plannedAsset(i.assetKey)!] : []);
    content = <InlineExpandableAssetGrid builder={builder} setBuilder={setBuilder} assets={[...assets, ...selected]} path={[root]} wallets={eligible} prices={prices} />;
  }
  if (question.id === "costEstimate") {
    const range = restaurantPriceRange(c), value = intent === "restaurant" ? range.central : basket!.unitAmount;
    content = <div className={styles.summaryCard}><p className={styles.summaryTotal}>≈ {money(value)}</p><p className={styles.small}>{intent === "restaurant" ? `15–40 € par personne · ${range.participants} personne(s) financée(s)` : basket!.sourceLabel}</p><div className={styles.editorActions}><button className={styles.primary} onClick={() => {
      setBuilder(state => intent === "restaurant" ? useRestaurantEstimate(state, () => crypto.randomUUID()) : commitBuilderCost(state, { id: crypto.randomUUID(), assetKey: "groceries:food", label: "Courses alimentaires · estimation", quantity: "1", unitAmount: basket!.unitAmount, baselineKey: "groceries", modulePath: [root], priceSource: "LAST_KNOWN", priceSourceLabel: basket!.sourceLabel })); done();
    }}>Garder cette estimation</button><button className={styles.textButton} onClick={() => jump("costTotal")}>Modifier le montant</button></div></div>;
  }
  if (question.id === "addons") content = <Addons key={addonChild ?? "catalog"} initialChild={addonChild} builder={builder} setBuilder={setBuilder} context={context} wallets={eligible} prices={prices} onContinue={() => { setAddonChild(null); setSession(s => jumpWizard(s, "review")); }} />;
  if (question.id === "review") {
    const participantNames = [...new Set([...env.persons.filter(p => c.participantPersonIds?.includes(p.personId)).map(p => p.displayName),
      ...(c.participantRefs ?? []).map(ref => ref.kind === "HOUSEHOLD_PERSON" ? env.persons.find(p => p.personId === ref.personId)?.displayName : prospectivePersonLabel(ref)).filter((v): v is string => !!v)])];
    if (c.additionalGuestCount) participantNames.push(`${c.additionalGuestCount} autres personnes`);
    const entityLabels = { restaurant: "Restaurant", fast_food: "Restaurant / snack", work_meal: "Lieu", groceries: "Enseigne", party: "Lieu", visit: "Chez", trip: "Destination", activity: "Lieu", purchase: "Magasin / site" };
    const rows: { label: string; value: string; target: QuestionId }[] = [
      { label: "Quand", value: plannedExpenseTemporalSummary(draft).join(" · "), target: "date" },
      { label: "Personnes", value: participantNames.join(" · ") || "Foyer", target: intent === "work_meal" ? "workPerson" : c.companionMode === "GROUP" ? "socialParticipants" : "participants" },
      ...(intent === "work_meal" ? [{ label: "Repas", value: ({ FROM_HOME: "Apporté de chez nous", BOUGHT: "Acheté près du travail", DELIVERED: "Livré au travail" } as Record<string, string>)[c.workMealMode ?? ""] ?? "À préciser", target: "workMode" as const }] : []),
      ...(c.project?.channel ? [{ label: "Achat", value: ({ STORE: "En magasin / sur place", DELIVERY: "Livraison", PICKUP: "Retrait / à emporter", SECOND_HAND: "Seconde main", UNDECIDED: "Pas encore décidé" } as Record<string, string>)[c.project.channel], target: "channel" as const }] : []),
      ...(intent === "purchase" ? [{ label: "Achat prévu", value: c.project?.entity?.label ?? "À préciser", target: "entity" as const }] : []),
      ...(c.workMealMode !== "FROM_HOME" ? [{ label: entityLabels[intent], value: intent === "purchase" ? c.seller ?? "À préciser" : [c.project?.entity?.label || prospectivePersonLabel(c.host ?? c.personVisited) || projectPlaceLabel(c, env.places) || "Pas encore précisé", c.project?.entity?.city].filter(Boolean).join(" · "), target: intent === "visit" ? "contact" as const : c.housePartyPlaceMode ? "host" as const : intent === "purchase" ? "seller" as const : "entity" as const }] : []),
      ...(c.socialOccasion && c.socialOccasion !== "NONE" ? [{ label: "Occasion", value: c.occasionLabel ?? ({ BIRTHDAY: "Anniversaire", CHRISTMAS: "Noël", CELEBRATION: "Célébration", OTHER_SPECIAL: "Occasion particulière" } as Record<string, string>)[c.socialOccasion], target: "occasion" as const }] : []),
      ...(resolved.transport !== "FORBIDDEN" || c.project?.shareTransport ? [{ label: "Transport", value: c.project?.shareTransport ? "Trajet partagé avec le projet lié" : ({ CAR: "Voiture", FREE: "Trajet gratuit", TRAIN: "Train", BUS: "Bus", TAXI: "Taxi", PLANE: "Avion" } as Record<string, string>)[c.transportMode ?? ""] || "À préciser", target: "transport" as const }] : []),
    ];
    const suggestions = suggestedBuilderChildren(builder), available = availableBuilderChildren(builder);
    const addonChoices = [...new Set([...builder.acceptedChildren, ...suggestions, ...(moreAddons ? available : [])])];
    const childLabels: Record<string, string> = { restaurant: "Restaurant", activity: "Activité", gift: "Cadeau", bar: "Bar", club: "Club", house_party: "Avant-soirée", groceries: "Courses", household: "Entretien", beauty: "Beauté", home: "Maison", tech: "Tech", clothing: "Vêtements" };
    const canTransport = resolved.transport !== "FORBIDDEN" && !c.transportMode;
    const canBring = intent === "visit", canLodge = projectNights(draft) > 0 && !c.project?.lodging;
    const openChild = (child: AssetModule) => { if (!builder.acceptedChildren.includes(child)) setBuilder(s => acceptBuilderChild(s, child)); setAddonChild(child); jump("addons"); };
    content = <div><div className={styles.summaryGrid}><div className={styles.summaryCard}><div className={styles.summaryFacts}>{rows.slice(moreFacts ? 6 : 0, moreFacts ? rows.length : 6).map(row => <div className={styles.summaryRow} key={row.label}><span>{row.label}<strong>{row.value}</strong></span>{visibleProjectQuestions(context).some(q => q.id === row.target) && <button onClick={() => jump(row.target)}>Modifier</button>}</div>)}</div>{rows.length > 6 && <button className={styles.textButton} onClick={() => setMoreFacts(!moreFacts)}>{moreFacts ? "Revenir aux informations principales" : `Voir plus (${rows.length - 6})`}</button>}</div><div className={styles.summaryCard}><p className={styles.small}>Coût économique connu</p><p className={styles.summaryTotal}>{c.project?.unpricedComponents?.length && Number(summary.gross) === 0 ? "Non chiffré" : money(summary.gross)}</p><p className={styles.small}>Banque {money(summary.bank)}{Number(summary.swile) > 0 && ` · Swile ${money(summary.swile)}`}{Number(summary.edenred) > 0 && ` · Edenred ${money(summary.edenred)}`}</p>{c.project?.unpricedComponents?.length ? <p className={styles.small}>À préciser : {c.project.unpricedComponents.join(", ")}</p> : null}<button className={styles.textButton} onClick={() => jump("costMode")}>Modifier le budget</button>
      {c.project?.linkedProjectId && <button className={styles.textButton} onClick={() => { setBuilder(s => applyProjectAnswer(s, "link", "NONE", env)); jump("link"); }}>Détacher du projet lié</button>}</div></div>
      {(addonChoices.length > 0 || available.length > 0 || canTransport || canBring || canLodge) && <section className={styles.summaryAddons} aria-label="Ajouter au projet"><h5>Ajouter au projet</h5><div className={styles.addonButtons}>
        {canTransport && <button className={styles.pill} onClick={() => jump("transport")}>+ Ajouter un trajet</button>}
        {canBring && <button className={styles.pill} onClick={() => { setBuilder(s => applyProjectAnswer(s, "costMode", "DETAIL", env)); setSession(s => jumpWizard(answerWizard(s, "costMode", "DETAIL"), "costDetails")); }}>+ Apporter quelque chose</button>}
        {canLodge && <button className={styles.pill} onClick={() => jump("lodging")}>+ Hébergement</button>}
        {addonChoices.map(child => <button className={styles.pill} key={child} onClick={() => openChild(child)}>{builder.acceptedChildren.includes(child) ? "Modifier" : "+"} {childLabels[child] ?? "Complément"}</button>)}
        {available.length > 0 && <button className={styles.textButton} onClick={() => setMoreAddons(!moreAddons)}>{moreAddons ? "Voir moins" : "Ajouter autre chose"}</button>}
      </div></section>}
      {builder.suspended.length > 0 && <div className={styles.blocker}><span>Des éléments incompatibles sont conservés hors du calcul.</span><button className={styles.textButton} onClick={() => { setBuilder(undoBuilderChange); if (sessionBeforeChange.current) setSession(jumpWizard(sessionBeforeChange.current, "review")); }}>Annuler le changement</button><button className={styles.textButton} onClick={() => setBuilder(discardSuspended)}>Confirmer leur retrait</button></div>}
      {readiness.issues.filter(i => i.severity === "BLOCK_PREVIEW").slice(0, 2).map(i => <div className={styles.blocker} key={i.code}><span>{i.message}</span><button className={styles.textButton} onClick={() => jump(projectRepairQuestion(context, i.scope))}>Corriger</button></div>)}</div>;
  }
  return <div className={`${styles.shell} ${question.id === "review" ? styles.reviewShell : ""}`} data-project-question={question.id}><WizardBackdrop scene={intent} className={oldStyles.ambient} /><h4 tabIndex={-1} ref={heading} className={styles.question}>{title}</h4><div className={styles.content}>{content}</div>
    <div className={styles.footer}><span>{draft.title}{c.place && intent === "visit" ? ` · ${projectPlaceLabel(c, env.places)}` : ""}</span>
      {question.id === "costDetails" && <button className={styles.primary} disabled={!draft.costItems.length} onClick={done}>Continuer</button>}
      {question.id === "review" && <button className={styles.primary} disabled={busy || !readiness.previewReady} onClick={onPreview}>{busy ? "Calcul en cours…" : "Voir l’effet sur notre mois"}</button>}
    </div></div>;
}
