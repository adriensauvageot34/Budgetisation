# C10 — audit des authorities et nettoyage

## Preuves avant retrait

`check-phase2-planned-assets.mjs` a passé avant modification. Les parcours
navigateur utilisent directement le resolver partagé : domicile, livraison,
Lucas avec Restaurant child, et Fontès avec historique dirigé.

Le shim `placesForPlannedContext` n'avait aucun appel en production. Ses seuls
consommateurs restants étaient trois assertions du runner assets. Il a été
supprimé ; ces assertions vérifient désormais directement le ranking partagé,
avec les clés de contacts explicites. Aucun résultat de l'ancien shim ne sert
d'oracle. Une garde empêche sa réintroduction.

Le smoke a également révélé que Fast-food et Repas au travail étaient
inaccessibles depuis les sept intentions. L'intention Restaurant ouvre désormais
les sous-types repas déjà définis dans le registre. Aucun moteur n'a changé.

## Recherche et responsabilité

Recherche exécutée avec `rg` dans `src/domain/phase2`, `src/server/phase2` et
`src/app/mois-a-venir` ; revue des appels et des imports, pas seulement du nombre
d'occurrences textuelles.

| Cible | Authority / résultat |
| --- | --- |
| Contextes, contacts, providers, graph | `planned-rules.ts` ; React consomme le resolver et les registres partagés |
| Compatibilité/ranking des lieux | `planned-places.ts` et `planned-place-rules.ts` ; aucun fallback tous les lieux ni contact fuzzy |
| Lieux locaux des children | Contrat partagé et `PlannedRouteEditor` ; aucun deuxième resolver local |
| Assets / BringItems | Catalogue stable et lenses partagées ; aucun pseudo-asset launcher ; Transport reste une capacité racine |
| Readiness / invalidation / Undo | `planned-builder.ts` ; états locaux dérivés, aucune persistence ; suspension des valeurs explicites |
| `baselineFor` React | Adaptateur identité des participants → `baselineKeyForModule` partagé ; aucune doctrine financière locale |
| Baseline / financement / carburant | Moteur serveur `month-scenario.ts`, éligibilité du catalogue, routes partagées ; carburant ECONOMIC_ONLY sans allocation Banque |
| Routes / sources / fuel | `planned-routes.ts` ; étapes et segments racine, aucune authority child stopIndex |
| Save / Preview / stale / lifecycle | Actions → préparation serveur commune → service prospective et CAS ; aucun Preview client accepté comme authority |
| Carte / liste / calendrier / forecast | Projections de la même root relue ; pas de calendar/forecast row persistée |
| Legacy nestedModule, profondeur 1..5, CANCELLED, declaredFunding ou deux montants | Absents des authorities prospectives actives ; suites négatives et max path 2 rejouées |
| reserved vs declared / cash | États séparés dans le plan financier ; aucune promesse de solde réel ou de cash disponible |
| Planning Memory / recents / apprentissage | Aucune persistence ni apprentissage V1 ; gardes MEM-V1 |
| Authorities historiques | Aucun write path ajouté ; traces ciblées par opération et test distant RLS avec ROLLBACK |

## Compatibilité conservée

`plannedEvents: []` reste accepté à la lecture d'anciens réglages mensuels,
conformément à `PHASE2_MONTH_MODULES.md`. Tout tableau non vide est refusé et le
champ est retiré des nouvelles écritures. Ce chemin n'a aucun moteur actif et
ne permet pas de créer une seconde dépense. Il reste nécessaire à l'old-row read.

## Limites explicites

- Tests navigateur locaux sur ordinateur ; pas de contrôle Vercel demandé.
- Aucun chantier clavier supplémentaire, conformément au choix utilisateur.
- Pas de suite browser ajoutée : navigateur intégré existant et runners du repo.
- Pas de lint configuré. Typecheck et build production sont les gates existantes.
- Prix carburant observé en juillet : présenté comme estimation datée ; aucune
  nouvelle observation ni donnée historique n'est inventée.

Le full rerun final et ses hashes figurent dans le bundle C10. Le critère est
zéro seconde authority métier, pas zéro mot technique dans le code.
