"use client";
import { useState } from "react";
import registry from "./builder-illustration-registry.json";
import styles from "./builder-illustrations.module.css";

/** Presentation only: exact semantic keys, never label guessing or domain eligibility. */
const choices: Readonly<Record<string, string>> = registry.choices;
const illustrations: Readonly<Record<string, string>> = registry.illustrations;
export function builderIllustration(semanticKey: string): string | undefined {
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
  const src = personalSrc ?? builderIllustration(semanticKey);
  const [failedSrc, setFailedSrc] = useState<string>();
  return <span aria-hidden="true" data-builder-illustration={semanticKey} data-artwork={src && src !== failedSrc ? "clay" : "neutral"}
    className={`${styles.artwork} ${className}`}>
    {src && src !== failedSrc && <img src={src} width={1200} height={600} alt="" loading="lazy" decoding="async"
      draggable={false} onError={() => setFailedSrc(src)} />}
  </span>;
}
