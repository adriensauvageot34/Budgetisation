import {
  bundledMediaAssetKeys,
  isBundledAssetKey,
} from "./media-registry";
import type {
  MediaAlt,
  MediaFit,
  MediaFocalPoint,
  MediaGeometry,
  MediaRef,
  MediaRole,
} from "./media.types";

type UnknownRecord = Record<string, unknown>;

function strictRecord(
  value: unknown,
  allowedKeys: readonly string[],
  name: string,
): UnknownRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${name} doit être un objet.`);
  }
  const record = value as UnknownRecord;
  for (const key of Object.keys(record)) {
    if (!allowedKeys.includes(key)) {
      throw new TypeError(`${name}.${key} n'est pas autorisé.`);
    }
  }
  return record;
}

function required(record: UnknownRecord, key: string, name: string): unknown {
  if (!Object.prototype.hasOwnProperty.call(record, key)) {
    throw new TypeError(`${name}.${key} est requis.`);
  }
  return record[key];
}

function optionalNonEmptyText(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${name} doit être un texte non vide.`);
  }
  return value.trim();
}

function parseMediaRole(value: unknown): MediaRole {
  if (value !== "photo" && value !== "logo" && value !== "illustration") {
    throw new TypeError("MediaRef.role est invalide.");
  }
  return value;
}

function parseMediaFit(value: unknown): MediaFit {
  if (value !== "cover" && value !== "contain") {
    throw new TypeError("MediaRef.fit est invalide.");
  }
  return value;
}

export function parseMediaAlt(value: unknown): MediaAlt {
  const record = strictRecord(value, ["kind", "text"], "MediaAlt");
  const kind = required(record, "kind", "MediaAlt");
  if (kind === "decorative") {
    if (Object.prototype.hasOwnProperty.call(record, "text")) {
      throw new TypeError("MediaAlt decorative ne porte pas de texte.");
    }
    return { kind };
  }
  if (kind === "descriptive") {
    return {
      kind,
      text: optionalNonEmptyText(required(record, "text", "MediaAlt"), "MediaAlt.text"),
    };
  }
  throw new TypeError("MediaAlt.kind est invalide.");
}

function positiveNumber(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new TypeError(`${name} doit être un nombre fini strictement positif.`);
  }
  return value;
}

function parseGeometry(record: UnknownRecord): MediaGeometry {
  const hasWidth = Object.prototype.hasOwnProperty.call(record, "width");
  const hasHeight = Object.prototype.hasOwnProperty.call(record, "height");
  const hasRatio = Object.prototype.hasOwnProperty.call(record, "aspectRatio");
  if (hasRatio && (hasWidth || hasHeight)) {
    throw new TypeError("MediaRef utilise soit width/height, soit aspectRatio.");
  }
  if (hasRatio) {
    return {
      aspectRatio: positiveNumber(record.aspectRatio, "MediaRef.aspectRatio"),
    };
  }
  if (!hasWidth || !hasHeight) {
    throw new TypeError("MediaRef exige width/height ou aspectRatio.");
  }
  return {
    width: positiveNumber(record.width, "MediaRef.width"),
    height: positiveNumber(record.height, "MediaRef.height"),
  };
}

function parseFocalPoint(value: unknown): MediaFocalPoint {
  const record = strictRecord(value, ["x", "y"], "MediaFocalPoint");
  const x = required(record, "x", "MediaFocalPoint");
  const y = required(record, "y", "MediaFocalPoint");
  if (
    typeof x !== "number" ||
    !Number.isFinite(x) ||
    x < 0 ||
    x > 1 ||
    typeof y !== "number" ||
    !Number.isFinite(y) ||
    y < 0 ||
    y > 1
  ) {
    throw new TypeError("MediaFocalPoint x/y doivent être compris entre 0 et 1.");
  }
  return { x, y };
}

export function validateStoragePath(path: unknown): string {
  const parsed = optionalNonEmptyText(path, "MediaRef.path");
  if (
    parsed.includes("..") ||
    parsed.includes("?") ||
    parsed.includes("#") ||
    parsed.includes("\\") ||
    parsed.startsWith("/") ||
    /^(?:[a-z][a-z\d+.-]*:)?\/\//i.test(parsed)
  ) {
    throw new TypeError("MediaRef.path Storage est invalide.");
  }
  return parsed;
}

function parseBucket(value: unknown): string {
  const bucket = optionalNonEmptyText(value, "MediaRef.bucket");
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(bucket)) {
    throw new TypeError("MediaRef.bucket Storage est invalide.");
  }
  return bucket;
}

export function parseMediaRef(value: unknown): MediaRef {
  const allowedKeys = [
    "source",
    "assetKey",
    "bucket",
    "path",
    "role",
    "alt",
    "width",
    "height",
    "aspectRatio",
    "focalPoint",
    "fit",
    "attribution",
  ] as const;
  const record = strictRecord(value, allowedKeys, "MediaRef");
  const source = required(record, "source", "MediaRef");
  if (source === "external") {
    throw new TypeError("MediaRef external est réservé et refusé par le runtime actif.");
  }
  const role = parseMediaRole(required(record, "role", "MediaRef"));
  const alt = parseMediaAlt(required(record, "alt", "MediaRef"));
  const geometry = parseGeometry(record);
  const focalPoint = Object.prototype.hasOwnProperty.call(record, "focalPoint")
    ? parseFocalPoint(record.focalPoint)
    : undefined;
  const fit = Object.prototype.hasOwnProperty.call(record, "fit")
    ? parseMediaFit(record.fit)
    : undefined;
  const attribution = Object.prototype.hasOwnProperty.call(record, "attribution")
    ? optionalNonEmptyText(record.attribution, "MediaRef.attribution")
    : undefined;
  const base = {
    ...geometry,
    role,
    alt,
    ...(focalPoint === undefined ? {} : { focalPoint }),
    ...(fit === undefined ? {} : { fit }),
    ...(attribution === undefined ? {} : { attribution }),
  };

  if (source === "bundled_asset") {
    const assetKey = required(record, "assetKey", "MediaRef");
    if (!isBundledAssetKey(assetKey)) {
      throw new TypeError(
        `MediaRef.assetKey doit être une clé fermée (${bundledMediaAssetKeys.join(", ")}).`,
      );
    }
    if (
      Object.prototype.hasOwnProperty.call(record, "bucket") ||
      Object.prototype.hasOwnProperty.call(record, "path")
    ) {
      throw new TypeError("Un bundled_asset ne porte pas de bucket/path.");
    }
    return { ...base, source, assetKey };
  }

  if (source === "supabase_storage") {
    if (Object.prototype.hasOwnProperty.call(record, "assetKey")) {
      throw new TypeError("Un média Storage ne porte pas assetKey.");
    }
    return {
      ...base,
      source,
      bucket: parseBucket(required(record, "bucket", "MediaRef")),
      path: validateStoragePath(required(record, "path", "MediaRef")),
    };
  }

  throw new TypeError("MediaRef.source doit être bundled_asset ou supabase_storage.");
}
