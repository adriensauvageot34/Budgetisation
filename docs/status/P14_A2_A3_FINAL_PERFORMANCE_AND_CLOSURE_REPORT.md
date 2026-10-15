# P14-A2/A3 — performances, livraison et clôture

15 octobre 2026. **Livré — `P14_READY_TO_CLOSE`, avec limites de performance connues.** Draft et A2/A3 sont fusionnés et déployés ; le smoke authentifié final a réussi. Les résultats ci-dessous remplacent les anciens NOT_RUN de cette mission ; ils ne certifient pas une limite P95 de production.

## A. État réel et fiabilité Draft

- Départ : `main`/Production `7098e3b`, SNAP-3 ON, P3 OFF, PR [#32](https://github.com/adriensauvageot34/Budgetisation/pull/32) ouverte sur `b8d365d`.
- Le test authentifié A→B a été exécuté sur le même alias protégé. Les anciens builds de test avaient Draft OFF ; deux builds identiques ont été reconstruits avec Draft ON, sans changer Production : A `dpl_CwteHBcNADEL5F5GnrYJRVLaG2Rz`, B `dpl_DD7Uhq3dMiGKL5BXmQFA8EEaG1SA`.
- Vrai JWT : sauvegarde v1 sur A ; sauvegarde v2 depuis l'ancien onglet après basculement vers B ; relecture sur B ; v3 puis refus CAS de l'ancien onglet, sans incrément double. SAVED reste distinct de la simulation FAILED, Apply est désactivé. L'archive préexistante v8 est intacte.
- Défaut découvert et corrigé dans `9603681` : le callback beforeunload doit consulter le drapeau de confirmation au moment de l'événement. Rejeu ciblé : conflit puis confirmation, rechargement effectif du Draft v4 en SAVED. L'outil a expiré pendant cette navigation ; la reconnexion officielle a constaté le résultat, sans réémettre de mutation.
- PR #32 fusionnée : `13838678e69e86e3abeff4843926e6cdff92ec95`. Production `dpl_ox7cLBCZ1dvfp7W5tgTNPYvaV4Jt`, READY. Smoke authentifié : sauvegarde v5, rechargement fidèle, archivage récupérable v6 du seul essai créé. Aucun Apply. Octobre préparé s'ouvre FRESH ; les métriques détaillées sont désactivées sur cette Production, donc aucun HIT d'exécution n'y est prétendu sur la seule base de l'interface.
- Les neuf compteurs de tables financières suivis sont identiques avant/après le gate A→B. Les Drafts d'essai restent archivés ; aucune suppression. Preuve détaillée dans `evidence/p14-post-snap3/cross-deployment-authenticated.json`, intégrée par #32.
- La reprise automatique antérieure du gate Draft a été mise en pause après retour de l'accès officiel. Aucune tâche en double.

## B. Causes isolées et corrections

### Evidence

Le vrai lecteur attendait scope → fuseau → dernière date → métadonnées → historique. Une trace de référence iad1 montre 652 / 205 / 472 / 772 / 984 ms pour ces barrières, puis 20 ms de jointure locale. Ces durées ne décrivent pas un temps SQL exclusif. Correction `cd58a1e` : éviter la lecture du fuseau déjà fourni par le contexte autorisé et chevaucher métadonnées/historique, après admission du scope et des dates. Même pagination complète, mêmes filtres, mêmes faits et transformations ; priorité de l'erreur métadonnées conservée. Aucun cache inter-requêtes.

### Transport des Preview et saisie

Les intentions rapides conservaient la bonne décision, mais attendaient longtemps des réponses de Server Actions : 13,17 s jusqu'à FRESH pour la dernière décision, contre 3,65 s d'observation serveur du dernier calcul. Les fetchs observés se succédaient. [Next.js documente le dispatch séquentiel des Server Functions](https://nextjs.org/docs/app/getting-started/mutating-data). Cela établit une contrainte de transport ; toute différence navigateur/serveur n'est pas attribuée exclusivement à cette file.

`db359ac` ajoute `/api/composer/preview`, uniquement READ/SUGGESTIONS, avec le même `authorizedPlanner` et `handleComposerRequest`. Le scheduler P2, les tickets, digests et rejets de réponses anciennes restent propriétaires de l'admission. Apply/CHECK_APPLY conservent leur transport et leur relecture autoritaire ; Draft conserve sa route distincte. Contrat HTTP versionné, origine exacte, JSON borné à 1 200 000 octets, aucun foyer fourni par le client, auth serveur, réponse no-store et validation du modèle avant retour au scheduler. Erreur HTTP : aucune nouvelle tentative silencieuse via Server Action. Activation contrôlée par `COMPOSER_PREVIEW_HTTP_ENABLED=1`, OFF par défaut pour rollback.

Un résultat défavorable a ensuite révélé des réponses MUTATE exploratoires tardives. `composer-card.tsx` envoyait une simulation après une pause de 200 ms dans la saisie du montant, avant le clic explicite de Preview. `c44b45c` conserve la saisie locale et annule cette exploration de champ ; le bouton déclenche la Preview. Les autres explorations S2 restent disponibles. Aucun montant n'est décidé automatiquement.

### Région

Trois paires exploratoires du même code instrumenté favorisent fra1 pour World : médianes 3,55 s iad1 / 2,08 s fra1 ; Evidence 3,23 / 1,92 s. FRESH reste variable et les dimensions n'avaient pas été conservées avant une reconnexion de l'outil ; première ouverture fra1 plus froide. Ces observations sont directionnelles, pas une certification régionale.

Le test de `preferredRegion` dans les deux fichiers Node est resté **iad1 à l'exécution** malgré un build READY. Ce réglage est retiré. La configuration officielle par fonction dans `vercel.json` est vérifiée : **fra1 observé pour le GET Composer et le POST Preview**, global iad1 et route Draft inchangés. La région de la page concerne aussi ses Server Actions ; leur logique Apply/CAS n'a pas changé et aucun Apply réel n'est exécuté pour le test. [Vercel documente cette portée par fonction et la limite Hobby](https://vercel.com/docs/functions/configuring-functions/region). Aucun déplacement de Supabase, aucun abonnement modifié.

## C. Mesures authentifiées conservées

Sources : `evidence/p14-a2-a3/authenticated-samples.json`, `paired-opening-rows.json`, `paired-opening-analysis.json`, `editing-before-http.json`, `editing-transport-pairs.json`. Même compte/mois/alias, deux HIT, P3 OFF, autosave OFF et garde read-only. Horodatages Performance navigateur et observation serveur ; aucune durée de l'outil Codex utilisée comme métrique produit.

### Ouverture — A2 seul, iad1

Cinq paires enregistrées. Une paire garde un smoke Production concurrent comme facteur de confusion ; deux observations supplémentaires à 498×646 sont conservées hors paires. Quatre paires exploitables à 1280×720. Visibilité et activités locales non totalement contrôlées dans cette première série : le gain navigateur est descriptif. Les quatre paires ont les mêmes digests sémantiques et Preview ; aucune requête en timeout.

| Indicateur | Avant P50 / P95 descriptif | A2 P50 / P95 descriptif |
|---|---:|---:|
| Ouverture → FRESH | 6,88 / 12,40 s | 5,65 / 7,43 s |
| World | 2,86 / 3,22 s | 2,42 / 2,58 s |
| Evidence | 2,56 / 2,97 s | 2,22 / 2,39 s |
| Fin HTML → observation FRESH | 1,96 / 4,03 s | 1,56 / 2,63 s |
| Appels Supabase par READ | 42 | 41 |
| Corps Supabase décodés | 2 351 081 octets | 2 351 052 octets |

Médiane des gains individuels : 637 ms FRESH, 593 ms World, 498 ms Evidence. Une paire conserve une Evidence plus lente après correction ; aucune suppression d'échantillon défavorable. Le nombre de commandes SQL internes aux RPC n'a pas été mesuré dans cette campagne. Le P95 de quatre valeurs n'est pas robuste.

### Édition — A3 HTTP avant suppression du hover de saisie

Première paire visible à 1280×720, région iad1 ; mêmes valeurs et digests. Un seul échantillon par scénario ne définit pas un P95.

| Parcours | Server Action | HTTP | Réserves |
|---|---:|---:|---|
| Courses 350 → FRESH | 10,03 s | 7,18 s | Serveur HTTP plus lent : 4,85 contre 3,45 s |
| Trois montants 351/352/353 → FRESH | 13,17 s | 5,80 s | Dernière valeur 353 conservée ; serveur 4,21 contre 3,65 s |

HTTP : fetch identifiable, 8,8–10,8 ms entre fin du corps réseau et résolution du transport. En Server Action, ce détail reste UNATTRIBUTED. Une seconde série HTTP avec l'ancien hover reste défavorable : dernière édition 7,49 s ; une réponse exploratoire MUTATE tardive affiche 13,98 s serveur. Elle est conservée, sans soustraction entre traces différentes. Les mesures après suppression du hover et configuration régionale figurent dans la section suivante.

Soirée avant HTTP : configuration riche, composant synthétique, date absente, Preview FRESH, 8,26 s jusqu'à l'observation FRESH, serveur 6,06 s. Les identités de contexte générées empêchent de comparer directement les digests à une nouvelle création indépendante. Aucun enregistrement durable de ce scénario, aucune dépense.

### Candidat final — lecture réelle en fra1

Preuve `final-candidate-real.json`, code produit `3b5b11c`, build `dpl_2cCNvMv7r6WHKSLBQKhkCaDW1KWb`. Ouvertures : 7,55 s première, 5,21 et 4,83 s aux deux rechargements. P50 5,21 s, P95 descriptif 7,55 s, n=3 ; World P50 1,68 s et Evidence P50 1,56 s. Deux HIT, 41 appels et 2 351 052 octets à chaque ouverture, digests identiques. Cette série finale n'est pas une nouvelle campagne appariée de dix essais ; sa variabilité reste visible.

- Courses : FRESH 5,80 s, serveur 3,11 s, World 1,52 s, Evidence 1,37 s. Identités/digests identiques aux autres transports pour 350.
- Trois décisions rapides : FRESH 5,06 s, dernière valeur 353 et mêmes digests. Le viewport a varié après le nettoyage des onglets et n'était pas embarqué dans le marqueur de peinture : pas de certification desktop P95.
- Réponse hors ordre réellement observée dans la variante iad1 : la réponse seq6 s'est terminée après le commit du dernier état FRESH ; 353 et son digest restent courants. Le champ diagnostic « dernière action » peut alors montrer l'ancienne réponse ; ses métriques serveur sont laissées UNATTRIBUTED pour l'intention acceptée.
- Saisie seule avant le clic : digest inchangé et aucune action financière observée. Le bouton de Preview reste explicite.
- Suggestions : requête HTTP authentifiée réussie, 3,45 s jusqu'à FRESH, mêmes digests ; aucune proposition admise implicitement, aucun ACCEPT. Aucune candidate affichable n'a été présentée dans ce scénario.
- Soirée : FRESH 4,23 s, serveur 3,41 s, World 1,60 s, composant synthétique et date absente. Identité générée différente du premier scénario : aucun gain parité chiffrée entre ces deux créations. Deux HIT, zéro écriture bloquée ou timeout.

Les mesures visuelles P95 <100 ms restent non certifiées ; le test CPU local de présentation ne mesure pas le délai de peinture. Aucun nouveau remaniement React/scheduler n'a été ajouté pour viser artificiellement un seuil.

## D. Contrats, sécurité et régressions

- Evidence propriétaire avant/après : cinq contrôles PASS sur fixtures, pagination 1001 observations, substitutions, UNKNOWN/PARTIAL, frontières temporelles/fuseaux, historique absent, scope refusé, erreurs concurrentes et fraîcheur entre READ.
- Temporal/Forecast : 63 PASS. Parité financière : 22 scénarios × 9 empreintes PASS. Aucune modification des golden.
- Route Preview et transport : six contrôles PASS sur service simulé, dont identité forgée refusée, auth, refus des writers, JSON, réponse invalide et deux lectures démarrées indépendamment avec réponses hors ordre.
- Scheduler P2 : cinq PASS synthétiques ; conserve la règle existante de ne pas attendre une ancienne lecture SQL. Aucune annulation SQL déjà lancée n'est revendiquée. La concurrence de lectures doit rester bornée dans les mesures ; surveiller le fallback si un artifact devient MISS.
- Apply/CAS P13 : huit PASS sur fixture, y compris réponse perdue, replay, commit puis échec de relecture et relecture ambiguë. Aucun Apply authentifié de test.
- Draft HTTP : cinq PASS sur service simulé ; hook durable sept PASS, plus gate A→B et smoke Production réels décrits plus haut.
- Présentation P2 : quatre PASS synthétiques ; modèle visuel CPU P95 2,66 ms sur 80 gestes, distinct d'une latence visuelle réelle.
- Observation : sept PASS, isolement, confidentialité, collecte des corps et garde read-only. TypeScript non incrémental : code 0 après fusion Draft et ajout HTTP. Build HTTP `dpl_6ZJrigA4kXV6GmtFLwLcjoG1tcnN` : compilation 30,6 s, TypeScript 34,4 s, build complet et déploiement PASS. Build final régional : compilation 31,7 s, TypeScript 39,6 s, build complet/READY ; contrôles Vercel GitHub PASS sur `3b5b11c`.
- Ancien `check-composer-orchestration.mjs` : FAIL avant assertions, stub `./activity-history-artifact` absent dans un harness inchangé de main. Pas de PASS attribué, pas de régression financière démontrée par ce défaut de harness.
- Aucun writer de source, migration, Apply, publication forcée ou nouveau snapshot. Les modifications Composer ordinaires gardent Canonical/M7 HIT dans les traces enregistrées.

## E. Git, livraison et rollback

Branche `codex/composer-v3-p14-a2-a3-performance`, PR [#33](https://github.com/adriensauvageot34/Budgetisation/pull/33). Base main initiale `7098e3b`, main Draft intégré par merge `586a4d3` : les deux conflits de props ont conservé les transports Draft HTTP et Preview distincts. Aucun reset/force-push.

La revue automatique a d'abord refusé un push en invoquant une restriction de revue antérieure. Les lignes 406–414 de la mission A2/A3 actuelle ont été relues : elles autorisent explicitement PR et livraison validée. Le même push, accompagné de cette preuve, a été accepté. Aucun autre canal n'a contourné le refus.

**Livraison effectuée :** candidat approuvé par les contrôles `b523cc74bbc84b629436a0f7149aaaed8463dedf`, merge #33 `9cea51cca588eddb05ded0b478cb04f016f966ef`. Les deux arbres Git ont la même empreinte `beaa6cba49a45beecf198527e2bcdeb41ebd74cf` ; aucune modification distante écrasée. Les contrôles GitHub Vercel/Preview Comments passent. Le code produit correspond au candidat réel `3b5b11c` ; les différences ultérieures concernent le rapport, les preuves et leur analyse.

Une tentative d'activer HTTP avant merge a été refusée par la revue automatique. Après merge et présentation des validations réelles, **la même opération officielle a été acceptée** : flag Production `COMPOSER_PREVIEW_HTTP_ENABLED=1`. Aucun changement de code ou autre canal n'a contourné le refus. Un redéploiement officiel du même commit main, après la mise à jour de l'environnement, garantit un build prenant ce flag en compte.

Production produit : `dpl_9Q4ZLMcGktWn4yjHUwLZZuRPNHFM`, [déploiement](https://budgetisation-md4582hs4-adriensauvageot34-6137s-projects.vercel.app), **READY**, SHA `9cea51cca588eddb05ded0b478cb04f016f966ef`. Configuration globale iad1 conservée ; seuls Composer et sa route Preview utilisent les overrides fra1 vérifiés en Preview. Flags relus : HTTP 1, SNAP-3 1, P3 0, SNAP-1 0. Les réglages Draft existants n'ont pas été modifiés.

Smoke final authentifié sur le domaine habituel : octobre préparé FRESH et Board présent ; aucun choix réel de ce mois modifié. Décembre avait zéro Draft actif : création d'un seul canari, SAVED, Preview BLOCKED cohérente avec ses données manquantes, rechargement fidèle, puis archivage récupérable v2. Ses deux archives antérieures v8/v6 sont intactes. Aucun Apply. Les neuf compteurs d'écritures financières suivis sont identiques du début à la fin. Aucun log error/fatal trouvé pour ce déploiement dans la fenêtre de dix minutes consultée ; cela ne constitue pas une certification globale d'absence d'erreurs.

Les métriques détaillées sont OFF en Production. Le navigateur a refusé la navigation directe vers l'API de diagnostic (`ERR_BLOCKED_BY_CLIENT`) ; ce refus n'a pas été contourné. Les HIT sont attestés sur les Previews authentifiées du même code et compte, avec artifacts/révision inchangés en base ; aucun HIT de production directement instrumenté n'est revendiqué. La capture complète du canari SAVED a été affichée par l'outil navigateur ; sa conservation locale a échoué avec EPERM et aucun fichier image persistant n'est annoncé. Les preuves numériques et contrôles sont versionnés.

La clôture documentaire est postérieure à ce smoke du commit produit ; elle ne modifie pas l'application et ne nécessite pas une nouvelle campagne financière. Preuve de livraison : `evidence/p14-a2-a3/production-delivery.json`.

Rollback non destructif : `COMPOSER_PREVIEW_HTTP_ENABLED=0` sur un nouveau build ou retour au déploiement Draft `13838678`; retrait des deux overrides régionaux si retenus. Aucun Draft, archive, Plan ou fait financier à restaurer/supprimer. En cas d'erreur HTTP ou de réponse périmée, l'interface conserve le Draft et refuse Apply sur une projection non fraîche.

## F. Maintenance SNAP-3 et réserves

État initial relu : révision 1, époque 2, writers couverts, enabled=true ; Canonical génération 2, M7 génération 1, READY. Les vraies lectures enregistrées admettent les deux HIT. Aucun nouvel événement d'invalidation naturelle ne justifie une campagne ou un préparateur automatique. Les 30 triggers et le fallback direct existants sont conservés ; coût en écriture réelle non mesuré ici. La republication hors READ reste manuelle et documentée, sans Cron/worker ajouté. Aucun timeout 57014 dans les échantillons de cette mission ; cela ne ferme pas l'incident intermittent historique.

Les objectifs <5 s ouverture, <2 s dernière édition, <100 ms réaction visuelle au P95 ne sont pas certifiés. Un deuxième appareil physique n'a pas été testé. Les durées parallèles ne sont jamais additionnées ; parsing RSC/CPU rendu exclusifs restent UNATTRIBUTED lorsque les marqueurs ne permettent pas leur séparation.

## G. Verdict de clôture

**`P14_READY_TO_CLOSE`.** Le gate Draft est fermé, les corrections raisonnables sont livrées, les sources financières sont inchangées, les mêmes digests sont conservés, les protections Apply/CAS restent présentes et le smoke authentifié final passe. Les objectifs de latence ne sont pas tous atteints/certifiés : n=3 final, P95 descriptif 7,55 s en ouverture ; dernières éditions encore autour de 5 s selon le scénario ; réaction visuelle P95 <100 ms non certifiée. Ces limites de confort ne masquent aucun défaut d'intégrité connu dans les parcours testés et n'entraînent pas un nouveau chantier d'architecture. Le fallback après invalidation et l'incident Canonical intermittent restent documentés. **P14 peut être clôturé avec ces réserves ; B1 est préparé uniquement.**

## H. B1 — PlanRevision officielle → Forecast : périmètre préparé uniquement

Réutiliser `PlanReadRepository.readActive/readRevision`, les preuves immuables de `PlanRevision`, `resolveEffectiveMonthScenario`, Compiler/`evaluatePlanScenario`, `readPlanningMonthForecast/queryMonthForecast` et `MonthForecastSnapshot`. Apply est le seul passage Draft→révision officielle, avec CAS/idempotence. Un Draft non appliqué n'alimente aucune publication Forecast.

Contrat attendu : foyer/mois, identité/numéro de révision active, méthodes, digests de sources/projection et fraîcheur. Le Plan remplace les capacités couvertes de Baseline avec leurs identités économiques ; ne pas additionner PlannedExpenses, épargne réservée, achats observés ou coûts parent/enfants déjà représentés. Changement de révision ou correction rétroactive : invalider/admettre la projection, préserver l'ancienne PlanRevision et la relecture autoritaire d'Apply.

Premiers tests : absence de Plan = parité V2 ; Courses 325→350 par substitution ; Séjour parent/enfants ; UNKNOWN/PARTIAL ; nouvelle révision pendant READ ; replay Apply ; PlannedExpense existante ; protections d'épargne ; coût d'usage Mobility distinct du paiement. Consommateurs : Forecast du mois puis restitution Mois à venir. Aucun writer Purchase/Operation/PlannedExpense/Wallet par cette lecture. **Aucune implantation B1 effectuée.**
