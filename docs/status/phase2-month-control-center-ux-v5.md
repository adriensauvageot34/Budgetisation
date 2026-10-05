# Centre de contrôle V5 — Piloter mon mois

Livraison du 5 octobre 2026, depuis le HEAD réellement présent sur `main`, initialement propre.

```ini
HEAD_BEFORE = 22e44e680a54fd06e7ccb83fb3ef7e62ff246ad8
HEAD_AFTER = 80eb167914f51d3c4dafdfd69d5ebf95ed1d633b
MIGRATION_REQUIRED = NO
MULTI_POST_UNIFIED = PASS
LEGACY_PILOT_WIZARD_REMOVED = PASS
POST_APPLY_STATE_FIXED = PASS_AUTOMATED
MANUAL_RECALCULATE_REMOVED = PASS
CONDITIONAL_ACTION_MATRIX = PASS
ELIGIBLE_TARGET_FILTER = PASS
HISTORY_AUDIT = PASS_READ_ONLY
HISTORY_COMPARABILITY = PASS_LOCAL_CERTIFIED
HISTORY_RAIL = PASS_SSR
HISTORY_CLICKABLE_PRESETS = PASS_AUTOMATED
ZERO_VERTICAL_SCROLL = PARTIAL
BROWSER_READ_ONLY = PASS
BROWSER_SIMULATION = PASS
BROWSER_FINANCIAL_WRITES = NOT_TESTED
LIVE_PERSONAL_FINANCIAL_WRITES = 0
TYPECHECK = PASS
BUILD = PASS
TARGETED_TESTS = PASS
```

HEAD_AFTER désigne le commit de code testé ; le commit documentaire suivant ajoute ce rapport sans modifier le code exécuté. Les qualificatifs ci-dessus distinguent les preuves automatiques, SSR et navigateur. Ils ne certifient pas des écritures SQL ou des parcours navigateur non exécutés.

## Owners et modifications

- `month-control-center.tsx` : succès Apply → opérations et trial vidés, focus/URL `pilot`, refresh, toast Undo. Une preview doit correspondre exactement au digest, aux opérations et au purpose. Les résultats sans changement effectif sont retirés automatiquement. Un résumé vide rend directement l’index et normalise son URL.
- `month-pilot-scenario.tsx` : sélecteur compact, synthèse intégrée sur l’index, compatibilité `pilot:add` / `pilot:review`, éditeur direct des cagnottes mensuelles ajustables. Aucun stage wizard. Pagination uniquement au-delà de huit candidats, pour ne pas déborder si de nombreuses cagnottes existent.
- `month-pilot-editor.tsx` : montant T et pipeline V4 conservés ; raccourcis H/P/C conditionnels ; cible secondaire ; retrait propre à un poste lorsque N>1 ; erreur locale conservée avec Apply visible disabled ; neutralité sans grand panneau vide ; rail historique et presets absolus.
- `month-control-workspace.tsx` : synthèse locale, cartes P→T conservées au retour, suppression du sous-titre de limite et du lien de résumé redondant.
- `month-control-center.module.css` : ajouts de densité et de focus clavier sur ordinateur uniquement ; aucun overflow ajouté pour masquer un débordement.
- `month-control-center.ts` serveur : candidats publiés depuis les capacités existantes et les SavingsAllocations. FIXED, PROTECTED, UNKNOWN et ANNUAL_PLAN ne sont pas ajoutables. Aucun candidat si le plan nécessaire à la simulation est indisponible. Le client filtre seulement les cibles déjà sélectionnées et la limite de deux.
- `month-category-history.ts` : même matcher, mêmes sources requises, même seuil minimum et même quantile ; diagnostic des rejets et candidats historiques indépendants de la fenêtre d’entraînement de la prévision.
- `scripts/check-phase2-month-control-center-v5.mjs`, `scripts/audit-phase2-month-control-history-v5.mjs`, `package.json` : tests ciblés et audit reproductible en lecture seule. Les assertions V4/spatiales devenues obsolètes ont été adaptées aux libellés et à la sélection historique V5 ; les oracles financiers sont inchangés.

Les contrats TEST_AMOUNT / TEST_SAVINGS, la sauvegarde des inputs, le digest, le replay, les modes FULL_MONTH_SAFE / AS_OF_TEMPORAL et Undo chiffré sont réutilisés. Aucun nouveau moteur, table, forecast React ou write historique.

Tous les call sites de MonthControlSimulator ont été cherchés. Aucun appel de production ne subsiste. Le fichier dormant reste uniquement pour les anciennes suites de régression, identifié comme tel ; il ne rend aucune destination Piloter V5. Les parcours catégorie, ajout, résumé et cagnotte passent par les composants V5. Aucun bouton de recalcul manuel n’y existe.

## Audit historique live — pourquoi zéro

Audit effectué au 5 octobre 2026 sur le seul foyer existant, via `readMonthPredictionEvidence`. Le script refuse un scope ambigu si plusieurs foyers existent. Aucune écriture.

Les douze mois candidats sont : août, septembre, octobre, novembre, décembre 2025 ; janvier, février, mars, avril, mai, juin et juillet 2026. Les mêmes motifs ci-dessous s’appliquent à chacun des douze mois ; les diagnostics individuels sont conservés dans l’artefact d’audit hors Git.

| Poste | candidateMonths | acceptedMonths | rejectedMonths | reasons, pour chaque mois |
| --- | --- | --- | --- | --- |
| Courses | 12 | 0 | 12 | SOURCE_COVERAGE_UNCERTIFIED:BANK, SWILE, EDENRED |
| Tabac & vape | 12 | 0 | 12 | SOURCE_COVERAGE_UNCERTIFIED:BANK |
| Restaurants du foyer | 12 | 0 | 12 | SOURCE_COVERAGE_UNCERTIFIED:BANK, SWILE, EDENRED |
| Repas travail · Adrien | 12 | 0 | 12 | SOURCE_COVERAGE_UNCERTIFIED:BANK, SWILE |
| Repas travail · Manon | 12 | 0 | 12 | SOURCE_COVERAGE_UNCERTIFIED:BANK, EDENRED |
| Café travail · Adrien | 12 | 0 | 12 | SOURCE_COVERAGE_UNCERTIFIED:BANK, SWILE |
| Trajets travail · Manon | 12 | 0 | 12 | SOURCE_COVERAGE_UNCERTIFIED:MOBILITY |

`completeMonthsBySource` est vide pour les quatre sources. `import_batches` contient un seul import Swile `imported`, mais `coverage_status=PARTIAL`, couvrant le 01/08/2025–29/08/2026. Aucune preuve d’import complet Banque, Edenred ou mobilité. La présence de dépenses canoniques ne suffit pas à prouver l’exhaustivité d’un mois. Ce zéro est donc explicable et ne doit pas être remplacé par des quantiles de prévision.

La règle de couverture était déjà locale au poste : Tabac exige Banque, sans exiger un wallet étranger ; repas exige les sources pertinentes. Elle est conservée. Le changement concerne les **candidats** : l’historique personnel n’est plus limité aux cinq mois d’entraînement du forecast. Tout mois passé déjà certifié dans l’évidence disponible peut être examiné. Aucun seuil de qualité n’est assoupli. Les mois courants/futurs, montants partiels, personnes de repas non résolues et carburants inconnus restent rejetés et diagnostiqués.

Des fixtures certifiées démontrent min/médiane/max réels, comparabilité locale, indépendance de T et rendu du rail. Les données live restent honnêtement à `0/3` : ligne compacte uniquement. La certification des imports historiques demeure à traiter dans leur owner ; aucune certification de couverture n’a été inventée ou écrite.

## Tests et commandes

Commandes Node utilisées, sans installation de nouvelle suite :

```text
node scripts/check-phase2-month-control-center-v5.mjs
node scripts/check-phase2-month-control-center-v4.mjs
node scripts/check-phase2-month-control-center.mjs
node scripts/check-phase2-month-control-center-spatial-ux.mjs
node scripts/check-phase2-month-control-center-human-ux.mjs
node scripts/check-phase2-month-control-center-choices-ux.mjs
node scripts/check-phase2-month-control-center-ux.mjs
node scripts/check-phase2-category-targets-choices.mjs
node scripts/check-phase2-savings-allocations.mjs
node scripts/check-phase2-benefit-wallets.mjs
node scripts/check-phase2-temporal-forecast.mjs
node scripts/check-phase2-forecast-temporal-mode.mjs
node scripts/check-phase2-planned-finance.mjs
node scripts/check-phase2-planned-reliability.mjs
node scripts/check-phase2-planned-guards.mjs
node --env-file=.env.local scripts/audit-phase2-month-control-history-v5.mjs <artefact hors Git>
node scripts/check-architecture-imports.mjs
node node_modules/typescript/bin/tsc --noEmit
node node_modules/next/dist/bin/next build
git diff --check
```

Résultats : V4 52/52 ; Centre 85/85 ; spatial 78/78 ; human UX 53/53 ; choices UX 68/68 ; UX 57/57 ; objectifs 36 ; cagnottes 21 ; wallets 36 ; temporel 63 ; modes 13 ; finance, fiabilité et guards PASS ; architecture 776 fichiers PASS. V5 38/38 certifie les cas MULTI/COND/HIST/APPLY ainsi que les smokes mono, multi, cible/remplacement, stale et relecture avec Undo dans le harnais synthétique existant.

Ces écritures traversent les vraies actions et le vrai owner read/save, avec un adaptateur de persistance en mémoire. Le test multi vérifie les deux P après relecture, puis la restauration exacte des inputs parsés. Cela ne constitue pas un test SQL ou navigateur de persistance réelle. Les vérifications de navigation non exécutables en SSR sont identifiées comme contrôles de source ; les parcours de navigation en lecture ont aussi été exécutés dans le navigateur.

## Parcours navigateur et limites

Localhost, session existante, lecture et Preview uniquement : baisse implicite, ajout compact, second éditeur identique, synthèse serveur totale sans décomposition financière naïve, retour sur l’index avec conservation des deux postes, retour à P retirant seulement le poste concerné, erreur de saisie avec Apply disabled, abandon complet et deep link `pilot:review` vide normalisé vers `pilot`. Console finale : aucune erreur. Tous les drafts d’essai ont été annulés.

32/32 mesures finales : 1728×780, 1440×760, 1920×900, 1920×1080 sur catégorie active, second poste, résumé à deux postes, index avec scénario, catégorie neutre avec autre poste, montant invalide, sélecteur et catégorie neutre. Chaque mesure confirme le viewport réel, `scrollHeight <= clientHeight + 1`, et zéro bouton hors cadre. Un changement de viewport encore en cours a été remesuré ; les tentatives et résultats finaux sont conservés.

Historique disponible, cagnotte multi, post-Apply financier et toast Undo ne sont pas certifiés visuellement sur un household isolé : la couverture globale zero-scroll reste donc PARTIAL. L’historique disponible et la cagnotte multi sont couverts par SSR/domain ; le post-Apply/Undo par les actions et contrôles automatiques.

Aucun environnement navigateur avec une base financière isolée n’est configuré. L’app locale utilise le projet personnel ; le seul harnais existant adapté aux écritures est en mémoire. Aucun smoke destructif n’a été déplacé sur les données personnelles. `BROWSER_FINANCIAL_WRITES=NOT_TESTED` inclut Apply/reload/Undo et écritures de cibles réels. Checklist restant à exécuter sur un environnement isolé : les cinq smokes du brief, puis mesures historique disponible/post-Apply/toast Undo aux quatre dimensions.

Artefacts, logs, capture et diagnostic live conservés hors Git dans le dossier `evidence` du workspace parent. Rapport et scripts seuls sont livrés ; aucune donnée bancaire personnelle ni secret n’est committé.
