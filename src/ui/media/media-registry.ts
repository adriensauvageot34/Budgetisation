import type { BundledAssetKey } from "./media.types";

export type BundledMediaAsset = {
  readonly src: string;
  readonly width: number;
  readonly height: number;
};

function placeholderSvg(label: string, glyph: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480"><rect width="640" height="480" fill="#eef1f4"/><text x="320" y="225" text-anchor="middle" font-family="sans-serif" font-size="72" fill="#59636e">${glyph}</text><text x="320" y="285" text-anchor="middle" font-family="sans-serif" font-size="24" fill="#59636e">${label}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export const bundledMediaAssetKeys = [
  "fallback_moment",
  "fallback_place",
  "fallback_merchant",
  "fallback_persona",
  "fallback_life_event",
] as const satisfies readonly BundledAssetKey[];

export const bundledMediaRegistry: Readonly<
  Record<BundledAssetKey, BundledMediaAsset>
> = {
  fallback_moment: {
    src: placeholderSvg("Moment", "◇"),
    width: 640,
    height: 480,
  },
  fallback_place: {
    src: placeholderSvg("Lieu", "⌖"),
    width: 640,
    height: 480,
  },
  fallback_merchant: {
    src: placeholderSvg("Marchand", "M"),
    width: 640,
    height: 480,
  },
  fallback_persona: {
    src: placeholderSvg("Persona", "●"),
    width: 640,
    height: 480,
  },
  fallback_life_event: {
    src: placeholderSvg("Life Event", "◆"),
    width: 640,
    height: 480,
  },
};

export function isBundledAssetKey(value: unknown): value is BundledAssetKey {
  return (
    typeof value === "string" &&
    (bundledMediaAssetKeys as readonly string[]).includes(value)
  );
}

export function getBundledMediaAsset(
  key: BundledAssetKey,
): BundledMediaAsset {
  return bundledMediaRegistry[key];
}
