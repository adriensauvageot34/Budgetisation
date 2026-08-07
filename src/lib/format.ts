import type { MonthKey } from "@/domain/budget";

const currencyFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const preciseCurrencyFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactCurrencyFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  notation: "compact",
  maximumFractionDigits: 1,
});

const monthFormatter = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
});

const shortMonthFormatter = new Intl.DateTimeFormat("fr-FR", {
  month: "short",
});

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function formatCurrency(value: number, precise = false) {
  return (precise ? preciseCurrencyFormatter : currencyFormatter).format(value);
}

export function formatCompactCurrency(value: number) {
  return compactCurrencyFormatter.format(value);
}

export function monthToDate(month: MonthKey) {
  return new Date(`${month}-02T12:00:00`);
}

export function formatMonth(month: MonthKey) {
  return monthFormatter.format(monthToDate(month));
}

export function formatShortMonth(month: MonthKey) {
  return shortMonthFormatter.format(monthToDate(month)).replace(".", "");
}

export function formatDate(date: string) {
  return dateFormatter.format(new Date(`${date}T12:00:00`));
}

export function formatPercent(value: number, withSign = false) {
  const formatted = new Intl.NumberFormat("fr-FR", {
    style: "percent",
    maximumFractionDigits: 0,
    signDisplay: withSign ? "exceptZero" : "auto",
  }).format(value);
  return formatted.replace(/\s/g, " ");
}

export function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
