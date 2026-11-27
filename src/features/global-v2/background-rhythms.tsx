"use client";

import { expandGlobalBackgroundFoodReadModel, type GlobalBackgroundRhythmsReadModel } from "@/query-api/global-v2";
import { useMemo } from "react";
import { useGlobalV2Resource } from "./use-global-resource";
import type { GlobalV2VisitRuntime } from "./visit-runtime";
import { BackgroundRhythmsSkeleton } from "./background-rhythms-skeleton";
import { FoodRhythmRiver } from "./food-rhythm-river";
import { CarMobilityRoute } from "./car-mobility-route";
import styles from "./background-rhythms.module.css";

const request = { resource: "analysis_global_background_rhythms", params: {} } as const;

export function useBackgroundRhythms(runtime: GlobalV2VisitRuntime, enabled: boolean) {
  return useGlobalV2Resource<GlobalBackgroundRhythmsReadModel>(runtime, request, enabled, "BACKGROUND");
}

export function BackgroundRhythms({ runtime, result, view, selectedMonth, onMonthChange }: {
  readonly runtime: GlobalV2VisitRuntime;
  readonly result: ReturnType<typeof useBackgroundRhythms>;
  readonly view: "food" | "car";
  readonly selectedMonth?: string;
  readonly onMonthChange: (month: string | undefined) => void;
}) {
  const model = result.state.status === "READY" ? result.state.data : result.state.status === "ERROR" ? result.state.previousData : undefined;
  const food = useMemo(() => view === "food" && model ? expandGlobalBackgroundFoodReadModel(model) : undefined, [model, view]);
  const focusTimelineDestination = (eventRef: string) => {
    window.dispatchEvent(new CustomEvent("global-v2:focus-life-event", { detail: { eventRef } }));
  };

  return <div className={styles.backgroundRhythms} data-workspace-rhythm aria-label={view === "food" ? "Alimentation" : "Voiture"}>
    {model === undefined
      ? result.state.status === "ERROR" ? <div className={styles.backgroundError} role="alert"><p>Ces données n’ont pas pu être chargées.</p><button type="button" onClick={result.retry}>Réessayer</button></div> : <BackgroundRhythmsSkeleton />
      : view === "car" ? <CarMobilityRoute car={model.carMobility} runtime={runtime} onTimelineDestination={focusTimelineDestination} selectedMonth={selectedMonth} onMonthChange={onMonthChange} />
        : food && <FoodRhythmRiver food={food} selectedMonth={selectedMonth} onMonthChange={onMonthChange} />}
  </div>;
}
