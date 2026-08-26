# Analytics materialization V2

## Rôle

La matérialisation répond au bottleneck runtime profilé d’Analysis sans changer
les résultats. Supabase Canonical et les Facts restent les vérités ; les tables
ci-dessous ne contiennent que des résultats dérivés reconstructibles :

- `analytics_artifacts` : enveloppes `ProducedMetric` complètes et validées ;
- `analytics_query_snapshots` : ReadModels Query validés, jamais du JSON React ;
- `analytics_publications` : brouillons et publication atomique d’un ensemble
  de résultats.

L’identité déterministe inclut toujours le household, le subject, le scope, les
filtres, la période, la famille/ressource et les versions de méthode/contrat.
Une `generation_key` distincte permet de préparer une nouvelle publication sans
écraser la publication active. Les writes navigateur sont interdits ; RLS ne
donne aux membres du foyer qu’un accès `SELECT` aux deux caches.

## Read-through et validation

Le Query Runtime exécute d’abord normalisation, autorisation, applicability,
capabilities et cohérence de révision. Il cherche ensuite un snapshot compatible.
Même sur HIT, `validateQueryData` et le schéma `ApiResponse` restent obligatoires.
Sur MISS/STALE, le moteur Canonical → Facts → Analytics calcule, valide et écrit
le cache avant de répondre.

`MetricQueryService` réutilise les artefacts dans une Query et entre Queries.
Evolution et Typical chargent leurs observations mensuelles dans une lecture
groupée. Structure default est calculée depuis un dataset mensuel partagé puis
son ReadModel (et les métriques produites par le service) est persisté. Lived et Moments restent
month-scoped. Le planner Global agrège uniquement une métrique déclarée
`additive` par le Metric Registry et seulement si toutes les enveloppes
mensuelles préservent availability, coverage, support, provenance, unité et
MethodVersion. Toute métrique conditionnelle, non additive, incomplète ou
ambiguë repasse par le moteur brut.

## Freshness et invalidation

Un mois fermé est frais quand sa `source_revision` couvre celle de
`analysis_periods` et le dernier impact compatible de `analytics_change_log`.
Une hausse globale de `dataRevision` causée par août ne rend donc pas juillet
stale. Un mois ouvert et un scope Global doivent en revanche égaler la
`dataRevision` courante.

Le helper server-only `recordAnalyticsMutation()` est la frontière des futures
écritures : il appelle la fonction trusted `record_analytics_mutation`, laquelle
bump la révision, journalise l’impact et invalide le périmètre déterminé par
`queryResourcesInvalidatedByImpact()`. Un impact `month` ne touche que ce mois ;
`global_reference` touche les résultats Global et les références mensuelles
postérieures compatibles ; `entity` et `narrative` utilisent leur liste de
ressources. Aucun `DELETE ALL CACHE` n’est effectué.

Une publication complète active les nouvelles générations et désactive les
anciennes dans la même transaction, avance `analyticsRevision`, renseigne
`analysis_periods.source_revision` et marque les changements traités. Un échec
laisse les lignes draft inactives et conserve l’ancienne publication.

## Politique client et niveaux de cache

- L1 : mémoire d’onglet, clé Query canonique ;
- L2 : aucun cache CDN/public pour les données financières privées ;
- L3 : materialization Supabase persistante et household-scoped ;
- L4 : recalcul Canonical/Facts/Analytics.

Le serveur publie `meta.cachePolicy`. Un mois fermé matérialisé frais utilise
`revalidate: never` et ne relance pas automatiquement la Query lourde dans le
même onglet. Un mois ouvert ou Global utilise `stale_while_revalidate`. Le
client n’invalide plus les autres mois parce que leur révision globale diffère.

## Backfill contrôlé

La migration ne calcule rien et le build Vercel n’écrit rien. Après application
de la migration, le backfill household/default/no-filter des mois fermés
2025-08 à 2026-07 se lance explicitement :

```powershell
$env:ANALYTICS_BACKFILL_HOUSEHOLD_ID = "<household-uuid>"
pnpm run backfill:analytics
```

Les surfaces hot sont `analysis_month_initial`, `evolution`, Structure
`destination/category/amount`, `lived` et `moments`. Le script saute un mois
dont les cinq snapshots sont déjà frais. En cas d’interruption, une relance
reprend aux mois manquants sans dupliquer les générations.

Pour reconstruire volontairement les douze mois depuis Canonical sans supprimer
le cache actif avant succès :

```powershell
$env:ANALYTICS_BACKFILL_FORCE = "true"
pnpm run backfill:analytics
```

Ne jamais placer `SUPABASE_SECRET_KEY` dans le navigateur ou dans un fichier
commité. La commande utilise exclusivement les variables server-only déjà
prévues par le runtime.

## Observabilité

Les logs `analytics_materialization_*`, `analytics_query_snapshot_*` et
`analytics_recompute_*` contiennent seulement ressource, type de scope, durée,
révision, environnement et commit. Aucun montant, libellé, nom, token ou UUID
brut n’est journalisé.
