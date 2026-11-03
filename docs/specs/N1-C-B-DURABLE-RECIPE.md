# N1-C-B — Save / Reload local et autorité transactionnelle

G-A option A est approuvée par le mandat de finalisation de #98 : un brouillon organisationnel peut être sauvegardé avec des trajets UNKNOWN / non évalués. Cela ne vaut ni complétude Mobility, ni FRESH, ni APPLIED. G-B et G-C restent ouverts.

**Réception de durcissement : STOP_LOCAL[N1_GLOBAL_LOCK] pour toute utilisation partagée.** La contention globale est reproduite par barrières PostgreSQL, y compris autre foyer/mois et Auth. Aucun fence commun reçu ne couvre encore les dépendances réelles de l'owner/C4 et tous leurs writers. Les verrous restent conservateurs dans les recettes isolées ; la factory runtime partagée reste explicitement fermée même avec gates et noms de credentials configurés. Le Save→Reload local reste disponible via la factory explicite de recette. Une simple réduction aux tables de fixture ne serait pas une correction du protocole réel.

Le raccord utilise les vrais `ComposerShell`, hooks, transport HTTP, admission N1-A/B, contrat C-A, reader et writer. Aucun second Composer ni nouvel autosave relationnel. Le SQL reste un candidat hors `migrations/`. Rien n’est activé à distance.

## Sources de vérité et cycle utilisateur

- Un document N1 est complet : finance V1 conservée, version explicite N1 et relations ordonnées. La projection V1 sert uniquement aux publications financières READ et au rendu ; elle ne passe jamais dans le writer V1 sur une ligne N1.
- Tant qu’une session relationnelle est active, l’autosave financier V1 est suspendu. Un bouton explicite Save conserve le document entier. DIRTY devient SAVED uniquement après reçu autoritatif validé par C-A ; aucun timer ne vaut reçu.
- Un reçu tardif avance le CAS connu sans installer son document sur une décision locale plus récente. Une réponse perdue conserve la commande exacte ; le retry est idempotent. Une nouvelle proposition après réponse incertaine réconcilie d’abord la commande précédente via le reader.
- Reload refuse DIRTY, une édition apparue pendant la lecture, une source incompatible ou des métadonnées contradictoires à version/digest égaux. Il relit par HTTP, puis recharge réellement la page. Le nouveau Shell restaure le document stocké ; l’historique démarre vide après rechargement complet.
- Le registre RAW garde ses confirmations et son retour du focus. Les modifications financières, liens et historique restent en cache temporaire jusqu’au reçu confirmé, hors RAW.
- Abandon sur source V1 reprend le mécanisme financier historique. Abandon sur source N1 restaure les liens sauvegardés dans le frame et l’historique, conserve les finances DIRTY et garde le writer N1 actif. Undo ne peut ressusciter les liens abandonnés.
- Le scope du cache applicatif est dérivé de l’utilisateur, du foyer et du mois. La page donne une clé React identique à ce scope. Le serveur vérifie toujours le scope indépendamment.
- Apply, remplacement, archive et Restore N1 restent bloqués : aucune tranche N1-D n’est introduite.

## Frontière d’autorité

1. La route appelle `authorizedPlanner()`. Le navigateur ne fournit ni acteur ni foyer ni grant.
2. Le writer exige une vraie connexion `session_user=composer_n1_server`, jamais le propriétaire SQL.
3. L’ouverture reçoit une signature HMAC privée liant session serveur vérifiée, foyer/mois, nonce, backend et transaction. Le rôle SQL seul ne peut même pas obtenir la source privée par cette ouverture.
4. SQL vérifie la signature avant de retourner la source, puis gèle les tables ordinaires/partitionnées des schémas `public`, `private`, `auth` en EXCLUSIVE, dans un ordre stable. SELECT reste possible depuis le reader authentifié séparé ; mutations et verrous concurrents attendent. Ce protocole conservateur couvre également les lignes absentes.
5. SQL revalide Auth synthétique / accès V2 / foyer / gate. Le serveur reconstruit ensuite `authorizedPlanner()` et ses dépendances sans réutiliser la publication antérieure. Il relit la source complète puis republie les capabilities privées et proposées par le véritable owner C4/N1.
6. Une seconde signature lie paquet exact, identité complète source, admission C4/politique, acteur/foyer/mois, nonce/backend/transaction et G-A. SQL contrôle ce binding, l’usage unique, les identités et la primitive CAS existante.
7. L’adaptateur valide le reçu de la ligne écrite et ne le retourne qu’après COMMIT. Un échec de commit ne devient pas SAVED.

La clé HMAC est indépendante du credential SQL ; elle n’est pas retournée ni loggée. Les helpers et la table de clé ne sont pas exposés aux clients. Aucun service-role RPC n’est ouvert. Le rôle dédié n’a pas EXECUTE sur la primitive de stockage, ni SELECT sur les Drafts ou la clé. Seuls les deux helpers signés lui sont accordés. Les requêtes privées ordinaires restent sous le client utilisateur/RLS.

Le modèle protège contre la commande forgée par un client et contre le credential SQL seul ; il ne prétend pas résister au propriétaire de la base ou à une compromission du serveur détenant aussi la clé.

## SQL candidat et compatibilité

Fichier unique : `supabase/candidates/20261103183114_n1_c_b_durable_candidate.sql`.

Les six fonctions privées legacy gardent leurs corps historiques et dix refus après lecture verrouillée, avant replay/mutation. Save, replay, archive et Restore V1/V2 refusent N1 sans downgrade. Les wrappers et privilèges publics historiques restent inchangés. V1 reste fonctionnel. Les clients ordinaires ont SELECT seulement sur les Drafts.

La primitive privée conserve le document entier, source complète, base de Plan, auteur/foyer/mois/lifecycle, CAS et enveloppe de la dernière commande. Deux créations SQL concurrentes ont un seul gagnant ; l’admission UI exige toutefois un Draft privé préexistant. La création relationnelle durable depuis zéro n’est pas un droit ajouté par ce raccord.

L’enveloppe n’est pas un journal d’idempotence permanent : après une mutation ultérieure, une ancienne commande est refusée. Les observations temporelles ne remplacent pas l’identité de mutation.

## Gates et configuration non provisionnée

- `COMPOSER_ROOT_RELATIONS_ENABLED === true` (chaîne exacte `"true"`).
- `COMPOSER_ROOT_RELATIONS_DURABLE_SAVE_ENABLED === true` (même convention).
- Gate SQL privée OFF par défaut.
- Rôle créé NOLOGIN / NOINHERIT ; aucune clé provisionnée par le candidat.
- Le runtime ne construit **aucun** pool partagé : `runtimeRootRelationWriter()` reste fermé jusqu’à réception d’un protocole ciblé. Les recettes isolées construisent explicitement leur writer et leur clé aléatoire locale. Configurer les deux paramètres privés autrefois envisagés ne suffit donc plus à ouvrir le parcours.

Aucune de ces configurations distantes n’est créée ou modifiée. Flags OFF refusent avant Auth et lecture. Le candidat seul ne rend pas Save accessible. Aucun workflow GitHub suivi ni hook install/build/deploy ne l’applique ; build est `next build` et `vercel.json` n’a aucune commande SQL. Le contrôle n’atteste pas la configuration extérieure d’une intégration Supabase : conserver le fichier hors `migrations/` jusqu’à autorisation distincte.

## Recettes reproductibles

PostgreSQL natif 17, cluster dédié créé pour cette recette, écoute uniquement `127.0.0.1:55439`, `data_directory=../p-grp-n1-c-b/pg-isolated` depuis le dépôt. Les scripts vérifient ce chemin réel avant toute création de base. Ils n’acceptent aucun URL/password distant. Toutes les identités, sessions, World, permissions et décisions sont synthétiques.

```text
node scripts/check-root-relation-durable-postgres.mjs
node scripts/check-root-relation-authority.mjs
node scripts/check-root-relation-contention.mjs
node scripts/check-root-relation-writer-lifetime.mjs
node scripts/check-root-relation-shell-native.mjs
node scripts/check-root-relation-durable-http.mjs
node scripts/check-composer-root-relation-durable-contract.mjs
node scripts/check-composer-root-relation-boundary.mjs
node scripts/check-composer-root-relation-exit.mjs
node scripts/check-composer-root-relation-gate.mjs
node node_modules/typescript/bin/tsc --noEmit --incremental false
git diff --check
```

Le test Shell utilise `COMPOSER_REACT_TEST_TOOLS` pour une installation React/test-renderer/esbuild déjà disponible. Il monte le vrai Shell et ses hooks, avec feuilles visuelles/DOM simulées, et traverse le vrai HTTP, le writer non propriétaire et PostgreSQL. Une recette navigateur native complémentaire monte aussi les vrais composants visuels via `scripts/serve-root-relation-durable.mjs` à `127.0.0.1:3131` (`PLANNER_BROWSER_TOOLS` pour esbuild, `N1_RECIPE_GLOBAL_CSS` pour le CSS global compilé). Seul l’hébergement Next/navigation/runtime est substitué. Sa session HttpOnly locale est contrôlée ; ce n’est pas Supabase Auth.

Les fixtures lisent le World et la permission indépendante depuis PostgreSQL après le verrou. Elles ne remplacent pas C4 par une autorisation forcée. Les scénarios comprennent le parcours utilisateur complet, deux sessions concurrentes, révocation indépendante, changement de base, ouverture/commit forgés, signature d’une autre transaction, legacy clients, retry après commit perdu, nouvelles décisions après reçu tardif, RAW, Undo/Redo, abandon, navigation et Reload retardé.

## Limites et seuil suivant

Le verdict local ne vaut pas autorisation de migration ou activation. Le gel de toutes les tables reste disproportionné pour une base partagée. Le writer est maintenant borné à **8 s au total après acquisition de connexion**, incluant l’ouverture SQL, les phases Auth/World/C4 et COMMIT. À expiration, la connexion est détruite, le callback tardif ne peut plus signer/committer, et une transaction incertaine n’est jamais recyclée. La connexion au pool est bornée séparément à 10 s. PostgreSQL 17 configure avant BEGIN transaction_timeout=10 s, idle_in_transaction_session_timeout=9 s, statement_timeout=8 s et lock_timeout=1 s ; l’ouverture signée impose aussi ces limites côté SQL. Les tests raccourcissent ces bornes pour prouver la récupération, sans les étendre. Les anciennes limites statement/lock seules ne bornaient pas l’attente JavaScript idle-in-transaction. La borne limite la durée, **pas le nombre de foyers affectés**, et ne rend pas ce protocole acceptable pour exploitation partagée.

Le rôle dédié est recontrôlé à chaque ouverture signée (attributs, memberships, grants directs Draft/clé/primitive) au lieu de ne l’être qu’à l’installation du candidat. Un administrateur qui ajoute un grant lui donne néanmoins ce grant en SQL direct : ce contrôle ferme le helper mais ne prétend pas neutraliser un administrateur. Les signatures, source complète, CAS et contrôle privé des anciennes relations restent inchangés.

Inventaire réel de la fixture de contention : onze tables EXCLUSIVE, dont la table volontairement sans rapport `public.n1_unrelated`. SELECT simple continue ; les writers attendent. Le parcours ne fige ni un nouveau schéma extérieur, ni une table créée après l’énumération. Le nombre de tables réelles du projet distant n’a pas été lu. Un advisory lock par foyer ou une ligne household_revisions isolée ne suffisent pas : les writers Auth, accès privé V2, inputs/planned expenses, publications et faits compilés n’ont pas un protocole commun attesté. Le trigger de révision d’historique existant ne couvre qu’une liste de tables, pas l’ensemble de cette autorité.

Une révocation committée avant la prise des verrous est revalidée et refuse Save. Une révocation demandée après leur acquisition est sérialisée après le commit ; elle n’est pas prétendue déjà effective au point de linéarisation du Save. Les permissions dépendant de faits hors des schémas gelés, de DDL/attributs de rôles, de providers externes ou de la validité d’un vrai token ne sont pas certifiées par la recette locale. La future réception doit établir leur inventaire et leur binding avant activation.

Restent nécessaires : revue indépendante du candidat et de la frontière de signature, étude d’un protocole de verrouillage ciblé coopérant avec les writers réels, provisionnement privé séparément autorisé, tests Supabase Auth/RLS réels inter-foyers dans une cible isolée autorisée, puis décision de migration/activation. G-B/G-C restent ouverts. Aucun Apply, trajet fictif, total de groupe, N1-D ou modification de #93.
