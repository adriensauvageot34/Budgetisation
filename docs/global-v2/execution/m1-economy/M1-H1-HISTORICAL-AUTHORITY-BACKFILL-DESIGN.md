# M1-H1 — Historical authority and backfill design

## 1. Verdict

H1 transforme le blocage H0 en un ensemble fini de 51 décisions et en un modèle de backfill sans look-ahead. Il ne valide ni ces décisions, ni une migration, ni une republication.

```
M1_H1_BACKFILL_DESIGN = PASS
MINIMAL_12M_REPLAY_AFTER_APPROVAL = POSSIBLE
```

Les occurrences financières datées sont des preuves d’observation. Elles ne prouvent jamais seules l’existence d’une règle Minimal, un début contractuel, un état ACTIVE/ENDED/INTERRUPTED/RESTARTED, ni une famille Master. Les valeurs financières privées ne sont pas écrites dans Git : le pack conserve leurs cardinalités et digests.

```
TOTAL_RULES = 40
RULES_AUTO_PROVABLE = 0
RULES_HUMAN_CONFIRM = 35
RULES_UNKNOWN = 5
RULES_BLOCKING = 35

TOTAL_RECURRENCES = 35
RECURRENCES_AUTO_PROVABLE = 19
RECURRENCES_HUMAN_CONFIRM = 16
RECURRENCES_UNKNOWN = 0
RECURRENCES_BLOCKING = 16

HUMAN_DECISIONS_REQUIRED = 51
```

`AUTO_PROVABLE` sur une récurrence signifie uniquement que ses occurrences observées peuvent être historisées automatiquement. Son cycle de vie reste `UNKNOWN`.

## 2. Sources inspectées

- Brief normatif M1 fourni : `BRIEF_TECHNIQUE_FINAL_M1_VOTRE_ECONOMIE (1).md`.
- Red-team M1-H fourni : `M1-H-FINAL-RED-TEAM.md`.
- Résultat H0 communiqué ; aucun rapport H0 physique n’était présent.
- Supabase `ipuuhxrblxormwgoaqnz`, lectures seules : règles, récurrences, opérations et composants Canonical nécessaires.
- `src/analytics/baseline/minimal-month.ts`
- `src/server/analytics/minimal-source-resolver.ts`
- `src/server/canonical/repository.ts`
- `scripts/lib/history-v2-current-minimal-evidence.mjs`
- manifests et dependency hashes History existants.

Constats : 40 règles, toutes sans validité historique renseignée et créées/mises à jour le 20 août 2026 ; 35 séries avec occurrences datées mais sans versioning de cycle de vie ; 35 règles utilisées sur 2025-08 → 2026-07 et 5 sans composant associé. Les artifacts `minimal_month_cost@v1` ne contiennent pas les inputs historiques rejouables.

## 3. Matrice exhaustive — 40 règles

La famille est une proposition, jamais une décision. `preciseType` est pseudonymisé pour éviter de committer un détail privé.

| baselineRuleId | categoryId | subcategoryId? | preciseType? | currentEligibility | currentMethodVersion | currentValidFrom | currentValidTo | createdAt | firstHistoricalEvidenceDate | lastHistoricalEvidenceDate | historicalEvidenceType | linkedComponentsCount | linkedOperationsCount | linkedRecurrenceSeriesIds | masterRuleFamilyCandidate | historicalExistenceProvable | historicalMinimalEligibilityProvable | earliestProvableDate | latestProvableDate | proposedEffectiveFrom | proposedEffectiveTo | proposalBasis | proposalConfidence | humanValidationRequired | humanQuestion | safeAutomaticBackfill | unresolvedReason | status |
| - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| bc3a0182-5300-5d1d-ba5f-f48b6e9ccbde | e33e6afe-896d-57da-a201-5e6f735b0afd | — | — | Excluded | minimal_baseline_v1 | — | — | 2026-08-20 | 2025-09-14 | 2026-01-20 | DATED_ECONOMIC_COMPONENTS_AND_OPERATIONS | 5 | 5 | — | EXCLUDED_FROM_MINIMAL / HUMAN_CONFIRM_REQUIRED | NO | NO | 2025-09-14 | 2026-01-20 | HUMAN_CONFIRM_REQUIRED (2025-09-14) | UNKNOWN | Les composants/opérations datés prouvent l’existence économique à ces dates, pas l’existence ni l’éligibilité historique de la règle. La famille est une proposition à confirmer. | MEDIUM | YES | Confirmez-vous que la règle Achats personnels appartenait à EXCLUDED_FROM_MINIMAL à partir du 2025-09-14, ou indiquez une autre date / UNKNOWN ? | NO | Aucune version datée de la règle ne prouve effectiveFrom/effectiveTo ni la famille Master historique. | BLOCKS_MINIMAL_HISTORY |
| 8206b62a-7c2c-5f91-b4da-9295828909c0 | 4993a4f6-4821-5b79-bcf2-6188bbaaaf53 | — | — | Excluded | minimal_baseline_v1 | — | — | 2026-08-20 | 2026-01-26 | 2026-01-26 | DATED_ECONOMIC_COMPONENTS_AND_OPERATIONS | 1 | 1 | — | EXCLUDED_FROM_MINIMAL / HUMAN_CONFIRM_REQUIRED | NO | NO | 2026-01-26 | 2026-01-26 | HUMAN_CONFIRM_REQUIRED (2026-01-26) | UNKNOWN | Les composants/opérations datés prouvent l’existence économique à ces dates, pas l’existence ni l’éligibilité historique de la règle. La famille est une proposition à confirmer. | MEDIUM | YES | Confirmez-vous que la règle Administratif appartenait à EXCLUDED_FROM_MINIMAL à partir du 2026-01-26, ou indiquez une autre date / UNKNOWN ? | NO | Aucune version datée de la règle ne prouve effectiveFrom/effectiveTo ni la famille Master historique. | BLOCKS_MINIMAL_HISTORY |
| 109659db-177f-544d-b24c-e001e25f39cb | ea76c987-231d-5a4a-8ad2-24c8ef074760 | 7c170656-185b-59fd-b4df-1c965f5980e2 | — | Eligible | minimal_baseline_v1 | — | — | 2026-08-20 | 2025-08-01 | 2026-07-29 | DATED_ECONOMIC_COMPONENTS_AND_OPERATIONS | 179 | 179 | — | VARIABLE_ESSENTIAL / HUMAN_CONFIRM_REQUIRED | NO | NO | 2025-08-01 | 2026-07-29 | HUMAN_CONFIRM_REQUIRED (2025-08-01) | UNKNOWN | Les composants/opérations datés prouvent l’existence économique à ces dates, pas l’existence ni l’éligibilité historique de la règle. La famille est une proposition à confirmer. | MEDIUM | YES | Confirmez-vous que la règle Alimentation / Courses alimentaires appartenait à VARIABLE_ESSENTIAL à partir du 2025-08-01, ou indiquez une autre date / UNKNOWN ? | NO | Aucune version datée de la règle ne prouve effectiveFrom/effectiveTo ni la famille Master historique. | BLOCKS_MINIMAL_HISTORY |
| 4b43c704-9864-5306-9e06-4420faadba14 | ea76c987-231d-5a4a-8ad2-24c8ef074760 | 69f6f377-544d-558d-8745-2f87c88592bf | — | Eligible | minimal_baseline_v1 | — | — | 2026-08-20 | 2025-11-10 | 2025-11-10 | DATED_ECONOMIC_COMPONENTS_AND_OPERATIONS | 1 | 1 | — | VARIABLE_ESSENTIAL / HUMAN_CONFIRM_REQUIRED | NO | NO | 2025-11-10 | 2025-11-10 | HUMAN_CONFIRM_REQUIRED (2025-11-10) | UNKNOWN | Les composants/opérations datés prouvent l’existence économique à ces dates, pas l’existence ni l’éligibilité historique de la règle. La famille est une proposition à confirmer. | MEDIUM | YES | Confirmez-vous que la règle Alimentation / Épicerie / alimentation générale appartenait à VARIABLE_ESSENTIAL à partir du 2025-11-10, ou indiquez une autre date / UNKNOWN ? | NO | Aucune version datée de la règle ne prouve effectiveFrom/effectiveTo ni la famille Master historique. | BLOCKS_MINIMAL_HISTORY |
| c504c739-c3fb-5851-9f7d-e684b6c9ac37 | ea76c987-231d-5a4a-8ad2-24c8ef074760 | — | — | Excluded | minimal_baseline_v1 | — | — | 2026-08-20 | 2025-08-04 | 2026-07-30 | DATED_ECONOMIC_COMPONENTS_AND_OPERATIONS | 522 | 522 | — | EXCLUDED_FROM_MINIMAL / HUMAN_CONFIRM_REQUIRED | NO | NO | 2025-08-04 | 2026-07-30 | HUMAN_CONFIRM_REQUIRED (2025-08-04) | UNKNOWN | Les composants/opérations datés prouvent l’existence économique à ces dates, pas l’existence ni l’éligibilité historique de la règle. La famille est une proposition à confirmer. | MEDIUM | YES | Confirmez-vous que la règle Alimentation appartenait à EXCLUDED_FROM_MINIMAL à partir du 2025-08-04, ou indiquez une autre date / UNKNOWN ? | NO | Aucune version datée de la règle ne prouve effectiveFrom/effectiveTo ni la famille Master historique. | BLOCKS_MINIMAL_HISTORY |
| dc9bfe46-7cb7-5638-a2ce-15935a7ba2eb | 78b6f938-1181-501f-927e-e6e84b7eaa38 | — | — | Excluded | minimal_baseline_v1 | — | — | 2026-08-20 | 2025-09-16 | 2026-07-01 | DATED_ECONOMIC_COMPONENTS_AND_OPERATIONS | 10 | 10 | — | EXCLUDED_FROM_MINIMAL / HUMAN_CONFIRM_REQUIRED | NO | NO | 2025-09-16 | 2026-07-01 | HUMAN_CONFIRM_REQUIRED (2025-09-16) | UNKNOWN | Les composants/opérations datés prouvent l’existence économique à ces dates, pas l’existence ni l’éligibilité historique de la règle. La famille est une proposition à confirmer. | MEDIUM | YES | Confirmez-vous que la règle Animaux appartenait à EXCLUDED_FROM_MINIMAL à partir du 2025-09-16, ou indiquez une autre date / UNKNOWN ? | NO | Aucune version datée de la règle ne prouve effectiveFrom/effectiveTo ni la famille Master historique. | BLOCKS_MINIMAL_HISTORY |
| 12caff0a-8f3f-5a05-81c5-4a2d9169e9d1 | 4f0e9539-b572-5fe4-a582-148f8f281cbb | f3db2fcb-b347-56df-bb32-ab9e8bea496d | — | Eligible | minimal_baseline_v1 | — | — | 2026-08-20 | 2025-08-20 | 2026-07-20 | DATED_ECONOMIC_COMPONENTS_AND_OPERATIONS | 13 | 13 | 257bc01f-425b-50a9-847a-ca3600a0f80e, 9b4c64f5-29e0-5d33-8ae4-194007e36eeb, d7a6e623-87c0-5f7a-905f-93ff5abc5b60 | FIXED_REQUIRED / HUMAN_CONFIRM_REQUIRED | NO | NO | 2025-08-20 | 2026-07-20 | HUMAN_CONFIRM_REQUIRED (2025-08-20) | UNKNOWN | Les composants/opérations datés prouvent l’existence économique à ces dates, pas l’existence ni l’éligibilité historique de la règle. La famille est une proposition à confirmer. | MEDIUM | YES | Confirmez-vous que la règle Assurances / Assurance automobile appartenait à FIXED_REQUIRED à partir du 2025-08-20, ou indiquez une autre date / UNKNOWN ? | NO | Aucune version datée de la règle ne prouve effectiveFrom/effectiveTo ni la famille Master historique. | BLOCKS_MINIMAL_HISTORY |
| abfe0a6a-c314-5b4b-99cc-f2e1b9e78232 | 4f0e9539-b572-5fe4-a582-148f8f281cbb | 15694b28-7713-5020-ab1f-290fc3bd754f | — | Eligible | minimal_baseline_v1 | — | — | 2026-08-20 | 2025-08-04 | 2026-07-06 | DATED_ECONOMIC_COMPONENTS_AND_OPERATIONS | 12 | 12 | d7f56f4f-baeb-5659-a89d-0d225c090441 | FIXED_REQUIRED / HUMAN_CONFIRM_REQUIRED | NO | NO | 2025-08-04 | 2026-07-06 | HUMAN_CONFIRM_REQUIRED (2025-08-04) | UNKNOWN | Les composants/opérations datés prouvent l’existence économique à ces dates, pas l’existence ni l’éligibilité historique de la règle. La famille est une proposition à confirmer. | MEDIUM | YES | Confirmez-vous que la règle Assurances / Assurance habitation appartenait à FIXED_REQUIRED à partir du 2025-08-04, ou indiquez une autre date / UNKNOWN ? | NO | Aucune version datée de la règle ne prouve effectiveFrom/effectiveTo ni la famille Master historique. | BLOCKS_MINIMAL_HISTORY |
| 72be0ea2-4d71-52ab-a3f5-e92adf272597 | 4f0e9539-b572-5fe4-a582-148f8f281cbb | dde19475-a408-58b0-af4f-73be9b0f80a7 | — | Eligible | minimal_baseline_v1 | — | — | 2026-08-20 | 2025-08-04 | 2026-07-06 | DATED_ECONOMIC_COMPONENTS_AND_OPERATIONS | 12 | 12 | d1235129-9c4a-5673-961e-1c0e2b80cad8 | FIXED_REQUIRED / HUMAN_CONFIRM_REQUIRED | NO | NO | 2025-08-04 | 2026-07-06 | HUMAN_CONFIRM_REQUIRED (2025-08-04) | UNKNOWN | Les composants/opérations datés prouvent l’existence économique à ces dates, pas l’existence ni l’éligibilité historique de la règle. La famille est une proposition à confirmer. | MEDIUM | YES | Confirmez-vous que la règle Assurances / Protection juridique appartenait à FIXED_REQUIRED à partir du 2025-08-04, ou indiquez une autre date / UNKNOWN ? | NO | Aucune version datée de la règle ne prouve effectiveFrom/effectiveTo ni la famille Master historique. | BLOCKS_MINIMAL_HISTORY |
| ba1bf674-fa67-5ff3-a59d-07dbf662470f | 4f0e9539-b572-5fe4-a582-148f8f281cbb | 2195b976-e2b4-523d-8552-8bc49a41deb0 | — | Eligible | minimal_baseline_v1 | — | — | 2026-08-20 | 2025-08-10 | 2026-07-09 | DATED_ECONOMIC_COMPONENTS_AND_OPERATIONS | 12 | 12 | 62961690-4690-51a8-867d-abee35294e2d | FIXED_REQUIRED / HUMAN_CONFIRM_REQUIRED | NO | NO | 2025-08-10 | 2026-07-09 | HUMAN_CONFIRM_REQUIRED (2025-08-10) | UNKNOWN | Les composants/opérations datés prouvent l’existence économique à ces dates, pas l’existence ni l’éligibilité historique de la règle. La famille est une proposition à confirmer. | MEDIUM | YES | Confirmez-vous que la règle Assurances / Responsabilité civile appartenait à FIXED_REQUIRED à partir du 2025-08-10, ou indiquez une autre date / UNKNOWN ? | NO | Aucune version datée de la règle ne prouve effectiveFrom/effectiveTo ni la famille Master historique. | BLOCKS_MINIMAL_HISTORY |
| f9606fec-c9fe-5e95-9d3c-e2f34a50b584 | 4f0e9539-b572-5fe4-a582-148f8f281cbb | — | — | Excluded | minimal_baseline_v1 | — | — | 2026-08-20 | — | — | NONE | 0 | 0 | — | UNKNOWN / CANNOT_MAP_SAFELY | NO | NO | — | — | UNKNOWN | UNKNOWN | Aucun composant historique de la fenêtre n’est rattaché à cette règle; aucune date ni famille historique ne peut être reconstruite. | NONE | NO | — | NO | Aucune preuve historique liée; garder UNKNOWN ne change aucun calcul observé des 12 mois. | MUST_REMAIN_UNKNOWN |
| 1668d247-38dd-529a-ba7f-e5c8c33b5b63 | bf0cff5c-6177-5975-a153-814a11fb3767 | f3ecd18f-5805-558a-b75c-c15afda75545 | — | Eligible | minimal_baseline_v1 | — | — | 2026-08-20 | 2025-08-08 | 2026-07-21 | DATED_ECONOMIC_COMPONENTS_AND_OPERATIONS | 22 | 22 | 5b641a6b-b66d-5217-872a-29803f2552eb, 85178ac7-ac64-554a-abd7-42c7c154304f | FIXED_REQUIRED / HUMAN_CONFIRM_REQUIRED | NO | NO | 2025-08-08 | 2026-07-21 | HUMAN_CONFIRM_REQUIRED (2025-08-08) | UNKNOWN | Les composants/opérations datés prouvent l’existence économique à ces dates, pas l’existence ni l’éligibilité historique de la règle. La famille est une proposition à confirmer. | MEDIUM | YES | Confirmez-vous que la règle Banque / Cotisation Offre Essentiel appartenait à FIXED_REQUIRED à partir du 2025-08-08, ou indiquez une autre date / UNKNOWN ? | NO | Aucune version datée de la règle ne prouve effectiveFrom/effectiveTo ni la famille Master historique. | BLOCKS_MINIMAL_HISTORY |
| ef44cdad-f419-5ad7-bcc4-f0418b9088f7 | bf0cff5c-6177-5975-a153-814a11fb3767 | 09d0e74e-9d9d-501c-8290-eaf8e5ad3f40 | — | Eligible | minimal_baseline_v1 | — | — | 2026-08-20 | 2026-04-15 | 2026-07-17 | DATED_ECONOMIC_COMPONENTS_AND_OPERATIONS | 4 | 4 | 16f9e5e2-28e8-59e6-8f59-55c25f1564a9 | FIXED_REQUIRED / HUMAN_CONFIRM_REQUIRED | NO | NO | 2026-04-15 | 2026-07-17 | HUMAN_CONFIRM_REQUIRED (2026-04-15) | UNKNOWN | Les composants/opérations datés prouvent l’existence économique à ces dates, pas l’existence ni l’éligibilité historique de la règle. La famille est une proposition à confirmer. | MEDIUM | YES | Confirmez-vous que la règle Banque / Tenue de compte appartenait à FIXED_REQUIRED à partir du 2026-04-15, ou indiquez une autre date / UNKNOWN ? | NO | Aucune version datée de la règle ne prouve effectiveFrom/effectiveTo ni la famille Master historique. | BLOCKS_MINIMAL_HISTORY |
| 520d2225-88ad-52ff-8a99-a250eb329937 | bf0cff5c-6177-5975-a153-814a11fb3767 | — | — | Excluded | minimal_baseline_v1 | — | — | 2026-08-20 | 2026-05-07 | 2026-07-07 | DATED_ECONOMIC_COMPONENTS_AND_OPERATIONS | 4 | 4 | 28e03eb9-2b04-5eac-a7b9-2c36ab4e1b90 | EXCLUDED_FROM_MINIMAL / HUMAN_CONFIRM_REQUIRED | NO | NO | 2026-05-07 | 2026-07-07 | HUMAN_CONFIRM_REQUIRED (2026-05-07) | UNKNOWN | Les composants/opérations datés prouvent l’existence économique à ces dates, pas l’existence ni l’éligibilité historique de la règle. La famille est une proposition à confirmer. | MEDIUM | YES | Confirmez-vous que la règle Banque appartenait à EXCLUDED_FROM_MINIMAL à partir du 2026-05-07, ou indiquez une autre date / UNKNOWN ? | NO | Aucune version datée de la règle ne prouve effectiveFrom/effectiveTo ni la famille Master historique. | BLOCKS_MINIMAL_HISTORY |
| 4bbbe418-5db0-5f19-8a1e-7b745a0d1de8 | 60e0aeef-57b1-55b2-ab24-42b59a807d7b | — | — | Excluded | minimal_baseline_v1 | — | — | 2026-08-20 | 2025-09-23 | 2026-07-06 | DATED_ECONOMIC_COMPONENTS_AND_OPERATIONS | 15 | 10 | — | EXCLUDED_FROM_MINIMAL / HUMAN_CONFIRM_REQUIRED | NO | NO | 2025-09-23 | 2026-07-06 | HUMAN_CONFIRM_REQUIRED (2025-09-23) | UNKNOWN | Les composants/opérations datés prouvent l’existence économique à ces dates, pas l’existence ni l’éligibilité historique de la règle. La famille est une proposition à confirmer. | MEDIUM | YES | Confirmez-vous que la règle Cadeaux appartenait à EXCLUDED_FROM_MINIMAL à partir du 2025-09-23, ou indiquez une autre date / UNKNOWN ? | NO | Aucune version datée de la règle ne prouve effectiveFrom/effectiveTo ni la famille Master historique. | BLOCKS_MINIMAL_HISTORY |
| 383c3ee2-7356-5848-8548-81cd16d0799a | 4dca87db-57a6-5a09-8521-080efcc124bb | — | — | Excluded | minimal_baseline_v1 | — | — | 2026-08-20 | 2025-08-03 | 2025-08-03 | DATED_ECONOMIC_COMPONENTS_AND_OPERATIONS | 1 | 1 | — | EXCLUDED_FROM_MINIMAL / HUMAN_CONFIRM_REQUIRED | NO | NO | 2025-08-03 | 2025-08-03 | HUMAN_CONFIRM_REQUIRED (2025-08-03) | UNKNOWN | Les composants/opérations datés prouvent l’existence économique à ces dates, pas l’existence ni l’éligibilité historique de la règle. La famille est une proposition à confirmer. | MEDIUM | YES | Confirmez-vous que la règle Crédits & dettes appartenait à EXCLUDED_FROM_MINIMAL à partir du 2025-08-03, ou indiquez une autre date / UNKNOWN ? | NO | Aucune version datée de la règle ne prouve effectiveFrom/effectiveTo ni la famille Master historique. | BLOCKS_MINIMAL_HISTORY |
| 1af1cdb9-cf1b-5a00-b157-4060e5045f38 | 4a9ca4b0-929a-579d-a786-cb1fc0858a05 | — | — | Excluded | minimal_baseline_v1 | — | — | 2026-08-20 | 2025-08-13 | 2026-06-27 | DATED_ECONOMIC_COMPONENTS_AND_OPERATIONS | 33 | 27 | — | EXCLUDED_FROM_MINIMAL / HUMAN_CONFIRM_REQUIRED | NO | NO | 2025-08-13 | 2026-06-27 | HUMAN_CONFIRM_REQUIRED (2025-08-13) | UNKNOWN | Les composants/opérations datés prouvent l’existence économique à ces dates, pas l’existence ni l’éligibilité historique de la règle. La famille est une proposition à confirmer. | MEDIUM | YES | Confirmez-vous que la règle Culture & événements appartenait à EXCLUDED_FROM_MINIMAL à partir du 2025-08-13, ou indiquez une autre date / UNKNOWN ? | NO | Aucune version datée de la règle ne prouve effectiveFrom/effectiveTo ni la famille Master historique. | BLOCKS_MINIMAL_HISTORY |
| b5293356-d3b4-5579-8767-f8cd94648be9 | db6a3084-764f-5620-bf46-1346dc2c7748 | — | — | Excluded | minimal_baseline_v1 | — | — | 2026-08-20 | 2026-01-20 | 2026-01-20 | DATED_ECONOMIC_COMPONENTS_AND_OPERATIONS | 1 | 1 | — | EXCLUDED_FROM_MINIMAL / HUMAN_CONFIRM_REQUIRED | NO | NO | 2026-01-20 | 2026-01-20 | HUMAN_CONFIRM_REQUIRED (2026-01-20) | UNKNOWN | Les composants/opérations datés prouvent l’existence économique à ces dates, pas l’existence ni l’éligibilité historique de la règle. La famille est une proposition à confirmer. | MEDIUM | YES | Confirmez-vous que la règle Dons & solidarité appartenait à EXCLUDED_FROM_MINIMAL à partir du 2026-01-20, ou indiquez une autre date / UNKNOWN ? | NO | Aucune version datée de la règle ne prouve effectiveFrom/effectiveTo ni la famille Master historique. | BLOCKS_MINIMAL_HISTORY |
| 213d9d38-0206-5b98-88d7-1eb0923b228e | c39905f8-5199-518a-938a-c15c441b27d5 | — | — | Excluded | minimal_baseline_v1 | — | — | 2026-08-20 | — | — | NONE | 0 | 0 | — | UNKNOWN / CANNOT_MAP_SAFELY | NO | NO | — | — | UNKNOWN | UNKNOWN | Aucun composant historique de la fenêtre n’est rattaché à cette règle; aucune date ni famille historique ne peut être reconstruite. | NONE | NO | — | NO | Aucune preuve historique liée; garder UNKNOWN ne change aucun calcul observé des 12 mois. | MUST_REMAIN_UNKNOWN |
| 2c804e5e-3db9-5e26-9ed4-0ea79b1e646f | c80bb668-5554-5167-8cac-427addced072 | — | — | Excluded | minimal_baseline_v1 | — | — | 2026-08-20 | 2025-08-30 | 2026-05-15 | DATED_ECONOMIC_COMPONENTS_AND_OPERATIONS | 9 | 8 | — | EXCLUDED_FROM_MINIMAL / HUMAN_CONFIRM_REQUIRED | NO | NO | 2025-08-30 | 2026-05-15 | HUMAN_CONFIRM_REQUIRED (2025-08-30) | UNKNOWN | Les composants/opérations datés prouvent l’existence économique à ces dates, pas l’existence ni l’éligibilité historique de la règle. La famille est une proposition à confirmer. | MEDIUM | YES | Confirmez-vous que la règle Habillement appartenait à EXCLUDED_FROM_MINIMAL à partir du 2025-08-30, ou indiquez une autre date / UNKNOWN ? | NO | Aucune version datée de la règle ne prouve effectiveFrom/effectiveTo ni la famille Master historique. | BLOCKS_MINIMAL_HISTORY |
| 26474e82-7153-5c79-b553-d9b75a241219 | 6f9dfbb4-c2d4-5d41-9c61-991ccf8eaa65 | — | — | Eligible | minimal_baseline_v1 | — | — | 2026-08-20 | 2025-08-04 | 2026-07-10 | DATED_ECONOMIC_COMPONENTS_AND_OPERATIONS | 35 | 35 | 0716e2b2-7227-5358-b80c-9e054d0b9cbf, 5079d3ae-7839-58c5-b0f8-4fcb1aabbada, 5b4640d7-aab4-5d53-8ceb-2126584c3448 | FIXED_REQUIRED / HUMAN_CONFIRM_REQUIRED | NO | NO | 2025-08-04 | 2026-07-10 | HUMAN_CONFIRM_REQUIRED (2025-08-04) | UNKNOWN | Les composants/opérations datés prouvent l’existence économique à ces dates, pas l’existence ni l’éligibilité historique de la règle. La famille est une proposition à confirmer. | MEDIUM | YES | Confirmez-vous que la règle Logement appartenait à FIXED_REQUIRED à partir du 2025-08-04, ou indiquez une autre date / UNKNOWN ? | NO | Aucune version datée de la règle ne prouve effectiveFrom/effectiveTo ni la famille Master historique. | BLOCKS_MINIMAL_HISTORY |
| 1b07c729-c264-55bb-90ae-f71b42dacb6a | a5ff934f-2972-5587-893a-83eec15a3f94 | — | — | Excluded | minimal_baseline_v1 | — | — | 2026-08-20 | 2025-08-18 | 2026-07-18 | DATED_ECONOMIC_COMPONENTS_AND_OPERATIONS | 17 | 17 | — | EXCLUDED_FROM_MINIMAL / HUMAN_CONFIRM_REQUIRED | NO | NO | 2025-08-18 | 2026-07-18 | HUMAN_CONFIRM_REQUIRED (2025-08-18) | UNKNOWN | Les composants/opérations datés prouvent l’existence économique à ces dates, pas l’existence ni l’éligibilité historique de la règle. La famille est une proposition à confirmer. | MEDIUM | YES | Confirmez-vous que la règle Loisirs & activités appartenait à EXCLUDED_FROM_MINIMAL à partir du 2025-08-18, ou indiquez une autre date / UNKNOWN ? | NO | Aucune version datée de la règle ne prouve effectiveFrom/effectiveTo ni la famille Master historique. | BLOCKS_MINIMAL_HISTORY |
| 6a4db0ea-9e2f-519d-bdb4-de589fdfd11e | df4b824b-915c-5317-915c-fd6ca67523cb | — | — | Excluded | minimal_baseline_v1 | — | — | 2026-08-20 | 2025-08-11 | 2026-06-21 | DATED_ECONOMIC_COMPONENTS_AND_OPERATIONS | 26 | 25 | — | EXCLUDED_FROM_MINIMAL / HUMAN_CONFIRM_REQUIRED | NO | NO | 2025-08-11 | 2026-06-21 | HUMAN_CONFIRM_REQUIRED (2025-08-11) | UNKNOWN | Les composants/opérations datés prouvent l’existence économique à ces dates, pas l’existence ni l’éligibilité historique de la règle. La famille est une proposition à confirmer. | MEDIUM | YES | Confirmez-vous que la règle Maison & quotidien appartenait à EXCLUDED_FROM_MINIMAL à partir du 2025-08-11, ou indiquez une autre date / UNKNOWN ? | NO | Aucune version datée de la règle ne prouve effectiveFrom/effectiveTo ni la famille Master historique. | BLOCKS_MINIMAL_HISTORY |
| 11129cfd-3b2f-5955-ab75-62460d317f2c | 50d76038-d282-5ff2-af1f-f71f91d7a88c | — | — | Conditional | minimal_baseline_v1 | — | — | 2026-08-20 | 2025-08-11 | 2026-03-15 | DATED_ECONOMIC_COMPONENTS_AND_OPERATIONS | 5 | 5 | — | UNKNOWN / CANNOT_MAP_SAFELY | NO | NO | 2025-08-11 | 2026-03-15 | HUMAN_CONFIRM_REQUIRED (2025-08-11) | UNKNOWN | Les composants/opérations datés prouvent l’existence économique à ces dates, pas l’existence ni l’éligibilité historique de la règle. La famille est une proposition à confirmer. | NONE | YES | Confirmez-vous que la règle Mixte / multi-catégories appartenait à une famille Minimal à préciser à partir du 2025-08-11, ou indiquez une autre date / UNKNOWN ? | NO | Aucune version datée de la règle ne prouve effectiveFrom/effectiveTo ni la famille Master historique. | BLOCKS_MINIMAL_HISTORY |
| 6a855181-7963-5fbd-8a07-6caab6b59e34 | 3cfae8e2-fab8-5f6d-9f8c-07ce0263ef5f | — | — | Excluded | minimal_baseline_v1 | — | — | 2026-08-20 | 2025-08-04 | 2026-07-21 | DATED_ECONOMIC_COMPONENTS_AND_OPERATIONS | 77 | 77 | 24c0cb89-34bf-5e2a-881d-4d4f9f7b694a, 24cefd44-463b-59fa-b232-376b5404461c, 30287970-b389-5b99-ab29-9211a60ca7d5, 3b3f3083-f139-5c1b-927b-6ae638cbe28e, 67657950-b736-5f73-89bc-456d207b965c, 6ceae158-ebba-5208-9d41-85eac3bd4dde, 82bb95c9-fb56-5f4b-ab17-be5971ecf5e5, 91e58dd4-1a8d-536f-a841-eff33c136228, 9511cc7b-41ab-5b0d-9d0a-d73627ef1f9e, a95fcb7e-a912-5686-be33-3c629f7b6390, b1353e19-429f-5ac7-a6e7-d4df1d183b92, b2abae46-3378-5f09-897c-7c44eed28073, c7678c58-82c7-5c27-8507-0c590c2cca17 | EXCLUDED_FROM_MINIMAL / HUMAN_CONFIRM_REQUIRED | NO | NO | 2025-08-04 | 2026-07-21 | HUMAN_CONFIRM_REQUIRED (2025-08-04) | UNKNOWN | Les composants/opérations datés prouvent l’existence économique à ces dates, pas l’existence ni l’éligibilité historique de la règle. La famille est une proposition à confirmer. | MEDIUM | YES | Confirmez-vous que la règle Numérique appartenait à EXCLUDED_FROM_MINIMAL à partir du 2025-08-04, ou indiquez une autre date / UNKNOWN ? | NO | Aucune version datée de la règle ne prouve effectiveFrom/effectiveTo ni la famille Master historique. | BLOCKS_MINIMAL_HISTORY |
| 43edc03d-bca3-5608-8116-45cf736c9fda | fc409898-9b39-52a0-bd14-0b4c71d015dc | — | — | Excluded | minimal_baseline_v1 | — | — | 2026-08-20 | 2025-08-12 | 2026-07-03 | DATED_ECONOMIC_COMPONENTS_AND_OPERATIONS | 15 | 15 | 652537e1-3c33-5109-bc6c-7137c7a811c1, 69e0d24c-e2fa-5063-ac32-f07e3543fa16 | EXCLUDED_FROM_MINIMAL / HUMAN_CONFIRM_REQUIRED | NO | NO | 2025-08-12 | 2026-07-03 | HUMAN_CONFIRM_REQUIRED (2025-08-12) | UNKNOWN | Les composants/opérations datés prouvent l’existence économique à ces dates, pas l’existence ni l’éligibilité historique de la règle. La famille est une proposition à confirmer. | MEDIUM | YES | Confirmez-vous que la règle Permis de conduire appartenait à EXCLUDED_FROM_MINIMAL à partir du 2025-08-12, ou indiquez une autre date / UNKNOWN ? | NO | Aucune version datée de la règle ne prouve effectiveFrom/effectiveTo ni la famille Master historique. | BLOCKS_MINIMAL_HISTORY |
| 516c6cf8-daa7-598c-a38d-40a74b2fe2b5 | 2d1e1923-4dc2-5448-9868-a29ea38e2de9 | — | — | Excluded | minimal_baseline_v1 | — | — | 2026-08-20 | — | — | NONE | 0 | 0 | — | UNKNOWN / CANNOT_MAP_SAFELY | NO | NO | — | — | UNKNOWN | UNKNOWN | Aucun composant historique de la fenêtre n’est rattaché à cette règle; aucune date ni famille historique ne peut être reconstruite. | NONE | NO | — | NO | Aucune preuve historique liée; garder UNKNOWN ne change aucun calcul observé des 12 mois. | MUST_REMAIN_UNKNOWN |
| aa2c620b-1405-528a-a753-c7a23aca179a | 414d4575-925a-5fa2-b1e6-ecd39dd5e0ad | — | — | Excluded | minimal_baseline_v1 | — | — | 2026-08-20 | 2025-08-24 | 2026-07-11 | DATED_ECONOMIC_COMPONENTS_AND_OPERATIONS | 93 | 93 | — | EXCLUDED_FROM_MINIMAL / HUMAN_CONFIRM_REQUIRED | NO | NO | 2025-08-24 | 2026-07-11 | HUMAN_CONFIRM_REQUIRED (2025-08-24) | UNKNOWN | Les composants/opérations datés prouvent l’existence économique à ces dates, pas l’existence ni l’éligibilité historique de la règle. La famille est une proposition à confirmer. | MEDIUM | YES | Confirmez-vous que la règle Restauration appartenait à EXCLUDED_FROM_MINIMAL à partir du 2025-08-24, ou indiquez une autre date / UNKNOWN ? | NO | Aucune version datée de la règle ne prouve effectiveFrom/effectiveTo ni la famille Master historique. | BLOCKS_MINIMAL_HISTORY |
| fee889cf-71f4-57aa-86fa-5e7f6f965c37 | c40f36d2-cf28-5842-82d2-819d0d5d9ec7 | — | — | Excluded | minimal_baseline_v1 | — | — | 2026-08-20 | — | — | NONE | 0 | 0 | — | UNKNOWN / CANNOT_MAP_SAFELY | NO | NO | — | — | UNKNOWN | UNKNOWN | Aucun composant historique de la fenêtre n’est rattaché à cette règle; aucune date ni famille historique ne peut être reconstruite. | NONE | NO | — | NO | Aucune preuve historique liée; garder UNKNOWN ne change aucun calcul observé des 12 mois. | MUST_REMAIN_UNKNOWN |
| bdd1dda9-10e8-5422-82c8-a049ce28ae14 | de5da834-f0dc-5a1f-b56f-ddfec4a9f2c4 | — | — | Excluded | minimal_baseline_v1 | — | — | 2026-08-20 | 2025-08-07 | 2026-07-16 | DATED_ECONOMIC_COMPONENTS_AND_OPERATIONS | 30 | 30 | — | EXCLUDED_FROM_MINIMAL / HUMAN_CONFIRM_REQUIRED | NO | NO | 2025-08-07 | 2026-07-16 | HUMAN_CONFIRM_REQUIRED (2025-08-07) | UNKNOWN | Les composants/opérations datés prouvent l’existence économique à ces dates, pas l’existence ni l’éligibilité historique de la règle. La famille est une proposition à confirmer. | MEDIUM | YES | Confirmez-vous que la règle Santé appartenait à EXCLUDED_FROM_MINIMAL à partir du 2025-08-07, ou indiquez une autre date / UNKNOWN ? | NO | Aucune version datée de la règle ne prouve effectiveFrom/effectiveTo ni la famille Master historique. | BLOCKS_MINIMAL_HISTORY |
| 2d3e9f47-5453-58cc-85a3-37bcc36e0a25 | 9b3b3ad4-f4eb-5998-9e04-48619f012cd1 | 135db977-5151-5594-8cd9-a27bafbe5bcd | — | Eligible | minimal_baseline_v1 | — | — | 2026-08-20 | 2025-09-06 | 2026-05-22 | DATED_ECONOMIC_COMPONENTS_AND_OPERATIONS | 5 | 5 | — | VARIABLE_ESSENTIAL / HUMAN_CONFIRM_REQUIRED | NO | NO | 2025-09-06 | 2026-05-22 | HUMAN_CONFIRM_REQUIRED (2025-09-06) | UNKNOWN | Les composants/opérations datés prouvent l’existence économique à ces dates, pas l’existence ni l’éligibilité historique de la règle. La famille est une proposition à confirmer. | MEDIUM | YES | Confirmez-vous que la règle Soins personnels / Coiffure appartenait à VARIABLE_ESSENTIAL à partir du 2025-09-06, ou indiquez une autre date / UNKNOWN ? | NO | Aucune version datée de la règle ne prouve effectiveFrom/effectiveTo ni la famille Master historique. | BLOCKS_MINIMAL_HISTORY |
| 9a94eaee-4dd2-5c59-865f-26d62a8de29d | 9b3b3ad4-f4eb-5998-9e04-48619f012cd1 | 14467935-127a-55b6-8e5d-3e6769be9bff | REDACTED#c9850045 | Eligible | minimal_baseline_v1 | — | — | 2026-08-20 | 2026-03-11 | 2026-03-11 | DATED_ECONOMIC_COMPONENTS_AND_OPERATIONS | 1 | 1 | — | VARIABLE_ESSENTIAL / HUMAN_CONFIRM_REQUIRED | NO | NO | 2026-03-11 | 2026-03-11 | HUMAN_CONFIRM_REQUIRED (2026-03-11) | UNKNOWN | Les composants/opérations datés prouvent l’existence économique à ces dates, pas l’existence ni l’éligibilité historique de la règle. La famille est une proposition à confirmer. | MEDIUM | YES | Confirmez-vous que la règle Soins personnels / Maquillage appartenait à VARIABLE_ESSENTIAL à partir du 2026-03-11, ou indiquez une autre date / UNKNOWN ? | NO | Aucune version datée de la règle ne prouve effectiveFrom/effectiveTo ni la famille Master historique. | BLOCKS_MINIMAL_HISTORY |
| 704b7737-f651-55fe-914f-e1f6bf33d34b | 9b3b3ad4-f4eb-5998-9e04-48619f012cd1 | 83a83aeb-2555-55e0-9bd8-754b05dbef13 | — | Eligible | minimal_baseline_v1 | — | — | 2026-08-20 | 2025-12-11 | 2026-05-12 | DATED_ECONOMIC_COMPONENTS_AND_OPERATIONS | 5 | 4 | — | VARIABLE_ESSENTIAL / HUMAN_CONFIRM_REQUIRED | NO | NO | 2025-12-11 | 2026-05-12 | HUMAN_CONFIRM_REQUIRED (2025-12-11) | UNKNOWN | Les composants/opérations datés prouvent l’existence économique à ces dates, pas l’existence ni l’éligibilité historique de la règle. La famille est une proposition à confirmer. | MEDIUM | YES | Confirmez-vous que la règle Soins personnels / Skincare appartenait à VARIABLE_ESSENTIAL à partir du 2025-12-11, ou indiquez une autre date / UNKNOWN ? | NO | Aucune version datée de la règle ne prouve effectiveFrom/effectiveTo ni la famille Master historique. | BLOCKS_MINIMAL_HISTORY |
| 597172f9-b948-5ca8-b41e-c1373f381061 | 9b3b3ad4-f4eb-5998-9e04-48619f012cd1 | — | — | Excluded | minimal_baseline_v1 | — | — | 2026-08-20 | 2025-08-14 | 2026-07-25 | DATED_ECONOMIC_COMPONENTS_AND_OPERATIONS | 24 | 18 | — | EXCLUDED_FROM_MINIMAL / HUMAN_CONFIRM_REQUIRED | NO | NO | 2025-08-14 | 2026-07-25 | HUMAN_CONFIRM_REQUIRED (2025-08-14) | UNKNOWN | Les composants/opérations datés prouvent l’existence économique à ces dates, pas l’existence ni l’éligibilité historique de la règle. La famille est une proposition à confirmer. | MEDIUM | YES | Confirmez-vous que la règle Soins personnels appartenait à EXCLUDED_FROM_MINIMAL à partir du 2025-08-14, ou indiquez une autre date / UNKNOWN ? | NO | Aucune version datée de la règle ne prouve effectiveFrom/effectiveTo ni la famille Master historique. | BLOCKS_MINIMAL_HISTORY |
| c09c9840-2d5e-562c-9f78-d902b43f876a | 645802f4-51a3-50c6-9117-55b0035e8f5e | — | — | Excluded | minimal_baseline_v1 | — | — | 2026-08-20 | 2025-08-02 | 2026-07-25 | DATED_ECONOMIC_COMPONENTS_AND_OPERATIONS | 123 | 120 | — | EXCLUDED_FROM_MINIMAL / HUMAN_CONFIRM_REQUIRED | NO | NO | 2025-08-02 | 2026-07-25 | HUMAN_CONFIRM_REQUIRED (2025-08-02) | UNKNOWN | Les composants/opérations datés prouvent l’existence économique à ces dates, pas l’existence ni l’éligibilité historique de la règle. La famille est une proposition à confirmer. | MEDIUM | YES | Confirmez-vous que la règle Tabac & vape appartenait à EXCLUDED_FROM_MINIMAL à partir du 2025-08-02, ou indiquez une autre date / UNKNOWN ? | NO | Aucune version datée de la règle ne prouve effectiveFrom/effectiveTo ni la famille Master historique. | BLOCKS_MINIMAL_HISTORY |
| 10423aa1-3db0-5c7c-a062-1ae31d0e6f58 | 89ee6573-6228-5804-913e-18d428e5b48e | — | — | Eligible | minimal_baseline_v1 | — | — | 2026-08-20 | 2025-08-07 | 2026-07-27 | DATED_ECONOMIC_COMPONENTS_AND_OPERATIONS | 48 | 48 | 4010830d-bcf3-557c-af7f-8ac186ab2d0f, 5f1707aa-60f0-5ed6-86e7-ac67bbae2aef, d95e85e2-a2ab-5cd5-a8f1-64ba3ee56ed0, e57d31b3-4dcb-5bc9-a52b-686f296bebac | FIXED_REQUIRED / HUMAN_CONFIRM_REQUIRED | NO | NO | 2025-08-07 | 2026-07-27 | HUMAN_CONFIRM_REQUIRED (2025-08-07) | UNKNOWN | Les composants/opérations datés prouvent l’existence économique à ces dates, pas l’existence ni l’éligibilité historique de la règle. La famille est une proposition à confirmer. | MEDIUM | YES | Confirmez-vous que la règle Télécom appartenait à FIXED_REQUIRED à partir du 2025-08-07, ou indiquez une autre date / UNKNOWN ? | NO | Aucune version datée de la règle ne prouve effectiveFrom/effectiveTo ni la famille Master historique. | BLOCKS_MINIMAL_HISTORY |
| 72d987ff-ba0c-54b8-94df-55e26c7a37ee | 763feacd-7d5f-5a67-a658-6ded0399890d | — | — | Excluded | minimal_baseline_v1 | — | — | 2026-08-20 | — | — | NONE | 0 | 0 | — | UNKNOWN / CANNOT_MAP_SAFELY | NO | NO | — | — | UNKNOWN | UNKNOWN | Aucun composant historique de la fenêtre n’est rattaché à cette règle; aucune date ni famille historique ne peut être reconstruite. | NONE | NO | — | NO | Aucune preuve historique liée; garder UNKNOWN ne change aucun calcul observé des 12 mois. | MUST_REMAIN_UNKNOWN |
| 934afb8d-b29d-5735-977d-2578045db244 | be543fce-46ed-5de2-99a1-fe6b9031bad9 | 6cc50f88-4a9c-5f10-a56b-3643f3bcbab0 | — | Conditional | minimal_baseline_v1 | — | — | 2026-08-20 | 2025-08-03 | 2026-07-25 | DATED_ECONOMIC_COMPONENTS_AND_OPERATIONS | 26 | 26 | — | VARIABLE_ESSENTIAL / HUMAN_CONFIRM_REQUIRED | NO | NO | 2025-08-03 | 2026-07-25 | HUMAN_CONFIRM_REQUIRED (2025-08-03) | UNKNOWN | Les composants/opérations datés prouvent l’existence économique à ces dates, pas l’existence ni l’éligibilité historique de la règle. La famille est une proposition à confirmer. | MEDIUM | YES | Confirmez-vous que la règle Transport & voiture / Carburant appartenait à VARIABLE_ESSENTIAL à partir du 2025-08-03, ou indiquez une autre date / UNKNOWN ? | NO | Aucune version datée de la règle ne prouve effectiveFrom/effectiveTo ni la famille Master historique. | BLOCKS_MINIMAL_HISTORY |
| 6a17a628-0782-5c4b-b888-d252cafc73b8 | be543fce-46ed-5de2-99a1-fe6b9031bad9 | — | — | Excluded | minimal_baseline_v1 | — | — | 2026-08-20 | 2025-08-03 | 2026-07-29 | DATED_ECONOMIC_COMPONENTS_AND_OPERATIONS | 78 | 78 | 102a50ab-1233-508a-a4f8-1743ce5dd887, e61a4b56-85e2-5d71-96fe-579d1bba0cff | EXCLUDED_FROM_MINIMAL / HUMAN_CONFIRM_REQUIRED | NO | NO | 2025-08-03 | 2026-07-29 | HUMAN_CONFIRM_REQUIRED (2025-08-03) | UNKNOWN | Les composants/opérations datés prouvent l’existence économique à ces dates, pas l’existence ni l’éligibilité historique de la règle. La famille est une proposition à confirmer. | MEDIUM | YES | Confirmez-vous que la règle Transport & voiture appartenait à EXCLUDED_FROM_MINIMAL à partir du 2025-08-03, ou indiquez une autre date / UNKNOWN ? | NO | Aucune version datée de la règle ne prouve effectiveFrom/effectiveTo ni la famille Master historique. | BLOCKS_MINIMAL_HISTORY |
| 89e5af5e-9094-5c28-a9e7-1de9a69116c9 | 60f2e6b6-dd4a-5220-9c6b-d8c52df703a5 | — | — | Excluded | minimal_baseline_v1 | — | — | 2026-08-20 | 2025-09-07 | 2026-03-31 | DATED_ECONOMIC_COMPONENTS_AND_OPERATIONS | 5 | 5 | — | EXCLUDED_FROM_MINIMAL / HUMAN_CONFIRM_REQUIRED | NO | NO | 2025-09-07 | 2026-03-31 | HUMAN_CONFIRM_REQUIRED (2025-09-07) | UNKNOWN | Les composants/opérations datés prouvent l’existence économique à ces dates, pas l’existence ni l’éligibilité historique de la règle. La famille est une proposition à confirmer. | MEDIUM | YES | Confirmez-vous que la règle Voyages appartenait à EXCLUDED_FROM_MINIMAL à partir du 2025-09-07, ou indiquez une autre date / UNKNOWN ? | NO | Aucune version datée de la règle ne prouve effectiveFrom/effectiveTo ni la famille Master historique. | BLOCKS_MINIMAL_HISTORY |

## 4. Matrice exhaustive — 35 récurrences

`observedAmounts` contient seulement cardinalité et digest ; aucune valeur bancaire privée.

| recurrenceSeriesId | humanLabel | currentActifPrevision | currentCadence | currentForecastMode | linkedOperationsCount | firstObservedOccurrence | lastObservedOccurrence | observedMonths | observedAmounts | robustCadencePossible | expectedOccurrencesPerYearPossible | typicalOccurrenceCostPossible | contractAuthorityAvailable | explicitFutureAmountAvailable | historicalActiveStateProvable | historicalEndedStateProvable | historicalInterruptedStateProvable | historicalRestartedStateProvable | earliestProvableActiveDate | latestProvableObservedDate | suggestedHistoricalState | suggestedValidFrom | suggestedValidTo | proposalBasis | proposalConfidence | humanValidationRequired | humanQuestion | safeAutomaticBackfill | unresolvedReason | status |
| - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| 257bc01f-425b-50a9-847a-ca3600a0f80e | Assurances · série 257bc01f | YES | Mensuelle | Échéance fixe | 6 | 2026-02-19 | 2026-07-20 | 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07 | REDACTED; n=6; digest=38ddd8e1e2eb45b3316c20fb655d4d1c | YES | YES | YES | NO | NO | NO | NO | NO | NO | — | 2026-07-20 | HUMAN_CONFIRM_REQUIRED | HUMAN_CONFIRM_REQUIRED (2026-02-19) | UNKNOWN | Les 6 occurrences datées prouvent uniquement des observations de 2026-02-19 à 2026-07-20. Cadence/coût typique peuvent être recalculés à M sous le support no-lookahead. La série touche une règle actuellement non exclue et son état historique doit être confirmé. | HIGH_FOR_OBSERVATIONS_ONLY | YES | Confirmez-vous que Assurances · série 257bc01f constituait une obligation/récurrence Minimal effective à partir du 2026-02-19, ou indiquez NO / une autre date / UNKNOWN ? | OBSERVED_EVIDENCE_ONLY | Les occurrences ne prouvent ni début contractuel, ni fin, interruption ou reprise; ces états restent UNKNOWN sans déclaration datée. | BLOCKS_MINIMAL_HISTORY |
| 62961690-4690-51a8-867d-abee35294e2d | Assurances · série 62961690 | YES | Mensuelle | Échéance fixe | 12 | 2025-08-10 | 2026-07-09 | 2025-08, 2025-09, 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07 | REDACTED; n=12; digest=7bc1e4a00048abcfaa062b6c93e1fef0 | YES | YES | YES | NO | NO | NO | NO | NO | NO | — | 2026-07-09 | HUMAN_CONFIRM_REQUIRED | HUMAN_CONFIRM_REQUIRED (2025-08-10) | UNKNOWN | Les 12 occurrences datées prouvent uniquement des observations de 2025-08-10 à 2026-07-09. Cadence/coût typique peuvent être recalculés à M sous le support no-lookahead. La série touche une règle actuellement non exclue et son état historique doit être confirmé. | HIGH_FOR_OBSERVATIONS_ONLY | YES | Confirmez-vous que Assurances · série 62961690 constituait une obligation/récurrence Minimal effective à partir du 2025-08-10, ou indiquez NO / une autre date / UNKNOWN ? | OBSERVED_EVIDENCE_ONLY | Les occurrences ne prouvent ni début contractuel, ni fin, interruption ou reprise; ces états restent UNKNOWN sans déclaration datée. | BLOCKS_MINIMAL_HISTORY |
| 9b4c64f5-29e0-5d33-8ae4-194007e36eeb | Assurances · série 9b4c64f5 | NO | Mensuelle | Échéance fixe | 6 | 2025-08-20 | 2026-01-20 | 2025-08, 2025-09, 2025-10, 2025-11, 2025-12, 2026-01 | REDACTED; n=6; digest=365ad4385281e52d9d658ebd03ed81f3 | YES | YES | YES | NO | NO | NO | NO | NO | NO | — | 2026-01-20 | HUMAN_CONFIRM_REQUIRED | HUMAN_CONFIRM_REQUIRED (2025-08-20) | UNKNOWN | Les 6 occurrences datées prouvent uniquement des observations de 2025-08-20 à 2026-01-20. Cadence/coût typique peuvent être recalculés à M sous le support no-lookahead. La série touche une règle actuellement non exclue et son état historique doit être confirmé. | HIGH_FOR_OBSERVATIONS_ONLY | YES | Confirmez-vous que Assurances · série 9b4c64f5 constituait une obligation/récurrence Minimal effective à partir du 2025-08-20, ou indiquez NO / une autre date / UNKNOWN ? | OBSERVED_EVIDENCE_ONLY | Les occurrences ne prouvent ni début contractuel, ni fin, interruption ou reprise; ces états restent UNKNOWN sans déclaration datée. | BLOCKS_MINIMAL_HISTORY |
| d1235129-9c4a-5673-961e-1c0e2b80cad8 | Assurances · série d1235129 | YES | Mensuelle | Échéance fixe | 12 | 2025-08-04 | 2026-07-06 | 2025-08, 2025-09, 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07 | REDACTED; n=12; digest=a5111ba3e15ab0f66e01339d8d78099a | YES | YES | YES | NO | NO | NO | NO | NO | NO | — | 2026-07-06 | HUMAN_CONFIRM_REQUIRED | HUMAN_CONFIRM_REQUIRED (2025-08-04) | UNKNOWN | Les 12 occurrences datées prouvent uniquement des observations de 2025-08-04 à 2026-07-06. Cadence/coût typique peuvent être recalculés à M sous le support no-lookahead. La série touche une règle actuellement non exclue et son état historique doit être confirmé. | HIGH_FOR_OBSERVATIONS_ONLY | YES | Confirmez-vous que Assurances · série d1235129 constituait une obligation/récurrence Minimal effective à partir du 2025-08-04, ou indiquez NO / une autre date / UNKNOWN ? | OBSERVED_EVIDENCE_ONLY | Les occurrences ne prouvent ni début contractuel, ni fin, interruption ou reprise; ces états restent UNKNOWN sans déclaration datée. | BLOCKS_MINIMAL_HISTORY |
| d7a6e623-87c0-5f7a-905f-93ff5abc5b60 | Assurances · série d7a6e623 | NO | Mensuelle | Échéance fixe | 1 | 2026-02-19 | 2026-02-19 | 2026-02 | REDACTED; n=1; digest=94682ff72ba226923d93264446f34017 | NO | NO | NO | NO | NO | NO | NO | NO | NO | — | 2026-02-19 | HUMAN_CONFIRM_REQUIRED | HUMAN_CONFIRM_REQUIRED (2026-02-19) | UNKNOWN | Les 1 occurrences datées prouvent uniquement des observations de 2026-02-19 à 2026-02-19. Support insuffisant pour une cadence robuste globale. La série touche une règle actuellement non exclue et son état historique doit être confirmé. | LIMITED_FOR_OBSERVATIONS_ONLY | YES | Confirmez-vous que Assurances · série d7a6e623 constituait une obligation/récurrence Minimal effective à partir du 2026-02-19, ou indiquez NO / une autre date / UNKNOWN ? | OBSERVED_EVIDENCE_ONLY | Les occurrences ne prouvent ni début contractuel, ni fin, interruption ou reprise; ces états restent UNKNOWN sans déclaration datée. | BLOCKS_MINIMAL_HISTORY |
| d7f56f4f-baeb-5659-a89d-0d225c090441 | Assurances · série d7f56f4f | YES | Mensuelle | Échéance fixe | 12 | 2025-08-04 | 2026-07-06 | 2025-08, 2025-09, 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07 | REDACTED; n=12; digest=e8af87a48fcb2f6d61d9fbcab1570b41 | YES | YES | YES | NO | NO | NO | NO | NO | NO | — | 2026-07-06 | HUMAN_CONFIRM_REQUIRED | HUMAN_CONFIRM_REQUIRED (2025-08-04) | UNKNOWN | Les 12 occurrences datées prouvent uniquement des observations de 2025-08-04 à 2026-07-06. Cadence/coût typique peuvent être recalculés à M sous le support no-lookahead. La série touche une règle actuellement non exclue et son état historique doit être confirmé. | HIGH_FOR_OBSERVATIONS_ONLY | YES | Confirmez-vous que Assurances · série d7f56f4f constituait une obligation/récurrence Minimal effective à partir du 2025-08-04, ou indiquez NO / une autre date / UNKNOWN ? | OBSERVED_EVIDENCE_ONLY | Les occurrences ne prouvent ni début contractuel, ni fin, interruption ou reprise; ces états restent UNKNOWN sans déclaration datée. | BLOCKS_MINIMAL_HISTORY |
| 16f9e5e2-28e8-59e6-8f59-55c25f1564a9 | Banque · série 16f9e5e2 | YES | Mensuelle | Échéance fixe | 4 | 2026-04-15 | 2026-07-17 | 2026-04, 2026-05, 2026-06, 2026-07 | REDACTED; n=4; digest=de3eaa79cbd9bf2c277fa67c2b80c25d | YES | YES | YES | NO | NO | NO | NO | NO | NO | — | 2026-07-17 | HUMAN_CONFIRM_REQUIRED | HUMAN_CONFIRM_REQUIRED (2026-04-15) | UNKNOWN | Les 4 occurrences datées prouvent uniquement des observations de 2026-04-15 à 2026-07-17. Cadence/coût typique peuvent être recalculés à M sous le support no-lookahead. La série touche une règle actuellement non exclue et son état historique doit être confirmé. | HIGH_FOR_OBSERVATIONS_ONLY | YES | Confirmez-vous que Banque · série 16f9e5e2 constituait une obligation/récurrence Minimal effective à partir du 2026-04-15, ou indiquez NO / une autre date / UNKNOWN ? | OBSERVED_EVIDENCE_ONLY | Les occurrences ne prouvent ni début contractuel, ni fin, interruption ou reprise; ces états restent UNKNOWN sans déclaration datée. | BLOCKS_MINIMAL_HISTORY |
| 28e03eb9-2b04-5eac-a7b9-2c36ab4e1b90 | Banque · série 28e03eb9 | YES | Mensuelle | Échéance fixe | 3 | 2026-05-07 | 2026-07-07 | 2026-05, 2026-06, 2026-07 | REDACTED; n=3; digest=fda3b3585bd989faef45dc62f5479469 | YES | YES | YES | NO | NO | NO | NO | NO | NO | — | 2026-07-07 | OBSERVED_ONLY | UNKNOWN | UNKNOWN | Les 3 occurrences datées prouvent uniquement des observations de 2026-05-07 à 2026-07-07. Cadence/coût typique peuvent être recalculés à M sous le support no-lookahead. Elle ne touche pas le Minimal actuel; seul le registre d’observations est automatiquement backfillable. | HIGH_FOR_OBSERVATIONS_ONLY | NO | — | OBSERVED_EVIDENCE_ONLY | Les occurrences ne prouvent ni début contractuel, ni fin, interruption ou reprise; ces états restent UNKNOWN sans déclaration datée. | AUTO_PROVABLE |
| 5b641a6b-b66d-5217-872a-29803f2552eb | Banque · série 5b641a6b | NO | Mensuelle | Échéance fixe | 9 | 2025-08-08 | 2026-04-08 | 2025-08, 2025-09, 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04 | REDACTED; n=9; digest=5acc9c381a1299ea1cc678a760261596 | YES | YES | YES | NO | NO | NO | NO | NO | NO | — | 2026-04-08 | HUMAN_CONFIRM_REQUIRED | HUMAN_CONFIRM_REQUIRED (2025-08-08) | UNKNOWN | Les 9 occurrences datées prouvent uniquement des observations de 2025-08-08 à 2026-04-08. Cadence/coût typique peuvent être recalculés à M sous le support no-lookahead. La série touche une règle actuellement non exclue et son état historique doit être confirmé. | HIGH_FOR_OBSERVATIONS_ONLY | YES | Confirmez-vous que Banque · série 5b641a6b constituait une obligation/récurrence Minimal effective à partir du 2025-08-08, ou indiquez NO / une autre date / UNKNOWN ? | OBSERVED_EVIDENCE_ONLY | Les occurrences ne prouvent ni début contractuel, ni fin, interruption ou reprise; ces états restent UNKNOWN sans déclaration datée. | BLOCKS_MINIMAL_HISTORY |
| 85178ac7-ac64-554a-abd7-42c7c154304f | Banque · série 85178ac7 | YES | Mensuelle | Échéance fixe | 13 | 2025-08-20 | 2026-07-21 | 2025-08, 2025-09, 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07 | REDACTED; n=13; digest=31453701ddae9745e98d7ceb6de31bc2 | YES | YES | YES | NO | NO | NO | NO | NO | NO | — | 2026-07-21 | HUMAN_CONFIRM_REQUIRED | HUMAN_CONFIRM_REQUIRED (2025-08-20) | UNKNOWN | Les 13 occurrences datées prouvent uniquement des observations de 2025-08-20 à 2026-07-21. Cadence/coût typique peuvent être recalculés à M sous le support no-lookahead. La série touche une règle actuellement non exclue et son état historique doit être confirmé. | HIGH_FOR_OBSERVATIONS_ONLY | YES | Confirmez-vous que Banque · série 85178ac7 constituait une obligation/récurrence Minimal effective à partir du 2025-08-20, ou indiquez NO / une autre date / UNKNOWN ? | OBSERVED_EVIDENCE_ONLY | Les occurrences ne prouvent ni début contractuel, ni fin, interruption ou reprise; ces états restent UNKNOWN sans déclaration datée. | BLOCKS_MINIMAL_HISTORY |
| ce56d613-7420-5608-b076-5c464ed5a3e5 | Crédits & dettes · série ce56d613 | NO | Mensuelle | Échéancier | 3 | 2025-12-02 | 2026-02-02 | 2025-12, 2026-01, 2026-02 | REDACTED; n=0; digest=85a57d9c33283d4a015e1051db2e9e23 | YES | YES | NO | NO | NO | NO | NO | NO | NO | — | 2026-02-02 | OBSERVED_ONLY | UNKNOWN | UNKNOWN | Les 3 occurrences datées prouvent uniquement des observations de 2025-12-02 à 2026-02-02. Cadence/coût typique peuvent être recalculés à M sous le support no-lookahead. Elle ne touche pas le Minimal actuel; seul le registre d’observations est automatiquement backfillable. | HIGH_FOR_OBSERVATIONS_ONLY | NO | — | OBSERVED_EVIDENCE_ONLY | Les occurrences ne prouvent ni début contractuel, ni fin, interruption ou reprise; ces états restent UNKNOWN sans déclaration datée. | AUTO_PROVABLE |
| 0716e2b2-7227-5358-b80c-9e054d0b9cbf | Logement · série 0716e2b2 | YES | Mensuelle | Échéance fixe | 12 | 2025-08-04 | 2026-07-06 | 2025-08, 2025-09, 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07 | REDACTED; n=12; digest=0788b97c836e35710c3a996231865ab3 | YES | YES | YES | NO | NO | NO | NO | NO | NO | — | 2026-07-06 | HUMAN_CONFIRM_REQUIRED | HUMAN_CONFIRM_REQUIRED (2025-08-04) | UNKNOWN | Les 12 occurrences datées prouvent uniquement des observations de 2025-08-04 à 2026-07-06. Cadence/coût typique peuvent être recalculés à M sous le support no-lookahead. La série touche une règle actuellement non exclue et son état historique doit être confirmé. | HIGH_FOR_OBSERVATIONS_ONLY | YES | Confirmez-vous que Logement · série 0716e2b2 constituait une obligation/récurrence Minimal effective à partir du 2025-08-04, ou indiquez NO / une autre date / UNKNOWN ? | OBSERVED_EVIDENCE_ONLY | Les occurrences ne prouvent ni début contractuel, ni fin, interruption ou reprise; ces états restent UNKNOWN sans déclaration datée. | BLOCKS_MINIMAL_HISTORY |
| 5079d3ae-7839-58c5-b0f8-4fcb1aabbada | Logement · série 5079d3ae | YES | Mensuelle | Échéance fixe | 11 | 2025-08-11 | 2026-07-10 | 2025-08, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07 | REDACTED; n=11; digest=ece64867cac4c3bd259b6fe1b985f80a | YES | YES | YES | NO | NO | NO | NO | NO | NO | — | 2026-07-10 | HUMAN_CONFIRM_REQUIRED | HUMAN_CONFIRM_REQUIRED (2025-08-11) | UNKNOWN | Les 11 occurrences datées prouvent uniquement des observations de 2025-08-11 à 2026-07-10. Cadence/coût typique peuvent être recalculés à M sous le support no-lookahead. La série touche une règle actuellement non exclue et son état historique doit être confirmé. | HIGH_FOR_OBSERVATIONS_ONLY | YES | Confirmez-vous que Logement · série 5079d3ae constituait une obligation/récurrence Minimal effective à partir du 2025-08-11, ou indiquez NO / une autre date / UNKNOWN ? | OBSERVED_EVIDENCE_ONLY | Les occurrences ne prouvent ni début contractuel, ni fin, interruption ou reprise; ces états restent UNKNOWN sans déclaration datée. | BLOCKS_MINIMAL_HISTORY |
| 5b4640d7-aab4-5d53-8ceb-2126584c3448 | Logement · série 5b4640d7 | YES | Mensuelle | Échéance fixe | 12 | 2025-08-10 | 2026-07-01 | 2025-08, 2025-09, 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07 | REDACTED; n=12; digest=6793a287847b9377f578983e2ed5e0a1 | YES | YES | YES | NO | NO | NO | NO | NO | NO | — | 2026-07-01 | HUMAN_CONFIRM_REQUIRED | HUMAN_CONFIRM_REQUIRED (2025-08-10) | UNKNOWN | Les 12 occurrences datées prouvent uniquement des observations de 2025-08-10 à 2026-07-01. Cadence/coût typique peuvent être recalculés à M sous le support no-lookahead. La série touche une règle actuellement non exclue et son état historique doit être confirmé. | HIGH_FOR_OBSERVATIONS_ONLY | YES | Confirmez-vous que Logement · série 5b4640d7 constituait une obligation/récurrence Minimal effective à partir du 2025-08-10, ou indiquez NO / une autre date / UNKNOWN ? | OBSERVED_EVIDENCE_ONLY | Les occurrences ne prouvent ni début contractuel, ni fin, interruption ou reprise; ces états restent UNKNOWN sans déclaration datée. | BLOCKS_MINIMAL_HISTORY |
| 24c0cb89-34bf-5e2a-881d-4d4f9f7b694a | Numérique · série 24c0cb89 | YES | Mensuelle | Échéance fixe | 9 | 2025-11-15 | 2026-07-04 | 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07 | REDACTED; n=9; digest=12f4d6b285f3030a19eedf3d1359b97f | YES | YES | YES | NO | NO | NO | NO | NO | NO | — | 2026-07-04 | OBSERVED_ONLY | UNKNOWN | UNKNOWN | Les 9 occurrences datées prouvent uniquement des observations de 2025-11-15 à 2026-07-04. Cadence/coût typique peuvent être recalculés à M sous le support no-lookahead. Elle ne touche pas le Minimal actuel; seul le registre d’observations est automatiquement backfillable. | HIGH_FOR_OBSERVATIONS_ONLY | NO | — | OBSERVED_EVIDENCE_ONLY | Les occurrences ne prouvent ni début contractuel, ni fin, interruption ou reprise; ces états restent UNKNOWN sans déclaration datée. | AUTO_PROVABLE |
| 24cefd44-463b-59fa-b232-376b5404461c | Numérique · série 24cefd44 | NO | Mensuelle | Échéance fixe | 2 | 2026-03-15 | 2026-04-15 | 2026-03, 2026-04 | REDACTED; n=2; digest=03f7b82e72d5222284b55065114d1e59 | NO | NO | NO | NO | NO | NO | NO | NO | NO | — | 2026-04-15 | OBSERVED_ONLY | UNKNOWN | UNKNOWN | Les 2 occurrences datées prouvent uniquement des observations de 2026-03-15 à 2026-04-15. Support insuffisant pour une cadence robuste globale. Elle ne touche pas le Minimal actuel; seul le registre d’observations est automatiquement backfillable. | LIMITED_FOR_OBSERVATIONS_ONLY | NO | — | OBSERVED_EVIDENCE_ONLY | Les occurrences ne prouvent ni début contractuel, ni fin, interruption ou reprise; ces états restent UNKNOWN sans déclaration datée. | AUTO_PROVABLE |
| 30287970-b389-5b99-ab29-9211a60ca7d5 | Numérique · série 30287970 | NO | Mensuelle | Échéance fixe | 6 | 2025-12-20 | 2026-05-20 | 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05 | REDACTED; n=6; digest=1b874ddde68a8405673909481982c06c | YES | YES | YES | NO | NO | NO | NO | NO | NO | — | 2026-05-20 | OBSERVED_ONLY | UNKNOWN | UNKNOWN | Les 6 occurrences datées prouvent uniquement des observations de 2025-12-20 à 2026-05-20. Cadence/coût typique peuvent être recalculés à M sous le support no-lookahead. Elle ne touche pas le Minimal actuel; seul le registre d’observations est automatiquement backfillable. | HIGH_FOR_OBSERVATIONS_ONLY | NO | — | OBSERVED_EVIDENCE_ONLY | Les occurrences ne prouvent ni début contractuel, ni fin, interruption ou reprise; ces états restent UNKNOWN sans déclaration datée. | AUTO_PROVABLE |
| 3b3f3083-f139-5c1b-927b-6ae638cbe28e | Numérique · série 3b3f3083 | NO | Mensuelle | Échéance fixe | 1 | 2026-05-03 | 2026-05-03 | 2026-05 | REDACTED; n=1; digest=d5222cca2a33eb73477989d0b3d063bc | NO | NO | NO | NO | NO | NO | NO | NO | NO | — | 2026-05-03 | OBSERVED_ONLY | UNKNOWN | UNKNOWN | Les 1 occurrences datées prouvent uniquement des observations de 2026-05-03 à 2026-05-03. Support insuffisant pour une cadence robuste globale. Elle ne touche pas le Minimal actuel; seul le registre d’observations est automatiquement backfillable. | LIMITED_FOR_OBSERVATIONS_ONLY | NO | — | OBSERVED_EVIDENCE_ONLY | Les occurrences ne prouvent ni début contractuel, ni fin, interruption ou reprise; ces états restent UNKNOWN sans déclaration datée. | AUTO_PROVABLE |
| 67657950-b736-5f73-89bc-456d207b965c | Numérique · série 67657950 | YES | Mensuelle | Échéance fixe | 2 | 2026-06-05 | 2026-07-06 | 2026-06, 2026-07 | REDACTED; n=2; digest=d9d15efb01d571d6e7f3f9e2baa1cc3e | NO | NO | NO | NO | NO | NO | NO | NO | NO | — | 2026-07-06 | OBSERVED_ONLY | UNKNOWN | UNKNOWN | Les 2 occurrences datées prouvent uniquement des observations de 2026-06-05 à 2026-07-06. Support insuffisant pour une cadence robuste globale. Elle ne touche pas le Minimal actuel; seul le registre d’observations est automatiquement backfillable. | LIMITED_FOR_OBSERVATIONS_ONLY | NO | — | OBSERVED_EVIDENCE_ONLY | Les occurrences ne prouvent ni début contractuel, ni fin, interruption ou reprise; ces états restent UNKNOWN sans déclaration datée. | AUTO_PROVABLE |
| 6ceae158-ebba-5208-9d41-85eac3bd4dde | Numérique · série 6ceae158 | NO | Mensuelle | Échéance fixe | 4 | 2025-08-04 | 2025-10-27 | 2025-08, 2025-09, 2025-10 | REDACTED; n=4; digest=4962a4931ff60614a24457581ffb12cd | YES | YES | YES | NO | NO | NO | NO | NO | NO | — | 2025-10-27 | OBSERVED_ONLY | UNKNOWN | UNKNOWN | Les 4 occurrences datées prouvent uniquement des observations de 2025-08-04 à 2025-10-27. Cadence/coût typique peuvent être recalculés à M sous le support no-lookahead. Elle ne touche pas le Minimal actuel; seul le registre d’observations est automatiquement backfillable. | HIGH_FOR_OBSERVATIONS_ONLY | NO | — | OBSERVED_EVIDENCE_ONLY | Les occurrences ne prouvent ni début contractuel, ni fin, interruption ou reprise; ces états restent UNKNOWN sans déclaration datée. | AUTO_PROVABLE |
| 82bb95c9-fb56-5f4b-ab17-be5971ecf5e5 | Numérique · série 82bb95c9 | NO | Mensuelle | Échéance fixe | 3 | 2025-09-11 | 2025-11-11 | 2025-09, 2025-10, 2025-11 | REDACTED; n=3; digest=3f872c676c71a4db4e1498f99026dc04 | YES | YES | YES | NO | NO | NO | NO | NO | NO | — | 2025-11-11 | OBSERVED_ONLY | UNKNOWN | UNKNOWN | Les 3 occurrences datées prouvent uniquement des observations de 2025-09-11 à 2025-11-11. Cadence/coût typique peuvent être recalculés à M sous le support no-lookahead. Elle ne touche pas le Minimal actuel; seul le registre d’observations est automatiquement backfillable. | HIGH_FOR_OBSERVATIONS_ONLY | NO | — | OBSERVED_EVIDENCE_ONLY | Les occurrences ne prouvent ni début contractuel, ni fin, interruption ou reprise; ces états restent UNKNOWN sans déclaration datée. | AUTO_PROVABLE |
| 91e58dd4-1a8d-536f-a841-eff33c136228 | Numérique · série 91e58dd4 | YES | Mensuelle | Échéance fixe | 11 | 2025-08-21 | 2026-07-21 | 2025-08, 2025-09, 2025-10, 2025-11, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07 | REDACTED; n=11; digest=98854796bab0fde9ca3d6797386c076b | YES | YES | YES | NO | NO | NO | NO | NO | NO | — | 2026-07-21 | OBSERVED_ONLY | UNKNOWN | UNKNOWN | Les 11 occurrences datées prouvent uniquement des observations de 2025-08-21 à 2026-07-21. Cadence/coût typique peuvent être recalculés à M sous le support no-lookahead. Elle ne touche pas le Minimal actuel; seul le registre d’observations est automatiquement backfillable. | HIGH_FOR_OBSERVATIONS_ONLY | NO | — | OBSERVED_EVIDENCE_ONLY | Les occurrences ne prouvent ni début contractuel, ni fin, interruption ou reprise; ces états restent UNKNOWN sans déclaration datée. | AUTO_PROVABLE |
| 9511cc7b-41ab-5b0d-9d0a-d73627ef1f9e | Numérique · série 9511cc7b | NO | Mensuelle | Échéance fixe | 1 | 2025-11-09 | 2025-11-09 | 2025-11 | REDACTED; n=1; digest=9c144d711d3db2fc34b43d18e374f46d | NO | NO | NO | NO | NO | NO | NO | NO | NO | — | 2025-11-09 | OBSERVED_ONLY | UNKNOWN | UNKNOWN | Les 1 occurrences datées prouvent uniquement des observations de 2025-11-09 à 2025-11-09. Support insuffisant pour une cadence robuste globale. Elle ne touche pas le Minimal actuel; seul le registre d’observations est automatiquement backfillable. | LIMITED_FOR_OBSERVATIONS_ONLY | NO | — | OBSERVED_EVIDENCE_ONLY | Les occurrences ne prouvent ni début contractuel, ni fin, interruption ou reprise; ces états restent UNKNOWN sans déclaration datée. | AUTO_PROVABLE |
| a95fcb7e-a912-5686-be33-3c629f7b6390 | Numérique · série a95fcb7e | NO | Mensuelle | Échéance fixe | 9 | 2025-08-19 | 2026-04-19 | 2025-08, 2025-09, 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04 | REDACTED; n=9; digest=807785ac4adb9567b5aae24711144a1f | YES | YES | YES | NO | NO | NO | NO | NO | NO | — | 2026-04-19 | OBSERVED_ONLY | UNKNOWN | UNKNOWN | Les 9 occurrences datées prouvent uniquement des observations de 2025-08-19 à 2026-04-19. Cadence/coût typique peuvent être recalculés à M sous le support no-lookahead. Elle ne touche pas le Minimal actuel; seul le registre d’observations est automatiquement backfillable. | HIGH_FOR_OBSERVATIONS_ONLY | NO | — | OBSERVED_EVIDENCE_ONLY | Les occurrences ne prouvent ni début contractuel, ni fin, interruption ou reprise; ces états restent UNKNOWN sans déclaration datée. | AUTO_PROVABLE |
| b1353e19-429f-5ac7-a6e7-d4df1d183b92 | Numérique · série b1353e19 | NO | Mensuelle | Échéance fixe | 1 | 2026-07-03 | 2026-07-03 | 2026-07 | REDACTED; n=1; digest=f48ed17e2d0935f0a787322d0d82eb5a | NO | NO | NO | NO | NO | NO | NO | NO | NO | — | 2026-07-03 | OBSERVED_ONLY | UNKNOWN | UNKNOWN | Les 1 occurrences datées prouvent uniquement des observations de 2026-07-03 à 2026-07-03. Support insuffisant pour une cadence robuste globale. Elle ne touche pas le Minimal actuel; seul le registre d’observations est automatiquement backfillable. | LIMITED_FOR_OBSERVATIONS_ONLY | NO | — | OBSERVED_EVIDENCE_ONLY | Les occurrences ne prouvent ni début contractuel, ni fin, interruption ou reprise; ces états restent UNKNOWN sans déclaration datée. | AUTO_PROVABLE |
| b2abae46-3378-5f09-897c-7c44eed28073 | Numérique · série b2abae46 | YES | Mensuelle | Échéance fixe | 6 | 2026-02-13 | 2026-07-13 | 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07 | REDACTED; n=6; digest=f6b60de2a942cda51c4f762c1f41a858 | YES | YES | YES | NO | NO | NO | NO | NO | NO | — | 2026-07-13 | OBSERVED_ONLY | UNKNOWN | UNKNOWN | Les 6 occurrences datées prouvent uniquement des observations de 2026-02-13 à 2026-07-13. Cadence/coût typique peuvent être recalculés à M sous le support no-lookahead. Elle ne touche pas le Minimal actuel; seul le registre d’observations est automatiquement backfillable. | HIGH_FOR_OBSERVATIONS_ONLY | NO | — | OBSERVED_EVIDENCE_ONLY | Les occurrences ne prouvent ni début contractuel, ni fin, interruption ou reprise; ces états restent UNKNOWN sans déclaration datée. | AUTO_PROVABLE |
| c7678c58-82c7-5c27-8507-0c590c2cca17 | Numérique · série c7678c58 | YES | Mensuelle | Échéance fixe | 12 | 2025-08-19 | 2026-07-19 | 2025-08, 2025-09, 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07 | REDACTED; n=12; digest=399712bed43473356f88ff992a8c2000 | YES | YES | YES | NO | NO | NO | NO | NO | NO | — | 2026-07-19 | OBSERVED_ONLY | UNKNOWN | UNKNOWN | Les 12 occurrences datées prouvent uniquement des observations de 2025-08-19 à 2026-07-19. Cadence/coût typique peuvent être recalculés à M sous le support no-lookahead. Elle ne touche pas le Minimal actuel; seul le registre d’observations est automatiquement backfillable. | HIGH_FOR_OBSERVATIONS_ONLY | NO | — | OBSERVED_EVIDENCE_ONLY | Les occurrences ne prouvent ni début contractuel, ni fin, interruption ou reprise; ces états restent UNKNOWN sans déclaration datée. | AUTO_PROVABLE |
| 652537e1-3c33-5109-bc6c-7137c7a811c1 | Permis de conduire · série 652537e1 | YES | Récurrente | Échéancier | 4 | 2026-05-07 | 2026-07-03 | 2026-05, 2026-06, 2026-07 | REDACTED; n=4; digest=a19cf6355834171634415d9e11b36bc4 | YES | YES | YES | NO | NO | NO | NO | NO | NO | — | 2026-07-03 | OBSERVED_ONLY | UNKNOWN | UNKNOWN | Les 4 occurrences datées prouvent uniquement des observations de 2026-05-07 à 2026-07-03. Cadence/coût typique peuvent être recalculés à M sous le support no-lookahead. Elle ne touche pas le Minimal actuel; seul le registre d’observations est automatiquement backfillable. | HIGH_FOR_OBSERVATIONS_ONLY | NO | — | OBSERVED_EVIDENCE_ONLY | Les occurrences ne prouvent ni début contractuel, ni fin, interruption ou reprise; ces états restent UNKNOWN sans déclaration datée. | AUTO_PROVABLE |
| 69e0d24c-e2fa-5063-ac32-f07e3543fa16 | Permis de conduire · série 69e0d24c | NO | Mensuelle | Échéance fixe | 10 | 2025-08-12 | 2026-05-15 | 2025-08, 2025-09, 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05 | REDACTED; n=10; digest=f0505ed5a84984b2cdfd65d42cb89425 | YES | YES | YES | NO | NO | NO | NO | NO | NO | — | 2026-05-15 | OBSERVED_ONLY | UNKNOWN | UNKNOWN | Les 10 occurrences datées prouvent uniquement des observations de 2025-08-12 à 2026-05-15. Cadence/coût typique peuvent être recalculés à M sous le support no-lookahead. Elle ne touche pas le Minimal actuel; seul le registre d’observations est automatiquement backfillable. | HIGH_FOR_OBSERVATIONS_ONLY | NO | — | OBSERVED_EVIDENCE_ONLY | Les occurrences ne prouvent ni début contractuel, ni fin, interruption ou reprise; ces états restent UNKNOWN sans déclaration datée. | AUTO_PROVABLE |
| 4010830d-bcf3-557c-af7f-8ac186ab2d0f | Télécom · série 4010830d | YES | Mensuelle | Échéance fixe | 12 | 2025-08-25 | 2026-07-27 | 2025-08, 2025-09, 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07 | REDACTED; n=12; digest=87d2ce2fff02ec0863c13f5c68b0606b | YES | YES | YES | NO | NO | NO | NO | NO | NO | — | 2026-07-27 | HUMAN_CONFIRM_REQUIRED | HUMAN_CONFIRM_REQUIRED (2025-08-25) | UNKNOWN | Les 12 occurrences datées prouvent uniquement des observations de 2025-08-25 à 2026-07-27. Cadence/coût typique peuvent être recalculés à M sous le support no-lookahead. La série touche une règle actuellement non exclue et son état historique doit être confirmé. | HIGH_FOR_OBSERVATIONS_ONLY | YES | Confirmez-vous que Télécom · série 4010830d constituait une obligation/récurrence Minimal effective à partir du 2025-08-25, ou indiquez NO / une autre date / UNKNOWN ? | OBSERVED_EVIDENCE_ONLY | Les occurrences ne prouvent ni début contractuel, ni fin, interruption ou reprise; ces états restent UNKNOWN sans déclaration datée. | BLOCKS_MINIMAL_HISTORY |
| 5f1707aa-60f0-5ed6-86e7-ac67bbae2aef | Télécom · série 5f1707aa | YES | Mensuelle | Échéance fixe | 12 | 2025-08-18 | 2026-07-20 | 2025-08, 2025-09, 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07 | REDACTED; n=12; digest=65bcd1637163f8307bbca68eefb8ace5 | YES | YES | YES | NO | NO | NO | NO | NO | NO | — | 2026-07-20 | HUMAN_CONFIRM_REQUIRED | HUMAN_CONFIRM_REQUIRED (2025-08-18) | UNKNOWN | Les 12 occurrences datées prouvent uniquement des observations de 2025-08-18 à 2026-07-20. Cadence/coût typique peuvent être recalculés à M sous le support no-lookahead. La série touche une règle actuellement non exclue et son état historique doit être confirmé. | HIGH_FOR_OBSERVATIONS_ONLY | YES | Confirmez-vous que Télécom · série 5f1707aa constituait une obligation/récurrence Minimal effective à partir du 2025-08-18, ou indiquez NO / une autre date / UNKNOWN ? | OBSERVED_EVIDENCE_ONLY | Les occurrences ne prouvent ni début contractuel, ni fin, interruption ou reprise; ces états restent UNKNOWN sans déclaration datée. | BLOCKS_MINIMAL_HISTORY |
| d95e85e2-a2ab-5cd5-a8f1-64ba3ee56ed0 | Télécom · série d95e85e2 | YES | Mensuelle | Échéance fixe | 12 | 2025-08-07 | 2026-07-07 | 2025-08, 2025-09, 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07 | REDACTED; n=12; digest=0d47c2e8fca63f1f15c4722adc238e14 | YES | YES | YES | NO | NO | NO | NO | NO | NO | — | 2026-07-07 | HUMAN_CONFIRM_REQUIRED | HUMAN_CONFIRM_REQUIRED (2025-08-07) | UNKNOWN | Les 12 occurrences datées prouvent uniquement des observations de 2025-08-07 à 2026-07-07. Cadence/coût typique peuvent être recalculés à M sous le support no-lookahead. La série touche une règle actuellement non exclue et son état historique doit être confirmé. | HIGH_FOR_OBSERVATIONS_ONLY | YES | Confirmez-vous que Télécom · série d95e85e2 constituait une obligation/récurrence Minimal effective à partir du 2025-08-07, ou indiquez NO / une autre date / UNKNOWN ? | OBSERVED_EVIDENCE_ONLY | Les occurrences ne prouvent ni début contractuel, ni fin, interruption ou reprise; ces états restent UNKNOWN sans déclaration datée. | BLOCKS_MINIMAL_HISTORY |
| e57d31b3-4dcb-5bc9-a52b-686f296bebac | Télécom · série e57d31b3 | YES | Mensuelle | Échéance fixe | 12 | 2025-08-18 | 2026-07-17 | 2025-08, 2025-09, 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07 | REDACTED; n=12; digest=2f5de6676c4212e7cc9689ea1f766743 | YES | YES | YES | NO | NO | NO | NO | NO | NO | — | 2026-07-17 | HUMAN_CONFIRM_REQUIRED | HUMAN_CONFIRM_REQUIRED (2025-08-18) | UNKNOWN | Les 12 occurrences datées prouvent uniquement des observations de 2025-08-18 à 2026-07-17. Cadence/coût typique peuvent être recalculés à M sous le support no-lookahead. La série touche une règle actuellement non exclue et son état historique doit être confirmé. | HIGH_FOR_OBSERVATIONS_ONLY | YES | Confirmez-vous que Télécom · série e57d31b3 constituait une obligation/récurrence Minimal effective à partir du 2025-08-18, ou indiquez NO / une autre date / UNKNOWN ? | OBSERVED_EVIDENCE_ONLY | Les occurrences ne prouvent ni début contractuel, ni fin, interruption ou reprise; ces états restent UNKNOWN sans déclaration datée. | BLOCKS_MINIMAL_HISTORY |
| 102a50ab-1233-508a-a4f8-1743ce5dd887 | Transport & voiture · série 102a50ab | NO | Mensuelle | Échéance fixe | 3 | 2025-08-11 | 2025-10-11 | 2025-08, 2025-09, 2025-10 | REDACTED; n=3; digest=987d9068bbe18d48033dc988d63ae7d4 | YES | YES | YES | NO | NO | NO | NO | NO | NO | — | 2025-10-11 | OBSERVED_ONLY | UNKNOWN | UNKNOWN | Les 3 occurrences datées prouvent uniquement des observations de 2025-08-11 à 2025-10-11. Cadence/coût typique peuvent être recalculés à M sous le support no-lookahead. Elle ne touche pas le Minimal actuel; seul le registre d’observations est automatiquement backfillable. | HIGH_FOR_OBSERVATIONS_ONLY | NO | — | OBSERVED_EVIDENCE_ONLY | Les occurrences ne prouvent ni début contractuel, ni fin, interruption ou reprise; ces états restent UNKNOWN sans déclaration datée. | AUTO_PROVABLE |
| e61a4b56-85e2-5d71-96fe-579d1bba0cff | Transport & voiture · série e61a4b56 | NO | Mensuelle | Échéance fixe | 3 | 2025-08-08 | 2025-10-08 | 2025-08, 2025-09, 2025-10 | REDACTED; n=3; digest=987d9068bbe18d48033dc988d63ae7d4 | YES | YES | YES | NO | NO | NO | NO | NO | NO | — | 2025-10-08 | OBSERVED_ONLY | UNKNOWN | UNKNOWN | Les 3 occurrences datées prouvent uniquement des observations de 2025-08-08 à 2025-10-08. Cadence/coût typique peuvent être recalculés à M sous le support no-lookahead. Elle ne touche pas le Minimal actuel; seul le registre d’observations est automatiquement backfillable. | HIGH_FOR_OBSERVATIONS_ONLY | NO | — | OBSERVED_EVIDENCE_ONLY | Les occurrences ne prouvent ni début contractuel, ni fin, interruption ou reprise; ces états restent UNKNOWN sans déclaration datée. | AUTO_PROVABLE |

## 5. Éléments automatiquement prouvables

- Identités des 40 règles et 35 séries.
- Pour 35 règles : composants/opérations datés et bornes de ces observations.
- Pour 35 séries : occurrences datées, mois, cardinalités et digest privé.
- Pour 29 séries : cadence et coût typique potentiellement calculables à M, avec observations strictement disponibles à M et support suffisant.
- Pour 19 séries sans impact Minimal actuel : backfill automatique des observations seulement.

Aucun de ces éléments ne prouve l’effectivité d’une règle ou un cycle de vie contractuel.

## 6. Éléments nécessitant validation

- 35 règles : famille Master, date d’effet, éventuelle fin.
- 16 récurrences liées à l’univers Minimal non exclu : statut et date d’effet.
- `DECLARED_MINIMUM` exige toujours une déclaration explicite.
- Toute correction rétroactive doit conserver `declaredAt`, `effectiveFrom` et `validationRef` séparés.

## 7. Éléments devant rester UNKNOWN

- Les 5 règles sans composant associé sur la fenêtre.
- Début contractuel, fin, interruption et reprise des 35 séries sans déclaration datée.
- Absence d’occurrence, famille non confirmée et montant futur non autoritaire.
- Les anciennes colonnes courantes ne sont pas projetées rétroactivement.

## 8. Modèle historique recommandé

```
RECOMMENDED_HISTORICAL_AUTHORITY_MODEL =
BITEMPORAL_TYPED_RULE_AND_RECURRENCE_AUTHORITY_V1
```

Modèle physique minimal à implémenter dans une mission distincte :

1. `minimal_baseline_rules` reste le registre d’identité. `minimal_baseline_rule_versions` devient l’unique autorité temporelle : `rule_version_id`, `baseline_rule_id`, famille Master, décision, `effective_from`, `effective_to`, `declared_at`, `source_revision`, `authority_type`, `declared_by_ref`, `validation_ref`, `method_version`, `evidence_refs`, `supersedes_version_id`.
2. `recurrence_series` reste le registre d’identité. `recurrence_state_history` devient l’unique autorité temporelle des états et porte les mêmes dimensions bitemporelles/provenance. Cadence ou montant futur n’y entrent qu’avec autorité explicite.
3. Les occurrences restent dans leurs sources Canonical datées ; elles ne deviennent pas des déclarations de cycle de vie.
4. Le nouveau repository historique lit seulement les versions effectives à M. Le legacy reste lisible mais n’est pas l’autorité de la nouvelle méthode.
5. Une correction ajoute une version et une sourceRevision ; aucune publication ancienne n’est mutée.
6. Intervalles `[effective_from,effective_to)` et exclusion des chevauchements contradictoires à même priorité.

Il n’y a pas de double autorité : registre d’identité, observations et déclarations versionnées ont chacun un rôle distinct.

## 9. Forme exacte du futur backfill

Observations automatiques :

```yaml
authorityType: OBSERVED_ECONOMIC_EVIDENCE
declaredAt: horodatage réel du backfill
effectiveFrom: date économique observée
effectiveTo: null
sourceRevision: nouvelle révision
methodVersion: recurrence_observation_evidence@v1
evidenceRefs: [canonical identity, date source, private digest]
```

Déclarations humaines, uniquement après réponse explicite :

```yaml
authorityType: RETROSPECTIVE_DECLARATION
declaredAt: horodatage réel de validation en 2026
effectiveFrom: date approuvée
effectiveTo: date approuvée ou null
sourceRevision: nouvelle révision
declaredByRef: opérateur côté serveur
validationRef: HV-nnn
methodVersion: minimal_historical_authority@v1
evidenceRefs: [décision signée, bornes observées]
```

Ne jamais antidater `declaredAt`, transformer `created_at` en `effectiveFrom`, déduire une fin d’un silence ou utiliser un snapshot comme source.

Après validation, pour chaque mois M :

1. charger les règles effectives à M ;
2. charger l’état récurrence connu/effectif à M ;
3. charger les observations variables strictement antérieures à M ;
4. appliquer Q25 sur au plus 12 mois, minimum 6 ;
5. calculer `PERIODIC_REQUIRED` via `StructuralMonthlyEquivalent` ;
6. appliquer `DECLARED_MINIMUM` seulement avec autorité explicite ;
7. appliquer zéro à `EXCLUDED_FROM_MINIMAL` seulement par règle effective ;
8. préserver `UNKNOWN` ;
9. refuser tout input postérieur à M ;
10. produire lineage, sourceRevision, methodVersion, closure et hashes.

## 10. Tests anti-lookahead futurs

- Récurrence effective en juin 2026 : `MinimalState(2026-05)` inchangé.
- Règle effective en avril 2026 : `MinimalState(2026-03)` inchangé.
- Version `declaredAt > M`, `effectiveFrom < M`, approuvée : nouvelle revision, recalcul explicite, ancienne publication immuable.
- Dernière occurrence en février sans fin : état différent de `ENDED`.
- Trou temporaire : différent de `INTERRUPTED`.
- Nouvelle occurrence après trou : différent de `RESTARTED`.
- Changement de `actif_prevision` courant : aucun ancien mois ne change avec autorité versionnée.
- Observation ajoutée après M : Q25/support/cadence/coût typique de M inchangés.
- Permutation technique : résultat et hashes identiques.
- Versions contradictoires sur une période : échec fermé.
- Règle inconnue : `UNKNOWN`.
- Source compare-only/snapshot injectée comme input : rejet.
- Correction rétroactive : nouvelle publication et manifest, aucune mutation.

## 11. Rollout History / Global

```
HISTORY_RECOMPUTE_SCOPE =
12 mois 2025-08→2026-07 : minimal_month_cost partagé,
history_month_balance_summary, history_minimal_preview et toute ressource
dont la dependency closure consomme Minimal directement ou transitivement.

GLOBAL_RECOMPUTE_SCOPE =
Génération Global complète atomique : M1, consommateurs M2/M3/Synthèse
et toute instance déclarant Minimal dans sa closure.

OLD_MINIMAL_V1_STATUS = AUDIT_PROVENANCE_ONLY
```

Séquence : migration versionnée et sécurité ; décisions humaines hors Git ; backfill transactionnel ; sourceRevision ; génération read-only Q25 ; certification ; republication History mois par mois ; republication Global ; activation après read-back complet. Les artifacts v1 restent auditables et ne sont jamais promus.

## 12. Human Validation Pack compact

### HV-001 — Achats personnels · règle bc3a0182

- Preuve : 5 composant(s), 5 opération(s), preuves 2025-09-14 → 2026-01-20; aucune effectivité historique de règle.
- Non prouvé : date contractuelle d’origine, effectivité métier antérieure et fin éventuelle.
- Proposition : `{"masterRuleFamily":"EXCLUDED_FROM_MINIMAL","effectiveFromCandidate":"2025-09-14","effectiveTo":"UNKNOWN","authorityType":"RETROSPECTIVE_DECLARATION_IF_APPROVED"}`
- Risque : MinimalState historique inclurait/exclurait ou classifierait à tort ces composants.
- Conséquence : Création future d’une version autoritaire rétroactive, nouvelle sourceRevision et republication transitive; aucune mutation de la preuve v1.
- Question : Confirmez-vous que la règle Achats personnels appartenait à EXCLUDED_FROM_MINIMAL à partir du 2025-09-14, ou indiquez une autre date / UNKNOWN ?
- Réponse attendue : `YES | NO | FROM_DATE:<YYYY-MM-DD> | FAMILY:<MASTER_FAMILY>;FROM_DATE:<YYYY-MM-DD> | UNKNOWN`

### HV-002 — Administratif · règle 8206b62a

- Preuve : 1 composant(s), 1 opération(s), preuves 2026-01-26 → 2026-01-26; aucune effectivité historique de règle.
- Non prouvé : date contractuelle d’origine, effectivité métier antérieure et fin éventuelle.
- Proposition : `{"masterRuleFamily":"EXCLUDED_FROM_MINIMAL","effectiveFromCandidate":"2026-01-26","effectiveTo":"UNKNOWN","authorityType":"RETROSPECTIVE_DECLARATION_IF_APPROVED"}`
- Risque : MinimalState historique inclurait/exclurait ou classifierait à tort ces composants.
- Conséquence : Création future d’une version autoritaire rétroactive, nouvelle sourceRevision et republication transitive; aucune mutation de la preuve v1.
- Question : Confirmez-vous que la règle Administratif appartenait à EXCLUDED_FROM_MINIMAL à partir du 2026-01-26, ou indiquez une autre date / UNKNOWN ?
- Réponse attendue : `YES | NO | FROM_DATE:<YYYY-MM-DD> | FAMILY:<MASTER_FAMILY>;FROM_DATE:<YYYY-MM-DD> | UNKNOWN`

### HV-003 — Alimentation / Courses alimentaires · règle 109659db

- Preuve : 179 composant(s), 179 opération(s), preuves 2025-08-01 → 2026-07-29; aucune effectivité historique de règle.
- Non prouvé : date contractuelle d’origine, effectivité métier antérieure et fin éventuelle.
- Proposition : `{"masterRuleFamily":"VARIABLE_ESSENTIAL","effectiveFromCandidate":"2025-08-01","effectiveTo":"UNKNOWN","authorityType":"RETROSPECTIVE_DECLARATION_IF_APPROVED"}`
- Risque : MinimalState historique inclurait/exclurait ou classifierait à tort ces composants.
- Conséquence : Création future d’une version autoritaire rétroactive, nouvelle sourceRevision et republication transitive; aucune mutation de la preuve v1.
- Question : Confirmez-vous que la règle Alimentation / Courses alimentaires appartenait à VARIABLE_ESSENTIAL à partir du 2025-08-01, ou indiquez une autre date / UNKNOWN ?
- Réponse attendue : `YES | NO | FROM_DATE:<YYYY-MM-DD> | FAMILY:<MASTER_FAMILY>;FROM_DATE:<YYYY-MM-DD> | UNKNOWN`

### HV-004 — Alimentation / Épicerie / alimentation générale · règle 4b43c704

- Preuve : 1 composant(s), 1 opération(s), preuves 2025-11-10 → 2025-11-10; aucune effectivité historique de règle.
- Non prouvé : date contractuelle d’origine, effectivité métier antérieure et fin éventuelle.
- Proposition : `{"masterRuleFamily":"VARIABLE_ESSENTIAL","effectiveFromCandidate":"2025-11-10","effectiveTo":"UNKNOWN","authorityType":"RETROSPECTIVE_DECLARATION_IF_APPROVED"}`
- Risque : MinimalState historique inclurait/exclurait ou classifierait à tort ces composants.
- Conséquence : Création future d’une version autoritaire rétroactive, nouvelle sourceRevision et republication transitive; aucune mutation de la preuve v1.
- Question : Confirmez-vous que la règle Alimentation / Épicerie / alimentation générale appartenait à VARIABLE_ESSENTIAL à partir du 2025-11-10, ou indiquez une autre date / UNKNOWN ?
- Réponse attendue : `YES | NO | FROM_DATE:<YYYY-MM-DD> | FAMILY:<MASTER_FAMILY>;FROM_DATE:<YYYY-MM-DD> | UNKNOWN`

### HV-005 — Alimentation · règle c504c739

- Preuve : 522 composant(s), 522 opération(s), preuves 2025-08-04 → 2026-07-30; aucune effectivité historique de règle.
- Non prouvé : date contractuelle d’origine, effectivité métier antérieure et fin éventuelle.
- Proposition : `{"masterRuleFamily":"EXCLUDED_FROM_MINIMAL","effectiveFromCandidate":"2025-08-04","effectiveTo":"UNKNOWN","authorityType":"RETROSPECTIVE_DECLARATION_IF_APPROVED"}`
- Risque : MinimalState historique inclurait/exclurait ou classifierait à tort ces composants.
- Conséquence : Création future d’une version autoritaire rétroactive, nouvelle sourceRevision et republication transitive; aucune mutation de la preuve v1.
- Question : Confirmez-vous que la règle Alimentation appartenait à EXCLUDED_FROM_MINIMAL à partir du 2025-08-04, ou indiquez une autre date / UNKNOWN ?
- Réponse attendue : `YES | NO | FROM_DATE:<YYYY-MM-DD> | FAMILY:<MASTER_FAMILY>;FROM_DATE:<YYYY-MM-DD> | UNKNOWN`

### HV-006 — Animaux · règle dc9bfe46

- Preuve : 10 composant(s), 10 opération(s), preuves 2025-09-16 → 2026-07-01; aucune effectivité historique de règle.
- Non prouvé : date contractuelle d’origine, effectivité métier antérieure et fin éventuelle.
- Proposition : `{"masterRuleFamily":"EXCLUDED_FROM_MINIMAL","effectiveFromCandidate":"2025-09-16","effectiveTo":"UNKNOWN","authorityType":"RETROSPECTIVE_DECLARATION_IF_APPROVED"}`
- Risque : MinimalState historique inclurait/exclurait ou classifierait à tort ces composants.
- Conséquence : Création future d’une version autoritaire rétroactive, nouvelle sourceRevision et republication transitive; aucune mutation de la preuve v1.
- Question : Confirmez-vous que la règle Animaux appartenait à EXCLUDED_FROM_MINIMAL à partir du 2025-09-16, ou indiquez une autre date / UNKNOWN ?
- Réponse attendue : `YES | NO | FROM_DATE:<YYYY-MM-DD> | FAMILY:<MASTER_FAMILY>;FROM_DATE:<YYYY-MM-DD> | UNKNOWN`

### HV-007 — Assurances / Assurance automobile · règle 12caff0a

- Preuve : 13 composant(s), 13 opération(s), preuves 2025-08-20 → 2026-07-20; aucune effectivité historique de règle.
- Non prouvé : date contractuelle d’origine, effectivité métier antérieure et fin éventuelle.
- Proposition : `{"masterRuleFamily":"FIXED_REQUIRED","effectiveFromCandidate":"2025-08-20","effectiveTo":"UNKNOWN","authorityType":"RETROSPECTIVE_DECLARATION_IF_APPROVED"}`
- Risque : MinimalState historique inclurait/exclurait ou classifierait à tort ces composants.
- Conséquence : Création future d’une version autoritaire rétroactive, nouvelle sourceRevision et republication transitive; aucune mutation de la preuve v1.
- Question : Confirmez-vous que la règle Assurances / Assurance automobile appartenait à FIXED_REQUIRED à partir du 2025-08-20, ou indiquez une autre date / UNKNOWN ?
- Réponse attendue : `YES | NO | FROM_DATE:<YYYY-MM-DD> | FAMILY:<MASTER_FAMILY>;FROM_DATE:<YYYY-MM-DD> | UNKNOWN`

### HV-008 — Assurances / Assurance habitation · règle abfe0a6a

- Preuve : 12 composant(s), 12 opération(s), preuves 2025-08-04 → 2026-07-06; aucune effectivité historique de règle.
- Non prouvé : date contractuelle d’origine, effectivité métier antérieure et fin éventuelle.
- Proposition : `{"masterRuleFamily":"FIXED_REQUIRED","effectiveFromCandidate":"2025-08-04","effectiveTo":"UNKNOWN","authorityType":"RETROSPECTIVE_DECLARATION_IF_APPROVED"}`
- Risque : MinimalState historique inclurait/exclurait ou classifierait à tort ces composants.
- Conséquence : Création future d’une version autoritaire rétroactive, nouvelle sourceRevision et republication transitive; aucune mutation de la preuve v1.
- Question : Confirmez-vous que la règle Assurances / Assurance habitation appartenait à FIXED_REQUIRED à partir du 2025-08-04, ou indiquez une autre date / UNKNOWN ?
- Réponse attendue : `YES | NO | FROM_DATE:<YYYY-MM-DD> | FAMILY:<MASTER_FAMILY>;FROM_DATE:<YYYY-MM-DD> | UNKNOWN`

### HV-009 — Assurances / Protection juridique · règle 72be0ea2

- Preuve : 12 composant(s), 12 opération(s), preuves 2025-08-04 → 2026-07-06; aucune effectivité historique de règle.
- Non prouvé : date contractuelle d’origine, effectivité métier antérieure et fin éventuelle.
- Proposition : `{"masterRuleFamily":"FIXED_REQUIRED","effectiveFromCandidate":"2025-08-04","effectiveTo":"UNKNOWN","authorityType":"RETROSPECTIVE_DECLARATION_IF_APPROVED"}`
- Risque : MinimalState historique inclurait/exclurait ou classifierait à tort ces composants.
- Conséquence : Création future d’une version autoritaire rétroactive, nouvelle sourceRevision et republication transitive; aucune mutation de la preuve v1.
- Question : Confirmez-vous que la règle Assurances / Protection juridique appartenait à FIXED_REQUIRED à partir du 2025-08-04, ou indiquez une autre date / UNKNOWN ?
- Réponse attendue : `YES | NO | FROM_DATE:<YYYY-MM-DD> | FAMILY:<MASTER_FAMILY>;FROM_DATE:<YYYY-MM-DD> | UNKNOWN`

### HV-010 — Assurances / Responsabilité civile · règle ba1bf674

- Preuve : 12 composant(s), 12 opération(s), preuves 2025-08-10 → 2026-07-09; aucune effectivité historique de règle.
- Non prouvé : date contractuelle d’origine, effectivité métier antérieure et fin éventuelle.
- Proposition : `{"masterRuleFamily":"FIXED_REQUIRED","effectiveFromCandidate":"2025-08-10","effectiveTo":"UNKNOWN","authorityType":"RETROSPECTIVE_DECLARATION_IF_APPROVED"}`
- Risque : MinimalState historique inclurait/exclurait ou classifierait à tort ces composants.
- Conséquence : Création future d’une version autoritaire rétroactive, nouvelle sourceRevision et republication transitive; aucune mutation de la preuve v1.
- Question : Confirmez-vous que la règle Assurances / Responsabilité civile appartenait à FIXED_REQUIRED à partir du 2025-08-10, ou indiquez une autre date / UNKNOWN ?
- Réponse attendue : `YES | NO | FROM_DATE:<YYYY-MM-DD> | FAMILY:<MASTER_FAMILY>;FROM_DATE:<YYYY-MM-DD> | UNKNOWN`

### HV-011 — Banque / Cotisation Offre Essentiel · règle 1668d247

- Preuve : 22 composant(s), 22 opération(s), preuves 2025-08-08 → 2026-07-21; aucune effectivité historique de règle.
- Non prouvé : date contractuelle d’origine, effectivité métier antérieure et fin éventuelle.
- Proposition : `{"masterRuleFamily":"FIXED_REQUIRED","effectiveFromCandidate":"2025-08-08","effectiveTo":"UNKNOWN","authorityType":"RETROSPECTIVE_DECLARATION_IF_APPROVED"}`
- Risque : MinimalState historique inclurait/exclurait ou classifierait à tort ces composants.
- Conséquence : Création future d’une version autoritaire rétroactive, nouvelle sourceRevision et republication transitive; aucune mutation de la preuve v1.
- Question : Confirmez-vous que la règle Banque / Cotisation Offre Essentiel appartenait à FIXED_REQUIRED à partir du 2025-08-08, ou indiquez une autre date / UNKNOWN ?
- Réponse attendue : `YES | NO | FROM_DATE:<YYYY-MM-DD> | FAMILY:<MASTER_FAMILY>;FROM_DATE:<YYYY-MM-DD> | UNKNOWN`

### HV-012 — Banque / Tenue de compte · règle ef44cdad

- Preuve : 4 composant(s), 4 opération(s), preuves 2026-04-15 → 2026-07-17; aucune effectivité historique de règle.
- Non prouvé : date contractuelle d’origine, effectivité métier antérieure et fin éventuelle.
- Proposition : `{"masterRuleFamily":"FIXED_REQUIRED","effectiveFromCandidate":"2026-04-15","effectiveTo":"UNKNOWN","authorityType":"RETROSPECTIVE_DECLARATION_IF_APPROVED"}`
- Risque : MinimalState historique inclurait/exclurait ou classifierait à tort ces composants.
- Conséquence : Création future d’une version autoritaire rétroactive, nouvelle sourceRevision et republication transitive; aucune mutation de la preuve v1.
- Question : Confirmez-vous que la règle Banque / Tenue de compte appartenait à FIXED_REQUIRED à partir du 2026-04-15, ou indiquez une autre date / UNKNOWN ?
- Réponse attendue : `YES | NO | FROM_DATE:<YYYY-MM-DD> | FAMILY:<MASTER_FAMILY>;FROM_DATE:<YYYY-MM-DD> | UNKNOWN`

### HV-013 — Banque · règle 520d2225

- Preuve : 4 composant(s), 4 opération(s), preuves 2026-05-07 → 2026-07-07; aucune effectivité historique de règle.
- Non prouvé : date contractuelle d’origine, effectivité métier antérieure et fin éventuelle.
- Proposition : `{"masterRuleFamily":"EXCLUDED_FROM_MINIMAL","effectiveFromCandidate":"2026-05-07","effectiveTo":"UNKNOWN","authorityType":"RETROSPECTIVE_DECLARATION_IF_APPROVED"}`
- Risque : MinimalState historique inclurait/exclurait ou classifierait à tort ces composants.
- Conséquence : Création future d’une version autoritaire rétroactive, nouvelle sourceRevision et republication transitive; aucune mutation de la preuve v1.
- Question : Confirmez-vous que la règle Banque appartenait à EXCLUDED_FROM_MINIMAL à partir du 2026-05-07, ou indiquez une autre date / UNKNOWN ?
- Réponse attendue : `YES | NO | FROM_DATE:<YYYY-MM-DD> | FAMILY:<MASTER_FAMILY>;FROM_DATE:<YYYY-MM-DD> | UNKNOWN`

### HV-014 — Cadeaux · règle 4bbbe418

- Preuve : 15 composant(s), 10 opération(s), preuves 2025-09-23 → 2026-07-06; aucune effectivité historique de règle.
- Non prouvé : date contractuelle d’origine, effectivité métier antérieure et fin éventuelle.
- Proposition : `{"masterRuleFamily":"EXCLUDED_FROM_MINIMAL","effectiveFromCandidate":"2025-09-23","effectiveTo":"UNKNOWN","authorityType":"RETROSPECTIVE_DECLARATION_IF_APPROVED"}`
- Risque : MinimalState historique inclurait/exclurait ou classifierait à tort ces composants.
- Conséquence : Création future d’une version autoritaire rétroactive, nouvelle sourceRevision et republication transitive; aucune mutation de la preuve v1.
- Question : Confirmez-vous que la règle Cadeaux appartenait à EXCLUDED_FROM_MINIMAL à partir du 2025-09-23, ou indiquez une autre date / UNKNOWN ?
- Réponse attendue : `YES | NO | FROM_DATE:<YYYY-MM-DD> | FAMILY:<MASTER_FAMILY>;FROM_DATE:<YYYY-MM-DD> | UNKNOWN`

### HV-015 — Crédits & dettes · règle 383c3ee2

- Preuve : 1 composant(s), 1 opération(s), preuves 2025-08-03 → 2025-08-03; aucune effectivité historique de règle.
- Non prouvé : date contractuelle d’origine, effectivité métier antérieure et fin éventuelle.
- Proposition : `{"masterRuleFamily":"EXCLUDED_FROM_MINIMAL","effectiveFromCandidate":"2025-08-03","effectiveTo":"UNKNOWN","authorityType":"RETROSPECTIVE_DECLARATION_IF_APPROVED"}`
- Risque : MinimalState historique inclurait/exclurait ou classifierait à tort ces composants.
- Conséquence : Création future d’une version autoritaire rétroactive, nouvelle sourceRevision et republication transitive; aucune mutation de la preuve v1.
- Question : Confirmez-vous que la règle Crédits & dettes appartenait à EXCLUDED_FROM_MINIMAL à partir du 2025-08-03, ou indiquez une autre date / UNKNOWN ?
- Réponse attendue : `YES | NO | FROM_DATE:<YYYY-MM-DD> | FAMILY:<MASTER_FAMILY>;FROM_DATE:<YYYY-MM-DD> | UNKNOWN`

### HV-016 — Culture & événements · règle 1af1cdb9

- Preuve : 33 composant(s), 27 opération(s), preuves 2025-08-13 → 2026-06-27; aucune effectivité historique de règle.
- Non prouvé : date contractuelle d’origine, effectivité métier antérieure et fin éventuelle.
- Proposition : `{"masterRuleFamily":"EXCLUDED_FROM_MINIMAL","effectiveFromCandidate":"2025-08-13","effectiveTo":"UNKNOWN","authorityType":"RETROSPECTIVE_DECLARATION_IF_APPROVED"}`
- Risque : MinimalState historique inclurait/exclurait ou classifierait à tort ces composants.
- Conséquence : Création future d’une version autoritaire rétroactive, nouvelle sourceRevision et republication transitive; aucune mutation de la preuve v1.
- Question : Confirmez-vous que la règle Culture & événements appartenait à EXCLUDED_FROM_MINIMAL à partir du 2025-08-13, ou indiquez une autre date / UNKNOWN ?
- Réponse attendue : `YES | NO | FROM_DATE:<YYYY-MM-DD> | FAMILY:<MASTER_FAMILY>;FROM_DATE:<YYYY-MM-DD> | UNKNOWN`

### HV-017 — Dons & solidarité · règle b5293356

- Preuve : 1 composant(s), 1 opération(s), preuves 2026-01-20 → 2026-01-20; aucune effectivité historique de règle.
- Non prouvé : date contractuelle d’origine, effectivité métier antérieure et fin éventuelle.
- Proposition : `{"masterRuleFamily":"EXCLUDED_FROM_MINIMAL","effectiveFromCandidate":"2026-01-20","effectiveTo":"UNKNOWN","authorityType":"RETROSPECTIVE_DECLARATION_IF_APPROVED"}`
- Risque : MinimalState historique inclurait/exclurait ou classifierait à tort ces composants.
- Conséquence : Création future d’une version autoritaire rétroactive, nouvelle sourceRevision et republication transitive; aucune mutation de la preuve v1.
- Question : Confirmez-vous que la règle Dons & solidarité appartenait à EXCLUDED_FROM_MINIMAL à partir du 2026-01-20, ou indiquez une autre date / UNKNOWN ?
- Réponse attendue : `YES | NO | FROM_DATE:<YYYY-MM-DD> | FAMILY:<MASTER_FAMILY>;FROM_DATE:<YYYY-MM-DD> | UNKNOWN`

### HV-018 — Habillement · règle 2c804e5e

- Preuve : 9 composant(s), 8 opération(s), preuves 2025-08-30 → 2026-05-15; aucune effectivité historique de règle.
- Non prouvé : date contractuelle d’origine, effectivité métier antérieure et fin éventuelle.
- Proposition : `{"masterRuleFamily":"EXCLUDED_FROM_MINIMAL","effectiveFromCandidate":"2025-08-30","effectiveTo":"UNKNOWN","authorityType":"RETROSPECTIVE_DECLARATION_IF_APPROVED"}`
- Risque : MinimalState historique inclurait/exclurait ou classifierait à tort ces composants.
- Conséquence : Création future d’une version autoritaire rétroactive, nouvelle sourceRevision et republication transitive; aucune mutation de la preuve v1.
- Question : Confirmez-vous que la règle Habillement appartenait à EXCLUDED_FROM_MINIMAL à partir du 2025-08-30, ou indiquez une autre date / UNKNOWN ?
- Réponse attendue : `YES | NO | FROM_DATE:<YYYY-MM-DD> | FAMILY:<MASTER_FAMILY>;FROM_DATE:<YYYY-MM-DD> | UNKNOWN`

### HV-019 — Logement · règle 26474e82

- Preuve : 35 composant(s), 35 opération(s), preuves 2025-08-04 → 2026-07-10; aucune effectivité historique de règle.
- Non prouvé : date contractuelle d’origine, effectivité métier antérieure et fin éventuelle.
- Proposition : `{"masterRuleFamily":"FIXED_REQUIRED","effectiveFromCandidate":"2025-08-04","effectiveTo":"UNKNOWN","authorityType":"RETROSPECTIVE_DECLARATION_IF_APPROVED"}`
- Risque : MinimalState historique inclurait/exclurait ou classifierait à tort ces composants.
- Conséquence : Création future d’une version autoritaire rétroactive, nouvelle sourceRevision et republication transitive; aucune mutation de la preuve v1.
- Question : Confirmez-vous que la règle Logement appartenait à FIXED_REQUIRED à partir du 2025-08-04, ou indiquez une autre date / UNKNOWN ?
- Réponse attendue : `YES | NO | FROM_DATE:<YYYY-MM-DD> | FAMILY:<MASTER_FAMILY>;FROM_DATE:<YYYY-MM-DD> | UNKNOWN`

### HV-020 — Loisirs & activités · règle 1b07c729

- Preuve : 17 composant(s), 17 opération(s), preuves 2025-08-18 → 2026-07-18; aucune effectivité historique de règle.
- Non prouvé : date contractuelle d’origine, effectivité métier antérieure et fin éventuelle.
- Proposition : `{"masterRuleFamily":"EXCLUDED_FROM_MINIMAL","effectiveFromCandidate":"2025-08-18","effectiveTo":"UNKNOWN","authorityType":"RETROSPECTIVE_DECLARATION_IF_APPROVED"}`
- Risque : MinimalState historique inclurait/exclurait ou classifierait à tort ces composants.
- Conséquence : Création future d’une version autoritaire rétroactive, nouvelle sourceRevision et republication transitive; aucune mutation de la preuve v1.
- Question : Confirmez-vous que la règle Loisirs & activités appartenait à EXCLUDED_FROM_MINIMAL à partir du 2025-08-18, ou indiquez une autre date / UNKNOWN ?
- Réponse attendue : `YES | NO | FROM_DATE:<YYYY-MM-DD> | FAMILY:<MASTER_FAMILY>;FROM_DATE:<YYYY-MM-DD> | UNKNOWN`

### HV-021 — Maison & quotidien · règle 6a4db0ea

- Preuve : 26 composant(s), 25 opération(s), preuves 2025-08-11 → 2026-06-21; aucune effectivité historique de règle.
- Non prouvé : date contractuelle d’origine, effectivité métier antérieure et fin éventuelle.
- Proposition : `{"masterRuleFamily":"EXCLUDED_FROM_MINIMAL","effectiveFromCandidate":"2025-08-11","effectiveTo":"UNKNOWN","authorityType":"RETROSPECTIVE_DECLARATION_IF_APPROVED"}`
- Risque : MinimalState historique inclurait/exclurait ou classifierait à tort ces composants.
- Conséquence : Création future d’une version autoritaire rétroactive, nouvelle sourceRevision et republication transitive; aucune mutation de la preuve v1.
- Question : Confirmez-vous que la règle Maison & quotidien appartenait à EXCLUDED_FROM_MINIMAL à partir du 2025-08-11, ou indiquez une autre date / UNKNOWN ?
- Réponse attendue : `YES | NO | FROM_DATE:<YYYY-MM-DD> | FAMILY:<MASTER_FAMILY>;FROM_DATE:<YYYY-MM-DD> | UNKNOWN`

### HV-022 — Mixte / multi-catégories · règle 11129cfd

- Preuve : 5 composant(s), 5 opération(s), preuves 2025-08-11 → 2026-03-15; aucune effectivité historique de règle.
- Non prouvé : date contractuelle d’origine, effectivité métier antérieure et fin éventuelle.
- Proposition : `{"masterRuleFamily":"UNKNOWN","effectiveFromCandidate":"2025-08-11","effectiveTo":"UNKNOWN","authorityType":"RETROSPECTIVE_DECLARATION_IF_APPROVED"}`
- Risque : MinimalState historique inclurait/exclurait ou classifierait à tort ces composants.
- Conséquence : Création future d’une version autoritaire rétroactive, nouvelle sourceRevision et republication transitive; aucune mutation de la preuve v1.
- Question : Confirmez-vous que la règle Mixte / multi-catégories appartenait à une famille Minimal à préciser à partir du 2025-08-11, ou indiquez une autre date / UNKNOWN ?
- Réponse attendue : `YES | NO | FROM_DATE:<YYYY-MM-DD> | FAMILY:<MASTER_FAMILY>;FROM_DATE:<YYYY-MM-DD> | UNKNOWN`

### HV-023 — Numérique · règle 6a855181

- Preuve : 77 composant(s), 77 opération(s), preuves 2025-08-04 → 2026-07-21; aucune effectivité historique de règle.
- Non prouvé : date contractuelle d’origine, effectivité métier antérieure et fin éventuelle.
- Proposition : `{"masterRuleFamily":"EXCLUDED_FROM_MINIMAL","effectiveFromCandidate":"2025-08-04","effectiveTo":"UNKNOWN","authorityType":"RETROSPECTIVE_DECLARATION_IF_APPROVED"}`
- Risque : MinimalState historique inclurait/exclurait ou classifierait à tort ces composants.
- Conséquence : Création future d’une version autoritaire rétroactive, nouvelle sourceRevision et republication transitive; aucune mutation de la preuve v1.
- Question : Confirmez-vous que la règle Numérique appartenait à EXCLUDED_FROM_MINIMAL à partir du 2025-08-04, ou indiquez une autre date / UNKNOWN ?
- Réponse attendue : `YES | NO | FROM_DATE:<YYYY-MM-DD> | FAMILY:<MASTER_FAMILY>;FROM_DATE:<YYYY-MM-DD> | UNKNOWN`

### HV-024 — Permis de conduire · règle 43edc03d

- Preuve : 15 composant(s), 15 opération(s), preuves 2025-08-12 → 2026-07-03; aucune effectivité historique de règle.
- Non prouvé : date contractuelle d’origine, effectivité métier antérieure et fin éventuelle.
- Proposition : `{"masterRuleFamily":"EXCLUDED_FROM_MINIMAL","effectiveFromCandidate":"2025-08-12","effectiveTo":"UNKNOWN","authorityType":"RETROSPECTIVE_DECLARATION_IF_APPROVED"}`
- Risque : MinimalState historique inclurait/exclurait ou classifierait à tort ces composants.
- Conséquence : Création future d’une version autoritaire rétroactive, nouvelle sourceRevision et republication transitive; aucune mutation de la preuve v1.
- Question : Confirmez-vous que la règle Permis de conduire appartenait à EXCLUDED_FROM_MINIMAL à partir du 2025-08-12, ou indiquez une autre date / UNKNOWN ?
- Réponse attendue : `YES | NO | FROM_DATE:<YYYY-MM-DD> | FAMILY:<MASTER_FAMILY>;FROM_DATE:<YYYY-MM-DD> | UNKNOWN`

### HV-025 — Restauration · règle aa2c620b

- Preuve : 93 composant(s), 93 opération(s), preuves 2025-08-24 → 2026-07-11; aucune effectivité historique de règle.
- Non prouvé : date contractuelle d’origine, effectivité métier antérieure et fin éventuelle.
- Proposition : `{"masterRuleFamily":"EXCLUDED_FROM_MINIMAL","effectiveFromCandidate":"2025-08-24","effectiveTo":"UNKNOWN","authorityType":"RETROSPECTIVE_DECLARATION_IF_APPROVED"}`
- Risque : MinimalState historique inclurait/exclurait ou classifierait à tort ces composants.
- Conséquence : Création future d’une version autoritaire rétroactive, nouvelle sourceRevision et republication transitive; aucune mutation de la preuve v1.
- Question : Confirmez-vous que la règle Restauration appartenait à EXCLUDED_FROM_MINIMAL à partir du 2025-08-24, ou indiquez une autre date / UNKNOWN ?
- Réponse attendue : `YES | NO | FROM_DATE:<YYYY-MM-DD> | FAMILY:<MASTER_FAMILY>;FROM_DATE:<YYYY-MM-DD> | UNKNOWN`

### HV-026 — Santé · règle bdd1dda9

- Preuve : 30 composant(s), 30 opération(s), preuves 2025-08-07 → 2026-07-16; aucune effectivité historique de règle.
- Non prouvé : date contractuelle d’origine, effectivité métier antérieure et fin éventuelle.
- Proposition : `{"masterRuleFamily":"EXCLUDED_FROM_MINIMAL","effectiveFromCandidate":"2025-08-07","effectiveTo":"UNKNOWN","authorityType":"RETROSPECTIVE_DECLARATION_IF_APPROVED"}`
- Risque : MinimalState historique inclurait/exclurait ou classifierait à tort ces composants.
- Conséquence : Création future d’une version autoritaire rétroactive, nouvelle sourceRevision et republication transitive; aucune mutation de la preuve v1.
- Question : Confirmez-vous que la règle Santé appartenait à EXCLUDED_FROM_MINIMAL à partir du 2025-08-07, ou indiquez une autre date / UNKNOWN ?
- Réponse attendue : `YES | NO | FROM_DATE:<YYYY-MM-DD> | FAMILY:<MASTER_FAMILY>;FROM_DATE:<YYYY-MM-DD> | UNKNOWN`

### HV-027 — Soins personnels / Coiffure · règle 2d3e9f47

- Preuve : 5 composant(s), 5 opération(s), preuves 2025-09-06 → 2026-05-22; aucune effectivité historique de règle.
- Non prouvé : date contractuelle d’origine, effectivité métier antérieure et fin éventuelle.
- Proposition : `{"masterRuleFamily":"VARIABLE_ESSENTIAL","effectiveFromCandidate":"2025-09-06","effectiveTo":"UNKNOWN","authorityType":"RETROSPECTIVE_DECLARATION_IF_APPROVED"}`
- Risque : MinimalState historique inclurait/exclurait ou classifierait à tort ces composants.
- Conséquence : Création future d’une version autoritaire rétroactive, nouvelle sourceRevision et republication transitive; aucune mutation de la preuve v1.
- Question : Confirmez-vous que la règle Soins personnels / Coiffure appartenait à VARIABLE_ESSENTIAL à partir du 2025-09-06, ou indiquez une autre date / UNKNOWN ?
- Réponse attendue : `YES | NO | FROM_DATE:<YYYY-MM-DD> | FAMILY:<MASTER_FAMILY>;FROM_DATE:<YYYY-MM-DD> | UNKNOWN`

### HV-028 — Soins personnels / Maquillage · règle 9a94eaee

- Preuve : 1 composant(s), 1 opération(s), preuves 2026-03-11 → 2026-03-11; aucune effectivité historique de règle.
- Non prouvé : date contractuelle d’origine, effectivité métier antérieure et fin éventuelle.
- Proposition : `{"masterRuleFamily":"VARIABLE_ESSENTIAL","effectiveFromCandidate":"2026-03-11","effectiveTo":"UNKNOWN","authorityType":"RETROSPECTIVE_DECLARATION_IF_APPROVED"}`
- Risque : MinimalState historique inclurait/exclurait ou classifierait à tort ces composants.
- Conséquence : Création future d’une version autoritaire rétroactive, nouvelle sourceRevision et republication transitive; aucune mutation de la preuve v1.
- Question : Confirmez-vous que la règle Soins personnels / Maquillage appartenait à VARIABLE_ESSENTIAL à partir du 2026-03-11, ou indiquez une autre date / UNKNOWN ?
- Réponse attendue : `YES | NO | FROM_DATE:<YYYY-MM-DD> | FAMILY:<MASTER_FAMILY>;FROM_DATE:<YYYY-MM-DD> | UNKNOWN`

### HV-029 — Soins personnels / Skincare · règle 704b7737

- Preuve : 5 composant(s), 4 opération(s), preuves 2025-12-11 → 2026-05-12; aucune effectivité historique de règle.
- Non prouvé : date contractuelle d’origine, effectivité métier antérieure et fin éventuelle.
- Proposition : `{"masterRuleFamily":"VARIABLE_ESSENTIAL","effectiveFromCandidate":"2025-12-11","effectiveTo":"UNKNOWN","authorityType":"RETROSPECTIVE_DECLARATION_IF_APPROVED"}`
- Risque : MinimalState historique inclurait/exclurait ou classifierait à tort ces composants.
- Conséquence : Création future d’une version autoritaire rétroactive, nouvelle sourceRevision et republication transitive; aucune mutation de la preuve v1.
- Question : Confirmez-vous que la règle Soins personnels / Skincare appartenait à VARIABLE_ESSENTIAL à partir du 2025-12-11, ou indiquez une autre date / UNKNOWN ?
- Réponse attendue : `YES | NO | FROM_DATE:<YYYY-MM-DD> | FAMILY:<MASTER_FAMILY>;FROM_DATE:<YYYY-MM-DD> | UNKNOWN`

### HV-030 — Soins personnels · règle 597172f9

- Preuve : 24 composant(s), 18 opération(s), preuves 2025-08-14 → 2026-07-25; aucune effectivité historique de règle.
- Non prouvé : date contractuelle d’origine, effectivité métier antérieure et fin éventuelle.
- Proposition : `{"masterRuleFamily":"EXCLUDED_FROM_MINIMAL","effectiveFromCandidate":"2025-08-14","effectiveTo":"UNKNOWN","authorityType":"RETROSPECTIVE_DECLARATION_IF_APPROVED"}`
- Risque : MinimalState historique inclurait/exclurait ou classifierait à tort ces composants.
- Conséquence : Création future d’une version autoritaire rétroactive, nouvelle sourceRevision et republication transitive; aucune mutation de la preuve v1.
- Question : Confirmez-vous que la règle Soins personnels appartenait à EXCLUDED_FROM_MINIMAL à partir du 2025-08-14, ou indiquez une autre date / UNKNOWN ?
- Réponse attendue : `YES | NO | FROM_DATE:<YYYY-MM-DD> | FAMILY:<MASTER_FAMILY>;FROM_DATE:<YYYY-MM-DD> | UNKNOWN`

### HV-031 — Tabac & vape · règle c09c9840

- Preuve : 123 composant(s), 120 opération(s), preuves 2025-08-02 → 2026-07-25; aucune effectivité historique de règle.
- Non prouvé : date contractuelle d’origine, effectivité métier antérieure et fin éventuelle.
- Proposition : `{"masterRuleFamily":"EXCLUDED_FROM_MINIMAL","effectiveFromCandidate":"2025-08-02","effectiveTo":"UNKNOWN","authorityType":"RETROSPECTIVE_DECLARATION_IF_APPROVED"}`
- Risque : MinimalState historique inclurait/exclurait ou classifierait à tort ces composants.
- Conséquence : Création future d’une version autoritaire rétroactive, nouvelle sourceRevision et republication transitive; aucune mutation de la preuve v1.
- Question : Confirmez-vous que la règle Tabac & vape appartenait à EXCLUDED_FROM_MINIMAL à partir du 2025-08-02, ou indiquez une autre date / UNKNOWN ?
- Réponse attendue : `YES | NO | FROM_DATE:<YYYY-MM-DD> | FAMILY:<MASTER_FAMILY>;FROM_DATE:<YYYY-MM-DD> | UNKNOWN`

### HV-032 — Télécom · règle 10423aa1

- Preuve : 48 composant(s), 48 opération(s), preuves 2025-08-07 → 2026-07-27; aucune effectivité historique de règle.
- Non prouvé : date contractuelle d’origine, effectivité métier antérieure et fin éventuelle.
- Proposition : `{"masterRuleFamily":"FIXED_REQUIRED","effectiveFromCandidate":"2025-08-07","effectiveTo":"UNKNOWN","authorityType":"RETROSPECTIVE_DECLARATION_IF_APPROVED"}`
- Risque : MinimalState historique inclurait/exclurait ou classifierait à tort ces composants.
- Conséquence : Création future d’une version autoritaire rétroactive, nouvelle sourceRevision et republication transitive; aucune mutation de la preuve v1.
- Question : Confirmez-vous que la règle Télécom appartenait à FIXED_REQUIRED à partir du 2025-08-07, ou indiquez une autre date / UNKNOWN ?
- Réponse attendue : `YES | NO | FROM_DATE:<YYYY-MM-DD> | FAMILY:<MASTER_FAMILY>;FROM_DATE:<YYYY-MM-DD> | UNKNOWN`

### HV-033 — Transport & voiture / Carburant · règle 934afb8d

- Preuve : 26 composant(s), 26 opération(s), preuves 2025-08-03 → 2026-07-25; aucune effectivité historique de règle.
- Non prouvé : date contractuelle d’origine, effectivité métier antérieure et fin éventuelle.
- Proposition : `{"masterRuleFamily":"VARIABLE_ESSENTIAL","effectiveFromCandidate":"2025-08-03","effectiveTo":"UNKNOWN","authorityType":"RETROSPECTIVE_DECLARATION_IF_APPROVED"}`
- Risque : MinimalState historique inclurait/exclurait ou classifierait à tort ces composants.
- Conséquence : Création future d’une version autoritaire rétroactive, nouvelle sourceRevision et republication transitive; aucune mutation de la preuve v1.
- Question : Confirmez-vous que la règle Transport & voiture / Carburant appartenait à VARIABLE_ESSENTIAL à partir du 2025-08-03, ou indiquez une autre date / UNKNOWN ?
- Réponse attendue : `YES | NO | FROM_DATE:<YYYY-MM-DD> | FAMILY:<MASTER_FAMILY>;FROM_DATE:<YYYY-MM-DD> | UNKNOWN`

### HV-034 — Transport & voiture · règle 6a17a628

- Preuve : 78 composant(s), 78 opération(s), preuves 2025-08-03 → 2026-07-29; aucune effectivité historique de règle.
- Non prouvé : date contractuelle d’origine, effectivité métier antérieure et fin éventuelle.
- Proposition : `{"masterRuleFamily":"EXCLUDED_FROM_MINIMAL","effectiveFromCandidate":"2025-08-03","effectiveTo":"UNKNOWN","authorityType":"RETROSPECTIVE_DECLARATION_IF_APPROVED"}`
- Risque : MinimalState historique inclurait/exclurait ou classifierait à tort ces composants.
- Conséquence : Création future d’une version autoritaire rétroactive, nouvelle sourceRevision et republication transitive; aucune mutation de la preuve v1.
- Question : Confirmez-vous que la règle Transport & voiture appartenait à EXCLUDED_FROM_MINIMAL à partir du 2025-08-03, ou indiquez une autre date / UNKNOWN ?
- Réponse attendue : `YES | NO | FROM_DATE:<YYYY-MM-DD> | FAMILY:<MASTER_FAMILY>;FROM_DATE:<YYYY-MM-DD> | UNKNOWN`

### HV-035 — Voyages · règle 89e5af5e

- Preuve : 5 composant(s), 5 opération(s), preuves 2025-09-07 → 2026-03-31; aucune effectivité historique de règle.
- Non prouvé : date contractuelle d’origine, effectivité métier antérieure et fin éventuelle.
- Proposition : `{"masterRuleFamily":"EXCLUDED_FROM_MINIMAL","effectiveFromCandidate":"2025-09-07","effectiveTo":"UNKNOWN","authorityType":"RETROSPECTIVE_DECLARATION_IF_APPROVED"}`
- Risque : MinimalState historique inclurait/exclurait ou classifierait à tort ces composants.
- Conséquence : Création future d’une version autoritaire rétroactive, nouvelle sourceRevision et republication transitive; aucune mutation de la preuve v1.
- Question : Confirmez-vous que la règle Voyages appartenait à EXCLUDED_FROM_MINIMAL à partir du 2025-09-07, ou indiquez une autre date / UNKNOWN ?
- Réponse attendue : `YES | NO | FROM_DATE:<YYYY-MM-DD> | FAMILY:<MASTER_FAMILY>;FROM_DATE:<YYYY-MM-DD> | UNKNOWN`

### HV-036 — Assurances · série 257bc01f

- Preuve : 6 occurrence(s) observée(s), 2026-02-19 → 2026-07-20; cycle de vie historique non prouvé.
- Non prouvé : date contractuelle d’origine, effectivité métier antérieure et fin éventuelle.
- Proposition : `{"historicalState":"ACTIVE_FOR_MINIMAL_IF_APPROVED","effectiveFromCandidate":"2026-02-19","effectiveTo":"UNKNOWN","authorityType":"RETROSPECTIVE_DECLARATION_IF_APPROVED"}`
- Risque : Une obligation périodique pourrait être activée trop tôt/tard ou attribuée à tort au Minimal.
- Conséquence : Création future d’une version d’état récurrence; les observations restent séparées de la déclaration.
- Question : Confirmez-vous que Assurances · série 257bc01f constituait une obligation/récurrence Minimal effective à partir du 2026-02-19, ou indiquez NO / une autre date / UNKNOWN ?
- Réponse attendue : `YES | NO | FROM_DATE:<YYYY-MM-DD> | UNKNOWN`

### HV-037 — Assurances · série 62961690

- Preuve : 12 occurrence(s) observée(s), 2025-08-10 → 2026-07-09; cycle de vie historique non prouvé.
- Non prouvé : date contractuelle d’origine, effectivité métier antérieure et fin éventuelle.
- Proposition : `{"historicalState":"ACTIVE_FOR_MINIMAL_IF_APPROVED","effectiveFromCandidate":"2025-08-10","effectiveTo":"UNKNOWN","authorityType":"RETROSPECTIVE_DECLARATION_IF_APPROVED"}`
- Risque : Une obligation périodique pourrait être activée trop tôt/tard ou attribuée à tort au Minimal.
- Conséquence : Création future d’une version d’état récurrence; les observations restent séparées de la déclaration.
- Question : Confirmez-vous que Assurances · série 62961690 constituait une obligation/récurrence Minimal effective à partir du 2025-08-10, ou indiquez NO / une autre date / UNKNOWN ?
- Réponse attendue : `YES | NO | FROM_DATE:<YYYY-MM-DD> | UNKNOWN`

### HV-038 — Assurances · série 9b4c64f5

- Preuve : 6 occurrence(s) observée(s), 2025-08-20 → 2026-01-20; cycle de vie historique non prouvé.
- Non prouvé : date contractuelle d’origine, effectivité métier antérieure et fin éventuelle.
- Proposition : `{"historicalState":"ACTIVE_FOR_MINIMAL_IF_APPROVED","effectiveFromCandidate":"2025-08-20","effectiveTo":"UNKNOWN","authorityType":"RETROSPECTIVE_DECLARATION_IF_APPROVED"}`
- Risque : Une obligation périodique pourrait être activée trop tôt/tard ou attribuée à tort au Minimal.
- Conséquence : Création future d’une version d’état récurrence; les observations restent séparées de la déclaration.
- Question : Confirmez-vous que Assurances · série 9b4c64f5 constituait une obligation/récurrence Minimal effective à partir du 2025-08-20, ou indiquez NO / une autre date / UNKNOWN ?
- Réponse attendue : `YES | NO | FROM_DATE:<YYYY-MM-DD> | UNKNOWN`

### HV-039 — Assurances · série d1235129

- Preuve : 12 occurrence(s) observée(s), 2025-08-04 → 2026-07-06; cycle de vie historique non prouvé.
- Non prouvé : date contractuelle d’origine, effectivité métier antérieure et fin éventuelle.
- Proposition : `{"historicalState":"ACTIVE_FOR_MINIMAL_IF_APPROVED","effectiveFromCandidate":"2025-08-04","effectiveTo":"UNKNOWN","authorityType":"RETROSPECTIVE_DECLARATION_IF_APPROVED"}`
- Risque : Une obligation périodique pourrait être activée trop tôt/tard ou attribuée à tort au Minimal.
- Conséquence : Création future d’une version d’état récurrence; les observations restent séparées de la déclaration.
- Question : Confirmez-vous que Assurances · série d1235129 constituait une obligation/récurrence Minimal effective à partir du 2025-08-04, ou indiquez NO / une autre date / UNKNOWN ?
- Réponse attendue : `YES | NO | FROM_DATE:<YYYY-MM-DD> | UNKNOWN`

### HV-040 — Assurances · série d7a6e623

- Preuve : 1 occurrence(s) observée(s), 2026-02-19 → 2026-02-19; cycle de vie historique non prouvé.
- Non prouvé : date contractuelle d’origine, effectivité métier antérieure et fin éventuelle.
- Proposition : `{"historicalState":"ACTIVE_FOR_MINIMAL_IF_APPROVED","effectiveFromCandidate":"2026-02-19","effectiveTo":"UNKNOWN","authorityType":"RETROSPECTIVE_DECLARATION_IF_APPROVED"}`
- Risque : Une obligation périodique pourrait être activée trop tôt/tard ou attribuée à tort au Minimal.
- Conséquence : Création future d’une version d’état récurrence; les observations restent séparées de la déclaration.
- Question : Confirmez-vous que Assurances · série d7a6e623 constituait une obligation/récurrence Minimal effective à partir du 2026-02-19, ou indiquez NO / une autre date / UNKNOWN ?
- Réponse attendue : `YES | NO | FROM_DATE:<YYYY-MM-DD> | UNKNOWN`

### HV-041 — Assurances · série d7f56f4f

- Preuve : 12 occurrence(s) observée(s), 2025-08-04 → 2026-07-06; cycle de vie historique non prouvé.
- Non prouvé : date contractuelle d’origine, effectivité métier antérieure et fin éventuelle.
- Proposition : `{"historicalState":"ACTIVE_FOR_MINIMAL_IF_APPROVED","effectiveFromCandidate":"2025-08-04","effectiveTo":"UNKNOWN","authorityType":"RETROSPECTIVE_DECLARATION_IF_APPROVED"}`
- Risque : Une obligation périodique pourrait être activée trop tôt/tard ou attribuée à tort au Minimal.
- Conséquence : Création future d’une version d’état récurrence; les observations restent séparées de la déclaration.
- Question : Confirmez-vous que Assurances · série d7f56f4f constituait une obligation/récurrence Minimal effective à partir du 2025-08-04, ou indiquez NO / une autre date / UNKNOWN ?
- Réponse attendue : `YES | NO | FROM_DATE:<YYYY-MM-DD> | UNKNOWN`

### HV-042 — Banque · série 16f9e5e2

- Preuve : 4 occurrence(s) observée(s), 2026-04-15 → 2026-07-17; cycle de vie historique non prouvé.
- Non prouvé : date contractuelle d’origine, effectivité métier antérieure et fin éventuelle.
- Proposition : `{"historicalState":"ACTIVE_FOR_MINIMAL_IF_APPROVED","effectiveFromCandidate":"2026-04-15","effectiveTo":"UNKNOWN","authorityType":"RETROSPECTIVE_DECLARATION_IF_APPROVED"}`
- Risque : Une obligation périodique pourrait être activée trop tôt/tard ou attribuée à tort au Minimal.
- Conséquence : Création future d’une version d’état récurrence; les observations restent séparées de la déclaration.
- Question : Confirmez-vous que Banque · série 16f9e5e2 constituait une obligation/récurrence Minimal effective à partir du 2026-04-15, ou indiquez NO / une autre date / UNKNOWN ?
- Réponse attendue : `YES | NO | FROM_DATE:<YYYY-MM-DD> | UNKNOWN`

### HV-043 — Banque · série 5b641a6b

- Preuve : 9 occurrence(s) observée(s), 2025-08-08 → 2026-04-08; cycle de vie historique non prouvé.
- Non prouvé : date contractuelle d’origine, effectivité métier antérieure et fin éventuelle.
- Proposition : `{"historicalState":"ACTIVE_FOR_MINIMAL_IF_APPROVED","effectiveFromCandidate":"2025-08-08","effectiveTo":"UNKNOWN","authorityType":"RETROSPECTIVE_DECLARATION_IF_APPROVED"}`
- Risque : Une obligation périodique pourrait être activée trop tôt/tard ou attribuée à tort au Minimal.
- Conséquence : Création future d’une version d’état récurrence; les observations restent séparées de la déclaration.
- Question : Confirmez-vous que Banque · série 5b641a6b constituait une obligation/récurrence Minimal effective à partir du 2025-08-08, ou indiquez NO / une autre date / UNKNOWN ?
- Réponse attendue : `YES | NO | FROM_DATE:<YYYY-MM-DD> | UNKNOWN`

### HV-044 — Banque · série 85178ac7

- Preuve : 13 occurrence(s) observée(s), 2025-08-20 → 2026-07-21; cycle de vie historique non prouvé.
- Non prouvé : date contractuelle d’origine, effectivité métier antérieure et fin éventuelle.
- Proposition : `{"historicalState":"ACTIVE_FOR_MINIMAL_IF_APPROVED","effectiveFromCandidate":"2025-08-20","effectiveTo":"UNKNOWN","authorityType":"RETROSPECTIVE_DECLARATION_IF_APPROVED"}`
- Risque : Une obligation périodique pourrait être activée trop tôt/tard ou attribuée à tort au Minimal.
- Conséquence : Création future d’une version d’état récurrence; les observations restent séparées de la déclaration.
- Question : Confirmez-vous que Banque · série 85178ac7 constituait une obligation/récurrence Minimal effective à partir du 2025-08-20, ou indiquez NO / une autre date / UNKNOWN ?
- Réponse attendue : `YES | NO | FROM_DATE:<YYYY-MM-DD> | UNKNOWN`

### HV-045 — Logement · série 0716e2b2

- Preuve : 12 occurrence(s) observée(s), 2025-08-04 → 2026-07-06; cycle de vie historique non prouvé.
- Non prouvé : date contractuelle d’origine, effectivité métier antérieure et fin éventuelle.
- Proposition : `{"historicalState":"ACTIVE_FOR_MINIMAL_IF_APPROVED","effectiveFromCandidate":"2025-08-04","effectiveTo":"UNKNOWN","authorityType":"RETROSPECTIVE_DECLARATION_IF_APPROVED"}`
- Risque : Une obligation périodique pourrait être activée trop tôt/tard ou attribuée à tort au Minimal.
- Conséquence : Création future d’une version d’état récurrence; les observations restent séparées de la déclaration.
- Question : Confirmez-vous que Logement · série 0716e2b2 constituait une obligation/récurrence Minimal effective à partir du 2025-08-04, ou indiquez NO / une autre date / UNKNOWN ?
- Réponse attendue : `YES | NO | FROM_DATE:<YYYY-MM-DD> | UNKNOWN`

### HV-046 — Logement · série 5079d3ae

- Preuve : 11 occurrence(s) observée(s), 2025-08-11 → 2026-07-10; cycle de vie historique non prouvé.
- Non prouvé : date contractuelle d’origine, effectivité métier antérieure et fin éventuelle.
- Proposition : `{"historicalState":"ACTIVE_FOR_MINIMAL_IF_APPROVED","effectiveFromCandidate":"2025-08-11","effectiveTo":"UNKNOWN","authorityType":"RETROSPECTIVE_DECLARATION_IF_APPROVED"}`
- Risque : Une obligation périodique pourrait être activée trop tôt/tard ou attribuée à tort au Minimal.
- Conséquence : Création future d’une version d’état récurrence; les observations restent séparées de la déclaration.
- Question : Confirmez-vous que Logement · série 5079d3ae constituait une obligation/récurrence Minimal effective à partir du 2025-08-11, ou indiquez NO / une autre date / UNKNOWN ?
- Réponse attendue : `YES | NO | FROM_DATE:<YYYY-MM-DD> | UNKNOWN`

### HV-047 — Logement · série 5b4640d7

- Preuve : 12 occurrence(s) observée(s), 2025-08-10 → 2026-07-01; cycle de vie historique non prouvé.
- Non prouvé : date contractuelle d’origine, effectivité métier antérieure et fin éventuelle.
- Proposition : `{"historicalState":"ACTIVE_FOR_MINIMAL_IF_APPROVED","effectiveFromCandidate":"2025-08-10","effectiveTo":"UNKNOWN","authorityType":"RETROSPECTIVE_DECLARATION_IF_APPROVED"}`
- Risque : Une obligation périodique pourrait être activée trop tôt/tard ou attribuée à tort au Minimal.
- Conséquence : Création future d’une version d’état récurrence; les observations restent séparées de la déclaration.
- Question : Confirmez-vous que Logement · série 5b4640d7 constituait une obligation/récurrence Minimal effective à partir du 2025-08-10, ou indiquez NO / une autre date / UNKNOWN ?
- Réponse attendue : `YES | NO | FROM_DATE:<YYYY-MM-DD> | UNKNOWN`

### HV-048 — Télécom · série 4010830d

- Preuve : 12 occurrence(s) observée(s), 2025-08-25 → 2026-07-27; cycle de vie historique non prouvé.
- Non prouvé : date contractuelle d’origine, effectivité métier antérieure et fin éventuelle.
- Proposition : `{"historicalState":"ACTIVE_FOR_MINIMAL_IF_APPROVED","effectiveFromCandidate":"2025-08-25","effectiveTo":"UNKNOWN","authorityType":"RETROSPECTIVE_DECLARATION_IF_APPROVED"}`
- Risque : Une obligation périodique pourrait être activée trop tôt/tard ou attribuée à tort au Minimal.
- Conséquence : Création future d’une version d’état récurrence; les observations restent séparées de la déclaration.
- Question : Confirmez-vous que Télécom · série 4010830d constituait une obligation/récurrence Minimal effective à partir du 2025-08-25, ou indiquez NO / une autre date / UNKNOWN ?
- Réponse attendue : `YES | NO | FROM_DATE:<YYYY-MM-DD> | UNKNOWN`

### HV-049 — Télécom · série 5f1707aa

- Preuve : 12 occurrence(s) observée(s), 2025-08-18 → 2026-07-20; cycle de vie historique non prouvé.
- Non prouvé : date contractuelle d’origine, effectivité métier antérieure et fin éventuelle.
- Proposition : `{"historicalState":"ACTIVE_FOR_MINIMAL_IF_APPROVED","effectiveFromCandidate":"2025-08-18","effectiveTo":"UNKNOWN","authorityType":"RETROSPECTIVE_DECLARATION_IF_APPROVED"}`
- Risque : Une obligation périodique pourrait être activée trop tôt/tard ou attribuée à tort au Minimal.
- Conséquence : Création future d’une version d’état récurrence; les observations restent séparées de la déclaration.
- Question : Confirmez-vous que Télécom · série 5f1707aa constituait une obligation/récurrence Minimal effective à partir du 2025-08-18, ou indiquez NO / une autre date / UNKNOWN ?
- Réponse attendue : `YES | NO | FROM_DATE:<YYYY-MM-DD> | UNKNOWN`

### HV-050 — Télécom · série d95e85e2

- Preuve : 12 occurrence(s) observée(s), 2025-08-07 → 2026-07-07; cycle de vie historique non prouvé.
- Non prouvé : date contractuelle d’origine, effectivité métier antérieure et fin éventuelle.
- Proposition : `{"historicalState":"ACTIVE_FOR_MINIMAL_IF_APPROVED","effectiveFromCandidate":"2025-08-07","effectiveTo":"UNKNOWN","authorityType":"RETROSPECTIVE_DECLARATION_IF_APPROVED"}`
- Risque : Une obligation périodique pourrait être activée trop tôt/tard ou attribuée à tort au Minimal.
- Conséquence : Création future d’une version d’état récurrence; les observations restent séparées de la déclaration.
- Question : Confirmez-vous que Télécom · série d95e85e2 constituait une obligation/récurrence Minimal effective à partir du 2025-08-07, ou indiquez NO / une autre date / UNKNOWN ?
- Réponse attendue : `YES | NO | FROM_DATE:<YYYY-MM-DD> | UNKNOWN`

### HV-051 — Télécom · série e57d31b3

- Preuve : 12 occurrence(s) observée(s), 2025-08-18 → 2026-07-17; cycle de vie historique non prouvé.
- Non prouvé : date contractuelle d’origine, effectivité métier antérieure et fin éventuelle.
- Proposition : `{"historicalState":"ACTIVE_FOR_MINIMAL_IF_APPROVED","effectiveFromCandidate":"2025-08-18","effectiveTo":"UNKNOWN","authorityType":"RETROSPECTIVE_DECLARATION_IF_APPROVED"}`
- Risque : Une obligation périodique pourrait être activée trop tôt/tard ou attribuée à tort au Minimal.
- Conséquence : Création future d’une version d’état récurrence; les observations restent séparées de la déclaration.
- Question : Confirmez-vous que Télécom · série e57d31b3 constituait une obligation/récurrence Minimal effective à partir du 2025-08-18, ou indiquez NO / une autre date / UNKNOWN ?
- Réponse attendue : `YES | NO | FROM_DATE:<YYYY-MM-DD> | UNKNOWN`


## Clôture

```
M1_H1_BACKFILL_DESIGN = PASS

TOTAL_MINIMAL_RULES = 40
RULES_AUTO_PROVABLE = 0
RULES_HUMAN_CONFIRM = 35
RULES_MUST_REMAIN_UNKNOWN = 5
RULES_BLOCKING = 35

TOTAL_RECURRENCES = 35
RECURRENCES_AUTO_PROVABLE = 19
RECURRENCES_HUMAN_CONFIRM = 16
RECURRENCES_MUST_REMAIN_UNKNOWN = 0
RECURRENCES_BLOCKING = 16

HUMAN_DECISIONS_REQUIRED = 51

RECOMMENDED_HISTORICAL_AUTHORITY_MODEL =
BITEMPORAL_TYPED_RULE_AND_RECURRENCE_AUTHORITY_V1

BACKFILL_DESIGN_READY = YES
MIGRATION_DESIGN_READY = YES
MINIMAL_12M_REPLAY_AFTER_APPROVAL = POSSIBLE
HISTORY_REPUBLICATION_REQUIRED = YES

CODE_MODIFIED = NO
SUPABASE_WRITES = 0
MIGRATION_APPLIED = NO
BACKFILL_APPLIED = NO
VERCEL_DEPLOY = NO
GIT_PUSH = NO
```
