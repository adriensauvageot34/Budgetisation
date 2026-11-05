# Before N2 — réception isolée

Depuis la racine du dépôt :

```text
node scripts/check-before-admission.mjs
```

Le runner exécute les 54 groupes de finalisation existants puis cinq groupes
spécialisés d'historique. Les PASS comprennent des refus attendus : ils ne
certifient pas que tous les parcours sont sauvegardables.

Utiliser les dépendances du dépôt, notamment TypeScript et PGlite. La suite Shell
nécessite aussi React et react-test-renderer de versions identiques. Par défaut,
elle les résout depuis le package.json du dépôt. Un outillage de test séparé peut
être sélectionné avec PLANNER_REACT_TEST_TOOLS, chemin d'un répertoire contenant
son package.json et ses node_modules. Aucun chemin de poste de travail n'est requis.

Les suites exécutent des handlers réels, un service Draft réel et la migration
locale sur PGlite avec identités et faits synthétiques. HTTP utilise seulement
loopback. Les JSON de preuve sont générés sous outputs/before-admission ; aucune
connexion Supabase, clé réelle ou variable COMPOSER_BEFORE_DATABASE_URL n'est
nécessaire. Le Shell est reçu avec react-test-renderer et un Board observateur,
sans certification du focus dans un navigateur.

## Historique spécialisé

Les inverses utilisent exclusivement les commandes publiées des owners :

- v1 : montant manuel et transitions de mode lorsque le pré-état exact est
  reproductible ;
- v2 : GLOBAL/DETAILED et montant avec identités de l'autorité conservées ;
- remplacement de couverture : restauration des slots observés par le handler
  Bar existant, avec les identifiants originaux.

Le journal vérifie que l'owner reproduit exactement le pré-état complet. Le serveur
rejoue ensuite l'inverse avec les capacités courantes avant toute écriture SQL.
Une adoption initiale de mode ou certaines métadonnées inactives ne possèdent pas
d'inverse exacte ; le Save du cadre Undo est refusé, sans normalisation.

L'inverse PRESERVE vers une préférence réellement absente reste
STOP_LOCAL[OWNER_CONTRACT_REQUIRED]. PRESERVE=false écrit NORMAL et ne remplace
pas une suppression de préférence. Aucun CLEAR_PREFERENCE ni effacement/recréation
de Context n'est introduit.

## Gates ouverts

SAVED_ISOLATED ne signifie ni SAVED_AUTH, ni FRESH, ni APPLIED. La concurrence
PostgreSQL native, Auth/RLS inter-foyers, le navigateur et le canal SQL dédié réel
restent à recevoir séparément. La migration est proposée uniquement dans la PR
Draft et ne doit pas être appliquée sans mandat de livraison spécifique.
