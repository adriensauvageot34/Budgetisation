# Patch V2.2 — multi-jour, navigation, date et résumé

Référence : `PROMPT_CODEX_PATCH_V2_2_MULTI_JOUR_NAV_DATE_RESUME_2026-10-02.md`, fourni par l’utilisateur. Implémentation incrémentale sur le Builder partagé et les contrats de domaine/serveur existants.

## Statut demandé

```ini
HEAD_BEFORE = a1957271cc4a06d9cf0a5ff2d8be0c4838ae7558
HEAD_AFTER = d1fb1ea0194ee7a14d4c340d45907bbf00675817
WORKTREE = main, checkout principal
FILES_CHANGED = 24 fichiers d’implémentation/tests + ce rapport

MULTIDAY_DATE_SELECTOR = PASS
MULTIDAY_CALENDAR_RENDERER = PASS
MULTIDAY_PANEL_SUMMARY = PASS
RETURN_DAY_INDICATOR = PASS
COST_DUPLICATION_GUARD = PASS

BACK_VISIBILITY = PASS
DECISION_HISTORY_BEHAVIOR = PASS

PARTICIPANT_SELECTOR = PASS
SOCIAL_PARTICIPANTS = PASS
FINANCIAL_SCOPE = PASS

DATE_TIME_COMBINED = PASS
DATE_RANGE_FLOW = PASS

EMPTY_ADDON_STEP_REMOVED = PASS
CONTEXTUAL_ADDONS_IN_SUMMARY = PASS

SUMMARY_LAYOUT = PASS
SUMMARY_OVERFLOW_FIXED = PASS_ON_OBSERVED_DESKTOP_CASES
SUMMARY_DUPLICATES_REMOVED = PASS
CONTEXTUAL_LABELS = PASS

RESTAURANT_TESTS = PASS_DOMAIN_AND_LOCAL_BROWSER
WORK_MEAL_TESTS = PASS_DOMAIN_AND_LOCAL_BROWSER
VISIT_SERVIAN_TEST = PASS_DOMAIN_AND_LOCAL_BROWSER_READ_ONLY
CALENDAR_TESTS = PASS

PREVIEW_SAVE_PARITY = PASS_SYNTHETIC_SERVER_IO
ZERO_HISTORICAL_WRITE = PASS

TYPECHECK = PASS
LINT = NOT_CONFIGURED
BUILD = PASS

KNOWN_LIMITATIONS = Couverture navigateur ciblée ; aucun Save live ou contrôle Vercel dans ce lot
FOLLOW_UPS = Vérification manuelle en production par l’utilisateur
```

`HEAD_AFTER` est le commit d’implémentation. Le commit suivant ajoute uniquement ce rapport. Les PASS domaine/serveur reposent sur les fixtures automatiques décrites ci-dessous ; ils ne prétendent pas certifier tous les parcours dans le navigateur live.

## Changements et authorities

### Une période partagée

`planned-dates.ts` expose le sélecteur pur commun. Il lit l’intention temporelle existante (`visitTiming`, `plannedDate`, `context.endDate`) et conserve la lecture des anciens journeys dirigés. Résumé, liste, calendrier, nuitées et demande de trajet consomment la même période. Aucun champ calendrier parallèle ni montant supplémentaire n’est persisté.

Les moments de retour optionnels restent de l’intention dans `context.project`. Le parseur partagé contrôle leurs valeurs, les heures exactes, l’ordre temporel et la cohérence entre `endDate` et `visitTiming.return.date`. Un changement de date/heure invalide les estimations et le Preview par le Builder existant. Reporter déplace aussi `context.endDate`, en conservant la durée.

### Calendrier multi-jour

L’algorithme existant du calendrier historique a été extrait dans `core/calendar-ribbons.ts`, sans montant ni écriture. L’historique utilise désormais cet algorithme partagé et ses 42 contrôles passent.

Le calendrier futur affiche des rubans par semaine, avec quatre lanes maximum et accès aux éléments supplémentaires via `+N`. Tous les jours ouvrent le même root. Le montant visible apparaît une fois par mois affiché, et le total financier reste ancré au projet unique. Le panel principal montre la période et les moments de départ/retour avant même de déplier le trajet. Le marqueur Retour exige un concept de retour ; une durée de festival seule ne l’invente pas.

La lecture serveur `readPlannedCalendarCarryovers` récupère les continuations du mois précédent dans la table prospective existante, sous le household et les RLS existants. Ces références alimentent uniquement le calendrier : elles ne deviennent ni un nouveau projet mensuel ni un coût dans le scénario du mois suivant. Le panel renvoie au mois d’origine pour modifier le root. Aucun doublon persisté, trigger ou migration.

### Parcours et participants

- Retour est absent du hub et apparaît après un choix réel. Le journal partagé contient les décisions répondues ; les anciennes pages moment/retour/add-ons automatiques ne sont plus ajoutées au parcours actif.
- À plusieurs ouvre la sélection du foyer, de proches existants et d’un nombre d’autres personnes. Aucun Person ou Place n’est créé. Les invités sociaux ne multiplient ni le prix ni le financement ; le périmètre financier par défaut reste le foyer sélectionné.
- `DateTimeDecision` rassemble date et moment, départ et retour, buckets et heures exactes. Sans date précise passe directement à la suite. Les anciennes périodes et heures sont conservées à l’ouverture de l’éditeur.
- L’écran automatique « Autre chose à prévoir ? » est supprimé. Les compléments se choisissent depuis le résumé, puis leur mini-flow revient au résumé. Les possibilités viennent du graphe partagé ; les suggestions ne créent aucun coût. Restaurant → Activity/Gift est ajouté au graphe existant selon les exemples du patch. Transport reste au root.
- Le résumé présente ses faits en deux colonnes, avec labels contextuels et sans seconde ligne descriptive Budget. Les cas chargés utilisent « Voir plus ». Le résumé normal observé tient dans le viewport, sans scrollbar interne ni ligne coupée.

Le composant de date isolé inutilisé a été supprimé après branchement et preuve du nouveau chemin. Les handlers de compatibilité `moment`, `visitReturn` et `groupScope` restent dans le reducer commun pour les anciens appels/tests ; ils ne sont plus des questions actives ni une seconde authority React.

## Preuves ciblées

### Automatiques

Commandes exécutées depuis la racine du dépôt avec le Node embarqué, présentées ci-dessous sous la forme `node` :

```text
node scripts/check-phase2-project-wizard.mjs                 PASS
node scripts/check-phase2-planned-domain.mjs                 PASS
node scripts/check-phase2-planned-server-contract.mjs        PASS
node scripts/check-phase2-planned-builder.mjs                PASS
node scripts/check-phase2-planned-calendar.mjs               PASS
node scripts/check-phase2-planned-reality.mjs                PASS
node --experimental-strip-types scripts/check-history-v2-calendar-daily-engines.mjs  PASS (42/42)
node scripts/check-architecture-imports.mjs                  PASS (728 fichiers)
node node_modules/typescript/bin/tsc --noEmit                PASS
node node_modules/next/dist/bin/next build                   PASS
git diff --check                                           PASS
```

Les neuf goldens domaine sont rejoués avec la décision composite date/moment et l’arrivée directe au résumé. Le cas GROUP vérifie cinq participants sociaux, deux personnes financées et un total inchangé de 60 €. Le journal Retour et les réparations sont vérifiés. Les fixtures Servian couvrent le vendredi 2 → dimanche 4, la lecture d’anciens timings, la cohérence transport, l’unknown et les payloads temporels invalides.

Les actions/services serveur réels sont exercés avec I/O synthétiques : Preview sans écriture, Save, relecture et égalité gross/fuel/payable/impact/funding. Une période octobre → novembre se relit comme continuation, sans projet financier en novembre, sans écriture et sans fuite inter-foyers. Les refus de références étrangères et de déclaration d’un budget inconnu restent vérifiés. Les tests lifecycle de déclaration/correction/restauration/report/suppression passent.

Le test calendrier couvre les mêmes ID sur chaque jour, le coût unique, la période dans le panel, la continuité sur plusieurs semaines et mois, quatre lanes et overflow, ainsi que le refus d’inventer un Retour pour une simple durée. Le rendu SSR de l’éditeur couvre aussi la conservation d’une ancienne date de fin et des deux heures exactes.

### Navigateur local

Infrastructure CUA existante réutilisée, sans nouvelle suite installée. Session connectée à `localhost:3000/mois-a-venir` ; brouillons locaux abandonnés, aucun Save live.

| Cas observé | Résultat |
|---|---|
| Restaurant à plusieurs | Foyer + proche + deux invités ; date puis moment dans le même écran ; total saisi inchangé ; arrivée directe au résumé. |
| Repas travail Adrien, acheté près du travail | Date inconnue sans page Moment ; lieu contextuel ; 7 € sur Swile ; absence de Transport inutile et de Budget descriptif dupliqué. |
| Résumé desktop | CTA et tous les faits visibles à 1366×768 ; repas travail aussi à 1280×720, sans débordement détecté. |
| Visite existante à Servian | Un ruban vendredi → dimanche ; retour visible ; panel du samedi ouvrant le même root et indiquant « projet en cours » ; période dans la liste. |
| Filtres calendrier | Charges masque le ruban ; Tout le réaffiche. |
| Complément depuis le résumé | Mini-flow Gift puis retour direct au projet ; aucune dépense séparée. |
| Date range avec deux heures exactes | Les deux champs et Continuer tiennent à 1280×720. |

La requête live de continuations est acceptée par PostgREST et la page recharge avec HTTP 200. Aucune fixture cross-month distante n’a été créée. La parité Preview/Save/reload cross-month est prouvée par les fixtures serveur, pas revendiquée comme un Save navigateur live.

Aucune erreur console capturée. Avertissements de dimensions de logos préexistants, hors patch. Capture du résumé hors Git : `C:/Users/Manon/Documents/Codex/2026-09-28/ve/outputs/patch-v2-2-resume.png`. Viewport restauré, onglet temporaire fermé, dev server arrêté.

## Frontière de données et limites

Aucune écriture Supabase live, aucun changement de schéma/RLS ni écriture historique dans ce lot. La ligne prospective existante a seulement été lue ; les smokes ont conservé les modifications dans des brouillons locaux. Les fixtures serveur n’écrivent que dans leur table prospective synthétique. Aucune image régénérée, donnée bancaire ou clé ajoutée au dépôt.

Le moteur financier et les intégrations de transport restent propriétaires de leurs calculs. L’extraction historique porte uniquement sur la présentation des rubans, avec le comportement vérifié par les tests existants.

Les neuf parcours complets disposent de goldens domaine ; la couverture visuelle détaillée porte sur les cas du tableau. Les combinaisons longues de compléments, les services externes en production et le Save navigateur restent à vérifier manuellement. Aucun PASS de déploiement Vercel n’est revendiqué.
