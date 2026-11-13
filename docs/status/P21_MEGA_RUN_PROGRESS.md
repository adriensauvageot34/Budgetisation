# Composer V22 · Méga-run P21

Base `2e6febec5c9e56aaca76174c62d421157b4d44ef`, branche `codex/p21-mega-run-composer-v22`.

## A · Continuité du brouillon

- Reprise par occurrence exacte depuis le brouillon confirmé du même foyer et du même mois. L’onglet mémorise l’identité, l’identifiant du Draft et le digest. Le bouton de reprise utilise la navigation existante.
- En cas de conflit, la relecture du serveur conserve les saisies locales. Le chargement de la version serveur demande une confirmation séparée.
- Commit associé dans l’historique de la branche, `feat(composer): recover confirmed draft navigation`.
- TypeScript, diff, 8 contrôles Draft et 6 contrôles de parcours exécutés avec succès. Recette navigateur et authentifiée reportée.
- Le banc du Shell valide aussi le remontage avec l’occurrence exacte, le refus d’un digest périmé et l’absence d’autosave déclenchée par la reprise.
- Le reçu HTTP est accepté après vérification de l’identité du Draft, de la version CAS et de la révision de référence attendues. Le banc HTTP a couvert les reçus incohérents et la reprise idempotente après perte de réponse.
- Suite immédiate · B, enrichissement des capacités métier existantes.

## B · Produits de beauté

- Eyeliner, crayon à sourcils, cire coiffante, nettoyant visage et démaquillant réutilisent les suggestions, l’édition de prix et de quantité et le résumé officiel de Mascara. Chaque produit garde son illustration et ses sélections.
- Commit associé, `feat(composer): extend beauty product editing`. TypeScript, diff et 16 contrôles du banc Beauté exécutés avec succès. Navigateur et recette authentifiée reportés.
- Suite · projets composés via les rattachements déjà admis.
- Tranche complémentaire · Concert, Musée et Accrobranche réutilisent l’éditeur d’activité avec prix, quantité, date, lieu et mobilité selon les capacités publiées. Le Dock propose le poste existant lorsqu’il est déjà choisi. Résumé de coût officiel. Commit `feat(composer): guide activity expenses and transport`. TypeScript, 10 contrôles de parcours et 10 contrôles Restaurant/Cinéma exécutés avec succès.

## C · Projets composés

- « Sortie composée » associe un Cinéma et un Restaurant dans le contrat parent/enfant du Draft existant. L’éditeur propose des rattachements admis par le serveur et une confirmation explicite.
- Navigation entre le projet et ses intentions, avec accès direct depuis Week-end. Les coûts individuels affichés viennent de la lecture officielle du digest courant. Le total consolidé du projet reste indisponible.
- Les groupes entre cartes racines N1 restent soumis à leur gate et leur chemin durable demeure fermé. La PR #98 conserve une preuve locale avec runtime partagé fermé. La PR #102 reste une Draft historique de Before. Les deux restent indépendantes de cette livraison.
- Commit associé, `feat(composer): add composed outings`. TypeScript et contrôle de sept parcours, dont le rattachement avec identité et coût conservés, exécutés avec succès.
- Suite · modèles de départ et suggestions explicables.

## D · Modèles de projets

- Trois structures dans la bibliothèque · Cinéma et restaurant, Week-end et musée, Week-end et randonnée. La confirmation décrit les intentions qui seront ajoutées. Les prix et dates restent inconnus.
- Les opérations passent par l’évaluateur Composer existant. Le brouillon visible ne reçoit la composition qu’après admission de toutes les étapes, dans une seule entrée Undo/Redo.
- Un changement de référence mensuelle ou de révision du Plan pendant l’évaluation interrompt la composition. L’utilisateur peut actualiser les finances, puis relancer le modèle. Le Draft initial reste disponible.
- Commit associé, `feat(composer): add project starters`. TypeScript et 8 contrôles du parcours, dont les trois compositions et un refus intermédiaire, exécutés avec succès.
- Suite · suggestions explicables, fondées sur la composition courante.
- Un quatrième modèle ouvre un panier Jeux et accessoires vide dans l’enveloppe publiée Jeux/Numérique. Les achats beauté et les paniers spécialisés existants deviennent retrouvables depuis « Mes intentions ». Commit `feat(composer): start and reopen specialized baskets`.
- Un cinquième modèle associe une activité à une visite amicale, avec navigation aller-retour et éditeurs indépendants. Aucun proche ni trajet n’est déduit. Commit `feat(composer): compose a visit with an activity`. TypeScript et les contrôles ciblés de composition ont réussi.

## E · Suggestions pour compléter un projet

- Une sortie déjà liée à un cinéma ou un restaurant peut proposer le complément manquant. Un Week-end sans activité peut proposer une visite. Chaque proposition explique son déclencheur et vérifie la capacité publiée de rattachement.
- Consultation et masquage en mémoire de la session. Une adoption demande confirmation et vérifie de nouveau la cible. Les suggestions S1/S2 restent accessibles indépendamment.
- Une visite amicale sans activité peut également proposer une sortie culturelle si le rattachement est admis. Le complément disparaît dès qu’une activité est liée.
- Commit associé, `feat(composer): suggest explainable project complements`. TypeScript et 9 contrôles ciblés exécutés avec succès. Scénarios authentifiés et responsive reportés.
- Suite · finitions et préparation de la recette ciblée.

## F · Lisibilité du Board et récupération

- Les projets indiquent le nombre d’intentions rattachées sur le Board. Le détail différencie le total connu, le sous-total évalué et le montant en attente de recalcul.
- Les erreurs de sauvegarde présentent leurs actions sous le bandeau. Le préflight distingue un conflit de référence, une sauvegarde non confirmée et des sources financières à compléter.
- Les actions de récupération sont regroupées sous le bandeau. Le contrôle ciblé du Shell et de la reprise d’une organisation locale a réussi. Le script navigateur a été adapté à ce nouvel emplacement et reste NOT_RUN pour cette tranche.
- Le retrait d’un projet avec des enfants vérifie leurs droits et confirme la portée exacte. Un changement du brouillon invalide la confirmation. Les rattachements proposés sont revérifiés avant adoption.
- Le récapitulatif suit l’ordre publié des intentions et garde un accès à chaque occurrence si une ancienne date est invalide. TypeScript et les dix contrôles de parcours ont réussi.
- Commit associé, `feat(composer): clarify project and draft status`. Douze contrôles Week-end ont validé les droits, les identités et les montants du Compiler.

## G · Recette à reprendre

- Recharger un Draft confirmé avec deux intentions homonymes. Confirmer que l’identité choisie est restaurée et que la saisie RAW n’est pas persistée.
- Provoquer un conflit sur fixture, relire la version serveur et vérifier que la lecture seule laisse les choix locaux disponibles.
- Vérifier chaque modèle, y compris un refus intermédiaire, Undo/Redo et la reprise du bon projet après Reload.
- Ouvrir un enfant, modifier un seul poste et revenir au parent. Vérifier coûts, rattachements, droits et absence de double comptage.
- Masquer, réactiver puis adopter une suggestion S3. Vérifier une lecture sans mutation, puis l’action explicite et l’absence de doublon.
- Contrôler le responsive, la sauvegarde authentifiée sur périmètre autorisé et une Preview FRESH lorsque les sources sont réellement disponibles. Ces recettes sont reportées.
- Réserver Apply et PlanRevision à un mandat distinct.

Les contrôles ciblés exécutés couvrent aussi le panier multi-articles, le Save/Reload sur stockage isolé et le refus des révisions obsolètes. Le journal est suivi par la Draft PR #123.

## Ultra-run · 13 novembre 2026

Fenêtre demandée de 09 h 30 à 14 h 30, heure de Paris, sous réserve des limites effectives. Reprise de `f601439` et de la Draft PR #123. `main` reste sur `2e6febe` au démarrage.

| État | Chantier | Prochain résultat |
| --- | --- | --- |
| DONE | Aperçu personnalisable des modèles | Nom du projet, compléments facultatifs, six modèles dont Week-end multi-enfants |
| DONE | Lecture des intentions liées | Impact officiel par enfant, diagnostics ciblés et consultation seule visibles |
| DONE | Déplacements | Rubriques de saisie et accès au parking du trajet déjà choisi |
| DONE | Activités et achats | Reprise exacte des presets Activity/Purchase existants, labels adaptés et coût nul explicite |
| DONE | Découverte des modèles | Catégories, illustrations Clay, contenu et recherche par intentions |
| DONE | Suggestions S3 | Compléments selon les enfants réels, priorité repas/activités en mémoire de session |
| DONE | Produits Beauté complémentaires | Tonique, sérum, crème hydratante et lotion dans l’éditeur prix/quantité existant |
| DONE | Navigation et accessibilité | Groupes par projet, filtre et retour au parent consultable |
| DONE | Déplacement d’une intention liée | Reparentage explicite, identité et postes conservés, droits et digest revérifiés |
| DONE | Lecture financière des relations | Contexte parent distingué du coût individuel de chaque intention |
| DONE | Reprise des séjours | Hôtel et séjour chez des proches retrouvables, deux modèles supplémentaires |
| DONE | Aperçu des projets | Blocages visibles et confirmation inactive pendant une comparaison ou organisation |
| DONE | Catalogue contextualisé | Type d’éditeur annoncé et recherche des paniers par leurs articles |
| DONE | Accessibilité des formulaires | Annulation de l’aperçu rend le focus, réussite laisse la navigation du projet disponible |
| DONE | Compléments des séjours | Ouverture exacte des enfants et confirmation explicite de leur retrait |
| DONE | Autres intentions déjà éditables | Tous les presets publiés retrouvables sous leurs droits actuels |
| DONE | Relations sur le Board | Lien compact vers le parent exact dans les cartes enfants |
| DONE | Synthèse des informations manquantes | Diagnostics officiels de l’intention et de ses postes, masqués si périmés |
| DONE | Navigation du Board | Navigation commune, nom complet accessible et occurrence exacte |
| DONE | Retour après déplacement | Destination révélée uniquement après réponse admise de l’évaluateur |
| DONE | Informations de financement | Accès en lecture aux sources du mois depuis le détail de financement |
| DONE | Liste des intentions | Recherche dans les parents et numéros d’homonymes stables sous filtrage |
| DONE | Modèles et disponibilité | Structures existantes proposées à l’ouverture, compléments filtrés selon les droits |
| DONE | Date du modèle | Date facultative du parent, sans propagation aux compléments |
| DONE | Mobilité explicite | Tarif du trajet complet, retour et frais du propriétaire partagé distingués |
| DONE | Accessibilité de la bibliothèque | Entrée ouvre l’existant, Échap et flèche haute reviennent à la recherche |
| DONE | Sélection du mois | Mois explicite dans la liste et l’aperçu des modèles |
| DONE | Lecture des montants | Coûts inconnus, sous-totaux officiels et montants à actualiser dans les projets |
| DONE | Produits du catalogue vers les paniers | Choix canoniques compatibles vers les recettes existantes ou le panier générique |
| DONE | Ouvrir une ligne depuis le catalogue | Sélection exacte transmise à l’éditeur et refus des captures obsolètes |
| DONE | Panier générique | Reprise par son contenu et filtre des articles dont le prix reste à préciser |
| DONE | Synthèse des projets | Compteurs officiels et filtres pour les projets contenant plusieurs enfants |
| DONE | Préférences de lecture | Espace Mes intentions, filtres projets et informations à compléter |
| BLOCKED | Détachement vers la racine | Aucun contrat existant ne détache sans supprimer l’enfant. `CLEAR_SOCKET` supprime les descendants, donc inutilisable pour cette action |
| BLOCKED | Relations racines N1 et Before | Gates et chemin durable historiques fermés, aucun contournement autorisé |

Les recettes navigateur exhaustives et authentifiées restent NOT_RUN pour ce run. Les vérifications ciblées seront consignées à chaque commit.

### Aperçu des modèles

Le nouvel aperçu présente la structure requise, les compléments facultatifs et leurs disponibilités. Il accepte un nom explicite et ne modifie le Draft qu’après confirmation. Un sixième modèle prépare un Week-end avec musée et randonnée. Les choix sont revérifiés par l’évaluateur existant, puis admis ensemble dans l’historique Undo/Redo. Les erreurs restent visibles dans l’aperçu.

TypeScript, `git diff --check` et les dix groupes du banc de parcours ont réussi. Le banc a exercé les six modèles, un nom personnalisé, le retrait d’un complément, le refus des doublons et d’un choix étranger au modèle, l’échec intermédiaire et le changement de référence. Zéro écriture distante, aucun Apply.

### Intentions liées

Chaque enfant offre la même lecture financière officielle que son éditeur, avec les diagnostics ciblés déjà publiés et la restriction de consultation. Les détails financiers disparaissent lorsque la projection est périmée. Aucun total de projet n’est recalculé par React.

TypeScript, diff et les dix groupes du banc de parcours PASS. Le contrôle de rendu distingue la lecture FRESH de l’état STALE et conserve l’ordre et les identités des enfants.

### Frais et déplacement

L’éditeur d’activité/Restaurant regroupe les champs Mobility publiés en trajet, frais, financement, horaires et partage. Le parking d’une voiture déjà choisie possède un accès direct. Les péages et le carburant restent des résultats du propriétaire Mobility. Train, bus, taxi et les autres modes admis conservent leurs champs officiels.

TypeScript et diff PASS. Deux contrôles React et propriétaire ont validé la conservation RAW entre rubriques, le parking adopté explicitement avec identité stable et le refus d’une édition obsolète. Les dix contrôles Restaurant/Cinéma ont réussi. Aucun appel distant ni writer financier exécuté.

### Activités et achats retrouvables

Les activités et achats déclarés par les presets publiés se retrouvent dans la bibliothèque du mois, sous les mêmes contrôles d’identité et de droits. Pêche, Plage, Randonnée et Spa utilisent des libellés de coût adaptés dans l’éditeur partagé. L’utilisateur peut préparer explicitement un coût nul, puis le valider ; cela ne renseigne pas les frais annexes.

TypeScript, diff et dix groupes de parcours PASS. Sept activités ont été créées, rendues et chiffrées par leur propriétaire sur fixture. Plage a confirmé la distinction entre zéro déclaré et UNKNOWN. Les fixtures et le World restent inchangés, aucun writer distant exécuté.

### Bibliothèque de modèles

Les six modèles sont classés en sorties, séjours, visites et achats. Leur contenu et une illustration Clay existante sont visibles avant l’aperçu. La recherche associe les termes du parent et des compléments, avec normalisation des accents et plusieurs mots.

TypeScript, diff et trois contrôles recherche/rendu PASS. La consultation des six modèles conserve le Draft. Les contrôles vérifient notamment « musée randonnée », « film dîner » et « achats manette ».

### Suggestions S3 et priorités

Une sortie vide peut commencer par Cinéma ou Restaurant. Un Week-end propose culture ou nature, puis uniquement le complément encore absent. La priorité explicite repas/activités change l’ordre, avec une limite de quatre suggestions visibles. Les préférences, masquages et désactivation restent dans la session du Shell. Chaque motif décrit les intentions réellement présentes.

TypeScript, diff et quatre contrôles React/propriétaire PASS. Priorité, masquage, réactivation et consultation sans mutation sont couverts. Une confirmation ouverte est refusée si le complément est déjà adopté entre-temps. Le rattachement explicite conserve l’identité cible et les suggestions disparaissent après adoption. Aucun writer distant ni Apply.

### Produits de soin complémentaires

Tonique, Sérum visage, Crème hydratante et Lotion de soin réutilisent le propriétaire Beauté et son éditeur de prix/quantité. Les suggestions et la reprise sont liées aux presets exacts. La palette accepte leur illustration de preset existante lorsqu’aucun asset canonique ne possède le même visuel ; aucune identité produit n’est créée à partir de cette présentation.

Les seize contrôles du banc Beauté PASS, incluant les neuf extensions de Mascara, les identités, UNKNOWN, zéro, quantité et références Clay. TypeScript et diff PASS. Aucun writer distant, SQL ou Apply.

### Navigation par projet

Le sélecteur regroupe les intentions par projet, y compris les enfants imbriqués. Au-delà de huit intentions, une recherche retrouve aussi le nom du parent. Une sélection courante reste accessible lorsqu’elle ne correspond pas au filtre. Les parents consultables restent atteignables depuis un enfant.

TypeScript, diff et trois contrôles d’identité/rendu PASS, incluant homonymes, imbrication, recherche avec accents et référence cyclique défensive. Aucune mutation à la consultation.

### Déplacement vers un autre projet

Une intention liée peut être déplacée vers un autre projet quand le serveur publie `REPARENT_PRESERVE_ID`. Les destinations proposées utilisent uniquement des sockets répétables pour éviter de remplacer un autre enfant. Une confirmation explique le retrait de l’ancien projet et conserve les postes de l’enfant. Les protections du parent, de l’enfant, de la relation et de la destination sont respectées. Les descendants ne sont jamais proposés comme destination.

TypeScript, diff et deux contrôles React/propriétaire PASS. Deux projets homonymes restent distincts ; un billet à 12 € conserve son identité, ses composants et son coût officiel. Un changement du Draft invalide la confirmation. Aucune suppression de projet ni écriture distante, aucun Apply.

### Séjours et visites familiales

Hôtel et Séjour chez des proches se retrouvent dans les intentions du mois. Deux modèles ajoutent respectivement une visite culturelle et une balade, portant la bibliothèque à huit modèles. Les visites familiales exposent les enfants, leur ouverture, leur déplacement admissible et les suggestions S3. La lecture d’un enfant précise son projet parent et le périmètre individuel des montants.

TypeScript PASS. Deux contrôles propriétaire/rendu et les trois contrôles de bibliothèque PASS. Les nouveaux séjours conservent hébergement, nuits, dates et coûts inconnus ; aucune gratuité n’est déduite du séjour chez des proches. La visite familiale reste sans personne, lieu ni prix inventés. Le maintien de l’éditeur familial après rattachement utilise le chemin du Shell déjà employé pour les séjours. Recette navigateur approfondie NOT_RUN.

### Paniers et fiches spécialisées

La bibliothèque distingue panier multi-articles, fiche d’article, activité et intention à compléter. Une recherche peut retrouver un panier par le nom d’un article. Correction ciblée : un panier Vêtements `purchase@v2` ne passe plus dans le contrôle mono-article historique qui le classait à tort en consultation seule. Les versions panier de la carte et du Draft doivent correspondre avant toute proposition de reprise.

TypeScript et diff PASS. Le banc panier valide Amazon, Vêtements, Courses, compatibilité historique et Save/Reload sur stockage SQL isolé. Les nouveaux contrôles couvrent le panier Vêtements vide, son ouverture, la recherche de Jean et l’ancrage qui impose la consultation. Aucun accès à une base distante ni Apply.

### Aperçu et focus

L’aperçu explique les blocages transitoires du Shell et empêche une confirmation sans effet pendant une comparaison ou organisation locale. Annuler rend le focus à l’origine. Une création réussie ne force plus le retour sur la bibliothèque. Les aides de sauvegarde pointent vers les actions réellement présentes sous le bandeau.

TypeScript, diff et deux contrôles React PASS. Nom et choix facultatifs restent locaux jusqu’à confirmation, le motif de blocage empêche toute création, l’annulation et la réussite ont des comportements de focus distincts. Aucun writer distant.

### Postes enfants d’un séjour

Les postes Activités et Repas offrent un accès direct à l’intention enfant, comme le faisait déjà le panier lié. La confirmation de retrait indique que l’intention, ses postes et ses éventuels enfants seront retirés lors de la validation du séjour. Le déplacement vers un autre projet reste disponible depuis le résumé.

TypeScript, diff et deux contrôles React/propriétaire PASS. Deux Cinéma homonymes ouvrent leurs identifiants respectifs. Le retrait attend sa confirmation puis la validation du séjour, conserve le parent et l’autre enfant et passe par le propriétaire existant. Aucun writer distant ni Apply.

### Mes intentions du mois

Un espace dédié liste les intentions déjà présentes sans imposer de recherche préalable. Les filtres montrent tous les projets ou les intentions à compléter selon la connaissance publiée par le Compiler. Les indications périmées sont masquées. La reprise inclut désormais les soirées, repas livrés, restauration rapide et cadeaux déjà admis par les presets existants ; elle ne crée aucune capacité depuis un nom de catalogue.

TypeScript et deux contrôles React/propriétaire PASS. Six familles de presets sont créées sur fixture puis retrouvées avec leur identité. L’ouverture, les filtres et le passage en état STALE ne modifient pas le Draft et n’exécutent aucun writer distant.

### Diagnostics d’une intention

Le résumé d’impact affiche les diagnostics publiés qui ciblent exactement l’intention, ses composants, son intention Mobility ou son trajet. Les messages globaux et ceux des autres intentions restent hors de ce détail. Les doublons sont retirés et la lecture périmée est masquée. Aucun diagnostic ne déduit à lui seul une autorisation Apply ou une modification du statut FRESH.

TypeScript, diff et deux contrôles de portée/rendu PASS. Les références sont celles du propriétaire ; FRESH et BLOCKED affichent les repères courants, STALE et PENDING les masquent. Zéro écriture distante. Le banc de dix parcours a également été rejoué au checkpoint `8bf7414` avec huit modèles et sept activités : PASS.

### Parent visible sur le Board

Les cartes enfants exposent un lien compact vers le projet parent, en réutilisant le sélecteur et le routeur d’intentions. Le libellé accessible conserve le nom complet et la distinction des homonymes ; le texte visuel peut être tronqué. Un parent absent du périmètre de navigation ne produit aucun lien actif.

TypeScript, diff et quatre contrôles de navigation/rendu PASS. Les identités et le regroupement sont conservés. Le rendu interactif complet du Board reste NOT_RUN.

### Suivi d’un rattachement

Le Shell repère le projet de destination après admission effective du rattachement ou du déplacement. Il affiche les noms d’occurrence et propose la reprise du projet. Une réponse refusée ne déplace pas le focus et ne modifie pas le Draft. Le détail de financement peut ouvrir les sources du mois même hors état BLOCKED, via le panneau existant et sa protection RAW.

TypeScript et diff PASS. Les huit contrôles du Shell ont réussi, avec un rattachement réel sur l’évaluateur de fixture et un refus serveur. Aucun Draft durable n’est écrit par ce test. Les contrôles des déplacements et de la lecture des diagnostics/sources PASS. Aucun Apply ni writer distant.

### Date et ordre d’un modèle

L’aperçu peut recueillir une date facultative pour le parent, dans le mois Composer. Les activités et compléments conservent leurs dates indépendantes. L’ordre du modèle est stable lorsqu’un complément est décoché puis réactivé.

TypeScript et les deux contrôles React d’aperçu PASS. Les dix groupes du banc de parcours PASS, incluant une date valide, la non-propagation aux enfants et le refus d’un jour invalide ou d’un autre mois avant toute évaluation. Prix et participants restent à préciser ; aucun writer distant.

### Recherche par projet et homonymes

La liste du mois retrouve une intention par le nom de son projet ou d’un parent. Deux intentions homonymes conservent leur numéro de repérage quand un filtre en masque une. Le parent reste indiqué dans les résultats avec sa propre distinction d’occurrence.

TypeScript, diff et deux contrôles React/propriétaire PASS. Un cadeau lié à un projet culturel est retrouvé par ce projet ; l’autre cadeau homonyme reste distinct et le numéro ne dépend pas des résultats visibles. Aucune mutation à la recherche.

### Lire un projet comportant plusieurs enfants

Le résumé indique combien d’intentions sont à compléter ou en consultation, à partir de la connaissance et des capacités publiées. Au-delà de quatre enfants, des filtres permettent de les repérer. Les coûts restent individuels. Les protections de composition, y compris celles propagées par un enfant ancré, sont affichées telles que le propriétaire les publie.

TypeScript, diff et deux contrôles React/propriétaire PASS sur cinq Cinéma homonymes. Zéro explicite est distinct d’UNKNOWN, les numéros restent stables sous filtrage et STALE masque la classification à compléter. Le modèle financier, les intentions et leurs droits ne sont pas modifiés par les filtres.

### Retrouver une structure avant de recréer

L’aperçu d’un modèle montre les intentions du même type déjà présentes dans le mois. Il permet de les ouvrir ou consulter par leur identité, avec les droits courants, sans ajouter automatiquement les compléments du modèle. Le nouveau projet reste une action explicite distincte.

TypeScript, diff et trois contrôles React d’aperçu PASS. L’ouverture d’un séjour existant ne crée pas une deuxième structure et conserve son digest. Aucun writer distant.

### Trajet complet et frais partagés

Le montant de billet/course est présenté comme celui du trajet complet. L’aller-retour ne déclenche aucun multiplicateur d’interface. Les frais et le financement du trajet propriétaire ne sont pas saisissables sur son participant partagé ; les buffers restent disponibles si l’utilisateur revient à un trajet propre. Le mode explicitement gratuit ne présente pas de billet payant à adopter.

TypeScript et trois contrôles React/propriétaire PASS. Le préparateur Mobility officiel, raccordé aux providers de fixture existants, évalue un billet de train de 10 € à 10 € en aller simple comme en aller-retour. Sans direction déclarée, son montant évalué reste inconnu. Aucun appel route, carburant ou péage n’est réalisé par le train ; aucun writer distant, SQL ou Apply.

### Clavier et repérage du mois

Dans Mes intentions, Entrée ouvre uniquement un résultat existant unique. Échap et la flèche haute depuis le premier résultat rendent la recherche accessible. Home/End et les flèches ignorent les boutons cachés dans les sections repliées. Le mois est affiché en toutes lettres dans la liste et l’aperçu des modèles.

TypeScript, diff et trois contrôles React/propriétaire PASS, incluant les événements clavier sur DOM simulé. Aucun ajout d’intention ni writer distant. La recette clavier en navigateur réel reste NOT_RUN. Au checkpoint `9bc18c1`, le contrôle Vercel automatique était PENDING ; aucune certification de Preview n’est déduite de ces contrôles locaux.

### Rejouer les contrôles ciblés

Les pilotes React additionnels acceptent `PLANNER_REACT_TEST_TOOLS`, chemin du répertoire contenant le `package.json` du renderer déjà disponible. Sans cette variable, ils réutilisent `outputs/p21-react-tools`. Aucun paquet de test ou fichier de ce répertoire n’est inclus dans le commit. Les scripts du propriétaire et les fixtures de calcul restent ceux du dépôt.

### Préparer un panier depuis un produit du catalogue

Des produits canoniques compatibles ouvrent une préparation de panier. Beauté, Vêtements, Jeu vidéo et les consommables disposant d’une recette publiée réutilisent cette recette. Les autres équipements admis utilisent le panier générique. La même fonction d’admission que le propriétaire `purchase@v2` vérifie le domaine ; les concepts incompatibles restent sans action de création. Le produit n’adopte ni prix ni vendeur à la consultation.

Le catalogue propose aussi de retrouver les paniers contenant déjà le concept exact. Les paniers génériques sans preset deviennent retrouvables et éditables selon leurs droits. Une présentation de version future inconnue ne reçoit aucun droit supplémentaire.

TypeScript et le contrôle ciblé du catalogue PASS : sept produits réels du catalogue public, dans six modules, passent la création et l’adoption d’un article UNKNOWN via le propriétaire existant. Les droits de création, le budget Courses comme cible distincte, les métadonnées futures et l’ouverture de l’existant sont vérifiés. Le test React confirme le passage du concept exact par l’action du catalogue. Aucun writer distant ni Apply.

### Article exact depuis le catalogue

Les paniers contenant le concept recherché proposent les lignes correspondantes séparément. L’éditeur rouvre la sélection exacte avec ses valeurs déclarées. Une sélection ou des droits devenus obsolètes produisent un message en conservant le panier et les saisies disponibles. Un panier protégé est proposé en consultation sans action d’édition de ligne.

TypeScript et le banc catalogue/propriétaire PASS. Deux Chargeur homonymes gardent leurs identités. Modifier le deuxième de 20 € à 21 € conserve le premier à 12 € et produit le sous-total officiel de 33 €. L’ouverture seule ne déclenche pas de mutation ; la saisie RAW reste locale jusqu’à validation. La capture antérieure au changement est ensuite refusée. Aucun writer distant ni Apply.

### Reprise · six nouvelles activités

Bowling, Karting, Escape game, Mini-golf, Billard et Piscine utilisent chacun leur export Clay V22 et le contrat Activité existant. La bibliothèque ne propose leur création que si le dépôt sur le Board est admis. Les éditeurs rouvrent l’occurrence exacte avec un libellé de coût adapté, sans prix, frais, participants ni trajet préremplis.

TypeScript, diff et les dix groupes du banc de parcours PASS. Treize activités passent par les slots existants sur fixture, avec reprise de l’identité et contrôle du coût officiel. Les six nouveaux visuels sont présents et le retrait de la capacité Board masque les six créations. Aucun writer distant ni Apply. Suite · recherche et complétude des paniers génériques.

### Recherche et prix manquants dans les paniers

La liste des articles filtre les libellés déclarés et les noms canoniques, avec un filtre pour les prix à préciser. Les homonymes gardent leur numéro d’origine et l’ouverture cible la sélection exacte. Le prix nul explicite reste renseigné. Les montants évalués de ligne sont masqués lorsque la projection est périmée ; les prix saisis restent lisibles.

TypeScript, diff et le banc catalogue/panier PASS. Le filtre isole une ligne UNKNOWN sans renuméroter l’homonyme à 0 €, et le passage à STALE masque son total calculé sans mutation ni changement de digest. Aucun writer distant ni Apply. Suite · lecture des coûts des intentions liées.

### Coûts individuels des intentions liées

Chaque ligne distingue coût total, sous-total connu, coût inconnu et calcul à actualiser. Le filtre « À compléter » suit le coût officiel lorsqu’il est publié. L’identité, la consultation et les actions de rattachement restent visibles indépendamment du calcul.

Le banc des intentions liées vérifie 0 € explicite, un sous-total officiel de 12 € avec supplément inconnu, un coût inconnu, le masquage en STALE et l’ouverture de l’homonyme exact. Digest préservé, aucun writer distant ni Apply. Suite · accès depuis le catalogue Clay.

### Activités depuis le catalogue Clay

Les six visuels exacts ouvrent leur intention existante même après renommage. Si aucune n’existe, le catalogue propose sa préparation lorsque le Board admet le dépôt. Dans une activité libre, un choix peut préparer le poste principal encore vide selon la capacité publiée. Un contexte budgétaire distinct ne propose pas cette création.

Le banc Clay PASS sur les 687 visuels, les six correspondances exactes, la reprise, les capacités refusées et la non-régression Cinéma. Aucun changement du catalogue public ni nouvelle illustration. Suite · nouveaux modèles de projets.

### Bowling et restaurant, visite amicale et escape game

Deux modèles préparent des compléments facultatifs via les sockets existants, ce qui porte la bibliothèque à dix modèles. Le modèle de visite ne déduit ni personne ni lieu. Les deux modèles laissent les tarifs, dates des enfants et trajets à renseigner.

TypeScript, diff, recherche/rendu de la bibliothèque et les dix groupes du banc de parcours PASS. L’évaluateur confirme les rattachements par identité de preset, leur ordre et l’absence de poste prérempli. Aucun writer distant ni Apply. Suite · suggestions S3 fondées sur les activités effectivement liées.

### Suggestions S3 pour les sorties de loisirs

Une sortie contenant l’une des six nouvelles activités peut proposer un repas en nommant l’activité liée. Plusieurs activités ne produisent qu’une proposition. Un restaurant, un repas rapide ou une livraison déjà liés la retirent. Un restaurant accompagné d’une activité ne reçoit pas de suggestion Cinéma par défaut.

TypeScript, diff et cinq contrôles S3 PASS. Le banc couvre la priorité locale, la confirmation explicite, le refus d’une proposition devenue obsolète, les capacités et l’absence de doublon. Aucun writer distant ni Apply. Suite · navigation de la bibliothèque.

### Recherche clavier des modèles

Lorsqu’un seul modèle correspond à la recherche et qu’aucune intention ne correspond, Entrée ouvre son aperçu. Les résultats de modèles participent à la navigation clavier et le message de recherche vide disparaît s’il existe un modèle correspondant. Les actions masquées par une section repliée ne captent pas le focus.

TypeScript, diff et les quatre contrôles de la bibliothèque PASS. « quilles dîner » ouvre l’aperçu du modèle Bowling et restaurant en conservant le digest. Aucun writer distant ni Apply. Navigation navigateur et recette authentifiée NOT_RUN. Suite · état des paniers sur le Board.

### Montant du panier sur le Board

Le Board et l’éditeur utilisent la même règle de fraîcheur. La carte affiche un total brut ou un sous-total connu selon le reçu du Compiler, avec le nombre d’articles. En attente d’une projection ou en cas de digest périmé, les montants évalués sont masqués.

TypeScript, diff et banc d’impact PASS. Amazon est vérifié à 48 € puis à 53 € avec livraison. Une ligne inconnue produit un sous-total distinct ; STALE masque les 48 €. Les sept éditeurs et les couvertures Courses gardent leurs résultats de fixture. Aucun writer distant ni Apply.

### Compléments homonymes dans les activités

Les compléments homonymes sont numérotés dans le panneau d’activité. La modification garde la ligne à sa place et n’affecte pas les autres compléments.

TypeScript, diff et onze contrôles Restaurant, Cinéma et Activité PASS. Deux locations de chaussures de Bowling à 6 € gardent leur identité et leur ordre après modification ciblée de la première à 7 €. Le Compiler confirme les trois montants de la sortie. Aucun writer distant ni Apply.

### Retrouver un panier par son vendeur ou son concept

« Mes intentions » retrouve le panier par son vendeur déclaré et par le concept Clay d’un article, y compris après renommage de la ligne. La navigation annonce l’édition seulement lorsque l’occurrence est active et que le rattachement affiché correspond au Draft.

TypeScript, diff et banc catalogue/panier PASS. La recherche combinant vendeur et concept retrouve un seul panier, préserve son digest et ne déclenche aucun writer distant. Les protections de lignes et le filtre des prix inconnus restent vérifiés.
