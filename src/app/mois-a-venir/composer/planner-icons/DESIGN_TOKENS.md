# Clay — Composer desktop

Les objets du mois utilisent uniquement le registre `PlannerIcon`. Le fallback
est également un objet Clay. Lucide est réservé aux actions et aux marqueurs
d'état : focus, lien, verrou, recherche, undo/redo, fermeture et retrait.

| Token | Usage |
| --- | --- |
| `--ink: #252d48` | Texte navy |
| `--focus: #9b82c1` | Focus lavande |
| `--amber: #a77834` | Inconnue / attention |
| 52 / 30 / 34 / 32 px | Objet / satellite / palette / Library |
| 15–20 px | Rayon des cartes ; satellites ronds |

Les SVG partagent `ClayFrame`, le viewBox 64×64, deux ellipses de contact et les
extrémités arrondies. Les peintures mates emploient trois tons peu espacés, de
haut-gauche vers bas-droite : ivoire/perle et un ou deux accents lavande, sauge,
bleu, pêche ou or. Les identifiants de gradient sont uniques via useId ; le
registre est memoized. Aucun filtre SVG coûteux ou bitmap. Les détails restent lisibles à 30 px.
Les montants sont tabulaires et proviennent exclusivement du serveur.

Motion : hover/lift 140 ms, focus/palette 190 ms, snap 240 ms, page/reparent
210 ms, changement de valeur 300 ms, corbeille 180 ms. Le dwell de pagination pendant drag dure 600 ms.
Reduced-motion supprime les transitions. Le mouvement ne modifie ni identité,
ni décision, ni compatibilité, ni couleur métier.

La palette est un overlay de 104 px : aucun espace réservé lorsqu'elle est
fermée. La pagination de 30 px apparaît seulement en débordement. La sélection
reste active et la palette garde son Context lors d'un changement de page.
Les pages restent montées, les pages inactives sont inert, pour conserver la
source du drag natif. Le packing alterne les silhouettes dans un ordre stable,
exclusivement visuel. Largeurs : SIMPLE 196, HABIT 212, COMPOSITE 288, SAVINGS 236 px.

Couches CSS : `--z-board:0` < `--z-card:1` < `--z-selected:2` <
`--z-satellite:3` < `--z-ghost:4` < `--z-palette:5` < `--z-popover:6` <
`--z-trash:7` < `--z-modal:8`. Les popovers/dialogs natifs utilisent aussi la
top layer du navigateur. Les cellules et cartes gardent overflow visible ;
seul le viewport du carousel contient les pages inactives.
