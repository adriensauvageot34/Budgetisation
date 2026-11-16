import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { BADGE_BUCKET, MAX_BADGE_BYTES, badgeAnchor, badgeCategory, badgeIdentityKey, badgeLabel, badgeVersion,
  type BadgeAnchor, type BadgeIdentity, type BadgeLibraryRead, type PersonalBadge } from "@/domain/phase2/commerce-media";

type Row = { user_id: string; identity_key: string; label: string; category: PersonalBadge["category"]; object_path: string | null; version: number };
type BindingRow = { anchor_key: string; source_digest: string; identity_key: string | null; category: PersonalBadge["category"]; version: number };
const columns = "identity_key,label,category,object_path,version";
const visual = (row: Row): PersonalBadge => ({
  key: row.identity_key, label: row.label, category: row.category, version: row.version, hasImage: !!row.object_path,
  ...(row.object_path ? { imageUrl: "/api/composer/badge-library/image?identity=" + encodeURIComponent(row.identity_key) + "&version=" + row.version } : {}),
});
function storageError(error: unknown) {
  if (error) throw new TypeError(typeof error === "object" && "code" in error && error.code === "23505" ? "BADGE_CONFLICT" : "BADGE_LIBRARY_UNAVAILABLE");
}

/** Authenticated client and owner are obtained on the server, never from a request body. */
export class BadgeLibrary {
  constructor(private readonly client: SupabaseClient, private readonly userId: string,
    private readonly canonical: () => Promise<SupabaseClient> = async () => client) {}

  async read(keys: readonly string[], anchors: readonly BadgeAnchor[]): Promise<BadgeLibraryRead> {
    if (keys.length > 100 || anchors.length > 100) throw new TypeError("BADGE_BATCH_INVALID");
    const ids = keys.map(badgeIdentityKey), refs = anchors.map(badgeAnchor);
    const bindingsRead = refs.length ? await this.client.from("composer_badge_bindings")
      .select("anchor_key,source_digest,identity_key,category,version").eq("user_id", this.userId).in("anchor_key", refs.map(ref => ref.key))
      : { data: [], error: null };
    storageError(bindingsRead.error);
    const bindings = bindingsRead.data as BindingRow[];
    const wanted = [...new Set([...ids, ...bindings.flatMap(row => row.identity_key && refs.some(ref => ref.key === row.anchor_key && ref.digest === row.source_digest) ? [row.identity_key] : [])])];
    const media = wanted.length ? await this.client.from("composer_badge_visuals").select(columns).eq("user_id", this.userId).in("identity_key", wanted)
      : { data: [], error: null };
    storageError(media.error);
    const rows = media.data as Row[], paths = rows.flatMap(row => row.object_path ? [row.object_path] : []);
    const signed = paths.length ? await this.client.storage.from(BADGE_BUCKET).createSignedUrls(paths, 300) : { data: [] };
    const urls = new Map((signed.data ?? []).flatMap(item => item.signedUrl ? [[item.path, item.signedUrl] as const] : []));
    return { media: rows.map(row => ({ ...visual(row), imageUrl: row.object_path ? urls.get(row.object_path) : undefined })), bindings: bindings.map(row => ({
      key: row.anchor_key, digest: row.source_digest, identityKey: row.identity_key, category: row.category, version: row.version,
    })) };
  }

  async search(query: string): Promise<readonly BadgeIdentity[]> {
    const label = badgeLabel(query);
    if (label.length < 2) return [];
    const escaped = "%" + label.replace(/[\\%_]/gu, char => "\\" + char) + "%";
    const [personal, merchants] = await Promise.all([
      this.client.from("composer_badge_visuals").select("identity_key,label").eq("user_id", this.userId).ilike("label", escaped).order("label").limit(20),
      this.canonical().then(client => client.from("merchants").select("merchant_id,nom_canonique").ilike("nom_canonique", escaped).order("nom_canonique").limit(20))
        .catch(() => ({ data: [], error: new Error("Canonical unavailable") })),
    ]);
    storageError(personal.error);
    // A denied or unavailable Canonical search grants no identity. Private identities remain usable.
    const results = new Map<string, BadgeIdentity>();
    for (const row of merchants.error ? [] : merchants.data ?? []) results.set("merchant:" + row.merchant_id, { key: "merchant:" + row.merchant_id, label: row.nom_canonique });
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
    const place = key.startsWith("place:"), table = place ? "referentiel_lieu" : "merchants", id = place ? "place_id" : "merchant_id";
    let query = (await this.canonical()).from(table).select("nom_canonique").eq(id, key.split(":")[1]);
    if (place) query = query.eq("private_place", false);
    const result = await query.maybeSingle();
    if (result.error || !result.data) throw new TypeError("BADGE_IDENTITY_INVALID");
    return { key, label: badgeLabel(result.data.nom_canonique) };
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
    return visual(row);
  }

  private async update(key: string, version: number, patch: { category?: PersonalBadge["category"]; object_path?: string }) {
    const result = await this.client.from("composer_badge_visuals").update({ ...patch, version: version + 1, updated_at: new Date().toISOString() })
      .eq("user_id", this.userId).eq("identity_key", key).eq("version", version).select(columns).maybeSingle();
    storageError(result.error);
    if (!result.data) throw new TypeError("BADGE_CONFLICT");
    return visual(result.data as Row);
  }

  async category(key: unknown, version: unknown, category: unknown) {
    return this.update(badgeIdentityKey(key), badgeVersion(version), { category: badgeCategory(category) });
  }

  async anchorCategory(raw: unknown, expectedVersion: unknown, category: unknown) {
    const anchor = badgeAnchor(raw), version = badgeVersion(expectedVersion);
    const current = await this.read([], [anchor]);
    const old = current.bindings.find(row => row.key === anchor.key);
    if ((old?.version ?? 0) !== version) throw new TypeError("BADGE_CONFLICT");
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
    const row = await this.row(identity);
    if (!row || row.version !== expected) throw new TypeError("BADGE_CONFLICT");
    const bytes = await prepareBadgeImage(file);
    const path = this.userId + "/" + randomUUID() + ".webp";
    const bucket = this.client.storage.from(BADGE_BUCKET);
    const upload = await bucket.upload(path, bytes, { contentType: "image/webp", upsert: false, cacheControl: "60" });
    storageError(upload.error);
    let result;
    try { result = await this.update(identity, expected, { object_path: path }); }
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
    const row = await this.row(badgeIdentityKey(key));
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
