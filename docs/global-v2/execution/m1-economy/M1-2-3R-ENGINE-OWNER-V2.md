# M1-2/3R — moteur M1 et owner V2 sans backfill

Date : 2026-09-08

Branche : `main`

Baseline : `7dcda0a11d23bb4f28c4e4fa517a8318deef5eba`

## Verdict

Le moteur M1 possède désormais un owner serveur unique, construit exclusivement depuis Canonical, Facts et les producteurs Analytics officiels. L'absence de l'autorité bitemporelle Minimal rend chaque point Minimal concerné `UNKNOWN` sans effacer Actual, Typical, structure ou temporalité. Aucun backfill n'est nécessaire pour construire l'owner.

```text
M1_2_3R_ENGINE_OWNER = PASS
M1_OWNER_V2 = PASS
M1_HISTORY_ACTUAL_TYPICAL = PASS
M1_HISTORY_MINIMAL = PARTIAL_UNTIL_BACKFILL
STRUCTURE_3_AXES = PASS
TEMPORAL_COMPLETE = PASS
RECURRENCE_ENGINE_WIRED = YES
RECURRENCE_FACTS_SURVIVE_UNKNOWN_LIFECYCLE = YES
STRUCTURAL_RECURRING_COST = LOCAL_PARTIAL
CONTRIBUTORS = PASS
CONDITIONAL_CAPABILITIES = SAFE_GATED
OVER_GATING_CHECK = PASS
NO_HISTORY_QUERY_AS_AUTHORITY = YES
TYPECHECK = PASS
TARGETED_TESTS = PASS
SUPABASE_WRITES = 0
VERCEL_DEPLOY = NO
```

## Owner et chaîne d'autorité

`resolveGlobalM1HouseholdAuthority()` suit désormais la chaîne :

`CanonicalRepository → FactSourceResolver → producteurs Actual/Typical/Minimal → buildGlobalM1OwnerV2()`.

`GlobalM1OwnerOutputV2` porte une seule vérité M1 : état du mois, série certifiée de douze mois maximum, structure, résultats temporels, récurrences, contributeurs, capacités conditionnelles, méthodologie, digests et déclaration de dépendances. M2 et l'orchestrateur Global consomment ce nouvel owner. La projection Query ne recalcule pas la doctrine ; elle accepte temporairement l'ancienne forme d'owner pour conserver les fixtures certifiées déjà existantes.

## Contrats fermés

| Contrat | Résultat | Preuve |
|---|---|---|
| Economic state | Actual, TypicalReference, TypicalState, MinimalState et deux deltas backend | test state/deltas, opérande inconnue localisée |
| Historique | douze mois certifiés max, lineage et révisions par point | 12 points, futur exclu, hash stable |
| Minimal local | `UNKNOWN` si autorité bitemporelle absente | Actual/Typical/Recent/structure restent connus |
| Structure | nécessité, comportement, LifeScope sur `ACTUAL_TARGET_MONTH` | buckets, montants, shares, total, unknown/conflict, support/coverage |
| Vocabulaire nécessité | Indispensable, Contraint, Optionnel | aucune chaîne `Ajustable` dans l'owner |
| Temporal | Recent Change, Trend complet, dispersion, stabilité, ordinary dispersion | primitives P04 partagées ; qualifications non prouvées restent `UNKNOWN` |
| Current regime / long term | sorties présentes et safe-gated | aucun régime ou support long terme inventé |
| Récurrences | faits liés par `recurrence_series_id`, occurrences dédupliquées au grain opération/date | IDs stables, first/last, coût typique, provenance |
| Lifecycle | autorité bitemporelle explicite seulement | une série factuelle reste visible avec lifecycle `UNKNOWN` |
| Agrégats | gating indépendant par résultat | structural cost `PARTIAL` si certains équivalents sont prouvés ; ended/restarted restent locaux |
| Contributors | sources typées, delta, support/coverage/materiality, additivité, eligibility | aucune part expliquée non additive |
| Méthodologie | asOf, certifiedThrough, méthodes, support, coverage, limites, révisions, preuves, closure | hash sensible aux digests métier |

## Récurrences et autorité historique

Le repository fournit les séries et opérations liées, sans promouvoir `statut_serie`, `actif_prevision` ou une autre vue courante en vérité historique. Les observations économiques sont regroupées au grain `recurrenceId + operationId + economicDate`; plusieurs composantes d'une même opération ne deviennent donc pas plusieurs occurrences.

Sans autorité bitemporelle explicite :

- `firstObservedAt`, `lastObservedAt` et `typicalOccurrenceCost` restent descriptifs et publiables selon leur support ;
- cadence, expected amount, monthly equivalent et lifecycle restent `UNKNOWN` selon leur propre dépendance ;
- la série reste visible ;
- un agrégat connu ou partiel n'est pas contaminé par un autre agrégat inconnu.

Le builder accepte une autorité effective/declared/sourceRevision pour les fixtures et le futur backfill, mais le raccordement live n'en fabrique aucune.

## Qualité par phénomène

Chaque valeur monétaire critique possède état de connaissance, support, coverage avec base et dénominateur, matérialité, provenance, version de méthode et inputHash. La qualité du module reste uniquement une synthèse dans les ReadModels. Les propriétés optionnelles absentes ne sont jamais sérialisées avec `undefined`.

## Tests exécutés

| Preuve | Résultat |
|---|---|
| `check:m1-2-3r-engine-owner` | 56/56 PASS |
| fondations R1 | 46/46 PASS |
| M1 economic function | 72/72 PASS |
| M2 / materiality | 49/49 PASS |
| P04 temporal arbitration/lifecycle/fusion | 179/179 PASS |
| production bridge | 66/66 PASS |
| primary ReadModels | 83/83, 10/10 schemas PASS |
| Query instances | 57/57, 32/32 RuntimeSchemas PASS |
| typecheck | PASS |
| architecture | PASS, 563 fichiers |
| `git diff --check` | PASS |

## Limites explicites

- `M1_HISTORY_MINIMAL = PARTIAL_UNTIL_BACKFILL` : aucune autorité H1 n'a été sélectionnée ou rétroprojetée.
- `STRUCTURAL_RECURRING_COST = LOCAL_PARTIAL` : les coûts factuels restent visibles, mais seuls les équivalents mensuels explicitement autorisés entrent dans la somme.
- les évolutions structurelles restent `UNKNOWN` tant qu'aucune référence structurelle compatible n'est fournie ; les axes courants sont complets.
- Current Regime, Long Term et Periodicity sont présents mais localement safe-gated lorsque leurs preuves manquent.
- aucune Query History, preuve compare-only ou snapshot n'alimente l'owner.
- aucun frontend, snapshot, publication, migration, accès Supabase ou déploiement n'a été effectué.
