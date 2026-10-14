# P14 POST SNAP-3 — stabilité et latence résiduelle

**État au 15 octobre 2026 : `PARTIAL_LOCAL_FIX_NOT_RELEASED`.** Base `origin/main` et Production `7098e3bad96ff6be724284246f95d4370c028e9b`. Branche locale `codex/composer-v3-p14-post-snap3-stability-performance`. Aucun push, PR, merge ou déploiement de cette correction. Aucun Apply, mutation financière, migration ou publication d'artifact pendant cette mission.

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

## Suite minimale

Une fois l'accès navigateur revenu : (1) déployer une Preview de ce commit, (2) sauvegarder un Draft réel admissible sans Apply et vérifier qu'un ancien onglet issu de cette version traverse un nouveau build en conservant la sauvegarde et le bouton de reprise, (3) comparer dix ouvertures/éditions avant et après avec les mêmes données et digests, (4) vérifier le build et les contrôles de permission, puis livrer si ces gates passent. Pour la maintenance SNAP-3, mesurer la première invalidation naturelle et le coût de republication avant de choisir un déclenchement automatique hors READ. Aucun SNAP-4 requis.
