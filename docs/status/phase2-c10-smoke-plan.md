# C10 — plan des parcours et fixtures temporaires

HEAD de départ : `bed265c2d4f648123054fe4b5e4b2677d61a9498`.
Périmètre : navigateur local `/mois-a-venir`, ordinateur, actions applicatives
existantes, fixtures identifiées par le préfixe `[C10-SMOKE-`.

## Parcours à certifier

| ID | Parcours | Preuve attendue | Navigateur |
| --- | --- | --- | --- |
| SMOKE-01 | Soirée chez nous | Transport absent/interdit, brut et financement, une root et projections synchronisées | NOT_TESTED |
| SMOKE-02 | Fast-food livré | Prestataire requis, pas de Transport utilisateur, aucun frais inventé, baseline conservée | NOT_TESTED |
| SMOKE-03 | Anniversaire Lucas et Restaurant ailleurs | Cadeau proposé sans coût automatique, contact/lieu sourcé, lieu du child, trajet racine, une occurrence | NOT_TESTED |
| SMOKE-04 | Restaurant 60 → 45 repas + 15 alcool | Brut 60 conservé, financement repas/alcool correct, sans double compte | NOT_TESTED |
| SMOKE-05 | Fontès, voiture et carburant | Paires dirigées, provenance, carburant économique seulement, aucune allocation Banque pour cette ligne | NOT_TESTED |
| SMOKE-06 | À emporter → livraison | Trajet explicite suspendu et réversible, réparation requise avant Save | NOT_TESTED |
| SMOKE-07 | Réalisation 25 → 28 | Identité conservée, seul 28 compté, marqueur déclaré, aucune écriture historique | NOT_TESTED |
| SMOKE-08 | Report en novembre | Identité conservée, sortie d'octobre, entrée en novembre, faits du mois relus | NOT_TESTED |
| SMOKE-09 | Ça n'a pas eu lieu | Root supprimée, aucun CANCELLED, financement/baseline libérés, projections synchronisées | NOT_TESTED |
| SMOKE-10 | Correction puis restauration | Identité et coût final conservés, financement réservé/utilisé déclaré cohérent | NOT_TESTED |

## Limite des écritures demandées pour ces preuves

- Créer uniquement des dépenses prospectives synthétiques `[C10-SMOKE-…]` en
  octobre/novembre 2026. Les modifier, déclarer, corriger, restaurer et reporter
  uniquement avec les actions normales de l'application.
- Supprimer uniquement les fixtures de ce run, identifiées par leurs IDs relus.
  Aucune dépense utilisateur préexistante n'est utilisée comme fixture.
- Pour SMOKE-08, si novembre ne possède pas de ressources repas explicites :
  conserver l'état initial des inputs, saisir temporairement Swile/Edenred à zéro
  comme valeurs synthétiques de test, puis rétablir exactement l'état initial
  (y compris l'absence de row, le cas échéant).
- Aucun schéma, historique, transaction bancaire, wallet observé, personne,
  lieu canonique ou snapshot analytique n'est modifié par ces smokes.
- Le test SQL RLS déjà approuvé est distinct : deux foyers/identités synthétiques
  isolés dans une transaction, puis ROLLBACK.

## Checklist d'exécution et de retour

Pour chaque parcours, enregistrer : date, HEAD, IDs de fixtures (preuve privée),
actions effectuées, résultats visibles, reread, refus attendus, statut PASS/FAIL ou
NOT_TESTED et captures utiles. Le rapport public ne contient pas de credentials,
payload bancaire ou identifiant d'un utilisateur réel.

Si le navigateur ou les écritures de fixtures ne sont pas disponibles/validés,
exécuter les preuves serveur isolées, conserver cette checklist pour le retour
manuel, et maintenir `BROWSER_USER_FLOW = NOT_TESTED` ainsi que
`IMPLEMENTATION_CERTIFIED = NO`.
