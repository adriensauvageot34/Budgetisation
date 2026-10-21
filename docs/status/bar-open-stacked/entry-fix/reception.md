# PR #82 — accès permanent aux moments Bar

## Correctif

- Branche : `codex/bar-open-stacked-dock`, PR #82 conservée **Draft**.
- Base du diagnostic : `b5b3e375df0c2c3eb016f5cee730d91b761169dd`.
- Commit produit : `975dadf6dbd5ad570d59bafe143009ed029482e1`.
- Pas de merge, migration, Apply ou écriture sur le brouillon personnel.

## Cause démontrée

Les onglets de navigation supprimés avaient une seconde fonction : rendre accessibles les moments pas encore ouverts. Le rendu vide du Before exigeait `openMoments.before`, initialisé à false en absence d'enfant. La section extras était supprimée si `!detailed` ou si elle était vide avec `openMoments.bar=false`. En DETAILED vide, « Détailler les consommations » disparaissait aussi. Enfin, `question` était vidée sur le résumé lorsque les flags n'ouvraient aucun moment, donc aucun ContextPalette ne permettait de sortir de cet état. Le passage vers DETAILED ne sélectionnait pas non plus la page boissons.

Le test ajouté a été exécuté **avant correction** : `before-fix.log` contient l'échec `missing empty Before entry`. Les dix contrôles historiques remplis ne couvraient pas cet état.

Le correctif rend les points d'entrée indépendants de ces flags transitoires :

- Before existant : rail réel conservé, sans recréer son enfant.
- Before absent : rangée compacte `Before · + Before`.
- Au bar avec détails actifs : rail réel conservé.
- Au bar vide ou DIRECT : rangée compacte `Au bar · + Au bar`.
- Les `+` sélectionnent le moment et son catalogue existants. Avant de quitter DIRECT, une confirmation explique la mise en réserve du montant ; annuler ne mute rien. Le contrat DIRECT/DETAILED est inchangé.
- « Détailler les consommations » ouvre désormais le dock Au bar après admission, au lieu de revenir à un résumé sans choix.
- Aucun onglet, nouvelle infrastructure ou autre géométrie du Board/dock ajouté. Deux règles CSS limitent les rangées vides à des actions compactes.

## Données invisibles ou réellement absentes

**Cas A, reproduction contrôlée :** le test compare état sémantique, ComposerUiModel et rendu pour vingt composants existants. Vingt identités et composants sont conservés et représentés, sans opération d'écriture au montage. Before présent et Au bar rempli restent visibles. Les éléments inactifs d'un DIRECT restent inactifs jusqu'à confirmation : ils ne sont ni effacés ni réactivés implicitement.

**Cas B :** l'état vide n'est pas rempli automatiquement. Le montage et l'ouverture des familles n'admettent aucune mutation. Seul le choix explicite d'un produit crée le composant, sous son bon propriétaire.

**Session personnelle :** une lecture SQL bornée en transaction READ ONLY a trouvé zéro Draft ACTIVE en novembre 2026 pour le compte autorisé, ainsi que des archives aux états différents. Elle ne permet pas de retrouver un éventuel état uniquement en mémoire de l'onglet utilisateur. Aucune archive n'a été restaurée ni modifiée et aucune donnée personnelle copiée dans le dépôt.

**Compteur 17 → 16 :** le code de `composer-presentation.ts` calcule `controls.length + roots.length - availableReservationRefs.length` ; ce n'est pas un compteur de consommations. Supprimer le dernier composant dans la fixture ne modifie pas ce compteur (assertion exécutée). Sans les deux snapshots exacts de la session utilisateur, aucune suppression ou transition particulière ne peut être attribuée honnêtement à cet écart. Aucun reset ou réenregistrement personnel n'a été utilisé pour tenter de le reproduire.

## Contrôles exécutés

`node scripts/check-bar-open-stacked.mjs` : **23 PASS**, niveau React + vrais owners + PGlite synthétique. Les dix cas demandés sont couverts :

| Cas demandé | Résultat |
|---|---|
| Vide → créer Before | PASS ; vrai owner enfant, pas d'ajout Au bar |
| Vide → ajouter Au bar | PASS ; owner parent, pas d'enfant inventé |
| Before présent / Au bar vide | PASS ; deux chemins, Before préservé après ajout Au bar |
| Before absent / Au bar rempli | PASS ; détails visibles, action Before disponible |
| DETAILED vide | PASS ; actions et dock accessibles sans mutation |
| DIRECT | PASS ; montage/famille Before sans transition, annulation intacte, acceptation explicite avec montant inactif conservé |
| Dernier poste supprimé | PASS ; deux entrées accessibles, compteur de racines stable |
| Undo de suppression | PASS snapshot + navigateur local réel ; identités et commandes restaurées, puis deux rails visibles après réouverture |
| Save/Reload | PASS SQL synthétique ; services et RPC Draft existants, JSON complet identique, cinq Before + un Au bar rendus |
| Fermer/réouvrir | PASS démontage/remontage + navigateur local réel ; données identiques et deux rails accessibles |

Trois contrôles supplémentaires : carte sans métadonnées (pas de date/lieu inventés), vingt composants existants comparés sémantique/DTO/rendu, choix DETAILED depuis le vide avec dock actif. Les dix contrôles précédents RAW, DIRECT, identité, propriétaires et drag publié restent PASS.

Régressions exécutées sur le correctif : compact Clay **12 PASS**, consommation **9 PASS**, dock/drop **PASS**, parité financière **198/198**, TypeScript **code 0**. Aucun golden modifié. `remoteWrites=0`, canaries intactes, zéro Plan et zéro révision dans le test ciblé. Les écritures SQL des tests portent uniquement sur PGlite synthétique, jamais Supabase distant.

## Navigateur local réel

Serveur de fixture existant, port 3222, bundle de production React compilé depuis le commit produit. Cas `BAR_COMPACT_meta` : lieu/date/personnes renseignés, **zéro composant, zéro Before**.

- Ouverture : `+ Before` et `+ Au bar` réellement présents.
- `+ Before` → Boissons → Vodka : enfant créé explicitement, rendu visible.
- `+ Au bar` → Boissons → Cocktail : composant parent, Before toujours visible.
- Retour « Ma sortie » : les deux moments sont visibles ensemble.
- Retrait du dernier Cocktail : `+ Au bar` reste accessible, le Before est inchangé. Undo puis réouverture : Vodka et Cocktail réapparaissent dans leurs moments ; capture `undo-reopened.png`.
- À 1440×720, scène remplie depuis le vide : main **720/720**, carte **363/363**, dock entièrement visible, bas **699,2 px**.
- Captures : `empty-open.png`, `empty-dock-visible.png`, `filled-from-empty.png` ; mesures `browser-measures.json`.

Le navigateur avait été désactivé puis le serveur interrompu ; les blocages ont été résolus et les captures ci-dessus ont ensuite été réellement obtenues. Elles ne sont pas celles de la réception précédente.

## Preview

Le commit produit `975dadf` est poussé ; première Preview READY : https://budgetisation-c2vzfhong-adriensauvageot34-6137s-projects.vercel.app

La recette authentifiée **existante** `/recette/bar-favoris` est préparée uniquement sur cette branche Preview, pour le compte déjà autorisé (`BAR_GEOMETRY_RECEPTION`, `BAR_GEOMETRY_AUTHOR`). Elle utilise des faits synthétiques en mémoire, aucun Draft distant et Apply interdit. Google live n'est pas activé. Ces paramètres ne sont pas de nouveaux droits RLS et ne concernent pas Production. Les prochains builds de cette branche les prendront en compte.

### Réception authentifiée exécutée

- Preview **READY** : https://budgetisation-6mw3etu3c-adriensauvageot34-6137s-projects.vercel.app/recette/bar-favoris?r62=empty
- Déploiement `dpl_BGrkkJrXXjb2rBjvbLry98RtwmyF`, SHA testé **`43044ec6332cf7a60626ed74c8e7fe8ea0ab5dea`**, également vérifié dans `data-bar-product-sha` du DOM. Les fichiers `src` et `scripts` sont identiques au commit produit `975dadf`.
- Session Budgetisation réelle ; Board explicitement synthétique en mémoire, sans enregistrement distant, favori ni Apply. Aucun parcours personnel n'a été modifié.
- Carte réellement vide : `+ Before` et `+ Au bar` présents ; `+ Before` ouvre son catalogue Boissons/Restauration. Choix explicite Vodka dans Before, puis Cocktail dans Au bar ; retour « Ma sortie » : les deux rails restent visibles, avec quantités 1 et prix UNKNOWN.
- Largeur effective **1440**, hauteur **720**. Main client/scroll **720/720** ; dock **546,2 → 699,2 px** entièrement visible. Mesures `preview-measures.json`.
- Captures intégrales : `preview-empty-open.png`, `preview-empty-dock.png`, `preview-filled-from-empty.png`. Aucun message console warn/error dans la collecte finale bornée (10 entrées maximum).
- Build Next complet du commit produit : compilation, TypeScript, génération 8/8 pages, déploiement terminé **READY** ; journal `vercel-build-975dadf.log`.

**Verdict du correctif : PASS sur les niveaux exécutés** (23 contrôles ciblés, régressions, navigateur local et Preview authentifiée sur données synthétiques). La sauvegarde/relecture est certifiée ici sur PGlite synthétique uniquement : aucun nouveau PASS de persistance Supabase/JWT n'est revendiqué. L'origine exacte du compteur personnel 17 → 16 reste indéterminée. PR #82 maintenue Draft ; aucune fusion ou promotion Production.
