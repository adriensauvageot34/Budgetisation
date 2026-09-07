# P17A — Audit de certification et freeze GC1

Date : 2026-09-07. Nature : audit ciblé et préparation, **pas certification GC1**.

## 1. Conclusion et limite de ce dossier

Le checkpoint P16 déclare PASS, mais il ne constitue pas une preuve suffisante de fermeture H5. Plusieurs frontières P13–P16 acceptent des preuves auto-déclarées ou ne sont testées que séparément. Trois probes courts ont confirmé deux failles de validation du manifest et une acceptation Query d'identités méthode/policies non attendues. Aucun correctif produit n'est appliqué ici.

La stratégie de candidats, de mutations, de fermeture des dépendances et de prépublication est définie ci-dessous. **La correspondance individuelle des 2 302 tests conceptuels avec des assertions exécutables n'est pas établie par le dépôt, ni intégralement fermée par cet audit.** Les matrices par owner ci-dessous sont un plan de couverture, pas cette preuve individuelle. Le lien entre les deux espaces d'identifiants Capability reste également à expliciter. En conséquence, les conditions 3 et 12 du freeze ne sont pas entièrement acquises : `P17A_FREEZE_GATE = PARTIAL`. Ne pas convertir le présent dossier en PASS par comptage.

Il n'existe pas de nouvel arbitrage métier identifié. Les lacunes sont techniques/de preuve. P17A ne corrige pas le produit et n'exécute pas les batteries P17B. La reprise CLOSURE_ONLY, documentée en §15, ferme la classification des preuves et qualifie explicitement P16 comme checkpoint historique insuffisant pour GC1, **sans exiger un nouveau PASS P16 avant P17B**. Seule la traçabilité individuelle non résolue empêche encore le handoff automatique.

## 2. Baseline, sources et identité

- Dépôt : Budgetisation ; branche `main` ; HEAD P16 exact `13d2f01291b544250191ac2a9b6a88223788cb14` ; worktree propre à l'entrée.
- Sources : `AGENTS.md`, `GLOBAL_EXECUTION_CONTRACT.md`, `GLOBAL_MASTER_INDEX.json`, `GLOBAL_ANALYTICS_DEPENDENCY_MATRIX.md`, rapports P01–P16 et freezes P10A/P04, contrats Publication/Query/RM, doctrines HC2 et mécanismes HC3–HC5. Les lectures des lots sont ciblées sur leurs autorités, gates, dépendances et preuves finales ; leurs anciennes chronologies ne sont pas relancées.
- Master lu dans le DOCX contenu dans le ZIP autoritaire, sans nouvelle extraction dans le dépôt. Les paragraphes référencés ci-dessous désignent les paragraphes directs `word/document.xml / w:body/w:p`, index zéro ; les ancres de l'index restent conservées dans leur convention d'origine.
- Aucune observation Supabase nouvelle : les anciennes révisions, disponibilités et cardinalités live restent historiques. Aucune preuve de disponibilité live Global n'est créée.

| Objet | SHA-256 des octets lus |
|---|---|
| Master DOCX dans ZIP | `8b0d0ff2381599c4495645cd1dd1ebf2fa0d027fc3113be78aee945fae12f8be` |
| GLOBAL_MASTER_INDEX.json | `f39b7d60620f2bf8d3c2babba13feed22c3223d5326513ea0056cadf00def3c7` |
| GLOBAL_EXECUTION_CONTRACT.md | `953e1fb186e15f6b84ddef1afc3c134d2106fe77c2653eadb30f2bd1ac4dc31c` |
| GLOBAL_ANALYTICS_DEPENDENCY_MATRIX.md | `473b84444986fc820a0c17af70612131599b5437b21a8361aa032d1860967def` |
| package-lock.json | `4a2c2e2c04d3fa8a610b5e3dfb8fade8615e7b6fc0bc009d2d36b3c5faa26056` |
| SQL Global préparé, 20260906120000 | `79edd797877ceb765d5f7e711ab023e17e11c4ff8d98f47b52efaca9c785806c` |

Les blobs Git du HEAD ci-dessus fixent les sources produit lues. Cela ne démontre pas que chaque closure de test historique est inchangée : cette distinction gouverne la réutilisation en §5.

## 3. Registres et applicabilité : ce qui est vérifié

Inventaire actuel : 2 047 exigences, 364 capacités, 2 302 tests conceptuels. Les références `tests[].sourceRequirementIds` pointent vers des exigences existantes. Les exigences se répartissent en 1 857 MUST_V1, 87 CONDITIONAL_V1/AUTHORITY_GATED, 73 CONDITIONAL_V1/DATA_GATED, 19 FORBIDDEN et 11 LATER.

**Deux espaces Capability distincts :** `requirements[].capabilityId` utilise des identifiants sémantiques, par exemple `CAP-AI-AUTORITE-ET-ROLE-EXACT`, tandis que `capabilities[].id` utilise notamment `CAP-AI-001`. Aucune des 2 047 lignes Requirement n'a de jointure directe vers ce second espace par égalité de ces champs. Ce constat n'établit pas que le Master est erroné : il interdit de prétendre qu'une jointure n'existant pas a été vérifiée. Ne pas fabriquer une correspondance par position, suffixe ou proximité de titre. Conserver les deux namespaces et une correspondance justifiée par la source, éventuellement plusieurs-à-plusieurs.

Le registre contient des `initialStatus=PENDING`, pas des résultats de certification. Une source telle que `CAP-AI-001.source.section` mentionnant la dimension sociale pour InsightSelection doit être rapprochée de la table source avant d'être utilisée comme preuve ; ne pas corriger une doctrine depuis un libellé d'index.

| Owner | Exigences | Capacités | Tests conceptuels | Recette de preuve / dépendances |
|---|---:|---:|---:|---|
| P01 | 130 | 23 | 158 | A : fondations, attribution exacte, parsers, scopes V1 ; dépendances de tous les lots |
| P02 | 151 | 25 | 174 | B2 : Canonical/Facts → Finance, resolver temporel, références ; A |
| P03 | 7 | 12 | 8 | B3/B4 : catégories/Needs et matérialité ; A/B2 |
| P04 | 73 | 14 | 89 | C1/C2 : temporalité, fusion, régime, M1 raccordé ; B |
| P05 | 68 | 15 | 84 | C3/C4 : cadence, exposition, coûts distincts ; Facts/B/C |
| P06 | 118 | 15 | 125 | D1–D3 : catalogue/providers, matching, FDR, fenêtres ; B/C puis E/F admissibles |
| P07 | 133 | 13 | 134 | E1/E2 : Moments, causal/spent, comparabilité ; Facts/HC2/B/C |
| P08 | 173 | 29 | 176 | E3/E4 : Place/finance/mobilité gated, replay C/D ; E/B/C/D |
| P09 | 168 | 17 | 184 | F1/F2 : achat humain, adjustments, marchand ; Canonical/P01 |
| P10 | 16 | 14 | 15 | F3/F4 : substitution/convergence, produit gated ; F/B/C/D |
| P11 | 107 | 17 | 127 | G1/G2 : profils, intersection, couverture/ranking ; A/B–F |
| P12 | 254 | 37 | 269 | G3/G4 : participation/social et consommateurs ; Facts/C/D/G1 |
| P13 | 238 | 28 | 265 | H1/H2 : manifest, stockage, invalidation, générations ; A–G/HC3–HC5 |
| P14 | 19 | 6 | 26 | H3 : projection/sélection, dix modules ; A–G/H1/H2 |
| P15 | 3 | 4 | 2 | H4 : instances/Query/destinations ; H1–H3 |
| P16 | 150 | 29 | 168 | H5 : navigateur et transport réel sur snapshot synthétique ; H3/H4 |
| P17 | 148 | 14 | 171 | GC1 transversal ; tous les owners effectivement consommés |
| P18 | 5 | 1 | 4 | Contrats locaux maintenant ; preuve live ultérieure, pas NOT_APPLICABLE métier |
| P20 | 73 | 28 | 69 | Workflow IA réservé P20 ; hooks/non-interférence seuls maintenant |
| T01 | 13 | 23 | 54 | Audit de prérequis/gates ; aucune ouverture d'autorité implicite |

### Règles de la matrice individuelle à fermer

Réutiliser l'index, ne pas recopier le Master. Une ligne de preuve doit porter : namespace + ID, source, owner, classe/condition, prérequis et leur observation datée, dépendances réellement consommées, fixture/candidat, chemin du test + assertion/caseId, commande, attendu, résultat, evidence digest, closure à rejouer, statut de réutilisation.

- MUST : preuve positive, frontières et négatifs pertinents ; une absence d'input n'excuse pas l'absence du moteur.
- DATA_GATED : implémentation positive sur corpus synthétique suffisant ET indisponibilité sur corpus insuffisant ; publication honnête.
- AUTHORITY_GATED : prérequis disponibles ⇒ branche requise ; sinon preuve de fermeture, pas de valeur/placeholder opportuniste. Ne jamais élargir ce statut à un module entier.
- FORBIDDEN : tentative explicitement rejetée ou invariant prouvé sur le vrai chemin ; pas simple absence de fichier.
- LATER : absent de l'activation/navigation, sans promesse de placeholder ; pas de moteur à développer.
- P18/P19 : `LIVE_PROOF_REQUIRED_LATER`, jamais PASS live ; P20 : owner futur explicite, pas renommage MUST → LATER. GC1 déterministe ne constitue pas clôture du workflow IA.
- Les tests multi-exigences gardent toutes leurs références ; chaque assertion peut couvrir plusieurs IDs si elle teste réellement le même comportement. Une recette owner globale ne suffit pas à déclarer ses lignes PASS.

**Reste documentaire précis :** relier les tests conceptuels aux assertions, résoudre les correspondances Capability par source et établir les closures de preuves historiques. Les regroupements P11, la matrice P16 construite par préfixe et les anciens compteurs ne ferment pas ce travail. La stratégie ne prétend pas avoir vérifié individuellement les 4 713 éléments.

## 4. Autorités et capacités conditionnelles conservées

| Domaine | Autorité / état admissible | Preuve discriminante demandée |
|---|---|---|
| Personnel P01 | grain Operation/Allocation/Item/Cash_use ; lien bénéficiaire/parts explicites | payer-only, Payment_component, sous-composant sans héritage : UNKNOWN ; conflits/shares ; total Household inchangé |
| Temps P02–P05 | CH/LT séparés ; fenêtres naturelles ; arbitrages P04 conservés | pas de seuil universel de dispersion ; descriptif ≠ stabilité ; driver non causal avec provenance ; gaps/no-lookahead |
| Professionnel M5 | pas d'ONSITE/REMOTE depuis label/Place ; absence non négative | exclusion examinée dans FDR ; LEAVE/REST et WEEKEND gardent les comparators humains P06 |
| Moment | causalité explicite HC2, spentDuring indépendant | causal hors fenêtre/temporel non causal ; support des pairs ; participants/dates inconnus |
| Place | visite/présence/transaction/localisation/coverage séparées | rôle habituel daté absent ⇒ UNKNOWN ; GPS seul jamais finance ; seuils de couverture au bon univers |
| Achat | schéma/Fact/data coverage séparés | données vides ne signifient pas zéro achat ; funding ≠ acte ; remboursement rattaché ; pas d'identité universelle operationId |
| Produit / mobilité | gates P08/P10 et AG concernés conservés | aucune autorité depuis item bancaire, prix brut ou distance supposée ; branche indisponible testée |
| Personnel enrichi | AG022 fermé sans source explicite | ObservedPersonalTypicalCost distinct ; pas de supplément inventé/chevauchant |
| Participation/social | rosters positifs non exhaustifs ; Contact distinct de Person | UNKNOWN dans coverage, pas taux ; absence de Contact n'annule pas participation interne ; pas de 50/50 |

Ces états proviennent des contrats et des rapports, **pas d'une nouvelle inspection des données live**. Une fixture avec autorité complète certifie un comportement conditionnel, pas sa disponibilité réelle.

## 5. Réutilisation P01–P16

Checkpoints locaux vérifiés dans Git, abréviations non ambiguës à cette baseline :

| Lot | Checkpoint | Preuve historique utilisable | Classe pour GC1 |
|---|---|---|---|
| P01 | f27aa4780f73 | contrats et tests d'attribution/scopes | REPLAY_REQUIRED pour source→candidat ; anciens unitaires réutilisables seulement après closure inchangée |
| P02 | 54fbee5a7f0d | Finance/références/P02 | REPLAY_REQUIRED : sorties temporelles/convergence ultérieures |
| P03 | 3f358ed55f9d | catégories/matérialité | REPLAY_REQUIRED : consommateurs et policies réellement utilisées |
| P04 | 901f329ccb18 | arbitrages humains et détecteurs | REPLAY_REQUIRED pour signaux C/D ; arbitrages REUSABLE_UNCHANGED |
| P05 | a83dc2debaba | routines/exposition/coûts | REPLAY_REQUIRED pour closure finale ; aucun nouveau seuil |
| P06 | d29ba09176a7 | core et exclusions examinées | REPLAY_REQUIRED : disponibilité E/F/G et univers final |
| P07 | 6f8be504ba78 | Moments/HC2 | REPLAY_REQUIRED : inputs finaux et cohérence intermodules |
| P08 | 4551c103c984 | Place, états gated | INSUFFICIENT_FOR_GC1 pour no-op FDR déclaré ; replay avec inputs/éligibilité comparés |
| P09 | 3c09ea111f84 | Purchase/Merchant synthétique | REPLAY_REQUIRED dans corpus intégré ; live DATA_GATED non revalidé |
| P10 | 02f0c8197eac | convergence + freeze 32213755dc34 | REPLAY_REQUIRED pour no-op et FDR ; autorités fermées conservées |
| P11 | c0d5e708dfc4 | profils, ranking, attribution | INSUFFICIENT_FOR_GC1 pour correspondance conceptuelle groupée ; replay intersection/source |
| P12 | 9e9d69e78456 | resolver/social | REPLAY_REQUIRED : absence d'edge déclaré seule ne prouve pas absence d'edge requis |
| P13 | a2591c991855 | coordinateur mémoire, DDL/permissions | INSUFFICIENT_FOR_GC1 pour stage→finalize SQL avec vrais payloads ; LIVE_PROOF_REQUIRED_LATER |
| P14 | 71b21f555a2c | parsers/sélection de projections | REPLAY_REQUIRED pour vrais outputs M1–M10 ; pas de fixture éditoriale comme Analytics |
| P15 | f4653000ce16 | plan/cas Query séparés | INSUFFICIENT_FOR_GC1 pour chaîne manifest→stockage→Query ; cardinalité 32 non oracle |
| P16 | 13d2f01291b5 | build/types et runtime sur fixtures | INSUFFICIENT_FOR_GC1 pour UX/hydratation ; LIVE_PROOF_REQUIRED_LATER pour données Production |

La formulation P16 attribuant schéma/matérialisation/activation live à P17 est **SUPERSEDED** par le prompt P17A. Les anciens rapports restent historiquement inchangés. HC1–HC6 ne sont pas réaudités ; une preuve History n'est réutilisée que pour un contrat identique et une closure inchangée.

Avant de classer une assertion `REUSABLE_UNCHANGED`, comparer au checkpoint testé les blobs du test, des producteurs et imports transitifs, parsers, policies, fixtures et lockfile pertinents. Enregistrer les digests et les chemins. Une nouvelle propriété GC1 reste à tester même si ces fichiers sont inchangés. À défaut de preuve de closure, conserver `REPLAY_REQUIRED`, pas une présomption de réutilisation. Aucun replay mécanique des anciens 947 snapshots/12 mois.

## 6. Risques de faux PASS et corrections/preuves attendues

Les classifications désignent le risque observé, pas le résultat d'une future suite.

| ID / classe | Preuve actuelle | Fermeture requise sous owner |
|---|---|---|
| R01 PROOF_REQUIRED_P17B | Index initial + matrices groupées ; deux namespaces Capability non reliés | matrice individuelle sourcée, assertions identifiées, zéro MUST perdu ; clôture documentaire du freeze d'abord |
| R02 BLOCKING_CONTRADICTION | `materialization/global-v2.ts` : `canonicalDependency` ne valide pas enum authority/type boolean required | parser strict et tests altération ; probe a accepté `authority=INVENTED`, `required="yes"` |
| R03 PROOF_REQUIRED_P17B | même fichier : publicationFactsHash accepté du caller ; input/declaration digests validés en forme, pas recomputés | prouver dérivation depuis intrants consommés et cross-binding ; probe : dépendance modifiée, publicationFactsHash inchangé accepté |
| R04 BLOCKING_CONTRADICTION | `query/global-v2-runtime.ts` vérifie égalité envelope/payload mais fait confiance à signatureCompatible/manifestComplete | signature/policies attendues calculées depuis registre, manifest relu ; probe avec policies/signature fictives a retourné READY |
| R05 PROOF_REQUIRED_P17B | snapshot ne porte pas de binding contrôlé de tous les paramètres/scope au retour ; callbacks authorize/readSnapshot peuvent throw | adversarial mauvais entityRef/scope/cacheKey + panne transport ⇒ erreur locale prévue, sans catch silencieux de tout bug |
| R06 BLOCKING_CONTRADICTION | SQL Global : préfixes `global_v2_*` et guard contract_version `v2` ; registre : `analysis_global_*`, contrat `global-v2-query@v1` | formaliser storage-version vs resource-version ; tester avant/après seal et isolation legacy, ne pas renommer la norme pour le SQL |
| R07 BLOCKING_CONTRADICTION | SQL finalize lit `payload.resourceInputHash/policyVersions` ; RM porte `resourceMeta.*` | aligner la frontière stockage réelle, sans champs miroirs divergents ; tester les vrais builders dans SQL |
| R08 PROOF_REQUIRED_P17B | test Query plan avec metadata synthétiques, attach vers autre hash de manifest ; pas round-trip unique des mêmes octets | construire metadata cohérentes une fois, puis stage/read-back/query sans patch ; hash de manifest non circulaire |
| R09 PROOF_REQUIRED_P17B | `global-query-plan.ts` consomme une liste d'instances fournie ; liens contrôlés par présence de clé | énumération depuis RM/capabilities + validation resource/params de chaque destination ; suppression/ajout exacts |
| R10 PROOF_REQUIRED_P17B | `invalidation.ts` calcule un hop ; POLICY_CHANGE → REPUBLISH_ONLY indistinctement | fermeture transitive par champs/scopes/windows ; policy de publication ≠ policy changeant calcul/qualification ; Facts jamais recalculés pour éditorial seul |
| R11 PROOF_REQUIRED_P17B | `place-recertification.ts` no-op FDR prédéterminé ; exclusions P08/P10 du catalogue persistent ; P12 s'appuie sur NO_DECLARED_INPUT_EDGE | comparer providers requis/disponibles, inputs réels et univers ; aucune q-value isolée ni no-op déduit d'une déclaration potentiellement incomplète |
| R12 PROOF_REQUIRED_P17B | builders RM génériques acceptent valeurs et chaînes de présentation ; tests largement synthétiques | adapter les vrais outputs qualifiés M1–M10, tracer chaque valeur/limitation/détail ; aucun recalcul analytique dans builder |
| R13 BLOCKING_CONTRADICTION | `global-v2-page.tsx` crée le transport de fixtures ; route Production affiche activation pending ; borne affichée codée juillet 2026 | adaptateur transport injectable snapshot-only, borne depuis RM/manifest ; activation Production reste fermée ; pas de fixture dans le chemin productif |
| R14 PROOF_REQUIRED_P17B | UI ne suit pas effectivement toutes les destinations RM ; onEntity change type/titre de panneau ; liens génériques History/Operations | vrais paramètres/identité/scope/génération, retour/scroll/focus, erreurs locales ; fixtures qui distinguent plusieurs entités |
| R15 PROOF_REQUIRED_P17B | test frontend : nombreuses assertions de fixtures/regex et matrice par préfixe ; navigateur non exécuté | assertions DOM/actions/réseau par comportement UX ; pas « 257 PASS ⇒ 168 tests conceptuels couverts » |
| R16 LIVE_ONLY_P18_P19 | migration préparée, test PGlite optionnel couvre DDL/grants, pas cycle réel complet | schema live à inspecter plus tard ; PGlite mémoire maintenant ne prouve pas cutover live |
| R17 AUTHORITY_GATED | produit, mobilité structurée, référence personnelle enrichie, Contact | états négatifs exacts, jamais provider synthétique substitué au réel |
| R18 DATA_GATED | support, exposition, participants, données Purchase | fixture suffisante positive + fixture insuffisante ; pas de faux zéro/table vide = corpus exhaustif |
| R19 NO_RISK_PROVEN | aucune écriture, migration, publication, push exécuté pendant P17A | portée limitée à l'exécution de ce lot, pas attestation rétroactive d'état live |

R03 ne prouve pas à lui seul que tout caller productif fournit un mauvais hash : il prouve que cette frontière ne l'empêche pas. R06/R07 sont des incompatibilités physiques à résoudre/tester localement, pas un motif pour appliquer le SQL live. R11 n'autorise aucune relation dont l'autorité manque.

## 7. Candidats GC1 déterminés

Construire un corpus Canonical synthétique partagé, pas dix univers de fixtures disjoints. Utiliser les adaptateurs officiels avec stockage read-only en mémoire. Même Household, deux vrais PersonId synthétiques, entités et liens explicites. Les corpus suffisant/insuffisant/conflictuel sont des variantes nommées de ce corpus ; aucune donnée bancaire réelle dans Git.

Identité de chaque scénario : `scenarioId`, Master/registry digest, implementation Git SHA + digest des fichiers réellement testés, sourceRevision synthétique, baseAnalyticsRevision synthétique, asOf fixé, fuseau Household, certifiedThrough, liveThrough éventuel, scope normalisé, policies consommées. `generatedAt` technique est fixé pour les comparaisons de bytes ; durée/checkedAt des logs sont exclus des hashes métier. Ne jamais citer le SHA du parent comme identité de modifications non commitées sans digest complémentaire.

| Candidat | Corpus / scopes | Ce qui est construit et comparé |
|---|---|---|
| C-A autorité analytique | Household, Person A/B, intersection comparable, entités admissibles ; CH, CH+LT, gaps, cutoff DST | Facts puis M1–M10 officiels ; références et coûts au grain prescrit ; aucune source History RM/EXPECTED |
| C-B supports | minimum−1/minimum/minimum+1 de chaque policy, corpus saisonnier long synthétique, données absentes/conflits | états/coverage/support/provenance et exclusions ; absence de résultat honnête certifiable |
| C-C RM | outputs de C-A/C-B, pas chaînes fabriquées par fixture frontend | initial, summary absent valide, dix COMPACT, EXPANDED/sections/détails admissibles, méthodologie ; budgets et gateways |
| C-D Query | plans de C-C, params stricts, scopes et génération locaux | toutes les instances atteignables et états gated explicites ; anciennes ressources externes réutilisées seulement par navigation |
| C-E publication locale | C-A→C-D ; G0 puis G1 corrigée | deux générations FULL_RESTAGE en mémoire ; manifest durable, required keys, snapshots/artifacts exacts, read-back et refus stale |
| C-F SQL éphémère | mêmes payloads C-E dans PGlite mémoire autorisé, pas Supabase local | guards, permissions, stage/seal/finalize/retry/rollback simulés ; aucune connexion réelle |
| C-G client | mêmes snapshots locaux via adaptateur du vrai runtime | hydratation, modules/détails, erreurs, cache/pinning, nouvelle visite, clavier/mobile ; preuve fixture seulement |
| Futur P19 | Canonical frais et révisions relues sous autorisation | candidat réel séparé ; une réussite synthétique ne déclare pas ses valeurs/capabilities disponibles |

Une date synthétique fixe, par exemple `asOf=2026-09-01T10:00:00Z`, `certifiedThrough=2026-07-31`, fuseau Europe/Paris, est un input de test, pas une borne produit. Décliner les corpus temporels nécessaires sans forcer toutes les métriques dans la même fenêtre. Réutiliser les valeurs de seuil des fixtures owners et leur source Master ; ne pas fabriquer un seuil statistique commun.

### Énumération des instances

Source des familles : `globalV2QueryRegistry`, `globalPrimaryModuleCatalog`, `globalV2ExpandedResourceCatalog`. Baseline observée : 34 contrats, 32 noms disponibles ; ce ne sont **pas 32 instances universelles**. Une ressource sectionnée possède plusieurs paramètres, un détail plusieurs entités ou aucun.

1. Résoudre les capabilities sur C-A/C-B ; produire les RM avec leurs destinations, pas une liste arbitraire de snapshots attendus.
2. Normaliser chaque scope et paramètre avec `parseGlobalV2QueryRequest` / `parseGlobalV2QueryParams` ; clé par `globalV2QueryInstanceKey`.
3. Parcourir initial/navigation, detailEntries et destinations, les sections admissibles et méthodologies déclarées jusqu'au point fixe. Trier/canonicaliser ; rejeter les doublons contradictoires.
4. Contrôler les références internes par resource + params + scope + generation, pas seulement `instanceKey` présent. Références externes History/Operations/Entity : contrat de route existant + scope et cible, pas snapshot Global dupliqué.
5. Vérifier égalité d'ensembles entre instances atteignables, plan, required_query_keys, versions et closures. Artifacts : seulement les producteurs réellement partagés/consommés, required_artifact_keys exacts.
6. Une capability fermée donne une indisponibilité contractuelle sans fausse instance. Ajouter/supprimer une entité ou section modifie seulement les ensembles concernés ; prouver absence de reliquats de G0 après G1.

## 8. RuntimeSchemas et mutations obligatoires

Exécuter les parsers réels de fondations/outputs Analytics, `globalInitialReadModelSchema`, `importedGlobalSummaryReadModelSchema`, les dix `globalPrimaryReadModelSchemas`, tous les `globalExpandedReadModelSchemas` atteignables, les requests, le manifest et les réponses READY/ERROR. La table `registry[resource].schema` est l'owner du parsing payload ; ne pas créer de schéma parallèle de certification.

Pour chaque forme distincte : champ requis manquant, enum hors catalogue, type faux, clé extra, propriété présente undefined, hash altéré, scope/entité/génération différents, metadata absentes, capability incompatible avec visibility/knowledge, PARTIAL sans justification, CONFLICT transformé en NO_DATA. Les valeurs altérées sont passées à safeParse **et** à la frontière consommatrice réelle. Ne pas se contenter de tester une regex SHA-256.

| Mutation | Doit changer / invalider | Doit rester invariant |
|---|---|---|
| montant EconomicComponent admissible | M1, catégories et références dont fenêtre contient la source ; closure, outputs et publicationFactsHash appropriés | participation brute, autres fenêtres/personnes non concernées |
| beneficiary/share exact | sélection personnelle, M9 et consommateurs personnels | total Household, causalité et participation |
| classification M3 | ventilation/Minimal si consommée, insight/matérialité concernés | Actual et Facts non concernés |
| lien causal Moment | coût causal M6, consommateurs autorisés | spentDuring si dates/montants inchangés |
| date économique | ledger et fenêtres réellement intersectées | date bancaire, pas de causalité inventée |
| rôle/visite/localisation autoritaire | M7 et seulement providers C/D admissibles | finance Household, aucune nouvelle transaction depuis GPS |
| roster participation | M10 et consumers réellement déclarés/requis | coût/bénéficiaire non reliés, pas cycle Persona→Fact |
| Purchase/funding | nouvel acte : comptes/ticket et consumers ; funding supplémentaire du même acte : pas nouveau compte | identité achat et net inchangés si économie identique |
| policy analytique / Materiality | qualification et consumers concernés, hashes/signatures consommés | Facts monétaires bruts |
| publication policy / UI-only | republish projection / aucun recalcul métier respectivement | Analytics ; aucune altération in-place |
| champ Canonical non consommé / permutation | éventuellement identité technique de sourceRevision selon protocole | hashes d'intrants sémantiques non concernés et valeurs métier |
| nouvelle révision sans changement de vérité | identité de génération/révision | valeurs et resourceInputHash hors révision si non consommée ; pas tous les hashes arbitrairement différents |

Chaîne obligatoire : correction autoritaire synthétique → closure transitive → nouveau candidat → G1 distincte → G0 immutable → cache séparé → refresh explicite vers G1 → réponse G0 tardive refusée. Tester ancien job, stage incomplet/en trop, manifest corrompu, interruption transport/retry, conflit de révision avant activation simulée. Le rollback local sélectionne une génération complète non invalidée ; une correction métier interdit la réactivation d'une vérité invalidée. Distinguer révision de publication figée et curseur de révision courant, sans réécrire les vieux payloads.

## 9. DAG de convergence et FDR

Exécuter topologiquement A → B → C de base → E/F/G autoritaires → D → M3 enrichi → RM → Query/publication. M3 enrichi par une relation n'alimente pas à nouveau le baseline/régime qui a produit cette relation. M8 fournit des inputs à M2/M5/C, jamais leurs résultats en retour. Participation reste indépendante des résultats Persona.

Dans M5, inventorier les définitions de `relationship-catalog.ts` (baseline 10 daily, 2 weekly, 19 autres) et conserver l'examen de chacune : ACTIVE, exclue avec raison actuelle, ou future réellement indisponible. Les anciens labels DEFERRED_P08/P10 ne prouvent plus, seuls, l'indisponibilité après P12.

Recalculer l'univers commun complet pour chaque scope/corpus/révision/window touché : courant, récent six mois, précédent six mois et tests de robustesse normatifs. `closeRelationshipFdrUniverse` garde les définitions examinées non éligibles sans leur inventer p=1. Comparer avant/après : identités des définitions, disponibilité/raisons, unités/paires, p-values, q-values, exclusions et feed M3. Si tout est identique par digest, le no-op est prouvé ; un boolean `qValuesChanged=false` littéral ne le prouve pas. Une nouvelle entrée éligible oblige le replay de l'univers concerné entier, pas d'une q-value isolée.

## 10. Déterminisme, comparaisons History et performance

Même corpus/autorités/policies/asOf/révisions/implementation ⇒ mêmes résultats sémantiques, ordre éditorial et identités attendues. Variantes : ordre inversé, permutation stable, exécution séquentielle/parallèle, cache froid/chaud et ordre d'énumération. L'horloge de test est injectée ; pas d'exclusion opportuniste d'un champ hashé après échec.

History est compare-only sur : attribution Canonical identique, Actual/Minimal uniquement même scope/grain/fenêtre/méthode, séparation causal/spent HC2, manifest/immutabilité/cache réellement hérités. Interdits : agréger History RM comme source Global, moyenne des Typical, forcer 12 générations ou 947/927 snapshots, employer un oracle Minimal pour produire le payload. Une différence de contrat est documentée avant comparaison, pas tolérée silencieusement.

Mesurer par scénario : lectures Canonical par table/batch, Facts chargés/réutilisés, nombres d'instances et d'appels Query, octets initial/COMPACT/EXPANDED/détails, duplication, durée locale, hits/misses, fetchs de fond simultanés. Comparer corpus n et 2n pour identifier les lectures par ligne ; les batches bornés légitimes ne sont pas un N+1. Mesurer plutôt que promettre une latence absente du Master.

Normatif UX : prefetch à environ 1–1,5 viewport ; maximum deux fetchs de fond ; priorité directe ; COMPACT au plus un insight et 0–3 KPI ; EXPANDED au plus cinq insights. Les plafonds techniques P15 (96 Kio, 36 points, 50 lignes, etc.) doivent être distingués des seuils normatifs : ne pas tronquer une preuve requise pour les satisfaire. P14/P15 mesuraient des fixtures, pas le candidat final.

No-read-through : espionner/inhiber les vrais producteurs et repository Canonical dans le parcours Query/client après construction. Compteur attendu zéro pour READY comme pour miss, invalidation, retry et refresh. Une regex d'import ou un Proxy ne couvrant pas le vrai chemin ne suffit pas.

## 11. Ordre d'exécution destiné à P17B, après freeze fermé

Les commandes ci-dessous existent à la baseline, sauf les harness GC1 explicitement à créer. Utiliser Node du workspace ; les scripts listés sont les suites Global actuelles, pas les scripts métier V1 interdits. Aucun `npm run verify` global, backfill ou live-publication helper.

1. `git status --short`, HEAD, digests Master/index/lockfile ; clôture des bindings individuels de §3. Vérifier zéro ambiguïté de source/owner/assertion avant compteur PASS.
2. Ajouter les tests rouges R02–R09 et corriger les frontières sous leurs owners. Préparer `scripts/check-global-v2-certification.mjs` comme orchestrateur GC1 et son corpus synthétique partagé : ils n'existent pas encore et ne sont pas exécutés par P17A. Il doit refuser tout client live/mutation réelle et produire un evidence ledger par caseId, pas seulement un total.
3. `node --experimental-strip-types scripts/check-global-v2-foundations.mjs` ; puis `check-global-v2-economic-function.mjs` et `check-global-v2-category-needs-materiality.mjs` avec le même flag. Rejouer les assertions affectées par leurs corrections et les nouvelles preuves de chaîne C-A.
4. Même commande pour `check-global-v2-temporal-arbitration.mjs`, `check-global-v2-temporal-descriptive.mjs`, `check-global-v2-routines.mjs`. Ces deux premières suites ne sont pas toutes exposées dans package.json ; ne pas les oublier.
5. `node scripts/check-global-v2-moment-authority.mjs`, `node scripts/check-global-v2-place-authority.mjs`, `node scripts/check-global-v2-purchase-authority.mjs` ; suites moments/places/purchases/purchase-convergence avec `node --experimental-strip-types scripts/<nom>.mjs`. Réutiliser un résultat unitaire seulement selon §5, pas la preuve intégrée nouvelle.
6. Persona/shared-participation puis relationships/relationship-authority : suites `check-global-v2-persona.mjs`, `check-global-v2-shared-participation.mjs`, `check-global-v2-relationships.mjs`, `check-global-v2-relationship-authority.mjs`. Fermeture FDR §9 ; replay temporal/M1 si inputs consommés changent. La suite matérialité couvre les consumers de qualification concernés.
7. `node --experimental-strip-types scripts/check-global-v2-primary-readmodels.mjs`, puis `check-global-v2-query-instances.mjs`. Exécuter tous les candidats RM/Query, mutations et enumeration réelle §7–8, pas seulement la fixture 32.
8. `node --experimental-strip-types scripts/check-global-v2-publication-infrastructure.mjs` augmenté de C-E/C-F. Son état SQL actuel dépend de `GLOBAL_PGLITE_MODULE` et peut être NOT_RUN : NOT_RUN n'est pas PASS. PGlite en mémoire seulement, module résolu localement ; pas Supabase local. Test DDL actuel ≠ test DML transactionnel des vrais payloads.
9. `node --experimental-strip-types scripts/check-global-v2-frontend.mjs` puis parcours navigateur local de C-G sur transport snapshot réel/adaptateur synthétique. Corriger P16 sous owner avant validation : destinations, borne certifiée, scope/params, visite/focus/scroll, mobile/desktop, clavier, erreurs, renouvellement et réponses tardives. Ne créer aucun contournement d'auth live ; un harness local isolé n'expose que des données synthétiques. Preuve live réservée P19.
10. Régressions History actuelles uniquement par closure touchée : `check-history-v2-transversal-contracts.mjs`, `check-history-v2-month-balance.mjs`, `check-history-v2-dependency-manifest.mjs`, `check-history-v2-frozen-publication.mjs`, `check-history-v2-correction-cache.mjs` et `check-canonical-in-batching.mjs` selon propriétaire affecté. Inspecter les options du script retenu ; exclure toute variante live. Ni certification 12 mois ni anciens payloads exhaustive.
11. GC1 consolidé sur l'état enregistré : evidence ledger, candidates/manifest, mutations, déterminisme, N+1/octets. Un échec invalide ses preuves downstream ; corriger l'owner et rejouer seulement cette closure, puis consolider sur un seul état exact.
12. `node node_modules/typescript/bin/tsc --noEmit`, `node scripts/check-architecture-imports.mjs`, `node node_modules/next/dist/bin/next build`, `git diff --check`. Revue des non-suivis/secrets/données privées ; checkpoint local de P17B seulement après gates réels PASS, aucun push.

L'ordre minimise les tests coûteux avant les défauts de frontière. Il ne dispense pas du raccordement d'une exigence à une assertion précise, lacune encore ouverte dans ce freeze.

## 12. Plans P18/P19 — strictement non exécutés

### P18 : schéma

Migration actuelle : `supabase/migrations/20260906120000_global_v2_publication_infrastructure.sql`, digest §2. **Non autorisable telle quelle avant résolution R06/R07 et preuve C-F.** Tout changement local requiert un nouveau digest explicite soumis avec le diff SQL final. Ne pas réparer une migration déjà live sans en vérifier l'historique ; aucune présence/absence live Global affirmée ici.

Préconditions futures : autorisation humaine visant projet `ipuuhxrblxormwgoaqnz`, fichier/digest exact, GC1 PASS, revisions et schéma relus, HC3/HC4 réconciliées `20260904110151` puis `20260904110402` présentes. Ne jamais les réappliquer. Vérifier dépendance `history_manifest_canonical_json`, tables analytics existantes, incompatibilités concurrentes et droits avant DDL.

Objets visés par le fichier actuel : colonne nullable JSONB `analytics_publications.global_manifest`, sans default/retrofit ; fonctions `is_global_v2_publication`, `guard_global_v2_manifest`, `guard_global_v2_frozen_publication`, `guard_global_v2_frozen_content`, `attach_global_v2_manifest`, `publish_global_v2_materialization`, `restore_global_v2_publication`, `global_v2_publication_contract` ; quatre triggers `global_v2_manifest_guard`, `global_v2_frozen_publication_guard`, `global_v2_frozen_artifact_guard`, `global_v2_frozen_snapshot_guard`.

Sécurité à vérifier : security definer/search_path, EXECUTE retiré public/anon/authenticated, accordé service_role pour RPC prévues ; pas TRUNCATE/TRIGGER service_role ; RLS et ownership Household des tables existantes conservés, aucune nouvelle permission navigateur implicite. Les guards ne doivent pas intercepter indûment History ni laisser un DRAFT Global échapper au profil avant seal.

Post-DDL uniquement après autorisation : historique, digest, colonne/contraintes/guards activés, handshake `global-v2-publication@v1`, grants/RLS ; comptes, revisions, pointeurs et empreintes History/legacy avant/après inchangés ; aucun manifest ancien inventé. Diff matériel, drift, droits excessifs, effet sur anciens payloads ⇒ STOP. Retour arrière schéma n'est jamais un DROP réflexe de preuves déjà utilisées.

### P19 : publication / activation

Nouvelle autorisation humaine distincte : candidat identifié par implementation digest/SHA, Canonical frais, révisions, asOf/scopes, méthodes/policies, keys, publicationFactsHash et manifestHash. Pas de réemploi silencieux de C-A synthétique ni d'un export obsolète.

Préparer FULL_RESTAGE d'une génération Global cohérente, pas douze publications mensuelles. Ordre futur : relire révisions → Begin inactif → stage artifacts/snapshots par lots bornés → attach/seal manifest complet → read-back exact + RuntimeSchemas/closure/signatures/required keys → vérifier job/révisions courantes → finalize atomique → active read-back/residual keys → Query snapshot-only → activation de route explicitement autorisée → smoke client/live. Séparer réussite publication, activation du code et expérience utilisateur.

Transport incertain : relire état/identité avant retry, jamais créer aveuglément une nouvelle vérité. Ancien job ou drift ⇒ STOP, conserver génération active précédente cohérente. Rollback seulement vers génération complète compatible non invalidée ; vérifier pointeur/curseur et cache, sans réécrire payloads. Préserver History, neuf familles legacy et leurs consumers de rollback jusqu'à preuve de remplacement. P18 ne vaut ni publication ni activation autorisée ; P19 ne commence pas dans P17.

## 13. Critères de certification et hard stops

Master Certification (paragraphes 11564–12216) : résultat par check PASS/FAIL/NOT_APPLICABLE/NOT_RUN/BLOCKED_BY_DEPENDENCY, distinct de sévérité BLOCKING/DEGRADING/WARNING. Zéro échec blocking/degrading et tous les checks obligatoires exécutés pour le PASS du périmètre. Ne pas baisser une sévérité après test rouge. Sources de scope et anti-invention : paragraphes 12218–12294 et 12721–12738.

GC1 : toutes les capacités applicables certifiées ou correctement gated avec preuve, matrice individuelle complète, propriétaires/closures fermés, outputs et projection cohérents, aucun oracle productif, RuntimeSchemas réellement exécutés, FDR commun correct, publication locale exacte, client sans Analytics/read-through. Les preuves live P18/P19 et workflow P20 restent explicitement distinctes ; ne pas annoncer le produit entier terminé.

Hard stops : contradiction normative nouvelle ; mapping Capability supposé ; MUST sans assertion ; support/coverage inventés ; nouvelle autorité depuis label ; valeur fixture dans production ; faux no-op ; hash non lié aux intrants ; metadata/signature incompatible acceptée ; mutation d'un payload scellé ; SQL non aligné avec payload ; test obligatoire NOT_RUN présenté PASS ; toute tentative write live. Corriger les défauts techniques sous owner et recertifier, sans changer le sens métier pour gagner un test.

## 14. Exécution P17A et verdict

Effectué : inspections ciblées en lecture seule, lecture Master/contrats/rapports, inventaire Git/registry et digests ; probes synthétiques manifest enum/type, sensibilité publicationFactsHash et Query signature/policies. Aucun grand gate, GC1, build ou test navigateur exécuté. Aucun fichier produit, SQL, parser, engine, fixture ou policy modifié.

Les probes démontrent des failles de frontière, pas la correction de ces failles. Contrôles de clôture : `node node_modules/typescript/bin/tsc --noEmit` PASS (exit 0), `git diff --check` PASS, contrôle whitespace du nouveau rapport via `git diff --no-index --check -- /dev/null <rapport>` sans erreur. Ils ne valident pas GC1. Deux fichiers documentaires seulement sont présents dans le diff/non-suivis : ce rapport et `GLOBAL_EXECUTION_STATE.md`. HEAD reste inchangé ; aucun commit n'est créé sur ce freeze PARTIAL.

Questions humaines métier restantes : aucune identifiée. État initial de cet audit : trois lacunes documentaires. La reprise §15 ferme les règles de réutilisation et la qualification H5 ; la correspondance individuelle entre namespaces Capability demeure non résolue. Ce n'est pas une demande de live ni un arbitrage pour assouplir les contrats.

CURRENT_PROMPT = P17A

P17A_FREEZE_GATE = PARTIAL

IMPLEMENTATION_GATE = NOT_RUN_P17B

CONTRACT_GATE = PARTIAL_TRACEABILITY_ONLY

TEST_GATE = NOT_RUN_P17B

LIVE_GATE = NOT_RUN

LIVE_WRITES = NONE

SCHEMA_MIGRATION = NOT_RUN

PUBLICATION = NOT_RUN

CUTOVER = NOT_RUN

NEXT_PERMITTED_PROMPT = P17A_CLOSURE_ONLY

STOP — aucun P17B, P18 ou P19 exécuté par ce dossier.

## 15. Reprise P17A_CLOSURE_ONLY

Cette section précise et, en cas de différence, remplace les conclusions de fermeture documentaire antérieures. Aucun audit produit P01–P16 recommencé, aucune suite lourde, aucun correctif. Les seuls nouveaux contrôles concernent les liens d'index vers les tables du Master. Lecture OOXML en mémoire, aucun DOCX modifié.

### 15.1 Méthode de traçabilité déterministe et limites constatées

Les identités sont qualifiées par namespace, même quand leur texte commence par CAP :

- `REQ:<requirements.id>` : exigence de l'annexe A ;
- `SEM_CAP:<requirements.capabilityId>` : capacité sémantique portée par A/D ;
- `CAT_CAP:<capabilities.id>` : fiche indépendante du catalogue B ;
- `TEST:<tests.id>` : test conceptuel de l'annexe D.

Les arêtes autorisées, sans rapprochement lexical, sont exactement :

1. `REQ:r → SEM_CAP:r.capabilityId`, relation déclarée dans l'index A.
2. `TEST:t → REQ:r` pour chaque membre explicite de `t.sourceRequirementIds`. Conserver toutes les arêtes ; ne pas réduire au premier Requirement.
3. `TEST:t → SEM_CAP:t.capabilityId`, relation déclarée dans D. Ne pas exiger que ce seul champ remplace les capacités des autres Requirements référencés par un test transversal.
4. `CAT_CAP:c → SOURCE:table[c.source.tableIndex]`, uniquement localisation de la fiche, **pas** relation vers un Requirement.
5. `TEST:t → SOURCE:table[t.source.tableIndex]/row[t.source.rowIndex]`. Les indices source sont zéro-based ; valider le `testId` de la première cellule avant lecture. L'index n'enregistre pas le contenu complet Given/When/Then : le récupérer dans cette ligne du Master, sans le reconstruire depuis le titre.
6. Owner séparé pour chaque nœud : `r.owner`, `c.owner`, `t.owner`. Un test transversal garde les owners sources comme responsables des assertions, et son propre owner comme responsable d'intégration. Ne pas déplacer une autorité métier pour simplifier le test.

Résultats de la reprise : les **2 302/2 302** localisations table/row contiennent exactement leur testId attendu ; aucune exigence de l'index n'est sans référence de test. Il existe 2 047 identités SEM_CAP distinctes. Dans les **364 fiches B** référencées par l'index, aucun identifiant Requirement explicite de forme `GLO-<domaine>-<numéro>` n'est présent. La table 452 d'invariants porte bien des `sourceRequirementIds`, mais sa colonne Capability appartient au namespace SEM_CAP : elle ne fournit pas le crosswalk B manquant. Les tables finales de certification/audit présentent des contrats de preuve à remplir, pas une jointure individualisée B→A.

Ces constats ne prouvent pas qu'aucune relation sémantique ne pourrait être démontrée dans le texte intégral. Ils prouvent que la jointure mécanique déclarée manque dans les sources structurées inspectées. Associer des fiches parce qu'elles parlent toutes de M1, ont un titre voisin ou partagent un owner serait une invention de traçabilité.

#### Futurs caseId et assertions, sans prétendre les avoir exécutés

Pour chaque test `t`, réserver `GC1/<t.owner>/<t.id>`. Les slots d'assertion déterministes sont :

- `/PRECONDITIONS` : prérequis/support/coverage de la cellule 1 ;
- `/THEN` : résultat de la cellule 2, après l'action When ;
- `/FORBIDDEN` : interdit de la cellule 3 lorsqu'il est explicitement défini ;
- `/KNOWLEDGE`, `/SUPPORT` : états explicites de cette cellule ;
- `/PUBLICATION` : état de publication de la cellule 4 ;
- `/CERTIFICATION` : conséquence d'une violation, distincte de l'issue normale de l'action.

L'attendu n'est **jamais** déduit du nom du slot. Conserver le texte source, son digest et les éventuelles références de policy effectivement résolues. `expectedCertificationEffect=FAIL` indique l'effet de la violation sur la certification ; cela ne signifie pas qu'un scénario nominal doit échouer. `NONE_EXPLICIT_IN_THIS_REQUIREMENT` ne devient pas une assertion négative inventée. `AS_DEFINED_BY_REQUIREMENT` et `INHERIT_GLOBAL_*_POLICY` exigent un lien vers la clause/policy précise ; une étiquette seule n'est pas exécutable.

Pour une fiche B, réserver séparément `GC1/<c.owner>/CAT_CAP/<c.id>/PREREQUISITE`, `/AVAILABILITY`, `/PUBLICATION`, `/FORBIDDEN` depuis les champs nommés de sa fiche. Ces slots ne prouvent ni une relation B→A ni la couverture de ses résultats analytiques par un test existant.

Exemple sourcé : `TEST-GLO-M01-0075` référence explicitement `GLO-M01-007, GLO-M01-050, GLO-M01-033`. Son assertion no-lookahead peut conserver ces trois arêtes et le résultat « seuls les mois certifiés éligibles strictement antérieurs à M contribuent ». Aucun `CAT_CAP` n'est ajouté par similarité avec Typical. Exemple négatif : la fiche B table 269 décrit la sélection des insights déjà publiables, mais n'énumère aucun `GLO-AI-*` ; le lien éventuel reste non prouvé.

**GAP-XWALK-B-001** : les 364 fiches énumérées individuellement en §15.5 n'ont pas de crosswalk explicite démontré vers A/D. L'owner et la table source sont indiqués pour chaque élément. Leur attribuer seulement un futur caseId ne ferme pas le gap. Aucun de ces éléments n'est absorbé dans un total PASS.

**GAP-ASSERTION-BINDING-001** : la méthode ci-dessus fixe les emplacements futurs des assertions, pas leur résolution complète lorsque les cellules emploient des renvois génériques. Le registre de preuves ne devra pas confondre `CASE_ID_RESERVED` et `ASSERTION_BOUND`. Aucun résultat P17B n'est requis ici, mais chaque attendu applicable doit être lié à sa clause/policy avant freeze PASS. La présente reprise n'a pas établi ce binding pour chaque slot ; la localisation 2 302/2 302 ne le remplace pas.

### 15.2 Classification finale des preuves et protocole de réutilisation

Pour éviter toute déclaration sans preuve de closure, **aucune ancienne exécution P01–P16 n'est actuellement classée REUSABLE_UNCHANGED pour GC1**. Cela ne retire pas son PASS historique : une preuve GC1 de réutilisation manque. Les classifications déterminantes sont :

| Preuve | Classification finale | Suite / closure à couvrir |
|---|---|---|
| P01 unitaires/attribution | REPLAY_REQUIRED | fondations puis consumers des champs effectivement modifiés |
| P02 Finance/temps | REPLAY_REQUIRED | M1, M2, C, références et projections concernées |
| P03 catégories/matérialité | REPLAY_REQUIRED | M2, gates/sélection, consumers Finance/C/D concernés |
| P04 temporalité/fusion | REPLAY_REQUIRED | M1/C puis D/M3 enrichi sans boucle |
| P05 routines | REPLAY_REQUIRED | M4, coûts et définitions D disponibles |
| P06 relations core | REPLAY_REQUIRED | univers D actuel complet, fenêtres/robustesse puis feed M3 |
| P07 Moments | REPLAY_REQUIRED | M6 et consumers E/C/D/G réellement admissibles |
| P08 Places | REPLAY_REQUIRED ; attestation no-op seule INSUFFICIENT_FOR_GC1 | M7, FDR et consumers concernés |
| P09 Purchase | REPLAY_REQUIRED | M8, funding/déduplication et projections |
| P10 convergence | REPLAY_REQUIRED ; boolean no-op seul INSUFFICIENT_FOR_GC1 | M8→M2/C/D et univers FDR impactés |
| P11 Persona | REPLAY_REQUIRED ; couverture conceptuelle groupée INSUFFICIENT_FOR_GC1 | M9 et projection, attribution/intérsection réelles |
| P12 Shared/Social | REPLAY_REQUIRED ; absence d'edge seule INSUFFICIENT_FOR_GC1 | M10, obligations transverses C/D/M9, indépendance causale |
| P13 coordinateur/DDL | INSUFFICIENT_FOR_GC1 | cycle transactionnel local avec vrais payloads P14/P15 |
| P14 builders | REPLAY_REQUIRED | outputs analytiques → projection → sélection/schemas |
| P15 Query | INSUFFICIENT_FOR_GC1 | manifest unique → store → Query/cache, toutes instances |
| P16 frontend | INSUFFICIENT_FOR_GC1 | vrai chemin client local sur snapshots synthétiques, R13–R15 |
| P13–P16 disponibilité et fonctionnement live | LIVE_PROOF_REQUIRED_LATER | P18 schéma puis P19 publication/client sous autorisations |
| Formulation P16 autorisant implicitement le live P17 | SUPERSEDED | clarification humaine P17A ; aucune exécution à rejouer |

Les arbitrages humains et textes normatifs restent des **sources**, pas des résultats exécutables REUSABLE_UNCHANGED. Le classement REPLAY_REQUIRED peut être affiné en réutilisation au niveau d'un caseId selon le protocole suivant, sans nouveau raisonnement métier :

1. Retrouver l'attestation historique : commande exacte, résultat, checkpoint code testé, fixture, options/runtime et assertion réellement exécutée. Si un champ n'est pas prouvé : REPLAY_REQUIRED. Une assertion qui n'existait pas : INSUFFICIENT_FOR_GC1.
2. Résoudre la closure transitive de l'entrée de test : imports directs/transitifs et réexports, loaders/hooks, fichiers lus dynamiquement, fixtures, source authority mappings, policies, parsers, configuration de résolution et dépendances externes/lockfile. Un accès dynamique non résolu ou un import optionnel non caractérisé interdit la réutilisation.
3. Pour chaque version, calculer SHA-256 de chaque fichier réellement exécuté/lu, sans normaliser son contenu, puis le SHA-256 de la liste triée `[path,sha256]` sérialisée de façon canonique. Ajouter commande, flags, version Node, plateforme pertinente, digests Master/index/policies/fixtures dans l'identité de preuve. Pour les sources historiques, lire les blobs par `git show <checkpoint>:<path>`; pour le working tree, lire les octets actuels. Ne pas hasher les secrets ni leurs valeurs dans Git.
4. Comparer contenu ET ensemble des chemins ET configuration. Même valeur finale avec closure différente ne prouve pas invariance. Le lockfile changé est conservativement un replay sauf sous-closure externe versionnée démontrée.
5. Exiger aussi la même propriété testée et le même domaine de validité. Une nouvelle exigence cross-module, une nouvelle instance ou un nouveau support GC1 exige son test même si tous les fichiers anciens sont identiques.
6. Écrire la décision par caseId avec historique/current digests et motif. Seule l'égalité complète avec evidence historique vérifiable autorise REUSABLE_UNCHANGED. Sinon exécuter le test concerné et recertifier la closure aval consommée, pas toutes les anciennes données History.

L'absence d'archives historiques suffisamment détaillées ne nécessite aucun arbitrage : elle choisit mécaniquement REPLAY_REQUIRED. Ce protocole ferme la stratégie de réutilisation sans relancer ici les suites.

### 15.3 Entrée H5/P16 explicitement qualifiée

**Choix retenu : P16 reste un checkpoint historique valide mais INSUFFICIENT_FOR_GC1.** R13–R15 sont des défauts techniques bornés, corrigibles dans P17B sous owner P16. Aucun nouveau choix de doctrine n'est requis pour injecter le bon transport, lire la vraie borne du RM, suivre les destinations certifiées ou prouver le comportement clavier/visite.

Ils ne bloquent pas en eux-mêmes le commencement de P17B après freeze documentaire PASS. Ils bloquent le PASS GC1 jusqu'à correction et preuve. Ne pas exiger une mission P16 bis ni un re-PASS artificiel pour démarrer les corrections P17B. Un navigateur live indisponible est PENDING_P19 ; un comportement local non implémenté n'est pas une preuve live différable.

### 15.4 Attribution exécutable des défauts R02–R15

Les caseId ci-dessous sont réservés à des **tests rouges futurs**, non exécutés pendant cette reprise. Les corrections restent P17B, aucun fichier produit n'est modifié ici.

| Risque / futur caseId | Owner | Test rouge attendu | Correction attendue | Closure à rejouer |
|---|---|---|---|---|
| R02 / GC1/P13/R02/DEPENDENCY_TYPES | P13 + parser partagé P01 si touché | authority hors enum ou required non boolean accepté ⇒ FAIL | validation stricte au vrai parser | manifest, seal/store, Query consommateur |
| R03 / GC1/P13/R03/INPUT_BINDING | P13 | input significatif altéré et hash incohérent accepté ⇒ FAIL | dériver et vérifier les digests/closures consommées | candidats propriétaires affectés, publication, Query |
| R04 / GC1/P15/R04/REGISTRY_SIGNATURE | P15 | envelope/payload accordés mais signature/policies incompatibles registre ⇒ doit refuser | vérifier identité attendue, pas boolean fournisseur seul | registry, plan, runtime, cache/client |
| R05 / GC1/P15/R05/REQUEST_BINDING | P15 | mauvais scope/entity/params ou panne attendue échappe au contrat local | lier réponse à requête normalisée, mapper erreurs attendues | Query, génération épinglée, UI erreurs |
| R06 / GC1/P13/R06/STORAGE_PROFILE | P13/P15 | vrais noms/versions avant et après seal mal classés/rejetés | contrat storage/resource explicite et profil exact | SQL mémoire, History/legacy isolation, plan/query |
| R07 / GC1/P13/R07/META_ROUNDTRIP | P13/P15 | vrai RM échoue validation SQL par chemin metadata faux | aligner l'adaptateur et les contrôles sans copies divergentes | vrais payloads→SQL mémoire→read-back→Query |
| R08 / GC1/P13/R08/ONE_MANIFEST | P13/P15 | hash attach différent du payload accepté ou nécessite patch | assemblage déterministe non circulaire, metadata uniques avant seal | RM, plan, store, Query, immutable generations |
| R09 / GC1/P15/R09/REACHABLE_SET | P15 | destination mauvaise params mais clé présente, instance omise/en trop | fermeture exacte depuis destinations/capabilities | enumeration, manifest, residual, client navigation |
| R10 / GC1/P13/R10/TRANSITIVE_INVALIDATION | P13 + owners des policies | consumer transitif oublié ou policy analytique traitée éditoriale | propagation typée par champs/scopes/windows, distinction actions | owners réellement affectés puis RM/publication/cache |
| R11 / GC1/P06/R11/FDR_UNIVERSE | P06 avec P08/P10/P12 | provider/éligibilité change mais no-op forcé | examen actuel des définitions, replay univers commun, hashes preuves | D fenêtres/robustesse, M3 enrichi, projections |
| R12 / GC1/P14/R12/ANALYTICS_TO_RM | P14/P15 et owner Analytics concerné | valeur/limitation RM sans output qualifié source | adaptateurs de projection sans recalcul métier | M1–M10 consommés, schemas, plan/publication |
| R13 / GC1/P16/R13/TRANSPORT_BOUNDARY | P16/P15 | fixtures productives ou date codée au lieu du RM | transport snapshot-only injectable, borne autoritaire, activation toujours différée | RM metadata, Query, client/hydratation/build |
| R14 / GC1/P16/R14/DESTINATION_BEHAVIOR | P16/P15 | deux entités ouvrent le même faux détail ou perdent scope/génération | consommation des destinations, deep links et restauration visite | request/instances, DOM/navigation/focus/cache |
| R15 / GC1/P16/R15/UX_EVIDENCE | P16 | comportement absent malgré regex/compteur vert | tests actions/DOM/réseau pour chaque obligation applicable | matrice UX individuelle, runtime local, build final |

Les tests des R03/R05/R08–R12 doivent d'abord préciser l'observation actuelle ; un risque PROOF_REQUIRED n'est pas présenté comme un test rouge déjà exécuté. Si l'invariant tient sur le vrai chemin, conserver la preuve, pas une correction inutile. R02/R04 sont déjà appuyés par les probes antérieurs.

### 15.5 Gaps individuels du catalogue B

Chaque ligne signifie : `GAP-XWALK-B:<id>`, namespace CAT_CAP, relation vers REQ/SEM_CAP/TEST non démontrée. Source : table OOXML indiquée, Master digest §2 ; futur caseId propre à la fiche selon §15.1. Aucune ligne n'est déclarée couverte par un test A/D sur la base du nom ou de l'owner.

| CAT_CAP non reliée | Owner déclaré | Table source |
|---|---|---|
| CAP-AI-001 | P14 | 269 |
| CAP-AI-002 | P20 | 270 |
| CAP-AI-003 | P14 | 271 |
| CAP-AI-004 | P20 | 272 |
| CAP-AI-005 | P20 | 273 |
| CAP-AI-006 | P20 | 274 |
| CAP-AI-007 | P20 | 275 |
| CAP-AI-008 | P20 | 276 |
| CAP-AI-009 | P20 | 277 |
| CAP-AI-010 | P20 | 278 |
| CAP-AI-011 | P20 | 279 |
| CAP-AI-012 | P20 | 280 |
| CAP-AI-013 | P20 | 281 |
| CAP-AI-014 | P20 | 282 |
| CAP-AI-015 | P20 | 283 |
| CAP-AI-016 | P20 | 284 |
| CAP-AI-017 | P20 | 285 |
| CAP-AI-018 | P15 | 286 |
| CAP-AI-019 | P20 | 287 |
| CAP-AI-020 | P20 | 288 |
| CAP-AI-021 | P20 | 289 |
| CAP-AI-022 | P20 | 290 |
| CAP-AI-023 | P20 | 291 |
| CAP-AI-024 | P20 | 292 |
| CAP-AI-025 | P20 | 293 |
| CAP-AI-026 | P20 | 294 |
| CAP-CERT-001 | P17 | 351 |
| CAP-CERT-002 | P17 | 352 |
| CAP-CERT-003 | P17 | 353 |
| CAP-CERT-004 | P17 | 354 |
| CAP-CERT-005 | P02 | 355 |
| CAP-CERT-006 | P17 | 356 |
| CAP-CERT-007 | P17 | 357 |
| CAP-CERT-008 | P17 | 358 |
| CAP-CERT-009 | P17 | 359 |
| CAP-CERT-010 | P17 | 360 |
| CAP-CERT-011 | P17 | 361 |
| CAP-ENG-001 | T01 | 58 |
| CAP-ENG-002 | T01 | 59 |
| CAP-ENG-003 | T01 | 60 |
| CAP-ENG-004 | T01 | 61 |
| CAP-ENG-005 | P04 | 62 |
| CAP-ENG-006 | P03 | 63 |
| CAP-ENG-007 | P14 | 64 |
| CAP-ENG-008 | P04 | 65 |
| CAP-ENG-009 | P05 | 66 |
| CAP-ENG-010 | P06 | 67 |
| CAP-ENG-011 | P07 | 68 |
| CAP-ENG-012 | P08 | 69 |
| CAP-ENG-013 | P09 | 70 |
| CAP-ENG-014 | P09 | 71 |
| CAP-ENG-015 | P11 | 72 |
| CAP-ENG-016 | P12 | 73 |
| CAP-ENG-017 | P13 | 74 |
| CAP-ENG-018 | P20 | 75 |
| CAP-ENG-019 | T01 | 76 |
| CAP-ENG-020 | P05 | 77 |
| CAP-ENG-021 | P08 | 78 |
| CAP-ENG-022 | P10 | 79 |
| CAP-ENG-023 | P10 | 80 |
| CAP-ENG-024 | P10 | 81 |
| CAP-ENG-025 | P12 | 82 |
| CAP-FND-001 | P17 | 23 |
| CAP-FND-002 | P01 | 24 |
| CAP-FND-003 | P01 | 25 |
| CAP-FND-004 | P01 | 26 |
| CAP-FND-005 | P20 | 27 |
| CAP-FND-006 | P01 | 28 |
| CAP-FND-007 | P01 | 29 |
| CAP-FND-008 | P17 | 30 |
| CAP-FND-009 | P01 | 31 |
| CAP-FND-010 | P01 | 32 |
| CAP-FND-011 | P13 | 33 |
| CAP-FND-012 | P01 | 34 |
| CAP-FND-013 | P01 | 35 |
| CAP-FND-014 | P01 | 36 |
| CAP-FND-015 | P01 | 37 |
| CAP-FND-016 | P01 | 38 |
| CAP-FND-017 | P01 | 39 |
| CAP-FND-018 | P01 | 40 |
| CAP-FND-019 | P01 | 41 |
| CAP-FND-020 | P01 | 42 |
| CAP-FND-021 | P01 | 43 |
| CAP-FND-022 | P01 | 44 |
| CAP-FND-023 | P02 | 45 |
| CAP-FND-024 | P02 | 46 |
| CAP-FND-025 | P01 | 47 |
| CAP-FND-026 | P01 | 48 |
| CAP-FND-027 | P01 | 49 |
| CAP-FND-028 | P13 | 50 |
| CAP-FND-029 | P14 | 51 |
| CAP-FND-030 | P01 | 52 |
| CAP-FND-031 | P15 | 53 |
| CAP-FND-032 | P15 | 54 |
| CAP-FND-033 | P13 | 55 |
| CAP-FND-034 | P01 | 56 |
| CAP-FND-035 | P17 | 57 |
| CAP-FORB-001 | T01 | 367 |
| CAP-FORB-002 | T01 | 368 |
| CAP-FORB-003 | T01 | 369 |
| CAP-FORB-004 | T01 | 370 |
| CAP-FORB-005 | P20 | 371 |
| CAP-FORB-006 | P12 | 372 |
| CAP-FORB-007 | P12 | 373 |
| CAP-FORB-008 | T01 | 374 |
| CAP-FORB-009 | T01 | 375 |
| CAP-FORB-010 | T01 | 376 |
| CAP-FORB-011 | T01 | 377 |
| CAP-FORB-012 | T01 | 378 |
| CAP-FORB-013 | P20 | 379 |
| CAP-FORB-014 | T01 | 380 |
| CAP-FORB-015 | T01 | 381 |
| CAP-FORB-016 | T01 | 382 |
| CAP-FORB-017 | P20 | 383 |
| CAP-FORB-018 | T01 | 384 |
| CAP-INV-001 | P13 | 339 |
| CAP-INV-002 | P13 | 340 |
| CAP-INV-003 | P13 | 341 |
| CAP-INV-004 | P13 | 342 |
| CAP-INV-005 | P13 | 343 |
| CAP-INV-006 | P13 | 344 |
| CAP-INV-007 | P13 | 345 |
| CAP-INV-008 | P13 | 346 |
| CAP-INV-009 | P13 | 347 |
| CAP-INV-010 | P13 | 348 |
| CAP-INV-011 | P13 | 349 |
| CAP-INV-012 | P13 | 350 |
| CAP-LATER-001 | T01 | 362 |
| CAP-LATER-002 | T01 | 363 |
| CAP-LATER-003 | T01 | 364 |
| CAP-LATER-004 | T01 | 365 |
| CAP-LATER-005 | T01 | 366 |
| CAP-M01-001 | P02 | 83 |
| CAP-M01-002 | P02 | 84 |
| CAP-M01-003 | P02 | 85 |
| CAP-M01-004 | P02 | 86 |
| CAP-M01-005 | P02 | 87 |
| CAP-M01-006 | P02 | 88 |
| CAP-M01-007 | P02 | 89 |
| CAP-M01-008 | P02 | 90 |
| CAP-M01-009 | P02 | 91 |
| CAP-M01-010 | P02 | 92 |
| CAP-M01-011 | P02 | 93 |
| CAP-M01-012 | P02 | 94 |
| CAP-M01-013 | P02 | 95 |
| CAP-M01-014 | P02 | 96 |
| CAP-M01-015 | P02 | 97 |
| CAP-M01-016 | P02 | 98 |
| CAP-M01-017 | P02 | 99 |
| CAP-M01-018 | P02 | 100 |
| CAP-M01-019 | P02 | 101 |
| CAP-M02-001 | P03 | 102 |
| CAP-M02-002 | P03 | 103 |
| CAP-M02-003 | P03 | 104 |
| CAP-M02-004 | P03 | 105 |
| CAP-M02-005 | P03 | 106 |
| CAP-M02-006 | P03 | 107 |
| CAP-M02-007 | P03 | 108 |
| CAP-M02-008 | P03 | 109 |
| CAP-M02-009 | P03 | 110 |
| CAP-M02-010 | P03 | 111 |
| CAP-M02-011 | P03 | 112 |
| CAP-M03-001 | P04 | 113 |
| CAP-M03-002 | P04 | 114 |
| CAP-M03-003 | P04 | 115 |
| CAP-M03-004 | P04 | 116 |
| CAP-M03-005 | P04 | 117 |
| CAP-M03-006 | P04 | 118 |
| CAP-M03-007 | P04 | 119 |
| CAP-M03-008 | P04 | 120 |
| CAP-M03-009 | P04 | 121 |
| CAP-M03-010 | P04 | 122 |
| CAP-M03-011 | P04 | 123 |
| CAP-M03-012 | P04 | 124 |
| CAP-M04-001 | P05 | 125 |
| CAP-M04-002 | P05 | 126 |
| CAP-M04-003 | P05 | 127 |
| CAP-M04-004 | P05 | 128 |
| CAP-M04-005 | P05 | 129 |
| CAP-M04-006 | P05 | 130 |
| CAP-M04-007 | P05 | 131 |
| CAP-M04-008 | P05 | 132 |
| CAP-M04-009 | P05 | 133 |
| CAP-M04-010 | P05 | 134 |
| CAP-M04-011 | P05 | 135 |
| CAP-M04-012 | P05 | 136 |
| CAP-M04-013 | P05 | 137 |
| CAP-M05-001 | P06 | 138 |
| CAP-M05-002 | P06 | 139 |
| CAP-M05-003 | P06 | 140 |
| CAP-M05-004 | P06 | 141 |
| CAP-M05-005 | P06 | 142 |
| CAP-M05-006 | P06 | 143 |
| CAP-M05-007 | P06 | 144 |
| CAP-M05-008 | P06 | 145 |
| CAP-M05-009 | P06 | 146 |
| CAP-M05-010 | P06 | 147 |
| CAP-M05-011 | P06 | 148 |
| CAP-M05-012 | P06 | 149 |
| CAP-M05-013 | P06 | 150 |
| CAP-M05-014 | P06 | 151 |
| CAP-M06-001 | P07 | 152 |
| CAP-M06-002 | P07 | 153 |
| CAP-M06-003 | P07 | 154 |
| CAP-M06-004 | P07 | 155 |
| CAP-M06-005 | P07 | 156 |
| CAP-M06-006 | P02 | 157 |
| CAP-M06-007 | P07 | 158 |
| CAP-M06-008 | P07 | 159 |
| CAP-M06-009 | P07 | 160 |
| CAP-M06-010 | P07 | 161 |
| CAP-M06-011 | P07 | 162 |
| CAP-M06-012 | P07 | 163 |
| CAP-M06-013 | P07 | 164 |
| CAP-M07-001 | P08 | 165 |
| CAP-M07-002 | P08 | 166 |
| CAP-M07-003 | P08 | 167 |
| CAP-M07-004 | P08 | 168 |
| CAP-M07-005 | P08 | 169 |
| CAP-M07-006 | P08 | 170 |
| CAP-M07-007 | P08 | 171 |
| CAP-M07-008 | P08 | 172 |
| CAP-M07-009 | P08 | 173 |
| CAP-M07-010 | P08 | 174 |
| CAP-M07-011 | P08 | 175 |
| CAP-M07-012 | P08 | 176 |
| CAP-M07-013 | P08 | 177 |
| CAP-M07-014 | P08 | 178 |
| CAP-M07-015 | P08 | 179 |
| CAP-M07-016 | P08 | 180 |
| CAP-M07-017 | P08 | 181 |
| CAP-M07-018 | P08 | 182 |
| CAP-M07-019 | P08 | 183 |
| CAP-M07-020 | P08 | 184 |
| CAP-M07-021 | P08 | 185 |
| CAP-M07-022 | P08 | 186 |
| CAP-M07-023 | P08 | 187 |
| CAP-M07-024 | P08 | 188 |
| CAP-M07-025 | P08 | 189 |
| CAP-M07-026 | P08 | 190 |
| CAP-M07-027 | P08 | 191 |
| CAP-M08-001 | P09 | 192 |
| CAP-M08-002 | P09 | 193 |
| CAP-M08-003 | P09 | 194 |
| CAP-M08-004 | P09 | 195 |
| CAP-M08-005 | P09 | 196 |
| CAP-M08-006 | P02 | 197 |
| CAP-M08-007 | P09 | 198 |
| CAP-M08-008 | P09 | 199 |
| CAP-M08-009 | P09 | 200 |
| CAP-M08-010 | P09 | 201 |
| CAP-M08-011 | P09 | 202 |
| CAP-M08-012 | P09 | 203 |
| CAP-M08-013 | P09 | 204 |
| CAP-M08-014 | P09 | 205 |
| CAP-M08-015 | P09 | 206 |
| CAP-M08-016 | P09 | 207 |
| CAP-M08-017 | P10 | 208 |
| CAP-M08-018 | P10 | 209 |
| CAP-M08-019 | P10 | 210 |
| CAP-M08-020 | P10 | 211 |
| CAP-M08-021 | P10 | 212 |
| CAP-M08-022 | P10 | 213 |
| CAP-M08-023 | P10 | 214 |
| CAP-M08-024 | P10 | 215 |
| CAP-M08-025 | P10 | 216 |
| CAP-M08-026 | P10 | 217 |
| CAP-M08-027 | P10 | 218 |
| CAP-M09-001 | P11 | 219 |
| CAP-M09-002 | P11 | 220 |
| CAP-M09-003 | P11 | 221 |
| CAP-M09-004 | P11 | 222 |
| CAP-M09-005 | P11 | 223 |
| CAP-M09-006 | P11 | 224 |
| CAP-M09-007 | P11 | 225 |
| CAP-M09-008 | P11 | 226 |
| CAP-M09-009 | P11 | 227 |
| CAP-M09-010 | P11 | 228 |
| CAP-M09-011 | P11 | 229 |
| CAP-M09-012 | P11 | 230 |
| CAP-M09-013 | P11 | 231 |
| CAP-M09-014 | P11 | 232 |
| CAP-M09-015 | P11 | 233 |
| CAP-M09-016 | P11 | 234 |
| CAP-M09-017 | P02 | 235 |
| CAP-M10-001 | P12 | 236 |
| CAP-M10-002 | P12 | 237 |
| CAP-M10-003 | P12 | 238 |
| CAP-M10-004 | P12 | 239 |
| CAP-M10-005 | P12 | 240 |
| CAP-M10-006 | P12 | 241 |
| CAP-M10-007 | P12 | 242 |
| CAP-M10-008 | P12 | 243 |
| CAP-M10-009 | P12 | 244 |
| CAP-M10-010 | P12 | 245 |
| CAP-M10-011 | P12 | 246 |
| CAP-M10-012 | P12 | 247 |
| CAP-M10-013 | P12 | 248 |
| CAP-M10-014 | P12 | 249 |
| CAP-M10-015 | P12 | 250 |
| CAP-M10-016 | P12 | 251 |
| CAP-M10-017 | P12 | 252 |
| CAP-M10-018 | P12 | 253 |
| CAP-M10-019 | P12 | 254 |
| CAP-M10-020 | P12 | 255 |
| CAP-PH-001 | P18 | 385 |
| CAP-PH-002 | P17 | 386 |
| CAP-PUB-001 | P13 | 326 |
| CAP-PUB-002 | P13 | 327 |
| CAP-PUB-003 | P13 | 328 |
| CAP-PUB-004 | P14 | 329 |
| CAP-PUB-005 | P13 | 330 |
| CAP-PUB-006 | P13 | 331 |
| CAP-PUB-007 | P13 | 332 |
| CAP-PUB-008 | P13 | 333 |
| CAP-PUB-009 | P13 | 334 |
| CAP-PUB-010 | P13 | 335 |
| CAP-PUB-011 | P13 | 336 |
| CAP-PUB-012 | P13 | 337 |
| CAP-PUB-013 | P13 | 338 |
| CAP-SOC-001 | P12 | 256 |
| CAP-SOC-002 | P12 | 257 |
| CAP-SOC-003 | P12 | 258 |
| CAP-SOC-004 | P12 | 259 |
| CAP-SOC-005 | P12 | 260 |
| CAP-SOC-006 | P12 | 261 |
| CAP-SOC-007 | P12 | 262 |
| CAP-SOC-008 | P12 | 263 |
| CAP-SOC-009 | P12 | 264 |
| CAP-SOC-010 | P12 | 265 |
| CAP-SOC-011 | P12 | 266 |
| CAP-SOC-012 | P12 | 267 |
| CAP-SOC-013 | P12 | 268 |
| CAP-UX-001 | P16 | 295 |
| CAP-UX-002 | P16 | 296 |
| CAP-UX-003 | P16 | 297 |
| CAP-UX-004 | P16 | 298 |
| CAP-UX-005 | P16 | 299 |
| CAP-UX-006 | P16 | 300 |
| CAP-UX-007 | P16 | 301 |
| CAP-UX-008 | P16 | 302 |
| CAP-UX-009 | P16 | 303 |
| CAP-UX-010 | P14 | 304 |
| CAP-UX-011 | P16 | 305 |
| CAP-UX-012 | P15 | 306 |
| CAP-UX-013 | P16 | 307 |
| CAP-UX-014 | P16 | 308 |
| CAP-UX-015 | P16 | 309 |
| CAP-UX-016 | P16 | 310 |
| CAP-UX-017 | P16 | 311 |
| CAP-UX-018 | P16 | 312 |
| CAP-UX-019 | P16 | 313 |
| CAP-UX-020 | P16 | 314 |
| CAP-UX-021 | P16 | 315 |
| CAP-UX-022 | P16 | 316 |
| CAP-UX-023 | P16 | 317 |
| CAP-UX-024 | P16 | 318 |
| CAP-UX-025 | P16 | 319 |
| CAP-UX-026 | P16 | 320 |
| CAP-UX-027 | P16 | 321 |
| CAP-UX-028 | P16 | 322 |
| CAP-UX-029 | P16 | 323 |
| CAP-UX-030 | P16 | 324 |
| CAP-UX-031 | P16 | 325 |

### 15.6 Verdict de reprise

- Classification des preuves/closure : CLOSED_STRATEGY, aucune ancienne exécution promue sans preuve.
- Qualification entrée P16 : CLOSED_STRATEGY ; corrections R13–R15 dans P17B, pas de re-PASS préalable.
- R02–R15 : travaux P17B attribués avec tests et closures.
- Traçabilité : PARTIAL. Les arêtes A/D et leurs localisations sont mécaniques ; le crosswalk B→A/D et le binding complet des assertions restent non démontrés. Réserver des IDs n'est pas les fermer.
- Questions humaines métier : 0 identifiée ; aucune autorité ouverte.
- Contrôles de cette reprise : lectures d'index/annexes et diff-check seulement. Aucun GC1, build, suite lourde, live ou mutation produit.
- Aucun commit ni push créé ; modifications documentaires conservées.

P17A_FREEZE_GATE = PARTIAL

IMPLEMENTATION_GATE = NOT_RUN_P17B

CONTRACT_GATE = PARTIAL_TRACEABILITY_ONLY

TEST_GATE = NOT_RUN_P17B

LIVE_GATE = NOT_RUN

LIVE_WRITES = NONE

NEXT_PERMITTED_PROMPT = P17A_CLOSURE_ONLY

STOP.

## 16. P17B — matérialisation de la closure du handoff (2026-09-07)

Cette section est chronologiquement postérieure au verdict de freeze ci-dessus et le remplace pour le handoff exécuté. Elle ne réécrit pas les limites historiques de P17A.

- Le ledger individuel est matérialisé dans `P17-evidence-ledger.json` depuis `GLOBAL_MASTER_INDEX.json` : 2 047 Requirements, 2 302 tests conceptuels et 364 CAT_CAP.
- REQ, SEM_CAP, TEST et CAT_CAP restent des namespaces distincts. Les 364 CAT_CAP conservent `NO_EXPLICIT_CROSSWALK_BY_SOURCE`; aucune jointure par nom, ordre, suffixe ou similarité n'est ajoutée.
- Les arêtes Requirement → Test et leurs owners/caseId sont exclusivement celles déclarées dans l'index du Master. Le ledger porte un digest global déterministe et un digest par preuve.
- Le résultat de traçabilité n'est pas confondu avec une exécution comportementale : les exécutions P17B sont consignées séparément dans `P17-report.md`.
- R02–R15 sont corrigés et recertifiés dans P17B ; P16 demeure un checkpoint historique, ses défauts techniques bornés étant fermés sous son owner.
- Questions humaines métier restantes pour le handoff : 0. Les seules autorisations restantes sont opérationnelles et live, pour P18/P19.

P17A_FREEZE_GATE = PASS

IMPLEMENTATION_GATE = NOT_RUN_P17B

CONTRACT_GATE = PASS

TEST_GATE = NOT_RUN_P17B

LIVE_GATE = NOT_RUN

LIVE_WRITES = NONE

NEXT_PERMITTED_PROMPT = P17B

STOP.
