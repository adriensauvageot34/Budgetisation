# Phase 2 — Swile et Edenred : soldes datés, flux et capacité

Date : 2026-10-04. Base vérifiée : `3cdb6d1edf93c12b05a248ea2948ebb99a5dd516`, sur `main`, initialement propre. Le commit contenant ce rapport porte l’implémentation ; aucun retour arrière.

## Mini-audit demandé

Le mini-audit a été limité aux propriétaires mensuels, forecast, PlannedExpense, actions et UI cités par le prompt, aux deux migrations de référence et aux checkers demandés. Le contrat présent avait un `benefit` générique utilisé comme Swile dans le formulaire, deux `declaredResources` mensuelles, un funding prospectif par provider et des wallets/ledger canoniques déjà pourvus d’une couverture et d’un propriétaire. Aucune nouvelle table n’est nécessaire.

## Propriétaires de la doctrine

- `domain/phase2/benefit-wallets.ts` : contrat partagé, provider strict, montants positifs ou nuls, dates civiles réelles, ordre déterministe, unicité provider/date, observations de départ explicitement marquées, date du chargement nullable. Les dates hors mois sans marqueur de départ sont refusées dans le scénario et avant la persistence.
- `domain/phase2/benefit-wallet-policy.ts` : configuration du foyer, EUR, plafond journalier 25 €, lundi à samedi. Dimanche non éligible. Le helper reçoit une autre configuration si nécessaire ; aucune prétention de règle légale universelle.
- `server/phase2/benefit-wallet-funding.ts` : unique calcul des soldes et de la faisabilité datée. Les helpers sont purs et ne font aucun appel Supabase. La finance économique mensuelle reste dans `month-scenario.ts`.
- `server/phase2/month-prediction-evidence.ts` : lecture seule et scoping household de la nouvelle lecture du ledger. Les preuves FULL doivent appartenir au provider et au batch ou à l’instance du wallet. Une couverture Banque ou celle d’une autre carte ne suffit pas. Les balances canoniques doivent être KNOWN et les crédits/débits EUR. Le ledger est paginé, ordonné et limité à asOf.
- `server/phase2/month-inputs.ts` et `app/mois-a-venir/actions.ts` : stockage prospectif existant et actions authentifiées. Aucune écriture dans les wallets, ledger, purchase events, funding canonique ou operations.
- Composants React : affichage des read models, formulaires et contrôles accessibles. Aucune doctrine de stock, financement ou calendrier calculée dans React, aucune nouvelle dépendance et aucun redesign global.

## Compatibilité sans migration

`MIGRATION_REQUIRED = NO`. Le JSON `phase2_month_inputs.payload` accueille `benefitWallets.SWILE` et `.EDENRED`.

Ancien `benefit.currentBalance` et `benefit.expectedLoading` → Swile uniquement. Sans loading générique, les anciennes ressources mensuelles fournissent le flux de chaque provider, sans inventer une date. Le nouveau format devient autoritaire : le champ générique est seulement un shim de lecture dérivé, absent des nouveaux payloads sauvegardés. `declaredResources` est un miroir du flux ; les overrides existants gardent leur sémantique explicite et sont utilisés aussi dans la projection wallet. Le vieux formulaire `save-benefit` reste accepté.

Les actions provider-aware ajoutent/corrigent une observation, la suppriment, enregistrent ou retirent un chargement. Corriger la même date conserve son ID ; les autres dates et l’autre provider restent intacts. La suppression ne concerne que les inputs utilisateur du provider demandé. Aucun mécanisme ne déduit un chargement d’un delta de soldes.

## Stock et connaissance à asOf

1. Observation manuelle exactement à asOf → `KNOWN_AT_ASOF`.
2. Observation antérieure + ledger FULL continu du même wallet jusqu’à asOf → `RECONSTRUCTED`.
3. Closing canonique KNOWN à asOf, ou ancre opening/closing avec preuve ledger complète → état connu/reconstruit.
4. Sinon → `OBSERVED_STALE` ou `UNKNOWN`, avec montant courant nullable et dernière observation conservée.

Une observation est traitée comme un stock à sa date civile ; le ledger de reconstruction commence le lendemain. L’ouverture canonique est un stock de début de journée : ses mouvements du jour sont inclus. Les IDs de ledger dédupliquent les mouvements ; la monnaie ou une carte inactive invalide la reconstruction. Plusieurs cartes actives d’un même provider rendent l’owner et la reconstruction ambigus, sans choix arbitraire.

34 € le 1er puis 224 € le 8 donnent **224 €**, jamais 258 €. Chargement mensuel 190 € avec observation 224 € au même jour/après chargement donne **224 €**, jamais 414 €. Le flux économique reste 190 € avec sa propre déclaration. Les chargements déjà datés avant/asOf ne sont pas ajoutés au stock courant ; un chargement futur daté ouvre de la capacité à sa date, et une date inconnue ne crée aucune capacité certaine.

Les observations de départ antérieures peuvent être lues d’un autre mois, sans copier ses chargements, salaires ou hypothèses. Une observation ancienne sans ledger complet reste ancienne. Le solde reste consultable même si le flux économique du mois n’a pas encore été complété.

## Capacité et financement

- Plafond commun par provider/date, partagé entre CostItems et PlannedExpenses. Les débits canoniques observés ce jour réduisent le plafond restant ; ils ne sont pas retirés une seconde fois du stock observé.
- 224 € et quatre jours éligibles donnent une capacité maximale de 100 €.
- 18 € + 12 € le même jour donnent au plus 25 € supportables et 5 € de shortfall.
- 30 € un dimanche donnent 0 € supportable avec cette configuration, sans modifier les allocations choisies.
- Une intention sans date ou passée reste conservée et réservée prudemment, avec financement à confirmer. Cette réserve continue à s’appliquer aux chargements futurs.
- Stock inconnu → capacité/support nullable. Un dépassement de plafond peut rester prouvé ; la totalité du funding non certifié est signalée comme à compléter. L’inconnu ne devient pas zéro ni allocation Banque persistée.

Les projets supportables ont priorité sur le forecast personnel. Celui-ci utilise seulement `benefit_wallets.owner_person_id`, les personnes canoniques, les opportunités datées existantes, le stock, les dates de chargement et la policy. Les scénarios low/central/high partagent chacun leurs budgets wallet/date. L’échange des propriétaires Swile/Edenred dans les fixtures échange leur financement : aucun mapping provider/personne n’est hardcodé.

Repas estimés 40 € sur cinq dates et stock connu 30 € → Benefit potentiel 30 €, reste Banque/autre 10 €. Stock ou propriétaire inconnu → Banque non certifiée et financement à compléter. La portion économique sans opportunité datée exploitable reste également UNKNOWN. Aucune nouvelle éligibilité automatique n’est introduite pour courses, cafés ou restaurants du foyer ; leurs règles historiques existantes restent en place.

`FULL_MONTH_SAFE` demeure le défaut et ne réduit pas les habitudes par passage du temps. `AS_OF_TEMPORAL` reste réactivable. L’enrichissement porte sur le funding : coûts économiques, buckets temporels, projets, marginalité et cagnottes restent inchangés.

## UI et checkpoints

Deux formulaires Swile/Edenred dans « Améliorer la précision du mois » : historique daté, ajout/correction, suppression, chargement mensuel avec date facultative. « Nos ressources » affiche le flux principal et le stock observé en secondaire, sans addition. Le détail funding distingue stock, capacité, allocation, réservation des projets prévus, usage déclaré, estimation des repas, restant et financement à confirmer.

Nouveaux checkpoints : champs optionnels versionnés `benefit-wallets@v1`. Les anciens restent lisibles et immuables. La comparaison économique conserve ses termes et ne fabrique aucun delta dû au seul enrichissement wallet. Un changement de niveau de connaissance, de balance ou d’owner produit une explication de non-comparabilité du funding avec l’ancien checkpoint.

## Vérifications exécutées

Toutes les commandes ci-dessous utilisent le runtime Node installé sur le poste. Les tests de transport/persistence utilisent des fixtures synthétiques en mémoire ; aucune connexion ni écriture Supabase live.

| Commande | Résultat |
| --- | --- |
| `node scripts/check-phase2-benefit-wallets.mjs` | PASS — 36 preuves WALLET-001 à WALLET-036. |
| `node scripts/check-phase2-savings-allocations.mjs` | PASS — 21 contrôles. |
| `node scripts/check-phase2-october-contract.mjs` | PASS — contrat économique, overrides et restauration. |
| `node scripts/check-phase2-month-narrative.mjs` | PASS — narration, anticipation, parité, zero-write. |
| `node scripts/check-phase2-planned-finance.mjs` | PASS — finance, baseline, carburant économique et absence de réallocation Banque. |
| `node scripts/check-phase2-planned-reliability.mjs` | PASS — Preview/Save, idempotence, CAS, altération et actualisation des inputs. |
| `node scripts/check-phase2-planned-guards.mjs` | PASS — probes ciblés sans écriture historique. |
| `node scripts/check-phase2-planned-routes.mjs` | PASS — lieux enfants, routes dirigées, carburant et provenance. |
| `node scripts/check-phase2-project-wizard.mjs` | PASS — parcours, invalidation, lifecycle, parité et références étrangères. |
| `node scripts/check-phase2-forecast-temporal-mode.mjs` | PASS — 13 contrôles, SAFE par défaut et mode temporel. |
| `node scripts/check-phase2-temporal-forecast.mjs` | PASS — 63 contrôles, couverture, déduplication purchase-aware, cash, lifecycle, adapter et UI. |
| `node scripts/check-architecture-imports.mjs` | PASS — 746 fichiers. |
| `node node_modules/typescript/bin/tsc --noEmit` | PASS. |
| `node node_modules/next/dist/bin/next build` | PASS — compilation, TypeScript et génération des 8 pages statiques. |
| `git diff --check` | PASS avant commit. |
| `node scripts/check-c3-swile-staging.mjs` | NON REJOUÉ — invocation arrêtée sur Usage ; nécessite source/master XLSX, destination du rapport et `PGLITE_MODULE_PATH`. |
| `node scripts/check-c4-purchase-aware.mjs` | NON REJOUÉ — invocation arrêtée sur Usage ; nécessite source/master XLSX, fixture-dir, `PGLITE_MODULE_PATH` et `SWILE_PYTHON`. |

Les classeurs et fixtures de C3/C4 n’ont pas été fournis aux commandes dans ce chantier ; les deux variables requises ne sont pas configurées dans le shell. Aucun PASS d’import réel n’est revendiqué. Les oracles offline pertinents sont rejoués : suite temporelle purchase-aware/anti-double-count, adapter canonique réel en lecture seule et nouvelle suite wallet couvrant ledger, couverture par instance, propriétaire et devises.

Deux assertions historiques ont été adaptées au nouveau contrat, puis les suites rejouées : FIN-08 vérifie désormais que le flux de 40 € n’est pas un stock, que le cap prouve 35 € de dépassement sur une allocation de 60 €, et que les 60 € restent à confirmer en l’absence de stock ; C6 vérifie l’actualisation du flux, sans exiger un changement du shortfall quand le stock demeure inconnu. Les autres invariants n’ont pas été affaiblis.

Preuves structurées : [phase2-benefit-wallets-tests.json](phase2-benefit-wallets-tests.json). Les résultats bruts temporaires restent hors du commit. Aucun test navigateur ou Vercel n’est revendiqué.

## Limites et suites

- Reconstruction exacte uniquement avec ledger complet et couverture de la bonne carte. Des données incomplètes restent UNKNOWN ; aucune certification live de leur disponibilité n’est revendiquée.
- Une seule carte résolue par provider en V1 ; plusieurs cartes actives demandent une résolution explicite future.
- Les chargements futurs sont des déclarations prévisionnelles, pas une preuve de réception ni une prédiction par delta de balance.
- Avec calendrier insuffisant, propriétaire inconnu ou stock non certifiable, le financement personnel reste à compléter. Les hypothèses économiques SAFE ne disparaissent pas.
- Aucun changement RLS, table, trigger, historique, mémoire personnelle, moteur temporel, recalibrage d’habitudes ou traitement mobilité. La garde bancaire de périmètre des cagnottes reste intacte.
- Page annuelle, administration de policies, moteur légal universel, multi-devise, cashback et réconciliation bancaire globale : différés comme demandé.
- Ancien échec `shift = DOWN` de `check-phase2-month-decision-engine.mjs` documenté dans `phase2-full-month-safe-mode.md` : hors périmètre, non rejoué et non annoncé PASS.

```ini
MIGRATION_REQUIRED = NO
WALLET_MODEL = PASS
BALANCE_RESOLUTION = PASS
BENEFIT_FLOW_VS_STOCK = PASS
NO_LOADING_DOUBLE_COUNT = PASS
OWNER_RESOLUTION = PASS
WALLET_CAPACITY = PASS
BANK_FALLBACK_GUARD = PASS
FULL_MONTH_SAFE = PASS
AS_OF_TEMPORAL = PASS
ZERO_HISTORICAL_WRITE = PASS (fixtures ; zéro écriture live)
PREVIEW_SAVE_PARITY = PASS (actions réelles, fixtures)
BROWSER_USER_FLOW = NOT_TESTED
```
