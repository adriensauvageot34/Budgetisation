# Impact budgétaire des intentions Composer

Base vérifiée de main et Production, `13167425e9ea1234eb3070229b60b8f4819d0133`.
Branche `codex/p21-budget-impact`. Doctrine `STRAT:P21-RECENTRAGE@v1`.

## Parcours livrés

Les résumés Achat, Courses, Restaurant, Cinéma, Week-end, Vêtements et Mascara affichent le coût total, le poste prévu remplacé et la contribution supplémentaire. Une lecture serveur regroupe les effets déjà calculés par le Compiler, par identité de contexte. Elle conserve les montants inconnus et publie son digest source. React met ces résultats en forme et les masque pendant le recalcul, après un échec ou lorsque le Draft ne correspond plus au digest.

Courses affiche les cas entièrement couvert, partiellement couvert, enveloppe épuisée, dépense en plus, rattachement à confirmer et enveloppe chiffrée absente. Les seuls montants de couverture proviennent de `displacedAmount` et `incrementalAmount`. Les frais et les suppléments conservent leur relation propre.

Avant cette tranche, un panier de 8 € montrait son total brut et sa décision de rattachement. Le résumé indique maintenant 8 € de coût, 8 € déjà prévus et 0 € supplémentaires si le Compiler le confirme. Avec 5 € de capacité, il montre 8 €, 5 € et 3 €. Si la relation est inconnue, la part prévue et le supplément restent à préciser.

Le détail Financement nomme les postes et les sources déclarées par les composants. La capacité de paiement et le reste à financer par intention ne sont pas publiés par l’autorité actuelle. Le détail l’indique explicitement. Les intentions enfants d’un Week-end conservent leur propre impact.

Le panneau du mois distingue la simulation, la complétude financière et la vérification avant de créer un Plan. Un scénario non résolu indique les déclarations mensuelles Swile/Edenred manquantes et les salaires absents de Forecast lorsque ces sources peuvent être identifiées dans la lecture autorisée. Les chargements explicitement déclarés à zéro restent des valeurs connues.

Une simulation échouée expose « Réessayer la simulation » dans le bandeau. Cette action utilise le scheduler existant avec un READ sur le même Draft. Les formulaires RAW et l’historique restent en place.

## Calculs et sources

Le Compiler, Finance V2, leurs contrats et leurs digests restent les autorités de calcul. La présentation est ajoutée après leur évaluation dans le read-model. Les tests comparent la Preview avant et après cette présentation et vérifient son digest officiel. Les détails compris dans une addition ou un forfait utilisent leur représentation métier existante.

Une contribution supplémentaire n’atteste pas une source de paiement. Une source déclarée n’atteste pas sa capacité. Le reste à financer individuel reste non ventilé, et les valeurs mensuelles restent accessibles dans le panneau financier existant.

## Contrôles

| Contrôle | Résultat |
| --- | --- |
| TypeScript et git diff --check | PASS |
| Résumé Courses 8 €, couverture 8 €, 5 €, 0 €, dépense en plus et relation inconnue | PASS sur fixtures officielles |
| Amazon 48 €, 53 € puis 55 €, identités et frais conservés | PASS |
| Restaurant 40 € et détail compris de 6 €, supplément distinct | PASS |
| Cinéma 12 € et popcorn 4 € | PASS |
| Week-end forfait 200 € et taxe distincte 8 €, prix par nuit, durée inconnue | PASS |
| Vêtements et Mascara, UNKNOWN et zéro distincts | PASS |
| Simulation indisponible, PARTIAL, UNKNOWN et READY_WITH_WARNINGS | PASS |
| Consultation sans mutation, résultats périmés masqués, preuve Compiler conservée | PASS |
| Réessai de lecture avec le même digest, ordre des réponses et Undo | PASS |
| Non-régressions Restaurant/Cinéma, Week-end, Vêtements, Mascara, Clay et lecture mensuelle B1 | PASS |
| Courses sur navigateur local à 1 280 × 720 | PASS partiel, 8 € / 5 € / 3 € et Dock observés, largeur document 1 280 |
| Autres interactions navigateur et 390 × 844 sur le code final | NOT_RUN |
| Recette authentifiée des nouveaux résumés sur Preview | NOT_RUN |

Le contrôle visuel a été interrompu par le message « Local browser use is disabled in Work settings ». La capture locale est conservée dans `outputs/p21-budget-impact-browser/courses-partiel-desktop.jpg`, hors commit. Elle précède le dernier ajustement de compacité et de positionnement du résumé. Les preuves synthétiques restent distinctes d’une certification authentifiée.

Commandes exécutées avec les outils React déjà présents dans `outputs/p21-react-tools` pour les suites React concernées.

- `node scripts/check-composer-budget-impact.mjs`
- `node scripts/check-composer-purchase-basket.mjs`
- `node scripts/check-restaurant-suggestions.mjs`
- `node scripts/check-composer-v22-a3-restaurant.mjs`
- `node scripts/check-composer-v22-a06-stay.mjs`
- `node scripts/check-composer-v22-a07-clothing.mjs`
- `node scripts/check-composer-v22-a1-mascara.mjs`
- `node scripts/check-composer-v22-b1.mjs`
- `node scripts/check-clay-discovery.mjs`
- `node scripts/check-composer-p03-interaction.mjs`
- `node scripts/check-composer-p14-snap3-canonical-timeout.mjs`

## Consultation Canonical

Les reçus historiques identifient les sources timing et places. Les requêtes concernées lisent notamment `financial_economic_timing_canonical` et `operation_place_canonical`. La cause unique de l’intermittence reste non établie. La lecture récente des journaux Production sur 30 minutes n’a trouvé aucun `57014`. La fixture SNAP-3 confirme qu’une erreur en page 2 ne produit aucun résultat partiel réussi.

Le réessai ajouté concerne la simulation en page. Le chargement initial serveur et les requêtes Canonical gardent leurs mécanismes existants.

## Livraison

L’autorisation couvre le commit, la branche distante, la PR et sa Preview. La disponibilité du navigateur intégré empêche de terminer la recette visuelle finale et authentifiée. Verdict produit `PARTIAL_READY`, sous réserve de ces contrôles visuels avant fusion.
