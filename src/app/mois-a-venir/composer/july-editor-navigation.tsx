"use client";

import { useRouter } from "next/navigation";
import { JULY_COMPOSER_HREF, JULY_COMPOSER_MONTH } from "@/domain/phase2/planner/realized-month-entry";
import { composerCalendarHref } from "../month-entry";
import styles from "./composer.module.css";

export function JulyEditorNavigation({ busy, leave }: { busy: boolean; leave: (navigate: () => void) => void }) {
  const router = useRouter();
  return <nav className={styles.reconstructionModes} aria-label="Mode de juillet">
    <button type="button" disabled={busy} onClick={() => leave(() => router.push(composerCalendarHref(JULY_COMPOSER_MONTH)))}>Calendrier</button>
    <button type="button" disabled={busy} onClick={() => leave(() => router.push(JULY_COMPOSER_HREF))}>Au 15 juillet</button>
    <span className={styles.reconstructionLink} aria-current="page">Édition</span>
  </nav>;
}
