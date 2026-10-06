# C5 — MobilityIntent, Journey Resolver et tarifage prospectif

| Champ | Résultat |
| --- | --- |
| HEAD_BEFORE | `78f2479fda64884dfabc0993d35eaff3087f91b6` |
| HEAD_AFTER | Commit contenant ce rapport : `git log -1 --format=%H -- docs/status/planner-c5-mobility-2026-10-06.md` |
| BRANCH | `main` |
| MIGRATION_REQUIRED | NO |
| ZERO_HISTORICAL_WRITE | YES |
| C5_MOBILITY_READY | YES — 37 groupes, dont les 11 oracles obligatoires |

## SCOPE_DONE

Le pipeline serveur relie les MobilityIntents acceptés de C4 à des JourneyDependencies,
puis à des PhysicalJourneyRequirements uniques. Le tarifage prépare des autorités
en mémoire ; le compiler reste synchrone et déterministe. Les components de transport
rejoignent l'adapter financier existant et `deriveMonthScenario()` calcule le scénario.

Les domaines family-visit, friend-visit, activity, purchase/shopping, night-out,
short-stay et home-project disposent de leurs sockets C4. La mobilité n'entre dans
le scénario que lorsqu'une sélection est acceptée. Les suggestions personnelles
restent exclues. NightOut publie aussi un endDate optionnel pour un retour après
minuit ; aucun total monolithique de soirée ou de séjour n'est ajouté.

### Identité et relations

L'identité d'un trajet vient du scope logique du Plan — householdId + targetMonth —
et du MobilityIntent propriétaire, lui-même issu du contextOccurrenceId et du socket.
Ce scope existe avant que C0 crée le premier PlanId durable. L'ancien helper C0
`physicalJourneyRequirementId(planId, contextId, slot)` reste compatible. Le nouvel
helper prospectif conserve l'identité entre Preview, Apply et Reload, et pendant
un changement d'adresse, de géométrie ou de prix.

Le résolveur prend en charge OWNS_JOURNEY, SHARES_JOURNEY, ADDS_STOP,
USES_ACCESS_LEG et NO_ADDITIONAL_MOBILITY. Un partage CERTAIN désigne un autre
MobilityIntent ou une dépense externe précise. POSSIBLE conserve deux exigences
et une projection inconnue tant que choice=MERGE/SEPARATE n'est pas déclaré.
SIMILAR_ONLY reste indépendant. Ni la proximité, ni le même lieu, ni le même jour,
ni le hash de route ne créent une identité commune.

ADDS_STOP insère une destination dans la chaîne existante, sans ajouter un
aller-retour domicile. stopIndex désigne une position dans la chaîne du propriétaire
avant insertions ; deux ajouts à la même position sont refusés comme ambigus.
USES_ACCESS_LEG désigne une paire adjacente exacte dans la chaîne finale. Les
segments de retour utilisent leur date de retour. Les cycles, cibles absentes,
modes incompatibles, dates contradictoires, retours non couverts et prix concurrents
sur un trajet partagé sont refusés avant une écriture.

### Propriétaires réutilisés

`mobility-adapter.ts` transforme les MobilityLegFacts Canonical admis par C1 en
historique dirigé par véhicule. Les faits partiels, les endpoints non résolus et
les dates après knowledgeCutoff sont exclus. Le world-reader conserve l'autorité
Personal Mobility de C1 ; son contexte distingue le travail structurel, les usages
contextuels et les réserves non résolues. Sa méthode et son outputHash accompagnent
les preuves de tarifage. Aucun rollup personnel ALL_PERSONAL ne devient un coût
incrémental ou une nouvelle enveloppe.

Les lieux autorisés et le véhicule viennent de `readPlannedContextOptions()`.
Les lieux KNOWN doivent appartenir à ce catalogue, également pour taxi/train/bus.
La préparation appelle `estimatePlannedCar()` une fois par exigence physique unique
et par évaluation. Ce service conserve ses propriétaires TomTom, HERE et prix SP95,
ses variantes, son modèle Peugeot 207, son fallback historique dirigé et ses
calculs indépendants d'aller/retour. `stopForPlace()` fournit les étapes et leur
ancrage ROOT_PLACE. Le résolveur ne recalcule aucun kilomètre, litre ou péage.

Les dates d'observation restent dans les preuves. Les horloges opérationnelles
calculatedAt sont retirées récursivement dans un type dédié d'evidence de manifeste,
qui n'est pas un liveEstimate à réinjecter dans un autre service. Une observation
de prix après le cutoff est écartée. Les références de tarifage sont liées au digest
de l'exigence et de ses autorités ; une route modifiée ne peut réutiliser une
ancienne référence en mémoire. Le cache des providers existants reste propriétaire
de ses TTL et de la mutualisation réseau.

Un prix, une direction, un segment historique dirigé ou un péage manquant conserve
UNKNOWN/PARTIAL. Les dates exigées par le propriétaire aller-retour restent exigées :
un retour non daté garde l'intention et une projection inconnue. Les modes payants
train/bus/taxi/other acceptent un montant déclaré ou une quote serveur, avec une
direction explicite ; un paiement Uber ne fournit jamais une direction.

### Effet économique et dépenses externes

L'adapter transmet `transport:fuel_usage` et ses fundingAllocations vides. Le
catalogue partagé et le moteur V2 lui appliquent ECONOMIC_ONLY. Péages, parking
et fares restent payables. Exemple certifié : usage carburant 2 € + parking 3 €
produit un impact économique de 5 € et une réservation BANK de 3 €.
Le coût carburant ne publie plus de diagnostic de financement manquant.

La projection sépare usage économique, frais de transport payables, nombre de
trajets et trajets non résolus. Les components ordinaires de vie restent dans
explicitContexts. Le work commute et les réserves C1 sont conservés ; aucune
capability de réduction du travail n'est publiée. Le scénario s'appuie sur la
référence de travail du propriétaire financier, sans additionner le rollup
historique global à tous les Contexts prospectifs.

Pour partager le transport d'une PlannedExpense, la décision désigne son UUID
et l'ensemble exact de ses lignes de transport. Le propriétaire externe garde ces
lignes dans une seule entrée financière. Aucun second tarifage ou component de
transport Planner n'est créé ; les autres lignes de la dépense restent présentes.
Une preuve incomplète ou une dépense d'un autre scope est refusée. Un péage absent
reste inconnu sans preuve de montant ou de gratuité. ADDS_STOP sur un propriétaire
externe exige encore une modification explicite dans son flux existant : C5 refuse
ce cas plutôt que modifier silencieusement la dépense externe.

### Preview / Apply / Reload

La préparation est partagée par `previewPlanScenario()` et
`resolveEffectiveMonthScenario()`. Apply relit les autorités, prépare les prix et
recompile avant de comparer la preview. Un prix changé produit
PLANNER_PREVIEW_STALE avec zéro RPC. Les états valides sont appliqués par la seule
RPC C0 puis relus avec manifestDigest, projection et scénario identiques lorsque
les autorités restent les mêmes. Sans Plan actif, DIRECT_V2 reste inchangé.

## VALIDATION

| Suite | Résultat |
| --- | --- |
| `check-phase2-planner-mobility.mjs` | 37 groupes PASS : MOB-001..005, C5-006..011 et 26 groupes complémentaires |
| C0 contracts / persistence | 7 + 9 PASS, SQL réel exécuté uniquement dans PGlite synthétique |
| C1 Baseline | 13 PASS |
| C2 kernel | 40 PASS |
| C3 simple levers | 30 PASS |
| C4 contexts | 29 PASS ; attentes de sockets mises à jour pour le résolveur C5 |
| Canonical Mobility | 68/68 PASS, corpus certifié de 684 lignes, writes=0 |
| Personal Mobility / context / trips / trip contexts / monthly narrative / car rhythm | PASS |
| Planned Car / Planned Routes / Planned Finance | PASS, providers simulés et flux V2 de prix/finance conservés |
| V2 category targets / savings / month decisions / month decision engine | PASS ; category targets 36 contrôles, savings 21 |
| Architecture | PASS — 821 fichiers |
| TypeScript | PASS — `tsc --noEmit` |
| Build Next.js | PASS — compilation 22,2 s, TypeScript 37,2 s, 8 pages statiques |

Les fixtures C5 couvrent les sept domaines, les cinq relations, les trois niveaux
de certainty, les prix et péages manquants, le fallback historique non symétrisé,
les dates indépendantes, la soirée après minuit, la validation des lieux,
l'orchestration du world-reader, les suggestions exclues, la référence de travail,
les autorités après cutoff, le refus stale et la parité PostgreSQL.
Les huit canaries d'écriture historique de PGlite restent intacts.

Le check Canonical a d'abord signalé l'absence de MOBILITY_SOURCE_XLSX ; il a été
rejoué avec le corpus local dont SHA256 correspond exactement à l'empreinte exigée
par le check. Aucune donnée du corpus n'est copiée dans le dépôt ou le rapport.

## PÉRIMÈTRE DE LIVRAISON

Aucune migration, réinitialisation, écriture Supabase distante ou RPC réelle.
Aucun appel réel aux providers de transport durant les tests. Aucun writer de
MonthInputs, PlannedExpense, Canonical Mobility ou historique ajouté.
Aucun UI, assistant d'équilibrage ou lot C6 lancé. Aucun déploiement manuel.

```ini
C5_MOBILITY_READY = YES
```
