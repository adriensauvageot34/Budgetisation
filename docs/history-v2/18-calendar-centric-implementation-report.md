# History V2 — implantation Calendar-centric finale

## 1. Autorités et baseline

Autorités appliquées :

1. `Brief_Technique_Historique_Mensuel_V2_Calendar_Centric_FINAL` ;
2. `Plan_Implantation_Historique_Mensuel_V2_Calendar_Centric_FINAL` ;
3. le code et le schéma live comme preuves physiques.

Baseline Git vérifiée avant modification :

```text
branch=main
HEAD=f2201aa8ab504aef32971b6de0508153e624726a
origin/main=f2201aa8ab504aef32971b6de0508153e624726a
working_tree=clean
```

Baseline Supabase read-only : projet `ipuuhxrblxormwgoaqnz`, douze
publications actives de `2025-08` à `2026-07`, révisions 44 à 55, 907 Query
snapshots et 24 artifacts actifs. Chaque mois expose les quinze familles Query
et les deux artifacts attendus. Aucun read-through actif n'a été observé.

## 2. Impact map OLD → NEW

Les signatures ci-dessous sont calculées par le registry réel et les signatures
OLD ont été recoupées avec les snapshots live de juillet 2026.

| Resource | OLD methodSignature | NEW methodSignature | ReadModel | Shape | Policy | Republication |
|---|---|---|---|---|---|---|
| `history_month_calendar` | `62416a0294ce7e8bb08b1f92a2083854322404cf495a3682f214cfc52beee44c` | `e22d35bf87bcd5ffc91a0c4a68b8509c09854344eaa1787b155d4c600e3e1176` | `@v2 → @v3` | tags, amount view, Ribbons, unassigned | `calendar_semantics@v3`, `calendar_amount_views@v1` | YES |
| `history_week` | `488a70d46bac6b6cd0bf657eb616e00b56d6a8f38a83094dc4b3e01d430b946b` | `feabe7baef95d9b7929ebd0bfaf526cf379e8e9c6238cb6631e8452e3e4a14a7` | `@v2 → @v3` | tags, amount view, Ribbons | mêmes policies Calendar | YES |
| `history_day_journal` | `5072f04a7cfa455073d823f5b1737a03a930f7282fc023b5ae3215160a0137c0` | `016163bec744441c3aa93ae0db4ddd80adb54157f2e1c9e6951d6f63ea66a16f` | inchangé | payload inchangé | signature Calendar transitive | YES |
| `history_month_overview` | `d089ff6d4d3aab473e30fe2b6b4c4aa4c0c3332813db3f9f59b8fc0ca0dcf675` | `79e1539ac970be724807e6a49aed89762cd80a1319a32d4a604691a216ec603a` | `@v1 implicite → @v2` | `narrativeCarousel` | `month_overview_selection@v2` | YES |
| `history_month_life_money` | `fe3bf74c367562f6dcc9b14fad0627c323d0a22d7db69f2658b8b3b3ba4934b8` | `1e2e2c091ebe0582943245bc01c221809a612caf8aa5dfd935bc0f8ce9089500` | inchangé | inchangé | signature Calendar transitive | YES |
| `history_activity_detail` | `73cd3766389ff6b7256c01a598e448ef72c98be84856609e1b1a991c86e0c416` | `125ef8f7b40441717179bba63de74cfb879e8c7e54d4b9e8bc4c87da3e0094b6` | inchangé | inchangé | signature Calendar transitive | YES |
| `history_moment_detail` | `e89ff71e251d902fae4619822b0aa4ac6543f79124daa415811a5b497f1f88a4` | `6e93cf5253d7497ce9ef605c6ef4dbc6d7fb298f0200bd6a97f06738f7928763` | inchangé | inchangé | signature Calendar transitive | YES |
| `history_place_detail` | `f4726916eac3956838912135bc22280e092e555fb899c0c23ad7cd94a51eb3c8` | `541363d7dcfe1a0263448b75983e40e6aed0b9e21ce26cc96bc9943cd699a28d` | inchangé | inchangé | signature Calendar transitive | YES |

Les sept autres familles conservent leur signature courante :

| Resource | NEW methodSignature |
|---|---|
| `history_month_balance_summary` | `544efc60513f4d926877aebf7d6c78151a2c37ec981363ba634f848e4da72f05` |
| `history_bank_economy_bridge` | `4d9fc4e300f241e91805dbf2364ec8a5eff79ce9081059548c1059aa07ce860a` |
| `history_month_categories` | `860deebcb0664bce7691f8f2de6193f8fd633e92a4052d3e048024c7cd82348c` |
| `history_category_detail` | `ed84263e57c20f516f169fd195accc5a40238514df78d2739fa74ab6f19f9140` |
| `history_month_spending_nature` | `465ac1eaa14fc54339ce4cdbdc8d46cd40606bae988a21c71e4bcf041fba706a` |
| `history_spending_segment_detail` | `de6260311627fb1ae98d05eb39074153bca967f978226c1d927e8fdb8b2be80b` |
| `history_minimal_preview` | `3b25abf864250763ca7f8796b3a3f5946ef9134d566b55fbd2ff86f37640f9a0` |

Elles restent obligatoirement présentes dans chaque nouvelle génération : le
pipeline republie une fermeture mensuelle complète et ne mélange pas des
générations. L'artifact `calendar_semantic_month` passe de `@v3` à `@v4` ;
`daily_economic_ledger_month@v1` ne change pas.

## 3. Architecture implantée

### Surface unique

- route canonique : `/historique/YYYY-MM` ;
- `view=calendar` et `view=balance` sont redirigés vers la route sans `view` ;
- Month charge seulement `history_month_calendar` et
  `history_month_overview` ;
- Week charge `history_week` et l'Overview du mois possédant le jeudi ;
- le tab et le montage initial du Bilan sont retirés ;
- les quinze contrats, M1–M4, snapshots historiques et code Balance restent
  conservés pour rollback.

Le header rend `Débits + Dépenses | mois + filtres | carrousel narratif`. Les
changements de filtres utilisent `router.replace(..., { scroll: false })`.
Le panneau Filtres est dismissible par clic extérieur/Échap et restaure le
focus. Le carrousel est manuel, avance toutes les sept secondes, se met en pause
au survol/focus et réutilise les highlights OLD pendant la fenêtre de
compatibilité.

### Contrats Calendar

Les dix `CalendarFilterTag` et les cinq presets sont centralisés dans
`src/core/history-v2/calendar-filter.ts`. Les 25 types Life Event/Activity et
les 20 types Moment possèdent un mapping serveur exhaustif. Aucun fallback de
catalogue ne classe silencieusement un type contractuel.

Le payload NEW ajoute :

- `CalendarItemSummary.filterTags`, `itemKind`, `targetRef` ;
- `economicAmountExcludingFixed` pour Month, Week et Hover ;
- dates événement et `targetRef` sur les Ribbons normaux ;
- `MonthUnassignedTimingSummary` avec un type dépense sans date obligatoire ;
- `MonthQuickOverviewReadModel.narrativeCarousel`.

`EconomicExpenseSummary.economicDate` reste obligatoire. Les RuntimeSchemas
NEW exigent tous les nouveaux champs. Les schemas OLD sont séparés et stricts ;
ils ne rendent pas les champs NEW optionnels.

### CalendarEconomicProjection

Une primitive spécialisée, séparée du moteur Calendar sémantique, consomme :

- `EconomicComponentFact` ;
- les allocations du Daily Economic Ledger ;
- la taxonomie canonique ;
- une qualification canonique `componentKey → RecurrenceQualification`.

Elle publie les markers `GROCERY`, `BAKERY_MEAL`, `DINING`, `HEALTH`,
`TRANSPORT_SPEND`, `SUBSCRIPTION` et `FIXED_CHARGE`, le montant quotidien hors
fixe, l'information non affectée au jour, ses dépendances et son hash d'entrée.
Plusieurs Courses du même jour forment un groupe ; `rawOccurrenceCount` reste
le nombre de composantes sources.

`EXCLUDE_FIXED` additionne seulement les allocations dont le comportement est
exactement canonique `Variable`. `Fixe` est exclu. `UNKNOWN/CONFLICT` ne devient
jamais Variable et produit `PARTIAL` sur la somme affirmable.

### Décision SUBSCRIPTION

`SUBSCRIPTION` est activé sans heuristique. La fermeture canonique relie le
`componentKey` à son `sourceOperation`, puis à `operations.recurrence_series_id`
et à une série Active avec cadence. La projection ne lit aucune table au milieu
du moteur. Elle ne teste ni merchant, ni montant, ni raw bank label.

La série Qobuz de juillet est `Active`, cadence `Mensuelle`, et la sous-catégorie
canonique est `numerique__streaming_musical`. Cette seule preuve autorise le
marker `Abonnement musique`.

### Ordre, filtres, Ribbons et unassigned timing

Le serveur ordonne : Life dominant, Life standard, Economic narratif,
Economic quotidien, Economic faible/fixe/abonnement. React part toujours de
`orderedMarkerGroups`, applique les tags publiés puis prend le préfixe 3/6. Il
ne lit plus `visibleMarkers` pour filtrer et n'appelle aucun `.sort()` métier.
Un overflow PARTIAL est libellé « observés » et n'est jamais présenté comme un
total exact.

Les Ribbons normaux et overflow utilisent le même convertisseur générique de
cibles Journal/Moment/Activity/Place. Leur libellé reste sans date redondante ;
la période publiée porte `eventStartDate/eventEndDate`.

Les dépenses sans date économique exacte ne sont injectées dans aucune cellule.
Le résumé mensuel expose count, montant affirmable, trois dépenses au maximum,
hidden count, sourceRefs et Quality. Le filtre `UNASSIGNED_TIMING` contrôle son
affichage mensuel.

### Narrative carousel

Le builder réutilise l'ordre serveur des highlights et la primitive serveur de
classement des lieux. Il tisse `H1, P1, H2, P2…`, sans appel Overview → M4, sans
remplissage artificiel, et publie une cible sémantique par carte. Aucun score ni
rang technique n'entre dans le payload visible.

## 4. Compatibilité et activation

Le registry d'identité accepte exactement :

1. la signature NEW courante ;
2. la signature Calendar-centric OLD calculée et connue ;
3. la variante visible-gaps legacy seulement pour les ressources historiques
   déjà autorisées.

Une signature inconnue est refusée. Un payload OLD est validé par son schema
OLD, un payload NEW par son schema NEW, et un payload invalide devient
`TEMPORARY_UNAVAILABLE`. Aucun passthrough, schema permissif ou read-through
n'a été ajouté.

## 5. Preuves ciblées

| Preuve | Résultat |
|---|---:|
| catalogues 25 + 20 et filtres URL/presets | PASS |
| Calendar/Daily/Projection, juillet et strict artifact | 42/42 PASS |
| Calendar/Week/Overview ReadModels, OLD/NEW | 27/27 PASS |
| matérialisation/signatures/compatibilité | 76 checks PASS |
| frontend Calendar-centric | 7/7 resources, 15/15 contrats, 14/14 checks PASS |
| architecture imports | 459 fichiers PASS |
| `tsc --noEmit` | PASS |
| Next 16 production build | PASS |
| `git diff --check` | PASS |

Fixtures discriminantes juillet :

- 08/07 Boulangerie → `BAKERY_MEAL` ;
- 09/07 Courses alimentaires → `GROCERY` ;
- 13/07 deux composantes Courses → un `GROCERY`, `rawOccurrenceCount=2` ;
- 13/07 Qobuz récurrent canonique → `SUBSCRIPTION` ;
- 13/07 montant hors fixe exclut Qobuz ;
- comportement inconnu → somme affirmable `PARTIAL`.

## 6. Publication et rollback

La séquence opérationnelle obligatoire est : code NEW Production READY sur le
SHA exact, preuve read-only que les snapshots OLD restent des hits sans
read-through, puis DRAFT/STAGE des douze mois, barrière globale 12/12, et enfin
Finalize chronologique. Aucun Finalize n'est autorisé avant la barrière.

Chaque DRAFT doit contenir quinze familles, deux artifacts, toutes les Query
keys, RuntimeSchemas valides, `contractVersion=v2`, les policyVersions propres
à chaque ressource et un `factsHash` commun à sa publication. Les générations
OLD restent disponibles et la primitive transactionnelle de rollback existante
reste inchangée.

Le résultat opérationnel post-déploiement est volontairement remis dans le
rapport final du run : il ne peut être connu avant le commit unique dont le SHA
doit d'abord être Production READY. Aucun second commit documentaire n'est créé,
afin de respecter l'exigence d'un commit et d'un push uniques.

## 7. Gates code avant activation

```text
HISTORY_CC_BASELINE_GATE = PASS
HISTORY_CC_FRONTEND_SHELL_GATE = PASS
HISTORY_CC_CONTRACT_GATE = PASS
HISTORY_CC_ECONOMIC_PROJECTION_GATE = PASS
HISTORY_CC_CALENDAR_SEMANTIC_GATE = PASS
HISTORY_CC_NARRATIVE_GATE = PASS
HISTORY_CC_COMPAT_GATE = PASS
HISTORY_CC_CODE_GATE = PASS
```

## 8. Cross-month target scope correction

### Cause racine et reproduction

Le premier préflight live du code Calendar-centric, lancé sans aucune écriture,
s'est arrêté sur la grille de novembre 2025 : le jour de bord `2025-10-27`
provenait de l'artifact octobre et portait un item LIFE `pharmacie`. La projection
créait pourtant `history_activity_detail(activityTypeKey=pharmacie)` dans le
mois propriétaire novembre. Le détail est légitimement absent de novembre : ce
n'était ni une donnée manquante ni une raison de fabriquer un détail cross-month.

### Doctrine appliquée

`targetForCalendarItem()` reçoit désormais explicitement `ownerMonth`,
`sourceArtifactMonth` et `fallbackDate`. Lorsque source et propriétaire sont
identiques, la hiérarchie sémantique existante reste inchangée. Lorsqu'ils
diffèrent, Marker, Hover, Ribbon normal et Ribbon overflow projettent un
`history_day_journal` à la date réelle, résolue strictement dans l'ordre
`anchorDate`, `startDate`, date du caller. Aucune date bancaire, heuristique,
extension de `QueryTargetRef`, nouvelle ressource, policy ou version n'a été
introduite.

Le Month transmet le mois sélectionné comme propriétaire. La Week transmet le
mois du jeudi. Chaque candidate Ribbon conserve `artifact.month` comme mois
source. `JournalPanel` continue de requêter avec `yearMonthOf(date)` ; aucun
changement frontend n'est nécessaire.

### Tests discriminants

- Marker adjacent `2026-04-27` visible dans mai : Journal du 27 avril ;
- Marker local `pharmacie` : cible Activity conservée ;
- Ribbon adjacent normal et overflow : Journal de la date réelle ;
- Ribbon local : cible Activity conservée ;
- Week cross-month : ownerMonth du jeudi et Journal pour l'artifact adjacent ;
- manifest : aucun détail `pharmacie` local créé par le jour de bord et
  `externalQueryRef` Journal propriétaire avril présent ;
- frontend : preuve statique `JournalPanel → scope(yearMonthOf(date))`.

Résultats avant second commit : Calendar/Daily `42/42`, ReadModels `27/27`,
matérialisation `76 checks`, frontend `14/14`, `tsc --noEmit`, build Next 16 et
`git diff --check` : PASS.

Le SHA du second commit, son état Production READY, le préflight global et la
publication finale sont nécessairement attestés dans le rapport terminal du run :
un fichier ne peut contenir le SHA cryptographique du commit qui le contient,
et aucun troisième commit documentaire n'est autorisé après publication.
