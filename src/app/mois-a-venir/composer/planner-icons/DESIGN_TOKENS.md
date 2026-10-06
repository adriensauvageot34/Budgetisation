# Clay — Composer desktop

Les objets du mois utilisent uniquement le registre `PlannerIcon`. Le fallback
est également un objet Clay. Lucide est réservé aux actions et aux marqueurs
d'état : focus, lien, verrou, recherche, undo/redo, fermeture et retrait.

| Token | Usage |
| --- | --- |
| `--clay-ivory: #fffdf8` | Matière des cartes |
| `--clay-pearl: #f5f1f6` | Plateau doux |
| `--clay-shadow: #59436512` | Ombre diffuse, sans contour noir |
| `--clay-focus: #a591bc` | Focus lavande |
| `--clay-savings: #eef1e7` | Réservation, sans promesse de rendement |
| 54 / 30 / 34 px | Objet / satellite / Library et palette |
| 20–26 px | Rayon des cartes ; satellites ronds |

Les SVG partagent `ClayFrame`, le viewBox 64×64, l'ombre au sol et les extrémités
arrondies. Les faces claires sont orientées en haut à gauche ; les volumes gardent
les tons ivoire, sauge, lavande et sable. Les détails restent lisibles à 30 px.
Les montants sont tabulaires et proviennent exclusivement du serveur.

Motion : hover 120 ms, lift 140 ms, focus/palette 190 ms, snap/plateau/reparent
210 ms, corbeille 180 ms. Le dwell de pagination pendant drag dure 600 ms.
Reduced-motion supprime les transitions. Le mouvement ne modifie ni identité,
ni décision, ni compatibilité, ni couleur métier.

La palette réserve 104 px et les contrôles de plateau 32 px. Sélectionner une
carte ne modifie pas la hauteur disponible. Le packing utilise des dimensions
DOM et un ordre déterministe, exclusivement dans la couche de présentation.
