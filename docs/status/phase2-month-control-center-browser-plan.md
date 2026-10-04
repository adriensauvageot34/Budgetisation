# Centre de contrôle — plan de test navigateur ciblé

Le navigateur local utilise le projet Supabase existant. Aucun schéma ni historique ne sera modifié.

Écritures temporaires proposées, uniquement pour octobre 2026 :

1. Ajouter une observation synthétique du solde Swile à **1,00 €**, datée du 4 octobre 2026, puis retirer uniquement cette observation.
2. Appliquer en une fois le draft **Courses : −5 % du reste** et **Restaurants du foyer : une sortie en moins**. Les deux hypothèses étaient absentes au démarrage du test ; les retirer ensuite avec « Revenir aux habitudes historiques ».
3. Vérifier que les seules clés modifiées sont ces inputs mensuels, que la modale reste ouverte et que les montants économiques initiaux sont rétablis.

Prévisualisation, navigation, fermeture et réouverture sont en lecture seule. Ne pas conserver de checkpoint. Ne créer aucune dépense prospective, opération, achat ou écriture de journal. Ne pas toucher aux cagnottes. Si les inputs changent simultanément en dehors du test, arrêter et conserver une trace du conflit avant toute restauration.
