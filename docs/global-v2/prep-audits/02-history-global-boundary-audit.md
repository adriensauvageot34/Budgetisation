# Analyse Globale V2 — audit de frontière History ↔ Global

> **Nature du document** : audit préparatoire en lecture seule.
>
> **Aucune implémentation, aucune migration, aucune modification de code métier et aucune écriture Supabase ne sont réalisées par ce lot.**
>
> **Baseline repository distante observée** : branche `main`, commit `eb83bf625ccafbbfc448ed942353ecbb065dba64` (`docs(global-v2): add master capability preparation audit`).
>
> **État History pris en compte** : audits 20 → 24 disponibles dans le repo ; HC1 communiqué `PASS` par l’utilisateur mais non observable sur la baseline GitHub distante au moment du présent audit ; HC2 → HC6 non fermés.
>
> **Conséquence** : toute conclusion sensible est classée `STABLE_ALREADY`, `LIKELY_STABLE`, `REVALIDATE_AFTER_HC6` ou `UNKNOWN`. Aucune classification finale `REUSE / ADAPT / NEW_*` n’est autorisée ici.
>
> **Cible Global** : `docs/global-v2/prep-audits/01-global-master-capability-map.md`, dérivée du Master Analyse Globale V2.

---

# 0. Réponse courte

La frontière History → Global est **comprise conceptuellement** et peut être résumée ainsi :

```text
Global PEUT réutiliser
→ les vérités Canonical communes
→ les Facts communs
→ les métriques Analytics officielles réellement sémantiquement identiques
→ les primitives génériques de support/coverage/provenance
→ les primitives techniques de Query / Materialization / Publication si leur contrat est adapté au scope Global

Global NE DOIT PAS réutiliser comme vérité analytique
→ les ReadModels History
→ les projections Calendar/Bilan
→ les snapshots mensuels comme substitut aux Facts/Analytics
→ les règles de présentation React
→ les classements/slices/top-N History
→ les anciennes ressources `analysis_global_*` legacy simplement parce qu’elles existent
```

La règle structurante est donc :

```text
History et Global partagent la vérité en AMONT.
Ils ne partagent pas nécessairement les projections en AVAL.
```

Autrement dit :

```text
Canonical / Facts / Analytics partagés
                 │
        ┌────────┴────────┐
        ↓                 ↓
 History ReadModels   Global Analytics spécialisés
        ↓                 ↓
 History snapshots    Global ReadModels
        ↓                 ↓
 History UI           Global UI
```

L’Analyse Globale ne doit jamais être construite comme :

```text
12 mois de Bilan History
+ concaténation
+ quelques moyennes
= Global
```

Cette architecture violerait le Master Global pour trois raisons : les grains Global sont multi-niveaux, les fenêtres de support ne sont pas universelles et plusieurs moteurs Global sont intrinsèquement historiques/statistiques (`Trend`, `Stability`, `ChangePoint`, `RelationshipEngine`, Persona comparative, routines, saisonnalité, etc.).

La majorité des fondations amont History sont de **bons candidats de réutilisation**. Les principales zones qui doivent attendre HC2–HC6 sont :

- `Necessity / Behavior / LifeScope` ;
- causalité Moment ;
- certaines doctrines Activity ;
- Place / finance localisée / coverage ;
- closure/hash/manifest ;
- immutabilité/republication ;
- invalidation/correction ;
- cache après changement de génération.

---

# 1. Sources et niveau de confiance

## 1.1 Sources History relues

Le présent audit s’appuie sur :

- `docs/history-v2/audits/20-current-runtime-architecture-audit.md` ;
- `docs/history-v2/audits/21-calendar-week-day-ui-ux-audit.md` ;
- `docs/history-v2/audits/22-month-review-ui-ux-data-audit.md` ;
- `docs/history-v2/audits/23-snapshots-publications-runtime-audit.md` ;
- `docs/history-v2/audits/24-history-v2-master-readiness-audit.md` ;
- rapports History V2 antérieurs pertinents ;
- `src/analytics/facts/**` ;
- `src/analytics/production/**` ;
- `src/analytics/history-v2/**` ;
- `src/query-api/history-v2/**` ;
- `src/server/analytics/**` ;
- `src/query-api/**` ;
- `src/server/query/**` ;
- `docs/specs/SOURCE_OF_TRUTH.md` ;
- `docs/specs/ANALYTICS_MATERIALIZATION.md` ;
- migrations/publication documentées par les audits 23/24.

## 1.2 Source Global

- `docs/global-v2/prep-audits/01-global-master-capability-map.md`.

Cette carte ne remplace pas le Master ; elle sert de projection exploitable de la cible déjà auditée.

## 1.3 HC1

Le résultat communiqué est :

```text
HC1 = PASS
oracle retiré de toute construction de payload History V2
Actual = Daily Economic Ledger
Typical / Minimal = moteurs Analytics officiels
catégories / historique = Facts et observations Analytics officiels
oracle = EXPECTED uniquement
```

Ce résultat est traité comme **information de projet valide**, mais la branche distante actuelle ne contient pas encore le rapport/commit HC1. Par conséquent, toutes les conclusions qui dépendent physiquement de HC1 restent `REVALIDATE_AFTER_HC6` dans ce document.

---

# 2. Légende des classifications préparatoires

| État | Sens |
|---|---|
| `STABLE_ALREADY` | Le principe ou la primitive observée est suffisamment stable et ne dépend pas des gates HC2–HC6 pour son sens principal. |
| `LIKELY_STABLE` | La primitive paraît saine et réutilisable, mais un audit post-History devra encore confirmer son contrat exact ou son implantation physique. |
| `REVALIDATE_AFTER_HC6` | Le sujet est explicitement touché par HC2–HC6, ou son usage Global dépend de la baseline History finale. |
| `UNKNOWN` | Les sources actuelles ne permettent pas de conclure sans audit physique post-History. |

Les colonnes `REUSE_CANDIDATE`, `ADAPT_CANDIDATE` et `MUST_NOT_REUSE` sont **provisoires**. Elles expriment une frontière conceptuelle, pas un choix d’implémentation définitif.

---

# 3. Matrice maître History → Global

| FOUNDATION | HISTORY STATUS | HISTORY_ROLE | GLOBAL_NEED | SAME_SEMANTICS? | SAME_GRAIN? | SAME_SCOPE? | REUSE_CANDIDATE? | ADAPT_CANDIDATE? | MUST_NOT_REUSE? | HC6 REVALIDATION REQUIRED? | PROVISIONAL CLASSIFICATION | RISK |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `CanonicalRepository` | solide | autorité d’accès Canonical household-scoped | accès aux mêmes vérités Canonical | oui pour les mêmes entités | oui au niveau source | oui avec scopes Global élargis | oui | possible extensions | non | oui pour mapping final | `LIKELY_STABLE` | LOW |
| `FactSourceResolver` | solide | frontière Canonical → Facts | accès source-aware aux Facts Global | oui conceptuellement | dépend du Fact | scope Global à confirmer | oui | oui si nouvelles familles Facts | non | oui | `LIKELY_STABLE` | MEDIUM |
| `EconomicComponentFact` | fondation partagée | coût économique attribuable/classifiable | M1/M2/M3/M5/M6/M7/M9 | oui pour identité économique | oui : composant canonique | oui, filtrable person/household | oui | classifications peuvent évoluer | ReadModel History dérivé interdit | oui pour axes HC2 | `LIKELY_STABLE` | MEDIUM |
| `PurchaseEventFact` | fondation partagée | achat humain / timing / sources | cœur M8, M2/M5/M9, futur Wallet | oui | oui : PurchaseEvent | oui | oui | oui pour funding futur | opération bancaire comme substitut interdite | oui mapping final | `LIKELY_STABLE` | MEDIUM |
| `ActivityOccurrenceFact` | fondation partagée | occurrence réelle + participants | M3/M4/M5/M9/M10 | oui pour occurrence | oui : occurrence | oui | oui | oui pour modèles sociaux/cadence | résumé M4 comme source interdit | HC2/HC6 | `REVALIDATE_AFTER_HC6` | MEDIUM |
| `ActivityOccurrenceCostFact` | présent | coût causal qualifié + evidence | M4/M5/M9 et liens M6 | probablement oui si causalité identique | occurrence | oui | oui | possible adaptation relation types | coût contextuel History interdit comme causal | HC2/HC6 | `REVALIDATE_AFTER_HC6` | HIGH |
| `PersonDayFact` | fondation limitée mais saine | personne × jour + observabilité localisation | M3/M4/M5/M9 | oui pour identité jour/personne | oui | oui | oui comme socle | oui : Global peut exiger plus de contextes | projection UI jour interdite | oui mapping final | `LIKELY_STABLE` | MEDIUM |
| `PlaceVisitFact` | fondation partagée | visite humaine person/place/date/interval | M3/M4/M5/M7/M9/M10 | oui pour visite | oui : visite | oui | oui | oui pour importance/mobility | ranking Place M4 interdit | HC2/HC6 | `REVALIDATE_AFTER_HC6` | HIGH |
| catégories / sous-catégories | utilisées | classification économique | M1/M2/M5/M9 | oui si même taxonomie | composant puis agrégats | oui | oui | possible agrégations Global | lignes M2 ReadModel interdites | HC6 | `REVALIDATE_AFTER_HC6` | MEDIUM |
| `Necessity` | utilisée mais gate HC2 | axe M3 / Minimal | M1/M2/M3/M5/M9 | cible oui, autorité actuelle à fixer | composant | oui | candidat après HC2 | possible | mapping script ad hoc interdit | oui absolument | `REVALIDATE_AFTER_HC6` | HIGH |
| `Behavior` | utilisée mais gate HC2 | axe M3 | M1/M3/M5/M9 | cible oui, autorité actuelle à fixer | composant | oui | candidat après HC2 | possible | token matching script interdit | oui absolument | `REVALIDATE_AFTER_HC6` | HIGH |
| `LifeScope` | utilisée mais gate HC2 | axe M3 / contexte de vie | M1/M2/M3/M5/M9 | cible oui, autorité actuelle à fixer | composant | oui | candidat après HC2 | possible | normalisation locale interdite | oui absolument | `REVALIDATE_AFTER_HC6` | HIGH |
| Actual / `economic_consumption_net_attributable` | solide | Actual mensuel + daily reconciliation | M1, séries Finance, inputs M2/M5/M9 | oui pour définition économique | métrique peut être produite à plusieurs scopes | scope Global doit respecter additivité | oui via moteur/ProducedMetric | oui pour agrégations historiques | valeur affichée M1 History comme unique input interdite | HC6 certification | `LIKELY_STABLE` | LOW/MEDIUM |
| Typical | HC1 annoncé PASS | référence mensuelle officielle | M1/M2/M9 + current regime | probablement oui comme moteur partagé | fenêtre/reference, pas simple mois | Global as-of/support diffèrent | oui moteur | oui enveloppe Global | valeur snapshot History concaténée interdite | oui | `REVALIDATE_AFTER_HC6` | HIGH |
| Minimal | HC1 annoncé PASS | baseline minimale mensuelle | M1 et comparaisons | probablement oui | moteur de baseline | scope Global as-of à adapter | oui moteur | oui | Minimal Preview History interdit comme source | oui | `REVALIDATE_AFTER_HC6` | HIGH |
| `category_amount` | métrique active | montant catégorie | M2, M5, M9 | oui | scope demandé | oui | oui | agrégation historique conditionnée à additivité | Category ReadModel mensuel interdit | HC6 | `LIKELY_STABLE` | MEDIUM |
| `fixed_variable_amount` | métrique active | axe Behavior/fixe-variable selon contrat | M1/M2/M5 | dépend de doctrine HC2 | composant/aggregate | oui | candidat | oui | projection M3 History interdite | oui | `REVALIDATE_AFTER_HC6` | HIGH |
| `life_scope_amount` | métrique active | agrégat LifeScope | M1/M2/M5/M9 | dépend de doctrine HC2 | composant/aggregate | oui | candidat | oui | projection M3 History interdite | oui | `REVALIDATE_AFTER_HC6` | HIGH |
| `activity_frequency` | métrique active | fréquence activité | M4/M5/M9/M10 | oui en principe | occurrence + support | Global support peut différer | oui moteur | oui normalisation globale | counts M4 bruts interdits | HC6 | `LIKELY_STABLE` | MEDIUM |
| `activity_causal_cost` | métrique active | coût causal activités | M4/M5/M9 | oui si evidence identique | occurrence / scope | oui | candidat | oui | association/context coût comme causal interdit | HC2/HC6 | `REVALIDATE_AFTER_HC6` | HIGH |
| `localized_spend` | métrique active | finance localisée | M7/M5/M9 | seulement après doctrine Place | composant/place | coverage spécifique | candidat | probablement | montant Place M4 sans coverage comme vérité interdite | HC2/HC6 | `REVALIDATE_AFTER_HC6` | HIGH |
| `place_visit_count` / `distinct_visit_days` | métriques actives | visites/jours de visite | M7/M4/M9/M10 | oui | visite/jour | oui | oui | possible normalisation | Place ranking History interdit | HC6 | `LIKELY_STABLE` | MEDIUM |
| Calendar Semantic Month Artifact | solide History | ordre Calendar, ribbons, continuité, markers, semantic items | certains anchors M3/M4/M6 possibles | partiellement | mois/jour, fortement History | month-scoped | sélectivement | oui | **oui comme vérité Global générale** | HC6 pour relations | `ADAPT_CANDIDATE_ONLY` | HIGH si réutilisé wholesale |
| Daily Economic Ledger Month Artifact | solide History | allocation économique quotidienne + Actual | Finance temporelle / PersonDay / anchors | partiellement | jour/mois | month-scoped | sélectivement | oui | **oui comme unique dataset Global** | HC6 | `ADAPT_CANDIDATE_ONLY` | MEDIUM/HIGH |
| Calendar ReadModel | solide UI | projection mensuelle | navigation/deep links seulement | non | UI mois | History | non | non | oui | non | `MUST_NOT_REUSE_AS_ANALYTICS` | HIGH |
| Week ReadModel | solide UI | projection semaine | aucun moteur Global | non | semaine UI | History | non | non | oui | non | `MUST_NOT_REUSE_AS_ANALYTICS` | HIGH |
| Journal ReadModel | solide UI | récit détaillé d’un jour | destination de drill-down possible | non comme source | jour UI | History | non comme Analytics | oui comme destination navigation | oui comme source Global | non | `MUST_NOT_REUSE_AS_ANALYTICS` | HIGH |
| Bilan M1 ReadModel | fonctionnel | présentation mensuelle Actual/Typical/Minimal/bridge | concepts M1 Global similaires | non : projection différente | mois | History | non | inspiration contrat seulement | oui comme input analytique | HC6 pour moteurs sous-jacents | `MUST_NOT_REUSE_AS_ANALYTICS` | HIGH |
| Bilan M2 ReadModel | fonctionnel | catégories mensuelles | M2 Global | non au niveau RM | mois | History | non | inspiration UX | oui comme input analytique | HC6 métriques sous-jacentes | `MUST_NOT_REUSE_AS_ANALYTICS` | HIGH |
| Bilan M3 ReadModel | gate HC2 | nature mensuelle/matrix | M1/M2/M3 Global | non au niveau RM | mois | History | non | aucune avant HC2 | oui | oui | `MUST_NOT_REUSE_AS_ANALYTICS` | BLOCKER si utilisé |
| Bilan M4 ReadModel | fonctionnel mais enrichissements incomplets | Activities/Moments/Places du mois | M4/M6/M7 | non au niveau RM | mois | History | non | inspiration UX uniquement | oui comme dataset | oui | `MUST_NOT_REUSE_AS_ANALYTICS` | HIGH |
| Moment ReadModels History | fonctionnels | détail mensuel Moment | M6 a besoin séries/comparabilité/causalité | seulement identités/concepts | Moment mais contexte mensuel | History | non | destination/deep link | oui comme source analytique | HC2/HC6 | `MUST_NOT_REUSE_AS_ANALYTICS` | HIGH |
| Activity ReadModels History | fonctionnels | détail occurrence/activité mensuelle | M4/M9/M10 | concepts partagés mais projection non | month/detail | History | non | deep link possible | oui comme source analytique | HC2/HC6 | `MUST_NOT_REUSE_AS_ANALYTICS` | MEDIUM/HIGH |
| Place ReadModels History | fonctionnels mais doctrine partielle | détail Place mensuel | M7/M9/M10 | non tant que ranking/coverage non fermé | month/detail | History | non | deep link possible | oui comme source analytique | HC2/HC6 | `MUST_NOT_REUSE_AS_ANALYTICS` | HIGH |
| Person identities | Canonical stable | sujets/personnes | M9/M10/social | oui | personne | household | oui | possible participant/contact extension | faux PersonId Couple interdit | HC6 mapping | `STABLE_ALREADY` | LOW |
| Quality / knowledge states | bonne fondation | KNOWN/PARTIAL/UNKNOWN/N/A/CONFLICT + quality | transversal Global | oui conceptuellement | tous grains | tous scopes | oui primitives | oui policies Global | UI History quality comme policy Global interdite | HC6 contracts | `LIKELY_STABLE` | MEDIUM |
| Support / Coverage | présents | qualification métriques | fondation Global critique | oui conceptuellement | varie par grain | varie par scope | oui primitives | oui policies Global | seuils History copiés sans justification interdits | GA0 + HC6 | `LIKELY_STABLE` | HIGH |
| Metric Registry / ProducedMetric | actif | identité, méthode, additivité, provenance | fondation Global critique | oui | métrique/scoped | multi-scope | oui | extension Global | agrégation de métrique non additive interdite | HC6/GA0 | `LIKELY_STABLE` | HIGH |
| Materialization store | solide | artifacts/query snapshots/publications | Global a besoin persistance/publication | oui comme infra | générique | month/global déjà prévu | oui infra | oui profil Global | profil History copié tel quel interdit | HC3-HC6 | `REVALIDATE_AFTER_HC6` | HIGH |
| `analytics_artifacts` | solide | Produced/artifacts persistants | artifacts Global potentiels | oui comme stockage dérivé | générique | global possible | oui infra | oui | artifact History comme output Global interdit | HC3/GA0 | `LIKELY_STABLE` | MEDIUM |
| `analytics_query_snapshots` | solide | ReadModels persistés | ReadModels Global | oui comme stockage | query exacte | global possible | oui infra | oui | snapshot History comme cache Global interdit | HC6/GA0 | `LIKELY_STABLE` | MEDIUM |
| `analytics_publications` | solide/manifest incomplet | atomic generation | publication Global cohérente | partiellement | publication | `month` et `global` existent conceptuellement | candidat fort | adaptation manifest probable | publication History comme publication Global interdite | HC3-HC6 | `REVALIDATE_AFTER_HC6` | HIGH |
| PublicationMeta / factsHash | solide principe | traçabilité génération | Global nécessite provenance/cohérence | oui principe | publication | scope à adapter | oui primitives | oui format Global | factsHash History utilisé comme hash Global unique interdit | HC3/GA0 | `REVALIDATE_AFTER_HC6` | HIGH |
| RuntimeSchemas framework | solide | parse pré/post publication | Global doit valider chaque RM | oui framework | par resource | global possible | oui | nouvelle famille Global | schemas History réutilisés comme Global interdits | GA0 | `STABLE_ALREADY` | LOW |
| History V2 RuntimeSchemas | solides | contrats des 15 resources | aucun besoin direct Global | non | History | History | non | non | oui | non | `MUST_NOT_REUSE` | LOW |
| Query API framework | solide | normalize/auth/capabilities/query execution | Global Query layer | oui framework | query scoped | global existe | oui | oui | resources History comme Global interdites | GA0 | `STABLE_ALREADY` | LOW/MEDIUM |
| Query Capability Engine | présent | applicability/capabilities | Global 364 capabilities | principe oui | resource/capability | global à étendre | candidat | forte adaptation attendue | anciens capabilities Global legacy comme autorité interdits | GA0 | `LIKELY_STABLE` | HIGH |
| client Query cache | fonctionnel, HC5 prévu | mémoire onglet | Global devra pinner/détecter publication | principe réutilisable | query | scope global | candidat | oui | stratégie History `never` copiée aveuglément interdite | HC5/GA0 | `REVALIDATE_AFTER_HC6` | HIGH |
| Oracle History | HC1 annoncé retiré comme source | expected/certification | aucun rôle produit Global | non | test | test | non | éventuellement oracle test | **oui absolument** | HC6 preuve | `MUST_NOT_REUSE` | BLOCKER |
| ancienne pile `analysis_global_*` | legacy V1 | ancien produit Global | cible Global V2 différente | non prouvé | `GlobalWindow` legacy | legacy | aucune décision | peut contenir primitives | **doctrine/RM non réutilisables par défaut** | GA0 obligatoire | `UNKNOWN_UNTIL_GA0` | BLOCKER si reprise directe |

---

# 4. Frontière A — vérités Canonical / Facts communes

## 4.1 Principe

La partie la plus réutilisable de History se situe **avant les ReadModels**.

Le repo applique déjà la chaîne d’autorité :

```text
Relationnel / Supabase
→ Canonical
→ Facts
→ Analytics
→ Query / ReadModels
→ React
```

Cette chaîne est compatible avec Global. Global n’a aucune raison de reconstruire une deuxième couche Canonical ou une deuxième famille de Facts lorsque le grain et la sémantique sont réellement identiques.

## 4.2 `EconomicComponentFact`

Le type courant porte notamment :

```text
gross
refundApplied
net
bankDate
economicTiming
person
category
subcategory
activity
merchant
moment
canonicalPlace
necessity
behavior
lifeScope
```

### History

Il constitue une des autorités communes de l’Actual et des projections économiques mensuelles.

### Global

Il est naturellement utile pour :

- M1 fonctionnement économique ;
- M2 catégories/Needs ;
- M3 transformations financières ;
- M5 relations Vie ↔ Argent ;
- M6 coût Moment si la causalité est explicitement établie ;
- M7 finance localisée avec coverage ;
- M9 métriques person-scoped.

### Frontière

**Le Fact est un candidat de réutilisation.**

Mais certains de ses axes sont encore exactement ceux que HC2 doit stabiliser :

```text
necessity
behavior
lifeScope
moment semantics
canonicalPlace / localized coverage indirectement
```

Conclusion : structure économique `LIKELY_STABLE`, axes sémantiques `REVALIDATE_AFTER_HC6`.

## 4.3 `PurchaseEventFact`

Le Fact courant possède une identité propre `purchaseEventId`, des sources/memberships, un `economicAmount`, un timing qualifié et une provenance.

C’est un point particulièrement favorable pour Global M8 : l’architecture n’est déjà pas limitée au paradigme « une opération bancaire = un achat ».

Global doit préserver :

```text
PurchaseEvent
≠ bank operation
≠ funding source
```

Le futur Benefit Wallet pourra étendre le funding sans redéfinir l’achat humain.

Conclusion : `LIKELY_STABLE`, à confirmer physiquement après HC6 et lors du futur audit Wallet.

## 4.4 `ActivityOccurrenceFact`

Le Fact porte :

- occurrence / Life Event ;
- ActivityId ;
- série éventuelle ;
- parent ;
- start/end ;
- validation status ;
- participantIds.

Le grain est exactement celui attendu par plusieurs moteurs Global : occurrence humaine, pas agrégat mensuel.

Il peut donc devenir une source partagée pour :

- cadence/routines ;
- transformations ;
- relations ;
- Persona ;
- Nous deux.

Cependant le coût causal ne doit pas être inféré depuis l’occurrence : il possède son propre Fact/evidence path. Les enrichissements participants/social doivent eux aussi conserver leurs preuves.

Conclusion : occurrence `LIKELY_STABLE`, causalité/social `REVALIDATE_AFTER_HC6`.

## 4.5 `PersonDayFact`

Le Fact est sain mais minimal : personne, date locale et observabilité de localisation.

Il peut fournir le socle de normalisation « personne × jour observable », essentiel à Global. Il n’est cependant pas suffisant à lui seul pour toutes les notions de day-context prévues par le Master.

Conclusion : **réutiliser le grain et l’identité**, adapter/compléter seulement si le futur audit prouve des besoins non couverts.

## 4.6 `PlaceVisitFact`

Le Fact représente une visite avec :

- personne ;
- lieu ;
- date locale ;
- intervalle known/partial/unknown ;
- précision temporelle ;
- ordre de séquence.

C’est une bonne frontière commune parce que Global M7 veut précisément partir d’une **visite humaine**, pas de points GPS bruts.

En revanche, `PlaceVisitFact` n’autorise pas à conclure :

```text
visite
= lieu de transaction
= finance localisée
```

La doctrine Place/coverage est donc `REVALIDATE_AFTER_HC6`.

---

# 5. Frontière B — moteurs et métriques Analytics partageables

## 5.1 Principe

Réutiliser un moteur Analytics est légitime si :

1. la sémantique de la métrique est identique ;
2. le moteur accepte le scope/grain requis ;
3. son support/coverage restent corrects ;
4. son `MethodVersion` et sa provenance sont explicites ;
5. son caractère additif/non-additif est respecté.

Ce n’est **pas** parce que History affiche une valeur qu’un Global peut la sommer.

## 5.2 Actual

`economic_consumption_net_attributable` est déjà une métrique officielle active et le Daily Economic Ledger se réconcilie avec l’Actual History.

Global peut probablement réutiliser :

- le moteur ;
- les Facts économiques ;
- les observations mensuelles certifiées ;
- les enveloppes ProducedMetric.

Global ne doit pas utiliser :

- le montant texte rendu dans le Bilan M1 ;
- une somme naïve de snapshots mensuels sans lire additivity/coverage ;
- la date bancaire comme substitut de timing économique.

## 5.3 Typical

HC1 annonce que Typical est désormais produit par le moteur Analytics officiel et non par l’oracle.

C’est exactement la situation recherchée pour Global.

Mais Global ne devra pas forcément consommer « le Typical affiché en mai 2026 ». Selon la question, il pourra :

- demander le moteur avec un `asOf` ;
- lire une observation certifiée ;
- utiliser une current-regime reference ;
- qualifier le support historique.

Conclusion : **moteur réutilisable probable ; projection mensuelle non réutilisable**.

## 5.4 Minimal

Même conclusion que Typical : la baseline officielle est un candidat commun, mais Global doit conserver sa propre projection et son propre contexte de support.

`history_minimal_preview` n’est jamais un input Analytics Global.

## 5.5 Categories / Need / axes

Les moteurs `category_amount`, `fixed_variable_amount`, `life_scope_amount` et autres métriques actives sont de bons candidats conceptuels.

Mais :

- categories ont une taxonomie Canonical ;
- `Necessity / Behavior / LifeScope` sont au cœur de HC2 ;
- Need au sens du Master Global doit être confronté à la taxonomie réelle post-History ;
- Global M2 peut nécessiter des historiques, shares, contributors et frequency×ticket à un scope différent du Bilan.

Donc les Facts/métriques sont candidats ; les ReadModels M2/M3 ne le sont pas.

## 5.6 Activity

`activity_frequency` et `activity_causal_cost` peuvent devenir des briques communes.

Global M4 devra cependant calculer :

- rates normalisés ;
- cadence ;
- lifecycle ;
- routines ;
- cycles ;
- saisonnalité conditionnelle.

Ces sorties ne doivent pas être dérivées depuis les six cartes Activity du Bilan M4.

## 5.7 Place

`place_visit_count`, `distinct_visit_days` et potentiellement `localized_spend` sont des moteurs candidats.

Global M7 doit néanmoins construire sa propre logique d’importance/evolution/mobility. Le ranking simplifié History M4 n’a aucune autorité Global.

## 5.8 Purchase

Global M8 doit travailler au grain `PurchaseEvent` et non depuis Category Detail ou Merchant cards History.

Les métriques de fréquence/ticket existantes pourront être réutilisées seulement si le futur audit confirme :

- grain PurchaseEvent correct ;
- deduplication ;
- adjustment/refund semantics ;
- support ;
- attribution person/beneficiary ;
- compatibilité split payments / wallet.

---

# 6. Frontière C — artifacts History

## 6.1 `CalendarSemanticMonthArtifact`

C’est une excellente autorité **History** pour :

- ordre sémantique Calendar ;
- ribbons ;
- continuité ;
- markers ;
- projections de jour/semaine.

Global peut avoir besoin de certains signaux sous-jacents :

- semantic anchors ;
- Moments/Life Events ;
- continuité ;
- temporal anchors.

Mais cela ne signifie pas que Global doit lire le JSON du Calendar comme source de vérité.

### À réutiliser éventuellement

- primitives Analytics ou Facts qui alimentent l’artifact ;
- identités sémantiques communes ;
- éventuellement certains outputs certifiés si le futur dependency audit prouve qu’ils sont de vrais artifacts Analytics et pas des choix de présentation.

### À ne pas réutiliser

- marker ordering comme ordre analytique Global ;
- top-N ;
- ribbons comme unique définition d’un Life Event ;
- projection de cellule ;
- `visibleMarkers` ;
- `hiddenMarkerCount`.

Classification : `ADAPT_CANDIDATE_ONLY`.

## 6.2 `DailyEconomicLedgerMonthArtifact`

Le Daily Economic Ledger est plus proche d’une vraie fondation analytique commune, puisqu’il porte l’allocation économique quotidienne et réconcilie Actual/Journal/Calendar.

Il peut être utile à Global pour des questions au grain jour.

Mais Global doit éviter deux abus :

1. forcer toutes les analyses au jour parce que le ledger existe ;
2. considérer ce ledger mensuel comme le dataset universel de Global.

M4 peut avoir besoin d’ActivityOccurrence/PersonDay, M7 de PlaceVisit, M8 de PurchaseEvent, M6 de Moment — grains que le Daily Ledger ne remplace pas.

Classification : `ADAPT_CANDIDATE_ONLY`, forte valeur mais rôle spécialisé.

---

# 7. Frontière D — ReadModels et snapshots History

## 7.1 Règle absolue

Un ReadModel History est un **contrat de consommation History**, pas un Fact.

Même validé par RuntimeSchema et figé dans une publication, il reste une projection conçue pour :

```text
un mois
+ une surface History
+ un besoin UX donné
```

Le statut « snapshot certifié » ne transforme donc pas un ReadModel en autorité analytique universelle.

## 7.2 Calendar / Week

Interdits comme input Global analytique.

Ils restent utiles comme **destinations UX** : un insight Global peut pointer vers un mois/jour History pour montrer la preuve à l’utilisateur.

## 7.3 Journal

Même règle.

Global peut produire un `QueryTargetRef` ou un deep link vers un Journal History. Il ne doit pas lire le Journal pour reconstruire les Facts du jour.

## 7.4 Bilan M1

Actual/Typical/Minimal existent dans le ReadModel, mais Global doit consommer leurs moteurs/metrics officielles, pas le Bilan.

Le ReadModel peut inspirer des labels ou un deep link, pas devenir le dataset de M1 Global.

## 7.5 Bilan M2

Les catégories mensuelles sont une projection. Global M2 aura besoin de séries historiques, shares, contributors, Need/cross-dimensional analytics et support par dimension.

Concaténer 12 tableaux de catégorie ne suffit pas à respecter ces contrats.

## 7.6 Bilan M3

C’est la frontière la plus stricte : HC2 doit encore stabiliser les classifications. Aucun contenu M3 History ne doit être considéré comme input Global avant HC6.

## 7.7 Bilan M4

Activities/Moments/Places sont sélectionnés et parfois tronqués pour l’UX mensuelle.

Exemples documentés :

```text
activities.slice(0, 6)
places.slice(0, 6)
```

Ces collections ne sont donc par construction **pas un corpus analytique Global**.

Global doit repartir de leurs Facts/moteurs.

---

# 8. Frontière E — infrastructure technique générique

## 8.1 Materialization

L’infrastructure est un candidat sérieux de réutilisation :

```text
analytics_artifacts
analytics_query_snapshots
analytics_publications
generation_key
source_revision
analytics_revision
is_active
invalidated_at
RuntimeSchema
```

Le schema de publication accepte conceptuellement un scope `global`, ce qui est favorable.

Cependant le profil History ne doit pas être copié tel quel.

Global devra définir :

- son manifest ;
- ses output families ;
- son `asOf` ;
- ses dependencies History/Facts ;
- ses invalidation scopes ;
- ses règles de publication cohérente.

Classification : infrastructure `LIKELY_STABLE`, contrat Global `REVALIDATE_AFTER_HC6 / GA0`.

## 8.2 Manifest / dependency closure

L’audit History 23 montre que le preflight connaît déjà :

```text
requiredArtifactKeys
requiredQueryKeys
externalQueryRefs
factDependencies
manifestHash
publicationFactsHash
```

Mais l’audit 24 demande de rendre ce manifest durable avant Global.

C’est une dépendance directe de Global : le futur moteur doit pouvoir savoir de quelles vérités History/Facts une publication Global dépend.

Donc : **ne pas finaliser le design Global de publication avant HC3**.

## 8.3 Publication

History a déjà prouvé :

- stage inactif ;
- completeness gate ;
- activation transactionnelle ;
- ancienne génération conservée ;
- rollback ;
- single active generation.

Ces principes sont de bons candidats Global.

Mais HC4/HC5 doivent encore prouver :

- immutabilité physique suffisante ;
- correction → invalidation → rebuild → republish ;
- client cache après generation change.

Global doit donc réutiliser **la doctrine générale**, pas figer dès maintenant le mécanisme exact.

## 8.4 RuntimeSchemas

Le framework est `STABLE_ALREADY`.

Chaque future ressource Global devra posséder son propre RuntimeSchema. Les quinze schemas History ne sont pas réutilisables en tant que schemas Global.

## 8.5 Query API

La normalisation, l’autorisation, le scope, capabilities, validation et execution Query sont de bonnes fondations génériques.

Le repo contient déjà des resources `analysis_global_*`, mais elles sont actuellement sous contrat `legacy_v1`. Elles ne doivent pas servir de preuve qu’un contrat V2 Global existe déjà.

Le futur audit GA0 doit décider :

```text
quelle primitive Query reste
quelle resource legacy disparaît
quelle resource est adaptée
quelle nouvelle famille V2 Global est créée
```

---

# 9. Frontière F — Quality / Visibility / Knowledge states

## 9.1 Ce qui est commun

History utilise déjà des distinctions importantes :

```text
KNOWN
PARTIAL
UNKNOWN
NOT_APPLICABLE
CONFLICT
```

Les metric envelopes portent également support, coverage et provenance.

Le Master Global reprend ces principes et les étend à des grains variés.

Conclusion : **les primitives sont réutilisables conceptuellement**.

## 9.2 Ce qui ne doit pas être copié mécaniquement

Les policies History telles que :

```text
calendar_semantics
week_journal_projection
month_overview_selection
life_money_selection
```

sont History-specific.

Global aura ses propres policies : natural support, relationship robustness, change-point persistence, Persona comparable support, shared participation, etc.

Donc :

```text
Knowledge-state framework = candidat commun
History visibility decisions = non autorité Global
```

---

# 10. Temporalité — pourquoi Global doit recalculer à son grain

## 10.1 History

Les grains principaux sont :

```text
jour
semaine
mois
publication mensuelle
```

Même lorsque les Facts sont plus fins, History les projette autour d’un mois propriétaire.

## 10.2 Global

Le Master nécessite :

```text
multi-month
historique long
fenêtres avant/après
support observable
current regime
trend
stability
seasonality
change points
relationship populations
Person evolution
Moment series
Place evolution
Purchase cycles
shared participation history
```

Aucune de ces notions ne peut être déduite correctement en supposant que 12 mois sont toujours la bonne fenêtre.

## 10.3 Inputs History/partagés utilisables comme observations certifiées

Candidats forts, sous réserve GA0/HC6 :

- EconomicComponent Facts ;
- Actual ProducedMetrics mensuelles certifiées ;
- Typical/Minimal moteurs officiels et références versionnées ;
- category amounts certifiés ;
- ActivityOccurrence Facts ;
- Activity causal cost Facts/metrics après HC2 ;
- PersonDay Facts ;
- PlaceVisit Facts ;
- PurchaseEvent Facts ;
- Moment/LifeEvent identities et relations causales explicites après HC2 ;
- support/coverage/provenance ;
- publication/revision metadata.

## 10.4 Ce qui doit être produit au grain Global

### Trend / Stability

À recalculer sur la série adaptée à la question ; ne pas reprendre un delta de Bilan.

### Seasonality / cycles

À produire depuis le corpus naturel avec support suffisant ; Calendar ribbons ne constituent pas une saisonnalité.

### ChangePoints / Transformations

À produire depuis des fenêtres historiques et signaux multi-domaines ; un mois atypique History n’est pas un ChangePoint.

### Relations Vie ↔ Argent

À produire depuis populations comparables, matching, uncertainty, multiplicity et robustesse ; aucun drill-down History n’est un RelationshipEngine.

### Persona

À produire sur common comparable support ; les filtres person History ne suffisent pas à créer des différences Persona.

### Nous deux

À produire depuis participant evidence ; aucune somme Household ou co-présence triviale ne crée du shared.

### Moments

À comparer au grain Moment/Series avec comparability ; les Moments d’un mois ne constituent pas une population de pairs.

### Places

À produire sur les visites historiques et états de lieu ; le top 6 mensuel est explicitement insuffisant.

### Consumption

À produire au grain PurchaseEvent / Merchant, et Product seulement si autorité ; Category Detail History ne remplace pas M8.

---

# 11. Risques précis de réutilisation abusive

## RISK-01 — Snapshot certifié ≠ Fact

Un snapshot History peut être parfaitement certifié tout en restant une projection de consommation mensuelle. Le consommer comme Fact Global déplacerait l’autorité trop bas dans la chaîne.

## RISK-02 — Troncatures invisibles

Top-N, `slice`, ordre UX et collections de détail peuvent faire disparaître des entités. Un Global construit dessus introduirait un biais silencieux.

## RISK-03 — Agrégation de non-additifs

Typical, Minimal, median, rates, shares, ranks, Materiality, stability et plusieurs métriques ne se somment pas simplement entre mois.

Le Metric Registry doit rester l’autorité d’additivité.

## RISK-04 — Scope mensuel forcé

Réutiliser le ReadModel History inciterait naturellement à forcer les outputs Global au mois, contre le Master.

## RISK-05 — Causalité héritée

Moment/Activity/Place doivent attendre HC2. Global ne peut pas certifier une relation plus forte que la preuve disponible dans History/Facts.

## RISK-06 — Quality state aplati

Une collection vide History peut signifier aucune donnée visible, manque de support ou absence réelle. Global doit relire les envelopes/provenance plutôt que déduire depuis l’UI.

## RISK-07 — Ancien Global pris pour une fondation certifiée

Les ressources `analysis_global_*` actuelles sont `legacy_v1`. Toute similarité de noms avec le Master est insuffisante pour une décision REUSE.

## RISK-08 — History-specific publication semantics copiées

`FROZEN_MONTH` est pertinent pour History. Une publication Global aura son propre `asOf`, ses propres dépendances et éventuellement un comportement de freshness différent.

## RISK-09 — Media / Summary plus tard

Aucun ReadModel History enrichi de présentation ne doit devenir une autorité Global simplement pour faciliter plus tard Media ou Résumé contextuel.

---

# 12. History Polish — vérification de non-blocage

Les sujets suivants sont considérés comme **non bloquants pour Global** tant qu’ils restent strictement présentationnels :

| Sujet History Polish | Bloque Global ? | Raison |
|---|---|---|
| markers Calendar 3 vs 6 | NON | top-N de présentation Calendar, pas vérité analytique Global |
| Hover | NON | preview UX ; Global peut deep-link vers History |
| Week discoverability | NON | navigation UX uniquement |
| Journal UI | NON | présentation d’un snapshot déjà autoritaire |
| responsive | NON | aucune influence sur Facts/Analytics |
| mobile | NON | idem |
| colors | NON | idem |
| spacing | NON | idem |
| animations | NON | idem |
| affordances | NON | idem |
| Bridge label/residual UI bug | NON pour Global | donnée sous-jacente distincte ; bug d’affichage History |
| Minimal labels humains | NON pour Global | contract presentation History ; moteur Minimal reste la vraie dépendance |
| `Voir tous les lieux` | NON pour Global **si Global ne réutilise pas M4** | le top6 confirme justement qu’un RM History ne doit pas être un dataset Global |
| participants Activity d’affichage | NON si c’est uniquement l’UI | devient bloquant seulement si l’autorité participant elle-même est incomplète pour M10 |

## 12.1 Exceptions

Un détail de polish deviendrait un sujet Global seulement si sa correction révélait que la **sémantique amont** était fausse.

Exemples :

- changer 3 → 6 markers : non bloquant ;
- changer la définition de ce qu’est un Moment : bloquant ;
- changer une couleur PARTIAL : non bloquant ;
- découvrir que PARTIAL est calculé comme KNOWN : bloquant ;
- afficher tous les Places : non bloquant ;
- découvrir que `PlaceVisit` signifiait en réalité un point GPS : bloquant.

La frontière est donc sémantique, pas visuelle.

---

# 13. Réutilisation par niveau d’architecture

## 13.1 Niveau A — Canonical / Facts

```text
STRONGLY_REUSE_CANDIDATE
```

à condition de confirmer les gates HC2/HC6.

## 13.2 Niveau B — moteurs / Metric Registry / ProducedMetric

```text
REUSE_OR_ADAPT_CANDIDATE
```

selon sémantique, grain, support et additivité.

## 13.3 Niveau C — artifacts History

```text
SELECTIVE_ADAPT_ONLY
```

Les artifacts peuvent contenir des résultats analytiques utiles mais sont History-scoped. Leur rôle doit être prouvé output par output.

## 13.4 Niveau D — ReadModels History

```text
DO_NOT_REUSE_AS_GLOBAL_ANALYTICS
```

Ils peuvent servir de destinations UX, références de design ou exemples de contrat de visibilité.

## 13.5 Niveau E — snapshots History

```text
DO_NOT_USE_AS_SOURCE_OF_TRUTH
```

Ils matérialisent les ReadModels de D. Leur certification protège History ; elle ne change pas leur niveau d’autorité.

## 13.6 Niveau F — React / UI projections

```text
MUST_NOT_REUSE
```

Aucune logique analytique Global ne doit dépendre de React History.

---

# 14. Matrice par futur module Global

| Global module | Fondations History / partagées candidates | Ne jamais réutiliser directement | HC6 revalidation |
|---|---|---|---|
| M1 Économie | EconomicComponentFact, Actual metric, Typical/Minimal engines, classifications | Bilan M1 snapshot, Bridge UI, historical rank History | HC1 + HC2 + HC3 + HC6 |
| M2 Catégories/Needs | category facts/metric, PurchaseEvent si frequency×ticket, Materiality primitives | MonthCategories RM, Category drawer | HC2/HC3/HC6 |
| M3 Transformations | Economic facts, ActivityOccurrence, PersonDay, LifeEvent/Moment anchors | Calendar markers/ribbons comme moteur ChangePoint ; M3 History matrix | HC2/HC6 |
| M4 Rythme | ActivityOccurrenceFact, PersonDayFact, support/observability | M4 top activities ; Week UI | HC2/HC6 |
| M5 Relations | Facts/métriques B–E partagés, support/coverage | tout insight mensuel comme « relation » | HC2/HC6 + Global D audit |
| M6 Moments | Moment/LifeEvent identities, causal links après HC2, economic facts | Moment drawer et spentDuring comme causal evidence | HC2/HC6 |
| M7 Lieux | PlaceVisitFact, place identities, localized metrics après HC2 | top6 Places, routine inferred label, Calendar presence | HC2/HC6 |
| M8 Consommation | PurchaseEventFact, merchant identity, adjustments | bank operations, Category rows, merchant cards comme corpus | HC6 + future Wallet audit |
| M9 Persona | person IDs + person-scoped outputs B–F | filtres UI History, payer comme beneficiary | HC2/HC6 |
| M10 Nous deux | participant evidence + Activity/Place/Moment Facts | household total, 50/50, co-presence faible | HC2/HC6 |

---

# 15. Materialization / Publication — ce que Global peut reprendre

## 15.1 Primitives probablement communes

```text
generation_key
publication_id
source_revision
analytics_revision
contract_version
method_signature
scope_hash
normalized_param_signature
is_active
invalidated_at
RuntimeSchema validation
atomic activation
rollback
```

## 15.2 Ce qui doit rester propre à Global

```text
Global profile
Global manifest
Global required outputs
Global dependency graph
Global asOf / certifiedThrough
Global facts/dependency hash semantics
Global invalidation scopes
Global client publication pinning
```

## 15.3 Pourquoi HC3–HC5 sont directement importants pour Global

### HC3

Fixe la manière durable de représenter le dependency graph. Global en aura besoin pour déclarer ses dépendances History/Facts.

### HC4

Fixe la discipline immuable/republication. Global doit hériter du même principe « nouvelle vérité = nouvelle génération », pas d’un UPDATE silencieux.

### HC5

Prouve l’invalidation et le cache après republish. Global aura exactement le même problème de cohérence si une correction historique change une publication Global.

### HC6

Fige la baseline de référence et permet à GA0 de remplacer les classifications provisoires de ce rapport.

---

# 16. Ce que GA0 devra revalider après HC6

Le futur `GA0 — Global Reality Check / Prompt Rebase` devra reprendre au minimum les lignes suivantes.

## 16.1 HC2-sensitive

```text
Necessity
Behavior
LifeScope
Moment causal authority
Activity causal authority
PlaceVisit / localized finance doctrine
participant evidence si modifié
```

## 16.2 HC3-sensitive

```text
resourceInputHash closure
publicationFactsHash
manifestHash
factDependencies
externalQueryRefs
format physique durable des dependencies
```

## 16.3 HC4-sensitive

```text
published immutability
stage/finalize guards
new generation requirement
rollback semantics
History-specific rebuild primitive
```

## 16.4 HC5-sensitive

```text
recordAnalyticsMutation caller/boundary
invalidation
History unavailable between correction and republish
new generation activation
client cache generation change
```

## 16.5 HC6-sensitive

```text
final History commit
12-month certification
active publication ids
factsHash / manifest
contract versions
legacy compatibilities retained
final metric versions
```

---

# 17. Questions préparées pour l’audit Global 03

Le prochain audit `03-global-authority-dependency-preaudit.md` devra répondre plus finement à :

1. Pour chaque output M1→M10, quel Fact est l’autorité primaire ?
2. Quels outputs peuvent consommer un `ProducedMetric` partagé ?
3. Quels outputs nécessitent un nouveau moteur historique Global ?
4. Quelles métriques sont additives sur des observations mensuelles ?
5. Lesquelles doivent obligatoirement repartir des Facts bruts ?
6. Quels calculs ont besoin de `CERTIFIED_HISTORY` seulement ?
7. Quels calculs peuvent aussi utiliser `LIVE_TAIL` descriptif ?
8. Quelles dependencies doivent devenir `GLOBAL_HISTORY` ?
9. Quelles dependencies sont `ENTITY_SCOPED` ?
10. Quels outputs Global doivent explicitement dépendre d’une publication History certifiée plutôt que de données live ?

Ce rapport ne répond volontairement pas physiquement à ces questions.

---

# 18. Règles de garde pour tous les futurs prompts Global

Tous les futurs prompts d’implémentation devraient intégrer ces invariants :

1. **Ne jamais utiliser un ReadModel History comme source Analytics Global.**
2. **Réutiliser les Facts communs plutôt que dupliquer une doctrine.**
3. **Réutiliser un moteur uniquement si grain, sémantique, support et additivité sont identiques.**
4. **Ne jamais sommer une métrique non additive parce que des observations mensuelles existent.**
5. **Global ne possède pas de période universelle.**
6. **History snapshot certified ≠ Global fact.**
7. **React ne calcule aucune doctrine Global.**
8. **Un deep link vers History est autorisé ; une dépendance analytique sur l’UI History ne l’est pas.**
9. **`spentDuring ≠ causalCost`.**
10. **`PlaceVisit ≠ transaction place ≠ localized finance`.**
11. **`PurchaseEvent ≠ bank operation ≠ funding`.**
12. **`payer ≠ beneficiary`.**
13. **`household ≠ shared couple`.**
14. **support insuffisant ≠ zéro.**
15. **coverage partielle ≠ 100 %.**
16. **ancienne ressource `analysis_global_*` ≠ REUSE automatique.**
17. **toute classification sensible de cet audit est à rebaser après HC6.**

---

# 19. Carte finale de la frontière

```text
                         ┌────────────────────────┐
                         │ Supabase Canonical V2 │
                         └───────────┬────────────┘
                                     │
                                     ↓
                         ┌────────────────────────┐
                         │ CanonicalRepository    │
                         └───────────┬────────────┘
                                     │
                                     ↓
                         ┌────────────────────────┐
                         │ Facts partagés         │
                         │ Economic / Purchase    │
                         │ Activity / PersonDay   │
                         │ PlaceVisit / relations │
                         └───────────┬────────────┘
                                     │
                          REUSE / ADAPT boundary
                                     │
                    ┌────────────────┴─────────────────┐
                    ↓                                  ↓
         ┌──────────────────────┐          ┌────────────────────────┐
         │ Analytics History    │          │ Analytics Global       │
         │ Calendar/Daily/Month │          │ Trend/Relation/etc.    │
         └──────────┬───────────┘          └───────────┬────────────┘
                    │                                  │
                    ↓                                  ↓
         ┌──────────────────────┐          ┌────────────────────────┐
         │ History artifacts/RM │          │ Global artifacts/RM    │
         └──────────┬───────────┘          └───────────┬────────────┘
                    │                                  │
           DO NOT CROSS AS TRUTH                       │
                    │                                  │
                    ↓                                  ↓
         ┌──────────────────────┐          ┌────────────────────────┐
         │ History UI           │◄─links───│ Global UI              │
         └──────────────────────┘          └────────────────────────┘
```

La frontière saine se situe donc **avant la projection ReadModel**.

Il peut exister des exceptions sélectives au niveau Artifact/ProducedMetric, mais elles devront être justifiées explicitement dans la future `GLOBAL_ANALYTICS_DEPENDENCY_MATRIX`.

---

# 20. Handoff vers HC6 / GA0

## 20.1 Déjà suffisamment sûr pour préparer Global

- les cinq Facts fondamentaux sont de vraies fondations communes ;
- Query API / RuntimeSchema framework sont des primitives génériques solides ;
- Metric Registry / ProducedMetric constituent le bon niveau pour auditer les réutilisations de métriques ;
- Materialization/publication fournit une base technique sérieuse ;
- Global doit avoir ses propres ReadModels et ses propres Analytics multi-grains ;
- History Polish n’est pas un gate Global.

## 20.2 À ne pas figer avant HC6

- classification finale de `Necessity/Behavior/LifeScope` ;
- causalité Moment ;
- doctrine Place/coverage ;
- réutilisation finale des métriques causal/localized ;
- manifest physique partagé ;
- invalidation/republication ;
- stratégie cache après génération ;
- exact mapping physique Global → History dependencies.

## 20.3 À ne pas faire du tout

- utiliser les 15 History ReadModels comme dataset Global ;
- reconstruire Global depuis les snapshots 2025-08 → 2026-07 ;
- utiliser l’oracle History ;
- prendre l’ancienne pile `analysis_global_*` comme spécification ;
- laisser React recalculer Trend/Materiality/relations/persona ;
- forcer tous les modules Global au mois.

---

# 21. Verdict

La frontière History ↔ Global est maintenant suffisamment comprise pour continuer les audits préparatoires sans attendre HC6.

Le principe de réutilisation est clair :

```text
REUSE HIGH IN THE STACK?  NON.
REUSE LOW IN THE STACK?   OUI, SI SÉMANTIQUE IDENTIQUE.
```

Plus précisément :

```text
Canonical        → réutilisation forte candidate
Facts            → réutilisation forte candidate
Metric engines   → réutilisation/adaptation selon grain et contrat
Artifacts        → adaptation sélective seulement
ReadModels       → non comme Analytics Global
Snapshots        → non comme source de vérité Global
React/UI         → non
```

Les inconnues restantes sont correctement bornées aux gates History et au futur audit physique `GA0`. Aucun point de polish Calendar/Week/Journal n’oblige à retarder la préparation de Global.

```text
HISTORY → GLOBAL REUSE BOUNDARY
UNDERSTOOD
```
