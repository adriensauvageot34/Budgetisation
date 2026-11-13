# Passation finale du méga-run Composer V22 / P21

Document établi le 13 novembre 2026, à partir de la PR #123 et de son HEAD applicatif `81c5d12df2d879f2dd082803ef6c9f8629ff4c24`.

Le propriétaire a arrêté le développement. Cette passation clôture le run. Toute nouvelle intervention sur le produit attend un nouveau mandat.

## 1. État Git et périmètre arrêté

| Élément | État vérifié |
| --- | --- |
| Dépôt | `adriensauvageot34/Budgetisation` |
| PR | [#123](https://github.com/adriensauvageot34/Budgetisation/pull/123) |
| Branche | `codex/p21-mega-run-composer-v22` |
| État GitHub | OPEN, Draft, non fusionnée |
| HEAD applicatif poussé | `81c5d12df2d879f2dd082803ef6c9f8629ff4c24` |
| Base `main` de la comparaison GitHub | `2e6febec5c9e56aaca76174c62d421157b4d44ef` |
| Diff applicatif et journal avant cette passation | 118 commits, 65 fichiers, 4 371 lignes ajoutées, 365 supprimées |
| Reprise intermédiaire historique | `6cb91f4079f55dffca4827f635cbb96b53b6b44a`, suivi de 77 commits jusqu’au HEAD applicatif |
| Fusionnabilité à la lecture GitHub | `mergeable=true` |
| Certification de livraison | Non accordée. La PR reste Draft |
| Production et Preview finales | Aucun nouveau contrôle de déploiement exécuté pour cette clôture |

Les 65 noms de fichiers du patch GitHub ont été récupérés sur toutes les pages et rapprochés du diff local de la même base. Les annexes donnent le périmètre exact et l’historique des 118 commits.

Cette livraison ajoute uniquement le présent fichier et son commit documentaire au HEAD applicatif indiqué. Le commit contenant ce document est le HEAD documentaire de clôture. Son identifiant est communiqué dans le compte rendu final et peut être retrouvé avec `git log -1 --format=%H -- docs/status/P21_MEGA_RUN_FINAL_HANDOFF.md`.

La description actuelle de la PR parle encore de huit modèles. Le registre livré en contient seize. La description devra être alignée sur cette passation lors de la préparation de revue.

### État local au STOP

Deux fichiers suivis comportent une tranche commencée avant l’arrêt, avec 18 ajouts et une suppression au total.

| Fichier | Contenu local absent du HEAD applicatif |
| --- | --- |
| `src/app/mois-a-venir/composer/catalog-context-editor.tsx` | Une ligne propose le preset Cadeau dans les associations d’un projet composé |
| `scripts/check-composer-project-completion.mjs` | Vérification supplémentaire de coût après rattachement, scénario Cadeau et annonce d’un treizième groupe de contrôles |

Cette tranche reste non commitée et hors de la PR. Elle ne fait pas partie des fonctionnalités livrées ci-dessous. Les processus TypeScript et du banc de projets lancés avant le STOP ont été interrompus. Leur résultat complet est `INTERRUPTED`, et le treizième contrôle est `NOT_RUN_TO_COMPLETION`.

Le répertoire préexistant `outputs/` reste non suivi. Il contient notamment l’outillage local des fixtures React. Son contenu n’a pas été intégré à Git.

Aucun code applicatif n’a été modifié après l’ordre d’arrêt. Les changements locaux préexistants sont conservés pour une décision ultérieure du propriétaire.

## 2. Ce que permet la version développée

Composer permet de retrouver une intention déjà préparée, de l’ouvrir par son identité, de compléter ses postes, puis de revenir au projet qui la contient. Les projets possèdent une navigation entre parents et enfants et présentent les coûts individuels publiés par le Compiler.

Un utilisateur peut démarrer depuis un modèle, choisir ses compléments facultatifs, nommer le projet et renseigner une date du mois. La composition passe par l’évaluateur existant. Elle n’entre dans le Draft visible qu’une fois toutes les étapes admises, avec une entrée d’historique commune.

Le catalogue Clay sert aussi d’accès aux éditeurs. Un produit compatible peut préparer un panier ou une ligne d’un panier existant. Une activité peut être associée à un projet après confirmation. Si une occurrence correspondante est déjà liée, le catalogue permet de l’ouvrir. Si elle existe à la racine du Board, le catalogue peut proposer son rattachement avec conservation de ses postes.

Les suggestions décrivent le contenu réellement présent. L’utilisateur peut les consulter, les masquer ou les désactiver pour la session. Leur adoption reste une décision explicite.

Ces comportements ont des preuves locales ciblées. La certification navigateur complète, authentifiée et Production reste à réaliser.

## 3. Inventaire fonctionnel par domaine

| Domaine | Développements intégrés | Références principales | État |
| --- | --- | --- | --- |
| Draft | Reprise d’une occurrence du Draft confirmé dans le même foyer et mois, contrôle du digest et de l’identité du Draft, messages de sauvegarde, relecture d’un conflit avec conservation des choix locaux, vérification des reçus CAS et du réessai après perte de réponse | `draft-navigation-memory.ts`, `durable-draft.ts`, `draft-http-transport.ts`, `composer-save-status.tsx`, `composer-shell.tsx` | IMPLEMENTED_WITH_TARGETED_CHECKS |
| Activités | Tarif ou coût global, quantité lorsque le poste l’admet, participants, date, lieu, compléments distincts, transport admis, réouverture exacte et coût officiel. 24 presets Activity, dont Cinéma, plus l’activité libre | `composer-presets.ts`, `restaurant-editor.tsx`, `guided-asset-labels.ts`, `catalog-context-editor.tsx` | IMPLEMENTED_WITH_TARGETED_CHECKS |
| Beauté | Dix intentions dans l’éditeur commun de prix et quantité, reprise exacte, RAW, UNKNOWN, zéro explicite et illustrations existantes. Les quatre soins supplémentaires utilisent le visuel du preset lorsqu’aucun asset canonique ne fournit ce visuel | `beauty-product-edit.ts`, `equipment-component-editor.tsx`, `context-palette.tsx` | IMPLEMENTED_WITH_TARGETED_CHECKS |
| Mobility | Rubriques trajet, frais, financement, horaires et partage. Parking ciblé d’une voiture choisie. Montant du trajet complet et frais du propriétaire partagé explicités | `mobility-fields.tsx`, `restaurant-editor.tsx`, `workshop-component-row.tsx` | IMPLEMENTED_WITH_TARGETED_CHECKS |
| Projets composés | Association de plusieurs intentions, ouverture d’un enfant, retour au parent, déplacement entre projets admis, confirmation de la portée d’un retrait, compteurs et recherche des enfants, coûts individuels et diagnostics | `linked-intentions.tsx`, `asset-editor-routing.ts`, `catalog-context-editor.tsx`, `short-stay-editor.tsx` | IMPLEMENTED_WITH_TARGETED_CHECKS |
| Projets libres | Projets Maison, visites amicales et familiales, séjours et autres projets sans preset retrouvables. Associations et suggestions fondées sur le type et les capacités publiées | `composer-library-index.ts`, `composer-library.tsx`, éditeurs de projet | IMPLEMENTED_WITH_TARGETED_CHECKS |
| Modèles | Seize modèles, aperçu, nom, date facultative du parent, compléments facultatifs, disponibilité, structures du mois déjà présentes, refus des reçus incohérents ou incomplets | `project-starters.ts`, `project-starter-preview.tsx`, `composer-shell.tsx` | IMPLEMENTED_WITH_TARGETED_CHECKS |
| Paniers | Panier générique ou spécialisé, recherche par article, concept ou vendeur, filtre des prix manquants et réinitialisation, numéros stables des homonymes, nom du panier, date bornée au mois, livraison et suppléments, ouverture exacte d’une ligne | `purchase-basket-editor.tsx`, `purchase-basket.module.css`, `purchase-basket.ts` | IMPLEMENTED_WITH_TARGETED_CHECKS |
| Catalogue | Recherche des 687 identités, synonymes d’activités existants, préparation de paniers compatibles, ouverture des lignes existantes, préparation d’un produit dans un panier existant, focus et reprise après échec de chargement | `catalog-discovery.ts`, `catalog-discovery-provider.tsx` et styles | IMPLEMENTED_WITH_TARGETED_CHECKS |
| Catalogue des projets | Sélecteur partagé d’activités pour sorties composées, séjours et visites. Réouverture d’un enfant ou rattachement confirmé d’une activité racine, avec choix exact des homonymes | `project-activity-catalog.tsx` | IMPLEMENTED_WITH_TARGETED_CHECKS |
| S3 | Compléments de sortie, culture/nature et repas du séjour, Courses d’une location, panier d’équipement Maison, déclinaison pour projets libres. Priorité repas/activités, quatre propositions visibles au plus, masquage et activation en session | `project-completion.tsx` | IMPLEMENTED_WITH_TARGETED_CHECKS |
| UX et Board | Espaces À ajouter, Mes intentions et À piloter, filtres projets/paniers/consultation/complétude, navigation par projet, clavier, retour de focus, dates anciennes invalides lisibles, droits d’édition, résumés périmés masqués | `composer-library.tsx`, `context-card.tsx`, `workshop-navigation.tsx`, `display.ts`, styles | IMPLEMENTED_WITH_TARGETED_CHECKS |
| Lecture budgétaire | Impact individuel, sous-total connu lorsque publié, périmètre parent/enfant, diagnostics exacts, accès aux sources du mois, distinction résultat courant et périmé | `intent-budget-impact.tsx`, `intent-diagnostics.ts` | IMPLEMENTED_WITH_TARGETED_CHECKS |

Le module historique `mascara-edit.ts` est renommé `beauty-product-edit.ts` dans ce diff. Les imports concernés font partie du même périmètre de revue.

Les noms de fichiers de cette table sont relatifs au répertoire Composer, sauf les registres de domaine situés dans `src/domain/phase2/planner/`.

### Autorités et limites des coûts

Les montants évalués sont lus dans les résultats officiels et associés au digest du Draft. L’interface ne construit pas de total financier consolidé de projet. Les frais compris, postes distincts, financement déclaré et couverture Courses conservent leurs contrats existants.

Le changement de domaine applicatif `purchase-basket.ts` ajoute un nom facultatif à `SET_DETAILS`, avec conservation des anciens appels. Il doit faire partie de la revue de compatibilité.

Le diff arrêté ne comporte aucun fichier de `src/server/`, migration, RLS, configuration Auth, package ou lockfile. Le Compiler et Finance V2 gardent leur autorité. Les modifications client de sauvegarde et les commandes de panier méritent néanmoins une revue spécifique.

Les parcours financiers historiques Restaurant, Cinéma, Amazon et Courses ont leurs preuves antérieures décrites dans le contexte du projet. Ces preuves ne certifient pas automatiquement les nouveaux éditeurs et relations de la PR #123.

## 4. Modèles effectivement présents au HEAD applicatif

Registre de référence `src/app/mois-a-venir/composer/project-starters.ts`.

| Clé | Libellé utilisateur | Structure requise | Compléments facultatifs et sockets |
| --- | --- | --- | --- |
| `cinema-dinner` | Cinéma et restaurant | `composed-outing` | `cinema`, `restaurant-for-two` dans `children` |
| `weekend-culture` | Week-end et musée | `weekend-gite` | `museum-exhibition` dans `activities` |
| `weekend-outdoors` | Week-end et randonnée | `weekend-gite` | `hiking-nature` dans `activities` |
| `games-basket` | Achat de jeux et accessoires | `video-game-purchase` | Aucun enfant, panier vide |
| `visit-and-activity` | Visite et activité | `visit-friends` | `museum-exhibition` dans `activities` |
| `weekend-discovery` | Week-end culture et nature | `weekend-gite` | `museum-exhibition`, `hiking-nature` dans `activities` |
| `hotel-and-culture` | Hôtel et sortie culturelle | `hotel-night` | `museum-exhibition` dans `activities` |
| `relatives-and-nature` | Séjour chez des proches et balade | `stay-with-relatives` | `hiking-nature` dans `activities` |
| `bowling-and-dinner` | Bowling et restaurant | `composed-outing` | `bowling`, `restaurant-for-two` dans `children` |
| `friends-and-escape` | Visite amicale et escape game | `visit-friends` | `escape-game` dans `activities` |
| `hotel-and-dinner` | Hôtel, musée et restaurant | `hotel-night` | `museum-exhibition` dans `activities`, `restaurant-for-two` dans `restaurants` |
| `weekend-groceries-and-walk` | Week-end, courses et balade | `weekend-gite` | `groceries-purchase` dans `purchases`, `hiking-nature` dans `activities` |
| `home-furnishing-and-basket` | Aménager une pièce et préparer ses achats | `furnish-room` | `home-equipment-basket` dans `purchases` |
| `friends-and-laser-game` | Visite amicale et laser game | `visit-friends` | `laser-game` dans `activities` |
| `hotel-and-zoo` | Hôtel et visite au zoo | `hotel-night` | `zoo-visit` dans `activities` |
| `clothing-and-beauty-shopping` | Shopping vêtements et beauté | `composed-outing` | `clothing-shopping`, `beauty-purchase` dans `children`, deux paniers vides |

La présence dans le registre n’accorde aucun droit de création. La bibliothèque et l’évaluateur vérifient les capacités disponibles. Les prix, dates des enfants, participants et trajets restent à choisir. Un séjour chez des proches ne déclare aucune gratuité.

## 5. Activités et intentions spécialisées disponibles

Registre de référence `src/domain/phase2/planner/composer-presets.ts`.

### Activités

Il existe 24 presets `activity`, dont Cinéma. Le message « 23 activities » du banc de parcours compte les 23 activités hors Cinéma, celui-ci étant exercé dans les parcours existants. L’activité libre reste également disponible sous son contrat générique.

| Clé | Libellé | Visuel de référence |
| --- | --- | --- |
| `cinema` | Cinéma | Preset Clay historique |
| `fishing-day` | Journée pêche | Preset Clay historique |
| `hiking-nature` | Randonnée / Nature | Preset Clay historique |
| `beach-day` | Journée plage | Preset Clay historique |
| `spa-relax` | Spa / Détente | Preset Clay historique |
| `concert` | Concert | Preset Clay historique |
| `ropes-course` | Accrobranche | Preset Clay historique |
| `museum-exhibition` | Musée / Exposition | Preset Clay historique |
| `bowling` | Bowling | `v22-art:excel:342` |
| `karting` | Karting | `v22-art:excel:345` |
| `escape-game` | Escape game | `v22-art:excel:343` |
| `mini-golf` | Mini-golf | `v22-art:excel:348` |
| `billiards` | Billard | `v22-art:excel:349` |
| `pool` | Piscine | `v22-art:excel:354` |
| `canoe-kayak` | Canoë / Kayak | `v22-art:extra:kayak-activity` |
| `theme-park` | Parc d’attractions | `v22-art:extra:themepark-activity` |
| `live-show` | Spectacle | `v22-art:extra:show-activity` |
| `sport-match` | Assister à un match | `v22-art:extra:match-activity` |
| `creative-workshop` | Atelier créatif | `v22-art:excel:362` |
| `photo-outing` | Sortie photo | `v22-art:extra:photo-activity` |
| `laser-game` | Laser game | `v22-art:excel:344`, carré |
| `trampoline-park` | Parc de trampolines | `v22-art:excel:347`, carré |
| `water-park` | Parc aquatique | `v22-art:excel:337`, carré |
| `zoo-visit` | Visite au zoo | `v22-art:excel:338`, carré |

Les exports Clay existants sont réutilisés. Cette PR ne régénère pas les maîtres et ne modifie pas le catalogue public des 687 identités. Les 529 concepts issus du catalogue Excel sont des métadonnées publiques de découverte, séparées du classeur et des profils privés.

### Beauté

Les dix clés enrichies sont `mascara`, `eyeliner`, `eyebrow-pencil`, `hair-wax`, `face-cleanser`, `makeup-remover`, `facial-toner`, `face-serum`, `face-moisturizer` et `care-lotion`.

Elles représentent Mascara, Eyeliner, Crayon à sourcils, Cire coiffante, Nettoyant visage, Démaquillant, Toner / Tonique, Sérum visage, Crème hydratante et Lotion de soin. Les prix et quantités passent par le propriétaire Beauté existant. Le preset ne certifie aucun SKU, stock ou cycle de renouvellement.

### Achats et autres familles

Les points d’entrée conservés comprennent Amazon, SHEIN, AliExpress, Vêtements, Chaussures, Jeu vidéo et les consommables Maison. Le panier générique permet de préparer les produits admissibles des autres familles commerciales.

Trois raccourcis complémentaires sont `home-equipment-basket`, `groceries-purchase` et `beauty-purchase`. Le projet Maison `furnish-room` expose équipements, prestations et achats selon les capacités publiées.

Restaurant, restauration rapide, livraison de repas, soirées, cadeaux et références externes de Coiffeur conservent leurs propriétaires et leurs éditeurs. Au HEAD arrêté, un cadeau existant peut déjà être rattaché par les relations admises. Le bouton de création « Ajouter Cadeau » commencé localement reste hors de la PR.

## 6. Complétude et blocages

| Fonction ou limite | État au STOP | Conséquence |
| --- | --- | --- |
| Fonctionnalités des sections 3 à 5 | IMPLEMENTED_WITH_TARGETED_CHECKS | Prêtes pour une revue ciblée, certification finale ouverte |
| Total consolidé de projet | PARTIAL | Coûts individuels et sous-totaux officiels affichés. Le Compiler ne publie pas le total de projet demandé |
| Détachement d’un enfant vers la racine | BLOCKED | Aucun contrat sûr disponible. `CLEAR_SOCKET` retire les descendants et ne constitue pas un détachement conservateur |
| Relations racines N1 et Before | BLOCKED | Gates et chemin durable historiques fermés. PR #98 et Draft PR #102 restent des références séparées |
| Actions sur chaque concept Clay | PARTIAL | Les 687 identités sont recherchables. Les actions sont proposées uniquement lorsqu’un propriétaire et une capacité les admettent |
| Prix, personnes, lieux et transports inconnus | À renseigner par choix utilisateur | Aucun tarif, trajet, participant ou montant nul adopté automatiquement |
| Preview financière distante FRESH sur les nouvelles compositions | NOT_RUN | La disponibilité des sources du mois et la session autorisée restent à vérifier pendant une future recette |
| Diagnostic historique `FINANCIAL_SCENARIO_UNRESOLVED` | Hors de ce chantier | Le run n’a pas modifié les déclarations mensuelles pour forcer FRESH |
| Recette authentifiée, navigateur complet et Production | NOT_RUN | Aucun verdict READY_FOR_MERGE ou certification Production |
| Bouton Cadeau commencé à l’arrêt | PARTIAL_LOCAL_UNCOMMITTED | Deux fichiers locaux à arbitrer avant une future reprise |

## 7. Preuves de validation disponibles

Aucune campagne n’a été lancée pour rédiger cette passation. Les résultats ci-dessous viennent des exécutions antérieures à l’arrêt et du journal. Les contrôles locaux exécutent des propriétaires et des fixtures, avec DOM simulé ou rendu statique selon le script.

| Contrôle | Résultat acquis | Portée et réserve |
| --- | --- | --- |
| TypeScript via `node node_modules/typescript/bin/tsc --noEmit` | PASS aux checkpoints livrés | Le dernier processus démarré sur la tranche Cadeau a été interrompu. Aucun PASS global nouveau après le STOP |
| `git diff --check` | PASS aux checkpoints | Contrôle de diff, sans preuve visuelle |
| `check-composer-journey-ux.mjs` | PASS, dix groupes | Seize modèles, 23 activités hors Cinéma, montants officiels, identités, refus de reçus incomplets et atomicité sur fixture |
| `check-composer-project-completion.mjs` au HEAD livré | PASS, douze groupes | S3, droits, confirmations obsolètes, refus local, catalogue des projets/séjours/visites, rattachement du second homonyme et conservation des postes |
| Même script dans le working tree Cadeau | INTERRUPTED | Les premiers groupes ont produit des PASS. Aucun résultat terminal acquis, treizième groupe non certifié |
| `check-composer-project-library.mjs` | PASS, trois groupes | Recherche, catégories et rendu des seize modèles |
| `check-composer-project-preview.mjs` | PASS, quatre groupes | Personnalisation, date invalide/autre mois, annulation, focus, réouverture d’existant et perte d’admission d’un complément |
| `check-composer-project-families.mjs` | PASS, cinq groupes | Séjours, visites familiales, Maison, impact d’activité libre et projets génériques |
| `check-composer-month-intentions.mjs` | PASS, cinq groupes | Réouverture exacte, filtres, projets vides, clavier et sélecteur d’intentions |
| `check-composer-catalog-purchase-starts.mjs` | PASS | Sept produits de six modules, acheminement du concept, édition exacte d’homonymes, panier existant, refus obsolète, réessai du catalogue, dates et filtres |
| `check-clay-discovery.mjs` | PASS | 687 identités, 632 illustrations nouvelles, 55 protégées, 529 concepts Excel, chemins, classement, 16 routes Activity supplémentaires et contrôle des champs privés |
| `check-composer-budget-impact.mjs` | PASS | Courses, sept parcours existants, UNKNOWN/zéro, inclusions, états périmés, lecture sans mutation et réessai READ |
| `check-composer-linked-summary.mjs` | PASS, deux groupes | Coût nul, sous-total connu, UNKNOWN, homonymes, recherche, filtres, clavier et STALE |
| `check-composer-navigation-groups.mjs` | PASS, quatre groupes | Groupes, parents, imbrication, homonymes et rendu |
| `check-phase2-planner-atomic-ui.mjs` | PASS, quatorze contrôles | Présentation et référence publiée Restaurants. Focus navigateur encore à vérifier |
| `check-composer-v22-a2-library.mjs` | PASS, douze contrôles | Identités, RAW, consultation, reprise et refus de choix ambigus avec DOM/éditeurs simulés |
| `check-composer-v22-library-hairdresser.mjs` | PASS, huit contrôles | Référence externe exacte, permissions, mois et absence de writer sur fixture |
| `check-composer-v22-a1-mascara.mjs` | PASS consigné au journal | Seize contrôles Beauté, édition de prix/quantité et références Clay |
| `check-restaurant-suggestions.mjs` | PASS consigné au journal | Non-régression locale Restaurant/Cinéma aux checkpoints concernés |
| `check-composer-mobility-fields.mjs` | PASS consigné au journal | RAW, parking et tarif du train de 10 € inchangé entre aller simple et aller-retour sur providers de fixture |
| `check-composer-linked-moves.mjs` | PASS consigné au journal | Reparentage admis, conservation d’un billet et refus d’une confirmation obsolète |
| `check-composer-stay-child-navigation.mjs` | PASS consigné au journal | Enfants homonymes, ouverture, retrait confirmé et conservation du frère |
| `check-composer-intent-diagnostics.mjs` | PASS consigné au journal | Portée des diagnostics, accès aux sources et masquage périmé |
| `check-composer-purchase-basket.mjs` | PASS consigné au journal | Save/Reload sur stockage SQL isolé de fixture et compatibilité des paniers |
| `check-composer-p14-p2-durable.mjs`, `check-composer-post-snap3-draft-http.mjs` | PASS consigné au journal | Reprise confirmée, reçus incohérents, CAS et réessai idempotent |
| `check-composer-root-relation-exit.mjs` | PASS consigné au journal | Contrôles locaux du Shell et reprise d’organisation. Aucun gate ouvert |

Ces contrôles ont été répartis entre les commits. Ils ne constituent pas l’exécution d’une suite intégrale unique sur le HEAD documentaire final.

### Tests et opérations restés NOT_RUN

- Recette visuelle exhaustive du Board et des nouveaux parcours sur desktop, mobile, zoom et lecteurs d’écran.
- Navigation clavier réelle, géométrie des popovers, focus après remontage et interactions tactiles.
- Nouvelle recette de `check-composer-journey-browser.mjs`, adapté mais non exécuté pour ce run.
- Save/Reload authentifié distant des nouvelles compositions et contrôle des archives avant/après.
- Preview FRESH authentifiée des nouvelles compositions, sur un périmètre financier explicitement autorisé et réellement complet.
- Certification des inclusions, déplacements et opérations de projet dans un environnement distant représentatif.
- Vérification finale de Preview Vercel et des contrôles GitHub sur le SHA à livrer.
- Apply, PlanRevision et mise en Production.

### Reproductibilité locale

Les scripts React additionnels réutilisent `outputs/p21-react-tools` ou la variable `PLANNER_REACT_TEST_TOOLS` pointant vers le répertoire de son `package.json`. Les pilotes historiques Bibliothèque/Coiffeur utilisent également cette variable. Cet outillage reste local et hors du commit.

Une tentative `pnpm exec` a déplacé des dépendances npm dans `node_modules/.ignored` pendant le run. Elle a été interrompue, les dépendances existantes ont été remises en place, puis les contrôles ont été repris avec le binaire TypeScript local. Aucun package ni lockfile modifié ne fait partie du diff. Un échec de résolution de renderer ou une double instance React doit être traité comme une condition du banc avant d’être attribué au produit.

## 8. Risques de régression à traiter en revue

| Risque | Pourquoi cette PR est concernée | Preuve disponible et validation restante |
| --- | --- | --- |
| Sauvegarde et CAS | Le transport et la récupération du Draft ont changé | Fixtures de reçus et reprise PASS. Recette authentifiée Save/Reload, conflit et réponse perdue à faire |
| Identités des homonymes | Catalogue, recherche, éditeurs et déplacements partagent plusieurs chemins d’ouverture | Tests exacts PASS. Vérifier clic, clavier, tactile et Reload |
| Retrait de descendants | Certains contrats de socket suppriment un enfant et ses descendants | Confirmation et tests locaux présents. Revue de portée des actions obligatoire |
| Atomicité des modèles | Plusieurs évaluations précèdent une installation unique | Refus intermédiaire et reçus incomplets testés. Contrôler Undo/Redo et sauvegarde finale du modèle |
| Compatibilité historique | Anciennes présentations, paniers mono-article et `purchase@v2` coexistent | Tests de compatibilité et de métadonnées futures. Recette avec données anciennes autorisées à faire |
| Droits et références obsolètes | Les permissions et le digest peuvent évoluer pendant une confirmation | Refus ciblés PASS. Vérifier le comportement complet du Shell et de la session distante |
| Double comptage ou coût périmé | Hébergement, inclusions, compléments, Courses et Mobility se combinent | Compiler conservé, slots et coûts ciblés testés. Certification financière de bout en bout ouverte |
| RAW et navigation | Plusieurs dialogues, Docks et liens parent/enfant coexistent | Fixtures RAW et gardes PASS. Parcours navigateur et tactile à faire |
| CSS partagé et illustrations carrées | Le style Composer concerne plusieurs familles et plusieurs rapports d’image | Rendu statique et chemins vérifiés. Géométrie responsive NOT_RUN |
| Découverte des activités génériques et presets | Le registre et l’index de bibliothèque ont été élargis | Capacités et identités vérifiées sur fixture. Vérifier les combinaisons réelles de droits |
| Taille de la PR | 118 commits et 65 fichiers avant la passation, dépendances communes dans le Shell et les registres | Découpage de revue proposé ci-dessous, sans opération Git de découpage exécutée |
| Tranche Cadeau locale | Le working tree contient une évolution absente du HEAD validé | À arbitrer explicitement avant toute future intégration |

La fusionnabilité GitHub signifie que le dépôt peut calculer une fusion. Elle ne vaut pas validation des parcours. La Preview finale, ses journaux et la Production n’ont pas été certifiés dans cette clôture.

## 9. Plan de validation et de découpage de la PR

Ce plan décrit les étapes de préparation d’une livraison future. Aucun test, cherry-pick ou nouvelle PR n’a été lancé pour ce document.

### Ordre de revue proposé

| Lot | Contenu | Dépendances et validation utile |
| --- | --- | --- |
| A | Draft, navigation confirmée, reçus HTTP et récupération | Revoir transport/CAS avant les parcours composés. Rejouer les fixtures concernées puis Save/Reload autorisé |
| B | Routage d’éditeurs, index de bibliothèque, reprise des intentions, navigation commune | Dépend de A pour la reprise durable. Vérifier homonymes, ancien Draft, consultation et changement de mois |
| C | Activités, Beauté, Mobility et ajustements de formulaires | Dépend du routage B. Vérifier UNKNOWN/zéro, quantités, inclusions et frais du trajet |
| D | Projets, rattachements, coûts individuels et modèles | Dépend de B et des familles C. Vérifier atomicité, parents/enfants, retrait, Undo/Redo et Reload |
| E | Paniers, commande de renommage et découverte de produits | Revoir `SET_DETAILS.label` avec ses anciens appelants. Vérifier ancien mono-article, `purchase@v2`, concepts, livraison et dates |
| F | S3, catalogue d’activités des projets et finitions UX/CSS | Dépend de B à E. Vérifier masquage, confirmations, réutilisation de racines et responsive |

Les fichiers partagés `composer-shell.tsx`, `composer-library-index.ts`, `composer-presets.ts` et `composer.module.css` traversent plusieurs lots. Un découpage réel devra préserver les dépendances et isoler des tranches compilables, avec leurs tests. Le tableau constitue un plan de revue, pas une instruction de réécriture automatique des 118 commits.

Si le propriétaire conserve une seule PR, utiliser ces lots comme unités de revue et de certification. Si un découpage est demandé, préparer des branches dépendantes ou une extraction contrôlée depuis le HEAD arrêté, avec comparaison du résultat cumulé. La PR #123 et son historique servent de référence récupérable.

### Validation proportionnée avant publication

1. Figer le SHA candidat et décider du sort des deux fichiers locaux Cadeau.
2. Revoir le diff par lot et aligner la description de PR sur les seize modèles et les réserves actuelles.
3. Exécuter les contrôles ciblés correspondant aux lots effectivement retenus. Revoir le changement de commande panier et les contrats de sauvegarde.
4. Tester la Preview portant ce SHA, notamment les sept parcours existants, les nouvelles familles, les modèles, le catalogue et les droits.
5. Réaliser la recette navigateur desktop/mobile et clavier, en donnant priorité aux panneaux, Docks, focus, RAW et homonymes.
6. Réaliser Save/Reload et Preview financière authentifiés uniquement sur un périmètre d’écriture autorisé. Vérifier l’état initial et final du Draft, des archives et du Plan.
7. Garder les blocages financiers explicites. Une source mensuelle absente ne doit pas recevoir un montant fictif pour produire FRESH.
8. Obtenir les validations GitHub et l’autorisation distincte de publication, puis seulement préparer la fusion et le contrôle Production.

## 10. Étapes restantes avant Production

La PR reste Draft. Les contrôles automatiques finaux, la Preview exacte, la recette navigateur et les nouvelles preuves authentifiées constituent les étapes ouvertes.

Aucune autorisation de fusion ou de déploiement ne découle de cette passation. Apply et PlanRevision demandent leur propre mandat. Les gates N1/Before, les données financières, Auth/RLS et Supabase restent soumis aux permissions existantes.

Une livraison devra établir le SHA final de `main`, le déploiement Vercel Production correspondant et son état READY, puis vérifier les parcours autorisés avec comparaison des états avant/après. Ces opérations n’ont pas été réalisées dans ce run documentaire.

## 11. Consignes pour la prochaine session

La prochaine session doit commencer par le mandat nouveau du propriétaire. Le run continu est arrêté et aucun backlog ne doit se relancer automatiquement.

Pour retrouver l’état technique, lire ce document, le journal `P21_MEGA_RUN_PROGRESS.md`, le HEAD distant de #123 et `git status`. Le HEAD applicatif de référence est `81c5d12df2d879f2dd082803ef6c9f8629ff4c24`, suivi du commit documentaire contenant cette passation.

Les deux fichiers Cadeau non commités et `outputs/` doivent être inventoriés avant toute manipulation de branche. Leur conservation, leur retrait ou leur intégration attend une décision du nouveau mandat. Éviter un ajout Git global qui les inclurait dans une tranche documentaire ou une publication.

Les scripts et composants listés dans les annexes fournissent le banc existant. Les réutiliser pour la validation demandée. Les grands chantiers fermés N1/Before et la certification financière historique ne constituent pas des travaux à relancer implicitement.

Le prochain travail attendu est une décision de revue/validation ou de découpage de la version arrêtée, suivie des seules opérations autorisées par ce nouveau mandat.

## 12. Références et clôture

- [PR #123](https://github.com/adriensauvageot34/Budgetisation/pull/123)
- [HEAD applicatif arrêté](https://github.com/adriensauvageot34/Budgetisation/commit/81c5d12df2d879f2dd082803ef6c9f8629ff4c24)
- [Comparaison de référence](https://github.com/adriensauvageot34/Budgetisation/compare/2e6febec5c9e56aaca76174c62d421157b4d44ef...81c5d12df2d879f2dd082803ef6c9f8629ff4c24)
- Journal versionné `docs/status/P21_MEGA_RUN_PROGRESS.md`.
- Doctrine du projet `STRAT:P21-RECENTRAGE@v1`.

Verdict de clôture documentaire attendu après enregistrement distant du présent fichier `P21_MEGA_RUN_CLOSED_DOCUMENTED`. La validation métier et la publication Production restent des étapes distinctes à autoriser.


## Annexe A. Les 65 fichiers du diff applicatif arrêté

Les chemins sont relatifs au dépôt. Le présent document devient le 66e fichier de la PR lors de sa livraison. Le fichier Beauté représente le renommage de `mascara-edit.ts` vers `beauty-product-edit.ts`.

```text
docs/status/P21_MEGA_RUN_PROGRESS.md
scripts/check-clay-discovery.mjs
scripts/check-composer-budget-impact.mjs
scripts/check-composer-catalog-purchase-starts.mjs
scripts/check-composer-intent-diagnostics.mjs
scripts/check-composer-journey-browser.mjs
scripts/check-composer-journey-ux.mjs
scripts/check-composer-linked-moves.mjs
scripts/check-composer-linked-summary.mjs
scripts/check-composer-mobility-fields.mjs
scripts/check-composer-month-intentions.mjs
scripts/check-composer-navigation-groups.mjs
scripts/check-composer-p14-p2-durable.mjs
scripts/check-composer-post-snap3-draft-http.mjs
scripts/check-composer-project-completion.mjs
scripts/check-composer-project-families.mjs
scripts/check-composer-project-library.mjs
scripts/check-composer-project-preview.mjs
scripts/check-composer-purchase-basket.mjs
scripts/check-composer-root-relation-exit.mjs
scripts/check-composer-stay-child-navigation.mjs
scripts/check-composer-v22-a1-mascara.mjs
scripts/check-composer-v22-a2-library.mjs
scripts/check-composer-v22-library-hairdresser.mjs
scripts/check-phase2-planner-atomic-ui.mjs
scripts/check-restaurant-suggestions.mjs
src/app/mois-a-venir/composer/asset-editor-routing.ts
src/app/mois-a-venir/composer/beauty-product-edit.ts
src/app/mois-a-venir/composer/catalog-context-editor.tsx
src/app/mois-a-venir/composer/catalog-discovery-provider.tsx
src/app/mois-a-venir/composer/catalog-discovery.module.css
src/app/mois-a-venir/composer/catalog-discovery.ts
src/app/mois-a-venir/composer/composer-library.tsx
src/app/mois-a-venir/composer/composer-save-status.tsx
src/app/mois-a-venir/composer/composer-shell.tsx
src/app/mois-a-venir/composer/composer.module.css
src/app/mois-a-venir/composer/context-card.tsx
src/app/mois-a-venir/composer/context-palette.tsx
src/app/mois-a-venir/composer/display.ts
src/app/mois-a-venir/composer/draft-http-transport.ts
src/app/mois-a-venir/composer/draft-navigation-memory.ts
src/app/mois-a-venir/composer/durable-draft.ts
src/app/mois-a-venir/composer/equipment-component-editor.tsx
src/app/mois-a-venir/composer/family-visit-editor.tsx
src/app/mois-a-venir/composer/guided-asset-labels.ts
src/app/mois-a-venir/composer/intent-budget-impact.module.css
src/app/mois-a-venir/composer/intent-budget-impact.tsx
src/app/mois-a-venir/composer/intent-diagnostics.ts
src/app/mois-a-venir/composer/linked-intentions.tsx
src/app/mois-a-venir/composer/mobility-fields.tsx
src/app/mois-a-venir/composer/preset-illustration.tsx
src/app/mois-a-venir/composer/project-activity-catalog.tsx
src/app/mois-a-venir/composer/project-completion.tsx
src/app/mois-a-venir/composer/project-starter-preview.tsx
src/app/mois-a-venir/composer/project-starters.ts
src/app/mois-a-venir/composer/purchase-basket-editor.tsx
src/app/mois-a-venir/composer/purchase-basket.module.css
src/app/mois-a-venir/composer/restaurant-editor.tsx
src/app/mois-a-venir/composer/short-stay-editor.tsx
src/app/mois-a-venir/composer/workshop-component-row.tsx
src/app/mois-a-venir/composer/workshop-navigation.module.css
src/app/mois-a-venir/composer/workshop-navigation.tsx
src/domain/phase2/planner/composer-library-index.ts
src/domain/phase2/planner/composer-presets.ts
src/domain/phase2/planner/purchase-basket.ts
```

## Annexe B. Les 118 commits du périmètre applicatif

Ordre chronologique, depuis la base de comparaison jusqu’au HEAD arrêté. Le commit documentaire de clôture s’ajoute à cette liste.

```text
70a2177d280696442f20dede92c2af27434739c8 feat(composer): recover confirmed draft navigation
31d1457efb512f8383976a20f65b30529e10ea3e feat(composer): extend beauty product editing
b65946a0bf4ee7f048adb2967715d81a3da5e18b feat(composer): add composed outings
a08972605c42c10ef16643e891856aa157598a90 feat(composer): add project starters
4a7fd4cc6452921d43f3c70520eb7c4ad11b7dd9 feat(composer): suggest explainable project complements
79e0fb3c2985acde8020164707070591b6320b0f feat(composer): clarify project and draft status
eaf8d82983242a04782a469935bf06f1cac14be8 feat(composer): guide activity expenses and transport
05c603956df4b02df4a1432d5d374b9427e0647e feat(composer): start and reopen specialized baskets
11d779138d9bcb543c41b9a4005066d6a715e21f fix(composer): confirm removal of linked projects
fc5979531f2f2a3dbbe0bfb782eadf06bc4dfe36 feat(composer): compose a visit with an activity
2a2cf7dba5fc4b07227e6bbdb43cc73a07f28698 feat(composer): refine project suggestions and draft recovery
da481b67876b09f2d26001f1ff2ff0436dc4fb59 fix(composer): reject stale project starter responses
acb26aabc9c21890eda8c8028cf84103aa5f940d test(composer): cover confirmed navigation reload
71fbf6f9350cfa3fcfc905309e0d3682d60cfe7c fix(composer): verify exact draft save receipts
f6014399a41a3692981acb470cb67fd72322c7ad fix(composer): keep linked intention order and navigation
884d28f199d2c7fa85e1b3d8a56e86921b1aeabb feat(composer): preview and personalize project starters
49747ca29be0ea9a5dbf520cf4b01a6c552da452 feat(composer): expose official impact of linked intentions
238d4eb761313c82eb7a5e949e717e1f7a2fb886 feat(composer): guide mobility costs and parking editing
7ab0391c806d96fc7db46e0cbc2cbd8aca115fa4 feat(composer): reopen compatible activities and purchases
87029c61551519c847044f9f20950f4b5ab2aea1 feat(composer): discover project models by content and category
0890802e085dfe2604c34cc39dd9527f5036eebe feat(composer): rank project complements by session priority
964a9cc5600c14fbe6495e627ea376061e6e9cae feat(composer): reuse beauty editing for four care products
3e28f3e1faa027501ad9c8addd68b8f200409d9c feat(composer): navigate intentions by project and search
9acbea0da9e3c4b63771c9da7ed70fda62849e60 feat(composer): move linked intentions between admitted projects
0c163b4b2634adda39c20c61c781dfda3f019e86 feat(composer): compose hotel stays and family visit activities
436a440544ae12ae76a1eee004c0b27e13aa42a7 fix(composer): reopen clothing baskets through their actual owner
dd426c781fc02199445ac2e59d3afc4b53d8d055 fix(composer): preserve focus and explain blocked model confirmation
7450954221e5f04f6ddc52cd619977f2d3c6b569 feat(composer): open stay children and clarify removal scope
8bf7414ffb3122de710976aebc9a32c299d38218 feat(composer): browse and filter existing month intentions
f23c88d212bf82faa1a430f55b957afa0eb19748 feat(composer): scope official diagnostics to each intention
ddc09b0891f6b6f4c92d19a332f0f378ab49310e feat(composer): show the exact parent project on child cards
c95808cfb0a1c22a4f0fbb6e8e2598bda3e7630b feat(composer): reveal admitted project moves and funding sources
53d92169cb1f44cbf9a4f8158e2da8474583baae feat(composer): date project models without dating their children
1b35f5806ceb7d75924caa6569b6090e43c3aea2 feat(composer): find intentions through their projects
410641a794d2b28721937ad55ef686dffaecac0c feat(composer): filter linked intentions by published state
678eae49e819924be4e073abdc3cd79d4eaea646 feat(composer): reopen existing projects from model previews
9bc18c12c6a883a9fb30de33c62ab7daa593b5af feat(composer): clarify complete and shared journey pricing
92ce01ed8fdbe4118be472572e19509ead25d71f feat(composer): navigate month intentions with the keyboard
76c2360d2dc638a75178efa24186aaa28b639e3c test(composer): reuse configurable existing React test tools
5cd870d8ac595eec58a07e5cb7c217aa14bc02b9 feat(composer): start admitted baskets from catalog products
6cb91f4079f55dffca4827f635cbb96b53b6b44a feat(composer): reopen exact basket lines from the catalog
c323e93a054872add3ac13c91f4d699b96a23c3a feat(composer): add six guided leisure activities
78ab55610d2e7e25acfdfc5cf7dfc6b7d8e9c5c5 feat(composer): find basket articles with missing prices
70803d8546b21409f70a2610e2b318927d475f58 feat(composer): distinguish official costs in linked projects
090f4331d947274edbe914f39a42bebc2964e975 feat(composer): open leisure activities from Clay catalog
8bbc4e81d1a1a4235ebc06aeed592e4f4f648253 feat(composer): add bowling and escape game project starters
67a64a72e6f1fb47d1c990082e7b4eda917d1c98 feat(composer): suggest one contextual meal for leisure projects
357487c05dd858d1b2392d6f0cd68f8352e587b9 feat(composer): navigate project search results with the keyboard
2235d259bb079883693999f9217274b76244bcef feat(composer): show current basket totals on the board
d46bdb86e5de2b1b2cfb5c36bf64c640b91ca063 fix(composer): preserve activity extra order and exact identity
73f7291b3930848bf42ab0e6b413371f319413a6 feat(composer): find baskets by merchant and catalog concept
06fe556dd89ca079a72fa520967ec374fc39aaaf feat(composer): find admissible activities to attach to projects
607b7ffadc276a233e1ae534676ac786b7ea5761 feat(composer): find intentions through intermediate projects
8905d259bbdd47dcf705bd17a98340d0abd2243a fix(composer): keep activity dock choices within their contract
dc71793f507adf91ba1197f57635cf360a3b5ee6 feat(composer): compose hotel culture and dining across stay slots
a3aebf7be24432a8cb52d047058e0561d3f797a6 feat(composer): suggest a meal through the stay restaurant slot
612eab5e5149ee76cf5ffab607a6b015a65df160 fix(composer): preserve untouched stay children during edits
67d114ee3cee9426ffe6177017f5181bd55b8f78 feat(composer): extend guided activities with six Clay concepts
35057eb73d3982d880710a949b0b9c23d76ad525 fix(composer): verify project child socket admission receipts
54a7754f8a47936644bd0c244dafe3f4e114ec28 fix(composer): preserve project choices when admission changes
bf52b028ff822f095f7e32c9cf7edd03c75c1aa8 fix(composer): guard the groceries catalog shortcut against stale drafts
98da8579fb52b18d6c76178bcde859d6c1fe6e5c fix(composer): recheck basket digest at removal confirmation
06f07da59f943c66a2371a45a4a3559debbf149b fix(composer): recheck stay attachment at confirmation
ce6970e5a596608ea6aa50e062d561219966fec0 feat(composer): restore catalog result focus after detail
5418906beeca2e70838cee69879d5b697bf86a08 fix(composer): preserve basket row numbers in catalog choices
14567d7d17ae3a670ae92dab48349212a8b88447 feat(composer): search within linked project intentions
a65e7e309275bce86eb41ef5e50de2d170cb6afa fix(composer): keep covered catalog results out of mobile navigation
a51ced2eff4bd173ae3d39b8ff9bdf7e2c4f61c6 feat(composer): reopen free activities from month intentions
14eefec00b5731cd955c65ba903ecde9d94820ec fix(composer): retain focus when project suggestions are dismissed
c4ef05b53f978d9a1fdd0217d4342e9345c801d0 fix(composer): explain stale stay attachment refusals
f76c1da89fb98f467d5d5dd3971322a7cbf64085 feat(composer): compose a weekend with groceries and a walk
8bf55d14ed1fe4e742d28ab85d410edbd6d0526f fix(composer): read basket article count from the current draft
16c744988701440bc34e8b69328641d9a5128b30 feat(composer): suggest groceries for a declared rental
a58c514aba1703ac1d2c296a65eb37094c20c04d feat(composer): prepare groceries from an admitted catalog product
6c193636ff4d23b5b49cf878689de01785140790 feat(composer): filter month intentions to purchase baskets
5538a6a41a3b74400cedf74504f37373ae6d443f fix(composer): explain stale project suggestion confirmations
c88daa4c8debf16151938dc67ddc03be21d98894 feat(composer): open the unique basket search result with Enter
75ebc026521cf6ae3a1d0682176e3ccb3b00c84d feat(composer): use exact Clay art in activity dock choices
abd27d77e95f31135caef9be7fa9674d7c18d355 feat(composer): name purchase baskets through their details
0516c0d82812d81ca45a05bba70cde7e104ac11f fix(composer): identify the groceries catalog destination
06b46ce2222e48313dab250d4e6c8f578283084a fix(composer): verify the parent when opening a linked basket
6235d9b8d975738715610954c4b23541b7f5bcf5 fix(composer): keep intentions reachable when an old date is invalid
145e080d9f5e65082ca9a65c92097c1f0eabbc3f feat(composer): open admitted generic purchases from Clay concepts
f6973df4d47b0ef5dd26b0f3ba764431e33cddc7 feat(composer): prepare a home furnishing project
b69e589ef4a5e9376929a04c8de1ea977f4ec00f feat(composer): start a furnishing project with an equipment basket
2dcdcaeefe6ca852fda7da81a24d2b7bc9c44b13 feat(composer): suggest an equipment basket for furnishing projects
dc9d8c1551a606a71b56db34463afba358c3b4d3 fix(composer): explain stale project attachment confirmations
6734d3fdc263816c9daac4ed5f96465e58c57ee6 fix(composer): keep preset actions out of budget-control discovery
25e7b4321a3b4ef89e4fed75bf18041cc8e42b36 feat(composer): expose admitted home project posts
9f204625762a4b1fd3331c9cab85d65c18b5776d fix(composer): keep cards readable with invalid dates
bbae6831bf39737a4aa510fcaf13aea5010d521a feat(composer): open unique catalog results with Enter
50439920a746cdaaf4de76efd09b8d14d0ddd410 feat(composer): filter intentions available in read-only mode
6ccf7e6f38241aed09ba9a17cdedb3866d81b7a3 feat(composer): suggest complements for generic outings
c3f7e31d6709964de1de0fdc251267be970402a0 test(composer): align library fixtures with current navigation
58271dcf7500c13172d696ca34425052e5b04d9e feat(composer): prepare catalog products in existing baskets
f767a16bd9570f5eadb9d843f65f67c1334903aa feat(composer): add four activities using square Clay artwork
d72ac6acc1e81d1aacea91af6c6f289b03f9d7ef feat(composer): add laser game and zoo project starters
7ded3334abd5e9d858372032afcfa95fb8dd684c feat(composer): open a unique linked intention with Enter
a98355a119b3d30585a5a403554581ce16434246 feat(composer): find activity art by existing search aliases
9e6ec1435820adaacae62701570e86c64844f39e fix(composer): respect published edit rights on Board cards
6d0a407cf43eaf3d0dcc4620cb17e76e1d22aef7 fix(composer): validate project dates in the preview
005a37e559a17386dcc6723c818548e2136c2bd5 fix(composer): give catalog details more space on mobile
0b0675520e3e0bf51204738bb4ea70c61eb021be feat(composer): show official impact for free activities
acda45a983b15bbf35c53cb6cd2bb5c5a9702831 fix(composer): hide catalog commands when edit rights change
438605fa20959739d9f55d26ace4190c5b285fdd fix(composer): preserve draft identities when creating projects
d51a4778582a6f09ec51cae3bdbba0b6d1a45b5c fix(composer): hide stale calculated Board costs
4826effb1fc4cd69aaf5228e4584a6362fd7674b feat(composer): reset basket filters together
51afd070260f76b2d92d9a531b0f9225fa7c4f00 feat(composer): reopen and compose generic projects
d479f8038d7036a0c0c9daf3a8639b718392a01c feat(composer): reuse project suggestions for generic contexts
0c38e14a70f841df61b778aeb67aa50d6228fd43 feat(composer): find empty stays and visits in month projects
d48144b750ea6be3f57cef736df76f36469ea63d fix(composer): guide basket dates within the selected month
4c5d57965bb21d5ab485e73839ed9b359676f741 feat(composer): retry catalog loading without losing the search
f8ee4386173582663bbe243ab1556c84d671c17c feat(composer): open the unique intention switcher result
adeca1d5a0ac78cfb19df189935b2a5897f6143e feat(composer): add a clothing and beauty shopping starter
33ff3788eacecece9fe364a11f6978f98d334fff fix(composer): explain rejected project additions
41c8165e7bc5773157d0522b6e549ceb2b20720e feat(composer): choose project activities from the Clay catalog
2d354247eaab678c2032befb4646fd625375aae3 feat(composer): share activity catalog with stays and family visits
81c5d12df2d879f2dd082803ef6c9f8629ff4c24 feat(composer): attach existing activities from the project catalog
```
