import { Building2, MapPin, Martini, Scissors, Store, Utensils } from "lucide-react";
import type { ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import type { PlannedContextState } from "@/domain/phase2/planner/semantic-state";
import { isServiceContext, presetForContext } from "@/domain/phase2/planner/composer-presets";
import { derivePlannedPlaceRoles } from "@/domain/phase2/planned-place-rules";
import { parseNightOutVenue, sameVenuePlace } from "@/domain/phase2/planner/night-out-venue";
import type { ProspectivePlaceRef } from "@/domain/phase2/planned-contract";
import styles from "./composer.module.css";

type Context = Pick<PlannedContextState, "templateKey" | "fields">;
type Badge = Readonly<{ kind: "platform" | "salon" | "restaurant" | "bar" | "place" | "merchant" | "seller"; text: string }>;
const icons = { platform: Store, salon: Scissors, restaurant: Utensils, bar: Martini, place: MapPin, merchant: Building2, seller: Store };
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";

/** Identity comes from the selected subject and its published evidence. There is no name-to-logo lookup. */
export function commerceBadges(context: Context, places: NonNullable<ComposerUiModel["mobilityOptions"]>["places"] = []): readonly Badge[] {
  const fields = context.fields;
  const preset = presetForContext(context)?.presetKey;
  const service = isServiceContext(context);
  const badges: Badge[] = [];
  if (preset === "amazon-purchase") badges.push({ kind: "platform", text: "Plateforme · Amazon" });
  const seller = text(fields.merchantLabel);
  if (seller && !(preset === "amazon-purchase" && seller.toLocaleLowerCase("fr") === "amazon"))
    badges.push({ kind: "seller", text: `Vendeur déclaré · ${seller}` });
  const provider = service ? text(fields.providerLabel) : "";
  if (provider) badges.push({ kind: "seller", text: `Prestataire déclaré · ${provider}` });
  const ref = fields.placeRef as ProspectivePlaceRef | undefined;
  if (ref?.kind === "KNOWN") {
    const place = places.find(candidate => candidate.placeId === ref.placeId && !candidate.privatePlace);
    if (place) {
      const roles = derivePlannedPlaceRoles(place);
      const [kind, role] = service && roles.includes("HAIRDRESSER") ? ["salon", "Salon"]
        : context.templateKey === "restaurant" && roles.includes("RESTAURANT") ? ["restaurant", "Restaurant"]
          : preset === "bar-apero" && roles.includes("BAR") ? ["bar", "Bar"] : ["place", "Établissement"];
      badges.push({ kind: kind as Badge["kind"], text: `${role} · ${place.name}` });
      if (place.confirmedMerchant && place.confirmedMerchant.name !== place.name)
        badges.push({ kind: "merchant", text: `Commerçant associé · ${place.confirmedMerchant.name}` });
    }
  } else if (ref?.kind === "TEXT" && text(ref.label)) {
    const venue = preset === "bar-apero" && fields.venueDecision ? parseNightOutVenue(fields.venueDecision) : null;
    const googleBar = venue && sameVenuePlace(ref, venue.place) && !!venue.google;
    badges.push(googleBar ? { kind: "bar", text: `Bar sélectionné · ${ref.label}` }
      : { kind: "place", text: `Lieu saisi · ${ref.label}` });
  }
  return badges;
}

export function CommerceBadges({ context, model }: { context: Context; model: ComposerUiModel }) {
  const eligible = ["gift", "purchase", "restaurant", "fast-food", "night-out"].includes(context.templateKey) || isServiceContext(context);
  if (!eligible) return null;
  const badges = commerceBadges(context, model.mobilityOptions?.places);
  return badges.length ? <span className={styles.commerceBadges} aria-label="Identités et lieux">
    {badges.map(({ kind, text }) => {
      const Icon = icons[kind];
      return <span key={kind + text} className={styles.commerceBadge} data-commerce-badge={kind} title={text}>
        <Icon size={13} aria-hidden="true" /><span>{text}</span>
      </span>;
    })}
  </span> : null;
}
