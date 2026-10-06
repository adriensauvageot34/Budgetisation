import "server-only";
import type { ComponentOptionDefinition, ComponentSlotDefinition } from "@/domain/phase2/planner/component-contract";
import type { ContextCapability, ContextFieldDefinition, ContextRegistryV1, ContextTemplateV1 } from "@/domain/phase2/planner/context-contract";

export const CONTEXT_REGISTRY_VERSION = "planner-context-registry@v2-mobility";
const commonFields: readonly ContextFieldDefinition[] = [
  { fieldKey: "label", kind: "TEXT", required: false }, { fieldKey: "plannedDate", kind: "DATE", required: false }];
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
    slot("extras", "REPEATING", [component("extra", "Complément de repas")]), ...(key === "delivery" ? [] : [mobility("transport")])])),
  template("activity", "Activité", "ACTIVITY", [slot("main", "REQUIRED_ONE", [component("activity", "Activité")]),
    slot("extras", "REPEATING", [component("extra", "Complément")]), mobility("transport")]),
  ...["family-visit", "friend-visit"].map(key => template(key, key, "VISIT", [
    slot("hospitality", "OPTIONAL_ONE", [component("hospitality", "Contribution à la visite")]),
    slot("activities", "REPEATING", [], ["activity", ...foodTemplates, "purchase", "gift"]), mobility("transport")])),
  template("purchase", "Achat", "PURCHASE", [slot("item", "REQUIRED_ONE", [component("item", "Achat")]),
    slot("extras", "REPEATING", [component("extra", "Frais ou complément")]), mobility("transport")],
    [{ fieldKey: "budgetDomain", kind: "CHOICE", required: false, choices: ["clothing", "home-small", "games-digital", "other"] }]),
  template("night-out", "Soirée", "SOCIAL", [
    slot("before", "OPTIONAL_ONE", [component("before", "Before")], ["activity", "friend-visit"]),
    slot("main", "REQUIRED_ONE", [component("main", "Entrée ou événement")], ["activity"]),
    slot("food", "OPTIONAL_ONE", mealOptions, foodTemplates), mobility("outbound"), mobility("return", "RETURN"),
    slot("extras", "REPEATING", [component("extra", "Vestiaire, boissons ou complément")])],
    [{ fieldKey: "endDate", kind: "DATE", required: false }]),
  template("short-stay", "Séjour court", "TRAVEL", [
    slot("lodging", "REQUIRED_ONE", [component("lodging", "Hébergement")]),
    slot("groceries", "OPTIONAL_ONE", [component("groceries", "Courses du séjour", "groceries", "REQUIRES_CONFIRMATION")]),
    slot("restaurants", "REPEATING", mealOptions, foodTemplates), slot("activities", "REPEATING", [], ["activity"]),
    slot("purchases", "REPEATING", [], ["purchase", "gift", "beauty-restock"]), mobility("transport")],
    [{ fieldKey: "endDate", kind: "DATE", required: false }]),
  template("beauty-restock", "Réapprovisionnement beauté", "BEAUTY", [slot("products", "REPEATING", [component("product", "Produit")]), mobility("transport")], [], 1),
  template("gift", "Cadeau", "PURCHASE", [slot("item", "REQUIRED_ONE", [component("gift", "Cadeau")]), slot("extras", "REPEATING", [component("extra", "Complément")])]),
  template("home-project", "Projet maison", "HOME", [slot("items", "REPEATING", [component("item", "Équipement du projet")]),
    slot("services", "REPEATING", [component("service", "Service")]), slot("purchases", "REPEATING", [], ["purchase"]), mobility("transport")], [], 1),
  template("other-context", "Autre intention", "OTHER", [slot("components", "REPEATING", [component("other", "Contribution")]),
    slot("children", "REPEATING", [], ["activity", ...foodTemplates, "purchase", "gift", "family-visit", "friend-visit", "beauty-restock", "home-project"]), mobility("transport")], [], 1)
];
function freeze<T>(value: T): T {
  if (value && typeof value === "object") { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value;
}
const registry = freeze<ContextRegistryV1>({ version: CONTEXT_REGISTRY_VERSION, templates: templates.sort((a, b) => a.templateKey < b.templateKey ? -1 : a.templateKey > b.templateKey ? 1 : 0) });
export const publishContextRegistry = (): ContextRegistryV1 => registry;
export function resolveContextTemplate(key: string): ContextTemplateV1 {
  const found = registry.templates.find(t => t.templateKey === key);
  if (!found) throw new TypeError(`PLANNER_CONTEXT_TEMPLATE_UNSUPPORTED:${key}`);
  return found;
}
