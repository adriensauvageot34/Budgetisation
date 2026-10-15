# L2-A — Cinq presets Composer et créations Clay originales

## État de livraison

PR #44 ouverte ; Preview READY et authentifiée. Livraison Production en préparation. Les résultats sont distingués entre fixtures, Preview authentifiée et Production.

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

Production : à compléter. Les timeouts Canonical préexistants restent une réserve L1/P14 ; cette mission ne les réaudite pas. Aucune certification globale FRESH réelle n’est revendiquée.

## I. Livraison et rollback

PR : https://github.com/adriensauvageot34/Budgetisation/pull/44

Preview : https://budgetisation-m1xw217eb-adriensauvageot34-6137s-projects.vercel.app

Déploiement `dpl_CqnG9FHDMUKHandMwue8jyQ187gP`, source Git `232238d`, READY. Checks GitHub/Vercel success ; pas de workflow Actions supplémentaire publié. Merge et Production à compléter.

Rollback : retirer les entrées de création et les adaptations UI L2-A tout en conservant le lecteur de `composerPresentation@v1` pour les Drafts/Plans déjà enregistrés. Ne pas redéployer aveuglément L1 sans ce lecteur : L1 ignorait cette nouvelle namespace. Aucun Draft, archive ou Plan n’est supprimé ; aucune opération SQL n’est nécessaire.

## J. Réutilisation pour L2-B

Recettes déclaratives, identité versionnée, registre visuel terminal, cinq créations originales, guide commun des Contexts simples et tests d’équivalence sont réutilisables. L2-B et le catalogue complet ne sont pas commencés. Chaque futur asset distinct devra avoir sa propre création originale, et ses capacités métier devront rester publiées par l’owner.
