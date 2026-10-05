# Références historiques par poste — comparabilité locale

Date : 2026-10-05. Branche : main. HEAD avant : f3689a6d432b272d4fdfa7099c1dac4f4b1402ff.
Commit de code testé : 1458486508e8f762e1cea015f59b910ef6d17335.

## Mini-audit et correction

L'ancien historique demandait pour Courses BANK + SWILE + EDENRED FULL, à partir de requiredForecastSources et completeMonthsBySource. Les preuves d'import live ne certifient aucun de ces mois en FULL : cette condition empruntée au forecast rejetait les coûts économiques pourtant connus. V5 avait déjà élargi les candidats au-delà de trainingMonths, mais gardait cet argument et le filtre de sources.

La projection serveur month-category-history.ts possède désormais la seule doctrine locale. month-control-center.ts l'appelle avec quatre arguments : clé, predictionEvidence, asOf, mois visé. Aucun scénario, cible, ajustement ou fenêtre d'entraînement n'est une entrée du calcul.

Autorités inspectées : month-reference.ts, remaining-month-forecast.ts, forecast-opportunities.ts, month-prediction-evidence.ts, month-choice-contract.ts, month-decision-contract.ts, History V2 (source de query, pivots mensuels et shared doctrines), suites spatial UX / V4 / V5.

Le meilleur corpus disponible est predictionEvidence.history, qui lit financial_economic_cost_canonical et remplace les composants bancaires représentés par leurs purchase_events canoniques via mergePredictionPurchases. Les funding components ne rajoutent aucun coût. Les personnes viennent de needs / operations et des références canoniques existantes. History V2 possède des pivots complets pour certaines projections, mais sa source de lecture exige une publication FROZEN_MONTH et ne publie pas actuellement de preuve locale live de catégorie absente à zéro. Nous ne fabriquons pas cette publication.

## Doctrine

- Candidats : mois distincts présents dans le corpus canonique borné startMonth/endMonth, y compris les legs sans coût conservés en diagnostic. Fenêtre live 2025-08 → 2026-07. Aucune génération de mois sans fait.
- Les mois courants et futurs sont exclus avant le calcul.
- Catégories économiques : matcher canonique matchesForecastCategory, lignes pertinentes uniquement, rejet local de PARTIAL ou de montant non fini, somme Big.js. fundingComplete et couverture globale des sources ne sont pas des conditions d'admission.
- Zéro : un coût canonique explicitement connu à zéro est une observation comparable. Aucune ligne ne signifie jamais automatiquement zéro, même si un import bancaire est complet. Sans preuve locale publiée, exclusion ZERO_NOT_CERTIFIED. Le test de zéro utilise une observation canonique connue, aucune absence artificiellement certifiée.
- Repas personnels : un repas de travail non attribué à Adrien ou Manon produit AMBIGUOUS_PERSON pour ces postes uniquement. Il ne bloque pas les courses, le tabac ou les restaurants.
- Café : sémantique existante Adrien ou personne null, sans nouvelle taxonomie.
- Mobilité : routes de travail identifiées par le propriétaire month-reference, jours canoniques referenceMobilityDays, coût commute + détour observé. Le prédicat de route a été extrait dans ce même propriétaire sans changer son calcul de forecast. Leg pertinent sans coût, aller/retour incomplet ou demi-détour empêchent de certifier le total mensuel et produisent MOBILITY_COST_UNKNOWN. Un leg d'une autre route ne bloque pas ce poste. L'adapter conserve les legs null uniquement dans un diagnostic historique additionnel, ignoré par le forecast.
- Minimum conservé : FORECAST_POLICY.minimumMonths = 3. Moins de trois mois reste INSUFFICIENT ; les trois valeurs sont null.
- Statistiques : minimum mensuel réellement observé, médiane via referenceQuantile(.5), maximum mensuel réellement observé. MinMonth/maxMonth et samples sont calculés au serveur ; en cas d'égalité, le premier mois chronologique est publié.
- L'UI affiche les trois repères et les dates des extrêmes. Si insuffisant, les trois tirets restent visibles avec N mois comparables sur 3 nécessaires. Le rail P/T ne calcule qu'une position visuelle. Aucune table de 12 mois dans le Centre, aucun travail mobile.

## Distinction avec le forecast et stabilité

Aucune modification de requiredForecastSources, completeMonthsBySource, sourceCoverage, opportunityState, FULL_MONTH_SAFE, AS_OF_TEMPORAL, ressources wallets, cash bancaire, calibration ou quantiles low/central/high. Les tests temporels existants restent inchangés.

La fixture oracle demandée reproduit les 12 montants du brief : min 251.30 (2025-12), médiane 428.89, max 662.71 (2025-09). P25 = 361.3975 et P75 = 546.8625 sont vérifiés séparément, sans être assimilés aux extrêmes.

Les six HIST-STABLE vérifient l'identité exacte du read model : P447/T403, T520, Apply403 + reload serveur en mémoire, cible, objectif global et scénario multi-postes. Apply appelle les vraies actions avec le harness synthétique existant ; aucune connexion Supabase dans ces tests.

## Audit live en lecture seule

L'audit réutilise readMonthPredictionEvidence et la projection de production. Un fetch explicite refuse toute méthode autre que GET/HEAD ; seules des requêtes GET ont été exécutées. Aucun identifiant d'opération ni détail bancaire brut dans ce rapport. Corpus : 1609 lignes économiques, dont 195 lignes purchase-aware et 11 PARTIAL ; 0 leg sans coût.

| Catégorie | Mois comparables | Min | Mois min | Médiane | Max | Mois max | Statut |
|---|---:|---:|---|---:|---:|---|---|
| groceries | 10 | 306.33 | 2026-03 | 528.77 | 712.71 | 2025-09 | AVAILABLE |
| tobacco-vape | 12 | 190.70 | 2026-01 | 315.42 | 416.95 | 2025-12 | AVAILABLE |
| household-restaurants | 8 | 19.80 | 2026-02 | 110.65 | 268.74 | 2025-09 | AVAILABLE |
| adrien-work-meals | 11 | 15.20 | 2025-08 | 50.10 | 97.30 | 2026-03 | AVAILABLE |
| manon-work-meals | 7 | 1.20 | 2026-01 | 6.25 | 42.00 | 2025-11 | AVAILABLE |
| adrien-work-coffee | 12 | 26.90 | 2026-06 | 42.33 | 56.10 | 2025-10 | AVAILABLE |
| manon-work-mobility | 1 | — | — | — | — | — | INSUFFICIENT |

### Écart avec l'oracle de rédaction

Courses live compte 10/12 mois. Avril et juillet 2026 sont PARTIAL dans le corpus canonique actuel. Les totaux des autres mois diffèrent aussi des chiffres de rédaction. L'autorité lue aujourd'hui est le corpus économique fusionné purchase-aware, qui inclut les achats et leurs états de coût ; il ne coïncide pas avec l'oracle fourni. Nous ne prétendons pas dater cet écart, et ne rétablissons pas les chiffres du brief comme vérité de production. Les chiffres 251.30 / 428.89 / 662.71 restent exclusivement un oracle de test. La mobilité ne possède qu'un mois avec des jours et détours complets ; elle reste réellement INSUFFICIENT.

### groceries

- Candidats : 2025-08, 2025-09, 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07.
- Comparables : 2025-08, 2025-09, 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-05, 2026-06.
- Exclusions : 2026-04 (PARTIAL_AMOUNT); 2026-07 (PARTIAL_AMOUNT).

### tobacco-vape

- Candidats : 2025-08, 2025-09, 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07.
- Comparables : 2025-08, 2025-09, 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07.
- Exclusions : aucune.

### household-restaurants

- Candidats : 2025-08, 2025-09, 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07.
- Comparables : 2025-08, 2025-09, 2025-10, 2025-11, 2026-01, 2026-02, 2026-05, 2026-07.
- Exclusions : 2025-12 (PARTIAL_AMOUNT); 2026-03 (PARTIAL_AMOUNT); 2026-04 (PARTIAL_AMOUNT); 2026-06 (PARTIAL_AMOUNT).

### adrien-work-meals

- Candidats : 2025-08, 2025-09, 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07.
- Comparables : 2025-08, 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07.
- Exclusions : 2025-09 (PARTIAL_AMOUNT).

### manon-work-meals

- Candidats : 2025-08, 2025-09, 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07.
- Comparables : 2025-09, 2025-11, 2026-01, 2026-02, 2026-04, 2026-06, 2026-07.
- Exclusions : 2025-08 (ZERO_NOT_CERTIFIED); 2025-10 (ZERO_NOT_CERTIFIED); 2025-12 (ZERO_NOT_CERTIFIED); 2026-03 (ZERO_NOT_CERTIFIED); 2026-05 (ZERO_NOT_CERTIFIED).

### adrien-work-coffee

- Candidats : 2025-08, 2025-09, 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07.
- Comparables : 2025-08, 2025-09, 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07.
- Exclusions : aucune.

### manon-work-mobility

- Candidats : 2025-08, 2025-09, 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07.
- Comparables : 2026-03.
- Exclusions : 2025-08 (MOBILITY_COST_UNKNOWN); 2025-09 (MOBILITY_COST_UNKNOWN); 2025-10 (MOBILITY_COST_UNKNOWN); 2025-11 (MOBILITY_COST_UNKNOWN); 2025-12 (MOBILITY_COST_UNKNOWN); 2026-01 (MOBILITY_COST_UNKNOWN); 2026-02 (MOBILITY_COST_UNKNOWN); 2026-04 (MOBILITY_COST_UNKNOWN); 2026-05 (MOBILITY_COST_UNKNOWN); 2026-06 (MOBILITY_COST_UNKNOWN); 2026-07 (MOBILITY_COST_UNKNOWN).

## Limites

Le support est le corpus canonique déjà publié dans la fenêtre existante de 12 mois ; aucune reconstruction/backfill d'un historique plus ancien. Une absence sans preuve locale de zéro est exclue. La mobilité ne prétend pas compléter les demi-trajets manquants. Les faits dont la date économique n'est pas résolue restent soumis aux limites de l'adapter canonique existant ; ce chantier ne répare pas les faits ni leur attribution.

## Validation

Commandes exécutées depuis le dépôt :

- git rev-parse HEAD ; git status --short ; git log -5 --oneline.
- node scripts/check-phase2-category-observed-history.mjs : 31/31 PASS, incluant HIST-LOCAL-001→020 et HIST-STABLE-001→006.
- node scripts/check-phase2-month-control-center-spatial-ux.mjs : 78/78 PASS.
- node scripts/check-phase2-month-control-center-choices-ux.mjs : 68/68 PASS.
- node scripts/check-phase2-month-control-center-human-ux.mjs : 53/53 PASS.
- node scripts/check-phase2-month-control-center.mjs : 85/85 PASS.
- node scripts/check-phase2-month-narrative.mjs : PASS.
- node scripts/check-phase2-temporal-forecast.mjs : 63 PASS.
- node scripts/check-phase2-forecast-temporal-mode.mjs : 13 PASS.
- node scripts/check-phase2-category-targets-choices.mjs : 36 PASS.
- node scripts/check-phase2-month-control-center-v4.mjs : 52/52 PASS.
- node scripts/check-phase2-month-control-center-v5.mjs : 38/38 PASS.
- node --experimental-strip-types scripts/check-global-v2-frontend.mjs : 728/728 PASS ; RuntimeSchemas 71/71 PASS.
- node scripts/check-architecture-imports.mjs : PASS, 776 fichiers.
- node node_modules/typescript/bin/tsc --noEmit : PASS.
- node node_modules/next/dist/bin/next build : PASS.
- git diff --check : PASS.
- node --env-file=.env.local scripts/audit-phase2-month-control-history-v5.mjs ../../evidence/category-history-local-live.json : PASS, GET uniquement.
- node node_modules/next/dist/bin/next start --port 3001 : navigateur sur la version de production compilée, lecture des repères Courses et mobilité insuffisante. Aucun formulaire enregistré. Serveur et onglet temporaires fermés.

Quelques suites d'Apply avaient initialement besoin d'une clé Undo non configurée dans le shell. Elles ont été relancées avec SUPABASE_SECRET_KEY=synthetic-history-regression-only (jamais une clé live). Le harness interdit les tables historiques. Le vieux test V5 exigeant encore zéro mois avec BANK seul a été corrigé pour attendre les six mois économiques connus ; aucune attente temporelle n'a été modifiée.

Browser : Courses affiche 306 / 529 / 713 € avec mars 2026 et sept. 2025, 10 mois comparables. Mobilité affiche les trois tirets et 1 mois comparable sur 3. Vue PC 1280 × 720, aucun élément avec overflow vertical auto/scroll : PASS. Conteneur Courses clientHeight = scrollHeight = 688. Capture Courses conservée hors Git ; la seconde capture mobilité n'a pas pu être enregistrée, mais son état DOM et la mesure sans scroll ont été vérifiés. Aucun test mobile ni responsive.

Évidence brute et captures privées conservées hors Git : C:/Users/Manon/Documents/Codex/2026-09-28/ve/evidence/. L'audit est reproductible avec node --env-file=.env.local scripts/audit-phase2-month-control-history-v5.mjs [fichier-externe]. Les tests utilisent exclusivement des fixtures en mémoire.

MIGRATION_REQUIRED = NO
ZERO_HISTORICAL_WRITE = YES
ZERO_MONTH_INPUT_WRITE = YES (live ; Apply synthétique en mémoire uniquement)
ZERO_OPERATION_WRITE = YES
