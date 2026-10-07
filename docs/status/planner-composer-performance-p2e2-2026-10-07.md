# Composer P2-E2 LEAN — concurrence des lectures économiques

**P2_E2_LEAN = STOP_NO_HIGH_VALUE_TRANSPORT_TUNING. TRANSPORT_TUNING_JUSTIFIED = NO.** Le probe privé Timing control ne démontre qu'un gain médian de **68 ms** à concurrence 5, avec des headers unitaires plus lents et un pic augmenté. Aucun patch produit retenu. Prochaine étape : **CHECKPOINT PERFORMANCE**.

HEAD_BEFORE : `56c0ac5bc0cf4c6ff783015e9a24d8c4929865ed`, `main`, worktree initial propre. HEAD_AFTER_PRODUCT identique ; HEAD_AFTER documentaire résolvable par `git log -1 --format=%H -- docs/status/planner-composer-performance-p2e2-2026-10-07.md`. Aucun reset, push ou déploiement. Diagnostic **17:54:03–17:57:58 UTC, moins de quatre minutes**, décision sous la timebox de 20–30 minutes.

## Probe et résultat

AGENTS et preuves P2-E1/P2-D2 relus. Configuration produit : IN=120 économique, trois workers par famille ; IN=100 et pagination=1 000 ailleurs inchangés. Une famille représentative, `financial_economic_timing_control`, ses **13 batches historiques / 1 476 rows**, dernier lot de 36 IDs. Même capture, IDs normalisés, SELECT/casts, filters, order, projet, factory `createCanonicalReadClient()` et rôle serveur service_role. Le vrai helper `readCanonicalInBatches()` est chargé par le loader TS existant ; seul son export de concurrence est remplacé **en mémoire dans le process privé**, sans modifier un fichier source.

Trois runs par niveau, ordre préétabli **3,1,5 / 5,3,1 / 1,5,3**. Le premier run 3, plus lent, reste inclus : aucune suppression de cold start. Médiane [min–max] des trois runs ; headers = médiane des médianes de batch par run.

| Config | Famille | Headers batch | Family wall | Peak | SQL total nouveau | Erreurs |
|---|---|---:|---:|---:|---|---:|
| 1 | Timing control | 127 ms [116–134] | 1,653 s [1,549–1,879] | 1 | Non remesuré | 0 |
| **3 current** | Timing control | **165 ms [136–295]** | **0,715 s [0,663–1,728]** | **3** | Non remesuré | **0** |
| 5 meilleur candidat isolé | Timing control | 229 ms [188–239] | 0,647 s [0,584–1,149] | 5 | Non remesuré | 0 |

Le gain médian 3→5 est **0,068 s / 9,5 %**, loin du seuil recherché d'environ une seconde. Dans les deux rounds chauds : seulement **68 / 79 ms**, tandis que les headers augmentent. Concurrence 1 donne des headers plus rapides mais une famille plus lente ; cela ne démontre pas son comportement sous Composer. Le coût unitaire augmente avec davantage de workers : plus de concurrence ne garantit pas un meilleur chemin critique global. **STOP sans niveau 2/4, seconde famille ni campagne Composer** : le test isolé n'offre pas de candidat de grande valeur justifiant ces lectures supplémentaires. Aucun gain Composer extrapolé.

## Séparation des attentes

Tous les batches sont prêts au début du helper. `QUEUE_BEFORE_FETCH` mesure ce point jusqu'à l'invocation effective de `fetch` ; le probe distingue aussi l'attente du worker et le petit intervalle dispatch→fetch. Body compté au fil du stream, sans clone ; fin SDK mesurée après fin body. Médianes des médianes de run, ms :

| Config | A : queue avant fetch | Dispatch→fetch | B : fetch→headers | C : body | D : SDK après body |
|---|---:|---:|---:|---:|---:|
| 1 | 733 | 0,45 | 127 | 1,02 | 0,23 |
| 3 | 318 | 0,46 | 165 | 0,93 | 0,24 |
| 5 | 239 | 0,49 | 229 | 0,89 | 0,23 |

P95 headers indicatifs sur 39 batches par configuration : **172 / 810 / 851 ms** ; petit échantillon et cold starts inclus, aucun SLA ni conclusion robuste sur la queue de distribution. Une attente de worker est partagée par plusieurs batches : les queues ne s'additionnent pas au wall de la famille.

**Sous charge Composer, analyse offline de la trace P2-E1 existante**, aucune nouvelle navigation : queue depuis l'entrée de famille jusqu'au fetch, proxy incluant quelques ms de préparation, médianes **1,567 / 2,321 / 2,062 / 3,014 s** pour Timing / Timing control / Reconciliation / Operation place. Après dispatch `queryRows`, fetch invoqué en médiane **0,64–0,91 ms**. Mais les fetchs lancés attendent encore les headers, moyennes **2,247 / 2,471 / 1,816 / 2,473 s**. La queue applicative explique l'attente des lots suivants, **pas l'inflation du délai fetch→headers lui-même**. Diagnostic : mélange de vagues bornées et d'attente hors exécution SQL sous charge ; attribution précise transport/pool/PostgREST/scheduling **UNKNOWN**, compteurs de sockets/pending/reuse **UNKNOWN**. Aucun instrument Undici profond ajouté.

**E : SQL réel reste la preuve P2-E1**, sans nouveaux EXPLAIN : **0,408 / 0,658 / 0,509 / 0,671 s cumulées**, pour **14 / 14 / 13 / 14 appels** IN (historique + un batch Purchase-aware), versus Node historique **10,755 / 10,751 / 7,649 / 10,748 s**. Les scopes et unités différents ne s'additionnent pas. [Rapport P2-E1](planner-composer-performance-p2e1-2026-10-07.md). Aucun candidat final sous Composer ni patch : contrôle SQL avant/après P2-E2 **NOT_APPLICABLE_NO_PATCH**, aucune stabilité SQL nouvelle revendiquée.

## Certification et suite

**117/117 batches deep-equal à la capture** ; chaque run retourne 1 476 rows. **118 GET distants** : 117 ciblés + un guard Household READY/singleton égal au household capturé. Allowlist GET/projet/endpoints, timeout privé de 10 s, Auth refresh/persistence désactivés. HTTP errors/429/5xx/timeouts **0**, aucune RPC ou écriture métier. Query shapes, IDs, rows, taille des batches, windows, sources et provenance conservés. Les résultats privés contiennent les timings par batch ; traces et helpers restent hors Git dans le workspace de chat, `outputs/planner-performance-p2e2` et `work/p2e2-*`.

Produit inchangé : **GET Composer 291→291** par conservation du code et de ses queries, référence mesurée P2-E1 ; aucun nouveau run Composer A/B, RSC/Board/TTI ou pic global présenté comme mesuré. Pic référence EconomicFacts 33 / Composer 46. Aucun changement Centre/P2-B.6, Forecast/P2-D, frontend, DTO, SQL ou schéma. Diffs `src` et `supabase` vides ; syntaxe des deux helpers privés PASS. Sans patch, pas de tests de failure semantics supplémentaires, cinq replays, goldens, tsc ou build inutiles ; certification architecture P2-E1 (882 fichiers PASS) conserve le même code. Aucun serveur Next ou navigateur lancé pour P2-E2, process probe terminé.

**CHECKPOINT PERFORMANCE** recommandé. Concurrence 3 suffisamment proche du meilleur compromis observé sur cette famille isolée ; pas de prétention à prouver un optimum universel ni à résoudre précisément toutes les attentes de transport. Aucun snapshot/cache, scheduler global, pool custom ou chantier frontend commencé.

```ini
P2_E2_TRANSPORT_DIAGNOSTIC = PASS
SQL_OPTIMIZATION_REOPENED = NO
SQL_OPTIMIZATION_JUSTIFIED = NO
QUERY_SCOPE_UNCHANGED = YES
BATCH_SIZE_UNCHANGED = YES
FACT_SET_UNCHANGED = YES
ROWS_UNCHANGED = YES
TRANSPORT_TUNING_JUSTIFIED = NO
P2_E2_TRANSPORT_TUNING_JUSTIFIED = NO
PRODUCT_CODE_CHANGED = NO
NO_UNBOUNDED_CONCURRENCY = YES
SQL_TOTAL_NOT_MATERIALLY_REGRESSED = NOT_APPLICABLE_NO_PATCH
HTTP_ERROR_REGRESSION = NONE
TOUCHED_OWNER_PARITY = NOT_APPLICABLE_NO_PATCH
FIVE_REPLAYS = NOT_RUN_NO_PATCH
P2_B6_PRESERVED = YES
P2_D_PRESERVED = YES
REMOTE_BUSINESS_WRITES = 0
MIGRATION_REQUIRED = NO
SNAPSHOT_NOT_STARTED = YES
FRONTEND_REFACTOR_NOT_STARTED = YES
R6_NOT_STARTED = YES
P2_E2_LEAN = STOP_NO_HIGH_VALUE_TRANSPORT_TUNING
```
