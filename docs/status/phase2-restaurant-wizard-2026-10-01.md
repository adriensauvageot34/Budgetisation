# Restaurant — wizard immersif V1

Brief : `PROMPT_CODEX_RESTAURANT_WIZARD_IMMERSIF_V1_2026-10-01.md`.

```ini
HEAD_BEFORE = 42d377115ca98f81a4e5c02079bd7f4cc2e80514
HEAD_AFTER = commit main contenant ce rapport (git log -1 --format=%H -- docs/status/phase2-restaurant-wizard-2026-10-01.md)
FILES_CHANGED = domaine/contrat/assets/builder/UX, page/actions/contrôle/transport/primitives, nouveaux composants/CSS, atlas/README, test ciblé, ce rapport
NEW_COMPONENTS = RestaurantWizard, RestaurantBillEditor, PlannedBuilderFrame, WizardChoice, WizardBackdrop, MiniCalendar
REMOVED_OLD_BEHAVIORS = sous-titres du hub, formulaire Restaurant empilé, titre à saisir, aperçu prématuré, détail de note dépliant la page

RESTAURANT_WIZARD_SHELL = IMPLEMENTED
AUTO_ADVANCE = IMPLEMENTED
CONDITIONAL_NEXT_BUTTON = IMPLEMENTED
DYNAMIC_TITLE = IMPLEMENTED
CATEGORY_CARD_BACKGROUNDS = IMPLEMENTED
RESTAURANT_STEP_BACKGROUNDS = IMPLEMENTED
ASSET_CARD_BACKGROUNDS = IMPLEMENTED
PARTY_SIZE_STEP = IMPLEMENTED
DATE_STEP = IMPLEMENTED
PARTICIPANTS_STEP = GROUP_ONLY
OCCASION_STEP = IMPLEMENTED
LOCATION_STEP = IMPLEMENTED
TRANSPORT_COST_KIND_STEP = IMPLEMENTED
TRANSPORT_MODE_STEP = IMPLEMENTED
TRANSPORT_HANDOFF = EXISTING_ROOT_LIVE_ENGINE
PRICE_KNOWLEDGE_STEP = IMPLEMENTED
DETAILED_BILL_STEP = IMPLEMENTED
SWILE_EDENRED_UI = ELIGIBLE_ASSET_TOGGLES
MONTPELLIER_RESTAURANT_SUGGESTIONS = EXACT_CITY_COMPATIBILITY
OUTSIDE_MONTPELLIER_FLOW = CITY_NAME_CUISINE_REQUIRED
ESTIMATED_PRICE_RANGE = 15_TO_40_EUR_PER_PARTICIPANT
GROUP_COST_SHARING = GROUP_ONLY_HOUSEHOLD_CONTRIBUTION
TRANSPORT_INTEGRATION = PASS_DOMAIN_HANDOFF
BUILD = PASS
TYPECHECK = PASS
LINT = NOT_CONFIGURED
TARGETED_TESTS = PASS
BROWSER_USER_FLOW = NOT_TESTED_BROWSER_UNAVAILABLE
REMOTE_DATABASE_WRITES = NONE
MIGRATION = NOT_REQUIRED
KNOWN_LIMITATIONS = identité solo sans mapping garanti, transport non automobile manuel, navigateur de test indisponible, lint absent
FOLLOW_UPS = checklist visuelle ci-dessous
```

## Changements

Composants nouveaux : `RestaurantWizard`, `RestaurantBillEditor` / `BillLineEditor`, `PlannedBuilderFrame`, `WizardChoice` / `WizardBackdrop`, calendrier compact. CSS dédié à un cadre fixe de bureau, avec transition courte et réduction de mouvement. L’étape remplace le contenu ; seul le contenu dense peut défiler à l’intérieur du cadre.

Le hub utilise les fonds photographiques et les icônes sans sous-titres. Restaurant est branché sur le nouveau parcours ; les autres intentions gardent leur orchestration. Le bouton d’aperçu arrive au résumé final. Retour, fermeture avec abandon explicite et Undo restent accessibles.

Les fichiers de domaine `planned-restaurant.ts` et `planned-restaurant-builder.ts` portent la politique de prix, le filtrage exact des restaurants de Montpellier, le titre et les validations d’intention. React orchestre leurs résultats. Le serveur parse le même contexte fermé, vérifie les références du foyer et rejette les estimations manipulées. Les seuls assets nouveaux sont le menu et le digestif, coûts réels du catalogue ; aucun pseudo-asset de navigation.

`context.restaurant` contient uniquement les intentions nécessaires (ville, établissement, cuisine, adresse, heure ou créneau, mode gratuit, participation au trajet, origine du prix). Les étapes, historique de navigation, intervalle calculé, état des champs en cours et Undo ne sont pas persistés. Le JSONB existant peut porter ces champs : aucun changement de schéma, de RLS ou d’historique.

## Comportements métier

- Seul / à deux sautent la composition ultérieure. À plusieurs permet personnes du foyer, contacts, noms prospectifs et invités non nommés.
- Montpellier ne propose que les lieux publics compatibles avec le rôle Restaurant et la commune exacte Montpellier. Aucun retour vers tous les lieux si la liste est vide.
- Ailleurs demande ville, nom et cuisine ; une adresse est demandée ensuite si nécessaire pour la voiture.
- Voiture réutilise le trajet racine Maison → Restaurant → Maison et le moteur Live existant. Un changement de lieu ou d’horaire invalide les faits du trajet. Le créneau matin/midi/soir n’invente aucune heure de routage.
- Tram, marche, vélo et autre gratuit gardent le contexte sans ligne de coût. Les autres moyens utilisent une contribution explicite du foyer. Le partage n’est proposé qu’à plusieurs.
- Prix inconnu : intervalle 15–40 €/personne et hypothèse centrale explicite 27,50 €/personne. Une seule ligne canonique, sans faux assetKey, sans deuxième montant persisté. Le serveur vérifie quantité et prix ; le coût se recalcule si la composition change.
- La note détaillée comporte 12 cartes et un unique éditeur. Quantité, prix et financement sont validés ensemble. Swile/Edenred sont proposés seulement aux assets éligibles ; l’alcool reste banque. Les saisies non validées nécessitent un abandon explicite avant de changer d’élément.
- Le passage d’un total ou d’une estimation au détail est explicite et réversible. Les lignes de transport et les compléments déjà existants sont préservés.
- Une question sur les habitudes reste nécessaire après le prix : la règle partagée Restaurant impose une réponse explicite pour l’absorption par l’enveloppe mensuelle.

## Preuves et commandes

Exécution avec le runtime Node du poste, depuis le dépôt :

```powershell
node scripts/check-phase2-restaurant-wizard.mjs
node scripts/check-phase2-planned-builder.mjs
node scripts/check-phase2-planned-server-contract.mjs
node scripts/check-phase2-planned-domain.mjs
node scripts/check-phase2-family-visits.mjs
node node_modules/typescript/bin/tsc --noEmit
node node_modules/next/dist/bin/next build
git diff --check
```

Les preuves ciblées couvrent : identité exacte sans déduction par email, prix pour solo/couple/groupe, recalcul et Undo, données invalides constructibles, ville exacte sans fallback, menu/digestif et eligibility funding, remplacement du total, contribution à quantité 1, endpoint racine et horaire, invalidation du lieu, anciennes lignes sans métadonnées Restaurant, parité serveur Preview/Save/rechargement dans le client mémoire, rejet cross-household et absence d’écriture historique dans ce client. Les suites C1/C2/C3 et Visites famille passent également.

La vérification navigateur a été tentée via le navigateur intégré : cache dev initial incohérent (404), puis retour HTTP 200 confirmé après renouvellement du cache. Webpack révèle une incompatibilité préexistante `node:crypto` dans le runtime historique ; le build normal Turbopack passe. Le navigateur intégré cesse ensuite de répondre aux commandes de contrôle des onglets malgré un onglet neuf et une réinitialisation de session. Aucun parcours visuel complet n’est certifié, aucune dépense de test live n’a été créée. Les statuts IMPLEMENTED sont étayés par code/typecheck/tests et ne prétendent pas être des PASS navigateur.

## Limites connues et suivi

1. Le foyer ne fournit pas encore de lien canonique garanti entre le compte connecté et une Person. L’identité solo utilise uniquement un id exact validé dans le foyer, un nom exact unique ou un foyer à une personne. Si l’identité n’est pas disponible, le choix de la personne reste dans l’entrée « Seul », sans ajouter une étape « Qui vient ? » ultérieure. Aucun choix arbitraire d’Adrien ou Manon.
2. Train/taxi/bus/autre et partage : coût manuel du foyer ; moteur automobile réservé à la voiture.
3. La projection centrale est une hypothèse de budget, non une note observée. Les assets personnalisés restent banque par défaut.
4. Les ajouts de modules ne sont pas repensés dans ce lot ; les compléments existants sont conservés. Les autres parcours restent sur leurs composants actuels.
5. Lint absent du dépôt : aucun PASS inventé. Contrôle visuel des étapes, de la note et du transport à effectuer dans l’application lorsque le navigateur répond.

## Checklist visuelle courte

- Restaurant → À deux → sans date → sans occasion → Montpellier → restaurant facultatif → tram → prix inconnu : 30–80 €, hypothèse 55 €, habitudes puis aperçu.
- Date précise + soir ; Saint-Valentin : titre dynamique, pas d’étape de participants pour le couple.
- Note détaillée : 2 plats à 22,50 € via Swile et 1 digestif à 15 € via banque ; total 60 €, aucun double comptage.
- À plusieurs : contacts / invités, quelqu’un d’autre conduit, contribution du foyer ; aucune multiplication de la contribution par le nombre d’invités.
- Ailleurs + voiture : ville/nom/cuisine puis adresse, calcul Live, conservation des frais manuels, carburant économique uniquement.
- Modifier lieu/horaire, Retour, Undo et abandon ; vérifier le recalcul et l’absence d’allongement de la page.

Visuels : atlas livré dans `public/planned-visuals/scene-atlas-v1.png`, génération originale imagegen sans référence ; conventions et direction de génération dans le README voisin.
