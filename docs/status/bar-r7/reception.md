# Bar R7 — dock indépendant, carte progressive retenue

## Base et frontière de livraison

Base réelle : `96b4fd960343b49ad800c97c0f957b1dd513d97d`, merge #73 explicitement demandé pendant R7. Production R6.3 : `dpl_2EG2YYSy367mWSvqkrJnZB2J3GNN`, READY, alias budgetisation-tan.vercel.app ; le geste maintien/corbeille reste NOT_RUN_NATIVE_POINTER et n'est pas requalifié. Branche R7 `codex/bar-r7-progressive-ui`, fast-forward depuis cette base, aucune réécriture de #73.

R7 est **PARTIAL_DRAFT**, sans autorisation implicite de livrer une carte partielle. Le cahier demande de conserver Lot 1 et de reporter les Lots 2/3 dépendants si la conservation du direct exige un contrat absent : c'est la frontière retenue.

## Code livré pour revue

- ContextPalette : seulement appearance=bar + FAMILIES/OBJECTS ; aucun titre visible/recherche produit, retour « ← Familles » protégé par le RAW guard ; autres natures et autres assets inchangés.
- Rail continu complet, sans « Afficher la suite » produit : flèches, clavier, molette verticale transformée en déplacement horizontal tant qu'il reste du contenu, pavé tactile natif conservé, scrollbar uniquement masquée. Positions séparées par contexte/moment/famille.
- Familles 180×124, art 82 px ; produits 132×112, art 64 px. Aucun changement de Board, carte fermée, montant, sélection, grouping ou owner.
- Quatre images créées avec ImageGen puis intégrées physiquement en WebP 320px avec alpha dans `public/planned-visuals/builder/clay/r7/` : famille Boissons, vin, shot, eau. Bière/cocktail/soft reprennent les images -closed existantes ; Restauration reprend l'assiette main existante avec cadrage CSS. Les originaux de la carte fermée sont inchangés. L'homogénéité Clay finale reste une appréciation visuelle, pas un test financier.

## Blocage B5 précisément localisé

`substituteNightOutCoverage` retire la sélection agrégée de main/extras pour créer une nouvelle sélection détaillée. La preuve versionnée `coverageReplacement` contrôle le digest courant, mais ne conserve aucun ancien Component. `ComponentEconomicScope@v1` conserve uniquement kind et coveredSelectionIds, pas l'ancien coût, unité, financement ou objet. Le parser `composer-context-presentation@v1` n'admet que version/presetKey et ne peut pas servir clandestinement d'archive financière. `BarViewMemory` est explicitement transitoire et non sérialisé.

Il n'existe donc pas de retour durable représenté par ces contrats après remplacement et Draft/Reload. Undo immédiat ne constitue pas cette garantie. Aucun champ libre détourné, useState financier de secours, nouveau scope/parser/Compiler ou migration n'est introduit pour prétendre B5 PASS. L'étape minimale restante est une décision propriétaire versionnée de conservation/restauration des deux modes, protégeant financements, coveredSelectionIds et digest ; elle doit être prouvée avant la transition simplifiée et la recette de carte progressive. Les parcours sûrs actuels et les lignes legacy restent intégralement conservés.

## Matrice

| Critère | État de cette tranche |
|---|---|
|A1 familles / A2 produits et retour|CODE + REACT_PASS ; navigateur en attente|
|A3 illustrations|4 fichiers intégrés, références vérifiées ; revue visuelle en attente|
|A4 rail / A5 mémoire et owner|REACT_PASS ; navigateur en attente|
|B1/B2/B4 carte minimale et montant inline|DEFERRED_DEPENDENT_LOT ; pas annoncé livré|
|B5 direct↔détail durable|BLOCKED_CURRENT_CONTRACT|
|B6/B7/B8/B9/B10 moments/slots/rails carte|DEFERRED_DEPENDENT_LOT ; grouping existant conservé|
|B3 Répartir / B11 After|DEFERRED_EXPLICITLY ; aucun faux bouton ajouté|

## Vérifications réellement exécutées

- TypeScript exit 0 ; diff --check PASS.
- `check-bar-r7-dock.mjs` : 6 contrôles REACT_HANDLERS_SYNTHETIC PASS : catalogue intégral sans recherche, retour, flèches/clavier/molette, positions Bar/Before, scènes Familles/Personnes distinctes, références physiques des huit illustrations.
- `check-bar-subassets-r5-dock.mjs` : PASS. Le test de recherche 25/120/150 a été déplacé explicitement sur PEOPLE : la recherche produit est désormais retirée par exigence R7 ; le garde recherche des autres scènes reste exercé.
- `check-bar-subassets-r5-interactions.mjs` : 10 PASS / 1 FAIL, preuves conservées. L'assertion MOMENT_FAMILY_MEMORY cherche Ajouter une consommation alors que la scène summary est attachée au Before et cache les extras. Même échec reproduit avec l'éditeur original byte-for-byte de main, chargé sous un alias temporaire (imports partagés ContextPalette candidat conservés), mêmes 10 PASS. Ce diagnostic ne constitue pas une certification complète du main ; aucun golden ou assert n'est effacé pour masquer cet écart préexistant du rendu progressif.
- Finance 198 : UNCHANGED_NOT_RERUN, aucun changement financier dans cette tranche. Aucune somme React, mutation financière, Supabase, Apply, Plan/Draft personnel, SNAP-3 ou Google réel.
- Contrôle React selon le skill react-best-practices : hooks inconditionnels, effet wheel borné au rail avec nettoyage, aucune lecture réseau ni stockage sensible ; focus/clavier conservés. L'écoute non passive est locale et nécessaire au défilement horizontal, pas globale.

Preuves navigateur et build du SHA produit à compléter après l'unique Preview.
