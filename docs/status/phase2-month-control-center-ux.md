# Centre de contrôle — polish UX et simulateur visible

Date : 4 octobre 2026.

## Livraison

- Baseline : `ddd41ff14e1d72ebb290f441f039835c8513cbf4`, branche `main`, checkout initial propre et identique à `origin/main`.
- Commit de livraison : `feat(phase2): refine control center and scenario explorer` ; son identifiant est celui du commit contenant ce rapport.
- Migration requise : **NON**. Aucune modification SQL, configuration temporelle ou écriture Supabase live dans ce lot.

## Mini-audit ciblé

| Sujet | Propriétaire existant et constat | Modification |
| --- | --- | --- |
| Headline, tensions, badge | `projectMonthControlCenter`, catégories de `projectCategoryControls`. Un mois sans objectif pouvait paraître déjà satisfait. Les imports étaient déjà une limitation non actionnable. | État explicite sans objectif / objectifs respectés / attention / données manquantes ; badge séparé, masqué à zéro, dédupliqué par cause, imports exclus. |
| Simulation | `simulateMonthChoice`, contrat des opérations et workbench serveur. L’exploration sans objectif n’était pas exposée par défaut. | Exploration libre explicite par défaut lorsque le plan existe ; module visible, presets UX vérifiés par les capacités et rejoués par le propriétaire existant. |
| Réductions | Stratégies génériques montant, pourcentage, occurrence ; plancher réalisé et explicite déjà appliqué par le moteur. | Restaurant 100 / occurrence / 50 %, tabac 5 / 10 / 20 %, courses 25 / 50 / 100 €, formulaire personnel selon les capacités. Aucune nouvelle formule. |
| Barre et fin de page | `MonthSectionNav`, `MonthStory`. Trois raccourcis redondants sous la projection. | Actions regroupées à droite, Centre immédiatement avant Ajouter, espace de 10 px ; projection finale dernier élément. |
| Paramètres, banque et cartes | Formulaires existants `updateMonthInputs` / `updateMonthControlInputs`, projections banque et wallets. Financement et édition des cartes répartis en plusieurs objets. | Une carte par wallet, financement interne, banque compacte, réglages actifs en premier, dates et décisions humaines. |
| Fiabilité | Policy temporelle, publication canonique et checkpoints existants. | Lecture par périmètre, mode en langage humain, IDs absents de l’UI, conservation explicite dans Historique, lien Diagnostic. |

## Implantation

- Objectifs enregistrés et simulation temporaire sont deux sections distinctes. Les objectifs ont un contexte réalisé/prévu, les postes fixes restent en suivi uniquement.
- Les suggestions de simulation sont des constructeurs d’opérations dans `month-control-contract`, sans calcul financier. Le serveur utilise `simulateMonthChoice` pour chaque alternative et pour le replay du draft complet.
- Deux cibles différentes au maximum ; aucune troisième ; cible déjà sélectionnée exclue. Le résultat précédent est retiré lors d’un recalcul. Changer de zone ou fermer le Centre conserve le draft local.
- Aucune table de comparaison, action Appliquer ou Réinitialiser sans choix. Avec un draft : comparaison actuel/scénario, dépenses évitées distinctes des réservations libérées, footer sticky explicitement temporaire.
- Aucun levier automatique sur une cagnotte protégée. L’édition volontaire existante reste accessible.
- Vue d’ensemble compacte : causes actionnables, limites séparées, observations réellement datées seulement ; groupes vides masqués.
- Hypothèses personnalisées et exceptions actives précèdent les autres contrôles. Une obligation confirmée présente montant/date, Modifier et Annuler la confirmation.
- Swile et Edenred présentent chacune chargement, solde, capacité, mise à jour et financement dans une seule carte. Le stock inconnu n’est jamais assimilé au chargement ou à de la Banque.
- Résumé du mois persistant. Les destinations contextuelles ouvrent aussi leurs disclosures parents, puis placent le focus dans la section concernée.
- `month-control-display` ne fait que formater montants, dates et libellés. `BenefitWalletFunding` est conservé comme compatibilité de présentation pour ses anciens appelants/tests et délègue au même détail de financement ; il n’est plus un objet wallet séparé dans le Centre.
- Aucun nouveau moteur, ledger, snapshot, mémoire personnelle, doctrine mobilité ou recalibrage bas/haut. Aucun changement de `month-choices`, de l’autorité financière ou des migrations.

## Vérification automatique

Exécutée avec le Node installé du poste. Les preuves JSON versionnées ne contiennent que des cas synthétiques et des statuts.

| Commande / suite | Résultat final |
| --- | --- |
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
| `node scripts/check-global-v2-frontend.mjs` | PASS |
| `node scripts/check-architecture-imports.mjs` | PASS |
| `node scripts/check-phase2-month-decision-engine.mjs` | Même échec préexistant, voir ci-dessous |
| `node node_modules/typescript/bin/tsc --noEmit` | PASS |
| `node node_modules/next/dist/bin/next build` | PASS, compilation de production et vérification TypeScript incluses |
| `git diff --check` | PASS avant commit |

Les quatre assertions de présentation existantes devenues obsolètes ont été adaptées au nouveau libellé/emplacement. Les oracles financiers n’ont pas changé.

### Garanties couvertes par les nouveaux tests

- Les presets suivent les capacités ; mobilité fixe exclue, réduction personnelle plafonnée par le moteur.
- Restaurant 100 % conserve observé, déclaré réalisé et projet explicite. Réduction occurrence et intensités comparées aux résultats du moteur générique.
- Courses 100 € est borné au reste réductible. Le deuxième choix rejoue le scénario complet ; ni doublon de cible ni troisième choix.
- Les cagnottes protégées sont inchangées ; dépenses évitées et réservation libérée restent distinctes.
- Preview : zéro écriture. Apply synthétique : un seul upsert mensuel, lecture après sauvegarde identique au Preview.
- Digest périmé : refus `STALE_PREVIEW`, zéro écriture. Aucune écriture PlannedExpense ou historique dans le harness.
- Mode `FULL_MONTH_SAFE` inchangé ; compatibilité du même workbench en `AS_OF_TEMPORAL` vérifiée.
- Rendu SSR des états, badge, disclosures, cartes et fiabilité ; contrôles statiques explicitement identifiés comme tels, sans les présenter comme preuve navigateur.

## Navigateur réel

Dev serveur temporaire sur `localhost:3001`, session authentifiée existante, vue PC. Onglet créé pour les contrôles fermé et override de viewport retiré à la fin.

| Parcours | Résultat |
| --- | --- |
| Barre après scroll, alignement à droite, badge séparé | PASS : Centre → Ajouter = 10 px ; barre à 8 px du haut ; projection finale dernier élément |
| Mois sans objectif, simulateur et neuf presets principaux visibles | PASS |
| Zéro choix, absence de table et d’actions d’application/reset | PASS |
| Restaurant 100 %, puis tabac 20 % | PASS : deux choix, comparaison recalculée, aucun troisième, cagnottes protégées inchangées |
| Navigation entre zones, fermeture/réouverture | PASS : le draft à deux choix est conservé |
| Footer d’application pendant le scroll interne | PASS : visible dans les limites de la modal |
| Reset, puis Courses −50 € | PASS : impact serveur recalculé, avant/après cohérent |
| « Fixer un repère » depuis Courses | PASS : la bonne section et son disclosure parent sont ouverts ; focus dans la section |
| Banque, une carte par wallet, obligation confirmée, Données & fiabilité | PASS en lecture seule |
| Erreurs console capturées | Aucune erreur |
| Apply, édition, reset d’un réglage, checkpoint et reload après écriture Supabase live | **NOT_TESTED** : aucune écriture live autorisée/exécutée pour ce lot |

`BROWSER_USER_FLOW = PARTIAL` : lecture et simulation réelles PASS, parcours d’écriture non exécuté. Badge zéro et états objectifs satisfaits/en attention prouvés par fixtures SSR/domain, pas par modification du foyer live.

Les logs et captures locales restent hors Git dans `../../evidence/phase2-control-center-ux-2026-10-04`. Aucun screenshot ou export bancaire personnel n’est livré en production.

## Limites connues

- La suite V1 `check-phase2-month-decision-engine` échoue dès `asOf excludes future history as well as future actuals`, avant comme après ce patch. Les deux sorties sont identiques après normalisation des positions de lignes ; les assertions suivantes de cette suite ne sont pas déclarées PASS. Son comportement temporel n’est pas modifié par ce chantier UX.
- Les warnings de dimensions des logos déjà existants en dev ne sont pas traités dans ce lot.
- Pas de responsive ajouté, usage PC demandé.
- Les essais Supabase live d’application et de reload restent à réaliser avec validation humaine. Ils ne sont pas nécessaires pour fournir le code et le commit demandés.
- AS_OF détaillé dans le Centre, « probable ce mois », effets contextuels, nouvel optimiseur et recalibrage low/high restent hors scope.

## Preuves versionnées

- `docs/status/phase2-month-control-center-ux-tests.json` : 57 cas, périmètre synthétique et compteurs d’écriture.
- `docs/status/phase2-month-control-center-ux-verification.json` : statut consolidé des commandes et du parcours navigateur.
