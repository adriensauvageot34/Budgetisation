# Patch V2.3 — cartes projet et choix des photos restaurant

Référence : `PROMPT_CODEX_PATCH_V2_3_CARD_PROJET_IMAGES_RESTAURANT_2026-10-02.md`, fourni par l’utilisateur. Patch incrémental du Builder, des cartes et du fournisseur Google Places existants.

## Statut demandé

```ini
HEAD_BEFORE = 4ba0cd9172b55d2a201dd6bc46336643a2e193bf
HEAD_AFTER = 535ad42778942d986f35f7424aeb5721ffe8e14a
WORKTREE = main, checkout principal
FILES_CHANGED = 18 fichiers d’implémentation/tests + ce rapport

PROJECT_CARD_LAYOUT = Grille de cartes ; hero et résumé compact en bas ; actions dans le détail existant
PROJECT_CARD_RATIO = 16:9 fermé ; mesure navigateur 392.19 × 221.19 px, soit 1.773
PROJECT_CARD_VISUAL_STRATEGY = Cover centré, photo couleur, dégradé local au pied pour lire les faits

GOOGLE_PHOTO_SOURCE = Places API New, Details/photos puis Photo Media, intégration serveur existante
PHOTO_PICKER_IN_SUMMARY = PASS ; Votre projet, aucune étape ajoutée
PHOTO_DEFAULT_SELECTION = PASS ; résolution et proximité du ratio 16:9, ordre déterministe
PHOTO_SELECTION_PERSISTENCE = PASS_SYNTHETIC_SAVE_RELOAD
PHOTO_FALLBACK_STRATEGY = Hero restaurant existant ; erreur/absence non bloquante

PROJECT_VISUAL_STORAGE = context.project.visual ; source, placeId, selectedIndex ; intention uniquement
PROJECT_VISUAL_RENDERING = Nos projets + détails dépliés du calendrier ; références photo fraîches

RESTAURANT_CHANGE_INVALIDATION = PASS_CHANGE_REMOVE_AND_UNDO
LOADING_STATE = Message compact dans le résumé ; fallback déjà visible dans la carte
ERROR_HANDLING = PASS ; isolé des coûts, du Preview et du Save

TESTS_ADDED = scripts/check-phase2-project-visuals.mjs
TYPECHECK = PASS
LINT = NOT_CONFIGURED
BUILD = PASS

KNOWN_LIMITATIONS = Ordre/collection Google variables ; aucune sauvegarde live ni vérification Vercel
FOLLOW_UPS = Vérification manuelle de la sauvegarde en production par l’utilisateur
```

`HEAD_AFTER` désigne le commit d’implémentation. Un commit suivant ajoute uniquement ce rapport. Les tests serveur utilisent le harness existant en mémoire ; ils ne prétendent pas prouver un Save navigateur live.

## Implantation

### Cartes et résumé

`ProjectHeroCard` remplace le bandeau horizontal existant. La grille utilise des colonnes d’au moins 360 px. Le hero garde son ratio 16:9 ; le résumé chevauche seulement ses 80 derniers pixels, avec un dégradé pour lire titre, état, date et montant. Les titres et périodes longues peuvent augmenter la hauteur, sans être coupés. Le détail conserve les coûts et les actions de cycle de vie existantes. Les libellés de date, budget et état proviennent des helpers partagés.

Les photos Google sont en couleur ; le hero générique restaurant reste le fallback existant. Les attributions sont visibles en haut de la photo, hors du bandeau de résumé. Les autres intentions réutilisent les assets existants.

`ProjectVisualPicker` vit dans « Votre projet », avant le bouton de simulation. Il propose jusqu’à quatre miniatures 16:9 avec attribution, meilleure photo choisie par défaut, et état `aria-pressed` immédiatement mis à jour. Une photo unique apparaît sans bouton de choix artificiel. Zéro photo ou erreur masque le bloc après le chargement. Les miniatures sont bornées à 320 × 200 côté fournisseur, chargées en parallèle, sans requête supplémentaire à chaque clic.

### Intention persistée et validation

Le contrat partagé ajoute uniquement :

```ts
context.project.visual = {
  source: "GOOGLE_PLACE_PHOTO",
  placeId: "identité Google du restaurant",
  selectedIndex: 0 // ordinal source entre 0 et 9
}
```

Le parseur serveur refuse les clés supplémentaires, les indices invalides et un lieu ne correspondant pas au restaurant du projet. Aucune URL média, référence photo expirante, attribution ou galerie Google n’est persistée. Les anciens projets sans champ `visual` restent lisibles. Le JSON context existant suffit : aucune migration ni changement RLS.

Le helper partagé identifie le lieu compatible et invalide le visuel après changement, retrait ou saisie manuelle du restaurant. Le précédent brouillon reste restaurable par Undo. Un résultat réseau obsolète ne peut pas appliquer une image à un nouveau lieu. Les références Google des choix canoniques connus sont transmises lorsqu’elles existent ; aucune association n’est inventée par rapprochement de noms.

### Fournisseur et disponibilité

Le serveur récupère des références fraîches via Details, classe au plus dix photos, puis résout jusqu’à quatre médias. Une préférence enregistrée reste proposée même si elle n’est plus dans les quatre mieux classées. Chaque média peut échouer indépendamment. Les URLs retournées sont HTTPS et limitées aux hôtes média Google ; les noms de ressources doivent appartenir au lieu demandé. Les garde-fous auth/foyer/origin/rate/no-store existants sont conservés. La clé reste dans le header serveur.

La carte recharge à l’entrée dans le viewport et annule les requêtes obsolètes. Le calendrier réutilise le même visuel seulement quand le détail est déplié. Les APIs financières ne contactent jamais Google pour enregistrer le choix ; elles n’exigent ni photo ni service média disponible.

Google interdit le cache des noms de ressources photo, qui peuvent expirer. L’identité Place peut être conservée. La stratégie garde donc l’identité du restaurant et la préférence utilisateur, puis résout les médias à l’affichage. [Documentation des photos Google](https://developers.google.com/maps/documentation/places/web-service/place-photos), [règles Places](https://developers.google.com/maps/documentation/places/web-service/policies).

## Preuves ciblées

Commandes exécutées depuis la racine du dépôt avec le Node embarqué, présentées ici sous la forme `node` :

| Commande | Résultat |
| --- | --- |
| `node scripts/check-phase2-project-visuals.mjs` | PASS |
| `node scripts/check-phase2-google-places.mjs` | PASS |
| `node scripts/check-phase2-project-wizard.mjs` | PASS |
| `node scripts/check-phase2-planned-calendar.mjs` | PASS |
| `node scripts/check-architecture-imports.mjs` | PASS, 731 fichiers |
| `node node_modules/typescript/bin/tsc --noEmit` | PASS |
| `git diff --check` | PASS |
| `node node_modules/next/dist/bin/next build` | PASS, compilation, TypeScript et génération terminés |

Le nouveau test couvre :

- quatre, trois, deux, une et zéro photos ; classement et unicité ; photos d’un autre lieu exclues ;
- renouvellement des références expirantes, préférence hors top quatre et disparition d’une photo ;
- URLs média refusées et échec individuel sans perdre les autres choix ;
- Preview identique avec/sans photo sur gross, payable, fuel, impact et funding ;
- Save/reload de la préférence ; aucune donnée média Google persistée ;
- changement/retrait/saisie manuelle du restaurant, Undo et ancienne row sans visuel ;
- payloads invalides refusés sans écriture ; Save sans photo accepté ;
- présentation 16:9, métadonnées, actions et attributions ; contrat HTTP galerie et parsing strict.

Toutes les écritures du harness concernent uniquement ses fixtures prospectives en mémoire. Les moteurs financiers et les authorities historiques ne sont pas modifiés.

### Navigateur local

Vérification réelle de `/mois-a-venir` dans la session existante, viewport desktop 1280 × 720 :

- carte fermée mesurée à 392.19 × 221.19 px ; titre/date/montant visibles ; ouverture des actions conservée ;
- choix du résultat Google du restaurant dans un brouillon d’édition local, puis résumé ;
- quatre vraies photos Google disponibles, attribution visible, première sélectionnée automatiquement ;
- clic sur la troisième photo : elle seule passe à `aria-pressed=true` ;
- résumé et bouton « Voir l’effet sur notre mois » visibles sans nouvelle page ;
- aucune erreur dans la console navigateur observée ;
- brouillon quitté sans sauvegarder ; projet enregistré conservé.

Captures conservées hors Git et hors production :

- `C:/Users/Manon/Documents/Codex/2026-09-28/ve/outputs/phase2-v2-3-photos-summary.jpg`
- `C:/Users/Manon/Documents/Codex/2026-09-28/ve/outputs/phase2-v2-3-project-card.jpg`

Le projet existant observé ne contient pas d’identité Google : sa carte affiche le fallback. Les photos apparaissent après sélection explicite d’un résultat Google, sans rapprochement silencieux. La sauvegarde/relecture du choix est testée avec le serveur synthétique ; aucun Save/Update/Delete live ou déploiement CLI n’est exécuté pour ce lot.

## Fichiers changés

| Couche | Fichiers |
| --- | --- |
| Intention/validation partagée | `planned-contract.ts`, `planned-project.ts`, `planned-builder.ts`, nouveau `planned-visual.ts` |
| Normalisation fournisseur | `restaurant-places.ts` |
| Serveur Google existant | `src/server/places/google-places.ts`, `http.ts` |
| UI | nouveaux `project-hero-card.tsx`, `project-visual-picker.tsx` ; `restaurant-photo-background.tsx`, `contextual-project-wizard.tsx`, `planned-expenses-control.tsx`, `month-calendar.tsx`, `calendar-presentation.ts`, `project-wizard-fields.tsx`, `project-wizard.module.css` |
| Preuves | nouveau `scripts/check-phase2-project-visuals.mjs`, commande dans `package.json`, ce rapport |

## Limites connues

- L’ordinal conservé est une préférence stable dans le projet, pas une identité immuable de photo. Si Google réordonne les photos, la même position peut désigner une autre photo ; si elle disparaît, le meilleur candidat disponible prend le relais. Une photo strictement immuable nécessiterait une autre source disposant de droits de stockage explicites.
- Le classement évalue résolution et format, pas le sujet, l’exposition ou une composition esthétique. L’utilisateur choisit le rendu final.
- Photos et sélection navigateur vérifiées sur le cas réel disponible ; Save/reload et cas dégradés prouvés avec fixtures. Aucun PASS de sauvegarde live ou de déploiement Vercel n’est revendiqué.
- Les longues attributions/périodes peuvent demander davantage de hauteur ; les données restent lisibles sans troncature. Le scope reste desktop, conformément à la demande utilisateur.
