import { rankDiscoveryCandidates } from './catalog-discovery';
type Choice = { selectionId: string; label: string };
type CinemaExtra = Choice & { locked: boolean };
type CinemaTransport = { label: string; iconKey: string; selectionId?: string };

type Candidate = {
  conceptKey: string;
  category: "ticket" | "session" | "extra" | "transport";
  action: "ADD" | "EDIT" | "CONFIGURE";
  label: string;
  reason: string;
  iconKey: string;
  sourceRow?: number;
  selectionId?: string;
  extraLabel?: string;
  priority: number;
  allowed: boolean;
};

const extraLabels = [
  { conceptKey: "popcorn", label: "Popcorn", priority: 3 },
  { conceptKey: "boisson", label: "Boisson", priority: 4 },
] as const;
const cinemaLabel = new Intl.Collator("fr", { sensitivity: "base" });
export const sameCinemaExtra = (left: string, right: string) => cinemaLabel.compare(left.trim(), right.trim()) === 0;

type CinemaSuggestionInput = {
  contextOccurrenceId: string;
  writable: boolean;
  ticketAllowed: boolean;
  ticket?: Choice;
  dayChosen: boolean;
  placeChosen: boolean;
  extrasAllowed: boolean;
  extras: readonly CinemaExtra[];
  transport?: CinemaTransport;
  complementsOnly: boolean;
  dismissed: readonly string[];
};

export function cinemaSuggestions(input: CinemaSuggestionInput) {
  const { ticket, transport, dayChosen, placeChosen } = input;
  const candidates: Candidate[] = [
    { conceptKey: "billet-cinema", category: "ticket", sourceRow: 329,
      action: ticket ? "EDIT" : "ADD", selectionId: ticket?.selectionId,
      label: ticket ? `Modifier · ${ticket.label}` : "Billet de cinéma — Préparer",
      reason: ticket ? "Billet déjà choisi pour cette sortie" : "Billet facultatif pour cette sortie",
      iconKey: "activity", priority: 0, allowed: input.ticketAllowed },
    { conceptKey: "jour-seance", category: "session", action: "CONFIGURE",
      label: "Séance — Préciser le jour", reason: "Le jour de cette séance reste à choisir",
      iconKey: "activity", priority: 1, allowed: input.writable && !dayChosen },
    { conceptKey: "lieu-cinema", category: "session", action: "CONFIGURE",
      label: "Cinéma — Préciser le lieu", reason: "Le lieu de cette séance reste à choisir",
      iconKey: "family-visit", priority: 1, allowed: input.writable && !placeChosen },
    ...extraLabels.map(({ conceptKey, label, priority }): Candidate => {
      const matches = input.extras.filter(extra => sameCinemaExtra(extra.label, label));
      const chosen = matches[0];
      return { conceptKey, category: "extra", action: chosen ? "EDIT" : "ADD", selectionId: chosen?.selectionId, extraLabel: label,
        label: chosen ? `${chosen.label} — Modifier ce complément` : `${label} — Préparer un supplément`,
        reason: chosen ? "Complément déjà choisi pour cette sortie" : "Complément facultatif pour cette sortie",
        iconKey: "purchase", priority, allowed: input.extrasAllowed && matches.length <= 1 && !chosen?.locked };
    }),
    { conceptKey: transport?.selectionId ? "trajet-cinema" : "taxi", category: "transport", sourceRow: transport?.selectionId ? undefined : 499,
      action: transport?.selectionId ? "EDIT" : "CONFIGURE", selectionId: transport?.selectionId,
      label: transport?.selectionId ? `${transport.label} — Modifier le trajet` : "Taxi — Configurer le trajet",
      reason: transport?.selectionId ? "Trajet déjà choisi pour cette sortie"
        : placeChosen ? "Le lieu est choisi, le trajet reste à préciser" : "Trajet facultatif pour cette sortie",
      iconKey: transport?.iconKey ?? "activity", priority: placeChosen || transport?.selectionId ? 2 : 5, allowed: !!transport },
  ];

  return rankDiscoveryCandidates(candidates
    .filter(candidate => candidate.allowed && (!input.complementsOnly || candidate.category === "extra" || candidate.category === "transport"))
    .map(candidate => ({ ...candidate, contextOccurrenceId: input.contextOccurrenceId,
      key: [candidate.conceptKey, candidate.action, input.contextOccurrenceId, candidate.selectionId].join(":") }))
    .filter(candidate => !input.dismissed.includes(candidate.key))
    .map(candidate=>({...candidate,tiers:[candidate.priority]})))
    .slice(0, 4);
}

export type CinemaSuggestion = ReturnType<typeof cinemaSuggestions>[number];
