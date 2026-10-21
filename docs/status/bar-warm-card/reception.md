# Bar / Apéro — finition de la carte vivante

## Références

- Base : `main` `33e9a31551ea070597a46a50dc7628d0bbe3604c`, après R8.2.
- Branche : `codex/bar-warm-card-ux`.
- PR Draft : [#79](https://github.com/adriensauvageot34/Budgetisation/pull/79).
- Commits produit : `fda11583309b60fcfe355581b783c8e805cf0300`, puis `9fd388381c4ee65d2cb1648ac36baaf6410dcb8a` pour borner le décor aux cartes courtes.
- Aucun merge, aucune migration, aucun changement de Production ni aucune donnée personnelle modifiée.

## Modifications

La carte du Board n'affiche plus sa miniature d'en-tête. Son titre et son montant forment un cartouche ivoire compact, aligné à gauche. Un montant réellement inconnu est rendu `… €` ; zéro, montant connu, partiel et simulation obsolète gardent leurs états et libellés complémentaires. Le crayon de la saisie directe est un pictogramme de 14 px, discret au repos et visible au survol ou au focus.

Le décor à tabourets cède la place à une illustration apéro WebP de 768 × 512 px (10 466 octets), cantonnée à la partie haute par un masque ; une surface crème CSS se prolonge derrière tous les contenus. Après mesure sur Preview, la hauteur de la couche décorative a été bornée à `min(190px,100%)` : la carte vide ouverte mesurait 148,3 px, inférieure aux 190 px initiaux.

Le drag de la carte existante conserve le mécanisme et l'identité du Board. Son image native est maintenant demandée à partir d'un clone inerte de la carte courante, avec dimensions et point de prise réels ; le clone est retiré après le drag. La bibliothèque et les sous-assets gardent leur source de drag actuelle. Ce changement de code ne prouve pas à lui seul l'apparence de l'image native.

L'illustration a été produite pour une zone supérieure décorative, sans texte ni composant UI. Prompt source : « Use case: stylized-concept. Asset type: decorative header background for a compact financial planning Bar / Apéro card, NOT a UI mockup. Create a wide 3:2 soft clay digital illustration, warm refined convivial aperitif at sunset. Left two thirds mostly empty warm ivory and creamy sand gradient with gentle amber light; right upper area a small elegant arrangement of translucent amber drinking glass with a subtle citrus slice, tiny olive bowl and a softly blurred bottle silhouette. Smooth rounded clay forms, subtle 3D depth, quiet peach honey caramel palette, very low contrast. Bottom fades seamlessly to uniform warm ivory #fff7eb, no hard tabletop edge. No chairs, no stools, no interior scene, no people. No text, labels, numbers, logos, icons, UI, card borders or buttons. Meant to be softly masked at the bottom and anchored at fixed 200px height above an extensible cream CSS surface. Keep objects small and concentrated on the right so a compact left aligned cartouche remains readable. » Fichier livré : `public/planned-visuals/builder/clay/scenes/bar-apero-warm-header.webp`.

## Contrôles exécutés

| Contrôle | Résultat | Portée |
| --- | --- | --- |
| TypeScript `tsc --noEmit` | PASS | Code local `fda1158` ; le commit suivant ne change que la CSS. |
| `check-bar-r61-closed.mjs` | PASS, 17 contrôles | Inconnu `… €`, zéro `0,00 €`, partiel, interactions existantes, absence de miniature. |
| `check-bar-r73-polish.mjs` | PASS, 8 contrôles | Présentation et commandes existantes. |
| `check-bar-apero-p3.mjs` | PASS, 15 contrôles | Provenance, Google/RAW/Undo/Preview/identités sur les fixtures existantes. |
| `check-bar-r72-consumption.mjs` | PASS, 9 contrôles | Direct/détail, zéro/UNKNOWN, Undo/CAS et Apply/Reload isolé PGlite. |
| `check-l4-d-bar-mobility.mjs` | PASS, 6 contrôles | Aller/retour et coûts distincts sur fixtures. |
| `check-bar-warm-drag.mjs` | PASS, 6 contrôles | Adaptateur DOM du clone, dimensions, offset, nettoyage ; pas une preuve visuelle native. |
| `git diff --check` | PASS | Avant les deux commits. |
| Finance 198/198 | NON RELANCÉ | Golden hérité de R8.2 ; aucun owner, calcul ou contrat financier modifié ici. |

## Réception navigateur

La recette est une page Preview authentifiée, avec Board et faits financiers synthétiques en mémoire ; elle n'enregistre aucun Draft distant et n'effectue aucun Apply. La Preview finale [dpl_DsYbK7AZ3D8nCNhMp66sAKeW1ztD](https://budgetisation-4657osr02-adriensauvageot34-6137s-projects.vercel.app/recette/bar-favoris?r62=empty&r63=1) est `READY` et correspond au SHA produit exact `9fd388381c4ee65d2cb1648ac36baaf6410dcb8a`. Son build Vercel a compilé, généré les 8 pages statiques et terminé le déploiement. Les captures `final-*` dans `proofs/` proviennent de ce commit ; les autres captures proviennent du commit précédent `fda1158`. Les dimensions de viewport ont été mesurées dans la page, et non déduites du réglage demandé.

- Commit final à 1152 × 720 : carte vide fermée de 165 px, décor borné à 163,4 px ; ouverte de 148,3 px, décor borné à 146,7 px. `… €` exact, aucun élément image d'en-tête, crayon de 14 px et commandes Lieu/Date/Personnes/« Composer cette sortie » accessibles ; largeur documentaire 1152 px. Captures : [fermée](proofs/final-closed-1152.png), [ouverte](proofs/final-open-1152.png).
- Commit final à 1440 × 900 : carte riche fermée de 265 px et ouverte de 355,9 px, décor de 190 px, surface crème continue, montant `68,00 €` partiel, bouteille et deux bières conservées ; largeur documentaire 1440 px. Captures : [fermée](proofs/final-rich-1440.png), [ouverte](proofs/final-rich-open-1440.png).
- Commit précédent à 1920 × 1080 : états fermé et ouvert capturés. La seule modification ultérieure borne la hauteur du décor CSS ; **la largeur 1920 n'a pas été rejouée sur le SHA final**. Captures : [fermée](proofs/closed-1920.png), [ouverte](proofs/open-1920.png).
- Commit précédent, montant long `12 434,67 €` à 1152 : visible en entier dans le cartouche de 381,2 px, indicateur partiel séparé. [Capture](proofs/long-1152.png).
- Parcours synthétique sur le commit précédent : ajout explicite d'un Aller Train/tram ; l'échec de vérification d'un lieu Google fictif a permis le repli « Nom libre », sans identité Google inventée. Tarif resté inconnu et simulation revenue à l'état actualisé. Avant de sortir et Au bar sont restés accessibles dans la carte haute.
- Commit final : saisie directe de montant RAW `12,`, puis `Escape` ; retour à l'état inconnu `… €`, sans admission de ce montant ni activation d'Undo. Aucun Apply.
- Drag natif : un essai atomique de l'outil navigateur n'a pas pu maintenir les 180 ms d'armement requis. La carte n'a pas bougé et aucun clone n'est resté dans le DOM. L'image de drag pendant le mouvement **n'a pas pu être capturée** ; `NATIVE_DRAG_VISUAL = NOT_CERTIFIED`.
- Drag natif d'un preset Library sur la Preview finale : non conclu. La commande navigateur a expiré ; aucun résultat n'est revendiqué et elle n'a pas été répétée à l'aveugle.
- Zoom navigateur natif 125 % : la commande du navigateur Codex n'a changé ni la largeur effective ni le pixel ratio ; `NOT_RUN`. Aucun zoom CSS n'a été présenté comme équivalent.

## Verdict

La finition visuelle et les régressions ciblées sont validées sur fixtures et sur la Preview authentifiée du SHA final aux largeurs 1152 et 1440. L'image native pendant le déplacement, la largeur 1920 sur le SHA final et le zoom natif 125 % restent non certifiés. Le test de drag DOM valide l'adaptateur, pas le rendu natif. PR #79 reste Draft pour revue ; aucun merge ni déploiement Production n'a été effectué.
