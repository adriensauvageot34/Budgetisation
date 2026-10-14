# Frontières de la prochaine implantation — à associer au groupe dominant mesuré

Ce document prépare les critères ; il n'implémente aucun artifact supplémentaire et ne choisit pas une priorité à partir du seul nombre de GET.

## Une préparation propriétaire commune

L'enveloppe retenue devra préparer les sorties historiques des owners déjà consommées par World, plutôt qu'un World complet. Ses versions de méthode, champs et digests seront ceux des lecteurs/projections existants. Les références précalculées ne pourront être utilisées que si leur calcul est indépendant du Draft, des ressources vivantes et du devis prospectif. Aucun moteur Finance V2 alternatif, ni duplication d'une publication Forecast existante.

Séparer explicitement l'histoire close de l'observation du mois courant. `MonthPredictionEvidence` mélange actuellement ces deux familles : historique économique/Mobility, mais aussi ledger Wallet, observations de solde et dépenses courantes. On ne peut pas sérialiser et réutiliser cet objet entier sans une séparation contractuelle. Les recurrences et la classification sont également des dépendances corrigibles rétroactivement.

## Scope et admission

Auteur autorisé actuel, foyer, personnes exactes, timezone, historique `[start,endExclusive)`, cutoff de connaissance, mois/catégories réellement couverts, versions propriétaires, génération de chacune des sources, identité des publications réutilisées, couverture, états UNKNOWN/PARTIAL, digest et génération CAS de l'artifact. Date/cutoff quotidien et changement de périmètre ne doivent jamais faire admettre un ancien artifact.

Inspecter permissions et versions dans un même snapshot SQL. Publication atomique sous CAS de toutes les dépendances, avec récupération d'un commit dont la réponse est perdue. Ancien artifact conservé mais non admis après invalidation. Échec réseau/permission/corruption reste une erreur explicite ; un MISS confirmé peut prendre le lecteur direct.

## Données toujours vivantes

Draft, choix S2/explicites, Plan actif et CAS, MonthInputs, protections d'épargne, PlannedExpenses, ressources Wallet et ledger nécessaires au mois courant, assertions modifiables non incluses dans la génération, prix/devis prospectifs et état des fournisseurs. Apply garde sa relecture autoritaire et le Compiler/Finance V2 évalue toujours le Draft courant.

## Invalidations à certifier dans la prochaine mission

Étudier uniquement la fermeture des sources du groupe choisi : vues Canonical et tables transitives, imports, updates et corrections rétroactives, liens/allocation/timing des achats, classifications/taxonomie, statut des périodes et couvertures, publications Global/Forecast utilisées, sources Mobility/localisations/participations si présentes, personnes et droits. Ne pas supposer qu'une révision générique ou une TTL constitue une preuve exhaustive. Vérifier chaque vrai writer sous une modification isolée avant activation.

## Taille, admission et maintenance

Mesurer préparation totale, corps JSON décodé et trafic compressé séparément, inspect/admission/décodage, invalidation avec concurrence et coût de maintenance. Le premier snapshot transfère environ 484 Ko pour seulement 107 Ko nets économisés sur le READ : un futur artifact doit éviter cette dilution. Privilégier les sorties historiques compactes du owner, avec preuves suffisantes, plutôt que toutes les lignes brutes. Aucun seuil d'admission présenté comme résultat avant mesure.

## Livraison réelle et preuve du gain

Développer localement, migration ciblée revue, certification des writers, publication de vrais artifacts, consommation sur Preview protégée. A/B du même code avec scope/date/génération/Draft/viewport identiques et P3 OFF. Comparer ouverture et édition, non seulement RPC. Parité complète des faits/Baseline/projection/digests ; domaines manquants et UNKNOWN ; concurrence, permissions, rollback OFF sans suppression. Décider de l'activation Production seulement après bénéfice net répétable et absence de dégradation inacceptable. Garder les essais défavorables et les P95 descriptifs petits n. Ni préparation ni publication lourde dans READ.
