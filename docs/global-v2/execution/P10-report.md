# P10B — Produits fermés et convergence Purchase/Merchant

## Baseline et contrat d'exécution

- Branche : `main`.
- HEAD d'entrée : `32213755dc3473683edaf96a9243fc0a16a26922`.
- Autorités : Master Global puis `GLOBAL_EXECUTION_CONTRACT.md`; `P10-ASTRA-FREEZE.md` est le freeze technique appliqué sans réaudit.
- `P10A_FREEZE_GATE = PASS` vérifié dans le freeze et dans l'état durable.
- Portée : F3 conditionnel et F4, sans Query, ReadModel, React, migration, publication ou accès live.

## Correspondance avec le freeze P10A

| Freeze | Exécution P10B | Preuve | Statut |
|---|---|---|---|
| gates produit AG002–004 / AG012–022 | fermeture typée et catalogue déterministe; les données brutes n'ouvrent aucun gate | `product-capabilities.ts`, P10-N01–N04 | PASS |
| Merchant Substitution conditionnel | univers explicite versionné, coverage exhaustive, fenêtres P04, axes dépense/fréquence séparés, résultat associatif | `merchant-substitution.ts`, P10-S01–S05 | PASS |
| M8 → M2 | événements retenus avec date, preuve, coverage et révision; décomposition P03 réutilisée | `purchase-convergence.ts`, adaptateur serveur M2, P10-B01/B02 | PASS |
| séries M8 → C | séries `PURCHASE_BASKET`, `MERCHANT_FREQUENCY` et `CONSUMPTION_SUBSTITUTION` seulement lorsque prouvées | `purchase-convergence.ts`, P10-C01 | PASS |
| M5/FDR | définition P10 examinée parmi 31, exclue sans p-value faute d'autorité achat localisé; q-values inchangées | `recertifyGlobalBCDForPurchases`, P10-D01 | PASS no-op |
| graphe M8 | faux inputs M2/M5 et résultat M3 retirés; consommateurs déclarés séparément | `purchase-dependencies.ts`, P10-H01 | PASS |

## Capacités

### Actives ou implémentées conditionnellement

- Purchase/Merchant core P09 reste l'unique producteur M8.
- Merchant Substitution est `DATA_GATED_IMPLEMENTABLE`. Avec un `SubstitutionUniverseCatalog` versionné, une couverture Purchase connue à 100 %, les fenêtres 6+6/6+4, les supports et matérialités requis, il produit `SPEND_SHIFT`, `FREQUENCY_SHIFT` ou `BOTH`.
- L'axe fréquence n'est admissible qu'avec une preuve de matérialité du propriétaire partagé P03. L'absence de cette preuve ne devient jamais un score nul.
- L'enrichissement fréquence × ticket M2 consomme les PurchaseEvents retenus au grain humain, sans reconstruire Typical et sans compter les lignes de paiement.

### Gated

Les capacités associées à `AG002`, `AG003`, `AG004` et `AG012` à `AG022` restent `UNAVAILABLE`. PurchaseLine, ProductFamily, ProductVariant, ProductFormat, unité normalisée, acquisition, cadence, lifecycle, substitution produit et indice personnel n'ont aucun provider artificiel. Les raisons machine et `AUTHORITY_NOT_PROVEN_GA0` sont conservées. L'ouverture positive exige T01. `PersonalReferenceCost` reste différé à son owner contractuel.

Un catalogue marchand absent retourne `SUBSTITUTION_UNIVERSE_DATA_GATED` ou `SUBSTITUTION_UNIVERSE_AUTHORITY_GATED`; une couverture incomplète retourne `PURCHASE_EVENT_COVERAGE_INCOMPLETE`. Aucun de ces états n'est publié comme univers vide connu.

## Modifications réalisées

- `purchases.ts` expose la révision/source, la borne certifiée et des contributions M2/M5 riches sans changer l'identité Purchase ni ses montants.
- `purchase-dependencies.ts` ne déclare plus les consommateurs downstream comme inputs M8.
- `product-capabilities.ts` ferme précisément les gates produit sans faux Fact.
- `merchant-substitution.ts` implémente le moteur conditionnel : canonicalisation, seuils exacts, evidence refs, support, coverage, Big.js, méthodes/policies et hashes sensibles.
- `purchase-convergence.ts` porte les adaptateurs B/C, l'examen D et le DAG sans cycle.
- `global-v2-category-needs-authority.ts` accepte le résultat M8 prouvé, vérifie `sourceRevision` et injecte réellement la décomposition dans le builder M2 existant.
- L'extension optionnelle `materialFrequencyChange` des primitives P04 n'ouvre que l'alternative déjà autorisée par `GlobalMaterialityEngine`; elle est incluse dans le hash d'input.
- Exports et commande ciblée ajoutés dans `index.ts` et `package.json`.

Décisions techniques d'exécution : ensembles triés par identités; doublons contradictoires rejetés; propriétés optionnelles omises plutôt que présentes avec `undefined`; catalogues et preuves inclus dans les hashes; axes fusionnés en `BOTH` seulement après qualification indépendante; aucun montant ou score inter-domaines comparé.

## Closure et recertification B/C/D

| Owner | Intrant P10 | Résultat | Digest / effet | Statut |
|---|---|---|---|---|
| B / M2 | PurchaseEvents retenus, `purchaseAt`, coverage, sourceRevision | fréquence × ticket additive exacte | hash M8 + fenêtre + événements | PASS enrichi |
| B / M1 | aucune nouvelle vérité économique | Actual/Typical/Minimal inchangés | hash avant = hash après exigé, sinon T02 | PASS no-op |
| C / M3 | séries M8 autorisées et substitution qualifiée | enrichissement unidirectionnel | hashes temporels P04 + closure P10 | PASS |
| D / M5 | relation visite/achat localisé sans provider autoritaire | définition examinée puis exclue, aucune p-value | plan 31 inchangé | PASS no-op |

Le DAG final interdit explicitement `M2_TO_M8_RESULT`, `M5_TO_M8_RESULT` et `M3_RELATIONSHIP_ENRICHMENT_TO_M5_REGIME`. Une mutation de la vérité économique amont échoue avec reprise owner/T02. Une future activation de la définition M5 P10 devra être traitée par P06/T02 et recalculer tout l'univers BH du scope.

## Tests réellement exécutés

- `check-global-v2-purchase-convergence.mjs` : 56/56 PASS. Gates négatifs, substitution dépense/fréquence/BOTH, frontières 7/8, 9.99/10 points, 0.499/0.50, 31/32 jours, 6+3 rejeté, no-lookahead, canonicalisation/hash, M2 exact 32.5 + 37.5 = 70, closure et no-op FDR.
- `check-global-v2-purchases.mjs` : 66/66 PASS.
- `check-global-v2-purchase-authority.mjs` : 29/29 PASS, repository synthétique sans méthode réseau/écriture.
- `check-global-v2-category-needs-materiality.mjs` : 49/49 PASS.
- `check-global-v2-economic-function.mjs` : 72/72 PASS.
- `check-global-v2-temporal-arbitration.mjs` : 179/179 PASS.
- `check-global-v2-temporal-descriptive.mjs` : 17/17 PASS.
- `check-global-v2-relationships.mjs` : 266/266 PASS.
- `check-global-v2-relationship-authority.mjs` : 20/20 PASS, repository synthétique sans méthode réseau/écriture.
- Typecheck, architecture, build production et `git diff --check` : voir la clôture ci-dessous.

## Écarts et hard stops

- Aucun écart normatif nouveau n'a invalidé le freeze.
- Les cas positifs Product restent non exécutés, conformément au freeze : ils exigent une autorité T01 et ne sont pas simulés.
- La relation M5 visite/achat localisé reste indisponible : aucune activation ni p-value n'est fabriquée.
- Aucune source compare-only/oracle n'alimente un payload ou un moteur.
- `LIVE_GATE = NOT_RUN`; `LIVE_WRITES = NONE`; migrations = aucune.

## Verdict

IMPLEMENTATION_GATE = PASS

CONTRACT_GATE = PASS

TEST_GATE = PASS

GLOBAL_PHASE_F3_F4 = PASS

CAPABILITIES_GATED = PRODUCT_LINES,PRODUCT_IDENTITY,NORMALIZED_UNIT,PRODUCT_ACQUISITION,PRODUCT_CADENCE,PRODUCT_LIFECYCLE,PRODUCT_SUBSTITUTION,PERSONAL_PRICE_INDEX,LOCALIZED_PURCHASE_RELATIONSHIP

LIVE_WRITES = NONE

NEXT_PERMITTED_PROMPT = P11

STOP après P10B.
