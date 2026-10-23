import "server-only";
import type { ComponentOptionDefinition, ComponentSlotDefinition } from "@/domain/phase2/planner/component-contract";
import type { ContextCapability, ContextFieldDefinition, ContextRegistryV1, ContextTemplateV1 } from "@/domain/phase2/planner/context-contract";
import type { PlanSemanticStateV1 } from "@/domain/phase2/planner/semantic-state";
import { nightOutConsumption } from "@/domain/phase2/planner/night-out-consumption";

export const CONTEXT_REGISTRY_VERSION = "planner-context-registry@v3-renewals";
export const GIFT_ASSET_CONTEXT_REGISTRY_VERSION = "planner-context-registry@v4-gift-asset";
const commonFields: readonly ContextFieldDefinition[] = [
  { fieldKey: "label", kind: "TEXT", required: false }, { fieldKey: "plannedDate", kind: "DATE", required: false },
  { fieldKey: "fieldSchemaVersion", kind: "CHOICE", required: false, choices: ["context-fields@v2", "context-fields@v3"] }];
const person = (fieldKey: string): ContextFieldDefinition => ({ fieldKey, kind: "PERSON_REF", required: false });
const people: ContextFieldDefinition = { fieldKey: "participantRefs", kind: "PERSON_REFS", required: false };
const place = (fieldKey: string): ContextFieldDefinition => ({ fieldKey, kind: "PLACE_REF", required: false });
const text = (fieldKey: string): ContextFieldDefinition => ({ fieldKey, kind: "TEXT", required: false });
const sharedFields = [people, place("placeRef")] as const;
const foodTemplates = ["restaurant", "fast-food", "delivery"];
const component = (optionKey: string, label: string, baselineDomain: string | null = null,
  bindingPolicy: ComponentOptionDefinition["bindingPolicy"] = baselineDomain ? "CERTAIN_DOMAIN" : "NONE"): ComponentOptionDefinition =>
  ({ optionKey, label, kind: "COMPONENT", baselineDomain, bindingPolicy });
const mealOptions = foodTemplates.map(key => component(key, key, key === "restaurant" ? "restaurants" : key));
const slot = (slotKey: string, cardinality: ComponentSlotDefinition["cardinality"], options: readonly ComponentOptionDefinition[] = [],
  allowedChildTemplates: readonly string[] = []): ComponentSlotDefinition => ({ slotKey, role: slotKey, cardinality,
    optionSource: allowedChildTemplates.length ? "CHILD_CONTEXT" : "CAPABILITY_PROVIDER", options, allowedChildTemplates });
const mobility = (slotKey: string, role: NonNullable<ComponentSlotDefinition["mobilityRole"]> = "PRIMARY"): ComponentSlotDefinition =>
  ({ ...slot(slotKey, "OPTIONAL_ONE", (["CAR", "TRAIN", "BUS", "TAXI", "FREE", "OTHER", "UNKNOWN"] as const).map(mode =>
    ({ optionKey: mode.toLowerCase(), label: mode, kind: "MOBILITY_INTENT", baselineDomain: null, bindingPolicy: "NONE", mobilityMode: mode }))), mobilityRole: role });
function template(templateKey: string, label: string, family: ContextTemplateV1["family"], componentSlots: readonly ComponentSlotDefinition[],
  fields: readonly ContextFieldDefinition[] = [], minimumEconomicSelections = 0): ContextTemplateV1 {
  const capabilities: ContextCapability[] = componentSlots.flatMap(s => {
    const common = { slotKey: s.slotKey, cardinality: s.cardinality, selectionMode: s.cardinality === "REPEATING" ? "MANY" as const : "ONE_OF" as const };
    const actions: ContextCapability[] = [];
    for (const kind of ["COMPONENT", "MOBILITY_INTENT"] as const) if (s.options.some(o => o.kind === kind)) actions.push({ ...common,
      action: kind === "COMPONENT" ? "SELECT_COMPONENT" : "SELECT_MOBILITY_INTENT",
      optionKeys: s.options.filter(o => o.kind === kind).map(o => o.optionKey), childTemplateKeys: [] });
    if (s.allowedChildTemplates.length) actions.push({ ...common, action: "ATTACH_CHILD_CONTEXT", optionKeys: [], childTemplateKeys: s.allowedChildTemplates });
    return actions;
  });
  return { templateKey, label, family, version: `${templateKey}@v1`, fields: [...commonFields, ...fields], componentSlots, capabilities, minimumEconomicSelections,
    structuralDefaults: Object.fromEntries(componentSlots.filter(s => s.cardinality === "REQUIRED_ONE").map(s => [s.slotKey, { items: [{
      selectionId: `structural:${s.slotKey}`, optionKey: "unresolved", kind: "UNRESOLVED", provenance: "STRUCTURAL_DEFAULT" }] }])) };
}
const templates: ContextTemplateV1[] = [
  ...foodTemplates.map(key => template(key, key, "FOOD", [slot("meal", "REQUIRED_ONE", mealOptions.filter(o => o.optionKey === key)),
    slot("extras", "REPEATING", [component("extra", "Complément de repas")]), ...(key === "delivery" ? [] : [mobility("transport")])], sharedFields)),
  template("activity", "Activité", "ACTIVITY", [slot("main", "REQUIRED_ONE", [component("activity", "Activité")]),
    slot("extras", "REPEATING", [component("extra", "Complément")]), mobility("transport")], sharedFields),
  ...["family-visit", "friend-visit"].map(key => template(key, key, "VISIT", [
    slot("hospitality", "OPTIONAL_ONE", [component("hospitality", "Contribution à la visite")]),
    slot("activities", "REPEATING", [], ["activity", ...foodTemplates, "purchase", "gift"]), mobility("transport")],
    [person("personVisitedRef"), people, place("placeRef"), text("timingNote")])),
  template("purchase", "Achat", "PURCHASE", [slot("item", "REQUIRED_ONE", [component("item", "Achat")]),
    slot("extras", "REPEATING", [component("extra", "Frais ou complément")]), mobility("transport")],
    [{ fieldKey: "budgetDomain", kind: "CHOICE", required: false, choices: ["clothing", "home-small", "games-digital", "other"] },
      text("productLabel"), text("merchantLabel"), place("placeRef")]),
  template("night-out", "Soirée", "SOCIAL", [
    slot("before", "OPTIONAL_ONE", [component("before", "Before")], ["activity", "friend-visit"]),
    slot("main", "REQUIRED_ONE", [component("main", "Entrée ou événement")], ["activity"]),
    slot("food", "OPTIONAL_ONE", mealOptions, foodTemplates), mobility("outbound"), mobility("return", "RETURN"),
    slot("extras", "REPEATING", [component("extra", "Vestiaire, boissons ou complément")])],
    [{ fieldKey: "endDate", kind: "DATE", required: false }, people, place("placeRef"), text("timingNote")]),
  template("short-stay", "Séjour court", "TRAVEL", [
    slot("lodging", "REQUIRED_ONE", [component("lodging", "Hébergement")]),
    slot("groceries", "OPTIONAL_ONE", [component("groceries", "Courses du séjour", "groceries", "REQUIRES_CONFIRMATION")]),
    slot("restaurants", "REPEATING", mealOptions, foodTemplates), slot("activities", "REPEATING", [], ["activity"]),
    slot("purchases", "REPEATING", [], ["purchase", "gift", "beauty-restock"]), mobility("transport")],
    [{ fieldKey: "endDate", kind: "DATE", required: false }, people, place("destinationRef"),
      { fieldKey: "nightCount", kind: "COUNT", required: false },
      { fieldKey: "lodgingKind", kind: "CHOICE", required: false, choices: ["RELATIVE", "HOTEL", "HOSTEL", "RENTAL", "OTHER", "LATER"] },
      text("timingNote")]),
  template("beauty-restock", "Réapprovisionnement beauté", "BEAUTY", [{ ...slot("products", "REPEATING", [component("product", "Produit")]), acceptsNeedOccurrence: true }, mobility("transport")], [], 1),
  template("gift", "Cadeau", "PURCHASE", [slot("item", "REQUIRED_ONE", [component("gift", "Cadeau")]), slot("extras", "REPEATING", [component("extra", "Complément")])],
    [person("recipientRef"), text("occasion"), text("objectLabel"), { fieldKey: "objectAssetRef", kind: "PLANNED_ASSET_REF", required: false }]),
  template("home-project", "Projet maison", "HOME", [slot("items", "REPEATING", [component("item", "Équipement du projet")]),
    slot("services", "REPEATING", [component("service", "Service")]), slot("purchases", "REPEATING", [], ["purchase"]), mobility("transport")], [], 1),
  template("other-context", "Autre intention", "OTHER", [slot("components", "REPEATING", [component("other", "Contribution")]),
    slot("children", "REPEATING", [], ["activity", ...foodTemplates, "purchase", "gift", "family-visit", "friend-visit", "beauty-restock", "home-project"]), mobility("transport")], [], 1)
];
function freeze<T>(value: T): T {
  if (value && typeof value === "object") { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value;
}
const giftRegistry = freeze<ContextRegistryV1>({ version: GIFT_ASSET_CONTEXT_REGISTRY_VERSION,
  templates: templates.map(template => template.templateKey === "gift" ? { ...template, version: "gift@v2" } : template)
    .sort((a, b) => a.templateKey < b.templateKey ? -1 : a.templateKey > b.templateKey ? 1 : 0) });
const familyRegistry = freeze<ContextRegistryV1>({ version: "planner-context-registry@v5-family-mobility",
  templates: giftRegistry.templates.map(t => t.templateKey !== "family-visit" ? t : { ...t, version: "family-visit@v2",
    fields: [...t.fields.map(f => f.fieldKey === "fieldSchemaVersion" ? { ...f, choices: ["context-fields@v2", "context-fields@v3", "context-fields@v4"] } : f),
      { fieldKey: "endDate", kind: "DATE", required: false }] }) });
const stayRegistry = freeze<ContextRegistryV1>({ version: "planner-context-registry@v6-short-stay",
  templates: familyRegistry.templates.map(t => t.templateKey !== "short-stay" ? t : { ...t, version: "short-stay@v2",
    fields: t.fields.map(f => f.fieldKey === "fieldSchemaVersion" ? { ...f, choices: ["context-fields@v2", "context-fields@v3", "context-fields@v5"] } : f),
    componentSlots: [...t.componentSlots, slot("extras", "REPEATING", [component("extra", "Extra du séjour")])],
    capabilities: [...t.capabilities, { slotKey: "extras", cardinality: "REPEATING", selectionMode: "MANY", action: "SELECT_COMPONENT", optionKeys: ["extra"], childTemplateKeys: [] }] }) });
const venueRegistry=freeze<ContextRegistryV1>({version:"planner-context-registry@v7-night-venue",templates:stayRegistry.templates.map(t=>t.templateKey!=="night-out"?t:{...t,version:"night-out@v2",
  fields:[...t.fields.map(f=>f.fieldKey==="fieldSchemaVersion"?{...f,choices:[...f.choices!,"context-fields@v6"]}:f),{fieldKey:"venueDecision",kind:"TEXT" as const,required:false,semanticContract:"NIGHT_OUT_VENUE" as const}]})});
const coverageRegistry=freeze<ContextRegistryV1>({version:"planner-context-registry@v8-night-coverage",templates:venueRegistry.templates.map(t=>t.templateKey==="night-out"?{...t,version:"night-out@v3"}:t)});
const registry=freeze<ContextRegistryV1>({version:"planner-context-registry@v9-night-consumption",templates:coverageRegistry.templates.map(t=>t.templateKey!=="night-out"?t:{...t,version:"night-out@v4",
  fields:[...t.fields,{fieldKey:"nightOutConsumption",kind:"TEXT" as const,required:false,semanticContract:"NIGHT_OUT_CONSUMPTION" as const}]})});
export const publishContextRegistry = (): ContextRegistryV1 => registry;
const globalConsumptionRegistry = freeze<ContextRegistryV1>({version: "planner-context-registry@v10-bar-global-consumption",
  templates: registry.templates.map(t => t.templateKey === "night-out" ? {...t, version: "night-out@v5"} : t)});
/** Preserve the exact registry manifest previously emitted for v2 revisions. */
const v2Registry = freeze<ContextRegistryV1>({ version: CONTEXT_REGISTRY_VERSION,
  templates: giftRegistry.templates.map(template => ({ ...template,
    version: template.templateKey === "gift" ? "gift@v1" : template.version,
    fields: template.fields.filter(field => field.fieldKey !== "objectAssetRef").map(field => field.fieldKey === "fieldSchemaVersion"
      ? { ...field, choices: ["context-fields@v2"] } : field) })) });
/** C0 stores the whole registry in the immutable manifest. Keep its pre-P02 shape for old states. */
export function isLegacyContextField(templateKey: string, fieldKey: string): boolean {
  return ["label", "plannedDate"].includes(fieldKey)
    || templateKey === "purchase" && fieldKey === "budgetDomain"
    || ["night-out", "short-stay"].includes(templateKey) && fieldKey === "endDate";
}
const legacyRegistry = freeze<ContextRegistryV1>({ version: CONTEXT_REGISTRY_VERSION,
  templates: v2Registry.templates.map(template => ({ ...template,
    fields: template.fields.filter(field => isLegacyContextField(template.templateKey, field.fieldKey)) })) });
export function manifestContextRegistry(state: PlanSemanticStateV1): ContextRegistryV1 {
  if (state.contexts.some(context => nightOutConsumption(context)?.version === "night-out-consumption@v2")) return globalConsumptionRegistry;
  if (state.contexts.some(context=>context.fields.nightOutConsumption!==undefined))return registry;
  if (state.contexts.some(context=>Object.values(context.slotSelections).some(slot=>Array.isArray(slot.items)&&slot.items.some(item=>item&&typeof item==="object"&&!Array.isArray(item)&&Object.hasOwn(item,"economicScope")))))return coverageRegistry;
  if (state.contexts.some(context => context.fields.fieldSchemaVersion === "context-fields@v6")) return venueRegistry;
  if (state.contexts.some(context => context.fields.fieldSchemaVersion === "context-fields@v5")) return stayRegistry;
  if (state.contexts.some(context => context.fields.fieldSchemaVersion === "context-fields@v4")) return familyRegistry;
  if (state.contexts.some(context => context.fields.fieldSchemaVersion === "context-fields@v3")) return giftRegistry;
  return state.contexts.some(context => context.fields.fieldSchemaVersion === "context-fields@v2") ? v2Registry : legacyRegistry;
}
export function resolveContextTemplate(key: string): ContextTemplateV1 {
  const found = registry.templates.find(t => t.templateKey === key);
  if (!found) throw new TypeError(`PLANNER_CONTEXT_TEMPLATE_UNSUPPORTED:${key}`);
  return found;
}
