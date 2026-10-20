# Bar / Apéro R8 — réception ciblée

Base : `411d99014836ac3dcb50460db419e8ae9feb0d42` (main, PR #76). Branche : `codex/bar-r8-trajets-intelligents`.

## Produit

Lot 1 : modes immédiats ; capsule du véhicule unique proposée puis confirmée explicitement ; domicile classé en premier sans admission automatique ; destination Bar conservée avec son identité/binding ; ligne commune Aller/Retour avec inversion entre les points, retrait d'un seul sens, prix/détails et accès avancé. Le Retour n'existe qu'après une action et reprend les points inverses avec un prix inconnu, sans données voiture pour Taxi. Les heures facultatives utilisent `plannedTime` du sens sélectionné, exigent la date prévue par le contrat et restent protégées par RAW. Prix, financement, héritage et étapes complexes renvoient aux options avancées pour l'horaire.

Correction reproduite en construisant le nouveau parcours : la confirmation du véhicule avant le domicile laissait `route.stops=[]`. L'admission du second point construit maintenant les deux arrêts via `stopForPlace`, sans distance ni prix inventés. Le test R8 prépare ensuite réellement le même Semantic Draft via `preparePlanningMobility` avec des fournisseurs synthétiques.

Aucun owner, calcul financier, contrat persistant ou migration modifié. Le shell transmet uniquement son état Preview à la présentation pour distinguer calcul en cours, résultat précédent et erreur. Réception Preview en mémoire uniquement, `Apply` interdit par l'API de recette et aucune sauvegarde Draft distante.

## Frontière Google

`GOOGLE_ENDPOINT_DEFERRED` : `ProjectPlaceKind` et `projectPlaceTypeCompatible` (`src/domain/phase2/restaurant-places.ts`) n'admettent pas une adresse arbitraire ; `DESTINATION` vise les localités/sites, pas une rue ou un domicile. `src/server/places/http.ts` valide cette liste. `ProspectivePlaceRef` est KNOWN/TEXT ; `night-out-venue@v1` lie Google au lieu Bar. Livrer un endpoint Google indépendant réclame une identité versionnée de point, sa validation serveur et son admission Mobility, distinctes de `venueEndpoints`. Aucun faux résultat Google ajouté. Le champ actuel filtre les lieux admissibles enregistrés et offre Nom libre, explicitement non vérifié.

## Contrôles locaux

- TypeScript : exécuté, sortie 0 (à reconfirmer sur SHA produit).
- Google/route : 7 contrôles PASS, fournisseurs synthétiques.
- Mobility dirigée : 6 contrôles PASS, Compiler/C0/Apply/Reload sur PGlite synthétique uniquement.
- Parité financière : 22 cas × 9 empreintes = 198/198 PASS, zéro écriture distante ; golden inchangé.
- P3 et parcours R8 : réception finale en cours ; journaux conservés dans les preuves de ce dossier à la clôture.

Les anciennes assertions de présentation ont été actualisées : détails techniques du véhicule uniquement à la demande, contrôles endpoint/prix ciblés par leur nom accessible, famille consommation préparée explicitement pour le test RAW. Les oracles d'identité, de prix UNKNOWN et de conservation restent identiques ; aucun ancien golden modifié.

## Illustration

Création avec le skill imagegen, outil intégré, sorties transparentes conservées en PNG :

- `public/planned-visuals/builder/clay/transport/taxi-r8.png` : « A single friendly golden yellow taxi, front three quarter view facing left, soft rounded handmade 3D modeling clay, understated realistic proportions like a small European hatchback, dark wheels, small TAXI roof sign. Warm ivory studio light, soft grounded shadow, isolated on genuine transparent background. Centered fully visible vehicle with modest margin, no other objects, no square background, no watermark. Match a clean warm cream and amber financial planning application illustration set. »
- `public/planned-visuals/builder/clay/home/house-r8.png` : « Single small cozy freestanding house, cream rounded walls, terracotta pitched roof, teal blue door, small windows, tiny green shrub. Front three-quarter view facing left, fully visible centered, soft warm studio light and soft grounded shadow, genuine transparent background. No text, no people, no extra scene, no watermark. »

Voiture, Train, Bus, Marche : illustrations Clay existantes. Les fallbacks restent identifiés `functional-icon`, jamais certifiés comme une illustration chargée.

## Réception et livraison

Preview exacte, dimensions réelles, captures, gates GitHub et Production : à compléter après exécution. Aucune promotion avant réception critique PASS. Pas de recette personnelle, de sauvegarde distante ni d'Apply réel.

Rollback : revert du commit R8 puis déploiement normal. Aucun rollback SQL ou effacement de Draft requis.
