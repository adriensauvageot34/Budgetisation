# C0-R — Remédiation locale et recertification

## R1 — migrations

La [matrice complète](c0r-migration-reconciliation.md) associe 26 SQL locaux aux SQL live par SHA-256 après normalisation des fins de ligne. Douze fichiers ont été renommés aux identités live et le no-op live `20260923134531_persona_profile_assertions` (`select 1;`) a été ajouté localement. L'ordre final, les noms et les 27 contenus sont identiques à `supabase_migrations.schema_migrations`. Les scripts qui ouvraient les anciens chemins ont été mis à jour. Aucun SQL live n'a été rejoué.

Les trois inversions d'ordre initiales venaient du déplacement de `purchase_event_identity` après trois migrations datées du 24–25 août. Le nouvel ordre est l'ordre effectivement appliqué live. Le dépôt ne contient pas de bootstrap complet de base vierge, et cette session ne dispose ni de Supabase CLI, ni de Postgres local, ni de Docker, ni de PGlite. Le replay vierge et un diff de schéma généré restent indisponibles ; les tests SQL ciblés ont été exécutés.

## R2 — prototype de wire v2

Le [prototype local](../../scripts/swile-background-rhythms-v2-prototype.mjs) lit un export JSON privé en lecture seule et les oracles A3. Il n'est pas branché au producteur, au Query ou à React. Il utilise le sérialiseur canonique, compacte 245 `null` finaux de highlights, place un masque explicite de qualité monétaire et les sous-totaux exact/minimal dans les tuples mensuels, et ajoute une couverture racine avec exceptions ainsi qu'un financement mensuel sparse. Le parseur RuntimeSchema réexpanse qualité et tuples ; un masque invalide et un mois hors couverture sont testés.

| Mesure | Octets |
|---|---:|
| Annual courant | 47 193 |
| Annual v2 simulé | 46 375 |
| Réduction face à la simulation C0 (47 886) | 1 511 |
| Marge sous 48 KiB | 2 777 |
| SLO de marge | 2 048 |
| Feature v2 simulée, 13 snapshots | 148 707 / 153 600 |

La couverture `FULL` est une hypothèse de mesure sur la fenêtre de l'oracle, pas une certification de couverture Benefit. Les 104 highlights hérités ne sont pas recalculés depuis les achats Swile dans ce prototype. La valeur 46 375 octets certifie la taille de ce scénario, pas un futur G1.

## R3–R4 — vérifications

- La fixture privée paginée rev8 présente dans le workspace a permis d'exécuter `check-global-v2-candidate-adapters.mjs` avec `--as-of=2026-09-24T00:00:00Z` : PASS, dont Timeline 57 événements et Grocery 9/12 mois éligibles. Aucun export de production n'a été changé.
- Replay indépendant des feuilles A2/A3 du FINAL MASTER : 200 achats uniques, 42 groupes A2, 54 achats mixtes appariés, zéro conflit, 36 deltas A3, correction exacte 1 705,24, minimum partiel 102,25, cible minimale 8 546,07. Les 255 FundingComponents se déduisent des 145 achats Benefit-only, 54 Benefit-plus-bank et 1 Benefit-plus-other. Le classeur indique 13 crédits et des deltas bank outflow / wallet credit FOOD nuls.
- Suites PASS : History canonical, snapshot materialization, frozen publication ; Global publication, frozen guards, Persona editorial UI, M1 H1M, FOOD, BackgroundRhythms, cutover, production bridge, query instances, frontend, routines, category needs, primary readmodels, foundations, analytics materialization, Global certification ; typecheck.
- Read-back live : data revision 8, analytics revision 109, publication Global active `fdff4ee0-5240-5362-8117-edd81624fb42`, 759 snapshots Query, 17 artifacts, 13 snapshots BackgroundRhythms. Garde future hors Background : 746 Query, 16 artifacts. Rebase futur : D9 / base A109 / publiée A110. Aucune table Benefit/Wallet/Funding live.
- Le classeur source brut Swile n'a pas été trouvé. Le FINAL MASTER désigne ses feuilles A2/A3 comme autorité financière et de mapping pour le pilote ; les 213 SourceRecords et 13 crédits ne sont cependant pas revérifiables indépendamment du classeur source. Ce manque reste un écart d'exécution C0-R. Aucun import ni publication n'a été exécuté.
