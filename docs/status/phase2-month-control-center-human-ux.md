# Centre de contrôle — refonte UX humaine

Date : 4 octobre 2026.

## Livraison et périmètre

- HEAD de départ : `3c0a3e70f18f1ab80943e450ccdddcc32e93b43a`, `main`, checkout initial propre et identique à `origin/main`.
- HEAD livré : le commit contenant ce rapport, intitulé `feat(phase2): simplify monthly control center UX`.
- Migration requise : **NO**. Aucun SQL, schéma, réglage temporel ou changement d'autorité financière.
- Aucune écriture Supabase live effectuée. Les captures du foyer restent hors Git.

## Mini-audit ciblé

| Sujet | Autorité existante / constat | Implantation |
| --- | --- | --- |
| Navigation | Contrat URL partagé, `MonthControlCenter`, `OverlayFrame`. Cinq zones et un accueil faisaient circuler entre les propriétaires. | Exactement trois onglets ; accueil supprimé ; ouverture principale sur Mes choix. |
| Objectifs et habitudes | `projectCategoryControls`, `month-decision-contract`, owner mensuel. | États compacts puis focus ; capacités publiées respectées ; limites, objectif global et choix actifs dans Mes choix. |
| Simulation | `simulateMonthChoice`, `monthChoiceDigest`, workbench, apply serveur existants. | Questions humaines, résultat de fin de mois avant/après puis gain ; aucune nouvelle formule. |
| Revenus, Banque et cartes | `MonthScenario`, projections Banque/wallets, `updateMonthControlInputs`. | Checklist sans formulaire au repos, puis un focus local. DTO sérialisable, imports de types isolés du module client. |
| Charges | Obligations canoniques, décisions conditionnelles, exclusions et overrides mensuels. | Chips explicites ; intention `set-month-fixed-state` dans le même owner, un seul upsert. |
| Cagnottes | `declaredOutflows`, `savings-allocations`, même JSON mensuel. | Intention `update-declared-savings` validée sur l'ID du foyer, sans supprimer/recréer ; protection conservée. |
| Fiabilité et mémoire | Policy temporelle, projection par périmètre, checkpoints existants. | Comprendre en lecture, historique et conservation explicite ; aucune réparation vers un autre onglet. |

## Navigation et responsabilités strictes

| Onglet | Mission | Contenu |
| --- | --- | --- |
| Mes choix | Décider et simuler | Mes limites, combien garder en fin de mois, simulateur, choix actifs, cagnottes. |
| Mettre à jour | Renseigner les faits et différences du mois | Revenus, Banque, Swile, Edenred, charges modifiées/conditionnelles puis charges habituelles. |
| Comprendre | Lire la construction de la prévision | Dépenses du mois, Banque, Swile/Edenred, méthode, historique, checkpoint explicite, détails techniques secondaires. |

La sidebar est le seul changement d'onglet interne. Les panneaux reçoivent `openEntity`, sans API de navigation entre onglets. Le bandeau commun contient trois faits non interactifs. Les liens depuis la page principale peuvent ouvrir directement le bon propriétaire et son focus.

`MonthLocalFocusProvider` reste un état local. Aucun focus n'est écrit dans Supabase. Retour remet la liste de l'onglet courant sans fermer la modal. Les onglets et retours rétablissent le haut du contenu ; un deep link positionne le focus concerné. Le mécanisme existant de fermeture, Escape, focus trap, scroll lock et restitution du focus reste dans `OverlayFrame`.

L'ancien composant d'accueil et ses styles inutilisés ont été retirés. Le Centre ne contient plus de branches Resources/Settings/Overview. Les anciens exports de présentation `CategoryTargetEditor`, `MonthGoalEditor`, `BenefitWalletEditor` et `BenefitWalletFunding` restent compatibles avec leurs fixtures ; aucun n'est monté dans le Centre livré. Ils n'ajoutent ni calcul, ni persistance, ni authority métier. Le détail de financement réutilisé possède un seul composant.

## Interactions par donnée

- Catégorie : état prévu/réalisé/limite, puis stepper ±25 €, −10 %, saisie précise accessible et sauvegarde explicite. Les postes fixes restent en suivi uniquement. Une capacité `targetAllowed=false` n'expose aucun éditeur.
- Objectif global : stepper ±50 €, projection actuelle et écart fournis par le serveur ; pas de dépense créée.
- Choix actifs : formulations humaines, Modifier et Revenir comme d'habitude dans Mes choix. Moins/Comme d'habitude/Plus/Montant précis consomment LOWER/NONE/HIGHER/CUSTOM existants. Les valeurs ±20 % restent inchangées.
- Cagnotte : stepper ±50 €, Protégée/Ajustable, date facultative, même ID à l'édition. Suppression secondaire derrière Plus d'options.
- Revenu : prévision habituelle, stepper ±50 €, saisie précise, Enregistrer ; retour au montant prévu si override actif.
- Banque : montant exact, date Aujourd'hui par défaut, choisir une date à la demande. Le détail utilise uniquement la projection serveur et remplace le formulaire.
- Swile/Edenred : résumé sans input, puis un seul sous-éditeur solde/chargement/financement/observations. Solde exact, chargement ±10 € et date facultative. À une même date, correction de l'observation existante ; autres dates conservées. Le chargement reste un flux distinct du stock.
- Charges fixes : Comme prévu/Pas ce mois-ci/Montant différent. Seul le dernier état expose montant et date. La confirmation met à jour exclusion et override ensemble.
- Charges conditionnelles : Oui/Non/Pas sûr ; montant/date seulement pour Oui. Aucun clic sur une chip n'enregistre.
- Comprendre : aucune mutation des inputs mensuels. Seule la conservation volontaire d'un checkpoint constitue une écriture, via l'action existante.

Les steppers ne manipulent que le brouillon du champ, en centimes ; ils ne calculent ni forecast, ni funding, ni disponibilité. Tous les résultats financiers viennent des propriétaires existants. Les inconnues restent affichées « À confirmer ».

## Simulation : garanties conservées

- Deux cibles distinctes au maximum ; doublon et troisième choix refusés.
- Replay complet depuis le mois enregistré, puis validation explicite d'Apply.
- Preview sans écriture ; résultat précédent retiré jusqu'au recalcul.
- Comparaison actuel/scénario ; dépenses prévues en moins distinctes des réservations libérées.
- Réalisé, déclaré et projets explicites conservés ; cagnottes protégées exclues des suggestions.
- Digest périmé refusé ; apply atomique par l'owner existant.
- Modes FULL_MONTH_SAFE et AS_OF_TEMPORAL consommés sans changer leurs règles.

## Compatibilité des liens

| Ancien lien | Destination |
| --- | --- |
| `control=overview` | Mes choix |
| `control=choices` | Mes choix |
| `control=settings` | Mettre à jour |
| `control=resources` | Mettre à jour |
| `control=reliability` | Comprendre |
| `resources` + Swile/Edenred/BANK | Focus du même élément dans Mettre à jour |
| Ancien focus `savings` ou `reserve-N` | Cagnottes dans Mes choix |
| Focus stable `savings:ID` | Même cagnotte dans Mes choix |
| Ancien settings + catégorie | Choix actif de cette catégorie dans Mes choix |
| Ancien choices + catégorie | Limite de cette catégorie dans Mes choix |
| `global-goal`, `goals`, `simulator` | Propriétaire Mes choix |

La page normalise le couple **section brute + focus** ensemble, avant le rendu. Le parser ignore les sections inconnues, y compris les propriétés héritées d'objet. Les IDs/catégories restent internes ; les intitulés visibles sont humains.

## Tests automatisés

Toutes les suites ci-dessous ont été exécutées avec le Node installé du poste. Fixtures synthétiques, SSR et analyses statiques sont distingués ; ce sont des preuves complémentaires aux parcours navigateur.

| Commande | Résultat final |
| --- | --- |
| `node scripts/check-phase2-month-control-center-human-ux.mjs` | **53/53 PASS** : HUX-001 à HUX-053 |
| `node scripts/check-phase2-month-control-center-ux.mjs` | **57/57 PASS** |
| `node scripts/check-phase2-month-control-center.mjs` | **85/85 PASS** |
| `node scripts/check-phase2-category-targets-choices.mjs` | **36/36 PASS** |
| `node scripts/check-phase2-savings-allocations.mjs` | PASS |
| `node scripts/check-phase2-benefit-wallets.mjs` | PASS |
| `node scripts/check-phase2-month-narrative.mjs` | PASS |
| `node scripts/check-phase2-october-contract.mjs` | PASS |
| `node scripts/check-phase2-planned-finance.mjs` | PASS |
| `node scripts/check-phase2-planned-reliability.mjs` | PASS |
| `node scripts/check-phase2-planned-guards.mjs` | PASS |
| `node scripts/check-phase2-project-wizard.mjs` | PASS |
| `node scripts/check-phase2-forecast-temporal-mode.mjs` | PASS |
| `node scripts/check-phase2-temporal-forecast.mjs` | PASS |
| `node scripts/check-global-v2-frontend.mjs` | PASS : frontend 728/728, schemas 71/71 |
| `node scripts/check-architecture-imports.mjs` | PASS |
| `node scripts/check-phase2-month-decision-engine.mjs` | SAME_PREEXISTING_FAILURE |
| `node node_modules/typescript/bin/tsc --noEmit` | PASS |
| `node node_modules/next/dist/bin/next build` | PASS |
| `git diff --check` | PASS avant commit |

Les assertions de présentation devenues obsolètes ont été adaptées au composant/libellé réellement livré. Les oracles financiers et les limites numériques n'ont pas été assouplis.

### Portée des preuves HUX

HUX-001..039 couvrent le contrat demandé ; HUX-040..053 ajoutent vocabulaire, liens externes, mutations atomiques de charge, ID stable de cagnotte, cibles/payloads invalides, LOWER/HIGHER/CUSTOM, zéro écriture Preview, états compacts, parser page, dates facultatives existantes et capacités interdites.

Les HUX de sauvegarde/reload utilisent les vraies actions de l'owner mensuel et le vrai codec de lecture dans un client synthétique. HUX-020 et HUX-022 vérifient ensuite le rendu SSR du même focus et l'absence de changement de section dans la sauvegarde. Ils ne prétendent pas prouver une sauvegarde Supabase live avec React hydraté. Les contrôles d'absence de navigation croisée sont identifiés `STATIC`, puis complétés par les parcours réels ci-dessous.

## Navigateur réel sur PC

Serveur dev temporaire `http://localhost:3001/mois-a-venir`, navigateur intégré, session authentifiée existante. Vérification exécutée via Cua ; aucune installation de suite browser, aucun nouveau login et aucune modification du foyer.

| Parcours effectivement exécuté | Résultat |
| --- | --- |
| Bouton principal → Mes choix, trois onglets, aucun accueil | PASS |
| Limite Courses → +25 €, saisie précise, Retour local | PASS sans sauvegarde |
| Objectif global → stepper ±50 €, projection actuelle | PASS sans sauvegarde |
| Restaurant une sortie en moins → Preview serveur | PASS |
| Ajouter Courses −25 € → deux choix, comparaison recalculée, aucun troisième | PASS |
| Réinitialiser le scénario local | PASS |
| Modifier une autre habitude → choix humain Moins/Comme d'habitude/Plus/Montant précis | PASS sans sauvegarde |
| Mettre à jour → checklist sans formulaire au repos | PASS |
| Banque → saisie exacte/Aujourd'hui, détail, Retour | PASS sans sauvegarde |
| Swile → chargement, puis solde, choisir une date | PASS : le second formulaire remplace le premier |
| Edenred après Swile | PASS : résumé indépendant, aucun éditeur Swile restant |
| Salaire Adrien → prévision habituelle/stepper/Retour | PASS sans sauvegarde |
| Loyer → Comme prévu remplace les champs de montant/date | PASS sans sauvegarde |
| Ornikar → Oui/Non/Pas sûr ; Pas sûr masque montant/date | PASS sans sauvegarde |
| Comprendre → trois périmètres, mode prudent, historique/checkpoint | PASS en lecture |
| Page → Modifier Swile | PASS : Mettre à jour / SWILE |
| Page → Gérer une cagnotte | PASS : Mes choix / savings:ID |
| Page → Fixer un repère Courses | PASS : Mes choix / category:groceries |
| Ancien `settings&focus=groceries` par navigation réelle | PASS : choix actif Courses dans Mes choix |
| Erreurs console capturées | Aucune erreur |
| Apply, sauvegarde d'un input, checkpoint, suppression, reload après écriture live | **NOT_TESTED** |

`BROWSER_USER_FLOW = PASS` pour les parcours de navigation, lecture et simulation demandés. `BROWSER_LIVE_WRITES = NOT_TESTED` : le brief et AGENTS.md imposent une autorisation avant ces écritures ; aucune n'a été sollicitée pour livrer ce lot. Les sauvegardes sont couvertes uniquement par fixtures serveur/SSR.

Les captures `mes-choix.jpg`, `mettre-a-jour.jpg`, `comprendre.jpg`, `swile-focus.jpg` et les logs restent hors Git dans `../../evidence/phase2-control-center-human-ux-2026-10-04`. Les captures contiennent des montants du foyer et ne sont pas intégrées à la production. Le serveur temporaire a été arrêté pour le build ; l'onglet de test a été fermé.

## Limites et suites éventuelles

- L'échec V1 `asOf excludes future history as well as future actuals` est identique au baseline après normalisation des chemins de stack. Les assertions suivantes de cette suite ne sont pas déclarées PASS. Aucun correctif financier n'est attribué à ce lot.
- Les sauvegardes, suppressions et checkpoints live restent à vérifier par l'utilisateur ou dans un test explicitement autorisé. Cela inclut le focus React après sauvegarde et reload réels.
- Les warnings dev de dimensions des logos déjà présents sur la page principale restent hors périmètre ; aucune erreur console dans les parcours du Centre.
- Vue PC ; aucune refonte responsive générale.
- Les informations manquantes propres aux PlannedExpenses restent dans leur parcours d'édition existant ; aucun Builder n'a été ajouté au Centre.
- Pas de nouvelle UI AS_OF détaillée, probable ce mois, effets contextuels, mémoire personnelle, optimiseur, moteur mobilité ou recalibrage low/high.

## Preuves versionnées

- `phase2-month-control-center-human-ux-tests.json` : 53 statuts synthétiques avec portée et compteurs d'écriture.
- `phase2-month-control-center-human-ux-verification.json` : commandes exécutées, résultat consolidé et portée navigateur/live.
