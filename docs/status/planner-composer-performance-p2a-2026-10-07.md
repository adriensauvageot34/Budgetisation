# Composer — performance P2-A — 2026-10-07

P2-A certifié : trois commits produit indépendants, benchmarks avant/après et parité conservée. R5 est inclus dans le HEAD de départ.

## Preuve de neutralité, rédigée avant le patch C

`evaluatePlanScenario` fournit aux deux compilations le même objet world, la même Baseline, les mêmes external intents, compilerVersion et modelVersions. Les seules différences sont l'état sémantique de référence vide et `forcedOwnedSlotKeys` de la référence. Pour le Compiler `planner-semantic-compiler@v6-headless`, `materializePlanSlots` traite l'argument absent comme `[]` ; le paramètre forcé n'est utilisé que pour la propriété owned. Aucun owner compile/derive ne dépend d'un timestamp courant implicite dans ce chemin.

Réutiliser l'objet compilé complet et le résultat derive complet seulement si :

- la version du Compiler est exactement celle auditée ci-dessus ; une future version impose un nouveau contrôle et force entre-temps le recalcul ;
- le JSON canonique de **tout l'état normalisé** est égal au JSON canonique de `emptyPlanSemanticState(targetMonth)`, y compris version, mois, préférences, anchors, flexibility, controls et contexts ;
- `baselineConsumptions` et `neutralizedLegacyAssumptions` sont vides ;
- l'owner existant `materializePlanSlots` produit exactement le même JSON canonique complet pour l'état courant sans forced keys et l'état de référence avec les forced keys du manifest. La comparaison comprend identité, owned, conditionalAccepted, effective/remaining amounts/counts, knowledge, sourceRefs et tous les autres champs.

Révision de la preuve avant son implémentation : le world réel capturé contient une Need automatiquement owned et son entrée financière synthétique, sans contrôle ni Context. Le premier guard conservateur refusait cette réutilisation. Or le paramètre forcé ne peut changer aucun slot lorsque les deux matérialisations complètes sont strictement identiques : il ne fait alors que répéter un ownership déjà structurel. Les deux suites d'étapes restantes du Compiler ont dès lors les mêmes inputs normalisés. Réutiliser aussi dans ce cas est certifié par cette comparaison, sans inventer de règle de Need ou d'ownership dans le wrapper. Une forced key qui change le moindre slot impose le recalcul. L'argument forcé n'est utilisé nulle part ailleurs dans v6 et ne figure pas brut dans le manifest.

Cette preuve couvre SET_STATE et les suggestions acceptées via leurs controls ; PATCH_CONTEXT, component selection, funding, mobility et Need attaché via leurs contexts ; CANCEL_CONTEXT via son état final normalisé. Un contrôle explicitement remis à sa valeur initiale reste un contrôle et force le recalcul. Une annulation partielle laisse un Context et force le recalcul. Les préférences seules forcent le recalcul. Une Need automatiquement owned peut être réutilisée uniquement après la comparaison complète des slots ; une décision sur cette Need force le recalcul. Les UNKNOWN de la Baseline sont conservés dans les deux objets partagés ; aucune conversion n'est ajoutée.

Les identifiants et numéros de PlanRevision sont utilisés dans previewDigest, après compile/derive ; ils ne changent pas les inputs de ces deux owners. Un Plan explicitement neutre peut donc réutiliser l'évaluation, tout en gardant son previewDigest et ses stale guards propres. Aucun résultat ne survit à cet appel, et Apply garde son server re-read/recompile.

En cas de différence ou de doute : deuxième compilation et deuxième derive habituels. Les évaluations marginales restent inchangées. Aucun changement au Compiler métier, à deriveMonthScenario, à l'UI, aux queries ni à Supabase.

## Code et scopes

HEAD_BEFORE : `d5e7965598e0bcc86c40e5ddc687a3a1cf2c6005` (audit, code produit R5 inclus). HEAD_AFTER_A : `f7b42e81bea7f88318ba110ed59faf3b568d4829`. HEAD_AFTER_B : `e854e8386bc2ba805a3ed410e83acf789a4922b7`. HEAD_AFTER_C : `71bb6d6b82e9468dd2ae44dd015544018fb103da`. Branche `main`, propre au départ, sans rollback. Le commit de rapport/helpers est distinct des trois commits produit.

**A — Instant.** Une Map est créée dans chaque appel de `buildGlobalM7MobilityContextAuthority`, puis passée explicitement aux helpers temporels. La clé est la représentation timestamp brute complète, offset inclus : l'appel réutilisé est uniquement `Temporal.Instant.from(value)`, sans timezone, mode ou policy variable. Deux représentations avec des offsets distincts gardent deux clés même si elles désignent le même instant. La conversion d'une heure civile par `PlainDateTime.toZonedDateTime(householdTimeZone).toInstant()` reste indépendante : aucun partage entre civil time, zones ou DST. Seuls les parsings réussis sont enregistrés. Les erreurs ne sont pas mémorisées ; les comportements null/invalid/unknown et les short circuits restent ceux du helper initial. Les consumers utilisent compare/add/subtract immuables ; aucun consumer ne modifie l'Instant partagé. La Map meurt avec le build, y compris entre deux builds du même household.

**B — timezone.** `createHouseholdTimeZoneValidationScope(householdId)` capture la fonction de validation existante et conserve uniquement ses résultats réussis dans une Map privée. Clé : household de ce scope + littéral timezone exact + implémentation du validateur capturée. Ni canonicalisation d'alias ni brand forgé. Une timezone étrangère au household ou invalide suit la validation ordinaire et n'enseigne rien au scope. Chaque nouvelle instance de `CanonicalRepository`, créée pour une requête utilisateur autorisée, reçoit un nouveau scope ; deux utilisateurs/requêtes du même household ne partagent pas cette Map. Le scope est passé explicitement aux cinq projectors/parsers de facts et aux six appels de déduplication Canonical. Les autres callers gardent le validateur normal. La mesure réelle est **2**, pas 1 pour tout le pipeline : une validation Canonical à forte réutilisation et une validation indépendante de frontière externe. Aucun cache global, interrequêtes, TTL, persistence ou raw timezone acceptée sans validation.

**C — évaluation.** Le wrapper de preview partage l'objet `CompiledSemanticPlan` complet et le résultat `deriveMonthScenario` complet uniquement sous la preuve détaillée ci-dessus. Le lookup ne survit pas à cet appel. Les décisions non neutres, marginals, server re-read d'Apply, garde de revision/authority/pricing et calcul financier existant restent leurs owners habituels. Il n'y a aucune reconstruction partielle de projection ou somme React.

## Environnement et méthode

Windows, Ryzen 7 3700U (8 processeurs logiques), environ 6 GB de RAM, Node 24.19.0, Next 16.2.6, build de production Turbopack. Pression mémoire élevée, variance importante ; aucune promesse de latence Vercel/production. Les builds, suites et campagnes CPU ne tournent pas simultanément. Aucun réglage système ni changement de données pour améliorer les chiffres.

Les owners serveur, probe et actions natives du navigateur sont ceux de P0/P1. Le cutoff des campagnes owner/replay est `2026-10-06T21:00:00Z` ; les 25 replays utilisent la même capture de réponses, échouent sur toute réponse manquante, sans fallback réseau. La copie instrumentée est hors checkout, marquée et sans Git ; seules les probes de diagnostic s'y ajoutent au code réel de chaque commit. Les prototypes globaux P1 de memo/neutralité ne sont pas utilisés comme implémentation produit.

Le compteur A distingue désormais les appels du helper et ses vrais parsings. Avant A, chaque appel était un parsing ; après A, seuls les misses sont des parsings. Les comparaisons et les algorithmes n'ont pas changé. Aucun compteur diagnostic global n'est ajouté au produit. Le seul changement du helper navigateur existant permet un timeout CDP explicite plus long (`COMPOSER_PERF_CDP_METHOD_TIMEOUT_MS=180000`, défaut toujours 30000) : le cold avant patch dépassait 30 s. Les bornes de mesure, interactions natives, viewport 1728×900 et critères TTI restent identiques. TTI est un proxy concret : Board hydraté puis recherche Library native traitée ; ce n'est pas une garantie de temps d'Apply ou d'assistant distant.

Les fichiers raw privés, cookies et captured world restent hors Git dans `C:/Users/Manon/Documents/Codex/2026-10-05/vu-x20/outputs/planner-performance-p2a`. Les réponses HTTP ne sont pas publiées. Les nouveaux goldens committés sont uniquement synthétiques. Le rapport ne publie que métadonnées, timings et hashes.

## Incidents et limites conservés

La première tentative navigateur baseline a rencontré l'expiration du daemon Chrome ; une série complète de remplacement est mesurée. Le premier cold a dépassé le timeout protocolaire CDP ; sa trace d'échec est conservée et le cold complet réussi est séparé. Une première série A a été suspendue plusieurs heures par la machine, puis invalidée par expiration de session : elle reste dans `a/owner-real-interrupted`, hors statistiques comparables. La nouvelle série A contient quatre lectures terminées et paritaires ; la cinquième a été interrompue par fin de turn. Son effectif reste explicitement n=4, aucun cinquième résultat n'est inventé.

Les sessions Auth du navigateur d'audit ont été renouvelées, avec login/logout Auth permis, avant les campagnes suivantes. La lecture automatique d'Historique après login et son POST de query en lecture seule sont hors des fenêtres Composer. Les probes bloquent toute mutation REST/Storage métier et tout endpoint RPC ; aucune donnée métier distante n'est écrite. Aucune tentative d'Apply distant n'est effectuée.

Les mesures successives ne sont pas randomisées et le réseau reste partagé. La comparaison C pure utilise cinq paires alternées du **vrai code B** chargé depuis Git et du **vrai code C**, avec la même capture complète, cutoff et digest de résultat intégral. Elle remplace l'ancien prototype fondé seulement sur le nombre de controls/contexts. Les gains CPU de A/B/C peuvent se recouvrir : les tableaux de différences portent sur les états successifs, sans addition de gains isolés P1.
<!-- P2A_MEASUREMENTS -->

## Résultats complets

Médianes en millisecondes. FIRST_RESPONSE et TTI du tableau principal sont ceux du hard refresh. M7 total inclut les lectures de ses dépendances ; M7 sync mesure la tranche synchrone sans attente réseau, proxy du coût CPU. Les spans parallèles ne sont pas additionnés. GET = requête Next Composer ; le harness owner complet comporte 313 GET métier et 2 GET Auth.

| État | Replay ms | Server ms | First response | TTI | M7 total ms | M7 sync ms | Temporal parses | TZ validations | Compile | Derive | GET |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Baseline | 32353.34 | 39715.26 | 59915.40 | 61360 | 31877.88 | 18122.27 | 2463850 | 10767 | 2 | 2 | 291 |
| A | 21188.43 | 28673.01 | 41002.30 | 42673 | 21886.58 | 8593.82 | 3344 | 10767 | 2 | 2 | 291 |
| A+B | 15045.91 | 28026.28 | 20100.10 | 20943 | 22339.86 | 10602.01 | 3344 | 2 | 2 | 2 | 291 |
| A+B+C | 19602.44 | 36988.63 | 33475.80 | 35883 | 27086.13 | 15139.91 | 3344 | 2 | 1 | 1 | 291 |
| Final A+B+C | 11742.90 | 29716.03 | 26177.10 | 27614 | 22992.34 | 9632.54 | 3344 | 2 | 1 | 1 | 291 |

Toutes les campagnes replay sont n=5. Owner réel : n=5, sauf A n=4. Navigations et refreshs : n=5 avant et final, n=3 à chaque étape intermédiaire. Les 24 lectures réseau owner complètes, les 25 replays et le replay profilé ont les mêmes digests et métadonnées comparables.

| État / mesure | n | Min ms | Médiane ms | Max ms | p95 ms |
|---|---:|---:|---:|---:|---:|
| Baseline / replay | 5 | 28891.69 | 32353.34 | 41257.53 | 41257.53 |
| Baseline / server | 5 | 33607.26 | 39715.26 | 46848.29 | 46848.29 |
| Baseline / M7 sync réel | 5 | 16408.22 | 18122.27 | 27568.60 | 27568.60 |
| Baseline / first response hard | 5 | 46884.90 | 59915.40 | 67852.40 | 67852.40 |
| Baseline / TTI hard | 5 | 48519.00 | 61360.00 | 69157.00 | 69157.00 |
| Baseline / TTI client | 5 | 51080.00 | 55199.00 | 59200.00 | 59200.00 |
| A / replay | 5 | 17809.75 | 21188.43 | 52141.00 | 52141.00 |
| A / server | 4 | 25522.63 | 28673.01 | 43358.30 | 43358.30 |
| A / M7 sync réel | 4 | 6044.79 | 8593.82 | 15228.46 | 15228.46 |
| A / first response hard | 3 | 31420.70 | 41002.30 | 47047.60 | 47047.60 |
| A / TTI hard | 3 | 33324.00 | 42673.00 | 49185.00 | 49185.00 |
| A / TTI client | 3 | 43924.00 | 45391.00 | 67371.00 | 67371.00 |
| A+B / replay | 5 | 12325.98 | 15045.91 | 20664.17 | 20664.17 |
| A+B / server | 5 | 25668.61 | 28026.28 | 46225.41 | 46225.41 |
| A+B / M7 sync réel | 5 | 8630.04 | 10602.01 | 17902.60 | 17902.60 |
| A+B / first response hard | 3 | 17857.40 | 20100.10 | 20375.10 | 20375.10 |
| A+B / TTI hard | 3 | 18483.00 | 20943.00 | 21762.00 | 21762.00 |
| A+B / TTI client | 3 | 27652.00 | 30110.00 | 33182.00 | 33182.00 |
| A+B+C / replay | 5 | 16736.80 | 19602.44 | 21961.56 | 21961.56 |
| A+B+C / server | 5 | 33285.76 | 36988.63 | 38634.96 | 38634.96 |
| A+B+C / M7 sync réel | 5 | 10556.46 | 15139.91 | 19117.65 | 19117.65 |
| A+B+C / first response hard | 3 | 22157.00 | 33475.80 | 37416.70 | 37416.70 |
| A+B+C / TTI hard | 3 | 23419.00 | 35883.00 | 38802.00 | 38802.00 |
| A+B+C / TTI client | 3 | 47490.00 | 49280.00 | 64781.00 | 64781.00 |
| Final A+B+C / replay | 5 | 9712.76 | 11742.90 | 17622.98 | 17622.98 |
| Final A+B+C / server | 5 | 21877.90 | 29716.03 | 39620.64 | 39620.64 |
| Final A+B+C / M7 sync réel | 5 | 7954.72 | 9632.54 | 16743.42 | 16743.42 |
| Final A+B+C / first response hard | 5 | 21162.70 | 26177.10 | 36944.30 | 36944.30 |
| Final A+B+C / TTI hard | 5 | 22379.00 | 27614.00 | 38346.00 | 38346.00 |
| Final A+B+C / TTI client | 5 | 31139.00 | 32726.00 | 43689.00 | 43689.00 |

Le p95 utilise le rang supérieur ; sur ces petits effectifs il correspond au maximum et ne constitue pas un SLA. Les statistiques complètes de M7 total, M7 sync offline, process CPU, payload et réponses navigateur sont dans `planner-composer-performance-p2a-metrics-2026-10-07.json`.

| Différence observée entre états successifs | Gain replay ms / % | Gain server ms / % | Gain TTI hard ms / % |
|---|---:|---:|---:|
| GAIN A | 11164.91 / 34.51 % | 11042.24 / 27.80 % | 18687.00 / 30.45 % |
| GAIN B après A | 6142.52 / 28.99 % | 646.74 / 2.26 % | 21730.00 / 50.92 % |
| GAIN C après B | -4556.53 / -30.28 % | -8962.35 / -31.98 % | -14940.00 / -71.34 % |
| GAIN COMBINED final | 20610.44 / 63.70 % | 9999.23 / 25.18 % | 33746.00 / 55.00 % |

La série C complète est plus lente que B malgré une compilation/derive évitée : la variance de M7/réseau/mémoire dépasse ce petit gain. Elle reste publiée et n'est pas remplacée par une sélection de runs rapides. Sur les cinq paires pures alternées B/C : médianes 1081.97 → 609.89 ms ; médiane des gains appariés 348.14 ms. Chaque paire compare le résultat métier intégral et confirme 2→1 compile et 2→1 derive. Le benchmark final indépendant du même code C donne la nouvelle baseline ; il ne prouve pas que C cause à lui seul la différence entre les deux séries C/final.

| Mode cold (process Next neuf + contexte navigateur neuf, cookies Auth existants) | n | Min | Médiane | Max / p95 |
|---|---:|---:|---:|---:|
| Baseline | 1 | 133574.00 | 133574.00 | 133574.00 |
| Final A+B+C | 3 | 21402.00 | 23406.00 | 23464.00 |

Cold désigne les processus/contextes, pas un vidage du cache OS. Le cold initial n=1 est insuffisant pour un gain statistique fiable ; les trois cold finaux sont tous réussis. Les hard/client finaux sont warm dans une même série, client puis hard. Les étapes intermédiaires suivent aussi cet ordre ; la baseline initiale hard/client et son cold séparé restent conservés.

| Navigation client | Headers RSC médiane ms | Fin de réponse RSC médiane ms | TTI médiane ms |
|---|---:|---:|---:|
| Baseline | 95.59 | 54330.68 | 55199.00 |
| Final A+B+C | 82.33 | 30847.36 | 32726.00 |

Next envoie rapidement les headers du stream RSC en navigation client ; ce premier byte ne signifie pas que le Plan est disponible. C'est pourquoi le tableau principal utilise le first response du document hard, et présente séparément la fin du stream client.

## Profil CPU comparable à P0/P1

| Samples dans la fenêtre owner, ms (n=1 par profil) | P0/P1 avant | Final |
|---|---:|---:|
| M7 + descendants | 27123.79 | 8069.47 |
| Timezone validator + descendants | 2833.16 | 1.60 |
| (garbage collector) | 4221.99 | 1852.20 |
| Other CPU | 6785.13 | 5225.80 |
| Fenêtre owner totale | 41211.10 | 15184.48 |

Sous-arbres inclusifs supplémentaires, qui se recouvrent et ne doivent pas être additionnés aux buckets ci-dessus :

| Sous-arbre | Avant ms | Final ms |
|---|---:|---:|
| instant | 17549.09 | 402.28 |
| overlaps | 23115.60 | 6197.48 |
| resolvePairwisePresence | 11442.98 | 6837.54 |
| linkTemporalAssessment | 1198.61 | 269.16 |

Le sous-arbre instant inclut le parsing et maintenant le lookup de memo : 17549.09 → 402.28 ms. Les self samples du polyfill Temporal passent de 20457.91 à 6672.77 ms ; ils comprennent aussi les comparaisons et l'arithmétique de dates, pas seulement Instant.from. La baisse de GC est une conséquence possible des allocations évitées, pas un gain indépendant. Les profils excluent le chargement TS initial par alignement sur le span owner, et gardent le même cutoff et replay. Les traces/probes et l'horloge gelée ont un coût, conservé dans les deux méthodes.

Le hotspot spécifique restant est M7/presence : 832557 overlaps et environ 6197 ms de samples inclusifs dans ce profil final. Les conversions civiles et autres traitements Temporal restent présents. Suite recommandée seulement : P2-B, indexation des intervalles historiques de présence, à valider séparément contre les mêmes oracles. Aucun code P2-B/C/D ou snapshot n'a été commencé.

## Parity matrix

| Oracle | Avant | Après | PASS |
|---|---|---|---|
| PlanningBaseline digest | c27f43b48ee9511c… | c27f43b48ee9511c… | YES |
| Semantic manifest | 34360075778b2f89… | 34360075778b2f89… | YES |
| Projection cockpit | 2cb51bb83000eb0b… | 2cb51bb83000eb0b… | YES |
| Cartes / board | 968cbee0b2f3eb2f… | 968cbee0b2f3eb2f… | YES |
| Capabilities de drop | f587ccefac1249fc… | f587ccefac1249fc… | YES |
| UNKNOWN set / diagnostics / completeness | 22 goldens pré-A | 22 résultats identiques, 9 hashes par cas | YES |
| Context / Component / PlanSlot identities | 22 goldens pré-A | 22 résultats identiques, 9 hashes par cas | YES |
| MobilityIntent / PhysicalJourney identities | 22 goldens pré-A | 22 résultats identiques, 9 hashes par cas | YES |
| NeedOccurrence identities / sourceRefs | 22 goldens pré-A | 22 résultats identiques, 9 hashes par cas | YES |
| Savings / protected / adjustable | 22 goldens pré-A | 22 résultats identiques, 9 hashes par cas | YES |
| Preview / manifest complet / projections | 22 goldens pré-A | 22 résultats identiques, 9 hashes par cas | YES |
| Apply dry-run/recompile | même Preview pré-A certifié | suites C2/C7/C8 sur PostgreSQL synthétique, re-read et stale guards | YES |
| Reload simulation | état/projection Preview | mêmes semantic state, manifest, scenario et projection après Apply | YES |

Les hashes complets sont dans le JSON de mesures et `scripts/fixtures/planner-performance-parity.json`. Le hash UNKNOWN du harness réel porte sur les diagnostics ; la comparaison complète et récursive de knowledge/unresolved/diagnostics ainsi que des identités est fournie par les 22 fixtures, en plus des objets complets. Aucun PASS ne repose sur un screenshot ou un montant final seul. Les scénarios couvrent NightOut taxi/tram, ShortStay consommation confirmée/incertaine, deux Needs dans un achat, external intent, category, savings, suggestion acceptée, legacy, unknown cost/funding et preferences.

Les suites Apply/Reload exécutent la migration C0 inchangée et sa RPC dans PGlite sur des données synthétiques. Elles ne lancent ni stack Supabase locale ni migration distante. Les canaries de tables historiques refusent toute écriture ; stale authorities/revision/pricing gardent zéro write avant Apply. Le Compiler métier, le financial owner, les routes prospectives et Apply sont inchangés.

## Vérifications et limites de tests

42 suites pertinentes réussies, typecheck `tsc --noEmit` et build Next production réussis. A, B et C sont testés séparément avant leurs commits ; le build final est celui du commit C et sert aux ouvertures finales. La modification supplémentaire de package.json enregistre uniquement les aliases de guards, sans dépendance.

- `check-canonical-mobility.mjs` : PASS
- `check-personal-mobility.mjs` : PASS
- `check-mobility-context.mjs` : PASS
- `check-mobility-trip-contexts.mjs` : PASS
- `check-mobility-trips.mjs` : PASS
- `check-monthly-mobility-narrative.mjs` : PASS
- `check-mobility-build-memo.mjs` : PASS
- `check-timezone-validation-scope.mjs` : PASS
- `check-planner-neutral-evaluation.mjs` : PASS
- `check-planner-performance-parity.mjs` : PASS
- `check-phase2-planner-baseline.mjs` : PASS
- `check-phase2-planner-simple-levers.mjs` : PASS
- `check-phase2-planner-kernel.mjs` : PASS
- `check-phase2-planner-contexts.mjs` : PASS
- `check-phase2-planner-mobility.mjs` : PASS
- `check-phase2-planner-renewals.mjs` : PASS
- `check-phase2-planner-headless.mjs` : PASS
- `check-phase2-planner-composer.mjs` : PASS
- `check-phase2-planner-interactions.mjs` : PASS
- `check-phase2-planner-atomic-ui.mjs` : PASS
- `check-phase2-planner-visual-fidelity.mjs` : PASS
- `check-phase2-planner-final-polish.mjs` : PASS
- `check-phase2-category-observed-history.mjs` : PASS
- `check-phase2-month-decisions.mjs` : PASS
- `check-phase2-month-decision-engine.mjs` : PASS
- `check-phase2-savings-allocations.mjs` : PASS
- `check-phase2-forecast-temporal-mode.mjs` : PASS
- `check-phase2-planned-finance.mjs` : PASS
- `check-phase2-planned-routes.mjs` : PASS
- `check-phase2-planned-car.mjs` : PASS
- `check-phase2-planned-guards.mjs` : PASS
- `check-planner-c0-contracts.mjs` : PASS
- `check-planner-c0-persistence.mjs` : PASS
- `check-architecture-imports.mjs` : PASS
- `check-composer-performance-probe.mjs` : PASS
- `check-canonical-in-batching.mjs` : PASS
- `check-c2-purchase-aware.mjs` : PASS
- `check-global-v2-food-rhythm.mjs` : PASS
- `check-phase2-category-targets-choices.mjs` : PASS
- `check-phase2-october-contract.mjs` : PASS
- `check-phase2-temporal-forecast.mjs` : PASS
- `check-phase2-benefit-wallets.mjs` : PASS

Trois contrôles supplémentaires ne sont pas revendiqués PASS : `check-phase2-month-scenario` et `check-phase2-month-forecast` sont des scripts live arrêtés sur leurs préconditions avant réseau, sans configuration fournie ; `check-c4-purchase-aware` exige source/master Swile, snapshot privé et runtime spécifiques non raccordés ici. Ils restent notés NON REJOUÉS. La couverture financière pertinente est assurée par October contract, temporal forecast, category choices, benefit wallets et les suites Compiler/Headless avec le vrai owner. L'import Swile n'est pas modifié. Une tentative category choices s'est arrêtée sur UNDO_KEY_UNAVAILABLE ; seule cette suite a été relancée avec une clé d'encryptage synthétique dans le processus de fixtures, puis a passé les 36 oracles. Toutes les tentatives initiales, exclusions et relances restent dans le JSON de mesures.

Les guards ne dépendent d'aucun seuil de timing CI : M7 répété parse chaque timestamp distinct réussi une fois par build ; un nouveau build/household repart à zéro ; les erreurs restent non mémorisées. B valide 500 fois le même littéral une seule fois par scope et teste users/households/zones/builds séparés, invalid, DST 23/25 h et frontière mensuelle. C compte les compilations réellement terminées et les derives, et exige la seconde référence pour tous les cas non neutres. Les marginals qui échouent avant derive gardent leur diagnostic existant. Un changement forcé de slot ou une future version de Compiler ferme le guard.

Commande regroupée pour ces quatre guards : `npm run check:planner-performance-p2a`. Les assistants et l'Apply réel distant ne sont pas benchmarkés : ils restent couverts par fixtures et sans autorisation d'écriture distante.

## Queries, payload, writes et commits

291 GET métier par requête Next Composer avant/après, 313 par harness owner complet, même multiset exact de requêtes au cutoff (SHA256 `81f78ddd1f383e2bc4860236b9b816c54543783e41e59fe13fe58aa4dbaf9d8c`). Réponses REST décodées : 15773984 octets avant/après ; DTO UI : 273000 octets avant/après ; 15 cartes, 141 assets, 0 Context dans cette capture réelle. Les compteurs de compile/derive passent de 2/2 à 1/1 sur cet état certifié, tandis que les parses M7 passent de 2463850 à 3344 et le validateur timezone de 10767 à 2. Aucun gain de query count, SQL, payload ou Clay n'est attribué à P2-A.

Le diff produit est limité à mobility-context, core/time, facts Canonical/validation/dedupe, CanonicalRepository et preview.ts. Aucun fichier src/app, CSS, SQL ou migration modifié ; aucun Compiler métier ni deriveMonthScenario modifié. Zéro mutation REST/Storage ou RPC métier distante, zéro tentative de remote Apply. Les probes Node/navigateur bloquent ces méthodes. Aucun push, déploiement Vercel, reset ou migration distante. Les processus navigateur/Next d'audit sont arrêtés ; les artefacts générés par tests restent hors Git.

HEAD_FINAL_CODE = `71bb6d6b82e9468dd2ae44dd015544018fb103da`. HEAD_FINAL (commit de rapport/helpers) se résout exactement par `git log -1 --format=%H -- docs/status/planner-composer-performance-p2a-2026-10-07.md` ; son SHA complet est également communiqué dans la livraison. Cette séparation évite d'inventer un hash de commit auto-référent dans le document.

```ini
TEMPORAL_MEMO_BUILD_LOCAL = PASS
TIMEZONE_REQUEST_REUSE = PASS
NEUTRAL_EVALUATION_REUSE = PASS
BUSINESS_DIGEST_PARITY = PASS
PROJECTION_PARITY = PASS
UNKNOWN_PARITY = PASS
IDENTITY_PARITY = PASS
PREVIEW_APPLY_RELOAD_PARITY = PASS
REMOTE_WRITES = 0
MIGRATION_REQUIRED = NO
REAL_COMPOSER_REBENCHMARKED = YES
P2_B_NOT_STARTED = YES
P2_C_NOT_STARTED = YES
P2_D_NOT_STARTED = YES
SNAPSHOT_NOT_STARTED = YES
PLANNER_COMPOSER_PERFORMANCE_P2A = PASS
```

Avant P2-A, Composer mettait médiane 61.36 s à devenir interactif en hard refresh. Après P2-A, il met 27.61 s. Le CPU M7 (tranche synchrone réelle) passe de 18.12 s à 9.63 s. Le nombre de parsings Temporal passe de 2463850 à 3344. La validation timezone passe de 10767 à 2. La réutilisation neutre évite une compilation et un derive par évaluation certifiée. Le gain réel observé en hard refresh est donc 33.75 s / 55.00 %. Le prochain hotspot mesuré est désormais M7, comparaisons de présence/intervalles.
