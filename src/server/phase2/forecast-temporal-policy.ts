import "server-only";
import { FORECAST_MODEL_VERSION, forecastHorizon } from "./forecast-statistics";

export type ForecastTemporalMode = "FULL_MONTH_SAFE" | "AS_OF_TEMPORAL";
export const DEFAULT_FORECAST_TEMPORAL_MODE: ForecastTemporalMode = "FULL_MONTH_SAFE";

/** Single product switch, server-side only. An explicit mode is also available to replays/tests. */
export function activeForecastTemporalMode(): ForecastTemporalMode {
  const configured = process.env.PHASE2_FORECAST_TEMPORAL_MODE;
  if (!configured) return DEFAULT_FORECAST_TEMPORAL_MODE;
  if (configured === "FULL_MONTH_SAFE" || configured === "AS_OF_TEMPORAL") return configured;
  throw new TypeError("INVALID_FORECAST_TEMPORAL_MODE");
}

export function forecastTemporalPolicy(mode: ForecastTemporalMode = activeForecastTemporalMode()) {
  const preserveMonthlyHabit = mode === "FULL_MONTH_SAFE";
  return Object.freeze({ mode, preserveMonthlyHabit, behavioralExpiration: !preserveMonthlyHabit,
    // Preserve the existing temporal version and its checkpoints on reactivation.
    modelVersion: preserveMonthlyHabit ? `${FORECAST_MODEL_VERSION}/full-month-safe@v1` : FORECAST_MODEL_VERSION,
    calibrationHorizon: (asOf: string, month: string) => preserveMonthlyHabit ? "FULL_MONTH" : forecastHorizon(asOf, month),
  });
}
