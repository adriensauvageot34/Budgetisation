# P14-SNAP-REAL — intégration réelle

## Verdict intermédiaire, 14 octobre 2026

`SNAP_REAL = PARTIAL_REMOTE_INTEGRATED_RELEASE_PENDING`.

Migration, publication réelle et consommation authentifiée exécutées. La campagne visuelle corrigée et les contrôles de livraison restent incomplets : la revue automatique du navigateur a refusé la collecte suivante pour limite d'usage, avec reprise annoncée à **15 h 16 Europe/Paris**. Ce refus a été respecté, sans route alternative. La Production applicative reste P13, SNAP OFF. Aucun gain utilisateur certifié.

- Base locale : `82fc5bbc63a93ec852c16d94e51bb71bf6c0bacc` (SNAP-2), branche `codex/composer-v3-p14-snap-real`.
- Main/Production avant livraison : `7d7e8833305c7479bea7edd1778da46f729a0e68` (P13). Le diff produit inclut les dépendances P14 Express/CSS/golden/P1/P2/P4A/P4B/P4D, le prototype P3 maintenu OFF et SNAP-1/2. Aucun merge aveugle de branches architecturales expérimentales.
- Supabase Budgetisation, PostgreSQL 17.6, eu-central-1. Migration additive `20261014105944_planner_activity_history_durable.sql` effectivement appliquée ; SHA-256 du fichier local `8CFC89722E986A22FC47972538130E08D82696D4CF07973673DE19BF94A0E004`. État initial `enabled=false`, revision 0. Puis activation SQL contrôlée pour préparation/Previews : `enabled=true`, revision 1, coverage true. Le flag applicatif Production reste OFF.
- PostgreSQL local distinct 17.11 : migration exacte, 17 contrôles SNAP-2 PASS ; 5 contrôles maintenance supplémentaires PASS. Ce ne sont pas des preuves JWT Supabase.
- Régressions complètes des dépendances : 28 PASS, 1 FAIL préexistant `phase2-planner-interactions` / R3-008 (`CONTEXT_REFERENCE_OWNER_UNAVAILABLE`). Aucun golden modifié pour masquer ce FAIL.
- TypeScript PASS, build Next complet PASS, exit 0. Dépendances locales réutilisées.

## A — Supabase réel

Deux artifacts à partir du reader Canonical existant, sans écriture dans les sources : début `2025-08-01`, cutoff `2026-10-14`, fins exclusives `2026-10-01` et `2026-10-15` (mois Composer octobre/novembre). Chacun conserve 936 occurrences et 292 liens, génération 1. Stockage JSON PostgreSQL : 96 150 / 96 151 octets ; JSON développé environ 484 Ko par artifact. Relecture indépendante du même digest et HIT réel sur l'ouverture, les éditions et SUGGESTIONS. Périodes et volumes sont les seuls agrégats historiques exportés.

Le contrôle du 14 octobre à 14 h 18 Paris confirme revision 1 et les mêmes générations/digests. Les 13 tables contrôlées par `pg_stat_user_tables` conservent exactement leurs compteurs initiaux : opérations, quatre sources historiques, Mobility observée, Wallet/ledger, MonthInputs, PlannedExpenses, Forecast checkpoints, Plans et Drafts. Aucun reset statistique observé. Ces compteurs complètent le garde READ-only et la revue des chemins de write ; ils ne constituent pas une comparaison exhaustive de toutes les lignes.

Sécurité réellement exécutée avec **deux JWT distincts du même auteur autorisé** : même artifact relu ; mauvais auteur/foyer/personnes refusés (42501), RPC trusted refusée ; sans session applicative HTTP 401. JWT d'un autre auteur et DML direct avec JWT : **NOT_RUN**. Les droits effectifs distants et les essais de rôles natifs sont vérifiés séparément ; ils ne remplacent pas ces tests.

Advisors : deux INFO « RLS sans policy » attendus pour le stockage privé fermé ; WARN sur `inspect` SECURITY DEFINER accessible à authenticated, justifié par les contrôles author/foyer/personnes actuels et l'absence de droits directs. Deux INFO index neufs inutilisés ; pas de nouvelle FK non indexée. Protection contre mots de passe compromis et autres avis existants restent hors périmètre. Aucune prétention à « zéro avis ».

Invalidation des classes de writers/races/révocation : PASS natif synthétique, sept triggers réels ALWAYS inspectés. Mutation de source réelle pour fabriquer une invalidation : non exécutée. Invalidation de configuration, fallback réel, republication via maintenance et fréquence opérationnelle d'invalidation : contrôles distants encore **NOT_RUN**. Coût writer mesuré uniquement sur le cluster synthétique ; aucun benchmark de write financier réel. Protocole DDL OFF/version reste obligatoire.

## B — GitHub

Branche poussée, commits d'intégration `ac7debf2ba4980a687eac68161a0400da3ce70dd` puis sondes `512e771384eccf614b1fc210819bb169d3d8b74a`. [PR #29](https://github.com/adriensauvageot34/Budgetisation/pull/29) ouverte et attachée au chat. Vérification GitHub : main P13 inchangé, PR mergeable/clean, statut Vercel success. **Merge NOT_RUN**, car les gates restants sont ouverts.

Diff intégré depuis main : 43 chemins produit/config/migration, 1 378 ajouts / 149 suppressions ; dépendances P14 nécessaires recensées ci-dessus. L'ensemble de la PR contient aussi les preuves/documents des lots antérieurs (383 fichiers). Scan des fichiers textuels ajoutés/modifiés : aucun secret Supabase, JWT ou mot de passe de connexion trouvé ; aucun contenu financier source exporté dans cette mission. Package et lockfile inchangés. Aucun force push.

## C — Vercel

Projet Budgetisation, Previews protégées au **même SHA `512e771…` et à la même région `iad1`** :

- OFF : `dpl_DPjL3dem2ctP8NGr5zuVBkzaAtHU`, `budgetisation-f417wzu6h-adriensauvageot34-6137s-projects.vercel.app`.
- ON : `dpl_3cjNbRSqvPn7N2XihiDzzsemhTqA`, `budgetisation-96j4pafqu-adriensauvageot34-6137s-projects.vercel.app`.

Les deux ont réellement servi le code et les mesures authentifiées ; statut de build Vercel success. P3 OFF, Preview Draft autosave OFF, instrumentation ON et garde des writes financiers ON. Clés serveur déjà configurées utilisées par le runtime ; aucun secret administratif fourni dans le chat n'a été copié dans une commande ou un fichier.

Un nouveau `CRON_SECRET` aléatoire a été généré uniquement en mémoire et transmis au CLI officiel via stdin pour stockage Secret Production ; valeur jamais affichée ni sauvegardée. Production PREPARE=0, SNAP=0, P3=0. Le Cron ne sera installé qu'avec le futur déploiement du `vercel.json`. Exécution réelle du job : **NOT_RUN**.

Le lien partageable contournant la protection Preview a été refusé par la revue automatique. La connexion normale Budgetisation a fonctionné ; aucune protection n'a été affaiblie. La Production applicative reste le déploiement P13 `dpl_FNZVBZNUk71VqJtznPYBocA5VAkg`. Déploiement de ce lot et smoke test Production : **NOT_RUN**.

## D — Mesures réellement obtenues

Chronométrage produit : `performance.now()` serveur, spans World/Compiler et marques navigateur après double requestAnimationFrame. Les durées de l'outil Codex ne sont pas utilisées. Les octets sont des corps JSON décodés, pas le trafic HTTP compressé. Les nombres comptent les appels clients Supabase, pas tous les statements/sous-plans SQL internes aux RPC. Aucun P95 SQL réel n'est disponible pour cette campagne.

### Première série : réserve de viewport détectée

Six ouvertures alternées par variante, même code, mois, auteur, facts/digests, source revision/cutoff, région et instrumentation. **ON était 1920×1080, OFF 486×619** : comparaison visuelle non certifiée. Les chiffres ci-dessous restent enregistrés, mais n'établissent pas un gain utilisateur.

| Mesure | OFF P50 / P95 | ON P50 / P95 | n par variante |
|---|---:|---:|---:|
| Ouverture Board + FRESH, comparaison visuelle invalide | 15,463 / 17,005 s | 16,384 / 19,356 s | 6 |
| Runtime serveur, descriptif | 14,568 / 15,922 s | 15,484 / 18,613 s | 6 |
| World, descriptif | 13,529 / 14,325 s | 13,815 / 16,763 s | 6 |
| Appels Supabase | 284 / 284 | 263 / 263 | 6 |
| GET Supabase | 284 / 284 | 262 / 262 + 1 RPC | 6 |
| Octets JSON décodés | 11 746 442 / 11 746 442 | 11 638 973 / 11 638 973 | 6 |

21 appels clients évités, 107 469 octets décodés en moins (0,91 %). HIT 6/6 parmi les ouvertures ON, zéro timeout relevé. Tous les digests d'ouverture restent identiques. Admission+vérification d'enveloppe 649 ms et décodage 139 ms sur le premier HIT (n=1) ; RPC HTTP 517 ms. Ces phases ne sont pas du temps SQL additionné.

### Série corrigée à 1920×1080

Deux paires complètes recueillies avant la limite de revue :

| Paire | OFF FRESH / serveur | ON FRESH / serveur |
|---|---:|---:|
| 1 | 17,939 / 15,094 s | 21,676 / 15,981 s |
| 2 | 20,241 / 15,917 s | 17,553 / 14,263 s |

P50/P95 descriptifs au rang supérieur, n=2 : OFF FRESH 17,939/20,241 s ; ON 17,553/21,676 s. Échantillon insuffisant pour certifier une amélioration ou une queue. Une troisième observation ON non appariée atteint 29,976 s FRESH / 20,997 s serveur ; sa référence OFF n'a pas pu être collectée. Les navigate/reload et le cache infrastructure ne prouvent pas une comparaison froid/chaud contrôlée. Aucun échantillon favorable sélectionné pour conclure PASS.

Trois montants modifiés dans le Draft mémoire de chaque variante, parité de leurs états/digests PASS ; aucun Apply/autosave. Réponse visuelle FRESH P50/P95 : OFF 18,301/21,712 s, ON 20,249/22,070 s, **réserve de viewport identique**. SUGGESTIONS n=1 : OFF 24,497 s, ON 22,309 s ; parité PASS, aucune conclusion de performance. Ajout Soirée, Centre→Composer instrumenté, deux appareils physiques, absence d'artifact/fallback et cycle distant invalidation→republication : **NOT_RUN**.

### Coût résiduel et SNAP-3

Le fragment historique est effectivement supprimé lors du HIT, mais World reste de l'ordre de 12–17 s dans la première série, parfois plus. Sur le premier HIT : 25 appels `operations`, 14 timing Canonical, 13 contrôles timing, 17 lectures coût Canonical ; données d'opérations ~2,42 Mo, Mobility ~1,60 Mo, snapshots analytiques existants ~1,39 Mo. Ces lectures se chevauchent : **ne pas additionner leurs latences comme durée d'ouverture**.

Le prochain levier est la reconstruction/hydratation historique économique commune à Forecast/Baseline et ses projections Canonical timing/coût/personnes, avec une couverture d'invalidation propre à cet owner. Définir ce périmètre à partir du chemin critique observé avant de construire SNAP-3. Les publications existantes doivent être réutilisées lorsque leur scope/génération/validité le permettent. Aucun deuxième snapshot construit. Cibles <5 s ouverture / <2 s édition non atteintes.

## E — Décision de livraison et contrôles restants

Parité locale (dont golden 22×9), P11/P12/P13, M7, Baseline, Draft/SUGGESTIONS, races/CAS et UNKNOWN : voir les résultats réels dans les fichiers de preuve. Apply de test Production : non exécuté, autorité directe préservée et régression native PASS.

**Aucun gain net certifié. Décision conservatrice : livraison éventuelle du code sûr avec consommation Production OFF, artifacts conservés.** Achever la campagne comparable et les contrôles lifecycle/Soirée, puis merge et déploiement OFF avec smoke test authentifié. Si les nouvelles lectures n'améliorent pas le temps net, garder OFF ; une activation générale n'est pas justifiée par les seuls 21 appels supprimés. Cron PREPARE reste OFF tant que son exécution réelle n'est pas vérifiée.

Blocage restant : accès navigateur refusé par limite de revue automatique jusqu'à l'heure annoncée. Aucun nouvel accord utilisateur nécessaire pour les opérations déjà autorisées. Ne pas relancer B0/M0/F0 ni les 28 régressions déjà PASS pour reprendre.

## Architecture effectivement branchée

`authorizedPlanner` construit un reader authentifié uniquement si SNAP=1. READ/mutations/SUGGESTIONS peuvent l'utiliser. Apply/CHECK_APPLY gardent la relecture autoritaire directe. Aucun nouveau moteur financier.

Préparation explicite authentifiée, auteur/foyer déduits du serveur, protection Origin, hors READ. Une erreur ambiguë de publication entraîne une relecture, jamais une seconde écriture aveugle ; rejet CAS certain limité à deux essais.

Maintenance quotidienne Vercel Cron à 00:15 UTC, secret sécurisé, registre limité à 64 scopes déjà publiés. Aucun worker, queue ou World persistant. Une invalidation entraîne immédiatement MISS + direct ; préparation manuelle possible après import, Cron rétablit les scopes ensuite. Le changement quotidien de cutoff peut provoquer une fenêtre MISS après minuit local ; aucune garantie de HIT permanent. Granularité globale conservatrice et croissance des cutoffs à mesurer, sans purge automatique.

## Sécurité et frontières

Deux tables privées RLS sans policies, aucun droit DML/read direct anon/authenticated/service_role. RPC inspect seulement authenticated, publisher/inspect trusted/registry seulement service_role. Owners postgres et search_path vide vérifiés. Les sept triggers source/scope sont ALWAYS, type statement ; couverture contrôlée à chaque admission.

Sources métier/financières de production strictement en lecture seule. Les seuls writes distants autorisés sont schéma/config/artifacts SNAP. Aucun Apply, publication Global/Forecast forcée, modification d'Auth ou de foyer de test. Les tests adversariaux sont synthétiques locaux.

Instrumentation opt-in, agrégats techniques uniquement : noms de ressources, nombres, durées, octets JSON décodés. Aucun paramètre de requête, source row, secret ou identifiant utilisateur. Région inchangée (iad1). Preview autosave Draft OFF et garde de lecture seule pour éviter toute écriture financière pendant les mesures.

## Rollback

1. Flag `COMPOSER_P14_SNAP1_ACTIVITY_HISTORY=0` puis redéploiement : reader direct.
2. `UPDATE private.planner_activity_history_state SET enabled=false WHERE singleton` : admission refusée immédiatement, artifacts conservés.
3. Writer publication : désactiver PREPARE/Cron ou révoquer EXECUTE publish service_role. Aucun DROP/DELETE.
4. Si coût des nouveaux triggers incompatible : consommation OFF, état OFF/version avancée, désactiver uniquement les sept triggers SNAP dans une migration revue ; garder tables/artifacts. Réactivation impose version/coverage vérifiées et nouvelle publication.
5. Rollback Vercel vers déploiement précédent ne retire pas les objets SQL. Ne jamais consommer un artifact après DDL/méthode sans protocole OFF → version → changement → republication → activation.

## Preuves

`docs/status/evidence/p14-snap-real/` : migration/security metadata, contrôles natifs, régressions, TypeScript, build, publications réelles, comparaison des compteurs financiers et mesures authentifiées partielles. Le fichier de mesures retranscrit les agrégats des sorties réellement obtenues ; il n'invente pas les échantillons que le navigateur n'a pas permis de recueillir. Captures complètes et export du tableau navigateur interrompu : non obtenus dans cette reprise.
