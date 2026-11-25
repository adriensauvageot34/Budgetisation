"use client";

import { Info } from "lucide-react";
import { expandGlobalBackgroundFoodReadModel, type GlobalBackgroundRhythmsReadModel } from "@/query-api/global-v2";
import { useMemo } from "react";
import { useGlobalV2Resource, useNearViewport } from "./use-global-resource";
import type { GlobalV2VisitRuntime } from "./visit-runtime";
import { BackgroundRhythmsSkeleton } from "./background-rhythms-skeleton";
import { FoodRhythmRiver } from "./food-rhythm-river";
import { CarMobilityRoute } from "./car-mobility-route";
import styles from "./background-rhythms.module.css";

export function BackgroundRhythms({ runtime, onMethod, view }: { readonly runtime: GlobalV2VisitRuntime; readonly onMethod: () => void; readonly view: "food" | "car" }) {
  const nearViewport = useNearViewport("100% 0px");
  const request = useMemo(() => ({ resource: "analysis_global_background_rhythms" as const, params: {} }), []);
  const result = useGlobalV2Resource<GlobalBackgroundRhythmsReadModel>(runtime, request, nearViewport.near, "BACKGROUND");
  const model = result.state.status === "READY" ? result.state.data : result.state.status === "ERROR" ? result.state.previousData : undefined;
  const food = useMemo(() => model === undefined ? undefined : expandGlobalBackgroundFoodReadModel(model), [model]);
  const focusTimelineDestination = (eventRef: string) => {
    window.dispatchEvent(new CustomEvent("global-v2:focus-life-event", { detail: { eventRef } }));
  };
  return <section ref={nearViewport.ref} className={styles.backgroundRhythms} data-workspace-rhythm aria-label={view === "food" ? "Alimentation" : "Voiture"}>
    <header className={styles.backgroundHeader}><button type="button" onClick={onMethod}><Info aria-hidden size={15} /> Fiabilité & méthode</button></header>
    {model === undefined || food === undefined ? result.state.status === "ERROR" ? <div className={styles.backgroundError} role="alert"><p>Ces données n’ont pas pu être chargées.</p><button type="button" onClick={result.retry}>Réessayer</button></div> : <BackgroundRhythmsSkeleton /> : <div className={styles.rhythmCards}>{view === "food" ? <FoodRhythmRiver food={food} /> : <CarMobilityRoute car={model.carMobility} runtime={runtime} onTimelineDestination={focusTimelineDestination} />}</div>}
  </section>;
}
