import { resolveMediaFallback } from "./media-fallback";
import { getBundledMediaAsset } from "./media-registry";
import { parseMediaRef } from "./media-validation";
import type {
  MediaFallbackInput,
  MediaFit,
  MediaRef,
  MediaResolutionResult,
  MediaResolver,
  MediaRole,
  ResolvedMedia,
  StorageMediaResolver,
} from "./media.types";

export function resolveMediaFit(
  role: MediaRole,
  declaredFit?: MediaFit,
): MediaFit {
  if (declaredFit) return declaredFit;
  return role === "photo" ? "cover" : "contain";
}

export function createMediaResolver(input: {
  readonly resolveStorage: StorageMediaResolver;
}): MediaResolver {
  return {
    async resolve(candidate: MediaRef): Promise<ResolvedMedia> {
      const media = parseMediaRef(candidate);
      const common = {
        role: media.role,
        alt: media.alt,
        fit: resolveMediaFit(media.role, media.fit),
        ...(media.width === undefined
          ? { aspectRatio: media.aspectRatio }
          : { width: media.width, height: media.height }),
        ...(media.focalPoint === undefined
          ? {}
          : { focalPoint: media.focalPoint }),
        ...(media.attribution === undefined
          ? {}
          : { attribution: media.attribution }),
      };

      if (media.source === "bundled_asset") {
        return {
          ...common,
          src: getBundledMediaAsset(media.assetKey).src,
        } as ResolvedMedia;
      }

      const resolution = await input.resolveStorage(media);
      if (typeof resolution.src !== "string" || resolution.src.trim() === "") {
        throw new TypeError("La résolution Storage doit fournir une src non vide.");
      }
      return {
        ...common,
        src: resolution.src,
        ...(resolution.expiresAt === undefined
          ? {}
          : { expiresAt: resolution.expiresAt }),
      } as ResolvedMedia;
    },
  };
}

export async function resolveMediaOrFallback(
  media: MediaRef | null | undefined,
  resolver: MediaResolver,
  fallback: Omit<MediaFallbackInput, "reason">,
): Promise<MediaResolutionResult> {
  if (!media) {
    return {
      kind: "fallback",
      fallback: resolveMediaFallback({ ...fallback, reason: "absent" }),
    };
  }
  try {
    return { kind: "resolved", media: await resolver.resolve(media) };
  } catch {
    return {
      kind: "fallback",
      fallback: resolveMediaFallback({
        ...fallback,
        reason: "resolution_failed",
      }),
    };
  }
}
