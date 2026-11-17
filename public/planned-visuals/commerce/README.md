# Illustrations des badges Composer

Pour préparer une génération individuelle, ouvrir **Marchands → À illustrer**
(`/parametres?vue=generation`). La vue applique `merchants.badge_policy` et
retire les fiches déjà illustrées dans le registre de l’app. Vérifier aussi la
collection locale avant de générer une image. Les fiches `reuse_only` utilisent
les visuels partagés ou génériques disponibles. Les fiches `none` ont un
affichage neutre. La politique se modifie dans le référentiel Supabase.

Le registre est `src/ui/media/commerce-illustrations.json`. Chaque entrée utilise
les dimensions `width`, `height` et le chemin `src` des médias Budgetisation.

Les clés des entreprises sont des identifiants confirmés, par exemple
`merchant:<merchant_id>` ou `place:<place_id>`. La plateforme Amazon utilise
`platform:amazon`. Aucun libellé ni slug calculé depuis un nom ne sert de clé.
Une association globale doit être revue avec le fichier fourni et son droit
d’utilisation avant son ajout au registre.

Placer les fichiers dans les sous-dossiers suivants, puis ajouter leur entrée
au registre. Toutes les cartes utilisant cette identité seront mises à jour.

- `merchants/<merchant_id>.webp`
- `places/<place_id>.webp`
- `platforms/amazon.webp`
- `categories/groceries.webp`, `categories/restaurant.webp`, etc.

Les clés de catégories sont définies dans `BADGE_CATEGORIES`.
Le registre initial est vide. Les pictogrammes actuels servent de fallbacks.
Un échec de chargement passe au visuel de catégorie puis au pictogramme.
Le CSV de collecte ne crée aucune identité et aucune association.

Les illustrations importées depuis Composer sont privées au compte.
Elles passent par la bibliothèque et le bucket privés préparés dans
`20261115211441_composer_badge_library.sql`. Cette migration additive doit être
autorisée et appliquée avant leur activation en Production. Les fichiers
globaux versionnés restent distincts des imports personnels.

## Séquence de mise en service

M11/M12 (`acba676`) peut être publié indépendamment. La branche
`codex/m09b-production-ready` reprend M09-B au-dessus de ce commit ; les branches
et commits d'origine restent conservés.

Avant toute application, obtenir l'autorisation explicite pour le Supabase
principal `ipuuhxrblxormwgoaqnz`. La seule migration nécessaire est
`supabase/migrations/20261115211441_composer_badge_library.sql` : deux tables de
préférences privées, cinq politiques RLS et un bucket privé. Aucune autre
migration en attente ne doit être appliquée par lot.

1. Recontrôler l'absence des deux tables, du bucket et de cette version de
   migration. En cas d'objet déjà présent, comparer son contrat avant de continuer.
2. Appliquer uniquement cette migration après autorisation. Le bucket
   `composer-badge-illustrations` accepte les WebP de 2 Mo maximum ; l'import
   serveur valide les PNG/WebP de 5 Mo maximum puis les réduit à 512 pixels.
3. Vérifier RLS sur les deux tables, droits `authenticated` et refus `anon`,
   bucket `public=false`, et politiques Storage limitées au préfixe du compte.
   Vérifier aussi qu'aucune autre politique permissive ne donne accès à ce bucket.
4. Après autorisation distincte de publication, intégrer la branche M09-B et
   laisser le projet Vercel `budgetisation` construire la Production. Vérifier
   l'état READY et le commit associé au domaine `budgetisation-tan.vercel.app`.
5. Contrôler en lecture seule les fallbacks. Une recette d'import personnel sur
   le principal nécessite une autorisation spécifique pour le média fictif et
   son nettoyage ; la recette isolée existante reste la preuve de persistance et
   d'isolation entre comptes tant que cette autorisation n'a pas été donnée.

Les lectures et imports utilisent le client authentifié et RLS, sans clé
privilégiée pour écrire les préférences. Le remplacement importe un nouvel objet
UUID puis retire l'ancien après confirmation : il ne nécessite pas d'UPDATE
Storage ni d'upsert. Les suppressions restent limitées au dossier du compte.
Les URL signées expirent après cinq minutes ; aucun média personnel n'est public.
La bibliothèque globale commence vide, avec les pictogrammes disponibles :
l'activation ne dépend pas de la livraison des logos Clay et n'ajoute aucune
variable d'environnement ni modification financière.
