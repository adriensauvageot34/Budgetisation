# History V2 — rapport maître de compréhension et de readiness

> **Nature du document** : consolidation descriptive et décisionnelle des audits History V2. Aucune modification applicative, aucun changement de migration et aucune écriture de donnée métier ne sont réalisés dans ce lot.
>
> **Baseline code auditée** : branche `main`, commit `4899a2bc2d1b558fa46f143d01f929a50b8b0125` (`docs(history-v2): audit snapshots publications runtime`).
>
> **Sources consolidées** : runtime et code courants ; migrations et stores Supabase accessibles ; audits `20-current-runtime-architecture-audit.md`, `21-calendar-week-day-ui-ux-audit.md`, `22-month-review-ui-ux-data-audit.md`, `23-snapshots-publications-runtime-audit.md` ; rapports History V2 `01` à `20` présents dans `docs/history-v2/` ; contrats et autorités History V2 référencés par ces rapports.
>
> **Contrôle live effectué pour ce rapport** : lectures SELECT-only. État observé au moment de l’audit : `data_revision=1`, `analytics_revision=67`, `12` publications V2 actives, `24` artifacts V2 actifs, `927` Query snapshots V2 actifs, `analytics_change_log=0`.
>
> **Limite Git** : le connecteur GitHub permet de prouver le diff distant entre commits mais pas d’observer un éventuel working tree local non poussé sur une machine Codex. La preuve finale porte donc sur le dépôt distant et le commit audité.

---

# 0. Réponse courte à la question maître

La base Historique mensuel disponible aujourd’hui est **une vraie architecture V2 pré-calculée, snapshot-first, versionnée, publiée et servie sans recalcul métier à la navigation**. Elle n’est plus un prototype et ne doit pas être reconstruite.

Les parties les plus solides sont :

- Canonical/Facts économiques et temporels déjà partagés ;
- moteurs Calendar et Daily Economic ;
- Calendar, Week, Journal, Hover ;
- Query API et RuntimeSchemas ;
- fermeture récursive des drill-downs ;
- stockage en `analytics_artifacts` / `analytics_query_snapshots` ;
- publication transactionnelle par génération ;
- absence de read-through History V2 sur un miss ;
- cohérence Actual Calendar ↔ Journal ↔ Bilan ;
- architecture React sans recalcul des KPI Analytics.

Ce qui empêche encore de déclarer History totalement figé avant Analyse Globale n’est **pas** un manque d’écrans. Le gate restant est concentré sur cinq thèmes :

1. fermer exhaustivement les dépendances du Bilan et réaligner la construction des snapshots avec les Analytics/Facts officiels ;
2. rendre durable la preuve de dépendances/manifest d’une publication ;
3. décider et durcir l’immutabilité réelle d’une génération publiée ;
4. démontrer un chemin contrôlé `correction historique → invalidation → nouvelle génération → republish` ;
5. garantir qu’un changement de génération ne laisse pas un ancien snapshot `revalidate: never` bloqué dans le cache client.

À côté de ce gate structurel, les restes sont bornés : quelques ajustements de ReadModel, quelques ambiguïtés UI/UX, le responsive/accessibilité, puis une recertification 12 mois.

**Conclusion maître : `READY_AFTER_MINOR_HISTORY_WORK` pour Analyse Globale**, avec une nuance importante : le volume de travail restant est limité, mais certains points sont structurels et doivent réellement être fermés avant de faire de History une dépendance certifiée de Global.

---

# 1. Base réelle aujourd’hui

## 1.1 Runtime produit

Le chemin de consultation réel est :

```text
Utilisateur
↓
/historique ou /historique/[month]
↓
RSC route History
↓
Query API / executeAuthenticatedQueries
↓
SupabaseAnalyticsMaterializationStore
↓
analytics_query_snapshots
↓
publication publiée + snapshot actif + non invalidé + compatible + frais
↓
RuntimeSchema de la ressource
↓
ReadModel History V2
↓
React Client Components
↓
UI Calendar / Week / Journal / Bilan / overlays
```

Le chemin de construction est distinct :

```text
Canonical
↓
Facts
↓
Analytics / moteurs History et communs
↓
2 artifacts mensuels partagés
↓
ReadModel builders
↓
RuntimeSchemas
↓
preflight + fermeture des QueryTargetRef
↓
DRAFT
↓
stage inactif
↓
validation / certification
↓
activation transactionnelle
↓
FROZEN_MONTH servi au produit
```

En cas de miss d’un snapshot History V2, le runtime **échoue fermé** avec `TEMPORARY_UNAVAILABLE`. Il ne fabrique pas le ReadModel depuis Canonical/Analytics pour sauver la navigation.

## 1.2 Couverture live

État live relu en SELECT-only pendant ce rapport :

| Élément | État |
|---|---:|
| Mois actifs | 12 |
| Fenêtre | 2025-08 → 2026-07 |
| Publications V2 actives | 12 |
| Artifacts V2 actifs | 24 |
| Query snapshots V2 actifs | 927 |
| `data_revision` | 1 |
| `analytics_revision` | 67 |
| `analytics_change_log` | 0 ligne |

Les deux artifacts sont :

```text
calendar_semantic_month
daily_economic_ledger_month
```

Les quinze familles Query sont :

```text
history_month_calendar
history_week
history_day_journal
history_month_overview
history_month_balance_summary
history_bank_economy_bridge
history_month_categories
history_category_detail
history_month_spending_nature
history_spending_segment_detail
history_minimal_preview
history_month_life_money
history_activity_detail
history_moment_detail
history_place_detail
```

## 1.3 Ce qui est déjà figé conceptuellement

Les principes suivants peuvent être considérés comme acquis :

- un mois fermé n’est pas recalculé lors de la consultation ;
- une génération doit être explicitement publiée ;
- les Query History V2 sont versionnées et RuntimeSchema-validées ;
- les drill-downs référencés font partie de la fermeture des snapshots ;
- l’Actual mensuel et le Daily Economic Ledger partagent la même autorité ;
- Calendar et Journal ne doivent jamais utiliser la date bancaire comme date économique de secours ;
- `causalCost` et `spentDuring` sont des concepts distincts dans l’UI ;
- présence d’une personne, lieu de transaction et présence géographique restent des notions différentes ;
- React ne doit pas recalculer Actual, Typical, Minimal, matérialité, classement métier ou causalité ;
- une nouvelle génération doit remplacer l’ancienne par activation, pas par modification silencieuse du payload actif.

---

# 2. Matrice des capacités

Légende :

- `YES` : implémenté et observé dans le runtime courant ;
- `PARTIAL` : base présente mais contrat, alimentation ou expérience incomplète ;
- `N/A` : notion non pertinente à cette ligne ;
- `POLISH` : fonctionnel mais avec finition UI/UX restante ;
- la colonne `CERTIFIÉE ?` distingue la présence d’un vrai gate de certification de la qualité de fermeture sémantique réellement auditée.

| CAPACITÉ | IMPLÉMENTÉE ? | FONCTIONNELLE ? | SNAPSHOTÉE ? | CERTIFIÉE ? | UI OK ? | UX OK ? | TESTÉE ? | RISQUE | ACTION RESTANTE |
|---|---|---|---|---|---|---|---|---|---|
| Sélection du mois | YES | YES | Indirectement via mois publiés | YES pour dernier mois publié | YES | POLISH | YES | MEDIUM | Borner les flèches aux mois réellement publiés/éligibles |
| Calendar mensuel | YES | YES | YES | PARTIAL : moteur solide, contrat top3/top6 à trancher | YES desktop | POLISH | YES | MEDIUM | Décider l’autorité de limite markers puis réaligner ReadModel/UI |
| Cellule jour | YES | YES | YES dans Calendar | YES | YES | YES/POLISH | YES | LOW | Clarifier certains états PARTIAL compacts |
| Hover / preview jour | YES | YES | YES, imbriqué Month/Week | YES | YES desktop | POLISH tactile | YES | LOW/MEDIUM | Conserver ou expliciter la doctrine de preview tactile ; clarifier top-N présentationnel |
| Vue semaine | YES | YES | YES | YES | YES | POLISH | YES | MEDIUM | Rendre l’entrée Week visible sans dépendre du hover ; responsive |
| Journal du jour | YES | YES | YES, 365 actifs | YES | YES | POLISH | YES | LOW/MEDIUM | Affordances, responsive, éventuellement prefetch après mesure |
| DailyEconomic | YES | YES | YES, artifact mensuel | YES | N/A direct | N/A direct | YES | LOW | Conserver comme autorité commune Calendar/Journal/M1 |
| Aperçu mensuel | YES | YES | YES | YES | YES | YES/POLISH | YES | LOW | Aucun gate structurel ; polish éventuel |
| Bilan M1 | YES | YES | YES | PARTIAL | YES | YES | YES | HIGH | Réaligner Typical/Minimal/historique sur Analytics/Facts officiels + closure complète |
| Bilan M2 | YES | YES pour cœur Category | YES | PARTIAL | YES | YES/POLISH | YES | HIGH | Fermer dépendances ; alimenter ou assumer explicitement les enrichissements encore neutralisés |
| Bilan M3 | YES | YES | YES | PARTIAL | YES | POLISH | YES | HIGH | Sortir la normalisation de classification du script de certification ; fermer la dependency closure |
| Bilan M4 | YES | YES | YES | PARTIAL | YES | YES/POLISH | YES | HIGH | Revoir authority de `causalCost`, Activity enrichments et Place scoring/coverage |
| Drill-downs | YES | YES | YES | YES structurellement | YES | YES | YES | MEDIUM | Quelques payloads/labels à enrichir ; pas de refonte navigation |
| Moments | YES | YES | YES | PARTIAL sur coût causal | YES | YES | YES | HIGH | Expliciter la preuve/autorité de causalité financière |
| Life Events | YES | YES | YES via Calendar/Week/Journal/M4 refs | YES | YES | YES | YES | LOW | Aucun blocage majeur identifié |
| Activités | YES | YES | YES | PARTIAL | YES | POLISH | YES | MEDIUM/HIGH | Raccorder les enrichissements réellement promis et séparer ceux différés |
| Lieux | YES | YES | YES | PARTIAL | YES | POLISH | YES | HIGH | Corriger scoring/coverage simplifiés et contrat “Voir tous” |
| Participants | PARTIAL | YES dans plusieurs surfaces | PARTIAL | PARTIAL | PARTIAL | POLISH | PARTIAL | MEDIUM | Clarifier le contrat Activity/participant ; ne pas inventer de rôle absent |
| Actual | YES | YES | YES | YES | YES | YES | YES | LOW | Fondation stable |
| Typical | YES | YES à l’affichage | YES | PARTIAL | YES | YES | YES | HIGH | Retirer l’oracle comme source de construction publiée ; garder l’oracle comme test seulement |
| Minimal | YES | YES à l’affichage | YES | PARTIAL | POLISH | YES | YES | HIGH | Même réalignement Analytics + labels humains du preview |
| Catégories | YES | YES | YES | YES sur réconciliation, PARTIAL enrichissements | YES | YES | YES | MEDIUM/HIGH | Labels de composition + closure + enrichissements ciblés |
| Needs | PARTIAL, comme source Minimal | PARTIAL, pas de module autonome | Indirect via Minimal | PARTIAL | Aucun écran autonome | N/A | PARTIAL | LOW/UNKNOWN | Confirmer que l’absence de vue autonome est bien le scope produit ; ne pas créer d’écran par supposition |
| Snapshots | YES | YES | N/A | YES mécanisme, PARTIAL contenu Bilan | N/A | N/A | YES | HIGH avant Global | Rebuild après H1/H2, puis recertification complète |
| Publication | YES | YES | N/A | YES atomique | N/A | N/A | YES | MEDIUM/HIGH | Manifest durable, immutabilité, correction/republication |
| FROZEN_MONTH | YES runtime | YES | YES | PARTIAL physique | N/A | N/A | YES | HIGH | Durcir la doctrine post-publish et tester correction réelle |
| RuntimeSchemas | YES | YES | N/A | YES | N/A | N/A | YES | LOW | Conserver le gate sur chaque payload et chaque lecture |
| Diagnostic History | PARTIAL | Diagnostic générique V2 seulement | N/A | N/A | YES générique | N/A | PARTIAL via scripts | MEDIUM | Ajouter plus tard des checks History dédiés ; les scripts actuels restent la preuve principale |
| Query API | YES | YES | Lit les snapshots | YES | N/A | N/A | YES | LOW | Fondation stable ; gérer changement de génération côté cache client |
| Responsive | PARTIAL/NO | Desktop oui | N/A | N/A | NO mobile réel | NO mobile réel | PARTIAL | MEDIUM | Retirer la dépendance fonctionnelle à `min-width:1040px` et définir layouts petits écrans |
| Accessibilité | PARTIAL | YES au clavier de base | N/A | N/A | POLISH | POLISH | PARTIAL | MEDIUM | Tabs ARIA complets, discoverability Week, touch/hover, overflow et focus |
| Performance | YES fonctionnellement | YES | N/A | N/A | YES | YES | PARTIAL, pas de profil complet | MEDIUM | Mesurer Journal et round-trips ; ne pas optimiser sans preuve |

## 2.1 Lecture de la matrice

La matrice montre trois groupes très différents :

### Groupe A — réellement terminé comme fondation

```text
Actual
DailyEconomic
Calendar semantics
Week model
Journal model
Query API
RuntimeSchemas
snapshot-first runtime
publication atomique
navigation overlay/deep links
```

### Groupe B — terminé fonctionnellement mais à figer contractuellement

```text
Calendar markers top3/top6
ReadModels de labels/densité
Places “Voir tous”
responsive/accessibilité
PARTIAL compact
```

### Groupe C — fonctionnel mais pas encore suffisamment autoritaire pour Global

```text
Typical / Minimal publiés
Bilan dependency closure
normalisation M3
Moment causal authority
Place scoring/coverage
correction historique et nouvelle génération
manifest durable / immutabilité
cache après republish
```

---

# 3. Classification unique des restes

Chaque entrée ci-dessous appartient à **une seule catégorie** parmi celles demandées.

| ID | Problème restant | Catégorie | Sévérité | Échéance | Commentaire |
|---|---|---|---|---|---|
| HREM-01 | Closure `resourceInputHash` / facts du Bilan non exhaustive pour tous les intrants réellement utilisés | ANALYTICS_FIX | HIGH | BEFORE_GLOBAL | Risque principal pour la fiabilité des dépendances de Global |
| HREM-02 | Construction certifiée de Typical/Minimal/Typical Category/historique encore alimentée en partie par l’oracle de certification | ANALYTICS_FIX | HIGH | BEFORE_GLOBAL | L’oracle doit redevenir seulement une référence de test, pas la source publiée |
| HREM-03 | Normalisation Necessity/Behavior/LifeScope située dans le script de certification | ANALYTICS_FIX | HIGH | BEFORE_GLOBAL | Doctrine métier à déplacer/centraliser dans Facts/Analytics versionnés |
| HREM-04 | `causalCost` Moment utilise une dimension `fact.moment` sans preuve causale explicitée assez fortement dans le type | ANALYTICS_FIX | HIGH | BEFORE_GLOBAL | Global ne doit pas hériter d’une causalité implicite |
| HREM-05 | Place scoring/coverage publiés avec simplifications/hardcodes par rapport au moteur disponible | ANALYTICS_FIX | HIGH | BEFORE_GLOBAL | Les sorties Place pourront devenir des signaux Global ; stabiliser l’autorité d’abord |
| HREM-06 | Activity Detail a des enrichissements non alimentés (`frequencyTicket`, liens place/category, ASSOCIATED) | ANALYTICS_FIX | MEDIUM | BEFORE_GLOBAL | Séparer ce qui est requis maintenant de ce qui peut rester UNKNOWN par contrat |
| HREM-07 | Frequency/ticket et lifecycle Category sont prévus mais neutralisés dans le builder courant | ANALYTICS_FIX | MEDIUM | BEFORE_GLOBAL | À brancher si les sources existent, sinon rendre l’état différé explicitement contractuel |
| HREM-08 | Merchant/purchase drivers Category restent vides | ANALYTICS_FIX | MEDIUM | BEFORE_SWILE | Peut légitimement attendre l’extension PurchaseEvent/Benefit Wallet |
| HREM-09 | Calendar Month publie top3 mais React projette jusqu’à 6 | READMODEL_ADJUSTMENT | MEDIUM | BEFORE_GLOBAL | Décision produit puis une seule autorité |
| HREM-10 | M4 tronque Places à 6 alors que l’UI prévoit “Voir tous” | READMODEL_ADJUSTMENT | MEDIUM | BEFORE_GLOBAL | Soit retirer l’affordance, soit exposer une collection/ressource réellement exhaustive |
| HREM-11 | Composition Typical Category expose `stableId` sans label humain | READMODEL_ADJUSTMENT | MEDIUM | BEFORE_GLOBAL | Le label doit venir du ReadModel, pas d’un lookup React |
| HREM-12 | Minimal Preview expose des enums/identifiants techniques | READMODEL_ADJUSTMENT | MEDIUM | BEFORE_GLOBAL | Ajouter le libellé certifié au ReadModel |
| HREM-13 | `importedSummary` reste forcé à `MISSING` | READMODEL_ADJUSTMENT | LOW | CAN_WAIT | Différé attendu jusqu’au chantier Résumé contextuel |
| HREM-14 | Activity participants ne sont pas exposés partout où les Facts les possèdent potentiellement | READMODEL_ADJUSTMENT | MEDIUM | CAN_WAIT | À faire seulement si le brief History l’exige réellement ; ne pas inventer les rôles |
| HREM-15 | Navigation mois ±1 non bornée aux publications disponibles | QUERY_ADJUSTMENT | MEDIUM | BEFORE_GLOBAL | Éviter une erreur technique sur une simple navigation utilisateur |
| HREM-16 | Cache client `revalidate:never` peut conserver une ancienne génération après republish | QUERY_ADJUSTMENT | HIGH | BEFORE_GLOBAL | Il faut une stratégie de révision/purge/reload/pinning |
| HREM-17 | Mauvais champ rendu sous “Résiduel” dans le Bridge (`result` au lieu de `residual`) | UI_POLISH | MEDIUM | BEFORE_GLOBAL | Donnée correcte déjà dans le ReadModel |
| HREM-18 | Margins M3 affichent “Au moins” même lorsque la valeur est KNOWN | UI_POLISH | MEDIUM | BEFORE_GLOBAL | UI-only : le statut est déjà publié |
| HREM-19 | PARTIAL peut devenir visuellement presque identique à KNOWN en vue compacte | UI_POLISH | MEDIUM | BEFORE_GLOBAL | Rendre la qualité perceptible sans surcharger |
| HREM-20 | `bankInflows` existe dans l’Overview mais n’est pas affiché dans le shell/Bilan | UI_POLISH | LOW | CAN_WAIT | Décision de produit, pas un défaut de données |
| HREM-21 | Layout History reste `min-width:1040px` sans vraie recomposition petits écrans | UI_POLISH | MEDIUM | BEFORE_GLOBAL | La surface peut fonctionner desktop, mais History n’est pas finie côté responsive |
| HREM-22 | Entrée Week peu découvrable sur tactile | UX_POLISH | MEDIUM | BEFORE_GLOBAL | Rendre l’action visible sans dépendre de `hover` |
| HREM-23 | Hover n’a pas de vraie preview tactile | UX_POLISH | LOW | CAN_WAIT | Le Journal reste accessible ; définir si une preview tactile est réellement voulue |
| HREM-24 | Tabs et certains contrôles n’implémentent pas tout le pattern clavier ARIA attendu | UX_POLISH | LOW/MEDIUM | BEFORE_GLOBAL | Compléter sans refonte du contenu |
| HREM-25 | Certains éléments Journal/dense content ont une affordance de détail perfectible | UX_POLISH | LOW | CAN_WAIT | Pas de changement de modèle requis sauf besoin confirmé |
| HREM-26 | Les snapshots actifs actuels devront être reconstruits après les corrections H1/H2, pas patchés | SNAPSHOT_ADJUSTMENT | HIGH | BEFORE_GLOBAL | Republish complète et nouvelle génération requises |
| HREM-27 | Le manifest détaillé (`manifestHash`, `factDependencies`, `externalQueryRefs`, digest implémentation) n’est pas durablement rattaché à la publication live | PUBLICATION_FIX | HIGH | BEFORE_GLOBAL | Nécessaire pour un dependency graph robuste partagé avec Global |
| HREM-28 | Aucune protection DB absolue repérée contre `UPDATE payload` privilégié d’une publication déjà publiée | PUBLICATION_FIX | HIGH | BEFORE_GLOBAL | Durcir ou certifier explicitement l’immutabilité de la génération publiée |
| HREM-29 | `recordAnalyticsMutation` existe mais aucun workflow produit complet correction → invalidation → rebuild → republish n’est branché | PUBLICATION_FIX | HIGH | BEFORE_GLOBAL | Une version History-specific testable suffit avant le Refresh Planner final transverse |
| HREM-30 | Finalize ne prouve pas directement l’absence de rows extra dans une DRAFT | PUBLICATION_FIX | MEDIUM | BEFORE_IMPORT | Hardening avant multiplication des pipelines d’écriture |
| HREM-31 | Single-active est principalement garanti par RPC/reader plutôt que par une contrainte unique physique générale | PUBLICATION_FIX | MEDIUM | BEFORE_IMPORT | Peut rester une garantie transactionnelle si elle est explicitement certifiée |
| HREM-32 | Pas d’E2E correction Canonical → invalidation → nouvelle publication → lecture UI fraîche | TEST_COVERAGE | HIGH | BEFORE_GLOBAL | Test majeur de la future stabilité de History |
| HREM-33 | Certification exhaustive 12 mois n’est pas incluse dans `npm run verify` | TEST_COVERAGE | MEDIUM | BEFORE_GLOBAL | Peut rester un gate séparé, mais doit être obligatoire dans la DoR |
| HREM-34 | Pas de test de purge du cache client après changement de génération | TEST_COVERAGE | HIGH | BEFORE_GLOBAL | À créer en même temps que HREM-16 |
| HREM-35 | Pas de budget automatique payload / round-trip | TEST_COVERAGE | LOW | CAN_WAIT | Instrumenter si la latence devient un problème réel |
| HREM-36 | Diagnostic produit n’expose pas encore de checks History dédiés de publication/immutabilité/freshness | TEST_COVERAGE | MEDIUM | BEFORE_IMPORT | Les scripts actuels suffisent pour le gate Global, le Diagnostic UI peut venir ensuite |
| HREM-37 | Journal représente ~54 KB JSONB par jour en moyenne, sans profiling détaillé | SNAPSHOT_ADJUSTMENT | LOW | CAN_WAIT | Mesurer avant de retirer quoi que ce soit |
| HREM-38 | Signatures History anciennes restent explicitement acceptées pendant la transition | LEGACY_CLEANUP | MEDIUM | BEFORE_GLOBAL | Après republish finale current-only, réévaluer si elles sont encore nécessaires |
| HREM-39 | Champs ReadModel préparés mais parfois plus consommés (`visibleMarkers`, `hiddenMarkerCount`, `unassignedTiming` selon surface) | LEGACY_CLEANUP | LOW | BEFORE_GLOBAL | Nettoyer uniquement après décision de contrat finale |
| HREM-40 | Existence d’un “module Needs autonome” n’est pas démontrée dans le runtime actuel | UNKNOWN | LOW | CAN_WAIT | Ne pas transformer une attente de vocabulaire en fonctionnalité inventée |

## 3.1 Absence de `DATA_FIX` confirmée

Aucun défaut de donnée Canonical certain n’a été mis en évidence par les quatre audits comme cause principale d’un bug History actuel. Les états `DATA_MISSING`, `PARTIAL`, `UNKNOWN` observés sont dans plusieurs cas des états légitimes du contrat.

Il serait donc incorrect de “corriger les données” pour faire disparaître artificiellement un UNKNOWN sans preuve Canonical.

---

# 4. Ne pas confondre polish et architecture

## 4.1 Détails visuels qui semblent importants mais ne nécessitent aucun changement de données

Ces sujets peuvent être corrigés sans toucher Facts, Analytics, ReadModels ou snapshots lorsqu’ils sont traités dans leur forme minimale :

| Sujet | Pourquoi c’est UI/UX seulement |
|---|---|
| Bridge : “Résiduel” affiche le mauvais champ | `bridge.residual` existe déjà dans le ReadModel |
| M3 : “Au moins” sur une valeur KNOWN | le statut KNOWN/PARTIAL existe déjà |
| PARTIAL compact trop discret | le MetricValue porte déjà status/partialMeaning |
| Discoverability du bouton Week | la ressource Week et la navigation existent déjà |
| Focus/ARIA des tabs | aucune nouvelle donnée n’est nécessaire |
| Alignements, spacing, hauteur des cartes | présentation pure |
| Styles focus/hover/active | présentation pure |
| Format euros/décimales | formateurs existants, choix d’affichage |
| Précision d’un pourcentage actuellement arrondi | la part serveur existe déjà ; React ne doit que la formater |
| Responsive simple des grids | CSS/layout seulement tant que la densité métier reste identique |
| Navigation vers un mois indisponible rendue plus explicite | peut être résolue par une petite source availability/route, sans changer les analytics |
| `bankInflows` non affiché | la donnée est déjà snapshotée ; décision UI |

## 4.2 Détails UI/UX qui révèlent en réalité un contrat ReadModel/snapshot insuffisant

Ces sujets **ne doivent pas** être “réparés” avec un bricolage React :

| Sujet visible | Problème réel sous-jacent |
|---|---|
| Calendar affiche 6 markers alors que la projection Month publiée en prépare 3 | deux autorités concurrentes sur la densité de cellule ; contrat ReadModel à trancher |
| “Voir tous les lieux” ne mène jamais à plus de 6 lieux | la seule collection publiée est déjà tronquée ; UI seule ne peut pas inventer la suite |
| Composition Typical montre des stableIds | le ReadModel ne porte pas le libellé de présentation certifié |
| Minimal affiche des enums / clés techniques | le ReadModel manque de labels orientés produit |
| Activity voudrait montrer certains participants/relations | le contrat du détail doit porter l’identité et le type de relation autorisés |
| Un changement de génération n’est pas visible dans un onglet déjà caché | la Query/cache identity ne tient pas encore assez compte de la publication active côté client |
| Une future correction doit montrer une nouvelle vérité History | il faut une nouvelle publication + invalidation + stratégie de cache, pas un state React local |
| Le Bilan paraît certifié mais un intrant peut changer sans être dans sa closure | problème de contrat publication/facts hash, pas de rendu |

Règle pour la finition History :

> **Toute information métier nécessaire à une décision de présentation doit être publiée dans le ReadModel avec sa qualité, son identité et sa provenance. React peut filtrer, paginer visuellement, formatter ou ouvrir/fermer ; il ne doit pas restaurer une autorité métier manquante.**

---

# 5. Stabilité des fondations

| Fondation | État | Motif |
|---|---|---|
| Facts | `STABLE_WITH_MINOR_WORK` | EconomicComponent, PurchaseEvent, ActivityOccurrence, PersonDay, PlaceVisit et temporalité sont de vraies fondations partagées. Le point à verrouiller est surtout l’usage causal Moment et quelques projections participants, pas une refonte des Facts. |
| Analytics communs | `NOT_YET_STABLE` | Les moteurs sont riches et testés, mais le chemin publié du Bilan reste partiellement oracle/script-owned. Ce point doit être fermé avant Global pour éviter deux autorités. |
| ReadModels | `STABLE_WITH_MINOR_WORK` | 15 ressources V2, RuntimeSchemas stricts, structures cohérentes. Les écarts sont ciblés : markers, labels, Places, quelques enrichissements. |
| Snapshots | `STABLE_WITH_MINOR_WORK` | Infrastructure et couverture solides ; les contenus Bilan devront être republiés après correction de closure/authority. |
| Publication | `STABLE_WITH_MINOR_WORK` | Finalize et rollback atomiques sont solides. Restent manifest durable, immutabilité physique et correction/republication. |
| Query layer | `STABLE` | Snapshot-first, miss fermé, batch SSR, cache client, in-flight dedup, RuntimeSchema. Le seul point majeur restant est le changement de génération dans le cache. |
| React architecture | `STABLE` | Pas de recalcul des KPI/Analytics ; projections client essentiellement présentationnelles. |
| UI | `STABLE_WITH_MINOR_WORK` | Desktop cohérent ; labels et petits bugs bornés. Le responsive n’est pas terminé. |
| UX | `STABLE_WITH_MINOR_WORK` | Navigation overlays/focus/deep links solide ; Week/touch/mobile/qualité compacte restent à polir. |
| Diagnostic | `NOT_YET_STABLE` | Route Diagnostic V2 générique existante, mais pas encore de vraie batterie produit History dédiée. Les scripts servent aujourd’hui de gate technique. |

## 5.1 Ce qui peut déjà être réutilisé sans hésitation par les autres chantiers

- `CanonicalRepository` et FactSourceResolver ;
- les types de qualité/visibilité ;
- PublicationMeta et RuntimeSchemas ;
- Query API et normalisation des scopes ;
- pattern de matérialisation ;
- génération/publish transactionnel ;
- Calendar Semantic et Daily Economic comme autorités History ;
- séparation deterministic outputs / sidecars ;
- séparation causalité / contexte ;
- navigation overlay par QueryTargetRef.

## 5.2 Ce qui ne doit pas encore devenir une dépendance “de vérité” de Global

- l’actuelle closure de certaines ressources Bilan ;
- la construction oracle-driven de Typical/Minimal publiée ;
- la normalisation M3 située dans le script de certification ;
- le `causalCost` Moment tant que son autorité n’est pas explicitement prouvée ;
- les sorties Place simplifiées ;
- l’absence de manifest physique partagé avec le futur dependency graph Global.

---

# 6. Compatibilité avec les chantiers suivants

## A. Analyse Globale V2

**Statut : `READY_AFTER_MINOR_HISTORY_WORK`.**

La fondation est adaptée au modèle Global : Facts partagés, métriques communes, ReadModels séparés de React, materialization store, publications, révisions, Quality/Visibility et Query API existent déjà.

Le travail History requis avant de démarrer Global est borné mais obligatoire :

```text
- fermer le Bilan sur ses vraies dépendances ;
- faire des Analytics officiels l’unique source de construction publiée ;
- attacher durablement la matrice/manifest de dépendances à la génération ;
- figer l’immutabilité/correction ;
- recertifier et republisher la fenêtre 12 mois.
```

“Minor” signifie ici **limité en périmètre**, pas “facultatif”. Aucun nouveau module History majeur n’est requis pour commencer Global.

## B. Benefit Wallet / Swile / Edenred

**Statut : `REQUIRES_HISTORY_EXTENSION`.**

History est compatible avec l’intégration future grâce aux concepts déjà prévus : PurchaseEvent, économie ≠ financement ≠ banque, Journal, DailyEconomic et snapshots par publication.

Mais le produit History devra être étendu pour afficher correctement :

- achat humain unique ;
- gross economic consumption ;
- funding split Benefit Wallet / carte ;
- éventuels mouvements wallet séparés du PurchaseEvent ;
- financement dans Journal / détails ;
- effets Bilan explicitement prévus par le brief Benefit Wallet.

Cette extension ne doit pas remettre en cause Actual/DailyEconomic : elle doit se brancher sur leurs contrats.

Les merchant/purchase drivers actuellement vides peuvent légitimement être finalisés avec ce chantier plutôt que de créer une fausse donnée maintenant.

## C. Gestion des médias

**Statut : `REQUIRES_HISTORY_EXTENSION`.**

Les ReadModels possèdent quelques emplacements `imageRef`/narratifs, mais il n’existe pas de système MediaAsset/MediaAssignment complet.

La bonne extension est compatible avec la publication History :

```text
binary privé
→ MediaAsset canonical/content object
→ assignment validé
→ publication History contient refs/meta
→ React résout le média
```

Cette extension doit être **CONTENT_SCOPED / PRESENTATION_SCOPED**, pas déclencher de recalcul Actual/Typical/Minimal.

History n’a donc pas besoin d’être refondu pour accepter les médias, mais ses ReadModels devront être enrichis.

## D. Résumé contextuel

**Statut : `READY_AFTER_MINOR_HISTORY_WORK`.**

M1 possède déjà un emplacement `importedSummary` et le design History accepte l’idée d’un sidecar non déterministe distinct de la publication économique.

Le chemin actuel force simplement cet état à `MISSING`, ce qui est un différé volontaire.

Une fois les publications History stabilisées, le résumé pourra utiliser :

- publicationId ;
- revision ;
- factsHash ;
- payload immuable ;
- résultat importé append-only ;
- freshness STALE/MISSING/FRESH.

Le résumé ne doit pas participer au calcul déterministe ni changer les KPI.

## E. Console Import & Actualisation

**Statut : `BLOCKED` pour l’implémentation finale, mais architecture compatible.**

Le blocage n’est pas une faiblesse du Calendar ou du Journal. La Console finale doit connaître l’ensemble du graphe produit :

```text
History
Global
Benefit Wallet
Media
Contextual Summary
```

Or :

- Global n’est pas encore construit ;
- le workflow correction History n’est pas encore orchestré de bout en bout ;
- la future matrice `LOCAL_MONTH / HISTORICAL_LOOKBACK / GLOBAL_HISTORY / ENTITY_SCOPED` ne peut pas être figée définitivement aujourd’hui.

On peut donc préparer le contrat Import, mais pas figer le Refresh Planner final avant les autres sous-systèmes.

---

# 7. Plan de finition History

Le plan ci-dessous ne contient volontairement **aucune fonctionnalité Global, Swile, Media ou Import**.

## LOT H1 — bugs / contrats

### H1.1 Fermer l’autorité Analytics du Bilan

- supprimer l’usage de l’oracle comme source de construction des payloads publiés ;
- conserver l’oracle uniquement comme comparaison/gate de certification ;
- faire passer Typical, Minimal, Categories, Activity, Place, etc. par leurs sources Analytics/Facts officielles ;
- conserver les mêmes résultats lorsqu’ils sont corrects.

### H1.2 Fermer les dépendances Bilan

Pour chaque ressource Bilan :

```text
inputs réels
→ resourceInputHash
→ closure facts/dependencies
→ publicationFactsHash
```

Le test doit prouver que modifier un intrant significatif modifie le hash approprié.

### H1.3 Centraliser la classification M3

- retirer les fonctions de mapping sémantique du script d’orchestration ;
- utiliser une autorité Facts/Analytics versionnée ;
- garder KNOWN/PARTIAL/UNKNOWN exacts.

### H1.4 Clarifier la causalité Moment

- définir quelle relation/fact prouve qu’un coût est causé par le Moment ;
- ne jamais promouvoir `spentDuring` en `causalCost` ;
- rendre cette autorité testable.

### H1.5 Stabiliser Place / Activity

- utiliser les inputs réellement disponibles du moteur Place ;
- ne plus forcer coverage=1 par simple présence d’un montant ;
- séparer Activity enrichissements réellement disponibles de ceux légitimement UNKNOWN.

**Exit H1 :** aucune donnée Bilan publiée ne dépend d’un calcul de certification ad hoc non représenté dans les Analytics/Facts officiels.

---

## LOT H2 — snapshots / ReadModels

### H2.1 Calendar marker authority

Décider :

```text
Month = top3
ou
Month = top6
```

Puis :

- supprimer la double autorité ;
- conserver le filtrage interactif côté client ;
- mettre à jour ReadModel/RuntimeSchema seulement si nécessaire.

### H2.2 Places “Voir tous”

Décider entre :

- UI max 6 assumée et pas de bouton “Voir tous” ;
- collection ReadModel exhaustive ;
- ressource de collection dédiée.

Ne pas charger des lignes Canonical directement depuis React.

### H2.3 Labels certifiés

Ajouter aux ReadModels concernés :

- label de composition Typical ;
- label Minimal ;
- éventuels labels Activity/participant si réellement requis.

### H2.4 Manifest durable

Persister ou attacher de façon durable à une génération ce qui permet de prouver :

```text
manifestHash
factDependencies
externalQueryRefs
implementation identity / digest
```

La forme physique précise peut varier, mais le résultat doit pouvoir être relu après publication.

### H2.5 Préparer la nouvelle génération

Après H1/H2, considérer tous les snapshots concernés comme candidats au rebuild. Ne jamais patcher les payloads de l’ancienne publication.

**Exit H2 :** une génération peut être reconstruite avec un contrat ReadModel sans ambiguïté et une fermeture de dépendances relisible.

---

## LOT H3 — UX

1. borner la navigation mensuelle aux mois History disponibles ;
2. rendre Week découvrable sans hover ;
3. clarifier la cellule jour et ses zones cliquables ;
4. conserver le retour overlay, scroll et focus déjà solides ;
5. décider si une preview tactile spécifique est nécessaire ;
6. éviter les faux affordances ;
7. conserver la séparation causalité/contexte dans tous les drawers.

**Exit H3 :** aucun chemin nominal ne mène à une erreur technique uniquement parce que l’utilisateur a utilisé une navigation normale.

---

## LOT H4 — UI

1. corriger Bridge `residual` ;
2. corriger le wording des Margins KNOWN/PARTIAL ;
3. afficher PARTIAL de façon reconnaissable dans les zones compactes ;
4. harmoniser pourcentages, unités, décimales ;
5. remplacer toutes les clés techniques visibles par des labels ReadModel ;
6. revoir densité M3/M4 uniquement en présentation ;
7. décider l’affichage de `bankInflows` sans changer les données.

**Exit H4 :** aucun identifiant technique ou wording sémantiquement faux n’est visible sur le chemin principal History.

---

## LOT H5 — responsive / accessibilité

1. supprimer le comportement produit dépendant de `min-width:1040px` ;
2. définir Calendar/Week/Bilan sur petits écrans ;
3. vérifier overflow horizontal/vertical et longues chaînes ;
4. compléter pattern tabs clavier ;
5. garantir focus visible et restauration ;
6. rendre Week/touch utilisable ;
7. tester Hover comme enrichissement facultatif, jamais comme seul accès ;
8. conserver `prefers-reduced-motion`.

**Exit H5 :** le parcours Calendar → Week/Journal → Bilan → drawer est utilisable au clavier et sur petit écran sans information essentielle inaccessible.

---

## LOT H6 — tests / certification

### H6.1 Tests structurels nouveaux

- intrant Bilan modifié → closure/hash modifié ;
- oracle différent → pas d’effet sur le payload construit si Analytics officiels inchangés ;
- causalCost refuse une simple association temporelle ;
- Place coverage/scoring suivent l’autorité choisie ;
- Calendar top3/top6 contrat unique ;
- labels ReadModel présents.

### H6.2 Correction historique E2E

Créer un scénario contrôlé :

```text
publication active P1
→ mutation Canonical test
→ recordAnalyticsMutation
→ invalidation ciblée
→ P1 non servie comme fraîche
→ build P2
→ certification
→ activation P2
→ P1 reste traçable
→ Query client obtient P2
```

Ce scénario peut être synthétique/transactionnel ; il n’est pas nécessaire d’implémenter le futur Refresh Planner transverse.

### H6.3 Cache de génération

Tester explicitement qu’un client ayant lu P1 ne reste pas bloqué éternellement sur P1 après activation P2.

### H6.4 Immutabilité

Ajouter un gate prouvant qu’une publication publiée ne peut pas être mutée par le chemin normal et, selon la solution choisie, qu’une mutation DB privilégiée est bloquée ou détectée/certifiée comme interdite.

### H6.5 Certification 12 mois

Après rebuild :

- 12/12 mois ;
- 15/15 familles Query ;
- deux artifacts par mois ;
- 100 % RuntimeSchema ;
- invariants Calendar/Daily/Bilan ;
- zéro snapshot ambigu actif ;
- publicationMeta/factsHash cohérents ;
- aucun read-through ;
- aucune ancienne signature active si elle est retirée.

**Exit H6 :** nouveau gate History V2 = PASS sur la génération finale.

---

## LOT H7 — nettoyage final

1. supprimer les champs ReadModel devenus réellement inutiles après décision marker/UX ;
2. retirer les compatibilités de signatures legacy uniquement si aucune publication active n’en dépend ;
3. conserver les moteurs Analysis Month internes explicitement nécessaires à Global ;
4. ne pas supprimer du code “legacy” juste parce qu’il porte un ancien nom s’il reste une dépendance partagée ;
5. mettre à jour les rapports d’autorité et le manifest final ;
6. vérifier que seuls les chemins History V2 produit restent exposés ;
7. vérifier diff final, migrations, tests et publications.

**Exit H7 :** il n’existe plus de deuxième interprétation active du contrat History final.

---

# 8. Definition of Ready — commencer Analyse Globale

La phrase :

> **« Historique mensuel est suffisamment stabilisé pour commencer l’Analyse globale. »**

peut être prononcée uniquement si les conditions suivantes sont toutes vraies.

## DoR-01 — Runtime History

- `/historique` résout un mois publié ;
- `/historique/[month]` ne déclenche aucun Analytics/SNAPSHOT_BUILD ;
- Calendar, Week, Journal, Overview, M1–M4 et drill-downs servent uniquement des snapshots publiés ;
- un miss History continue d’échouer fermé.

## DoR-02 — Authority Analytics

- aucun payload History publié ne prend une valeur métier depuis l’oracle de certification comme source ;
- l’oracle sert uniquement à comparer/valider ;
- M3 normalise ses classifications dans Facts/Analytics partagés ;
- Moment causalCost possède une autorité explicitement causal ;
- Place/Activity utilisent une doctrine partagée ou rendent explicitement UNKNOWN ce qu’ils ne savent pas.

## DoR-03 — Dependency closure

Pour chaque ressource History top-level et drill-down importante :

- `resourceInputHash` représente ses intrants réels ;
- les dépendances Facts/Analytics sont relisibles ;
- changer un intrant significatif change le hash ou la dépendance attendue ;
- le manifest détaillé de la génération est conservé durablement.

## DoR-04 — ReadModels finaux

- une seule limite officielle markers Month ;
- aucune action “Voir tous” n’est impossible par construction ;
- aucun stableId/enums techniques ne sert de label utilisateur final ;
- les statuts qualité nécessaires à l’UI sont directement présents ;
- React ne restaure aucun sens métier manquant.

## DoR-05 — FROZEN_MONTH

- une publication publiée n’est jamais modifiée en place par le pipeline ;
- la solution d’immutabilité choisie est explicitement testée ;
- une ancienne génération reste traçable ;
- une nouvelle génération est le seul chemin normal pour changer la vérité publiée.

## DoR-06 — Correction historique

Un test E2E contrôlé prouve :

```text
correction
→ dataRevision augmente
→ scope History affecté invalide
→ ancien snapshot n’est plus considéré frais
→ nouvelle génération construite
→ nouvelle publication certifiée
→ activation atomique
→ ancienne génération conservée
```

Aucun Refresh Planner Global n’est requis à ce stade ; seulement la preuve que History sait vivre avec une correction.

## DoR-07 — Cache client

Après activation d’une nouvelle génération pour un mois déjà consulté :

- le client ne reste pas indéfiniment sur le vieux payload ;
- le comportement est déterministe et testé ;
- la solution ne nécessite pas de recalcul métier client.

## DoR-08 — UI/UX minimale de sortie

Les problèmes `HIGH` ou `BLOCKER` classés `BEFORE_GLOBAL` sont tous fermés.

Au minimum :

- navigation mois normale sans dead-end technique ;
- Bridge residual correct ;
- Margins sémantiquement correctes ;
- PARTIAL perceptible ;
- Week découvrable ;
- parcours principal clavier fonctionnel ;
- petit écran utilisable sans perdre une information essentielle.

Des micro-polish `LOW / CAN_WAIT` peuvent rester ouverts.

## DoR-09 — Certification finale

Une nouvelle exécution du gate 12 mois produit :

```text
12/12 mois = PASS
15/15 ressources = PASS
RuntimeSchemas = 100 %
reconciliation = PASS
publication coherence = PASS
factsHash/manifest closure = PASS
single active generation = PASS
no read-through = PASS
correction/republication test = PASS
```

Les résultats sont attachés au commit exact qui servira de baseline d’entrée Global.

## DoR-10 — Baseline Git/Supabase identifiable

Le rapport d’entrée Global doit enregistrer :

```text
commit History final
schema/migrations History finales
dataRevision
analyticsRevision
publicationIds actifs
manifest/digest final
liste exacte des compatibilités legacy restantes
```

Cette baseline devient le `POST_HISTORY_ENTRY_GATE` du chantier Global.

---

# 9. Readiness synthétique par grand bloc

| Bloc | Readiness aujourd’hui | Après H1–H7 |
|---|---|---|
| Calendar / temporal | Très solide, 1 contrat à trancher | STABLE |
| Daily Economic / Journal | Solide | STABLE |
| Bilan UI | Fonctionnelle | STABLE_WITH_MINOR_POLISH |
| Bilan Analytics publié | Gate encore ouvert | STABLE |
| ReadModels | Ciblés à ajuster | STABLE |
| Snapshot runtime | Solide | STABLE |
| Publication atomique | Solide | STABLE |
| FROZEN immutability | Partielle physiquement | STABLE |
| Correction historique | Invalidation disponible, orchestration manquante | STABLE History-specific |
| Query layer | Solide | STABLE |
| React | Solide | STABLE |
| Responsive/a11y | Incomplet | STABLE_WITH_MINOR_POLISH |
| Diagnostic produit | Générique, pas History-specific | Peut rester PARTIAL pour Global si les gates scripts sont PASS |

---

# 10. Ce qui peut attendre sans bloquer Global

Les éléments suivants ne doivent pas être confondus avec le gate de stabilité :

- branchement du Résumé contextuel importé ;
- médias ;
- Benefit Wallet ;
- merchant/purchase drivers dépendants de sources futures ;
- optimisation de taille Journal sans preuve de latence ;
- préfetch systématique J−1/J+1 ;
- instrumentation budget payload ;
- diagnostic produit complet conforme au futur brief Diagnostic ;
- micro-polish visuel non lié à une ambiguïté de sens.

---

# 11. Ce qui ne peut pas attendre avant Global

Liste volontairement courte :

1. Bilan construit depuis Analytics/Facts officiels, plus depuis l’oracle ;
2. dependency closure Bilan exhaustive ;
3. normalisation M3 authoritative ;
4. Moment causalCost explicitement causal ;
5. Place/Activity authority cohérente pour les signaux réutilisables ;
6. manifest/dépendances relisibles après publication ;
7. FROZEN_MONTH immutability décidée/testée ;
8. correction History → nouvelle publication démontrée ;
9. cache client compatible avec changement de génération ;
10. snapshots 12 mois reconstruits et recertifiés sur le commit History final.

Les items Calendar top3/top6 et labels ReadModel sont également à fermer avant cette republish finale, afin d’éviter une deuxième génération immédiate pour du simple contrat de présentation.

---

# 12. Verdict final

## Historique mensuel comme produit

**Globalement fonctionnel et déjà mature.**

Calendar, Week, Journal et la structure du Bilan sont réels, utilisés, snapshotés et servis par la vraie Query API. Les écrans ne sont pas des maquettes connectées à des calculs improvisés.

## Historique mensuel comme fondation analytique

**Presque prêt mais pas encore certifiable comme dépendance Global aujourd’hui.**

Le principal point à fermer est la chaîne :

```text
Facts/Analytics officiels
→ ReadModel
→ closure exhaustive
→ manifest durable
→ snapshot
→ publication immuable
```

## Historique mensuel comme fondation runtime

**Solide.**

Le pattern de publication/snapshot/query peut être réutilisé par la suite de Budgétisation V2.

## Readiness Analyse Globale

**`READY_AFTER_MINOR_HISTORY_WORK`.**

Le mot `minor` qualifie le **périmètre** : il n’y a pas un nouveau sous-produit History à construire. Mais la criticité des corrections H1/H6 est haute car Global réutilisera ces contrats.

---

# 13. Preuve de non-modification applicative pour cet audit

Baseline distante avant création de ce rapport :

```text
main
4899a2bc2d1b558fa46f143d01f929a50b8b0125
docs(history-v2): audit snapshots publications runtime
```

Audits disponibles après ce lot :

```text
docs/history-v2/audits/20-current-runtime-architecture-audit.md
docs/history-v2/audits/21-calendar-week-day-ui-ux-audit.md
docs/history-v2/audits/22-month-review-ui-ux-data-audit.md
docs/history-v2/audits/23-snapshots-publications-runtime-audit.md
docs/history-v2/audits/24-history-v2-master-readiness-audit.md
```

Le contrôle final doit vérifier que le commit d’audit ne contient que le présent fichier. Aucun runtime, moteur, ReadModel, composant, CSS, migration ou donnée Supabase n’a été modifié volontairement dans ce lot.
