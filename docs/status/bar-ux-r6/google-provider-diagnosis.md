# R6 — Google Places réel

## Causes établies
La recette géométrique R5 interceptait autocomplete/Details avec geometryPlaces : lieux fictifs, jamais une preuve live. R6 ajoute un opt-in Preview auteur autorisé utilisant le fetch ordinaire, sans transport Draft/favori ni changement Auth/RLS/Apply.
La ville était proposée implicitement depuis le domicile : supprimé. Seule la commune d'un lieu explicitement choisi peut être reprise ; sinon ville vide. BAR_APERO ne remplace plus une ville omise par Montpellier. Autres familles inchangées.

Premier test live503 : métadonnées Vercel sans déchiffrement établissent que la clé serveur existante ciblait seulement une ancienne branche Preview. Réaffectation officielle à R6, valeur omise dans l'appel : aucune clé lue, recopiée, publiée ou committée. Production/global inchangés pendant les tests. Retour de portée possible sans lire le secret.

## Circuit et preuves
BarPlaceSearch → RestaurantSearchSession (300ms,générations/annulations) → POST /api/places/autocomplete BAR_APERO → GoogleRestaurantPlaces. Clic explicite → POST /api/places/details. Fiche compatible de même placeId requise pour BarGoogleRef prospectif.
Sources distinctes Lieux enregistrés / Google Maps / Nom libre ; identité exacte pour déduplication, pas le texte. Aucun bar transformé en favori, Canonical ou visite historique.

**GOOGLE_REAL_PROVIDER=EXECUTED_PASS_LIMITED_READ_ONLY**.
Deux vrais parcours :90b6606 configuré puis SHA final4f4f7c2201395fd4b62ba93b01b77211cb0596e3, dpl_97wUXWxJ4LT8eq1UFUrVm36FJzpG.
Ville explicitement saisie Montpellier, requête publique Le Rebuffy. Résultat Le Rebuffy · Rue Rebuffy, Montpellier. Clic → «Lecture du lieu…» → «Bar Google retenu · itinéraire calculable sous réserve des fournisseurs», choix mémoire.
Captures final-google-live-results/admitted.png et preview-b-google-live-*. Bandeau de recette : Google réel, faits synthétiques et aucun enregistrement distant. Aucun cookie, clé, adresse privée ou jeton publié.

Mocks distincts PASS :401/403/429/503, réponses tardives/désordonnées, changement de carte pendant Details, pas d'admission à la frappe, quatre résultats accessibles3/page, ville facultative et sources. Routes7 PASS sur fixtures : refs/round-trip/legs/provenance.
TomTom/HERE/fuel live NOT_RUN ; ce PASS Google ne certifie pas une estimation Mobility réelle ni la persistance durable.
