# R6 — portée économique avant implémentation

Base : aef5c03a7eaa2d5696231a9c08168700ae71bfdf, PR69. Production READY confirmée. Branche dédiée depuis origin/main ; reçu documentaire R5 local fa94ccd préservé sur sa branche. Aucun changement de schéma ou source réelle autorisé par ce lot.

| Portée existante | Représentation | Projection / transition autorisée |
|---|---|---|
| Entrée / contribution indépendante | COMPONENT main, economicScope ADDITIVE_CONTRIBUTION | Additive ; ne couvre pas Before, repas, trajets ni autres consommations |
| Consommations regroupées | COMPONENT main ou extras, AGGREGATED_SUBSTITUTIVE_ESTIMATE + coveredSelectionIds | Coût déclaré pour ce scope, jamais « total soirée ». L'ajout d'un détail demande remplacer ce regroupement ou ajouter en plus |
| Consommations détaillées | COMPONENT extras, selectionId propre, productAssetRef, ITEM/PERSON/SHARED | Compiler calcule chaque montant ; remplacement explicite via substituteNightOutCoverage, funding existant protégé |
| Retour au montant direct | saveQuick : sélection explicite des extras couverts | Confirmation avant retrait des seuls IDs choisis ; Before, food, jambes, contribution indépendante non couverts conservés. Undo restaure les décisions |
| Before | CHILD_CONTEXT before → activity main + extras | Parent sans prix supplémentaire ; identités et protections du child conservées |
| Aller / Retour | MOBILITY_INTENT outbound / return | Deux propriétaires distincts ; coût d'usage ≠ carburant payé, zéro x2 implicite |

Le label/nom n'est jamais une preuve de couverture. Legacy sans portée certaine ou financement incompatible : blocage explicite du remplacement, aucune disparition silencieuse. UNKNOWN ≠ zéro. Le total d'en-tête reste nightOutSummaries, construit à partir des évaluations Compiler.

Regroupement prévu : projection d'identité produit/unité/portée compatible, séparée par contexte et slot. Aucun changement de selections. Le serveur pourra additionner uniquement les economicAmount publiés par le Compiler dans son lecteur de présentation existant ; aucune multiplication ni somme financière React. Si projection absente/périmée, affichage partiel/inconnu plutôt qu'un faux total.

After : NightOutEdit n'admet que main/food/extras/outbound/return et un Before owner activity. Aucun slot/writer/reader After publié. **BLOCKED_OWNER_AFTER**. Extension minimale à arbitrer : slot enfant After distinct, identité parent/enfant, parser versionné rétrocompatible, EDIT_NIGHT_OUT, Compiler et présentation, retrait sous protection, Undo/CAS/round-trip. Aucun bouton After actif ni migration dans cette mission.

Les bascules actuelles seront exercées par tests ciblés (60 substitutif → détail + Before indépendant ; retour direct avec sélection, annulation et Undo). Pas de certification Auth durable par une fixture.
