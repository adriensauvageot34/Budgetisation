# P05 — Cadences, routines et fermeture temporelle

## Baseline et périmètre

- Branche : `main`.
- Baseline P04 : `901f329ccb18674df93996a0088a5cb707551ad1`, working tree propre au démarrage.
- Entrée : `GLOBAL_PHASE_A2/A3`, `GLOBAL_PHASE_B_CORE` et les trois gates P04 sont `PASS`.
- Autorité : Master SHA-256 `8b0d0ff2381599c4495645cd1dd1ebf2fa0d027fc3113be78aee945fae12f8be`, Module 4, paragraphes P3143–P3600 ; doctrines HC2 dans `docs/history-v2/26-history-core-shared-doctrines-report.md`.
- Aucun ReadModel, Query, React, publication, migration, Supabase ou oracle productif n'est ajouté.

## Architecture livrée

| Pièce | Rôle | Sources autoritaires |
|---|---|---|
| `routines.ts` / `buildGlobalActivityRhythm` | fréquence normalisée, exposition, cadence, intervalles et série mensuelle | `ActivityOccurrenceFact`, participation explicite, existence de `PersonDayFact` |
| `routines.ts` / `projectGlobalRoutineDay` | projection Fact → tokens ordonnés | occurrence participante le jour de début, contexte explicite, Moment membership explicite, rôle Place canonique daté |
| `routines.ts` / `discoverGlobalRoutinePatterns` | DAY_ROUTINE, CORE/OPTIONAL, prévalence, support, time-sensitive, évolution | journées sémantiques projetées et opportunités observables |
| `routines.ts` / `buildGlobalDayTypeAnalysis` | types de journées, taux et coût économique associé | `PersonDayFact` + assertion de contexte + coût journalier économique prouvé |
| `routines.ts` / `buildGlobalRoutineCosts` | `CAUSAL_ROUTINE_COST`, `ASSOCIATED_DAY_COST`, coût typique et équivalent mensuel | `ActivityOccurrenceCostFact` et coût de journée séparé |
| `seasonality.ts` / `buildGlobalSeasonalPattern` | cycles hebdomadaires, annuels, ancrés et périodes de vie récurrentes | taux par exposition, régime courant, matérialité partagée, exclusions autoritaires |
| `routine-dependencies.ts` | closure C3/C4 et capability Place conditionnelle | AOF/PDF requis ; PVF/AOCF/ECF et catalogues explicites optionnels |
| `day-parts.ts` | catalogue partagé des clés de tranches horaires | aucun seuil horaire inventé ; classification amont explicite requise |

`locationObservability` qualifie la localisation, pas l'observabilité de l'activité. Le taux Activity utilise l'existence de `PersonDayFact`; un trou entre deux jours reste un gap et rend la mesure `PARTIAL`. Une occurrence multijour est comptée une fois par `LifeEventId`, à sa date de début, jamais une fois par jour.

## Contrats M4

| Exigences Master | Implémentation et preuve | Statut |
|---|---|---|
| GLO-M04-001–006 | grains AOF/PDF/PVF respectés ; fréquence par jour exposé ; cadence à partir de trois occurrences ; day types et médiane de coûts sur jours compatibles | PASS |
| GLO-M04-007–013 | `DAY_ROUTINE`, tokens sémantiques, déduplication consécutive, sous-séquence ordonnée ; labels Place/marchand refusés | PASS |
| GLO-M04-014–019 | CORE `>=80 %`, OPTIONAL `40–79 %`, `<40 %` exclu, ordre obligatoire, au moins trois tokens CORE | PASS |
| GLO-M04-020–022 | heure exacte non obligatoire ; `timeSensitive` uniquement à `>=80 %` d'une même signature DayPart ; catalogue partagé sans bornes horaires inventées | PASS |
| GLO-M04-023–029 | 3–4 `PARTIAL_SUPPORT`, `>=5` `SUFFICIENT`, publication `>=5` et prévalence `>=20 %`, forte `>=10` et `>=35 %`; scope PERSON/SHARED/HOUSEHOLD ; SHARED exige participation prouvée | PASS |
| GLO-M04-030 | `monthlyPrevalence` normalisée et adaptateur unidirectionnel M4 → M3 `ACTIVITY_LIFECYCLE`/`SHARED_HABIT` | PASS |
| GLO-M04-031–038 | coûts causal et associé séparés ; médiane causale `>=7`, 4–6 indicative ; coverage résolue/éligible ; équivalent mensuel dérivé ; résultats déclarés non additifs entre routines | PASS |
| GLO-M04-039–046 | quatre familles de cycles ; récurrence contractuelle/Purchase cycle/Trend/Routine restent dans leurs moteurs ; WEEKLY exige huit cycles et reste libellé rythme hebdomadaire | PASS |
| GLO-M04-047–057 | annuel/ancré/période de vie : trois cycles ; deux = hypothèse interne ; phases normalisées ; réplication `>=75 %` | PASS |
| GLO-M04-058–062 | matérialité obligatoire ; exception canonique excluable ; régimes non mélangés ; WEAKENED/LOST seulement avec assertion longitudinale explicite ; fenêtre ancrée par `CalendarEventWindowCatalog@…` | PASS |
| GLO-M04-063–068 | formes `RoutinePattern`/`SeasonalPattern`, exemple onsite, Noël et scénarios négatifs/positifs testés | PASS |

## Autorité, couverture et absences

- `projectGlobalRoutineDay` vérifie l'identité Fact, le Household, la personne, le jour et la participation. Une coïncidence de date ou de lieu ne crée pas une participation.
- Une activité multijour n'est projetée dans une routine quotidienne que le jour de début ; sa durée ne multiplie ni `rawOccurrenceCount` ni les occurrences du pattern.
- `PlaceVisitFact` prouve une présence seulement. `projectPlaceVisitRoutineRole` renvoie `UNKNOWN / CANONICAL_DATED_PLACE_ROLE_ABSENT`. Une visite, un label répété ou un marchand ne produit jamais HOME/WORK/routine.
- `person_place_roles` reste une dépendance optionnelle et M09 reste `AUTHORITY_GATED`; la capability est `UNAVAILABLE`, ce qui ne bloque pas le core Activity.
- Une journée partagée exige les participants et leurs preuves. Une dépense commune n'est jamais adaptée en routine commune.
- Les supports et dénominateurs sont conservés. Un dénominateur nul produit `UNKNOWN`; une exposition trouée ou une occurrence hors exposition produit `PARTIAL`, jamais zéro.

## Coûts et anti-double comptage

`CAUSAL_ROUTINE_COST` ne consomme que les `ActivityOccurrenceCostFact` avec coût causal connu et preuve. Une même composante présente sur deux éléments de la même instance produit `CONFLICT`; elle n'est pas additionnée deux fois.

`ASSOCIATED_DAY_COST` consomme le coût économique total prouvé du `PersonDay`. Il reste explicitement associé : une facture domestique du même jour augmente ce coût, sans augmenter le coût causal de la routine. Les deux médianes sont publiées séparément.

L'équivalent mensuel est `frequency × medianCausalCost`, avec provenance `DERIVED_FROM_OBSERVED`; ce n'est pas un nouveau montant économique. `nonAdditiveAcrossRoutines=true` interdit d'additionner plusieurs routines pour reconstituer Actual.

## C3/C4 et raccordement temporel

| Sous-gate | Preuve | Statut |
|---|---|---|
| C3 — cadence/routines | fréquences, gaps, cadence, séquences, support, scopes, coûts et closure M4 | PASS |
| C4 — cycles/saisonnalité | quatre familles, normalisation, cycles minimum, réplication, matérialité, régime et exclusions | PASS |
| M4 → M3 | `buildGlobalM4ActivityTransformations` et `buildGlobalM4RoutineTransformations`; sens unique, aucun cycle | PASS |
| M1 temporel | 72/72 rejoué sur les producteurs officiels ; aucun artifact stale | PASS |
| M3 | C1/C2 179/179 + descriptif 17/17 rejoués avec le signal M4 positif | PASS |
| GLOBAL_PHASE_B | M1 économique + outputs Trend/Stability/Recent Change raccordés et recertifiés | PASS |
| GLOBAL_PHASE_C | C1–C4 et M3/M4 core | PASS |

Les transformations consomment les séries M4 normalisées seulement via les clés autorisées du catalogue P04. M4 ne consomme pas le résultat M3. Les changements d'occurrence, d'exposition, de rôle autoritaire, de coût, de cycle ou de policy entrent dans `dependencyRefs` et les hashes ; une permutation technique conserve les identités.

## Tests

| Commande | Résultat |
|---|---|
| `check-global-v2-routines` | PASS — 67 assertions ciblées avant clôture documentaire |
| `check-global-v2-temporal-arbitration` | PASS — 179/179 |
| `check-global-v2-temporal-descriptive` | PASS — 17/17 |
| `check-global-v2-economic-function` | PASS — 72/72 |
| `check-global-v2-category-needs-materiality` | PASS — 49/49 |
| `check-history-v2-canonical-contracts` | PASS |
| `check-history-v2-month-balance` | PASS — 99/99 |
| `check-analytics-materialization` | PASS |
| `typecheck` | PASS |
| `check:architecture` | PASS — 495 fichiers avant rapport |
| production build | PASS — Next.js 16.2.6, compilation/typecheck/static generation |
| `git diff --check` | PASS |

Cas discriminants : expositions différentes à occurrence constante, exposition absente/trouée, multijour, cadence insuffisante, doublon contradictoire, CORE/OPTIONAL/ordre, faible prévalence, token Place interdit, routine partagée sans participation, DayPart invalide, rôle Place non daté, coût domestique associé non causal, composante causale dupliquée, support de coût 3/4/7, huit semaines, un/deux/trois cycles, réplication 2/3, gros Moment exclu, changement de régime, fenêtre ancrée absente, lifecycle sans autorité, déterminisme et closure incomplète.

## Gaps conditionnels préservés

- Les lignes live `person_place_roles` étaient vides au freeze GA0. Aucun rôle habituel concret n'est donc publié ; ce manque est `DATA/AUTHORITY_GATED`, pas remplacé par une heuristique.
- Les bornes horaires de matin/midi/après-midi/soir/nuit ne sont pas définies par le Master. Le catalogue partage les clés mais exige une classification amont ; aucune heure arbitraire n'est créée.
- `WEAKENED`/`LOST` n'est jamais inféré d'un seul cycle divergent. Le moteur peut conserver ces états uniquement avec une assertion longitudinale explicite et prouvée ; sinon le résultat reste hypothèse/non publiable.
- Aucun ReadModel ou choix éditorial n'est produit dans P05. La sélection de cartes reste P14.

## Gate

P05 ferme le core M4 et les contrats temporels C3/C4 sans ouvrir les capacités Place conditionnelles. M1 et `GLOBAL_PHASE_B` sont désormais fermés sur la même implémentation recertifiée. Aucun écrit live n'a été effectué.

P05 IMPLEMENTATION_GATE = PASS

P05 CONTRACT_GATE = PASS

P05 TEST_GATE = PASS

GLOBAL_PHASE_B = PASS

GLOBAL_PHASE_C = PASS

NEXT_PERMITTED_PROMPT = P06
