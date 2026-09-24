# C1 — Purchase gross assertion ADR

## Schéma avant C1, relu sur Supabase live

| Objet | État avant C1 |
|---|---|
| `import_batches` | Household, `source_system`, `file_hash`, dates de période, `bank_account_id` nullable ; unicité `(household_id, source_system, file_hash)`. Aucun SourceRecord générique. |
| `purchase_events` | Identité UUID, Household, provenance, timestamps ; aucun montant. Aucune ligne live. |
| `purchase_event_memberships` | XOR sur `operation_id`, `allocation_id`, `item_id`, `payment_component_id`, `cash_use_id` ; clé canonique générée ; unicité de la clé du propriétaire et du triplet event/kind/key. Aucune ligne live. |
| `purchase_event_timing_assertions` | Autorité et précision temporelles séparées du montant ; date/mois, évidence, provenance. |
| `economic_component_classifications` | Même XOR et clé générée que les memberships ; axes `NECESSITY`, `BEHAVIOR`, `LIFE_SCOPE` ; unicité Household/composant/axe. Aucune ligne live. |
| `operations` | Montant bancaire et valeur économique distincts ; aucune colonne Household directe. |
| `payment_components` | Composantes rattachées aux Operations, consommées par la vue économique existante. Inadaptées au financement Benefit. |
| `financial_economic_cost_canonical` | Vue alimentée par Operations, Allocations, Items, PaymentComponents et CashUses ; aucune branche Purchase native. |
| `financial_bank_cost_canonical` | Vue des sorties bancaires alimentée par Operations/Allocations ; aucune branche Benefit. |
| Sécurité | RLS activé sans policy sur PurchaseEvent, classifications, import batches, Operations et payment components. Pas de grant `anon`/`authenticated` ; `service_role` dispose des droits. Les tables Purchase ont le garde Household `private.assert_history_v2_household_scope()`. |

## Décision

Le **gross de l'achat est stocké une seule fois sur `purchase_events`**, avec `gross_amount`, `gross_amount_status`, `gross_currency` et une référence facultative au `external_source_record` qui justifie l'assertion. `KNOWN` porte un montant exact ; `PARTIAL` porte un minimum observé (`LOWER_BOUND`) ; `UNKNOWN` et `CONFLICT` n'ont pas de montant numérique. La qualité du montant ne reprend aucune autorité de `purchase_event_timing_assertions` : les deux qualités sont indépendantes.

La clé primaire du PurchaseEvent est le lien déterministe du gross. Un achat mixte garde son membership `CONSUMPTION_COMPONENT` vers l'Operation existante ; le montant bancaire de cette Operation ne change pas. Un achat sans banque garde le même gross sur `purchase_events` et possède un `purchase_economic_component` à identité stable `purchase_component:<uuid>`. Ce composant est un propriétaire canonique et porte les références de classification, **sans recopier le gross**. Le contrat d'import C2 devra fournir des UUID stables issus de l'identité source, ainsi qu'un seul membership propriétaire par achat.

Un index unique limite chaque PurchaseEvent à un membership `CONSUMPTION_COMPONENT` ; le contrôle différé impose sa présence à la fin de la transaction. Un second contrôle différé impose qu'un composant Purchase natif soit ce propriétaire effectif : un composant natif ne peut donc pas coexister à côté d'un propriétaire Operation. L'unicité existante de la clé propriétaire empêche qu'un même composant soit attribué à deux achats. Les références composites `(id, household_id)` ferment les liens entre les nouvelles tables et `purchase_events`/`import_batches`.

Ce schéma n'ajoute ni colonne ni branche Swile, ne transforme aucun `payment_component` en financement, ne crée aucune Operation fictive et ne change pas les vues économiques. C2 pourra lire le gross et sa qualité sur le PurchaseEvent, puis résoudre le propriétaire Operation ou Purchase native selon le membership. C1 n'injecte encore aucun nouveau Fact dans les consumers.

## Index ajoutés et accès servis

| Index ou unicité | Raison |
|---|---|
| `import_batches_external_snapshot_unique`, `import_batches_external_identity_unique` | Retrouver le lot externe par source, instance et snapshot ; fermer le replay. L'unicité bancaire historique reste en place. |
| `persons_identity_household_unique` | Permettre la FK composite du propriétaire du wallet. |
| `external_source_records_replay_unique`, `external_source_records_batch_lookup` | Distinguer deux occurrences de même empreinte et lire un lot par Household. |
| `benefit_wallets_external_identity_unique`, `benefit_wallets_id_household_currency_unique` | Retrouver une identité fournisseur présente et valider wallet, Household et devise dans les FKs de funding/ledger. |
| `purchase_events_gross_source_unique` | Éviter qu'une preuve brute soit le gross de deux achats. |
| `purchase_economic_components_canonical_key_unique`, `purchase_economic_components_household_event_lookup` | Résoudre la nouvelle clé canonique et l'achat natif dans un Household. |
| `purchase_funding_components_household_event_lookup`, `purchase_funding_components_wallet_lookup`, `purchase_funding_components_bank_operation_lookup` | Lire les financements d'un achat et retrouver leurs sources wallet ou bancaire. |
| `benefit_wallet_ledger_wallet_date_lookup`, `benefit_wallet_ledger_source_lookup`, `benefit_wallet_ledger_purchase_lookup` | Parcourir le solde observable, tracer le brut et le débit associé à un achat. |
| `purchase_event_channel_active_unique`, `purchase_event_channel_household_event_lookup` | Une assertion active par achat et lecture par Household. |
| `purchase_event_one_consumption_owner_unique`, `purchase_event_memberships_purchase_component_lookup`, `economic_component_classifications_purchase_component_lookup` | Un propriétaire effectif par achat et jointures vers le composant natif. Les unicités historiques de clé propriétaire et de classification sont recréées. |

Les clés primaires et autres contraintes `unique` ajoutent leurs index implicites. Aucun de ces index ne change une vue économique ou une publication.

## Vérification locale C1

Les deux migrations PurchaseEvent historiques puis la migration C1 ont été rejouées sur une base PostgreSQL embarquée éphémère (PGlite) avec les tables préexistantes nécessaires. Vingt-quatre assertions SQL ont couvert les identités de replay, les deux propriétaires, les contraintes XOR, les fundings, le ledger, la classification et RLS. Ce replay ciblé ne remplace pas un `db reset` complet de Supabase : le repository ne contient pas le DDL de base de toutes les tables historiques.
