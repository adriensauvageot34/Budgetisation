import type { PlanSemanticStateV1 } from "@/domain/phase2/planner/semantic-state";
import type { OfficialPlanComparisonV1 } from "@/domain/phase2/planner/official-comparison-contract";
import { componentId } from "@/domain/phase2/planner/identity";
import { SOCIAL_CONTACTS_V1 } from "@/domain/phase2/planned-rules";
import { plannedAsset } from "@/domain/phase2/planned-assets";
import { money, quantityLabel } from "./composer/display";
import styles from "./applied-month.module.css";

export const record = (value: unknown): Record<string, unknown> | null => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
export const contextLabels: Readonly<Record<string, string>> = { activity: "Activité", restaurant: "Restaurant", "fast-food": "Restauration rapide", delivery: "Livraison", purchase: "Achat", gift: "Cadeau", "short-stay": "Week-end / séjour", "family-visit": "Visite familiale", "friend-visit": "Visite amicale", "night-out": "Soirée", "beauty-restock": "Réapprovisionnement beauté", "home-project": "Projet maison", "other-context": "Autre intention", "kernel.generic": "Dépense prévue" };
type Context = PlanSemanticStateV1["contexts"][number];
type Persons = readonly { personId: string; displayName: string }[];
type Places = readonly import("@/domain/phase2/planned-places").PlannedPlaceOption[];
export const contextLabel = (context: Context) => typeof context.fields.label === "string" && context.fields.label.trim()
  ? context.fields.label : contextLabels[context.templateKey] ?? "Moment du Plan";
const personLabel = (value: unknown, persons: Persons) => {
  const ref = record(value);
  return ref?.kind === "HOUSEHOLD_PERSON" ? persons.find(person => person.personId === ref.personId)?.displayName ?? "Personne du foyer à préciser"
    : ref?.kind === "CONTACT" ? SOCIAL_CONTACTS_V1.find(contact => contact.key === ref.contactKey)?.label ?? "Contact à préciser"
    : ref?.kind === "TEXT" && typeof ref.label === "string" ? ref.label : "À préciser";
};
const fieldLabels: Readonly<Record<string, string>> = { plannedDate: "Date", endDate: "Retour / fin", participantRefs: "Personnes concernées",
  personVisitedRef: "Proche visité", recipientRef: "Destinataire", placeRef: "Lieu", destinationRef: "Destination",
  occasion: "Occasion", objectLabel: "Objet", objectAssetRef: "Type d’objet", productLabel: "Produit", merchantLabel: "Commerce",
  timingNote: "Repère de temps", nightCount: "Nuits", lodgingKind: "Hébergement", budgetDomain: "Enveloppe" };
const slotLabels: Readonly<Record<string, string>> = { meal: "Repas", extras: "Compléments", transport: "Transport", main: "Activité / entrée",
  hospitality: "Contribution", activities: "Activités", item: "Cadeau", before: "Avant la soirée", food: "Repas", outbound: "Aller",
  return: "Retour", lodging: "Hébergement", groceries: "Courses du séjour", restaurants: "Restaurants", purchases: "Achats",
  products: "Produits et besoins", items: "Équipements", services: "Services", components: "Contributions", children: "Moments liés", primary: "Dépense" };
const choices: Readonly<Record<string, string>> = { clothing: "Vêtements", "home-small": "Maison", "games-digital": "Jeux et numérique", other: "Autre",
  RELATIVE: "Chez un proche", HOTEL: "Hôtel", HOSTEL: "Auberge", RENTAL: "Location", OTHER: "Autre", LATER: "À préciser" };
const fieldValue = (key: string, value: unknown, persons: Persons, places: Places): string => {
  if (value === null || value === undefined || value === "") return key === "plannedDate" || key === "endDate" ? "Non fixée" : "À préciser";
  if (key === "participantRefs" && Array.isArray(value)) return value.length ? value.map(ref => personLabel(ref, persons)).join(", ") : "À préciser";
  if (["personVisitedRef", "recipientRef"].includes(key)) return personLabel(value, persons);
  const ref = record(value);
  if (key === "objectAssetRef" && typeof ref?.assetKey === "string") return plannedAsset(ref.assetKey)?.label ?? `${String(ref.labelAtSelection ?? "Objet")} · référence indisponible`;
  if (ref?.kind === "TEXT" && typeof ref.label === "string") return ref.label;
  if (ref?.kind === "KNOWN") return places.find(place => place.placeId === ref.placeId)?.name ?? "Lieu lié indisponible";
  if ((key === "plannedDate" || key === "endDate") && typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value))
    return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
  return typeof value === "string" || typeof value === "number" ? choices[String(value)] ?? String(value) : "Information conservée dans le détail avancé";
};
const fundingLabel = (value: unknown) => {
  const parts = Array.isArray(value) ? value.map(record).filter((part): part is Record<string, unknown> => part !== null) : [];
  return parts.length ? parts.map(part => `${part.source === "BANK" ? "Banque" : String(part.source)} : ${money(part.amount)}`).join(" · ") : "Financement à préciser";
};
export function coverageLabel(effect: OfficialPlanComparisonV1["components"][number]["effect"]): string {
  if (effect.slotRelation === "UNRESOLVED") return "Lien avec une enveloppe à préciser";
  if (effect.grossAmount === null) return "Coût à préciser · informations déjà connues conservées";
  if (effect.incrementalAmount === null) return "Couverture de l’enveloppe à préciser";
  if (effect.slotRelation === "CONSUMES_SLOT" && effect.economicRelation === "DISPLACEMENT" && effect.incrementalAmount === "0.00")
    return "Inclus dans l’enveloppe · aucun supplément établi dans ce scénario";
  if (effect.slotRelation === "CONSUMES_SLOT") return effect.displacedAmount === "0.00" ? "Capacité déjà utilisée · supplément dans ce scénario" : "Remplace une partie de l’enveloppe · effet lié aux autres choix";
  return "Dépense prévue en supplément";
}

/** Read-only business detail, reusing semantic fields and the Compiler's component effects.
 * No multiplication, sum, financial evaluation, network call or mutation. */
export function AppliedPlanDetail({ context, state, comparison, persons = [], places = [], ancestors = [] }: {
  context: Context; state: PlanSemanticStateV1; comparison?: OfficialPlanComparisonV1; persons?: Persons; places?: Places; ancestors?: readonly string[];
}) {
  if (ancestors.includes(context.contextOccurrenceId)) return <p>Relation de moments à vérifier dans Composer.</p>;
  const lineage = [...ancestors, context.contextOccurrenceId];
  const children = state.contexts.filter(child => child.parentContextOccurrenceId === context.contextOccurrenceId);
  return <div className={styles.businessDetail} data-plan-context-detail={context.contextOccurrenceId}>
    <dl className={styles.facts}>{Object.entries(context.fields).filter(([key]) => key in fieldLabels).map(([key, value]) =>
      <div key={key}><dt>{fieldLabels[key]}</dt><dd>{fieldValue(key, value, persons, places)}</dd></div>)}</dl>
    {Object.entries(context.slotSelections).map(([slot, raw]) => {
      const items = Array.isArray(raw.items) ? raw.items.map(record).filter((item): item is Record<string, unknown> => item !== null)
        : raw.cost ? [{ ...raw, kind: "COMPONENT", label: contextLabel(context), selectionId: "single" }] : [];
      if (!items.length) return null;
      return <section key={slot} className={styles.partGroup}><h3>{slotLabels[slot] ?? "Choix conservé"}</h3><ul>
        {items.map((item, index) => {
          const selection = String(item.selectionId ?? index), cost = record(item.cost), pricing = record(item.pricing);
          if (item.kind === "CHILD_CONTEXT") return <li key={selection}>Moment rattaché : {contextLabel(state.contexts.find(child => child.contextOccurrenceId === item.childContextOccurrenceId) ?? context)}</li>;
          if (item.provenance === "PERSONAL_SUGGESTION") return <li key={selection}>{String(item.label ?? "Proposition")} · suggestion non retenue</li>;
          if (item.kind === "UNRESOLVED") return <li key={selection}>Choix à préciser</li>;
          if (item.kind === "MOBILITY_INTENT") {
            const shared = record(item.journey)?.relation === "SHARES_JOURNEY";
            return <li key={selection}><strong>{({ car: "Voiture", train: "Train", bus: "Bus", taxi: "Taxi", free: "À pied / gratuit" } as Record<string, string>)[String(item.optionKey)] ?? "Déplacement"}</strong>
              <p>{shared ? "Trajet partagé · coût porté une seule fois par le trajet lié" : "Trajet propre · voir les déplacements du Plan"}{item.returnRequired === true ? " · aller-retour" : ""}</p>
              {typeof item.plannedTime === "string" && <p>Départ : {item.plannedTime}{item.returnTime ? ` · retour : ${String(item.returnTime)}` : ""}</p>}
              {!shared && <p>{fundingLabel(pricing?.fundingAllocations)}</p>}
              {!!record(item.route)?.vehicleRef && <p>Véhicule choisi : {String(record(record(item.route)?.vehicleRef)?.labelAtSelection ?? "À préciser")}</p>}
            </li>;
          }
          const id = componentId(context.contextOccurrenceId, slot, selection);
          const component = comparison?.components.find(row => row.effect.componentId === id);
          const lodging = record(item.lodgingPricing), product = record(item.productAssetRef);
          return <li key={selection} data-plan-component={component?.effect.componentId}>
            <div className={styles.partHeading}><strong>{String(item.label ?? "Contribution")}</strong><span>{component ? money(component.effect.grossAmount) : cost?.kind === "UNKNOWN" ? "Prix à préciser" : "Total non établi"}</span></div>
            <p>{component && coverageLabel(component.effect)}</p>
            <p>{cost?.kind === "MANUAL" ? `${money(cost.unitAmount)} par unité · déclaré` : cost?.kind === "QUOTE" ? "Prix issu d’un devis conservé" : "Prix inconnu"}
              {item.quantity !== undefined ? ` · quantité ${quantityLabel(item.quantity)}` : ""}{item.unitBasis === "PERSON" ? " · par personne" : item.unitBasis === "SHARED" ? " · budget partagé" : ""}</p>
            {item.quantityPerPerson !== undefined && <p>{String(item.quantityPerPerson)} par personne × {String(item.pricedParticipantCount)} personnes · {String(item.quantity)} unités conservées</p>}
            {lodging && <p>{lodging.basis === "PER_NIGHT" ? `Tarif par nuit · ${lodging.nightCount ?? "nombre de nuits inconnu, total inconnu"}` : "Budget total d’hébergement"}</p>}
            {product && <p>Objet : {String(product.labelAtSelection ?? "À préciser")}</p>}
            <p>{fundingLabel(item.fundingAllocations)}</p>
            {component && component.effect.displacedAmount !== null && component.effect.slotRelation === "CONSUMES_SLOT" && <p>Montant déjà couvert : {money(component.effect.displacedAmount)} · supplément du composant : {money(component.effect.incrementalAmount)}</p>}
          </li>;
        })}
      </ul></section>;
    })}
    {children.map(child => <details key={child.contextOccurrenceId} className={styles.childDetail} data-plan-child={child.contextOccurrenceId}>
      <summary>{contextLabel(child)}</summary><AppliedPlanDetail context={child} state={state} comparison={comparison} persons={persons} places={places} ancestors={lineage} />
    </details>)}
    <details className={styles.advanced}><summary>Données conservées et provenance</summary>
      <pre>{JSON.stringify({ fields: context.fields, selections: context.slotSelections,
        evidence: comparison?.components.filter(row => row.contextOccurrenceId === context.contextOccurrenceId).map(row => ({ componentId: row.effect.componentId, sources: row.effect.evidenceRefs, costBasis: row.costBasis })) }, null, 2)}</pre>
    </details>
  </div>;
}
