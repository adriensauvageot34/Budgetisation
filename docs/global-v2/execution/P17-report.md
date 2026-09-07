# P17B — certification prépublication Global V2

## 1. Verdict et périmètre

- Baseline : `13d2f01291b544250191ac2a9b6a88223788cb14`, branche `main`.
- Exécution : locale uniquement, avec outputs Analytics qualifiés synthétiques et PostgreSQL éphémère PGlite.
- Aucun accès Supabase réel, aucune migration live, aucun Begin/Stage/Finalize live, aucune publication et aucun push.
- Les corrections sont limitées aux défauts techniques R02–R15 et à leurs preuves de closure. Aucune formule, autorité, causalité, attribution, règle de support/coverage ou qualification métier n'a été modifiée.

## 2. Fermeture du handoff P17A et evidence ledger

Le ledger durable `P17-evidence-ledger.json` est généré depuis `GLOBAL_MASTER_INDEX.json` par `scripts/build-global-v2-evidence-ledger.mjs`. Il conserve quatre namespaces distincts : `REQ`, `SEM_CAP`, `TEST` et `CAT_CAP`.

| Élément | Résultat |
| --- | ---: |
| Requirements individuellement sourcées | 2 047 / 2 047 |
| Tests conceptuels individuellement sourcés | 2 302 / 2 302 |
| CAT_CAP individuellement sourcées | 364 / 364 |
| Arêtes Requirement → Test explicitement déclarées | 2 350 |
| Crosswalk inventé CAT_CAP ↔ REQ/SEM_CAP/TEST | 0 |
| Digest du ledger | `e60340c0747371c011f16f1f44a5c5df5875d3474a82d632e7ab1c539a37ab96` |

Chaque Requirement porte sa source, son owner, sa capacité sémantique explicitement déclarée, ses tests conceptuels, ses futurs `caseId` et son `evidenceDigest`. Chaque test porte sa source, ses Requirements explicitement déclarées, son owner, son futur `caseId` et son slot d'assertion. Les CAT_CAP restent autonomes avec `NO_EXPLICIT_CROSSWALK_BY_SOURCE` : leur absence de jointure n'est ni cachée ni réparée lexicalement.

Le ledger ne transforme pas un index en résultat comportemental : `executionState=NOT_RUN_P17_LEDGER` demeure explicite. Les preuves exécutées sont celles des suites et candidats décrits ci-dessous. Cette séparation ferme la traçabilité mécanique sans présenter un compteur comme preuve individuelle.

La classification P01–P16 reste conservatrice : `REUSABLE_UNCHANGED`, `REPLAY_REQUIRED`, `SUPERSEDED`, `INSUFFICIENT_FOR_GC1` ou `LIVE_PROOF_REQUIRED_LATER`, avec contrôle du digest/closure avant réutilisation. P16 reste un checkpoint historique valide, corrigé et recertifié sous owner P16 dans P17B.

## 3. Candidat intégré C-A → C-E

`scripts/lib/global-v2-integrated-candidate.mjs` construit un seul ensemble partagé de dix outputs Analytics qualifiés, puis les fait traverser les vrais contrats de publication, builders P14, builders P15, RuntimeSchemas, plan d'instances, closures et manifest. Les chaînes de présentation ne servent jamais de source Analytics.

| Preuve | Résultat |
| --- | --- |
| Outputs Analytics qualifiés partagés | 10 |
| Instances Query candidates | 32 |
| Artifacts candidats | 1 |
| Closures de dépendances | 33 |
| RuntimeSchemas candidats | PASS |
| `publicationFactsHash` | `15e9c281b98cf81d058701e3b30d98547b2c8bed501c8f26348658b71f2e5fc5` |
| `manifestHash` | `d9618117961de735b650b1847117eb1317534d602e06b171e07f050a4d215614` |
| Déterminisme sous reconstruction | PASS |
| Mutation significative | hash/closure changés et altération rejetée |
| Génération suivante | ensemble exact, aucune clé résiduelle |

Cette preuve est un candidat local intégré de mécanique prépublication. Elle ne prétend pas remplacer une certification Canonical/live : les lectures Canonical et le N+1 Canonical sont donc non applicables à ce corpus en mémoire. Les producteurs métier P01–P12 restent ceux certifiés par leurs owners.

## 4. Closure, FDR et convergence

- Les dix familles de dépendances Analytics sont présentes dans les closures issues des mêmes outputs que les ReadModels.
- `publicationFactsHash` est dérivé du Household, du scope temporel, de `sourceRevision` et de l'union canonique des dépendances ; le plan Query ne peut pas l'injecter.
- Le catalogue M5/FDR contient 31 définitions uniques, toutes examinées. Les exclusions conservent leur raison ; aucune exclusion n'est convertie en `p=1`.
- Le digest de l'univers FDR est invariant à une permutation technique et sensible à une modification réelle.
- R11 est fermé par les inputs/digests/résultats du candidat, sans booléen de no-op pré-déclaré. R12 est fermé par le passage des mêmes outputs qualifiés vers P14/P15 et la matérialisation.
- Une génération corrigée produit une identité/cache distincts ; l'ancienne génération reste immuable et une réponse tardive de l'ancienne génération est refusée.

## 5. SQL local C-F

La migration locale `20260906120000_global_v2_publication_infrastructure.sql` a été exercée dans PGlite avec de vrais payloads P14/P15. SHA-256 local : `B5C60AD3FB47EBC56DAC23E61E081B0502556674A2B8D59C90D687BE6F6BF085`.

Le cycle prouvé couvre : création locale, grants/guards/handshake, staging de 32 snapshots et 1 artifact, retry idempotent avant seal, attach du manifest, lecture de contrôle, finalize, refus de mutation, seconde génération, suppression/résidu, rollback compatible et isolation d'un second Household. Les ambiguïtés SQL de colonnes du finalizer/rollback ont été qualifiées ; History/legacy restent séparés.

Résultat : `69/69 PASS (SQL=PASS)`. Ce résultat n'applique rien au Supabase live. `PENDING_LIVE_SCHEMA` reste ouvert pour P18 avec autorisation humaine distincte.

## 6. Frontend local C-G

- Hydratation locale, navigation, modules COMPACT/EXPANDED, sections lazy, méthodologie, deep links, erreurs locales et deux fetchs de fond maximum : PASS.
- Desktop multi-expanded et mobile mono-expanded sont testés par la même machine d'état responsive.
- Les clics ouvrent désormais directement une ressource Entity P15 distincte ; aucun faux second niveau ne réutilise le payload analytique courant.
- Overlay unique, Escape, clavier, restauration du focus et conservation de l'état de visite : PASS local.
- Le cache est épinglé par génération. L'ancien runtime refuse la génération suivante ; un refresh explicite accepte la nouvelle ; les réponses tardives de l'ancienne sont rejetées.
- Le runtime Query sert les snapshots : 1 lecture snapshot, 0 lecture producteur, donc aucun read-through dans le harness.
- Le frontend ne calcule aucune doctrine Analytics et n'importe aucun moteur Analytics.

Résultats : `286/286 PASS`, fixtures RuntimeSchemas `71/71 PASS`, matrice P16 `150 requirements / 29 capabilities / 168 tests mapped`.

La preuve navigateur live Production reste volontairement différée à P19 : `PENDING_PRODUCTION_SMOKE`.

## 7. Corrections R02–R15

| Défaut | Correction et closure | Statut |
| --- | --- | --- |
| R02 | parser strict dependencies, doublons et closure digests recalculés | PASS |
| R03 | `publicationFactsHash` dérivé des dépendances canoniques | PASS |
| R04 | méthode/policies comparées au registre réel | PASS |
| R05 | binding queryKey/scope/params/génération et erreurs locales typées | PASS |
| R06 | SQL aligné sur le profil et les resources Global | PASS PGlite |
| R07 | metadata resource-specific lues et contrôlées | PASS PGlite |
| R08 | manifest unique, hashes recroisés, corruption rejetée | PASS |
| R09 | required keys exactement égales aux instances atteignables | PASS |
| R10 | invalidation transitive par famille, pas de faux republish-only | PASS |
| R11 | univers FDR dérivé, canonique et sensible aux inputs | PASS |
| R12 | candidat commun Analytics → RM → Query → manifest | PASS |
| R13 | transport Server→Client sûr et borne certifiée non codée | PASS |
| R14 | sections, méthodologie, Entity distinctes, état/focus restaurés | PASS local |
| R15 | hydratation, mobile, réseau snapshot-only et refresh génération | PASS local |

## 8. Tests et mesures finaux

| Suite | Résultat |
| --- | --- |
| Evidence ledger | 2 047 / 2 047 requirements, 2 302 / 2 302 tests, 364 / 364 CAT_CAP |
| Certification intégrée C-A→C-E | 28 / 28 PASS |
| Query instances | 57 / 57 PASS ; 32 / 32 RuntimeSchemas |
| Publication/PGlite C-F | 69 / 69 PASS ; SQL PASS |
| Frontend C-G | 286 / 286 PASS ; fixtures 71 / 71 |
| TypeScript | PASS |
| Architecture | PASS, 555 fichiers |
| Build Next production | PASS |
| `git diff --check` | PASS |

Mesures Query : 32 instances, 42 716 octets, zéro payload strictement dupliqué, une lecture snapshot, zéro lecture producteur. Concurrence frontend maximale observée : 2. Aucun seuil normatif n'a été ajouté.

## 9. Comparaisons History et frontières live

History intervient uniquement pour les invariants partagés explicitement autorisés et les régressions ciblées. Il ne fournit ni oracle Global, ni ReadModel Global, ni cardinalité attendue, ni Typical/Minimal de production.

- `PENDING_LIVE_SCHEMA` : migration préparée et certifiée localement, non appliquée ; P18 requis.
- `PENDING_PRODUCTION_SMOKE` : aucune publication/cutover/smoke Production ; P19 requis.
- `LIVE_PUBLICATION = NOT_STARTED`.
- `LIVE_WRITES = NONE`.
- Le plan P18/P19 du freeze reste inchangé : vérifier SHA/objets/risques/rollback/implementation SHA/candidate identity/cibles/ordre, appliquer le schéma seulement après autorisation P18, puis publier et vérifier seulement après autorisation P19.

## 10. Gates

`P17A_HANDOFF_CLOSURE = PASS`

`IMPLEMENTATION_GATE = PASS`

`CONTRACT_GATE = PASS`

`TEST_GATE = PASS`

`GLOBAL_PREPUBLICATION_GATE = PASS`

`FRONTEND_LOCAL_GATE = PASS`

`PENDING_LIVE_SCHEMA = YES`

`PENDING_PRODUCTION_SMOKE = YES`

`LIVE_PUBLICATION = NOT_STARTED`

`LIVE_WRITES = NONE`

`NEXT_PERMITTED_PROMPT = P18`

`HUMAN_AUTHORIZATION_REQUIRED = YES`

STOP.
