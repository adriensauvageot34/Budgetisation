# Bar compact — objets transparents

Usage limité au composant existant `BarProductVisual` (carte fermée, éditeur et dock Bar). Les ressources originales des autres assets ne sont pas remplacées.

- `vodka`, `rum`, `energy`, `chips`, `snack`, `tapas` : nouvelles variantes générées avec l'outil intégré imagegen ; planche des illustrations existantes utilisée comme référence de style uniquement.
- `beer`, `cocktail`, `soft`, `shared` : ressources alpha existantes `drinks/*-closed.webp`.
- `wine`, `shot`, `water` : ressources alpha existantes `r7/*.webp`.
- Normalisation technique : bord transparent retiré, objet entier conservé, mise à l'échelle `contain` en 256×256, WebP qualité 86 et alpha qualité 100. Aucun détourage par seuil de couleur, aucune suppression de partie opaque.
- Vérifications : canal alpha réel et pixels transparents sur les 13 fichiers ; inspection sur fond bleu contrastant ; pas de fond beige intégré. Poids total : 176 626 octets.

## Prompts de génération

Consigne commune (outil intégré, `transparent_background=true`) : un objet isolé centré, style 3D Clay doux, formes arrondies, palette crème et lavande, texture légère, vue trois quarts, objet entier, arrière-plan réellement transparent ; aucun plan de fond, texte, filigrane ou marque. Référence : objets existants, sans reproduire la planche ni ses libellés.

Sujets :

- Vodka : bouteille blanche dépolie et trapue avec bouchon lavande.
- Rhum : bouteille ronde ambrée, étiquette crème et bouchon lavande, sans herbes autour.
- Energy : canette blanche avec éclair lavande sans texte.
- Chips : petit sachet crème, bord replié lavande et quelques chips à côté.
- Snack : bol crème/lavande de crackers, sans accessoires supplémentaires.
- Tapas : petite planche en bois, trois canapés salés, olives et fromage.

Ces images sont décoratives. Elles ne constituent jamais une référence de produit, une quantité, un participant, un prix ou une décision économique.
