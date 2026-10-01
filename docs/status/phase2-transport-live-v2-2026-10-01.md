# Transport prospectif live V2 — 1 octobre 2026

## Résultat

```text
HEAD_BEFORE = 088bb14fad6bcd68f49de0d847d9914241277d5f
HEAD_AFTER = commit main contenant ce rapport (git log -1 --format=%H -- docs/status/phase2-transport-live-v2-2026-10-01.md)
FILES_CHANGED = 20 fichiers ; liste ci-dessous
MIGRATIONS = NONE
NEW_ENV_VARS = TOMTOM_API_KEY, HERE_API_KEY ; serveur uniquement, production Vercel configurée
CACHE_STRATEGY = mémoire serveur bornée à 256 entrées, déduplication des appels simultanés ; route 6 h, géocodage 24 h, SP95 45 min, péage 24 h
TOMTOM_LIVE = PASS
FUEL_PRICE_OFFICIAL = PASS ; médiane SP95 locale, qualité STALE dans le smoke réel
HERE_TOLLS = PASS ; géométrie TomTom importée puis routeHandle, 32,80 € confirmés sur le segment autoroutier du smoke
AVOID_TOLLS_VARIANT = PASS ; choix explicite, géométrie différente, péages résiduels affichés honnêtement
PEUGEOT_207_PROFILE = PASS ; modèle versionné exact, fuelConsumptionInLiters direct
FUEL_ECONOMIC_ONLY = PASS ; aucune allocation BANK pour l'essence utilisée
TOLL_BANK_PAYABLE = PASS ; CostItem existant, allocation BANK
ZERO_HISTORICAL_WRITE = PASS ; compteurs et hashes inchangés sur les 7 tables contrôlées
UNIT_TESTS = PASS ; transport, routes, builder, serveur, finance, fiabilité
LIVE_SMOKE_TESTS = PASS ; APIs locales réelles + parcours navigateur jusqu'à Preview, sans enregistrement
TYPECHECK = PASS
BUILD = PASS
KNOWN_LIMITATIONS = imports HERE incomplets refusés, prix SP95 parfois ancien, cache par processus, profil de péage voiture standard
FOLLOW_UPS = confirmation des caractéristiques de carte grise si le véhicule change ; aucune action Supabase nécessaire
```

## Implémentation

Le service `estimatePlannedCar` est commun à l'action du Builder et à la résolution serveur Preview/Save. Le serveur réutilise les références accessibles au foyer et le modèle Peugeot 207 versionné. Il refuse un Save si l'itinéraire, le véhicule, le coût essence ou le péage a matériellement changé depuis l'aperçu. Les lectures des lignes sauvegardées utilisent uniquement leur snapshot prospectif ; elles ne relancent aucune API.

Les CostItems alimentent le moteur financier existant : essence utilisée `ECONOMIC_ONLY`, péage et parking `BANK_ONLY`. Le moteur financier et les autorités historiques n'ont pas été modifiés. Un prix ou un péage indisponible reste `null`, avec réparation explicite. Les lignes de péage et de parking saisies par l'utilisateur sont conservées lors du recalcul.

Le Builder propose « Nous / Quelqu'un d'autre », puis « Gratuit / Payant », puis le mode. La voiture déclenche le calcul après 450 ms. Le résumé montre distance, durée, litres, essence, péage et paiement prévu. Les coordonnées manuelles, l'heure et la provenance restent dans les détails. Les changements de route/date invalident l'estimation et l'aperçu ; les préférences explicites restent disponibles, ainsi que l'Undo existant. Le root destination ne disparaît pas lors d'un ajout ou retrait de child stop.

### Providers et sécurité

- TomTom reçoit les arrêts physiques ordonnés, le modèle exact et `traffic=false`. Date sans heure : trois estimations à 8 h, 14 h et 18 h, médianes des valeurs, géométrie du trajet médian en durée. Sans date : mardi type déterministe à 14 h, sans incidents présents.
- Le prix SP95 utilise le dataset officiel, la médiane locale et les rayons 15 → 25 → 40 km. Les ruptures, doublons, prix absents et observations de plus de 7 jours sont exclus. Trois stations fraîches suffisent à privilégier les références de moins de 48 h ; sinon la qualité ancienne est explicite.
- HERE importe les polylines TomTom décodées, densifiées sur la même géométrie, avec une limite de 50 000 points. Le handle est éphémère. HERE ne choisit jamais un itinéraire indépendant. Pour une arrivée planifiée, le départ transmis à HERE est déduit de la durée TomTom ; l'intention d'arrivée reste transmise à TomTom.
- Timeout par requête : 4 s, AbortController ; au plus une relance des HTTP 429/502/503/504. Les erreurs sont assainies. Les réponses incomplètes ne deviennent pas un péage nul et les échecs ne sont pas mis en cache.
- DTO fermé, 2 à 12 arrêts, coordonnées bornées, UUIDs et enums contrôlés ; transport interdit/delivery/non-car rejeté avant l'appel. Références vérifiées côté serveur. Aucun paramètre URL/provider arbitraire accepté.
- Clés dans `.env.local` ignoré et variables sensibles de production Vercel. Scan des fichiers suivis/nouveaux et de `.next/static` : **0 occurrence des deux clés**.

## Audit Supabase préalable

Lecture distante du projet existant : **0 ligne prospective** au départ ; Peugeot 207 active, coordonnées canoniques et observations compatibles présentes. Le JSON `context` actuel et la validation CostItem existante portent ce contrat sans migration. Aucun schéma, trigger, FK, règle RLS ou historique n'a été modifié.

## Preuves ciblées

Commandes exécutées avec le runtime Node fourni au poste :

```text
node scripts/check-phase2-planned-car.mjs                    PASS
node scripts/check-phase2-planned-routes.mjs                 PASS
node scripts/check-phase2-planned-builder.mjs                PASS
node scripts/check-phase2-planned-server-contract.mjs        PASS
node scripts/check-phase2-planned-finance.mjs                PASS
node scripts/check-phase2-planned-reliability.mjs            PASS
node scripts/smoke-planned-transport-live.mjs                PASS
node node_modules/typescript/bin/tsc --noEmit --incremental false  PASS
node node_modules/next/dist/bin/next build                   PASS
git diff --check                                             PASS
```

Lint : `NOT_CONFIGURED` dans ce dépôt. Aucun framework navigateur supplémentaire installé ; vérification avec le navigateur déjà disponible dans Codex.

Les mocks prouvent le modèle, l'arrondi final, le fuel économique, le péage bancaire, SP95 fresh/stale/null/rupture/doublons, les timeouts, les routes absentes, l'import HERE/handle invalide/split refusé, la distinction inconnu/zéro, l'ordre physique, la présence du root, les limites DTO, le cache et sa déduplication, Preview/Save/reload en mémoire, le refus d'un Save périmé et l'invalidation de date. Le test de fiabilité conserve explicitement le parcours des anciennes lignes avec le resolver historique ; les nouveaux providers sont testés dans leur propre suite.

### Smokes réels anonymisés

Exécution locale le 1 octobre 2026 à 11:00 UTC. Prix de référence : **2,27 €/L**, médiane de 7 stations dans 15 km, fourchette 2,202–2,322 €/L. Qualité **STALE** : l'échantillon contient des observations de plus de 48 h, toutes de moins de 7 jours. La référence la plus récente est du 30 septembre à 22:50 UTC.

| Sortie | Local aller-retour | Autoroute | Variante éviter les péages |
| --- | ---: | ---: | ---: |
| distance | 8,956 km | 248,408 km | 262,785 km |
| duration | 1 294 s | 7 281 s | 16 064 s |
| fuel liters | 0,958081 L | 18,720554 L | 20,103695 L |
| fuel price | 2,27 €/L | 2,27 €/L | 2,27 €/L |
| fuel economic cost | 2,17 € | 42,50 € | 45,64 € |
| toll | NONE · 0 € | KNOWN · 32,80 € | KNOWN · 5,50 € |
| economic total | 2,17 € | 75,30 € | 51,14 € |
| cash total | 0 € | 32,80 € | 5,50 € |

Les points autoroutiers du smoke sont publics et situés sur des collecteurs de péage ; éviter les péages laisse donc un montant résiduel. L'interface affiche « Limiter les péages » dans ce cas. Elle n'annonce « Sans péage » que lorsque les faits le permettent.

### Zéro écriture historique

Comparaison avant/après du smoke : hashes SHA-256 de toutes les lignes, triés puis agrégés par table, et compteurs strictement identiques.

| Table | Lignes avant = après |
| --- | ---: |
| mobility_legs | 684 |
| mobility_trips | 296 |
| operations | 1 660 |
| purchase_events | 200 |
| product_observations | 18 |
| fuel_price_observations | 12 |
| referentiel_lieu | 180 |

La fixture serveur en mémoire vérifie également que les seules écritures CRUD visent `phase2_planned_expenses`. Aucune fixture distante n'a été créée.

### Navigateur local

Session réelle `/mois-a-venir` : visite → contact et lieu suggéré → trajet pris en charge par nous → payant → voiture → calcul automatique → date sans heure → péage indisponible réparé par confirmation explicite → Preview serveur.

Résultat observé : **15,1 km, 34 min, environ 1,63 L, 3,70 € économiques, 0 € de paiement bancaire**. L'aperçu affiche « Essence utilisée / Usage économique estimé » et « Aucun paiement prévu ». Pas d'enregistrement ; brouillon temporaire fermé. Aucune erreur console après correction. Avertissements préexistants sur les proportions d'images de marques, sans lien avec le transport.

Le premier parcours a révélé le rejet d'une distance encore vide dans un brouillon neuf : corrigé dans le parser de requête d'estimation et ajouté au test. Le parser de Save continue à exiger les distances résolues. Relecture visuelle du résumé compact et de la carte d'aperçu effectuée.

## Limites connues

- Les cartes TomTom/HERE peuvent diverger ou HERE peut refuser un demi-tour/une trace non continue. Un essai incluant une rue privée ou un demi-tour a produit `importSplitRoute` : refus explicite du tarif partiel, puis saisie/confirmation utilisateur. Ce résultat ne vaut jamais `NONE` automatiquement. Un autre segment autoroutier continu a permis la preuve positive HERE.
- Le cache est local au processus serveur ; un démarrage à froid appelle à nouveau les providers. Pas de cache distribué ni de SWR ajouté.
- Un prix officiel peut rester ancien ou avoir peu d'échantillons après élargissement ; la provenance, le rayon, le nombre de stations et la qualité restent visibles. En absence de prix, repli compatible existant, puis saisie manuelle, sinon aucun montant inventé.
- Le péage utilise le profil HERE voiture standard, sans hauteur/PTAC/essieux inventés. L'estimation n'est pas un relevé de paiement.
- La parité Save/reload est testée avec le contrat serveur réel et le client DB en mémoire. Le parcours navigateur s'arrête à Preview ; aucune nouvelle écriture distante n'a été demandée pour ce lot.

## Fichiers du lot

```text
.env.example
package.json
scripts/check-phase2-planned-car.mjs
scripts/check-phase2-planned-reliability.mjs
scripts/smoke-planned-transport-live.mjs
src/domain/phase2/planned-car.ts
src/domain/phase2/planned-contract.ts
src/domain/phase2/planned-builder.ts
src/domain/phase2/planned-mutations.ts
src/domain/phase2/planned-places.ts
src/server/phase2/planned-car-providers.ts
src/server/phase2/planned-car-estimation.ts
src/server/phase2/planned-context.ts
src/server/phase2/planned-expenses.ts
src/app/mois-a-venir/planned-car-summary.tsx
src/app/mois-a-venir/planned-route-editor.tsx
src/app/mois-a-venir/planned-expenses-actions.ts
src/app/mois-a-venir/planned-expenses-control.tsx
src/app/mois-a-venir/month-calendar.tsx
docs/status/phase2-transport-live-v2-2026-10-01.md
```

## Sources techniques consultées

- [TomTom Calculate Route](https://docs.tomtom.com/routing-api/documentation/tomtom-maps/v1/calculate-route)
- [HERE Route Import et limites](https://docs.here.com/routing/docs/routing-v8-route-import)
- [HERE paramètres de Route Import](https://docs.here.com/routing/reference/routing-api-v8-importroute)
- [HERE péages d'une route importée](https://docs.here.com/routing/docs/routing-v8-tolls-routeimport)
- [Dataset officiel prix des carburants](https://www.data.economie.gouv.fr/explore/dataset/prix-des-carburants-en-france-flux-instantane-v2/)
