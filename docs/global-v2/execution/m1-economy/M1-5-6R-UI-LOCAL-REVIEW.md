# M1-5/6R — UI finale et review locale

Date : 2026-09-08

Branche : `main`

Baseline : `fd8b8ce689c8f170cc544a7ec3b9cf2720748000`

## Verdict

La carte « Votre économie » consomme désormais exclusivement les valeurs, deltas, séries, qualités et classements déjà publiés par les ReadModels M1. Le navigateur effectue uniquement une projection de présentation : aucune médiane, aucun quantile, aucun delta, aucun équivalent mensuel et aucune décision de support, coverage ou matérialité n'y sont recalculés.

```text
M1_5_6R_UI_LOCAL = PASS
MAIN_CARD_FINAL = PASS
HERO_TYPICAL_MINIMAL_GAP = LOCAL_PARTIAL_UNTIL_BACKFILL
LAST_MONTH_VS_REFERENCE = PASS
EVOLUTION_CHART = PASS
TEMPORAL_SIGNALS = PASS
STRUCTURE_UI = PASS
RECURRENCES_UI = PASS
RECURRENCE_DETAIL_UI = PASS
CONTRIBUTORS_UI = PASS
METHODOLOGY_UI = PASS
OVER_GATING_CHECK = PASS
RESPONSIVE = PASS
ACCESSIBILITY = PASS
NO_REACT_BUSINESS_ARITHMETIC = YES
NO_DISPLAYVALUE_PARSE_FOR_ANALYTICS = YES
NO_RAW_TECHNICAL_LABELS = YES
TYPECHECK = PASS
TARGETED_TESTS = PASS
SUPABASE_WRITES = 0
VERCEL_DEPLOY = NO
GIT_PUSH = NO
```

## Projection livrée

- La carte reprend le titre et le sous-titre normatifs, puis présente `TypicalState`, `MinimalState` et le gap calculé côté serveur.
- L'absence d'autorité Minimal reste limitée au socle et au gap. `Actual`, `TypicalState`, la référence précédente et leur comparaison restent visibles.
- Le dernier mois affiche `Actual`, `TypicalReference` et le delta backend, sans soustraction dans React.
- « Votre coût de vie sur 12 mois » utilise `MonetaryEvolution` avec les trois séries typées `Actual`, `TypicalState` et `MinimalState`. Les points inconnus deviennent des enveloppes `unknown`; les lignes emploient `connectNulls={false}`.
- Tendance de fond, mouvement récent et variabilité sont les sorties serveur. Les statistiques descriptives ne sont jamais transformées en qualification catégorielle.
- L'overlay M1 expose les quatre sections `Vue d'ensemble`, `Évolution`, `Structure` et `Charges récurrentes`, plus l'action secondaire `Méthode & fiabilité`.
- Les axes Structure sont rendus séparément. `UNKNOWN` devient « À classer » et `CONFLICT` « Classification à confirmer ».
- Les cinq agrégats de récurrence gardent chacun leur propre qualité. Les faits d'une récurrence restent cliquables même lorsque son cycle de vie est inconnu.
- `analysis_global_economic_recurrence_detail` est raccordée au même overlay que le module principal.
- Les contributeurs déjà qualifiés sont bornés aux cinq premiers fournis par le serveur et sont présentés sans assertion causale supplémentaire.

## Frontière React

Le helper `economic-ui.ts` ne lit jamais un nombre dans `displayValue`. Les points du graphique sont construits depuis `typedMeasure`; `displayValue` reste uniquement du texte. Les recherches ciblées ne trouvent aucun wording interdit dans le chemin M1. Les anciens helpers génériques fondés sur une présentation textuelle restent limités aux autres modules et ne sont plus appelés par M1.

## Responsive et accessibilité

- Les trois repères du hero et du dernier mois passent sur une colonne sous 767 px.
- Les strips Structure restent parcourables horizontalement sans supprimer de contenu.
- Les sections possèdent des titres associés, les groupes économiques un libellé accessible, les contrôles restent des boutons natifs et l'overlay conserve fermeture clavier et restauration du focus existantes.
- `prefers-reduced-motion` demeure respecté par le shell Global.

## Tests exécutés

| Preuve | Résultat |
|---|---|
| `check:m1-5-6r-ui-local` | 32/32 PASS |
| `check:global-v2-economic-function` | 72/72 PASS |
| `check:m1-2-3r-engine-owner` | 56/56 PASS |
| `check:m1-4r-query-snapshots` | 31/31 PASS ; 44 snapshots ; 2 détails récurrence |
| `check:global-v2-frontend` | 315/315 PASS ; 71/71 RuntimeSchemas fixture |
| `check:global-v2-primary-readmodels` | 83/83 PASS ; 10/10 schemas |
| `check:global-v2-query-instances` | 59/59 PASS ; 33/33 RuntimeSchemas ; 0 producer read |
| architecture | PASS ; 565 fichiers |
| `npm run typecheck` (compilateur TypeScript du runtime configuré) | PASS |
| `git diff --check` | PASS |

## Limite locale explicite

Le backfill historique Minimal reste hors de cette mission. Là où l'autorité n'existe pas, le socle et le gap indiquent localement leur indisponibilité et la ligne Minimal conserve ses trous. Cette limite ne dégrade aucune autre vérité du module.

`REPORT = docs/global-v2/execution/m1-economy/M1-5-6R-UI-LOCAL-REVIEW.md`
