# Phase 2 — C8 calendrier, liste et forecast

Certification du 30 septembre 2026, dépôt courant après C6/C7.

## Résultat

- Une root : un item de liste, une occurrence datée maximum, une contribution au
  forecast. Les children ne deviennent pas des événements supplémentaires.
- Montant brut exact dans la cellule, même si le supplément central est nul ou
  si le financement combine Banque et titres-restaurants.
- États certain/prévu/réalisé textuels, couleurs et icônes existantes. Marqueur de
  date estimée attaché à l'événement. Aucun barré, statut CANCELLED ou date inventée.
- Densité ordinateur : un à trois éléments visibles, puis top deux et +N.
  Ordre canonique du MASTER centralisé. Charges et projets sans date dans « À dater ».
- Tiroir à droite : total, éléments, état, certitude, coûts, financement, impact,
  lieux et trajet. Les actions utilisent les mutations existantes du Builder.
- Chaque mutation relit le même read model serveur ; les brouillons ouverts sont
  protégés contre une action du tiroir qui les remplacerait.

## Preuves exécutées

`scripts/check-phase2-planned-calendar.mjs` exerce les vraies actions/services et
le moteur avec une frontière SQL simulée, ainsi que le rendu des vrais composants.
CAL-01..27, META-20 : gross/baseline/funding, densité, ordre, états, sans date,
édition du montant et de la date, child place/route, déclaration, correction,
restore, report et suppression. Chaque relecture vérifie l'identité et les
projections, avec des fixtures synthétiques et sans écriture historique.

Navigateur local connecté, lecture seule, le 30 septembre :

- Un seul point d'entrée Tab dans la grille.
- Flèche droite depuis le jour 4 : focus 5 ; flèche bas depuis 5 : focus 12.
- Entrée et Espace ouvrent le tiroir du jour 4 et ses cinq éléments.
- Tab et Maj+Tab restent dans le tiroir, même lorsqu'il contient un seul bouton.
- Échap ferme le tiroir ; focus rendu au jour 4.
- Hauteur de grille avant, pendant et après : 840 px ; aucun déplacement vertical.
- Aucun message console de niveau error au contrôle final.

Le premier essai Tab a révélé une sortie du focus vers le navigateur : ajout d'une
boucle explicite aux extrémités, puis vérification positive Tab/Maj+Tab/Échap.
Les délais initiaux de connexion au navigateur ont été résolus via un onglet neuf.
La capture visuelle locale reste hors du dépôt, car elle affiche des données du foyer.

Les mutations lifecycle réelles dans le navigateur ne font pas partie de ce smoke
test : leurs preuves automatisées sont distinctes. GATE-21 reste à finaliser en C10.

La régression C4 attendait encore l'égalité de tout le financement entre les deux
états. Elle vérifie désormais le contrat DD4 : économie et allocation Banque
conservées, mais 25 € passent de réservé à utilisé déclaré. Aucun attendu financier
n'a été régénéré depuis le résultat du moteur ; aucun moteur n'a été modifié.

## Gates

```ini
C8_CALENDAR = PASS
SINGLE_ROOT_PROJECTION = PASS
CALENDAR_GROSS_TRUTH = PASS
LIST_CALENDAR_FORECAST_SYNC = PASS
ACCESSIBILITY_CONTRACT = PASS
```

Périmètre ordinateur, aucun chantier responsive. Publication par push sur main ;
aucune vérification Vercel effectuée, conformément à la demande utilisateur.
