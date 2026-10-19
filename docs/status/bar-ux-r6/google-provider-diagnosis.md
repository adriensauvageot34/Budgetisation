# R6 — diagnostic Google Places

## Causes établies avant le test fournisseur

La recette R5 `BAR_GEOMETRY_RECEPTION=1` interceptait volontairement autocomplete et Details avec `geometryPlaces`. Elle renvoyait des lieux fictifs et refusait Details. Ce chemin n'était pas une preuve du fonctionnement de Google réel. Il reste disponible pour les erreurs et réponses tardives.

Le panneau exposait une ville initiale issue du domicile lorsque celui-ci était unique. R6 ne reprend que la commune d'un lieu explicitement choisi ; sans cette décision, ville vide. L'API BAR_APERO ne remplace plus une ville omise par Montpellier. Les autres familles conservent leur contrat existant. Ville facultative, sections Lieux enregistrés / Google Maps / Nom libre, déduplication seulement par identité Google exacte.

## Circuit de réception réel

Preview uniquement, auteur autorisé, Board financier synthétique en mémoire. `BAR_GEOMETRY_LIVE_GOOGLE=1` sélectionne le fetch ordinaire dans la recette existante. Il ne modifie ni Auth, ni RLS, ni les guards d'Apply ; aucun transport Draft/favori n'est ajouté. Le bandeau annonce distinctement Google réel ou lieux simulés.

`BarPlaceSearch` → `RestaurantSearchSession` (300 ms, générations/annulations) → POST `/api/places/autocomplete` (`BAR_APERO`, ville explicitement renseignée ou vide) → `GoogleRestaurantPlaces`. Un clic demande POST `/api/places/details` ; seule une fiche compatible et de même placeId autorise `BarGoogleRef` prospectif. L'identité reste Google, jamais une création Canonical ou une visite passée. `night-out-venue` conserve les rattachements explicites des jambes ; la relecture pour Mobility reste sous son owner existant.

## Preuves actuelles

Mocks exécutés : résultats tardifs et désordonnés, changement de carte pendant Details, absence de sélection à la frappe, données photo non publiées ignorées, erreur503, erreurs401/403/429 compréhensibles, ville vide conservée, trois résultats par page et tous accessibles, sources distinctes. `check-bar-apero-google-route` : sept contrôles de références/round-trip/legs/provenance PASS, fournisseurs simulés.

Fournisseur réel et admission navigateur : EN ATTENTE de la Preview B. Aucun PASS live déduit des mocks. Pas de clé, token, adresse personnelle ou contenu de cookie dans les preuves.
