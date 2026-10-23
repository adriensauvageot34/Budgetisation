# D1 — Prix global des consommations Bar / Apéro

Base : main `82254f37c0a22807478ff3e2f80d1cd7ebc040c1`. Aucune migration, fusion ou livraison Production dans ce lot.

## Contrat

`night-out-consumption@v2` contient le mode GLOBAL/DETAILED, un montant explicite (zéro admis), une identité de contribution globale stable et les références `{contextOccurrenceId, slotKey, selectionId}` couvertes. Before reste un enfant, avec ses propres slots. Aucun prix détaillé n'est effacé ou copié vers un historique susceptible de faire réapparaître des produits supprimés.

En GLOBAL, le Compiler conserve les sélections descriptives mais ne produit aucune contribution financière individuelle pour elles, ni zéro fictif ni UNKNOWN. Il produit une unique contribution globale via le Cost Resolver et Finance V2. Les quantités actuelles et anciens prix redeviennent actifs en DETAILED ; le global est mémorisé pour un retour ultérieur.

Le périmètre est uniquement celui des consommations des sockets extras du Bar et main/extras du Before explicitement lié. Les repas du socket food, contributions additives, trajets, parkings, entrées et autres références catalogue à rôle distinct restent indépendants. Les financements/bindings incompatibles et agrégats ambigus provoquent un refus, jamais une suppression.

Le parseur refuse les références manquantes ou forgées. Seules les mutations sémantiques admises rafraîchissent la couverture pour ajouter/retirer un produit. Le basculement vérifie le digest de l'état sémantique complet : parent, enfant, liens et protections. La confirmation UI possède également sa garde de fraîcheur.

## Compatibilité

v1 garde exactement son périmètre Au bar et son manifest v9. Un DIRECT v1 doit d'abord être explicitement remis en détail par son mécanisme existant ; il ne devient jamais implicitement un global multi-moments. Son ancienne représentation inactive est conservée sous `legacyV1` lors de l'opt-in v2. Les états v2 utilisent le manifest v10. Les goldens historiques n'ont pas été modifiés.

## Preuves ciblées

| Point | Résultat local |
|---|---|
| A — Compiler/Finance V2 | 12/12 contrôles PASS, données synthétiques |
| Exemple détail | 15 + 5 Before + 4 × 5 Au bar + 11 taxi = 51 € |
| Exemple global | 40 + 11 taxi = 51 €, deux contributions actives |
| Quantité 4 → 6 en global | 51 € inchangé |
| Retour au détail | 15 + 5 + 6 × 5 + 11 = 61 €, prix unitaire 5 € conservé |
| B — interactions et persistance | 7/7 contrôles PASS, React + PostgreSQL PGlite isolé |
| Save/Reload | JSON/digests conservés ; réponse perdue/idempotence et conflit CAS testés |
| Preview → Apply → Reload | PASS dans SQL isolé : 1 Plan, 1 révision, idempotence conservée |
| Régressions historiques | v1 consumption, economic scope, groupes (13), kernel (40) PASS |
| Parité financière | 22 scénarios × 9 empreintes = 198/198, une exécution |

Scripts D1 : `check-bar-d1-global.mjs`, `check-bar-d1-integrated.mjs`. Les résultats machine sont sous `outputs/bar-d1/` (preuves locales non committées). Les tests SQL utilisent exclusivement un PostgreSQL embarqué synthétique, aucune instance Supabase distante. Les canaris interdisent les écritures sur les sources financières.

## Recette finale et limites

Le scénario `r62=d1` réutilise la route de réception Preview existante : même Composer, vraie connexion, faits financiers synthétiques en mémoire, Apply et sauvegarde distante interdits. Le statut du build Next et la réception navigateur au SHA exact sont consignés dans la PR, après la campagne locale. Une seule Preview finale est prévue.

La persistance et Apply SQL isolés ne constituent pas une certification Auth/RLS Supabase de ce nouveau parcours. Aucun accès d'identité fictive, Plan personnel, source financière, fournisseur Mobility, clé ou configuration Production n'est modifié.

Rollback avant intégration : fermer la PR ; aucune donnée distante ni schéma à restaurer. Après une éventuelle intégration future, préserver les lecteurs v2 avant tout retrait du writer ; ne pas supprimer les JSON sauvegardés.

