# Composer V22 · Méga-run P21

Base `2e6febec5c9e56aaca76174c62d421157b4d44ef`, branche `codex/p21-mega-run-composer-v22`.

## A · Continuité du brouillon

- Reprise par occurrence exacte depuis le brouillon confirmé du même foyer et du même mois. L’onglet mémorise l’identité, l’identifiant du Draft et le digest. Le bouton de reprise utilise la navigation existante.
- En cas de conflit, la relecture du serveur conserve les saisies locales. Le chargement de la version serveur demande une confirmation séparée.
- Commit associé dans l’historique de la branche, `feat(composer): recover confirmed draft navigation`.
- TypeScript, diff, 8 contrôles Draft et 6 contrôles de parcours exécutés avec succès. Recette navigateur et authentifiée reportée.
- Suite immédiate · B, enrichissement des capacités métier existantes.

## B · Produits de beauté

- Eyeliner, crayon à sourcils, cire coiffante, nettoyant visage et démaquillant réutilisent les suggestions, l’édition de prix et de quantité et le résumé officiel de Mascara. Chaque produit garde son illustration et ses sélections.
- Commit associé, `feat(composer): extend beauty product editing`. TypeScript, diff et 16 contrôles du banc Beauté exécutés avec succès. Navigateur et recette authentifiée reportés.
- Suite · projets composés via les rattachements déjà admis.
- Tranche complémentaire · Concert, Musée et Accrobranche réutilisent l’éditeur d’activité avec prix, quantité, date, lieu et mobilité selon les capacités publiées. Le Dock propose le poste existant lorsqu’il est déjà choisi. Résumé de coût officiel. Commit `feat(composer): guide activity expenses and transport`. TypeScript, 10 contrôles de parcours et 10 contrôles Restaurant/Cinéma exécutés avec succès.

## C · Projets composés

- « Sortie composée » associe un Cinéma et un Restaurant dans le contrat parent/enfant du Draft existant. L’éditeur propose des rattachements admis par le serveur et une confirmation explicite.
- Navigation entre le projet et ses intentions, avec accès direct depuis Week-end. Les coûts individuels affichés viennent de la lecture officielle du digest courant. Le total consolidé du projet reste indisponible.
- Les groupes entre cartes racines N1 restent soumis à leur gate et leur chemin durable demeure fermé. Aucun changement de ce contrat ni de Before.
- Commit associé, `feat(composer): add composed outings`. TypeScript et contrôle de sept parcours, dont le rattachement avec identité et coût conservés, exécutés avec succès.
- Suite · modèles de départ et suggestions explicables.

## D · Modèles de projets

- Trois structures dans la bibliothèque · Cinéma et restaurant, Week-end et musée, Week-end et randonnée. La confirmation décrit les intentions qui seront ajoutées. Les prix et dates restent inconnus.
- Les opérations passent par l’évaluateur Composer existant. Le brouillon visible ne reçoit la composition qu’après admission de toutes les étapes, dans une seule entrée Undo/Redo.
- Commit associé, `feat(composer): add project starters`. TypeScript et 8 contrôles du parcours, dont les trois compositions et un refus intermédiaire, exécutés avec succès.
- Suite · suggestions explicables, fondées sur la composition courante.
- Un quatrième modèle ouvre un panier Jeux et accessoires vide dans l’enveloppe publiée Jeux/Numérique. Les achats beauté et les paniers spécialisés existants deviennent retrouvables depuis « Mes intentions ». Commit `feat(composer): start and reopen specialized baskets`.

## E · Suggestions pour compléter un projet

- Une sortie déjà liée à un cinéma ou un restaurant peut proposer le complément manquant. Un Week-end sans activité peut proposer une visite. Chaque proposition explique son déclencheur et vérifie la capacité publiée de rattachement.
- Consultation et masquage en mémoire de la session. Une adoption demande confirmation et vérifie de nouveau la cible. Les suggestions S1/S2 restent accessibles indépendamment.
- Commit associé, `feat(composer): suggest explainable project complements`. TypeScript et 9 contrôles ciblés exécutés avec succès. Scénarios authentifiés et responsive reportés.
- Suite · finitions et préparation de la recette ciblée.

## F · Lisibilité du Board et récupération

- Les projets indiquent le nombre d’intentions rattachées sur le Board. Le détail différencie le total connu, le sous-total évalué et le montant en attente de recalcul.
- Les erreurs de sauvegarde présentent leurs actions sous le bandeau. Le préflight distingue un conflit de référence, une sauvegarde non confirmée et des sources financières à compléter.
- Commit associé, `feat(composer): clarify project and draft status`. Douze contrôles Week-end ont validé les droits, les identités et les montants du Compiler.

## G · Recette à reprendre

- Recharger un Draft confirmé avec deux intentions homonymes. Confirmer que l’identité choisie est restaurée et que la saisie RAW n’est pas persistée.
- Provoquer un conflit sur fixture, relire la version serveur et vérifier que la lecture seule laisse les choix locaux disponibles.
- Vérifier chaque modèle, y compris un refus intermédiaire, Undo/Redo et la reprise du bon projet après Reload.
- Ouvrir un enfant, modifier un seul poste et revenir au parent. Vérifier coûts, rattachements, droits et absence de double comptage.
- Masquer, réactiver puis adopter une suggestion S3. Vérifier une lecture sans mutation, puis l’action explicite et l’absence de doublon.
- Contrôler le responsive, la sauvegarde authentifiée sur périmètre autorisé et une Preview FRESH lorsque les sources sont réellement disponibles. Ces recettes sont reportées.
- Réserver Apply et PlanRevision à un mandat distinct.
