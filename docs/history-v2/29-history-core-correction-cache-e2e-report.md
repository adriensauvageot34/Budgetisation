# HC5 — Historical correction / republish / client cache E2E

Date : 2026-09-04.

**Lecture du rapport : les sections 1–8 conservent l'arrêt initial comme trace d'audit. La décision humaine de continuation l'a résolu ; les sections 9 et suivantes décrivent l'implémentation HC5 et remplacent les anciens NOT_RUN / BLOCKED pour le verdict courant.**

**Verdict courant : HC5 E2E CONTRACT = PASS ; HC5 LIVE CUTOVER PROOF = PENDING.**

## 1. Résultat et périmètre de la preuve

**STOP — STRUCTURAL CONTRADICTION : rollback vers la P1 invalidée du scénario de correction.**

Le prompt impose de préserver HC4, de rendre P1 non fraîche après correction Canonical, puis demande en section 18 un rollback autorisé P2 → P1 avec réactivation de P1 telle quelle. Pour la même P1 invalidée, cette dernière attente contredit explicitement le contrat HC4 conservé : une cible invalidée n'est pas éligible au rollback.

Ce constat est une preuve statique sur le checkpoint, **pas une exécution E2E ni un échec runtime reproduit**. Il ne remet pas en cause les PASS HC1–HC4. Le refus de rollback est un comportement existant documenté, pas un bug à contourner. Si la section 18 vise un scénario distinct sans invalidation Canonical, cette distinction doit être confirmée ; elle permettrait de préserver HC4 sans modifier sa doctrine.

Conformément à la consigne d'arrêt du prompt, aucune implémentation HC5, aucune migration, aucune correction de données, aucun rebuild et aucune publication n'ont été exécutés. Seul ce rapport est ajouté. HREM-16 n'est pas résolu dans cet état.

## 2. Baseline Git et gates d'entrée

| Contrôle | Résultat |
| --- | --- |
| HEAD initial | `f3c1c5426db94bfd0e12bafb1b3cd9163326e556` |
| Branche | `main` |
| Working tree initial | CLEAN ; `git status --short` vide |
| Checkpoint HC4 | `feat(history-v2): enforce frozen publication generations` |
| Parent / checkpoint HC3 | `2bd57669885967e123a7706e361b1cf62d839fb0` |
| HC1 / HC2 / HC3 | PASS selon les rapports 25 / 26 / 27 lus ; suites non relancées |
| HC4 | PASS ; IMPLEMENTATION / CONTRACT = PASS ; LIVE DATABASE CUTOVER = PENDING selon le rapport 28 |
| Instructions lues | `AGENTS.md`, rapports 25–28 et prompt HC5 |
| Environnement | Checkout Windows local ; lectures de code/SQL uniquement ; aucune base de test démarrée |

## 3. Preuves de la contradiction

Les références ci-dessous sont celles du HEAD initial, laissé inchangé.

| Maillon | Preuve fichier / fonction | Conséquence |
| --- | --- | --- |
| Contrat HC4 | `docs/history-v2/28-history-core-frozen-publication-report.md:98`, section Rollback | Une cible invalidée reste refusée ; aucune reconstruction depuis le Canonical courant. |
| Boundary de mutation | `src/server/analytics/materialization/mutation.ts`, `recordAnalyticsMutation` ; `supabase/migrations/20260825105100_analytics_materialization.sql:274`, `public.record_analytics_mutation` | La RPC appelle `private.bump_revision_and_log`, puis l'invalidation. La mutation Canonical complète n'a pas été exercée dans ce lot. |
| Invalidation | `supabase/migrations/20260825105100_analytics_materialization.sql:195`, `private.invalidate_analytics_materialization` | Affecte `invalidated_at` et `invalidation_revision` des artifacts/snapshots actifs visés ; ne réécrit pas le contenu métier. |
| Éligibilité rollback | `supabase/migrations/20260831150000_history_v2_publication_rollback.sql:95`, `public.restore_history_v2_publication` | La complétude de la cible compte uniquement les artifacts et Query snapshots avec `invalidated_at IS NULL`. |
| Refus avant activation | Même migration, lignes 106–108 | Si une clé requise n'est plus admissible, lève `Incomplete History V2 rollback target` / SQLSTATE `23514`, avant désactivation de la génération courante. |
| Activation rollback | Même migration, lignes 129–138 | L'activation filtre également `invalidated_at IS NULL` ; ne supprime pas l'invalidation. |
| Freshness indépendante | `src/server/analytics/materialization/freshness.ts`, `isScopedMaterializationFresh` | Pour un mois fermé, la révision source doit couvrir la révision source de période et la dernière révision d'impact. N ne couvre pas N+1. |
| Lecture History | `src/server/analytics/materialization/store.ts:604`, `readQuery` | Exige publication publiée, lignes actives, non invalidées, identité compatible et freshness. |
| Fail closed | `src/query-api/server/execute-query.ts:228` | Avec le service de matérialisation, un miss History V2 lève `QueryTemporaryUnavailableError` avant l'appel dynamique de l'adapter. |

### Contre-exemple symbolique, non exécuté

| Étape imposée | État de P1 | Conséquence contractuelle |
| --- | --- | --- |
| Initial | Publiée, active, source N, non invalidée | Peut être fraîche pour N. |
| Correction impactant le mois | Source N conservée ; impact N+1 ; artifacts requis invalidés | P1 reste stockée, mais ne doit plus être servie comme fraîche. |
| Finalize réussi de P2 à N+1 | P1 historique/inactive ; contenu et source N conservés | P2 peut porter la vérité corrigée ; P1 n'est pas rendue fraîche par ce switch. |
| Rollback demandé vers cette P1 | Ses artifacts requis restent invalidés | Le comptage admissible échoue ; la RPC refuse le rollback. |

L'invalidation peut laisser le flag physique `is_active` à true avant le finalize suivant. **Actif physiquement ne signifie pas frais ni servable.** L'exigence de conservation de P1 ne constitue pas une autorisation de servir sa vérité invalidée.

Effacer arbitrairement `invalidated_at` ne serait ni autorisé ni suffisant : la révision source N de P1 reste antérieure à l'impact N+1. Modifier sa source, ses hashes ou son manifest fabriquerait une preuve rétroactive et violerait HC4. Aucun de ces contournements n'est effectué.

### Portée des anciens tests HC4

Dans `scripts/check-history-v2-frozen-publication.mjs`, les appels de rollback sont aux lignes 191, 198 et 202 ; l'invalidation testée intervient ensuite, ligne 216. Les PASS du rapport 28 prouvent donc un rollback vers des cibles admissibles, y compris legacy sans manifest, **pas** une réactivation après invalidation Canonical de cette cible. Aucun résultat antérieur n'est recyclé comme preuve E2E HC5.

## 4. Arbitrage humain nécessaire avant reprise

Option recommandée, compatible avec HC4 :

1. Dans le scénario principal de correction N → N+1, tester que le rollback vers P1 invalidée est **refusé**, que P2 reste active et que P1 reste intacte et traçable.
2. Dans un scénario distinct sans invalidation Canonical de la cible, tester le rollback autorisé entre générations complètes et admissibles, sans réécriture ; préserver aussi le cas legacy autorisé par HC4.
3. Reprendre ensuite l'implémentation E2E et le correctif de cache sans modifier les règles de freshness/rollback.

Cette séparation des scénarios n'est pas considérée comme implicitement validée. Si la réactivation de la P1 invalidée est réellement exigée, une décision produit/data doit définir dans quelles conditions une vérité connue comme obsolète redevient admissible, et comment cela respecte la révision source, le journal d'impact et le fail-closed. Il ne s'agit pas d'une simple modification de flag SQL.

## 5. Couverture du livrable HC5 à l'arrêt

`NOT_RUN` signifie absence de preuve exécutée pendant ce lot. `STATIC_ONLY` ne vaut jamais PASS E2E. Les identifiants P1/P2, G1/G2, N/A ci-dessus sont symboliques : aucun UUID, hash ou compteur d'exécution n'est inventé.

| N° | Exigence | Résultat de ce lot |
| --- | --- | --- |
| 1 | Baseline Git | Vérifiée, section 2. |
| 2 | Environnement de test | Local read-only sur code ; aucun PostgreSQL de test lancé. |
| 3 | Scénario synthétique P1 | NOT_RUN ; contre-exemple statique uniquement. |
| 4 | Correction appliquée | NONE. |
| 5 | dataRevision avant/après | NOT_RUN ; N → N+1 symbolique seulement. |
| 6 | Change log / mutation record | STATIC_ONLY ; appels de RPC identifiés, aucune entrée créée. |
| 7 | Scope d'invalidation | STATIC_ONLY ; invalidation du mois repérée, non exercée. |
| 8 | Freshness P1 | STATIC_ONLY ; règle N < impact N+1 incompatible avec freshness. |
| 9 | Fail-closed avant P2 | STATIC_ONLY ; garde identifiée, aucune navigation testée. |
| 10 | Rebuild P2 | NOT_RUN ; primitive HC4 non modifiée. |
| 11 | publicationId / G1 → G2 | NOT_RUN ; aucune génération créée. |
| 12 | Artifacts / snapshots affectés | NONE ; aucune écriture. |
| 13 | resourceInputHashes | NOT_RUN ; aucun hash calculé ou modifié. |
| 14 | publicationFactsHash | NOT_RUN ; aucun hash calculé ou modifié. |
| 15 | Manifest / manifestHash | NOT_RUN ; aucune création, aucun rétrofit. |
| 16 | RuntimeSchemas | NOT_RUN. |
| 17 | Staging | NOT_RUN. |
| 18 | Certification | NOT_RUN. |
| 19 | Finalize | NOT_RUN. |
| 20 | analyticsRevision | NOT_RUN ; aucune révision observée ni modifiée en base. |
| 21 | Preuve P1 immuable | NOT_RUN E2E ; protections HC4 laissées intactes. |
| 22 | Absence de reliquats P1 | NOT_RUN ; test HC4 existant non modifié. |
| 23 | P1 traçable | NOT_RUN E2E ; aucune publication touchée. |
| 24 | Rollback | BLOCKED pour la cible invalidée du scénario ; preuve statique section 3. |
| 25 | Cache avant HC5 | Audit serveur / RSC / Next / client / Map non terminé à cause du STOP. |
| 26 | Cause exacte `revalidate: never` | Non certifiée ; le risque décrit par le prompt n'est pas présenté comme reproduit. |
| 27 | Solution cache | NONE ; aucune nouvelle architecture décidée. |
| 28 | Génération inchangée | NOT_RUN ; aucun compteur fetch/rebuild mesuré. |
| 29 | Génération changée | NOT_RUN ; aucun client basculé P1 → P2. |
| 30 | Query runtime | STATIC_ONLY pour les gardes ci-dessus ; familles non testées. |
| 31 | Zéro calcul à la navigation | NOT_RUN ; aucune preuve instrumentée revendiquée. |
| 32 | Tests | Contrôles Git seulement, section 7 ; suites/build non exécutés après STOP. |
| 33 | Migrations pending | HC3 puis HC4, section 6 ; aucune interrogation live dans ce lot. |
| 34 | Limites locales | Preuve statique uniquement, pas de harness ni preuve transactionnelle nouvelle. |
| 35 | Live / HC6 | Live non exécuté, cutover PENDING ; HC6 non commencé. |

## 6. Migrations et déploiement

| Ordre | Migration préparée | Statut |
| --- | --- | --- |
| 1 | `supabase/migrations/20260904120000_history_v2_dependency_manifest.sql` | HC3 ; pending live selon le checkpoint et les rapports existants. |
| 2 | `supabase/migrations/20260904180000_history_v2_frozen_publications.sql` | HC4 ; pending live selon le checkpoint et les rapports existants. |

HC4 dépend de HC3 : accès à `analytics_publications.dependency_manifest` et contrôle du trigger `history_v2_dependency_manifest_guard` dans le handshake. Ordre requis : HC3 → HC4, après contrôle de drift et autorisation humaine distincte. Aucune migration HC5 créée. Aucune migration appliquée, même en test, dans ce lot.

L'historique live n'a pas été relu ici ; « pending » reprend l'état déclaré au checkpoint, pas une nouvelle certification Supabase. Le blocage présent est contractuel, **pas un manque d'accès à une base de test**. Aucune autorisation de migration production n'est sollicitée pour le résoudre.

## 7. Contrôles exécutés et statut Git

- `git status --short` : vide au départ ; seul ce nouveau rapport à la fin.
- `git rev-parse HEAD` / `git branch --show-current` / `git log -2` : checkpoints HC4 et HC3 identifiés, branche main.
- Lectures ciblées des rapports, du SQL de rollback/invalidation, de freshness, des gardes Query et de l'ordre des tests HC4 : contradiction documentée, sans exécution métier.
- `git diff --check` : PASS. `git diff --no-index --check -- NUL docs/history-v2/29-history-core-correction-cache-e2e-report.md` : aucune erreur whitespace ; code 1 normal pour un nouveau fichier différent de NUL. Seul avertissement : normalisation Git LF → CRLF au prochain traitement.
- Tests HC1–HC5, matérialisation, architecture, typecheck et build : **NOT_RUN**, arrêt contractuel avant implémentation ; aucun résultat ancien présenté comme validation de cet état HC5.
- HEAD final : inchangé ; **NO COMMIT**, aucun push.
- Fichiers de code / migrations modifiés : NONE.
- Seul fichier ajouté : `docs/history-v2/29-history-core-correction-cache-e2e-report.md`.
- Aucune donnée réelle, publication ou Supabase modifiée. Aucun HC6, Global, Import ou chantier UI commencé.

## 8. Verdict

HC5 E2E CONTRACT = BLOCKED

HC5 LIVE CUTOVER PROOF = PENDING

HISTORY CORE HC5
BLOCKED

## 9. ROLLBACK CONTRACT RESOLUTION

Autorité : prompt humain « HC5 — CONTINUATION APRÈS RÉSOLUTION DE LA CONTRADICTION ROLLBACK », reçu après l'arrêt documenté ci-dessus.

- Contradiction initiale : le premier prompt assimilait rollback opérationnel et annulation de correction Canonical.
- Décision : **CORRECTION INVALIDATION** et **OPERATIONAL PUBLICATION ROLLBACK** sont deux scénarios indépendants.
- Scénario A : P1 invalidée reste non éligible ; rollback refusé avant P2 et après activation de P2. Le refus ne modifie ni contenu, ni manifest, ni génération courante.
- Scénario B : sans correction Canonical, P1 complète, compatible et non invalidée est réactivable telle quelle après P2.
- Annuler une correction relève d'une nouvelle correction inverse N+2, suivie d'une nouvelle génération P3. Réactiver directement P1 invalidée n'est pas une annulation autorisée. Aucun outil d'undo ou planner n'est construit.
- Preuve de conservation HC4 : diff HEAD vide sur les neuf fichiers de son checkpoint, y compris migration, rebuild, store, finalizer/manifest wiring, producteur et tests. Le SQL de rollback antérieur reste également inchangé.

## 10. Baseline de reprise et environnement exécuté

HEAD initial/final : `f3c1c5426db94bfd0e12bafb1b3cd9163326e556`, branche `main`. À la reprise, seul le rapport 29 était non suivi ; aucun changement étranger. **NO COMMIT**, aucun push demandé ni effectué.

Environnement : Node 24.19.0, PostgreSQL embarqué PGlite 0.3.14 installé hors dépôt. Bases en mémoire neuves, fermées après chaque scénario ; aucune URL Supabase, aucun secret, aucun export bancaire réel. Le harness utilise les migrations versionnées réelles de matérialisation, rollback, single-active, HC3 et HC4.

Limite précise des prérequis : les tables Canonical minimales, l'édition du Life Event et `private.bump_revision_and_log` sont des prérequis **synthétiques de test**. Le DDL de ce dernier helper n'est pas présent dans les migrations du dépôt. La RPC versionnée `public.record_analytics_mutation`, le helper serveur `recordAnalyticsMutation`, l'invalidation, les gardes, le stage, le manifest, le finalize et le rollback sont, eux, les implémentations réelles. Cela prouve le contrat d'intégration local, pas l'identité du DDL Canonical live.

## 11. Scénario A — correction historique réellement exécutée

Fixture : Household `00000000-0000-4000-8000-000000000001`, mai 2026 fermé ; Life Event `00000000-0000-4000-8000-000000000501`, type `pharmacie`, date `2026-05-12`. Aucune composante financière ; Actual officiel de l'ensemble vide = 0. Typical et Minimal sans source sont des placeholders, pas des valeurs inventées.

Correction : validation `Confirmé` → `À valider`. Le Fact officiel cesse donc d'être admissible. L'occurrence, son affichage Calendar et le détail Activity cessent d'être atteignables dans P2. Il ne s'agit pas d'un patch de payload.

| Étape | État vérifié |
| --- | --- |
| Construction P1 | Nouveau UUID, artifacts + snapshots inactifs, RuntimeSchemas/preflight/certification vérifiés avant begin ; aucun actif initial. |
| Finalize P1 | dataRevision 7 ; analyticsRevision 11 → 12 ; P1 seule active et fraîche. |
| Client lit P1 | Calendar, Activity Detail et M1 chargés dans la même instance de cache. Activity occurrences = 1. |
| Échec de correction injecté | Transaction annulée : statut Confirmé, révision 7, zéro mutation log ; P1 intacte. |
| Correction validée | Édition synthétique puis `recordAnalyticsMutation` dans la même transaction PostgreSQL ; commit. |
| Révision / log | dataRevision 7 → 8 ; une entrée life_event / ID exact / affected_month 2026-05-01 / impact_scope month ; analyticsRevision reste 12. |
| Invalidation | Deux artifacts et 44 snapshots P1 invalidés ; mêmes contenus, timestamps de contenu, manifest et hashes. |
| Rollback avant P2 | Cible P1 invalidée refusée par la RPC réelle : `Incomplete History V2 rollback target`. |
| Navigation avant P2 | Calendar, M1 et Activity Detail retournent `TEMPORARY_UNAVAILABLE` ; le cache ne peut plus servir P1 comme courante. |
| Rebuild P2 | `buildHistoryMonth` HC4, sourceRevision 8 ; nouvelle publication/generation, deux artifacts, 43 snapshots, manifest durable et read-back vérifiés. |
| Stage | P2 inactive ; P1 toujours conservée, invalidée. Aucun mélange servable. |
| Échec tardif Finalize injecté | Exception après les switches SQL ; transaction entièrement annulée, flags physiques P1 conservés, P2 inactive, analyticsRevision 12. P1 invalidée reste néanmoins non servable. |
| Finalize réussi | P2 seule active ; analyticsRevision 12 → 13 ; P1 inactive et toujours invalidée. |
| Détail disparu | `history_activity_detail(pharmacie)` absent de P2, aucune ligne P1 active résiduelle ; la Query refuse ce détail. |
| Lectures après switch | Les 43 requêtes matérialisées de P2 sont relues via le vrai store et `executeQuery`, avec RuntimeSchemas et PublicationMeta P2. |
| Même client | Le cache Calendar passe de P1 à P2 sans purge manuelle/restart et reçoit un payload différent. |
| Rollback après P2 | P1 invalidée refusée ; P2 reste seule active et inchangée. |
| Immutabilité / traçabilité | Comparaison exhaustive publication + snapshots + artifacts de P1 avant/après, hors les trois champs techniques autorisés HC4. Manifest compris. |

G1 = generation_key = publicationId P1 ; G2 = generation_key = publicationId P2. Ces égalités sont contrôlées par le stage/read-back HC4 et les migrations, sans réutilisation d'identité.

## 12. Production, certification synthétique et hashes

Chemin effectivement exécuté par `scripts/lib/hc5-synthetic-history.mjs` :

`CanonicalRepository → FactSourceResolver.loadActivityOccurrences → buildCalendarSemanticMonthFromCanonical → Calendar Semantic / Daily Economic Ledger → builders officiels History → closure HC3 → buildHistoryV2Preflight → validation certifiée HC4 → buildHistoryMonth → stage → read-back → finalize explicite`.

- Le producteur n'appelle aucun snapshot pour fabriquer ses données.
- Actual de la fixture est calculé par `sumEconomicNetForScope`, pas recopié d'un oracle.
- Daily Finance utilise le moteur officiel ; SUM(days) + unassigned = Actual = 0 et residual = 0 sont vérifiés.
- Les builders Bilan réutilisent les moteurs existants. La fixture ne revendique pas une nouvelle certification statistique Typical/Minimal.
- Les huit preuves exigées par `validateHistoryMonthBuild` sont exécutées : Actual commun, Daily reconciliation, somme quotidienne + non affecté, 15 familles déclarées, RuntimeSchemas, hashes, déterminisme avec seconde production et PublicationMeta. Aucun reçu PASS inconditionnel n'est injecté.
- Le profil conserve les 15 familles logiques. La fixture parcourt dix familles avec le détail Activity ; les détails Category/Moment/Place/Segment sans cible ne sont pas inventés. Le gate de matérialisation existant complète la couverture des 15 familles avec 54 instances.
- Le `resourceInputHash` Calendar change. Celui de Spending Nature, non affecté par cette correction de Life Event, reste identique.
- `publicationFactsHash` et `manifestHash` changent ; le manifest stocké est relu avec `SupabaseHistoryManifestStore`.
- L'identité d'implémentation contient le HEAD et un digest des fichiers sources réellement enregistrés, y compris non suivis. Elle ne prétend pas que ce travail HC5 a déjà été commité.
- Les UUID de publication sont alloués par le mécanisme HC4 ; les contenus/hashes métier sont déterministes à intrants et implémentation constants.

Les IDs et hashes du dernier run sont enregistrés en section 17. Ce test est une **certification synthétique du scénario HC5**, pas la recertification des douze mois de données utilisateur.

## 13. Scénario B — rollback opérationnel indépendant

Base de test distincte, aucune correction Canonical :

`N=7 / A=11 → P1 publiée A=12 → P2 publiée A=13 → rollback P2 vers P1 A=14`.

P1 reste complète, compatible et non invalidée. La RPC réussit ; le signal de génération redevient P1. Comparaison intégrale des lignes P1 et P2 : aucun payload, artifact, snapshot, hash ou manifest réécrit. P2 reste physiquement conservée. dataRevision reste 7.

Le test HC4 inchangé est également exécuté avec PostgreSQL : son rollback vers une ancienne génération legacy sans manifest passe, sans création rétroactive de preuve. Ce test de stockage legacy n'est pas présenté comme une validation de tous les anciens RuntimeSchemas.

## 14. Audit des caches et correction HREM-16

| Niveau | Avant HC5 | Traitement / preuve HC5 |
| --- | --- | --- |
| Query key | Ressource + scopeHash + paramètres normalisés ; aucune identité de publication. | Clé logique inchangée ; l'éligibilité du cache History est désormais liée au Household/mois/publicationId. |
| Cache serveur | Snapshots persistés, garde freshness dans `store.readQuery`. Cache d'impacts limité à une instance de store créée pour la requête/contexte. | Aucun cache global de génération ajouté. Réutilisation de `materializationPeriod` et `isScopedMaterializationFresh`. |
| Contexte serveur | `getBootstrapContext` vérifie l'utilisateur et lit Household/périodes/révisions ; pas de memoize global dans ce chemin. | Le signal repasse par cette autorisation ; le client ne choisit pas son Household. Révisions relues en fin de probe pour fermer un changement concurrent pendant la lecture. |
| RSC / Next serveur | Route History force-dynamic, données initiales issues des Query serveur. | Aucun `router.refresh` systématique. Les états SSR sont branchés au même contrôle de génération via `useHistoryPageState`. |
| Router cache / restauration RSC | Un ancien arbre RSC peut ramener son initialState. | Un initialState P1 ne peut réensemencer le cache lorsque le signal indique P2. Test discriminant. |
| Map mémoire application | `clientQueryCache` conservait la réponse sous clé logique ; revalidate never coupait la relecture. | History passe par `HistoryGenerationCache` ; les autres ressources gardent leur chemin existant. Éviction ciblée au mois, effacement inter-Household justifié par l'isolation de session. |
| Client monté / drawers | Pas de notification de nouvelle génération à identité Query inchangée. | Abonnements par mois ; changement de publication ou indisponibilité enlève les données précédentes et relance la lecture des seuls abonnés concernés. |
| HTTP | POST Query dynamique. | Signal et réponses Query : `private, no-store`, `Vary: Cookie`. Probe client no-store, timeout 10 s. |

### Signal minimal, sans nouveau ReadModel ni nouvelle RPC métier

`POST /api/query`, header `x-history-generation: 1`, corps strict `{ month }`.

Réponse contrôlée par `historyGenerationSignalSchema` : `{ householdId, month, publicationId: UUID | null }`. Ce mode est un contrôle de transport ; aucune seizième famille History, aucun God RPC et aucun accès opérationnel d'écriture.

`readHistoryGenerationSignal` ne sélectionne **aucun payload**. Il lit les identités actives et leur complétude, la publication, les métadonnées des artifacts, l'impact du mois et les révisions. Une génération absente, mélangée, incomplète, invalidée ou stale retourne null. Les révisions sont transportées en texte, sans perte de précision. Le vrai chemin Query conserve ensuite ses validations de signatures compatibles, RuntimeSchemas et PublicationMeta ; le signal ne les remplace pas.

### Points de détection et limites explicites

Vérification au montage/changement de requête ou initialState, retour focus, visibilitychange visible, pageshow et popstate. Les appels concurrents du même mois sont mutualisés. **Aucun polling périodique**, aucun refetch systématique des payloads fermés, aucune purge manuelle, aucun calcul métier React.

La détection est garantie au prochain point de contact prévu ; ce mécanisme n'est pas du push temps réel vers un onglet totalement inactif. Les navigations RSC conservent leur fonctionnement serveur existant : le compteur « zéro refetch » porte sur les payloads API du cache client et sur les requêtes ajoutées par HC5, pas sur l'absence de toute requête RSC préexistante.

Une erreur de contrôle ou une publication null provoque un état local indisponible, sans `previousData` de P1 présenté comme courant. Une réponse P1 arrivée en retard après le signal P2 est refusée ; une relecture peut alors charger P2. Aucune réponse tardive ne réintroduit silencieusement P1.

### Compteurs réellement observés

- Scénario A : 14 contrôles de métadonnées, 4 chargements de payload au total : trois lectures initiales P1 et Calendar P2.
- Trois séries concurrentes Calendar/M1 sans changement : **0 payload supplémentaire**.
- Deux retours Calendar après chargement P2 : **0 payload supplémentaire**.
- Scénario de concurrence isolé : 14 probes, 4 fetches ; tests cache partagé, ancien RSC, mois non affecté conservé, offline fail-closed, réponse P1 tardive refusée, PublicationMeta manquant refusé, mauvais mois refusé.
- Compteurs du chemin Query : **0 adapter Analytics dynamique**, **0 écriture de navigation**. Les seuls rebuilds sont les appels explicites du test.

## 15. Fichiers et compatibilité

| Fichier | Rôle |
| --- | --- |
| `src/query-api/history-v2/generation-signal.ts` | Type/parser strict du contrôle de transport. |
| `src/query-api/history-v2/index.ts` | Export public, conforme à la règle d'import Product Runtime. |
| `src/server/query/history-generation.ts` | Lecture métadonnées seule et éligibilité mensuelle. |
| `src/server/query/runtime.ts` | Entrée authentifiée réutilisant le bootstrap existant. |
| `src/app/api/query/route.ts` | Mode metadata autorisé, headers HTTP non-cacheables. |
| `src/components/runtime/history-generation-cache.ts` | Cache de session, coalescence, évictions et barrière de génération. |
| `src/components/runtime/use-history-query.ts` | Branchement React purement transport, événements de fraîcheur, erreurs locales. |
| `src/components/runtime/query-client.ts` | Routage des seules Query History vers ce contrôle. |
| `src/features/history-v2/use-history-page-state.ts` | États RSC Calendar/Week/Overview/Bilan raccordés sans calcul de ReadModel. |
| `src/features/history-v2/history-v2-page.tsx` | Branchement du hook ; aucune modification de disposition/UX métier. |
| `scripts/lib/hc5-postgres.mjs` | PostgreSQL de test, transport PostgREST, prérequis synthétiques explicites. |
| `scripts/lib/hc5-synthetic-history.mjs` | Producteur synthétique utilisant moteurs et builders officiels. |
| `scripts/check-history-v2-correction-cache.mjs` | E2E A/B, races cache et réutilisation des suites HC3/HC4. |
| `docs/history-v2/29-history-core-correction-cache-e2e-report.md` | Présent rapport, arrêt initial conservé. |

HC1/HC2 : aucun moteur changé. HC3/HC4 : aucun manifest format, SQL, store, rebuild, finalizer ou test existant modifié. Aucune règle d'invalidation/freshness/rollback assouplie. Aucun patch de snapshot. Aucun changement Calendar UI, markers, responsive, Global, Import, Swile, Media ou Diagnostic.

## 16. Tests finaux et migrations

| Commande / suite | Résultat |
| --- | --- |
| `node scripts/check-history-v2-correction-cache.mjs` avec PGlite | 160 checks HC5 PASS ; résultats détaillés du dernier run section 17. |
| Gate matérialisation inclus | 79 PASS, 15 familles / 54 instances / 2 artifacts. |
| HC3 inclus | 100 PASS, 13 sensibilités. |
| HC4 inclus, SQL activé | 83 PASS ; migrations, rôles, transactions, legacy et rollback. |
| `node scripts/check-history-v2-month-balance.mjs` | 99/99 PASS, autorités HC1/HC2 conservées. |
| `node scripts/check-history-v2-readmodels.mjs` | 27/27 PASS. |
| `node scripts/check-history-v2-calendar-daily-engines.mjs` | 42/42 PASS. |
| `node scripts/check-history-v2-transversal-contracts.mjs` | 48 PASS. |
| `node scripts/check-history-v2-canonical-contracts.mjs` | PASS. |
| `node scripts/check-analytics-materialization.mjs` | PASS. |
| `node scripts/check-history-v2-frontend.mjs` | PASS ; 15/15 contrats conservés et consommés. |
| `node scripts/check-architecture-imports.mjs` | PASS, 470 fichiers. |
| `tsc --noEmit --incremental false` | PASS, dernière relance sur les sources finales. |
| `next build` | PASS, Next 16.2.6, compilation / TypeScript / 7 pages statiques / routes dynamiques. |
| `git diff --check` | PASS ; nouveaux fichiers également contrôlés via diff no-index --check. |

Les échecs intermédiaires du harness ont été corrigés dans le test : DATE PostgreSQL → LocalDate PostgREST, prérequis Household de la fixture, retrait du scopeHash interne avant le transport Query, qualification SQL du helper synthétique et suppression des sources narratives non pertinentes du contexte M3 de test. Les erreurs TypeScript/imports du nouveau code ont été corrigées sans modifier HC4. Aucune suite n'a été réduite pour obtenir PASS.

Reproduction : utiliser un module PGlite 0.3.14 installé **hors dépôt**, renseigner `HC4_PGLITE_MODULE` avec son `dist/index.js` pour exécuter aussi les tests SQL HC4, puis lancer le script HC5. `HC5_PGLITE_MODULE` permet de sélectionner le moteur du seul nouveau harness. `HC5_REPORT_FILE` est optionnel pour écrire un résultat synthétique hors dépôt. Aucun environnement Supabase n'est nécessaire.

Migrations live toujours pending selon l'état humain de reprise : **HC3 `20260904120000_history_v2_dependency_manifest.sql` puis HC4 `20260904180000_history_v2_frozen_publications.sql`**. HC4 dépend de la colonne et du trigger HC3. Aucune migration nouvelle ni application live. Les cinq migrations exécutées par le harness ne l'ont été que dans ses bases synthétiques en mémoire.

La vérification de drift, du vrai helper Canonical/revision/log et des droits live reste à effectuer dans le lot autorisé de cutover. Le test local ne prouve ni concurrence multi-session Supabase, ni navigateur de production. Aucun smoke live, aucune recertification utilisateur, aucun HC6.

Le déploiement ultérieur du code HC5 doit conserver l'ordre des protections : HC3, puis HC4, puis activation du chemin dépendant des générations figées. L'identité UUID est un signal suffisant parce que HC4 interdit de modifier le contenu sous cet UUID ; ce rapport n'autorise pas à présumer cette protection installée live.

## 17. Identités du dernier run, statut Git et verdict

Résultat final : 160 contrôles HC5 PASS, plus 79 matérialisation / 100 HC3 / 83 HC4. Aucune modification de code entre ce run et la fin de rédaction du présent rapport.

| Preuve | P1 scénario A | P2 scénario A |
| --- | --- | --- |
| publicationId / generation_key | `9d62aac3-270c-418c-a175-e55a99ba2e7c` | `cf993f75-9318-4cab-a99d-4f2071414179` |
| sourceRevision | 7 | 8 |
| Révision de publication | 12 | 13 |
| Snapshots | 44 | 43 |
| Artifacts | 2 | 2 |
| manifestHash | `6583ad5d7827b74cd4d22140f37d1fc468e8eea52fd940184407456d8c249910` | `4110de6c7ee4626feffa518c0e11eef1d85e3df36955f412cac8baa0ad97b0ea` |
| publicationFactsHash | `a8cc4e9592d1dec57043eaeed0a50ea65d115c2b8f26e5c55427ea299b41fad9` | `bc61e51b8cef8f17217f032614f9e832083c340fbbf214963562ea8866a57205` |
| État final A | Invalidée, inactive, conservée | Active, source corrigée |

Scénario B indépendant : P1 `b5204bd1-90bf-4932-b81b-f5e79d3332dd`, P2 `fe30543c-ce1f-4e3b-a2b0-ec2c2df95cb1`. Rollback P2 → P1 réussi, sourceRevision 7 inchangée, analyticsRevision finale 14.

Le résultat JSON optionnel a été généré hors dépôt dans le répertoire temporaire système ; il n'est ni une publication live ni un fichier à committer. Les identités ci-dessus sont des UUID de test, pas des identités utilisateur.

Statut Git final :

- HEAD initial = HEAD final = `f3c1c5426db94bfd0e12bafb1b3cd9163326e556`.
- Branche `main`, **NO COMMIT**, aucun push.
- 5 fichiers suivis modifiés + 9 nouveaux fichiers HC5, listés en section 15.
- Aucun fichier étranger, aucune migration nouvelle, aucun artefact temporaire dans le working tree.
- Aucun diff sur les neuf fichiers HC4 ; migrations HC3/HC4 inchangées.
- Aucun secret, export financier personnel ou CSV ajouté.
- Working tree volontairement non clean : implémentation et rapport HC5 prêts pour un checkpoint séparément demandé.

La preuve PASS est locale et contractuelle : correction synthétique → révision/log/invalidation → rollback invalidé refusé → Query fail-closed → rebuild HC4 → P2 certifiée/stagée inactive → activation atomique → nouveau payload dans la même session → P1 immuable. Le scénario distinct prouve le rollback opérationnel légitime. Aucun démarrage de HC6.

HC5 E2E CONTRACT = PASS

HC5 LIVE CUTOVER PROOF = PENDING

HISTORY CORE HC5
PASS
