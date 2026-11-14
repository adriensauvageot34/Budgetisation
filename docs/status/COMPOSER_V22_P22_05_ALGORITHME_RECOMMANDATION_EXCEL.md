# Composer V22 · P22-05 · Recommandations à partir du catalogue Excel

14 novembre 2026 · `STRAT:P21-RECENTRAGE@v1` · recette sur ordinateur.

## A — Source vérifiée

Source lue : `CATALOGUE/PRIVE_NE_PAS_COMMIT/SOURCE_ORIGINALE_V22_529.xlsx` dans le ZIP fourni. SHA-256 `cbab56ca98b8a33f7c28846f3b9b0503e83e6882e5c655515dcf61970d822612`, feuille physique `Composer V21`, plage utile `A1:I530`. Lecture directe des cellules du XLSX, sans écriture dans le fichier original ; les résultats concordent avec le dictionnaire et les oracles du pack. Le Master V22 @v5 distingue bien découverte, situation, référence et décision financière.

Les neuf colonnes sont Famille, Élément, deux affinités qualitatives individuelles, Cycle de besoin, Renouvellement estimé, Habitudes déclarées, Nature budgétaire et Valeur personnelle. Les 529 lignes se répartissent entre 17 familles : vêtements 60, beauté 59, restauration 53, loisirs 51, courses 47, entretien 38, prestations 34, cadeaux 29, boissons 28, frais 28, santé 27, technologie 20, hébergements 20, transports 13, automobile 12, mobilier 6, bricolage 4.

Chaque cellule d'habitudes et la ligne source restent conservées dans la normalisation privée, avec deux listes distinctes MODES/SITUATIONS dans l'ordre source. Les marqueurs éditoriaux ont été supprimés seulement des listes dérivées. Dix lignes présentent des répétitions, trois un marqueur `TROP RARE`. Tiret et marqueur de rareté ne donnent aucun mode. Les 52 estimations de renouvellement restent indicatives et les 477 absences ne sont jamais interpolées. Pour Lessive, les dix semaines ne supposent ni dernier achat, ni stock, ni date d'échéance.

Les 529 entrées ont été rapprochées une par une de l'index public Clay par famille et libellé normalisés, puis confirmées par la provenance et la ligne. Aucun doublon famille/libellé, aucune collision ni correspondance non résolue pour cette édition. L'identifiant Clay existant reste documentaire : il ne remplace jamais l'identité d'une intention, d'une sélection ou d'une ligne de coût. Seuls les concepts publics et des relations métier vérifiées sont utilisés dans l'app. Le ZIP, le XLSX, les cellules brutes, les modes/situations déclarés par le foyer et la normalisation privée restent hors Git et hors bundle.

## B — Implémentation

1. **Contexte.** La Bibliothèque reçoit le mois et les intentions du modèle Composer. La recherche explicite reste prioritaire ; la page d'idées n'apparaît qu'en l'absence de requête. Les suggestions de carte utilisent la catégorie ouverte, les identités déjà présentes et les informations manquantes seulement si la lecture officielle est à jour. Les Docks conservent leur occurrence active, leurs droits, leurs sélections et leurs refus locaux.
2. **Candidats.** `library-recommendations.ts` réutilise les intentions publiées et les modèles existants, en ajoutant les libellés vérifiés aux termes de recherche. Le catalogue conserve ses 687 entrées consultables dont 529 issues du classeur. Les Docks/S3 réutilisent les candidats de chaque métier.
3. **Filtre.** Reprendre une occurrence selon la Bibliothèque publiée ; préparer une carte seulement avec `ADD_CONTEXT` sur le Board ; ouvrir un modèle existant si ses presets sont admissibles (l'admission de ses liens est toujours contrôlée à la création). Chaque Dock conserve le propriétaire, le socket, la cardinalité et la cible de son éditeur. La connaissance Excel seule n'accorde aucun droit.
4. **Tri.** `catalog-relevance.ts` partage le tri ordinal : recherche explicite pour la découverte, reprise et travail déjà ouvert, priorité métier, puis provenance vérifiée et clé stable. Les niveaux existants des adaptateurs restent prioritaires sur la provenance. La sélection générale est limitée à quatre propositions et diversifiée par catégorie ; une catégorie ouverte peut utiliser ses quatre places. Le tri des recherches et les Docks conservent leurs propres règles de présentation.
5. **Explication et action.** La Bibliothèque distingue reprise, nouvelle intention et modèle à personnaliser. Une idée nouvelle exige confirmation et reverrouille son digest. Le projet ouvre son aperçu. Le Dock conserve ses confirmations et ses éditeurs. Les éléments sans correspondance ou capacité restent consultables ou absents des actions.

Le départage par affinité a un point d'entrée distinct, testé avec deux identités synthétiques. Il requiert un sujet préalablement autorisé et un profil qui lui correspond ; une affinité défavorable ne filtre aucun résultat. L'application n'alimente pas ce point d'entrée. **`STOP_LOCAL[PROFIL_PRIVE]`** : aucun contrat n'atteste le lien entre un compte authentifié, la personne bénéficiaire et la colonne source, ni le lecteur privé autorisé associé. Une absence de préférence ne vaut pas refus ; consultation, sélection, confirmation, achat constaté et stock restent distincts. Aucun apprentissage ou suivi des impressions.

## C — Cartes proposées

| Situation | Résultat sur fixture | Pourquoi / action |
| --- | --- | --- |
| Découverte générale | Cinéma et restaurant, Week-end / Gîte, Amazon, Préparer mes courses | Modèle rattaché à un concept loisirs vérifié ; séjour lié à Gîte ; modèles achat et courses publiés. Aperçu du projet ou préparation confirmée. |
| Recherche « Billet de cinéma » | Cinéma ; occurrence Cinéma existante si présente | Alias documentaire vérifié. Une occurrence unique se reprend, plusieurs restent distinctes. En l'absence d'occurrence, la nouvelle correspondance documentaire se focalise pour laisser le choix explicite. |
| Reprise Amazon | Commande existante, puis ligne exacte dans la fiche Mascara du catalogue | Identités distinctes ; pas de nouvelle commande proposée pour ce produit déjà présent. |
| Loisirs | Bowling, Cinéma, Bowling et restaurant, Cinéma et restaurant | Concepts de la famille Loisirs et modèles raccordés. Deux propositions simples avant les modèles. |
| Besoin éventuel | Lessive dans Maison si le modèle est disponible | Consommable, sans urgence déduite. Aucun achat périodique, aucune alerte ni échéance. |
| Aucun candidat | Pas de sélection artificielle | Résultats absents si la catégorie, la recherche ou les capacités ne donnent aucun candidat utile. |

## D — Éléments dans les éditeurs

- **Cinéma :** le billet est du catalogue ; l'intention ouvre son éditeur d'origine. Si un billet existe, le même `selectionId` est repris. Popcorn et boisson portent une provenance métier distincte. Taxi requiert Mobility ; Parking reste conditionné à une configuration compatible. La séance et le lieu restent des champs du Cinéma.
- **Restaurant :** Bière est un concept public relié au Restaurant par son owner, sans transférer les règles de Bar ou de Maison. L'addition garde la priorité. Une bière comprise peut être décrite sans coût supplémentaire ; la distinction avec un vrai supplément reste officielle.
- **Amazon / Mascara :** le catalogue reconnaît le concept lors de la préparation d'une ligne. Une ligne identifiée se reprend avant toute proposition de création ; plusieurs homonymes gardent chacun leur ID. L'article, le besoin Beauté, le vendeur et la livraison demeurent distincts. Un prix vide reste `UNKNOWN`.
- **Week-end / S3 :** petit-déjeuner et taxe reprennent les concepts vérifiés ; la période, la durée et les droits du séjour restent prioritaires. S3 utilise le même départage pour les activités raccordées, après vérification du parent et du socket, sans toucher au focus de reprise P22-04. Aucun acte fournisseur.

## E — Garanties et performance

L'index de recherche garde en mémoire les libellés publics normalisés et leurs alias par tableau chargé. Le catalogue est chargé à la demande et partagé comme avant. Les recommandations ne lisent ni le classeur, ni un foyer distant, et ne changent pas le calcul Finance V2. Le classement des 687 entrées a été mesuré sur 40 appels Node mêlant recherche vide et filtrée : médiane environ 0,5 ms et p95 environ 3,4 ms sur cette exécution locale. Ce n'est pas un benchmark Production ou SNAP-3.

## F — Recette

Les oracles ont été examinés dans le pack. Les preuves sont réparties entre lecture source privée, banc local des propriétaires, banc des recommandations et navigateur C8 avec brouillon synthétique.

| Oracle | Statut | Preuve |
| --- | --- | --- |
| CAT-01 | PASS | Concept dans le XLSX et le catalogue public ; actif et facultatif dans Cinéma. |
| CAT-02 | PASS | Proposition EDIT sur la sélection existante dans le banc Cinéma. |
| CAT-03 | PASS | Absence du classeur ; provenance métier distincte. |
| CAT-04 | PASS | Trois situations dans la source ; le propriétaire Restaurant conserve les opérations distinctes. |
| CAT-05 | PASS | Taxi lié à une sortie dans la source ; tests avec et sans droit Mobility. |
| CAT-06 | PASS | Volontairement absent des candidats directs ; le catalogue n'admet le choix Cinéma qu'en présence du trajet voiture et de la capacité publique. |
| CAT-07 | PASS | Deux modes et Routine vérifiés en privé ; produit du catalogue et ligne d'achat distincts, référence non adoptée. |
| CAT-08 | PASS | Sujet différent ou non fourni : tri neutre ; cas synthétique autorisé testé. Aucun raccord réel. |
| CAT-09 | PASS | Dix semaines dans le XLSX ; le classement ne crée pas d'échéance. |
| CAT-10 | PASS | Les 477 absences restent inconnues. |
| CAT-11 | PASS | Deux homonymes renvoient deux liens d'édition vers leurs IDs exacts. |
| CAT-12 | PASS | Concept documentaire sans propriétaire dans la scène : aucune action d'achat. |
| CAT-13 | PASS | Dix lignes répétées, une seule valeur normalisée par token ; aucun poids produit issu de ces répétitions. |
| CAT-14 | PASS | Marqueurs éditoriaux exclus de la liste de modes ; aucun transfert côté client. |
| CAT-15 | PASS | Le refus s'applique à l'occurrence ; non-régression du RAW dans les bancs Restaurant et Bibliothèque. |
| CAT-16 | PASS | Classement sans mutation sémantique et aucun signal de préférence produit. |
| CAT-17 | PASS | Survol, classement, recherche, ouverture de la confirmation, consultation du Dock et reprise : aucun POST /interaction ou /draft et digest inchangé sur fixture C8. |
| CAT-18 | PASS | Ordre stable à entrées identiques et pour un ensemble départagé par ID. |
| CAT-19 | PASS | Proposition de reprise Amazon et ligne exacte ; création écartée du classement. |
| CAT-20 | PASS | L'addition de 40 €, dont 6 € de détail, reste 40 € dans le banc propriétaire ; un supplément distinct s'ajoute après décision. |

Les huit scènes de cartes sont vérifiées dans le banc `check-composer-p22-05-recommendations.mjs` avec le service et le modèle publiés sur fixtures. TypeScript et `git diff --check` passent. Non-régressions : Bibliothèque A2 (12), Restaurant/Cinéma (11), Séjour A06 (12), S3 (12), Panier (5 groupes) et découverte Clay (687 identités, dont Taxi/Parking et restrictions).

Chromium 157 et C8, run `1794670404077` : 3/3 en 1920 × 1080, 1440 × 900 et 1280 × 720. Les preuves couvrent la confirmation au clavier, la reprise d'un Cinéma par l'alias « Billet de cinéma », la préparation explicite d'une ligne Mascara puis sa réouverture, l'état `UNKNOWN`, zéro erreur navigateur/HTTP et zéro débordement horizontal. Les traces et captures synthétiques sont en local dans `repo/outputs/p22-05/desktop-final`.

Zoom natif Chrome à 125 %, run `1794670598875` : PASS au clavier, fenêtre 1280 × 720, viewport mesuré 1024 × 576, DPR 1,25, aucune erreur ni débordement horizontal. Retour panier « Mes intentions » : un clic automatisé a expiré lors du premier essai complet au zoom ; l'activation au clavier a réussi à chaque retour de la reprise finale. Le clic souris sur ce bouton précis au zoom reste non confirmé. Preuves dans `repo/outputs/p22-05/native-125`.

Production authentifiée, Save/Reload distant et FRESH distant : **NOT_RUN**.

## G — Démonstration

Ouvrir Composer puis « À ajouter ». Les idées montrent ce qu'on peut préparer ou reprendre. Ouvrir « Activités & loisirs » pour obtenir la sélection de cette catégorie. Chercher « Billet de cinéma » pour retrouver la carte Cinéma ou son occurrence existante. Dans Amazon, ouvrir le catalogue, chercher Mascara puis remplir la ligne proposée ; une fois conservée, revenir sur la fiche Mascara pour retrouver cette ligne exacte. Le fichier aide à reconnaître les concepts ; l'éditeur et l'utilisateur décident de ce qui entre dans le brouillon. Une future personnalisation durable demandera une association de profil et des preuves d'usage distinctes du Draft.

## H — Livraison

- Branche `codex/p22-05-excel-recommendations`, base locale `7fd883867ea49cfb3c35533570d32dedf274d02e` incluant P22-01 à P22-04. GitHub main et alias Vercel Production vérifiés sur `47f73aaffc70f8e5101defef546e138e52e24617` (`dpl_58FP9Hn8yECmhcxiFBiosSDwgMg4`, READY). P22-05 reste local.
- Les deux fichiers Cadeau et le rapport non suivi de P22-01 restent préservés.
- Code : `catalog-relevance.ts`, `library-recommendations.ts`, `composer-library.tsx`, `composer.module.css`, `catalog-discovery.ts`, `cinema-suggestions.ts`, `restaurant-editor.tsx`, `restaurant-suggestions.ts`, `short-stay-suggestions.ts` et `project-completion.tsx`. Tests : `check-composer-p22-05-recommendations.mjs`, `check-clay-discovery.mjs`, `check-restaurant-suggestions.mjs`.
- Le commit de livraison et son SHA exact sont indiqués dans le compte rendu final. Aucun push, déploiement, Apply, changement serveur Finance/World, SQL ou Auth.
