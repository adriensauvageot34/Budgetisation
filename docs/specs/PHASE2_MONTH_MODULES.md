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
| M7 Événements | Projets confirmés et leur impact supplémentaire | `plannedEvents` et `deriveMonthScenario`, avec remplacement d'une part déjà couverte |
| M8 Simulation | Hypothèse temporaire d'achat | `WhatIfPurchase` en lecture seule ; devient M7 après confirmation |

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
