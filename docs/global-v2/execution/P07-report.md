# P07 — Moments et expériences

## Gate d'entrée et périmètre

- Baseline : `main` à `d29ba09176a7d0726c6e67a5f0b1f7f9bd380418`, working tree propre.
- P06 : `IMPLEMENTATION_GATE`, `CONTRACT_GATE`, `TEST_GATE` et `GLOBAL_PHASE_D_CORE` à `PASS`.
- Contrat d'exécution : C01–C14 appliqués. Le Master Global reste normatif ; les doctrines causales HC2 restent inchangées.
- Périmètre : audit physique E1 strictement borné aux inputs Moment/Place nécessaires à M6, puis implémentation et certification E2. Aucun ReadModel, Query, React, publication, migration ou accès live.

L'index déterministe contient **133 exigences**, **13 capacités** et **134 tests** attribués à P07. Le catalogue M6 couvre les sept familles analytiques, dont `OTHER_MOMENT` non comparative, et les vingt types Moment canoniques déjà contractés.

## E1 — audit physique borné

| Concept | Autorité physique réellement utilisable | Décision E1 |
|---|---|---|
| identité, type, dates Moment | lignes Canonical `moments`, chargées par `CanonicalRepository` | type exact catalogué ; type absent/inconnu ne reçoit aucun fallback |
| série | colonne Canonical `moment_series_id`/`series_id` lorsqu'elle existe | même série seulement si l'identité est explicite ; types contradictoires dans une série = `CONFLICT` |
| membership Moment/Life Event | `moment_life_events` confirmé/déduit | lien explicite uniquement ; aucune proximité de date, titre ou lieu |
| participants Household | `life_event_participations` reliées par membership | participants uniquement prouvés ; absence = `UNKNOWN`, jamais partage 50/50 |
| participants externes | aucune autorité physique prouvée dans le chemin actuel | non inventés ; metadata participant incomplète reste qualifiée |
| causalité financière | `EconomicComponentFact.momentId` et relations causales HC2 | autorité causale explicite, bornée par source ; `spentDuring` n'y contribue jamais |
| rôle causal | lien financier explicite couvrant le composant complet et son membership | `PREPARATION`, `CORE_EXPERIENCE`, `AFTER_EFFECT`, `ADJUSTMENT`; une allocation partielle sans rôle explicite ne reçoit pas de rôle |
| date de paiement | date de transaction si fournie à l'autorité, sinon `bankDate` connue du Fact | chronologie de paiement séparée de la temporalité économique |
| finance dans la fenêtre | segments `economicTiming` de `EconomicComponentFact` | calcul indépendant de la causalité ; intervalle partiel/non assigné dégrade la connaissance, sans distribution arbitraire |
| facettes Place | aucune projection datée suffisamment autoritaire observée | `AUTHORITY_GATED`; aucun rôle Place, label ou proximité ne fabrique une facette |
| hébergement/rôle/géographie | uniquement propriétés Canonical explicites lorsqu'elles existent | absence conservée `UNKNOWN`; les pairs incompatibles ne sont pas élargis pour remplir une liste |

Les comptages physiques déjà certifiés par GA0 (42 Moments, 57 liens Moment/Life Event) sont des preuves d'inventaire antérieures, pas une lecture live P07. Aucun comptage n'est assimilé à une preuve de couverture financière ou participante.

## E2 — architecture et fonctions

| Pièce | Rôle |
|---|---|
| `src/analytics/global-v2/moment-catalog.ts` | vocabulaire exact de 20 types, familles, facettes, profils et élargissements autorisés |
| `src/analytics/global-v2/moment-dependencies.ts` | déclaration de dépendances, grain Moment, scopes, policies, capabilities et invalidation |
| `src/analytics/global-v2/moments.ts` | normalisation, coûts, comparaison, statistiques robustes, matérialité, narration, séries, closure et hashes |
| `src/server/analytics/global-v2-moment-authority.ts` | chaîne read-only `CanonicalRepository → producteurs EconomicComponentFact → GlobalTemporalBoundaryResolver → M6` |
| `src/analytics/global-v2/materiality.ts` | policies Moment courtes/voyage/projet ; baseline quasi nulle traitée uniquement par seuil absolu |
| `scripts/check-global-v2-moments.mjs` | 75 assertions analytiques discriminantes |
| `scripts/check-global-v2-moment-authority.mjs` | 17 assertions d'intégration Canonical/Facts/dépendances, sans réseau ni écriture |

### Comparabilité et support

- Ordre strict : `SAME_SERIES → SAME_TYPE → SAME_FAMILY`, limité par le profil de famille. `PROJECT_MILESTONE` ne s'élargit pas à la famille ; `OTHER_MOMENT` n'est pas comparatif.
- Le sujet est exclu. Les facettes obligatoires doivent être connues et égales ; une facette inconnue produit un état qualifié, pas un pair artificiel.
- Support hors sujet : 0–2 `INSUFFICIENT`, 3–4 `PARTIAL_SUPPORT`, 5–7 `SUFFICIENT`, au moins 8 `STRONG`.
- Médiane, Q1, Q3, IQR et MAD restent descriptifs. Les différences de composantes se réconcilient par un résiduel explicite.
- Matérialité : policies distinctes Moment court, voyage et projet ; un coût de référence nul/quasi nul utilise la condition absolue, sans ratio inventé.

### Finance, temps et personnes

- `causalCost` conserve les relations causales HC2 ; `grossCausalOutflow - refundsAndAdjustments = netCausalCost` sur les composants entièrement résolus.
- Les rôles causaux et les phases de paiement sont deux axes séparés. Un remboursement est publié comme ajustement négatif à sa propre date de paiement.
- `spentDuring` sélectionne les segments économiques contenus dans la fenêtre Moment, sans exiger de relation causale. Une composante non assignée ne peut pas être distribuée dans la fenêtre.
- Un Moment ponctuel sans précision temporelle compatible reste `NOT_APPLICABLE` ou `UNKNOWN` ; la date bancaire ne devient pas une heure économique.
- Le coût par jour n'existe que pour une famille admissible et des dates locales connues. Le coût générique `total / participants` est explicitement interdit.
- Les coûts par personne viennent uniquement de l'attribution exacte du Fact (`resolved`, `shared`, parts explicites). Les unités naturellement tarifées exigent une autorité dédiée.
- Plusieurs Moments peuvent recevoir des montants seulement lorsque les relations explicites restent bornées par le montant de leur source.

### Importance narrative et séries

La sélection narrative combine signaux canoniques, participation, activités/Life Events, transformations et comparaisons. Le coût n'est jamais un signal positif en soi : une expérience peu coûteuse mais documentée reste admissible, tandis qu'un montant élevé isolé ne fabrique pas d'importance.

Les séries conservent les occurrences distinctes, leurs durées et coûts. Une série cohérente d'au moins trois occurrences peut produire un signal candidat M3. Les identités Moment exposées à M5 sont déclarées, mais le replay C/D appartient explicitement à P08 et n'a pas été exécuté dans P07.

## Matrice exhaustive des exigences P07

| Bloc Master | Exigences | Implémentation / preuve | Statut |
|---|---:|---|---|
| famille, type, série, grain | GLO-M06-001–018 | catalogue exact, normalisation, conflits et déduplication | PASS |
| comparabilité, facettes, élargissement, support | GLO-M06-019–040 | profils par famille, tiers, exclusion sujet, support 0–2/3–4/5–7/8+ | PASS |
| causalité et couverture financière | GLO-M06-042–050 | doctrines HC2, univers causal attendu, source-bound allocations | PASS |
| `spentDuring` | GLO-M06-051–056 | fenêtre économique indépendante, précision et gaps | PASS |
| causal roles et payment timeline | GLO-M06-057–067 | axes séparés, remboursements et dates de paiement | PASS |
| composition et coûts unitaires | GLO-M06-068–075 | composition réconciliée, coût/jour borné, unité autoritaire | PASS |
| coût/personne | GLO-M06-076–080 | attribution Fact exacte, partage implicite interdit | PASS |
| statistiques et matérialité | GLO-M06-082–089 | médiane/quartiles/MAD, seuils par famille, zéro-baseline absolue | PASS |
| importance narrative | GLO-M06-090–100 | signaux non monétaires, faible coût admissible, montant seul non probant | PASS |
| séries et dépendances C/D | GLO-M06-101–107 | séries distinctes, closure, replay P08 déclaré/non exécuté | PASS |
| contrats, pipeline, sorties | GLO-M06-108–117 | méthode/policies, provenance, hashes, adaptateur read-only | PASS |
| cas de certification | GLO-M06-118–135 | suites M6 et autorité, régressions HC2 | PASS |

Les identifiants absents de la numérotation du Master ne sont pas recréés. Les 133 exigences attribuées à P07 sont toutes couvertes par les blocs ci-dessus ; aucune exigence n'est retirée pour obtenir le verdict.

## Tests et non-régressions

| Validation | Résultat |
|---|---|
| `check-global-v2-moments` | 75/75 PASS |
| `check-global-v2-moment-authority` | 17/17 PASS ; fixtures Canonical synthétiques, aucune méthode réseau/écriture |
| History V2 ReadModels / doctrine `spentDuring` | 27/27 PASS |
| History V2 Month Balance / Moment Detail | 99/99 PASS |
| Global matérialité M2/P03 | 49/49 PASS |
| Global relations M5/P06 | 266/266 PASS |
| TypeScript `--noEmit` | PASS |
| architecture imports | PASS — 512 fichiers |
| Next production build | PASS |
| `git diff --check` | PASS |

Les tests discriminent : dépense temporelle non causale, causalité hors fenêtre, présence dans les deux métriques sans double comptage interne, timing non assigné, Moment ponctuel imprécis, remboursement, parent/enfant, partage multi-Moments borné, exclusion du sujet, élargissement interdit, facette inconnue, seuils de support, coûts faibles significatifs, absence de partage implicite, catalogue exhaustif, déterminisme, closure et sensibilité des hashes.

## Écarts et handoff

- Les facettes Place et participants externes restent absentes/`UNKNOWN` lorsque la source Canonical ne les prouve pas. Ce sont des capacités conditionnelles, pas des données inventées.
- Les familles/signaux M6 susceptibles d'enrichir M3 ou M5 exigent un replay par closure dans P08. P07 les déclare mais ne prétend pas les avoir recertifiés.
- Aucun snapshot History, oracle ou ReadModel n'alimente M6. Aucun état live n'est modifié.

CURRENT_PROMPT = P07

IMPLEMENTATION_GATE = PASS

CONTRACT_GATE = PASS

TEST_GATE = PASS

GLOBAL_PHASE_E2 = PASS

LIVE_GATE = NOT_RUN

LIVE_WRITES = NONE

NEXT_PERMITTED_PROMPT = P08
