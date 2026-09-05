# P04 — preflight C1, arbitrage et implémentation temporelle partielle

## Baseline

- Branche : main; HEAD : `3f358ed55f9d2c8d7b5fd88f493532702139d808`; entrée propre.
- P03 déclaré PASS dans le checkpoint; acquis conservé, sans nouvel audit Finance.
- Charte C01–C14 et AGENTS.md lus.
- Master DOCX : SHA-256 `8b0d0ff2381599c4495645cd1dd1ebf2fa0d027fc3113be78aee945fae12f8be`, identique à l'index P01.
- Lectures : sections communes Trend/Stability (P1355–1485), M3/Transformations (P2603–3141), CURRENT_REGIME (P3045–3077), recherche des clauses ultérieures et des lignes de tables associées.
- Aucune écriture live, aucune publication, aucune donnée privée ajoutée.

## Freeze C1 — règles explicitement sourcées

| Famille | Formule et corpus certifié | Support/fenêtre/persistance | Source Master |
|---|---|---|---|
| Recent Change | médiane récent moins médiane précédent | 3+3 mois complets éligibles | P1368–1382 |
| Trend | Theil–Sen, pente médiane des paires | 12 derniers mois éligibles; minimum 6; écarts de dates réels | P1384–1399 |
| Dispersion | médiane, MAD, IQR=Q3-Q1 | support déclaré; aucune classe depuis un seuil universel | P1427–1471 |
| Rupture mûre | médiane après moins médiane avant | 6+6; chaque bloc de six tient dans sept mois calendaires; 5/6 postérieurs plus proches d'after | P2659–2706 |
| Ongoing | même comparaison | 6+4; 3/4 postérieurs compatibles; ne prouve pas un fonctionnement définitif | P2686–2706 |
| Amplitude | MaterialityPolicy de la famille | aucun seuil supplémentaire universel | P2709–2722 |
| Robustesse | robustShift=abs(delta)/robustDispersion MAD/IQR | diagnostic interne; critère de plateau encore non défini | P2724–2740 |
| Ancre | date précise seulement si relation sémantique explicite | événement concomitant insuffisant; sans ancre précision MONTH | P2756–2782 |
| Durable | changement structurel matériel persistant | une famille structurelle peut suffire | P2784–2790 |
| New phase | plusieurs dimensions changent | ≥2 domaines ou ancre forte et changement matériel correspondant | P2792–2799 |
| Chapitre | régime temporaire | ≥3 mois éligibles; retour sur ≥3 mois consécutifs non matériels vs ancien et matériels vs chapitre | P2801–2830 |
| Troisième régime | B finit quand C commence | ne pas appeler C un retour à A | P2834–2848 |
| Fusion | chevauchement ou ≤31 jours, plus compatibilité sémantique | lien Canonical explicite nécessaire au-delà; sans ancre ≥3 signaux et ≥2 domaines avec cohérence catalogue | P2855–2925 |
| Régime courant | médiane depuis début confirmé, max 12 mois | ≥6 mois certifiés pour référence forte; avant, PARTIAL_SUPPORT ne remplace pas Typical | P3045–3077 |

Les eight domaines autorisés sont ceux de P2870 : ECONOMIC_STRUCTURE, WORK_AND_DAY_CONTEXT, ACTIVITY_BEHAVIOR, GEOGRAPHY_AND_MOBILITY, RECURRING_OBLIGATIONS, CONSUMPTION, MOMENTS_AND_PROJECTS, RELATIONAL_AND_SHARED_LIFE. Category/Need/montant ne comptent pas comme trois domaines.

La multiplicité FDR trouvée dans P4008 et P4291 appartient au RelationshipEngine M5. Elle n'autorise pas à inventer un test statistique ou un seuil FDR pour ChangePoint. La sélection de frontières multiples et de primaryDriver reste à expliciter dans la policy de détection, avec ordre stable d'identités en dernier recours.

## Lacunes normatives confirmées après recherche ultérieure

1. **StabilityPolicy / quasi-zéro.** P1450–1471 exige une faible dispersion et l'absence de variation matérielle, mais ne définit ni les bornes par famille ni le dénominateur quasi nul. `relativeMAD < 10%` est un exemple explicitement refusé, pas un seuil autorisé. Les annexes GLO-REF-017/018/019/060 et table 432 lignes 18/19/20/63 répètent cette doctrine sans la compléter. L'annexe indexe même le fragment 10% dans `thresholdsAndPolicies`; le contexte normatif interdit de l'appliquer.
2. **Plateaux / bruit.** P2726–2740 exige de distinguer plateaux, bruit et pente progressive, sans fixer le choix MAD/IQR, le critère de plateau ou sa règle de décision. GLO-M03-024/025 et table 436 lignes 26/27 ne précisent pas davantage. Passer seulement matérialité et persistance peut accepter une pente linéaire, ce qui viole le test P3136.

Ces décisions changent les phénomènes reconnus. Elles ne sont pas remplacées par des paramètres choisis pour obtenir une rupture.

## Travail exécutable réalisé sans ces décisions

`src/analytics/global-v2/temporal-descriptive.ts` fournit une primitive descriptive isolée :

- Theil–Sen avec distances calendaires, intercept médian technique, début/fin ajustés;
- recent change médiane 3+3;
- médiane et MAD descriptifs;
- filtre corpus certifié et borne déjà résolue par P02; aucune interpolation;
- support explicite, doublons contradictoires refusés, propriétés undefined refusées;
- hash canonique sensible aux intrants, stable sous permutation et ajout futur/LT;
- classification et relativeMAD explicitement UNKNOWN avec reasonCode d'autorité manquante.

Cette primitive n'est pas raccordée à M1 : aucun faux résultat final ne remplace les sorties P04 encore attendues. Elle ne certifie ni C2 complet, ni rupture, ni stabilité métier. IQR, régime courant, fusion, transformations et raccordement M1 restent à implémenter après le freeze complet.

## Décision concrète à approuver pour reprendre

Proposition conservatrice (non appliquée) :

- Stability V1 expose médiane/MAD/IQR sans les quatre classes optionnelles, et sans ratio relatif tant qu'une policy par famille ne définit pas quasi-zéro. Cela exploite le caractère optionnel `classification?` et `relativeMad?` du contrat P1707; l'autorisation de clôturer P04 ainsi doit être explicite.
- Pour les plateaux monétaires, tester les deux dérives Theil–Sen sur leur durée avec la MaterialityPolicy de la famille : une dérive interne matérielle empêche `STEP_CHANGE`; conserver le candidat progressif pour un futur `GRADUAL_TRANSITION` seulement après preuve de plateau final. Proposition à valider, car elle tranche le sens de « plateau suffisamment distinct ».
- Pour les familles non monétaires dont la policy n'est pas encore disponible, conserver un candidat non confirmé avec raison d'autorité manquante et une dépendance au propriétaire du signal.

## DAG restant

```text
P01 contrats → P02 séries économiques / bornes → P04 descriptif (partiel)
P03 matérialité → P04 détection / stabilité / transformations (freeze requis)
M4 / M6 / M7 / M8 → enrichissements optionnels futurs → recertification P04 par closure
P04 complet → M1 Trend/Stability/RecentChange raccordés → P05
```

Pas de cycle : les signaux amont consomment les Facts et moteurs stables, jamais les transformations enrichies qui les consomment.

## Vérification et sortie

| Commande | Résultat réel |
|---|---|
| `node --experimental-strip-types scripts/check-global-v2-temporal-descriptive.mjs` | PASS 17/17 : pente, stable, outlier, 5/6 mois, gap, no-lookahead, permutation, conflits, hash et états gated |
| `node node_modules/typescript/bin/tsc --noEmit` | PASS |
| `node scripts/check-architecture-imports.mjs` | PASS, 483 fichiers |
| `git diff --check` | PASS |

Aucune certification complète, aucun checkpoint PASS, aucun push. Le code P02/P03 reste inchangé; aucune régression Finance complète n'est revendiquée. Build non relancé : la primitive isolée n'est importée par aucun chemin runtime. Les gates de raccordement M1 et les tests de détection restent requis après arbitrage.

`C1_FREEZE = BLOCKED — STABILITY_AND_PLATEAU_AUTHORITY`

`C2_IMPLEMENTATION = PARTIAL — DESCRIPTIVE_PRIMITIVES_ONLY`

`P04 = BLOCKED`

`NEXT_PERMITTED_PROMPT = P04_AUTHORITY_RESOLUTION`

`LIVE_WRITES = NONE`

## Reprise après arbitrage humain P04

La section de blocage ci-dessus décrit l'arrêt **antérieur**. L'arbitrage humain suivant a été reçu et appliqué : statistiques descriptives publiables avec support; pas de seuil universel absent du Master; qualification de stabilité UNKNOWN si sa preuve statistique manque; matérialité distincte du test de dispersion; plateau non confirmé faute de preuve suffisante; fenêtres, persistance, retour et no-lookahead inchangés. L'ancienne proposition « dérive non matérielle ⇒ plateau » n'est **pas** appliquée.

### Implémentation enregistrée

| Fichier / fonction | Comportement et limite |
|---|---|
| `temporal-descriptive.ts` / `normalizeGlobalTemporalPoints` | Normalisation partagée, bornes CH, états/valeurs/boolean/refs contrôlés, déduplication contradictoire refusée. Les points LT/futurs ne changent ni le résultat ni son hash. |
| `temporal-descriptive.ts` / `buildGlobalTemporalDescriptive` | Descriptifs et support; closure explicite des références; jamais de classe STABLE depuis MAD=0 ou depuis la matérialité. |
| `temporal-change.ts` / `buildGlobalTemporalChangeCandidates` | Médianes avant/après, 6+6 ou 6+4, distances strictes, compte de persistance 5/6 ou 3/4, refus des trous dépassant les fenêtres. La MaterialityPolicy P03 est consommée, non recopiée. |
| `temporal-analysis.ts` / `buildGlobalTemporalAnalysis` | Compose descriptif, diagnostics et matérialité de dérive/recent change; ne confond pas cette dernière avec une qualification de stabilité. Hash composé des closures et policies réellement consommées. |

`CONFIRMED_LEVEL_CHANGE` désigne uniquement le diagnostic d'une fenêtre, **pas** une transformation durable ni un régime courant. La preuve de plateau actuellement implémentée est l'égalité exacte de toutes les valeurs de chaque bloc : propriété factuelle sans tolérance inventée, non une définition universelle obligatoire du plateau. Tout autre cas conserve `PLATEAU_NOT_PROVEN`, y compris un cas passant 5/6 avec un point divergent. La qualification sémantique finale ne consomme encore aucun de ces candidats.

Les fenêtres continues ongoing de quatre points sont couvertes. La qualification d'une fenêtre ongoing trouée et d'une frontière séparée par un mois absent reste conservativement non confirmée dans ce diagnostic; aucune règle numérique manquante n'est extrapolée. Cette limite est une raison supplémentaire de **ne pas certifier C2 complet**.

Les autorité/support/coverage sont des preuves explicites requises du producteur du signal; aucun montant connu ne crée une coverage complète. Une preuve absente ou insuffisante empêche la confirmation. Aucune classification catégorielle ni ratio relatif MAD n'est fabriqué.

### Preuves exécutables de la reprise

| Commande | Résultat |
|---|---|
| `node --experimental-strip-types scripts/check-global-v2-temporal-descriptive.mjs` | PASS 17/17 |
| `node --experimental-strip-types scripts/check-global-v2-temporal-arbitration.mjs` | PASS 42/42 |
| `node --experimental-strip-types scripts/check-global-v2-economic-function.mjs` | PASS 65/65 — M1 existant, pas le raccordement temporel encore absent |
| `node --experimental-strip-types scripts/check-global-v2-category-needs-materiality.mjs` | PASS 49/49 |
| `node node_modules/typescript/bin/tsc --noEmit` | PASS |
| `node scripts/check-architecture-imports.mjs` | PASS 485 fichiers |
| `node node_modules/next/dist/bin/next build` | PASS — compilation, TypeScript et génération de pages |
| `git diff --check` | PASS |

Fixtures exclusivement synthétiques. Cas discriminants : constante, pente matérielle sans rupture, bruit matériel non qualifié, outlier isolé, fenêtres 6+6/6+4, limites de persistance, support insuffisant, un/deux trous calendaires, coverage absente, policy incompatible, permutation, dépendances modifiées, futur, LT et borne certifiée. Les warnings Node MODULE_TYPELESS_PACKAGE_JSON sont non bloquants; aucune configuration produit n'a été changée pour les supprimer.

### Closure restante — aucune assimilation à un PASS

- IQR et support des sorties descriptives restant à compléter conformément au contrat final.
- Projection/catalogue exhaustif des signaux M3, séparation des domaines et ancrages sémantiques.
- Chapitre temporaire, retour trois mois, troisième régime, fusion multidomaine, forme de transformation et CURRENT_REGIME.
- Raccordement officiel M1, version/déclaration de dépendances et replay de sa réconciliation avec sorties temporelles.
- Tests correspondants : la suite discriminante complète P04 n'est donc **pas** encore PASS.

L'arbitrage normatif est acquis; ces lignes sont du travail d'implémentation restant, pas une nouvelle demande d'arbitrage humain. Aucun moteur, hash ou snapshot History n'est modifié. Les nouveaux modules restent isolés de la production. Aucun push ni commit de clôture PASS n'est créé.

`CURRENT_PROMPT = P04`

`BASELINE_HEAD = 3f358ed55f9d2c8d7b5fd88f493532702139d808`

`CONTRACT_GATE = PARTIAL — ARBITRATION_ACCEPTED; COMPLETE_C1_CLOSURE_PENDING`

`IMPLEMENTATION_GATE = PARTIAL`

`TEST_GATE = PARTIAL — TARGETED_TESTS_PASS; COMPLETE_C2_NOT_CERTIFIED`

`LIVE_GATE = NOT_RUN / NOT_REQUIRED`

`LIVE_WRITES = NONE`

`NEXT_PERMITTED_PROMPT = P04 — P05_NOT_AUTHORIZED`

## Reprise suivante — lifecycle, fusion et raccordement M1

### Travail enregistré

- `temporal-lifecycle.ts` : chapitre sur ≥3 mois, six observations de référence dans sept mois, fin supportée par trois mois consécutifs, matérialité versus chapitre et absence de matérialité versus ancien régime pour nommer un retour. Un troisième régime n'est pas un retour. Les preuves de plateau restent strictement factuelles (valeurs constantes); les cas bruités ne deviennent pas confirmés par la seule matérialité. Les autres formes restent à intégrer à la qualification finale.
- `buildGlobalCurrentRegime` : entrée de régime explicitement confirmé, encore ouvert et prouvé; médiane des douze derniers mois éligibles depuis son début. Moins de six mois : PARTIAL et aucune autorité structurelle. NEW_PHASE ne devient pas une référence structurelle. Jamais de remplacement automatique de Typical. Cette primitive consomme une qualification de régime, elle ne la fabrique pas.
- `temporal-fusion.ts` : huit domaines, même sujet, overlap/31 jours ET relation sémantique; exception de délai depuis preuve Canonical. Sans ancre : trois signaux/deux domaines plus relation de catalogue. Groupes complets plutôt que simple transitivité des dates, ordre stable, doublons contradictoires rejetés. Relations inconnues ou sans preuve rejetées. Aucun score inter-domaines inventé.
- `economic-temporal.ts` : adaptateur Actual officiel → points CH → moteur temporel. `resolveGlobalM1HouseholdAuthority` retourne effectivement `temporal` avec Trend/Stability/Recent Change. Aucun certificat ou ReadModel History utilisé. La couverture compte explicitement les sources mensuelles officiellement complètes; ce n'est pas une couverture d'euros/personnes, et l'absence de couverture du producteur reste UNKNOWN.
- Méthode `global_economic_function@v2` et déclaration M1 mises à jour : module temporel, policies temporelles et matérialité. Le descripteur historique `globalM1DeferredTemporalOutputs` reste lisible pour compatibilité mais n'est pas utilisé par la sortie serveur raccordée.
- `index.ts` expose les primitives. Le consommateur M2 garde ses montants et formules existants.

### Tests exécutés sur cet état

| Suite | Résultat |
|---|---|
| `check-global-v2-temporal-descriptive.mjs` | PASS 17/17 |
| `check-global-v2-temporal-arbitration.mjs` | PASS 76/76 |
| `check-global-v2-economic-function.mjs` | PASS 72/72 |
| `check-global-v2-category-needs-materiality.mjs` | PASS 49/49 |
| `tsc --noEmit` | PASS |
| `check-architecture-imports.mjs` | PASS 488 fichiers |
| `next build` | PASS — compilation, TypeScript, pages de production |
| `git diff --check` | PASS |

Les cas ajoutés couvrent chapitre de 2/3/4 mois, retour 2/3 mois, troisième régime, trou du retour, absence de fin implicite, CURRENT_REGIME 5/6/12+ mois, phase non structurelle, régime fermé/sans preuve, absence de lookahead; fusion liée/non liée, sujets distincts, délai Canonical, catalogue sans ancre, domaines insuffisants, permutation, contradiction et changement de dépendance. M1 teste le vrai adaptateur utilisé par l'appel serveur (pas un smoke live), les trois sorties, l'absence de coverage inventée et la sensibilité du hash.

Une première exécution M1 a détecté un identifiant MethodVersion avec tirets incompatible avec le parser strict; les nouvelles identités de méthode ont été corrigées en `<method_key>@vN`, sans assouplir le parser. Les suites ci-dessus ont ensuite été rejouées.

### Nouveau point normatif : driver dominant après fusion

Le Master P2927–2937, GLO-M03-052/053/054, impose `primaryDriver` et `supportingSignals[]`, avec l'exemple de la conduite pratique. P3082–3083 inclut cette propriété dans TransformationArtifact. Recherche complémentaire des sections et annexes par `primaryDriver`, `primary driver`, `dominant`, `signal principal` : aucune règle générale de priorité entre domaines, ni mesure comparable de dominance n'a été identifiée. Les tests annexés répètent l'obligation sans fournir de règle de sélection.

Une préférence systématique Activity > Finance, un plus grand montant, une pente ou un ordre lexical ne prouvent pas que le signal est le moteur de l'histoire. Le moteur conserve donc un `representativeSignalId` technique stable, **explicitement distinct** du `primaryDriver` UNKNOWN. Ce groupe n'est pas déclaré TransformationArtifact final conforme.

**Arbitrage précis proposé, non considéré comme validé :** renseigner `primaryDriver` seulement si une preuve Canonical ou une règle de catalogue autorisée désigne explicitement ce rôle; sinon conserver le groupe fusionné avec `primaryDriver` UNKNOWN et tous les signaux prouvés, sans empêcher les statistiques ni la fusion. Si un driver est obligatoire même dans ce cas, fournir sa règle de sélection et ses tie-breakers. L'arbitrage StabilityPolicy n'autorise pas implicitement ce nouveau repli narratif.

### Ce qui n'est pas encore certifié

Outre cet arbitrage, l'intégration finale TransformationArtifact (catalogue exhaustif, ancrage/date précise, formes et reclassification/assemblage des primitives), la closure complète de ces sorties et leur suite exhaustive restent à fermer. Le report ne transforme pas les 76 assertions ciblées en une certification intégrale C2. IQR et les compléments descriptifs mentionnés précédemment restent à finaliser. Aucun fait que le code ne produit pas n'est déclaré PASS.

`CONTRACT_GATE = BLOCKED — PRIMARY_DRIVER_SELECTION_AUTHORITY`

`IMPLEMENTATION_GATE = PARTIAL`

`TEST_GATE = PARTIAL — TARGETED_SUITES_PASS; FULL_C2_NOT_CERTIFIED`

`LIVE_WRITES = NONE`

`NEXT_PERMITTED_PROMPT = P04`

`P05 = FORBIDDEN`

## Dernière vérification — corpus ordinaire et matrice C2

Cette section complète la reprise primaryDriver. L'ancien blocage de dominance est résolu, sans fallback UNKNOWN sur une fusion certifiée.

La dispersion ordinaire est désormais calculée par **la même primitive descriptive** que la dispersion brute, uniquement si chaque mois sélectionné porte une classification ORDINARY/EXCEPTIONAL et une preuve explicite. Sinon `ordinaryDispersion = UNKNOWN / ORDINARY_EXCLUSION_AUTHORITY_MISSING`. Les exclusions n'affectent ni Actual ni le support brut. Une valeur extrême ne crée jamais elle-même une classification exceptionnelle.

Les signaux non prouvés plateaux conservent également `shape = UNKNOWN / GRADUAL_OR_NOISY_SHAPE_NOT_PROVEN` dans les diagnostics. Ce repli est compatible avec l'arbitrage de stabilité, mais ne constitue pas une implémentation positive complète de GRADUAL_TRANSITION.

| Exigences Master | État vérifié / preuve | Statut de fermeture |
|---|---|---|
| GLO-M03-001–006 | CH séparé de LT; pas de cycle/routine inventés depuis un changement; descriptif séparé | couvert dans le périmètre temporel |
| GLO-M03-007–011 | points mensuels et projection avec grain/exposition; interfaces de séries normalisées | PARTIAL : variantes de producteurs à certifier exhaustivement |
| GLO-M03-012–025 | fenêtres/persistance/médianes/matérialité/robustesse et UNKNOWN sans plateau; tests constants/bruit/pente/outlier/gaps | tests ciblés PASS |
| GLO-M03-026–029 | STEP_CHANGE et ANCHORED_ONSET présents; shape inconnue conservée si non prouvée | PARTIAL : chemin positif GRADUAL_TRANSITION restant |
| GLO-M03-030–042 | date précise seulement via ancre liée, trois types, chapitre ≥3, retour trois mois et troisième régime; identité conservée à la fermeture | tests ciblés PASS |
| GLO-M03-043 | CANDIDATE et CONFIRMED_* présents; diagnostics de rejet | PARTIAL : contrat explicite de tous les statuts internes à fermer |
| GLO-M03-044–051 | fusion sémantique, huit domaines, délais, catalogue sans ancre; déterminisme | tests ciblés PASS |
| GLO-M03-052–054 | arbitrage humain complet, provenance, supportingSignals et absence de causalité | PASS |
| GLO-M03-055–064 | whitelist présente; inputs interdits refusés, moteurs futurs optionnels | PARTIAL : toutes les variantes catalogue/projections ne sont pas recertifiées |
| GLO-M03-067–069 | médiane du régime max12, minimum6, PARTIAL avant, NEW_PHASE non structurelle | tests ciblés PASS |
| GLO-M03-070–071 | assemblage, summaries/support/driver/provenance/dépendances | PARTIAL : clôture complète du contrat de toutes les formes/statuts restante |
| GLO-M03-072–075 | fixtures de fusion, chapitre et changement; constantes/bruit/retour/no-lookahead | ciblé PASS, pas équivalent à l'intégralité de l'annexe |

Les IDs viennent de l'index Master existant; aucune copie normative n'est créée. Cette matrice ne modifie pas les clauses manquantes en conditions optionnelles. Aucun nouvel arbitrage n'est nécessaire pour continuer l'implémentation connue.

Résultats actuels : **131/131** assertions temporelles/assemblage, **17/17** descriptives, **72/72** M1, **49/49** M2; typecheck et architecture **491 fichiers PASS**. Le test de déclaration vérifie bien un input *consommé non déclaré*, conformément à `assertGlobalDependencyClosure`, et non une liste vide de consommation.

HEAD demeure `3f358ed55f9d2c8d7b5fd88f493532702139d808`; fichiers P04 non commités conservés. Le checkpoint est interdit tant que ces fermetures restent partielles.

`PRIMARY_DRIVER_GATE = PASS`

`IMPLEMENTATION_GATE = PARTIAL`

`CONTRACT_GATE = PARTIAL`

`TEST_GATE = PARTIAL — TARGETED_269_ASSERTIONS_PASS`

`LIVE_WRITES = NONE`

`NEXT_PERMITTED_PROMPT = P04; P05_FORBIDDEN`

Pas de checkpoint local tant que les trois gates ne sont pas PASS.

## Arbitrage primaryDriver — appliqué; assemblage C2 enregistré

L'arbitrage humain ferme le blocage de dominance décrit précédemment. Il **rejette** le fallback UNKNOWN sur un groupe certifié. Le code le respecte désormais :

1. `CANONICAL_DESIGNATION` : désignation Canonical ou de catalogue avec référence d'autorité;
2. `SEMANTIC_ANCHOR` : signal directement lié à l'ancre prouvée;
3. `EARLIEST_CERTIFIED_ONSET` : plus ancien début certifié;
4. `DETERMINISTIC_TIEBREAK` : identité de signal à unité temporelle égale.

`supportingSignals` contient exactement les autres membres. `driverProvenance` conserve le tier, le reasonCode, les références d'autorité, la précision de comparaison et `causalEvidence=false`. Aucun montant, slope ou score inter-domaines n'intervient. Une précision MONTH n'est pas convertie en faux jour exact pour départager. L'intervalle technique de fusion et le début exposé restent distincts.

La méthode de fusion est versionnée `global_temporal_fusion@v2`; les autorités de désignation font partie du hash et de la closure.

### Assemblage ajouté

- `buildGlobalTransformations` : catalogue fermé de familles autorisées, diagnostics de fenêtre, chapitres, fusion, classification conditionnelle DURABLE_CHANGE / NEW_PHASE / TEMPORARY_CHAPTER, supportingSignals, summaries, support, preuves et référence de régime. Un signal isolé non prouvé structurel reste CANDIDATE.
- Les ancres ne précisent un jour que si elles sont liées au signal et au mois détecté; sinon le début reste MONTH. Une ancre autoritaire explicitement forte peut soutenir NEW_PHASE. Elle alimente également le tier SEMANTIC_ANCHOR du choix de driver.
- Le passage d'une phase ouverte à un chapitre fermé conserve l'identité de transformation pour une même origine; ce calcul ne modifie aucun artifact publié.
- `projectGlobalTemporalRate` conserve le grain source, l'exposition et leurs références dans la preuve; un dénominateur nul donne UNKNOWN, une source partielle donne PARTIAL. Aucun Fact n'est réécrit.
- `createGlobalTemporalDependencyDeclaration` distingue série certifiée requise, matérialité/bornes et enrichissements M4/M6/M7/M8 optionnels. Pas de dépendance à History ReadModels.
- IQR descriptif : quantile linéaire type 7 (convention numérique explicite), `IQR=Q3-Q1`; aucune classe de stabilité depuis cette valeur. `robustShift` utilise les écarts absolus centrés par bloc, reste diagnostique et n'impose aucun seuil; dénominateur nul → UNKNOWN.

### Vérifications de cette reprise

| Suite | Résultat |
|---|---|
| temporel/arbitrage/lifecycle/fusion/assemblage | PASS 122/122 |
| descriptif | PASS 17/17 |
| M1 et raccordement temporel | PASS 72/72 |
| M2 / matérialité | PASS 49/49 |
| Typecheck | PASS |
| Architecture | PASS 491 fichiers |

Les nouvelles assertions couvrent chaque priorité du driver, permutation, supportingSignals, causalEvidence=false, ancre invalide, hash sensible à la désignation; chemin assemblé vers changement durable, phase multidomaine, chapitre fermé, régime courant, ancrage au jour, reclassification avec identité conservée, catalogue interdit, grain/exposition et déclaration manquant un input consommé.

### Limites de certification encore ouvertes

Les suites ciblées ne prouvent pas encore **toutes** les clauses C1/C2. Il reste à fermer explicitement la distinction dispersion brute/ordinaire avec exclusions autoritaires, les sorties/diagnostics GRADUAL_TRANSITION lorsque les plateaux ne sont pas prouvés, et la matrice exhaustive clauses/contrats/tests (notamment les variantes du catalogue de signaux et leurs projections humaines). Le chemin assemblé actuel couvre les STEP_CHANGE prouvés et ANCHORED_ONSET, pas une certification exhaustive de toutes les formes et variantes.

Ces points sont des travaux techniques de clôture, **pas un nouvel arbitrage humain sur primaryDriver ou StabilityPolicy**. L'ancienne entrée de blocage n'est plus le statut courant. Aucun checkpoint PASS ne sera créé sur la seule base de 260 assertions ciblées.

**Complément final de cette même reprise :** la section « Dernière vérification — corpus ordinaire et matrice C2 » ci-dessus contient la vérification suivante : dispersion brute/ordinaire désormais implémentée, diagnostics de forme inconnue ajoutés, matrice explicite et **269 assertions ciblées PASS** (131+17+72+49). Typecheck, architecture 491 fichiers, build Next final et `git diff --check` PASS. Les points restant ouverts sont le chemin positif GRADUAL_TRANSITION, les statuts internes exhaustifs et la certification complète des variantes du catalogue/projections; aucun nouveau choix humain n'est demandé. Les états PARTIAL ci-dessous restent donc le verdict global réel.

`PRIMARY_DRIVER_ARBITRATION = IMPLEMENTED`

`CONTRACT_GATE = PARTIAL — EXHAUSTIVE_C1_C2_CLOSURE_PENDING`

`IMPLEMENTATION_GATE = PARTIAL`

`TEST_GATE = PARTIAL — TARGETED_TESTS_PASS`

`LIVE_WRITES = NONE`

`NEXT_PERMITTED_PROMPT = P04`

`P05 = FORBIDDEN`

## Clôture C1/C2 — état final après les deux arbitrages

Les sections précédentes sont la chronologie des reprises; elles ne sont pas réécrites rétroactivement. Cette section porte le verdict courant sur le code enregistré.

### Fermeture des dernières lignes de la matrice

| Contrat | Implémentation finale / assertions | Fermeture |
|---|---|---|
| Grain mensuel, GLO-M03-007–011 | `projectGlobalTemporalRate`, numerator/exposure/sourceGrain et preuves; tests PersonDay, ActivityOccurrence, PlaceVisit, PurchaseEvent, exposition absente/nulle/partielle | PASS du contrat partagé; les producteurs des modules futurs restent optionnels |
| GLO-M03-026–029 | `buildGlobalGradualTransitions` : deux plateaux exactement constants de six observations, chemin intermédiaire monotone entièrement observé; preuve positive GRADUAL_TRANSITION. Les trois formes sont représentables et testées | PASS |
| GLO-M03-043 | diagnostics REJECTED/CANDIDATE/CONFIRMED_ONGOING, chapitre CONFIRMED_CLOSED; `compareGlobalTransformationClassification` produit RECLASSIFIED à identité stable sans modifier un artifact publié | PASS |
| GLO-M03-055–064 | 31 clés whitelist, tests d'autorité absente sur chacune; aucun Moment/projet isolé ne confirme à lui seul une transformation. Les autres producteurs ne sont pas simulés | PASS du catalogue/contrat consommateur |
| GLO-M03-070–071 | assemblage partagé, trois formes, summaries, support, références, driver et supportingSignals, ancre, courant/fermé, hash et dépendances | PASS du moteur C2 |
| GLO-M03-052–054 | priorité humaine appliquée intégralement; le driver représente, il ne prouve jamais la causalité | PASS |
| Raccordement M1/B2 | autorité serveur → Actual officiel → `buildGlobalM1Temporal` → descriptif/dispersion brute et ordinaire/RecentChange/matérialité; références Typical/Minimal non modifiées | PASS, suite M1 rejouée |

La preuve suffisante GRADUAL_TRANSITION ne définit **aucune tolérance au bruit**. Le début de transition et le début du nouveau plateau sont distincts : CURRENT_REGIME commence au plateau confirmé et ne moyenne pas les mois transitoires. Les fenêtres avant/après gardent six observations chacune; aucun trou n'est interpolé à travers le chemin. Une pente sans plateau final, un support après de cinq mois ou un trou du chemin ne produisent aucune transition confirmée. Les cas statistiques plus généraux restent non qualifiés selon l'arbitrage; ils ne sont pas silencieusement assimilés à des plateaux.

La distinction brut/ordinaire partage exactement la même formule descriptive, avec exclusions autoritaires. IQR est calculable sans qualifier une classe; la convention numérique est déclarée. Les sorties nécessitant une StabilityPolicy absente restent explicitement UNKNOWN. Ce sont les replis **autorisés** par l'arbitrage, pas des thresholds à choisir ultérieurement pour rendre les tests verts.

### Freeze consolidé et limites autorisées

- Les règles sourcées de la table C1 initiale sont conservées : 3+3, Trend min6/max12, distance calendaire, 6+6/6+4, persistance5/6 et3/4, chapitre3, retour3, fusion31 jours avec preuve sémantique, CURRENT_REGIME min6/max12.
- Les plateaux non prouvés conservent leurs diagnostics non confirmés. Pas de classification STABLE depuis une faible dérive; pas de saisonnalité annuelle affirmée depuis un seul cycle. Cycle/routine demeurent distincts des transformations.
- Le catalogue reçoit des **signaux officiels normalisés**, non des colonnes libres ou des ReadModels. Les tests négatifs sur chaque famille certifient l'absence d'autorité comme un refus, pas comme une implémentation fictive de M4/M6/M7/M8. Leur intégration réelle déclenchera la recertification par closure dans leurs lots propriétaires.
- Les désignations/ancres du driver participent à ses dépendances et au hash; leur permutation ou duplication identique ne crée pas un changement sémantique. Un début déclaré hors de l'intervalle est refusé. Aucun montant/slopes/score inter-domaines ne départage les signaux.
- Le comparateur de reclassification est compare-only sur les identités/classes précédentes; il ne fournit ni Fact ni valeur financière aux moteurs.
- La déclaration M3 reste une déclaration partagée sans Query ni publication; le chemin livré est Household. L'enrichissement personnel demeure borné par P01 et sera branché dans ses consommateurs dédiés, sans prétendre à une nouvelle couverture personnelle.

### Preuves finales sur un même état

| Commande | Résultat |
|---|---|
| `node --experimental-strip-types scripts/check-global-v2-temporal-arbitration.mjs` | PASS 179/179 |
| `node --experimental-strip-types scripts/check-global-v2-temporal-descriptive.mjs` | PASS 17/17 |
| `node --experimental-strip-types scripts/check-global-v2-economic-function.mjs` | PASS 72/72 |
| `node --experimental-strip-types scripts/check-global-v2-category-needs-materiality.mjs` | PASS 49/49 |
| `node node_modules/typescript/bin/tsc --noEmit` | PASS |
| `node scripts/check-architecture-imports.mjs` | PASS 491 fichiers |
| `node node_modules/next/dist/bin/next build` | PASS sur l'état final, après la dernière modification produit |
| `git diff --check` | PASS |

Total : **317 assertions exécutables PASS**. Les tests contiennent les invariants négatifs et les cas positifs; le compteur seul ne constitue pas la preuve, les assertions et la matrice ci-dessus la précisent. Aucun ancien payload live ni grosse certification History n'a été rejoué. Aucun code React, schéma Supabase, publication, oracle ou moteur History n'a été modifié.

### Handoff prévu après build et diff-check

`CURRENT_PROMPT = P04`

`BASELINE_HEAD = 3f358ed55f9d2c8d7b5fd88f493532702139d808`

`FINAL_HEAD = SELF — git log -1 --format=%H -- docs/global-v2/execution/P04-report.md`

`C1_CONTRACT = PASS`

`C2_IMPLEMENTATION = PASS`

`IMPLEMENTATION_GATE = PASS`

`CONTRACT_GATE = PASS`

`TEST_GATE = PASS`

`LIVE_GATE = NOT_RUN / NOT_REQUIRED`

`CAPABILITIES_ACTIVE = DESCRIPTIVE_TEMPORAL; EXACT_PROVEN_CHANGES; LIFECYCLE; SEMANTIC_FUSION; PRIMARY_DRIVER; CURRENT_REGIME; M1_TEMPORAL`

`CAPABILITIES_GATED = UNSOURCED_STABILITY_CLASS; UNPROVEN_PLATEAUS; ABSENT_OPTIONAL_SIGNAL_PRODUCERS`

`UNRESOLVED_REQUIREMENTS = NONE_WITHIN_P04_CONTRACT_AND_AUTHORIZED_FALLBACKS`

`LIVE_WRITES = NONE`

`NEXT_PERMITTED_PROMPT = P05`

`P04 = PASS — CHECKPOINT_LOCAL_ONLY; NO_PUSH; P05_NOT_STARTED`
