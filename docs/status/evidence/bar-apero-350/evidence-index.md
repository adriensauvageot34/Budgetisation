# Index de preuves

Tous les fichiers référencés sont contrôlés par SHA-256 de leur texte normalisé LF dans evidence.json. Le SHA produit et le niveau de preuve sont indépendants du hash du fichier de preuve.

| ID | Niveau | SHA produit | Fichier / portée |
|---|---|---|---|
| COMPACT | PASS_BROWSER_FIXTURE | 5590017 | BAR_APERO_COMPACT_EDITORIAL_RECEPTION.md — Compacité mesurée, tuiles, illustration déterministe et reflow ; a2e2aec ne change que ce rapport. Aucune preuve Auth. |
| G0_SAVE | PASS_HTTP_FIXTURE | a2e2aec | docs/status/evidence/bar-apero-350/g0-save.json — Script HTTP riche réellement rejoué avant changement produit ; CAS, réponse perdue, conservation, zéro Apply et zéro distant. |
| G1_REACT | PASS_REACT | 4006356 | docs/status/evidence/bar-apero-350/g1/react.log — Six groupes ciblés ; RAW/clic neutre, Plus tard, calendrier, reprise recherche, homonymes visibles. |
| G1_BROWSER | PASS_BROWSER_FIXTURE | 08dc6f4 | docs/status/evidence/bar-apero-350/g1/browser.json — Lieu recherche Canal reprise ; Plus tard summary ; date maintenue et flèche droite focus2/tabstop unique ; aucune mutation distante. |
| G1_PLACES | PASS_BROWSER_FIXTURE | 4006356 | docs/status/evidence/bar-apero-350/g1/places.json — Homonymes Quai A/B visibles, un champ de recherche, dock sans scroll Y à 1280px. |
| G1_P3 | PASS_REACT_AND_OWNER_FIXTURE | 08dc6f4 | docs/status/evidence/bar-apero-350/g1/p3.log — 12 groupes P3, mocks Google exact/ambigu/429/HTML/tardif et limites owner ; adaptation des clics Reprendre, aucune assertion financière supprimée. |
| G1_EXISTING | PASS_REACT | 08dc6f4 | docs/status/evidence/bar-apero-350/g1/existing.log — 8 groupes dernière réception dont participants page5→4, RAW, 15 boissons/9 Before et suppression. |
| G2_REACT | PASS_REACT | 4ee0a1f | docs/status/evidence/bar-apero-350/g2/react.log — Global60 vers UNKNOWN atomique, identité montant, unités publiées Before et RAW. |
| G2_P4 | PASS_REACT_AND_OWNER_FIXTURE | 4ee0a1f | docs/status/evidence/bar-apero-350/g2/p4.log — 15 groupes P4, dont détails/global, ITEM/PERSON/SHARED, prix zéro, Before et Apply/Reload PGlite synthétique. |
| G2_P1 | PASS_REACT | 4ee0a1f | docs/status/evidence/bar-apero-350/g2/p1.log — Régressions interactions indépendantes, RAW, endpoints et continuation. |
| G2_P2 | PASS_REACT | 4ee0a1f | docs/status/evidence/bar-apero-350/g2/p2.log — Régressions d’interactions et de protection des tuiles. |
| G2_BROWSER | PASS_BROWSER_FIXTURE | 4ee0a1f | docs/status/evidence/bar-apero-350/g2/browser.json — En-tête → coût60 → Bière → Détailler à la place : résumé à préciser, prix vide après Preview. Largeur effective1159. Aucun Auth. |
| FINAL_REACT | PASS_REACT | 4e0dc25 | docs/status/evidence/bar-apero-350/final/react.log — 22 targeted in-process React groups for new behavior; no real browser or Auth. |
| FINAL_P1 | PASS_REACT | 4e0dc25 | docs/status/evidence/bar-apero-350/final/p1.log — 25 existing targeted interaction/RAW/endpoint controls. |
| FINAL_P2 | PASS_REACT | 4e0dc25 | docs/status/evidence/bar-apero-350/final/p2.log — 20 local interaction, quantity, protection and pure-layout controls. |
| FINAL_P3 | PASS_REACT | 4e0dc25 | docs/status/evidence/bar-apero-350/final/p3.log — 12 Google mocks, owner DTO and known-place/route controls; no real provider. |
| FINAL_P4 | PASS_REACT | 4e0dc25 | docs/status/evidence/bar-apero-350/final/p4.log — 14 rich Before, units, funding, replacement and synthetic Apply/Reload controls. |
| FINAL_LAST | PASS_REACT | 4e0dc25 | docs/status/evidence/bar-apero-350/final/last.log — 8 rich scene/pagination/target/removal and actual-shell mocked transport controls. |
| FINAL_PARITY | PASS_OWNER_FIXTURE | 4e0dc25 | docs/status/evidence/bar-apero-350/final/parity.log — 22 owner scenarios, 9 hashes each =198 identical financial hashes; no golden changed. |
| FINAL_DURABLE | PASS_REACT | 4e0dc25 | docs/status/evidence/bar-apero-350/final/durable.log — 7 actual hook deterministic controls: debounce, CAS, lost response, offline and archive. Not Auth. |
| FINAL_APPLY | PASS_OWNER_FIXTURE | 4e0dc25 | docs/status/evidence/bar-apero-350/final/apply.log — 8 P13 PGlite owner controls including successful commit then failed reread; no production Apply. |
| FINAL_HTTP | PASS_HTTP_FIXTURE | 4e0dc25 | docs/status/evidence/bar-apero-350/final/http.log — 7 true loopback HTTP synthetic checks. Backend owner unchanged from running fixture; no browser/Auth. |
| FINAL_C8 | PASS_STATIC | 4e0dc25 | docs/status/evidence/bar-apero-350/final/c8.log — Original C8-017 isolated assertion executed unchanged. |
| FINAL_TYPES | PASS_TYPESCRIPT | 4e0dc25 | docs/status/evidence/bar-apero-350/final/types.json — TypeScript exit0 exact final product tree. |
| FINAL_ENVIRONMENT | BLOCKED_ENV | 4e0dc25 | docs/status/evidence/bar-apero-350/final/environment.json — Actual browser unavailable and no authorized isolated Auth/provider session. |
| FINAL_SCOPE | PASS_STATIC | 4e0dc25 | docs/status/evidence/bar-apero-350/final/scope.json — Source diff and manual ownership/React review; does not certify UX. |
| G3_PREVIEW_BUILD | PASS_BUILD_PREVIEW | 83ac6e1 | docs/status/evidence/bar-apero-350/final/g3-preview.json — Full remote Next build READY. No functional browser or Auth test. |

Captures réelles non recadrées G1/G2, conservées hors publication : outputs/bar-350/g1-browser/date.png, places.png et outputs/bar-350/g2/unknown.png. Elles ne prouvent pas la version finale G3/G5. Les anciennes captures Production contenant des voisinages personnels ne sont ni commitées ni téléversées.

Incident Auth historique : rapport privé outputs/bar-last/live/PRODUCTION_AUTH_RECEPTION_2026-10-18.md. Version bd97a33 ; canari antérieur archivé, aucune nouvelle écriture personnelle dans cette reprise. Aucune causalité établie entre 57014 Preview et échec Draft.

| G5_PREVIEW_BUILD | PASS_BUILD_PREVIEW | 4e0dc25 | final/g5-preview.json ; Next complet READY, fin de journal seulement ; aucune réception fonctionnelle Auth. |
| FINAL_INTEGRITY | PASS_STATIC | ac22d09, produit 4e0dc25 | final/integrity.log ; 350 textes exacts et sept falsifications refusées. |

## Clôture effective

- CLOSURE_BROWSER — PASS_BROWSER_FIXTURE — 79e3bf0dfb268ca6c5a1599cb7de82684f09e6ac — docs/status/evidence/bar-apero-350/closure/final-browser-results.json — Campagne partielle réelle : dense15+9, tailles effectives1152/1440/1728/1920, lieux, RAW, prix, mode/véhicule, pagination. Pas Auth, Google réel final, zoom125 ni transitions complètes.
- CLOSURE_EMPTY — PASS_BROWSER_FIXTURE — 79e3bf0dfb268ca6c5a1599cb7de82684f09e6ac — docs/status/evidence/bar-apero-350/closure/final-empty.json — Bar vide final1152x720 hauteur245, métadonnées alignées; calendrier clavier1tabstop.
- CLOSURE_DRAFT — PASS_SERVICE_FIXTURE — 79e3bf0dfb268ca6c5a1599cb7de82684f09e6ac — docs/status/evidence/bar-apero-350/closure/draft-service.json — Service réel avec Supabase contrôlé : Before riche incomplet, réponse perdue sans double write, code57014 séparé, accès refusé et diagnostics expurgés. Pas RLS/Auth.
- CLOSURE_HTTP — PASS_HTTP_FIXTURE — 79e3bf0dfb268ca6c5a1599cb7de82684f09e6ac — docs/status/evidence/bar-apero-350/closure/http.log — HTTP loopback réel, données synthétiques,7contrôles CAS/rich/38incomplet sans Apply.
- CLOSURE_PARITY — PASS_FIXTURE — 79e3bf0dfb268ca6c5a1599cb7de82684f09e6ac — docs/status/evidence/bar-apero-350/closure/parity.log — 22x9=198 empreintes inchangées au code final.
- CLOSURE_FINAL_TESTS — PASS_REACT_AND_OWNER_FIXTURE — 79e3bf0dfb268ca6c5a1599cb7de82684f09e6ac — docs/status/evidence/bar-apero-350/closure/final-closure-tests.json — 12 commandes, tous codes0 sur79e3bf0; suites Bar, Draft/CAS, Apply synthétique, C8, TypeScript
- CLOSURE_REACT — PASS_REACT — 79e3bf0dfb268ca6c5a1599cb7de82684f09e6ac — docs/status/evidence/bar-apero-350/closure/final-closure-react.log — 24 groupes réels, dont navigation externe/RAW et capsule véhicule; aucun navigateur simulé revendiqué

- CLOSURE_ZOOM — PASS_BROWSER_FIXTURE —79e3bf0 — closure/final-native-zoom.json.
- CLOSURE_BUILD — PASS_BUILD_ONLY —aaec279 — closure/preview.json, arbre produit79e3bf0 inchangé.
# Réception complémentaire du 18 octobre — produit ba949a6

Rapport courant : `docs/status/BAR_APERO_350_FINALISATION_GATES_VERCEL_AUTH_RECEPTION.md`.
Les pièces précédentes restent historiques. Le dossier `finalisation/` contient les97transitions initialement ouvertes, les60affectations UI, les frames avant/après (y compris les échecs), les captures complètes, les tests avec SHA et la preuve HTTP authentifiée isolée. Le registre indique327clos au niveau annoncé et23résiduels ; aucune clôture350/350 ni certification UI authentifiée globale.
