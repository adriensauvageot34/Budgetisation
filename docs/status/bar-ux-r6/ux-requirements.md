# Bar UX R6 — registre de travail

Base main/Production aef5c03, PR69. Vérifiés avant création de branche. R5 receipt local fa94ccd reste sur sa branche. Source normative R6 lue intégralement ; EXTRACTION21 et audit175 lus intégralement (versions sans suffixe (1) présentes). Le texte collé213832 et les captures spécifiques mentionnés ne sont pas disponibles : les descriptions du prompt sont les oracles, pas des images prétendument observées.

## G0 ciblé

Preuves de départ réutilisées : docs/status/geometry-r5/proofs/screenshots/final-eb96-rich-1920.png et release-* ; source produit eb96 identique à main aef (docs seules ensuite). Visuellement : tuiles Bière séparées et dispositions hétérogènes, Before et action de moment dans les métadonnées, pas de sélecteur financier visible, actions ⋯/punaise ambiguës, dock2options très haut. Le trajet multi-lignes et les villes auto-suggérées sont confirmés au code courant. Recherche R5 géométrique = MOCK, aucun PASS Google live déduit. Les 2selectionId restent distincts ; comparer uniquement des références produit/unités/scopes compatibles. Aucune fusion de données.

Carte financière avant mutation : finance-scopes.md. Owners réutilisés : BarLivingCard/Editor, BarComponentFace/ProductVisual, bar-before, ContextPalette, RestaurantSearchSession et API places, night-out-venue/edit, Compiler/V2, BarRouteLine, bar-surface/packer, control-value-presentation, registre Clay. Aucun nouveau provider ou writer financier.

## Nouveaux UXB (réception finale à compléter)

| ID | Owner / solution | Gate courant |
|---|---|---|
| UXB-01 | bar-component-group.tsx, tuile titre/Clay/badges | CODE, navigateur en attente |
| UXB-02 | component-group-presentation + night-out-presentation, rollup Compiler serveur | 13 tests synthétiques PASS, pas prix React |
| UXB-03 | BarMetadata, contexte séparé | CODE, navigateur en attente |
| UXB-04 | Editor/saveQuick/substituteNightOutCoverage | test segment60→détail/annulation PASS ; aucun nouveau contrat financier |
| UXB-05 | Editor/BarViewMemory, moments frères | Before/Au bar CODE ; **After reporté par décision utilisateur explicite pendant R6**, aucun bouton actif |
| UXB-06 | Card, Actions de la sortie / PRESERVE | CODE, protections conservées |
| UXB-07 | ContextPalette/composerCSS | Dock court CODE ; rail150 à retester |
| UXB-08 | BarRouteLine fermé | À implémenter |
| UXB-09 | BarRouteLine + endpoints existants | À implémenter, garanties P1 préservées |
| UXB-10 | BarPlaceSearch/API existants | Diagnostic et fournisseur réel à exécuter ; pas de PASS mock |
| UXB-11 | Before éditorial / densité / accents | Image dédiée générée, pas encore intégrée ni certifiée à taille réelle |
| UXB-12 | Microtextes / statuts / canaris21 | À finaliser |

## 21 IDs normatifs — décisions originales préservées

| ID | Statut R5 | Solution / preuve prévue |
|---|---|---|
| UI-054 | EXPÉRIMENTAL | EXPERIMENT_DEFERRED, lieu texte opaque, pas photo obligatoire |
| UI-068 | EXPÉRIMENTAL | EXPERIMENT_DEFERRED, pas raccourci week-end artificiel |
| UI-077 | DIFFÉRÉ | Initiales/IDs, pas portrait |
| UI-083 | DIFFÉRÉ | Aucun PNG personnel lu ou créé |
| UI-094 | EXPÉRIMENTAL OFF | Aucun autoscroll de survol |
| UI-103 | EXPÉRIMENTAL OFF (survol) | Rail natif/flèches/clavier conservés, canari150 |
| UI-108 | RETENU R5 | Une scène Before dédiée, imagegen ; réception à faire |
| UI-112 | RETENU CIBLE UX | Même illustration que108, pas un achat |
| UI-183 | RETENU R5 | Décor dans empreinte utile |
| UI-184 | RETENU R5 | Densité de scène visible, pas30postes cachés |
| UI-185 | EXPÉRIMENTAL | Pas de banque de motifs, effets sobres évalués au Board |
| UI-188 | RETENU R5 | Tokens communs pour4univers, sans nouveau design system |
| UI-189 | RETENU R5 | Texte sur surface opaque, ombres discrètes |
| UI-190 | HYPOTHÈSE À MESURER | Palette à juger sur Board, pas certification native125 |
| UI-191 | RETENU CIBLE UX | Accent décoratif sans nouvelle hauteur |
| UI-192 | DIFFÉRÉ | Une ambiance, pas de variantes |
| UI-193 | SOUS CONTRAT | Aucun writer variante |
| UI-194 | SOUS CONTRAT | Aucune catégorie déduite d'un nom/photo |
| UI-195 | RETENU CIBLE UX | Aucune question obligatoire type de bar |
| UI-196 | DIFFÉRÉ | Aucun Changer l'ambiance |
| UI-219 | SOUS CONTRAT | Copie visible courte, explication complète accessible, Finance inchangée |

Les 4 reports individuels/OTHER, Auth durable, native125 restent reportés. Pas de nouvelle migration, aucun Apply réel ni écriture dans le Draft personnel. Promotion seulement après vraies preuves Google/Preview/build et contrôles de dépôt. Après utilisateur : After accepté comme report explicite R6, pas un PASS d'implémentation.
