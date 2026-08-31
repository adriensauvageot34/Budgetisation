# History V2 — certification READ-ONLY des 12 mois

## 1. Autorités, périmètre et gate d'entrée

Autorités appliquées :

1. `Brief_Technique_Historique_Mensuel_V2_FINAL_CIBLE` ;
2. `Protocole_Certification_12_Mois_History_V2_CORRIGE` ;
3. les rapports d'implémentation History V2 précédents, uniquement comme preuves techniques.

Gate d'entrée vérifié dans
`docs/history-v2/07-snapshot-materialization-report.md` :

```text
SNAPSHOT_MATERIALIZATION_GATE = PASS
```

Période certifiée : `2025-08` à `2026-07`, soit 12 mois fermés.

Mode d'exécution : `READ_ONLY`. La génération a utilisé une fixture locale issue
des lectures canoniques déjà réalisées en lecture seule. Aucun appel de stage,
aucun finalize, aucune écriture Supabase et aucune publication live n'ont été
effectués.

État de code certifié : working tree enregistré au-dessus de
`a97172ae851838fcef61505c703d8c27bbb0f80e`. Le résultat porte explicitement
`implementationSha = WORKTREE@a97172ae851838fcef61505c703d8c27bbb0f80e` afin de
ne pas faire passer le HEAD seul pour l'état non commité effectivement exécuté.

## 2. Correction CODE imposée par la certification

La première exécution a détecté en novembre 2025 la perte d'un membre canonique
après absorption de plusieurs enfants par un même parent Calendar.

Cause : `absorbChildren()` reconstruisait chaque remplacement depuis le parent
initial. Le deuxième enfant écrasait donc l'absorption du premier.

Correction minimale :

- `src/analytics/history-v2/calendar/engine.ts` cumule désormais chaque enfant
  sur le remplacement déjà construit ;
- aucune règle de fusion, de visibilité, de priorité ou de continuité n'a été
  modifiée ;
- `scripts/check-history-v2-calendar-daily-engines.mjs` ajoute le cas
  discriminant : parent fusionné à un Moment + deux enfants distincts ; les
  quatre sources restent membres d'un seul item et
  `rawOccurrenceCount = 3`.

Preuve sur les données des 12 mois après correction :

| Mois | Life Events admissibles | Membership invalide |
|---|---:|---:|
| 2025-08 | 55 | 0 |
| 2025-09 | 58 | 0 |
| 2025-10 | 78 | 0 |
| 2025-11 | 76 | 0 |
| 2025-12 | 77 | 0 |
| 2026-01 | 91 | 0 |
| 2026-02 | 79 | 0 |
| 2026-03 | 80 | 0 |
| 2026-04 | 87 | 0 |
| 2026-05 | 77 | 0 |
| 2026-06 | 75 | 0 |
| 2026-07 | 85 | 0 |

## 3. Résultat global

| Contrôle | Résultat |
|---|---:|
| Mois générés | 12/12 |
| Familles Query V2 | 15/15 |
| Artifacts partagés | 24, soit 2 × 12 |
| Instances Query | 907 |
| RuntimeSchemas V2 | 907/907 |
| Contrôles d'invariants mensuels | 324/324 |
| Mois `FAIL` | 0 |
| Stage / Finalize | 0 / 0 |
| Digest déterministe des 12 manifests | `8b68239c12a561465f9531617847d48386a37968483c377f7ffe43f4a9ed9b43` |

La classification agrégée est `DATA_MISSING` pour les 12 mois, et non `FAIL`.
Elle reflète explicitement les données canoniques absentes déjà autorisées :

- composantes économiques connues au mois mais sans autorité quotidienne,
  conservées dans `unassignedEconomicAmount` ;
- table d'assertions de continuité encore vide, donc absence de Ribbon pour les
  types `EXPLICIT_CONTINUITY` non qualifiés ;
- support historique insuffisant sur les premiers mois ;
- Purchase Events et classifications V2 non backfillés ;
- certaines sections factuelles restent `UNKNOWN`/`PARTIAL` au lieu d'être
  inventées.

Ces absences sont publiées par `QualityEnvelope`, `PartialMeaning`,
`reasonCode` et `DisplayNode`. Aucun zéro ou total exact n'est fabriqué.

## 4. Résultats par mois

Les montants sont en euros. `Assigné` est la somme placée sur des jours avec une
autorité économique admissible ; `Non affecté` reste dans
`unassignedEconomicAmount`.

| Mois | Classe | Actual | Typical | Minimal | Assigné | Non affecté |
|---|---|---:|---:|---:|---:|---:|
| 2025-08 | DATA_MISSING | 2977.82 | — | — | 1888.14 | 1089.68 |
| 2025-09 | DATA_MISSING | 3707.71 | — | 1508.41 | 2517.43 | 1190.28 |
| 2025-10 | DATA_MISSING | 4148.60 | — | 1619.635 | 3094.13 | 1054.47 |
| 2025-11 | DATA_MISSING | 3270.65 | 3707.71 | 1692.27333333333333333332 | 2093.58 | 1177.07 |
| 2025-12 | DATA_MISSING | 3899.23 | 3489.18 | 1680.2975 | 2473.32 | 1425.91 |
| 2026-01 | DATA_MISSING | 2897.91 | 3707.71 | 1713.194 | 1723.58 | 1174.33 |
| 2026-02 | DATA_MISSING | 2689.29 | 3489.18 | 1741.095 | 1617.11 | 1072.18 |
| 2026-03 | DATA_MISSING | 2441.31 | 3270.65 | 1733.67 | 1292.69 | 1148.62 |
| 2026-04 | DATA_MISSING | 2529.75 | 3124.235 | 1699.0725 | 1450.74 | 1079.01 |
| 2026-05 | DATA_MISSING | 3289.43 | 2977.82 | 1669.8233333333333333333333333333333333333333333332 | 2169.17 | 1120.26 |
| 2026-06 | DATA_MISSING | 2896.50 | 3124.235 | 1631.587 | 1811.39 | 1085.11 |
| 2026-07 | DATA_MISSING | 3773.14 | 2977.82 | 1636.62727272727272727273 | 1929.41 | 1843.73 |

Pour chaque ligne :

```text
SUM(DailyEconomicAmount) + unassignedEconomicAmount = Actual
reconciliationResidual = 0
```

## 5. Résultats par famille de ressource

Les comptes indiquent le nombre de mois portant la classe la plus forte observée
sur toutes les instances de la famille dans le mois.

| Ressource | PASS | PARTIAL_EXPECTED | DATA_MISSING | Reason codes observés |
|---|---:|---:|---:|---|
| `history_month_calendar` | 0 | 0 | 12 | `DATA_PARTIAL_SOURCE`, `DATA_UNASSIGNED_TIMING` |
| `history_week` | 0 | 0 | 12 | `DATA_PARTIAL_SOURCE`, `DATA_UNASSIGNED_TIMING` |
| `history_day_journal` | 0 | 0 | 12 | `DATA_NO_SOURCE`, `DATA_PARTIAL_SOURCE`, `DATA_UNASSIGNED_TIMING` |
| `history_month_overview` | 0 | 0 | 12 | `DATA_NO_SOURCE` |
| `history_month_balance_summary` | 9 | 0 | 3 | `DATA_NO_SOURCE`, `REFERENCE_INSUFFICIENT_SUPPORT` |
| `history_bank_economy_bridge` | 12 | 0 | 0 | — |
| `history_month_categories` | 9 | 3 | 0 | `REFERENCE_INSUFFICIENT_SUPPORT` |
| `history_category_detail` | 9 | 3 | 0 | `REFERENCE_INSUFFICIENT_SUPPORT` |
| `history_month_spending_nature` | 0 | 12 | 0 | `COVERAGE_PARTIAL` |
| `history_spending_segment_detail` | 12 | 0 | 0 | — |
| `history_minimal_preview` | 11 | 1 | 0 | `REFERENCE_INSUFFICIENT_SUPPORT` |
| `history_month_life_money` | 10 | 0 | 2 | `DATA_NO_SOURCE` |
| `history_activity_detail` | 12 | 0 | 0 | — |
| `history_moment_detail` | 0 | 9 | 3 | `DATA_NO_SOURCE`, `DATA_UNASSIGNED_TIMING` |
| `history_place_detail` | 12 | 0 | 0 | — |

Les deux artifacts de chaque mois sont valides. Leur classification agrégée est
`DATA_MISSING` en raison de `DATA_NO_CONTINUITY_ASSERTION` et
`DATA_UNASSIGNED_TIMING`. Cette classe interdit précisément la transformation de
l'absence de preuve en continuité ou en date quotidienne inventée.

## 6. Manifest, hashes et PublicationMeta

| Mois | `manifestHash` | `publicationFactsHash` |
|---|---|---|
| 2025-08 | `fa42ff30b0a7452ddfaf0f91928931b41a26159044332492518f5fee83b22896` | `5d81abcfe30606b16beee0d657e23b378acd59c2851c6a286955a181f826df2b` |
| 2025-09 | `0a3f5845ea409687d155fb52e47f766f20387da09e37e0c98c6f69436fb8c780` | `5cef8da88ee3708e8d0ce304696787be7e2b6fb31b5e9066c8048d7ad0bf2ffb` |
| 2025-10 | `31b1e7ae60adbecb0793dd7f6797ee6a4464d1afcb25ee579792732a12ca3169` | `8f9cddcd0c09bd56d3628bc63b814e80d18f32ba5e613dba26c6a589c9e7f18c` |
| 2025-11 | `a90977ddd5a071e1d6431483ea57b2910c9b7222c764948ed92bb8741e24db4b` | `c4eedfab49072dffcee57b56c096bef5009d03f2c45a2d059a581ca6a5e3a994` |
| 2025-12 | `48f7e6085586a826da8f8dadbccfa1be3087d1990bc6306d6fc35b33e6d22f14` | `4eab1de9c96578ba62ae1776e931cc95f172e49a5015305f027a341009fc5d2e` |
| 2026-01 | `deb0e9ef93ed613a8a1d82cb4a6d0d22fed58af1dbb386b5b5a517e537d024ab` | `96a67e80af4a2e400b2f253f377e366177168ad6511ac13a042327a0fa3e41ee` |
| 2026-02 | `c904a2c4e95793ec635e62f44dcfdaa76d729e62a9f043ded5d9ca21e3d9cf17` | `6a329eb39c199d859600400947ae0045bd2dee2b5f3060cc56e9515a08fe5675` |
| 2026-03 | `993044511a49545e0068dd412a4699f4135725ba50ebc854ae535da5eaaea2af` | `17805ab242f391ebd63b0f93613989ddf60d55ce0e5dc584e9f6a956be83e41e` |
| 2026-04 | `079bb2810c17cbab0fccd2a3babe6ee87be49e90055a9feaf81a3905b80724d5` | `7ff3096b4ac62b775853187cbf711b08ce6bac497c572454c96d45a9d21c3339` |
| 2026-05 | `3c95320a64e5a48d04901eafa75690d8f3a0a057a10a3d4f941e9b7e5b07f72a` | `d8efe526609c200a0a04e78fca751c8dd34b395d9895548ae956c1948920c208` |
| 2026-06 | `22d1b52d52a1e1e95aeff10e46eb32f1b6564d54c0fe49de24b9df72e0ad6404` | `3d9fe512e8b71b6fbd743fa5d2654f76de719c8ceb5e65d8293489d141a80d8e` |
| 2026-07 | `1f10376483767215bf4d98497c19c32dc6318b97add86ce9f666018f4f180aa6` | `feb8aae3a1f688703d99b2804c1f45d027720d56b5fcbf8e16ce5e0d26d6168c` |

Chaque instance porte `contractVersion = v2`. Les 907 `PublicationMeta` ont été
simulés et parsés avec le `publicationFactsHash` commun de leur mois, sans créer
de publication. `resourceInputHash` et `artifactInputHash` restent des identités
internes.

## 7. Matrice exhaustive des invariants du Brief — sécurité

| ID | Exigence | Preuve | Statut |
|---|---|---|---|
| SEC01 | Snapshots Household-only | `householdId` unique dans les 15 ressources, 2 artifacts, manifest et meta de chaque mois | PASS |
| SEC02 | RLS et appartenance Household | Rapport 02b : RLS active, aucun DML `anon`/`authenticated`, structures server-only ; garde Query conservée | PASS |
| SEC03 | Participation de vie sans finance Person inventée | Les participants Calendar restent narratifs ; les projections économiques non autoritaires restent Household/UNKNOWN | PASS |
| SEC04 | Aucun split Household/2 | Réconciliation construite sur les composantes Actual ; aucune allocation Person implicite ni règle 50/50 | PASS |
| SEC05 | Aucun montant attribué par défaut aux contacts externes | Contacts/participants n'entrent pas dans le ledger économique sans relation explicite | PASS |
| SEC06 | Confidentialité des IDs/contacts externes | Portée Household, refs de Moment et autorisation Query inchangées ; aucune exposition cross-Household | PASS |

## 8. Matrice exhaustive — Calendar et finance quotidienne

| ID | Exigence | Preuve | Statut |
|---|---|---|---|
| C01 | Fusion Moment/Life Event uniquement par relation canonique | Fixtures relationnelles + sourceRefs ; 30/30 Calendar/Daily | PASS |
| C02 | Continuité jamais déduite des dates seules | `EXPLICIT_CONTINUITY` sans qualifier reste Marker et émet `DATA_NO_CONTINUITY_ASSERTION` | PASS |
| C03 | Enfant non absorbé si parent absent | Fixture de promotion autonome | PASS |
| C04 | Agrégation sans perte d'occurrence analytique | 12/12 memberships exacts ; correctif multi-enfants ; `rawOccurrenceCount` conservé | PASS |
| C05 | Ordre Marker déterministe | Double preflight, ordre stable et digest identique | PASS |
| C06 | `+N` compte les groupes | `hiddenMarkerCount = totalGroups - visibleMarkers` sur 12/12 | PASS |
| C07 | Overflows Ribbon/Marker indépendants | Fixture 5 Ribbons, 4 lanes, overflow séparé | PASS |
| F01 | Somme jours + non affecté = Actual | Résiduel 0 sur les 12 mois | PASS |
| F02 | `KNOWN(0)` distinct de `UNKNOWN` | RuntimeSchemas et fixtures Daily discriminantes | PASS |
| F03 | Remboursement à la date économique | Fixture remboursement lié ; aucun bank fallback utilisé comme autorité quotidienne | PASS |
| F04 | Entrées exclues du coût quotidien | Population Daily limitée aux composantes économiques admissibles ; Journal séparé | PASS |
| F05 | Hover au grain humain économique | Fixture Purchase Event multi-composantes = un `expenseEventId` ; live sans identité reste non inventé | PASS |

## 9. Matrice exhaustive — catégories et nature de dépense

| ID | Exigence | Preuve | Statut |
|---|---|---|---|
| K01 | Seuils de matérialité certifiés | Tests M1/M2 : 50 €/10 % et 25 €/20 % | PASS |
| K02 | Support indépendant de la matérialité | Fixtures Month Balance | PASS |
| K03 | Décomposition catégorie additive | Contributions + residual réconciliés | PASS |
| K04 | Aucune anomalie matérielle cachée dans Autres | Classification et reserved kinds testés | PASS |
| K05 | Nouveau/Réapparu avec recul suffisant | Identité stable et trois mois complets requis | PASS |
| K06 | Fréquence × ticket sur grain répétable | Éligibilité, fenêtre de référence et support testés | PASS |
| N01 | Population M3 = composantes Actual | Réconciliation catégorie et axes sur 12/12 | PASS |
| N02 | Axes indépendants | Necessity, Behavior et LifeScope calculés séparément | PASS |
| N03 | Parts sur Actual total | Gaps conservés, aucune renormalisation sur classifié | PASS |
| N04 | Unknown non forcé | `COVERAGE_PARTIAL` sur 12/12 lorsque classifications absentes | PASS |
| N05 | Marge immédiate = Optional × Variable | Cellule exacte testée dans Month Balance | PASS |
| N06 | Actual−Minimal sans sémantique interdite | Contrats/types n'exposent ni gaspillage ni économie possible | PASS |
| N07 | Familles Minimal additives | 11 mois réconciliés ; août reste `REFERENCE_INSUFFICIENT_SUPPORT` | PASS |

## 10. Matrice exhaustive — vie, lieux et états UI

| ID | Exigence | Preuve | Statut |
|---|---|---|---|
| L01 | Activity occurrence = occurrence humaine | Facts LifeEventId, jamais fréquence transactionnelle | PASS |
| L02 | Coût causal > associé > absent | Résolution Activity testée, kind explicite | PASS |
| L03 | `causalCost` orthogonal à `spentDuring` | Cas A–E du lot 05, ReadModels 22/22 | PASS |
| L04 | Aucun média web/stock/IA automatique | Média direct ou fallback graphique `iconKey` | PASS |
| L05 | GPS brut non assimilé à une visite | Place facts canoniques seulement | PASS |
| L06 | Montant Place selon couverture | Seuils ≥80 %, 60–79,99 %, <60 %, N/A testés | PASS |
| L07 | Domicile/travail pénalisés mais conservés | Scores −35/−30 sans filtre d'exclusion | PASS |
| S01 | UNKNOWN, KNOWN(0), KNOWN_EMPTY distincts | Parsers transversaux 48 checks | PASS |
| S02 | PARTIAL jamais exact | `PartialMeaning` obligatoire, `knownCount`, pas de `totalCount` | PASS |
| S03 | CONFLICT résolu côté serveur | DisplayNode/Quality exposent le conflit ; aucun arbitrage React ajouté | PASS |
| S04 | Aucun seuil métier dans les composants | Builders/moteurs portent les politiques ; architecture 465 fichiers PASS | PASS |
| S05 | Visibility décidée serveur | Toutes les sections conditionnelles passent par `DisplayNode` | PASS |
| S06 | Overlay physique unique | Frontend hors de ce lot ; invariant explicitement différé jusqu'à l'intégration UI | DEFERRED |
| S07 | Navigation/scroll/focus restaurables | Contrats source/target/anchor présents ; exécution UI explicitement différée | DEFERRED |
| S08 | URL indépendante d'un snapshotId | Aucune des 15 ressources ni Query target n'utilise `snapshotId` | PASS |

Les deux `DEFERRED` sont ceux que le protocole déclare non exécutables avant le
frontend. Ils ne masquent aucun calcul ou payload serveur incomplet et ne
déclenchent aucune implémentation frontend dans ce lot.

## 11. Matrice exhaustive — invariants croisés X01–X24

| ID | Exigence | Preuve | Statut |
|---|---|---|---|
| X01 | Actual identique à Analytics certifié | 12/12 comparaisons exactes | PASS |
| X02 | Typical identique au moteur certifié | Même valeur/support ; absence explicite sur les trois premiers mois | PASS |
| X03 | Minimal identique au moteur certifié | Même valeur ; Preview ne recalcule pas ; août insuffisant | PASS |
| X04 | Month top3 = préfixe serveur | 12/12 jours | PASS |
| X05 | Week top6 = même ordre serveur | Toutes les semaines générées | PASS |
| X06 | Jour hors mois adressable sans invention | Refs cross-month explicites et état Quality conservé | PASS |
| X07 | Ribbons max 4 lanes + overflow | Fixture et payload Month/Week | PASS |
| X08 | Journal sans heure inventée | Tous les événements non horodatés restent dans `untimedEvents` | PASS |
| X09 | Journal réconcilié au Daily | Ownership/buckets uniques ; Daily réconcilié à Actual | PASS |
| X10 | Pas de duplication Moment/autres mouvements | `expenseEventId` causal absent de `otherExpenses` | PASS |
| X11 | Bridge additif | Résiduel monétaire 0 sur 12/12 | PASS |
| X12 | `bridgeResidual` conforme à ±0,01 € | Résiduel 0, état KNOWN | PASS |
| X13 | Overview factuel uniquement | Aucun Typical, Minimal ou rang dans le payload | PASS |
| X14 | Cinq familles Overview, ordre contractuel | ReadModels 22/22 ; absences non remplacées par zéro | PASS |
| X15 | Highlights top5 déterministes | Hiérarchie et tie-breakers serveur testés | PASS |
| X16 | GPS seul ne localise pas une dépense | Place detail consomme uniquement les relations autoritaires | PASS |
| X17 | `spentDuring` par fenêtre économique | Cas A–E sans causalité présumée | PASS |
| X18 | V1 incompatible jamais servi comme V2 | 907 instances avec `contractVersion = v2` | PASS |
| X19 | RuntimeSchemas 100 % | 907/907 V2 ; 1536/1536 V1 de comparaison | PASS |
| X20 | `publicationFactsHash` commun par mois | PublicationMeta simulée sur chaque instance | PASS |
| X21 | Hashes d'entrée internes | Contrat PublicationMeta vérifié | PASS |
| X22 | Manifest fermé et exhaustif | 15 familles, 2 artifacts, fermeture des refs | PASS |
| X23 | Références externes explicites | `externalQueryRefs` conservées, jamais réattribuées | PASS |
| X24 | FROZEN_MONTH sans mutation silencieuse | Identité/révision/policies contrôlées par le profil | PASS |

## 12. Déterminisme D01–D07

| ID | Mutation/essai | Résultat | Statut |
|---|---|---|---|
| D01 | Deux exécutions à faits/policies identiques | Hashes et ordre identiques | PASS |
| D02 | Permutation facts/artifacts | Hashes et ordre métier stables | PASS |
| D03 | Mutation d'un fait consommé par Place detail | Manifest stable, factsHash commun modifié | PASS |
| D04 | Changement d'une policy de ressource | factsHash stable, signature/policy de ressource modifiée | PASS |
| D05 | Métadonnées de publication différentes | factsHash identique | PASS |
| D06 | 15 ressources + 2 artifacts en DRAFT in-memory | Publication commune cohérente | PASS |
| D07 | Substitution V1 | Rejetée par queryKey/version/signature | PASS |

Le digest déterministe global est identique entre le run simulant le correctif
et le run final sur les fichiers réellement enregistrés :
`8b68239c12a561465f9531617847d48386a37968483c377f7ffe43f4a9ed9b43`.

## 13. Comparaison et non-régression V1

L'oracle V1 certifié a été consommé en lecture seule pour les notions communes :

| Preuve V1 | Résultat |
|---|---:|
| RuntimeSchemas | 1536/1536 |
| Engine vs Expected | 180/180 |
| History snapshots | 389 |
| Analysis Global | hors périmètre, non généré |

Le correctif touche uniquement le moteur Calendar Semantic V2. Aucun moteur,
snapshot, schema ou hash attendu V1 n'a été modifié pour obtenir le PASS.

## 14. Commandes de validation finales

| Contrôle | Résultat |
|---|---|
| History V2 Canonical | PASS |
| Quality/Visibility/Publication | 48 checks PASS |
| Calendar + Daily Finance | 30/30 PASS |
| ReadModels History | 22/22 PASS |
| Month Balance M1–M4 | 61/61 PASS |
| Snapshot/materialization | 47 checks PASS ; 15 familles ; `finalizeRequested=false` |
| Certification 12 mois | 907/907 RuntimeSchemas ; 324/324 invariants ; 0 FAIL |
| Architecture | PASS, 465 fichiers |
| Typecheck | PASS avec `--incremental false` |
| `git diff --check` | PASS ; avertissements EOL informatifs uniquement |

Le build frontend n'a pas été requis ni relancé dans ce lot de certification
READ-ONLY. Aucun smoke frontend et aucune publication live n'ont été commencés.

## 15. Écarts, données absentes et découvertes

- Le bug multi-enfants n'était pas couvert par la fixture à un seul enfant ; le
  nouveau test le ferme définitivement.
- Les tables Canonical V2 présentes mais sans backfill ne sont jamais compensées
  par une heuristique. Elles produisent les états Quality attendus.
- Une part importante de l'Actual n'a qu'une autorité mensuelle. Elle reste
  explicitement non affectée au lieu d'être répartie arbitrairement sur les jours.
- Les assertions de continuité absentes interdisent correctement les Ribbons
  `EXPLICIT_CONTINUITY` non prouvés.
- Les premiers mois ne disposent pas toujours du recul nécessaire pour Typical,
  Minimal ou les explications comparatives ; le support insuffisant est visible.
- Aucun écart monétaire, aucune duplication Calendar, aucun conflit RuntimeSchema
  et aucun défaut de déterminisme ne subsistent dans le périmètre certifié.

## 16. Conclusion

La certification serveur READ-ONLY History V2 est complète sur les 12 mois. Les
15 ressources, les deux artifacts partagés, leurs RuntimeSchemas, manifests,
hashes, états Quality/Visibility et invariants de réconciliation sont cohérents.
Les données absentes restent explicitement qualifiées et aucune publication n'a
été créée.

HISTORY_V2_CERTIFICATION_GATE = PASS
