# Budgetisation

Première version navigable de l’application d’analyse du budget historique d’Adrien et Manon.

```bash
npm install
npm run dev
```

Les données fictives locales se trouvent dans `src/data/mock/mock-budget-data.ts`.

Pour connecter Supabase plus tard, créez une nouvelle implémentation du contrat `BudgetRepository` défini dans `src/data/budget-repository.ts`, puis remplacez l’instance locale exportée par `src/data/index.ts`.
