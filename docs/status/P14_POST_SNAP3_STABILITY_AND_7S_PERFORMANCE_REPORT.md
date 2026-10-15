# P14 POST SNAP-3 — stabilité et latence résiduelle

**État au 15 octobre 2026 : `POST_SNAP3_PARTIAL_BLOCKED`.** Base `origin/main` et Production `7098e3bad96ff6be724284246f95d4370c028e9b`. Branche `codex/composer-v3-p14-post-snap3-stability-performance`. Deux Previews du correctif sont READY ; aucun merge ou déploiement Production. Aucun Apply, mutation financière, migration ou publication d'artifact pendant cette reprise.

## SNAP-3 en Production

- Vercel Production `dpl_F8GXVCgTa4D6tTBmnQyEKAc5sKnF` était READY ; `COMPOSER_P14_SNAP3_HISTORICAL_BASIS=1`, P14-P3=0.
- État Supabase lu sans écriture : révision globale 1, époque de schéma 2, couverture des writers vraie. Canonical génération 2 et M7 génération 1 étaient tous deux READY et admis, pour octobre 2026, digests et cutoffs présents. Corps stockés : Canonical 368 328 octets, M7 4 715 479 octets. Les dix ouvertures chaudes capturées ont toutes utilisé les deux HIT, avec 42 appels Supabase par READ et 2 351 081 octets de corps décodés. Aucun `57014` dans les logs consultés du déploiement courant ; la fenêtre de logs consultable ne prouve pas l'absence historique d'incident.
- Aucune invalidation n'est visible depuis la mise en place de l'état (révision 1). Cela ne mesure pas une fréquence durable. Les 30 triggers d'invalidation sont installés, mais leur coût en écriture réelle n'a pas été mesuré dans cette mission.
- Le projet n'a pas de Cron de préparation (`vercel.json`), et `COMPOSER_P14_SNAP3_PREPARE_ENABLED` est absent en Production. La route de préparation POST est donc désactivée. Une invalidation rendra l'artifact inadmissible, avec retour au lecteur direct jusqu'à une republication explicite. La publication Canonical précédente a duré environ 34 s hors READ. Sans fréquence de mutation ni coût opérationnel stabilisé, aucun préparateur automatique n'a été ajouté.

## Ancien onglet et Draft

L'incident observé au déploiement SNAP-3 était un refus `Failed to find Server Action` sur une page issue d'un ancien build. [Next.js explique](https://nextjs.org/docs/messages/failed-to-find-server-action) que les identifiants d'actions varient entre builds. La protection officielle Vercel contre ce décalage épingle les actions à leur déploiement, mais [elle est réservée aux plans Pro et Enterprise](https://vercel.com/docs/skew-protection) ; le projet vérifié est sur Hobby, où l'option est désactivée. Aucun changement d'abonnement n'a été demandé. Les 320 € Courses de l'onglet ancien provenaient d'un essai volontaire de l'utilisateur ; leur visibilité locale ne prouvait pas une sauvegarde.

**Correction locale :** seul le transport des Drafts passe par `/api/composer/drafts`, chemin HTTP stable entre builds. La route utilise les mêmes `authorizedPlanner`, cutover, service Draft, RPC et CAS. Elle impose l'origine exacte sur POST, JSON, un corps borné et l'authentification serveur ; les écritures directes, Apply et autres owners ne sont pas exposés. L'interface garde les états DIRTY/SAVING/SAVED/ERROR/OFFLINE/CONFLICT, le request ID en attente après réponse incertaine et le garde `beforeunload`. Si la Preview échoue, un bouton de rechargement n'apparaît que lorsque le digest local correspond au Draft confirmé SAVED. Une projection invalide laisse Apply désactivé. Cette correction protège les onglets **chargés après sa livraison** ; elle ne répare pas rétroactivement un ancien build déjà ouvert.

## Chronologie authentifiée disponible avant le blocage navigateur

Preuve numérique : [dix ouvertures chaudes](evidence/p14-post-snap3/opening-warm-prechange.json). Même Preview SNAP-3 ON, mois, code et session ; les digests par ouverture n'ont pas été retenus. Les P95 de dix valeurs sont descriptifs (rang le plus élevé), pas une certification de fiabilité. L'échantillon initial plus froid à 12,14 s est exclu de cette série chaude.

| Mesure inclusive | P50 | P95 descriptif | Sur le chemin critique ? |
|---|---:|---:|---|
| Ouverture → Board/Preview FRESH | 6,59 s | 8,79 s | Oui, mesure utilisateur |
| Navigation → fin de réponse HTML | 4,31 s | 6,21 s | Oui, inclut la réponse serveur |
| Observation serveur | 3,71 s | 5,49 s | Oui, comprise dans la navigation |
| World | 2,82 s | 4,08 s | Oui |
| Evidence / Forecast | 2,51 s | 3,63 s | Oui, branche dominante de World |

Sur une trace cohérente, Auth a pris 0,34 s, Bootstrap 0,66 s, Evidence 3,63 s, admission Canonical 0,30 s, M7 0,97 s et Finance V2 0,40 s. Ces durées sont inclusives et certaines branches sont parallèles : elles ne s'additionnent pas. La différence entre les durées navigateur et serveur reste **UNATTRIBUTED** sans marqueurs réseau/RSC de même origine temporelle. Aucune chronologie authentifiée édition→FRESH, Soirée→FRESH ou Suggestions n'a été recueillie dans ce lot.

Evidence et le délai après réponse sont les premiers leviers à examiner. Le lecteur Evidence traverse encore plusieurs requêtes historiques et des vues vivantes ; la trace résume la barrière à 2–3,6 s mais ne prouve pas quelle requête individuelle peut être retirée sans perdre des faits. Aucun raccourci financier ou cache supplémentaire n'a été introduit. L'objectif de moins de 5 s au P95 n'est pas atteint dans cette série avant correction.

## Contrôles et limites

| Contrôle | Verdict |
|---|---|
| TypeScript après correction | PASS local |
| Route Draft : origine, taille, JSON, auth, cutover, opérations autorisées | PASS sur service simulé ; aucun JWT réel |
| Reprise du même request ID après réponse perdue | PASS dans le test local de transport ; les tests P14-P2 du hook CAS, conflit, offline et archivage passent également |
| Next complet | NOT_CERTIFIED_LOCAL_TOOLING : le premier essai Turbopack est resté bloqué ; Webpack a échoué avec `EPERM` sur `.next/types/app/mois-a-venir/composer`, puis, après suppression vérifiée du seul dossier `.next` généré, sur `.next/types/app/api`. Aucune troisième relance identique. |
| Lint ciblé | NOT_RUN : `eslint` n'est pas installé localement ; `npx` n'a pas pu joindre le registre npm (`ENOTFOUND`). |
| Vrai ancien onglet entre deux déploiements, Preview authentifiée après correction | NOT_RUN |
| Mesures avant/après appariées et gain utilisateur post-correction | NOT_RUN ; la correction Draft vise la fiabilité, aucun gain FRESH revendiqué |
| Parité Finance V2 / Apply | Code financier inchangé ; aucune nouvelle certification authentifiée |

L'accès à l'onglet Preview a été **refusé par la revue automatique pour limite d'usage**, avec reprise annoncée le 15 octobre 2026 à 03:12. L'action a été rejetée avant exécution. Aucun navigateur ou canal indirect n'a été utilisé pour contourner ce refus. Les tests authentifiés, le contrôle entre builds et la livraison restent bloqués par cette limite. La correction doit donc rester locale ; pas de PR ni de déploiement avant vérification réelle.

## Reprise ciblée du 15 octobre

### A. État vérifié

- GitHub `main` et Production sont restés au SHA `7098e3bad96ff6be724284246f95d4370c028e9b` après `git fetch`. Production `dpl_F8GXVCgTa4D6tTBmnQyEKAc5sKnF` était `READY`.
- Supabase : `private.composer_historical_basis_state` révision 1, époque 2, `enabled=true`, couverture des writers vraie. Les deux artifacts publiés sont toujours `READY`, Canonical génération 2 et M7 génération 1. Cette lecture ne reconstitue pas à elle seule une preuve d'admission pour un nouvel utilisateur ou mois.
- Aucun accès navigateur n'a été tenté avant la fin annoncée de la limite d'usage, le 15 octobre à 03:12 heure de Paris.

### B. Correction Draft et contrôles

- Le transport passe toujours par l'URL stable `/api/composer/drafts` et les services Draft existants. Le nouveau contrat `composer-draft-http@1` est envoyé et exigé sur GET/POST. Un serveur d'une version incompatible répond 409 ; le client refuse aussi toute réponse sans version conforme.
- Le client valide la forme du Draft, son mois, sa version sémantique, son digest, le request ID, la version CAS attendue et l'opération confirmée avant `SAVED`. Une réponse mal formée ou d'une génération incompatible reste `ERROR` avec le travail local conservé. La relecture incompatible affiche une explication ; une erreur de cycle de vie n'est plus présentée automatiquement comme un conflit CAS.
- `check-composer-post-snap3-draft-http.mjs` : cinq contrôles PASS avec service simulé, dont origine/version, auth, opérations autorisées, réponse perdue et refus de réponse incompatible. `check-composer-p14-p2-durable.mjs` : sept contrôles PASS sur hook déterministe. Ces tests ne constituent pas une preuve JWT réelle ni le test entre déploiements.
- TypeScript : PASS sur le dernier commit (`npx.cmd tsc --noEmit`, code de sortie 0). Build local Webpack : une tentative autorisée a démarré la compilation, sans sortie finale pendant l'observation ; elle a été interrompue après une modification du code en cours de build. Le dossier `.next/types/app/api` acceptait une écriture de son propriétaire ; la cause exacte de l'`EPERM` antérieur reste non attribuée. Les deux builds Vercel Preview sont complets et READY ; cela certifie la compilation distante, pas la réparation de Windows.

### C. Livraison

- Branche distante de test : `codex/composer-v3-p14-post-snap3-stability-performance`, push PASS. Premier commit correctif `e31b654fb990b1c761cf8c05fd5510da791e65a6`, second commit de validation HTTP `75b11296e6e188849927036c7ab7df2d85400d37`.
- Preview A : `dpl_5EyccroraNuRtFELxCAhB4Z8xUxs`, `READY`, SHA `75b11296e6e188849927036c7ab7df2d85400d37`. Journaux : `npm run build` → `next build` → compilation réussie en 28,9 s → build complet → déploiement terminé.
- Preview B : `dpl_Gzzra6P9uEAVhThCaTwvdrgnBtZS`, `READY`, SHA `262ce74e37898eb99958b8d4c4fac88d4c1800c6`. Journaux : même commande, compilation réussie en 38,5 s, build complet et déploiement terminés. Le diff A→B ne contient que ce rapport et sa preuve locale JSON ; aucun code applicatif différent.
- Alias de test `budgetisation-p14-draft-skew-adriensauvageot34-6137s-projects.vercel.app` vérifié sur A, hors Production. Le basculement vers B attend qu'un onglet authentifié soit ouvert sur A. Test inter-déploiement, PR, merge, déploiement Production et smoke : `NOT_RUN`.
- Rollback si une future livraison échoue : désactiver l'autosauvegarde via son cutover existant et restaurer le déploiement Production précédent, en conservant Drafts/archives/Plans ; aucune suppression SQL.

### D. Performance résiduelle

La série authentifiée **avant** correction, n=10, reste 6,59 s P50 et 8,79 s P95 descriptif pour ouverture→FRESH. La branche Evidence/Forecast était 2,51 s P50, 3,63 s P95. Le code `readMonthPredictionEvidence` montre quatre étapes séquentielles (scope, fuseau, dernière date, puis lectures), avec des barrières de métadonnées et d'historique en parallèle et une pagination. Une lecture bornée de `pg_stat_statements` sur des requêtes Canonical/timing a trouvé, parmi huit signatures cumulées, des moyennes SQL de 5,3 à 29,4 ms ; ces statistiques ne sont ni bornées à Composer ni à une ouverture et ne désignent donc pas le goulot. Les spans Evidence déjà prévus par le code devront être capturés avec la même requête authentifiée pour trancher. Aucun gain de temps n'est attribué au correctif Draft. Édition→FRESH après correction, transport/RSC/commit React et chiffres appariés : `NOT_RUN` ; le délai après réponse demeure `UNATTRIBUTED`. Aucun changement de calcul Evidence, Forecast ou Finance V2 sans preuve plus fine.

### E. Maintenance SNAP-3

État présent : deux artifacts READY, 30 triggers d'invalidation, pas de Cron, préparation POST désactivée en Production. Après une invalidation naturelle, `inspect_composer_historical_basis_v1` relit la preuve et la génération ; une preuve ou un digest divergent empêche l'admission et déclenche le fallback direct. Le GET `/api/composer/historical-basis?month=…&owner=canonical|m7` permet de constater `READY` ou `MISS` sans préparation. Pour republier hors READ, vérifier d'abord la couverture des writers, activer temporairement et de manière contrôlée le mécanisme de préparation existant pour chaque owner, puis vérifier la génération, le digest, la relecture et l'admission. La publication utilise `expected_generation` en CAS ; une génération devenue obsolète est rejetée et une réponse perdue est réconciliée par relecture. Après timeout, ne relancer qu'après inspection de la génération et de la preuve, avec une limite d'essais et une fenêtre d'exploitation explicite. Surveiller durée de préparation, taille et fréquence réelle des MISS. Aucune republication, activation de route ou automatisation n'a été exécutée dans cette reprise. Le coût observé d'environ 34 s pour Canonical interdit une préparation implicite durant READ ; l'absence de fréquence d'invalidation mesurée ne justifie pas encore un Cron.

### F. Gates et verdict

| Gate | Statut à cette étape |
|---|---|
| Auth, CAS, idempotence, réponse perdue | PASS sur simulateur/service et hook local ; JWT réel `NOT_RUN` |
| TypeScript | PASS local, code de sortie 0 sur le commit final |
| Build complet du code candidat | `EXECUTED_PASS_VERCEL_PREVIEW` sur A et B ; build local Windows `NOT_CERTIFIED` |
| Inter-déploiement A→B authentifié | `NOT_RUN` |
| Golden ciblé, Finance V2, Apply | Code inchangé ; pas de nouvelle certification authentifiée |
| SNAP-3 | État lu sans écriture ; future invalidation naturelle `NOT_RUN` |
| Performance après correction | `NOT_RUN` |
| R3-008 | Incident préexistant non rejoué dans ce lot ; statut inchangé |

**Fiabilité Draft : `READY_FOR_AUTHENTICATED_CROSS_DEPLOYMENT_TEST`, pas `PRODUCTION_PASS`. Performance : `MEASURED_PRECHANGE_ONLY`. Verdict global : `POST_SNAP3_PARTIAL_BLOCKED` tant que l'ancien onglet authentifié entre A et B n'est pas vérifié.**

## Suite minimale

### Test authentifié A→B du 15 octobre — complément

L'accès navigateur officiel est revenu. Les anciens déploiements de test avaient l'autosauvegarde désactivée ; deux builds du même arbre `b8d365d` ont donc été construits avec Draft activé uniquement sur l'alias de test. A `dpl_CwteHBcNADEL5F5GnrYJRVLaG2Rz`, B `dpl_DD7Uhq3dMiGKL5BXmQFA8EEaG1SA`, tous deux READY. Aucun changement de configuration Production.

Le vrai JWT applicatif a sauvegardé le nouveau Draft de décembre v1 sur A puis v2 depuis l'ancien onglet A après le basculement officiel de l'alias vers B. L'ancienne simulation a échoué ; l'interface a conservé SAVED, désactivé Apply et proposé le rechargement sûr. B a relu la même décision puis sauvegardé v3. Une écriture v2 depuis A est devenue CONFLICT avec le travail local conservé ; la base reste v3, sans double incrément. L'archive existante v8 est inchangée. Preuve : `evidence/p14-post-snap3/cross-deployment-authenticated.json`.

Défaut ciblé trouvé : la confirmation « Charger la version sauvegardée » restait bloquée par `beforeunload`. Le listener consultait le drapeau d'autorisation uniquement lors de son installation, puis empêchait toujours la navigation. Le callback consulte désormais le drapeau au moment de l'événement. La protection des modifications non confirmées reste active. Rejeu navigateur de cette seule reprise en attente du build corrigé ; route Draft et hook déterministe repassés PASS, TypeScript PASS. Aucun calcul financier modifié.

Une fois l'accès navigateur revenu : (1) déployer une Preview de ce commit, (2) sauvegarder un Draft réel admissible sans Apply et vérifier qu'un ancien onglet issu de cette version traverse un nouveau build en conservant la sauvegarde et le bouton de reprise, (3) comparer dix ouvertures/éditions avant et après avec les mêmes données et digests, (4) vérifier le build et les contrôles de permission, puis livrer si ces gates passent. Pour la maintenance SNAP-3, mesurer la première invalidation naturelle et le coût de republication avant de choisir un déclenchement automatique hors READ. Aucun SNAP-4 requis.
