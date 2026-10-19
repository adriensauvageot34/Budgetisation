# Réception Bar R5 — géométrie des 34 exigences

## Verdict

GO_MAIN = YES pour ce lot géométrique. Aucun FAIL P0/P1 restant dans la réception exécutée. 34 IDs uniques : 32 IMPLEMENTED_VERIFIED, UI-031 HYPOTHESIS_MEASURED, UI-175 OWNER_CONTRACT_EXPLICIT. Aucun nouveau calcul financier, aucune migration ni écriture Supabase. Art20 et UI219 NOT_STARTED.

Base main175313fb509c20c88df7eb54e5aa3028abf61183 (PR68). PR69 : https://github.com/adriensauvageot34/Budgetisation/pull/69 ; branche codex/bar-r5-board-geometry-34.

## Versions et méthode

Preview1 L1/L2 : 11bbc0d87f02383d18d5a69dab3e066ebcabe9c9 ; dpl_7N5CTFcwcYJrkqoCPuoRDT1BfYSD READY ; https://budgetisation-b8zcrb06a-adriensauvageot34-6137s-projects.vercel.app/recette/bar-favoris?barProbe=1 . Réception réelle trois largeurs, Date/RAW/Lieu/ancrage ; pas une certification globale des34.

Campagne L3 intégrée : 4204aea6f78cc55afee4d35cb49f8a47722b4aa3 ; dpl_DZTZT37VM3hPM1NAhWKPxpsK6oLm READY ; https://budgetisation-861e9888o-adriensauvageot34-6137s-projects.vercel.app/recette/bar-favoris?barProbe=1 . Scénarios S01–S14 ci-dessous ; dernier défaut titre/prix constaté.

Preview2 produit final : eb96f7d85d60d2ac9731b998db802ac858111e7d ; dpl_HjFmd7qnAozvUJZQzxbcnBzLB8rk READY ; https://budgetisation-c4zqngwf5-adriensauvageot34-6137s-projects.vercel.app/recette/bar-favoris?barProbe=1 . Retest défaut et dépendances : résumé vide/riche, RAW, Date/clavier, trois largeurs effectives.

Diff intégral420→eb96 : une seule déclaration CSS, .barLivingCard[data-expanded=true] .barLivingIdentity h3 : flex-basis:auto → flex:0 1 auto. Aucun TS, packer, contrat, transport ou test changé. La campagne420 reste historique, pas présentée comme14 scénarios rejoués sur eb96. Retest ciblé de cette règle et dépendances sur eb96, selon le cahier. Captures final-eb96-* : SHA final relu dans le DOM ; release-* :420.

Compte habituel authentifié, auteur allowlisté côté serveur ; Board/World/lieux exclusivement synthétiques en mémoire. Aucun foyer personnel résolu, aucun transport Draft durable/favori/writer ; APPLY/CHECK_APPLY refusés. Host recette indisponible en Production. Aucun compte fictif réactivé.

Sondes DOM en lecture seule : rectangles carte/cellule, spans, page, ancre relative/absolue, focus, hauteurs, dock/pagination, overflow, SHA. Interactions exécutées dans le navigateur Codex, pas par mutation cachée. Viewports relus innerWidth/innerHeight1152×720,1440×900,1920×1080 ; zoom100%, DPR≈1. Durées outil non utilisées comme métriques produit.

BEFORE_* : bundle non attesté, aucune comparaison chiffrée au main exact. L12_CLOSED_1440 et L12_OPEN_1440 : mauvais onglet dans un ancien helper, invalidés/conservés/exclus des PASS. Relevés transitoires de carousel ne certifient pas un placement stabilisé. Élément accessible1px non pris pour scroll produit. Résumé long sur2lignes : texte intégral réellement accessible au focus/survol, pas une option supprimée.

## Matrice des scénarios

Preuves geometry-measures.json ; RELEASE=420, FINAL_EB=eb96. PASS = géométrie sur fixture, pas fournisseur réel ni sauvegarde durable.

| Scénario | Preuve exécutée | Résultat |
|---|---|---|
| S01 fermé vide + voisines | RELEASE_S01_CLOSED_EMPTY | PASS,175px, voisins intrinsèques |
| S02 lieu/date/2personnes fermé | RELEASE_S02_EXACT_PARTIAL | PASS,~384×175,5/18spans |
| S03 Before9/AuBar15/2routes | exact15 exécuté sur9669e1c ; RELEASE_S03_CLOSED_RICH_1440 variante30 | PASS sur variantes exécutées, synthèses +N et accès aux groupes |
| S04 ouvert court | RELEASE_S04_EMPTY_1440 ; FINAL_EB_EMPTY_1440 | PASS,~525×245,7/25spans,page0 |
| S05 Date/clavier | RELEASE_S05_DATE_1440 et S14_DATE ; FINAL_EB_DATE_1440/1152 | PASS,~449×395 à1440,6/40spans, dock absent ; flèche puis Entrée sélectionne15 |
| S06 lieux0/3/retard/erreur | RELEASE_S06_DELAYED/ZERO/OBSOLETE_IGNORED/THREE/ERROR | PASS MOCKS,~602×595,8/60spans, mêmes focus/ancre, retry, candidats complets paginés |
| S07 quatre personnes | RELEASE_S07_BEFORE/PENDING_FOUR | PASS, même ancre avant/après Preview, capsule bornée et libellés accessibles |
| S08 Bière/prix/quantité/RAW | RELEASE_S08_CLEAN/RAW ; FINAL_EB_RAW_1440 | PASS,12, protégé et conservé après annulation ; Enregistrer dans sa rangée |
| S09 modes/endpoints longs | RELEASE_S09_RICH_MIXED | PASS, aller train/retour taxi, texte conservé, prix UNKNOWN non inventés |
| S10 24→30 + Before9 | RELEASE_S10_24/PAGE1/PAGE6/30/BEFORE_PAGE3 | PASS,4objets/page,6pages pour24 ; Before3pages ; aucun pager ajouté au catalogue dock |
| S11 repli/retrait/UndoRedo/2Bars/drag | RELEASE_S11_LAST_REMOVED/UNDO/REDO/TWO_BARS/NATIVE_CONFIRMED_UNDO ; proofs/native-drag-release.json | PASS,25→29→25rows,245→285→245px ; vrai drag corbeille, attente détachement puis Undo mêmes identité/décisions |
| S12 voisins | RELEASE_S12_NEIGHBORS ; proofs/neighbors-release.json | PASS Mascara, Crayon à sourcils, Acheter des vêtements, Autre projet maison, Coiffeur, Épargne. Maison petit : présentation vide partagée couverte C2, pas de nouvelle capacité métier |
| S13 densité/dock/inspecteur | RELEASE_S13_INSPECTOR_SETTLED_1152/S14_DOCK_REACHABLE_1152 + empty/rich | PASS géométrique ; inspecteur fermeBar selon comportement existant ; fallback document dense petit desktop |
| S14 trois desktop/clavier | RELEASE_S14_* et FINAL_EB_* | PASS dimensions/clavier/accès ; reduced-motion=true NOT_RUN_BROWSER, cheminCSS statique couvert, préférence observéefalse |

F08→S03/S10 ; F11→S08/S11 ; F22→S01/S12/S13 ; X01→S06 ; X02→S10 ; X06→S01/S12. P0-06→GEO06, P0-07→GEO08, P1-01→GEO01/02, P1-09→GEO07, P2-04→GEO08/14.

## Mesures finales

| Scène | Rectangle peint | Spans | Preuve |
|---|---|---|---|
| Vide ouvert1440 |525.2×245|7/25|FINAL_EB_EMPTY_1440|
| Date1440 |448.7×395|6/40|FINAL_EB_DATE_1440|
| Date1152 |459.4×395|6/40|FINAL_EB_DATE_1152|
| Deux moments1440 |754.6×295|10/30|FINAL_EB_RICH_1440|
| Deux moments1920 |778.2×295|10/30|FINAL_EB_RICH_1920|
| Before9/30/deuxroutes1440 |~754.6×515 ouvert ;~601.7×555 fermé|10/52 ;8/56|RELEASE_S09/S03|
| Titre→montant ouvert |12px aux trois largeurs|page inchangée|FINAL_EB_GAP_*|
| Voisins fermés |145px Mascara/Sourcils/Projetmaison ;175px Vêtements|propres à chaque carte|neighbors-release.json|

UI031 : hypothèses mesurées, pas normes à pixels fixes. Date peut être plus étroite que l'ancienne fourchette. Gutter et animation expliquent certains écarts entre relevés ; pas de comparaison de performance revendiquée.

Cas riche1152 : défilement extérieur du document parfois nécessaire,~225px lors de la réception dense ; pas de promesse zéro scroll global. Toutes les cibles conservées, pas de scroll vertical interne Bar. Bordure du dock dépassant de0.4px dans un relevé sous-pixel, aucun bouton masqué.

## Défauts corrigés et preuves conservées

- Origine active trop basse/dock hors écran : réservation ancre avant voisines et host au vrai AppShell.
- RAW Enregistrer ajoutait40px : réserve dans la rangée ; clean/12, même surface.
- Lieu ajoutait~100px selon réponse : surface bornée et pages de candidats ; tous conservés, homonymes distingués par adresse.
- Calendrier max340/350 trop étroit : occupe l'intérieur de sa scèneM.
- Fermé riche trop haut : grilles intrinsèques routes/moments, élargissement seulement quand parallèle utile.
- Retrait après UndoRedo laissait40px : checkpoint topologieIDs, pas prix/quantité ; nouveau test structurel et navigateur25→29→25rows.
- Header Preview ajoutait19.3px : visible Calcul… et nom accessible complet ; Y163.5 avant/après sur420.
- Dernière capture large : h3 flex-grow éloignaitmontant ; eb96,12px réellement relus.

Anciens FAIL conservés : nouveau test structurel premier échec helper aria-label corrigé sans mutation métier ; R6-012 attendait projected alors que main175 utilisait measuredItems, preuve préexistante conservée, garde adapté sans supprimer le gel drag.

## Tests et gates

| Contrôle | Résultat réel | Journal/commande |
|---|---|---|
| Packer |17PASS,5–50éléments/4largeurs/ancre/IDs|node scripts/check-bar-geometry-r5.mjs ; packer-final.log|
| P1 |25PASS|node scripts/check-bar-apero-p1.mjs ; p1-1e0de69.log|
| P2 |22PASS|node scripts/check-bar-apero-p2.mjs ; p2-structural-final-retest.log|
| P4 |15PASS|node scripts/check-bar-apero-p4.mjs ; p4-1e0de69.log|
| R6 |30PASS,remoteCalls0/dbWrites0|node scripts/check-composer-r6-p45.mjs ; r6-1e0de69.log|
| Dock |PASS fixtures25/120/150options|node scripts/check-bar-subassets-r5-dock.mjs ; dock-1e0de69.log|
| Lieux |PASS mocks, conservation/retards ; pas live|node scripts/check-bar-subassets-r5-google.mjs ; google-product-final.log|
| C2 |12PASS UNKNOWN non répété|node scripts/check-pre-l4-c2.mjs ; control-final.log|
| Scope |PASS auteur/Production/foyer/writer interdits|node scripts/check-bar-geometry-scope.mjs ; scope-final.log|
| FinanceV2 |198/198PASS,22cas×9digests,remoteWrites0|node scripts/check-planner-performance-parity.mjs ; finance-4204aea.log|
| TypeScript eb96 |PASS exit0|npx.cmd tsc --noEmit ; typecheck-eb96f7d.log|
| Next local |NOT_CERTIFIED_TOOLING, symlink node_modules hors racine Turbopack|next-build-l12.log ; pas de relance identique|
| Next Vercel eb96 |PASS complet compilation/TS/static8/8/output/deploy|vercel-next-build-eb96f7d.json ; connector omet1événement, troncature conservée|
| CI eb96 |VercelSUCCESS,PR mergeable, pas de revue soumise constatée|statut GitHub ; recontrôle au commit de preuves|

Les logs portent leurs vrais SHA, pas renommés pour le dernierCSS. Après1e0, uniquement libellé d'attenteheader puis règleh3 ; Finance420 n'est pas revendiqué comme test exécuté eb96. Aucun golden financier remplacé. C2contracts ne change que les libellés UNKNOWN de présentation.

GEO01–11 PASS sur le périmètre exécuté. Le mode navigateur reduced-motion=true reste NOT_RUN_BROWSER ; absence d'émulation officielle, pas une panne constatée ou perte d'accès P0/P1. C'est une limite secondaire documentée. Google réel, Canonical admission, providers réels, Auth durable, zoom natif125 et quatre contrats owner : DEFERRED_BY_OWNER, jamais PASS déduit des mocks.

## Intégration et rollback

GO_MAIN pour ce lot uniquement. Merge normal après statut final et absence de dérive distante, aucune protection contournée. Si commit de preuves seulementdocs, attester diffsrc vide et vérifier Preview, sans prétendre rejouer toute campagne.

Smoke Production authentifié non destructif, sans création de Draft ni Apply ni décision financière. Ne pas créer un Bar personnel pour compléter une preuve ; absence d'un Bar existant reste NOT_RUN. Rollback par revert normal du merge/déploiement Git, aucun DELETE ni rollbackSQL. État final de livraison consigné dans delivery.md.
