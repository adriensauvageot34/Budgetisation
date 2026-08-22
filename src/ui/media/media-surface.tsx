"use client";

import { useState, type CSSProperties } from "react";
import type {
  MediaFallback,
  MediaGeometry,
  MediaSlotState,
  ResolvedMedia,
} from "./media.types";

export type MediaSurfaceProps = {
  readonly state: MediaSlotState;
  readonly critical?: boolean;
  readonly className?: string;
  readonly style?: CSSProperties;
};

function mediaGeometry(media: ResolvedMedia): MediaGeometry {
  return media.width === undefined
    ? { aspectRatio: media.aspectRatio }
    : { width: media.width, height: media.height };
}

export function resolveMediaSurfacePresentation(
  state: MediaSlotState,
  failedSource: string | null,
): MediaSlotState {
  if (
    state.kind !== "resolved" ||
    failedSource === null ||
    failedSource !== state.media.src
  ) {
    return state;
  }
  return {
    kind: "fallback",
    geometry: mediaGeometry(state.media),
    role: state.media.role,
    fallback: { ...state.fallback, reason: "load_failed" },
  };
}

function slotStyle(geometry: MediaGeometry, style?: CSSProperties): CSSProperties {
  const aspectRatio =
    geometry.width === undefined
      ? geometry.aspectRatio
      : geometry.width / geometry.height;
  return {
    position: "relative",
    display: "grid",
    placeItems: "center",
    width: "100%",
    aspectRatio: String(aspectRatio),
    overflow: "hidden",
    background: "#eef1f4",
    ...style,
  };
}

function fallbackElement(
  fallback: MediaFallback,
  geometry: MediaGeometry,
  className: string | undefined,
  style: CSSProperties | undefined,
) {
  return (
    <span
      className={className}
      style={slotStyle(geometry, style)}
      data-media-slot=""
      data-media-state="fallback"
      data-fallback-kind={fallback.kind}
      data-fallback-reason={fallback.reason}
      aria-hidden="true"
    >
      <span data-media-fallback-glyph="">{fallback.glyph}</span>
    </span>
  );
}

export function MediaSurface({
  state,
  critical = false,
  className,
  style,
}: MediaSurfaceProps) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const presentation = resolveMediaSurfacePresentation(state, failedSource);

  if (presentation.kind === "loading") {
    return (
      <span
        className={className}
        style={slotStyle(presentation.geometry, style)}
        data-media-slot=""
        data-media-state="loading"
        aria-hidden="true"
      />
    );
  }

  if (presentation.kind === "fallback") {
    return fallbackElement(
      presentation.fallback,
      presentation.geometry,
      className,
      style,
    );
  }

  const { media } = presentation;
  const geometry = mediaGeometry(media);

  const descriptiveAlt = media.alt.kind === "descriptive" ? media.alt.text : "";
  const objectPosition = media.focalPoint
    ? `${media.focalPoint.x * 100}% ${media.focalPoint.y * 100}%`
    : "50% 50%";

  return (
    <span
      className={className}
      style={slotStyle(geometry, style)}
      data-media-slot=""
      data-media-state="resolved"
    >
      <img
        src={media.src}
        alt={descriptiveAlt}
        aria-hidden={media.alt.kind === "decorative" ? "true" : undefined}
        width={media.width}
        height={media.height}
        loading={critical ? "eager" : "lazy"}
        style={{
          width: "100%",
          height: "100%",
          objectFit: media.fit,
          objectPosition,
        }}
        onError={() => setFailedSource(media.src)}
      />
    </span>
  );
}
