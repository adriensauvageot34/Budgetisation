# P06 — Relations Vie et Argent

## Baseline et entrée

- Branche : `main`.
- HEAD : `a83dc2debaba942878798b15bd976cf89e7545df` ; working tree propre à l'entrée.
- P05 et `GLOBAL_PHASE_B` / `GLOBAL_PHASE_C` : PASS dans `P05-report.md`.
- Charte C01–C14 et `AGENTS.md` lus. Aucun retour sur GA0/A1/P01–P05.
- Master : `Brief_Technique_Analyse_Globale_V2_FINAL_EXHAUSTIF_MASTER.docx`, sections M5 P3602–P4383, compléments Phase D P16958–P16989, capacités P15140–P15167 et publication P16041–P16050.

## Préflight D1 — règles effectivement déterminées

Les références P ci-dessous utilisent l'index de paragraphes du Master déjà employé par les rapports précédents. Ce rapport est une preuve de lecture et un relevé de lacune, pas un catalogue normatif concurrent.

| Contrat | Règle établie | Source |
|---|---|---|
| Autorité | Association seulement ; causalité explicite traitée hors RelationshipEngine | P3605–P3628 |
| Catalogue | Exposure, comparator, outcome et grain déclarés avant calcul ; aucun mining libre | P3630–P3642, P4194–P4205 |
| Population | Même personne ; régime contrôlé ; jours professionnels de même weekday | P3796–P3825 |
| Matching | Proximité maximale ±56 jours, voisin comparable, 1:1 sans remplacement | P3834–P3852 |
| Support | Après matching : DAY 15 paires, OCCURRENCE/VISIT 10, MOMENT 5/groupe, WEEK 16 semaines | P3854–P3874 |
| Exclusions | Exceptionnels/gros Moments pour le courant ; saison contrôlée seulement si démontrée | P3876–P3889 |
| Binaire | Différence de probabilités ; ratio absent si dénominateur nul ; McNemar apparié | P3893–P3915 |
| Fisher | Seulement pour une définition déclarant l'inadéquation du matching exact et une population stratifiée | P3901–P3906 |
| Monétaire | Médiane des différences appariées, permutation de signes, bootstrap des paires, intervalle 95 % | P3917–P3937 |
| Quantitatif | Différences appariées, médiane et permutation | P3939–P3945 |
| Hebdomadaire | Spearman après neutralisation de tendance, même régime et semaines complètes | P3947–P3972 |
| Matérialité | Séparée de la statistique ; binaire (10 points ET 20 % relatif) OU 15 points | P3974–P3991 |
| Matérialité monétaire | Policy partagée selon l'outcome ; pas de nouveau moteur M5 | P3994–P4005 |
| FDR | BH sur l'univers scope/révision, pas uniquement sur les effets retenus ; q≤0,05 automatique ; ]0,05;0,10] interne | P4007–P4055 |
| Robustesse | LOMO ≥80 % même direction et aucun effet matériellement opposé ; fenêtres récentes/précédentes de six mois avec support propre | P4065–P4145 |
| Pipeline | Eligibility/coverage → groupes → matching → support → effet → test → matérialité → FDR → temporalité → classification | P4288–P4294 |

`src/analytics/global-v2/materiality.ts` contient l'autorité partagée P03 ; `COST_PER_OCCURRENCE` possède les bornes 5 € et 10 %. La règle binaire M5 est explicite dans le Master mais n'est pas encore enregistrée dans ce moteur. Son ajout serait une extension sourcée, pas une raison de demander un nouveau seuil.

## D1 — arbitrage nécessaire : population de comparaison

Le Master autorise les couples `LEAVE/REST ↔ LEISURE_ACTIVITY`, `WEEKEND ↔ SOCIAL_ACTIVITY`, `WEEKEND ↔ RESTAURANT` (P3650), ainsi que des déclinaisons mobilité/finance (P3660, P3668). Il ne désigne pas leur **comparator**.

À l'inverse, `ONSITE vs REMOTE` est explicite (P3816–P3825, P3893–P3905, P4296–P4320). Cette définition ne peut pas être généralisée implicitement aux autres expositions.

Contrôles complémentaires effectués : recherche des comparateurs dans les sections ultérieures, les tables du Master, les registres de tests et les fichiers Global actuels. Les six lignes de table contenant comparator/comparateur/Fisher reprennent le contrat de champ, les tests ou l'exemple onsite/remote ; elles ne complètent pas les comparateurs LEAVE/REST/WEEKEND. Les annexes Phase D imposent bien un catalogue défini avant exécution (PD-PRE-04), pas un choix de population après observation des effets.

### Pourquoi le choix n'est pas purement technique

Illustration arithmétique synthétique, sans donnée personnelle ni prétention de certification statistique : pour une même fréquence exposée LEAVE de 60 %, un contrôle REMOTE à 20 % donne +40 points ; un contrôle ONSITE à 80 % donne −20 points. Le choix peut changer le sens, le support, la matérialité et les tests éligibles entrant dans FDR. Définir « contrôle = tous les jours non exposés » sans validation créerait donc une convention métier.

Pour WEEKEND, exiger simultanément un contrôle NON_WEEKEND et la même classe weekday/weekend produit zéro paire par construction. Il faut distinguer explicitement la variable d'exposition des contrôles calendaires à conserver (P3827–P3832, P4154–P4155). Aucun relâchement automatique n'est autorisé.

### Décision humaine précise demandée

Figer pour les expositions non professionnelles du core :

1. `LEAVE/REST` : groupe unique ou deux définitions ; comparateur autorisé (jours non exposés, contexte précis ou autre univers explicitement désigné), et contextes exclus.
2. `WEEKEND` : comparateur autorisé et contrôle calendaire applicable lorsque weekday/weekend est lui-même l'exposition.
3. Confirmer si la règle générale « absence explicite de l'exposition dans le même univers admissible » peut servir aux autres définitions non professionnelles ; sinon fournir leurs comparateurs individuellement. Une exposition inconnue ne devient jamais une absence explicite.

Proposition **non appliquée**, pour rendre l'arbitrage concret : LEAVE/REST contre journées explicitement ni LEAVE ni REST de même classe calendaire ; WEEKEND contre journées explicitement NON_WEEKEND, sans égalité de cette classe mais avec les autres contrôles inchangés. Cette proposition modifie la population métier et n'est donc pas un choix technique autonome.

L'absence de pseudo-code pour le bootstrap, les structures de données ou les seeds n'est pas invoquée comme blocker. La lacune porte uniquement sur la définition de ce qui est comparé.

## Capacités et dépendances

- Core prévu : contextes/activité et finance sémantiquement quotidienne prouvée issus B/C ; aucune nouvelle capacité M5 active dans cette reprise.
- Moment/Place/mobilité spécialisée/Purchase : dépendances futures P08/P10 selon leur producteur ; ne pas exécuter une famille avant son autorité (PD-NO-03 et DEP-LATE-001).
- Causalité : hors moteur d'association ; ni cascade ni inversion automatique exposure/outcome.
- D2/D3 non exécutés : aucun moteur, hash, policy, Fact, ReadModel ou payload modifié. Aucun faux PASS obtenu en réduisant le catalogue au seul exemple onsite/remote.
- Seeds, provenance et closure exécutables restent à implémenter et certifier après résolution de D1. Ils ne sont pas présentés comme livrés.

## État de la reprise

Seuls ce rapport et `GLOBAL_EXECUTION_STATE.md` sont modifiés. Aucun checkpoint PASS, push, accès Supabase, migration ou publication. Les tests statistiques M5, B/C et le build ne sont pas exécutés : aucune implémentation n'a changé et le contrat de population doit d'abord être fermé.

- `tsc --noEmit` : PASS (exit 0).
- `git diff --check` : PASS ; avertissement de normalisation LF/CRLF seulement.
- Architecture : NOT_RUN, aucun code/import modifié.
- Tests discriminants M5 : NOT_RUN ; le typecheck ne constitue pas leur preuve.

CURRENT_PROMPT = P06

BASELINE_HEAD = a83dc2debaba942878798b15bd976cf89e7545df

FINAL_HEAD = a83dc2debaba942878798b15bd976cf89e7545df

IMPLEMENTATION_GATE = BLOCKED

CONTRACT_GATE = BLOCKED

TEST_GATE = BLOCKED

LIVE_GATE = NOT_RUN

GLOBAL_PHASE_D_CORE = BLOCKED

UNRESOLVED_REQUIREMENTS = D1 comparator / eligible population for non-professional exposures

LIVE_WRITES = NONE

NEXT_PERMITTED_PROMPT = P06

## Reprise — arbitrage humain des comparateurs appliqué

Cette section décrit l'état courant et conserve le préflight bloqué ci-dessus comme historique. Le blocage sur LEAVE/REST et WEEKEND est **fermé** par l'arbitrage humain ; aucune nouvelle validation de ces choix n'est demandée.

### Policies versionnées

- `relationship-leave-rest-comparator@v1` : exposition LEAVE ou REST ; contrôle explicitement ni LEAVE ni REST. Même personne, régime, classe WEEKDAY/WEEKEND, proximité maximale 56 jours. UNKNOWN, contexte sans preuve ou PersonDay non observable exclus. Pas de restriction arbitraire à ONSITE/REMOTE.
- `relationship-weekend-comparator@v1` : WEEKEND contre NON_WEEKEND explicitement résolu par l'autorité calendaire. Ni égalité de classe calendaire ni exactWeekdayMatch. Les autres contrôles restent inchangés.
- `relationship-onsite-remote@v1` et `relationship-remote-onsite@v1` : question professionnelle dirigée et weekday exact, sans modification de doctrine.
- `relationship-nearest-chronological-no-replacement@v1` : exposés dans l'ordre date/identité, voisin comparable le plus proche, puis date/identité en cas d'égalité. Choix technique outcome-blind, non optimisé selon les effets ou le support obtenu.

### Implémentation enregistrée, encore partielle

| Fichier | Contenu livré |
|---|---|
| `src/analytics/global-v2/relationship-comparators.ts` | Policies validées, prédicats de groupe, validation/déduplication PersonDay, matching 1:1 sans remplacement et exclusions |
| `src/analytics/global-v2/relationship-statistics.ts` | McNemar exact, Fisher 2×2, permutation des signes, bootstrap apparié, BH, Spearman descriptif, neutralisation linéaire descriptive |
| `src/analytics/global-v2/relationship-catalog.ts` | Neuf définitions journalières explicites ; inventaire des dépendances différées, sans mining |
| `src/analytics/global-v2/relationships.ts` | Assemblage journalier sur inputs déclarés : support post-match, effet/test/matérialité, BH sur tous ses tests éligibles, LOMO avec nouveau matching, closure/digest et provenance |
| `src/analytics/global-v2/materiality.ts` | Extension sourcée `RELATIONSHIP_PROBABILITY` dans le moteur partagé, sans changement des anciennes policies |
| `scripts/check-global-v2-relationships.mjs` | Tests synthétiques des primitives et du pipeline journalier |
| `package.json` | Commande `check:global-v2-relationships` |
| ce rapport et `GLOBAL_EXECUTION_STATE.md` | Chronologie, preuves et reprise restante |

Le pipeline journalier n'est pas exposé par le registre de production. Son enveloppe annonce `certificationStatus=PARTIAL_DAILY_CORE` et `publicationEligible=false`. Ses classifications internes ne constituent pas une certification M5 globale ni une autorisation d'envoyer un insight à l'IA. Aucun ReadModel, Query ou publication ne le consomme.

Le catalogue journalier implémenté contient ONSITE→RESTAURANT, ONSITE→REPAS_EXTERIEUR, REMOTE→RESTAURANT, LEAVE/REST→LEISURE_ACTIVITY, WEEKEND→SOCIAL_ACTIVITY, WEEKEND→RESTAURANT, ONSITE/REMOTE→RESTAURATION_EXTERIEURE_COST et WEEKEND→LOISIRS_COST. Ce sous-ensemble n'est **pas** présenté comme fermeture exhaustive du catalogue D1.

### Statistiques et décisions techniques

- McNemar : binomiale exacte bilatérale sur les paires discordantes. Fisher est une primitive isolée : aucune définition journalière n'a le droit de remplacer McNemar par Fisher.
- Permutation appariée : statistique médiane des différences ; enumeration exacte jusqu'à 16 paires, sinon 19 999 permutations déterministes avec correction Monte-Carlo +1. Ne jamais substituer une statistique donnant un p plus favorable. En particulier trois différences identiques non nulles ont un p de 1 pour ce test bilatéral de médiane : cette propriété discrète est testée et non contournée.
- Bootstrap : 3 999 rééchantillonnages de paires, intervalle percentile 95 %, interpolation type 7. Moyenne des différences pour une différence de probabilités ; médiane pour un effet monétaire. Pas encore de blocs temporels, limitation explicite.
- Seeds uint32 dérivées de l'identité scope/révision/définition/méthode ; PRNG mulberry32 versionné. Les effectifs de simulation sont des paramètres techniques, pas des seuils de qualification métier.
- BH : tous les tests journaliers ayant passé eligibility/support entrent, y compris effet nul ou non matériel. L'univers, les exclusions, p et q sont conservés. Le raccordement des tests hebdomadaires au **même univers global applicable** reste à faire : pas de PASS FDR M5 exhaustif.
- LOMO journalier : retrait du mois sur les unités, reconstruction du matching, support restant, direction et opposition matérielle. Le calcul ne se contente pas de supprimer les anciennes paires.
- La neutralisation linéaire et Spearman sont des primitives descriptives ; elles ne prétendent pas encore fermer la famille hebdomadaire M5 ni ses tests d'inférence.

Références techniques consultées, sans remplacer l'autorité métier du Master : [McNemar exact — statsmodels](https://www.statsmodels.org/stable/generated/statsmodels.stats.contingency_tables.mcnemar.html), [permutations appariées — SciPy](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.permutation_test.html), [Fisher exact — SciPy](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.fisher_exact.html).

### Tests de cette reprise

| Commande | Résultat |
|---|---|
| `check-global-v2-relationships` | 84/84 PASS ciblés ; pas le gate exhaustif M5 |
| `check-global-v2-category-needs-materiality` | 49/49 PASS |
| `check-global-v2-economic-function` | 72/72 PASS |
| `check-global-v2-temporal-arbitration` | 179/179 PASS |
| `check-global-v2-routines` | 67/67 PASS |
| `tsc --noEmit` | PASS |
| architecture | PASS, 499 fichiers |
| Next production build | PASS sur le dernier état code enregistré : compilation, TypeScript et génération statique 7/7 |
| `git diff --check` et contrôle des six fichiers non suivis | PASS ; avertissements LF/CRLF seulement |

Preuves ciblées : règles humaines exactes, UNKNOWN/absence de preuve, même personne/régime, 56 jours inclus/63 exclus, collision de voisins, permutation des entrées, futur sans effet, doublons contradictoires, références manquantes, seuils 14/15 paires, effet nul, coverage partielle, McNemar exact, Fisher isolé, bootstrap, grands outliers versus médiane, BH complet versus présélection, seuils binaires 10/15 points et 20 % relatif. Ces tests ne couvrent pas encore tous les cas obligatoires P06.

### Fermeture restante — toujours propriétaire P06

1. Catalogue D1 exhaustif : notamment activité transport, déclinaisons restantes et définitions hebdomadaires ; distinguer réellement les providers core des enrichissements P08/P10.
2. Adaptateurs depuis les producteurs officiels B/C, avec exposition/outcome et autorité au bon grain. Les tests présents alimentent des assertions synthétiques ; ce n'est pas une preuve de raccordement Canonical → Facts → M5.
3. Déclaration partagée de dépendances Global, fenêtres du resolver P02, scopes HOUSEHOLD/SHARED et assertions de participation. Le digest local du pipeline ne remplace pas cette closure contractuelle complète.
4. Spearman inférentiel et univers FDR commun de toutes les définitions actuellement exigibles ; Fisher uniquement derrière une définition autorisée.
5. États récent/ancien six mois, CHANGED_RELATIONSHIP, HISTORICAL_ONLY et branchement aval M3 ; tests adversariaux mois dominant/inversion matérielle et couverture multidimensionnelle complète.
6. Certification D2/D3 exhaustive, matrice des exigences/tests Master et checkpoint seulement après les trois gates PASS.

Aucun nouveau manque normatif n'est invoqué. La suite est un travail d'implémentation/certification P06 restant, pas une nouvelle demande d'arbitrage ni un déplacement vers P07.

COMPARATOR_AUTHORITY_GATE = PASS

IMPLEMENTATION_GATE = PARTIAL

CONTRACT_GATE = PARTIAL

TEST_GATE = PARTIAL

GLOBAL_PHASE_D_CORE = PARTIAL

LIVE_GATE = NOT_RUN

LIVE_WRITES = NONE

NEXT_PERMITTED_PROMPT = P06

Aucun commit PASS, aucun push, aucun P07.

## Reprise suivante — hebdomadaire, FDR commun, adaptateurs et dépendances

État enregistré après la demande de poursuivre les six fermetures :

- `relationship-weekly.ts` : catalogue explicite de deux relations cumulatives ; minimum 16 semaines complètes de même personne/régime ; Spearman sur résidus de tendance linéaire temporelle, permutation déterministe des appariements des résidus, 19 999 tirages et correction +1. Les semaines incomplètes, chevauchantes et futures sont refusées/exclues ; aucun grain de secours. Transport reste fermé avant P08. Les paramètres/méthodes entrent maintenant dans le hash du pipeline consommateur.
- `relationship-evidence.ts` : `closeRelationshipFdrUniverse` exige un résultat ou une exclusion pour chaque définition du plan. Les tests journaliers et hebdomadaires sont corrigés ensemble dans `buildGlobalDailyRelationships`; aucun filtre de matérialité n'entre dans cette frontière. Cas de présélection et définition manquante testés.
- `relationship-fact-adapter.ts` : projections typées de vrais `PersonDayFact` et `ActivityOccurrenceFact`, participation explicite, grain unique multijour. Réutilisation du contrat `GlobalDayContextAssertion` de P05 ; aucun UNKNOWN transformé en contrôle. L'absence d'occurrence ne produit pas un zéro sans preuve distincte d'observabilité exhaustive.
- `relationship-dependencies.ts` : déclaration Global PERSON_DAY/WEEK parsée, Facts, contexte/régime, attribution personnelle, policies, resolver P02 et matérialité partagée. Tests de closure consommée manquante et de sensibilité aux versions. Cette déclaration doit encore être raccordée à l'orchestrateur final ; sa seule existence ne prouve pas le resolver exécuté.
- `classifyRelationshipTemporalWindows` : états STABLE_CURRENT_REGIME, RECENT_ONLY, HISTORICAL_ONLY, CHANGED_RELATIONSHIP et INSUFFICIENT_TEMPORAL_SUPPORT sur preuves de fenêtres ; six mois distincts et ordonnés pour récent/ancien. Ce helper n'est pas encore le calcul end-to-end des fenêtres ni le feed M3.

### Vérification de source ciblée, strictement read-only

Deux requêtes de métadonnées `information_schema.columns` sur `ipuuhxrblxormwgoaqnz` : `person_days`, `life_events`, `life_event_types` et noms de colonnes/tables de contexte. Aucun row métier, titre libre, note ou donnée bancaire lu ; aucune écriture. Le skill Supabase a servi à encadrer ces lectures, sans aucune opération de migration.

Constat : `person_days` ne contient pas de colonne de contexte professionnel ; `CanonicalRepository.loadPersonDays()` sélectionne uniquement identité/personne/date/couverture_localisation. `PersonDayFact` n'expose donc pas ONSITE/REMOTE. Le code History conserve des types contextuels explicites (`travail_site`, `teletravail`, etc.) dans le catalogue Calendar, mais `history-v2-monthly-engines.ts` fournit actuellement `contexts: []`. Le nom de ces types ne remplace pas à lui seul la projection de contexte/participation datée à réaliser. Aucun rôle Place ou texte libre n'a été utilisé pour combler ce raccordement.

### Preuves de la reprise

- Tests M5 ciblés : **118/118 PASS** (84 précédents + hebdomadaire, adaptateurs, FDR commun, états temporels et closure).
- `tsc --noEmit` : PASS.
- Architecture : PASS, 503 fichiers.
- B/C et matérialité : code de leurs producteurs inchangé depuis les régressions PASS de la reprise précédente ; pas de nouvelle suite historique globale.
- Build final : PASS sur le dernier état code enregistré (compilation, TypeScript, génération statique 7/7, exit 0).
- `git diff --check` et vérification whitespace de tous les fichiers non suivis : PASS.

### Les six points ne sont pas encore tous fermés

| Point demandé | État réel |
|---|---|
| Catalogue D1 exhaustif | PARTIAL : sous-catalogue journalier et deux définitions hebdomadaires ; inventaire exhaustif/activation selon vrais providers restant |
| Canonical → Facts → M5 | PARTIAL : adaptateurs Facts exécutés sur fixtures ; projection Canonical des contextes et source financière quotidienne personnelle à raccorder |
| Dépendances/fenêtres/scopes | PARTIAL : déclaration parsée et hashes testés ; invocation P02 et scopes SHARED/HOUSEHOLD/participation end-to-end restants |
| Hebdomadaire/FDR | Tests inférentiels et FDR commun implémentés ; matérialité et robustesse hebdomadaires finales restant à raccorder |
| Temporalité/M3 | Helper de classification testé ; recomputation 6+6 et feed M3 non raccordés |
| D2/D3 exhaustifs | NON ACQUIS : 118 tests ciblés ne remplacent pas la matrice exhaustive Master |

Aucune demande d'arbitrage renouvelée. Aucun PASS global, aucune sortie productrice exposée, aucun commit. Les modifications restent locales pour continuer P06.

IMPLEMENTATION_GATE = PARTIAL

CONTRACT_GATE = PARTIAL

TEST_GATE = PARTIAL

GLOBAL_PHASE_D_CORE = PARTIAL

LIVE_WRITES = NONE

NEXT_PERMITTED_PROMPT = P06

## Clôture D1–D3 — reprise après indisponibilité du workspace

Cette section décrit l'état final de reprise et ne remplace pas la chronologie précédente. L'indisponibilité en écriture était environnementale. Les anciennes cardinalités 84/118/199/254 ne certifient pas les ajouts ultérieurs.

### Périmètre et sens de la certification

La certification porte sur le **core actuellement exigible**, avec les exclusions explicitement autorisées par la décision humaine P06 et PD-NO-03. Elle ne signifie pas que toutes les données ou tous les providers existent en production. Une fixture autoritaire valide un contrat; elle ne crée pas une autorité Canonical live.

- Source normative inchangée : Master SHA-256 `8b0d0ff2381599c4495645cd1dd1ebf2fa0d027fc3113be78aee945fae12f8be`.
- Index réutilisé : `GLOBAL_MASTER_INDEX.json`, propriétaire P06, **118 exigences et 125 tests conceptuels**. Aucune seconde copie normative.
- `ACTIVE` signifie définition exécutable sur ses intrants autoritaires et au support requis; cela ne signifie pas insight automatiquement sélectionné.
- `AUTHORITY_GATED` / `EXCLUDED_WITH_REASON` restent examinés dans le plan FDR. Aucun p-value fictif.
- `DEFERRED_P08_P10` : provider futur identifié; réactivation et certification par closure à son arrivée.
- `CONDITIONAL_INACTIVE` : pas de définition core actuellement autorisée à ce grain. Ce n'est pas une certification positive du futur moteur occurrence/visite/Moment.
- Aucune migration, Query, ReadModel, snapshot, UI, IA ou publication n'est créée. Le champ `publicationEligible=false` interdit toute lecture de ce lot comme autorisation de publication live. Le marqueur historique `PARTIAL_DAILY_CORE` du résultat brut décrit son périmètre et n'est pas le gate documentaire D_CORE.

### Catalogue D1 et disponibilité physique

`relationship-catalog.ts` et `relationship-weekly.ts` constituent le catalogue exécuté : **31 entrées examinées**, dont 10 définitions DAY, 2 WEEK et 19 exclusions/dépendances explicites. Les inverses et produits cartésiens ne sont pas générés.

| Famille | Définitions et grain | Provider / statut courant |
|---|---|---|
| A | onsite-restaurant, onsite-external-meal, remote-restaurant, leave-rest-leisure, weekend-social, weekend-restaurant — DAY | Restaurant : Canonical→Facts raccordé. ONSITE/REMOTE/LEAVE et mappings composites non prouvés : exclusion d'autorité. Les 6 définitions restent testées et présentes. |
| B | onsite-transport-activity, onsite-mobility-cost, remote-mobility-cost, leave-mobility, weekend-mobility — DAY | DEFERRED_P08_P10 : mobilité spécialisée P08. |
| C | onsite-external-meal-cost, remote-external-meal-cost, weekend-leisure-cost, leave-leisure-cost — DAY; onsite-transport-cost | 4 définitions monétaires exécutables sur une consommation économique personnelle quotidienne prouvée; provider actuel absent, pas de montant Household substitué. Transport : P08. |
| D | family-visit-mobility-cost, social-outing-mobility-cost, leisure-activity-mobility-cost — OCCURRENCE | P08; aucun comptage par jour. |
| E | activity-category-association — OCCURRENCE | AUTHORITY_GATED : aucune paire générale inventée. Coût causal conservé hors M5. |
| F | moment-type-outside-daily, moment-type-mobility, moment-type-restauration — MOMENT | P08; spentDuring n'est pas une cause. |
| G | family-place-visit-mobility, work-place-visit-external-meal — VISIT; specific-place-visit-localized-purchase | P08 pour visites, P10 pour Purchase localisé. |
| H | shared-activity-causal-cost, shared-outing-mobility, shared-weekend-outside-daily | Premier cas explicitement hors association; mobilité P08; partage financier sans participation/autorité quotidienne exclu. |
| I | weekly-onsite-transport, weekly-remote-restaurants — WEEK | Transport P08. Remote : moteur testé, provider contextuel absent; aucune reconstruction depuis un libellé. |

Le provider serveur de P06 est `resolveGlobalM5PersonAuthority`. Il lit les vrais Facts via `CanonicalRepository` et `FactSourceResolver`, sans source Minimal historique ni snapshot History. La preuve de fermeture est synthétique, sans requête live lors de cette clôture.

Sources réellement consommées : PersonDay, ActivityOccurrence avec participation explicite, analysis_periods fermés et vie complète, identité exacte `repas_restaurant`, calendrier civil Household et preuve de régime amont P04. Un mois vie incomplet ou une participation non résolue interdit de transformer l'absence d'événement en zéro connu. Une agrégation visuelle ne modifie pas LifeEventId. Le contexte professionnel reste absent; aucun nom de type ne devient ONSITE/REMOTE.

Finance B/C disponible : `resolveGlobalM1HouseholdAuthority` fournit des métriques mensuelles Household, et P01 fournit l'attribution de composantes. Ces seuls outputs ne prouvent pas la consommation personnelle quotidienne par catégorie exigée ici. Le type P05 `GlobalDayEconomicCost` reçoit une autorité en entrée; il n'est pas un provider Canonical autonome. L'absence de ce provider est donc conservée dans M5, sans distribuer les montants mensuels ni reprendre BankDate.

HOUSEHOLD/SHARED : aucun faux PersonId ni pooling de comportements individuels. Le provider PERSON refuse ces scopes; les définitions concernées restent inactives jusqu'aux preuves de Moment foyer/participation communes. Aucun résultat Household/SHARED positif n'est revendiqué dans P06.

### Implémentation et preuves nommées

Tous les fichiers Analytics cités ci-dessous sont sous `src/analytics/global-v2/`. La suite **R** est `scripts/check-global-v2-relationships.mjs`; **S** est `scripts/check-global-v2-relationship-authority.mjs`.

| Preuve | Fichiers / fonctions | Cas exécutables |
|---|---|---|
| CATALOG | relationship-catalog, relationship-evidence / closeRelationshipFdrUniverse | R : catalogue unique, toutes les exclusions conservées, définition manquante/extra refusée, provider P08 refusé, association uniquement, 10 définitions DAY exercées. |
| MATCH | relationship-comparators / matchRelationshipDays; relationship-fact-adapter | R : comparateurs humains, UNKNOWN, personne/régime étrangers, weekday, 56/63 jours, collision/no replacement, permutation, multijour unique, strates saisonnières prouvées. S : participation manquante, type travail_site non interprété, gaps. |
| DAILY | relationships / buildGlobalDailyRelationships | R : fixtures de chaque définition DAY, 14/15 paires, cinq paires, effet binaire/monétaire, couverture partielle, doublons, absence de preuve. S : Restaurant Canonical→Facts→M5. |
| STATS | relationship-statistics; materiality | R : McNemar exact, Fisher uniquement primitive non autorisante, permutation de signes avec statistique médiane, bootstrap apparié 95 %, ratios absents, seuils 10/20/15 %, effet minuscule non matériel. |
| WEEKLY | relationship-weekly / prepareWeeklyRelationship, buildWeeklyRelationshipRobustness | R : 15/16 semaines, semaines complètes et non chevauchantes, Spearman inférentiel après detrend, tendance commune supprimée, corpus/matérialité liés, LOMO et preuve mensuelle distincte du rho. |
| FDR | relationship-evidence / closeRelationshipFdrUniverse | R : BH commun day/week, 30 comparaisons, présélection incorrecte distinguée, exclusions sans faux p-value. |
| TEMPORAL | relationship-temporal, relationship-evidence, relationship-m3 | R : P02 réellement exécuté, 6+6 recalculés, mois UNKNOWN hors références, dénominateur courant préservé, inversion/disparition/bruit, mois dominant, cinq états, feed M3 autorisé et non causal. |
| ACCESS | relationship-access | R : rejet caché en automatique et visible explicitement, récent distinct d'historique, aucun vocabulaire causal ni p/q proposé à l'IA. Aucun générateur IA implémenté. |
| INSIGHT | relationship-insight / buildRelationshipInsights | R : projection analytique avec scope, grain, effet, p/q, support, coverage, méthodes, révision et preuves; sérialisation sans undefined. |
| PIPELINE | relationships, relationship-weekly, relationship-temporal | R : préparation hebdomadaire sans exécution LOMO; fermeture FDR commune puis robustesse et classification. |
| CLOSURE | relationship-dependencies; global-v2-relationship-authority serveur | R : dépendance consommée manquante refusée, changement de digest/méthode sensible, dépendance inutilisée stable. S : permutation stable, changement géographique/finance non consommé stable. |
| MATRIX | présente matrice + index existant | Chaque ID est rattaché à sa source et à une preuve; aucune cardinalité seule n'est utilisée comme assertion métier. |

Les seeds et méthodes statistiques sont versionnés; bootstrap apparié percentile type 7, 3999 tirages; permutations 19999 hors petits corpus exacts. Le bootstrap n'est pas présenté comme block-bootstrap. Une médiane de différences identiques peut donner une permutation non significative : pas de remplacement opportuniste du test pour obtenir une carte.

La preuve hebdomadaire de matérialité conserve un hash du corpus exact, y compris les retraits mensuels. Un effet mensuel du corpus complet n'est jamais recyclé dans une fenêtre 6 mois; les preuves de fenêtre doivent être fournies séparément. En leur absence la qualification reste non publiée.

M3 reçoit `M5_RELATIONSHIP_EVOLUTION` comme enrichissement distinct, versionné, sans transformer une association en ancre causale ni modifier CURRENT_REGIME. Le chemin retour M5→régime→M5 est exclu. M1 et les sorties Finance réutilisées ne sont pas recalculées depuis les insights M5.

### Matrice exhaustive des exigences D1–D3

Les statuts conditionnels ci-dessous sont des **capacités non actives**, pas des PASS fonctionnels du futur provider. Leur exclusion et leur maintien dans FDR sont prouvés conformément à l'autorisation humaine et PD-NO-03.

| Exigence | Source Master | Implémentation / preuve | Statut |
|---|---|---|---|
| GLO-M05-001 | P3603-P3604 | CATALOG — Catalogue fermé, ASSOCIATION_ONLY, causalité hors moteur, aucun croisement ou grain implicite | PASS_CORE |
| GLO-M05-002 | P3605-P3618 | CATALOG — Catalogue fermé, ASSOCIATION_ONLY, causalité hors moteur, aucun croisement ou grain implicite | PASS_CORE |
| GLO-M05-003 | P3620-P3628 | CATALOG — Catalogue fermé, ASSOCIATION_ONLY, causalité hors moteur, aucun croisement ou grain implicite | PASS_CORE |
| GLO-M05-004 | P3631-P3634 | CATALOG — Catalogue fermé, ASSOCIATION_ONLY, causalité hors moteur, aucun croisement ou grain implicite | PASS_CORE |
| GLO-M05-005 | P3636-P3642 | CATALOG — Catalogue fermé, ASSOCIATION_ONLY, causalité hors moteur, aucun croisement ou grain implicite | PASS_CORE |
| GLO-M05-006 | P3644-P3645 | CATALOG — Catalogue fermé, ASSOCIATION_ONLY, causalité hors moteur, aucun croisement ou grain implicite | PASS_CORE |
| GLO-M05-007 | P3646-P3656 | DAILY — Chaque définition DAY exécutée sur assertions synthétiques autoritaires; provider réel Restaurant raccordé; autres autorités absentes exclues | PASS_CORE_PROVIDER_GATED |
| GLO-M05-008 | P3658-P3664 | CATALOG — Plan FDR : exclusion explicite avant provider Moment/Visit/Mobility/Purchase; aucun p-value ni grain de secours | DEFERRED_P08_P10 |
| GLO-M05-009 | P3666-P3675 | DAILY — Chaque définition DAY exécutée sur assertions synthétiques autoritaires; provider réel Restaurant raccordé; autres autorités absentes exclues | PASS_CORE_PROVIDER_GATED |
| GLO-M05-010 | P3677-P3683 | CATALOG — Plan FDR : exclusion explicite avant provider Moment/Visit/Mobility/Purchase; aucun p-value ni grain de secours | DEFERRED_P08_P10 |
| GLO-M05-011 | P3685-P3686 | CATALOG — Paire activité/catégorie ou participation partagée non autorisée : définition examinée, aucune association fabriquée | AUTHORITY_GATED |
| GLO-M05-012 | P3687-P3690 | CATALOG — Catalogue fermé, ASSOCIATION_ONLY, causalité hors moteur, aucun croisement ou grain implicite | PASS_CORE |
| GLO-M05-013 | P3691-P3695 | CATALOG — Paire activité/catégorie ou participation partagée non autorisée : définition examinée, aucune association fabriquée | AUTHORITY_GATED |
| GLO-M05-014 | P3697-P3698 | CATALOG — Plan FDR : exclusion explicite avant provider Moment/Visit/Mobility/Purchase; aucun p-value ni grain de secours | DEFERRED_P08_P10 |
| GLO-M05-015 | P3699-P3700 | CATALOG — Catalogue fermé, ASSOCIATION_ONLY, causalité hors moteur, aucun croisement ou grain implicite | PASS_CORE |
| GLO-M05-016 | P3701-P3706 | CATALOG — Plan FDR : exclusion explicite avant provider Moment/Visit/Mobility/Purchase; aucun p-value ni grain de secours | DEFERRED_P08_P10 |
| GLO-M05-017 | P3708-P3714 | CATALOG — Plan FDR : exclusion explicite avant provider Moment/Visit/Mobility/Purchase; aucun p-value ni grain de secours | DEFERRED_P08_P10 |
| GLO-M05-018 | P3716-P3721 | CATALOG — Paire activité/catégorie ou participation partagée non autorisée : définition examinée, aucune association fabriquée | AUTHORITY_GATED |
| GLO-M05-019 | P3723-P3729 | WEEKLY — 16 semaines complètes, Spearman détrendé, FDR commun, matérialité mensuelle distincte liée au corpus, LOMO; Remote non inféré | PASS_CORE_PROVIDER_GATED |
| GLO-M05-020 | P3731-P3734 | CATALOG — Catalogue fermé, ASSOCIATION_ONLY, causalité hors moteur, aucun croisement ou grain implicite | PASS_CORE |
| GLO-M05-021 | P3737-P3739 | CATALOG — Catalogue fermé, ASSOCIATION_ONLY, causalité hors moteur, aucun croisement ou grain implicite | PASS_CORE |
| GLO-M05-022 | P3741-P3751 | DAILY — Chaque définition DAY exécutée sur assertions synthétiques autoritaires; provider réel Restaurant raccordé; autres autorités absentes exclues | PASS_CORE_PROVIDER_GATED |
| GLO-M05-023 | P3753-P3762 | CATALOG — Grain occurrence/visite ou résultat quantitatif apparié non activé par une définition core; aucun basculement journalier | CONDITIONAL_INACTIVE |
| GLO-M05-024 | P3764-P3768 | CATALOG — Plan FDR : exclusion explicite avant provider Moment/Visit/Mobility/Purchase; aucun p-value ni grain de secours | DEFERRED_P08_P10 |
| GLO-M05-025 | P3770-P3778 | CATALOG — Plan FDR : exclusion explicite avant provider Moment/Visit/Mobility/Purchase; aucun p-value ni grain de secours | DEFERRED_P08_P10 |
| GLO-M05-026 | P3780-P3784 | WEEKLY — 16 semaines complètes, Spearman détrendé, FDR commun, matérialité mensuelle distincte liée au corpus, LOMO; Remote non inféré | PASS_CORE_PROVIDER_GATED |
| GLO-M05-027 | P3786-P3794 | CATALOG — Catalogue fermé, ASSOCIATION_ONLY, causalité hors moteur, aucun croisement ou grain implicite | PASS_CORE |
| GLO-M05-028 | P3796-P3797 | MATCH — Personne/régime, comparateurs humains, weekday, 56 jours, appariement sans remplacement, support après matching, exclusions et saison autoritaire | PASS_CORE |
| GLO-M05-029 | P3798-P3804 | MATCH — Personne/régime, comparateurs humains, weekday, 56 jours, appariement sans remplacement, support après matching, exclusions et saison autoritaire | PASS_CORE |
| GLO-M05-030 | P3806-P3814 | MATCH — Personne/régime, comparateurs humains, weekday, 56 jours, appariement sans remplacement, support après matching, exclusions et saison autoritaire | PASS_CORE |
| GLO-M05-031 | P3816-P3825 | MATCH — Personne/régime, comparateurs humains, weekday, 56 jours, appariement sans remplacement, support après matching, exclusions et saison autoritaire | PASS_CORE |
| GLO-M05-032 | P3827-P3832 | MATCH — Personne/régime, comparateurs humains, weekday, 56 jours, appariement sans remplacement, support après matching, exclusions et saison autoritaire | PASS_CORE |
| GLO-M05-033 | P3834-P3842 | MATCH — Personne/régime, comparateurs humains, weekday, 56 jours, appariement sans remplacement, support après matching, exclusions et saison autoritaire | PASS_CORE |
| GLO-M05-034 | P3844-P3848 | MATCH — Personne/régime, comparateurs humains, weekday, 56 jours, appariement sans remplacement, support après matching, exclusions et saison autoritaire | PASS_CORE |
| GLO-M05-035 | P3850-P3852 | MATCH — Personne/régime, comparateurs humains, weekday, 56 jours, appariement sans remplacement, support après matching, exclusions et saison autoritaire | PASS_CORE |
| GLO-M05-036 | P3854-P3862 | MATCH — Personne/régime, comparateurs humains, weekday, 56 jours, appariement sans remplacement, support après matching, exclusions et saison autoritaire | PASS_CORE |
| GLO-M05-037 | P3864-P3865 | MATCH — Personne/régime, comparateurs humains, weekday, 56 jours, appariement sans remplacement, support après matching, exclusions et saison autoritaire | PASS_CORE |
| GLO-M05-038 | P3866-P3867 | MATCH — Personne/régime, comparateurs humains, weekday, 56 jours, appariement sans remplacement, support après matching, exclusions et saison autoritaire | PASS_CORE |
| GLO-M05-039 | P3868-P3869 | CATALOG — Grain occurrence/visite ou résultat quantitatif apparié non activé par une définition core; aucun basculement journalier | CONDITIONAL_INACTIVE |
| GLO-M05-040 | P3870-P3871 | CATALOG — Plan FDR : exclusion explicite avant provider Moment/Visit/Mobility/Purchase; aucun p-value ni grain de secours | DEFERRED_P08_P10 |
| GLO-M05-041 | P3872-P3874 | WEEKLY — 16 semaines complètes, Spearman détrendé, FDR commun, matérialité mensuelle distincte liée au corpus, LOMO; Remote non inféré | PASS_CORE_PROVIDER_GATED |
| GLO-M05-042 | P3876-P3884 | MATCH — Personne/régime, comparateurs humains, weekday, 56 jours, appariement sans remplacement, support après matching, exclusions et saison autoritaire | PASS_CORE |
| GLO-M05-043 | P3886-P3889 | MATCH — Personne/régime, comparateurs humains, weekday, 56 jours, appariement sans remplacement, support après matching, exclusions et saison autoritaire | PASS_CORE |
| GLO-M05-044 | P3891-P3892 | STATS — McNemar exact, Fisher isolé, permutation/IC appariés, absence de ratio à zéro, matérialité indépendante du support | PASS_CORE |
| GLO-M05-045 | P3893-P3899 | STATS — McNemar exact, Fisher isolé, permutation/IC appariés, absence de ratio à zéro, matérialité indépendante du support | PASS_CORE |
| GLO-M05-046 | P3901-P3906 | STATS — McNemar exact, Fisher isolé, permutation/IC appariés, absence de ratio à zéro, matérialité indépendante du support | PASS_CORE |
| GLO-M05-047 | P3908-P3915 | STATS — McNemar exact, Fisher isolé, permutation/IC appariés, absence de ratio à zéro, matérialité indépendante du support | PASS_CORE |
| GLO-M05-048 | P3917-P3925 | STATS — McNemar exact, Fisher isolé, permutation/IC appariés, absence de ratio à zéro, matérialité indépendante du support | PASS_CORE |
| GLO-M05-049 | P3927-P3929 | STATS — McNemar exact, Fisher isolé, permutation/IC appariés, absence de ratio à zéro, matérialité indépendante du support | PASS_CORE |
| GLO-M05-050 | P3931-P3937 | STATS — McNemar exact, Fisher isolé, permutation/IC appariés, absence de ratio à zéro, matérialité indépendante du support | PASS_CORE |
| GLO-M05-051 | P3939-P3945 | CATALOG — Grain occurrence/visite ou résultat quantitatif apparié non activé par une définition core; aucun basculement journalier | CONDITIONAL_INACTIVE |
| GLO-M05-052 | P3947-P3956 | WEEKLY — 16 semaines complètes, Spearman détrendé, FDR commun, matérialité mensuelle distincte liée au corpus, LOMO; Remote non inféré | PASS_CORE_PROVIDER_GATED |
| GLO-M05-053 | P3958-P3967 | WEEKLY — 16 semaines complètes, Spearman détrendé, FDR commun, matérialité mensuelle distincte liée au corpus, LOMO; Remote non inféré | PASS_CORE_PROVIDER_GATED |
| GLO-M05-054 | P3969-P3972 | WEEKLY — 16 semaines complètes, Spearman détrendé, FDR commun, matérialité mensuelle distincte liée au corpus, LOMO; Remote non inféré | PASS_CORE_PROVIDER_GATED |
| GLO-M05-055 | P3975-P3981 | STATS — McNemar exact, Fisher isolé, permutation/IC appariés, absence de ratio à zéro, matérialité indépendante du support | PASS_CORE |
| GLO-M05-056 | P3983-P3992 | STATS — McNemar exact, Fisher isolé, permutation/IC appariés, absence de ratio à zéro, matérialité indépendante du support | PASS_CORE |
| GLO-M05-057 | P3994-P3996 | STATS — McNemar exact, Fisher isolé, permutation/IC appariés, absence de ratio à zéro, matérialité indépendante du support | PASS_CORE |
| GLO-M05-058 | P3997-P4000 | STATS — McNemar exact, Fisher isolé, permutation/IC appariés, absence de ratio à zéro, matérialité indépendante du support | PASS_CORE |
| GLO-M05-059 | P4002-P4005 | WEEKLY — 16 semaines complètes, Spearman détrendé, FDR commun, matérialité mensuelle distincte liée au corpus, LOMO; Remote non inféré | PASS_CORE_PROVIDER_GATED |
| GLO-M05-060 | P4007-P4008 | FDR — BH sur tous les tests éligibles, preuve des définitions exclues, frontière 0,05/0,10 et accès non automatique | PASS_CORE |
| GLO-M05-061 | P4014-P4018 | FDR — BH sur tous les tests éligibles, preuve des définitions exclues, frontière 0,05/0,10 et accès non automatique | PASS_CORE |
| GLO-M05-062 | P4020-P4029 | FDR — BH sur tous les tests éligibles, preuve des définitions exclues, frontière 0,05/0,10 et accès non automatique | PASS_CORE |
| GLO-M05-063 | P4031-P4040 | FDR — BH sur tous les tests éligibles, preuve des définitions exclues, frontière 0,05/0,10 et accès non automatique | PASS_CORE |
| GLO-M05-064 | P4042-P4044 | FDR — BH sur tous les tests éligibles, preuve des définitions exclues, frontière 0,05/0,10 et accès non automatique | PASS_CORE |
| GLO-M05-065 | P4046-P4055 | FDR — BH sur tous les tests éligibles, preuve des définitions exclues, frontière 0,05/0,10 et accès non automatique | PASS_CORE |
| GLO-M05-066 | P4057-P4063 | FDR — BH sur tous les tests éligibles, preuve des définitions exclues, frontière 0,05/0,10 et accès non automatique | PASS_CORE |
| GLO-M05-067 | P4065-P4067 | TEMPORAL — Recalcul réel CURRENT/recent6/précédent6, LOMO, mois dominant, inversion/disparition/bruit, feed M3 séparé non causal | PASS_CORE |
| GLO-M05-068 | P4068-P4074 | TEMPORAL — Recalcul réel CURRENT/recent6/précédent6, LOMO, mois dominant, inversion/disparition/bruit, feed M3 séparé non causal | PASS_CORE |
| GLO-M05-069 | P4076-P4081 | TEMPORAL — Recalcul réel CURRENT/recent6/précédent6, LOMO, mois dominant, inversion/disparition/bruit, feed M3 séparé non causal | PASS_CORE |
| GLO-M05-070 | P4083-P4090 | TEMPORAL — Recalcul réel CURRENT/recent6/précédent6, LOMO, mois dominant, inversion/disparition/bruit, feed M3 séparé non causal | PASS_CORE |
| GLO-M05-071 | P4092-P4093 | TEMPORAL — Recalcul réel CURRENT/recent6/précédent6, LOMO, mois dominant, inversion/disparition/bruit, feed M3 séparé non causal | PASS_CORE |
| GLO-M05-072 | P4094-P4095 | TEMPORAL — Recalcul réel CURRENT/recent6/précédent6, LOMO, mois dominant, inversion/disparition/bruit, feed M3 séparé non causal | PASS_CORE |
| GLO-M05-073 | P4096-P4098 | TEMPORAL — Recalcul réel CURRENT/recent6/précédent6, LOMO, mois dominant, inversion/disparition/bruit, feed M3 séparé non causal | PASS_CORE |
| GLO-M05-074 | P4100-P4102 | TEMPORAL — Recalcul réel CURRENT/recent6/précédent6, LOMO, mois dominant, inversion/disparition/bruit, feed M3 séparé non causal | PASS_CORE |
| GLO-M05-075 | P4104-P4110 | TEMPORAL — Recalcul réel CURRENT/recent6/précédent6, LOMO, mois dominant, inversion/disparition/bruit, feed M3 séparé non causal | PASS_CORE |
| GLO-M05-076 | P4112-P4117 | TEMPORAL — Recalcul réel CURRENT/recent6/précédent6, LOMO, mois dominant, inversion/disparition/bruit, feed M3 séparé non causal | PASS_CORE |
| GLO-M05-077 | P4119-P4123 | TEMPORAL — Recalcul réel CURRENT/recent6/précédent6, LOMO, mois dominant, inversion/disparition/bruit, feed M3 séparé non causal | PASS_CORE |
| GLO-M05-078 | P4125-P4137 | TEMPORAL — Recalcul réel CURRENT/recent6/précédent6, LOMO, mois dominant, inversion/disparition/bruit, feed M3 séparé non causal | PASS_CORE |
| GLO-M05-079 | P4139-P4145 | TEMPORAL — Recalcul réel CURRENT/recent6/précédent6, LOMO, mois dominant, inversion/disparition/bruit, feed M3 séparé non causal | PASS_CORE |
| GLO-M05-080 | P4148-P4152 | MATCH — Personne/régime, comparateurs humains, weekday, 56 jours, appariement sans remplacement, support après matching, exclusions et saison autoritaire | PASS_CORE |
| GLO-M05-081 | P4154-P4155 | MATCH — Personne/régime, comparateurs humains, weekday, 56 jours, appariement sans remplacement, support après matching, exclusions et saison autoritaire | PASS_CORE |
| GLO-M05-082 | P4157-P4158 | MATCH — Personne/régime, comparateurs humains, weekday, 56 jours, appariement sans remplacement, support après matching, exclusions et saison autoritaire | PASS_CORE |
| GLO-M05-083 | P4160-P4162 | MATCH — Personne/régime, comparateurs humains, weekday, 56 jours, appariement sans remplacement, support après matching, exclusions et saison autoritaire | PASS_CORE |
| GLO-M05-084 | P4164-P4165 | MATCH — Personne/régime, comparateurs humains, weekday, 56 jours, appariement sans remplacement, support après matching, exclusions et saison autoritaire | PASS_CORE |
| GLO-M05-085 | P4167-P4168 | MATCH — Personne/régime, comparateurs humains, weekday, 56 jours, appariement sans remplacement, support après matching, exclusions et saison autoritaire | PASS_CORE |
| GLO-M05-086 | P4170-P4179 | ACCESS — Clés de langage associatif, aucune causalité; accès automatique qualifié, exploration et éligibilité IA séparées | PASS_CORE |
| GLO-M05-087 | P4181-P4192 | CATALOG — Catalogue fermé, ASSOCIATION_ONLY, causalité hors moteur, aucun croisement ou grain implicite | PASS_CORE |
| GLO-M05-088 | P4194-P4205 | CATALOG — Catalogue fermé, ASSOCIATION_ONLY, causalité hors moteur, aucun croisement ou grain implicite | PASS_CORE |
| GLO-M05-089 | P4208-P4212 | MATCH — Personne/régime, comparateurs humains, weekday, 56 jours, appariement sans remplacement, support après matching, exclusions et saison autoritaire | PASS_CORE |
| GLO-M05-090 | P4214-P4219 | CATALOG — Plan FDR : exclusion explicite avant provider Moment/Visit/Mobility/Purchase; aucun p-value ni grain de secours | DEFERRED_P08_P10 |
| GLO-M05-091 | P4221-P4225 | CATALOG — Paire activité/catégorie ou participation partagée non autorisée : définition examinée, aucune association fabriquée | AUTHORITY_GATED |
| GLO-M05-092 | P4228-P4233 | ACCESS — Clés de langage associatif, aucune causalité; accès automatique qualifié, exploration et éligibilité IA séparées | PASS_CORE |
| GLO-M05-093 | P4235-P4237 | ACCESS — Clés de langage associatif, aucune causalité; accès automatique qualifié, exploration et éligibilité IA séparées | PASS_CORE |
| GLO-M05-094 | P4239-P4242 | ACCESS — Clés de langage associatif, aucune causalité; accès automatique qualifié, exploration et éligibilité IA séparées | PASS_CORE |
| GLO-M05-095 | P4244-P4247 | ACCESS — Clés de langage associatif, aucune causalité; accès automatique qualifié, exploration et éligibilité IA séparées | PASS_CORE |
| GLO-M05-096 | P4253-P4256 | ACCESS — Clés de langage associatif, aucune causalité; accès automatique qualifié, exploration et éligibilité IA séparées | PASS_CORE |
| GLO-M05-097 | P4258-P4264 | ACCESS — Clés de langage associatif, aucune causalité; accès automatique qualifié, exploration et éligibilité IA séparées | PASS_CORE |
| GLO-M05-098 | P4266-P4280 | ACCESS — Clés de langage associatif, aucune causalité; accès automatique qualifié, exploration et éligibilité IA séparées | PASS_CORE |
| GLO-M05-099 | P4282-P4286 | INSIGHT — RelationshipInsight Analytics au grain DAY/WEEK, effet/p/q/support/coverage/stabilité/provenance/méthodes; aucune Query | PASS_CORE |
| GLO-M05-100 | P4288-P4294 | PIPELINE — Matérialité puis BH commun puis LOMO puis classification; préparation hebdomadaire différée | PASS_CORE |
| GLO-M05-101 | P4296-P4320 | DAILY — Fixture ONSITE/REMOTE appariée : effet, p/q, support et robustesse; intégration Canonical Restaurant distincte | PASS_CORE |
| GLO-M05-102 | P4322-P4334 | MATCH — Personne/régime, comparateurs humains, weekday, 56 jours, appariement sans remplacement, support après matching, exclusions et saison autoritaire | PASS_CORE |
| GLO-M05-103 | P4336-P4347 | TEMPORAL — Recalcul réel CURRENT/recent6/précédent6, LOMO, mois dominant, inversion/disparition/bruit, feed M3 séparé non causal | PASS_CORE |
| GLO-M05-104 | P4349-P4359 | CLOSURE — Digests consommés, permutation stable, variation significative sensible, versions et absence d’oracle | PASS_CORE |
| GLO-M05-105 | P4361-P4362 | MATRIX — Matrice de 118 exigences et 125 tests, cas exécutés et conditionnels explicitement distingués | PASS_CORE |
| GLO-M05-106 | P4363-P4365 | MATCH — Personne/régime, comparateurs humains, weekday, 56 jours, appariement sans remplacement, support après matching, exclusions et saison autoritaire | PASS_CORE |
| GLO-M05-107 | P4366-P4368 | WEEKLY — 16 semaines complètes, Spearman détrendé, FDR commun, matérialité mensuelle distincte liée au corpus, LOMO; Remote non inféré | PASS_CORE_PROVIDER_GATED |
| GLO-M05-108 | P4369-P4370 | TEMPORAL — Recalcul réel CURRENT/recent6/précédent6, LOMO, mois dominant, inversion/disparition/bruit, feed M3 séparé non causal | PASS_CORE |
| GLO-M05-109 | P4371-P4372 | STATS — McNemar exact, Fisher isolé, permutation/IC appariés, absence de ratio à zéro, matérialité indépendante du support | PASS_CORE |
| GLO-M05-110 | P4373-P4374 | STATS — McNemar exact, Fisher isolé, permutation/IC appariés, absence de ratio à zéro, matérialité indépendante du support | PASS_CORE |
| GLO-M05-111 | P4375-P4376 | FDR — BH sur tous les tests éligibles, preuve des définitions exclues, frontière 0,05/0,10 et accès non automatique | PASS_CORE |
| GLO-M05-112 | P4377-P4378 | TEMPORAL — Recalcul réel CURRENT/recent6/précédent6, LOMO, mois dominant, inversion/disparition/bruit, feed M3 séparé non causal | PASS_CORE |
| GLO-M05-113 | P4379-P4380 | CATALOG — Catalogue fermé, ASSOCIATION_ONLY, causalité hors moteur, aucun croisement ou grain implicite | PASS_CORE |
| GLO-M05-114 | P4381-P4383 | CATALOG — Catalogue fermé, ASSOCIATION_ONLY, causalité hors moteur, aucun croisement ou grain implicite | PASS_CORE |
| GLO-PUB-044 | P10395-P10399 | ACCESS — relationshipAccessPolicy : comparaison rejetée conservée en exploration explicite, masquée en automatique | PASS_CORE |
| GLO-PUB-045 | P10400-P10401 | ACCESS — relationshipAccessPolicy : comparaison rejetée conservée en exploration explicite, masquée en automatique | PASS_CORE |
| GLO-PUB-046 | P10402-P10404 | ACCESS — relationshipAccessPolicy : comparaison rejetée conservée en exploration explicite, masquée en automatique | PASS_CORE |
| GLO-PUB-047 | P10405-P10412 | ACCESS — relationshipAccessPolicy : comparaison rejetée conservée en exploration explicite, masquée en automatique | PASS_CORE |

### Matrice exhaustive des tests conceptuels

Chaque ligne réutilise le lien normatif de l'index; les preuves nommées ci-dessus indiquent les assertions exécutées. Pour les providers non disponibles, seul le chemin d'exclusion est certifié ici; le test positif reste à son lot propriétaire.

| Test Master | Exigences | Famille de test | Preuve | Statut / portée |
|---|---|---|---|---|
| TEST-GLO-M05-0001 | GLO-M05-001 | happy path | CATALOG | PASS_CORE |
| TEST-GLO-M05-0002 | GLO-M05-002 | happy path | CATALOG | PASS_CORE |
| TEST-GLO-M05-0003 | GLO-M05-003 | invalid causal inference | CATALOG | PASS_CORE |
| TEST-GLO-M05-0004 | GLO-M05-004 | invalid causal inference | CATALOG | PASS_CORE |
| TEST-GLO-M05-0005 | GLO-M05-005 | partial coverage | CATALOG | PASS_CORE |
| TEST-GLO-M05-0006 | GLO-M05-006 | happy path | CATALOG | PASS_CORE |
| TEST-GLO-M05-0007 | GLO-M05-007 | boundary thresholds | DAILY | PASS_CORE_PROVIDER_GATED |
| TEST-GLO-M05-0008 | GLO-M05-008 | happy path | CATALOG | DEFERRED_P08_P10 |
| TEST-GLO-M05-0009 | GLO-M05-009 | happy path | DAILY | PASS_CORE_PROVIDER_GATED |
| TEST-GLO-M05-0010 | GLO-M05-010 | boundary thresholds | CATALOG | DEFERRED_P08_P10 |
| TEST-GLO-M05-0011 | GLO-M05-011 | happy path | CATALOG | AUTHORITY_GATED |
| TEST-GLO-M05-0012 | GLO-M05-012 | happy path | CATALOG | PASS_CORE |
| TEST-GLO-M05-0013 | GLO-M05-013 | happy path | CATALOG | AUTHORITY_GATED |
| TEST-GLO-M05-0014 | GLO-M05-014 | happy path | CATALOG | DEFERRED_P08_P10 |
| TEST-GLO-M05-0015 | GLO-M05-015 | happy path | CATALOG | PASS_CORE |
| TEST-GLO-M05-0016 | GLO-M05-016 | invalid causal inference | CATALOG | DEFERRED_P08_P10 |
| TEST-GLO-M05-0017 | GLO-M05-017 | invalid geographic inference | CATALOG | DEFERRED_P08_P10 |
| TEST-GLO-M05-0018 | GLO-M05-018 | invalid causal inference | CATALOG | AUTHORITY_GATED |
| TEST-GLO-M05-0019 | GLO-M05-019 | happy path | WEEKLY | PASS_CORE_PROVIDER_GATED |
| TEST-GLO-M05-0020 | GLO-M05-020 | version/revision | CATALOG | PASS_CORE |
| TEST-GLO-M05-0021 | GLO-M05-021 | boundary thresholds | CATALOG | PASS_CORE |
| TEST-GLO-M05-0022 | GLO-M05-022 | temporal anti-lookahead | DAILY | PASS_CORE_PROVIDER_GATED |
| TEST-GLO-M05-0023 | GLO-M05-023 | boundary thresholds | CATALOG | CONDITIONAL_INACTIVE |
| TEST-GLO-M05-0024 | GLO-M05-024 | invalid geographic inference | CATALOG | DEFERRED_P08_P10 |
| TEST-GLO-M05-0025 | GLO-M05-025 | happy path | CATALOG | DEFERRED_P08_P10 |
| TEST-GLO-M05-0026 | GLO-M05-026 | boundary thresholds | WEEKLY | PASS_CORE_PROVIDER_GATED |
| TEST-GLO-M05-0027 | GLO-M05-027 | version/revision | CATALOG | PASS_CORE |
| TEST-GLO-M05-0028 | GLO-M05-027 | boundary thresholds | CATALOG | PASS_CORE |
| TEST-GLO-M05-0029 | GLO-M05-028 | happy path | MATCH | PASS_CORE |
| TEST-GLO-M05-0030 | GLO-M05-029 | version/revision | MATCH | PASS_CORE |
| TEST-GLO-M05-0031 | GLO-M05-030 | happy path | MATCH | PASS_CORE |
| TEST-GLO-M05-0032 | GLO-M05-031 | happy path | MATCH | PASS_CORE |
| TEST-GLO-M05-0033 | GLO-M05-032 | happy path | MATCH | PASS_CORE |
| TEST-GLO-M05-0034 | GLO-M05-033 | happy path | MATCH | PASS_CORE |
| TEST-GLO-M05-0035 | GLO-M05-034 | happy path | MATCH | PASS_CORE |
| TEST-GLO-M05-0036 | GLO-M05-035 | happy path | MATCH | PASS_CORE |
| TEST-GLO-M05-0037 | GLO-M05-036 | boundary thresholds | MATCH | PASS_CORE |
| TEST-GLO-M05-0038 | GLO-M05-037 | happy path | MATCH | PASS_CORE |
| TEST-GLO-M05-0039 | GLO-M05-038 | happy path | MATCH | PASS_CORE |
| TEST-GLO-M05-0040 | GLO-M05-039 | happy path | CATALOG | CONDITIONAL_INACTIVE |
| TEST-GLO-M05-0041 | GLO-M05-040 | happy path | CATALOG | DEFERRED_P08_P10 |
| TEST-GLO-M05-0042 | GLO-M05-041 | boundary thresholds | WEEKLY | PASS_CORE_PROVIDER_GATED |
| TEST-GLO-M05-0043 | GLO-M05-042 | happy path | MATCH | PASS_CORE |
| TEST-GLO-M05-0044 | GLO-M05-043 | boundary thresholds | MATCH | PASS_CORE |
| TEST-GLO-M05-0045 | GLO-M05-044 | temporal anti-lookahead | STATS | PASS_CORE |
| TEST-GLO-M05-0046 | GLO-M05-045 | happy path | STATS | PASS_CORE |
| TEST-GLO-M05-0047 | GLO-M05-046 | happy path | STATS | PASS_CORE |
| TEST-GLO-M05-0048 | GLO-M05-047 | happy path | STATS | PASS_CORE |
| TEST-GLO-M05-0049 | GLO-M05-048 | happy path | STATS | PASS_CORE |
| TEST-GLO-M05-0050 | GLO-M05-049 | version/revision | STATS | PASS_CORE |
| TEST-GLO-M05-0051 | GLO-M05-050 | happy path | STATS | PASS_CORE |
| TEST-GLO-M05-0052 | GLO-M05-051 | happy path | CATALOG | CONDITIONAL_INACTIVE |
| TEST-GLO-M05-0053 | GLO-M05-052 | boundary thresholds | WEEKLY | PASS_CORE_PROVIDER_GATED |
| TEST-GLO-M05-0054 | GLO-M05-053 | happy path | WEEKLY | PASS_CORE_PROVIDER_GATED |
| TEST-GLO-M05-0055 | GLO-M05-054 | happy path | WEEKLY | PASS_CORE_PROVIDER_GATED |
| TEST-GLO-M05-0056 | GLO-M05-055 | temporal anti-lookahead | STATS | PASS_CORE |
| TEST-GLO-M05-0057 | GLO-M05-056 | happy path | STATS | PASS_CORE |
| TEST-GLO-M05-0058 | GLO-M05-057 | happy path | STATS | PASS_CORE |
| TEST-GLO-M05-0059 | GLO-M05-058 | version/revision | STATS | PASS_CORE |
| TEST-GLO-M05-0060 | GLO-M05-059 | insufficient support | WEEKLY | PASS_CORE_PROVIDER_GATED |
| TEST-GLO-M05-0061 | GLO-M05-060 | happy path | FDR | PASS_CORE |
| TEST-GLO-M05-0062 | GLO-M05-061 | happy path | FDR | PASS_CORE |
| TEST-GLO-M05-0063 | GLO-M05-062 | partial coverage | FDR | PASS_CORE |
| TEST-GLO-M05-0064 | GLO-M05-063 | happy path | FDR | PASS_CORE |
| TEST-GLO-M05-0065 | GLO-M05-064 | happy path | FDR | PASS_CORE |
| TEST-GLO-M05-0066 | GLO-M05-065 | temporal anti-lookahead | FDR | PASS_CORE |
| TEST-GLO-M05-0067 | GLO-M05-066 | happy path | FDR | PASS_CORE |
| TEST-GLO-M05-0068 | GLO-M05-067 | version/revision | TEMPORAL | PASS_CORE |
| TEST-GLO-M05-0069 | GLO-M05-068 | boundary thresholds | TEMPORAL | PASS_CORE |
| TEST-GLO-M05-0070 | GLO-M05-069 | insufficient support | TEMPORAL | PASS_CORE |
| TEST-GLO-M05-0071 | GLO-M05-070 | version/revision | TEMPORAL | PASS_CORE |
| TEST-GLO-M05-0072 | GLO-M05-071 | boundary thresholds | TEMPORAL | PASS_CORE |
| TEST-GLO-M05-0073 | GLO-M05-072 | boundary thresholds | TEMPORAL | PASS_CORE |
| TEST-GLO-M05-0074 | GLO-M05-073 | boundary thresholds | TEMPORAL | PASS_CORE |
| TEST-GLO-M05-0075 | GLO-M05-074 | insufficient support | TEMPORAL | PASS_CORE |
| TEST-GLO-M05-0076 | GLO-M05-074 | temporal anti-lookahead | TEMPORAL | PASS_CORE |
| TEST-GLO-M05-0077 | GLO-M05-075 | boundary thresholds | TEMPORAL | PASS_CORE |
| TEST-GLO-M05-0078 | GLO-M05-076 | happy path | TEMPORAL | PASS_CORE |
| TEST-GLO-M05-0079 | GLO-M05-077 | temporal anti-lookahead | TEMPORAL | PASS_CORE |
| TEST-GLO-M05-0080 | GLO-M05-078 | temporal anti-lookahead | TEMPORAL | PASS_CORE |
| TEST-GLO-M05-0081 | GLO-M05-079 | insufficient support | TEMPORAL | PASS_CORE |
| TEST-GLO-M05-0082 | GLO-M05-079 | temporal anti-lookahead | TEMPORAL | PASS_CORE |
| TEST-GLO-M05-0083 | GLO-M05-080 | partial coverage | MATCH | PASS_CORE |
| TEST-GLO-M05-0084 | GLO-M05-080 | temporal anti-lookahead | MATCH | PASS_CORE |
| TEST-GLO-M05-0085 | GLO-M05-081 | happy path | MATCH | PASS_CORE |
| TEST-GLO-M05-0086 | GLO-M05-082 | happy path | MATCH | PASS_CORE |
| TEST-GLO-M05-0087 | GLO-M05-083 | happy path | MATCH | PASS_CORE |
| TEST-GLO-M05-0088 | GLO-M05-084 | happy path | MATCH | PASS_CORE |
| TEST-GLO-M05-0089 | GLO-M05-085 | happy path | MATCH | PASS_CORE |
| TEST-GLO-M05-0090 | GLO-M05-086 | happy path | ACCESS | PASS_CORE |
| TEST-GLO-M05-0091 | GLO-M05-087 | invalid causal inference | CATALOG | PASS_CORE |
| TEST-GLO-M05-0092 | GLO-M05-088 | version/revision | CATALOG | PASS_CORE |
| TEST-GLO-M05-0093 | GLO-M05-088 | boundary thresholds | CATALOG | PASS_CORE |
| TEST-GLO-M05-0094 | GLO-M05-089 | happy path | MATCH | PASS_CORE |
| TEST-GLO-M05-0095 | GLO-M05-090 | happy path | CATALOG | DEFERRED_P08_P10 |
| TEST-GLO-M05-0096 | GLO-M05-091 | happy path | CATALOG | AUTHORITY_GATED |
| TEST-GLO-M05-0097 | GLO-M05-092 | boundary thresholds | ACCESS | PASS_CORE |
| TEST-GLO-M05-0098 | GLO-M05-093 | happy path | ACCESS | PASS_CORE |
| TEST-GLO-M05-0099 | GLO-M05-094 | boundary thresholds | ACCESS | PASS_CORE |
| TEST-GLO-M05-0100 | GLO-M05-095 | invalid causal inference | ACCESS | PASS_CORE |
| TEST-GLO-M05-0101 | GLO-M05-096 | happy path | ACCESS | PASS_CORE |
| TEST-GLO-M05-0102 | GLO-M05-097 | happy path | ACCESS | PASS_CORE |
| TEST-GLO-M05-0103 | GLO-M05-098 | invalid causal inference | ACCESS | PASS_CORE |
| TEST-GLO-M05-0104 | GLO-M05-099 | IA/export/import | INSIGHT | PASS_CORE |
| TEST-GLO-M05-0105 | GLO-M05-100 | publication | PIPELINE | PASS_CORE |
| TEST-GLO-M05-0106 | GLO-M05-101 | publication | DAILY | PASS_CORE |
| TEST-GLO-M05-0107 | GLO-M05-101 | temporal anti-lookahead | DAILY | PASS_CORE |
| TEST-GLO-M05-0108 | GLO-M05-102 | happy path | MATCH | PASS_CORE |
| TEST-GLO-M05-0109 | GLO-M05-103 | temporal anti-lookahead | TEMPORAL | PASS_CORE |
| TEST-GLO-M05-0110 | GLO-M05-104 | temporal anti-lookahead | CLOSURE | PASS_CORE |
| TEST-GLO-M05-0111 | GLO-M05-105 | happy path | MATRIX | PASS_CORE |
| TEST-GLO-M05-0112 | GLO-M05-106 | happy path | MATCH | PASS_CORE |
| TEST-GLO-M05-0113 | GLO-M05-107 | happy path | WEEKLY | PASS_CORE_PROVIDER_GATED |
| TEST-GLO-M05-0114 | GLO-M05-108 | happy path | TEMPORAL | PASS_CORE |
| TEST-GLO-M05-0115 | GLO-M05-109 | happy path | STATS | PASS_CORE |
| TEST-GLO-M05-0116 | GLO-M05-110 | happy path | STATS | PASS_CORE |
| TEST-GLO-M05-0117 | GLO-M05-111 | happy path | FDR | PASS_CORE |
| TEST-GLO-M05-0118 | GLO-M05-112 | happy path | TEMPORAL | PASS_CORE |
| TEST-GLO-M05-0119 | GLO-M05-113 | happy path | CATALOG | PASS_CORE |
| TEST-GLO-M05-0120 | GLO-M05-114 | happy path | CATALOG | PASS_CORE |
| TEST-GLO-M05-0121 | GLO-M05-098, GLO-M05-099, GLO-M05-100 | publication | ACCESS, INSIGHT, PIPELINE | PASS_CORE |
| TEST-GLO-PUB-0053 | GLO-PUB-044 | publication | ACCESS | PASS_CORE |
| TEST-GLO-PUB-0054 | GLO-PUB-045 | publication | ACCESS | PASS_CORE |
| TEST-GLO-PUB-0055 | GLO-PUB-046 | publication | ACCESS | PASS_CORE |
| TEST-GLO-PUB-0056 | GLO-PUB-047 | publication | ACCESS | PASS_CORE |

### Validations finales

Validations relancées pendant la clôture sur les fichiers enregistrés, sans utiliser les sorties perdues lors du passage du workspace en lecture seule :

| Commande | Résultat |
|---|---|
| node --experimental-strip-types scripts/check-global-v2-relationships.mjs | 266/266 PASS |
| node scripts/check-global-v2-relationship-authority.mjs | 20/20 PASS, CanonicalRepository → FactSourceResolver → P02 → M5, sans réseau ni méthode d'écriture |
| node --experimental-strip-types scripts/check-global-v2-economic-function.mjs | 72/72 PASS |
| node --experimental-strip-types scripts/check-global-v2-category-needs-materiality.mjs | 49/49 PASS |
| node --experimental-strip-types scripts/check-global-v2-temporal-arbitration.mjs | 179/179 PASS |
| node --experimental-strip-types scripts/check-global-v2-temporal-descriptive.mjs | 17/17 PASS |
| node --experimental-strip-types scripts/check-global-v2-routines.mjs | 67/67 PASS |
| node --experimental-strip-types scripts/check-global-v2-foundations.mjs | 108/108 PASS |
| node node_modules/typescript/bin/tsc --noEmit | PASS |
| node scripts/check-architecture-imports.mjs | PASS, 508 fichiers |
| node node_modules/next/dist/bin/next build | PASS, compilation + TypeScript + 7/7 pages statiques, exit 0 |
| git diff --check | PASS, avertissements LF/CRLF non bloquants |
| Contrôle inventaire exigences/tests | 118/118 + 125/125 lignes présentes; contrôle documentaire uniquement |
| Contrôle des chemins et motifs de secrets | PASS; aucun env, clé, CSV ou donnée bancaire ajouté |

La dernière correction adapte les supports de RelationshipInsight au parser partagé et conserve UNKNOWN pour la couverture hebdomadaire dont le dénominateur calendaire n'est pas prouvé. Elle n'invente pas de ratio à partir du nombre de semaines observées. Les cinq assertions supplémentaires exercent les parsers réels des enveloppes DAY/WEEK.

Les régressions B/C ci-dessus précèdent uniquement cette adaptation de sortie M5 : leurs producteurs ne sont pas modifiés par celle-ci. Les suites M5, serveur, typecheck, architecture et build ont été relancées après elle. Aucun ancien payload History ou oracle n'a été exécuté comme source.

### Périmètre du checkpoint

21 fichiers P06 : deux rapports/état, package.json (deux commandes de test), trois adaptations partagées matérialité/dépendances M3/assemblage M3, deux suites M5, douze fichiers relationship(s) Analytics et un adaptateur serveur. Aucun fichier existant hors lot supprimé, aucune migration, aucun fichier temporaire inclus. Le détail exact est la liste du commit local.

Tests de source : fixtures Canonical synthétiques uniquement; aucune écriture ni nouvelle lecture Supabase dans cette clôture. Les deux lectures de métadonnées antérieures sont consignées dans la chronologie. Aucun build ne vaut preuve de qualification sur données live.

### Verdict de clôture P06

Les gates portent sur D1–D3 **core**, avec les exclusions explicitement autorisées, non sur l'activation de toutes les capacités futures. Le périmètre fonctionnel restant est identifié : mobilité/visites/Moments/Purchase aux providers P08/P10; contextes professionnels, finance quotidienne personnelle, participation partagée et effets hebdomadaires sans preuve restent fermés. Les tests positifs de ces futurs providers ne sont pas déclarés exécutés.

Les contrôles source, population, matching, statistiques, FDR, temporalité, déclarations, projections Analytics et accès du core sont enregistrés et testés. Aucune exigence n'a été supprimée de la matrice pour obtenir le verdict. Le module ne fournit aucune autorisation de publication live.

CURRENT_PROMPT = P06

BASELINE_HEAD = a83dc2debaba942878798b15bd976cf89e7545df

IMPLEMENTATION_GATE = PASS

CONTRACT_GATE = PASS

TEST_GATE = PASS

GLOBAL_PHASE_D_CORE = PASS

LIVE_GATE = NOT_RUN

CAPABILITIES_ACTIVE = PERSON Restaurant via Canonical/Facts; contrats DAY/WEEK autoritaires; P02; FDR; LOMO; recomputation temporelle; feed M3; projections et accès Analytics

CAPABILITIES_GATED = contextes non prouvés; consommation quotidienne personnelle; partage; providers P08/P10; matérialité hebdomadaire sans preuve de corpus

UNRESOLVED_REQUIREMENTS = NONE_IN_CURRENT_CORE; CONDITIONAL_PROVIDER_ACTIVATION_REQUIRES_RECERTIFICATION

LIVE_WRITES = NONE

NEXT_PERMITTED_PROMPT = P07

Checkpoint local uniquement. Aucun push. P07 n'est pas commencé.
