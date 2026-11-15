# Composer V22 — P22-03 · Édition directe sur ordinateur

Recette du 14 novembre 2026. `STRAT:P21-RECENTRAGE@v1`.

## A — État initial

La branche locale `codex/p22-03-desktop-ux` part de `0f7e24efb84d1af7f830f67e5ac4fb554f16ad88`, rapport P22-02, et contient le correctif `b651e52ed7a5a590a8c22f7d82e2e94ea85657f7`. GitHub `main` et l’alias Production Vercel ont été vérifiés au SHA `47f73aaffc70f8e5101defef546e138e52e24617`, déploiement `dpl_58FP9Hn8yECmhcxiFBiosSDwgMg4` READY. La branche P22-03 cible la recette locale. Le travail Cadeau reste dans le dépôt d’origine. Les empreintes SHA-256 des deux fichiers ont été vérifiées avant et après.

Les trois parcours pilotes ont été joués dans Chromium à 1 280 × 720 avant le changement. L’examen a couvert les éditeurs de composant Beauté, Achat, Cinéma/Restaurant et Séjour, le sélecteur d’intention, le panneau Projet, la Library et le Dock.

| Geste initial | Clics observés | Friction | Intervention et risque contrôlé |
|---|---:|---|---|
| Prix sur la deuxième ligne Amazon | 3 | Ouverture sur le nom puis clic sur le champ prix | Ouvrir au prix via la valeur de la ligne. Réutiliser sa sélection, le formulaire et sa validation. |
| Quantité sur cette même ligne | 3 | Même détour par le nom | Ouvrir à la quantité en conservant unité et identité. |
| Prix et quantité du premier poste Mascara | 5 | Prix validé, retour au résumé, réouverture pour la quantité | Réutiliser le formulaire court dès le premier poste. Conserver la création et le traitement RAW existants. |
| Départ et retour du Week-end | 3 | Passage par le Dock pour basculer entre deux pages | Réunir les dates dans la même section, avec une seule validation de la période. |
| Billet et date Cinéma | 3 chacun | Le titre du panneau reprend le focus | Placer le focus sur le champ quand il existe. |
| Ajout d’un article Amazon | 2 par ligne | Le parcours est déjà direct | Garder l’ajout et la confirmation. Redonner le focus à la ligne après validation. |
| Enfant, retour au parent et occurrence retrouvée | 1 chacun | L’accès direct existe dans P22-02 | Préserver le geste, les IDs et le focus. |
| Supplément Restaurant | 3 | Le choix « Supplément réel » qualifie son effet sur l’addition | Garder cette décision explicite. |

## B — Mesures avant/après

Comptage à partir du résumé ou de la liste ouverte jusqu’à la validation. Saisie clavier, création du parent et navigation commune exclues. Les clics supplémentaires d’instrumentation RAW et de changement de focus sont mesurés séparément.

| Action | Avant | Après | Gain réel |
|---|---:|---:|---|
| Modifier le prix d’une ligne Amazon | 3 | 2 | 1 clic |
| Modifier la quantité d’une ligne Amazon | 3 | 2 | 1 clic |
| Premier prix + quantité du Mascara | 5 | 2 | 3 clics |
| Prix du billet Cinéma | 3 | 2 | 1 clic |
| Date de séance | 3 | 2 | 1 clic |
| Départ + retour du Week-end | 3 | 2 | 1 clic |
| Ajout d’un deuxième article | 2 | 2 | Parcours conservé |
| Ouvrir un enfant / revenir au parent | 1 / 1 | 1 / 1 | Parcours conservé |
| Reprendre une occurrence depuis la recherche | 1 | 1 | Parcours conservé |
| Addition / supplément Restaurant | 2 / 3 | 2 / 3 | Validations conservées |
| Première saisie de l’hébergement par nuit | 3 | 3 | Choix de la base tarifaire conservé |

Sur les six gestes raccourcis, la séquence comparée passe de **20 à 12 clics**. L’hébergement déjà chiffré est aussi accessible par le prix affiché. Son ouverture en un clic a été vérifiée après changement. Le gain par rapport au raccourci du Dock n’est pas compté.

| Action à 1 280 × 720 | Temps cumulé des clics avant → après |
|---|---:|
| Mascara, prix + quantité | 524 → 219 ms |
| Prix Amazon | 286 → 256 ms |
| Quantité Amazon | 235 → 190 ms |
| Billet | 307 → 301 ms |
| Date de séance | 268 → 197 ms |
| Période | 281 → 297 ms |
| Ouverture enfant | 112 → 229 ms |
| Retour parent | 140 → 205 ms |
| Reprise Mascara depuis la recherche | 92 → 120 ms |

Ces durées sont celles des actions `locator.click` lors d’une exécution locale par version, hors saisie et délai de sauvegarde. La variance inclut le chargement des éditeurs et le placement du viewport par Chromium. La période et les transitions mesurées ne montrent pas de gain de temps reproductible. Le gain démontré concerne le nombre de clics et le focus.

## C — Modifications

- `equipment-component-editor.tsx` présente prix et quantité dans le formulaire Beauté existant dès la création d’un poste en unités. Le chemin de configuration avancée reste disponible.
- `purchase-basket-editor.tsx` et `purchase-basket.module.css` rendent le prix et la quantité cliquables sur une ligne admise. Le formulaire existant met le focus sur le champ ciblé, y compris quand on change de champ avant de saisir. Après validation, le focus revient à « Modifier » sur la même ligne par `selectionId`. Les commandes d’ajout du résumé sont masquées pendant l’édition ou le choix d’une ligne.
- `restaurant-editor.tsx` déplace le focus du titre vers le champ date ou montant lorsque celui-ci existe. Les consultations de lieux, participants, budget et les confirmations existantes suivent les mêmes droits.
- `family-visit-editor.tsx` présente les deux dates dans le même écran de séjour. La date affichée ouvre cet écran si la capability est admise. Le Dock remplace les deux entrées Départ et Retour par Période dans cette scène. Le calendrier des visites conserve ses commandes.
- `short-stay-editor.tsx` relie le prix affiché de l’hébergement à l’éditeur admis déjà utilisé par la suggestion. Le tarif par nuit ou forfait et sa sélection conservent leur autorité existante.

La grille des cartes fermées et la Library ont été conservées. Au point de mesure commun, le rail est resté à 946 px pour Amazon et à 520 px pour Projet et Séjour. L’éditeur actif occupe le même panneau. La période demande plus de hauteur interne car les deux dates sont accessibles ensemble. Les six fichiers modifiés sont dans le dossier Composer. La revue TSX a suivi les règles Vercel React sur les effets liés au focus, les références transitoires et la préservation du chargement progressif.

## D — Recette et preuves

| Contrôle | Résultat |
|---|---|
| Chromium 1920 × 1080, 1440 × 900, 1280 × 720 et 1024 × 576 CSS | 12/12 PASS dans la matrice des trois parcours. Dernier ajustement de focus Amazon rejoué séparément à 1280 × 720. Aucun débordement horizontal sur les captures et séparation panneau/Dock mesurée de 22 à 36 px dans la matrice. |
| Chrome avec zoom natif à 125 % | 3/3 PASS dans un profil de recette. Réglage Chrome confirmé, surface mesurée à 1024 × 576 CSS pour 1280 × 720 physiques. |
| Focus clavier | Le champ de prix ou de quantité visé reçoit le focus dans Amazon, même après changement de cible sans saisie. Au retour de l’enfant, le bouton de cette occurrence reste ciblé. Le billet et la date Cinéma prennent le focus lors de l’ouverture. |
| RAW et Undo/Redo | `9,` refusé et conservé, sans mutation du digest. `9,50` validé. Undo puis Redo de la quantité du deuxième article retrouvent les digests attendus. |
| Persistance C8 | Le second article conserve son `selectionId` au rechargement. Le premier homonyme reste identique. La date Cinéma, l’addition et le supplément Restaurant conservent leurs cibles. Le séjour relit sa période et son hébergement après navigation par Musée. |
| Vérifications de contrat | A1 Beauté, panier `purchase@v2`, suggestions Restaurant/Cinéma, détails Restaurant, séjour A06 et compléments Projet PASS. Les bancs couvrent UNKNOWN/zéro, quantités, coûts inclus, suppléments, forfait et nuit, droits et conservation des enfants. TypeScript et `git diff --check` PASS. |
| Production et données | Recette du nouveau code en Production NOT_RUN. Les bancs navigateur et les écritures C8 emploient un périmètre synthétique isolé. Aucune donnée financière personnelle utilisée. |

[Mesure avant](<C:/Users/AdrienSauvageot/Documents/Codex/2026-11-06/je-te-confie-la-premi-re/work/repo/outputs/p22-03/baseline-measured/results.json>) · [Matrice Chromium](<C:/Users/AdrienSauvageot/Documents/Codex/2026-11-06/je-te-confie-la-premi-re/work/repo/outputs/p22-03/after/results.json>) · [Zoom natif et Undo/Redo](<C:/Users/AdrienSauvageot/Documents/Codex/2026-11-06/je-te-confie-la-premi-re/work/repo/outputs/p22-03/native/results.json>) · [Changement direct de champ Amazon](<C:/Users/AdrienSauvageot/Documents/Codex/2026-11-06/je-te-confie-la-premi-re/work/repo/outputs/p22-03/basket-final/results.json>) · [Avant, période](<C:/Users/AdrienSauvageot/Documents/Codex/2026-11-06/je-te-confie-la-premi-re/work/repo/outputs/p22-03/baseline-measured/weekend-musee-periode-1280.png>) · [Après, période](<C:/Users/AdrienSauvageot/Documents/Codex/2026-11-06/je-te-confie-la-premi-re/work/repo/outputs/p22-03/after/weekend-musee-periode-1280.png>) · [Prix Amazon au zoom natif](<C:/Users/AdrienSauvageot/Documents/Codex/2026-11-06/je-te-confie-la-premi-re/work/repo/outputs/p22-03/native/mascara-amazon-prix-1024.png>).

## E — Reste à améliorer

- **Friction observée.** Les informations détaillées continuent à défiler sur une fenêtre compacte. Les valeurs de panier sont accessibles directement, mais le résumé de budget occupe encore une partie du panneau. L’ajout et le passage d’un enfant à l’autre étaient déjà directs.
- **Capacités.** L’édition dépend des droits de l’occurrence, du socket et de la sélection. Les personnes et les lieux gardent leurs éditeurs admis. La reprise d’une réservation réelle n’est pas proposée par le calendrier de séjour.
- **Autres phases.** Le classement S1/S2/S3, la profondeur des cartes fermées et la manipulation native Drag & Drop ne font pas l’objet d’un changement P22-03. Le drag natif n’a pas été recertifié. Le rendu et la persistance authentifiée du correctif restent à vérifier après une publication autorisée.

## F — Synthèse

Pour un Mascara neuf, le prix et la quantité se règlent dans la même ouverture. Dans le panier, les valeurs conduisent directement au bon champ et la validation remet le focus sur la bonne ligne. Le billet et le calendrier s’ouvrent au champ utile. Dans un séjour, on peut corriger le départ et le retour ensemble. Les six gestes mesurés enlèvent huit clics. Les règles métier, les montants officiels et la navigation Projet de P22-02 sont conservés.
