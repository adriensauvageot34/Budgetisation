# Gates R5 — actualisation des27 résidus

Produit actuel :157b7f6b63d19a9e60d8ba5ff95d4a117e9cf849. Détail et limites :closure27-reception.md.

| Gate courant | Résultat réel | Preuve / arbre |
|---|---|---|
| Registre | PASS222 ;78A acquises inchangées ;27=14 navigateur+2 locales+7 partielles+4 owner | requirements.json ; contrôle des textes normatifs inchangés |
| P1/P2/P3/P4 | PASS25/21/14/15 | closure27-p*-results.json, exécutés99681b4 |
| R5 et ciblé27 | PASS11 et8 | closure27-r5.log ; closure27-l1.json (8 rejoués157b7f6) |
| Finance | PASS198/198 ; aucun golden modifié | closure27-finance.log,99681b4 ; seul popover UI change ensuite |
| TypeScript | PASS exit0 | tsc --noEmit,157b7f6 |
| Build Vercel | PASS complet Next puis READY | closure27-final-vercel-build.log ; dpl_3n8jYgVAUYBk6xgyj6AqkjuR5sTt ;157b7f6 |
| Preview1/2 | Exécutées ; coût FAIL conservé | closure27-preview1/2.json ; a71af6d/99681b4 |
| Preview3 corrective | Coût ancré/RAW/zéro/Undo, catalogue25/120/150, calendrier et lieu long exécutés | closure27-preview3.json ;157b7f6 |
| Résidu rail | FAIL après effacement filtre150 | after=false malgré4468>1027 ; pas de quatrième Preview |
| Desktop | PARTIAL global ; pas de scroll vertical interne dans les surfaces mesurées | rich20,1440/1920 visibles ;1152 dock dépasse viewport |
| B215/220/222 | PARTIAL ; zoom NOT_VERIFIED_ZOOM | focus Redo/visibilité exhaustive non certifiés |
| Google réel | NOT_RUN de certification, tentative indisponible | mock PASS ; repli disponible en Preview1 |
| Auth durable | BLOCKED_ENV | tables Draft/PlanRevision absentes ; aucun test personnel |
| Nettoyage | PASS compte A rebanni, marqueur retiré/relu | closure27-account-cleanup.log ; aucun favori/Draft distant créé |
| GO_MAIN / Production | NO / UNCHANGED | PR Draft68 uniquement ; aucune migration ni Apply |

---

## Historique des gates de la réception cc9d259
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
