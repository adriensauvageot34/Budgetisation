# P14 — PR #29 livrée OFF, coûts World et périmètre SNAP-3

14 octobre 2026. **PR29_DELIVERY = EXECUTED_PASS_OFF**, smoke Production authentifié limité. **SNAP_NET_BENEFIT = NOT_CERTIFIED**. **WORLD_CRITICAL_PATH = MEASURED_REAL_LIMITED**. **SNAP3 = SCOPE_PREPARED_NOT_IMPLEMENTED**.

## A — Livraison exécutée

- HEAD initial : `9bb35730286286226d3952c284a7f0efc679a47c`. Son arbre produit correspond à `512e771384eccf614b1fc210819bb169d3d8b74a`, testé sur les deux Previews existantes.
- Seule correction de livraison : `7c6349bed38b3e904bf90ef584b93a83f1de9e4d`, `vercel.json` passe du Cron quotidien à `crons: []`. PREPARE reste OFF : aucune maintenance automatique non certifiée.
- [PR #29](https://github.com/adriensauvageot34/Budgetisation/pull/29) fusionnée, sans force push, avec contrôle Vercel SUCCESS et HEAD attendu. `main` / merge : **`f765f6d3e38d9f338f6a442071bc4eddfa01b6e7`**. Diff de son arbre avec le HEAD revu `7c6349b` : vide. La branche de diagnostic n'a pas été fusionnée.
- Production : **`dpl_8iJQAbAApS9whAw2i92bdsrRoz7J`**, READY, `iad1`. L'alias [Budgetisation](https://budgetisation-tan.vercel.app) pointe effectivement sur ce SHA.
- Configuration Production : `COMPOSER_P14_SNAP1_ACTIVITY_HISTORY=0`, `COMPOSER_P14_SNAP_PREPARE_ENABLED=0`, `COMPOSER_P14_P3_HISTORICAL_REUSE=0`. Instrumentation absente/default OFF. Région globale inchangée.
- Smoke authentifié réellement exécuté : Composer FRESH, Library, détails Courses, réservation d'épargne protégée, Draft CLEAN, aucune alerte ; pas de diagnostic exposé. Aucun Apply, ajout de dépense ou modification financière en Production. Ce smoke n'est pas une certification E2E globale.

Migration réelle conservée dans Git : `20261014105944_planner_activity_history_durable.sql`, SHA-256 `8CFC89722E986A22FC47972538130E08D82696D4CF07973673DE19BF94A0E004`. Deux tables privées RLS, droits directs révoqués, RPC autorisées explicitement, propriétaires postgres/search_path vide et sept triggers ALWAYS : preuves précédentes conservées, aucun nouveau DDL dans cette mission. Advisors : notices attendues sur tables privées sans policies et RPC definer ; avertissement Auth préexistant conservé.

Les deux artifacts existent toujours, génération 2, couverture contrôlée vraie, état interne enabled=true/revision=3/schema_epoch=1. Cela n'active pas leur consommation Production. Stockage JSONB total d'environ 192 Ko ; environ 484 Ko décodés par enveloppe RPC. Aucun artifact supprimé.

## B — Campagne SNAP comparable et décision

Même code financier, compte/foyer, mois `2026-10`, état sémantique, sources, cutoff, région et instrumentation. Viewports **1920×1080** vérifiés. Même session/moteur IAB ; numéro exact du navigateur non exposé. Cinq paires, alternance inversée pour les paires 3 et 5. La paire 1 conserve une réserve navigate ON/reload OFF ; les quatre suivantes sont reload/reload. Un cold start ou l'état du cache infrastructure ne sont pas certifiés.

| Paire | OFF FRESH | ON FRESH | ON − OFF |
|---|---:|---:|---:|
| 1 | 17,939 s | 21,676 s | +3,737 s |
| 2 | 20,241 s | 17,553 s | −2,688 s |
| 3, observation OFF récupérée après la limite | 17,905 s | 29,976 s | +12,072 s |
| 4 | 32,347 s | 26,805 s | −5,542 s |
| 5 | 21,119 s | 27,212 s | +6,093 s |

| Mesure, n=5 par variante | OFF P50 / P95 | ON P50 / P95 |
|---|---:|---:|
| Board utilisable | 20,241 / 32,347 s | 26,805 / 29,976 s |
| FRESH | 20,241 / 32,347 s | 26,805 / 29,976 s |
| Runtime serveur | 15,786 / 26,267 s | 20,997 / 22,761 s |
| World | 14,403 / 23,798 s | 19,117 / 21,596 s |
| Compiler/Finance | 0,304 / 0,402 s | 0,359 / 0,403 s |
| Admission enveloppe ON | — | 1,102 / 1,321 s |
| Décodage propriétaire ON | — | 0,096 / 0,185 s |

P95 au rang supérieur : **descriptif, non robuste**. Le sous-ensemble strict des quatre paires reload/reload conserve les mêmes P50 FRESH. La médiane des différences appariées est **+3,737 s** ; ON est plus lent dans 3/5 paires. Pas de sélection d'une série favorable.

HIT ON 5/5 ; digests sémantique/Baseline/Preview identiques ; aucun timeout SQL, erreur Supabase ou écriture bloquée. **284 → 263 appels clients** (284 GET → 262 GET + 1 RPC), **11 746 442 → 11 638 973 octets JSON décodés** : 21 appels et 107 469 octets, soit 0,91 %, économisés. Ce ne sont pas des nombres de statements SQL internes ni des octets réseau compressés. Transfert du document navigateur : environ 42–43 Ko, métrique distincte.

Sur la même décision explicite Courses 350 : FRESH édition OFF **38,470 s**, ON **32,490 s** ; SUGGESTIONS OFF **16,721 s**, ON **15,487 s**, n=1 chacun. Parité des digests PASS ; SUGGESTIONS n'a pas retenu implicitement une décision. Ces petits effectifs ne certifient pas un gain. L'édition présente 17–22 s hors du span serveur mesuré. Le code lance une exploration après 200 ms de saisie et les actions peuvent attendre une requête antérieure ; attribution exclusive à cette file ou au réseau **non mesurée**.

**Décision exécutée : consommation SNAP Production OFF.** Le premier snapshot retire du travail réel, mais ne démontre pas de bénéfice utilisateur net. La première campagne aux viewports différents reste invalidée et séparée dans le rapport antérieur.

### Cycle de vie et gates

- Après refus initial de revue automatique, accord utilisateur explicite pour les seules écritures de configuration/artifacts : enabled OFF, revision 1→2 ; MISS authentifié, lecteur direct et mêmes digests. Réactivation revision 2→3 : l'ancienne génération reste MISS. Republication réelle des deux scopes, génération 2, **5,407 s et 5,792 s**, puis nouveau HIT et parité. Aucun writer financier utilisé.
- Soirée réelle sur Preview : ajout immédiat, panneau, prix enfant et financement déclarés, date absente, FRESH/HIT, fermeture/réédition fidèle. Validation du montant Banque réellement exercée. Absence de coût parent supplémentaire vérifiée par les fixtures de parité ; pas d'Apply Soirée réel.
- Modifications vivantes, sources manquantes, parité Soirée/Séjour, Apply/CHECK_APPLY directs, courses aux versions, UNKNOWN et permissions : tests isolés concernés PASS. Tests d'écriture financière adversariaux distants interdits, donc **NOT_RUN**. Cron réel **NOT_RUN**, non programmé.
- Régressions précédentes réutilisées : 28 suites PASS et R3-008 FAIL préexistant documenté. Suites affectées rejouées : SNAP-1 16 contrôles, ouverture P1 12, SUGGESTIONS P4D 10, observation/thenables 6 contrôles PASS ; TypeScript et builds complets local/Vercel PASS. Une première invocation SNAP-1 a refusé un dossier de sortie déjà existant ; exécutée ensuite sur un nouveau dossier isolé, sans reset.
- RLS/auth : preuves réelles déjà obtenues avec deux sessions du même auteur et refus de scope, plus tests natifs/grants. Autre auteur avec vrai JWT et deuxième appareil physique : **NOT_RUN** ; aucune extrapolation de PASS global.
- Après les contrôles et le smoke Production : compteurs de **21 tables** financières, achats, Plans, Drafts et sources inchangés, stats_reset null. Ce sont des compteurs, pas des empreintes exhaustives de lignes ; ils complètent la garde readonly et les chemins réellement exécutés.

## C — Où passent les secondes de World ?

Instrumentation uniquement sur le parcours réel, opt-in, branche locale `codex/composer-p14-pr29-world-trace`. Source `a2f0518`, exclusion des sorties locales `5231c74`, correction d'attribution des builders thenables **`dd18315`**. Deux Previews protégées en iad1 ; la dernière est `dpl_GULZMf3eKCJCme49R5dHe5i64Fta`. Upload CLI depuis cet arbre local : métadonnée gitSource Vercel non fournie. Version DOM et parité confirment les collecteurs servis ; instrumentation non livrée en Production.

Trois READ authentifiés : deux ouvertures et une édition, dont deux avec attribution thenable corrigée. Même données financières, n trop petit pour un P95 représentatif. UUID par READ, horloge serveur unique, débuts/fins relatifs et parents AsyncLocalStorage. Aucune donnée de source, secret, paramètre de requête ou identité utilisateur exportée.

| Rang | Groupe | Temps mural observé | Rôle dans la barrière | Appels physiques / JSON décodé |
|---|---|---:|---|---:|
| 1 | Canonical purchase-aware : découverte économique, coût/timing/contrôles, hydratation et achats | **16,868–26,683 s** | Dernière branche dans 3/3 READ ; queue exposée 3,252–11,911 s | **158 / 4,279 Mo** |
| 2 | M7 contexte : présences, lieux, événements/participations/localisations, projection | **9,767–22,787 s** | Masqué par Canonical ; devient bloquant si Canonical est préparé | **53 / 2,113 Mo**, plus legs partagés |
| 3 | Hydratation Global/FOOD et références propriétaires | **5,535–15,145 s** | Masquée actuellement ; prochaine barrière après Canonical/M7 | **12 / 1,903 Mo** |
| 4 | Évidence commune Forecast/Baseline | **4,459–5,589 s** | Forecast attend cette Promise ; reste après préparation des trois premiers | **20 / 1,437 Mo** |
| — | Legs Mobility partagés | 2,004–2,583 s | Même Promise consommée par Baseline et M7 | 1 / 1,330 Mo |
| — | MonthInputs / PlannedExpenses / habitudes | 0,36–0,80 s | Terminés bien avant la barrière | 1 chacun / petits volumes |
| — | Persona | 0,98–2,34 s | Non dominant | 2 / 6,6 Ko |
| — | Construction Baseline/Renewal | **0,038–0,041 s** | Après la barrière | Calcul synchrone |
| — | Compiler/Finance | **0,330–0,818 s** | Après World | Calcul synchrone |

Les volumes des groupes inclusifs/partagés **ne s'additionnent pas**. Les calls mesurent le propriétaire physique de la première Promise initiée, pas une consommation sémantique exclusive. Pas de temps SQL exclusif disponible : HTTP inclut réseau, PostgREST et attente serveur. SYNC_WALL n'est pas du CPU OS exclusif. La sérialisation/streaming après l'observer et la file d'actions navigateur ne sont pas attribués exclusivement ; leurs écarts restent visibles dans les durées, sans soustraction d'horloges absolues client/serveur.

Chronologie de l'ouverture corrigée, trace `ea612445-9951-4321-ab8f-9df71d674f62` :

| Étape | Début → fin depuis le READ |
|---|---:|
| Auth puis Bootstrap | 0 → 1,677 s |
| World démarre | 1,680 s |
| Évidence et Forecast terminent | 7,271 s |
| Global termine | 16,829 s |
| M7 termine | 24,471 s |
| Canonical termine, barrière levée | 28,367 s |
| World construit | 28,602 s |
| Compiler/Finance puis modèle | 28,602 → 28,944 s |
| Document reçu / FRESH navigateur | 29,969 / 30,714 s |

M7 localisations attend 5,166–17,939 s ; son assemblage synchrone vaut 0,833–0,879 s. La lecture Global Mobility varie de 0,241 à 8,871 s. Concurrence/attente sont observées, leur cause SQL exclusive reste inconnue. Le timeout Canonical 57014 antérieur demeure **OPEN**, même s'il n'apparaît pas dans cette campagne. Aucun index, timeout augmenté ou correctif SQL hypothétique.

### Potentiel, sans addition fictive

En gardant les autres fins de branches mesurées constantes et en supposant une préparation à coût de lecture nul :

| Groupes retirés de la reconstruction | Barrière potentiellement retirée sur les trois READ |
|---|---:|
| Canonical seul | 3,252 / 3,896 / 11,911 s |
| Canonical + M7 | 5,124 / 11,538 / 16,144 s |
| Canonical + M7 + hydratation Global | **12,411 / 21,097 / 16,839 s** |

**ESTIMATED, pas gain exécuté** : il faut soustraire admission/transfert/décodage et suffixe vivant ; la contention peut changer. C'est une différence entre fins d'une barrière, jamais la somme de 16+13+11 s. Même ce retrait idéal laisserait environ 4,5–5,6 s d'évidence, Auth/Bootstrap, Finance et transport/rendu. **Moins de deux secondes reste NOT_CERTIFIED.**

## D — SNAP-3 prioritaire, prêt pour la prochaine mission

**Un seul socle historique composite Canonical économique + M7, avec réutilisation compacte de la publication Global/FOOD existante.** Ce périmètre vise les trois branches de la même barrière, pas quinze caches indépendants. Pas de World complet, ni de scénario financier persisté.

1. **Canonical** : préparer les sorties propriétaire purchase-aware et la fermeture de leurs faits économiques/timing/coût/provenance, identités de composants et liens nécessaires aux références Baseline/Renewal. Conserver les achats qui remplacent les composants bancaires. Les frontières doivent suivre le temps économique du owner, y compris forced-month, paiements hors mois et corrections rétroactives ; aucun simple filtrage par date bancaire.
2. **M7** : préparer occurrences/liens utiles C1, contexte historique, legs et relations de présence/localisation/participation, sorties personnelles M7 sur périodes admissibles. Même méthode et preuves ; coût d'usage estimé reste distinct du carburant payé, rollups non additifs. Ne pas reconstruire 53 appels à chaque READ pour refaire la même projection.
3. **Global** : réutiliser la génération publiée et sa projection FOOD nécessaire à Baseline. Le chemin actuel charge les autorités complètes, puis des références operations/coût/Mobility alors que, avec Forecast fourni, Baseline ne consomme que la publication et FOOD. Prévoir un lecteur propriétaire compact avec l'admission de génération existante ; ne pas dupliquer Forecast ni créer un snapshot Global concurrent.
4. **Évidence** : isoler la partie historique de `MonthPredictionEvidence` pour la partager avec ces faits, sans figer l'objet entier. Les observations courantes et le stock/ledger sont des données vivantes. Les références/statistiques précalculées utilisent les builders existants et leur méthode, unité, couverture et provenance ; pas de médiane de médianes ou de prix approximatif pour compresser.

Contrat proposé : un artifact typé `composer-historical-basis@v1`, scope auteur/foyer/personnes, timezone, plages et cutoff, signatures des owners et publications, périodes/couvertures, vecteur complet des générations, provenance, UNKNOWN/PARTIAL, digest et génération CAS. Pour un futur mois, séparer l'histoire close du suffixe encore vivant ; les sorties dépendantes de la date/mois doivent être bornées ou recalculées par le owner. Une seule inspection atomique et une publication CAS ; réutiliser le protocole SNAP-2 et la récupération après commit perdu, sans plateforme de workers générique.

**Hors artifact** : Draft/S2/choix explicites, Plan et CAS, MonthInputs, réservations d'épargne, PlannedExpenses, ressources Wallet/ledger et observations courantes nécessaires, nouveaux produits/habitudes non couverts, devis prospectifs. Finance V2 continue d'évaluer le Draft. Apply garde la relecture directe autoritaire.

Migration suivante ciblée : stockage privé typé et versionnement du socle, deux RPC inspect/publish, contrôle de scope actuel et owners/search_path/grants explicites ; aucune modification incompatible du store ACTIVITY existant. Avant publication, établir la fermeture transitive des vrais writers Canonical (operations, allocations/items/cash/payments, coût/timing/attributions), achats et assertions/funding/classifications, M7 et localisations, personnes/droits, périodes/couvertures/imports et publications utilisées. Tester UPDATE/DELETE/TRUNCATE, corrections et changements de méthodes sur environnement isolé. Révision générique/TTL insuffisante. Aucun SQL SNAP-3 préparé ou exécuté ici.

Coût de préparation SNAP-3 **ESTIMATED** : ordre de dizaines de secondes suggéré par les lecteurs 17–27 s, pas la somme des spans ; publication/maintenance pas encore mesurées. Admission et taille **NOT_RUN** : privilégier les sorties compactes, mesurer une enveloppe plutôt que transférer plusieurs Mo bruts. Le premier snapshot montre qu'une RPC de 484 Ko peut annuler le bénéfice d'un petit fragment. Fixer le budget de taille après la première mesure, pas une garantie inventée.

Ordre concret suivant : séparation historique/vivant et contrat → préparation par owners/parité → migration revue et vrais writers → publication réelle → Preview authentifiée → A/B comparable → main/Production et activation seulement après gain net. Invalidation immédiate, fallback sûr, rollback OFF et conservation des artifacts. Une maintenance bornée doit tenir sa durée autorisée ; le registre de 64 scopes actuel ne prouve pas un Cron lourd viable.

Acceptation : mêmes faits et digests, frontières/absence d'histoire/UNKNOWN, sources vivantes et rétrocorrections, permissions actuelles avec vrais JWT distincts, CAS/perte de réponse, aucun double compte ; préparation, taille et coût d'admission mesurés. Benchmark petit puis étendu si utile, mêmes données/code/viewport/cache, ouvertures et éditions, séries défavorables conservées. Un gain de plusieurs secondes doit apparaître **au niveau FRESH**, sans mauvaise queue ; les seuls GET supprimés ne suffisent pas.

Candidats écartés comme premier lot : multiplier les snapshots d'événements (fragment déjà insuffisant), Persona/habitudes (non critiques), cache Finance/World complet (dépend des données vivantes et des décisions), nouvelle matérialisation Forecast (publication déjà existante). La région serveur reste un levier séparé non certifié, sans changement Production ici.

## E — Réponses et arrêt

1. **PR #29 est en Production**, SHA et READY vérifiés, smoke authentifié limité PASS.
2. **SNAP OFF**, PREPARE OFF, Cron non programmé, P3 OFF. Infrastructure/artifacts conservés.
3. Gain réel prouvé : **21 appels et 107 Ko décodés en moins**. Aucun gain net utilisateur certifié ; FRESH médian est plus lent ON dans cette série.
4. World attend surtout la fermeture/hydratation Canonical ; les branches M7 et Global se reconstruisent en parallèle. La construction Baseline de 40 ms n'est pas le problème dominant.
5. Préparer seulement Canonical déplacerait souvent la barrière vers M7. Le socle commun couvre un potentiel de **12–21 s de barrière**, estimation avant coûts résiduels.
6. Prochaine implantation : socle historique économique/M7 et lecteur Global compact, sur Supabase/Vercel avec publication et consommation réelles. **SNAP-3 n'est pas commencé.**

Preuves : `docs/status/evidence/p14-pr29-snap3-priority/`. Données techniques sélectionnées/transcrites depuis les sorties exécutées, pas un dump de données financières. Régressions et migration antérieures : `docs/status/evidence/p14-snap-real/`. Instrumentation conservée localement pour la prochaine revue ; elle n'est pas dans main.
