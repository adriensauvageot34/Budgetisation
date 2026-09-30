/** Calendar captions only. Never infer an owner or a contract's use from its amount. */
export type CalendarMetadata = Readonly<{ fullLabel?: string; calendarLabel?: string;
  brandKey?: string | null; group?: string; kind?: string; provenance?: string;
  dateEvidenceCount?: number; freshnessDate?: string | null; confidence?: string }>;

const brands = [
  ["sfr", /\bSFR\b/iu, "SFR"], ["edf", /\bEDF\b/iu, "EDF"],
  ["google", /Google/iu, "Google"], ["openai", /ChatGPT|OpenAI/iu, "ChatGPT"],
  ["max", /\bMax\b/iu, "Max"], ["pacifica", /Pacifica/iu, "Pacifica"],
  ["credit-agricole", /Crédit Agricole/iu, "CA"], ["nexity", /Nexity/iu, "Nexity"],
] as const;
const humanCaptions = [
  [/loyer/iu, "Loyer"], [/Google\s*One/iu, "Google One"], [/ChatGPT/iu, "ChatGPT"],
  [/électricit[eé]|\bEDF\b/iu, "Électricité"], [/\beau\b/iu, "Eau"], [/Ornikar/iu, "Ornikar"],
  [/internet|fibre|\bbox\b/iu, "Internet"], [/responsabilit[eé]\s+civile/iu, "Responsabilité civile"],
  [/habitation/iu, "Habitation"], [/(protection\s+)?juridique/iu, "Juridique"],
  [/\bauto(mobile)?\b/iu, "Assurance auto"], [/\bSMS\b/iu, "Alertes SMS"],
  [/tenue\s+(de\s+)?compte/iu, "Tenue de compte"], [/offre\s+essentiel(le)?/iu, "Offre Essentiel"],
] as const;

export function calendarMetadata(label: string, source: CalendarMetadata = {}): CalendarMetadata {
  const brand = brands.find(([, pattern]) => pattern.test(label));
  const normalized = label.replace(/\s+/gu, " ").trim();
  const caption = humanCaptions.find(([pattern]) => pattern.test(normalized))?.[1];
  const mobile = /\bmobile\b/iu.test(normalized);
  const namedOwner = mobile ? /\b(Adrien|Manon)\b/iu.exec(normalized)?.[1] : undefined;
  let short: string = mobile ? `Mobile${namedOwner ? ` ${namedOwner}` : ""}` : caption ?? normalized;
  if (!caption && !mobile && brand) {
    // Unknown contract use stays unknown. Do not expose fragments or infer a
    // phone, internet connection, owner or insurance coverage from its ID/amount.
    const neutral: Record<string, string> = { sfr: "Abonnement", pacifica: "Assurance",
      "credit-agricole": "Service bancaire", nexity: "Échéance" };
    short = neutral[brand[0]] ?? brand[2];
  }
  return { ...source, fullLabel: label, calendarLabel: short, brandKey: brand?.[0] ?? null };
}
