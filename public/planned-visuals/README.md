# Illustrations du Builder — Clay

Bibliothèque du 3 octobre 2026 pour « Ajouter une dépense ». La carte reste du React/CSS Glass ; l'image représente seulement l'objet, sans label, icône UI, prix ou sélection incorporés.

## Collection

- **164 illustrations individuelles**, générées avec imagegen, sans découpage de la référence ni atlas.
- **326 choix sémantiques illustrés**, dont les **210 assets du catalogue de coûts** ; 44 alias de scènes assurent la compatibilité des écrans secondaires.
- WebP, **1200 × 600**, qualité 82, ratio 2:1 ; **1 781 288 octets** pour les images de la collection.
- Argile mate ivoire/perle/crème, touches lavande, lumière diffuse haut/gauche, sujet à droite et zone calme à gauche/bas.
- Toute voiture utilise la même **Peugeot 207 rouge**, exception explicitement demandée.
- Même objet, même fichier : desserts, voitures, tickets et coûts réutilisés entre plusieurs flows.

## Mapping et intégration

Le mapping utilisé par React est exclusivement dans `src/app/mois-a-venir/builder-illustration-registry.json`. Il distingue les fichiers (`illustrations`) et leurs usages (`choices`). Clés explicites : `intent:restaurant`, `asset:restaurant:dessert`, `choice:transport:CAR`, `module:gift`, etc. Aucun rapprochement approximatif de labels.

`builder-illustrations.tsx` expose `BuilderIllustration`, `builderIllustration()` et `builderChoiceKey()`. Son fallback conserve la carte native quand la clé n'a pas d'image ou quand une image échoue. `personalSrc` permet à un appelant de fournir ultérieurement une illustration personnelle ; aucune mémoire ou table supplémentaire n'est créée.

`builder/clay/manifest.json` est un document de provenance et d'export, pas une seconde règle métier ou un resolver. L'inventaire complet est dans `docs/design/builder-clay-inventory.json`.

## Dossiers

```text
builder/clay/
  intent/       social/       outing/
  food/         drinks/       transport/
  lodging/      misc/         activities/
  beauty/       clothing/     household/
  home/         tech/         automotive/
  manifest.json
```

## Exclusions

Personnes réellement nommées, domiciles et lieux personnels restent neutres : notamment Servian, Fontès, Isabelle, Marc et le père d'Adrien. Les véritables photos de restaurants et logos de marques restent dans leur circuit existant. Le manifeste et le rapport de livraison contiennent la liste détaillée.

Champs, dates, prix, quantités, switches, navigation, décisions sans objet (« Pas encore », budget inconnu), variantes de trajet et résultats calculés restent des contrôles natifs.

## Mouvement et vérification

Hover : image à 1.025 et déplacement de 1 px ; press discret ; bord de sélection lavande. `prefers-reduced-motion` désactive ces transformations. Les images sont décoratives, chargées paresseusement et décodées de façon asynchrone.

Commande : `npm run check:phase2-builder-illustrations`.

Rapport : `docs/status/phase2-builder-clay-2026-10-03.md`.

L'ancien atlas et les neuf images cristal ont été retirés après audit des références de production. `GLASS_PROMPTS.md` archive la direction précédente. `background-planned-depense.webp`, le fond marbré fourni par l'utilisateur, est conservé.
