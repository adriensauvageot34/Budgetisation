# Suggestions contextuelles Achat, Vêtements, Mascara et Courses

Base de travail `476a4517a22f11a874dcd2e8e09d4195a7fda2a0` (PR #118). Doctrine `STRAT:P21-RECENTRAGE@v1`.

| Domaine | Suggestions et interactions |
| --- | --- |
| Achat / Amazon | Le panier `purchase@v2` propose le premier article, une ligne à préciser ou à modifier, le vendeur et la livraison. Les homonymes ouvrent un choix numéroté avec quantité, unité et prix. La livraison comprise conserve le total des articles. Les frais distincts déjà saisis rouvrent leur ligne. Les autres vendeurs compatibles utilisent les mêmes actions. |
| Vêtements | Le panier propose de préciser un vêtement ou une chaussure, puis d’ajouter, de modifier ou de retirer une ligne selon ses droits. La fiche historique conserve sa ligne et propose son édition ou une conversion explicite vers le panier. |
| Mascara | La fiche Beauté propose de préciser le produit vide, puis ouvre le prix et la quantité de la sélection existante. Une référence de renouvellement liée peut être consultée lorsque le propriétaire la publie. |
| Courses | Le panier propose le premier produit, l’ajout, la ligne à compléter et les frais admissibles. Le total brut reste lisible séparément de la relation à une enveloppe. |

Les suggestions réutilisent le classement déterministe, `ContextPalette` et le masquage de session du Shell. Quatre propositions au plus sont visibles dans chaque résumé. Les sélections reprennent leurs Clay du catalogue, et le Dock Mascara reprend le visuel `beauty:mascara`. Le choix d’une suggestion ouvre le formulaire et conserve le digest. La validation passe par `EDIT_PURCHASE_BASKET` ou le propriétaire Beauté. Les protections RAW, l’historique et le digest attendu du panier restent actifs.

Les prix et quantités utilisent les contrats existants. Une quantité de panier doit être positive au moment de la validation. Les prix inconnus restent inconnus. Le catalogue reste accessible pour choisir un produit. La pertinence du vendeur, des articles et de la livraison vient des règles de l’éditeur.

| Contrôle | Preuve |
| --- | --- |
| Achat | 48 € d’articles, 48 € avec livraison comprise, 53 € avec 5 € de frais et 55 € après modification ciblée du prix unitaire de deux shampoings. Le contrôle de concurrence refuse une commande issue d’un ancien digest. |
| Vêtements | Trois lignes dont deux T-shirts homonymes. Édition et retrait ciblés, autres lignes et identités conservées, prix inconnu pris en charge. |
| Mascara | Prix inconnu, saisie française à 12,50 €, quantité, identité et refus d’une capability absente. Consultation d’un lien synthétique publié et absence de renouvellement implicite. |
| Courses | Pâtes, lait et pain totalisent 8 €. La fixture officielle publie une enveloppe. Le Compiler reconnaît la consommation explicite à contribution additionnelle nulle et le cas en plus de l’enveloppe. L’enveloppe du foyer authentifié reste hors de cette preuve. |
| Navigateur local | 1 280 × 720 et 390 × 844. Les quatre parcours ont utilisé le serveur Composer synthétique. Consultation, masquage, homonymes, RAW, Undo/Redo et réouverture ont été observés. |

La taille, le stock et les références commerciales des vêtements restent en dehors de l’éditeur. S3 et la création de besoins de renouvellement restent différés. La disponibilité d’une enveloppe en session authentifiée dépend des sources publiées par le foyer.
