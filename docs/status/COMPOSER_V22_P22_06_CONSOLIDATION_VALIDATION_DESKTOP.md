# Composer V22 — P22-06 — Consolidation et validation desktop

14 novembre 2026 · `STRAT:P21-RECENTRAGE@v1`

## A — État Git réel

La branche candidate `codex/p22-06-desktop-validation` part de `codex/p22-05-excel-recommendations`, au SHA applicatif `9b815ae627e954db3688d02558372e20d639dfe1`. Son ascendance contient les cinq commits P22, dans cet ordre.

| Commit | Contenu |
| --- | --- |
| `b651e52ed7a5a590a8c22f7d82e2e94ea85657f7` | Panneau Projet, Dock et retour vers un enfant |
| `0f7e24efb84d1af7f830f67e5ac4fb554f16ad88` | Réception P22-02 |
| `467944e398d19ceeb0645ee76e23a2ed6993c289` | Édition directe P22-03 |
| `7fd883867ea49cfb3c35533570d32dedf274d02e` | Suggestions et focus P22-04 |
| `9b815ae627e954db3688d02558372e20d639dfe1` | Catalogue vérifié et recommandations P22-05 |

GitHub main et la référence locale `origin/main` correspondent à `47f73aaffc70f8e5101defef546e138e52e24617`. L'alias Production Vercel retourne ce SHA et le déploiement `dpl_58FP9Hn8yECmhcxiFBiosSDwgMg4`, READY. Les cinq commits P22 restent au-dessus de cette base.

GitHub déclare toujours la PR #123 ouverte, avec le HEAD `a80748c542f4c6a483b4c828e4b17076ac135e70`. La comparaison locale de cet arbre avec main retourne zéro différence. Le contenu P21 est donc déjà présent dans main. Aucune PR P22 n'a été trouvée par la recherche GitHub, et aucun déploiement ne correspond au SHA P22-05.

Avant P22-06, le diff P22 par rapport à main comporte 29 fichiers, 950 ajouts et 126 suppressions. P22-06 ajoute le présent rapport et un banc navigateur réutilisant les fixtures C8. Le code applicatif consolidé reste celui de P22-05. Le SHA exact du commit de validation est communiqué dans le compte rendu final.

Le worktree candidat est `work/pr123-final-code-review`. Le worktree d'exécution `work/pr123-validation-e067ab8` utilise les sources applicatives du candidat avec les dépendances déjà installées. Les 208 sources applicatives contenues dans le bundle C8 ont été rapprochées du candidat, sans différence de contenu après normalisation des fins de lignes et des espaces terminaux.

Le travail Cadeau reste dans `work/repo`. Empreintes avant/après attendues et vérifiées :

| Fichier | SHA-256 |
| --- | --- |
| `scripts/check-composer-project-completion.mjs` | `7c1ea766c7ea528da4b3c1409cf4832d78b0a0ed944b7365442420585aa541f1` |
| `src/app/mois-a-venir/composer/catalog-context-editor.tsx` | `b934b2a0f50f52c45553aa1e72459dc9652f1d31d05ff1110a685fd0b54bbeee` |

Le rapport P22-01 non suivi reste hors du commit de validation. Aucun remplacement de ces travaux locaux n'a été nécessaire.

## B — Intégration des missions

| Mission | Présence réelle dans la candidate | Contrôles sur la consolidation | Limite distante |
| --- | --- | --- | --- |
| P22-01 | Géométrie Projet/Dock dans le correctif P22-02 | Mesures et captures de projets Cinéma, séjour et Maison | Preview P22 absente |
| P22-02 | Navigation parent/enfant et focus de retour | Ouverture de chaque enfant par ID, retour au parent et rechargement | Preview P22 absente |
| P22-03 | Champs directs prix, quantité et période | Éditions ciblées Amazon, Mascara, billet et hébergement | Preview P22 absente |
| P22-04 | Ordre métier, droits et refus locaux | S1/S2/S3, rattachement Restaurant confirmé une fois, Musée conservé | Preview P22 absente |
| P22-05 | Classement commun, concepts vérifiés et idées de cartes | Huit scènes du banc, découverte réelle et provenance dans les Docks | Personnalisation individuelle désactivée |

La comparaison des arbres et du graphe confirme ces acquis. Aucune réapplication de commit ni résolution de conflit n'a été nécessaire.

## C — Retour du panier au zoom natif 125 %

La reproduction ciblée `retour-panier-souris` a réussi sur le code P22-05, avant toute modification applicative. Deux lignes Mascara homonymes ont été créées dans la fixture. Le prix et la quantité de la deuxième ont été modifiés séparément, la première est restée identique. Le panier a été fermé, repris depuis les recommandations, puis fermé par un nouveau clic souris sur « Mes intentions ».

La sonde au moment du clic mesure le bouton à environ 123 × 37 pixels CSS, à x=673 et y=244. `elementFromPoint` retourne le bouton lui-même, `pointer-events` vaut `auto` et le panneau est revenu en haut. Le viewport est 1024 × 576 dans une fenêtre 1280 × 720, avec DPR 1,25. Le clic Playwright utilise les événements souris du navigateur et ses contrôles de visibilité habituels. Aucun clic forcé ou dispatch DOM.

Le même parcours vérifie ensuite un retour au clavier, un Save/Reload et le même digest. La traversée Amazon étendue contrôle aussi les trois articles, les deux homonymes Câble, la livraison, Undo/Redo et la reprise depuis la Bibliothèque.

**Verdict du retour panier : PASS sur la reproduction ciblée.** Aucun défaut de géométrie ni d'identité n'a été démontré dans cette reproduction. Le timeout isolé de P22-05 ne permettait pas d'en attribuer la cause au produit. Aucun correctif UI spéculatif n'a été ajouté.

## D — Traversées intégrées

La réception finale regroupe 24 traversées PASS. Les six parcours ont été exercés à 1920 × 1080, 1440 × 900, 1280 × 720 et en fenêtre 1280 × 720 au zoom natif Chrome 125 %. Les 18 traversées standard ont réussi dans le run `1794673111565`. Cinq traversées au zoom ont réussi dans le run `1794673376364` et le séjour a été reçu après attente du focus dans le run `1794673520885` — l'identifiant exact de ce dernier run figure dans `receipt.json`.

| Parcours | Local | Save/Reload | Preview authentifiée | Verdict |
| --- | --- | --- | --- | --- |
| Cinéma / Projet | 4 formats PASS | Save, Undo/Redo et Reload C8 PASS | BLOCKED_ENV | LOCAL_PASS |
| Mascara / Amazon | 4 formats PASS, retours souris | Versions, lignes, livraison et Reload C8 PASS | BLOCKED_ENV | LOCAL_PASS |
| Week-end / Musée | 4 formats PASS | Période, tarif, Musée et Restaurant après Reload PASS | BLOCKED_ENV | LOCAL_PASS |
| Bibliothèque / suggestions | 4 formats PASS | Save C8 et consultation sans mutation, Reload couvert par les autres parcours | BLOCKED_ENV | LOCAL_PASS |
| Projet Maison | 4 formats PASS | Parent, panier, ligne et relations après Reload PASS | BLOCKED_ENV | LOCAL_PASS |
| Zéro candidat admissible | 4 formats PASS | Aucune sauvegarde ni création de brouillon | BLOCKED_ENV | LOCAL_PASS |

Les six scénarios utilisent chacun un brouillon C8 isolé et un identifiant d'exécution. Les contrôles Save vérifient l'état `SAVED`, le même `draftId`, une version croissante et l'égalité du digest affiché et du reçu. Le Reload recharge complètement la page. L'examen du reçu porte sur les intentions, les sélections et les relations parent/enfant.

- Cinéma / Projet utilise un projet composé, prépare le billet, modifie son prix et sa date, ajoute un popcorn après « Supplément réel », puis contrôle le Restaurant et le retour sur le bon parent. Undo/Redo et Reload retrouvent les enfants exacts.
- Mascara / Amazon conserve le prix et la quantité du produit Beauté, prépare une ligne de concept Mascara dans le panier existant, ajoute deux homonymes et modifie seulement le deuxième. Les frais distincts sont sauvegardés via l'éditeur. Le produit Beauté et les autres lignes sont comparés avant/après.
- Week-end / Musée conserve la période et le tarif de deux nuits. Après navigation vers Musée et retour, le Restaurant S3 est confirmé, ajouté une fois, focalisé puis retrouvé après Reload.
- Bibliothèque / refus exerce les recommandations, la recherche explicite, la distinction des provenances et la reprise de la ligne existante. Les refus locaux disponibles sont exercés dans Cinéma et S3. La surface d'idées de cartes ne possède pas de masquage dédié.
- Maison crée le modèle existant avec son panier enfant, modifie la ligne du panier, retourne au parent puis recharge les mêmes relations.
- Zéro candidat utilise une réponse de fixture C8 dont les capacités de création sont retirées et les cartes rendues consultables. La Bibliothèque ne remplit pas artificiellement les emplacements. Les refus réels des owners sont également vérifiés par les bancs.

### Niveau distant

**`BLOCKED_ENV` pour la recette authentifiée du candidat.** Aucun déploiement ne sert ce SHA P22. La mission interdit la création d'un déploiement, le push et la création d'une PR distante. Save/Reload distant, isolation Auth/RLS et Preview financière authentifiée sont donc `NOT_RUN`. Les données du foyer personnel n'ont pas servi de fixture.

## E — Confidentialité et invariants

Le contrôle de confidentialité relit les données privées localement puis recherche leurs cellules longues et leurs représentations JSON dans les fichiers applicatifs modifiés, les données publiques et les sorties de build client. Il vérifie aussi les noms de colonnes privées, les fichiers sources confidentiels et les formes de secrets connues. Les noms de colonnes inscrits dans la liste d'interdiction du test de confidentialité sont identifiés comme des assertions, sans valeur source.

Contrôle client et serveur terminé après build : 950 fichiers examinés, 388 représentations de cellules privées recherchées, aucune correspondance. Le XLSX original garde son empreinte. Les affinités réelles ne sont injectées dans aucun profil runtime. Les tests de profil utilisent deux sujets synthétiques et conservent le classement neutre en l'absence d'association autorisée.

Le diff P22 ne touche ni `src/server`, ni `src/domain/phase2`, ni migrations/Supabase. Les droits restent ceux des owners existants. Les tests vérifient `UNKNOWN` distinct du zéro, le détail compris non additif, le supplément distinct, les frais propres au panier et les tarifs d'hébergement. Le parent ne reçoit aucune dépense artificielle. Les références ne s'adoptent pas à la consultation.

Les reçus navigateur contrôlent zéro Plan, zéro révision et zéro écriture distante. Les appels de sauvegarde et de projection observés après validation concernent les fixtures C8. Le tri, le survol, la consultation et le masquage sont vérifiés sans POST supplémentaire vers `/draft` ou `/interaction`.

## F — Qualité et performance

### Build et TypeScript

**PASS du build Next.js 16.2.6 avec Turbopack.** Le journal indique compilation réussie en 2,5 min, contrôle TypeScript terminé, génération de huit pages statiques et sortie des routes, dont Composer et ses API.

Le worktree de validation partage physiquement ses dépendances avec le dépôt voisin par une jonction Windows. Le premier build a refusé cette jonction hors de sa racine. Une configuration temporaire de test `turbopack.root` englobant les deux répertoires a permis d'exécuter le build normal. Cette configuration, retirée après le contrôle, n'entre pas dans la branche candidate.

Le build de repli Webpack a échoué sur `node:crypto` importé par `analytics/history-v2/facts-hash.ts`, via la chaîne `query-api` / `runtime/query-client`. Ces fichiers sont hors du diff P22. Le verdict de livraison s'appuie sur le build Turbopack qui a réussi, sans modification de cette chaîne.

### Bancs ciblés

| Banc | Résultat |
| --- | --- |
| Recommandations P22-05 | PASS, huit scènes |
| Découverte Clay | PASS, 687 identités, 529 concepts, droits Taxi/Parking |
| Restaurant / Cinéma | PASS, 11 cas |
| S3 projets | PASS, 12 cas |
| Familles Projet / Maison | PASS, 5 cas |
| Preview des modèles | PASS, 4 cas |
| Mascara A1 | PASS, 16 cas |
| Bibliothèque A2 | PASS, 12 cas |
| Panier purchase@v2 | PASS, 5 groupes, dont persistance isolée |
| Séjour A06 | PASS, 12 cas |
| Détails compris Restaurant | PASS, 16 contrôles |
| Champs Mobility | PASS, 3 cas |

Les annotations historiques `sourceHead` de certains anciens bancs restent des références datées. L'exécution présente utilise les sources consolidées.

### Oracles CAT sur la consolidation

| Oracle | Statut | Vérification |
| --- | --- | --- |
| CAT-01 | PASS | Billet vérifié dans le XLSX, proposition facultative et recherche |
| CAT-02 | PASS | Édition du billet par sélection exacte |
| CAT-03 | PASS | Popcorn hors Excel, provenance métier distincte |
| CAT-04 | PASS | Situations source de Bière et propriétaire Restaurant |
| CAT-05 | PASS | Taxi soumis à Mobility |
| CAT-06 | PASS | Parking conditionnel, aucun montant adopté |
| CAT-07 | PASS | Mascara, Routine et modes examinés en privé, produit et commande distincts |
| CAT-08 | PASS | Profil absent ou sujet différent sans affinité réelle |
| CAT-09 | PASS | Lessive indicative, aucune échéance sans acquisition/stock |
| CAT-10 | PASS | 477 renouvellements absents conservés |
| CAT-11 | PASS | Deux homonymes et IDs distincts |
| CAT-12 | PASS | Référence sans owner sans bouton d'achat fictif |
| CAT-13 | PASS | Dix répétitions source normalisées sans poids supplémentaire |
| CAT-14 | PASS | Trois marqueurs TROP RARE et tirets exclus des modes |
| CAT-15 | PASS | Masquage par occurrence, RAW conservé |
| CAT-16 | PASS | Affichage sans mutation ni signal de préférence |
| CAT-17 | PASS | Gestes de consultation sans Save/Preview ni chargement de source privée |
| CAT-18 | PASS | Tri stable à entrées identiques |
| CAT-19 | PASS | Reprise de commande et ligne existantes |
| CAT-20 | PASS | Addition 40 €, détail 6 € inclus, supplément distinct |

La relecture des 529 cellules et de la normalisation privée a été réexécutée. Ces oracles ne constituent pas une preuve authentifiée distante.

Le classement de 687 entrées est mesuré dans le banc de recommandations sur 40 appels. Médiane de l'exécution P22-06 voisine de 0,12 ms, p95 de 0,68 ms, sans engagement de performance Production. Les illustrations gardent leurs chargements progressifs. Le code `editor-chunks` reste identique à main et charge selon la clé de l'éditeur actif. SNAP-3 n'a pas été modifié. Aucun benchmark général supplémentaire n'a été lancé.

Les premiers essais du banc intégré ont révélé deux erreurs de test, un sélecteur de liste déroulante et une attente textuelle `21.00` face au montant décimal `21`. Elles ont été corrigées dans le test. Le retour au séjour programme son focus à la prochaine frame et le banc attend désormais ce focus avant de l'évaluer. Des captures et requêtes ont aussi expiré pendant la compilation parallèle. La réception finale utilise une exécution séquentielle et conserve les journaux des essais précédents.

## G — État de livraison et fiche Preview

| État | Situation |
| --- | --- |
| `LOCAL_PASS` | PASS, 24 traversées, build et contrôles ciblés |
| `COMMITTED_LOCAL` | Commit de validation livré, SHA exact dans le compte rendu et le journal Git de la branche |
| `PUSHED` | NON |
| `PREVIEW_READY` | `NOT_RUN` pour P22 |
| `PREVIEW_AUTH_PASS` | `BLOCKED_ENV` |
| `PRODUCTION_READY` | `NOT_RUN`, recette Preview authentifiée encore requise |
| `PRODUCTION_CONFIRMED` | `NOT_RUN` pour P22, alias toujours sur main P21 |
| `BLOCKED` | Porte uniquement sur la recette distante faute de Preview du candidat |

Titre de PR préparé : **Composer — intégrer les améliorations desktop P22 et les recommandations V22**.

Description proposée : Composer regroupe les améliorations de navigation Projet, d'édition directe et de suggestions contextuelles. La Bibliothèque recommande jusqu'à quatre intentions, distingue la reprise d'une occurrence et la préparation d'une nouvelle carte, et exploite les concepts publics vérifiés du catalogue V22. La validation locale couvre les six traversées et la continuité Save/Reload sur C8, avec les réserves de recette distante ci-dessus.

La branche cible est main. Le diff final porte sur 31 fichiers et comporte les cinq commits P22 puis le commit de tests/réception P22-06. Aucune migration n'est attendue. Aucun nouveau flag P22 n'a été ajouté. Les gates et capacités existants restent les prérequis de l'application.

Après autorisation de push et de création de PR, vérifier le SHA exact de Preview puis exécuter les parcours avec un compte, foyer et mois synthétiques explicitement admis. Contrôler la connexion, les recommandations, les Docks, la navigation Projet, Amazon et son retour souris au zoom 125 %, un Save/Reload distant, les artefacts et les erreurs. Décider ensuite séparément de la fusion et de la Production.

Le retour arrière local consiste à revenir sur une branche antérieure conservée. Après une publication autorisée, le retour applicatif s'effectuerait selon les protections GitHub et la promotion d'un déploiement antérieur autorisée. Le périmètre ne comporte aucun changement de schéma ni migration de données.

## H — Synthèse et reprise

La candidate réunit le panneau Projet, les liens parent/enfants, les champs directement éditables, le classement métier et les idées issues du catalogue. Les recommandations sont reçues avec les éditeurs et les projets de la même branche. Le défaut de clic souris au zoom possède désormais une reproduction positive et une sonde géométrique. Les ajustements P22-06 portent sur le banc de traversée et la documentation.

Les sauvegardes et rechargements locaux couvrent les identités et relations. Une Preview P22 authentifiée demeure nécessaire pour certifier leur continuité distante. L'autorisation suivante doit viser précisément le push de la branche candidate, la création de sa PR et le déploiement Preview associé. Elle devra également désigner le périmètre synthétique admis pour les écritures de recette. Fusion et publication Production restent des décisions ultérieures.

Les preuves locales et captures sont conservées dans `work/repo/outputs/p22-06`. Pour rejouer le banc, utiliser `scripts/serve-phase2-planner-composer-fixture.mjs` avec les assets C8 construits depuis le candidat, puis `scripts/check-composer-p22-06-desktop.mjs`. Le runner accepte `PLANNER_PLAYWRIGHT_PACKAGE`, `COMPOSER_C8_TEST_PORT`, `COMPOSER_C8_RESULTS_DIR`, `P22_MATRIX=1`, `P22_NATIVE_ZOOM=1` et un filtre facultatif `COMPOSER_P22_CASE`. Les requêtes du navigateur sont limitées à l'origine localhost du banc.

STOP après cette livraison P22-06.
