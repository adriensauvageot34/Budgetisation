# C2 — Semantic Compiler, PlanSlots et Apply

| Champ | Résultat |
| --- | --- |
| HEAD_BEFORE | `6460764da3fdc4ce35030db63879066f41989055` |
| HEAD_AFTER | Commit contenant ce rapport : `git log -1 --format=%H -- docs/status/planner-c2-kernel-2026-10-05.md` |
| BRANCH | `main` |
| MIGRATION_REQUIRED | NO |
| ZERO_HISTORICAL_WRITE | YES — fixtures synthétiques uniquement, aucun appel distant |
| C2_KERNEL_CERTIFIED | YES — noyau générique sur fixtures, limites ci-dessous |

## SCOPE_DONE

La chaîne implémentée est : Baseline C1 + état sémantique normalisé →
CompiledSemanticPlanV1 → FinancialScenarioAdapterInputV1 → deriveMonthScenario()
→ PlanProjectionV1. La même évaluation pure est utilisée par Preview, Apply et la
relecture d'un Plan actif. Le résultat financier vient de `economicPlan.scenarios.central`.

Modules : `plan-slot-resolver.ts`, `cost-resolver.ts`, `constraint-engine.ts`,
`financial-adapter.ts`, `compiler.ts`, `apply.ts`, `effective-month-scenario.ts`,
`preview.ts`, `revision-evidence.ts`, `world-reader.ts` et contrats TypeScript.
Le seul changement de l'owner financier existant est l'export de son agrégateur
`sumReferenceComponents` ; `deriveMonthScenario()` n'est pas modifié.

Les contrôles SET_STATE réutilisent la normalisation C0 : dernière valeur par slot,
identités explicites, ordre canonique. Le noyau ne passe pas par MonthChoice ni sa
limite de deux opérations ; le contrat C0 conserve sa borne de 500 contrôles.
Les slots montant/occurrence sont matérialisés avec une capacité déterministe.
Le binding sémantique précède le prix, puis la réconciliation économique expose
CONSUMES_SLOT / EXTRA_TO_SLOT / NO_RELATED_SLOT / UNRESOLVED et
DISPLACEMENT / INCREMENTAL / MIXED / UNKNOWN.

L'adapter remplace en mémoire les composants de référence appartenant au Plan par
leur capacité économique restante et les coûts explicites. Les entrées synthétiques
ont une identité déterministe et un owner dans le manifest ; elles ne deviennent
jamais des lignes de `phase2_planned_expenses`. Les assumptions et categoryTargets
legacy des catégories possédées sont retirés de la copie des MonthInputs, une fois
par clé. Les autres décisions V2 restent présentes. Les Planned Expenses externes
conservent leur identité, apparaissent une fois et consomment aussi la capacité
lorsque le Plan possède leur référence ; aucun intent externe ne devient un fact C1.

Une consommation de montant ne déplace que la capacité disponible et le coût connu.
Une occurrence déplace sa valeur de référence ; un prix explicite inférieur peut
produire un impact incrémental négatif. Une valeur de déplacement UNKNOWN reste null
dans les effets et le manifest : aucune soustraction n'est réalisée, le coût brut
connu entre dans une projection conservatrice marquée PARTIAL.
Les réserves non résolues restent dans le manifest, la projection et les diagnostics.

L'épargne est une réservation structurelle : un SET_STATE sur une épargne ajustable
modifie `effectiveMonthInputs.declaredOutflows`, sans créer de coût économique.
Une réduction d'épargne protégée est BLOCK. Les capabilities C1 restent obligatoires,
y compris pour empêcher un contrôle arbitraire de mobilité travail.

Le template limité `kernel.generic` admet des rôles libres dans `slotSelections` :
`quantity`, `cost` (MANUAL / QUOTE / UNKNOWN), `binding` (slotIdentityKey, relation,
displacement, amount, count), `fundingAllocations`. `fields` contient label,
plannedDate et éventuellement externalIntentId. Un contexte lié à un intent externe
n'ajoute pas une deuxième série de coûts. Ce template est une grammaire de test du
noyau ; aucun registry de domaines complet n'est ajouté.

## Preview, Apply et relecture

`previewPlanScenario()` relit les autorités et la tête active. Son digest inclut la
Baseline, l'état, le manifest, la projection et la révision attendue. Les timestamps
de calcul seuls sont exclus ; les prix, preuves, versions, asOfDate, MonthInputs et
sources effectivement utilisées sont inclus. Les enveloppes stockées sont JSON.

`applyPlanScenario()` relit et recompile côté serveur. Il compare la révision attendue,
le baselineDigest et le previewDigest et refuse BLOCK avant tout writer. Ensuite,
`createPlanApplyRepository(authenticatedClient)` appelle seulement la RPC publique C0
`apply_phase2_month_plan_v1`, avec ses 16 paramètres. Le repository C0 de lecture
`createPlanRepository()` conserve exactement son API sans writer.
L'usage RPC suit la [documentation officielle Supabase](https://supabase.com/docs/reference/javascript/rpc).

Le service valide les preuves retournées et leurs digests couplés. Un retry avec le
même applyRequestId retourne la preuve immuable d'origine ; une intention différente
est un conflit. Une réponse perdue ou un concurrent identique peut être récupéré par
une relecture scoped, sans retenter l'écriture. La RPC conserve son CAS transactionnel
sur la révision active, même si elle change après la relecture serveur.

`resolveEffectiveMonthScenario()` retourne DIRECT_V2 sans Plan actif, avec les mêmes
inputs, intents et appel financier V2 ; il ne charge pas C1 dans cette branche.
Avec un Plan, il relit/recompile et vérifie les preuves. Les mêmes autorités donnent
EXACT et les mêmes manifest/projection ; un changement de sources donne
CHANGED_AUTHORITIES. Une preuve altérée ou une divergence à autorités identiques
est une erreur. Après Apply, le digest d'un **nouveau Preview** inclut la nouvelle
tête ; la parité porte sur les montants, le scénario, le manifest et la projection,
sans prétendre que le token de concurrence du parent est resté identique.

L'adapter de lecture de production réutilise `readPlanningMonthForecast`,
`readMonthInputs`, `readPlannedExpenses` et les sources C1. Il vérifie le foyer et la
cohérence des facts financiers C1/V2, hors métadonnées de construction. Le client
serveur Canonical de lecture et le client authentifié de la RPC sont distincts.
Le snapshot Baseline est stocké seulement comme preuve dans une PlanRevision C0 ;
aucune nouvelle persistence/autorité de Baseline n'est créée.

## TESTS_ADDED

Commande : `npm run check:phase2-planner-kernel`.

| Oracles | Résultat |
| --- | --- |
| PARITY-001 — Preview = Apply = Immediate Reload, montants/occurrences/épargne | PASS |
| PARITY-002 — computedAt/heure de construction seuls ne périment pas le Preview | PASS |
| PARITY-003 — changement de prix/preuve périme le Preview avant RPC | PASS |
| PARITY-004 — changement de révision active périme le Preview avant RPC | PASS |
| PARITY-005 — changement de fait MonthInputs périme le Preview avant RPC | PASS |
| BASE-001..007 — consommation occurrence, SET_STATE, montant optionnel, dépassement, UNKNOWN, immutabilité C1, réserve préservée | PASS |
| FIN-001 / 002 / 005 / 006 — owner financier, épargne sans consommation, external intent unique avec Plan actif, neutralisation legacy | PASS |
| C2-001..007 — 40 contrôles, Preview sans persistence, entrées sans rows, neutralisation unique, stale zéro writes, manifest déterministe, direct V2 | PASS |
| 17 groupes KERNEL supplémentaires | PASS |

Total : **40 groupes PASS**, dont les 23 oracles demandés. Les contrôles supplémentaires
couvrent retries, quatre relations, coûts inconnus, épargne protégée, normalisation,
capacité totale, changement de preuve seul, cutoff de prix, mapping ambigu, observations
déjà réalisées, relecture à sources changées, CAS après relecture, retry concurrent,
preuves altérées, composition des readers, frontière d'écriture et Baseline UNKNOWN.
Un montant explicite peut résoudre le coût du Plan, mais la comparaison à une
Baseline inconnue reste null : aucun zéro ou gain implicite n'est créé.

Le repository et la RPC sont testés ensemble dans PGlite, avec la migration C0 réelle
inchangée, des rôles/Auth/RLS synthétiques et huit tables canaris interdisant les
écritures historiques. Résultat : 1 Plan, 13 révisions ; 15 tentatives de RPC locales,
dont CAS/idem en conflit, sans écriture historique. Aucun Supabase local, réseau,
credential réel ni donnée bancaire personnelle n'est nécessaire à cette suite.

## REGRESSIONS

- Architecture imports : PASS, 807 fichiers.
- C0 contracts : 7 groupes PASS, API de lecture inchangée.
- C0 persistence : 9 groupes PASS, migration réelle en PGlite uniquement.
- C1 Baseline : 13 groupes PASS.
- Planned finance : PASS, avec bootstrap du loader partagé supportant TSX.
- Month control center V5 : 38/38 PASS, clé synthétique pour les mocks Undo.
- Forecast temporal modes : 13 contrôles PASS.
- TYPECHECK : PASS — `tsc --noEmit`.
- BUILD : PASS — build de production Next.js, TypeScript et génération de pages.

## Supabase et frontières

MIGRATION_REQUIRED = NO. La migration C0 déjà appliquée reste inchangée.
Aucune migration, réparation, réinitialisation, RPC distante ou test distant avec
écriture n'est lancé pour C2. Les modules purs n'accèdent pas aux tables ; seul le
repository Apply porte l'appel RPC. Les routes et React existants ne sont pas modifiés.
Pas de listes complètes de catégories, Context registry, Mobility/Renewals complets,
NightOut/ShortStay, Journey resolver, NeedOccurrence, assistant ou Composer.

## KNOWN_LIMITATIONS

- Certification du noyau sur fixtures génériques, pas certification live des domaines.
- Une référence financière absente/ambiguë, un coût inconnu ou une condition non résolue
  bloque Apply. Les slots déjà observés nécessitent une réconciliation de domaine et
  restent bloqués ici ; C2 ne déduit aucune occurrence historique.
- Les sous-totaux Needs/Habits/Life/Mobility et le point bas cash restent null ; la
  projection est PARTIAL. Le gross synthétique sans financement est exposé explicitement
  comme UNKNOWN funding ; aucun financement bancaire n'est inféré.
- Les quotes sont des faits injectés, pas un service de route/venue pricing. Le reader
  de production fournit un catalogue vide en C2 ; le prix MANUAL reste utilisable.
- PGlite teste des changements intercalés avant le CAS, pas une contention réseau entre
  connexions PostgreSQL indépendantes. Aucune RPC réelle n'est autorisée dans ce lot.
- Les lectures multi-owner ne sont pas une transaction globale. Le contrôle de fraîcheur
  précède le RPC et le CAS protège la tête du Plan ; le schéma C0 ne verrouille pas les
  tables financières sources pendant ce RPC. Le cutoff ne reconstruit pas une autorité
  bitemporelle absente des tables existantes.

## FOLLOW_UPS

C3 peut ajouter les adapters de domaines/controls à ce noyau. La certification live
et le branchement des routes/UI restent soumis aux lots et validations suivants.
Aucun lot suivant n'est commencé.

```ini
C2_KERNEL_CERTIFIED = YES
```
