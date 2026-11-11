# Progression autonome — intégration Clay V22

État : **LOCAL_INTEGRATION_READY_FOR_REVIEW**. Branche locale : **codex/m15-clay-integration**, issue de 91cd52313886457f2a22bf26abc1dcb86fca1276. Les tests approfondis restent **DEFERRED_TESTING**.

## Ce qui a été développé

Les campagnes M11 à M14.1 étaient terminées avant cette session et n’ont pas été recommencées. Cette session raccorde les nouveaux médias au code applicatif local :

- **BuilderIllustration** : 345 clés certaines, dont les recherches et sélections d’objets, scènes et choix existants. Les canaux et catégories trop génériques gardent leur image historique.
- **BarProductVisual** : objets des cartes ouvertes et fermées, tuiles, mini-éditeur et Dock ; verre de vin, vin générique et bouteille, diluant et soft, snack et nourriture de club restent distincts. Les branches historiques et l’icône finale restent disponibles en cas d’échec.
- **ContextPalette / WorkshopDock** : clés catalogue explicites, modes de transport et options de repas publiés ; aucune nouvelle permission ni admission d’objet.
- **ComposerLibrary** : illustrations des intentions génériques existantes. Les presets protégés conservent leur composant et leurs images.
- **ContextCard, ContextSatellite et VisualCluster** : scènes génériques non protégées et miniatures de produits possédant réellement productAssetRef ; les références en lecture seule et les branches spécialisées gardent leur fonctionnement.
- **Cinéma** : billet, popcorn, boisson générique et suggestion Taxi explicite. Un trajet déjà choisi n’est pas supposé être un taxi.
- **Séjour court** : suppléments Petit-déjeuner / Taxe de séjour et types d’hébergement identifiés. Aucun supplément ni montant n’est ajouté par l’illustration.
- **Cadeau** : aperçu de l’objet effectivement choisi et choix illustrés ; le libellé libre reste indépendant de l’identité catalogue.
- **Catalogue spécialisé** : raccourci de prix Mascara relié à son objet, sans remplacer le preset Mascara protégé.
- **BarLivingCard** : fond spécialisé M14.1 branché en CSS, en conservant son masque et son gabarit.

## Compteurs sans ambiguïté

| Priorité | Identités reliées à des consommateurs locaux | Uniquement préparées |
|---|---:|---:|
| P0 | 43 | 0 |
| P1 | 160 | 0 |
| P2 | 0 | 429 |

« Reliée » signifie qu’une résolution de média est branchée dans un consommateur existant ou une suggestion explicite. Cela ne signifie ni que toutes les identités sont visibles simultanément, ni qu’elles sont admissibles dans chaque mois ou pour chaque utilisateur. Les contrôles métier et les états du modèle continuent à décider quels choix existent.

Les **201 clés catalogue** non protégées sont associées à leur concept attesté. Les **9 clés catalogue protégées**, représentant les 8 identités historiques hors presets, restent sur leur rendu existant. Les 47 presets historiques restent inchangés, soit 55 identités protégées au total. Les **429 P2** sont enregistrées dans collection.json et accessibles par loadClayV22Collection / clayCatalogArtwork, sans ajout d’objets fictifs à la Library.

Le paquet public comprend **865 WebP** : les 838 exports M14.1 et **27 variantes compactes techniques** supplémentaires, dérivées des bonnes sources M13 avec la géométrie de groupe M12, sans retouche artistique. Poids : **16611390 octets**, soit **16.611 Mo**. Les petits consommateurs ne chargent pas les panoramas. Les 345 alias Builder et les métadonnées des 203 identités actives sont de simples références ; aucun binaire n’est importé dans le JavaScript. Le catalogue complet, 283066 octets, est demandé uniquement par un consommateur qui l’appelle explicitement. La virtualisation de BoardCarousel n’a pas été modifiée.

## Vérification allégée réellement exécutée

- TypeScript global sans émission : réussi après intégration. Aucun build Production ni suite financière lancée.
- Chemins, poids et SHA des 865 nouveaux fichiers applicatifs : contrôlés. Il ne s’agit pas d’une nouvelle vérification des 632 PNG sources.
- Composants React de présentation réellement montés dans une fixture locale, desktop 1360 px et mobile 390 px : 49 images chargées par viewport, aucune image cassée ni erreur JavaScript dans cette vérification. Le fallback du nouveau média vers l’historique, puis vers l’icône si les deux fichiers échouent, est vérifié.
- Distinctions verre / vin générique / bouteille et diluant / soft contrôlées. Les fichiers historiques n’ont pas été écrasés. Aucun fichier de domaine, serveur ou Supabase n’a été modifié.

Le montage de présentation n’est pas une exécution authentifiée du Composer complet. Les captures n’attestent pas les interactions, le contexte métier complet ou les performances de Production. Les derniers ajustements de taille des vignettes génériques restent inclus dans la revue applicative différée.

## Limites et suite

Seize alias trop généraux gardent leur fallback historique : achat en ligne, retrait, à emporter, catégories beauté/maison, type de prestation automobile, etc. Une image de livraison ne représente pas automatiquement des frais, ni un repas livré lorsqu’il s’agit d’un achat générique. Les choix avec un sens précis — livraison de repas au travail ou en fast-food, par exemple — sont raccordés.

Les presets ne sont pas remplacés par des objets proches. Les éléments P2 sans place métier restent préparés ; aucune nouvelle fonctionnalité, aucun owner et aucun mediaKey ne sont créés. Le catalogue métier demeure à 210 entrées.

Le protocole complet à exécuter au retour figure dans **M15-TESTS-A-EXECUTER-APRES-SESSION.md** : E2E authentifié, régression, cadrages dans le Composer complet, réseau réel, multi-navigateurs et certification. Ces tests ne sont pas présentés comme réussis. Aucun push, PR, merge ou déploiement n’est effectué.

## Fichiers de reprise

- work/clay-campaign/m15/M14-2-MAPPING.json : associations, preuves, cas différés et statut de chaque identité.
- work/clay-campaign/m15/M15-TECHNICAL-DERIVATIVES.json : provenance des 27 variantes supplémentaires.
- outputs/m15/M15-TARGETED-CHECKS.json : contrôles rapides et compteurs.
- outputs/m15/M15-REPRESENTATIVE-COMPONENTS.json : limites et résultat du montage de présentation.
- outputs/m15/integration-desktop.png et integration-mobile.png : captures de contrôle.
- Dépôt : src/app/mois-a-venir/clay-v22-media.ts, clay-v22-bindings.json, clay-v22-catalog.ts et public/planned-visuals/builder/clay/v22/collection.json.

Les prochaines étapes utiles sont la campagne différée dans le Composer authentifié et la revue des 16 alias ambigus avec leur contexte d’affichage. Ajouter des P2 à l’interface sans fonctionnalité métier existante sortirait du mandat. Le solde du quota n’est pas observable par les outils de cette session.
