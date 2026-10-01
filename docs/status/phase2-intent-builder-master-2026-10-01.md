# Phase 2 — Builder par intention, MASTER du 1er octobre 2026

## Référence et périmètre

- Brief : `Budgetisation_V2_MASTER_UX_BUILDER_CODEX_2026-10-01.md`.
- Départ : `main`, `d6c8b66ac778dc46bd4fc527d20a530400f56c7d`, arbre propre.
- Interface ordinateur : neuf intentions, primitives communes, questions adaptées à chaque parcours.
- Le moteur financier, les références statistiques et la frontière prospective restent les autorités existantes.

## Implantation

| Sujet | Réalisation |
| --- | --- |
| Entrée | Restaurant, fast-food, repas travail, courses, soirée, visite, activité, achat, voyage ; SVG et libellés humains |
| En-tête | Fil d’Ariane, titre dérivé par une seule registry, date et lieu utiles |
| Précisions | Actions facultatives fermées, sans création de ligne à leur ouverture |
| Coût | Total simple, séparation ciblée, détail local confirmé ; total et descendants exclusifs ; retour au total seulement si les distinctions le permettent |
| Édition | Une tuile garde sa place ; quantité 1 implicite ; aucun CostItem incomplet confirmé ; reprise d’un total ou financement enregistré |
| Financement | Banque implicite ; wallets compatibles ; repas travail filtrés par propriétaire réel ; frais et alcool hors titres-restaurants |
| Baseline | Une question au niveau racine quand nécessaire ; courses habituelles/complément et repas travail acheté/livré automatiques ; domicile et séjour sans baseline inventée |
| Delivery/online | Provider et commerce séparés du lieu ; pas de trajet utilisateur ; frais vides puis saisis ; décomposition du total sans double compte |
| Lieux | Compatibilité avant classement ; occurrences récentes et alias confirmés ; accès explicite aux lieux rares ; aucun fallback général ni fuzzy de marque |
| Travail | Personne, secteur canonique, ressource personnelle et baseline personnelle ; note de week-end fondée sur l’hypothèse existante, pas un emploi du temps inventé |
| Visites/soirées | Contacts prospectifs ; domicile dérivé quand connu ; visite gratuite et soirée chez nous possibles ; apporter quelque chose reste une lens |
| Transport | Un seul Transport racine ; choix simplifiés ; route et carburant recalculés au serveur ; destination principale conservée ; aucun carburant économique affecté à Banque |
| Voyage | Déplacement ponctuel/séjour, destination, dates ; avion/train ; hébergement facultatif sans faux hôtel gratuit ; Restaurant/Activity children terminaux |
| Readiness | Source partagée ; CTA Preview/Save avec explication et réparation ; aperçu périmé invalidé ; incompatibilités explicites conservées avec Undo contextuel |
| Aperçu | Lignes, coût, paiement, narration de l’effet, avant/avec/écart et scénarios ; projection complète « À affiner » si les imports sont incomplets |

## Supabase — modifications approuvées

Deux migrations appliquées après validations explicites :

1. `20261001083235_phase2_planned_zero_cost.sql` : dépenses sans CostItem autorisées uniquement pour les intentions gratuites prévues par le contrat ; garde positive inchangée pour les lignes actives.
2. `20261001083623_phase2_wallet_ownership_declared.sql` : Swile → Adrien, Edenred → Manon ; création de la seule référence Edenred manquante, sans montant, solde ni journal.

Les noms préparés pour validation étaient respectivement `20260930223315_phase2_planned_zero_cost.sql` et `20261001083240_phase2_wallet_ownership_declared.sql`. Les fichiers ont ensuite été alignés sur les versions réellement enregistrées par Supabase, à contenu identique.

Audit avant et après : **0 ligne prospective**. Le navigateur a effectué des Preview, sans Save. Aucune autorité historique, règle RLS ou publication analytique modifiée par ce lot.

La table canonique `benefit_wallets` n’est pas accordée en lecture au rôle authenticated. La validation serveur de propriété utilise donc le lecteur canonique, après contrôle de la personne active et du foyer authentifié. Les CRUD prospectifs conservent le client authentifié et leurs RLS.

## Vérification ciblée

Exécutions avec le runtime Node existant, sans installation de nouvelle suite :

```text
node scripts/check-phase2-intent-builder.mjs
node scripts/check-phase2-planned-domain.mjs
node scripts/check-phase2-planned-server-contract.mjs
node scripts/check-phase2-planned-builder.mjs
node scripts/check-phase2-planned-routes.mjs
node scripts/check-phase2-planned-finance.mjs
node scripts/check-phase2-month-narrative.mjs
node node_modules/typescript/bin/tsc --noEmit --incremental false
node node_modules/next/dist/bin/next build
git diff --check
```

- Domaine/graph/registries et payloads négatifs : PASS.
- Frontière serveur et six couches : PASS.
- Builder AB/COST/DRAFT/META : PASS.
- Routes dirigées, provenance, place locale et fuel : PASS.
- Finance FIN/META et rendu de l’aperçu : PASS ; seuls les assertions d’ancien vocabulaire/ordre UI ont été adaptés au MASTER.
- Narrative, remplacement du quotidien, non-double-compte et lifecycle : PASS.
- Nouvelle suite intention : PASS, dont 32 = 26 + 3 + 3, ownership négatif, zero roots, relecture des totaux, collapse compatible et Undo.
- TypeScript : PASS.
- Build final : PASS (Next.js 16.2.6, compilation, TypeScript et génération des routes).

## Parcours navigateur réellement exécutés

Sur le build local authentifié `/mois-a-venir`, sans écriture de dépense :

| Parcours | Preuve |
| --- | --- |
| Restaurant à deux / Saint-Valentin / 60 / Swile 20 | Titre dérivé, coût 60, Banque 40, Swile 20, question habituelle unique, Preview serveur réussi |
| Repas travail Manon / acheté / 14 / Edenred 10 | Montpellier dérivé, Edenred seul proposé, Banque 4, baseline personnelle remplacée ; Preview réussi après correction du lecteur wallet |
| Père d’Adrien / Servian / visite gratuite | Destination dérivée, 0 ligne, coût 0, aucun paiement ; Preview réussi |
| Livraison Uber Eats / Domino’s / 32 / frais 3 + 3 | Provider distinct, aucun Transport, aucune ligne automatique ; commande 26 + livraison 3 + service 3 = 32 ; Preview réussi |

Aucune erreur console observée sur les parcours réussis. Capture locale : `C:/Users/Manon/Documents/Codex/2026-09-28/ve/outputs/intent-builder-delivery-preview.png`, externe au dépôt ; aucun screenshot contenant les ressources du foyer n’est committé.

Ces parcours sont des smokes ciblés. Ils ne revendiquent pas une nouvelle certification exhaustive DD6 ni l’exécution de chacun des dix smokes complets du MASTER. Les derniers ajustements de présentation sont couverts par compilation et contrôles ciblés.

## Compatibilité / nettoyage

- Ancienne orchestration React universelle retirée ; le contrôleur garde les mutations atomiques, la révision du brouillon et l’idempotence existantes.
- Les règles de coût, readiness, invalidation, places, modifiers et route restent dans le domaine partagé/serveur.
- Les anciens assetKeys et providers directs restent lisibles ; ils ne sont pas proposés comme launchers ou merchants économiques par la nouvelle interface.
- `PLANNED_INTENTS` de l’ancienne taxonomie subsiste pour les contrôles de compatibilité de toutes les anciennes family/subtype ; l’entrée visuelle utilise exclusivement les neuf `BUILDER_INTENTS`. Aucun second calcul financier.
- Le choix de transport ne devine aucune ville à partir de son nom.
- Aucun responsive supplémentaire, memory personnelle, recherche universelle, fuzzy silencieux ni auto-learning ajouté.

## Limites factuelles

- Les imports du mois courant restent incomplets : la projection globale est volontairement à affiner.
- Une enseigne sans alias canonique confirmé reste saisie par l’utilisateur ; un lieu peu observé reste accessible dans les lieux compatibles.
- Les jours de travail proviennent de l’hypothèse existante lundi–vendredi, pas d’un planning individuel canonique.
- Les changements externes de prix, personnes, ressources ou routes sont toujours revérifiés au serveur lors des mutations.
