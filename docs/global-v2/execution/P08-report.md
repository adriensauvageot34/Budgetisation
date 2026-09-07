# P08 — Lieux et mobilité prouvable

## Gate d’entrée et périmètre

- Baseline : `main` à `6f8be504ba78279bd0ede91e777823806aed4dad`, working tree propre.
- P07 : `IMPLEMENTATION_GATE`, `CONTRACT_GATE`, `TEST_GATE` et `GLOBAL_PHASE_E2` à `PASS`.
- Contrat : C01–C14 appliqués ; Master Global et doctrine HC2 Place conservés.
- Périmètre : M7 core, E3/E4 et replay C/D strictement affecté. Aucun ReadModel, Query, React, publication, migration, accès live ou écriture Supabase.

L’index déterministe attribue à P08 **173 exigences**, **29 capacités** et **176 tests conceptuels**. Les identifiants volontairement absents du Master (`GLO-M07-093`, `TEST-GLO-M07-0094`) ne sont pas recréés.

## Autorités physiques et chaîne réelle

| Concept | Source autoritaire consommée | Traitement M7 | État |
|---|---|---|---|
| Place et hiérarchie | entité Canonical `places`/`referentiel_lieu`, `place_id`, parent et niveau seulement lorsqu’ils existent | niveau le plus fin prouvé ; parent absent ou niveau absent reste absent/`UNKNOWN` | CONNECTED |
| présence/visite | `location_occurrences` de type `Présence` projetées par `CanonicalRepository.loadPlaceVisits()` en `PlaceVisitFact` | continuité réelle au grain personne–lieu–intervalle ; aucune entrée GPS brute | CONNECTED |
| observabilité | `person_days` → `PersonDayFact.locationObservability` | dénominateurs mensuels ; absence de journée observable n’est pas une absence de visite | CONNECTED |
| finance localisée directe | `EconomicComponentFact.canonicalPlace`, résolution `operation_place_canonical` | attribution exacte et bornée par composant | CONNECTED si données |
| établissement/lieu causal/déclaration | `GlobalEconomicPlaceAttributionInput` exige mode, identité économique et preuve explicites | aucun marchand, label, GPS, ville ou co-présence comme remplacement | CONDITIONAL |
| événements d’achat | `PurchaseEventFact` | dénominateur séparé de couverture événementielle | CONDITIONAL |
| rôle personne↔lieu | aucune projection Canonical datée raccordable observée | `UNKNOWN`; aucun label répété ne devient HOME/PRIMARY_WORK | AUTHORITY_GATED |
| séjour/nuit | preuve explicite Moment/Event, hébergement ou géographie 22–08 ≥4 h fournie au moteur | aucune nuit déduite d’une visite ordinaire | DATA_GATED |
| mobilité | aucune `MobilityLegFact`/`RouteDefinition` autoritaire ; véhicules, distances et prix observés restent fermés par GA0 | aucune route, distance, mode, fréquence, carburant ou coût estimé | AUTHORITY_GATED |

Le chemin serveur `resolveGlobalM7PlaceAuthority()` est read-only : `CanonicalRepository → PlaceVisitFact/PersonDayFact/EconomicComponentFact/PurchaseEventFact → GlobalTemporalBoundaryResolver → buildGlobalPlaceMobility`. Il ne lit ni GPS brut, ni ReadModel History, ni résultat M5, et n’expose aucune méthode d’écriture.

## E3 — visites, séjours, importance et lifecycle

- Les objets Place, visite, séjour, transition OD et attribution économique restent distincts.
- Un `PlaceVisitFact` canonique est une visite prouvée. Une présence passive explicitement identifiée exige 10 minutes à précision fine ou 20 minutes à précision large ; une activité/un événement explicite accepte toute durée positive. `TRANSIT` et `PASS_THROUGH` ne comptent pas comme visite.
- La fusion exige même personne, même Place, gap ≤15 minutes et aucune visite incompatible intercalée. Les chevauchements parent/enfant n’ajoutent qu’une visite feuille ; ≤5 minutes peut être une incertitude de frontière ; au-delà, deux lieux incompatibles produisent `CONFLICT` sans durée exacte.
- Une visite continue traversant minuit reste une occurrence et reçoit des tranches journalières. Un `visitDay` exige 15 minutes cumulées ou une preuve explicite.
- Un séjour exige une preuve de nuit autorisée ; les nuits successives de même personne/lieu/contexte fusionnent sans fabriquer de voyage.
- Importance interne : pondérations normatives current 30/15/15/15/25 et historical 30/20/20/30. Le score sert au classement interne, pas à créer une vérité Canonical.
- La pénalité routine 0,35 ne s’applique qu’à HOME/PRIMARY_WORK daté et actif, seulement au rail de découverte ; au plus un lieu routine parmi six. Sans rôle daté : facteur 1 et état `UNKNOWN`.
- Lifecycle : fenêtre récente/précédente 3+3, support observable, NEWLY_OBSERVED, NEW_REGULAR/REGULAR, GROWING, DECLINING, REGULAR_STABLE, DORMANT, ABANDONED et ROLE_ENDED. Les signaux admissibles partent vers M3 dans un seul sens.

## E4 — finance localisée et mobilité

- Modes autorisés : `DIRECT_CANONICAL`, `PURCHASE_ESTABLISHMENT`, `CAUSAL_EVENT_PLACE`, `DECLARED_PLACE_ATTRIBUTION` ; chaque ligne exige identité économique et preuve.
- Les montants attribués sont bornés par la valeur absolue du composant. Des autorités contradictoires sur la même identité produisent un conflit ; une preuve feuille/ancêtre identique est dédupliquée à la feuille, puis seulement roll-up.
- `localizedAmountCoverage` somme les **montants effectivement attribués**, y compris une allocation partielle. `localizedEventCoverage` compte séparément les Purchase Events dont tous les composants de consommation sont entièrement localisés.
- Classement : `<60 %` indisponible ; `60–84,99 %` limité à l’univers localisé ; `≥85 %` global. Un montant connu ne vaut donc jamais couverture 100 %.
- Les montants feuille et parent sont des vues de roll-up de la même identité et ne doivent pas être sommés entre niveaux.
- Une succession A→B produit uniquement un `ODTransition`. Les capacités route, distance, mode, coût et shared trip restent fermées sur AG001, AG006, AG007, AG009, AG010, AG011 et AG023.
- Aucun coût mobilité estimé n’est calculé. Le contrat de sortie marque explicitement l’estimation `UNKNOWN` et garantit qu’aucun montant estimé n’est ajouté à du carburant observé.

## Replay C/D après signaux E

`recertifyGlobalCDForPlaceAndMoment()` relit les **15 définitions P08** déjà inscrites au catalogue M5/FDR. Chacune est examinée et conservée avec une exclusion explicite : cohortes M6 descriptives non assimilées à un test apparié, rôle professionnel daté absent, mobilité fermée, ou participation partagée non prouvée.

Résultat : aucune nouvelle définition statistiquement éligible ; univers FDR inchangé ; q-values inchangées ; aucune dépendance E→résultat M5 ; signaux Place/Moment vers M3 uniquement. Les suites P04 et P06 ont été rejouées pour prouver ce no-op par closure, sans modifier isolément une q-value.

## Dépendances, policies et hashes

| Pièce | Rôle |
|---|---|
| `src/analytics/global-v2/place-dependencies.ts` | déclaration M7 versionnée : Facts, entités, upstream, scopes, capabilities et invalidation |
| `src/analytics/global-v2/places.ts` | moteur pur M7, règles visite/séjour/hiérarchie/lifecycle/finance/mobilité, closure et hashes |
| `src/server/analytics/global-v2-place-authority.ts` | adaptateur de production read-only et résolution temporelle P02 |
| `src/analytics/global-v2/place-recertification.ts` | replay exhaustif des définitions C/D possiblement enrichies par E |
| `scripts/check-global-v2-places.mjs` | 58 assertions discriminantes M7/E3/E4 |
| `scripts/check-global-v2-place-authority.mjs` | 22 assertions Canonical→Facts→M7 sans réseau/écriture |

La closure échoue si une preuve consommée manque. Les ensembles sont canonisés ; permutation technique identique conserve `inputHash`/`outputHash`, modification d’un intervalle significatif change le hash. Aucune propriété absente n’est sérialisée comme `undefined`.

## Matrice exhaustive P08

| Bloc Master | Exigences | Preuve | Statut |
|---|---:|---|---|
| objets, grains, hiérarchie, résolution | GLO-M07-001–024 | types distincts, cycle/parent validés, précision non inventée | PASS |
| visite, seuils, fusion, overlap, jour | GLO-M07-025–052 | moteur visite et tests exacts 10/20, 15 min, 5 min | PASS |
| séjour, nuit, transitions | GLO-M07-053–071 | preuves de nuit, slices, OD sans route implicite | PASS |
| importance, routine, rail | GLO-M07-072–092 | deux scores normatifs, rôle daté, pénalité/limite | PASS |
| lifecycle et signaux M3 | GLO-M07-094–113 | fenêtre 3+3, support, statuts et feed unidirectionnel | PASS |
| finance localisée et coverage | GLO-M07-114–143 | quatre autorités, allocation bornée, coverages distinctes, seuils 60/85 | PASS |
| mobilité et coûts | GLO-M07-144–163 | gates AG explicites, aucune estimation/distance/route inventée | PASS — capacités gated publiées |
| dépendances, outputs, certification | GLO-M07-164–174 | déclaration/closure, adaptateur, hashes, replay C/D et suites | PASS |

Les exigences de capacités conditionnelles sont satisfaites par un état explicite `UNAVAILABLE/AUTHORITY_GATED`, conformément au Master ; elles ne sont pas supprimées ni remplacées par une heuristique.

## Tests et non-régressions

| Validation | Résultat |
|---|---|
| M7 Places/mobility | 58/58 PASS |
| Canonical→Facts→M7 | 22/22 PASS ; dépôt synthétique, aucune méthode réseau/écriture |
| M6 Moments | 75/75 PASS |
| autorité M6 | 17/17 PASS |
| M5 relations/FDR | 266/266 PASS |
| autorité M5 | 20/20 PASS |
| M4 routines | 67/67 PASS |
| M3 temporel | 179/179 + descriptif 17/17 PASS |
| matérialité M2/P03 | 49/49 PASS |
| HC2/History Month Balance Place | 99/99 PASS |
| TypeScript `--noEmit` | PASS |
| architecture imports | PASS — 516 fichiers |
| Next production build | PASS — Next 16.2.6, compilation, TypeScript et génération statique |
| `git diff --check` | PASS |

Cas explicitement discriminés : GPS sans visite, présence passive trop courte, activité explicite courte, transit, fusion/gap/incompatibilité, parent/enfant, conflit d’overlap, passage de minuit, nuit prouvée, visite sans finance, finance partiellement localisée, coverages montant/événement distinctes, seuils de ranking, conflit et dépassement d’allocation, label répété sans routine, rôle daté, transition sans route, mobilité gated, absence de double coût estimé, déterminisme et closure.

## Gaps autorisés et handoff

- Les rôles Place datés restent `AUTHORITY_GATED`; aucune convention à partir d’un label n’est créée.
- Les séjours sont disponibles seulement lorsqu’une preuve de nuit est fournie.
- La finance personnelle localisée reste `AUTHORITY_GATED_PERSON_COMPONENT_SPLIT` dans l’adaptateur tant qu’un composant économique ne peut pas être fractionné par bénéficiaire sans double compte ; le moteur Household reste complet.
- MobilityLeg, RouteDefinition, distance routière, consommation, prix carburant et shared trip restent indisponibles. Leur activation future exige T01 et recertification ; aucune branche n’est silencieusement annoncée comme active.
- Aucun signal E n’a rendu une définition M5 éligible dans l’état actuel. Le replay documente donc un no-op réel, pas une omission.

CURRENT_PROMPT = P08

IMPLEMENTATION_GATE = PASS

CONTRACT_GATE = PASS

TEST_GATE = PASS

GLOBAL_PHASE_E3_E4 = PASS

LIVE_GATE = NOT_RUN

LIVE_WRITES = NONE

NEXT_PERMITTED_PROMPT = P09
