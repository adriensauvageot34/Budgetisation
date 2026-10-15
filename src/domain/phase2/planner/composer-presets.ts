import type { PlannerJsonObject } from "./json";
import { plannerKeys, plannerRecord } from "./json";

/** Presentation recipes only. The published template/drop capability remains authoritative. */
export const COMPOSER_PRESETS = [
  { presetKey: "techno-night", label: "Soirée techno", templateKey: "night-out", categoryKey: "SOCIAL",
    illustrationKey: "techno-night", searchTerms: ["techno", "club", "musique", "soirée"],
    defaults: { label: "Soirée techno" }, questions: ["Entrée", "Boissons", "Before", "Repas", "Aller et retour"],
    guidance: "Entrée, boissons, before ou transport : ajoutez seulement ce que vous prévoyez. Une bouteille partagée reste un seul coût." },
  { presetKey: "uber-eats-order", label: "Uber Eats", templateKey: "delivery", categoryKey: "FOOD",
    illustrationKey: "uber-eats-order", searchTerms: ["uber", "eats", "livraison", "repas", "commande"],
    defaults: { label: "Uber Eats" }, questions: ["Participants", "Date", "Commande", "Livraison", "Enveloppe"],
    guidance: "Un repas livré, sans trajet du foyer. Le nom de cette intention ne constitue pas une référence de commerçant." },
  { presetKey: "fishing-day", label: "Journée pêche", templateKey: "activity", categoryKey: "ACTIVITY",
    illustrationKey: "fishing-day", searchTerms: ["pêche", "canne", "activité", "journée"],
    defaults: { label: "Journée pêche" }, questions: ["Participants", "Destination", "Date", "Budget", "Trajet"],
    guidance: "Prévoyez la sortie et ses frais volontaires. Aucun permis ni matériel n’est acheté automatiquement. Les compléments restent des libellés libres." },
  { presetKey: "fontes-family-visit", label: "Visite Fontès", templateKey: "family-visit", categoryKey: "VISIT",
    illustrationKey: "fontes-family-visit", searchTerms: ["fontès", "famille", "visite"],
    defaults: { label: "Visite Fontès" }, questions: ["Personne visitée", "Participants", "Lieu", "Date", "Déplacement"],
    guidance: "Choisissez le lieu exact et les personnes concernées. Aucun domicile, proche ou véhicule n’est déduit du nom Fontès." },
  { presetKey: "clothing-shopping", label: "Acheter des vêtements", templateKey: "purchase", categoryKey: "PURCHASE",
    illustrationKey: "clothing-shopping", searchTerms: ["vêtements", "shopping", "achat", "habit", "pantalon"],
    defaults: { label: "Acheter des vêtements", budgetDomain: "clothing" }, questions: ["Article", "Vendeur facultatif", "Date", "Budget", "Enveloppe"],
    guidance: "Un achat lié à l’enveloppe Vêtements. Choisissez le total ou les articles, puis seulement les frais qui ne sont pas déjà inclus." },
  { presetKey: "bar-apero", label: "Bar / Apéro", templateKey: "night-out", categoryKey: "SOCIAL",
    illustrationKey: "bar-apero", searchTerms: ["apéro","apero","bar","verre"],
    defaults: {"label":"Bar / Apéro"}, questions: ["Participants","Lieu","Boissons","Repas","Transport"],
    guidance: "Choisissez votre total ou vos consommations. Aucun verre ni déplacement n’est ajouté automatiquement." },
  { presetKey: "nightclub", label: "Boîte de nuit", templateKey: "night-out", categoryKey: "SOCIAL",
    illustrationKey: "nightclub", searchTerms: ["boîte","boite","club","danser"],
    defaults: {"label":"Boîte de nuit"}, questions: ["Entrée","Vestiaire","Consommations","Retour"],
    guidance: "Entrée, vestiaire et retour restent des choix volontaires. Une entrée n’est pas multipliée par les participants." },
  { presetKey: "friends-evening", label: "Soirée chez des amis", templateKey: "night-out", categoryKey: "SOCIAL",
    illustrationKey: "friends-evening", searchTerms: ["amis","hôte","bouteille","contribution"],
    defaults: {"label":"Soirée chez des amis"}, questions: ["Participants","Lieu de l’hôte","Contribution","Boissons","Déplacement"],
    guidance: "Précisez le lieu ou l’hôte dans vos choix. Une bouteille commune reste un seul coût ; aucun trajet n’est déduit." },
  { presetKey: "home-evening", label: "Soirée chez nous", templateKey: "night-out", categoryKey: "SOCIAL",
    illustrationKey: "home-evening", searchTerms: ["maison","chez nous","invités","apéritif"],
    defaults: {"label":"Soirée chez nous"}, questions: ["Invités","Boissons","Repas","Compléments"],
    guidance: "Ajoutez seulement les courses et boissons choisies. Aucun trajet domicile-domicile n’est créé." },
  { presetKey: "chicken-snack", label: "Snack / Chicken", templateKey: "fast-food", categoryKey: "FOOD",
    illustrationKey: "chicken-snack", searchTerms: ["snack","chicken","poulet","repas rapide"],
    defaults: {"label":"Snack / Chicken"}, questions: ["Participants","Lieu","Date","Repas","Budget"],
    guidance: "Un repas rapide avec un total ou un détail. Aucun mode sur place/livraison n’est inventé et aucun trajet n’est ajouté." },
  { presetKey: "restaurant-for-two", label: "Restaurant à deux", templateKey: "restaurant", categoryKey: "FOOD",
    illustrationKey: "restaurant-for-two", searchTerms: ["restaurant","deux","couple","dîner"],
    defaults: {"label":"Restaurant à deux"}, questions: ["Participants","Lieu","Date","Addition","Enveloppe"],
    guidance: "Choisissez les personnes explicitement. Le montant global ne se multiplie pas par leur nombre." },
  { presetKey: "hiking-nature", label: "Randonnée / Nature", templateKey: "activity", categoryKey: "ACTIVITY",
    illustrationKey: "hiking-nature", searchTerms: ["marcher","randonnée","randonnee","nature","balade"],
    defaults: {"label":"Randonnée / Nature"}, questions: ["Participants","Destination","Date","Budget","Trajet"],
    guidance: "Aucun billet, matériel ou trajet n’est ajouté sans votre choix." },
  { presetKey: "beach-day", label: "Journée plage", templateKey: "activity", categoryKey: "ACTIVITY",
    illustrationKey: "beach-day", searchTerms: ["plage","mer","baignade"],
    defaults: {"label":"Journée plage"}, questions: ["Participants","Lieu","Date","Budget","Transport"],
    guidance: "Une sortie libre, sans location ni dépense supposée." },
  { presetKey: "cinema", label: "Cinéma", templateKey: "activity", categoryKey: "ACTIVITY",
    illustrationKey: "cinema", searchTerms: ["cinéma","cinema","film","billet"],
    defaults: {"label":"Cinéma"}, questions: ["Participants","Lieu","Date","Budget"],
    guidance: "Accessible même pour une sortie rare. Aucun billet ni fréquence n’est prérempli." },
  { presetKey: "spa-relax", label: "Spa / Détente", templateKey: "activity", categoryKey: "ACTIVITY",
    illustrationKey: "spa-relax", searchTerms: ["spa","détente","massage","relax"],
    defaults: {"label":"Spa / Détente"}, questions: ["Participants","Lieu","Date","Budget"],
    guidance: "Aucune réservation n’est effectuée. Le prix reste inconnu jusqu’à votre choix." },
  { presetKey: "servian-family-visit", label: "Visite Servian", templateKey: "family-visit", categoryKey: "VISIT",
    illustrationKey: "servian-family-visit", searchTerms: ["servian","famille","visite"],
    defaults: {"label":"Visite Servian"}, questions: ["Proche","Participants","Lieu","Date","Déplacement"],
    guidance: "Choisissez la personne et le lieu exacts. Le nom Servian ne prouve ni domicile ni relation familiale." },
  { presetKey: "visit-friends", label: "Voir des amis", templateKey: "friend-visit", categoryKey: "VISIT",
    illustrationKey: "visit-friends", searchTerms: ["amis","café","visite","proche"],
    defaults: {"label":"Voir des amis"}, questions: ["Personne visitée","Participants","Lieu","Date","Compléments"],
    guidance: "Les personnes et l’hospitalité restent à préciser. Aucun coût ni déplacement automatique." },
  { presetKey: "weekend-gite", label: "Week-end / Gîte", templateKey: "short-stay", categoryKey: "TRAVEL",
    illustrationKey: "weekend-gite", searchTerms: ["weekend","week-end","gîte","gite","vacances","séjour"],
    defaults: {"label":"Week-end / Gîte"}, questions: ["Dates","Destination","Hébergement","Repas","Trajet facultatif"],
    guidance: "L’hébergement peut être un total. Aucun petit-déjeuner, taxe ou restaurant n’est ajouté ; les enfants ne doublent pas le parent." },
  { presetKey: "video-game-purchase", label: "Acheter un jeu vidéo", templateKey: "purchase", categoryKey: "PURCHASE",
    illustrationKey: "video-game-purchase", searchTerms: ["jeu","manette","console","numérique"],
    defaults: {"label":"Acheter un jeu vidéo","budgetDomain":"games-digital"}, questions: ["Article","Vendeur","Date","Budget","Enveloppe"],
    guidance: "Un achat lié au domaine Jeux/Numérique existant. Aucun jeu, prix ou matériel n’est commandé." },
  { presetKey: "amazon-purchase", label: "Amazon", templateKey: "purchase", categoryKey: "PURCHASE",
    illustrationKey: "amazon-purchase", searchTerms: ["amazon","colis","commande","achat en ligne"],
    defaults: {"label":"Amazon","merchantLabel":"Amazon"}, questions: ["Article","Vendeur","Date","Budget"],
    guidance: "Amazon est un libellé de vendeur explicitement choisi, pas une identité fournisseur certifiée. Aucun frais de livraison inventé." },
  { presetKey: "shein-purchase", label: "Shein", templateKey: "purchase", categoryKey: "PURCHASE",
    illustrationKey: "shein-purchase", searchTerms: ["shein","vêtement","pantalon","mode"],
    defaults: {"label":"Shein","merchantLabel":"Shein","budgetDomain":"clothing"}, questions: ["Article","Vendeur","Date","Budget","Enveloppe"],
    guidance: "Le vendeur est un texte déclaré et le domaine Vêtements reste soumis au Compiler. Aucun stock ou prix déduit." },
  { presetKey: "aliexpress-purchase", label: "AliExpress", templateKey: "purchase", categoryKey: "PURCHASE",
    illustrationKey: "aliexpress-purchase", searchTerms: ["aliexpress","accessoire","colis","achat en ligne"],
    defaults: {"label":"AliExpress","merchantLabel":"AliExpress"}, questions: ["Article","Vendeur","Date","Budget"],
    guidance: "Un libellé de vendeur, sans référence certifiée, taxe ni livraison automatique." },
  { presetKey: "mascara", label: "Mascara", templateKey: "beauty-restock", categoryKey: "BEAUTY",
    illustrationKey: "mascara", searchTerms: ["mascara","maquillage","cils"],
    defaults: {"label":"Mascara"}, questions: ["Date","Produit et prix","Compléments"],
    guidance: "Ajoutez le produit dans la palette puis son prix. Le contrat conserve son identité de sélection et son libellé ; aucun SKU certifié, prix, stock ou renouvellement n’est déduit." },
  { presetKey: "hair-wax", label: "Cire coiffante", templateKey: "beauty-restock", categoryKey: "BEAUTY",
    illustrationKey: "hair-wax", searchTerms: ["cire","coiffante","cheveux","coiffure"],
    defaults: {"label":"Cire coiffante"}, questions: ["Date","Produit et prix","Compléments"],
    guidance: "Produit à préciser dans la palette, avec son identité de sélection. Aucun SKU certifié, prix, cadence ou stock supposé." },
  { presetKey: "laundry-detergent", label: "Lessive", templateKey: "purchase", categoryKey: "HOME",
    illustrationKey: "laundry-detergent", searchTerms: ["lessive","linge","maison","consommable"],
    defaults: {"label":"Lessive","productLabel":"Lessive","budgetDomain":"home-small"}, questions: ["Produit","Date","Budget","Enveloppe"],
    guidance: "Un petit achat maison soumis à l’enveloppe existante. Aucun stock ni nouvelle enveloppe Lessive." },
  { presetKey: "dishwashing-liquid", label: "Liquide vaisselle", templateKey: "purchase", categoryKey: "HOME",
    illustrationKey: "dishwashing-liquid", searchTerms: ["vaisselle","éponge","évier","maison"],
    defaults: {"label":"Liquide vaisselle","productLabel":"Liquide vaisselle","budgetDomain":"home-small"}, questions: ["Produit","Date","Budget","Enveloppe"],
    guidance: "Un consommable maison, sans recommandation de stock. Le rattachement reste validé par le Compiler." },
] as const;
export type ComposerPreset = (typeof COMPOSER_PRESETS)[number];
export type ComposerPresetKey = ComposerPreset["presetKey"];
export const COMPOSER_PRESENTATION_VERSION = "composer-context-presentation@v1" as const;
export const composerPreset = (key: string) => COMPOSER_PRESETS.find(p => p.presetKey === key);
/** Single terminal visual registry: no title matching, no remote URL or legacy Builder image. */
export const presetIllustrationPath = (preset: ComposerPreset) => `/planned-visuals/composer/presets/${preset.illustrationKey}.webp`;
export function presetForContext(context: { templateKey: string; fields: PlannerJsonObject }): ComposerPreset | undefined {
  const metadata = context.fields.composerPresentation;
  if (metadata === undefined) return undefined; // Historical revisions keep their original presentation.
  const value = plannerRecord(metadata);
  plannerKeys(value, ["version", "presetKey"]);
  const preset = typeof value.presetKey === "string" ? composerPreset(value.presetKey) : undefined;
  if (value.version !== COMPOSER_PRESENTATION_VERSION || typeof value.presetKey !== "string" || !value.presetKey.trim() || preset && preset.templateKey !== context.templateKey)
    throw new TypeError("COMPOSER_PRESET_PRESENTATION_INVALID");
  // Forward-compatible reader: unknown presentation keys preserve their JSON,
  // use the generic template visual and grant no creation/edit capability.
  return preset;
}
export function presetCreationFields(templateKey: string, presetKey?: string): PlannerJsonObject {
  if (presetKey === undefined) return {};
  const preset = composerPreset(presetKey);
  if (!preset || preset.templateKey !== templateKey) throw new TypeError("COMPOSER_PRESET_CAPABILITY_MISMATCH");
  return { ...preset.defaults, composerPresentation: { version: COMPOSER_PRESENTATION_VERSION, presetKey: preset.presetKey } };
}
