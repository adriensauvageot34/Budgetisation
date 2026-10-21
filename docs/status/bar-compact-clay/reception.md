# Bar / Apéro compact — réception du 21 octobre 2026

## Addendum — cinq finitions avant fusion de #81

**Cette section actualise la réception initiale conservée ci-dessous. PR #81 toujours Draft ; aucun merge ni Production.**

Référence de cette tranche : `dc073ac73bed087471556daffbe2a8a5b4231962`, branche vérifiée propre pour les fichiers suivis. Produit : `dcd225dcab52a7a26adaf8cc6f4e25bf4bd31c33`, puis finition CSS `8712ce6b650efa3ebd127b4c5eb5bc0b1c1b75d7` (fondu latéral et premier avatar ancré à droite). Les anciennes sorties locales restent hors lot.

Preview du premier commit produit : [READY dcd225d](https://budgetisation-2hn9y9rrd-adriensauvageot34-6137s-projects.vercel.app). **La Preview du SHA 8712ce6 reste NON CERTIFIÉE à cet instant** : aucun déploiement trouvé pour ce SHA. La revue automatique a refusé une création API sans cible puis l'omission de `target`, jugée ambiguë, bien que la documentation REST officielle décrive cette omission comme Preview. L'essai avec `target: preview` avait été rejeté par l'API (400), sans création. Aucun contournement effectué. Alternative officielle à cible explicite vérifiée : CLI `--target preview`, mais `vercel whoami` répond **Logged out**, exit 1. Aucun secret ni connexion automatique repris. La PR et son code restent disponibles sur GitHub ; aucune création Production n'a été effectuée. Le résultat final de la Preview doit être lu dans la PR, sans attribuer le build dcd225d aux deux dernières lignes CSS.

### Causes et corrections

1. **Image d'ambiance** : preuve HTTP locale [avant/après](polish/background-http.json). L'ancienne fixture répondait `200 text/html`, 372 octets, à l'URL de l'image : `scenes` manquait dans sa whitelist. Il s'agit d'un défaut de la recette locale, pas d'une preuve d'échec du CDN Production. En parallèle, le cartouche fermé `flex:1` couvrait le haut disponible. La fixture sert maintenant le vrai WebP (10 466 octets) ; cartouche borné, illustration existante en haut à droite, rendu à 240 px et masque horizontal/vertical. Aucun nouvel asset, aucune hausse d'en-tête pour la décoration.
2. **Largeur selon les moments** : `presentation/bar-closed-width.ts` réutilise les groupes de présentation et l'owner Before. Un moment seul reste à 350 px demandés ; plusieurs moments utilisent leurs deux tuiles visibles de 132 px, les gaps et le compteur de 34 px. Le rail principal demande 478 px utiles + 45 px de sécurité pour l'arrondi au plus proche des pistes existantes, soit 523 px. Deux trajets conservent leur réserve de 580 px. Huit largeurs de shelf de 478 à 1330 px sont contrôlées avec le véritable packer, inchangé. Les métadonnées, montants et noms ne déterminent jamais la largeur. Un premier essai à 478 demandés ne suffisait pas (453 réels, Tapas encore coupé) : défaut mesuré puis corrigé, sans masquer la différence.
3. **Titres** : badges intrinsèques de 17,6 px de haut au lieu de 83 × 29 px ; largeur mesurée Vodka 40,9, Crazy 37,4, Tapas 37,9 px. Ils chevauchent seulement le contour supérieur ; intersection titre/image et titre/quantité = 0 dans les scènes mesurées. `Crazy`, `Diluant`, `Tapas`, `Vodka` et les libellés complets accessibles restent inchangés. Prix, quantité ×99, SHARED et inconnu gardés.
4. **Participants** : face peinte arrêtée 12 px au-dessus de l'enveloppe mesurée. Les avatars chevauchent cette bordure tout en restant dans l'allocation et la zone cliquable de la carte ; pas de portal, pas de débordement sur les voisins. Premier participant à droite, suivants vers la gauche. 1/2/3/7 personnes contrôlées ; sept = trois initiales et +4.
5. **Date** : même emplacement supérieur droit, fond crème, bordure douce, padding 5 × 7 px, graisse 650, contraste renforcé ; 74 × 25,6 px sur la scène principale. Aucun changement de date, calendrier ou sauvegarde.

### Dimensions réellement observées

Navigateur Codex sur fixture locale synthétique ; largeurs effectives, pas dimensions de viewport seulement demandées. Aucun gain de performance temporelle revendiqué.

| Scène | Viewport | Avant dc073ac | Après |
| --- | --- | --- | --- |
| Vide | 1440 × 1000 | 375,69 × 155 | 375,69 × 155 |
| Métadonnées seules | 1440 × 1000 | 375,69 × 135 | 375,69 × 135 |
| Before seul | 1440 × 1000 | 375,69 × 255 | 375,69 × 245 |
| Before + Au bar | 1440 × 1000 | 375,69 × 255 | 529,96 × 245 |
| Before + Au bar + deux trajets | 1440 × 1000 | 607,10 × 385 | 607,10 × 375 |
| Lieu long, ×99, prix long, sept personnes | 1920 × 1080 | — | 541,69 × 265 |
| Before + Au bar, étroit | 768 × 900 | — | 398 × 245 |
| Board dense, Bar ouvert | 1152 × 720 | — | 772 × 425 |

Le montant long peut demander 20 px de hauteur supplémentaire dans le cartouche ; il n'agrandit pas la largeur. Sur le résumé principal : rail 508 px, scrollWidth 508, trois tuiles visibles entièrement, deux titres de moments à la même hauteur et +3 non interactif. Sur viewport étroit : rail 376 px, contenu 458 px, Fin atteint 81,6 px sur 82 disponibles ; aucun débordement du document. Le Board garde son propre scroll.

Board dense : 47 éléments annoncés, zéro collision de cellules stabilisées ; ouverture centrée à −0,60 px, en-tête visible, commandes de consommation accessibles. Un premier essai d'ouverture a dépassé le délai de l'outil mais l'action avait abouti : inspection de l'état avant toute nouvelle action ; aucune duplication. Le défilement manuel ultérieur décale la carte de 260 px sans reprise forcée du centrage ; Escape referme via le bouton du titre. Pas de certification de cadence FLIP.

### Captures et preuves

- [Avant principal](polish/before-mixed-1440.png) / [après final](polish/after-mixed-1440.png).
- [Carte, date et avatars en détail](polish/after-card-detail.png), [badges en détail](polish/after-badges-detail.png) : recadrages/agrandissements des pixels de la vraie capture, aucun mock généré.
- [Vide](polish/after-empty-1440.png), [métadonnées](polish/after-meta-1440.png), [Before seul](polish/after-before-1440.png), [plusieurs produits](polish/after-many-1440.png).
- [×99, montant long, sept personnes](polish/after-long-1920.png), [un participant](polish/after-people1-1440.png), [trois participants](polish/after-people3-1440.png).
- [Viewport étroit après navigation clavier](polish/after-narrow-768.png), [Board dense ouvert](polish/after-dense-open-1152.png).
- [Rectangles et assertions navigateur](polish/browser-final.json). Les captures secondaires de la première passe correspondent à dcd225d ; la capture principale finale et ses recadrages correspondent à 8712ce6. Les deux dernières lignes CSS ne changent ni dimensions, ni contrats, ni événements.

### Contrôles réellement exécutés sur cette tranche

| Contrôle | Résultat | Preuve |
| --- | --- | --- |
| Compact, groupes, dimensions, personnes, ownership | 12 PASS, 9 scènes + arrondis de pistes | [journal](polish/check-bar-compact-clay.log) |
| Carte fermée R6.1 | 17 PASS | [journal](polish/check-bar-r61-closed.log) |
| Groupes R6 | 13 PASS | [journal](polish/check-bar-ux-r6-groups.log) |
| Board continu | 9 cas PASS | [journal](polish/check-bar-board-continuous.log) |
| Géométrie R5 | 17 PASS | [journal](polish/check-bar-geometry-r5.log) |
| Polish R7.3 | 8 PASS | [journal](polish/check-bar-r73-polish.log) |
| Consommations R7.2 | 9 PASS, Apply/Reload et CAS synthétiques isolés | [journal](polish/check-bar-r72-consumption.log) |
| Kernel | 40 PASS | [journal](polish/check-phase2-planner-kernel.log) |
| Parité financière | 198/198 PASS | [journal](polish/check-planner-performance-parity.log) |
| TypeScript | exit 0 | [journal sans erreur](polish/typescript.log) |
| Build Next Vercel | READY dcd225d ; 8712ce6 NON CERTIFIÉ | [journal complet](polish/vercel-next-build.log), [déploiement](polish/preview.json) |

L'extension du test a d'abord échoué sur la scène tall : le parseur trie les contextes et le test supposait que le Bar était le premier. Le test utilise maintenant son ID réservé explicite, sans changement du parseur ou du produit. L'attente ancienne `Before.width === mixed.width` a été remplacée conformément à cette mission ; l'égalité empty/meta/before reste vérifiée. Aucun golden économique modifié.

**Verdict : cinq finitions implémentées et réception visuelle ciblée PASS avec réserves.** Aucun contrat économique, état sémantique, owner, Compiler, Finance ou Mobility changé. Packer, FLIP, scroll et événements d'édition inchangés. Aucun accès Supabase ni écriture réelle, aucune migration. Le nouveau comportement prix global/descriptions n'est pas développé.

Réserves conservées : Save/Reload Supabase authentifié, drag/corbeille natifs, trackpad physique, préférence native de mouvement réduit et campagne RAW exhaustive navigateur **NOT_RUN dans cette tranche**. Les garanties d'Undo/RAW/CAS sont couvertes par les contrôles synthétiques pertinents, sans PASS authentifié revendiqué. Pas de nouvelle certification du ressenti temporel. Rollback : revert 8712ce6 puis dcd225d, sans suppression de données ni migration.

---

## Livraison et limites de portée

- Base vérifiée : `main` / `59ee044d91553d38add9e7d53949a450ac437f2f` ; fichiers suivis initialement propres. Les sorties locales des réceptions précédentes restent hors lot.
- Branche : `codex/bar-compact-clay-focus` ; PR Draft [#81](https://github.com/adriensauvageot34/Budgetisation/pull/81).
- Produit final : `3c2adcd9293cde80ea8893b8276314295523a9e3` (implémentation `c89d889`, puis séparation du marqueur partagé et du prix).
- [Preview du SHA produit exact](https://budgetisation-6lsv2bz16-adriensauvageot34-6137s-projects.vercel.app) : `dpl_3UbVs56TkBzPFtUW7ukii342KCjM`, Next **READY**, cible Preview. Les preuves visuelles ci-dessous proviennent du véritable navigateur sur serveur local synthétique, pas d'une session financière Vercel.
- Aucun merge, aucune promotion Production, aucune migration ni écriture Supabase de cette mission. Aucun contrat DIRECT/DETAILED, calcul économique, Compiler ou Finance modifié.

## Résultat des sept chantiers

| Chantier | Réalisation | Réception |
| --- | --- | --- |
| A1 | Recentrage sur le viewport réel du Board à l'ouverture ; coordonnées finales corrigées de FLIP, une seule stabilisation possible, aucune reprise sur prix/quantité/provider ; saisie manuelle prioritaire. Carte haute : en-tête privilégié. | PASS limité à la fixture : écart −0,6 px à 1152×720 sur le Board dense, 0 px sur la scène haute ; scroll manuel +260 px respecté. Pas de nouvelle boucle de placement. |
| B1 | Lieu dans le titre via bouton frère du bouton d'ouverture ; date en badge supérieur ; initiales et +N en bas à droite dans une enveloppe réservée. Seules les informations absentes conservent une petite action d'ajout. Éditeur ouvert inchangé. | PASS React et navigateur : lieu, calendrier et personnes accessibles ; focus calendrier sur `2026-11-14`, Tab vers le lieu. |
| B2 | Un rail commun aux moments. Un moment : tous les groupes accessibles ; plusieurs : deux groupes par moment et compteur informatif. Owner, slot, selectionId et popover d'origine conservés. | PASS : 5 groupes Before seuls ; Before + Au bar = 2 + compteur +3, puis Tapas ; compteur SPAN sans handler/focus. Before reste un enfant. Les libellés historiques main/food sont conservés. Aucun contrat After ajouté. |
| B3 | Scrollbar du rail fermé masquée ; scrollbar du Board conservée ; clavier et défilement natif maintenus, chaînage horizontal contenu. | PASS clavier : Fin atteint 337,6 px sur 338 disponibles, Board à 0. Aucun contrôle du périphérique trackpad physique revendiqué. |
| C1 | 13 objets WebP alpha 256×256. Six nouvelles variantes Clay ; réemploi des sept ressources alpha existantes. Contain, sans multiply ni recadrage. | PASS alpha et inspection visuelle ; chargement effectif des six objets de la scène riche. Fallback icône conservé et testé en React. Aucun détourage approximatif ni modification des images des autres assets. |
| C2 | Titres flottants, quantité séparée, prix en bas ; marqueur partagé séparé du prix. Badges « Crazy », « Diluant », « Tapas » selon la précision utilisateur ; noms complets dans les données, noms accessibles, title et rappel au focus/survol. | PASS ciblé : contenu long, 7 participants, quantité élevée et montant long ; pas d'élargissement par le texte. Recouvrement titre/quantité et prix/partage mesuré à 0 sur les trois tuiles visibles finales. |
| C3 | `? €` en beige doux, y compris dans l'éditeur ouvert. Montants partiels et UNKNOWN conservés. | PASS React et navigateur ; aucun prix inconnu supprimé, aucune nouvelle règle de portée économique. |

## Comparaison visuelle mesurée

Même fixture Before (5 groupes) + Au bar (Tapas), viewport effectif 1440×900 :

| Mesure | Main 59ee044 | Candidat |
| --- | ---: | ---: |
| Largeur de carte fermée | 607,10 px | 375,69 px |
| Hauteur | 415 px | 255 px |
| Rails verticaux distincts | 2 | 1 |
| Données conservées | 6 lignes | 6 lignes ; 3 groupes visibles et +3 informatif |

La largeur résulte des pistes du packer existant, pas d'une largeur CSS arbitraire. Sa valeur varie avec le viewport. Cette comparaison provient des rectangles relevés juste avant les captures [avant](images/before-mixed.png) et [après](images/after-mixed.png). La capture après précède le raccourcissement des titres et la dernière position du marqueur partagé ; [carte finale](images/closed-final-compact.png) montre ces finitions. Aucun gain de performance temporelle n'est déduit de ces dimensions.

Autres observations :

- À 1440×900 : carte vide 375,69×155 ; métadonnées complètes sans consommations 375,69×135 ; Before seul 375,69×255. Ajouter Au bar ne crée plus de rangée ni de réserve supplémentaire.
- À 1920×1080 : contenu long 384,06×255, aucun débordement de document ni chevauchement de cartes mesuré.
- À 1152×720, SHA final : carte dense fermée 386×255, ouverte 772×425 ; scène haute avec trajets 772×535, en-tête visible à y=183,1. Zéro chevauchement des cellules dans ces observations stabilisées.
- Une modification de la fenêtre pendant la réception a été enregistrée dans le JSON avec ses dimensions effectives (1159×812). Elle n'est pas présentée comme une réception à 1280 px. Une observation tardive de la référence ouverte est également exclue de la comparaison fermée.

Preuves : [géométrie](browser-geometry.json), [navigation des métadonnées](metadata-browser.json), [badges](badges-browser.json), [clavier](keyboard-browser.json), [inventaire avant](art-before.json), [alpha final](art-final.json).

## Scènes du cahier

| Scène | Statut réellement obtenu |
| --- | --- |
| 1 — Vide | PASS navigateur final : aucun rail fictif, actions d'ajout et montant inconnu |
| 2 — Métadonnées | PASS navigateur et handlers React ; suppression de la rangée redondante |
| 3 — Before seul | PASS : cinq groupes conservés, rail défilable au clavier |
| 4 — Before + Au bar | PASS : un rail, +3 non interactif, aucune variation de hauteur par deuxième moment |
| 5 — Texte long | PASS limité aux données synthétiques : longue destination, 7 personnes, quantité 99, montant long ; largeur maîtrisée et noms complets accessibles |
| 6 — Board dense | PASS final à 1152×720, 47 éléments annoncés : centrage, défilement manuel, fermeture, zéro collision stabilisée |
| 7 — Carte haute | PASS final : Before + Au bar + aller/retour, en-tête visible ; aucun recentrage vertical sur le milieu cachant le titre |
| 8 — Clavier / mouvement réduit | PARTIAL : Tab, Enter, Escape, rail Fin et navigation directe exécutés ; réglage natif prefers-reduced-motion NOT_RUN, capacité non exposée par l'outil. Le code respecte la préférence. |

Captures : [vide](images/empty-final.png), [métadonnées](images/metadata.png), [Before](images/before-only.png), [texte long](images/long-content.png), [Board dense ouvert](images/dense-open-final.png), [scène haute](images/tall-open-final.png), [objets Clay](images/clay-objects.png).

## Contrôles exécutés

- TypeScript `node node_modules/typescript/bin/tsc --noEmit` : PASS, y compris après correction finale du scope de la sonde.
- `check-bar-compact-clay.mjs` : 7 scénarios/contrôles PASS ; owner/slot/identités, compteur non interactif, libellés courts/full names, fallback image, absence de mutation sémantique, géométrie initiale et scroll borné.
- `check-bar-r61-closed.mjs` : 17 PASS.
- `check-bar-ux-r6-groups.mjs` : 13 PASS, projections serveur et identités.
- `check-bar-board-continuous.mjs` : 9 cas PASS.
- `check-bar-geometry-r5.mjs` : 17 PASS.
- `check-bar-r73-polish.mjs` : 8 contrôles PASS après actualisation justifiée. Sur main 59ee044, l'ancien test échouait déjà sur le menu `details/Actions` supprimé précédemment. Reproduction réellement exécutée avec les modules du SHA main ; assertions mises à jour vers les commandes directes et Escape, sans supprimer leurs callbacks. Seule l'URL d'image est adaptée au nouvel asset.
- `check-bar-r72-consumption.mjs` : 9 PASS, dont DIRECT/DETAILED sans double compte, UNKNOWN/ZERO, Undo/Redo, CAS, sauvegarde/relecture et Apply/Reload SQL **synthétiques isolés**.
- `check-phase2-planner-kernel.mjs` : 40 PASS, zéro écriture distante.
- `check-planner-performance-parity.mjs` : 22 cas × 9 hashes = **198/198 PASS**, zéro écriture distante.
- `git diff --check` : PASS. Aucun script lint ni ESLint configuré dans le package ; pas de PASS lint inventé.
- Build Next normal Vercel au SHA produit final : READY. La jonction locale de dépendances déjà documentée n'a pas été contournée ; pas de nouveau PASS build Next local revendiqué.

Les échecs intermédiaires ont été corrigés : fixture avec quantité 12345 rejetée par le contrat (remplacée par 99), parenthésage TypeScript, whitelist d'images du serveur de recette et bundle de navigateur resté sur l'ancienne URL. Un compteur de prix incomplets Before pouvait annoncer à tort un trajet absent : le texte utilise désormais les états de projection déjà publiés, sans changer les montants.

## Fichiers et responsabilités

- `bar-living-card.tsx` : présentation fermée spécialisée, rail commun et cibles d'édition exactes.
- `bar-component-group.tsx` : badges, noms courts et accessibilité complète ; pas de calcul économique ajouté.
- `bar-product-visual.tsx` et `public/.../bar-compact/` : mapping des objets alpha et fallback existant.
- `composer.module.css` : consolidation du bloc fermé, enveloppes et styles alpha ; éditeur ouvert uniquement pour l'image contain et l'inconnu beige.
- `presentation/adapter.ts` : réserve initiale cohérente avec un rail, élargissement uniquement pour deux trajets ; mesure intrinsèque du Board conservée.
- `bar-surface.ts`, `board-carousel.tsx` : cible de scroll bornée et orchestration d'ouverture. Ni packer ni moteur d'animation réécrits.
- Scripts et fixtures : réception déterministe, référence visuelle main et corrections des attentes d'affichage obsolètes.

## Réserves et verdict

**Implémentation des sept chantiers livrée en PR ; réception ciblée PASS avec réserves.**

- Drag natif, corbeille par drag, vrai trackpad et préférence native de mouvement réduit : pas de nouvelle certification navigateur. Les handlers et la géométrie existants sont conservés ; ne pas transformer cela en PASS natif.
- Sauvegarde Supabase authentifiée, Google live et Apply réel : NOT_RUN dans cette tranche UI. Les tests de conservation/Apply cités sont synthétiques. Aucun Plan personnel ni aucune source réelle n'a été écrit.
- Saisie RAW et Undo/Redo couverts par les tests ciblés existants ; pas de nouvelle campagne exhaustive RAW navigateur revendiquée.
- Pas de P95 d'interaction, de certification de cadence des animations ni de gain de latence annoncé.

Rollback : revert des deux commits produit, sans migration ni suppression de données. Le contrat financier et tous les montants sont inchangés.
