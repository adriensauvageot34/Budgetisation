# Bar / Apéro P3 — réception connaissances, Google et Mobility

## Cadrage avant modification (17 octobre 2026)

Base réelle fetchée : `d6379bcbfdc217ee51c05989f2036407329eb2fd`, PR #59–62 MERGED. Branche `codex/bar-apero-p3-real-knowledge`. Worktree suivi propre ; `outputs/` préexistant conservé. Aucune fusion/Production/migration/Apply autorisée dans P3.

| Fait | Source/owner et filtre | DTO actuel → raccord prévu | Usage UI et writer | Limite/fallback |
|---|---|---|---|---|
| Lieu canonique | referentiel_lieu via client Canonical serveur, scope mono-foyer READY ; pas de SELECT anon/authenticated | Identité/classification existantes | Dock Bar, EDIT_NIGHT_OUT.fields.placeRef KNOWN | Privé exclu des bars |
| Visites | location_occurrences des person_id du contexte autorisé + person_days.date, pagination complète 1000, jours distincts | visits12Months/lastVisitDate lus mais perdus dans la projection ; transmettre avec fenêtre et couverture | Classement déterministe, aucun writer avant clic | Observations disponibles, pas fréquentation exhaustive ; 500 lieux maximum |
| Maison | classification exacte Domicile privé/Domicile/Domicile principal ou rôle propriétaire actif | Réutiliser derivePlannedPlaceRoles après contrôle du scope Canonical, pas le premier foyer | Origine/destination candidate ; EDIT_NIGHT_OUT sur un seul leg après clic | Plusieurs Maisons : choix nécessaire |
| Travail/contact | person_place_roles, identité personne du contexte, valid_from/valid_to/source ; PRIMARY_WORK attesté par migration Persona et consommé par Global | Projeter seulement les liens actuels avec personId | Endpoint nommé pour la personne exacte ; aucun participant induit | WORK_MEAL_ANCHOR n'est pas un emploi ; rôle absent/expiré non proposé |
| Google exact | Aucune colonne Google/provider_place ni table d'identité trouvée dans public/private ; aucune admission Canonical Google trouvée | Ne pas inventer googlePlaceId dans le reader | Matching exact déjà existant testé sur source synthétique ; aucune promotion réelle | BLOCKED_OWNER_GOOGLE_IDENTITY |
| Nouveau Google | API Autocomplete/Details existantes, résultat transitoire | Validation exacte/réponses tardives et fallback TEXT explicite | Seul label choisi, sans Google ID/coordonnées persistés | BLOCKED_OWNER_NEW_GOOGLE_PLACE |
| Véhicule | vehicles household_id/status active ; lecteur actuel choisit premier des cinq | Ajouter preuve d'unicité, sans changer le véhicule financier | Raccourci composite seulement si Maison/bar/voiture non ambigus et mode admissible | Pas de conducteur, de prix ni de plein inférés |
| Coûts | Compiler/Mobility/Finance V2, summaries par ownerIntentId | Inchangé | Lecture des montants officiels | UNKNOWN/PARTIAL conservés |

## Métadonnées vérifiées en lecture seule

Requêtes bornées 3–5 secondes, transactions READ ONLY terminées par rollback. Tables referentiel_lieu/person_place_roles/location_occurrences/person_days : RLS activée, aucune policy utilisateur publiée ; droits servis par le client Canonical serveur, pas par une nouvelle permission navigateur. Liens person_place_roles : person_id, place_id, role, valid_from, valid_to, source. Les rôles observés incluent PRIMARY_WORK et WORK_MEAL_ANCHOR (distincts). Pas de donnée personnelle ni de ligne financière exportée dans ce rapport.

## Exécution

Implémentation et preuves à compléter. Aucun PASS anticipé, NOT_RUN_AUTH_P3 et NOT_RUN_PROVIDER à ce stade. Le rapport P2 de Production reste historique ; aucune autorisation de mutation P2 n'est reportée sur P3.
## Réception P3

- Code produit testé : `70b2fa5e587f1dff0b1ab309a4634f7577c738c6`.
- PR Draft : https://github.com/adriensauvageot34/Budgetisation/pull/63, base `main` inchangée.
- Preview code : https://budgetisation-hex56h7yu-adriensauvageot34-6137s-projects.vercel.app ; déploiement `dpl_Hfd6Sr7ZiPD4D7inJVFunpuC72rM`, target `null` (Preview). `READY`, build Next complet exécuté ; journal `evidence/bar-apero-p3/vercel-build-product.log`. Commande Vercel `npm run build` → `next build`, compilation puis TypeScript, génération, packaging et déploiement terminés (environ 120 s construction/déploiement).
- SHA documentaire : commit qui introduit la version finale de ce rapport, descendant du SHA produit ; seules les preuves et la documentation s’y ajoutent. Comparaison `git diff 70b2fa5..HEAD -- src scripts` exigée vide.
- Aucune mutation Supabase P3 : métadonnées lues uniquement, aucune sauvegarde personnelle, aucun Apply distant, aucune migration. Aucune fusion ni promotion Production, aucun P4.

### Ce qui change réellement

| Capacité | Statut | Avant → après |
|---|---|---|
| Données de fréquentation | IMPLEMENTED | Déjà calculées chez l’owner, perdues dans le DTO → jours distincts/fenêtre transmis pour les lieux publics ; pas de favori inventé |
| Dock Lieu | IMPLEMENTED | Liste globale mêlant des lieux privés → 3 bars publics classés, puis recherche locale et tous les bars chargés ; homonymes séparés par adresse publique ou suffixe d’ID |
| Maison / Travail / contacts | IMPLEMENTED_LIMITED_OWNER | Endpoints non contextualisés → Maison et liens actuels proposés explicitement ; Travail exige PRIMARY_WORK + personId autorisé ; WORK_MEAL_ANCHOR seul n’est jamais présenté comme emploi |
| Aller voiture rapide | IMPLEMENTED | Mode, origine et véhicule séparés → un clic annoncé Maison→bar, Voiture et véhicule nommé, seulement si Maison et véhicule uniques et capacité CAR admissible ; aucun Retour implicite |
| Endpoints libres | IMPLEMENTED | Recherche/points canoniques seuls → recherche locale et repère TEXT, avec RAW, rejet conservateur et arbitrage des prix P1 |
| Suite après choix du Bar | IMPLEMENTED | Dock initial générique → Aller/Retour, Boissons, Date, Montant direct, Autre selon la carte |
| Google exact propriétaire réel | BLOCKED_OWNER_GOOGLE_IDENTITY | Type optionnel existant, mais aucune source d’identité durable attestée ; aucun champ fabriqué dans le reader |
| Admission de nouveau lieu Google | BLOCKED_OWNER_NEW_GOOGLE_PLACE | Aucun writer Canonical publié identifié ; aucun nouveau writer, schéma ou droit ajouté |
| Repli Google | IMPLEMENTED | Explication seule → « Retenir comme nom libre », label TEXT explicitement choisi, sans Google ID ni coordonnées persistées |
| Résilience recherche | IMPLEMENTED | Détails non vérifiés contre l’ID demandé, reprise fragile → identité exacte, réessai effectif de la même recherche, erreurs 429/HTML/détail invalide et annulations isolées |
| Conservation et finance | ALREADY_WORKING_REVALIDATED | Writers P1/P2, Compiler, Mobility et Finance V2 conservés ; choix du bar ne modifie jamais automatiquement les legs |

### DTO : liste exhaustive des ajouts

`PlannedPlaceOption.currentRelationships?: {personId, role}[]` : relations publiées du propriétaire, limitées aux personnes du contexte et actives aujourd’hui UTC (`valid_from <= jour`, `valid_to` absent ou strictement supérieur au jour, comme le contrat Global).

`PlannedPlaceKnowledge` / `mobilityOptions.placeKnowledge?` : `source=RECORDED_PERSON_DAYS`, `fromDate`, `throughDate`, `coverage=AVAILABLE_RECORDS`, `placeLimit=500`, `placesTruncated` prudent lorsque 500 lignes ont été rendues.

`mobilityOptions.vehicleIsUnique?` : exactement une ligne active rendue par la lecture propriétaire limitée à cinq véhicules. Le véhicule financier existant reste inchangé ; absence de preuve => pas de raccourci composite.

`visits12Months` et `lastVisitDate` existaient dans le type/reader. Ils sont désormais projetés dans le DTO Composer seulement pour les lieux publics lorsque la connaissance a été admise. `currentRelationships` est alors transmis pour contextualiser les points privés autorisés. **Aucune adresse privée, coordonnée ou Google ID n’est ajoutée au DTO.** L’adresse publique existante sert à désambiguïser.

Le raccord ajoute un GET borné `canonical_household_scope_control.limit(2)` par lecture d’options dans la requête serveur, avec le parseur Canonical existant. Le `optionsPromise` existant partage toujours cette lecture entre options, validation et pricing ; aucun `readWorld` supplémentaire, cache persistant, snapshot, GET par résultat ou SQL par frappe. Les autres appels `readPlannedContextOptions` gardent leur défaut sans connaissance Composer ; les relations/estimations financières existantes ne changent pas.

### Portée exacte de l’historique

Le reader existant parcourt intégralement `location_occurrences` par pages de 1000, filtrées par les `person_id` du contexte autorisé et les dates de `person_days`, de J-1 année calendaire à aujourd’hui UTC inclus. Un `Set` déduplique les dates par lieu, y compris plusieurs personnes le même jour. La dernière date est le maximum des dates documentées. Une date absente n’ajoute pas de jour. Les achats et montants ne servent pas à inférer une visite.

Cette mesure décrit les jours enregistrés dans les sources disponibles du foyer : aucune certification de présence physique exhaustive, aucune couverture de tous les jours, aucune fréquence future. Zéro signifie historique non établi. La fenêtre et cette limite sont affichées. Le catalogue propriétaire reste limité à 500 lieux ; la limite est signalée, sans pagination globale improvisée. Les relations Travail utilisent les identités et validités publiées, pas une proximité géographique ni un nom ressemblant.

### Parcours et invariants Mobility

- Aucun effet économique de l’ouverture du dock ou de son tri.
- Maison→bar CAR écrit en une mutation `EDIT_NIGHT_OUT` : un `MOBILITY_INTENT` dirigé, son ID explicite, les deux références canoniques, le véhicule annoncé et deux arrêts via le builder propriétaire `stopForPlace`. Pas de prix, distance, conducteur, participant ou devis inventé.
- Deux Maisons / plusieurs véhicules / bar TEXT / CAR non admissible : raccourci absent, choix normaux conservés.
- « Même mode au retour » reste P1 : nouvelle identité, endpoints inversés explicitement, prix/funding inconnus et indépendants ; pas de multiplication implicite par deux.
- Bar A→B ne réécrit pas l’Aller/Retour autonomes. Choisir un point dans l’éditeur du leg appelle encore `barEndpoint` et ses arbitrages de tarifs/quotes P1.
- Un endpoint TEXT conserve le choix et laisse itinéraire/coût à préciser. Les coûts viennent uniquement des résumés Mobility par ownerIntentId et du Compiler/V2.

## Tests exécutés

Windows / Node 22.18 ; dépendances locales existantes ; PGlite isolé et providers synthétiques. Aucun résultat de ce tableau n’est un E2E Supabase authentifié.

| Commande | Résultat exact |
|---|---|
| `node scripts/check-bar-apero-p3.mjs` | 12 groupes PASS : owner/DTO, React/dock, Google simulé, scope refusé, RAW, et Preview→Apply→Reload PGlite |
| `node scripts/check-bar-apero-p1.mjs` | 25 groupes PASS ; tarifs, routes indépendantes, RAW et réponses asynchrones |
| `node scripts/check-bar-apero-p2.mjs` | 20 groupes PASS ; tuiles, hauteur, continuation après RAW, Undo et autres presets |
| `node scripts/check-l4-e-bar-v8.mjs` | 16 groupes PASS |
| `node scripts/check-l4-d-bar-mobility.mjs` | 6 groupes PASS ; 2 legs, CAR/TAXI, panne fournisseur synthétique, C0 Apply/Reload et canaris |
| `node scripts/check-l4-a.mjs` | 19 contrôles PASS PGlite synthétique |
| `node scripts/check-l4-b-presets.mjs` | Conservation 47 presets PASS PGlite synthétique |
| `node scripts/check-planner-performance-parity.mjs` | 22 cas × 9 empreintes = 198/198 PASS, sans mise à jour des goldens ; rejoué sur le SHA produit committé |
| `node scripts/check-pre-l4-c2-c8-source.mjs` | C8-017 assertion originale PASS |
| `npx tsc --noEmit` | exit 0 |
| `git diff --check` | PASS ; seuls avertissements de normalisation CRLF |
| Build fixture esbuild production | PASS en environnement autorisé ; premier essai sandbox `spawn EPERM` conservé comme limite d’outillage, puis autorisation normale du même serveur local |
| `npm run build` Vercel Preview | EXECUTED_PASS_FULL_NEXT_PREVIEW, code 70b2fa5 ; READY, build complet et packaging terminés. Dépendances du cache Vercel réutilisées, pas une installation fraîche revendiquée |

Le premier passage P3 avait deux échecs conservés dans `first-test-failures.json` : représentation admise du montant `8` vs assertion `8.00` corrigée ; absence de nouvel appel au réessai Google révélant une vraie déduplication de session, corrigée en terminant la session en échec au clic Réessayer. Tous les 12 groupes finaux sont PASS. Les scénarios supplémentaires sont des groupes à plusieurs assertions, pas 22 E2E authentifiés.

## Matrice P3-01…22

| ID | Résultat et portée |
|---|---|
| 01 | PASS React + navigateur fixture, cinq choix initiaux, aucune décision induite |
| 02 | PASS owner simulé/React/navigateur : 3/1/0 jours, zéro non assimilé à jamais |
| 03 | PASS React/navigateur : deux homonymes avec IDs et adresses synthétiques distincts |
| 04 | PASS classification/React : privé exclu du dock des bars, Maison candidate seulement endpoint |
| 05 | PASS libellés sans historique ; limite 500 signalée ; pas de certification d’exhaustivité |
| 06 | BLOCKED_OWNER_GOOGLE_IDENTITY réel ; matching exact unique PASS simulé, conservation KNOWN PASS sur fixture/C0 ; pas de mapping réel revendiqué |
| 07 | PASS Google simulé : désambiguïsation explicite, aucun auto-premier |
| 08 | BLOCKED_OWNER_NEW_GOOGLE_PLACE ; repli label TEXT PASS simulé, aucune coordonnée/identité provider persistée |
| 09 | PASS annulation/générations React simulées, réponse ancienne et démontage ignorés ; pas de certification réseau fournisseur réel |
| 10 | PASS React 429/HTML/détail invalide/réessai ; navigateur erreur non-JSON de la fixture et options de repli visibles |
| 11 | PASS clic atomique React + navigateur, READ réel Compiler sur fixture ; relecture du Draft simulé ; aucune preuve fournisseur/auth réelle |
| 12 | PASS deux Maisons / véhicule non unique React ; scope autre foyer et AMBIGUOUS refusés par le reader simulé |
| 13 | PASS WORK_MEAL_ANCHOR privé non proposé comme Travail |
| 14 | PASS PRIMARY_WORK actuel, bonne identité, bornes de validité et rôle d’une autre personne exclus ; pas de participant induit |
| 15 | PASS régression Mobility PGlite : CAR aller / TAXI retour et coûts séparés |
| 16 | PASS P1/P3 + navigateur : nouveau Bar seul, anciens endpoints et prix indépendants conservés |
| 17 | PASS P1/P3 : identité Retour distincte et indépendante, réédition locale et C0 round-trip |
| 18 | PASS endpoint TEXT et panne du provider synthétique ; NOT_RUN_PROVIDER réel |
| 19 | PASS P1/P2/P3 + navigateur : Continuer conserve RAW 8, Enregistrer puis navigation garde la Bière |
| 20 | PASS contrat reader simulé : mauvais scope refusé avant toute lecture de lieux, relation étrangère non projetée ; métadonnées de droits réelles lues ; NOT_RUN_AUTH_P3 pour RLS/JWT réel |
| 21 | PASS mutation partielle / P1 et navigateur, champs non ciblés inchangés ; aucun Apply distant |
| 22 | PASS TEXT/Plus tard et parcours manuel sans nouvelle préférence durable ni suggestion imposée dans le parcours actif |

## Preuves navigateur et limites

Navigateur **intégré Codex**, uniquement `127.0.0.1:3220`, scénario `BAR_P3`, durable simulé et délai Preview 800 ms. Assets esbuild minifiés en mode production ; **pas** une preuve du rendu Next authentifié. Les largeurs effectives ont été lues après application : 1440×900, 1728×900 et 1920×1080. Pas de campagne mobile.

À 1728 px, la capture initiale a montré le texte d’historique débordant des tuiles génériques de hauteur fixe. Correction CSS scoped au dock Bar : hauteur intrinsèque et choix avec provenance élargis. Vérification DOM après correction : tuiles 81,6 px ; scrollHeight=clientHeight=80, aucun overflow de page. `places-1728.jpg` conserve le défaut ; `places-1728-fixed.jpg` sa correction. `final-places-1920.jpg`, `final-outbound-1920.jpg` et `final-raw-confirmation-1920.jpg` proviennent du code final compilé. `directed-routes-1440.jpg` prouve les deux intentions indépendantes, coût à estimer et Apply désactivé.

Un clic automatisé Retour a rencontré un nœud remplacé par le recalcul ; relire l’arbre puis cliquer de nouveau a réussi. Aucun contournement ni mutation supplémentaire n’a été faite pour cet incident d’outil. Les scénarios Google positifs/429/détails sont testés en React avec réponses simulées ; ne pas les annoncer PASS navigateur réel ni fournisseur réel. Le navigateur a vérifié la reprise d’erreur non-JSON fournie par le serveur de fixture, avec attribution et Nom libre disponibles.

La preuve `browser-saved-fixture.json` provient de la seule lecture loopback du Draft synthétique après les gestes UI : Bar homonyme B (ID fini par 99203), deux identités de legs distinctes, Bière 8 €, aucun Plan officiel. Après un vrai rechargement du navigateur, `browser-reload-proof.json` confirme même contexte, même version, même digest ; le serveur de fixture atteste zéro Plan, zéro révision, zéro RPC Apply et zéro écriture distante. Elle ne provient pas de Supabase.

## Réserves et décision

- `NOT_RUN_AUTH_P3` : aucune session/environnement d’écriture Supabase spécifiquement autorisé P3 ; ne pas reporter le canari Production P2.
- `NOT_RUN_PROVIDER` : pas de nouveau test Google/TomTom réel. Les requêtes de recherche navigateur restent sur la fixture locale ; les quotes routes des tests sont synthétiques.
- `BLOCKED_OWNER_GOOGLE_IDENTITY` et `BLOCKED_OWNER_NEW_GOOGLE_PLACE` restent des capacités propriétaires absentes : future mission ciblée d’identité/admission canonique (source durable, droits, dédoublonnage, idempotence et relecture), **non exécutée** ici.
- PRIMARY_WORK n’est pas bloqué au niveau du contrat : rôle attesté par Persona/Global, validités et personId raccordés ; sa réception authentifiée reste NOT_RUN_AUTH_P3.
- Pas de gain P14 réel, de P95 ou de nouveau cache revendiqué. Un GET de scope supplémentaire borné, pas de nouvelle architecture.
- P4 et la généralisation aux 46 autres presets restent hors lot ; aucun développement anticipé.
- Rollback : revert du commit produit de P3 avant intégration ; aucune donnée ni migration à annuler. Ne pas supprimer de Draft utilisateur.

Verdict final : `READY_FOR_HUMAN_REVIEW_WITH_LIMITS`. PR conservée Draft ; **aucune fusion ni Production**.

Le SHA documentaire final et la dernière Preview associée sont également reportés dans la PR #63 et dans le compte rendu de livraison, pour éviter une référence auto-dépendante au hash de ce fichier. Les captures `final-*` sont issues du SHA produit 70b2fa5 ; les deux premières séries 1440/1728 précèdent uniquement le complément de désambiguïsation des endpoints publics et une simplification de type, sans changement de leurs chemins testés.
