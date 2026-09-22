import type { GlobalExpandedReadModel, PersonaOwnerDetailRef, PublishedPersonaDetailIndex } from "./index";

type Profile = NonNullable<GlobalExpandedReadModel["profile"]>["profiles"][number];
type Trait = Profile["featuredTraits"][number];

export type PersonaDirectFact = { readonly label: string; readonly value: string };
export type PersonaDirectItem = { readonly title: string; readonly facts: readonly PersonaDirectFact[] };
export type PersonaDirectBlock = {
  readonly key: string;
  readonly title: string;
  readonly description?: string;
  readonly facts: readonly PersonaDirectFact[];
  readonly items: readonly PersonaDirectItem[];
};
export type PersonaDirectProfile = {
  readonly personId: string;
  readonly name: string;
  readonly daily: readonly PersonaDirectBlock[];
  readonly recurring: readonly PersonaDirectBlock[];
  readonly phases: readonly PersonaDirectBlock[];
};
export type PersonaDirectModel = {
  readonly version: "persona-direct-portrait@v1";
  readonly profiles: readonly PersonaDirectProfile[];
  readonly ownerDetailResolutionsInitial: number;
  readonly serverBuildMs: number;
};
export type PersonaDirectLabels = { readonly needs: Readonly<Record<string, string>> };

const money = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
const integer = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const serviceNames: Readonly<Record<string, string>> = Object.freeze({ chatgpt: "ChatGPT", qobuz: "Qobuz", netflix: "Netflix", max: "Max" });
const known = (value: unknown): value is number | string => (typeof value === "number" && Number.isFinite(value)) || (typeof value === "string" && value.trim().length > 0);
const text = (value: number | string) => typeof value === "number" ? integer.format(value) : value;
const euro = (value: number | string) => money.format(Number(value));
const fact = (label: string, value: string): PersonaDirectFact => ({ label, value });
const refKey = (ref: PersonaOwnerDetailRef) => `${ref.resource}:${ref.entityRef}`;

function personalProfiles(overview: GlobalExpandedReadModel): readonly Profile[] {
  if (overview.resource !== "analysis_global_personas_expanded" || overview.sectionKey !== "OVERVIEW") return [];
  return (overview.profile?.profiles ?? []).filter((profile) => profile.scope === "PERSONAL" && profile.subject.kind === "PERSON");
}

function indexFor(indices: readonly PublishedPersonaDetailIndex[], personId: string): PublishedPersonaDetailIndex | undefined {
  return indices.find((index) => String(index.personId) === personId);
}

function refFor(index: PublishedPersonaDetailIndex | undefined, key: string): PersonaOwnerDetailRef | undefined {
  return index?.blocks.find((block) => block.semanticKey === key)?.detailRefs.find((ref) => ref.role === "PRIMARY");
}

function needBlocks(index: PublishedPersonaDetailIndex | undefined, labels: PersonaDirectLabels) {
  return (index?.blocks ?? []).filter((block) => block.semanticKey.startsWith("need:") && block.detailRefs.length > 0)
    .map((block) => ({ block, name: labels.needs[block.semanticKey.slice("need:".length)] }))
    .filter((entry): entry is { block: typeof entry.block; name: string } => typeof entry.name === "string");
}

/** Selects only references used by visible portrait blocks, never raw legs or every index entry. */
export function selectPersonaDirectOwnerRefs(input: {
  readonly overview: GlobalExpandedReadModel;
  readonly indices: readonly PublishedPersonaDetailIndex[];
  readonly labels: PersonaDirectLabels;
}): readonly PersonaOwnerDetailRef[] {
  const refs: PersonaOwnerDetailRef[] = [];
  for (const profile of personalProfiles(input.overview).slice(0, 2)) {
    const index = indexFor(input.indices, String(profile.subject.personId));
    for (const trait of profile.featuredTraits) {
      if (!trait.semanticKey.startsWith("subscription.") || !trait.qualifications?.includes("PERSONAL_USAGE")) continue;
      const ref = refFor(index, trait.semanticKey);
      if (ref?.resource === "analysis_global_economic_recurrence_detail") refs.push(ref);
    }
    const work = refFor(index, "mobility:work-commute");
    if (profile.featuredTraits.some((trait) => trait.semanticKey.startsWith("mobility.work.")) && work?.resource === "analysis_global_place_mobility_detail") refs.push(work);
    for (const ref of [
      refFor(index, "mobility:family-visit:without-household-partner-confirmed"),
      refFor(index, "mobility:friend-visit:without-household-partner-confirmed") ?? refFor(index, "mobility:friend-visit"),
    ]) {
      if (ref?.resource === "analysis_global_place_mobility_detail") refs.push(ref);
    }
    for (const { block, name } of needBlocks(index, input.labels)) {
      if (!/vape|cigarette électronique|repas du midi au travail/iu.test(name)) continue;
      const ref = block.detailRefs.find((entry) => entry.role === "PRIMARY");
      if (ref?.resource === "analysis_global_category_need_detail") refs.push(ref);
    }
  }
  const unique = [...new Map(refs.map((ref) => [refKey(ref), ref])).values()];
  if (unique.length > 12) throw new TypeError("PERSONA_DIRECT_OWNER_RESOLUTION_LIMIT");
  return unique;
}

function metric(detail: GlobalExpandedReadModel | undefined, id: string): string | undefined {
  const value = detail?.metrics.find((candidate) => candidate.metricId === id);
  return value?.knowledgeState === "KNOWN" && value.displayValue !== "Indisponible" ? value.displayValue : undefined;
}

function detailFor(ref: PersonaOwnerDetailRef | undefined, details: ReadonlyMap<string, GlobalExpandedReadModel>): GlobalExpandedReadModel | undefined {
  return ref === undefined ? undefined : details.get(refKey(ref));
}

function serviceBlock(profile: Profile, index: PublishedPersonaDetailIndex | undefined, details: ReadonlyMap<string, GlobalExpandedReadModel>): PersonaDirectBlock | undefined {
  const items = profile.featuredTraits.flatMap((trait) => {
    if (!trait.semanticKey.startsWith("subscription.") || !trait.qualifications?.includes("PERSONAL_USAGE")) return [];
    const service = trait.semanticKey.split(".")[1];
    const ref = refFor(index, trait.semanticKey);
    if (service === undefined || serviceNames[service] === undefined || ref?.resource !== "analysis_global_economic_recurrence_detail") return [];
    const price = metric(detailFor(ref, details), "detail:typical-occurrence-cost");
    return [{ title: serviceNames[service], facts: price === undefined ? [fact("Usage personnel", "Confirmé")] : [fact("Tarif observé par occurrence", price)] }];
  });
  if (items.length === 0) return undefined;
  const entertainment = items.every((item) => item.title === "Netflix" || item.title === "Max");
  return { key: "services", title: entertainment ? "Divertissement" : "Services & abonnements", description: "Des services utilisés personnellement, avec leur tarif observé.", facts: [], items };
}

function beautyBlock(profile: Profile): PersonaDirectBlock | undefined {
  const beauty = profile.featuredTraits.find((trait) => trait.semanticKey === "universe.beauty_and_care");
  if (beauty === undefined) return undefined;
  const names: Readonly<Record<string, string>> = { mascara: "Mascara", sourcils: "Sourcils", skincare: "Soin de la peau", epilation: "Épilation" };
  const items = (beauty.children ?? []).flatMap((child) => {
    const token = Object.keys(names).find((name) => child.semanticKey.includes(name));
    if (token === undefined) return [];
    const metrics = child.metrics ?? {};
    const facts = [
      ...(known(metrics.occurrenceCount) ? [fact("Achats observés", text(metrics.occurrenceCount))] : []),
      ...(known(metrics.typicalPrice) ? [fact("Prix typique", euro(metrics.typicalPrice))] : []),
      ...(known(metrics.medianGapDays) && Number(metrics.medianGapDays) > 0 ? [fact("Rythme médian", `${integer.format(Number(metrics.medianGapDays))} jours`)] : []),
    ];
    return facts.length === 0 ? [] : [{ title: names[token], facts }];
  });
  return items.length === 0 ? undefined : { key: "beauty", title: "Beauté & soins", description: "Des besoins et gestes observés, avec leur rythme propre.", facts: [], items };
}

function needBlock(index: PublishedPersonaDetailIndex | undefined, labels: PersonaDirectLabels, details: ReadonlyMap<string, GlobalExpandedReadModel>, pattern: RegExp, kind: "vape" | "meal"): PersonaDirectBlock | undefined {
  const match = needBlocks(index, labels).find(({ name }) => pattern.test(name));
  const detail = detailFor(match?.block.detailRefs[0], details);
  if (match === undefined || detail === undefined) return undefined;
  const period = metric(detail, "detail:annual-amount");
  const month = metric(detail, "detail:current-amount");
  const months = metric(detail, "detail:active-months");
  const facts = [
    ...(period === undefined ? [] : [fact("Observé sur la période", period)]),
    ...(month === undefined ? [] : [fact("Mois cible", month)]),
    ...(months === undefined ? [] : [fact("Présence observée", months)]),
  ].slice(0, 3);
  if (facts.length === 0) return undefined;
  return { key: kind, title: kind === "vape" ? "Vape" : "Repas au travail", description: kind === "vape" ? "Le besoin Vape, distinct du tabac, tel qu’observé." : "Un besoin lié aux journées de travail.", facts, items: [] };
}

function mobilityBlock(profile: Profile, index: PublishedPersonaDetailIndex | undefined, details: ReadonlyMap<string, GlobalExpandedReadModel>): PersonaDirectBlock | undefined {
  const detail = detailFor(refFor(index, "mobility:work-commute"), details);
  const days = metric(detail, "distinct-day-count"), distance = metric(detail, "distance-km"), fuel = metric(detail, "estimated-fuel-cost");
  if (days === undefined || distance === undefined || fuel === undefined) return undefined;
  const car = profile.featuredTraits.some((trait) => trait.semanticKey.startsWith("mobility.work.") && trait.qualifications?.includes("CAR"));
  return { key: "work-mobility", title: "Trajets de travail", description: car ? "La voiture structure une partie de ses journées de travail." : "Des trajets observés structurent une partie de ses journées de travail.", facts: [fact("Journées observées", days), fact("Distance parcourue", distance), fact("Carburant utilisé · coût estimé", fuel)], items: [] };
}

function socialBlock(index: PublishedPersonaDetailIndex | undefined, details: ReadonlyMap<string, GlobalExpandedReadModel>): PersonaDirectBlock | undefined {
  const family = detailFor(refFor(index, "mobility:family-visit:without-household-partner-confirmed"), details);
  const friendConfirmed = detailFor(refFor(index, "mobility:friend-visit:without-household-partner-confirmed"), details);
  const friend = friendConfirmed ?? detailFor(refFor(index, "mobility:friend-visit"), details);
  const items = [
    ...(family === undefined ? [] : [{ title: "Famille · de son côté", facts: [
      ...(metric(family, "event-count") === undefined ? [] : [fact("Événements confirmés", metric(family, "event-count")!)]),
      ...(metric(family, "distance-km") === undefined ? [] : [fact("Distance", metric(family, "distance-km")!)]),
      ...(metric(family, "estimated-fuel-cost") === undefined ? [] : [fact("Carburant utilisé · coût estimé", metric(family, "estimated-fuel-cost")!)]),
    ] }]),
    ...(friend === undefined ? [] : [{ title: friendConfirmed === undefined ? "Amis · visites observées" : "Amis · de son côté", facts: [
      ...(metric(friend, "event-count") === undefined ? [] : [fact("Événements", metric(friend, "event-count")!)]),
      ...(metric(friend, "distance-km") === undefined ? [] : [fact("Distance", metric(friend, "distance-km")!)]),
      ...(metric(friend, "estimated-fuel-cost") === undefined ? [] : [fact("Carburant utilisé · coût estimé", metric(friend, "estimated-fuel-cost")!)]),
    ] }]),
  ].filter((item) => item.facts.length > 0);
  return items.length === 0 ? undefined : { key: "social", title: "Famille & amis", description: "Des déplacements associés à des visites, présentés séparément selon leur contexte.", facts: [], items };
}

function creativeBlock(profile: Profile): PersonaDirectBlock | undefined {
  const creative = profile.featuredTraits.find((trait) => trait.semanticKey === "universe.creative_projects");
  if (creative === undefined) return undefined;
  const labels: Readonly<Record<string, string>> = { PHOTO: "Photo", MUSIC: "Musique", HOME_STUDIO: "Home studio" };
  const items = (creative.qualifications ?? []).flatMap((value) => labels[value] === undefined ? [] : [{ title: labels[value], facts: [] }]);
  return { key: "creative", title: "Projets créatifs", description: "Plusieurs pratiques personnelles réunies dans un même univers.", facts: [], items };
}

function permitBlock(profile: Profile): PersonaDirectBlock | undefined {
  return profile.featuredTraits.some((trait) => trait.semanticKey.startsWith("driving_license."))
    ? { key: "permit", title: "Permis de conduire", description: "Un projet personnel en cours.", facts: [], items: [] }
    : undefined;
}

function add<T>(entry: T | undefined): readonly T[] { return entry === undefined ? [] : [entry]; }

/** Composition runs outside React. Only published profiles, indexes and bounded owner details enter. */
export function buildPersonaDirectModel(input: {
  readonly overview: GlobalExpandedReadModel;
  readonly indices: readonly PublishedPersonaDetailIndex[];
  readonly details: ReadonlyMap<string, GlobalExpandedReadModel>;
  readonly labels: PersonaDirectLabels;
  readonly ownerDetailResolutionsInitial: number;
  readonly serverBuildMs: number;
}): PersonaDirectModel {
  const names = new Map(input.overview.rows.flatMap((row) => row.entityRef?.startsWith("person:") ? [[row.entityRef.slice(7), row.labelKey.split(" · ")[0]!]] : []));
  const profiles = personalProfiles(input.overview).slice(0, 2).map((profile): PersonaDirectProfile => {
    const personId = String(profile.subject.personId);
    const index = indexFor(input.indices, personId);
    const beauty = beautyBlock(profile);
    const recurring = [
      ...add(serviceBlock(profile, index, input.details)),
      ...add(beauty),
      ...add(needBlock(index, input.labels, input.details, /vape|cigarette électronique/iu, "vape")),
    ];
    const daily = [
      ...add(mobilityBlock(profile, index, input.details)),
      ...add(needBlock(index, input.labels, input.details, /repas du midi au travail/iu, "meal")),
      ...add(socialBlock(index, input.details)),
    ];
    const phases = [...add(creativeBlock(profile)), ...add(permitBlock(profile))];
    return { personId, name: names.get(personId) ?? "Profil personnel", daily, recurring, phases };
  });
  return { version: "persona-direct-portrait@v1", profiles, ownerDetailResolutionsInitial: input.ownerDetailResolutionsInitial, serverBuildMs: input.serverBuildMs };
}

export function personaDirectDetailKey(ref: PersonaOwnerDetailRef): string { return refKey(ref); }
