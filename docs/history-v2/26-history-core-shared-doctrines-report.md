# HC2 — Doctrines partagées History

Reprise normative : 2026-09-03.
HEAD : efa4cd2a4c27b4831263816d96f76e859a4356fb. Branche : main.

## Gate d'entrée et périmètre

Le rapport 25-history-core-analytics-authority-report.md conclut HISTORY CORE
HC1 / PASS. Le working tree contenait déjà les modifications HC1/HC2 ; elles
sont conservées. La présente reprise porte exclusivement sur les deux
AUTHORITY_GATED Moment et Place. HC3 n'est pas commencé.

Aucune opération Supabase (ni lecture live dans cette reprise, ni écriture),
publication, backfill, migration, Global, Import, frontend, commit, push ou
déploiement. Le schéma live n'est pas recertifié ici. Les lectures de schéma
du premier run HC2 sur ipuuhxrblxormwgoaqnz restent des preuves historiques.

## HC2 AUTHORITY RESOLUTION

### Documents normatifs désormais disponibles

Sections pertinentes lues directement, sans recopier les documents dans le repo :

- C:/Users/Manon/Downloads/projet budgetisation/Brief_Technique_Historique_Mensuel_V2_Calendar_Centric_FINAL.docx :
  hiérarchie d'autorité, doctrine conservée M1–M4, chaîne Canonical → Facts →
  Analytics → ReadModels. Le changement calendar-centric n'annule pas M4.
- C:/Users/Manon/Downloads/Contrats_Calculs_Bilan_Mois_M1_M4_V2.docx :
  M4, notamment 6.18 causalCost, 6.19 spentDuring, 6.22 et 6.31–6.34 Place.
- C:/Users/Manon/Downloads/projet budgetisation/Brief_Technique_Analyse_Globale_V2_FINAL_EXHAUSTIF_MASTER.zip :
  DOCX de même nom contenu dans le bundle, également disponible dans le même
  répertoire. Module 6 C (§§24–32) et D (§§33–38), Module 7 doctrines des
  présences/visites/rôles et G (§§72–90). Usage limité aux doctrines partagées ;
  aucune implémentation Analyse Globale.
- C:/Users/Manon/Downloads/Contrats_Canonical_Manquants_History_V2.docx :
  assertion Canonical explicite, grain économique, ownership des composantes,
  interdiction des heuristiques, noms physiques adaptables sans perte sémantique.
- AGENTS.md et rapports 25/26 existants. Les audits descriptifs antérieurs
  ne sont pas substitués à ces autorités normatives.

### Rectification des conclusions précédentes

La conclusion précédente UNDEFINED était liée à l'absence des documents.
Elle n'est plus la conclusion applicable à EconomicComponentFact.moment.

Le Brief Global, Module 6 §26, cite explicitement
EconomicComponentFact.momentId parmi les relations causales admissibles.
M1–M4 confirme la somme des événements causaux nets, même avant/après la
période du Moment. Il ne s'agit donc pas d'inférer une cause depuis une FK.

Les règles de rôle/routine, scoring et couverture Place sont aussi définies.
L'absence d'un rôle canonique exploitable pour une instance est DATA_MISSING,
pas DOCTRINE MANQUANTE. Les anciens arbitrages demandant d'inventer une
convention universelle ne sont plus nécessaires. Aucun mapping par libellé
ou fréquence n'est ajouté en remplacement des données absentes.

### Moment — autorité et chaîne physique

| Champ | Résolution / preuve |
|---|---|
| NORMATIVE CONTRACT | Global Module 6 §26 : EconomicComponentFact.momentId est admissible causalement ; §§27–31 : ni proximité/lieu/marchand, ni double attribution additive. History M1–M4 6.18/6.19 : causalCost indépendant de spentDuring. |
| PHYSICAL SOURCE | financial_economic_cost_canonical.moment_id, canonical_component_key et canonical_economic_net. Le DDL initial de cette vue n'est pas dans les migrations locales ; sa définition consultée au premier run reprend les références des sources canoniques. Aucune nouvelle affirmation sur l'état live. |
| CANONICAL | src/server/canonical/repository.ts : loadEconomicComponentRowsByOperations/Keys sélectionnent ces colonnes ; projectEconomicComponentRows transmet le même economicComponent à projectEconomicComponentFact, après contrôles de scope et de réconciliation. Nouveau loadEconomicFactsByMomentIds : lecture batchée par moment_id, autorisation Household préalable, même projection, aucune restriction date/mois. |
| FACT | src/analytics/facts/canonical.ts : parseEconomicComponentRow valide clé/source_kind/source_layer et lit moment_id via parseMomentId ; projectEconomicComponentFact affecte exactement moment: idDimension(component.momentId). src/analytics/facts/types.ts : EconomicComponentFact.moment est une dimension de MomentId. FactSourceResolver.loadEconomicFacts délègue au Repository sans réinterprétation. Le nom logique momentId et la représentation discriminée moment désignent la même référence, prouvée par cette affectation, pas par ressemblance lexicale. |
| ANALYTICS | shared-doctrines.ts : projectCanonicalMomentRelations émet CAUSAL / CANONICAL_COMPONENT_MOMENT, avec Household, composante, Moment, montant net et sourceEconomicAmount. evidenceRefs identifie explicitement la vue, la composante, la colonne et le Moment. resolveMomentFinancialCost déduplique et contrôle les attributions avant la sélection du Moment. |
| READMODEL | Producteur check-history-v2-certification-12-months.mjs : momentState → MomentLifeMoneySummary et buildMomentDetail → MomentDetailReadModel. causalCostByCalendarItem alimente la collection Journal existante. Les parsers/schemas existants sont conservés. |
| KNOWLEDGE RULE | Aucun lien causal : UNKNOWN / DATA_NO_CAUSAL_LINK, jamais zéro inventé. Ensemble causal complet lu : KNOWN net. Référence non qualifiée supplémentaire : PARTIAL / OBSERVED_ONLY. Preuves/montants contradictoires ou sur-attribution : CONFLICT. Association CONTEXTUAL ne contribue pas. |
| TEST | Projection stricte de lignes synthétiques des cinq source kinds jusqu'au coût ; lecture batchée réelle exécutée avec client factice ; même lieu/marchand sans moment_id exclu ; association et spentDuring seuls exclus ; net après remboursement ; avant période ; répartition 20/40 acceptée et 60/60 sur source 60 refusée ; M4 et Moment Detail validés par RuntimeSchema. |
| STATUS | AUTHORITY RESOLVED. L'adaptateur Canonical n'est plus AUTHORITY_GATED. |

La nouvelle lecture par Moment évite de transformer une allocation quotidienne
mensuelle en montant causal : le coût n'est pas proratisé au mois affiché.
Le producteur utilise les MomentIds réellement référencés par l'artifact
Calendar, et charge leurs composantes canoniques entières, hors période incluse.

La provenance est conservée dans MomentFinancialRelation, intrant du digest de
construction. Aucun simple moment_id_context, lien CONTEXTUAL, lien de lieu,
nom de marchand, fenêtre temporelle ou relation Life Event non qualifiée
n'est adapté automatiquement. Le chemin actuel utilise l'autorité directe
EconomicComponentFact ; il ne crée pas un nouvel héritage causal LifeEvent → Moment.

Les références UNDEFINED et CONTEXTUAL restent des types défensifs distincts
pour des relations qui ne proviennent pas de cet adaptateur Canonical.
EXPLICIT_CANONICAL_CAUSAL_LINK exige aussi preuves, montant attribué et
montant source ; aucun nouveau lien de ce type n'est créé dans les données.

Le contrôle inter-Moments porte sur chaque composante du Household : les
répétitions identiques sont dédupliquées ; la somme des valeurs absolues
attribuées ne dépasse pas la valeur absolue de la source et le signe est
cohérent. Ce contrôle évite qu'un remboursement ou une attribution négative
masque un double comptage. Une composante positive de 60 n'alimente pas deux
coûts de 60 ; une répartition explicite 20/40 reste admissible. Aucune
répartition n'est inventée par le moteur.

isWhollyCausalMomentExpense exige toutes les composantes d'un événement humain
et l'égalité de la somme attribuée avec son montant avant de l'afficher
entièrement causal ou de lui attribuer un owner narratif. Un achat de 100 dont
seulement 60 sont prouvés n'est pas affiché intégralement causal.
L'attribution doit aussi être intégrale pour chaque composante : deux
attributions partielles +80/-20 sur sources +100/-40 ne deviennent pas un
achat entier par la seule égalité de leurs nets (60). Ce cas est testé.
Le breakdown limité au ledger mensuel reste PARTIAL / OBSERVED_ONLY : il ne
prouve pas la liste complète des événements humains hors mois ou sans jour
économique assigné. Le coût conserve, lui, les composantes canoniques complètes.

computeSpentDuring reste inchangé : sélection temporelle économique, sans
condition narrative/causale, sans distribuer unassignedEconomicAmount.
Le test de détail établit causalCost=60 avant +40 pendant=100,
spentDuring=20 sans lien pendant +40 causal pendant=60.
L'ownership d'affichage ne change pas ce calcul.

### Place — sources distinctes et absence déterministe

| Concept | Autorité physique utilisable | Limite explicite |
|---|---|---|
| Human presence | person_days + location_occurrences : personne, jour, place, intervalle, précision ; couverture_localisation qualifie la présence | Ni transaction ni couverture monétaire |
| PlaceVisit | loadPlaceVisits → projectPlaceVisitFact ; occurrence_type=Présence, identité localization_id, Household/person/day contrôlés ; Transit rejeté | Pas de clustering GPS ni nouvelle règle de visite financière |
| Activity links | life_events.primary_place_id + ActivityOccurrenceFact admissible → historyPlaceActivityTypes, types distincts | Pas de proximité date/visite ; pas de lien Activity fabriqué |
| Moment links | Identité Moment connue ; aucun adapter explicite de membership Moment→Place retenu dans les sources actuelles | moment_life_events et une dépense au même lieu ne prouvent pas à eux seuls cette appartenance ; momentCount/highlight absents |
| Semantic place role | Contrat de rôle explicite défini ; aucun Fact/adapter actuel de rôle personnel daté correspondant aux classes HOME/REGULAR_WORK/OTHER_ROUTINE n'est exposé | nature_lieu/usage_principal/sous_type ne prouvent pas le rôle régulier d'une personne/Household ; label ou 31 présences n'y suppléent pas |
| Localized finance | operation_place_canonical → parseCanonicalPlace → EconomicComponentFact.canonicalPlace | Connexion par componentKey/operationId et resolution_state known requise ; non-résolu/conflit n'est pas une attribution |
| Place hierarchy | Identité placeId connue ; aucun lien parent autoritaire consommé par ce producteur | Pas de hiérarchie déduite des labels, pas de rollup montant ajouté à un montant enfant ; contribution actuelle au placeId canonique seulement |

| Champ | Résolution / preuve |
|---|---|
| NORMATIVE CONTRACT | History M1–M4 6.31–6.34 définit sélection, score, seuils 80/60 et localizableSpendScope. Global Module 7 G définit les autorités financières admissibles et les interdictions ; ses seuils/statistiques propres à Global ne remplacent pas ceux de History. |
| PHYSICAL SOURCE | location_occurrences/person_days ; life_events.primary_place_id ; financial_economic_cost_canonical et operation_place_canonical ; referentiel_lieu pour identité/libellé, pas pour une routine déduite. Sources/migrations locales ciblées relues ; aucune nouvelle lecture live. |
| CANONICAL | CanonicalRepository.loadPlaceVisits, loadLifeEventRecords, projectEconomicComponentRows. parseCanonicalPlace vérifie la composante, l'opération, resolution_state et placeId. |
| FACT | PlaceVisitFact séparé de EconomicComponentFact.canonicalPlace. Les états unknown/conflict/not_applicable sont conservés ; aucun placeId inventé. ActivityOccurrenceFact joint seulement à primary_place_id explicite. |
| ANALYTICS | resolveHistoryPlaceFinance → resolveLocalizedAmountVisibility ; historyPlaceActivityTypes ; computePlaceSignificanceScore/rankPlaces existants. Scoring M1–M4 inchangé ; correction du libellé de basis en localizable_spend_scope et de la part financière signée (pas abs). |
| READMODEL | placeState → PlaceLifeMoneySummary ; buildPlaceDetail → localizedCoverage/localizedAmount/presenceDays. Les inputs non sourcés sont absents, missingInputs et DATA_PARTIAL_SOURCE / RANKING_INPUTS_INCOMPLETE sont conservés. |
| KNOWLEDGE RULE | Présence sans finance : pas de montant inventé. Montant localisé connu ne signifie pas coverage=1. Routine/sémantique/membership absents ne sont ni NONE/OTHER/0 source ni doctrine manquante. Score observé incomplet explicite ; classement complet non certifié. |
| TEST | Toutes les tranches du score M1–M4, pénalités -35/-30/-15, seuil financier 80 %, coverage 0/59/60/80 %, signé, non-spatial, présence seule, labels répétés ; Place Detail RuntimeSchema conserve une finance prouvée de 80 à coverage=.8 malgré rôle absent. |
| STATUS | AUTHORITY RESOLVED ; DATA_MISSING sur les inputs non disponibles. Aucun arbitrage doctrinal requis pour maintenir ces absences. |

#### Autorités de finance localisée

- DIRECT_CANONICAL : le chemin physique actuel consomme uniquement la
  résolution autoritaire de operation_place_canonical, jamais le lieu d'une visite.
- PURCHASE_ESTABLISHMENT : admissible seulement si un établissement physique
  canonique exact est fourni. Pas de résolution merchant chain → établissement.
- CAUSAL_EVENT_PLACE : exige un héritage canonique explicitement autorisé,
  précis et univoque ; aucun héritage nouveau ajouté depuis un Moment/sa ville.
- DECLARED_PLACE_ATTRIBUTION : exige une assertion canonique explicite ;
  aucune déclaration ni donnée de localisation créée dans cette mission.

Les trois dernières autorités ne sont pas fabriquées si elles ne sont pas
disponibles dans les Facts actuels. Le producteur n'a aucun raccord GPS +
transaction proche, même marchand ou même ville. Il réutilise la vue de
résolution, sans reconstruire sa doctrine.

#### Couverture et scoring

Couverture = somme absolue des nets autoritairement localisés / somme absolue
des nets du localizableSpendScope. Les composantes explicitement
not_applicable/non-spatiales sont exclues ; inconnues/conflits restent au
dénominateur. Une composante sans preuve de non-spatialité n'est pas exclue
par sa catégorie ou son libellé. L'absence d'une classification canonique plus
fine peut donc rendre cette couverture conservatrice ; aucune exclusion
heuristique de loyer/abonnement n'est ajoutée.

Le montant du lieu reste net. Un remboursement négatif ne devient pas une
part positive du score. Sans Actual strictement positif, la part comparable
n'est pas calculée. Basis Quality : localizable_spend_scope.

| Couverture / source | Carte | Détail |
|---|---|---|
| >=80 %, montant localisé effectivement prouvé | KNOWN | KNOWN |
| >=60 % et <80 % | UNKNOWN | PARTIAL, LOWER_BOUND seulement si non-négatif, sinon OBSERVED_ONLY |
| <60 % | UNKNOWN | UNKNOWN |
| Dénominateur nul | NOT_APPLICABLE | NOT_APPLICABLE |
| Présence seule, aucun montant localisé | UNKNOWN si scope localisable | UNKNOWN, pas zéro inventé |

Score History = narration + présence + activités + finance + bonus − routine.
Narration : highlight 40/36/32/28/24 OU Moments distincts 18/21/24, non cumulés.
Présence : 5/9/13/17/21/25 pour 1/2/3–4/5–7/8–14/15+ jours.
Activités : 0/5/10/15. Finance : 2/4/7/10 selon part positive
<1 % / >=1 % / >=2 % / >=5 %, uniquement si couverture >=80 %.
Bonus : voyage/séjour/famille/amis 10, loisirs/événement/santé 6, neutre 0.
Routine : domicile −35, travail régulier −30, autre routine −15.
Seuil candidat 20, top6, tie-breakers existants conservés.

Un input absent contribue zéro au score observé, mais n'est pas présenté comme
un rôle neutre prouvé : missingInputs/Quality garde la limite visible.
Le remplissage futur des rôles et hiérarchies exige des sources canoniques ;
ce n'est pas une convention à décider dans React ni un chantier ouvert ici.

## HC1 / autres corrections HC2 conservés

## M3 — classifications composantes

Chaîne réutilisée, sans nouveau moteur de classification :

1. `CanonicalRepository.loadEconomicComponentClassifications(range)` dans
   `src/server/canonical/repository.ts` charge les composantes et assertions.
2. `resolveEconomicComponentClassifications()` dans
   `src/analytics/facts/component-classification.ts` résout l'autorité : override
   explicite de composante, valeur autoritaire de composante, puis fallback
   d'opération seulement lorsqu'il est admissible, notamment pour le mixte.
3. `projectHistorySpendingComponents()` projette les enums exacts du Fact et
   conserve ses états. `KNOWN` exige une valeur admissible, une autorité et des
   références de preuve. Le join utilise Household + clé canonique.
4. `buildSpendingAxes()` produit les axes et la matrice ; les sélections de
   segments/catégories réutilisent les mêmes composantes projetées.

| Valeur résolue du Fact | Valeur Analytics |
|---|---|
| Indispensable / Contraint / Optionnel | INDISPENSABLE / CONSTRAINED / OPTIONAL |
| Fixe / Variable | FIXED / VARIABLE |
| Vie courante / Hors quotidien | CURRENT_LIFE / OUT_OF_DAILY |

Les aliases autorisés sont déjà normalisés par le resolver Canonical/Facts,
pas par le script. L'ancien test textuel `quotid` précédait `hors` et capturait
à tort « Hors quotidien » comme Vie courante. Ce chemin a été supprimé.

`UNKNOWN` ne peut pas être remplacé par le texte plus suggestif d'un autre
champ. `CONFLICT` se propage ; les montants restent dans l'unclassified pour la
réconciliation. Un axe vide ou intégralement non applicable est
`NOT_APPLICABLE`. Un ensemble entièrement non classé est `UNKNOWN`, et un
sous-ensemble classé est `PARTIAL / OBSERVED_ONLY`.

Chaque axe et la matrice vérifient :

`classifiedAmount + unclassifiedAmount = Actual`.

Un montant net non classé de zéro ne prouve pas une classification complète :
deux composantes inconnues de +10 et -10 restent UNKNOWN. Les marges conservent
UNKNOWN/NOT_APPLICABLE/CONFLICT ; LOWER_BOUND n'est utilisé pour une marge
partielle que si les composantes sont toutes non négatives. Les doublons de
composantes sont rejetés.

## Activity — preuve, couverture et détails

Chaîne réutilisée : `ActivityOccurrenceFact` →
`parseActivityCausalFinancialLinks()` → `buildActivityOccurrenceCostFacts()` →
`FactSourceResolver.loadActivityOccurrenceCosts()` →
`resolveHistoryActivityCost()` → summaries/details.

Les liens admissibles sont confirmés et de type `Paiement_activite`,
`Cause_par_evenement` ou `Preparation`. Le Fact vérifie la clé de composante,
le montant lié, les conflits et sur-attributions ; ses preuves identifient le
lien financier, la composante et la relation. `Contexte` et `Effectue_pendant`
ne deviennent pas CAUSAL.

L'agrégat partagé refuse une occurrence dupliquée et un coût connu sans preuve.
Toutes les occurrences connues donnent KNOWN ; une couverture partielle donne
PARTIAL/OBSERVED_ONLY. Une relation causale prouvée dont le montant est
irrécupérable reste `CAUSAL + UNKNOWN / DATA_PARTIAL_SOURCE`. Sans relation,
le résultat est `NONE + UNKNOWN / DATA_NO_CAUSAL_LINK`, jamais « gratuit ».

Le resolver générique `resolveActivityCost()` exige aussi une autorité et des
preuves pour CAUSAL et ASSOCIATED. Le producteur n'alimente pas ASSOCIATED.

Activity Detail ne transforme plus une composante causale d'un achat en
attribution de l'achat entier : toutes les composantes affichées doivent être
prouvées et leur somme liée doit égaler le montant de l'événement économique.
Le détail est OBSERVED_ONLY : sa fenêtre quotidienne ne prouve pas la
complétude des dépenses causales hors mois. Le coût analytique conserve, lui,
la source du resolver existant.

Frequency/ticket, participants et autres enrichissements non sourcés ne sont
pas inventés. Les placeholders et collections non enrichies existants restent
en place. Leurs champs vides ne constituent pas une preuve d'absence métier.

## Versions, hashes et compatibilité

history_shared_doctrines@v3 remplace @v2 pour la résolution causale désormais
autorisée. Le digest balanceAuthorityDigest inclut déjà cette version, les
relations Moment (avec montant/provenance), les faits économiques et les
primaryPlaces. Le changement ne peut pas réutiliser leur ancien digest.

Les versions de policies préparées au précédent HC2 restent inchangées :
spending_nature@v3, life_money_selection@v3, week_journal_projection@v2,
month_overview_selection@v3. Le gel antérieur des signatures historiques
dans historyV2AcceptedMethodSignatures est conservé. Aucun hash attendu
historique n'est modifié pour faire passer les tests.

La recertification de générations réelles et une éventuelle publication
restent hors périmètre. Ce gate ne prétend pas que les snapshots live actuels
incorporent HC2. Aucun moteur V1, schema RM, UI ou doctrine Activity/M3 n'est
modifié dans cette reprise.

## Vérifications de la reprise normative

| Commande / suite | Résultat |
|---|---|
| node --experimental-strip-types scripts/check-history-v2-month-balance.mjs | PASS — 99/99 blocs, assertions discriminantes Moment/Place comprises |
| node --experimental-strip-types scripts/check-history-v2-readmodels.mjs | PASS — 27/27 |
| node --experimental-strip-types scripts/check-history-v2-calendar-daily-engines.mjs | PASS — 42/42 |
| node --experimental-strip-types scripts/check-history-v2-transversal-contracts.mjs | PASS — 48 |
| node --experimental-strip-types scripts/check-history-v2-canonical-contracts.mjs | PASS |
| node scripts/check-history-v2-snapshot-materialization.mjs | PASS — 79, 15 familles, 54 instances synthétiques, 2 artifacts, finalizeRequested=false |
| node scripts/check-canonical-in-batching.mjs | PASS |
| node scripts/check-architecture-imports.mjs | PASS — 462 fichiers |
| node node_modules/typescript/bin/tsc --noEmit --incremental false | PASS |
| node node_modules/next/dist/bin/next build | PASS — Next 16.2.6, compilation + TypeScript + génération terminés |
| git diff --check | PASS |

Le premier typecheck a détecté une inférence string au lieu du Money brandé
dans le nouveau helper de sélection ; le reduce est désormais explicitement
typé Money, sans changement de calcul. Typecheck et build ont été relancés
avec succès sur l'état final enregistré, y compris le dernier garde-fou signé.

Les suites sont locales/synthétiques. La méthode Repository réelle est
exécutée avec un client de lecture factice ; les projections de lignes
physiques, builders réels extraits de l'AST et RuntimeSchemas sont exécutés.
Ce n'est ni une lecture du Supabase live ni une certification 12 mois.
Aucun ancien script V1 interdit n'a été exécuté.

## Fichiers et état Git

Fichiers modifiés dans cette reprise, en plus de l'état HC1/HC2 préexistant :

- src/analytics/history-v2/shared-doctrines.ts ;
- src/analytics/history-v2/month-balance/engine.ts (basis de couverture) ;
- src/server/canonical/repository.ts (lecture causale par Moment) ;
- scripts/check-history-v2-certification-12-months.mjs ;
- scripts/check-history-v2-month-balance.mjs ;
- docs/history-v2/26-history-core-shared-doctrines-report.md.

Le rapport 25 et balance-authority.ts sont préservés. Le HEAD et la branche
ne changent pas. Working tree non propre : modifications HC1/HC2 non commitées,
aucun commit/push demandé ni effectué. Aucun fichier de données personnelles,
secret, fixture live, publication ou génération 12 mois n'a été ajouté.
La comparaison SHA-256 avec le début de cette reprise confirme les sept autres
fichiers HC1/HC2 byte-for-byte inchangés. Les cinq fichiers déjà modifiés repris
ici et repository.ts constituent exactement les six fichiers listés ci-dessus.
Statut Git total : neuf fichiers suivis modifiés et quatre fichiers non suivis,
incluant les travaux préexistants, aucune suppression.

## Gate final

Autorité Moment fermée par le contrat et sa projection physique ; autorité
Place fermée par la doctrine M1–M4 et les règles de source/absence explicites.
Les gaps de données historiques, le ranking Place complet et la future
recertification/publication ne sont pas présentés comme résolus par ce gate.
Aucun arbitrage doctrinal supplémentaire n'est requis pour les deux points
de cette mission. HC3 reste hors périmètre.

HISTORY CORE HC2
PASS
