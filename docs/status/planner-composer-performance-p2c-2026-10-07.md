# Composer P2-C LEAN — arrêt sans partage de facts

**P2_C_LEAN = STOP_NO_HIGH_VALUE_REUSE.** Les trois candidats examinés ne justifient pas le partage demandé dans cette passe. Aucun code produit, select, scheduling, batch, owner ou cache n'est modifié.

HEAD_BEFORE et HEAD_AFTER_PRODUCT : `9486a140def24192fc339b96689ddf505b464bfb`, branche `main`, worktree initial propre. HEAD_AFTER (documentation seule) : SHA du commit documentaire, résolvable avec `git log -1 --format=%H -- docs/status/planner-composer-performance-p2c-2026-10-07.md`. Aucun reset, push ou déploiement.

## Exploration ciblée et décision

Exploration du 7 octobre, de 14:45:15 à 14:58:39 UTC : **13 min 24 s**, sous le plafond de 20–30 minutes. Réutilisation de P1 et P2-B.6 ; aucune nouvelle matrice des 291 GET. Lecture des chemins économiques, Purchase-aware, PredictionEvidence et localisation déjà identifiés par P1.

| Candidat | Preuve ciblée | Décision |
|---|---|---|
| Purchase-aware / hydratation économique historique | Superset initial : 1 651 IDs d'opérations pour les coûts, 1 436 opérations hydratées et 1 476 composants. Purchase-aware relit seulement **54 opérations / 54 composants**. Dix lectures d'hydratation et une lecture de coûts pourraient être évitées. | Meilleur partage sûr, mais **11 GET, 327 lignes, 214 864 octets** seulement. |
| Localisation des événements / visites de présence | Présence : 8 GET, 2 181 lignes, 789 550 octets. Localisation des événements : 14 GET, 1 372 lignes, 153 636 octets ; **1 353 identités communes, 19 absentes du superset Présence**. | Coverage incomplet, fieldsets et sélecteurs distincts. Même la suppression théorique de toute la lecture étroite ne vaut que 0,154 Mo. Aucun gain sûr de 14 GET revendiqué. |
| PredictionEvidence / Operations et coûts Canonical | Deux appels PredictionEvidence répètent les mêmes lectures dans la capture owner. Les doublons stricts sont déjà absorbés par Next : 313 GET headless contre 291 empreintes uniques. La lecture bancaire PredictionEvidence admet 1 651 opérations, tandis que l'hydratation économique n'en fournit que 1 436, avec un autre fieldset. | Le dedupe exact n'améliore pas les GET Next. Une substitution Canonical n'a pas une couverture/forme équivalente ; pas de partage forcé. |

Pour le premier candidat, l'estimation somme uniquement les requêtes secondaires dont les IDs demandés sont entièrement inclus dans une lecture antérieure, avec **même relation, select, prédicats complémentaires et ordre**. Les deux closures appartiennent à la même instance de `CanonicalRepository` et au même contexte autorisé. Les onze requêtes secondaires ont des empreintes distinctes ; elles ne font pas partie des doublons déjà absorbés par Next.

Le transport compatible porterait sur les raw costs et l'hydratation associée : Operations, place, timing/control, reconciliation, compositions et liens personnes. Les projections resteraient propriétaires de leur admission, diagnostics et sourceRefs. Cependant, partager seulement Operations économiserait **1 GET / 54 lignes / 134 417 octets** ; atteindre les onze GET exige de couvrir plusieurs familles d'hydratation. Ce coût de mise en place ne correspond pas au gain recherché.

La lecture Purchase-aware `montant_bancaire_depense::text` reste distincte de `*,montant_bancaire_exact:montant::text` : aucune équivalence de précision/forme n'est supposée. Les facts projetés par plage ne remplacent pas non plus silencieusement les composants complets d'une opération. La closure économique existante activée par M1 ne peut pas simplement être préchargée ici sans changer le scheduling.

**Aucun candidat retenu pour implémentation.** Le meilleur potentiel représente **3,78 % des 291 GET**, **0,85 % des lignes** et **1,36 % des octets du harness owner**, loin des 10–15 % de GET ou plusieurs Mo visés. Aucun cumul artificiel de domaines pour atteindre la cible.

## Mesures et limites

Capture P1 privée réutilisée : `outputs/planner-performance/owner-baseline`, cutoff `2026-10-06T21:00:00Z`. Analyse locale des métadonnées de requêtes, ancestry des spans et compteurs de body. Les identifiants/rows/prédicats restent privés ; seuls les agrégats figurent ici. Les fichiers de diagnostic P2-C restent hors Git dans `outputs/planner-performance-p2c` du workspace de chat. SHA256 de l'inventaire privé : `26920c3a643026f9c5db60da5f2aa4538e0f5b5809cf8f684b049371083ad3ab` ; événements : `141128514eaa8e0d18d37a25df7c5df859af651712b48e89cc4e8dd5a472ad83`.

| Mesure existante | Valeur | Attribution |
|---|---:|---|
| GET métier Next | 291 | Campagne P2-B.6 ; code produit actuel |
| GET métier headless | 313 | Capture P1, pas une nouvelle mesure du HEAD actuel |
| ROWS_DECODED headless | 38 377 | Capture P1, doublons stricts inclus |
| DECODED_BYTES headless | 15 773 984 (15,774 Mo décimaux) | Capture P1 |
| Gain potentiel économique | 11 GET / 327 lignes / 214 864 octets | Estimation depuis cette capture, **pas un résultat après patch** |

Le dédoublonnage strict local de la capture donne 291 empreintes, 33 325 lignes et 14 337 060 octets. Ces deux dernières valeurs sont une **estimation à partir des bodies headless**, pas des octets/lignes observés dans Next. Les dimensions privées non redondantes sont conservées ; aucune approximation par nom de table ou par seul nombre d'IDs.

Il n'existe pas de campagne « après P2-C », car aucun patch n'a été réalisé. Les **trois contrôles directs après P2-B.6** sont réutilisés comme référence actuelle (`after-direct-1/2/3` dans les [métriques P2-B.6](planner-composer-performance-p2b6-metrics-2026-10-07.json)) :

| Mesure navigateur, n=3 | Médiane | Plage |
|---|---:|---:|
| RSC complete | 13,704 s | 13,089–17,450 s |
| Board visible | 14,228 s | 13,605–18,032 s |
| TTI direct Composer | 15,190 s | 14,409–18,757 s |

Pas de nouvelle série 3 direct après / 3 Centre→Composer après, ni de cinq replays : **non applicables à cet arrêt sans patch**. Pas de gain wall-clock, de parité de cinq nouveaux replays ou de certification navigateur P2-C revendiqués. Aucun nouveau profil CPU.

## Vérifications

Sur le HEAD produit inchangé :

- `check-planner-performance-parity.mjs` : **22 cas / 9 hashes par cas PASS**, incluant Baseline, projection, manifest, fullBusiness, knowledge/UNKNOWN et identités/sourceRefs ; fixtures synthétiques, zéro écriture distante.
- `check-control-center-preview-lifecycle.mjs` : **27/27 PASS** ; P2-B.6 intact, aucune modification du frontend.
- `check-canonical-in-batching.mjs` : **PASS**, contrats existants de pagination/batching/closure.
- `check-architecture-imports.mjs` : **PASS, 882 fichiers**.
- `tsc --noEmit` : **PASS**.
- Un unique Next production build final : **PASS**, Next 16.2.6 ; compilation, TypeScript, génération des huit pages statiques et finalisation réussies (exit 0).

Owner modifié, abstraction nouvelle, métriques PHYSICAL_LOADS/CLOSURE_HITS/IN_FLIGHT_REUSE et nouveaux tests de partage : **non applicables**, aucune implantation. Aucun shared payload nouveau, clone ou durée de vie supplémentaire. Le diff produit est vide ; Preview/Apply/Reload et stale guards restent inchangés.

## Suite recommandée

Le volume dominant reste **Operations : environ 5,60 Mo headless**, dont **3 603 183 octets** pour l'hydratation complète historique contre seulement 134 417 octets de relecture compatible. Recommander une **passe séparée P2-C2 sur les colonnes réellement requises des lectures larges d'Operations**, avec préservation des textes monétaires exacts, provenance et parité des owners. Aucun travail de réduction de colonnes, SQL, index, snapshot ou frontend n'est commencé ici.

```ini
P2_C_HIGH_VALUE_REUSE_NOT_FOUND = YES
HIGH_VALUE_CANONICAL_REUSE = NOT_JUSTIFIED
P2_C_LEAN = STOP_NO_HIGH_VALUE_REUSE
PLANNER_GOLDEN_PARITY = PASS
UNKNOWN_PARITY = PASS
IDENTITY_PARITY = PASS
SOURCE_REF_PARITY = PASS
TOUCHED_OWNER_PARITY = NOT_APPLICABLE_NO_PRODUCT_PATCH
FIVE_REPLAYS = NOT_RUN_STOP_WITHOUT_PATCH
THREE_DIRECT_BEFORE_AFTER = BEFORE_REUSED_AFTER_NOT_APPLICABLE
GET_ROWS_BYTES_MEASURED = YES_EXISTING_CAPTURE_AND_TARGETED_ESTIMATE
NEW_REQUEST_REUSE_IMPLEMENTATION = NONE
REQUEST_LOCAL_ONLY = NOT_APPLICABLE_NO_NEW_CACHE
CROSS_REQUEST_REUSE = NO
CROSS_HOUSEHOLD_REUSE = NO
P2_B6_PRESERVED = YES
REMOTE_BUSINESS_WRITES = 0
MIGRATION_REQUIRED = NO
P2_C2_NOT_STARTED = YES
P2_D_NOT_STARTED = YES
SNAPSHOT_NOT_STARTED = YES
FRONTEND_REFACTOR_NOT_STARTED = YES
R6_NOT_STARTED = YES
P3_NOT_STARTED = YES
```
