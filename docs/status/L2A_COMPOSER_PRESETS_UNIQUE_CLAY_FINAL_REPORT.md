# L2-A — Cinq presets Composer et créations Clay originales

## État de livraison

**L2A_RELEASED_WITH_VALIDATION_LIMITATIONS**

PR #44 fusionnée ; Production READY sur `c5d33fc6117417e83d66d2ec6c3348bc7df01937`. Cinq presets et cinq créations originales livrés. Sauvegarde et reprise authentifiées Production confirmées, après un incident Canonical. Brouillon de test archivé sans suppression. Aucune certification globale de performance ou RLS n’est ajoutée.

## A. État initial

- Produit livré L1/main : `3e4eaa7352b33fb094fc83ddd639c0693ef2950a`, PR #43 fusionnée.
- Départ local : `21f3f8f81679042a803eaf28c63f3dbd7a80952e`, descendant de main, avec deux commits documentaires L1 conservés.
- Branche : `codex/composer-v3-l2a-smart-presets`.
- Réutilisation de P07 Draft HTTP, scheduler P03/P14, Compiler/Finance V2, C0, éditeurs Restaurant L1, Soirée P09 et Visite P10. Aucun nouvel owner.

## B. Capacités réellement publiées

| Preset | Context | Champs et slots réutilisés | Limites explicites |
|---|---|---|---|
| Soirée techno | night-out | label, dates, participants, lieu, repère temporel ; main, before/enfants, food, extras, outbound/return | Pas de sous-type techno propriétaire : identité de présentation uniquement. Aucun verre ni prix prérempli. |
| Uber Eats | delivery | label, date, participants, lieu facultatif ; meal, extras | Aucun slot transport. Aucun fournisseur certifié Uber Eats. Composition libre par composants admis. |
| Journée pêche | activity | label, date, participants, lieu ; main, extras, transport | Aucune taxonomie pêche ajoutée. Frais génériques nommés par l’utilisateur ; équipement indépendant non créé. |
| Visite Fontès | family-visit | proche, participants, lieu exact, dates, repère ; hospitality, activités enfants, transport | Aucun identifiant canonique Fontès certifié par le preset. Sélection explicite du lieu ; ni rapprochement flou, ni voiture imposée. |
| Acheter des vêtements | purchase | label, date, productLabel, merchantLabel, placeRef, budgetDomain=clothing ; item, extras, transport | Le contrat Purchase n’expose pas de participant structuré ni de mode magasin/en ligne : aucun champ factice n’est collecté. Vendeur en texte libre, facultatif. |

## C. Presets et éditeurs

`src/domain/phase2/planner/composer-presets.ts` contient les cinq recettes déclaratives. La Library ne les rend que si le serveur publie l’asset Context correspondant et une capacité BOARD_ZONE non bloquée. Le DROP transmet la clé de preset avec cet asset réel ; le même constructeur pur est utilisé pour la création locale immédiate et la validation serveur.

Seuls le libellé et, pour Vêtements, le domaine officiel clothing sont préremplis. Aucun prix, fréquence, proche, date, véhicule, trajet, marchand ou composant économique n’est déduit.

Les trois parcours simples réutilisent le guide L1, son panneau et sa palette : questions adaptées, date inconnue, budget global/détaillé, compléments volontaires, enveloppe et transport seulement s’ils sont admissibles. Ils utilisent une mutation atomique des sockets existants. Les éditeurs Soirée et Visite sont conservés, avec leur illustration et une explication propre au preset. Les imports d’éditeurs restent différés.

## D. Cinq illustrations originales

Outil : `image_gen` intégré, cinq appels individuels, une génération retenue par preset. Références Builder examinées : pêche, T-shirt et livraison ; elles n’ont été ni copiées, ni éditées, ni recadrées. Les cinq sorties ont été inspectées individuellement, puis dans la Library et sur le Board.

Direction commune : sculpture Clay mate, volumes épais, lumière haut gauche, ombre douce, fond ivoire, format 2:1 et réserve calme à gauche. Pas de texte ni de logo incorporé. Maison méridionale purement symbolique, sans reproduction d’un domicile.

| Identité / sujet | WebP final | Dimensions | Octets |
|---|---|---|---:|
| techno-night / enceinte et petit séquenceur | public/planned-visuals/composer/presets/techno-night.webp | 1200×600 | 24 682 |
| uber-eats-order / sac et repas livré | public/planned-visuals/composer/presets/uber-eats-order.webp | 1200×600 | 21 312 |
| fishing-day / canne, moulinet, boîte et flotteur | public/planned-visuals/composer/presets/fishing-day.webp | 1200×600 | 21 864 |
| fontes-family-visit / maison, chemin et olivier génériques | public/planned-visuals/composer/presets/fontes-family-visit.webp | 1200×600 | 54 368 |
| clothing-shopping / haut sur cintre, pantalon et sac | public/planned-visuals/composer/presets/clothing-shopping.webp | 1200×600 | 18 140 |

Total : **140 366 octets**. Export WebP Q82 par réduction proportionnelle d’originaux exactement 2:1, sans déformation ni recadrage. Prompts exacts : `evidence/l2a-composer-presets/prompts/*.txt`. SHA-256 des originaux et des exports : `illustrations.json`. Le script d’export conserve les originaux hors dépôt ; aucun secret ni donnée personnelle dans les images ou les prompts.

## E. Identité visuelle durable

Registre terminal unique : recette `presetKey → illustrationKey → /planned-visuals/composer/presets/*.webp`.

Extension JSON réservée et versionnée dans `context.fields.composerPresentation` :

```json
{ "version": "composer-context-presentation@v1", "presetKey": "techno-night" }
```

La frontière sémantique vérifie la version, la clé et sa correspondance exacte au template. Les anciens Contexts sans cette propriété gardent leur présentation et leurs manifests historiques. Aucun changement du registre financier ni migration C0. Les autres champs et sélections sont conservés par les mutations partielles.

L’identité ne dépend jamais du titre. Library, carte, miniature de groupe et réédition lisent cette même clé. Fichiers statiques `loading=lazy`, `decoding=async` ; aucun base64 ou lecteur World par image. Le digest sémantique inclut naturellement la préférence persistée ; la parité du scénario et des composants économiques est vérifiée séparément.

## F. Finance et contrats

- Suite déterministe `scripts/check-l2a-presets.mjs` : création locale/serveur, cinq Contexts corrects, aucune décision économique par défaut, patch partiel, identité après renommage, sérialisation, UNKNOWN≠0, suggestions S2 non acceptées, refus d’un preset incompatible, scopes, protections.
- Comparaison manuel/preset : scénarios Finance V2, composants et prix de trajets identiques à décisions égales.
- Total ↔ détail Livraison/Vêtements : remplacement des sockets, aucun total parent ajouté. Enveloppes officielles testées par le Compiler. Bouteille partagée Techno : un seul composant/coût.
- Apply → PlanRevision C0 → Reload → Mon Plan → réédition exécuté **sur PGlite synthétique isolé uniquement**, jamais sur le Plan personnel.
- Parité historique **22 scénarios × 9 empreintes : PASS**.
- L1, C8, P12, P13, Kernel, Draft HTTP et scheduler : PASS (journaux et codes dans `regressions.json`).
- P09 et P10 : FAIL sur assertions de texte `Train / tram` et `date non fixée`, également reproduites sur le départ `21f3f8f` dans une copie source isolée. Aucun calcul n’est modifié pour faire passer ces anciennes assertions. Les contrôles métier qui les précèdent passent ; la partie après assertion reste non exécutée dans ces suites.

## G. Performance et SNAP-3

Aucune modification de Canonical/M7, artifacts, triggers, admission, publications, sources historiques, Finance V2 ou readWorld. Aucun nouveau snapshot, cache persistant ou dépendance produit.

TypeScript : PASS. Build local Next : bloqué par la jonction node_modules pointant hors de la racine Turbopack ; ce résultat n’est pas un build complet réussi. **Build Git Vercel complet PASS** sur `232238d6749b2d86ef8e1c88153ce7d95a88e36e` : Next 16.2.6, compilation 39,6 s, TypeScript 43 s, pages générées et déploiement READY (`preview-build.log`).

Comparaison bornée L1/L2-A, trois rechargements chauds par variante, React production minifié/split, même fixture vide, même viewport réel **1280×720**, même délai artificiel Preview de 500 ms, mêmes dépendances. Les trois tests UX desktop sont distincts de cette comparaison. Premier chargement de chaque contexte exclu (largeurs différentes observées avant correction). Horloge Performance navigateur et double requestAnimationFrame ; pas de durée de l’outil.

| Mesure descriptive | L1 | L2-A |
|---|---:|---:|
| Ouverture → FRESH P50, n=3 | 209,7 ms | 265,8 ms |
| Étendue des ouvertures | 189–303,4 ms | 220,7–319,3 ms |
| Décision Restaurant → FRESH P50, n=3 | 776,4 ms | 782,9 ms |
| Étendue des décisions | 774,8–836,2 ms | 762–804 ms |
| Ouverture éditeur après peinture, n=1 | 164,1 ms | 165,7 ms |
| JS initial effectivement demandé (5 ressources) | 429 402 octets | 436 942 octets |
| Somme gzip locale de ces mêmes ressources | 135 996 octets | 138 674 octets |
| Images de presets demandées | 0 | 5 / 140 366 octets décodés |
| Requête initiale métier de fixture | 1 | 1 |
| Nœuds DOM initiaux | 1 884 | 1 902 |

JS initial : +7 540 octets bruts / +2 678 octets gzip. Les éditeurs ne sont pas dans ces cinq ressources initiales ; leur chunk n’est demandé qu’au focus/clic. Les cinq nouvelles vignettes étant visibles ensemble, leurs cinq images sont admises par le lazy loading ; aucune collection complète Builder n’est chargée. Le cache navigateur est chaud pour les images dans la série retenue : les octets décodés ne sont pas des octets effectivement retransférés.

**Aucun gain de performance revendiqué.** L’ouverture médiane de cette minuscule série augmente de 56,1 ms ; le parcours d’édition comparable de 6,5 ms. P95 non certifié, échantillons insuffisants ; aucune extrapolation aux latences Supabase réelles. Preuves brutes et conditions : `performance-opening.json`, `performance-editing.json`, `performance-summary.json`.

## H. Navigateur

Fixture locale compilée avec React en mode production, faux providers et PGlite, aucun accès distant :

- Cinq vignettes originales chargées et dimensions naturelles 1200×600.
- Création et ouverture de Techno, Livraison, Pêche, Fontès et Vêtements réellement observées.
- Livraison 32 €, Pêche 15 €, Vêtements 45 € puis 50 € : décisions explicites, SAVED/FRESH.
- Reprise après fermeture du navigateur et Reload : champs et illustrations conservés.
- Undo pendant Preview : 50→45 €, article conservé ; Redo rétabli.
- Largeurs effectives 1440×900, 1728×900 et 1920×1080 contrôlées ; aucun débordement horizontal. Correction ciblée de la flex-basis de l’image pour ne pas agrandir verticalement les cartes.
- Captures : `desktop-1440.jpg`, `desktop-1728-reedit.jpg`, `desktop-1920.jpg`.

Preview authentifiée : connexion réelle, cinq illustrations chargées et cinq éditeurs ouverts ; budget Livraison 32 € admis en mémoire, retour Compiler sans erreur et état BLOCKED pour scénario incomplet. Apply reste interdit. L’autosauvegarde est désactivée par la configuration de Preview ; aucun contournement ni modification de ses variables. **Sauvegarde/Reload authentifiés Preview : NOT_RUN**. La preuve de sauvegarde/reprise complète des cinq presets est synthétique, pas authentifiée.

Production authentifiée (décembre 2026, aucun Draft actif et révision officielle 0 avant test) :

- Site servi sur le SHA du merge ; cinq vignettes et éditeurs disponibles, aucune erreur à l’ouverture initiale.
- Création des cinq presets. Livraison 32 € explicitement choisi ; article « Article de test L2-A » conservé pour Vêtements ; autres intentions laissées incomplètes sans montant, trajet ou date inventés.
- Autosauvegarde : **SAVED**, digest `74b34dd7acd71fcff00928ac8f98810b22c1c826dbdac3ec65772ac5958f8da8`.
- Corroboration SQL strictement en lecture seule, bornée au même auteur et mois : Draft ACTIVE version 2, cinq Contexts et cinq clés distinctes, digest identique, révision officielle toujours 0. Une archive vide préexistante reste conservée. Cette lecture privilégiée **n’est pas une nouvelle preuve RLS authentifiée**.
- Premier Reload : erreur serveur Canonical **timing / 57014**, digest d’erreur navigateur `3982295859`. Logs corrélés au GET et à des POST Preview. Même classe d’incident déjà consignée lors de L1 ; aucun chemin Canonical/SNAP-3 n’est modifié par L2-A.
- Une seule reprise du GET après la fin des appels précédents : **PASS authentifié**, SAVED et digest exactement identique. Les cinq Contexts sont conservés ; réouverture Vêtements avec l’article de test et l’illustration correcte, Apply désactivé pendant cette configuration. Aucune relance de sauvegarde ou écriture en double.
- Archivage par le bouton authentifié « Abandonner mes essais », après lecture de la confirmation explicite : **PASS**, archive ABANDONED version 3 conservant le même digest et les cinq Contexts, aucun Draft actif restant. Archive vide préexistante inchangée ; révision officielle toujours 0. Retour visible au Centre de contrôle de décembre. Preuves : `production-smoke.json`, `production-durable-read.json`, `production-after-archive.json`.
- Aucun Apply réel. Aucun appel à un writer de données financières, aucune PlanRevision de test. La comparaison par hash de l’ensemble des tables financières réelles est **NOT_RUN** ; la preuve se limite aux opérations exécutées, aux contrats et à la révision officielle relue.

Les réserves restent : Canonical intermittent, E2E financiers réels avec Apply NOT_RUN (interdit par cette mission), deuxième appareil physique NOT_RUN, P95 réel NOT_CERTIFIED. Les tests de conservation/Apply/Mon Plan complets restent explicitement synthétiques.

## I. Livraison et rollback

PR : https://github.com/adriensauvageot34/Budgetisation/pull/44

Preview : https://budgetisation-m1xw217eb-adriensauvageot34-6137s-projects.vercel.app

Déploiement `dpl_CqnG9FHDMUKHandMwue8jyQ187gP`, source Git `232238d`, READY ; authentification et parcours testés sur ce build.

Commit documentaire `76037c50ac2762b38e90420ce18a01b380abf4fe` : arbre produit identique, deuxième Preview `dpl_HPX8SbfBt5b8r3jbwcgH5JsfJKzi` READY, checks Vercel/GitHub success. Aucun workflow Actions supplémentaire publié.

Merge main : **`c5d33fc6117417e83d66d2ec6c3348bc7df01937`**. Arbres du merge et de la tête PR strictement identiques : `f30b60ba5c9d3dec2c3c1d70ef93188fd785c83f`. Checkout synchronisé par fast-forward, aucun écrasement distant.

Production : **`dpl_TXMpiRaKakPxBtGERkn4sy9eSkv3`**, READY, alias vérifié `https://budgetisation-tan.vercel.app`, source Git main au SHA du merge. Build complet Next PASS : compilation 39,5 s, TypeScript 39,8 s, génération des pages et déploiement terminés. Preuves : `production-build.log`, `production-deployment.json`.

Pas de rollback produit déclenché pour le timeout préexistant non introduit par ce diff. Aucune modification SQL ou de configuration tentée pour masquer l’incident. Aucun déploiement supplémentaire de performances, aucun L2-B.

### Verdicts finaux

| Gate | Résultat exact |
|---|---|
| Cinq recettes liées aux capacités publiées | PASS |
| Cinq images originales, exports, hashes, inspection | PASS |
| Conservation complète, parité, Apply/Reload/Mon Plan | EXECUTED_PASS_PGLITE_SYNTHETIC_ONLY |
| Parité historique 22×9 | EXECUTED_PASS |
| TypeScript / Next complet Vercel Preview et Production | EXECUTED_PASS |
| Desktop 1440/1728/1920, Undo/Redo | EXECUTED_PASS_LIMITED_FIXTURE |
| Création et éditeurs sur Preview authentifiée | EXECUTED_PASS_LIMITED_READ_ONLY_PREVIEW |
| Sauvegarde/reprise/archivage Production | EXECUTED_PASS_AFTER_ONE_CANONICAL_TIMEOUT_RETRY |
| RLS authentifiée nouvelle campagne | NOT_RUN, protections inchangées |
| Apply réel / PlanRevision personnelle | NOT_RUN, interdit et non exécuté |
| SNAP-3 / sources financières / migrations | UNCHANGED |
| Performance réelle / P95 | NOT_CERTIFIED |
| Anciennes assertions P09/P10 | FAIL_PREEXISTING_REPRODUCED_ON_BASE |
| Livraison | L2A_RELEASED_WITH_VALIDATION_LIMITATIONS |

La clôture documentaire locale est conservée après le merge ; elle ne change pas l’arbre produit déployé. Aucun développement L2-B commencé.

Rollback : retirer les entrées de création et les adaptations UI L2-A tout en conservant le lecteur de `composerPresentation@v1` pour les Drafts/Plans déjà enregistrés. Ne pas redéployer aveuglément L1 sans ce lecteur : L1 ignorait cette nouvelle namespace. Aucun Draft, archive ou Plan n’est supprimé ; aucune opération SQL n’est nécessaire.

## J. Réutilisation pour L2-B

Recettes déclaratives, identité versionnée, registre visuel terminal, cinq créations originales, guide commun des Contexts simples et tests d’équivalence sont réutilisables. L2-B et le catalogue complet ne sont pas commencés. Chaque futur asset distinct devra avoir sa propre création originale, et ses capacités métier devront rester publiées par l’owner.
