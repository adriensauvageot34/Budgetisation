# UI Transformation P1 — Projection humaine / ReadModels / labels

## Périmètre

Ce lot ferme uniquement la chaîne `owner outputs certifiés → projection module-aware → ReadModels / Query instances`. Il ne modifie aucun moteur analytique M1–M10, aucun runtime Query, aucune route, aucun composant React et aucune donnée live.

Baseline : `e4d4468c251f728902b0c0202d24050006f77383` sur `integration/p18t-main`.

## Fichiers modifiés

- `src/server/analytics/global-v2-candidate.ts` : projections humaines déterministes par module, slots S1–S7, sections utiles et closures des labels.
- `src/server/analytics/global-v2-production-orchestrator.ts` : correction de la détection M6 et chargement des autorités de labels.
- `src/server/canonical/repository.ts` : lecture read-only et bornée des noms de Needs.
- `src/query-api/global-v2/builders.ts` : acceptation d’un insight de présentation déjà qualifié, distinct du moteur de sélection éditoriale.
- `src/query-api/global-v2/details.ts` : borne rétrocompatible de trois séries simultanées.
- `scripts/check-global-v2-production-bridge.mjs` : fixtures synthétiques et assertions discriminantes P1.

## Synthèse déterministe S1–S7

| Slot | Projection compacte | Sélection / garde |
| --- | --- | --- |
| S1 | valeur Actual et mois cible | valeur numérique connue |
| S2 | écart exact Actual − Typical avec rappel du Typical | aucune qualification d’intensité inventée |
| S3 | catégorie humaine, montant courant, Typical et delta | catégorie connue et matérialité M2 `MATERIAL`; tri delta absolu, montant, ID |
| S4 | activité et personne labellisées, occurrences et intervalle médian | occurrence positive; tri occurrence, rate, IDs |
| S5 | type de Moment, causalCost, dates et contexte partiel | coût connu et date connue; tri coût, récence, ID |
| S6 | nom canonique et visites | visite positive; tri visites, jours, durée, ID |
| S7 | activité humaine, sharedUnits, eligibleUnits et qualification partielle | univers KNOWN/PARTIAL avec sharedUnits et resolvedUnits positifs |

Un slot sans autorité de label ou sans valeur requise n’est pas projeté. Les références d’entités restent disponibles pour la navigation mais ne servent jamais de libellé visible.

## Mapping module → ReadModel produit

| Module | Compact | Expanded / détails |
| --- | --- | --- |
| M1 Économie | Actual, Typical, Minimal, insight d’écart | overview, structure fixe-variable/LifeScope/nécessité, tendance et changement récent sans fausse série |
| M2 Catégories & Needs | catégorie notable matérialisée et total | top catégories, top Needs dont « Besoin non déterminé », trois séries complètes de 12 mois |
| M3 Changements | état humain neutre, aucun KPI `0` | une seule section informative utile |
| M4 Rythmes | rythme dominant humain et top compact | top activités par personne, jusqu’à trois séries complètes de 12 mois |
| M5 Vie et argent | placeholder humain indisponible | aucun relationship ID et aucun chiffre lorsque `insights=[]` |
| M6 Moments | top trois coûts et insight S5 qualifié PARTIAL | top cinq Moments, comparaisons autorisées et temporalité de paiement projetée |
| M7 Lieux | lieux humains visités et insight S6 | top lieux, finance localisée agrégée par placeId, lifecycle traduit sans fausse série |
| M8 Consommation | « Analyse pas encore disponible » | aucun `0 achat`, aucun détail fabriqué |
| M9 Profils | état descriptif sans headline forte | métriques d’activité labellisées par personne, qualification PARTIAL conservée |
| M10 Nous deux | univers partagé principal et top compact | univers qualifiés avec shared/resolved/eligible et couverture implicite dans le contexte humain |

Les anciennes six sections identiques ont disparu : seules les sections possédant un contenu propre sont matérialisées. Les détails d’entité sont bornés aux lignes réellement projetées.

## Autorités de labels injectées

- activité : `LIFE_EVENT_ACTIVITY_CATALOG[activityId].publicLabel` ;
- personne : `persons.display_name` depuis le contexte Canonical autorisé ;
- lieu : `referentiel_lieu.nom_canonique` ;
- catégorie : `categories.nom_canonique` ;
- Need : `needs.name` ;
- Need inconnu : libellé explicite `Besoin non déterminé` ;
- Moment : `summaries[].moment.type.value`.

Les digests des labels consommés sont intégrés aux dépendances et aux `resourceInputHash` des modules concernés. Une variation de label autoritaire modifie donc le candidat et sa closure.

## États limités et partial

- M3 ne publie jamais un faux KPI zéro ; son état neutre est explicite.
- M5 reste indisponible lorsque `insights=[]`, sans exposer le catalogue technique de relations.
- M8 reste indisponible lorsque Purchase Event/Merchant ne contient aucun fait ; zéro ligne n’est pas interprété comme zéro achat.
- M6 reconnaît désormais `summaries`, `comparisons`, `series` et `narrative`; son contenu est visible en `PARTIAL_COVERAGE` sans promotion en KNOWN.
- M9 et M10 conservent leurs contenus descriptifs PARTIAL et leurs limitations.

## Adaptations techniques strictement nécessaires

- Le builder compact accepte un `presentationInsight` déjà déterminé par la projection. Il ne passe pas par `InsightSelectionEngine` et ne fabrique aucune matérialité : cette voie sert uniquement aux slots déterministes et aux états humains imposés par le Brief.
- La limite des séries expanded passe de deux à trois, sans changement de forme ni rupture de lecture des payloads existants.
- Aucune modification de `types.ts`, `schemas.ts`, `registry.ts`, du query plan ou du runtime n’a été nécessaire.

## Tests ciblés

- `check:global-v2-production-bridge` : PASS — projection module-aware, S1–S7, labels, états M3/M5/M8, détail PARTIAL M6/M9/M10, absence de raw IDs visibles et sections distinctes.
- `check:global-v2-primary-readmodels` : PASS — `83/83`, schémas principaux `10/10`.
- `check:global-v2-query-instances` : PASS — `57/57`, RuntimeSchemas `32/32`, aucune lecture producteur.
- `typecheck` : PASS — requis car les entrées typées du builder et de la candidate ont changé.

`NO_LIVE_WRITES = YES`

`NO_VERCEL_ACCESS = YES`

`NO_PRODUCER_CHANGES = YES`

## Verdict

La projection serveur transporte désormais les valeurs humaines nécessaires aux cartes et à la future Synthèse, sans parcourir les owner outputs côté React et sans introduire de nouvelle doctrine analytique.

`UI_TRANSFORMATION_P1 = PASS`
