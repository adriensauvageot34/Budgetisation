"use client";
import { useState } from "react";
import registry from "./builder-illustration-registry.json";
import styles from "./builder-illustrations.module.css";
import { clayBuilderArtwork } from "./clay-v22-media";

/** Presentation only: exact semantic keys, never label guessing or domain eligibility. */
const choices: Readonly<Record<string, string>> = registry.choices;
const illustrations: Readonly<Record<string, string>> = registry.illustrations;
export function builderIllustration(semanticKey: string): string | undefined {
  const artwork = clayBuilderArtwork(semanticKey);
  if (artwork) return artwork.src;
  return historicalBuilderIllustration(semanticKey);
}
function historicalBuilderIllustration(semanticKey: string): string | undefined {
  const illustration = Object.hasOwn(choices, semanticKey) ? choices[semanticKey] : undefined;
  return illustration && illustrations[illustration] ? `/planned-visuals/builder/clay/${illustrations[illustration]}` : undefined;
}
export function builderChoiceKey(scope: string, key: string): string {
  return scope === "module" ? `module:${key}` : `choice:${scope}:${key}`;
}

/** Personal artwork can be supplied later; missing/failed artwork keeps the native card intact. */
export function BuilderIllustration({ semanticKey, personalSrc, className = "" }: {
  semanticKey: string; personalSrc?: string; className?: string;
}) {
  const artwork = !personalSrc ? clayBuilderArtwork(semanticKey) : undefined;
  const preferred = personalSrc ?? artwork?.src ?? historicalBuilderIllustration(semanticKey);
  const [failedSources, setFailedSources] = useState<readonly string[]>([]);
  const historical = !personalSrc ? historicalBuilderIllustration(semanticKey) : undefined;
  const src = [preferred, historical].find((value): value is string => !!value && !failedSources.includes(value));
  const currentArtwork = src === artwork?.src ? artwork : undefined;
  return <span aria-hidden="true" data-builder-illustration={semanticKey} data-artwork={src ? "clay" : "neutral"}
    data-visual-concept-id={currentArtwork?.visualConceptId} data-clay-fit={currentArtwork?.fit}
    className={`${styles.artwork} ${className}`}>
    {src && <img src={src} width={currentArtwork?.width ?? 1200} height={currentArtwork?.height ?? 600} alt="" loading="lazy" decoding="async"
      draggable={false} onError={() => setFailedSources(previous => [...previous, src])} />}
  </span>;
}
