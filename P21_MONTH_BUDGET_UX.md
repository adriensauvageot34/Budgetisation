# Composer V22 · Budget mensuel P21

Branche `codex/p21-month-budget-ux`, basée sur `45cbb5810fe86f096a18e831300ecbdc6c1c8998` (PR #121).

## Ce qui change pour l’utilisateur

- « Les finances du mois » réunit revenus, solde déclaré, charges, titres-restaurant, enveloppes et épargne réservée. Les lignes indiquent leur provenance et leur état de connaissance. Les dernières références restent consultables pendant un recalcul.
- Le panneau distingue l’état de la simulation, la complétude et le résultat de la vérification avant création d’un Plan. « Actualiser les finances » relance le READ officiel pour le même brouillon. Les diagnostics techniques restent accessibles dans le détail.
- Les chargements Swile et Edenred absents sont signalés séparément. Chaque lien ouvre le formulaire officiel du mois concerné dans un nouvel onglet, avec le montant vide. Un zéro explicitement déclaré est affiché comme tel. Une source de salaire manquante renvoie vers la consultation de la prévision.
- Dans Courses, l’enveloppe publiée et son éventuelle cible apparaissent avec les montants par panier issus du Compiler. Le coût brut, la couverture et la contribution supplémentaire sont affichés séparément. Les sept résumés d’intention restent disponibles.

## Droits et sauvegarde

| Source | Parcours |
| --- | --- |
| Montant ou occurrences d’un poste du Board | Ajustement dans le brouillon si le champ est publié et modifiable pour ce mois. Validation existante de `control-input.ts` et sauvegarde durable Composer. |
| Poste protégé ou champ non publié | Consultation. Les ancrages, le plancher réel Courses et les permissions du poste restent appliqués. |
| Swile et Edenred | Centre de contrôle. Formulaire `save-wallet-expected-loading` du fournisseur et du mois, avec confirmation explicite. |
| Salaire de référence connu, charge publiée, solde déclaré | Formulaire mensuel du Centre de contrôle selon le champ publié. |
| Salaire absent ou source de prévision non publiée | Consultation des sources du mois. La publication reste du ressort de la prévision. |

Une saisie RAW reste locale jusqu’à la confirmation. Une référence devenue obsolète provoque un refus et conserve la saisie. Le bandeau de sauvegarde indique la confirmation du writer Draft.

## Vérifications

| Contrôle | Résultat |
| --- | --- |
| B1, lecture du mois et provenance | PASS, 15 contrôles |
| B2, contrôles Courses et garde-fous du Compiler | PASS, 7 contrôles |
| Impact budgétaire et parcours UX | PASS, les sept intentions, détail inclus, livraison, prix inconnu et couverture Courses |
| Chargements Swile et Edenred | PASS, 37 contrôles sur fixtures dont le routage et le champ vide, avec les actions existantes testées localement |
| Chrome sur fixtures | PASS à 1 280 × 720, 390 × 844 et 360 × 800. Aucun débordement horizontal ni chevauchement avec le Dock lorsqu’il est visible. |
| Draft durable synthétique | PASS pour RAW, validation, Undo/Redo, sauvegarde, Reload et digest. Une référence modifiée dans une réponse READ synthétique a déclenché le refus attendu. |
| Contrat HTTP Draft, TypeScript et diff Git | PASS |
| Recette financière authentifiée en Preview ou Production | NOT_RUN. La recette utilise des données synthétiques locales. |

Les essais n’ont créé aucun Plan ni écriture financière distante.
