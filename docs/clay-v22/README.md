# Illustrations Clay V22 — intégration locale

Les illustrations décorent les identités déjà publiées. Elles ne constituent jamais une permission d’ajout, une preuve de prix, un SKU, un owner ou un nouveau `mediaKey`.

- `clay-v22-bindings.json` contient uniquement les 203 identités P0/P1 actuellement reliées et leurs alias certains. Les 16 choix trop généraux conservent le fallback de `builder-illustration-registry.json`.
- `clay-v22-media.ts` résout les clés exactes, les modes et les repas publiés. Les petits consommateurs utilisent la compacte lorsqu’elle existe, sinon la primaire carrée ; Builder utilise sa variante large. Les échecs reviennent au média historique puis à l’icône existante.
- `public/planned-visuals/builder/clay/v22/` contient 865 WebP : 838 issus de M14.1 et 27 compactes techniques de scènes. Aucun fichier historique n’est écrasé.
- `collection.json` recense les 632 identités et leurs empreintes. Il reste hors du bundle JavaScript courant. Les 429 P2 sont uniquement préparées.
- `PresetIllustration` et ses 47 presets gardent leurs sources historiques. Les 8 autres identités protégées restent sur leurs représentations existantes.

Exemples de résolution dans un composant de présentation :

```ts
clayAssetArtwork('restaurant:wine_glass'); // verre de vin, pas bouteille
clayAssetArtwork('house_party:wine');     // vin générique
clayBuilderArtwork('intent:restaurant'); // scène de restaurant, pas un objet acheté
```

Pour un futur consommateur qui possède déjà sa propre identité métier et ses droits :

```ts
const collection = await loadClayV22Collection(); // à appeler à la demande
const entry = collection.entries.find(item => item.visualConceptId === knownVisualConceptId);
const artwork = entry ? clayCatalogArtwork(entry) : undefined;
```

Trouver une image ne rend jamais une intention admissible. Ne pas exposer les 429 concepts comme objets achetables sans fonctionnalité existante.

La provenance, le mapping et les tests différés sont conservés dans ce dossier. Les commandes techniques de reprise éventuelles sont locales, à utiliser seulement pour modifier volontairement le paquet :

```powershell
node scripts/import-clay-v22.mjs . '<dossier de la campagne avec outputs/m13 et outputs/m14-1>'
node scripts/refine-clay-v22-compact.mjs . '<même dossier de campagne>'
```

L’import contrôle les associations contre le catalogue courant et refuse les collisions ; la seconde commande conserve les compositions entières avec les géométries M12 et les bonnes finales M13. Ces outils ne doivent pas être exécutés pour une simple consultation ou une reprise des tests différés. Ils ne régénèrent aucune illustration artistique, ne modifient pas les maîtres et n’exécutent aucune opération distante.

État actuel : intégration locale, validation approfondie à faire. Aucun déploiement ni publication.
