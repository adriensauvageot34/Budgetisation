# P09 — Achats humains et marchands

## Gate d’entrée et périmètre

- Baseline : `main` à `4551c103c98432181982c351bb3ab256e3cf4b43`, working tree propre.
- P08 : `IMPLEMENTATION_GATE`, `CONTRACT_GATE`, `TEST_GATE` et `GLOBAL_PHASE_E3_E4` à `PASS`.
- Contrat commun C01–C14 appliqué ; autorité normative M8 relue intégralement dans le Master Global.
- Périmètre : F1 puis F2, soit identité Purchase, adjustments, Merchant core, couverture, tickets, évolution et drill-down. Product/price/cadence/inflation restent explicitement `DEFERRED_P10` ; aucun Swile/Edenred.
- Aucun ReadModel, Query, React, publication, migration, backfill, accès d’écriture ou écriture Supabase.

## F1 — réalité physique et autorité d’identité

| Niveau | Pièce réelle | Conclusion |
|---|---|---|
| Schéma | `purchase_events`, `purchase_event_memberships`, `purchase_event_timing_assertions` | identité opaque, Household et ownership d’un composant de consommation par un seul Purchase Event : PRESENT |
| Fact | `PurchaseEventFact`, `projectPurchaseEventFact()`, `dedupePurchaseEvents()` | projection et déduplication uniquement par `purchaseEventId` : PRESENT |
| Repository | `CanonicalRepository.loadPurchaseEvents()` | chargement batch des memberships/timings et composants économiques : PRESENT |
| Euros | `EconomicComponentFact` | `gross`, `refundApplied`, `net` restent l’autorité monétaire : PRESENT |
| Merchant | `EconomicComponentFact.merchant` + table `merchants` | Merchant canonique réutilisable si toutes les composantes concordent : CONDITIONAL |
| Purchase date | le schéma actuel porte `economic_date`, pas `purchaseAt` | ne jamais les assimiler : `AUTHORITY_GATED` sans provider explicite |
| Adjustment | `refundApplied` est autoritaire ; aucune table Canonical générale Return/Cancellation | refund projetable ; autres adjustments `DATA/AUTHORITY_GATED` |
| Establishment/processor/marketplace | aucune relation Purchase live raccordée | `AUTHORITY_GATED`, objets néanmoins séparés dans le contrat moteur |

La dernière certification officielle disponible, `docs/history-v2/02b-canonical-live-migration-report.md`, établit pour le projet `ipuuhxrblxormwgoaqnz` que les trois tables sont présentes et que `purchase_events` contient **0 ligne**. `docs/history-v2/30-post-history-entry-gate.md` confirme encore les structures vides au cutover History. P09 n’a pas répété une lecture live : aucune preuve plus récente n’était nécessaire pour implémenter le comportement d’absence, et le `LIVE_GATE` reste donc `NOT_RUN`.

Une opération simple n’est jamais convertie automatiquement. Le niveau 4 du Master est physiquement représentable seulement lorsqu’une autorité amont a déjà créé une identité Purchase Event et sa membership exacte. Aucun champ actuel ne qualifie à lui seul une opération comme achat ; aucune règle universelle `purchaseEventId = operationId` n’a été ajoutée. Une table vide signifie données absentes, jamais « aucun achat dans le ménage ».

## F2 — moteur Purchase/Merchant core

### Chaîne implémentée

`CanonicalRepository → PurchaseEventFact + EconomicComponentFact → GlobalTemporalBoundaryResolver → buildGlobalPurchaseMerchant()`.

- `src/analytics/global-v2/purchases.ts` porte le moteur pur `global_purchase_merchant@v1`.
- `src/analytics/global-v2/purchase-dependencies.ts` déclare grain, Facts, entités, fenêtres, policies, capabilities et invalidations.
- `src/server/analytics/global-v2-purchase-authority.ts` est l’adaptateur read-only. Une absence de `purchaseAt` exclut l’événement du corpus comportemental au lieu d’employer `economicDate` ou `bankPostingDate`.
- `src/analytics/global-v2/category-needs.ts` reste l’unique primitive de la formule symétrique fréquence × ticket ; M8 la réutilise comme calcul partagé et fournit des achats retenus à M2/M5 dans un seul sens.

### Contrats fermés

- Un Purchase Event reste une occurrence quels que soient le nombre de funding lines, composantes, allocations, moyens de paiement ou lignes produit.
- Une opération peut alimenter plusieurs Purchase Events seulement via des identités explicites ; plusieurs paiements banque+cash peuvent appartenir au même événement uniquement via la membership Canonical.
- Un retrait ATM sans identité Purchase ne produit aucun événement. Un achat cash explicite conserve les identités économiques de ses composantes.
- Une opération mixte ne reprend que les composantes possédées. Si la part attendue est inconnue, la valeur observée est `PARTIAL/MISSING_LINKAGE` ; le total bancaire n’est jamais utilisé.
- Les refunds économiques deviennent des `PurchaseAdjustment` dérivés et rattachés, sans événement négatif. Cancellation/Return/Exchange explicites restent des adjustments. `checkoutPurchaseCount` ne change pas ; `retainedPurchaseCount` exclut FULLY_RETURNED/CANCELLED.
- Gross, refund et net se réconcilient aux `EconomicComponentFact`; le Fact Purchase ne réécrit jamais Actual.
- `purchaseAt`, `economicDate` et les `bankPostingDates` sont des champs distincts. Aucune date ne remplace silencieusement une autre.
- Merchant, MerchantEstablishment, marketplace, processor et channel sont distincts. Une composante UNKNOWN empêche la résolution complète ; deux Merchant différents produisent `CONFLICT`.
- Le titulaire/payeur ne devient jamais bénéficiaire. Seules les attributions bénéficiaire/share P01 ou une assertion dédiée alimentent `beneficiaryPersonIds`.
- Fréquence Merchant = retained events / mois observables. La distribution déterministe conserve count, valeurs triées, minimum et maximum ; médiane = panier typique et moyenne = décomposition additive. L’évolution réutilise `global_temporal_analysis@v1`; NEWLY_OBSERVED, GROWING et DECLINING partent de ces preuves, REGULAR exige un plateau exact, sinon l’état reste UNKNOWN.
- Chaque événement porte la `sourceRevision` fournie par le contexte Canonical ; la provenance du Fact reste une preuve distincte et n’est jamais utilisée comme révision.
- Le drill-down référence les `purchaseEventId` canoniques. Les contributions sont `M8_TO_M2_M5_ONLY`; aucun résultat M2/M5 ne produit Purchase.

## Support, coverage et disponibilité

| Capacité | Implémentation | État sur fixtures | État de la source live certifiée |
|---|---|---|---|
| PurchaseEventResolver / identity | Fact Canonical + ownership exact | AVAILABLE | DATA_GATED (0 événement connu) |
| PurchaseAdjustment | refunds économiques + assertions explicites | AVAILABLE | DATA_GATED hors refund présent |
| split payment / cash / mixed | memberships exactes, aucune proximité | AVAILABLE | DATA_GATED |
| Merchant identity | unanimité des Merchant canoniques ou assertion explicite | AVAILABLE | DATA_GATED |
| establishment / processor / marketplace | autorités séparées | AVAILABLE si assertion | AUTHORITY_GATED |
| checkout/retained/frequency/tickets | PurchaseEvent grain + support observable | AVAILABLE | DATA_GATED |
| fréquence × ticket | formule partagée exacte | AVAILABLE | DATA_GATED |
| Merchant evolution | moteurs temporels P04 | AVAILABLE si série couverte | DATA_GATED |
| Purchase/Merchant drill-down | références d’événements | AVAILABLE | DATA_GATED |
| Product/price/cadence/inflation | hors core P09 | non exécuté | DEFERRED_P10 |

`purchaseCoverage`, `merchantCoverage`, `beneficiaryCoverage` et `establishmentCoverage` ont des dénominateurs séparés. L’univers des événements financiers éligibles à un achat n’est pas physiquement autoritaire aujourd’hui : `purchaseCoverage=UNKNOWN`, jamais `0 %` ou `100 %` inventé. Un univers explicitement qualifié vide donne `NOT_APPLICABLE` sans division par zéro.

## Matrice exhaustive du core P09

| Bloc Master | Exigences | Preuve | Statut |
|---|---:|---|---|
| objets, identité, hiérarchie, interdits | GLO-M08-001–020 | Fact/metadata authority, ownership, aucun merge temporel/merchant | PASS core ; objets Product différés P10 |
| dates et nature | GLO-M08-021–025 | trois temporalités distinctes, kind/interaction explicites | PASS |
| split payments, cash, mixed | GLO-M08-026–036 | membership source-bound, PARTIAL strict, aucune opération universelle | PASS |
| adjustments et fréquences checkout/retained | GLO-M08-037–046 | gross/refund/net, outcomes, adjustments rattachés | PASS |
| Merchant/establishment/intermédiaires | GLO-M08-047–057 | identités séparées, aucune inférence processor→merchant | PASS |
| fréquence, panier et décomposition | GLO-M08-074–080 | retained count, mean/median, formule symétrique exacte | PASS |
| évolution Merchant | GLO-M08-137–138 | réutilisation P04, aucune seconde policy temporelle | PASS |
| coverages/persona/contrat Merchant | GLO-M08-139–148 | quatre coverages core, beneficiary sans payer, summary/drill-down | PASS core |
| pipeline et publication par capacité | GLO-M08-151–156 | capabilities indépendantes, Product explicitement gated | PASS |
| tests Purchase/Merchant | GLO-M08-157–169, 186–187 | scripts discriminants P09 | PASS core |
| Product/price/cadence/substitution/inflation | GLO-M08-058–073, 081–136, 149–150, 170–185 | frontière de mission P09 ; provider et enrichissement P10 | DEFERRED_P10, jamais annoncé actif |

Les **17 capacités core attribuées à P09** (`CAP-ENG-013/014`, `CAP-M08-001–005`, `007–016`) sont implémentées ou publient leur gate de données/autorité. Les exigences Product présentes dans l’index large M8 ne sont pas silencieusement certifiées : elles restent rattachées à P10 conformément au découpage du pack et à la mission P09 « Purchase/Merchant core ».

## Tests et non-régressions

| Validation | Résultat |
|---|---|
| M8 Purchase/Merchant core | 66/66 PASS |
| Canonical → Facts → M8 | 29/29 PASS, repository synthétique, aucune méthode réseau/écriture |
| History V2 Canonical | PASS |
| M2 / matérialité / fréquence × ticket | 49/49 PASS |
| P04 temporel partagé | 179/179 PASS |
| TypeScript `--noEmit` | PASS |
| architecture imports | PASS — 519 fichiers |
| Next production build | PASS |
| `git diff --check` | PASS |

Cas discriminants : un achat/3 paiements, banque+cash, trois composantes, remboursement total/partiel, cancellation, opération mixte, retrait sans identité, opération simple explicitement qualifiée niveau 4, deux événements même opération/merchant, processor distinct, bénéficiaire inconnu malgré payeur connu, conflit Merchant, déduplication ownership, qualified-empty, déterminisme, sensibilité des hashes, décomposition exacte et invariance du compte/total au nombre de funding lines.

## Limites honnêtes et handoff

- Le live certifié ne fournit aucune donnée Purchase ; le code est prêt et testé, mais aucune statistique réelle n’est déclarée active.
- Le schéma Canonical actuel n’expose pas `purchaseAt`, outcome métier hors refund, MerchantEstablishment, processor ou marketplace comme providers Purchase. Leur présence dans une future source exige T01 ou le lot d’autorité correspondant, puis replay par closure.
- L’univers complet des sources financières éligibles à l’achat manque ; la couverture live reste UNKNOWN.
- Le scope personnel serveur est fail-closed tant qu’un provider ne permet pas de conserver simultanément le grain Purchase et les montants P01 fractionnés sans double compte.
- ProductLine, ProductAcquisitionOccurrence, prix, substitution, cadence et inflation sont réservés à P10. Aucun produit ou faux référentiel n’a été créé.

CURRENT_PROMPT = P09

BASELINE_HEAD = 4551c103c98432181982c351bb3ab256e3cf4b43

IMPLEMENTATION_GATE = PASS

CONTRACT_GATE = PASS

TEST_GATE = PASS

GLOBAL_PHASE_F1_F2_CORE = PASS

LIVE_GATE = NOT_RUN

CAPABILITIES_ACTIVE = PURCHASE_MERCHANT_CORE_ON_AUTHORITATIVE_INPUTS

CAPABILITIES_GATED = LIVE_PURCHASE_DATA,PURCHASE_AT,ELIGIBLE_PURCHASE_UNIVERSE,ESTABLISHMENT,PERSON_PURCHASE_AMOUNT,PRODUCT_P10

UNRESOLVED_REQUIREMENTS = NONE_IN_P09_CORE

LIVE_WRITES = NONE

NEXT_PERMITTED_PROMPT = P10
