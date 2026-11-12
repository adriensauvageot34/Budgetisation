# Suggestions contextuelles Restaurant — P21

Développement et préparation de livraison du 12 novembre 2026, sur `codex/p21-restaurant-suggestions`, à partir de `89f42adcee690e645ef1dba24e8dd548db3c745e`. GitHub et Vercel ont confirmé cette référence en Production lors de la préparation. Le commit local contient les quatre fichiers applicatifs, les trois scripts de test et ce rapport. Les captures, journaux et dépendances de test restent des artefacts locaux exclus du commit.

## Capacités réutilisées et résultat utilisateur

Restaurant possédait déjà un propriétaire `EDIT_RESTAURANT`, les éditeurs de l’addition, des détails compris, des suppléments, des participants et des champs de lieu/date. Le catalogue M17/M18 proposait déjà des commandes sur la bière, avec des cibles exactes. Cinéma utilisait un classement déterministe, le Dock `ContextPalette`, quatre propositions visibles et des refus locaux. Cette tranche réemploie ces mécanismes et ajoute un adaptateur Restaurant.

Le résumé affiche au plus quatre suggestions. Ouvrir une proposition prépare le formulaire existant. Le brouillon évolue après validation explicite du choix.

| Situation | Proposition et action |
| --- | --- |
| Addition absente ou inconnue | Préciser l’addition, si son poste est admis. |
| Addition présente, bière absente | Renseigner une bière comprise. Le formulaire décrit cette consommation dans le total. |
| Bière déjà comprise | Modifier le détail existant, avec son `detailId` et son addition parente. |
| Bière déjà en supplément | Modifier la ligne existante, avec son `selectionId`. |
| Plusieurs bières ou suppléments homonymes | Ouvrir la liste des lignes. Les détails et les suppléments homonymes portent un numéro et demandent un choix explicite. |
| Supplément distinct admis | Préparer un supplément. La confirmation « Supplément réel » précède la saisie lorsqu’un total existe. |
| Participants, lieu ou date absents | Ouvrir la configuration correspondante. Ces précisions restent facultatives. |
| Lieu canonique connu ou trajet déjà choisi | Proposer la configuration ou l’édition du trajet seulement si Mobility publie le poste, le drop et l’éditeur compatibles. |

La bière réutilise le Clay `v22-art:excel:2` et sa provenance catalogue. Le taxi réutilise `v22-art:excel:499` lorsque le trajet est admis. L’action de supplément porte sa provenance de règle Restaurant. Les autres propositions de configuration et les éléments déjà choisis sont identifiés dans leur explication.

Le masquage est local, réversible et attaché à l’occurrence et à la cible. Il s’efface au rechargement. Le bouton « Tous les choix du restaurant » conserve l’accès aux réglages existants. L’éditeur reste dans le Board horizontal avec le même historique et les mêmes writers.

## Contrôles de droits et de concurrence

L’adaptateur vérifie la bonne occurrence, le type Restaurant, `PATCH_CONTEXT`, les ancres et `PRESERVE`. Les actions sur les postes exigent le socket publié, sa cardinalité, sa capability et un drop admis. Les lignes protégées sont filtrées. La liste des homonymes distingue les cibles et désactive les éditions indisponibles.

Une édition suggérée de supplément conserve la signature de la sélection ouverte. Si cette sélection change entre l’ouverture et la validation, l’écriture est refusée et la saisie RAW est conservée. La protection existante des détails compris vérifie l’identité de l’addition. Le trajet conserve également sa signature avant validation. Les validations passent par les propriétaires et le Compiler existants.

## Vérifications locales

| Suite | Résultat |
| --- | --- |
| `check-restaurant-suggestions.mjs` | 10 groupes PASS. Propositions et provenance, consultation, RAW, 40 € avec détail compris de 6 €, supplément distinct à 46 €, édition exacte, homonymes, masquage, droits, contexte Mobility, refus d’une édition obsolète et non-régression Cinéma S1/S2. |
| `check-composer-restaurant-included-details.mjs` | 16 groupes PASS, dont les protections existantes des identités, tarifs, détails compris et refus propriétaire. |
| `check-composer-v22-a3-restaurant.mjs` | 6 groupes PASS pour participants, RAW, droits, prix inconnu/zéro et absence de writer distant. |
| `check-composer-purchase-basket.mjs` | PASS. Achat multi-articles, frais, compatibilité, Courses, Save/Reload sur le store SQL synthétique PGlite existant. |
| `check-clay-discovery.mjs` | PASS. Les 687 identités restent recherchables et accessibles en contexte, dont 529 concepts Excel, 632 nouveaux maîtres et 55 protégés. |
| Cinéma S1/S2 | Assertions du harnais historique reprises dans RS-10 pour être exécutables depuis ce dépôt. Classement, provenance, homonymes, droits et refus par occurrence. |
| TypeScript et `git diff --check` | PASS. |

Le navigateur intégré a vérifié la proposition Bière au clavier, le digest inchangé après consultation, la conservation de RAW lors d’une navigation annulée, la validation du détail compris, la confirmation du supplément et le masquage sans changement de digest. Undo/Redo a restitué les digests d’avant et d’après le détail compris et conservé la même occurrence. Le masquage et le réaffichage de la suggestion Billet fonctionnent toujours dans Cinéma.

La recette de livraison a rejoué les parcours à 1 280 × 720 et 390 × 844. Le panneau est séparé du Dock par 5,5 px sur ordinateur et 22,1 px dans la scène mobile testée. Le champ du détail reste dans la largeur du panneau mobile. L’ouverture clavier place le focus sur le titre de l’étape. Aucune erreur JavaScript n’a été relevée pendant ce contrôle. Le réglage temporaire de viewport a été réinitialisé.

Les tests React utilisent des portails et références DOM simulés. Le paquet de test signale sa dépréciation. Les tests navigateur utilisent le serveur synthétique existant et des données de fixture. Ils complètent les assertions du Compiler. Cette tranche n’ajoute aucune preuve de sauvegarde authentifiée en Production.

Pour reproduire les tests React, installer `react@19.2.6` et `react-test-renderer@19.2.6` dans un dossier isolé, puis définir `PLANNER_REACT_TEST_TOOLS` vers ce dossier et exécuter les trois scripts Restaurant ci-dessus. Le serveur synthétique existant `scripts/serve-phase2-planner-composer-fixture.mjs` utilise esbuild via `PLANNER_BROWSER_TOOLS` et une feuille globale via `PLANNER_C8_GLOBAL_CSS`. Ses sorties sont dirigées par `PLANNER_C8_BROWSER_OUTPUT` et le port par `PORT`. Les dépendances produit sont inchangées.

## Fichiers modifiés

| Fichier | Rôle |
| --- | --- |
| `src/app/mois-a-venir/composer/restaurant-suggestions.ts` | Adaptateur déterministe Restaurant, classement, provenance et filtres de capacités. |
| `src/app/mois-a-venir/composer/restaurant-editor.tsx` | Dock situé, formulaires existants, choix exact des homonymes et protections de signature. |
| `src/app/mois-a-venir/composer/composer-shell.tsx` | État local de masquage partagé par Cinéma et Restaurant, indexé par occurrence. |
| `src/app/mois-a-venir/composer/composer.module.css` | Espace réservé au Dock et panneau Restaurant mobile. |
| `scripts/check-restaurant-suggestions.mjs` | Dix groupes de tests locaux, dont la non-régression Cinéma. |
| `scripts/check-composer-restaurant-included-details.mjs` | Navigation des tests existants vers les choix complets. |
| `scripts/check-composer-v22-a3-restaurant.mjs` | Même adaptation des tests de participants. |
| `docs/status/P21_RESTAURANT_CONTEXTUAL_SUGGESTIONS.md` | Reçu de cette tranche et cartographie des extensions. |

## Extensions préparées

| Domaine | Déjà disponible | Petit adaptateur possible | Capacité supplémentaire ou différé |
| --- | --- | --- | --- |
| Week-end | Éditeur de séjour, hébergement, transport, postes enfants et propositions « Petit-déjeuner / Taxe de séjour · Examiner pour ce séjour ». | Classement selon les postes déjà choisis et refus locaux par cible. | Les rattachements et services doivent suivre les capacités existantes. La consultation d’une taxe ou d’un petit-déjeuner laisse son montant et sa décision à préciser. |
| Achat | Panier `purchase@v2`, vendeur, articles et frais. | Modifier un article exact ou compléter vendeur/frais selon l’état. | La pertinence de produits complémentaires exige une règle métier identifiée. |
| Mascara | Produit, prix, quantité et besoin de renouvellement lorsqu’il est reconnu. | Proposer l’édition du produit exact ou la configuration manquante. | Déduire automatiquement un renouvellement d’une simple consultation reste différé. |
| Vêtements | Ajout, édition et retrait d’article avec identité stable. | Proposer la ligne existante ou un ajout volontaire dans le panier. | Les suggestions de style ou d’articles assortis demandent des connaissances et règles supplémentaires. |
| Bar / Apéro | Dock spécialisé, boissons et participants. | Réemployer le classement ordinal et les clés de refus si les actions du Dock sont compatibles. | Une refonte de son propriétaire métier n’est pas pertinente pour cette tranche. |

La tranche couvre S1/S2. Une préférence durable ou une personnalisation S3 reste différée. Les 687 identités servent de répertoire de concepts et de médias. Une nouvelle action requiert toujours une capability métier publiée. Aucun blocage de contrat financier ou de persistance n’a été rencontré.
