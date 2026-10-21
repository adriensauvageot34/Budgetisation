# Réception — Bar simplifié et Board horizontal

> Historique de la première tranche. La [finalisation du 21 octobre](finalization.md) décrit le produit final `b33a66e`, les preuves supplémentaires et les réserves de livraison.

## Références et périmètre

- Base : PR #79 Draft, commit `db5494bb8c2e7d03d7347ab36fd7979577704a34` (produit `9fd388381c4ee65d2cb1648ac36baaf6410dcb8a`).
- Branche : `codex/bar-board-continuous-ux`. Commit produit évalué : `8eafe1aaad4ca5665d5512a685fd8e2d33140a51`.
- PR Draft #80, cible `codex/bar-warm-card-ux`. Aucun merge dans `main`, aucune migration, aucun Apply ni écriture distante pour la recette.
- Preview Vercel immuable du commit produit : [déploiement `dpl_FF8h4SE5rNPW2v8qUsxvEtQhBRq8`](https://budgetisation-hjoysyfz3-adriensauvageot34-6137s-projects.vercel.app), état `READY`, métadonnée Git `8eafe1aaad4ca5665d5512a685fd8e2d33140a51`. Aucun ciblage Production.

## Corrections

| Sujet | Réalisation | Preuve et limite |
| --- | --- | --- |
| Montant | L'éditeur inline occupe la ligne du montant ; libellé visuel « Consommations (€) » supprimé, nom accessible conservé. | Fixture navigateur `BAR350_0` : 40 € validés, saisie RAW `41,` protégée au clic extérieur, Escape, Undo/Redo et rechargement synthétique. Mesure avant/après de hauteur non archivée. |
| Vérité financière | `costIncomplete` qualifie uniquement un prix de composant ou de trajet réellement inconnu. La tuile agrégée DIRECT n'est plus affichée ; le modèle financier et la sélection restent conservés. | Contrôle DIRECT/DETAILED 9 PASS, incluant substitution, UNKNOWN/ZERO, CAS et Apply/Reload sur base isolée. Fixture navigateur : 40 € sans faux sous-asset ni texte technique. |
| Commandes | Menu Actions et croix retirés ; épingle discrète et suppression clavier conservées. Clic extérieur sous garde RAW. | Fixture navigateur : fermeture extérieure, refus si RAW, reprise de la saisie. Drag natif de suppression non exécuté dans cette tranche. |
| Lieu | Un champ avec bascule Google/nom libre ; suggestions temporaires en portail ; favoris et lieux connus identifiés ; changement de mode sans décision implicite. | Recherche R8.2 6 PASS sur réseau synthétique ; UI des lieux personnels PASS ; fixture navigateur : texte conservé à la bascule, suggestion libre admise explicitement. Appel Google réel non exécuté. |
| Board | Le packer existant produit une bande horizontale unique. Les cartes sont gardées dans le DOM, le défilement est local, avec flèches clavier, révélation du focus et défilement en bord de drag. FLIP anime la taille de Bar et la translation des voisines sauf mouvement réduit. | Géométrie pure 5/20/40 cartes × 1152/1440/1920 : 9 PASS sans chevauchement ; navigateur à largeur effective 1152, 1440 et 1920 : une seule surface, aucune navigation « Page », aucun débordement du document, Bar ouverte entièrement atteignable. Flèche droite clavier : scrollLeft 0→183 px. Une séquence vidéo de l'animation n'a pas été obtenue : rendu dynamique `NOT_CERTIFIED`. |

## Régressions exécutées

- TypeScript `tsc --noEmit` : PASS.
- `check-phase2-planner-kernel.mjs` : PASS, 40 contrôles, zéro écriture distante.
- `check-planner-performance-parity.mjs` : PASS, 22 cas × 9 hashes.
- `check-bar-r72-consumption.mjs` : PASS, 9 cas.
- `check-bar-r61-closed.mjs` : PASS, 17 cas.
- `check-bar-board-continuous.mjs` : PASS, 9 cas de géométrie.
- `check-bar-place-compact.mjs` : PASS, 6 cas React synthétiques.
- `check-bar-r82-search.mjs` : PASS, 6 cas réseau synthétique.
- `check-bar-personal-places.mjs` et `check-bar-personal-places-ui.mjs` : PASS.
- `git diff --check` : PASS.
- Build Vercel Preview Next : `READY` au SHA produit exact.

Captures de la fixture locale : [montant inconnu](images/amount-unknown.png), [champ au même emplacement](images/amount-inline-input.png), [montant direct 40 € sans tuile fictive](images/amount-direct-40.png), [recherche de lieu compacte](images/place-compact.png), [suggestion de nom libre](images/place-free-suggestion.png), [Board ouvert à 1920 px](images/board-open-1920.png), [rendu à viewport effectif 1152 px](images/board-open-1152.png). Cette dernière capture conserve le canevas externe de l'outil à 1920 px et ne prouve donc pas à elle seule une capture native à 1152 px ; la largeur effective de la page a été relevée via `innerWidth=1152`.

## Réserves

- Build Next local complet : `NOT_CERTIFIED`. Le checkout emploie une jonction `node_modules` hors racine, que Turbopack refuse ; le repli Webpack rencontre un import client `node:crypto` préexistant. Le build Vercel normal au SHA produit est `READY`.
- Sauvegarde/relecture navigateur ci-dessus : fixture locale synthétique, pas un E2E authentifié Supabase. Aucun Draft ou Plan personnel n'a été modifié.
- Animation d'ouverture/fermeture et déplacement des voisines : code FLIP présent, mais pas de capture temporelle probante. `NOT_CERTIFIED` visuellement.
- Zoom natif 125 %, Google réel, suppression par drag et parcours complet DIRECT↔DETAILED au navigateur : `NOT_RUN` dans cette tranche.

## Verdict

`READY_FOR_DRAFT_REVIEW_WITH_RESERVATIONS` : fonctionnalité et conservation ciblées vérifiées localement, revue visuelle et build Preview à confirmer. La PR #80 reste dépendante de #79 ; aucune mise en Production.
