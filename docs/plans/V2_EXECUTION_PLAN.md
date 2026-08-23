# Plan d’exécution Budgetisation V2

Statuts utilisés : `TODO`, `IN PROGRESS`, `DONE`, `BLOCKED`, `DEFERRED`.

| Étape | Chantier | Statut réel |
|---:|---|---|
| 0 | Audit, nettoyage V1 et bootstrap Gate 0 | DONE |
| 1 | Architecture Core | DONE |
| 2 | Navigation Core et restauration | DONE |
| 3 | Couche canonique locale / lecteurs BDD | DONE |
| 4 | Facts, Analytics Core et Metric Registry | DONE |
| 5 | Query API et read models | DONE |
| 6 | Foundations UI, design, média et accessibilité | DONE |
| 7 | Calendrier et Day Drawer | DONE |
| 8 | Exploration, entités et galeries | DONE |
| 9 | Opérations, preuve et qualité | DONE |
| 10 | Analyse Mois | DONE — blocs documentés ci-dessous |
| 11 | Analyse Global | DONE — blocs documentés ci-dessous |
| 12 | IA / narration libre | DEFERRED |
| 13 | Hardening Preview reproductible | DONE |
| 14 | Hardening production | DEFERRED |

## Blocs contractuels

- Financial Family : `BLOCKED_CONTRACT`. Aucune taxonomie normative n’est
  disponible ; Category reste distincte de Family.
- Necessity à trois états : `BLOCKED_CONTRACT`. Le champ Ajustable n’est pas
  fusionné ou réinterprété pour inventer ce mapping.

Analysis Month est donc `DONE WITH DOCUMENTED CONTRACT BLOCKS`, et non bloqué
globalement : toutes ses parties exécutables sont fermées. Analysis Global est
également fermé pour les exigences exécutables.

## Blocs de données et migrations

- Minimal Month : `BLOCKED_DATA`. Le moteur, le MetricId
  `minimal_month_cost`, la méthode `minimal_month_cost@v1` et le rendu sont
  prêts, mais les projections runtime `neutral_variable_month_cost` et
  `mandatory_monthly_obligations_and_provisions` sont absentes.
- Purchase Event : `DEFERRED_TO_MIGRATION_PHASE`. La migration locale est
  versionnée mais n’a pas été appliquée à la base distante dans cette phase.
- Relationships et Patterns Global : méthode/source canonique absente ; les
  onglets ne sont pas publiés dans `availableViews`.

## Éléments volontairement différés

Imports, Paramètres, narration IA, profiling SQL généralisé, index tuning,
vues matérialisées, tests de charge, APM, monitoring de production et cache
avancé restent `DEFERRED`.

La référence Supabase est un snapshot historique du Gate 0. Elle ne remplace
pas ce plan pour suivre l’état actuel du code.
