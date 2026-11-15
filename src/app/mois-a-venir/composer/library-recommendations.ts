import type { ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import type { ComposerPresetKey } from "@/domain/phase2/planner/composer-presets";
import { composerLibraryIndex, filterLibraryIntentions, type LibraryIntention, type LibraryOccurrence } from "@/domain/phase2/planner/composer-library-index";
import { conceptForPreset, conceptSearch, rankCatalogRecommendations, sourceReason, workbookSource } from "./catalog-relevance";
import { publishedDrop } from "./interactions";
import { projectPresetAvailable, type ProjectStarter } from "./project-starters";

type LibraryIndex = ReturnType<typeof composerLibraryIndex>;
type Recommendation = { key: string; label: string; reason: string; group: string; tiers: readonly number[];
  source?: ReturnType<typeof workbookSource> } & (
  { kind: "OPEN"; occurrence: LibraryOccurrence } | { kind: "ADD"; item: LibraryIntention } | { kind: "PROJECT"; project: ProjectStarter });

// General discovery uses a few reviewed forms of intent. Category discovery can
// also use the other verified concepts in that category. No implicit need or date.
const ideas = new Set(["cinema", "restaurant-for-two", "amazon-purchase", "weekend-gite", "groceries-purchase"]);
const categoryOf: Readonly<Record<string, string>> = {
  activity: "ACTIVITY", restaurant: "FOOD", purchase: "PURCHASE", "beauty-restock": "BEAUTY",
  "short-stay": "TRAVEL", "night-out": "SOCIAL", "family-visit": "VISIT", "friend-visit": "VISIT", "home-project": "HOME",
};
const boardTarget = { kind: "BOARD_ZONE" } as const;

export function searchRecommendedIntents(items: LibraryIndex["intentions"], query: string) {
  if (!query.trim()) return [...items];
  return filterLibraryIntentions(items.map(item => {
    const search = conceptSearch(item.search, item.preset?.presetKey);
    return search === item.search ? item : { ...item, search };
  }), query);
}

export function searchRecommendedOccurrences(items: LibraryIndex["occurrences"], query: string) {
  if (!query.trim()) return [];
  return filterLibraryIntentions(items.map(item => {
    const search = conceptSearch(item.search, item.presetKey as ComposerPresetKey | undefined);
    return search === item.search ? item : { ...item, search };
  }), query);
}

export function libraryRecommendations(model: ComposerUiModel, index: LibraryIndex, {
  category, projects = [], currentReading = false,
}: { category?: string; projects?: readonly ProjectStarter[]; currentReading?: boolean } = {}) {
  const cards = new Map(model.board.contexts.map(card => [card.contextOccurrenceId, card]));
  const candidates: Recommendation[] = [];
  const existingPresets = new Set(index.occurrences.map(row => row.presetKey));
  const byPreset = new Map(index.intentions.flatMap(item => item.preset ? [[item.preset.presetKey, item] as const] : []));
  const existingProjects = new Set<string>();
  const occurrenceById = new Map(index.occurrences.map(row => [row.contextOccurrenceId, row]));
  const childrenOf = (id: string) => cards.get(id)?.childContextOccurrenceIds
    .filter(child => cards.get(child)?.parentContextOccurrenceId === id)
    .map(child => occurrenceById.get(child)?.presetKey).filter(Boolean) ?? [];
  for (const project of projects) {
    if (index.occurrences.some(row => row.presetKey === project.parent
      && project.children.every(child => childrenOf(row.contextOccurrenceId).includes(child.key)))) existingProjects.add(project.key);
  }
  for (const occurrence of index.occurrences) {
    const card = cards.get(occurrence.contextOccurrenceId);
    if (!card || occurrence.action !== "EDIT") continue;
    const presetItem = occurrence.presetKey ? byPreset.get(occurrence.presetKey as ComposerPresetKey) : undefined;
    const group = presetItem?.category ?? (card.fields.budgetDomain === "groceries" ? "HOME" : categoryOf[card.templateKey]);
    if (!group || category && group !== category) continue;
    const incomplete = currentReading && (card.knowledge === "UNKNOWN" || card.knowledge === "PARTIAL");
    // General discovery surfaces unfinished or basket/project occurrences only.
    if (!category && !incomplete && occurrence.surface !== "BASKET" && !card.childContextOccurrenceIds.length) continue;
    const concept = conceptForPreset(presetItem?.preset?.presetKey);
    candidates.push({ kind: "OPEN", key: "open:" + occurrence.contextOccurrenceId, occurrence,
      label: occurrence.label + (occurrence.occurrence ? " · Intention " + occurrence.occurrence : ""), group,
      reason: incomplete ? "Dans ce mois · à compléter" : "Dans ce mois · retrouver cette intention",
      tiers: [incomplete ? 0 : 1], source: concept && workbookSource(concept) });
  }
  for (const item of index.intentions) {
    const preset = item.preset;
    if (!preset || existingPresets.has(preset.presetKey) || (category ? item.category !== category : !ideas.has(preset.presetKey))
      || publishedDrop(model, item.asset.assetKey, boardTarget)?.semanticAction !== "ADD_CONTEXT") continue;
    const concept = conceptForPreset(preset.presetKey);
    if (!ideas.has(preset.presetKey) && !concept) continue;
    const source = concept && workbookSource(concept);
    candidates.push({ kind: "ADD", key: item.key, item, label: item.label, group: item.category, source,
      reason: preset.presetKey === "laundry-detergent" ? "Consommable du catalogue · aucune échéance déduite"
        : sourceReason(source) ?? "Modèle disponible dans cette catégorie",
      tiers: [preset.presetKey === "laundry-detergent" ? 4 : 2, category === "ACTIVITY"
        ? Number(!["cinema", "bowling"].includes(preset.presetKey)) * 2 : 1] });
  }
  for (const project of projects) {
    if (existingProjects.has(project.key) || !project.children.length || !projectPresetAvailable(model, project.parent)
      || !project.children.every(child => projectPresetAvailable(model, child.key))) continue;
    const group = project.parent === "weekend-gite" || project.parent === "hotel-night" ? "TRAVEL"
      : project.parent === "composed-outing" && project.children.some(child => conceptForPreset(child.key)?.topic === "activity") ? "ACTIVITY" : "";
    if (!(category ? group === category : project.key === "cinema-dinner")) continue;
    const concept = project.children.map(child => conceptForPreset(child.key)).find(row => row?.topic === "activity");
    if (!concept) continue;
    candidates.push({ kind: "PROJECT", key: "project:" + project.key, project, label: project.label, group,
      source: workbookSource(concept), reason: "Modèle à personnaliser · " + concept.label, tiers: [2, category ? 1 : 0] });
  }
  const ranked = rankCatalogRecommendations(candidates);
  const result: Recommendation[] = [];
  const seen = new Set<string>();
  // A general shortlist should leave room for multiple families, while a
  // deliberately selected category can devote all four places to that family.
  for (const item of ranked) {
    if (result.length === 4) break;
    if (category || !seen.has(item.group)) { result.push(item); seen.add(item.group); }
  }
  return result;
}
