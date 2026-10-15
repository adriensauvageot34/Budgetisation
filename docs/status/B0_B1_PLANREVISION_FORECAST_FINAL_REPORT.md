# B0 + B1 — PlanRevision officielle → Forecast

15 octobre 2026. État de préparation : **B1_IMPLEMENTED_NOT_RELEASED**. Gates Preview/Production encore en attente dans cette version du rapport.

## A. État initial

Main et Production `83bb1a91da3442e893e5c804fb4f71007f61c467`, déploiement `dpl_9wf9sp8EiULkP4eDh2jTB8EQUtyK` READY. Branche dédiée `codex/budgetisation-b0-b1-plan-forecast`. Worktree initial propre ; aucun travail UX parallèle écrasé.

`resolveEffectiveMonthScenario` fournissait déjà DIRECT_V2/PLAN_V1, le scénario et la projection actuelle. `evaluatePlanScenario` remplace déjà les placeholders de `buildPlanProjection` par des marges réelles calculées par le Compiler. B1 ne recrée aucun calcul de différence globale et n'ajoute aucune recompilation marginale. Le dossier maître UX du 15 octobre présent dans Downloads a été consulté comme référence uniquement.

## B. B0 — fondations vérifiées

| Cas | Déjà correct | Lacune financière démontrée | Correction financière |
|---|---|---|---|
| Substitution Courses | 350→320 : reste +30 ; 325→350 : reste −25 | Aucune dans les cas testés | Aucune |
| Restaurant consommant sa capacité | Coût 40, déplacement 40, supplément 0 | Aucune | Aucune |
| Restaurant supplémentaire | EXTRA_TO_SLOT : coût supplémentaire 40, reste −40 | Aucune | Aucune |
| Parent/enfant | Composant et trajet comptés une fois ; parent non additif | Aucune | Aucune |
| Financement/épargne | Banque 50 ne double pas une consommation 50 ; réservation 100→60 libère 40 sans changer la consommation | Aucune | Aucune |
| Mobility | Coût d'usage 2 distinct du paiement carburant ; aucun financement bancaire inventé | Aucune | Aucune |

Ces montants sont des fixtures synthétiques. Aucun Plan ni paiement personnel n'a été créé pour la certification.

## C. B1 — contrat opérationnel

`official-plan-comparison@v1` est retourné sous `comparison` par le résolveur officiel. Il est transmis par la page Mois à venir à son consommateur serveur existant `AppliedMonthView`, sans route parallèle ni refonte B2.

- `projection` est exactement la même instance de `PlanProjectionV1` que celle déjà calculée : référence, résultat Plan, impact consolidé, financement, cash, Mobility, diagnostics et UNKNOWN/PARTIAL.
- `decisions` relie les identités des contrôles/Contexts aux marges Compiler existantes et à leur digest contrefactuel. Les marges représentent le retrait d'une décision du Plan entier ; **elles ne sont pas une somme de réconciliation**.
- `slots` restitue les capacités possédées, leurs valeurs initiales/effectives/résiduelles, rôle épargne ou comportement, identités économiques et références propriétaires.
- `components` transmet sans recalcul les effets gross/displaced/incremental, les parents propriétaires, les financements déclarés, les coûts inconnus et les identités de trajet. Le total parent et les financements ne sont pas ajoutés au total consolidé.
- Les interactions potentielles sont explicites : même capacité/groupe de référence, parent/enfant, trajet partagé. Le cas de deux restaurants sur une capacité partagée démontre que la somme des marges diffère du total officiel ; le contrat interdit de l'utiliser comme total.
- Si une marge est inconnue, elle reste null avec sa raison existante. Les valeurs connues des slots et composants restent disponibles.

Exemple combiné réellement testé : Courses 350→320 et Context supplémentaire 100 : marges +30/−100 et impact consolidé −70. Les chiffres ne sont pas codés dans le produit.

### Fraîcheur et compatibilité

La révision immuable conserve ses preuves et leurs digests inchangés. Le contrat expose séparément les digests stockés et ceux du READ actuel, la publication Forecast, sa génération, le cutoff, les méthodes et EXACT/CHANGED_AUTHORITIES. Référence et Plan viennent du même World/evaluation. Aucun Draft ne participe à la lecture officielle.

Un SELECT étroit de `phase2_month_plans` après l'évaluation vérifie le pointeur actif. Le résultat reste attaché à R1 si R2 a été appliquée pendant READ, avec SUPERSEDED et une indication demandant de recharger ; une erreur de lecture devient UNAVAILABLE, sans prétendre à la fraîcheur. CURRENT_AT_CHECK est limité à l'instant de vérification et n'est pas une garantie contre un Apply ultérieur. Les anciens adaptateurs restent compatibles via `readActivePlan` ; le runtime utilise la lecture étroite. Aucun SELECT supplémentaire sans Plan.

Ni le schéma `PlanSemanticState`, ni le stockage Draft, ni les preuves persistées, ni Compiler/Finance V2/Apply/CAS ne changent. Les anciennes révisions restent lisibles sans migration.

## D. Tests et preuves

`scripts/check-b0-b1-plan-forecast.mjs` : **18 PASS** sur Compiler/V2 réels et SQL C0 inchangé dans PGlite synthétique. Couvre T1–T15, pointeur indisponible, absence de calcul/World supplémentaire et exemple consolidé. La validation des références synthétiques reste activée et bornée aux lieux/personnes de la fixture. Le consommateur serveur est rendu statiquement pour vérifier le statut R1 périmé, sans monter les éditeurs clients Next.

Régressions : parité 22 scénarios × 9 empreintes PASS, P13 huit PASS, Kernel 40 PASS, leviers simples 30 PASS, TypeScript non incrémental code 0. Golden inchangés. Les canaris historiques PGlite sont intacts ; les seules écritures de tests sont les révisions synthétiques.

Ancien `check-phase2-planner-headless.mjs` : FAIL avant les assertions du parcours Soirée, `CONTEXT_REFERENCE_OWNER_UNAVAILABLE`. Son harness omet `validateContextReferences`, alors que le garde existe déjà sur main. Ces deux fichiers sont inchangés par B1. Aucun PASS attribué à ce script ; les nouveaux round-trips couvrent le garde avec le validateur fourni.

Build local : FAIL d'outillage, jonction node_modules hors racine Turbopack. Le lanceur npm.ps1 non signé n'avait pas démarré ; l'appel direct au binaire Next a confirmé cette erreur. Aucune politique PowerShell ni configuration produit modifiée pour la masquer. Le build Vercel à dépendances normales est le gate de livraison restant.

Preuves : `evidence/b0-b1-plan-forecast/contracts.json`, `contracts.log`, `regressions.json`, `headless.log`, `next-build.log`.

## E. Intégration authentifiée

La vérification SQL bornée et en lecture seule constate **aucun Plan officiel actif** sur Supabase. Le parcours authentifié avec Plan reste donc NOT_RUN ; aucune révision personnelle ne sera créée pour combler cette limite. Le cycle PlanRevision → lecture → projection → impact est exécuté sur la base synthétique, avec les vrais services et la persistance C0.

Le chemin authentifié sans Plan sera vérifié en Preview puis Production. Les neuf compteurs d'écritures financières et l'état SNAP-3 ont été relevés avant la campagne. Aucun service_role dans le navigateur, aucune nouvelle permission/RPC/migration, aucun Apply distant.

## F. Performance

Le nouveau contrat réutilise intégralement la projection déjà calculée. Mesure CPU de 50 interprétations sur la fixture à capacité partagée : P50 environ 0,018 ms, P95 descriptif 0,033 ms. Zéro compilation, appel Finance V2 ou World supplémentaire pour cette construction ; **ce n'est pas une mesure réseau authentifiée**. Un seul GET court de pointeur est ajouté avec Plan ; son coût réel n'est pas mesurable ici sans Plan actif. Sans Plan : aucun GET ajouté et DIRECT_V2 inchangé. Les recompilations marginales déjà présentes avant B1 restent présentes, sans multiplication supplémentaire.

## G. Livraison / rollback

En attente des contrôles Preview. Aucun flag P14 modifié. Retour au déploiement `83bb1a9` ou revert des changements B1 : aucune donnée à supprimer/restaurer, car les schémas et preuves restent inchangés.

## H. B2 — données prêtes, UX non développée

Réutiliser `MonthForecastView`, `AppliedMonthView`, le Centre de contrôle et les restitutions Mon Plan. Le serveur reçoit désormais une comparaison officielle typée : projection consolidée, marges conditionnelles, relations de substitution, capacités, provenance des coûts/financements, inconnues, révision et fraîcheur. B2 peut afficher ces résultats ; il ne doit pas calculer un total en additionnant les marges ou les composants. Aucun preset, inventaire, nouveau cycle de vie, rapprochement au réel ou variante multi-Draft n'est implanté ici.
