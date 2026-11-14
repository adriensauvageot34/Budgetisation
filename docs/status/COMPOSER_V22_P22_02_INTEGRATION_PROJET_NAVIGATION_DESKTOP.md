# Composer V22 — P22-02 · Intégration Projet et navigation sur ordinateur

Recette du 14 novembre 2026 · `STRAT:P21-RECENTRAGE@v1`

## 1. Version réelle

| Référence | État vérifié |
|---|---|
| GitHub `main` et base du correctif | `47f73aaffc70f8e5101defef546e138e52e24617`. Référence récupérée depuis GitHub. Branche locale avancée jusqu’à ce commit, dont l’arbre est identique à celui de `a80748c…`. |
| Production | `dpl_58FP9Hn8yECmhcxiFBiosSDwgMg4` READY sur le même SHA. L’alias public pointe vers ce déploiement. |
| [PR #123](https://github.com/adriensauvageot34/Budgetisation/pull/123) | GitHub la renvoie ouverte, hors Draft, `merged=false`, HEAD `a80748c542f4c6a483b4c828e4b17076ac135e70`. Comparaison avec `main` : un commit d’avance pour `main`, zéro commit exclusif à la PR et zéro fichier différent. |
| Branche locale | `codex/p22-02-project-desktop`, checkout `pr123-final-code-review`. |
| SHA final du code testé | `b651e52ed7a5a590a8c22f7d82e2e94ea85657f7`. Le rapport est ajouté dans un commit documentaire séparé. |
| Cadeau | Les deux fichiers modifiés dans le worktree d’origine ont les mêmes empreintes SHA-256 qu’en entrée. Le changement Cadeau de `catalog-context-editor.tsx` concerne le preset à la ligne 89. Le changement Projet porte sur l’attribut de rendu, à la ligne 223. Le banc `check-composer-project-completion.mjs` d’origine a conservé son empreinte. |

Le dépôt d’origine reste sur sa branche historique avec ses deux fichiers Cadeau et ses fichiers non suivis. Le checkout de livraison conserve le rapport P22-01 préexistant hors commit.

## 2. Intégration du correctif

Le patch P22-01 a été retrouvé comme diff local et comme [artefact](<C:/Users/AdrienSauvageot/Documents/Codex/2026-11-06/je-te-confie-la-premi-re/work/repo/outputs/p22-01/p22-01-project-panel.patch>). Ses huit lignes ont été reprises à l’identique. Le panneau Projet confine son contenu dans un seul défilement vertical. Le Dock conserve son emplacement.

| Fichier | Changement |
|---|---|
| `catalog-context-editor.tsx` | Marque les éditeurs de projets ayant un emplacement pour les enfants. |
| `composer.module.css` | Confine le défilement et permet aux textes longs de revenir à la ligne. |
| `composer-shell.tsx` | Conserve l’identité exacte de l’enfant lors du retour explicite au projet. Fermer l’éditeur d’un enfant ramène au projet sur le Board. |
| `linked-intentions.tsx` | Redonne le focus au bouton de l’enfant dans la liste du parent. |
| `workshop-navigation.tsx` | Transmet l’identité de l’enfant au retour, via la navigation existante. |

TypeScript et `git diff --check` PASS. Les modifications sont committées localement. Leur publication et la recette du correctif sur un déploiement distant restent NOT_RUN.

| Dimension de recette | Statut | Écart panneau–Dock |
|---|---|---|
| 1 920 × 1 080 | PASS Chromium | 36 px CSS |
| 1 440 × 900 | PASS Chromium | 36 px CSS |
| 1 280 × 720 | PASS Chromium | 36 px CSS |
| 1 024 × 576 CSS | PASS en viewport simulé, densité 1,25 | 36 px CSS |
| Zoom natif Chrome à 125 % | PASS. Réglage « Zoom de la page » de Chrome dans un profil de test dédié. Mesure réelle 1 024 × 576 CSS, DPR 1,25. Navigation enfant → parent et focus confirmés. | 36 px CSS |

## 3. Navigation des projets

Sur P22-01, revenir de Cinéma au parent demandait déjà un clic. L’action ouvrait le bon projet, mais le bouton Cinéma ne reprenait pas le focus. Après P22-02, le retour prend toujours un clic et le prochain appui sur Entrée rouvre le même enfant. Le sélecteur existant permet de passer de Cinéma à Restaurant, puis de revenir à Cinéma, sans repasser par le parent. Fermer directement Cinéma ramène à la carte du projet sur le Board.

- **Cinéma et restaurant.** Board → projet → Cinéma → parent aux quatre tailles. Changement Cinéma → Restaurant → Cinéma avec les identifiants exacts. La saisie RAW `12,` est conservée après le retour annulé. Une validation à 12,50 € modifie le seul billet et préserve le parent et Restaurant. Après rechargement, les deux relations retrouvent les mêmes identifiants.
- **Week-end et musée.** Board → séjour → Musée → séjour. Le bouton du Musée reprend le focus. La période du 20 au 22 novembre, deux nuits et le tarif fictif de 100 € par nuit ont été enregistrés puis relus après rechargement. La sélection d’hébergement et l’identité du Musée sont conservées.
- **Projet Maison.** Board → parent → panier → parent. Le projet de la fixture conserve son panier et son article synthétique à 22 € après sauvegarde et rechargement. Le parent et l’identité de la ligne sont vérifiés.

Les passages de consultation contrôlés comparent le digest, la copie durable du Draft et les écritures de la fixture avant/après. Les contrôles montrent zéro mutation pendant ces gestes. La relecture vérifie le même reçu de sauvegarde et les mêmes occurrences. Les montants et capacités restent sous leurs propriétaires existants.

## 4. Scénarios complémentaires

| Scénario | Verdict | Preuve et portée |
|---|---|---|
| Maison et panier | LOCAL_PASS | Modèle admis, enfant accessible, retour au parent, prix et identité de ligne relus dans Chromium C8. |
| Équipement déjà possédé | NON_IMPLANTÉ dans le contrat Projet Maison inspecté | Le registre expose équipements à prévoir, services, achats liés et transport. Aucun champ ou état explicite d’équipement possédé n’est publié pour ce projet. |
| Restaurant S3 | LOCAL_PASS | Consultation et écran de confirmation à digest identique. Double clic de confirmation testé. Un seul Restaurant rattaché au bon projet, puis accès et retour au parent. Undo retrouve le digest sans Restaurant. Redo rétablit le même digest et le même identifiant de Restaurant. Le rechargement relit un seul enfant de ce type. Le banc S3 couvre aussi l’invalidation d’une confirmation devenue obsolète. |
| Séjour et Musée | LOCAL_PASS | Hébergement, période et enfant relus. Les champs de réservation et paiement restent hors du contrat et de la recette. |

Les dix parcours de la campagne principale ont réussi. Le zoom natif, la fermeture directe sur le Board et la période du séjour ont aussi été contrôlés. Bancs existants PASS : familles de projets, Project Completion/S3, navigation des enfants de séjour et Bibliothèque A2.

Preuves : [avant, retour sans focus](<C:/Users/AdrienSauvageot/Documents/Codex/2026-11-06/je-te-confie-la-premi-re/work/repo/outputs/p22-02/before/results.json>) · [recette principale](<C:/Users/AdrienSauvageot/Documents/Codex/2026-11-06/je-te-confie-la-premi-re/work/repo/outputs/p22-02/final/results.json>) · [fermeture directe](<C:/Users/AdrienSauvageot/Documents/Codex/2026-11-06/je-te-confie-la-premi-re/work/repo/outputs/p22-02/close-board-v2/results.json>) · [période du séjour](<C:/Users/AdrienSauvageot/Documents/Codex/2026-11-06/je-te-confie-la-premi-re/work/repo/outputs/p22-02/stay-dates-v2/results.json>) · [zoom natif](<C:/Users/AdrienSauvageot/Documents/Codex/2026-11-06/je-te-confie-la-premi-re/work/repo/outputs/p22-02/zoom-native.log>) · [capture du zoom](<C:/Users/AdrienSauvageot/Documents/Codex/2026-11-06/je-te-confie-la-premi-re/work/repo/outputs/p22-02/zoom-chrome-125.png>) · [capture Projet Maison](<C:/Users/AdrienSauvageot/Documents/Codex/2026-11-06/je-te-confie-la-premi-re/work/repo/outputs/p22-02/final/maison-panier-projet-1280.png>).

## 5. Défauts résiduels et limites

- **Bug confirmé sur la version publique.** Le débordement Projet/Dock de P22-01 est corrigé sur la branche locale. Le déploiement public sert encore la base.
- **Capacité métier absente.** Le Projet Maison dispose d’un parcours d’équipement à prévoir. Un état dédié à l’équipement déjà possédé relève d’une décision produit distincte.
- **Recette distante.** Save/Reload authentifié du nouveau code NOT_RUN faute de périmètre de recette synthétique distant autorisé. La persistance locale C8 est effectivement testée. Les preuves historiques sur l’ancien code restent datées.
- **Amélioration facultative.** Une mesure de temps de navigation avec un projet beaucoup plus chargé resterait un autre scénario. La recette actuelle valide le geste au clavier et les destinations exactes.

## 6. Synthèse

Le panneau de projet et son Dock restent utilisables séparément sur ordinateur, y compris au zoom natif de 125 %. Lorsqu’on revient au projet, l’activité quittée est immédiatement accessible au clavier. Les recettes locales vérifient la reprise du panier Maison, de l’hébergement du week-end et du Restaurant ajouté par suggestion.

La branche locale est prête pour une revue ciblée du diff UI. Finance V2, Compiler, droits, Draft, World et contrats métier n’entrent pas dans le diff. Les fixtures sont synthétiques. Aucun Apply, aucune écriture distante et aucun déploiement n’ont été effectués.
