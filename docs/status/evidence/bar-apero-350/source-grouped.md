# Bar / Apéro — Regroupement des 350 recommandations par chantier de travail

**Base :** inventaire brut du 18 octobre 2026 (R001 à R350).
**Statut :** classement de travail provisoire — **ni prompt Codex, ni cahier des charges d’implémentation**.
**Règle :** chaque recommandation est reproduite **à l’identique**, une seule fois, sous son identifiant d’origine. Les groupes correspondent à des zones de code et à des gestes de développement cohérents ; l’ordre définitif des travaux et des recommandations reste à décider.

## Vue d’ensemble des chantiers

| Chantier | Type de travail principal | Recommandations |
|---|---|---:|
| A | Pilotage des scènes, ciblage et navigation dans la carte | 20 |
| B | Lieux, recherche Google et identité Canonical | 27 |
| C | Métadonnées Date et Personnes | 22 |
| D | Before et consommations : création, édition et unités | 43 |
| E | Montant global, couverture économique et affichage des coûts | 26 |
| F | Mobilité Aller / Retour : endpoints, modes, véhicules, coûts | 39 |
| G | Dock : moteur de suggestions, hiérarchie et pagination | 34 |
| H | Carte ouverte : disposition compacte, commandes et lisibilité | 31 |
| I | Carte fermée : synthèse riche, sections et miniatures | 25 |
| J | Direction artistique, illustrations et composants visuels | 33 |
| K | Board, géométrie, responsive, scroll et animations | 18 |
| L | Suppression, sauvegarde, états asynchrones et latence | 22 |
| M | Recettes, accessibilité vérifiée et décision de réplication | 10 |

**Couverture : 350/350 · 13 chantiers · 0 doublon · 0 oubli.**

---

## A. Pilotage des scènes, ciblage et navigation dans la carte — 20 recommandations

*Zone de travail indicative : `bar-living-editor.tsx` · état des scènes · mutations déclenchées depuis la carte.*

- **R001** — Faire de la carte Bar / Apéro l'interface principale de consultation et de modification.
- **R012** — Ne pas présenter le lieu, la date et les participants comme des objets économiques.
- **R013** — Supprimer les écrans intermédiaires qui ne servent qu'à rejoindre une commande déjà présente dans la carte.
- **R014** — Ne pas imposer d'ordre obligatoire de composition de la soirée.
- **R015** — Préserver un accès direct à chaque partie de la soirée depuis sa représentation sur la carte.
- **R016** — Garder une page de synthèse générale distincte des scènes d'édition ciblées.
- **R017** — N'afficher sur une scène que le contenu pertinent pour l'action active.
- **R018** — Placer systématiquement la cible éditée dans la première zone visible de la carte.
- **R019** — Garder l'en-tête de la carte stable lors des changements de scène.
- **R020** — Utiliser un retour discret vers la sortie uniquement lorsqu'une sous-page en a besoin.
- **R021** — Ne pas répéter une action « Ma sortie » à la fois dans la carte et dans le dock.
- **R022** — Faire d'un clic dans le vide de la carte une action neutre, sans retour forcé au résumé.
- **R164** — Ne pas imposer « Boissons » comme destination générique de « Plus tard ».
- **R165** — Faire revenir « Plus tard » à un état neutre adapté à la décision ajournée.
- **R166** — Ne pas ouvrir automatiquement Boissons après la sélection d'une date.
- **R167** — Ne pas ouvrir automatiquement Boissons après l'admission d'un montant direct.
- **R168** — Supprimer les choix du dock qui renvoient exactement à la page déjà active.
- **R169** — Conserver la recherche et la pagination transitoires lorsqu'on revient au même travail interrompu.
- **R170** — Réinitialiser une recherche seulement si sa cible a changé ou si l'utilisateur l'efface.
- **R172** — Préserver l'identité de l'objet ciblé quand on passe de la carte au dock puis à la carte.

---

## B. Lieux, recherche Google et identité Canonical — 27 recommandations

*Zone de travail indicative : `bar-place-search.tsx` · `bar-place-knowledge.ts` · raccordement propriétaire des lieux.*

- **R002** — Rendre le lieu directement modifiable en cliquant sur sa capsule dans la carte.
- **R143** — Respecter la recherche textuelle active dans toutes les propositions de lieux.
- **R151** — Ne pas reproduire une recherche de lieu simultanément dans la carte et dans le dock.
- **R171** — Éviter qu'un résultat Google ancien reste sélectionnable après un changement de recherche ou de ville.
- **R192** — Proposer une recherche de bar unifiée exploitant les lieux enregistrés et Google lorsque les capacités le permettent.
- **R193** — S'inspirer des composants de recherche déjà éprouvés dans « Déclarer une dépense ».
- **R194** — Afficher la ville de recherche comme un contexte visible et modifiable, non comme un filtre caché.
- **R195** — Autoriser une recherche plus large sans contrainte de ville.
- **R196** — Ne pas donner à « Chercher ailleurs » une taille et une priorité supérieures aux résultats utiles.
- **R197** — Distinguer « Déjà fréquenté », « Enregistré » et « Google Maps » avec une provenance vérifiable.
- **R198** — Présenter les résultats connus les plus pertinents avant les autres lieux.
- **R199** — Afficher nom, commune et adresse courte pour départager les homonymes.
- **R200** — Rechercher également par adresse lorsque la recherche vise des endpoints.
- **R201** — Normaliser les recherches pertinentes pour les accents et variantes de casse.
- **R202** — Conserver les cafés-bars pertinents même s'ils sont catégorisés café ou restaurant par Google.
- **R203** — Prévoir des résultats ou des replis utiles lorsque la recherche Google échoue ou ne répond pas.
- **R204** — Conserver un retry ciblé après une erreur Google sans effacer le travail en cours.
- **R205** — Quand un résultat Google est sélectionné, présenter une fiche de lieu claire plutôt qu'une simple ligne.
- **R206** — Ne pas afficher en parallèle un second catalogue de recherche pendant qu'une fiche Google est ouverte.
- **R207** — Faire disparaître le formulaire de recherche principal après admission du lieu choisi.
- **R208** — Ne pas présenter « Retenir comme nom libre » comme l'issue normale d'un établissement Google reconnu.
- **R209** — Permettre à un établissement Google nouveau d'acquérir une identité durable exploitable uniquement via le propriétaire officiel autorisé.
- **R210** — Préserver une correspondance Canonical exacte lorsque le googlePlaceId existe déjà.
- **R211** — Ne jamais inventer un lieu KNOWN, une coordonnée admise ou une distance routable.
- **R212** — Indiquer brièvement quand un lieu reste textuel et ne permet pas encore de calculer un trajet.
- **R213** — Permettre de changer de bar sans réécrire automatiquement les endpoints personnalisés des trajets existants.
- **R214** — Proposer l'adaptation des trajets après changement de lieu seulement lorsqu'un lien autorisé est prouvé.

---

## C. Métadonnées Date et Personnes — 22 recommandations

*Zone de travail indicative : calendrier · contacts · capsules de métadonnées · édition ciblée.*

- **R003** — Rendre la date directement modifiable en cliquant sur sa capsule dans la carte.
- **R004** — Rendre les participants directement modifiables en cliquant sur leurs pastilles dans la carte.
- **R011** — Conserver des capsules explicites « + Lieu », « + Date » et « + Personnes » lorsque ces valeurs sont absentes.
- **R173** — Faire apparaître immédiatement le calendrier en cliquant sur la date.
- **R174** — Afficher le calendrier dans le premier tiers visible de la carte.
- **R175** — Dimensionner le calendrier en fonction de la largeur disponible sans l'étirer artificiellement.
- **R176** — Mettre nettement en évidence le jour sélectionné.
- **R177** — Sélectionner une date par un seul clic lorsque sa valeur est admissible.
- **R178** — Afficher la date retenue dans l'en-tête après validation.
- **R179** — Placer « Retirer la date » dans la scène Date et non dans le dock générique.
- **R180** — Gérer les jours hors du mois uniquement lorsque le contrat de planification l'autorise.
- **R181** — Rendre le calendrier navigable au clavier avec un modèle cohérent de navigation par flèches.
- **R182** — Éviter d'imposer 31 appuis sur Tab pour choisir un jour.
- **R183** — Éviter les interactions concurrentes entre les flèches clavier du calendrier, du dock et du Board.
- **R184** — Proposer en premier les participants du foyer ou contacts pertinents réellement connus.
- **R185** — Différencier clairement les participants déjà retenus des contacts simplement suggérés.
- **R186** — Permettre de rechercher les autres contacts sans parcourir un catalogue interminable.
- **R187** — Afficher les participants sélectionnés dans une rangée claire sur leur scène dédiée.
- **R188** — Permettre de retirer un participant depuis sa pastille si l'opération est sans risque particulier.
- **R189** — Conserver la possibilité d'ajouter un prénom libre sans lui attribuer une fausse identité de contact.
- **R190** — Ne jamais ajouter automatiquement un contact parce qu'il accompagne souvent l'utilisateur.
- **R191** — Ne jamais déduire un nombre de consommations ou une répartition financière du seul nombre de participants.

---

## D. Before et consommations : création, édition et unités — 43 recommandations

*Zone de travail indicative : `bar-before.ts` · tuiles de consommation · sous-éditeur de poste.*

- **R007** — Rendre chaque consommation directement modifiable en cliquant sur sa tuile.
- **R008** — Rendre chaque composant du Before directement modifiable en cliquant sur sa tuile.
- **R035** — Afficher une consommation au repos avec son identité, sa quantité, son prix et son unité pertinente.
- **R036** — Afficher les commandes de quantité et de prix seulement lorsque la consommation est sélectionnée.
- **R037** — Afficher les paramètres avancés d'une consommation uniquement sur demande.
- **R038** — Limiter les boutons visibles en permanence sur les tuiles d'édition.
- **R047** — Présenter les contrôles d'une consommation sur une disposition horizontale quand la carte est large.
- **R048** — Placer le stepper de quantité et le champ de prix sur une même ligne quand c'est possible.
- **R049** — Supprimer le grand libellé « Quantité totale » lorsque le stepper est suffisamment intelligible.
- **R050** — Remplacer le libellé surdimensionné « Prix unitaire (€) » par une indication courte proche du prix.
- **R051** — Permettre l'édition du prix directement à son emplacement dans la tuile.
- **R052** — Permettre la modification de quantité par un stepper « − quantité + » immédiatement compréhensible.
- **R053** — Ne pas ouvrir de formulaire séparé pour une simple modification de prix ou de quantité.
- **R071** — Paginer les grands ensembles de consommations et de composants du Before.
- **R215** — Séparer le Before des consommations faites au bar dans le modèle d'édition et dans l'affichage.
- **R216** — Permettre d'ajouter et d'éditer individuellement les composants du Before.
- **R217** — Afficher bouteille, diluant, soft et snacks comme une composition commune lorsque présents.
- **R218** — Proposer un Before vide avec des familles d'objets clairement reconnaissables.
- **R219** — Lorsque Vodka a été retenue, suggérer diluant, soft et snacks avant de réciter le catalogue complet.
- **R220** — Adapter les compléments proposés au contenu réellement présent du Before.
- **R221** — Conserver un accès explicite au catalogue complet du Before sur demande.
- **R222** — Ne pas créer automatiquement une quantité, un prix ou un achat lorsqu'on suggère un complément.
- **R223** — Ne pas attribuer automatiquement la base SHARED à n'importe quel premier composant du Before sans contrat légitime.
- **R224** — Clarifier la portée ITEM ou SHARED d'un premier snack ou d'une première bière du Before.
- **R225** — Ne pas multiplier une bouteille partagée par le nombre de personnes présentes.
- **R226** — Garder les identités du Before et de ses composants stables à travers modification, suppression et réouverture.
- **R227** — Déplacer « Compléter le Before » vers un petit « + Ajouter » dans la bonne section.
- **R228** — Déplacer « Retirer le Before » dans son menu de contexte.
- **R229** — Protéger les saisies RAW avant de retirer un Before enrichi.
- **R230** — Rendre les consommations Bière, Cocktail, Shot, Vin, Soft et Bouteille immédiatement identifiables.
- **R231** — Afficher la quantité à côté du nom de consommation.
- **R232** — Afficher le prix et son unité selon le sens économique réel : verre, bouteille, lot, personne ou unité.
- **R233** — Différencier le prix unitaire du montant total retenu.
- **R234** — Éviter qu'un prix total officiel soit remplacé visuellement par un prix unitaire trompeur.
- **R235** — Distinguer une nouvelle Bière de l'augmentation de la Bière existante.
- **R236** — Ne pas fusionner deux lignes portant le même nom si leurs identités ou leurs prix diffèrent.
- **R237** — Lorsqu'une consommation est en édition RAW, alléger les propositions concurrentes du dock.
- **R238** — Préserver la valeur RAW exacte en cas de changement de scène demandé.
- **R239** — Ne pas perdre une saisie lors d'un clic sur une autre tuile ou un autre contrôle.
- **R240** — Faire apparaître les réglages d'un poste dans un menu compact : nom, unité, financement, retrait.
- **R241** — Conserver une édition avancée pour les cas PERSON, SHARED, financements et relations complexes.
- **R242** — Éviter que l'éditeur historique avancé réintroduise du scroll interne ou une interface contradictoire.
- **R243** — Conserver une option « + Ajouter » dans Au bar pour les nouveaux objets économiques.

---

## E. Montant global, couverture économique et affichage des coûts — 26 recommandations

*Zone de travail indicative : Composer / Finance V2 · montant direct · Compiler et résumés de prix.*

- **R005** — Rendre le montant affiché directement modifiable en cliquant dessus lorsqu'il représente une estimation globale éditable.
- **R244** — Faire du montant affiché dans l'en-tête l'entrée de modification de l'estimation globale.
- **R245** — Permettre de saisir une estimation globale des consommations sans ouvrir un sous-asset « Montant direct ».
- **R246** — Permettre de remplacer explicitement cette estimation globale par des consommations détaillées.
- **R247** — Faire cesser la contribution du montant global couvert dès que son remplacement par le détail est accepté.
- **R248** — Ne jamais additionner silencieusement une estimation regroupée aux consommations qui la remplacent.
- **R249** — Ne jamais afficher un faux total de 0 € lorsqu'un montant global vient d'être remplacé par des postes sans prix.
- **R250** — Conserver les nouveaux prix manquants en UNKNOWN et non en MANUAL 0.
- **R251** — Préserver les autres coûts indépendants, notamment les transports, lors du passage global → détaillé.
- **R252** — Rendre le passage global → détaillé atomique, réversible et couvert par Undo.
- **R253** — Permettre le passage inverse du détail à une estimation globale uniquement avec un remplacement explicite des détails concernés.
- **R254** — Ne pas rendre le montant calculé à partir des détails éditable comme une ligne indépendante supplémentaire.
- **R255** — Distinguer l'estimation regroupée des contributions ou entrées additives.
- **R256** — Rendre le choix « Ajouter en plus » explicite lorsqu'il crée une dépense indépendante.
- **R257** — Rendre le choix « Détailler à la place » explicite sur les postes réellement remplacés.
- **R258** — Montrer l'impact économique admissible avant une confirmation de couverture.
- **R259** — Préserver les identités et les décisions RAW non incluses dans l'opération de remplacement.
- **R260** — Ne jamais faire de calcul financier parallèle en React à la place de Finance V2.
- **R261** — Fonder le montant affiché sur le Compiler ou ses résumés officiels.
- **R262** — Présenter séparément les montants connus et les inconnues non additives.
- **R263** — Distinguer MANUAL, QUOTE, UNKNOWN et estimation officielle lorsque cela modifie la confiance affichée.
- **R264** — Distinguer clairement coût d'usage voiture et paiement réellement engagé.
- **R265** — Ne pas dissimuler les composantes péage, parking, fare ou transport cash lorsqu'elles existent dans les résumés officiels.
- **R266** — Afficher les montants et unités avec un format monétaire homogène.
- **R267** — Classer les coûts directs, repas, consommations et contributions dans des rubriques économiques fidèles.
- **R268** — Ne pas appliquer de multiplication financière sur le simple nombre de personnes présentes.

---

## F. Mobilité Aller / Retour : endpoints, modes, véhicules, coûts — 39 recommandations

*Zone de travail indicative : `bar-living-operations.ts` · éditeur de trajets · `BarRouteLine`.*

- **R006** — Rendre chaque trajet directement modifiable en cliquant sur sa ligne ou sur ses informations.
- **R142** — Ne pas afficher une destination d'Aller comme premier choix d'origine du même Aller.
- **R269** — Afficher des parcours Aller et Retour sous forme de deux modules compacts directement manipulables.
- **R270** — Afficher les deux endpoints du trajet comme éléments visuels principaux.
- **R271** — Permettre de modifier l'origine en touchant directement le point de départ.
- **R272** — Permettre de modifier la destination en touchant directement le point d'arrivée.
- **R273** — Permettre de modifier mode ou véhicule depuis leur capsule dans la ligne de trajet.
- **R274** — Permettre de préciser ou consulter le coût en touchant le montant du trajet.
- **R275** — Placer le coût connu ou « À estimer » à droite de la ligne de trajet lorsque la largeur le permet.
- **R276** — Réduire le nom principal du véhicule à « Peugeot 207 » et placer sa version technique dans les détails.
- **R277** — Déplacer « Retirer ce trajet », financements et relations détaillées dans un menu ⋯ de trajet.
- **R278** — Permettre d'inverser volontairement les endpoints d'un trajet quand le contrat l'autorise.
- **R279** — Distinguer visuellement Aller et Retour tout en gardant une grammaire graphique commune.
- **R280** — Après sélection d'un mode, mettre en tête le prochain endpoint réellement manquant.
- **R281** — Après sélection d'une origine, proposer la destination manquante si elle l'est réellement.
- **R282** — Après sélection des endpoints, proposer le véhicule nécessaire ou l'estimation légitime.
- **R283** — Mettre Maison en première suggestion d'origine Aller lorsqu'elle est connue, pertinente et admissible.
- **R284** — Ne jamais sélectionner Maison automatiquement comme origine sans choix explicite.
- **R285** — Ne pas préfixer le bar de destination dans les propositions ordinaires d'origine Aller.
- **R286** — Adapter la liste des endpoints à la direction et au rôle exact du point recherché.
- **R287** — Écarter ou déprioriser un candidat identique à l'autre endpoint sauf trajet volontaire particulier.
- **R288** — Ne pas afficher indistinctement aéroports, magasins et arrêts de tram avant les origines pertinentes.
- **R289** — Conserver les autres lieux accessibles par une recherche dédiée plutôt que par 28 pages du dock.
- **R290** — Garder un raccourci « Depuis Maison » même lorsqu'un véhicule unique n'est pas disponible, sans choisir le véhicule à la place de l'utilisateur.
- **R291** — Proposer explicitement une reprise du trajet inverse après un Aller connu.
- **R292** — Distinguer « Reprendre le trajet inverse », « Même mode qu'à l'aller » et « Autre retour ».
- **R293** — Ne pas copier automatiquement le coût de l'Aller sur le Retour.
- **R294** — Ne pas fusionner les identités, prix ou financements d'Aller et Retour.
- **R295** — Permettre un retour en taxi après un aller en voiture sans rendre les deux modes dépendants.
- **R296** — Afficher les données réellement manquantes à un trajet plutôt qu'un simple « À estimer » générique.
- **R297** — Ne pas créer l'impression qu'un trajet est calculable lorsque son lieu n'est que TEXT.
- **R298** — Distinguer un tarif de taxi ou train d'une estimation d'usage voiture.
- **R299** — Éviter la formulation redondante « Coût d'usage estimé · à estimer ».
- **R300** — Ne pas offrir « Prix du billet ou de la course » comme commande principale d'une voiture personnelle ordinaire.
- **R301** — Corriger « N arrêts » pour ne pas compter les endpoints comme des étapes intermédiaires.
- **R302** — Conserver les contrôles avancés pour arrêts intermédiaires, financements et relations externes légitimes.
- **R303** — Conserver les coûts et identités du sens non modifié lors d'une édition Aller ou Retour.
- **R304** — Conserver une clarification explicite quand changer endpoint, mode ou véhicule invalide un prix déjà admis.
- **R305** — Ne jamais transformer une suggestion de trajet en choix automatiquement retenu.

---

## G. Dock : moteur de suggestions, hiérarchie et pagination — 34 recommandations

*Zone de travail indicative : `context-palette.tsx` · questions proposées par l’éditeur · classement et recherche.*

- **R009** — Retirer du dock d'accueil les sous-assets de navigation redondants « Lieu », « Date », « Personnes » et « Montant direct ».
- **R010** — Conserver l'affichage des lieux et personnes pertinents dans le dock après un clic sur leur champ de la carte.
- **R057** — Ne jamais introduire de scroll vertical interne dans le dock.
- **R058** — Ne jamais introduire de scroll horizontal continu dans le dock.
- **R059** — Remplacer les listes trop longues par des pages ou une recherche réelle, sans masquer de fonctionnalité.
- **R132** — Faire du dock une palette de choix contextuels, et non un inventaire de toutes les fonctions disponibles.
- **R133** — Sélectionner les propositions du dock selon la décision active, les valeurs connues et les champs manquants.
- **R134** — Distinguer les états du dock « choisir », « compléter » et « suggérer la suite ».
- **R135** — Proposer d'abord les décisions utiles plutôt que répéter les réponses déjà données.
- **R136** — Ne pas réafficher immédiatement les modes de transport après le choix d'un mode si un endpoint manque.
- **R137** — Réserver la modification d'une décision déjà retenue à une action secondaire claire.
- **R138** — Afficher seulement quatre à six propositions prioritaires avant un éventuel accès aux autres choix.
- **R139** — Laisser les options secondaires accessibles par une vraie recherche ou « Autres ».
- **R140** — Éviter les catalogues de dizaines de pages comme chemin principal de sélection.
- **R141** — Garantir un ordre de suggestion stable, compréhensible et dépendant du rôle de la cible.
- **R144** — Exploiter les raisons de suggestion prouvées, sans inventer de fréquentation ni de préférence.
- **R145** — Rendre visible la raison déterminante d'une suggestion quand elle aide réellement au choix.
- **R146** — Ne pas réserver les informations essentielles de provenance aux seules infobulles de survol.
- **R147** — Distinguer graphiquement une valeur proposée d'une valeur réellement retenue.
- **R148** — Différencier les actions de création d'objet et les actions de navigation entre sections.
- **R149** — Ne pas mélanger établissements proposés, recherche, nom libre et « Plus tard » dans une même liste indifférenciée.
- **R150** — Séparer les choix principaux des options de repli par leur hiérarchie visuelle.
- **R152** — Ne pas répéter dans le dock une commande « Ma sortie » déjà présente dans la carte.
- **R153** — Réduire ou masquer le dock lorsqu'il n'a aucune proposition réellement utile.
- **R154** — Ne pas inventer de raccourcis pour occuper artificiellement un dock vide.
- **R155** — Adapter le titre du dock à la question exacte en cours, sans le confondre avec le titre de la scène.
- **R156** — Limiter les textes des propositions à un ou deux niveaux typographiques lisibles.
- **R157** — Conserver les choix sélectionnés clairement identifiables dans le dock.
- **R158** — Paginer les options du dock par cartes entières, sans découpe de vignette à droite.
- **R159** — Afficher un indicateur de page simple et des flèches de navigation effectives.
- **R160** — Conserver une largeur stable des propositions pendant les changements de page.
- **R161** — Conserver la bonne page ou la réinitialiser selon l'identité réelle de la question, pas seulement selon son titre.
- **R162** — Préserver le focus clavier lors d'un changement de page du dock.
- **R163** — Afficher la nouvelle réponse dans la carte immédiatement après son admission, sans confirmation de confort.

---

## H. Carte ouverte : disposition compacte, commandes et lisibilité — 31 recommandations

*Zone de travail indicative : composants de la carte ouverte · CSS Bar · mise en page des éditions.*

- **R023** — Réduire les textes d'instruction permanents au strict nécessaire.
- **R024** — Ne jamais présenter une limitation technique sous forme de phrase de contrat interne.
- **R025** — Employer des verbes et noms compréhensibles plutôt que « main », « socket », « composant principal » ou « contrat ».
- **R026** — Réserver les textes explicatifs longs aux situations ambiguës ou risquées.
- **R027** — Conserver une aide accessible à la demande pour les notions réellement complexes.
- **R028** — Déplacer les réglages rares dans un menu contextuel discret.
- **R029** — Conserver les actions destructives dans un menu secondaire, sans les promouvoir au rang d'action principale.
- **R030** — Préserver la possibilité de tout réaliser au clavier et au tactile malgré la réduction des boutons.
- **R031** — Maintenir des zones de clic suffisamment grandes pour chaque commande compacte.
- **R032** — Maintenir des noms accessibles explicites pour les commandes réduites à des icônes.
- **R033** — Garder des intitulés visibles lorsqu'une icône seule serait ambiguë.
- **R034** — Simplifier la hiérarchie visuelle autour de trois niveaux : voir, modifier, options avancées.
- **R039** — Réduire la hauteur totale de la carte en édition simple en exploitant davantage la largeur disponible.
- **R040** — Viser une édition simple proportionnée au contenu plutôt qu'une grande carte quasi vide.
- **R041** — Réunir illustration, titre et montant sur une ligne d'en-tête compacte quand la largeur le permet.
- **R042** — Réduire l'espace vertical entre l'en-tête et les capsules de métadonnées.
- **R043** — Placer Lieu, Date, Personnes et l'action d'ajout de déplacement sur une même bande horizontale à grande largeur.
- **R044** — Placer « + Déplacement » à droite des métadonnées quand la composition le permet.
- **R045** — Placer le titre de section à gauche et « + Ajouter » à droite sur la même ligne.
- **R046** — Supprimer les lignes réservées uniquement à un petit bouton d'action.
- **R054** — Utiliser une sous-page dédiée pour une édition avancée qui ne tient pas dans la tuile.
- **R061** — Adapter la hauteur de la carte ouverte à la scène réellement active.
- **R063** — Ne pas réserver une hauteur fixe excessive pour une seule consommation ou un petit calendrier.
- **R066** — Ne pas empiler synthèse, catalogue et édition complète sur une même page.
- **R067** — Permettre des présentations distinctes pour carte fermée étroite et carte ouverte large.
- **R068** — Éviter d'étirer une tuile unique sur toute la largeur quand une carte plus courte serait préférable.
- **R069** — Utiliser des tuiles équilibrées sur la largeur pour deux consommations.
- **R070** — Adapter le nombre de colonnes de consommation à la largeur effective et au nombre d'objets.
- **R072** — Garder la tuile active plus expressive tout en laissant les autres composants compacts.
- **R073** — Réduire les espaces blancs qui n'assurent aucune respiration utile.
- **R074** — Ne pas compenser les surfaces vides par des textes ou des objets fictifs.

---

## I. Carte fermée : synthèse riche, sections et miniatures — 25 recommandations

*Zone de travail indicative : `bar-living-card.tsx` · `bar-living-details.tsx` · résumé compact.*

- **R062** — Adapter la hauteur de la carte fermée à la quantité réelle d'informations.
- **R108** — Faire de la carte fermée une synthèse illustrative de la soirée plutôt qu'une miniature du formulaire.
- **R109** — Faire ressortir clairement le lieu sélectionné dans la carte fermée.
- **R110** — Afficher les participants en pastilles lisibles avec initiales ou portraits autorisés.
- **R111** — Limiter les participants affichés en compact à quelques pastilles puis « +N ».
- **R112** — Afficher la date retenue dans un format court, stable et lisible.
- **R113** — Garder le montant officiel parmi les éléments visuellement dominants de la carte fermée.
- **R114** — Afficher distinctement les coûts connus et les parties encore à préciser.
- **R115** — Ne jamais présenter un montant partiel comme un total exhaustif.
- **R116** — Masquer les rubriques réellement vides dans la carte fermée.
- **R117** — Afficher une invitation à composer uniquement lorsque la carte est réellement vide.
- **R118** — Faire apparaître les moments « Avant de sortir » et « Au bar » comme deux zones distinctes lorsqu'ils existent.
- **R119** — Conserver la distinction Avant de sortir / Au bar lors du passage ouvert → fermé.
- **R120** — Classer les repas, entrées, contributions et autres coûts directs dans leurs rubriques exactes, pas sous « Au bar » par défaut.
- **R121** — Afficher deux ou trois miniatures pertinentes par moment puis « +N » pour le contenu masqué.
- **R122** — Afficher la quantité directement sur les miniatures quand elle est utile à la compréhension.
- **R123** — Permettre de rouvrir un composant précis depuis sa miniature compacte.
- **R124** — Faire ouvrir directement le groupe Before par sa miniature, sans détour par un menu générique.
- **R125** — Afficher Aller et Retour sous forme de lignes compactes indépendantes en mode fermé.
- **R126** — Placer Aller et Retour sur une seule ligne quand la largeur suffit, sans mélanger leurs coûts.
- **R127** — Rendre les tuiles compactes plus denses et supprimer les espaces morts sous les objets.
- **R128** — Conserver une représentation cohérente du même objet entre vue ouverte et vue fermée.
- **R129** — Afficher les modes de transport et les coûts inconnus dans une synthèse honnête, sans inventer de tarif.
- **R130** — Réduire les microtextes permanents dans la carte fermée.
- **R131** — Construire une composition visuelle propre pour les états vide, partiel et riche.

---

## J. Direction artistique, illustrations et composants visuels — 33 recommandations

*Zone de travail indicative : assets visuels · iconographie · tokens de styles · finitions graphiques.*

- **R075** — Ne pas augmenter la hauteur de la carte uniquement pour ajouter une décoration.
- **R076** — Mieux aligner les marges, espacements et largeurs des éléments sur une échelle commune.
- **R077** — Limiter les différences arbitraires de rayon de bordure.
- **R078** — Réduire le nombre de bordures et de boutons pointillés.
- **R079** — Réserver les contours pointillés aux emplacements vides ou actions dont ce traitement a un sens.
- **R080** — Utiliser un état actif subtil et homogène sur les tuiles sélectionnées.
- **R081** — Éviter les effets de survol qui agrandissent les tuiles ou déplacent leurs voisines.
- **R082** — Prévoir des transitions internes brèves sans déplacement du contenu hors écran.
- **R083** — Conserver une hiérarchie typographique stable entre titre, montant, contexte et détails.
- **R084** — Renforcer le contraste des petits textes gris et beiges.
- **R085** — Limiter le nombre de variantes de tailles de texte dans les cartes.
- **R086** — Conserver une palette cohérente ivoire, blanc, beige chaleureux et violet d'interaction.
- **R087** — Éviter que toutes les cartes du Board répètent de grands textes « À définir » ou « Occurrences à définir » au détriment de leur identité visuelle.
- **R088** — Créer une illustration éditoriale stable et spécifique à la famille Bar / Apéro.
- **R089** — Éviter d'utiliser systématiquement une simple chope de bière comme illustration de toute sortie Bar / Apéro.
- **R090** — Ne pas utiliser de photographie riche en plein fond derrière les textes du Board.
- **R091** — Placer l'illustration d'ambiance dans une zone dédiée, éventuellement sur un côté de la carte.
- **R092** — Associer à cette illustration un fond tonal ou graphique très discret.
- **R093** — Ne pas rendre la carte entière sous forme d'image : garder de vrais composants interactifs.
- **R094** — Conserver une illustration d'ambiance indépendante des consommations particulières ajoutées.
- **R095** — Ne pas regénérer une illustration principale à chaque ajout ou modification d'asset.
- **R096** — Faire évoluer la place occupée par l'illustration selon que la carte est vide, partielle ou riche.
- **R097** — Accorder davantage d'espace à l'illustration lorsque la carte est vide.
- **R098** — Réduire progressivement la présence de l'illustration quand les informations réelles occupent la carte.
- **R099** — Donner la priorité visuelle aux objets et montants réels dans une carte riche.
- **R100** — Afficher de vraies miniatures des consommations et composants du Before dans la carte fermée.
- **R101** — Harmoniser le style, les dimensions et le cadrage des miniatures entre bibliothèque, dock et carte.
- **R102** — Utiliser un fallback iconographique cohérent lorsqu'un asset ne possède pas d'image dédiée.
- **R103** — Éviter les symboles génériques comme « ✦ » ou les images minuscules pour représenter une bouteille identifiable.
- **R104** — Utiliser des icônes distinctes et cohérentes pour bière, vodka, cocktail, shot, vin, soft, tapas et snacks.
- **R105** — Ne pas dépendre des emojis natifs comme iconographie finale principale.
- **R106** — Ne pas employer la même illustration générique pour tous les lieux proposés.
- **R107** — Distinguer visuellement les modes voiture, tram, bus, taxi et marche.

---

## K. Board, géométrie, responsive, scroll et animations — 18 recommandations

*Zone de travail indicative : `board-carousel.tsx` · `inventory-layout.ts` · dimensions et mesure du DOM.*

- **R055** — Ne jamais ajouter de défilement vertical interne pour faire tenir davantage de contrôles.
- **R056** — Ne jamais introduire de scroll horizontal interne dans la carte.
- **R060** — Ne jamais masquer une action indispensable uniquement par `overflow:hidden`.
- **R064** — Conserver une hauteur maximale compatible avec le viewport et le Board.
- **R065** — Conserver l'édition ciblée dans la carte sans pousser les éléments actifs sous la ligne de flottaison.
- **R316** — Empêcher les cartes voisines de recouvrir un formulaire actif pendant les animations du Board.
- **R317** — Empêcher les cartes voisines de recouvrir Bar / Apéro après stabilisation du Board.
- **R318** — Réserver à la carte ouverte une surface correspondant à sa hauteur réellement utile.
- **R319** — Éviter les grandes réservations vides du Board après changement de scène.
- **R320** — Stabiliser l'emplacement des cartes voisines pendant les éditions rapides.
- **R321** — Contrôler les superpositions et la priorité de clic au cours de chaque transition.
- **R322** — Éviter les animations spatiales qui font traverser une carte active par une autre carte.
- **R323** — Mieux relier visuellement le dock à la carte qu'il modifie, malgré la pagination du Board.
- **R324** — Préserver un ancrage spatial stable lorsque l'utilisateur change de scène interne.
- **R325** — Limiter les recalculs de hauteur et les repackings aux variations réellement utiles, après mesure.
- **R326** — Instrumenter les MutationObserver et ResizeObserver pendant une saisie rapide.
- **R327** — Éviter les mesures de scroll inutiles dans le dock paginé si elles n'apportent aucune information.
- **R329** — Mesurer les déplacements et collisions des cartes à différentes étapes de leurs animations.

---

## L. Suppression, sauvegarde, états asynchrones et latence — 22 recommandations

*Zone de travail indicative : `composer-shell.tsx` · Preview · `durable-draft.ts` · feedback et reprise.*

- **R306** — Retirer la grande bande « Retirer ce moment » de la carte fermée.
- **R307** — Garder le drag-and-drop vers la corbeille comme geste visuel de retrait des cartes.
- **R308** — Afficher la corbeille uniquement durant le déplacement d'un objet admissible.
- **R309** — Maintenir un retrait accessible via ⋯ pour les usages sans drag-and-drop.
- **R310** — Distinguer clairement replier une carte et supprimer une carte.
- **R311** — Faire réagir l'interface immédiatement au lancement d'une suppression.
- **R312** — Afficher un état transitoire de retrait sans annoncer sa réussite durable avant confirmation.
- **R313** — Conserver Undo après retrait, sans confirmation générique lorsque l'opération est réversible et sûre.
- **R314** — Mesurer séparément le temps clic→feedback, l'opération serveur, la Preview et la sauvegarde durable.
- **R315** — Vérifier la latence de retrait d'une carte riche avec les mêmes données avant et après correction.
- **R328** — Mesurer la latence frappe→affichage lors de l'édition d'un prix.
- **R330** — Séparer clairement « choix retenu localement », « simulation actualisée » et « brouillon sauvegardé ».
- **R331** — Ne pas afficher « Sauvegardé » avant la confirmation effective de persistance.
- **R332** — Rendre accessible une reprise ciblée lorsqu'une sauvegarde Draft échoue.
- **R333** — Conserver les données et saisies locales après refus ou timeout de sauvegarde.
- **R334** — Ne pas réessayer une opération ambiguë au risque de la dupliquer.
- **R335** — Identifier la cause de l'échec de sauvegarde riche indépendamment des timeouts Canonical de Preview.
- **R336** — Valider une soirée riche avec Before, boissons, date, participants et trajets en session authentifiée.
- **R337** — Relire la même soirée après rechargement avec ses identités, quantités, prix et liens inchangés.
- **R338** — Vérifier la cohérence entre Draft, Preview, Finance V2 et application finale sans confondre ces statuts.
- **R339** — Conserver les gardes RAW, les confirmations de perte et la protection des relations externes.
- **R340** — Conserver le comportement idempotent et ciblé des mutations de composants et trajets.

---

## M. Recettes, accessibilité vérifiée et décision de réplication — 10 recommandations

*Zone de travail indicative : tests unitaires, React, navigateur, authentifiés et fournisseurs réels.*

- **R341** — Vérifier l'absence de scroll interne sur toutes les sous-scènes, y compris les pages avancées héritées.
- **R342** — Tester les états vide, partiel et riche à plusieurs largeurs desktop et au zoom 125 %.
- **R343** — Tester l'accessibilité clavier et la restauration du focus à chaque transition de scène.
- **R344** — Tester la pagination des choix au redimensionnement sans page fantôme ni focus perdu.
- **R345** — Vérifier la recherche Google et sa reprise dans un environnement fournisseur réellement autorisé.
- **R346** — Vérifier la recherche du même établissement depuis Composer et « Déclarer une dépense ».
- **R347** — Vérifier la séparation et la non-duplication des dépenses entre montant global, consommations et déplacements.
- **R348** — Valider un parcours complet Bar → Lieu → Date → Personnes → Before → Consommations → Aller → Retour → Enregistrer → Relire.
- **R349** — Ne pas répliquer l'interface Bar / Apéro aux autres assets avant validation du parcours complet et de la géométrie.
- **R350** — Ne pas lancer une refonte générale de Finance V2, de Mobility ou des performances pour corriger des défauts localisés.

---

## Contrôle de conservation

- 350 recommandations sources conservées à l’identique.
- Chaque identifiant R001–R350 apparaît exactement une fois dans les chantiers.
- Le regroupement n’efface pas les dépendances entre les chantiers ; celles-ci seront traitées lors de l’ordonnancement final.
- Aucune correction du code ni recette navigateur réalisée ici.
