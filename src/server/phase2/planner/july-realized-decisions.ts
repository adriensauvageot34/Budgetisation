import "server-only";
import type { RealizedPlace } from "./realized-places";

export type JulyParticipant = "Adrien" | "Manon" | "Couple" | "Manon et son père";

export function julyPaymentParticipant(input: {
  merchant: string; bankLabel: string; subcategory: string; fixed: boolean; place?: RealizedPlace;
}): JulyParticipant | undefined {
  const { merchant, subcategory, fixed, place, bankLabel } = input;
  const suffix = subcategory.split("__").at(-1);
  if (merchant === "grand_frais") {
    if (/3056.*m[eé]hul/iu.test(place?.address ?? "")) return "Manon";
    if (/321.*fr[eê]che/iu.test(place?.address ?? "")) return "Adrien";
    return "Couple";
  }
  if (suffix === "titres_restaurant") return /\bswile\b/iu.test(bankLabel) ? "Adrien"
    : /\bedenred\b/iu.test(bankLabel) ? "Manon" : undefined;
  if (["carburant", "pieces_entretien_automobile", "assurance_automobile"].includes(suffix ?? "")
    || /^(croc_au_bain|cercle_de_la_vap|disney|fia_littoral.*|henri_dumas.*|max|sephora|cent_administ_andre_benech)$/u.test(merchant)
    || /vape|cigarette_electronique/u.test(suffix ?? "") || merchant === "amazon" && suffix === "epilation") return "Manon";
  if (["alertes_sms", "coiffure"].includes(suffix ?? "")
    || /^(digital_learning_contest|ornikar(?:_alma)?|delacrem|le_petit_nice|qobuz|pharmacie_polygone|openai|dgfip|dbha_coiff)$/u.test(merchant)) return "Adrien";
  if (suffix === "cannabis") return /plan cabanne?s?/iu.test(bankLabel) ? "Adrien" : "Couple";
  if (fixed || ["courses_alimentaires", "bureau_de_tabac_presse"].includes(suffix ?? "")
    || /^(chicken_place|la_petrisane|pacifica|google_one|sfr)$/u.test(merchant)) return "Couple";
}

export function julyEventParticipant(type: string, title: string, names: readonly string[], sameFamilyArea: boolean, hour?: number): JulyParticipant | undefined {
  if (type === "deplacement_pro" || /h[oô]pital arnaud/iu.test(title)) return "Manon";
  if (/lac du salagou/iu.test(title)) return "Manon et son père";
  if (/chez lucas|sortie [àa] sète|kayak|sortie au jam|comptoir de l[’']arc/iu.test(title)) return "Couple";
  if (type === "visite_famille" && /servian|fontès/iu.test(title)) return sameFamilyArea || names.includes("Adrien") ? "Couple" : "Manon";
  if (type === "repas_restaurant" && hour !== undefined && hour >= 18) return "Couple";
  if (names.includes("Adrien") && names.includes("Manon")) return "Couple";
  if (names.includes("Adrien")) return "Adrien";
  if (names.includes("Manon")) return "Manon";
}
