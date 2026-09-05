# P02 — Autorité temporelle et fonctionnement économique

## Baseline et périmètre

- Branche : `main`.
- HEAD de départ : `f27aa4780f73da64b36463d996ab57d37bcfa2f9`.
- Entrée : `GLOBAL_PHASE_A2=PASS`, `GLOBAL_PHASE_A3=PASS`, P01 certifié.
- GA0, A1, B1 et HC1–HC6 n'ont pas été rejoués. L'audit Finance B1 reste absorbé par A1.
- Écritures Supabase, migration, publication, Query, ReadModel, React : aucune.
- Le changelog Supabase a été contrôlé conformément à la procédure projet ; aucune évolution annoncée ne modifie les contrats server-only/read-only employés ici.

## Choix REUSE / ADAPT / NEW

| Résultat M1 | Décision | Source et moteur | Preuve de non-duplication |
|---|---|---|---|
| Actual | REUSE | `economic_consumption_net_attributable`, `FactSourceResolver`, `produceMetric`, ECF sur temporalité économique | `adaptGlobalActual()` refuse tout autre `metricId` et n'effectue aucun calcul de montant |
| Typical | ADAPT | `selectComparisonReferenceWindow`, `selectCurrentReferenceWindow`, `calculateTypicalMonthCost` | `buildGlobalTypicalPair()` ne change ni estimateur médian ni observations Actual ; il impose seulement les fenêtres et seuils Global |
| Minimal | ADAPT | `minimal_month_cost`, `resolveMinimalPlanningSource`, composantes Canonical | `resolveCanonical()` exclut la preuve certifiée compare-only ; `adaptGlobalMinimal()` vérifie la réconciliation des composantes sans recalculer le moteur |
| Bridge banque→économie et residual | REUSE + ADAPT | `buildBankEconomyBridge` de History | Global délègue à cette primitive pure sans recopier sa formule |
| Necessity / fixe-variable / LifeScope | REUSE + ADAPT | dimensions ECF et classifications Canonical | projections indépendantes ; inconnu et conflit restent séparés |
| Récurrences / équivalents structurels | NEW | `buildGlobalStructuralChange` | seul calcul nouveau autorisé par A1/B2 ; cadence et autorité doivent être explicites |
| CH/LT et bornes | NEW | `GlobalTemporalBoundaryResolver` | moteur exécutable attribué à P02 par P01 |
| Trend / Stability / Recent Change | DEFERRED | propriétaire P04 | uniquement déclarés, jamais simulés dans P02 |

`resolveGlobalM1HouseholdAuthority()` matérialise le chemin server-only : CanonicalRepository → FactSourceResolver Canonical-only → producteurs Analytics officiels → adaptateurs Global. Aucun snapshot ou ReadModel History n'est un input.

## Registre de preuve M1

| Contrat | Formule / sélection gelée | Grain et fenêtre | Support / exclusions | Policy / tie-break |
|---|---|---|---|---|
| Actual | somme officielle des segments ECF nets dont l'economic month appartient au scope | mois économique | période Finance complète/fermée pour prouver le zéro ; aucune date bancaire de repli | `economic_consumption_net_attributable@v1` |
| TypicalReference(M) | médiane des Actual mensuels admissibles | mois ; douze derniers mois éligibles strictement `< M` | 0–5 non publiable, 6–11 SUFFICIENT, ≥12 STRONG ; mois PARTIAL/incomplet/non comparable/method-excluded retiré ; zéro connu conservé | calculateur `typical_month_cost@v1`, ordre calendaire déterministe |
| TypicalState(M) | même médiane officielle | mois ; douze derniers mois admissibles `<= M` | mêmes règles, distinct de TypicalReference | même méthode ; fenêtre `current` distincte |
| Minimal | total du moteur source-aware officiel et projection additive exacte de ses composantes | mois cible ; règles valides à la date et historique variable strictement antérieur | composantes/support/coverage préservés ; compare-only exclu de la production | `minimal_month_cost@v1`, règles Canonical effectives |
| Bridge | `bankOutflows + Σ(lines)`, puis `residual = Actual - bridgeCalculatedActual` | mois | lignes distinctes ; remboursements/cash/timing explicites ; PARTIAL si lignes incomplètes | primitive `bank_economy_bridge@v1` réutilisée |
| StructuralMonthlyEquivalent | `expectedOccurrenceAmount × expectedOccurrencesPerYear / 12` | récurrence active à la date | contrat actif > montant futur explicite > historique robuste > occurrence unique ; égalité contradictoire échoue fermée | `global-structural-recurrence@v1` |
| Structure | somme par axe indépendant ; inconnu/conflit non reclassé | composante économique du mois | coverage = composants classés / éligibles ; jamais déduite d'un montant non vide | `global-economic-classification-coverage@v1` |

Les mensualités annuelles, trimestrielles et bimestrielles utilisent la même formule (fréquences 1, 4 et 6 par an). Une récurrence empirique reste descriptive et ne devient jamais automatiquement éligible à Minimal. Une occurrence unique est `PARTIAL`. Une provision est une vérité structurelle et non un paiement ajouté à Actual.

## Autorité temporelle

`GlobalTemporalBoundaryResolver` :

- valide CH contre `certifiedThrough` et LT contre `liveThrough` ;
- impose des slices disjoints et conserve les gaps explicites ;
- applique `ALL_RELIABLE`, `LAST_ELIGIBLE_UNITS`, `DECLARED_RANGE` ou l'intersection comparable au grain naturel ;
- canonise les unités et rejette deux définitions contradictoires de la même unité ;
- produit support, dépendances, unités incluses/exclues et `resolutionHash` déterministe ;
- n'injecte jamais LT dans une policy `CERTIFIED_HISTORY`.

Ajouter une donnée postérieure à la borne ne modifie donc ni la sélection CH antérieure ni son hash. La date bancaire reste absente de `projectGlobalEconomicStructureMonth()` : un timing économique non résolu n'est pas distribué arbitrairement.

## Dépendances, scopes et hashes

`createGlobalM1DependencyDeclaration()` déclare ECF, classification ECF, `analysis_periods`, règles Minimal, récurrences, liens Person, les trois Analytics amont, le resolver temporel, le bridge réutilisé et quatre policies. Les dépendances structurelles sont exclusivement `CERTIFIED_HISTORY`; le test de closure échoue si une consommation manque.

La sélection Person réutilise la couverture P01 :

- seul beneficiary/share explicite alimente le montant attribuable ;
- payer seul reste UNKNOWN ;
- une part connue avec reste inconnu est PARTIAL/OBSERVED_ONLY ;
- un conflit reste CONFLICT ;
- le montant Household n'est pas réalloué et ne change pas.

Les `inputHash` canonisent les ensembles. Une modification de montant, composante, cadence, policy ou borne significative change son hash ; l'ordre d'un même ensemble n'en crée pas un nouveau.

## Contrats du Master M1

| Exigences indexées | Preuve P02 | Statut |
|---|---|---|
| GLO-M01-001–019 — données, deux Typical, fenêtres, support, zéro, non-additivité, PARTIAL, no-lookahead | resolver temporel, `buildGlobalTypicalPair`, tests ciblés | PASS |
| GLO-M01-020–037 — Minimal distinct/source-aware, règles datées, vérité paiement/structure, Actual non lissé | voie Canonical-only, composantes réconciliées, aucun oracle productif | PASS |
| GLO-M01-038–048 — équivalents, autorité de montant, empirique, provision | `buildGlobalStructuralChange`, priorité et tests | PASS |
| GLO-M01-049 — structure économique | axes indépendants ECF, UNKNOWN/CONFLICT/coverage | PASS |
| GLO-M01-050–052 — Trend, Stability, Recent Change/contribution temporelle | déclaration durable `DEFERRED`, propriétaire P04 | PENDING_P04 — autorisé par le prompt P02 |
| GLO-M01-053 — récurrences | état actif et changements structurels exposés | PASS |
| GLO-M01-054 — fonctionnalités UI | hors périmètre P02 | LATER_FRONTEND |
| GLO-M01-055 — articulation inflation personnelle M8 | dépendance future unidirectionnelle, aucune simulation | LATER_M8 |

## Contrats B2 fermés

1. Actual réutilise le producteur ECF économique officiel et n'est jamais lissé.
2. TypicalReference est strictement antérieur au mois cible ; TypicalState inclut le mois cible admissible.
3. Typical utilise une médiane mensuelle, conserve les zéros connus, exclut PARTIAL et respecte le minimum 6.
4. Minimal reste source-aware, daté et distinct de Typical ; ses composantes se réconcilient au total.
5. Un certificat Minimal current/legacy ne peut pas entrer dans la voie Global Canonical-only.
6. Le bridge banque→économie conserve remboursements, cash, timing et residual sans faire du bancaire l'autorité Actual.
7. Necessity, behavior/fixe-variable et LifeScope restent orthogonaux ; aucune classe absente n'est inventée.
8. Les équivalents mensuels et contributeurs structurels sont fondés sur cadence/autorité explicites.
9. Les scopes Person utilisent seulement l'attribution P01 prouvée et exposent le reste non attribuable.
10. CH/LT, support, provenance, dépendances et hashes sont déclarés avant consommation.
11. History/legacy restent lisibles ; `resolve()` conserve sa compatibilité tandis que `resolveCanonical()` est la voie des nouveaux moteurs.
12. Trend/Stability/Recent Change restent attribués à P04 et doivent être branchés puis recertifiés avant que M1 soit déclaré produit final complet.

## Tests et limites

| Gate | Résultat |
|---|---|
| `check-global-v2-economic-function` | PASS — 65/65 |
| `check-global-v2-foundations` | PASS — 107/107 |
| `check-history-v2-month-balance` | PASS — 99/99 |
| `check-analysis-global-contracts` | PASS — legacy |
| `check-canonical-in-batching` | PASS |
| Typecheck | PASS |
| Architecture | PASS — 479 fichiers |
| Build production | PASS — Next 16.2.6 |
| `git diff --check` | PASS |

Les tests couvrent CH/LT, gaps, no-lookahead, support insuffisant, zéro connu, fenêtres Reference/State, mois PARTIAL, Actual, bridge/residual/remboursement, Minimal/composantes, classifications UNKNOWN/CONFLICT, projection au mois économique, attribution Person, équivalents/cadences/autorités, dépendances et sensibilité/non-sensibilité des hashes. Fixtures synthétiques uniquement ; aucune donnée privée n'est enregistrée.

Limite autorisée : M1 économique P02 est exploitable et certifié, mais ses sorties Trend/Stability/Recent Change restent `PENDING_P04`. M1 final devra être rebranché et recertifié dans P04 avant consommation exigeant ces sorties.

`P02_IMPLEMENTATION_GATE = PASS`

`P02_CONTRACT_GATE = PASS`

`P02_TEST_GATE = PASS`

`P02_LIVE_GATE = NOT_RUN`

`NEXT_PERMITTED_PROMPT = P03`
