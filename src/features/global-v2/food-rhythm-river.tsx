"use client";

import { useMemo } from "react";
import type { GlobalBackgroundRhythmsReadModel } from "@/query-api/global-v2";
import { AnnualMonthInteractionLayer } from "./annual-month-interaction-layer";
import { FoodMonthFocus } from "./food-month-focus";
import { formatMoney, formatPercentage, monthLabel, stackedAreaGeometry, useAnnualMonthFocus } from "./annual-month-focus";
import { RhythmAnnotation } from "./rhythm-annotation";
import styles from "./background-rhythms.module.css";

export function FoodRhythmRiver({ food }: { readonly food: GlobalBackgroundRhythmsReadModel["food"] }) {
  const months = useMemo(() => food.months.map(([month]) => month), [food.months]);
  const interaction = useAnnualMonthFocus(months);
  const geometry = useMemo(() => stackedAreaGeometry(food.months.map((month) => [Number(month[1]), Number(month[2]), Number(month[3])])), [food.months]);
  const display = food.months.find(([month]) => month === interaction.displayMonth);
  const selected = food.months.find(([month]) => month === interaction.state.selectedMonth);
  const selectedIndex = selected === undefined ? -1 : months.indexOf(selected[0]);
  return <article className={styles.rhythmCard} data-rhythm-domain="food">
    <header className={styles.rhythmCardHeader}><div><span className={styles.cardEyebrow}>Alimentation</span><h4>Notre alimentation</h4><p>Comment courses, restaurants et livraisons se répartissent au fil de l’année.</p></div><div className={styles.annualKpi}><strong>≈{formatMoney(food.annual.total)}</strong><span>sur l’année</span><small>Courses · restaurants · livraisons</small></div></header>
    <div className={styles.legend} aria-label="Légende"><span data-tone="food-courses">Courses</span><span data-tone="food-restaurants">Restaurants</span><span data-tone="food-deliveries">Livraisons</span></div>
    <div className={styles.annualVisualBody}>
      <svg className={styles.annualRiver} viewBox={`0 0 ${geometry.width} ${geometry.height}`} preserveAspectRatio="none" aria-hidden="true">
        <path className={styles.foodCourses} d={geometry.paths[0]} />
        <path className={styles.foodRestaurants} d={geometry.paths[1]} />
        <path className={styles.foodDeliveries} d={geometry.paths[2]} />
      </svg>
      {selectedIndex < 0 ? null : <span className={styles.selectedMonthGuide} style={{ left: `${selectedIndex / 11 * 100}%` }} aria-hidden />}
      {display === undefined ? null : <div className={styles.chartTooltip} style={{ left: `${months.indexOf(display[0]) / 11 * 100}%` }} role="status">
        <strong>{monthLabel(display[0])}</strong><b>{formatMoney(display[4], true)}</b><span>Courses {formatMoney(display[1], true)}</span><span>Restaurants {formatMoney(display[2], true)}</span><span>Livraisons {formatMoney(display[3], true)}</span>{formatPercentage(display[6]) === undefined ? null : <em>{formatPercentage(display[6])} hors courses</em>}
      </div>}
      <AnnualMonthInteractionLayer domain="food" months={months} state={interaction.state} buttonRefs={interaction.monthButtons} onPreview={interaction.preview} onSelect={interaction.select} onMove={interaction.move} onClose={() => interaction.close()} />
    </div>
    {food.annotations.length === 0 ? null : <div className={styles.rhythmAnnotations}>{food.annotations.map((annotation) => <RhythmAnnotation key={annotation.annotationId} text={annotation.text} />)}</div>}
    {selected === undefined ? null : <FoodMonthFocus month={selected} annotations={food.annotations} connectorPosition={selectedIndex / 11 * 100} onClose={() => interaction.close()} />}
  </article>;
}
