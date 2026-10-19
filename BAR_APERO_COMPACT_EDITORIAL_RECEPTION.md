# Bar / Apéro — carte éditoriale et édition compacte

Réception locale du 18 octobre 2026. Code final : `55900176cf7c140ac897f24d3fca180b035ce008`.
Premier commit visuel : `023559913b1cf925ab9a576ebf108923ebfcd0fc` ; correctif ciblé de suivi des remounts : `5590017`.
Branche : `codex/bar-apero-compact-editorial`.
Base main vérifiée après fetch : `bd97a33d0e4280b7796e941148057b7693af0229`.

## Réalisation

- En-tête ouvert horizontal : illustration, titre, montant propriétaire et statut.
- Bande commune lieu/date/personnes/ajout de trajet ; retour réduit à une flèche avec nom accessible.
- Quantité et prix dans la tuile active ; libellés accessibles conservés. Menu secondaire ⋯ pour détails et retrait. La validation explicite du prix et la protection RAW restent actives.
- Une consommation utilise une composition horizontale ; deux tuiles se partagent l'espace ; quatre consommations tiennent sur une ligne à la largeur testée. Pagination existante conservée.
- Synthèse Before/Au bar côte à côte lorsque la largeur utile le permet. Une scène sélectionnée ne cumule pas tous les niveaux.
- Illustration stable, fond tonal, miniatures des vrais composants, états graphiques déterministes vide/partiel/riche. Les participants seuls qualifient aussi une carte partielle. Aucune décoration n'ajoute de sélection économique.
- Le Board mesure les enfants intrinsèques des cartes Bar fermées, puis réserve les pistes correspondantes. Il ne mesure pas sa propre hauteur étirée. Mesures figées pendant le drag ; observateurs nettoyés ; autres familles inchangées.
- Défaut reproduit puis corrigé : après une scène Lieu haute et un changement de page, le mesureur ouvert restait attaché à un ancien nœud. Il suit désormais le nouveau montage. Rejeu navigateur sur le code final : Lieu 405 px → synthèse 305 px, contenu intrinsèque 299,9 px. La réserve vide de 100 px disparaît.
- Le serveur de fixture sert désormais aussi les illustrations locales `builder/clay/drinks` ; il retournait auparavant du HTML pour ces URLs. Aucun accès distant ajouté.

## Mesures navigateur réellement exécutées

Navigateur Codex, React compilé/minifié `NODE_ENV=production` avec esbuild, données synthétiques et persistance HTTP locale. Ce n'est pas un build Next complet ni une certification Supabase authentifiée. Mesure par `getBoundingClientRect()` après stabilisation ; aucune durée de l'outil n'est utilisée comme métrique produit.

| Largeur effective | Édition d'une bière avant | Après | Tuile avant / après |
|---|---:|---:|---:|
| 1440 × 900 | 445 px | 285 px | 201,5 / 84,6 px |
| 1728 × 900 | 445 px | 285 px | 201,5 / 84,6 px |
| 1920 × 1080 | 445 px | 285 px | 201,5 / 84,6 px |

Réduction observée de hauteur : 160 px (36 %). Une configuration visuelle par largeur ; pas de P95 ni de mesure de fluidité statistique. L'avant utilise le code main et une bière ×1 UNKNOWN ; l'après conserve la même configuration de carte. Une seconde fixture de comparaison partage le même scénario synthétique entre les deux serveurs. Les positions/pages des voisins peuvent varier ; la comparaison porte sur les rectangles de la carte et de sa tuile, pas sur une latence financière.

Les premières illustrations étaient absentes dans le serveur de référence, mais leurs dimensions étaient explicitement réservées par CSS. Le défaut de serveur a été corrigé pour vérifier les vraies images du candidat ; zéro image cassée relevée sur la carte candidate.

Autres relevés :

- Quatre consommations : carte 305 px, quatre tuiles de ~179,7 × 106,6 px ; zéro chevauchement mesuré avec les cellules voisines, zéro scroll vertical interne, zéro débordement horizontal du document.
- Synthèse Before + bière : carte 305 px ; deux sections de ~368 px côte à côte.
- Carte fermée riche : 315 px après finition, contenu intrinsèque ~308,4 px, réserve arrondie aux pistes du Board.
- Carte vide finale : 135 px à 1440 px, contenu ~132,1 px, zéro faux composant. La première variante à 185 px a été rejetée et corrigée pour que la décoration ne gonfle pas la carte.

Preuves locales non publiées : `outputs/bar-compact/geometry.json`, captures `final-simple-1728.png`, `summary-1728.png`, `four-1728.png` et captures finales. Les captures transitoires prises pendant un reflow ne constituent pas une preuve de chevauchement stable.

## Interactions

| Contrôle | Résultat et niveau de preuve |
|---|---|
| Création immédiate / édition dans la carte | PASS navigateur synthétique |
| RAW prix 6 → navigation date → continuer à modifier | PASS navigateur ; valeur 6 conservée |
| Validation 6, menu ⋯, retrait, Undo | PASS navigateur ; bière et prix restaurés |
| Before vodka partagée 20 + bière 6 | PASS navigateur ; total propriétaire 26 après Preview, unités distinctes |
| Quatre consommations et accès à leur page | PASS navigateur |
| Sauvegarde/rechargement local | PASS fixture HTTP ; Before et consommations retrouvés ; aucune preuve Auth/RLS distante supplémentaire |
| Date et lieu enregistré de fixture | PASS navigation/choix explicites ; pas de Google ni de fournisseur externe appelé |
| Richesse vide/partielle/riche | PASS observations vide, bière et Before ; condition participants seuls conservée dans le code |
| Drag natif et très gros Board | NOT_RUN sur cette tranche ; géométrie figée pendant le drag préservée dans le code |
| Production / nouvelle session Supabase | NOT_RUN ; aucune nouvelle écriture de production |

Deux interactions envoyées très près d'un reflow/résultat asynchrone ont nécessité une nouvelle observation puis une navigation après stabilisation ; aucune mutation n'a été répétée aveuglément. Cela ne certifie pas une campagne de stress des interactions rapides.

## Régressions exécutées

- P1 : 25 groupes PASS, notamment RAW, suppression, Undo, réponses asynchrones et conservation.
- P2 : 20 groupes PASS, dont lecture seule/protections, endpoints et trajet combiné historique.
- Dernière réception UX : 8 groupes PASS, dont scènes, pagination 15 consommations/9 objets Before, réédition et retrait parent.
- P4 : 14 groupes PASS, dont Preview → Apply → Reload → Mon Plan sur PostgreSQL synthétique isolé, mêmes identités.
- Parité historique : 22 scénarios × 9 empreintes = 198 PASS ; goldens non modifiés.
- C8-017 : PASS assertion originale ; aucune media query de largeur ajoutée.
- TypeScript : PASS, code de sortie 0.
- Revue React ciblée : états visuels dérivés, pas d'effet financier, pas de nouvelle lecture réseau, observateurs nettoyés et mesure coalescée par frame, libellés accessibles et actions protégées.

Journaux exacts dans `outputs/bar-compact/`. Les avertissements `react-test-renderer is deprecated` sont conservés.

### Build complet : NOT_CERTIFIED

Deux commandes exécutées en environnement local autorisé :

1. `node node_modules/next/dist/bin/next build --webpack` → sortie 1, `UnhandledSchemeError node:crypto`, chemin existant `analytics/history-v2/facts-hash.ts` → `exploration-runtime-host.tsx`. Aucun fichier de ce chemin n'est modifié.
2. `node node_modules/next/dist/bin/next build` → sortie 1, Turbopack refuse la jonction `node_modules` pointant hors de sa racine.

Le bundle de fixture compilé/minifié réussit et a été testé, mais ne remplace pas ce gate. Aucun contournement du build, installation de dépendances ou changement de configuration produit effectué pour masquer les erreurs.

## Illustration

Outil intégré ImageGen, génération neuve puis réduction/encodage WebP transparent 512 × 512 :
`public/planned-visuals/builder/clay/drinks/bar-editorial.webp`, 38 156 octets.
SHA-256 : `CC9CB8AC3798E878756C2C8D1AB7B53EBEDAC037672CAA2C4CD376FE1F390F55`.

Prompt final : « Use case: stylized-concept. Project asset, not a UI screenshot: a premium warm editorial clay illustration for the side of a French personal budgeting application's Bar / Apéro card. Small inviting bar vignette: curved terracotta counter, one sculptural amber beer glass and a pale peach cocktail glass, tiny olive bowl, a gentle arched backdrop in dusty apricot. Charming tactile matte ceramic/clay, soft studio shadows, restrained cream amber terracotta sage palette. Compact square composition, objects grouped, three-quarter view, crisp readable silhouette at 100 px, transparent background. No people, no brands, no lettering, no numerals, no UI, no money, no photo. This is purely decorative category identity, not a representation of the user's selected drinks. »

L'image décorative a un alt vide ; elle ne prouve aucune consommation. Les produits sélectionnés restent des éléments interactifs distincts. Aucune image distante des liens d'inspiration n'est embarquée.

## Périmètre et verdict

**IMPLEMENTED_LOCAL — VISUAL_FIXTURE_PASS — NEXT_BUILD_NOT_CERTIFIED.**

Aucun changement de Compiler, Finance V2, contrats sémantiques, writers, Apply/CAS, SNAP-3 ou RLS. Aucune migration, aucun Apply réel, aucune donnée bancaire modifiée. Les incidents Canonical et de sauvegarde riche observés lors de la précédente réception Production restent des réserves héritées ; cette refonte locale ne prétend pas les résoudre.

Branche locale seulement ; aucune fusion ou promotion Production effectuée pour cette nouvelle refonte. La validation distante du build et la réception authentifiée de cette version restent à réaliser avant une revendication de livraison Production. Rollback : revert des deux commits produit, du plus récent au plus ancien ; aucune donnée persistée ne nécessite de transformation.
