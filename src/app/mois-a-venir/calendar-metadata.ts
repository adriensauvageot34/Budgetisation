/** Presentation metadata only, computed once at the projection boundary.
 * Contract identifiers stay visible when no trustworthy human alias exists. */
export type CalendarMetadata = Readonly<{ fullLabel?: string; calendarLabel?: string;
  brandKey?: string | null; group?: string; kind?: string; provenance?: string;
  dateEvidenceCount?: number; freshnessDate?: string | null; confidence?: string }>;

const brands = [
  ["sfr", /\bSFR\b/iu, "SFR"], ["edf", /\bEDF\b/iu, "EDF"],
  ["google", /Google/iu, "Google"], ["openai", /ChatGPT|OpenAI/iu, "ChatGPT"],
  ["max", /\bMax\b/iu, "Max"], ["pacifica", /Pacifica/iu, "Pacifica"],
  ["credit-agricole", /Crédit Agricole/iu, "Crédit Agricole"], ["nexity", /Nexity/iu, "Nexity"],
] as const;

export function calendarMetadata(label: string, source: CalendarMetadata = {}): CalendarMetadata {
  const brand = brands.find(([, pattern]) => pattern.test(label));
  let short = label.replace(/\s+/gu, " ").trim();
  if (/loyer/iu.test(label)) short = "Loyer";
  else if (/Google\s*One/iu.test(label)) short = "Google One";
  else if (/ChatGPT/iu.test(label)) short = "ChatGPT";
  else if (/\bEDF\b/iu.test(label)) short = "Électricité";
  else if (/\beau\b/iu.test(label) && !brand) short = "Eau";
  else if (/Ornikar/iu.test(label)) short = "Ornikar";
  else if (brand) {
    // Only terms actually present in the canonical label may name the contract.
    const description = label.replace(new RegExp(brand[1].source, "giu"), "").replace(/^\s*[·:–—-]\s*/u, "")
      .replace(/\b(prélèvement|paiement|abonnement|assurance|cotisation|contrat|facture)\b/giu, "")
      .replace(/^[\s·:–—-]+|[\s·:–—-]+$/gu, "").replace(/\s+/gu, " ");
    short = description ? `${brand[2]} · ${description}` : brand[2];
  }
  return { ...source, fullLabel: label, calendarLabel: short, brandKey: brand?.[0] ?? null };
}
