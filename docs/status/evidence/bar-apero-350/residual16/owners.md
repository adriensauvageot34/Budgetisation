# Décisions propriétaires restantes — 18 octobre 2026

## H1 : BLOCKED_OWNER, avant toute réactivation

Lecture seule bornée (transaction READ ONLY, statement_timeout 5s) : `h1_global_published=false`, `canonical_status=READY`, `canonical_is_h1=false`. Aucune identité ni publication modifiée. L'autorisation antérieure de préparer H1 ne permet pas de fabriquer des périodes certifiées ou de remplacer le scope personnel.

Capacité absente : le producteur Global n'a pas d'entrée synthétique certifiable et l'admission Canonical n'est pas multi-foyer. `src/server/analytics/global-v2-production-orchestrator.ts` exige `certifiedThrough` et les couvertures finance/life/calendar ; `src/server/canonical/repository.ts` impose le foyer du contrôle Canonical. Le script de publication existant ne produit pas ces préconditions.

Action minimale à revoir chez ces deux propriétaires : définir un dataset intégralement fictif H1, des périodes réellement contrôlées avec couvertures et révision, et un scope Canonical isolé qui ne déplace pas celui des utilisateurs réels ; faire produire puis admettre une publication Global H1 par le producteur officiel. Vérification de sortie : `readWorld(H1)` autorisé pour A, identité H1, génération/digests/fraîcheur cohérents, rejet d'une publication étrangère. Toute évolution SQL de scope/certification nécessite sa propre revue. Ensuite seulement : réactiver A temporairement, un Draft récupérable, UI Vercel/FRESH, vrais providers, Save/Reload, archive, rebannissement. Aucun de ces actes n'a été exécuté ici.

## R209 : admission Canonical distincte, BLOCKED_OWNER

Le schéma effectif de `referentiel_lieu` n'expose ni Google ID ni mapping externe. Les lecteurs existants ne sont pas un writer d'admission. La référence prospective `night-out-venue@v1` ne crée aucune ligne Canonical et ne vaut pas admission.

Proposition de contrat à examiner par le propriétaire Lieux/Canonical, **non implémentée et non exécutée** :

`admitGoogleBar({requestId, googlePlaceId, expectedSourceGeneration, expectedMappingVersion}) -> {canonicalPlaceId, mappingVersion, sourceGeneration, replayed}`.

- Authentifier l'acteur serveur et autoriser explicitement son scope Canonical avant toute lecture privée ou écriture ; ne pas rendre un référentiel partagé modifiable par un simple utilisateur Composer.
- Relire Details dans l'owner Google avec `BAR_APERO`, vérifier l'ID retourné, le type et l'adresse. Aucune donnée Google du navigateur ne certifie une identité Canonical.
- Évolution à faire chez Canonical : publication versionnée de l'identité externe `{provider, placeId, canonicalPlaceId, sourceGeneration, provenance}` et journal d'idempotence. Unicité exacte `(provider, external_id, authorized_scope)` ; FK Canonical ; CAS sur génération/version. Même request ID et même décision : replay ; payload différent : conflit.
- Permissions : aucun DML navigateur, aucun service-role côté React ; routine serveur avec autorité et search_path explicites, RLS et grants revus. Ne pas utiliser `private_place=false` comme permission globale suffisante.
- Codes : `401 AUTH_REQUIRED`, `403 SCOPE_DENIED`, `409 GENERATION_CHANGED/REQUEST_ID_REUSED/EXTERNAL_ID_CONFLICT`, `422 PLACE_TYPE_INVALID`, `503 PROVIDER_UNAVAILABLE`.
- Relecture : identité exacte et génération publiée avant exposition par `planned-context.ts` puis le DTO Composer. Pas de nom/ville/coordonnées comme clé de rapprochement.
- Tests requis avant migration : isolation des scopes et lieux privés, doublons, rejeu/CAS, mauvais ID/type, publication absente/périmée, rollback désactivant le writer sans supprimer les lieux.

Validation humaine nécessaire : autorité d'admission sur le référentiel partagé, modèle de mapping/source et SQL/RLS ciblé. Aucun SQL distant n'est proposé comme déjà autorisé. Prochaine action : revue propriétaire de ce contrat et d'une migration candidate ; ne pas modifier directement `referentiel_lieu` pour débloquer une démonstration.

## R210 : matching exact local, publication manquante

Le sélecteur accepte un `googlePlaceId` uniquement lorsqu'il est déjà publié par le lecteur propriétaire : correspondance exacte, choix explicite en présence de deux candidats, exclusion des lieux privés. P3 teste exact/absent/ambigu/homonyme. Le DTO réel continue à retirer un identifiant injecté sans publication officielle. Action suivante : publier le mapping officiel décrit ci-dessus ; aucun KNOWN n'est fabriqué en attendant.

## R335 : HISTORICAL_INCIDENT_UNEXPLAINED

L'échec personnel historique n'a pas été reproduit et sa cause n'est pas connue. Les fixtures de service distinguent erreur Save, refus d'accès et perte de réponse après commit ; elles ne prouvent pas la cause de l'ancien incident. La sonde opt-in `barProbe=1` distingue DRAFT_HTTP, PREVIEW_HTTP, MUTATE_OR_PREVIEW_FIXTURE et transitions SAVED/FRESH/FAILED. Corrélations ordinales locales, statut HTTP si disponible, durées ResourceTiming ; ni corps, ni token, ni identité, ni adresse. La durée réseau n'est pas présentée comme temps SQL serveur.

## Zoom desktop natif

Seul le navigateur intégré est disponible dans l'inventaire. Sa capacité viewport règle des dimensions mais ne règle ni ne certifie le zoom natif. Un DPR, une transformation CSS ou un redimensionnement ne sera pas présenté comme 125 %. Conserver `NOT_VERIFIABLE` tant qu'une API de zoom vérifiable ou un navigateur desktop autorisé l'exposant n'est pas disponible.
