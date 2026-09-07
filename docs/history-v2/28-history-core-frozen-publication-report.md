# History Core HC4 — Frozen publication / immutability / controlled republish

Date : 2026-09-04.

## 1. Baseline, autorités et niveau de preuve

- HEAD initial : `2bd57669885967e123a7706e361b1cf62d839fb0`.
- Branche : `main`. Working tree initial propre, vérifié avant toute modification.
- HC1, HC2 et HC3 : PASS, rapports 25, 26 et 27 lus intégralement, ainsi que `AGENTS.md`. Leurs moteurs, doctrines, closures et format de manifest sont conservés.
- Aucun commit, push, déploiement, appel Supabase, écriture Canonical ou publication live effectué. Aucun HC5, Global, Import ou chantier UI commencé.
- La migration HC3 `20260904120000_history_v2_dependency_manifest.sql` est présente localement et non appliquée live selon l'état explicitement fourni. Aucun connecteur Supabase n'est disponible dans cette session : **pas de nouvelle attestation de l'historique ou du schéma live**.
- HC4 ajoute `20260904180000_history_v2_frozen_publications.sql`, également **non appliquée live**. Les autres migrations du dépôt sont antérieures ; leur statut live n'a pas été réaudité ou présumé à partir de leur simple présence locale.

Les essais SQL utilisent PostgreSQL embarqué **PGlite 0.3.14**, installé dans un répertoire temporaire hors dépôt. Ni Supabase local, ni conteneur Supabase, ni reset de base existante. Les tables de matérialisation et les RPC sont chargées depuis les migrations réelles ; seules les tables prérequises Household/révisions et les données de test sont synthétiques. Aucun package ou lockfile applicatif changé.

## 2. Inventaire des chemins d'écriture

P = `analytics_publications`, A = `analytics_artifacts`, Q = `analytics_query_snapshots`.

| Classe | Fonction / chemin réel | Table, écriture | États / risque avant HC4 | Après HC4 |
| --- | --- | --- | --- | --- |
| BUILD_INACTIVE | `store.ts:beginMonthPublicationProfile`, `beginMonthPublication` | P INSERT | Nouveau UUID, DRAFT, aucune activation | Inchangé ; primitive History crée toujours un nouveau UUID |
| STAGE | `store.ts:writeHistoryV2Artifact` | A UPSERT | UUID fourni, aucune vérification de statut ; contenu publié remplaçable | Précontrôle DRAFT + trigger avec verrou et identité exacte |
| STAGE / LEGACY | `store.ts:writeQuery` | Q UPSERT | Publication facultative, cache ou DRAFT ; UUID publié réutilisable | History exige un DRAFT, metadata cohérente, timestamp stable ; trigger autoritaire |
| LEGACY / STAGE | `store.ts:writeMetricIdentity`, appelé par `writeMetric`, `writeMetricBucket`, `metric-query-service.ts` | A UPSERT | Cache read-through / publication donnée ; possibilité de cibler un UUID History | Chemin métrique conservé ; SQL protège toute ligne appartenant à une publication History, même via ce writer générique |
| STAGE | `prepare-history-v2-live-publication.mjs:insertSql` | A/Q INSERT ON CONFLICT UPDATE, SQL généré seulement | Verrou DRAFT déjà ajouté HC3 ; pas de freeze physique des tables | Même script conservé, protections HC4 effectives lors de l'exécution SQL autorisée |
| STAGE | `history-manifest-store.ts:attach` → `attach_history_v2_dependency_manifest` | P UPDATE manifest | HC3 refuse remplacement et rétrofit ; retry identique sans UPDATE | Inchangé, manifest inclus dans le contenu immuable et utilisé comme scellement du DRAFT |
| FINALIZE | `store.ts:publishPrepared`, `publication-store.ts:publishAtomically` → `publish_analytics_materialization` | A/Q UPDATE active ; P UPDATE statut/révision/date | Transaction et CAS existants ; compte les clés requises | Corps du finalizer inchangé ; triggers participent à sa transaction |
| FINALIZE | Nouveau `guard_history_v2_frozen_publication`, transition DRAFT → published | A/Q UPDATE `is_active=false` uniquement | Anciennes clés de détail absentes de P2 pouvaient survivre actives | Termine la désactivation des anciennes lignes History du même mois, dans la même transaction |
| INVALIDATE | `record_analytics_mutation` → `private.invalidate_analytics_materialization` | A/Q UPDATE invalidated_at / invalidation_revision | Ne réécrit déjà aucun contenu | Autorisé sous l'identité propriétaire de la RPC SECURITY DEFINER |
| ROLLBACK | `store.ts:restoreHistoryV2Publication` → `restore_history_v2_publication` | A/Q UPDATE active ; révision Household | Réactive les lignes stockées, contrôles portée/complétude/révision | Conservé, testé y compris cible legacy sans manifest |
| LEGACY | `backfill.ts:beginAnalyticsBackfillPublication`, `stageAnalyticsBackfillPublication`, `finalizeAnalyticsBackfillPublication`, `backfillAnalyticsMaterialization` | Via writers / Begin / Finalize précédents | Profil Analysis existant ; nouvelles publications | Aucun changement de ce backfill ; jamais exécuté dans HC4 |
| LEGACY | `backfill.ts:failAnalyticsBackfillPublication`, abandon dans le backfill | P UPDATE status=failed WHERE status=draft | Ne change pas une publication publiée | Abandon DRAFT autorisé, identité/content conservés ; réouverture failed → draft refusée pour History |
| LEGACY | `scripts/backfill-analytics-materialization.mjs` | Via backfill serveur précédent | Lance le profil Analytics existant | Non exécuté, non modifié |
| LEGACY | `query-api/server/execute-query.ts` → `services.materialization.writeQuery` | Q UPSERT cache après miss | History refuse déjà le miss matérialisé avant ce point | Aucun read-through History introduit ; garde applicatif supplémentaire si writer appelé directement |
| BUILD_INACTIVE | Nouveau `history-rebuild.ts:buildHistoryMonth` | P INSERT, A/Q UPSERT inactifs, P attachement manifest | Nouveau point d'orchestration, pas nouveau pipeline | Réutilise les primitives ci-dessus, ne possède aucune activation implicite |
| FINALIZE | Nouveau `history-rebuild.ts:finalizeHistoryPublication` | Via Finalize existant | Nouvelle frontière de validation explicite | Preuve + RuntimeSchemas/digests + relecture durable + révisions, puis RPC existante |
| ADMIN_PRIVILEGED | DML SQL direct service_role / SQL Editor ; FK ON DELETE CASCADE ; TRUNCATE | P/A/Q INSERT/UPDATE/DELETE/TRUNCATE | Droits ALL permettaient mutation/suppression | Triggers bloquent contenu et suppression History ; TRUNCATE retiré de service_role |
| ADMIN_PRIVILEGED | Propriétaire / superuser / DDL / restauration physique / réplication privilégiée | Tout | Peut changer ou désactiver la protection | Hors garantie applicative : voir section 9 ; aucun usage live |

Les scripts `check-*` utilisent des clients simulés ou la base synthétique HC4, pas des writers de production supplémentaires. `history-v2-monthly-engines.ts`, la préparation Canonical/Facts et `buildHistoryV2Preflight` sont des producteurs/readers, pas des écritures dans P/A/Q. Aucun DELETE métier normal de ces tables n'a été trouvé dans le code serveur concerné. Les définitions historiques du finalizer sont remplacées par la migration single-active du 02/09 ; elles ne constituent pas deux RPC distinctes installées.

## 3. Risques réellement confirmés avant HC4

1. Les writers server-only pouvaient UPSERT des artifacts/snapshots d'un UUID publié. L'interdiction d'écrire depuis React n'était pas une barrière suffisante.
2. Les colonnes de contenu et les identités n'avaient pas de protection physique. HC3 protégeait le manifest mais pas toutes les lignes auxquelles il se rapporte.
3. `is_active`, les invalidations et le statut de publication pouvaient être modifiés directement avec service_role.
4. Un retry modifiait `computed_at` des snapshots, empêchant une identité strictement stable du contenu enregistré.
5. Le finalizer désactivait les anciennes lignes dont l'identité logique existait aussi dans la nouvelle génération. Une ancienne clé de détail disparue du nouveau manifest pouvait rester active : **ancienne génération partiellement active**. Le test de publication legacy `retired-detail`, absente de la nouvelle génération, prouve ce cas.
6. Le producteur de certification était déclenchable pour douze mois uniquement ; il manquait l'orchestration explicite, réutilisable et inactive d'un seul mois.

Aucune contradiction de doctrine HC1/HC2/HC3 n'a été nécessaire pour corriger ces frontières opérationnelles.

## 4. Contrat FROZEN_MONTH et protection physique

Une génération ayant déjà été publiée est reconnue par le statut published **ou** `published_at` non NULL **ou** `published_analytics_revision` non NULL. Il n'est pas possible d'effacer ces traces pour la recycler.

La migration additive installe :

- `is_history_v2_publication(uuid)` : manifest présent, ou snapshots History v2, ou l'un des deux artifacts partagés v2. Les générations anciennes sans manifest restent identifiables par leurs lignes, sans inventer de preuve.
- Trigger P `guard_history_v2_frozen_publication` : tous les champs d'une publication déjà publiée sont immuables ; aucune suppression. Après premier stage, l'identité DRAFT est également fixée : Household, période, source/base révisions, clés requises et UUID ne sont plus modifiables.
- Trigger A/Q `guard_history_v2_frozen_content` : tous les champs présents et futurs sont protégés par comparaison JSONB, **sauf** `is_active`, `invalidated_at`, `invalidation_revision`. Protection de payload, hashes, versions, signatures, génération, IDs, dates de calcul, expires_at et PublicationMeta métier sans liste permissive de champs métier.
- INSERT/UPSERT : verrou du parent `FOR UPDATE`, DRAFT jamais publié et non scellé, generation_key = publication_id, même Household/mois/source/base revision, metadata de publication exacte, clé requise, inactive et non invalidée. Un contenu différent au même emplacement de DRAFT est refusé : nouvelle vérité → nouveau UUID, même avant activation.
- Scellement : attacher le manifest HC3 ferme les INSERT du DRAFT. Les lignes déjà écrites ne sont pas modifiables ; Finalize ne peut pas subir une substitution de payload entre validation et activation.
- TRUNCATE et TRIGGER retirés de service_role sur les trois tables : empêcher de contourner les row triggers ou d'en installer un nouveau modifiant NEW après la garde.
- `history_v2_frozen_publication_contract()` : lecture de présence/activation des quatre triggers HC3/HC4. Le rebuild/finalize serveur échoue avant écriture si la migration manque ou si un trigger est désactivé.

Le manifest entier est protégé : manifestHash, publicationFactsHash, factDependencies, externalQueryRefs, formatVersion, versions par ressource et identité/digest d'implémentation. Aucun hash ou contenu existant n'est recalculé rétroactivement.

### Autorisation des mutations techniques

Les triggers HC4 sont **SECURITY INVOKER**. Une mutation technique est autorisée lorsque `current_user` est le propriétaire de la table, ce qui est le cas dans les RPC workflow SECURITY DEFINER existantes. Un service_role ordinaire, même BYPASSRLS, n'est pas ce propriétaire. Aucun GUC falsifiable n'est utilisé comme autorisation.

Les deux RPC Finalize/rollback conservent leur code, signatures et grants. L'invalidation existante conserve son code. Un service peut abandonner un DRAFT (`failed`), jamais le prétendre published ni rouvrir failed. Les timestamps de calcul/publication ne sont pas des horodatages techniques modifiables : seuls ceux d'invalidation restent mutables ici.

Les anciennes lignes History read-through sans publication, si présentes, peuvent être désactivées/invalidées par workflow, jamais réécrites ou réactivées en tant que nouvelle vérité. Aucun nouveau read-through History n'est autorisé.

## 5. Stage, Finalize et rollback

### Stage et retry

`assertHistoryDraft` donne une erreur serveur explicite avant UPSERT ; la protection contre la course concurrente reste le trigger SQL et son verrou, non cette lecture applicative. L'artifact et le snapshot utilisent `PublicationMeta.generatedAt` comme timestamp enregistré : un retry identique garde les mêmes octets métier.

Avant scellement, retry identique → même ligne ; contenu/version/source différent → refus. Après scellement, le pipeline relit le stage ; il ne réécrit pas ses lignes. Après publication, INSERT/UPSERT refusé, même identique. `attach` identique reste un no-op HC3, non une mutation. Une tentative interrompue peut rester DRAFT inactive ; aucune suppression de preuve ou activation cachée n'est effectuée.

### Finalize atomique

La RPC existante conserve : lock publication, lock Household revision, CAS expected/base analytics revision, source non future, clés complètes non invalidées, désactivation/activation, mise à jour révisions/période/changelog, statut published dans **une transaction**.

HC3 contrôle manifest, versions, metadata et cardinalités au dernier UPDATE de P. HC4 interdit la substitution de contenu et termine, dans cette transaction, la désactivation des anciennes clés History du même Household/mois, y compris celles absentes du nouveau manifest. Aucun nettoyage de payload, suppression, seconde transaction ou activation hors RPC.

Une exception injectée au dernier UPDATE, après les switches actifs, annule effectivement toute la transaction dans le test PostgreSQL : P1 reste active, P2 inactive et la révision permet encore le retry. Une génération incomplète ou avec conflit de révision ne remplace jamais P1.

Les RuntimeSchemas, les digests complets HC3 et les invariants métier sont vérifiés dans le producteur/preflight et la frontière serveur. PostgreSQL contrôle le stockage, les identités, le manifest et l'atomicité ; il **ne prétend pas réimplémenter les formules métier ou les RuntimeSchemas TypeScript**. Les opérateurs SQL privilégiés doivent utiliser les bundles certifiés, pas fabriquer une certification.

### Rollback

La RPC réactive une ancienne génération complète stockée, sans changer ses payloads ni son manifest. Les générations sans manifest restent rollbackables avec `LEGACY_UNKNOWN` ; aucun rétrofit. Une cible invalidée reste soumise au refus existant, pas reconstruite depuis le Canonical courant.

Un retry de Finalize pour une publication déjà published retourne son résultat historique : il ne la réactive pas après un rollback. La trace de P1/P2 reste identique hors flags/invalidations autorisés.

## 6. Primitive History-specific réutilisable

`src/server/analytics/materialization/history-rebuild.ts` :

1. `buildHistoryMonth({ client, context, month, sourceRevision, produce })` vérifie le contrat SQL HC4 installé, les révisions capturées et le scope.
2. `produce` fournit le résultat du producteur officiel, pas de nouvelles formules. Adaptateur concret : `scripts/lib/build-history-month.mjs:produceCertifiedHistoryMonth`.
3. Cet adaptateur appelle le producteur HC1/HC2 existant avec `--month`, `--household`, `--source-revision`. Il lit un export Canonical READ-ONLY à la révision demandée ; `CanonicalRepository`, `FactSourceResolver`, Analytics officiels, artifacts, builders, closure et invariants sont ceux déjà validés.
4. Les données de support historiques/adjacentes nécessaires restent lues/calculées par ce producteur ; **seul le mois demandé produit un preflight et une certification cible**. La fenêtre certifiée actuellement supportée reste 2025-08 → 2026-07. Aucun élargissement silencieux à un mois non couvert.
5. Le mode abrégé `--publication-only` est interdit avec `--month`. Household/révision de l'export sont comparés, pas choisis par l'oracle. Les valeurs EXPECTED restent exclusivement des assertions.
6. Le reçu de certification est lié au Household, mois, sourceRevision et manifestHash, avec invariants PASS. Les payloads passent à nouveau par `stageHistoryV2GenerationInMemory` : schemas, contenu/digests, versions et PublicationMeta.
7. Après une nouvelle vérification de révisions : Begin avec nouveau UUID, deux artifacts et petits writes Query inactifs, attachement du manifest, relecture paginée des tables et comparaison exacte des contenus, clés et scope. Résultat `STAGED_INACTIVE`, `finalizeRequested=false`.
8. `finalizeHistoryPublication({ client, context, generation })` est **séparé** : revérifie preuve, contenu reconstitué depuis le preflight, manifest durable et chaque ligne persistée, puis appelle la RPC existante. Le caller garde le bundle certifié ; aucun endpoint public ajouté.

L'adaptateur d'export est approprié à un script admin, pas à une requête navigateur/serverless. Il ne crée ni export live, ni credentials, ni session utilisateur. HC5 pourra brancher ce producteur concret à la primitive serveur et conserver le reçu/bundle dans son espace opérationnel. Le futur Refresh Planner Import et une capture transactionnelle universelle des sources ne sont pas implémentés ici.

Les tests HC4 exécutent la primitive serveur avec un vrai client PostgreSQL adapté au transport Supabase et le preflight synthétique des 15 ressources. Ils ne revendiquent pas une nouvelle certification de données historiques live ni une exécution réelle des douze mois.

## 7. Tests et preuves discriminantes

Commande principale, depuis le dépôt :

```powershell
$env:HC4_PGLITE_MODULE = '<installation temporaire>/node_modules/@electric-sql/pglite/dist/index.js'
node scripts/check-history-v2-snapshot-materialization.mjs
```

Le module PGlite est une dépendance de test temporaire, pas du runtime de production. Sans cette variable, le gate indique explicitement SQL NOT_RUN ; il ne revendique pas de preuve transactionnelle.

| Exigence HC4 | Preuve dans `check-history-v2-frozen-publication.mjs` | Résultat |
| --- | --- | --- |
| 1. Payload publié non mutable | UPDATE payload via service_role refusé | PASS SQL |
| 2. Artifact immuable | Writer serveur + UPSERT / UPDATE / DELETE A | PASS TS + SQL |
| 3. Snapshot immuable | Writer serveur + UPSERT / UPDATE / DELETE Q | PASS TS + SQL |
| 4. Manifest immuable | UPDATE dependency_manifest refusé | PASS SQL |
| 5. Hashes immuables | JSON payload/publicationMeta.factsHash et manifest modifiés refusés | PASS SQL |
| 6. UUID publié non restageable | Writer et UPSERT SQL direct sur P1 refusés | PASS TS + SQL |
| 7. Nouvelle vérité / identité | Nouveau build crée P2 ; source revision 8 crée P3 distincte, P1 inchangée | PASS TS + SQL |
| 8. Ancienne active pendant stage | Construction de P2 pendant P1 active ; P3 reste inactive | PASS SQL |
| 9. Incomplète refusée | Un seul artifact staged, Finalize échoue | PASS SQL |
| 10. Conflit révision refusé | Expected revision 999, aucun switch | PASS SQL |
| 11. Échec tardif sûr | Trigger test après switches, exception au dernier UPDATE, rollback total | PASS SQL |
| 12. Switch P1 → P2 | Active set final = P2 seule, 54 Query + 2 artifacts | PASS SQL |
| 13. P1 traçable | Comparaison exhaustive publication/lignes métier avant/après | PASS SQL |
| 14. Rollback sans réécriture | P2 → P1 et P1 → legacy sans manifest ; contenus identiques | PASS SQL |
| 15. Retry sûr | Artifact DRAFT identique sans doublon ; contenu changé refusé ; Finalize retry sans réactivation | PASS SQL |
| 16. Pas de génération partiellement active | Échecs/commits contrôlés ; ancienne clé absente du nouveau manifest désactivée aussi | PASS SQL |
| Read-through interdit | Writer History sans publication refusé | PASS TS |
| Autorisations | DML navigateur refusé ; service_role stage permis, TRUNCATE refusé | PASS SQL |
| Cutover manquant | Trigger désactivé dans le test temporaire → handshake refuse | PASS SQL |
| Invalidation autorisée | RPC private SECURITY DEFINER ne modifie que les champs techniques | PASS SQL |
| V1 inchangé | Cache Analysis v1 INSERT/UPDATE/DELETE reste possible | PASS SQL |

Les observations portent sur états commités et rollback réel PostgreSQL, pas sur des tableaux simulant la transaction. PGlite utilise un backend embarqué ; aucun stress test multi-session live n'est revendiqué. Les verrous sont ceux des migrations réellement exécutées.

| Suite exécutée | Résultat |
| --- | --- |
| Matérialisation History V2 | 79 checks existants PASS |
| HC3 dependency manifest / sensibilité | 100 checks, 13 mutations PASS |
| HC4 avec PostgreSQL embarqué | 83 checks PASS |
| Analytics materialization / publication | PASS |
| Month Balance HC1/HC2 | 99/99 PASS |
| Transversaux | 48/48 PASS |
| Calendar/Daily engines | 42/42 PASS |
| ReadModels | 27/27 PASS |
| Architecture | PASS, 465 fichiers |
| Typecheck `tsc --noEmit` | PASS |
| Production `next build` | PASS |
| Syntaxe producteur et adaptateur | PASS |
| `git diff --check` | PASS |

Pas de certification douze mois, de backfill, de smoke navigateur, de Preview ou de test V1 live. Les warnings MODULE_TYPELESS_PACKAGE_JSON/normalisation CRLF existants n'ont pas justifié une modification de configuration.

## 8. Compatibilité, points appris et limites

- Les publications existantes ne sont pas mises à jour par la migration ; aucun payload n'est patché. Aucun nouveau registre, colonne géante, table de snapshot, signature métier ou version de ReadModel.
- Les manifests legacy manquants restent NULL/UNKNOWN. La preuve de leurs dépendances ne peut être reconstruite rétroactivement.
- La stabilité des timestamps de stage est nécessaire aux retries strictement identiques.
- La fermeture du manifest peut supprimer des instances : single-active doit donc désactiver les anciennes clés absentes, pas seulement les identités communes aux générations.
- Le freeze des lignes dès leur stage supprime la fenêtre de substitution entre certification et Finalize ; la fermeture du DRAFT par le manifest empêche aussi les INSERT tardifs.
- Un abandon DRAFT conserve ses lignes pour diagnostic. Une politique de rétention/garbage collection privilégiée n'est pas ajoutée.
- La garde SQL préserve le format de publication existant et les anciennes signatures lues en rollback. Aucun changement d'acceptation RuntimeSchema côté Query.

## 9. Chemins privilégiés et report Import

Le propriétaire de la base/superuser peut modifier les fonctions, désactiver les triggers ou effectuer une restauration physique. Ces actions d'administration sont hors garantie et ne sont pas des writers server-only normaux. Les triggers de contenu refusent aussi les changements métier par le propriétaire tant qu'ils restent activés ; seuls les champs techniques lui sont autorisés. La nouvelle RPC de handshake ne constitue pas un système de détection d'un administrateur hostile ayant remplacé le code des fonctions.

La garantie suppose que les RPC workflow sont détenues par le propriétaire attendu des tables et que service_role n'est pas ce propriétaire : vérifier ce point lors du cutover. RLS ne constitue pas à elle seule la preuve, service_role la contourne déjà normalement. Un opérateur SQL fabriquant une nouvelle génération avec une fausse certification sort du pipeline autorisé ; le gate ne prétend pas certifier automatiquement la vérité économique de n'importe quel JSON écrit par un administrateur.

Les hardenings référencés **HREM-30 / HREM-31 BEFORE_IMPORT** restent reportés à Import conformément au prompt. Leurs fiches détaillées n'ont pas été localisées dans les rapports 25–27 / docs recherchées ; aucune attribution précise inventée à ces identifiants. La politique partagée actuelle du finalizer (`source_revision <= data_revision`, CAS analytics) est conservée. La primitive vérifie la révision source avant build/stage/finalize, mais ne prétend pas fournir un nouveau planner, un snapshot transactionnel de tous les lecteurs Canonical ou une barrière globale aux imports concurrents. Ces sujets restent à valider avant Import ; ils ne permettent pas de modifier une génération déjà publiée.

## 10. Déploiement / autorisation humaine requise ultérieurement

1. Vérifier en READ-ONLY le projet Supabase cible, migrations live, colonnes, triggers, rôles/propriétaires et versions exactes des trois tables / Finalize / rollback / invalidation. STOP si drift.
2. Faire approuver explicitement HC3 puis HC4 : `20260904120000_history_v2_dependency_manifest.sql`, puis `20260904180000_history_v2_frozen_publications.sql`. Aucune application autorisée implicitement par ce rapport.
3. Les deux migrations sont additives ; HC4 ajoute fonctions/triggers, retire TRUNCATE/TRIGGER à service_role, ne migre aucune donnée. Une désinstallation des protections est techniquement possible par DDL explicite mais retire la garantie ; elle n'est pas un rollback de contenu.
4. Recontrôler l'historique, les quatre triggers actifs, leurs fonctions/owners, droits/RLS, absence de droit navigateur et le handshake server-only. Vérifier la taille du manifest réel au futur stage.
5. Déployer séparément le code serveur depuis un checkout enregistré et propre. Les nouveaux contrôles refusent de fonctionner si HC3/HC4 manquent ; ne pas utiliser un ancien writer qui tenterait de modifier une génération scellée.
6. Dans HC5 **autorisé séparément seulement** : export Canonical READ-ONLY cohérent, production/certification du mois, nouveau UUID, stage inactif, manifest/read-back, puis décision explicite de Finalize. Contrôler single-active et rollback avec les contrats live. Aucune exécution de cette séquence dans HC4.

## 11. Fichiers et sortie

- `src/server/analytics/materialization/history-rebuild.ts` : orchestration mensuelle et activation séparée.
- `src/server/analytics/materialization/store.ts` : garde de stage History et timestamp idempotent.
- `src/server/analytics/materialization/index.ts` : exports.
- `scripts/check-history-v2-certification-12-months.mjs` : sélection d'un mois, scope/révision contrôlés ; calculs inchangés.
- `scripts/lib/build-history-month.mjs` : adaptateur concret vers le producteur officiel.
- `scripts/check-history-v2-frozen-publication.mjs` : tests TS/SQL synthétiques.
- `scripts/check-history-v2-snapshot-materialization.mjs` : intégration des tests, fake client adapté à la nouvelle lecture de garde.
- `supabase/migrations/20260904180000_history_v2_frozen_publications.sql` : protections physiques et handshake.
- Ce rapport.

HEAD conservé : `2bd57669885967e123a7706e361b1cf62d839fb0`, `main`, **NO COMMIT / NO PUSH**. Modifications locales HC4 uniquement, destinées à un checkpoint ultérieur. Migration HC3 inchangée et non appliquée live ; migration HC4 nouvelle et non appliquée live.

HC4 IMPLEMENTATION / CONTRACT = PASS

HC4 LIVE DATABASE CUTOVER = PENDING

HISTORY CORE HC4
PASS
