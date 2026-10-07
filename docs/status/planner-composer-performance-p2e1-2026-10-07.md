# Composer P2-E1 LEAN — SQL et attente hors SQL

**P2_E1_LEAN = PASS ; SQL_OPTIMIZATION_JUSTIFIED = NO.** Les quatre lectures critiques n'ont pas révélé de SQL lent justifiant un index ou une réécriture. Le coût restant est principalement **l'attente hors exécution SQL, amplifiée par les lectures en batches et la concurrence du Composer**. Aucun patch produit, réglage permanent, SQL de mutation, migration ou index.

HEAD produit : `96b9fa9ba7844abc0b46a7bf0bfce764fcc8ab10`, `main`, worktree initial propre. HEAD après produit identique ; commit documentaire final résolvable par `git log -1 --format=%H -- docs/status/planner-composer-performance-p2e1-2026-10-07.md`. Aucun reset, push ou déploiement. Diagnostic **17:24:57–17:40:39 UTC, 15 min 42 s**, sous le plafond de 20–30 minutes.

## Périmètre et mesures

AGENTS, P2-C2, P2-D/P2-D2 et seules sections financières pertinentes P0/P1 relus. Quatre familles : Timing, Timing control, Reconciliation et Operation place. Les temps P2-D2 restent la référence navigateur, n=3 : EconomicFacts **12,602 s**, Purchase-aware **14,662 s**, readWorld **14,810 s**, RSC **15,817 s**, TTI **16,576 s** médianes. Aucune nouvelle cartographie des 291 GET.

Trois GET isolés par famille, mêmes 120 IDs réels du batch complet le plus lent du run médian P2-D2, mêmes colonnes/casts, prédicats et ordre. Factory serveur `createCanonicalReadClient()` existante, même configuration et rôle **service_role**, Auth auto-refresh/persistence désactivés. Guard : GET uniquement, projet identique, quatre endpoints autorisés ; singleton Household READY contrôlé et égal au household capturé. **12/12 deep-equal à la réponse capturée**, 120 lignes par batch. Une lecture préalable de scope, aucune RPC.

Deux plans exécutés exploitables par famille via l'outil Supabase déjà connecté, aucun nouveau accès admin bricolé : `BEGIN READ ONLY`, `statement_timeout=5s`, `lock_timeout=1s`, `SET LOCAL ROLE service_role`, `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT …`, `ROLLBACK`. Mode read-only et BYPASSRLS du rôle confirmés. Un premier EXPLAIN Timing a été exécuté mais écarté des statistiques à cause du parsing de l'enveloppe outil : **trois exécutions Timing au total, deux pour chacune des autres familles**. Aucun timeout SQL ; le premier essai de génération locale avait également arrêté le probe avant toute lecture distante.

Pour lever la limite « SQL isolé versus requête sous concurrence », **un seul accès Composer frais** avec le build instrumenté P2-D déjà disponible, dont le code produit est identique au HEAD courant. `pg_stat_statements` avant/après, sans reset, filtre service_role et quatre templates PostgREST IN exacts. Les deltas sont **14/14/13/14 appels**, exactement les GET correspondants du trace : 13/13/12/13 historiques plus un batch Purchase-aware par famille. Aucune autre forme IN ciblée n'a changé. Le SQL mesuré par ces compteurs inclut **ANY paramétré, cast, tri et agrégation JSON PostgREST**, au lieu d'inférer ce temps depuis les headers HTTP.

| Famille | Node total historique, run frais | SQL réel cumulé IN, même fenêtre | Batches hist. + Purchase | Rows comparables hist. + Purchase | Classe | Candidat |
|---|---:|---:|---:|---:|---|---|
| Timing | 10,755 s | 0,408 s ; moyenne 29,16 ms/appel | 13 + 1 | 1 476 + 54 | B | Transport/API/queue, batches |
| Timing control | 10,751 s | 0,658 s ; moyenne 47,00 ms/appel | 13 + 1 | 1 476 + 54 | B | Même piste |
| Reconciliation | 7,649 s | 0,509 s ; moyenne 39,12 ms/appel | 12 + 1 | 1 436 + 54 | B | Même piste |
| Operation place | 10,748 s | 0,671 s ; moyenne 47,96 ms/appel | 13 + 1 | 1 476 + 54 | B | Même piste |

**Unités/scopes :** Node mesure la durée inclusive de la famille historique ; SQL additionne les exécutions IN de cette famille **et de son batch Purchase-aware**. Ce total SQL est donc plus large que le sous-ensemble historique, et ne constitue pas une contribution wall-clock additive. Les branches parallèles ne se somment pas. Les rows historiques/54 Purchase viennent des réponses de capture correspondant aux mêmes empreintes ; Next ne donne pas ici de nouveau compteur de bodies. Les batches isolés ont bien retourné 120 lignes, mesurées à nouveau. `pg_stat_statements.rows` augmente seulement de 14/13 : chaque SELECT PostgREST retourne une enveloppe JSON SQL, pas une ligne SQL par fact.

**Classe B** : temps pré-headers hors exécution SQL nettement majoritaire, avec amplification de type **C** par batching/concurrence. Les headers des batches historiques prennent en moyenne **2,247 / 2,471 / 1,816 / 2,473 s** dans ce run. Pic observé **3 par famille**, EconomicFacts **33**, Composer **46** ; aucune limite modifiée. IN=120 sur ces quatre formes, respectivement 1 476 keys / 1 436 IDs : dernier lot 36 / 116. Les autres IN=100 et pagination=1 000 restent intacts. Ces quatre hydratations n'ont aucune pagination/range explicite ; le LIMIT/OFFSET de l'enveloppe PostgREST n'a pas été changé.

## Batches isolés et plans

Médiane [min–max], ms ; Node n=3 et SQL n=2, lectures séparées. `NON_SQL_OVERHEAD ≈ Node − SQL execution` est un **ordre de grandeur non synchronisé**, pas une attribution causale parfaite. La colonne planning est séparée.

| Famille | Node SDK isolé | Headers isolés | SQL execution | SQL planning | Node − SQL estimé | Body bytes mesurés |
|---|---:|---:|---:|---:|---:|---:|
| Timing | 228,42 [223,04–633,59] | 224,79 [219,89–629,32] | 14,57 [12,29–16,86] | 20,68 [18,04–23,32] | ≈213,85 ms | 38 262 |
| Timing control | 218,82 [170,24–275,53] | 216,57 [167,83–272,43] | 12,29 [12,04–12,53] | 10,58 [10,47–10,70] | ≈206,54 ms | 35 482 |
| Reconciliation | 188,81 [146,11–195,01] | 186,23 [144,44–192,62] | 11,98 [11,74–12,21] | 10,52 [10,49–10,56] | ≈176,83 ms | 17 696 |
| Operation place | 183,72 [162,84–227,66] | 181,39 [161,10–224,82] | 14,17 [13,21–15,13] | 10,30 [10,07–10,53] | ≈169,55 ms | 22 102 |

Le premier GET Timing lent reste inclus. Body après headers : **0,98–2,39 ms**, décodage/finalisation SDK après body : **0,16–0,34 ms**. Le probe compte les chunks au fil de l'eau, sans deuxième lecture/clone de body ; instrumentation présente seulement dans le helper privé. La différence planning+execution versus Node isolé reste environ **159–196 ms** selon famille ; le décodage n'explique pas des secondes.

| Plan représentatif | Nœuds | Estimated → actual à la racine | Observations |
|---|---:|---:|---|
| Timing | 117 | 375 → 120 | Union des coûts et segments, WindowAgg/Sort ; segments vides dans ce batch, branche unknown active ; filtre réduit 1 484 composants à 120. |
| Timing control | 75 | 736 → 120 | WindowAgg, Hash Join/Aggregate et contrôle de segments ; même construction de coûts avant filtre. |
| Reconciliation | 71 | 120 → 120 | Bitmap PK Operations pour les IDs ; agrégation économique 1 444 opérations, hash/jointures des contrôles. |
| Operation place | 75 | 736 → 120 | CTE de composants, candidats de lieux et agrégations ; 136 liens de lieu, 1 484 composants construits puis filtre à 120. |

Indexes effectivement utilisés : **pk_operations**, **uq_categories_nom_canonique**, tous deux valid/ready confirmés. Scans Operations de **1 660 lignes** et petites tables de compositions ; aucun Seq Scan massif pathologique démontré. Les deux plans de chaque famille n'ont **aucun shared read ni temp write** : root shared hits **1 085 / 1 081 / 1 172 / 1 091**. Sorts quicksort, maximum observé **148 kB**, aucun spill. Les erreurs d'estimation et le filtrage tardif existent, mais coûtent ici des millisecondes : ils ne justifient pas une migration ou un index spéculatif. Les temps des nœuds/CTE sont inclusifs, jamais additionnés pour créer un faux coût dominant.

## Formes et callsites préservés

Owner commun : `src/server/canonical/repository.ts`, `projectEconomicComponentRows()`. Timing passe par `loadTimingRowsByKeys()` ; les trois autres lectures appellent `readRowsByInBatches()` directement, parfois représenté par le span `cached`. Tous les SELECT et prédicats réels sont conservés dans l'inventaire privé, IDs exclus de Git.

```text
financial_economic_timing_canonical
SELECT household_id,canonical_component_key,economic_segment_id,timing_state,period_start,period_end,economic_month,economic_amount::text,attribution_method,method_version
WHERE household_id = <household autorisé> AND canonical_component_key IN (<120 keys réelles>)
ORDER BY canonical_component_key ASC,economic_segment_id ASC

financial_economic_timing_control
SELECT canonical_component_key,canonical_economic_net::text,segment_count,known_count,partial_count,unknown_count,household_count,household_mismatch_count,segment_amount_sum::text,amount_delta::text,status
WHERE canonical_component_key IN (<120 keys réelles>) ORDER BY canonical_component_key ASC

financial_canonical_reconciliation_control
SELECT operation_id,economic_gross_delta::text,economic_refund_resolution,economic_status
WHERE operation_id IN (<120 UUID réels>) ORDER BY operation_id ASC

operation_place_canonical
SELECT canonical_component_key,operation_id,place_id,resolution_state
WHERE canonical_component_key IN (<120 keys réelles>) ORDER BY canonical_component_key ASC
```

## Limites, vérification et suite

La séparation **Node versus execution SQL** est mesurée, y compris l'enveloppe PostgREST dans le run frais. Les deltas de compteurs correspondent exactement aux nombres d'appels observés, mais restent des statistiques partagées : pas de trace DB attribuée à chaque request_id ni preuve d'absence absolue d'une requête externe identique dans la fenêtre. Le partage entre réseau, pool, attente PostgREST, connexions HTTP et scheduling Node reste **UNKNOWN**. `pg_stat_statements.track_planning=off` : son delta planning=0 ne signifie **pas** planning gratuit ; les EXPLAIN isolés mesurent ce poste, sans prétendre reproduire le prepared plan exact de l'API. Aucune extrapolation vers tous les autres owners ou un SLA.

Run frais utilisé uniquement pour cette association SQL/HTTP : EconomicFacts **16,296 s**, Purchase-aware **18,033 s**, readWorld **18,245 s**, TTI **21,268 s**. Même code, n=1 : aucune régression ou amélioration causale revendiquée. **291 GET**, DTO **273 000 octets**, hash complet inchangé `b51c6c528e97eb4b5d155c9a5dc0bc4351a4e11929c276c9b2d1d8c207cfaadb`. HTTP 200, zéro erreur métier/navigateur, POST local, appel bloqué, drain expiré ou écriture métier distante. Processus Next/Auth/Chrome propres à l'audit arrêtés.

Probes readonly vérifiés : allowlist GET/projet/endpoints, timeout, guard Household, factory serveur existante, transactions SQL READ ONLY/ROLLBACK ; aucun nouveau credential ou réglage de rôle permanent. Syntaxe des deux helpers JS privés PASS ; architecture **882 fichiers PASS**. Aucun helper TS ni diff produit : pas de nouveau tsc/build/replay/goldens ; build P2-D disponible réutilisé. Traces, plans bruts, IDs et helpers restent hors Git dans le workspace de chat, `outputs/planner-performance-p2e1` et `work/p2e1-*`. Les [docs Supabase sur la mesure des plans](https://supabase.com/docs/guides/database/postgres/row-level-security-performance) ont été consultées ; aucun `db_plan_enabled`, changement RLS, DDL, ANALYZE global ou reset de statistiques.

**P2-E2 SQL : NOT_JUSTIFIED.** Prochaine étape recommandée : **P2-E2 transport/batching**, diagnostic distinct de l'attente pré-headers sous charge réelle, des queues/pools et des workers, avant de modifier une limite. Comparaison contrôlée sans changer facts/scopes ; mesurer les templates SQL et le pic global pour éviter de déplacer le coût vers la DB. Un checkpoint performance reste une alternative. Aucun P2-E2, snapshot ou frontend commencé dans P2-E1.

```ini
P2_E1_DIAGNOSTIC = PASS
CRITICAL_QUERY_FAMILIES_AUDITED = YES
SQL_TIME_MEASURED = YES
NODE_VS_SQL_SEPARATED = PASS
SQL_OPTIMIZATION_JUSTIFIED = NO
P2_E_SQL_OPTIMIZATION_JUSTIFIED = NO
PRODUCT_CODE_CHANGED = NO
QUERY_SHAPE_CHANGED = NO
BATCHING_CHANGED = NO
CONCURRENCY_CHANGED = NO
REMOTE_BUSINESS_WRITES = 0
MIGRATION_REQUIRED = NO
SNAPSHOT_NOT_STARTED = YES
FRONTEND_REFACTOR_NOT_STARTED = YES
R6_NOT_STARTED = YES
P2_E1_LEAN = PASS
```
