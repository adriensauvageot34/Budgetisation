# HC6 — Préflight et dossier POST_HISTORY_ENTRY_GATE

Date : 2026-09-04.

## Statut de cette reprise

**B1 : exécutée extérieurement sur le projet `ipuuhxrblxormwgoaqnz`.
HC3 LIVE CUTOVER = PASS, HC4 LIVE CUTOVER = PASS et DATA DRIFT AFTER DDL =
NONE selon les preuves fournies. Cette reprise documente ces résultats et la
réconciliation locale appliquée ; elle n'effectue aucune écriture live.**

La PHASE A reste COMPLETE. Son arrêt humain ci-dessous est conservé comme
trace du préflight ; l'exécution B1 extérieure et ses contrôles sont enregistrés
en section 10. Aucune autorisation B2 n'est donnée.

**PHASE A COMPLETE — baseline read-only externe et préflight local suffisants
pour demander l'autorisation humaine du DDL et du cutover présenté.**

Ce document ne constitue pas la certification finale History Core.
L'autorisation du DDL vient du prompt humain B1, pas du rapport ; aucune
publication n'est autorisée. Aucun verdict final n'est émis ici.

Sources humaines reçues : « HC6 PHASE A — LIVE BASELINE FOURNIE », puis
« HC6 PHASE A — COMPLÉMENTS READ-ONLY EXTERNES ». Les mesures sont acceptées
comme résultats d'inspections live externes read-only du projet
ipuuhxrblxormwgoaqnz ; aucune nouvelle lecture ni écriture live par l'agent
pour les revalider.

Les anciens points ouverts de drift/owners, de stockage conservé et de
contrats structurels sont clos au niveau requis pour le préflight DDL par
ces compléments et leur rapprochement au code. L'exécution des parsers
TypeScript sur les payloads reste explicitement NOT_RUN_BY_EXTERNAL_SQL :
elle appartient à la certification de PHASE B, pas au préalable du DDL
additif sans réécriture. Justification précise en section 3.

**Arrêt historique de fin A : HUMAN AUTHORIZATION REQUIRED. B1 a depuis été
exécutée extérieurement et certifiée PASS ; B2 reste interdite.**

## 1. BASELINE_PRE_HC6

| Champ | Preuve / état |
| --- | --- |
| Commit de départ | `7c5588ba871d093e41bfbac9c9ad57e409722ed6` |
| Branche | `main` |
| Working tree initial HC6 | CLEAN ; `git status --short` vide |
| Working tree à cette reprise | Deux documents HC6 non suivis, annoncés à la reprise précédente ; aucun changement inexpliqué |
| HC1 / HC2 | PASS, rapports 25 et 26 ; autorités acquises, non réouvertes |
| HC3 | PASS local/contractuel, rapport 27 ; LIVE CUTOVER PASS en B1, section 10 |
| HC4 | PASS local/contractuel, rapport 28 ; LIVE CUTOVER PASS en B1, section 10 |
| HC5 | E2E CONTRACT PASS ; LIVE CUTOVER PROOF PENDING, rapport 29 et checkpoint |
| FINAL_HISTORY_COMMIT | NON DÉCLARÉ : HC6 / cutover non terminés |
| Code, migrations, comportement | Aucun comportement ni octet SQL modifié ; seuls les timestamps des deux fichiers de migration et leurs références exécutables sont alignés en section 10 |
| Modifications locales expliquées | Deux renommages HC3/HC4, trois références de filename, ce rapport et HISTORY-POLISH-BACKLOG.md ; checkpoint local B1 demandé |
| Git à l'entrée du checkpoint | HEAD conservé ; deux documents HC6 non suivis et aucun autre changement inexpliqué |
| Push / déploiement | Aucun |

Instructions lues : prompt HC6 intégral, AGENTS.md, rapports 25–29.
Les sections historiques BLOCKED du rapport 29 sont explicitement remplacées
par sa résolution et son verdict final PASS ; elles ne rouvrent pas HC5.

## 2. Provenance des preuves

La première reprise n'avait pas d'accès serveur utilisable. L'utilisateur
a fourni successivement les mesures actives puis les trois paquets
complémentaires d'inspection SQL externe, déclarés sans aucune écriture.
Ce rapport distingue cette provenance d'une exécution SQL par l'agent.

L'instant précis et les requêtes SQL brutes de capture ne sont pas fournis ;
aucun horodatage, contenu de fonction ou algorithme de fingerprint n'est
inventé. Les attestations externes sont utilisées dans leur portée exacte,
sans prétendre à un diff DDL intégral indépendamment exécuté ici.

Aucun mot de passe, session navigateur, secret, plugin ou accès opérationnel
temporaire créé. Aucun nouveau chantier d'authentification. L'UUID du seul
Household devra être résolu et comparé aux douze publications dans le contexte
serveur autorisé avant toute opération de PHASE B ; aucune identité n'est
déduite d'une fixture synthétique.

## 3. Baseline Supabase AVANT mutation

**Baseline active vérifiée extérieurement et fournie par l'utilisateur.**
Le tableau ne qualifie de vérifiés que les champs effectivement communiqués.

| Mesure obligatoire | État HC6 actuel |
| --- | --- |
| Projet cible | ipuuhxrblxormwgoaqnz — VÉRIFIÉ, source externe fournie |
| Household | 1 ; UUID non communiqué |
| dataRevision | 1 |
| analyticsRevision | 67 |
| HC3 migration live | ABSENT |
| HC4 migration live | ABSENT |
| Autres migrations History déjà présentes | 20260825105100 analytics_materialization ; 20260831094236 history_v2_publication_rollback ; 20260902105811 enforce_single_active_analytics_generation |
| Champs manifest / manifestHash / publicationFactsHash / dependency manifest de analytics_publications | Aucun actuellement |
| Triggers sur analytics_publications / analytics_artifacts / analytics_query_snapshots | Aucun sur chacune des trois tables |
| Owners / RLS des trois tables | postgres ; RLS TRUE sur chacune |
| RPC workflow / helpers de révision et invalidation | postgres, SECURITY DEFINER ; même propriétaire que les tables |
| Grants pré-HC4 | service_role possède TRIGGER/TRUNCATE ; authenticated SELECT sur artifacts/snapshots sous RLS Household |
| Fonctions homonymes HC3/HC4 | Les sept fonctions à créer sont absentes |
| Publications History courantes, fenêtre cible | 12 ; IDs par mois ci-dessous |
| SourceRevision courante | 1 |
| Artifacts History actifs | 24 |
| calendar_semantic_month | 12/12 |
| daily_economic_ledger_month | 12/12 |
| Query snapshots History actifs | 927, nombre mesuré et fourni, non supposé |
| Familles Query présentes | 15/15 ; une seule signature v2 active par famille sur les douze mois |
| Artifacts History courants invalidés | 0 |
| Snapshots History courants invalidés | 0 |
| Duplicate active History query keys | 0 |
| Duplicate active History artifact keys | 0 |
| Stockage History conservé, fenêtre cible | 48 publications published, 96 artifacts, 3648 snapshots ; détail ci-dessous |
| generation_key / contrats / signatures | Identité publication cohérente ; snapshots contractVersion v2 ; unicité de signature par famille attestée, valeurs textuelles des signatures Query non reproduites |
| policyVersions / PublicationMeta / hashes | Cohérence SQL PASS sur 927 snapshots et 24 artifacts, portée détaillée ci-dessous |
| Complétude required keys par publication | PASS ; 927/927 Query et 2/2 artifacts par mois, tableau ci-dessous |
| RuntimeSchemas sur les payloads actuels | Structure SQL PASS ; exécution des parsers TypeScript NOT_RUN_BY_EXTERNAL_SQL, requise en PHASE B |
| Legacy | Anciennes générations conservées sans manifest durable ; formes JSON uniformes par famille, mais aucune certification TypeScript déduite de cette uniformité |

### Publications courantes — identités fournies

| Mois | PublicationId |
| --- | --- |
| 2025-08 | be9f14c3-4ca6-46ca-a091-e83726d29052 |
| 2025-09 | 57b2070e-b8ae-478c-ba90-4c56abd9a974 |
| 2025-10 | 792754b5-4413-48b1-84f2-56f1918a3c5b |
| 2025-11 | 056f1cfe-333c-4789-8d68-f655af912f35 |
| 2025-12 | 8fbaec50-0c78-4404-9e32-94bad3a1072d |
| 2026-01 | da8bfdfb-ba89-4bef-b88e-47f50b0ebf12 |
| 2026-02 | 8bc54f7d-c0cb-4e8f-8172-32b02370b47b |
| 2026-03 | 93a252d7-6754-4b08-a38a-9158dee3bcbc |
| 2026-04 | 354e78be-7a7f-442e-b21a-8217be3359b0 |
| 2026-05 | ff0a6983-c77d-444a-aafe-580eb8d0d0e0 |
| 2026-06 | f986d524-0c89-48ea-a6a3-62693c26e7f5 |
| 2026-07 | ecff5327-2a15-4e27-b247-3a4a91bcc4d1 |

Contrôle local de transcription : douze mois distincts couvrant la fenêtre,
douze UUID valides/distincts, 12 + 12 = 24 artifacts. Ce contrôle ne relit pas
la base et n'est pas un test RuntimeSchema de payload.

### Stockage conservé avant DDL — périmètres séparés

| Périmètre | Publications | Statuts publications | Artifacts | Snapshots |
| --- | --- | --- | --- | --- |
| History V2, 2025-08 → 2026-07 | 48 | 48 published, 0 failed | 96 = 24 actifs + 72 inactifs | 3648 = 927 actifs + 2721 inactifs |
| Store Analytics complet | 67 | 64 published, 3 failed | 7152 | 5592 |

Les publications courantes History sont les douze IDs ci-dessus. Published
ne signifie pas active : les autres générations restent conservées.
Les lignes actives invalidées et les doublons de clés sont à zéro selon
la baseline fournie. Les comptages globaux ne remplacent pas ceux de History.

PUBLICATIONS BEFORE = 67 ; ARTIFACTS BEFORE = 7152 ;
SNAPSHOTS BEFORE = 5592 pour le store entier.
HISTORY PUBLICATIONS BEFORE = 48 ; HISTORY ARTIFACTS BEFORE = 96 ;
HISTORY SNAPSHOTS BEFORE = 3648 pour la fenêtre ciblée.
ACTIVE HISTORY PUBLICATIONS BEFORE = 12 ;
ACTIVE HISTORY ARTIFACTS BEFORE = 24 ;
ACTIVE HISTORY SNAPSHOTS BEFORE = 927.
Les actifs hors History ne sont pas déduits de ces mesures.

Aucun AFTER mesuré : aucune mutation HC6. 927 est une baseline d'actifs,
pas le total de stockage ni le nombre imposé aux futures générations.

### Fingerprints pré-DDL fournis — à conserver exactement

| Périmètre | Publications | Artifacts | Snapshots |
| --- | --- | --- | --- |
| History V2, fenêtre cible | 26650ea06f70db59b5a5d391f0720756 | 77d134ba5be963289bff89232f050975 | d5a590d5764c190f3830368275e8c6c5 |
| Analytics complet | 947c2b83ad80b6e04e879781c1c9931a | d1fbcde62f9ea110b78263bcc567d5c6 | 2eb179f64b385592602c78ad905becc5 |

Valeurs opaques reproduites à l'identique : l'algorithme et les requêtes de
calcul n'ont pas été fournis. Ne pas les rebaptiser MD5/SHA-256, les compléter,
ni les substituer aux factsHash métier. Elles ne sont pas recalculées ici.

Après HC3, puis après HC4 et avant tout rebuild, l'opérateur doit reprendre
la même recette read-only : périmètre, projection de colonnes, sérialisation
et ordre identiques. L'égalité des six empreintes et des comptages est
attendue en l'absence de mutation concurrente.

Attention à la comparaison de publications après ADD COLUMN : une recette
basée sur to_jsonb(row.*) inclurait alors dependency_manifest=NULL.
Comparer la projection pré-DDL inchangée et contrôler séparément que la
nouvelle colonne est NULL partout. Ne pas modifier les valeurs attendues
pour faire disparaître une différence. Si la recette externe n'est pas
reproductible, la retrouver avant exécution du DDL ; aucun fingerprint
non comparable ne doit être présenté comme une preuve d'immutabilité.

### Drift, owners et sécurité — preuves externes reçues

- analytics_publications, analytics_artifacts et analytics_query_snapshots :
  owner postgres et RLS enabled TRUE.
- publish_analytics_materialization, restore_history_v2_publication,
  record_analytics_mutation, private.bump_household_data_revision,
  private.bump_revision_and_log, private.record_analytics_change et
  private.invalidate_analytics_materialization : owner postgres,
  SECURITY DEFINER.
- La condition critique HC4 est donc fermée : les workflows s'exécutent
  comme le propriétaire des tables. Ce n'est pas une inférence depuis les
  seuls comptages ; les owners et SECURITY DEFINER sont explicitement attestés.
- service_role dispose actuellement de TRIGGER et TRUNCATE sur les trois
  tables : état pré-HC4 attendu ; HC4 doit retirer ces droits.
- authenticated possède SELECT sur artifacts/snapshots sous RLS
  membership Household. Il s'agit d'un accès préexistant, pas d'une nouvelle
  permission accordée par HC3/HC4. Ne pas déclarer « aucun SELECT navigateur ».
- Les sept fonctions HC3/HC4 sont absentes : history_manifest_canonical_json,
  guard_history_v2_dependency_manifest, attach_history_v2_dependency_manifest,
  is_history_v2_publication, guard_history_v2_frozen_publication,
  guard_history_v2_frozen_content, history_v2_frozen_publication_contract.
- Historique live pertinent : 20260825105100 analytics_materialization,
  20260831094236 history_v2_publication_rollback,
  20260902105811 enforce_single_active_analytics_generation ; HC3/HC4 absentes.

Le rollback est nommé localement 20260831150000_history_v2_publication_rollback.sql,
mais enregistré live sous 20260831094236. Cette différence d'identifiant
d'historique est conservée, pas « réparée » : ne pas réappliquer le fichier
local de rollback. Elle ne démontre pas à elle seule une différence de corps
SQL. Seules les deux migrations HC3/HC4 sont candidates au DDL demandé.
Les corps SQL live complets ne sont pas reproduits dans la preuve externe ;
aucune égalité byte-for-byte avec les fichiers locaux n'est revendiquée.

### Complétude physique actuelle par mois

| Mois | Required Query / présentes | Artifacts requis / présents |
| --- | --- | --- |
| 2025-08 | 75/75 | 2/2 |
| 2025-09 | 72/72 | 2/2 |
| 2025-10 | 78/78 | 2/2 |
| 2025-11 | 77/77 | 2/2 |
| 2025-12 | 78/78 | 2/2 |
| 2026-01 | 81/81 | 2/2 |
| 2026-02 | 75/75 | 2/2 |
| 2026-03 | 77/77 | 2/2 |
| 2026-04 | 79/79 | 2/2 |
| 2026-05 | 79/79 | 2/2 |
| 2026-06 | 79/79 | 2/2 |
| 2026-07 | 77/77 | 2/2 |
| Total | 927/927 | 24/24 |

Sur 927/927 snapshots actifs : generation_key=publicationId,
contractVersion=v2, PublicationMeta.publicationId/revision/contractVersion
cohérents, factsHash et resourceInputHash au format SHA-256, policyVersions
cohérents. Sur 24/24 artifacts : generation_key, artifactInputHash SHA-256,
PublicationMeta et factsHash cohérents. Un seul factsHash partagé par les
snapshots/artifacts de chaque publication.

Les quinze familles ont chacune une seule signature v2 active sur les douze
mois ; forme top-level JSON et PublicationMeta uniforme par famille.
Artifacts observés : calendar_semantic_month, contract v2,
calendar_semantic_month@v4, 12/12 ; daily_economic_ledger_month,
contract v2, daily_economic_ledger_month@v1, 12/12.
Ces observations SQL ne recalculent pas la vérité économique ni les closures.

Sémantique de révision observée, compatible avec le stage local :
row.analytics_revision = publication.base_analytics_revision ;
payload.PublicationMeta.revision = publication.published_analytics_revision.
La ligne porte la révision de départ, le payload celle de publication.
Cette différence est attendue ; aucun restamp ni correctif de données.

L'absence de champ manifest dans analytics_publications n'implique donc
pas l'absence de PublicationMeta/factsHash dans les payloads.
Le lecteur de manifest est actuellement SCHEMA_NOT_READY ; après HC3 les
anciennes lignes seront NULL / LEGACY_UNKNOWN, sans rétrofit de preuve.

LIVE STORAGE CONTRACTS = PASS
LIVE METADATA COHERENCE = PASS
LIVE REQUIRED-KEY COMPLETENESS = PASS
LIVE RUNTIME-SCHEMA STRUCTURAL EVIDENCE = PASS
TYPESCRIPT RUNTIME-SCHEMA PARSER EXECUTION = NOT_RUN_BY_EXTERNAL_SQL

### Décision locale : TypeScript requis en PHASE B, pas avant le STOP humain

La dernière consigne demande explicitement de classer ce sous-point.
**L'exécution des parsers TypeScript sur les 927 anciens payloads n'est pas
indispensable avant le DDL HC3/HC4 ; elle ne bloque plus PHASE A.**

Preuves dans les fichiers inchangés :
1. HC3 ajoute une colonne nullable sans DEFAULT ni backfill et installe un
   trigger. L'installation ne parcourt pas les anciens payloads pour les
   convertir ou les valider. Sa validation de publication se déclenche lors
   d'un futur UPDATE draft → published, pas lors de CREATE TRIGGER.
2. HC4 crée des fonctions/triggers et retire deux privilèges ; aucune ligne
   historique n'est modifiée à l'installation. Ses UPDATE d'actifs sont dans
   le corps du trigger du futur Finalize, non exécuté pendant PHASE A/DDL.
3. Ni RuntimeSchema ni contrat de ReadModel ni code du lecteur Query ne
   change dans ces migrations. La lecture snapshot-only et les parsers
   TypeScript actuels restent en place ; aucun parser n'est assoupli.
4. Pour une nouvelle génération, history-rebuild.ts valide le certificat et
   stageHistoryV2GenerationInMemory avant Begin, puis valide/reconstruit et
   relit avant finalizeHistoryPublication. executeQuery valide les données
   et l'enveloppe avant de répondre.

En PHASE B, exécuter les parsers compatibles sur les anciennes générations
courantes conservées pour établir la baseline de lecture/rollback, puis
certifier exhaustivement les douze nouvelles générations avant activation,
et revalider les payloads réellement servis après publication.
Un échec bloque le gate de publication/lecture concerné : ne pas patcher
l'ancien payload, ne pas transformer la preuve SQL en PASS TypeScript.

Aucune affirmation « RuntimeSchemas = 100 % » sur les payloads live n'est
faite ici. Les PASS structurels externes, les tests locaux acquis et la
certification exhaustive future restent trois niveaux de preuve distincts.

## 4. Migrations exactes relues intégralement — état historique PHASE A

| Ordre | Migration dans Git | SHA-256 des octets du fichier local inspecté |
| --- | --- | --- |
| 1 | 20260904120000_history_v2_dependency_manifest.sql | C98CAE1AE149296D3A46BE49BEC5AF83CECEBA752AC22ECC94A2A51EFC25D789 |
| 2 | 20260904180000_history_v2_frozen_publications.sql | 6F20E7685B154C8D6499F166826097BFEE34C222FD7D895D7E91E5F0F71EFE51 |

Ces empreintes identifient les fichiers inspectés, pas une application live.
Ordre obligatoire : **HC3 → HC4**.

Elles ont été recalculées pendant cette reprise et sont inchangées.
La baseline externe confirme l'absence des deux migrations, de la colonne
manifest et des triggers sur les trois tables. Cela ferme le contrôle de
présence de ces éléments précis. Les owners, privilèges, homonymes et
contrats structurels sont désormais couverts par les compléments externes
ci-dessus, sans inventer un diff intégral des définitions live.

### HC3 — objets et comportement

- Ajoute uniquement `analytics_publications.dependency_manifest JSONB`,
  nullable, sans valeur par défaut ni backfill. Aucune nouvelle table.
- Crée `history_manifest_canonical_json(jsonb)`,
  `guard_history_v2_dependency_manifest()` et
  `attach_history_v2_dependency_manifest(uuid,uuid,jsonb)`.
- Installe `history_v2_dependency_manifest_guard` BEFORE INSERT/UPDATE sur
  analytics_publications. Les contraintes nouvelles sont des gardes de trigger,
  pas des CHECK/FK/index ajoutés.
- Valide format `history-v2-dependency-manifest@v2`, scope, implementation,
  checksum, 15 familles, cardinalités, versions et correspondance des payloads.
- Limite de taille : 2 000 000 octets ; le format JSONB texte SQL peut être plus
  grand que le JSON compact local, à mesurer sur les vrais manifests.
- Attachement verrouillé, uniquement au DRAFT ; réessai identique sans mutation.
  Manifest différent ou ajout rétroactif à une publication historique refusé.
- Finalize History sans manifest, avec contenu incomplet ou incohérent refusé
  dans la transaction existante. Les générations déjà publiées ne sont pas
  réécrites à l'installation.
- Fonctions retirées à PUBLIC/anon/authenticated ; seule la RPC d'attachement
  est accordée à service_role. RLS/grants des tables inchangés.

### HC4 — objets et comportement

- Crée `is_history_v2_publication(uuid)`,
  `guard_history_v2_frozen_publication()`,
  `guard_history_v2_frozen_content()`,
  `history_v2_frozen_publication_contract()`.
- Installe les triggers `history_v2_frozen_publication_guard`,
  `history_v2_frozen_artifact_guard`, `history_v2_frozen_snapshot_guard`.
- Les trois tables concernées restent analytics_publications,
  analytics_artifacts, analytics_query_snapshots ; aucune colonne, FK, CHECK,
  table ou index supplémentaire dans HC4.
- Le contenu et l'identité staged/published sont gelés ; seule la mutation
  technique de is_active/invalidated_at/invalidation_revision par workflow
  autorisé reste possible. DELETE History refusé.
- Le stage exige un DRAFT jamais publié, non scellé, des clés requises,
  métadonnées/identités concordantes et des lignes inactives non invalidées.
- Au futur Finalize, désactive aussi les anciennes clés History absentes de la
  nouvelle génération, dans la même transaction. Ce code est dans un trigger :
  **aucun UPDATE historique n'est exécuté lors de l'installation HC4**.
- Retire TRUNCATE et TRIGGER à service_role sur les trois tables.
  Aucun nouveau droit navigateur ; les autres droits existants sont conservés.
- Le handshake read-only exige les quatre triggers HC3/HC4 activés et renvoie
  `history-frozen-month@v1`.
- HC4 dépend de la colonne et du trigger HC3. Les guards sont SECURITY INVOKER ;
  les mutations techniques des RPC SECURITY DEFINER doivent s'exécuter comme
  le propriétaire des tables. La preuve externe owner postgres / SECURITY
  DEFINER sur les workflows ferme désormais cette condition.

### Additivité, reprise et réversibilité

Les deux fichiers sont entourés de BEGIN/COMMIT. Aucun reset, DROP de table,
DELETE de données ou UPDATE de payload lors de leur exécution. Les fonctions
Finalize/rollback existantes ne sont pas remplacées par HC3/HC4.

Les migrations **ne sont pas des scripts DDL idempotents** : ADD COLUMN et
CREATE FUNCTION/TRIGGER sans IF NOT EXISTS. Une réapplication sur un schéma
déjà installé échouerait. Après erreur ou résultat réseau incertain, relire
historique et catalogues ; ne pas rejouer aveuglément. L'exécuteur de migration
doit préserver la transaction et enregistrer l'historique. Une anomalie
d'installation partielle exige diagnostic et validation, pas un patch live ad hoc.

Rollback des publications : RPC existante
`restore_history_v2_publication`, uniquement vers une cible complète,
compatible et non invalidée. Pas de réécriture ni de rétrofit. Une ancienne
génération sans manifest reste LEGACY_UNKNOWN ; la colonne absente est
SCHEMA_NOT_READY, distinct d'une publication connue avec NULL.

Rollback du schéma : aucune migration down fournie. Retirer explicitement
les guards révoquerait la garantie ; supprimer la colonne détruirait les
nouvelles preuves. Cela exige un plan DDL et une autorisation séparés.
Un rollback de publication n'implique jamais de désinstaller HC3/HC4.

## 5. Preuves locales de sûreté et limites

Fichiers relus pour cette préparation : les deux migrations HC3/HC4,
la version du finalizer dans
`20260902105811_enforce_single_active_analytics_generation.sql`,
le rollback `20260831150000_history_v2_publication_rollback.sql`,
`history-rebuild.ts`, `history-manifest-store.ts`,
`scripts/lib/build-history-month.mjs`, le producteur de certification
(entrées, fenêtre, autorités), le chemin store.readQuery et executeQuery.

| Propriété | Preuve disponible | Limite |
| --- | --- | --- |
| Installation sans réécriture | SQL HC3/HC4 inchangé ; objets absents, owners workflow/tables conformes selon preuve externe | Recontrôle des six fingerprints après chaque DDL |
| Legacy sans preuve fabriquée | Guard HC3 + lecteur ; 48 générations History conservées et fingerprints externes | Pas de manifest rétroactif ; parsers compatibles à exécuter en PHASE B |
| Stage nouveau UUID / freeze | buildHistoryMonth + guards HC4 | Non exécuté live |
| Manifest durable relisible | Parser historyV2DependencyManifestSchema et read-back du store | Taille des vrais manifests non mesurée |
| Finalize atomique / échec tardif | RPC versionnée + tests SQL HC4 documentés, E2E HC5 récent | Pas de nouvelle transaction live |
| Rollback opérationnel permis | Scénario B HC5, distinct d'une correction | Éligibilité de vraies cibles non vérifiée |
| Rollback invalidé refusé | Scénario A HC5, avant/après P2 | Aucune correction utilisateur provoquée |
| Snapshot-only / fail-closed | store.readQuery puis executeQuery avec matérialisation câblée | Aucun smoke HTTP live exécuté |
| RuntimeSchema obligatoire | validateQueryData et createApiResponseSchema ; structure SQL actuelle PASS | Parsers TypeScript NOT_RUN_BY_EXTERNAL_SQL, requis en PHASE B |
| Cache lié à la génération | HC5 : même session, ancienne réponse tardive et ancien RSC refusés | Signal live non interrogé |

HC1–HC5 ne sont pas réaudités ni modifiés. Aucune contradiction structurelle
démontrée dans cette inspection. Le dossier DDL est suffisant pour demander
l'autorisation humaine, mais ne préjuge pas de la future certification
exhaustive ou de l'état de la base si elle change après la capture fournie.

### Tests acquis, distingués des exécutions HC6

- Checkpoint HC5 immédiatement précédent, sur les mêmes sources : typecheck
  PASS ; HC5 principal **160/160 PASS**, comprenant les scénarios A/B et les
  courses de cache. Import automatique : 79 matérialisation, 100 HC3,
  20 HC4 contractuels. Aucune écriture live.
- Rapport 29 : HC4 PostgreSQL embarqué **83 PASS**, autres suites,
  architecture et build PASS ; preuves du run d'implémentation antérieur,
  pas des tests relancés pendant HC6.
- HC6 présent : contrôles Git, vérification de la baseline, lecture des
  migrations et du code, empreintes SQL, intégration des mesures externes et
  contrôle local de cohérence des douze mois/UUID, de la somme des required
  queries (927) et des comptages actifs/inactifs/totaux. Ces contrôles
  documentaires ne sont ni des appels live ni des tests de payload.
- Aucun code changé ; aucune suite longue relancée inutilement. Aucune
  certification douze mois ni validation RuntimeSchema de payload live
  exécutée dans cette reprise documentaire. Aucun résultat antérieur n'est
  présenté comme une certification des douze mois actuels à ce HEAD.

## 6. Procédure exacte préparée — INACTIVE, AUTORISATION HUMAINE REQUISE

HISTORICAL PHASE-A/B1 BLOCKAGE — RESOLVED : lors de la PHASE A, l'absence
d'accès empêchait l'agent d'exécuter le premier DDL. B1 a depuis été exécutée
extérieurement et certifiée PASS (section 10). La certification, le rebuild,
le stage, Finalize et tout rollback live décrits ci-dessous restent un plan B2
non autorisé.

Cette procédure est inactive. Les IDs courants, révisions 1/67, comptages
actifs 12/24/927, stockage historique/global, fingerprints, owners et contrats
structurels sont renseignés. Le dossier est prêt pour l'arrêt humain.
La déclaration COMPLETE concerne le préflight, pas le cutover ni les parsers
TypeScript encore non exécutés.
Une autorisation de migration seule n'autorise pas implicitement
rebuild/finalize/rollback ou déploiement.

1. Conserver les mesures externes et les six empreintes de référence. Avant
   exécution autorisée, reprendre la même recette de fingerprints, résoudre
   le Household exact depuis les douze publications, contrôler qu'aucune
   mutation concurrente n'a rendu la baseline obsolète et enregistrer le
   checkout opérateur propre. Ne pas inclure d'export privé dans Git.
2. Présenter le SQL exact, les écarts éventuels et les opérations suivantes ;
   **STOP HUMAN AUTHORIZATION REQUIRED**. Aucune suite automatique.
3. Après autorisation précise seulement : appliquer HC3. Vérifier historique,
   colonne/type/nullabilité, trois fonctions, trigger activé, grants/owners,
   mêmes comptages/actifs/contenus ; anciennes publications toujours NULL.
   Erreur ou divergence : STOP, ne pas appliquer HC4.
4. Appliquer HC4. Vérifier historique, quatre fonctions, trois nouveaux
   triggers, les quatre guards activés, droits TRUNCATE/TRIGGER retirés,
   owners SECURITY DEFINER compatibles, handshake exact. Recontrôler tout le
   stockage, les anciennes générations, les flags actifs et les empreintes.
   Erreur : STOP, aucun rebuild.
5. Enregistrer la baseline post-migration/pre-rebuild ; dataRevision et
   analyticsRevision doivent rester inchangées du seul fait du DDL.
   Exécuter ensuite la validation TypeScript des anciens payloads conservés
   avec leurs variantes compatibles, comme prévu en section 3, sans mutation.
6. Depuis un checkout enregistré propre, obtenir un export Canonical
   read-only cohérent et une source EXPECTED utilisée seulement pour comparer.
   Exécuter explicitement :
   `node scripts/check-history-v2-certification-12-months.mjs <export> <expected-vs-engine-final.json> <sortie-privee>`
   sans --publication-only et sans --month pour le gate exhaustif.
   Toutes les douze cibles et quinze familles, les parsers RuntimeSchemas,
   les invariants/qualités, réconciliations, closures et hashes doivent passer
   avant toute nouvelle activation.
   Aucune valeur oracle ne produit un payload ; aucun EXPECTED/hash ajusté
   pour masquer un écart. Arrêter au premier échec structurel ou de données.
7. Préparer les nouvelles générations avec les primitives existantes :
   `produceCertifiedHistoryMonth` / producteur HC1–HC2,
   `validateHistoryMonthBuild`, `buildHistoryMonth`.
   Nouveau UUID, stage par petites écritures inactives, manifest attaché,
   validation des payloads/schemas/digests, read-back complet.
8. **Ordonnancement sûr : stage/finalize séquentiels par mois.**
   Préconstruire/certifier les douze mois sans écriture est possible, mais
   ne pas sceller douze DRAFT avec le même baseAnalyticsRevision :
   le premier Finalize incrémente la révision Household et les suivants
   échoueraient au CAS. Relire contexte/révisions avant chaque mois ; obtenir
   un export/certificat cohérent avec ce contexte si le producteur l'exige.
   Ne jamais restamper le DRAFT scellé ou son manifest pour contourner le CAS.
   Si la source change, arrêter et recertifier depuis la source actuelle.
9. `finalizeHistoryPublication` revérifie preuve, contenu, manifest durable,
   contexte et stockage avant la RPC atomique existante. Ancienne génération
   intacte et active jusqu'au switch si elle est encore admissible. Mesurer
   révisions, active set exact, required keys et absence de reliquats après
   chaque réussite. Échec : aucune activation partielle, aucune réparation
   manuelle de payload/flag ; nouvelle génération si nécessaire.
10. Relire les douze publications finales, tous artifacts/snapshots,
    RuntimeSchemas compatibles, manifests/hashes recalculables, contracts,
    methodSignatures/policyVersions et empreintes des anciennes générations.
    Comptages exacts avant/après ; 927 est le nombre initial mesuré,
    jamais une contrainte artificielle sur le nombre final de snapshots.
11. Smoke strictement read-only du runtime câblé : /historique, plusieurs mois,
    Calendar/Week/Journal/Bilan M1–M4 et détails réellement atteignables.
    Vérifier /api/query, les snapshots actifs, zéro read-through, et le signal
    HC5 identique à l'actif. Aucun chantier UI. Un éventuel test de rollback
    live doit être explicitement autorisé, jamais déclenché par le smoke.
12. Finaliser rapport, backlog, tests et checkpoint propre ; déclarer
    FINAL_HISTORY_COMMIT puis seulement évaluer le POST_HISTORY_ENTRY_GATE.

Atomicité : **par mois/publication, jamais atomique pour les douze mois**.
La coexistence temporaire de mois sur anciennes/nouvelles générations est
documentée, pas dissimulée derrière une fausse transaction globale.

### Contrôles post-HC3 détaillés — protocole historique exécuté en B1

- Source préparée 20260904120000 appliquée byte-for-byte et version live
  20260904110151 enregistrée ; HC4 était encore absente à ce point du run B1.
- dependency_manifest JSONB nullable, sans DEFAULT ; trois fonctions HC3
  exactes, trigger history_v2_dependency_manifest_guard activé.
- Aucun ancien manifest rempli : toutes les lignes préexistantes conservent
  NULL. Lecture via SupabaseHistoryManifestStore = LEGACY_UNKNOWN pour ces
  publications, et non une preuve de closure fabriquée.
- Aucun changement aux révisions, aux douze IDs courants, aux 24 artifacts
  actifs, aux 927 snapshots actifs, à leurs payloads/hashes/timestamps, ni aux
  générations historiques recensées. Recontrôler les totaux History
  48/96/3648, les totaux Analytics 67/7152/5592 et les six fingerprints
  par projection identique ; contrôler séparément dependency_manifest NULL. Sous absence de mutation concurrente,
  les révisions attendues sont toujours dataRevision=1, analyticsRevision=67.
- Vérifier les owners/grants/RLS et l'absence de droit d'attachement navigateur.
  Ne pas tester un refus en modifiant réellement une publication historique.
  Les essais destructifs restent dans les tests synthétiques déjà acquis.

### Contrôles post-HC4 détaillés — protocole historique exécuté en B1

- Source préparée 20260904180000 appliquée byte-for-byte et version live
  20260904110402 enregistrée après HC3 ; trois triggers HC4 ajoutés,
  donc quatre guards attendus avec HC3, tous activés.
- Quatre fonctions HC4 conformes ; owners et rôles compatibles ; handshake
  read-only renvoyant history-frozen-month@v1.
- service_role n'a plus TRUNCATE/TRIGGER sur les trois tables ; accès
  opérationnel voulu conservé, aucun accès navigateur ajouté. SELECT
  authenticated préexistant sur artifacts/snapshots reste sous RLS Household.
- Même état des données/actifs/hashes et révisions qu'après HC3 : aucune
  activation/désactivation induite par le DDL. Tous les historiques conservés.
  Refaire les six fingerprints avec la même recette, les totaux History
  48/96/3648 et Analytics 67/7152/5592, avant tout rebuild.
- Prouver la lecture des générations legacy avec leurs contrats compatibles
  sans rétrofit ; préparer le stage uniquement par le pipeline HC4 certifié.
- Si un de ces contrôles échoue : STOP avant build/stage/finalize ; aucun
  contournement des guards, aucun patch manuel de la base.

### Résultats futurs à mesurer, sans les préannoncer

Si la source reste à 1 et si exactement douze Finalize nouveaux réussissent
sans opération concurrente, la révision Analytics passera de 67 à 79.
C'est une prévision arithmétique, pas une mesure live ni une valeur à forcer.
Les anciennes générations restent stockées ; les nouveaux UUID sont alloués
par Begin. Le nombre final de snapshots dépend des instances atteignables
du nouveau manifest, pas du nombre initial 927.

## 7. Risques et opérations non encore exécutées

- Les conditions de sécurité fournies sont suffisantes pour le préflight.
  La baseline est une capture, pas un verrou de la base ; une mutation ou un
  changement de rôle concurrent impose un contrôle avant l'opération concernée.
- DDL additif nécessite des verrous : fenêtre opérationnelle et concurrence
  doivent être contrôlées avant application.
- Après HC3, un ancien writer ne fournissant pas de manifest ne peut plus
  publier History ; après HC4, un writer UPSERTant un contenu scellé est refusé.
- Taille des manifests réels, données historiquement absentes et éventuels
  écarts des autorités actuelles avec EXPECTED restent à certifier.
- Une génération legacy peut être lisible sans avoir de manifest ; cela ne
  constitue pas une preuve de dependency closure rétroactive.
- Aucun déploiement applicatif ni configuration Vercel modifiés. Le smoke
  devra identifier explicitement le code runtime déployé ; un test local ou
  un succès SQL ne vaut pas preuve navigateur/production.
- Le cutover des douze mois n'est pas commencé ; aucun rebuild/stage/finalize,
  rollback ou export de données privées par l'agent. Seule l'inspection
  read-only externe déclarée par l'utilisateur alimente la baseline live.
- Aucune vraie donnée Canonical, publication, artifact ou snapshot modifié.

## 8. Séparation History Core / History Product

Le backlog associé est `docs/history-v2/HISTORY-POLISH-BACKLOG.md`.
Ce sont des reports, pas des bugs constatés par un nouveau smoke.
History Core prêt pour l'audit Global ne signifiera pas History produit parfait.
Aucune conclusion de readiness Global n'est encore émise.

AUCUN SUJET GLOBAL N'A ÉTÉ IMPLÉMENTÉ.
AUCUN POLISH CALENDAR N'A ÉTÉ TRAITÉ.

## 9. Décision PHASE A — trace de l'arrêt humain avant autorisation B1

L'audit des migrations locales inchangées et les deux livraisons externes
read-only ferment le préflight pour demander l'autorisation humaine.
Les parsers TypeScript non exécutés sont classés explicitement en PHASE B,
sans inventer un PASS ni déroger aux RuntimeSchemas.

HISTORICAL PHASE-A PLAN — EXÉCUTÉ EXTÉRIEUREMENT EN B1

1. source préparée `20260904120000_history_v2_dependency_manifest`,
   enregistrée live `20260904110151` ;
2. source préparée `20260904180000_history_v2_frozen_publications`,
   enregistrée live `20260904110402`.

ORDRE : HC3 → contrôle HC3 → HC4 → contrôle HC4.

La demande porte séparément sur ces migrations et sur les opérations
ultérieures décrites en section 6 : certification read-only, nouvelles
générations mensuelles, stage inactif, finalize séquentiel et contrôles live.
Une autorisation partielle sera respectée comme telle. Aucune opération
d'écriture ou de déploiement n'est autorisée par la simple fourniture
de la baseline.

HEAD = 7c5588ba871d093e41bfbac9c9ad57e409722ed6
BRANCH = main
FINAL_HISTORY_COMMIT = NOT_DECLARED

Seul le rapport 30 est mis à jour dans cette reprise ; backlog conservé.
Les deux documents HC6 restent non suivis, pas de commit/push ni baseline
Global finale déclarée. Aucun code, schéma local, migration ou donnée changé.

HC6 PHASE A = COMPLETE
LIVE BASELINE = VERIFIED
LIVE WRITES = NONE

STOP
HUMAN AUTHORIZATION REQUIRED

Aucun verdict final produit à cet arrêt. L'autorisation reçue ensuite et
l'état d'exécution effectif sont décrits ci-dessous.

## 10. HC6 B1 — cutover live exécuté extérieurement et certifié

Autorité : résultats d'exécution live fournis par l'utilisateur après application
externe des deux fichiers SQL exacts sur le projet
`ipuuhxrblxormwgoaqnz`. Cette reprise n'a effectué ni nouvelle lecture ni
écriture Supabase. Les résultats ci-dessous sont enregistrés comme preuve B1
fournie ; B2 reste interdite.

### 10.1 SQL appliqué et historique live

| Lot | Source SQL appliquée en B1 | Fichier local aligné | SHA-256 validé | Version enregistrée live | Statut |
| --- | --- | --- | --- | --- | --- |
| HC3 | `20260904120000_history_v2_dependency_manifest.sql` | `20260904110151_history_v2_dependency_manifest.sql` | `C98CAE1AE149296D3A46BE49BEC5AF83CECEBA752AC22ECC94A2A51EFC25D789` | `20260904110151` / `history_v2_dependency_manifest` | PASS |
| HC4 | `20260904180000_history_v2_frozen_publications.sql` | `20260904110402_history_v2_frozen_publications.sql` | `6F20E7685B154C8D6499F166826097BFEE34C222FD7D895D7E91E5F0F71EFE51` | `20260904110402` / `history_v2_frozen_publications` | PASS |

Les versions `20260904110151` et `20260904110402` sont les identifiants
enregistrés par l'outil Supabase. Elles prouvent l'ordre HC3 puis HC4 ; elles ne
sont pas présentées comme des `applied_at` indépendants, cette valeur n'ayant
pas été fournie séparément. Le SQL appliqué est byte-for-byte celui des fichiers
locaux identifiés par les deux SHA-256. La table `supabase_migrations` ne doit
plus être modifiée pour ce rapprochement.

### 10.2 Contrôles post-HC3

- `analytics_publications.dependency_manifest` : `jsonb`, nullable, sans
  valeur par défaut.
- Publications préexistantes : 67 ; `dependency_manifest IS NULL` : 67 ;
  non-NULL : 0.
- Aucun retrofit et aucune preuve fabriquée rétroactivement.
- `history_v2_dependency_manifest_guard` : PRESENT / ENABLED.
- Révisions, lignes Analytics/History, actifs et fingerprints : inchangés
  selon la matrice de drift en 10.4.

### 10.3 Contrôles post-HC4

- Les quatre guards HC3 + HC4 sont PRESENT / ENABLED :
  `history_v2_dependency_manifest_guard`,
  `history_v2_frozen_publication_guard`,
  `history_v2_frozen_artifact_guard`,
  `history_v2_frozen_snapshot_guard`.
- Handshake : `history-frozen-month@v1` = PASS.
- `service_role` ne possède plus `TRIGGER` ni `TRUNCATE` sur
  `analytics_publications`, `analytics_artifacts` et
  `analytics_query_snapshots`.
- Aucun rebuild, stage, finalize, rollback ou write métier n'a été exécuté.

### 10.4 Absence de drift après DDL

| Contrôle | Avant B1 | Post-HC3 | Post-HC4 | Verdict |
| --- | --- | --- | --- | --- |
| dataRevision | 1 | 1 | 1 | IDENTIQUE |
| analyticsRevision | 67 | 67 | 67 | IDENTIQUE |
| Publications / artifacts / snapshots History stockés | 48 / 96 / 3648 | 48 / 96 / 3648 | 48 / 96 / 3648 | IDENTIQUE |
| Publications / artifacts / snapshots History actifs | 12 / 24 / 927 | 12 / 24 / 927 | 12 / 24 / 927 | IDENTIQUE |
| Artifacts actifs invalidés | 0 | 0 | 0 | IDENTIQUE |
| Snapshots actifs invalidés | 0 | 0 | 0 | IDENTIQUE |
| Doublons actifs Query / artifact keys | 0 / 0 | 0 / 0 | 0 / 0 | IDENTIQUE |
| Fingerprint History publications | `26650ea06f70db59b5a5d391f0720756` | identique | identique | PASS |
| Fingerprint History artifacts | `77d134ba5be963289bff89232f050975` | identique | identique | PASS |
| Fingerprint History snapshots | `d5a590d5764c190f3830368275e8c6c5` | identique | identique | PASS |
| Fingerprint Analytics publications | `947c2b83ad80b6e04e879781c1c9931a` | identique | identique | PASS |
| Fingerprint Analytics artifacts | `d1fbcde62f9ea110b78263bcc567d5c6` | identique | identique | PASS |
| Fingerprint Analytics snapshots | `2eb179f64b385592602c78ad905becc5` | identique | identique | PASS |

Les douze `publicationId` actifs restent ceux de la baseline de la section
3. Les 24 artifacts et 927 snapshots actifs restent valides ; les familles
Query restent 15/15 et les artifacts partagés restent 12/12
`calendar_semantic_month` et 12/12 `daily_economic_ledger_month`.

`DATA DRIFT AFTER DDL = NONE` est donc acquis sur la preuve externe fournie.
Cette preuve ne vaut pas exécution des parsers TypeScript sur les payloads :
`TYPESCRIPT RUNTIME-SCHEMA PARSER EXECUTION = NOT_RUN_BY_EXTERNAL_SQL`.
Cette exécution et le rebuild appartiennent à B2, qui n'est pas commencé.

### 10.5 Audit ciblé de la divergence des versions de migration

État observé :

| Élément | HC3 | HC4 |
| --- | --- | --- |
| Ancien timestamp du fichier local | `20260904120000` | `20260904180000` |
| Timestamp du fichier local actuel | `20260904110151` | `20260904110402` |
| Timestamp enregistré dans l'historique live | `20260904110151` | `20260904110402` |
| Nom logique | `history_v2_dependency_manifest` | `history_v2_frozen_publications` |
| SQL / SHA-256 | Identique au SQL live | Identique au SQL live |
| Alignement local / live | ALIGNÉ | ALIGNÉ |
| Ordre après la migration précédente `20260902105811` | Conservé | Conservé après HC3 |

Le CLI Supabase rapproche l'historique local et distant par le timestamp des
fichiers. Les deux timestamps locaux sont désormais alignés sur les versions
live ; aucun changement de la base ou de son historique n'a été nécessaire.

Solutions explicitement rejetées :

- `supabase migration repair` : modifierait
  `supabase_migrations.schema_migrations`, ce qui est interdit ici et
  inutile puisque les lignes live décrivent le SQL réellement appliqué ;
- conserver les anciens fichiers et ajouter deux copies aux timestamps live :
  laisserait les anciens timestamps comme migrations pending et créerait une
  double représentation ;
- `supabase db pull` pour générer une nouvelle migration de schéma : ne
  rapprocherait pas les deux versions exactes déjà appliquées et risquerait de
  dupliquer leur DDL ;
- modifier ou rejouer le SQL : inutile et hors périmètre.

### 10.6 Réconciliation locale — APPLIED_LOCALLY

Réconciliation minimale exécutée dans ce checkpoint :

1. Les deux migrations ont été renommées byte-for-byte avec `git mv` vers :
   - `supabase/migrations/20260904110151_history_v2_dependency_manifest.sql` ;
   - `supabase/migrations/20260904110402_history_v2_frozen_publications.sql`.
2. Les SHA-256 B1 restent exactement :
   - HC3
     `C98CAE1AE149296D3A46BE49BEC5AF83CECEBA752AC22ECC94A2A51EFC25D789` ;
   - HC4
     `6F20E7685B154C8D6499F166826097BFEE34C222FD7D895D7E91E5F0F71EFE51`.
3. Seules les références exécutables de filenames ont été mises à jour dans :
   - `scripts/check-history-v2-dependency-manifest.mjs` ;
   - `scripts/check-history-v2-frozen-publication.mjs` ;
   - `scripts/lib/hc5-postgres.mjs`.
4. Les rapports 27, 28 et 29 restent les traces historiques des noms
   préparés à leurs checkpoints. Le présent rapport porte la table de
   correspondance officielle entre anciens noms locaux et versions live.
5. Les hashes et tests locaux sont les preuves de non-modification du SQL et du
   comportement. Le CLI Supabase n'est pas installé dans cette session :
   `CLI_LINKED_PROOF = NOT_AVAILABLE_IN_SESSION`. Par conséquent,
   `migration list --linked` et `db push --linked --dry-run` ne sont pas
   exécutables ici ; la preuve remote B1 déjà acquise reste l'autorité.

Aucun `migration repair`, aucune mutation de
`supabase_migrations.schema_migrations` et aucune commande réelle `db push`
n'ont été exécutés. B2 ne commence pas dans ce checkpoint.

### 10.7 État d'arrêt

- Projet : `ipuuhxrblxormwgoaqnz`.
- B1 DDL live : exécuté extérieurement, PASS.
- Écriture live par cette reprise : NONE.
- Réconciliation locale des timestamps : APPLIED_LOCALLY.
- CLI linked / dry-run : NOT_AVAILABLE_IN_SESSION.
- Test HC3 ciblé : PASS ; contrat et hash du fichier renommé relus.
- Test HC4 ciblé : PASS, 83 contrôles PostgreSQL/PGlite sur données
  synthétiques ; live NOT_TOUCHED.
- Test HC5 : PASS, 160 contrôles ; les sorties réelles `git ls-files` et
  `git rev-parse HEAD` ont été injectées en lecture seule car la sandbox
  interdit à Node de lancer un sous-processus Git (`spawnSync EPERM`).
- Typecheck `tsc --noEmit` : PASS.
- `git diff --check` : PASS.
- B2 : NOT_STARTED.
- Rebuild 12 mois : NOT_STARTED.
- Stage / finalize : NOT_STARTED.
- `POST_HISTORY_ENTRY_GATE` : NON ÉMIS.
- Contenu SQL et comportement métier : inchangés. Le backlog est inclus sans
  modification supplémentaire ; les trois scripts ne changent que les noms de
  fichiers lus.

HC6 PHASE B1 = PASS
HC3 LIVE CUTOVER = PASS
HC4 LIVE CUTOVER = PASS
DATA DRIFT AFTER DDL = NONE
REBUILD 12 MONTHS = NOT_STARTED

MIGRATION VERSION RECONCILIATION = APPLIED_LOCALLY
CLI_LINKED_PROOF = NOT_AVAILABLE_IN_SESSION
LIVE MIGRATION HISTORY MUTATION BY THIS REPRISE = NONE

STOP

## 11. HC6 B2A-R1 — ACTIVE SIGNATURE COMPATIBILITY

Date de contrôle : 2026-09-04. Projet live lu :
`ipuuhxrblxormwgoaqnz`. Baseline code : branche `main`, HEAD
`60b5671b5998b332232d08c4a2bc2a6e0c5fc5f1`. Toutes les requêtes live de ce
lot sont des `SELECT`. Aucun rebuild, stage, finalize, backfill, changement
Canonical ou write Supabase n'a été exécuté.

### 11.1 Diagnostic et classification

Le défaut est un **COMPATIBILITY_GAP** réel dans le runtime, et non un simple
`HARNESS_BUG` :

1. `SupabaseAnalyticsMaterializationStore.readQuery()` appelle
   `querySnapshotReadIdentities()` puis filtre SQL simultanément sur les
   `query_key` et `method_signature` acceptés ; une signature absente est donc
   rejetée avant lecture du payload.
2. L'identité sélectionnée transporte son `contractVariant`.
3. `executeQuery()` transmet ce variant à
   `queryDataSchemaForContractVariant()` et refuse en fail-closed un payload
   incompatible. Pour History V2, aucun miss ou échec de parse ne déclenche de
   read-through vers les sources.

Les 627 snapshots initialement bloqués sont légitimes. Leur signature est
reproductible depuis le commit Calendar-centric
`d4b70ca0c9b3e8c9214c0d1e7de51a8a57751d11` : mêmes contrats de ressources,
mêmes méthodes métriques et mêmes versions de ReadModels que la branche
actuelle, avec les versions de politiques effectivement publiées avant HC2 :

- `calendar_semantics@v3` et `calendar_amount_views@v1` déjà actifs ;
- `week_journal_projection@v1` au lieu de `v2` ;
- `month_overview_selection@v2` au lieu de `v3` ;
- `spending_nature@v2` au lieu de `v3` ;
- `life_money_selection@v2` au lieu de `v3` ;
- toutes les autres policies à leur version encore courante.

Le variant préexistant `history_v2_calendar_centric_old` représente une époque
plus ancienne : il retire `calendar_amount_views`, utilise
`calendar_semantics@v2` et, selon la ressource, un ancien ReadModel. Il ne doit
donc pas être élargi pour représenter cette génération. Le correctif introduit
le variant déterministe nommé
`history_v2_calendar_centric_pre_hc2`, calculé depuis les contrats et versions
ci-dessus. Aucun hash live n'est codé en dur dans le runtime ; les hashes exacts
ne sont figés que dans le test de non-régression.

Classification finale :

| Classe | Verdict | Preuve |
| --- | --- | --- |
| `HARNESS_BUG` | NO | le filtre réel du store refusait les signatures absentes |
| `COMPATIBILITY_GAP` | YES, CORRIGÉ | variant historique nommé et dérivé des versions |
| `PAYLOAD_SCHEMA_GAP` | NO | 927/927 payloads passent leur RuntimeSchema de variant |
| `AUTHORITY_OR_DOCTRINE_GAP` | NO | provenance Git et policy registry déterministes |

### 11.2 Inventaire live exhaustif

Les lignes ci-dessous sont les snapshots actifs, non invalidés, `contract=v2`,
rattachés à une publication `published`, sur `2025-08 → 2026-07`.

| Ressource | Lignes | Signature live | Avant R1 | Après R1 / schema |
| --- | ---: | --- | --- | --- |
| `history_activity_detail` | 92 | `125ef8f7b40441717179bba63de74cfb879e8c7e54d4b9e8bc4c87da3e0094b6` | REJECTED | `pre_hc2`, PASS |
| `history_bank_economy_bridge` | 12 | `4d9fc4e300f241e91805dbf2364ec8a5eff79ce9081059548c1059aa07ce860a` | ACCEPTED | `current`, PASS |
| `history_category_detail` | 96 | `ed84263e57c20f516f169fd195accc5a40238514df78d2739fa74ab6f19f9140` | ACCEPTED | `pre_hc2`, PASS |
| `history_day_journal` | 365 | `016163bec744441c3aa93ae0db4ddd80adb54157f2e1c9e6951d6f63ea66a16f` | REJECTED | `pre_hc2`, PASS |
| `history_minimal_preview` | 12 | `3b25abf864250763ca7f8796b3a3f5946ef9134d566b55fbd2ff86f37640f9a0` | ACCEPTED | `pre_hc2`, PASS |
| `history_moment_detail` | 43 | `6e93cf5253d7497ce9ef605c6ef4dbc6d7fb298f0200bd6a97f06738f7928763` | REJECTED | `pre_hc2`, PASS |
| `history_month_balance_summary` | 12 | `544efc60513f4d926877aebf7d6c78151a2c37ec981363ba634f848e4da72f05` | ACCEPTED | `current`, PASS |
| `history_month_calendar` | 12 | `e22d35bf87bcd5ffc91a0c4a68b8509c09854344eaa1787b155d4c600e3e1176` | REJECTED | `pre_hc2`, PASS |
| `history_month_categories` | 12 | `860deebcb0664bce7691f8f2de6193f8fd633e92a4052d3e048024c7cd82348c` | ACCEPTED | `current`, PASS |
| `history_month_life_money` | 12 | `1e2e2c091ebe0582943245bc01c221809a612caf8aa5dfd935bc0f8ce9089500` | REJECTED | `pre_hc2`, PASS |
| `history_month_overview` | 12 | `79e1539ac970be724807e6a49aed89762cd80a1319a32d4a604691a216ec603a` | REJECTED | `pre_hc2`, PASS |
| `history_month_spending_nature` | 12 | `465ac1eaa14fc54339ce4cdbdc8d46cd40606bae988a21c71e4bcf041fba706a` | ACCEPTED | `pre_hc2`, PASS |
| `history_place_detail` | 39 | `541363d7dcfe1a0263448b75983e40e6aed0b9e21ce26cc96bc9943cd699a28d` | REJECTED | `pre_hc2`, PASS |
| `history_spending_segment_detail` | 144 | `de6260311627fb1ae98d05eb39074153bca967f978226c1d927e8fdb8b2be80b` | ACCEPTED | `pre_hc2`, PASS |
| `history_week` | 52 | `feabe7baef95d9b7929ebd0bfaf526cf379e8e9c6238cb6631e8452e3e4a14a7` | REJECTED | `pre_hc2`, PASS |

Totaux après correction :

- signatures explicitement acceptées : **927/927** ;
- RuntimeSchemas Query exécutés sur les payloads live : **927/927** ;
- variant `history_v2_calendar_centric_pre_hc2` : **891** ;
- variant `current` : **36** ;
- artifacts partagés actifs parsés : **24/24** ;
- familles Query présentes et valides : **15/15** ;
- erreurs de signature ou de payload : **0**.

Les payloads pré-HC2 utilisent les schémas Calendar-centric actuels : aucune
forme alternative ni coercition n'est requise. Le variant le déclare
explicitement dans `queryDataSchemaForContractVariant()`.

### 11.3 Garde-fous permanents

Le gate Snapshot Materialization vérifie désormais les huit hashes qui étaient
bloqués, leur reconstruction sous le variant nommé, l'absence de signature
dupliquée sur les 15 ressources et la résolution déterministe de chaque
signature vers un seul variant. Le chemin store/runtime prouve en plus :

- snapshot actif, non invalidé, `contract_version=v2`, publication `published`
  et signature acceptée : HIT ;
- signature inconnue : MISS fail-closed ;
- mauvais contrat : refus par le prédicat strict `contract_version` ;
- snapshot inactif ou invalidé : refus par `is_active=true` et
  `invalidated_at IS NULL` ;
- payload invalide : `CONTRACT_MISMATCH` ;
- plusieurs snapshots acceptés pour une même Query :
  `TEMPORARY_UNAVAILABLE` ;
- absence de snapshot compatible ou payload invalide : aucun read-through
  History V2.

### 11.4 Contrôles exécutés

| Contrôle | Résultat |
| --- | --- |
| Analytics identity/materialization | PASS |
| Snapshot Materialization + signatures R1 | PASS — 82 contrôles |
| HC3 dependency manifest | PASS |
| HC4 frozen publications, PostgreSQL local | PASS |
| HC5 correction/republish/cache, PostgreSQL local | PASS — 160 contrôles |
| Frontend snapshot-only | PASS — 15/15 |
| Live Query RuntimeSchemas | PASS — 927/927 |
| Live artifact RuntimeSchemas | PASS — 24/24 |
| Architecture imports | PASS — 470 fichiers |
| `tsc --noEmit` | PASS |
| Next production build | PASS — Next.js 16.2.6 |
| `git diff --check` | PASS |

Le harness live temporaire n'a écrit aucun payload sur disque et a été supprimé
après validation. Aucun fichier temporaire ne reste dans le working tree.

### 11.5 État d'arrêt R1

- B2A-R1 : terminé.
- B2A full certification : non reprise dans ce lot.
- B2B : non commencée et interdite.
- Live writes : NONE.
- Rebuild / stage / finalize : NONE.
- `POST_HISTORY_ENTRY_GATE` : NON ÉMIS.

HC6 B2A-R1 = PASS

STOP

B2A FULL CERTIFICATION = TO_RESUME
B2B = FORBIDDEN

## 12. HC6 B2A — FULL 12-MONTH CERTIFICATION

Date : 2026-09-04. Checkout : branche main, HEAD
90f75fdcdd6126514f2bd51bd02d168fc2ec33bc, working tree propre au lancement.
B2A-R1 et ses preuves acquises restent PASS. Aucun moteur, parser, test permanent,
ReadModel, migration ou contrat n'a été modifié dans cette reprise.

**Résultat : FAIL, arrêt au premier écart inattendu Minimal en janvier 2026.**
Il ne s'agit plus d'un blocage de connexion. Supabase et GitHub sont accessibles ;
le projet Supabase lu est bien ipuuhxrblxormwgoaqnz / Budgetisation /
ACTIVE_HEALTHY.

### 12.1 Baseline live relue, uniquement par SELECT

Lectures le 4 septembre 2026, dont contrôle complet à 14:55:07 UTC et
contrôle final après arrêt à 15:01:03 UTC :

| Contrôle | Départ / fin |
| --- | --- |
| dataRevision | 1 / 1 |
| analyticsRevision | 67 / 67 |
| HC3 dans l'historique live | 20260904110151 history_v2_dependency_manifest |
| HC4 dans l'historique live | 20260904110402 history_v2_frozen_publications |
| Handshake | history-frozen-month@v1 |
| Guards HC3/HC4 | 4 présents, activés (O) |
| Publications History courantes | 12 / 12, toutes published |
| Artifacts History actifs | 24 / 24 |
| Query snapshots History actifs | 927 / 927 |
| Familles actives | 15 / 15 |
| Artifacts / snapshots actifs invalidés | 0 / 0 |
| Doublons logiques Query / artifact | 0 / 0 |
| Manifests non-NULL des publications courantes | 0 / 0 : LEGACY_UNKNOWN |

Les douze publicationIds sont ceux de la baseline B1/R1 ; aucune nouvelle
publication n'a été créée. Les artifacts sont sélectionnés par artifact_family :
calendar_semantic_month et daily_economic_ledger_month (12 chacun).
Leur metric_id physique porte le préfixe history_v2:.

La validation exhaustive des **927 anciens payloads et 24 anciens artifacts**
acquise sur ce HEAD n'a pas été rejouée. Les lectures de cette reprise portent
sur la baseline, les métadonnées d'instances et les 48 modules M1–M4 nécessaires
à la comparaison ; elles ne constituent pas une nouvelle certification des
RuntimeSchemas legacy.

### 12.2 Source Canonical et provenance de l'exécution

Un **nouvel export live read-only** a été constitué, au lieu de réutiliser
silencieusement une ancienne fixture :

- 37 tables/vues Canonical nécessaires au Repository et au FactSourceResolver ;
- 15 715 lignes, toutes les pages décodées et leurs cardinalités contrôlées ;
- mêmes comptages et empreintes de contenu sur **37/37 sources avant/après export** ;
- household_revisions exporté réellement à dataRevision=1 / analyticsRevision=67 ;
- vue économique, contrôles de timing/réconciliation, operations/composantes,
  activités, Moments, lieux/visites, personnes/jours, périodes et sources Minimal ;
- purchase_events, purchase_event_memberships, purchase_event_timing_assertions,
  economic_component_classifications et life_event_continuity_assertions :
  présentes et vides, jamais remplacées par des données synthétiques.

Recette d'empreinte source : COUNT(*) et
MD5(string_agg(to_jsonb(row)::text, newline ORDER BY to_jsonb(row)::text)).
Ces empreintes servent uniquement à détecter une dérive durant l'export ;
ce ne sont ni des resourceInputHash ni des publicationFactsHash.

Le connecteur a renvoyé une limitation temporaire 429 avec retry_after=60.
Après attente, seules les pages manquantes ont été relues. Les comptages finaux
et les empreintes avant/après ont été contrôlés ; aucune page partielle ou
tronquée n'a été acceptée.

Dossier de preuve privé, **hors dépôt Git** :
C:/Users/Manon/AppData/Local/Temp/hc6-b2a-90f75fd-a3cd9ae0874e490ca952e2ca10a419dc

Il contient l'export canonical/, canonical-proof-final.json, les inventaires
courants, live-baseline.json, live-after-certification.json et
certification-failure.json. Aucun export bancaire/personnel n'est ajouté à Git.

Oracle de comparaison : fichier existant
../work/certified-history-frozen-minimal-pass2/expected_vs_engine_FINAL.json.
Ce fichier original n'a pas été modifié. Sa copie privée expected-compare-only.json
a uniquement perdu le suffixe littéral backslash-n situé après la fermeture JSON,
qui rendait le fichier original non parseable tel quel. Une assertion deepEqual
établit l'identité du document JSON complet avant/après cette correction de transport.
SHA-256 du JSON.stringify(finalExpectedOracle) de cette copie :
5533e5236301ce85d47bbabc06a603f1b5afe3d0d6d56fa5408d7b183bbfaba0.
Aucune valeur métier, aucun EXPECTED et aucun hash attendu n'ont été ajustés.

Le chemin exécuté est celui de HC1 :
CanonicalRepository → FactSourceResolver → Analytics officiels → builders History.
Dans check-history-v2-certification-12-months.mjs, EXPECTED intervient dans
assertMonthInvariants(), pas dans les valeurs produites. Aucune injection de
l'oracle pour combler cet écart. La date technique asOf du runner officiel reste
2026-08-31T12:00:00Z ; elle n'est pas présentée comme date du contrôle live.

### 12.3 Gate officiel exécuté et point d'arrêt

Commande exécutée, avec les chemins privés ci-dessus :

    node scripts/check-history-v2-certification-12-months.mjs <canonical> <expected-compare-only.json> <certification>

HISTORY_V2_PREFLIGHT_BUNDLE_FILE désignait candidate-bundle.json dans le même
dossier privé. Aucun --publication-only, aucun --month, aucune simulation de
Canonical, aucun Begin, stage, attach manifest, finalize ou rollback.

Le runner a construit les deux artifacts sur les mois de support
2025-07 → 2026-08, puis les intrants des douze cibles 2025-08 → 2026-07.
Les preflights déterministes des cinq premiers mois ont franchi leurs assertions.
La sixième cible s'est arrêtée exactement sur :

    AssertionError [ERR_ASSERTION]:
    X03_MINIMAL_EXPECTED 2026-01:
    Analytics=1709.194; EXPECTED=1713.194

Preuves code :
scripts/check-history-v2-certification-12-months.mjs,
assertMonthInvariants(), contrôle X03_MINIMAL_EXPECTED (ligne 1302 à ce HEAD),
appel depuis la boucle de certification (ligne 1383).
Exit code du runner : 1.

| Mesure janvier 2026 | Valeur |
| --- | ---: |
| Minimal calculé par Analytics sur le Canonical live | 1709.194 |
| Minimal de l'oracle certifié conservé | 1713.194 |
| Minimal du snapshot History actif | 1713.194 |
| Écart candidat moins oracle / actif | -4 |

Classification : **UNEXPECTED**. La cause interne détaillée de cet écart n'est
pas établie par cette certification. Aucun diagnostic métier élargi ni correctif
n'est engagé après ce STOP. Il faut expliquer la différence dans le calcul
Minimal officiel avant de pouvoir reprendre la certification. Le simple accord
du snapshot actif avec EXPECTED ne rend pas le candidat conforme.

### 12.4 Résultats par mois, candidats et comparaison

« Invariants franchis » ci-dessous vient de l'exécution séquentielle du runner :
le mois suivant n'est annoncé qu'après les assertions du précédent.
Cela ne remplace pas le reçu final de certification, qui n'a pas été émis.

| Mois | Snapshots actifs | Artifacts actifs | Certification candidate | Comparaison / classification |
| --- | ---: | ---: | --- | --- |
| 2025-08 | 75 | 2 | Invariants franchis | comparaison détaillée non finalisée |
| 2025-09 | 72 | 2 | Invariants franchis | comparaison détaillée non finalisée |
| 2025-10 | 78 | 2 | Invariants franchis | comparaison détaillée non finalisée |
| 2025-11 | 77 | 2 | Invariants franchis | comparaison détaillée non finalisée |
| 2025-12 | 78 | 2 | Invariants franchis | comparaison détaillée non finalisée |
| 2026-01 | 81 | 2 | FAIL — X03_MINIMAL_EXPECTED | UNEXPECTED — Minimal -4 |
| 2026-02 | 75 | 2 | Non atteinte après STOP | non comparé |
| 2026-03 | 77 | 2 | Non atteinte après STOP | non comparé |
| 2026-04 | 79 | 2 | Non atteinte après STOP | non comparé |
| 2026-05 | 79 | 2 | Non atteinte après STOP | non comparé |
| 2026-06 | 79 | 2 | Non atteinte après STOP | non comparé |
| 2026-07 | 77 | 2 | Non atteinte après STOP | non comparé |
| Total | 927 | 24 | **Pas de PASS 12/12** | un écart bloquant confirmé |

Les 15 familles configurées ont été contrôlées dans les preflights achevés,
mais **15/15 familles certifiées sur les 12 mois n'est pas acquis**.

Le runner n'écrit son rapport JSON final et son bundle qu'à la fin de la boucle.
Après cet arrêt, ni history-v2-certification-12-months.json ni candidate-bundle.json
n'ont été émis. Les comptages exacts des instances candidates, leurs
resourceInputHashes, publicationFactsHash, manifestHash, policyVersions et
closures ne sont donc **pas livrés comme preuves certifiées**. Ils ne sont pas
reconstruits depuis les snapshots actifs ni obtenus par un contournement
--publication-only.

L'inventaire actuel des hashes est conservé hors Git dans
current-publications-summary.json ; le manifest de ces générations est
LEGACY_UNKNOWN. Il ne faut pas inventer une closure rétrospective ni affirmer
l'égalité ancien factsHash / nouveau publicationFactsHash.
Les différences de méthodes/policies pré-HC2 connues en section 11 ne suffisent
pas à expliquer automatiquement l'écart de valeur Minimal détecté ici.

### 12.5 État des familles de preuves

| Exigence | État de cette reprise |
| --- | --- |
| Source Canonical actuelle et export cohérent | PASS — 37/37 sources, révisions 1/67 |
| Absence d'oracle comme autorité de production | chemin HC1 conservé ; EXPECTED compare-only |
| Calendar / Daily, Actual et Daily reconciliation | assertions franchies sur les cinq premiers mois, gate 12 mois non émis |
| Catégories et réconciliations M3 | assertions franchies sur les cinq premiers mois, gate 12 mois non émis |
| M1 / Typical / Minimal | FAIL en janvier sur Minimal |
| M2 / M3 / M4 / Activity / Moment / Place sur douze mois | certification complète non acquise |
| RuntimeSchemas candidats 12 mois | non acquis |
| resourceInputHash closure / publicationFactsHash / manifestHash | validations dans les preflights achevés ; aucun manifest final livré |
| 12 générations candidates prêtes | NO |
| Écarts inattendus | UNEXPECTED : janvier Minimal -4 |
| Anciennes preuves R1 | conservées, non rejouées |
| HC3 / HC4 / HC5 / typecheck / build / architecture | non rejoués : aucun code modifié |
| git diff --check | PASS après ajout documentaire |
| Écritures live B2A | NONE |

### 12.6 Plan B2B préparé, non autorisé et non exécutable à ce stade

Prérequis bloquant : expliquer/corriger l'écart Minimal dans un périmètre
autorisé, puis reprendre le gate exhaustif 12 mois sur le checkout réellement
enregistré et le Canonical actuel. Ne pas modifier EXPECTED pour masquer l'écart.
Aucune autorisation B2B n'est demandée sur les candidats de cette exécution.

Après certification complète et autorisation humaine explicite seulement,
réutiliser le parcours existant de history-rebuild.ts, un mois après l'autre :

1. Relire contexte, dataRevision, analyticsRevision, handshake et actif du mois.
   Si la source a changé, recapturer les intrants et recertifier.
2. Produire / valider le candidat du mois avec produceCertifiedHistoryMonth
   et validateHistoryMonthBuild, lié au contexte courant. Ne pas restamper
   silencieusement un DRAFT ou son manifest scellé.
3. Begin du mois uniquement ; stage des deux artifacts puis des snapshots
   par petites écritures inactives, avec required artifact/query keys exactes.
4. Attacher le manifest versionné ; read-back intégral de la génération inactive.
   Vérifier complétude, unicité, RuntimeSchemas, contractVersion, méthodes,
   policies, PublicationMeta, factsHash, implementation digest et manifestHash.
5. Finalize atomique du mois via finalizeHistoryPublication ; aucun switch
   si validation ou CAS de révision échoue.
6. Read-back actif : ID/révision, ensemble logique complet, aucun ancien
   reliquat de clé, aucun doublon, aucune ligne active invalidée.
7. Seulement ensuite relire les révisions et passer au mois suivant.

Atomicité **par mois**, jamais pour les douze mois ensemble.
Ne pas créer douze DRAFT partageant la même analyticsRevision.
Aucune de ces opérations n'a été exécutée dans B2A.

### 12.7 Verdict et arrêt

Seul ce rapport est modifié dans le dépôt. Aucun commit, push, déploiement,
write Supabase, publication, Global ou travail UI.
Le helper privé de comparaison non exécuté a été retiré ; les preuves d'échec
et l'export privé cohérent sont conservés hors Git pour une reprise explicite.

HC6 PHASE B2A = FAIL
12-MONTH CERTIFICATION = FAIL
15/15 QUERY FAMILIES = NOT_CERTIFIED_OVER_12_MONTHS
CANDIDATE GENERATIONS = NOT_READY
UNEXPECTED DIFFERENCES = 2026-01 MINIMAL -4
LIVE WRITES B2A = NONE

STOP
HC6 PHASE B2B = NOT_STARTED / FORBIDDEN

## 13. HC6 B2A-R2 FIX — preuve Minimal actuelle, janvier uniquement

### 13.1 Entrée et autorité

L'arbitrage humain de cette reprise est acquis : ROOT_CAUSE =
CERTIFIED_ORACLE_STALE ; Canonical janvier = 1709.194 ; preuve/history legacy =
1713.194. L'audit R2 n'est pas rejoué et aucune autre différence n'est corrigée.

Baseline : main, HEAD 90f75fdcdd6126514f2bd51bd02d168fc2ec33bc.
La section 12, déjà présente dans le working tree avant ce correctif, est
conservée comme preuve chronologique de l'arrêt B2A.

La nouvelle autorité EXPECTED est une preuve **COMPARE_ONLY** distincte :
scripts/certification/history-v2-current-minimal/2026-01.json.
Elle ne remplace pas certified-historical-minimal.json et ne devient jamais
un MetricProductionSource. Aucun remplacement global de 1713.194.

Le seul branchement modifié est X03_MINIMAL_EXPECTED dans
assertMonthInvariants(), appelé après construction des ReadModels et des deux
preflights déterministes. Pour janvier, cette assertion contrôle la nouvelle
preuve, les composantes effectivement produites, les digests Canonical et
l'empreinte d'implémentation. Pour les autres mois, la comparaison EXPECTED
existante reste inchangée. Aucun résultat attendu n'est assigné à monthData,
analyticsAuthority, un builder ou un payload.

### 13.2 Contenu et reproductibilité

Identité : hc6-b2a-r2-current-minimal-2026-01-v1 ; schemaVersion=1.
Date de certification de la preuve : 2026-09-04T15:42:04Z.
MethodVersion : minimal_month_cost@v1 ; sourceRevision=1.
Source : même export Canonical privé B2A, précédemment vérifié read-only,
projet ipuuhxrblxormwgoaqnz. Aucun nouvel export ni appel live dans ce correctif.

La preuve versionne les 17 composantes additives avec clés, montants, support,
coverage et provenance ; aucun libellé bancaire, mouvement individuel, personne,
compte, CSV ou export Canonical n'est ajouté dans Git.

| Partie | Valeur actuelle | Legacy conservée |
| --- | ---: | ---: |
| neutralVariableComponents | 532.540 | 536.540 |
| mandatoryMonthlyObligationsAndProvisions | 1176.654 | 1176.654 |
| Minimal final | 1709.194 | 1713.194 |
| Need ae28d8ba-a1b3-5f6e-9b46-cb39b415e4ea | 12 | 16 |

Les références sont exactement 2025-08, 2025-09, 2025-10, 2025-11, 2025-12.
Le résolveur officiel est exécuté sans injection de source certifiée. La
preuve vérifie aussi l'égalité des composantes de l'autorité History avec cette
source Canonical indépendamment résolue.

implementationSha = 90f75fdcdd6126514f2bd51bd02d168fc2ec33bc identifie le moteur
audité puis recalculé. Ce correctif ne modifie aucun fichier de ce moteur.
Une empreinte des sources Analytics/Core/Canonical, des deux résolveurs et
des dépendances package, normalisées LF, vérifie cette continuité même après
le nouveau commit de certification :

minimal-source-tree-sha256-lf-v1 =
c2fb8140bdb41a4bea22152514f9318b780c63828a5f4e0533181d3f29778f58.

Le format minimal-canonical-projections-sha256-v1 conserve uniquement les
comptages et SHA-256 de projections d'intrants, jamais les lignes sources :

| Projection | Nombre |
| --- | ---: |
| scopeAndPeriods | 1 |
| economicFacts | 609 |
| operations | 591 |
| allocations | 15 |
| items | 44 |
| paymentComponents | 1 |
| cashUses | 20 |
| baselineRules | 40 |
| needs | 24 |
| recurrenceSeries | 35 |
| provisionPools | 3 |
| annualEvents | 5 |
| worksiteActivityTypeIds | 1 |
| plannedActivityDays | 118 |

Les SHA-256 individuels sont dans la preuve JSON. Digest composé des intrants :
ce89619333395fdfe96e3dd1377e529004973c2fba4425e8709e7e5b931db562.
L'ordre des objets et des lignes ne change pas ces empreintes. Une mutation
d'une règle, d'un digest, d'une composante ou du code attendu provoque un échec,
pas une régénération automatique de la preuve.

Digest canonique de la preuve :
2bab178f1383b4377754424cf4857b44176193953d5f0234dbec812e125e20fa.
SHA-256 byte-for-byte du fichier legacy, inchangé :
301615f3f3228eff44cc7f698927165c509fa48f40483e07c399ffd74ffe4f9d.

### 13.3 Fichiers du correctif

- scripts/certification/history-v2-current-minimal/2026-01.json : nouvelle
  preuve compare-only, séparée du legacy ;
- scripts/lib/history-v2-current-minimal-evidence.mjs : projections/digests et
  assertions ; ne retourne que le statut et l'identité de preuve ;
- scripts/check-history-v2-current-minimal-evidence.mjs : tests ciblés sur
  export privé et frontière d'autorité ;
- scripts/check-history-v2-certification-12-months.mjs : comparaison janvier
  dans la phase d'assertion seulement ;
- docs/history-v2/30-post-history-entry-gate.md : présent compte rendu.

Moteur, source legacy, schéma, migrations, materialization store, frontend et
snapshots live : inchangés.

### 13.4 Tests et certification ciblée

Commandes, avec chemins privés fournis par l'opérateur :

```text
node scripts/check-history-v2-current-minimal-evidence.mjs <fixture-canonical-B2A>
node node_modules/typescript/bin/tsc --noEmit --incremental false
node scripts/check-history-v2-certification-12-months.mjs <fixture-canonical-B2A> <oracle-legacy-compare-only> <sortie-privee> --month=2026-01 --household=<household-fixture> --source-revision=1
git diff --check
```

| Contrôle | Résultat |
| --- | --- |
| Tests ciblés de preuve | PASS — 20/20 |
| Legacy January via source historique/producer | PASS — 1713.194 |
| Recalcul Canonical January | PASS — 1709.194 |
| Comparaison actuelle / 17 composantes / Need=12 | PASS |
| Altération du montant/composante/digest/implémentation | rejetée |
| Réordonnancement des intrants | digest identique |
| Séparation compare-only / production | PASS — appel uniquement dans assertMonthInvariants ; aucun import dans src ; preuve sans valeur de payload |
| Typecheck | PASS |
| Gate officiel janvier | PASS — 1 mois, 15 familles, 83/83 RuntimeSchemas, 32/32 invariants, 2 artifacts |
| git diff --check | PASS, avertissements LF/CRLF uniquement |

Le mode --month existant prépare ses dépendances privées sur la fenêtre
historique, mais ne certifie et ne produit un preflight que pour janvier.
Aucun gate août–décembre, HC3/HC4/HC5, 927 payloads legacy ou build complet n'est
rejoué. Les compteurs V1 éventuellement rappelés par le JSON du runner sont
des acquis antérieurs, pas des tests exécutés dans cette mission.

Résultat janvier : Minimal=1709.194, X03_MINIMAL_EXPECTED=PASS, preuve
hc6-b2a-r2-current-minimal-2026-01-v1. Classification de disponibilité du mois :
DATA_MISSING (absences Canonical explicites), aucun invariant FAIL. Ce statut
ne signifie ni que toutes les données existent, ni que les douze mois sont
certifiés.

Manifest du preflight janvier :
921d0f5a4be702d5fd12bafe0abe284f03789add2bd8fac547f08cb414a6276b.
publicationFactsHash candidat :
dc87acbbd7d5620ba46ec71071ddf0de17ee3794dfabb2ff102b1ebf9e23e2a9.
Digest déterministe du résultat :
93bc5e171a403bbdfd82a8b56bb89bff9f3703aa3e47f091fea64361657b72fc.
Le rapport JSON détaillé est conservé dans la sortie privée
january-current-certification/history-v2-certification-12-months.json.
Il ne s'agit pas d'un manifest attaché à une publication live.

### 13.5 Limites et arrêt

Aucun Begin, Stage, attachement de manifest, Finalize, rollback, publication,
push ou déploiement. Aucune écriture Supabase. Les preuves privées restent hors Git.
La certification complète B2A reste à reprendre explicitement ; le correctif
janvier ne constitue pas un PASS des onze autres mois.

JAN 2026 CURRENT MINIMAL CERTIFICATION = PASS
LEGACY MINIMAL EVIDENCE = PRESERVED
PRODUCTION AUTHORITY = CANONICAL
ORACLE = COMPARE_ONLY
LIVE WRITES = NONE
B2A FULL CERTIFICATION = TO_RESUME
B2B = FORBIDDEN

## 14. HC6 B2A RESUME AFTER R2 — février à juillet, arrêt en février

### 14.1 Baseline et réutilisation de la source

Reprise du 4 septembre 2026 sur main, HEAD
268dbe98f8bcabb2b764f162499903c76bb1786c ; working tree propre au départ.
Les acquis août 2025 à janvier 2026, HC1–HC5, B1, B2A-R1 et les 927
RuntimeSchemas legacy ne sont pas rejoués. La preuve actuelle janvier et la
preuve historique legacy sont inchangées.

Contrôles Supabase uniquement SELECT sur ipuuhxrblxormwgoaqnz :

- dataRevision=1, analyticsRevision=67 ;
- 37/37 comptages et empreintes live identiques à canonical-proof-final.json ;
- 37/37 ensembles de lignes de l'export privé cohérent correspondent au live.

La recette des empreintes live d'origine est
MD5(string_agg(to_jsonb(row)::text, newline ORDER BY to_jsonb(row)::text)).
Pour vérifier les fichiers locaux indépendamment de l'ordre/collation,
la comparaison utilise aussi le MD5 des empreintes de lignes triées,
séparées par newline. Pour les quatre vues financières, les zéros finaux
des nombres PostgreSQL sont normalisés avec trim_scale dans le SELECT de
comparaison : aucune valeur n'est arrondie, aucun fichier source n'est réécrit.
Cette normalisation ne modifie pas les empreintes de référence conservées.

Preuve privée : remaining-source-revalidation.json, dans le même répertoire
temporaire B2A que l'export canonical/ décrit en section 12.
Aucun nouvel export complet n'est nécessaire. Aucune donnée privée n'est ajoutée
dans le repository.

### 14.2 Premier contrôle février : invariant officiel Minimal

Le mode --month du runner enregistré prépare encore les intrants de toute
la fenêtre historique. Afin de respecter l'interdiction de recalculer les
mois acquis, cette reprise vérifie d'abord l'invariant M1 Minimal de février
avant ce préchargement.

Le helper privé certify-february-minimal-preflight.cjs :

1. reprend le bootstrap read-only du test courant enregistré ;
2. appelle CanonicalRepository -> FactSourceResolver -> produceMetric pour le
   scope Household / 2026-02 uniquement, sans source certifiée injectée ;
3. extrait par AST l'appel exact check("X03_MINIMAL_EXPECTED", ...) du runner
   officiel et l'exécute avec le résultat réel et l'oracle compare-only ;
4. arrête l'exécution dès cette assertion FAIL.

Les observations Canonical des mois de référence sont lues pour calculer le
Minimal de février, mais aucun Minimal, artifact, candidat ou gate
août–janvier n'est recalculé.
Un premier essai du helper privé a échoué sur une liaison d'import fs avant
l'assertion ; seul ce helper hors Git a été corrigé, sans modification du
runner officiel ni du moteur.

| Mois | Assertion | Canonical | EXPECTED | Delta Canonical - EXPECTED | Statut |
| --- | --- | ---: | ---: | ---: | --- |
| 2026-02 | X03_MINIMAL_EXPECTED | 1737.76166666666666666668 | 1741.095 | -3.33333333333333333332 | UNEXPECTED / FAIL |

Le delta dépasse la tolérance 0.01 de l'assertion officielle.
La preuve actuelle janvier n'est pas étendue implicitement à février.
Aucune conclusion CERTIFIED_ORACLE_STALE, CANONICAL_ENGINE_BUG ou autre cause
n'est attribuée à février dans cette mission : ce serait un nouvel audit.
Aucun attendu, certificat, moteur, règle ou Canonical n'est corrigé.

### 14.3 État des étapes et arrêt

Le contrôle précoce a échoué avant construction du preflight complet de février.
Les RuntimeSchemas candidats, les 15 familles, les invariants restants,
les hashes/manifests et le déterminisme de février ne sont donc pas déclarés
PASS. Aucun candidat publiable ni bundle février n'est livré.

| Mois restant | Résultat de cette reprise |
| --- | --- |
| 2026-02 | FAIL — premier invariant Minimal, arrêt immédiat |
| 2026-03 | NOT_STARTED |
| 2026-04 | NOT_STARTED |
| 2026-05 | NOT_STARTED |
| 2026-06 | NOT_STARTED |
| 2026-07 | NOT_STARTED |

Preuve d'échec privée : february-first-invariant-result.json.
Le tableau consolidé de douze mois n'est pas produit comme certification :
la condition février–juillet PASS n'est pas satisfaite. Les preuves déjà
acquises août–janvier restent conservées sans rejeu.

Seul ce rapport est modifié dans Git. git diff --check : PASS.
Aucun test HC3/HC4/HC5, aucune validation legacy, aucun build, aucune passe
finale douze mois, aucun Begin/Stage/Finalize, aucune publication et aucune
écriture Supabase. Aucun commit ni push dans cette reprise.

B2A REMAINING MONTHS = FAIL
FIRST UNEXPECTED = 2026-02 X03_MINIMAL_EXPECTED
2026-03 -> 2026-07 = NOT_STARTED
LIVE WRITES = NONE
FINAL 12-MONTH CONSOLIDATED RUN = NOT_STARTED / BLOCKED_BY_FEBRUARY
B2B = FORBIDDEN

STOP
+
## 15. HC6 B2A-R3 FIX — CURRENT MINIMAL EVIDENCE FEB→JUL

### 15.1 Périmètre et source

Reprise du 4 septembre 2026 sur main, HEAD
268dbe98f8bcabb2b764f162499903c76bb1786c. La section 14, produite par la
reprise interrompue, est conservée intégralement avant ce correctif pour garder
la chronologie de preuve.

Les résultats R3 acquis ne sont pas réaudités : les six écarts Minimal de
février à juillet sont CERTIFIED_ORACLE_STALE et OTHER_ROOT_CAUSE=0. L'export
Canonical privé est réutilisé avec dataRevision/sourceRevision=1 et ses 37/37
digests validés. Aucun accès en écriture à Supabase n'est effectué.

La source de production reste :

CanonicalRepository -> FactSourceResolver sans CertifiedHistoricalMinimalSource
-> produceMetric(minimal_month_cost).

Les preuves EXPECTED sont lues seulement dans assertMonthInvariants(), après la
construction Canonical, des deux artifacts, des ReadModels et du preflight.
Elles ne sont ni MetricProductionSource, ni FactSource, ni intrant de builder,
ReadModel ou payload.

### 15.2 Preuves current compare-only

Six fichiers versionnés complètent la preuve janvier inchangée :

| Mois | Minimal current exact | Composantes | Références | evidenceHash |
| --- | ---: | ---: | ---: | --- |
| 2026-02 | 1737.76166666666666666668 | 17 | 6 | cbe41355a0b70a87cd67870e0ea265eaaf9aa412335666e1a70811a026b3a6c3 |
| 2026-03 | 1710.52714285714285714286 | 17 | 7 | 1f59e4ab1b76ae9c12ecf5502b59b00377b7a8369d8b1ee9d0479fce7527bffe |
| 2026-04 | 1676.3225 | 17 | 8 | 22dd50dff40cc6d2bca1d24d31a8c49b764b498f5d3ecc76542ed7002987cf2b |
| 2026-05 | 1649.79222222222222222221 | 18 | 9 | f01e4b8fbbcdc827a569a88334ccf0e2e4a7dc904670f70ce2c753834498ffa1 |
| 2026-06 | 1623.097 | 18 | 10 | f31655bdd9bbd93e5bdd4146162eeea6042304554bee455e56bfab74439ba0c2 |
| 2026-07 | 1636.76636363636363636364 | 18 | 11 | da1f636417046750095dff0fa5e0e27497fc365f35dc1c247153036f5d86b222 |

Chaque preuve contient schemaVersion=1, authority=COMPARE_ONLY, finalValue,
MethodVersion, referencePeriods, les deux groupes de composantes complets avec
support/coverage/provenance, sourceRevision, l'identité SHA/digest de
l'implémentation et les digests détaillés des intrants Canonical.

Les composantes correspondent exactement au recalcul : Need N sur les six mois,
récurrence R à partir de mai, structure S en juin/juillet et structure T en
juillet. Aucun résidu de sérialisation legacy n'est converti en composante.
Les résidus exacts de février, mars et mai restent une propriété documentée de
l'ancienne preuve seulement.

Le sélecteur current est strictement borné à janvier→juillet. Un mois non
enregistré retourne null ; une preuve enregistrée absente, altérée ou
incompatible échoue fermée sans repli vers le legacy.

### 15.3 Legacy et séparation d'autorité

Le fichier certified-historical-minimal.json est inchangé octet pour octet :
SHA-256
301615f3f3228eff44cc7f698927165c509fa48f40483e07c399ffd74ffe4f9d.
La preuve current janvier reste également inchangée : SHA-256
127f3a7fe46eda83794ae663bd29c56d5df96b525a65ef59e81d6a40c41a5393.

Les douze valeurs legacy continuent à être vérifiées via la source historique et
le producer. Les tests refusent une preuve current ou le petit objet résultat de
son assertion comme MetricProductionSource. Aucun module sous src/ n'importe le
mécanisme compare-only. L'autorité de payload est donc Canonical ; l'oracle est
COMPARE_ONLY.

### 15.4 Tests ciblés des preuves

Le gate check-history-v2-current-minimal-evidence.mjs exécute 227 contrôles :

- janvier current PASS et preuve inchangée ;
- février→juillet exacts et recomputés depuis Canonical ;
- 17/18 composantes exactes, y compris N/R/S/T ;
- toutes les valeurs legacy préservées ;
- altérations finalValue, amount, componentKey, digest global, digest d'une
  dépendance, implementation digest/SHA, authority, sourceRevision et références
  rejetées ;
- preuve enregistrée manquante fail-closed ;
- réordonnancement non métier des intrants sans faux changement de digest ;
- preuve/résultat d'assertion inutilisables comme source de production ;
- appel compare-only localisé uniquement dans assertMonthInvariants(), après
  production.

Résultat : 227/227 PASS. Typecheck PASS. Aucun build complet, aucune suite
HC3/HC4/HC5 et aucun rejeu des 927 anciens RuntimeSchemas.

### 15.5 Gates officiels ciblés

Les six gates sont lancés l'un après l'autre avec --month. Le préchargement des
dépendances historiques du runner ne certifie aucun mois acquis. Chaque sortie
privée contient son preflight bundle et son résultat détaillé.

| Mois | Gate | Familles | RuntimeSchemas | Invariants | Artifacts | manifestHash | publicationFactsHash |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- |
| 2026-02 | PASS | 15/15 | 76/76 | 32/32 | 2/2 | c3075ac4c1c9202bdf50b6bcafb71b0c95a101954a4ebcce8e4e6a14c82fefb9 | 4cd9f279780233104ca397a50dff32390c58b24c5df1393ef6e85e2dd6ee77c5 |
| 2026-03 | PASS | 15/15 | 80/80 | 32/32 | 2/2 | 1b9839e9ee61e401e85c6f8b8b95b87c992c8b8880528745b324896f43da7edf | abef819698f18aa53b3edf5c4b87b2a4f88333ec78a226d08aaba2a09ade02c6 |
| 2026-04 | PASS | 15/15 | 81/81 | 32/32 | 2/2 | 949a042b9b4fd0d0f6469f9542b7c3b9b4f7d52c6eee58da8cd83f322bc9307e | 9f5950a1f39886abe6d7b82f9ab5a4627e4bf1f9cd9203bf13639be9c991f890 |
| 2026-05 | PASS | 15/15 | 78/78 | 32/32 | 2/2 | 172f84c466ed38046684c348a2d0982e9d9ac16347e171a947e5ff898cdc92de | f0bd76d29a11ea7ce0233b4da3d6c17979bc6dbafab826ed90aefbba431757af |
| 2026-06 | PASS | 15/15 | 80/80 | 32/32 | 2/2 | c7ce3c75fddff8fd23c0e700ccef0e40cba2a06039c098fb5cfa6cce6e88ed45 | 698a737e7274285a526491788b5e803ce042c1a902eaa1170416d319c2654ced |
| 2026-07 | PASS | 15/15 | 78/78 | 32/32 | 2/2 | 73d8c1edbb33053f9b7bee4261571ed6f58c3fc8f28c37cac1685708c2c4a0a1 | 10747c20f81bf7363527d78212db5bcb076684eb66dc366a0cfc3eea1afa3f65 |

Les six manifests sont history-v2-dependency-manifest@v2, complets en
requiredQueryKeys/requiredArtifactKeys, factDependencies, implementation,
policy/method versions et externalQueryRefs. Deux constructions READ-ONLY par
mois donnent les mêmes manifestHash et publicationFactsHash. Aucun invariant
FAIL et aucun nouvel écart non-Minimal.

La classification globale de chaque mois reste DATA_MISSING du fait d'absences
Canonical explicites déjà autorisées ; elle ne contient aucun FAIL et ne remet
pas en cause les 32 invariants PASS.

### 15.6 État de sortie

Aucun Begin, Stage, attach manifest live, Finalize, rollback, publication,
push ou déploiement. Aucune écriture Supabase. La passe consolidée douze mois
n'est pas lancée dans ce lot.

CURRENT MINIMAL EVIDENCE JAN→JUL = PASS

2026-02 CERTIFICATION = PASS
2026-03 CERTIFICATION = PASS
2026-04 CERTIFICATION = PASS
2026-05 CERTIFICATION = PASS
2026-06 CERTIFICATION = PASS
2026-07 CERTIFICATION = PASS

LEGACY MINIMAL EVIDENCE = PRESERVED
PRODUCTION AUTHORITY = CANONICAL
ORACLE = COMPARE_ONLY
LIVE WRITES = NONE
FINAL 12-MONTH CONSOLIDATED RUN = REQUIRED NEXT
B2B = FORBIDDEN

STOP
