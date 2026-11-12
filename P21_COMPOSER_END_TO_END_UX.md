# P21 — Parcours Composer de bout en bout

Référence : `STRAT:P21-RECENTRAGE@v1`.
Branche : `codex/p21-composer-end-to-end-ux`.
Base vérifiée sur GitHub avant modification, puis revérifiée : `eceb34b582fd5f6213e1ce230d94671bfc948801` (fusion #120).

## A. Fonctionnalités développées

- Sélecteur « Mes intentions » dans le bandeau et « Intention en cours » dans les éditeurs. La sélection utilise l'identifiant exact de l'occurrence ; les homonymes sont distingués par un numéro et la date disponible.
- Retour explicite « Mes intentions », révélation de la bonne carte et conservation de la sélection après fermeture ou restauration par l'historique. Un panneau ouvert conserve le focus ; la révélation du Board ne lui vole plus le clavier.
- Cinéma, Week-end et Courses rejoignent la recherche des occurrences existantes. Entrée sur un résultat unique rouvre l'intention au lieu d'en créer une autre. L'ajout d'une autre occurrence reste une action explicite, y compris sans recherche.
- Retour vers une intention déjà ouverte sans remonter son éditeur ni effacer son RAW. Les protections existantes demandent de continuer, abandonner ou, lorsque le contrat le permet, valider la saisie avant de changer d'intention.
- Gestion commune du masquage des suggestions, locale à l'occurrence jusqu'au rechargement, avec restauration du focus sur le contrôle. Le classement et la limite de quatre suggestions restent ceux des adaptateurs existants.
- Explications Restaurant/Cinéma orientées vers l'action ; les références de classement restent dans les données et les informations avancées. Les compléments Restaurant sont explicitement distingués des détails compris. Les homonymes du séjour affichent ligne, quantité et prix.
- États de sauvegarde distincts : mémoire, attente, en cours, confirmation serveur, erreur, conflit et hors ligne. La saisie non validée dispose de sa propre indication. Une organisation locale suspendant la persistance ne peut pas afficher « Sauvegardé ».
- Messages compréhensibles pour les montants ou quantités refusés, sans modification du parsing ni effacement des buffers.
- Précision sur la capacité d'une source de financement déclarée. Sous 380 px, le coût total prend une ligne et les deux autres montants gardent des colonnes lisibles.
- Corrections de chevauchement du Dock Restaurant, de compression du formulaire Mascara et de réserve verticale des panneaux sur téléphone étroit. Les champs et confirmations restent accessibles par défilement.

## B. Avant / après

| Situation | Avant | Après |
| --- | --- | --- |
| Retrouver Cinéma, Week-end ou Courses | Absents de l'index restreint des occurrences | Recherche et réouverture de l'occurrence existante |
| Passer d'un projet à un autre | Retour et nouvelle recherche | Sélecteur commun, sans mutation par consultation |
| Retour depuis un éditeur | Révélation surtout spécialisée Bar/Mascara | Même destination explicite sur les éditeurs concernés |
| Ajouter une occurrence déjà présente | Distinction surtout pendant une recherche | « Ajouter un autre » aussi dans les catégories |
| Masquer une proposition | Présentations et gestion du focus différentes | Même contrôle local sur les sept parcours |
| Enregistrement et saisie RAW | Indications dispersées | États distincts dans le bandeau de sauvegarde |
| Montant partiel refusé | Code interne possible | Message de correction ; texte conservé |
| Très petit écran | Résumé serré et réserve du Dock insuffisante | Résumé réorganisé et panneaux séparés du Dock |

## C. Sept parcours intégrés

Les parcours utilisent le vrai ComposerShell, ses éditeurs et le Compiler, hébergés dans la fixture C8 existante. Toutes les valeurs sont synthétiques.

| Parcours | Actions réellement effectuées par le navigateur | Résultat |
| --- | --- | --- |
| Cinéma | Recherche, ajout, billet 12 €, RAW `12,` refusé et conservé, popcorn distinct 4 €, billet modifié puis Undo, réouverture | 16 €, identifiant du billet conservé, aucune duplication |
| Restaurant | Addition 40 €, bière comprise 6 €, supplément distinct 6 €, modification du détail compris à 5 € | 46 €, addition et supplément inchangés, même identifiant de détail |
| Week-end | 100 €/nuit × 2 puis forfait 200 €, type Hôtel, examen du petit-déjeuner sans adoption, taxe distincte 8 € | 208 €, deux nuits et identité d'hébergement conservées, aucun petit-déjeuner ajouté automatiquement |
| Amazon | Shampoing ×2 à 9 €, homonyme ×1 à 5 €, livre 25 €, livraison distincte 5 €, modification ciblée du premier prix à 10 € | 53 € puis 55 €, trois lignes, autres lignes et identifiants préservés |
| Vêtements | Deux articles, dont un prix inconnu ; réouverture, RAW partiel, refus de sortie puis abandon explicite | Montant connu distingué du total à préciser ; aucun zéro inventé |
| Mascara | Produit à 12,50 €, validation, retour au résumé et modification de la quantité à 2 | 25 €, un produit conservé |
| Courses | Panier 8 €, rattachement déclaré à l'enveloppe disponible dans la fixture, édition à 9 € puis Undo | Retour à 8 €, même ligne ; décomposition issue du Compiler |

Chaque format couvre ensuite un Board commun aux sept intentions, les transitions Restaurant/Cinéma/Week-end/Amazon, une navigation refusée avec RAW puis autorisée après abandon, deux occurrences Cinéma homonymes, Undo/Redo et un Reload durable.

Les snapshots avant/après Reload conservent intégralement le Draft, sa version, son digest, les UUID et les archives de fixture. Aucun Plan actif ni PlanRevision n'est créé. Un échec de sauvegarde est également provoqué : l'interface reste en erreur, puis SAVING pendant le réessai, et SAVED seulement après confirmation ; une seule version est créée.

## D. Contrôles exécutés

| Contrôle | Résultat / portée |
| --- | --- |
| TypeScript, `git diff --check` | PASS |
| `check-composer-journey-ux.mjs` | PASS — cinq groupes : sept occurrences, homonymes, droits/mois, états de sauvegarde, erreurs RAW |
| `check-restaurant-suggestions.mjs` | PASS — dix cas, dont Cinéma S1/S2, cibles obsolètes et absence de mutation distante |
| `check-composer-v22-a06-stay.mjs` | PASS — douze cas Week-end/Compiler, droits et Mobility |
| `check-composer-purchase-basket.mjs` | PASS — Amazon, compatibilité, Vêtements, Courses et Save/Reload SQL isolé |
| `check-composer-v22-a07-clothing.mjs` | PASS — huit cas, inconnu/zéro/devis, identités et protections |
| `check-composer-v22-a1-mascara.mjs` | PASS — quinze cas, prix français, quantité et non-duplication |
| `check-composer-budget-impact.mjs` | PASS — cinq groupes, sept résumés, six états Courses, données partielles, stale/digest et réessai READ |
| `check-clay-discovery.mjs` | PASS — 687 identités, recherche, contexte, chemins et allowlist |
| Navigateur 1 280 × 720 | PASS — sept parcours + Board commun + Reload durable |
| Navigateur 390 × 844 | PASS — sept parcours + Board commun + Reload durable |
| Navigateur 360 × 800 | PASS — sept parcours + Board commun + Reload durable, après correction ciblée de la réserve du Dock |
| Échec / réessai de sauvegarde | PASS — fixture durable, aucun faux succès, aucun Apply |
| Session authentifiée distante / RLS réelles | NOT_RUN — aucune de ces preuves synthétiques ne les certifie |
| Apply / PlanRevision | NOT_RUN — hors mandat |

Le navigateur intégré étant indisponible dans les réglages Work, la recette utilise Playwright déjà installé avec Chrome headless, un profil isolé et le serveur de fixture existant. Aucun réglage de sécurité n'est modifié.

Les contrôles navigateur vérifient le digest en consultation, les montants après confirmation, les identifiants, l'absence de débordement horizontal et de chevauchement panneau/Dock, ainsi que l'absence d'erreur JavaScript. Les captures et résultats restent dans `outputs/p21-journey-evidence/`, hors commit. Les 14 parcours ordinateur/mobile ont été conservés ; seule la largeur 360 px a été rejouée après sa correction spécifique.

### Rejouer les contrôles

`node scripts/check-composer-journey-ux.mjs` réutilise les fixtures existantes sans dépendance supplémentaire.

Le navigateur nécessite le serveur `scripts/serve-phase2-planner-composer-fixture.mjs`, sa configuration esbuild/CSS déjà disponible et Playwright déjà installé. Définir `PLANNER_PLAYWRIGHT_TOOLS` vers ce dernier, puis exécuter `node scripts/check-composer-journey-browser.mjs`. Le script refuse une origine distante. `COMPOSER_UX_WIDTHS=360` permet de rejouer uniquement le format étroit. Le transport durable de ce serveur est synthétique : il ne prouve pas une sauvegarde Supabase authentifiée.

## E. Périmètre de livraison

Les changements concernent la présentation, la navigation et leurs tests. Le Compiler, Finance V2, les writers, le protocole de Draft, Auth/RLS, les gates, les migrations et les dépendances sont conservés. Le fichier de domaine modifié est exclusivement l'index de présentation de la bibliothèque.

Les capacités et owners existants restent décisionnaires ; aucun montant ou financement n'est calculé dans les nouveaux composants. Les résultats financiers périmés restent masqués par le mécanisme de #120. Les suggestions ne deviennent des décisions qu'après validation explicite.

La publication autorisée est limitée à la branche, à sa PR et à la Preview. Le SHA publié, le numéro de PR et l'état exact des contrôles distants sont relevés dans le compte rendu de livraison et la description de PR, après construction du commit. Aucun fichier de `outputs/`, secret, classeur privé ou donnée bancaire ne doit être ajouté.

Fichiers du périmètre, depuis la racine du dépôt :

```text
P21_COMPOSER_END_TO_END_UX.md
scripts/check-composer-journey-browser.mjs
scripts/check-composer-journey-ux.mjs
scripts/check-restaurant-suggestions.mjs
src/app/mois-a-venir/composer/asset-editor-routing.ts
src/app/mois-a-venir/composer/board-carousel.tsx
src/app/mois-a-venir/composer/catalog-context-editor.tsx
src/app/mois-a-venir/composer/clothing-item-editor.tsx
src/app/mois-a-venir/composer/composer-library.tsx
src/app/mois-a-venir/composer/composer-save-status.tsx
src/app/mois-a-venir/composer/composer-shell.tsx
src/app/mois-a-venir/composer/composer.module.css
src/app/mois-a-venir/composer/equipment-component-editor.tsx
src/app/mois-a-venir/composer/family-visit-editor.tsx
src/app/mois-a-venir/composer/intent-budget-impact.module.css
src/app/mois-a-venir/composer/intent-budget-impact.tsx
src/app/mois-a-venir/composer/purchase-basket-editor.tsx
src/app/mois-a-venir/composer/restaurant-editor.tsx
src/app/mois-a-venir/composer/restaurant-suggestions.ts
src/app/mois-a-venir/composer/short-stay-editor.tsx
src/app/mois-a-venir/composer/suggestion-controls.tsx
src/app/mois-a-venir/composer/workshop-error.ts
src/app/mois-a-venir/composer/workshop-navigation.module.css
src/app/mois-a-venir/composer/workshop-navigation.tsx
src/domain/phase2/planner/composer-library-index.ts
```

## F. Limites et décision

Les preuves locales ci-dessus sont PASS. La décision `READY_FOR_MERGE` dépend encore de la correspondance entre le SHA publié, les contrôles GitHub et la Preview READY. Une Preview protégée ne constitue pas, à elle seule, un défaut produit ; sa recette authentifiée doit rester explicitement NOT_RUN lorsqu'elle est inaccessible.

S3, certification Apply, édition des finances mensuelles et création de Draft distant sont hors périmètre. Aucune donnée financière de Production ni aucune archive existante n'a été modifiée par cette mission. La PR ne doit pas être fusionnée sans une nouvelle autorisation.
