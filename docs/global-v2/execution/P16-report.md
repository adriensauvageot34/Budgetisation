# P16 — Frontend Analyse Globale complet

## Baseline, autorité et périmètre

- Branche : `main`.
- HEAD d’entrée : `f4653000ce16c15a945b5de37ca46c27680f4985`.
- Prérequis P15 : `GLOBAL_PHASE_H2_EXACT_RESOURCE_INSTANCES`, `GLOBAL_PHASE_H4`, `IMPLEMENTATION_GATE`, `CONTRACT_GATE` et `TEST_GATE` à `PASS`.
- Autorités appliquées : C01–C14, Master Global V2, UX GLOBAL ARCHITECTURE FINALE, P13–P15 et contrats P01–P12 certifiés.
- Périmètre : H5 local, React/UI, transport de visite épinglé et préparation du cutover. Aucun calcul Analytics, aucune publication, migration, écriture live ou activation Production.

## Architecture livrée

Le nouveau chemin est `/analyse-globale`. Il reste volontairement parallèle à `/historique/analyse/global` : en build Production, la route affiche l’état « interface prête pour le cutover » et renvoie vers l’expérience active. En développement, les scénarios contractuels rendent l’intégralité de l’interface sur des payloads strictement conformes aux RuntimeSchemas P14/P15. P17 reste propriétaire de l’application du schéma Global, de la matérialisation et de l’activation.

Le flux UI est :

```text
GlobalInitialReadModel + ImportedGlobalSummaryReadModel
→ génération épinglée pour la visite
→ module COMPACT proche du viewport
→ section EXPANDED ciblée au clic
→ détail analytique / aperçu entité / méthodologie ciblés
```

`GlobalV2VisitRuntime` ne reçoit qu’un transport snapshot. Sa clé de cache inclut publication, révision, ressource et paramètres. Deux lectures de fond au maximum sont exécutées ; une navigation directe remonte la requête dans la file. Toute réponse portant une autre publication, révision, `factsHash` ou `manifestHash` est rejetée. Une nouvelle génération produit un bandeau explicite et ne remplace jamais silencieusement la génération épinglée.

React projette uniquement les champs des ReadModels : textes, métriques d’affichage, qualité, limitations, séries, lignes et destinations. Il n’importe ni Analytics, ni CanonicalRepository, ni FactSourceResolver.

## Parcours et comportement

| Contrat | Implémentation | Preuve | Statut |
|---|---|---|---|
| Page unique | `/analyse-globale`, Synthèse puis M1–M10 | route + catalogue ordonné | PASS |
| Temps | borne certifiée affichée, aucun sélecteur temporel universel | source + gate négatif | PASS |
| COMPACT | 0–1 insight, 0–3 KPI, qualité et limitations | RuntimeSchemas + 10 modules | PASS |
| EXPANDED | cinq sections ciblées, cinq insights maximum, chronologies/tables secondaires | 50 payloads de sections validés | PASS |
| Desktop | plusieurs modules peuvent rester ouverts | reducer de visite | PASS |
| Mobile | un seul module ouvert, nav en chips, grilles repliées, overlay plein écran | reducer + CSS responsive | PASS |
| Deep links | hash module/section, ouverture et scroll ciblés | parser + source | PASS |
| Navigation | barre sticky, Synthèse en premier, module actif via IntersectionObserver | source + CSS | PASS |
| HIDDEN | absent du rendu et de la navigation | filtrage initial manifest | PASS |
| PLACEHOLDER | état informatif distinct de loading/empty | fixture Consumption + RuntimeSchema | PASS |
| Chargement | shell immédiat, premier module eager, proximité 150 %, détails au clic | hooks + source | PASS |
| Concurrence | deux fetchs, priorité directe | test instrumenté | PASS |
| Cache | publication + révision + ressource + paramètres | tests de clés | PASS |
| Génération | annonce explicite, aucun hot-swap, réponse tardive refusée | scénario `new-generation` + test | PASS |
| Erreur | erreur et retry locaux, ErrorBoundary par module | scénario `local-error` + source | PASS |
| Qualité | KNOWN/PARTIAL/UNKNOWN/NOT_APPLICABLE/CONFLICT et limitations distinctes | renderer commun | PASS |
| Détails | neuf familles analytiques + méthodologie ; aperçu entité en overlay | 10 RuntimeSchemas ciblés | PASS |
| Accessibilité | titres H1/H2, aria-expanded/controls/current, Escape, focus restoration, séries textuelles | source + OverlayFrame certifié | PASS |
| Mouvement | transitions courtes et `prefers-reduced-motion` | CSS | PASS |
| Instrumentation | cinq événements normatifs, aucun apprentissage automatique | tests statiques | PASS |

La recherche interne, les favoris, l’épinglage, le réordonnancement manuel et la personnalisation par usage ne sont pas implémentés : le Master les exclut de V1 ou les réserve à une version ultérieure. Leur absence est donc une conformité, pas un gap du lot.

## Fichiers

| Fichier | Rôle |
|---|---|
| `src/app/analyse-globale/page.tsx` | route parallèle et activation Production différée |
| `src/app/analyse-globale/loading.tsx` | shell de chargement route |
| `src/features/global-v2/global-v2-page.tsx` | page, modules, sections, détails et états locaux |
| `src/features/global-v2/global-v2.module.css` | hiérarchie visuelle, responsive, sticky, reduced motion |
| `src/features/global-v2/visit-runtime.ts` | génération épinglée, cache, concurrence et rejet tardif |
| `src/features/global-v2/use-global-resource.ts` | transport local par ressource et proximité viewport |
| `src/features/global-v2/catalog.ts` | ordre M1–M10 et copie de présentation uniquement |
| `src/features/global-v2/fixture-data.ts` | fixtures synthétiques RuntimeSchema pour preuve locale |
| `src/features/global-v2/module-boundary.tsx` | isolation d’un défaut de rendu |
| `src/features/global-v2/instrumentation.ts` | événements UX normatifs |
| `scripts/check-global-v2-frontend.mjs` | gate comportemental P16 |

## Coexistence et cutover préparé

Les neuf ressources legacy restent intactes : `analysis_global_initial`, `analysis_global_baseline`, `analysis_global_typical`, `analysis_global_breakdown`, `analysis_global_evolution`, `analysis_global_contexts`, `analysis_global_habits`, `analysis_global_profiles`, `analysis_global_universe`.

Leurs consommateurs actuels sont la route `/historique/analyse/global`, `AnalysisGlobalPage`, le registre Query générique, ses adapters/sources, capabilities, invalidations, diagnostics et tests `check-analysis-global-contracts`. Rien n’est retiré ou reclassifié dans P16. P17 devra prouver le remplacement de chaque consommateur avant tout retrait ; le rollback conserve donc l’intégralité de cette pile.

Le nouveau frontend consomme exclusivement les contrats `src/query-api/global-v2`. Les fixtures sont sélectionnées uniquement hors build Production et n’alimentent aucune Query, publication ou donnée produit. L’activation Production nécessite encore `PENDING_LIVE_SCHEMA`, une génération Global certifiée et le raccordement snapshot-only authentifié de P17.

## Tests exécutés

- `check-global-v2-frontend` : **257/257 PASS**.
- RuntimeSchemas fixtures : **71/71 PASS** — 10 COMPACT, initiale, 50 sections, 9 détails et méthodologie.
- Matrice Master P16 : **150 exigences**, **29 capabilities**, **168 tests** indexés.
- Concurrence mesurée : **2** maximum ; cache : une lecture pour deux demandes identiques ; réponse tardive d’une autre génération refusée.
- Typecheck : **PASS**.
- Architecture : **PASS**, 554 fichiers.
- Build Production Next 16.2.6 : **PASS** ; route `/analyse-globale` compilée.
- `git diff --check` : **PASS** sur l’état vérifié avant clôture documentaire.

## Preuve navigateur et niveaux de preuve

| Niveau | Résultat | Portée |
|---|---|---|
| CODE | PASS | comportements, états, cache, génération, accessibilité et responsive implémentés |
| BUILD | PASS | compilation Next Production et typage |
| QUERY | PASS SYNTHETIC | 71 payloads synthétiques validés ; aucune Query live |
| CLIENT | PENDING ENVIRONMENT | tentative locale arrêtée avant React par le middleware : variables Supabase locales absentes |
| LIVE | PENDING P19/P17 | aucune publication ou session Global V2 live autorisée |

La tentative navigateur sur `http://127.0.0.1:3216/analyse-globale?fixture=contract` a atteint le middleware, qui a affiché l’overlay Next « `NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY sont requises` ». Aucun bypass d’authentification et aucune variable n’ont été créés. La capture utile est donc celle d’un blocker environnemental, pas une preuve du composant ; aucune capture trompeuse n’est committée.

Cas exacts à reprendre avec une session locale autorisée : ouverture directe, attente de plusieurs secondes après hydratation, M1–M10, multi-expanded desktop, single-expanded mobile, cinq sections, neuf détails, méthodologie, retour/scroll/focus, deep link `#lieux-evolution`, scenario erreur/retry, annonce de nouvelle génération, clavier/Escape et console sans grand écran Next.

## Matrice exhaustive P16

Chaque ligne attribuée à P16 dans `GLOBAL_MASTER_INDEX.json` est conservée ci-dessous. `P16_UI` désigne la preuve comportementale de ce lot ; `UPSTREAM+P16` désigne une vérité déjà certifiée P01–P15 que React rend sans la recalculer ; `EXCLUDED_V1` désigne une capability explicitement hors V1.

| Requirement | Ligne normative | Composant / comportement | ReadModel | Preuve | Statut |
|---|---|---|---|---|---|
| `GLO-ARC-006` | éjà conceptuellement existants / à réutiliser (`P9278-P9287`) | GlobalV2Page | P14/P15 ReadModels | absence import Analytics | PASS — UPSTREAM+P16 |
| `GLO-ARC-007` | À ajouter ou formaliser pour Global (`P9288-P9303`) | GlobalV2Page | P14/P15 ReadModels | absence import Analytics | PASS — UPSTREAM+P16 |
| `GLO-ARC-010` | eux & mobilité (`P9315-P9321`) | GlobalV2Page | P14/P15 ReadModels | absence import Analytics | PASS — UPSTREAM+P16 |
| `GLO-CERT-002` | Il faut trois niveaux de sévérité, pas seulement deux (`P11571-P11575`) | QualityLine / module states | qualification P14/P15 | upstream gate + renderer | PASS — UPSTREAM+P16 |
| `GLO-CERT-003` | LOCKING (`P11576-P11578`) | QualityLine / module states | qualification P14/P15 | upstream gate + renderer | PASS — UPSTREAM+P16 |
| `GLO-CERT-004` | EGRADING (`P11579-P11583`) | QualityLine / module states | qualification P14/P15 | upstream gate + renderer | PASS — UPSTREAM+P16 |
| `GLO-CERT-005` | ARNING (`P11584-P11586`) | QualityLine / module states | qualification P14/P15 | upstream gate + renderer | PASS — UPSTREAM+P16 |
| `GLO-CERT-034` | Nous deux — BLOCKING (`P11848-P11859`) | QualityLine / module states | qualification P14/P15 | upstream gate + renderer | PASS — UPSTREAM+P16 |
| `GLO-CERT-073` | eux cycles saisonniers (`P12174-P12176`) | QualityLine / module states | qualification P14/P15 | upstream gate + renderer | PASS — UPSTREAM+P16 |
| `GLO-CERT-074` | eux cycles saisonniers affichés comme saisonnalité (`P12177-P12178`) | QualityLine / module states | qualification P14/P15 | upstream gate + renderer | PASS — UPSTREAM+P16 |
| `GLO-FND-012` | Deux corpus distincts : certifié et courant (`P147-P148`) | quality / evidence projection | sortie certifiée P01–P15 | upstream tests + P16 renderer | PASS — UPSTREAM+P16 |
| `GLO-FND-013` | ERTIFIED_HISTORY (`P149-P163`) | quality / evidence projection | sortie certifiée P01–P15 | upstream tests + P16 renderer | PASS — UPSTREAM+P16 |
| `GLO-FND-014` | E_TAIL (`P165-P174`) | quality / evidence projection | sortie certifiée P01–P15 | upstream tests + P16 renderer | PASS — UPSTREAM+P16 |
| `GLO-FND-028` | eux (`P252-P253`) | quality / evidence projection | sortie certifiée P01–P15 | upstream tests + P16 renderer | PASS — UPSTREAM+P16 |
| `GLO-FND-040` | Seuils minimaux de support — doctrine (`P332-P342`) | quality / evidence projection | sortie certifiée P01–P15 | upstream tests + P16 renderer | PASS — UPSTREAM+P16 |
| `GLO-FND-060` | Seuils généraux de coverage (`P460-P461`) | quality / evidence projection | sortie certifiée P01–P15 | upstream tests + P16 renderer | PASS — UPSTREAM+P16 |
| `GLO-FND-061` | ≥ 85 % (`P462-P464`) | quality / evidence projection | sortie certifiée P01–P15 | upstream tests + P16 renderer | PASS — UPSTREAM+P16 |
| `GLO-FND-062` | 84,99 % (`P465-P467`) | quality / evidence projection | sortie certifiée P01–P15 | upstream tests + P16 renderer | PASS — UPSTREAM+P16 |
| `GLO-FND-063` | < 60 % (`P468-P470`) | quality / evidence projection | sortie certifiée P01–P15 | upstream tests + P16 renderer | PASS — UPSTREAM+P16 |
| `GLO-FND-084` | Deuxième exemple (`P637-P650`) | quality / evidence projection | sortie certifiée P01–P15 | upstream tests + P16 renderer | PASS — UPSTREAM+P16 |
| `GLO-FND-099` | Deux familles d’estimation (`P736-P737`) | quality / evidence projection | sortie certifiée P01–P15 | upstream tests + P16 renderer | PASS — UPSTREAM+P16 |
| `GLO-FND-100` | YNAMIC_ESTIMATE (`P738-P743`) | quality / evidence projection | sortie certifiée P01–P15 | upstream tests + P16 renderer | PASS — UPSTREAM+P16 |
| `GLO-FND-101` | NAPSHOT_ESTIMATE (`P745-P751`) | quality / evidence projection | sortie certifiée P01–P15 | upstream tests + P16 renderer | PASS — UPSTREAM+P16 |
| `GLO-FND-106` | Deuxième axe : mode d’intégration (`P801-P802`) | quality / evidence projection | sortie certifiée P01–P15 | upstream tests + P16 renderer | PASS — UPSTREAM+P16 |
| `GLO-FND-130` | as A — aucune attribution réelle du carburant aux trajets (`P1030-P1037`) | quality / evidence projection | sortie certifiée P01–P15 | upstream tests + P16 renderer | PASS — UPSTREAM+P16 |
| `GLO-FND-138` | inance du foyer (`P1105-P1106`) | quality / evidence projection | sortie certifiée P01–P15 | upstream tests + P16 renderer | PASS — UPSTREAM+P16 |
| `GLO-FND-139` | oment (`P1107-P1108`) | quality / evidence projection | sortie certifiée P01–P15 | upstream tests + P16 renderer | PASS — UPSTREAM+P16 |
| `GLO-FND-140` | ous deux (`P1109-P1116`) | quality / evidence projection | sortie certifiée P01–P15 | upstream tests + P16 renderer | PASS — UPSTREAM+P16 |
| `GLO-FND-141` | Totaux mixtes : nature finale (`P1118-P1119`) | quality / evidence projection | sortie certifiée P01–P15 | upstream tests + P16 renderer | PASS — UPSTREAM+P16 |
| `GLO-FND-142` | % Observed (`P1120-P1121`) | quality / evidence projection | sortie certifiée P01–P15 | upstream tests + P16 renderer | PASS — UPSTREAM+P16 |
| `GLO-FND-143` | % Declared (`P1122-P1123`) | quality / evidence projection | sortie certifiée P01–P15 | upstream tests + P16 renderer | PASS — UPSTREAM+P16 |
| `GLO-FND-144` | % Estimated (`P1124-P1125`) | quality / evidence projection | sortie certifiée P01–P15 | upstream tests + P16 renderer | PASS — UPSTREAM+P16 |
| `GLO-FND-145` | lusieurs natures contribuent réellement au total (`P1126-P1130`) | quality / evidence projection | sortie certifiée P01–P15 | upstream tests + P16 renderer | PASS — UPSTREAM+P16 |
| `GLO-FND-171` | eux & mobilité (`P1256-P1258`) | quality / evidence projection | sortie certifiée P01–P15 | upstream tests + P16 renderer | PASS — UPSTREAM+P16 |
| `GLO-FND-174` | ous deux (`P1268-P1270`) | quality / evidence projection | sortie certifiée P01–P15 | upstream tests + P16 renderer | PASS — UPSTREAM+P16 |
| `GLO-INV-024` | Attention aux fenêtres glissantes (`P11002-P11007`) | VisitRuntime | publication metadata | pin/cache tests | PASS — UPSTREAM+P16 |
| `GLO-INV-074` | Cela rejoint l’UX Global (`P11359-P11363`) | VisitRuntime | publication metadata | pin/cache tests | PASS — UPSTREAM+P16 |
| `GLO-INV-116` | eux corrections successives (`P11548-P11549`) | VisitRuntime | publication metadata | pin/cache tests | PASS — UPSTREAM+P16 |
| `GLO-PUB-096` | Deux cycles (`P10643-P10647`) | visibility / placeholder | publication decision P14 | RuntimeSchema + fixture | PASS — UPSTREAM+P16 |
| `GLO-PUB-102` | Mais classement « lieux où vous dépensez le plus » (`P10686-P10693`) | visibility / placeholder | publication decision P14 | RuntimeSchema + fixture | PASS — UPSTREAM+P16 |
| `GLO-PUB-107` | 9. Nous deux (`P10724-P10733`) | visibility / placeholder | publication decision P14 | RuntimeSchema + fixture | PASS — UPSTREAM+P16 |
| `GLO-PUB-113` | PLACEHOLDER ET UX MOBILE (`P10762-P10769`) | visibility / placeholder | publication decision P14 | RuntimeSchema + fixture | PASS — UPSTREAM+P16 |
| `GLO-SCOPE-024` | MODULE 7 — Lieux & mobilité (`P12412-P12413`) | module ciblé M7/M10 | compact/expanded | capability rendering | PASS — UPSTREAM+P16 |
| `GLO-SCOPE-025` | éographie humaine (`P12415-P12434`) | module ciblé M7/M10 | compact/expanded | capability rendering | PASS — UPSTREAM+P16 |
| `GLO-SCOPE-026` | ONDITIONAL_V1 / DATA_GATED (`P12435-P12437`) | module ciblé M7/M10 | compact/expanded | capability rendering | PASS — UPSTREAM+P16 |
| `GLO-SCOPE-027` | obilité structurée (`P12439-P12441`) | module ciblé M7/M10 | compact/expanded | capability rendering | PASS — UPSTREAM+P16 |
| `GLO-SCOPE-028` | uel (`P12442-P12449`) | module ciblé M7/M10 | compact/expanded | capability rendering | PASS — UPSTREAM+P16 |
| `GLO-SCOPE-029` | inance localisée (`P12450-P12456`) | module ciblé M7/M10 | compact/expanded | capability rendering | PASS — UPSTREAM+P16 |
| `GLO-SCOPE-041` | UST_V1 (`P12525-P12527`) | module ciblé M7/M10 | compact/expanded | capability rendering | PASS — UPSTREAM+P16 |
| `GLO-SCOPE-042` | ONDITIONAL_V1 / DATA_GATED (`P12528-P12532`) | module ciblé M7/M10 | compact/expanded | capability rendering | PASS — UPSTREAM+P16 |
| `GLO-SCOPE-043` | ONDITIONAL_V1 / AUTHORITY_GATED (`P12533-P12537`) | module ciblé M7/M10 | compact/expanded | capability rendering | PASS — UPSTREAM+P16 |
| `GLO-SCOPE-049` | UX GLOBAL (`P12561-P12562`) | module ciblé M7/M10 | compact/expanded | capability rendering | PASS — UPSTREAM+P16 |
| `GLO-SCOPE-050` | UST_V1 (`P12563-P12587`) | module ciblé M7/M10 | compact/expanded | capability rendering | PASS — UPSTREAM+P16 |
| `GLO-SCOPE-051` | ATER (`P12588-P12591`) | module ciblé M7/M10 | compact/expanded | capability rendering | PASS — UPSTREAM+P16 |
| `GLO-UX-001` | Une seule page Analyse globale (`P9448-P9457`) | GlobalV2Page / VisitRuntime | Initial + Summary | gate P16 | PASS — P16_UI |
| `GLO-UX-002` | Aucun filtre temporel Global (`P9458-P9470`) | GlobalV2Page / VisitRuntime | Initial + Summary | gate P16 | PASS — P16_UI |
| `GLO-UX-003` | La page utilise une publication cohérente (`P9471-P9476`) | GlobalV2Page / VisitRuntime | Initial + Summary | gate P16 | PASS — P16_UI |
| `GLO-UX-004` | Nouvelle publication pendant la lecture (`P9477-P9483`) | GlobalV2Page / VisitRuntime | Initial + Summary | gate P16 | PASS — P16_UI |
| `GLO-UX-005` | Pas de gros GET /analysis/global (`P9484-P9491`) | GlobalV2Page / VisitRuntime | Initial + Summary | gate P16 | PASS — P16_UI |
| `GLO-UX-006` | Trois niveaux UX (`P9492-P9494`) | GlobalModulePanel | Compact + Expanded | RuntimeSchemas | PASS — P16_UI |
| `GLO-UX-007` | iveau 1 — Global Overview (`P9495-P9496`) | GlobalModulePanel | Compact + Expanded | RuntimeSchemas | PASS — P16_UI |
| `GLO-UX-008` | iveau 2 — Module (`P9497-P9498`) | GlobalModulePanel | Compact + Expanded | RuntimeSchemas | PASS — P16_UI |
| `GLO-UX-009` | iveau 3 — Exploration (`P9499-P9501`) | GlobalModulePanel | Compact + Expanded | RuntimeSchemas | PASS — P16_UI |
| `GLO-UX-010` | État normal d’un module : COMPACT (`P9502-P9510`) | GlobalModulePanel | Compact + Expanded | RuntimeSchemas | PASS — P16_UI |
| `GLO-UX-011` | Structure d’un module COMPACT (`P9511-P9519`) | GlobalModulePanel | Compact + Expanded | RuntimeSchemas | PASS — P16_UI |
| `GLO-UX-012` | C’est un point crucial pour l’infobésité (`P9520-P9526`) | GlobalModulePanel | Compact + Expanded | RuntimeSchemas | PASS — P16_UI |
| `GLO-UX-014` | EXPANDED (`P9532-P9538`) | GlobalModulePanel | Compact + Expanded | RuntimeSchemas | PASS — P16_UI |
| `GLO-UX-016` | Donc deux filtres successifs existent (`P9548-P9552`) | GlobalModulePanel | Compact + Expanded | RuntimeSchemas | PASS — P16_UI |
| `GLO-UX-017` | Sous-sections d’un module (`P9553-P9559`) | GlobalModulePanel | Compact + Expanded | RuntimeSchemas | PASS — P16_UI |
| `GLO-UX-018` | Exceptions (`P9560-P9566`) | GlobalModulePanel | Compact + Expanded | RuntimeSchemas | PASS — P16_UI |
| `GLO-UX-019` | Aucun accordion exclusif sur desktop (`P9567-P9575`) | navigation / visit state | Initial navigation | reducer + source | PASS — P16_UI |
| `GLO-UX-020` | Sur mobile : un seul module développé (`P9576-P9582`) | navigation / visit state | Initial navigation | reducer + source | PASS — P16_UI |
| `GLO-UX-021` | Les états d’ouverture ne sont pas Analytics (`P9583-P9586`) | navigation / visit state | Initial navigation | reducer + source | PASS — P16_UI |
| `GLO-UX-022` | Persistance de navigation (`P9587-P9596`) | navigation / visit state | Initial navigation | reducer + source | PASS — P16_UI |
| `GLO-UX-023` | Navigation interne sticky (`P9597-P9600`) | navigation / visit state | Initial navigation | reducer + source | PASS — P16_UI |
| `GLO-UX-024` | Barre sticky (`P9601-P9607`) | navigation / visit state | Initial navigation | reducer + source | PASS — P16_UI |
| `GLO-UX-025` | Module actif (`P9608-P9613`) | navigation / visit state | Initial navigation | reducer + source | PASS — P16_UI |
| `GLO-UX-026` | Cliquer sur un module (`P9614-P9621`) | navigation / visit state | Initial navigation | reducer + source | PASS — P16_UI |
| `GLO-UX-027` | URL (`P9622-P9626`) | navigation / visit state | Initial navigation | reducer + source | PASS — P16_UI |
| `GLO-UX-028` | Synthèse IA dans la navigation (`P9627-P9630`) | navigation / visit state | Initial navigation | reducer + source | PASS — P16_UI |
| `GLO-UX-029` | HIDDEN (`P9631-P9639`) | navigation / visit state | Initial navigation | reducer + source | PASS — P16_UI |
| `GLO-UX-030` | PLACEHOLDER (`P9640-P9645`) | navigation / visit state | Initial navigation | reducer + source | PASS — P16_UI |
| `GLO-UX-031` | Pas de faux loading (`P9646-P9652`) | navigation / visit state | Initial navigation | reducer + source | PASS — P16_UI |
| `GLO-UX-032` | Lazy loading — architecture exacte (`P9653-P9654`) | loader / VisitRuntime | snapshot ciblé | concurrence/cache/error tests | PASS — P16_UI |
| `GLO-UX-033` | hase 0 — immédiatement (`P9655-P9662`) | loader / VisitRuntime | snapshot ciblé | concurrence/cache/error tests | PASS — P16_UI |
| `GLO-UX-034` | Pas les dix modules simultanément (`P9663-P9667`) | loader / VisitRuntime | snapshot ciblé | concurrence/cache/error tests | PASS — P16_UI |
| `GLO-UX-035` | Préchargement par proximité (`P9668-P9674`) | loader / VisitRuntime | snapshot ciblé | concurrence/cache/error tests | PASS — P16_UI |
| `GLO-UX-036` | Concurrence (`P9675-P9678`) | loader / VisitRuntime | snapshot ciblé | concurrence/cache/error tests | PASS — P16_UI |
| `GLO-UX-037` | Navigation directe (`P9679-P9685`) | loader / VisitRuntime | snapshot ciblé | concurrence/cache/error tests | PASS — P16_UI |
| `GLO-UX-038` | Lazy loading des détails (`P9686-P9690`) | loader / VisitRuntime | snapshot ciblé | concurrence/cache/error tests | PASS — P16_UI |
| `GLO-UX-039` | Les graphiques lourds ne sont pas chargés (`P9691-P9701`) | loader / VisitRuntime | snapshot ciblé | concurrence/cache/error tests | PASS — P16_UI |
| `GLO-UX-040` | Au développement (`P9702-P9705`) | loader / VisitRuntime | snapshot ciblé | concurrence/cache/error tests | PASS — P16_UI |
| `GLO-UX-041` | Sous-sections secondaires (`P9706-P9710`) | loader / VisitRuntime | snapshot ciblé | concurrence/cache/error tests | PASS — P16_UI |
| `GLO-UX-042` | Les charts eux-mêmes (`P9711-P9714`) | loader / VisitRuntime | snapshot ciblé | concurrence/cache/error tests | PASS — P16_UI |
| `GLO-UX-043` | Cache (`P9715-P9719`) | loader / VisitRuntime | snapshot ciblé | concurrence/cache/error tests | PASS — P16_UI |
| `GLO-UX-044` | Cohérence des révisions (`P9720-P9725`) | loader / VisitRuntime | snapshot ciblé | concurrence/cache/error tests | PASS — P16_UI |
| `GLO-UX-045` | Erreur locale (`P9726-P9732`) | loader / VisitRuntime | snapshot ciblé | concurrence/cache/error tests | PASS — P16_UI |
| `GLO-UX-046` | Drill-down : deux types différents (`P9733-P9735`) | detail overlay / evidence | Expanded/detail | RuntimeSchemas + source | PASS — P16_UI |
| `GLO-UX-047` | ANALYTICAL_DETAIL (`P9736-P9748`) | detail overlay / evidence | Expanded/detail | RuntimeSchemas + source | PASS — P16_UI |
| `GLO-UX-048` | ENTITY_DETAIL (`P9749-P9758`) | detail overlay / evidence | Expanded/detail | RuntimeSchemas + source | PASS — P16_UI |
| `GLO-UX-049` | Desktop : Entity Preview (`P9759-P9761`) | detail overlay / evidence | Expanded/detail | RuntimeSchemas + source | PASS — P16_UI |
| `GLO-UX-050` | Puis fiche complète (`P9762-P9767`) | detail overlay / evidence | Expanded/detail | RuntimeSchemas + source | PASS — P16_UI |
| `GLO-UX-051` | Mobile (`P9768-P9774`) | detail overlay / evidence | Expanded/detail | RuntimeSchemas + source | PASS — P16_UI |
| `GLO-UX-052` | Retour (`P9775-P9779`) | detail overlay / evidence | Expanded/detail | RuntimeSchemas + source | PASS — P16_UI |
| `GLO-UX-053` | Evidence / méthode (`P9780-P9784`) | detail overlay / evidence | Expanded/detail | RuntimeSchemas + source | PASS — P16_UI |
| `GLO-UX-054` | Affichage normal (`P9785-P9787`) | detail overlay / evidence | Expanded/detail | RuntimeSchemas + source | PASS — P16_UI |
| `GLO-UX-055` | Support utile (`P9788-P9793`) | detail overlay / evidence | Expanded/detail | RuntimeSchemas + source | PASS — P16_UI |
| `GLO-UX-056` | Valeurs estimées (`P9794-P9799`) | detail overlay / evidence | Expanded/detail | RuntimeSchemas + source | PASS — P16_UI |
| `GLO-UX-057` | Graphiques (`P9800-P9805`) | summary / chart / module | Summary + Expanded | fixtures + source | PASS — P16_UI |
| `GLO-UX-058` | Module compact (`P9806-P9808`) | summary / chart / module | Summary + Expanded | fixtures + source | PASS — P16_UI |
| `GLO-UX-059` | Module développé (`P9809-P9812`) | summary / chart / module | Summary + Expanded | fixtures + source | PASS — P16_UI |
| `GLO-UX-060` | Tableaux (`P9813-P9817`) | summary / chart / module | Summary + Expanded | fixtures + source | PASS — P16_UI |
| `GLO-UX-061` | Aucun dashboard de 20 graphiques (`P9818-P9822`) | summary / chart / module | Summary + Expanded | fixtures + source | PASS — P16_UI |
| `GLO-UX-062` | Hiérarchie visuelle de la page (`P9823-P9825`) | summary / chart / module | Summary + Expanded | fixtures + source | PASS — P16_UI |
| `GLO-UX-063` | Synthèse IA (`P9826-P9835`) | summary / chart / module | Summary + Expanded | fixtures + source | PASS — P16_UI |
| `GLO-UX-064` | Après Synthèse IA (`P9836-P9843`) | summary / chart / module | Summary + Expanded | fixtures + source | PASS — P16_UI |
| `GLO-UX-065` | Quantité totale visible sans interaction (`P9844-P9846`) | summary / chart / module | Summary + Expanded | fixtures + source | PASS — P16_UI |
| `GLO-UX-066` | L’utilisateur veut davantage (`P9847-P9850`) | summary / chart / module | Summary + Expanded | fixtures + source | PASS — P16_UI |
| `GLO-UX-067` | Les modules peuvent ne rien avoir de spectaculaire (`P9851-P9859`) | summary / chart / module | Summary + Expanded | fixtures + source | PASS — P16_UI |
| `GLO-UX-069` | Mobile — structure générale (`P9864-P9868`) | responsive / accessibility | projection inchangée | CSS + source | PASS — P16_UI |
| `GLO-UX-070` | Navigation mobile (`P9869-P9872`) | responsive / accessibility | projection inchangée | CSS + source | PASS — P16_UI |
| `GLO-UX-071` | Mobile : métriques (`P9873-P9877`) | responsive / accessibility | projection inchangée | CSS + source | PASS — P16_UI |
| `GLO-UX-072` | Pas de scroll horizontal pour les données (`P9878-P9885`) | responsive / accessibility | projection inchangée | CSS + source | PASS — P16_UI |
| `GLO-UX-073` | Tables mobile (`P9886-P9890`) | responsive / accessibility | projection inchangée | CSS + source | PASS — P16_UI |
| `GLO-UX-074` | Charts mobile (`P9891-P9895`) | responsive / accessibility | projection inchangée | CSS + source | PASS — P16_UI |
| `GLO-UX-075` | Module développé mobile (`P9896-P9901`) | responsive / accessibility | projection inchangée | CSS + source | PASS — P16_UI |
| `GLO-UX-076` | Lorsqu'on change via la barre sticky (`P9902-P9909`) | responsive / accessibility | projection inchangée | CSS + source | PASS — P16_UI |
| `GLO-UX-077` | Accessibilité (`P9910-P9918`) | responsive / accessibility | projection inchangée | CSS + source | PASS — P16_UI |
| `GLO-UX-078` | Animations (`P9919-P9924`) | responsive / accessibility | projection inchangée | CSS + source | PASS — P16_UI |
| `GLO-UX-079` | Performance UX (`P9925-P9930`) | responsive / accessibility | projection inchangée | CSS + source | PASS — P16_UI |
| `GLO-UX-080` | Ordre de priorité réseau (`P9931-P9933`) | responsive / accessibility | projection inchangée | CSS + source | PASS — P16_UI |
| `GLO-UX-081` | Pas de spinner global (`P9934-P9936`) | responsive / accessibility | projection inchangée | CSS + source | PASS — P16_UI |
| `GLO-UX-082` | Skeletons (`P9937-P9942`) | responsive / accessibility | projection inchangée | CSS + source | PASS — P16_UI |
| `GLO-UX-084` | Résumé Global importé (`P9950-P9955`) | responsive / accessibility | projection inchangée | CSS + source | PASS — P16_UI |
| `GLO-UX-085` | Résumé STALE (`P9956-P9959`) | responsive / accessibility | projection inchangée | CSS + source | PASS — P16_UI |
| `GLO-UX-086` | Modules conditionnels (`P9960-P9964`) | responsive / accessibility | projection inchangée | CSS + source | PASS — P16_UI |
| `GLO-UX-087` | Pas de sections vides pour symétrie (`P9965-P9970`) | responsive / accessibility | projection inchangée | CSS + source | PASS — P16_UI |
| `GLO-UX-088` | Desktop Persona (`P9971-P9974`) | responsive / accessibility | projection inchangée | CSS + source | PASS — P16_UI |
| `GLO-UX-089` | Mobile Persona (`P9975-P9981`) | responsive / accessibility | projection inchangée | CSS + source | PASS — P16_UI |
| `GLO-UX-090` | Nous deux (`P9982-P9991`) | responsive / accessibility | projection inchangée | CSS + source | PASS — P16_UI |
| `GLO-UX-091` | Retour au sommet (`P9992-P9996`) | responsive / accessibility | projection inchangée | CSS + source | PASS — P16_UI |
| `GLO-UX-092` | Recherche dans Global (`P9997-P10002`) | Policy V1 explicite | aucun RM requis | absence vérifiée | PASS — EXCLUDED_V1 |
| `GLO-UX-093` | Favoris / épinglage (`P10003-P10006`) | Policy V1 explicite | aucun RM requis | absence vérifiée | PASS — EXCLUDED_V1 |
| `GLO-UX-094` | Réorganisation manuelle des modules (`P10007-P10013`) | Policy V1 explicite | aucun RM requis | absence vérifiée | PASS — EXCLUDED_V1 |
| `GLO-UX-095` | Aucun tri par « score d’importance Global » (`P10014-P10021`) | Policy V1 explicite | aucun RM requis | absence vérifiée | PASS — EXCLUDED_V1 |
| `GLO-UX-099` | Contrat expanded séparé (`P10038-P10041`) | contracts / instrumentation | P14/P15 RMs | gate P16 | PASS — P16_UI |
| `GLO-UX-100` | Instrumentation UX (`P10042-P10048`) | contracts / instrumentation | P14/P15 RMs | gate P16 | PASS — P16_UI |
| `GLO-UX-101` | Aucun apprentissage automatique de l’ordre (`P10049-P10053`) | contracts / instrumentation | P14/P15 RMs | gate P16 | PASS — P16_UI |
| `GLO-UX-102` | rchitecture finale (`P10054-P10058`) | contracts / instrumentation | P14/P15 RMs | gate P16 | PASS — P16_UI |
| `GLO-UX-103` | ynthèse normative (`P10059-P10065`) | contracts / instrumentation | P14/P15 RMs | gate P16 | PASS — P16_UI |

## Gates

`GLOBAL_PHASE_H5_LOCAL = PASS`

`IMPLEMENTATION_GATE = PASS`

`CONTRACT_GATE = PASS`

`TEST_GATE = PASS`

`CLIENT_LIVE_SMOKE = PENDING`

`LIVE_GATE = NOT_RUN`

`LIVE_WRITES = NONE`

`NEXT_PERMITTED_PROMPT = P17`
