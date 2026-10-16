# PRE-L4 — Intégration contrôlée et contrat UX

16 octobre 2026. **READY_FOR_APPROVAL — aucune fusion ni livraison Production effectuée.**

```text
PRE_L4_INTEGRATION_STATUS = READY_WITH_LIMITATIONS
INTEGRATION_READY = WITH_LIMITATIONS
C1_C2_C3_DIFF = VERIFIED
TESTED_PRODUCT_EQUIVALENCE = PASS
MAIN_BEFORE = 5cfb1211d114ddaa574f63372cdb9c4cfc7e660d
MAIN_AFTER = UNCHANGED
C1_PR_STATUS = OPEN_READY_FOR_REVIEW_MERGEABLE
C2_PR_STATUS = OPEN_READY_FOR_REVIEW_MERGEABLE_STACKED_ON_C1
C3_PR_STATUS = OPEN_READY_FOR_REVIEW_MERGEABLE_STACKED_ON_C2
D01 = PASS_LIMITED_FIXTURE
D02 = PASS_LIMITED_FIXTURE
D03 = PASS_LIMITED_DESKTOP_FIXTURE
D04 = PASS_SYNTHETIC_SERVICES
NATIVE_INTERACTIONS = PARTIAL
AUTH_CYCLE = NOT_RUN_AUTH
FINANCIAL_PARITY = PASS_198_UNCHANGED
HISTORICAL_COMPATIBILITY = PASS_SYNTHETIC
DRAFT_HTTP = PASS_LOCAL_MOCKED_SERVICE_ONLY
NEXT_BUILD = PASS_FULL_NEXT_VERCEL_PREVIEW_C3_HEAD
VERCEL_PRODUCTION = UNCHANGED_READY_ON_PRE_L4_MAIN
PRODUCTION_DEPLOYED_SHA = 5cfb1211d114ddaa574f63372cdb9c4cfc7e660d
PRE_L4_PRODUCTION_DEPLOYED = NO
PRODUCTION_GO = NOT_GRANTED
PRODUCTION_GO_REQUIRED = YES
CRITICAL_BLOCKERS = NONE_REPRODUCED_IN_EXECUTED_SCOPE
RESIDUAL_LIMITATIONS = NATIVE_CONFIRM_BEFOREUNLOAD_DRAG_BATCH; JWT_ISOLATED_CYCLE
```

READY_WITH_LIMITATIONS signifie que le code et son intégration sont prêts à être approuvés, avec les deux certifications manquantes explicites. Ce n’est ni une certification native/JWT complète ni une intégration déjà réalisée. Le GO Production reste la seule décision humaine requise pour la fusion; il doit accepter ou refuser ces réserves.

## 1. État réel et différences

Départ propre sur `codex/composer-v3-pre-l4-c3-final-gate`, HEAD `eb78bb2d4ad201360df3d45cbfc1cec572115ead`. Fetch des quatre branches et lecture GitHub du16octobre: main inchangé, les trois PR sont ouvertes, Ready for Review et mergeables. Les commits A0/C1/C2/C3 ne sont pas fusionnés dans main.

| PR | Base actuelle | HEAD relu | Produit effectivement testé | Diff propre / dépendance |
|---|---|---|---|---|
| [#50 C1](https://github.com/adriensauvageot34/Budgetisation/pull/50) | main `5cfb121` | `fb71ae2deb69a915bdf633b2ce721c4cf904821e` | `e49fe038ab75d8d117f13158abec32ca797642f2`, produit strictement identique au HEAD |18fichiers produit; admission actuelle/historique et garde RAW/PENDING.64docs/preuves et10scripts, incluant les commits documentaires A0 déjà ancêtres. |
| [#51 C2](https://github.com/adriensauvageot34/Budgetisation/pull/51) | C1 `fb71ae2` | `0fc3d0882a649bf023b80edc83724aec43644d30` | `8978ac18b0b4dbe0650c044b3ca086a54014ba8b`, produit identique au HEAD |8fichiers produit; statut par dimension, surfaces de lecture et CSS.48docs/preuves et4scripts. Contient C1 intégralement. |
| [#52 C3](https://github.com/adriensauvageot34/Budgetisation/pull/52) | C2 `0fc3d08` | `eb78bb2d4ad201360df3d45cbfc1cec572115ead` avant ce complément documentaire | réception `9bdeb5022929bd55078f66c8d9c93708b0f75c29`; même produit que C2 |0fichier produit;41docs/preuves et4scripts au point relu, dont panne locale `draftFailOnce`. Le présent rapport et la section UX complètent cette même PR, sans PR concurrente. |

Les comptes ci-dessus décrivent le diff au HEAD relu, pas le nombre de tests. [Listes exactes et arbres Git](evidence/pre-l4-integration/git-reception.json). La comparaison porte sur les octets Git de `src`, `public`, `supabase`, dépendances, TypeScript/Next/Vercel et ignore Vercel. Pas seulement sur le nombre de commits. C3 reste sans changement produit depuis C2. Aucun SQL, migration, modèle financier ou golden modifié.

`merge-base --is-ancestor` valide main→C1→C2→C3. `merge-tree --write-tree` des trois étapes rend exactement l’arbre de chaque branche attendue, sans conflit. Ce sont des simulations locales d’arbres, **aucune fusion effective et aucun déplacement de main**. Aucun `range-diff` nécessaire: aucun rebase ni remplacement de série n’a eu lieu.

Les trois HEAD relus ont un statut GitHub **Vercel success**. Aucun workflow `.github` n’existe dans ce checkout. Aucun autre contrôle obligatoire n’a été attesté par cette réponse; les protections GitHub effectives devront toujours être respectées au moment du merge.

## 2. Réception D01–D04 et contrôles ciblés

Les sources étant identiques au code C3 réceptionné, aucune réimplémentation ni nouvelle campagne complète des128pistes. Les nouvelles exécutions d’intégration sont distinguées des preuves reprises.

| Contrôle | Exécution de cette mission | Preuve réutilisée légitimement |
|---|---|---|
| C1: borne9999/10000, fractions, zéro, prix admis, scopes, floors/Savings/Renewal, ancien Plan et refus pré-writer | PASS6groupes, exit0 | Matrice C1 et campagne C3; même source serveur |
| C2: REFERENCE/DECISION/UNKNOWN, zéro explicite, Café et provenance par dimension | PASS12cas SSR/services, exit0 | Parcours C2/C3 sur Board/inspecteur/À piloter/inline |
| D01 Courses250→RAW300, Escape/Enter, reload, navigation | Pas de nouveau parcours DOM redondant |18observations C3, mêmes15modules du bundle vérifiés; Apply interdit, ancien digest inchangé en RAW, SAVED distinct de FRESH |
| D03 erreur et géométrie desktop1440/1728/1920 | Pas de nouveau changement CSS ni rerun géométrique inutile | Rectangles, captures et vrais viewports C2/C3; texte inconnu contenu, boutons28px séparés, erreur contenue, RAW conservé sur Board40 |
| Draft HTTP | PASS5, exit0, service simulé uniquement | Reprise C3 ERROR→SAVED sans fauxFRESH; ce PASS ne prouve pas JWT/RLS |
| Scheduler Preview | PASS5, exit0 | Réponses hors ordre, sequence/digest/mois/World et erreurs C3 |
| P13 | PASS8, exit0, PGlite synthétique | CAS, idempotence, commit/relecture incertaine et absence de retry aveugle |
| Parité historique | PASS22×9=198, exit0, sans `--record` | Même golden; aucun assouplissement économique |
| TypeScript | PASS exit0, `tsc --noEmit --incremental false` | Aucun fichier TypeScript modifié ensuite |
| Kernel/Savings, Simple Levers/Renewal, B3, L3.3/L3.1, R6, Restaurant L1, C8 serveur complet | Non rejoués inutilement dans cette mission | Seize suites C3 PASS sur produit strictement identique; logs existants conservés, pas présentés comme une nouvelle exécution |

[Six commandes, heures et codes de sortie](evidence/pre-l4-integration/regressions.json), journaux dans le même dossier. Le wrapper a préservé les preuves antérieures des suites. Aucun test exécuté de cette tranche n’a échoué.

**Compatibilité historique:** le test C1 vient de relire l’ancienne révision hors borne10000 avec sa preuve propriétaire, tout en refusant la même valeur comme nouveau Draft/Apply. L3.3 conserve les anciens count-only et nouveaux overrides `unitAmount` sur la même source. Le refus d’admission avant writer ne doit pas transformer une tentative d’écriture incertaine en refus garanti: contrôle C1/P13 PASS.

**Build complet du HEAD C3 relu:** Preview `dpl_CbFE8C5jUAsT34RZrrghUhhxZm9y`, SHA `eb78bb2`, READY. Journal officiel relu: `npm run build`→`next build16.2.6`, compilation36s, TypeScript34,6s, pages8/8 et optimisation terminées, puis Deployment completed. Dépendances/cache Vercel normaux réutilisés; pas une installation fraîche. [Journal intégral](evidence/pre-l4-integration/vercel-c3-head-build.log). C’est un build déjà exécuté, vérifié dans cette mission; aucun nouveau build manuel présenté comme tel. Les seuls changements suivants sont documentaires.

**Ressources:** preuves C3 reprises avec identité de source: gestes visuels0requête supplémentaire/0événement Draft; groupe fermé→ouvert→fermé4278→4734→4278nœuds,6images, digest stable. Pas de claim de P95,2secondes ou absence de fuite longue durée. SNAP-3 et Canonical57014 ne sont pas réinvestigués.

## 3. Réserves ciblées et résultat de disponibilité

### Natif: PARTIAL, pas de nouveau PASS natif

L’inventaire officiel donne uniquement IAB/DOM et MCP Apps, sans navigateur Chrome connecté. L’inventaire Windows donne une fenêtre Chrome personnelle sans rapport avec Composer: **aucun contenu de cette fenêtre n’a été lu**. L’essai officiel d’ouvrir une nouvelle fenêtre vierge a été arrêté car une interaction utilisateur était détectée. L’inventaire suivant ne montre aucune fenêtre Composer dédiée. Pas de retry, injection d’événement ou contournement.

Confirm refus/acceptation, beforeunload, drag maintenu et plusieurs clics/transitions dans une fenêtre réelle350ms restent **NOT_RUN_NATIVE**. Les gardes/PENDING/unmount sont testés par les contrats locaux; les séquences clavier/DOM sont reçues par C3. Ce mélange justifie PARTIAL et ne vaut pas PASS natif. [Disponibilité](evidence/pre-l4-integration/native-availability.json). Le protocole manuel C3 §5 reste applicable sur fixture isolée, sans `a0Confirm`.

### JWT: NOT_RUN_AUTH, disponibilité réellement vérifiée

Une seule requête Supabase de métadonnées, transaction READ ONLY et timeout3s, a été bornée aux deux foyers fictifs H1/H2 déjà réservés, au plus4IDs. Résultat agrégé: **3comptes,3bannis,0marqueur administrateur,0compte fictif admissible**. Aucun e-mail, secret, token, session ou contenu Draft personnel lu. Aucun compte réactivé, aucune RLS modifiée. L’inventaire navigateur ne contient aucune session de test isolée. [Preuve](evidence/pre-l4-integration/auth-availability.json).

Cette lecture privilégiée de disponibilité n’est pas une preuve RLS/JWT. Il n’est pas autorisé de transformer F0 ou le compte personnel en substitut. La validation restante exige un compte isolé **déjà actif et autorisé**, une session authentifiée admissible au chemin applicatif Canonical et Draft HTTP, puis: count13/prix2,10 → SAVED réel → reload même IDs/valeurs → count14 seul conserve2,10 → Undo/Redo → save/relecture → archive récupérable → CAS/idempotence/récupération conflit. Vérifier zéroPlanRevision/Apply/Baseline/écriture financière; ne rien supprimer pour nettoyer. Si sa disponibilité nécessite des droits nouveaux, une autorisation séparée est nécessaire.

Ces réserves réduisent la certification desktop et de persistance réelle; aucune perte financière ou décision confirmée reproductible n’a été observée dans le périmètre exécuté. **Avis: intégration techniquement prête avec réserves, décision Production à l’utilisateur.** Sans acceptation explicite, pas de livraison.

## 4. Production et procédure prête à exécuter après GO

L’API Vercel atteste le déploiement `dpl_HH6XbfcrYSbgC8eJboEi5vTE7Jxw`: source `git`, branche `main`, target `production`, READY, SHA `5cfb121`, alias `budgetisation-tan.vercel.app`. Le déploiement C3 a target Preview et un SHA différent. Le flux de livraison observé est donc la publication Git de main en Production: **traiter toute fusion vers main comme une livraison Production**. Les réponses MCP ne détaillent pas le commutateur courant d’autodéploiement; `vercel project inspect` ne l’expose pas davantage et son worker de mise à jour a signalé timeout/EPIPE. Ce problème CLI n’est pas un défaut produit. Aucune preuve de désactivation du flux n’est disponible et aucun paramètre n’a été changé: le GO est obligatoire, pas de fusion sur une hypothèse d’absence de déploiement. [Métadonnées GitHub/Vercel](evidence/pre-l4-integration/remote-reception.json).

GitHub autorise merge commit, squash et rebase. **Recommandation: merge commit** pour les trois PR, en préservant les SHA ancêtres. Squash/rebase produiraient de nouveaux ancêtres et compliqueraient les diff des PR empilées; ils ne sont pas interchangeables avec le merge pour ce plan. Aucun force-push ni fermeture artificielle.

Procédure conditionnelle, non exécutée:

1. Relire main et les HEAD/contrôles #50/#51/#52 immédiatement avant action; arrêter en cas de drift produit inattendu. Utiliser le HEAD attendu dans l’appel de merge, sans bypass de protection.
2. Merge#50 par merge commit, sans supprimer sa branche. Fetch main, vérifier ses deux parents et l’arbre complet attendu. Attendre le build/statut de cette Production avant de poursuivre si un échec bloquant apparaît.
3. Retarget#51 vers main. Vérifier que le diff produit est exactement celui C1→C2 et ne représente pas C1 une deuxième fois; simulation d’arbre sans conflit. Merge avec son HEAD attendu, fetch/revérifier.
4. Retarget#52 vers main. Son diff produit doit rester vide; seuls réception/contrats/UX/preuves supplémentaires. Merge avec HEAD relu, fetch/revérifier.
5. Contrôler le SHA final main, les trois PR réellement merged, l’identité du produit avec8978ac1, les CI/builds et **l’alias Production sur le SHA attendu**, pas seulement un READY d’une ancienne Preview.
6. Smoke de Production strictement non destructif et authentifié seulement si session admissible disponible: chargement, lecture/rendu/navigation. Aucun Apply ni modification d’un Draft personnel pour fabriquer une preuve. Conserver NOT_RUN pour les accès indisponibles. Ne pas prétendre qu’un READY certifie le parcours JWT.

**Risque opérationnel connu:** les merges successifs peuvent générer trois déploiements Production intermédiaires. Il n’existe ici aucune autorisation de changer le workflow global pour les neutraliser. Un GO doit couvrir cet ordre et ses déploiements. Aucun smoke post-livraison n’a été exécuté puisque rien n’est livré.

**Rollback:** C3 ne modifie pas le produit; un revert de son merge retire uniquement documents/tests/host synthétique. Un rollback C2 rouvre les défauts de présentation D02/D03 mais doit conserver C1. Un rollback C1 réintroduit des risques d’admission/RAW et requiert une décision dédiée: privilégier un correctif ciblé ou l’arrêt d’Apply selon les mécanismes existants, pas une vieille UI qui efface `unitAmount`. Aucun rollback ne doit supprimer des Drafts, archives, PlanRevisions ou modifier C0. Les données et identités persistées restent intactes; aucun SQL à annuler.

## 5. Contrat UX et passation L4-A

Le document [L4 — contrats/oracles](L4_COMPOSER_CONTRACTS_AND_SCENARIO_ORACLES.md) reçoit une **section8 courte et opérationnelle**: création guidée, réédition par résumé, complément par palette, ordre des questions, dépendances, données persistables, mappings des helpers, coûts non additifs, UNKNOWN et matrice5familles. Aucun composant produit, nouveau moteur ou contrat financier créé.

### Fiche de départ immédiat, sans lancement automatique

- **HEAD officiel actuel main:** `5cfb1211d114ddaa574f63372cdb9c4cfc7e660d`, ne contient pas C1/C2/C3. Il n’existe pas encore de main PRE-L4 intégré. Après GO et fusions, prendre le **SHA main final réellement vérifié**, jamais deviné à l’avance. En attendant, la branche C3 finale de#52 est la base complète pour un développement local explicitement autorisé, et doit rester identifiée comme non fusionnée.
- **Branche conseillée:** `codex/composer-v3-l4-a-night-out`, créée depuis ce main intégré, ou depuis le HEAD C3 validé si une autorisation de démarrage local précède l’intégration. Ne pas créer cette branche maintenant.
- **Réemploi:** NightOutEditor/editNightOut, sections/choix de Restaurant L1, palette contextuelle/capabilities, sélection composante/quantity, Semantic Draft, durable HTTP/CAS, réducteur Undo/Redo et scheduler. Ne pas appeler editGuidedContext pour un template Soirée non admis par ce helper.
- **Pilote:** Soirée techno à2, entrée/budget principal, boissons individuelles, bouteille partagée, before, repas facultatif, aller/retour. Preset reconnu d’abord; participants demandés si dépendance réelle, date/lieu/prix peuvent rester absents. Réouverture par résumé et modification d’une rubrique.
- **Réserves:** cycle JWT isolé et natif non fermés; aucune promesse de payeur/contribution commune ou champ boissons dédié; reprendre les chemins persistables section2/8, jamais un champ perdu au reload.
- **Tests prioritaires:** modification du seul prix conserve les autres réponses/IDs; SHARED non multiplié par2; parent non additif; retrait/remplacement des seules dépendances incompatibles; UNKNOWN et sauvegarde partielle; RAW/PENDING et Apply; Undo/Redo, réponse hors ordre, CAS/récupération; cycle création→SAVED→reload→réédition sur fixture puis vraiJWT admissible.
- **Interdits:** migration/droits/F0/personnel, nouvel owner, World par question, SNAP-4/refonteP14, Plan→Réel/PlannedExpense, Apply personnel, déploiement automatique.
- **Réussite précise:** parcours création court et réédition ciblée avec réponse persistée à chaque question, conservation exhaustive, vrai coût/provenance Compiler, palette sans fausse option, trois tailles desktop représentatives, suites ciblées/typecheck/build/parité; résultats natifs/JWT annoncés seulement après exécution.

**État final de cette mission: READY_FOR_APPROVAL.** L4-A n’est pas commencé. La section9 «Frontière Production impérative» de la mission exige votre GO distinct avant les fusions; la simple préparation n’a déclenché aucune livraison.
