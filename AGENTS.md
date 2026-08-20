# Règles durables du dépôt

1. Le Brief V2 fait autorité sur le produit, l’analytics, l’UX et l’architecture.
2. Supabase V2 fait autorité sur le schéma, les données et la couche canonique.
3. Ne jamais réintroduire la doctrine ou les implémentations métier V1.
4. Ne jamais exécuter les anciens scripts V1.
5. Ne jamais utiliser Supabase local sans ordre humain explicite.
6. Ne jamais réinitialiser Supabase distante.
7. Ne jamais committer de données bancaires personnelles ou de CSV réels.
8. Ne jamais exposer de clé `service_role` au client.
9. React ne calcule pas la doctrine financière ou statistique.
10. Une doctrine métier possède un seul endroit faisant autorité.
11. Toute modification Supabase exige une migration ciblée et une validation humaine.
12. Ne pas construire toute la V2 dans une seule tâche Codex.

En cas de conflit entre le Brief et Supabase, arrêter, ne rien inventer et demander
une décision humaine. Lire `docs/specs/` avant toute nouvelle architecture.
