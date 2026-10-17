# L4-A.1 — Atelier Soirée interactif

- Base : `main` `94d8bb8`. Branche : `codex/composer-v3-l4-a1-night-workshop`. Produit testé : `58dc567491fcf13ee5a2496a98ba0bce25d5f539`.
- La grande modale est remplacée par un panneau non modal. Le Board reste visible ; le dock Composer présente les réponses et sous-assets dans un carrousel horizontal.
- Le parcours pose une question à la fois : date, participants, lieu, décisions de soirée, puis résumé compact. Les choix facultatifs peuvent rester inconnus ; la navigation seule ne modifie pas le Draft.
- Les coûts et les décisions restent dans les opérations Semantic Draft, le Compiler et Finance V2. Les composants SHARED et les deux trajets conservent leurs identités et leur sémantique.
- Navigateur réel sur fixture locale : date absente puis renseignée, amis, lieu, boissons, bouteille partagée, before, aller/retour, édition d'un prix, Undo/Redo, sauvegarde HTTP, rechargement, réédition et rejet d'une mutation invalide : PASS limité aux données synthétiques.
- Géométrie mesurée aux largeurs effectives 1440×900, 1728×900 et 1920×1080 : aucun scroll vertical du panneau, dock séparé, aucune collision ni floutage du Board sur calendrier, résumé et erreurs.
- TypeScript : PASS. Build Next complet sur Vercel Preview : READY pour le SHA produit. Contrats L4-A : 19 PASS PGlite ; Restaurant L1 : 25 PASS.
- Navigation seule : zéro opération HTTP supplémentaire. Fixture : zéro Plan/PlanRevision, zéro Apply, zéro écriture distante.
- Limites : parcours authentifié Supabase, Apply/Reload officiel et confirmations natives non exécutés. Aucune certification réelle des propriétaires financiers ni mise en Production revendiquée.
- Verdict : `READY_FOR_REVIEW_LIMITED_FIXTURE`. PR #54 ouverte ; aucune fusion ni promotion Production.

Preuves : [avant](evidence/l4-a1/before-form-1440.jpg) · [après 1440](evidence/l4-a1/summary-1440.jpg) · [après 1728](evidence/l4-a1/summary-1728.jpg) · [après 1920](evidence/l4-a1/summary-1920.jpg) · [géométrie](evidence/l4-a1/browser-geometry.json) · [conservation](evidence/l4-a1/conservation.json) · [navigation](evidence/l4-a1/visual-navigation.json) · [contrats](evidence/l4-a1/contracts.log) · [Restaurant](evidence/l4-a1/restaurant.log) · [build](evidence/l4-a1/vercel-build.log).
