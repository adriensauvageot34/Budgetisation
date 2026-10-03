# Ajouter une dépense — bibliothèque Clay complète

Date : 3 octobre 2026. Branche : `main`. Base : `27ffe229e9a267bb9778b5b53a37456a78913226`.

Le commit final est le commit contenant ce rapport (`git log -1 --format=%H -- docs/status/phase2-builder-clay-2026-10-03.md`). Les captures restent hors Git dans le workspace parent.

## Livraison et inventaire

| Mesure | Valeur |
|---|---:|
| Choix sémantiques illustrés inventoriés | **326** |
| Dont clés canoniques du catalogue de coûts | **210** |
| Alias de scènes pour compatibilité des écrans secondaires | **44** |
| Bindings explicites du registry (choix + alias) | **370** |
| Illustrations individuelles acceptées et livrées | **164** |
| Générations réalisées, remplacements compris | **168** |
| Images écartées et régénérées | **4** |
| Poids des 164 WebP | **1 781 288 octets** (≈ 1,7 Mio) |

Le nombre de choix compte les clés sémantiques, pas les objets uniques : un dessert ou une voiture présents dans plusieurs parcours réutilisent le même fichier. Aucun asset métier n'est créé pour ouvrir un module. Le catalogue et son éligibilité restent dans la couche domaine.

L'inventaire `docs/design/builder-clay-inventory.json` contient : `assetKey`, label, flow, usage, visuel précédent, nouvel asset requis et illustration choisie. Les exclusions et familles de contrôles non illustrés sont jointes au même document. Restaurant, Fast-food, Travail, Courses, Soirée, Visite, Activité, Achat et Voyage sont couverts, y compris coûts, sous-types et compléments.

## Direction artistique et production

La capture fournie sert de direction artistique, jamais de feuille à découper. Chaque fichier vient d'une génération individuelle imagegen. Après le pilote, même recette pour l'ensemble : matière mate, volumes doux, ivoire/crème/perle et petits accents lavande ; lumière studio diffuse haut/gauche, ombre douce bas/droite, sujet dans la partie droite, zone calme à gauche/bas. Aucun texte, bord, label, check ou logo UI incorporé dans l'image.

Exception demandée : **toutes les voitures sont une Peugeot 207 rouge**, via `transport/car.webp`. Voiture personnelle, taxi/Uber, covoiturage, location et catégorie automobile réutilisent cette illustration.

Les sept planches de contrôle ont été inspectées. Quatre versions ont été rejetées : voiture trop réaliste, casque trop brillant, chaussure anthropomorphique et poulet trop photographique. Les remplacements ont été inspectés avant livraison. Casque final à visière mate opaque, chaussure reposant au sol sans membres ni visage, poulet sculpté et simplifié.

Export commun : **WebP qualité 82, 1200 × 600, ratio 2:1**. Les sources restent hors dépôt. Une source à ratio 1,988 a été normalisée de 0,57 % vers 2:1 à l'export ; aucun recadrage d'atlas ni découpage de référence. Les cartes principales/contextuelles utilisent 2:1 ; les petites cartes de catalogue conservent leur structure native et affichent l'objet à droite en `contain`.

```text
public/planned-visuals/builder/clay/
  intent/       social/       outing/
  food/         drinks/       transport/
  lodging/      misc/         activities/
  beauty/       clothing/     household/
  home/         tech/         automotive/
  manifest.json
```

## Registry et fallback

Mapping runtime unique : `src/app/mois-a-venir/builder-illustration-registry.json`, choix sémantique → illustration → fichier. Consommé par `builder-illustrations.tsx`, sans règles d'éligibilité, import Supabase ou calcul financier. Le manifeste public documente les sujets/exports ; il n'est pas une authority runtime.

`BuilderIllustration` conserve cartes/labels/icônes natifs, expose `personalSrc` pour de futurs visuels personnels et retire l'image en cas d'échec de chargement. Une clé inconnue rend une surface neutre. Images décoratives : `alt=""`, `aria-hidden`, lazy, décodage async, sans capture des clics.

Les noms de `WIZARD_SCENES` servent uniquement de compatibilité aux écrans secondaires. Leurs valeurs numériques ne calculent plus un emplacement d'atlas. Aucun autre chemin d'image n'est détenu par ce shim.

## Exclusions volontaires

- Lieux : **Servian, Fontès, Dax, Montpellier en tant que lieu précis, Saint-Jean-de-Védas, domicile du foyer**, autres adresses/foyers/lieux personnels et résultats de lieux réels.
- Personnes : **Amandine, Cédric, Lucas, Florentine, Juliette, Elsa, Greg, Marc, Isabelle, Chris, Adrien, Manon**, grands-parents de Manon, père/mère/grand-mère d'Adrien et autres proches réellement nommés.
- Marques : véritables logos **Swile, Edenred, Deliveroo, Uber Eats, Lady Sushi, Domino's** et autres marques. Aucune imitation Clay de logo. Les catégories alimentaires peuvent être illustrées par un objet générique sans branding.
- Photos réelles de restaurant/Google conservées dans leur chaîne existante, attribution comprise. Contacts et lieux ni créés ni modifiés pour les illustrations.

## Contrôles sans illustration

- Dates, moments, retours, champs libres, adresses : champs de saisie.
- Prix, quantités, résultats, résumés, variantes de trajet : valeurs ou projections.
- Switches de paiement, baseline, précision, Suivant/Retour, pagination, actions : commandes.
- Liens vers un projet existant : identité propre à conserver.
- « Pas encore », absence d'occasion, budget à préciser et choix libres sans objet déterminé : fallback neutre plutôt qu'un objet inventé.

## UI et interactions

Cards React/CSS : texte, icônes, badges, prix, édition, sélection et clic natifs. Hover : déplacement de 1 px et échelle 1.025 ; press discret ; sélection lavande sans recolorer l'image. `prefers-reduced-motion` désactive les mouvements.

Hub et pages de choix défilables si la fenêtre PC est courte. La fenêtre immersive est portée dans `document.body` pour sortir des couches isolées de la page : le menu ne couvre plus son en-tête ni Fermer. Gestion existante du focus, Escape et restauration du scroll conservée.

Aucune refonte responsive supplémentaire : priorité ordinateur selon la demande directe de l'utilisateur. Règles existantes conservées.

## Fichiers de code

Nouveaux : `builder-illustration-registry.json`, `builder-illustrations.tsx`, `builder-illustrations.module.css` dans `src/app/mois-a-venir`, et `scripts/check-phase2-builder-illustrations.mjs`.

Modifiés dans `src/app/mois-a-venir` :

- `contextual-project-wizard.tsx`
- `inline-expandable-asset-grid.tsx`
- `planned-builder-primitives.tsx`
- `planned-intent-builder.tsx`
- `planned-wizard-visuals.tsx`
- `planned-wizard.module.css`
- `project-hero-card.tsx`
- `project-wizard-fields.tsx`
- `project-wizard.module.css`
- `restaurant-bill-editor.tsx`
- `restaurant-wizard.tsx`

`package.json` ajoute la commande de contrôle. Documents : présent rapport, inventaire JSON, README, manifeste et annotation d'archive de `GLASS_PROMPTS.md`.

## Nettoyage

Audit `rg` sur `src`, `scripts`, `public` et `docs`. Aucun consommateur de production ne référence les dix anciennes images. Références restantes : documents historiques et assertion négative du nouveau contrôle.

Retirés : `scene-atlas-v1.png` et neuf `card-*-glass.webp` (Restaurant, Fast-food, Repas travail, Courses, Soirée, Visite, Activité, Achat, Voyage). Fond marbré utilisateur `background-planned-depense.webp`, photos et vrais logos conservés. Aucun package d'images ou tests browser ajouté.

## Vérification

Commandes dans le dépôt avec le runtime Node disponible sur ce poste, correspondant aux scripts npm suivants :

| Vérification | Résultat |
|---|---|
| `npm run check:phase2-builder-illustrations` | PASS : 210 coûts, 326 choix, 44 alias, 164 fichiers, unicité, headers WebP/dimensions, exclusions, partage voiture/dessert, fallback, reduced motion |
| `npm run check:phase2-project-wizard` | PASS : neuf goldens, invalidation/Undo, split 60→65, contrat server Preview/Save/reload synthétique |
| `npm run check:phase2-project-visuals` | PASS : photos/attributions, échecs image, sélection, isolation lieu, parity synthétique |
| `npm run check:architecture` | PASS |
| `npm run typecheck` | PASS |
| `npm run build` | PASS : compilation, TypeScript, génération des pages et optimisation Next.js 16.2.6 |
| Lint | Non configuré ; aucune suite ajoutée |

Contrôles navigateur réels sur localhost, viewport PC normal 1280 × 720 :

| Contrôle | Preuve |
|---|---|
| Hub | Neuf images chargées ; labels/icônes natifs ; en-tête et fermeture accessibles |
| Restaurant | Nous deux → date inconnue → sans occasion → restaurant pas encore choisi → transport : voiture/taxi = 207 rouge ; images chargées ; gratuit continue |
| Note | Entrée/Plat/Dessert/Vins/Bière chargés ; dessert local quantité 2 × prix 8 = 16 ; sélection/check et Continuer activés |
| Achat | Explorer les catégories → Beauté ; six produits individuels chargés, labels et pagination natifs |
| Voir quelqu'un | Adrien/Manon et neuf contacts nommés neutres sans image ; Nous deux générique illustré |

Brouillons de vérification fermés et abandonnés. Aucun Save réel, mutation Supabase, schéma ou écriture historique. Checks serveur avec I/O synthétiques des harnesses existants.

Erreur HMR transitoire pendant le renommage de l'import du registry avant l'écriture du fichier : corrigée, recompilation réussie, puis parcours et images chargés. Les timeouts initiaux pendant les générations ont été résolus avant les smokes. Aucune mesure FPS ni validation mobile revendiquée.

Captures hors dépôt : `../../outputs/builder-clay-hub.jpg`, `builder-clay-transport.jpg`, `builder-clay-bill.jpg`, `builder-clay-products.jpg`, `builder-clay-personal-fallback.jpg`, et `clay-review-01.jpg` à `clay-review-07.jpg`.

## Déploiement

Commit/push `main` selon l'autorisation utilisateur persistante. Vercel suit le workflow Git existant ; aucune vérification de production ajoutée à ce lot.
