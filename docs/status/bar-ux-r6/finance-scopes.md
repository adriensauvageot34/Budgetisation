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

After : NightOutEdit n'admet que main/food/extras/outbound/return et un Before owner activity. Aucun slot/writer/reader After publié. **DEFERRED_BY_EXPLICIT_USER_DECISION_R6** : report accepté pendant cette mission, pas un PASS After. Aucun bouton factice ni migration. Une extension future resterait propriétaire/versionnée avec parser, writer, lecteur, Compiler, protections, Undo/CAS/round-trip.

## Résultats exécutés

Preview A : deux Bières8+9=17 par projection serveur ; effacement du seul second prix →8+?, Undo→17. Before12+17=29. Remplacement explicitement accepté du scope des deux Bières par60→72 ; retour au détail2×8→28, Before12 conservé. Annulation conserve l'état. RAW12, protégé lors du changement vers Date ; Continuer retrouve12,. Repli/réouverture retrouve le moment et les décisions. 30lignes gardent leurs IDs et restent accessibles8pages ; réédition dernière→même page.

Groupes13 PASS : identités/unités/scopes distincts, égaux/différents/mixte/UNKNOWN/0, SHARED, Before25, retrait/restauration. Finance198/198 goldens inchangés. P1=25,P2=23,P4=15,Apply/CAS8,DraftHTTP5,scheduler5 : fixtures/mocks, pas E2E Supabase. Projection périmée jamais présentée comme actuelle.

Aucun Apply réel, PlanRevision, nouveau readWorld, writer financier, migration ni mutation de source réelle. Transport de recette mémoire sans writer distant ; cela ne constitue pas un audit exhaustif des écritures concurrentes du projet.
