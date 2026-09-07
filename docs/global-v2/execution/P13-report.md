# P13 — Infrastructure de publication Global

## Baseline et autorité

- Branche : `main`.
- HEAD d'entrée : `9e9d69e78456060fd58beaa9d7a24911676133ce`.
- P12 : `IMPLEMENTATION_GATE`, `CONTRACT_GATE`, `TEST_GATE` et `GLOBAL_PHASE_G` = `PASS`.
- Autorités lues : C01–C14, Master Global (SHA-256 `8b0d0ff2381599c4495645cd1dd1ebf2fa0d027fc3113be78aee945fae12f8be`), A1, sorties P01–P12, doctrines History HC3–HC5 et schéma de matérialisation versionné.
- Index P13 : 238 exigences, 28 capabilities et 265 tests conceptuels. Leur couverture est regroupée par contrats H1/H2 et par tests paramétrés; aucun compteur de lignes n'est utilisé comme preuve comportementale.
- Écritures live : `NONE`. Aucun Supabase local, aucun Begin/stage/finalize/rollback distant.

## H1 — décision physique

Le profil figé est `global-v2-household@v1` : une génération cohérente par foyer et borne `asOf`, jamais douze publications mensuelles. La génération emploie `FULL_RESTAGE` et interdit les références intergénération. Ce choix est le plus simple qui garantisse activation atomique, rollback complet et absence de reliquat lorsqu'une instance disparaît.

Les tables existantes sont réutilisées :

- `analytics_publications` pour l'identité et l'état de génération ;
- `analytics_artifacts` pour les artifacts analytiques ;
- `analytics_query_snapshots` pour les ReadModels Query validés.

Une seule colonne nullable `analytics_publications.global_manifest jsonb` est préparée. Elle reste compacte : clés attendues, versions, hashes, closures et références externes, jamais les payloads. `dependency_manifest` reste réservé à History V2. Aucun manifeste legacy n'est rétrofabriqué : `NULL` signifie explicitement `LEGACY_UNKNOWN`.

La migration `20260906120000_global_v2_publication_infrastructure.sql` dépend des migrations HC3 puis HC4 déjà réconciliées. Elle n'est pas appliquée live dans P13.

## Profil et manifeste durable

| Contrat | Décision |
|---|---|
| Profile | `global-v2-household@v1` |
| Format | `global-v2-publication-manifest@v1` |
| Contract | `v2`, version resource-specific ensuite |
| Scope | Household Global, `asOf` Instant, `certifiedThrough` LocalDate, `liveThrough` optionnel |
| Restage | `FULL_RESTAGE` |
| Référence intergénération | interdite |
| Resource families gelées | overview, module, exploration, entity detail, methodology |
| Instances exactes | propriétaire P14/P15 ; enregistrées dans les tableaux de clés du même manifeste |
| Hashes | `resourceInputHash`, `publicationFactsHash`, `manifestHash` |
| Closure | une entrée par artifact/query attendu, dépendances Canonical/Fact/Metric/Artifact digérées |
| Implémentation | digest SHA-256 + Git SHA connus obligatoires |

La canonicalisation trie les ensembles, refuse les doublons, les champs inconnus, les clés vides, une closure manquante et toute altération de hash. Les `policyVersions` et `contractVersion` restent propres à chaque ressource ; seule l'identité de publication est commune.

## Publication / visibilité

`GlobalPublicationEngine` implémente séparément :

- visibilité `VISIBLE / PLACEHOLDER / HIDDEN` ;
- classes `CORE_STRUCTURAL / CONDITIONAL_ANALYTIC / OPPORTUNISTIC_INSIGHT` ;
- surfaces `AUTO_GLOBAL / MODULE_DETAIL / EXPLICIT_EXPLORATION` ;
- connaissance, corpus certifié, support, coverage, matérialité, statistique, robustesse temporelle et sélection éditoriale ;
- coverage suffisante à 85 %, partielle de 60 % à moins de 85 %, sans transformer une absence en zéro ;
- placeholders réservés aux gaps récupérables, jamais à une non-matérialité ou à un échec statistique ;
- reason codes normatifs et qualification partielle visible en détail lorsque le contrat l'autorise.

React n'exécute aucune de ces décisions. P14 consommera les décisions publiées et implémentera la sélection éditoriale sans recopier ce moteur.

## Invalidation et révisions

`planGlobalInvalidation()` conserve les causes DATA, lien sémantique, certification, méthode, policy, référence, revue et UI-only. Il est field-aware : une dimension non consommée produit `NO_ACTION`. Un changement de policy produit `REPUBLISH_ONLY`; un changement d'intrant produit `RECOMPUTE`; UI-only ne touche jamais Analytics.

Les déclarations de dépendances A–G restent l'autorité. Le planner ne remplace pas leur closure et n'introduit aucun cycle. La propagation peut s'arrêter lorsqu'un futur job démontre que l'output digest n'a pas changé.

Les quatre révisions conceptuelles restent distinctes : source/fact/analytics/publication. Le schéma existant persiste source et analytics ; les digests de Facts et l'identité de publication sont dans le manifeste et les enveloppes. Aucun job basé sur une ancienne `sourceRevision` ou `baseAnalyticsRevision` ne peut finaliser.

## H2 — workflow et runtime

Le contrat exécutable et le harness local prouvent :

1. Begin d'un DRAFT inactif à révisions capturées ;
2. stage idempotent d'artifacts et snapshots ;
3. refus des clés absentes, en trop ou d'un retry byte-différent ;
4. attach/seal immuable du manifeste ;
5. read-back et concordance clés/versions/hashes ;
6. Finalize atomique avec verrou/révision ;
7. désactivation complète de l'ancienne génération Global V2 ;
8. activation exclusive et residual-key check ;
9. retry de transport idempotent sans réactivation silencieuse ;
10. rollback complet vers une génération publiée, complète et non invalidée ;
11. refus de mutation après seal/publication et refus d'un rollback invalidé.

La migration prépare les RPC `attach_global_v2_manifest`, `publish_global_v2_materialization` et `restore_global_v2_publication`. Ils sont révoqués à `public`, `anon` et `authenticated`, accordés uniquement à `service_role`; `TRUNCATE` et `TRIGGER` restent révoqués. Les quatre triggers et `global_v2_publication_contract()` forment le handshake `global-v2-publication@v1`.

`GlobalGenerationPin` fige `{publicationId, analyticsRevision}` pendant une visite. MISS, invalidation, manifeste incomplet ou signature incompatible produisent un état local fail-closed. Une réponse tardive d'une autre génération est rejetée. Aucun read-through ou calcul analytique à la navigation n'est prévu pour Global V2. Le legacy courant reste inchangé jusqu'au cutover P15.

## Compatibilité et frontières

- History HC3/HC4/HC5 n'est ni généralisé ni modifié : `FROZEN_MONTH` reste un profil mensuel distinct.
- Les neuf ressources Global legacy restent disponibles et ne deviennent pas une autorité V2.
- Les publications existantes avec manifeste absent restent relisibles comme `LEGACY_UNKNOWN`.
- Aucun payload History, aucun snapshot actif et aucune donnée Canonical n'est modifié.
- P14/P15 doivent enregistrer les schemas de payload, versions et instances exactes dans le profil figé, sans créer une seconde infrastructure.
- `PENDING_LIVE_SCHEMA` : application de la migration, handshake et tests live appartiennent à une mission ultérieure explicitement autorisée.

## Preuves exécutées

| Preuve | Résultat |
|---|---|
| P13 publication/invalidation/manifest/runtime | 54/54 PASS |
| SQL PostgreSQL embarqué synthétique | PASS — migration réelle, 4 guards, handshake, grants/revokes |
| History snapshot materialization / HC3 | PASS — gate 82, HC3 100, 13 sensibilités |
| HC4 transactionnel | PASS — 83 checks |
| HC5 correction/cache/rollback | PASS — 160 checks |
| Typecheck | PASS |
| Architecture | PASS — 535 fichiers |
| Build production Next | PASS |
| `git diff --check` | PASS |

Le runtime PostgreSQL des tests est PGlite externe au dépôt avec fixtures synthétiques. Il ne s'agit pas de Supabase local et aucune URL/clé live n'est utilisée.

## Gates

H1_PROFILE_AND_SCHEMA = PASS

H2_INFRASTRUCTURE = PASS

H2_EXACT_RESOURCE_INSTANCES = PENDING_P15

PENDING_LIVE_SCHEMA = YES

IMPLEMENTATION_GATE = PASS

CONTRACT_GATE = PASS

TEST_GATE = PASS

LIVE_GATE = NOT_RUN

LIVE_WRITES = NONE

NEXT_PERMITTED_PROMPT = P14
