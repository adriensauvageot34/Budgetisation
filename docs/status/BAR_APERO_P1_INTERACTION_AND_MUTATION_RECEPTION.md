# Bar / Apéro — P1 : réception des interactions et mutations

Date : 2026-10-17. Mission 1/4 uniquement. **READY_FOR_REVIEW_WITH_LIMITS**, PR Draft [#59](https://github.com/adriensauvageot34/Budgetisation/pull/59). Pas de certification visuelle, authentifiée ou Production.

## 1. Base, périmètre et traçabilité

Les deux documents utilisateur ont été lus intégralement : référentiel post-V8 (1 866 lignes, annexes A–H comprises) et prompt P1 (335 lignes). Le premier décrit la cible finale ; seul le second autorise les changements réalisés ici.

- Dépôt `adriensauvageot34/Budgetisation`, branche `codex/bar-apero-p1-interaction-safety`, créée depuis `origin/main` après fetch réussi.
- Base vérifiée : **`0c0bfea03f5d6e30298eb04120c77ec684e7abc0`**. GitHub confirme #54–58 fermées/fusionnées, #58 par ce merge. Les commits originaux restent ancêtres ; aucune réécriture.
- Départ local avant création de branche : `81db3a2`, ancienne branche V8. Il n'a pas été pris pour le main actuel. Seul `outputs/` préexistant était non suivi ; il est préservé et exclu de la PR.
- Premier code P1 : `111a3950273161d5f50e94db34b3ec4ff9647df9`.
- **Code produit final testé : `6e08d6858554b67d40ed10013d7445267be7e926`**. Les commits suivants de rapport/preuves ne changent pas ce code.
- Périmètre produit : carte exacte `bar-apero`, helpers existants et extension facultative de la garde RAW. Soirée générique, owners financiers, scheduler, protocole Draft, schémas et migrations inchangés.
- Aucun merge, Apply réel, écriture financière distante, session personnelle, migration ou promotion Production. Aucune réalisation P2/P3/P4.

## 2. Avant / après : faits et choix conservateurs

| Geste / risque | Avant réellement vérifié | Après / statut |
|---|---|---|
| Carte déjà ouverte : Lieu → Date → Personnes → Bière → Aller → Retour → Date | Test React PASS dès la baseline. La transition `move(target)` était présente ; les accolades compactes avaient suscité un faux soupçon statique. | **ALREADY_WORKING**. Ciblage direct conservé, sans écriture ni clone. Aucun faux FAIL navigateur. |
| Compact → composant par `slot + selectionId` | V8 possédait déjà ce ciblage. | **ALREADY_WORKING**, régression React et réouverture du même prix/ID PASS. |
| Nouveau lieu sans trajet | Déjà admissible par `EDIT_NIGHT_OUT`. | **ALREADY_WORKING** : `fields.placeRef` seul, zéro leg et zéro confirmation. |
| Changer Bar A → B avec trajets autonomes, identiques ou ressemblants | Baseline P1 rouge : le helper réécrivait systématiquement destination Aller et origine Retour. | **FIXED** : aucun slot mobilité envoyé. Les endpoints, prix, arrêts et relations demeurent strictement identiques, même si leurs IDs étaient égaux au lieu central. |
| Liaison durable entre lieu central et endpoint | Aucun contrat durable attestant cette liaison n'a été trouvé dans les types/écritures concernés. `ROOT_PLACE` est une origine de stop, pas une relation perpétuelle. | **BLOCKED_OWNER** pour la synchronisation automatique. Choix conservateur prévu par E2 : lieu central seul ; message indiquant que les itinéraires se modifient indépendamment. Aucun tag ou schéma improvisé. |
| Modification explicite d'un endpoint avec prix | Baseline rouge : le tarif pouvait disparaître sans arbitrage. | **FIXED** : prix touchés nommés dans la zone du trajet, état antérieur intact jusqu'au choix. Tarif manuel seul : le déclarer à nouveau ou UNKNOWN ; sinon UNKNOWN explicite / conserver l'itinéraire. |
| Stationnement lorsque seul le départ change | Effacé par l'invalidation générique. | **FIXED** : stationnement de la destination inchangée conservé ; un changement d'arrivée le requalifie explicitement. |
| Trajet externe / financement dont la portée n'est pas prouvée | Le chemin rapide de mode pouvait remplacer une relation par `OWNS_JOURNEY`. | **FIXED / PARTIAL** : chemin rapide refusé sans mutation ; message vers l'éditeur détaillé existant. Refus aussi en présence d'identifiants externes, même avec relation OWNS. Le prix/allocation/owner n'est pas effacé. Pas de nouvelle capacité de réparation externe. |
| Ancien A/R combiné | Certaines mutations rapides remplaçaient des points du trajet combiné. | **FIXED** : refus rapide conservateur, aucun découpage, aucun ID ou arrêt perdu ; consultation/édition détaillée existante. |
| Multi-arrêts dirigé | Possibilité de remise à zéro excessive. | **FIXED** : remplacement de la seule frontière explicitement choisie, chaîne conservée ; seules preuves de segment affecté retirées. Frontière contradictoire ou suppression qui perdrait les arrêts : refus. Changement de mode multi-arrêts : refus rapide conservateur. |
| Même mode au retour, puis origine Aller modifiée | Création explicite V8 déjà indépendante. | **ALREADY_WORKING**, non-synchronisation, nouvel ID et non-copie de prix couverts. |
| Changer un seul mode | Risque de réintroduire le lieu central dans un endpoint volontairement inconnu ; heures omises lors de reconstruction. | **FIXED** : null explicite reste null ; heures conservées ; autre sens et sélections voisines intacts. Confirmation locale des prix retirés. |
| Changer un véhicule | Conservation du péage et du prix manuel carburant déjà présente V8. | **ALREADY_WORKING**, canari PASS : arrêts/prix litre/péage conservés, litres estimés retirés uniquement sur le sens concerné. Confirmation précise : péage conservé comme estimation déclarée, aucune classe attestée par le DTO. |
| RAW puis clic Date / autre cible | Garde V8 Continuer/Abandonner, sans action Enregistrer. | **FIXED** : action facultative Enregistrer si valide ; après admission, reprise du clic demandé. Refus : RAW et cible d'édition conservés, erreur affichée. |
| Abandon RAW puis réouverture | Ancien buffer pouvait rester dans la ligne locale. | **FIXED** : seul RAW non admis abandonné, ligne rechargée depuis la sélection réellement admise ; 0 explicite reste MANUAL 0. |
| Confirmation devenue obsolète | Acceptation d'une fermeture capturant un ancien contexte possible. | **FIXED** : confirmation métier refusée si contexte changé ; garde RAW refuse un buffer remplacé pendant le dialogue. |
| Undo/Redo avec RAW | Nouvelle action Enregistrer ne doit pas ajouter une entrée puis restaurer une ancienne cible d'historique capturée. | **FIXED** : sur l'historique, Continuer/Abandonner uniquement ; enregistrer se fait d'abord dans l'éditeur. Aucun save suivi d'un Undo sur une cible périmée. |
| Repacking/pagination et RAW | Portail V8 déjà stable, preuves V8 antérieures. | **ALREADY_WORKING conservé** : aucun changement du host/packing/CSS. Re-renders/Échap simulés couverts ; nouveau resize/page/focus réel **NOT_RUN_BROWSER**. |

## 3. Diffs sémantiques démontrés

1. `barPlaceOperation` retourne seulement `EDIT_NIGHT_OUT { fields: { placeRef } }`. Tous les slots, Before, personnes, date, montants, IDs et relations restent bit-à-bit identiques. Aucun texte ou ID égal n'est traité comme preuve de liaison.
2. `barEndpoint` conserve l'identité du leg, son autre endpoint et tous les autres slots. Si une route existe, conserve son nombre de stops, le véhicule, le prix du litre, les arrêts indépendants et leurs preuves non touchées. Requalifie uniquement frontière/segment modifiés et prix concernés après accord ; ne fabrique pas de coût.
3. Taxi 12 € : avant choix, aucune mutation. Après choix explicite, `MANUAL 12` constitue une nouvelle estimation pour le nouvel endpoint, ou `UNKNOWN`. QUOTE n'est jamais transformé automatiquement en MANUAL. Aucune allocation ne suit silencieusement un nouveau trajet.
4. `patchLeg` remplace uniquement le `selectionId` ciblé dans son tableau, en conservant ses voisins. Un mode différent conserve les heures et les endpoints, y compris inconnus ; ne touche jamais l'autre sens.
5. Externe, financement ambigu et legacy : **REJECT_KEEP_EXISTING**, aucune simulation d'un nouveau contrat. Le propriétaire financier reste Compiler/Mobility/Finance V2.
6. Une opération combinée explicite lieu+endpoint+requalification est représentable par le writer existant et testée comme une mutation atomique, avec restauration des deux snapshots Undo/Redo. L'UI P1 choisit la voie conservatrice en deux décisions indépendantes plutôt que d'inventer le lien durable.

## 4. RAW, durabilité, Undo et ordre réseau

- Baseline : `6,50` sur Bière UNKNOWN → Date conserve le texte mais n'offre pas Enregistrer. Après correction : **Enregistrer 6,50 € / Continuer à modifier / Abandonner** ; save admis → calendrier, même ID, coût MANUAL `6.50`.
- Refus d'admission : texte exact conservé, ancien coût UNKNOWN inchangé, erreur visible ; nouvelle tentative possible. Entrée invalide : aucune action Enregistrer trompeuse.
- Autres buffers exécutés : nom libre, prix Taxi, personnes locales et montant rapide. Une collision total/détail requérant son propre arbitrage ne se sauvegarde pas indirectement via la garde.
- Retrait Bière financée puis restauration du snapshot : même ID, quantité, prix, binding et allocation. Les tests P1 ne prétendent pas piloter les boutons d'historique du Shell dans un navigateur : la restauration des snapshots est une preuve React/domain ; le scheduler et les canaris C1 couvrent séparément l'orchestration existante.
- Réponse Preview ancienne : contrôles scheduler réels à retards synthétiques PASS (versions, Undo, dispose, ordre inversé). Aucun scheduler ni mécanisme de FRESH nouveau.
- Sauvegarde HTTP : vrai socket loopback de la fixture existante. Réponse perdue après commit → GET de résolution → replay du même request ID reconnu sans nouvelle version. Deux mutations au même CAS → une admise, une CONFLICT. Deux SAVE effectifs, aucun APPLY, aucune écriture distante ou canari financier.
- Cette fixture mémoire/HTTP n'est ni Supabase réel ni une session JWT. Aucun RAW ou historique Undo durable n'est promis après reload. SAVED, FRESH et Apply restent distincts.

## 5. Tests réellement exécutés

Commandes depuis la racine du dépôt ; les logs ci-joints conservent les avertissements React et les échecs intermédiaires utiles. Aucun golden modifié.

| Commande / contrôle | SHA / périmètre | Résultat |
|---|---|---|
| `node scripts/check-bar-apero-p1.mjs` avant correction | Base `0c0bfea`, 5 groupes initiaux | Navigation PASS ; 4 écarts reproduits rouges (propagation, prix, externe, save RAW). |
| Même suite finale | Arbre produit `6e08d68`, 25 groupes React/domain | **PASS 25/25**, pas des événements de navigateur. |
| `node scripts/check-bar-apero-p1-http.mjs` | Code HTTP ajouté en `111a395`, serveur fixture boucle locale, mutations uniquement synthétiques | **PASS** : 6 assertions de parcours, dont relecture/IDs, CAS et réponse perdue. |
| `node scripts/check-l4-e-bar-v8.mjs` | Rejoué après dernier delta `6e08d68` | **PASS 16 groupes React**, provider Google simulé, total/détail, date/personnes, RAW, compact et protection. |
| `node scripts/check-l4-d-bar-mobility.mjs` | Rejoué sur `6e08d68` | **PASS 6 groupes**, vrai Compiler/V2 et Apply/Reload C0 sur PGlite synthétique, fournisseurs synthétiques, canaris inchangés. |
| `node scripts/check-planner-performance-parity.mjs` | Rejoué sur `6e08d68` | **PASS 22 × 9 = 198 empreintes**, fichier golden identique à la base. Aucune mesure de vitesse déduite. |
| `node scripts/check-l4-a.mjs` | `111a395`, aucun changement des bases de quantité ensuite | **PASS 19**, canaris ITEM/PERSON/SHARED, Before et provenance. |
| `node scripts/check-l4-b-presets.mjs` | `111a395` | **PASS 47 presets** création/édition/sérialisation/relecture synthétiques, pas 47 réceptions UX. |
| `node scripts/check-l4-c-v6-interactions.mjs` | `111a395` | **PASS 16 groupes React** et résumés des presets. |
| `node scripts/check-l4-final-reception.mjs` | `111a395` | **PASS** branches contractuelles des 14 scénarios ; pas 112 E2E exécutés. |
| `node scripts/check-composer-p14-p2-scheduler.mjs` | `111a395`, scheduler inchangé | **PASS 5 groupes**, après exécution autorisée ; premier lancement sandbox `spawnSync git EPERM` conservé. |
| `node scripts/check-composer-post-snap3-draft-http.mjs` | `111a395`, route et transport inchangés | **PASS 5 groupes**, service mocké distinct du test HTTP loopback. |
| `node scripts/check-pre-l4-c1.mjs` | `111a395` | **PASS** canaris financiers/immutabilité/inline ; premier lancement sandbox `spawnSync git EPERM`, puis exécution autorisée PASS. |
| `node scripts/check-pre-l4-c2-c8-source.mjs` | `111a395`, CSS inchangé | **PASS C8-017 original**. |
| `npx.cmd tsc --noEmit` | Baseline, `111a395`, arbre final `6e08d68` | **PASS, sortie 0**. |
| `npm.cmd run build` local | `111a395` | **BLOCKED_TOOLING** : Turbopack refuse le lien `node_modules` hors racine. Pas un full build PASS local. |
| Build Git Vercel Preview | `111a395` | **PASS FULL NEXT / READY** ; compilation, TS, génération, sortie du build et déploiement terminés. |
| Build Git Vercel Preview final | `6e08d68` | **PASS FULL NEXT / READY** sur son propre build : compilation 37,7 s, TypeScript terminé, génération 8/8, Build Completed et Deployment completed. Ce sont des temps de build, pas des performances utilisateur. |
| Navigateur réel P1 / focus / resize / confirmations natives | Session actuelle | **NOT_RUN_BROWSER**, outil de contrôle non disponible. Aucun contournement, capture ancienne non réétiquetée. |
| Auth Supabase et fournisseurs réels | Aucun environnement isolé autorisé utilisé | **NOT_RUN_AUTH / NOT_RUN_PROVIDER**. Aucun compte personnel utilisé. |

Les assertions V8/Mobility qui attendaient une propagation systématique du nouveau bar, ou une modification rapide d'un A/R legacy, ont été remplacées par les oracles explicites P1 E1–E4 : conservation stricte ou refus sûr. Ce sont des changements de contrat d'interaction demandés, pas un rafraîchissement de golden financier. Les anciens logs et le rouge P1 restent accessibles dans les preuves.

### Preview finale vérifiée

- URL immuable : [Preview P1](https://budgetisation-bl471tui4-adriensauvageot34-6137s-projects.vercel.app/mois-a-venir/composer?month=2026-11).
- Déploiement `dpl_9qCrHxAMBQDQ297SiGrazkpBBRE8`, Git `6e08d6858554b67d40ed10013d7445267be7e926`, **READY**, `target: null`, région `iad1`. Statut distinct du merge : aucune fusion.
- Journal complet : `evidence/bar-apero-p1/vercel-6e08d68-build.log`. Métadonnées minimales dans `preview-6e08d68.json` ; liste des preuves et SHA-256 dans `manifest.json`.
- Le premier build `111a395` est aussi conservé séparément. Aucun runtime authentifié, aucune capture P1 ni absence d'erreur utilisateur ne sont déduits de ces builds.

## 6. Fichiers produit et tests modifiés

- `src/app/mois-a-venir/composer/bar-living-operations.ts` : mutation de lieu conservatrice, invalidation ciblée, arbitrage de prix, refus externe/legacy/financement.
- `bar-living-editor.tsx` dans le même répertoire : micro-choix tarif, gardes, sauvegarde RAW/reprise, maintien des IDs/heures/voisins, rejet de confirmation obsolète et carte protégée.
- `inline-edit-registry.tsx` : callback facultatif de sauvegarde d'un seul RAW admissible ; contrôle de l'identité du buffer. Le texte reste local au composant.
- `workshop-confirmation.tsx` : troisième action facultative Enregistrer ; échec → retour à l'édition. Réutilise le dialogue natif et son focus, sans nouveau framework.
- `composer-shell.tsx` : transmet cette action facultative ; Undo/Redo n'offre pas un save suivi d'une restauration capturée avant ce save. Aucun changement financier, readWorld ou transport.
- `scripts/check-bar-apero-p1.mjs`, `scripts/check-bar-apero-p1-http.mjs` : nouvelles régressions ciblées ; fixtures et tests propriétaires réutilisés.
- `scripts/check-l4-e-bar-v8.mjs`, `scripts/check-l4-d-bar-mobility.mjs` : attentes d'interaction adaptées au contrat P1 ci-dessus, invariants renforcés.
- Ce rapport et `docs/status/evidence/bar-apero-p1/` : preuves. Aucun autre fichier métier ou migration.

## 7. Limites, réception humaine et arrêt

**Prêt pour revue du code et des preuves locales, pas UX_CERTIFIED.** La navigation ordinaire est prouvée en React sans écriture, mais `N=0/R=0` n'est pas déclaré comme mesure utilisateur réelle. Le parcours combinant bar et endpoints autonomes privilégie la conservation ; il demande de modifier volontairement le point du trajet si nécessaire.

- P2 : finition visuelle/dock, vrais événements clavier/focus, nouvelle vérification resize/page et confirmations natives ; host et géométrie V8 conservés sans nouvelle certification visuelle.
- P3 : sources/Google/favoris et éventuel propriétaire de liaison ; aucune invention dans ce lot.
- P4 : cas riches exhaustifs, funding externe détaillé et vraie persistance authentifiée isolée ; aucune promesse que les 45 cas sont certifiés.
- Pour revue visuelle ciblée : sur fixture/Preview autorisée, ouvrir le vrai Bar, ajouter Bière UNKNOWN, saisir `6,50`, cliquer Date et exercer les trois issues ; changer un lieu puis vérifier que les trajets autonomes ne bougent pas ; éditer le départ du Taxi 12 € et choisir explicitement le nouveau traitement du prix. Ne pas Apply sur un Plan personnel.

**Arrêt après P1. PR reste Draft. Pas de GO global demandé, pas de P2 lancé.**
