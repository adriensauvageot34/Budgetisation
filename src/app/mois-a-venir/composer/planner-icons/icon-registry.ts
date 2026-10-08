import type { ComponentType } from "react";
import type { ClayIconProps } from "./clay-frame";
import { stableVisualIdentity } from "./visual-identity";
import { GroceriesIcon } from "./icons/groceries";
import { TobaccoIcon } from "./icons/tobacco";
import { MealIcon } from "./icons/meal";
import { HaircutIcon } from "./icons/haircut";
import { RestaurantIcon } from "./icons/restaurant";
import { NightOutIcon } from "./icons/night-out";
import { ClothingIcon } from "./icons/clothing";
import { ShortStayIcon } from "./icons/short-stay";
import { GiftIcon } from "./icons/gift";
import { FamilyIcon } from "./icons/family";
import { BeautyIcon } from "./icons/beauty";
import { BowlingIcon } from "./icons/bowling";
import { SavingsIcon } from "./icons/savings";
import { TicketIcon } from "./icons/ticket";
import { BeforeIcon } from "./icons/before";
import { CarIcon } from "./icons/car";
import { TramIcon } from "./icons/tram";
import { LodgingIcon } from "./icons/lodging";
import { FuelIcon } from "./icons/fuel";
import { ActivityIcon } from "./icons/activity";
import { HomeIcon } from "./icons/home";
import { CoffeeIcon } from "./icons/coffee";
import { WaxIcon } from "./icons/wax";
import { MascaraIcon } from "./icons/mascara";
import { EyelinerIcon } from "./icons/eyeliner";
import { DeliveryIcon } from "./icons/delivery";
import { FastFoodIcon } from "./icons/fast-food";
import { MobilityIcon } from "./icons/mobility";

/** The only terminal mapping from published visual keys to Clay silhouettes. */
export const iconRegistry: Readonly<Record<string, ComponentType<ClayIconProps>>> = {
  groceries: GroceriesIcon, tobacco: TobaccoIcon, meal: MealIcon, haircut: HaircutIcon,
  restaurant: RestaurantIcon, "night-out": NightOutIcon, clothing: ClothingIcon,
  "short-stay": ShortStayIcon, gift: GiftIcon, family: FamilyIcon, beauty: BeautyIcon,
  bowling: BowlingIcon, savings: SavingsIcon, ticket: TicketIcon, before: BeforeIcon,
  car: CarIcon, tram: TramIcon, lodging: LodgingIcon, fuel: FuelIcon,
  activity: ActivityIcon, home: HomeIcon, coffee: CoffeeIcon, wax: WaxIcon,
  mascara: MascaraIcon, eyeliner: EyelinerIcon, delivery: DeliveryIcon,
  "fast-food": FastFoodIcon, food: MealIcon, mobility: MobilityIcon,
};

// Published stable identities select exceptions. Labels and names never do.
const identityIcons: Readonly<Record<string, keyof typeof iconRegistry>> = {
  "adrien-work-coffee": "coffee",
  "need:cire_adrien": "wax", "need:haircare_adrien_cire": "wax",
  "need:maquillage_manon_mascara": "mascara", "renewal:manon-mascara": "mascara",
  "need:maquillage_manon_eyeliner": "eyeliner",
  "need:maquillage_manon_sourcils": "eyeliner", "renewal:manon-brows": "eyeliner",
  "mobility:FAMILY_VISIT": "mobility", "mobility:WORK": "mobility",
};

export function resolveVisualIcon(iconKey: string, identityRef?: string): ComponentType<ClayIconProps> {
  const specific = identityRef && identityIcons[stableVisualIdentity(identityRef)];
  return iconRegistry[specific ?? iconKey] ?? ActivityIcon;
}
