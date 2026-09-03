# History V2 — HC1 — autorité Analytics du Bilan

## Gate et périmètre

Ce lot ferme uniquement le premier gate structurel identifié par les audits
History V2 avant Analyse Globale : la construction des ReadModels Bilan destinés
à la matérialisation ne doit jamais utiliser l'oracle de certification comme
source métier.

Sources relues : audits 20 à 24, rapports 04 à 08, code courant des Facts,
Analytics, builders History V2 et matérialisation, ainsi que les migrations
Analytics et classifications canoniques en vigueur.

Hors périmètre et inchangés : frontend, Calendar/Week/Hover/Journal, densité des
markers, responsive/accessibilité, doctrine M3/M4, données Supabase, snapshots
live et publication.

## Baseline

```text
HEAD   = efa4cd2a4c27b4831263816d96f76e859a4356fb
branch = main
worktree avant lot = clean
```

`AGENTS.md` a été relu avant modification. Le lot ne crée aucune nouvelle
autorité métier, ne réutilise aucune doctrine V1 comme fallback et ne déplace
aucun calcul dans React.

## Architecture observée avant correction

Le runtime produit était déjà strictement snapshot-first :

```text
analytics_query_snapshots actifs
→ Query API
→ RuntimeSchema
→ React
```

La fuite d'autorité ne se trouvait pas dans `src/features/**` ni dans le lecteur
runtime, mais dans le producteur de bundle de prépublication :

```text
scripts/check-history-v2-certification-12-months.mjs
→ buildHistoryV2Preflight()
→ HISTORY_V2_PREFLIGHT_BUNDLE_FILE
→ prepare-history-v2-live-publication.mjs
```

Le même script certifiait les résultats et construisait les ReadModels. Il
injectait donc des valeurs EXPECTED dans le chemin produit.

## Usages d'oracle avant le lot

| Ressource / champ | Source avant | Effet |
|---|---|---|
| fenêtre de mois et Household | clés et metadata de `finalExpectedOracle` | l'oracle sélectionnait le scope de construction |
| tous les `resourceInputHash` Bilan | `data.oracle.actual.net` | une valeur EXPECTED participait à la closure locale |
| `history_month_balance_summary.typicalValue` | `data.oracle.typicalHousehold` | Typical publié fourni par l'oracle |
| `historicalRank` | `oracleMonths[*].actual.net` | série historique fournie par l'oracle |
| Typical catégorie / delta / matérialité | `data.oracle.typicalCategories.rows` | baseline M2 fournie par l'oracle |
| composition Typical catégorie | `monthlyObservations` de l'oracle | sélection des pivots fournie par l'oracle |
| `history_month_balance_summary.minimalValue` | `data.oracle.minimal` | Minimal publié fourni par l'oracle |
| `history_minimal_preview` | contributions de `data.oracle.minimal` | familles Minimal fournies par l'oracle |

M3 et M4 ne lisaient pas directement l'oracle. Ils restent alimentés par les
EconomicComponentFacts, classifications, Activity costs, Calendar artifact,
Daily ledger, occurrences et visites. Leur doctrine n'est pas modifiée dans
HC1.

## Architecture après correction

```text
CanonicalRepository
→ FactSourceResolver
→ produceMetric(typical_month_cost / minimal_month_cost)
→ resolveHistoryV2BalanceAnalyticsAuthority()
→ builders History V2
→ RuntimeSchemas
→ buildHistoryV2Preflight()
→ snapshots préparables

oracle EXPECTED
→ assertMonthInvariants()
→ PASS / FAIL uniquement
```

Le nouveau contrat `resolveHistoryV2BalanceAnalyticsAuthority()` n'accepte
aucun oracle. Il résout :

- le Typical Household officiel ;
- le Minimal officiel et ses composantes additives officielles ;
- le Typical officiel filtré pour chaque catégorie canonique réellement
  présente.

Le script choisit désormais la fenêtre certifiée indépendamment de l'oracle et
sélectionne le Household depuis la fixture canonique. L'identité Household de
l'oracle est seulement comparée à la fixture comme assertion EXPECTED.

## Sources Analytics officielles retenues

| Donnée publiée | Autorité après HC1 | Preuve code |
|---|---|---|
| Actual M1/M3 | `DailyEconomicLedgerMonthArtifact.actualMonthAmount` | `history-v2-monthly-engines.ts`, script de certification |
| série Actual / rang | artifacts Daily réels des mois précédents | `dailyByMonth` puis `computeHistoricalRank()` |
| Typical Household | `FactSourceResolver.resolve("typical_month_cost")` puis `produceMetric()` | `fact-source-resolver.ts`, `balance-authority.ts` |
| Minimal | `FactSourceResolver.resolve("minimal_month_cost")` puis `produceMetric()` | `minimal-source-resolver.ts`, `producer.ts`, `balance-authority.ts` |
| familles Minimal Preview | composantes de la source officielle `minimal_month` | `balance-authority.ts`, `buildMinimalPreview()` |
| Actual catégorie | `EconomicComponentFact` sélectionné au scope, montant réconcilié au Daily ledger | script de certification |
| Typical catégorie | `typical_month_cost` avec `filters.categoryIds=[categoryId]` | `balance-authority.ts` |
| historique / pivots catégorie | `monthlyObservations` de cette même source Typical filtrée | `balance-authority.ts`, `computeTypicalCompositionBaseline()` |
| delta / matérialité / composition | moteurs M2 existants sur les entrées officielles ci-dessus | `month-balance/engine.ts` |

Le schéma local compatible est déjà présent :

- `analysis_periods` qualifie la fenêtre Typical ;
- `CanonicalRepository.loadEconomicFacts()` fournit les Facts économiques ;
- `CanonicalRepository.loadMinimalPlanningBundle()` fournit besoins, règles,
  récurrences et provisions au moteur Minimal ;
- `economic_component_classifications` reste l'autorité M3 ;
- `analytics_artifacts`, `analytics_query_snapshots` et
  `analytics_publications` restent les stores existants.

Aucune migration n'est nécessaire pour HC1.

## Closure et hashes

`balanceContext()` ne contient plus `actual: data.oracle.actual.net`. Son
`resourceInputHash` dépend maintenant d'un digest déterministe couvrant :

- hashes des deux artifacts partagés ;
- sorties Analytics officielles Typical, Minimal et Typical catégories ;
- EconomicComponentFacts ;
- opérations nécessaires au bridge ;
- occurrences, visites, Moments, liens causaux et coûts Activity.

Une modification d'une entrée Analytics/Facts consommée change donc le digest
local puis participe au `publicationFactsHash` calculé par le preflight. Cette
fermeture est volontairement conservative ; elle ne modifie aucune formule.

## Oracle après HC1

Les références restantes à `oracleMonths` / `expectedOracle` sont limitées à :

- vérifier que l'EXPECTED couvre les douze mois ;
- vérifier que son Household correspond à la fixture ;
- comparer Actual, Typical, Minimal et Typical catégories dans
  `assertMonthInvariants()` ;
- reporter les compteurs V1 de non-régression.

Le builder `buildReadModel()` et les états `monthData` n'exposent plus
`data.oracle`. Une exécution de publication-only construit les mêmes inputs
officiels ; elle ne court-circuite pas le résolveur Analytics.

## Différences oracle ↔ Analytics

HC1 n'altère aucune valeur attendue et ne force aucun hash. Le gate ciblé prouve
que les valeurs du payload viennent des sorties Analytics. Le script de
certification comporte maintenant trois comparaisons bloquantes explicites :

- `X02_TYPICAL_EXPECTED` ;
- `X03_MINIMAL_EXPECTED` ;
- `K03_CATEGORY_TYPICAL_EXPECTED`.

Ainsi, une différence future Analytics ↔ EXPECTED arrêtera la certification au
lieu de réinjecter silencieusement l'EXPECTED dans le payload. La certification
exhaustive 12 mois n'a pas été relancée dans ce lot ciblé : ses fixtures et son
oracle sont des intrants externes non versionnés dans le repository. Elle reste
le prochain gate avant toute republication, laquelle est explicitement hors
périmètre ici.

## Tests

| Contrôle | Résultat |
|---|---|
| mutation oracle seule → autorités et payload M1 identiques | PASS |
| mutation Typical/Minimal/Typical catégorie officiels → payload/valeurs changés | PASS |
| `check:history-v2-month-balance` | PASS — 77/77 |
| `check:history-v2-readmodels` | PASS — 27/27 |
| `check:history-v2-snapshot-materialization` | PASS — 79 checks, 15 ressources, 2 artifacts, finalize=false |
| `check:history-v2-calendar-daily` | PASS — 42/42 |
| `check:architecture` | PASS — 461 fichiers |
| `tsc --noEmit --incremental false` | PASS |
| `next build` | PASS — Next 16.2.6 |
| `git diff --check` | PASS |

Les tests existants couvrent aussi les réconciliations Actual, catégories,
Minimal additif, axes M3, bridge et RuntimeSchemas. Le test ciblé lit le script
de construction et refuse toute réapparition de `data.oracle` dans ce chemin.

## Fichiers modifiés

- `src/analytics/history-v2/balance-authority.ts` — adaptateur vers les moteurs
  Analytics officiels ;
- `src/analytics/history-v2/index.ts` — export du contrat ;
- `scripts/check-history-v2-certification-12-months.mjs` — recâblage du builder,
  closure et comparaisons EXPECTED ;
- `scripts/check-history-v2-month-balance.mjs` — tests discriminants HC1 ;
- `docs/history-v2/25-history-core-analytics-authority-report.md` — présent
  rapport.

Aucun fichier `.tsx`, aucun style, aucune route et aucun composant React n'a été
modifié. Il n'existe donc aucun déplacement de logique métier vers le frontend.

## Points restant ouverts

- La recertification exhaustive puis la republication des douze mois sont des
  lots ultérieurs ; aucune écriture live n'a été effectuée ici.
- La centralisation doctrinale M3, la causalité Moment et le scoring/coverage
  Place/Activity appartiennent à HC2 et restent volontairement inchangés.
- Frequency/ticket, lifecycle et merchant/purchase restent dans leur état
  UNKNOWN/différé existant lorsqu'aucune autorité déjà exploitable n'est
  disponible. Aucune valeur n'a été inventée.

`AUTHORITY_GAP` : aucun pour les champs qui tiraient auparavant leur valeur de
l'oracle. Les autorités existantes `typical_month_cost`, `minimal_month_cost`,
Daily Economic Ledger et EconomicComponentFacts couvrent le périmètre HC1.

## Gate final

HISTORY CORE HC1

PASS
