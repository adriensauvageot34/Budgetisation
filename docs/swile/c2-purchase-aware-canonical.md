# C2 — Canonical économique avec achat explicite

## Carte de dépendances avant C2

| Autorité ou lecteur | Contrat observé |
|---|---|
| `financial_bank_cost_canonical` | Vue issue des Operations et allocations ; la sortie bancaire conserve `montant_bancaire_depense`. |
| `financial_economic_cost_canonical` | Vue issue des Operations, allocations, items, anciens payment components et cash uses. Chaque ligne est liée à `operation_id`. |
| `economic_consumption_segments` | Table des segments temporels par clé de composant économique. |
| `financial_economic_timing_canonical` et `financial_economic_timing_control` | Vues qui joignent les segments à `financial_economic_cost_canonical` et rapprochent les montants de cette vue. Elles ne peuvent pas représenter directement un propriétaire sans Operation. |
| `purchase_events` / memberships / timing / classifications | C1 stocke le gross sur l'achat, l'unique propriétaire dans le membership, une qualité temporelle séparée et les assertions de classification par clé. |
| `purchase_economic_components` | C1 fournit l'identité du propriétaire sans banque, sans copie du gross. |
| `canonical.ts` / `validation.ts` | La projection économique historique lit la vue et exige une Operation ; le projecteur historique PurchaseEvent calcule son montant à partir des facts de cette vue. |
| `CanonicalRepository` | `loadEconomicFacts` lit les vues historiques ; `loadEconomicComponentClassifications` exige une Operation ; `loadPurchaseEvents` alimente directement M8, Persona et Global. |

## Projection C2

`loadPurchaseAwareCanonical(range, visibility)` est la frontière explicite. En `DEFAULT`, elle retourne les mêmes objets `EconomicComponentFact` que `loadEconomicFacts(range)` et ne lit aucun PurchaseEvent pilote. En `PURCHASE_AWARE_PILOT`, elle lit exclusivement les achats marqués pilotes, leur gross C1, leurs memberships, leurs assertions de temps et de classification, leurs éventuels composants natifs et les Operations réellement liées.

`resolveEffectivePurchaseEconomicOwner` admet un seul membership de consommation `operation:<uuid>` ou `purchase_component:<uuid>`. Zéro propriétaire renvoie `UNRESOLVED`; plusieurs, une clé incohérente ou une source non prise en charge renvoient `CONFLICT`. Le résultat porte `status = BLOCKED` et les raisons dans `blocking` lorsque l'activation est impossible. Aucun propriétaire ni Operation n'est fabriqué.

La projection pilote retire toutes les lignes économiques historiques d'une Operation appartenant à un achat mixte et émet une seule ligne à la clé propriétaire `operation:<uuid>`, au montant brut de `purchase_events`. Elle garde séparément le montant bancaire original de l'Operation. Pour un achat sans banque, elle émet une ligne `Purchase_component`, avec `sourceOperation = not_applicable` et `bankAmount = NOT_APPLICABLE`. Les champs génériques category, subcategory, Need et merchant proviennent du propriétaire natif ou de l'Operation ; les axes NECESSITY, BEHAVIOR et LIFE_SCOPE proviennent des assertions canoniques avec le repli Operation existant.

`EconomicAmountQuality` représente `KNOWN`, `LOWER_BOUND`, `UNKNOWN` et `CONFLICT`. Le `PARTIAL` SQL de C1 devient `LOWER_BOUND`. L'addition propage les bornes, l'inconnu et les conflits, sans convertir l'inconnu en zéro. La temporalité vient de `purchase_event_timing_assertions`; `TRUSTED_PURCHASE_SOURCE` demeure une autorité valide. `purchaseIdentityKeyOfEconomicFact` fournit `purchase:<purchase_event_id>` pour le pilote et `operation:<operation_id>` pour un fact historique, sans modifier le payload DEFAULT. Cette identité reste distincte de la clé propriétaire et des clés de segments temporels.

Les financements et crédits wallet ne sont pas lus par cette projection. Les contrôles de rapprochement historiques des Operations restent appliqués lors du chargement de leurs facts canoniques. Pour un propriétaire natif, le rapprochement est celui du gross PurchaseEvent, du membership unique et de l'identité du composant. Aucun contrôle bancaire n'est appliqué au composant natif.

## Visibilité et compatibilité

La nouvelle migration ajoute `purchase_visibility`, par défaut `DEFAULT`, avec une valeur explicite `PURCHASE_AWARE_PILOT`. `loadPurchaseEvents()` filtre les achats pilotes avant son projecteur historique : M8, Persona et Global gardent leur chemin actuel. Une base antérieure à C2, sans cette colonne, est lue avec le comportement historique ; la migration C1 n'est pas réécrite. Le mode pilote n'est demandé par aucun consumer actuel.

Les vues bancaires, économiques, temporelles et leurs contrôles ne sont pas modifiés. Aucun changement FOOD, Grocery, BackgroundRhythms, Query ou UI n'est inclus. Le replay local ciblé applique les prérequis PurchaseEvent, C1 puis C2 ; le replay Supabase historique complet demeure indisponible faute de DDL de base dans le repository.

## Preuves locales

Le test `check:c2-purchase-aware` couvre 57 assertions, dont les douze fixtures adversariales F1–F12, la séparation montant/temps, la lecture sans Operation, le filtre M8 et l'égalité des objets DEFAULT. Un replay PostgreSQL embarqué éphémère applique les deux migrations PurchaseEvent historiques, C1 puis C2 et vérifie 26 assertions de schéma et de sécurité. Typecheck, Canonical, Purchase, Global, Moments, Persona et CAR passent. Le read-back Supabase reste D8/A109, publication `fdff4ee0-5240-5362-8117-edd81624fb42`, 1 473 lignes bancaires et 1 484 lignes économiques ; les empreintes des deux vues sont celles de C1.
