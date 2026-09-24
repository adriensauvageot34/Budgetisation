"use client";

import { useCallback, useMemo, useReducer, useRef } from "react";

export type AnnualMonthFocusState = Readonly<{
  selectedMonth?: string;
  previewMonth?: string;
  rovingMonth: number;
}>;

export type AnnualMonthFocusAction =
  | Readonly<{ type: "PREVIEW"; month?: string }>
  | Readonly<{ type: "SELECT"; month: string; index: number }>
  | Readonly<{ type: "MOVE"; index: number }>
  | Readonly<{ type: "CLOSE" }>;

export function annualMonthFocusReducer(state: AnnualMonthFocusState, action: AnnualMonthFocusAction): AnnualMonthFocusState {
  if (action.type === "PREVIEW") return { ...state, previewMonth: action.month };
  if (action.type === "MOVE") return { ...state, rovingMonth: action.index };
  if (action.type === "CLOSE") return { ...state, selectedMonth: undefined, previewMonth: undefined };
  return {
    ...state,
    rovingMonth: action.index,
    previewMonth: action.month,
    selectedMonth: state.selectedMonth === action.month ? undefined : action.month,
  };
}

export function nextRovingMonthIndex(current: number, key: string, count: number): number | undefined {
  if (count < 1) return undefined;
  if (key === "ArrowRight") return (current + 1) % count;
  if (key === "ArrowLeft") return (current - 1 + count) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return undefined;
}

export function useAnnualMonthFocus(months: readonly string[]) {
  const [state, dispatch] = useReducer(annualMonthFocusReducer, { rovingMonth: 0 });
  const monthButtons = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = state.selectedMonth === undefined ? state.rovingMonth : Math.max(0, months.indexOf(state.selectedMonth));
  const close = useCallback((restoreFocus = true) => {
    const target = monthButtons.current[selectedIndex];
    dispatch({ type: "CLOSE" });
    if (restoreFocus) window.requestAnimationFrame(() => target?.focus({ preventScroll: true }));
  }, [selectedIndex]);
  return useMemo(() => ({
    state,
    monthButtons,
    displayMonth: state.previewMonth ?? state.selectedMonth,
    preview: (month?: string) => dispatch({ type: "PREVIEW", month }),
    select: (month: string, index: number) => dispatch({ type: "SELECT", month, index }),
    move: (index: number) => dispatch({ type: "MOVE", index }),
    close,
  }), [close, state]);
}

const monthFormatter = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
const shortMonthFormatter = new Intl.DateTimeFormat("fr-FR", { month: "short", timeZone: "UTC" });
const dayFormatter = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", timeZone: "UTC" });
const moneyExactFormatter = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const moneyRoundedFormatter = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const integerFormatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const percentageFormatter = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 0 });

function utcDate(value: string): Date {
  const normalized = value.length === 7 ? `${value}-01` : value;
  return new Date(`${normalized}T00:00:00Z`);
}

export function monthLabel(value: string): string {
  const label = monthFormatter.format(utcDate(value));
  return label.charAt(0).toLocaleUpperCase("fr-FR") + label.slice(1);
}

export function shortMonthLabel(value: string): string {
  return shortMonthFormatter.format(utcDate(value)).replace(".", "");
}

export function dayLabel(value: string): string {
  return dayFormatter.format(utcDate(value)).replace(".", "");
}

export function formatMoney(value: string, exact = false): string {
  return (exact ? moneyExactFormatter : moneyRoundedFormatter).format(Number(value));
}

export function formatInteger(value: string | number): string {
  return integerFormatter.format(Number(value));
}

export function formatPercentage(value: string | null): string | undefined {
  return value === null ? undefined : percentageFormatter.format(Number(value));
}

export type StackedAreaGeometry = Readonly<{
  paths: readonly string[];
  xPositions: readonly number[];
  topPositions: readonly number[];
  width: number;
  height: number;
}>;

type Point = readonly [number, number];

function curve(points: readonly Point[]): string {
  if (points.length === 0) return "";
  return points.slice(1).reduce((path, point, index) => {
    const previous = points[index]!;
    const middle = (previous[0] + point[0]) / 2;
    return `${path} C ${middle} ${previous[1]}, ${middle} ${point[1]}, ${point[0]} ${point[1]}`;
  }, `M ${points[0]![0]} ${points[0]![1]}`);
}

export function stackedAreaGeometry(rows: readonly (readonly number[])[], width = 1200, height = 268): StackedAreaGeometry {
  const chartTop = 16;
  const chartBottom = height - 34;
  const totals = rows.map((row) => row.reduce((sum, value) => sum + Math.max(0, value), 0));
  const maximum = Math.max(1, ...totals);
  const xPositions = rows.map((_, index) => rows.length === 1 ? width / 2 : index * width / (rows.length - 1));
  const y = (value: number) => chartBottom - (Math.max(0, value) / maximum) * (chartBottom - chartTop);
  const layerCount = rows[0]?.length ?? 0;
  const boundaries: Point[][] = [xPositions.map((x) => [x, chartBottom] as const)];
  for (let layer = 0; layer < layerCount; layer += 1) {
    boundaries.push(rows.map((row, index) => {
      let total = 0;
      for (let item = 0; item <= layer; item += 1) total += Math.max(0, row[item] ?? 0);
      return [xPositions[index]!, y(total)] as const;
    }));
  }
  const paths = Array.from({ length: layerCount }, (_, index) => {
    const top = boundaries[index + 1]!;
    const bottom = [...boundaries[index]!].reverse();
    return `${curve(top)} L ${bottom[0]![0]} ${bottom[0]![1]} ${curve(bottom).replace(/^M [^C]+/u, "")} Z`;
  });
  return { paths, xPositions, topPositions: totals.map(y), width, height };
}
