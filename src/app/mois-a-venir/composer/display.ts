export const money = (amount: unknown) => typeof amount === "string" ? new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(Number(amount)) : "À préciser";
export const monthLabel = (month: string) => new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T12:00:00Z`));
export const knowledgeLabel = (knowledge: string) => ({ KNOWN: "Connu", DECLARED: "Déclaré", ESTIMATED: "Repère", PARTIAL: "À compléter", UNKNOWN: "À préciser", NOT_APPLICABLE: "Sans objet" })[knowledge] ?? "À préciser";
export const quantityLabel = (count: unknown) => typeof count === "string" ? new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(Number(count)) : "À préciser";
