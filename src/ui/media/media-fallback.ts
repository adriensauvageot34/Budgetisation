import type {
  BundledAssetKey,
  MediaFallback,
  MediaFallbackInput,
  MediaFallbackKind,
} from "./media.types";

const defaultFallbackAssets: Readonly<
  Record<MediaFallbackKind, BundledAssetKey>
> = {
  moment: "fallback_moment",
  place: "fallback_place",
  merchant: "fallback_merchant",
  persona: "fallback_persona",
  life_event: "fallback_life_event",
};

const fallbackGlyphs: Readonly<Record<MediaFallbackKind, string>> = {
  moment: "◇",
  place: "⌖",
  merchant: "M",
  persona: "●",
  life_event: "◆",
};

export function createMediaInitials(label: string | undefined): string | null {
  if (!label) return null;
  const words = label
    .trim()
    .split(/\s+/u)
    .filter((word) => /[\p{L}\p{N}]/u.test(word));
  if (words.length === 0) return null;
  return words
    .slice(0, 2)
    .map((word) => Array.from(word)[0]?.toLocaleUpperCase("fr-FR") ?? "")
    .join("");
}

export function resolveMediaFallback(input: MediaFallbackInput): MediaFallback {
  const mappedAsset =
    (input.kind === "place" || input.kind === "life_event") &&
    input.authoritativeType
      ? input.explicitTypeAssets?.[input.authoritativeType]
      : undefined;
  const initials =
    input.kind === "merchant" ||
    (input.kind === "persona" && input.personaKind !== "ensemble")
      ? createMediaInitials(input.label)
      : null;
  const groupGlyph =
    input.kind === "persona" && input.personaKind === "ensemble" ? "●●" : null;

  return {
    kind: input.kind,
    reason: input.reason,
    assetKey: mappedAsset ?? defaultFallbackAssets[input.kind],
    glyph: groupGlyph ?? initials ?? fallbackGlyphs[input.kind],
    ...(initials === null || groupGlyph !== null ? {} : { initials }),
    usedAuthoritativeTypeMapping: mappedAsset !== undefined,
  };
}
