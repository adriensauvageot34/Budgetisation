"use client";

import type { ComponentProps } from "react";
import { DensityAtom } from "@/components/layout/content-density";
import styles from "./balance-dashboard.module.css";

export { useContentDensity as useBalanceDensity } from "@/components/layout/content-density";

export function BalanceAtom(props: Omit<ComponentProps<typeof DensityAtom>, "className" | "motionClassName">) {
  return <DensityAtom {...props} className={styles.atom} motionClassName={styles.atomMotion} />;
}
