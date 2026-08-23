# Carte technique Supabase V2

**STATUT : SNAPSHOT HISTORIQUE SUPABASE DISTANTE — GATE 0**

Ce document décrit la base distante telle qu’elle a été validée au Gate 0. Ce
n’est ni une migration, ni un dump de schéma ou de données, et il ne décrit pas
automatiquement l’état actuel du code. Pour l’avancement courant, consulter
`docs/plans/V2_EXECUTION_PLAN.md`.

## Snapshot validé

- 49 tables physiques, 616 colonnes physiques et 11 695 lignes bootstrap ;
- 99 clés étrangères et 10 vues canoniques ;
- RLS active sur les 49 tables ;
- validation : 402 PASS / 0 FAIL / 0 ERROR.

## Auth et accès navigateur

```text
auth.users
→ private.household_memberships
→ public.households
```

`persons` est distincte des identités Auth. Un navigateur authenticated dispose
d’un SELECT direct uniquement sur `households`, `persons`, `analysis_periods` et
`household_revisions`. Il n’interroge pas `private.household_memberships`.

## Couche canonique existante, serveur uniquement

- `canonical_household_scope_control`
- `financial_refund_source_canonical`
- `financial_refund_unallocated_control`
- `financial_bank_cost_canonical`
- `financial_economic_cost_canonical`
- `financial_canonical_reconciliation_control`
- `operation_place_canonical`
- `financial_source_attribution_control`
- `financial_economic_timing_canonical`
- `financial_economic_timing_control`

## Doctrine canonique

- Compter le parent ou ses enfants, jamais les deux.
- Le cash économique est distinct du retrait bancaire.
- Un remboursement attribué réduit sa source ; un remboursement non alloué
  reste séparé.
- `operation_place_canonical` fait autorité pour les agrégations monétaires par lieu.
- La causalité additive est contrôlée.
- Une temporalité `unknown` reste `unknown`.

## Révisions

Le suivi repose sur `data_revision`, `analytics_revision`,
`analytics_change_log` et `analytics_pending_changes`.

## Absent du snapshot distant lors du Gate 0

- `fct_economic_component`, `fct_activity_occurrence`, `fct_person_day`,
  `fct_purchase_event` et `fct_place_visit` ;
- le Metric Registry complet et les références Minimal / Typiques ;
- les analytics avancés, read models `api.*` et la Query API complète ;
- NarrativeFactPack et l’UI V2 finale ;
- les projections runtime nécessaires au calcul Minimal ;
- la migration d’identité Purchase Event, versionnée ensuite dans le dépôt et
  toujours différée à une phase de migration explicite.

Plusieurs de ces éléments ont depuis été construits dans le code applicatif.
Cette liste reste celle du snapshot distant historique, pas une roadmap.

Les anciens chiffres de ce document restent volontairement inchangés : ils
appartiennent au snapshot historique et n’ont pas été réaudités pendant la
consolidation Preview.
