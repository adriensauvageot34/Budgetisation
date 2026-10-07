# Composer P2-C2 LEAN — fieldset Operations certifié

**P2_C2_LEAN = PASS.** La grosse hydratation historique passe de **67 à 23 champs retournés**, **3 603 183 à 1 221 089 octets (−66,1 %)**, avec les mêmes 1 436 opérations et 12 GET. Aucun changement de population, fenêtre, filtre, ordre, pagination, batch, concurrence ou scheduling.

HEAD_BEFORE : `f568aaa3fd5d8ca79c46b5972e8b6c46353dd4c9`, `main`, worktree propre. HEAD_AFTER_PRODUCT : `baf3762277c84b321ecbde63f908ca8454ff2b56`. HEAD_AFTER final, documentation comprise : `git log -1 --format=%H -- docs/status/planner-composer-performance-p2c2-2026-10-07.md`. Aucun reset, push ou déploiement.

## Callsite et champs audités

`CanonicalRepository.loadOperationsByIds()` dans `src/server/canonical/repository.ts`, appelé par `projectEconomicComponentRows()` pour l'hydratation historique et, ensuite, les composants Purchase-aware. Avant : `select("*,montant_bancaire_exact:montant::text")` ; 66 colonnes physiques plus un alias monétaire.

**Huit callsites directs** audités : les cinq usages repository (opération individuelle, projection économique, closure M1 existante, classifications, bundle Minimal) et les trois usages externes (browse économique, présentation Moment, qualifications Calendar). Les consumers du bundle Minimal conservent leurs métadonnées de Needs, cadence, prévision et libellés.

Le seul changement produit est le SELECT de cette méthode, remplacé par `operationByIdProjectionSelection`. Le cache existant et ses clés restent identiques. Le SELECT bancaire par plage et le SELECT monétaire propre à Purchase-aware restent distincts et inchangés ; aucune nouvelle abstraction/cache ni logique financière.

| Classe | Champs conservés | Usage prouvé |
|---|---|---|
| A — projection économique | `date_bancaire`, `mois_analytique_force`, `date_transaction_reelle`, `date_transaction_precision`, `merchant_id`, `importance`, `nature_fixe_variable`, `contexte_vie` | Timing, dimensions économiques, classification et fallback de source |
| A — présentation | `libelle_bancaire`, `category_id`, `subcategory_id`, `type_precis`, `marchand`, `description_precise` | Browse/Entity, libellés Moment et Food |
| A — autorités de prévision | `operation_mixte`, `mode_prevision`, `recurrence_series_id`, `need_id`, `annual_event_id`, `provision_pool_id` | Classification, Minimal, Need, recurrence/Calendar |
| B — identité et précision | `operation_id`, `montant`, **`montant_bancaire_exact:montant::text`** | Joins, déduplication/ordre, sourceRefs par identité ; montant exact et fallback existant |

SELECT après, 23 champs de sortie (22 colonnes physiques + alias) :

```text
operation_id,date_bancaire,mois_analytique_force,date_transaction_reelle,date_transaction_precision,merchant_id,importance,nature_fixe_variable,contexte_vie,montant,montant_bancaire_exact:montant::text,libelle_bancaire,category_id,subcategory_id,type_precis,operation_mixte,mode_prevision,recurrence_series_id,need_id,annual_event_id,provision_pool_id,marchand,description_precise
```

**C — 44 champs retirés de ce SELECT uniquement** :

```text
mois_import, flux, statut, moment_id, type_ressource, contexte_ressource,
rembourse_operation_id, total_rembourse_recu, nb_remboursements_recus,
montant_ventile, reste_de_ventilation, note, source_system, canal_paiement,
personne_concernee, uncertain, source_enrichissement, enrichissement_verrouille,
transfert_associe_operation_id, statut_ventilation, ventilation_note,
role_budgetaire, relation_moment, date_transaction_source, montant_bancaire_depense,
valeur_economique_brute, valeur_economique_precision, valeur_economique_source,
remboursement_resolution_status, financial_parent_match_status,
moment_causality_status, moment_temporal_relation, cash_usage_status,
cash_economic_use_id, financial_match_note, life_event_match_status,
life_event_match_note, remboursement_applique, excedent_remboursement,
source_transaction_reference, reference_contrat, contrepartie_bancaire,
marchand_statut, import_batch_id
```

Ces champs ne sont pas consommés sur les chemins by-ID audités. Les états économiques, provenance et diagnostics viennent toujours des composants, timing, reconciliation et autorités existantes, dont les lectures sont inchangées. Aucun champ n'est retiré de la base ni des autres SELECT. `montant_bancaire_depense::text` reste notamment dans la lecture Purchase-aware qui l'utilise.

Recherche des spreads, sérialisations et accès dynamiques : `sourceAwareEconomicDimensions` lit exactement les trois axes conservés ; `componentMetadata` lit les liens et le mode de prévision conservés. `operationFromCanonicalRow` conserve un pointeur `raw`, mais ses callers ne lisent ni ne sérialisent ce record complet ; les read-models exposent leurs champs explicites. Les refs de provenance auditées reposent sur l'identité et les autorités Canonical, pas sur les métadonnées bancaires retirées. Aucun `Object.keys(operation)` ni spread de l'opération brute vers un output métier.

## Mesures et parité

Audit ciblé commencé à 15:35 UTC ; décision d'implémentation prise en moins de 15 minutes. Même capture P1, cutoff `2026-10-06T21:00:00Z`, **un replay avant et cinq après**, zéro fallback réseau. Pour le nouveau SELECT, l'adapter privé projette seulement les 23 propriétés déjà présentes dans les réponses capturées ; il conserve l'alias monétaire textuel original, sans conversion numérique. La capture source reste intacte. Ce sont des mesures de payload décodé en replay, pas une nouvelle campagne globale de lectures distantes.

| Mesure | Avant | Après |
|---|---:|---:|
| Grosse hydratation : GET / lignes | 12 / 1 436 | 12 / 1 436 |
| Grosse hydratation : octets | 3 603 183 | 1 221 089 |
| Tous les appels by-ID concernés : GET / lignes | 13 / 1 490 | 13 / 1 490 |
| Tous les appels by-ID concernés : octets | 3 737 600 | 1 266 788 |
| Headless global : GET / lignes | 313 / 38 377 | 313 / 38 377 |
| Headless global : octets | 15 773 984 | 13 303 172 (−15,7 %) |
| GET Next Composer | 291 | 291, six parcours |
| DTO UI | 273 000 octets | 273 000 octets, digest identique |

**Vérification distante ciblée, lecture seule** : un lot existant de 120 IDs, même ordre et rôle Canonical, après validation Auth/Household et singleton READY. **120 lignes / 23 champs / 102 355 octets**, contre 300 573 octets dans la réponse large capturée. Deep equality de toutes les valeurs conservées avec cette capture : PASS. Aucun RPC, SQL, Apply ou écriture métier.

**5/5 replays identiques** : les neuf résultats du harness, le DTO UI entier et les outputs complets hashés de `loadEconomicFacts`, `loadPurchaseAwareCanonical` et `readMonthComposer`. Les 22 goldens synthétiques vérifient Baseline, projection, manifest, fullBusiness, knowledge/UNKNOWN, identités et sourceRefs, y compris les scénarios composites. Aucun clone ou double matérialisation ajouté en production.

## Navigateur et validations

Référence directe : trois contrôles après P2-B.6 réutilisés. Après : **trois directs + trois Centre→Composer à délai demandé de 100 ms**, Chromium isolé, viewport CSS 1728×900, production, mêmes critères RSC/Board/interaction Library. Pas de tests/build pendant les fenêtres navigateur. Comparaison des 903 fichiers `src` entre copies instrumentées : seul `canonical/repository.ts` diffère.

| Mesure, secondes, médiane [min–max], n=3 | Direct avant | Direct après | Centre→Composer après, depuis clic |
|---|---|---|---|
| RSC complete | 13,704 [13,089–17,450] | 13,647 [13,599–17,337] | 11,868 [11,675–15,210] |
| Board | 14,228 [13,605–18,032] | 13,920 [13,845–17,686] | 12,152 [11,954–15,514] |
| TTI | 15,190 [14,409–18,757] | 14,441 [14,383–18,346] | 12,334 [12,115–15,677] |

Plages chevauchantes, séries non alternées et référence réutilisée : **aucun gain causal de latence certifié**. RSC direct presque inchangé ; gain certain = payload réduit. Aucun profil V8 ou campagne heap/GC, aucune régression claire de TTI.

**P2-B.6 : 3/3 départs rapides sans POST preview, sans span preview et sans ses 27 GET.** Chaque parcours : 45 GET Centre + 0 preview + 291 Composer = 336. Six DTO complets identiques à la référence P2-B.6 (SHA256 `b51c6c528e97eb4b5d155c9a5dc0bc4351a4e11929c276c9b2d1d8c207cfaadb`). Zéro exception navigateur, erreur métier ou action bloquée. En normalisant seulement le SELECT modifié et le cutoff habituel, le multiset des queries retrouve exactement le hash P2-B.6 : `43c02ddae06070c793dfb7b10bb46f2b436ef3136462a5356e5db23729198433`. Les 13 SELECT et aucun autre paramètre changent par parcours.

PASS : nouveau guard fieldset (rouge sur HEAD_BEFORE, vert après), canonical batching, Purchase authority 29/29, Purchase convergence 56/56, Moment authority 22/22, contrats historiques Canonical, ReadModels historiques 27/27, Calendar/Daily 42/42, M1 owner 82/82, Planner goldens 22×9, lifecycle P2-B.6 27/27, architecture 882 fichiers, `tsc --noEmit`. **Un unique build Next 16.2.6 de production** passe dans la copie d'audit finale : compilation, TypeScript, huit pages statiques, finalisation. Cette copie contient le même code produit plus les probes d'audit existantes. Le premier lancement du script ETL `check-c4-purchase-aware` demandait des fichiers XLS : aucune importation lancée ; les suites synthétiques Purchase pertinentes ci-dessus ont été utilisées.

Commits locaux : `b622eee` — guard ; `baf3762` — SELECT ; commit documentaire final. Détails numériques/hash-only : [métriques P2-C2](planner-composer-performance-p2c2-metrics-2026-10-07.json). Raw, prédicats et Auth restent hors Git dans `outputs/planner-performance-p2c2` du workspace de chat. Serveur, Chrome et helper Auth créés pour l'audit arrêtés.

**Prochaine recommandation : P2-D**, diagnostic ciblé du chemin critique des lectures/projections Canonical et de leur orchestration. Les 291 GET restent le hotspot structurel ; le payload seul n'a presque pas déplacé la médiane RSC directe. P2-D, SQL, snapshots et frontend ne sont pas commencés.

```ini
HISTORICAL_OPERATION_FIELDSET_AUDITED = PASS
OPERATION_POPULATION_UNCHANGED = YES
HISTORY_WINDOW_UNCHANGED = YES
FILTERS_UNCHANGED = YES
BATCHING_UNCHANGED = YES
MONETARY_PRECISION_PRESERVED = YES
PROVENANCE_FIELDS_PRESERVED = YES
OPERATIONS_BYTES_MEASURED = YES
HIGH_VALUE_FIELD_REDUCTION = PASS
TOUCHED_OWNER_PARITY = PASS
PLANNER_GOLDEN_PARITY = PASS
UNKNOWN_PARITY = PASS
IDENTITY_PARITY = PASS
SOURCE_REF_PARITY = PASS
FIVE_REPLAYS = PASS
P2_B6_PRESERVED = YES
REMOTE_BUSINESS_WRITES = 0
MIGRATION_REQUIRED = NO
P2_D_NOT_STARTED = YES
SQL_OPTIMIZATION_NOT_STARTED = YES
SNAPSHOT_NOT_STARTED = YES
FRONTEND_REFACTOR_NOT_STARTED = YES
R6_NOT_STARTED = YES
P2_C2_LEAN = PASS
```
