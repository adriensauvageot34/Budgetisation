# Sous-assets Bar R5 — préflight ciblé

19 octobre 2026. **G0 documentaire résolu après réception de l’extraction. Base applicative contrôlée avant les lots.**

## Base vérifiée

- `main` distant : `5f98040cffbcd3437287367775e9b368b81123cd`.
- PR66 fusionnée par `5f469ff`, PR67 fusionnée par `5f98040` ; aucune ancienne branche empilée utilisée.
- Branche dédiée créée depuis `origin/main` : `codex/bar-subassets-r5`.
- Worktree applicatif initial propre ; `outputs/` non suivi préexistant conservé.
- Production : `dpl_5EbosW3rDSitGXToi7fK3PEWHFBc`, target production, READY, SHA5f98040 ; trois alias principaux. Le workflow Git de main déclenche la Production ; aucun déploiement parallèle prévu.

## Sources

Mission lue intégralement : `PROMPT_CODEX_SOUS_ASSETS_BAR_R5_167_MAIN_PRODUCTION_2026-10-19.md`.

Brief R1–R5 retrouvé et lu intégralement sous le nom sans suffixe `(2)` dans Downloads : `BUDGETISATION_BRIEF_FINAL_CHATGPT_UI_UX_BAR_BOARD_222_RECOMMANDATIONS_2026-10-19.md`.
SHA256 : `5BE7EEE0C8A8A55320E1E146659119CDD4745CA8A2ABAB6F3D5A8CF6E44983A0`.
Contrôle exécuté :222 entrées UI,222 IDs uniques ;76 décisions R5,76 uniques.

Extraction reçue et lue intégralement le 19 octobre. Registre requirements.json généré à partir des textes originaux et de leur précision R5 ; classes extraites de la pièce fournie. Contrôle exécuté : 222 uniques, A105/B62/C55, 76 décisions. Aucun statut de réalisation déduit de la simple présence au registre.

## Écarts statiques constatés au SHA de base

| Zone | Constat / owner existant | Lot prévu |
|---|---|---|
| Rail | `context-palette.tsx:133` utilise BarPageControls ; ligne140 tranche les propositions. Le scroll existant est court-circuité pour Bar. | L1 : transformer ce rail existant, préserver les autres presets et la pagination des objets possédés. |
| Scènes/catalogues | `bar-living-editor.tsx:300–312` mélange Before, Bouteille partagée, boissons et navigation/montant. | L1/L2 : familles cohérentes et moment explicite, sans nouveau moteur. |
| Before | `bar-before.ts` repose sur un enfant activity avec un COMPONENT principal ; le retrait isolé du principal est refusé explicitement dans l'éditeur. | L2 : vérifier le contrat propriétaire avant toute mutation ; ne pas simuler une suppression front. |
| Personnes | `bar-living-editor.tsx:255` admet participantRefs en groupe puis revient au résumé. | L3 : multi-toggle par mutation admise, présence distincte du financement. |
| État transitoire | `bar-view-memory.ts` est déjà borné et indexé par occurrence/mois ; conserve queries/pages/dockPages. | L1 : réutiliser la propriété du contexte, remplacer les pages du dock par sa position de rail. |
| Google/favoris | `bar-place-search.tsx`, `bar-personal-places.tsx` et les API propriétaires existent ; décisions Google minimales et favoris séparés. | L3 : intégrer la recherche unique, conserver RLS/CAS/Details et ne pas refaire les providers. |
| Mini-édition/RAW | `inline-edit-registry.tsx`, `atomic-popover.tsx`, `night-out-components.tsx` existants. | L2/L4 : réutiliser les gardes et les contrôles ciblés ; pas de nouvel owner financier. |

Ces constats sont statiques, pas de nouveaux PASS navigateur. Les canaris de la release précédente sont conservés dans le commit documentaire `9a7e7af8ef3e1173a7419dd6e178dd34a752981f` et ne certifieront pas les futurs patches R5.

## Gates et limites

- Registre222 : intégrité et classement A/B/C **PASS** (script check-bar-subassets-r5-registry.mjs).
- L1/L2/L3/L4, Preview1/2, nouveaux tests Auth : **NOT_RUN**. Aucun test produit relancé pour un code inchangé à ce stade.
- GO_MAIN = **NO** tant que G0 puis les gates de la mission ne sont pas satisfaits.
- Aucune PR, fusion, migration, écriture de données ou nouvelle activation effectuée pour R5.
- Desktop uniquement. Zoom natif125% à vérifier réellement ; aucun viewport/DPR ne lui sera substitué comme preuve.
- Les55C restent réservées : pas de refonte du packing, des dimensions ou des autres presets.

Plan : L1 rail dans ContextPalette ; L2 moments/catalogues et mini-édition via EDIT_NIGHT_OUT ; L3 recherche et contexte avec les owners Google/favoris/Mobility existants ; L4 finitions desktop. Fixtures React/PGlite et serveur navigateur disponibles. Le projet Supabase isolé ne dispose pas du contrat Draft : sa mémoire locale ne prouve pas une sauvegarde durable authentifiée.

## Clôture de la réception

Les statuts NOT_RUN ci-dessus décrivent le préflight historique, pas le résultat final. Voir gate-results.md et bar-subassets-release.md :PR Draft68 publiée, UI Preview exécutée, aucune fusion ni Production.78A vérifiées au niveau indiqué/27A partielles ou bloquées ;62B examinées ;55C réservées. GO_MAIN=NO.
