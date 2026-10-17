# Bar / Apéro P4 — réception intégrée

## État de départ contrôlé

Base main : d6379bcbfdc217ee51c05989f2036407329eb2fd. PR #63 OPEN, DRAFT, merged=false et mergeable=true ; HEAD P3 f637297f5a0d6c69287b75ae83d257ca9c849401. Code P3 70b2fa5 ancêtre vérifié. Branche P4 `codex/bar-apero-p4-integrated-reception` créée depuis le HEAD distant P3 ; la PR sera empilée sur la branche P3. outputs/ préexistant conservé. Aucune autorisation de fusion, Production, mutation personnelle, migration ou Apply.

| État initial | Périmètre / preuve |
|---|---|
| ALREADY_WORKING | Carte exacte Bar, boissons UNKNOWN, RAW/Undo, lieu central distinct des legs, connaissance P3 : suites et rapports P1/P2/P3 existants à rejouer sur SHA P4 |
| FAIL_REPRODUCED | Before enfant présent via writer officiel, mais aucune tuile de bouteille ciblable dans la vraie logique React Bar : `P4_BEFORE_DIRECT_CHILD_TILE_REEDIT` rouge sur base P3 ; `outputs/bar-p4/baseline-red.log` |
| OWNER_GAP | Identité Google durable, promotion Canonical Google, plafond autonome et lieu propre du Before non publiés. Aucun de ces owners ne sera créé en P4 |
| NOT_YET_TESTED | Parcours riches PERSON/SHARED, Before complet, suppression hiérarchique, total/détail, cycle HTTP/CAS, P1–P8 intégrés et géométrie finale |
| NOT_RUN_AUTH_P4 | Aucun canari d’écriture authentifié spécifiquement autorisé pour P4 ; session P2 non réutilisée pour écrire |

Source 45 ADV / 35 oracles extraite de la spécification dans `scripts/fixtures/bar-apero-p4-cases.json`, avec empreinte et texte des critères d’origine. Le tableau ci-dessus décrit l’état initial ; les résultats finaux suivent.

## Livraison et verdict

**`BAR_P4_READY_FOR_HUMAN_UX_REVIEW_WITH_LIMITS`**. Pilote corrigé et prêt pour une revue humaine ; aucune certification universelle ni généralisation aux autres presets.

- Branche : `codex/bar-apero-p4-integrated-reception`.
- PR **Draft #64** : https://github.com/adriensauvageot34/Budgetisation/pull/64 ; base **`codex/bar-apero-p3-real-knowledge`**, filiation #63 conservée. #63 n’a pas été fusionnée.
- Premier commit produit : `48a552f673dfb89262a88a9f7b096fb44f133fea` ; second : `f3591ef93506ba6a2be0135f7a1f90d0e892eb1c` (compte dans la confirmation) ; **final `ccfefe0f4ee06e76c02eeaeb74e824cb587ebacf`** (garde RAW du retrait d’un complément Before).
- Preview exacte du code final : https://budgetisation-g65oaogd8-adriensauvageot34-6137s-projects.vercel.app ; `dpl_BFhCWNBx6xeVnTipFzZE6M8DAL8z`, **READY**, target `null`. Résultat final du build attesté dans `deployment.json` et `vercel-build-product.log`. Dépendances/cache Vercel réutilisés ; pas une installation fraîche ni une certification Production.
- Le commit de réception ajoute uniquement preuves/documentation et leur générateur ; il ne change pas le produit. Vérification attendue : `git diff ccfefe0..HEAD -- src` vide.
- **Aucune fusion/main, promotion Production, migration, mutation personnelle ou fournisseur réel.** La PR reste Draft pour revue.

## Corrections réellement livrées

| Défaut / preuve rouge | Correction minimale | Résultat réellement vérifié |
|---|---|---|
| Before enfant lisible comme lien, bouteille non éditable directement ; `baseline-red.log` sur P3 | `bar-before.ts` projette le `CHILD_CONTEXT` existant et réutilise `EDIT_NIGHT_OUT.before` ; tuiles directes principal/extras | Édition ciblée par sélection, même child/link ID ; autres slots et champs conservés ; PASS React et navigateur fixture |
| Parcours Before obligatoirement détaillé malgré le writer disponible | Choix Before dans Autre/Boissons, catalogue existant `house_party`, sans reprendre ses prix par défaut | Principal SHARED UNKNOWN, extras ITEM UNKNOWN ; prix saisis explicitement ; aucun lieu propre inventé |
| Retrait d’un groupe ne doit pas être confondu avec un poste | Confirmation dédiée, compte des composants visibles et mention des éventuels trajets liés ; principal non supprimable seul à cause de la cardinalité propriétaire | Annulation intacte, retrait du groupe, Undo/Redo réel et restauration des IDs ; descendant protégé refusé par l’owner |
| Confirmation devenue ancienne si un enfant/protection change | Snapshot du Semantic Draft au déclenchement ; confirmation refusée s’il a changé | Enfant modifié entre ouverture/acceptation : aucune mutation tardive ; RAW conservé sur rejet |
| Bouteille SHARED non accessible dans le dock court | Entrée explicite utilisant le composant existant, sans prix ni asset fictif | Coût de lot non multiplié par les invités ; PERSON reste dans l’éditeur d’unité publié |
| Nouvelle entrée SHARED risquant de contourner total/détail | Même arbitrage local que les boissons : remplacer le global, ajouter un poste indépendant ou annuler | Test ciblé : total30 intact tant qu’aucun choix ; annulation intacte ; remplacement retire main ; jamais de46 implicite |
| Retrait d’un complément Before en cours de saisie sans garde RAW | Même confirmation de retrait que les consommations du bar ; aucune suppression avant consentement | Nouveau test rouge conservé `before-extra-raw-red.log`, puis vert : Draft intact, Continuer conserve9, retrait confirmé enlève uniquement la sélection ciblée |

**Deux fichiers produit** : `src/app/mois-a-venir/composer/bar-before.ts` et `bar-living-editor.tsx`. Aucun changement du Compiler, Finance V2, pricing Mobility, C0, SNAP-3, endpoints serveur, contrats persistés, schéma ou droits.

La seule assertion P2 adaptée concerne la structure du rendu Before : quatre sections toujours présentes, comparées sans imposer l’ancien ordre DOM ; assertion supplémentaire d’une tuile enfant directement éditable. Les vérifications de conservation des autres slots n’ont pas été retirées. L’échec initial est conservé dans `check-bar-apero-p2.log`. Aucun golden financier modifié.

### Échecs conservés et résolution

- `baseline-red.log` : vrai défaut produit de la tuile Before sur P3, corrigé.
- `initial-rich-failures.json`, `p4-initial-rich.log` : essais initiaux incluant attentes de harness incorrectes (asset inexistant, libellé vs aria-label, contexte supposé à l’index1, validation de date attendue au mauvais niveau). Corrigés sur le contrat réel, sans changer les propriétaires pour satisfaire le test.
- `postcommit-confirmation-assertion-failure.log` : l’élargissement du message de retrait avait supprimé le compte attendu. Le second commit rétablit le nombre tout en annonçant les trajets liés ; test final vert.
- `before-extra-raw-red.log` : défaut réellement reproduit sur le nouveau chemin Before-extras ; le troisième commit partage son garde avec le retrait parent. Il ne change ni coût ni contrat.
- HTTP : réponse503 volontairement non JSON après commit. Le client de test lit d’abord le statut puis la relecture durable ; il ne prend pas cette réponse pour une preuve d’absence de commit.
- Navigateur : erreurs de sélecteur dues aux descriptions accessibles, puis ambiguïté entre bouton du groupe et bouton de dialogue ; résolues par observation/scoping du dialogue. Un timeout d’outil Undo a été suivi d’une lecture avant nouvelle action ; aucun double Undo aveugle.

## Finance et conservation : exemples officiels

Source exclusive des chiffres : `handleComposerRequest` → Compiler/Finance V2 → `nightOutSummaries`. `states.json` conserve les états, UUID et digests exacts ; aucune somme financière nouvelle en React.

| État de preuve | Montant connu officiel | Garanties |
|---|---:|---|
| `rich-before` | 39.00 | Bouteille26, Diluant4, Snack3, Bière au bar6 ; child/link/bottle ID stables lors de la réédition ; date/lieu non inventés |
| `same-product-independent` | 79.00 | Même produit retenu explicitement au bar40 avec une autre sélection ; aucun merge économique par assetKey ; parent non additif |
| `item-person-shared` | 69.00 | ITEM12, PERSON32, SHARED25 ; six présents ne remplacent pas les deux personnes tarifées ; quantités/provenance explicites |
| `manual-zero` | 69.00 | Une autre Bière à zéro explicitement MANUAL n’ajoute rien ; zéro conservé distinct d’UNKNOWN |
| `covered-total` puis `details-undo` | 30.00 puis16.00 | Remplacement confirmé, aucun46 ; annulation et Undo exacts |
| `funding-invalid` puis `funding-repaired` | 8.00 dans les deux | Allocation12 ne réécrit pas le coût8 ; diagnostic officiel bloquant, réparation locale à8 ; pas de troncature silencieuse |
| `rich-before-applied-reloaded` | 79.00 | Un Apply **PGlite synthétique isolé**, PlanRevision intégralement relue, mêmes relations/IDs/digest ; canaris vérifiés |
| HTTP Before partiel | 38.00 +incomplet | Bouteille26, Diluant4, Bière8, Snack UNKNOWN ; quatre sauvegardes admises, pas d’Apply, aucune écriture distante |
| Navigateur riche après RAW/Undo/Reload | 39.00 +coûts à préciser | Bouteille26, Diluant4, Snack3, Bière6 ; version14 et digest identiques avant/après Reload sur la fixture durable simulée |

Le test nommé `...MON_PLAN_SAME_IDS` démontre la conservation dans les données **officiellement persistées** et leur READ/repository ; il ne constitue pas une capture de l’écran Mon Plan authentifié. Le lecteur Mon Plan n’a pas été modifié. Son rendu P4 authentifié reste non certifié.

## Réception par couche

| Contrôle | Résultat / limite |
|---|---|
| `node scripts/check-bar-apero-p4.mjs` | **14 groupes PASS**, React + Compiler/PGlite ; résultat `results.json`, snapshots `states.json` |
| `node scripts/check-bar-apero-p4-http.mjs` | **7 assertions de scénario PASS**, HTTP réel loopback, CAS, réponse perdue/replay, relecture et conservation ; `NOT_RUN_AUTH_P4` |
| P1 | 25 groupes PASS ; navigation directe, endpoints, tarifs, financement et RAW/Undo |
| P2 | 20 groupes PASS après adaptation de structure explicitée ; densité, panneaux, protections et autres presets |
| P3 | 12 groupes PASS ; connaissances et Google simulé, portée, mutations indépendantes, round-trip |
| V8 | 16 groupes PASS |
| Mobility Bar | 6 groupes PASS ; deux legs, changement de mode, panne synthétique et Apply/Reload isolé |
| L4-A | 19 contrôles PASS ; aucun owner supplémentaire |
| Catalogue | 47 presets création/édition/sérialisation/relecture PASS sur PGlite |
| Parité financière historique | **22 scénarios ×9 empreintes =198/198 PASS**, goldens inchangés |
| C8-017 | Assertion originale PASS |
| TypeScript | `node node_modules/typescript/bin/tsc --noEmit`, exit0 ; wrapper `npx.ps1` refusé par la politique locale, aucune politique système modifiée |
| Build | Build Next complet Vercel **READY sur ccfefe0**, état final dans `deployment.json`, pas seulement compilation fixture |
| Auth/RLS P4 | **NOT_RUN_AUTH_P4** : pas de nouveau canari d’écriture Supabase autorisé dans cette mission ; preuve P2 non réutilisée |
| Fournisseurs réels | **NOT_RUN_PROVIDER** : Google/TomTom/etc. simulés, aucun prix ou itinéraire réel certifié |

Campagne finale exécutée sur le SHA produit **ccfefe0** : **12 commandes,12 codes de sortie0**, y compris TypeScript et le scénario HTTP. `final-gates.json` donne commandes, SHA, exits et journaux ; `github-checks.json` atteste le statut Vercel GitHub success. Les anciens logs restent les preuves des premières exécutions ; ils ne sont pas remplacés par des PASS supposés.

## Navigateur réel : portée exacte

Uniquement navigateur **intégré Codex**, URL `http://127.0.0.1:3221/?scenario=BAR_P3&durable=1&delayRead=1200`. Bundle minifié de production esbuild, serveur Compiler/PGlite et sauvegarde simulée ; **pas un navigateur Next/Supabase authentifié**. Aucun recours au navigateur Windows personnel.

Parcours exécuté : Library Bar exact → Before Vodka25/Diluant4/Snack3 → Bière6 → Vodka RAW26 → Date/Continuer → Date/Enregistrer26 → confirmation de groupe annulée puis acceptée → Undo → Redo → Undo → Reload réel. Les quatre identités composantes et les deux contextes sont conservés après rechargement ; version14, digest `18fca8e71223a45db79b9e4318a385285bf2dc82472dbaacfd6153e66b7bab61`. `browser-after-reload.json` compare l’état durable intégral, pas seulement les libellés.

Largeurs **effectivement mesurées** et rectangles stabilisés :1440×900,1728×900,1920×1080,1152×720. Pour le Before riche observé : débordement horizontal du document0 ; chevauchements des éléments de grille0. `geometry.json` et captures non recadrées. Densité8/15 et Soirée générique : preuves React/layout, pas une nouvelle campagne navigateur exhaustive.

Les premières captures et la géométrie proviennent du premier commit produit **48a552f**. Le diff vers **f3591ef** dans `browser-final-label-diff.patch` ne change que le message compté. Le diff supplémentaire **f3591ef→ccfefe0** ajoute le garde RAW du retrait Before-extra ; il n’est **pas** considéré testé par ces anciennes captures. Retest ciblé du code final : **PASS_REACT**, mais **NOT_RUN_BROWSER_FINAL_RAW**. Au moment du retest, le navigateur a répondu « Local browser use is disabled in Work settings ». Aucun contournement ni autre navigateur utilisé. Le fichier `final-browser-setup.json` atteste uniquement un setup HTTP synthétique, pas un test UI réussi. Aucun changement CSS/layout/owner financier n’est intervenu.

Protocole manuel ciblé sur la Preview finale, après authentification autorisée : Bar → Autre → Before → Vodka → saisir25 et enregistrer → Diluant → saisir4 et enregistrer → réouvrir sa tuile → saisir9 sans enregistrer → Retirer. Attendu : dialogue de retrait, coût4 toujours conservé avant consentement ; Continuer restitue RAW9 ; Retirer confirmé enlève uniquement le Diluant, puis Undo restitue son ID et sa dernière valeur admise4. Aucun Apply nécessaire. Ne pas exécuter ce protocole sur un Draft personnel sans autorisation explicite.

**NOT_RUN_NATIVE_DRAG**, circuit clavier complet non certifié, **NOT_RUN_ZOOM125**, **NOT_RUN_NATIVE_MOBILE**, reduced-motion natif non instrumenté, P95 non mesuré. Desktop prioritaire conformément au produit. Focus du champ RAW restauré après Continuer, puis destination Date reprise après admission ; cela ne certifie pas tous les parcours clavier.

## Les huit parcours et les80 critères

- `evidence/bar-apero-p4/journeys-p1-p8.md` : huit parcours, résultats partiels/verts à leurs niveaux, étapes observées et chiffres officiels. Les parcours riches Before+legs et courses réseau simultanées ne sont pas déclarés E2E complets.
- `acceptance-matrix.json` : **45 ADV +35 O exactement**, critères sources conservés, preuve nommée par ligne, ce qui manque explicite. **49 PASS au niveau annoncé,24 PARTIAL,4 BLOCKED_OWNER,1 FUTURE_CAPABILITY,2 NOT_RUN_AUTH_P4**. Ce ne sont pas80 tests exécutés ni80 PASS.
- `scripts/build-bar-apero-p4-reception.mjs` reconstruit l’index et vérifie que chaque assertion citée est réellement PASS dans son journal ; il ne transforme pas une classification en exécution.

## Limites métier subsistantes

| Capacité / cas | Limite réelle et parcours utile |
|---|---|
| Google durable | Owner d’identité/admission Canonical non publié ; pas de faux KNOWN, TEXT explicite/Plus tard conservés ; ADV04 bloqué au niveau capacité |
| Lieu propre du Before | `NightOutBeforeEdit` ne publie pas de lieu autonome ; composition et prix utiles possibles, aucun champ temporaire caché |
| Plafond/enveloppe autonome | Aucun contrat pour « maximum40 » ; coût économique prévu explicitement nommé, ne pas saisir un plafond comme dépense ; ADV21/O08 BLOCKED_OWNER |
| Couverture universelle global+détails PERSON | Pas de binding publié prouvant cette relation pour tous les postes ; remplacement/addition indépendante explicite/annulation seulement ; ADV40 BLOCKED_OWNER |
| Bar→endpoint durable | Aucun lien inféré par égalité de texte ou d’ID ; les legs restent autonomes, prix d’un endpoint réellement modifié requalifié via arbitre P1 |
| Quote datée réelle | Conservation des quotes non ciblées et réponse D1/D2 vérifiées ; compatibilité fournisseur après changement de date non certifiée (ADV14/O14 PARTIAL), aucun prix présenté comme réellement validé ici |
| Financement partagé nominatif / Wallet | Pas d’owner ajouté ; seules allocations admissibles existantes ; incohérences bloquées par Compiler |
| Auth et courses réseau intégrées | HTTP loopback complet, RAW/Undo navigateur partiel ; aucun nouveau test RLS/JWT ni scénario simultané Back/reload/Undo annoncé PASS |

Ces limites empêchent de déclarer « Bar référence universellement certifiée ». Elles ne cachent aucun défaut critique de duplication/perte reproduit et laissé ouvert dans les parcours corrigés. L’acceptation de l’UX et des limites appartient à l’utilisateur.

## Périmètre, données, rollback et arrêt

Les fixtures consomment le vrai Compiler/Finance V2 et le repository PGlite ; aucun lecteur World additionnel par tuile, moteur React, taxe/fuelPaid inventé, état Google persistant ou worker nouveau. Les seuls Plans créés sont synthétiques dans PGlite pour la réception autorisée. HTTP/navigateur : zéro Apply, zéro écriture distante ; canaris historiques préservés.

Rollback avant intégration : retirer les trois commits produit P4 de la branche de revue ou les revert ; P3 reste la base. Pas de schéma/donnée à restaurer, pas de suppression de Draft. Preuves et archives conservées. Aucune fusion ni Production effectuée ; PR #64 reste Draft.

**Voici exactement ce que Bar / Apéro permet, les huit parcours et les80 entrées de réception classifiées (45 scénarios adversariaux et35 oracles), les garanties financières confirmées, les limitations réellement subsistantes et les preuves sur le SHA livré.** Arrêt après P4 pour décision produit ; aucun autre preset généralisé.
