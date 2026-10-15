# L0 + L1 — Restaurant guidé dans Composer V3

Date : 15 octobre 2026. Verdict : **`L1_IMPLEMENTED_NOT_RELEASED`**.

La fonctionnalité Restaurant est implémentée sur la branche `codex/composer-v3-l1-restaurant` et proposée dans la [PR #43](https://github.com/adriensauvageot34/Budgetisation/pull/43), laissée en brouillon. Le code final `4d85b74351c5a6d40a1d5e4f8c690260a56ca9d5` a une Preview Vercel `READY` et un build Next complet réussi. Le test navigateur authentifié de cette Preview et la vérification des autres tailles d'écran ont été interrompus par une **limite d'usage de la revue automatique**. L'action navigateur refusée n'a pas été exécutée. Aucun merge ni déploiement Production n'a été effectué.

## A. État initial

La branche part de `main` au commit `d965d54713c20d3ab614e3fe730ee70af2876ea8`, également observé comme version Production au départ. Restaurant existait déjà comme Context, avec les slots `meal`, `extras`, `transport`, les options du catalogue, le Compiler/Finance V2, CardKnowledge et la persistance générique du Draft. Son édition utilisait le formulaire de catalogue commun ; elle ne guidait pas les décisions liées au Restaurant. Aucun SQL, schéma ou owner financier n'a été modifié dans L1.

## B. L0 — écarts ciblés

| Capacité | État initial | Action L1 |
|---|---|---|
| Context et slots économiques | Existant | Réutilisation des slots et identités. |
| Participants, lieu et date | Partiel | Choix guidés ; absence de lieu ou date conservée. |
| Addition globale | Partiel | Une seule ligne de repas, quantité partagée 1. |
| Détail et compléments | Partiel | Ligne de repas et composants `extra` distincts ; remplacement confirmé entre les deux représentations. |
| Transport | Partiel | Option du catalogue et éditeur existants ; changement de mode remplace l'intention incompatible. |
| Enveloppe / supplément | Existant dans le Compiler, partiel dans l'UX | Choix explicite `CONFIRMED_CONSUMPTION` ou `EXTRA_TO_SLOT` ; admission financière par Compiler/V2. |
| Palette conditionnelle | Manquant | Questions puis compléments et accès aux autres options. |
| Réédition rapide | Manquant | Résumé des décisions, chaque rubrique réouvrable. |
| Draft, Undo/Redo, Preview | Existant | Opération sémantique Restaurant intégrée au même pipeline. |
| SNAP-3 et CardKnowledge | Existant | Référence affichée selon son admissibilité ; aucun nouveau lecteur ou artifact. |

## C. L1 — parcours réalisé

L'ajout de la carte au Board reste immédiat. Un éditeur latéral chargé à la demande accompagne les étapes participants, lieu, date, budget et relation à l'enveloppe. Le Restaurant reste visible sur le Board, même s'il appartient à un cluster. La palette basse présente les choix utiles à l'étape courante, les compléments et les transports admissibles, avec un accès aux autres options. Fermer le panneau conserve les décisions validées dans le Draft et n'applique pas le mois.

Le budget peut être une addition globale ou un repas détaillé avec compléments. Un changement de représentation demande confirmation, puis remplace atomiquement les slots concernés ; un total parent ne s'ajoute pas aux lignes enfants. Une proposition CardKnowledge peut être reprise par un clic explicite. L'édition d'un montant conserve les autres champs, les identités, les composants et les valeurs inconnues. Le résumé permet la réédition directe, sans refaire le parcours de création.

La mutation pure `EDIT_RESTAURANT` est admise par le même service de Composer, avec les contrôles de scope, de références et de protection des cartes existants. Les anciens Plans restent lisibles avec `context-fields@v2` ; aucune nouvelle version de schéma n'était nécessaire.

## D. Réutilisations

Le lecteur de personnes `PlannedContactField`, le lecteur de lieux `PlannedPlaceField`, `ComponentRow` et ses adaptateurs, la Library, les sockets, CardKnowledge, le Draft local/durable, le scheduler Preview, le Compiler et Finance V2 sont réutilisés. La logique de « prochaine question sans réponse » est partagée avec le moteur de questions existant. L'éditeur Restaurant est un chunk séparé chargé seulement à l'ouverture de la carte.

La relation couverte/supplémentaire est une décision sémantique, pas un calcul React. La mobilité facultative conserve son intention et sa provenance lorsque le mode et le trajet restent compatibles. Une nouvelle option incompatible écarte les anciens coûts de carburant, de billet ou d'itinéraire.

## E. UX et captures

Le navigateur sur **fixture isolée**, React compilé en mode production, a servi à ajouter un Restaurant, sélectionner les deux personnes de la fixture, laisser lieu et date inconnus, choisir 60 €, puis « Une dépense en plus ». Après fermeture et rechargement, le résumé a restitué ces choix. Un montant changé à 70 € a conservé les autres réponses. Le passage au détail a ensuite permis un repas de 40 € et un complément de 20 €. Le statut `SAVED` et une Preview `FRESH` ont été observés sur cette fixture après les décisions. Le bouton de fermeture a été rendu visible en haut du panneau lors du défilement.

Captures : [Board initial](evidence/l0-l1-composer-restaurant/01-board-before.png), [participants](evidence/l0-l1-composer-restaurant/02-participants.png), [lieu/palette](evidence/l0-l1-composer-restaurant/03-place-palette.png), [total](evidence/l0-l1-composer-restaurant/04-budget-total.png), [composants](evidence/l0-l1-composer-restaurant/05-components.png), [résumé de réédition](evidence/l0-l1-composer-restaurant/06-reedit-summary.png), [Board configuré](evidence/l0-l1-composer-restaurant/07-board-configured.png).

**Limite des tailles :** l'outil a annoncé des tentatives 1440, 1920, 768 et 375 px, mais la lecture du DOM a donné `clientWidth=1728` à chaque essai. Les captures prouvent seulement 1728 × 900. Le fichier [viewport-checks.json](evidence/l0-l1-composer-restaurant/viewport-checks.json) conserve les valeurs brutes, et ces quatre autres tailles restent `NOT_RUN` au sens de la certification.

## F. Vérité financière

La suite [Restaurant](evidence/l0-l1-composer-restaurant/contract-tests-final.log) passe 15 groupes déterministes sur PGlite synthétique. Elle couvre une intention unique pour deux personnes, 60 € globaux, 40 € + 20 € détaillés sans parent additionnel, 60 € → 70 € avec conservation, `UNKNOWN` distinct de zéro, les relations couverte/supplémentaire, un Restaurant enfant d'un Séjour, et le remplacement voiture → train. Elle refuse les références étrangères et les mutations de carte protégée. La comparaison des manifests, scénarios et digests est identique pour une même intention. La [parité historique 22 × 9](evidence/l0-l1-composer-restaurant/financial-parity.log) passe. Il n'y a eu aucune écriture distante ni Apply réel.

## G. Draft, Preview et Apply

La fixture navigateur a montré la sauvegarde `SAVED`, le rechargement et la réédition. Les tests PGlite montrent le round-trip du Draft, Undo/Redo, variante temporaire, Apply C0 sur base **isolée**, relecture Mon Plan et refus d'Apply obsolète. Les régressions du scheduler et de l'API Draft simulée passent. Ces preuves ne valent ni test RLS Supabase authentifié ni Apply dans un Plan personnel. Le chemin Apply/CAS existant n'a pas été modifié par L1.

## H. SNAP-3 et performance

L1 n'a ajouté ni lecture World historique, ni publication, ni trigger, ni migration SNAP-3. Les valeurs CardKnowledge affichées sont celles du modèle déjà lu. L'état de configuration Production connu au préflight indiquait SNAP-3 activé ; une admission Canonical/M7 réelle sur le nouveau code n'a pas été mesurée. Les digests des fixtures et le golden financier passent.

Sur la même fixture et avec le même assemblage `esbuild` pour la **partie cliente**, le bundle initial est passé de 350 235 à 327 438 octets bruts et de 107 726 à 101 118 octets gzip. L'éditeur Restaurant ajoute un chunk à la demande de 20 872 octets bruts : [bundle-comparison.json](evidence/l0-l1-composer-restaurant/bundle-comparison.json). Cette mesure ne représente pas la taille totale du build Next ni un gain d'ouverture utilisateur.

Une navigation candidate de fixture à 1728 px a donné 2 254,7 ms jusqu'au Board et 2 254,8 ms jusqu'à `FRESH`, un seul échantillon avec temporisation de lecture et instrumentation de fixture : [browser-final-state.json](evidence/l0-l1-composer-restaurant/browser-final-state.json). Une première observation de référence de 8 022 ms et une première observation candidate de 1 401 ms ont des états d'initialisation différents. **Aucune comparaison avant/après fiable, aucun P50/P95, aucun gain réel de lecture World ou de réseau n'est certifié.** Les mesures supplémentaires ont été arrêtées par la limite de revue automatique.

## I. Contrôles

| Contrôle | Résultat | Portée |
|---|---|---|
| L1-01 à 19, 21 à 25 | `PASS_FIXTURE` | 15 groupes Restaurant, PGlite synthétique, contrats et Compiler. L1-17/18/19 sont contractuels, pas tous rejoués en navigateur réel. |
| L1-20 Preview obsolète | `PASS_FIXTURE` | Scheduler existant ; parcours de plusieurs éditions rapides non certifié sur la Preview déployée. |
| L1-26 clavier, focus, tailles | `PARTIAL` | Interaction et captures à 1728 × 900 ; autres tailles et contrôle clavier complet `NOT_RUN`. |
| L1-27 autres Contexts | `PARTIAL` | Catalogue P12 et B3 ciblés passent ; trois anciens harness de rendu/écriture échouent, voir ci-dessous. |
| TypeScript | `PASS` | [typecheck final](evidence/l0-l1-composer-restaurant/typecheck-final.log). |
| Build Next du commit final | `PASS` | Preview `dpl_6Y3FMGCkXdp7c4fRX2vYVDQ33M34` `READY`, build terminé, statut GitHub Vercel `success` : [preuve](evidence/l0-l1-composer-restaurant/preview-final-build.json). |
| C8-017, P02, Kernel, P13, B3, catalogue P12 | `PASS` | Journaux dans le dossier de preuves. |
| Navigateur authentifié Preview, Plan réel, smoke Production | `NOT_RUN` | Limite d'usage de la revue automatique ; Production inchangée. |

Trois régressions lancées échouent et restent **visibles** :

- [C8 complet](evidence/l0-l1-composer-restaurant/c8.log) : l'assertion C8-018 attend `PLAN_V3_ACTIVE_READ_ONLY`, la fixture obtient `MONTH_WRITE_FAILED`. C8-017 passe séparément. Aucun writer MonthInputs n'a été modifié par L1.
- [P11](evidence/l0-l1-composer-restaurant/targeted-2.log) : les contrôles métier passent jusqu'à une assertion de copie « tarif par nuit » absente du rendu B2 courant.
- [P05-B](evidence/l0-l1-composer-restaurant/targeted-3.log) : les contrôles de conservation passent jusqu'à une assertion sur le libellé « Achat · Cadeau · Livre » absent du rendu B2 courant.

Ces échecs de harness sont compatibles avec des attentes anciennes de présentation/fixture ; leur statut sur le commit de base n'a pas été rejoué pendant L1. Ils ne sont donc ni effacés ni déclarés « régressions préexistantes prouvées ».

## J. Livraison et reprise

Branche : `codex/composer-v3-l1-restaurant`. Commits produit : `322a5e13192e5670c97031ff099861281c518b9a`, puis `4d85b74351c5a6d40a1d5e4f8c690260a56ca9d5`. PR [#43](https://github.com/adriensauvageot34/Budgetisation/pull/43) en brouillon. [Preview finale](https://budgetisation-57qj7ry3g-adriensauvageot34-6137s-projects.vercel.app) `READY`. Production reste sur `d965d54713c20d3ab614e3fe730ee70af2876ea8` selon le dernier contrôle effectué ; aucun changement de configuration Production.

Le blocage immédiat est la limite d'usage de la revue automatique sur l'opération navigateur. Une fois l'accès revenu, la suite minimale est : ouvrir la Preview finale avec une session authentifiée, vérifier ajout/édition/fermeture/reprise du Draft, Preview et absence d'erreur ; tester les tailles réellement demandées à leur largeur effective ; mesurer une petite paire comparable base/candidat. Si ces gates essentiels passent et que les trois échecs de harness sont qualifiés, la PR peut passer en revue puis être fusionnée. Le rollback du code se ferait par retour au commit Production précédent ; aucun rollback SQL n'est nécessaire.

## K. Suite L2

Le patron « décision guidée + palette pertinente + résumé rééditable + slots atomiques » pourra être réutilisé pour Soirée techno, Uber Eats, vêtements, Visite familiale, activité/pêche et Library enrichie. Ce rapport n'autorise ni n'entame L2.

**Verdict détaillé :** UX Restaurant `IMPLEMENTED` ; contrats financiers `PASS_FIXTURE` ; Draft et Preview `PASS_LIMITED_FIXTURE` ; SNAP-3 réel et performances `NOT_CERTIFIED` ; build Preview `PASS` ; navigateur Preview authentifié `NOT_RUN` ; Production `UNCHANGED`. **`L1_IMPLEMENTED_NOT_RELEASED`.**
