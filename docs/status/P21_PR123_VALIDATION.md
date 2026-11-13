# PR #123 — Validation ciblée et clôture

Début : 13 novembre 2026. Plafond de mission : 90 minutes.

## Références et restrictions

- PR : https://github.com/adriensauvageot34/Budgetisation/pull/123 — OPEN / Draft, HEAD distant confirmé `e067ab85165b1a0e149b1a0d4a3957c9dba73ec0` (119 commits, 66 fichiers).
- SHA testé : `e067ab85165b1a0e149b1a0d4a3957c9dba73ec0`. Dernier commit applicatif : `81c5d12df2d879f2dd082803ef6c9f8629ff4c24`.
- Base GitHub : `2e6febec5c9e56aaca76174c62d421157b4d44ef`.
- Validation seulement : aucun changement produit, correction, Apply, PlanRevision, migration, modification Auth/RLS/Finance V2, écriture distante, fusion ou Production.
- Deux modifications locales Cadeau conservées hors du périmètre testé ; validation prévue dans un worktree détaché au SHA exact.
- Un PASS fixture ne constitue pas une preuve navigateur ou authentifiée. Les contrôles non exécutés restent NOT_RUN ; les obstacles d'environnement sont BLOCKED.

## Contrôles prévus et résultats finaux

| Lot | Contrôles prévus sur les bancs existants | Fixture | Navigateur | Distant authentifié |
| --- | --- | --- | --- | --- |
| A — Draft | Transport HTTP, CAS, digests, réponse perdue, conflit et RAW | PASS — transport 6 groupes et hook durable 8 groupes | PASS — RAW, trois Reload et réessai C8 ; conflit multi-session seulement fixture | NOT_RUN — écritures interdites |
| B — Catalogue/navigation | Recherche, occurrence exacte, homonymes, parents, ancien Draft, dates/mois, droits | FAIL — A2-03 focus erroné vers un modèle | FAIL — reproduit sur clavier réel, sans mutation | NOT_RUN |
| C — Activités/Beauté/Mobility | Registres, dix produits, UNKNOWN/zéro, quantités, suppléments et frais sans double compte | FAIL du banc Mobility (entrée obsolète kind=slot) ; Beauté/Restaurant/activités PASS | PASS pour les parcours communs exécutés ; Mobility spécialisé NOT_RUN | NOT_RUN |
| D — Projets/modèles | Seize modèles, options, confirmation, atomicité, liens, retraits, Undo/Redo et refus obsolète | PASS — parcours 10 groupes, aperçu 4, déplacements 2 et familles 5 | PASS — un modèle composé, Undo/Redo atomique et Reload ; seize modèles en navigateur NOT_RUN | NOT_RUN — écritures interdites |
| E — Paniers | purchase@v2, anciens paniers, renommage, homonymes, quantité/UNKNOWN, livraison, catalogue, Save/Reload isolé | PASS — cinq groupes panier et catalogue 7 produits/6 familles | PASS — Amazon/Vêtements/Courses dans les trois dimensions | NOT_RUN — écritures interdites |
| F — S3/interfaces | Motifs, masquage, désactivation, confirmation, consultation immuable, doublons, droits, Dock/clavier et 1280×720 / 390×844 / 360×800 | PASS — douze groupes S3 | PASS — 21 contrôles de parcours/rendu ; FAIL focus homonymes (B) ; S3 complet navigateur NOT_RUN | BLOCKED — connexion Vercel |

## Exécutions et preuves

### Lot A — PASS sur fixtures

- `node scripts/check-composer-post-snap3-draft-http.mjs` : exit 0, six groupes. Contrat HTTP/origine/JSON, authentification simulée, refus Apply, reprise de réponse perdue et contrôle strict identité/version/révision/digest. Réponses incompatibles ou mal formées refusées.
- `node scripts/check-composer-p14-p2-durable.mjs` : exit 0, huit groupes. Debounce, CAS pendant sauvegarde lente, même requestId après perte de réponse, conflit à deux sessions avec état local conservé, relecture de conflit sans réarmer le writer, hors ligne/en ligne, archive/restauration simulée et mémo du digest.
- Portée : vrais transport/hook avec services et horloge simulés. Auth/RLS distante et connectivité navigateur non certifiées. Les essais du hook ne prétendent pas valider les champs RAW dans un navigateur.
- Journaux locaux : `outputs/pr123-validation/A-results.json` et fichiers `.mjs.log`. Le worktree détaché est `../pr123-validation-e067ab8`, HEAD exact confirmé, sans diff suivi initial ; dépendances existantes reliées par une jonction `node_modules`.

### Lot B — premiers résultats et échec reproduit

- `check-composer-month-intentions.mjs` : exit 0, cinq groupes ; recherche, ouverture exacte, projets vides, clavier simulé, composition IME et état occupé.
- `check-composer-navigation-groups.mjs` : exit 0, quatre groupes d'identités et rendu.
- `check-composer-stay-child-navigation.mjs` : exit 0, deux groupes ; enfants homonymes et retrait confirmé préservant le frère.
- `check-composer-v22-a2-library.mjs` : exit 1 à A2-03, ligne 109, après A2-01 et A2-02 PASS. Entrée sur deux Mascara : le banc attend le focus sur l'occurrence `00000000-0000-4000-8000-000000093001`, mais `document.activeElement.props['data-library-existing-action']` vaut `undefined`. Aucun éditeur ne s'ouvre. Les cas A2 suivants ne sont pas exécutés.
- Reproduction complémentaire dans Chrome headless 1280×720 sur C8 : deux Mascara explicitement créés dans le seul stockage synthétique, retour à la bibliothèque, recherche `mascara`, puis Entrée. Le focus va au modèle `clothing-and-beauty-shopping`, avant les deux occurrences existantes. Digest inchangé et aucun éditeur ouvert. Preuves locales : `focus-homonyms.json` et `focus-homonyms.png`. C'est un défaut de priorité de navigation démontré, sans mutation ni confusion d'identité économique.
- Cause : `composer-library.tsx:79–83` prend le premier bouton de tous les types admissibles en ordre DOM. Les modèles sont rendus avant « Dans ce mois » (lignes 133–147), et « Shopping vêtements et beauté » correspond à `mascara` via les termes du panier Beauté. Proposition pour une mission ultérieure : donner priorité aux occurrences visibles lorsqu'une recherche possède plusieurs homonymes, conserver le choix explicite et ajouter une couverture modèle + homonymes. Aucun correctif effectué.
- Reproduction : dans le worktree exact, définir `PLANNER_REACT_TEST_TOOLS` vers `../repo/outputs/p21-react-tools`, puis `node scripts/check-composer-v22-a2-library.mjs`. Log et B-results.json dans `outputs/pr123-validation/`.

### Lot C — Beauté/Restaurant PASS, banc Mobility FAIL

- `check-composer-v22-a1-mascara.mjs` : exit 0, seize contrôles, dont dix presets Beauté, exactitude du propriétaire et des visuels, UNKNOWN/zéro explicite, quantité/prix et absence d'adoption automatique.
- `check-restaurant-suggestions.mjs` : exit 0, onze groupes, inclusions à 40 € et détail compris de 6 €, supplément distinct, homonymes, consultation sans mutation, RAW refusé après changement et non-régression Cinéma.
- `check-composer-mobility-fields.mjs` : exit 1, ligne 57 (`AssertionError: Frais`). Le banc transmet `catalogChoice.kind = 'slot'` (ligne 43), tandis que l'effet de `restaurant-editor.tsx:584` n'ouvre l'équipement que pour `kind === 'socket'`. Ce banc ne rejoint donc pas le formulaire Mobility. Cela démontre une entrée de fixture périmée ; les trois groupes Mobility de ce script ne sont pas certifiés. Aucun test ni code corrigé.
- Registre d'activités et montants individuels : contrôlés par le banc de parcours du lot D (PASS). `check-clay-discovery.mjs` : exit 0, 687 identités, 632 illustrations nouvelles, 55 protégées, 529 concepts Excel et routes d'activités admises. Le défaut du banc Mobility ne prouve pas à lui seul un défaut du formulaire utilisé via l'application.
- Proposition ultérieure pour le banc Mobility : transmettre la variante publiée `kind: 'socket'`, puis rejouer les trois groupes, dont le prix train de 10 € non doublé au retour et les frais conservés sur le propriétaire partagé. Ce contrôle précis reste NOT_RUN après l'échec initial ; aucun montant de trajet n'est déclaré certifié sur ce HEAD par ce script.

### Lot D — résultats acquis

- `check-composer-journey-ux.mjs` : exit 0, dix groupes. Les seize modèles sont évalués avec les propriétaires réels sur un Draft privé ; parent/enfants, coûts individuels, options, nom/date, refus intermédiaires, collisions d'identités, reçus et digests incohérents sont contrôlés. Le groupe UX-10 exerce 23 cas d'activités (16 presets de la constante étendue et sept presets historiques), avec UNKNOWN/zéro et réouverture exacte. Cela ne signifie pas que le registre total n'a que 23 activités : la passation compte Cinéma séparément.
- `check-composer-project-preview.mjs` : exit 0, quatre groupes. Aucun ajout avant confirmation ; options locales, annulation, dates invalides/autre mois refusées, réouverture d'un parent existant et complément perdant son admission.
- `check-composer-linked-moves.mjs` : exit 0, deux groupes ; deux parents homonymes, billet conservé avec son prix officiel, anchors et confirmation obsolète refusés.
- `check-composer-project-families.mjs` : exit 0, cinq groupes ; séjours, visites, Maison et activité libre, rattachements admis, reprise exacte et masquage des montants périmés.
- Complément navigateur local réutilisant C8 et Playwright : aperçu Bowling et restaurant consulté sans création ni modification du digest ; confirmation explicite d'un parent et de ses deux enfants ; une seule annulation retire les trois occurrences ; un rétablissement restaure exactement les mêmes identités et le même digest ; Reload conserve le reçu durable. Plans = 0, révisions = 0, écritures distantes = 0. Preuve `model-undo-redo.json`, statut PASS, digest `2684eec50959270f7f1fca3a84315c9ba70344e31b42693ef1c6e708c3247cc8`. Les seize modèles ne sont pas tous certifiés en navigateur. Aucun total de projet ajouté ou inféré.

### Lot E — PASS sur propriétaires et stockage isolé

- `check-composer-purchase-basket.mjs` : exit 0, cinq groupes : Amazon 48 € + livraison 5 €, prix d'une ligne ciblée, homonymes, refus obsolète, ancien panier et transition explicite, vêtements UNKNOWN, références Courses et couverture officielle. Save/Reload exécuté dans PGlite en mémoire avec le service et les SQL existants ; version 1, même digest/état/ordre/identités, compteurs Plans/révisions à zéro et canaris historiques intacts.
- `check-composer-catalog-purchase-starts.mjs` : exit 0 ; sept produits de six familles, dispatch UI explicite, ligne exacte, refus obsolète, Courses périmées désactivées, filtres et réessai du lecteur. Les assertions de renommage, dates et livraison présentes dans le script ont été exécutées.
- Aucune base Supabase locale ou distante démarrée ; aucun schéma ni gate distant modifié. Les installations SQL et données synthétiques appartiennent exclusivement au moteur de fixture en mémoire.

### Lot F — PASS S3 sur fixtures et rendu commun ; défaut clavier du lot B

- `check-composer-project-completion.mjs` du HEAD distant : exit 0, douze groupes. Motifs situés, priorité, masquage/réactivation et désactivation de session sans mutation, confirmation explicite, disparition des doublons, invalidation des confirmations après changement ou perte de capability, identités et coûts individuels conservés.
- Hébergement C8 existant reconstruit depuis le worktree exact sur `http://127.0.0.1:3153`, sans fournisseurs live (`BAR_LOCAL_LIVE_PROVIDERS=0`). Réutilisation de la feuille globale produite antérieurement, avec CSS Composer reconstruit au HEAD. Chrome headless via le Playwright existant, profil isolé sans session personnelle.
- `check-composer-journey-browser.mjs` : exit 0, 21 contrôles (sept parcours × trois dimensions), trois Save/Reload durables locaux et un réessai après échec de sauvegarde. Les requêtes de fixture sont contrôlées : aucun Apply, aucun archivage, Plans/révisions/écritures distantes et canaris historiques modifiés à zéro, aucune erreur JavaScript dans les trois parcours mixtes.

| Dimension | Parcours contrôlés | Résultat de rendu/interaction | Reload local |
| --- | --- | --- | --- |
| 1280 × 720 | Cinéma, Restaurant, Week-end, Amazon, Vêtements, Mascara, Courses | PASS × 7 | PASS, même digest/reçu |
| 390 × 844 | Les mêmes sept parcours | PASS × 7 | PASS, même digest/reçu |
| 360 × 800 | Les mêmes sept parcours | PASS × 7 | PASS, même digest/reçu |

- Contrôles géométriques acquis : largeur du document égale au viewport, aucun débordement horizontal du panneau, sélecteurs contenus et Dock sans chevauchement avec le panneau testé. Consultation du résumé sans mutation du digest ; RAW partiel conservé après refus d'abandon et montant incomplet refusé. Les parcours vérifient les inclusions Restaurant, forfait/taxe Week-end, ligne Amazon exacte, prix inconnu et quantité Mascara.
- Inspection visuelle directe supplémentaire des captures Restaurant 390, Amazon 1280/360, Week-end 390 et Mascara 360 : résumés lisibles, Dock séparé et champs contenus. Les autres captures possèdent les assertions géométriques du pilote ; elles n'ont pas toutes fait l'objet d'une inspection visuelle humaine exhaustive. Les panneaux hauts restent défilants verticalement ; aucune certification lecteur d'écran ou tactile physique.
- Preuves locales `outputs/pr123-validation/browser/results.json`, `browser-journey.log` et 21 captures. La géométrie et les interactions S3 des nouvelles familles ne sont pas toutes couvertes par ces sept parcours ; elles restent NOT_RUN en navigateur malgré les douze groupes de fixture S3 PASS.

Aucune certification de livraison à ce stade.

## Défauts, limites et prérequis

- GitHub sur `e067ab8…` : statut Vercel `failure`, cible `upgradeToPro=build-rate-limit`. Aucun nouvel essai de déploiement demandé.
- Une Preview READY existe sur le HEAD applicatif `81c5d12df2d879f2dd082803ef6c9f8629ff4c24` : `dpl_G7EX1bgCT8Efu8UgXhybaoiCGiiu`, https://budgetisation-n8092h7a3-adriensauvageot34-6137s-projects.vercel.app. Le diff `e067ab8…` / `81c5d12…` sur src, scripts, public et manifestes de dépendances est vide. Cela établit l'équivalence de ces sources, pas une Preview au SHA documentaire exact.

L'accès HTTP ordinaire à la Preview applicative redirige 302 vers Vercel SSO, puis 307 vers la connexion Vercel. Contrôle Preview authentifié : BLOCKED. Aucun token, partage temporaire ou changement de protection utilisé ; arrêt de cette partie conformément au mandat.

## Intégrité et clôture

TypeScript `node node_modules/typescript/bin/tsc --noEmit` : PASS (exit 0) dans le worktree exact. `git diff --check` : PASS sur le worktree de validation. Aucun fichier applicatif suivi modifié.

Les deux fichiers Cadeau sont préservés : comparaison exacte du `git diff --binary` initial/final identique (18 ajouts et une suppression). Ils restent non commités, hors du worktree testé et hors du commit documentaire. `outputs/` et les preuves de validation restent locaux et non suivis. Aucun test exécuté sur ces changements Cadeau n'est revendiqué.

Les contrôles ont été exécutés en environ seize minutes, avant le plafond de 90 minutes. Le serveur C8 a été arrêté après acquisition des preuves. Le worktree détaché est conservé pour la reproductibilité ; aucun fichier applicatif suivi n'y a changé.

`origin/main` est resté à `2e6febec5c9e56aaca76174c62d421157b4d44ef` et la branche distante à `e067ab85165b1a0e149b1a0d4a3957c9dba73ec0` au contrôle précédant le commit de ce rapport. Le commit de clôture porte uniquement `docs/status/P21_PR123_VALIDATION.md`. Son SHA et la confirmation du push sont fournis dans le compte rendu final. La PR doit rester OPEN / Draft.

## Vérifications non réalisées et suite strictement nécessaire

| Contrôle | État et prérequis |
| --- | --- |
| Suite A2 après son troisième cas | NOT_RUN : le script s'arrête au défaut de focus. Correction ciblée du produit puis reprise des cas interrompus dans un mandat distinct |
| Trois groupes spécialisés Mobility | NOT_RUN après l'échec d'entrée du banc ; adapter la fixture au contrat `socket`, puis rejouer, sans changer le propriétaire métier |
| Seize modèles en navigateur, droits réels, anciens Drafts distants, confirmations S3 dans toutes les nouvelles familles | NOT_RUN ; les fixtures PASS ne remplacent pas ces preuves |
| Preview du SHA documentaire exact | BLOCKED : contrôle Vercel en échec pour limite de builds ; laisser le quota se rétablir ou décision du propriétaire, sans déploiement relancé dans cette mission |
| Accès applicatif authentifié à la Preview | BLOCKED : connexion Vercel. Accès ordinaire autorisé nécessaire ; aucun contournement ni changement de protection |
| Save/Reload authentifié et Preview financière distante | NOT_RUN : écritures exclues du mandat. Nécessitera une autorisation spécifique désignant compte, foyer, mois, brouillon de recette et nettoyage ; sources mensuelles réellement renseignées pour FRESH. Aucun zéro ni montant fabriqué |
| Conflit entre deux sessions navigateur réelles, tactile physique, lecteur d'écran | NOT_RUN ; conflit contrôlé seulement par le hook déterministe, clavier réel contrôlé sur les parcours décrits |
| Apply, PlanRevision, migration, changement Auth/RLS/Finance V2, fusion et Production | Non exécutés et non autorisés ; aucun prérequis de cette validation ne justifie leur exécution |

## Verdict

**VALIDATION_FAILED**.

Quinze des dix-sept scripts de fixtures/contrôles ciblés rejoués réussissent ; deux échouent. TypeScript et le pilote navigateur des sept parcours dans les trois dimensions réussissent. Le défaut de priorité de focus est reproduit dans Chrome ; l'autre échec relève d'une entrée périmée du banc Mobility. Les réserves distantes et la Preview exacte restent ouvertes. Aucun verdict READY_FOR_MERGE n'est accordé.

Les propositions de correction sont limitées aux deux constats décrits. Aucun code produit ni test versionné n'a été corrigé, aucune nouvelle fonctionnalité développée, aucun Draft distant, Plan ou PlanRevision créé par la mission. Les données financières distantes n'ont fait l'objet d'aucune écriture ; leur état global n'a pas été relu ou certifié ici.

Après commit et push exclusivement documentaires : arrêt de la mission. Aucun développement ni nouvelle campagne n'est engagé.
