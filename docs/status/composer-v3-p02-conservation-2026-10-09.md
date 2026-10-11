# Composer V3 — P02, contrats sémantiques et conservation

**Date :** 9 octobre 2026. **Point de départ vérifié :** `29367d4a5177f982a71f8fa9bdf9f651af8ca412`, worktree propre avant création de la branche `codex/composer-v3-p02-contracts`. **Mandat :** P02 uniquement. **Gate :** `G1_CONTRACT_FIXTURE = EXECUTED_PASS` ; `P02 = IMPLEMENTED_FOR_REVIEW`. Ce verdict concerne les contrats et les fixtures, pas les six parcours UX authentifiés.

## Correction de preuve P01 et préconditions

Le journal initial `build-main.log` finissait par `spawn EPERM` et ne prouvait pas le PASS annoncé. Aucune trace conservée d'une relance antérieure n'a été retrouvée. Une relance explicite de `node node_modules/next/dist/bin/next build` sur le checkout `main` a ensuite fini avec `BUILD_EXIT_CODE=0` ; le journal supplémentaire est livré hors du dépôt. Les statuts décidés par l'utilisateur sont `G0_RECOVERY_KERNEL_R6 = EXECUTED_PASS`, `E0_FIXTURE = ACCEPTED_LIMITED_BASELINE`, `E0_REAL_AUTHENTICATED = NOT_RUN`, `P01 = ACCEPTED_WITH_RESERVATIONS`. Les performances réelles restent à mesurer avant P14/P15. DEC-24 autorise la compatibilité conservatrice, pas une migration.

## Ce qui a changé

- `EDIT_CONTEXT` applique un patch partiel contrôlé par les champs du template : une clé omise survit ; `null` reste un inconnu explicite ; une chaîne vide efface la valeur. Une clé étrangère ou une valeur invalide est rejetée. Le service accepte maintenant un payload structuré validé, tandis que l'éditeur simple actuel continue de n'afficher que ses champs primitifs.
- Champs optionnels, par template : `recipientRef`, `occasion`, `objectLabel` pour Cadeau ; `participantRefs` et `placeRef` pour repas/activité ; `personVisitedRef`, `participantRefs`, `placeRef`, `timingNote` pour Visite ; `participantRefs`, `placeRef`, `timingNote` pour Soirée ; `participantRefs`, `destinationRef`, `nightCount`, `lodgingKind`, `timingNote` pour Séjour ; `productLabel`, `merchantLabel`, `placeRef` pour Achat. Les dates existantes demeurent facultatives. Les séjours intermois restent refusés par le validateur de date : aucune date n'est inventée ni tronquée.
- Les références de personnes reprennent `ProspectivePersonRef` ; les lieux reprennent `ProspectivePlaceRef`. Les contacts `CONTACT` sont limités au registre existant. Les IDs `HOUSEHOLD_PERSON` et `KNOWN` doivent être vérifiés par l'owner du foyer avant un nouvel Apply ; en l'absence de vérificateur, Apply refuse avant la RPC. Les références `TEXT` conservent la déclaration de l'utilisateur.
- Les composants ont un `unitBasis` optionnel `ITEM | PERSON | SHARED`, distinct de `quantity` et du prix unitaire. Aucun nombre de participants ni coût n'est déduit automatiquement. Funding continue d'utiliser le Kernel : `BANK` admissible, Swile/Edenred rejetés tant que leur capacité n'est pas certifiée.
- `fields.fieldSchemaVersion = context-fields@v2` identifie les champs enrichis dans le JSON déjà accepté par la RPC C0. Le SQL C0 refuse toute clé nouvelle au niveau du Context ; la première tentative de marqueur à ce niveau a échoué en fixture et a été retirée. Aucun SQL ou schéma persistant n'a changé.
- Le manifest garde **l'ancienne forme exacte du registre** pour un état sans champs V2. Cela préserve les 22 cas × 9 hashes historiques, y compris digest de manifest et Preview. Un état enrichi porte le nouveau registre dans son manifest ; le moteur financier, les rôles des slots et l'owner V2 restent les mêmes.

## Matrice champ → autorité → admission → trajet

| Famille | Champs persistables et identités | Owner / validation | Adaptateur et conservation |
|---|---|---|---|
| Contrôles du mois | `decisionId`, `decisionSlotKey`, `SET_STATE`, montant ou occurrences, préférences `PRESERVE` | Slot Baseline/C3 et `materializePlanSlots`; état explicite, unité du slot, capacité disponible | Mutation existante → `controls` → RPC C0 → `PlanRevision.semanticState.controls` → reader existant. Test P02 Courses et digests historiques. |
| Épargne | Identité `savings:<reservationId>`, montant choisi, protection du slot | Reservation Baseline/Kernel ; slot protégé non relâchable, aucune nouvelle cagnotte | Même chemin `SET_STATE` et révision ; test P02 allocation `ADJUSTABLE`, suites Kernel protection. |
| Cadeau | ID Context, `recipientRef`, `occasion`, `objectLabel`, date nullable ; ID sélection, quantité, prix `MANUAL/QUOTE/UNKNOWN`, funding | Template `gift` ; refs typées, coût/funding du Kernel, sélection `item` requise | `patchContextEditorFields` / `readContextEditorPayload` ↔ `fields` + `slotSelections` ; service `EDIT_CONTEXT`, JSON, Apply PGlite, révision, relecture structurale testés. |
| Restaurant / achat | Participants, lieu `KNOWN/TEXT` ; produit/marchand pour achat ; `unitBasis`, quantité, binding, funding | Templates FOOD/`purchase`, registre C4 et Kernel ; aucun prix par personne déduit du foyer | Champs propres au template, `selectionId` et binding inchangés ; restaurant inclus dans la fixture structurale. Les éditeurs riches futurs restent à faire. |
| Visite | Personne visitée, participants, lieu, timing souple, date nullable, enfant et trajet | Templates `family-visit`/`friend-visit`, graphe C4 ; un parent et un socket par enfant | Payload ↔ Context parent et enfant ; `contextOccurrenceId`, `selectionId`, parent, transport, funding traversent JSON/Apply/relecture sur fixture. |
| Soirée | Participants, lieu, timing, date/fin nullable ; before/main, prix unitaire, quantité, `unitBasis`, outbound/return distincts | Template `night-out` ; cardinalités, Kernel pour prix/funding, Mobility pour trajets | Tous les slots et IDs restent dans `slotSelections` ; mutation d'un autre champ puis révision/relecture testées. |
| Séjour court | Destination, participants, `nightCount`, `lodgingKind`, timing, dates nullables, hébergement, courses, activité enfant, transport | Template `short-stay` ; date dans le mois cible seulement ; aucun intermois implicite | Même aller-retour structuré ; `plannedDate: null` et `endDate: null` restent distincts d'une date calculée. Test de refus d'une fin en décembre pour novembre. |

`fields` ne stocke ni BuilderState opaque, ni hover, position, cluster, navigation de wizard, ou pile Undo/Redo. Provenance `EXPLICIT_USER_DECISION` du Context et des sélections, IDs et relation parent/enfant restent dans les objets existants. `UNKNOWN` est conservé comme tel, sans conversion en zéro. Aucun writer PlannedExpense, Wallet, Mobility observée ou Canonical n'a été ajouté.

## Preuves exécutées

| Vérification | Statut et portée |
|---|---|
| `check-phase2-planner-p02-conservation.mjs` | **EXECUTED_PASS**, 8 groupes : ancienne révision lisible ; adaptateurs par template ; `EDIT_CONTEXT` structuré et modification d'un autre champ ; validation/refus ; JSON et snapshots Undo/Redo sémantiques ; coût `UNKNOWN` ; refs connues fail-closed ; Apply/Reload dans PGlite synthétique. Deux RPC locales, canaris inchangés, zéro écriture distante. |
| C2 Kernel, C4 Contexts, C8 Composer serveur, R3 interactions | **EXECUTED_PASS** : 40, 29, 35, 22 groupes respectivement. |
| Parité financière historique | **EXECUTED_PASS** : 22 cas × 9 hashes, incluant anciens manifest et Preview ; `remoteWrites=0`. Un échec intermédiaire a révélé que le registre enrichi modifiait les digests anciens ; corrigé par la projection historique, puis relancé PASS. |
| R6 présentation, R2 Atomic UI, R4 Final Polish, architecture, TypeScript | **EXECUTED_PASS** sur le code P02. Ces scripts demandent toujours une certification navigateur pour les gestes réels. |
| Build P02 | **EXECUTED_PASS avec configuration temporaire d'outillage** : `node node_modules/next/dist/bin/next build`, Next 16.2.6/Turbopack, compilation, TypeScript, 8/8 pages, `BUILD_EXIT_CODE=0`. Le `next.config.mjs` temporaire fixait `turbopack.root` au parent commun pour la jonction `node_modules`, puis a été supprimé. Le build Webpack essayé auparavant a échoué sur `node:crypto`; son journal est conservé. |
| Apply/Reload authentifié réel, browser des six éditeurs riches, PostgreSQL multi-connexion, performances réelles | **NOT_RUN**. Le PASS PGlite utilise rôle/foyer synthétiques et ne vaut pas certification d'une application authentifiée ni de P14/P15. |

## Compatibilité, limites et rollback

Le lecteur `parsePlanRevisionRow` et le SQL C0 restent inchangés. Les anciennes révisions sans `fieldSchemaVersion` se lisent ; les nouveaux champs restent à l'intérieur de `fields`. Les révisions sont immuables. Le test de parité conserve les digests financiers et de manifest des 22 anciens cas. Les références `KNOWN` bénéficient du garde owner dans `createPlannerDependencies`, mais **le parcours avec une vraie session et de vrais IDs n'a pas été testé**. L'éditeur React actuel n'expose pas encore tous les nouveaux champs ; P02 n'est pas une certification des six parcours complets ou du catalogue DEC-08. Le test Undo/Redo P02 vérifie des snapshots sémantiques, pas une interaction navigateur complète.

Avant toute mise en production de nouveaux éditeurs, vérifier le lookup d'identités sur environnement isolé, les validations de références et la lecture des anciennes révisions réelles. Si le code doit être retiré avant écriture de révisions V2, revenir au commit P01 suffit. **Après** de telles écritures, garder un lecteur compatible et corriger vers l'avant ; ne jamais effacer une `PlanRevision` ni réinitialiser une base. Toute migration future, RLS, rétention et rollback exigent une approbation technique séparée.

**Hors périmètre non engagé :** P03 et suivants, Draft durable, Swile/Edenred, intermois, mutations Plan→Réel, moteur financier parallèle, migration, push/PR/merge/déploiement. Rapport remis pour examen du gate P02.
