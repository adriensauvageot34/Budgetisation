# R6.1 — carte fermée, réception en cours

Base main e5c4911ba11bdc374226f96f3621a22fa6ecadd7, branche codex/bar-r6-1-closed-card-polish. Carte ouverte non redessinée. Aucun changement domaine/Compiler/writer/Google/Mobility/Before/identité/scopes ou migration.

Un lot : statut de coût fermé, absence menu/punaise fermés, grip conservé avec Suppr vers le drop TRASH publié, tuiles deux étages et badge SHARED sans notion de payeur, fond panoramique couvrant la carte sans section ajoutée. Les cartes préservées gardent leurs protections ; leur résumé reste consultable pour retrouver le contrôle existant de libération dans la carte ouverte.

## Contrôles exécutés

- TypeScript exit0.
- Finance : un seul passage22scénarios×9hashes =198/198, goldens inchangés, remoteWrites0.
- Test ciblé12 PASS : Compiler réel synthétique + React, états connu/inconnu/partiel/stale, lot, bières2identités, édition individuelle, Suppr protégé/libre, dropTRASH et relecture exacte d'état (pas certificat navigateur).
- Registre Clay PASS168illustrations/326choix ; nouveaux exports réels1200×600.
- FAIL initiaux conservés : fixture référençait un asset bar:shared inexistant ; corrigée pour employer la Bouteille libre SHARED exactement comme le writer actuel. Le flag de résumé incomplete couvre aussi le contexte et ne certifie pas un nombre de prix manquants : libellé accessible distingue l'évaluation de ligne inconnue d'une estimation génériquement incomplète. Test du flag complet séparé sans changer les calculs pour satisfaire une fixture.

## Assets réellement produits

Outil built-in imagegen : bouteille neutre Clay transparente ; bar intérieur panoramique chaud ; dérivé transparent de la bière existante. Fichiers public/planned-visuals/builder/clay/drinks/{shared-bottle-closed,beer-closed}.webp et scenes/bar-interior-closed.webp, registre/manifest mis à jour. Aucune photo Google, marque ou donnée personnelle. Dérivés fermés uniquement ; originaux de la carte ouverte/dock inchangés.
Prompts : bouteille reconnaissable ivoire/ambre/lavande sans anse antique, marque/prix/personnes ; intérieur panoramique2:1 comptoir chêne clair/étagères/verres décoratifs, centre calme, pas UI/texte ; bière cible existante conservée avec fond ivoire retiré et alpha réel. Conversion sharp de format/dimension uniquement, originaux generated_images conservés.

## Première Preview et correction ciblée

Produit4f5c62b, dpl_7gJY23BCAke4weTMkAC7QyZ56oT4 READY/Next complet. Auth et gate de recette existants, aucune nouvelle session requise. État vide1440 : cardRect=cellRect372,29×175, aucun overflow/scroll interne, fond réel visible. État partiel : prix28€ et groupe8€+? corrects ; défaut visuel reproduit : min-width190px empile les deux tuiles dans une carte372px et porte sa hauteur à415px. Capture initiale partial-1440.png conservée. Patch CSS uniquement : base148px pour deux tuiles juxtaposées et capsules de métadonnées opaques. Retest ciblé sur une seconde Preview justifié par ce défaut, sans nouvelle campagne financière.

Bin/Undo et réception finale/Production : à vérifier, aucun PASS anticipé.

Le correctif4a83436 (dpl_D3Zu7NcFF76xzs8bWxdj1HxbDStu READY) mesure deux tuiles170,34×116 côte à côte ; carte372,29×295 au lieu de415px. Le test corbeille clavier→Undo en navigateur4f5c62b restaure68€ et les3lignes, sans writer distant. La liste inline du groupe se referme au replacement du Board : défaut reproduit par clic et Enter. Correction strictement de présentation fermée : réutiliser AtomicPopover existant pour les groupes multiples, hors flux, sans agrandir/replacer la carte ; l'éditeur ouvert conserve sa liste inline. Le test React vérifie le contenu et les callbacks du popover ; son ouverture native doit être certifiée dans le navigateur final. Aucun test de drag pointeur natif n'est remplacé par de faux événements JavaScript.

## Réception finale exécutée

**PRODUCT_SHA_TESTED=2c4e594529d6cb2e2cbab65128943c8bd2307720**. Preview dpl_2SbQVLD7xm2iYx9pau8EVaeqG3g6, https://budgetisation-ncp7hge8d-adriensauvageot34-6137s-projects.vercel.app, READY, Next complet avec TypeScript. Alias de test authentifié seulement réaffecté, Production inchangée pendant les tests. Les onglets/dimensions sont vérifiés effectivement, pas déduits de la demande de viewport. Après alias, une page fraîche a été utilisée ; les mesures du précédent onglet ne sont pas attribuées au nouveau SHA.

| Gate | Résultat et preuve |
|---|---|
|Header/status|PASS_BROWSER : inconnu sans0 inventé ;28€ partiels et explication vrais prix inconnus ;68€ génériquement incomplets selon flag autoritaire, sans faux nombre de prix manquants. Branche complète/stale PASS React.|
|Menu/punaise|PASS_BROWSER : absents fermés, grip disponible. Préservation interne gardée ; ouverture non mutante permet encore d'atteindre son contrôle existant.|
|Tuiles2étages|PASS_BROWSER : titre/quantité/prix alignés, image seule dessous,2tuiles170,34×116 ; blancs uniformes, alpha réel bière/bouteille ; aucun pied Lot partagé.|
|SHARED|PASS_BROWSER : icône intitulée Consommation commune(lot), aucun nombre de payeurs ou partage calculé.|
|Fond continu|PASS_BROWSER : vrai background couvrant la carte, visible vide/riche, aucun bloc décoratif ajouté.|
|Groupe Bière|PASS_BROWSER : popover natif stable, deux lignes20/28€, édition ciblée ouvre la bonne valeur, aucune modification de prix, fermeture/repli conserve48€ et3lignes. Tab puis Enter atteint le groupe ; focus visible.|
|Corbeille/Undo|PASS_BROWSER clavier Suppr sur grip→carte retirée→Undo→FRESH68€,3lignes conservées. Drag source HTML reste draggable=true et handlers inchangés ; **geste pointeur natif NOT_RUN** (API navigateur disponible sans séquence drag). Pas de fausse certification DnD natif.|
|1440×900|PASS_BROWSER : vide cellRect=cardRect372,29×175 ; partiel/riche372,29×295 ; popover ouvert ne change pas295 ; aucun scroll vertical interne ou overflow horizontal.|
|1152×720|PASS_BROWSER sur page active2 : cellRect=cardRect381,20×295, deux tuiles174,80×116 ; tout atteint sans scroll interne, aucun contenu coupé.|

Captures final-empty/partial/rich-1440.png, final-rich-1152.png, final-beer-popover.png, final-second-beer-target.png, final-keyboard-focus.png et final-measurements.json. Les captures initiales partial-1440/empty-1440 sont explicitement au produit4f5c62b.

Contraste calculé WCAG : texte #403526/#fffdfa=11,78:1 ; en-tête #303446 sur fond ivoire96% au pire sur noir (#f5f3ee)=11,10:1 ; sous-texte #66543a/#fffdf8=7,14:1 ; badge #43341f/#faf8f3=11,31:1. Ce sont les surfaces de texte, pas une certification de tous les pixels du décor ou du zoom125.

Second typecheck exit0 après réutilisation du popover ; test ciblé12PASS rejoué pour ce seul changement. Aucun second passage des198 goldens : domaine/Compiler/projections/scopes financiers inchangés, diff contrôlé. Le harness a d'abord installé window avant PGlite, provoquant une détection de navigateur erronée : globals UI déplacés après l'initialisation Node de PGlite ; échec conservé dans outputs, pas un défaut produit masqué.

**GO_MAIN=YES**, sous contrôles GitHub normaux. Aucun blocage produit reproduit restant. Limite explicite : DnD pointeur natif non certifié, corbeille/Undo réellement testés au clavier. Sauvegarde Auth/providers/mobile/native125 hors lot. Carte ouverte **NOT_REDESIGNED**. Après livraison : USER_VISUAL_FEEDBACK_ON_CLOSED_CARD, aucune suite ouverte automatique.

PR https://github.com/adriensauvageot34/Budgetisation/pull/71. Merge/Production à renseigner après exécution effective. Rollback : revert normal du merge, aucun schéma ou effacement de données. Les états de recette n'existent qu'en mémoire et les routes demeurent refusées en Production par le gate existant.
