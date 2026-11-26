
import "server-only";
import type { BootstrapSession } from "@/server/bootstrap/auth";
import type { BootstrapHousehold, BootstrapPerson } from "@/server/bootstrap/types";
import { readCanonicalInBatches } from "@/server/canonical/in-batches";
import { BadgeLibrary } from "@/server/commerce/badge-library";
import { getCanonicalCommerceClient } from "@/server/commerce/canonical";
import { commerceBadgeImages } from "@/ui/media/commerce-illustrations";
import { householdCouplePortrait, realizedWorkPeople } from "./planner/realized-work";

type PaymentBadge = { id: string; sources: string[] };
export const savingsRecipientKey = (name: string) => name.trim().normalize("NFC").toLocaleLowerCase("fr");

export function savingsRecipientPortraits(household: BootstrapHousehold, persons: readonly BootstrapPerson[]) {
  const { portraits } = realizedWorkPeople(household, persons);
  const names = persons.map(person => ({
    name: savingsRecipientKey(person.displayName), src: portraits[person.personId],
  }));
  const aliases = new Map<string, string>();
  for (const { name, src } of names) {
    if (!src) continue;
    const first = name.split(/\s+/u)[0];
    if (names.filter(person => person.name === name).length === 1) aliases.set(name, src);
    if (first && names.filter(person => person.name.split(/\s+/u)[0] === first).length === 1) aliases.set(first, src);
  }
  const couple = householdCouplePortrait(household);
  if (couple) aliases.set("couple", couple);
  return aliases;
}

/** The operation IDs come from linked purchases already read under household RLS. */
export async function readSavingsPurchaseBadges(session: BootstrapSession, householdId: BootstrapHousehold["householdId"],
  linkedOperationIds: readonly string[]): Promise<ReadonlyMap<string, string[]>> {
  if (!linkedOperationIds.length) return new Map();
  try {
    const canonical = await getCanonicalCommerceClient(householdId);
    const library = new BadgeLibrary(session.supabase, session.user.id, async () => canonical);
    const badges = await readCanonicalInBatches<PaymentBadge>({
      values: linkedOperationIds,
      executeBatch: async ids => {
        const { data, error } = await canonical.from("operations").select("operation_id,merchant_id").in("operation_id", ids);
        if (error) throw error;
        const keys = [...new Set(data.flatMap(row => row.merchant_id ? [`merchant:${row.merchant_id}`] : []))];
        if (!keys.length) return [];
        const { merchants, media } = await library.read(keys, []);
        const byKey = new Map((merchants ?? []).map(merchant => [merchant.key, merchant]));
        const images = new Map(media.map(item => [item.key, item.imageUrl]));
        return data.flatMap(row => {
          const key = `merchant:${row.merchant_id}`;
          const merchant = byKey.get(key);
          if (merchant?.kind !== "commercial") return [];
          const sources = commerceBadgeImages({
            identityKey: key, personalSrc: images.get(key), sharedKey: merchant.visualKey,
            sharedPersonalSrc: merchant.visualKey ? images.get(merchant.visualKey) : undefined,
            policy: merchant.policy,
          }).map(item => item.src);
          return sources.length ? [{ id: String(row.operation_id), sources }] : [];
        });
      },
      rowIdentity: row => row.id, compareRows: (a, b) => a.id.localeCompare(b.id),
    });
    return new Map(badges.map(row => [row.id, row.sources]));
  } catch {
    return new Map();
  }
}
