# P14-P3 — Lecteurs historiques World / Canonical

13 octobre 2026 — **`SAFE_LOCAL_GAIN_REAL_PERFORMANCE_NOT_CERTIFIED`**.

**Réponse : 10 des 53 GET historiques ciblés sont réellement supprimés dans les ouvertures authentifiées exécutées, sans divergence de preuve financière.** Sur la fixture étendue, 44 des 61 GET des trois tables ciblées, plus 2 GET de liens, sont supprimés. Ces résultats ne sont pas interchangeables.

La latence globale ne s'améliore pas dans la médiane réelle exécutée. Le prototype est conservé **désactivé par défaut**, avec activation explicite par drapeau. Aucun gain utilisateur stable, P95 < 5 s ou ouverture < 2 s n'est certifié. Aucun changement de production.

## A. Base, code et périmètre

Branche : `codex/composer-v3-p14-p3-historical-readers`.
Base exacte : `37055156f0a9bf59700405e349fee0c55c0363b0`.
Ascendance vérifiée : P2 → P1 `a934f60` → Express `fc8dea2` → CSS `deccdcd` → golden `7b38276` → P13 `7d7e883`.
La référence locale `main` reste `578adc2efcef8b29b5ee8a794772e15fcdf66d98` ; elle n'a pas été déplacée par cette mission. Le SHA de livraison est le commit contenant ce rapport, identifiable par `git rev-parse codex/composer-v3-p14-p3-historical-readers`.

| Fichier produit | Changement |
|---|---|
| `src/server/canonical/in-batches.ts` | Callback de complétude après réussite et fusion de tous les groupes ; aucun callback sur le fallback plafonné |
| `src/server/canonical/historical-request-rows.ts` | Nouvelle mémoire de lignes positives et de périodes couvertes, exclusivement dans une instance de repository |
| `src/server/canonical/repository.ts` | Partage historique par clé, projections compatibles et sous-périodes complètes |
| `src/server/phase2/planner/runtime.ts` | Drapeau serveur opt-in Composer ; aucun changement des autres consommateurs par défaut |

Les sept méthodes demandées ont été examinées. `loadLifeEventRecord` conserve volontairement sa requête individuelle et sa vérification d'unicité : une ligne issue d'une lecture multiple ne remplace pas son contrôle. Les contrats, migrations, publications, Finance V2, Apply et interface restent inchangés. Les sondes ont été retirées des fichiers produit après les deux déploiements Preview.

## B. Deux variantes exécutées

| Variante | Hypothèse / prototype | Résultat | Décision |
|---|---|---|---|
| A, `historicalReads: keys` | Une lecture complète par clé peut satisfaire les ensembles chevauchants de même projection/filtre/ordre | Parité PASS ; 78 → 52 transports dans la fixture | Conservée comme mode limité ; pas de mesure authentifiée spécifique A |
| B, `historicalReads: projected` | A + lignes positives déjà disponibles + sous-périodes couvertes + participation métier commune | Parité PASS ; 78 → 32 transports fixture ; 284 → 274 GET authentifiés, Auth inclus | Conservée en opt-in ; activation générale non recommandée sur ces seules mesures |

B utilise les **8 colonnes déjà nécessaires au lecteur des participations métier** pour le transport commun. Le lecteur des faits reçoit ensuite exactement ses **4 colonnes d'origine** avant parsing. Aucun `select('*')` supplémentaire : les lectures complètes d'événements existaient déjà. Une projection partielle ne satisfait jamais une demande `*`.

Les identités de localisation ne fournissent que `localization_id,place_id`. Une Présence ne prouve pas l'absence d'un Transit ou d'une autre occurrence. Si toutes les identités demandées ne sont pas disponibles, la requête originale complète est conservée. Les groupes relationnels et l'ordre sont conservés par le mécanisme de batching existant.

Une plage d'événements ne satisfait une sous-plage qu'après succès et preuve de non-plafonnement ; filtre exact d'intersection `start_date < endExclusive && end_date >= start`. Une identité hors plage ou absente conserve sa recherche d'origine. Des projections incohérentes pour la même identité échouent sans publier partiellement les nouvelles lignes.

## C. Mesures fixture

Sources synthétiques : 24 mois, 960 person-days / Présences, 288 événements, 576 participations et 576 liens événement-lieu. Repository P2 chargé depuis **son fichier Git exact**, comparé aux variantes A/B. Trente appels logiques ciblés restent présents. Le vrai constructeur Global Mobility et les parsers Canonical sont exécutés ; les legs Mobility sans rapport avec le transport testé sont vides. Ce protocole ciblé n'est pas une mesure de `readWorld` réel.

| Indicateur | P2 | A | B |
|---|---:|---:|---:|
| `location_occurrences` GET | 25 | 16 | 10 |
| `life_event_participations` GET | 19 | 6 | 3 |
| `life_events` GET | 17 | 15 | 4 |
| Autres GET | 17 | 15 | 15 |
| Total GET simulés | 78 | 52 | 32 |
| Lignes transportées, répétitions comprises | 6 493 | 5 119 | 3 890 |
| Octets JSON transportés | 1 513 004 | 1 187 998 | 989 387 |
| Appels logiques ciblés | 30 | 30 | 30 |

Les faits et relations restitués sont égaux ; la diminution des lignes concerne leurs transports répétés, pas les faits retenus. Gain B : **46 transports, 523 617 octets (34,6 %)**.

27 échantillons alternés : 3 répétitions × 3 variantes × 3 latences simulées. Médianes en ms, maxima entre parenthèses. Le « P95 nearest-rank » est ici le maximum de trois valeurs, **pas un P95 stable**.

| Latence par transport | P2 mural | A mural | B mural | CPU processus médian P2 / A / B |
|---|---:|---:|---:|---:|
| 0 ms | 1 198,9 (1 204,0) | 1 084,9 (1 134,6) | 1 005,4 (1 014,4) | 1 187 / 1 110 / 1 094 |
| 15 ms | 2 208,4 (2 282,5) | 1 613,0 (1 637,8) | 1 212,2 (1 229,9) | 1 204 / 1 125 / 1 078 |
| 75 ms | 4 766,0 (4 784,1) | 3 039,6 (3 104,9) | 1 953,7 (1 954,5) | 1 250 / 1 172 / 1 062 |

CPU du client simulé, profil 75 ms : 382,7 → 184,2 ms médians. Le CPU processus peut dépasser le mural avec les workers ; ni ces valeurs ni la latence simulée ne représentent le SQL Supabase. Concurrence physique maximale observée : P2/A 9, B 7, toutes méthodes confondues ; la limite existante par opération n'est pas augmentée.

Mémoire : B conserve 1 248 identités positives et une plage ; 861 consultations d'identités et 6 sous-plages sont réutilisées. Payload JSON des **nouveaux** maps/plages : 267 485 octets, hors promises, métadonnées et cache préexistant par clé. Ce n'est pas la taille du heap retenu. Les deltas `heapUsed` bruts sont conservés ; ils sont bruités par le GC, jusqu'à des valeurs négatives, et ne prouvent pas une économie mémoire. Pour le profil 75 ms : delta observé P2 3,79–4,92 Mo, B 2,90–3,82 Mo, sans attribution causale.

## D. Mesures authentifiées protégées

Deux Previews, région **fra1** réellement observée, même compte Budgetisation, octobre 2026, mêmes permissions et empreinte financière. P1 activé dans les deux ; P2 présent dans les deux. Seule la variante historique diffère, `0` contre `2`, dans le même arbre produit instrumenté uploadé sans modification entre les déploiements.

- P2 : `dpl_DougtTp4ey2i5PpRDAA9UDGQe2VY`, [Preview protégée](https://budgetisation-1c050bjaq-adriensauvageot34-6137s-projects.vercel.app).
- P3 : `dpl_DxUzEzxEP864cktcyFL5mjBHHzv3`, [Preview protégée](https://budgetisation-fcb8q6jkd-adriensauvageot34-6137s-projects.vercel.app).

Les deux déploiements étaient READY. Sources locales uploadées, sans push ni promotion. Référence Preview : nouveau repository avec réutilisation historique désactivée, et non un build séparé de l'ancien fichier P2 ; la fixture vérifie en complément l'ancien repository exact.

Différence finale après mesure : la politique par défaut du drapeau devient désactivée ; les valeurs explicites `0`/`2` mesurées gardent le même comportement. Les scripts de tests/rapports ont ensuite été enrichis, sans changement supplémentaire des lecteurs mesurés. Le commit final sans sondes n'est pas prétendu identique octet pour octet au bundle instrumenté.

### Transports réellement observés, identiques dans les trois observations de chaque variante

| Indicateur | P2 | P3 B | Écart |
|---|---:|---:|---:|
| `location_occurrences` GET | 22 | 22 | 0 |
| `life_event_participations` GET | 20 | 10 | −10 |
| `life_events` GET | 11 | 11 | 0 |
| Total des trois sources | 53 | 43 | −10 (18,9 %) |
| Autres GET PostgREST, ouverture/bootstrap compris | 229 | 229 | 0 |
| GET PostgREST | 282 | 272 | −10 |
| GET Auth | 2 | 2 | 0 |
| Total GET, Auth inclus | 284 | 274 | −10 |
| Lectures physiques Canonical | 236 | 226 | −10 |
| Octets des trois sources | 2 313 644 | 2 085 546 | −228 098 |
| Octets PostgREST, Auth exclu | 11 744 470 | 11 516 372 | −228 098 (1,94 %) |
| Erreurs / `57014` dans les ouvertures exécutées | 0 / 0 | 0 / 0 | aucun timeout observé |

Les autres tables et leur volume ne changent pas. Les économies d'identités et de sous-plages fixture n'ont pas été observées sur les lieux/événements réels. Leur cause précise n'a pas été instrumentée : absence d'ensemble admissible couvrant, ordre des consommateurs ou plafond restent des explications possibles, pas des causes démontrées. Aucune réduction artificielle du périmètre n'a été tentée pour augmenter le gain.

### Durées brutes, secondes ; aucune observation supprimée pour améliorer la comparaison

| Observation chaude | P2 World | P3 World | P2 page serveur | P3 page serveur | P2 FRESH navigateur | P3 FRESH navigateur |
|---|---:|---:|---:|---:|---:|---:|
| 1 | 14,431 | 59,872 | 15,679 | 60,803 | 18,853 | 62,072 |
| 2 | 15,054 | 47,814 | 15,900 | 48,889 | 16,685 | 49,664 |
| 3 | 12,778 | 11,789 | 13,926 | 12,824 | 14,619 | 13,496 |
| P50, n=3 | 14,431 | 47,814 | 15,679 | 48,889 | 16,685 | 49,664 |
| Maximum, P95 descriptif n=3 | 15,054 | 59,872 | 15,900 | 60,803 | 18,853 | 62,072 |

Baseline-sources médian : 14,378 → 47,772 s. Compiler/Finance V2 dans P3 : 0,296–0,322 s ; il ne domine pas ces deux ouvertures lentes. Une lecture Canonical individuelle atteint **52,178 s**, puis **38,663 s**, sans erreur SQL. Le coût des en-têtes HTTP, celui du décodage Canonical et la somme des fetchs ne constituent **pas du temps SQL** ; la cause de ces attentes n'est pas identifiée. Les durées inclusives se recouvrent et ne doivent pas être additionnées pour expliquer World.

Limite de protocole : P2 est rendu dans un viewport 918×811 et P3 dans 1280×720 ; l'override navigateur n'a pas changé l'ancien onglet. Les marques FRESH/Board sont donc des observations internes, **pas une certification strictement comparable du rendu**. Les marques sont émises après le premier frame du Board interactif, sans chronométrage de l'outil Codex. Pas de simulation financière intermédiaire pendant ces reloads : Board et FRESH sont presque simultanés.

Deux ouvertures initiales après login sont exclues des statistiques chaudes, explicitement : World ~31,889 s P2 et 76,601 s P3. L'origine de navigation était la page de connexion, ce qui invalide leur marque client comme temps d'ouverture directe de Composer. Au total : deux ouvertures initiales + six reloads, aucune série supplémentaire après ces mesures. Ce résultat ne permet pas de prouver une régression causale de B, mais **ne permet surtout pas de revendiquer son accélération**.

## E. Parité, complétude et sécurité

**14 groupes P3 PASS** sur l'arbre final : répétitions, inclusions/chevauchements, identités absentes, événements hors période, Présence/Transit, projections 4/8/`*`, multipersonnes, lieux/événements et parent/enfant, ordre/doublons, pagination 1 200 lignes et erreur page 2, plafonds/fallbacks, UNKNOWN/PARTIAL, source rétroactive, foyers/repos distincts, concurrence, erreurs `57014`, permission `42501` et réseau simulées, publication Forecast inadmissible, frontières temporelles, historique 24 mois.

Égalité profonde des faits, relations et projections ; égalité de la Baseline et de la réponse Composer complète produite par Compiler/Finance V2 sur fixture PGlite. Empreinte Baseline + modèle complet commune P2/A/B :
`e622a6eb8c146709413ff89724a682ec8447db0a84c44ccf43a5c7611143364b`.

Empreinte réelle commune des preuves du modèle + Semantic Draft dans les six reloads :
`28c871e31ee64345ebbc814ed37963449bde4816da38fb93f074c7464fc9b559`.
Cette dernière preuve ne prétend pas exporter/comparer tous les faits personnels : aucune donnée personnelle, ligne réelle, montant ou secret n'est enregistré dans les artefacts de mesure.

Garanties :

- Une instance autorisée, un foyer, une requête ; aucun état historique global, persistant ou partagé entre appareils. Autorisation de scope conservée avant les recherches individuelles. Clients/RLS existants inchangés ; les fixtures de foyers ne sont pas présentées comme un nouveau test RLS Supabase.
- Un lot n'est partagé qu'après réussite complète. Une réponse atteignant 1 000 lignes ne prouve pas sa complétude ; reprise par le lecteur original, sans faux vide ou UNKNOWN. Les anciennes lectures non paginées peuvent encore subir leur plafond : P3 préserve ce comportement et **ne certifie pas une réparation de leur couverture au-delà du plafond**. Les tests de pagination existante prouvent séparément toutes les pages ou l'échec intégral.
- Une source modifiée après son admission dans une requête n'est pas prétendue fraîche : le test démontre cette limite. Une nouvelle instance relit la modification rétroactive ; une incohérence entre deux projections observées échoue. Aucun contrôle inter-requêtes de World n'est ajouté.
- Apply continue sa relecture autoritaire ; CAS/idempotence sont inchangés. Aucun Apply authentifié exécuté, conformément au périmètre.
- Preview : transport d'interaction serveur refusé, autosauvegarde débranchée, fetch REST non-GET/HEAD bloqué. Zéro tentative de writer détectée. Auth login autorisé ; aucune écriture financière, import, publication, table ou migration. Les lectures Draft/Plan existantes peuvent avoir lieu ; aucun Draft n'a été modifié.

### Gates et preuves

| Contrôle | Verdict exécuté |
|---|---|
| P3 conservation / transport / modèle | PASS, 14 groupes, fixtures uniquement |
| Canonical batching et historical contracts | PASS |
| P1 read reuse/opening ; P2 mutation/scheduler/presentation/durable | PASS |
| Forecast/Baseline, Persona, Mobility, Kernel | PASS |
| Golden 22×9 ; P11 ; P13 Apply/CAS/idempotence | PASS fixtures ; golden inchangé |
| C8 et R6 | PASS |
| R3 interactions | 21 PASS ; **R3-008 FAIL préexistant : `CONTEXT_REFERENCE_OWNER_UNAVAILABLE`** |
| Authentification, ouverture et empreinte réelle en Preview | PASS borné, six reloads ; pas une certification E2E globale |
| TypeScript `tsc --noEmit` | PASS, code 0 |
| Build Next complet final `npm.cmd run build` | PASS, code 0 : compilation, TypeScript, pages statiques, optimisation finale |
| Objectif < 5 s P95 / < 2 s | NON DÉMONTRÉ |
| Apply/écritures authentifiées, production, deuxième appareil | NOT_RUN |

Première série : 19 scripts, 18 exit 0, R3 exit 1. Une partie a chevauché la préparation des sondes ; après leur retrait et la décision opt-in, les 14 groupes P3, P1 read reuse, P13, C8, golden, TypeScript et build ont été rejoués sur l'arbre final. Aucun nouveau FAIL. Dépendances existantes réutilisées : Node local 22.18, Next 16.2.6 ; Vercel Node 24. Pas de revendication d'installation fraîche ni de CI.

Artefacts : [fixture et échantillons](evidence/p14-p3/history.json), [parité finale](evidence/p14-p3/history-final.json), [régressions](evidence/p14-p3/regressions.json), [gates finaux](evidence/p14-p3/final-checks.json), [synthèse calculée](evidence/p14-p3/summary.json), [coûts par source](evidence/p14-p3/preview-source-costs.json), [build final](evidence/p14-p3/build-final.log). Les valeurs numériques du DOM ont été transcrites dans les fichiers `preview-*` ; aucune session/cookie ni capture contenant des finances n'est conservée.

Reproduction locale : `node scripts/check-composer-p14-p3-history.mjs` (`P14_P3_REPORT` pour enregistrer ; `P14_P3_SKIP_BENCH=1` pour la seule parité), puis `node scripts/summarize-composer-p14-p3.mjs`. Sondes Preview réversibles : `node scripts/p14-p3-instrument-preview.mjs apply`, variantes **explicitement** `0` et `2` en fra1, puis `restore`. Elles ne font pas partie du runtime livré.

## F. Décision, compromis et rollback

Le coût de nouveaux World diminue en transports, **pas de manière démontrée en durée globale**. P1/P2 et Express sont présents des deux côtés ; leurs gains ne sont pas attribués à P3. Le résultat autorise la conservation d'un prototype fonctionnel sûr, pas son activation générale automatique.

`COMPOSER_P14_P3_HISTORICAL_REUSE` : absent/`0`/invalide = lecteurs d'origine ; `1` = A ; `2` = B. Aucun réglage de production ajouté. Rollback : retirer le drapeau ou mettre `0` ; revert du commit local pour retirer aussi le code. Aucun rollback SQL, aucune donnée à supprimer. La variabilité et l'incident Canonical `57014` préexistant restent ouverts ; zéro timeout dans cette petite série ne clôt pas l'incident.

## G. Base concrète pour le futur chantier historique — aucune implémentation

P3 laisse **272 GET PostgREST et 11,516 Mo** à refaire à chaque World indépendant. Les trois tables ciblées en représentent encore 43 / 2,086 Mo. Le partage d'une instance ne remplace pas une publication correctement versionnée entre deux ouvertures.

| Famille restante, observation P3 | GET | Octets | Lecture/coût encore significatif |
|---|---:|---:|---|
| Lieux | 22 | 943 186 | Presence par person-day et résolution événement/lieu ; conserver leurs filtres distincts |
| Événements + participations + liens de lieux | 31 | 1 302 864 | Projections d'activités et constructeur Global M7 ; pas de réduction observée des événements eux-mêmes |
| Operations | 25 | 2 423 455 | Reconstructions historiques économiques |
| Coût Canonical économique | 17 | 1 216 794 | Vue/projection propriétaire ; ne pas substituer des montants préparés non admissibles |
| Timing Canonical + contrôle | 27 | 906 774 | Fiabilité intermittente antérieure ; coût SQL précis toujours inconnu |
| Mobility legs | 3 | 1 601 512 | Observations physiques ; un devis futur ne les remplace pas |
| Snapshots Analytics déjà publiés | 3 | 1 393 055 | Réutilisation possible seulement à identité/génération/méthode/contrat compatibles |

Les fetchs cumulés par table sont dans les preuves, mais ne permettent pas de hiérarchiser seuls le chemin critique. Une préparation historique ciblée pourrait surtout éviter la répétition des reconstructions économiques/relations et de leur transport entre ouvertures. Avant toute architecture, définir son manifeste par **owner**, pas un World complet opaque.

Versionnement existant observé dans le code : `household_revisions.data_revision/analytics_revision`, période fermée + `sourceRevision`, publication Analytics + `source_revision/published_analytics_revision`, versions méthode/contrat et invalidations par impact. `materialization/freshness.ts` distingue période fermée et portée globale ; `materialization/mutation.ts` prévoit le bump et l'invalidation dans le même workflow qu'une mutation. Cela **ne prouve pas** que tous les writers de lieux, participations, liens, statuts, personnes ou changements rétroactifs alimentent un manifeste historique futur.

Manques à établir avant une publication préparée : couverture effective de ces writers et suppressions, timezone/scope d'autorisation, changements de relations parent/enfant, déplacement d'une date entre périodes, invalidation des périodes fermées, version des sources Mobility/Persona/Renewal, changements MonthInputs/PlannedExpenses/Wallet/Plan. Ces owners vivants devront rester fraîchement lus ou avoir leur propre dépendance fiable ; aucun gel implicite.

Estimation minimale de vérification : une lecture de révisions + les deux lectures de publications déjà effectuées, soit 3 GET très petits (152 + 282 octets dans l'observation). Durées d'en-têtes **observées sur cette seule ouverture** : 88 ms pour la révision et 639 ms cumulés pour les publications. Leur somme n'est pas une latence garantie ni le coût complet d'un futur manifeste. Les réutiliser dans la même requête n'ajouterait pas ces lectures ; une vérification supplémentaire non atomique peut néanmoins courir avec une mutation. La suffisance, le coût net et l'invalidation rétroactive restent à démontrer.

**Suite minimale recommandée : cadrer la publication historique ciblée et son manifeste/invalidation, sur ces coûts mesurés ; conserver P3 opt-in jusqu'à décision de livraison.** Aucune nouvelle série d'audits généraux ou tentative SQL lourde n'a été lancée. Pas de snapshot, cache persistant, migration, push, PR, merge, production ni P15. **STOP P14-P3.**
