# B3 — Cohérence transversale du Plan officiel

Date : 15 octobre 2026. Branche : `codex/budgetisation-b3-effective-plan`.

**Verdict : `B3_RELEASED_WITH_VALIDATION_LIMITATIONS`.** Le correctif applicatif est livré en Production ; les réserves authentifiées et transactionnelles restent explicites. Les PASS ci-dessous sont synthétiques sauf mention contraire. Aucun Plan personnel ni fait financier de production n’a été écrit.

## A. État initial

- Base : `9199de55ff28428d592288e099860dd570170eae`, main post-B2/PR #38 ; worktree propre à l’ouverture de B3.
- Production initiale : `dpl_Dzfii6rQTF5dHmBqphAdkT53DajJ`, READY, même SHA.
- Production : SNAP-3 ON, Preview HTTP ON, prototype historique P3 OFF. Aucun changement de configuration dans B3.
- B1 et la lecture officielle utilisent déjà Compiler/Finance V2 sur le Plan actif. B2 a livré sa présentation.
- Réserves héritées : aucun Plan officiel actif admissible en base authentifiée ; smoke navigateur Production post-B2 bloqué par la limite de revue automatique. Ces états ne sont pas transformés en PASS.

## B. Incohérences identifiées

| Parcours | Avant B3 | Correction |
|---|---|---|
| Page Mois à venir | PLAN_V1 déjà résolu ; contexte de certains contrôles repris des premiers lecteurs | Réutilise les faits de la même lecture effective pour les contrôles et leur digest |
| Preview d’une dépense | DIRECT_V2 même avec Plan | Simulation effective de la substitution ciblée |
| Création / modification | Preflight DIRECT_V2, puis CAS/PK du propriétaire PE | Même scénario effectif que Preview, vérification de révision et digest avant écriture |
| Déclaration réalisée | Preflight sur statut futur | Simule explicitement DECLARED_REALIZED ; conserve le refus des slots possédés nécessitant T3 |
| Report | Validation du mois destinataire seulement | Vérifie source et destination ; même root ; refus ciblé d’une référence explicite du Plan |
| Restauration / suppression | Pas de preflight effectif ; mois de la commande insuffisamment vérifié | Scope du mois, simulation effective, dernier contrôle du pointeur avant le writer |
| Choix mensuels / Undo | V2 direct, guards legacy présents | Scénario effectif partagé ; guards conservés ; CAS MonthInputs avec Plan |
| Relecture après écriture | V2 direct | Résolution du Plan actif courant ; échec après commit distingué d’un refus d’écriture |

Ce constat ne concerne pas les lecteurs historiques, les writers Canonical ou la doctrine Finance V2.

## C. Corrections implantées

### Frontière de simulation

`planner/effective-simulation.ts` réutilise le repository, le validateur de preuves, `evaluatePlanScenario` et les adapters existants. Un World préparé par phase de requête, puis substitution des seuls MonthInputs/PlannedExpenses prospectifs. Les faits observés et le Semantic State de la révision ne sont pas modifiés. Mémo des variantes limité à cette requête.

`monthly-simulation-runtime.ts` construit le runtime Canonical uniquement si un Plan existe. Sans Plan : lecteurs mensuels existants et V2 direct ; aucun readWorld ni compilation Composer.

La page obtient la simulation déjà préparée par un callback serveur facultatif du résolveur officiel. Son résultat public et ses preuves restent compatibles ; aucune fermeture n’est sérialisée vers React.

### Mutations et interface

- La Preview transmet le PlanRevision ID et un digest des autorités effectives ; le navigateur les restitue pour enregistrer/confirmer.
- Le formulaire mensuel transmet son digest affiché. Les réponses hors ordre restent protégées par les mécanismes existants.
- Les writers PE gardent leur PK idempotente et CAS `updated_at`/statut. Un callback final relit le pointeur Plan après les validations de références.
- MonthInputs avec Plan utilise INSERT si absence attendue, ou UPDATE sous `updated_at`. Un conflit n’écrase pas la nouvelle saisie. Le chemin sans Plan garde son contrat historique.
- Un replay de création reconnu par même ID/auteur/mois/contenu relit le reçu sans refaire un INSERT. Un ID réutilisé avec un contenu différent est refusé.
- `PLANNED_EXPENSE_COMMITTED_RELOAD_FAILED` dit explicitement que l’écriture a réussi et demande de relire avant toute nouvelle action.
- L’impact d’une root explicitement référencée compare sa version actuelle à sa version modifiée : pas de suppression temporaire d’un lien requis, ni de fausse absorption déduite.
- Avec Plan et aucune PE externe, le contrôleur d’ajout reste monté : le bouton existant « Ajouter une dépense » possède désormais son consommateur avant la première création. Le panneau existant et son portail sont réutilisés.
- UNKNOWN masque la conclusion économique et la projection bancaire non certifiée ; coûts, financements connus et solde réel restent visibles.
- Suivi ciblé avant clôture : les réglages affichés dans les contrôles proviennent de `scenario.inputs`, après neutralisation par le Compiler. Le digest continue de lier les entrées brutes de l’owner. Un ancien objectif/ajustement MonthInputs sur un slot possédé ne réapparaît donc pas comme décision effective. B3-13 couvre explicitement ce cas ; les 27 contrôles B3, les 85 contrôles mensuels et TypeScript ont été rejoués avec succès.

### Coût des calculs

La voie `evaluatePlanMutation` partage strictement l’implémentation officielle, mais ne calcule pas les attributions marginales individuelles inutiles aux preflights. Les scénarios, contraintes et manifestes sont identiques. Ses digests de projection ne sont pas des reçus Apply et ne sont jamais utilisés comme tels. `evaluatePlanScenario`, Apply, CAS et les preuves officielles conservent toutes les attributions et leurs empreintes.

Fichiers principaux : actions mensuelles et PE, contrôles UI concernés, `month-choices.ts`, `month-control-center.ts`, `month-inputs.ts`, `planned-expenses.ts`, `planned-impact.ts`, résolveur et nouveaux adapters ci-dessus. Aucun DDL, snapshot, writer historique ou calcul financier React.

## D. Cohérence économique

- Dépense indépendante de 48 € : une PE, projection effective diminuée de 48 €, révision inchangée.
- Restaurant de 40 € dans la capacité Restaurants officielle admissible : aucun supplément fictif. Passage à 55 € : même root et même ligne, ancienne valeur remplacée.
- Lien explicite vers un Purchase de 42 € : le réel prend la priorité sur le prévu 40 €, variance +2 €, sans nouveau coût de 40 €. Le paiement bancaire reste une dimension du même achat.
- Ambiguïté bilatérale : aucun matching automatique. Le rapprochement existant est réutilisé sans nouveau moteur.
- Composite partiellement réalisé : aucune réalisation globale déduite. T3 par ligne et capacité résiduelle restent hors périmètre.
- Déclaration réalisée ≠ observation Canonical. Le guard `PLANNER_EXTERNAL_REALIZED_RECONCILIATION_REQUIRED` reste actif sur les capacités possédées concernées, avec message exploitable.
- Report indépendant novembre→décembre : même ID, une seule contribution au mois destinataire, retrait du futur source. Report/suppression d’une root explicitement référencée par le Plan : refus conservant les données jusqu’au contrat T4.
- Coût d’usage Mobility conservé comme ECONOMIC_ONLY ; aucune opération carburant ou écriture Wallet créée.

## E. Révisions, fraîcheur et concurrence

- R1 reste identique après modification de revenu, Forecast, PE et application de R2. R2 conserve la PE externe et le fait observé.
- Un changement de révision ou de génération Forecast entre Preview et commande invalide le reçu ; aucun writer appelé dans ces tests.
- CAS PE et MonthInputs réellement exercés sur les tables PostgreSQL synthétiques ; refus d’une ancienne version sans perte de la nouvelle.
- Retour au scénario DIRECT_V2 interdit lorsque le World d’un Plan actif est indisponible.
- **Limite transactionnelle explicite :** le dernier contrôle du pointeur Plan et l’UPDATE/INSERT d’un autre owner restent deux appels SQL. B3 n’ajoute pas une transaction multi-owner avec Apply. La fenêtre entre ce contrôle et le commit n’est donc pas certifiée atomique. Les mécanismes T2–T4 de coordination/coverage ne sont pas livrés. Les relectures repartent de la révision active, sans réécrire les anciennes preuves.
- Aucun contrat d’annulation durable, tombstone ou résurrection historique T4 n’est revendiqué.

## F. Tests exécutés

Preuve principale : `evidence/b3-transverse-plan/contract-results.json` ; runner `node scripts/check-b3-transverse-plan.mjs`.

**27 contrôles PASS synthétiques**, couvrant B3-01 à B3-18 et neuf contrôles additionnels : parité sans attributions, indisponibilité sans fallback, CAS MonthInputs, déclaration/restauration/suppression avec Plan, référence explicite et report protégé, réponse perdue/replay, coût borné.

Persistance : PGlite avec SQL C0, les six migrations PE existantes et MonthInputs, vrais services/actions, Compiler et Finance V2. Transport PostgREST remplacé par requêtes paramétrées vers ces tables. Auth/Canonical restent des entrées synthétiques contrôlées. **Ce n’est pas une preuve de vrais JWT Supabase.** Les tables historiques synthétiques interdisent toute écriture par triggers canaris.

| Gate | Résultat |
|---|---|
| B3 | PASS, 27 contrôles synthétiques |
| B1 | PASS, 18 contrôles persistés |
| B2 | PASS, 12 scénarios persistés |
| Kernel C2 | PASS, 40 groupes ; 13 révisions synthétiques |
| Parité financière | PASS, 22 cas × 9 empreintes, valeurs de référence inchangées |
| Centre de contrôle mensuel | PASS, 85/85 |
| Réalité PE C7 | PASS, cycle, CAS, idempotence, report/restauration/suppression |
| TypeScript | PASS, `tsc --noEmit` |
| Build local webpack sandbox | FAIL outillage : EPERM dans `.next/types/app/api` |
| Build local webpack autorisé | FAIL compilation webpack : import client `node:crypto` via `query-client` ; ces fichiers ne sont pas modifiés par B3. Le workflow habituel utilise Turbopack. Pas de certification locale complète revendiquée. |
| Build Vercel habituel | PASS sur le candidat final 5655447 et le merge d464c34 : Next/Turbopack complet, TypeScript, 8 pages générées ; Production READY |

Deux oracles textuels ont été ajustés : avertissement SUPERSEDED renommé par B2, et filtre d’édition déplacé de `saved` vers `effective.expenses`. Les assertions économiques, scénarios de remplacement et empreintes financières ne sont pas affaiblis. Aucun calcul financier modifié pour satisfaire un golden.

## G. Vérification authentifiée et sécurité

- Inventaire ciblé réellement consulté : un seul projet Supabase, Budgetisation principal ; aucune branche isolée. Aucun compte ni Plan synthétique créé dans ce projet.
- Avec Plan + vrai JWT : **NOT_RUN** faute d’environnement admissible. Les fixtures PGlite ne changent pas ce statut.
- Navigateur réel B3 avec ou sans Plan : **NOT_RUN**, limite de revue automatique héritée de B2 annoncée jusqu’à 17 h locale, toujours non levée au moment de ces vérifications. Aucun contournement par cookies/CDP/autre navigateur. Le smoke authentifié post-B2 reste donc ouvert.
- Les lectures de métadonnées Supabase avant/après confirment absence de Plan actif et SNAP-3 enabled/revision 1/epoch 2/writer coverage true. Aucun HIT Canonical/M7 authentifié supplémentaire n’est revendiqué.
- Smoke Production HTTP anonyme réellement exécuté : Connexion 200, mois protégé 307 vers Connexion, API Draft avec contrat correct mais sans JWT 401 AUTHENTICATION_REQUIRED et private/no-store. Trois GET seulement ; aucune connexion contournée. Cela ne certifie pas un parcours authentifié.
- Compteurs financiers de production inchangés depuis l’entrée : operations 0/0/0 ; purchases 200/0/0 ; Mobility 1368/0/0 ; MonthInputs 2/44/1 ; PE 32/37/25 ; Wallets 2/1/0 ; ledger 213/0/0 ; Plans/révisions 0/0/0 (ordre insert/update/delete). Ces statistiques corroborent la non-écriture ; elles ne remplacent pas un journal d’audit par utilisateur.
- Aucun nouveau privilège, endpoint public, secret navigateur ou politique RLS. Les requêtes utilisent l’utilisateur authentifié et les filtres foyer/mois existants.

## H. Performance ajoutée par B3

- Sans Plan : une lecture étroite de présence du Plan par phase ; zéro World/Compiler Composer. Dernière vérification du pointeur pour les mutations.
- Avec Plan : lecture Plan+révision et un World préparé partagé par simulation. L’enregistrement a un preflight puis une relecture autoritaire séparée ; ce second READ n’est pas un cache du preflight.
- Aucun World par carte, aucun appel de comparaison B1 pour l’affichage d’un élément. Les variantes financières sont mémoïsées dans la requête, puis libérées.
- Série bornée : cinq paires de preflights synthétiques, dans le JSON de preuve. Le chemin historique DIRECT_V2 est plus léger mais financièrement inapproprié avec Plan ; ce n’est pas une référence financière équivalente. Le chemin effectif ajoute un World par Preview et six appels Compiler/Finance dans le petit scénario testé (au lieu de huit avant suppression des attributions des variantes). Médianes observées : 17.2 ms (ancien direct) et 96.0 ms (effectif), n=5, CPU/transport synthétique. Aucun gain de latence utilisateur réelle revendiqué ; aucune réouverture de P14.

## I. Livraison et rollback

- Commits applicatifs : `31834e0`, `f06af44`, puis **`56554479df4dc776f107141d86a27318f566c430`** (tuple PE/scénario cohérent et replay de déclaration reconnu avant le contrôle devenu périmé).
- [PR #39](https://github.com/adriensauvageot34/Budgetisation/pull/39) fusionnée ; contrôles GitHub Vercel success, aucun avis de revue externe déposé.
- Merge : **`d464c34b7c1408094d88655955f958db1feef179`**. Arbre Git identique au candidat testé : `6b7cdad58af974a55b3848f0c67508fa95cd79e4`. Main n’avait pas dérivé.
- Preview finale : `dpl_8U9DXmhbSJNBsKqxRXjvQtKtZC1T`, READY, SHA 5655447 ; journal complet conservé.
- Production applicative : `dpl_hth5DFsadhkpibeF5PoVx5rBLFgD`, READY, SHA d464c34, alias https://budgetisation-tan.vercel.app vérifié. Compilation 35,6 s, TypeScript 40 s, génération 8/8 pages ; ce sont des durées de build, pas des performances utilisateur.
- Smoke anonyme et compteurs après livraison : PASS dans leur périmètre ci-dessus. Smoke navigateur/authentifié : NOT_RUN.
- Ce compte rendu et ses preuves de livraison sont ensuite publiés en suivi documentaire sans modifier le code applicatif.
- Suivi documentaire fusionné via PR #40, main `6907cbe3cb3b954290e528d3ebae8ffbec403711`, Production `dpl_CU5JktLAErthJHvqKo2FuEyuGimb` READY, code applicatif identique à d464c34. Le correctif ciblé de restitution des réglages effectifs est ensuite livré sur `codex/budgetisation-b3-effective-controls` ; aucune doctrine financière ni migration supplémentaire.
- Aucun SQL à déployer ; compatibilité des anciens Plans et migrations existantes conservée.
- Rollback applicatif : revenir au déploiement antérieur `9199de5` ou revert du commit B3 via le workflow habituel. Aucun Plan, Draft ou fait financier à supprimer. Le rollback retrouve aussi les limites de preflight DIRECT_V2 antérieures : ne pas le présenter comme une nouvelle garantie financière.

## J. Suites T2–T8, sans démarrage automatique

1. **T3, avec les identités T2 nécessaires** : plus forte valeur pour les enveloppes déjà réalisées et les composites ; coverage par ligne et capacités résiduelles avant de lever les guards.
2. **T2** : matérialisation explicite de feuilles du Plan, liens/coverage atomiques ; les liens root existants ne remplacent pas ce contrat.
3. **T4** : historique d’annulation/report, protection des engagements et transaction multi-owner lorsque requise. Dépend de T2/T3.
4. **T5/T6** : filiation des trajets observés et allocations Wallet précises, après coverage ; aucun débit carburant fictif.
5. **T7/T8** : comparaison longitudinale puis bilan de fin de mois, sur ces liens certifiés.

Les actions indépendantes déjà représentables sont raccordées. Les réalisations partielles, annulations durables et transactions inter-owners ne sont pas déclarées complètes.
