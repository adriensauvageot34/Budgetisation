/** Presentation only: no arithmetic, eligibility or persistence rules. */
export const controlMoney = (value: string | null | undefined, exact = false) => value == null ? "À confirmer" : new Intl.NumberFormat("fr-FR", {
  style: "currency", currency: "EUR", minimumFractionDigits: exact ? 2 : 0, maximumFractionDigits: exact ? 2 : 0,
}).format(Number(value));
export const controlDate = (value: string | null | undefined, year = false) => !value || !/^\d{4}-\d{2}-\d{2}/u.test(value) ? "à confirmer" : new Intl.DateTimeFormat("fr-FR", {
  day: "numeric", month: "long", ...(year ? { year: "numeric" as const } : {}), timeZone: "UTC",
}).format(new Date(`${value.slice(0, 10)}T12:00:00Z`));
export const controlMonth = (value: string) => new Intl.DateTimeFormat("fr-FR", { month: "long", timeZone: "UTC" }).format(new Date(`${value}-01T12:00:00Z`));
export const controlResourceLabel = (value: string) => value.replace(/^(?:Nextly|Nexity)\s*[–—-]\s*/iu, "");
