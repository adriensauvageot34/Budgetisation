# P18 — preflight du cutover de schéma Global

## Baseline et autorisation

Inspection du 2026-09-07. Branche main, HEAD d'entrée `3230f8de411d972193a799081b4d688dfdffba16`, working tree propre. C01–C14, AGENTS, P13, P17 et son plan P18/P19 lus. Les PASS locaux P17 sont des prérequis acquis, pas une preuve live.

Le prompt P18 exige une autorisation humaine désignant projet, fichier et digest. Cette autorisation particulière n'a pas encore été fournie. Toutes les opérations de cette reprise sont des lectures ; aucun DDL, Begin, stage, attach, finalize, rollback ou écriture Canonical.

## Opération exacte proposée

- Projet vérifié par le connecteur : `ipuuhxrblxormwgoaqnz`, Budgetisation, ACTIVE_HEALTHY, eu-central-1, PostgreSQL 17.6.1.155.
- Fichier unique : `supabase/migrations/20260906120000_global_v2_publication_infrastructure.sql`.
- SHA-256 des octets locaux : `B5C60AD3FB47EBC56DAC23E61E081B0502556674A2B8D59C90D687BE6F6BF085`.
- Diff contre le checkpoint P17 : vide. Aucun changement SQL dans P18.
- Ordre : HC3 `20260904110151`, HC4 `20260904110402` déjà appliquées ; puis seulement la migration Global. Ne pas rejouer HC3/HC4.
- Transaction explicite BEGIN/COMMIT dans le fichier. Aucun UPDATE de données hors des corps de fonctions, qui ne sont pas invoquées par le DDL.
- Après autorisation, utiliser le mécanisme de migration enregistré, relire son numéro effectivement attribué et documenter toute différence avec le nom local avant un futur outil de déploiement. Aucune réparation arbitraire de l'historique.

## Historique live avant

| Version | Nom |
| --- | --- |
| 20260824231804 | set_deplacement_pro_multi_day |
| 20260825002850 | complete_historical_analysis_periods |
| 20260825105100 | analytics_materialization |
| 20260829231059 | purchase_event_identity |
| 20260829231101 | economic_component_classifications |
| 20260829231103 | life_event_continuity_assertions |
| 20260831094236 | history_v2_publication_rollback |
| 20260902105811 | enforce_single_active_analytics_generation |
| 20260904110151 | history_v2_dependency_manifest |
| 20260904110402 | history_v2_frozen_publications |

Migration Global absente. `global_manifest`, les huit fonctions Global et leurs quatre triggers sont absents ; aucun conflit de nom observé. `dependency_manifest`, `history_manifest_canonical_json` et les quatre guards History activés sont présents. Handshake exécuté en lecture seule : `history-frozen-month@v1`.

Historique après : NOT_RUN, aucune migration appliquée pendant P18.

## Objets SQL et compatibilité

Ajout unique de colonne : `analytics_publications.global_manifest jsonb`, nullable, sans default. Les anciennes lignes gardent NULL ; aucune preuve rétrofabriquée. Aucun ajout de table, FK, index ou policy.

Huit fonctions : `is_global_v2_publication`, `guard_global_v2_manifest`, `guard_global_v2_frozen_publication`, `guard_global_v2_frozen_content`, `attach_global_v2_manifest`, `publish_global_v2_materialization`, `restore_global_v2_publication`, `global_v2_publication_contract`.

Quatre triggers : `global_v2_manifest_guard`, `global_v2_frozen_publication_guard`, `global_v2_frozen_artifact_guard`, `global_v2_frozen_snapshot_guard`. Handshake attendu après application : `global-v2-publication@v1`.

Les contraintes existantes acceptent déjà period/scope `global`, `as_of_month`, les FK Household/publication et les identités versionnées. Les guards Global reconnaissent le scope global et les familles dédiées ; les lignes mensuelles observées restent hors de ce profil. Aucune génération ni aucun contenu global n'existe dans la baseline lue. Les signatures des fonctions existantes ne sont pas remplacées. Les stores P13/P17 attendent précisément `global_manifest`.

Compatibilité du code local : la route `src/app/analyse-globale/page.tsx` conserve `GlobalV2ActivationPending` en production. L'activation ne dépend donc pas de l'arrivée immédiate de P19. Le DDL est additif pour les lectures existantes. Risque opérationnel : verrou DDL bref sur analytics_publications et installation des triggers ; différer en cas de transaction concurrente longue et relire l'historique après toute interruption.

**Compatibilité du déploiement réellement en Production : PENDING_DEPLOYMENT_ATTESTATION.** Aucun connecteur Vercel disponible dans cette session ne permet d'attester son SHA/configuration. La référence Git locale origin/main n'est pas une preuve de déploiement. Ne pas appliquer avant d'avoir identifié le code effectivement servi et confirmé l'absence de workflow incompatible pendant la transition. Ce point doit être levé avant exécution, même après autorisation du fichier.

## Sécurité observée et attendue

Les trois tables ont RLS activée. `authenticated` possède SELECT sur artifacts/snapshots, limité par les policies Household utilisant `private.user_has_household_access(household_id)`. Aucun DML navigateur observé ; aucun grant anon observé. analytics_publications n'a pas de grant navigateur. service_role possède SELECT/INSERT/UPDATE/DELETE/REFERENCES, sans TRIGGER/TRUNCATE.

Les PK, FK Household et publication, contraintes de période/scope/révisions et index de lookup/version sont présents. Ils sont préservés par la migration. Les fonctions nouvelles fixent search_path vide. EXECUTE est révoqué de PUBLIC/anon/authenticated ; seules les cinq fonctions publiques de service prévues sont accordées à service_role. Les fonctions trigger ne constituent pas des RPC navigateur.

Post-DDL : relire RLS, policies, grants, contraintes/index, fonctions et guards ; vérifier le handshake, les droits serveur et l'absence de nouvel accès navigateur. Ces contrôles post-DDL sont NOT_RUN et ne sont pas présentés comme PASS.

## Baseline de données read-only

| Univers | Résultat |
| --- | --- |
| dataRevision / analyticsRevision | 1 / 79 |
| History V2 actif | 12 publications, 947 snapshots, 15 familles |
| Fenêtre History V2 | 2025-08 à 2026-07 |
| History V1 actif distinct | 12 publications, 389 snapshots, 3 familles |
| Calendar Semantic / Daily Ledger actifs | 12 / 12 |
| Publications toutes familles | 76 published, 3 failed, aucun draft ; toutes month |
| Snapshots toutes familles | 6 539 total, 2 484 actifs |
| Artifacts toutes familles | 7 176 total, 4 889 actifs |
| Doublons de query_key / artifact_key actifs par Household | 0 / 0 |
| Invalidations actives snapshots / artifacts | 0 / 0 |
| Publications / snapshots / artifacts Global | 0 / 0 / 0 |

Les comptes globaux ne sont pas assimilés aux comptes History V2. Les 1 336 snapshots History actifs correspondent à 947 V2 + 389 V1, pas à une dérive.

Empreintes avant DDL, calculées côté serveur par MD5 de string_agg du JSONB de chaque ligne trié par sa PK ; elles servent uniquement à la comparaison avant/après, pas à la sécurité des manifests :

- Toutes publications month : `77c9a99d32bd6cc191802329d2172ec3`.
- Tous artifacts month : `3c158fef1c3543cf98b2c2e67e47665e`.
- Tous snapshots month : `e109cb8f5a62d44641e00be76bf0f512`.
- Snapshots resource LIKE history% : `44a239081731246ed5b7615cd8a413e5`.
- Calendar Semantic : `ac7168a53e2dc46a883c84b48461623d`.
- Daily Ledger : `a59fa5aa5aa0a51de6d97d33d9ace796`.

Pour comparer les publications après ajout de colonne, calculer `to_jsonb(p) - 'global_manifest'` : le NULL ajouté ne constitue pas un changement des données préexistantes. Relire la baseline juste avant DDL ; ne pas réutiliser ces empreintes silencieusement après un changement concurrent.

## Contrôles et suite conditionnelle

Exécutés : get_project, list_migrations, SELECT ciblés de catalogs/contraintes/index/RLS/grants, handshake History, agrégats/counts/empreintes, digest local et diff SQL vide. Une première requête du handshake utilisait row_to_json sur un retour text ; elle a échoué sans écriture, puis a été corrigée par appel direct. Aucun gate lourd P17 rejoué : SQL/code inchangés.

Après autorisation nominative et attestation du déploiement : relire baseline/noms/historique/digest → appliquer uniquement le fichier → contrôler historique et schéma → comparer empreintes/révisions/comptes → attester le gate. En cas d'échec transactionnel, relire avant retry. Pas de DROP automatique de preuves ni de rollback de données ; toute réversion de schéma demande un plan ciblé. Aucun candidat Global n'est créé dans P18.

CURRENT_PROMPT = P18

P18_PREFLIGHT = PARTIAL_PENDING_AUTHORIZATION_AND_DEPLOYMENT_ATTESTATION

GLOBAL_SCHEMA_LIVE_GATE = BLOCKED

GLOBAL_PUBLICATION = NOT_STARTED

LIVE_WRITES = NONE

NEXT_PERMITTED_PROMPT = P18

HUMAN_AUTHORIZATION_REQUIRED = YES

P19 reste interdit jusqu'au PASS live de P18 et à son autorisation de publication distincte.
