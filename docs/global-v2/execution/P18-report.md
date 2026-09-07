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

## Tentative autorisée — STOP pré-DDL sur compatibilité Production

L'autorisation humaine reçue cible exactement :

- projet `ipuuhxrblxormwgoaqnz` ;
- fichier `supabase/migrations/20260906120000_global_v2_publication_infrastructure.sql` ;
- SHA-256 `B5C60AD3FB47EBC56DAC23E61E081B0502556674A2B8D59C90D687BE6F6BF085` ;
- Vercel Production `budgetisation`, READY, ref `main`, Git SHA `22ef278109f8c06ad01d99b51aed54d1a4e97964`, déploiement `dpl_fv3CRbjCb2YzvDmbwmmPDSwd62w6`.

Le projet et le digest ont été reconfirmés. Le remote GitHub confirme que `main` pointe sur ce SHA ; l'objet a été récupéré en lecture seule pour auditer le code réellement attesté. HC3/HC4 restent présentes et la migration Global reste absente.

Le contrôle de compatibilité a révélé un hard stop avant DDL : le commit Production contient encore les neuf ressources Global legacy `analysis_global_*`. Sur un miss, `execute-query.ts` calcule puis appelle `materialization.writeQuery()`. `SupabaseAnalyticsMaterializationStore.writeQuery()` tente alors un UPSERT actif avec :

- `period_kind = 'global'` ;
- `resource = 'analysis_global_*'` ;
- `generation_key = 'read_through'` ;
- `publication_id = NULL`.

La migration autorisée installe `guard_global_v2_frozen_content()`. Sa détection considère comme Global V2 toute ligne `period_kind='global'` dont `resource LIKE 'analysis_global_%'`. Elle exige ensuite une publication DRAFT et un manifeste. Le write-through legacy actuellement servi serait donc refusé par `Global V2 requires a publication; read-through writes are forbidden`. L'appelant masque volontairement l'échec de cache, ce qui évite probablement un échec de réponse Query, mais supprime la persistance du cache legacy et modifie le comportement opérationnel actuel.

Cette collision de namespace est une incompatibilité de transition explicitement interdite par P18. Elle ne peut pas être ignorée en comptant sur P19. Le SQL n'a pas été modifié pour contourner le digest autorisé et aucun correctif opportuniste n'a été appliqué.

Résultat transactionnel : `NOT_STARTED`. L'outil de migration n'a pas été invoqué. Historique après : inchangé, aucune version Global enregistrée. Baseline live inchangée par cette tentative ; seules des lectures SELECT ont été exécutées.

Pour reprendre P18, il faut une opération distincte et reviewable qui ferme la collision avant DDL, par exemple un déploiement Production compatible qui n'émet plus ces écritures legacy ou une nouvelle migration dont le prédicat distingue explicitement V2 du legacy. Un SQL différent exige un nouveau digest et une nouvelle autorisation nominative. Ce rapport ne choisit pas entre ces options.

CURRENT_PROMPT = P18

P18_PREFLIGHT = FAIL_DEPLOYMENT_COMPATIBILITY

GLOBAL_SCHEMA_LIVE_GATE = BLOCKED

GLOBAL_PUBLICATION = NOT_STARTED

LIVE_WRITES = NONE

GLOBAL_GENERATION_COUNT = 0

P19_AUTHORIZATION = NOT_GRANTED

HUMAN_AUTHORIZATION_REQUIRED = YES

NEXT_PERMITTED_PROMPT = P18

## Suite locale P18T — collision corrigée, déploiement requis

Une mission P18T séparée a corrigé localement le producteur d'écriture incompatible, sans changer cette migration ni son digest. Les ressources dont le contrat est `legacy_v1`, exclusivement Global dans le registre et sans `publicationId` restent calculées et validées mais ne sont plus persistées en read-through. Les writes mensuels, History et explicitement publiés restent actifs.

Le correctif est certifié localement dans `P18T-report.md`. Il ne rend pas encore le déploiement Production compatible : le SHA actuellement servi reste `22ef278109f8c06ad01d99b51aed54d1a4e97964`. P18 ne peut reprendre qu'après autorisation, push fast-forward, déploiement de compatibilité et attestation du nouveau SHA Production.

`P18T_CODE_COMPATIBILITY_FIX=PASS_LOCAL`; `P18T_DEPLOYMENT_COMPATIBILITY=PENDING_DEPLOYMENT`; `GLOBAL_SCHEMA_LIVE_GATE=BLOCKED_PENDING_P18T_DEPLOYMENT`; `LIVE_WRITES=NONE`; P18/P19 interdits.

## Fermeture live P18 — migration Global V2 appliquée

L'utilisateur a attesté extérieurement la fin du déploiement automatique du merge `2ed2cc0dadaef64a6e788cf881b6b40311a9cc2b`, après son push fast-forward sur `origin/main`. Aucun accès Vercel n'a été effectué par cette mission. Le préflight Supabase a ensuite été repris uniquement sur le projet autorisé `ipuuhxrblxormwgoaqnz`.

### Preflight final

- HC3 `20260904110151 history_v2_dependency_manifest` et HC4 `20260904110402 history_v2_frozen_publications` : présentes ;
- migration Global : absente ;
- `global_manifest` : absent ;
- huit fonctions Global : absentes ;
- quatre triggers Global : absents ;
- handshake History : `history-frozen-month@v1` ;
- révisions : `dataRevision=1`, `analyticsRevision=79` ;
- History V2 actif : `947` snapshots, `15` familles et `24` artifacts partagés ;
- doublons actifs query/artifact : `0/0` ;
- invalidations actives query/artifact : `0/0` ;
- publications/snapshots/artifacts Global : `0/0/0` ;
- RLS active sur les trois tables, aucun grant anon, aucun DML navigateur inattendu et aucun droit `TRIGGER`/`TRUNCATE` de `service_role`.

Le blob Git de `supabase/migrations/20260906120000_global_v2_publication_infrastructure.sql` a été relu depuis `HEAD` et son SHA-256 confirmé à `B5C60AD3FB47EBC56DAC23E61E081B0502556674A2B8D59C90D687BE6F6BF085`. Les empreintes pré-DDL correspondaient à la baseline documentée : publications month `77c9a99d32bd6cc191802329d2172ec3`, artifacts month `3c158fef1c3543cf98b2c2e67e47665e`, snapshots month `e109cb8f5a62d44641e00be76bf0f512`, snapshots History `44a239081731246ed5b7615cd8a413e5`, Calendar Semantic `ac7168a53e2dc46a883c84b48461623d`, Daily Ledger `a59fa5aa5aa0a51de6d97d33d9ace796`.

### Application et certification post-DDL

Une seule migration a été appliquée : `global_v2_publication_infrastructure`, enregistrée live sous la version `20260907123714`. HC3/HC4 n'ont pas été rejouées. Aucun Begin, Stage, Attach, Seal, Finalize, rollback ou publication Global n'a été invoqué.

Après application :

- `analytics_publications.global_manifest` : `jsonb`, nullable, sans défaut ;
- huit fonctions Global présentes, avec `search_path=''` ;
- quatre triggers Global présents et activés ;
- handshake : `global-v2-publication@v1` ;
- cinq fonctions de service attendues exécutables par `service_role` ;
- aucune fonction Global exécutable par `anon` ou `authenticated` ;
- RLS et grants inchangés selon les contrôles ciblés ;
- `dataRevision=1`, `analyticsRevision=79` ;
- History V2 : `947` snapshots, `15` familles, `24` artifacts ;
- doublons actifs : `0/0` ; invalidations actives : `0/0` ;
- publications/snapshots/artifacts Global : `0/0/0`.

Les empreintes post-DDL sont identiques. Pour `analytics_publications`, la comparaison utilise uniquement `to_jsonb(p) - 'global_manifest'`, conformément au plan : publications month `77c9a99d32bd6cc191802329d2172ec3`, artifacts month `3c158fef1c3543cf98b2c2e67e47665e`, snapshots month `e109cb8f5a62d44641e00be76bf0f512`, snapshots History `44a239081731246ed5b7615cd8a413e5`, Calendar Semantic `ac7168a53e2dc46a883c84b48461623d`, Daily Ledger `a59fa5aa5aa0a51de6d97d33d9ace796`. Le DDL n'a donc modifié aucune donnée History préexistante.

`REMOTE_MAIN = 2ed2cc0dadaef64a6e788cf881b6b40311a9cc2b`

`P18T_MERGE_SHA = 2ed2cc0dadaef64a6e788cf881b6b40311a9cc2b`

`P18T_PUSH = PASS`

`P18T_DEPLOYMENT_COMPATIBILITY = PASS`

`P18_SQL_SHA = B5C60AD3FB47EBC56DAC23E61E081B0502556674A2B8D59C90D687BE6F6BF085`

`P18_MIGRATION_VERSION = 20260907123714`

`DATA_REVISION_BEFORE = 1`

`DATA_REVISION_AFTER = 1`

`ANALYTICS_REVISION_BEFORE = 79`

`ANALYTICS_REVISION_AFTER = 79`

`GLOBAL_GENERATION_COUNT = 0`

`P18T_CODE_COMPATIBILITY_FIX = PASS`

`GLOBAL_ROUTE_V2 = INACTIVE`

`GLOBAL_SCHEMA_LIVE_GATE = PASS`

`GLOBAL_PUBLICATION = NOT_STARTED`

`P19_AUTHORIZATION = NOT_GRANTED`

`LIVE_WRITES = DDL_ONLY_AUTHORIZED_P18_MIGRATION`

`NEXT_PERMITTED_PROMPT = P19_AWAITING_HUMAN_AUTHORIZATION`

P19 n'a pas été commencé.
