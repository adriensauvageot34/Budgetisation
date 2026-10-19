# Bar R5 — géométrie des 34 exigences

Base : `175313fb509c20c88df7eb54e5aa3028abf61183` (PR68). PR [69](https://github.com/adriensauvageot34/Budgetisation/pull/69), branche `codex/bar-r5-board-geometry-34`.

## Modifications livrables

- `bar-surface` : demande de présentation transitoire par scène ; le packer accorde les pixels et les spans ensemble. Date est plus étroite que le résumé de plusieurs moments.
- `inventory-layout` / `board-carousel` : réservation de l’ancre avant les voisines, ordre relatif conservé, packing déterministe ; repli et mutation structurelle récupèrent les cellules. Aucun nouvel état métier persistant.
- Bar : calendrier pleine largeur utile, en-tête rapproché, sauvegarde RAW réservée dans la ligne, groupes d’objets bornés, compositions fermées riches intrinsèques. Le dernier retrait, y compris après Undo/Redo, est un checkpoint ; les prix et quantités ne le sont pas.
- Recherche : surface bornée à trois candidats par page sémantique, tous les candidats conservés, homonymes distingués par leur adresse, texte intégral au focus/survol. Les réponses tardives ne réadmettent pas une ancienne recherche.
- Voisines : état inconnu non répété, aucun zéro inventé, références distinguées des décisions, seules les capacités propriétaires existantes restent éditables.
- Navigation : un statut, des accès directs et deux flèches nommées. Dock continu PR68 conservé ; aucun catalogue paginé ajouté.
- Le libellé d’attente des précisions est raccourci, avec un nom accessible complet, pour éviter une ligne supplémentaire de l’en-tête pendant Preview.

## Frontières

La réception Preview authentifie le compte habituel, limité à l’auteur configuré côté serveur, mais utilise exclusivement un Board synthétique en mémoire. Elle ne résout pas son foyer personnel. Pas de transport Draft durable, de favori, de writer financier ou d’Apply. Le host de recette reste indisponible en Production. Aucun compte fictif n’a été réactivé pour ce lot.

Aucun changement dans `src/domain`, `src/server/phase2` ou `supabase` ; aucun nouveau calcul financier, migration, trigger ou activation SNAP. La parité utilise les goldens existants.

Google réel, admission Canonical, fournisseurs réels, Auth durable, zoom natif125 et les quatre contrats propriétaires précédemment différés : **DEFERRED_BY_OWNER**. Les 20 recommandations artistiques et UI219 : **NOT_STARTED**.

## Limites de preuve à conserver

La première référence locale n’a pas de SHA de bundle attesté : aucune comparaison chiffrée avec le main exact n’en est déduite. Les écarts et essais intermédiaires sont conservés dans les mesures, avec leur SHA ; les captures d’un mauvais onglet sont invalidées explicitement.

Les scénarios riches à 1152×720, et la carte riche avec inspecteur, nécessitent parfois le défilement extérieur du document. Cela ne constitue pas une certification de zéro défilement global. Les étiquettes longues des résultats disposent d’un libellé intégral visible au focus/survol ; leur résumé sur deux lignes n’est pas pris pour un scroll interne.

Le navigateur de recette n’expose pas d’émulation de `prefers-reduced-motion`; sa valeur observée est false. Le chemin CSS de réduction des animations est couvert statiquement, pas certifié dans un navigateur sous préférence reduce.

## Rollback

Avant merge : conserver la PR Draft et les Previews ; aucune donnée à restaurer. Après un éventuel merge autorisé par les gates : revert normal du merge et déploiement Git habituel, sans supprimer de Draft, archive ou Plan. Aucun rollback SQL n’est nécessaire pour ce lot.

## État de livraison

Réception finale et décision GO_MAIN consignées dans `preview-reception.md`. Un build READY ne vaut jamais preuve navigateur. Aucune promotion ne doit précéder cette décision.
