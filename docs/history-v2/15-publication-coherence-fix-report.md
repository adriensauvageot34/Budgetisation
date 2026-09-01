# History V2 — correction de cohérence de publication du Bilan

## Cause corrigée

Le garde-fou de `BalanceMonthView` incluait `policyVersions` dans l'identité commune des quatre ressources M1–M4. Ces versions sont propres à chaque ressource et peuvent donc différer au sein d'une même publication mensuelle.

## Règle appliquée

La clé déterministe commune contient uniquement :

- `publicationId` ;
- `revision` ;
- `factsHash`.

`policyVersions`, `contractVersion` et `generatedAt` restent disponibles dans chaque `PublicationMeta`, mais ne participent pas au contrôle de cohérence simultané des modules. Le garde-fou reste bloquant si un `PublicationMeta` manque ou si l'un des trois champs communs diffère.

## Tests discriminants

Le gate frontend couvre :

- mêmes identifiants de publication avec `policyVersions` différentes : cohérent ;
- `publicationId` différent : incompatible ;
- `revision` différente : incompatible ;
- `factsHash` différent : incompatible ;
- `PublicationMeta` manquant : incompatible.

## Périmètre

Correction frontend uniquement. Aucun changement Analytics, ReadModel, snapshot, publication ou donnée Supabase.

## Validation

- gate frontend History V2 : PASS — 15/15 ressources, 132/132 contrats UX ;
- TypeScript `--noEmit` : PASS ;
- build Next production : PASS ;
- `git diff --check` : PASS.
