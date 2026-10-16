# PRE-L4 C3 — Réception intégrée finale

16 octobre2026. Desktop uniquement. Réception locale synthétique; aucune fusion ni livraison Production.

## 1. Base et périmètre

Départ propre `0fc3d0882a649bf023b80edc83724aec43644d30`, descendant C1 produit `e49fe038`, HEAD documentaire `fb71ae2`, puis C2 produit `8978ac18`. Main relu `5cfb1211d114ddaa574f63372cdb9c4cfc7e660d`. PR#50 et#51 ouvertes, non fusionnées. Branche C3 `codex/composer-v3-pre-l4-c3-final-gate`, issue de C2.

**Aucun changement produit C3 nécessaire à ce stade.** Uniquement réception, contrats L4 et ajout dans le host synthétique d’une panne de sauvegarde unique avant commit (`draftFailOnce=1`) pour exercer le vrai bouton de reprise. Aucun remplacement de writer ou de service financier. C1/C2 conservent toutes leurs modifications; `src`, `supabase`, `public`, dépendances et configuration restent identiques au départ.

## 2. Réception des quatre défauts

| Défaut | Verdict | Preuves |
|---|---|---|
| D01 RAW / Apply | PASS | Courses250 SAVED/FRESH → texte300, Apply interdit et notice, même digest; Escape conserve250; Enter confirme300, PENDING/DIRTY puis SAVED/FRESH. Reload retrouve300. Aucun Apply navigateur. |
| D04 admission | PASS | `check-pre-l4-c1.log`: mêmes bornes sur MUTATE/Draft entier/READ/Preview/Apply synthétique;9999, refus10000/fraction/prix interdit/scope; zero, floors/Savings/Renewal. Ancienne PlanRevision10000 lisible avec preuve propriétaire, nouveau Draft10000 refusé. Erreur pré-writer distincte d’une tentative UNCONFIRMED. |
| D02 décision/référence | PASS | C2 douze cas SSR/services rejoués; parcours C3 Café13 avec prix2,10 choisi, prix historique antérieur distinct; Vêtements0 choisi; Coiffeur prix inconnu; inspecteur fidèle et coût Compiler. Savings protégée dans les suites propriétaires. |
| D03 géométrie/actions | PASS limité aux cas mesurés | Sources CSS/TSX identiques à C2, rectangles et captures C2 trois tailles réutilisés explicitement. Groupe Food C3 à1440:124,40px pour texte inconnu et cellule, focus solide, sans recouvrement. Board dense et panneaux: complément C3 dans geometry.json. Aucun changement packing. |

Les preuves C2 réutilisées restent celles de8978ac1, pas de nouvelles exécutions C3: `evidence/pre-l4-c2/geometry-after.json`, captures trois tailles, erreur Board et Beauté. Les assertions originales C8 sont, elles, rejouées en C3.

## 3. Parcours intégré

Fixture HTTP/PGlite isolée, vrais composants React minifiés de production du bundle C2, vrais Compiler/Finance V2. Le serveur refuse les appels réseau distants. Le transport durable de fixture simule le stockage CAS; **il ne prouve ni Auth ni RLS Supabase.**

| Étapes demandées | Réception |
|---|---|
|1–8 Courses, garde RAW, confirmation, Preview, SAVED, reload | PASS; digest du250 `7bb4fea9…`, du300 `8847c43c…`, identités et montant conservés |
|9–11 Café fréquence/prix, Undo/Redo, Vêtements0 | PASS; count13/prix2,10 distincts, Undo retrouve le prix de référence, Redo le prix choisi; absence de décision distincte du zéro explicite |
|12–13 Sacs-poubelle4 et enveloppe | PASS; choix explicite Petits achats maison, binding confirmé, même occurrence; aucun rapprochement textuel avec Courses |
|14–17 charges fixes, page, groupe, inspecteur | PASS local; détachement visuel, Food5 objets, inspecteur prix choisi/référence/inconnu et zéro; parcours dense complémentaire |
|18 erreur sauvegarde/reprise | PASS; une503 avant commit → ERROR sans faux SAVED; bouton Réessayer → SAVED, même décision/digest |
|19 erreur Preview/reprise | PASS;503seq2 → FAILED et Apply interdit; sauvegarde réussie laisse FAILED, puis Réessayer simulation → FRESH sans nouveau changement de décision |
|20 gestes visuels | PASS; journaux requests et événements Draft strictement identiques avant/après détachement/groupe/inspecteur/palette,0requête supplémentaire |

`browser-checks.json`, `browser-server-state.json`, `visual-before.json`, `visual-after.json`, `geometry.json` et captures sont dans `evidence/pre-l4-final`. Ce sont des observations intégrées, pas20nouveaux tests permanents. Les appels de sauvegarde et Preview sont séparés. Aucun délai de l’outil n’est une mesure produit.

## 4. Gate technique rejoué

[Seize commandes avec heures et codes de sortie](evidence/pre-l4-final/regressions.json), toutes exit0:

| Suite | Résultat réel C3 |
|---|---|
| C1 / C2 | PASS6groupes /12cas SSR et services |
| L3.3 | PASS11groupes, count-only/unitAmount et Apply/Reload PGlite |
| Kernel / Simple Levers / Renewal | PASS40 /30 /32 |
| Savings allocations | PASS21, modes/protections/scopes; fixtures |
| B3 Plan-aware | PASS27, commit/relecture et absence de retry aveugle |
| Draft HTTP | PASS5, service simulé uniquement |
| P13 | PASS8, CAS/idempotence/relecture isolés |
| Scheduler | PASS5, hors ordre/digest/World |
| Restaurant L1 | PASS25, références étrangères/protection/round-trip |
| L3.1 / R6 | PASS8 / groupes et identités; pas un test natif de drag |
| C8 complet serveur | PASS35 dont C8-017; ne certifie pas le navigateur à lui seul |
| Parité | PASS22×9=198 empreintes, golden inchangé |
| TypeScript | PASS exit0, `node node_modules/typescript/bin/tsc --noEmit --incremental false` |
| Next complet | En cours de vérification du build Preview C3; le build complet C2 reste une preuve historique valide de la même source produit |

Les anciens fichiers de preuve sont restaurés par le wrapper après les suites; leurs PASS ne sont pas présentés comme des relectures JWT. Aucune régénération de golden ni modification d’assertion économique.

## 5. Réserves natives et authentifiées

**C1-03 = NOT_RUN_AUTH.** Les seuls comptes F0 connus sont désactivés, le compte navigateur connu est personnel. Aucun compte isolé actif admissible identifié dans le contexte/configuration disponible. Pas de réactivation, création, lecture de secrets ou modification RLS; pas de Draft personnel écrit. Le cycle count13/prix2,10 → reload → count14 seul → Undo/Redo → archive/CAS doit encore être exécuté avec un compte isolé explicitement admissible. Les résultats PGlite/HTTP simulés ne le remplacent pas.

**NOT_RUN_NATIVE pour confirm/beforeunload et drag maintenu.** Le navigateur intégré disponible fournit les actions DOM mais pas les gestes natifs requis. Aucun Chrome contrôlable via cette connexion. La revue automatique a refusé la lecture d’une fenêtre Chrome privée sans rapport avec Composer; elle n’a pas été lue. La tentative officielle de créer une fenêtre dédiée sans en lire le contenu a expiré à l’approbation. Aucune répétition ni contournement. Les stubs C1 restent explicitement des stubs, pas des dialogues natifs certifiés.

Protocole manuel court, sur la fixture uniquement, sans `a0Confirm` ni événements injectés:

1. Food→count Manon, taper5, fermer le groupe, **Annuler** la confirmation native: groupe et texte présents, digest inchangé, Apply interdit. Refaire et **Accepter**: fermeture, ancienne décision intacte, aucune adoption du texte.
2. Taper300 sans confirmer Courses, Ctrl+R, refuser le dialogue natif: texte présent, ancien digest/SAVED conservés, Apply interdit. Escape: retour à la valeur admise.
3. Pendant RAW, déplacer réellement la carte au pointeur maintenu: aucune validation implicite ni perte de texte/décision. Puis drag d’un enfant du groupe compact: identité conservée et rattachement seulement si la destination est admise; visuel seul ne change pas le digest.
4. Activer rapidement+/−, puis page/sélection/groupe avant350ms: un seul lot admis, Apply bloqué tant que PENDING, pas de double commit. Undo/Redo restaure exactement les états admis. Pendant RAW, changer page et sélection puis revenir: texte conservé ou abandon explicitement confirmé, jamais promu silencieusement.

Noter le résultat de chaque geste et le navigateur/version avant de lever cette réserve. Un protocole n’est pas un PASS.

## 6. Registre et préparation L4

[AV-01…128 final](evidence/pre-l4-final/AV_01_128_FINAL_COVERAGE.md): mêmes identifiants, texte original et empreinte source.128pistes classées, **pas128tests exécutés**.37déjà correctes avec preuve,4corrigées C1,6corrigées C2,59avec limite,9non exécutées,13différées volontairement. Aucun défaut nouveau C3 confirmé; aucune amélioration facultative transformée en blocage.

[Contrats et oracles L4](L4_COMPOSER_CONTRACTS_AND_SCENARIO_ORACLES.md): cinq templates/presets actuels comparés à A0, champs et slots exacts, owners, questions conditionnelles, identités/réédition, non-additivité, UNKNOWN et limites. Jacuzzi inclus, payeur nommé, livraison e-commerce et contribution commune ne deviennent pas des champs fictifs. Les oracles chiffrés sont des attentes des futurs parcours, pas des tests L4 exécutés.

Contrôle léger des ressources: journaux visuels identiques, DOM/images observés avec panneaux/groupes, pas de campagne P95 ni certification des2s/P14. Incident Canonical57014 et maintenance SNAP-3 restent séparés, sans nouvelle requête ou publication distante C3.

## 7. Décision, livraison et rollback

Recommandation provisoire: **GO_WITH_LIMITATIONS pour commencer le développement L4**, sous réserve du build final. Aucun défaut critique reproductible de décision/admission/finance/compatibilité dans le périmètre exécuté. Les réserves natives et JWT diminuent la confiance dans les transitions desktop et la persistance réelle; elles doivent être revues/fermées avant une livraison réelle des futurs éditeurs. Ce verdict n’autorise pas la Production.

Ordre de revue/intégration: #50 C1 → #51 C2 → PR C3 empilée sur C2. Les branches doivent être retargetées après chaque intégration, sans perdre les commits ancêtres. Aucune fusion automatique.

Rollback C3: revenir au HEAD C2; seuls docs/tests/host synthétique sont retirés, aucun SQL ni donnée à restaurer. Pour rollback C2, revenir à C1 avec réserve D02/D03 réouverte. Ne pas réactiver une ancienne UI susceptible de réécrire les overrides récents; conserver le JSON et C1 d’admission. Aucun DELETE d’archive/Plan/Draft nécessaire.

Statut final, SHA, PR et build: à compléter à la clôture. **Aucune Production modifiée; aucun L4 développé.**
