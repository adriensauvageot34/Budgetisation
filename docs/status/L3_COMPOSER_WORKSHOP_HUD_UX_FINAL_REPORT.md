# L3 — Atelier Composer, HUD et finances latérales

## Verdict au stade de revue — 16 octobre 2026

**L3_IMPLEMENTED_NOT_RELEASED** au moment de cette préparation. Contrôles essentiels locaux PASS, livraison PR #46 en cours. La section G sera complétée après le résultat réel du déploiement.

## A. État de départ

- Main et Production initiales vérifiées : `ddfcf4b41d36b1ee024d4aecb0698907d7144cca`, PR #45 L2-B. Production initiale `dpl_BqKqvvRswKGtcWCVGcNvXCdH7Thr`, READY.
- Branche : `codex/composer-v3-l3-workshop-hud-ux`. Le commit local documentaire légitime L2-B `6d7d63c96fc718a16d847ab343b9f5a23630889d` est conservé, sans réécriture.
- L2-B présent : 26 presets, 26 WebP, contrat de présentation v1, neuf catégories, recherche/favoris locaux, À ajouter/À piloter, 13 Contexts et 114 options de palette.
- Produit L3 : `c93c184b455cdb7675114fc6e740ccf229e26721`, puis ajustement visuel final `7ef71167004cb7ce1dfb203a7aefaa6dffdb5251`.
- Six surfaces produit : shell, Board, carte, cockpit, CSS et nouvel inspecteur financier. Deux scripts de contrôle dédiés ; aucun changement de dépendance.

## B. Changements effectifs

| Surface | Avant | Après / comportement |
|---|---|---|
| En-tête | Commandes permanentes concurrentes, archives séparées | Identité du mois, état Draft concis, historique par icônes, Options du mois ; une primaire Transformer en Plan |
| Actions secondaires | Comparer et opérations Draft dispersés | Comparaison temporaire, simulation de secours, suggestions, finances, abandon, retour au Plan et archives dans le menu ; actions conditionnelles conservées |
| Statuts | Sauvegarde et projection peu hiérarchisées | CLEAN/DIRTY/SAVING/SAVED/ERROR/CONFLICT/OFFLINE ; Preview et révision officielle séparées. ERROR peut coexister avec FRESH et bloque toujours Apply |
| HUD | Fin de mois, référence répétée, impact nul, objectif vide | Reste prévisionnel prioritaire, impact officiel si pertinent, réservations connues, objectif/marge seulement si objectif réel ; référence dans le détail |
| Détail | Dialogue central interrompant le Board | Inspecteur non modal de 340 px, scroll interne, fermeture/Escape/focus ; sept rubriques officielles, référence/impact/reste, financement/trésorerie/Mobility préservés |
| Diagnostics | Codes visibles dans le détail ordinaire | Section avancée repliée ; aucune suppression de diagnostic |
| Board | Centrage vertical et vide au-dessus des cartes | Alignement haut, titre discret, rail de 268 px ; pagination, clusters et palette conservés |
| Familles | Distinction visuelle limitée | Sources protégées et contrôles ajustables différenciés par leurs capabilities existantes ; aucune nouvelle classification économique persistée |
| À préciser | Compteur de signalement | Liste latérale navigable par targetRef/contextOccurrenceId, révélation de page/cluster ; distinction information inconnue et blocage réel conservée |

L’Apply utilise la même fonction et la même expression d’interdiction qu’avant L3. Il n’est jamais déclenché par une navigation, l’ouverture de l’inspecteur ou une sauvegarde.

## C. Conservation de l’existant

Les onze suites ciblées sont **EXECUTED_PASS**, avec journaux et résultats nouveaux sous `evidence/l3-composer-workshop/`. Les anciens rapports générés L1/L2-A/L2-B sont restaurés à leurs octets antérieurs par le runner ; leurs nouveaux résultats sont copiés dans le dossier L3.

| Contrôle exécuté | Résultat / portée |
|---|---|
| `check-l3-workshop.mjs` | PASS, cas financiers A–E et rendu SSR ; recontrôlé au HEAD produit final |
| `check-b0-b1-plan-forecast.mjs` | PASS, contributions officielles, consommation/extra, épargne et Mobility |
| `check-l1-restaurant.mjs` | PASS, contrats Restaurant conservés |
| `check-l2a-presets.mjs` | PASS, recettes et identités L2-A |
| `check-l2b-library.mjs` | PASS, 26 presets/visuels, recherche/catégories/palette ; exécution longue conservée sans répétition |
| `check-phase2-planner-composer.mjs` | PASS, 35 contrôles C8 dont C8-017, C8-018 et Apply/Reload synthétique |
| `check-phase2-planner-p13.mjs` | PASS, protections transactionnelles et relecture |
| `check-phase2-planner-kernel.mjs` | PASS, protections, permissions, UNKNOWN, concurrence/idempotence et frontières d’écriture |
| `check-composer-post-snap3-draft-http.mjs` | PASS, transport Draft existant |
| `check-composer-p14-p2-scheduler.mjs` | PASS, fraîcheur, concurrence, réponses hors ordre |
| `check-planner-performance-parity.mjs` | PASS, 22 scénarios × 9 empreintes |
| TypeScript `node node_modules/typescript/bin/tsc --noEmit` | PASS, code de sortie 0 au HEAD produit final |

Ces suites emploient le vrai Compiler/Finance V2 et, selon le script, PGlite synthétique. **Elles ne certifient pas un Apply/Reload Supabase authentifié.** Aucun Apply personnel n’est exécuté dans L3.

Draft, scheduler, contrats financiers/domain, services serveur, SNAP-3, PlanRevision et migrations sont inchangés. Le contrôle L3 vérifie aussi cette frontière et l’identité textuelle des guards Apply.

## D. Exactitude financière

| Cas | Preuve / résultat |
|---|---|
| A inchangé | Impact `0.00`, projection identique à l’ancien cockpit ; pas de double grand chiffre |
| B Courses 325 → 350 | Impact officiel `-25.00`. Fixture navigateur séparée : reste 917 → 892, état PENDING masqué puis FRESH |
| C Restaurant 40 couvert | Impact officiel `0.00`, aucune dépense extra inventée |
| D Restaurant 40 extra | Impact officiel `-40.00` |
| E prix UNKNOWN | Impact null, complétude UNKNOWN ; l’achat sans prix n’est pas converti en zéro |
| F réserve protégée | `KERNEL-PROTECTED-SAVINGS` PASS ; consultation protégée vérifiée en UI, sans éditeur |
| G coût Mobility | `T9_MOBILITY_USAGE_IS_NOT_FUEL_PAYMENT` PASS ; coût d’usage séparé du carburant payé |

Le HUD lit `plan.economicMonthEndRemainder`, `plan.impactOnMonthEnd`, les réservations et l’objectif déjà publiés. Il ne somme aucune marginalImpact. Le détail conserve les contributions officielles, les périodes/provenances du modèle et la distinction réservation / consommation / trésorerie. Aucune reconstruction World n’est déclenchée par l’inspecteur.

Pendant une Preview non fraîche, les montants financiers du HUD et du détail sont remplacés par « — » / « En attente ». Le scénario garde ses informations connues ; les inconnues restent explicites.

## E. UX réelle et captures

**Navigateur desktop réellement exécuté, sur fixture isolée** utilisant les composants Composer et React compilé/minifié en mode production. Ce serveur de fixture n’est pas un build Next authentifié. Les appels distants sont interdits par la fixture. Les captures ne contiennent pas de finances personnelles.

- Avant : [atelier 1440](evidence/l3-composer-workshop/before-1440.jpg).
- Après : [atelier 1728](evidence/l3-composer-workshop/atelier-final-1728.jpg).
- Inspecteur final : [1440](evidence/l3-composer-workshop/finance-final-1440.jpg), [1728](evidence/l3-composer-workshop/finance-final-1728.jpg), [1920](evidence/l3-composer-workshop/finance-final-1920.jpg).
- [À préciser → décision identifiée](evidence/l3-composer-workshop/unresolved-focused-1440.jpg), [SAVING / Preview](evidence/l3-composer-workshop/saving-1440.jpg), [ERROR et récupération](evidence/l3-composer-workshop/error-options-1440.jpg), [CONFLICT](evidence/l3-composer-workshop/conflict-options-1440.jpg).

| Viewport effectif | Document | HUD hauteur | Board avec inspecteur | Inspecteur | Palette visible |
|---|---:|---:|---|---:|---|
| 1440 × 900 | 1440 px | 72 px | 756 × 772,75 px | 340 px | 732 × 114 px, sans chevauchement |
| 1728 × 900 | 1728 px | 72 px | 1044 × 772,75 px | 340 px | 1020 × 114 px, sans chevauchement |
| 1920 × 1080 | 1920 px | 72 px | 1236 × 952,75 px | 340 px | 1212 × 114 px, sans chevauchement |

Mesures DOM réelles dans `desktop-dimensions.json`, inspectées avec les captures. Deux zones de scroll nécessaires à panneau ouvert : bibliothèque et contenu financier. La palette reste dans le Board. Le HUD final ne s’étire pas à 1920 px. Le menu Options utilise des lignes alignées, pas une rangée de gros boutons.

La simplification est éditoriale et spatiale : la hauteur mesurée du header passe de 81,25 à 95,25 px et celle du HUD de 62 à 72 px dans cette fixture. **Aucune réduction de hauteur n’est revendiquée.** Le gain porte sur la hiérarchie, les redondances supprimées, le haut du Board et la consultation latérale.

Parcours vérifiés :

1. Recherche Amazon → création → article libre → confirmation → Undo/Redo pendant Preview → sauvegarde → Reload → réédition : même digest et illustration WebP 1200 × 600 conservés. Aucun prix/date inventé, aucun Apply.
2. Statut SAVING indépendant de PENDING ; Apply désactivé ; SAVED distinct de FRESH.
3. Échec réseau de sauvegarde : Draft conservé, ERROR/FRESH distincts, « Réessayer la sauvegarde » accessible, Apply désactivé.
4. Deux onglets : premier Courses 370 sauvegardé, second 380 rejeté en CONFLICT ; commande de chargement avec confirmation ; retour à 370/SAVED, sans écrasement.
5. Comparaison temporaire : pas de mutation du digest, primaire Apply absente du scénario de comparaison, retour au scénario conservé.
6. À piloter rejoint l’unique Courses ; contrôle protégé consultable sans éditeur ; navigation À préciser rejoint une identité puis son cluster existant.
7. Inspecteur non modal, focus au titre, Escape ferme et restitue le focus ; boutons d’icônes nommés ; catégorie fermée non montée.

Drag-and-drop natif manuel L3 : **NOT_RUN** ; handlers inchangés et contrôles C8/L2-B PASS. Offline navigateur : **NOT_RUN**, contrat existant conservé. Pas de chantier mobile.

Un défaut React observé pendant le développement (label objet au lieu de chaîne dans l’inspecteur) a été corrigé, puis SSR/TypeScript et navigateur rejoués avec succès. Les journaux d’essais initiaux restent conservés ; ils ne décrivent pas le statut final.

## F. Performance ciblée

Référence : arbre produit exact `ddfcf4b`. Candidat : arbre produit `7ef7116`. Même fixture L1_L3_PERF, viewport effectif 1440 × 900, mêmes dépendances, React de production minifié/split, même CSS global, historiques P3 non activés. Échauffement initial exclu, puis trois rechargements appariés alternés. Aucune charge de tests lourds en parallèle.

Sonde L2-A existante : `performance.now()` jusqu’au premier FRESH puis deux animation frames ; durées de l’outil Codex exclues. Le paramètre `delayRead=500` ne retarde pas le READ initial dans ce serveur. Les temps incluent la fixture synthétique chaude, pas le réseau Supabase/Vercel. Ce protocole n’est ni Next Production, ni une certification de latence réelle.

| Mesure locale | Référence | L3 |
|---|---:|---:|
| Ouverture → FRESH médiane, n=3 | 178,8 ms | 198,4 ms |
| Étendue | 174,3–198,5 ms | 195,3–286,8 ms |
| Nœuds DOM au repos | 1906 | 1900 |
| Images au repos | 5 | 5 |
| Requêtes métier par ouverture | 2 | 2 |
| JS initial décodé | 450 420 octets | 457 023 octets |
| JS gzip calculé sur fichiers | 142 373 octets | 144 356 octets |
| CSS décodé, global inclus | 152 301 octets | 156 954 octets |

Paires individuelles : 178,8/286,8 ; 198,5/198,4 ; 174,3/195,3 ms. Même digest sur les six ouvertures. La médiane augmente de 19,6 ms ; n=3 ne permet pas d’attribuer toute la variabilité à L3 ni de certifier un P95. Surcoût JS gzip : 1 983 octets (≈1,4 %), sans nouvelle dépendance.

Ouverture du panneau : +229 nœuds montés à la demande, **zéro requête métier supplémentaire** (les deux mêmes fetches conservés). Son délai précis de peinture et édition → FRESH ne sont pas instrumentés séparément dans cette campagne : **NOT_MEASURED**. Les interactions ont été exécutées sans blocage observé ; aucune cible P95 <100 ms ni ouverture réelle <2 s n’est revendiquée.

Preuves brutes : `performance-pairs.json`, résumé `performance-summary.json`, `panel-no-extra-read.json`. Pas de nouvelle campagne Canonical/SNAP ni de cache ajouté.

## G. Livraison et rollback

- PR : https://github.com/adriensauvageot34/Budgetisation/pull/46.
- Produit final testé : `7ef71167004cb7ce1dfb203a7aefaa6dffdb5251`.
- Preview produit : `dpl_B5mT4UmRhzJtggBh4RJCDL4zpGxW`, READY ; statut GitHub Vercel success. Build Next complet distant ; dépendances réutilisées, pas installation fraîche locale certifiée.
- Merge et Production : **en attente à ce stade de revue**, à compléter après exécution réelle.
- Mutations Draft/financières Production : aucune autorisée ni exécutée. Smoke authentifié final limité au rendu et aux actions de présentation.
- Rollback : revert des deux commits produit L3, puis déploiement Git normal (ou rollback Vercel vers le déploiement initial). Aucun schéma, contrat de sauvegarde ou contenu de Draft à convertir/supprimer.

## H. Limites et décision

Qualité UI : parcours et trois résolutions desktop PASS_LIMITED_FIXTURE, hiérarchie et panneau réellement observés. Justesse financière : suites ciblées et parité PASS_SYNTHETIC_ONLY. Auth/Apply réel Production non revendiqué ; aucune nouvelle PlanRevision personnelle créée. Les réserves de performance Canonical/P14 restent héritées et ne sont pas réauditées ici.

Les gates essentiels permettent la livraison UI indépendante. Le verdict de livraison final sera consigné après le résultat exact de Production. **Arrêt après L3 ; aucun L4 commencé.**
