export type MediaRole = "photo" | "logo" | "illustration";
export type MediaFit = "cover" | "contain";

export type MediaAlt =
  | { readonly kind: "descriptive"; readonly text: string }
  | { readonly kind: "decorative" };

export type MediaDimensions = {
  readonly width: number;
  readonly height: number;
  readonly aspectRatio?: never;
};

export type MediaAspectRatio = {
  readonly width?: never;
  readonly height?: never;
  readonly aspectRatio: number;
};

export type MediaGeometry = MediaDimensions | MediaAspectRatio;

export type MediaFocalPoint = {
  readonly x: number;
  readonly y: number;
};

export type BundledAssetKey =
  | "fallback_moment"
  | "fallback_place"
  | "fallback_merchant"
  | "fallback_persona"
  | "fallback_life_event";

type MediaRefBase = MediaGeometry & {
  readonly role: MediaRole;
  readonly alt: MediaAlt;
  readonly focalPoint?: MediaFocalPoint;
  readonly fit?: MediaFit;
  readonly attribution?: string;
};

export type BundledAssetMediaRef = MediaRefBase & {
  readonly source: "bundled_asset";
  readonly assetKey: BundledAssetKey;
};

export type SupabaseStorageMediaRef = MediaRefBase & {
  readonly source: "supabase_storage";
  readonly bucket: string;
  readonly path: string;
};

export type MediaRef = BundledAssetMediaRef | SupabaseStorageMediaRef;

export type ReservedMediaSource = "external";

export type ResolvedMedia = MediaGeometry & {
  readonly src: string;
  readonly role: MediaRole;
  readonly alt: MediaAlt;
  readonly focalPoint?: MediaFocalPoint;
  readonly fit: MediaFit;
  readonly attribution?: string;
  readonly expiresAt?: string;
};

export type MediaFallbackKind =
  | "moment"
  | "place"
  | "merchant"
  | "persona"
  | "life_event";

export type MediaFallbackReason =
  | "absent"
  | "resolution_failed"
  | "load_failed";

export type PersonaFallbackKind = "person" | "ensemble";

export type MediaFallback = {
  readonly kind: MediaFallbackKind;
  readonly reason: MediaFallbackReason;
  readonly assetKey: BundledAssetKey;
  readonly glyph: string;
  readonly initials?: string;
  readonly usedAuthoritativeTypeMapping: boolean;
};

export type MediaFallbackInput = {
  readonly kind: MediaFallbackKind;
  readonly reason: MediaFallbackReason;
  readonly label?: string;
  readonly personaKind?: PersonaFallbackKind;
  readonly authoritativeType?: string;
  readonly explicitTypeAssets?: Readonly<Record<string, BundledAssetKey>>;
};

export type MediaResolutionResult =
  | { readonly kind: "resolved"; readonly media: ResolvedMedia }
  | { readonly kind: "fallback"; readonly fallback: MediaFallback };

export type MediaSlotState =
  | {
      readonly kind: "loading";
      readonly geometry: MediaGeometry;
      readonly role: MediaRole;
    }
  | {
      readonly kind: "resolved";
      readonly media: ResolvedMedia;
      readonly fallback: MediaFallback;
    }
  | {
      readonly kind: "fallback";
      readonly geometry: MediaGeometry;
      readonly role: MediaRole;
      readonly fallback: MediaFallback;
    };

export type StorageResolution = {
  readonly src: string;
  readonly expiresAt?: string;
};

export type StorageMediaResolver = (
  media: SupabaseStorageMediaRef,
) => Promise<StorageResolution>;

export interface MediaResolver {
  resolve(media: MediaRef): Promise<ResolvedMedia>;
}
