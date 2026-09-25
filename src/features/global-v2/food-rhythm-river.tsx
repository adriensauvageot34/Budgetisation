"use client";

import { useMemo } from "react";
import type { GlobalBackgroundFoodMoney, GlobalBackgroundFoodSemantic } from "@/query-api/global-v2";
import { AnnualMonthInteractionLayer } from "./annual-month-interaction-layer";
import { FoodMonthFocus } from "./food-month-focus";
import { formatPercentage, monthLabel, stackedAreaGeometry, useAnnualMonthFocus } from "./annual-month-focus";
import { foodMoneyAccessibleLabel, formatFoodMoney } from "./food-money-presentation";
import { RhythmAnnotation } from "./rhythm-annotation";
import styles from "./background-rhythms.module.css";

function StreamValue({ label, value, tone }: { readonly label: string; readonly value: GlobalBackgroundFoodMoney; readonly tone: string }) {
  return <span data-tone={tone}><span>{label}</span><span aria-hidden="true">{formatFoodMoney(value)}</span><span className={styles.srOnly}>{foodMoneyAccessibleLabel(value)}</span></span>;
}

export function FoodRhythmRiver({ food }: { readonly food: GlobalBackgroundFoodSemantic }) {
  const months = useMemo(() => food.months.map(({ month }) => month), [food.months]);
  const interaction = useAnnualMonthFocus(months);
  const geometry = useMemo(() => stackedAreaGeometry(food.months.map(({ money }) =>
    [Number(money.courses.amount), Number(money.restaurants.amount), Number(money.deliveries.amount)])), [food.months]);
  const display = food.months.find(({ month }) => month === interaction.displayMonth);
  const selected = food.months.find(({ month }) => month === interaction.state.selectedMonth);
  const selectedIndex = selected === undefined ? -1 : months.indexOf(selected.month);
  const share = display?.nonGroceryShare.status === "KNOWN" ? formatPercentage(display.nonGroceryShare.value) : undefined;
  return <article className={styles.rhythmCard} data-rhythm-domain="food">
    <header className={styles.rhythmCardHeader}><div><span className={styles.cardEyebrow}>Alimentation</span><h4>Notre alimentation</h4><p>Comment courses, restaurants et livraisons se répartissent au fil de l’année.</p></div><div className={styles.annualKpi}><strong><span aria-hidden="true">{formatFoodMoney(food.annual.money.total)}</span><span className={styles.srOnly}>{foodMoneyAccessibleLabel(food.annual.money.total)}</span></strong><span>sur l’année</span><small>Courses · restaurants · livraisons</small></div></header>
    <div className={styles.legend} aria-label="Légende"><StreamValue label="Courses" value={food.annual.money.courses} tone="food-courses" /><StreamValue label="Restaurants" value={food.annual.money.restaurants} tone="food-restaurants" /><StreamValue label="Livraisons" value={food.annual.money.deliveries} tone="food-deliveries" /></div>
    <div className={styles.annualVisualBody}>
      <svg className={styles.annualRiver} viewBox={`0 0 ${geometry.width} ${geometry.height}`} preserveAspectRatio="none" aria-hidden="true">
        <path className={styles.foodCourses} d={geometry.paths[0]} />
        <path className={styles.foodRestaurants} d={geometry.paths[1]} />
        <path className={styles.foodDeliveries} d={geometry.paths[2]} />
      </svg>
      {selectedIndex < 0 ? null : <span className={styles.selectedMonthGuide} style={{ left: `${selectedIndex / 11 * 100}%` }} aria-hidden />}
      {display === undefined ? null : <div className={styles.chartTooltip} data-edge={months.indexOf(display.month) === 0 ? "start" : months.indexOf(display.month) === 11 ? "end" : undefined} style={{ left: `${months.indexOf(display.month) / 11 * 100}%` }} role="status">
        <strong>{monthLabel(display.month)}</strong><b>{formatFoodMoney(display.money.total)}</b><span>Courses {formatFoodMoney(display.money.courses)}</span><span>Restaurants {formatFoodMoney(display.money.restaurants)}</span><span>Livraisons {formatFoodMoney(display.money.deliveries)}</span>{share === undefined ? null : <em>{share} hors courses</em>}
      </div>}
      <AnnualMonthInteractionLayer domain="food" months={months} state={interaction.state} buttonRefs={interaction.monthButtons} onPreview={interaction.preview} onSelect={interaction.select} onMove={interaction.move} onClose={() => interaction.close()} />
    </div>
    {food.annotations.length === 0 ? null : <div className={styles.rhythmAnnotations}>{food.annotations.map((annotation) => <RhythmAnnotation key={annotation.annotationId} text={annotation.text} />)}</div>}
    {selected === undefined ? null : <FoodMonthFocus month={selected} annotations={food.annotations} connectorPosition={selectedIndex / 11 * 100} onClose={() => interaction.close()} />}
  </article>;
}
