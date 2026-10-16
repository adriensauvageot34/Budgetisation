# PRE-L4 C2 — Ergonomie et vérité visuelle de Composer

16 octobre 2026. Desktop uniquement. **Revue, sans fusion ni livraison Production.**

```text
PRE_L4_C2 = PASS_WITH_LIMITATIONS
D02_REFERENCE_DECISION = FIXED
D03_INLINE_GEOMETRY = FIXED
C1_REGRESSION = PASS
FINANCIAL_PARITY = PASS
C2_TESTED_SHA = 8978ac18b0b4dbe0650c044b3ca086a54014ba8b
C2_PR = https://github.com/adriensauvageot34/Budgetisation/pull/51
C3_READY = YES
```

Ces verdicts concernent les vrais composants React de production sur données synthétiques et les services locaux. **Aucun nouveau cycle JWT Supabase n’a été exécuté.** C3_READY signifie que C2 est prêt pour revue et pour la réception suivante, sans autoriser son démarrage.

## 1. Base et traçabilité

- Worktree initial propre, HEAD C1 `fb71ae2deb69a915bdf633b2ce721c4cf904821e`, descendant du produit testé `e49fe038ab75d8d117f13158abec32ca797642f2`.
- Main relu par fetch : `5cfb1211d114ddaa574f63372cdb9c4cfc7e660d`.
- PR C1 **#50 ouverte, non fusionnée, mergeable** au début de C2. Sa branche sert donc de base à la PR empilée #51, `codex/composer-v3-pre-l4-c2-workshop-ux`.
- `3af1b5f3e0e3c929ff155e48eb85a5e2d983768a` : statuts partagés, prix de référence, cellules inline et tests.
- `f9a7fce0a231843d1136ce57eff16f7164e880e9` : erreur inline compacte après chevauchement réellement observé sur le Board ; rejeu du garde C1, confirmation et Undo/Redo sur cette version. Les cinq gestes initiaux portent sur3af1b5f ; les handlers métier restent identiques ensuite.
- `8978ac18b0b4dbe0650c044b3ca086a54014ba8b` : marqueur graphique/accessibilité aligné sur le même statut explicite, sans confondre ownership financier et décision. Assertions SSR sur les cartes, TypeScript et contrôle navigateur final. HEAD produit testé avant ajout du présent rapport ; le commit documentaire suivant n’altère pas `src`.
- [Identité du bundle final](evidence/pre-l4-c2/bundle-identity.json) : quinze modules correspondent aux sources, avec seule normalisation CRLF/LF. [Référence C1](evidence/pre-l4-c2/reference-bundle-identity.json) : quatorze modules vérifiés contre Git. React minifié de production dans le host esbuild existant ; ce host ne remplace pas Auth/Next/Supabase.

Les rapports A0/C1 et la matrice AV-01…128 ont servi de contexte ciblé. Les 128 pistes ne sont pas réauditées.

## 2. D02 — Référence, décision, valeur inconnue

`controlAccessLabel` décrit désormais seulement la possibilité d’éditer. Le helper de présentation `control-value-presentation.ts` distingue, par dimension, la valeur explicitement enregistrée, la référence publiée et l’absence de valeur. Il ne calcule aucun montant économique.

Le Board, les contrôles inline, l’inspecteur, À piloter et le popover réutilisent ce statut. L’absence de décision d’une enveloppe optionnelle n’affiche plus le zéro technique comme un choix. Un zéro explicite reste une décision. Le prix historique reste visible et nommé **Prix de référence** quand seule la fréquence a été choisie ; **Prix choisi** exige un override explicite. Les coûts du poste restent ceux du Compiler.

| Cas exécuté par les vrais services | Résultat |
|---|---|
| Vêtements, Maison petit, Jeux sans décision | UNKNOWN, À définir, aucun choix retenu |
| Ces trois enveloppes avec zéro explicite | DECISION, 0,00 € |
| Café sans choix | Fréquence et prix de référence |
| Café count13 choisi, prix historique1,80 | DECISION de fréquence ; prix REFERENCE, non enregistré comme override |
| Café count13 et prix2,10 choisis | Deux dimensions DECISION |
| Coiffeur count1 connu, prix absent | Fréquence REFERENCE, prix UNKNOWN ; aucun prix inventé |
| Trajets travail fixes non adoptables | REFERENCE ; absence de droit d’édition distincte du statut |
| Savings protégée | Réservation REFERENCE, permission LOCKED ; protection conservée |

[Douze cas, contrats et SSR](evidence/pre-l4-c2/contracts.json). Le navigateur vérifie aussi le zéro Café, son retour à12, le zéro Vêtements, l’inspecteur et À piloter. Aucune référence utile n’est convertie automatiquement en décision.

Comparaison à1440×900 : [D02 avant](evidence/pre-l4-c2/D02-before-1440.png), [D02 après, SHA final](evidence/pre-l4-c2/D02-after-1440.png). Avant : Vêtements « Choix de ce mois0,00€ ». Après : « À définir · aucun choix retenu » sur les deux surfaces.

## 3. D03 — Géométrie locale

- Retrait du `nowrap` du compteur ; texte borné par sa cellule, wrapping autorisé.
- Prix unitaire réductible ; boutons +/− conservent24×26px et leur accès au focus.
- Formulaire en grille : entrée flexible, validation et annulation de28px, aide sur sa propre ligne.
- Erreur inline compacte ; en édition, illustration réduite et rappels de référence secondaires retirés du flux. Le titre, les actions de carte, l’entrée, Valider/Annuler et le garde C1 restent présents. Tab conserve toujours le texte ; l’aide complète est accessible par son titre.
- Aucun changement de taille déclarée des cartes, de pagination, de packing ou de modale des groupes.

| Mesure | Avant | Après |
|---|---:|---:|
| Zone centrale, Repas travail Manon |124,40px|124,40px|
| Largeur du texte inconnu |170,29px|124,40px, deux lignes|
| Recouvrement du bouton+ par le texte |42,89px|0|
| Courses en erreur sur Board, hauteur observée |271,90px, titre voisin recouvert pendant la première itération C2|145,30px ; titre voisin dégagé|
| Message d’erreur Courses, hauteur |83,20px|31,60px|

La première correction du compteur ne suffisait pas : l’erreur Courses recouvrait encore Restauration. Le second commit corrige ce défaut démontré, sans modifier l’algorithme du Board. [Première itération](evidence/pre-l4-c2/board-error-first-iteration.png), [état final](evidence/pre-l4-c2/board-error-final-1440.png).

| Dimensions DOM réelles | Board40, pages avant/après sans panneaux | Compteur inconnu/focus | Formulaire invalide | Inspecteur + palette |
|---|---|---|---|---|
|1440×900|4 /4|PASS|PASS|PASS local, cellules contenues|
|1728×900|3 /3|PASS|PASS|PASS local, cellules contenues|
|1920×1080|2 /2|PASS|PASS|PASS local, cellules contenues|

Avec les panneaux, la surface du Board diminue et le nombre de pages s’adapte normalement. Les nombres4/3/2 ne prétendent pas décrire cette configuration. Les rectangles de textes/entrées et boutons ont été comparés localement, en plus de l’absence de débordement global : [mesures avant](evidence/pre-l4-c2/geometry-before.json), [mesures finales](evidence/pre-l4-c2/geometry-after.json). Titres comportant une personne, titre Jeux sur plusieurs lignes, prix connu/inconnu, édition, erreur et Escape vérifiés. Beauté3 objets reste compacte à1440 : [capture](evidence/pre-l4-c2/beauty-1440.png).

Captures D03 aux trois dimensions : [avant1440](evidence/pre-l4-c2/D03-before-1440.png) / [après1440](evidence/pre-l4-c2/D03-after-1440.png), [avant1728](evidence/pre-l4-c2/D03-before-1728.png) / [après1728](evidence/pre-l4-c2/D03-after-1728.png), [avant1920](evidence/pre-l4-c2/D03-before-1920.png) / [après1920](evidence/pre-l4-c2/D03-after-1920.png). Les vues après sont du SHA final. [Erreur finale du groupe](evidence/pre-l4-c2/inline-error-1440.png), [Board, palette et inspecteur stabilisés](evidence/pre-l4-c2/dense-inspector-palette-1920.png).

## 4. Les cinq gestes réellement exécutés

| Geste | Résultat et identité |
|---|---|
| Courses250→texte300→confirmation | SAVED/FRESH puis texte300 visible, notice et Apply interdit ; digest final du250 `c260f156…` identique pendant RAW. Confirmation300 reconnue SAVED/FRESH ; Undo250 puis Redo300. Identité `HOUSEHOLD:household:groceries` conservée. [Capture](evidence/pre-l4-c2/C1-courses-raw-1440.png). |
| Café zéro puis fréquence connue |0 explicite, coût Compiler0 ; retour12, coût21,60. Prix1,80 reste une référence et le contrôle conserve son identité PERSON. |
| Sacs-poubelle4€ et rattachement | Création depuis la recherche, montant4, puis choix explicite « Inclus dans mon budget Petits achats maison ». Même contexte `282abf13-ec78-4ca3-8084-7974cd13bd51`, binding CONFIRMED_CONSUMPTION sauvegardé. Résumé générique « Consomme l’enveloppe retenue ». Aucune déduction « Courses » depuis le produit. [Capture](evidence/pre-l4-c2/purchase-covered-1440.png). |
| Charge fixe consultée/détachée | `obligation:rent`, même digest `b6e206f8…` avant/après ; préférence visuelle seulement. Rattachement remis ensuite. [Capture](evidence/pre-l4-c2/fixed-detached-1440.png). |
| Autre page puis groupe | Achat11 retrouvé en page2 du Board dense, ID `…033011` ; lien « Voir Repas travail Manon · page1 » rejoint le groupe Restauration et le contrôle PERSON exact `…333333333333:manon-work-meals`. Digest dense `2a7d1d9a…` inchangé. |

[23 observations navigateur et SHA par phase/capture](evidence/pre-l4-c2/browser-checks.json). Entrée, Escape, focus clavier et boutons utilisés ; les choix de couverture ont été activés au clavier dans le guide existant. Quelques actions de l’outil pendant une recomposition et des attentes limitées à3s ont expiré ; l’état a été relu avant de poursuivre, sans répéter une mutation réussie. Aucune durée de l’outil n’est une métrique produit. Les captures de transition incomplètes n’ont pas été retenues comme preuve finale.

## 5. C2-03 optionnel

- **B DONE** : le dialogue des charges précise que la disposition est locale au navigateur. Les favoris annonçaient déjà cette portée.
- **D DONE** : prix de référence/prix choisi distingués avec les champs existants.
- **A DEFERRED_OPTIONAL** : pas d’ajout de nom d’enveloppe au résumé d’achat. Le mode confirmé et le guide métier existant sont conservés ; aucun rapprochement par texte. Les composants compilés exposent une identité de binding, mais son raccordement au résumé n’est pas nécessaire à la clôture D02/D03 et reste hors du diff livré.
- **C NO_CHANGE_NEEDED** : aucun remplacement général de vocabulaire ni suppression de provenance.

## 6. Gates, limites et absence d’effets métier

| Contrôle exécuté | Verdict |
|---|---|
| Contrats C2 |PASS12 cas, SSR ; modèle inchangé,0lecture de présentation|
| C1 admission/historique/registre |PASS6 groupes ; mêmes sources de validation que le SHA final|
| L3.3 |PASS11 groupes, rejoué après CSS final ; Apply/Reload PGlite et protections|
| L3.1 |PASS8, rejoué après CSS final ; groupes, IDs et pagination|
| Présentation R6 |PASS groupes FOOD/BEAUTY, identités et absence de total React ; rejoué après CSS final|
| C8-017 |PASS assertion originale exécutée isolément ; ne constitue pas un rejeu de tout C8|
| Bibliothèque L3.2 |PASS ;47 presets,13 Contexts et114 options conservés, pas114 manipulations manuelles|
| P13 |PASS8, CAS/idempotence/relecture isolés|
| Draft HTTP / scheduler |PASS5 chacun ; services simulés/fixtures, pas JWT|
| Parité financière |PASS22×9=198 empreintes inchangées ; aucun golden modifié|
| TypeScript |PASS exit0 sur le SHA final|
| Next complet final |PASS `npm run build`→Next16.2.6, compilation43s, TypeScript39s, génération8/8 et optimisation terminées ; Preview `dpl_6TTnoFFriwc3KzCwQLtJfZ8DNB5P` READY sur8978ac1. Les deux builds antérieurs3af1b5f/f9a7fce sont aussi conservés.|

[Journaux des suites](evidence/pre-l4-c2/regressions.json), [build final intégral](evidence/pre-l4-c2/vercel-next-build-final.log). Le premier typecheck a détecté un rétrécissement TypeScript insuffisant sur un tableau JSON readonly ; corrigé avant le commit produit. Le collecteur de preuves a d’abord comparé des objets avec des champs différents (`ok`) ; comparaison corrigée à projection identique, sans relancer les gestes métier. Les anciens fichiers de preuve ont été préservés. Les builds Vercel utilisent les dépendances/cache habituels, sans certification d’installation fraîche.

[Compteurs serveur](evidence/pre-l4-c2/browser-server-state.json) : **0 Plan,0PlanRevision,0RPC Apply,0écriture distante,0écriture sur canaris historiques** dans les trois scénarios. Pour les séquences visuelles : même journal de requêtes avant/après, donc0requête supplémentaire pour recherche, catégories, panneaux, groupes, édition invalide et resize. Les quatre READ initiaux du scénario dense proviennent des quatre chargements explicites, pas des gestes visuels.

Quatre onglets candidats :0erreur console relevée. Aucun lecteur, service financier, mutation serveur, migration, modèle statistique, SNAP-3 ou owner ajouté. Le seul changement de domaine est le texte retourné par le helper d’accès. Les calculs et montants restent au Compiler/Finance V2.

**Réserves héritées, non converties en PASS :** cycle authentifié isolé C1-03 NOT_RUN ; dialogues natifs confirm/beforeunload et drag natif NOT_RUN. Aucun compte F0 réactivé, Draft personnel ou Plan réel touché. Pas de campagne P95 ni certification de performance réelle. La vérification géométrique couvre les états et fixtures décrits, pas toutes les longueurs et cardinalités possibles.

## 7. Reproduction, revue et rollback

Contrats : `node scripts/check-pre-l4-c2.mjs`. Campagne ciblée avec conservation des anciennes preuves : `node scripts/check-pre-l4-c2-regressions.mjs`. Fixture navigateur existante compilée avec `PLANNER_L1_SPLIT=1`, React production, sortie `outputs/pre-l4-c2-candidate`, servie précompilée par `serve-phase2-planner-composer-fixture.mjs`, port3218. Scénarios `L1_L33_DENSE_C2_AFTER`, `L1_L33_C2_GESTURES` avec `durable=1`, et `DISSOLVE_BEAUTY`. `record-pre-l4-c2-evidence.mjs` contrôle compteurs et sources des deux bundles. Aucun service externe nécessaire pour ces gestes.

Les bundles générés restent hors dépôt après validation. Seules preuves utiles, journaux et scripts reproductibles sont versionnés. PR#51 destinée à la revue, dépendante de#50. Revert possible : `8978ac1`, `f9a7fce`, puis `3af1b5f` ; C1 conservé, aucune opération SQL ou suppression de données.

**STOP C2. Aucun C3/L4 commencé ; main et Production non modifiés.**
