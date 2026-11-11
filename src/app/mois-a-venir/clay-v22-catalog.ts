/** Future Library media, fetched only by a consumer that explicitly requests the catalogue.
 * This file is deliberately not imported by the current Composer entry point.
 * Entries describe illustrations, never admissible purchases, capabilities or owners. */
export type ClayCatalogEntry = Readonly<{
  visualConceptId: string; label: string; priority: 'P0' | 'P1' | 'P2'; nativeRatio: string; sourceSHA256: string;
  roles: Readonly<Record<string, {path: string; dimensions: readonly number[]; bytes: number; sha256: string; source: string}>>;
}>;
type Collection = Readonly<{schema: 'clay-v22-collection@1'; entries: readonly ClayCatalogEntry[]}>;
export const CLAY_V22_COLLECTION_URL = '/planned-visuals/builder/clay/v22/collection.json';
let pending: Promise<Collection> | undefined;

export function loadClayV22Collection(): Promise<Collection> {
  if (!pending) pending = fetch(CLAY_V22_COLLECTION_URL).then(async response => {
    if (!response.ok) throw Error('Catalogue des illustrations indisponible.');
    const value: unknown = await response.json();
    if (!value || typeof value !== 'object' || !('schema' in value) || value.schema !== 'clay-v22-collection@1'
      || !('entries' in value) || !Array.isArray(value.entries)) throw Error('Catalogue des illustrations non reconnu.');
    return value as Collection;
  }).catch(error => { pending = undefined; throw error; });
  return pending;
}

/** Uses the registered path, including P2, without deriving an identity from a filename. */
export function clayCatalogArtwork(entry: ClayCatalogEntry, role = 'primary') {
  const media = entry.roles[role] ?? entry.roles.primary;
  if (!media || !/^(primary|compact|wide|specialized)\/v22-art-(excel-\d+|extra-[a-z0-9-]+)\.webp$/.test(media.path)) return undefined;
  return {visualConceptId:entry.visualConceptId,src:`/planned-visuals/builder/clay/v22/${media.path}`,
    width:media.dimensions[0],height:media.dimensions[1]};
}
