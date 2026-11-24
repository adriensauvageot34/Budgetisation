# Patterns de reconstruction des cartes Composer

Référence de travail pour juillet, août, septembre et octobre 2026. Le document indique comment proposer les cartes et les vérifier avant toute modification. Les règles du foyer restent modifiables. Les hypothèses nouvelles nécessitent une validation avant d’être étendues aux autres mois.

## 1. Lire le mois avant de reconstruire les cartes

| Mois | Ce que Composer peut exploiter | Travail à faire lors de la reprise |
| --- | --- | --- |
| **Juillet 2026** | Banque, calendrier et localisations complets dans Supabase. Mois pilote consultable à la date simulée du **15 juillet**. | À cette date, utiliser uniquement les preuves disponibles à la date d’observation pour les cartes passées. Les événements futurs restent prévus. Utiliser le relevé complet comme jeu de comparaison séparé pour vérifier les rattachements après coup. |
| **Août 2026** | Période présente dans Supabase avec couverture inconnue lors du contrôle du 24 novembre 2026. | Recontrôler la couverture au moment de la reprise. Les prévisions et les intentions du foyer peuvent alimenter le brouillon. |
| **Septembre et octobre 2026** | Aucune opération bancaire de ces deux mois lors du même contrôle. | Préparer les cartes prévues. Attendre le relevé et, si possible, les événements et localisations avant la reconstruction du Réalisé. |

La date d’achat sert à associer une activité ou un lieu. La date bancaire sert à rattacher le mouvement aux totaux du mois. Une dépense effectuée fin juillet et débitée en août peut être liée à l’événement de juillet tout en restant dans le total bancaire d’août. En simulation, un débit connu seulement après le jour d’observation ne passe pas au statut « débité » avant cette date.

### Ce que montrent les données

- Les dates bancaires couvrent 1 660 opérations, dont 1 285 avec un jour d’achat exact. La date de débit seule donne un indice trop faible pour regrouper un repas ou un café avec une journée précise.
- Parmi les cafés au travail datés au jour exact, 96 journées sur 129 ont plusieurs débits. Le regroupement quotidien répond à un cas courant.
- Le calendrier compte 148 repas observés ou déduits jusqu’à juillet, dont 76 avec un événement parent. Le parent est un signal à examiner avant l’heure ou le nom du commerce. Un repas hors journée de travail a parfois lui aussi un parent.
- Les 19 achats Grand Frais retrouvés via le marchand n’ont pas de succursale résolue dans la vue canonique des lieux. La règle par magasin dépend donc d’un alias précis, d’un rapprochement de lieu solide ou d’une correction manuelle.
- Sur 110 occurrences de courses avec participation renseignée, 47 indiquent Adrien, 49 Manon et 14 les deux. La distinction entre la personne qui fait les courses et le bénéficiaire du panier est donc importante.
- Jusqu’à juillet 2026, le calendrier indique Adrien pour les 93 événements de repas à Boulangerie Ange et les 9 à Marie Blachère Castelnau. Les 23 événements à Marie Blachère Montpellier Sud indiquent Manon. Ces nombres décrivent des événements et incluent des repas dont le paiement reste à rapprocher.
- Les 3 spectacles et les 4 séjours observés indiquent le Couple. Pour les sorties du soir, les deux participations sont renseignées dans 9 cas sur 18. Les effectifs sont trop faibles pour déduire la participation à partir du lieu seul.
- La base contient 684 tronçons de mobilité certifiés avec une distance et un coût carburant estimé. Pour 31 tronçons, au moins une extrémité n’a pas d’identifiant de lieu canonique. Le libellé de source peut aider à la lecture, avec une résolution à confirmer lorsque le point reste ambigu.

## 2. Ordre de décision et vocabulaire

1. **Validation manuelle explicite.** Respecter les corrections de la carte, une exclusion, un trajet choisi, un statut ou une attribution corrigée. Si deux corrections incompatibles existent, remonter le conflit.
2. **Preuve canonique.** Utiliser le bénéficiaire économique attribué, les participants validés, le lien d’opération ou de composant, le lieu résolu, le contrat, et les trajets de source certifiée selon la question posée.
3. **Règle du foyer.** Appliquer une règle datée et ciblée lorsque ses conditions sont réunies, par exemple un magasin précis ou un type de contrat. Conserver la justification de l’attribution.
4. **Hypothèse cohérente.** Proposer un regroupement ou une attribution seulement si les indices convergent. Afficher « probable » et garder une correction possible.
5. **Information manquante.** Afficher « à préciser ». Laisser le montant, la succursale, le participant ou le trajet inconnus selon le champ concerné.

Distinguer **qui a payé**, **à qui profite la dépense**, **qui était présent**, **qui conduisait** et **qui reçoit l’argent**. Le badge Couple peut désigner une dépense commune. Il ne prouve pas la présence des deux personnes au moment de l’achat. La présence commune se vérifie sur une fenêtre compatible et un lieu pertinent. Deux localisations dans la même commune à des heures incompatibles restent insuffisantes.

Pour les activités habituellement communes, afficher **Couple par défaut**, même si l’une des deux localisations manque. Changer l’attribution lorsqu’une preuve contraire est claire, par exemple si Manon est à Fontès et Adrien est localisé à Montpellier pendant la visite. Utiliser ce défaut comme décision d’affichage. La participation observée garde son propre niveau de preuve.

## 3. Patrons confirmés par le foyer

Ces règles expriment des préférences et des habitudes déclarées. Une preuve canonique ou une correction explicite garde la priorité.

### Personnes, marchands et dépenses

| Pattern | Application par défaut | Exception ou preuve attendue |
| --- | --- | --- |
| **Charges fixes communes** | Couple pour les contrats du foyer, par exemple logement, EDF, SFR, Google One ou assurance commune. | Lire le contrat, la série et le sous-type. Les abonnements personnels et l’assurance automobile passent avant le défaut Couple. Pacifica automobile suit la règle voiture. |
| **Voiture avant le permis d’Adrien** | Attribuer à Manon, jusqu’au **20 novembre 2026 inclus**, l’usage et les frais propres à la voiture du foyer, dont carburant, réparations, entretien, pneus et assurance automobile. FIA Littoral et Henri Dumas Auto suivent ce défaut si l’achat est automobile. | À partir du **21 novembre**, utiliser la personne ou la voiture documentée. Le conducteur peut rester inconnu. Une dépense de voyage peut avoir Manon comme conductrice et Couple comme participants. |
| **Grand Frais côté bureau d’Adrien** | Adrien pour la succursale identifiée de Castelnau-le-Lez, côté Rives du Lez. | « Grand Frais » seul laisse la succursale inconnue. La branche connue est vérifiable publiquement. [Grand Frais Castelnau-le-Lez](https://www.grandfrais.com/magasins/castelnau-le-lez) |
| **Grand Frais côté travail de Manon** | Manon pour la succursale de Montpellier, avenue Étienne-Méhul. | Conserver l’attribution si le lieu est établi et le contexte compatible. Sans succursale, des courses du foyer peuvent rester Couple avec le lieu à préciser. [Grand Frais Montpellier](https://www.grandfrais.com/magasins/montpellier) |
| **Petites courses de proximité et grosses courses** | Le panier alimentaire du foyer bénéficie au Couple. Proposer Adrien pour la personne qui fait un petit dépannage de proximité et Manon pour les grosses courses. Les achats de dates différentes restent distincts hors du tri par catégorie. | La taille du panier, la succursale et la présence priment sur un seuil de prix. Une branche, un reçu ou un événement peut préciser la personne ou montrer que l’achat appartient à un séjour. |
| **Tabac et vape** | Tabac courant pour le foyer en Couple. Vape, dont Cercle de la Vap, pour Manon. | Séparer les articles si un reçu ou une ventilation distingue les usages. Le nom du tabac seul ne décrit pas le contenu du panier. |
| **Cosmétiques, épilation et produits reconnaissables** | Manon pour Sephora, les produits d’épilation identifiés et ses références récurrentes, dont le mascara Benefit BADgal BANG! et le crayon sourcils Sephora Chocolate Brown. Adrien pour sa cire coiffante habituelle. | Le produit identifié permet de retrouver le bénéficiaire quand le marchand change. Pour Amazon, utiliser le produit ou la sous-catégorie. Un achat Amazon sans détail reste sans usage précis. |
| **Coiffure d’Adrien** | Dali Barber et coiffure en espèces documentée pour Adrien. **20 €** est le tarif habituel déclaré, utilisable comme estimation pour une future carte. | En Réalisé, utiliser le paiement ou l’usage d’espèces établi. Un retrait du même montant sans autre indice reste un retrait. |
| **Permis de conduire** | Ornikar et Ornikar / Alma pour Adrien lorsqu’il s’agit du permis. | Un paiement Alma seul ne suffit pas. Ornikar Assurances garde sa nature propre. Une leçon sans dépense reste dans le calendrier. |
| **Salaires** | Promotrans → Manon. Digital Learning Contest → Adrien. | Exiger un flux de salaire ou un revenu déjà classé comme professionnel. Un remboursement de frais ou un virement interne garde son propre flux. |
| **Titres-restaurant** | Swile → Adrien. Edenred → Manon, lorsque l’émetteur est identifié. | Distinguer repas, financement et chargement. Un libellé « Carte Ticket Restaurant » seul n’identifie aucun restaurant. |
| **Abonnements personnels** | Disney+ et Max pour Manon. Qobuz, OpenAI et les alertes SMS personnelles pour Adrien. | Limiter la règle au service identifié. Un achat mêlé ou un autre contrat doit être qualifié séparément. |
| **Google AI Pro et ChatGPT** | Usage Adrien pour les services identifiés. Google One du foyer reste Couple. | Le libellé « Google » seul ne permet pas de déterminer le service. |
| **Netflix** | Manon comme utilisatrice habituelle. Une soirée Netflix peut concerner le Couple. | Établir le payeur séparément quand il est utile de l’afficher. |
| **Projet photo, studio ou musique** | Adrien quand l’achat est identifié comme lié à son projet, par exemple réflecteurs, fond studio, séance photo ou casque audio. | Un achat Amazon ou un casque sans contexte reste à qualifier. |
| **Projet Suno pour son père** | Manon porte le projet de chanson et son père en est le destinataire. Deux achats sont rattachés dans « Mon perso ». | Identifier séparément les autres achats Suno ou Google Play. |
| **Bricolage, équipement commun et espace personnel** | Couple pour les achats destinés au logement et aux équipements communs, dont cuisine, salon et électroménager. Attribuer Adrien ou Manon si l’espace ou l’équipement est personnel et identifié. Un accessoire de studio photo revient à Adrien. | Distinguer le bénéficiaire de la personne qui se déplace. Les trois passages documentés à Castorama Lattes indiquent Adrien. Cela reste un indice de présence. |
| **Consommable, remplacement ou accessoire** | Reprendre le bénéficiaire de l’objet identifié. La cartouche d’une imprimante commune va au Couple, la batterie d’un appareil photo personnel d’Adrien va à Adrien. | Si l’objet auquel se rattache l’achat reste inconnu, garder le bénéficiaire à préciser. |
| **Prêt d’argent ou avance à un proche** | Fonds du Couple, car l’argent est commun. Le proche est bénéficiaire et la personne qui effectue le paiement peut être renseignée séparément. | Relier un remboursement au mouvement d’origine quand le lien est établi. Conserver la nature financière du prêt ou de l’avance. |
| **Attributions ponctuelles issues de juillet** | Exemples réutilisables si le contexte est identique. Croc au Bain pour Manon, Delacrem et Le Petit Nice pour Adrien, Chicken Place et La Pétrisane pour le couple. | Garder ces repères en suggestion hors du cas validé. Le même marchand peut être fréquenté par l’autre personne. Une décision fiscale, de santé ou liée à un usage privé reste attachée au dossier validé, avec accès restreint. |

### Travail, repas et visites

| Pattern | Application | Exception ou preuve attendue |
| --- | --- | --- |
| **Cafés au travail** | Une carte par **personne, jour d’achat et journée de travail**. Grouper les cafés répétés par marchand avec le nombre et le sous-total. Garder chaque opération visible dans le détail. Ajouter le repas de midi de la même personne s’il est lié. | Requiert le jour exact et un contexte travail. En cas de conflit sur la personne, de jour incertain ou de contexte différent, laisser le débit à rapprocher. |
| **Travail d’Adrien** | Afficher « Travail sur site Adrien » au lieu OBS si le site est celui du jour. Le télétravail s’affiche « Maison » avec les frais rattachés au travail lorsqu’ils existent. | Une journée sans dépense et sans paiement associé reste au calendrier. Le repas ou l’achat à domicile doit avoir un lien au travail avant d’être rattaché. |
| **Travail de Manon** | Afficher « Manon travail » avec le lieu Promotrans si le site est établi. Regrouper le repas ou l’achat de midi et son prix si connu. | Le foyer signale Manon sur site. Toute exception doit venir d’une observation ou d’une correction. |
| **Restaurant hors travail** | Couple par défaut pour une sortie restaurant de loisir. Pour un déjeuner individuel, privilégier un événement parent de travail ou la concordance personne, lieu, journée et horaire. | La fenêtre actuelle de **11 h 30 à 14 h 30** est un signal de travail. Week-end, congé, télétravail, participant explicite ou sortie en groupe peuvent le contredire. |
| **Boulangeries associées au travail** | À midi sur site, proposer Adrien pour Boulangerie Ange et Marie Blachère Castelnau, et Manon pour Marie Blachère Montpellier Sud. | Vérifier la succursale et la journée de travail. Une visite le soir ou dans un contexte de loisir suit la règle du restaurant hors travail. |
| **Dépense près du travail après la journée** | À partir de la fin effective du travail, généralement vers **17 h ou 18 h**, évaluer le contexte de la sortie. Si c’est une sortie commune, proposer Couple même près d’un bureau. | L’heure de fin documentée prime sur l’heure habituelle. Le lieu seul laisse le contexte à préciser. |
| **Servian et Fontès** | Proposer Manon pour une visite à sa famille à Servian ou Fontès. Utiliser Couple lorsque la présence d’Adrien est établie en plus de celle de Manon. Conserver Adrien seul si la visite le concerne et que Manon est localisée ailleurs. | Sur 16 visites au lieu familial à Servian, 4 indiquent Manon, 9 le Couple et 3 Adrien seul parmi les deux profils. Une présence dans la même commune doit être recoupée avec le lieu et le moment de la visite. |
| **Visites chez des amis** | Proposer Manon chez Amandine, ou Couple si Adrien participe aussi. Sur 9 visites, 7 indiquent Manon et 2 Couple. | Les visites chez Cédric se répartissent entre Adrien, Manon et les deux. Laisser le participant à confirmer si la visite reste sans indice. |
| **Pharmacie et accompagnement** | Les cinq passages relevés à la pharmacie Richter suggèrent Adrien comme personne qui se rend sur place. À l’hôpital, distinguer visiteur et personne visitée. | La pharmacie Pedro de Luna est fréquentée par les deux selon la visite. Identifier séparément le bénéficiaire d’un achat ou d’un soin quand il est connu. |
| **Affaire familiale gérée à deux** | Distinguer l’organisateur, la personne aidée et les participants. Si Manon organise une démarche pour son père et qu’Adrien l’accompagne, afficher Couple pour la présence et le père comme bénéficiaire. | Appliquer l’attribution selon les personnes documentées pour la démarche concernée. |
| **Déplacements professionnels** | Manon lorsqu’un déplacement est associé à son activité. Ajouter les dépenses de transport, péage ou repas liées, et les tronçons effectivement reconnus. | Pour Lyon / Saint-Priest à cheval sur mars et avril, le déplacement garde sa continuité et les paiements restent au mois de leur débit. Le rôle « professionnel » seul ne détermine ni la personne ni le mode de transport. |

### Soirées, événements et séjours

| Pattern | Application | Exception ou preuve attendue |
| --- | --- | --- |
| **Soirée à la maison** | Couple par défaut pour un before ou une soirée complète à la maison. Ajouter les amis présents lorsqu’ils sont renseignés. | Une soirée explicitement organisée par un seul avec ses amis peut être individuelle si l’autre est ailleurs ou a une activité distincte. |
| **Commande Uber Eats** | Couple par défaut pour une commande de livraison. | Cas rare où l’un est absent du domicile pour le week-end et où la commande correspond au repas de la personne restée sur place. Uber Eats désigne la livraison de repas. |
| **Événement, spectacle, sortie ou célébration** | Couple par défaut pour ces activités généralement communes, avec les amis présents lorsqu’ils sont connus. Le jeu vidéo et les soirées techno sont des centres d’intérêt partagés. | Une localisation clairement différente, par exemple Manon à Paris pendant la sortie d’Adrien à Montpellier, oriente vers une participation individuelle. Le lieu ou l’enseigne seuls ne suffisent pas à qualifier un achat de jeu, de matériel ou une entrée en club. |
| **Hôtel, location ou réservation de séjour** | Couple par défaut pour une réservation de loisir du foyer. | Utiliser l’attribution connue pour un déplacement individuel ou professionnel, ou si les localisations sont clairement incompatibles avec un séjour ensemble. |
| **Cadeau et occasion** | Reprendre le destinataire lorsqu’il est documenté. Renseigner séparément l’organisateur et le payeur. Un cadeau destiné à un proche de Manon peut être offert par le Couple. | Une surprise pour Manon lui donne le rôle de destinataire. La date ou le montant d’un achat Amazon seuls laissent le destinataire et le motif inconnus. |

### Mobilité et cartes visibles

| Pattern | Application | Exception ou preuve attendue |
| --- | --- | --- |
| **Trajet local** | Pour une activité à Montpellier ou desservie dans la métropole, proposer tram/bus à **0 €** si compatible avec l’itinéraire et le Pass gratuité du foyer. La marche reste plausible sur une courte distance. | Le mode reste suggéré en l’absence de preuve. Un trajet voiture, un parking, un taxi ou un billet confirmé passe avant le défaut local. [Pass gratuité de Montpellier](https://www.montpellier.fr/vie-quotidienne/vivre-ici/se-deplacer/je-me-deplace-en-transports-en-commun/se-deplacer-gratuitement) |
| **Courses d’Adrien en semaine** | Pour les mois du périmètre, Adrien se déplace en tram en semaine. Proposer **tram à 0 €** quand il fait les courses seul en semaine. | Suivre le mode documenté s’il est différent. La bascule du permis du 20 novembre 2026 est hors du périmètre juillet–octobre. |
| **Déplacements pendant la pause de midi** | Manon se déplace en voiture par défaut. Adrien marche par défaut. Si Adrien est emmené en voiture par des amis, attribuer **0 € de dépense de trajet au foyer**, sauf frais réellement établis. | Utiliser un autre mode lorsqu’il est confirmé. Pour Manon en voiture, estimer l’essence seulement avec une distance ou un trajet exploitable. |
| **Sortie directement après le travail** | Proposer **travail → sortie**, puis **sortie → domicile** si le retour est établi. Adrien peut partir d’OBS et Manon du domicile pour la même sortie. | Utiliser le lieu réellement quitté lorsqu’il est connu. Le retour peut avoir une autre destination ou passer par un autre mode. |
| **Courses sur le chemin du retour** | Pour un trajet en voiture, attribuer uniquement le détour à la carte Courses. Si le trajet direct fait 8 km et le trajet via le magasin fait 10 km, le détour représente 2 km. | Le reste du trajet conserve sa propre attribution. Pour les courses d’Adrien seul en tram, appliquer le coût de **0 €**. Un détour reste à estimer si la route directe manque. |
| **Plusieurs arrêts avec une voiture** | Enchaîner les tronçons, par exemple **Montpellier → courses → Servian → Fontès**. Chaque tronçon est compté une fois et peut être référencé par la carte concernée. | Attribuer un éventuel détour selon la règle Courses. Le total des tronçons et des détours attribués doit correspondre au trajet complet. |
| **Allers séparés et retour ensemble** | Garder les allers de chacun et un seul retour partagé lorsqu’il est établi. Exemple possible avec Adrien en tram, Manon en voiture, puis retour ensemble. | Déterminer le mode et les participants de chaque sens séparément. |
| **Voiture unique du foyer** | Le foyer possède **un seul véhicule**. Si vous êtes deux à bord, compter un trajet, une distance et un coût d’essence. Identifier le conducteur et le passager s’ils sont connus. | Si un second trajet en voiture est confirmé au même moment, identifier la voiture externe et l’éventuel coût pour le foyer. |
| **Retour de soirée entre 2 h et 7 h** | Après **2 h** et avant **7 h**, proposer **Uber** comme hypothèse de retour, notamment pour une soirée au Dieze. Chercher en priorité une dépense Uber de transport autour de la soirée, y compris à la date du lendemain pour un retour de nuit. | Le retour du Mélomane peut se faire à pied. Le paiement, le trajet observé ou la confirmation établit le mode. Sans preuve de dépense, garder le coût à préciser. Traiter séparément les commandes Uber Eats. |
| **Hors métropole** | Proposer voiture si le trajet, le véhicule, le lieu ou les achats de mobilité donnent un indice solide. Priorité aux tronçons certifiés et aux trajets confirmés par l’utilisateur. | Train, covoiturage ou autre mode lorsqu’il est établi. Sans origine, destination ou route plausible, conserver « trajet à préciser ». |
| **Coût par trajet voiture** | Afficher départ, arrivée, distance et estimation d’essence. Réutiliser la route orientée, le véhicule et la consommation de référence selon le moteur existant. Le calcul de base est kilomètres × litres/100 km ÷ 100 × prix au litre. | Retour calculé s’il est documenté ou prévu explicitement. L’essence estimée est un coût d’usage. Le plein est un débit bancaire, à compter une seule fois. Péage et parking sont distincts et demandent leur propre preuve. |
| **Dépense comme condition de visibilité** | En Réalisé financier, créer une carte de travail, télétravail, journée maison ou leçon uniquement si une dépense réelle ou un usage économique documenté est rattaché. Préserver le détail des mouvements financiers pertinents, y compris revenus, remboursements et transferts. | Les activités sans dépense restent consultables dans le calendrier. Une activité importante peut être épinglée sur décision explicite. Les cartes prévues dans Édition existent même sans paiement. Les trajets estimés seuls ne constituent pas une dépense réalisée. |

## 4. Hypothèses réutilisables à valider

| Hypothèse | Admissible lorsque | Contrôle ou exception |
| --- | --- | --- |
| **Séjour avec sous-activités** | Un événement parent existe ou un même déplacement explique plusieurs activités, avec dates, lieux compatibles et participants concordants. Créer un séjour qui contient les achats, sorties et trajets liés. | Dans une zone partagée par deux séjours concomitants, choisir un parent seulement avec un lien plus fort. Les enfants restent visibles en détail. |
| **Visites Servian / Fontès dans un même séjour** | Les dates se recouvrent, un participant concorde et un tronçon certifié relie les deux lieux. | Deux visites le même week-end restent séparées si le trajet ou la participation ne permet pas de les relier. Afficher la personne par tronçon si elle est connue. |
| **Courses ou boulangerie pendant un séjour** | Preuve de proximité, jour d’achat exact et séjour unique compatible. Exemple de juillet déjà corrigé pour la boulangerie, le fleuriste et la fromagerie pendant la visite familiale. | Un achat auprès d’une autre succursale ou une commande en ligne ne suffit pas. En vue par catégorie, l’achat peut réapparaître dans sa catégorie de lecture avec la même référence et sans augmenter le total. |
| **Activité ou sortie avec plusieurs paiements** | Les opérations ont un lien d’activité ou une preuve convergente de lieu, date, personnes et usage. Exemples types pour le canoë, le shopping dans un centre ou la billetterie suivie d’un complément. | Une simple proximité de date reste contextuelle. Un achat de préparation peut être antérieur. Aucun paiement ne doit être déplacé du mois financier. |
| **Péage associé à un déplacement** | Le réseau, la date d’achat et le trajet convergent vers un seul événement. Un débit différé ou agrégé peut couvrir plusieurs segments. | Le nom « Vinci » seul ne suffit pas. Conserver le débit intact et documenter le lien. Une ventilation existe seulement si les montants sont justifiés. |
| **Répétitions d’un même marchand** | Plusieurs achats dans un contexte unitaire, par exemple cafés d’une journée, billets du même événement ou panier documenté. Montrer quantité et sous-total sur la carte. | Deux passages à des moments différents restent distincts si le contexte n’est pas établi. Le montant ou le marchand identique n’est pas une preuve de doublon. |
| **Préparation et achat pendant un événement** | Utiliser le type de lien existant. « Paiement de l’activité » et « causé par l’événement » peuvent contribuer au coût attribué. « Effectué pendant » est d’abord une référence de contexte. | Une préparation validée peut être incluse dans le coût global avec sa date de paiement. Un achat seulement contemporain reste compté sur sa carte propriétaire. |
| **Prélèvements récurrents** | Contrat ou série validée, avec périodicité et bénéficiaire. Utiliser l’historique pour la fenêtre habituelle dans le tableau de prévision. | Distinguer date attendue, date réellement débitée, augmentation, suspension et double prélèvement. Deux libellés similaires peuvent correspondre à deux contrats. |
| **Remboursements, cautions et transferts** | Conserver leur nature canonique. Lier le remboursement ou la restitution à la dépense d’origine lorsque la correspondance est établie. | Un remboursement de frais, une restitution de caution ou un virement entre comptes n’est pas un salaire. Présenter le brut et le net sans compter deux fois le mouvement. |
| **Espèces** | Relier le retrait et l’usage économique seulement si une annotation ou une ventilation l’atteste. Afficher l’usage sur la carte et le lien vers le retrait. | Une égalité de montant ne justifie aucun rattachement. Ne publier ni usages privés ni détails permettant de les inférer. |
| **Lieux et badges** | Utiliser l’identité commerciale reconnue et la succursale canonique. Badge spécifique prioritaire, puis badge partagé, puis activité compatible. Pour un marchand libre proposer un badge générique et demander le nom. | Respecter la politique visuelle du marchand. Une enseigne ou un badge financier ne prouve ni la succursale ni l’activité. Conserver le libellé bancaire d’origine pour vérifier. Laisser les adresses privées dans la base protégée. |
| **Activité à venir sans prix** | Garder la carte prévue et indiquer « à estimer ». Un prix habituel peut alimenter la prévision avec sa provenance. | Une estimation ne devient ni un paiement ni une preuve de réalisation. Réconcilier avec le réel lorsqu’un débit ou un usage est identifié. |

## 5. Fiche à remplir pour chaque mois

Copier cette grille pour **juillet**, **août**, **septembre** ou **octobre**. La garder dans le contexte privé de travail avant de soumettre les corrections.

| Champ | À renseigner |
| --- | --- |
| Mois et date d’observation | Indiquer le mois, la date du scénario et les dates d’arrêt des sources disponibles. |
| Couverture | Banque, calendrier, lieux, mobilité. Pour chaque source, noter complet, partiel ou inconnu. |
| Proposition de carte | Date d’activité, type, titre, lieu, participant, dépenses à rattacher, trajet et statut affiché. |
| Règle et preuve | Nom du pattern, source et niveau par champ. Indiquer validé, probable ou à préciser. Documenter les contradictions. |
| Coûts | Distinguer montant bancaire, coût économique en espèces, coût carburant estimé, prévision et montant inconnu. |
| Arbitrage | Confirmation, correction ou abstention. Reporter la décision dans les données ou le mécanisme existant quand la mise à jour est demandée. |

Avant de valider un lot, rapprocher le nombre de mouvements, les totaux par flux et l’identifiant propriétaire de chaque opération ou composant. Vérifier les soldes mensuels et les événements à cheval sur deux mois. Vérifier aussi un exemple de café groupé, une attribution Grand Frais avec succursale inconnue, une localisation incompatible avec le défaut Couple, un retour Uber après minuit, un trajet à plusieurs arrêts et une carte prévue sans débit. Les données d’un mois à couverture inconnue restent des prévisions ou des déclarations identifiées comme telles.

## 6. Points d’appui dans le dépôt

- [Lecture Réalisé et rattachement des paiements](../../src/server/phase2/planner/realized-month.ts)
- [Journées de travail et composants de repas](../../src/server/phase2/planner/realized-work.ts)
- [Séjours, présences et attribution des trajets](../../src/server/phase2/planner/historical-realized-context.ts)
- [Décisions propres au pilote de juillet](../../src/server/phase2/planner/july-realized-decisions.ts)
- [Lieux publics, résolution et indices marchands](../../src/server/phase2/planner/realized-places.ts)
- [Préférences déclarées dans les profils Analyse globale](../../src/server/analytics/global-v2-persona-signals.ts)
- [Sources des projets, services et habitudes de Mon perso](../../src/server/analytics/global-v2-persona-editorial.ts)
- [Règles existantes de prévision et de mobilité](PHASE2_MONTH_MODULES.md)
- [Autorité des sources et séparation entre données et présentation](SOURCE_OF_TRUTH.md)

La reconstruction doit utiliser ces mécanismes existants. Les règles de juillet contiennent aussi des corrections ponctuelles. Une extension aux autres mois doit distinguer ce qui peut devenir une règle de foyer et ce qui dépend d’un événement. L’analyse se fait côté serveur. Composer affiche la décision, sa preuve et les corrections disponibles.

**Déjà en place.** Le Réalisé regroupe les cafés et déjeuners reconnus, peut associer des trajets certifiés aux séjours, masque certaines journées sans mouvement, et relie les cartes des événements à cheval sur deux mois. Le planificateur distingue le carburant estimé du montant à financer. Le pilote de juillet contient ses propres attributions par marchand et personne.

**À appliquer après validation des fiches mensuelles.** Partager les règles datées de foyer entre les mois, comparer les regroupements proposés aux cartes actuelles, puis rendre systématique le filtre des événements sans dépense dans le Réalisé financier. Une reprise doit exposer les cas à confirmer avant de remplacer une attribution, un lieu ou un rattachement existant.
