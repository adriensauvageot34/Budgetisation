# Phase 2 — moteur temporel / as-of

Date : 2026-10-03. Références : prompt d’implantation, spécification technique finale et référence canonique fournis par l’utilisateur. Mini-audit limité aux propriétaires du scénario, aux sources canoniques, à leur couverture et aux frontières de persistance.

```text
HEAD_BEFORE = 78266b361fb5b9c35408e8e0a5664c13c0c5d549
HEAD_AFTER = commit unique portant ce rapport (git log -1)
MIGRATION_REQUIRED = NO
LIVE_SUPABASE_WRITES = 0
```

## Propriétaires et contrat

| Sujet | Implantation / source de vérité |
| --- | --- |
| Evidence | `month-prediction-evidence.ts` : Banque canonique + PurchaseEvents, exclusion des Operations représentées, Need/personne prioritaires, dates économiques canoniques des achats, pagination et foyer vérifié avant les relations historiques sans household_id. |
| Temps / couverture | `forecast-opportunities.ts` : date civile du foyer, aujourd’hui réalisable, intervalles continus par source, arrêt au premier trou, Bank safeThrough = coverageThrough − 3 jours. Une couverture fournie est aussi ramenée au cutoff du calcul. |
| Forecast restant | `forecastRemainingMonth()` reste seul propriétaire. Cinq mois calendaires antérieurs disponibles ; ni mois courant ni observations futures dans l’apprentissage. Les séries rares peuvent utiliser les mois plus anciens déjà fermés du corpus, avec faible confiance explicite. |
| Opportunités | Read model non persisté : Future, Planned, Pending, Observed, Expired, Cancelled, Unresolved. Les observations et intentions explicites priment. Seule une couverture suffisante des sources requises permet Expired ; un planning explicitement hors site permet Cancelled. |
| Charges certaines | `reconcileFixedOccurrences()` : récurrence/contrat exact, ou marchand/montant/fenêtre exacts et candidat unique. Le réel remplace l’attendu. Une échéance passée sans débit reste intégralement réservée. |
| Travail | Journées repas/café et déplacements ; priors de présence par weekday et achat conditionnel à la présence. Un planning fourni prime. Repas Manon : fréquence non identifiable sans Edenred, hypothèse explicite et LOW_COVERAGE. Mobility : coût d’usage, Bank = 0. |
| Restaurants | Sessions économiques, quantiles de fréquence et prix, positions dans le mois et exposition weekday. Un root/module compatible occupe une session, même avec plusieurs CostItems. |
| Courses | Queue historique cumulative. Correction conditionnelle bornée seulement à partir de J15 avec preuve bancaire ; poids choisi par validations chronologiques internes sur les seuls mois antérieurs. Aucun prorata linéaire. |
| Tabac / cannabis / vape | Trois cadences distinctes, délais/tickets observés et remise à zéro après achat. Une absence prouvée avance l’âge sans inventer de renouvellement. Vape rare : prochaine recharge probabiliste bornée et faible confiance. |
| Réconciliation | Helper partagé `planned-observation-reconciliation.ts`, identité économique unique, composants regroupés avec contrôle de cohérence. Lien confirmé facultatif dans `context.realityLink`, existence/foyer/cohérence vérifiés au serveur. Aucun fuzzy ; aucune fusion ambiguë. Un achat partiel n’est pas utilisé comme montant réel complet. |
| Funding | Banque/Swile/Edenred séparés ; historique suffisamment couvert requis. Source impossible = zéro ; source éligible non identifiable = UNKNOWN et borne, avec limites explicites. |
| Cash | `bank-cash-projection.ts`, appelé par `deriveMonthScenario()` : stock daté + revenus non reçus − charges non débitées − achats/déclarations non débités − financement bancaire intégral des projets − quotidien/extras bancaires restants. Aucune remise de cash issue de l’absorption. |
| Rollover | Lecture des observations `openingBalance` des inputs du foyer, seule l’observation de stock est retenue. Reconstruction uniquement avec ledger Bank continu et transferts réciproques neutralisables. Les périodes non effectivement lues ne peuvent certifier le ledger. Aucun report créé comme revenu. |
| Mémoire | Checkpoints immuables existants, nouvelle version `month-asof@v1/purchase@v1/coverage@v1/opportunity@v1`, buckets/coverage/limits/cash et garde de taille. Calibration des mois fermés, versions compatibles, toutes les sources de catégorie complètes et sans intention utilisateur perturbant la comparaison. La complétude bancaire exige aussi la grâce de fin de mois. |
| UI | Cartes existantes : observé / déclaré / explicitement prévu / attente / futur. Totaux de sections = restant. Charges dues/débitées distinctes. Solde réel séparé des ressources économiques. Cash partiel conserve les composants connus et un repère économique explicite. Projets/calendrier montrent le réel et l’écart, sans nouveau statut DB ni événement dupliqué. |

Les helpers demeurent `server-only` et sans mutation. Le resolver de domaine partagé et le moteur Transport existants sont conservés. React consomme les valeurs résolues ; aucune nouvelle règle financière n’y est calculée. Revue React : hooks inchangés, mises à jour fonctionnelles du draft, invalidation de Preview au changement de lien, imports serveur de types uniquement côté client, disclosures/labels conservés.

## Compatibilité et persistance

Pas de table, trigger, index, FK, policy RLS ou job ajouté. Statuts persistés : `PLANNED`, `DECLARED_REALIZED`. `OBSERVED` est uniquement dérivé. Les anciennes rows restent lisibles sans lien de réalité. Les écritures du produit restent limitées aux authorities prospectives existantes ; la réconciliation ne modifie pas sa cible historique.

Shims conservés et identifiés : `observedThrough` alias de `latestObservedBookingDate` ; champs économiques existants des catégories/Preview ; référence publiée pour un snapshot ancien sans evidence locale et pour un historique restaurant trop faible. La référence publiée n’est pas traitée comme une trajectoire bancaire certifiée. Les nouveaux checkpoints ne calibrent pas les anciennes versions.

## Données live : limites constatées pendant le mini-audit

- 0 dépense prospective à l’audit ; aucune fixture de ce lot écrite en Supabase.
- Swile : import PARTIAL. Edenred : pas d’historique importé. Aucun batch BANK FULL ne certifie la continuité bancaire actuelle.
- Les périodes Mobility existantes ne portent pas d’assertion de complétude ; absence de leg ≠ télétravail.
- Aucun solde bancaire direct dans les comptes. Sans observation manuelle datée ou reconstruction prouvée, le disponible réel est UNKNOWN.

Ces faits restent visibles comme limites ; ils ne deviennent pas des zéros ou des expirations artificielles.

## Backtest déterministe

Fixture : `scripts/fixtures/phase2-temporal-backtest-v1.json`, agrégats journaliers du corpus canonique d’août 2025 à juillet 2026 : 537 lignes économiques et 180 journées de déplacement complètes. Aucun UUID réel, libellé de marchand, compte, transaction brute ou credential. Les clés de personne sont uniquement celles des modèles demandés.

42 calculs : janvier → juillet 2026, J1/J5/J10/J15/J20/J25. Benchmark mensuel médian reconstruit sur le même historique antérieur ; aucun ancien comportement considéré comme oracle. La couverture de cutoff est une simulation explicitement `ORACLE_OBSERVATION_CUTOFF_SIMULATION`, pour évaluer l’économie sous observation idéale. Elle ne certifie ni les imports live, ni Edenred, ni le financement Benefit, ni le cash bancaire complet. Repas Manon exclu de la calibration.

| Mesure | Résultat |
| --- | ---: |
| MAE temporel global | 114,38 € |
| MAE benchmark | 162,94 € |
| Amélioration | 29,80 % |
| J1 / J5 / J10 | 151,14 / 145,82 / 128,44 € |
| J15 / J20 / J25 | 81,31 / 96,02 / 83,54 € |

La moyenne ne décroît **pas strictement** à chaque horizon : J20 remonte de 14,71 € par rapport à J15. Le gate toléré utilise les différences appariées par mois : `max(5 €, t(95 %, df=6) × erreur standard)`, annoncé dans le script et le JSON. Tolérances J25/J20, J20/J15, J15/J10 : 51,09 / 74,41 / 58,59 €. Le résultat est PASS avec cette tolérance d’échantillonnage sur sept mois ; aucune de ces bornes n’est un intervalle produit calibré. Toutes les six catégories économiques évaluées améliorent leur MAE face au benchmark. L’estimation de fin de mois bancaire n’est pas historiquement certifiée par ce backtest.

Preuve complète : `phase2-temporal-asof-backtest.json`. Le script reste exécutable via `backtest:phase2-temporal-forecast`.

## Commandes et résultats

Exécutables Node/Python du runtime fourni par Codex ; commandes ci-dessous équivalentes aux scripts du package. Aucun service Supabase local démarré.

| Commande | Résultat |
| --- | --- |
| `node scripts/check-phase2-temporal-forecast.mjs` | PASS — 63 contrôles unitaires/intégration/UI, cutoff de couverture et planning de travail le week-end inclus. |
| `node scripts/backtest-phase2-temporal-forecast.mjs` | PASS — 42 runs ; chiffres et tolérance ci-dessus. |
| `node scripts/check-phase2-month-narrative.mjs` | PASS — assertions adaptées au restant réel et à la couverture, sans conserver l’ancienne disparition du passé comme oracle. |
| `node scripts/check-phase2-planned-finance.mjs` | PASS — économique, absorption, financement et libellés cash séparés. |
| `node scripts/check-phase2-planned-reliability.mjs` | PASS — Preview/Save, idempotence, CAS, payload altéré et zéro write en Preview. |
| `node scripts/check-phase2-planned-reality.mjs` | PASS — déclaration atomique, correction, report, restauration, suppression. Assertion de libellé alignée sur « Prévue · à confirmer ». |
| `node scripts/check-phase2-planned-guards.mjs` | PASS — 15 probes ciblés, aucune écriture historique des actions. |
| `node scripts/check-phase2-planned-domain.mjs` | PASS — domaines/registries/graph/assets/places. |
| `node scripts/check-phase2-planned-server-contract.mjs` | PASS — parsing, context, graph, assets, finance, références live et forme migration existante. |
| `node scripts/check-phase2-planned-routes.mjs` | PASS — routes, lieux child, trajets dirigés, carburant économique. |
| `node scripts/check-phase2-planned-car.mjs` | PASS — Peugeot 207, providers, carburant/cash, parité et zero-write. |
| `node scripts/check-c2-purchase-aware.mjs` | PASS — 61/61. |
| `node scripts/check-c4-purchase-aware.mjs <source.xlsx> <master.xlsx> <fixture-dir>` | Mode complet tenté : `RangeError: Array buffer allocation failed` pendant la comparaison globale existante. Mode réduit `C5_FAST=1` : PASS des 36 oracles financiers C4 + certification C5 PASS. Égalité du candidat global : NOT_TESTED dans ce mode. |
| `node scripts/check-architecture-imports.mjs` | PASS — 739 fichiers. |
| `node node_modules/typescript/bin/tsc --noEmit` | PASS. |
| `node node_modules/next/dist/bin/next build` | PASS — compilation, TypeScript et génération des routes. |
| Lint | NOT_CONFIGURED — aucun script lint dans ce dépôt. |

Pour C4 : workbooks finaux Swile fournis, snapshot privé canonique revision 8 déjà disponible, Python/openpyxl existant, PGlite 0.3.14 réutilisé via le cache dans un répertoire temporaire hors dépôt. Le harness a été raccordé aux noms exacts du DTO canonique et au batch importé dans la base jetable ; `.single()` du client de fixtures respecte désormais le refus si le nombre de rows diffère de un. Les 36 comparaisons monétaires sont obligatoires dans tous les modes. Aucun oracle économique n’a été changé pour obtenir PASS, aucun snapshot privé n’est committé.

Preuve des 63 cas : `phase2-temporal-asof-tests.json`. Les suites passent par les actions authentifiées existantes, parser, resolver, financement, CRUD prospectif et reload en mémoire ; l’UI est rendue via les composants de production. Aucun test navigateur ou Vercel n’est revendiqué dans ce lot.

## Invariants prouvés

- Planned 40 + réel 42,50 : 42,50 économique ; écart 2,50 ; projet prévu retiré du restant, provenance déclarée conservée.
- Fixe 47 + débit 48,20 : 48,20 économique ; aucun second débit à réserver après le solde.
- Salaire reçu : zéro futur revenu rejoué après le stock.
- PurchaseEvent observé mais Bank non booké : montant bancaire actualisé réservé une seule fois, avec ou sans lien Planned ; UNKNOWN si financement non établi.
- Bank absent/Swile unsafe/Edenred absent/Mobility unsafe : pas d’Expired injustifié.
- Preview et Save/reload : mêmes scénarios, absorption, buckets, funding et cash, sans écritures historiques.
- Liens étrangers, incohérents, partiels, composantes mixtes ou déjà revendiqués : aucun rapprochement utilisateur accepté comme preuve unique valide.

## Limites / suites

Repas Manon reste LOW_COVERAGE. Importer Edenred et des preuves Bank/Mobility FULL sera nécessaire pour lever les attentes non tranchables. Le planning futur explicite est supporté par le read model lorsqu’une autorité le fournit ; aucune nouvelle table de planning n’est créée ici. Un projet composite sans preuve globale cohérente reste non fusionné plutôt que rapproché approximativement.

Les comptes à débit différé, pending natifs et coût restaurant par personne restent NON ÉTABLIS sans source. Les 3 jours sont une grâce transaction → booking, pas une garantie d’import. Les projections d’un autre mois ne revendiquent pas de bridge cash complet depuis aujourd’hui. Les bornes économiques sont exploratoires en l’absence de checkpoints suffisants ; les bornes bancaires ne sont pas affichées comme calibrées.

Suites : alimenter les sources et observations de solde, accumuler des checkpoints compatibles sur des mois entièrement couverts ; rejouer la comparaison globale complète C4 sur un poste disposant de davantage de mémoire. Aucun job de rollover ni migration préventive nécessaire.
