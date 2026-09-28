# Phase 2 — responsabilités du mois à venir

Les modules ci-dessous sont des responsabilités de lecture et d'interaction sur `/mois-a-venir`.
Ils partagent le snapshot publié `phase2_month_forecast` et les inputs prospectifs
`phase2_month_inputs`. Aucun module ne possède un moteur financier supplémentaire.

| Module | Responsabilité | Autorité et état actuel |
| --- | --- | --- |
| M0 Synthèse | Reste à répartir, coût prévu et réserve | `deriveMonthScenario` sur le snapshot publié et les inputs du mois |
| M1 Revenus | Sources et montants attendus | `forecast.income.components`, calculés depuis les revenus habituels ; date future inconnue |
| M2 Charges fixes | Obligations mensuelles reconnues, incluses par défaut ; retrait du seul mois visé | Composants `CONTRACTUAL_EXPECTED` du groupe `obligations` ; `excludedFixedObligations` dans les inputs du mois |
| M3 Dépenses possibles | Décision Oui, Non ou Je ne sais pas | Composants `CONDITIONAL_UNKNOWN` ; confirmations datées et `declinedConditionalObligations` dans les inputs du mois |
| M4 Dépenses variables | Enveloppes de consommation habituelle | Composants additifs des catégories de vie ; aucune date individuelle inférée |
| M5 Mobilité | Usage automobile et essence | Composant `mobility-usage` ; détail affiché dans une seule section dédiée |
| M6 Swile | Financement potentiel distinct de la consommation | `forecast.funding` et solde/chargement saisis ; jamais traité comme revenu bancaire |
| M7 Dépenses prévues | Déclarations prospectives et impact supplémentaire par scénario | Fondation `phase2_planned_expenses` + service `planned-expenses.ts` + `deriveMonthScenario` ; liste et formulaire unifiés réservés au lot UI suivant |
| M8 Ancienne simulation | Parcours UI transitoire en attente du builder unifié | `WhatIfPurchase` reste affiché, mais ne sert pas de moteur Planned Expenses ; les écritures `plannedEvents` sont désactivées |

## Fondation Planned Expenses V1

`phase2_planned_expenses` est la seule source active des nouvelles dépenses prévues.
Chaque ligne appartient à un foyer et à un mois, contient 1 à 50 CostItems JSONB et un
contexte facultatif. Le coût brut est la somme des CostItems, jamais une colonne
indépendante. `PLANNED` et `DECLARED_REALIZED` changent la présentation, pas le coût
total. `plannedEvents` reste toléré uniquement comme tableau vide à la lecture des
anciens réglages mensuels ; toute nouvelle écriture legacy est refusée.

Le même `deriveMonthScenario` calcule les dépenses enregistrées et un brouillon simulé.
Les lignes liées à `groceries`, `household-restaurants`, `adrien-work-meals` ou
`manon-work-meals` sont agrégées par enveloppe avant remplacement dans chaque
scénario. Le reste est entièrement additionnel. Le service n'écrit que dans la table
prospective ; aucune opération historique, publication ou révision analytique ne
doit être créée.

## Projection du calendrier

Une date est affichée seulement lorsqu'elle a été saisie pour un événement ou une
dépense possible confirmée. `freshnessDate` signale la fraîcheur des observations,
pas une date de prélèvement à venir. Les revenus et charges fixes sans jour certifié
figurent dans « Date à confirmer ». Les charges fixes restent incluses dans le total
mensuel même sans jour connu. Un retrait les soustrait uniquement du scénario du
mois ; il n'efface ni transaction, ni obligation, ni snapshot publié.

Les charges fixes sont retenues par la règle déjà appliquée au forecast : série
active, détail de récurrence disponible, mode « Échéance fixe », cadence mensuelle
et montant estimable. Les autres séries demeurent conditionnelles ou inconnues.
