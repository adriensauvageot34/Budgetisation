# Mois à venir — V5 : projection et décisions

## Livraison

Base : `c0e3067` sur `main`. Desktop uniquement. Le moteur économique et les contrats PlannedExpense restent les autorités ; React présente les résultats et orchestre les actions.

```text
FILES_CHANGED = domain/month-decision-contract ; server/forecast-statistics, remaining-month-forecast, forecast-memory, month-decision-projection, past-month-review, month-prediction-evidence, month-forecast-snapshot, month-scenario ; mois-a-venir/actions, page, month-story, month-forecast-view, month-narrative-cards, month-decision-tools, month-section-nav, past-month-view, planned-expense-interactions, planned-expenses-control ; tests ; migration
MIGRATIONS = 20260930183040_phase2_forecast_checkpoints.sql — approuvée et appliquée
PAGE_FLOW_CHANGES = ordre V4 conservé ; transitions décomposées ; jalon projets masqué si impact marginal nul ; charges compactées ; carte finale claire
TEMPORAL_MODE = FUTURE_MONTH / CURRENT_MONTH / PAST_MONTH ; date de calcul explicite
ESSENTIAL_FORECAST = courbe cumulative courses + nowcast si couverture suffisante ; cadence tabac ; jours ouvrés et trajets canoniques
OPTIONAL_FORECAST = occurrences avant euros ; prix conditionnel robuste ; P0/P1/P2/P3+ ; zéro possible ; occupation commune des opportunités avec les projets
RECENCY_AND_SHIFT = politique centrale : poids 3 sur trois mois récents, 1 sur précédents ; poids 6 pour rupture soutenue de trois mois ; aucune réaction de rupture à un seul outlier
FORECAST_CALIBRATION = erreurs signées par catégorie/horizon ; au moins quatre mois terminés FULL ; versions incompatibles et hypothèses personnelles exclues ; inactive si recul insuffisant
FORECAST_CHANGE_EXPLANATION = composantes signées réconciliées au centime ; écarts visibles réconciliés aux jalons arrondis ; stabilité exige trois jours distincts
MONTH_ASSUMPTIONS = historique par défaut ; LOWER / HIGHER / CUSTOM explicites ; mois seul ; suppression rétablit la référence ; pas d’apprentissage silencieux
SIMULATION_TOOLS = Preview PlannedExpense existant ; scénarios comportementaux calculés côté serveur sans write ; conservation seulement par action explicite
MONTH_END_GOAL = objectif facultatif éditable/supprimable ; écart exact par scénario ; pas de copie au mois suivant
ATTENTION_SYSTEM = projets passés non confirmés ; ressource repas affectée à 90 % ou shortfall ; rythme essentiel supérieur de 30 % ; révision supérieure à max(50 €, 10 %) ; imports incomplets ; section absente sans signal
PAST_MONTH_REVIEW = début/milieu/fin réellement conservés ; prévu/observé/écart ; écart définitif seulement avec FULL ; lien vers le bilan historique canonique ; consultation zéro-write
UI_UX_CHANGES = navigation sticky desktop active ; haut raccourci ; confiance humaine dans Pourquoi ; observé + restant + total en cours de mois ; financement repas secondaire conditionnel
TESTS_ADDED_OR_UPDATED = check-phase2-month-decision-engine.mjs ; check-phase2-month-narrative.mjs
RESULTS = suites ciblées PASS ; audit live RLS/immutabilité PASS ; build et typecheck PASS
```

## Commandes

```powershell
node scripts/check-phase2-month-decision-engine.mjs
node scripts/check-phase2-month-narrative.mjs
node scripts/check-phase2-planned-finance.mjs
node scripts/check-phase2-planned-calendar.mjs
node scripts/check-phase2-post-v1-fixes.mjs
node scripts/check-phase2-month-decisions.mjs
node node_modules/typescript/bin/tsc --noEmit --incremental false
node node_modules/next/dist/bin/next build
git diff --check
```

Les commandes utilisent le Node fourni par le runtime Codex sur ce poste. Les fixtures sont synthétiques et les écritures des tests sont en mémoire.

## Preuves et frontières

- Les catégories et les montants signés expliquent exactement le scénario central de MonthScenario. L’ajustement des arrondis reste une projection de présentation, jamais une entrée financière.
- Preview/Save/reload, split sans double occurrence, repas par personne, baseline habituelle/extra, déclaration neutre, financement et calendrier sont rejoués par les tests existants.
- Date de calcul explicite ; les observations et mois historiques futurs sont exclus. Aucun tirage aléatoire.
- Les deux simulations et les consultations ne modifient ni paramètres ni dépenses. L’écriture d’une hypothèse, d’un objectif ou d’une prévision conservée exige une action explicite authentifiée et un foyer résolu côté serveur.
- Les checkpoints n’enregistrent que sorties dérivées, version, composantes et digests. Ils ne remplacent pas les faits canoniques et ne sont jamais écrasés.
- Audit distant après migration : table vide, RLS actif, SELECT authentifié limité au foyer, INSERT navigateur interdit, INSERT serveur autorisé, UPDATE serveur interdit, trigger immutable actif. Le trigger ne contient aucune écriture historique.
- La migration ne touche aucune table historique. Aucun fixture live ni test bancaire réel n’est ajouté par ce lot.

## Limites connues

- Les imports live sont `PARTIAL`. Aucun mois terminé n’est déclaré complet par déduction de la dernière opération. La calibration personnelle attend des imports `FULL` et des checkpoints effectivement conservés.
- La conservation des prévisions est explicite. Les estimations de début/milieu/fin qui n’ont pas été conservées restent indisponibles ; aucun historique rétroactif n’est inventé.
- « Imprévus » est omis : aucune classification empirique fiable n’existe dans les sources actuelles.
- Présence au travail et attribution des cafés restent des hypothèses déclarées. Congés, météo, saisonnalité complexe et mémoire personnelle automatique ne sont pas ajoutés.
- Les poches repas indiquent les affectations explicites des projets. Un repas facultatif estimé ne réserve pas automatiquement une poche de financement.
- Un shim serveur conserve la lecture des anciennes fixtures/snapshots sans evidence enrichie ; production attache l’evidence et la mémoire. Aucune seconde authority React.
- Pas d’appariement silencieux entre une déclaration prospective et un débit importé. Le bilan passé utilise uniquement les faits canoniques.
- Le bilan des catégories n’est pas présenté comme un solde bancaire final. Le bilan historique complet conserve son propre contrat.
- Les rôles/grants et le trigger sont vérifiés en lecture sur la base distante ; les tests d’idempotence et de refus inter-foyers utilisent le transport en mémoire. Aucun nouveau test live d’écriture n’est revendiqué.

## Déploiement

Livraison par commit et push sur `main`, via l’intégration Git Vercel existante. La vérification de production porte sur le commit livré et les parcours en lecture/simulation ; les contrôles des écritures restent dans les fixtures synthétiques.
