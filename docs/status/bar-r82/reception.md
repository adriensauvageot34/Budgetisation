# Bar R8.2 — points Google dirigés

Base main : `a87aee834a19dc554c9e4c63dbfc5cdaadd34b15`, PR #77 intégrée. Branche : `codex/bar-r8-2-google-endpoints`. Aucun autre PR ouvert au préflight.

## Implémentation

- Scope `ROUTE_ENDPOINT` dans les API Google existantes, mêmes Auth/foyer/limites/no-store. Autocomplete garde `includedRegionCodes: ["fr"]` ; Details confirme le Place ID exact, une adresse exploitable, `addressComponents.country.shortText=FR` et des coordonnées valides. `types=[]` reste admissible pour une adresse. Les filtres établissements restent inchangés. Les coordonnées ne sont pas conservées dans la décision.
- Contrat optionnel `routeEndpointBindings`, version `route-endpoint@v1` : identité de décision, `selectionId`, clé origin/destination, repère textuel explicitement choisi et Google Place ID typé. Validators de C4, EDIT_NIGHT_OUT, expansion Compiler et digest de préparation raccordés. C0 JSON accepte ce champ sans migration ; anciens Drafts inchangés.
- `barEndpoint` invalide le seul binding affecté, y compris pour deux Place IDs homonymes. Inversion et nouveau Retour transfèrent les références vers les bonnes clés/identités ; aucun prix, financement ou devis copié. Les bindings Google du Bar restent distincts et suivent `barVenueAdaptations`.
- `preparePlanningMobility` vérifie le binding/arrêt/sens, `estimatePlannedCar` relit Details avec ROUTE_ENDPOINT et transmet l'adresse fraîche au géocodeur TomTom existant. Un échec Details interdit le repli sur d'anciennes coordonnées/distances de ce point. Aucun calcul financier React ou fournisseur parallèle.
- Éditeur compact commun aux quatre cibles : un champ, Google ON/OFF, choix connus et Nom libre toujours accessibles, vérification Details avant mutation, annulation/génération et portée du dernier rendu commis. Aucun favori/Canonical créé. Les résultats Google déjà classés par le serveur ne sont pas refiltrés par le dock.

## Preuves locales exécutées

- TypeScript sortie 0.
- Nouveau parser/provider/owner : 6 contrôles PASS ; pays refusés/manquants, ID erroné, types vides, anciens filtres, bindings contradictoires, quatre cibles, inversion/Retour, homonymes, absence de repli trompeur et C0 SQL round-trip ancien/nouveau.
- Recherche React : 6 assertions PASS ; champ unique, Details obligatoire, réponse d'une autre cible ignorée, erreur/reprise, OFF sans appel fournisseur et alternatives connues/libres.
- P3/R8 : 15 contrôles PASS, RAW et rejet conservés. Le premier essai a révélé que le filtre générique du dock cachait les choix connus en mode libre ; le dock de recherche délègue maintenant le filtrage à son owner, sans modifier les autres scènes.
- Google/route : 7 PASS. Mobility dirigée : 6 PASS sur PGlite synthétique. Planned Car : contrôles existants PASS. Finance : 22 cas × 9 empreintes = 198/198 PASS, exécuté une fois, golden inchangé.
- SQL : uniquement base synthétique locale du harness PGlite ; aucune migration Supabase, aucun test Auth/RLS revendiqué.

## Réception réelle et livraison

SHA produit testé : `f94ef725e8ef8163a2540913f0da3b05a3efc69b`. PR Draft [#78](https://github.com/adriensauvageot34/Budgetisation/pull/78). Preview `dpl_EriJeqc3EQCVAcpzmzaT43MqHeRv`, READY, build Next complet terminé. [Recette](https://budgetisation-pgc13iuuy-adriensauvageot34-6137s-projects.vercel.app/recette/bar-favoris?r62=empty&r63=1).

La recette authentifie le compte autorisé mais garde les faits financiers en mémoire et interdit Apply. Mobility réel n'est préparé que lorsqu'un trajet voiture a deux endpoints Google explicitement choisis : aucun géocodage des lieux fictifs initiaux. Aucun Draft personnel ou Plan officiel écrit.

### Blocage fournisseur réellement observé

La première recherche publique « Gare Montpellier Saint Roch » sur la Preview a affiché « Recherche Google indisponible ». Aucun résultat réel n'a été sélectionné. Le code refuse les appels quand `GOOGLE_MAPS_API_KEY` manque ; les métadonnées Vercel, lues sans déchiffrement, montrent la clé Google limitée à une ancienne branche R6 et les clés TomTom/HERE limitées à une ancienne branche de clôture. Aucune de ces variables n'est attribuée à R8.2. Le statut HTTP de cet essai n'a pas été capturé : ne pas le présenter comme directement mesuré. Les logs runtime bornés n'ont pas retourné de trace exploitable.

Après accord humain explicite, les trois variables existantes ont été réaffectées à la seule branche Preview `codex/bar-r8-2-google-endpoints`. PATCH du seul `gitBranch`, sans lire/modifier les valeurs, types ou targets ; Production inchangée. La relecture des métadonnées confirme Preview/sensitive. Les futurs builds des anciennes branches perdent ces trois overrides ; leurs déploiements immuables existants restent inchangés. Les variables Production sont masquées par Vercel : leur absence dans cette liste ne prouve pas leur absence en Production. Aucun secret n'est inclus dans les preuves.

### Navigateur exécuté indépendamment du fournisseur

À 1440 × 900, Google OFF : saisie libre explicite, navigation vers l'autre point interceptée par le dialogue RAW, « Continuer à modifier » conserve le texte, admission du texte libre sans identité Google, seule l'origine Aller modifiée, Undo rétablit exactement le digest antérieur. Preuves : `proofs/browser-free-mode.json`, `free-mode-undo.png`. Le calcul reste « À préciser » pour ce repère non géolocalisé. Ce test ne certifie ni Google Details réel ni une sauvegarde Supabase.

### Réception Google réelle après correction de portée

Preview `dpl_DGREqoonksd1ocXdEb27MVJ7imP1`, READY, SHA `a9920ee323a0697a439eebfb26bb30d79ee85a21` : arbre produit identique à `f94ef725e8ef8163a2540913f0da3b05a3efc69b` ; différence documentaire uniquement. [Recette finale](https://budgetisation-andenhbdt-adriensauvageot34-6137s-projects.vercel.app/recette/bar-favoris?r62=empty&r63=1). Auth réelle, données financières synthétiques en mémoire, aucun Draft distant ni Apply.

- Quatre recherches et sélections réelles : Aller départ Montpellier Saint-Roch, arrivée Hôtel de Ville ; Retour Taxi départ Musée Fabre, arrivée Place de la Comédie. Details vérifié avant chaque mutation. Les quatre Place IDs distincts restent associés aux bonnes clés après les retours serveur. Le lieu global « Bar des Trois Jours » reste celui de la fixture.
- Mobility réel revalide les deux endpoints voiture : route 2,245 km, 447 s, 0,254506 L et 0,51 € de coût d'usage PARTIAL. Carburant de repli de la recette synthétique, péage inconnu ; ne pas certifier ici le prix officiel carburant, HERE ou un tarif taxi. Retour Taxi conserve UNKNOWN, aucun coût voiture copié.
- Inversion du seul Retour : IDs échangés, Aller inchangé ; Undo digest exact puis Redo des mêmes IDs PASS. Mode libre sur un ancien point Google : RAW confirmé, texte préservé, seul le binding modifié disparaît, Undo restitue le Google ID exact.
- « Relancer la simulation » : serveur relit le Semantic Draft transmis ; quatre IDs et digest conservés, Preview FRESH. Ceci complète le round-trip JSON SQL synthétique ancien/nouveau ; aucun Reload Supabase personnel revendiqué.
- Dimensions effectivement mesurées : 1440 × 900 puis 1152 × 720, sans débordement horizontal du document à 1152. Captures complètes et `proofs/browser-live-google.json`. Le parcours fournisseur indisponible initial reste conservé dans les preuves, sans être transformé en PASS.
- Gates GitHub du SHA testé : Vercel SUCCESS ; aucune workflow Actions ni revue publiée retournée ; PR mergeable, base main inchangée. Pas de contournement de protection GitHub.

### Verdict avant livraison conditionnelle

Gates critiques de livraison PASS : `GOOGLE_REAL_BROWSER = PASS`, `GOOGLE_DETAILS_EXACT = PASS`, `GOOGLE_ENDPOINT_PERSIST = PASS` (round-trip SQL synthétique + relecture serveur en mémoire), `FOUR_ENDPOINTS_INDEPENDENT = PASS` local et navigateur réel, `GOOGLE_FREE_MODE = PASS`, `RAW_UNDO = PASS`, `MOBILITY_LIVE = PASS` limité à la route réelle et au coût PARTIAL avec carburant de repli synthétique, `FINANCE_PARITY = 198/198`, `TYPESCRIPT_BUILD = PASS`. La publication reste conditionnée au merge normal et à Production READY sur le merge SHA, puis smoke authentifié lecture seule. Aucune migration ni écriture financière distante.

La fusion reste interdite si le vrai Google Details, la conservation, la bonne cible ou les contrôles de sécurité échouent. Aucun gain de performance revendiqué.

## Références officielles ciblées

[Google Autocomplete](https://developers.google.com/maps/documentation/places/web-service/place-autocomplete) : `includedRegionCodes` restreint les résultats ; `regionCode` seul est un biais. Les adresses sont des entrées admissibles. Le contrôle pays définitif est fait sur Details, pas sur le libellé de prédiction.

Rollback : revert applicatif uniquement avec sauvegarde des nouveaux JSON ; un ancien runtime qui ne connaît pas le nouveau champ peut refuser leur édition. Ne supprimer ni binding ni Draft pour contourner cette incompatibilité. Aucune migration ou suppression de source prévue.
