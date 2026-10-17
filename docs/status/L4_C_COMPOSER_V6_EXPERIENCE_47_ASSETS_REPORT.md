# L4-C — Composer V6 : expérience des 47 assets

17 octobre 2026. PR complémentaire #56, empilée sur #55, dépendante de #54. Aucun merge ni GO Production.

## Verdict

- **UX_V6_READY_FOR_REVIEW = PARTIAL** : code effectivement implémenté et publié pour revue ; réception visuelle V6 non exécutée.
- **FINANCIAL_PARITY_PASS = 198/198**, golden inchangé.
- **RAW_GUARD_PARTIAL** : tests des handlers React et du registre PASS ; vrais focus, Escape natif et géométrie navigateur NOT_RUN.
- **NOT_RUN_AUTH** : pas de compte isolé admissible utilisé. Aucune écriture sur le compte ou le Plan personnel.
- **PRODUCTION_NO_GO**. #54 et #55 non fusionnées.

Produit testé/buildé : **ecbc8f59f0cf60a9d2725a34ceb8da4f9204bdec**. Base documentaire #55 : be61864f22daf3b6546a9917758c10e0f35a4e34, base produit 11ac9d7 ; ascendance #54 eb8e671 conservée. Branche : codex/composer-v3-l4-c-v6-experience. Les ajouts documentaires et l’actualisation finale du test P05 n’ajoutent aucun changement produit au build référencé.

## Réalisation

### 0 — Confirmer sans perdre la saisie

Les appels window.confirm du périmètre Composer ont été remplacés par un petit dialogue HTML intégré. Le choix protecteur reçoit le focus par défaut ; Annuler/Escape n’exécute aucune continuation. Le registre existant garde l’unique autorité sur RAW/PENDING. Navigation, fermeture, Undo/Redo et conversion attendent le choix explicite ; une ancienne confirmation ne peut pas abandonner un nouveau buffer. La réponse est consommée une seule fois. Le Board reste visible, sans flou ; le dialogue de risque suspend temporairement ses interactions.

Le dernier champ de saisie vivant est mémorisé pour restaurer le focus à l’annulation. **Ce comportement DOM est développé, pas certifié dans un navigateur.** Le test React invoque onCancel ; il ne prouve ni la touche Escape réelle, ni un lecteur d’écran, ni le focus natif.

La méthode synchrone confirmDiscard demeure pour les anciens tests de contrat ; aucun appel produit ne l’utilise pour contourner la nouvelle garde.

### 1 — Une surface de choix existante

ContextPalette et WorkshopDock présentent des tuiles horizontales, sélection, pictos existants, recherche et chevrons. Une question transitoire de présentation suffit pour les composants imbriqués ; elle ne devient ni Draft, ni scheduler, ni moteur. Le nom du poste et le financement sont sur demande. Le prix est immédiatement saisissable ; vider le prix conserve UNKNOWN, 0 reste une décision explicite. Le stepper et la quantité tarifée n’introduisent aucun calcul financier React.

### 2 — Repas, sorties et activités

Restaurant, restauration rapide, livraison, activité et achat partagent les mêmes contrôles, en respectant les capacités de leur template. Une livraison n’offre pas de transport personnel ; Maison n’impose pas de personnes. Les compléments sont concrets et libres, via l’option extra déjà publiée ; ce ne sont pas des SKU ni un catalogue métier fictif. Le catalogue d’équipements réellement admissibles reste accessible dans Autres postes admissibles.

La Soirée utilise les catalogues existants bar/club/house_party, l’ajout répété, la bouteille partagée et les sens de transport. La saisie du prix précède désormais les précisions de quantité lorsque la quantité par défaut suffit. Les choix date/lieu/personnes et before vivent dans le dock. Les itinéraires avancés gardent leur éditeur existant.

### 3 — Visites et séjours

Les destinations et proches connus sont des tuiles recherchables ; une saisie libre n’apparaît qu’après ce choix. ContactPlaceReference continue à demander l’adoption d’un lien domicile exact ; aucun domicile n’est choisi automatiquement. friend-visit conserve son writer et ses champs propres, sans conversion en family-visit.

Le séjour propose prix total ou tarif par nuit, puis une saisie courte ; sans dates, prix et nombre de nuits restent groupés. Aucun nombre de nuits n’est inventé. La contradiction dates/durée est refusée par la validation existante. Les autres postes restent accessibles via retour et édition directe, en conservant les enfants et leurs liens.

### 4 — Cadeau, Beauté, Maison et réédition

Cadeau : recherche dans le catalogue propriétaire, classification indépendante du nom libre, occasion et destinataire par tuiles. Beauté : Prix direct ouvre le composant existant ; pas de faux rachat habituel ou de SKU supposé. Les repères CardKnowledge et leur politique OFFER_PREFILL sont conservés ; le clic prépare uniquement RAW, jamais une admission.

Le nouvel adaptateur de présentation réutilise DROP pour un ajout. Pour rééditer une sélection existante, il utilise le PATCH_CONTEXT déjà publié avec les autres sélections du Semantic Draft intactes. Le test à sept produits vérifie les six autres objets au champ près. Aucun service, contrat financier, SQL, migration, SNAP-3 ou dépendance produit n’a été modifié.

## Arbres de navigation implémentés

- S1/S2 : résumé → consommations / entrée / before / repas → objet admissible → prix (quantité sur demande) → conserver → ajouter encore ou résumé ; transport par sens, facultatif.
- A1/A2/R1/R2/R3/P1/P2/M1 : résumé → coût direct → prix → conserver ; ou détail → poste/quantité → prix → conserver → complément. Total et détail n’ajoutent pas un parent supplémentaire.
- V1 : résumé → proche / destination / date / déplacement → choix exact ou libre → conserver ; friend-visit suit ses champs publiés séparément.
- W1 : résumé → hébergement → total ou par nuit → prix (nuits groupées si nécessaire) → conserver ; enfants et autres postes indépendants.
- P3 : résumé → n’importe lequel de objet / occasion / destinataire / prix → choix dans le dock + éventuelle saisie → conserver ; aucune progression obligatoire.
- B1 : résumé → prix direct / équipement admissible → prix ou UNKNOWN → conserver ; sélection persistée → édition de ce seul composant.

Les détails de trajet et certains champs avancés restent dans leurs contrôles existants ; le changement ne promet pas leur remplacement intégral par des tuiles.

## Observations corrigées et régressions

1. Après admission du premier poste détaillé 45, l’éditeur revenait au total : corrigé par conservation locale du mode associé à la signature canonique admise. Ce mode ne change aucun montant. Le parcours 45 puis 15 passe ; les transitions restent réversibles.
2. Le chemin DROP rééditant un poste recopiait les currentItems projetés et ajoutait binding AUTO à un autre poste UNKNOWN. La nouvelle réédition conserve les six autres sélections exactement, via le PATCH existant. Le diff initial est conservé dans les preuves.
3. P12 SSR omettait model/choose, props déjà publiées par L4-B : fixture actualisée, assertions intactes, relecture/Apply PGlite PASS.
4. P05 attendait les anciens libellés B2 et une erreur Apply directe antérieure à P13. Le lecteur et le serveur sont identiques à ceux de la base be61864. Les assertions suivent maintenant les libellés actuels ; le refus effectif du validateur, l’absence du reçu de demande et le nombre de révisions inchangé sont contrôlés. Aucune erreur de commit n’est renommée en échec certain.

[Observations et corrections](evidence/l4-c-v6/resolved-observations.json), [identité des sources préexistantes P05](evidence/l4-c-v6/preexisting-p05-contract-proof.json). Les journaux initiaux complets P05/P12 restent également dans outputs/l4c/regressions hors commit ; leurs erreurs sont consignées ici sans republier des pages HTML de fixture inutiles.

## Résultats par scénario

Chaque ligne a une preuve contractuelle C0/PGlite et une amélioration de code. Cela ne signifie pas qu’un utilisateur a parcouru chaque branche dans un navigateur V6.

| Scénario | Code livré | Preuve exécutée | Limite |
|---|---|---|---|
| S1 · Soirée extérieure | Dock consommations, coût d’entrée, bouteille partagée, before ; prix direct, quantité sur demande, ajout répété et réédition. | Cocktails/partagé/UNKNOWN et legs C0 ; bouteille partagée React. | PARTIAL UX navigateur |
| S2 · Soirée privée | Chez nous sans trajet personnel dans le dock initial ; chez amis avec Apporter ; personnes/lieux facultatifs. | Domicile C0 ; absence de Transport vérifiée à l’ouverture React. | PARTIAL UX navigateur |
| A1 · Activité/prestation | Coût direct ou tarif et quantité explicite ; personnes tarifées à la demande. | Spa 150/20×2 C0 ; quantité PERSON React. | PARTIAL UX navigateur |
| A2 · Sortie libre | Destination ou coût sans billet obligatoire ; parking/compléments accessibles, inconnues préservées. | UNKNOWN + parking 4 C0 ; résumé et coût direct React. | PARTIAL UX navigateur |
| R1 · Restaurant | Addition immédiate ; total/détail confirmés ; desserts/boissons dans le dock. | 60→45+15, annuler/abandon, rejet/reprise React ; Apply/READ C0. | PARTIAL UX navigateur |
| R2 · Repas rapide | Montant 15 sans participants/date ; détail et compléments volontaires. | Prix direct React ; 12+3 et champs C0. | PARTIAL UX navigateur |
| R3 · Livraison | Commande complète, frais explicitement hors total ; aucun trajet personnel. | 35 inclus/annuler puis +5 explicite React ; 30+5 C0. | PARTIAL UX navigateur |
| V1 · Visites famille et amis | Tuiles proches/destinations pour Famille, champs publiés pour friend-visit ; mode dans le dock, route experte conservée. | Deux writers distincts, repère temporel React ; changement voiture/train et hospitality C0. | PARTIAL UX navigateur |
| W1 · Séjour | TOTAL/PER_NIGHT et types dans le dock ; prix/nuits groupés ; enfants conservés. | TOTAL 240 React ; 90×2, contradiction dates et enfant 12 C0. | PARTIAL UX navigateur |
| P1 · Achat simple | Coût direct, articles/quantité, frais réels ; référence d’enveloppe conservée. | Prix direct et quantité via primitives ; couverture 40/100 C0. | PARTIAL UX navigateur |
| P2 · Vendeur/commande | Coût direct sans catégorie déduite du vendeur ; article/vendeur sur demande. | Prix direct React ; contrat Amazon et prix isolé C0. | PARTIAL UX navigateur |
| P3 · Cadeau | Catalogue cadeau recherchable par tuiles ; destinataire/occasion/objet indépendants ; prix direct. | Objet+occasion, erreur -1, prix seul et IDs React ; classification et 20+5 C0. | PARTIAL UX navigateur |
| B1 · Beauté | Prix direct depuis le résumé ; composant court, ajout et réédition ; repères propriétaires conservés. | Sept produits dont UNKNOWN, réédition d’un seul via vrai service ; 10 presets C0. | PARTIAL UX navigateur |
| M1 · Maison | Coût direct ou quantité, sans participants imposés ni stock supposé. | Deux packs 6→7, quantité et IDs React ; 8 presets C0. | PARTIAL UX navigateur |

## Comparaison d’effort avant / après

Les handlers des vrais composants React ont été exécutés sur la base be61864 et sur le candidat, avec les mêmes intentions synthétiques. Une action est un clic de contrôle, un changement de sélection ou une saisie complète ; ce n’est pas le nombre de touches physiques. Le renderer de test ne simule pas le déroulement d’un select natif, le layout ou les peintures. Les lignes ci-dessous mesurent uniquement résumé → montant → admission et sa réédition, hors Library.

| Scénarios comparables | AVANT simple | APRÈS simple | Gain | Réédition AVANT/APRÈS |
|---|---:|---:|---:|---:|
| A1, A2, R1, R2, R3, P1, P2, M1 (8 parcours séparés) | 4 | 3 | 1 action de sélection du mode de prix supprimée | 3 / 3 |

Le prix est immédiatement visible en V6 ; le select de mode de prix disparaît. Le DOM passe de deux selects à un : le financement expert demeure dans details. Cela ne signifie pas que ce select était visible à l’écran. Entrées de résumé : aucun prix admis automatiquement.

S1/S2, V1/W1, P3 et B1 : comparaison d’effort complète NOT_MEASURED. Les chemins riches à deux composants et la distance de scroll des 14 familles restent NOT_MEASURED ; les tests de comportement exécutés ne sont pas maquillés en mesures d’effort. Les confirmations utiles ajoutent une décision explicite aux chemins destructeurs ; aucune promesse de gain universel de clics n’est faite. Aucun P50/P95 ni gain de latence navigateur n’est revendiqué.

[Avant](evidence/l4-c-v6/effort-before.json), [après](evidence/l4-c-v6/effort-after.json), script measure-l4-c-price-effort.mjs. Le témoin utilise les sources Git exactes des composants de be61864, sans checkout ni fusion des fichiers produit.

## Gates réellement exécutés

| Gate | Résultat |
|---|---|
| React : handlers et transitions | PASS, 16 groupes, y compris les 47 résumés ; renderer en processus, aucune fenêtre navigateur |
| RAW différé | PASS contractuel : annulation, acceptation unique, cible distincte, réponse devenue obsolète |
| Restaurant 60/RAW61 | PASS React : annuler, onCancel, abandon et digest inchangé ; focus réel NOT_RUN |
| 60 → détail45+15 / frais inclus | PASS React ciblé ; arithmétique officielle et transitions C0 PASS |
| Sauvegarde et Apply/READ/réédition | PASS PGlite : 15 groupes / 14 scénarios ; pas de JWT |
| 47 presets + 13 intentions génériques | PASS contrats C0/PGlite ; 47 résumés React rendus |
| 7 produits | PASS React + vrai service synthétique : prix seul, six autres objets identiques |
| Suggestions | PASS React : apparition/changement ne décide rien, clic préremplit, admission séparée ; refus visuel d’un domicile NOT_RUN |
| Parité Finance V2 | PASS 22×9=198, golden inchangé |
| P03/C1, scheduler ordre des réponses, Draft HTTP | PASS ; reprise HTTP testée dans son script existant, pas navigateur Supabase |
| L4-A/L1, P05/P05-B, P10/P11/P12/P13, CardKnowledge/P06 | PASS ; premiers échecs de harness conservés, corrections explicitées |
| C8-017 | PASS assertion originale ; aucun ajout de media query de largeur |
| TypeScript | PASS --noEmit --incremental false |
| Build Next complet produit | PASS Preview READY, npm run build, TS, génération routes et déploiement des sorties |
| Navigateur desktop 1440/1728/1920, clavier, vrai focus, captures, scroll et collision | NOT_RUN_DISABLED_IN_WORK_SETTINGS |
| Supabase : fermeture/nouvelle session authentifiée | NOT_RUN_AUTH |
| Mobile | NOT_RUN_MOBILE ; application desktop |

Build : dpl_GysUX9FcDJePWEpbhxHVvnSuNiCM, cible Preview (target=null), SHA exact ecbc8f59f0cf60a9d2725a34ceb8da4f9204bdec. Dépendances/cache Vercel réutilisés ; aucune prétention d’installation fraîche ou de certification CI générale. [Preview](https://budgetisation-ma3k725kt-adriensauvageot34-6137s-projects.vercel.app), [journal](evidence/l4-c-v6/vercel-product-build.log).

Le skill React Best Practices a servi à vérifier hooks stables, clés de composants, continuations, accessibilité du dialogue et absence de calcul financier local. Le rendu de test emploie react-test-renderer 19.2.6, installé hors dépendances produit dans outputs/l4c-test-tools. Le package signale sa dépréciation ; ce test ne remplace pas le navigateur. Les portails et références DOM y sont simulés, ce qui est déclaré et interdit toute certification de focus ou de géométrie.

## Capacité / disponibilité

| Amélioration | Statut | Limite réelle |
|---|---|---|
| Tuiles / dock / saisie courte | AVAILABLE code, PARTIAL réception | Aucun contrôle visuel desktop V6 exécuté |
| Choix contextuels 47 presets | AVAILABLE, PARTIAL variantes | Catalogue publié conservé, pas 112 parcours complets |
| Recherche objet/personne/lieu | AVAILABLE code | Interactions navigateur NOT_RUN |
| RAW/confirmation intégrée | PARTIAL | Focus/clavier natifs non certifiés |
| Identité exacte habituelle/SKU/Renewal | BLOCKED_CAPABILITY si preuve propriétaire absente | Aucun bouton trompeur ajouté |
| Swile/Edenred, intermois, matériel enfant non admissible | BLOCKED_CAPABILITY / hors périmètre conservé | Aucun fallback financier inventé |
| Enveloppes multi-domaines vendeur, hôte structuré non publié | BLOCKED_CAPABILITY | Pas de stockage détourné dans label |
| Itinéraires et financement experts | AVAILABLE existant | Quelques selects restent dans les détails ; pas une conversion intégrale de tous les champs |
| Gain perceptif / scroll / quatre à six tuiles effectives | NOT_RUN | Les contraintes CSS ne valent pas une mesure de viewport |

## Les huit classes V5 et les 112 situations

Tout connu, une donnée et UNKNOWN : contrats et exemples React exécutés. Suggestion acceptée : préremplissage seulement, adoption séparée testée. Suggestion refusée de contact/lieu : NOT_RUN en V6. Changement incompatible : régressions C0/P10/P11 ; UI réelle non exécutée. Ajout post-création et prix réédité : React ciblé + 14 scénarios C0. Aucune matrice ne transforme ces exemples en **112/112 PASS**. Le registre des 112 situations reste un cahier de conception partiellement couvert.

## Matrice des 47 presets

Chaque PASS C0 est la création + équipement admissible + conservation et Apply/READ du script existant ; il ne certifie pas toutes les variantes métier du preset. Les 47 résumés React ne sont pas 47 parcours complets.

| Preset | Scénario | Atelier | Persistance synthétique | UX |
|---|---|---|---|---|
| techno-night · Soirée techno | S1 | night-out-workshop | PASS C0/PGlite | Résumé React rendu ; navigateur NOT_RUN |
| uber-eats-order · Uber Eats | R3 | restaurant-editor | PASS C0/PGlite | Résumé React rendu ; navigateur NOT_RUN |
| fishing-day · Journée pêche | A2 | restaurant-editor | PASS C0/PGlite | Résumé React rendu ; navigateur NOT_RUN |
| fontes-family-visit · Visite Fontès | V1 | family-visit-editor | PASS C0/PGlite | Résumé React rendu ; navigateur NOT_RUN |
| clothing-shopping · Acheter des vêtements | P1 | restaurant-editor | PASS C0/PGlite | Résumé React rendu ; navigateur NOT_RUN |
| bar-apero · Bar / Apéro | S1 | night-out-workshop | PASS C0/PGlite | Résumé React rendu ; navigateur NOT_RUN |
| nightclub · Boîte de nuit | S1 | night-out-workshop | PASS C0/PGlite | Résumé React rendu ; navigateur NOT_RUN |
| friends-evening · Soirée chez des amis | S2 | night-out-workshop | PASS C0/PGlite | Résumé React rendu ; navigateur NOT_RUN |
| home-evening · Soirée chez nous | S2 | night-out-workshop | PASS C0/PGlite | Résumé React rendu ; navigateur NOT_RUN |
| chicken-snack · Snack / Chicken | R2 | restaurant-editor | PASS C0/PGlite | Résumé React rendu ; navigateur NOT_RUN |
| restaurant-for-two · Restaurant à deux | R1 | restaurant-editor | PASS C0/PGlite | Résumé React rendu ; navigateur NOT_RUN |
| hiking-nature · Randonnée / Nature | A2 | restaurant-editor | PASS C0/PGlite | Résumé React rendu ; navigateur NOT_RUN |
| beach-day · Journée plage | A2 | restaurant-editor | PASS C0/PGlite | Résumé React rendu ; navigateur NOT_RUN |
| cinema · Cinéma | A1 | restaurant-editor | PASS C0/PGlite | Résumé React rendu ; navigateur NOT_RUN |
| spa-relax · Spa / Détente | A1 | restaurant-editor | PASS C0/PGlite | Résumé React rendu ; navigateur NOT_RUN |
| servian-family-visit · Visite Servian | V1 | family-visit-editor | PASS C0/PGlite | Résumé React rendu ; navigateur NOT_RUN |
| visit-friends · Voir des amis | V1 | catalog-context-editor | PASS C0/PGlite | Résumé React rendu ; navigateur NOT_RUN |
| weekend-gite · Week-end / Gîte | W1 | short-stay-editor | PASS C0/PGlite | Résumé React rendu ; navigateur NOT_RUN |
| video-game-purchase · Acheter un jeu vidéo | P1 | restaurant-editor | PASS C0/PGlite | Résumé React rendu ; navigateur NOT_RUN |
| amazon-purchase · Amazon | P2 | restaurant-editor | PASS C0/PGlite | Résumé React rendu ; navigateur NOT_RUN |
| shein-purchase · Shein | P2 | restaurant-editor | PASS C0/PGlite | Résumé React rendu ; navigateur NOT_RUN |
| aliexpress-purchase · AliExpress | P2 | restaurant-editor | PASS C0/PGlite | Résumé React rendu ; navigateur NOT_RUN |
| mascara · Mascara | B1 | catalog-context-editor | PASS C0/PGlite | Résumé React rendu ; navigateur NOT_RUN |
| hair-wax · Cire coiffante | B1 | catalog-context-editor | PASS C0/PGlite | Résumé React rendu ; navigateur NOT_RUN |
| laundry-detergent · Lessive | M1 | restaurant-editor | PASS C0/PGlite | Résumé React rendu ; navigateur NOT_RUN |
| dishwashing-liquid · Liquide vaisselle | M1 | restaurant-editor | PASS C0/PGlite | Résumé React rendu ; navigateur NOT_RUN |
| concert · Concert | A1 | restaurant-editor | PASS C0/PGlite | Résumé React rendu ; navigateur NOT_RUN |
| ropes-course · Accrobranche | A1 | restaurant-editor | PASS C0/PGlite | Résumé React rendu ; navigateur NOT_RUN |
| museum-exhibition · Musée / Exposition | A1 | restaurant-editor | PASS C0/PGlite | Résumé React rendu ; navigateur NOT_RUN |
| gift-present · Cadeau | P3 | gift-editor | PASS C0/PGlite | Résumé React rendu ; navigateur NOT_RUN |
| shoes-purchase · Chaussures | P1 | restaurant-editor | PASS C0/PGlite | Résumé React rendu ; navigateur NOT_RUN |
| eyeliner · Eyeliner | B1 | catalog-context-editor | PASS C0/PGlite | Résumé React rendu ; navigateur NOT_RUN |
| eyebrow-pencil · Crayon à sourcils | B1 | catalog-context-editor | PASS C0/PGlite | Résumé React rendu ; navigateur NOT_RUN |
| facial-toner · Toner / Tonique | B1 | catalog-context-editor | PASS C0/PGlite | Résumé React rendu ; navigateur NOT_RUN |
| face-serum · Sérum visage | B1 | catalog-context-editor | PASS C0/PGlite | Résumé React rendu ; navigateur NOT_RUN |
| face-moisturizer · Crème hydratante | B1 | catalog-context-editor | PASS C0/PGlite | Résumé React rendu ; navigateur NOT_RUN |
| face-cleanser · Nettoyant visage | B1 | catalog-context-editor | PASS C0/PGlite | Résumé React rendu ; navigateur NOT_RUN |
| care-lotion · Lotion de soin | B1 | catalog-context-editor | PASS C0/PGlite | Résumé React rendu ; navigateur NOT_RUN |
| makeup-remover · Démaquillant | B1 | catalog-context-editor | PASS C0/PGlite | Résumé React rendu ; navigateur NOT_RUN |
| hotel-night · Nuit à l’hôtel | W1 | short-stay-editor | PASS C0/PGlite | Résumé React rendu ; navigateur NOT_RUN |
| stay-with-relatives · Séjour chez des proches | W1 | short-stay-editor | PASS C0/PGlite | Résumé React rendu ; navigateur NOT_RUN |
| dishwasher-tablets · Pastilles lave-vaisselle | M1 | restaurant-editor | PASS C0/PGlite | Résumé React rendu ; navigateur NOT_RUN |
| floor-cleaner · Nettoyant pour le sol | M1 | restaurant-editor | PASS C0/PGlite | Résumé React rendu ; navigateur NOT_RUN |
| sponges · Éponges | M1 | restaurant-editor | PASS C0/PGlite | Résumé React rendu ; navigateur NOT_RUN |
| trash-bags · Sacs-poubelle | M1 | restaurant-editor | PASS C0/PGlite | Résumé React rendu ; navigateur NOT_RUN |
| toilet-paper · Papier toilette | M1 | restaurant-editor | PASS C0/PGlite | Résumé React rendu ; navigateur NOT_RUN |
| paper-towels · Essuie-tout | M1 | restaurant-editor | PASS C0/PGlite | Résumé React rendu ; navigateur NOT_RUN |

Les 13 génériques restent exposés par le registre propriétaire et sont rejoués par P12 (114 options publiées, 10 domaines mensuels) ; pas de registre concurrent.

## Gate navigateur restant — procédure ciblée prête

L’appel officiel de reprise navigateur a répondu : « Local browser use is disabled in Work settings ». Aucun autre navigateur, driver, API CDP ou contournement n’a été utilisé. Les tests React en processus sont des tests unitaires ; aucune capture ou action navigateur réelle n’est revendiquée.

La fixture locale est préparée sur http://127.0.0.1:3204/?scenario=L4_C_V6_REVIEW&durable=1&delayRead=1000 ; bundle candidat recompilé, aucune connexion distante. Lorsque l’accès navigateur est rétabli :

1. Restaurant60 admis ; RAW61 ; Retour/fermer → Continuer à modifier puis Escape réel : 61 et focus doivent rester ; digest admis60 inchangé. Abandon : retour60 ; confirmer61 : une seule sélection.
2. Total60 → détail annuler/accepter, 45+15 ; détail→total confirmer le retrait une fois ; Undo restaure les deux postes.
3. Livraison35 inclus : annuler frais ; détail30+5 ; supplément5 explicitement accepté seulement s’il est en plus.
4. Réédition directe, erreur/reprise, nouveau prix et Reload dans chaque famille ; sept produits, longs noms et UNKNOWN.
5. Mesurer les vrais viewports1440×900,1728×900,1920×1080, focusTab/Enter/Escape, dock/scroll interne/panneau, débordements et images complètes. Compléter les comparaisons d’effort des 14 familles et les parcours riches.

Ce protocole ne demande aucune écriture personnelle ni de commande manuelle à l’utilisateur. Il peut être exécuté par l’agent dès que l’outil officiel est disponible. Aucune nouvelle campagne financière globale n’est nécessaire pour fermer cette réserve UI.

## Intégration et rollback

La PR #56 reste en Draft pour matérialiser les réserves de réception ; aucune fusion de #54/#55/#56 et aucune promotion Production. Retour arrière : revert du commit produit ecbc8f59f0cf60a9d2725a34ceb8da4f9204bdec, sans SQL, sans suppression de Draft ou de Plan. Les commits de preuves/tests n’ajoutent pas de migration.

La prochaine étape minimale est la réception navigateur ciblée et la comparaison d’effort manquante, puis votre revue. Aucune fonctionnalité suivante ni nouvelle architecture n’a été commencée.

## Reproduction technique des preuves en processus

Prérequis isolé de test, sans modifier package.json : npm.cmd install --prefix outputs/l4c-test-tools --no-save --ignore-scripts --package-lock=false react-test-renderer@19.2.6. Puis node scripts/check-l4-c-v6-interactions.mjs. Les outils et fichiers sont déjà préparés sur cette machine ; aucune exécution manuelle demandée à l’utilisateur.

La comparaison utilise L4C_EFFORT_BASELINE=1 pour node scripts/measure-l4-c-price-effort.mjs, puis la même commande sans ce drapeau. Ces valeurs ne constituent aucun drapeau produit. Les tests C0 utilisent exclusivement PGlite synthétique ; aucun Supabase local ni distant n’est utilisé.
