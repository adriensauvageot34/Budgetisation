# P14-SNAP-1 — Premier artifact historique réutilisable

## Verdict

`SNAP1_PROTOTYPE_READY_SAFE_LOCAL_GAIN` — prototype persistant exécuté sur données synthétiques, intégré dans les vrais lecteurs serveur. **Pas un snapshot Production utilisable.**

| Preuve | Statut |
|---|---|
| Préparation, publication et reprise dans un nouveau processus | EXECUTED_PASS_PGLITE_PERSISTENT |
| Fraîcheur et permissions des writers isolés | EXECUTED_PASS_ISOLATED_ONLY |
| Parité World, Baseline, Compiler, Finance V2 et digests | EXECUTED_PASS_FIXTURE |
| Performance du fragment | MEASURED_LOCAL_GAIN, n=40 paires |
| Benchmark authentifié / navigateur jusqu’à FRESH | NOT_RUN |
| Consommation Production | OFF ; aucun adaptateur Production |
| Déploiement | NON PRÊT : couverture des writers réels et sécurité à certifier |

## 1. Owner retenu et coût supprimé

**Projection Canonical des occurrences d’activité et de leurs liens financiers causaux confirmés**, consommée par les leviers simples de la Baseline. Les règles viennent de `CanonicalRepository.loadActivityOccurrences`, `parseActivityOccurrenceFact` et `parseActivityCausalFinancialLinks`. SNAP ne calcule aucun montant financier ni statistique nouveau.

Ce fragment dépend de quatre tables précisément identifiées, est indépendant du Draft, et est reconstruit lors de nouvelles requêtes. Les publications Global/M7 existantes ne fournissent pas directement ce contrat avec ses liens causaux et la preuve de versions exigée. L’histoire économique complète a été écartée pour ce premier lot : fermeture des dépendances, vues timing et writers plus complexes. Forecast reste une autorité publiée vivante. Le Draft et les devis prospectifs Mobility restent hors artifact.

Lectures remplacées :

- `life_events` : IDs, type, série, parent, dates de début/fin et validation ; filtre de chevauchement avec la plage historique exacte.
- `life_event_types` : identité, `type_key`, `can_span_days`, `active`.
- `life_event_participations` : identité événement/jour/personne et statut nécessaires à la projection des occurrences.
- `life_event_financial_links` : identités économiques, relations causales admissibles, montant lié nullable et statut confirmé.

M7 utilisait également cette projection. `resolveGlobalM7MobilityContextAuthority` accepte désormais la **même projection admise pour une plage strictement égale**. Il continue de lire les événements détaillés, les participations avec précision temporelle, les liens de lieu, les présences et les legs observés selon son contrat. L’option ne remplace aucun calcul M7 et un périmètre différent garde le lecteur direct.

Dans le banc intégré, huit lectures de projection/liens disparaissent ; sept lectures de contrôle/détails M7 restent. Ce résultat ne signifie pas que toutes les lectures des quatre tables disparaissent de World ni que les 286 SELECT anciens ont été divisés par deux.

## 2. Implémentation livrée

- `activity-history-artifact.ts` : contrat, préparation stricte, digest, décodeur propriétaire, HIT/MISS/erreurs et port de stockage limité à cet owner.
- `baseline-adapters.ts` : consommation réelle et partage de la projection avec M7 ; autres sources vivantes.
- `world-reader.ts` : un `readComposerWorld` optionnel distinct de `readWorld` autoritaire.
- `composer-opening.ts` et `composer-service.ts` : ouverture et READ/édition/SUGGESTIONS utilisent ce chemin optionnel. La branche APPLY/CHECK_APPLY intervient **avant** cette sélection. La relecture après commit et Mon Plan officiel restent directs.
- `scripts/fixtures/snap1-isolated.sql` et `scripts/lib/snap1-isolated-store.mjs` : stockage PostgreSQL/PGlite sur disque, privé, données exclusivement synthétiques. Ce SQL est un **banc exécutable**, pas une migration Supabase prête à déployer.

Artifact conservé dans `snap1_isolated.artifacts`, base locale `outputs/p14-snap1/final-code/artifact-db` ignorée par Git. Reproduction depuis la racine du dépôt, avec un **nouveau** dossier de sortie (aucun effacement automatique) :

```powershell
$env:P14_SNAP1_OUTPUT='outputs/p14-snap1/reproduction'
node scripts/check-composer-p14-snap1.mjs
npm.cmd run typecheck
npm.cmd run build
```

Le script interdit le réseau, fixe P3 à 0 et alterne lui-même les variantes SNAP OFF/ON. Il ferme puis rouvre le stockage dans un second processus pour la preuve de persistance. Toutes les bases des tests sont fermées en fin de banc ; aucune application distante n’est sollicitée.

La clé SHA-256 contient auteur autorisé, foyer, personnes triées, timezone, plage `[start,endExclusive)`, cutoff local effectif, contrat, schéma 1 et méthode `canonical-activity-projection@snap1-v1`. Le mois cible ne fait pas partie du payload : son influence est déjà traduite dans la plage exacte ; World recalcule le mois et le Draft courants. Le lecteur originel de ce fragment ne filtre pas par instant de modification : la journée locale et la plage effective expriment son cutoff, sans inventer un contrat bitemporel.

Le manifeste contient versions des quatre sources et du scope d’autorisation, attestation de couverture isolée, génération CAS, statut READY, provenance, couverture `COMPLETE_SOURCE_ROWS`, faits projetés et digest de l’ensemble. **Cette couverture atteste des lignes lues, pas des prix connus.** Les liens sans montant, parents/séries nulls et statuts déduits sont conservés. UNKNOWN/PARTIAL continuent d’être déterminés par les owners à partir de ces faits et des données économiques vivantes.

Le HIT exécute une seule instruction SQL bornée : autorisation actuelle, catalogue des mécanismes de version, cinq compteurs, génération et artifact ; puis contrôle de digest, identité, contrat et décodage par les parsers existants. Aucune reconstruction historique ne sert à valider un hash. Aucun TTL.

La publication prépare les faits hors transaction, puis verrouille les mêmes compteurs que les writers, revalide droits/versions et compare la génération précédente. Transaction courte avec `lock_timeout=2s` dans le banc. Sources modifiées ou publication plus récente : rejet, aucun écrasement. Il n’y a pas de publication automatique lors d’un MISS.

| Situation | Comportement |
|---|---|
| Flag OFF ou aucun adaptateur | Lecteur direct ; aucune lecture du stockage |
| Artifact absent / nouvelles versions / couverture non attestée | MISS + lecteur direct autoritaire |
| Artifact intègre, scope exact et versions actuelles | HIT, faits préparés |
| Corruption ou incompatibilité de l’artifact trouvé | Erreur explicite, pas de fallback silencieux |
| Réseau, SQL ou permission en erreur | Erreur propagée ; aucun modèle financier valide présenté |

**Rollback :** enlever l’adaptateur ou mettre `COMPOSER_P14_SNAP1_ACTIVITY_HISTORY=0`. Les artifacts restent stockés ; aucun Plan, Draft ni fait n’est supprimé. `authorizedPlanner()` ne fournit aucun adaptateur : même `1` seul n’active rien en Production. P3 reste absent/0. P1/P2/P4A/P4B/P4D sont conservés.

## 3. Versions, writers et invalidations

| Dépendance | Writers à couvrir | Preuve isolée | Limite réelle |
|---|---|---|---|
| life_events | INSERT/UPDATE/DELETE, imports, changements rétroactifs et déplacements de période | Trigger par instruction, ALWAYS, compteur global | Pas de signal universel réel certifié |
| life_event_types | Classification, activation, portée ; migrations/admin | Même mécanisme ; toutes les plages invalidées | Exemple réel tracé : migration `20260824231804_set_deplacement_pro_multi_day.sql` |
| life_event_participations | Ajout/retrait/personne/jour/statut | Même mécanisme | Writers externes/imports à raccorder |
| life_event_financial_links | Identité économique, montant nullable, relation, validation | Même mécanisme | RPC/admin/service-role à couvrir réellement |
| authorization_scope | Foyers, timezone, personnes, appartenances et accès | Triggers + vérification actuelle à chaque lecture | JWT/RLS Supabase : NOT_RUN dans SNAP-1 |
| DDL / méthode / contrat | Schéma, mapping et code propriétaire | Event trigger DDL isolé, contrôle des triggers/functions, changement de contrat/méthode refusé | Event triggers privilégiés non présumés disponibles sur Supabase ; protocole de versions à revoir |

Le compteur est volontairement global par table dans ce petit prototype : une mutation peut invalider plusieurs périodes, sans tenter de deviner son périmètre. Les triggers couvrent aussi les DML ordinaires admin/replica/COPY et TRUNCATE. Le banc exécute réellement la modification sous `session_replication_role=replica`. Le fence DDL invalide après désactivation/réactivation d’un trigger ; un mécanisme absent ou modifié retire l’attestation. Un administrateur qui falsifie volontairement les compteurs/stockage n’est pas une frontière de sécurité certifiée par ce banc.

`household_revisions`, `analysis_periods.source_revision` et `recordAnalyticsMutation` ne sont **pas** considérés comme couverture de ces writers. Les callsites trouvés du dernier helper sont des tests ; les écritures SQL et migrations peuvent modifier les tables indépendamment. Rien de ce lot ne raccorde les writers de Production.

Les changements de périodes complètes, MonthInputs, Wallet, PlannedExpenses, Forecast, Plan, Draft et Mobility restent vivants. Si une période change la plage interrogée, la clé historique change. Une modification du code de projection devra changer sa méthode/contrat avant toute publication durable.

## 4. Preuves adversariales

Les seize contrôles sont conservés dans [results.json](evidence/p14-snap1/results.json) avec le journal [snapshot-tests.log](evidence/p14-snap1/snapshot-tests.log).

PASS isolés : V0/HIT ; nouveau processus reprenant le même digest sans lecture brute ; fait modifié ; suppression ; mutation rétroactive sous rôle replica ; déplacement invalidant deux périodes ; méthode/contrat/cutoff incompatibles ; mutation pendant préparation ; publications ancienne/nouvelle et CAS de génération ; plafond exact 1000 accepté uniquement avec compte exact, 1001 et plafond réduit refusés ; foyer/personne/auteur et appartenance incompatibles ; dépendance absente, réseau et corruption ; données vivantes et Preview ; types/participations/liens/TRUNCATE ; OFF sans dépendance au stockage ; DDL interrompant la couverture ; historique vide et changement de timezone.

Une préparation est refusée si le compte exact de **chaque requête physique non paginée** diffère du nombre reçu. La vérification ne s’exécute pas sur les HIT. Le lecteur direct antérieur reste inchangé : SNAP ne certifie pas sa complétude pour un historique dépassant ses plafonds ; il refuse seulement d’en publier une copie prétendument complète.

La parité intégrée utilise réellement `createPlannerDependencies` → `readPlanningBaselineSources` → lecteurs Canonical/M7 → Baseline → Compiler/Finance → réponse Composer. Les owners hors segment sont des fixtures admissibles, clairement listées dans le script, et non des lectures Supabase authentifiées. Les faits, World, réponses et digests sont égaux pour Draft vide, Soirée, Séjour résolu/non résolu, montant édité et SUGGESTIONS. Changer MonthInputs, ressource Wallet déclarée, génération Forecast ou PlannedExpense modifie la réponse et conserve la parité A/B, sans republier l’artifact. Apply relit le direct, rejette une preuve périmée avant writer ; CHECK_APPLY ne consulte pas l’artifact. Les garanties transactionnelles complètes sont rejouées séparément par P13/Kernel.

## 5. Mesures comparables

Windows, Node 22.18.0, PGlite 0.5.8 existant ; 288 événements, 576 participations et deux liens causaux, dont un montant UNKNOWN. Même base persistante, cutoff, droits et versions ; un repository/dépendances neufs par demande ; ordre A/B alterné. `performance.now`, sans délai réseau artificiel. La reprise dans un nouveau processus est prouvée séparément ; son chargement initial WASM/Node n’est pas inclus dans le chronométrage du lecteur. Les mesures SNAP ont été effectuées sans build ni suites de régression concurrents.

| Mesure | Direct | HIT |
|---|---:|---:|
| Fragment, n=40, P50 | 83.31 ms | 33.98 ms |
| Fragment, P95 descriptif | 90.65 ms | 39.09 ms |
| Lectures brutes du fragment | 9 | 0 |
| Instructions SQL de consommation | 9 | 1 |
| JSON sélectionné/sérialisé | 196 372 octets | 133415 octets |
| READ serveur intégré, n=12, P50 | 336.24 ms | 289.23 ms |
| READ serveur intégré, P95 descriptif fragile | 350.51 ms | 300.34 ms |
| Lectures de projection/liens remplacées dans ce READ | 8 | 0 |
| Instructions SQL segment + détails M7 + admission | 15 | 8 |

Préparation initiale : **268.04 ms**, hors initialisation/seed de la base. La sonde compte dix lectures source/admission ; le publish CAS comporte en plus les deux SELECT de verrouillage/revalidation et une écriture, hors BEGIN/COMMIT. Ce coût est payé avant le READ et doit être amorti, pas effacé du bilan.

Admission SQL combinée versions/droits/catalogue/**chargement** : P50 11.85 ms, P95 14.78 ms. Digest + décodage : P50 21.27 ms, P95 26.07 ms. Ces opérations forment un seul aller-retour de stockage ; aucune durée séparée de chargement n’est inventée.

Dans le READ avec M7, les données détaillées conservées représentent 282 580 octets sélectionnés, en plus de l’artifact. L’économie nette de JSON sérialisé est d’environ 63 Ko, pas 478 Ko. Ce sont des octets JSON mesurés dans le banc ; ni paquets réseau ni GET Supabase réels. Les SQL locaux exécutent vraiment les filtres, mais la façade PostgREST et les autres owners sont synthétiques.

Résultats défavorables conservés : préparation plus chère qu’un READ direct ; MISS ajoutant l’admission à la reconstruction (dix lectures contre neuf pour le fragment), publication concurrente refusée après du travail déjà payé, artifacts incomplets/corrompus indisponibles. 0/40 paires de consommation et 0/12 paires READ sont défavorables au HIT dans cette campagne. Les échantillons et extrema restent dans le JSON ; aucune série n’a été sélectionnée pour une conclusion favorable.

**Runtime authentifié : NOT_RUN.** Il n’y a pas d’environnement A/B réel équipé d’un adaptateur et de versions admissibles ; le worktree ne contient que `.env.example`. Aucune recherche de secret masqué, nouvelle Preview, migration ou publication distante. Aucun TTI Board/FRESH, P95 utilisateur, performance Vercel/Supabase ou objectif 2/5 secondes n’est certifié par ces nombres serveur synthétiques.

## 6. Qualité et réserves

| Contrôle | Résultat final |
|---|---|
| Golden 22 × 9 empreintes | PASS, aucune golden modifiée |
| P11, P12, P13, Kernel, Contexts, Baseline | PASS fixtures/PGlite |
| P02 conservation, Soirée P09, Visite P10, Mobility | PASS fixtures/PGlite |
| P1 reuse/opening, P2 mutation/scheduler/presentation/durable, P3 historique | PASS fixtures ; runtime P3 OFF |
| C8 dont C8-017, R6-P45/présentation, UI atomique, P4B/P4D | PASS fixtures |
| Canonical IN batching | PASS |
| R3 interactions | FAIL préexistant R3-008 CONTEXT_REFERENCE_OWNER_UNAVAILABLE ; autres contrôles exécutés PASS |
| TypeScript | PASS code 0 |
| Build Next 16.2.6 complet | PASS code 0, environnement local autorisé, dépendances réutilisées |
| Auth/RLS réelle, navigateur jusqu’à FRESH, drag interpage physique, multi-appareils | NOT_RUN |

Le premier contrôle Kernel a échoué sur l’ajout d’une propriété `activityHistory: undefined` au chemin OFF. Correction ciblée : omission de cette option quand aucun adaptateur n’est fourni. Gate rejoué PASS ; calculs financiers inchangés. Le lancement d’un second processus Node a d’abord rencontré EPERM en sandbox ; l’exécution locale autorisée a ensuite apporté la preuve, sans contournement des protections.

Écart d’exécution signalé : une commande de scan de contenu a repris un ancien secret fourni dans l’historique de conversation. Aucune connexion ne l’a utilisé ; il ne figure pas dans les fichiers livrés. La commande reste dans l’historique de cette conversation.

Logs et codes de sortie : [regressions.json](evidence/p14-snap1/regressions.json), [quality.json](evidence/p14-snap1/quality.json), [build.log](evidence/p14-snap1/build.log). Le build complet n’est ni une installation fraîche ni une certification CI. Les autres suites contenant leurs propres délais synthétiques ne servent pas aux chiffres SNAP ci-dessus.

## 7. Git, frontières et suite

Base vérifiée : `6ae0b54633403481be872f40b0c5b25d070c7d7c`. Branche : `codex/composer-v3-p14-snap1-historical-artifact`. Ascendance P4D/P4B/P4A/P3/P2/P1/Express/CSS/golden/P13 conservée. SHA final communiqué dans le bilan de livraison ; manifeste des sources mesurées dans [source-manifest.json](evidence/p14-snap1/source-manifest.json). Produit : les cinq fichiers Planner modifiés, le nouveau module d’artifact et l’option de lecture M7 ; banc : deux scripts, SQL de fixture et exclusion des sorties locales. Rapport/preuves versionnés. Aucun fichier de migration Supabase, UI, contrat financier ou golden changé.

Zéro écriture distante de test. Écritures uniquement dans les bases synthétiques isolées des suites ; aucun Apply réel, donnée personnelle, Plan/Draft réel, publication forcée, push, PR, merge ou déploiement. Aucune modification de région ou investigation générale Canonical. L’incident intermittent `timing/57014` reste ouvert et indépendant.

### Proposition SNAP-2, non exécutée

1. Garder cet owner restreint et proposer une publication durable compatible avec l’infrastructure `analytics_artifacts` existante : artifact versionné, génération READY atomique, stockage privé et lecture autorisée. Ne pas créer une nouvelle vérité financière.
2. Faire approuver le SQL et la fermeture des writers réels : événements, types, participations, liens causaux, imports, admin/service-role/RPC, migrations, droits/personnes/timezone. Décider si les compteurs existants peuvent être rendus exhaustifs ou si des versions ciblées sont nécessaires. Le fence DDL du banc n’est pas une migration Supabase proposée en l’état.
3. Publication hors READ avec garde avant/après et CAS ; invalider toutes les plages touchées. Reprise après erreur sans publier READY obsolète. Pas de reconstruction de World pour valider l’artifact.
4. Obtenir les preuves authentifiées d’isolation et concurrence, puis A/B réel opening et READ jusqu’à FRESH avec le flag OFF comme contrôle, sans modifier les finances. Conserver Apply direct.

SNAP-1 supprime concrètement une reconstruction de projection ; Forecast, histoire économique, détails M7, Persona/Renewal, MonthInputs/Wallet/PlannedExpenses, Compiler et Finance restent dans World. Le classement réel de ces coûts sur le HEAD courant n’a pas été remesuré. Les détails M7 sont la prochaine économie locale visible ; l’histoire économique et `readMonthPredictionEvidence` restent des candidats des mesures antérieures, pas des dominants nouvellement prouvés. Aucun snapshot supplémentaire n’est construit. STOP après SNAP-1.
