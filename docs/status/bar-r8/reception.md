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
- P3 et parcours R8 : 15 contrôles React/owner PASS, dont voiture confirmée avant domicile, préparation Mobility effective avec mock (1 appel route), Taxi indépendant, confirmation d'inversion, retrait d'un sens et heure datée. `proofs/react-owner.log`.
- Relations SHARES_JOURNEY valides et financement BANK : 5 assertions propriétaires PASS sans modification des entrées (`proofs/valid-guards.json`). Ce contrôle n'est pas une recette navigateur d'un trajet financé.

Les anciennes assertions de présentation ont été actualisées : détails techniques du véhicule uniquement à la demande, contrôles endpoint/prix ciblés par leur nom accessible, famille consommation préparée explicitement pour le test RAW. Les oracles d'identité, de prix UNKNOWN et de conservation restent identiques ; aucun ancien golden modifié.

## Illustration

Création avec le skill imagegen, outil intégré, sorties transparentes conservées en PNG :

- `public/planned-visuals/builder/clay/transport/taxi-r8.png` : « A single friendly golden yellow taxi, front three quarter view facing left, soft rounded handmade 3D modeling clay, understated realistic proportions like a small European hatchback, dark wheels, small TAXI roof sign. Warm ivory studio light, soft grounded shadow, isolated on genuine transparent background. Centered fully visible vehicle with modest margin, no other objects, no square background, no watermark. Match a clean warm cream and amber financial planning application illustration set. »
- `public/planned-visuals/builder/clay/home/house-r8.png` : « Single small cozy freestanding house, cream rounded walls, terracotta pitched roof, teal blue door, small windows, tiny green shrub. Front three-quarter view facing left, fully visible centered, soft warm studio light and soft grounded shadow, genuine transparent background. No text, no people, no extra scene, no watermark. »

Voiture, Train, Bus, Marche : illustrations Clay existantes. Les fallbacks restent identifiés `functional-icon`, jamais certifiés comme une illustration chargée.

## Réception et livraison

Produit testé : `f3943ee2bc46d7a18c13d260f0e0a27603000f52`. PR #77. Preview `dpl_GfK3Pp6XdwQDHs29Vsg1QZHBWX2j`, READY, build Next complet et TypeScript Vercel terminés (`proofs/vercel-build.log`). URL : https://budgetisation-lhc40zp9t-adriensauvageot34-6137s-projects.vercel.app/recette/bar-favoris?r62=empty&r63=1 .

Vrai navigateur Codex, Auth habituelle mais faits synthétiques en mémoire : 1440×900 et 1152×720 mesurés dans le DOM. Voiture : proposition Peugeot 207, une confirmation, domicile choisi, Bar UUID déjà à destination. Retour : deux choix explicites, Taxi, endpoints inverses et tarif UNKNOWN. Les cinq images transport et Maison chargent. Lignes de 42–72 px selon la largeur disponible, aucune zone vide dans la carte, aucun débordement horizontal ni scroll vertical interne. RAW `19,` retrouvé intact après annulation de navigation. Confirmation d'inversion d'un tarif à 19 € : digest inchangé avant acceptation, remise à UNKNOWN après acceptation, Undo restitue exactement le digest tarifé. Retrait du Retour puis Undo : Aller conservé, digest initial exact retrouvé. Accès avancé NightOutEditor → Transport vérifié. Console : aucune erreur recueillie. `proofs/browser.json` et `browser-assertions.json` ; captures `routes-1440.png`, `routes-1152.png`, `home-dock-1152.png`.

Limites : Live Google/TomTom/HERE non rejoués dans cette recette ; coût Mobility indisponible présenté honnêtement en Preview synthétique, estimation préparée séparément avec mocks par l'owner réel. Heure et garde trajet lié/financé exécutés localement ; pas de certification navigateur financée ni de sauvegarde personnelle authentifiée. Aucun Apply, favori ou Draft distant écrit. Pas de migration, aucun autre preset, After ou répartition.

Décision : `LOT1_READY_FOR_INTEGRATION_GOOGLE_DEFERRED`. Les preuves sont ajoutées dans un commit documentaire distinct ; aucun changement applicatif après le SHA produit testé. Fusion et Production à constater dans la clôture de PR.

Rollback : revert du commit R8 puis déploiement normal. Aucun rollback SQL ou effacement de Draft requis.
