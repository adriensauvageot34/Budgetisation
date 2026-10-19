# Bar / Apéro R5 — réception PR68
**READY_FOR_REVIEW_NOT_MERGED ; GO_MAIN=NO.**
Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.
Branche : codex/bar-subassets-r5. Base :5f98040cffbcd3437287367775e9b368b81123cd.

[PR Draft68](https://github.com/adriensauvageot34/Budgetisation/pull/68) · [Preview finale](https://budgetisation-i6zmuhpkc-adriensauvageot34-6137s-projects.vercel.app/recette/bar-favoris).
La Preview exige une session du projet fictif. A est de nouveau banni et privé du marqueur ; aucun mot de passe ni token dans ce dossier.

## Implémentation et comparaison
| Avant main | Candidat R5 | Preuve |
|---|---|---|
| Dock Bar paginé | Rail continu existant, flèches si overflow, recherche complète avant24 + suite explicite | React25/120/150 ; rail réellement déplacé en Preview1152 |
| Catégories/Before/objets/navigation mélangés | Une nature par scène :familles, objets, personnes, modes, trajets connus, lieux | React + Previews cliquées |
| État par page | Recherche/position par occurrence/scène/moment/famille ; mémoire bornée32 | React + Preview2 :Before Restauration distinct de Boissons au bar |
| Principal Before non retirable seul | Premier objet réel, Chips possible ; promotion atomique d'un autre composant via owner | R5/P4 :IDs, enfant, relations et Undo préservés |
| Participants en groupe puis retour | Multi-toggle, recherche au dock, libre seulement sans match | Preview3 contacts puis retrait1 ; recherche sans résultat reste montée |
| Recherche lieux répartie | Une recherche ; favoris au repos, résultats près du champ ; Details avant admission minimale | Mock + provider Preview1 indisponible, repli texte explicite utile |
| Date/dock redondants | Toggle atomique, retour après succès, dock/réserve0 | Preview1440 mesurée |
| RAW ambigu | 12, non admis ; navigation gardée ; Entrée sur valeur valide sans commit blur | React + Preview :garde annulée puis12,50 admis |
| Parent dock130px/hidden, contenu136px | Hauteur auto/plancher136, overflow visible | Défaut reproduit fa8 puis retest cc9 :136=136 |

Clay existant réutilisé, recadrage local2:1 dans les choix. Bouteille neutre sans dette ni quote-part. Modes et trajets connus séparés, sens/endpoints indépendants ; véhicule et indisponibilité en détail. Aucun nouveau calcul financier :Compiler/Finance V2 uniques, UNKNOWN et scopes/funding conservés. Jargon Compiler/V2 retiré de la notification normale.

## Couverture et limites
- Registre222 exact avec textes originaux/précision/76 décisions :105A/62B/55C. **78A vérifiées au niveau indiqué,27A partielles/bloquées ;62B examinées.** Pas167/167 PASS ; toutes les preuves ne sont pas navigateur.
- Restent notamment UI133 popover global ancré, UI129/130/142 parts financières absentes de ComponentSelectionV1, UI160 mode libre nommé absent du contrat, UI119/124 réutilisation limitée aux modules admissibles, UI186/187/198 images encore imparfaites, photo lieu non raccordée.
- Desktop :document de secours nécessaire au résumé1152 ; aucun scroll vertical interne sur les scènes mesurées. Pas de certification exhaustive tous états, deux cartes alternées, clavier complet, photos tardives ou150 options dans navigateur. Zoom natif125% non disponible.
- P1/P2/P3/P4 PASS25/21/14/15 ;198/198 au produit final, aucun golden changé. Attente P2 de choix mélangés et ancien refus du retrait principal Before adaptés au contrat R5 prouvé, sans modifier les calculs.
- Échecs initiaux12.5/12.50, attendu P2 et build local webpack conservés. Build Vercel complet final PASS.
- **Auth réel du projet isolé pour accéder à la recette, Composer en mémoire.** Tables Draft/PlanRevision absentes :NOT_RUN_AUTH pour Save/Reload durable. Pas de migration ni test sur Draft personnel Production.
- Google réel Preview1 :Recherche indisponible ; pas de répétition en boucle ni faux résultat. Details/hors ordre restent des mocks.

## Livraison et sécurité
Commits :c594c48 socle ;fa8d0af finitions ;cc9d259 découpe observée et nettoyage Auth.11 fichiers source Composer modifiés, scripts ciblés et docs. Aucun owner financier, API productrice ou schéma changé. Le commit documentaire suivant conserve l'arbre src du produit.

A temporairement réactivé puis rebanni ; marqueur retiré explicitement par null (Auth fusionne les métadonnées :omission insuffisante) et relu. B/C inchangés. Aucun nouveau compte/favori/Draft distant, aucune suppression, Apply ou écriture financière/Production. Configuration limitée à la branche Preview/projet fictif. Pont Auth arrêté.

**Blocage promotion :** voie Draft isolée absente, zoom et réception/finition A partiels. Pour Auth il faut une voie Draft isolée autorisée avec schéma/RLS revus séparément ; aucune migration implicite ni test du Draft personnel. Les réserves UI du registre doivent aussi être résolues ou arbitrées avant GO_MAIN. Trois B encore critiques pour réception complète :UI215/220/222 (zoom, clavier exhaustif, états riches).

Rollback :aucun déploiement Production à annuler. Conserver PR isolée ne retire aucune donnée. Après éventuelle intégration autorisée :revert normal des commits, jamais reset/force-push ni suppression de Drafts.

**Dimensions / Board / carte fermée :non commencé.**55C et ancien registre350 séparés. Voir gate-results.md, implementation-matrix.md et proofs/.
