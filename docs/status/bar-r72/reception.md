# Bar / Apéro R7.2 — réception ciblée

Base : main `83f02a2ab80c9da4abe7077fa08030dcc81da6b9`, PR73/74 conservées. Branche `codex/bar-r7-2-progressive-open`. Aucun autre asset, dock R7.1, moteur Finance, Board, carte fermée, Google/Mobility ou schéma Supabase modifié.

## B5

`fields.nightOutConsumption`, contrat propriétaire `night-out-consumption@v1`, contient le mode DIRECT/DETAILED, l'identité directe et les seuls Components inactifs. Les faits actifs restent dans extras. Les parseurs sémantique et de capacité valident les références et les composants inactifs ; ceux-ci ne sont jamais transmis au Compiler comme faits actifs. Commande EDIT_NIGHT_OUT avec digest attendu du contexte ; protections du contexte conservées. Main/contribution, Before, food et déplacements restent indépendants. Montants legacy ambigus ou financés refusés, sans remplacement implicite ; aucune conversion au montage. Les anciens états sans ce champ restent inchangés. Aucun nouveau stockage ni migration. Retour direct restaure l'identité, la quantité, la provenance, le coût et la portée originaux ; les détails sont archivés dans le JSON propriétaire, pas en mémoire React.

## Réalisé et preuves locales

- `check-bar-r72-consumption.mjs` : 7 PASS, dont vraie écriture/relecture SQL des migrations Draft M0/v2 officielles sur PGlite isolé, via saveComposerDraft/readComposerDrafts, parse/digest, retour direct puis détails après relecture. Direct 15, UNKNOWN, zéro explicite, identités, Undo/Redo des états, digest périmé, financement, verrou et legacy. Zéro Plan/PlanRevision et canaris financiers inchangés. Ce n'est ni une sauvegarde Auth Supabase ni une preuve RLS/JWT.
- `check-bar-subassets-r5-interactions.mjs` : 13 PASS. Les anciens parcours passent désormais par Détailler → Au bar ; seule adaptation des gestes/labels, aucune assertion métier retirée. Le test de mémoire qui échouait avant R7.2 passe avec la synthèse des deux moments. Nouveau cas : carte vide, Enter/blur/Escape, RAW12, non admis et conservé, zéro, mutation rejetée, Before/Au bar et slots séparés. Les premières sorties obsolètes ont été conservées hors dépôt avant adaptation et ne sont pas présentées comme des régressions corrigées.
- `check-planner-performance-parity.mjs` : 22 scénarios ×9 empreintes = 198/198, goldens inchangés.
- Groupes R6 : 13 PASS (8+9, partiel, SHARED et owners séparés). Scheduler P2 : 5 PASS. Draft HTTP : 5 PASS mocks. R7 dock : 6 PASS. R5 dock25/120/150 PASS. TypeScript exit0.
- Build local Next : FAIL_OUTILLAGE, Turbopack refuse le lien node_modules hors racine. Pas de compilation locale complète revendiquée ; build complet Vercel requis sur la Preview du produit final.

## UI

Montant inline projeté dans l'en-tête ouvert seulement ; détails affichent le résultat serveur. Enter/blur valident seulement un nombre complet ; Escape abandonne le buffer ; composition IME et garde RAW préservés, refus serveur garde le champ. Les moments sont choisis volontairement, coexistent et conservent leurs propriétaires ; Before à gauche. Rails continus avec vrais groupes et plus terminal ; aucun slot financier. Dépôt proposé seulement sur un socket réellement publié et compatible, jamais sur un Before sans propriétaire existant. La réception native reste à exécuter, aucun PASS synthétique assimilé à NATIVE_DND.

La carte fermée ne change pas : seule la branche expanded de son en-tête fournit l'ancre de l'éditeur inline. Revue React ciblée : hooks inconditionnels, callbacks RAW repris avec les valeurs courantes, aucun calcul financier ni lecture réseau ajouté dans React.

## Gates de livraison

Preview exacte, navigateur desktop, retour après relecture et DnD natif : PENDING. Fusion et Production : NOT_EXECUTED. Aucune sauvegarde du Composer personnel, Apply ou écriture financière distante. After/Répartir reportés, aucun faux bouton. Rapport de réception navigateur et verdict final à compléter dans la PR après exécution ; une défaillance métier maintient la PR Draft.
