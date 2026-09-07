# P10A — Produits et convergence : freeze d'exécution P10B

## 1. Baseline, autorité et portée de la preuve

- Date : 2026-09-06. Branche : `main`. HEAD de code : `3c09ea111f84d87a6bb95a82f49885cf3488d522`. Working tree propre à l'entrée.
- P09 F1/F2 core : PASS ; 66/66 M8, 29/29 adapter, typecheck, architecture et build documentés dans `P09-report.md`. Ces suites ne sont pas réexécutées dans P10A.
- `GLOBAL_EXECUTION_CONTRACT.md` C01–C14 et `AGENTS.md` lus. Freeze documentaire seulement, aucun code produit modifié.
- Master : `Brief_Technique_Analyse_Globale_V2_FINAL_EXHAUSTIF_MASTER.docx`, SHA-256 vérifié `8b0d0ff2381599c4495645cd1dd1ebf2fa0d027fc3113be78aee945fae12f8be`, identique à `GLOBAL_MASTER_INDEX.json`.
- Sections relues : M8 identité produit jusqu'à décision finale ; Scope V1 M8 ; registre AG012–AG022. Les références `P` ci-dessous comptent les paragraphes directs du document à partir de 1. L'index existant utilise des anchors à partir de 0 : conserver ses anchors et IDs, ne pas créer un nouvel index normatif.
- Sources physiques : GA0, freeze A1, matrice de dépendances, rapports P03/P06/P08/P09 ; Facts, adaptateurs Canonical et consommateurs B/C/D actuels inspectés.
- Pas de nouvelle lecture Supabase. Les comptes 72 items / 18 observations produit / 7 prix de GA0 et zéro Purchase Event du rapport History sont des mesures historiques, pas des comptes live revalidés aujourd'hui. Le constat actuel vérifié est l'absence de provider produit autoritaire raccordé dans ce HEAD. Un éventuel changement live ne devient pas silencieusement une capacité active.

## 2. Décision principale F3/F4

Le Scope V1 final du Master, P12458–12489, distingue explicitement :

1. Purchase/Merchant core MUST_V1, implémenté P09 sous autorité de données.
2. **Merchant substitution : CONDITIONAL_V1 / DATA_GATED.** Son moteur et ses tests de données absentes doivent être réalisés en P10B ; il ne dépend pas obligatoirement d'une identité produit.
3. Lignes/identités/unités/acquisitions/cadence/lifecycle/substitution produit/indice personnel : **CONDITIONAL_V1 / AUTHORITY_GATED**. Le comportement de fermeture est exigible maintenant ; leurs moteurs positifs ne deviennent exigibles qu'après fermeture officielle des autorités.

F3 peut donc être certifié comme contrat de capacités fermées, sans annoncer un moteur produit actif. F4 exige la convergence Purchase/Merchant disponible, les tests négatifs produit et la preuve B/C/D. Ne pas conserver le simple `DEFERRED_P10` de P09 comme conclusion finale du lot : le remplacer dans la sortie de convergence par les raisons d'autorité explicites, sans altérer rétroactivement le rapport P09.

## 3. Matrice des autorités et gates

| Capacité | Classe réelle P10A | Preuve physique / normative | Sortie attendue P10B |
|---|---|---|---|
| Contrats Purchase/Merchant et euros | AVAILABLE_AND_REQUIRED | `purchases.ts`, `PurchaseEventFact`, ECF, P09 | réutiliser ; aucune seconde identité ou formule |
| Exécution Purchase sur données historiques absentes | DATA_GATED_IMPLEMENTABLE | adapter P09 + derniers rapports de source | absence explicite ; zéro interne n'est pas une affirmation de non-achat |
| Enrichissement M2 fréquence/ticket | DATA_GATED_IMPLEMENTABLE | `decomposeGlobalPurchaseFrequencyTicket`, hook M2 existant | raccorder sur événements retenus et univers compatibles ; indisponible sinon |
| Substitution marchand | DATA_GATED_IMPLEMENTABLE | Master P6633–6698 et P12478–12480 | moteur conditionnel testé sur univers d'alternatives explicitement fourni ; aucune classification par label |
| PurchaseLineFact | AUTHORITY_GATED_UNAVAILABLE | AG012 ; Fact absent ; operation_items n'est pas une ligne produit | UNAVAILABLE, raison et gate, aucun faux Fact |
| ProductFamily | AUTHORITY_GATED_UNAVAILABLE | AG013 ; aucune identité analytique Canonical raccordée | ni catégorie ni marchand ni texte comme famille |
| ProductVariant | AUTHORITY_GATED_UNAVAILABLE | AG014 | aucun regroupement lexical ou assimilation family→variant |
| ProductFormat / MerchantSKU | AUTHORITY_GATED_UNAVAILABLE | AG015 ; format non résolu, SKU marchand non universel | aucun pack/taille présumés |
| Unité normalisée / comparison key | AUTHORITY_GATED_UNAVAILABLE | AG016 / AG003 | aucun kg/L/unit/dose inventé ; mode indisponible |
| ProductAcquisitionOccurrence | AUTHORITY_GATED_UNAVAILABLE | AG017 | pas d'occurrence depuis prix, quantité ou item bancaire |
| Cadence / PurchaseCycleEngine | AUTHORITY_GATED_UNAVAILABLE | AG002/AG018 | aucune cadence depuis paiements ; UNKNOWN/UNAVAILABLE |
| FIRST_OBSERVED / adoption / lifecycle | AUTHORITY_GATED_UNAVAILABLE | AG019 | FIRST_OBSERVED requiert encore une acquisition autoritaire ; absence brute insuffisante |
| Substitution produit | AUTHORITY_GATED_UNAVAILABLE | AG020 | aucune substitution sans rôle compatible et identités |
| Prix, panier apparié, Törnqvist, prix/quantité/mix | AUTHORITY_GATED_UNAVAILABLE | AG003/004/021 | indice absent ; ne pas retourner 0 % |
| PersonalReferenceCost enrichi | DEFERRED_BY_CONTRACT | AG022, owner Persona ultérieur | aucun recalcul P10 ; conserver dépendance future |
| Ouverture physique des autorités produit | REQUIRES_T01 | registre `authority-gates.ts` encore fermé | mission d'autorité séparée : mapping, sources, contrats, gates, tests ; aucune migration ici |
| Relation M5 visite→achat localisé | AUTHORITY_GATED_UNAVAILABLE | `specific-place-visit-localized-purchase`, P09 sans lien visite/personne/comparateur | exclusion examinée et conservée dans FDR |

Les autorités de `purchaseAt`, univers eligible-purchase, attribution personnelle complète et univers d'alternatives marchand ne sont pas prouvées par un PurchaseEvent non vide. Le moteur substitution accepte une entrée de catalogue explicitement versionnée ; **aucune affectation réelle marchand→univers n'est créée**. Si un provider Canonical nouveau est découvert, utiliser T01 avant activation ; son absence ne bloque pas les tests synthétiques et le comportement DATA_GATED du moteur.

## 4. Normes figées, à ne pas redécider dans P10B

### Identité, acquisition et prix (M8 P6480–6543, P6571–6632)

- `EXACT_FORMAT` : identité/variante/format compatibles ; `NORMALIZED_UNIT` : même variante et unité réellement convertible ; `SERVICE_PLAN` : même service et plan qualitatif. Sinon `NOT_COMPARABLE`. Changement qualitatif ou de plan : nouvelle clé, pas inflation.
- `effectiveUnitPrice = netComparableLineAmount / normalizedQuantity`. Quantité absente : pas de valeur par défaut. Coupon panier réparti seulement par règle Canonical ; sinon prix PARTIAL. Fidélité future exclue sauf réduction économique reconnue.
- Acquisition cadence : même ProductVariant + même scope Household/personne prouvé + même date locale = une occurrence, quantité cumulée. Préserver les PurchaseEvents sources et leurs comptes.
- Intervalles sur dates distinctes : median/IQR/MAD ; 5–7 acquisitions PARTIAL_SUPPORT, >=8 SUFFICIENT, <5 insuffisant. Réutiliser les statistiques robustes et leur convention IQR déjà versionnée P04.
- FIRST_OBSERVED : première acquisition du corpus, jamais première utilisation dans la vie. NEWLY_ADOPTED : six mois antérieurs suffisamment couverts, productCoverage >=85 %, aucune acquisition antérieure.
- Récurrence auparavant établie : >=8 acquisitions. Dormance au-delà de `max(2*medianInterval, medianInterval+2*IQR, 45 jours)`. Abandon au-delà de `max(3*medianInterval, medianInterval+3*IQR, 90 jours)` avec couverture postérieure >=85 %. Réactivation après abandon : événement append-only, statut actif, historique conservé.
- Le seuil 85 % postérieur est explicitement celui d'ABANDONED. Ne pas inventer un seuil supplémentaire DORMANT ; une période non observable n'établit toutefois aucune absence. Autorité manquante : état fermé.

### Substitution marchand exigible (P6633–6698)

- `SubstitutionUniverseCatalog` borne les alternatives plausibles. Pas de produit cartésien de marchands ; un même Need ou label ne prouve pas à lui seul l'alternative.
- Axes séparés `spendShare` et `purchaseEventShare`, sur mois réellement observables et même univers. RetainedPurchaseCount, jamais nombre de paiements.
- Changements opposés matériels, fenêtres 6+6 ou 6+4 ongoing, règles P04 de persistance conservées. Changements chevauchants ou séparés de <=31 jours.
- Pour A et B : variation absolue de part >=10 points. Matérialité économique marchand >=15 €/mois ET >=15 %, ou variation de fréquence matérielle selon policy partagée applicable. Ne pas créer de seuil de fréquence local.
- `counterbalanceRatio = min(abs(deltaA),abs(deltaB))/max(abs(deltaA),abs(deltaB)) >=0.50`, sur un même axe et unité ; dénominateur nul ne produit pas un ratio.
- >=8 PurchaseEvents sur le corpus comparatif de chaque marchand dans son régime pertinent. Qualifier SPEND_SHIFT, FREQUENCY_SHIFT ou BOTH. Ne pas additionner les axes.
- Résultat associatif ; jamais assertion causale « B a remplacé A » sans autorité explicite.
- Sans population/univers/coverage prouvés : qualification absente, support/coverage et causes conservés. Ne pas introduire de seuil global de couverture marchand absent du contrat.

### Produit et indice : spécification conservée pour T01, pas activation P10B (P6699–6906)

- Substitution produit : ProductFamily ou Need + rôle produit compatible, fenêtres communes ; cas fort ancien ABANDONED/nouveau NEWLY_ADOPTED, `POSSIBLE_PRODUCT_SUBSTITUTION` associatif.
- Panier apparié : identité/unité/prix payé connus, présence dans les deux fenêtres, sans changement qualitatif. Entrants/sortants et variantes changées relèvent du mix ; formats convertibles de même variante restent comparables.
- Prix de chaque clé par fenêtre = médiane des prix unitaires effectivement payés. RECENT_3V3 = trois derniers mois certifiés contre trois précédents ; YEAR_OVER_YEAR_3M = même fenêtre de trois mois un an avant. Gaps conservés, aucun LT structurel.
- Törnqvist : `w_i=(s1_i+s2_i)/2`, parts normalisées sur panier apparié, `P=exp(sum(w_i*ln(p2_i/p1_i)))`, taux `P-1`.
- Minimum normal : >=5 clés appariées et >=10 observations. Coverage de chaque fenêtre = dépense appariée / dépense de tous les items éligibles comparables ; effective = minimum des deux. >=85 % headline possible ; 60–<85 % qualifié ; <60 % aucun indicateur Global. Poids maximum >60 % ET <10 items : PARTIAL_SUPPORT malgré forte couverture.
- Décomposition additive distincte : quantité `(Q2-Q1)*(P1+P2)/2`, prix `(P2-P1)*(Q1+Q2)/2`, somme = delta matched. Entrants/sortants dans mix ; quantité inconnue => pas d'effet quantité. Ne pas réutiliser aveuglément le prix médian d'indice pour une identité additive : prix de décomposition doit réconcilier Spend=Q*P. Ce détail reste sous gate produit/T01 avant toute ouverture ; aucun choix implicite n'est requis pour le chemin fermé P10B.
- Loyer/assurance/énergie structurelle restent M1. Changement Basic→Premium = mix. Hausse de dépenses != inflation ; deux prix != tendance.

## 5. Analyse physique de convergence

| Owner / contrat réel | Nouvel input | Consommateur réellement affecté | Action P10B |
|---|---|---|---|
| P09 `buildGlobalPurchaseMerchant` | événements retenus + ECF exacts, purchaseAt, coverage, scope/révision | adaptateur d'enrichissement M2 | sérialiser preuves et fenêtres, pas seulement `{id,amount}` |
| P03 `decomposeGlobalPurchaseFrequencyTicket` | reference/current disjoints, même grain/univers | `buildGlobalCategoryNeeds().purchaseFrequencyTicket` puis adapter serveur M2 | réutiliser formule, réconciliation, aucune référence Typical reconstruite depuis des achats |
| P04 primitives temporelles | séries M8 autorisées et couvertes | M3 catalogue MERCHANT_FREQUENCY/PURCHASE_BASKET/MERCHANT_LIFECYCLE/CONSUMPTION_SUBSTITUTION | adapter séries avec preuve, pas de nouveaux détecteurs |
| P04/P05 M1 temporel | seulement dépendances effectivement changées | `economic-temporal.ts`, autorité économique | prouver invariance Actual/Typical/Minimal et cartes temporelles non affectées ; replay ciblé |
| P06 catalogue M5 | visite-personne + achat localisé + contrôle comparable | définition G `specific-place-visit-localized-purchase` | examen explicite, actuellement exclu ; pas de p-value simulée |
| P06 FDR | tout changement d'éligibilité/p-value d'une définition du scope | tous les tests éligibles du scope, fenêtres, insights et feed M3 | recalcul BH commun si changement ; sinon preuve de no-op |
| F3 produit | gates AG fermées | uniquement états de capacité / déclarations | pas de série PRODUCT_CADENCE inventée |

Constats à traiter techniquement :

- `purchases.ts` expose aujourd'hui `m2PurchaseEvents` sans catégorie, fenêtre ni coverage et `m5MerchantSignals` comme IDs. Ce sont des hooks, pas des preuves suffisantes de raccordement.
- `global-v2-category-needs-authority.ts` appelle M2 sans enrichissement. Le raccordement doit donc être réel dans cet adapter, pas un test isolé du helper.
- `purchase-dependencies.ts` liste M2 et M5 sous `otherModuleDependencies` tout en les appelant downstream. Cette représentation doit être corrigée en P10B : downstream dans inventaire de consommateurs, pas comme inputs M8. Le réemploi de la formule pure P03 n'autorise pas à consommer le résultat M2. Le détecteur partagé P04 est une bibliothèque ; le résultat final M3 n'est pas un input M8.
- Les garde-fous de P09 sur scope personnel/filters restent fermés. Un adapter P10 ne les contourne pas. Une catégorie d'achat multicomposante nécessite un univers économique comparable ; il est interdit d'allouer le ticket entier à chaque catégorie ou de fabriquer des achats par catégorie.

## 6. DAG minimal, ordre et FDR

```text
Canonical/ECF/PurchaseEvent + P01 + P02
  -> M8 core P09 -> Merchant substitution / séries autorisées
                 -> enrichissement M2 (owner P03)
                 -> projection C sans résultat M5 -> régime admissible
visites/personne/achats autoritaires -> M5 scope + régime -> FDR commun
M5 relationship evolution -> M3 affichable (pas retour au régime M5)
M1 producteurs financiers -> M1 temporel (primitives P04 partagées)
```

Aucun cycle M2↔M8 ni M5↔M8. Pas de boucle régime M3 enrichi par M5→M5. Product gated n'est pas un input numérique. Une nouvelle série peut enrichir M3 ; elle ne réécrit pas Actual/Typical/Minimal.

Univers existant : 10 définitions DAY + 2 WEEK + 19 définitions examinées non quotidiennes = 31. La cible P10 est déjà dans ces 31. `closeRelationshipFdrUniverse()` exige chaque ID soit avec p-value éligible, soit exclusion motivée sans p-value ; les exclus ne sont pas des p=1.

Identité exacte actuelle : hash du scope Household/personne/régime, sourceRevision, analyticsRevision, asOf, certifiedThrough, windowRole éventuel, et definitionMonths. Conserver les fenêtres récent/précédent distinctes. Lire les révisions du contexte, ne pas figer une ancienne valeur 1/79 comme vérité d'exécution P10B.

- État disponible : aucune autorité supplémentaire de relation G => conserver exclusion, exécuter les comparaisons de plan/éligibilité/p-values/q-values sur mêmes inputs et révisions. Changer la raison d'exclusion peut changer la preuve/closure sans changer les q-values ; ne pas exiger arbitrairement tous les hashes identiques.
- Si un provider devient réellement éligible : reprendre owner P06/T02, joindre la définition au même univers, recalculer toutes les q-values éligibles de ce scope (et chaque fenêtre touchée), matérialité/robustesse/LOMO, états temporels, puis M3. Interdit de corriger une q-value seule.
- Comparer avant/après les sorties M1 et M2 core à dépendances économiques égales. Si leur vérité change, arrêt owner/T02 ; ne pas maquiller cet écart en enrichissement.

## 7. Décisions techniques et fichiers P10B

Décisions réversibles figées : builders purs, adapter serveur séparé, Big.js pour montants/ratios monétaires, primitives temporelles existantes, ensembles triés par identités canoniques, rejeter doublons contradictoires et undefined présent. Tie-break technique : univers, axe, merchantIds triés, début certifié ; aucune dominance métier déduite.

Chaque sortie consomme un paquet de preuves : scope/révisions/fenêtres, IDs Purchase/ECF, mapping d'univers versionné, coverage avec dénominateurs, policies effectivement consommées. Hashes calculés sur ces inputs et closures ; aucun hash du rapport/oracle comme source. Nouvelle méthode de convergence propre ; incrémenter une méthode existante seulement si sa sortie sémantique change. Aucune version History modifiée.

| Fichier | Travail borné |
|---|---|
| `src/analytics/global-v2/purchases.ts` | réutilisation P09 ; adaptation minimale de preuves exportées si nécessaire |
| `src/analytics/global-v2/purchase-dependencies.ts` | retirer les faux inputs downstream ; déclarer les intrants réellement consommés |
| `src/server/analytics/global-v2-purchase-authority.ts` | préserver fail-closed et sourceRevision ; exposer seulement preuves disponibles |
| `src/analytics/global-v2/merchant-substitution.ts` (nouveau proposé) | moteur DATA_GATED, catalogue fourni explicitement, fenêtres/shared materiality |
| `src/analytics/global-v2/product-capabilities.ts` (nouveau proposé) | gates précis AG002–004/012–022 et réponses absentes typées ; pas de faux Fact |
| `src/analytics/global-v2/purchase-convergence.ts` (nouveau proposé) | adapters B/C, examen D, manifest de replay local |
| `src/server/analytics/global-v2-category-needs-authority.ts` | raccordement optional enrichissement, mêmes autorités core |
| `category-needs.ts`, `transformations.ts`, `temporal-dependencies.ts` | réutiliser hooks ; ne modifier que signatures/consommations nécessaires |
| `relationship-catalog.ts`, `relationships.ts`, `relationship-evidence.ts` | préserver plan commun ; adapter raison P10 si nécessaire, aucune activation implicite |
| `scripts/check-global-v2-purchase-convergence.mjs` (nouveau proposé) | fixtures distinctes : core positif, substitution positive, gated produit, replay B/C/D |
| `scripts/check-global-v2-purchases.mjs`, `check-global-v2-purchase-authority.mjs` | régressions P09 pertinentes |
| `index.ts`, `package.json`, `execution/P10-report.md`, `GLOBAL_EXECUTION_STATE.md` | exports, commande, preuves et état |

Ces chemins proposés ne sont pas une obligation de duplication. Réutiliser un module équivalent trouvé dans le même HEAD. Aucun nouveau schema/table/Query/RM/React. Pas de besoin d'un nouveau transport ou manifest live.

## 8. Plan ordonné d'exécution P10B

1. Vérifier HEAD/état et digest Master ; lire ce freeze et C01–C14. Préserver modifications éventuelles. P09 reste acquis sauf défaut factuel rencontré.
2. Créer les états de capacités exacts et tests négatifs. Conserver l'index Master ; relier AG/IDs et tests dans P10-report, sans nouvelle copie normative.
3. Corriger le graphe de déclarations M8 downstream ; préparer paquets de preuves et hasher le catalogue/univers fourni. Tester closure et ordre.
4. Implémenter MerchantSubstitution conditionnel ; données synthétiques explicitement autoritaires pour les tests ; runtime sans catalogue/données = DATA_GATED, jamais empty-known par défaut.
5. Brancher M8→M2 via hook existant et vérifier sa réconciliation au même univers financier. Conserver UNAVAILABLE si couverture ou grain incompatible ; ne pas transformer les références Typical en ticket moyen.
6. Brancher les seules séries autorisées et suffisamment prouvées à M3 ; recertifier M1 si sa closure est touchée, sinon prouver le no-op financier et temporel.
7. Examiner la définition M5 P10 ; produire preuve d'exclusion et replay commun. Toute nouvelle activation exige fermeture P06 avant PASS F4.
8. Exécuter suites ci-dessous une fois sur état final, corriger seulement causes bornées ; rapport F3 conditionnel/F4 et B/C/D ; checkpoint local si tous les gates requis PASS. Aucun push/live write.

## 9. Tests discriminants P10B et preuves conditionnelles

| ID local | Fixture / mutation | Assertion |
|---|---|---|
| P10-N01 | item bancaire, observation de prix, marchand ou texte seuls | aucune PurchaseLine/identité/unité/acquisition ; chaque gate reste fermé |
| P10-N02 | pack sans taille, quantité absente, variantes distinctes, service modifié | aucune unité=1, comparison key ou inflation fabriquée |
| P10-N03 | produit absent/réapparu sur source non autoritaire | aucun NEWLY_ADOPTED/DORMANT/ABANDONED/REACTIVATED confirmé |
| P10-N04 | 0 données mais univers d'achats inconnu | UNKNOWN/DATA_GATED, jamais « aucun achat » ou coverage=1 |
| P10-S01 | A baisse/B monte, univers explicite commun, supports et fenêtres exacts | signal associatif positif avec evidenceRefs et axe |
| P10-S02 | mêmes montants, univers différent/absent | aucun signal de substitution |
| P10-S03 | 7 puis 8 événements, 9.99 puis 10 points, ratio .499 puis .5, séparation 31 puis 32 jours | frontières normatives et condition de chaque seuil |
| P10-S04 | 6+3, 6+4, 6+6 ; outlier ; retour ; gaps ; données après asOf | shared P04 inchangé ; pas de durée ou persistance inventée |
| P10-S05 | euros sous/seuil 15 et relatif sous/seuil 15 % ; fréquence seule matériellement prouvée | réemploi P03 ; axes jamais confondus ; pas de score nul faute d'autorité |
| P10-S06 | duplication de funding sans nouvel achat, remboursement, annulation | fréquence retenue/total inchangés selon P09 |
| P10-B01 | retained ref=[20,30], current=[30,40,50] | delta70 = fréquence32.5 + ticket37.5 ; moyenne, jamais médiane |
| P10-B02 | scope/window différents, événement dupliqué, couverture inconnue/partielle, achat mult catégories | rejet/indisponibilité ; aucun ticket intégral répété par catégorie |
| P10-C01 | série M8 changée vs permutation technique | closure concernée change ; ordre seul stable ; M1 financier invariant |
| P10-D01 | 31 définitions, P10 exclue avant/après à mêmes inputs | examen complet, pas de p-value inventée, q-values identiques |
| P10-D02 | test synthétique d'éligibilité ajouté à univers valide | BH recalculé pour tous les éligibles, aucun filtrage préalable par matérialité ; jamais activation live |
| P10-D03 | autre personne/régime/révision/fenêtre | univers séparé ; aucune fuite de q-value ou de preuve |
| P10-H01 | dépendance significative absente/digest changé ; catalog version changé | fail-closed ou nouveau hash ; absence d'oracle productif et de cycle |

Cas positifs produit réservés à une ouverture T01 : mêmes variante/scope/date groupés, 4/5/7/8 acquisitions, 6 mois antérieurs et coverage84.99/85, seuils dormance/abandon, réactivation historique ; cinq items/dix observations, coverage59.99/60/84.99/85, concentration60/60.01 % avec9/10 items, Törnqvist à prix constants=1, format convertible vs variant changé, coupon non réparti, service Basic→Premium, quantités manquantes, entrants/sortants et réconciliation. P10B **ne les marque pas exécutés** avec un faux provider. Il teste que ces capacités restent indisponibles sans cette autorité.

## 10. Régressions proportionnées et critères de PASS

P10B exécute : nouvelle suite convergence ; `check-global-v2-purchases.mjs` et `check-global-v2-purchase-authority.mjs` ; suites catégorie/Needs/matérialité, economic-function, temporal-arbitration et temporal-descriptive ; relationships et relationship-authority pour le replay commun. Places/autorité Place seulement si leur production ou adaptation est touchée. Facts/Canonical et fondations seulement si modifiés. Typecheck, architecture et diff-check obligatoires ; build si adapter/runtime/imports serveur changés (prévu par ce plan). Aucune certification exhaustive History, aucun ancien script V1, aucun live.

PASS P10B exige : F3 gates précis et négatifs ; MerchantSubstitution DATA_GATED implémenté et testé ; hooks réellement raccordés ou indisponibilité justifiée par preuve ; F4 replay B/C/D avec table inputs/digests/outcomes ; zéro cycle ; zéro régression financière inexpliquée ; aucun PASS de capability produit non ouverte. Les gated autorisés n'empêchent pas le PASS du core ; ils doivent figurer dans CAPABILITIES_GATED et le handoff ultérieur.

Hard stops : nouvelle contradiction Master/Canonical ; nécessité de modifier causalité, attribution, support, coverage ou seuil ; activation AG sans T01 ; modification d'une vérité P01–P09 sous couvert d'enrichissement ; impossibilité de réconcilier le même univers ; nouveau test M5 sans fermeture de catalogue/statistique ; écriture live/migration demandée implicitement. Documenter owner/T02 ou T01 et ne pas étendre la mission. Les défauts techniques bornés de connexion/closure se corrigent avec leur régression ; ils ne nécessitent pas d'arbitrage métier.

## 11. Preuves de P10A et verdict

- Baseline Git et propreté : vérifiées ; Master SHA : identique au registre ; chaînes physiques B/C/D et AG : lecture ciblée effectuée.
- Aucun prototype nécessaire. Aucun moteur, build ou grosse régression exécuté dans ce freeze. `node node_modules/typescript/bin/tsc --noEmit` : PASS sur le code P09 inchangé ; `git diff --check` : PASS. Ces vérifications ne certifient pas l'implémentation P10B.
- Questions humaines restantes pour le périmètre exécutable P10B : **0**. Les points produit futurs sont explicitement AUTHORITY_GATED avec fermeture déterminée ; leur activation nécessitera T01.

CURRENT_PROMPT = P10A

P10A_FREEZE_GATE = PASS

IMPLEMENTATION_GATE = NOT_RUN_P10B

CONTRACT_GATE = PASS_FREEZE_ONLY

TEST_GATE = NOT_RUN_P10B

LIVE_GATE = NOT_RUN

LIVE_WRITES = NONE

NEXT_PERMITTED_PROMPT = P10B

STOP après le checkpoint documentaire ; aucune implémentation P10B n'est commencée.
