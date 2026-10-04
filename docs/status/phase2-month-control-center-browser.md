# Centre de contrôle — vérification navigateur PC

## Périmètre

2026-10-04, application locale sur `localhost:3001`, session existante, viewport temporaire 1440 × 1000. Cua a piloté le navigateur réel, avec actions utilisateur et lecture du DOM. Aucun mot de passe, identifiant de foyer, export privé ou montant personnel n’est inclus dans ce rapport. La capture reste hors dépôt.

## Résultats réellement observés

| Parcours | Statut | Preuve observée |
| --- | --- | --- |
| Chargement et ouverture depuis la navigation | PASS | Centre accessible ; bouton immédiatement avant l’ajout de dépense |
| Cinq zones | PASS | À piloter, Objectifs & choix, Réglages du mois, Ressources & réserves, Fiabilité |
| Raccourci Swile | PASS | Zone Ressources ouverte, wallet Swile visé et détails dépliés ; aucun focus sur le chargement |
| Raccourci Courses | PASS | Zone Objectifs & choix ouverte et éditeur de repère visé |
| Escape et retour du focus | PASS | Dialog fermé ; focus revenu au bouton qui l’avait ouvert après le frame de restauration |
| Scroll du fond | PASS | `overflow:hidden` à l’ouverture ; restauration à la fermeture ; fond rendu inerte par OverlayFrame |
| URL sémantique et reload | PASS | `month`, `control`, `focus` ; même zone rouverte après reload, aucun draft financier dans l’URL |
| Mois calme | PASS | Aucune offre imposée ; exploration libre disponible par action secondaire |
| Première décision | PASS | Replay serveur, comparaison actuel/scénario et consommation évitée affichés ; cagnottes protégées identiques |
| Deuxième décision | PASS | Brouillon 2/2, effet cumulatif affiché, aucune troisième offre ; aucune écriture d’adoption |
| Retrait | PASS | Retour à 1/2, résultat recalculé, autres cibles de nouveau proposées |
| Fermeture puis réouverture | PASS | Première décision et sa comparaison conservées, sans rechargement de la page |
| Présentation PC | PASS | Modale centrée, cinq zones lisibles, couleurs et fermeture corrigées après inspection visuelle |
| Console après parcours | PASS | Zéro entrée de niveau error |
| Saisie puis enregistrement du stock Swile | NOT_TESTED | Écriture live soumise à la validation humaine prévue par AGENTS.md |
| Adoption de deux décisions et restauration | NOT_TESTED | Même validation requise ; plan de test préparé, aucune écriture live effectuée |
| Erreur d’enregistrement réelle et contexte conservé | NOT_TESTED | Chemin automatisé et gestion locale implémentés ; aucune erreur live provoquée |

## Résultat

`BROWSER_USER_FLOW = PARTIAL`

La navigation, les liens, le focus et les previews ont été vérifiés dans le navigateur. L’adoption atomique, le stale guard et la relecture sont prouvés par les actions réelles avec transport synthétique dans CC-029 à CC-032 et CC-050 à CC-052 ; cela ne certifie pas leur parcours navigateur live.

Le plan d’écriture temporaire et restauration se trouve dans `phase2-month-control-center-browser-plan.md`. La validation demandée reste en attente au moment de ce rapport. Aucune modification Supabase, de schéma ou d’autorité historique n’a été exécutée.

Capture locale hors Git : `C:/Users/Manon/Documents/Codex/2026-09-28/ve/evidence/phase2-month-control-center-2026-10-04/workbench-desktop.jpg`.
