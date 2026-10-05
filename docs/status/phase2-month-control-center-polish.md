# Centre de contrôle — finition desktop

Date : 5 octobre 2026. Brief : `7cf12c44-69b3-43fd-bcad-f5b70c4f762b/Texte collé.txt`.

## Périmètre et fichiers

Finition du Centre existant, sans travail mobile, migration ni nouvelle authority financière.

- `month-control-center.tsx` : navigation, focus, debounce, protection contre les réponses obsolètes, confirmations et annulation.
- `month-control-center.module.css` : surfaces desktop, densité, formulaires en colonnes, mouvement spatial court et réduction des animations.
- `month-control-workspace.tsx`, `month-control-simulator.tsx` : candidate unique, comparaison avant/après, budgets cibles et simulations distincts.
- `month-choice-controls.tsx`, `month-choice-editors.tsx`, `month-control-choices.tsx` : retours locaux, objectif précis, cagnottes et lecture seule protégée.
- `month-update-spatial.tsx`, `month-control-update.tsx`, `currency-stepper.tsx` : quatre états, accès direct aux formulaires, dates conditionnelles, observations connues.
- `month-update-status.ts`, `month-update-presentation.ts`, `month-control-center.ts` serveur : enrichissements de présentation depuis les owners existants.
- `actions.ts`, `month-choice-undo.ts` : annulation authentifiée, limitée à l'état exact après application.
- Cinq scripts de vérification du Centre : adaptation des assertions UX et preuves négatives d'annulation.

## UX et UI

Budget cible, simulation et ajustement enregistré sont distingués. Une candidate calculée par le serveur alimente les deux intentions « Garder comme budget cible » et « Appliquer ». Les conséquences affichent poste avant/après, marge gagnée et projection avant/après. L'historique garde une place constante et montre des tirets lorsque les mois comparables manquent.

Le pilotage classe les ajustements actifs puis les budgets dépassés et les montants prévus. La limite de deux choix est un contrat partagé et serveur existant ; elle est conservée et indiquée. Les cagnottes ajustables sont disponibles dans ce même simulateur. Une réservation libérée reste distincte d'une dépense évitée.

Banque conserve sa dernière observation datée même si le disponible actuel est incertain. Les zéros issus d'imports incomplets sont « à consolider ». L'épargne protégée ne présente aucun formulaire ni action de modification. L'objectif de fin de mois se saisit en euros et reste visible dans le header avec l'écart.

La navigation utilise des retours locaux cohérents, un reset de position sans `scrollIntoView` et une restauration du focus. Escape a été essayé réellement depuis Confirmés vers la grille ; la carte Confirmés récupère le focus. Les transitions spatiales durent 180 ms et respectent la réduction de mouvement. Les previews sont retardées de 180 ms et les réponses sont gardées par numéro de requête.

## Métier et robustesse

Les calculs de forecast, financement, cash et épargne restent chez leurs owners existants. Les conversions numériques React construisent les saisies ; elles ne publient pas une seconde projection.

L'annulation est un reçu AES-GCM éphémère : acteur, foyer, mois, expiration et digest de l'état après application. Elle restaure uniquement les scopes du scénario, refuse un mois modifié, une autre identité, un reçu altéré ou expiré et une cagnotte protégée. Aucune table n'est ajoutée. Le reçu chiffré et les seules intentions du brouillon peuvent survivre temporairement au remontage du composant dans `sessionStorage`, avec scope de publication et de mois ; il ne constitue ni mémoire personnelle ni état mensuel persistant. Les tests négatifs sont synthétiques. Les résultats de preview ne sont jamais stockés : le serveur recalcule le brouillon restauré.

## Zéro-scroll : méthode et itérations

Mesures dans le navigateur réel sur Vercel : `window.innerWidth/innerHeight`, `scrollHeight <= clientHeight` pour le dialogue, son contenu, le contenu du Centre et la surface locale. Vérification supplémentaire : boutons et inputs visibles dans les limites verticales du cadre et `scrollTop = 0`.

Dimensions réellement utilisées : **1440×700, 1728×760, 1728×780, 1728×800, 1728×820, 1920×850**. Aucun test mobile.

Les anciennes hauteurs minimales incompatibles sont retirées. Le contenu n'est pas caché pour simuler un succès. Les rails peuvent défiler horizontalement lorsque le volume le demande.

Deux défauts ont été constatés puis corrigés sur la version publiée : chargement Swile dépassant de 20 px à 1440×700 ; financement Swile trop haut, puis encore 2 px de dépassement sur sa surface locale. Corrections : en-tête du wallet horizontal, compteur redondant retiré, détails financiers répartis en deux colonnes et titre compact. Les dernières mesures de ces vues passent aux six dimensions.

## Parcours navigateur exécutés

Accueil ; pilotage avec budget cible, ajustement actif et poste non ajustable ; Courses sans simulation, avec simulation et saisie précise ; scénarios à un et deux choix ; ajout d'une cagnotte au scénario ; fermeture/réouverture avec brouillon conservé ; objectif ; index cagnottes ; cagnotte protégée et ajustable ; grille Mettre à jour ; Banque directe ; Swile solde/chargement/date personnalisée/montant précis/financement ; Edenred sans solde ; états Modifiés et Désactivés ; charges fixe et conditionnelle ; Confirmés vide et avec Banque ; prévisions habituelles ; retours et Escape.

246 mesures finales, couvrant 41 vues ou états aux six dimensions, passent sans dépassement. Chaque surface répertoriée dans les mesures a été contrôlée aux six dimensions. Les captures les plus représentatives ont été inspectées visuellement. Les clics successifs -5 %, -10 %, -20 % ont conservé le résultat -20 % dans le navigateur. Un Centre dont le read model serait totalement vide n'a pas été créé dans le foyer réel ; les états vides sont couverts en SSR et le Confirmés vide a été exécuté réellement.

## Mutations réelles et restauration

Autorisation humaine obtenue pour les inputs du mois. Avant les essais, sauvegarde en mémoire de la ligne d'octobre : payload, date de modification et auteur. Chaque restauration est conditionnée par le payload et la date relus pour ne pas écraser une modification concurrente entre lecture et écriture.

| Essai | Vérification réelle |
|---|---|
| Banque | Saisie, sauvegarde, statut Confirmés, diminution du compteur, retour et réouverture du montant daté |
| Swile | Correction du solde à la même date, retour et réouverture ; date de chargement toujours manquante, donc absence de fausse confirmation complète |
| Objectif | Sauvegarde, header et écart, réouverture |
| Budget cible | Candidate précise sauvegardée ; projection du mois inchangée |
| Cagnotte ajustable | Sauvegarde, nouveau montant, projection et réouverture ; épargne protégée intacte |
| Charge désactivée | Réactivation, retrait des Désactivés, retour aux références et projection actualisée |
| Annulation | Application, bouton conservé après rafraîchissement, annulation réelle, payload identique au payload initial |
| Scénario combiné | Application des deux scopes, recalcul du résultat, restauration des inputs |

Les montants et captures personnelles ne sont pas committés. Aucune mutation historique n'a été demandée ou exécutée. La preuve zero-write automatisée contrôle les tables touchées dans le harness ; elle ne constitue pas un audit indépendant de l'ensemble de la base live.

## Vérifications automatiques

| Suite | Résultat |
|---|---|
| Centre spatial et finition | 78/78 PASS |
| Centre domaine/actions | 85/85 PASS |
| Choices UX | 68/68 PASS |
| Human UX | 53/53 PASS |
| Centre UX | 57/57 PASS |
| Budgets cibles | 36 PASS |
| Cagnottes | 21 PASS |
| Wallets | 36 PASS |
| Modes temporels | 13 PASS |
| Forecast temporel | 63 PASS |
| Imports d'architecture | PASS, 771 fichiers |
| TypeScript | PASS |
| Build de production | PASS |

Commandes : `node scripts/check-phase2-month-control-center-spatial-ux.mjs`, les quatre autres scripts du Centre, `check-phase2-category-targets-choices`, `check-phase2-savings-allocations`, `check-phase2-benefit-wallets`, `check-phase2-forecast-temporal-mode`, `check-phase2-temporal-forecast`, `node scripts/check-architecture-imports.mjs`, `node node_modules/typescript/bin/tsc --noEmit`, `node node_modules/next/dist/bin/next build`.

Les harnesses d'actions utilisent une clé synthétique de test, sans secret de production. Une exécution initiale du script Choices sans cette variable a refusé l'annulation (`UNDO_KEY_UNAVAILABLE`) ; le rerun avec l'environnement synthétique passe. Aucun ancien script V1 n'est exécuté.

## Preuves et limites

Captures et résultats complets hors Git : `C:/Users/Manon/Documents/Codex/2026-09-28/ve/evidence/phase2-control-polish-2026-10-05`.

Captures : `root-1440x700.png`, `scenario-two-1440x700.png`, `goal-saved-1440x700.png`, `update-grid-1440x700.png`, `bank-known-observation-1440x700.png`, `swile-loading-final-1440x700.png`, `swile-funding-final-1440x700.png`.

Limites : volume illimité d'observations wallet non certifié dans le navigateur ; historique comparable suffisant couvert synthétiquement, indisponible dans le foyer réel ; le garde-fou d'annulation vérifie le digest avant l'écriture et conserve la frontière d'upsert existante, sans prétendre ajouter un CAS transactionnel au schéma.

## Git et production

HEAD avant : `4f6ef2765c68e35417e3c6ebdad4d8630781aaea`.

Code publié sur `main`, avec corrections issues des captures. Production : https://budgetisation-tan.vercel.app/mois-a-venir.

La preuve de l'annulation live, la comparaison finale des inputs et le HEAD livré sont ajoutés à la clôture ci-dessous.

## Clôture des preuves

- Annulation live : PASS. Le payload restauré par le bouton Annuler est identique au payload sauvegardé avant tests.
- Restauration finale du payload, de la date et de l’auteur : PASS, comparaison exacte après les mutations.
- Mesures finales : 246/246 PASS, 41 vues ou états sur les six dimensions. Les mesures des itérations fautives sont conservées séparément.
- Preuves privées : `scroll-measures-final.json`, `scroll-measures-all-iterations.json`, `undo-ready-1440x700.png`, `courses-simulation-final-1440x700.png` et rapports de tests dans le dossier evidence indiqué plus haut.
- Aucun travail mobile. Aucune migration ou modification du moteur financier.

- Brouillon après reload et changement live de l’objectif : PASS ; intention conservée et preview recalculée par le serveur. Capture : `draft-reresolved-after-live-change.png`.
- HEAD du code testé sur Vercel : `ecb43e78dc05b2dd4637d1a78e20836653b38778` (déploiement production READY). Le commit de clôture ajoute les preuves et termine la microcopie Budget cible.
