# Sources de vérité Budgetisation V2

## Autorité

Le **Brief V2 officiel** fait autorité sur le produit, l’UX, la navigation,
l’analytics, les états, les contrats applicatifs et l’architecture.

La **Supabase V2 distante** fait autorité sur le schéma, les tables, les
relations, les données et la vérité canonique réellement disponible.

Le **code** est une implémentation. Il ne devient jamais une troisième doctrine
métier et l’ancien code V1 ne constitue pas une spécification.

## Conflits

En cas de contradiction entre les sources, arrêter l’implémentation, ne rien
inventer et demander une décision humaine.

## Chaîne de responsabilité

```text
Relationnel
→ Canonique SQL
→ Faits analytiques
→ Analytics / références
→ API / read models
→ React
```

Une doctrine métier possède un seul endroit faisant autorité. React présente
les résultats reçus et ne recalcule pas la doctrine financière ou statistique.
