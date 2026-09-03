# Analyse Globale V2 — audit préparatoire Runtime / Publication / Query / Performance

> **Nature du document** : audit préparatoire en lecture seule.
>
> **Aucune implémentation Global. Aucune migration. Aucun changement de comportement applicatif. Aucune écriture Supabase.**
>
> **Seul ce document d’audit est ajouté au repository.**
>
> **Baseline repository distante observée** : branche `main`, commit `c4d242e3edd1ad310b303d68017aaf59c415e665` (`docs(global-v2): add authority dependency preaudit`).
>
> **État History pris en compte** : HC1 communiqué `PASS` par l’utilisateur ; HC2 → HC6 non fermés. Les conclusions qui dépendent du manifest durable, de l’immutabilité, de la correction/republication ou du cache doivent donc être revalidées après `POST_HISTORY_ENTRY_GATE = PASS`.
>
> **Autorité normative** : Master Analyse Globale V2 et registres associés. Le code courant et Supabase décrivent l’EXISTANT, jamais une doctrine concurrente.

---

# 0. Verdict exécutif

L’infrastructure actuelle contient déjà une base très solide pour accueillir une publication Global V2, mais **elle n’est pas prête à être réutilisée telle quelle**.

Le constat principal est :

```text
Fondations génériques déjà fortes
→ tables de matérialisation
→ génération inactive / activation atomique
→ revisions
→ Query API
→ RuntimeSchemas
→ identités déterministes
→ invalidation ciblée
→ validation des payloads

MAIS

profil Global V2 final absent
→ aucun contrat Global V2 non-legacy
→ aucun manifest Global durable
→ aucun builder de publication Global
→ aucun snapshot Global live
→ scope Global actuel trop simplificateur
→ rollback uniquement History-specific
→ runtime Global actuel encore read-through/dynamique
```

La cible recommandée pour Global V2 est donc :

```text
Canonical / Facts / Analytics
        ↓
Artifacts Global certifiés
        ↓
ReadModels Global validés
        ↓
DRAFT Global fermée par manifest
        ↓
certification
        ↓
activation atomique
        ↓
Query snapshot
        ↓
RuntimeSchema
        ↓
React
```

et **pas** :

```text
navigation
→ calcul des 10 modules
→ agrégation dynamique
→ React
```

Le Master demande une page Global cohérente, des métriques multi-grains et une publication qui ne hot-swap pas silencieusement au milieu d’une lecture. La bonne unité produit est donc une **génération Global cohérente par Household × as-of**, même si ses moteurs internes sont construits et recertifiés par phase/module.

L’infrastructure physique `analytics_publications` supporte déjà `scope_kind = global` et `as_of_month`, mais le code de staging est encore centré sur les publications mensuelles et aucune publication Global n’existe dans le live observé.

Le live confirme :

```text
dataRevision = 1
analyticsRevision = 67
published month publications = 64
published global publications = 0
analysis_global_* query snapshots = 0
```

Il n’existe donc aujourd’hui **aucune preuve live** que le profil de publication Global fonctionne réellement de bout en bout.

Verdict par grandes primitives :

| Primitive | Verdict préparatoire |
|---|---|
| `analytics_artifacts` | `REUSE_READY` comme stockage générique, familles Global à définir |
| `analytics_query_snapshots` | `REUSE_READY` comme stockage générique, profil Global à construire |
| `analytics_publications` | `ADAPT_REQUIRED` |
| `SupabaseAnalyticsMaterializationStore` | `ADAPT_REQUIRED` |
| RuntimeSchemas | `REUSE_READY` comme mécanisme ; schémas Global V2 nouveaux |
| Query API générique | `REUSE_READY` |
| ressources `analysis_global_*` actuelles | `GLOBAL_EXISTING` mais `legacy_v1`, pas autorité cible |
| Revision model | `REUSE_READY` avec extensions de lineage Global |
| `factsHash` / closure | `ADAPT_REQUIRED`, revalidation HC3 |
| manifest durable | `ADAPT_REQUIRED`, revalidation HC3 |
| finalizer atomique | `REUSE_READY` conceptuellement, profil Global à certifier |
| rollback | `HISTORY_SPECIFIC`, Global/générique à prévoir |
| single-active generation | `ADAPT_REQUIRED`, revalidation HC4 |
| invalidation | `ADAPT_REQUIRED` à partir de la vraie dependency matrix |
| performance architecture | `REUSE_READY` comme base, budgets Global inexistants |

```text
GLOBAL RUNTIME FOUNDATION
ADAPT_REQUIRED
```

Ce verdict signifie : **Global n’a pas besoin d’une nouvelle infrastructure de matérialisation depuis zéro ; il doit adapter et généraliser proprement le socle existant, sans reprendre les contrats Global legacy comme produit final.**

---

# 1. Sources inspectées

## 1.1 Gouvernance

- `AGENTS.md` ;
- Master Analyse Globale V2 ;
- registres Global préparatoires ;
- `docs/global-v2/prep-audits/01-global-master-capability-map.md` ;
- `docs/global-v2/prep-audits/02-history-global-boundary-audit.md` ;
- `docs/global-v2/prep-audits/03-global-authority-dependency-preaudit.md`.

Rappels de gouvernance applicables :

- Brief V2 = autorité produit/Analytics/UX/architecture ;
- Supabase V2 = autorité schema/data/Canonical ;
- React ne calcule pas la doctrine métier/statistique ;
- une doctrine possède un seul endroit faisant autorité ;
- ne pas réintroduire V1 ;
- conflit Brief ↔ Supabase = hard stop humain.

## 1.2 Infrastructure Runtime inspectée

- `docs/specs/ANALYTICS_MATERIALIZATION.md` ;
- `src/server/analytics/materialization/store.ts` ;
- `src/server/analytics/materialization/identity.ts` ;
- `src/server/analytics/materialization/global-planner.ts` ;
- `src/query-api/server/execute-query.ts` ;
- `src/server/query/runtime.ts` ;
- `src/query-api/request/resource-contract.ts` ;
- `src/query-api/server/invalidation.ts` ;
- `src/analytics/publication/**` ;
- RuntimeSchemas des ressources Global legacy ;
- types ReadModels Global legacy ;
- route Global actuelle.

## 1.3 Migrations inspectées

- `20260825105100_analytics_materialization.sql` ;
- `20260902105811_enforce_single_active_analytics_generation.sql` ;
- `20260831150000_history_v2_publication_rollback.sql`.

## 1.4 Supabase live

Lectures `SELECT` uniquement sur le projet V2 afin de vérifier :

- schema physique des tables Analytics ;
- volumes de snapshots/artifacts ;
- publications Global existantes ou non ;
- poids de payloads existants.

Aucune mutation n’a été réalisée.

---

# 2. Règle cible fondamentale : Global doit être publié, pas découvert à la navigation

Le Master impose plusieurs propriétés qui convergent vers la même conclusion :

1. les Analytics sont déterministes ;
2. chaque module possède son grain naturel ;
3. les conclusions structurelles s’appuient sur `CERTIFIED_HISTORY` ;
4. une page Global doit rester cohérente pendant sa lecture ;
5. une publication plus récente peut être annoncée mais pas hot-swappée silencieusement ;
6. React ne reconstruit aucune doctrine ;
7. navigation ≠ mécanisme de calcul.

La cible Runtime doit donc ressembler à :

```text
mutation Canonical
→ nouvelles revisions
→ planner / dependency graph
→ moteurs Global
→ artifacts
→ ReadModels
→ RuntimeSchemas
→ certification
→ publication atomique
→ navigation
→ lecture de snapshots seulement
```

Il peut exister des calculs de préparation hors navigation, mais les moteurs lourds Global ne doivent pas être déclenchés parce qu’un utilisateur ouvre ou scroll la page.

Cette cible est plus proche du Runtime History V2 final que du Runtime Global legacy actuel.

---

# 3. Inventaire et classification des primitives actuelles

## 3.1 `analytics_artifacts`

### Existant

La table est générique et porte déjà :

- `artifact_key` ;
- `generation_key` ;
- Household ;
- subject Household/person ;
- période `month/global` ;
- `period_month/as_of_month` ;
- `artifact_family` ;
- `metric_id` ;
- dimension/bucket ;
- `scope_hash` ;
- `filter_signature` ;
- `method_version` ;
- `contract_version` ;
- revisions ;
- payload JSONB ;
- `publication_id` ;
- active/invalidation.

Le schema est donc déjà beaucoup plus générique que History.

### Global cible

Global aura besoin de familles qui ne sont pas toutes de simples `ProducedMetric` :

- Trend/Stability ;
- ChangePoint/Transformation ;
- relations statistiques ;
- Moment comparative statistics ;
- Place importance/lifecycle ;
- routine/cycles ;
- Persona comparison ;
- shared participation ;
- éventuellement matrices ou evidence bundles.

### Verdict

`GENERIC_REUSABLE / REUSE_READY` pour la table physique.

Mais les nouvelles familles d’artifacts et leur identité doivent être explicitement versionnées ; ne pas tout forcer dans `metric_id` si l’objet n’est pas une métrique atomique.

---

## 3.2 `analytics_query_snapshots`

### Existant

La table possède déjà une identité adaptée à un cache produit :

- Query logique ;
- génération ;
- ressource ;
- scope ;
- params normalisés ;
- subject ;
- month/global ;
- source/analytics revision ;
- contract version ;
- method signature ;
- payload ;
- expiration ;
- publication ;
- activation/invalidation.

Le reader actuel exige pour une lecture matérialisée :

```text
is_active = true
invalidated_at IS NULL
publication_id IS NOT NULL
publication.status = published
signature compatible
contract compatible
freshness compatible
```

et refuse l’ambiguïté si plusieurs snapshots actifs correspondent à la même Query logique.

### Global cible

La structure physique est adaptée à des ReadModels Global préconstruits.

### Verdict

`GENERIC_REUSABLE / REUSE_READY` comme stockage.

Les contrats Query Global V2 et le profil de publication restent à construire.

---

## 3.3 `analytics_publications`

### Existant

Le schema supporte déjà :

```text
scope_kind = month | global
period_month pour month
as_of_month pour global
source_revision
base_analytics_revision
published_analytics_revision
required_artifact_keys[]
required_query_keys[]
status draft/published/failed
```

La migration d’origine avait donc anticipé le scope Global.

### Point positif

Le RPC `publish_analytics_materialization()` possède déjà une branche Global : pour une publication `scope_kind = global`, il traite les changements `global_reference` plutôt que de mettre à jour un `analysis_period` mensuel.

### Limite

Le schema actuel ne suffit pas encore à représenter le manifest cible Global :

- closure physique des dépendances ;
- versions de policies/methods par outputs ;
- liens aux publications History certifiées réellement utilisées ;
- `CERTIFIED_HISTORY` vs `LIVE_TAIL` ;
- supports/couvertures par famille ;
- modules/data gates résolus ;
- external references ;
- digest/manifest durable.

HC3 doit déjà renforcer ce domaine pour History. Global doit réutiliser ce résultat s’il devient générique, pas recréer un second système.

### Verdict

`NEEDS_ADAPTATION`.

**REVALIDATE_AFTER_HC6 = YES.**

---

## 3.4 `SupabaseAnalyticsMaterializationStore`

### Parties génériques déjà fortes

- `readMetric()` ;
- `writeMetric()` ;
- `writeMetricBucket()` ;
- `readMonthlyMetrics()` ;
- `readGlobalAdditiveMetric()` ;
- `readQuery()` ;
- `writeQuery()` ;
- freshness ;
- cachePolicy ;
- publication-linked reads.

### Partie Global déjà existante

`readGlobalAdditiveMetric()` sait reconstruire une métrique Global depuis des métriques mensuelles **uniquement** lorsque le Metric Registry déclare strictement l’additivité et que les enveloppes conservent :

- disponibilité ;
- coverage ;
- support ;
- provenance ;
- unité ;
- MethodVersion.

C’est une très bonne règle de sécurité à conserver.

### Limites

Le store expose :

```text
beginMonthPublicationProfile()
beginMonthPublication()
publishPrepared()
restoreHistoryV2Publication()
```

mais aucun équivalent explicite :

```text
beginGlobalPublicationProfile()
```

Le `publishPrepared()` loggue encore un `scopeKind: month`, même si le RPC SQL est plus générique.

Le rollback exposé est explicitement `restoreHistoryV2Publication()`.

### Verdict

`GENERIC_REUSABLE` pour lecture/écriture de base.

`NEEDS_ADAPTATION` pour orchestration Global.

---

## 3.5 RuntimeSchemas

### Existant

Les ressources Global legacy possèdent déjà des parsers et des RuntimeSchemas.

C’est utile comme preuve que la mécanique :

```text
payload inconnu
→ parser strict
→ RuntimeSchema
→ ApiResponseSchema
```

est mature.

### Limite

Les ReadModels actuels sont `legacy_v1` et structurés autour d’une `observationWindow` universelle.

Ils ne sont pas les schémas du Master Global V2.

### Verdict

Mécanisme : `REUSE_READY`.

Schémas Global actuels : `GLOBAL_EXISTING / MUST_NOT_BE_TREATED_AS_TARGET`.

Nouveaux schémas V2 : nécessaires en Phase H, dérivés des Analytics certifiés A→G.

---

## 3.6 Query API

### Existant

Le Query Runtime possède déjà :

1. parsing scope ;
2. autorisation ;
3. applicability/capabilities ;
4. coherence de revision ;
5. tentative de snapshot ;
6. validation stricte ;
7. adapter ;
8. réponse ApiResponse ;
9. telemetry safe.

### Point important

Pour `family = history_v2`, un snapshot manquant provoque `TEMPORARY_UNAVAILABLE` : aucune reconstruction produit au runtime.

Pour les ressources legacy, un MISS peut encore exécuter l’adapter et calculer dynamiquement.

### Global V2

Le nouveau contrat Global V2 devra choisir explicitement la doctrine Runtime.

Compte tenu du Master, l’option cohérente est :

```text
GLOBAL_V2 published resource
MISS/STALE
→ fail closed / unavailable
→ jamais calcul analytique lourd à la navigation
```

La mécanique générique de Query peut être conservée, mais la famille de contrat doit évoluer.

### Verdict

Query engine : `REUSE_READY`.

Global contract/runtime policy : `ADAPT_REQUIRED`.

---

## 3.7 Revision model

### Existant

Le système distingue :

- `dataRevision` ;
- `analyticsRevision` ;
- source revision par artifact/snapshot ;
- `analysis_periods.source_revision` pour History ;
- `analytics_change_log` ;
- invalidation revision.

Pour un scope Global actuel, `materializationPeriod()` utilise :

```text
period.kind = global
asOf
sourceRevision = current dataRevision
```

### Global cible

Cette règle est utile pour la freshness générale, mais elle n’exprime pas à elle seule :

- `certifiedThrough` ;
- `liveThrough` ;
- corpus réellement utilisés par chaque moteur ;
- source publications History ;
- granularité différente par module.

### Verdict

`GENERIC_REUSABLE / REUSE_READY` pour les revisions de base.

`NEEDS_ADAPTATION` pour lineage et corpus Global.

---

## 3.8 `factsHash`

### Existant

History V2 porte dans `PublicationMeta` :

```text
publicationId
revision
contractVersion
factsHash
policyVersions
generatedAt
```

Le type `FactsHash` est actuellement situé dans `core/history-v2`.

### Limite physique

`analytics_publications` ne porte pas encore directement `factsHash` ni manifest détaillé dans le schema live observé.

### Global cible

Global a besoin d’un digest représentant la closure réelle de ce qui a été certifié, pas seulement d’un hash d’un mois.

Une publication Global peut dépendre de :

- plusieurs mois History ;
- plusieurs Facts families ;
- moteurs/statistiques Global ;
- entités ;
- supports et exclusions ;
- policies/methods.

### Verdict

`NEEDS_ADAPTATION`.

**REVALIDATE_AFTER_HC3/HC6 = YES.**

---

## 3.9 Manifest

### Existant

La publication SQL conserve seulement les listes physiques requises :

```text
required_artifact_keys[]
required_query_keys[]
```

History preflight sait déjà calculer des informations plus riches, mais le rapport maître History a identifié l’absence de persistence durable complète.

HC3 est précisément destiné à corriger ce point.

### Global cible

Un manifest Global doit pouvoir répondre après publication :

```text
Qu’est-ce qui a été publié ?
Sur quelles Facts / metrics / methods ?
Quels modules sont KNOWN/PARTIAL/UNAVAILABLE ?
Quels supports ?
Quelle coverage ?
Quelles publications History ont servi ?
Quels outputs ont été recertifiés après E/F ?
Quel as-of ?
Quels corpus réels ?
```

### Verdict

`NEEDS_ADAPTATION`.

Ne pas concevoir un second manifest Global avant de voir le résultat HC3.

---

## 3.10 Rollback

### Existant

La primitive live est :

```text
restore_history_v2_publication(...)
```

Elle impose explicitement :

- `scope_kind = month` ;
- `period_month` ;
- contract `v2` History ;
- publication target History complète.

### Global cible

Le besoin conceptuel existe aussi : pouvoir revenir à une génération Global précédente complète sans réécrire les payloads.

### Verdict

Primitive actuelle : `HISTORY_SPECIFIC`.

Pattern : `GENERIC_REUSABLE`.

Global aura besoin soit d’une primitive générique correctement sécurisée, soit d’un rollback Global dédié.

Décision physique reportée à GA0.

---

## 3.11 Single-active generation

### Existant

Le finalizer amélioré désactive l’ancienne génération selon une identité logique complète avant d’activer la nouvelle.

Le reader refuse plusieurs snapshots actifs compatibles.

Le rapport History avait toutefois classé comme hardening futur l’absence de contrainte physique unique partielle garantissant absolument le single-active en dehors du workflow autorisé.

HC4 doit encore durcir l’immutabilité et la republication.

### Global cible

Une page Global ne doit jamais mélanger :

```text
M1 génération A
M2 génération B
M5 génération A
M9 génération C
```

### Verdict

Pattern : bon.

Garantie finale : `ADAPT_REQUIRED / REVALIDATE_AFTER_HC4-HC6`.

---

# 4. État du Global existant

Le repo contient déjà :

```text
analysis_global_initial
analysis_global_baseline
analysis_global_typical
analysis_global_breakdown
analysis_global_evolution
analysis_global_contexts
analysis_global_habits
analysis_global_profiles
analysis_global_universe
```

ainsi que :

- ReadModels ;
- RuntimeSchemas ;
- adapters ;
- Query sources ;
- route `/historique/analyse/global` ;
- UI associée.

Mais le registre de contrat les classe tous :

```text
family = legacy_v1
```

Ils ne sont donc pas la cible Global V2.

Leurs principales limitations structurelles sont :

1. une `observationWindow` unique ;
2. modules du Master absents ;
3. pas de publication Global fermée ;
4. pas de dependency matrix Global V2 ;
5. pas de manifest Global ;
6. plusieurs calculs faits à la Query source ;
7. pas de séparation complète `CERTIFIED_HISTORY / LIVE_TAIL` ;
8. pas de politique Global V2 snapshot-only.

Classification :

```text
GLOBAL_EXISTING
NOT_TARGET_AUTHORITY
```

Le futur GA0 devra décider pièce par pièce `REUSE / ADAPT / REMOVE_LEGACY`.

---

# 5. Observation live : aucune publication Global aujourd’hui

## 5.1 Revisions

Live observé :

```text
dataRevision = 1
analyticsRevision = 67
```

## 5.2 Publications

`analytics_publications` contient :

```text
month / published = 64
month / failed = 3
global / published = 0
```

Les 64 publications mensuelles incluent les anciennes générations conservées ; cela ne signifie pas 64 mois actifs.

## 5.3 Query snapshots

Live :

```text
analytics_query_snapshots total = 5592
active = 2464
total JSONB payload ≈ 92 632.7 KB
active JSONB payload ≈ 26 446.2 KB
max active payload = 101 034 bytes
```

Tous les rows observés ont :

```text
period_kind = month
```

et :

```text
analysis_global_* rows = 0
active analysis_global_* rows = 0
published-linked analysis_global_* rows = 0
```

## 5.4 Artifacts

Les artifact families observées sont également toutes `month` :

- `metric` ;
- `metric_bucket` ;
- `calendar_semantic_month` ;
- `daily_economic_ledger_month`.

Aucun artifact Global live n’a été observé.

## Conclusion live

Le schema sait représenter Global, mais **le chemin Global publication → snapshots → lecture n’a pas encore de preuve live**.

Cela justifie un vrai lot de certification Global Runtime avant Phase H finale.

---

# 6. Grain conceptuel de publication Global

## 6.1 Unité produit recommandée

La page cible doit présenter M1 → M10 + social de manière cohérente.

La bonne identité conceptuelle est :

```text
Household
× asOf
× Global contract generation
```

Le `asOf` est un point de cohérence/publication, pas une fenêtre universelle d’analyse.

Chaque moteur interne conserve sa propre période réellement utilisée.

Exemple :

```text
Global publication asOf = 2026-07

M1 Trend
uses 2025-08 → 2026-07

M4 Activity routines
uses corpus activity réellement certifié

M6 Moment comparisons
uses uniquement Moment series comparables

M8 Products
peut être unavailable faute d’autorité

M9 Persona
uses intersection person-scoped compatible
```

Ils appartiennent néanmoins à la même génération produit Global.

---

## 6.2 `asOf` ≠ universal observation window

Le scope legacy contient :

```text
kind = global
observationWindow
asOf
```

Le Master interdit d’interpréter `observationWindow` comme période universelle de tous les modules.

La cible doit donc séparer :

```text
publicationAsOf
```

et, dans chaque Analytics output :

```text
actual observation range
support
coverage
certifiedThrough
liveThrough si pertinent
excluded/gap information
```

La forme physique du futur scope n’est pas décidée dans cet audit.

---

## 6.3 Publication complète ou partielle ?

La publication produit Global doit être **complète relativement au contrat**, pas complète relativement à toutes les données imaginables.

Exemple : M8 produit peut être `AUTHORITY_GATED` et publier proprement :

```text
availability = UNKNOWN / unavailable_by_authority
```

Cela ne justifie pas une page Global partiellement activée où certains modules proviennent de l’ancienne génération et d’autres de la nouvelle.

Principe recommandé :

```text
DRAFT Global
→ manifest fermé
→ tous les top-level contractuels présents
→ unavailable explicite autorisé
→ certification cohérente
→ atomic switch
```

Les détails conditionnels peuvent être absents si leur état/absence est lui-même contracté dans le top-level et le manifest.

---

## 6.4 Modules indépendants vs manifest fermé

Les moteurs peuvent être construits séparément :

```text
A
B
C
D
E
F
G
```

et certaines phases peuvent recertifier des sorties antérieures.

Mais au moment de publication utilisateur :

```text
manifest unique cohérent
```

Le manifest doit éviter le mélange de générations.

---

## 6.5 Dépendance à History publié

Global ne doit pas lire les ReadModels History comme vérité.

En revanche, pour les conclusions fondées sur `CERTIFIED_HISTORY`, la génération Global doit pouvoir tracer les générations History réellement certifiées utilisées.

Conceptuellement :

```text
Global publication G42
→ source History publications H-Aug ... H-Jul
→ Facts/methods/policies concernés
→ Global artifacts
```

Le lien physique exact sera décidé après HC3/GA0.

---

# 7. Snapshot strategy par phase/module

L’objectif n’est pas de snapshotter chaque variable intermédiaire. Il faut distinguer :

```text
ARTIFACT
TOP_LEVEL_READMODEL
DETAIL_READMODEL
RELATION_READMODEL
ENTITY_DETAIL
NON_PERSISTED_INTERMEDIATE
```

---

## 7.1 Phase A — Foundations

### À persister probablement comme artifacts/metadata

- support decisions ;
- coverage ;
- corpus identity ;
- provenance ;
- method/policy versions ;
- materiality decisions si réutilisées ;
- fenêtres certifiées ;
- eligibility masks.

### À ne pas créer comme Query utilisateur autonome sans besoin

Les helpers purement intermédiaires de normalisation et filtres.

### Classification

```text
ARTIFACT
NON_PERSISTED_INTERMEDIATE
```

---

## 7.2 M1 — Fonctionnement économique

### Artifacts

- Actual structural series ;
- Typical/Minimal references ;
- Trend ;
- Stability/volatility ;
- recent change ;
- structural recurrence ;
- contributors.

### Top-level

Résumé M1 : coûts, gaps, structure, trend/stability principales.

### Details lazy

- evolution series ;
- recurrence detail ;
- contributor decomposition ;
- methodology/evidence.

### Classification

```text
ARTIFACT
TOP_LEVEL_READMODEL
DETAIL_READMODEL
```

---

## 7.3 M2 — Catégories & Needs

### Artifacts

Agrégations, shares, Typical par dimension, contributors.

### Top-level

Catégories/Needs structurants + évolution synthétique.

### Details

Une catégorie/Need sélectionné, séries, contributors, dimensions croisées.

### Attention performance

Ne pas embarquer toutes les catégories × tous les mois × tous les drivers dans le top-level.

### Classification

```text
ARTIFACT
TOP_LEVEL_READMODEL
DETAIL_READMODEL
ENTITY_DETAIL
```

---

## 7.4 M3 — Chapitres & transformations

### Artifacts

- candidate signals ;
- change points ;
- before/after windows ;
- persistence ;
- multi-domain evidence ;
- classification durable/temporaire/current regime.

### Top-level

Liste courte des transformations certifiées et current regime.

### Detail

Transformation sélectionnée : evidence, before/after, timeline, links.

### Classification

```text
ARTIFACT
TOP_LEVEL_READMODEL
DETAIL_READMODEL
```

---

## 7.5 M4 — Rythmes & routines

### Artifacts

- activity frequency series ;
- day/week patterns ;
- seasonality/routine signals ;
- cycles ;
- context-conditioned routines.

### Top-level

Routines et rythmes réellement certifiés.

### Details

Activity/routine/cycle selection.

### Classification

```text
ARTIFACT
TOP_LEVEL_READMODEL
DETAIL_READMODEL
```

---

## 7.6 M5 — Relations Vie ↔ Argent

### Artifacts

Le RelationshipEngine peut produire des relations certifiées avec :

- relation identity ;
- support ;
- effect/direction ;
- robustness ;
- evidence ;
- quality state.

### Important

Ne pas matérialiser aveuglément toutes les paires possibles.

Une matrice naïve N×N provoquerait une explosion combinatoire.

### Top-level

Relations les plus importantes/publishables + état méthodologique.

### Relation detail

Une relation sélectionnée avec evidence.

### Classification

```text
ARTIFACT
TOP_LEVEL_READMODEL
RELATION_READMODEL
```

---

## 7.7 M6 — Moments

### Artifacts

- Moment Family/Type/Series ;
- comparable peers ;
- causal cost ;
- robust comparative statistics ;
- preparation/core/after-effect roles ;
- support.

### Top-level

Moments marquants et enseignements comparables.

### Entity detail

Moment ou série sélectionnée.

### Classification

```text
ARTIFACT
TOP_LEVEL_READMODEL
ENTITY_DETAIL
```

---

## 7.8 M7 — Géographie

### Artifacts

- visits ;
- localized spend ;
- importance ;
- routine/lifecycle ;
- mobility estimates seulement si authority disponible.

### Top-level

Places structurantes et enseignements géographiques.

### Entity detail

Place sélectionnée.

### Attention

Visite, transaction localisée et mobilité restent trois choses différentes.

### Classification

```text
ARTIFACT
TOP_LEVEL_READMODEL
ENTITY_DETAIL
```

---

## 7.9 M8 — Consommation

### Artifacts

- PurchaseEvent analytics ;
- merchants ;
- purchase frequency ;
- ticket distributions ;
- cycles ;
- produits/prix seulement si authority réelle.

### Top-level

Habitudes de consommation supportées.

### Details

Merchant / purchase family / produit autoritaire.

### Benefit Wallet future

Le snapshot ne doit jamais supposer :

```text
purchase = bank transaction
```

Le modèle doit rester extensible au financement multi-source.

### Classification

```text
ARTIFACT
TOP_LEVEL_READMODEL
ENTITY_DETAIL
```

---

## 7.10 M9 — Persona

### Artifacts

- person-scoped metrics ;
- comparable support ;
- difference engine ;
- person-specific patterns.

### Top-level

Profil par personne + différences réellement supportées.

### Detail

Persona / dimension / evidence.

### Attention

Ne pas recopier les mêmes grosses séries dans chaque Persona si un artifact partagé peut être référencé/recomposé côté serveur avant snapshot.

### Classification

```text
ARTIFACT
TOP_LEVEL_READMODEL
DETAIL_READMODEL
```

---

## 7.11 M10 — Nous deux / Social

### Artifacts

- shared participation ;
- co-presence qualifiée ;
- shared Moment/activity/place ;
- shared economic links si preuve ;
- social uniquement si authority Contact/Relation disponible.

### Top-level

Synthèse couple/shared life.

### Relation/entity details

Occurence/Activity/Moment/Place partagé sélectionné.

### Classification

```text
ARTIFACT
TOP_LEVEL_READMODEL
RELATION_READMODEL
ENTITY_DETAIL
```

---

## 7.12 Phase H — Query / ReadModels / UX

H ne doit pas créer de nouveaux calculs Analytics.

Il doit :

```text
prendre les artifacts A→G certifiés
→ construire les ReadModels finaux
→ valider RuntimeSchemas
→ fermer le manifest Query
→ publier
```

### Top-level recommandé conceptuellement

Un payload initial raisonnablement compact qui contient :

- identité publication ;
- as-of ;
- freshness ;
- availability/quality de chaque module ;
- headlines de chaque module ;
- destinations vers détails.

### Details lazy

Séries lourdes, matrices, listes d’entités, relations, evidence bundles.

---

## 7.13 Phase I — Contextual Summary

Le résumé est un sidecar narratif futur, pas un moteur Analytics.

Il doit se rattacher à une publication Global déterministe par :

```text
publication id
revision
facts/digest
contract
```

Il peut avoir son propre artifact/readmodel narratif, mais ne doit jamais être nécessaire pour servir les modules déterministes.

---

# 8. Contrat de navigation Global cible

## 8.1 Flux

```text
route /analyse-globale
→ resolve publication/asOf
→ Query initial Global V2
→ read published snapshot
→ RuntimeSchema
→ React
```

Puis :

```text
interaction utilisateur
→ Query détail
→ snapshot déjà publié
→ RuntimeSchema
→ React
```

---

## 8.2 Ce qui est interdit dans React

React ne doit jamais calculer :

- Trend ;
- Stability ;
- volatility ;
- ChangePoint ;
- transformation class ;
- association strength ;
- causal score ;
- statistical significance/robustness ;
- Materiality ;
- ranking métier ;
- person difference ;
- shared participation ;
- Moment comparability ;
- Place importance ;
- routine qualification ;
- seasonality ;
- Purchase cycle ;
- Typical/Minimal ;
- supports ou coverage ;
- entity significance.

---

## 8.3 Ce qui peut rester présentation-only

- format de nombre/date ;
- expand/collapse ;
- carousel ;
- choix d’un tab déjà pré-calculé ;
- tri purement visuel uniquement si l’ordre métier n’a aucun sens ;
- sélection d’un élément déjà inclus ;
- tooltip ;
- pagination contrôlée par Query ;
- animation.

Tout `top N`, ordre d’importance ou qualification doit être serveur/ReadModel si cela porte une sémantique métier.

---

## 8.4 Nouvelle publication disponible pendant la lecture

La page ouverte doit conserver la génération chargée.

Si une nouvelle publication apparaît :

```text
G42 affichée
G43 devient active
→ UI peut annoncer « nouvelle analyse disponible »
→ utilisateur recharge/actualise volontairement
→ lecture entière passe à G43
```

À éviter :

```text
M1 G42
scroll
M2 refetch G43
M5 G43
```

Cela casserait la cohérence narrative et analytique.

---

# 9. Performance — baseline et hotspots probables

## 9.1 Baseline live utile

Les snapshots actifs actuels représentent environ :

```text
2464 rows
26.4 MB de JSONB actif
moyenne ≈ 10.7 KB
max ≈ 98.7 KB
```

Le plus gros pattern History observé reste `history_day_journal` :

```text
365 snapshots
≈ 54 KB moyen
≈ 19.75 MB total actif
```

Le Calendar mensuel :

```text
12 snapshots
≈ 82 KB moyen
≈ 0.99 MB total
```

Cette baseline montre qu’un design fonctionnel peut devenir coûteux quand un payload lourd est multiplié par beaucoup d’identités.

Global doit éviter cette explosion.

---

## 9.2 Hotspot 1 — payload initial monolithique

Si les dix modules embarquent directement :

- toutes séries ;
- tous lieux ;
- toutes activités ;
- toutes catégories ;
- toutes relations ;
- toutes personnes ;
- toutes preuves ;

le premier payload deviendra trop lourd.

Cible : headlines et états au top-level, détails lourds lazy mais **pré-matérialisés**.

---

## 9.3 Hotspot 2 — duplication de séries

M1, M2, M3, M5 et M9 peuvent tous consommer une série économique similaire.

Il ne faut pas physiquement recopier la même longue série dans chaque artifact si elle peut être :

```text
shared analytics artifact
→ plusieurs builders ReadModel
```

Le ReadModel utilisateur peut répéter quelques points nécessaires à l’affichage, pas dupliquer systématiquement toutes les données sous-jacentes.

---

## 9.4 Hotspot 3 — permutations de filtres

Le schéma actuel permet de matérialiser beaucoup de Query identities :

```text
subject
× filters
× params
× resource
× asOf
```

Global ne doit pas pré-calculer toutes les permutations théoriques.

Le manifest doit se limiter aux surfaces produit réellement contractées.

---

## 9.5 Hotspot 4 — N+1 entity details

M2/M6/M7/M8/M9 peuvent toucher de nombreuses entités.

À éviter au build :

```text
1 entity
→ 8 requêtes DB
× 500 entities
```

Les Facts/Canonical inputs doivent être chargés/batchés au bon grain, puis les details matérialisés sans N+1 naïf.

---

## 9.6 Hotspot 5 — RelationEngine combinatoire

Si N phénomènes sont tous comparés entre eux :

```text
O(N²)
```

Le moteur Relations doit définir en amont :

- familles de relations autorisées ;
- populations comparables ;
- support minimum ;
- exclusion avant calcul ;
- publication seulement de relations admissibles.

Le Runtime ne doit pas stocker un gigantesque graphe brut sans usage produit.

---

## 9.7 Hotspot 6 — Persona duplication

Avec Adrien, Manon et Household/Nous deux :

```text
same source facts
× multiple scopes
```

Les artifacts doivent favoriser le partage des inputs et recomputations contrôlées, sans créer une deuxième comptabilité par personne.

---

## 9.8 Hotspot 7 — grandes listes

Pagination/lazy loading est probablement pertinente pour :

- merchants ;
- places ;
- purchases ;
- relations ;
- Moments ;
- activities ;
- products si futur corpus riche.

Elle n’est pas nécessaire pour les 10 blocs principaux.

---

## 9.9 Hotspot 8 — top-N silencieux

Le code legacy utilise déjà certains `.slice()`/limits.

Global V2 doit distinguer :

```text
TOP N produit volontaire
```

et :

```text
troncature technique cachée
```

Si le top-N est métier, le ReadModel doit fournir :

- ranking method ;
- remainder/hasMore ;
- support ;
- destination lazy.

---

## 9.10 Budgets à définir plus tard

Aucun budget Global V2 final n’est encore certifié.

Phase H/test strategy devra mesurer au minimum :

- taille initial payload ;
- taille par module ;
- nombre de snapshots ;
- nombre d’artifacts ;
- build time ;
- query count ;
- TTFB ;
- drill-down latency ;
- DB reads ;
- payload duplication ratio ;
- maximum relation/entity detail size.

Ne pas figer des seuils dans ce pré-audit sans profiling de l’implémentation réelle.

---

# 10. Read-through actuel vs cible Global V2

Le spec Analytics historique indique :

```text
MISS/STALE
→ Canonical → Facts → Analytics
→ write cache
→ response
```

pour les ressources Analysis legacy.

Mais le reader matérialisé actuel exige désormais une `publication_id` publiée pour considérer un snapshot comme HIT.

Les Global legacy n’ont aucun snapshot live actuellement.

Cela renforce la nécessité de ne pas utiliser le comportement legacy comme cible V2.

### Cible Global V2

```text
published Global resource
→ read snapshot
→ validate
→ serve
```

Sur absence/stale :

```text
TEMPORARY_UNAVAILABLE
```

ou état produit explicitement contracté, mais **pas exécution automatique de Global A→G**.

La politique exacte doit être inscrite dans une future famille de contrat Global V2.

---

# 11. Correction / republication — cible conceptuelle

## 11.1 Flux idéal

```text
correction Canonical
→ dataRevision N+1
→ analytics_change_log
→ dependency impact
→ invalidation ciblée History/Global
→ ancienne publication Global devient non-current
→ rebuild des outputs affectés
→ recertification des dépendances
→ DRAFT G-next
→ manifest fermé
→ atomic publish
→ analyticsRevision +1
→ ancienne génération conservée
```

---

## 11.2 Un changement History peut avoir plusieurs scopes Global

Exemple : correction d’une dépense en mai.

Elle peut affecter :

```text
LOCAL_MONTH
M1 Actual de mai

HISTORICAL_LOOKBACK
Typical / trend / stability

GLOBAL_HISTORY
M3 transformation
M5 relation
M9 Persona
```

La vraie décision doit venir de `GLOBAL_ANALYTICS_DEPENDENCY_MATRIX`, pas d’une liste statique inventée aujourd’hui.

---

## 11.3 Global ne doit pas être invalidé entièrement par défaut

Le futur planner devrait pouvoir dire :

```text
M8 unchanged
M6 unchanged
M1 affected
M3 recertify
M5 recertify
M9 recertify
```

Mais l’**activation finale** doit rester cohérente au niveau de la génération Global.

---

## 11.4 Question physique importante

Pour créer G43 après une correction qui ne touche que M1/M3/M5, deux stratégies sont possibles :

### Option conceptuelle A — restage fermé

Tous les outputs requis de G43 sont physiquement présents sous la nouvelle publication, même ceux inchangés.

### Option conceptuelle B — manifest immutable references

G43 référence des artifacts immuables déjà certifiés d’une génération précédente pour les parties inchangées et de nouveaux artifacts pour les parties recalculées.

Le choix a des conséquences fortes sur :

- duplication ;
- rollback ;
- immutabilité ;
- GC ;
- manifest ;
- finalizer.

**Ce pré-audit ne tranche pas.**

GA0 + HC3/HC4 doivent permettre le choix correct.

---

# 12. Invalidation actuelle et adaptation Global

Le système actuel connaît :

```text
month
entity
global_reference
narrative
```

et `queryResourcesInvalidatedByImpact()` contient déjà une liste de ressources `analysis_global_*` pour `global_reference`.

C’est une bonne primitive conceptuelle, mais insuffisante pour la cible M1→M10.

Exemples futurs :

```text
classification Need modifiée
→ M2
→ potentiellement M3/M5/M9

Moment causal link modifié
→ M6
→ M5
→ M9/M10

Place identity modifiée
→ M7
→ M5/M9/M10

Purchase funding futur modifié
→ M8
→ M1/M2 selon consommation économique
→ M5/M9
```

La liste ne doit pas être codée avant le dependency audit physique final.

Verdict :

```text
existing invalidation mechanism = REUSABLE
existing Global mapping = NEEDS_ADAPTATION
```

---

# 13. Cohérence publication History ↔ Global

## 13.1 Pas de dépendance UI

Global ne doit jamais dépendre de :

- `history_month_balance_summary` comme source métier ;
- Calendar cell ;
- Bilan card ;
- History top-N ;
- History React.

## 13.2 Dépendance certifiée possible

Global peut consommer des métriques/artifacts mensuels certifiés lorsque :

- sémantique identique ;
- grain compatible ;
- method version compatible ;
- support/coverage conservés ;
- dépendance déclarée.

Le `readGlobalAdditiveMetric()` actuel illustre une bonne règle : seule une métrique réellement additive peut être reconstruite par addition mensuelle.

## 13.3 Non-additif

Doivent être recalculés au grain Global approprié :

- Typical ;
- Minimal ;
- medians ;
- rates ;
- shares ;
- ranks ;
- Trend ;
- Stability ;
- ChangePoint ;
- relationships ;
- Persona differences ;
- routines ;
- seasonality.

---

# 14. Mapping préparatoire phase → persistence

| Phase | Artifacts | Top-level RM | Details | Publication utilisateur ? |
|---|---:|---:|---:|---:|
| A Foundations | oui | non en principe | méthodologie seulement | non seule |
| B Finance M1/M2 | oui | oui | oui | staged |
| C Temporal/Life M3/M4 | oui | oui | oui | staged |
| D Relations M5 | oui | oui | relation RMs | staged |
| E Moments/Geo M6/M7 | oui | oui | entity details | staged |
| F Consumption M8 | oui | oui | entity details | staged |
| G People/Social M9/M10 | oui | oui | persona/relation details | staged |
| H Query/UX | assemble/valide | oui | oui | **publication complète** |
| I Summary | narrative sidecar | résumé | evidence refs | publication/sidecar séparé |

`staged` signifie ici : résultat certifiable disponible à l’assemblage final, pas nécessairement activation utilisateur indépendante.

---

# 15. Décisions à reporter au futur GA0

Les points suivants ne doivent pas être figés avant HC6 :

1. family de contrat exacte `global_v2` ou autre nom ;
2. forme finale de `AnalysisScope` Global ;
3. persistence physique de manifest après HC3 ;
4. factsHash/digest Global ;
5. manière de référencer les publications History ;
6. DRAFT full-copy vs manifest reference pour outputs inchangés ;
7. hardening single-active issu de HC4 ;
8. primitive rollback Global/générique ;
9. règles exactes de cache génération ;
10. mapping final invalidation par module ;
11. liste exacte des Query resources V2 ;
12. frontières top-level/detail ;
13. budgets performance ;
14. pagination et nombre de snapshots ;
15. politique d’annonce de nouvelle génération ;
16. traitement `LIVE_TAIL` dans une publication déterministe ;
17. comment E/F déclenchent recertification M3/M5 ;
18. durée/rétention/GC des générations Global anciennes.

---

# 16. Matrice finale des primitives

| Primitive | Existing role | Global need | Classification | Revalidate after HC6? | Risque principal |
|---|---|---|---|---:|---|
| `analytics_artifacts` | stockage dérivé | artifacts multi-modules | `GENERIC_REUSABLE` | oui léger | forcer objets complexes en metric |
| `analytics_query_snapshots` | ReadModels matérialisés | snapshots Global | `GENERIC_REUSABLE` | oui léger | explosion de permutations |
| `analytics_publications` | atomic publication | génération Global cohérente | `NEEDS_ADAPTATION` | **oui** | manifest insuffisant |
| MaterializationStore reads | metric/query reads | runtime Global | `GENERIC_REUSABLE` | oui | legacy assumptions |
| MaterializationStore staging | month profile | Global profile | `NEEDS_ADAPTATION` | **oui** | aucun beginGlobal |
| `publish_analytics_materialization` | atomic switch | Global switch | `GENERIC_REUSABLE` pattern | **oui** | completeness/manifest |
| History rollback RPC | rollback mois V2 | Global rollback | `HISTORY_SPECIFIC` | oui | scope month hardcodé |
| RuntimeSchemas engine | validation | Global schemas | `GENERIC_REUSABLE` | non | reprendre schemas legacy |
| Global schemas actuels | legacy UI | nouveau M1→M10 | `GLOBAL_EXISTING` | oui | fenêtre universelle |
| Query engine | auth/capabilities/read | Global V2 read | `GENERIC_REUSABLE` | non | dynamic fallback legacy |
| resource contracts | family switch | Global V2 policy | `NEEDS_ADAPTATION` | oui | legacy_v1 |
| Revision model | data/analytics revisions | lineage Global | `GENERIC_REUSABLE` | oui | corpus invisibles |
| freshness | month/global revisions | Global freshness | `NEEDS_ADAPTATION` | oui | asOf seul insuffisant |
| `factsHash` History | publication closure | Global closure | `NEEDS_ADAPTATION` | **oui** | History-specific type |
| durable manifest | partiel | full Global lineage | `NEEDS_ADAPTATION` | **oui** | HC3 pas fermé |
| invalidation framework | month/entity/global_ref | M1→M10 dependency impacts | `NEEDS_ADAPTATION` | **oui** | invalidation trop grossière |
| single-active workflow | RPC + reader | coherent Global generation | `NEEDS_ADAPTATION` | **oui** | mix de génération |
| client cache policy | month never/global SWR | generation-coherent UI | `NEEDS_ADAPTATION` | **oui** | hot swap/stale tab |
| telemetry | safe query/materialization logs | Global perf | `GENERIC_REUSABLE` | non | budgets absents |
| current Global route | legacy product page | `/analyse-globale` | `GLOBAL_EXISTING` | oui | mauvais produit/contrat |
| current global planner additive | safe additive aggregation | quelques Global metrics | `GENERIC_REUSABLE` | oui | croire que Global = somme |

---

# 17. Principes que la future chaîne de prompts doit imposer

Tout prompt d’implémentation Global touchant Runtime/Publication devra contenir :

1. **ne jamais traiter `analysis_global_*` legacy comme autorité** ;
2. **réutiliser Query/Materialization générique plutôt que dupliquer l’infrastructure** ;
3. **aucun moteur Global lourd déclenché par navigation** ;
4. **ReadModels validés avant snapshot** ;
5. **RuntimeSchema obligatoire à la lecture** ;
6. **une génération produit cohérente** ;
7. **aucun hot-swap partiel pendant une lecture** ;
8. **old generations retained/traceable** ;
9. **pas de patch payload publié** ;
10. **dependency closure explicite** ;
11. **non-additive metrics recomputed, jamais sommées par facilité** ;
12. **support/coverage/provenance conservés** ;
13. **pas de snapshot explosion sans justification produit** ;
14. **lazy ≠ dynamic analytics : les details lazy doivent être précomputés/materialisés** ;
15. **future Media/Summary/Wallet/Diagnostic/Import compatibility** sans les implémenter.

---

# 18. Handoff vers l’audit préparatoire 5

Ce document ne choisit pas les ReadModels finaux.

L’audit 05 devra désormais partir de cette frontière Runtime :

```text
Analytics A→G certifiés
→ artifacts
→ Global V2 ReadModels
→ snapshots
→ Query API
→ React présentation-only
```

Il devra préciser pour M1→M10 :

- top-level vs detail ;
- drill-downs ;
- liens vers History ;
- transformations client autorisées/interdites ;
- knowledge states ;
- contraintes mobile/accessibility ;
- payload initial raisonnable.

---

# 19. Contrôle de périmètre

Cet audit :

- n’a modifié aucun code ;
- n’a créé aucune migration ;
- n’a écrit aucune donnée Supabase ;
- n’a pas défini les tables Global finales ;
- n’a pas créé de Query resource ;
- n’a pas créé de ReadModel ;
- n’a pas créé de manifest physique ;
- n’a pas implémenté le Refresh Planner ;
- n’a pas modifié History ;
- n’a pas remplacé les décisions HC2→HC6 ;
- n’a pas déclaré les anciennes ressources Global comme cible V2.

Seul ce rapport préparatoire est ajouté au repository.

---

# 20. Verdict final

L’Analyse Globale V2 peut s’appuyer sur le socle matériel et Runtime déjà présent, mais **le profil Global produit n’existe pas encore**.

Il serait inutile et risqué de créer un second système de cache/publication. Les tables et primitives génériques sont adaptées au concept Global, et le RPC de publication a même déjà une branche `scope_kind = global`. En revanche, la cible M1→M10 exige un niveau de cohérence, de lineage, de manifest, de multi-grain et de génération qui dépasse les contrats legacy actuels.

La stratégie à retenir pour la préparation des futurs prompts est :

```text
REUSE
→ stockage générique
→ validation Runtime
→ Query engine
→ revisions
→ identity/versioning patterns
→ atomic switch pattern

ADAPT
→ Global scope
→ publication profile
→ manifest
→ dependency closure
→ invalidation
→ cache generation
→ rollback
→ resource contracts

REPLACE / DO NOT TRUST AS TARGET
→ analysis_global_* legacy ReadModels/doctrine
→ route legacy
→ universal observationWindow semantics
→ dynamic navigation-time Global analytics
```

Le point décisif à revalider après HC6 est le résultat concret de HC3–HC5 : durable manifest, immutabilité, correction/republication et cache generation-aware. Si ces briques deviennent suffisamment génériques, Global doit les réutiliser directement.

```text
GLOBAL RUNTIME FOUNDATION
ADAPT_REQUIRED
```
