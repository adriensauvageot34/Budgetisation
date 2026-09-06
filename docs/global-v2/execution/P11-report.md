# P11 — Profils personnels comparables

## Baseline et gate d'entrée

- Branche : `main`.
- HEAD d'entrée : `02f0c8197eac8bf602e5bc6abc7c0c9aa8b55422`.
- P10 certifié : `IMPLEMENTATION_GATE`, `CONTRACT_GATE` et `TEST_GATE` à `PASS` dans `P10-report.md` et l'état durable.
- Autorités : Master Global (SHA-256 enregistré `8b0d0ff2381599c4495645cd1dd1ebf2fa0d027fc3113be78aee945fae12f8be`), puis `GLOBAL_EXECUTION_CONTRACT.md`.
- Portée : G1/G2 et M9 seulement. Aucun Query/ReadModel/React, snapshot, publication, migration ou accès live.

## G1 — audit physique borné

| Besoin M9 | Producteur réutilisé | Règle d'autorité | État |
|---|---|---|---|
| montants personnels | `buildGlobalPersonalEconomicSelection` → `selectEconomicComponentsForPersonWithCoverage` | bénéficiaire ou parts explicites au grain exact; payer seul et reliquat Household restent hors Person | PASS |
| support propre PersonaMetric | observations naturelles des producteurs B–F | chaque personne garde son support maximal observable | PASS |
| intersection PersonaDifference | `GlobalTemporalBoundaryResolver` déclaré, intersection exacte matérialisée par `unitId` | seules les unités connues et observables des deux personnes sont comparées | PASS |
| matérialité | `GlobalMaterialityEngine`, policies `PERSONA_MONEY` et `PERSONA_FREQUENCY` | 10 EUR + 15 %, ou 1 occurrence/équivalent structurel selon le catalogue | PASS |
| régime et exceptionnel | sorties officielles P04/M3 et P07/M6 | M9 consomme la qualification; il ne détecte ni exception ni régime | PASS |
| métriques B–F | dépendances M1–M8 déclarées | uniquement les grains/personnes autorisés par chaque owner; aucune reconstruction | PASS |

L'adaptateur `adaptObservedPersonalMonthsFromP01` accepte des sélections P01 déjà calculées. Il transporte le montant attribuable, la zone non attribuable via la coverage et le hash de preuve. Il ne dispose d'aucun champ payer et ne peut donc pas convertir un paiement en bénéfice personnel.

## G2 — implémentation M9

### Contrats créés

- `GlobalPersonaDefinition` porte famille, grain, mode de comparaison, policy de matérialité, natures admises, traitement exceptionnel, pertinence, redondance et support minimal.
- `GlobalPersonaMetric` décrit une personne sur son support propre.
- `GlobalPersonaDifference` décrit deux personnes exclusivement sur leur intersection comparable, avec brut, habituel, part exceptionnelle, support, coverage, régime, matérialité, score interne et preuves.
- Le catalogue exporté contient exactement les dix familles normatives. Les observations contradictoires pour une identité `metric/person/unit` échouent fermées.
- L'ordre technique des inputs n'influence pas la sélection; les identités et preuves sont canonicalisées.

### Brut, habituel et temporalité

- `RAW_PERSON_METRIC` conserve toute contribution personnelle autoritairement attribuée.
- `HABITUAL_PERSON_METRIC` consomme la valeur après exclusions déjà qualifiées par les moteurs partagés; Persona n'invente aucun détecteur.
- `exceptionalContributionShare >= 50 %` bloque une caractéristique générale lorsque l'écart habituel n'est pas indépendamment matériel.
- `STABLE_CURRENT_REGIME` et au plus une carte `RECENT_ONLY` sont admissibles au top. `HISTORICAL_ONLY`, `CHANGED_DIFFERENCE` et `INSUFFICIENT_TEMPORAL_SUPPORT` restent hors headline.
- Une observation `PARTIAL`, `UNKNOWN` ou conflictuelle ne devient jamais un zéro connu. Une absence n'est comparée que si zéro est réellement observable.

### Coverage et support

- Coverage top : au moins 85 % de l'univers observable le plus large; 60–84,99 % reste détail qualifié; sous 60 % aucune comparaison publiable.
- Le support est déclaré au grain naturel et contrôlé séparément pour les deux personnes par l'intersection.
- Une couverture Household complète ne remplace jamais la couverture d'attribution personnelle.
- Les Persona ne sont jamais forcées à réconcilier leur somme avec Typical Household : la zone commune/inconnue reste explicite.

### Ranking et sélection

Le score reste interne et applique le registre normatif : effet 35 %, persistance 20 %, support 15 %, coverage 10 %, autorité/provenance 10 %, pertinence humaine 10 %. L'effet est borné à deux fois le seuil; la coverage est normalisée entre 85 et 95 %. Les contraintes sont appliquées après les gates : six cartes maximum, deux par famille, une par `redundancyGroup`, une `RECENT_ONLY`, au plus deux natures non purement observées lorsqu'au moins quatre candidats observés existent. L'hystérésis protège un candidat encore admissible jusqu'au dépassement de 10 % par son remplaçant.

Le moteur ne génère aucun texte : seules des identités analytiques descriptives sont produites. La formulation morale ou psychologique est donc impossible dans ce lot et restera une contrainte du futur owner de présentation.

## Coûts personnels

### ObservedPersonalTypicalCost

- médiane des mois personnellement attribuables, douze mois maximum;
- six mois connus minimum;
- base `AUTHORITATIVE_ECONOMIC` via P01;
- headline seulement avec `financialSourceCoverage = 100 %` et `personalAttributionCoverage >= 85 %`;
- 60–84,99 % : détail qualifié; sous 60 % : indisponible.

### PersonalReferenceCost

`ObservedPersonalTypicalCost` et `PersonalReferenceCost` sont deux objets distincts. Le second possède un assembleur contractuel testable, avec identités économiques anti-double-compte, parts grounded/estimées et limite du supplément. Son activation réelle reste fail-closed : avec `AG022_CLOSED`, résultat `AUTHORITY_GATED`, aucune valeur. Une fixture avec autorité explicite prouve le futur contrat sans ouvrir la capability live : grounded >= 70 %, estimated <= 30 %, support >= 6, attribution >= 85 %, supplément <= 25 % sauf déclaré exact et structurellement applicable. Sous 50 % grounded, seules les composantes subsistent.

## Dependency closure

`createGlobalM9DependencyDeclaration` déclare :

- Facts : economic component requis; PersonDay, occurrence, PlaceVisit et PurchaseEvent optionnels;
- entités : personnes Household et `financial_source_person_links` au grain exact;
- Analytics : M1 et M3 requis, M2/M4/M5/M6/M7/M8 optionnels selon les définitions disponibles;
- modules : resolver temporel et matérialité partagée requis;
- personScope : `COMPARABLE_PERSONS`; lookback : intersection naturelle;
- invalidation : scope personnes; aucune dépendance M9 vers lui-même, aucun cycle amont.

Un changement d'observation ou de policy change le hash M9. Les preuves et états gated restent dans la closure.

## Matrice de certification Master

L'index déterministe attribue à P11 107 exigences (`GLO-M09-001` à `GLO-M09-111`, quatre identifiants non attribués par le générateur), 17 capabilities et 127 tests conceptuels. La couverture exécutable est regroupée sans recopier une seconde norme :

| Domaine Master | Exigences/capabilities | Preuves exécutables | Statut |
|---|---|---|---|
| sens, deux niveaux, catalogue | GLO-M09-001–018; CAP-M09-001–003 | catalogue 10 familles, métriques supports propres, différences intersection exacte | PASS |
| matérialité, zéro, support, coverage | GLO-M09-019–043; CAP-M09-004 | tests 300/100 vs intersection, coverage 66/72/85 %, égalité, zéro connu vs inconnu | PASS |
| régime et exceptionnel | GLO-M09-044–058; CAP-M09-005–006 | cinq états temporels, domination exceptionnelle, brut/habituel distincts | PASS |
| moteur, ranking, diversité, hystérésis | GLO-M09-059–084; CAP-ENG-015, CAP-M09-007–012 | limites 6/2/1, ties, permutation, +10 %, natures non observées | PASS |
| provenance, attribution, langage | GLO-M09-085–094; CAP-M09-013–015 | evidence refs, dependency closure P01, aucun générateur narratif, payer absent de l'adaptateur | PASS |
| coûts observés et référence enrichie | GLO-M09-095–111; CAP-M09-016 | médiane/support/coverage, AG022 fermé, overlap, grounded/estimated, supplément | PASS / capability enrichie gated |

Les 127 cas du registre se rattachent à ces blocs; 82 assertions discriminantes couvrent leurs classes d'équivalence et frontières sans dupliquer 127 fois la même primitive.

## Tests exécutés

- `check-global-v2-persona.mjs` : 85/85 PASS.
- P01 foundations/attribution : 108/108 PASS.
- M1 : 72/72 PASS.
- M2/materiality : 49/49 PASS.
- P04 temporal : 179/179 PASS.
- P05 routines : 67/67 PASS.
- P06 relationships : 266/266 PASS.
- P07 Moments : 75/75 PASS.
- P08 Places : 58/58 PASS.
- P09 Purchase : 66/66 PASS.
- P10 convergence : 56/56 PASS.
- Typecheck PASS; architecture PASS (524 fichiers); `git diff --check` PASS.
- Build : non requis; aucun chemin Next/runtime/server ni configuration de build n'est modifié.

## Gaps et effets live

- `PersonalReferenceCost` reste `AUTHORITY_GATED` par AG022. Aucune donnée estimée n'est fabriquée.
- Les familles sans producteur personnel autoritaire restent absentes du catalogue d'instances, jamais converties en zéro ou en Household.
- Aucun payload, Query, ReadModel ou écran Global n'est créé dans P11.
- `LIVE_GATE = NOT_RUN`; `LIVE_WRITES = NONE`.

## Verdict

IMPLEMENTATION_GATE = PASS

CONTRACT_GATE = PASS

TEST_GATE = PASS

GLOBAL_PHASE_G1_G2 = PASS

PERSONAL_REFERENCE_COST = AUTHORITY_GATED_AG022

LIVE_WRITES = NONE

NEXT_PERMITTED_PROMPT = P12

STOP après P11.
