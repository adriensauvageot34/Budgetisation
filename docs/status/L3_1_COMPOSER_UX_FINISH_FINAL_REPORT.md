# L3.1 — Finition de l’atelier Composer

## Verdict de préparation — 16 octobre 2026

**L3_1_IMPLEMENTED_NOT_RELEASED** à ce stade de revue. Correctifs implémentés, quinze suites ciblées PASS, contrôles complémentaires de placement PASS et navigateur desktop exécuté. Livraison PR #47 en cours ; résultat final à consigner après Production.

## A. Situation initiale

- Main/Production initiales : `946303df18b59fc642ff92e9042bfc8e6eb57498`, PR #46, Production READY vérifiée. HEAD local initial `2fb7dfa`, clôture documentaire L3 conservée sans réécriture.
- Branche dédiée depuis le main réel : `codex/composer-v3-l3-1-ux-polish`. Produit L3.1 : `9997b68bf6d1dc10ea867f32e2c829c60b88900b`, ajustement géométrique `9cd553d68a636fe899d8b72dfac45143dea69551`, puis correction de l’atténuation après À préciser **`38f5cd95e40c1a03aad151b6d0c400c71705ddb1`**.
- Reproduction déterministe : vrai Compiler/Finance V2, owners synthétiques, 17 éléments, dont un groupe Restauration de cinq enfants, une réservation et un achat Amazon UNKNOWN. Un scénario dense de 40 éléments ajoute 24 achats Amazon d’identités différentes. Aucun usage des finances personnelles pour ces essais.
- Référence navigateur : bundle React de production L3 déjà compilé, arbre produit identique à `946303d`. Même serveur de fixture, dépendances et CSS global que le candidat.

Défauts confirmés à 1440 × 900 : six objets visuels en page 1 et sept en page 2 ; focus Amazon conservé mais carte déplacée hors page lors de l’ouverture du panneau ; absence de retour explicite. Palette de 114 px : zone utile de 63 px pour 76 px de contenu, tuiles débordant en bas et double scrollbar. Pagination peu lisible, libellé « autres » ambigu. Typographie financière nécessaire de 9–11 px.

Comportements intentionnels : 17 éléments économiques ne signifient pas 17 cartes indépendantes ; le groupe représente plusieurs enfants sans coût propre. À 1920 × 1080, le scénario de 17 éléments peut tenir sur une seule page. L’UNKNOWN d’Amazon et le titre synthétique d’épargne ne constituent pas des bugs métier.

## B. Huit corrections réalisées

| Sujet | Cause / correction | Résultat et limites |
|---|---|---|
| 1. Occupation du Board | Quantification trop grossière des largeurs ; réserve basse de 35 px alors que dock/navigation étaient déjà exclus du viewport mesuré. Tracks affinés, marge résiduelle ramenée à 8 px ; contrôles d’épargne 260 px, intentions simples 230 px ; composites conservés | 8 objets en page 1 contre 6 à 1440 avec panneau et palette. Tous les IDs et l’ordre sémantique conservés. Pas de cartes artificiellement agrandies ni de scroll infini |
| 2. Pagination | Points minuscules et différence d’items visuels interprétable comme intentions financières | « Page X sur N », numéros, Précédente/Suivante, Home/End/flèches et focus clavier. Compteur « autres » retiré ; aucune nouvelle unité financière |
| 3. Sélection / focus | Effet initial dépendant seulement du focus, pas de la recomposition | Recomposition suit la sélection ; navigation manuelle reste respectée. « Voir Amazon · page 2 » rejoint l’identité précise. Aucun saut forcé pendant un drag ; géométrie gelée existante conservée |
| 4. Palette | Plusieurs hauteurs fixes successives ne couvraient pas header + titres + tuiles + scrollbar | Hauteur intrinsèque, tuiles de 64 px, texte 12 px, une navigation horizontale avec flèches et clavier ; aucun débordement vertical mesuré. Accès Voir tous regroupé dans Autres options, sans perte de capacité |
| 5. Finances latérales | Succession de lignes et caractères trop petits | Projection/UNKNOWN en tête, ressources, rubriques du mois, épargne séparée, puis référence/impact repliables. Détails cash/funding/Mobility et diagnostics conservés. Largeur 340 px maintenue ; textes utiles 12–13 px |
| 6. HUD / header | Capsule isolée par la croissance de la zone identité ; UNKNOWN peu explicite | HUD rapproché du titre/Board ; « Montant à préciser », chiffres officiels inchangés et masqués lorsqu’ils sont obsolètes. Une seule primaire Transformer en Plan |
| 7. Cartes / illustrations | Largeurs arrondies inutilement grandes et titres longs | Gabarits simples compacts, titres sur trois lignes avec libellé complet accessible au survol ; aucune modification de nom, fichier Clay ou preset. Singularité des composites conservée |
| 8. À préciser | Révélation insuffisamment synchronisée avec les pages/groupes | Navigation par références ; enfant Restauration effectivement ciblé et focalisé dans le groupe. Contexts enfants inclus dans la liste lorsqu’ils sont publiés ; protections et UNKNOWN conservés |

Ces changements restent dans la présentation React/CSS. Pas de nouvel owner, nouvelle règle d’évaluation, migration, SNAP, cache, contrat de Draft ou wizard L4.

## C. Preuves visuelles et dimensions effectives

Preuves sous `evidence/l3-1-composer-ux-finish/`. Les captures `after-final-*` et `common-final-geometry.json` correspondent au produit final `38f5cd9`. Les captures denses, la navigation et le dernier drag natif correspondent à `9cd553d` ; le seul changement produit ultérieur désactive l’atténuation À préciser à l’ouverture des finances. Les autres fichiers documentent les itérations, pas une certification du dernier arbre.

Un défaut supplémentaire a été observé pendant la revue des captures : passer de À préciser aux finances conservait l’atténuation des cartes. `38f5cd9` efface cet état visuel à l’ouverture des finances. Les trois captures finales ont été reprises : opacité normale, même digest, aucune mutation sémantique.

- [Avant L3.1, 1440](evidence/l3-1-composer-ux-finish/before-1440.jpg).
- Après : [1440](evidence/l3-1-composer-ux-finish/after-final-1440.jpg), [1728](evidence/l3-1-composer-ux-finish/after-final-1728.jpg), [1920](evidence/l3-1-composer-ux-finish/after-final-1920.jpg).
- [Retour vers Amazon, page 2](evidence/l3-1-composer-ux-finish/amazon-final-page2.jpg).
- [Autres options / recherche Bus](evidence/l3-1-composer-ux-finish/palette-other-options-1440.jpg), [choix Voiture Aller/Retour](evidence/l3-1-composer-ux-finish/palette-multiple-routes.jpg).
- [À préciser vers un enfant de Restauration](evidence/l3-1-composer-ux-finish/unresolved-cluster-child.jpg).
- Scénario dense : captures `dense-final-page1-*`, `dense-final-focused-*`, `dense-final-closed-*` pour les trois viewports.

| Viewport réellement mesuré | Document | Board avec inspecteur | Répartition des 13 objets visuels représentant 17 éléments | Dock Compléter |
|---|---:|---:|---|---:|
| 1440 × 900 | 1440 px | 756 px | 8 / 5 (avant : 6 / 7) | 163 px |
| 1728 × 900 | 1728 px | 1044 px | 11 / 2 (avant : 10 / 3) | 163 px |
| 1920 × 1080 | 1920 px | 1236 px | 13 sur une page | 163 px |

La palette est plus haute car son contenu est désormais visible. Son viewport vertical utile et son contenu mesurent tous deux 96 px : pas de scrollbar verticale parasite. Autres options avec recherche mesure environ 189 px à 1440. Des choix peuvent être partiellement hors champ **horizontalement**, avec scrollbar, flèches et clavier pour les atteindre. Ils ne sont pas tronqués verticalement.

Le scénario dense reste sur plusieurs pages aux trois tailles : panneau + palette ouverts, 6 / 5 / 3 pages. Le même achat `…031024` reste retrouvé et visible après retour, fermeture/ouverture du panneau et redimensionnement. Palette fermée et inspecteur fermé : 3 / 3 / 2 pages. Aucun overflow global mesuré. Les captures sont des fixtures, jamais présentées comme des sessions Supabase authentifiées.

## D. Vérifications fonctionnelles

| Parcours réellement exécuté | Résultat |
|---|---|
| Sélection Amazon hors page → Voir la carte | PASS fixture, vraie page et ID retrouvés ; digest inchangé |
| 24 libellés Amazon identiques → dernier ID | PASS fixture aux trois tailles, navigation par identité |
| Home/End et focus de pagination | PASS fixture : page/focus 0 puis 1, navigation manuelle respectée |
| Inspecteur ouvert/fermé, palette ouverte/fermée, redimensionnement | PASS fixture aux trois viewports ; aucun geste sémantique |
| À préciser → enfant Restauration | PASS fixture : modal FOOD, enfant `…manon-work-meals` actif et au focus DOM, digest inchangé |
| Source protégée à préciser | PASS fixture, focus du bon contrôle, aucun éditeur et Draft CLEAN |
| Recherche d’intention et recherche de complément Bus | PASS fixture ; flèches de palette atteignent les options hors champ, scroll vertical absent |
| Glisser-déposer natif d’une intention | PASS fixture, puis rejoué sur `9cd553d` : un seul Context Soirée, sauvegarde SAVED et Preview FRESH |
| Glisser-déposer natif d’un équipement compatible | PASS fixture sur le premier commit produit : drop admis dans main, même nombre d’éléments ; handlers inchangés dans l’ajustement final de largeur |
| Undo/Redo pendant Preview, sauvegarde, Reload | PASS fixture, digest identique et ID de Soirée conservé après reprise |
| Retrait autorisé, Undo puis Redo | PASS fixture, aucun nouveau Context créé lors de la restauration de l’historique |
| Popover de routes multiples Voiture | PASS navigateur sur `9cd553d`, Aller et Retour accessibles au-dessus de la palette |
| Changement de page avec souris maintenue pendant drag ; resize pendant drag tenu | **NOT_RUN** navigateur : l’API documentée réalise un geste atomique sans maintien entre commandes. Gel des items/dimensions, edge dwell et garde des sources préservés ; tests R6 ciblés PASS. Aucune simulation d’événements ne remplace ce contrôle |
| Apply / mutation de Draft personnelle Production | **NOT_RUN et non exécutés**, hors autorisation de ce lot |

Les premiers gestes de drag automatisés non admis sont expliqués par la trace : l’arrivée changeait de surface DOM lors du dernier mouvement, sans `drop`. Une arrivée dans la même surface a produit `dragover` admis puis `drop`. Aucun moteur de drag n’a été modifié pour faire passer ce test. La trace est opt-in, bornée à 60 événements dans le serveur de fixture localhost ; elle ne dispatch aucun événement et ne collecte aucune donnée personnelle.

## E. Compatibilité et justesse

Quinze suites ciblées **EXECUTED_PASS**, journaux dans ce dossier : L3.1, L3, R6 P4/P4.5/présentation, B0/B1, L1, L2-A, L2-B, C8, P13, Kernel, Draft HTTP, scheduler P2 et parité. Les trois suites de géométrie L3.1/P4/P4.5 ont été rejouées PASS après le dernier ajustement de largeur. TypeScript final code de sortie 0.

- L2-B rejoué en mode `REMAINING_ONLY` : index, recherche, 114 options, round-trip officiel, compatibilité et visuels vérifiés ; les 26 longues boucles par preset déjà PASS dans L3 sont réutilisées explicitement, pas annoncées réexécutées. Recettes et bibliothèque inchangées. **114 options publiées, aucune manquante** ; 124 routes incluent aussi des assets Context.
- Parité : **22 scénarios × 9 empreintes PASS**. Montants, réservations, UNKNOWN, digests et protections Apply/CAS conservés. Aucun golden financier modifié.
- Scénario 17 éléments avant/après layout : digest `36f227251254ddfeb6d413bce18ae17e37243fcf6e6fdaab5068ca0a842012f1`, Draft CLEAN. Le layout ne contient ni position persistée ni réordonnancement sémantique.
- Aucun diff serveur/domaine financier/Supabase/Draft transport/scheduler. Aucune nouvelle dépendance ni lecture World pour la présentation. SNAP-3 et ses configurations inchangés.
- Compteurs de fixtures : zéro Plan, zéro PlanRevision, zéro RPC Apply, zéro écriture distante et canaris financiers intacts. Les deux lectures COMMON/DENSE correspondent à leurs ouvertures/rechargements, pas aux interactions de présentation. Les sauvegardes du parcours drag sont exclusivement synthétiques.
- Les anciens fichiers de certification générés sont sauvegardés puis restaurés à leurs octets initiaux par le runner ; résultats nouveaux copiés dans le dossier L3.1.

## F. Performance ciblée

Même scénario déterministe de 17 éléments, viewport **effectif 1440 × 900** des deux variantes, mêmes dépendances et cache chaud, React compilé/minifié en production, sans charge de tests en parallèle. Même onglet sélectionné alternant les deux origines ; trois paires prédéfinies, échauffement exclu. Sonde existante `performance.now()` jusqu’à FRESH + deux animation frames. Aucun temps de l’outil Codex utilisé comme métrique produit. Ce serveur de fixture n’est pas Next/Vercel/Supabase Production.

| Mesure descriptive | L3 | L3.1 |
|---|---:|---:|
| Ouverture → FRESH médiane, n=3 | 222,6 ms | 205,4 ms |
| Étendue | 202,6–274,8 ms | 180,4–211,2 ms |
| DOM au repos | 1974 | 1973 |
| Images au repos | 6 | 6 |
| Requêtes métier par ouverture | 2 | 2 |
| JS décodé | 457 023 octets | 460 454 octets |
| JS gzip calculé sur fichiers | 144 356 octets | 145 241 octets |

Paires actives : 274,8/211,2 ; 222,6/180,4 ; 202,6/205,4 ms. Même digest dans les six échantillons. POST de fixture médian 54,5/52,4 ms. +885 octets gzip, sans dépendance lourde. **Aucun gain Production ni P95 certifié** : n=3 ne permet pas de conclusion de latence générale.

Les résultats défavorables précédents sont conservés, pas écartés : six paires dans deux onglets d’arrière-plan donnent 430,8 ms pour L3 et 561,9 ms pour L3.1, étendues 350,1–714,7 / 368,8–925,2 ms (`performance-background-*`). Cette différence de condition empêche de les fusionner avec la série active. Une itération intermédiaire `9cd553d` reste aussi archivée et identifiée. La variabilité ne permet pas d’attribuer un gain ou une régression générale au produit.

Pas de nouvelle reconstruction World lors de la pagination, de la palette ou du panneau ; pas de boucle ResizeObserver observée. Durées fines de pagination/paint et resize : NOT_MEASURED, pas de valeur inventée.

## G. GitHub / Vercel et rollback

- PR : https://github.com/adriensauvageot34/Budgetisation/pull/47.
- Produit final : `38f5cd95e40c1a03aad151b6d0c400c71705ddb1`.
- Preview finale produit : `dpl_4HDEB3uYDjVvMiGj9MVY5Xc4JZf5`, READY. Build Next complet distant : compilation, TypeScript, génération des pages, déploiement ; journal `preview-final-next-build.log`. Aucune installation fraîche locale certifiée.
- Merge / Production / smoke : **en attente au stade de revue**, à compléter après exécution réelle.
- Rollback compatible : revert des trois commits produit L3.1 ou retour au déploiement L3 initial, via workflow Git/Vercel normal. Aucune migration, conversion ni suppression de Draft nécessaire.

## H. Décision

P0/P1 : navigation d’identité, palette accessible, pagination lisible, surface mieux occupée, protections et parité vérifiées dans le périmètre ci-dessus. Les limites des gestes continus de drag et de performance sont conservées, sans être présentées comme PASS. La livraison UI peut avancer indépendamment de ces certifications complémentaires. **Aucun L4 commencé.**
