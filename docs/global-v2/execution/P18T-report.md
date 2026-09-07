# P18T — compatibilité du déploiement préalable au cutover de schéma

## Baseline

- Repository : `https://github.com/adriensauvageot34/Budgetisation`.
- Branche cible : `main`.
- Production Vercel attestée : projet `budgetisation`, READY, ref `main`, Git SHA `22ef278109f8c06ad01d99b51aed54d1a4e97964`, déploiement `dpl_fv3CRbjCb2YzvDmbwmmPDSwd62w6`.
- HEAD local : `ea6aa79eb9c5faa064b5007f91cbfc4964324253`.
- Commit produit certifié P17 : `3230f8de411d972193a799081b4d688dfdffba16`.
- `git diff 3230f8d..ea6aa79 -- :!docs/**` est vide : le commit P18 `ea6aa79` est strictement documentaire. L'implementation identity produit reste `3230f8de411d972193a799081b4d688dfdffba16`.
- Les modifications non committées à l'entrée sont les deux compléments documentaires du STOP P18 ; elles sont conservées.

## Trace runtime

### Route Global V2

`src/app/analyse-globale/page.tsx` retourne `GlobalV2ActivationPending` lorsque `NODE_ENV=production`. La création du bundle fixture n'est atteignable qu'en développement. Aucun import de cette route n'appelle Begin, stage, attach, seal, finalize ou un moteur analytique Global V2. La future route V2 resterait donc inactive si P17 était déployé avant P19.

### Route Global legacy

P17 conserve l'application legacy :

1. `/analyse` redirige vers `/historique/analyse/global` ;
2. le chemin legacy appelle les ressources `analysis_global_initial`, `analysis_global_baseline`, `analysis_global_typical`, `analysis_global_breakdown`, `analysis_global_evolution`, `analysis_global_contexts`, `analysis_global_habits`, `analysis_global_profiles` et `analysis_global_universe` ;
3. ces neuf contrats sont toujours `family = legacy_v1` ;
4. `executeQuery()` tente un read materialized puis calcule avec l'adapter au miss ;
5. après le calcul, il appelle `services.materialization.writeQuery(request, data)` ;
6. `SupabaseAnalyticsMaterializationStore.writeQuery()` accepte les ressources `analysis_global_*` et UPSERT une ligne `period_kind=global`, `generation_key=read_through`, `publication_id=NULL`, `is_active=true`.

Cette écriture est exécutée par le trafic normal, après un miss. L'absence actuelle du schéma P18 n'empêche pas l'application : la table existante accepte ces lignes. Aucune génération V2 n'est créée par ce chemin.

### Collision avec le futur guard

`guard_global_v2_frozen_content()` de la migration P18 classe comme Global V2 toute ligne `period_kind=global` dont `resource LIKE 'analysis_global_%'`. Il exige ensuite une publication DRAFT et un manifeste. Les neuf écritures legacy décrites ci-dessus seraient refusées. Leur exception est capturée par `executeQuery()`, ce qui préserve généralement le payload calculé mais supprime la persistance du cache. Cela constitue une modification de comportement pendant la transition et viole la condition P18T.

## Compatibilité demandée

| Preuve | État |
| --- | --- |
| Produit P17 byte-identique entre `3230f8d` et HEAD hors docs | PASS |
| `/analyse-globale` inactive en Production | PASS code |
| Aucun calcul/publication V2 au build, démarrage ou première requête | PASS code ciblé |
| Application compatible avec schéma live actuel sans P18 | PASS |
| Query/History existants compatibles avec schéma actuel | PASS acquis P17 et live P18 |
| Aucune écriture legacy `analysis_global_*` incompatible émise | FAIL |
| Compatibilité avec les futurs guards P18 pendant la transition | FAIL |

Le défaut est dans le commit produit P17 lui-même. Un déploiement de `3230f8d` ou `ea6aa79` ne ferme donc pas P18T.

## Correctif technique requis

Créer une modification produit séparée et reviewable qui empêche le read-through des neuf ressources Global legacy avant installation des guards. La correction minimale appartient à `SupabaseAnalyticsMaterializationStore.writeQuery()` ou à sa politique de matérialisation :

- identifier explicitement les neuf ressources dont le contrat est `legacy_v1` et dont la période est `global` ;
- lorsque l'appel ne porte pas de `publicationId`, retourner avant tout UPSERT ;
- conserver le calcul/read model legacy afin que `/historique/analyse/global` reste utilisable ;
- ne pas modifier les écritures mensuelles, History publiée ou le runtime snapshot-only Global V2 ;
- ne pas employer un simple préfixe ambigu comme preuve du contrat V2 ;
- ajouter un test discriminant pour chacune des neuf ressources : miss → calcul success → zéro write Supabase ;
- ajouter les contrôles négatifs montrant que les writes mensuels permis et les writes de drafts History restent inchangés.

Ce correctif ne change aucune doctrine Analytics. Il change une frontière de cache/Query et doit recertifier les closures P17 suivantes : Query runtime et binding R05, isolation legacy/Global du SQL local R06/R07, no-read-through et frontend local R15, plus les tests actuels `check-analysis-global-contracts`, materialization, Query Global V2 et frontend. Typecheck, architecture, build Production et diff-check sont requis. Un nouveau commit produit et une nouvelle implementation identity doivent être créés avant une nouvelle demande `PUSH + DEPLOYMENT_COMPATIBILITY_ONLY`.

## Déploiement proposé

- SHA exact à pousser : `NONE — BLOCKED_CODE_COMPATIBILITY`.
- SHA produit actuel : `3230f8de411d972193a799081b4d688dfdffba16`.
- Commits à déployer : aucun tant que le correctif ci-dessus n'est pas implémenté et recertifié.
- Le remote `origin/main` reste `22ef278109f8c06ad01d99b51aed54d1a4e97964`. Le local contient les checkpoints History puis P01–P18 listés par Git ; leur déploiement groupé n'est pas autorisé tant que cette incompatibilité demeure.
- Comportement attendu après un futur déploiement corrigé : Global V2 affiche ActivationPending, Global legacy reste calculable sans write-through, History reste inchangé, aucune génération Global n'existe.
- Rollback futur du déploiement code : redéployer le déploiement Vercel `dpl_fv3CRbjCb2YzvDmbwmmPDSwd62w6` / SHA `22ef278…`, puisque P18T n'inclut aucun DDL ni mutation de données. Après un éventuel P18 ultérieur, cette stratégie devra être réévaluée car `22ef278…` n'est pas compatible avec les guards.

## Opérations exécutées

- Lecture ciblée des commits P17/HEAD/remote et du commit Production attesté.
- Traçage du chemin route → Query → adapter → materialization → UPSERT.
- Aucune suite lourde exécutée : la condition de compatibilité échoue avant le gate de déploiement.
- Aucun fichier produit modifié.
- Aucun push, déploiement, migration, publication, génération ou écriture Supabase.

CURRENT_PROMPT = P18T

P18T = BLOCKED_CODE_COMPATIBILITY

P18T_DEPLOYMENT_COMPATIBILITY = BLOCKED

GLOBAL_ROUTE_V2 = INACTIVE_IN_P17_CODE

GLOBAL_PUBLICATION = NOT_STARTED

GLOBAL_GENERATION_COUNT = 0

GLOBAL_SCHEMA_LIVE_GATE = BLOCKED_PENDING_P18T

LIVE_WRITES = NONE

PUSH_AUTHORIZATION = NOT_REQUESTABLE_UNTIL_FIX_CERTIFIED

NEXT_PERMITTED_PROMPT = P18T_CODE_COMPATIBILITY_FIX

P18 et P19 restent interdits.

## Fermeture P18T — résolution Git et compatibilité déployée

La divergence Git constatée après la certification locale a été résolue sans réécriture d'historique. Le merge d'intégration `2ed2cc0dadaef64a6e788cf881b6b40311a9cc2b` conserve les deux lignées avec les parents exacts suivants :

- parent distant : `22ef278109f8c06ad01d99b51aed54d1a4e97964` ;
- parent correctif P18T : `ce85f1ee2040fe25bfb96482c4fd0c5b8238df49`.

Les treize commits absents de la lignée P18T étaient exclusivement documentaires et leurs chemins ne chevauchaient pas les changements locaux. Le diff `ce85f1e..2ed2cc0` hors `docs/**` est vide, y compris `src/**`, `scripts/**`, `supabase/**`, `package.json` et les configurations runtime. Les deux parents sont ancêtres du merge. La sauvegarde locale `backup/p18t-certified-ce85f1e` conserve le commit certifié inchangé.

Le contrôle ciblé après merge a confirmé `GLOBAL_LEGACY_READ_THROUGH=9/9 PASS`, `LEGACY_GLOBAL_SUPABASE_WRITE_THROUGH=0`, les contrôles négatifs mensuel/publication explicite et `ANALYSIS_GLOBAL_CONTRACTS=PASS`. Le SQL P18 est resté byte-identique dans le blob Git, SHA-256 `B5C60AD3FB47EBC56DAC23E61E081B0502556674A2B8D59C90D687BE6F6BF085`.

Après autorisation humaine exacte, le merge a été poussé en fast-forward de `22ef278...` vers `2ed2cc0...`. `origin/main` et `git ls-remote origin refs/heads/main` ont tous deux confirmé `2ed2cc0dadaef64a6e788cf881b6b40311a9cc2b`. Aucun accès Vercel n'a été effectué. L'utilisateur a ensuite fourni l'attestation externe exacte `CONFIRM_P18T_EXTERNAL_DEPLOYMENT_READY 2ed2cc0dadaef64a6e788cf881b6b40311a9cc2b`, ce qui ferme uniquement la compatibilité de déploiement préalable à P18.

`REMOTE_MAIN = 2ed2cc0dadaef64a6e788cf881b6b40311a9cc2b`

`P18T_MERGE_SHA = 2ed2cc0dadaef64a6e788cf881b6b40311a9cc2b`

`P18T_PUSH = PASS`

`P18T_CODE_COMPATIBILITY_FIX = PASS`

`P18T_DEPLOYMENT_COMPATIBILITY = PASS`

`GLOBAL_ROUTE_V2 = INACTIVE`

`GLOBAL_PUBLICATION = NOT_STARTED`

`GLOBAL_GENERATION_COUNT = 0`

## Fermeture locale — correctif de compatibilité P18T

Le défaut `BLOCKED_CODE_COMPATIBILITY` ci-dessus est conservé comme état historique. Le correctif local ultérieur ne modifie ni le SQL P18 ni une doctrine métier : il ferme uniquement la frontière de persistance Query avant un futur déploiement explicitement autorisé.

### Politique centralisée

`legacyGlobalReadThroughResources` est dérivé de deux autorités existantes, sans liste métier codée dans le store :

1. `queryResourceContractRegistry` exige `family = legacy_v1` ;
2. `queryResourceRegistry` exige exactement `allowedTimeKinds = ["global"]`.

`shouldSkipLegacyGlobalReadThroughWrite()` exige en plus un request réellement normalisé avec `scope.time.kind = global` et l'absence de `publicationId`. `SupabaseAnalyticsMaterializationStore.writeQuery()` retourne alors avant tout accès à `analytics_query_snapshots`. Une écriture avec `publicationId`, une écriture mensuelle ou une écriture History ne satisfait pas cette conjonction et conserve son chemin existant.

Le corpus dérivé courant, asserté exhaustivement par le test, contient :

- `analysis_global_initial` ;
- `analysis_global_baseline` ;
- `analysis_global_typical` ;
- `analysis_global_breakdown` ;
- `analysis_global_evolution` ;
- `analysis_global_contexts` ;
- `analysis_global_habits` ;
- `analysis_global_profiles` ;
- `analysis_global_universe`.

Une future ressource `legacy_v1` exclusivement Global sera automatiquement soumise à cette politique ; l'assertion du corpus courant signalera aussi explicitement le changement à la revue. Le préfixe `analysis_global_` n'est pas l'autorité du skip.

### Fichiers du correctif

- `src/server/analytics/materialization/identity.ts` : dérivation contractuelle et prédicat pur ;
- `src/server/analytics/materialization/store.ts` : retour centralisé avant UPSERT ;
- `src/server/analytics/materialization/index.ts` : export de la politique testable ;
- `scripts/check-global-legacy-read-through.mjs` : preuve end-to-end Query et contrôles négatifs ;
- `scripts/check-analysis-global-contracts.mjs` : inventaire legacy réellement exhaustif, incluant Breakdown et Contexts ;
- `package.json` : commande ciblée du gate ;
- documentation P18/P18T et état durable.

Aucun Fact, moteur M1–M10, seuil, définition, autorité, causalité, attribution, support, coverage, FDR ou ReadModel métier n'est modifié.

### Preuve par ressource et contrôles négatifs

Pour chacune des neuf ressources, `check-global-legacy-read-through.mjs` traverse le vrai `executeQuery()` et le vrai adapter registry sur un cache miss. Le source adapter est appelé une fois, le ReadModel synthétique passe le RuntimeSchema réel, le payload validé est identique, la réponse est `success` avec `materialization=miss`, la frontière `writeQuery()` est atteinte et le client Supabase enregistre zéro appel. Résultat : `9/9 PASS`, `LEGACY_GLOBAL_SUPABASE_WRITE_THROUGH=0`.

Contrôles négatifs :

- `analysis_month_initial` sans publication continue à exécuter un UPSERT ;
- une ressource legacy Global avec `publicationId != NULL` continue à exécuter un UPSERT et conserve ce `publication_id` ;
- la suite History V2 matérialisation reste PASS et prouve ses écritures DRAFT/publiées ;
- le runtime Global V2 reste snapshot-only avec une lecture snapshot et zéro lecture producteur ; il n'utilise pas cette exception legacy.

### Closure T02

| Preuve | Classification | Résultat |
| --- | --- | --- |
| Query runtime, adapters, validation, RuntimeSchemas legacy | REPLAY_REQUIRED | 9/9 ciblées + `ANALYSIS_GLOBAL_CONTRACTS=PASS` |
| Materialization store général | REPLAY_REQUIRED | `Analytics materialization checks: PASS` |
| History materialization | REPLAY_REQUIRED | gate PASS, 82 checks ; profil 15 familles inchangé |
| Global V2 Query/no-read-through | REPLAY_REQUIRED | 57/57 ; 32/32 RuntimeSchemas ; snapshot reads 1 / producer reads 0 |
| Frontend Global V2 et ActivationPending | REPLAY_REQUIRED | 286/286 ; fixtures 71/71 ; route Production explicitement gardée |
| Runtime legacy/navigation | REPLAY_REQUIRED | `Live runtime regression checks: PASS` et contracts legacy PASS |
| Architecture / TypeScript / build Production | REPLAY_REQUIRED | PASS / PASS / PASS |
| P17 R05, R15 | REPLAY_REQUIRED | binding Query, réponse miss, snapshot-only et frontend recertifiés |
| P17 R06/R07 SQL | REUSABLE_UNCHANGED | SQL byte-identique ; preuve PGlite P17 reste applicable |
| C-D/C-E Analytics, M1–M10, FDR et Facts | REUSABLE_UNCHANGED | hors diff et hors closure du changement de cache |

Le candidat analytique P17 reste réutilisable au sens T02 : ses producteurs, inputs, closures métier et payloads sont byte-identiques. `GLOBAL_ANALYTIC_CANDIDATE = REUSABLE_UNCHANGED`. L'identité d'implémentation déployable change avec le checkpoint Git contenant ce correctif ; son SHA exact est fourni par `git rev-parse HEAD` après le commit local, car un commit ne peut contenir son propre SHA de manière stable.

### SQL et statut opérationnel

`supabase/migrations/20260906120000_global_v2_publication_infrastructure.sql` est inchangé. SHA-256 recalculé : `B5C60AD3FB47EBC56DAC23E61E081B0502556674A2B8D59C90D687BE6F6BF085`.

Aucun accès Supabase live, DDL, Begin, Stage, Attach, Seal, Finalize, publication, génération, push ou déploiement n'a été exécuté. `/analyse-globale` reste `GlobalV2ActivationPending` en build Production. `/historique/analyse/global` conserve son calcul et son affichage ; seule sa persistance reconstructible sur miss est supprimée.

CURRENT_PROMPT = P18T_CODE_COMPATIBILITY_FIX

P18T_CODE_COMPATIBILITY_FIX = PASS_LOCAL

P18T_DEPLOYMENT_COMPATIBILITY = PENDING_DEPLOYMENT

IMPLEMENTATION_GATE = PASS

CONTRACT_GATE = PASS

TEST_GATE = PASS

GLOBAL_ANALYTIC_CANDIDATE = REUSABLE_UNCHANGED

GLOBAL_ROUTE_V2 = INACTIVE

GLOBAL_SCHEMA_LIVE_GATE = BLOCKED_PENDING_P18T_DEPLOYMENT

GLOBAL_PUBLICATION = NOT_STARTED

GLOBAL_GENERATION_COUNT = 0

LIVE_WRITES = NONE

PUSH = NOT_STARTED

DEPLOYMENT = NOT_STARTED

NEXT_PERMITTED_PROMPT = P18T_PUSH_AND_COMPATIBILITY_DEPLOYMENT_AFTER_AUTHORIZATION

P18 et P19 restent interdits.
