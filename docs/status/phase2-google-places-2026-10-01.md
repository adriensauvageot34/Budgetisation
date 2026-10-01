# Restaurant — Google Places API (New)

## Livraison

```ini
HEAD_BEFORE = ce51a70131d28fd3142999923da9241c52da93bd
HEAD_AFTER = commit contenant ce rapport (commande de résolution ci-dessous)
BRANCH = main
MIGRATIONS = NONE
SUPABASE_WRITES = NONE
VERCEL_PRODUCTION_ENV = GOOGLE_MAPS_API_KEY configurée comme Secret

GOOGLE_PLACES_API_NEW = PASS
AUTOCOMPLETE = PASS
SESSION_TOKEN = PASS
FIELD_MASK = PASS
SERVER_ONLY_KEY = PASS

KNOWN_RESTAURANT_PRIORITY = PASS
MONTPELLIER_BIAS = PASS
ELSEWHERE_CITY_BIAS = PASS
PLACE_DETAILS = PASS
RESTAURANT_TYPE_FILTER = PASS

GOOGLE_PLACE_ID_PERSISTENCE = PASS (Preview/Save/reload en mémoire)
ADDRESS_AUTOFILL = PASS (navigateur réel, Montpellier et Sète)
TRANSPORT_HANDOFF = PASS (navigateur réel, TomTom/HERE/carburant)

PLACE_PHOTO = PASS (provider live et tests ciblés)
PHOTO_FALLBACK = PASS (composant et tests ciblés)
PHOTO_PERSISTENCE = NONE
GOOGLE_ATTRIBUTION = IMPLEMENTED
AUTHOR_ATTRIBUTION = IMPLEMENTED
SAVED_PHOTO_CARD_BROWSER = NOT_TESTED

MANUAL_FALLBACK = PASS
GOOGLE_FAILURE_FALLBACK = PASS
TESTS = PASS
TYPECHECK = PASS
BUILD = PASS
LINT = NOT_CONFIGURED
```

Le commit de livraison se résout sans inscrire une empreinte autoréférente dans son propre contenu :

```powershell
git log -1 --format=%H -- docs/status/phase2-google-places-2026-10-01.md
```

Le push sur `main` utilise l’intégration Git Vercel existante. La clé est renseignée dans `.env.local` ignoré par Git et dans l’environnement **Production** de Vercel. Aucun secret n’est reproduit dans ce rapport.

## Architecture et contrat

- Trois endpoints POST authentifiés : `/api/places/autocomplete`, `/api/places/details`, `/api/places/photo`. Réponses privées `no-store`, vérification du foyer, refus des origines externes et limites de requêtes.
- Service Places séparé de Transport, clé dans un header serveur, aucun appel Google avec la clé depuis React. Timeout de 4,5 secondes, au plus une relance transitoire, aucune relance 4xx, protection temporaire après refus d’authentification Google.
- Recherche après deux caractères et 300 ms. Token stable pendant la recherche, réutilisé pour Details, renouvelé après sélection. Requêtes identiques supprimées, anciennes réponses ignorées/annulées.
- Field masks explicites, sans `*`, sans avis, note, téléphone ou site. Photos demandées seulement pour une card visible ; aucune photo des suggestions n’est préchargée.
- Lieux canoniques compatibles avant Google, puis références déjà choisies dans les projets du mois courant. Déduplication par Google Place ID lorsqu’il existe, jamais par rapprochement flou du nom.
- Montpellier : biais circulaire de 20 km. Ailleurs : ville demandée avant recherche, biais sur la ville via le géocodeur Transport. Le biais n’est pas une restriction géographique stricte.
- Types plausibles : restaurants et spécialisations, cafés, restauration à emporter. Un bar seul est exclu car le contexte partagé Restaurant exige le rôle Restaurant.
- `context.restaurant.googlePlaceId` est la seule nouvelle référence provider durable. Le libellé durable est l’intention tapée par l’utilisateur. Le parser fermé refuse un dump Google, ses coordonnées, photos/URI et une adresse persistée avec cet ID.
- Details est rechargé à l’édition d’un projet possédant un ID. ID absent/obsolète, adresse absente ou provider indisponible : choix d’un autre restaurant ou saisie manuelle disponible.
- L’adresse Google est utilisée transitoirement pour géocoder avec TomTom. Les coordonnées de route restent celles de TomTom ; les coordonnées Google ne sont pas copiées dans le snapshot. Aucun Google Map ni carte tierce n’est ajouté.
- Une adresse complète identifiée ailleurs n’est pas biaisée vers le domicile lors du géocodage TomTom : le test réel Sète montrait une confiance artificiellement réduite par ce biais. Le seuil existant de refus des adresses ambiguës est conservé.
- Changement de Google ID : invalidation du trajet et du Preview. Le remplacement de destination reconstruit l’aller-retour et conserve les détours explicites existants. Undo reste dans le mécanisme local existant.
- La card Restaurant utilise une photo Google temporaire si disponible, sinon le fond Restaurant générique. Cover, désaturation et overlay ; attribution Google Maps et auteurs visibles. URI seulement en état React, sans téléchargement, Next Image, Supabase Storage ou copie permanente.
- `/mentions-places` est un avis public limité aux conditions/confidentialité du provider, sans information de foyer. Les autres routes gardent leur authentification.

## Commandes et preuves

Runtime Node existant, aucune nouvelle dépendance. Commandes exécutées depuis le dépôt :

```powershell
node scripts/check-phase2-google-places.mjs
node scripts/check-phase2-restaurant-wizard.mjs
node scripts/check-phase2-planned-car.mjs
node node_modules/typescript/bin/tsc --noEmit
node node_modules/next/dist/bin/next build
git diff --check
```

| Vérification | Résultat |
| --- | --- |
| Debounce, tokens, doublons, réponses obsolètes | PASS |
| Taxonomie, compatibilité ville, priorité locale | PASS |
| New API, masks, biais Montpellier/Sète | PASS |
| Details, photo présente/absente, auteurs, liens sûrs | PASS |
| Timeout, relance transitoire, refus 4xx | PASS |
| Saisie manuelle et restaurant choisi plus tard | PASS |
| ID seul, parsing négatif, Preview/Save/reload | PASS, fixtures en mémoire |
| Destination Google → géocodage TomTom | PASS, mocks + navigateur |
| Réparation aller-retour, détour explicite conservé | PASS |
| Auth anonyme, origine externe, limite par minute | PASS |
| Contrat existant Restaurant et calcul voiture | PASS |
| Recherche réelle Young Min, Details et photo provider | PASS |
| Montpellier → sélection → Voiture sans question d’adresse | PASS |
| Ailleurs → Sète → sélection → Voiture sans question d’adresse | PASS |
| Sète : aller-retour, coût essence, péage et variante sans péage | PASS |
| Console navigateur, erreurs | 0 |
| Scan du secret dans sources non ignorées et bundle client | PASS |
| Écritures Supabase/historiques pendant ces tests | 0 |
| Photo d’une card après Save dans le navigateur connecté | NOT_TESTED |

Les brouillons des smokes navigateur ont été abandonnés explicitement. Aucun projet de test n’a été enregistré dans Supabase. Les coûts réels calculés lors des smokes ne constituent pas des fixtures persistées.

## Fichiers changés

Nouveaux :

- `src/domain/phase2/restaurant-places.ts`
- `src/server/places/google-places.ts`
- `src/server/places/http.ts`
- `src/app/api/places/autocomplete/route.ts`
- `src/app/api/places/details/route.ts`
- `src/app/api/places/photo/route.ts`
- `src/app/mois-a-venir/restaurant-place-search.tsx`
- `src/app/mois-a-venir/restaurant-photo-background.tsx`
- `src/app/mentions-places/page.tsx`
- `scripts/check-phase2-google-places.mjs`
- Ce rapport.

Adaptés :

- `.env.example`
- `src/domain/phase2/planned-contract.ts`
- `src/domain/phase2/planned-places.ts`
- `src/domain/phase2/planned-restaurant.ts`
- `src/domain/phase2/planned-restaurant-builder.ts`
- `src/domain/phase2/planned-builder.ts`
- `src/server/phase2/planned-car-estimation.ts`
- `src/server/phase2/planned-expenses.ts`
- `src/app/mois-a-venir/planned-expenses-actions.ts`
- `src/app/mois-a-venir/planned-expenses-control.tsx`
- `src/app/mois-a-venir/planned-route-editor.tsx`
- `src/app/mois-a-venir/restaurant-wizard.tsx`
- `src/lib/supabase/proxy.ts`
- `scripts/check-phase2-restaurant-wizard.mjs` : remplacement de l’ancien rejet « Ailleurs sans restaurant/type » par le contrat autorisant « Je choisirai plus tard ».

## Limites connues et suites

```ini
KNOWN_LIMITATIONS = protection de débit par instance ; disponibilité des providers ; IDs canoniques non disponibles actuellement ; souvenirs de sélection limités aux projets du mois courant
FOLLOW_UPS = vérifier la card photo après un enregistrement utilisateur réel
```

- Le compteur de requêtes est borné et local à l’instance serveur ; il n’est pas un quota distribué entre toutes les instances Vercel. Adapté au faible volume personnel attendu.
- Les lieux canoniques actuels ne fournissent pas de Google Place ID ; aucune attribution ni migration inventée. Le champ optionnel permet la déduplication quand cette référence existe.
- Si le géocodage de la ville échoue, son texte complète la recherche Google. Si le géocodage de l’adresse échoue, le trajet reste explicitement incomplet et la réparation manuelle est proposée.
- Pas de catalogue Google, import massif, stockage de photo, mémoire personnelle ou apprentissage automatique ajouté.
- Le composant photo et la chaîne provider sont implémentés et vérifiés ; le smoke de card après Save reste à vérifier avec un projet réel. Aucun PASS navigateur n’est affirmé pour ce scénario.
- Les anciens warnings de dimensions de certains SVG de marques observés sur la page ne sont pas des erreurs console de cette intégration.

## Références officielles utilisées

- [Autocomplete (New)](https://developers.google.com/maps/documentation/places/web-service/place-autocomplete)
- [Place Details (New)](https://developers.google.com/maps/documentation/places/web-service/place-details)
- [Place Photos (New)](https://developers.google.com/maps/documentation/places/web-service/place-photos)
- [Places policies et attribution](https://developers.google.com/maps/documentation/places/web-service/policies)
- [Conditions EEE](https://cloud.google.com/terms/maps-platform/eea/maps-service-terms)
- [Usages autorisés Places EEE](https://cloud.google.com/terms/maps-platform/eea-places-api-permitted-uses)
