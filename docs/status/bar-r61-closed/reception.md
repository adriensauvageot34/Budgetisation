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
