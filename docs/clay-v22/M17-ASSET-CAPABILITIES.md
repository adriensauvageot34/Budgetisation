# M17 — Briques situées et admission

Cette cartographie relie le Master V22 aux composants présents au départ M16. Elle ne publie aucune nouvelle permission. La projection de découverte ne contient que les noms, familles, identités visuelles et règles de contexte neutres ; les neuf colonnes privées ne sont pas une matrice de writers.

Les 15 briques du Master : B01 Calendrier ; B02 Rythme/renouvellement ; B03 Lieux ; B04 Enseignes/prestataires ; B05 Personnes ; B06 Équipements ; B07 Trajets ; B08 Achats/livraison ; B09 Réservations ; B10 Besoins/réapprovisionnement ; B11 Prix/dépenses ; B12 Budget/financement ; B13 Épargne/flux ; B14 Moments/composition ; B15 Décisions.

| Asset | Natif actuellement réutilisé | Facultatif, sous capacités publiées | Hors sujet pour cette scène | Pertinent conceptuellement mais absent / non admis | Owner et composants |
| --- | --- | --- | --- | --- | --- |
| Courses mensuelles | B11/B12/B15 : montant/cible selon `card.capability` | B02 seulement si le contrôle publié possède cette dimension ; catalogue de références de produits | Before, séance, réservation de nuit | B10 stock/dernier achat/cycles personnels ; ajout d’un produit au contrôle mensuel : aucun writer de panier attesté | Baseline / contrôle existant ; `ComposerCard`, `InlineControlValue`, `control-input`. Le catalogue ne modifie pas cette enveloppe. |
| Cinéma | B01/B03/B05/B11/B15 : éditeur `activity`, choix billet dans `main` | B07/B09 et compléments `extras`, seulement avec sockets, options et DROP confirmés | B10 réapprovisionnement ; Before | Horaire, réservation effective, achat réel de billet ; carte locale sans sockets : sélection en attente, référence consultable | Planner `activity` / `EDIT_PRESET_CONTEXT` ; `RestaurantEditor`, `guided-context-edit`, `cinemaSuggestions`. Aucun writer de billetterie créé. |
| Bar / Apéro | B03/B05/B11/B14/B15 : Before/Au bar, consommations, quantités et couvertures | B01/B04/B07/B12 selon contrat Bar | Réapprovisionnement et hébergement universels | Systèmes de stock et nouveaux flux non certifiés | Planner `night-out` / contrat Bar existant ; `BarLivingEditor`, `BarComponentGroup`, `ContextPalette`. Les commandes du catalogue délèguent aux choix déjà affichés du Bar. |
| Restaurant | B01/B03/B05/B11/B15 : addition et détails inclus | B04/B07/B12 ; compléments distincts si admis | Before ; renouvellement de produits | Nouvelle réservation/paiement réel ; transfert automatique du contrat D1 Bar | Planner `restaurant` / `EDIT_RESTAURANT` ; `RestaurantEditor`, `restaurant-included-details`. Les détails inclus ne deviennent pas des prix additionnels. |
| Achat / Amazon | B01/B04/B08/B11/B15 : article, vendeur, frais séparés | B03/B06/B12 selon template et options publiées | Before et séance | Panier H6 universel, paiement, commande externe automatique | Planner `purchase` ; `RestaurantEditor`, `ClothingItemEditor`, `PurchaseDelivery`. Changer de vendeur ne crée pas une commande. |
| Week-end / séjour | B01/B03/B05/B11/B14/B15 : période, hébergement et nuits | B07/B08/B09/B12 et activités/frais réellement admis | Before universel ; renouvellement des produits | Nouvelle réservation externe ou second coût pour un hébergement déjà couvert | Planner `short-stay` / `EDIT_SHORT_STAY` ; `ShortStayEditor`, sockets de séjour. |
| Cadeau | B05/B08/B11/B15 : cadeau et destinataire sous contrat | B01/B03/B04/B12 si autorisé | Before, stocks et séance systématiques | Partage/flux B13 non certifiés ; cadeau générique ≠ paiement | Planner `gift` / `EDIT_GIFT` ; `GiftEditor` et références produit existantes. |
| Beauté / réassort | B11/B15 : produits déjà admis, dont édition Mascara | B01/B04/B08 selon modèle exact | Avant-soirée et nuit d’hôtel | B02/B10 : aucune fréquence déclarée n’est une dernière acquisition ; identité personnelle non raccordée | Planner `beauty-restock`, `mascara-edit`, `CatalogContextEditor` ; capacités publiées uniquement. |

B06/B09/B13 restent des compétences conditionnelles : une illustration d’équipement, de réservation ou de financement ne les active pas. B13 n’est pas ajouté aux scènes de produits. La recherche de Taxi ou d’une scène de voiture ne crée aucun trajet ; Mobility reste l’autorité.

## Découverte et classement

Un seul catalogue média existant est étendu (`collection.json@2`). La Library, les cartes et ContextPalette ouvrent la même découverte. Un seul comparateur ordinal est partagé avec le Dock Cinéma : recherche explicite, cœur du contexte, pertinence de contexte, état choisi, complément métier explicite, ID stable. Les choix initiaux sont gelés à l’ouverture du catalogue ; aucune modification de prix ou quantité ne réordonne la liste. Le Dock Bar conserve son rail et ses commandes existantes.

Les actions sont résolues après contrôle de l’occurrence, de la protection, des sockets, des options publiées et de `publishedDrop`. Une sélection existante conduit à sa référence exacte ou à son éditeur ; les homonymes ne fusionnent pas. Les autres concepts restent consultables avec leur raison, sans faux bouton Ajouter. Pop-corn est un visuel complémentaire M10 et une règle Cinéma distincte de l’Excel.

## Causes M16 traitées

- Builder : `MonthStory` ne monte pas `PlannedExpensesControl` sans plan économique ; le contexte de navigation peut donc recevoir CREATE sans consommateur. `MonthSectionNav` propose alors « Explorer les intentions » vers Composer au lieu d’un bouton sans effet. La condition financière n’est pas levée.
- Cinéma : `local-draft.ts` crée une nouvelle carte optimiste avec `sockets: []`. L’éditeur ne peut confirmer l’admission d’un billet à ce stade. M17 conserve le verrou, affiche le billet Clay et rend la consultation accessible. La relecture serveur reste nécessaire pour éditer.
- Mobile : bibliothèque courte au-dessus du Board, Board horizontal conservé, palette et recherche adaptatives, catalogue en plein écran et fiche progressive.
- Persistance : aucun flag, nouveau stockage, contrat Save/Apply ou writer modifié. Une sélection en mémoire reste une sélection en mémoire.
