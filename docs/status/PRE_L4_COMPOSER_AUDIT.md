# A0 — Stabilisation Composer V3 avant L4

16 octobre 2026. **Audit terminé, corrections non commencées. Application desktop uniquement.**

## 1. Conclusion opérationnelle

**Quatre causes de défaut confirmées**, regroupant huit pistes AV :

| Cause | Sévérité | Conclusion prouvée | Lot |
|---|---|---|---|
| D01 — Saisie brute et action officielle | HIGH | Après Courses250 sauvegardé et FRESH, texte300 non validé : SAVED/FRESH restent affichés et Apply reste disponible pour l’ancien250. Aucun Apply déclenché pour cette observation. | C1-01 |
| D04 — Admission différente selon chemin | HIGH | Restaurants publie max9999 ; validation MUTATE refuse10000, mais matérialisation Compiler et READ d’un Draft entier acceptent10000. Pas de preuve de contournement Savings/floor, pas de commit officiel de ce cas. | C1-02 |
| D02 — Référence affichée comme décision | MEDIUM | Vêtements sans `decisionValue` : carte « À définir », mais inspecteur « Choix de ce mois0,00€ ». Même helper dans À piloter ; références des habitudes aussi qualifiées comme choix. | C2-01 |
| D03 — Compteur inconnu et boutons | MEDIUM | Dans le groupe Food, texte170,29px dans bouton124,40px ; débordement de42,89px au-delà du bord gauche de+ au focus. Pas de scroll horizontal global, mais action/valeur se recouvrent. | C2-02 |

**Aucun BLOCKER de corruption financière ou de fuite de données démontré.** Aucun choix confirmé perdu dans les parcours contrôlés. Cela ne clôt pas les cycles authentifiés nouveaux ni les gestes natifs non exécutés.

Ne pas lancer une refonte générale. Fermer C1, corriger D02/D03 en C2, puis exécuter C3 sur le code corrigé. Les conforts et nouvelles capacités ne sont pas des préconditions supplémentaires.

## 2. Baseline réellement redécouverte

- Dépôt : `adriensauvageot34/Budgetisation` ; worktree `C:/Users/AdrienSauvageot/Documents/Codex/p14-a2-a3-performance`.
- HEAD initial propre : `b38161b31c0df6a25c71c8ab2dcc58489b79c936`, branche L3.3 ; contient la clôture documentaire locale.
- `git fetch origin main` : **main reste `5cfb1211d114ddaa574f63372cdb9c4cfc7e660d`**, PR#49. Aucun changement produit postérieur observé.
- Diff HEAD initial/main : cinq fichiers de clôture documentaire seulement ; `git diff --exit-code 5cfb121 -- src public supabase package.json package-lock.json next.config.ts` :0.
- Branche d’audit : `codex/composer-v3-pre-l4-audit`, issue de ce HEAD, sans retrait des preuves locales.
- Alias officiel `budgetisation-tan.vercel.app` interrogé via Vercel : **Production READY `dpl_HH6XbfcrYSbgC8eJboEi5vTE7Jxw`**, SHA `5cfb121…` ; précédent déploiement `b777374…`, PR#48. Aucun déploiement A0.
- Session authentifiée existante en lecture seule : Board présent, même digest technique que le smoke L3.3, révision0, CLEAN, Preview BLOCKED. Ce mois incomplet n’est pas une preuve FRESH ni un cycle Auth avec Plan. Aucun identifiant de connexion ou montant personnel collecté dans les preuves A0.
- Huit sources UI critiques du sourcemap du bundle testé correspondent au code produit actuel (seuls les retours CRLF/LF sont normalisés). Voir `fixture-bundle-identity.json`. React production minifié ; ce host esbuild ne prouve pas la couche Auth/Next/Supabase.

Preuves : [baseline](evidence/pre-l4-audit/baseline.json), [empreintes produit](evidence/pre-l4-audit/product-fingerprints.json), [identité du bundle](evidence/pre-l4-audit/fixture-bundle-identity.json), [revue source](evidence/pre-l4-audit/source-review.json).

## 3. Registre original AV-01…128

Le registre n’était pas présent dans le dépôt. L’utilisateur a ensuite fourni **`Texte collé(20261016-134504).txt`**, « Budgetisation — Grand bilan avant L4 ». Les128 identifiants uniques sont extraits et vérifiés, sans reconstruction ni renumérotation. SHA256 des octets source : `0fcc8294cdd46c9e7f723e189f9c2d03a683b4fefea52fd0701fef48bf49a534`.

Le bilan est une source de pistes et de recommandations ; ses conclusions ne deviennent pas des résultats de tests. La [matrice exhaustive AV](evidence/pre-l4-audit/AV_01_128_COVERAGE.md) et son [JSON](evidence/pre-l4-audit/av-coverage.json) conservent texte original, ligne source, statut, preuve, limite, risque, sévérité, lot et ticket.

| Classe | Pistes |
|---|---:|
| ALREADY_CORRECT_WITH_EVIDENCE | 57 |
| CONFIRMED_DEFECT | 8 — quatre causes communes |
| PARTIAL_OR_LIMITED | 33 |
| NOT_TESTED | 9 |
| USEFUL_IMPROVEMENT_NOT_DEFECT | 14 |
| OUT_OF_SCOPE_OR_DEFERRED | 7 |
| **Total** | **128** |

Ce sont128 **classifications**, pas128 tests nouvellement exécutés. Un PASS hérité indique explicitement le rapport et l’environnement d’origine. Les preuves techniques sont référencées E00…E15 dans la matrice.

## 4. Vérifications nouvelles et parcours obligatoires

### Services, contrats, Compiler et Plan officiel isolé

Sept contrôles ont passé avec les vrais services/Compiler/Finance et PGlite, réseau interdit :

- Courses250→300 : remplacement du même contrôle, jamais addition250+300.
- Café12×1,80→12×2,10→zéro→restauration ; coût officiel21,60/25,20/0 ; prix2,10 conservé pendant count0. Zéro avec prix UNKNOWN : coût0, prix reste inconnu.
- Count seul : ne stocke pas le prix historique ; prix ensuite modifié conserve le count13.
- Vêtements sans décision : « À définir » ; zéro volontaire : décision0,00 et rendu « Prévu ».
- Même mois cible avec `asOfDate` avant puis pendant le mois : montant entier/digest stables. Ce test synthétique ne crée pas d’observations réelles ; la contrainte de réconciliation observée reste intacte.
- Reprise OFFER_PREFILL sans mutation ni remplacement d’un contrôle explicite.
- Apply/Reload **uniquement PGlite** : une PlanRevision immuable réelle dans le PostgreSQL synthétique, identité/count/prix conservés, canaris historiques intacts.

[Résultats](evidence/pre-l4-audit/targeted-contracts.json). Le processus initial finit exit1 **après les sept PASS**, lors de la collecte d’empreintes par `spawnSync git` refusé EPERM. La collecte a été remplacée par une lecture de fichiers sans processus enfant, exécutée seule exit0 (`fingerprints.log`). Les sept tests n’ont pas été relancés inutilement. Aucun PASS n’est attribué au code de sortie initial global.

Le contrôle séparé D04 est **un défaut reproduit**, pas un test de parité PASS : max9999 côté capability/MUTATE, count10000 accepté par `materializePlanSlots` et le vrai `handleComposerRequest READ`, repository de lecture synthétique sans writer. [Preuve complète](evidence/pre-l4-audit/admission-boundary.json).

### Navigateur réel React production, données exclusivement synthétiques

- Confirmation refusée : groupe et texte5 conservés, digest stable ; Détails refusé n’ouvre pas l’inspecteur. Confirmation acceptée : texte6 abandonné, groupe fermé sans mutation.
- **Limite explicite** : `window.confirm` retourne false/true dans le host d’audit uniquement. Cela vérifie le chemin React et le garde, **pas la fenêtre native**. Aucun mécanisme de production ou protection d’accès n’a été désactivé. Éditer lu au code ; tous les chemins et le drag natif restent à vérifier dans C1/C3.
- Saisie invalide2,345 : erreur proche, aucun zéro ; correction300 admise. Tab/Escape et normalisation complète restent aussi couverts par L3.3.
- Saisie Jeux88,80 préservée lors d’ouverture inspecteur et resize1728→1440 ; Maison55,50 préservée sur Board40 éléments après inspecteur. Aucune perte démontrée dans ces cas. Le pinning de page n’est pas une garantie universelle si une carte change de parent React : hypothèse à éprouver, pas défaut déclaré.
- D01 et D03 reproduits ; voir captures ci-dessous. D02 recoupé en SSR réel et DOM navigateur.
- Refus de reprise : proposition fermée et digest identique, aucune adoption.
- Preview seq2 en503 : **FAILED + SAVED**, Apply désactivé ; nouvelle édition seq4 : **FRESH + SAVED**. Réponse SAVE perdue après commit : relecture par requestId par le transport de fixture, une seule version créée. Ce transport synthétique n’est pas la route Draft HTTP authentifiée.
- Sauvegarde503 avant commit : **FRESH + ERROR**, montant275 présent localement, Apply désactivé, « Réessayer la sauvegarde » présent dans Options. Aucune version durable créée. Reprise après rétablissement de ce503 persistant : **NOT_RUN** dans cette fixture ; garanties service/HTTP héritées distinctes.
- Board dense : page2 puis « Voir Maison petit · page1 » rétablit active0 et la même identité focused. Zéro erreur console relevée sur ce parcours dense.

[Preuves navigateur](evidence/pre-l4-audit/browser-checks.json), [reprise Preview/SAVE](evidence/pre-l4-audit/preview-save-recovery-server.json), [erreur SAVE](evidence/pre-l4-audit/save-error-server.json).

| Parcours demandé | Résultat exact |
|---|---|
| 1. Courses250→300 | PASS services et navigateur fixture |
| 2. Café12×1,80→2,10→0→restauration | PASS services PGlite ; interactions/reload hérités L3.3 |
| 3. Coiffeur1, prix UNKNOWN | Rendu navigateur observé ; contrat hérité L3.3, prix non inventé |
| 4. Vêtements absent puis0 volontaire | PASS services/rendu SSR ; contradiction inspecteur D02 confirmée |
| 5. Sacs-poubelle4 couvert/extra | Preuves L3.3 services et navigateur réutilisées ; pas de faux nouveau cycle Auth |
| 6. Charge fixe détachée/rattachée | Preuve digest identique L3.3 ; A0 relit la projection et le stockage local sans nouveau test financier |
| 7. Page2 / groupe | PASS navigation dense et groupe Food ; drag natif NOT_RUN |
| 8. Reprise partielle | PASS L3.3 + non-écrasement services A0 ; refus navigateur A0 PASS |
| 9. Saisie sale, refus fermeture | PASS du chemin React avec stub ; vraie confirmation native NOT_RUN |
| 10. Erreurs Preview et sauvegarde | États indépendants, Apply protégé ; reprise Preview/perte-réponse SAVE PASS fixture ; reprise503SAVE persistant NOT_RUN |
| 11. Plan actif | PASS PGlite ; aucun Plan personnel créé, cycle JWT+Plan NOT_RUN |
| 12. Courant/futur | PASS borné asOf synthétique ; vrai corpus observé et JWT NOT_RUN |

### Surface et ressources

| Dimensions DOM effectivement mesurées | Éléments | Pages | DOM | Images montées | Overflow global |
|---|---:|---:|---:|---:|---|
| 1440×900 | 40 | 4 | 2573 | 6 | non |
| 1728×900 | 40 | 3 | 3637 | 6 | non |
| 1920×1080 | 40 | 2 | 4287 | 6 | non |

Même fixture, même mois, même code ; les comptes DOM varient avec les pages voisines montées par P4A. Ce ne sont pas des mesures de consommation mémoire ni des gains de latence. Les mesures sont des états après gestes ; pas un protocole de benchmark avant/après. Le Board dense a exécuté **un READ métier initial seulement** pendant ces actions purement visuelles (`dense-server.json`),0Apply,0Plan,0révision,0écriture distante. Six images ne signifie pas six requêtes réseau nouvelles ; pas de compteur GET Supabase inféré.

Le bundle fixture mesure348490octets, hors chunks/CSS ; ce n’est pas le bundle Next Production. Aucune modification produit A0, donc aucun gain JS revendiqué. Aucun double-rAF/P95 IAB utilisé. Pas de nouvelle lecture World/SQL ou campagne P14/SNAP.

La bibliothèque actuelle n’a pas de contrôle pour la replier : son titre focalise la recherche. « Bibliothèque fermée » est donc **non applicable comme état existant**, pas une fonctionnalité cassée. Une nouvelle fermeture serait une amélioration optionnelle C2, pas une régression à réparer automatiquement.

Captures réelles pertinentes : [saisie et Apply](evidence/pre-l4-audit/apply-during-raw-edit.jpg), [compteur et+](evidence/pre-l4-audit/count-unknown-overlap.jpg), [garde groupe](evidence/pre-l4-audit/group-refusal-fixture.jpg), [Board dense avec inspecteur](evidence/pre-l4-audit/dense-inspector-1440.jpg), [erreur de sauvegarde](evidence/pre-l4-audit/save-error.jpg). Les captures IAB peuvent être limitées au panneau ; seules les dimensions DOM sont utilisées pour les trois viewports. Aucune capture de finances personnelles.

## 5. Registre des défauts et trois backlogs fermés

Chaque ligne ci-dessous est un ticket avec conséquence, source, fichiers, correction minimale, réception et risque. **Ce sont des propositions, aucune correction A0.** Les57 pistes déjà correctes ne deviennent pas57 tickets.

### C1 — Intégrité, admission et sauvegarde

**C1-01 — HIGH — Rendre explicite la saisie non admise et protéger les transitions.**

- Reproduction : D01, `browser-checks.json/A0-D01` et capture ; la saisie300 n’est pas la décision250 appliquable. Le garde de fermeture groupe fonctionne avec confirm stub, mais n’est pas global.
- Conséquence : appliquer ou quitter en pensant que le texte affiché est déjà une décision. Pas de corruption prouvée ; `beforeunload` se base sur `durable.unsaved`/Draft sémantique, pas sur la saisie inline brute.
- Fichiers : `inline-control-value.tsx:18–75`, `composer-shell.tsx:183,217,570,582`, `composer-board.tsx:65`, `board-carousel.tsx:24–41`, `visual-cluster.tsx`.
- Correction minimale : exposer l’état local de saisie/réglage aux transitions qui peuvent l’abandonner et à Apply ; conserver le texte ou demander un abandon explicite. Distinguer « brouillon sauvegardé » de « saisie non validée ». Réutiliser l’état/les callbacks existants ; aucun nouveau Draft économique, stockage local sensible ou moteur de calcul.
- Réception : 250SAVED→raw300 : aucune application ambiguë ; Enter puis Preview/SAVE admis ; Escape, Tab, refus/acceptation, Détails/Éditer/sélection, page et drag. Rejeter la fermeture garde le texte ; accepter n’incrémente pas le digest. Rafales +/- et Undo restent cohérents ; tester départ pendant le délai350ms. Pas de mutation au hover.
- Risque : désactiver à tort les gestes pendant une Preview, flusher implicitement un prix historique ou perdre un pending lors du démontage. **Ne pas déclarer une perte universelle : elle n’est pas reproduite.**

**C1-02 — HIGH — Unifier l’admission des nouvelles décisions sur les chemins MUTATE et Draft entier.**

- Reproduction D04 : `admission-boundary.json`, Restaurants10000. Source `control-fields.ts:20`, `control-input.ts:27–34`, `plan-slot-resolver.ts:39–45` ; `composer-service.ts:245` valide MUTATE, READ utilise directement la compilation du Draft.
- Conséquence : une même nouvelle valeur reçoit deux admissions différentes ; les futurs éditeurs ne doivent pas pouvoir choisir accidentellement le chemin permissif.
- Correction minimale : placer les contraintes communes de nouvelles décisions au bon owner serveur et les faire appliquer sur READ/Preview/Apply, sans recopier la doctrine dans React et sans ajouter de lecteur World. Conserver restrictions par famille, zéro, UNKNOWN, overrides et immuabilité.
- Réception :9999/10000, fraction, zéro/floor, prix autorisé/interdit et scope sur les deux chemins ; mêmes erreurs/admissions, parité22×9 et historique. Différencier validation d’une **nouvelle mutation** et lecture d’une ancienne révision : ne pas rendre une PlanRevision historique illisible, ni tronquer ses valeurs.
- Risque : bornes nouvellement durcies incompatibles avec d’anciennes décisions ; aucune migration ni remise à zéro implicite. Une dérogation historique exige une politique explicite, pas un bypass général.

**C1-03 — HIGH, gate de preuve — Compléter le cycle authentifié L3.3 ciblé.**

- Manque : AV13–18/21, nouveaux count/prix sauvegardés via vrai JWT, reload puis changement count seul ; E04/E05 sont synthétiques. Auth Draft A→B de P14 reste un acquis, pas une certification automatique de L3.3.
- Fichiers à réutiliser : `draft-http-transport.ts`, `durable-draft.ts`, route `/api/composer/drafts`, `composer-draft-service.ts`, migrations Draft déjà versionnées, `runtime.ts`, `context-selections.ts`.
- Travail minimal : utiliser un compte/périmètre de test autorisé et admis ; aucune réactivation des comptes F0, modification de marqueur ou écriture personnelle ne découle automatiquement d’A0. Tester count/prix→SAVED→reload→count seul→Undo/Redo, conflit entre sessions et réponse perdue, puis archive récupérable ;0Apply personnel.
- Sécurité : auteur/foyer dérivés côté serveur, origine/contrat/no-store, refus session/foyer/référence étrangère, aucun DML direct. Réutiliser les tests F0/P14 existants ; ne pas refaire B0/M0/F0.
- Réception : identités/prix/digest exacts, pas de double version après réponse perdue, aucun Plan ou owner financier modifié ; état SAVED/ERROR/CONFLICT honnête. Si aucun compte admissible, NOT_RUN avec gate explicite, pas PASS PGlite renommé Auth.
- Risque : toucher le Draft personnel ou activer largement des accès pour tester. Le lot doit obtenir l’accès précis nécessaire, pas créer un nouveau programme d’infrastructure.

### C2 — Lisibilité et gestes principaux

**C2-01 — MEDIUM — Référence, décision et zéro cohérents sur toutes les surfaces.**

- Reproduction D02, rendu `inspector-undecided.html` et DOM : `controlAccessLabel` retourne « Choix de ce mois » pour toute capability disponible, même `decisionValue=null`. Inspecteur prend `value.amount=0` ; À piloter affiche mieux « Enveloppe à définir » mais conserve le motif « Choix ».
- Fichiers : `control-input.ts:37–41`, `composer-financial-inspector.tsx:23–46`, `composer-library.tsx:82–100`, `composer-card.tsx`, `inline-control-value.tsx`.
- Correction minimale : la capability explique l’accès, `decisionValue` explique la décision, `referenceValue` explique le repère. Zéro non décidé, zéro volontaire et UNKNOWN distincts. Qualifier aussi le prix de référence si seul le count est choisi. Même coût Compiler, aucune formule nouvelle.
- Réception : Vêtements/Maison/Jeux sans décision puis0explicite ; Café count explicite/prix historique puis prix explicite ; carte/Àpiloter/inspecteur d’accord. Aucun texte qui transforme REFERENCE_ONLY en choix.
- Risque : cacher un montant fiable ou remplacer une référence utile par UNKNOWN ; ne pas corriger seulement la couleur.

**C2-02 — MEDIUM — Géométrie de l’édition, des libellés inconnus et des groupes.**

- Reproduction D03 : `count-unknown-overlap.jpg` + rectangles navigateur. White-space nowrap du compteur et boutons24px n’ont plus la largeur nécessaire ; le contrôle d’overflow global ne le détecte pas.
- Fichiers : `composer.module.css:827–873`, `inline-control-value.tsx`, `composer-card.tsx`, `visual-cluster.tsx`, géométrie `presentation/adapter.ts`/`inventory-layout.ts` si nécessaire.
- Correction minimale : layout intrinsèque/wrapping ou libellé court accessible, actions lisibles au focus/hover. Vérifier texte d’erreur et taille du formulaire dans sa cellule ; l’essai de géométrie A0 n’a pas prouvé de chevauchement carte/cellule, il ne faut pas l’inventer. Conserver la modale compacte, ne pas réécrire le Board.
- Réception : les trois desktops effectifs, compteur connu/inconnu, longs titres, erreur de saisie, Library/inspecteur/palette,1/2pages et40objets ; aucun bouton recouvrant le texte. Clavier et focus fonctionnels, C8-017/R6 respectés.
- Risque : agrandir les cartes et recréer la pagination excessive ; inclure les surfaces denses dans la réception, pas seulement une capture vide.

**C2-03 — LOW, optionnel — Quelques précisions de copie et de portée.**

- Constat sans bug financier : le résumé achat dit « Consomme l’enveloppe retenue » sans nom ; dispositions fixes locales peu annoncées ; certains owners techniques restent en détail.
- Fichiers : `context-card.tsx:36–80`, `fixed-charges.tsx`, `composer-board.tsx:44`, `card-knowledge-panel.tsx`, recherche bibliothèque seulement si besoin démontré.
- Proposition : nommer l’enveloppe **uniquement si son identité est déjà publiée**, préciser la portée locale des dispositions ; simplifier le vocabulaire sans masquer période/couverture/source. Si le modèle ne fournit pas le nom fiable, garder le libellé honnête et reporter.
- Réception : aucune requête/Preview supplémentaire ; détachement factKey/digest inchangé ; achat couvert/extra encore juste. Pas de bibliothèque repliable, nouveau lecteur de dernier mois ou synchronisation cross-device imposés.
- Risque : nouvelle lecture ou inférence de binding pour satisfaire une étiquette. Ce ticket ne bloque pas L4 à lui seul.

### C3 — Consolidation et préparation technique

**C3-01 — Gate — Contrôler le delta corrigé et préserver la baseline.**

- Pas de nouveau défaut à inventer : les15 suites L3.3 sont PASS dans leurs environnements. `test-baseline.json` donne les scripts, preuves et SHA de golden à conserver.
- Rejouer seulement les contrôles affectés pendant C1/C2, puis la sélection critique en clôture : conservation, Kernel/Savings/Renewal, Draft HTTP/CAS, scheduler hors ordre, P13, parité22×9, L3.2/catalogue et géométrie C8/R6. TypeScript et build Next normal du candidat final.
- Toute variation financière/identitaire inexpliquée bloque ; aucun golden ajusté pour absorber un bug. Le build webpack local préexistant n’est pas un faux FAIL produit, mais un build complet normal doit passer avant livraison.
- Risque : vieux gardes visuels trop larges ou golden modifié sans justification. La nouvelle borne d’admission ne doit pas effacer l’historique.

**C3-02 — Gate ciblé — Fermer les réserves de gestes et de surface.**

- Sources : AV4/5/38/125 ; confirm native et drag continu non certifiés. Réception : vrai refus/acceptation, enfant de groupe, drag pendant saisie/délai+/−, passage de page, focus et palette, trois desktops.
- Réutiliser la fixture isolée ; si le navigateur autorisé ne sait pas maintenir le geste/dialogue, donner un protocole manuel de trois gestes (refus, acceptation, déplacement). Ne pas injecter d’événements puis annoncer un drag natif PASS.
- Aucun P95 global requis ; une observation humaine de compréhension des cinq gestes peut compléter sans nouvelle télémétrie. Risque : fausse certification d’outil, pas motif d’architecture nouvelle.

**C3-03 — Contrats L4 et rollback compatible, papier uniquement.**

- Livrable : matrice ci-dessous + versions/champs E07, gates création/reload/réédition et politique de réponses incompatibles. Ajouter les règles de réception au premier pilote, sans développer son éditeur.
- Vérifier qu’un rollback d’UI conserve l’admission/lecture des `unitAmount` déjà persistés. Ne jamais déployer un ancien parser qui réécrit le JSON en supprimant ces champs.
- Réception : chaque question prévue a un champ/slot/owner ; les non-supportés sont explicitement reportés. Parent/enfant et quantité partagée ont des oracles de non-additivité.
- Risque : faire passer une question marketing (inclus, payeur, livraison) pour un contrat déjà disponible.

## 6. Matrice des cinq scénarios L4 — aucun développement

Source complète et versionnée : [presets et templates réellement publiés](evidence/pre-l4-audit/l4-contracts-published.json). Tous conservent `contextOccurrenceId`, `selectionId`, provenance et parents ; `decisionId` reste propre aux contrôles mensuels. Les références de personnes/lieux/produits passent par les validateurs existants, jamais par le libellé seul.

| Scénario | Context / connu au départ | Champs et capacités réutilisables | Questions minimales / questions ignorées | Relations, UNKNOWN et limites |
|---|---|---|---|---|
| Soirée techno à deux | `night-out@v1`, preset `techno-night` : label seulement ; « à deux » n’est pas déjà une paire identifiée | label, plannedDate/endDate, participantRefs, placeRef, timingNote ; slots main, before, food, extras, outbound, return ; SELECT_COMPONENT/ATTACH_CHILD_CONTEXT/SELECT_MOBILITY_INTENT selon slot | Participants si coût par personne ; entrée/boissons/prix total ou par personne ; before et trajets seulement choisis. Ne pas demander systématiquement toutes les options, ne pas déduire lieu ou retour du mot techno | Before peut être un enfant ; bouteilleSHARED1×20 n’est pas PERSON2×20. Les deux trajets ont IDs/rôles distincts. Dates/prix/lieu peuvent rester inconnus ; financement BANK admissible, payeurs nommés non publiés |
| Week-end gîte, jacuzzi inclus, Restaurant | `short-stay@v2`, preset `weekend-gite` : label + lodgingKindRENTAL | version champsv5, plannedDate/endDate, destinationRef, participantRefs, nightCount, lodgingKind, timingNote ; lodgingPricingTOTAL/PER_NIGHT ; lodging/groceries/restaurants/activities/purchases/extras/transport | Budget global OU tarif/nuit+nuits ; destination/date si connues ; Restaurant explicitement ajouté. Ne pas créer une activité payante jacuzzi du seul libellé. Ne pas imposer transport ou lieu exact pour sauvegarder | Parent ne coûte rien en plus des composants. Restaurant enfant garde son ID ; transport partagé via journey explicite. Pas de champ structuré « inclus dans hébergement » : ne pas prétendre le conserver ; conserver l’intention dans le label si voulu et ne créer que les extras réellement supplémentaires. Un nouveau flag relationnel demanderait un contrat L4 examiné. Intermois reste différé |
| Visite Fontès/Servian | `family-visit@v2`, preset : label seulement, jamais domicile/personne/véhicule déduits | champsv4 : personVisitedRef, participantRefs, placeRef, plannedDate/endDate, timingNote ; hospitality, activities enfants, transport ; MobilityIntent returnRequired/journey/route/pricing | Personne/destination connues, participants utiles, voiture/train/autre et aller-retour si choisis. Date facultative. Aucune question carburant payé pour estimer un coût d’usage | Mode remplace les seules anciennes données incompatibles. Quote/route avec identité/provenance ; provider absent→UNKNOWN/PARTIAL. Pas d’opération Mobility observée, aucun repas « économisé » automatiquement |
| Vêtements chez vendeur en ligne | `purchase@v1`, preset clothing-shopping : label + budgetDomainclothing ; preset vendeur existant peut préremplir merchantLabel | productLabel, merchantLabel, budgetDomain, plannedDate/placeRef ; item/extras/transport ; guided-context-edit et relations Compiler | Article déjà connu non redemandé ; budget puis enveloppe ; quantité seulement utile ; frais non inclus éventuellement extra. Date/lieu/trajet facultatifs. Un achat en ligne n’invente pas de déplacement | Un seul prix total ou détail sans double compte ; CONSUMES_SLOT/EXTRA/UNRESOLVED officiels. merchantLabel n’est pas une identité de marchand prouvée. Pas de champ structuré canal/commande/livraison : label de frais admissible seulement, pas faux contrat e-commerce |
| Cadeau anniversaire | `gift@v2`, preset gift-present : label ; aucune occasion/destinataire déduits sans défaut explicite publié | recipientRef TEXT/household/admissible, occasion, objectLabel indépendant de objectAssetRef/catalogue, plannedDate ; item/extras, quantité/unitBasis/coût/funding | Pour qui, occasion, objet, budget/UNKNOWN ; date si décidée. Conserver classification indépendante du texte. Ne pas demander automatiquement un trajet, non publié sur ce Context | Parent non additif ; IDs de sélection conservés ; aucun slot enfant Context publié dans Cadeau (il peut lui-même être enfant d’un Séjour). Destinataire≠payeur≠participant. Paiement commun arbitraire non modélisé : ne pas recueillir une clé qui serait perdue, pas de Wallet de remplacement |

Règles communes proposées à L4 :

1. Création : peu de questions utiles, possibilité « plus tard » quand le contrat l’admet. Réédition : résumé direct et patch partiel des champs, pas nouveau wizard imposé.
2. Omission d’un champ/slot = conservation ; effacement explicite distingue vide/UNKNOWN. Réponse incompatible : désactiver/remplacer avec décision explicite, préserver ce qui reste compatible ; pas de suppression globale du Context.
3. Dupliquer volontairement = nouveaux IDs et remapping du sous-graphe ; modifier prix/participants = mêmes IDs. Aucune duplication développée A0.
4. Chaque pilote prouve création→DraftSAVED→reload→réédition et un oracle de non-additivité sur environnement isolé. Apply personnel interdit pour remplir artificiellement le gate.
5. Premier pilote recommandé : Soirée, puis Cadeau/Achat, Visite, enfin Séjour composite. Cet ordre reste une recommandation de préparation, pas une autorisation L4.

## 7. Acquis, sécurité, réserves et limites de l’audit

- Finance V2/Compiler seuls propriétaires ; prix×quantité, marges et effets non additionnés dans React. C0 conserve le JSON complet et les révisions immuables. D04 est une incohérence d’admission à corriger, pas la preuve d’un nouveau moteur.
- Draft HTTP : auth dérivée serveur, origine exacte, contrat versionné, body borné/no-store, auteur+foyer dans lectures/RPC, CAS/idempotence et récupération après commit présents. Les policies versionnées utilisent `auth.uid()`+app access gate+household access ; pas de droits clients directs DML. **Pas de vérification SQL/RLS distante fraîche A0**, pas de réactivation de F0 ou lecture de secrets.
- Savings, Renewal, floors, sources manquantes, UNKNOWN/PARTIAL et Apply autoritaire : preuves critiques héritées et chemins relus. Pas de modification de migration, schéma, Plan personnel, Purchase, Operation, PlannedExpense, Wallet, Mobility observée ou MonthInputs.
- SNAP-3/P14 : sources/configuration inchangées, pas de nouveau cache ou World par carte ; aucun HIT Canonical/M7 ou coût des triggers fraîchement certifié. Les preuves P14 positives et défavorables restent dans leurs rapports. Canonical57014 garde son incident opérationnel ; aucun scan, EXPLAIN lourd ou republication A0.
- Webpack local node:crypto, second appareil, vraie confirmation native, drag maintenu, nouveau cycle JWTcount/prix et latenceP95 : limites distinctes, jamais converties en défauts financiers ou PASS fictifs.
- Aucun contrôle de compréhension humain chronométré. Quelques états/clamps non parcourus dans toutes les tailles restent PARTIAL dans la matrice ; l’audit complet signifie que chaque piste a une destination/proof/limite, pas que tous les usages sont certifiés.
- Aucun code produit changé. Scripts ajoutés : sondes/registre/lanceur exclusivement d’audit ; le probe de confirmation ne touche que le host local synthétique. Aucun push, PR, merge, déploiement, migration ou L4 pendant A0.

## 8. Ordre exact et dépendances

1. **C1-02** : alignement d’admission serveur, avec protection historique ; travail indépendant de la présentation.
2. **C1-01** : contrat de saisie locale/transitions/Apply, sans nouveau système de sauvegarde.
3. **C1-03** : cycle Auth ciblé sur le candidat C1, environnement de test précisément autorisé ; sinon réserve explicite et gate C3 sans prétendre à un PASS.
4. **C2-01** : référence/décision/zero sur le contrat d’édition C1.
5. **C2-02** : géométrie/focus/labels des cartes et groupes, sur les composants C1 finaux.
6. **C2-03** : seulement les précisions réalisables depuis le modèle présent ; optionnelles, pas de nouveau lecteur.
7. **C3-01**, puis **C3-02** : delta de régression/build puis gestes natifs/surfaces du candidat final ; ne pas rejouer intégralement P00–P14.
8. **C3-03** : figer les oracles/limites L4 et rollback compatible. Passage à L4 après résolution D01/D04/D02/D03 et revue des réserves de preuve ; aucune exigence de nouvelle architecture ou P95 global.

`C1_READY`, `C2_READY`, `C3_READY` désignent des missions préparées et bornées, **pas des corrections déjà livrées**. L4 n’est pas lancé.

**PRE_L4_AUDIT = COMPLETE**

**C1_READY = YES**

**C2_READY = YES**

**C3_READY = YES**

**STOP A0. Ne pas commencer C1 automatiquement.**
