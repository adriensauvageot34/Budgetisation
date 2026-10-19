# Bar / Apéro — réception finale Google Places + Mobility live

19 octobre 2026. **PARTIAL : providers réels vérifiés, favoris opérationnels sur PostgreSQL isolé ; admission Canonical et activation Supabase non livrées.**

## Filiation et périmètre

- Départ `2bd6e64ac752278293163cbbf059819b2c66ff50`, branche `codex/bar-apero-350-effective-closure` ; PR **Draft #67**, base #66 `d25ead9f3c8b2033c038491ce9262fa82e787171`, inchangée.
- Produit testé : **`75efc73e67eb20827d743416738cd60914d117f6`**. Les appels et tests ont été exécutés avec le HEAD de départ et les modifications ensuite commitées. Les preuves live enregistrent honnêtement ce HEAD + worktree ; elles ne constituent pas un replay sur un checkout propre du commit produit. Le dernier changement du helper d'entrée assure seulement son nettoyage en cas d'erreur.
- Aucun merge, déploiement Production, changement de secret distant, migration distante, compte Auth réactivé, admission Canonical ou écriture financière réelle. Les écritures SQL de cette mission utilisent exclusivement un nouveau cluster PostgreSQL **17.11**, loopback **55437**, bases synthétiques. Cluster et serveur de fixture arrêtés ; bases conservées hors fichiers versionnés.
- Preuves nouvelles : `docs/status/evidence/bar-google-mobility-live-final/`. Réceptions précédentes, registre350 et goldens inchangés.

## Corrections réellement implémentées

1. Favoris personnels : renommage explicite, vue des archives et récupération sous la version attendue. Enregistrer ou archiver ne choisit pas le bar pour la sortie. Les confirmations RAW existantes restent utilisées. Saisie du nom désactivée pendant sa sauvegarde pour ne pas effacer une modification plus récente à la réception.
2. Un renommage d'un favori actif déjà vérifié reste possible pendant une panne Google ; il ne prétend pas rafraîchir la vérification. Premier enregistrement et récupération d'archive vérifient toujours Details et le type auprès de Google. CAS et reçus supersédés conservés.
3. SQL candidat : FK personnelles `ON DELETE CASCADE` pour ne pas bloquer une suppression de compte/foyer décidée par son propriétaire. Cela ne crée aucune opération de suppression Auth et aucune suppression n'a été exécutée à distance. Journal horodaté, **revue à365 jours**, sans purge, cron ou suppression programmée. `verified_at` ne bouge pas lors d'un simple renommage.
4. Owner TomTom : un texte déictique seul (`maison`, `domicile`, `chez moi`, `travail`, `bureau`, `home`) ne déclenche plus un géocodage arbitraire. L'intention reste inconnue dans l'adaptateur existant.
5. Owner HERE : diagnostic spécifique `GEOMETRY_MISMATCH` pour `importSplitRoute`. Le refus prudent demeure : aucun tarif d'une autre géométrie n'est attribué au trajet TomTom. Aucune modification des calculs financiers.
6. Smoke existant enrichi, pas remplacé : canal serveur stdin sans écho, whitelist HTTPS et refus des redirections, 70 appels maximum par exécution. Fixture existante : opt-in localhost pour providers réels et PostgreSQL17 ; aucun relais Supabase ni secret navigateur.

## Checkpoint A — Google réel et cohérence des deux parcours

Exécution finale **19/10 à09:43:55 UTC**, 52 requêtes au total pour le smoke complet, toutes HTTP200. Les deux premières exécutions ont effectué17 puis30 requêtes : **99 appels smoke**, auxquels s'ajoutent les appels UI bornés séparément à100. Leur nombre exact n'a pas été enregistré. Aucune URL/clé/payload Google brut, adresse personnelle, trace géométrique ou handle HERE n'est publié.

| Cas | Preuve exécutée | Limite |
|---|---|---|
| Bar Montpellier + Details | PASS réel, même ID exact | ID expurgé par hash |
| Nom partiel |1 résultat réel | proposition, pas décision |
| Faute mineure |3 résultats réels | aucune correction silencieuse de décision |
| Bordeaux sans ville imposée |Details confirme Bordeaux | PASS réel |
| Toulouse avec biais Montpellier |4 résultats ; Details confirme Toulouse | biais non restrictif |
| Nom sans ville |1 résultat réel avec ID conservé | PASS réel |
| Recherches homonymes « Le Central » dans deux villes |3+3 résultats, IDs distincts et Details | noms exacts différents selon leurs hashes : **deux établissements strictement homonymes non certifiés en réel** ; non-fusion d'homonymes testée en SQL synthétique |
| Sans résultat |0 réel | parcours nom libre conservé |
| Indisponibilité/limitation | tests d'erreurs injectées et owner existants | aucune vraie429 fournisseur provoquée |

Composer et la préparation de dépense passent par les mêmes `/api/places/autocomplete`, `/api/places/details`, `restaurantPlacesRequest` et `GoogleRestaurantPlaces`. Langue fr, pays FR, même masque, `locationBias`20km pour Montpellier, **aucun `locationRestriction` ni restriction de primary type** ; filtrage des types retournés selon le contexte BAR_APERO/RESTAURANT. Le géocodage transitoire d'une autre ville n'est pas une admission Canonical. Aucun écart de paramètres ne justifie un second moteur de recherche.

## Checkpoint B — persistance personnelle et sécurité

SQL exact : `supabase/candidates/BAR_PERSONAL_GOOGLE_PLACES_REVIEW_DO_NOT_EXECUTE.sql`.

**SHA256 : `0476D053FC1943BD1BB55961265C2DCA694B06BAE3A01524094A9FD7BED44845`.** Remplace l'ancienne empreinte6E3E… ; fichier candidat, **non appliqué à Supabase**.

13 groupes PASS sur PostgreSQL17.11 réel, dont deux connexions concurrentes ; voir `personal-tests.json` et `pg17-final-tests.log`. Niveau : **rôles SQL synthétiques, pas Auth/JWT Supabase**.

- Création, ID identique, homonymes distincts, relecture, archive/récupération avec même identité.
- Renommage hors disponibilité Google, vérification antérieure conservée ; revue journal365jours.
- Versions périmées et deux écritures concurrentes : une acceptée, une CONFLICT.
- Même request ID concurrent : un commit et un replay ; autre payload refusé.
- Réponse perdue : reçu relu sans deuxième mutation ; reçu ancien confronté à l'état courant.
- Autre auteur, autre foyer, membership retirée, compte banni : refus/exclusion attendus.
- DML et RPC refusés pour anon/authenticated ; pas de DML table pour service_role.
- Catalogue vérifié : propriétaires postgres, RLS des deux tables, fonction privée DEFINER et wrapper public INVOKER, search_path vide,4FK avec cascade limitée aux propriétaires supprimés.
- Échec du journal : rollback atomique des deux écritures. Suppression de compte uniquement synthétique : données de cet auteur retirées, celles de A conservées.
- Google indisponible ou Details invalide : aucune nouvelle mutation. Pas de Canonical, visite observée, consommation ou montant modifié par les favoris.

7 groupes React/HTTP PASS : retry même request ID, choix explicite distinct du save, archive/recovery/renommage/reopen, OFF invisible, RAW et ancienne confirmation, reçu supersédé, origin/JSON/taille/Auth. Une erreur introduite pendant le développement (`guardPersonal` admis mais callback non exécuté) a été corrigée ; premier FAIL conservé dans `personal-ui.log`, retests dans `personal-ui-fixed.log` et `personal-ui-final.log`.

### Admission Canonical : blocage propriétaire maintenu

Les métadonnées déjà inspectées et les contrats actuels ne désignent toujours **aucun acteur autorisé à admettre une intention future dans `referentiel_lieu` partagé**, ni publication externe Google/génération de mapping. `AuthorizedRuntimeContext` représente un droit de lecture ; la membership et la possession de service_role ne créent pas un droit métier d'admission.

Le contrat exact `matchPublishedGooglePlace` est testé (provider/ID/scope/génération/publication/non-privé/version, conflit d'identités). **Il n'est toujours pas alimenté par une publication propriétaire réelle. Il ne constitue pas un writer Canonical certifié.** Aucun mapping réel ni nouvel identifiant Canonical n'a été fabriqué. Pas de reconnaissance KNOWN depuis un favori.

**Partie2.3 non achevée :** aucun nouveau writer ou SQL d'admission Canonical n'est livré dans cette tranche. Créer une table/permission présumant l'autorité absente ne satisferait pas le contrat. Décision unique à fournir : désigner l'autorité de publication du référentiel partagé, sa portée et la génération officielle sur laquelle appliquer CAS. Le contrat proposé dans la réception précédente reste le point d'entrée à finaliser chez cet owner après cette décision. La migration personnelle est indépendante et testable dès maintenant.

## Checkpoint C — déplacements et calculs réels

Toutes les positions sont publiques ou synthétiques ; Peugeot207 synthétique, profil propriétaire existant. **Sans date signifie `TYPICAL_NO_DATE`**, pas date inventée.

| Route réelle finale | Distance | Durée | Litres | Essence économique | Péage |
|---|---:|---:|---:|---:|---:|
| Urbain aller vers bar Google |3,046km|779s|0,345454L|0,78€|indisponible, géométrie HERE refusée |
| Urbain retour indépendant |1,329km|513s|0,130221L|0,29€|indisponible |
| Autoroute points publics aller |248,408km|7278s|18,692252L|41,96€|32,80€ HERE |
| Autoroute retour indépendant |260,154km|7861s|19,265129L|43,25€|32,80€ HERE |
| Variante limiter les péages |262,594km|15977s|20,078997L|45,08€|5,50€ HERE, **pas0** |

SP95 officiel : source `FR_GOV_FUEL_INSTANT_V2`, méthode `fr-gov-sp95-local-median@v1`, **2,245€/L**, 5stations/15km, observation retenue `2026-10-19T00:50:00+00:00`, calcul `09:43:58Z`. Qualité propriétaire **STALE**, non promue FRESH. Les montants essence ci-dessus proviennent du moteur existant `fuelEconomicCost`, sans achat de carburant ou sortie bancaire créée.

HERE importe la géométrie TomTom puis demande les péages du handle éphémère pour voiture : tarifs autoroutiers réels reliés au hash exact, directions différentes. L'urbain déclenche `importSplitRoute` : résultat UNAVAILABLE, montantnull. Les premiers smokes ont FAIL sur l'oracle exigeant NONE ; preuves conservées. L'oracle final exige le maintien de cette indisponibilité et de son diagnostic, **pas un faux zéro**. [Documentation HERE route import](https://docs.here.com/routing/docs/routing-v8-route-import).

Scénarios combinés :

- A : aller/retour urbains réels → carburant chiffré, projection PARTIAL pour péage inconnu. **Sans péage urbain exact non certifié.**
- B : sens autoroutiers réels ci-dessus avec essence et tarifs HERE ; le double sens n'est jamais calculé par multiplication du seul aller. Pas de décision Bar autoroutière intégralement validée en UI.
- C : aller réel voiture + retour taxi avec **tarif déclaré synthétique17€**. Retour : essence0, fare/cash17, pas de snapshot voiture résiduel. Aucun devis taxi réel revendiqué.
- D : autre bar Google réel à Bordeaux, bindings adaptés explicitement ; nouveaux digests et coûts81,76€/83,09€ dans la campagne. Les intentions d'origine sont inchangées. Le cas des montants indépendants est également couvert par P1/P4 et `google-route`.
- E : « maison » seul refusé avant réseau ; conservation UNKNOWN par les adaptateurs existants, test owner et scénario synthétique. Aucune distance inventée.
- F : panne route injectée après données valides → prix inconnus et Semantic Draft inchangé. Google indisponible et HERE sans tarif/timeout restent des tests injectés, pas une panne réelle provoquée.
- Parité réelle Builder/Composer : même `estimatePlannedCar`, snapshot stable identique pour le trajet dirigé, deux jambes indépendantes. Aucune formule financière React ajoutée.

## Desktop et régressions

Navigateur Codex, fixture existante, **Google/Details et TomTom réels, favoris PostgreSQL17**, Auth synthétique et Draft du harness. Création Bar → Google → enregistrement explicite → renommage → choix explicite du bar → aller/voiture/départ/Peugeot207 → estimation → sauvegarde Draft → Reload → même bar/route/véhicule → favori renommé retrouvé → archive → récupération. L'archive n'a changé ni lieu retenu ni coût0,97€ de l'aller.

La route UI mesurée :4,556km/995s/0,488183L. **Prix de repli synthétique1,99€**, car le cutoff du World de fixture précède l'observation officielle ; UI l'indique, péage à préciser. Ne pas attribuer ce0,97€ au SP95 live2,245€. Le handoff utilisant la vraie référence officielle est prouvé séparément dans le smoke.

Largeur initiale810px réellement mesurée, puis **1440×900 effectifs**. À1440 : document1440, section personnelle70/70px, configuration413/413px, overflow visible ; pas de scroll vertical interne ou débordement horizontal sur cette scène. Override rétabli. Captures complètes, pas de certification mobile ni de campagne générale350. Les changements de bar et RAW sont testés au niveau indiqué ; la totalité des scénarios combinés n'a pas été rejouée en UI réelle.

| Contrôle final | Résultat / niveau |
|---|---|
| Bar P1/P2/P3/P4 |PASS local aux niveaux de leurs scripts |
| P1/P4 HTTP |premiers FAIL ports3216/3221 et réseau restreint conservés ; retests PASS serveur loopback3245 autorisé |
| Google→route dirigée |6 groupes PASS avec providers simulés ; handoff live séparé |
| Scopes économiques |PASS synthétique |
| PlannedCar |PASS owner, mocks ; GEOMETRY_MISMATCH et déictiques testés |
| Parité historique |**198/198 PASS**,22×9, aucun golden modifié |
| TypeScript |PASS `tsc --noEmit --incremental false` |
| Bundle fixture production |PASS esbuild, pas un build Next |
| Build Next final |**PASS complet Vercel sur75efc73**, Next16.2.6 : compilation31,5s, TypeScript34,5s, pages8/8, deployment completed ; dépendances réutilisées, pas installation fraîche certifiée |
| Auth Supabase/Preview |NOT_RUN_AUTH : pas de SQL personnel distant appliqué, H1 non admissible ; aucun compte personnel utilisé en remplacement |

## Preview, activation et rollback

Preview produit exacte : <https://budgetisation-i4boc50vr-adriensauvageot34-6137s-projects.vercel.app>, `dpl_9qkRiwL34SaATBFzjonxA59J8ftm`, SHA75efc73. **READY confirmé**. Build complet conservé dans `vercel-build-events.json` et métadonnées dans `vercel-deployment.json`. Le navigateur Codex atteint la page Connexion ; capture dans les preuves. Aucun login personnel ni test JWT isolé exécuté. Les warnings npm cache-dir/allowScripts sharp sont conservés dans le journal, sans erreur de build.

`BAR_PERSONAL_PLACES_ENABLED` reste OFF distant. Étape nécessaire pour le rendre disponible à distance : revue/autorisation distincte du SQL personnel exact ci-dessus, migration versionnée et recette JWT isolée avant activation. Cette mission n'autorise pas cette migration Production. Les clés ont été utilisées uniquement en mémoire dans les processus serveur de recette, sans changement des secrets Vercel. Arrêt des deux processus de recette et du PostgreSQL synthétique en fin de campagne.

Rollback applicatif : revert du commit produit75efc73 sur la branche de revue. Aucun rollback de base distante à effectuer. Pour une future activation, désactiver le flag/writer en conservant favoris, archives et journal ; aucune suppression de données. Les CAS, Apply autoritaire et SNAP3 n'ont pas été modifiés.

```text
BAR_GOOGLE_MOBILITY_FINAL = PARTIAL
REAL_GOOGLE = PASS_REAL_PROVIDER_LIMITED_CASES
REAL_TOMTOM = PASS_REAL_PROVIDER
REAL_HERE = PASS_REAL_PROVIDER_MOTORWAY_URBAN_UNAVAILABLE
REAL_FUEL_OFFICIAL = PASS_REAL_PROVIDER_STALE
REAL_BAR_HANDOFF = PASS_REAL_PROVIDER_LIMITED_SYNTHETIC_WORLD
PERSONAL_GOOGLE_SAVE = PASS_LOCAL_PG17_REAL_GOOGLE_SYNTHETIC_AUTH
PERSONAL_SAVE_RELOAD = PASS_LOCAL_BROWSER_PG17
SQL_REVIEW = PASS_CANDIDATE_REQUIRES_DISTANT_APPROVAL
SQL_ISOLATED_MIGRATION = EXECUTED_PASS_POSTGRESQL_17_11
CANONICAL_EXACT_MATCH = PASS_PURE_CONTRACT_ONLY_NO_OFFICIAL_PUBLICATION
CANONICAL_OWNER_ADMISSION = BLOCKED_OWNER_GOVERNANCE_NOT_IMPLEMENTED
OUTBOUND_REAL_ROUTE = PASS_REAL_PROVIDER
RETURN_REAL_ROUTE = PASS_REAL_PROVIDER
REAL_FUEL_ESTIMATE = PASS_REAL_PROVIDER_REFERENCE_STALE
REAL_TOLL_ESTIMATE = PASS_MOTORWAY_URBAN_NOT_CERTIFIED
ROUTE_CHANGE_INVALIDATION = PASS_REAL_REPRICING_AND_TARGETED_FIXTURES
RAW_PRESERVED = PASS_TARGETED_REACT_REGRESSIONS
UNDO_PRESERVED = PASS_TARGETED_REGRESSIONS
FINANCE_PARITY = EXECUTED_PASS_198_198
TYPESCRIPT = EXECUTED_PASS
NEXT_BUILD = EXECUTED_PASS_FULL_NEXT_VERCEL_REUSED_DEPENDENCIES
VERCEL_PREVIEW = READY_EXACT_PRODUCT_COMMIT
VERCEL_AUTH_E2E = NOT_RUN_AUTH
REMAINING_BLOCKERS = CANONICAL_OWNER_GOVERNANCE;REMOTE_PERSONAL_SQL_REVIEW_AND_JWT;URBAN_HERE_GEOMETRY
PRODUCT_SHA_TESTED = 75efc73e67eb20827d743416738cd60914d117f6
HEAD_FINAL = documentaire descendant du produit, indiqué par la PR et git log
PR_URL = https://github.com/adriensauvageot34/Budgetisation/pull/67
PREVIEW_URL = https://budgetisation-i4boc50vr-adriensauvageot34-6137s-projects.vercel.app
VERDICT = PARTIAL_NOT_READY_FOR_REMOTE_ACTIVATION_OR_CANONICAL_ADMISSION
```
