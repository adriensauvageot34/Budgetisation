# Bar / Apéro — P2 : carte vivante et dock de composition

Date : 2026-10-17. **READY_FOR_HUMAN_UX_REVIEW_WITH_LIMITS**. Ce verdict concerne le code et les preuves disponibles ; **pas UX_CERTIFIED**, pas une réception finale P4.

## 1. Base et livraison séparée

- Référentiel technique post-V8 et annexes lus intégralement pendant P1, réutilisés ; réception P1 relue intégralement ; prompt P2 lu intégralement (442 lignes). La vision finale n'autorise pas P3/P4.
- `git fetch origin` puis vérification : main reste `0c0bfea03f5d6e30298eb04120c77ec684e7abc0`. #59 est **OPEN / Draft / non fusionnée**, HEAD `c73ad223f218903dc2e7181a5c271d6189ea1c52`.
- Branche P2 : `codex/bar-apero-p2-visual-dock`, créée depuis ce HEAD P1 vérifié. Seul `outputs/` préexistant était non suivi ; il est conservé hors commit.
- **Code produit et tests finaux : `5125f8320d4d0b77feba1845ac394c0b81344630`.** Les commits documentaires suivants ne changent pas ce code.
- [PR Draft #60](https://github.com/adriensauvageot34/Budgetisation/pull/60), **base `codex/bar-apero-p1-interaction-safety`**, dépend de #59. Le diff P2 contient neuf fichiers, sans réimplémenter P1 contre main.
- [Preview exacte](https://budgetisation-q6l73zd1v-adriensauvageot34-6137s-projects.vercel.app/mois-a-venir/composer?month=2026-11) : **READY**, déploiement `dpl_J5yhJVMQPce6BmDAF5J2C8KNKVMU`, SHA `5125f83`, `target: null`, région `iad1`. Build Next complet distinct de toute validation utilisateur.
- Aucune fusion, migration, modification de configuration globale Vercel, promotion Production, utilisation de compte personnel ou écriture financière distante.

## 2. Avant / après réellement établi

La baseline React sur `c73ad22` conserve quatre échecs ciblés : départ place-first sans Bière immédiate ; quantité nécessitant encore une clôture ; dock du prix remplaçant les boissons ; lignes compactes de trajets absents. Ils ne sont pas déclarés FAIL_BROWSER.

| Surface | Avant | Après | Statut / preuve |
|---|---|---|---|
| Ouverture neutre | Lieu en premier, accès Bière par navigation supplémentaire | Dock **Lieu / Bière / Date / Montant direct / Autre**, aucune décision créée à l'ouverture | **FIXED / PASS_REACT** |
| Bière UNKNOWN | Tuile déjà existante V8/P1 | Ajout toujours immédiat, ITEM ×1 UNKNOWN, même writer, pas de date/lieu/participants imposés | **ALREADY_WORKING conservé** |
| Quantité propre | `+` rendait la ligne dirty puis Terminé requis | `+`/`−` admet la quantité de cette ligne directement ; aucune clôture propre | **FIXED / PASS_REACT** |
| Quantité avec prix RAW | Risque de valider implicitement le prix en simplifiant le geste | La quantité reste dans le buffer dirty, prix et quantité admis seulement par choix explicite | **PASS_REACT**, ni prix ni quantité non validés injectés dans le Draft |
| Prix dans la tuile | Prix local déjà présent ; Terminé même sur état propre | Mini-édition dans la même tuile ; **Enregistrer** seulement pour RAW dirty, désactivé si non admissible ; corbeille et détails sur l'objet | **FIXED / PASS_REACT** |
| Dock pendant la mini-édition | Questions prix/inconnu/avancé à la place des boissons | Les cinq produits du catalogue Bar restent proposés et illustrés ; détails avancés accessibles sur la tuile | **FIXED / PASS_REACT** |
| Ajout après save RAW | Nouveau chemin rendu accessible par le dock boissons | Reprise après commit React, handlers courants : le Cocktail ne réécrit pas la Bière avec son ancien prix | **FIXED**, test de non-perte `6,50 → Cocktail` |
| Quitter une tuile propre | Terminé disponible comme clôture | Clic neutre ou autre cible : réduction sans mutation ; Échap revient à la carte neutre avant le repli | **PASS_REACT**, événements natifs **NOT_RUN_BROWSER** |
| Personnes | Sélections en attente puis Retenir ces personnes | Chaque sélection nominative est admise par `EDIT_NIGHT_OUT`, sans page de confirmation. Nom libre admis par son ajout explicite | **FIXED / PASS_REACT** ; aucune multiplication ITEM/SHARED |
| Date | Calendrier inline déjà présent | Calendrier conservé, suppression explicite locale, raccourci stable accessible même lorsque la date est déjà affichée en français | **ALREADY_WORKING / PASS_REACT** |
| Compact vide | Deux lignes de trajets absents et commandes permanentes | Faits présents seulement, invitation discrète à composer, aucun faux transport | **FIXED / PASS_REACT** |
| Compact riche | Toutes les consommations montrées | **Deux postes +N**, compteur ouvrant les existants sans création ; mêmes IDs | **FIXED**, 8 et 15 postes testés |
| Trajets | Deux lignes même si aucune intention | Seuls legs présents ; `+ Retour` discret après un Aller indépendant ; ancien A/R affiché une seule fois | **FIXED / PASS_REACT** |
| Modes et coûts | Taxi partageait l'icône générique ; devis n'utilisait pas le tarif DTO affichable | Icône Taxi distincte ; coûts autoritaires rapprochés par ownerIntentId ; prix manuel identifié déclaré, estimation ancienne signalée | **FIXED / PASS_REACT** ; aucun calcul de somme client |
| Sections riches | Liste économique plate | **Au bar / Avant de sortir / Repas / Entrées-coût direct**, uniquement les groupes présents ; noms des composants Before consultables | **FIXED / PASS_REACT**, édition riche propriétaire conservée |
| Lecture seule | Certaines saisies pouvaient encore recevoir du RAW malgré refus du writer | Motif visible sur la carte, groupe de contrôles désactivé, dock de mutation désactivé | **FIXED / PASS_REACT**, efficacité native à contrôler |
| Taille compacte | Hauteur croissant avec les quinze postes, tous prévisualisés | Tracks compacts fondés sur les faits affichés : présence du contexte, legs et une rangée de deux postes maximum | **FIXED / PASS_SYNTHETIC_LAYOUT** |
| Expansion et grille | Gabarit historique plafonné à 760×520 puis réduit au viewport | **Packer et portail inchangés**. Contenu mieux réparti et scroll interne existant ; aucun nouveau moteur de layout | **PARTIAL** : nouvelle géométrie DOM et taille d'expansion réellement proportionnelle non certifiées |

Le dock utilise le catalogue **réel** Bar : Bière, Verre de vin, Cocktail, Shot, Planche/tapas. Aucune nouvelle identité Soft/Bouteille ou nouveau prix n'est inventé pour ressembler à la maquette. Les autres produits et unités riches restent accessibles par les chemins spécialisés existants. Le présent lot ne promet pas un nouveau catalogue métier.

## 3. Réception V2-01 à V2-09

| Parcours | Preuve exécutée au SHA produit | Résultat et limite |
|---|---|---|
| V2-01 vide | État `summary`, cinq choix exacts, zéro opération, aucune ligne de trajet absente | **PASS_REACT**, taille réellement peinte non certifiée |
| V2-02 Bière puis quantité | Deux handlers après rendu de l'éditeur : Bière puis `+` ; ITEM ×2 UNKNOWN, ID identique, registre RAW propre | **PASS_REACT**. Objectif depuis compact = ouverture + ces deux gestes ; séquence navigateur de trois gestes **NOT_RUN** |
| V2-03 prix puis date | Même tuile, texte `6,50`, Enregistrer, calendrier direct ; absence de Terminé propre, rejet et reprise couverts par P1 | **PASS_REACT**. Édition/admission/navigation sont trois décisions utiles après ciblage ; aucune mesure de latence ni de souris native |
| V2-04 date et trois contacts | Choix d'un jour, puis trois toggles nominaux, rétention immédiate ; aucun bouton Retenir ces personnes | **PASS_REACT**. La liste des présences ne crée aucun composant économique |
| V2-05 Aller voiture, Retour Taxi | Deux IDs, deux modes, deux lignes ; tarif Retour UNKNOWN, aucun coût voiture recopié | **PASS_REACT**, Mobility/Compiler synthétiques complètent le test |
| V2-06 Aller seul puis compact | Aller présent, Retour absent ; clic `+ Retour` ouvre le sens sans écrire un leg | **PASS_REACT**, pas de retour silencieux |
| V2-07 huit/quinze postes, deux Bières | Deux IDs et prix 6/8 distincts, ciblage exact, une tuile active, retrait et restauration exacte ; compact deux postes +6/+13 | **PASS_REACT**, wrapping/scroll natifs **NOT_RUN_BROWSER** |
| V2-08 RAW vers Cocktail / Échap / sortie | Continuer garde le texte ; save admis puis ajout conserve le prix ; rejet empêche l'ajout ; Abandonner garde la Bière UNKNOWN ; clic propre et Échap ne modifient pas le Draft | **PASS_REACT**. Fermeture/pagination/repacking/focus natifs non rejoués ; portail P1 inchangé |
| V2-09 Before/repas/coût direct | Groupes distincts, Bouteille SHARED enfant et IDs conservés quand le prix de Bière change ; collisions total/détail rejouées par V8 | **PASS_REACT / PGLITE SYNTHETIC**, pas une nouvelle édition exhaustive du Before |

Les objectifs `N=0 / X=0 / R=0` sont des oracles de construction : les chemins React ordinaires n'imposent plus de clôture propre ni de formulaire externe. **Aucun score utilisateur mesuré ni certificat global de zéro friction n'est revendiqué.** Les confirmations de perte P1 restent des décisions légitimes.

## 4. P1 et propriétaires conservés

- Diffs nuls depuis `c73ad22` sur `bar-living-operations.ts`, `inline-edit-registry.tsx`, `workshop-confirmation.tsx`, `bar-living-mount.tsx`, `composer-shell.tsx`, `src/domain`, `src/server`, `supabase`, package et lockfile. Aucun nouveau writer, schéma ou DTO financier.
- Le changement du bar conserve toujours les endpoints autonomes ; égalité d'ID/texte n'est pas une liaison durable. Les arbitrages de prix, refus externes/funding/legacy/multistops et identités restent couverts par les **25 groupes P1**.
- La seule adaptation de continuité RAW est **locale à Bar** : la reprise du geste après admission attend le rendu du nouveau Draft et invoque un handler courant. Ni store RAW persistant, ni scheduler bis.
- La fermeture de tuile, le focus, le dock, le zoom et le scroll n'envoient aucune mutation. Les admissions du stepper et d'un participant correspondent à des décisions explicites, via l'owner existant.
- Coûts connus, précédents, UNKNOWN, MANUAL 0 et QUOTE restent distincts. Aucune somme de postes React, aucun prix historique, aucune allocation implicite, aucun mouvement bancaire.
- Avant/repas/enfants et sources sont inchangés hors ciblage ; la parité financière et le test Apply/Reload utilisent le vrai Compiler/V2 sur des fixtures isolées.
- `ContextPalette` utilise un prop facultatif `appearance="bar"`, absent ailleurs ; styles nouveaux préfixés Bar. Le canari sans ce prop conserve le dock générique. Le calcul de hauteur changé ne s'applique qu'au preset exact Bar.
- Les modifications de tests P1/V8 portent sur les commandes de présentation : Enregistrer dirty remplace Terminé, cibles directes libellées de façon accessible, personnes déjà admises, attente d'un vrai leg pour son clic. Les oracles de données, montants, IDs, gardes et funding ne sont pas supprimés.

## 5. Tests, commandes et statut exact

Tous les tests finaux ci-dessous ont été exécutés sur **`5125f8320d4d0b77feba1845ac394c0b81344630`**, ou sur son arbre identique avant commit. Les logs baseline sont conservés séparément. Aucun golden financier modifié.

| Commande / vérification | Résultat |
|---|---|
| `node scripts/check-bar-apero-p2.mjs` | **19 groupes PASS_REACT / layout pur**, dont les neuf parcours, gardes RAW, états, comptage compact et canari dock générique |
| `node scripts/check-bar-apero-p1.mjs` | **25 groupes PASS_REACT/domain**, présentations adaptées sans retirer les garanties P1 |
| `node scripts/check-l4-e-bar-v8.mjs` | **16 groupes PASS_REACT synthétiques**, canaris total/détail, présence, sauvegarde, réédition, parcelles de layout |
| `node scripts/check-l4-d-bar-mobility.mjs` | **6 groupes PASS_PGLITE_SYNTHETIC_ONLY**, vrai Compiler/Finance, Apply/Reload, fournisseur indisponible, canaris d'absence de mutations d'owners |
| `node scripts/check-l4-a.mjs` | **19 PASS_PGLITE_SYNTHETIC_ONLY**, ITEM/PERSON/SHARED, Before, provenance |
| `node scripts/check-l4-b-presets.mjs` | **47 presets PASS** création/édition/sérialisation/relecture synthétiques ; pas 47 recettes visuelles |
| `node scripts/check-planner-performance-parity.mjs` | **198/198 PASS** (22 cas ×9 empreintes), golden inchangé ; aucun gain de performance déduit |
| `node scripts/check-pre-l4-c2-c8-source.mjs` | **C8-017 PASS**, assertion originale, aucun media query de largeur ajouté |
| `node scripts/check-composer-post-snap3-draft-http.mjs` | **PASS_LOCAL_MOCKED_SERVICE_ONLY**, cinq groupes protocole/origine/perte de réponse |
| `BAR_P1_FIXTURE_ORIGIN=http://127.0.0.1:3218 node scripts/check-bar-apero-p1-http.mjs` | **PASS_LOOPBACK_HTTP_SYNTHETIC_ONLY** : sauvegarde réelle sur socket local, réponse perdue puis relecture/replay sans double version, CAS concurrent, identités conservées, deux SAVE effectifs, zéro Apply/écriture distante |
| `npx.cmd tsc --noEmit` | **PASS, sortie 0** |
| Build local Next | **NOT_RUN_KNOWN_TOOLING_LIMIT** : junction `node_modules` vers `p14-c4-candidate/node_modules` toujours présente ; refus Turbopack déjà établi en P1. Pas de relance identique ni faux PASS local |
| Build Git Vercel exact | **PASS_FULL_NEXT / READY** : `next build`, compilation 38,4 s, TypeScript terminé, génération 8/8, `Build Completed`, `Deployment completed` ; durées de build seulement |
| Auth réelle / fournisseurs réels | **NOT_RUN_AUTH / NOT_RUN_PROVIDER**, aucune session personnelle ou écriture financière distante |
| Navigateurs, captures, rectangles DOM, viewports effectifs, zoom125, tactile, Tab/drag natifs | **NOT_RUN_BROWSER** pour ce lot |

### Pourquoi aucune capture P2 n'est fournie

Le skill Computer Use et ses règles ont été lus avant l'initialisation officielle. Le listing des applications a répondu ; à l'ouverture d'un onglet Chrome dédié, l'outil a arrêté l'usage : **« could not determine the current browser URL on Windows with enough confidence to enforce policy »**. Aucun autre appel UI, protocole navigateur alternatif ou contournement n'a été tenté ensuite.

Les cinq fichiers `react-structure/*.json` sont des **structures réellement rendues par les composants React**, pas des pixels, screenshots, certificats DOM ou preuves de layout natif. Ils couvrent EMPTY, BEER_UNKNOWN, MIXED_MODES et DENSE 8/15. Les captures V8 ne sont pas attribuées au code P2. Aucune réussite de build n'est convertie en PASS navigateur.

Le layout pur a été testé à **720×380, 1000×470, 1200×470 et 1330×550 de surface de grille simulée**, pour 5/16/30/50 éléments, ouverture/repli et conservation des IDs. Ce ne sont **pas** des viewports 1440/1728/1920 réellement mesurés.

## 6. Fichiers du delta P2

1. `src/app/mois-a-venir/composer/bar-living-card.tsx` : compact, compteur, états, déclencheur illustration, legs existants et raison de protection.
2. `bar-living-details.tsx` : unités, quantités, métadonnées actives/accessibles, icône Taxi, lecture du coût DTO et ancien A/R.
3. `bar-living-editor.tsx` : dock neutre/boissons, admissions locales explicites, suppression des clôtures propres, sections, reprise RAW et contrôles verrouillés.
4. `composer.module.css` : règles Bar et palette Bar uniquement ; scroll borné, wrapping, champs et états actifs. Pas d'animation nouvelle ; règles existantes reduced-motion conservées.
5. `context-palette.tsx` : apparence Bar facultative, recherche désactivée sur carte verrouillée ; défaut des autres presets conservé.
6. `presentation/adapter.ts` : estimation de hauteur compacte Bar fondée sur ses aperçus effectivement visibles, pas les quinze postes cachés.
7. `scripts/check-bar-apero-p2.mjs` : suite P2 et structures React, bibliothèque de fixtures existante.
8. `scripts/check-bar-apero-p1.mjs`, `scripts/check-l4-e-bar-v8.mjs` : adaptations des gestes de présentation et conservation des assertions métier.
9. Ce rapport et `docs/status/evidence/bar-apero-p2/` : journaux, baseline rouge, résultats finaux, build exact, métadonnées Preview et manifeste SHA-256.

## 7. Recette humaine exécutable sur fixture, encore NOT_RUN_BROWSER

Préférer la fixture synthétique pour ne pas modifier un Draft personnel. Le serveur existant se lance depuis la racine avec `PORT=3218`, `PLANNER_C8_BROWSER_OUTPUT=outputs/bar-p2/candidate-browser`, `PLANNER_C8_GLOBAL_CSS=outputs/l4-a1-browser/global.css`, `PLANNER_L1_SPLIT=1`, `PLANNER_BROWSER_TOOLS=C:/Users/AdrienSauvageot/Documents/Codex/p14-c4-tools`, puis `node scripts/serve-phase2-planner-composer-fixture.mjs`.

1. Ouvrir `http://127.0.0.1:3218/?scenario=P09&durable=1&delayRead=800`. Ajouter **Bar / Apéro**, pas Soirée générique. Vérifier cinq choix initiaux, aucun coût/date/trajet admis.
2. Bière → `+` : une tuile ITEM ×2 UNKNOWN, aucun Terminé requis. Cliquer une zone neutre : elle se réduit et reste présente.
3. Réouvrir cette Bière, taper `6,50`, cliquer Cocktail dans le dock. Vérifier le texte conservé dans la garde. Continuer : revenir au même champ ; Enregistrer : garder `6,50` puis ajouter Cocktail UNKNOWN ; Abandonner sur un nouveau RAW : conserver le dernier prix admis.
4. Date → jour → Personnes → trois identités. Vérifier pastilles retenues immédiatement et quantité Bière non multipliée.
5. Ajouter Aller Voiture, puis Retour Taxi. Aucun prix fictif, deux modes et deux sens. Changer le lieu central : les endpoints autonomes restent intacts ; modifier explicitement le départ Taxi pour exercer l'arbitrage P1.
6. Retirer une tuile admise puis Undo du Shell ; mêmes ID/valeurs après restauration. Ne pas Apply. Recharger après vraie confirmation de sauvegarde fixture : reprendre les décisions admises, pas un RAW.
7. Pour le Board dense, ouvrir `/?scenario=L4E_30&durable=1&delayRead=800`, puis la carte Bar déjà présente ; tester tuile, repacking/repli et buffer RAW. Les variantes L4E_5/16/50 existent aussi.
8. Mesurer les largeurs effectives à 1440/1728/1920, fenêtre compacte, zoom natif 125 %, puis autres tailles demandées si utiles. Contrôler rectangles de voisins, scroll document/dock, focus au clavier, confirmation native, retour exact au repli et réduction de mouvement. **Cocher seulement ce qui est réellement exécuté.**

La Preview immuable permet une revue du code buildé ; son Auth/Supabase n'est pas une fixture isolée. Aucun test d'écriture personnelle, même sans Apply, n'est implicitement couvert par la recette locale.

## 8. Réserves et arrêt

- **Réserve visuelle réelle** : aucune géométrie DOM ni capture native ; qualité peinte, focus, zoom, viewport, drag et confirmations restent à recevoir humainement. L'expansion du packer conserve son gabarit historique borné ; une refonte sans preuve DOM n'a pas été entreprise.
- **P3 non commencé** : nouveaux lieux Google, favoris/habitudes, nouvelles sources, prédictions et liaison durable Bar↔endpoints. Les limites propriétaires P1 sont maintenues.
- **P4 non commencé** : 45 contradictions exhaustives, vraie Auth isolée, Before/funding riches et réception finale combinée. Les 19 groupes P2 ne sont pas 45 E2E ni 112 situations certifiées.
- Aucun gain P95 ou gain utilisateur chiffré, aucun nouveau moteur financier, snapshot, cache ou système d'autosave.

**P2 livré pour revue humaine avec limites. #59 et #60 restent Draft, aucune fusion/main/Production. STOP après P2.**
