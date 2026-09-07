# UI Transformation P2 — Frontend humain

## Baseline et périmètre

- Branche de travail : `integration/p18t-main`.
- Baseline P1 : `098fe4f06bb5977b39e542e2bdbb2e77432b4731` (`UI_TRANSFORMATION_P1 = PASS`).
- Périmètre : projection visuelle et navigation de `/analyse-globale` à partir des ReadModels P1.
- Aucun moteur M1–M10, schéma, Query contract, publication ou donnée live n'a été modifié.

## Fichiers modifiés

- `src/features/global-v2/global-v2-page.tsx`
- `src/features/global-v2/global-v2.module.css`
- `src/features/global-v2/catalog.ts`
- `src/components/layout/app-shell.tsx`
- `scripts/check-global-v2-frontend.mjs`
- `docs/global-v2/execution/UI-TRANSFORMATION-P2-FRONTEND.md`

`fixture-data.ts` n'a pas nécessité de changement : les scénarios contractuels existants restent valides et le rendu module-aware impose les états humains requis indépendamment des libellés techniques de fixture.

## Composition livrée

- Hero : titre humain, période `Août 2025 → juillet 2026 · 12 mois analysés`, sous-titre et point d'entrée unique `Méthode & fiabilité`.
- Navigation principale : `Historique`, `Analyse globale`, `Opérations`; Diagnostic reste distinct.
- Navigation interne sticky : ordre produit exact, avec regroupement `Autres analyses`.
- Synthèse : assemblage S1→S7 depuis les ReadModels compacts P1, en trois lignes et sans remplacement d'un slot absent.
- Grille desktop : M1/M2 pleine largeur, M4/M3 en 8/4, M6/M7 en 6/6, M10/M9 en 7/5, M5/M8 en 6/6.
- Responsive : pleine largeur intermédiaire, une colonne et navigation horizontale mobile, KPI en une colonne à 480 px.

## Modules et composants

- M1 : trois KPI, insight, `RankingBar` observé/habituel/minimum et overlay `Vue d'ensemble | Structure | Tendance`.
- M2 : insight, `RankingBar` top catégories, `MultiSeriesMonetaryEvolution` limité à trois séries de douze points et overlay `Catégories | Besoins | Évolution`.
- M3 : état neutre sans KPI, zéro ni graphique.
- M4 : activités regroupées par personne; overlay `Habitudes | Évolution`.
- M5 : état humain indisponible sans identifiant ni chiffre.
- M6 : badge partiel relié à la méthode, trois cartes, classement top cinq et overlay `Moments | Comparaisons`.
- M7 : classement top cinq visites et overlay `Lieux | Dépenses | Évolution`.
- M8 : `Analyse pas encore disponible`, sans faux zéro ni graphique.
- M9 : headline neutre, badge partiel et métriques factuelles séparées par personne.
- M10 : badge partiel, sous-titre explicite et classement des univers qualifiés.

## Détails, méthode et sécurité de présentation

- L'expansion inline générique a été retirée.
- `Voir le détail →` ouvre l'unique `OverlayFrame`; les tabs n'existent que dans cet overlay.
- Les badges partiels M6/M9/M10 ouvrent la même ressource de méthode que le point d'entrée du hero.
- Le rendu principal n'affiche ni IDs/hashes, ni reason codes, ni enums de support/knowledge, ni clés `global.*` inconnues.
- Les erreurs restent locales au module et n'exposent aucun code technique.
- Le focus de fermeture, Escape, backdrop, alternative textuelle des séries et reduced motion restent pris en charge.

## Validation ciblée

- `check:global-v2-frontend` : **PASS** — `312/312` assertions, `71/71` RuntimeSchemas fixture.
- Le gate couvre navigation, hero, S1→S7, états et contenus M1–M10, charts, overlay-only details, absence de leaks techniques et responsive.
- `typecheck` non relancé : aucun type, schema ou contrat de signature n'a été modifié par P2.
- `git diff --check` : **PASS**.

`NO_LIVE_WRITES_DURING_P2 = YES`

`NO_NEW_DEPENDENCY = YES`

`NO_VERCEL_ACCESS_DURING_P2 = YES`

## Verdict

`UI_TRANSFORMATION_P2 = PASS`
