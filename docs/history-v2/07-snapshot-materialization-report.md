# History V2 — snapshots et matérialisation

## Périmètre et gate d'entrée

Ce lot implémente la politique de snapshots et de matérialisation History V2.
Il ne publie aucune génération live et ne modifie aucune donnée Supabase.

Gate d'entrée vérifié dans
`docs/history-v2/06-month-balance-report.md` :

```text
MONTH_BALANCE_GATE = PASS
```

Les contrats transversaux, les deux moteurs partagés, les quatre ReadModels
Calendar et les onze ReadModels Bilan étaient donc disponibles avant le début
du lot.

## Résultat d'architecture

Le profil logique est `history-v2-month@v1`. Il est strictement mensuel,
Household-scoped et `contractVersion=v2`.

Le pipeline est composé de trois phases distinctes :

1. **PRE-FLIGHT read-only** : construction des deux artifacts et des ReadModels,
   validation par les RuntimeSchemas, fermeture récursive du manifest, calcul
   des hashes et signatures ;
2. **STAGE DRAFT** : ajout d'un `PublicationMeta` commun, nouvelle validation
   complète et préparation de lignes inactives ;
3. **FINALIZE** : reste la responsabilité du RPC atomique existant, mais est
   explicitement interdit par le profil de test de ce lot.

Le profil de backfill de ce lot est
`history-v2-read-only-preflight@v1` : `mode=read_only`, `stage=in_memory`,
`finalize=forbidden`.

Les tables existantes sont réutilisées :

- `analytics_publications` pour la DRAFT et ses ensembles requis ;
- `analytics_artifacts` pour les deux artifacts partagés ;
- `analytics_query_snapshots` pour les instances Query.

Aucune table de snapshot supplémentaire et aucun God RPC n'ont été créés.

## Ressources existantes réutilisées

Les quinze ressources existaient déjà dans le Resource Registry, le Resource
Contract Registry, le Capability Registry, l'Adapter Registry et l'Output
Schema Registry. Elles sont enregistrées dans le profil par dérivation du
registre autoritaire, et non par une seconde liste métier indépendante.

### Calendar / Journal / Overview

1. `history_month_calendar`
2. `history_week`
3. `history_day_journal`
4. `history_month_overview`

### Bilan M1–M4

5. `history_month_balance_summary`
6. `history_bank_economy_bridge`
7. `history_month_categories`
8. `history_category_detail`
9. `history_month_spending_nature`
10. `history_spending_segment_detail`
11. `history_minimal_preview`
12. `history_month_life_money`
13. `history_activity_detail`
14. `history_moment_detail`
15. `history_place_detail`

## Ressources réellement nouvelles

```text
NONE
```

Le lot ajoute un orchestrateur de matérialisation et des profils, pas une
seizième ressource Query ni une duplication des quinze builders.

## Artifacts partagés

Deux familles, exactement, sont intégrées :

| Famille | Producteur réutilisé | Stockage | Contrat |
|---|---|---|---|
| `calendar_semantic_month` | Calendar Semantic Engine | `analytics_artifacts` | `v2`, `calendar_semantic_month@v1` |
| `daily_economic_ledger_month` | Daily Economic Finance Engine | `analytics_artifacts` | `v2`, `daily_economic_ledger_month@v1` |

Chaque identité d'artifact contient Household, mois, scopeHash,
filterSignature, méthode et contrat. Les deux clés sont distinctes. Le champ
générique `metric_id` de la table existante reçoit un identifiant technique
namespacé `history_v2:<artifactFamily>` ; aucune nouvelle table n'est requise.

En DRAFT, les artifacts sont écrits avec `is_active=false`, le même
`publication_id` que les Query snapshots et leur enveloppe complète
`PublicationMeta`. Le read path exige toujours une ligne active, `v2`, avec la
bonne famille et la bonne méthode.

## RuntimeSchemas

Le PRE-FLIGHT appelle le RuntimeSchema enregistré pour chaque instance Query,
puis vérifie aussi la cohérence requête/réponse : mois, date, weekStart et
identifiants de détails.

Le STAGE réinjecte le `PublicationMeta`, puis repasse chaque payload par le même
RuntimeSchema. Les deux artifacts sont validés par leur schema moteur puis par
`historyV2StagedArtifactEnvelopeSchema`.

Le stage refuse notamment :

- une famille d'artifact inconnue ;
- un `artifactInputHash` discordant ;
- des policyVersions discordantes entre artifact et PublicationMeta ;
- une Query requise absente ;
- une identité de publication non commune ;
- une DRAFT sans publicationId.

Le test de génération obtient une validation RuntimeSchema de 100 % des 54
instances Query et des deux artifacts.

## Manifest déterministe

### Règles de fermeture

Le manifest est construit à partir de :

- huit ressources mensuelles top-level ;
- un Journal pour chaque jour du mois ;
- les semaines dont le jeudi appartient au mois propriétaire ;
- les `QueryTargetRef` structurés présents dans les ReadModels ;
- les détails de segment dérivés centralement des clés structurées des axes et
  cellules `Necessity × Behavior`.

La projection des segments n'utilise ni libellé, ni heuristique, ni recherche
textuelle. Elle traduit uniquement les clés canoniques `axis/bucket` et
`necessity/behavior` vers le contrat de paramètres déjà enregistré.

Les références vers un jour ou une semaine appartenant à un mois voisin sont
conservées comme `externalQueryRefs`. Elles ne sont pas réattribuées
artificiellement au mois courant.

### Manifest théorique mai 2026

| Instance | Nombre |
|---|---:|
| familles logiques | 15 |
| artifacts requis | 2 |
| ressources top-level | 8 |
| Journals propriétaires du mois | 31 |
| Weeks propriétaires du mois | 4 |
| drill-downs atteignables dans la fixture | 11 |
| Query snapshots locaux | 54 |
| références externes dédupliquées | 5 |

Les quatre semaines de mai 2026 commencent les `2026-05-04`, `2026-05-11`,
`2026-05-18` et `2026-05-25`. Les références externes correspondent aux jours
de grille d'avril et à la navigation vers le 1er juin ; elles restent
explicitement hors publication propriétaire de mai.

### Hashes de la génération de test

```text
manifestHash=8124fdd438d7090796eee6f4bf053acafbbefe5bf9d29e742633fc9f496dbdf3
publicationFactsHash=19d808294cf5004260f3a7a1152e8e7404d5410eb985db3b9bf3e8782a40ac53
```

L'ordre inversé des artifacts produit les mêmes clés, le même manifestHash et
le même factsHash. Une mutation limitée au fait d'un `Place Detail` conserve le
manifestHash mais change le factsHash commun à toute la publication.

## Versions et hashes

### contractVersion

Le `contractVersion` reste déterminé par
`getQueryResourceContract(resource)`. Les quinze ressources History V2 sont
`v2`; les anciennes ressources certifiées restent `legacy_v1`.

### policyVersions

Chaque ReadModel porte uniquement les policies déclarées par son contrat de
ressource. Le stage compare ces policies avec son PublicationMeta. Il ne force
pas une union globale de policies dans chaque payload.

### methodSignature

`querySnapshotIdentity()` utilise la signature propre à la ressource : contrat,
MetricIds/methodVersions réutilisés et policies pertinentes. Le test confirme
que la publication commune contient plusieurs signatures de ressource, sans
les écraser par une signature globale.

### factsHash et hashes internes

- `PublicationMeta.factsHash` est commun aux deux artifacts et aux 54 Query
  snapshots ;
- il couvre l'union dédupliquée des faits et dépendances de toutes les
  fermetures locales ;
- `artifactInputHash` et `resourceInputHash` restent des digests internes
  locaux ;
- `manifestHash` décrit l'ensemble d'instances et ne change pas quand seule la
  valeur d'un fait change.

## Publication et stage de test

`SupabaseAnalyticsMaterializationStore` expose désormais
`beginMonthPublicationProfile()` : il reçoit les artifacts et requêtes fermés
par le PRE-FLIGHT, refuse les clés vides/dupliquées et crée une DRAFT avec les
ensembles requis exacts.

Le chemin V1 `beginMonthPublication()` est conservé. Il calcule toujours ses
trois artifacts Analysis historiques puis délègue à la primitive générique.

La génération de test :

- a construit les deux artifacts en read-only ;
- a exécuté les quinze builders via 54 instances ;
- a validé tous les payloads avant et après ajout du PublicationMeta ;
- a préparé une DRAFT dans un client Supabase factice ;
- a préparé un artifact inactif dans ce même client factice ;
- n'a exécuté aucun RPC ;
- retourne `finalizeRequested=false`.

```text
History V2 snapshot materialization: PASS (47 checks)
FINALIZE CALLS = 0
LIVE WRITES = 0
```

## Drill-downs

| Source | Destination | Fermeture |
|---|---|---|
| Calendar day | `history_day_journal {date}` | structurée, récursive |
| Bilan summary | `history_bank_economy_bridge` | structurée |
| Category summary | `history_category_detail {categoryId}` | structurée |
| Spending axes | `history_spending_segment_detail` | projection canonique centrale |
| Activity card | `history_activity_detail {activityTypeKey}` | structurée |
| Moment card | `history_moment_detail {momentId}` | structurée |
| Place card | `history_place_detail {placeId}` | structurée |

La déduplication se fait par `queryKey`, donc un même détail référencé plusieurs
fois n'est construit qu'une fois. La boucle de fermeture termine même en
présence d'un graphe cyclique de références.

## Compatibilité V1 / V2

- les tables et le RPC atomique existants sont réutilisés sans migration ;
- les ressources, builders, schemas et snapshots V1 restent parallèles ;
- le profil V1 de backfill n'est pas renommé ni supprimé ;
- les Query reads filtrent par `queryKey`, `contract_version` et
  `method_signature` ;
- un snapshot V1 ne peut donc pas satisfaire une requête History V2 ;
- le source History V2 reste `TEMPORARY_UNAVAILABLE` tant qu'aucune publication
  V2 compatible n'est active, plutôt que de retomber sur un payload V1 ;
- aucun moteur Analysis V1 n'est dupliqué.

## Fichiers du lot

### Créés

- `src/server/analytics/materialization/history-v2.ts`
- `scripts/check-history-v2-snapshot-materialization.mjs`
- `docs/history-v2/07-snapshot-materialization-report.md`

### Adaptés

- `src/server/analytics/materialization/identity.ts`
- `src/server/analytics/materialization/index.ts`
- `src/server/analytics/materialization/store.ts`
- `package.json`

## Tests et non-régressions

```text
History V2 canonical contracts: PASS
History V2 transversal contracts: 48/48 PASS
History V2 Calendar + Daily Finance: 29/29 PASS
History V2 ReadModels: 22/22 PASS
History V2 Month Balance: 61/61 PASS
History V2 snapshot materialization: 47/47 PASS
Analytics materialization checks: PASS
ANALYSIS_MONTH_CONTRACT_INVARIANTS=PASS
ANALYSIS_GLOBAL_CONTRACTS=PASS
Architecture import check: PASS (465 fichiers)
Product completeness check: PASS (7 surfaces, 2 routes futures)
Typecheck: PASS
Next production build: PASS
```

Les avertissements Node `MODULE_TYPELESS_PACKAGE_JSON` de certains scripts sont
préexistants et n'affectent pas leurs résultats.

## Conformité au Brief

| Exigence | Preuve | Statut |
|---|---|---|
| quinze ressources logiques ciblées | registre dérivé, 15 familles atteintes par le test | PASS |
| aucun God RPC | ressources ciblées et RPC atomique existant inchangé | PASS |
| réutiliser les ressources des lots précédents | aucune nouvelle Query resource | PASS |
| deux artifacts partagés | deux familles exactes, deux clés requises | PASS |
| RuntimeSchemas exhaustifs | 54/54 Query + 2/2 artifacts reparsés au stage | PASS |
| manifest déterministe | hashes et ensembles identiques après permutation | PASS |
| drill-downs fermés | 11 détails locaux + 5 références externes | PASS |
| contractVersion par ressource | Resource Contract Registry | PASS |
| policyVersions par ressource | comparaison ReadModel/PublicationMeta | PASS |
| factsHash commun | test de propagation d'un fait Place Detail | PASS |
| préserver V1 | profil V1 délégué, contrats et reads V1 inchangés | PASS |
| ne pas servir V1 comme V2 | contrat + méthode + queryKey stricts | PASS |
| génération read-only | PRE-FLIGHT pur et stage en mémoire | PASS |
| aucune génération live | aucun client live, aucun RPC, aucun Finalize | PASS |

## Risques et étapes différées

- une future génération live devra résoudre et vérifier que les cinq références
  externes de l'exemple pointent vers des publications voisines compatibles
  avant son Finalize ; elles sont déjà explicites dans le manifest ;
- la ressource Spending Nature ne porte pas encore ses QueryTargetRef de segment
  dans son payload. Le profil applique donc une projection unique, stricte et
  canonique des clés d'axes. Cette logique ne doit pas être recopiée ailleurs ;
- aucune performance sur volume live n'est affirmée par cette fixture. Le lot
  certifie la fermeture, les contrats et le stage, pas un backfill Supabase ;
- l'activation live, la rétention et le nettoyage des anciennes révisions
  restent hors périmètre de ce lot.

## Gate final

SNAPSHOT_MATERIALIZATION_GATE = PASS
