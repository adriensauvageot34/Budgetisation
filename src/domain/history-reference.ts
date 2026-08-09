import type { AnalyticalEntry } from "@/domain/analytical-entries";
import type { MonthKey } from "@/domain/budget";

export function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function quantile(values: number[], probability: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * probability;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

export function mad(values: number[]) {
  const center = median(values);
  return median(values.map((value) => Math.abs(value - center)));
}

export function monthlyEntryTotals(entries: AnalyticalEntry[], months: MonthKey[]) {
  return months.map((month) => ({
    month,
    total: entries.filter((entry) => entry.analysisMonth === month).reduce((sum, entry) => sum + entry.amount, 0),
    routine: entries.filter((entry) => entry.analysisMonth === month && entry.lifeLayer === "Routine").reduce((sum, entry) => sum + entry.amount, 0),
  }));
}

export function buildHistoryReference(entries: AnalyticalEntry[], months: MonthKey[]) {
  const rows = monthlyEntryTotals(entries, months);
  const totals = rows.map((row) => row.total);
  const routine = rows.map((row) => row.routine);
  const recentTrend = months.length >= 6
    ? median(routine.slice(-3)) - median(routine.slice(-6, -3))
    : null;
  return {
    months,
    rows,
    medianTotal: median(totals),
    meanTotal: totals.length ? totals.reduce((sum, value) => sum + value, 0) / totals.length : 0,
    medianRoutine: median(routine),
    routineQ1: months.length >= 4 ? quantile(routine, 0.25) : null,
    routineQ3: months.length >= 4 ? quantile(routine, 0.75) : null,
    recentTrend,
    outsideRoutine: entries.filter((entry) => entry.lifeLayer !== "Routine").reduce((sum, entry) => sum + entry.amount, 0),
  };
}

export function historicalReferenceMonths(allMonths: MonthKey[], analyzedMonth: MonthKey) {
  return allMonths.filter((month) => month < analyzedMonth).slice(-12);
}

export function robustSeriesProfile(values: number[]) {
  const active = values.filter((value) => value > 0);
  const center = median(values);
  const activeCenter = median(active);
  const activeMad = active.length >= 3 ? mad(active) : null;
  return {
    values,
    medianAcrossMonths: center,
    mean: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0,
    activeMonths: active.length,
    frequency: values.length ? active.length / values.length : 0,
    medianWhenActive: activeCenter,
    variability: activeMad === null || activeCenter === 0 ? null : activeMad / activeCenter,
  };
}

export function mainVariationDriver(entries: AnalyticalEntry[], months: MonthKey[]) {
  const categories = [...new Set(entries.map((entry) => entry.category))];
  return categories.map((category) => {
    const values = months.map((month) => entries.filter((entry) => entry.category === category && entry.analysisMonth === month).reduce((sum, entry) => sum + entry.amount, 0));
    const center = median(values);
    return { category, contribution: values.reduce((sum, value) => sum + Math.abs(value - center), 0), center };
  }).sort((a, b) => b.contribution - a.contribution)[0] ?? null;
}

export function robustHeatmapIntensity(value: number, values: number[]) {
  const center = median(values);
  const dispersion = mad(values);
  const scale = dispersion > 0 ? dispersion * 2 : Math.max(center, 1);
  return Math.max(-1, Math.min(1, (value - center) / scale));
}
