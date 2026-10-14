# P14-SNAP-2 — Publication durable et writers

14 octobre 2026. Verdict : **`SNAP2_DURABLE_LOCAL_READY_REMOTE_UNCERTIFIED`**.

Le même fragment Canonical SNAP-1 dispose d'un adaptateur RPC et d'un SQL candidat exécutés sur PostgreSQL **17.11 natif**, exclusivement synthétique. Publication atomique CAS, invalidation transactionnelle et contrôles actuels d'accès sont prouvés dans ce banc. **La couverture des writers distants et les JWT/RLS Supabase ne sont pas certifiés. Consommation applicative toujours OFF.**

## A — Git et périmètre

- Base propre vérifiée : `c87560db9557ab3e0965c7cf8b095f44ec798645`.
- Branche : `codex/composer-v3-p14-snap2-durable-publication`.
- Ascendance conservée : SNAP-1, P4D `6ae0b54`, P4B `6ad801a`, P4A `33fc974`, P3 `aed9946`, P2 `3705515`, P1 `a934f60`, consolidation Express/CSS/golden et P13 `7d7e883`.
- HEAD final : commit local introduisant ce rapport et les preuves ; SHA communiqué dans le compte rendu de livraison. Aucun push/PR/merge.
- `COMPOSER_P14_P3_HISTORICAL_REUSE=0` dans les bancs. `COMPOSER_P14_SNAP1_ACTIVITY_HISTORY=0` par défaut ; `authorizedPlanner()` ne fournit toujours aucun store. Les tests activent uniquement leur fixture.
- Aucune connexion Supabase, migration distante, publication Global/Forecast distante, activation, déploiement, Apply réel ou écriture financière.
- Aucun secret de conversation, historique ou fichier masqué recherché/utilisé. Connexions explicitement limitées au nouveau cluster synthétique `127.0.0.1:55434`, distinct de B0.
- Cluster synthétique arrêté proprement après les tests ; bases et fixtures conservées sous `outputs/p14-snap2/`, ignoré par Git. Aucune intervention sur le cluster B0.

Fichiers produit : `activity-history-store.ts` (adaptateur server-only non branché), `activity-history-artifact.ts` (attestation durable additionnelle). Aucun changement au Compiler, Finance V2, Baseline, Forecast, Apply, CAS Plan ou React.

Fichiers de réalisation : SQL candidat, banc natif SNAP-2, clients synthétiques, contrôle World, supplément hors période, extension optionnelle du banc SNAP-1 pour le même moteur natif, `.gitignore`, rapport et preuves. Pas de nouvelles dépendances.

## B — Infrastructure retenue

### Pourquoi ne pas publier dans analytics_artifacts

Le contrat existant est documenté dans `docs/specs/ANALYTICS_MATERIALIZATION.md` et `20260825105100_analytics_materialization.sql` :

| Infrastructure | Contrat existant | Compatibilité avec ce fragment |
|---|---|---|
| `analytics_artifacts` | Enveloppes ProducedMetric validées, identités de métriques/subjects/scopes | Le fragment occurrences + liens n'est pas une ProducedMetric enregistrée |
| `analytics_query_snapshots` | ReadModels Query validés | Ce fragment n'est pas une réponse Query |
| `analytics_publications` | Publication d'un ensemble de générations | Avance analyticsRevision et source_revision ; ne doit pas déclarer Global/Forecast republiés |
| `household_revisions` / `recordAnalyticsMutation` | Signal des mutations passant par le helper | Pas de preuve de couverture des SQL/imports/admin qui le contournent |

Les parsers et la projection Canonical, le prepare/read SNAP-1, les validators et la génération CAS sont réutilisés. Les tables de publication existantes restent intactes. **Pas de second moteur de publication universel, worker, cron ou queue.**

### SQL candidat, non migration distante

Fichier intégral : [P14_SNAP2_ACTIVITY_HISTORY_DO_NOT_APPLY.sql](../../supabase/candidates/P14_SNAP2_ACTIVITY_HISTORY_DO_NOT_APPLY.sql).

SHA-256 des octets testés : `3C1251A8FC391624DFBF8DDEE5CA9022ED0773AC492D6B467D42DB6149E76329`. Recalculer après tout changement d'octets/fin de ligne avant une approbation de migration.

Objets proposés :

- `private.planner_activity_history_state` : un compteur global dédié à cet owner, epoch, signature du writer, activation **false**.
- `private.planner_activity_history_artifacts` : clé de scope, auteur, foyer, génération CAS, JSON complet et date de publication. Deux index PK ; aucun index sur les tables sources.
- Sept triggers **par instruction**, ALWAYS, sur les quatre sources, households, persons et private.household_memberships. Un trigger de protection des changements de configuration.
- Deux RPC publiques : inspect pour `authenticated`, publish pour `service_role` uniquement ; six helpers privés sans EXECUTE client.
- Huit fonctions à `search_path=''`, propriétaire `postgres` attendu et vérifié. Seuls bump, scope, inspect et publish sont SECURITY DEFINER. Les autres sont INVOKER.
- RLS activée sur les deux tables privées, aucune policy directe ; aucun SELECT/DML direct accordé à anon/authenticated/service_role. Le reader n'est jamais autorisé par une simple génération ou par les privilèges du publisher.

Ces principes sont compatibles avec le modèle de fonctions et de RLS ; un definer exige une identité serveur fiable, un search_path contrôlé et des grants explicites. Sources : [Supabase Database Functions](https://supabase.com/docs/guides/database/functions), [PostgreSQL 17 RLS](https://www.postgresql.org/docs/17/ddl-rowsecurity.html).

La migration candidate est transactionnelle, `lock_timeout=5s`, et refuse un propriétaire d'exécution inattendu. Elle reste hors `supabase/migrations/` pour empêcher son application automatique. Les données sources ne sont pas réécrites. Les FK Auth/foyer sont actuellement restrictives : leur interaction avec les procédures réelles de suppression d'un auteur/foyer demande revue avant déploiement.

## C — Carte des writers et frontière de confiance

Inventaire ciblé du dépôt ; aucun nouvel audit distant.

| Writer / chemin | Table / changement | Invalidation proposée | Preuve et limite |
|---|---|---|---|
| Migration `20260824231804_set_deplacement_pro_multi_day.sql` | life_event_types, can_span_days | Trigger global dans la transaction | Writer SQL réel identifié dans le dépôt ; migration non rejouée à distance |
| DML brut, imports/COPY, RPC ou service/admin utilisant les quatre tables | INSERT/UPDATE/DELETE/TRUNCATE ; dates rétroactives, classification, participants, relations/montants | Même compteur dédié incrémenté par le trigger de chaque instruction | Classes de DML exécutées sur les quatre tables natifs ; inventaire des imports/jobs/RPC distants NOT_RUN |
| Appels applicatifs de saisie sur ces quatre tables | Aucun writer littéral trouvé dans les chemins server scannés ; beaucoup de lecteurs | Triggers ne dépendent pas du passage par un helper TS | Ne signifie pas absence de writer dynamique/externe |
| `scripts/lib/hc5-postgres.mjs`, bancs Canonical/SNAP | Fixtures locales life_events/types/participants/liens | Triggers du banc | Ne sont pas des writers Production |
| Foyers/timezone, personnes, appartenance privée | Modification du scope | Triggers sur households/persons/memberships + relecture des droits à chaque RPC | Natifs synthétiques PASS ; définition réelle du helper reste à revoir |
| Ban/suppression logique Auth | Accès utilisateur | auth.users actuel relu à chaque admission/publication | Ban de session locale existante refusé ; aucun JWT Supabase certifié |
| Plan/Draft, MonthInputs, Wallet, PlannedExpense, Forecast | Données vivantes hors fragment | Aucun trigger historique | Preview reste vivante et modèles/digests conservent la parité |
| DDL / nouveau contrat / méthode / remplacement du writer | Version du code/schéma | OFF, bump epoch/version, changement de méthode puis validation avant réactivation | Protocole administrateur obligatoire ; aucun event trigger privilégié |

Pour **chaque** source, INSERT/UPDATE/DELETE/TRUNCATE, rollback, DML sans helper, mode replica et changements rétroactifs sont couverts localement. Un compteur dédié unique représente conservativement les cinq dépendances du manifeste SNAP-1. Il n'est pas assimilé à une révision générique non couverte.

Les triggers statement couvrent les actions déclarées dans la transaction source. [PostgreSQL 17 CREATE TRIGGER](https://www.postgresql.org/docs/17/sql-createtrigger.html). Un rollback retire aussi l'invalidation. Une panne du singleton fait échouer le DML concerné plutôt que de permettre un faux signal de fraîcheur : vérifier ce risque opérationnel avant installation.

Admission vérifie les sept triggers, leur forme, l'absence de WHEN/arguments, leur activation ALWAYS et la définition du bump. Une désactivation détectée provoque MISS/couverture indisponible. **Un administrateur privilégié peut néanmoins désactiver, modifier puis réactiver sans suivre le protocole : ce cas peut réadmettre un artifact obsolète.** Aucune protection absolue n'est revendiquée ; tous les DDL doivent passer par OFF + invalidation. Signature/méthode/epoch changées avancent la version.

## D — Cycle durable implémenté

1. DML source et compteur commitent ensemble.
2. Une préparation explicite, hors READ, capture le scope et la preuve.
3. Repository frais, sélection Canonical et parsers d'origine ; counts exacts de préparation contrôlent la complétude de chaque réponse. Une page tronquée interdit READY.
4. Publisher trusted vérifie l'enveloppe et son digest **avant** le verrou partagé avec les writers.
5. Sous verrou : revalidation actuelle du scope, état/coverage, preuve source et génération CAS. Publication atomique ou rejet. `lock_timeout=2s` borne l'attente.
6. Inspect est une instruction RPC cliente : droits actuels, state/catalogue, génération et artifact dans le snapshot de la fonction STABLE ; sous-requêtes internes de contrôle, sans reconstruction de life_events.
7. TypeScript valide digest, provenance, scope, génération et facts via les parsers existants.

| État | Réponse |
|---|---|
| OFF ou aucun store | Lecteur d'origine, aucune dépendance au stockage |
| Absence, version nouvelle, coverage indisponible | MISS + lecteur direct ; **aucune publication/reconstruction supplémentaire implicite** |
| Artifact intègre, versions et scope exacts | HIT |
| Permission, réseau, SQL, corruption ou incompatibilité | Erreur explicite, pas de faux succès financier |
| Mutation pendant prepare / ancien publish | Rejet, génération précédente conservée |
| Commit puis réponse perdue | Relecture génération/digest avant toute décision ; aucun retry aveugle |

Deux backends publiant la même génération : exactement un commit. Un writer non commité laisse les lecteurs voir l'ancienne version cohérente ; après commit ils voient MISS. Un publish réellement bloqué derrière ce writer rejette sa preuve ancienne. La récupération après erreur injectée et après réponse perdue est exécutée. Les événements et liens UNKNOWN/nullable, parents, séries, participants et provenance sont conservés.

**Apply/CHECK_APPLY restent directs**, y compris avec le flag de fixture actif. Aucun writer Plan invoqué par le banc native World.

## E — Tests

[Preuves natives](evidence/p14-snap2/native-results.json), [journal natif](evidence/p14-snap2/native-tests.log), [SNAP-1](evidence/p14-snap2/snap1-tests.log), [régressions](evidence/p14-snap2/regressions.json).

| Contrôle natif final | Résultat |
|---|---|
| 01 OFF, activation locale, facts exacts HIT | PASS |
| 02 Quatre tables × INSERT/UPDATE/DELETE/TRUNCATE, commit et rollback | PASS ; suppression d'un type référencé provoque l'erreur Canonical stricte attendue |
| 03 Rétroactivité et session_replication_role=replica | PASS |
| 04 Mutation pendant préparation | PASS, aucun vieux READY |
| 05 Deux publishers concurrents + ancien publish | PASS, un seul accepté |
| 06 Sessions réellement superposées writer/read/publish | PASS, bloqueur observé avec pg_blocking_pids, pas une simple simulation séquentielle |
| 07 Échec SQL avant commit et réponse perdue après commit | PASS, génération conservée/récupérée sans duplication |
| 08 Deux processus et backends indépendants | PASS, mêmes facts/digest persistés |
| 09 Auth simulée PostgreSQL : auteur/foyer, grants, RLS, appartenance, ban | PASS_LOCAL_ONLY ; SELECT et INSERT/UPDATE/DELETE directs refusés, RLS deny aussi vérifiée avec SELECT temporairement accordé |
| 10 Personnes, autre foyer, timezone, période et méthode | PASS |
| 11 Corruption, digest forgé, payload null, page incomplète | PASS |
| 12 OFF, trigger absent, changement epoch, retour exact au direct | PASS avec protocole DDL déclaré |
| 13 Révisions/publications/artifacts Global existants du banc | PASS inchangés |
| 14 Coûts bornés, import de dix instructions | PASS, zéro reconstruction automatique |
| 15 SNAP-1/SNAP-2 sur même moteur natif | PASS, facts identiques |
| 16 Vrais World/Baseline/M7/Compiler/Finance avec owners non ciblés en fixture | PASS, quatre Drafts ; données mensuelles/Forecast/Planned/Draft vivantes ; Apply direct |
| 17 Propriétaires, search_path, EXECUTE, DML et RLS effectifs | PASS |

Les seize contrôles SNAP-1 sont rejoués sans modification de leurs assertions. Le pont natif ajouté au helper de test ne change pas le mode PGlite par défaut.

Régressions : **28 scripts PASS / 1 FAIL préexistant**, détails et commandes dans `regressions.json`.

- Golden **22 × 9**, P11/P12/P13, Kernel, Contexts, Baseline/World : PASS.
- P1 (réutilisation/ouverture), P2 (mutations/scheduler/préservation/autosave), prototype P3 en fixture : PASS. P3 applicatif reste OFF.
- Contrats P4A/R6 (P4.5, présentation, UI atomique, Composer), P4B et P4D : PASS. Aucun nouveau benchmark de gestes ou navigateur P4A revendiqué.
- P02 conservation, P09/P10, Mobility, M7 context (40/40), trip contexts (11), IN batching et matérialisation Analytics : PASS.
- `phase2-planner-interactions` : **FAIL R3-008**, `CONTEXT_REFERENCE_OWNER_UNAVAILABLE`, même erreur préexistante ; autres contrôles précédant R3-008 passent. Aucune correction, exclusion ou modification de golden pour masquer ce FAIL.
- `npm.cmd run typecheck` : PASS, exit **0**.
- `npm.cmd run build` : PASS complet, exit **0**, Next 16.2.6 ; compilation, TypeScript, collecte/génération et optimisation terminées. Dépendances locales réutilisées, pas installation fraîche ou CI.

JWT Supabase, politiques effectives distantes, hooks/writers/imports/jobs distants, PostgREST, navigateur FRESH et multi-appareils : **NOT_RUN**. Le mock auth.uid et SET ROLE sur le cluster natif ne sont pas une authentification Supabase. Aucun chiffre financier ni identifiant réel exporté.

Deux erreurs initiales du banc sont corrigées : IN text mal casté UUID et attente d'un MISS valide après suppression du type indispensable ; une requête de catalogue comptait aussi les index comme tables. Ce sont des défauts du banc, pas des corrections de doctrine financière. Le journal final porte sur le SQL candidat final ; aucune correction opportuniste des golden.

## F — Performance et coût économique

Node 22.18.0, PostgreSQL 17.11 natif sur Windows, loopback, 24 mois synthétiques / 288 événements / 576 participations / deux liens dont un montant UNKNOWN. P3 OFF. Séries alternées direct/HIT dans un même processus, `performance.now()`, P95 au rang supérieur. Pas de chronométrage de l'outil navigateur, de délai réseau simulé ou de profiler. La charge de l'OS n'est pas contrôlée ; phases et moteurs distincts ne sont pas mélangés.

| Série finale | n | P50 ms | P95 ms |
|---|---:|---:|---:|
| Fragment direct | 40 | 60,53 | 86,19 |
| Fragment HIT durable | 40 | 36,31 | 50,84 |
| Admission/RPC + transfert/désérialisation | 40 | 13,29 | 16,05 |
| Vérification digest + décodage propriétaire | 40 | 22,26 | 36,64 |
| Mutation source avec invalidation, loopback inclus | 20 | 1,76 | 2,82 |
| MISS + direct | 20 | 79,39 | 112,36 |
| Préparations complètes acceptées (plusieurs états du banc) | 42 | 422,86 | 522,57 |
| Publications retournant normalement (acceptées/rejetées, états variés) | 47 | 327,32 | 421,25 |
| READ World direct | 12 | 288,17 | 338,35 |
| READ World HIT | 12 | 263,71 | **675,46** |

- Fragment : **9 → 1 instructions clientes** ; READ intégré : **15 → 8**, les détails M7 restants continuent à être lus. Cela ne divise pas les 286 SELECT historiques de Composer. Les RPC exécutent des contrôles SQL internes ; ces nombres comptent les allers-retours clients, pas tous les sous-plans SQL.
- 196 372 → 133 437 octets JSON des réponses du fragment ; artifact seul 133 184 octets. Ce n'est ni la taille HTTP réelle ni la compression PostgREST.
- Gain médian intégré : **24,47 ms**. P95 plus mauvais dans la série finale (un pic HIT à 675 ms, n=12) : **aucune amélioration de queue ni objectif utilisateur certifié**. Ne pas sélectionner les séries antérieures plus favorables pour annoncer un PASS.
- Comparaison SNAP-1/SNAP-2, tous deux sur PG17 natif via le pont de test, n=40 paires : HIT 15,41/23,33 ms → 15,97/20,55 ms P50/P95. Surcoût médian de durabilité **0,56 ms dans cette phase**. Les timings historiques PGlite 33,98/289,23 ms ne sont pas directement comparables à un autre moteur/session.
- Dix écritures d'import : dix invalidations, **zéro** reconstruction implicite ; une préparation explicite finale. Une instruction sans ligne affectée invalide aussi conservativement.
- La publication consomme encore quelques centaines de ms de CPU SQL pour le JSON canonique/digest. Le calcul est sorti du verrou de version après le constat local ; droits/proof/CAS sont vérifiés ensuite. Le temps exact de détention du verrou n'a pas été mesuré. La race writer/publish démontre l'attente réelle et le rejet correct ; sa durée inclut hashing, attente et test, pas uniquement du verrou.

Supplément hors période : **PASS** sur une vraie ligne synthétique datée de 2030, UPDATE affectant une ligne, n=1. Mutation avec invalidation **0,80 ms** ; MISS attendu, facts/digest consommés inchangés. Zéro reconstruction automatique ; préparation explicite conservant les mêmes facts. Le test de dix imports et les séries n=20 ci-dessus restent distincts de cette mesure unique, qui ne fournit pas un P95.

À titre d'estimation locale, environ 423 ms de préparation / 24,47 ms de gain médian intégré = **18 lectures avant amortissement**. Ce ratio de médianes n'est pas une garantie ; la granularité globale peut raccourcir la durée utile. La préparation doit être groupée après imports et explicitement déclenchée hors READ. Ne pas ajouter une infrastructure de worker pour ce gain. Si les versions changent trop souvent, rester au direct et mesurer la fréquence réelle avant d'affiner l'invalidation.

Réseau Supabase/PostgREST, concurrence multi-utilisateurs, régions Vercel et Board <2s : non mesurés. Le bénéfice local justifie un déploiement de validation limité après revue ; **aucun gain en secondes ne peut être promis**.

## G — Accord nécessaire et suite minimale vers SNAP-3

**Prêt pour revue du SQL et d'un déploiement de validation ; pas prêt pour activation ou migration automatique.**

1. Revue distincte du fichier exact et de son SHA, des owners/grants, schémas/colonnes/contraintes réels, FK restrictives et du helper privé effectif. Vérifier tous les jobs/imports/DDL connus ; absence de couverture prouvée = OFF.
2. Approuver une migration distante ciblée, encore désactivée ; vérifier les triggers ALWAYS, leur coût sur les vrais writers et le protocole d'invalidation DDL. Aucun event trigger présumé.
3. Tester de vrais JWT distincts, révocation avec ancien JWT, auteur/foyer/personnes et DML/publish refusés, sur données admissibles isolées ; PostgreSQL natif actuel ne remplace pas ce gate.
4. Brancher séparément le client reader authentifié au runtime Composer et le publisher trusted à une préparation explicite du owner. Conserver Apply direct et les données vivantes. Mesurer usage HIT/MISS, amortissement et P95 en authentifié avant activation générale.

Rollback proposé, **non exécuté à distance** : flag OFF / retrait du store ; `enabled=false` invalide toute admission et conserve les artifacts. Révoquer EXECUTE publish à service_role si un writer de publication doit être arrêté. Conserver state/triggers et artifacts ; aucun DROP ou restauration destructive. Avant tout DDL/méthode : OFF, epoch/version avancés, modification revue, vérification, nouvelle préparation et réactivation approuvée.

La couverture locale des classes de writers est complète pour le fragment ; **la couverture effective Production n'est pas prouvée**. Un faux FRESH reste possible si un administrateur contourne le protocole DDL ou si les préconditions réelles divergent : le store non branché et OFF empêche cette exposition dans la livraison actuelle.

**STOP SNAP-2. Aucun second snapshot, SNAP-3, migration ou déploiement lancé.**
