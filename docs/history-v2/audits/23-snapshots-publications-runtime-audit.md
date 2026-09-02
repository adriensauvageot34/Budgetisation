# History V2 — audit snapshots, publications, FROZEN_MONTH et runtime

> **Nature du document** : audit descriptif en lecture. Aucun comportement applicatif, aucune migration et aucune donnée métier n'ont été modifiés.
>
> **Baseline code auditée** : branche `main`, commit `18cbb60c4bc5a7ef97de41e0448fe8975f79f167` (`docs(history-v2): audit month review ui ux data`).
>
> **Périmètre** : `src/server/analytics/materialization/**`, `src/query-api/server/**`, `src/server/query/runtime.ts`, `src/components/runtime/query-client.ts`, routes History V2, composants History V2, migrations de matérialisation/publication/rollback, scripts de certification et préparation live, plus contrôles SELECT-only sur le Supabase live du projet.
>
> **Limites** : aucun write Supabase, aucun rollback, aucune invalidation réelle, aucune nouvelle publication et aucun profiling navigateur n'ont été exécutés pendant cet audit. Les tailles de payloads live sont mesurées avec `pg_column_size(jsonb)` : elles représentent la taille Postgres du JSONB, pas exactement les octets HTTP.

---

# A. Executive summary

L'Historique mensuel V2 est **réellement snapshot-first** en production. La navigation ne déclenche ni Analytics ni construction de snapshot. Le chemin de lecture est :

```text
Route / API Query
→ Query Runtime
→ analytics_query_snapshots
→ publication publiée + snapshot actif + non invalidé + compatible + frais
→ RuntimeSchema
→ React
```

Si le snapshot History V2 compatible manque, `executeQuery()` retourne `TEMPORARY_UNAVAILABLE`. Il ne tombe pas sur un builder Canonical/Analytics. Le second garde-fou `createHistoryV2QuerySources()` refuse lui aussi toute reconstruction dynamique en exigeant une vraie publication gelée.

Le stockage History V2 actif est aujourd'hui constitué de :

```text
2 familles d'artifacts partagés
15 familles de Query ReadModels
12 publications mensuelles actives
24 artifacts actifs
927 Query snapshots actifs
```

Les douze mois actifs vont de `2025-08` à `2026-07`. Tous sont rattachés à une publication `published`, complets par rapport à leurs listes `required_*`, non invalidés et sans doublon d'identité logique actif. Les 927 snapshots actifs ont tous un `PublicationMeta`; aucun mismatch publicationId/révision/contrat ni factsHash manquant n'a été détecté dans le contrôle live de cet audit.

La mécanique de publication est sérieuse : une génération est construite et staged **inactive**, puis l'activation se fait dans une fonction PostgreSQL transactionnelle qui vérifie la complétude, verrouille la révision analytique du Household, désactive la génération logique précédente, active la nouvelle et incrémente `analytics_revision`. Un échec avant ou pendant Finalize laisse l'ancienne génération active. Le rollback est lui aussi transactionnel et peut réactiver une ancienne publication complète sans réécrire ses payloads.

Le caractère `FROZEN_MONTH` est donc réel **au niveau du comportement produit** : mois fermé + publication explicite + snapshot actif + cache `revalidate: never` + absence de read-through History. Une correction n'écrase normalement pas un mois publié : elle doit conduire à une nouvelle génération.

Cependant, l'audit met en évidence plusieurs limites structurantes avant Analyse Globale :

1. **Immutabilité physique incomplète** : aucune contrainte/trigger DB repérée n'interdit à `service_role` de modifier le payload d'une ligne appartenant déjà à une publication `published`. Le pipeline normal ne le fait pas et les migrations de Finalize ne mutent jamais les payloads, mais l'immuabilité est aujourd'hui une discipline du pipeline, pas une impossibilité physique du stockage.
2. **Correction historique non orchestrée de bout en bout** : `recordAnalyticsMutation()` et l'invalidation SQL existent, mais aucun caller applicatif de production n'a été trouvé. `analytics_change_log` est vide live. Une correction correctement enregistrée invaliderait les snapshots concernés et History deviendrait temporairement indisponible jusqu'à une nouvelle publication ; aucun Refresh Planner / rebuild automatique History n'est encore branché.
3. **Fermeture Bilan à revoir** : l'audit 22 a montré que le builder de certification 12 mois ne déclare pas encore explicitement tous les intrants Bilan dans ses closures/hash. Le mécanisme générique de `publicationFactsHash` est bon, mais il ne peut certifier que les dépendances qu'on lui fournit.
4. **Manifest non durable dans la DB** : la publication SQL conserve les required keys et les révisions, et chaque payload conserve son `PublicationMeta/factsHash`, mais `manifestHash`, `factDependencies`, `externalQueryRefs`, `implementationSha` et le digest de certification ne sont pas des colonnes de `analytics_publications`. La fermeture détaillée existe pendant le preflight/bundle, pas comme objet physique durable de la publication live.
5. **Cache client après correction** : les réponses d'un mois fermé sont conservées dans un `Map` navigateur avec `revalidate: never`. Après une nouvelle publication du même mois, un onglet qui possède déjà l'ancienne Query en mémoire ne dispose pas aujourd'hui d'un signal de révision pour purger automatiquement ce cache. Un reload réinitialise ce cache mémoire.

Conclusion : **la consultation History V2 et l'activation atomique sont solides ; la priorité avant Global est la doctrine de dépendances/correction/immutabilité, pas davantage de calculs à la navigation.**

---

# B. État live observé pendant l'audit

Toutes les requêtes suivantes ont été des `SELECT`/lectures uniquement.

## B.1 Révisions

État live observé :

```text
data_revision      = 1
analytics_revision = 67
```

`analytics_change_log` contient actuellement **0 ligne**.

Cela signifie que les générations actives actuelles n'ont pas encore été confrontées à une correction Canonical enregistrée via le nouveau mécanisme d'invalidation.

## B.2 Génération History V2 active

| Élément | Valeur live |
|---|---:|
| Mois actifs | 12 |
| Période | 2025-08 → 2026-07 |
| Publications actives distinctes | 12 |
| Publications actives complètes | 12/12 |
| Artifacts actifs V2 | 24 |
| Query snapshots actifs V2 | 927 |
| Doublons Query actifs par identité | 0 |
| Doublons artifact actifs par identité | 0 |
| PublicationMeta manquant | 0 |
| publicationId mismatch | 0 |
| revision mismatch | 0 |
| contractVersion mismatch | 0 |
| factsHash manquant | 0 |

Pour chaque publication active, toutes les Query ont exactement **un factsHash commun** et une seule révision PublicationMeta.

## B.3 Ressources Query actives

| Ressource | Instances actives | Mois |
|---|---:|---:|
| `history_activity_detail` | 92 | 12 |
| `history_bank_economy_bridge` | 12 | 12 |
| `history_category_detail` | 96 | 12 |
| `history_day_journal` | 365 | 12 |
| `history_minimal_preview` | 12 | 12 |
| `history_moment_detail` | 43 | 12 |
| `history_month_balance_summary` | 12 | 12 |
| `history_month_calendar` | 12 | 12 |
| `history_month_categories` | 12 | 12 |
| `history_month_life_money` | 12 | 12 |
| `history_month_overview` | 12 | 12 |
| `history_month_spending_nature` | 12 | 12 |
| `history_place_detail` | 39 | 12 |
| `history_spending_segment_detail` | 144 | 12 |
| `history_week` | 52 | 12 |
| **TOTAL** | **927** | **12** |

Le nombre diffère de l'ancienne preuve live à 907 : la génération actuellement active contient notamment **92 Activity Detail au lieu de 72**. C'est cohérent avec le fait que plusieurs générations V2 ont déjà été republiées depuis le premier cutover.

## B.4 Artifacts actifs

| Artifact family | Metric ID | Instances |
|---|---|---:|
| `calendar_semantic_month` | `history_v2:calendar_semantic_month` | 12 |
| `daily_economic_ledger_month` | `history_v2:daily_economic_ledger_month` | 12 |

Il n'existe donc pas un artifact dédié pour chaque écran. Les sorties écran/drill-down sont persistées comme Query snapshots.

## B.5 Preuve physique de générations successives

Mai 2026 possède actuellement quatre générations V2 qui ont toutes été publiées dans le passé :

| Publication | Révision publiée | Queries | Active ? |
|---|---:|---:|---|
| `8af8a91a-…` | 27 | 76 | non |
| `058d4756-…` | 41 | 76 | non |
| `f1d058ff-…` | 53 | 76 | non |
| `ff0a6983-…` | 65 | 79 | **oui** |

Les anciennes générations ne sont pas écrasées ni supprimées. Leur statut reste `published`; seul leur ensemble de lignes n'est plus `is_active`.

C'est une preuve forte du modèle :

```text
correction / nouvelle version
≠ UPDATE du snapshot actif en place

correction / nouvelle version
= nouvelle publication
  + nouveau generation_key
  + switch atomique is_active
```

---

# C. Inventaire des objets matérialisés

## C.1 `analytics_publications`

**Grain** : une génération publiée/draft pour un Household et un scope `month` ou `global`.

**History V2** : scope `month`, `period_month=YYYY-MM-01`.

Champs structurants :

```text
publication_id
household_id
scope_kind
period_month / as_of_month
source_revision
base_analytics_revision
published_analytics_revision
required_artifact_keys[]
required_query_keys[]
status = draft | published | failed
created_at
published_at
```

Responsabilité : définir une génération et la barrière de complétude à satisfaire avant activation.

Ce n'est **pas** une table de pointeur actif explicite : il n'existe pas de champ `active_publication_id` par mois.

## C.2 `analytics_artifacts`

**Grain History V2** : un artifact partagé par Household × mois × famille × génération.

Artifacts :

```text
calendar_semantic_month
daily_economic_ledger_month
```

Identité/version :

```text
artifact_key
generation_key
artifact_family
metric_id
scope_hash
filter_signature
method_version
contract_version
source_revision
analytics_revision
publication_id
```

État :

```text
is_active
invalidated_at
invalidation_revision
```

Payload : JSONB validé par le schema d'artifact correspondant et enveloppé dans `HistoryV2StagedArtifactEnvelope` lors du stage de publication.

Consommateurs : builders de ReadModels pendant le preflight/certification et, lorsque nécessaire, lecteurs History/Analytics serveur.

## C.3 `analytics_query_snapshots`

**Grain** : une Query normalisée exacte :

```text
Household
+ resource
+ scope_hash
+ normalized_param_signature
+ subject
+ période
+ contract_version
+ method_signature
+ generation_key
```

Le payload est un **ReadModel Query validé**, pas du JSON spécifique à un composant React.

Version/état :

```text
source_revision
analytics_revision
contract_version
method_signature
computed_at
expires_at
publication_id
is_active
invalidated_at
invalidation_revision
```

Pour History V2 fermé :

```text
publication_id != null
publication.status = published
is_active = true
invalidated_at = null
expires_at = null
```

Les quinze familles Query History V2 y sont persistées.

## C.4 ReadModels imbriqués et non autonomes

Certains objets ne sont volontairement pas une ressource séparée :

- `DayHoverReadModel` est imbriqué dans Calendar/Week ;
- contexts/markers/ribbons sont intégrés aux ReadModels Calendar/Week ;
- `EconomicExpenseSummary` est imbriqué dans les journaux/détails ;
- les projections M3 de contributeurs sont déjà présentes dans `history_month_spending_nature`, en plus de leurs snapshots de détail de segment.

Ce choix réduit le nombre de round-trips au prix de payloads top-level plus riches.

---

# D. Manifest, hashes et identité de publication

## D.1 Profil History V2

Le profil de matérialisation est :

```text
history-v2-month@v1
scope = household_month
contractVersion = v2
artifactFamilies = 2
query resource families = 15
```

Le preflight commence avec :

- les top-level Month ;
- tous les Journals du mois ;
- les Weeks possédées par le mois ;
- puis suit récursivement les `QueryTargetRef` trouvés dans les ReadModels ;
- M3 ajoute explicitement les détails de tous les buckets/cellules visibles.

Les références Journal/Week qui appartiennent physiquement à un mois voisin sont conservées comme `externalQueryRefs` au lieu d'être réattribuées au mauvais mois.

## D.2 RuntimeSchemas

Avant d'entrer dans le manifest, chaque Query est :

```text
queryDataSchemaByResource[resource].parse(data)
assertQueryDataMatchesRequest(request, data)
```

Le stage reparcourt ensuite les payloads après injection de `PublicationMeta`.

Donc un snapshot publié est supposé avoir passé le schema correspondant **avant** son activation, puis il est reparsé au runtime à la lecture.

## D.3 `resourceInputHash`

Chaque ReadModel possède un hash d'entrée permettant d'identifier les intrants que son builder déclare.

Ce hash n'est pas l'équivalent du `publicationFactsHash` : il est propre à la ressource.

**Point ouvert majeur issu de l'audit 22** : les builders de certification du Bilan n'incluent pas encore tous leurs intrants réels dans cette fermeture. Le mécanisme est correct ; l'exhaustivité des données fournies au mécanisme ne l'est pas encore pour toutes les ressources Bilan.

## D.4 `publicationFactsHash`

`buildHistoryV2Preflight()` réunit les closures :

```text
artifact:<artifactKey>
query:<queryKey>
```

Chaque closure fournit :

```text
facts[]
dependencies[]
```

Le digest commun est construit par :

```text
computeHistoryV2PublicationFactsHash({ householdId, month, closures })
```

Il devient le `factsHash` partagé par toute la génération.

Les tests prouvent notamment qu'un changement de Fact de lieu peut laisser le `manifestHash` identique tout en changeant le `publicationFactsHash` :

```text
structure des ressources inchangée
mais contenu de vérité différent
→ factsHash différent
```

## D.5 `manifestHash`

Le `manifestHash` couvre la structure :

- required artifact keys ;
- required query keys ;
- external Query refs ;
- Household/mois/profile.

Il ne remplace pas `factsHash`.

## D.6 Ce qui n'est pas persisté comme manifest live

`analytics_publications` persiste :

- required artifact keys ;
- required query keys ;
- source/base/published revisions ;
- statut et timestamps.

Mais la table n'a pas de colonnes pour :

```text
manifestHash
publicationFactsHash
factDependencies
externalQueryRefs
implementationSha
deterministicDigest
```

Le `factsHash` reste récupérable dans chaque `PublicationMeta` de payload. En revanche, la **liste exacte des dépendances qui a produit ce hash** n'est pas un manifest durable attaché à la publication dans la DB.

Classification : **traçabilité suffisante pour servir/rollback, incomplète pour une future inspection fine du dependency graph historique**.

---

# E. Pipeline réel BUILD → STAGE → VALIDATE → CERTIFY → ACTIVATE

Le pipeline physique actuel est plus précisément :

```text
CANONICAL / FACTS
      ↓
BUILD artifacts Calendar + Daily
      ↓
BUILD Query ReadModels
      ↓
RUNTIME SCHEMA VALIDATION
      ↓
CLOSURE / MANIFEST / factsHash
      ↓
CERTIFICATION déterministe + invariants
      ↓
CREATE analytics_publications DRAFT
      ↓
STAGE artifacts + snapshots avec is_active=false
      ↓
BARRIÈRE DE COMPLÉTUDE
      ↓
publish_analytics_materialization()
      ↓
ATOMIC SWITCH
      ↓
publication.status=published
```

## E.1 BUILD

`check-history-v2-certification-12-months.mjs` construit les deux artifacts et les ReadModels de fermeture pour les douze mois.

Le builder History spécifique ne s'exécute pas dans la route utilisateur.

## E.2 VALIDATE

Le preflight impose :

- exactement 2 artifacts ;
- exactement 15 familles Query atteintes ;
- tous les Journals et Weeks attendus ;
- fermeture récursive des targets ;
- RuntimeSchema présent pour chaque ressource ;
- scope/request correspondant ;
- hashes/policies cohérents.

## E.3 CERTIFY

La certification 12 mois est un gate séparé des contrôles ordinaires.

Important :

```text
npm run verify
```

exécute les checks History unitaires/transversaux/materialization/frontend, typecheck et build, mais **n'exécute pas automatiquement** :

```text
npm run check:history-v2-certification-12-months
```

La certification exhaustive 12 mois reste donc un gate explicite à lancer lorsque nécessaire.

## E.4 STAGE

La génération reçoit un vrai `PublicationMeta` :

```text
publicationId
revision
contractVersion=v2
factsHash
policyVersions
generatedAt
```

Les rows staged ont :

```text
generation_key = publicationId
publication_id = publicationId
is_active = false
invalidated_at = null
```

L'ancienne génération reste entièrement active pendant cette phase.

## E.5 PREPARATION LIVE

`prepare-history-v2-live-publication.mjs` transforme le bundle certifié + draft plan en rows SQL. Il exige les mêmes implementation/deterministic digests et vérifie la cohérence `publicationMeta`.

La première publication live documentée a staged **les 12 DRAFTs entièrement avant le premier Finalize**.

Il n'existe aujourd'hui aucune route produit de publication History sur `main`. Cette phase est encore un processus d'administration/build, pas un Refresh Orchestrator accessible depuis l'application.

## E.6 ACTIVATE / FINALIZE

`publish_analytics_materialization()` s'exécute entièrement dans PostgreSQL.

Dans une transaction :

1. lock publication ;
2. vérifie `draft` ;
3. lock `household_revisions` ;
4. vérifie la révision concurrente ;
5. vérifie que la source n'est pas une révision future ;
6. vérifie tous les required artifacts ;
7. vérifie toutes les required queries ;
8. désactive les anciennes lignes de même identité logique ;
9. active la nouvelle génération ;
10. incrémente `analytics_revision` ;
11. met à jour `analysis_periods.source_revision` pour le mois ;
12. marque les change log concernés processed ;
13. passe la publication à `published`.

## E.7 Atomicité

Le switch est **atomique par transaction PostgreSQL**.

Avant commit : ancienne génération active.

Après commit : nouvelle génération active.

Une exception annule les updates de la transaction, donc il n'existe pas d'état intermédiaire durable où seule une partie des rows requises est active.

## E.8 Publication partielle

Le Finalize refuse une DRAFT qui n'a pas toutes ses `required_*` keys.

Nuance : la fonction SQL vérifie la **présence de tous les requis**, mais elle n'interdit pas explicitement des rows supplémentaires dans la DRAFT et active ensuite toutes les rows portant le publicationId. L'absence d'extra est actuellement garantie par le preflight/stage applicatif, pas par une contrainte SQL de Finalize.

## E.9 Échec

Avant Finalize : les rows sont inactives, donc un stage incomplet ne remplace rien.

Le workflow générique marque une DRAFT `failed` en cas d'exception.

Pendant Finalize : rollback transactionnel ; ancienne génération reste active.

## E.10 Retry

- une DRAFT complète peut être finalisée si sa base revision est toujours la bonne ;
- un appel Finalize sur une publication déjà `published` est idempotent et retourne sa révision ;
- un conflit de revision (`40001`) oblige à repartir depuis un état cohérent ;
- une DRAFT `failed` n'est pas publiable.

---

# F. Active publication pointer

Il n'existe pas un pointeur central du type :

```text
history_active_publication(month) → publicationId
```

L'activation est portée par :

```text
analytics_artifacts.is_active
analytics_query_snapshots.is_active
```

Le lecteur exige également :

```text
publication_id != null
analytics_publications.status = published
invalidated_at IS NULL
```

Le Finalize compare les **identités logiques**, et non le simple `artifact_key/query_key`, pour désactiver correctement une génération précédente.

Le runtime contient aussi un garde anti-ambiguïté : s'il trouve plus d'un snapshot compatible actif pour une même Query logique, il refuse de choisir arbitrairement et renvoie `TEMPORARY_UNAVAILABLE`.

État live : **0 identité Query active dupliquée** et **0 identité artifact active dupliquée**.

Nuance : l'unicité active est donc fortement garantie par le chemin transactionnel et vérifiée par le reader, mais pas par un unique index partiel couvrant toute l'identité logique. Un write privilégié hors pipeline pourrait créer une ambiguïté ; le runtime échouerait alors fermé.

---

# G. FROZEN_MONTH — ce que cela signifie réellement

## G.1 Il n'existe pas de colonne `FROZEN_MONTH`

`FROZEN_MONTH` est un contrat composé, pas un enum physique unique.

Il résulte de :

```text
analysis_period.is_closed
+ publication mensuelle réelle
+ contractVersion=v2
+ PublicationMeta réel
+ snapshot actif/non invalidé
+ publication.status=published
+ freshness compatible avec sourceRevision / change log
+ cachePolicy.revalidate = never
+ interdiction du read-through History V2
```

## G.2 Quand un mois devient réellement gelé

Le mois n'est pas gelé simplement parce que `is_closed=true`.

Il devient servable comme History V2 gelé **après activation d'une génération publiée complète**.

Avant cela, le runtime History V2 ne fabrique pas une pseudo-publication : il répond indisponible.

## G.3 Ce qui reste mutable

Même pour un mois fermé, peuvent évoluer :

- la vérité Canonical via une correction autorisée ;
- `data_revision` ;
- l'état d'invalidation des anciennes matérialisations ;
- la sélection `is_active` lors d'un nouveau Finalize/rollback ;
- `analytics_revision` ;
- une nouvelle génération complète.

Ce qui ne doit pas être « corrigé en place » fonctionnellement :

- les chiffres d'un ancien snapshot publié ;
- ses ReadModels ;
- son factsHash ;
- son PublicationMeta.

## G.4 Immutabilité opérationnelle

Le pipeline normal respecte cette doctrine :

- `publish_analytics_materialization()` ne fait aucun `UPDATE payload` ;
- le test de matérialisation vérifie explicitement l'absence de `DELETE`, `SET payload=` ou mutation `invalidated_at` dans la migration de switch actif ;
- une génération corrigée possède un nouveau publicationId/generationKey ;
- les anciennes générations restent dans les tables.

## G.5 Immutabilité physique : limite trouvée

Aucun trigger/constraint DB n'a été trouvé pour dire :

```text
IF publication.status = 'published'
THEN reject UPDATE payload / method / facts / generation
```

`service_role` possède des droits d'écriture sur les tables et les helpers de stage utilisent des UPSERT. `prepare-history-v2-live-publication.mjs` génère également un `ON CONFLICT DO UPDATE` pour la même `generation_key`.

Dans le workflow normal, un publicationId neuf est utilisé et tout est staged avant Finalize : aucune mutation silencieuse n'a été observée. Mais **la DB n'interdit pas physiquement** qu'un acteur privilégié réutilise un publicationId publié et altère une row.

Verdict :

```text
FROZEN_MONTH produit/runtime : OUI
append-only par processus normal : OUI
immutabilité DB irrévocable : NON PROUVÉE / PAS ENFORCÉE
```

C'est un risque d'intégrité privilégiée, pas un risque navigateur : les utilisateurs authentifiés ordinaires n'ont pas les droits d'écriture sur ces tables.

---

# H. Rollback et traçabilité des anciennes générations

La primitive :

```text
restore_history_v2_publication(...)
```

travaille par Household/mois et exige une `expectedAnalyticsRevision`.

Elle :

- refuse plusieurs publications actives ;
- vérifie que la publication cible appartient au bon mois/Household ;
- exige `status=published` ;
- revérifie sa complétude ;
- désactive la génération active ;
- réactive la cible ;
- incrémente `analytics_revision`.

Elle peut aussi cibler `null` pour laisser temporairement le mois sans V2 active.

Le rollback ne réécrit pas les payloads et ne repasse pas une publication à `draft`.

L'ancien test live documenté a réellement exécuté :

```text
Finalize
→ rollback vers aucune V2
→ restore de la publication
```

sans toucher à V1.

L'état live actuel confirme que plusieurs anciennes générations de mai 2026 sont encore physiquement présentes et traçables.

---

# I. Navigation sans recalcul métier

## I.1 Classification générale

| Action | Catégorie |
|---|---|
| parse URL/mois | `DESERIALIZATION` |
| normaliser Query | `DESERIALIZATION` |
| autorisation/capabilities | `QUERY` / contrat |
| source-health PurchaseEvent | `QUERY` |
| lookup snapshot | `QUERY` |
| check freshness/change log | `QUERY` |
| RuntimeSchema parse | `DESERIALIZATION` |
| format € / dates / % | `LIGHT_FORMATTING` |
| carousel, ouverture, slicing UI | `PRESENTATION_ONLY` |
| filtre markers depuis ordre serveur | `PRESENTATION_ONLY` |
| recalcul Actual/Typical/Minimal | **absent à la navigation** |
| Analytics History | **absent à la navigation** |
| snapshot build | **absent à la navigation** |

## I.2 Ouverture d'un mois Calendar

La route serveur demande en parallèle :

```text
history_month_calendar
history_month_overview
```

Deux Query ReadModels matérialisés sont lus.

Aucun builder Calendar/Daily n'est exécuté.

## I.3 Vue Week

La route demande :

```text
history_week
history_month_overview
```

La Week elle-même est un snapshot dédié ; elle n'est pas reconstruite depuis Calendar React.

## I.4 Hover

Le Hover est déjà imbriqué dans Calendar/Week.

Survol :

```text
0 requête Query supplémentaire
0 Analytics
0 snapshot build
```

## I.5 Journal

Le premier clic ouvre un drawer qui appelle :

```text
POST /api/query
resource=history_day_journal
```

Le Journal est un snapshot dédié. Le client ne reconstruit pas la chronologie depuis les opérations.

## I.6 Bilan

La route demande en parallèle :

```text
history_month_overview
history_month_balance_summary
history_month_categories
history_month_spending_nature
history_month_life_money
```

Les drill-downs sont ensuite lazy : une Query snapshot par drawer/popup.

## I.7 Drawers

```text
Bridge       → history_bank_economy_bridge
Category     → history_category_detail
Segment      → history_spending_segment_detail
Activity     → history_activity_detail
Moment       → history_moment_detail
Place        → history_place_detail
Minimal      → history_minimal_preview
```

Aucun de ces drawers ne déclenche un builder Analytics en cas de miss : il devient indisponible.

## I.8 Garde-fou `executeQuery()`

Le comportement déterminant est :

```text
materialized hit
→ validate + serve

materialized miss AND family=history_v2
→ TEMPORARY_UNAVAILABLE

PAS : adapter.execute() / builder Analytics
```

Ce point répond directement à la question principale : **naviguer dans History ne déclenche pas de calcul métier de secours.**

---

# J. Ce qui est quand même interrogé au runtime

« Aucun recalcul métier » ne signifie pas « zéro accès serveur ».

Pour chaque batch History, `createQueryServicesForContext()` construit un Repository et exécute le moteur de capabilities. `resolveApplicability()` sonde la santé PurchaseEvent.

`purchaseEventSourceHealth()` teste trois relations Canonical avec des requêtes légères `limit 1` :

```text
purchase_events
purchase_event_memberships
purchase_event_timing_assertions
```

Le Repository met ce résultat en cache par Promise dans l'instance partagée : les cinq Query du Bilan ne font pas cinq fois ces trois probes.

La freshness d'un mois fermé interroge aussi `analytics_change_log`. `SupabaseAnalyticsMaterializationStore` met le résultat en cache par scope au sein du batch.

Ce sont des contrôles de disponibilité/fraîcheur, **pas des Analytics**.

---

# K. Cache : trois notions à ne pas confondre

## K.1 Snapshot publié

`analytics_query_snapshots` avec publication V2 réelle.

C'est la **source de lecture History**, pas seulement une optimisation jetable.

## K.2 Generic read-through cache

Le MaterializationStore sait, pour des ressources non History ou d'autres métriques, écrire :

```text
generation_key = read_through
publication_id = null
```

Mais History V2 refuse de servir un miss depuis cette voie.

La preuve live historique indiquait 0 History V2 read-through ; le code courant continue d'exiger `publication_id != null` et `publication.status=published`.

## K.3 Cache client navigateur

`src/components/runtime/query-client.ts` maintient un :

```text
Map<queryIdentity, response/inFlight>
```

Fonctions :

- dédupliquer les requêtes simultanées ;
- réutiliser une réponse déjà obtenue ;
- revalider seulement si `cachePolicy.revalidate !== 'never'`.

Pour un mois fermé History :

```text
revalidate = never
```

Donc un drawer déjà récupéré ne refait pas d'appel durant la même session tant que la clé Query reste la même.

### Conséquence après correction

Une nouvelle publication du même mois garde la même identité fonctionnelle Query mais change publication/revision/factsHash dans le payload. Le cache client ne connaît pas actuellement un événement « generation changed » qui invaliderait ses entrées `never`.

Ainsi, un onglet ouvert avant la correction peut conserver l'ancienne réponse en mémoire jusqu'à reload/navigation qui réinjecte une nouvelle réponse serveur selon le chemin emprunté.

Le cache n'est pas persistant : un reload complet réinitialise le module JS.

Classification : **gap de propagation UX/runtime après correction, pas un problème de calcul métier.**

---

# L. Snapshots potentiellement manquants / calculs de présentation React

La présence d'un calcul React ne signifie pas automatiquement qu'un snapshot manque.

## L.1 Calendar — projection de markers filtrés

Current source :

```text
day.orderedMarkerGroups
```

Current computation :

```text
filter par tags sélectionnés
→ slice(0, 6)
→ hidden = filtered.length - 6
```

Le classement n'est pas recalculé : React conserve l'ordre serveur.

**Cost** : très faible CPU ; permet des filtres instantanés sans snapshot par combinaison.

**Should remain dynamic?** Probablement oui pour le filtrage interactif.

**Contrat à trancher** : le Month ReadModel possède aussi une projection serveur `visibleMarkers` top 3, tandis que l'UI actuelle ignore ce champ et autorise 6. Il faut choisir l'autorité finale 3 vs 6.

**Potential ReadModel adjustment** : oui, pour enlever l'ambiguïté contractuelle ; pas besoin de snapshot par filtre.

## L.2 Calendar — ribbons par semaine

Current source : collection serveur ordonnée de ribbon segments.

React fait un `filter(segment.weekStart===week)` et un `find()` overflow.

**Classification** : présentation structurelle du même payload.

**Nouveau snapshot** : non justifié.

## L.3 Calendar — contexts

React extrait les DisplayNodes visibles avec `Object.values(...).flatMap(...)`.

**Classification** : présentation.

## L.4 Hover

Le contenu métier est snapshoté. Les limites d'affichage et sélections compactes observées dans l'audit 21 peuvent rester une projection UI **si le contrat dit explicitement que le serveur fournit un ordre autoritaire**.

Si le produit exige que « top 3 affiché » soit une sortie certifiée en soi, alors le ReadModel doit porter cette projection explicitement. Ce choix est à prendre pendant le polish, pas à deviner dans cet audit.

## L.5 Bilan M2

Les catégories sont déjà sélectionnées/ordonnées serveur.

React choisit seulement le mode :

```text
Montant & part
vs
Écart à l'habitude
```

et masque une ligne `Autres/Non classé` lorsque sa valeur KNOWN est exactement zéro.

**Classification** : présentation.

## L.6 Bilan M3

React construit une Map des `segments` déjà préparés pour joindre les contributeurs aux buckets affichés.

Il ne calcule ni les montants ni la marge.

**Classification** : adaptation UI légère.

## L.7 Bilan M4 — Moments

Le serveur fournit les Moments ordonnés. React fait le rail/offset et n'en montre que trois simultanément.

**Classification** : pagination visuelle.

## L.8 Bilan M4 — Places

Le builder `buildMonthLifeMoneyReadModel()` tronque déjà `places` à 6.

React possède pourtant :

```text
shown = expanded ? items : items.slice(0,6)
if items.length > 6 → Voir tous les lieux
```

`items.length` ne peut pas dépasser 6 avec le builder actuel.

Si UX veut réellement « Voir tous », il faut un **ajustement ReadModel/snapshot ou une Query de collection**, pas un calcul React supplémentaire.

## L.9 Category composition

React affiche 8 composantes puis toutes au clic. Le slicing est présentationnel.

Le problème est ailleurs : le snapshot expose parfois des stableIds techniques au lieu d'un label humain. Le label devrait venir du ReadModel plutôt que d'un lookup Canonical côté React.

## L.10 Minimal Preview

React affiche familles/exemples et peut slice les examples, mais le builder produit déjà une sélection.

Les éventuels enums/identifiants techniques à humaniser relèvent du ReadModel/presentation contract.

## L.11 Imported Summary

L'emplacement existe dans M1, mais la génération actuelle est `MISSING`. Ce n'est pas un snapshot History « oublié » : c'est une future intégration sidecar Résumé contextuel qui doit respecter l'identité de publication.

---

# M. Correction historique — chemin théorique réellement codé

Prenons une correction Canonical de **mai 2026**.

## M.1 Étape 1 — mutation enregistrée

Le boundary prévu est :

```text
recordAnalyticsMutation()
→ RPC record_analytics_mutation()
```

Il doit :

- bump `dataRevision` ;
- écrire `analytics_change_log` ;
- invalider les matérialisations compatibles ;
- retourner les volumes invalidés.

## M.2 Impact `month`

Pour un impact `month=2026-05`, la liste des ressources invalidées inclut les 15 ressources History V2.

La DB marque :

```text
invalidated_at = now()
invalidation_revision = nouvelle dataRevision
```

sur :

- les artifacts actifs de mai correspondant au scope `month` ;
- les Query snapshots History de mai contenus dans le resource set.

## M.3 Effet utilisateur immédiat

Le reader exige `invalidated_at IS NULL`.

Donc l'ancienne publication ne reste pas servie comme si elle était fraîche.

Comme History V2 n'a aucun read-through :

```text
correction enregistrée
→ ancien snapshot invalide
→ History Query = TEMPORARY_UNAVAILABLE
```

jusqu'à publication d'une nouvelle génération.

C'est une stratégie **fail closed**.

## M.4 Étape manquante aujourd'hui — rebuild/orchestration

Aucun orchestrateur produit n'a été trouvé pour enchaîner automatiquement :

```text
mutation
→ plan de refresh
→ rebuild artifacts
→ rebuild fermeture Query
→ validate
→ certify
→ stage
→ atomic activate
```

`recordAnalyticsMutation()` est implémenté/exporté, mais la recherche du code n'a trouvé aucun caller applicatif de production.

Le commentaire du fichier le décrit d'ailleurs comme la frontière des **future canonical writes**.

Le `analytics_change_log` live vide est cohérent avec cela.

Donc le mécanisme **d'invalidation** existe, mais le workflow complet de **correction utilisateur/import** n'est pas encore implémenté.

## M.5 Nouvelle génération

Une correction correctement reconstruite doit :

1. recalculer les artifacts concernés ;
2. reconstruire les Query de fermeture ;
3. obtenir de nouveaux hashes ;
4. créer une nouvelle DRAFT ;
5. stage inactive ;
6. certifier ;
7. Finalize atomiquement.

L'ancienne publication reste traçable dans les tables.

---

# N. Dependency graph actuel vs familles conceptuelles

Les noms `LOCAL_MONTH`, `HISTORICAL_LOOKBACK`, `GLOBAL_HISTORY`, `ENTITY_SCOPED` ne constituent pas encore un Refresh Planner physique History.

Le code possède toutefois des équivalents partiels.

## N.1 LOCAL_MONTH

Équivalent réel :

```text
AnalyticsImpact.kind = month
```

Effet : invalidation du mois affecté.

**Implémenté** au niveau invalidation.

## N.2 ENTITY_SCOPED

Équivalent réel :

```text
AnalyticsImpact.kind = entity
```

avec mapping de ressources par :

```text
merchant
place
life_event
moment
category
activity
```

Les Query sont sélectionnées finement selon l'entité.

Nuance : côté artifacts, la fonction SQL `entity` invalide les artifacts du mois de façon plus grossière ; elle ne possède pas de dependency graph artifact par entité.

**Implémenté mais coarse-grained côté artifact.**

## N.3 HISTORICAL_LOOKBACK

Équivalent partiel :

```text
global-reference
+ affected_month
```

Les métriques Typical/Minimal peuvent être invalidées à partir du mois affecté, et les Query sélectionnées peuvent être invalidées pour `period_month >= affected_month`.

C'est une propagation historique forward depuis le point corrigé.

## N.4 GLOBAL_HISTORY

Le scope `global_reference` invalide les ressources Global et les références mensuelles dépendantes.

Analyse Globale V2 n'est toutefois pas encore le consumer physique final décrit par le master brief ; le dependency matrix définitif doit encore être construit après History stable.

## N.5 Cas `affectsGlobalReferences=true`

Pour une mutation Month, `recordAnalyticsMutation()` construit d'abord le set des ressources Month — qui contient toutes les ressources History — puis lui ajoute les ressources Global.

Le second appel d'invalidation `global_reference` reçoit ce set combiné. La condition SQL permet alors d'invalider des Query History aux mois **>= affected_month** si leur ressource figure dans le set.

En parallèle, les artifacts globaux/Typical/Minimal suivent leurs propres règles ; les deux shared artifacts History ne sont pas systématiquement invalidés pour tous les mois futurs.

Ce comportement est safe au sens « ne pas servir de Query potentiellement dépendante », mais il montre que la future orchestration devra comprendre :

```text
Query invalidée
≠ forcément artifact invalidé
≠ forcément même rebuild scope
```

C'est exactement le type de dépendance que le futur `GLOBAL_ANALYTICS_DEPENDENCY_MATRIX` / Refresh Planner devra matérialiser.

---

# O. Performance — mesures et architecture

## O.1 Taille des payloads live

Mesure : `pg_column_size(payload)` sur les snapshots V2 actifs.

| Ressource | N | Moyenne | Maximum | Total |
|---|---:|---:|---:|---:|
| `history_day_journal` | 365 | 54.1 KB | 56.8 KB | 19.75 MB |
| `history_month_calendar` | 12 | 82.3 KB | 101.0 KB | 0.99 MB |
| `history_week` | 52 | 17.3 KB | 25.2 KB | 0.90 MB |
| `history_category_detail` | 96 | 2.45 KB | 3.11 KB | 0.23 MB |
| `history_spending_segment_detail` | 144 | 1.58 KB | 1.62 KB | 0.23 MB |
| `history_activity_detail` | 92 | 2.25 KB | 3.73 KB | 0.21 MB |
| `history_moment_detail` | 43 | 3.34 KB | 12.23 KB | 0.14 MB |
| `history_month_overview` | 12 | 11.13 KB | 12.31 KB | 0.13 MB |
| `history_month_spending_nature` | 12 | 5.88 KB | 5.96 KB | 0.07 MB |
| autres top-level/details | — | ~1.7–4.4 KB | — | faible |

Les 927 Query payloads actifs représentent environ **22.9 MB de JSONB Postgres**, dont les Journals sont de très loin la principale masse (~19.75 MB).

Les artifacts :

| Artifact | Moyenne | Maximum |
|---|---:|---:|
| Calendar Semantic | 44.2 KB | 50.0 KB |
| Daily Economic Ledger | 18.8 KB | 21.3 KB |

## O.2 Taille moyenne d'une ouverture

Approximation basée uniquement sur les payloads DB, hors enveloppe HTTP/meta :

```text
Calendar initial
≈ Calendar 82.3 KB + Overview 11.1 KB
≈ 93.4 KB

Week initial
≈ Week 17.3 KB + Overview 11.1 KB
≈ 28.4 KB

Bilan initial
≈ Overview 11.1
 + Summary 1.8
 + Categories 2.5
 + SpendingNature 5.9
 + LifeMoney 4.4
≈ 25.7 KB

Journal drawer
≈ 54.1 KB en moyenne
```

Le **Journal** est donc le hotspot de payload individuel inattendu à surveiller ; aucune conclusion n'est tirée ici sur la cause exacte sans profiling du contenu sérialisé.

## O.3 Nombre de Query produit

| Action | Query resources |
|---|---:|
| Calendar mois | 2 |
| Week | 2 |
| Bilan | 5 |
| Hover | 0 supplémentaire |
| Journal premier clic | 1 |
| chaque drawer Bilan premier clic | 1 |

Les Query d'une route sont lancées en `Promise.all` avec un service/repository/materialization store partagé.

## O.4 Accès Supabase par batch

Chaque Query snapshot possède son lookup matérialisé propre ; il n'existe pas actuellement un `SELECT ... WHERE query_key IN (...)` unique pour tout le Bilan.

En revanche :

- la santé PurchaseEvent est cachée dans le Repository partagé ;
- la latest impact revision est cachée dans le MaterializationStore partagé ;
- il n'y a donc pas un N+1 complet de ces probes pour chaque module du Bilan.

Une API drawer est un nouveau request serveur et recrée ce contexte.

## O.5 Client cache

Un drawer History fermé déjà lu ne refait normalement pas la Query dans la même session grâce au cache `revalidate=never` et à la déduplication `inFlight`.

## O.6 Filtres Calendar

Les filtres markers sont calculés côté client depuis `orderedMarkerGroups`, ce qui est performant pour l'interaction elle-même.

Cependant la sélection des filtres est reflétée dans l'URL via navigation Next ; cela peut provoquer une navigation RSC/relecture des snapshots même si les données sous-jacentes n'ont pas changé. C'est un candidat de polish/performance, pas un besoin de snapshot supplémentaire.

## O.7 Builders / sérialisation

Aucun timing de builder fiable n'a été mesuré pendant cet audit.

Le runtime contient des traces :

```text
analytics_query_snapshot_hit/miss/stale
query_trace.durationMs
analytics_recompute_start/complete
```

mais aucun échantillon de logs production n'a été collecté ici.

## O.8 Bundle client

Les features History chargent plusieurs Client Components et `lucide-react`; aucun calcul Analytics n'est embarqué dans React.

Aucun bundle analyzer n'a été exécuté : pas de chiffre fiable de poids JS dans cet audit.

---

# P. Tests et gates

## P.1 Scripts présents

```text
check:history-v2-canonical
check:history-v2-transversal
check:history-v2-calendar-daily
check:history-v2-readmodels
check:history-v2-month-balance
check:history-v2-snapshot-materialization
check:history-v2-certification-12-months
check:history-v2-frontend
check:analytics-materialization
check:live-runtime-regressions
typecheck
build
```

## P.2 Publication / snapshots

`check-history-v2-snapshot-materialization.mjs` couvre notamment :

- exactement 2 artifacts ;
- 15 familles Query ;
- Journals/Weeks ;
- recursive closure ;
- external refs ;
- manifestHash/factsHash ;
- déterminisme ;
- changement de Fact → factsHash change ;
- PublicationMeta commun ;
- DRAFT inactive ;
- identités logiques du switch ;
- absence de mutation payload dans le SQL de switch ;
- rollback primitive ;
- signatures current/legacy ;
- refus de snapshots actifs ambigus ;
- aucun read-through History sur hit current/legacy ;
- sélection du dernier mois publié.

## P.3 Reconciliation

La certification 12 mois couvre Calendar/Daily/Bilan et les invariants de réconciliation. L'audit 22 rappelle néanmoins que la qualité d'un hash dépend de l'exhaustivité des intrants déclarés par le builder Bilan.

## P.4 FROZEN_MONTH

Les tests prouvent le comportement :

- pas de fake PublicationMeta ;
- staging complet ;
- publication nécessaire ;
- pas de fallback dynamique ;
- switch générationnel ;
- rollback.

Ils ne prouvent pas une **interdiction DB absolue de modifier un payload déjà publié**, puisqu'aucun trigger correspondant n'existe.

## P.5 Gaps de tests identifiés

1. Pas d'E2E Canonical correction → `recordAnalyticsMutation` → invalidation → rebuild History → republish → UI fraîche.
2. Pas de caller applicatif de mutation à tester aujourd'hui.
3. Pas de test client démontrant la purge du cache `revalidate:never` après changement de génération — aucun mécanisme de purge n'existe actuellement.
4. Pas de contrainte/test DB qui refuse un `UPDATE payload` privilégié sur une publication déjà `published`.
5. Le Finalize SQL ne teste pas l'absence de rows extra dans une DRAFT ; ce gate repose sur le preflight/stage.
6. Pas de budget automatique de taille de payload ; le Journal peut atteindre ~56.8 KB JSONB live sans alerte.
7. Pas de budget de nombre de round-trips par route History.
8. `npm run verify` n'inclut pas la certification exhaustive 12 mois ; elle doit être lancée séparément.
9. Pas de test live de correction/invalidation actuelle ; le rollback live historique n'est pas équivalent à une correction Canonical.

---

# Q. Risques et constats consolidés

| ID | Constat | Niveau | Avant Global ? |
|---|---|---|---|
| `PUB-01` | History ne recalcule jamais à la navigation | solide | — |
| `PUB-02` | Finalize transactionnel et ancien actif jusqu'au commit | solide | — |
| `PUB-03` | rollback transactionnel vers ancienne génération complète | solide | — |
| `PUB-04` | 12/12 générations live complètes, sans doublons actifs | solide | — |
| `HASH-01` | mécanisme generic factsHash/manifest déterministe | solide | — |
| `HASH-02` | closure Bilan actuelle incomplète pour certains intrants | **structurel** | **oui** |
| `IMM-01` | aucun trigger DB d'immutabilité payload post-publish | structurel | recommandé |
| `TRACE-01` | manifestHash/factDependencies/implementation digest non persistés dans publication DB | structurel | **oui pour dependency graph robuste** |
| `CORR-01` | invalidation codée mais aucun caller produit | structurel | oui pour corrections/Import ; à prendre en compte Global |
| `CORR-02` | aucun orchestrateur invalidation → rebuild → republish | structurel | oui pour future architecture transverse |
| `CACHE-01` | cache client closed-month peut garder ancienne génération après republish | runtime/UX | recommandé avant correction utilisateur |
| `DEP-01` | entity invalidation fine sur Query mais coarse sur artifacts | architecture | à modéliser dans dependency matrix |
| `DEP-02` | global-reference peut invalider Query History futures sans même scope artifact | architecture | **oui** |
| `PUB-05` | exact absence de rows extra garantie app, pas Finalize SQL | hardening | recommandé |
| `PUB-06` | single-active principalement garanti par RPC + reader, pas unique partial constraint | hardening | recommandé |
| `RM-01` | Calendar top3 serveur vs top6 client | ReadModel/polish | avant freeze final History |
| `RM-02` | Places tronquées à 6 alors que UI prévoit « Voir tous » | ReadModel/UX | non bloquant Global |
| `RM-03` | stable IDs / Minimal labels techniques | ReadModel/UI | non bloquant Global |
| `PERF-01` | Journal ~54 KB moyen, principal poids des snapshots | perf | mesurer avant optimisation |

---

# R. A — SNAPSHOTS SOLIDES

Les éléments suivants peuvent être considérés comme de bonnes fondations :

1. **Deux artifacts communs History V2** : Calendar Semantic + Daily Economic Ledger.
2. **15 ressources Query** matérialisées avec contrats séparés, sans God RPC.
3. **365 Journals et 52 Weeks** actuellement snapshotés sur la fenêtre 12 mois.
4. **Hover imbriqué** dans Calendar/Week : aucun fetch au hover.
5. **Tous les principaux drill-downs** sont snapshotés et inclus dans la fermeture.
6. **RuntimeSchema avant publication et à la lecture**.
7. **PublicationMeta** réel et cohérent sur les 927 snapshots actifs live.
8. **factsHash commun** par génération active.
9. **Lecture History strictement publiée** : publication réelle, active, non invalidée, compatible.
10. **Pas de calcul Analytics au miss** : `TEMPORARY_UNAVAILABLE`.
11. **Finalization transactionnelle** avec contrôle de révision concurrente.
12. **Ancienne génération active pendant stage**.
13. **Rollback atomique** vers une publication antérieure.
14. **Historique des générations conservé** : preuve live de 4 générations publiées pour mai 2026.
15. **Cache closed-month `never`** approprié tant que la génération ne change pas.
16. **Pas de doublon logique actif live**.
17. **12 publications actives et complètes live** de 2025-08 à 2026-07.

---

# S. B — SNAPSHOTS / READMODELS À AJUSTER APRÈS POLISH UI/UX

Ces points ne justifient pas une refonte du moteur :

1. **Calendar markers** : décider contractuellement si Month expose 3 ou 6 markers. Le filtrage interactif doit rester client, mais le ReadModel ne doit pas conserver deux autorités contradictoires (`visibleMarkers` top3 vs projection UI top6).
2. **Hover compact** : décider si les limites top-N font partie du contrat certifié ou de la présentation.
3. **Places M4** : si « Voir tous » est conservé, ne pas tronquer la seule collection disponible à 6 avant React, ou ajouter une ressource de collection.
4. **Category Typical composition** : fournir des labels humains dans le ReadModel plutôt que laisser React afficher des stableIds.
5. **Minimal Preview** : fournir les labels de présentation attendus au lieu d'enums/identités techniques.
6. **Imported Summary** : raccorder plus tard le sidecar de résumé à la publication, sans l'intégrer au calcul déterministe History.
7. **Filtres Calendar** : éviter si souhaité une navigation serveur inutile lorsque seul le filtre client change.
8. **Payload Journal** : mesurer la composition des ~54 KB moyens avant toute tentative d'optimisation ; ne supprimer aucune donnée sans comprendre son usage.

---

# T. C — RISQUES STRUCTURELS À TRAITER AVANT ANALYSE GLOBALE

## T.1 Fermer réellement les dépendances Bilan

C'est le point prioritaire.

Le master Global va réutiliser des métriques History et dépendre de révisions/hashes fiables. Il ne faut pas propager une closure partielle.

À résoudre conceptuellement avant le gate Global :

```text
Typical
Minimal
Typical catégories
historique catégories
Activity costs
Moments
Visits / localized finance
classifications
```

et toute autre donnée qui peut modifier un ReadModel Bilan doit être représentée dans sa closure/hash.

## T.2 Rendre le dependency graph physique et durable

Le preflight sait déjà produire :

```text
factDependencies
externalQueryRefs
manifestHash
```

mais ces éléments ne sont pas attachés durablement comme manifest DB à la publication.

Analyse Globale exige justement une `GLOBAL_ANALYTICS_DEPENDENCY_MATRIX` physique : ce chantier doit éviter de créer un second système de dépendances sans lien avec History.

## T.3 Décider le niveau réel d'immutabilité FROZEN

Aujourd'hui le produit est append/new-generation, mais la DB autorise encore théoriquement un acteur service-role à modifier une row d'une publication passée.

Avant que plusieurs pipelines automatiques (Global, Swile, Import/Actualisation) écrivent dans les mêmes stores, cette frontière doit être explicitement décidée et certifiée.

## T.4 Concevoir le workflow Correction → Refresh

L'invalidation est disponible ; le rebuild orchestré ne l'est pas.

Avant de connecter une console Import/Actualisation ou des sources Swile/Edenred, il faut une doctrine claire :

```text
mutation intent
→ impact graph
→ scopes à reconstruire
→ ordre des builders
→ nouvelle publication
→ certification
→ switch
```

Cela ne signifie pas qu'il faut implémenter la Console Import avant Global ; au contraire, le Refresh Planner final doit connaître Global. Mais Global doit être construit de façon compatible avec cette mécanique.

## T.5 Cache client et changement de génération

Une correction publiée doit finir par être visible sans dépendre d'une vieille entrée `revalidate:never` conservée dans l'onglet.

Le mécanisme de génération/revision devra fournir une stratégie de purge/reload/pinning cohérente.

## T.6 Revoir les scopes d'invalidation avec Global

Les mappings actuels sont un bon début, mais :

- artifacts entity-scoped encore grossiers ;
- global-reference peut invalider largement les Query mensuelles futures ;
- Query et artifacts n'ont pas nécessairement le même impact physique ;
- aucune orchestration de rebuild n'utilise encore ces différences.

Le futur audit post-History Global doit partir de ce comportement réel, pas reconstruire un graphe théorique indépendant.

---

# U. Verdict final

## Pré-calcul

**PASS.** Les surfaces History majeures et leurs drill-downs sont réellement matérialisés avant consultation.

## Navigation sans calcul métier

**PASS.** Aucun `BUSINESS_CALCULATION`, `ANALYTICS` ou `SNAPSHOT_BUILD` n'est déclenché pour sauver une navigation History V2. Un miss échoue fermé.

## Publication atomique

**PASS.** Le Finalize est une transaction PostgreSQL avec révision concurrente et barrière de complétude.

## FROZEN_MONTH runtime

**PASS.** Mois fermé + publication + snapshot actif/frais + cache never + absence de read-through.

## FROZEN_MONTH immutabilité physique

**PARTIAL.** Le pipeline normal est générationnel et ne mute pas les payloads publiés, mais aucune protection DB absolue contre une mutation `service_role` d'une ancienne génération n'a été trouvée.

## Correction historique

**PARTIAL / NOT WIRED END-TO-END.** Le moteur d'invalidation existe ; le caller produit, Refresh Planner et rebuild automatique n'existent pas encore.

## Dependency closure

**PARTIAL.** La mécanique générique est solide ; les closures Bilan doivent être complétées avant de devenir une fondation Global certifiée.

## ReadModels/UI

**STABLE_WITH_TARGETED_ADJUSTMENTS.** Les besoins identifiés sont bornés : markers, Places « Voir tous », labels et quelques choix de projection.

## Readiness avant Analyse Globale

**BASE SOLIDE, GATE STRUCTUREL ENCORE À FERMER.**

L'Historique mensuel n'a pas besoin d'être reconstruit. Les points qui doivent être fermés avant de considérer son infrastructure comme une dépendance certifiée de Global sont principalement :

```text
1. closure/hash Bilan exhaustive
2. dependency graph / manifest durable
3. doctrine d'immutabilité publiée
4. comportement correction → invalidation → nouvelle publication
5. stratégie de changement de génération côté cache client
```

Les autres constats sont du polish ReadModel/UI ou de la performance mesurable ultérieurement.