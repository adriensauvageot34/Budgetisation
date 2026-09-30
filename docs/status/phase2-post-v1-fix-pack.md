# Planned Expenses — Post V1 Fix Pack

Date : 30 septembre 2026. Base : `77246805206912f735e2b5661f6e87e6b29b572d`, branche `main`.

## Changements

- Entrées directes Restaurant, Fast-food et Repas au travail ; visites séparées des voyages. Les 38 contextes restent accessibles.
- Contacts prospectifs, hôte, participants nommés et invités ; lieux associés et quantités proposées partagés avec le serveur.
- Total rapide indépendant des compléments : Transport racine, cadeau, BringItems et frais de livraison. Remplacement explicite d’un total avec Undo, sans double comptage.
- Transport unifié, modes voiture/train/bus/taxi/covoiturage/gratuit/autre ; historique dirigé et carburant économique conservés. Une saisie incompatible est conservée pour réparation/Undo.
- Provider distinct du vendeur, suggestions de frais sans montant inventé ; financement mixte avec montants explicites. Alcool/non-alimentaire Banque ; aliments et boissons sans alcool éligibles repas selon les règles existantes.
- Classification spécifique des lieux avant les règles larges ; filtres par type d’achat ; feedback immédiat des assets sélectionnés.
- Questions d’habitudes regroupées par module, blockers présentés à l’étape concernée, reset du split et références contrôlées côté serveur.
- Paiement Banque plus lisible ; détails financiers accessibles ; calendrier compact avec brandmarks locaux et fallback sémantique.
- Prix observés étendus aux quatre besoins non ambigus présents : mascara, sourcils, fixateur et masque visage. Les achats « divers » et accessoires non spécifiques restent exclus.

## Persistance

Audit live : **0 dépense prospective**. Le JSON de contexte existant porte les nouvelles références ; aucun changement de schéma, aucune migration, aucune écriture historique ou fixture live ajoutée. Aucun contact n’est inséré dans `persons`.

## Vérifications exécutées

- `node scripts/check-phase2-post-v1-fixes.mjs` : **PASS**, 13 groupes de preuves, dont références étrangères refusées, Preview sans écriture, Save/reload identique, total 50 + transport 18 = 68 et Undo.
- `node node_modules/typescript/bin/tsc --noEmit` : **PASS** sur les derniers changements.
- Suites DD6 existantes : **PASS** lors des reruns exécutés pendant l’implantation ; métamorphiques, finance, routes, lifecycle, serveur et projections.
- Audits live en lecture : **PASS** ; preuve RLS C10 antérieure réutilisée explicitement, SQL et policies inchangés, sans nouvelle mutation distante.
- Build production : **PASS** pendant l’implantation. À la demande de l’utilisateur, aucun nouveau rerun exhaustif après les derniers ajustements ; la vérification finale interactive est laissée à l’utilisateur.
- Navigateur local, sans Save : Restaurant direct ; 50 + taxi 18, aperçu Banque 68 ; visites uniquement famille/amis ; Greg et BringItems avec total conservé ; Lucas hôte obligatoire et lieu prérempli ; provider Uber Eats/vendeur McDonald’s, frais vides et absence de trajet utilisateur.
- Aucun contrôle Vercel exécuté.

Les rapports C10 décrivent leur HEAD historique et ne constituent pas une recertification exhaustive de ce correctif. Le pack ne revendique pas un nouveau `IMPLEMENTATION_CERTIFIED` sur la seule base de ces smokes.
