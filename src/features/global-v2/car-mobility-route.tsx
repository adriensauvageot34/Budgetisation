"use client";

import { useMemo } from "react";
import type { GlobalBackgroundRhythmMonthDetailReadModel, GlobalBackgroundRhythmsReadModel } from "@/query-api/global-v2";
import { useGlobalV2Resource } from "./use-global-resource";
import type { GlobalV2VisitRuntime } from "./visit-runtime";
import { AnnualMonthInteractionLayer } from "./annual-month-interaction-layer";
import { CarMonthFocus } from "./car-month-focus";
import { formatInteger, formatMoney, monthLabel, stackedAreaGeometry, useAnnualMonthFocus } from "./annual-month-focus";
import styles from "./background-rhythms.module.css";

export function CarMobilityRoute({ car, runtime, onTimelineDestination }: {
  readonly car: GlobalBackgroundRhythmsReadModel["carMobility"];
  readonly runtime: GlobalV2VisitRuntime;
  readonly onTimelineDestination: (eventRef: string) => void;
}) {
  const months = useMemo(() => car.months.map(({ month }) => month), [car.months]);
  const interaction = useAnnualMonthFocus(months);
  const geometry = useMemo(() => stackedAreaGeometry(car.months.map(({ usageComposition }) => [
    Number(usageComposition.aroundWorkEstimatedFuelCost),
    Number(usageComposition.outsideWorkEstimatedFuelCost),
    Number(usageComposition.unresolvedEstimatedFuelCost),
  ])), [car.months]);
  const display = car.months.find(({ month }) => month === interaction.displayMonth);
  const selected = car.months.find(({ month }) => month === interaction.state.selectedMonth);
  const selectedIndex = selected === undefined ? -1 : months.indexOf(selected.month);
  const detailRequest = useMemo(() => ({ resource: "analysis_global_background_rhythm_month_detail" as const, params: { domain: "CAR_MOBILITY", month: selected?.month ?? months[0]! } }), [months, selected?.month]);
  const detailResult = useGlobalV2Resource<GlobalBackgroundRhythmMonthDetailReadModel>(runtime, detailRequest, selected?.detailAvailable === true, "DIRECT");
  const detailCandidate = detailResult.state.status === "READY" ? detailResult.state.data : detailResult.state.status === "ERROR" ? detailResult.state.previousData : undefined;
  const detail = detailCandidate?.month === selected?.month ? detailCandidate : undefined;
  const maximumPaid = Math.max(1, ...car.months.map(({ observedFuelPaid }) => Number(observedFuelPaid.amount)));
  return <article className={styles.rhythmCard} data-rhythm-domain="car">
    <header className={styles.rhythmCardHeader}><div><span className={styles.cardEyebrow}>Mobilité</span><h4>Notre mobilité en voiture</h4><p>Ce que nos déplacements en voiture ont consommé au fil de l’année.</p></div><div className={styles.annualKpi}><strong>≈{formatMoney(car.annual.modeledUsage.estimatedFuelCost)}</strong><span>de carburant estimé pour nos déplacements</span><small>{formatInteger(car.annual.modeledUsage.distanceKm)} km reconstitués · ≈{formatInteger(car.annual.modeledUsage.estimatedFuelLiters)} L estimés</small></div></header>
    <div className={styles.legend} aria-label="Légende"><span data-tone="car-work">Travail / autour du travail</span><span data-tone="car-outside">Hors travail</span><span data-tone="car-unresolved">Non classé</span></div>
    <div className={`${styles.annualVisualBody} ${styles.carAnnualVisual}`}>
      <svg className={styles.annualRiver} viewBox={`0 0 ${geometry.width} ${geometry.height}`} preserveAspectRatio="none" aria-hidden="true">
        <path className={styles.carWork} d={geometry.paths[0]} />
        <path className={styles.carOutside} d={geometry.paths[1]} />
        <path className={styles.carUnresolved} d={geometry.paths[2]} />
      </svg>
      {selectedIndex < 0 ? null : <span className={styles.selectedMonthGuide} style={{ left: `${selectedIndex / 11 * 100}%` }} aria-hidden />}
      {display === undefined ? null : <div className={styles.chartTooltip} style={{ left: `${months.indexOf(display.month) / 11 * 100}%` }} role="status"><strong>{monthLabel(display.month)}</strong><b>≈{formatMoney(display.modeledUsage.estimatedFuelCost)}</b><span>Travail {formatMoney(display.usageComposition.aroundWorkEstimatedFuelCost, true)}</span><span>Hors travail {formatMoney(display.usageComposition.outsideWorkEstimatedFuelCost, true)}</span>{display.usageComposition.classificationStatus === "COMPLETE" ? null : <em>{formatMoney(display.usageComposition.unresolvedEstimatedFuelCost, true)} non classés</em>}<span>{formatInteger(display.modeledUsage.distanceKm)} km · ≈{formatInteger(display.modeledUsage.estimatedFuelLiters)} L</span><i>{formatMoney(display.observedFuelPaid.amount, true)} payés à la pompe</i></div>}
      <AnnualMonthInteractionLayer domain="car" months={months} state={interaction.state} buttonRefs={interaction.monthButtons} onPreview={interaction.preview} onSelect={interaction.select} onMove={interaction.move} onClose={() => interaction.close()} />
      <section className={styles.fuelPaidRail} aria-label="Paiements mensuels à la pompe"><header><div><h5>Paiements à la pompe</h5><p>Les paiements à la pompe suivent le calendrier des achats de carburant et sont distincts de l’usage estimé de la voiture.</p></div><strong>{formatMoney(car.annual.observedFuelPaid.amount, true)}<span>payés sur l’année</span></strong></header><div>{car.months.map(({ month, observedFuelPaid }) => <span key={month} title={`${monthLabel(month)} : ${formatMoney(observedFuelPaid.amount, true)}`}><i style={{ height: `${Number(observedFuelPaid.amount) / maximumPaid * 100}%` }} /><small>{formatMoney(observedFuelPaid.amount, true)}</small></span>)}</div></section>
    </div>
    {selected === undefined ? null : <CarMonthFocus month={selected} detail={detail} detailStatus={selected.detailAvailable ? detailResult.state.status : "IDLE"} connectorPosition={selectedIndex / 11 * 100} retry={detailResult.retry} onClose={() => interaction.close()} onTimelineDestination={onTimelineDestination} />}
  </article>;
}
