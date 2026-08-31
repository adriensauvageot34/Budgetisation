# History V2 — ReadModels Calendar

Date de certification locale : 2026-08-30
Périmètre : Query/read-only History V2, sans frontend ni snapshot live.

## Gate d'entrée

Le gate requis est confirmé dans
`docs/history-v2/04-calendar-daily-finance-report.md` :

`CALENDAR_DAILY_ENGINE_GATE = PASS`

Les deux artifacts partagés sont donc les seules autorités utilisées par les
builders pour la doctrine Calendar et Daily Finance :

- `CalendarSemanticMonthArtifact` ;
- `DailyEconomicLedgerMonthArtifact`.

Le Brief technique FINAL CIBLE reste l'autorité fonctionnelle, technique et UX.
Le contrat ReadModels a été appliqué comme précision de payload sans retirer les
exigences Month, Hover, Week, Journal ou Overview du Brief.

## Architecture retenue

Le lot ajoute une couche de projection pure sous `src/query-api/history-v2/` :

```text
Canonical → Facts → Calendar/Daily artifacts → History V2 builders
          → RuntimeSchemas → Query Resource Registry
```

Les builders ne reconstituent ni fusion, ni absorption, ni continuité, ni date
économique. Ils projettent les décisions des artifacts et ajoutent uniquement
les contrats de lecture : grille, préfixes visibles, navigation, collections,
Quality/Visibility, références Query, fermeture de dépendances et sélection
Overview.

Le Calendar artifact expose désormais `orderedMarkerGroups` pour chaque jour.
Cette collection est l'ordre serveur complet : Month en prend les items 1–3 et
Week les items 1–6. Les anciens champs `markers` et
`hiddenMarkerGroupCount` restent disponibles comme projection Month directe.

## Ressources Query

Quatre ressources top-level sont déclarées en V2 :

| Ressource | Paramètres | Scope | Projection |
|---|---|---|---|
| `history_month_calendar` | `{}` | month | grille Month + Hover imbriqué |
| `history_week` | `{ weekStart }` | month du jeudi | 7 jours |
| `history_day_journal` | `{ date }` | month | Journal V2 |
| `history_month_overview` | `{}` | month | Quick Overview |

`DayHoverReadModel` et `EconomicExpenseSummary` restent imbriqués. Aucune
cinquième ressource autonome n'a été créée.

Les quatre ressources sont présentes dans :

- Resource Registry et normalisation des paramètres ;
- Resource Contract Registry avec `contractVersion=v2` ;
- ReadModel/Output Schema Registry ;
- Adapter Registry ;
- Capability Registry ;
- Query request/output coherence ;
- invalidation Month, entity et narrative ;
- signature de matérialisation par policies et métriques.

Toutes les anciennes ressources restent explicitement V1.

## PublicationMeta, factsHash et mode read-only

Chaque ReadModel porte :

- `resourceInputHash`, digest technique interne calculé sur les artifacts
  réellement consommés et les suppléments directs du builder ;
- l'union déterministe des `policyVersions` directes et héritées ;
- `publicationMeta` seulement lorsqu'une publication FROZEN_MONTH réelle est
  fournie.

Le RuntimeSchema vérifie qu'un `PublicationMeta` présent partage exactement les
policies de la ressource. Son `factsHash` est le hash commun de fermeture de la
publication et n'est volontairement pas comparé au `resourceInputHash` local.
L'enveloppe ApiMeta V2 récupère cette publication et refuse toujours une réponse
V2 qui n'en possède pas.

Le présent lot est read-only et le futur lot snapshots est explicitement hors
périmètre. Aucun faux `publicationId` n'est donc créé. Les builders peuvent être
certifiés en mémoire ; les sources Query finales renvoient temporairement
`TEMPORARY_UNAVAILABLE` tant qu'un snapshot FROZEN_MONTH réel n'est pas
disponible. Ce comportement est **DEFERRED par le contrat de publication**, et
non un fallback vers V1.

## Types et RuntimeSchemas

Les contrats principaux sont définis dans `src/query-api/history-v2/types.ts` :

- `SourceRef`, `QueryTargetRef` ;
- `PersonContextSummary`, `CalendarItemSummary` ;
- `EconomicExpenseSummary`, `DayHoverReadModel` ;
- `MonthCalendarReadModel`, `WeekReadModel` ;
- `JournalDayReadModel` et ses quatre sous-sections de mouvements ;
- `MonthQuickOverviewReadModel`, repères de vie et highlights.

`src/query-api/history-v2/schemas.ts` valide strictement :

- les clés autorisées et les discriminants ;
- MetricValue/CollectionValue, PARTIAL et `OBSERVED_ONLY` ;
- DisplayNode et Visibility ;
- les préfixes top 3/top 6 par rapport à `orderedMarkerGroups` ;
- 4 à 6 semaines Month, exactement 7 dates lundi-dimanche par row ;
- exactement 7 jours Week et `referenceMonth` égal au mois du jeudi ;
- lane Ribbon 1–4 et colonnes 1–7 ;
- montant positif des dépenses économiques humaines ;
- timeline avec heure uniquement dans la zone timed ;
- incompatibilité des policies de `PublicationMeta` avec la ressource.

## Builders

### Month Calendar serveur

`buildMonthCalendarReadModel()` construit une grille complète lundi-dimanche de
4 à 6 semaines. Les jours adjacents utilisent leurs artifacts mensuels, restent
interactifs, indiquent `targetMonth` et pointent vers le Journal de leur date
réelle. Une source adjacente absente devient UNKNOWN/PARTIAL ; aucune cellule ou
donnée métier n'est inventée.

Pour chaque jour :

- montant économique via Daily Ledger ;
- Contexts via Calendar Semantic, sans déduction Maison/congé/maladie ;
- `orderedMarkerGroups` inchangé ;
- top 3 exact ;
- `hiddenMarkerCount` exact si KNOWN, observé seulement si PARTIAL ;
- Ribbons actifs et Hover imbriqué ;
- référence Journal.

Deux Contexts contradictoires pour une même personne ne sont pas écrasés par un
`Object.fromEntries` : ils deviennent `DATA_CONFLICTING_AUTHORITIES`.

### Day Hover et EconomicExpenseSummary

Le Hover expose les Contexts, événements Calendar, Ribbons actifs, montant du
jour et jusqu'à trois dépenses économiques humaines.

Une dépense est projetée uniquement depuis `EconomicExpenseEvent` avec un
descripteur canonique affirmable. Son identité stable est `expenseEventId` ; le
builder n'utilise jamais marchand+date+montant, libellé ou proximité. Plusieurs
composantes d'un Purchase Event restent un seul item. Les montants négatifs,
refunds, inflows et mouvements techniques ne sont pas mélangés à cette
collection.

### Week serveur

`buildWeekReadModel()` exige un lundi, produit exactement sept jours et fixe
`referenceMonth` au mois du jeudi. Chaque jour prend les items 1–6 du même ordre
artifact que Month. Les IDs sont stables et aucune fusion locale n'est créée.

Les jours bi-mois consomment les deux artifacts et leur `artifactInputHash`. Les lanes
mensuelles sont conservées sans recompactage. Lorsque deux artifacts mensuels
participent à une même row, l'union Ribbon est explicitement `PARTIAL` : le
builder publie les lanes observées mais ne prétend pas posséder une fermeture de
lane hebdomadaire atomique. Le futur snapshot pourra figer cette fermeture sans
modifier le contrat du ReadModel.

### Journal V2

`buildJournalDayReadModel()` sépare strictement :

1. Contexts et événements continus ;
2. timeline avec heure canonique ;
3. événements sans heure ;
4. autres dépenses, remboursements/ajustements, inflows et mouvements
   techniques.

Un Ribbon n'est pas répété dans la timeline. Une dépense possédée par un Moment
n'est pas répétée dans “autres dépenses”. Le rattachement narratif vient
uniquement de `narrativeOwnerId` autoritaire.

`computeSpentDuring()` est une fonction serveur réutilisable fondée uniquement
sur la temporalité économique. Elle sélectionne les dépenses humaines dont
`economicDate`/`effectiveTime` appartient à la fenêtre du Moment, sans lire
`narrativeOwnerId` et sans exiger de lien causal. Le calcul déduplique les
événements sur leur `expenseEventId` stable et n'utilise jamais la date bancaire.

Pour une fenêtre multi-jours, des dates start/end fiables et une collection
temporelle complète donnent un montant KNOWN. Une couverture incomplète ne
publie que le montant observé en PARTIAL ; sans montant assigné affirmable, le
résultat reste UNKNOWN. Les composantes `unassignedEconomicAmount` ne sont
jamais réparties dans la fenêtre. Pour un Moment ponctuel, start/end time du
Moment et `effectiveTime` des dépenses sont nécessaires : une fenêtre horaire
absente est NOT_APPLICABLE et une temporalité de dépense insuffisante est
UNKNOWN/PARTIAL selon les observations disponibles.

`causalCost` conserve sa source autoritaire distincte dans
`causalCostByCalendarItemId`. `selectCausalExpenses()` conserve la sélection par
`narrativeOwnerId` pour le breakdown causal et la déduplication d'affichage du
Journal uniquement. Cette ownership ne filtre plus jamais `spentDuring`.

La navigation J-1/J+1 est calculée sur la date de route et reste disponible
indépendamment du contenu métier.

### Month Quick Overview

`buildMonthQuickOverviewReadModel()` expose :

- flux bancaires sortants ;
- Actual économique ;
- flux bancaires entrants ;
- cinq familles ordonnées de repères de vie lorsqu'elles sont réellement
  présentes ;
- jusqu'à cinq highlights déterministes ;
- le nombre total éligible qualifié.

Ordre des familles : voyage/séjour, visites importantes, conduite,
congé/repos, rythme de travail. Aucun zéro n'est ajouté pour remplir la grille.

Les highlights suivent l'ordre contractuel : priority band, classe narrative,
weight, continuité réelle, durée dans le mois, coût causal comparable, date,
identité stable. Les gros montants bruts ne deviennent jamais highlights sans
fait de vie autoritaire. L'Overview n'expose ni Typical, ni Minimal, ni rang, ni
résumé IA.

## Éléments réutilisés sans seconde source de vérité

Réutilisés :

- Calendar/Daily artifacts et leurs `artifactInputHash` internes ;
- contrats Quality/Visibility/Publication V2 ;
- Resource/Adapter/Capability registries ;
- Query normalization et materialization identity ;
- primitives dates, Money, identité et RuntimeSchema.

Non réutilisés comme doctrine :

- anciens builders `history_calendar_month` et `history_day_detail` ;
- tri/markers V1 ;
- date bancaire V1 ;
- agrégats Analysis Typical/Minimal.

Les ressources V1 restent disponibles comme oracle technique séparé mais ne
sont jamais servies sous le contrat V2.

## Exemples de payload

### Month — jour abrégé

```json
{
  "date": "2026-05-12",
  "inSelectedMonth": true,
  "targetMonth": "2026-05",
  "orderedMarkerGroups": { "status": "KNOWN", "items": ["…"], "totalCount": 7 },
  "visibleMarkers": ["items 1", "2", "3"],
  "hiddenMarkerCount": { "status": "KNOWN", "value": 4 },
  "journalRef": { "resource": "history_day_journal", "params": { "date": "2026-05-12" } }
}
```

### Week — abrégé

```json
{
  "weekStart": "2026-05-11",
  "weekEnd": "2026-05-17",
  "referenceMonth": "2026-05",
  "days": ["7 jours, top 6 du même ordre serveur"]
}
```

### Journal — abrégé

```json
{
  "date": "2026-05-12",
  "timedTimeline": { "visibility": "VISIBLE", "data": { "status": "KNOWN", "items": ["09:30"], "totalCount": 1 } },
  "untimedEvents": { "visibility": "VISIBLE", "data": { "status": "KNOWN", "items": ["sans startTime"], "totalCount": 1 } },
  "otherMovements": {
    "otherExpenses": "hors dépenses possédées par un Moment",
    "refundsAndAdjustments": "séparés",
    "inflows": "séparés",
    "technicalMovements": "séparés"
  }
}
```

### Overview — abrégé

```json
{
  "month": "2026-05",
  "flows": { "bankOutflows": "MetricNode", "economicActual": "MetricNode", "bankInflows": "MetricNode" },
  "lifeMarkers": "CollectionNode",
  "highlights": "CollectionNode top 5",
  "totalEligibleHighlights": { "status": "KNOWN", "value": 6 }
}
```

## Quality / Visibility

- CORE UNKNOWN/CONFLICT → PLACEHOLDER ;
- PARTIAL affirmable → VISIBLE avec Quality ;
- collection connue vide DETAIL/CONDITIONAL → HIDDEN ;
- UNKNOWN n'est jamais converti en zéro ;
- collection PARTIAL n'expose jamais `totalCount` ;
- `hiddenMarkerCount` et `hiddenExpenseCount` restent PARTIAL observés si la
  source l'est ;
- les données live sans autorité quotidienne restent UNKNOWN/unassigned et ne
  sont pas placées à la bank date.

## Tests et build

| Contrôle | Résultat |
|---|---|
| `check-history-v2-readmodels.mjs` | PASS — 21/21 |
| Calendar/Daily engines | PASS — 29/29 |
| contrats transversaux History V2 | PASS — 48 checks |
| Calendar/Day V1 | PASS |
| analytics materialization | PASS |
| product completeness | PASS |
| architecture imports | PASS — 458 fichiers |
| TypeScript `tsc --noEmit` | PASS |
| Next.js 16.2.6 production build | PASS |
| `git diff --check` | PASS |

Les tests discriminants couvrent : top 3, top 6, jour hors mois interactif,
lanes/overflow, grain Purchase Event, remboursement lié par son identité et sa
date économique, absence d'heure inventée, absence de duplication
Moment/dépense possédée, Overview sans Typical/Minimal/rang, ordre déterministe,
quatre ressources V2 exactes et rejet d'un PublicationMeta incompatible.

La correction `spentDuring` ajoute les preuves suivantes :

- Cas A : dépense pendant le Moment sans lien causal incluse dans
  `spentDuring`, absente de la sélection causale ;
- Cas B : dépense causale payée avant le Moment conservée dans la sélection
  causale, exclue de `spentDuring` ;
- Cas C : dépense causale dans la fenêtre présente dans les deux métriques et
  comptée une seule fois par `expenseEventId` dans `spentDuring` ;
- Cas D : couverture économique partielle/unassigned donnant PARTIAL sur la
  valeur observée ou UNKNOWN en l'absence d'observation, sans distribution ;
- Cas E : Moment ponctuel sans fenêtre horaire donnant NOT_APPLICABLE et dépense
  sans temporalité horaire donnant UNKNOWN même lorsque la fenêtre est précise.

## Différences V1 / V2

| Sujet | V1 | V2 |
|---|---|---|
| Calendar | projection locale historique | artifact Calendar Semantic autoritaire |
| finance jour | peut conserver bank date fallback | Daily Economic Ledger uniquement |
| qualité | Availability V1 | MetricValue/CollectionValue + PARTIAL |
| visibilité | implicite côté surface | DisplayNode décidé serveur |
| dépenses | opérations/bank movements | événements économiques humains stables |
| publication | contrat v1 | factsHash commun, policies par ressource, PublicationMeta FROZEN |
| Overview | résumé historique | flux + repères + highlights, sans Typical/Minimal/rang |

## Matrice de conformité au Brief

| Exigence | Preuve | Statut |
|---|---|---|
| Grille Month complète lundi-dimanche | `monthGrid`, schema 4–6 x 7 | PASS |
| Jour hors mois réel et interactif | artifact adjacent + `journalRef` date réelle | PASS |
| Month top 3 serveur | préfixe de `orderedMarkerGroups` | PASS |
| Week 7 jours/top 6 même ordre | `buildWeekReadModel`, test | PASS |
| referenceMonth = jeudi | builder + RuntimeSchema | PASS |
| Hover imbriqué, pas de ressource 16 | registry + types | PASS |
| ExpenseSummary au grain humain | `EconomicExpenseEvent.expenseEventId` | PASS |
| Ribbons lane/overflow distincts | artifact lanes + projections séparées | PASS |
| Row Ribbon bi-mois atomique | union sans invention de lane | PARTIAL explicite |
| Context absent non inventé | source structurée uniquement | PASS |
| Conflit Context non écrasé | `DATA_CONFLICTING_AUTHORITIES` | PASS |
| Journal sans heure inventée | séparation timed/untimed + schema | PASS |
| Moment/Ribbon/dépense non dupliqués | zones exclusives + ownership | PASS |
| causalCost distinct de spentDuring | causal par ownership explicite ; spentDuring par fenêtre économique uniquement ; cas A–C | PASS |
| refunds/inflows/techniques séparés | quatre collections Journal | PASS |
| Overview flux + cinq repères | builder et ordre fermé | PASS |
| Highlights déterministes | comparateur contractuel + ID stable | PASS |
| Aucun Typical/Minimal/rang/IA | type fermé + test sérialisé | PASS |
| Quality/Visibility serveur | policies partagées | PASS |
| hash interne / factsHash / policies séparés | builders + fermeture publication + schema | PASS |
| Publication finale | vrai PublicationMeta exigé | DEFERRED — lot snapshots |
| Aucun snapshot live/frontend | aucune écriture/import React | PASS |

## Nouvelles informations apprises

1. L'ancien `CalendarDayProjection.markers` ne contenait que le top 3 ; il ne
   pouvait donc pas alimenter Week top 6 sans recréer un tri. L'ajout de
   `orderedMarkerGroups` ferme cette divergence à la source.
2. Le Query Registry impose une décision exhaustive sur schema, adapter,
   capabilities et contrat : déclarer seulement une clé aurait créé une
   ressource partiellement active.
3. ApiMeta V2 exige déjà une vraie PublicationMeta. Le bon mode read-only est de
   produire `resourceInputHash`/policies sans publication, puis de différer le service
   final ; un identifiant “draft” aurait violé le contrat.
4. Les artifacts Calendar mensuels attribuent les lanes indépendamment. Une row
   bi-mois doit donc conserver une qualification PARTIAL tant qu'une fermeture
   hebdomadaire atomique n'est pas gelée par le lot snapshot.
5. L'ownership narrative est une autorité de causalité et une règle de placement
   du Journal ; elle ne constitue aucune preuve temporelle pour `spentDuring`.
   Les deux axes doivent rester orthogonaux jusque dans les fonctions serveur.

## Gaps et dette restante

1. Le lot snapshots doit persister les deux artifacts et les quatre ReadModels,
   allouer les PublicationMeta FROZEN_MONTH réels et remplacer le gate temporaire
   des sources Query par des lecteurs de publication.
2. Le loader snapshot devra fournir les descripteurs canoniques de dépenses,
   mouvements bancaires séparés, ownership narratif, coûts causaux, lieux et
   identités personnes. Les builders refusent d'inventer ces informations.
3. Une fermeture Ribbon hebdomadaire atomique est nécessaire pour faire passer
   la projection bi-mois de PARTIAL à KNOWN sans recalcul local de lane.
4. Les données Purchase Event/timing live restent peu ou pas alimentées selon le
   rapport 04 ; cette limitation doit continuer à apparaître en
   unassigned/PARTIAL/UNKNOWN.
5. Un Moment ponctuel ne pourra publier `spentDuring` que lorsque sa fenêtre de
   début/fin et l'heure économique des dépenses seront toutes deux autoritaires.
   D'ici là, le contrat impose NOT_APPLICABLE/UNKNOWN plutôt qu'une approximation.

## Fichiers du lot

Créés :

- `src/query-api/history-v2/types.ts`
- `src/query-api/history-v2/builders.ts`
- `src/query-api/history-v2/schemas.ts`
- `src/query-api/history-v2/index.ts`
- `src/server/query/sources/history-v2.ts`
- `scripts/check-history-v2-readmodels.mjs`
- `docs/history-v2/05-history-readmodels-report.md`

Adaptés :

- `src/analytics/history-v2/calendar/types.ts`
- `src/analytics/history-v2/calendar/engine.ts`
- `src/analytics/history-v2/calendar/schemas.ts`
- `src/query-api/request/read-model-params.ts`
- `src/query-api/request/resource-registry.ts`
- `src/query-api/request/resource-contract.ts`
- `src/query-api/request/index.ts`
- `src/query-api/read-model-registry.ts`
- `src/query-api/capabilities/registry.ts`
- `src/query-api/server/types.ts`
- `src/query-api/server/adapter-registry.ts`
- `src/query-api/server/validation.ts`
- `src/query-api/server/invalidation.ts`
- `src/query-api/server/execute-query.ts`
- `src/query-api/index.ts`
- `src/server/query/sources/index.ts`
- `src/server/query/runtime.ts`
- `scripts/check-history-v2-transversal-contracts.mjs`
- `package.json`

## Correction contractuelle — factsHash de publication

Les quatre builders ReadModels n'exposent plus leur fermeture locale comme un
`factsHash`. Ils exposent `resourceInputHash`, explicitement non contractuel. Un
vrai `PublicationMeta` peut porter un hash commun différent, à condition de
respecter les policies propres à la ressource. Le test ReadModels prouve ce cas
et refuse toujours une divergence de policies.

La fermeture mensuelle commune est calculée hors builder sur l'union des deux
artifacts, des quinze ressources, des drill-down atteignables, des faits directs
et des dépendances historiques. Ainsi, un fait Place Detail modifie également
le `factsHash` publié de Month Calendar sans faire croire que leurs entrées
locales sont identiques.

Preuves : `History V2 transversal contracts: PASS (48 checks)`, `History V2
ReadModels: 22/22 checks PASS`, Calendar/Daily `29/29`, Month Balance `61/61`.

## Gate final

HISTORY_READMODELS_GATE = PASS
