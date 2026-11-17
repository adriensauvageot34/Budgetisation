import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { BADGE_BUCKET, MAX_BADGE_BYTES, badgeAnchor, badgeCategory, badgeIdentityKey, badgeLabel, badgeVersion,
  type BadgeAnchor, type BadgeIdentity, type BadgeLibraryRead, type MerchantBadgeIdentity, type PersonalBadge } from "@/domain/phase2/commerce-media";
import { isNonMerchantKind, merchantBadgePolicy, merchantDisplayName, type MerchantBadgePolicy, type MerchantIdentityKind } from "@/core/identity/merchant-kind";
import { merchantBadgeCategoryFor, referencedMerchantActivities } from "@/core/identity/merchant-activity";
import { readMerchantActivities } from "./merchant-activities";
import { clayBadgeAsset } from "@/domain/phase2/commerce-badge-catalog";

type Row = { user_id: string; identity_key: string; label: string; category: PersonalBadge["category"];
  object_path: string | null; bundled_asset_key: string | null; version: number };
type BindingRow = { anchor_key: string; source_digest: string; identity_key: string | null; category: PersonalBadge["category"]; version: number };
const columns = "identity_key,label,category,object_path,bundled_asset_key,version";
const visual = (row: Row): PersonalBadge => {
  const asset = clayBadgeAsset(row.bundled_asset_key);
  return {
    key: row.identity_key, label: row.label, category: row.category, version: row.version, hasImage: !!asset || !!row.object_path,
    ...(asset ? { imageUrl: asset.src, bundledAssetKey: asset.key }
      : row.object_path ? { imageUrl: "/api/composer/badge-library/image?identity=" + encodeURIComponent(row.identity_key) + "&version=" + row.version } : {}),
  };
};
function storageError(error: unknown) {
  if (error) throw new TypeError(typeof error === "object" && "code" in error && error.code === "23505" ? "BADGE_CONFLICT" : "BADGE_LIBRARY_UNAVAILABLE");
}

/** Authenticated client and owner are obtained on the server, never from a request body. */
export class BadgeLibrary {
  constructor(private readonly client: SupabaseClient, private readonly userId: string,
    private readonly canonical: () => Promise<SupabaseClient> = async () => client) {}

  private async merchants(keys: readonly string[]): Promise<readonly MerchantBadgeIdentity[]> {
    const ids = [...new Set(keys.filter(key => key.startsWith("merchant:")).map(key => key.slice("merchant:".length)))];
    if (!ids.length) return [];
    const client = await this.canonical();
    type MerchantRow = {
      merchant_id: string; identity_kind: MerchantIdentityKind; visual_brand_merchant_id: string | null;
      commercial_display_name: string | null; generic_badge_category: string | null;
      badge_policy: MerchantBadgePolicy;
      activity_key: string; activity_review_required: boolean;
    };
    const result = await client.from("merchants")
      .select("merchant_id,identity_kind,visual_brand_merchant_id,commercial_display_name,generic_badge_category,badge_policy,activity_key,activity_review_required").in("merchant_id", ids);
    storageError(result.error);
    const rows = (result.data ?? []) as MerchantRow[];
    const targets = [...new Set(rows.flatMap(row =>
      row.identity_kind === "commercial" && row.badge_policy !== "none" && row.visual_brand_merchant_id ? [row.visual_brand_merchant_id] : []))];
    const [roots, activities] = await Promise.all([
      targets.length ? client.from("merchants").select("merchant_id").in("merchant_id", targets)
        .eq("identity_kind", "commercial").eq("badge_policy", "normal").is("visual_brand_merchant_id", null) : { data: [], error: null },
      readMerchantActivities(client, referencedMerchantActivities(rows)),
    ]);
    storageError(roots.error);
    const allowed = new Set((roots.data ?? []).map(row => row.merchant_id));
    return rows.map(row => {
      const genericCategory = merchantBadgeCategoryFor(row, activities);
      const displayName = merchantDisplayName(row);
      return {
        key: "merchant:" + row.merchant_id, kind: row.identity_kind,
        ...(row.badge_policy !== "normal" ? { policy: row.badge_policy } : {}),
        ...(displayName ? { displayName } : {}),
        ...(genericCategory ? { genericCategory } : {}),
        ...(row.badge_policy !== "none" && row.visual_brand_merchant_id && allowed.has(row.visual_brand_merchant_id)
          ? { visualKey: "merchant:" + row.visual_brand_merchant_id } : {}),
      };
    });
  }

  private async assertMerchantMediaAllowed(key: string, specific = true) {
    if (!key.startsWith("merchant:")) return;
    const [entry] = await this.merchants([key]);
    if (!entry || isNonMerchantKind(entry.kind)) throw new TypeError("BADGE_IDENTITY_INVALID");
    if (entry.policy === "none" || specific && entry.policy === "reuse_only") throw new TypeError("BADGE_POLICY_DENIED");
    return entry;
  }

  async read(keys: readonly string[], anchors: readonly BadgeAnchor[]): Promise<BadgeLibraryRead> {
    if (keys.length > 100 || anchors.length > 100) throw new TypeError("BADGE_BATCH_INVALID");
    const ids = keys.map(badgeIdentityKey), refs = anchors.map(badgeAnchor);
    const bindingsRead = refs.length ? await this.client.from("composer_badge_bindings")
      .select("anchor_key,source_digest,identity_key,category,version").eq("user_id", this.userId).in("anchor_key", refs.map(ref => ref.key))
      : { data: [], error: null };
    storageError(bindingsRead.error);
    const bindings = bindingsRead.data as BindingRow[];
    const keysToRead = [...new Set([...ids, ...bindings.flatMap(row => row.identity_key && refs.some(ref => ref.key === row.anchor_key && ref.digest === row.source_digest) ? [row.identity_key] : [])])];
    const merchants = await this.merchants(keysToRead);
    const readable = new Set(merchants.filter(row => !isNonMerchantKind(row.kind) && row.policy !== "none").map(row => row.key));
    const reuseOnly = new Set(merchants.filter(row => row.policy === "reuse_only").map(row => row.key));
    const wanted = [...new Set([
      ...keysToRead.filter(key => !key.startsWith("merchant:") || readable.has(key)),
      ...merchants.flatMap(row => row.visualKey ? [row.visualKey] : []),
    ])];
    const media = wanted.length ? await this.client.from("composer_badge_visuals").select(columns).eq("user_id", this.userId).in("identity_key", wanted)
      : { data: [], error: null };
    storageError(media.error);
    const rows = (media.data as Row[]).map(row => reuseOnly.has(row.identity_key)
      ? { ...row, object_path: null, bundled_asset_key: null } : row);
    const paths = rows.flatMap(row => !row.bundled_asset_key && row.object_path ? [row.object_path] : []);
    const signed = paths.length ? await this.client.storage.from(BADGE_BUCKET).createSignedUrls(paths, 300) : { data: [] };
    const urls = new Map((signed.data ?? []).flatMap(item => item.signedUrl ? [[item.path, item.signedUrl] as const] : []));
    return { merchants, media: rows.map(row => ({
      ...visual(row), ...(row.object_path && !row.bundled_asset_key ? { imageUrl: urls.get(row.object_path) } : {}),
    })), bindings: bindings.map(row => ({
      key: row.anchor_key, digest: row.source_digest, identityKey: row.identity_key, category: row.category, version: row.version,
    })) };
  }

  async search(query: string): Promise<readonly BadgeIdentity[]> {
    const label = badgeLabel(query);
    if (label.length < 2) return [];
    const escaped = "%" + label.replace(/[\\%_]/gu, char => "\\" + char) + "%";
    const [personal, merchants] = await Promise.all([
      this.client.from("composer_badge_visuals").select("identity_key,label").eq("user_id", this.userId)
        .not("identity_key", "like", "merchant:%").ilike("label", escaped).order("label").limit(20),
      this.canonical().then(client => Promise.all((["commercial_display_name", "nom_canonique"] as const).map(column =>
        client.from("merchants").select("merchant_id,nom_canonique,identity_kind,commercial_display_name,badge_policy")
          .eq("identity_kind", "commercial").neq("badge_policy", "none").ilike(column, escaped).order(column).order("merchant_id").limit(20),
      ))).catch(() => []),
    ]);
    storageError(personal.error);
    // A denied or unavailable Canonical search grants no identity. Private identities remain usable.
    const results = new Map<string, BadgeIdentity>();
    for (const match of merchants) {
      for (const row of match.error ? [] : match.data ?? []) {
        const key = "merchant:" + row.merchant_id;
        const policy = merchantBadgePolicy(row.badge_policy);
        results.set(key, { key, label: merchantDisplayName(row) ?? row.nom_canonique,
          ...(policy !== "normal" ? { policy } : {}) });
        if (results.size >= 20) break;
      }
      if (results.size >= 20) break;
    }
    for (const row of personal.data ?? []) results.set(row.identity_key, { key: row.identity_key, label: row.label });
    return [...results.values()];
  }

  private async row(key: string): Promise<Row | null> {
    const result = await this.client.from("composer_badge_visuals").select(columns).eq("user_id", this.userId).eq("identity_key", key).maybeSingle();
    storageError(result.error);
    return result.data as Row | null;
  }

  private async identity(key: string): Promise<BadgeIdentity> {
    if (key === "platform:amazon") return { key, label: "Amazon" };
    if (key.startsWith("personal:")) {
      const row = await this.row(key);
      if (!row) throw new TypeError("BADGE_IDENTITY_INVALID");
      return { key, label: row.label };
    }
    const client = await this.canonical(), id = key.split(":")[1];
    const result = key.startsWith("place:")
      ? await client.from("referentiel_lieu").select("nom_canonique").eq("place_id", id).eq("private_place", false).maybeSingle()
      : await client.from("merchants").select("nom_canonique,identity_kind,commercial_display_name,badge_policy")
        .eq("merchant_id", id).eq("identity_kind", "commercial").maybeSingle();
    if (result.error || !result.data) throw new TypeError("BADGE_IDENTITY_INVALID");
    const row = result.data as { nom_canonique: string; identity_kind?: string; commercial_display_name?: string; badge_policy?: string };
    const policy = merchantBadgePolicy(row.badge_policy);
    if (policy === "none") throw new TypeError("BADGE_POLICY_DENIED");
    return { key, label: badgeLabel(merchantDisplayName(row) ?? row.nom_canonique), ...(policy !== "normal" ? { policy } : {}) };
  }

  async confirm(raw: { identityKey?: unknown; newLabel?: unknown; anchor?: unknown; expectedBindingVersion?: unknown }) {
    const anchor = raw.anchor === undefined ? undefined : badgeAnchor(raw.anchor);
    if (raw.newLabel !== undefined && !anchor) throw new TypeError("BADGE_ANCHOR_INVALID");
    const version = anchor ? badgeVersion(raw.expectedBindingVersion) : 0;
    const previous = anchor ? (await this.read([], [anchor])).bindings.find(item => item.key === anchor.key) : undefined;
    if (anchor && (previous?.version ?? 0) !== version) throw new TypeError("BADGE_CONFLICT");
    const identity = raw.newLabel !== undefined ? { key: "personal:" + randomUUID(), label: badgeLabel(raw.newLabel) }
      : await this.identity(badgeIdentityKey(raw.identityKey));
    let row = await this.row(identity.key);
    if (!row) {
      const result = await this.client.from("composer_badge_visuals").insert({
        user_id: this.userId, identity_key: identity.key, label: identity.label,
      }).select(columns).maybeSingle();
      // Another explicit confirmation can have created the same canonical entry.
      if (result.error?.code === "23505") row = await this.row(identity.key);
      else { storageError(result.error); row = result.data as Row | null; }
    }
    if (!row) throw new TypeError("BADGE_LIBRARY_UNAVAILABLE");
    if (anchor) {
      const value = { user_id: this.userId, anchor_key: anchor.key, source_digest: anchor.digest, identity_key: identity.key,
        category: previous?.digest === anchor.digest ? previous.category : null, version: version + 1 };
      try {
        const result = version === 0 ? await this.client.from("composer_badge_bindings").insert(value).select("version").maybeSingle()
          : await this.client.from("composer_badge_bindings").update(value).eq("user_id", this.userId).eq("anchor_key", anchor.key)
            .eq("version", version).select("version").maybeSingle();
        storageError(result.error);
        if (!result.data) throw new TypeError("BADGE_CONFLICT");
      } catch (error) {
        // An admitted binding keeps its foreign key. Only an unreferenced new personal identity can be removed.
        if (raw.newLabel !== undefined) await this.client.from("composer_badge_visuals").delete()
          .eq("user_id", this.userId).eq("identity_key", identity.key).then(() => {}, () => {});
        throw error;
      }
    }
    return {
      ...visual(identity.policy === "reuse_only" ? { ...row, object_path: null, bundled_asset_key: null } : row),
      ...(identity.key.startsWith("merchant:") ? { label: identity.label, policy: identity.policy } : {}),
    };
  }

  private async update(key: string, version: number, patch: {
    category?: PersonalBadge["category"]; object_path?: string; bundled_asset_key?: string | null;
  }) {
    const result = await this.client.from("composer_badge_visuals").update({ ...patch, version: version + 1, updated_at: new Date().toISOString() })
      .eq("user_id", this.userId).eq("identity_key", key).eq("version", version).select(columns).maybeSingle();
    storageError(result.error);
    if (!result.data) throw new TypeError("BADGE_CONFLICT");
    return visual(result.data as Row);
  }

  async category(key: unknown, version: unknown, category: unknown) {
    const identity = badgeIdentityKey(key);
    const merchant = await this.assertMerchantMediaAllowed(identity, false);
    const media = await this.update(identity, badgeVersion(version), { category: badgeCategory(category) });
    return merchant?.policy === "reuse_only" ? { ...media, hasImage: false, imageUrl: undefined, policy: merchant.policy } : media;
  }

  async bundled(key: unknown, version: unknown, assetKey: unknown) {
    const identity = badgeIdentityKey(key);
    await this.assertMerchantMediaAllowed(identity);
    const asset = clayBadgeAsset(assetKey);
    if (assetKey !== null && (!asset || asset.type === "generic")) throw new TypeError("BADGE_ASSET_INVALID");
    return this.update(identity, badgeVersion(version), { bundled_asset_key: asset?.key ?? null });
  }

  async anchorCategory(raw: unknown, expectedVersion: unknown, category: unknown) {
    const anchor = badgeAnchor(raw), version = badgeVersion(expectedVersion);
    const current = await this.read([], [anchor]);
    const old = current.bindings.find(row => row.key === anchor.key);
    if ((old?.version ?? 0) !== version) throw new TypeError("BADGE_CONFLICT");
    if (old?.digest === anchor.digest && current.merchants?.some(row => row.key === old.identityKey
      && (row.policy === "none" || isNonMerchantKind(row.kind))))
      throw new TypeError("BADGE_POLICY_DENIED");
    const value = { user_id: this.userId, anchor_key: anchor.key, source_digest: anchor.digest,
      identity_key: old?.digest === anchor.digest ? old.identityKey : null, category: badgeCategory(category), version: version + 1 };
    const result = version === 0 ? await this.client.from("composer_badge_bindings").insert(value).select("version").maybeSingle()
      : await this.client.from("composer_badge_bindings").update(value).eq("user_id", this.userId).eq("anchor_key", anchor.key)
        .eq("version", version).select("version").maybeSingle();
    storageError(result.error);
    if (!result.data) throw new TypeError("BADGE_CONFLICT");
    return { ...anchor, category: value.category, identityKey: value.identity_key, version: version + 1 };
  }

  async image(key: unknown, version: unknown, file: File) {
    const identity = badgeIdentityKey(key), expected = badgeVersion(version);
    await this.assertMerchantMediaAllowed(identity);
    const row = await this.row(identity);
    if (!row || row.version !== expected) throw new TypeError("BADGE_CONFLICT");
    const bytes = await prepareBadgeImage(file);
    const path = this.userId + "/" + randomUUID() + ".webp";
    const bucket = this.client.storage.from(BADGE_BUCKET);
    const upload = await bucket.upload(path, bytes, { contentType: "image/webp", upsert: false, cacheControl: "60" });
    storageError(upload.error);
    let result;
    try { result = await this.update(identity, expected, { object_path: path, bundled_asset_key: null }); }
    catch (error) {
      // A lost reply can follow a committed association. Inspect it before cleaning up the uploaded object.
      const current = await this.row(identity).catch(() => undefined);
      if (current?.object_path === path) result = visual(current);
      else {
        if (current !== undefined) await bucket.remove([path]).catch(() => {});
        throw error;
      }
    }
    if (row.object_path) await bucket.remove([row.object_path]).catch(() => {});
    return result;
  }

  async download(key: unknown, version: unknown) {
    const identity = badgeIdentityKey(key);
    await this.assertMerchantMediaAllowed(identity);
    const row = await this.row(identity);
    if (!row?.object_path || row.version !== badgeVersion(version)) return null;
    const result = await this.client.storage.from(BADGE_BUCKET).download(row.object_path);
    return result.error ? null : result.data;
  }
}

export async function prepareBadgeImage(file: File): Promise<Buffer> {
  if (!file || !["image/png", "image/webp"].includes(file.type) || file.size < 12 || file.size > MAX_BADGE_BYTES)
    throw new TypeError("BADGE_IMAGE_INVALID");
  const bytes = Buffer.from(await file.arrayBuffer());
  const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const webp = bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  if (!(png && file.type === "image/png" || webp && file.type === "image/webp")) throw new TypeError("BADGE_IMAGE_INVALID");
  try {
    const sharp = (await import("sharp")).default;
    const image = sharp(bytes, { limitInputPixels: 16_777_216, animated: false, failOn: "warning" });
    const meta = await image.metadata();
    if (!meta.width || !meta.height || meta.width > 4096 || meta.height > 4096 || (meta.pages ?? 1) !== 1) throw Error();
    return await image.rotate().resize({ width: 512, height: 512, fit: "inside", withoutEnlargement: true })
      .ensureAlpha().webp({ quality: 90 }).toBuffer();
  } catch { throw new TypeError("BADGE_IMAGE_INVALID"); }
}
