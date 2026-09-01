import type { PublicationMeta } from "@/core/history-v2";

type PublicationCoherenceMeta = Pick<
  PublicationMeta,
  "publicationId" | "revision" | "factsHash"
>;

export function publicationCoherenceKey(meta: PublicationCoherenceMeta): string {
  return JSON.stringify({
    publicationId: meta.publicationId,
    revision: meta.revision,
    factsHash: meta.factsHash,
  });
}

export function publicationMetasAreCoherent(
  metas: readonly (PublicationCoherenceMeta | undefined)[],
): boolean {
  if (metas.length === 0 || metas.some((meta) => meta === undefined)) return false;
  return new Set(metas.map((meta) => publicationCoherenceKey(meta!))).size === 1;
}
