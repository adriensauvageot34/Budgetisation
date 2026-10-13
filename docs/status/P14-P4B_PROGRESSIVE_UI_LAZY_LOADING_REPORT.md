# P14-P4B — UI progressive et chargement des éditeurs

Date : 13 octobre 2026. Branche : `codex/composer-v3-p14-p4b-progressive-ui`. Base exacte : `33fc974fb698bed46affbd823b6bf85942066575` (P4A). **Verdict : `SAFE_LOCAL_IMPROVEMENT_REAL_GAIN_NOT_CERTIFIED`.**

Composer charge moins de JavaScript et monte moins d'assets inutiles. Les parcours édités et la conservation passent sur les fixtures. L'amélioration globale de latence visuelle et la cible P95 < 100 ms ne sont pas certifiées. Les séries défavorables sont conservées et présentées ci-dessous.

## A. Référence, portée et méthode

L'ascendance vérifiée est P4A `33fc974` → P3 `aed9946` → P2 `3705515` → P1 `a934f60` → Express consolidé `fc8dea2` → CSS `deccdcd` → golden P11 `7b38276` → P13 `7d7e883`. Le SHA de l'ancienne branche Express `3f5987e` n'est pas un ancêtre littéral : son changement a été intégré par le commit consolidé. Le worktree était propre au départ. P4A, ses index, callbacks, géométrie et montage des pages sont conservés.

`COMPOSER_P14_P3_HISTORICAL_REUSE=0` dans le serveur de comparaison ; aucun réglage P3 activé dans un fichier d'environnement. P1/P2 gardent les mêmes réglages dans les variantes. Aucun code World, Canonical, Forecast, Baseline, Compiler, Finance V2, Scheduler, Apply/CAS, writer Draft, autorisation ou migration n'est modifié.

Le banc utilise React en mode production, sans Strict Mode et sans Profiler dans les mesures finales. Il compile les sources Composer P4A avec `git show` et les sources candidates avec le même esbuild. Le serveur, les données synthétiques et les appels Compiler/V2 restent communs. Le build Next complet est exécuté séparément ; **le banc React n'est pas une mesure du runtime Next authentifié**. Aucun gain Supabase/Vercel réel n'est revendiqué.

Les horodatages proviennent de `performance.now()`, des commits React, MutationObserver et de deux rAF. `paintUpperMs` est une borne après une occasion de peinture, pas la mesure d'un pixel ni la durée d'une animation. P50/P95 : rang le plus proche. Les clics mesurés sont des événements navigateur `isTrusted=true`. Les appels Codex ne fournissent aucune métrique produit. Les JSON bruts sont dans [evidence/p14-p4b](evidence/p14-p4b/).

## B. Code et chargement des éditeurs

Quatre éditeurs sont chargés à la demande par imports explicites : Visite famille, Séjour court, Cadeau, contexte générique. Un import en cours ou réussi est réutilisé. Focus clavier, pointer-down, drag-start et survol de 150 ms préparent uniquement le module concerné. Le survol abandonné est annulé avant le départ de l'import ; un import déjà parti reste réutilisable. Aucun World, prix historique ou devis Mobility n'est préparé par ces handlers.

**Soirée reste statique.** L'expérience initiale à cinq modules lazy a montré une première arrivée du formulaire à 2 782 ms sur une observation, dont plusieurs chunks attendaient environ 2 334 ms derrière le calcul PGlite du même processus. Cette observation unique ne mesure pas un coût intrinsèque de l'import. La décision prudente est de garder le parcours fréquent disponible et de séparer le serveur statique de la simulation dans les essais suivants. Les composants communs ne sont pas dupliqués à la main.

| JavaScript du banc de production React | P4A | P4B final | Lecture |
| --- | ---: | ---: | --- |
| Initial décodé | 480 927 octets | 417 543 octets | −63 384 octets, −13,2 % |
| Initial gzip niveau 9, mesuré sur fichiers | 146 027 octets | 131 559 octets | −14 468 octets, −9,9 % |
| Fichiers JS initiaux | 1 | 4 | Dépendances communes partagées |
| Tous les fichiers JS si tous les éditeurs sont ouverts | 480 927 octets / 1 fichier | 486 089 octets / 11 fichiers | Le découpage ajoute un petit coût total |
| Transfert initial observé HTTP gzip, série 20 cartes | 146 667 octets | 133 052 octets | Resource Timing ; en-têtes inclus |

Les transferts de la dernière ligne correspondent à l'arbre juste avant la restriction du contrôle de digest au seul état d'erreur. Cette restriction ajoute 11 octets décodés au bundle final et n'affecte pas le chemin mesuré sans transport Draft. [Bundles finaux](evidence/p14-p4b/bundles-final.json). Le total de 77 Ko de sources éditeurs n'est jamais présenté comme une économie réseau.

Le build **Next 16.2.6** final passe avec code 0 et route Composer dynamique. Les tailles du banc esbuild ne sont pas présentées comme celles du réseau Next/Vercel. Temps précis d'évaluation JS, comparaison réseau Next authentifiée et distribution P95 de première ouverture froide des cinq formulaires : **NOT_RUN**. Des arrivées ponctuelles de Cadeau (184 ms avec origine statique séparée) et de Soirée (313 ms dans l'expérience initiale retenue) ont été observées ; elles ne sont pas des percentiles ni une comparaison froide représentative.

### Erreur de chunk et récupération

Le panneau et sa carte sont créés avant le module. Le fallback accessible garde le bouton Fermer et n'affiche aucun formulaire validable prématurément. Une résolution tardive ne rouvre pas un panneau fermé et ne remplace pas l'éditeur suivant.

Le vrai test de 503 sur le chunk Cadeau a montré que le navigateur peut garder l'import en erreur. Le retry applicatif seul ne garantit donc pas la reprise. Le panneau propose également **un rechargement explicite uniquement si le Draft courant est confirmé SAVED, de même digest, en ligne et hors comparaison**. Le clic revérifie le digest courant avant le rechargement. Aucune nouvelle persistance locale sensible n'est ajoutée et aucune mutation n'est rejouée aveuglément. Ce contrôle de digest ne s'exécute pas dans le chemin normal sans erreur.

**PASS fixture navigateur :** même Draft `fc99df84-71c4-496b-9a60-e84f8655e029`, version **1 → 1**, digest `a6f9ff8ecf503294edc45ce5ffff478420b199ed288a7cfcc88bbcd38e1dbbb3`, même carte Cadeau `55e89ab1-25b1-47ac-80ad-746b81ae8373`, formulaire rouvert après rechargement. [Avant](evidence/p14-p4b/chunk-recovery-before.json), [après](evidence/p14-p4b/chunk-recovery-after.json), [capture](evidence/p14-p4b/chunk-error.png). Aucun rechargement automatique ni nouvelle carte.

## C. Bibliothèque catégorisée

Les 11 sections publiées restent la source de regroupement : 9 familles, contrôles mensuels et équipements. Les **143 assets** de la fixture (13 contextes, 16 contrôles/réservations, 114 options) demeurent dans le modèle. Au repos, seule la section SOCIAL est ouverte : **143 → 1 boutons et icônes d'assets montés**. Les autres groupes ont leurs titres, nombres et `aria-expanded`, avec des grilles vides. Aucun repli CSS ne garde leurs boutons cachés dans le DOM.

Sur la fixture initiale de 40 éléments et 1280×720, le DOM Composer observé passe de **7 037 → 2 115 nœuds**. La réduction vient principalement de la bibliothèque. L'ouverture du groupe Équipements peut toujours monter ses 114 options ; elles ne sont pas supprimées pour améliorer le chiffre.

**PASS navigateur :** catégorie ouverte/fermée, état restauré après vidage de recherche, recherche globale « restaurant » donnant 5 résultats dans FOOD/controls/options, résultats d'une catégorie fermée, ArrowDown depuis le champ, Home/End et flèches sur les assets, Tab vers le premier asset du groupe ouvert, Entrée pour admettre la Visite. Le clavier garde un point d'entrée par groupe ouvert. Après ces interactions purement locales, la trace de transport reste vide. Le code ne modifie pas `dropCapabilities`.

| Résolution de contrôle final | Largeur Composer / scrollWidth | Résultats « restaurant » | Assets au repos | Sauvegarde |
| --- | --- | ---: | ---: | --- |
| 1920×1080 | 1872 / 1872 | 5 | 1 | SAVED |
| 1728×900 | 1680 / 1680 | 5 | 1 | SAVED |
| 1280×720 | 1232 / 1232 | 5 | 1 | SAVED |
| 768×1024, contrôle limité | 720 / 720 | Champ et 11 groupes accessibles | — | Aucun changement métier |

Contrôles de géométrie et captures : [desktop-controls.json](evidence/p14-p4b/desktop-controls.json), [1280](evidence/p14-p4b/library-1280-final.png), [1728](evidence/p14-p4b/library-1728-final.png), [1920](evidence/p14-p4b/library-1920-final.png). Aucun travail de refonte mobile. Percentiles d'ouverture de catégorie, de recherche et nombre de rendus React : **NOT_CERTIFIED / NOT_RUN comme métriques isolées**. Leur fonctionnement a été exécuté ; la réduction du DOM est mesurée.

**Drag : NOT_CERTIFIED.** Les essais natifs depuis Séjour court, puis depuis la poignée d'une Visite vers un bord de page, n'ont produit ni dépôt ni passage de page dans le navigateur de contrôle. Le drag-source est publié et `draggable=true`, mais le dwell de 600 ms n'a pas été effectivement démontré. Aucun PASS de drag entre pages n'est déduit du code ou des scripts. La réserve P4A reste ouverte ; aucune modification des mécanismes de drag n'est ajoutée pour contourner l'outil.

## D. Composants secondaires et navigation

Le démontage des sous-sections de formulaires n'est pas retenu : leur contribution au délai total n'a pas été isolée. Les états contrôlés, sections, prix et participants des composants métier existants restent inchangés. Aucun découpage supplémentaire des icônes ou des panneaux explicatifs sans gain net démontré.

Le prefetch de route Next n'est pas retenu. Il peut charger un payload RSC ; la page Composer dynamique exécute `authorizedPlanner()` et `readComposerOpening()` pour le construire. Aucun chemin actuel n'établit une borne sûre de préparation limitée aux chunks. Les liens existants restent des liens, et aucun `router.prefetch()` n'est ajouté. Référence officielle : [prefetching Next](https://nextjs.org/docs/app/guides/prefetching). L'expérience D est abandonnée sans lancer une reconstruction World pour la mesurer.

## E. Benchmarks, résultats et limites

### Première expérience dense, avant les derniers garde-fous

Même fixture, React production, 1280×720, 20 cycles par variante :

| Geste, borne de peinture P50 / P95 | P4A | P4B expérimental |
| --- | ---: | ---: |
| Ajouter Soirée, 40 cartes | 262,8 / 313,2 ms | 162,7 / 202,9 ms |
| Fermer le panneau | 107,7 / 133,1 ms | 32,7 / 43,4 ms |
| Undo | 28,8 / 85,5 ms | 33,0 / 47,0 ms |

[P4A](evidence/p14-p4b/p4a-add40.json), [P4B](evidence/p14-p4b/p4b-add40.json). Cette expérience précède le point d'entrée clavier par groupe et le rechargement protégé après erreur de chunk. **Elle n'est pas attribuée au commit final.** Elle montre une piste utile, pas une certification finale ni un résultat inférieur à 100 ms.

### Série 20 cartes sur le chemin final normal

Serveur synthétique commun, même résolution 1280×720, n=20 par geste. Le dernier contrôle ajouté au commit se court-circuite lorsque le transport Draft est absent, comme dans ces mesures.

| Geste, borne de peinture P50 / P95 | P4A | P4B |
| --- | ---: | ---: |
| Ajouter Soirée | 267,3 / 592,0 ms | 630,0 / 1 918,6 ms |
| Fermer | 218,5 / 339,8 ms | 138,3 / 1 833,6 ms |
| Undo | 92,2 / 293,3 ms | 70,8 / 1 959,3 ms |

[P4A final](evidence/p14-p4b/p4a-night20-final.json), [P4B final](evidence/p14-p4b/p4b-night20-final.json). **Cette série défavorable est conservée.** Elle ne justifie aucune annonce de gain utilisateur. Des essais bornés avec attente du marqueur avant le geste suivant ont reproduit des délais proches de 2 s aussi sur P4A et des interruptions CDP d'entrée, tandis que le DOM était modifié bien plus tôt. Le navigateur pouvait annoncer `document.visibilityState=visible` tout en n'étant pas présenté. Le passage à un onglet explicitement présenté n'a pas suffi à stabiliser les mesures. Une calibration sans Composer a donné des frames ordinaires autour de 16,6 ms ; elle ne prouve pas la cause des retards dans Composer.

La cause de cette variabilité reste **non déterminée** : charge, cadence du navigateur de contrôle, interactions outil et rendu ne sont pas séparés suffisamment. Les essais de performance supplémentaires ont été arrêtés. [Diagnostics P4A](evidence/p14-p4b/p4a-active-diagnostic20.json), [P4B](evidence/p14-p4b/active-browser-diagnostic20.json), [calibration](evidence/p14-p4b/raf-calibration.json). Les durées des gestes Codex ne remplacent pas les mesures manquantes.

Les cinq ouvertures par type Visite/Séjour/Cadeau/générique de la référence sont conservées dans [p4a-other20-final.json](evidence/p14-p4b/p4a-other20-final.json). La série candidate correspondante, les séries 40 cartes du SHA final et les percentiles aux deux autres grandes résolutions ne sont pas certifiés. On ne compare pas une première ouverture froide, une réouverture et un préchargement réussi comme une seule distribution. Heap et GC ne démontrent aucune baisse durable de mémoire.

## F. Séance métier et régressions

**EXECUTED_PASS_LIMITED_FIXTURE :**

- Ajout Soirée → panneau pendant PENDING → nom et repas UNKNOWN → fermeture ; le parent n'ajoute aucun coût propre.
- Visite famille → panneau riche, nom et proche admissible → fermeture/réouverture ; même intention et date absente.
- Séjour court → hébergement « Chez un proche », composant Courses, prix UNKNOWN, quantité 1 → Undo/Redo → SAVE → Reload → réédition fidèle. [Relecture navigateur](evidence/p14-p4b/stay-browser-roundtrip.json).
- Cadeau → destinataire Alice Fixture, occasion Anniversaire, classification Livre et libellé libre → sauvegarde, Undo/Redo et réédition fidèle ; date vide et prix inconnu conservés. [JSON persisté synthétique](evidence/p14-p4b/conservation.json).
- Chargement familial volontairement retardé → fermeture immédiate → autre intention ; l'arrivée tardive ne remplace pas le formulaire générique, n'ouvre pas de nouveau panneau et ne crée pas de doublon.
- Navigation des pages, recherche globale, palettes existantes et sauvegarde indépendante de Preview. Apply désactivé pendant PENDING. La séance part de 20 éléments et atteint 25 en admittant cinq intentions ; la série dense exploratoire part de 40. Une séance métier exhaustive au SHA final à 40 éléments reste non certifiée.

Le transport du banc interdit APPLY. À la fin du scénario navigateur : **0 Plan, 0 PlanRevision, 0 RPC Apply, 0 écriture distante, canaries historiques inchangés**. Les seules écritures de cette séance sont des SAVE dans le store Draft synthétique. [Preuve](evidence/p14-p4b/zero-financial-writes.json). Les Apply/Reload des régressions sont exclusivement en PGlite.

| Contrôle réellement exécuté | Résultat et portée |
| --- | --- |
| C8, dont C8-017 | PASS, 35 contrôles fixture ; aucun `@media` ajouté |
| R6-P45 / présentation / UI atomique | PASS, 30 / présentation / 14 contrôles locaux |
| Golden 22×9 | PASS, sources et digests financiers synthétiques |
| P11, P12, P13, Contexts | PASS, Kernel/C0/Apply/CAS/compatibilité et UNKNOWN sur fixtures/PGlite |
| P1 read reuse, P3 history | PASS fixture ; prototype P3 non activé pour la comparaison |
| P2 mutation, scheduler, présentation, durable | PASS, y compris hors ordre, Undo et reprise ; aucune modification de ces implémentations |
| Chargement P4B | PASS local : imports sans appel financier, déduplication, exports et retry applicatif ; récupération navigateur via Draft confirmé |
| Interactions R3 | FAIL préexistant `R3-008 CONTEXT_REFERENCE_OWNER_UNAVAILABLE` ; autres contrôles exécutés PASS |
| TypeScript final / Next complet final | PASS, codes de sortie 0 ; dépendances existantes réutilisées, pas une certification CI |
| Auth réel, autre appareil, production | NOT_RUN |
| Drag physique / dwell interpage | NOT_CERTIFIED |

[Régressions et journaux](evidence/p14-p4b/regressions.json). Le premier typecheck avait signalé une condition toujours vraie après le retour de Soirée statique ; elle est retirée et le contrôle final passe. Aucun nouveau FAIL sémantique connu. Les réserves de performance et de drag restent des limites de préparation à la livraison, pas des PASS inventés.

## G. Décision, fichiers et rollback

**`SAFE_LOCAL_IMPROVEMENT_REAL_GAIN_NOT_CERTIFIED`.** Les gains de poids initial et de DOM sont établis. Les parcours conservés et le recovery après commit sont prouvés localement. La fluidité globale et la non-dégradation du premier formulaire à froid dans un environnement représentatif restent à vérifier. Le candidat est préparé pour revue locale ; aucune activation de production n'est demandée sur la base de ces seules mesures.

Produit : `editor-chunks.ts`, `composer-shell.tsx`, `composer-library.tsx`, quatre règles CSS de présentation. Test : banc partagé P4A/P4B, serveur statique loopback avec gzip et injection contrôlée d'échec/délai, sondes et analyseurs. `use-committed-event.ts`, `render-index.ts`, Board/Carousel et tous les propriétaires financiers restent identiques à P4A.

Rollback : revert du commit P4B. Aucun rollback SQL et aucune suppression de Draft ou de Plan. Le regroupement et les imports ne modifient aucun état persistant. Le rechargement après erreur attend une sauvegarde confirmée ; garder la page ouverte lorsque cette confirmation est absente.

Reproduction locale : `PLANNER_P14_P4A_MEASURE=1`, `PLANNER_P14_P4B_SPLIT=1`, `COMPOSER_P14_P3_HISTORICAL_REUSE=0`, `PLANNER_BROWSER_TOOLS` pointant vers les outils esbuild existants. Référence `PLANNER_P14_P4A_VARIANT=P4A`, candidat sans cette variable. `PLANNER_C8_BUILD_ONLY=1` construit sans lancer de fixture ; les origines statiques séparées se servent avec `serve-composer-p14-p4b-static.mjs`. Le host accepte `PLANNER_C8_REFERENCE_ASSET_ORIGIN` (`?ui=P4A`) et `PLANNER_C8_FAULT_ASSET_ORIGIN` (`?ui=FAULT`). `?durable=1` est exclusivement un store synthétique. Analyses : `node scripts/analyze-composer-p14-p4b-bundles.mjs <sortie-reference> <sortie-candidat>` et `node scripts/analyze-composer-p14-p4a-results.mjs <preuve.json>`.

## H. Points d'entrée P4C — documentation uniquement

| Intention UI | Déjà disponible localement | Lecture distante possible, à cadrer ultérieurement |
| --- | --- | --- |
| Type de carte / Library | Registre publié, sections, capacités, identité de template | Connaissance propre à une famille si absente ; scope/date/génération requis |
| Ouverture du panneau | Draft et sélections, champs, CardKnowledge déjà reçu | Un owner manquant ne doit pas produire un montant inventé |
| Participants | Personnes du foyer, références admissibles et texte libre | Validation serveur lors de la décision ; pas d'inférence de participants depuis un trajet |
| Lieu | Options Mobility reçues, références existantes | Lecteur de lieux/autocomplétion selon intention ; pas de TomTom anticipé dans P4B |
| Transport | Mode choisi, véhicule/options déjà reçus, devis déjà présents | Devis Mobility admissible à identité/version/date correctes ; carburant utilisé distinct de payé |
| Champs financiers | Décisions et provenance, UNKNOWN, références affichées | Lecteur propriétaire de prix/référence ; S2 et confirmation explicite conservés |

Aucun de ces lecteurs ni prefetch financier n'est développé ici. Aucun snapshot, cache World, push, PR, merge, migration ou déploiement. **STOP après P14-P4B.**
