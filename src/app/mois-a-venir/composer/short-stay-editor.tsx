"use client";
import { useRef, useState, type ComponentProps } from "react";
import { useWorkshopRaw } from "./inline-edit-registry";
import type { ComponentSelectionV1 } from "@/domain/phase2/planner/component-contract";
import type { PlannedContextState, PlanSemanticStateV1 } from "@/domain/phase2/planner/semantic-state";
import type { ShortStayEdit } from "@/domain/phase2/planner/short-stay-edit";
import { ProspectiveContextEditor } from "./family-visit-editor";
import { fresh, fromSelection, buildComponentRow, type Row } from "./night-out-components";
import { WorkshopComponentRow } from "./workshop-component-row";
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

/** Calendar consistency only; pricing and quantity valuation remain in the Compiler. */
export function validateStayCalendar(fields: PlannedContextState["fields"]) {
  const start = fields.plannedDate, end = fields.endDate, nights = fields.nightCount;
  if (typeof start !== "string" || typeof end !== "string" || typeof nights !== "number") return;
  const calendarNights = (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000;
  if (Number.isFinite(calendarNights) && calendarNights !== nights)
    throw Error(`Les dates indiquent ${calendarNights} nuit(s), mais vous en avez déclaré ${nights}. Corrigez les dates ou la durée ; aucun tarif n’a été recalculé.`);
}

export function ShortStayEditor({ semanticState, ...props }: Omit<ComponentProps<typeof ProspectiveContextEditor>, "stay" | "posts" | "postsQuestion"> & { semanticState: PlanSemanticStateV1 }) {
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
  const buffer = { nights, lodgingKind, basis, lodging, groceries, posts };
  const acceptedBuffer = useRef(buffer), initial = acceptedBuffer.current;
  useWorkshopRaw(context.contextOccurrenceId, JSON.stringify(buffer) !== JSON.stringify(initial), () => {
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
  const openPost=(key:typeof postSection)=>{setPostSection(key);setPostPage(0);};
  const postChoices=[tile("lodging","Hébergement",()=>{openPost("lodging");setLodgingPage("terms");}),tile("groceries","Courses",()=>openPost("groceries")),...groups.map(([key,label])=>tile(key,label,()=>openPost(key)))];
  const postsQuestion={title:postSection==="lodging"?"Quel prix pour l’hébergement ?":"Les postes du séjour",choices:postSection==="lodging"&&lodgingPage==="terms"?[
    tile("total","Prix total",()=>{setBasis("TOTAL");setLodgingDirty(true);if(!lodging)setLodging(fresh("Hébergement"));setLodgingPage("price");},basis==="TOTAL","240 € reste 240 €"),
    tile("night","Prix par nuit",()=>{setBasis("PER_NIGHT");setLodgingDirty(true);if(!lodging)setLodging(fresh("Hébergement"));setLodgingPage("price");},basis==="PER_NIGHT"),
    tile("kind","Type d’hébergement",()=>setLodgingPage("kind")),...postChoices.filter(c=>c.key!=="lodging")]
    :postSection==="lodging"&&lodgingPage==="kind"?[["RELATIVE","Chez un proche"],["HOTEL","Hôtel"],["HOSTEL","Auberge"],["RENTAL","Location"],["OTHER","Autre"],["LATER","À préciser"]].map(([key,label])=>tile(key,label,()=>{setLodgingKind(key);setLodgingPage("terms");},lodgingKind===key))
    :postChoices};
  const content = <>
    <p className={styles.helper}>Le séjour regroupe ses postes, sans coût parent ajouté. Les autres postes restent accessibles dans le dock.</p>
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
    {groups.filter(([slot]) => slot === postSection).map(([slot, caption, key]) => <div key={slot}><h3>{caption}</h3>
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
    </div>)}
    <details><summary>À savoir sur les postes</summary><p className={styles.helper}>Un jacuzzi peut être une activité ou un extra explicitement ajouté. Les transports des enfants liés doivent déclarer leur relation au trajet du séjour ; aucune fusion n’est déduite d’un libellé.</p></details>
  </>;
  return <ProspectiveContextEditor {...props} stay posts={content} postsQuestion={postsQuestion} onSave={operation => {
    if (operation.kind !== "EDIT_SHORT_STAY") return false;
    const prepared = prepare();
    validateStayCalendar({ ...context.fields, ...operation.edit.fields, ...prepared.fields });
    const admitted = props.onSave({ ...operation, edit: { ...operation.edit, ...prepared, fields: { ...operation.edit.fields, ...prepared.fields } } });
    if (admitted) acceptedBuffer.current = buffer;
    return admitted;
  }} />;
}
