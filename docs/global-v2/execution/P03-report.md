# P03 — Catégories, Needs et matérialité partagée

## Baseline et périmètre

- Branche : `main`.
- HEAD de départ : `54fbee5a7f0d289b3fa0372170fefaf73d392990`.
- Entrée : P02 implementation/contract/tests `PASS`; A1–A3 et B1 absorbé restent acquis.
- Lot : M2 core, `GlobalMaterialityEngine`, clôture Finance B3/B4 core.
- Hors lot respecté : aucun ReadModel, Query, snapshot, publication, migration, React, Global live ou sélection éditoriale.
- Écritures Supabase : aucune. Le schéma live n'a pas été interrogé ni modifié.
- Le changelog Supabase a été relu avant les adaptations server-only : aucune rupture annoncée n'affecte ces lectures Canonical existantes.

## Autorités et choix REUSE / ADAPT / NEW

| Résultat | Décision | Autorité | Garantie |
|---|---|---|---|
| Actual | REUSE | `economic_consumption_net_attributable` / M1 P02 | M2 reçoit le total officiel et exige sa réconciliation exacte |
| Category amount | REUSE | `category_amount@v1` | chaque catégorie connue est comparée au producteur officiel |
| Typical total/catégorie | REUSE + ADAPT | `typical_month_cost@v1`, fenêtres P02 | références strictement antérieures; médiane de groupe seulement pour Need/états non couverts par un producteur distinct |
| Catégorie/sous-catégorie | REUSE | dimensions de `EconomicComponentFact` | aucun label ou texte ne classe une composante |
| Need | ADAPT | `need_id` explicite de la source, ou repli opération uniquement si l'opération ne porte qu'un composant | conflit source/opération échoue fermé; Need inconnu reste visible |
| Necessity/Behavior/LifeScope | REUSE | `EconomicComponentClassificationFact` | croisements conservés par état `KNOWN/UNKNOWN/CONFLICT`, sans reclassification Global |
| PurchaseEvent | OPTIONAL | `PurchaseEventFact` Canonical | aucune dépendance obligatoire M8/PurchaseEvent; explication indisponible tant que l'autorité/couverture n'est pas complète |
| Matérialité | NEW | contrat commun Master §41–47 | moteur analytique partagé; `marked_facts_materiality_v1` inchangé; aucune sélection UI |

Le chemin serveur `resolveGlobalM2HouseholdAuthority()` est exclusivement :

```text
CanonicalRepository
→ EconomicComponentFact + EconomicComponentClassificationFact
→ FactSourceResolver.resolveCanonical()
→ Actual / category_amount / Typical officiels
→ GlobalCategoryNeedEngine
→ candidats GlobalMaterialityEngine
```

History ReadModels, certificats EXPECTED et preuves compare-only sont absents de ce chemin.

## M2 — contrats produits

`buildGlobalCategoryNeeds()` produit, pour catégories et Needs :

- `monthlyAmount`, `typicalAmount`, `shareOfTypical`, delta monétaire et relatif;
- série historique canonique dans l'ordre calendaire;
- contributeurs sous-catégorie pour une catégorie et catégorie pour un Need;
- décomposition Necessity/Behavior/LifeScope issue des classification facts;
- coverage avec numérateur/dénominateur, support et références de drill-down;
- candidats de matérialité séparés du résultat éditorial.

Les états `__UNDETERMINED__`, `__UNKNOWN__`, `__NOT_APPLICABLE__` et `__CONFLICT__` restent dans la preuve et dans la réconciliation : un montant inconnu ne disparaît jamais du dénominateur économique. `currentTotal` Category et Need doit égaler Actual, remboursements négatifs inclus. `shareSumIsExhaustive` n'est vrai que si la classification est complète **et** si les Typicals de groupe se réconcilient au Typical total; la non-additivité normale des médianes n'est pas masquée.

Les ensembles de mois, composants et preuves sont canonisés avant hash. Deux occurrences du même `month + canonicalComponentKey` sont refusées. Une référence future ou égale au mois cible est refusée, ce qui ferme le no-lookahead M2.

### Fréquence × ticket

`decomposeGlobalPurchaseFrequencyTicket()` n'est disponible que si :

1. l'autorité PurchaseEvent est disponible;
2. la couverture est exactement complète;
3. les deux périodes possèdent un grain compatible et des IDs non dupliqués.

La formule est celle du Master :

```text
frequencyEffect = (F2 − F1) × (P1 + P2) / 2
ticketEffect    = (P2 − P1) × (F1 + F2) / 2
ΔSpend          = frequencyEffect + ticketEffect
```

Sans preuve, le résultat est `UNAVAILABLE` avec une raison stable; aucune opération bancaire, aucun libellé, marchand ou produit ambigu ne devient artificiellement un achat. Le hook P10/M8 est optionnel et strictement unidirectionnel.

## GlobalMaterialityEngine

La registry unique `globalMaterialityPolicies` encode `materiality_v1` par famille :

| Policy | Seuil absolu | Seuil relatif / alternative |
|---|---:|---|
| Household total | 50 €/mois | 3 % ou contribution notable |
| Category / Need | 15 €/mois | 10 % ou 2 points de part |
| Récurrence | 3 €/mois équivalent | 5 %, avec apparition/disparition et persistance |
| Coût/occurrence | 5 €/occurrence | 10 % |
| Fréquence activité | 1 occurrence/mois | 20 % |
| Persona money | 10 €/mois équivalent | 15 % |
| Persona frequency | 1 occurrence/mois | ou écart structurel prouvé |
| Merchant | 15 €/mois | 15 % ou fréquence matérielle prouvée |

La condition commune est `supportGate AND coverageGate AND absoluteGate AND (relativeGate OR shareGate)` lorsque l'alternative share existe. Le Master ne donne pas de seuil numérique universel de coverage : P03 n'en invente pas. Couverture complète = gate plein; couverture partielle = `QUALIFIED_PARTIAL`; couverture absente/non résolue = `INELIGIBLE`. `INSUFFICIENT`, `UNKNOWN` et `CONFLICT` ne deviennent jamais un score zéro.

Le batch canonise les candidats, déduplique uniquement une même identité explicite phénomène/grain/preuves, préserve des grains différents et refuse des doublons contradictoires. Le tie-break final est `phenomenonId`, grain naturel, puis `candidateId`. Il ne limite, ne ranke ni ne sélectionne les cartes : cette responsabilité reste P14 `InsightSelectionEngine`.

## Dépendances et closures B3/B4

`createGlobalM2DependencyDeclaration()` déclare :

- requis : ECF, classification facts, catégories, sous-catégories, Needs, Actual, category amount, Typical et M1;
- requis : `GlobalMaterialityEngine` et ses policies versionnées;
- optionnels : `fct_purchase_event` et `global-v2:m8-purchase-enrichment:P10`;
- corpus structurel : `CERTIFIED_HISTORY`, grain MONTH, fenêtre 12 unités admissibles;
- aucune sortie de publication dans P03.

Le test de closure exige toutes ces consommations. Le core Finance se ferme sans PurchaseEvent : seul l'enrichissement fréquence/ticket reste explicitement indisponible, et son ouverture future changera sa dépendance/policy puis imposera une recertification B ciblée. Il n'existe aucun cycle B↔F.

## Exigences M2 du Master

| Exigence | Preuve | Statut |
|---|---|---|
| GLO-M02-001 — données | ECF, classifications, référentiels, autorités Analytics | PASS |
| GLO-M02-002 — catégories/Needs montant, Typical, part, série | `GlobalM2Axis` / `GlobalM2Group` | PASS |
| GLO-M02-003 — current/reference/deltas/trend | deltas présents; trend déclaré P04 avec M1 | PASS_CORE / TREND_P04 |
| GLO-M02-004 — sous-catégories et À déterminer | contributeurs + états explicites et réconciliation | PASS |
| GLO-M02-005 — fréquence × ticket | formule exacte, data gate PurchaseEvent, indisponibilité qualifiée | PASS_CONDITIONAL |
| GLO-M02-006 — croisements utiles | Category↔Need, sous-catégorie et classifications; aucun produit cartésien inutile | PASS_CORE |
| GLO-M02-007 — support, monetary basis, identité, références, matérialité | contrats Global P01, références explicites, closure et moteur partagé | PASS |

M1 conserve explicitement `Trend`, `Stability` et `Recent Change` sous propriété P04/P05; P03 ne déclare donc pas M1 final intégralement clos. Il rejoue néanmoins B2/M1 contre le moteur partagé et confirme que toutes les sorties économiques stables restent compatibles.

## Tests

| Gate | Résultat |
|---|---|
| `check-global-v2-category-needs-materiality` | PASS — 49/49 |
| `check-global-v2-economic-function` (replay M1/B2) | PASS — 65/65 |
| `check-global-v2-foundations` | PASS — 107/107 |
| History V2 Canonical | PASS |
| History V2 transversal | PASS — 48 checks |
| History V2 Month Balance | PASS — 99/99 |
| Canonical repository batching | PASS |
| Analysis Month / marked facts | PASS |
| Analysis Global legacy | PASS |
| Typecheck | PASS |
| Architecture | PASS — 482 fichiers |
| Next production build | PASS — Next 16.2.6 |
| `git diff --check` | PASS |

Les tests discriminent : réconciliation Category/Need/Actual, remboursement négatif, inconnu et conflit visibles, Typical officiel incohérent refusé, référence future refusée, ordre canonique, attribution Need exacte/conflit/repli unicomposant, absence de classification par label, couverture partielle y compris sous le seuil d'effet, parts non exhaustives, PurchaseEvent absent/incomplet, formule symétrique, duplication PurchaseEvent, effet important mal supporté, petit effet bien supporté, égalités de seuil, policy mismatch, grains distincts et redondance exacte. Les fixtures sont synthétiques; aucune donnée bancaire n'est enregistrée.

## Clôture

`B3_CATEGORY_NEEDS_CORE = PASS`

`B4_GLOBAL_MATERIALITY_ENGINE = PASS`

`GLOBAL_PHASE_B_CORE = PASS`

`M1_FINAL = PENDING_P04_P05_TEMPORAL_OUTPUTS`

`LIVE_WRITES = NONE`

`NEXT_PERMITTED_PROMPT = P04`
