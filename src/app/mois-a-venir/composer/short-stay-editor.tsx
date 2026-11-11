"use client";
import { useRef, useState, type ComponentProps } from "react";
import { useWorkshopRaw } from "./inline-edit-registry";
import type { ComponentSelectionV1 } from "@/domain/phase2/planner/component-contract";
import type { PlannedContextState, PlanSemanticStateV1 } from "@/domain/phase2/planner/semantic-state";
import type { ShortStayEdit } from "@/domain/phase2/planner/short-stay-edit";
import { canonicalPlannerJson } from "@/domain/phase2/planner/json";
import { componentId } from "@/domain/phase2/planner/identity";
import { publishedDrop } from "./interactions";
import { money } from "./display";
import { ProspectiveContextEditor } from "./family-visit-editor";
import { fresh, fromSelection, buildComponentRow, type Row } from "./night-out-components";
import { WorkshopComponentRow } from "./workshop-component-row";
import { CatalogOpenButton } from "./catalog-discovery-provider";
import { useWorkshopConfirmation } from "./workshop-confirmation";
import type { DropTarget } from "@/domain/phase2/planner/composer-contract";
import type { CatalogCommand } from "./catalog-discovery";
import styles from "./composer.module.css";

type Component = Extract<ComponentSelectionV1, { kind: "COMPONENT" }>;
type Post = { row: Row; templateKey: string; child?: PlannedContextState; link?: Extract<ComponentSelectionV1, { kind: "CHILD_CONTEXT" }> };
type Group = "restaurants" | "activities" | "purchases" | "extras";
const groups: readonly [Group, string, string][] = [["restaurants", "Repas et restaurants", "restaurant"], ["activities", "Activités", "activity"],
  ["purchases", "Achats", "purchase"], ["extras", "Extras du séjour", "extra"]];
const mainSlot = (key: string) => key === "activity" ? "main" : ["restaurant", "fast-food", "delivery"].includes(key) ? "meal" : key === "beauty-restock" ? "products" : "item";
const mainOption = (key: string) => key === "purchase" ? "item" : key === "beauty-restock" ? "product" : key;
const items = (context: PlannedContextState, slot: string) => (context.slotSelections[slot]?.items ?? []) as readonly ComponentSelectionV1[];
const firstComponent = (context: PlannedContextState, slot: string) => items(context, slot).find((item): item is Component => item.kind === "COMPONENT");
const extraTopics = [
  { key: "breakfast", label: "Petit-déjeuner", reason: "À vérifier auprès de l’hébergement : compris ou facturé séparément.", names: ["petit dejeuner", "petit dejeuner d hebergement"] },
  { key: "tax", label: "Taxe de séjour", reason: "Selon votre séjour : ne présume ni obligation, ni inclusion, ni montant.", names: ["taxe de sejour"] },
] as const;
const normalizeLabel = (label: string) => label.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("fr").replace(/[^a-z0-9]+/g, " ").trim();

/** Calendar consistency only; pricing and quantity valuation remain in the Compiler. */
export function validateStayCalendar(fields: PlannedContextState["fields"]) {
  const start = fields.plannedDate, end = fields.endDate, nights = fields.nightCount;
  if (typeof start !== "string" || typeof end !== "string" || typeof nights !== "number") return;
  const calendarNights = (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000;
  if (Number.isFinite(calendarNights) && calendarNights !== nights)
    throw Error(`Les dates indiquent ${calendarNights} nuit(s), mais vous en avez déclaré ${nights}. Corrigez les dates ou la durée ; aucun tarif n’a été recalculé.`);
}

export function ShortStayEditor({ semanticState, ...props }: Omit<ComponentProps<typeof ProspectiveContextEditor>, "stay" | "stayDetails" | "posts" | "postsQuestion"> & { semanticState: PlanSemanticStateV1 }) {
  const context = props.context, oldLodging = firstComponent(context, "lodging"), oldGroceries = firstComponent(context, "groceries");
  const [nights, setNights] = useState(context.fields.nightCount?.toString() ?? "");
  const [lodgingKind, setLodgingKind] = useState(String(context.fields.lodgingKind ?? "LATER"));
  const [basis, setBasis] = useState<"TOTAL" | "PER_NIGHT" | "LEGACY">(oldLodging?.lodgingPricing?.basis ?? (oldLodging ? "LEGACY" : "TOTAL"));
  const [lodging, setLodging] = useState<Row | null>(() => oldLodging ? fromSelection(oldLodging) : null);
  const [lodgingDirty, setLodgingDirty] = useState(false);
  const [groceries, setGroceries] = useState<Row | null>(() => oldGroceries ? fromSelection(oldGroceries) : null);
  const [groceriesDirty, setGroceriesDirty] = useState(false);
  const [posts, setPosts] = useState<Record<Group, Post[]>>(() => Object.fromEntries(groups.map(([slot]) => [slot, items(context, slot).flatMap(item => {
    if (item.kind === "COMPONENT") return [{ row: fromSelection(item), templateKey: item.optionKey }];
    if (item.kind !== "CHILD_CONTEXT") return [];
    const child = semanticState.contexts.find(c => c.contextOccurrenceId === item.childContextOccurrenceId);
    if (!child) return [];
    const main = firstComponent(child, mainSlot(child.templateKey));
    return [{ row: main ? fromSelection(main) : fresh(typeof child.fields.label === "string" ? child.fields.label : ""), templateKey: child.templateKey, child, link: item }];
  })])) as Record<Group, Post[]>);
  const [dirty, setDirty] = useState<Partial<Record<Group, boolean>>>({});
  const [postSection, setPostSection] = useState<"lodging" | "groceries" | Group>("lodging");
  const [lodgingPage, setLodgingPage] = useState<"terms" | "price" | "kind">("terms");
  const [postPage, setPostPage] = useState(0);
  const [extraTopic, setExtraTopic] = useState<typeof extraTopics[number] | null>(null);
  const source = canonicalPlannerJson([context, semanticState.contexts.filter(child => child.parentContextOccurrenceId === context.contextOccurrenceId)]);
  const expectedSource = useRef(source);
  const card = props.model.board.contexts.find(card => card.contextOccurrenceId === context.contextOccurrenceId);
  const locked = (id: string) => semanticState.preferences.anchors.includes(id) || semanticState.preferences.flexibility[id] === "PRESERVE"
    || props.model.semanticState.preferences.anchors.includes(id) || props.model.semanticState.preferences.flexibility[id] === "PRESERVE";
  const writable = context.templateKey === "short-stay" && source === expectedSource.current && !locked(context.contextOccurrenceId)
    && canonicalPlannerJson(semanticState.contexts.find(current => current.contextOccurrenceId === context.contextOccurrenceId) ?? null) === canonicalPlannerJson(context)
    && card?.templateKey === "short-stay" && card.externalIntentId === null && card.parentContextOccurrenceId === context.parentContextOccurrenceId
    && !card.readOnly && card.capabilityRefs.includes("PATCH_CONTEXT");
  const slotAllowed = (slot: string, option: string) => {
    const socket = card?.sockets.find(socket => socket.slotKey === slot);
    return writable && socket?.cardinality === (slot === "lodging" ? "REQUIRED_ONE" : "REPEATING")
      && socket.capabilityRefs.includes(`short-stay:${slot}:SELECT_COMPONENT`)
      && socket.choiceAssetKeys?.includes(`option:short-stay:${slot}:${option}`)
      && publishedDrop(props.model, `option:short-stay:${slot}:${option}`, { kind: "CONTEXT_SOCKET", contextOccurrenceId: context.contextOccurrenceId, slotKey: slot })?.semanticAction === "PATCH_CONTEXT";
  };
  const buffer = { nights, lodgingKind, basis, lodging, groceries, posts };
  const acceptedBuffer = useRef(buffer), initial = acceptedBuffer.current;
  const confirm = useWorkshopConfirmation();
  const leaveRaw = useWorkshopRaw(context.contextOccurrenceId, JSON.stringify(buffer) !== JSON.stringify(initial), () => {
    setNights(initial.nights); setLodgingKind(initial.lodgingKind); setBasis(initial.basis); setLodging(initial.lodging);
    setGroceries(initial.groceries); setPosts(initial.posts); setLodgingDirty(false); setGroceriesDirty(false); setDirty({});
  }, "stay-posts-workshop");
  const update = (slot: Group, values: Post[]) => { setPosts(p => ({ ...p, [slot]: values })); setDirty(d => ({ ...d, [slot]: true })); };
  const prepare = (): Pick<ShortStayEdit, "fields" | "slots" | "children"> => {
    const nightCount = nights.trim() ? Number(nights) : null;
    if (nightCount !== null && (!Number.isInteger(nightCount) || nightCount < 1 || nightCount > 366)) throw Error("Indiquez un nombre de nuits entre 1 et 366, ou laissez-le inconnu.");
    const fields: ShortStayEdit["fields"] = { ...(nightCount !== (context.fields.nightCount ?? null) ? { nightCount } : {}),
      ...(lodgingKind !== (context.fields.lodgingKind ?? "LATER") ? { lodgingKind } : {}) };
    const slots: NonNullable<ShortStayEdit["slots"]> = {};
    const mutable = slots as Record<string, readonly ComponentSelectionV1[]>;
    if (lodgingDirty || nights !== (context.fields.nightCount?.toString() ?? "") && oldLodging?.lodgingPricing) {
      if (!lodging) mutable.lodging = [];
      else if (basis === "LEGACY") mutable.lodging = [buildComponentRow(lodging, "lodging")];
      else {
        const quantity = basis === "PER_NIGHT" && nightCount !== null ? String(nightCount) : "1";
        const row = { ...lodging, edited: true, unitBasis: "ITEM" as const, quantity };
        mutable.lodging = [{ ...buildComponentRow(row, "lodging"), lodgingPricing: { version: "lodging-pricing@v1", basis, nightCount } }];
      }
    }
    if (groceriesDirty) mutable.groceries = groceries ? [buildComponentRow(groceries, "groceries")] : [];
    const children: PlannedContextState[] = [];
    for (const [slot] of groups) if (dirty[slot]) mutable[slot] = posts[slot].map(post => {
      const useChild = !!post.link || slot === "activities" || slot === "purchases";
      if (!useChild) return buildComponentRow(post.row, post.templateKey);
      const childId = post.child?.contextOccurrenceId ?? crypto.randomUUID(), key = post.templateKey;
      const priorItems = post.child ? items(post.child, mainSlot(key)) : [];
      const main = buildComponentRow(post.row, mainOption(key));
      const priorMain = post.child ? firstComponent(post.child, mainSlot(key)) : undefined;
      const replaceExisting = priorItems.some(item => item.selectionId === main.selectionId);
      const syncChildLabel = post.row.edited && (!post.child || typeof post.child.fields.label !== "string" || post.child.fields.label === priorMain?.label);
      const child: PlannedContextState = { contextOccurrenceId: childId, templateKey: key, status: "ACTIVE", parentContextOccurrenceId: context.contextOccurrenceId,
        provenance: "EXPLICIT_USER_DECISION", fields: { ...post.child?.fields, fieldSchemaVersion: post.child?.fields.fieldSchemaVersion ?? "context-fields@v2",
          ...(syncChildLabel ? { label: post.row.label.trim() } : {}), ...(!post.child && key === "purchase" ? { budgetDomain: "other" } : {}) },
        slotSelections: { ...post.child?.slotSelections, [mainSlot(key)]: { items: replaceExisting
          ? priorItems.map(item => item.selectionId === main.selectionId ? main : item) : [main] } } };
      children.push(child);
      return post.link ? { ...post.link, provenance: post.row.edited ? "EXPLICIT_USER_DECISION" : post.link.provenance } : { selectionId: crypto.randomUUID(), optionKey: key, kind: "CHILD_CONTEXT", childContextOccurrenceId: childId, provenance: "EXPLICIT_USER_DECISION" };
    });
    return { fields, slots, children };
  };
  const tile=(key:string,label:string,choose:()=>void,selected=false,hint?:string)=>({key,label,choose,selected,hint,iconKey:"short-stay"});
  const openPost=(key:typeof postSection)=>{setExtraTopic(null);setPostSection(key);setPostPage(0);};
  const suggestedTopics = lodging && ["HOTEL", "HOSTEL", "RENTAL"].includes(lodgingKind) && slotAllowed("extras", "extra") ? extraTopics : [];
  const suggestions = suggestedTopics.map(topic => ({...tile(topic.key, `${topic.label} · Examiner pour ce séjour`, () => {
    setExtraTopic(topic); setPostSection("extras");
  }, extraTopic?.key === topic.key, topic.reason), visualConceptId: topic.key === 'breakfast' ? 'v22-art:excel:479' : 'v22-art:excel:483'}));
  const postChoices=[tile("lodging","Hébergement",()=>{openPost("lodging");setLodgingPage("terms");}),tile("groceries","Courses",()=>openPost("groceries")),...groups.map(([key,label])=>tile(key,label,()=>openPost(key)))];
  const postsQuestion={title:postSection==="lodging"?"Quel prix pour l’hébergement ?":"Les postes du séjour",choices:postSection==="lodging"&&lodgingPage==="terms"?[
    tile("total","Prix total",()=>{setBasis("TOTAL");setLodgingDirty(true);if(!lodging)setLodging(fresh("Hébergement"));setLodgingPage("price");},basis==="TOTAL","Le forfait n’est pas multiplié par les nuits"),
    tile("night","Prix par nuit",()=>{setBasis("PER_NIGHT");setLodgingDirty(true);if(!lodging)setLodging(fresh("Hébergement"));setLodgingPage("price");},basis==="PER_NIGHT"),
    tile("kind","Type d’hébergement",()=>setLodgingPage("kind")),...suggestions,...postChoices.filter(c=>c.key!=="lodging")]
    :postSection==="lodging"&&lodgingPage==="kind"?[["RELATIVE","Chez un proche"],["HOTEL","Hôtel"],["HOSTEL","Auberge"],["RENTAL","Location"],["OTHER","Autre"],["LATER","À préciser"]].map(([key,label])=>({
      ...tile(key,label,()=>{setLodgingKind(key);setLodgingPage("terms");},lodgingKind===key),
      visualConceptId: ({RELATIVE:'v22-art:extra:family-visit',HOTEL:'v22-art:extra:hotel-stay-general',HOSTEL:'v22-art:extra:hostel-category',RENTAL:'v22-art:extra:rental-platform'} as Readonly<Record<string,string>>)[key]}))
    :[...suggestions,...postChoices]};
  const matchingExtras = extraTopic ? posts.extras.filter(post => (extraTopic.names as readonly string[]).includes(normalizeLabel(post.row.label))) : [];
  const lodgingCommands: CatalogCommand[] = [];
  if (slotAllowed("lodging", "lodging") && (!oldLodging || !locked(componentId(context.contextOccurrenceId, "lodging", oldLodging.selectionId)))) {
    for (const visualConceptId of ["v22-art:excel:470", "v22-art:extra:hotel-stay-general"]) {
      lodgingCommands.push({visualConceptId,label:oldLodging?"Ouvrir l’hébergement de ce séjour":"Configurer l’hébergement de ce séjour",
        editsExisting:!!oldLodging,run:()=>{const open=()=>{openPost("lodging");setLodgingPage(oldLodging?"price":"kind");};if(leaveRaw(open))open();}});
    }
  }
  for (const suggestion of suggestions) lodgingCommands.push({visualConceptId:suggestion.visualConceptId,label:suggestion.label,
    run:()=>{if(leaveRaw(suggestion.choose))suggestion.choose();}});
  const compatibleRoots = (slot: Group) => {
    const target: DropTarget = {kind:"CONTEXT_SOCKET",contextOccurrenceId:context.contextOccurrenceId,slotKey:slot};
    if(!writable || slot==="extras")return [];
    return props.model.board.contexts.flatMap(child=>{
      if(child.readOnly || child.parentContextOccurrenceId || child.contextOccurrenceId===context.contextOccurrenceId || locked(child.contextOccurrenceId))return [];
      const assetKey=`context-occurrence:${child.contextOccurrenceId}`;
      const drop=publishedDrop(props.model,assetKey,target);
      return drop?.semanticAction==="PATCH_CONTEXT"&&drop.choices.includes("REPARENT_PRESERVE_ID")?[{child,assetKey,target}]:[];
    });
  };
  const currentLodging = card?.sockets.find(socket => socket.slotKey === "lodging");
  const evaluated = props.fresh && canonicalPlannerJson(currentLodging?.currentItems ?? []) === canonicalPlannerJson(items(context, "lodging"))
    ? currentLodging?.evaluations?.find(evaluation => evaluation.selectionId === oldLodging?.selectionId)?.economicAmount : null;
  const stayDetails = <div data-stay-details>
    <h4>Hébergement · {oldLodging?.label || "À préciser"}</h4>
    <p>{context.fields.nightCount == null ? "Durée inconnue" : `${context.fields.nightCount} nuit(s) déclarée(s)`} · {oldLodging?.lodgingPricing?.basis === "PER_NIGHT" ? "Tarif par nuit" : oldLodging?.lodgingPricing?.basis === "TOTAL" ? "Forfait total" : "Base existante conservée"}</p>
    <p>{oldLodging?.cost.kind === "MANUAL" ? `Prix déclaré : ${money(oldLodging.cost.unitAmount)}${oldLodging.lodgingPricing?.basis === "PER_NIGHT" ? " / nuit" : ""}`
      : oldLodging?.cost.kind === "QUOTE" ? "Devis de référence conservé, sans preuve de réservation" : "Prix encore inconnu"}.
      {evaluated != null ? ` Estimation du brouillon : ${money(evaluated)}.` : " Total non confirmé ; prévisualisez pour l’actualiser."}</p>
    {JSON.stringify(buffer) !== JSON.stringify(initial) && <p role="status">Saisie non conservée : ce résumé décrit encore l’hébergement du brouillon.</p>}
    <p className={styles.helper}>Réservation et acompte : aucune attestation disponible ici. Un acompte déjà compris ne doit pas être ajouté aux extras ; seul un frais distinct explicitement décidé s’ajoute au total.</p>
  </div>;
  const content = <>
    <CatalogOpenButton target={{contextId:context.contextOccurrenceId,moment:"lodging",commands:lodgingCommands}}>Parcourir les éléments du séjour</CatalogOpenButton>
    <p className={styles.helper}>Le séjour regroupe ses postes, sans coût parent ajouté. Les autres postes restent accessibles dans le dock.</p>
    {!writable && <p role="status">Ce séjour est en consultation ou sa cible a changé. La saisie reste conservée ; aucune modification ne peut être validée ici.</p>}
    {postSection === "lodging" && <>
    {lodgingPage === "terms" && <p>Choisis le prix total ou le tarif par nuit dans le dock. La date reste facultative.</p>}
    {lodgingPage === "kind" && <p>Type actuel : {({RELATIVE:"chez un proche",HOTEL:"hôtel",HOSTEL:"auberge",RENTAL:"location",OTHER:"autre",LATER:"à préciser"} as Record<string,string>)[lodgingKind]??"référence conservée"}. Ce choix ne prouve aucun prix.</p>}
    {lodgingPage === "price" && basis === "PER_NIGHT" && <label>Nombre de nuits (facultatif)<input type="number" min="1" max="366" value={nights} onChange={event=>setNights(event.target.value)} placeholder="Inconnu"/></label>}
    {lodgingPage === "price" && (lodging ? <WorkshopComponentRow title="Hébergement" row={lodging} back={{label:"Hébergement et autres postes",action:()=>setLodgingPage("terms")}} participantCount={0} fixedQuantity={basis !== "LEGACY"}
      priceLabel={basis === "PER_NIGHT" ? "Tarif par nuit (€)" : "Coût total prévu (€)"}
      onChange={row => { setLodging(row); setLodgingDirty(true); }} onRemove={() => { setLodging(null); setLodgingDirty(true); }} />
      : <button type="button" onClick={() => { setLodging(fresh("Hébergement")); setLodgingDirty(true); }}>Renseigner l’hébergement</button>)}
    {basis === "PER_NIGHT" && !nights && <p role="status">Le tarif par nuit sera conservé. Le coût total restera inconnu tant que la durée n’est pas décidée.</p>}</>}
    {postSection === "groceries" && <>
    <h3>Courses du séjour</h3>
    {groceries ? <WorkshopComponentRow title="Courses du séjour" row={groceries} back={{label:"Autres postes du séjour",action:()=>{setPostSection("lodging");setLodgingPage("terms");}}} participantCount={0} bindingChoices
      onChange={row => { setGroceries(row); setGroceriesDirty(true); }} onRemove={() => { setGroceries(null); setGroceriesDirty(true); }} />
      : <button type="button" onClick={() => { setGroceries(fresh("Courses du séjour")); setGroceriesDirty(true); }}>Ajouter des courses</button>}</>}
    {postSection === "extras" && extraTopic && <section data-stay-topic={extraTopic.key} aria-label={extraTopic.label}>
      <h3>{extraTopic.label} · À examiner</h3><p>{extraTopic.reason}</p>
      <p>Déjà compris dans le prix ? Gardez le forfait actuel. Inconnu ? Aucun montant n’est ajouté par cette consultation.</p>
      {posts.extras.length > 0 && <p>Extras déjà présents : {posts.extras.map(post => post.row.label).join(" · ")}. Vérifiez-les avant tout ajout.</p>}
      {matchingExtras.map(post => <button type="button" key={post.row.id} data-stay-extra={post.row.id} disabled={props.busy || locked(componentId(context.contextOccurrenceId, "extras", post.row.id))} onClick={() => { setPostPage(posts.extras.indexOf(post)); setExtraTopic(null); }}>Ouvrir {post.row.label} · ligne {posts.extras.indexOf(post) + 1}</button>)}
      {!matchingExtras.length && <button type="button" disabled={props.busy || !slotAllowed("extras", "extra")} onClick={() => {
        if (!slotAllowed("extras", "extra")) return;
        setPostPage(posts.extras.length); update("extras", [...posts.extras, { row: fresh(extraTopic.label), templateKey: "extra" }]); setExtraTopic(null);
      }}>Préparer un supplément distinct · {extraTopic.label}</button>}
      <button type="button" onClick={() => setExtraTopic(null)}>Voir les extras existants</button>
    </section>}
    {groups.filter(([slot]) => slot === postSection && !extraTopic).map(([slot, caption, key]) => <div key={slot}><h3>{caption}</h3>
      {posts[slot].slice(postPage, postPage + 1).map(post => { const index = postPage; return <div key={post.row.id}>
        {slot === "restaurants" && !post.link && <label>Type de repas<select value={post.templateKey} onChange={e => update(slot, posts[slot].map((p, i) => i === index ? { ...p, templateKey: e.target.value } : p))}>
          <option value="restaurant">Restaurant</option><option value="fast-food">Restauration rapide</option><option value="delivery">Livraison</option></select></label>}
        <WorkshopComponentRow title={caption} row={post.row} back={{label:"Autres postes du séjour",action:()=>{setPostSection("lodging");setLodgingPage("terms");}}} participantCount={0} bindingChoices={slot === "restaurants"}
          onChange={row => update(slot, posts[slot].map((p, i) => i === index ? { ...p, row } : p))}
          onRemove={() => { update(slot, posts[slot].filter((_, i) => i !== index)); setPostPage(page => Math.max(0, page - 1)); }} />
        {post.child && <p className={styles.helper}>Moment enfant lié : ses autres informations et équipements sont conservés. Ils restent accessibles depuis la carte R6.</p>}
      </div>; })}
      {posts[slot].length > 1 && <div className={styles.nightPage}><button type="button" disabled={postPage === 0} onClick={() => setPostPage(page => page - 1)}>Précédent</button><span>{postPage + 1} / {posts[slot].length}</span><button type="button" disabled={postPage + 1 >= posts[slot].length} onClick={() => setPostPage(page => page + 1)}>Suivant</button></div>}
      <button type="button" onClick={() => { setPostPage(posts[slot].length); update(slot, [...posts[slot], { row: fresh(slot === "activities" ? "Activité" : slot === "purchases" ? "Achat" : slot === "extras" ? "Extra" : "Restaurant"), templateKey: key }]); }}>Ajouter · {caption}</button>
      {compatibleRoots(slot).map(({child,assetKey,target})=><button type="button" key={child.contextOccurrenceId} disabled={props.busy} onClick={()=>{
        const ask=()=>confirm({message:`Rattacher « ${child.label} » à ce séjour ? L’intention et ses postes sont conservés.`,
          acceptLabel:"Rattacher cette intention",accept:()=>props.onSave({kind:"DROP",assetKey,target,values:{},identity:child.contextOccurrenceId,selectionId:crypto.randomUUID()})});
        if(leaveRaw(ask))ask();
      }}>Rattacher {child.label}</button>)}
    </div>)}
    <details><summary>À savoir sur les postes</summary><p className={styles.helper}>Un jacuzzi peut être une activité ou un extra explicitement ajouté. Les transports des enfants liés doivent déclarer leur relation au trajet du séjour ; aucune fusion n’est déduite d’un libellé.</p></details>
  </>;
  return <ProspectiveContextEditor {...props} stay stayDetails={stayDetails} posts={content} postsQuestion={postsQuestion} onSave={operation => {
    if (operation.kind !== "EDIT_SHORT_STAY") return false;
    if (!writable || operation.edit.contextOccurrenceId !== context.contextOccurrenceId)
      throw Error("Ce séjour ou ses droits ont changé. Votre saisie est conservée ; rouvrez la bonne occurrence.");
    const prepared = prepare();
    for (const slot of ["lodging", "extras"] as const) if (prepared.slots?.[slot]) {
      if (!slotAllowed(slot, slot === "lodging" ? "lodging" : "extra")) throw Error("Ce poste n’est plus modifiable. Votre saisie est conservée.");
      for (const item of items(context, slot)) if (locked(componentId(context.contextOccurrenceId, slot, item.selectionId))
        && canonicalPlannerJson(prepared.slots[slot]?.find(next => next.selectionId === item.selectionId) ?? null) !== canonicalPlannerJson(item))
        throw Error("Ce poste est protégé. Votre saisie est conservée.");
    }
    validateStayCalendar({ ...context.fields, ...operation.edit.fields, ...prepared.fields });
    const admitted = props.onSave({ ...operation, edit: { ...operation.edit, ...prepared, fields: { ...operation.edit.fields, ...prepared.fields } } });
    if (admitted) acceptedBuffer.current = buffer;
    return admitted;
  }} />;
}
