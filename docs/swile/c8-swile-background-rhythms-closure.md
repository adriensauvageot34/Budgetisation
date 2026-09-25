# C8 — Clôture Swile / Rythmes de fond

## État publié

- `FINAL_HEAD_SHA` du code certifié et du manifest G1 : `4bee4dfa4b03d074f03586aec3d8061acd3b462f`.
- Révisions finales : `data_revision = 9`, `analytics_revision = 110`.
- Publication active et G1 : `e63bd2bc-cf06-51b7-a941-17c8e47d8b2a` ; une seule génération active.
- Topologie active : 759 Query snapshots, 17 artifacts, dont 13 snapshots BackgroundRhythms.
- Lot importé : `7077ed65-e20f-5def-aa4f-60befae4dffa` ; SHA-256 du classeur source : `e55c3712cef1c806fbb26984e518df78afb461a8823682f45164f8ce8baa54fb`.
- Recette déterministe de rollback certifiée, non exécutée : `07863b97-98e2-5b2a-9f84-2c70657f2bd7`.

## Preuves finales

- FOOD annuel : sous-total exact connu `8443.82 EUR`, minimum `8546.07 EUR`, statut `LOWER_BOUND` ; 12 mois, dont 6 `KNOWN` et 6 `LOWER_BOUND`, et trois flux Courses / Restaurants / Livraisons.
- Smoke ReadModel/UI actif : sémantique « ≥ / au moins », financement titre-restaurant secondaire dans le focus mensuel, achats mixtes et sans Operation présentés au montant brut, canal Uber Eats secondaire, médiane restaurant `GATED`, occurrence livraison `UNKNOWN`.
- CAR annuel et un détail mensuel actifs : lisibles et sans contamination Benefit/Swile. Égalité CAR certifiée inchangée en C6.
- Égalité C6 hors périmètre : 746/746 Query snapshots et 16/16 artifacts.
- Budgets certifiés : 46 114 octets pour l'annuel BackgroundRhythms ; 148 446 octets pour la fonctionnalité.
- Replay final du même classeur via l'importeur live : `EXACT_REPLAY`, zéro insertion, mise à jour, suppression ou mutation sémantique. Les révisions `D9/A110`, la publication G1 et les comptes d'import sont inchangés.

## Limite connue

Un snapshot source modifié sans identifiants natifs du fournisseur exige une réconciliation explicite avant import ; seul le replay du même fichier est certifié sans mutation.
