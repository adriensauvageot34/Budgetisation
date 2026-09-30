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
  [/internet|fibre|\bbox\b/iu, "Internet"], [/responsabilit[eé]\s+civile/iu, "Resp. civile"],
  [/habitation/iu, "Habitation"], [/(protection\s+)?juridique/iu, "Juridique"],
  [/\bauto(mobile)?\b/iu, "Auto"], [/\bSMS\b/iu, "Alertes SMS"],
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
    const description = normalized.replace(new RegExp(brand[1].source, "giu"), "")
      .replace(/\b(prélèvement|paiement|abonnement|assurance|cotisation|contrat|facture)\b/giu, "")
      .replace(/^[\s·:–—-]+|[\s·:–—-]+$/gu, "").trim();
    // Opaque references stay opaque, but short. The full value remains in Details.
    const identifier = /[A-Z0-9][A-Z0-9-]{5,}/iu.exec(description.replace(/^n[°o]\s*/iu, ""))?.[0];
    short = identifier ? `…${identifier.slice(-6)}` : description || brand[2];
    if (short.length > 22) short = `Réf. …${description.replace(/\s/gu, "").slice(-6)}`;
  }
  return { ...source, fullLabel: label, calendarLabel: short, brandKey: brand?.[0] ?? null };
}
