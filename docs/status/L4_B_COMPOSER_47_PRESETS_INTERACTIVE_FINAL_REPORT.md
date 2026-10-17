# L4-B — Ateliers interactifs sur les 47 presets

Date : 17 octobre 2026. Verdict : **READY_FOR_REVIEW_LIMITED_FIXTURE / V5 PARTIAL**.

La PR [#55](https://github.com/adriensauvageot34/Budgetisation/pull/55) généralise réellement le résumé immédiat, le panneau non modal, les choix ciblés et le dock R6. Aucun nouveau moteur de coût, writer financier, schéma, migration ou changement SNAP-3. Aucune fusion ni promotion Production.

## Références et portée

- BASE_SOURCE_BRANCH = codex/composer-v3-l4-a1-night-workshop
- BASE_SHA = eb8e671c46334e2a5931cb04e1699d0a769a8a5d
- NIGHT_A1_PR_54_DEPENDENCY = OPEN, non fusionnée lors de la vérification ; conserver cette base empilée.
- Branche = codex/composer-v3-l4-b-all-assets-interactive
- Implémentation initiale = f83c6dc81c31d325a64f09e56887d8bec289edd4
- Correction calendrier/dock = dd7d8d77902f657f2b8b36739a4416c663b3b3fb
- Compacité et références = f8964df1ec0b950a3326f347acc73743f60d79fa
- PRODUCT_TESTED_SHA = b7c3127d3db1f808108ab5422631523359939af1
- PR_URL = https://github.com/adriensauvageot34/Budgetisation/pull/55
- Référentiel : prompt V5 et master chapitres 13–17 fournis ; master « (1) » SHA-256 EE07C38E442AED120B0493C8BDEF335506EFEECF969C9E189CA2B5BE3274B5A0.

## Produit livré

- Soirée démarre sur son résumé ; entrées, boissons, before, repas et transports restent ceux de L4-A.1. Les variantes domicile ne proposent aucun trajet automatiquement.
- Restaurant, Snack, Livraison, Activité et Achat ouvrent directement leur résumé. Total, détail, quantité, prix et financement se configurent sans questionnaire initial. Les extras sont paginés ; l’ajout propose « Ajouter encore ».
- Visite et Séjour utilisent un panneau latéral et le dock commun. Départ/retour/repère, trajet/origine/véhicule/arrêts et coûts sont découpés. Un seul arrêt est édité à la fois. Changer le mode retire les coûts dépendants du précédent ; les autres décisions sont conservées.
- Les lieux liés à un contact sont proposés via le classement propriétaire de préparation de dépense, puis choisis explicitement. Les refus restent dans la session Composer. Aucun rapprochement déduit d’un nom ou d’une visite historique.
- Cadeau autorise destinataire, occasion, objet, prix et date indépendants. Un prix sans destinataire et sans objet nommé conserve une intention « Cadeau », sans fabriquer un objet ni une date. Le builder de quantité existant conserve PERSON/ITEM/SHARED et les anciennes preuves.
- Beauté, amis et autres intentions génériques présentent une précision à la fois, puis leurs vrais composants compatibles dans le dock. Les postes sont paginés et directement rééditables, y compris un deuxième produit.
- Les buffers sont remplacés lors d’une décision admise, d’Undo/Redo ou d’un changement d’enfant ; leur clé est canonique. Une Preview financière identique conserve la saisie RAW. Les formulaires de composants gardent toutes les pages dans leur buffer ; un rejet ne ferme pas le formulaire.
- Une incohérence dates/nuitées est signalée par une validation calendaire de l’atelier avant admission. Aucun tarif n’est recalculé par React. Les contrôles de prix et de dates du serveur restent actifs.

## Statuts des gates

| Gate | Résultat exécuté et limite |
|---|---|
| COVERAGE_MAIN_PRESETS | 47/47 : création + ajout d’un composant + prix seul + sérialisation + Apply/Reload PGlite. 47/47 ouvertures React et reprise HTTP collective. |
| COVERAGE_SECONDARY_GENERIC | 13/13 et 114 options : P12 PASS synthétique ; la présentation SSR attend maintenant le résumé, pas tous les champs ouverts. « À piloter » inchangé. |
| DIRECT_ENTRY_SUMMARY / CONTEXTUAL_DOCK | PASS sur fixture ; un dock commun, Board visible, aucun ordre Date → Personnes imposé. |
| REPEAT_ADD | PASS navigateur sur sept produits et par contrats Soirée ; réédition du deuxième prix conserve les six autres et les IDs. |
| EDIT_ONE_FIELD / SAVE_RELOAD | PASS 47 contrats ; navigateur profond Cadeau, Visite, Séjour, Beauté. Pas 47 cycles UI profonds individuels. |
| UNDO_REDO | PASS navigateur Cadeau/Visite et régressions P03, P05-B, P10, P11 ; clavier Escape sans mutation vérifié. |
| UNKNOWN_PARTIAL / PERSON_ITEM_SHARED | PASS oracles et régressions ; UNKNOWN reste distinct de zéro explicite. |
| TOTAL_VS_DETAILS | PASS 60 → 45+15 et 35 → 30+5 ; TOTAL hébergement 240 reste 240 avec deux nuits, PER_NIGHT 90×2 = 180. |
| MOBILITY_OWNERSHIP | PASS P10/P11 synthétiques, rôles et mode de remplacement préservés. Fournisseurs réels NOT_RUN. |
| FINANCE_V2_PARITY | PASS ciblé : mêmes owners, remplacement non additif, couvert/extra, UNKNOWN, provenance, Apply/CAS. Golden 198 non rejoué : aucun contrat financier modifié. |
| DESKTOP_1440 | PASS sur 47 résumés + vues détaillées/erreurs ciblées à 1440×900. |
| DESKTOP_1728 | PASS sur 15 représentants des 14 parcours et détails ciblés à 1728×900. |
| DESKTOP_1920 | PASS mêmes représentants et détails ciblés à 1920×1080. |
| TYPECHECK | PASS local, source TypeScript finale ; dernières modifications exclusivement CSS. |
| NEXT_BUILD | EXECUTED_PASS_FULL_NEXT_VERCEL_PREVIEW sur b7c3127 ; local bloqué/échoué, journaux conservés. |
| JWT_AUTH_CYCLE / APPLY_AUTHENTICATED | NOT_RUN_AUTH / NOT_RUN. Aucun compte personnel utilisé pour fabriquer un test. |
| NATIVE_INTERACTIONS | PARTIAL : saisie calendaire au clavier et Escape exercés ; drag natif, focus exhaustif et confirmations total/détail non entièrement certifiés. |
| PRODUCTION_MERGED / PRODUCTION_DEPLOYED | NO / NO. |

## Scénarios V5 et limites de capacité

Tous les scénarios ont un parcours minimal réel dans les capacités actuelles. Leur statut V5 global reste PARTIAL : les 112 cas de conception ne sont pas 112 tests exécutés.

| Scénario | Statut | Preuve / réserve |
|---|---|---|
| S1 | PARTIAL | Cocktails 2×8=16, SHARED 25, prix seul 8→9 ; 19 contrôles Soirée. Boucle et transport propriétaires conservés. |
| S2 | PARTIAL | Résumé et variantes domicile/amis opérationnels ; hôte structuré non publié, aucun faux champ. |
| A1 | PARTIAL | Spa TOTAL 150 et PERSON 20×2=40 ; huit presets A1/A2 inventoriés. Tous les cas contradictoires non automatisés. |
| A2 | PARTIAL | Parking 4 avec coût principal UNKNOWN ; matériel sous forme de child Achat non admis, intention Achat indépendante disponible dans la Library. |
| R1 | PARTIAL | 15 groupes Restaurant couvrant 25 IDs, total/détail et provenance ; E2E authentifié isolé absent. |
| R2 | PARTIAL | Montant 15 sans canal ; canal fast-food BLOCKED_CAPABILITY, aucun bouton prétendant le sauvegarder. |
| R3 | PARTIAL | Global 35 frais compris ou détail 30+5 ; ajout hors total exige confirmation. Aucun trajet personnel de livraison. Pas de champ informatif « frais inclus » fictif. |
| V1 | PARTIAL | 19 contrôles Visite ; calendrier et Undo/Redo navigateur. Contact et lieu restent des choix distincts. Admission contact/lieu réels non testée sur Supabase. |
| W1 | PARTIAL | 21 contrôles Séjour ; TOTAL/PER_NIGHT, enfants non additifs, calendrier 3 vs 2 rejeté dans le navigateur, prix 240 conservé après reprise. Intermois exclu. |
| P1 | PARTIAL | Enveloppe 100 / achat couvert 40 : incrément 0, reste 60 ; absence de 140. |
| P2 | PARTIAL | Amazon mixte 70 sans classification automatique ; panier ventilé multi-domaines BLOCKED_CAPABILITY. |
| P3 | PARTIAL | 20+5=25, destinataire/occasion indépendants, classification et libellé conservés ; scénario riche sauvegardé en HTTP local. |
| B1 | PARTIAL | Saisie manuelle, sept produits et deuxième prix réédité. Picker d’identité exacte Renewal non exposé : BLOCKED_CAPABILITY ; aucun SKU, stock ou prix inventé. Liens existants conservés, UUID de liaison non proposé à la saisie. |
| M1 | PARTIAL | Deux paquets 6→7 donnent 12→14 ; pas de stock ni référence de conditionnement déduits du preset. |

Swile/Edenred non certifiés, hôtes structurés, caps et stocks restent hors des choix sauvegardables. Une lacune de capacité ne bloque pas le parcours manuel admissible.

## Preuves et corrections observées

L’hôte local exécute React de production minifié et les vrais composants chargés à la demande, avec Compiler/V2 et PostgreSQL PGlite synthétiques. Sa persistance HTTP est une fixture en mémoire de processus : elle prouve le cycle navigateur/rechargement, pas une durabilité Supabase multi-session. Les tests d’Apply utilisent séparément les véritables contrats SQL C0 dans PGlite.

- 47 résumés sur f83c6dc : aucun dépassement du panneau ni horizontal de page ; reprise collective avec digest identique : 33ac7d92fa9259639f6e19d2a285d880a42e3695615b3ad1182eaf671a402c6e.
- 15 représentants à 1728×900 et 1920×1080. Aucun résultat mobile revendiqué, conformément à la priorité desktop.
- Les essais détaillés ont révélé le chevauchement Dates/dock, puis le défilement des coûts, des repères en erreur et des postes du Séjour. Ils ont été corrigés et les parcours concernés rejoués.
- Sur b7c3127, les vues Prix Séjour, Erreur Produit et Erreur Cadeau ont respectivement des panneaux 577 / 511 / 575 px et des conteneurs internes 421 / 226 / 322 px, scrollHeight identique au clientHeight aux trois résolutions. Le bas du panneau reste au-dessus du dock. Aucun masquage de contenu par overflow:hidden ajouté.
- Sauvegarde réseau : 503 avant commit, carte conservée, état ERROR, Apply désactivé ; retry explicite puis SAVED. Les versions enregistrées sont uniques. Un prix serveur rejeté reste dans son champ, puis peut être corrigé.
- Sept produits : toutes les identités conservées ; seul « Produit 2 choisi » passe de 5 à 15. Aucun Plan ni owner financier écrit dans ces essais navigateur.
- La saisie ISO de date seule par l’outil n’a pas commis l’événement natif ; les touches natives ont ensuite permis d’exercer réellement le conflit et sa correction. Ce point n’a pas été transformé en défaut produit.

Les captures plein viewport ont été affichées dans la session navigateur. Les données DOM et HTTP sont archivées ; aucun fichier image simulé n’est présenté comme capture.

## Tests exécutés

| Commande | Résultat |
|---|---|
| node scripts/check-l4-b-presets.mjs | PASS 47 : C0 Apply et Reload synthétiques, IDs et prix conservés. |
| node scripts/check-l4-b-oracles.mjs | PASS 12 oracles économiques et calendaires ciblés. |
| node scripts/check-l4-a.mjs | PASS 19 contrôles. |
| node scripts/check-l1-restaurant.mjs | PASS 15 groupes / 25 IDs. |
| node scripts/check-phase2-planner-p05b.mjs | PASS 9 contrôles. |
| node scripts/check-phase2-planner-p10.mjs | PASS 19 groupes. |
| node scripts/check-phase2-planner-p11.mjs | PASS 21 groupes. |
| node scripts/check-phase2-planner-p12.mjs | PASS 13 intentions, 114 options, round-trip et non-écriture. |
| node scripts/check-composer-p03-interaction.mjs | PASS 12, dont réponses hors ordre, Undo pendant Preview et suppression. |
| node scripts/check-phase2-planner-p13.mjs | PASS 8, CAS/idempotence/relecture après commit. |
| node scripts/check-composer-post-snap3-draft-http.mjs | PASS service simulé local, 5 invariants HTTP. |
| node scripts/check-pre-l4-c2-c8-source.mjs | PASS C8-017 original, non neutralisé. |
| node node_modules/typescript/bin/tsc --noEmit --incremental false | PASS. |

P10 ne change que la casse de l’assertion « Date non fixée », déjà présente dans le code de base eb8e671. P12 remplace l’attente SSR de tous les champs affichés simultanément par celle du résumé ; ses assertions de conservation structurée restent intactes. Aucun golden financier modifié.

## Build et environnement

Le build local Turbopack échoue avant compilation : node_modules est un lien hors racine. Un essai Webpack complet échoue sur node:crypto via exploration-runtime-host, chemin extérieur au diff. Ces échecs sont conservés, sans fausse réussite locale ni modification des fondations pour les masquer.

Le build Next complet de f83c6dc en Preview est READY (Next 16.2.6, compilation, TypeScript, génération 8/8, sorties déployées). La [Preview finale b7c3127](https://budgetisation-gzd5vqw1o-adriensauvageot34-6137s-projects.vercel.app) est READY : dpl_3XT4R6thYmouC79uq5rpnquTBeUd, target null (Preview), npm run build → next build complet. Voir evidence/l4-b-all-assets/vercel-final-build.log et vercel-final-deployment.json. Aucune modification de région/configuration globale. La requête API initiale target=preview a été refusée avant création (400) ; la requête corrigée, sans target, a créé uniquement cette Preview, conformément à la [documentation API officielle](https://vercel.com/docs/rest-api/deployments/create-a-new-deployment#body-target).

Reproduction contractuelle : commandes ci-dessus, dépendances du dépôt. Reproduction navigateur locale : scripts/serve-phase2-planner-composer-fixture.mjs, PORT=3202, PLANNER_L1_SPLIT=1, PLANNER_BROWSER_TOOLS pointant sur les outils esbuild existants, PLANNER_C8_GLOBAL_CSS pointant sur la feuille globale de référence L4-A.1. Cette feuille générée et les outils externes sont des prérequis locaux explicites ; le build Preview utilise les dépendances du projet.

## Fichiers et preuve de couverture

Les modifications produit sont limitées aux éditeurs Composer, au shell et à la feuille CSS ; trois petites présentations partagées : WorkshopComponentRow, WorkshopDock et ContactPlaceReference. Les writers, Compiler, Finance V2, Kernel, SNAP-3 et migrations sont inchangés.

Voir [couverture structurée](evidence/l4-b-all-assets/coverage-final.json), [oracles](evidence/l4-b-all-assets/economic-oracles.json), [mesures navigateur](evidence/l4-b-all-assets/browser-ui-proof.json), [reprise/retry](evidence/l4-b-all-assets/browser-final-http-check.json) et [sept produits](evidence/l4-b-all-assets/browser-seven-products-check.json). Les anciens journaux HTTP de préparation sont des preuves complémentaires ; ils ne remplacent pas les tests ciblés du SHA final.

| Preset | Template réel | V5 | Éditeur | Création/composant/prix/C0 | UI résumé | UI sauvegarde/reprise |
|---|---|---|---|---|---|---|
| techno-night | night-out | S1 | night-out-workshop | PASS | PASS | PASS collectif |
| uber-eats-order | delivery | R3 | restaurant-editor | PASS | PASS | PASS collectif |
| fishing-day | activity | A2 | restaurant-editor | PASS | PASS | PASS collectif |
| fontes-family-visit | family-visit | V1 | family-visit-editor | PASS | PASS | PASS collectif |
| clothing-shopping | purchase | P1 | restaurant-editor | PASS | PASS | PASS collectif |
| bar-apero | night-out | S1 | night-out-workshop | PASS | PASS | PASS collectif |
| nightclub | night-out | S1 | night-out-workshop | PASS | PASS | PASS collectif |
| friends-evening | night-out | S2 | night-out-workshop | PASS | PASS | PASS collectif |
| home-evening | night-out | S2 | night-out-workshop | PASS | PASS | PASS collectif |
| chicken-snack | fast-food | R2 | restaurant-editor | PASS | PASS | PASS collectif |
| restaurant-for-two | restaurant | R1 | restaurant-editor | PASS | PASS | PASS collectif |
| hiking-nature | activity | A2 | restaurant-editor | PASS | PASS | PASS collectif |
| beach-day | activity | A2 | restaurant-editor | PASS | PASS | PASS collectif |
| cinema | activity | A1 | restaurant-editor | PASS | PASS | PASS collectif |
| spa-relax | activity | A1 | restaurant-editor | PASS | PASS | PASS collectif |
| servian-family-visit | family-visit | V1 | family-visit-editor | PASS | PASS | PASS collectif |
| visit-friends | friend-visit | V1 | catalog-context-editor | PASS | PASS | PASS collectif |
| weekend-gite | short-stay | W1 | short-stay-editor | PASS | PASS | PASS collectif |
| video-game-purchase | purchase | P1 | restaurant-editor | PASS | PASS | PASS collectif |
| amazon-purchase | purchase | P2 | restaurant-editor | PASS | PASS | PASS collectif |
| shein-purchase | purchase | P2 | restaurant-editor | PASS | PASS | PASS collectif |
| aliexpress-purchase | purchase | P2 | restaurant-editor | PASS | PASS | PASS collectif |
| mascara | beauty-restock | B1 | catalog-context-editor | PASS | PASS | PASS collectif |
| hair-wax | beauty-restock | B1 | catalog-context-editor | PASS | PASS | PASS collectif |
| laundry-detergent | purchase | M1 | restaurant-editor | PASS | PASS | PASS collectif |
| dishwashing-liquid | purchase | M1 | restaurant-editor | PASS | PASS | PASS collectif |
| concert | activity | A1 | restaurant-editor | PASS | PASS | PASS collectif |
| ropes-course | activity | A1 | restaurant-editor | PASS | PASS | PASS collectif |
| museum-exhibition | activity | A1 | restaurant-editor | PASS | PASS | PASS collectif |
| gift-present | gift | P3 | gift-editor | PASS | PASS | PASS collectif |
| shoes-purchase | purchase | P1 | restaurant-editor | PASS | PASS | PASS collectif |
| eyeliner | beauty-restock | B1 | catalog-context-editor | PASS | PASS | PASS collectif |
| eyebrow-pencil | beauty-restock | B1 | catalog-context-editor | PASS | PASS | PASS collectif |
| facial-toner | beauty-restock | B1 | catalog-context-editor | PASS | PASS | PASS collectif |
| face-serum | beauty-restock | B1 | catalog-context-editor | PASS | PASS | PASS collectif |
| face-moisturizer | beauty-restock | B1 | catalog-context-editor | PASS | PASS | PASS collectif |
| face-cleanser | beauty-restock | B1 | catalog-context-editor | PASS | PASS | PASS collectif |
| care-lotion | beauty-restock | B1 | catalog-context-editor | PASS | PASS | PASS collectif |
| makeup-remover | beauty-restock | B1 | catalog-context-editor | PASS | PASS | PASS collectif |
| hotel-night | short-stay | W1 | short-stay-editor | PASS | PASS | PASS collectif |
| stay-with-relatives | short-stay | W1 | short-stay-editor | PASS | PASS | PASS collectif |
| dishwasher-tablets | purchase | M1 | restaurant-editor | PASS | PASS | PASS collectif |
| floor-cleaner | purchase | M1 | restaurant-editor | PASS | PASS | PASS collectif |
| sponges | purchase | M1 | restaurant-editor | PASS | PASS | PASS collectif |
| trash-bags | purchase | M1 | restaurant-editor | PASS | PASS | PASS collectif |
| toilet-paper | purchase | M1 | restaurant-editor | PASS | PASS | PASS collectif |
| paper-towels | purchase | M1 | restaurant-editor | PASS | PASS | PASS collectif |

## Revue, intégration et rollback

La PR #55 reste empilée sur #54. Le verdict autorise la revue de cette tranche utilisable avec ses limites ; il ne certifie ni tous les 112 cas V5, ni la Production. Aucun GO de fusion n’est déduit.

Rollback applicatif par revert des commits de cette PR, en sens inverse, en conservant la dépendance #54. Aucun rollback SQL, purge ou effacement des Drafts n’est nécessaire : les contrats et champs sont ceux déjà admis. Les Plans et les sources financières réelles n’ont pas été utilisés pour fabriquer des tests.

JWT_AUTH_CYCLE = NOT_RUN_AUTH ; APPLY_AUTHENTICATED = NOT_RUN ; PRODUCTION_MERGED = NO ; PRODUCTION_DEPLOYED = NO.
