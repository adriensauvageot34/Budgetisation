type BasketCatalogEntry = Readonly<{
  visualConceptId: string; label: string;
  discovery: Readonly<{ sourceRow?: number; family: string; nature: string; contexts: readonly string[] }>;
}>;

const food = "Courses et produits alimentaires";
const drinks = "Boissons";
const clothing = "Vêtements et accessoires";
const beauty = "Beauté, cosmétiques et hygiène personnelle";
const household = "Entretien et consommables de la maison";
const technology = "Technologie, électronique et multimédia";
const retailFamilies = new Set([food, drinks, clothing, beauty, household, technology,
  "Mobilier, équipement et décoration", "Bricolage, travaux et fournitures",
  "Automobile — pièces, fluides et matériel", "Cadeaux, attentions et fournitures de fête",
  "Santé, pharmacie et matériel de soins"]);

export function isBasketCatalogProduct(entry: BasketCatalogEntry, domain: unknown): boolean {
  const { sourceRow, family, nature, contexts } = entry.discovery;
  if (!sourceRow || nature !== "ELEMENT" || !retailFamilies.has(family)) return false;
  const drinkProduct = family === drinks && !/^(verre|demi|shot|pinte|cocktail|consommation|pression)\b/iu.test(entry.label);
  if (family === drinks && !drinkProduct) return false;
  switch (domain) {
    case "groceries": return family === food || drinkProduct && contexts.includes("courses");
    case "clothing": return family === clothing;
    case "home-small": return family === household;
    case "games-digital": return family === technology;
    default: return contexts.includes("purchase") || family === food || drinkProduct;
  }
}
