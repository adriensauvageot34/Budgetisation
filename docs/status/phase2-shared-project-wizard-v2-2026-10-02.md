# Ajouter une dépense V2 — livraison du 2 octobre 2026

Référence : `PROMPT_CODEX_MASTER_AJOUTER_UNE_DEPENSE_V2_COMPLET_2026-10-02.md` fourni par l’utilisateur. Travail effectué sur le dépôt courant, avec les contrats C1/C2, le Builder partagé et le moteur financier existants.

## Statut demandé

```ini
HEAD_BEFORE = c7d4ba98ded2b39d81d6d2812bb523152d282c88
HEAD_AFTER = bd7768ce0907ae2b5310b62d3860bcc725f42895
WORKTREE = main, checkout principal
ARCHITECTURE = PASS
QUESTION_RESOLVER = PASS
KNOWLEDGE_STATES = PASS
DEPENDENCY_INVALIDATION = PASS
DECISION_HISTORY = PASS
SHARED_COMPONENTS = PASS
TOP_NAV = PASS
EXIT_MODAL = PASS
NO_SCROLL_SHELL = PASS_ON_OBSERVED_DESKTOP_CASES
DATE_MODULE = PASS
ENTITY_SEARCH = PASS
ASSET_EDITOR = PASS
FUNDING_UI = PASS
COMPACT_PREVIEW = PASS_ON_OBSERVED_DESKTOP_CASES
RESTAURANT_STATUS = IMPLEMENTED
FAST_FOOD_STATUS = IMPLEMENTED
WORK_MEAL_STATUS = IMPLEMENTED
GROCERIES_STATUS = IMPLEMENTED
NIGHT_OUT_STATUS = IMPLEMENTED
VISIT_STATUS = IMPLEMENTED
ACTIVITY_STATUS = IMPLEMENTED
PURCHASE_STATUS = IMPLEMENTED
TRAVEL_STATUS = IMPLEMENTED
PROJECT_LINKING = PASS_FIXTURES
CHILD_INHERITANCE = PASS_FIXTURES
ROOT_TRANSPORT_SINGLETON = PASS
TRANSPORT_INTEGRATION = PASS
GOOGLE_PLACES_INTEGRATION = PASS_FIXTURES
FUNDING_INTEGRATION = PASS
MONTH_PROJECTION_INTEGRATION = PASS
RESTAURANT_GOLDEN_TEST = PASS
FAST_FOOD_GOLDEN_TEST = PASS
WORK_MEAL_GOLDEN_TEST = PASS
GROCERIES_GOLDEN_TEST = PASS
NIGHT_OUT_GOLDEN_TEST = PASS
VISIT_GOLDEN_TEST = PASS
ACTIVITY_GOLDEN_TEST = PASS
PURCHASE_GOLDEN_TEST = PASS
TRAVEL_GOLDEN_TEST = PASS
NO_SCROLL_CERTIFICATION = PARTIAL_BROWSER_COVERAGE
PREVIEW_SAVE_PARITY = PASS_SERVER_FIXTURES
ZERO_HISTORICAL_WRITE = PASS
MIGRATIONS = APPROVED_AND_APPLIED
RLS = ENABLED_4_EXISTING_POLICIES_UNCHANGED
BACKWARD_COMPATIBILITY = PASS_FIXTURES
UNIT_TESTS = PASS
INTEGRATION_TESTS = PASS_SYNTHETIC_SERVER_IO
TYPECHECK = PASS
LINT = NOT_CONFIGURED
BUILD = PASS
ILLUSTRATIONS_REGENERATED = NO
FULL_LIVE_BROWSER_SAVE_CERTIFICATION = NOT_TESTED
```

`HEAD_AFTER` désigne le commit d’implémentation. Le commit suivant ajoute uniquement ce rapport.

## Architecture et authorities

- `planned-question-engine.ts` contient le plan fini commun : conditions, priorités, dépendances, journal des décisions et ciblage des réparations. Il ne lit pas Supabase. Les six états de connaissance restent dérivés et locaux.
- `ContextualProjectWizard` consomme ce plan pour les neuf entrées. Calendrier, recherche d’entité, grilles paginées, éditeur inline, financement, résumé et aperçu sont partagés. Le hub conserve les neuf illustrations existantes.
- `planned-builder.ts` reste propriétaire de readiness, invalidation, suspension réversible, Undo et matérialisation des CostItems. Le moteur financier et les services de mobilité gardent leurs calculs.
- `context.project.version = 2` porte uniquement l’intention utile : périmètre financier, moment, canal, entité, références Google nécessaires, composants non chiffrés, hébergement et lien prospectif. Aucun journal de navigation, knowledge registry, readiness, Undo ou montant calculé parallèle n’est persisté.
- Preview, Save et Update utilisent le même parseur, la re-résolution du domaine et la validation des références live. Les projets à budget inconnu peuvent être enregistrés ; leur déclaration réalisée est refusée jusqu’au chiffrage.
- Réel, disponible prévu et estimation de fin de mois viennent des projections serveur existantes. Un réel indisponible reste « Non renseigné ». Les coûts connus restent visibles lorsque le projet est incomplet.

## Parcours et preuves automatiques

Nombre de questions du golden hors écran de résumé. Les branches facultatives peuvent en ajouter ; aucune assertion ne prétend couvrir toutes leurs combinaisons.

| Parcours | Questions | Déductions / questions évitées | Transport et financement |
|---|---:|---|---|
| Restaurant | 10 | Recherche directe ; ville issue des métadonnées ; aucune question baseline | Voiture root ; détail entrée 4 € ; financement canonique |
| Fast-food livré | 8 | Livraison structure le contexte ; aucun trajet utilisateur | Provider choisi ; aucun frais inventé |
| Repas travail apporté | 5 | Personne d’abord ; aucun commerce ou budget principal demandé | Aucun commute supplémentaire ; aucun achat artificiel |
| Courses habituelles | 8 | Estimation issue de la médiane de paniers canoniques suffisants | Baseline courses ; livraison sans Transport |
| Soirée chez Lucas | 9 | Contact et domicile liés ; aucune recherche d’établissement | Coût inconnu explicite ; aucun Gift automatique |
| Voir Marc / Fontès | 11 | Relation et domicile déduits ; format distinct de l’occasion | Retour contextuel ; deux routes dirigées ; essence économique |
| Activité cinéma | 7 | Type déduit de `movie_theater`, sans recherche fuzzy par nom | Total et participants financiers explicites |
| Achat en ligne | 8 | Produit → catégorie ; vendeur séparé du produit | Livraison sans trajet ; aucun faux lieu marchand |
| Séjour Annecy | 8 | Destination d’abord ; période → deux nuits | Hébergement chez proche ; budgets inconnus acceptés |

Les neuf goldens passent parsing Preview/Write, readiness et fin de parcours. Tests supplémentaires : 60 € → 45 repas + 15 alcool → 65 € après modification, coûts exclusifs, conservation des décisions indépendantes, retour et édition ciblée du résumé, suspension de frais incompatibles, Undo sans doublon, lien/détachement explicites, budget inconnu, payloads invalides et références étrangères au foyer.

Les vrais services/actions serveur sont exercés avec I/O synthétiques : Preview sans écriture, Save, Update, relecture, parité financière, refus de déclaration d’un budget inconnu, refus de personne/lien/portefeuille étrangers. Aucune table historique n’est accessible en écriture dans ces fixtures.

Hébergement : le budget principal ne supprime pas les nuitées. Passer chez un proche suspend le montant saisi et permet Undo. Une activité/événement sur plusieurs jours ouvre la capacité hébergement ; revenir à une seule journée suspend les nuitées devenues incompatibles.

Google : seules les références utiles sont persistées. L’adresse externe est relue côté serveur pour géocoder la destination, puis exclue des snapshots et du draft durable. Le passage Google → TomTom est commun aux restaurants, activités, destinations et vendeurs. Les dates ne sont déduites que d’un événement prospectif explicitement connu ; Google Places seul ne fournit pas de date d’événement.

## Contrôles navigateur locaux réellement effectués

CUA disponible et réutilisé ; aucune suite browser installée. Session existante sur `localhost:3000/mois-a-venir`.

- Hub et premier écran des neuf entrées : mesures à 1366 × 768, aucun conteneur scrollable détecté.
- Restaurant : choix de personnes/date/moment/occasion/lieu, détail d’une entrée, financement Swile, résumé et réponse Preview serveur. Éditeur avec funding observé à 1280 × 720, aperçu à 1366 × 768 ; aucun scroll.
- Fast-food livraison avec budget inconnu : provider explicite, aucune ligne de frais et aucun trajet ; Preview affiche « À préciser ».
- Repas travail apporté : aucun budget artificiel ; Preview du chemin gratuit.
- Marc / Fontès : domicile déduit, calendrier de retour, estimation réelle via serveur, deux variantes dirigées, péages inconnus explicitement différés ; coût carburant visible sans allocation Bank. Preview partiel cohérent, aucun scroll.
- Annecy : calendrier départ/retour, deux personnes, transport inconnu, éditeur hôtel avec quantité 2, prix 90 € saisi, budget principal inconnu. Les 180 € d’hôtel restent actifs ; Preview retourne le coût connu et les composants inconnus. Aucun bouton hors viewport et aucun scroll détecté.
- Fermeture/confirmation Continuer–Quitter observées. Aucune erreur console capturée ; avertissements de dimensions de logos préexistants hors lot.

Aucun Save navigateur live effectué. Les parcours navigateur complets Courses, Soirée, Activité et Achat restent à essayer manuellement. Les neufs parcours domaine ont leurs goldens automatiques. Les ajouts finaux du passage Google générique, du choix vendeur et des événements connus ont été vérifiés par fixtures/build, sans prétendre à une nouvelle session provider live.

Capture du hub hors Git : `C:/Users/Manon/Documents/Codex/2026-09-28/ve/outputs/ajouter-depense-v2-hub.jpg`. Viewport restauré, onglet de test fermé, dev server arrêté.

## Migration et audit live

Migration autorisée par l’utilisateur sous le nom préparé `20261002101500_phase2_project_unknown_budget.sql`, appliquée avec la version distante `20261002114837`, alignée dans le dépôt.

Elle adapte uniquement la contrainte CostItems pour un projet V2 explicitement non chiffré, sans créer un faux CostItem à zéro. Les anciens cas gratuits restent acceptés. Aucune nouvelle table, FK, policy RLS, donnée historique ou attribution de portefeuille n’est ajoutée.

Préflight et audit après tests : 0 ligne prospective. Audit final read-only : RLS activée, quatre policies existantes. Les probes RLS live antérieurs ne sont pas revendiqués comme réexécutés dans ce lot. Aucun projet, input mensuel ou historique live modifié par les smokes ; aucune fixture distante à nettoyer.

## Commandes et résultats

Depuis la racine du dépôt, avec le Node embarqué du workspace :

```text
node scripts/check-phase2-project-wizard.mjs                 PASS
node scripts/check-phase2-planned-domain.mjs                 PASS
node scripts/check-phase2-planned-server-contract.mjs        PASS
node scripts/check-phase2-planned-builder.mjs                PASS
node scripts/check-phase2-planned-finance.mjs                PASS
node scripts/check-phase2-planned-routes.mjs                 PASS
node scripts/check-phase2-planned-car.mjs                    PASS
node scripts/check-phase2-family-visits.mjs                  PASS
node scripts/check-phase2-google-places.mjs                  PASS
node scripts/check-phase2-planned-calendar.mjs               PASS
node scripts/check-phase2-planned-reliability.mjs            PASS
node scripts/check-phase2-planned-reality.mjs                PASS
node scripts/check-architecture-imports.mjs                 PASS
node node_modules/typescript/bin/tsc --noEmit                PASS
node node_modules/next/dist/bin/next build                   PASS
git diff --check                                            PASS
git diff --cached --check                                   PASS
```

Les checks financiers gardent leurs oracles et leur contrôle Bank ≠ carburant économique. Les assertions UI Finance/Reality ont été alignées sur les libellés compacts et le propriétaire commun des actions lifecycle ; les invariants financiers n’ont pas été retirés. Le check Architecture a révélé un ancien import type Client → Server : le type est maintenant dérivé du contrat de l’action serveur, sans déplacer de calcul dans React. Le build final couvre les modifications exécutables.

## Cleanup et limites

- Les anciens `RestaurantWizard` et `PlannedIntentBuilder` ne sont plus branchés sur l’entrée produit. Ils sont clairement identifiés comme écrans legacy conservés pour fixtures/compatibilité. Les helpers métier communs restent utilisés par le nouveau chemin.
- Une seule voie active pour les neuf parcours ; pas de registry React parallèle, pas de second moteur financier, pas de child Transport ni de profondeur supplémentaire de modulePath.
- Aucun secret ajouté aux fichiers versionnés ; aucune illustration régénérée, donnée bancaire réelle ou capture financière committée.
- Google Places fournit lieux/types/ville, sans catalogue daté de festivals ou réservation d’hébergement. Un événement connu dans les projets fournit sa date ; sinon l’app demande la date et accepte l’inconnu.
- Les smokes live ne certifient pas Save/reload avec écritures Supabase : leur parité est prouvée sur les services réels avec transport de données synthétique.
- Certification no-scroll limitée aux tailles/écrans observés. Pas de certification exhaustive de longues chaînes, de toutes les branches, de mobilité, de clavier ou de performance matérielle.
- Pas de recherche universelle, NLP, presets personnels, auto-learning, réservations, mémoire personnelle ou import de catalogue e-commerce ajoutés.

## Follow-ups

Validation manuelle des parcours restants en production par l’utilisateur ; écriture/relecture réelle d’un projet si souhaitée. Catalogue événementiel daté et recherche produit externe seulement dans un lot dédié. Aucun blocker de build ou de contrat serveur connu à la livraison.
