# Finition Bar / Apéro — dock, carte ouverte, trajets

Base : main post-PR #82, `e0a10fd21816f0452ca3330383d31e704291071b`.
Branche : `codex/bar-dock-route-finishing`. Livraison limitée à une PR Draft/Preview.

## Réalisation

- Dock Bar sans flèches ni titre Familles ; retour discret conservé. Les dimensions réelles des tuiles réservent 24px du prochain élément seulement lorsque le rail déborde. Même règle dans les moments ; défilement natif/clavier existant.
- Visuels transparents existants réutilisés pour les boissons et la restauration ; cinq nouveaux PNG RGBA pour les transports, cadrés contain. Provenance et prompts : `public/planned-visuals/builder/clay/transport/COMPACT_SOURCES.md`.
- Carte ouverte : lieu dans le titre, date à droite, participants en bas à droite, trajets dans le header. Actions de carte dans le menu contextuel inférieur. Carte fermée inchangée.
- Édition courte : quantité et prix sur une ligne ; unités, devis, financement, nom et retrait restent accessibles par le dock. Pas de bouton Options/retrait dans la tuile.
- Nouveaux points : adresses propriétaires résolubles ou Google Details vérifié ; plus de Nom libre/G ON dans le sélecteur. Les anciens repères TEXT restent lisibles et conservés jusqu’au remplacement explicite. Dédoublonnage par ID Canonical/Google uniquement ; Domicile est un libellé de présentation.
- Résumé compact Aller/Retour : mode, points, coût connu/inconnu/partiel et fraîcheur ; référence véhicule conservée sans répéter son nom. Heure, véhicule, étapes, péages, financement, prix et retrait accessibles dans les choix contextuels du trajet, via leurs propriétaires existants.

## Point de contrôle 1 — local

| Contrôle réellement exécuté | Résultat |
| --- | --- |
| check-bar-open-stacked | PASS, 28 contrôles React/propriétaires/PGlite synthétique |
| check-bar-r82-search | PASS, requêtes synthétiques, Details exact et réponses hors ordre ; dédoublonnage strict/adresses résolubles |
| check-bar-r72-dock-drop | PASS, handlers réels/published drop/RAW/protection, PGlite synthétique |
| check-bar-apero-google-route | PASS, propriétaires Mobility/Google sur fixtures |
| check-bar-r72-consumption | PASS, 9 contrôles dont Apply/Reload/CAS isolés |
| check-bar-compact-clay | PASS, 12 contrôles de carte fermée |
| check-planner-performance-parity | PASS, 22 scénarios × 9 empreintes = 198/198, zéro golden modifié |
| TypeScript --noEmit | PASS |
| Build Next complet | PASS avec configuration locale temporaire du root Turbopack au parent commun des dépendances junction ; supprimée après build |

Limites d’outillage : le build normal initial refuse le junction node_modules externe au root ; le même essai autorisé a confirmé cette cause. L’essai Webpack a été interrompu. Le build Turbopack avec root local temporaire compile et termine toutes les étapes Next. Aucun next.config n’est publié.

Les journaux locaux sont dans `outputs/bar-dock-route-finishing/`. Les fixtures SQL ne constituent pas des sessions JWT ni des écritures Supabase. Aucun code Finance, Compiler, Mobility propriétaire ou migration n’est modifié. Le producteur de recette Preview réutilise Mobility avec réponses fournisseurs synthétiques explicitement bornées pour observer un coût partiel ; il reste inaccessible en Production, sans writer Draft ni Apply.

## Point de contrôle 2 — réception Preview

Les résultats navigateur et le lien au SHA exact sont consignés dans la PR après le build READY. Ne pas interpréter le point de contrôle local comme une certification navigateur, fournisseur live ou sauvegarde personnelle.

Aucune modification de Production, donnée personnelle ou Plan officiel autorisée/exécutée dans cette tranche.

## Corrections regroupées après la première Preview

Preview initiale `96f20bb`, READY (`dpl_BANqWXSnQT5cZ5CCmSYbyqfunvdN`) : connexion authentifiée réussie, Board exclusivement synthétique en mémoire. Deux défauts reproduits et conservés dans la preuve locale `initial-short-desktop.jpg` : débordement vertical de l’éditeur dans une cellule courte ; domicile masqué par le filtre d’adresse car le modèle UI ne publie pas ses coordonnées privées.

Corrections : rails dimensionnés depuis le conteneur réel de l’éditeur, footer distinct des rails, validation RAW dans le dock plutôt que sous la tuile ; révélation de la tuile active après redimensionnement du rail. Le serveur publie seulement `routeResolvable` pour les lieux privés et les identités Google publiques admissibles pour le dédoublonnage. Pas d’adresse ni de coordonnées privées ajoutées au modèle UI ; champ dérivé facultatif, jamais persisté dans un Plan/Draft.

Réexécution ciblée : Bar ouvert 28 PASS (incluant le modèle UI propriétaire et confidentialité du domicile), recherche endpoints PASS, TypeScript PASS et parité 198/198 PASS. La confirmation navigateur est limitée à une deuxième Preview du code regroupé, avec les mêmes protections.
