import { presetIllustrationPath, type ComposerPreset } from "@/domain/phase2/planner/composer-presets";
import styles from "./composer.module.css";

/** Decorative static artwork; identity is carried by the surrounding native label. */
export function PresetIllustration({ preset, className = "" }: { preset: ComposerPreset; className?: string }) {
  const square = "squareArtwork" in preset;
  return <img className={`${styles.presetIllustration} ${className}`} data-preset-illustration={preset.presetKey}
    src={presetIllustrationPath(preset)} width={square ? 256 : 1200} height={square ? 256 : 600} alt="" draggable={false} loading="lazy" decoding="async" />;
}
