# Phase 2 — C4 / C5 — lieux, trajets et finance

Certification du 30 septembre 2026 (Europe/Paris), depuis C0–C3 du dépôt courant.

## Implémentation

- Lieux propres des compléments via `childLocalPlaceRefs`, filtrage partagé, choix explicite d'ajout au trajet, retrait et Undo. Une seule instance par type de complément ; aucun sous-projet, calendrier enfant ou Transport enfant.
- Une seule chaîne racine : le contrat C2 `stops` encode les segments adjacents et leur distance sortante. `routeSegments()` est sa projection ; il n'existe aucun autre ordre persisté. Les payloads proposant une deuxième chaîne sont rejetés.
- Endpoints principal / complément / direct vérifiés au serveur. Identité stricte ; fusion des lieux consécutifs identiques. Les références TEXT restent prospectives.
- Médians historiques par paire dirigée, véhicule et méthode, sur le corpus paginé entier. Compte, minimum, maximum, dates et méthode conservés. Retour explicite, état PARTIAL si une direction manque, complément manuel explicite. Chaque réordonnancement invalide les métriques ; Undo conserve les distances manuelles précédentes.
- Litres propres aux segments historiques, consommation pondérée pour les kilomètres manuels, prix carburant avec date et qualité. Le serveur revalide les preuves historiques et le prix live.
- Catalogue partagé : carburant `ECONOMIC_ONLY`, péage / parking payables. Aucun financement de l'usage carburant, aucun BANK de remplacement d'un manque wallet.
- Carte financière avec coût prévu, quotidien déjà compris, supplément central, paiement prévu, usage carburant, reste central, fourchette secondaire. Son impact vient exclusivement du delta des résultats de `deriveMonthScenario`.
- Couches mensuelles dérivées dans ce même moteur ; lifecycle neutre à contenu identique. Les ressources mensuelles ne sont pas affichées comme un solde bancaire.

## Relecture live, sans écriture

Avant et après les sondes : 0 PlannedExpense, 684 MobilityLeg, 296 MobilityTrip pour le foyer.
Pas de migration : les ajouts sont compatibles avec le contexte JSONB existant.

Oracles dirigés relus, datés et réservés aux tests :

| Route | Résolution | Distances | Usage carburant |
| --- | --- | --- | --- |
| Domicile ↔ Fontès | KNOWN | 62,962 + 64,342 km | 20,83 € |
| Domicile ↔ Lucas | PARTIAL | 6,196 km aller, retour inconnu | total incomplet |
| Domicile ↔ Cédric | KNOWN | 13,169 + 14,327 km | 4,96 € |

Dernier prix SP95 disponible : observation du 1 juillet 2026, qualité `P4_NATIONAL_FALLBACK`.
Les calculs du mois d'octobre ont été relus sur le snapshot actif et les inputs live.
Aucun payload financier live ni credential n'est ajouté au dépôt.

## Vérifications

- `check-phase2-planned-routes.mjs` : LP-01..08, binding, continuité et payload de chaîne indépendante rejeté, médianes dirigées, PARTIAL/manual, fuel, META-05..08/18/19.
- `check-phase2-planned-finance.mjs` : FIN-01..08, rendu réel de la carte FIN-UI-01..04, META-03/04/05/09/20, quantités, baseline partagée, lifecycle, baisse wallet, calendrier brut, langage négatif.
- Régressions C1, C2, C3, assets, Planned Expenses, synchronisation liste/calendrier/prévision et imports d'architecture : PASS.
- TypeScript et build Next.js de production : PASS.
- `audit-phase2-c4-c5-live.mjs` : routes live, validation serveur des preuves, simulation économique du mois actif, carburant sans financement, nombres de lignes conservés. Le test négatif altère une preuve en mémoire et doit être rejeté.
- Navigateur local connecté : visite Lucas avec Restaurant Café Joseph distinct ; ajout explicite au trajet ; aller historique et deux segments manuels ; estimation, Preview, suppression du complément puis Undo sans duplication ; aucune erreur console. Le brouillon n'a pas été enregistré.

## Gates

```ini
C4_CHILD_LOCAL_PLACE = PASS
ROOT_TRANSPORT_SINGLETON = PASS
ROUTE_CONTINUITY = PASS
FUEL_ECONOMIC_ONLY = PASS
MOBILITY_HISTORICAL_WRITES = 0
C5_FINANCE = PASS
MONTHSCENARIO_SINGLE_AUTHORITY = PASS
FUNDING = PASS
BASELINE = PASS
FINANCIAL_LANGUAGE = PASS
FAKE_CASH_SURFACES = 0
SILENT_BANK_FALLBACK = 0
```

Périmètre : interface ordinateur ; aucune carte ni routing live V2. Les prix et preuves historiques restent des estimations datées. La publication est faite par push sur `main`, sans vérification sur Vercel, selon la préférence utilisateur.
