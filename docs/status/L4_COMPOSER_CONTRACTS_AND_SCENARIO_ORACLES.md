# L4 — Contrats publiés et oracles des cinq parcours

16 octobre 2026, réception C3, base C2 `0fc3d0882a649bf023b80edc83724aec43644d30`. **Spécification de travail, aucun développement L4.**

## 1. Source de vérité et règles communes

La capture A0 [des cinq templates](evidence/pre-l4-audit/l4-contracts-published.json) est comparée intégralement aux presets et au registre actuels par `scripts/record-pre-l4-c3-contracts.mjs`. [Identité et preset Servian](evidence/pre-l4-final/l4-contract-identity.json). Les champs ci-dessous sont ceux réellement publiés, pas une promesse de nouveaux champs.

| Responsabilité | Contrat / propriétaire à réutiliser |
|---|---|
| Présentation et défauts du preset | `composer-presets.ts`; le nom du preset ne prouve aucun fait personnel |
| Champs, slots, cardinalités, actions admises | `context-registry.ts`, publication des capabilities serveur |
| Admission, versions et graphe | `semantic-state.ts`, `context-state`, validateurs des références du foyer; JSON C0 existant |
| Édition partielle | `guided-context-edit`, adaptateurs `night-out-edit`, `short-stay-edit`, Family Visit et Cadeau existants |
| Quantité économique | `component-contract.ts`, `component-quantity.ts`, preuve `component-quantity@v1` pour la conversion explicite par personne |
| Prix, budget, enveloppe et financement | sélection admise, Compiler/Kernel puis Finance V2; aucun calcul économique React |
| Trajet futur et devis | Mobility prospective: intentions, modes, identités et provenance propriétaires |
| Sauvegarde | Draft HTTP existant, CAS/idempotence; aucun Apply ni readWorld causé par une simple sauvegarde |

Identités à conserver: `contextOccurrenceId`, `templateKey`, `selectionId`, `parentContextOccurrenceId` et la sélection CHILD_CONTEXT du socket parent (`slotSelections[slotKey]`, `childContextOccurrenceId`), IDs des décisions et intentions/devis. La version du template est publiée par le registre/manifeste, pas un champ `templateVersion` à ajouter au Context; il n’existe pas non plus de champ Context `parentSlotKey`. Modifier un montant ne crée pas une nouvelle occurrence. Le client doit présenter les capabilities actuelles et envoyer l’identité exacte, pas un libellé comme clé.

Les champs communs publiés sont `label`, `plannedDate`, `fieldSchemaVersion`. Les champs propres sont listés par scénario. Le schéma versionné admet des informations incomplètes: date absente, sélection structurale UNRESOLVED, prix UNKNOWN et équipement non choisi. **Draft SAVED n’exige pas READY.** Un zéro explicite, une absence et UNKNOWN ne sont pas interchangeables.

Les composants utilisent la sélection existante avec `quantity`, `unitBasis` (ITEM/PERSON/SHARED), `cost`, `fundingAllocations` et provenance admise. Le champ `pricing` appartient aux intentions Mobility, pas aux composants ordinaires. `TOTAL_BUDGET` et `TOTAL_UNITS` sont des modes d’éditeur de conversion; ne pas inventer un champ persistant `quantityMode`. Pour PER_PERSON, conserver `quantityEvidenceVersion`, `quantityPerPerson`, `pricedParticipantCount`; le Compiler exploite la quantité totale stockée. Les anciens composants sans cette preuve gardent leur quantité totale, sans multiplication rétroactive. Pour le logement, la sélection peut porter `lodgingPricing={version:"lodging-pricing@v1",basis:"TOTAL"|"PER_NIGHT",nightCount:number|null}`.

Réédition: PATCH des seuls champs modifiés, conservation des autres champs connus ou UNKNOWN et des sockets omis. Une réponse explicitement effacée doit suivre le contrat de clearing existant; ne pas remplacer une omission par `null`. Ne retirer que les réponses incompatibles après décision explicite et validation owner. Une source historique rafraîchie ne remplace jamais un choix accepté. S2 conserve l’exploration hypothétique séparée des choix retenus, avec ses statuts/digests; toute projection passe par le Compiler, toute adoption exige un choix explicite.

Persistance pour **chacun des cinq scénarios**: création → décision partielle admise → SAVED confirmé → reload complet → mêmes IDs/versions/valeurs/provenances → modification d’un champ → autres réponses intactes → Undo/Redo → SAVED/reload. Comparer le digest demandé au digest relu, traiter le CAS par récupération explicite, distinguer ERROR et réponse après commit UNCONFIRMED. Ce sont les gates du futur parcours L4; C3 ne prétend pas les avoir tous réexécutés en JWT.

## 2. Soirée techno à deux

**Publié:** `night-out@v1`, preset `techno-night`. Seul défaut: `label="Soirée techno"`. Versions de champs admises v2/v3. Champs propres: `endDate`, `participantRefs`, `placeRef`, `timingNote`. Ni lieu, ni personnes, ni date, ni prix ne viennent du nom « techno ».

**Capabilities/slots:** `before` optionnel (composant ou enfant activity/friend-visit), `main` requis structurellement (composant ou enfant activity), `food` optionnel (composant ou enfant restaurant/fast-food/delivery), `extras` répétables; `outbound` PRIMARY et `return` RETURN optionnels, modes Mobility publiés CAR/TRAIN/BUS/TAXI/FREE/OTHER/UNKNOWN. Chaque slot garde son identité; une sélection UNRESOLVED est sauvegardable.

**Questions minimales:** entrée ou budget principal si connu; participants seulement si choisis ou nécessaires à une quantité par personne; proposer before/boissons/repas/trajet comme compléments facultatifs. Demander un prix par personne uniquement après ce choix, la quantité de bouteilles uniquement après l’ajout d’un complément partagé. La date et le lieu restent facultatifs. Aucune question voiture si aucun trajet n’est demandé.

**Oracle économique proposé:** entrée2×15=30, boissons individuelles2×5=10, bouteille commune1×20=20, before explicite10, aller12 et retour13 indépendants: connu95, parent0. Ce jeu chiffré est un oracle futur, pas une mesure C3. Une même bouteille n’est pas deux boissons individuelles. Si un devis aller-retour couvre déjà les deux legs, conserver la preuve de parcours partagé et ne pas compter les deux sélections une deuxième fois.

**Réédition/incompatibles:** passer de2 à3 participants ne multiplie pas les éléments SHARED/TOTAL. Recalculer la quantité PERSON seulement par conversion explicite et preuve mise à jour. Remplacer un mode de transport retire le pricing incompatible de cette intention, pas le before ou l’entrée. Date inconnue reste absente; fournisseur indisponible donne UNKNOWN/PARTIAL.

**Limites L4:** UX du before, boissons et résumé guidé à compléter avec les composants existants. Aucun modèle publié de payeur nommé, partage arbitraire entre amis ou contribution commune. Ne recueillir aucune réponse qui disparaîtrait du contrat.

## 3. Week-end en gîte

**Publié:** `short-stay@v2`, preset `weekend-gite`; seul défaut actuel: `label="Week-end / Gîte"` (**pas** `lodgingKind=RENTAL` implicite). Champs v2/v3/v5; propres: `endDate`, `participantRefs`, `destinationRef`, `nightCount`, `lodgingKind` (RELATIVE/HOTEL/HOSTEL/RENTAL/OTHER/LATER), `timingNote`.

**Capabilities/slots:** `lodging` requis structurellement; `groceries` optionnel avec confirmation d’enveloppe; `restaurants` répétable, enfants restaurant/fast-food/delivery ou sélection publiée; `activities` enfants activity; `purchases` enfants purchase/gift/beauty-restock; `extras` répétables; `transport` optionnel Mobility PRIMARY. Compiler/Kernel décide coût et couverture, Food/Forecast fournit les références admissibles.

**Questions:** hébergement total OU mode par nuit, nombre de nuits seulement si nécessaire à ce mode; dates/destination/participants si connus; repas et activités uniquement ajoutés volontairement. Le mode total garde une seule quantité économique, le mode par nuit conserve les nuits et le pricing prévus dans le contrat Séjour existant. Ne pas appliquer les deux.

**Oracle futur:** logement total240 pour2nuits, jacuzzi inclus0 additionnel, Restaurant enfant60, activité30: connu330 et parent0. Changer uniquement le Restaurant conserve le logement, les nuits, le lien parent/enfant et le reste. Le Restaurant enfant est un objet économique unique, pas une copie indépendante sur le Board. Courses couvertes: utiliser le binding explicite, pas une économie alimentaire présumée.

**Incompatibles/inconnus:** changement de mode logement invalide seulement sa représentation de prix incompatible; ne pas effacer les enfants. Sans dates, conserver l’intention souple. Intermois reste différé: conserver l’information admissible et signaler la limite, jamais tronquer un séjour. Prix/transport inconnus ne rendent pas faux les montants connus.

**Limite L4:** aucun champ structuré `jacuzziIncluded` n’est publié. Un libellé/note explicite peut conserver l’information admissible, mais ne prouve ni équipement catalogue ni prestation chiffrée. Ne pas ajouter automatiquement une activité « jacuzzi » payante. Une évolution structurée éventuelle devra être revue et versionnée séparément.

## 4. Visite Fontès / Servian

**Publié:** `family-visit@v2`; presets `fontes-family-visit` et `servian-family-visit`, défauts de libellé seulement. Champs v2/v3/v4; propres: `personVisitedRef`, `participantRefs`, `placeRef`, `timingNote`, `endDate`.

**Capabilities:** `hospitality` composant optionnel; `activities` enfants répétables activity/restaurant/fast-food/delivery/purchase/gift; `transport` optionnel Mobility PRIMARY. L’éditeur Visit et le contrat Mobility existants portent l’aller/retour du trajet, ses legs/partage et devis; ne pas inventer un slot `return` sur Family Visit.

**Questions:** personne visitée et participants sont distincts, facultatifs tant qu’inconnus; lieu existant admissible ou destination au format permis, date facultative; demander le mode puis les informations nécessaires seulement si un déplacement est ajouté. Un ancien trajet ou une voiture connue ne prouve pas cette visite future. Fontès et Servian ne fournissent ni coordonnées ni proche par simple texte.

**Oracle:** trajet aller+retour propriétaire coût usage8 et péages4, contribution hospitality10, connu22; parent0. `estimatedMobilityFuelCost` n’est pas `fuelPaidAmount`: aucune dépense de plein créée. Passage voiture→train: retirer l’ancien coût automobile; billet explicite20 remplace12, connu30; billet inconnu conserve hospitality10 et mobilité UNKNOWN/PARTIAL, pas30 inventé.

Réédition conserve personne/lieu/date/participants et IDs compatibles. Un changement de destination invalide un devis périmé; il ne supprime pas le cadeau enfant. Panne de fournisseur: ne pas bloquer tout le Board, ne pas fabriquer distance/péage/prix. **Aucune économie de Courses automatique du fait d’une visite.**

**Limites L4:** présentation conditionnelle et oracles de changement mode/devis à éprouver avec les services existants. Référence à un contact extérieur au foyer: seulement la représentation déjà admissible, jamais élargir les permissions pour l’éditeur.

## 5. Achat de vêtements en ligne

**Publié:** `purchase@v1`, preset `clothing-shopping`, défauts `label` et `budgetDomain="clothing"`. Champs v2/v3; propres `budgetDomain` (clothing/home-small/games-digital/other), `productLabel`, `merchantLabel`, `placeRef`.

**Capabilities:** `item` requis structurellement, `extras` répétables, `transport` Mobility optionnel. Aucun enfant Context attachable dans ce template. Quantité/unité/prix sont sur les sélections composantes. `merchantLabel` est un texte, pas une identité de vendeur certifiée.

**Questions:** article et budget suffisent pour commencer; quantité/prix unitaire seulement si détail demandé, vendeur/date facultatifs. Choisir explicitement consommation de l’enveloppe ou dépense supplémentaire via le guide de binding admis. Demander des frais seulement s’ils ne sont pas déjà inclus dans le montant total. Une livraison ne crée pas un trajet personnel.

**Oracle:** enveloppe Vêtements100, article40, frais supplémentaires5: si les45 sont explicitement couverts et le contrat les admet, conserver enveloppe100, pas145; s’ils sont EXTRA, coût prévu145; relation non décidée reste UNRESOLVED. L4 doit faire confirmer la portée de couverture des compléments au lieu de la déduire du nom du produit.

Réédition du seul montant conserve produit, vendeur, quantity et binding/IDs. Une bascule total/détail doit remplacer la représentation économique incompatible, pas additionner les deux. Article sans prix reste UNKNOWN; zéro de contrôle mensuel explicite ne permet pas une quantité composant nulle (contrats différents).

**Limites L4:** aucun champ dédié de commande e-commerce, état de livraison, adresse de livraison, tracking ou canal n’est publié. Des frais peuvent être un complément explicite admissible; ne pas promettre un modèle logistique ou stocker des champs dans une note arbitraire pour masquer leur absence.

## 6. Cadeau d’anniversaire

**Publié:** `gift@v2`, preset `gift-present`, seul défaut `label="Cadeau"`. Champs v2/v3; propres `recipientRef`, `occasion`, `objectLabel`, `objectAssetRef`. Classification produit et référence structurée `objectAssetRef` utilisent le catalogue propriétaire P05-B (exemple gift:book); le libellé libre reste indépendant, sans catégorie déduite du texte.

**Capabilities:** `item` requis structurellement (option gift), `extras` répétables. Pas de slot transport ni enfant Context sur Cadeau; il peut lui-même être enfant d’un autre Context admissible. Prix/funding/quantité/provenance sur les composants existants; le Kernel garde l’admissibilité de financement.

**Questions:** destinataire si connu, occasion libre, objet ou produit admissible, budget si connu; date facultative. Une référence de personne n’est utilisable que dans sa portée admise; un texte libre admissible n’invente pas un contact propriétaire.

**Oracle:** objet40, complément emballage5, total connu45, parent0. Modifier seulement40→45 conserve destinataire, occasion, classification, quantité, identité et date absente; nouveau total50. Un prix UNKNOWN laisse les5 connus et une projection partielle, jamais objet0 implicite.

**Contribution commune:** destinataire ≠ payeur ≠ participant. Les allocations de financement admises ne constituent pas un modèle de personnes payeuses. Aucun champ dédié de contribution commune nominative n’existe. Demander seulement le montant à charge dans le mode déjà publié si l’utilisateur le décide explicitement; sinon conserver UNKNOWN et annoncer que la répartition commune structurée exige une évolution L4. Ne pas collecter la liste des contributeurs pour la perdre au reload.

## 7. Réception future et ordre proposé

Pour chaque pilote: capacités serveur exactes; aucune question sans champ/adaptateur de round-trip; défaut de preset ≠ décision; parent0; un seul objet par identité; UNKNOWN conservés; sources et droits inchangés; réponses hors ordre rejetées; RAW/PENDING garde Apply; Draft SAVED indépendant de FRESH/APPLIED. Ne pas modifier un Plan officiel pour certifier l’éditeur.

Ordre recommandé: **Soirée techno pilote**, puis Cadeau/Achat, Visite, Séjour composite. Valider chaque parcours avant le suivant. Les questions doivent se limiter au chemin choisi; la réédition ouvre le résumé des choix existants, sans rejouer un questionnaire d’onboarding. Une duplication future devra créer des IDs neufs et remapper tout le sous-graphe; elle n’est pas livrée ici.

Avant livraison réelle: fermeture/drag natifs et cycle Draft JWT isolé demeurent des gates ciblés; preuves C1/C2/C3 synthétiques ne les remplacent pas. Aucun nouveau moteur de questionnaire, cache, owner ou migration proposé par ce document.

## 8. Contrat UX commun — création, réédition, complément

Préparation PRE-L4 Integration, 16 octobre 2026. Ce contrat guide L4-A; il ne décrit pas une nouvelle fonctionnalité livrée. Les trois situations partagent le même Semantic Draft et les adaptateurs existants.

| Situation | Première surface | Geste et issue attendue |
|---|---|---|
| Création | Carte immédiatement sur le Board et panneau latéral; preset déjà reconnu | Proposer la première décision pertinente, puis des ajouts volontaires. Ne pas redemander le type « techno » déjà fourni; ne pas exiger date/lieu/prix/participants absents si le contrat accepte l’incomplet. Fermer conserve les décisions admises, sans Apply. |
| Réédition | Résumé des réponses réellement persistées, avec inconnues et provenance | « Modifier Boissons » ouvre cette rubrique seulement. La mise à jour conserve les autres champs, IDs, financements, UNKNOWN et liens. Aucun redémarrage automatique de toutes les questions. |
| Complément | Palette contextuelle de la carte sélectionnée | Proposer seulement les routes et actions admises par le serveur. Une option équipée propose sa modification, une alternative annonce un remplacement. « Autres options » garde les choix rares accessibles; ne pas monter les114 équipements au repos. |

**Ordre des questions:** (1) reprendre les choix du Draft; (2) reconnaître les défauts exacts du preset; (3) afficher les références utiles comme références; (4) proposer la décision principale; (5) demander les précisions dont ce choix dépend; (6) laisser ajouter les compléments. Connu ne veut pas dire confirmé: un prix historique reste REFERENCE jusqu’à adoption explicite; une décision existante ne doit pas être écrasée par une référence plus récente.

**Question ou dépense:** choisir une personne, un lieu, une date ou un mode d’affichage ne crée pas de composant chiffré. Ajouter une bouteille, un billet ou des frais peut créer une sélection économique distincte. Avant chaque question métier, identifier le chemin qui survivra au reload. Sans champ/route admissible, ne pas présenter la réponse comme un choix sauvegardable. Une aide de présentation doit annoncer sa portée locale.

### Dépendances et conservation

| Changement | Dépendance à traiter explicitement | Réponses à préserver |
|---|---|---|
| TOTAL → PER_PERSON | Participants nécessaires pour la conversion; preuve de quantité mise à jour seulement après décision. Participants connus avec prix inconnu restent sauvegardables. | Composants SHARED, dates, lieu, before; aucune multiplication automatique du graphe |
| Voiture → train | Remplacer l’union de pricing/route incompatible de l’intention visée; billet UNKNOWN si absent | IDs compatibles de la visite, participants, cadeau/entrée indépendants; aucun coût carburant résiduel |
| Destination/date modifiée | Ne plus considérer un devis incompatible comme actuel; repasser par la validation propriétaire | Réponses indépendantes; pas de remise à zéro globale |
| Logement total → par nuit | Une seule représentation économique `lodgingPricing` et sa quantité; ne pas conserver total+nuits additifs | Restaurants et activités enfants, autres sélections et identités |
| Prix/quantité d’un composant | Rééditer la sélection existante, en conservant sa provenance et son financement compatibles | `selectionId`, `contextOccurrenceId`, autres sockets et champs UNKNOWN |
| Retrait d’un before/enfant | Annoncer l’abandon des réponses dépendantes avant de supprimer ce sous-graphe; respecter les ancres protégées | Tout le graphe indépendant. `before:undefined` conserve; `before:null` retire selon l’adaptateur, ce n’est pas un PATCH neutre |

Aucune dépendance ne justifie d’inventer un montant, une fréquence, une date ou une personne. Annuler un champ RAW l’abandonne; une mutation confirmée entre dans Undo/Redo. Une saisie ou un lot PENDING garde Apply interdit selon C1. **Décision locale, SAVED, FRESH et APPLIED sont quatre faits distincts.** La reprise après erreur/CAS doit dire ce qui est confirmé et proposer la récupération existante, sans écrasement silencieux ni retry aveugle d’Apply.

### Réemploi immédiat, sans moteur nouveau

Les chemins sont relatifs à la racine du dépôt. Chaque helper reste limité à ses templates et champs admis; sa réutilisation ne lui donne pas de nouvelles capabilities.

| Besoin UX | Mécanisme déjà présent et limite |
|---|---|
| Question conditionnelle, réponse connue, édition d’une rubrique | `restaurant-editor.tsx` (L1) et `guided-context-edit.ts`: résumé/sections et PATCH ciblé. `editRestaurant` pour Restaurant; `editGuidedContext` seulement fast-food/delivery/activity/purchase, pas Soirée/Cadeau/Visite/Séjour. Réutiliser les composants de choix/prix du panneau, pas cloner un deuxième état métier. |
| Éditer Soirée/Visite/Séjour/Cadeau | `night-out-editor.tsx`, `family-visit-editor.tsx`, `short-stay-editor.tsx`, `gift-editor.tsx` et leurs mutations/adaptateurs déjà utilisés. Pour Soirée, `editNightOut` préserve les sockets omis; transport emprunte sa route spécialisée existante, pas un champ ajouté à `NightOutEdit.slots`. |
| Complément facultatif | `context-palette.tsx` + `presentation/palette-groups.ts`, `DropTarget` avec Context/socket exacts, assets et routes du modèle publié. La présence d’un libellé ne crée pas une option persistable. |
| Quantité partagée/par personne | `component-contract.ts`, `component-quantity.ts`: SHARED/ITEM/PERSON et preuve de conversion explicite. Le prix/mois/impact reste issu Compiler/Finance V2. |
| Prix, incertitude et référence | Choix de coût/provenance existants, CardKnowledge et présentation par dimension C2. Ne pas copier les droits d’un contrôle mensuel à un composant différent. |
| Conserver champ, identité et graphe | `semantic-state.ts`, `context-registry.ts`, sélections composantes et adaptateurs spécialisés. Un PATCH de socket remplace son tableau: reconstruire à partir des sélections existantes, pas de nouveaux UUID à chaque render. |
| Sauvegarde partielle et reprise | `durable-draft.ts`, `/api/composer/drafts`, service Draft et RPC CAS/idempotents existants. Auteur/foyer dérivés serveur; sans READY permis, sans C0/admission refusé. Le transport ne doit pas être remplacé par un writer PlannedExpense. |
| Retour arrière et éditions rapides | Réducteur/Undo/Redo existants dans `local-draft.ts`, registre inline C1 et lot350ms des contrôles concernés. Ne pas créer un deuxième historique du Semantic Draft dans l’éditeur. |
| Réactivité et recalcul | `preview-scheduler.ts`, modèle déjà chargé et `editor-chunks.ts`. Pas de World par question/vignette, pas de Preview pour panneau/palette. Chargement progressif conservé; Soirée est actuellement dans l’entrée fréquente, les autres chunks suivent la stratégie existante, sans nouveau bundling anticipé. |

`restaurant-editor.tsx`, `context-palette.tsx`, `durable-draft.ts`, `local-draft.ts`, `preview-scheduler.ts`, `editor-chunks.ts` sont sous `src/app/mois-a-venir/composer/`; les helpers de contrat/édition sous `src/domain/phase2/planner/`; le registre sous `src/server/phase2/planner/`.

### Matrice UX des cinq futurs pilotes

| Famille | Déjà persistable et première décision utile | Questions conditionnelles / compléments | Extension future, pas un choix promis |
|---|---|---|---|
| Soirée `night-out@v1` | Label du preset; entrée/budget principal par sélection; participants/lieu/dates si connus | Participants si PER_PERSON; boissons explicites via extras/before admissibles, repas, aller et retour via slots réels | Rubrique visuelle « Boissons » à raccorder aux sélections existantes; pas de champ arbitraire drinks/payeurs. Vestiaire/billet seulement si route publiée correspondante, pas parce que l’exemple UX les cite. |
| Achat `purchase@v1` | Produit, vendeur texte, montant/détail, budgetDomain et binding admis | Quantité si détail; frais supplémentaires seulement non inclus; date/lieu/transport facultatifs | Livraison e-commerce, tracking et vendeur certifié n’ont pas de modèle dédié |
| Cadeau `gift@v2` | Destinataire admissible/texte, occasion, objet/catalogue et budget | Quantité/prix et complément explicites; date facultative | Contribution commune nominative/payeur distinct non modélisés |
| Visite `family-visit@v2` | Personne visitée, participants et lieu si connus; aucun déplacement implicite | Mode puis informations Mobility seulement si trajet ajouté; hospitality/activité volontaires | Pas d’économie alimentaire automatique ni de nouveau slot retour inventé |
| Week-end `short-stay@v2` | Hébergement TOTAL ou PER_NIGHT, destination/dates/participants facultatifs | Nuits si mode requis; restaurants/activités/achats/transport volontaires | Jacuzzi inclus non structuré; intermois différé, aucune troncature |

**Geste simple:** quantité/prix accessibles directement, sans parcours de navigation imposé. **Intention riche:** approfondissement volontaire, résumé compact d’abord à la réouverture. L4-A devra prouver création → sauvegarde partielle → reload → réédition ciblée, sans perdre les champs non modifiés, et les oracles de la section2. Ce contrat ne crée aucun `WizardEngine`, cache, owner ou état financier local.
