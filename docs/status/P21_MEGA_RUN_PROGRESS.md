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
| READY | Navigation et accessibilité | Retour au projet et édition ciblée sans mutation de consultation |
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
