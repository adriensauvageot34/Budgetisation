# Bar / Apéro — réception finale Google Places / Mobility

19 octobre 2026. **Favoris personnels prêts pour revue d’activation Production. Recette Vercel Auth exécutée. Admission Canonical séparée, contrat testé et writer distant désactivé. Aucune fusion ni opération Production.**

## 1. Code et filiation réellement vérifiés

- Départ `cedbd0191653d7d64760bb96990ff768d78fb3f6` ; produit principal `8806f37c259361c9ed9782242520dc8a0e3ffcae` ; produit final **`3f04ac96ca4788b0aa9ecd8319336b80494969b0`**. Les tests finaux ont commencé après ces commits, sans modification des sources suivies. Le complément final concerne la connexion OTP de recette et le protocole de rejeu fournisseur ; les propriétaires financiers/personnels/Canonical sont identiques entre les deux SHA.
- PR [#66](https://github.com/adriensauvageot34/Budgetisation/pull/66) toujours Draft, non fusionnée : `d25ead9f3c8b2033c038491ce9262fa82e787171`, base `main` `bd97a33d0e4280b7796e941148057b7693af0229`. PR [#67](https://github.com/adriensauvageot34/Budgetisation/pull/67) toujours Draft, dépend de #66. Ascendance vérifiée ; push normal, aucun écrasement distant.
- Preview finale **READY**, cible Preview, SHA final exact : [Composer de recette](https://budgetisation-ns217ehxq-adriensauvageot34-6137s-projects.vercel.app/recette/bar-favoris), déploiement `dpl_AJrfxww8Vpjdvwcyag4xpEGhTHZb`. Les comptes fictifs sont désactivés après réception ; une nouvelle connexion de test nécessite leur réactivation contrôlée. Les captures restent consultables.
- Preuves expurgées : `docs/status/evidence/bar-google-production-readiness/`. Les journaux intermédiaires défavorables fournisseur, build local et première requête HTTP refusée sont conservés.

## 2. Réconciliation des commandes interrompues — avant toute nouvelle migration

Lecture de l’historique **et** du catalogue sur le seul projet `wlndjknwbceaqrqcwbqw` : les deux migrations annoncées existent ; Plans, PlanRevisions, Composer Drafts et leur gate sont absents. Aucun objet partiel ni migration de réception Plans n’a été créé par l’appel interrompu.

| Migration sur Bar-Test | Résultat réel |
|---|---|
| `20261019103133_bar_personal_auth_test_project_bootstrap` | Déjà appliquée, non répétée |
| `20261019103139_personal_google_places` | Déjà appliquée, non répétée |
| `bar_reception_plan_foundation`, tentative après réconciliation | Refusée par la revue automatique : autorisation du SQL financier complet insuffisante. Non appliquée ; aucune reprise indirecte |
| `20261019105701_bar_test_remove_transaction_fault` | Nettoyage du seul trigger/fonction de panne transactionnelle de test ; tables et lignes conservées |

Ce refus est résolu par la suppression de cette dépendance de la recette : **aucune migration Plans/Drafts n’est nécessaire aux favoris**. Le projet principal n’a été utilisé pour aucun de ces essais. Le SQL de nettoyage est conservé dans `supabase/tests/`, pas dans les migrations générales.

## 3. Favoris personnels : corrections, SQL et garanties

1. L’API personnelle authentifie avec `getUser`, dérive l’auteur depuis Auth et le foyer depuis la lecture RLS existante. Elle ne construit plus World/Global/Canonical pour sauvegarder un lieu personnel. Un foyer absent ou ambigu reste refusé.
2. RPC serveur uniquement : wrapper public INVOKER, fonction privée DEFINER, propriétaire `postgres`, `search_path` vide. `EXECUTE` interdit à `anon` et `authenticated` ; DML direct interdit, y compris à `service_role`. Les deux tables privées ont RLS activée et aucun accès direct client.
3. Après attente du verrou de concurrence, membership et bannissement sont revérifiés. CAS, identité Google exacte, unicité auteur/foyer/ID, reçus idempotents et récupération non destructive restent propriétaires du SQL. Aucun passage automatique en Canonical.
4. FK personnelles `ON DELETE CASCADE` conservées ; journal avec revue à365 jours, aucune purge/cron. La cascade reste testée en PostgreSQL synthétique, pas par suppression de comptes Auth distants.
5. Corrélation discrète : request ID HTTP, étapes AUTH/SCOPE/REPLAY/GOOGLE/SQL/RECONCILE, reçu, version et admission UI. Activation de trace explicite ; aucun nom, requête Google, adresse, contenu de Draft ou token dans ces événements. Erreur HTTP, conflit et permission refusée restent distincts.

Migration officielle versionnée : `supabase/migrations/20261019103139_personal_google_places.sql`. **SHA-256 des octets Git LF : `EC954ECEA09B152312244679860D703622290DB24322DB0B811BC1241E62B9C3`**. Elle remplace l’ancienne empreinte candidate ; aucune approbation Production de l’ancien SQL n’est transposée. Elle est appliquée uniquement sur Bar-Test.

## 4. Auth/JWT/RLS : résultats réellement exécutés

Projet Supabase isolé **Budgetisation-Bar-Test**, PostgreSQL17.11, Auth géré réel, eu-central-1, sans corpus financier réel. Trois comptes `.invalid` A/B/C créés via Auth Admin sans invitation ; A et B appartiennent à H1, C à H2. Deux sessions A indépendantes et un client anonyme ont été utilisés. Aucun JWT n’est forgé ; aucun rôle SQL simulé n’est compté comme preuve Supabase.

| Contrôle | Preuve / résultat |
|---|---|
| Création, relecture, renommage, archive, récupération, relecture A2 | PASS réel Auth/PostgREST |
| Homonymes, ID exact répété, version périmée | PASS réel Auth/PostgREST |
| B dans H1 ne lit pas A ; C dans H2 ne lit/modifie pas H1 ; A ne modifie pas H2 | PASS réel |
| Anonyme et vrais rôles ordinaires : RPC serveur et DML directs refusés | PASS réel |
| Deux sessions concurrentes, ordre des réponses, même request ID, payload différent | PASS réel ; une version admise, conflits/rejeux distincts |
| Réponse perdue après commit, relecture du reçu sans seconde mutation | PASS réel Auth + owner ; confirmé aussi en HTTP Vercel ci-dessous |
| Retrait/rétablissement de membership fictive | PASS réel ; ancien JWT refusé durant la révocation |
| Panne transactionnelle au journal après insertion du favori | PASS réel ; zéro favori et zéro reçu partiels, trigger ensuite retiré |
| Nettoyage des accès | PASS :3 comptes bannis,0 marqueur d’accès actif ; ancien JWT/RPC refusé |

Le premier lot comporte10 groupes Auth, incluant le refus final après bannissement. Le rejeu au SHA final comporte4 groupes supplémentaires ciblés, sans recréer de comptes. Google Details y est explicitement stubé pour isoler les permissions ; **Google est réel dans la recette Vercel**.

État conservé :3 utilisateurs bannis,2 foyers,3 memberships et5 favoris fictifs. Aucun DELETE de compte/favori. Aucune table Plans/Drafts créée, aucun Apply. Les helpers locaux sont arrêtés ; le cluster PostgreSQL synthétique est arrêté, données conservées.

Advisors isolés : INFO [RLS sans policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), attendu pour les tables privées volontairement inaccessibles en direct ; WARN [protection des mots de passe compromis](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) désactivée par défaut du nouveau projet. Aucun réglage Production ni élargissement de policy pour masquer ces avis.

## 5. Vercel / Composer : réception authentifiée

Le host `/recette/bar-favoris` réutilise **ComposerShell, ses éditeurs et le Compiler/Finance existants**. Seuls ses faits financiers sont issus de la fixture versionnée. Auth, API Google et tables/RPC des favoris sont réellement distants. La recette est fermée hors `VERCEL_ENV=preview`, hors projet exact Bar-Test, hors comptes marqués et hors foyers fictifs réservés. Apply et CHECK_APPLY sont refusés serveur ; aucune repository de Plan ne possède un writer.

Les sorties de cette recette restent en mémoire : **ce n’est pas une nouvelle certification de la persistance des Drafts Composer P07**. Cette limite est affichée. La relecture des favoris n’a aucune dépendance à un corpus Global ni à des Plans synthétiques distants.

| Parcours observé dans le navigateur Codex | Résultat |
|---|---|
| Session Supabase réelle A ; création Bar / Apéro ; recherche Montpellier ; Details du même Google ID | PASS |
| Saisie d’un nom personnel, enregistrement explicite, reçu UI `SAVED` version1 | PASS ; choisir le bar reste une autre action |
| Renommage version2, puis choix du bar pour la sortie | PASS |
| Nouveau document Composer / autre sortie, favori renommé relu depuis Supabase | PASS ; distinct d’une simple conservation React |
| Archive version3 : disparition des suggestions, lieu de la sortie ouverte conservé | PASS |
| Récupération : même favori, version4, réapparition active | PASS |
| Autre session réelle : mutation concurrente vers5 ; UI restée sur4 tente un renommage | PASS : `CONFLICT`, saisie RAW conservée ; version5 non écrasée |
| Déconnexion vérifiée sur un nouveau document, nouvelle session Auth, relecture version5, choix explicite du favori dans une autre sortie | PASS |
| Apply visuellement indisponible et interdit au serveur de recette | PASS ; aucun Apply tenté |

La relecture est certifiée par un **nouveau document** et une nouvelle session. Une tentative de rechargement de l’onglet contenant une sortie non sauvegardée n’a pas navigué ; elle n’est pas comptée comme PASS F5. Une confirmation RAW apparue durant une rafale d’actions navigateur a été annulée ; le nom est resté intact et la validation explicite suivante a réussi. Aucun abandon automatique ni double renommage constaté.

Test HTTP Vercel supplémentaire, authentification Supabase émise officiellement via SSR : le client abandonne volontairement le corps de la réponse après commit, puis renvoie **le même request ID**. Résultat : reçu `replayed=true`, version5→6 seulement, même identité, relecture durable à6, aucune double écriture. Le premier accès HTTP a été refusé401 par Deployment Protection ; le retest utilise le jeton **Vercel Trusted Sources officiel du même projet**, sans désactiver les protections. Le navigateur n’a pas subi de coupure réseau forcée ; cette preuve HTTP réelle est séparée de la preuve UI.

Connexion de recette à usage unique : Supabase Admin `generateLink` sur A existant puis SDK `verifyOtp` officiel ; aucun mot de passe masqué extrait, aucune injection de JWT dans le navigateur, aucun faux Auth. Hash transitoire dans un fragment, immédiatement retiré ; aucune clé Admin au client. Composant de réception fermé en Production. Helpers arrêtés, comptes bannis en fin de lot.

Captures : [récupération](evidence/bar-google-production-readiness/browser/recovery.png), [conflit RAW conservé](evidence/bar-google-production-readiness/browser/conflict.png), [choix après nouvelle session](evidence/bar-google-production-readiness/browser/chosen-after-new-session.png). Ce sont des scènes de recette desktop, pas des données financières personnelles ni une nouvelle réception générale de géométrie.

## 6. Canonical : décision acquise, livraison indépendante

**Autorité ciblée approuvée explicitement** : Canonical publie les correspondances Google exactes vers des lieux publics déjà classifiés ; seul le compte éditeur désigné `manonferret34290@gmail.com`, pour son périmètre autorisé, peut confirmer une publication. Une membership n’accorde aucun droit d’admission. Aucun compte réel n’est modifié pour mettre cette décision en œuvre.

Contrat implémenté : `src/server/canonical/google-place-admission.ts`. Scope, Google ID exact, Canonical ID existant, génération, version de mapping, CAS, request ID, provenance et relecture de publication sont obligatoires. Réutilisation du classificateur existant ; un lieu privé ou public non classifié comme bar est refusé. Un reçu historique ne suffit pas à attribuer KNOWN ; le mapping courant doit être publié et admissible. Aucun rapprochement textuel, nouvelle identité Canonical, visite historique ou promotion automatique d’un favori.

SQL proposé : `supabase/candidates/BAR_CANONICAL_GOOGLE_ADMISSION_GOVERNANCE_REVIEW.sql`, SHA-256 Git **`5301862CE5E65FE9E8F6ED86FC3F04925BB666927BF8EFB7FD2DB440A5304C68`**. Registry initialement vide et désactivée ; aucun public wrapper, aucune permission EXECUTE client ou service_role. Dix groupes PostgreSQL17 local passent : acteur/scope, classification, publication/relecture, CAS, payload réutilisé, récupération après commit, lieu devenu privé et droits.

**Pas d’admission partagée live certifiée** : SQL non appliqué à Supabase, adapter live non raccordé, aucun publisher attribué, aucun writer HTTP exposé. La gouvernance est décidée ; restent la revue SQL, l’activation technique explicite et la recette live de publication. Cela ne bloque plus les favoris personnels. Le futur adapter doit lire la classification propriétaire et vérifier la publication courante ; le candidat SQL seul ne constitue pas une API d’admission prête à ouvrir aux clients.

## 7. Mobility réel / HERE urbain

- Défaut d’adaptation reproduit et corrigé : le premier point d’une nouvelle leg n’est retiré que s’il est identique au précédent. Test de deux legs distinctes et d’une jonction dupliquée PASS. Aucun calcul financier n’est déplacé dans React.
- Urbain réel :1leg aller,162 sommets/242 points densifiés, écart original maximal105m ; retour1leg,66/105 points,117m. HERE répond `importSplitRoute` **avec les points bruts et densifiés**, dans les deux sens. Le défaut multileg n’explique donc pas ce refus. Cause du sous-segment non établie ; limitation d’admission de géométrie fournisseur démontrée, montant `UNAVAILABLE/null`, jamais faux zéro ni péage d’une autre route.
- Autoroute : HERE **32,80€ aller**, **32,80€ retour**, variante limiter les péages **5,50€** ; géométries/hash directionnels conservés. TomTom248,408km /260,154km ; aucune multiplication arbitraire de l’aller.
- Première campagne au SHA8806 :37 requêtes publiques, Google/TomTom/carburant/HERE PASS ; handoff FAIL conservé. Le carburant officiel indiquait une observation à11:07:32Z alors que son calcul avait lieu à11:07:11Z. Une référence future est légitimement refusée par le cutoff Planner, coût UNKNOWN ; le rejeu déterministe de cette référence avant/après sa date confirme ce comportement sans perte du trajet. **Cause probable de l’assertion live**, pas une trace complète : le premier journal ne conserve pas le cutoff précis du handoff ni laquelle des trois assertions de sa ligne125 a échoué. Aucun changement de règle ni effacement de l’échec pour faire passer le test.
- Rejeu ciblé au SHA final :31 requêtes ; Google/TomTom réels, handoff Builder/Planner, trajet mixte, changement de lieu et indisponibilité injectée PASS. **Référence carburant réelle précédemment capturée réutilisée après sa date d’observation**, mode explicite dans la preuve ; ce n’est pas une nouvelle lecture carburant. Source officielle SP95 **2,141€/L**,3 observations/15km, FRESH selon l’owner. Prix futur non garanti.
- Toutes ces requêtes visent des lieux publics, sur World synthétique en mémoire ; whitelist HTTPS et budget70 par campagne. Aucun Supabase dans le smoke fournisseur. La limite HERE ne bloque ni le Board ni les autres coûts connus.

## 8. Régressions et builds

- Au produit8806 propre : favoris React/HTTP7groupes, Google/route7groupes, scopes économiques, P1/P2/P3/P4, PlannedCar et parité financière PASS. Le round-trip Preview→Apply→Reload économique est **PGlite isolé uniquement** ; aucune application authentifiée réelle revendiquée.
- Au produit final3f04 propre : rejeu Auth4groupes PASS, garde de recette5/5 PASS, TypeScript PASS, **22scénarios ×9 empreintes =198/198 PASS**, goldens inchangés. Les propriétaires personnels/Canonical/Mobility testés à8806 sont byte-identiques à3f04 ; pas de répétition artificielle de tous les lots.
- Build local Next : **FAIL_OUTILLAGE**, Turbopack refuse le lien `node_modules` extérieur à la racine ; journal conservé, aucun contournement de sécurité.
- Build final Vercel Next16.2.6 : **PASS complet**, compilation29,3s, TypeScript30,2s, génération8/8, `Deployment completed`, READY au SHA3f04. La Preview READY n’est pas utilisée comme substitut aux tests Auth ci-dessus.

## 9. Plan d’intégration et activation — pour revue, pas exécuté

1. Examiner/fusionner #66 en premier, puis rebaser/retargeter #67 sur le main résultant sans réécrire l’historique publié. #66 contient62fichiers, dont les corrections Board/dock/éditeur Bar et le registre350 : ce n’est pas une PR SQL de favoris. Ses réserves historiques restent celles de son rapport, pas une nouvelle certification350 dans cette mission.
2. Maintenir `BAR_PERSONAL_PLACES_ENABLED` absent/0 en Production pendant le premier déploiement. Le flag personnel utilise la valeur effective **`1`**, pas le mot `ON`. Préserver SNAP-3 et les flags financiers existants. Les variables branchées Bar-Test ne doivent jamais être promues vers Production.
3. Faire approuver séparément **le SQL personnel exact et son empreinte ci-dessus** pour Production. Vérifier les préconditions courantes, sauvegarde et absence d’objets homonymes ; appliquer atomiquement par la procédure habituelle. Ne pas appliquer le scaffold de test, son cleanup, ni le candidat Canonical.
4. Conserver les URL/keys Supabase Production existantes et les clés fournisseurs serveur. Ne jamais copier `BAR_AUTH_RECEPTION_PROJECT` ni les identifiants fictifs vers Production. Le garde de recette/OTP reste fermé par `VERCEL_ENV=production` et les deux références de projet exactes.
5. Après autorisation d’un canari personnel Production, activer le flag personnel, vérifier création/relecture/archive/récupération sans Apply, puis décider l’ouverture générale. Cette mission ne contient aucun canari ni écriture Production.
6. Rollback non destructif : remettre le flag personnel à0, redéployer si nécessaire, révoquer EXECUTE de la RPC pour le rôle serveur sous procédure approuvée si une désactivation SQL urgente est nécessaire ; conserver tables, favoris, reçus et archives. Aucun DROP/DELETE requis. Canonical reste désactivé indépendamment ; sa future registry permet également une fermeture sans perte de mapping.

### Verdicts distincts

```text
BAR_GOOGLE_MOBILITY_CLOSURE = READY_FOR_PERSONAL_PRODUCTION_REVIEW
HEAD_BEFORE = cedbd0191653d7d64760bb96990ff768d78fb3f6
PRODUCT_SHA_TESTED = 3f04ac96ca4788b0aa9ecd8319336b80494969b0
HEAD_AFTER = 3f04ac96ca4788b0aa9ecd8319336b80494969b0 (code ; réception documentaire séparée)
PR_66 = DRAFT_UNMERGED_d25ead9
PR_67 = DRAFT_UPDATED_DEPENDS_ON_66
PREVIEW_URL = https://budgetisation-ns217ehxq-adriensauvageot34-6137s-projects.vercel.app/recette/bar-favoris
GOOGLE_LIVE = EXECUTED_PASS_LIMITED_PUBLIC_POINTS
TOMTOM_LIVE = EXECUTED_PASS_LIMITED_PUBLIC_POINTS
FUEL_LIVE = EXECUTED_PASS_OFFICIAL_REFERENCE_FUTURE_CUTOFF_PRESERVED
HERE_MOTORWAY = EXECUTED_PASS_32_80_32_80_5_50
HERE_URBAN = HANDLED_PROVIDER_GEOMETRY_LIMIT_UNAVAILABLE
PERSONAL_SQL_REVIEW = PASS
PERSONAL_SQL_MIGRATION = APPLIED_ISOLATED_TEST_ONLY_VERSIONED_PRODUCTION_NOT_AUTHORIZED
PERSONAL_SUPABASE_AUTH = EXECUTED_PASS_REAL_JWT
PERSONAL_RLS = EXECUTED_PASS_REAL_ROLES_SCOPE_REVOCATION
PERSONAL_SAVE_RELOAD = EXECUTED_PASS_NEW_DOCUMENT_AND_NEW_AUTH_SESSION
PERSONAL_ARCHIVE_RECOVERY = EXECUTED_PASS_REAL_SUPABASE
PERSONAL_VERCEL_AUTH_E2E = EXECUTED_PASS_ISOLATED_SYNTHETIC_FINANCIAL_WORLD
PERSONAL_GOOGLE_FAVORITES_READY = READY_FOR_PRODUCTION_REVIEW
CANONICAL_OWNER_IDENTIFIED = CANONICAL_EXPLICIT_SCOPE_PUBLISHER
CANONICAL_GOVERNANCE_DECISION = APPROVED_TARGETED_AUTHORITY_NO_PRODUCTION_ACTIVATION
CANONICAL_ADMISSION_IMPLEMENTED = CONTRACT_AND_SQL_PROPOSAL_TESTED_DEFAULT_CLOSED
CANONICAL_ADMISSION_VERIFIED = LOCAL_PG17_ONLY_LIVE_NOT_RUN
CANONICAL_GOOGLE_ADMISSION_READY = NOT_ACTIVE_PENDING_SQL_REVIEW_AND_LIVE_ADAPTER
OUTBOUND_ROUTE = EXECUTED_PASS_REAL_PROVIDER
RETURN_ROUTE = EXECUTED_PASS_INDEPENDENT_REAL_PROVIDER
RAW = PASS_TARGETED_UI_AND_REACT
UNDO = PASS_TARGETED_REGRESSION
FINANCIAL_PARITY = EXECUTED_PASS_198_198
TYPESCRIPT = EXECUTED_PASS
NEXT_BUILD = EXECUTED_PASS_FULL_VERCEL_EXACT_SHA_LOCAL_TOOLING_FAIL_RETAINED
REAL_FINANCIAL_WRITES = NONE
PRODUCTION_DEPLOYMENT = NOT_PERFORMED
PRODUCTION_ACTIVATION = OFF_UNCHANGED
TEST_ACCOUNTS = THREE_BANNED_ZERO_ACCESS_MARKERS_DATA_RETAINED
```

**STOP pour revue de #66→#67 et de l’activation personnelle.** La clôture de la recette personnelle n’attend plus Global ; l’admission partagée reste une livraison distincte et explicitement non activée.
