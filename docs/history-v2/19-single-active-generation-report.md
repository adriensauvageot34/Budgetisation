# History V2 — single active generation et Calendar 6 items

Date : 2026-09-02

Base code : `efe810a55d5259689540578ab842f763bf6d5f1e`

Branche : `main`

Projet Supabase : `ipuuhxrblxormwgoaqnz`

## Préflight

- Production Vercel initiale `READY` sur la base exacte.
- Working tree initial propre.
- 12 publications History V2 NEW publiées, 927 Query snapshots NEW actifs et 24 artifacts NEW actifs.
- Aucun draft et aucune génération partielle.
- Le défaut live provenait de générations OLD restées actives lorsque `query_key`, `artifact_key` ou `method_signature` avait changé.
- Duplications confirmées : 607 Query snapshots OLD sur huit ressources History V2 et 12 artifacts `calendar_semantic_month` OLD.

`HISTORY_CC_ACTIVE_GENERATION_PREFLIGHT = PASS`

## Migration de publication

Migration : `20260902105811_enforce_single_active_analytics_generation.sql`.

`publish_analytics_materialization()` désactive désormais une génération précédente selon son identité logique, avec comparaisons NULL-safe :

- Query : household, resource, scope hash, paramètres normalisés, subject, période, as-of et contract version ;
- artifact : household, famille, metric/dimension/bucket, scope/filter, subject, période, as-of et contract version.

`query_key`, `artifact_key` et `method_signature` ne participent plus à l'identité logique. La validation de complétude, la publication atomique, `SECURITY DEFINER`, `search_path = ''` et les grants `service_role` sont préservés. La fonction de rollback n'est pas remplacée.

`HISTORY_CC_ACTIVE_GENERATION_MIGRATION = PASS`

## Réparation live contrôlée

Une transaction idempotente a modifié exclusivement `is_active` :

- 607 Query snapshots OLD désactivés ;
- 12 artifacts `calendar_semantic_month` OLD désactivés ;
- 1 snapshot V1 pré-publication, révision 1 et sans `publication_id`, désactivé face à sa contrepartie V1 publiée révision 17.

Après réparation :

- 0 identité Query active dupliquée ;
- 0 identité artifact active dupliquée ;
- 927 Query snapshots NEW actifs ;
- 24 artifacts NEW actifs ;
- 0 ligne invalidée ;
- 0 payload absent ;
- 0 draft ;
- révision Analytics inchangée à 67 ;
- toutes les lignes OLD sont conservées pour rollback.

Aucun payload, hash, publication, snapshot, artifact, statut de publication ou donnée métier n'a été créé, recalculé, supprimé ou republié.

`HISTORY_CC_ACTIVE_GENERATION_LIVE_REPAIR = PASS`

## Reader défensif

`SupabaseAnalyticsMaterializationStore.readQuery()` applique maintenant le contrat suivant :

- 0 ligne compatible : miss ;
- 1 ligne compatible : hit ;
- plus d'une ligne : log structuré `analytics_query_snapshot_ambiguous` avec ressource, nombre et scope, puis `QueryTemporaryUnavailableError` ;
- l'erreur est conservée par `executeQuery()` et devient une erreur API `TEMPORARY_UNAVAILABLE`, sans read-through silencieux.

Les tests couvrent miss, NEW, OLD compatible unique, ambiguïté et incompatibilité.

## Calendar Month — six Markers

Month et Week prennent maintenant les six premiers groupes de l'ordre serveur. La projection part de `orderedMarkerGroups`, applique les filtres, puis calcule le préfixe et `+N`. Aucun tri métier n'est reconstruit côté React.

Cas discriminants : 0, 1, 3, 6, 7 et 10 items, plus 10 items filtrés vers 2. Le CSS existant est déjà à hauteur minimale et croissance verticale libre ; aucune hauteur fixe ni clipping n'a été ajouté.

`HISTORY_CC_CALENDAR_6_ITEMS = PASS`

## Vérifications

- matérialisation / publication / reader / rollback : PASS, 79 contrôles ;
- frontend History V2 : PASS, 7/7 ressources actives, 15/15 contrats conservés, 14/14 contrats Calendar-centric ;
- TypeScript `tsc --noEmit` : PASS ;
- Next production build : PASS ;
- `git diff --check` : PASS.

Le SHA du commit et le déploiement Production exact sont consignés dans le rapport terminal du run, après le commit unique et le push.

`HISTORY_CC_ROLLBACK_READY = PASS`
