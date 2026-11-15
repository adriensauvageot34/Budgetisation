import "server-only";
import { getAuthenticatedBootstrapClient } from "@/server/bootstrap/auth";
import { getCurrentHousehold } from "@/server/bootstrap/queries";
import { BootstrapAuthenticationRequiredError } from "@/server/bootstrap/errors";
import { plannerKeys, plannerRecord } from "@/domain/phase2/planner/json";
import { MAX_BADGE_BYTES } from "@/domain/phase2/commerce-media";
import { BadgeLibrary } from "./badge-library";
import { createCanonicalReadClient } from "@/server/canonical/client";
import { parseCanonicalHouseholdScope } from "@/analytics/facts/canonical";

const headers = { "Cache-Control": "private, no-store", Vary: "Cookie", "X-Content-Type-Options": "nosniff" };
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers });
async function owner() {
  const { supabase, user } = await getAuthenticatedBootstrapClient();
  const household = await getCurrentHousehold(supabase);
  if (!household) throw new TypeError("BADGE_DENIED");
  return new BadgeLibrary(supabase, user.id, async () => {
    const canonical = createCanonicalReadClient();
    const { data, error } = await canonical.from("canonical_household_scope_control").select("household_count,household_id,status").limit(2);
    if (error || data?.length !== 1 || parseCanonicalHouseholdScope(data[0]) !== String(household.householdId))
      throw new TypeError("BADGE_DENIED");
    return canonical;
  });
}
async function boundedBody(request: Request, max: number) {
  if (Number(request.headers.get("content-length") ?? 0) > max) throw new TypeError("BADGE_TOO_LARGE");
  const reader = request.body?.getReader();
  if (!reader) throw new TypeError("BADGE_REQUEST_INVALID");
  let length = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      length += next.value.length;
      if (length > max) { await reader.cancel(); throw new TypeError("BADGE_TOO_LARGE"); }
      chunks.push(next.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}

/** The only mutations concern the user's separate visual library. */
export async function badgeRequest(request: Request, kind: "COMMAND" | "UPLOAD" | "IMAGE", getOwner = owner) {
  try {
    if (kind !== "IMAGE" && request.headers.get("origin") !== new URL(request.url).origin) return reply({ code: "BADGE_DENIED" }, 403);
    const contentType = request.headers.get("content-type") ?? "";
    if (kind === "COMMAND" && contentType.split(";")[0] !== "application/json"
      || kind === "UPLOAD" && !contentType.startsWith("multipart/form-data;")) return reply({ code: "BADGE_REQUEST_INVALID" }, 415);
    const service = await getOwner();
    if (kind === "IMAGE") {
      const params = new URL(request.url).searchParams;
      const image = await service.download(params.get("identity"), Number(params.get("version")));
      return image ? new Response(image, { headers: { ...headers, "Content-Type": "image/webp" } }) : new Response(null, { status: 404, headers });
    }
    if (kind === "UPLOAD") {
      const bytes = await boundedBody(request, MAX_BADGE_BYTES + 65536);
      const body = await new Request(request.url, { method: "POST", headers: { "content-type": contentType }, body: bytes.buffer }).formData();
      if ([...body.keys()].some(key => !["identityKey", "expectedVersion", "file"].includes(key))) throw new TypeError("BADGE_REQUEST_INVALID");
      const file = body.get("file");
      if (!(file instanceof File)) throw new TypeError("BADGE_IMAGE_INVALID");
      return reply({ media: await service.image(body.get("identityKey"), Number(body.get("expectedVersion")), file) });
    }
    let raw;
    try { raw = plannerRecord(JSON.parse(new TextDecoder().decode(await boundedBody(request, 65536)))); }
    catch (error) { if (error instanceof TypeError && error.message === "BADGE_TOO_LARGE") throw error; throw new TypeError("BADGE_REQUEST_INVALID"); }
    if (raw.kind === "READ") {
      plannerKeys(raw, ["kind", "keys", "anchors"]);
      if (!Array.isArray(raw.keys) || !Array.isArray(raw.anchors)) throw new TypeError("BADGE_REQUEST_INVALID");
      return reply(await service.read(raw.keys, raw.anchors));
    }
    if (raw.kind === "SEARCH") {
      plannerKeys(raw, ["kind", "query"]);
      if (typeof raw.query !== "string") throw new TypeError("BADGE_REQUEST_INVALID");
      return reply({ identities: await service.search(raw.query) });
    }
    if (raw.kind === "CONFIRM") {
      plannerKeys(raw, ["kind", "identityKey", "newLabel", "anchor", "expectedBindingVersion"], ["kind"]);
      if ((raw.identityKey !== undefined) === (raw.newLabel !== undefined)) throw new TypeError("BADGE_REQUEST_INVALID");
      return reply({ media: await service.confirm(raw) });
    }
    if (raw.kind === "CATEGORY") {
      plannerKeys(raw, ["kind", "identityKey", "expectedVersion", "category"]);
      return reply({ media: await service.category(raw.identityKey, raw.expectedVersion, raw.category) });
    }
    if (raw.kind === "ANCHOR_CATEGORY") {
      plannerKeys(raw, ["kind", "anchor", "expectedVersion", "category"]);
      return reply({ binding: await service.anchorCategory(raw.anchor, raw.expectedVersion, raw.category) });
    }
    throw new TypeError("BADGE_REQUEST_INVALID");
  } catch (error) {
    if (error instanceof BootstrapAuthenticationRequiredError) return reply({ code: "BADGE_AUTH_REQUIRED" }, 401);
    const message = error instanceof TypeError ? error.message : "";
    if (message === "BADGE_DENIED") return reply({ code: message }, 403);
    if (message === "BADGE_CONFLICT") return reply({ code: message }, 409);
    if (message === "BADGE_TOO_LARGE") return reply({ code: message }, 413);
    if (/^(BADGE_.*INVALID|PLANNER_)/u.test(message)) return reply({ code: message }, 400);
    return reply({ code: "BADGE_LIBRARY_UNAVAILABLE" }, 503);
  }
}
