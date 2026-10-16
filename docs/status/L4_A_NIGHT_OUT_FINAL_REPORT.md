# L4-A — Soirée intelligente : réception et PR

Date : 16 octobre 2026. PR [#53](https://github.com/adriensauvageot34/Budgetisation/pull/53). Aucun GO de fusion demandé par cette livraison.

## Verdict

```text
L4_A_STATUS = READY_FOR_REVIEW_WITH_RESERVATIONS
BASE_MAIN_SHA = 7765bc532511d777ef3e3c80ff0b48826a4e465e
PRODUCT_TESTED_SHA = 35171e31a2cea31d0659a3274b85e56f2cf71774
BRANCH = codex/composer-v3-l4-a-night-out
PR_URL = https://github.com/adriensauvageot34/Budgetisation/pull/53

MINIMAL_CREATE_SAVE_RELOAD = EXECUTED_PASS_LOCAL_HTTP_SYNTHETIC_ONLY
CONDITIONAL_EDITOR = EXECUTED_PASS_LIMITED_FIXTURE
PARTICIPANTS = EXECUTED_PASS_LIMITED_FIXTURE
PERSON_QUANTITIES = EXECUTED_PASS_LIMITED_FIXTURE
SHARED_QUANTITIES = EXECUTED_PASS_LIMITED_FIXTURE
BEFORE = EXECUTED_PASS_LIMITED_FIXTURE
FOOD = EXECUTED_PASS_LIMITED_FIXTURE
EXTRAS = EXECUTED_PASS_LIMITED_FIXTURE
MOBILITY_OUTBOUND_RETURN = EXECUTED_PASS_LIMITED_FIXTURE
SUMMARY_REEDIT = EXECUTED_PASS_LIMITED_FIXTURE
IDENTITY_PRESERVATION = EXECUTED_PASS_LOCAL_HTTP_SYNTHETIC_ONLY
UNKNOWN_PARTIAL = EXECUTED_PASS_LIMITED_FIXTURE
UNDO_REDO = EXECUTED_PASS_BROWSER_LIMITED_FIXTURE
RAW_PENDING_APPLY = EXECUTED_PASS_LIMITED_FIXTURE

ORACLE_95_EUR = EXECUTED_PASS_COMPILER_SYNTHETIC_ONLY
PARENT_NON_ADDITIVE = EXECUTED_PASS_COMPILER_SYNTHETIC_ONLY
FINANCIAL_PARITY = EXECUTED_PASS_22_X_9_SYNTHETIC_ONLY
HISTORICAL_COMPATIBILITY = PARTIAL_TWO_PREEXISTING_SUITE_FAILURES

DESKTOP_1440 = EXECUTED_PASS_LIMITED_FIXTURE
DESKTOP_1728 = EXECUTED_PASS_LIMITED_FIXTURE
DESKTOP_1920 = EXECUTED_PASS_LIMITED_FIXTURE
JWT_AUTH_CYCLE = NOT_RUN_AUTH
NATIVE_INTERACTIONS = PARTIAL

TYPECHECK = EXECUTED_PASS
NEXT_BUILD = EXECUTED_PASS_FULL_NEXT_VERCEL_PREVIEW
LOCAL_NEXT_BUILD = NOT_CERTIFIED_TOOLCHAIN
VERCEL_PREVIEW = READY_35171e3
PRODUCTION_MERGED = NO
PRODUCTION_DEPLOYED = NO
```

Le pilote est fonctionnel dans le périmètre testé. Les PASS de persistance sont ceux d'un vrai navigateur, de vrais composants React et d'un transport HTTP local synthétique. Ils ne certifient ni Supabase authentifié, ni RLS, ni une session personnelle. Les assertions historiques défavorables sont conservées ci-dessous.

## Réalisation A → E

- **A — Création courte** : dépôt immédiat du preset existant, panneau ouvert sur le budget principal uniquement ; prix inconnu possible. Cycle réellement exécuté : 30 € → SAVED → Reload → même occurrence → 35 € → SAVED. Le résumé s'ouvre à la réédition.
- **B — Détail volontaire** : participants admissibles, entrées par personne avec les preuves `component-quantity@v1`, consommations en unités totales, bouteille en lots SHARED. Le changement de participants conserve le nombre explicitement tarifé jusqu'à sa modification volontaire ; aucune multiplication rétroactive.
- **C — Compléments** : before optionnel via l'adaptateur existant, retrait explicite distinct de l'omission ; repas composant ou enfant Restaurant/Fast-food/Livraison selon les routes publiées. Palette contextuelle réutilisée, avec ouverture du choix équipé et avertissement de remplacement. Un Restaurant enfant a réellement été ajouté depuis la palette et ouvert dans son éditeur existant.
- **D — Transport** : aller et retour indépendants, formulaires et routes Mobility publiés ; changement de mode sans récupération de l'ancien prix incompatible. Aucun devis réel de fournisseur n'a été demandé pour la certification.
- **E — Réédition** : résumé compact par rubriques, décisions locales séparées de la confirmation de sauvegarde et de la réponse financière. Coût connu dérivé côté serveur des évaluations du Compiler, avec incertitudes conservées. Le parent n'ajoute aucun prix.

Le composant reste un pilote de présentation ; aucun moteur de questionnaire, contrat persistant ou owner financier supplémentaire. Les modes de quantité sont ceux du contrat existant. Aucun champ `drinks`, `quantityMode` ou `participantCount` persistant ajouté.

### Corrections trouvées pendant la réception

1. L'édition Soirée ne vérifiait pas les références de personnes/lieux comme les autres parcours : réutilisation du validateur propriétaire existant, refus explicite si indisponible ou référence hors foyer.
2. L'admission serveur d'un transport fermait le panneau et son retour `false` local était affiché comme un rejet : maintien de la saisie pendant l'admission, résumé actualisé après réponse autoritaire, erreurs réelles conservées.
3. Un brouillon évalué mais BLOCKED affichait indéfiniment « actualisation » dans ce résumé : le coût connu peut maintenant être affiché avec son incertitude, sans modifier les gardes Apply.
4. Les routes de palette incorporée doivent passer par le choix explicite de l'éditeur ; les enfants déjà liés sont rouverts avec leur identité.
5. La recherche de palette était marquée RAW par la propagation de `change` : correction limitée à l'exclusion des contrôles visuels de palette, retest réel (« Taxi ») avec statut restant SAVED. Les vrais champs métier restent RAW jusqu'à confirmation.

## Les seize tests d'acceptation

Preuve automatisée : [contracts.json](evidence/l4-a/contracts.json), 19 contrôles. Aucun Apply dans cette suite ; `plans=0`, `revisions=0`, `remoteWrites=0`.

| Test | Résultat exécuté et limite |
| --- | --- |
| 1 Création | PASS fixture contrat + navigateur : `night-out@v1` / `techno-night`, aucune date, personne ou origine inventée. |
| 2 Entrées | PASS Compiler : 1 entrée/personne × 2 personnes × 15 € = 30 €, une seule représentation principale. |
| 3 Consommations | PASS Compiler : 2 unités × 5 € = 10 €. |
| 4 Bouteille | PASS Compiler : 1 lot SHARED = 20 €. |
| 5 Before | PASS : enfant explicite 10 €, lien et identités conservés. |
| 6 Trajets | PASS : identités aller/retour distinctes, 12 € et 13 € via Mobility synthétique. Les contrats de devis partagés sont couverts par les 37 groupes Mobility existants. |
| 7 Total | PASS Compiler : 95 €, parent non additif ; même montant observé dans le navigateur avant les modifications de programme. |
| 8 Participants | PASS contrat : 2 → 3 conserve tous les composants et SHARED ; nouvelle conversion PERSON uniquement explicite. |
| 9 Patch ciblé | PASS contrat + HTTP navigateur : boisson 5 → 6 €, financement déclaré 10 → 12 €, coût connu 97 €, autres rubriques inchangées. |
| 10 Retrait | PASS contrat + navigateur : before retiré, 87 €, autres rubriques intactes ; Undo restaure le before. |
| 11 UNKNOWN | PASS contrat + navigateur : retour taxi → train sans prix ; ancien 13 € supprimé, aller conservé. Navigateur : 84 € encore connus avec before restauré et boisson à 6 € ; mention explicite de montant incomplet. Suite contrat : 74 € après retrait du before. |
| 12 Persistance | PASS HTTP local : mêmes Draft/occurrence/sélections, versions et digests relus ; relations et UNKNOWN conservés. JWT NOT_RUN_AUTH. |
| 13 Undo/Redo | PASS navigateur : 97 → Undo 95 → Redo 97 ; retrait avant soirée → Undo restaure son sous-graphe. Les snapshots seuls de la suite contrat ne sont pas la preuve de ce geste UI. |
| 14 SAVE en erreur | PASS navigateur : une panne avant commit, ERROR honnête, carte conservée et Apply bloqué ; reprise explicite → un seul commit/version 1 SAVED. Le prix n'avait pas encore été saisi dans ce cas d'erreur. |
| 15 Preview | PASS gate/scheduler : réponses hors ordre refusées, Undo/version/dispose. PASS navigateur supplémentaire : échec réseau → FAILED, Draft SAVED et Apply bloqué → réessayer → FRESH. L'inversion de réponses n'a pas été rejouée dans le navigateur L4-A. |
| 16 RAW/PENDING | PASS registre C1 + navigateur : prix RAW non commis, Apply désactivé ; montant négatif refusé avec message lisible, aucune sauvegarde de cette valeur. Beforeunload/drag/dialogues OS non certifiés globalement. |

### Preuves de parcours conservées

- [minimal-browser-http.json](evidence/l4-a/minimal-browser-http.json) : création minimale, même occurrence et sélection, 35 €, version 3.
- [rich-browser-http.json](evidence/l4-a/rich-browser-http.json) : même Draft et même occurrence, versions 10/11/14, patches ciblés et retrait.
- [save-error-retry.json](evidence/l4-a/save-error-retry.json) : échec unique avant commit, reprise unique, aucune PlanRevision.
- [preview-error-retry.json](evidence/l4-a/preview-error-retry.json) : séquence réseau refusée, réponse de reprise admise, version sauvegardée inchangée.
- [visual-navigation.json](evidence/l4-a/visual-navigation.json) : quatre rubriques ouvertes/fermées, **0 opération HTTP supplémentaire**, version/digest identiques.
- Les données de ces fichiers sont exclusivement celles des fixtures ; aucune donnée personnelle lue ou publiée pour ces essais.

## Régressions, commandes et builds

Environnement local : Windows, Node 22.18.0, TypeScript 5.9, React 19.2.6 ; PGlite en mémoire, fournisseurs Mobility synthétiques, réseau propriétaire du serveur de fixture interdit. Le navigateur utilise le vrai Composer avec React en mode production, bundle esbuild minifié et fractionné. Ce serveur local n'est pas une session Next/Supabase authentifiée.

Commandes :

```text
node scripts/check-l4-a-minimal.mjs
node scripts/check-l4-a.mjs
node scripts/check-l4-a-regressions.mjs
node scripts/check-l4-a-base-p09.mjs check-phase2-planner-contexts.mjs
node node_modules/typescript/bin/tsc --noEmit --incremental false
```

[regressions.json](evidence/l4-a/regressions.json) donne les dates et codes de sortie. PASS exécutés : C1, C2, Draft HTTP, scheduler P2, P13 (8 contrôles, CAS/idempotence/relecture après commit sur PGlite), Mobility C5 (37 groupes), Kernel/Savings, Restaurant L1, parité historique **22 × 9 = 198 empreintes**. Les goldens sont inchangés. Le cycle L4-A est rejoué en fin de lot : 19 PASS. Ces vérifications restent synthétiques.

**Deux échecs de suites préexistants, non masqués :**

- P09, `scripts/check-phase2-planner-p09.mjs:295` : assertion de restitution HTML `Train / tram`. Même échec sur les sources du main `7765bc5` et sur L4-A, après les contrôles économiques et de conservation précédents. Les assertions après cet arrêt ne sont pas considérées exécutées.
- Contexts, `scripts/check-phase2-planner-contexts.mjs:136` : liste attendue des méthodes du repository omettant `readActivePointer`, présent sur main comme sur L4-A. Même échec comparatif ; fin de suite non exécutée.

Le wrapper de comparaison substitue en mémoire les sources produit existant sur le main exact ; il n'altère ni checkout, ni assertions, ni golden. Journaux baseline/candidat conservés dans ce dossier. Aucune correction hors périmètre n'a été faite pour rendre ces suites artificiellement vertes.

**Build final Next complet : PASS sur Vercel Preview**, commit produit `35171e31a2cea31d0659a3274b85e56f2cf71774`, déploiement `dpl_6fBuZeSKbG2ii7RKpiqwWf3iKrjg`, target Preview, READY. `npm run build` → `next build`, Next 16.2.6/Turbopack, TypeScript, collecte des pages, génération 8/8 et finalisation exécutées. Dépendances/cache réutilisés. [Journal intégral](evidence/l4-a/vercel-35171e3-build.log).

Les tentatives locales défavorables sont également conservées : Turbopack refuse le `node_modules` lié hors de sa racine ; tentative webpack en échec sur le chemin `node:crypto` de Global. Aucun contournement de ces restrictions ni modification de configuration pour les masquer. TypeScript local final avant le dernier ajustement de propagation d'événement : code de sortie 0 ; TypeScript du dernier code produit : PASS dans le build Vercel complet.

Les régressions générales précèdent les derniers ajustements de présentation. Les chemins financiers, de Draft, de scheduler et d'Apply sont restés identiques ; les 19 contrôles L4-A ont été rejoués sur `a84266f`. La seule différence produit jusqu'à `35171e3` exclut la recherche visuelle de palette du registre RAW ; son retest navigateur et son build complet sont exécutés. Aucun PASS n'est attribué à un nouveau calcul financier non rejoué.

## UX desktop et chargement

Création, résumé et détails capturés à **1440×900, 1728×900, 1920×1080 effectivement mesurés**. Le dialogue reste dans le viewport, sans débordement horizontal ; aucun chevauchement entre contrôles réellement visibles dans le dialogue. Les contrôles hors du clip de scroll et les popovers fermés ne sont pas comptés comme visibles. Un faux positif initial du détecteur incluait un champ masqué par le scroll ; la mesure a été corrigée et le cas revérifié visuellement.

| Vue | 1440 | 1728 | 1920 |
| --- | --- | --- | --- |
| Création | [capture](evidence/l4-a/creation-1440.jpg) | [capture](evidence/l4-a/creation-1728.jpg) | [capture](evidence/l4-a/creation-1920.jpg) |
| Résumé | [capture](evidence/l4-a/summary-1440.jpg) | [capture](evidence/l4-a/summary-1728.jpg) | [capture](evidence/l4-a/summary-1920.jpg) |
| Détails | [capture](evidence/l4-a/detail-1440.jpg) | [capture](evidence/l4-a/detail-1728.jpg) | [capture](evidence/l4-a/detail-1920.jpg) |

Focus clavier réel vérifié par Tab : première rubrique ciblée, `:focus-visible=true`. Le détail conserve un seul scroll interne utile et un pied de panneau accessible ; les valeurs longues restent contenues par la grille et le retour à la ligne du résumé. [Géométrie](evidence/l4-a/desktop-geometry.json), [erreur de validation](evidence/l4-a/validation-error-1440.jpg), [transport inconnu](evidence/l4-a/unknown-return-1440.jpg).

Les captures de création ont été obtenues sur l'arbre produit `a84266f` ; leur structure et CSS sont strictement inchangés dans `35171e3` (seule la propagation de l'événement de recherche visuelle diffère). Les captures finales de résumé et de détail sont relues sur le bundle final ; le détail inclut une saisie longue RAW non conservée. Un viewport demandé mais non appliqué par l'outil a été exclu puis la capture reprise avec vérification `innerWidth/innerHeight`.

Le graphe du bundle de fixture confirme que l'éditeur Soirée est absent du graphe statique initial et chargé à l'ouverture : [lazy-loading.json](evidence/l4-a/lazy-loading.json). Sur cette fixture, 66 988 octets JS différés supplémentaires pour son graphe ; ce chiffre n'est pas une mesure du bundle Next, d'un temps utilisateur réel ou d'un gain P95. Aucun import massif des futurs éditeurs L4 ajouté. Aucune Preview par caractère RAW ni relecture World par ouverture de rubrique.

## Frontières et réserves restantes

1. **AUTH_CYCLE = NOT_RUN_AUTH** : aucun compte JWT isolé autorisé disponible. Aucun F0 réactivé, Draft personnel modifié ou Apply réel exécuté. Ce gate reste à porter à la revue de livraison.
2. **NATIVE_INTERACTIONS = PARTIAL** : boutons/formulaires/focus clavier exécutés dans le navigateur ; pas de certification exhaustive du drag natif, dialogues OS ou beforeunload. L'interaction de retrait a produit un timeout de commande du navigateur autour de la confirmation ; la case retirée et la conservation après confirmation/Undo ont ensuite été vérifiées. Cela ne vaut pas PASS du dialogue natif.
3. Les deux arrêts historiques P09/Contexts ci-dessus restent ouverts. Aucun changement de golden pour les absorber.
4. Fournisseurs Mobility réels, session multiappareil et performance authentifiée non mesurés dans L4-A. Les capacités non publiées (payeurs nominatifs, inventaire, nouvelles règles de partage) restent absentes.

Huit fichiers produit concernés : shell, éditeur Soirée, carte Context, CSS, chargement des éditeurs, DTO UI, service Composer, nouveau présentateur serveur ; aucun changement de Finance V2, Kernel, Savings, C0, SNAP-3, RLS ou migration. Aucun writer financier ou Plan→Réel ajouté. Les bases de navigateur sont des fixtures en mémoire (`plans=0`, `revisions=0`, `remoteWrites=0`). Les scénarios Apply existants ne s'exécutent que sur leur PGlite isolé.

**Suite autorisée de cette mission : PR prête pour revue, puis STOP.** La fusion/diffusion Production exige un GO utilisateur distinct. Aucun L4-B commencé.
