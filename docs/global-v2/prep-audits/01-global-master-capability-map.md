# Analyse Globale V2 — cartographie produit et analytique exhaustive

> **Nature du document** : audit de préparation, sans implémentation.
>
> **Aucune modification applicative, aucune migration et aucune écriture Supabase n'est réalisée par ce lot.**
>
> **Autorité cible** : `Brief_Technique_Analyse_Globale_V2_FINAL_EXHAUSTIF_MASTER.docx`, version 3.0 FINAL VERROUILLÉ — 30 août 2026.
>
> **Baseline repository distante observée** : branche `main`, commit `819f2d7024066f32492860264362fcf509bfce5c` au démarrage de cet audit préparatoire. Le HC1 communiqué par l'utilisateur est `PASS`, mais son état local/Codex n'est pas encore observable dans cette baseline GitHub distante ; les conclusions techniques sensibles restent donc explicitement à revalider après `POST_HISTORY_ENTRY_GATE`.
>
> **État History déclaré pour la préparation** : HC1 `PASS`; HC2 → HC6 non fermés.
>
> **Principe** : le Master Global fixe la **CIBLE**. Supabase V2 fixe la vérité Canonical réellement disponible. Le code courant est l'**EXISTANT** et ne devient jamais une troisième doctrine métier.

---

# 1. Executive summary

L'Analyse Globale V2 cible n'est pas une simple extension du Bilan mensuel ni une agrégation de douze ReadModels History. Elle constitue un produit analytique multi-grains, composé de **10 modules déterministes**, d'une **dimension sociale transversale**, d'une publication Global cohérente et, en dernier, d'un **Résumé contextuel manuel** qui raconte exclusivement des vérités déjà calculées et certifiées.

La cible normative conserve la chaîne :

```text
Sources canoniques
→ CanonicalRepository
→ FactSourceResolver
→ Facts certifiés
→ Analytics / moteurs spécialisés
→ Artifacts / métriques / patterns / insights
→ ReadModels Global indépendants
→ Query API
→ React
```

React ne doit donc jamais découvrir ou reconstruire une doctrine analytique manquante. Il ne calcule ni Typical/Minimal, ni tendance, ni rupture, ni significativité d'une relation, ni routine, ni importance d'un lieu, ni partage de couple.

Le Master est déjà extrêmement structuré : son registre de scope recense **364 capabilities**, dont **276 `MUST_V1`**, **49 `CONDITIONAL_V1`** (`18 DATA_GATED`, `31 AUTHORITY_GATED`), **15 `LATER`** et **24 `FORBIDDEN`**. Trente-quatre capacités exigent explicitement une décision ou une exécution post-History. Cette cartographie ne remplace donc pas le futur audit CIBLE ↔ EXISTANT : elle prépare la cible que cet audit devra confronter au repo et à Supabase après HC6.

Le principe temporel central est également fixé : **Global n'a aucune période universelle**. Chaque analyse utilise son grain naturel et le maximum de données fiables pertinentes pour la question, avec son propre support, sa propre couverture et son propre état de connaissance. Deux corpus sont distingués : `CERTIFIED_HISTORY`, qui peut nourrir les références et conclusions structurelles, et `LIVE_TAIL`, descriptif mais incapable de modifier silencieusement Typical, tendances, ruptures, relations, Persona ou Synthèse IA certifiée.

L'ordre conceptuel d'implémentation est verrouillé :

```text
A Foundations
→ B Finance (M1–M2)
→ C Temporal / Life (M3–M4)
→ D Relations (M5)
→ E Moments / Geography (M6–M7)
→ F Consumption (M8)
→ G People / Social (M9–M10 + social)
→ H Query / ReadModels / UX
→ I Contextual Summary
```

Cet ordre ne devient opératoire qu'après : History stabilisé, audit post-History CIBLE ↔ EXISTANT, résolution des `AUTHORITY_GATED`, construction de la vraie `GLOBAL_ANALYTICS_DEPENDENCY_MATRIX` physique et classification prouvée `REUSE / ADAPT / NEW_*`.

## 1.1 Point majeur sur l'existant actuel

Le repo contient déjà une ancienne pile `analysis_global_*` : route `/historique/analyse/global`, ReadModels `Initial/Baseline/Typical/Evolution/Habits/Profiles/Universe`, Query sources et tests. **Cette pile n'est pas l'autorité produit cible**. Le registre de contrats courant classe explicitement ses ressources `analysis_global_*` dans la famille `legacy_v1`. Le futur audit devra donc distinguer soigneusement les primitives techniques potentiellement réutilisables de la doctrine et des ReadModels legacy à remplacer ou adapter.

Deux écarts visibles suffisent à montrer pourquoi une reprise directe serait dangereuse :

- le type Global existant porte une `observationWindow`, alors que le Master verrouille l'absence de période Global universelle ;
- la route existante est `/historique/analyse/global`, alors que la cible UX est une page produit unique `/analyse-globale` avec dix modules et une publication cohérente.

Ces écarts ne sont **pas corrigés dans cet audit**.

---

# 2. Sources normatives et documents de préparation

## 2.1 Autorité normative Global

Source prioritaire et unique pour la cible :

- `Brief_Technique_Analyse_Globale_V2_FINAL_EXHAUSTIF_MASTER.docx`.

Le Master indique explicitement qu'il remplace l'usage opérationnel séparé des anciens lots et consolidations pour l'Analyse Globale. Les documents auxiliaires ci-dessous servent de registres ou de cartes d'exécution, sans pouvoir supprimer ou simplifier silencieusement une exigence du Master.

## 2.2 Registres Global auxiliaires

- `GLOBAL_CAPABILITY_SCOPE_REGISTRY_Analyse_Globale_V2_FINAL.docx` ;
- `GLOBAL_AUTHORITY_GATED_REGISTRY_Analyse_Globale_V2_FINAL.docx` ;
- `GLOBAL_TEST_CATALOG_Analyse_Globale_V2_FINAL.docx` ;
- `GLOBAL_CONCEPTUAL_DEPENDENCY_AND_IMPLEMENTATION_PLAN.docx`.

## 2.3 Architecture V2 / repository

- `AGENTS.md` ;
- `docs/specs/SOURCE_OF_TRUTH.md` ;
- `docs/specs/ANALYTICS_MATERIALIZATION.md` ;
- Query API / UI Foundations existants uniquement comme **EXISTANT à auditer**, jamais comme doctrine concurrente.

## 2.4 History

- audits History 20 → 24 ;
- `Budgetisation_V2_Historique_Mensuel_Rapport_Consolide_Audits_20_24.docx` ;
- HC1 communiqué `PASS` : oracle retiré de la construction des payloads History, Analytics officiels désormais sources de l'Actual/Typical/Minimal/catégories ;
- HC2 → HC6 : à terminer avant le `POST_HISTORY_ENTRY_GATE`.

Les conclusions History encore explicitement non sûres pour Global tant que HC2–HC6 ne sont pas fermés concernent notamment la classification M3, la causalité Moment, les Places, la closure physique des dépendances, l'immutabilité/correction et la recertification finale.

## 2.5 Chantiers futurs à préserver

- `Brief_Technique_Resume_Contextuel_Budgetisation_V2.docx` ;
- `Brief_Technique_Integration_Titres_Restaurant_SWILE_PILOTE.docx` ;
- `Brief_Technique_Diagnostic_Qualite_Budgetisation_V2_V1.1.docx` ;
- `Brief_Technique_Console_Import_Actualisation_Budgetisation_V2.docx` ;
- UI Foundations Media / architecture média existante de présentation.

---

# 3. Règles structurantes de la cible Global

## 3.1 Pas de période Global universelle

Global ne commence jamais par un sélecteur « 12 derniers mois ». Une analyse financière peut disposer de 12 mois certifiés tandis qu'une activité dispose de 20 mois, qu'un produit n'en possède que 8 et qu'une relation croisée utilise seulement l'intersection des unités observables dans les dimensions requises.

Chaque résultat doit donc porter son propre : grain naturel, support, couverture, fenêtre réellement utilisée, limites/gaps, état de connaissance et révision/provenance pertinente.

## 3.2 `CERTIFIED_HISTORY` vs `LIVE_TAIL`

`CERTIFIED_HISTORY` est l'autorité des conclusions structurelles : Typical, Minimal, tendances, stabilité, comparaisons historiques, ruptures, transformations, habitudes, relations Vie ↔ Argent, Persona comparatif et Synthèse IA.

`LIVE_TAIL` peut enrichir les compteurs et explorations actuelles, montrer des nouvelles occurrences ou confirmer provisoirement qu'une tendance déjà établie continue. Il ne peut pas être l'unique preuve d'une nouvelle tendance ou modifier une référence historique certifiée.

## 3.3 Natural grain preservation

| Famille | Grain naturel principal |
|---|---|
| Finance | mois / jour / composant économique selon question |
| PersonDay | personne × jour |
| Activity | occurrence humaine |
| Place | visite / jour de visite / relation lieu selon analyse |
| Moment | Moment / série comparable / fenêtre du Moment |
| Purchase | PurchaseEvent ; PurchaseLine uniquement si autorité existe |
| Persona | métrique person-scoped + support comparable |
| Nous deux | occurrence / visite / Moment partagé avec preuve |
| Relations | unité naturelle de la relation + population comparable |

Forcer toutes les familles au mois serait une violation de cible.

## 3.4 Knowledge states

Les états `KNOWN / PARTIAL / UNKNOWN / NOT_APPLICABLE / CONFLICT` restent distincts. `PARTIAL` doit conserver sa raison (`OBSERVED_SUBSET`, `LOWER_BOUND`, `MISSING_INTERVALS`, `MISSING_LINKAGE`, `PARTIAL_SOURCE` ou contrat équivalent). Un manque de support n'est ni un zéro ni automatiquement une indisponibilité de la capability.

## 3.5 Publication et récit utilisateur

La cible UX est une seule page Global cohérente : Synthèse IA puis M1 → M10 dans un ordre stable. Chaque module reste modulaire côté Query. Le manifest Global orchestre la cohérence de publication ; il ne devient pas une nouvelle vérité analytique. Une publication plus récente disponible pendant la lecture doit être annoncée, jamais hot-swappée silencieusement au milieu du scroll.

---

# 4. Carte des autorités conceptuelles communes

| Autorité conceptuelle | Rôle Global | Modules principaux |
|---|---|---|
| `EconomicComponentFact` | vérité économique attribuable et classifiable | M1, M2, M3, M5, M6, M7, M9 |
| `ActivityOccurrenceFact` | occurrence humaine réelle, participants, activité | M3, M4, M5, M9, M10 |
| `PersonDayFact` | contexte quotidien personne/jour | M3, M4, M5, M9 |
| `PlaceVisitFact` | visite humaine, pas point GPS brut | M3, M4, M5, M7, M9, M10 |
| `PurchaseEventFact` | grain achat humain | M2, M5, M8, M9 |
| Moments / Life Events | expériences, transformations, ancrages, participation | M3, M5, M6, M9, M10 |
| classifications catégories / Needs | destination et besoin financé | M1, M2, M5, M9 |
| recurrences / series | cadence et structure | M1, M4, M8 |
| Merchant identities | marchand vs établissement vs processor | M2, M8, M9 |
| produit / ligne achat | enrichissement consommation si autoritaire | M8, éventuellement M9 |
| participant evidence | présence partagée et social | M6, M9, M10, Social |
| routes / véhicule / carburant | mobilité avancée si autorités disponibles | M7 |

**Invariant** : Persona et Nous deux consomment les mêmes Facts/Analytics partagés ; ils ne recréent jamais une deuxième comptabilité.

---

# 5. Module 1 — Notre fonctionnement économique

**Objectif utilisateur** : comprendre combien la vie coûte habituellement, quel est le socle réaliste, comment la structure évolue et quelle part paraît stable, récurrente ou en changement.

**Questions** : Actual, Typical, Minimal, gap Typical↔Minimal, structure nécessité/fixe-variable/LifeScope, évolution, stabilité/volatilité, changement récent, tendance moyen terme, récurrences et contributeurs.

**Capabilities structurantes `MUST_V1`** : Actual économique, Typical, Minimal, Typical↔Minimal gap, structure par nécessité, fixe/variable, LifeScope, economic evolution series, stability/volatility, Recent Change, Medium-Term Trend, Structural Monthly Equivalent, structural recurrences, evolution contributors, recurrence drill-down, economic module drill-down.

**Conditionnelles DATA_GATED** : évolution long terme, current-regime reference, périodicité si support suffisant.

**Grain / scope** : household, mois certifié pour références mensuelles, composant économique pour structure/contributeurs, récurrence à son grain naturel.

**Facts / Analytics** : `EconomicComponentFact`, classifications, séries certifiées, moteurs Typical/Minimal, Materiality, Trend/Stability, recurrence analytics, contributors.

**Sorties** : référence économique, structure, tendances/stabilité qualifiées, récurrences, contributeurs et méthode/support.

**Drill-downs** : évolution, structure, récurrence, contributeurs vers entités seulement si autorité suffisante.

**États / risques** : UNKNOWN/PARTIAL avec historique ou classifications insuffisants ; Minimal ne devient jamais un objectif ; mois courant incomplet ne nourrit pas une tendance certifiée ; métrique non additive jamais sommée arbitrairement.

**Dépendances** : Phase A ; alimente M3, M5, M9 et Synthèse IA.

---

# 6. Module 2 — Catégories & Needs

**Objectif utilisateur** : comprendre où va l'argent, quels besoins il finance et ce qui explique l'évolution.

**Questions / capabilities** : Category/Subcategory/Need aggregation, shares, récent/historique, reconciliation, contributor decomposition, cross-dimensional drilldown ; frequency×ticket par catégorie data-gated.

**Grain** : mois pour séries, composant économique pour classification, PurchaseEvent/occurrence lorsque la question descend au grain achat/activité.

**Facts / Analytics** : EconomicComponentFact, catégories/sous-catégories/Needs, PurchaseEventFact ou ActivityOccurrenceFact si nécessaire ; aggregation, Typical par dimension, Materiality, contributors.

**Sorties / drill-downs** : catégories/Needs structurants, séries, facteurs d'évolution, vues croisées seulement avec support/couverture.

**États / risques** : couverture Need partielle ≠ 100 % Actual ; catégorie inconnue ≠ zéro ; aucun driver purchase/merchant inventé.

**Dépendances** : A+B ; alimente M3, M5, M8, M9, résumé.

---

# 7. Module 3 — Chapitres & transformations

**Objectif utilisateur** : identifier quand la vie a réellement changé et distinguer changement durable, nouvelle phase, chapitre temporaire et phase encore en cours.

**MUST_V1** : change-point detection, robust before/after windows, persistence gate, DURABLE_CHANGE, NEW_PHASE, TEMPORARY_CHAPTER, ongoing phase, reclassification, multi-domain fusion, semantic anchors, TransformationSignalCatalog, current-regime handoff.

**Grain** : dépend du signal — mois, personne-jour, occurrence, visite, Moment — sans tout forcer au mois.

**Entrées / Analytics** : outputs Finance et M4, puis enrichissements E/F ; ChangePoint, before/after robust statistics, persistence, multi-domain fusion.

**Sorties / drill-downs** : transformation, type, fenêtre, signaux, niveau de preuve, état, liens vers preuves sources.

**États / risques** : corpus trop court → UNKNOWN/absence de conclusion ; LIVE_TAIL seul ne certifie pas une rupture ; simple coïncidence temporelle ≠ transformation causale.

**Dépendances** : A+B+C/M4 ; enrichissable par E/F ; alimente current regime, M5, M9.

---

# 8. Module 4 — Notre rythme de vie & nos habitudes

**Objectif utilisateur** : comprendre activités, travail, routines, cadences et habitudes qui apparaissent/disparaissent.

**MUST_V1** : observable-normalized occurrence rates, activity cadence, day-context analytics, habit appearance/disappearance/reactivation, routine extraction, CORE/OPTIONAL tokens, prevalence, evolution, current-regime rhythm.

**DATA_GATED** : weekly cycles, annual seasonality, anchored cycles, causal routine cost.

**Grain** : ActivityOccurrenceFact à l'occurrence, PersonDayFact au jour/personne, taux normalisés par observabilité.

**Sorties** : activités/routines structurantes, cadence, évolution, day contexts, evidence drill-down.

**Risques** : counts bruts incomparables ; absence en période non observable ≠ disparition ; saisonnalité sans corpus ≠ conclusion.

**Dépendances** : A + Facts humains ; alimente M3, M5, M9, M10, Social.

---

# 9. Module 5 — Vie ↔ Argent

**Objectif utilisateur** : identifier des associations robustes entre situations de vie et comportements économiques, sans causalité abusive.

**MUST_V1** : RelationshipCatalog whitelist, natural-grain units, comparable populations, 1:1 matching/stratification, support after matching, binary-effect and monetary paired statistics, bootstrap uncertainty, BH/FDR, temporal robustness/LOMO, temporal states, association-only language, PERSON/HOUSEHOLD/SHARED scopes, no cascade inference.

**Grain** : celui de la relation — personne-jour, occurrence, visite, mois ou autre unité whitelistée.

**Entrées / Analytics** : B/C + Economic/PersonDay/Activity Facts, puis certains outputs E/F ; matching, effect statistics, uncertainty, FDR, robustness.

**Sorties / drill-downs** : association, effet, support, incertitude, robustesse, état temporel, preuves.

**Risques** : corrélation → causalité, p-hacking, relation hors catalogue, populations incomparables, multiplicité non contrôlée.

**Dépendances** : A+B+C ; core avant E possible, relations geo/mobility activées après E.

---

# 10. Module 6 — Moments & expériences

**Objectif utilisateur** : comparer des expériences narratives et distinguer coût réellement causal de dépenses simplement concomitantes.

**MUST_V1** : Moment Family/Type/Series, comparabilité versionnée, comparison tiers, causal Moment cost, preparation/core/after-effect/adjustment roles, net/gross/refund composition, comparative support, low-cost important Moments, cost/day, peer robust stats, repetition.

**Grain** : Moment, série comparable, fenêtre temporelle ; causal spend séparé du spentDuring.

**Entrées / Analytics** : Moments/Life Events, participant evidence, Economic Facts avec autorité causale, Activity links, adjustments/refunds.

**Sorties** : importance narrative, causalCost, spentDuring distinct, comparaison, séries/répétitions, preuves.

**Risques** : spentDuring ≠ causalCost ; label similaire ≠ comparabilité ; faible coût ≠ faible importance.

**Dépendances** : A + autorité causalité History à revalider HC2 ; alimente M5, M9, M10, Media, résumé.

---

# 11. Module 7 — Nos lieux & notre mobilité

**Objectif utilisateur** : comprendre les lieux structurants, leur évolution et la mobilité sans sur-inférence GPS.

**MUST_V1 lieu** : PlaceVisitFact authority, visit count/days/duration, STOP/STAY semantics, nested place hierarchy, resolution level, place importance, routine-place penalty, current/historical importance, place evolution, NEWLY_OBSERVED/REGULAR/GROWING/DECLINING/DORMANT/ROLE_ENDED, drill-down.

**AUTHORITY_GATED mobilité** : MobilityLeg, RouteDefinition, route frequency, distance, FuelPriceResolver, estimated fuel cost. Localized finance est data-gated par couverture réelle.

**Grain** : visite/lieu, jour de visite, MobilityLeg/route si autorité ; composant économique seulement avec lieu de transaction attribué.

**Risques** : GPS ≠ visite ; visite ≠ transaction place ; transaction place ≠ présence personne ; aucune distance/coût sans autorité.

**Dépendances** : A + geo authorities ; enrichit M3/M5/M9/M10.

---

# 12. Module 8 — Nos habitudes de consommation

**Objectif utilisateur** : analyser achats, marchands, fréquence, tickets, paniers, produits, cycles et substitutions lorsque la donnée le permet.

**MUST_V1** : PurchaseEventFact identity, PurchaseAdjustmentFact, split payments, cash/mixed-operation/refund semantics, Merchant, MerchantEstablishment, marketplace/processor, retained purchase count, frequency, mean/median ticket, frequency×ticket, merchant evolution, purchase/merchant drilldown.

**AUTHORITY_GATED produit** : PurchaseLineFact, ProductFamily/Variant/Format, normalized unit, ProductAcquisitionOccurrence, PurchaseCycleEngine, lifecycle, substitution, product price analytics, PersonalConsumptionPriceIndex. Merchant substitution est data-gated.

**Grain** : PurchaseEvent pour le cœur, PurchaseLine/acquisition only if authoritative.

**Risques** : refund ≠ achat négatif ; mixed purchase unresolved → PARTIAL/MISSING_LINKAGE ; titulaire carte ≠ bénéficiaire ; beneficiary unknown → UNKNOWN dans une analyse personnelle.

**Compatibilité Wallet obligatoire** : `purchase ≠ funding ≠ bank transaction` et `economic consumption ≠ wallet funding ≠ bank flow`.

**Dépendances** : A + PurchaseEvent authority ; alimente M5, M9 et futur Wallet.

---

# 13. Module 9 — Nos profils — Adrien & Manon

**Objectif utilisateur** : faire ressortir quelques différences réellement distinctives et comparables entre les personnes.

**MUST_V1** : individual metrics, common comparable support, normalization, Persona materiality, current regime, exceptional exclusion, PersonaDifferenceEngine, deterministic ranking, anti-redundancy, diversity, hysteresis, top-card budget 4–6, non-moral language, provenance, payer != beneficiary.

**Conditionnel** : ObservedPersonalTypicalCost DATA_GATED ; enriched PersonalReferenceCost AUTHORITY_GATED.

**Grain** : personne × grain naturel de la famille ; common comparable support pour la comparaison.

**Entrées** : métriques person-scoped B–F ; M9 sélectionne/compare et ne recrée aucun moteur.

**Risques** : moralisation, familles forcées, counts non normalisés, payer=beneficiary.

**Dépendances** : B–F + current regime M3 ; Phase G seulement après stabilisation.

---

# 14. Module 10 — Nous deux

**Objectif utilisateur** : identifier ce qui est réellement partagé par le couple avec preuve de participation.

**MUST_V1** : SharedParticipationResolver, PRESENT/ABSENT/UNKNOWN/CONFLICT, EXPLICIT_SHARED/CANONICAL_SHARED/STRONG_COPRESENCE, SharedInferenceCatalog, sharedObservableSupport, normalized shared rates, SharedActivityOccurrence, shared place visit, basic shared Moment relation, no fake Couple PersonId, no 50/50.

**Conditionnel** : shared routines/evolution/causal shared experiences/pair-only vs with-externals DATA_GATED ; mobility/contact/group enrichments AUTHORITY_GATED.

**Grain** : occurrence/visite/Moment avec participant evidence.

**Risques** : opération bancaire ≠ preuve couple ; domicile/bureau co-présent ≠ activité partagée ; courses ordinaires ≠ automatiquement couple ; 54 € foyer ≠ 27/27 inventé.

**Dépendances** : B–F + participant model ; alimente résumé/social.

---

# 15. Dimension sociale transversale

La vie sociale reste une dimension, pas un module 11.

**MUST_V1 invariants** : external contact ≠ household Person ; no social relation from frequency alone ; no costOfContact ; no place→person presence inference ; no automatic social graph ; unresolved external participants tolerated.

**AUTHORITY_GATED** : Contact, ContactAlias, ContactRelation, ContactGroup et participation links s'ils existent réellement. Leur absence ne bloque pas Global.

**Alimente** : M4, M5, M6, M7, M9, M10.

---

# 16. Synthèse des 10 modules

| Module | Question centrale | Grain dominant | Autorités clés | Famille Analytics | Risque majeur |
|---|---|---|---|---|---|
| M1 | Comment fonctionne notre économie ? | mois/composant/récurrence | EconomicComponentFact | Typical/Minimal/Trend/Stability | agrégation/référence fausse |
| M2 | Où va l'argent et pourquoi ? | mois/composant/purchase | EconomicComponentFact + classifications | Aggregation/Materiality | surdéclarer couverture |
| M3 | Quand la vie change-t-elle vraiment ? | multi-grain/fenêtres | outputs B/C + anchors | ChangePoint/Transformation | variation ponctuelle = rupture |
| M4 | Quelles routines/cadences ? | occurrence/person-day | ActivityOccurrenceFact, PersonDayFact | Rate/Cadence/Routine | counts non comparables |
| M5 | Quelles associations sont robustes ? | grain naturel relation | Facts B–E | RelationshipEngine | causaliser association |
| M6 | Comment comparer les expériences ? | Moment/série | Moments + causal links | MomentComparison | causalCost/spentDuring |
| M7 | Quels lieux/mouvements structurent la vie ? | visit/route | PlaceVisitFact + optional mobility | Place/Geo/Mobility | GPS over-inference |
| M8 | Comment achetons-nous ? | PurchaseEvent/Product | PurchaseEventFact + optional product | Frequency/Ticket/Cycle | achat=opération bancaire |
| M9 | Qu'est-ce qui distingue les personnes ? | personne×grain naturel | outputs B–F | PersonaDifferenceEngine | non-comparabilité/morale |
| M10 | Qu'est-ce qui est réellement partagé ? | occurrence/visit/Moment | participant evidence | SharedParticipationResolver | faux partage/50-50 |

---

# 17. Phases A → I — carte d'exécution cible

| Phase | INPUTS | OUTPUTS | DEPEND_ON | BLOCKS | ENTRY_GATE | EXIT_GATE | PARALLEL? | HARD_STOP |
|---|---|---|---|---|---|---|---|---|
| A Foundations | Master + History final + primitives V2 | support/coverage/provenance/identities/revisions/publication/certification contracts | POST_HISTORY gate + audit target/existing | B–I | baseline/dependencies fresh | foundations PASS + handoff | internals only | authority conflict/stale baseline |
| B Finance | A + Economic Facts + refs | M1/M2 | A | C–I | A PASS | M1/M2 MUST + reconciliations PASS | partial M1/M2 | double authority/non-reconcile |
| C Temporal/Life | A+B + human Facts | M3/M4 | A+B | D–I | B stable | anti-lookahead/persistence/observability PASS | partial M3/M4 | LIVE_TAIL rupture / non-normalized counts |
| D Relations | A–C | M5 | A–C | E–I | source metrics stable | matching/FDR/robustness PASS | core before E | unwhitelisted/causal claim |
| E Moments/Geo | A–D + Moment/Place authority | M6/M7 | A–D | F–I | causal/place doctrines revalidated | M6/M7 PASS + gates resolved | M6/M7 partial | causal/GPS authority missing |
| F Consumption | A–E + PurchaseEvent | M8 | A–E | G–I | purchase semantics stable | core PASS + product gates explicit | core independent product gates | bank=buy / invented product authority |
| G People/Social | stable B–F | M9/M10/social | B–F | H–I | attribution/support stable | Persona/Shared PASS | M9/M10 partial | payer=beneficiary/fake shared |
| H Query/RM/UX | stable A–G contracts | manifest, module RMs, Query, page | A–G | I | no business calc left for React | contracts/runtime/publication/UX PASS | modules after contract freeze | React analytics / giant GET / hot-swap |
| I Contextual Summary | certified Global deterministic outputs | package/export/import/summary RM | H + 10 modules | final certification | deterministic Global publication | manual AI contract/security/freshness PASS | contract prep only | LLM as analytics/API/raw exports |

DOD commun du plan conceptuel : chaque capability du scope possède un état explicite, findings fermés ou déplacés par contrat, tests avec evidenceRefs, aucun blocking failure, policies/method/revisions explicites, dependency matrix physique à jour, publication/query/consumer conformes et handoff aval validé.

---

# 18. Doctrines transverses — cible vs primitives existantes observées

`CURRENT_EXISTING_PRIMITIVE` ne signifie jamais `REUSE`.

| Doctrine | SOURCE_MASTER | CURRENT_EXISTING_PRIMITIVE | GLOBAL_NEED | OPEN_QUESTION |
|---|---|---|---|---|
| Support | Foundations/modules | `Support`, `supportForPolicy`, Metric envelopes | support par famille/grain/comparable | couvre-t-il tous grains ? |
| Coverage | Foundations | coverage/partial History | dimension-specific, effective=min(required) | modèle multi-domaines physique ? |
| Provenance | Foundations/certification | Metric provenance, sourceRefs, PublicationMeta | Source→Fact→Analytics→Insight | format Global après HC3 ? |
| Knowledge states | Foundations | KNOWN/PARTIAL/UNKNOWN/N/A/CONFLICT | même distinction partout | legacy Global homogène ? |
| Partial reasons | Foundations | lower-bound/observed-only/reason codes | raisons Global étendues | contrat partagé à adapter ? |
| Materiality | M1/M2/M3/M9 | History/shared engines partiels | versionné par famille | seuils communs vs spécifiques ? |
| Trend | M1/M2/M3 | legacy Evolution + series | recent/medium-term/current regime | moteur final ? |
| Stability | M1/M4/M9 | support/variability primitives | robust stability/volatility | primitive suffisante ? |
| Seasonality | M4 | non prouvé comme autorité finale | weekly/annual/anchored data-gated | moteur/corpus ? |
| Change point | M3 | pas d'autorité Global finale prouvée | robust detection/persistence | physique post-audit |
| Association | M5 | comparisons/context primitives | matching/FDR/LOMO | RelationshipEngine physique |
| Causalité | M4/M6/M10 | Activity causal History ; Moment HC2 | causal links explicites | Moment final après HC2 |
| Relation temporelle | M3/M5/M6 | Calendar semantic/dates/windows | before/after/concomitant/causal | contrat partagé suffisant ? |
| Person scope | M5/M9 | AnalysisScope/person subjects | attribution/comparable support | payer/beneficiary coverage |
| Household scope | all | household scope | household without erasing person provenance | SHARED vs HOUSEHOLD |
| Economic identity | M1/M2/M5/M6 | EconomicComponentFact/Daily Economic | coût autoritaire | HC2/HC3 revalidation |
| Purchase identity | M8 | PurchaseEventFact | buy ≠ funding ≠ bank | final post-History state |
| Place identity | M7 | PlaceVisitFact/canonicalPlace | visit/place resolution/roles | HC2 Place authority |
| Participant identity | M6/M10 | Activity participantIds/external participants | explicit/canonical/copresence evidence | Contact authority? |
| Revisions | Foundations | dataRevision/analyticsRevision History | global freshness/invalidation | after HC3–HC5 |
| Publication | Global publication section | analytics_publications + History generations | coherent Global manifest/no hot-swap | shared store/profile? |
| Certification | Master/test catalog | History scripts + Query validation | capability/module/publication gates | physical runner/reporting |
| RuntimeSchemas | Query architecture | History + legacy Global parsers | every Global RM validated | new Global V2 family in H |
| Capabilities | registries | Query Capability Engine | applicability ≠ support/coverage | legacy migration |

---

# 19. Frontière cible avec History

Global peut conceptuellement consommer des vérités communes : Facts, métriques officielles, support/coverage/provenance, Materiality et primitives de publication/révision.

Il ne doit pas prendre comme vérité : ReadModels History concaténés, projections Calendar/Bilan, oracle History, doctrine M3 ad hoc, causalCost Moment non revalidé, Place simplifié, manifest History avant HC3.

HC1 communiqué PASS est favorable : oracle retiré du payload productif, Actual/Typical/Minimal/catégories revenus aux Analytics officiels. Mais toute classification physique reste `REVALIDATE_AFTER_HC6` tant que la baseline finale n'est pas observable et certifiée.

---

# 20. Compatibilité à préserver avec les chantiers futurs

## 20.1 Résumé contextuel

Budgétisation calcule/certifie ; ChatGPT raconte manuellement. Le résumé consomme une publication, ses hashes/révisions et devient STALE après changement. Il ne nourrit jamais KPI/relations/Persona/certification. Les modules Global doivent donc être traçables et exportables comme corpus déterministe.

## 20.2 Benefit Wallet / Swile / Edenred

Global F doit rester compatible avec `PurchaseEvent + PurchaseFundingComponents`, sans supposer `1 PurchaseEvent = 1 bank transaction`. Credits wallet ≠ Actual ≠ bank inflow. Aucun provider spécifique n'est intégré maintenant.

## 20.3 Media

EntityId reste l'identité ; MediaRef est optionnel. Absence/erreur média ne modifie aucun MetricEnvelope. Analytics A–G restent indépendants des médias ; H pourra intégrer des refs sans blob ni URL éphémère comme identité.

## 20.4 Diagnostic

Diagnostic observe support/coverage/provenance/revisions/publications/invariants et ne recalcule jamais Global. Les sorties doivent être suffisamment traçables pour un contrôle externe indépendant.

## 20.5 Import & Actualisation

Le futur Refresh Planner aura besoin des dépendances physiques Global. Les engines devront déclarer inputs et recompute scope ; aucune navigation ne doit être un déclencheur de calcul métier.

---

# 21. EXISTANT Global observé — sans classification finale

Le repo distant contient déjà route `/historique/analyse/global`, `AnalysisGlobalInitialReadModel`, Baseline/Typical/Evolution/Habits/Profiles/Universe, Query resources/adapters, sources Analysis et tests.

Le registre `src/query-api/request/resource-contract.ts` classe explicitement toutes les ressources `analysis_global_*` dans `legacy_v1`.

Écarts cible/existant déjà certains :

- route legacy imbriquée sous History vs cible `/analyse-globale` ;
- `GlobalWindow/observationWindow` legacy vs aucune période Global universelle ;
- ReadModels legacy par anciennes vues vs cible M1–M10 ;
- legacy contract V1 vs futur contrat Global V2 ;
- source Analysis dynamique actuelle à confronter à la future publication Global.

Cela ne permet pas encore de dire REMOVE/ADAPT/REUSE.

---

# 22. Classification des certitudes

| Sujet | État |
|---|---|
| 10 modules + Social | `PRODUCT_REQUIREMENT_STABLE` |
| ordre A→I | `PRODUCT_REQUIREMENT_STABLE` |
| 364 capabilities | `PRODUCT_REQUIREMENT_STABLE` |
| CERTIFIED_HISTORY/LIVE_TAIL | `ARCHITECTURE_PRINCIPLE_STABLE` |
| no universal Global period | `PRODUCT_REQUIREMENT_STABLE` |
| natural grain/support/coverage | `ARCHITECTURE_PRINCIPLE_STABLE` |
| React sans calcul métier | `ARCHITECTURE_PRINCIPLE_STABLE` |
| Summary manual/no API | `PRODUCT_REQUIREMENT_STABLE` |
| Wallet provider-agnostic | `FUTURE_CONSTRAINT_STABLE` |
| Media presentation-only | `FUTURE_CONSTRAINT_STABLE` |
| Diagnostic read-only | `FUTURE_CONSTRAINT_STABLE` |
| Import final après runtime stable | `FUTURE_CONSTRAINT_STABLE` |
| History primitives physically reusable | `REVALIDATE_AFTER_HC6` |
| Moment causality | `REVALIDATE_AFTER_HC2_HC6` |
| Place doctrine | `REVALIDATE_AFTER_HC2_HC6` |
| dependency manifest | `REVALIDATE_AFTER_HC3_HC6` |
| correction/republication | `REVALIDATE_AFTER_HC4_HC5_HC6` |
| old Global resources | `CURRENT_LEGACY_OBSERVED` |
| final tables/functions/jobs | `UNKNOWN_UNTIL_POST_HISTORY_AUDIT` |
| final REUSE/ADAPT/NEW | `FORBIDDEN_TO_DECIDE_NOW` |

---

# 23. Carte conceptuelle des dépendances

```text
A FOUNDATIONS
│
├── B FINANCE ─────────────┐
│   ├── M1                 │
│   └── M2                 │
├── C TEMPORAL/LIFE        │
│   ├── M3                 │
│   └── M4                 │
├── D RELATIONS M5 ← B+C   │
│       ↓ later E enrich   │
├── E M6 MOMENTS + M7 GEO  │
├── F CONSUMPTION M8       │
└── G PEOPLE/SOCIAL ← B–F ─┘
    ├── M9
    ├── M10
    └── Social
          ↓
H QUERY / READMODELS / UX
          ↓
I CONTEXTUAL SUMMARY
```

La vraie `GLOBAL_ANALYTICS_DEPENDENCY_MATRIX` devra ensuite préciser tables/champs/facts/functions/artifacts/jobs/invalidations réels.

---

# 24. Risques de mauvaise interprétation à verrouiller

1. Global ≠ somme de History.
2. Support insuffisant ≠ zéro/false.
3. Coverage partielle ≠ couverture complète.
4. LIVE_TAIL ≠ certified history.
5. Association ≠ causalité.
6. spentDuring ≠ causalCost.
7. GPS ≠ visite ≠ finance localisée.
8. opération bancaire ≠ PurchaseEvent.
9. payer ≠ beneficiary.
10. co-présence ≠ activité partagée.
11. coût partagé ≠ 50/50.
12. absence de Contact authority ≠ permission de créer un graphe social.
13. média absent ≠ donnée analytique absente.
14. résumé IA ≠ moteur Analytics.
15. navigation ≠ mécanisme de calcul.
16. nom de code similaire ≠ même sémantique.
17. AUTHORITY_GATED indisponible ≠ V1 impossible si safe-disable prévu.
18. DATA_GATED sans corpus ≠ implementation failure si l'indisponibilité est correctement représentée.

---

# 25. QUESTIONS THAT MUST BE RESOLVED BEFORE IMPLEMENTATION

## History gate

1. HC2 confirme-t-il Necessity/Behavior/LifeScope, causalité Moment/Activity et Place ?
2. HC3 fournit-il un manifest durable exploitable par Global ?
3. HC4–HC5 prouvent-ils immutabilité, correction, invalidation, rebuild, republication ?
4. HC6 donne-t-il `POST_HISTORY_ENTRY_GATE=PASS` avec baseline observable ?

## CIBLE ↔ EXISTANT

5. Quelles primitives sont sémantiquement identiques au Master, pas seulement similaires par nom ?
6. Quelles ressources `analysis_global_*` legacy retirer/conserver/adapt ?
7. Quelles primitives Query/Materialization/Capabilities/Exploration sont réellement génériques ?
8. Quelle famille de contrats V2 Global remplace `legacy_v1` ?

## Authority gates

9. Quels 31 AUTHORITY_GATED sont AVAILABLE/UNAVAILABLE post-History ?
10. MobilityLeg/RouteDefinition/distance/vehicle/fuel sont-ils autoritaires ?
11. PurchaseLine/Product identities/unit existent-ils réellement ?
12. Les prix permettent-ils substitution/inflation ?
13. Contact/Alias/Relation/Group existent-ils réellement ?
14. PersonalReferenceCost enrichi a-t-il une autorité ?

## Foundations

15. Support/Coverage existants couvrent-ils tous les grains ?
16. Où vit physiquement CERTIFIED_HISTORY/LIVE_TAIL ?
17. Comment matérialiser asOf/certifiedThrough/liveThrough ?
18. Quelle autorité physique pour Trend/Stability/ChangePoint ?
19. Comment versionner policies/methods Global sans dupliquer History ?

## Publication/invalidation

20. Global réutilise-t-il `analytics_publications` avec profil dédié ou adaptation ?
21. Quel manifest relie publication Global et outputs/dépendances ?
22. Quelles corrections History invalident quels outputs Global ?
23. Comment E/F recertifie M3/M5 de manière ciblée ?
24. Comment notifier une nouvelle publication sans hot-swap ?

## UX/ReadModels

25. Quel mapping M1–M10 → Query resources V2 ?
26. Quels détails embedded vs lazy ?
27. Quels deep-links Global→History sans duplication ?
28. Quel contrat MediaRef optionnel avant/pendant H ?

## Chantiers futurs

29. Quelles sorties M8 doivent rester extensibles Benefit Wallet ?
30. Quelles evidenceRefs pour Résumé contextuel ?
31. Quelles métadonnées pour Diagnostic ?
32. Quelles dependencies/recompute units pour futur Refresh Planner ?

## Roadmap

33. Projet : Swile/Edenred doivent-ils rester entre H déterministe et I, même si le Master place conceptuellement I après H ? C'est un choix de séquençage d'intégration à confirmer, pas une modification de la cible I.
34. Le checkpoint de conception Media doit-il rester juste avant H ?

---

# 26. Handoff vers les audits préparatoires suivants

Ce rapport fournit la carte **CIBLE**. Il ne fournit pas la classification physique REUSE/ADAPT/NEW, la dependency matrix SQL/code, les migrations, les ReadModels finaux ni les prompts d'implémentation.

Les audits suivants doivent : frontière History↔Global ; authority/dependency preaudit ; runtime/publication/query ; ReadModel/UX ; future compatibility ; tests/gates ; consolidation Implementation Map ; puis futur GA0 post-History.

---

# 27. Vérification de périmètre

- aucune table finale choisie ;
- aucun moteur implémenté ;
- aucun ReadModel créé ;
- aucune migration ;
- aucune modification History ;
- aucune écriture Supabase ;
- aucune décision finale REUSE/ADAPT/NEW ;
- legacy Global seulement observé ;
- Master Global reste autorité normative.

---

# 28. Verdict

La cible produit et analytique Global est suffisamment cartographiée pour alimenter les audits préparatoires suivants. Les besoins fonctionnels, grains, Facts conceptuels, familles Analytics, dépendances, risques, phases A→I et contraintes des futurs sous-systèmes sont identifiés sans figer prématurément l'implémentation physique.

Les inconnues restantes sont précisément celles réservées au futur audit post-History : disponibilité des autorités réelles, mapping physique, réutilisation/adaptation de l'existant, dependency matrix, contrats Query V2 Global et stratégie de publication/invalidation finale.

```text
GLOBAL PRODUCT MAP
COMPLETE
```
