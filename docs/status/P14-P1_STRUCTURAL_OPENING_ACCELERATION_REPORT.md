# P14-P1 — Accélération de l’ouverture de Composer

Date : 13 octobre 2026. **Verdict final : `SAFE_PROTOTYPE_REAL_GAIN_NOT_YET_CERTIFIED`.** Aucune livraison de Production.

Deux corrections locales conservées. La variante de mesure démontre parité et réduction de travail sur les vrais lecteurs : **11 lectures Canonical et 15 GET PostgREST évités par ouverture**. Sur trois ouvertures chaudes par variante, FRESH médian passe de **20,12 s à 17,46 s**. Le maximum observé passe de 20,18 s à 19,68 s. Un garde de complétude a ensuite été ajouté et testé localement : **la version finale ainsi sécurisée n’a pas été remesurée en Preview**. La cible < 5 s P95 reste non atteinte ; ni le gain stable de 13,2 %, ni son application exacte au code final ne sont certifiés.

## Base et périmètre

Branche locale `codex/composer-v3-p14-p1-structural-opening`.

Base P13 : `7d7e8833305c7479bea7edd1778da46f729a0e68`.
Base A consolidée : `fc8dea20c35521db35c9e64f0bddad1b12e6f53f`.
Les trois patches approuvés ont été repris sans différence : golden `b943c811` → `7b38276`, CSS `8a9adbd6` → `deccdcd`, Express `3f5987ee` → `fc8dea2`.
Leur présence dans A et B exclut l’attribution d’un gain Express à P1.

## Deux réductions retenues

1. **Hydratation Canonical par clé au sein d’une requête autorisée.** Le lecteur Purchase-aware rechargeait des sous-ensembles de composants déjà hydratés par `loadEconomicFacts`. Le cache existant reconnaissait uniquement un ensemble exact de clés. P1 partage les résultats complets par clé, y compris les résultats vides, sans modifier projections SQL, filtres, colonnes, ordre ni bornes des lots. Les groupes ne deviennent réutilisables qu’après la réussite de tous leurs lots. Une erreur reste une erreur.
2. **Ouverture World et Draft en parallèle.** Le Draft n’est pas une dépendance de la lecture de World. La page emploie son authentification existante pour lire le Draft, démarre World immédiatement, puis évalue exactement le Draft sauvegardé. Aucun second World, aucune écriture et aucun calcul financier dans React.

Le partage est limité à une instance de `CanonicalRepository` créée par `authorizedPlanner`. Il est désactivé par défaut pour les autres lecteurs. Il n’existe ni TTL, ni cache global, ni stockage entre requêtes. Une nouvelle ouverture ou un Apply reconstruit ses autorités actuelles. Les segments économiques hors période bancaire restent intégralement hydratés.

**Garde final de complétude :** si un lot atteint le plafond de réponse historique du lecteur (`CANONICAL_PAGE_SIZE = 1000`), ses groupes ne sont pas considérés comme complets. Le premier résultat reste celui du chemin antérieur, sans seconde requête. Un sous-ensemble ultérieur revient au chemin borné original, au lieu d’inventer un résultat vide à partir d’une réponse potentiellement plafonnée. Un test avec 1000 lignes et une clé absente démontre cette récupération. Ce garde ne corrige pas les limites préexistantes de pagination ni une éventuelle configuration PostgREST différente du contrat du lecteur ; il empêche P1 d’aggraver ce cas. Le gain peut diminuer dans les cas plafonnés.

Le drapeau serveur `COMPOSER_P14_P1_READ_REUSE=0` remet simultanément les deux chemins antérieurs ; `1` active P1. Aucun paramètre global Vercel n’a été modifié.

## Pourquoi aucune matérialisation historique supplémentaire

Forecast utilise déjà une publication admissible et les contrôles de génération. Les preuves C3-B ne justifient pas son remplacement. La fraîcheur d’un historique partagé entre requêtes nécessiterait une nouvelle preuve de dépendances complète, absente ici. P1 conserve les deux changements simples dont le travail évité est vérifiable ; aucun World persistant ni infrastructure supplémentaire n’est créé.

Cas de réemploi : les clés déjà complètement lues sont réutilisées ; les clés absentes sont lues par le chemin borné normal ; une nouvelle requête après modification rétroactive n’utilise aucune donnée de la requête précédente. Les recalculs ultérieurs bénéficient de cette suppression de doublons **dans leur propre requête**. P1 ne supprime pas la reconstruction historique entre deux actions distinctes.

## Contrôles locaux exécutés

| Contrôle | Résultat |
|---|---|
| Prototype Canonical P1, lecteur et parseurs réels sur lignes synthétiques | PASS, 13 contrôles finaux, dont complétude au plafond |
| Ouverture P1, Compiler / Finance V2 réels sur World synthétique | PASS, 11 contrôles |
| Canonical batching ; contrats historiques Canonical | PASS |
| Orchestration Composer, publications absentes / invalides, fuseaux et frontières temporelles | PASS |
| Forecast temporal mode ; temporal forecast | PASS |
| Baseline ; Kernel | PASS |
| Parité golden actualisé | PASS, 22 scénarios × 9 empreintes |
| P11 Séjour court ; P13 Apply/CAS/idempotence/relecture | PASS sur fixtures isolées |
| Présentation R6 / C8 | PASS |
| Interactions R3 | 21 PASS ; R3-008 FAIL préexistant `CONTEXT_REFERENCE_OWNER_UNAVAILABLE` |
| TypeScript final | PASS, code de sortie 0 |
| Next complet, dépendances locales normalement installées | PASS, code de sortie 0 |

La fixture couvre les identités, provenance, UNKNOWN/PARTIAL, sous-ensembles partiellement manquants, dates économiques hors mois bancaire, fuseaux, historique absent, changements rétroactifs, chevauchements concurrents, ordre des réponses et échec 57014 sans résultat partiel réussi. Deux instances restent isolées.

La comparaison d’ouverture vérifie le modèle complet, MonthInputs, PlannedExpense, Mobility, une entrée Wallet déclarative, génération Forecast et date. Le cas Wallet n’est pas une mutation ni une certification d’un vrai ledger. Les gates financiers existants complètent ces tests. Les contrôles authentifiés utilisent exclusivement des lectures de données inchangées.

## Mesures locales : synthétiques uniquement

12 paires alternées, mêmes données et retards injectés. Percentiles empiriques par rang le plus proche.

| Indicateur | A | B |
|---|---:|---:|
| Hydratation réelle du repository sur fixture : appels du client simulé | 34 | 23 |
| Corps JSON simulés | 620 422 octets | 413 646 octets |
| Hydratation finale avec garde, P50 / P95, délai de 8 ms par lecture simulée | 226,36 / 250,57 ms | 178,80 / 216,16 ms |
| Ouverture, P50 / P95, World 50 ms et Draft 30 ms injectés | 126,30 / 131,36 ms | 81,48 / 94,90 ms |

Ces mesures prouvent un mécanisme et sa parité, pas la latence des vrais lecteurs ni un pourcentage de gain réel. Le premier passage avant le garde donnait 118,95 / 151,94 ms contre 81,62 / 107,69 ms ; les deux journaux sont conservés. La variance locale et les contrôles exécutés en parallèle excluent la comparaison absolue entre ces deux passages. Les nombres de lectures et d’octets restent strictement identiques.

## Protocole réel

Deux Previews protégées du même arbre P1 et des mêmes sondes temporaires : A avec drapeau `0`, B avec `1`, région imposée au déploiement `fra1`. Même compte admissible, même mois octobre 2026 et mêmes empreintes financières comparées en mémoire. Aucun secret, identifiant privé, montant ou payload financier n’est conservé dans les preuves.

| Variante | Déploiement de comparaison |
|---|---|
| A | `dpl_CdE6aTLSHPneYbC5Yok7ci39Po1n` |
| B | `dpl_42YUZSGHvTxdfhLemGnZ1MMnbf5N` |

La sonde serveur mesure les fonctions réelles avec `performance.now`, compte les appels fetch Supabase et les octets des réponses clonées. Les durées de fetch incluent transport, PostgREST, SQL et attente : elles ne sont pas des temps SQL isolés. Les spans imbriqués et concurrents ne s’additionnent pas en temps mural.

**Correspondance du code :** A et B ont été construits à partir du même arbre produit et de la même sonde v2, avec le seul drapeau `0` / `1` différent. Leurs sources sont attestées par `measured-product-source-hashes.json` et `probe-source-hashes-v2.json`. Après cette série, deux fichiers produit ont reçu le garde de complétude : `in-batches.ts` et `repository.ts`. Les empreintes finales sont séparées dans `product-source-hashes.json`. Les chiffres authentifiés ci-dessous concernent donc **la variante avant ce garde**, pas un test distant du commit final. Le partage normal et le fallback sont vérifiés localement ; aucune nouvelle série de production n’a été déclenchée pour effacer cette limite.

La sonde navigateur marque le premier frame après hydratation de Composer et le premier frame FRESH. Elle publie seulement ces durées et des valeurs Navigation Timing dans le DOM. « Board utilisable » signifie ici DOM rendu et gestionnaires React montés ; les mutations de la Preview de mesure sont volontairement refusées. Le code produit conserve ses transports normaux. Les délais de Codex sont exclus. Les lectures de connexion / navigation SPA sont des échauffements ; seules les ouvertures complètes par Reload entrent dans la série chaude. La série reste courte et ne peut certifier un P95 robuste ni l’ensemble des appareils. L’état de visibilité physique de chaque onglet n’a pas été contrôlé comme sur un poste de mesure dédié.

Les actions Composer des Previews sont remplacées par un refus explicite ; le transport Draft est déconnecté. Tout POST/PATCH/DELETE PostgREST dans le contexte sondé est refusé avant envoi. La connexion Auth normale reste possible. Les sondes sont retirées du code produit après construction des Previews et leur générateur réversible est conservé comme prototype.

Une première sonde n’exposait pas ses marques au DOM, le navigateur d’outillage ne donnant pas accès direct à `performance`. Les deux Previews ont été reconstruites avec la même correction de sonde ; les anciens échauffements sont exclus de la comparaison navigateur. La revue automatique a refusé un lien d’accès temporaire Vercel ; l’accès final utilise la connexion normale protégée.

## Mesures authentifiées

### Ouvertures complètes chaudes

Ordre borné : A1, B1, B2, A2, A3, B3. Aucun chargement simultané A/B. Navigateur intégré Codex sur Windows ; même mois, compte et région. Node Vercel 24.x ; build local Node 22.18.0 / Next 16.2.6. Les marques navigateur sont relatives au début de la navigation complète. Les contextes financiers comparés ont les mêmes empreintes à toutes les neuf ouvertures, y compris les échauffements.

| Observation | Board / FRESH A | Board / FRESH B | World A | World B |
|---|---:|---:|---:|---:|
| 1 | 18,851 / 18,851 s | 19,681 / 19,682 s | 13,953 s | 12,938 s |
| 2 | 20,117 / 20,117 s | 17,356 / 17,356 s | 15,394 s | 13,855 s |
| 3 | 20,177 / 20,177 s | 17,461 / 17,461 s | 17,027 s | 12,696 s |

La première paire ne montre pas de gain navigateur. Les deux suivantes en montrent un. Ce résultat et la variabilité interdisent une promesse uniforme de performance.

### P50 / P95 empiriques

**n = 3 par variante ; le P95 est ici simplement le maximum observé.** Aucun intervalle de confiance robuste n’est disponible. Le mélange avec les anciennes mesures C4 chronométrées par l’outil serait incorrect.

| Indicateur | Avant P1, P50 / P95 | Après P1, P50 / P95 | Écart médian |
|---|---:|---:|---:|
| Board hydraté | 20,117 / 20,177 s | 17,461 / 19,681 s | −2,656 s |
| Preview FRESH / ouverture complète | 20,117 / 20,177 s | 17,461 / 19,682 s | −2,656 s, −13,2 % observés |
| Fonction serveur sondée, avant sérialisation Next | 17,156 / 18,442 s | 14,802 / 15,284 s | −2,354 s |
| readWorld complet | 15,394 / 17,027 s | 12,938 / 13,855 s | −2,457 s |
| Baseline : lecteurs + attente/admission Forecast | 15,329 / 16,978 s | 12,900 / 13,821 s | −2,429 s |
| Forecast | 3,297 / 3,377 s | 3,690 / 3,745 s | +0,393 s |
| Compiler / Finance V2 | 339,59 / 405,41 ms | 323,45 / 329,49 ms | −16,14 ms ; code financier inchangé |
| Plus long appel Canonical de chaque ouverture | 4,734 / 9,671 s | 4,453 / 6,709 s | −0,281 s ; cause SQL non isolée |
| Lectures physiques Canonical | 247 | 236 | −11, −4,45 % |
| GET PostgREST | 299 | 284 | −15, −5,02 % |
| Appels Supabase, Auth compris | 303 | 286 | −17 |
| Corps des réponses Supabase, Auth compris | 11 879 055 octets | 11 746 446 octets | −132 609 octets, −1,12 % |
| SELECT SQL ; durée SQL | NOT_MEASURED / NOT_ISOLATED | NOT_MEASURED / NOT_ISOLATED | aucune extrapolation depuis les GET |
| Sérialisation Next isolée | NOT_ISOLATED | NOT_ISOLATED | le Navigation Timing inclut le flux reçu |
| Timeouts dans la série chaude | 0/3 | 0/3 | aucune réparation de fiabilité revendiquée |

Les durées inclusives cumulées des requêtes Canonical ont une médiane de 278,41 s pour A et 248,09 s pour B. **Ce ne sont ni du SQL additionné ni un temps mural** : les appels concurrents se chevauchent. Le temps mural World observé est bien 15,39 / 12,94 s. L’attribution séparée réseau / PostgREST / SQL n’est pas disponible dans cette instrumentation.

`loadMonthForecastAuthorities`, propriétaire publié commun aux sources de Baseline, présente un P50 de 4,723 / 4,713 s et des maxima de 5,338 / 9,981 s. Le coût des autres propriétaires est couvert par les spans inclusifs et les fetch, sans chronométrage autonome de chaque FOOD/Persona/Renewal/Mobility. Aucun gain de ce côté n’est attribué à P1. Forecast était déjà mutualisé par Express dans A.

La construction de modèle UI mesure environ 6,21 / 3,15 ms médians ; aucune modification de ce calcul n’est revendiquée. Les réponses de navigation encodées sont de 47 985–48 533 octets pour A, 48 304–48 320 pour B. Le premier octet arrive tôt grâce au streaming ; il ne marque pas un Board FRESH.

### Travail réellement évité

Chaque ouverture B supprime un lot dans chacune de ces onze lectures : opérations, coût économique, timing économique, contrôle timing, réconciliation, liens personne, lieu, allocations, items, composants de paiement, utilisations cash. Les quatre GET restants et deux appels Auth évités proviennent de la seconde autorisation devenue inutile pour lire le Draft. Les détails sont dans `evidence/p14-p1/real-reader-count-differences.json`.

Le poids évité réel est modeste : le sous-ensemble relu dans ces données est beaucoup plus petit que celui de la fixture. **34 → 23 simulés n’est pas une division par deux des lectures réelles.** Les autres lectures historiques demeurent.

### Échauffements et limites

Premières ouvertures authentifiées après construction : World A2 39,07 s, World B2 30,07 s ; l’ancienne sonde A1 a mesuré 36,51 s. Ces lectures sont conservées mais ne certifient pas un démarrage à froid Vercel. Leurs marques navigateur incluent connexion/SPA et ne sont pas comparées aux Reload.

Neuf ouvertures terminées au total, toutes FRESH, zéro 57014 et zéro tentative d’écriture PostgREST bloquée. Une observation du navigateur a dépassé son délai CDP ; la même ouverture a été relue après achèvement, **sans relancer de mutation ni de chargement**. La série s’arrête à trois paires ; aucun benchmark SQL supplémentaire n’est exécuté.

La comparaison de fraîcheur réelle est faite sur données inchangées. Les changements de sources et la concurrence sont prouvés sur fixtures, pas par mutation du projet principal. Aucun Apply, import, publication, PlanRevision, dépense, sauvegarde/archivage de Draft ou mutation financière n’a été déclenché. Pas de comptage global des tables de production : la preuve est le chemin de lecture contrôlé, les transports coupés et les invariants testés.

## Fichiers et rollback

Code produit : `src/server/canonical/in-batches.ts`, `repository.ts`, `src/server/phase2/planner/runtime.ts`, nouveau `composer-opening.ts`, `src/app/mois-a-venir/composer/page.tsx`.

Prototypes : `scripts/check-composer-p14-p1-read-reuse.mjs`, `check-composer-p14-p1-opening.mjs`, `fixtures/canonical-p14-p1.mjs`, `p14-p1-instrument-preview.mjs`. Les statistiques sont recalculables par `node scripts/analyze-composer-p14-p1-results.mjs`, à partir des observations assainies versionnées.

Rollback : drapeau `0` lors d’un déploiement ultérieurement autorisé, ou revert du commit P1. Aucun changement de schéma ni donnée à restaurer. Les trois commits de consolidation restent distincts et réversibles séparément.

## Décision et suite

**`SAFE_PROTOTYPE_REAL_GAIN_NOT_YET_CERTIFIED` pour la version finale.** Les réductions de travail et la parité de la variante mesurée sont démontrées ; un gain médian est observé sur les vrais lecteurs et au navigateur. Les changements sont conservés car ils sont complémentaires, locaux, sans nouvelle infrastructure et réversibles. Le garde final ne permet pas de revendiquer ces mesures pour un arbre produit identique : ce point reste explicitement non certifié. La contribution temporelle individuelle de chaque réduction n’est pas séparée dans l’expérience combinée ; seules leurs suppressions d’appels respectives sont identifiées. Le temps Draft évité varie de ~0,1 à 0,67 s et la mutualisation Canonical reste le levier principal développé.

Le timeout Canonical demeure un incident ouvert, de cause inconnue : P1 réduit certains appels mais ne prétend pas le réparer. L’objectif < 5 s P95 n’est pas acquis. Il manque encore 14,68 s au maximum chaud B observé pour arriver à 5 s ; ce n’est pas une prévision de gain futur. Réserves ouvertes : série de trois paires, démarrage froid non certifié, gros Draft composite non mesuré, appareil physique supplémentaire non testé, partage inter-requêtes absent et R3-008 préexistant.

**Prochaine réduction concrète recommandée : les hydratations historiques des lieux/événements par identifiant au sein de World**, sous la même preuve d’équivalence et de complétude que P1. Sur B, `location_occurrences` conserve 22 GET, `life_event_participations` 20, `life_events` 11, environ 2,31 Mo cumulés. Identifier et partager les sous-ensembles admissibles dans ces trois chemins évitera des transports supplémentaires si leur chevauchement est confirmé. Ces nombres montrent le travail restant ; ils ne démontrent pas encore un gain à développer ni une cause de timeout. Cette extension n’a pas été implantée dans P1.

Une publication historique ciblée ne devient justifiée qu’après démonstration du coût résiduel et d’un manifeste complet de dépendances (révisions, timing rétroactif, personnes/lieux, génération publiée et permissions). Aucune matérialisation supplémentaire n’est recommandée pour exécution immédiate : on ne dispose pas ici d’une preuve d’invalidation suffisante pour afficher FRESH entre requêtes. Il n’y a pas lieu de refaire le tournoi architectural.

Preuves assainies versionnées : `docs/status/evidence/p14-p1` (observations, différences de lectures, statistiques, journaux de régressions, build et empreintes des sources). Les journaux de déploiement et références complets restent dans `outputs/p14-p1` du dossier de mission Codex, hors checkout produit.

Commandes de vérification réellement exécutées : `node scripts/check-composer-p14-p1-read-reuse.mjs`, `node scripts/check-composer-p14-p1-opening.mjs`, les onze scripts nommés dans `evidence/p14-p1/regressions.json`, `node scripts/check-phase2-planner-interactions.mjs`, `node node_modules/typescript/bin/tsc --noEmit`, `node node_modules/next/dist/bin/next build`. La matrice globale a été exécutée avant le garde ; les 13 contrôles Canonical P1 et le batching ont été rejoués après celui-ci, ainsi que TypeScript/build. Les autres calculs et leurs chemins de fixture n’ont pas changé. Ce résultat n’est pas une certification CI.

État prévu de clôture : commit local sur la branche dédiée, worktree propre, aucune sonde appliquée dans le code produit. Pas de push, PR, fusion, migration, promotion Production, P14-P2 ni P15. La région observée `fra1` concerne seulement les Previews de cette mission.
