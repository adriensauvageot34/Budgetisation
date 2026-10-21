# Bar / Apéro — carte ouverte superposée et dock visible

## Livraison pour revue

- Base main vérifiée : `2b1c2294450201483a334769174c24ffbada53fb` (PR #81 intégrée).
- Branche : `codex/bar-open-stacked-dock`.
- PR Draft : https://github.com/adriensauvageot34/Budgetisation/pull/82
- Commit principal : `83cd083d3d103a5887383b45f2250b9553aa57b0`.
- Dernier commit produit : `5f9be99e10331f52363c4e716b265a895f60c354`.
- Preview de ce commit exact : https://budgetisation-lmae4ivj0-adriensauvageot34-6137s-projects.vercel.app
- Déploiement : `dpl_7CkeWaecgU3BrJrTySrrhCB9wBrY`, **READY**, statut GitHub Vercel **success**.
- Verdict : **implémenté, réception desktop sur fixtures PASS, prêt pour revue avec limites natives/authentifiées ci-dessous**.

Aucune fusion ou promotion Production, migration, source financière distante ou Plan personnel modifié. Aucun nouveau modèle de prix global. Les éventuels commits suivants de cette PR ne contiennent que les preuves et ce rapport ; le SHA produit ci-dessus désigne le code testé et construit.

## Les neuf corrections livrées

1. Cartouche blanc `barClosedFullLabel` et titres natifs redondants des produits supprimés. Crazy/Diluant/Tapas restent courts ; labels accessibles complets, données et popovers de groupes distincts conservés. `title=""` du groupe empêche l'héritage du titre d'aide au drag de son ancêtre.
2. Flèches des rails et leur observation d'overflow retirées ; scroll horizontal, flèches clavier, admission des drops et protections conservés.
3. Navigation haute Before/Au bar retirée ; `selectMoment()` et les deux `+` gardent leurs owners respectifs.
4. Before puis Au bar en deux rangées pleine largeur dans la carte ouverte. Aucun changement au résumé fermé côte à côte.
5. Illustration décorative Before et CSS associés supprimés ; illustrations des produits conservées et contenues dans leurs tuiles, sans découpe `cover`.
6. Espacements ouverts consolidés, hauteur mesurée puis bornée par l'espace réel disponible. Repacking dans la surface finie, sans réécriture du packer ou de FLIP.
7. Dock dans le flux, non rétractable ; Board mesuré par son ResizeObserver existant après réservation du dock. Suppression des règles forçant le scroll vertical du main. Réduction de l'art du dock sur espaces desktop bas. Les formulaires longs restent temporairement défilables dans l'éditeur, pas la page ni les deux moments normaux.
8. Bouton permanent Montant direct retiré. Clic sur le montant détaillé → confirmation honnête **Au bar seulement** → éditeur inline et contrat DIRECT existant. Annulation sans mutation ; détails inactifs restaurables ; Before/trajets indépendants ; édition DIRECT déjà active sans nouvelle confirmation.
9. Poubelle visible Before remplacée par le drag du contexte enfant complet **publié par l'owner**, lorsqu'admissible. Menu discret « Actions du Before » → retrait confirmé comme alternative clavier. RAW, busy et protections bloquent l'admission. Retirer un produit n'est pas retirer le moment entier.

Le recentrage horizontal à l'ouverture, sa priorité donnée aux gestes manuels, le non-recentrage lors de l'édition et les branches reduced-motion restent en place. Aucun scroll vertical ajouté par l'ouverture.

## Fichiers produit et tests

| Fichier | Intervention |
|---|---|
| `bar-component-group.tsx` | Tooltips, abréviations accessibles |
| `bar-moment-rail.tsx` | Suppression des flèches et de leurs mesures |
| `bar-living-editor.tsx` | Moments, DIRECT, drag Before et alternative clavier |
| `composer-board.tsx` | Marqueur de workspace Bar pour requête de conteneur |
| `board-carousel.tsx` | Budget réel de hauteur, ancrage première rangée, ouverture horizontale |
| `composer.module.css` | Disposition, dock, budget et formulaires transitoires |
| `check-bar-compact-clay.mjs` | Assertion de tooltip remplacée par absence du title et maintien du label complet |
| `check-bar-open-stacked.mjs` | Dix contrôles interaction/owner ciblés |

Tous les fichiers TSX/CSS sont sous `src/app/mois-a-venir/composer/`, les scripts sous `scripts/`. Aucun fichier Compiler, Finance, Mobility, contrat, persistance ou migration modifié. Revue React ciblée : hooks et nettoyages des observers conservés, aucune nouvelle lecture serveur, aucune nouvelle vérité financière, boutons et labels clavier maintenus.

## Méthode navigateur et comparaison

Navigateur Codex réel, bundle React compilé avec `NODE_ENV=production`, CSS global de production, serveur de fixtures existant. **Ce bundle n'est pas à lui seul un build Next complet** ; celui-ci est prouvé séparément sur Vercel. PGlite et données entièrement synthétiques ; accès réseau de la fixture interdit.

Référence UI gelée sur `8712ce6`, arbre des composants identique à main `2b1c229` (différence documentaire), port 3220. Candidat compilé depuis l'arbre produit final, port 3221. Scène `BAR_COMPACT_mixed` : Espit Chupitos, 14 novembre, deux participants synthétiques, cinq produits Before dont deux prix inconnus, Tapas Au bar et cartes voisines. Scène supplémentaire `BAR_COMPACT_tall` : mêmes moments, aller voiture et retour taxi, trente intentions voisines supplémentaires.

Les tailles ci-dessous sont **innerWidth/innerHeight réellement lues**, pas seulement les tailles demandées. Mesures via DOM en lecture seule ; gestes par contrôles visibles. Captures `final-open-*` prises après stabilisation de l'ouverture. Pas de durée de l'outil présentée comme performance produit, ni de percentile calculé sur ces mesures de géométrie.

### Avant/après : même scène, même séquence de redimensionnements

| Viewport effectif | main client/scroll référence | main client/scroll final | Bas dock référence | Bas dock final | Dock final entier |
|---|---:|---:|---:|---:|---|
| 1440 × 900 | 900 / 1030 | 900 / 900 | 1028,8 | 879,2 | PASS |
| 1440 × 720 | 720 / 1030 | 720 / 720 | 1028,8 | 699,2 | PASS |
| 1152 × 720 | 720 / 1080 | 720 / 720 | 1078,9 | 699,2 | PASS |
| 1920 × 1080 | 1080 / 1080 | 1080 / 1080 | 1049,2 | 1059,2 | PASS |

La référence ci-dessus est la séquence 1440×900 → 1440×720 → 1152×720 → 1920×1080 sur une même carte ouverte : l'ancien feedback de min-height conserve sa hauteur lors de la réduction. **Un premier essai référence frais à 1440×720 donnait déjà 720/850, dock à 848,8 : ne pas confondre ce premier essai et la séquence.** Les captures `before-open-*` correspondent à la séquence conservée dans `browser.json`.

### Géométrie finale de la carte ouverte normale

| Viewport | Carte client/scroll | Hauteur extérieure | Board clientHeight | Dock hauteur | Centre horizontal, erreur px | Cellules en collision |
|---|---:|---:|---:|---:|---:|---:|
| 1440 × 900 | 433 / 433 | 435 | 575 | 146 | +0,51 | 0 |
| 1440 × 720 | 403 / 403 | 405 | 429 | 112 | −0,07 | 0 |
| 1152 × 720 | 353 / 353 | 355 | 379 | 112 | 0 | 0 |
| 1920 × 1080 | 433 / 433 | 435 | 765 | 146 | −149,50* | 0 |

*À 1920, cette scène courte ne dépasse pas la largeur du Board ; scrollLeft est déjà à zéro. Le centre idéal exigerait un scroll négatif : clamp existant conservé, sans inventer de padding ni déplacer le résumé fermé. `browser.json` conserve les rectangles et la sonde d'ouverture. Aux trois autres tailles, centrage à moins d'un pixel.

Les sections Before/Au bar sont ordonnées verticalement, chacune avec son rail horizontal ; ni carte ni rails normaux n'ont de débordement vertical. Main scrollTop reste zéro. Pas de débordement horizontal du document.

### Cas supplémentaires et défauts réellement corrigés pendant la réception

- Première variante : dock visible mais carte encore trop haute ; preuve d'échec `candidate-open-v1-1440x720.png` conservée. Ajustement des espacements et des images, sans masquer le contenu.
- Formulaire de consommation à 1152×720 : le mount avait `flex:none` et empêchait l'éditeur de se réduire. Corrigé à sa source. Main 720/720, carte 313/313, éditeur temporaire 221/466 et dock entier ; accès effectif aux champs, quantité et prix enregistrés. Une réédition d'un poste existant confirme aussi l'alignement carte/cellule et le scroll temporaire de l'éditeur. Captures `task-*`.
- Aller/retour + Before + Au bar sur écran bas : initialement carte 353/451, trop haute. Rail horizontal des trajets et espacements ciblés : **353/353**, éditeur **293/293**, main **720/720**, dock entier. Les deux moments restent sans scroll vertical. Les trajets conservent leurs commandes ; le focus clavier du retour amène le rail à scrollLeft 762,4 sans déplacer verticalement le main. Captures `routes-initial-*`, `routes-final-*`, `routes-return-keyboard-*`.
- Fermeture/reprise : Escape ferme la carte et retire le dock ; aucune collision observée. À 1440×900, référence et candidat fermés ont exactement le même rectangle : x 1026,825 ; y 301 ; largeur 529,963 ; hauteur 245. Carte fermée non redessinée, hors tooltip.

## Interactions exécutées et niveau de preuve

| Contrôle | Résultat | Preuve |
|---|---|---|
| `+` Before → Boissons → Rhum | PASS | Navigateur + owner : enfant Before enrichi, Au bar inchangé |
| Quantité 2, prix 8 pour Rhum | PASS | Navigateur, puis assertion complète des autres décisions inchangées dans le test ciblé |
| `+` Au bar → Boissons → Cocktail | PASS | Navigateur + owner : parent Au bar, pas l'enfant Before |
| RAW `2,` → changement de moment → Continuer à modifier | PASS | Champ conservé ; confirmation réelle visible ; `raw-confirmation.png` |
| Montant → message Au bar seulement → Annuler | PASS | Navigateur + absence de mutation dans test owner ; `direct-confirmation.png` |
| Accepter DIRECT, saisir 40, revenir au détail | PASS | Navigateur + conservation exacte des identités et de l'enfant dans test owner |
| Menu Before → retrait confirmé → Undo | PASS | Navigateur : moment absent puis récupéré ; Au bar conservé ; Undo referme l'éditeur comme auparavant |
| Source entière Before → corbeille | PASS limité | Handler de drag réellement raccordé à la source publiée et opération DROP exécutée par owner/PGlite ; aucune simulation présentée comme drag natif |
| Rail produits et Board aux flèches clavier | PASS | scroll horizontal réel ; sonde d'ouverture annulée par le geste manuel |
| Bibliothèque PageDown | PASS | scrollTop 34,4, main scrollTop 0 ; défilement vertical bibliothèque conservé |
| Tooltip parasite | PASS structurel | Nœud/règles supprimés, titres produits retirés, noms accessibles complets ; pas de survol natif automatisé revendiqué |
| Saisies sensibles/Plans réels | Non sollicités | Fixture réseau fermé, aucun Apply navigateur ni écriture distante |

## Régressions et build exécutés

| Commande | Résultat exact |
|---|---|
| `node scripts/check-bar-open-stacked.mjs` | PASS 10 contrôles React + vrais owners + PGlite synthétique |
| `node scripts/check-bar-r72-rail.mjs` | PASS 7 handlers, pas drag natif |
| `node scripts/check-bar-r72-dock-drop.mjs` | PASS drop publié et guards : lock/busy/RAW/famille/owner/produit invalide |
| `node scripts/check-bar-compact-clay.mjs` | PASS 12, dimensions des cas compacts conservées |
| `node scripts/check-bar-board-continuous.mjs` | PASS 9 géométries, 5/20/40 éléments × 3 largeurs |
| `node scripts/check-bar-r72-consumption.mjs` | PASS 9 : pas de double compte, UNKNOWN/zéro, modes, persistance et Apply/Reload synthétiques, CAS |
| `node scripts/check-phase2-planner-kernel.mjs` | PASS 40, remoteWrites 0, historicalWrites 0 |
| `node scripts/check-planner-performance-parity.mjs` | PASS **198/198** (22 scénarios × 9 empreintes) |
| `node node_modules/typescript/bin/tsc --noEmit` | PASS, code 0 ; journal vide attendu |
| `npm run build` → `next build`, Vercel commit `5f9be99` | PASS complet : compilation, TypeScript, collecte, 8/8 pages statiques, build output et déploiement READY |

Les dernières modifications après les régressions métier sont exclusivement CSS de géométrie. TypeScript a été réexécuté ; le build Vercel final couvre ce dernier CSS. Les logs sont joints, dont les deux builds intermédiaire/final. Aucune compilation Turbopack seule n'est prise pour un build complet. Avertissements non bloquants de Vercel conservés (`cache-dir`, allowScripts sharp) ; aucun changement de dépendances effectué.

## Limites non certifiées et frontières

- Auth Supabase, sauvegarde distante, session inter-appareils : **NOT_RUN_AUTH** dans cette mission. Aucune équivalence entre PGlite synthétique et RLS/JWT revendiquée.
- Drag-and-drop natif complet du moment vers la corbeille : **NOT_RUN_NATIVE**. Source publiée, refus RAW/locks et mutation entière sont testés ; alternative clavier retrait/Undo testée dans le navigateur.
- Trackpad physique, swipe tactile, préférence OS reduced-motion et hover natif : non exécutés matériellement. Contrats CSS/clavier et branches de code conservés.
- Les quatre captures certifient la scène normale demandée ; les scènes avec calendrier/formulaire avancé gardent une surface transitoire défilable. Toutes les combinaisons possibles de contributions supplémentaires, messages d'erreur et libellés arbitrairement longs ne constituent pas une certification exhaustive.
- Aucun gain de performance réelle de Composer ou nouvelle garantie statistique annoncé.

## Reproduction et rollback

Utiliser `serve-phase2-planner-composer-fixture.mjs` existant, un CSS AppShell de production et `PLANNER_BROWSER_TOOLS` configuré sur esbuild. Ouvrir `?scenario=BAR_COMPACT_mixed&barProbe=1` ou `BAR_COMPACT_tall`. Mesurer les tailles effectives ; ouvrir Bar par clic ou Enter après disponibilité, laisser finir l'animation, puis relever main/carte/dock et prendre la capture. Escape ferme ; les `+` choisissent chacun leur owner.

Le serveur de fixtures bloque fetch distant par défaut. Ne pas activer BAR_LOCAL_LIVE_PROVIDERS pour reproduire cette recette. Les scripts de test n'exigent aucun secret.

Rollback après une future intégration : revert des deux commits produit via procédure Git normale. Aucun rollback SQL, suppression de Draft ou réinitialisation financière requis. **Cette mission s'arrête à la PR Draft et à la Preview ; main/Production restent inchangés.**
