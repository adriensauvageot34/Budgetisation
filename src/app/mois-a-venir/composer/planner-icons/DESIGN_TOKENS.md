# Clay — Composer desktop

Les objets du mois utilisent uniquement le registre `PlannerIcon`. Le fallback
est également un objet Clay. Lucide est réservé aux actions et aux marqueurs
d'état : focus, lien, verrou, recherche, undo/redo, fermeture et retrait.

| Token | Usage |
| --- | --- |
| `--ink: #0a1738` | Titres et montants navy |
| `--focus: #7949ef` | Focus violet visible |
| `--amber: #a77834` | Inconnue / attention |
| 76 / 40 / 40 / 44 px | Objet / satellite / palette / Library |
| 15–20 px | Rayon des cartes ; satellites ronds |

Les SVG partagent `ClayFrame`, le viewBox 64×64 et deux ellipses de contact.
Les volumes colorés utilisent des dégradés mats cohérents de haut-gauche vers
bas-droite. Ivoire et perle restent secondaires. Les identifiants de gradient
sont uniques via useId et seuls les matériaux employés par chaque silhouette
créent des gradients ; aucun filtre SVG coûteux ou bitmap. `icon-registry.ts`
est le registre terminal unique. Il choisit les silhouettes spécifiques sur
les références stables publiées, sans analyser les libellés.
Les montants sont tabulaires et proviennent exclusivement du serveur.

Motion : hover/lift 140 ms, focus/palette 190 ms, snap 240 ms, page/reparent
210 ms, changement de valeur 300 ms, corbeille 180 ms. Le dwell de pagination pendant drag dure 600 ms.
Reduced-motion supprime les transitions. Le mouvement ne modifie ni identité,
ni décision, ni compatibilité, ni couleur métier.

La palette est un overlay de 104 px : aucun espace réservé lorsqu'elle est
fermée. La pagination de 30 px apparaît seulement en débordement. La sélection
reste active et la palette garde son Context lors d'un changement de page.
Les pages restent montées, les pages inactives sont inert, pour conserver la
source du drag natif. La couche P1/P2 compose les surfaces dans un ordre stable,
exclusivement visuel : cartes simples 230 px, Saving 290 px, grands Contexts
340 px, petits Contexts Cadeau/Famille 260 px, clusters Beauté 390 px et
Restauration 430 px. Les objets non regroupés restent accessibles sur les
pages suivantes ; aucune position n'entre dans le brouillon.

Couches CSS : `--z-board:0` < `--z-card:1` < `--z-selected:2` <
`--z-satellite:3` < `--z-ghost:4` < `--z-palette:5` < `--z-popover:6` <
`--z-trash:7` < `--z-modal:8`. Les popovers/dialogs natifs utilisent aussi la
top layer du navigateur. Les cellules et cartes gardent overflow visible ;
seul le viewport du carousel contient les pages inactives.
