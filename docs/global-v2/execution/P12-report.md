# P12 — Participation partagée et Nous deux

## Baseline et autorité

- Branche : `main`.
- HEAD d'entrée : `c0d5e708dfc4517687862bcf73ffab2b87b77698` (`feat(global-v2): implement comparable personal profiles`).
- P11 : `IMPLEMENTATION_GATE=PASS`, `CONTRACT_GATE=PASS`, `TEST_GATE=PASS`, `GLOBAL_PHASE_G1_G2=PASS`.
- Autorité : `GLOBAL_EXECUTION_CONTRACT.md` C01–C14 et Master SHA-256 `8b0d0ff2381599c4495645cd1dd1ebf2fa0d027fc3113be78aee945fae12f8be`.
- Index P12 : 254 exigences, 37 capacités, 269 tests conceptuels. Aucun ReadModel, Query, React, snapshot, migration ou write live dans ce lot.

## G3 — SharedParticipationResolver et M10

`SharedParticipationResolver` est l'unique primitive M10 qui transforme des preuves de participation en états `PRESENT`, `ABSENT`, `UNKNOWN`, `CONFLICT`. Il produit ensuite `SHARED`, `PERSON_A_ONLY`, `PERSON_B_ONLY`, `NEITHER`, `UNRESOLVED` ou `CONFLICT`. Le scope est une paire de vrais `PersonId`; aucun faux `Couple PersonId` n'existe.

| Contrat | Implémentation | Preuve | Statut |
|---|---|---|---|
| Participation, bénéficiaire, payeur et coût séparés | Le contexte économique est transporté sans influencer les états; attribution hors paire rejetée | tests coût 100/UNKNOWN et résolution inchangée | PASS |
| Liste positive non exhaustive | `POSITIVE_ONLY` ne produit jamais `ABSENT` | participant B reste `UNKNOWN` | PASS |
| Absence prouvée | assertion négative ou roster `EXHAUSTIVE` seulement | `PERSON_A_ONLY`, contradiction positive/négative | PASS |
| Evidence tiers | explicite, Canonical, forte co-présence, contextuel, insuffisant | cas discriminants par niveau | PASS |
| Catalogue d'inférence | 14 `COPRESENCE_ALLOWED`, 12 `EXPLICIT_ONLY` | cardinalités et cas CAFE/HOME | PASS |
| Co-présence forte | STOP/STAY, temps connu, VENUE/ADDRESS ou SITE autorisé, recouvrement `max(15,min(60,0.5×durée courte))` | seuils 20/60/200 min, transit, temps vague, municipalité | PASS |
| Hiérarchie Place | preuve au premier ancêtre commun, jamais descente | résolution structurée, cycles/parents manquants fermés | PASS |
| Moment multijour | couverture observable, 60 %, au moins 2 jours et preuve structurante | moment 2/3 avec stay; absence de preuve refusée | PASS |
| Shared Place | projection distincte d'une activité | `projectSharedPlaceVisits` | PASS |
| Shared activity | `ActivityOccurrenceFact.participantIds` est positif Canonical, jamais roster exhaustif | adapter Facts → M10 | PASS |
| Support | coverage = résolus/éligibles; rate = partagés/résolus | 8/10 et 6/8 | PASS |
| External participants | `PAIR_ONLY`, `WITH_EXTERNALS`, `UNKNOWN` séparés | Contact canonique + externe non résolu | PASS |
| Déterminisme | ensembles triés, identités contradictoires refusées, input hash versionné | permutation des Facts stable | PASS |

### Chaîne d'autorité

`CanonicalRepository.loadActivityOccurrences()` projette `life_events` et `life_event_participations` vers `ActivityOccurrenceFact`. `projectGlobalSharedActivitiesFromFacts()` consomme uniquement `participantIds` comme assertions Canonical positives. Une personne absente de cette liste reste `UNKNOWN`, car la liste ne porte pas de complétude négative. Les preuves de Place utilisent exclusivement `PlaceVisitFact`; ni label, banque, domicile, travail, commune ni proximité ne deviennent participation.

La closure `global-v2:m10-shared-participation` déclare ActivityOccurrence, PersonDay, PlaceVisit et EconomicComponent, les entités de participation/Moment/Place et les capacités Contact optionnelles gated. M9 n'est pas une dépendance de M10 : un Persona ne devient jamais une source Fact de participation.

## G4 — Social et capacités conditionnelles

| Capacité | État | Comportement certifié |
|---|---|---|
| resolver, explicite, Canonical, co-présence, catalogue, support/rate, Activity, Place, Moment | AVAILABLE | exécution M10 versionnée |
| routine partagée, évolution, coûts causaux partagés, exclusivité pair | DATA_GATED | publiables uniquement lorsque leurs preuves amont explicites sont présentes; aucun remplissage |
| MobilityLeg partagé | AUTHORITY_GATED | aucune mobilité commune inférée |
| Contact/Alias/Relation/Group | AUTHORITY_GATED | occurrence sociale reste analysable sans identité Contact inventée |
| graph social, score de relation, cost-per-contact | FORBIDDEN | aucune sortie correspondante |

`buildGlobalSocialContextSummary()` conserve les participants externes non résolus sans faux Contact. `participantCoverage` et `contactIdentityCoverage` ont des numérateurs distincts. Aucune fréquence ne qualifie une relation, aucun nom n'est fusionné, aucun lieu ne crée un contact et aucun coût n'est divisé par participant.

## Impacts et recertification par closure

M10 est nouveau et downstream des preuves B–F. Il ne modifie aucun Fact ni producteur M3/M4/M5/M9. Les déclarations actuelles de ces quatre modules ne consomment pas M10; `recertifyGlobalSharedDownstreamClosure()` prouve donc `NO_DECLARED_INPUT_EDGE` pour chacun. Les suites M3, M4, M5 et M9 sont néanmoins rejouées sur l'état final pour vérifier cette absence de régression. Aucun cycle ou alimentation inverse Persona → participation n'est présent.

## Fichiers

- `src/analytics/global-v2/shared-participation.ts`
- `src/analytics/global-v2/shared-fact-adapter.ts`
- `src/analytics/global-v2/shared-dependencies.ts`
- `src/analytics/global-v2/shared-capabilities.ts`
- `src/analytics/global-v2/social-context.ts`
- `src/analytics/global-v2/index.ts`
- `scripts/check-global-v2-shared-participation.mjs`
- `package.json`
- `docs/global-v2/execution/P12-report.md`
- `docs/global-v2/GLOBAL_EXECUTION_STATE.md`

## Validations finales

Les résultats enregistrés ci-dessous portent sur l'état exact du checkpoint P12 :

- M10/G3/G4 : 54/54 PASS.
- M9 Persona : 85/85 PASS.
- M5 Relations : 266/266 PASS.
- M4 Routines : 67/67 PASS.
- P04 temporel : 179/179 PASS; assemblage : 17/17 PASS.
- M6 Moments : 75/75 PASS.
- M7 Places : 58/58 PASS.
- typecheck : PASS.
- architecture : PASS.
- build production Next : PASS.
- `git diff --check` : PASS.

## Gates

IMPLEMENTATION_GATE = PASS

CONTRACT_GATE = PASS

TEST_GATE = PASS

GLOBAL_PHASE_G3_G4 = PASS

GLOBAL_PHASE_G = PASS

SOCIAL_GATE = PASS_WITH_AUTHORITY_GATED_CAPABILITIES

LIVE_GATE = NOT_RUN

LIVE_WRITES = NONE

NEXT_PERMITTED_PROMPT = P13
