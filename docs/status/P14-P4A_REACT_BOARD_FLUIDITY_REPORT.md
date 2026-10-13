# P14-P4A — Fluidité du Board React

Date : 13 octobre 2026. Base P3 : `aed99461ee006654eb5a8d4a265e641f6e25d3fb`. Branche : `codex/composer-v3-p14-p4a-react-fluidity`. P3 historique désactivé (`COMPOSER_P14_P3_HISTORICAL_REUSE=0`). Aucun changement du Compiler, de Finance V2, de World, du Scheduler, d'Apply/CAS, du Draft ou des owners financiers.

## Méthode et portée

Les deux variantes sont construites à partir de la même base, du même mois synthétique et du même hôte de fixture local, en mode `NODE_ENV=production`, React non Strict et sans Profiler dans les mesures finales. La variante de référence charge les sources Composer du commit P3 par `git show`; le candidat charge le worktree. Les clics sont réalisés dans un véritable navigateur visible. Les mesures sont prises dans la page avec `performance.now()`, MutationObserver, et deux `requestAnimationFrame`. Le dernier marqueur est une **borne supérieure après une occasion de peinture**, pas un horodatage de pixel affiché ni la fin de l'animation FLIP de 220 ms. P50/P95 utilisent le rang le plus proche. Les fichiers JSON bruts sont dans [evidence/p14-p4a](evidence/p14-p4a/). Recalcul : `node scripts/analyze-composer-p14-p4a-results.mjs <fichier.json>`.

Les séances de navigation comportent 40 clics alternant page suivante/précédente; l'ajout dense comporte 20 cycles ajout Soirée → fermeture → Undo, soit 20 échantillons par geste. La fixture comprend Baseline, Soirées, Visites famille, Séjours courts, composants, clusters, réservations et cartes protégées. La charge de Preview est locale et asynchrone. Ce n'est ni le runtime Next complet dans le navigateur, ni une mesure authentifiée Supabase ou de production. Le build Next est contrôlé séparément. Après la précision utilisateur, aucune nouvelle optimisation mobile/tablette n'a été menée : la décision produit porte sur le bureau.

## Résultat mesuré

| Fixture et geste | P3 P50 / P95 (ms) | P4A P50 / P95 (ms) | n par variante | Provenance |
| --- | ---: | ---: | ---: | --- |
| 20 éléments, navigation, 1280×720 | 25,1 / 32,8 | 20,6 / 32,4 | 40 | `p3-nav20-1280.json`, `p4a-nav20-1280.json` |
| 40 éléments, navigation, 1280×720 | 62,1 / 73,3 | 36,4 / 61,5 | 40 | `p3-nav40-1280.json`, `p4a-nav40-1280.json` |
| 40 éléments, navigation, 1728×900 | 76,1 / 85,5 | 37,4 / 62,4 | 40 | `p3-nav40-1728.json`, `p4a-nav40-1728-prior.json` |
| 40 éléments, navigation, 1920×1080 | 79,6 / 85,7 | 39,6 / 51,8 | 40 | `p3-nav40-1920.json`, `p4a-nav40-1920-prior.json` |
| 40 éléments, ajout Soirée, 1280×720 | 313,1 / 352,5 | 229,7 / 281,8 | 20 | `p3-add40-1280.json`, `p4a-add40-1280.json` |
| 40 éléments, fermeture éditeur, 1280×720 | 135,5 / 209,4 | 102,6 / 153,5 | 20 | idem |
| 40 éléments, Undo, 1280×720 | 96,4 / 223,5 | 33,5 / 42,3 | 20 | idem |

Les mesures à 1728 et 1920 proviennent du candidat juste avant l'ajout du maintien de la page source pendant un drag. Ce dernier changement ne s'active que lorsqu'un drag est en cours; la navigation simple est identique. Le code final a été remesuré à 1280. L'ajout final a un P95 de 281,8 ms, contre 189 ms sur une séance candidate antérieure : le gain P3→P4A existe dans les deux séances, mais la dispersion est importante lorsque les Preview se chevauchent. **La cible globale de 100 ms au P95 n'est pas atteinte.**

À 40 éléments et 1280 px, le commit React de navigation passe de 45,4 / 53,9 ms à 8,2 / 14,7 ms P50/P95. Après stabilisation, les nœuds DOM montés passent de 10 133 à 7 037. Les tâches longues observées sur les 40 navigations passent de 38 à 0. Dans les 20 cycles d'ajout, les tâches longues passent de 101 à 81, avec une forte variabilité de serveur local. L'ajout modifie l'état local en 7,1 / 10,2 ms P50/P95 final, mais l'éditeur et le Board dense restent coûteux à peindre. Les mesures de heap avant/après varient avec le GC et ne prouvent pas une réduction durable de mémoire. Aucune requête financière ne découle des 40 navigations; les ajouts/Undo demandent une Preview comme auparavant. Les nombres de réponses READ achevées pendant les cycles diffèrent du fait des requêtes encore en vol : ils ne sont pas comparables comme volume réseau total.

## Modifications retenues

1. Les callbacks d'interaction gardent une identité stable tout en lisant la dernière fermeture **commise**; le contexte ne notifie plus tous ses consommateurs lors d'un rendu parent sans changement pertinent. Les index temporaires par modèle remplacent les recherches répétées dans les capacités, assets et contextes. [`composer-shell.tsx`](../../src/app/mois-a-venir/composer/composer-shell.tsx), [`use-committed-event.ts`](../../src/app/mois-a-venir/composer/use-committed-event.ts), [`render-index.ts`](../../src/app/mois-a-venir/composer/render-index.ts), `context-card.tsx`, `composer-library.tsx`.
2. Le Board construit l'inventaire une fois par modèle; le rendu atomique est isolé. Les cartes prennent **toujours** leurs montants, capacités et équipements dans le modèle courant. [`composer-board.tsx`](../../src/app/mois-a-venir/composer/composer-board.tsx).
3. La géométrie est réutilisée uniquement à clé spatiale et taille identiques; les items courants sont réattachés avant le rendu. Pour 24 éléments et plus, les pages logiques subsistent mais seules la page active et les voisines sont montées au repos. La page sortante reste montée pendant la transition; une saisie de montant non commise et la page source d'un drag restent également montées. En dessous de 24 éléments, toutes les pages restent montées, plus simple et comparable à P3. Le repli `NEXT_PUBLIC_COMPOSER_P14_P4A_PAGES=0` remonte toutes les pages sans changer les données. [`board-carousel.tsx`](../../src/app/mois-a-venir/composer/board-carousel.tsx), [`inventory-layout.ts`](../../src/app/mois-a-venir/composer/inventory-layout.ts), [`composer-card.tsx`](../../src/app/mois-a-venir/composer/composer-card.tsx).

Rollback : revert du commit P4A; si seule la sélection de pages pose problème, définir le drapeau ci-dessus à `0` au prochain build. Aucun état durable n'est écrit par l'optimisation.

## Expériences écartées

- Un comparateur personnalisé de bibliothèque, capable de sauter des rendus de la projection visible, a ralenti l'ajout Soirée : P95 315 ms sur 20 cycles contre 189 ms dans la séance précédente. Il a été retiré. Preuve : `p4a-rejected-library-comparator.json`; ces sessions ont des durées de Preview différentes et le rejet est prudent, pas une attribution causale certaine.
- Le montage sélectif n'apportait pas de gain net à 20 éléments; le code final garde alors toutes les pages. La page active seule n'a pas été retenue, car elle supprimerait la page sortante pendant la transition et compliquerait les drags.
- Aucun découpage des cinq éditeurs ni nouveau cache de données dans P4A.

## Parité et interactions

**PASS sur fixture/navigateur local :** dépôt Soirée → carte 40→41 et panneau immédiats pendant Preview PENDING, puis FRESH; équipement de la Soirée et Undo/Redo fidèles; navigation clavier Home/End entre pages distantes; `aria-hidden`/`inert` sur pages inactives; maintien d'une saisie Courses non validée en sautant de page puis retour; Preview du montant ensuite; clusters, focus, protection des cartes et absence de débordement horizontal vérifiés sur les séances de navigateur. Le drag vers le Board est effectivement exécuté. Un drag **de carte entre pages avec dwell** n'a pas été certifié dans le navigateur final; le maintien de sa page source est contrôlé dans le code. L'édition reste possible pendant Preview. Aucun Apply réel n'a été effectué par le banc P4A; son transport l'interdit.

**PASS de régression locale :** C8 Composer (35, incluant C8-017), R6-P45 (30), R6 présentation, UI atomique (14), parité golden 22×9, P11, P12, P13, P1 reuse, P2 mutation/scheduler/presentation/durable et P3 historique ciblé. P2/P3, P11/P12/P13 sont synthétiques ou PGlite selon leurs sorties; aucun PASS authentifié nouveau n'est revendiqué. `check-phase2-planner-interactions.mjs` passe R3-001…007 et R3-009…022, puis échoue sur **R3-008 `CONTEXT_REFERENCE_OWNER_UNAVAILABLE`**, réserve préexistante prévue par la mission. `npm.cmd run typecheck` : code 0. `npm.cmd run build` : première tentative limitée par `spawn EPERM` après compilation, puis **build Next complet code 0** dans l'environnement local autorisé, avec génération des 8 pages statiques et route dynamique `/mois-a-venir/composer`.

**NOT_RUN / limites :** métriques P50/P95 d'ajout d'asset, drag de carte entre pages et manipulation de satellite; second appareil; navigateur authentifié réel; effet sur le temps d'ouverture de Composer. Les vues 390/768 étudiées au début n'ont pas été poursuivies après la clarification du périmètre bureau.

## P4B et verdict

Les cinq éditeurs (`NightOutEditor`, `FamilyVisitEditor`, `ShortStayEditor`, `GiftEditor`, `CatalogContextEditor`) sont importés statiquement par le Shell; leurs sources totalisent environ 77 Ko non compressés, hors dépendances. La bibliothèque et les nombreux assets demeurent dans le premier rendu. P4B pourra mesurer un chargement différé de ces éditeurs et de la bibliothèque. Aucun de ces changements n'est implémenté ici.

**Verdict : `MEASURABLE_REACT_FLUIDITY_IMPROVEMENT` sur fixture de bureau.** La navigation dense et Undo s'améliorent réellement dans le navigateur; l'ajout complexe reste au-dessus de 100 ms au P95 et le gain utilisateur authentifié n'est pas certifié. Le prochain levier est de réduire le travail de rendu de l'éditeur et de la Library lors d'un ajout, en P4B après autorisation; P4A ne touche pas aux lecteurs historiques.
