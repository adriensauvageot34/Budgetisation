# Bar / Apéro — réception finale UX et fonctionnelle

## Verdict et références

**READY_FOR_HUMAN_UX_ACCEPTANCE_WITH_LIMITS**, pour le code et les preuves isolées décrits ci-dessous. **Pas de certification UX navigateur, fournisseur Google réel ou persistance Supabase authentifiée.** Les critères visuels A/B et les temps de retrait restent à recevoir humainement ; aucun GO Production n'est déduit de ce verdict.

- Base vérifiée : PR #64 OPEN Draft, `dc8780b8b0237190ed546819d3342c8b746ec5de`, descendante de #63 OPEN Draft `f637297f5a0d6c69287b75ae83d257ca9c849401`. Main observé : `d6379bcbfdc217ee51c05989f2036407329eb2fd` (P2). Aucun de ces historiques n'a été réécrit.
- Branche : `codex/bar-apero-final-ux-functional` ; [PR Draft #65](https://github.com/adriensauvageot34/Budgetisation/pull/65), **base #64**, dépendance #63 conservée.
- Code produit compilé : **`841219d2ab57164d5e7879a257e62a8aa6b97c49`**. Les ajouts suivants sont uniquement des tests et ce dossier de preuves ; le SHA de réception est le commit qui porte ce rapport (pas un faux SHA auto-référent).
- [Preview exacte du code produit](https://budgetisation-dkfx69bof-adriensauvageot34-6137s-projects.vercel.app/mois-a-venir/composer?month=2026-11) : `dpl_EFVT5mEtag5U5hhdUbQ9jkh62wkG`, **READY**, target Preview/null. `npm run build` → `next build`, compilation, TypeScript, génération et assemblage terminés. Voir `evidence/bar-apero-last/vercel-build-product.log` et `preview.json`.
- Smoke officiel Vercel : HTTP 200 après protection Vercel, page **Connexion · Budgetisation**. Ceci prouve l'accès au déploiement et le garde applicatif ; **ce n'est pas un Composer authentifié testé**.
- GET Draft sans en-tête de version : HTTP409 `DRAFT_CONTRACT_INCOMPATIBLE`, refus attendu avant Auth selon la route existante ; aucun contenu de Draft relu. Ce contrôle ne certifie pas la RLS.
- Pas de merge, promotion, migration, lecture financière distante, mutation personnelle, changement de SNAP-3, nouvel owner ou généralisation.

## Avant / cause / correction / preuve

| Sujet | Avant et cause prouvée | Code corrigé / résultat observé | Niveau et limite |
|---|---|---|---|
| Date | Le calendrier était rendu après Before et toutes les consommations. Palette neutre malgré Date active. | Scène Date seule avec calendrier et dock dédié ; 15 consommations et 9 objets Before survivent au choix du jour. | FIXED / PASS_REACT ; visibilité au vrai viewport NOT_RUN_BROWSER. |
| Lieu | Recherche après sections économiques ; filtre VENUE excluait cafés/restaurants. | Recherche locale primaire, trois résultats/page ; Google explicitement accessible, ville modifiable et recherche sans ville. | FIXED / PASS_REACT + PASS_DOMAIN avec provider simulé ; NOT_RUN_PROVIDER. |
| Carte et scroll | `overflow:auto` interne, montage/clamp d'étagère, toutes sections simultanées. | Une scène ciblée ; quatre objets/page ; overflow interne visible et packing réservé au rectangle du Bar. | FIXED_CODE ; aucun contenu supprimé en test React ; rectangles et zéro chevauchement NOT_RUN_BROWSER. |
| Dock | Défilement et choix hors surface ; descriptions répétées. | Vraies pages, largeur mesurée, touches gauche/droite, détail secondaire. | PASS_REACT ; adaptation de largeur/focus et zoom à certifier en navigateur. |
| Before | Lien « Moment lié » au lieu de sa composition. | Miniature de ses vraies sélections, groupe Avant de sortir, accès direct au bon ID, pagination. Le fallback historique reste accessible si non projetable. | PASS_REACT, identités conservées ; pas de nouveau sous-owner. |
| Retrait équipé | Attente serveur sans état ciblé ; grande action destructive permanente. | Menu ⋯, message d'attente ciblé avant transport, erreur sans disparition, suppression admise puis Undo exact. | PASS_REACT sur le vrai Shell avec transport différé ; peinture/latence et drag natif NOT_RUN_BROWSER. |
| RAW au retrait parent | Le menu passait par DROP/TRASH sans garde RAW du Shell pour ce chemin. | Garde ciblée Bar et descendants avant toute requête ; Continuer n'envoie rien, abandon explicite seulement, rejet préserve le Draft. | FIXED / PASS_REACT, sans changement d'autorité financière. |
| Actions parasites | Réglage technique permanent, retrait Before au premier plan. | Détails du poste et menu Before ; coût publié mis en avant et illustration bière existante. | FIXED_CODE ; jugement artistique humain requis. |

## Maps — comparaison précise et limites propriétaires

Les mêmes huit observations synthétiques sont passées aux véritables normaliseurs/propriétaires : VENUE avant **2**, Restaurant existant **4**, BAR_APERO **6**. Bar admet bar, cafe, coffee_shop, bar_and_grill, restaurant, night_club ; bank et gas_station restent exclus. Ce n'est **pas** un chiffre de résultats Google réel.

Le flux Déclarer une dépense/Restaurant garde ses filtres, contrats, masques et endpoints. Les masques d'API, l'ID exact des Details, le biais Montpellier 20 km, une autre ville et l'absence de biais sans ville sont exercés avec un fetch synthétique. Recherche Canonical explicite étendue aux cafés non privés, sans reclasser les suggestions par défaut. Le test Maps historique est vert.

Le test React V8 vérifie réponses périmées, annulation, session token, 429, HTML, 401, 403 et Details d'une autre identité ; aucune adoption implicite. Les lieux nouvellement découverts ne deviennent pas KNOWN ; nom libre explicite seulement. **NOT_RUN_PROVIDER et NOT_RUN_AUTH**, donc parité réelle côte à côte Déclarer une dépense ↔ Bar encore ouverte.

| Limite propriétaire | Statut |
|---|---|
| Nouvelle identité Google durable / promotion Canonical | BLOCKED_OWNER, aucun writer ajouté. |
| Lieu distinct du Before | Contrat existant conservé ; non inventé. |
| Plafond autonome | Non ajouté ; le montant reste un coût économique prévu. |
| Liaison Bar ↔ endpoint / coûts | Oracles P1/P3/P4 conservés ; décisions et arbitrages explicites. Aucun déplacement implicite de prix. |

## Matrice FINAL — niveaux de preuve

`PASS_REACT` = transitions en processus, refs/portails simulés ; `PASS_DOMAIN` = propriétaires réels sur données synthétiques ; `PASS_HTTP_FIXTURE` = vrai HTTP loopback, stockage isolé. **Aucun de ces labels n'est PASS_BROWSER, PASS_AUTH ou PASS_PROVIDER.**

| Test | Exécution et résultat | Réserve |
|---|---|---|
| FINAL-UX-01 | PASS_REACT : Date sur 15 consommations + 9 Before, conservation des slots/IDs. | Calendrier visible sans scroll au vrai viewport NOT_RUN_BROWSER. |
| FINAL-UX-02 | PASS_REACT : recherche primaire, aucune autre tuile repoussant la scène Lieu. | Google réel / géométrie NOT_RUN. |
| FINAL-UX-03 | PASS_REACT : une tuile, même sélection, prix RAW conservé après changement de cible refusé. | Peinture/focus natifs non certifiés. |
| FINAL-UX-04 | PASS_REACT : toutes les 15 boissons et 9 Before atteignables par pages sans écriture ; retrait de la dernière personne d'une page conserve l'accès aux quatre restantes. | 1152×720, zoom125, overflow et rects NOT_RUN_BROWSER. |
| FINAL-UX-05 | PASS_REACT : miniature réelle et ciblage enfant Before ; compact limité. | Hauteur raisonnable, repli et reflow visibles non certifiés. |
| FINAL-UX-06 | PASS_REACT : Date n'affiche pas la palette neutre. | Dock réellement affiché après compilation non manipulé. |
| FINAL-MAPS-01 | PASS_DOMAIN : mêmes observations, filtres comparés, Restaurant inchangé. | NOT_RUN_PROVIDER, pas de comparaison authentifiée de vrais résultats. |
| FINAL-MAPS-02 | PASS_DOMAIN : types, villes, Details, privé exclu, identité exacte ; aucun KNOWN inventé. | Requêtes Google facturées non exécutées. |
| FINAL-MAPS-03 | PASS_REACT : tardif/429/HTML/401/403/Details non admissible, reprise prévue et aucune adoption. | Réseau provider réel non certifié. |
| FINAL-DELETE-01 | PASS_REACT : contrôle de retrait, état d'attente réel du Shell avant réponse ; plus de bande Retirer ce moment. | Drag natif et latence peinture NOT_RUN_BROWSER. |
| FINAL-DELETE-02 | PASS_REACT : menu natif accessible, garde RAW, protection et Undo. | Parcours clavier natif NOT_RUN_BROWSER. |
| FINAL-DELETE-03 | PASS_REACT P1/P4/V8 : suppression ciblée, consentement et restauration des décisions admises/IDs. | Dialogue natif et Undo clavier non certifiés. |
| FINAL-DELETE-04 | PASS_REACT P4 : Before RAW / refus / continuer / consentement / Undo des données admises. | Parcours Diluant 4→RAW9→Undo dans navigateur NOT_RUN_BROWSER. |
| FINAL-DELETE-05 | PASS_REACT : transport du Shell retenu puis refus/succès, aucun faux commit ni perte, Apply indisponible après refus. | Pas de captures jalonnées ni P95 ; attente longue non masquée par succès. |
| FINAL-FIN-01 | PASS_DOMAIN : P4, Mobility, V8 ; Finance **198/198** (22 cas × 9 empreintes), goldens inchangés. | Pas d'Apply personnel ; Apply/Reload uniquement PGlite. |
| FINAL-PERSIST-01 | PASS_HTTP_FIXTURE : état riche, CAS, réponse perdue/relecture/replay, versions et Undo/Redo sérialisés. | **NOT_RUN_AUTH**, pas de sauvegarde Supabase de ce lot. |

## Régressions réellement exécutées

Commandes depuis la racine ; journaux dans `evidence/bar-apero-last/` :

| Commande | Statut |
|---|---|
| `node scripts/check-bar-apero-p1.mjs` | PASS, 25 groupes React/synthétiques. |
| `node scripts/check-bar-apero-p2.mjs` | PASS, 20 groupes React/layout synthétique. |
| `node scripts/check-bar-apero-p3.mjs` | PASS, 12 groupes synthétiques. |
| `node scripts/check-bar-apero-p4.mjs` | PASS, 14 groupes dont Preview→Apply→Reload→Mon Plan PGlite. |
| `node scripts/check-bar-apero-last.mjs` | PASS, 8 groupes React dont vrai Shell, aucune écriture distante. |
| `node scripts/check-bar-apero-last-maps.mjs` | PASS_DOMAIN avec fournisseur simulé. |
| `BAR_P4_FIXTURE_ORIGIN=http://127.0.0.1:3223 node scripts/check-bar-apero-p4-http.mjs` | PASS_HTTP_FIXTURE : 4 sauvegardes, version finale 4, coût propriétaire connu38 + incertitude, aucun Apply. |
| `node scripts/check-l4-e-bar-v8.mjs` | PASS, 16 groupes. |
| `node scripts/check-l4-d-bar-mobility.mjs` | PASS. |
| `node scripts/check-l4-a.mjs` | PASS, 19 contrôles. |
| `node scripts/check-l4-b-presets.mjs` | PASS, 47 presets. |
| `node scripts/check-planner-performance-parity.mjs` | PASS, 198 empreintes. |
| `node scripts/check-pre-l4-c2-c8-source.mjs` | PASS C8-017, assertion originale. |
| `node scripts/check-phase2-google-places.mjs` | PASS, ancien parcours Maps synthétique. |
| `node node_modules/typescript/bin/tsc --noEmit` | PASS, sortie0. Journal vide conservé. |
| Vercel `npm run build` / `next build` | PASS_COMPLET_PREVIEW au SHA produit, READY. |

Les scripts P1–P4 et V8 ont été adaptés pour **naviguer réellement** vers la synthèse ou la page du dock avant de cliquer un élément désormais hors scène. Aucune assertion de montant, ID, financement ou golden supprimée. V8 demande désormais BAR_APERO et le texte d'erreur produit réel. Les premiers échecs de navigation des harnais sont conservés, avec leur correction expliquée : ce n'étaient pas des résultats financiers divergents à accepter.

Le premier HTTP a échoué EACCES dans le sandbox ; le client autorisé seul a ensuite rencontré un timeout face au serveur isolé. Exécution serveur/client dans le même environnement autorisé, démarrage attendu puis arrêt garanti : PASS. Aucune protection navigateur contournée.

## Fichiers et justification

- `bar-living-editor.tsx`, `bar-living-operations.ts` : scènes, pagination, cible Before, détail secondaire ; aucune mutation propriétaire réécrite.
- `bar-living-card.tsx`, `bar-living-details.tsx` : synthèse/miniatures, illustration existante, menu de gestion et attente honnête.
- `bar-pages.tsx`, `context-palette.tsx` : pagination transitoire et clavier, comportement conditionné à Bar.
- `composer.module.css`, `inventory-layout.ts`, `presentation/adapter.ts` : surfaces sans scroll interne, packing et hauteur propres au Bar. C8 original conservé.
- `composer-shell.tsx` : garde RAW au retrait Bar et état d'attente ciblé ; confirmation serveur, Apply et CAS inchangés.
- `bar-place-search.tsx`, `bar-place-knowledge.ts` : résultats directs paginés, ville/libre et erreurs compréhensibles, pas de promotion Canonical.
- `restaurant-places.ts`, `places/http.ts`, `places/google-places.ts` : découverte BAR_APERO explicite, contexte sans ville admis pour ce seul type ; validations d'accès existantes préservées.
- Tests P1–P4/V8 et deux tests LAST : couverture des interactions existantes et nouveaux défauts ; aucune donnée réelle.

Les 135 propositions de l'annexe sont indexées dans `evidence/bar-apero-last/ideas-135.json`. Elles ne sont **pas** annoncées 135/135 certifiées : la direction artistique complète, la ligne unique des deux trajets, les animations et la géométrie réelle restent partielles ou non certifiées. Les améliorations structurelles et la conservation sont développées ; l'annexe ne devient pas un permis d'inventer les capacités propriétaires absentes.

## Recette restante, courte et non intrusive

Le navigateur officiel a répondu à `cua.getState()` : **Local browser use is disabled in Work settings**. Aucun autre navigateur/driver n'a été employé. Pas de nouvelle demande de mot de passe ni de manipulation d'un Draft personnel.

1. Sur un environnement isolé autorisé au code produit, ouvrir le vrai preset `bar-apero` avec Before9/boissons15/Aller/Retour. Date, Lieu, Personnes, poste et Retour doivent montrer une seule scène.
2. Mesurer largeur effective 1152×720 puis desktop1440/1728/1920 et zoom125 ; pour chaque surface carte/éditeur/compact/question/tuile active : `overflowY`, rect, `clientHeight/scrollHeight`, visibilité input/actions, focus. Vérifier aussi overflowX document et absence de chevauchement du Board. Une hauteur naturelle de contenu supérieure au viewport relève du Board global, jamais d'un masquage interne.
3. Même compte/scope/provider autorisé : comparer un nom café-bar entre Déclarer une dépense et Bar, villes Montpellier/autre/sans ville, exact Details et nom libre. Ne pas promouvoir d'identité Google.
4. Retirer un Bar équipé par drag puis par menu ; relever geste→feedback, admission, SAVED (si transport durable autorisé), refus, Undo. Diluant admis4→RAW9→Retirer→Continuer, puis consentement/Undo : retrouver4 et son ID.
5. Seulement avec Auth isolée autorisée : sauvegarde/rechargement/nouvelle session/réédition. Aucun Apply personnel.

**Sortie de mission : PR Draft pour revue humaine, aucune intégration.** Les questions visuelles ci-dessus sont les réserves de réception ; pas de nouveau chantier global.
