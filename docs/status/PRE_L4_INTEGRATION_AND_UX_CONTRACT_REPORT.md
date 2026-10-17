# PRE-L4 — Intégration contrôlée et contrat UX

16 octobre 2026. **DELIVERED_WITH_LIMITATIONS — GO explicite reçu, PR #50 → #51 → #52 fusionnées, Production READY et smoke authentifié en lecture seule exécuté.**

```text
PRE_L4_INTEGRATION_STATUS = READY_WITH_LIMITATIONS
DELIVERY_STATUS = DELIVERED_WITH_LIMITATIONS
INTEGRATION_READY = WITH_LIMITATIONS
C1_C2_C3_DIFF = VERIFIED
TESTED_PRODUCT_EQUIVALENCE = PASS
MAIN_BEFORE = 5cfb1211d114ddaa574f63372cdb9c4cfc7e660d
MAIN_AFTER = 7765bc532511d777ef3e3c80ff0b48826a4e465e
C1_PR_STATUS = MERGED_dc84adad4dd7fbcf8b478e9e5749dc7b4fa8bf06
C2_PR_STATUS = MERGED_bab615a0f3b6ae75e69b7fe7e8726d738ee388f6
C3_PR_STATUS = MERGED_7765bc532511d777ef3e3c80ff0b48826a4e465e
D01 = PASS_LIMITED_FIXTURE
D02 = PASS_LIMITED_FIXTURE
D03 = PASS_LIMITED_DESKTOP_FIXTURE
D04 = PASS_SYNTHETIC_SERVICES
NATIVE_INTERACTIONS = PARTIAL
AUTH_CYCLE = NOT_RUN_AUTH
FINANCIAL_PARITY = PASS_198_UNCHANGED
HISTORICAL_COMPATIBILITY = PASS_SYNTHETIC
DRAFT_HTTP = PASS_LOCAL_MOCKED_SERVICE_ONLY
NEXT_BUILD = PASS_FULL_NEXT_VERCEL_PRODUCTION_FINAL_MAIN
VERCEL_PRODUCTION = READY_ALIAS_VERIFIED
PRODUCTION_DEPLOYED_SHA = 7765bc532511d777ef3e3c80ff0b48826a4e465e
PRE_L4_PRODUCTION_DEPLOYED = YES
PRODUCTION_GO = GRANTED_WITH_DOCUMENTED_RESERVATIONS
PRODUCTION_SMOKE = EXECUTED_PASS_AUTHENTICATED_READ_ONLY_SMOKE
CRITICAL_BLOCKERS = NONE_REPRODUCED_IN_EXECUTED_SCOPE
RESIDUAL_LIMITATIONS = NATIVE_CONFIRM_BEFOREUNLOAD_DRAG_BATCH; JWT_ISOLATED_CYCLE
```

Le GO « GO Production avec ces réserves » a été reçu pour les trois merge commits et leurs déploiements. La livraison est réalisée; les certifications natives et du cycle JWT isolé restent manquantes. Le smoke authentifié de lecture décrit en section6 ne ferme pas ces deux réserves. Les sections1–4 conservent le préflight et la procédure préparée; la section6 atteste leur exécution réelle.

## 1. État et différences au préflight, avant GO

Départ propre sur `codex/composer-v3-pre-l4-c3-final-gate`, HEAD `eb78bb2d4ad201360df3d45cbfc1cec572115ead`. Fetch des quatre branches et lecture GitHub du16octobre, avant GO: main inchangé, les trois PR ouvertes, Ready for Review et mergeables. Le complément documentaire a ensuite porté le HEAD #52 approuvé à `9270478950f9814df07b9e33d30e4c6ec7bf73fe`, sans changement produit. État fusionné réel en section6.

| PR | Base actuelle | HEAD relu | Produit effectivement testé | Diff propre / dépendance |
|---|---|---|---|---|
| [#50 C1](https://github.com/adriensauvageot34/Budgetisation/pull/50) | main `5cfb121` | `fb71ae2deb69a915bdf633b2ce721c4cf904821e` | `e49fe038ab75d8d117f13158abec32ca797642f2`, produit strictement identique au HEAD |18fichiers produit; admission actuelle/historique et garde RAW/PENDING.64docs/preuves et10scripts, incluant les commits documentaires A0 déjà ancêtres. |
| [#51 C2](https://github.com/adriensauvageot34/Budgetisation/pull/51) | C1 `fb71ae2` | `0fc3d0882a649bf023b80edc83724aec43644d30` | `8978ac18b0b4dbe0650c044b3ca086a54014ba8b`, produit identique au HEAD |8fichiers produit; statut par dimension, surfaces de lecture et CSS.48docs/preuves et4scripts. Contient C1 intégralement. |
| [#52 C3](https://github.com/adriensauvageot34/Budgetisation/pull/52) | C2 `0fc3d08` | `eb78bb2d4ad201360df3d45cbfc1cec572115ead` avant ce complément documentaire | réception `9bdeb5022929bd55078f66c8d9c93708b0f75c29`; même produit que C2 |0fichier produit;41docs/preuves et4scripts au point relu, dont panne locale `draftFailOnce`. Le présent rapport et la section UX complètent cette même PR, sans PR concurrente. |

Les comptes ci-dessus décrivent le diff au HEAD relu, pas le nombre de tests. [Listes exactes et arbres Git](evidence/pre-l4-integration/git-reception.json). La comparaison porte sur les octets Git de `src`, `public`, `supabase`, dépendances, TypeScript/Next/Vercel et ignore Vercel. Pas seulement sur le nombre de commits. C3 reste sans changement produit depuis C2. Aucun SQL, migration, modèle financier ou golden modifié.

`merge-base --is-ancestor` valide main→C1→C2→C3. `merge-tree --write-tree` des trois étapes rend exactement l’arbre de chaque branche attendue, sans conflit. Au préflight, ce sont des simulations locales d’arbres; les trois fusions effectivement réalisées après GO ont été vérifiées séparément en section6. Aucun `range-diff` nécessaire: aucun rebase ni remplacement de série n’a eu lieu.

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

Ces réserves réduisent la certification desktop et de persistance réelle; aucune perte financière ou décision confirmée reproductible n’a été observée dans le périmètre exécuté. **Avis préflight: intégration techniquement prête avec réserves.** L’utilisateur les a ensuite explicitement acceptées pour la livraison; elles restent ouvertes.

## 4. Production et procédure préparée avant GO

L’API Vercel atteste le déploiement `dpl_HH6XbfcrYSbgC8eJboEi5vTE7Jxw`: source `git`, branche `main`, target `production`, READY, SHA `5cfb121`, alias `budgetisation-tan.vercel.app`. Le déploiement C3 a target Preview et un SHA différent. Le flux de livraison observé est donc la publication Git de main en Production: **traiter toute fusion vers main comme une livraison Production**. Les réponses MCP ne détaillent pas le commutateur courant d’autodéploiement; `vercel project inspect` ne l’expose pas davantage et son worker de mise à jour a signalé timeout/EPIPE. Ce problème CLI n’est pas un défaut produit. Aucune preuve de désactivation du flux n’est disponible et aucun paramètre n’a été changé: le GO est obligatoire, pas de fusion sur une hypothèse d’absence de déploiement. [Métadonnées GitHub/Vercel](evidence/pre-l4-integration/remote-reception.json).

GitHub autorise merge commit, squash et rebase. **Recommandation: merge commit** pour les trois PR, en préservant les SHA ancêtres. Squash/rebase produiraient de nouveaux ancêtres et compliqueraient les diff des PR empilées; ils ne sont pas interchangeables avec le merge pour ce plan. Aucun force-push ni fermeture artificielle.

Procédure préparée au préflight, puis exécutée après GO avec les preuves en section6:

1. Relire main et les HEAD/contrôles #50/#51/#52 immédiatement avant action; arrêter en cas de drift produit inattendu. Utiliser le HEAD attendu dans l’appel de merge, sans bypass de protection.
2. Merge#50 par merge commit, sans supprimer sa branche. Fetch main, vérifier ses deux parents et l’arbre complet attendu. Attendre le build/statut de cette Production avant de poursuivre si un échec bloquant apparaît.
3. Retarget#51 vers main. Vérifier que le diff produit est exactement celui C1→C2 et ne représente pas C1 une deuxième fois; simulation d’arbre sans conflit. Merge avec son HEAD attendu, fetch/revérifier.
4. Retarget#52 vers main. Son diff produit doit rester vide; seuls réception/contrats/UX/preuves supplémentaires. Merge avec HEAD relu, fetch/revérifier.
5. Contrôler le SHA final main, les trois PR réellement merged, l’identité du produit avec8978ac1, les CI/builds et **l’alias Production sur le SHA attendu**, pas seulement un READY d’une ancienne Preview.
6. Smoke de Production strictement non destructif et authentifié seulement si session admissible disponible: chargement, lecture/rendu/navigation. Aucun Apply ni modification d’un Draft personnel pour fabriquer une preuve. Conserver NOT_RUN pour les accès indisponibles. Ne pas prétendre qu’un READY certifie le parcours JWT.

**Risque opérationnel identifié au préflight:** les merges successifs peuvent générer trois déploiements Production intermédiaires. Le GO a couvert cet ordre et ces déploiements. Les trois builds ont atteint READY; aucun réglage global n’a été changé. Smoke final décrit en section6.

**Rollback:** C3 ne modifie pas le produit; un revert de son merge retire uniquement documents/tests/host synthétique. Un rollback C2 rouvre les défauts de présentation D02/D03 mais doit conserver C1. Un rollback C1 réintroduit des risques d’admission/RAW et requiert une décision dédiée: privilégier un correctif ciblé ou l’arrêt d’Apply selon les mécanismes existants, pas une vieille UI qui efface `unitAmount`. Aucun rollback ne doit supprimer des Drafts, archives, PlanRevisions ou modifier C0. Les données et identités persistées restent intactes; aucun SQL à annuler.

## 5. Contrat UX et passation L4-A

Le document [L4 — contrats/oracles](L4_COMPOSER_CONTRACTS_AND_SCENARIO_ORACLES.md) reçoit une **section8 courte et opérationnelle**: création guidée, réédition par résumé, complément par palette, ordre des questions, dépendances, données persistables, mappings des helpers, coûts non additifs, UNKNOWN et matrice5familles. Aucun composant produit, nouveau moteur ou contrat financier créé.

### Fiche de départ immédiat, sans lancement automatique

- **HEAD officiel main vérifié après livraison:** `7765bc532511d777ef3e3c80ff0b48826a4e465e`, contient C1/C2/C3 et correspond au déploiement Production READY. C’est la base de la prochaine mission L4-A.
- **Branche conseillée:** `codex/composer-v3-l4-a-night-out`, à créer depuis ce main intégré lors d’une mission L4-A autorisée. Cette branche n’a pas été créée ici.
- **Réemploi:** NightOutEditor/editNightOut, sections/choix de Restaurant L1, palette contextuelle/capabilities, sélection composante/quantity, Semantic Draft, durable HTTP/CAS, réducteur Undo/Redo et scheduler. Ne pas appeler editGuidedContext pour un template Soirée non admis par ce helper.
- **Pilote:** Soirée techno à2, entrée/budget principal, boissons individuelles, bouteille partagée, before, repas facultatif, aller/retour. Preset reconnu d’abord; participants demandés si dépendance réelle, date/lieu/prix peuvent rester absents. Réouverture par résumé et modification d’une rubrique.
- **Réserves:** cycle JWT isolé et natif non fermés; aucune promesse de payeur/contribution commune ou champ boissons dédié; reprendre les chemins persistables section2/8, jamais un champ perdu au reload.
- **Tests prioritaires:** modification du seul prix conserve les autres réponses/IDs; SHARED non multiplié par2; parent non additif; retrait/remplacement des seules dépendances incompatibles; UNKNOWN et sauvegarde partielle; RAW/PENDING et Apply; Undo/Redo, réponse hors ordre, CAS/récupération; cycle création→SAVED→reload→réédition sur fixture puis vraiJWT admissible.
- **Interdits:** migration/droits/F0/personnel, nouvel owner, World par question, SNAP-4/refonteP14, Plan→Réel/PlannedExpense, Apply personnel, déploiement automatique.
- **Réussite précise:** parcours création court et réédition ciblée avec réponse persistée à chaque question, conservation exhaustive, vrai coût/provenance Compiler, palette sans fausse option, trois tailles desktop représentatives, suites ciblées/typecheck/build/parité; résultats natifs/JWT annoncés seulement après exécution.

## 6. Livraison exécutée après GO explicite

**Décision utilisateur:** « GO Production avec ces réserves ». L’autorisation porte sur #50→#51→#52 par merge commits et leurs déploiements, après les contrôles finaux. Les dialogues/drag natifs et le cycle JWT isolé restent non certifiés. [Autorisation et HEAD approuvés](evidence/pre-l4-integration/release-authorization.json).

Le dernier HEAD #52 `9270478` avait Vercel success et une Preview READY; son journal complet a été relu avant le premier merge. Chaque retarget a été suivi d’une comparaison intégrale du diff attendu. Aucune protection GitHub contournée, aucun force-push ni réécriture des branches existantes.

| PR | HEAD approuvé | Merge dans main | Production automatique |
|---|---|---|---|
| [#50 C1](https://github.com/adriensauvageot34/Budgetisation/pull/50) | `fb71ae2` | `dc84adad4dd7fbcf8b478e9e5749dc7b4fa8bf06` | `dpl_J92d7BezNXRtY2cVq6nQvjSQzHwy` READY, Vercel success |
| [#51 C2](https://github.com/adriensauvageot34/Budgetisation/pull/51) | `0fc3d08` | `bab615a0f3b6ae75e69b7fe7e8726d738ee388f6` | `dpl_7HPv4jH9ZGLWEgg6NE2iLRERQ3uH` READY, Vercel success |
| [#52 C3](https://github.com/adriensauvageot34/Budgetisation/pull/52) | `9270478` | `7765bc532511d777ef3e3c80ff0b48826a4e465e` | `dpl_5hg1dYL2dJtUmXfGgDxU9Dwjdexm` READY, Vercel success |

Les trois PR ont été relues `closed` / `merged=true`. Main final a pour parents `bab615a` et `9270478`. Son arbre complet `d1d55d591285fe52b56799f494bce7db8441e4f3` est exactement celui du HEAD #52 approuvé. Tous les ancêtres C1/C2/C3 sont conservés. Le diff produit reste vide avec le C2 testé `8978ac1`. [Arbres et parents](evidence/pre-l4-integration/release-git-final.json), [diff C2 retargeté](evidence/pre-l4-integration/release-c2-diff.json), [diff C3 retargeté](evidence/pre-l4-integration/release-c3-diff.json).

**Production finale:** [Budgetisation](https://budgetisation-tan.vercel.app) pointe effectivement sur `dpl_5hg1dYL2dJtUmXfGgDxU9Dwjdexm`, target production, source Git/main, SHA `7765bc5`, READY, sans erreur d’alias. L’URL propre du déploiement est [budgetisation-lnlcbk0lj](https://budgetisation-lnlcbk0lj-adriensauvageot34-6137s-projects.vercel.app). Build Next complet et TypeScript terminés; `Deployment completed` attesté. [Métadonnées et statuts](evidence/pre-l4-integration/release-deployments.json), [journal complet final](evidence/pre-l4-integration/release-c3-production-build.log). Dépendances/cache Vercel normaux réutilisés, pas une installation fraîche. Aucun changement de région, de flag ou de configuration globale.

**Smoke authentifié exécuté en lecture seule:** ouverture de Composer novembre sur l’alias public, session existante réutilisée sans lire ni saisir d’identifiant. Le premier appel de navigation de l’outil a expiré, mais l’inventaire puis le DOM officiel ont confirmé la page chargée; aucun rechargement n’a été nécessaire. Board et bibliothèque visibles, message « Projection actualisée », inconnues explicites, panneau financier ouvert/fermé, page suivante/précédente fonctionnelles. Apply est désactivé sans sauvegarde confirmée. Aucune carte créée ni éditée, aucune saisie RAW, aucun Apply ni appel volontaire de writer. Le statut « Aucun brouillon enregistré » reste inchangé. Aucune donnée financière personnelle ni capture de ces valeurs n’est ajoutée aux preuves. [Résultats minimisés](evidence/pre-l4-integration/release-production-smoke.json).

La requête officielle de journaux, bornée au déploiement final / Production / dix dernières minutes / niveaux error et fatal, groupée par niveau, n’a retourné aucun groupe. Ce constat ne prouve pas une absence globale d’erreur. Le smoke ne valide ni sauvegarde/reload/CAS authentifiés, ni dialogues/drag natifs. Aucun gain de performance ou P95 annoncé.

**Périmètre respecté:** aucune migration, modification de droits, réactivation de compte F0, édition d’un Draft personnel, création de PlanRevision ou écriture financière effectuée par cette livraison. Aucun contrôle exhaustif de données financières n’a été relancé pour fabriquer cette affirmation; les seules interactions Production sont celles listées ci-dessus.

**État local:** compte rendu et preuves de livraison conservés dans un commit documentaire local sur `codex/composer-v3-pre-l4-production-record`, issu du main final. Ce complément n’est pas poussé et n’est pas présenté comme déployé; il évite un quatrième déploiement pour la seule preuve. La base officielle L4-A reste `7765bc5`.

**Verdict final: DELIVERED_WITH_LIMITATIONS.** PRE-L4 est livré avec les réserves explicitement acceptées. L4-A n’est pas commencé. Aucun rollback requis dans les vérifications exécutées.
