import { presetIllustrationPath, type ComposerPreset } from "@/domain/phase2/planner/composer-presets";
import { clayV22Artwork } from "../clay-v22-media";
import styles from "./composer.module.css";

/** Decorative static artwork; identity is carried by the surrounding native label. */
export function PresetIllustration({ preset, className = "", thumbnail = false }: {
  preset: ComposerPreset; className?: string; thumbnail?: boolean;
}) {
  const source = presetIllustrationPath(preset);
  // Panoramic compositions reserve space around the subject for the editor.
  const wide = thumbnail ? /^\/planned-visuals\/builder\/clay\/v22\/wide\/v22-art-(excel|extra)-([a-z0-9-]+)\.webp$/u.exec(source) : null;
  const artwork = wide ? clayV22Artwork(`v22-art:${wide[1]}:${wide[2]}`) : undefined;
  const square = "squareArtwork" in preset;
  return <img className={`${styles.presetIllustration} ${className}`} data-preset-illustration={preset.presetKey}
    src={artwork?.src ?? source} width={artwork?.width ?? (square ? 256 : 1200)}
    height={artwork?.height ?? (square ? 256 : 600)} alt="" draggable={false} loading="lazy" decoding="async" />;
}
