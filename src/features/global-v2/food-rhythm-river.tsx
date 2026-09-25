"use client";

import { useMemo } from "react";
import type { GlobalBackgroundFoodMoney, GlobalBackgroundFoodSemantic } from "@/query-api/global-v2";
import { AnnualMonthInteractionLayer } from "./annual-month-interaction-layer";
import { FoodMonthFocus } from "./food-month-focus";
import { formatMoney, formatPercentage, monthLabel, stackedAreaGeometry, useAnnualMonthFocus } from "./annual-month-focus";
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
  const observedFunding = food.months.map(({ showBenefitFunding, monthlyBenefitFunding }) =>
    showBenefitFunding && monthlyBenefitFunding !== null ? Number(monthlyBenefitFunding) : null);
  const fundingMaximum = Math.max(1, ...observedFunding.filter((amount): amount is number => amount !== null));
  const fundingSegments: Array<Array<{ x: number; y: number; month: string }>> = [];
  observedFunding.forEach((amount, index) => {
    if (amount === null) return;
    if (index === 0 || observedFunding[index - 1] === null) fundingSegments.push([]);
    fundingSegments[fundingSegments.length - 1]!.push({
      x: (index + .5) * geometry.width / food.months.length,
      y: 36 - amount / fundingMaximum * 29,
      month: food.months[index]!.month,
    });
  });
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
        <strong>{monthLabel(display.month)}</strong><b>{formatFoodMoney(display.money.total)}</b><span>Courses {formatFoodMoney(display.money.courses)}</span><span>Restaurants {formatFoodMoney(display.money.restaurants)}</span><span>Livraisons {formatFoodMoney(display.money.deliveries)}</span>{share === undefined ? null : <em>{share} hors courses</em>}{display.showBenefitFunding && display.monthlyBenefitFunding !== null ? <i>Swile · {formatMoney(display.monthlyBenefitFunding, true)} financés</i> : null}
      </div>}
      <AnnualMonthInteractionLayer domain="food" months={months} state={interaction.state} buttonRefs={interaction.monthButtons} onPreview={interaction.preview} onSelect={interaction.select} onMove={interaction.move} onClose={() => interaction.close()} />
    </div>
    {fundingSegments.length === 0 ? null : <div className={styles.swileFundingTrack} aria-label="Financement mensuel observé par Swile">
      <span className={styles.swileFundingLabel}>Swile · titres-restaurant</span>
      <svg viewBox={`0 0 ${geometry.width} 40`} preserveAspectRatio="none" aria-hidden="true">
        {fundingSegments.map((segment) => <g key={segment[0]!.month}>
          {segment.length > 1 ? <path className={styles.swileFundingArea} d={`M ${segment[0]!.x} 38 ${segment.map(({ x, y }) => `L ${x} ${y}`).join(" ")} L ${segment[segment.length - 1]!.x} 38 Z`} /> : null}
          <path className={styles.swileFundingLine} d={segment.map(({ x, y }, index) => `${index === 0 ? "M" : "L"} ${x} ${y}`).join(" ")} />
          {segment.map(({ x, y, month }) => <circle key={month} className={styles.swileFundingPoint} data-month={month} cx={x} cy={y} r={interaction.displayMonth === month ? 5 : 3} />)}
        </g>)}
      </svg>
      <ol className={styles.srOnly}>{food.months.map((month) => <li key={month.month}>{monthLabel(month.month)} : {month.showBenefitFunding && month.monthlyBenefitFunding !== null ? `${formatMoney(month.monthlyBenefitFunding, true)} financés par Swile` : "titres-restaurant non observés"}</li>)}</ol>
    </div>}
    {food.annotations.length === 0 ? null : <div className={styles.rhythmAnnotations}>{food.annotations.map((annotation) => <RhythmAnnotation key={annotation.annotationId} text={annotation.text} />)}</div>}
    {selected === undefined ? null : <FoodMonthFocus month={selected} annotations={food.annotations} connectorPosition={selectedIndex / 11 * 100} onClose={() => interaction.close()} />}
  </article>;
}
