# M1-4R — Query, ReadModels et snapshots

Date : 2026-09-08

Branche : `main`

Baseline : `72eefdbb508e4f86461824a8d3a34a53ecf3eb92`

## Verdict

Le riche `GlobalM1OwnerOutputV2` est désormais projeté sans recalcul métier dans les ReadModels compacts et développés. Les valeurs machine restent séparées de `displayValue`, la qualité est portée au niveau de chaque phénomène et les lacunes Minimal demeurent des trous `UNKNOWN` locaux.

```text
M1_4R_QUERY = PASS
TYPED_QUERY_VALUES = PASS
PHENOMENON_LEVEL_QUALITY = PASS
COMPACT_M1 = PASS
OVERVIEW_M1 = PASS
EVOLUTION_ACTUAL_TYPICAL = PASS
EVOLUTION_MINIMAL = PARTIAL_UNTIL_BACKFILL
BREAKDOWN_M1 = PASS
PATTERNS_M1 = PASS
COMPARISONS_M1 = PASS
RECURRENCE_DETAIL_RESOURCE = PASS
MANIFEST_CANDIDATE = PASS
OVER_GATING_CHECK = PASS
NO_DISPLAYVALUE_BUSINESS_PARSE_REQUIRED = YES
NO_HISTORY_QUERY_AS_AUTHORITY = YES
TYPECHECK = PASS
TARGETED_TESTS = PASS
SUPABASE_WRITES = 0
VERCEL_DEPLOY = NO
```

## Contrat Query typé

`GlobalTypedMeasure` transporte `kind`, valeur décimale canonique et unité. `GlobalPhenomenonQuality` transporte état de connaissance, support, couverture effective, matérialité, limites, nature, version de méthode et `inputHash`. Ces champs sont optionnels dans les parsers afin que les snapshots `global-*-@v1` déjà certifiés restent lisibles ; toute nouvelle valeur M1 connue les renseigne.

Les parsers stricts refusent les clés inconnues, les ratios hors domaine, les comptes non entiers, les nombres non canoniques et les hashes invalides. Aucune propriété absente n'est produite avec `undefined`.

## Projections M1

| Surface | Projection | Garde-fou |
|---|---|---|
| Compact | Actual, TypicalState, MinimalState | trois KPI maximum ; Minimal inconnu reste explicitement indisponible |
| Insight | comparaison backend `actualVsTypicalReference` | aucun delta recalculé depuis `displayValue` |
| Overview | état, références, deltas, résumé Trend/Recent/dispersion, coût récurrent publiable | valeurs qualifiées de l'owner uniquement |
| Evolution | Actual, TypicalState, MinimalState sur 12 mois | 3 séries, 36 points ; `UNKNOWN` sans zéro ni interpolation |
| Statistiques | Recent, slope, relativeSlope, start/end, median, q1/q3, IQR, MAD, min/max/amplitude | valeurs Analytics typées ; aucune StabilityPolicy ajoutée |
| Breakdown | nécessité, comportement, LifeScope, unknown/conflict et évolution | libellés humains ; aucun enum brut `Ajustable` |
| Patterns | structural/new/ended/restarted/price change et 50 séries max | lifecycle inconnu ne cache ni observations ni coût typique |
| Comparisons | contributeurs qualifiés et éligibles à la publication | aucune part expliquée inventée |
| Methodology | bornes, méthodes, support, coverage, limites et révisions | descriptor M1 réutilisé |

## Détail des récurrences

La ressource ciblée `analysis_global_economic_recurrence_detail` appartient à la famille existante `global_entity_detail` et prend strictement `{ entityRef }`. Son payload reste `GlobalExpandedReadModel` compatible et expose coût typique par occurrence, montant attendu, équivalent mensuel, premières/dernières observations, cadence, lifecycle et disponibilité de l'évolution de prix.

La ressource a été ajoutée après les dix ressources principales du catalogue afin de préserver leur mapping déterministe. Les signatures M1 et la policy de projection passent à `@v2`; les autres ressources conservent leurs identités.

## Génération et manifest local

Le candidat de test contient 44 snapshots, dont 2 détails de récurrence, 1 artifact owner et une closure pour chaque clé requise. Toutes les références de détail sont présentes dans `requiredQueryKeys`; les métadonnées `publicationId`, révision, `factsHash` et `manifestHash` sont cohérentes sur tous les payloads. Le replay intégré C-A→C-E contient 33 Query instances, 1 artifact et 34 closures.

Il n'existe aucun lien intergénérationnel ni aucune lecture History dans ce chemin. L'oracle et `displayValue` ne sont jamais des inputs de calcul.

## Compatibilité

- la forme legacy de l'owner reste projetable pour les fixtures et snapshots déjà certifiés ;
- les nouveaux champs typed/quality sont additifs et optionnels au parsing ;
- la nouvelle ressource de détail est une instance Query ciblée, pas un nouveau type de payload imaginaire ;
- les séries Minimal inconnues gardent leur mois, leur qualité et l'absence de valeur ; Actual et Typical du même mois restent intacts ;
- aucun ReadModel History n'est une autorité analytique.

## Tests exécutés

| Preuve | Résultat |
|---|---|
| `check:m1-4r-query-snapshots` | 31/31 PASS ; 44 snapshots ; 2 détails récurrence |
| `check:global-v2-primary-readmodels` | 83/83 ; 10/10 schemas PASS |
| `check:global-v2-query-instances` | 59/59 ; 33/33 RuntimeSchemas PASS |
| `check:global-v2-production-bridge` | 66/66 PASS ; 0 producer read |
| certification intégrée ciblée C-A→C-E | 28/28 ; 33 queries ; 34 closures PASS |
| `check:m1-2-3r-engine-owner` | 56/56 PASS |
| `npm run typecheck` (runtime Node configuré) | PASS |
| architecture | PASS ; 564 fichiers |
| `git diff --check` | PASS |

## Limites locales explicites

- `EVOLUTION_MINIMAL = PARTIAL_UNTIL_BACKFILL` : les six points sans autorité historique restent `UNKNOWN` dans la preuve discriminante ;
- les qualifications de stabilité non contractées restent `UNKNOWN`, même lorsque les statistiques descriptives sont connues ;
- aucune donnée, publication, migration, UI ou configuration de déploiement n'a été modifiée.
