# Composer P2-D2 LEAN — chemin économique interne

**P2_D2_LEAN = STOP_NO_HIGH_VALUE_INTERNAL_BARRIER.** Le coût dominant est l'attente des lectures distantes, sur plusieurs vagues dépendantes. Aucun patch produit, query, SQL, cache, scheduling ou frontend modifié. Aucun gain après patch revendiqué.

HEAD_BEFORE et HEAD_AFTER_PRODUCT : `8d0b590fe2b4c186477c58e07d272cd1d2eeb535`, `main`, worktree initial propre. HEAD_AFTER documentaire : commit de ce rapport, résolvable par `git log -1 --format=%H -- docs/status/planner-composer-performance-p2d2-2026-10-07.md`. Aucun reset, push ou déploiement.

Diagnostic du 7 octobre **17:02:42–17:13:17 UTC, 10 min 35 s**, sous le plafond de 20–30 minutes. AGENTS, rapports P2-C2/P2-D et sections pertinentes P0/P1/P2-B relus. Seulement trois candidats inspectés ; pas de nouvelle cartographie de l'application.

## Méthode et trois accès directs

Copie production instrumentée P2-D réutilisée, variante `b` : son code produit `25358cb` est identique au HEAD courant (`git diff 25358cb HEAD -- src` vide). Aucun build de baseline supplémentaire. Harness navigateur existant, trois contextes Chromium frais, desktop 1728×900, même interaction native de recherche Library ; aucune preview ou Apply. Les probes déjà présents donnent START/DURATION/READY des méthodes et `queryRows`.

| Mesure avant, n=3 | Médiane | Plage |
|---|---:|---:|
| loadEconomicFacts | 12,602 s | 11,280–15,094 s |
| loadPurchaseAwareCanonical total | 14,662 s | 12,340–16,462 s |
| readWorld | 14,810 s | 12,468–16,634 s |
| Tail Purchase-aware après EconomicFacts | 1,367 s | 1,060–2,060 s |
| Après dernière query économique → facts prêts | 0,316 s | 0,313–0,337 s |
| Après dernière query Purchase-aware → résultat prêt | 0,026 s | 0,023–0,026 s |
| RSC complete | 15,817 s | 13,526–19,205 s |
| Board visible | 16,061 s | 13,814–19,512 s |
| TTI direct | 16,576 s | 14,361–20,200 s |

Ces trois mesures confirment l'ordre de grandeur P2-D, sans constituer une comparaison A/B ni un SLA. **Après : non mesuré, aucun patch** ; pas de campagne Centre→Composer après ni de cinq replays supplémentaires, conformément à la stop rule.

## Mini-timeline loadEconomicFacts

Run direct 3, celui dont la durée EconomicFacts est médiane. Offsets et durées en **ms**, origine = entrée de `loadEconomicFacts`. Les branches parallèles ne s'additionnent pas. Les lignes d'hydratation incluent attente SDK et fusion des batches, pas uniquement du CPU.

| Sous-branche réelle | START | DURATION | READY | Classe dominante |
|---|---:|---:|---:|---|
| IDs Operations par dates bancaires | 0,005 | 1 037,833 | 1 037,838 | NETWORK / DB WAIT |
| IDs Operations par timing historique | 0,011 | 888,676 | 888,686 | NETWORK / DB WAIT |
| Timing par plage | 0,016 | 523,679 | 523,694 | NETWORK / DB WAIT |
| Coûts canonical par IDs Operations | 1 039,033 | 2 677,007 | 3 716,040 | NETWORK / DB WAIT ; inputs requis |
| Coûts canonical par keys timing | 1 039,750 | 0,223 | 1 039,973 | Ensemble vide ; aucun GET |
| Hydratation Operations | 3 717,648 | 6 656,667 | 10 374,315 | NETWORK / DB WAIT |
| Operation place | 3 717,766 | 7 086,365 | 10 804,132 | NETWORK / DB WAIT |
| Timing par keys | 3 718,127 | 8 568,573 | 12 286,700 | NETWORK / DB WAIT |
| Timing control | 3 718,647 | 8 566,244 | 12 284,892 | NETWORK / DB WAIT |
| Reconciliation control | 3 718,979 | 8 563,493 | 12 282,472 | NETWORK / DB WAIT |
| Allocations | 3 719,279 | 6 013,881 | 9 733,160 | NETWORK / DB WAIT |
| Items | 3 719,733 | 6 756,349 | 10 476,082 | NETWORK / DB WAIT |
| Payment components | 3 720,125 | 6 540,996 | 10 261,121 | NETWORK / DB WAIT |
| Cash uses | 3 720,515 | 6 251,476 | 9 971,991 | NETWORK / DB WAIT |
| Person links | 3 720,926 | 5 399,302 | 9 120,227 | NETWORK / DB WAIT |
| Projection/normalisation finale après dernière query | 12 285,366 | 316,416 | 12 601,782 | CPU / PROJECTION et finalisation |

Le chemin du run médian se décompose en **1,039 s de découverte**, **2,678 s de lecture/merge des coûts**, **8,568 s d'hydratation parallèle** et **0,316 s de projection finale**. Les dix familles d'hydratation démarrent en moins de 4 ms d'écart. Les lectures suivantes d'une famille démarrent à la libération d'un worker : limite existante de trois batches simultanés, non changée.

Au moins une `queryRows` économique est en cours pendant **12,280 s sur 12,602 s**, soit 97,44 % du run médian ; plage des trois runs 97,18–97,62 %. C'est une union d'intervalles, pas une somme de requêtes parallèles ni un pourcentage de CPU inactif. Les derniers batches critiques Timing/control/Reconciliation prennent respectivement environ **3,584 / 3,609 / 2,664 s** ; leurs headers arrivent seulement quelques ms avant la résolution SDK.

**Limite d'attribution : NETWORK / DB WAIT combine transport, attente serveur/DB, décodage et scheduling Node. Le temps SQL pur et le CPU chevauchant des I/O restent UNKNOWN.** Les traces HTTP n'autorisent pas à déclarer une vue SQL seule responsable des 12 s. La projection synchrone après I/O reste sous 0,34 s : le critère « plusieurs secondes CPU après I/O » n'est pas atteint ; aucun profil V8 ou campagne heap/GC ajouté. Aucun hashing lourd identifié dans cet owner ; les hashes d'audit sont extérieurs au coût produit.

## Trois candidats et décision

1. **Join de découverte avant les coûts.** Les coûts par Operations exigent l'union complète des deux listes d'IDs. La branche par keys timing pourrait techniquement commencer plus tôt, mais elle est vide dans les trois runs et prend 0,22–0,49 ms sans GET. La déplacer n'enlève rien au chemin critique. Aucun remplacement des IDs ou streaming des batches.
2. **Projection retardée ou répétée.** Après hydratation, mapping, validation et dedupe ne prennent que 0,313–0,337 s. Purchase-aware reprojette un jeu d'opérations ciblé, avec sa propre admission et ses contrôles ; ce n'est pas le même appel ni un résultat substituable par les facts déjà filtrés par plage. Les partages déjà examinés dans P2-C restent hors scope. Aucun travail CPU ≥1 s à retirer démontré.
3. **Tail Purchase-aware.** La première lecture pilote démarre 0,01–0,02 ms après les facts legacy. Schéma → events → memberships/timing/native → classifications et coûts d'opérations → hydratation/projection sont les étapes réelles. Les IDs des étapes suivantes viennent de la précédente ; chaque groupe indépendant est déjà parallèle. **23 GET** supplémentaires ; union des queries 1,337 s médiane, contre seulement 0,026 s de finalisation après la dernière query.

Les premières lectures pilote pourraient être préparées à partir du contexte plus tôt : le préfixe schema/events représente **0,277 s [0,213–0,326]**, inférieur à la cible. Déplacer tout le pipeline pourrait théoriquement masquer davantage du tail de 1,367 s, mais déplacerait 23 lectures et une seconde hydratation avant la réussite de la validation économique. Il faudrait séparer la préparation/admission de l'owner et recertifier la priorité des erreurs : aujourd'hui une erreur EconomicFacts empêche toute lecture pilote, et DEFAULT ne lit aucun pilote. Le gain net ≥1 s sous contention et la conservation de ce déclenchement ne sont pas démontrés. **Candidat non retenu dans cette passe lean**, sans prétendre que toutes ces lectures dépendent des valeurs de `legacyFacts`.

**STOP sans patch.** Le hotspot reste la collecte distante des facts : coûts canonical, puis vagues d'hydratation Timing/control/Reconciliation/Operations et compositions. Recommandation **P2-E ciblé**, pour distinguer plans/temps SQL réels et transport/concurrence sur ces lectures avant toute optimisation SQL. P2-E n'est pas commencé ici.

## Invariants, concurrence et vérification

MAX_RELEVANT_IN_FLIGHT_READS, du lancement fetch aux headers : **EconomicFacts 33/33/33** ; tail Purchase-aware **10/14/10** ; Composer entier **45/43/46**. Aucun « après » inventé, aucune hausse de limite. IN=120 économique, IN=100 autres lectures, concurrence=3 par famille et pagination=1 000 préservés.

**291 GET dans chacun des trois runs**, comme P2-D. Empreinte du multiset complet de queries égale à P2-D après normalisation du seul cutoff frais de `person_habit_assertions.validated_at` : `b441d3fe0bc2d9ff343eeefddf9792a267c0583839b3ccb643edc704d8e0885a`. DTO UI **273 000 octets**, full digest inchangé `b51c6c528e97eb4b5d155c9a5dc0bc4351a4e11929c276c9b2d1d8c207cfaadb` sur les trois runs.

Les probes Next n'observent pas les bodies SDK : rows/octets réseau réels de cette campagne sont **UNKNOWN**, pas zéro. ROWS_UNCHANGED et scope/payload réseau inchangés sont garantis par l'absence de diff produit/query ; ils ne représentent pas de nouveaux compteurs de bodies. Référence P2-D replay existante : 313 GET headless, 38 377 lignes et 13 303 172 octets, doublons inclus ; pas un nouveau replay P2-D2. Les agrégats HTTP sont sans données bancaires personnelles.

Trois HTTP 200, aucune exception navigateur, fetch métier en erreur, requête bloquée ou drain expiré. Aucun POST local, RPC ou écriture distante métier. Auth utilisé seulement pour ouvrir la session readonly. Next, Chrome et Auth propres à l'audit arrêtés. Traces, prédicats et helpers privés conservés hors Git dans le workspace de chat, `outputs/planner-performance-p2d2` et `work/p2d2-*`.

PASS : EconomicFacts/History V2 canonical contracts ; Purchase-aware **61/61** ; Planner goldens **22×9 hashes**, incluant knowledge/UNKNOWN, identities/sourceRefs et fullBusiness ; guard P2-D **15 cas** ; lifecycle P2-B.6 **27/27** ; canonical batching ; architecture **882 fichiers** ; `tsc --noEmit`. Nouveau guard/failure suite propre à un déplacement : non applicable, aucun déplacement. P2-B.6 et P2-D restent intacts. **Un seul Next 16.2.6 production build final PASS**, dans le checkout produit : compilation 20,3 s, TypeScript 42 s, huit pages statiques et finalisation, exit 0.

```ini
ECONOMIC_FACTS_INTERNAL_PATH_AUDITED = PASS
HIGH_VALUE_INTERNAL_BARRIER = NOT_FOUND
P2_D2_HIGH_VALUE_ORCHESTRATION_NOT_FOUND = YES
ECONOMIC_FACT_SET_UNCHANGED = YES
QUERY_SCOPE_UNCHANGED = YES
GET_COUNT_EFFECTIVELY_UNCHANGED = YES
ROWS_UNCHANGED = YES
PAYLOAD_EFFECTIVELY_UNCHANGED = YES
FAILURE_SEMANTICS_PRESERVED = YES
NO_UNBOUNDED_DB_CONCURRENCY = YES
TOUCHED_OWNER_PARITY = NOT_APPLICABLE_NO_PATCH
PLANNER_GOLDEN_PARITY = PASS
FIVE_REPLAYS = NOT_RUN_NO_PATCH
P2_B6_PRESERVED = YES
P2_D_PRESERVED = YES
REMOTE_BUSINESS_WRITES = 0
MIGRATION_REQUIRED = NO
P2_E_NOT_STARTED = YES
SNAPSHOT_NOT_STARTED = YES
FRONTEND_REFACTOR_NOT_STARTED = YES
R6_NOT_STARTED = YES
P2_D2_LEAN = STOP_NO_HIGH_VALUE_INTERNAL_BARRIER
```
