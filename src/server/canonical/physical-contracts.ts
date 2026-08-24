import "server-only";

export type TaxonomyTable = "categories" | "subcategories";

export const taxonomyPhysicalMappings = Object.freeze({
  categories: {
    physicalTable: "categories",
    idColumn: "category_id",
    keyColumn: "category_key",
    labelColumn: "nom_canonique",
  },
  subcategories: {
    physicalTable: "subcategories",
    idColumn: "subcategory_id",
    keyColumn: "subcategory_key",
    labelColumn: "nom_canonique",
  },
} as const satisfies Record<
  TaxonomyTable,
  {
    readonly physicalTable: TaxonomyTable;
    readonly idColumn: string;
    readonly keyColumn: string;
    readonly labelColumn: "nom_canonique";
  }
>);

export function taxonomySelection(table: TaxonomyTable): string {
  const mapping = taxonomyPhysicalMappings[table];
  return table === "categories"
    ? [mapping.idColumn, mapping.keyColumn, mapping.labelColumn].join(",")
    : [
        mapping.idColumn,
        taxonomyPhysicalMappings.categories.idColumn,
        mapping.keyColumn,
        mapping.labelColumn,
      ].join(",");
}

export const activityOccurrenceLifeEventTypeSelection =
  "life_event_type_id,type_key,can_span_days,active";
