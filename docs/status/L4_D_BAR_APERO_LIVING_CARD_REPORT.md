# L4-D — Bar / Apéro V7 : carte vivante

Date : 17 octobre 2026. Prototype limité au preset `bar-apero`.

## Verdict

- `V7_IMPLEMENTATION = READY_FOR_UX_REVIEW`.
- `V7_UX_RECEPTION = PARTIAL_NOT_CERTIFIED` : navigateur officiellement désactivé dans Work ; aucun PASS visuel, capture ou rectangle DOM revendiqué.
- `V7_FINANCIAL_CONTRACT = EXECUTED_PASS_SYNTHETIC_ONLY` ; parité historique **198/198**, golden inchangé.
- `V7_AUTHENTICATED = NOT_RUN_AUTH`.
- `GO_GENERALISATION = PENDING_HUMAN_UX_REVIEW` ; les 46 autres presets ne sont pas généralisés.
- `PRODUCTION = UNCHANGED` ; aucune fusion, promotion, migration ou écriture financière réelle.

## Références exactes

Base vérifiée : PR [#56](https://github.com/adriensauvageot34/Budgetisation/pull/56), ouverte et non fusionnée, HEAD `e7d94ce8cd80126ba4e1b8385c6440fb5fa02a8d`. Sa base reste #55, dépendante de #54.

Branche : `codex/composer-v3-l4-d-bar-living-card`.

PR empilée : [#57](https://github.com/adriensauvageot34/Budgetisation/pull/57), base #56, en Draft pour réception.

Commits produit :

1. `b4684a5fbca0f7ab70b70375b8ee811aaab10362` : carte, Board, dock, composants et parcours Mobility/lieux.
2. `86305aa602866f9b58a42f4665b9d3cc62f0ac7c` : correction ciblée des endpoints incomplets et conservation du véhicule/itinéraire ; code final testé.

Le commit de clôture ajoute uniquement ce rapport et les preuves. Le SHA de code testé est distingué du HEAD documentaire dans le [manifeste](evidence/l4-d-bar-living-card/execution-manifest.json). Aucun résultat d'un arbre antérieur n'est présenté comme une exécution du HEAD final.

## Fonctionnement livré

### Carte dans le Board

`ContextCard` sélectionne la nouvelle présentation uniquement pour `bar-apero`. Le même contexte s'agrandit dans les tracks de `inventory-layout.ts` ; aucun overlay d'éditeur à droite. La dimension d'expansion est un état transitoire de présentation : largeur visée 760 px bornée par le Board, hauteur 520 px bornée par le viewport mesuré. Le contenu possède un scroll local. Les autres items sont repackés dans l'ordre logique existant et peuvent passer à la page suivante.

Un contexte contenu dans un VisualCluster est temporairement extrait pendant son édition, suivant le mécanisme déjà employé pour Restaurant. L'expansion est figée pendant le drag. Le FLIP existant déplace les voisins ; la nouvelle surface peut être révélée sans mise à l'échelle de son texte. `prefers-reduced-motion` reste respecté par ce chemin d'animation. La géométrie calculée retrouve exactement sa projection initiale après repli dans les tests purs ; cela ne constitue pas une mesure DOM.

La carte fermée affiche le lieu, les personnes réellement retenues, la date si décidée, les deux sens et leurs endpoints, puis les tuiles économiques. Les métadonnées et trajets ne deviennent pas des composants payants. Le coût affiché provient exclusivement des évaluations/synthèses serveur ; les montants inconnus ne sont pas transformés en gratuité. Une projection non fraîche est indiquée comme telle.

Une seule croix replie la carte. Les informations sont cliquables ; une tuile de consommation fermée réouvre directement sa sélection identifiée. Le dock horizontal R6 reste le lieu des choix. Le drag du contexte et les cibles existantes restent raccordés ; les composants utilisent leurs sources satellites publiées lorsqu'elles existent. **Drag natif et résultat visuel restent NOT_RUN.**

### Consommation immédiate et RAW

Un clic sur Bière crée immédiatement une décision explicite avec `selectionId`, quantité 1, unité ITEM et coût UNKNOWN. Il ouvre une ligne courte : quantité, prix, Terminé, Retirer. Sans saisie, continuer ne crée aucun prix. Un zéro saisi et confirmé reste un zéro explicite.

Les modifications de prix/quantité sont des buffers RAW jusqu'à validation ; les choix déjà admis restent dans le Draft. Le registre V6 protège changement de question, autre carte, fermeture et historique. Annuler la confirmation conserve le texte ; Abandonner conserve la bière admise et son ancien prix, notamment UNKNOWN. Le composant de confirmation existant est réutilisé ; pas de `window.confirm` nouveau.

Les unités PERSON/SHARED, devis, financements et questions complexes restent accessibles via les composants V6 embarqués **dans** la carte. Les détails rares utilisent `NightOutEditor` en mode embarqué sans son bandeau/« Quitter »/footer redondants. Les autres presets conservent son comportement normal.

### Aller, retour, lieu

Les slots existants `outbound` et `return` conservent chacun leur identité. Aucun trajet n'est créé à partir de la seule présence d'un lieu ou d'un véhicule.

« Même mode au retour » est une action explicite : endpoints inversés, nouvelle identité, aucun tarif, stationnement, financement ou devis copié. Le véhicule déjà explicitement retenu peut être conservé ; les distances, péages et carburant du retour sont réestimés par Mobility. Changer uniquement le retour en taxi conserve l'aller et retire la route du retour voiture.

Le lieu central modifie uniquement la destination de l'aller et le départ du retour. Confirmation préalable, invalidation des tarifs/parking/financements et dérivations concernées, conservation des modes, du véhicule, du prix carburant manuel, des arrêts indépendants, des dates/personnes/consommations. Une relation vers un autre owner reste une relation, rendue POSSIBLE/à requalifier ; elle n'est pas remplacée silencieusement par un nouveau propriétaire.

Une petite extension compatible de `EDIT_NIGHT_OUT.slots` autorise les deux slots Mobility **déjà publiés**. Elle permet une admission atomique du lieu et de ses endpoints, donc un seul Undo. Le validateur serveur existant, le Compiler et Finance V2 restent les autorités ; aucune modification de leur calcul.

Le retrait d'un endpoint d'un trajet direct produit une intention incomplète admissible avec route vide et véhicule conservé. Pour un ancien aller-retour ou des arrêts intermédiaires, cette opération est refusée explicitement afin de ne pas supprimer ces informations. Changer le départ d'un ancien aller-retour conserve ses deux extrémités cohérentes. La conversion automatique de cet ancien trajet en deux nouveaux legs n'est pas livrée ; les options détaillées restent nécessaires, avec blocage explicite du raccourci.

## Google et capacités propriétaires

Les appels réutilisent exclusivement `/api/places/autocomplete` et `/api/places/details`, `context.kind=VENUE`, le token de session et la normalisation du serveur existant. Ville explicitement saisie, délai existant de 300 ms, annulation AbortController et génération de requête, attribution Google Maps, erreurs lisibles et alternatives manuelles. Aucune nouvelle clé publique, dépendance Google ou écriture de lieu.

Un résultat Google n'est admis comme KNOWN que s'il correspond à un `googlePlaceId` déjà présent dans les lieux canoniques admissibles du modèle. Sinon le résultat reste transitoire et l'interface explique l'absence de promotion propriétaire ; l'utilisateur peut saisir son propre repère TEXT. Aucun ID Google ni coordonnées n'est dissimulé dans un label. **La promotion d'un nouveau lieu Google reste BLOCKED_CAPABILITY, donc la capacité Google de bout en bout est PARTIAL.**

Les lieux et personnes viennent du modèle admissible ; aucune adresse de l'exemple, identité Maison/Travail ou relation personnelle n'est codée en dur. Aucun nouveau calcul de distance à partir d'un texte seul. Le test de lookup Google emploie des réponses synthétiques aux routes officielles, sans appel Google/Supabase réel.

## Tests exécutés et SHA

Les commandes sont lancées par l'agent, sans intervention manuelle. Journaux dans [evidence/l4-d-bar-living-card](evidence/l4-d-bar-living-card/).

| Contrôle | Résultat réellement exécuté | Arbre du code |
|---|---|---|
| `check-l4-d-bar-living-card.mjs` | PASS, 13 groupes React en processus | final `86305aa` |
| `check-l4-d-bar-mobility.mjs` | PASS, 6 groupes Compiler/V2/C0/PGlite | final `86305aa` |
| `tsc --noEmit --pretty false` | PASS, sortie 0 | final `86305aa` |
| L4-A | PASS, 19 contrôles synthétiques | `b4684a5` |
| L4-B | PASS, 47 presets création/édition/serialization/READ | `b4684a5` |
| Réception V5 | PASS, 15 groupes couvrant les 14 scénarios | `b4684a5` |
| Réception V6 | PASS, 16 groupes React dont 47 résumés | `b4684a5` |
| P03 via C1, scheduler, Draft HTTP | PASS, contrats/ordre des réponses/services simulés | `b4684a5` |
| P10/P11/P12/P13 | PASS, PGlite synthétique, Apply/CAS/READ et canaris | `b4684a5` |
| Finance historique | PASS, 22 cas × 9 empreintes = 198 ; golden inchangé | `b4684a5` |
| C8-017 original isolé | PASS, aucune désactivation du garde | `b4684a5` |
| Fixture minifiée avec chunks | construction locale sortie 0 ; pas un build Next | avant les derniers ajustements locaux ; preuve secondaire uniquement |
| Next complet Preview | PASS complet, READY | final `86305aa` |
| Auth Supabase isolé / nouvelle session | NOT_RUN_AUTH | aucun compte personnel utilisé |
| Navigateur / DOM / captures | NOT_RUN | outil officiellement désactivé |

Le delta `b4684a5 → 86305aa` ne touche que les helpers Bar endpoint/véhicule et leurs tests. Les régressions partagées ne sont pas présentées comme rejouées après ce delta ; les contrôles affectés et TypeScript ont été rejoués. Aucun golden n'a été modifié.

### Ce que prouvent les groupes V7

- Ajout/retrait avant même la première projection de sockets : deux décisions locales admises, sans attendre Preview.
- Démarrage par lieu ou chemin court ; bière admise UNKNOWN sans date ni trajet forcé.
- RAW : attente, Annuler, événement onCancel du dialogue, abandon explicite sans mutation du prix admis.
- 8 € puis 12 € : évaluations officielles 8,00 et 12,00 ; réédition/quantité/identité conservées.
- Retrait puis restauration du snapshot sémantique : prix et identités exacts. Ce test vérifie les états destinés à l'historique ; il ne certifie pas le bouton Undo natif.
- Mutation rejetée : RAW conservé, erreur, retry ; zéro MANUAL distinct d'UNKNOWN.
- Retour explicitement inversé, tarif non copié, changement taxi, prix du seul retour sans perte des endpoints.
- Lieu modifié : coûts liés invalidés, composant indépendant conservé ; relation propriétaire non réassignée.
- Rechoix véhicule : prix manuel, stops et péages déclarés préservés. En changement de véhicule, litres dérivés retirés pour réestimation.
- Layout pur sur 40 items, plusieurs pages et trois dimensions de Board : pas de cellules occupées deux fois, ordre stable, repli identique. **Aucun viewport réel n'est déduit de ces dimensions d'entrée.**
- Apply/READ/réédition sur PGlite et deux legs persistés. Canaris inchangés et zéro écriture distante.
- Google mock : VENUE, token partagé puis renouvelé, réponse périmée ignorée, adoption KNOWN, refus de promotion non publiée, erreur 429.

### Mobility réellement passée dans le Compiler

Les fournisseurs sont synthétiques, le chemin applicatif est réel : deux trajets dirigés de 10 km, carburant d'usage estimé 2,00 € chacun ; deux lignes de coût d'usage et aucun coût supplémentaire du parent. Retour taxi 12,00 € : une seule ligne carburant restante pour l'aller, retour taxi présent, aller inchangé. Aucun plein payé ni dépense observée n'est créé.

Texte libre non géocodé : anciennes estimations 2,00 et prix taxi 12,00 invalidés. Panne fournisseur : réponse conservée avec UNKNOWN, pas d'échec de tout le Board. Réévaluation répétée des mêmes décisions : digests de scénario/manifest identiques. Apply→READ des deux slots : identités et valeurs exactes, exclusivement dans PGlite.

## Avant / après mesuré

La [comparaison](evidence/l4-d-bar-living-card/effort.json) exécute les vrais handlers React V6 et V7 sur le même preset et les mêmes données synthétiques. Départ : carte vide, éditeur ouvert. Arrivée : une bière quantité 1 et prix UNKNOWN admise.

| Version | Actions de contrôle |
|---|---:|
| V6 | 4 : Consommations, Bière, Prix à préciser, Conserver |
| V7 | 2 : Commencer par les consommations, Bière |

Ce sont des actions de contrôle, pas des touches, latences ou observations humaines. P50/P95, durées React/peinture, scroll réel, rectangles, captures avant/après : **NOT_MEASURED / NOT_RUN**. Aucune cible de fluidité n'est déclarée atteinte.

## Anomalies découvertes et corrections

Les premiers échecs sont conservés dans les preuves ; aucun golden n'a été ajusté.

1. Retour indépendant : `choice=SEPARATE` était interdit pour `OWNS_JOURNEY` par le validateur. Correction `choice=null` selon le contrat existant.
2. Route du retour : l'ancre ROOT_PLACE était au départ, contrairement au contrat du trajet dirigé. Correction : DIRECT_PLACE au départ et ROOT_PLACE à la destination, sans changer le resolver.
3. Retrait immédiat : un socket visuel pouvait manquer avant Preview. Le retrait passe par l'admission atomique NightOut et non une dépendance à ce socket périmé ; test dédié ajouté.
4. Endpoint inconnu : route partiellement vide susceptible d'être invalide. Une route directe incomplète garde son véhicule et attend ses endpoints ; les routes composites sont protégées contre une suppression implicite.
5. Rechoix véhicule : reconstruction susceptible de perdre le prix carburant manuel ou les stops. Conservation ciblée et test de non-perte ajoutés.
6. Trois erreurs initiales du test React concernaient ses sélecteurs : nom accessible du stepper, bouton de confirmation distinct du bouton Retirer, libellé publié « Taxi / Uber ». Sélecteurs corrigés ; assertions métier conservées.

`react-test-renderer` signale sa dépréciation ; les journaux incluent également des avertissements `act` pour des admissions directes de fixtures. Les tests du composant utilisent de vrais handlers, mais simulent portails et références DOM : aucun focus/clavier/layout natif n'est certifié par ces tests.

## Réception A–I et réserves

| Scénario | Réception |
|---|---|
| A géométrie, voisinage, pages | layout pur PASS ; rectangles/images 1440×900, 1728×900, 1920×1080 NOT_RUN |
| B parcours enrichi / recharge | conservation deux legs Compiler→Apply→READ PASS synthétique ; parcours UI authentifié NOT_RUN_AUTH ; Google promotion PARTIAL |
| C ultra court / UNKNOWN / 8+12 | PASS React et évaluations serveur synthétiques |
| D retour / changement mode / lieu | PASS React et Compiler synthétiques ; providers réels NOT_RUN |
| E retrait / restauration | PASS React/états ; drag natif NOT_RUN |
| F RAW / navigation | PASS handlers et registre ; focus DOM/Escape depuis Board/Undo natif NOT_RUN |
| G finance / unités / enveloppes / financements | V6/L4-A/V5/198 PASS synthétiques ; pas de certification financière réelle nouvelle |
| H lieux / Google / manuels / erreurs | réponses mock et contrat d'adoption PASS ; réseau réel, expirations serveur, alias personnels NOT_RUN |
| I environnement | TS PASS ; Preview exacte documentée ; C8 et régressions PASS selon SHA ; navigateur/auth NOT_RUN |

La réception visuelle desktop reste le gate avant généralisation. Pour la prochaine réception autorisée, ouvrir la Preview, créer Bar/Apéro au milieu d'au moins cinq cartes, mesurer `getBoundingClientRect()` des éléments `[data-bar-living-card]`, `[data-inventory-id]`, `[data-palette-dock]` et pagination aux trois largeurs effectives ; ouvrir/replier, naviguer une page dense, tester clavier/réduction des animations et confirmations RAW. Aucun script navigateur parallèle n'a contourné le refus Work.

Limites produit explicites : promotion de nouveaux Google Places non publiée ; anciens trajets combinés non convertis automatiquement ; éditeurs complexes conservés embarqués, donc pas une certification de simplicité parfaite de tous leurs sous-chemins. Les fonctionnalités des autres presets ne sont pas déclarées finalisées par ce lot.

## Build, sécurité et livraison

Premier produit `b4684a5` : build complet `npm run build`/Next 16.2.6, compilation, TypeScript, génération routes, déploiement sorties ; Preview `dpl_9uw8D5pvqhn7w2U3WQfS3djVPA54`, READY. [Journal](evidence/l4-d-bar-living-card/vercel-product-build.log). Cette preuve ne certifie pas à elle seule le correctif final `86305aa`.

Build final `86305aa602866f9b58a42f4665b9d3cc62f0ac7c` : **EXECUTED_PASS_FULL_NEXT_PREVIEW**, `dpl_UjKR8mWa9CzrhMqnkJ8i2LBx85Bz`, target null, READY. [Preview du code final](https://budgetisation-gdjy7kp6b-adriensauvageot34-6137s-projects.vercel.app), [journal intégral](evidence/l4-d-bar-living-card/vercel-final-build.log), [état vérifié](evidence/l4-d-bar-living-card/vercel-final-deployment.json). La compilation, TypeScript, la génération statique, `Build Completed` et `Deployment completed` sont présents. Aucune simple compilation Turbopack n'est assimilée à un build complet. Dépendances/cache Vercel réutilisés, pas de revendication d'installation fraîche. Aucun test runtime authentifié sur cette Preview n'est déclaré.

Revue React Best Practices appliquée : hooks inconditionnels, état local de présentation, clés par identité, import différé de l'atelier, protection RAW existante, handlers de focus/accessibilité, réponses Google périmées ignorées. Aucun nouveau moteur/statistique/client financier, store persistant, table, writer de source, clé exposée ou changement de SNAP-3.

Rollback : revert `86305aa`, puis `b4684a5`, en conservant la pile #54/#55/#56 ; aucun SQL, suppression de Draft ou réinitialisation. La nouvelle extension de slots est compatible en lecture avec les décisions déjà existantes, pas une nouvelle version de Plan.

Reproduction des tests en processus : `node scripts/check-l4-d-bar-living-card.mjs`, puis `node scripts/check-l4-d-bar-mobility.mjs`. Le premier réutilise `react-test-renderer@19.2.6` installé hors dépendances produit dans `outputs/l4c-test-tools` pour L4-C ; le second utilise le PGlite synthétique existant. Les outils sont déjà présents ici. Ils ne constituent ni un serveur Supabase local ni des sessions JWT réelles. `npx.cmd tsc --noEmit --pretty false` complète les contrôles ; les commandes de build réelles sont conservées dans les journaux Vercel.

**Arrêt après ce prototype. Une revue UX humaine de Bar/Apéro est nécessaire avant généralisation aux autres 46 presets et avant tout GO d'intégration/Production.**
