# Gates R5 — réception finale
Base main : 5f98040cffbcd3437287367775e9b368b81123cd (fetch final, ancêtre).
Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.
Suites comportement : fa8d0aff21c392d8966a9b75d8e0963ffebcad27 ; seul changement applicatif suivant : conteneur CSS du dock, rejoué sur la Preview finale. Autre changement : outil de révocation Auth fictif.

| Gate | Résultat exécuté | Limites / preuve |
|---|---|---|
| G0 | PASS222 uniques, A105/B62/C55,76 décisions | Registre exact ; pas222 réalisations |
| L1 | PASS React25/120/150, recherche complète avant limite24, suite explicite, flèches/clavier, mémoire bornée | check-bar-subassets-r5-dock.mjs ; aucun navigateur150 prétendu |
| Rail réel | PASS_BROWSER_PREVIEW à1152 :scrollLeft293,6 après flèche, sans pager | preview2.json ; pas clavier/trackpad exhaustif |
| L2 | PASS11 interactions R5 | react-interactions.json ; owner/PGlite synthétique |
| P1/P2/P3/P4 | PASS25/21/14/15, zéro FAIL | bar-p*-results.json + journaux ; fournisseurs simulés, Apply/Reload PGlite uniquement |
| L3 Google | PASS mock :Details puis admission minimale unique ; réponse ancienne refusée | check-bar-subassets-r5-google.mjs ; Google réel Preview1 indisponible, fallback explicite testé |
| Favoris | 7 contrôles UI/API existants PASS au premier candidat | Pas une nouvelle preuve RLS pour R5 ; aucun favori écrit pendant R5 |
| Finance | PASS198/198 (22×9), produit final | finance-final.log ; aucun golden modifié |
| TypeScript | PASS exit0 local et build final Vercel | npx.cmd tsc --noEmit |
| Build local webpack | FAIL :EPERM initial puis UnhandledSchemeError node:crypto sur analytics/history-v2 | next-build-webpack.log conservé ; jamais déclaré réussi |
| Build Vercel final | PASS complet Next16.2.6 :compile, TypeScript, pages8/8, assemblage, READY | vercel-final-build.log ; next build normal Turbopack, pas compilation seule |
| Preview1 | READY + UI Auth isolée exécutée c594c48 | dpl_E55owBobiASXM5wSnoJtMknJm5Gq ; preview1.json |
| Preview2 | READY + UI Auth isolée exécutée fa8d0af | dpl_7f4KSzvzkHrtQTWdCZNcyuqbXipe ; preview2.json ; découpe CSS découverte |
| Retest Preview2 corrigée | READY + parcours affecté réellement cliqué cc9d259 | dpl_5RixWNdUcY8KKxNGQJ8YKr6EAKdU ; preview2-css-recheck.json |
| L4 desktop | PARTIAL :1152×720,1440×900,1920×1080 réellement mesurés | Conteneur dock136=scroll136 ; calendrier1440 dock0/réserve0 ; carte1920 client225=scroll225, aucun débordement horizontal. À1152 résumé :dock bottom777,5, accessible après défilement document bottom699,1 |
| Zoom125 natif | NOT_VERIFIED_ZOOM | API viewport seulement ; aucun DPR substitué. Contrôle humain avant promotion |
| Auth Draft | BLOCKED_ENV / NOT_RUN_AUTH | Projet fictif :tables Draft et PlanRevision absentes (lecture seule). Host recette :Composer en mémoire, sorties non sauvegardées. Aucune migration ajoutée |
| Nettoyage | PASS borné aux opérations exécutées | A rebanni et marqueur retiré/relu ; B/C jamais réactivés. Omission initiale n'a pas retiré la clé (fusion Auth) ; corrigé par null puis vérifié. isolated-account-cleanup.log |
| CI | Vercel success sur cc9d259 | Aucun autre contrôle ou approbation supposé |
| GO_MAIN | NO | Auth durable manquant, zoom non vérifié,27A partielles/bloquées, réception UI exhaustive non acquise |
| Production | NOT_DEPLOYED | main inchangé, zéro migration/Apply/Draft personnel/écriture financière |

Commandes exécutées : node scripts/check-bar-subassets-r5-registry.mjs, dock.mjs, interactions.mjs, google.mjs ; node scripts/check-bar-apero-p1.mjs à p4.mjs ; node scripts/check-planner-performance-parity.mjs ; npx.cmd tsc --noEmit. Chaque script séparé.

Serveur local existant :React compilé production, faits synthétiques et transport local ; SAVED/Reload ne prouve pas Supabase. Previews :Auth réel du projet isolé, Composer en mémoire. Chaque preuve porte son SHA réel ; worktree intermédiaire explicitement identifié dans browser-local.json.55C réservées, aucun moteur financier ni snapshot ajouté.
