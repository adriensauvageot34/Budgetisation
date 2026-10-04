# Phase 2 — mode produit FULL_MONTH_SAFE

Date : 2026-10-04. Patch demandé au-dessus de `d4e873ded7c26e9a14395193758796a33c31a54c`, sans revert du moteur temporel.

## Switch central

`src/server/phase2/forecast-temporal-policy.ts` est la seule source du mode actif :

```ini
DEFAULT = FULL_MONTH_SAFE
PHASE2_FORECAST_TEMPORAL_MODE = FULL_MONTH_SAFE | AS_OF_TEMPORAL
```

La variable est exclusivement serveur. Sans variable, le mode est SAFE. Une valeur inconnue est rejetée. Pour réactiver le comportement temporel, définir `PHASE2_FORECAST_TEMPORAL_MODE=AS_OF_TEMPORAL` et redémarrer/redéployer. Enlever la variable ou remettre `FULL_MONTH_SAFE` restaure le comportement prudent. Aucun changement de schéma ni donnée à migrer.

Le moteur accepte aussi un mode explicite pour les replays et tests. `temporalMode` conserve son sens existant FUTURE/CURRENT/PAST ; `forecastTemporalMode` désigne cette nouvelle politique produit.

## Calcul et invariants

`forecastRemainingMonth()` reste le seul propriétaire du restant. SAFE réutilise ses modèles historiques au premier jour du mois, sans observation courante, projet, calibration ou couverture d’expiration, pour obtenir une enveloppe mensuelle non consommée. Il soustrait ensuite les observations réelles et applique l’absorption des intentions compatibles. Une référence mensuelle publiée demeure un fallback explicite LOW si le modèle historique est trop faible pour produire une enveloppe positive.

- Passage de J1 à J18/J31 : même enveloppe comportementale tant que les faits/intents sont identiques, même si la couverture est FULL.
- La distribution attente/futur peut évoluer ; sa somme ne diminue pas par le calendrier. Aucune habitude SAFE n’est EXPIRED. Le nowcast tardif n’est pas activé.
- Réel repas 16 € sur un prior 80 € : 16 € observés + 64 € estimés, projection 80 €.
- Réel tabac 80 € sur un prior 300 € : 220 € estimés. Projet compatible 40 € : 180 € estimés + 80 € observés + 40 € explicites.
- Restaurant prévu 50 € sur un prior 30 € : absorption 30 €, impact supplémentaire 20 €, financement Bank du projet 50 €.
- Une réconciliation Planned/Observed conserve seulement le réel. Une déclaration modifie le bucket, sans être assimilée à un débit bancaire.
- Offsite explicitement fourni peut modifier le modèle : c’est une intention, jamais une absence de GPS interprétée comme télétravail.

Les branches temporelles de courses, cadences, sessions et journées sont conservées. Le backtest AS_OF_TEMPORAL reproduit exactement les 42 résultats économiques de `d4e873d` : MAE 114,38023809523818 €, benchmark 162,93714285714304 €, amélioration 29,801004185078707 %. Cette preuve porte sur la réactivation du modèle existant, pas sur une nouvelle certification du cash.

Charges certaines, `AsOfContext`, couverture/grâce Bank, réconciliation, purchase-aware, funding, cash, rollover, Transport et RLS gardent leurs propriétaires existants. Le switch ne concerne que les habitudes probabilistes. Une charge passée non débitée reste réservée. Aucun solde, salaire ou titre-restaurant n’est recalculé comme une enveloppe comportementale.

## Mémoire

`forecast-memory.ts` écrit le mode dans le checkpoint dédié et utilise sa version exacte dans le digest et l’INSERT. SAFE ajoute `/full-month-safe@v1` à la version ; AS_OF_TEMPORAL conserve intégralement la version précédente. Les anciens checkpoints restent immuables et disponibles après réactivation.

Calibration et comparaison sont isolées par version/mode. SAFE utilise un horizon constant `FULL_MONTH`, afin qu’un changement d’horizon calendaire ne sélectionne pas une correction différente et ne provoque pas une baisse sans nouveau fait. Les exigences de source FULL et les exclusions d’intentions utilisateur restent inchangées.

## Preuves exécutées

| Commande | Résultat |
| --- | --- |
| `node scripts/check-phase2-forecast-temporal-mode.mjs` | PASS — 13 tests ; défaut SAFE, J1/J18/J31 et mois fermé, couverture FULL/absente, réel, Planned, Declared, réconciliation, charges, cash, réactivation, isolation mémoire, actions Preview/Save/reload dans les deux modes, zero-write. |
| `node scripts/check-phase2-temporal-forecast.mjs` | PASS — les 63 contrôles existants conservés, modèles temporels explicitement AS_OF_TEMPORAL. |
| `node scripts/backtest-phase2-temporal-forecast.mjs` | PASS — 42 runs, comparaison des résultats avec le rapport précédent identique. |
| `node scripts/check-phase2-month-narrative.mjs` | PASS — assertions temporelles et action parity conservées sous mode explicite. |
| `node scripts/check-phase2-planned-finance.mjs` | PASS. |
| `node scripts/check-phase2-planned-reliability.mjs` | PASS — C6, idempotence, CAS, altération, parité, Preview zero-write. |
| `node scripts/check-phase2-planned-reality.mjs` | PASS — déclaration, report, restauration, suppression. |
| `node scripts/check-phase2-planned-guards.mjs` | PASS — 15 probes, aucune écriture historique. |
| `node scripts/check-phase2-planned-domain.mjs` | PASS. |
| `node scripts/check-phase2-planned-server-contract.mjs` | PASS. |
| `node scripts/check-phase2-planned-routes.mjs` | PASS. |
| `node scripts/check-phase2-planned-car.mjs` | PASS — Peugeot 207, fuel économique, providers, cash, parité. |
| `node scripts/check-architecture-imports.mjs` | PASS — 740 fichiers. |
| `node node_modules/typescript/bin/tsc --noEmit` | PASS. |
| `node node_modules/next/dist/bin/next build` | PASS — compilation, TypeScript, génération des 8 routes statiques. |

Une suite supplémentaire ancienne, `check-phase2-month-decision-engine.mjs`, échoue à l’assertion `shift = DOWN` : le moteur expose déjà `shift: null` dans `d4e873d`. L’échec a été reproduit avec le source du moteur de ce commit chargé en mémoire, en mode AS_OF_TEMPORAL, sans mutation du dépôt ou de Supabase. Le fichier de test est conservé sans modification. Cette suite n’est pas annoncée PASS.

Preuve structurée des tests du patch : `phase2-full-month-safe-tests.json`. Les fixtures sont en mémoire ; aucune écriture live Supabase, migration, modification RLS ou modification historique n’a été exécutée. Aucun test navigateur/Vercel revendiqué.

## Limites

SAFE préserve une estimation mensuelle prudente ; il ne prouve pas que chaque opportunité passée a eu lieu. Les dates et counts restent explicatifs, les montants financiers appartiennent à l’enveloppe résiduelle de catégorie. Les priors peuvent évoluer avec de nouvelles observations historiques, hypothèses explicites ou un nouveau mois cible.

Les limites précédentes restent actives : repas Manon LOW_COVERAGE sans Edenred, financement attendu UNKNOWN si sources insuffisantes, solde UNKNOWN sans observation/reconstruction prouvée, cash d’un autre mois sans bridge certifié, bornes non présentées comme calibrées sans preuve. La grâce Bank de 3 jours n’est pas une garantie d’import. La comparaison globale C4 n’a pas été rejouée dans ce patch ciblé.
