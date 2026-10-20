# Bar R7 — dock indépendant, carte progressive retenue

## Base et frontière de livraison

Base réelle : `96b4fd960343b49ad800c97c0f957b1dd513d97d`, merge #73 explicitement demandé pendant R7. Production R6.3 : `dpl_2EG2YYSy367mWSvqkrJnZB2J3GNN`, READY, alias budgetisation-tan.vercel.app ; le geste maintien/corbeille reste NOT_RUN_NATIVE_POINTER et n'est pas requalifié. Branche R7 `codex/bar-r7-progressive-ui`, fast-forward depuis cette base, aucune réécriture de #73.

R7 est **PARTIAL_DRAFT**, sans autorisation implicite de livrer une carte partielle. Le cahier demande de conserver Lot 1 et de reporter les Lots 2/3 dépendants si la conservation du direct exige un contrat absent : c'est la frontière retenue.

## Code livré pour revue

- ContextPalette : seulement appearance=bar + FAMILIES/OBJECTS ; aucun titre visible/recherche produit, retour « ← Familles » protégé par le RAW guard ; autres natures et autres assets inchangés.
- Rail continu complet, sans « Afficher la suite » produit : flèches, clavier, molette verticale transformée en déplacement horizontal tant qu'il reste du contenu, pavé tactile natif conservé, scrollbar uniquement masquée. Positions séparées par contexte/moment/famille.
- Familles 180×124, art 82 px ; produits 180×112, art 64 px (largeur ajustée après réception pour environ cinq choix à 1440px, quatre à 1152px). Aucun changement de Board, carte fermée, montant, sélection, grouping ou owner.
- Quatre images créées avec ImageGen puis intégrées physiquement en WebP 320px avec alpha dans `public/planned-visuals/builder/clay/r7/` : famille Boissons, vin, shot, eau. Bière/cocktail/soft reprennent les images -closed existantes ; Restauration reprend l'assiette main existante avec cadrage CSS. Les originaux de la carte fermée sont inchangés. L'homogénéité Clay finale reste une appréciation visuelle, pas un test financier.

## Blocage B5 précisément localisé

`substituteNightOutCoverage` retire la sélection agrégée de main/extras pour créer une nouvelle sélection détaillée. La preuve versionnée `coverageReplacement` contrôle le digest courant, mais ne conserve aucun ancien Component. `ComponentEconomicScope@v1` conserve uniquement kind et coveredSelectionIds, pas l'ancien coût, unité, financement ou objet. Le parser `composer-context-presentation@v1` n'admet que version/presetKey et ne peut pas servir clandestinement d'archive financière. `BarViewMemory` est explicitement transitoire et non sérialisé.

Il n'existe donc pas de retour durable représenté par ces contrats après remplacement et Draft/Reload. Undo immédiat ne constitue pas cette garantie. Aucun champ libre détourné, useState financier de secours, nouveau scope/parser/Compiler ou migration n'est introduit pour prétendre B5 PASS. L'étape minimale restante est une décision propriétaire versionnée de conservation/restauration des deux modes, protégeant financements, coveredSelectionIds et digest ; elle doit être prouvée avant la transition simplifiée et la recette de carte progressive. Les parcours sûrs actuels et les lignes legacy restent intégralement conservés.

## Matrice

| Critère | État de cette tranche |
|---|---|
|A1 familles / A2 produits et retour|PASS_LIMITED_PREVIEW_BROWSER + REACT_PASS|
|A3 illustrations|PARTIAL_VISUAL_ACCEPTANCE : 4 fichiers intégrés, huit références chargées, dimensions réelles corrigées ; harmonie artistique finale à valider par le propriétaire|
|A4 rail / A5 mémoire et owner|PASS_LIMITED_PREVIEW_BROWSER + REACT_PASS ; détails de SHA ci-dessous|
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

## Réception Preview — défauts reproduits puis corrigés

`05b51ce` : Next Preview READY ; vrai navigateur authentifié sur la route de recette financière synthétique. Familles/Produits sans titre/recherche, images chargées. Défaut mesuré : images carrées 76px au lieu du cadre64px, famille106px au lieu82px ; anciens panoramas trop petits. Correctif `ef881cc` : min-height0, hauteur explicitement bornée64/82px, cadrage panoramique à droite et tuiles180px. Deuxième Preview READY, SHA relu dans le DOM ; tous les produits observés64px de haut, rail complet1322px de large pour1056px disponibles à1440px et759px à1152px. Scrollbar CSS none, overflow auto.

`ef881cc` : Boissons → Bière deux fois reste dans OBJECTS, deux IDs extras distincts. Retour Familles → Restauration PASS. Before → Restauration → Chips crée le vrai child, extras parent toujours distincts ; Au bar retrouve Restauration, puis Boissons après changement explicite. Le contrôle RAW `12,` → Familles affiche le dialogue de protection ; Continuer retrouve exactement `12,`, dirty=true, Enregistrer/Apply désactivés. Le texte incomplet n'est pas admis en coût. Flèche→scrollLeft300, clavier→480, défilement natif horizontal vers gauche→0 (les lectures immédiates avant fin du défilement smooth donnaient0 : la preuve finale utilise les positions effectivement observées après traitement, aucune latence produit déduite de l'outil).

Défaut supplémentaire reproduit : Replier/réouvrir gardait la famille dans BarViewMemory mais summary affichait FAMILIES. Correctif `959d620` : summary utilise la famille et le moment actifs mémorisés, avec les vrais callbacks Bar/Before. Test ciblé `check-bar-subassets-r5-interactions.mjs --r7-memory` PASS : démontage/remontage avec la mémoire publiée, même child Before, même première selection, nouvel ajout exclusivement dans le child et extras parent inchangés ; retour Au bar retrouve Boissons. TypeScript exit0. Ce correctif ne sérialise aucune donnée financière et ne prétend pas résoudre B5.

Les builds successifs répondent uniquement aux défauts effectivement reproduits ; une seule campagne ciblée, aucun benchmark ni série Google/Auth/Apply. Dernier ajustement `0bf2483` : les panoramas -closed existants sont centrés plutôt que cadrés à droite, pour ne plus couper la bière/cocktail/soft. Les autres panoramas restent cadrés à droite ; les quatre nouvelles images conservent leur alpha. Aucun changement financier.

## Verdict final de cette tranche

Produit réellement reçu : **`0bf24838d0b2e65461dcf0d51163f8ae03b352c6`**, Preview **`dpl_2CxFM1fHrPH4oEMQa84etY4s22Gj`**, **READY**, [URL du déploiement exact](https://budgetisation-nxln8kuvl-adriensauvageot34-6137s-projects.vercel.app). Alias de recette Auth existant officiellement basculé vers ce déploiement, aucun alias Production touché par R7. Le SHA est relu depuis le DOM et Vercel ; TypeScript local exit0 pour le dernier changement TSX, Next complet du dernier SHA PASS. Le dernier commit après TypeScript ne change qu'une règle CSS.

Sur ce SHA final : Familles sans titre/recherche, deux illustrations82px effectivement chargées ; Boissons → Bière×2 avec deux IDs distincts, groupe×2 et UNKNOWN, FRESH ; retour Familles → Restauration ; réouverture finale retrouve Restauration/OBJECTS sur la même occurrence. Les sept images produit sont chargées et hautes64px. Largeurs réellement mesurées1440×900 et1152×720 ; largeur du document1152 sans débordement global. La sauvegarde Draft et Apply authentifiés ne sont pas testés : recette financière synthétique en mémoire, pas de writer distant.

Preuves : `browser-reception.json`, `final-empty-families-1440.png`, `final-products-1440.png`. Les captures ont été observées avant conservation finale ; `transition-before-paint-959d620.png` conserve une capture antérieure encore sur une transition, exclue de la preuve de carte vide. Certaines premières lectures immédiates et actions groupées précédaient la peinture et n'atteignaient pas la cible attendue : un batch après réouverture a ajouté une troisième bière synthétique. Il n'est pas utilisé comme certification d'absence de doublon ni attribué à une régression produit ; les navigations finales ont été reprises avec une observation AX entre chaque geste. Aucun événement synthétique injecté, aucun contournement de navigateur, aucun gain de performance revendiqué.

**BAR_R7_STATUS=PARTIAL_DRAFT**, [PR #74](https://github.com/adriensauvageot34/Budgetisation/pull/74). `MERGE_SHA=NOT_MERGED`, R7 Production `NOT_DEPLOYED`. `NATIVE_DND=NOT_RUN_NATIVE` pour cette tranche ; mapping #73 inchangé. `FINANCE_198=UNCHANGED_NOT_RERUN`. `RAW_UNDO=PASS_LIMITED_FIXTURE_AND_BROWSER`, sans assimilation à B2/B5 complets. Le seul blocage contractuel est B5 ; Lots2/3 dépendants, carte minimale inline et rails simultanés non livrés. Le défaut préexistant du test de moment actif reste enregistré FAIL, pas maquillé PASS.

Suite minimale : représenter et valider dans le propriétaire existant une sauvegarde versionnée des décisions direct/détail et une transition restaurable, protégée par digest et financements, avant de reprendre la carte progressive. Aucune migration n'a été proposée ou exécutée. Rollback de ce lot indépendant : revert des quatre commits produit R7 ; aucune donnée distante à nettoyer. La Production #73 reste READY sur `96b4fd9` conformément à la demande distincte de l'utilisateur.
