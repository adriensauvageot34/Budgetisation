import { presetIllustrationPath, type ComposerPreset } from "@/domain/phase2/planner/composer-presets";
import styles from "./composer.module.css";

/** Decorative static artwork; identity is carried by the surrounding native label. */
export function PresetIllustration({ preset, className = "" }: { preset: ComposerPreset; className?: string }) {
  return <img className={`${styles.presetIllustration} ${className}`} data-preset-illustration={preset.presetKey}
    src={presetIllustrationPath(preset)} width={1200} height={600} alt="" loading="lazy" decoding="async" />;
}
