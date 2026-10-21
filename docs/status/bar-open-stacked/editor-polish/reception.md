# PR #82 — finition ciblée O10/O11/O12/M1/M2

Base vérifiée : `71a70190dd986e87a1726503a8b3330443d266ac`, PR ouverte Draft, non fusionnée. Correctif produit initial : `e9910c224b26c64a246e9506e894c7c3f944618d` ; compléments CSS démontrés sur Preview : `6c5f474`, puis `21f6f689762f982111f202e110f4835f047be13c`.

## Corrections

- O10/O11 : la tuile sélectionnée garde la même largeur que les voisines (144 px), le fieldset cible le vrai DOM `.barActiveTile > .barGroup > .barEditableBody`. Quantité et prix sont sur une seule ligne sous l'illustration. Seul le rail local peut révéler un poste hors écran ; plus de `scrollIntoView` sur les ancêtres/Board.
- O12 : suppression du menu permanent trois-points, retrait accessible directement dans la tuile. Le lien contextuel « Options » monte le `WorkshopComponentRow` existant hors du rail, uniquement sur demande, pour l'unité, les personnes tarifées, le financement, le devis et le nom. Aucune suppression du composant partagé ou de ses capacités.
- M2 : en-tête existant partagé ouvert/fermé : lieu dans le titre, date en badge, personnes en avatars avec +N. Champs renseignés retirés de la ligne de métadonnées ; suppression explicite du lieu disponible dans sa scène d'édition, protections RAW et adaptations de trajets inchangées.
- M1 : focus clavier interne au champ de lieu, sans empiéter sur le logo Google ; focus propre au bouton Maps conservé. Aucun changement de recherche ou d'appel fournisseur.
- Before/Au bar : accès à vide et rails superposés du correctif précédent conservés. Aucun changement Board/packer, Compiler, Finance, Mobility, DIRECT/DETAILED, migration, sauvegarde ou données personnelles.

## Contrôles exécutés

- `check-bar-open-stacked.mjs` : **27 PASS**, dont 23 précédents, trois cas ITEM/SHARED/PERSON avec devis + financement + nom personnalisé conservés sur édition partielle, et en-tête ouvert/fermé avec lieu long et sept participants. Options avancées hors rail, format décimal et droits de retrait contrôlés.
- L'assertion du nouveau test attendait initialement `7.5` ; le contrat conserve `7.50`. Attente rectifiée au format réel, aucun changement financier.
- Compact Clay : **12 PASS** ; consommation : **9 PASS** (incluant Apply/Reload isolé) ; dock/drop : **PASS** ; parité financière : **198/198** (22 cas × 9 empreintes, aucun golden modifié).
- TypeScript : **code 0**. Journaux conservés dans ce dossier.
- Revue React ciblée (skill React Best Practices) : hooks inconditionnels, options montées sur demande, pas de nouvel abonnement/réseau/cache, handlers et validations existants conservés, accès clavier et labels maintenus.
- Champ de lieu compact : **6 PASS React fixture** (champ unique, pas de second panneau libre, bascule conservant RAW, aucune décision par la bascule, validation Enter libre, aucun appel fournisseur en mode OFF).
- Fixture locale : serveur démarré, mais navigateur en timeout de connexion. Aucun PASS visuel local revendiqué pour cette tranche ; réception ciblée transférée sur la Preview autorisée.

## Preview

Déploiement du commit produit : `dpl_EYF6vgFJJSTGTpfDVAnSNdC234vG` — https://budgetisation-h5wbjha6j-adriensauvageot34-6137s-projects.vercel.app

Réception visuelle et statut final consignés après exécution. La route de recette est synthétique en mémoire, avec Auth habituelle ; aucune écriture sur les Drafts personnels, Plans ou données financières et aucun Apply.

### Défauts réellement reproduits pendant la réception

- Sur `e9910c2`, l'ancienne règle globale du stepper conservait `flex-basis:40px` malgré la nouvelle largeur. À 1440×900, champ prix réduit à 15,86 px : **FAIL**, corrigé par une base flex locale de 20 px. Mesure conservée dans `intermediate-geometry-failure.json`.
- Sur `6c5f474`, le prix est bien lisible (~56 px). Prix décimal 7,50 retenu, RAW `2,` protégé par dialogue puis annulation, quantité 2 retenue, Undo rétablit quantité 1 et prix 7,50. Recherche/choix explicite d'un lieu enregistré synthétique, date et participants : en-tête partagé fonctionnel, ligne de métadonnées réduite aux seules actions (retour/ajout trajet).
- Toujours sur `6c5f474`, réserve d'avatars non flottante : à 1440×720, éditeur client 236 / scroll 281, rail Au bar trop bas : **FAIL**, corrigé localement dans `21f6f68` (avatars flottants, composition compacte du produit et en-têtes plus courts sur desktop court). Mesure conservée dans `intermediate-short-height-failure.json`.
- Sur `21f6f68`, 1440×720 avec deux moments remplis et métadonnées complètes : éditeur **262/262**, dock bas **699,2 px**, champ prix **55,86 px**, tuile active et voisines **144 px**. En revanche le bandeau principal se replie à 1152×720 : éditeur **216/262**, **FAIL**, conservé dans `intermediate-1152-overflow.json`. Ajustement final `6e65757` limité à la hauteur de l'en-tête Bar, aux espacements et à la hauteur des tuiles sur desktop court ; aucun breakpoint mobile ou changement de Board/packer.
- Ces essais intermédiaires ne sont pas attribués au SHA final. Les journaux complets Next des deux premiers builds READY sont conservés ; aucune modification de contrat pour satisfaire les contrôles.
- Sur `6e65757`, les trois résolutions demandées avec Vodka active et métadonnées complètes passent : éditeur 350/350, 238/238, 234/234 ; main 900/900 ou 720/720 ; dock 879,2 ou 699,2 px. Mais en sélectionnant le dernier poste Au bar en 1152×720, le bouton de retrait est recouvert par les avatars flottants (**FAIL**, contrôle `elementFromPoint`). Les autres commandes restent accessibles et le scroll du Board reste identique 365,6 → 365,6. `e801a36` réserve 64 px en fin de rail et empêche un débordement horizontal de l'éditeur externe ; le rail garde son propre défilement. Preuve intermédiaire conservée, jamais présentée comme une réception finale PASS.

## Limites de preuve

Les contrôles PERSON/SHARED/devis/financement, Save/Reload et Apply/CAS utilisent les fixtures synthétiques et les vrais owners existants ; la Preview authentifiée utilise un Board en mémoire. **Aucun E2E de sauvegarde Supabase personnelle n'est exécuté ou revendiqué dans cette mission.** Les suggestions de lieux sont simulées ou issues des références synthétiques de la recette ; aucun nouvel appel Google réel n'est nécessaire pour cette finition CSS. Les tests des fournisseurs réels déjà acquis ne sont pas réattribués à cette tranche.

## Réception finale du 22 octobre 2026

- Autorisation utilisateur ultérieure : terminer et mettre en Production les travaux Preview de la PR #82. Cette instruction remplace le STOP Draft pour la livraison seulement ; aucune migration ou écriture financière autorisée.
- SHA produit final **`e801a36ca600eedda5fd8f4609b4a29532ee4d27`**, déploiement **`dpl_AkR1kKB2TmCJ1h4P44nTEzQXkEKC` READY**, build Next complet PASS (journal `vercel-build-e801a36.log`). Depuis les 27 tests métier et TypeScript, seules des règles CSS locales ont changé.
- Preview authentifiée : https://budgetisation-f82kxv25i-adriensauvageot34-6137s-projects.vercel.app/recette/bar-favoris?r62=five ; SHA vérifié dans le DOM.
- Cas riche synthétique : six postes Au bar, Before ajouté explicitement avec Vodka, lieu connu retenu, date 14 novembre et deux personnes. Carte ouverte : titre lié au lieu, date en badge, avatars flottants ; pas de rangée de métadonnées renseignées redondante.
- Trois viewports effectifs : **1440×900**, **1440×720**, **1152×720**. Main client/scroll **900/900**, **720/720**, **720/720** ; éditeur **350/350**, **238/238**, **234/234**. Dock bas **879,2 / 699,2 / 699,2 px**. Tuiles sélectionnée/voisines **144 px**. Quantité et prix alignés (décalage vertical 1 px), champ prix **55,86 px**. Mesures et captures `accepted-*`.
- Fin de rail : défilement explicite par flèches dans le rail Au bar, dernier produit Planche ; tous les boutons et inputs, y compris retrait, atteignables au centre (`elementFromPoint`). La sélection d'un élément encore hors écran via un outil peut nécessiter ce défilement local ; aucune prétention de navigation automatique universelle. Les avatars ne recouvrent plus le retrait.
- Focus Maps capturé, recherche/choix enregistré exécutés sur les versions précédentes avec le même code de recherche ; seul le focus CSS est modifié. Prix décimal, RAW et Undo réellement exécutés sur le même code TSX avant les compléments CSS. Les limites de persistance/fournisseurs ci-dessus restent ouvertes.
- **Verdict : corrections ciblées livrables**, avec les limites indiquées. Aucun nouvel owner ou contrat économique, aucune donnée personnelle modifiée ni recréée.
