# P19A — pont candidat live et lecture Production snapshot-only

Date : 2026-09-07. Projet cible : `ipuuhxrblxormwgoaqnz`. Branche de travail : `integration/p18t-main`. Le checkpoint produit est `11906d2f1debde669497a931cb5e85c412d83fb5`, parent `a8c34dc0e7d1969bb7bd7c5e7089c60422b62bec`. `origin/main` est resté `2ed2cc0dadaef64a6e788cf881b6b40311a9cc2b` pendant ce lot.

## Entrée et fermeture du blocker P19

Le preflight P19 avait correctement conclu `BLOCKED` pour deux raisons techniques : le candidat P17 était une preuve synthétique GC1 et non un producteur live, et `/analyse-globale` ne disposait d'aucun chargeur Production vers une génération Global publiée. P19A ferme ces deux lacunes sans réinterpréter M1–M10 et sans écrire dans Supabase.

Le chemin productif n'importe ni `scripts/lib/global-v2-integrated-candidate.mjs`, ni Household/date/valeur de fixture, ni faux SHA. Le script P17 reste exclusivement une preuve de test. L'orchestrateur P19A exige un projet exact, un Household autorisé, des révisions réelles et une implementation identity Git explicite.

## Orchestrateur Production read-only

`src/server/analytics/global-v2-production-orchestrator.ts` ouvre un `CanonicalRepository` et un `FactSourceResolver`, résout `asOf` et `certifiedThrough`, puis traverse les producteurs certifiés. `src/server/analytics/global-v2-candidate.ts` transforme leurs sorties en ReadModels, instances Query, artifact, closures et manifest à l'aide des registries et primitives P13–P17 existants. Aucune formule de hash parallèle n'est introduite.

| Module | Canonical / Facts | Owner exécuté | Projection candidate |
| --- | --- | --- | --- |
| M1 Économie | Canonical finance via M2/FactSourceResolver | `GlobalM1HouseholdAuthority` | compact + sections expanded |
| M2 Catégories/Needs | economic component facts, Purchase authority | `GlobalM2HouseholdAuthority` | compact + expanded + détails atteignables |
| M3 Transformations | feed relationnel certifié disponible | `buildGlobalTransformations` | compact + expanded + détails atteignables |
| M4 Rythmes | `ActivityOccurrenceFact`, `PersonDayFact` | `buildGlobalActivityRhythm` | compact + expanded + détails bornés |
| M5 Relations | Facts personne et fenêtres Global | `GlobalM5PersonAuthority` | compact + expanded + détails atteignables |
| M6 Moments | Facts/autorités Moment HC2 | `GlobalM6MomentAuthority` | compact + expanded + détails atteignables |
| M7 Places | PlaceVisit/finance localisée autoritaire | `GlobalM7PlaceAuthority` | compact + expanded + détails atteignables |
| M8 Achats | PurchaseEvent Canonical | `GlobalM8PurchaseAuthority` | état réel data-gated conservé |
| M9 Personas | observations M4 attribuées P01 | builders Persona certifiés | état partiel/inconnu conservé |
| M10 Nous deux | participants positifs des occurrences | Shared resolver/builders certifiés | état partiel/inconnu conservé |

Les capacités absentes restent gated ; aucune ligne bancaire n'est transformée en PurchaseEvent, aucune participation/causalité n'est inférée et aucune finance Household n'est attribuée implicitement à une personne. Les payloads expanded respectent le budget contractuel de 50 lignes ; l'artifact conserve la sortie owner complète et seules les mêmes entités canoniquement ordonnées deviennent lignes et détails atteignables.

Le CLI interne `scripts/prepare-global-v2-live-candidate.mjs` retourne le résumé demandé et conserve le corpus stageable en mémoire. Il n'expose aucune API de store et ne peut appeler Begin, Stage, Attach, Seal ou Finalize.

## Sources Canonical et dry-run réel

Baseline relue en lecture seule : `dataRevision=1`, `analyticsRevision=79`. La source est l'export Canonical privé déjà prouvé 37/37 contre le live pour cette même dataRevision, complété en lecture seule par les 128 liens `financial_source_person_links` actuels. Les cinq structures Canonical postérieures à l'export ont été relues et sont vides : PurchaseEvent, memberships, timing assertions, classifications de composantes et assertions de continuité. Ces lignes privées restent hors Git.

Dry-run final lié à l'implementation identity produit `11906d2f1debde669497a931cb5e85c412d83fb5` :

| Champ | Valeur |
| --- | --- |
| project | `ipuuhxrblxormwgoaqnz` |
| householdScope | Household réel autorisé ; identifiant pseudonyme volontairement non reproduit dans Git |
| asOf | `2026-09-07T12:00:00Z` |
| dataRevision / analyticsRevision | `1 / 79` |
| candidateId | `8a7a512a-9440-5e24-a3eb-e14c404cdd83` |
| factsHash | `bc43a863976f70a72e10d6b3e706dbad4f0f5f9342b74f8d07da1f7d591520e2` |
| manifestHash | `255dfa42eb656a5e4c44d19eead410e86cbca826fd48bcf0a066973e39d57664` |
| artifacts / snapshots / instances | `1 / 140 / 140` |
| capabilities disponibles / gated | `22 / 2` |
| gated | `GLOBAL_PRODUCT_DETAIL`, `GLOBAL_ROUTE_DETAIL` |

Deux préparations identiques sur les mêmes inputs et l'ancienne identity de baseline ont produit les mêmes candidateId, factsHash, manifestHash, keys et ordre. Le test intégré prouve en plus la stabilité sous permutation technique et la sensibilité aux Facts/outputs, versions, capability et jeu d'instances. Une modification documentaire hors producteur ne change pas le candidat.

## Loader Production snapshot-only

`src/server/query/global-v2-production-loader.ts` charge uniquement le snapshot actif `analysis_global_manifest`, son manifest durable puis les snapshots de la génération épinglée. Il contrôle publication, révision, factsHash, manifestHash, complétude et révisions. `global-v2-production-services.ts` refuse toute clé hors manifest et valide contrats, signatures, policies, metadata, invalidation et identité de génération via le runtime existant.

`/api/global-v2/query` sert seulement cette génération épinglée. Le client envoie l'identité attendue ; une réponse tardive ou mélangée est rejetée. Il n'existe aucun fallback legacy et aucune interface de producteur dans ce chemin. Le test intégré observe une lecture snapshot et zéro lecture producteur.

`/analyse-globale` reste OFF en Production tant que `GLOBAL_V2_ROUTE_ACTIVE` n'est pas exactement `true`. OFF affiche `GlobalV2ActivationPending`. Si l'activation future est ON mais que la génération manque ou est incompatible, la route affiche l'erreur locale fail-closed `GlobalV2Unavailable`, sans calcul de remplacement. Aucune variable n'a été modifiée dans ce lot.

## Corrections d'intégration strictement nécessaires

Le dry-run réel a révélé trois incompatibilités techniques bornées : unités registry M1 `EUR/month`, unité Typical M2 `EUR/month`, et répétition de la même dimension Canonical avec preuves complémentaires. Les adapters ont été alignés sur les contrats certifiés ; une vraie contradiction d'identité ou d'état continue d'échouer fermée. La projection expanded est bornée au budget officiel de 50 lignes, avec égalité exacte entre entités exposées et instances détail.

## T02 et validations

| Closure | Résultat |
| --- | --- |
| Pont candidat P19A déterminisme/sensibilité/snapshot-only | `33/33 PASS` |
| Primary ReadModels | `83/83 PASS`, 10/10 schemas |
| Query instances | `57/57 PASS`, 32/32 RuntimeSchemas, producer reads 0 |
| Publication/manifest local | `57/57 PASS` |
| Frontend/runtime épinglé | `286/286 PASS`, fixtures 71/71, live writes 0 |
| TypeScript | PASS |
| Architecture | PASS, 561 fichiers |
| Build Next Production | PASS ; `/analyse-globale` et `/api/global-v2/query` dynamiques |
| `git diff --check` | PASS après normalisation EOF |
| Secrets/env/exports privés dans Git | NONE |

Les producteurs M1–M10 non modifiés n'ont pas été rejoués individuellement : le dry-run les traverse via leurs APIs officielles et la closure T02 est bornée au pont, aux projections, au manifest, à Query et au frontend. Aucune migration supplémentaire n'est nécessaire.

## Statut et suite autorisée

Le candidat est dérivé des vrais inputs/producteurs/versions mais n'est pas publié. Son implementation identity produit est le checkpoint local `11906d2f1debde669497a931cb5e85c412d83fb5`, encore non poussé/non déployé. Le candidat devra être revalidé après déploiement externe de cette même identité avant toute publication P19.

`P19A_LIVE_CANDIDATE_ORCHESTRATOR = PASS`

`P19A_PRODUCTION_SNAPSHOT_LOADER = PASS`

`P19A_LOCAL_IMPLEMENTATION = PASS`

`GLOBAL_ANALYTIC_CANDIDATE = LIVE_DERIVABLE`

`GLOBAL_ROUTE_V2 = INACTIVE_READY_FOR_P19`

`GLOBAL_SCHEMA_LIVE_GATE = PASS`

`GLOBAL_PUBLICATION = NOT_STARTED`

`SUPABASE_LIVE_WRITES = NONE`

`P19_PREAUTHORIZATION = READY_AFTER_CODE_DEPLOYMENT`
