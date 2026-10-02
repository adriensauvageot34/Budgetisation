"use client";
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { plannedAsset, rootAssetModule } from "@/domain/phase2/planned-assets";
import { applyCarResult, carEstimateProblems, isDerivedCarCost, selectCarVariant, routeVariantLabel, type PlannedCarResult } from "@/domain/phase2/planned-car";
import { editBuilderDraft, type BuilderState } from "@/domain/phase2/planned-builder";
import { startProjectCar, deferProjectTransportPrice } from "@/domain/phase2/planned-question-engine";
import type { PlannedPlaceOption } from "@/domain/phase2/planned-places";
import { InlineExpandableAssetGrid } from "./inline-expandable-asset-grid";
import { estimatePlannedRoute } from "./planned-expenses-actions";
import styles from "./project-wizard.module.css";

const money = (v: string) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(v));
const labels: Record<string, string> = { TRAIN: "train", BUS: "bus", PLANE: "flight", TAXI: "uber", CARPOOL: "carpool", OTHER: "other" };
export function ProjectTransportEditor({ builder, setBuilder, places, targetMonth, onContinue }: {
  builder: BuilderState; setBuilder: Dispatch<SetStateAction<BuilderState>>; places: readonly PlannedPlaceOption[]; targetMonth: string; onContinue: () => void;
}) {
  const [result, setResult] = useState<PlannedCarResult | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [details, setDetails] = useState(false), [fees, setFees] = useState(false), [destination, setDestination] = useState(""), [manualKm, setManualKm] = useState("");
  const route = builder.draft.context.route, mode = builder.draft.context.transportMode, draft = builder.draft;
  const root = rootAssetModule(draft.familyKey, draft.subtypeKey);
  const signature = mode === "CAR" && route ? JSON.stringify([route.stops.map(s => [s.label, s.placeId, s.endpointSource, s.childModule, s.distanceSource === "MANUAL" ? s.distanceToNextKm : null]), draft.plannedDate, draft.context.endDate, draft.context.visitTiming, route.plannedTime, route.preference, route.manualFuelPrice]) : "";
  const current = useRef(signature); current.current = signature;
  const draftRef = useRef(draft); draftRef.current = draft;
  const update = useRef(setBuilder); update.current = setBuilder;
  const lastRequested = useRef("");
  useEffect(() => {
    if (!signature || route?.liveEstimate || route?.fuelEstimate || lastRequested.current === signature) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      lastRequested.current = signature; setBusy(true); setError("");
      try { const value = await estimatePlannedRoute(targetMonth, draftRef.current); if (cancelled || current.current !== signature) return;
        setResult(value);
        update.current(state => { const next = applyCarResult(state.draft, value, () => crypto.randomUUID());
          return { ...editBuilderDraft(state, next), origins: { ...state.origins, ...Object.fromEntries(next.costItems.filter(isDerivedCarCost).map(i => [`cost.${i.id}`, "AUTO_DERIVED" as const])) } }; });
      } catch { if (!cancelled && current.current === signature) setError("Le trajet n’a pas pu être estimé. Précisez l’adresse ou les distances."); }
      finally { if (!cancelled) setBusy(false); }
    }, 300);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [signature, !!route?.liveEstimate, !!route?.fuelEstimate, targetMonth]);
  if (mode !== "CAR") {
    const asset = plannedAsset(`transport:${labels[mode ?? ""]}`);
    return <div className={styles.transportModule}><InlineExpandableAssetGrid builder={builder} setBuilder={setBuilder} assets={asset ? [asset] : []} path={[root]} wallets={[]} />
      <button className={styles.primary} disabled={!draft.costItems.some(i => i.assetKey === asset?.assetKey)} onClick={onContinue}>Continuer</button><button className={styles.textButton} onClick={() => { setBuilder(s => deferProjectTransportPrice(s, "Transport")); onContinue(); }}>Budget du transport à préciser</button></div>;
  }
  const snapshot = route?.liveEstimate;
  const ready = !!route?.fuelEstimate && !carEstimateProblems(draft).length;
  const refresh = () => { lastRequested.current = ""; setResult(null); setBuilder(state => editBuilderDraft(state, { ...state.draft,
    costItems: state.draft.costItems.filter(i => !isDerivedCarCost(i)), context: { ...state.draft.context, route: state.draft.context.route ? { ...state.draft.context.route, fuelEstimate: undefined, liveEstimate: undefined } : undefined } })); };
  if (fees) return <div className={styles.transportModule}><InlineExpandableAssetGrid builder={builder} setBuilder={setBuilder} assets={[plannedAsset("transport:toll")!, plannedAsset("transport:parking")!]} path={[root]} wallets={[]} /><button className={styles.primary} onClick={() => setFees(false)}>Revenir au trajet</button></div>;
  return <div className={styles.transportModule}>
    {!route ? <div className={styles.manual}><label>Destination<input className={styles.input} value={destination} placeholder="Nom et adresse du lieu" onChange={e => setDestination(e.target.value)} /></label><button className={styles.primary} disabled={!destination.trim()} onClick={() => setBuilder(state => startProjectCar(editBuilderDraft(state, { ...state.draft, context: { ...state.draft.context, place: { kind: "TEXT", label: destination.trim(), provenance: "USER_DECLARED_PROSPECTIVE" } } }), places))}>Calculer le trajet</button></div>
      : <><p className={styles.routeLine}>{route.stops.map(s => s.label).join(" → ")}</p>
        {busy && <p role="status">Estimation du trajet…</p>}
        {snapshot && <div className={styles.routeCards}>{(result?.variants ?? [snapshot]).slice(0, 2).map(variant => <button className={styles.routeCard} key={variant.preference} aria-pressed={snapshot.preference === variant.preference} onClick={() => { if (result) setBuilder(state => editBuilderDraft(state, applyCarResult(state.draft, selectCarVariant(result, variant), () => crypto.randomUUID()))); }}>
          <strong>{variant.preference === "AVOID_TOLLS" ? routeVariantLabel(variant) : "Trajet habituel"}</strong><span>{Math.round(Number(variant.route.distanceKm))} km · {variant.route.durationSeconds == null ? "durée non disponible" : `${Math.round(variant.route.durationSeconds / 60)} min`}</span>
          <span>Essence utilisée ≈ {variant.fuelEconomicCost ? money(variant.fuelEconomicCost) : "prix à préciser"}</span><span>Péage {variant.toll.amount == null ? "à préciser" : money(variant.toll.amount)}</span></button>)}</div>}
        {route.fuelEstimate && <p className={styles.small}>Carburant ≈ {money(route.fuelEstimate.cost)} d’usage économique, sans paiement bancaire prévu.{snapshot?.fuelPrice?.quality !== "FRESH" && " Prix de référence ancien ou de repli."}</p>}
        {snapshot?.toll.amount === null && <div className={styles.entityActions}><button className={styles.textButton} onClick={() => setBuilder(state => editBuilderDraft(state, { ...state.draft, context: { ...state.draft.context, route: { ...state.draft.context.route!, tollFreeConfirmed: true } } }))}>Confirmer que ce trajet n’a aucun péage</button><button className={styles.textButton} onClick={() => setBuilder(s => deferProjectTransportPrice(s, "Péages"))}>Chiffrer les péages plus tard</button></div>}
        {error && <p role="alert" className={styles.error}>{error}</p>}
        <div className={styles.entityActions}><button className={styles.textButton} onClick={() => setDetails(!details)}>{details ? "Replier" : "Ajuster les distances ou le prix"}</button><button className={styles.textButton} onClick={() => setFees(true)}>Parking ou péage</button><button className={styles.textButton} disabled={busy} onClick={refresh}>Recalculer</button></div>
        {details && <div className={styles.editorFields}><label>Distance par sens (km)<input className={styles.input} type="number" min="0.001" step="0.001" value={manualKm} onChange={e => setManualKm(e.target.value)} /></label><button className={styles.textButton} disabled={!manualKm || route.stops.length !== 3} onClick={() => { lastRequested.current = ""; setBuilder(state => editBuilderDraft(state, { ...state.draft, context: { ...state.draft.context, route: { ...state.draft.context.route!, liveEstimate: undefined, fuelEstimate: undefined,
          stops: state.draft.context.route!.stops.map((s, index, a) => index === a.length - 1 ? s : { ...s, distanceToNextKm: manualKm, distanceSource: "MANUAL", evidence: undefined, estimatedFuelLiters: undefined }) } } })); }}>Utiliser ces distances</button>
          <label>Prix carburant (€ / L)<input className={styles.input} type="number" min="0.001" max="9.999" step="0.001" value={route.manualFuelPrice ?? ""} onChange={e => { lastRequested.current = ""; setBuilder(state => editBuilderDraft(state, { ...state.draft, context: { ...state.draft.context, route: { ...state.draft.context.route!, manualFuelPrice: e.target.value || undefined, fuelEstimate: undefined, liveEstimate: undefined } } })); }} /></label></div>}
      </>}
    <div className={styles.editorActions}><button className={styles.primary} disabled={!ready || busy} onClick={onContinue}>Continuer</button></div>
  </div>;
}
