const PURCHASE_AWARE = "global_food_rhythm@v2-purchase-aware";
const LEGACY = "global_food_rhythm@v1";

export async function readActiveGlobalFoodAuthority(client, householdId) {
  const { data: publications, error: publicationError } = await client.from("analytics_publications")
    .select("publication_id,source_revision,published_analytics_revision")
    .eq("household_id", householdId).eq("scope_kind", "global").eq("status", "published")
    .order("published_analytics_revision", { ascending: false }).limit(1);
  if (publicationError) throw publicationError;
  if (publications?.length !== 1) return null;
  const publication = publications[0];
  const { data: snapshot, error: snapshotError } = await client.from("analytics_query_snapshots")
    .select("payload").eq("publication_id", publication.publication_id)
    .eq("resource", "analysis_global_background_rhythms")
    .eq("is_active", true).is("invalidated_at", null).single();
  if (snapshotError) throw snapshotError;
  const methodVersion = snapshot?.payload?.food?.methodVersion;
  if (methodVersion !== LEGACY && methodVersion !== PURCHASE_AWARE) {
    throw new TypeError("GLOBAL_ACTIVE_FOOD_METHOD_UNKNOWN");
  }
  return { sourceRevision: Number(publication.source_revision), methodVersion };
}

export function selectGlobalFoodBackgroundVisibility(requestedVisibility, activeFood, sourceRevision) {
  return activeFood?.sourceRevision === Number(sourceRevision) && activeFood.methodVersion === PURCHASE_AWARE
    ? "PURCHASE_AWARE_PILOT"
    : requestedVisibility;
}

export function assertGlobalFoodAuthorityMonotonicity(activeFood, sourceRevision, candidateMethodVersion) {
  if (activeFood?.sourceRevision === Number(sourceRevision) && activeFood.methodVersion === PURCHASE_AWARE
    && candidateMethodVersion !== PURCHASE_AWARE) {
    throw new TypeError("GLOBAL_FOOD_AUTHORITY_DOWNGRADE_REQUIRES_EXPLICIT_ROLLBACK");
  }
}
