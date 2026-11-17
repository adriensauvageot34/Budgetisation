import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { indexMerchantActivities } from "@/core/identity/merchant-activity";

export async function readMerchantActivities(client: SupabaseClient, keys: readonly string[]) {
  if (!keys.length) return indexMerchantActivities([]);
  const { data, error } = await client.from("merchant_activities")
    .select("activity_key,label,sector,badge_category").in("activity_key", keys);
  if (error || !data) throw new TypeError("MERCHANT_ACTIVITIES_UNAVAILABLE");
  return indexMerchantActivities(data);
}
