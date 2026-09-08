# M1-1R — Fondations shared sûres et Minimal non bloquant

Date : 2026-09-08

Branche : `main`

Baseline : `7e98d0a8118f6fd1e3d3016057a943c3c553c813`

## Verdict

Le lot R1 est fermé localement. Le calcul Minimal historique ne consomme plus les lignes Canonical courantes comme si elles avaient été valides dans le passé. L'absence du futur backfill bitemporel rend uniquement Minimal `UNKNOWN`; Actual, Typical, structure, récurrences observables et analyses temporelles conservent leur propre calculabilité.

```text
M1_1R_FOUNDATIONS = PASS
MINIMAL_Q25 = PASS
HISTORICAL_MINIMAL_LOCAL_GATING = PASS
HISTORICAL_MINIMAL_BACKFILL_APPLIED = NO
DECLARED_MINIMUM_SAFE = PASS
TYPICAL_OCCURRENCE_METRIC = PASS
TREND_RELATIVE_SLOPE = PASS
STABILITY_AMPLITUDE = PASS
OVER_GATING_CHECK = PASS
MODULE_WIDE_BLOCK_FROM_LOCAL_UNKNOWN = NO
SUPABASE_WRITES = 0
LIVE_MIGRATION_APPLIED = NO
VERCEL_DEPLOY = NO
TYPECHECK = PASS
TARGETED_TESTS = PASS
```

## Autorités et décisions appliquées

- `VARIABLE_ESSENTIAL` utilise les douze derniers mois éligibles strictement antérieurs au mois cible, exige six observations et calcule le Q25 selon la convention déterministe `LINEAR_TYPE_7` déjà employée par les primitives statistiques du dépôt.
- Une observation absente ou `UNKNOWN` n'est jamais convertie en zéro. Un zéro explicitement `KNOWN` reste une observation.
- Une règle future ou une observation du mois cible/future ne modifie pas un résultat passé.
- `DECLARED_MINIMUM` exige une autorité déclarée effective. Son absence produit `DECLARED_AUTHORITY_MISSING`.
- Les familles fixes/périodiques exigent une autorité de récurrence effective et active. L'état courant `actif_prevision` n'est jamais projeté dans le passé.
- Le modèle préparé est `BITEMPORAL_TYPED_RULE_AND_RECURRENCE_AUTHORITY_V1`, avec `effectiveFrom`, `effectiveTo`, `declaredAt` et `sourceRevision`. Aucun des choix de backfill H1 n'est effectué ici.
- Le certificat `minimal_month_cost@v1` reste lisible pour les générations History existantes, mais n'alimente pas la nouvelle résolution Canonical sûre. Le nouveau contrat produit `minimal_month_cost@v2` et `minimal_variable_essential_q25@v2` avec des hashes sensibles aux intrants effectifs.

## Implémentation

| Contrat | Implémentation | Preuve |
|---|---|---|
| Q25 VARIABLE_ESSENTIAL | `src/analytics/baseline/historical-minimal.ts` | cas exact, support 5/6, fenêtre 12, no-lookahead |
| Gate Minimal historique | `src/server/analytics/minimal-source-resolver.ts` | absence d'autorité → `unknown`, listes vides, santé `MISSING_SOURCE` |
| Contrat repository | `src/server/canonical/repository.ts` | bundle bitemporel optionnel ; le loader live ne le fabrique pas |
| DECLARED_MINIMUM | `resolveHistoricalMinimalState()` | autorité explicite effective ou `UNKNOWN` |
| Typical occurrence | `calculateTypicalOccurrenceCost()` | médiane des occurrences éligibles, `EUR/occurrence`, support `OCCURRENCE` |
| TrendResult | `src/analytics/global-v2/temporal-descriptive.ts` | pente, pente relative, bornes, support, matérialité, méthode |
| Dispersion | même primitive | minimum, maximum et amplitude ; aucune classe de stabilité ajoutée |
| Dépendances M1 | `createGlobalM1DependencyDeclaration()` | autorités historiques optionnelles et Minimal optionnel ; autres owners inchangés |

## Anti-over-gating

Le contrat de dépendances M1 classe désormais `minimal_month_cost` et les trois autorités historiques comme optionnels. Les tests discriminants prouvent qu'un Minimal `UNKNOWN` n'empêche pas :

- Actual officiel `KNOWN` ;
- Typical lorsque son support est suffisant ;
- structure nécessité/comportement/LifeScope ;
- Trend et Recent Change ;
- faits de récurrence et `typicalOccurrenceCost`.

Cette règle ne transforme pas l'inconnu en valeur. Elle empêche seulement sa propagation vers des résultats qui ne dépendent pas strictement de Minimal.

## Tests exécutés

| Commande | Résultat |
|---|---|
| `node scripts/check-m1-1r-shared-foundations.mjs` | 46/46 PASS |
| `node --experimental-strip-types scripts/check-global-v2-foundations.mjs` | 108/108 PASS |
| `node --experimental-strip-types scripts/check-global-v2-economic-function.mjs` | 72/72 PASS |
| `node --experimental-strip-types scripts/check-global-v2-temporal-descriptive.mjs` | 17/17 PASS |
| `node --experimental-strip-types scripts/check-global-v2-temporal-arbitration.mjs` | 179/179 PASS |
| `node scripts/check-analytics-materialization.mjs` | PASS, certificat Minimal History legacy préservé |
| `node scripts/check-live-runtime-regressions.mjs` | PASS, fail-closed Canonical propagé correctement |
| `node node_modules/typescript/bin/tsc --noEmit` | PASS |
| `node scripts/check-architecture-imports.mjs` | PASS, 562 fichiers |
| `git diff --check` | PASS |

Le script `check-history-v2-current-minimal-evidence.mjs` n'est pas un gate R1 et exige un export Canonical privé absent du workspace ; son préflight a refusé de démarrer. Aucun résultat History ni aucune donnée privée n'ont été produits. La compatibilité de la preuve legacy est vérifiée dans `check-analytics-materialization.mjs`.

## Limites explicites

- Aucun backfill des décisions H1.
- Aucune migration créée ou appliquée.
- Aucune connexion ni écriture Supabase.
- Aucun payload, snapshot, publication ou ReadModel live modifié.
- Aucun frontend modifié et aucun déploiement Vercel.
- Tant que l'autorité bitemporelle approuvée n'est pas fournie au repository, Minimal Canonical reste localement `UNKNOWN` par conception.

## Fichiers H1 préservés

Les deux livrables H1 présents à l'entrée sont conservés sans les promouvoir en autorité exécutable :

- `M1-H1-HISTORICAL-AUTHORITY-BACKFILL-DESIGN.md` ;
- `M1-H1-HUMAN-VALIDATION-CANDIDATES.json`.

Ils décrivent le futur travail humain/backfill ; R1 n'en sélectionne ni n'en applique les décisions.
