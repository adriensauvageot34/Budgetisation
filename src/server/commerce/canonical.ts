import "server-only";

import type { HouseholdId } from "@/core/identity";
import { parseCanonicalHouseholdScope } from "@/analytics/facts/canonical";
import { createCanonicalReadClient } from "@/server/canonical/client";

export async function getCanonicalCommerceClient(householdId: HouseholdId) {
  const canonical = createCanonicalReadClient();
  const { data, error } = await canonical.from("canonical_household_scope_control")
    .select("household_count,household_id,status").limit(2);
  if (error || data?.length !== 1 || parseCanonicalHouseholdScope(data[0]) !== String(householdId))
    throw new TypeError("BADGE_DENIED");
  return canonical;
}
