import { isServiceContext, presetForContext } from "./composer-presets";
import type { PlannedContextState } from "./semantic-state";
import type { ComposerUiModel } from "./composer-ui-contract";
import { derivePlannedPlaceRoles } from "../planned-place-rules";
import { parseNightOutVenue, sameVenuePlace } from "./night-out-venue";
import type { ProspectivePlaceRef } from "../planned-contract";
import { commerceAnchor, type BadgeAnchor, type BadgeCategory, type BadgeIdentity } from "../commerce-media";
import { contextBadgeSuggestions } from "./commerce-badge-profiles";

export type CommerceContext = Pick<PlannedContextState, "templateKey" | "fields"> & Partial<Pick<PlannedContextState, "contextOccurrenceId">> & { label?: string };
export type CommerceBadge = Readonly<{ kind: "platform" | "salon" | "restaurant" | "bar" | "place" | "merchant" | "seller";
  text: string; label: string; category?: BadgeCategory; identity?: BadgeIdentity; anchor?: BadgeAnchor; custom?: boolean;
  suggestedKeys?: readonly string[]; merchantSuggestionKeys?: readonly string[]; cardLabel?: string }>;
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const categories: Readonly<Record<string, BadgeCategory>> = {
  GROCERY: "GROCERIES", RESTAURANT: "RESTAURANT", FAST_FOOD: "RESTAURANT", BAR: "BAR",
  HAIRDRESSER: "HAIRDRESSER", BEAUTY_RETAIL: "BEAUTY", CLOTHING_RETAIL: "CLOTHING", HOME_EQUIPMENT: "HOME", ACTIVITY: "ACTIVITY",
};

/** M09's explicit identities and published roles. Labels never resolve an enterprise. */
export function commerceBadges(context: CommerceContext, places: NonNullable<ComposerUiModel["mobilityOptions"]>["places"] = []): readonly CommerceBadge[] {
  const { fields, contextOccurrenceId: id } = context;
  const preset = presetForContext(context)?.presetKey;
  const badges: CommerceBadge[] = [];
  if (preset === "amazon-purchase") badges.push({ kind: "platform", label: "Amazon", text: "Plateforme · Amazon",
    category: "SHOP", identity: { key: "platform:amazon", label: "Amazon" } });
  const seller = text(fields.merchantLabel);
  if (seller && !(preset === "amazon-purchase" && seller.toLocaleLowerCase("fr") === "amazon"))
    badges.push({ kind: "seller", label: seller, text: `Vendeur déclaré · ${seller}`, anchor: commerceAnchor(id, "seller", seller) });
  const provider = isServiceContext(context) ? text(fields.providerLabel) : "";
  if (provider) badges.push({ kind: "seller", label: provider, text: `Prestataire déclaré · ${provider}`,
    category: preset === "hairdresser-service" ? "HAIRDRESSER" : undefined, anchor: commerceAnchor(id, "provider", provider) });
  const ref = fields.placeRef as ProspectivePlaceRef | undefined;
  if (ref?.kind === "KNOWN") {
    const place = places.find(candidate => candidate.placeId === ref.placeId && !candidate.privatePlace);
    if (place) {
      const roles = derivePlannedPlaceRoles(place);
      const categorySet = new Set(roles.flatMap(role => categories[role] ? [categories[role]] : []));
      const category = categorySet.size === 1 ? [...categorySet][0] : undefined;
      const [kind, role] = isServiceContext(context) && roles.includes("HAIRDRESSER") ? ["salon", "Salon"]
        : context.templateKey === "restaurant" && roles.includes("RESTAURANT") ? ["restaurant", "Restaurant"]
          : preset === "bar-apero" && roles.includes("BAR") ? ["bar", "Bar"] : ["place", "Établissement"];
      badges.push({ kind: kind as CommerceBadge["kind"], label: place.name, text: `${role} · ${place.name}`,
        category, identity: place.confirmedMerchant?.name === place.name
          ? { key: "merchant:" + place.confirmedMerchant.id, label: place.confirmedMerchant.name }
          : { key: "place:" + place.placeId, label: place.name } });
      if (place.confirmedMerchant && place.confirmedMerchant.name !== place.name) badges.push({ kind: "merchant", label: place.confirmedMerchant.name,
        text: `Commerçant associé · ${place.confirmedMerchant.name}`, category,
        identity: { key: "merchant:" + place.confirmedMerchant.id, label: place.confirmedMerchant.name } });
    }
  } else if (ref?.kind === "TEXT" && text(ref.label)) {
    const venue = preset === "bar-apero" && fields.venueDecision ? parseNightOutVenue(fields.venueDecision) : null;
    const googleBar = venue && sameVenuePlace(ref, venue.place) && !!venue.google;
    badges.push({ kind: googleBar ? "bar" : "place", label: ref.label,
      text: googleBar ? `Bar sélectionné · ${ref.label}` : `Lieu saisi · ${ref.label}`,
      category: googleBar ? "BAR" : undefined, anchor: commerceAnchor(id, "place", ref) });
  }
  const suggestedKeys = contextBadgeSuggestions(context);
  if (!badges.length && id && suggestedKeys.length) badges.push({
    kind: "seller", label: "Badge de la carte", text: "Badge de la carte", custom: true,
    anchor: commerceAnchor(id, "seller", { kind: "card-badge", templateKey: context.templateKey }),
  });
  return badges.map(badge => ({ ...badge, suggestedKeys,
    merchantSuggestionKeys: preset === "bar-apero" ? suggestedKeys.filter(key => key !== "categories:cafe") : undefined,
    cardLabel: context.label ?? presetForContext(context)?.label ?? "cette carte",
    anchor: badge.anchor ?? commerceAnchor(id, badge.kind === "platform" ? "provider" : badge.kind === "merchant" ? "seller" : "place", badge.identity?.key ?? badge.label) }));
}
