# Phase 2 — cagnottes et argent mis de côté

Date : 2026-10-04. Base : `2670143b8a8f39ad7cb7a82e31aa14c4590f997a`, sur `main`.

## Mini-audit et propriétaires

Le mini-audit demandé confirme que `MonthInputs.declaredOutflows` contenait les lignes `SAVINGS`, ajoutées par `month-scenario.ts` aux charges du groupe Épargne. `month-story.tsx` les affichait dans les charges certaines ; le calendrier consommait ces mêmes charges. L'audit a été limité aux propriétaires mensuels, bancaires, décisionnels, persistés et à leurs contrôles demandés.

- [savings-allocations.ts](../../src/domain/phase2/savings-allocations.ts) : contrat partagé et parsing des métadonnées, sans calcul financier. `SavingsAllocation` expose `adjustability`, `source` et `annualGoalRef`.
- [month-scenario.ts](../../src/server/phase2/month-scenario.ts) : seul propriétaire des totaux et de la chaîne mensuelle. Les cagnottes sortent des charges et de leur réconciliation bancaire. Toutes les projections aval repartent d'`afterSavingsAllocations`.
- [month-inputs.ts](../../src/server/phase2/month-inputs.ts) : persistence existante conservée, avec le parsing étendu. Le JSON garde `declaredOutflows` et `kind: SAVINGS`. Aucune colonne ni table ne change.
- [bank-cash-projection.ts](../../src/server/phase2/bank-cash-projection.ts) : réservation budgétaire séparée du stock bancaire. Aucune opération de transfert n'est inventée.
- [month-decision-projection.ts](../../src/server/phase2/month-decision-projection.ts) : couche visible Cagnottes ; la variation Projets commence après cette couche. Les cagnottes ne sont pas des hypothèses comportementales.
- [forecast-memory.ts](../../src/server/phase2/forecast-memory.ts) : champs optionnels versionnés `month-budget-layers@v2`, ajoutés aux nouveaux checkpoints. Les identifiants des termes signés d'épargne restent identiques, sans faux changement dû au reclassement. Les anciennes rows restent lisibles et immuables.
- [actions.ts](../../src/app/mois-a-venir/actions.ts), [month-story.tsx](../../src/app/mois-a-venir/month-story.tsx), [month-savings-section.tsx](../../src/app/mois-a-venir/month-savings-section.tsx) : ajout/suppression authentifiés, formulaire minimal, section générique et jalon Après nos cagnottes. React reçoit les totaux calculés par le serveur.

## Compatibilité et contrat futur

Les anciennes lignes sans métadonnées deviennent `PROTECTED`, `MONTH_INPUT`, `annualGoalRef: null`. Le libellé existant Épargne voyage est préservé ; aucun nom Voyage n'est hardcodé dans la doctrine ou la section.

Une ligne `ADJUSTABLE` retire également son montant du budget mensuel, sans moteur de compensation automatique. Les hypothèses actuelles ne peuvent pas cibler une cagnotte. `ANNUAL_PLAN` exige une référence non vide ; seule la forme du futur contrat est préparée, sans nouvelle table, fausse référence enregistrée ou page annuelle. L'action actuelle crée des contributions `MONTH_INPUT`.

`MIGRATION_REQUIRED = NO`. Les règles RLS, snapshots canoniques, références historiques, moteur temporel, absorption, funding, lifecycle, transport et traitement économique du carburant sont conservés.

## Contrat numérique d'octobre

| Couche | Montant |
| --- | ---: |
| Ressources économiques | 3 928,99 € |
| Charges certaines | 847,23 € |
| Après nos charges certaines | 3 081,76 € |
| Cagnottes | 1 200,00 € |
| Dont protégées | 1 200,00 € |
| Dont ajustables | 0,00 € |
| Après nos cagnottes | 1 881,76 € |

Les trois projections de référence demeurent 1 170,76 € / 915,83 € / 555,76 €. La réserve de 1 200 € ne devient pas de la consommation et ne réintègre pas le budget de vie. Les cagnottes sont absentes des charges du calendrier, avec ou sans date ; leur section est le propriétaire visuel principal.

## Stock bancaire et protection du double compte

`currentRealBankBalance` reste l'observation originale, avant ou après un éventuel transfert. `savingsBudgetReservation` indique séparément la réservation mensuelle connue. Le contrat actuel de solde n'offre aucune preuve d'inclusion/exclusion du Livret A ; une réservation positive rend donc `afterSavings` bancaire et les valeurs dépendantes `UNKNOWN`, avec `BANK_BALANCE_SAVINGS_SCOPE_UNRESOLVED`. Aucun retrait bancaire supplémentaire ni rapprochement de virement fictif n'est calculé. Les composants bancaires connus restent visibles ; le budget mensuel après cagnottes reste calculable.

## Vérifications exécutées

Commandes exécutées avec le runtime Node fourni au poste ; pas de réseau Supabase dans les fixtures.

| Commande | Résultat |
| --- | --- |
| `node scripts/check-phase2-savings-allocations.mjs` | PASS — 21 contrôles SAVE-001 à SAVE-021. |
| `node scripts/check-phase2-october-contract.mjs` | PASS — chaîne d'octobre, finale inchangée, overrides et restauration. |
| `node scripts/check-phase2-month-narrative.mjs` | PASS — narration, modèles temporels, marginalité, parité et zero-write. |
| `node scripts/check-phase2-month-decisions.mjs` | PASS — ancien JSON, exclusions et décisions explicites. |
| `node scripts/check-phase2-planned-calendar.mjs` | PASS — calendrier, lifecycle et synchronisation des projections. |
| `node scripts/check-phase2-planned-finance.mjs` | PASS — financement, absorption et carburant sans Bank allocation. |
| `node scripts/check-phase2-forecast-temporal-mode.mjs` | PASS — 13 contrôles, défaut FULL_MONTH_SAFE et AS_OF_TEMPORAL réactivable. |
| `node scripts/check-phase2-temporal-forecast.mjs` | PASS — 63 contrôles existants du moteur temporel. |
| `node scripts/check-phase2-planned-reliability.mjs` | PASS — parité, idempotence, CAS, altération, dérive live simulée. |
| `node scripts/check-phase2-planned-guards.mjs` | PASS — 15 probes d'écritures, uniquement prospectives. |
| `node scripts/check-architecture-imports.mjs` | PASS — 742 fichiers. |
| `node node_modules/typescript/bin/tsc --noEmit` | PASS. |
| `node node_modules/next/dist/bin/next build` | PASS — compilation, TypeScript et 8 pages statiques générées. |
| `git diff --check` | PASS. |

Les nouvelles preuves utilisent le vrai parser, le vrai stockage mensuel, les actions authentifiées et les actions PlannedExpense, avec des transports en mémoire : 5 écritures mensuelles et 2 créations prospectives, aucune écriture historique/live. Preview n'écrit rien ; Save et reload restituent la même projection dans les deux modes. Les anciens formulaires sans protection restent valides. Les métadonnées invalides sont rejetées avant persistence. Le rendu serveur prouve la section, les protections, le formulaire et l'ordre de la narration. Aucun test navigateur/Vercel n'est revendiqué.

La vérification React conserve un composant serveur, les contrôles HTML libellés, les Server Actions authentifiées, les clés stables et les classes existantes ; aucun calcul de doctrine, effet ou nouvelle dépendance côté client.

Preuve structurée : [phase2-savings-allocations-tests.json](phase2-savings-allocations-tests.json). Les fichiers temporaires générés restent hors du commit. Le checker live `check-phase2-month-forecast.mjs` a été adapté aux nouvelles couches, sans être exécuté sur Supabase.

## Limites et suites

- Le périmètre du solde bancaire observé et les virements internes restent à réconcilier dans un chantier ultérieur explicite. L'inconnu n'est pas un zéro.
- Page annuelle et moteur Explorer nos choix utilisant les allocations ajustables : différés comme demandé.
- L'échec ancien `shift = DOWN` de `check-phase2-month-decision-engine.mjs` demeure documenté dans [phase2-full-month-safe-mode.md](phase2-full-month-safe-mode.md). Ce test n'a pas été modifié ni annoncé PASS ni rejoué dans ce patch.
- Aucun audit général, backtest supplémentaire, changement RLS, schéma ou écriture historique/live n'a été effectué.

```ini
SAVINGS_SEPARATED_FROM_CERTAIN_OUTFLOWS = PASS
VOYAGE_PROTECTED = PASS
AFTER_SAVINGS_LAYER = PASS
DOWNSTREAM_PROJECTION_PARITY = PASS
FULL_MONTH_SAFE = PASS
AS_OF_TEMPORAL = PASS
CURRENT_REAL_BALANCE_UNCHANGED = PASS
ZERO_HISTORICAL_WRITE = PASS
PREVIEW_SAVE_PARITY = PASS
TYPECHECK = PASS
BUILD = PASS
```
