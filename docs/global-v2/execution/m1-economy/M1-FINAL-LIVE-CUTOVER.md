# M1-FINAL — live cutover History et Global

Date : 2026-09-08

Projet Supabase : `ipuuhxrblxormwgoaqnz`

Branche : `main`

## 1. Baseline et checkpoints Git

| Élément | SHA |
| --- | --- |
| R4 | `8d51f47ae11d2f7e32f3c7dfc8e5f3f045a40785` |
| MB dry-run | `55306aaab3a218fa3533565c1a2ae194feabf6ad` |
| Wiring producteur M1 | `c1ca45107c65c3a0245f700e7850919fe783d1f0` |
| Autorité History bitemporelle | `844afc44f03d5ac7e8c75789003b16d47ee7e838` |
| Checkpoint final | commit contenant ce rapport ; SHA exact rapporté par Git après création |

La branche de déploiement est déjà `main`; aucun merge artificiel n'est requis. L'implémentation productrice utilisée dans les manifests publiés est `844afc44f03d5ac7e8c75789003b16d47ee7e838`.

## 2. Snapshot de sécurité pré-cutover

- `dataRevision=1`, `analyticsRevision=80` avant l'application MB ;
- ancienne publication Global active : `8a7a512a-9440-5e24-a3eb-e14c404cdd83` ;
- anciennes publications History V2 identifiées et préservées : douze mois de `2025-08` à `2026-07` ;
- ancienne génération Global et anciennes générations History laissées immuables ;
- aucun export bancaire privé n'a été ajouté à Git.

## 3. Migration et backfill Supabase

Trois migrations additives ont été appliquées et enregistrées :

1. `20260908141949 m1_historical_minimal_bitemporal_authority` ;
2. `20260908142256 fix_m1_historical_minimal_backfill_revision_lookup` ;
3. `20260908142406 fix_m1_historical_minimal_backfill_uuid_selection`.

Le backfill autorisé a produit :

- 34 versions de règles (`20 D1`, `8 D2`, `3 D3`, `3 D4`) ;
- 15 versions d'état `ACTIVE_FOR_MINIMAL` ;
- 0 ligne d'évidence d'occurrence dupliquée : les occurrences restent dans Canonical ;
- `dataRevision 1 → 2` ;
- 649 artifacts et 164 snapshots invalidés selon leurs dépendances ;
- second passage idempotent : 0 version ajoutée, 0 doublon, mêmes hashes ;
- anti-drift : 40/40 règles, 35/35 récurrences, aucun mismatch ;
- planHash : `af3e66a745555086dfebb67a9930c8500adde66180e10d8e54d11b0247ff64e5`.

Les cinq règles sans preuve, la règle mixte non séparable et les supports insuffisants restent `UNKNOWN`. Aucun `actif_prevision` courant, certificat legacy ou snapshot History n'a été promu en autorité.

## 4. Replay Minimal 2025-08 → 2026-07

La méthode partagée est `minimal_month_cost@v2` : Q25, au plus douze mois éligibles strictement antérieurs, support minimal six, zéro connu distinct d'une absence.

| Statut | Nombre de mois |
| --- | ---: |
| KNOWN | 0 |
| PARTIAL | 0 |
| UNKNOWN sûr | 12 |

Verdict : `MINIMAL_12M_REPLAY_SAFE = PARTIAL_SAFE`. Cette couverture est la couverture sûre maximale : les douze points Actual restent `KNOWN`, Typical devient `KNOWN` dès que son support propre est suffisant, et les trous Minimal ne sont jamais interpolés ni remplacés par zéro.

## 5. History V2

Le rebuild a été construit depuis Canonical/Facts avec la nouvelle sourceRevision 2. Le gate complet a produit :

- 12/12 mois ;
- 15/15 familles ;
- 947/947 RuntimeSchemas ;
- 384/384 invariants ;
- 24/24 artifacts ;
- digest déterministe complet `74d6c964c15f1d1152d9ef94e5afc8b6c8f62c5e47227da1704265338b32698c` ;
- bundle de publication final : `42fe9345472a895b73621a152cb08448ee2bacef99c69f60dc68d285ed915cb5`.

Chaque mois a été publié atomiquement, après contrôle des clés, payloads, manifest, factsHash et absence de référence intergénération.

| Mois | Nouvelle publication | Révision | Snapshots | factsHash | manifestHash |
| --- | --- | ---: | ---: | --- | --- |
| 2025-08 | `ea6ee0ab-89f8-4d00-a841-94586e9278b6` | 81 | 77 | `0523e6b95bbd29b68d4a47d933b850569f67b76014b2cd6dcb445c4c95eee65f` | `96b4d8c07b9a0580aaf361f5790479cc7a2d8f6b6f65ebc394409372ecf8a8bc` |
| 2025-09 | `74b3d0a3-1be9-4a32-b3f4-af5b9e62cf96` | 82 | 76 | `707158df27160b8deb090305490845b87b71c6b0351b73746ca4217c91763627` | `9f4a696aac9203c8a131c6c47c4cd01ec6f75993913cd0fb95f9701cff998f93` |
| 2025-10 | `332c1371-c500-4713-afa1-3e4269e651da` | 83 | 80 | `21d2998800167d9e05941ab906455a2038b08830b0158c69785efb5e9280ca54` | `c61ef8b42566e31cf2c7297e86ea47d7a16facb794b653af147b747ccb3ea712` |
| 2025-11 | `a2d4e263-fea4-447f-bf4e-71ef5c2c8dc1` | 84 | 77 | `de8517490a0655689f1ca8d155e36864c789cdc3ecba7731f5f50bb08810d118` | `74352771dd81788bbbbcee332bc3e7eb4f502800c3dd8336805b2d6b6053427b` |
| 2025-12 | `60b63895-d3a2-4195-9a11-f6b68d86a51b` | 85 | 81 | `fecc6994e1e6fd6e6c655c06925c825bf451240ab935f8052e15cef2d8ef345a` | `42c8b73542fd8aee85c8c0b3307933792f091dc0b1c3035589df1a5faa8a9f52` |
| 2026-01 | `d66bf389-3eb3-408b-a8a4-52fbc8199688` | 86 | 83 | `59c854f587fef1ca2e1d6160d18a852f3ff56b3c4a006435a46ca888bd2d35db` | `f4d2f354e12f67d5c69880874fcfe171a94c064b096f07d654009a330f22bdbb` |
| 2026-02 | `6a45ac3e-9e8f-4966-bdd1-8b70b1e70d1b` | 87 | 76 | `2a6c0e830a039a1461760fd99c2da22d2f9440d896b32b951e6550a2aa4f75a2` | `c45e34a4033c44e7c285e78cef745b7a0bc9c62cda3092424e6e12b4564fbab3` |
| 2026-03 | `3e5b1d45-eb2c-439d-ab50-ede69d3326e4` | 88 | 80 | `696cebd2b3e83b14210af21842ad5331794ffafc9622086d1236e0abf4f9818e` | `ca3a5f47d7ba82286f99da08d6ac81b3213a16e5dc399e69443ab0f0927bda3b` |
| 2026-04 | `ed052db4-2d58-4e9f-bbd0-cb864ae121c4` | 89 | 81 | `920c0355f80d6591b4b5c3659fe740449266ccde528b3c068fed6ac15ed026c4` | `bdb1b5fad47ffb0907f335361b043bbe5fcf609e8061c477f05d9a069d024903` |
| 2026-05 | `a5fb8e91-ebee-450a-97ae-d66e4d778dc9` | 90 | 78 | `4363bacb912d889c32c3db94229a0a61cc6b3fb88a2756396027abef3e64f3f6` | `7630abad076039298e7d30cfab78c0ae0c91a17240948af42c8ff674d600c759` |
| 2026-06 | `c1dc9a97-0f35-413a-bee8-8e8559ce1b62` | 91 | 80 | `cd3a670d060e91388fd54b9b1f5d0761be7582482463a9639a67d8fa8f95cb29` | `c1042d304b18e3fb452304df56e5b771e44b54f8586de1b9064792a439397bda` |
| 2026-07 | `72420b0c-55e9-4916-a9ce-061564840ffa` | 92 | 78 | `d39907cd9c590e311984c0421a30d79ad33c3272cd5110b89d2ee951aabde4c3` | `acd8997051f3ab77dd10640862c86cf7d6fabad5de5715a17c2570c3a81c083c` |

Read-back final : 12 publications mensuelles actives, 947 snapshots, 24 artifacts, 12 manifests, 0 DRAFT, 0 doublon, 0 reliquat V2 et 0 invalidation active.

## 6. Global V2

Le candidat complet a été reconstruit après History sur `dataRevision=2`, `baseAnalyticsRevision=92`, `asOf=2026-09-08T14:24:29.524026Z`. Il ne consomme aucun Query snapshot History.

- ancienne publication : `8a7a512a-9440-5e24-a3eb-e14c404cdd83` ;
- nouvelle publication : `bbdfb8a4-c807-56e3-9266-220edaa99aa6` ;
- révision publiée : 93 ;
- implementation identity : `844afc44f03d5ac7e8c75789003b16d47ee7e838` ;
- factsHash : `a61591c23b994567407ea296b4b71be2732de4164884c7a191d9cb2ee54daa3f` ;
- manifestHash : `846f2c2698833f43677ee16848a19f817e5438ce07ee171f71d34723baceb5d2` ;
- 103 snapshots et 1 artifact, tous restagés dans la nouvelle génération ;
- 103 payloads relus byte-for-byte avant seal ;
- 0 DRAFT, doublon, reliquat ou invalidation active après finalize ;
- exactement une génération Global active.

Le M1 publié contient : Actual `KNOWN` (dernier mois : 3 773,14 €), TypicalState `KNOWN` (3 124,235 €), comparaison backend à TypicalReference, historique Actual 12/12, Typical 7/12 selon support, Minimal 0/12 `UNKNOWN` sûr, trois axes Structure, temporalité complète, 34 récurrences, détails ciblés, contributeurs selon leur éligibilité et méthodologie secondaire.

## 7. Tests et build

| Gate | Résultat |
| --- | --- |
| M1-1R | 46/46 PASS |
| M1 owner | 56/56 PASS |
| M1 Query | 32/32 PASS |
| M1 UI | 32/32 PASS |
| Production bridge | 66/66 PASS |
| Primary ReadModels | 83/83 PASS |
| Query instances | 59/59, 33/33 RuntimeSchemas PASS |
| Publication/manifest | 57/57 PASS |
| History Month Balance | 100/100 PASS |
| History certification | 947/947 schemas, 384/384 invariants PASS |
| TypeScript | PASS |
| Architecture | PASS, 567 fichiers |
| Next production build | PASS |
| `git diff --check` | PASS |

## 8. Produit et limitations

Le contrat publié garantit : titre humain « Votre économie », Actual et Typical visibles, Minimal localement indisponible sans masquer le reste, comparaison au dernier mois, payload 12 mois, sections Overview/Evolution/Structure/Charges récurrentes, 34 détails de récurrence et méthodologie. Aucun calcul métier React ni parsing analytique de `displayValue` n'est requis.

Limitation assumée : l'autorité bitemporelle maximale sûre ne suffit pas à produire un Minimal `KNOWN` sur les douze mois ; le produit affiche cet état local sans contaminer Actual, Typical, Structure, temporalité ou récurrences.

La preuve navigateur Vercel et l'identité du commit déployé sont ajoutées à la clôture de mission après push/déploiement.

```text
LIVE_BACKFILL = PASS
HISTORY_RECOMPUTE = PASS
HISTORY_CERTIFICATION = PASS
HISTORY_PUBLICATION = PASS
HISTORY_READBACK = PASS
GLOBAL_RECOMPUTE = PASS
GLOBAL_CANDIDATE = PASS
GLOBAL_FULL_RESTAGE = PASS
GLOBAL_CERTIFICATION = PASS
GLOBAL_ATOMIC_CUTOVER = PASS
GLOBAL_READBACK = PASS
```
