# Suggestions contextuelles Week-end — P21

Branche `codex/p21-weekend-suggestions`, base `b619c9b8e62ca94ac253609c6aa83e2990b7455b` (PR #117). Doctrine `STRAT:P21-RECENTRAGE@v1`.

Le résumé du séjour affiche jusqu’à quatre propositions dans le Dock existant. Le classement utilise l’état du brouillon et les capacités publiées de l’occurrence. Les illustrations Clay de l’hébergement, du petit-déjeuner et de la taxe de séjour sont réutilisées.

| Situation | Proposition |
| --- | --- |
| Hébergement à préciser | Ouvrir l’éditeur de l’hébergement. |
| Hébergement choisi | Ouvrir sa ligne, avec son identifiant et son mode tarifaire. |
| Date manquante ou durée nécessaire au tarif par nuit | Ouvrir le champ correspondant. |
| Petit-déjeuner ou taxe à examiner | Consulter le poste. Un montant compris reste couvert par le forfait. La préparation d’un supplément distinct puis sa validation sont deux actions explicites. |
| Supplément déjà saisi | Ouvrir sa ligne. En cas d’homonymie, choisir la ligne par son rang, son libellé et son montant disponible. |
| Déplacement admissible | Ouvrir la configuration si Mobility publie le socket, le choix et l’éditeur compatibles. Un trajet lié à un autre propriétaire reste hors des suggestions d’édition. |

L’adaptateur utilise le classement S1/S2, le Dock et le masquage de session par occurrence. Les propositions ouvrent les formulaires du séjour et conservent le digest. L’éditeur utilise `EDIT_SHORT_STAY` et les protections existantes de l’historique et des saisies non validées. Les capacités et cibles sont vérifiées avant édition. Le Compiler conserve le calcul du forfait, du tarif par nuit et des postes additionnels validés.

## Vérifications locales

| Contrôle | Résultat |
| --- | --- |
| `check-composer-v22-a06-stay.mjs` | 12 cas PASS. Identités, homonymes, capacités, cibles obsolètes, forfait de 200 €, tarif de 100 € pour deux nuits, supplément distinct et montants inconnus. Le World de fixture est resté identique et aucun writer n’a été invoqué. |
| `check-restaurant-suggestions.mjs`, `check-composer-restaurant-included-details.mjs`, `check-composer-v22-a3-restaurant.mjs` | 32 contrôles PASS, dont la non-régression Cinéma S1/S2. |
| Navigateur et fixture Composer | PASS à 1 280 × 720 et 390 × 844. Ouverture et masquage avec digest identique. Une ligne de petit-déjeuner à 6 € est restée identique pendant l’édition de sa ligne homonyme de 9 € à 10 €. Undo et Redo ont retrouvé les digests attendus. |
| TypeScript et contrôle du diff | PASS. |

La recette locale utilise le serveur synthétique Composer existant. La validation Preview est relevée dans le compte rendu de livraison. Le masquage est limité à la session et S3 est différé.
