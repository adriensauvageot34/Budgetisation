# Bar / Apéro — Google Places, Canonical et Mobility live

19 octobre 2026. Verdict provisoire de réception : **PARTIAL — pas READY pour admission Canonical ou activation distante**.

## Périmètre et filiation

- Départ vérifié : `1ef6334734814d1f6078b1ffc59a7d81fd62280e`, PR Draft #67 ouverte, non fusionnée, base #66 `d25ead9f3c8b2033c038491ce9262fa82e787171`.
- Produit : `704aeef07c203141afb430a5177ebc91e20104f7`, puis correctif de rejeu **`bdbff62f492b60791bed9e8ac510f0552d3f393f`**.
- Aucun merge/main, migration distante, changement de grants/RLS distants, publication Global/Canonical, admission réelle, activation distante ou écriture financière.
- Le registre des 350 et ses réceptions historiques restent inchangés. Aucun nouveau PASS n'y est déduit de cette mission.
- Après le premier smoke, l'utilisateur a demandé de poursuivre sans les clés actuellement indisponibles et de reporter leurs essais réels. Cette limite remplace l'attente d'un accès immédiat ; elle ne certifie pas les providers.

## A — Fournisseurs : exécution réelle et frontière indépendante

Nouveau script `scripts/smoke-bar-google-mobility-live.mjs` : réutilise `GoogleRestaurantPlaces`, `TomTomRouteProvider`, `FrenchOfficialFuelPriceProvider`, `HereTollProvider`, `estimatePlannedCar`, `preparePlanningMobility`, les opérations Bar existantes et un World entièrement synthétique. Il n'importe aucun client Supabase, ne cherche aucun domicile ni véhicule personnel et n'expose aucun endpoint de diagnostic. Les requêtes sont limitées à 70 et à quatre hôtes providers HTTPS. Les URLs, headers, tokens, adresses Details et géométries ne sont pas journalisés. L'entrée Google est recherchée dynamiquement : aucun Place ID public présumé éternel.

Le script prépare les contrôles Google Montpellier/Bordeaux sans ville imposée, les deux directions TomTom, la référence SP95, HERE urbain/autoroute/éviter péages, puis la parité Builder/Bar chez le même owner. **Les branches qui nécessitent des clés n'ont pas été exécutées.** Leur présence dans le script ne vaut pas certification de son fonctionnement live complet.

| Preuve | Résultat nouveau | Limite |
|---|---|---|
| REAL_GOOGLE | BLOCKED_CREDENTIALS_OR_SCOPE | clé absente du processus ; Vercel la conserve en Secret Production non révélable |
| REAL_TOMTOM | BLOCKED_CREDENTIALS_OR_SCOPE | même limite ; aucune requête TomTom de cette mission |
| REAL_FUEL_OFFICIAL | PASS_REAL_PROVIDER | un GET HTTP 200 réel au service officiel, point public Place de la Comédie |
| REAL_HERE | BLOCKED_CREDENTIALS_OR_SCOPE | aucune requête HERE de cette mission |
| REAL_BAR_HANDOFF | BLOCKED_CREDENTIALS_OR_SCOPE | service commun prouvé en fixture ; chaîne réelle différée |
| NO_SUPABASE_WRITES | PASS | smoke borné aux hosts providers ; seules les deux transactions distantes de métadonnées sont READ ONLY |

Preuve SP95 du 19/10 à 05:10 UTC : médiane **2,245 €/L**, 5 stations, rayon 15 km, source `FR_GOV_FUEL_INSTANT_V2`, méthode `fr-gov-sp95-local-median@v1`, qualité **STALE** selon la politique propriétaire. Le timestamp le plus récent du groupe ne rend pas toutes les stations FRESH. Cette référence actuelle n'est pas un prix certain d'une sortie future. Aucun achat bancaire de carburant créé.

Premier essai sous réseau restreint : échec transport du GET public. Un essai dans le contexte réseau autorisé a ensuite obtenu 200. Aucun renouvellement aveugle des providers sans clés. Le JSON conservé est celui du second essai ; le premier incident est consigné dans `development-incidents.json` à partir de la sortie outil, sans prétendre conserver son journal intégral.

Le HEAD au moment de l'appel SP95 était `1ef6334` **avec le nouveau script encore non commité**. Ce commit historique ne contient donc pas ce script. Le résultat n'est pas attribué faussement à un checkout propre de `1ef6334`, ni rejoué sous le produit final.

## B — Autorité réellement observée et décision

Deux lectures SQL distantes bornées, transactions READ ONLY et timeout 5 s, ont inspecté les métadonnées, pas les lignes financières.

- `referentiel_lieu` : `place_id` UUID PK, classification métier, adresse/commune/région/pays, coordonnées canoniques, `private_place`, parent FK et note. Aucun Google ID, mapping ou génération externe dans ses colonnes.
- RLS activée ; aucune policy utilisateur sur cette table. Grants explicites de table pour postgres/service_role seulement. Aucun trigger métier sur cette table observé.
- Dépendances : mobilité observée, GPS, occurrences de lieux, événements, marchands, liens d'opérations, rôles personnels et distances. Ce référentiel partagé ne devient pas un favori privé par simple ajout d'un champ Google.
- `merchant_place_aliases`, `operation_place_links`, `person_place_roles` existent ; ils relient marchands/opérations/personnes aux lieux. Ils n'offrent pas de mapping Google exact ni de writer de favoris.
- Aucun nom de routine public/private relatif à place/lieu/google/favorite/mapping n'a été trouvé dans le périmètre inspecté. `private.user_has_household_access(uuid)` repose sur les memberships et `auth.uid()` ; owner postgres, SECURITY DEFINER, search_path vide.
- L'admissibilité d'une simple intention dans le corpus Canonical n'est **pas établie**. Le schéma ne prouve pas à lui seul une interdiction métier ; il ne fournit pas non plus une autorisation d'admission utilisateur.

**Choix conservateur implémenté : favori privé prospectif distinct**, conservant uniquement un Place ID et un nom déclaré par l'utilisateur. Ni observation historique, ni KNOWN fabriqué, ni second référentiel Canonical. Une sortie Google reste immédiatement utilisable sans favori. Un enregistrement ou retrait du favori ne modifie jamais la sortie ou ses trajets.

### Code et SQL candidat, non déployé

- Contrat `personal-google-place@v1` : request UUID, Google ID exact, version attendue, SAVE/ARCHIVE et libellé utilisateur. Aucune identité d'auteur/foyer dans la commande HTTP ; aucun dump Google, adresse ou coordonnée admis.
- Service `PersonalGooglePlaces` : accès autorisé avant lecture, Details Google relu pour SAVE, type BAR_APERO et ID exact vérifiés côté serveur. ARCHIVE reste possible sans provider. Aucun writer Canonical.
- CAS et unicité `(auteur, foyer, provider, ID externe)` ; journal request ID avec payload exact ; conflit si ID réutilisé avec une autre commande. Transaction atomique et verrou de scope ; deux IDs homonymes restent distincts.
- Après réponse perdue : relecture du reçu avant toute autre mutation. Si une version plus récente existe, elle est relue et exposée séparément du reçu rejoué ; l'UI n'écrase pas l'état courant avec un reçu ancien.
- Retrait = ARCHIVED, sans DELETE. Les archives reviennent dans la lecture privée avec leur version afin de permettre un nouvel enregistrement sous CAS ; elles restent exclues des suggestions actives. Pas de purge automatique.
- Table privée de favoris et journal privé, RLS activée sans policy de DML client. Aucun privilège table pour anon/authenticated/service_role ; fonction privée SECURITY DEFINER owner postgres, search_path vide, wrapper public INVOKER ; EXECUTE seulement service_role. Le serveur obtient l'acteur depuis Auth.getUser/bootstrap ; SQL revérifie membership et bannissement. Le rôle privilégié est uniquement serveur, pas navigateur.
- API `/api/places/personal` : OFF par défaut, même origin obligatoire en POST, JSON limité à 4 Kio, 30 commandes/minute par scope et garde provider existante. Aucune connexion SQL nouvelle ni secret client.
- L'UI reçoit une capacité optionnelle ; OFF ne monte pas le composant, ne déclenche pas de lecture supplémentaire et n'affiche aucun faux bouton. ON propose un nom personnel non prérempli avec une fiche Google persistée. Un favori reste identifié « Lieu personnel ».
- RAW du nouveau nom inscrit dans le registre existant : protection des changements de question/fermeture et impossibilité pour une ancienne confirmation d'effacer une saisie plus récente. Pas d'enregistrement financier par blur ou navigation.

Candidate complète : `supabase/candidates/BAR_PERSONAL_GOOGLE_PLACES_REVIEW_DO_NOT_EXECUTE.sql`. **Revue et autorisation distinctes exigées avant application distante.** SHA-256 des octets testés : `6E3EB69C1FCDC5BEABE4120ADE496D00E7031311C1003C5094F8EDEB3ADCA257`. Liste de fichiers dans les preuves. `BAR_PERSONAL_PLACES_ENABLED` reste absent des configurations distantes.

Limites à examiner avant migration : contention multi-connexion non testée sur PGlite ; véritables JWT/RLS non exécutés ; cycle de suppression d'un compte à décider (FK auth.users sans cascade, donc suppression potentiellement bloquée tant que favoris/journal existent) ; durée de conservation du journal personnel non arbitrée et aucune purge. Ces réserves ne sont pas une autorisation de modifier Auth ou de supprimer des données. Le flag ne doit pas être activé sur la simple base d'un build READY.

### Mapping et admission Canonical : décision encore requise

Le domaine `matchPublishedGooglePlace` ne reconnaît qu'une publication officielle injectée par l'owner : Google ID/provider exacts, même foyer, même génération, version positive, statut PUBLISHED, lieu non privé. Une ambiguïté reste CONFLICT, jamais une préférence déduite d'un nom ou d'une distance. Tests locaux disponibles ; **aucun lecteur de publication réelle ne fournit encore ce mapping** et cette fonction ne publie rien.

Contrat proposé chez Canonical : `admitGooglePlace({requestId, googlePlaceId, kind, intendedScope, expectedSourceGeneration, expectedMappingVersion})`. Acteur dérivé d'Auth, scope reconnu par l'owner ; Details serveur vérifié, autorisation d'admission distincte d'une simple membership ; CAS génération/version ; unicité exacte provider/ID/scope et FK Canonical ; journal atomique ; relecture et publication avant exposition. Résultats : LINKED si mapping officiel déjà admis, CREATED uniquement après admission propriétaire réelle, PENDING si propriétaire non disponible, CONFLICT/DENIED/PROVIDER_UNAVAILABLE explicites. La création Canonical et sa classification ne peuvent pas être inventées à partir d'un nom Google.

Décision nécessaire : désigner l'autorité autorisée à admettre une nouvelle identité dans le référentiel partagé, sa portée et sa publication versionnée. Recommandation : approuver d'abord la persistance personnelle séparée ; réviser ensuite un mapping Canonical exact indépendant, sans publier un favori comme fréquentation. Aucune migration de mapping spéculative appliquée. Tests attendus : identité exacte/doublons/homonymes, scopes/privé, CAS publication, échec atomique et reprise réseau. Rollback : désactiver le writer/mapping, conserver les données et les anciennes publications.

### Conditions Google vérifiées

Les [politiques Places](https://developers.google.com/maps/documentation/places/web-service/policies) autorisent la conservation du Place ID et imposent les attributions ; elles n'autorisent pas à conserver toute la fiche par défaut. Les [conditions EEE](https://cloud.google.com/terms/maps-platform/eea/maps-service-terms) et les [usages EEE permis](https://cloud.google.com/terms/maps-platform/eea-places-api-permitted-uses) ont été consultés : organisation personnelle, lookup d'adresse et contexte de transaction sont notamment listés. L'application utilise les données transitoires avec attribution, conserve un ID et un libellé utilisateur, et ne crée pas de base de fiches/coordonnées/photos Google. Le contrat de facturation EEE effectif du projet n'a pas été consulté ; cette vérification documentaire ne vaut pas validation juridique de toutes ses intégrations.

## C — Tests et réception

| Groupe | Résultat | Niveau |
|---|---|---|
| SQL exact candidat et service privé | 9 groupes PASS | PostgreSQL embarqué PGlite synthétique ; ni JWT Supabase ni contention multi-connexion |
| UI et frontière HTTP | 6 groupes PASS | véritables handlers React/API, Auth/provider simulés |
| P1/P2/P3/P4 Bar | PASS aux niveaux existants | React/service/PGlite, pas Auth distante |
| Google→owner dirigé | 6 groupes PASS | mocks hérités rejoués |
| COMPONENT économique/60+12 | PASS | fixture isolée |
| PlannedCar | PASS | assertions du propriétaire, providers simulés |
| Parité financière historique | 198/198 PASS | 22 scénarios × 9 hashes ; golden inchangé |
| TypeScript | PASS | commande locale ; preuve finale dans logs |
| Build Next local | FAIL_OUTILLAGE | lien node_modules hors racine Turbopack ; aucune boucle de relance |
| Build Next Vercel final | PASS complet sur bdbff62 | Next16.2.6 : compilation50s, TypeScript52s, statiques8/8, déploiement terminé |

Scénarios SQL : création/relecture, ID déjà enregistré, doublon exact et homonymes, CAS désordonné, rejeu identique/payload différent, réponse perdue sans seconde mutation, reçu supersédé, archive/récupération, provider indisponible/mauvais type/ID, refus inter-auteurs/inter-foyers/membership retirée/bannissement, DML client refusé et rollback de l'écriture si le journal échoue. Les rôles SQL sont simulés localement ; aucune prétention Auth Supabase.

Scénarios UI : pas d'adoption par save, libellé non copié automatiquement du provider, retry au même request ID, réouverture et choix explicite, archive, OFF invisible, protection RAW et confirmation ancienne invalidée, reçu ancien confronté à une archive récente, origin/content-type/taille/Auth refusés.

Navigateur local desktop : Google de fixture → favori → choix explicite → Draft sauvegardé → Reload → favori retrouvé → archive sans changer le bar retenu. Sur **bdbff62** : annulation d'une confirmation conserve exactement le nom RAW ; save, archive puis réenregistrement sous CAS réussissent ; le favori récupéré est choisi explicitement, puis SAVED et Reload conservent son libellé dans la sortie et les suggestions privées. Largeur effective1280px, hauteur720px ; section personnelle44px, overflow visible, scrollHeight=clientHeight44, document sans dépassement horizontal. Le SQL candidat est réellement exécuté dans la base locale du serveur de fixture. Google et Auth sont synthétiques. Aucune donnée réelle utilisée. Les captures et DOM datent les arbres testés ; les scènes intermédiaires sont distinguées dans `browser.json`.

Incidents conservés : extra GET à la reprise d'une fiche P3, corrigé par la capacité optionnelle (test original inchangé, retest PASS) ; relecture initiale omettant les archives et empêchant leur réenregistrement CAS, corrigée/testée ; distinction reçu ancien/état actuel ajoutée/testée. Aucun montant, règle financière, source ou golden modifié pour réussir les tests.

## D — H1 et Preview

La lecture distante confirme toujours `h1_global=false`, `canonical_is_h1=false`. Aucun compte réactivé, aucun marqueur modifié, aucune publication fabriquée. **VERCEL_AUTH_E2E = NOT_RUN_AUTH**. Le foyer personnel n'est pas utilisé comme substitut.

La PR reste Draft et dépendante de #66. Preview finale **READY** : https://budgetisation-dhhvfmy4c-adriensauvageot34-6137s-projects.vercel.app — `dpl_H5zcGzBDcGefPxUW78qrKNV22SnG`, SHA **bdbff62**. L'ouverture navigateur atteint la vraie page Connexion ; aucune connexion personnelle ni contournement de H1. Le favori personnel est OFF sur cette Preview. Son build et ses limites sont consignés dans `evidence/bar-google-canonical-live/vercel.json`. Aucune promotion Production.

## Désactivation / rollback proposés

1. Laisser `BAR_PERSONAL_PLACES_ENABLED` absent ou 0, puis redéployer si la capacité avait été activée après revue.
2. Si nécessaire après une future migration approuvée, révoquer EXECUTE au rôle serveur sur le wrapper public **et** la routine privée, dans une migration revue. Conserver les deux tables et les archives.
3. Ne pas DROP les tables, ne pas supprimer les favoris ; pas de restauration destructive de Canonical.
4. L'ancien contrat Google prospectif continue de fonctionner sans le stockage personnel. Aucun Plan ni Draft officiel ne dépend de cette nouvelle table.

## Verdict et action suivante

```text
BAR_GOOGLE_CANONICAL_MOBILITY = PARTIAL
HEAD_BEFORE = 1ef6334734814d1f6078b1ffc59a7d81fd62280e
PRODUCT_SHA_TESTED = bdbff62f492b60791bed9e8ac510f0552d3f393f
HEAD_AFTER = commit documentaire contenant ce rapport ; SHA exact dans la PR et le compte rendu final
PR = https://github.com/adriensauvageot34/Budgetisation/pull/67 (DRAFT)
PREVIEW_URL = https://budgetisation-dhhvfmy4c-adriensauvageot34-6137s-projects.vercel.app
PREVIEW_STATUS = READY (personnel OFF)
REAL_GOOGLE = BLOCKED_CREDENTIALS_OR_SCOPE (essais différés par l'utilisateur)
REAL_TOMTOM = BLOCKED_CREDENTIALS_OR_SCOPE
REAL_FUEL_OFFICIAL = PASS_REAL_PROVIDER
REAL_HERE = BLOCKED_CREDENTIALS_OR_SCOPE
REAL_BAR_HANDOFF = BLOCKED_CREDENTIALS_OR_SCOPE
GOOGLE_PROSPECTIVE = PASS_LOCAL_DOMAIN (hérité + rejoué)
PERSONAL_SAVED_PLACE = PASS_LOCAL_DOMAIN / PASS_LOCAL_BROWSER ; DISABLED_REMOTE
CANONICAL_MAPPING = BLOCKED_OWNER (résolution exacte locale testée, non publiée)
CANONICAL_ADMISSION = BLOCKED_OWNER
CANONICAL_MATCHING_EXACT = PASS_LOCAL_DOMAIN_ONLY
GOOGLE_OUTBOUND = PASS_LOCAL_DOMAIN_ONLY
GOOGLE_RETURN = PASS_LOCAL_DOMAIN_ONLY
FUEL_ECONOMIC_ONLY = PASS_LOCAL_DOMAIN
TOLL_CASH_SEPARATION = PASS_LOCAL_DOMAIN
RAW_PRESERVED = PASS_LOCAL_DOMAIN / PASS_LOCAL_BROWSER_SYNTHETIC
UNDO = PASS_LOCAL_DOMAIN (owners Bar hérités rejoués)
SAVE_RELOAD = PASS_LOCAL_BROWSER_SYNTHETIC_ONLY
FINANCE_PARITY = EXECUTED_PASS_198_198
TYPESCRIPT = EXECUTED_PASS_LOCAL_AND_VERCEL
NEXT_BUILD = EXECUTED_PASS_FULL_VERCEL (local FAIL_OUTILLAGE conservé)
VERCEL_AUTH_E2E = NOT_RUN_AUTH
VERDICT = PARTIAL_NOT_READY_FOR_CANONICAL_ADMISSION
NEXT_REQUIRED_ACTION = revue du SQL personnel / autorité Canonical ; clés providers plus tard comme demandé
```

Pas de demande d'activer une migration ou de révéler des secrets pendant l'absence de l'utilisateur. Code non destructif construit et vérifié ; arrêt après remise de la Preview et du dossier de revue.
