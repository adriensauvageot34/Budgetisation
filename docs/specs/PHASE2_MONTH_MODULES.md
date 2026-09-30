# Phase 2 — responsabilités du mois à venir

Les modules ci-dessous sont des responsabilités de lecture et d'interaction sur `/mois-a-venir`.
Ils partagent le snapshot publié `phase2_month_forecast` et les inputs prospectifs
`phase2_month_inputs`. Aucun module ne possède un moteur financier supplémentaire.
Les mois futurs sans snapshot mensuel sont résolus en lecture depuis les autorités
canoniques courantes par `resolvePlanningMonthForecast`, avec le même moteur.
Cette résolution ne publie ni snapshot, ni révision analytique.

| Module | Responsabilité | Autorité et état actuel |
| --- | --- | --- |
| M0 Synthèse | Reste à répartir, coût prévu et réserve | `deriveMonthScenario` sur le snapshot publié et les inputs du mois |
| M1 Revenus | Sources et montants attendus | `forecast.income.components`, calculés depuis les revenus habituels ; date future inconnue |
| M2 Charges fixes | Obligations mensuelles reconnues, incluses par défaut ; retrait du seul mois visé | Composants `CONTRACTUAL_EXPECTED` du groupe `obligations` ; `excludedFixedObligations` dans les inputs du mois |
| M3 Dépenses possibles | Décision Oui, Non ou Je ne sais pas | Composants `CONDITIONAL_UNKNOWN` ; confirmations datées et `declinedConditionalObligations` dans les inputs du mois |
| M4 Dépenses variables | Enveloppes de consommation habituelle | Composants additifs des catégories de vie ; aucune date individuelle inférée |
| M5 Mobilité | Usage automobile et essence | Composant `mobility-usage` ; détail affiché dans une seule section dédiée |
| M6 Swile | Financement potentiel distinct de la consommation | `forecast.funding` et solde/chargement saisis ; jamais traité comme revenu bancaire |
| M7 Dépenses prévues | Builder progressif, liste et impact supplémentaire par scénario | `phase2_planned_expenses` + service `planned-expenses.ts` + `deriveMonthScenario` ; simulation serveur avant enregistrement |
| M8 Ancienne simulation | Parcours retiré de l'interface | Le formulaire `plannedEvents` et le what-if par URL ne sont plus des voies utilisateur ; les écritures legacy restent désactivées |

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

La contrainte SQL impose également des CostItems valides : 1 à 50 lignes,
identifiants distincts, libellés et montants positifs, et clés de baseline autorisées.
La validation du service intervient avant simulation et enregistrement. Les règles
RLS réservent les lectures et mutations aux membres du foyer ; `created_by` et
`household_id` sont immuables côté client, et `updated_by` doit être l'utilisateur
authentifié. Le cycle prévu → déclaré réalisé → prévu ne touche que cette table.

Le builder collecte d'abord la famille et le sous-type, puis le contexte pertinent et
les lignes de coût. « Habituel » est traduit en clé de baseline dans le brouillon,
jamais présenté comme une clé technique. Sa simulation et la prévision affichée
passent par le même moteur. La liste est relue de la table après chaque mutation.

## Système d'actifs prévu V1

Le catalogue versionné `src/domain/phase2/planned-assets.ts` propose les familles,
sous-types, éléments et modules réutilisables. Une ouverture de Restaurant, Transport,
Beauté, Ménager, Cadeau ou Activité ajoute un niveau de `modulePath` au même brouillon ;
elle ne crée pas une autre dépense prévue. L'élément personnalisé reste disponible
dans chaque module. Ses quantités et prix unitaires sont saisis ou modifiables ; le
total de ligne est calculé et arrondi au centime. Les seules suggestions monétaires
fixes V1 sont les deux éléments explicites du panier « soirée maison ». Mascara et
crayon à sourcils peuvent proposer le dernier achat canonique de la personne,
avec sa date et sans écraser le prix saisi.

Le contexte prospectif distingue participants, personnes qui voyagent, invités non
nommés, personne visitée, lieu, achat, livraison, cadeau et trajet. Les lieux connus
viennent de la couche canonique et sont filtrés selon le contexte. Un lieu ou une
personne sans lien démontré peut être saisi comme texte prospectif, sans créer de
référence canonique. Le repas au travail exige Adrien ou Manon et ne propose que les
lieux rattachés à la personne choisie.

Chaque CostItem alimentaire éligible peut être financé par Banque, Swile, Edenred ou
une répartition exacte. Les autres éléments, dont alcool, parking et Uber, restent
financés par Banque. La projection de financement expose ressources prévues,
réservations, disponible et dépassement à financer autrement. Elle n'altère ni le
coût économique brut, ni la cagnotte réelle. Le remplacement par une enveloppe
habituelle reste calculé une seule fois dans `deriveMonthScenario`.

Le trajet en voiture reste une seule chaîne ordonnée de segments racine. Pour
compatibilité avec C2, elle est encodée par les étapes ordonnées et leur distance
vers l'étape suivante ; `routeSegments()` expose uniquement les paires adjacentes.
Chaque étape peut référencer le lieu principal, le lieu propre d'un complément,
ou un lieu directement choisi. Un complément conserve son lieu indépendamment du
trajet ; son ajout au trajet est explicite. Le retour à la maison est également
explicite. Les doublons physiques strictement identiques et consécutifs sont
fusionnés. Aucun ordre parallèle de segments n'est persisté.

Chaque paire dirigée est résolue depuis l'historique canonique du véhicule, avec
une médiane par méthode de route et une provenance datée. Les litres observés de
la même route servent au coût d'usage. Un sens manquant reste inconnu ; des
kilomètres manuels explicites peuvent le compléter avec la consommation du
véhicule ou sa consommation historique pondérée. Aucun retour symétrisé,
Haversine ou routing externe n'est inventé. Le service revalide les preuves
historiques et le prix carburant avant l'enregistrement. `transport:fuel_usage`
est `ECONOMIC_ONLY` dans le catalogue partagé et ne réserve aucun financement.
Péage et parking restent payables. Aucun MobilityTrip historique n'est créé.

La carte d'impact projette la différence des restes mensuels issus de
`deriveMonthScenario`, en excluant la ligne éditée du scénario avant projet.
Elle distingue coût prévu, quotidien déjà compris, supplément mensuel, paiement
prévu, usage carburant et reste projeté central. Le moteur expose les couches
mensuelles après dépenses certaines, déjà réalisé, encore prévu, vie courante
restante estimée et reste projeté. Un manque Swile/Edenred reste un financement
à compléter ; il n'est jamais ajouté automatiquement aux allocations Banque.

Le contrat JSONB enrichi est validé par le service et par la contrainte de la table
prospective. Les éléments personnalisés restent propres à leur dépense V1. Les
favoris, prix appris automatiquement par lieu, routing automatique, paiements
multi-mois et rapprochement bancaire sont des extensions futures.

## Projection du calendrier

Une date de dépense prévue est affichée seulement lorsqu'elle a été saisie. Le
calendrier projette les charges certaines datées et les Planned Expenses datées depuis
leurs sources respectives. Il montre le coût brut prévu, y compris après marquage
« déclarée réalisée », sans créer de table calendrier. `freshnessDate` signale la fraîcheur des observations,
pas une date de prélèvement à venir. Les revenus et charges fixes sans jour certifié
figurent dans « Date à confirmer ». Les charges fixes restent incluses dans le total
mensuel même sans jour connu. Un retrait les soustrait uniquement du scénario du
mois ; il n'efface ni transaction, ni obligation, ni snapshot publié.

Les charges fixes sont retenues par la règle déjà appliquée au forecast : série
active, détail de récurrence disponible, mode « Échéance fixe », cadence mensuelle
et montant estimable. Les autres séries demeurent conditionnelles ou inconnues.

## Fiabilité Preview / Save et cycle déclaré (C6 / C7)

`resolvePlannedExpenseDraft` constitue la frontière commune de Preview, création,
édition, déclaration et report : parsing et domaine partagé, graph, assets,
invariants financiers, puis références live du foyer. Les distances historiques
et prix carburant sont résolus à nouveau depuis les faits courants. Un trajet
incomplet ou un lieu devenu incompatible échoue sans écriture partielle.
Les autorités calculées envoyées dans le payload client sont refusées.

La création utilise un UUID stable par brouillon et l'unicité de la clé primaire.
Un replay identique relit la même root ; une intention différente avec le même
identifiant est refusée. Les mutations utilisent le `updated_at` relu et un
compare-and-set SQL avec foyer, identifiant, version et statut. Les erreurs
structurées indiquent code, path et cible de réparation ; le brouillon local est
conservé. Les Preview obsolètes ne remplacent pas un brouillon plus récent.

Seuls `PLANNED` et `DECLARED_REALIZED` sont persistés. Une date passée produit
« À confirmer » sans mutation. La confirmation locale préremplit les CostItems
actuels ; leur contenu final et le statut sont enregistrés dans un seul UPDATE
après recalcul du scénario. Correction déclarée et restauration sont dédiées.
À contenu identique, coût, baseline et reste projeté sont conservés ; les
allocations passent de `reserved` à `usedDeclared`, puis inversement au restore.
Ce financement déclaré ne débite aucune authority wallet observée.

Un total corrigé peut actualiser une allocation explicite Banque seule.
Swile/Edenred ou un financement mixte devenu incohérent exige confirmation.
Un détail de plusieurs lignes ne peut pas être remplacé par un total global
pendant la déclaration ; les lignes sont corrigées explicitement.

Le report conserve l'identifiant de la root et revalide la destination. Les
hypothèses de travail existantes sont réutilisées comme estimations explicites,
avec les jours du nouveau mois, selon validation humaine du 30 septembre 2026.
Les ressources Swile/Edenred doivent être déclarées pour chaque mois, y compris
un zéro explicite : celles d'octobre ne sont jamais copiées. Sans ces ressources,
le report ne déplace pas la root ; la page du mois cible permet leur saisie.
La migration `20260929232710_phase2_planned_report_month.sql`, approuvée puis
appliquée, ajoute uniquement le droit UPDATE sur `target_month` sous RLS.

« Ça n'a pas eu lieu » et la suppression d'une déclaration demandent une
confirmation spécifique puis suppriment uniquement la root prospective. Liste,
calendrier, baseline et financement sont reconstruits depuis les lignes restantes.
Aucun statut CANCELLED, amount parallèle, realizedDate, brouillon cloud ou
écriture historique n'est ajouté.
