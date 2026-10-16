# L3.3 — Finalisation fonctionnelle de l’atelier Composer

Date : 16 octobre 2026. Périmètre : L3.3 uniquement, application desktop.

## A. Base et traçabilité

- Main et Production redécouverts au démarrage : `b777374fe8399e7abf22967c98caef2013876507` (PR #48).
- Worktree initial propre ; commit documentaire local L3.2 `b377c38554bdc25db980f8d02ad7c10b0e5972ad` conservé.
- Branche : `codex/composer-v3-l3-3-finalize-workshop` ; [PR #49](https://github.com/adriensauvageot34/Budgetisation/pull/49).
- Contrat serveur : `ebdae14` ; atelier : `1f535ab` ; régressions/golden : `053d741` ; garde d’annulation : `ee3ecee193054353013c39bf4cfe8e700e76c645`.
- Preview `dpl_FCsdT1TXWhoXUWGQbvVpzwa8RHLu`, commit `053d74113de53bb01b4ea23a2b93e30892f652f0`, READY, Next 16.2.6, région inchangée `iad1`.
- Une dernière correction UI préserve aussi l’annulation de fermeture lorsqu’une autre action demande de quitter un groupe avec une saisie non validée. Sa livraison est tracée dans la section H.

Défauts confirmés par code : capacité Café absente du Board malgré SET_COUNT chez l’owner ; confusion indisponible/protégé ; prix mensuel non admis hors gates existantes ; SET_STATE complet pouvant perdre le prix ; saisie permanente séparée ; enveloppes optionnelles présentées comme un zéro décidé ; parcours achat trop générique. Reproductions navigateur : avant L3.2 en lecture seule, puis fixture L3.3. Les montants personnels ne sont pas utilisés comme preuve d’admissibilité.

## B. Capabilities et propriétaires

La [matrice JSON](evidence/l3-3-composer-workshop/capability-matrix.json) donne 20 contrôles synthétiques : identité exacte, type, valeur, source, capacité avant/après, éditeur et restrictions. Les décisions concernent exclusivement le mois cible.

| Famille | Avant | Après / admission et limites | Qualification |
|---|---|---|---|
| Courses | SET_SLOT_AMOUNT ; historique séparé | Montant direct ; floor Canonical réellement publié conservé | CONFIRMED_CODE |
| Café travail Adrien | SET_COUNT Baseline, aucune AdjustmentCapability | Count entier 0..9999 ; prix mensuel explicite ; count=0 donne zéro officiel même si prix UNKNOWN | CONFIRMED_CODE + REPRODUCED_BROWSER |
| Repas travail Adrien/Manon | Capability simple ; prix surtout sous gate manquante | Count et prix séparés via contrat d’habitude FOOD ; manque de fréquence reste inconnu ; aucune fréquence inventée | CONFIRMED_CODE |
| Coiffeur, assertion d’habitude | SET_COUNT propriétaire, capability UI manquante | Count et prix mensuel ; prix UNKNOWN affiché comme tel ; variante Renewal garde ses propres protections | CONFIRMED_CODE + REPRODUCED_BROWSER |
| Tabac/vape | Montant simple | Montant direct, zéro seulement au-dessus du floor réel ; historique intact | INTENDED_CONSTRAINT |
| Mascara/Sourcils/Cire/Eyeliner | Renewal conditional ou structurel | Confirmation conditionnelle 0/1 ; prix éditable uniquement si la gate Renewal existante l’admet ; structural/conditional=false reste verrouillé | INTENDED_CONSTRAINT |
| Vêtements/Maison/Jeux | Baseline optionnelle `0.00`, aucune réservation automatique | « À définir » sans décision explicite ; un zéro choisi reste un vrai zéro ; rattachement d’un achat ne fabrique pas une décision d’enveloppe | CONFIRMED_CODE |
| Restaurants/Fast-food/Livraison | Occurrences simples | Count direct ; prix connu en lecture seule si aucun override n’est admis ; « Enveloppe Restaurants » distingue la sortie | INTENDED_CONSTRAINT |
| Épargne ajustable | SET_SAVINGS_ALLOCATION | Montant direct ; réservation distincte d’un mouvement bancaire | INTENDED_CONSTRAINT |
| Épargne protégée | Actions absentes, contrainte Kernel | Champs PROTECTED_BY_RULE, aucune édition ; refus serveur conservé | INTENDED_CONSTRAINT |
| Obligations structurelles | Faits présents, pas de carte | Lecture seule depuis structuralFacts ; jamais de nouveau PlanSlot ni total local | READ_ONLY_EXTERNAL_OWNER |
| Mobility historique / besoin sans capacité | Pas de mutation publiée | Consultation, « Édition non publiée par la source », sans faux verrou métier | BLOCKED_MISSING_OWNER |

Les statuts par dimension étendent `AdjustmentCapability` de façon additive. La validation partagée local/serveur refuse champs non publiés, prix négatif, précision >2 décimales, fractions d’occurrences, borne/floor, mauvais scope et protection. Le Compiler vérifie indépendamment l’admission du prix, les coûts, le mapping et les contraintes. Les anciens contrôles count-only et anciennes PlanRevisions restent lisibles.

La Baseline, ses faits, ses capacités historiques et son digest sont inchangés. Une première variante qui modifiait les capacités Baseline a été retirée après échec de parité. **Aucune de ses empreintes n’est utilisée comme golden final.**

## C. Réalisation A–F

### A/B — Contrat et manipulation

- Un seul éditeur à l’emplacement du montant/count/prix. Entrée valide ; Échap annule ; Tab/blur gardent la saisie locale sans commit surprise. Les pages contenant une saisie sont retenues par le mécanisme existant.
- Virgule, point et séparateurs de milliers normalisés vers le format canonique. Une erreur reste proche du champ, jamais convertie en zéro.
- +/− uniquement pour un champ admis ; pas publiés par le serveur : count 1, prix café 0,10 €, autres prix admissibles 0,50 €, montants 5 €. Bornes et floors appliqués.
- Rafale regroupée après 350 ms d’inactivité ou au départ du champ. Une vraie double activation a donné 14→16, Undo→14, Redo→16. Trois clics espacés par l’outillage ne sont pas assimilés à une seule rafale.
- SET_STATE transmet la décision complète et conserve le prix **explicitement choisi**. Changer count ne transforme pas un prix historique en nouveau choix. Undo restaure aussi le prix de référence si l’override disparaît.
- Le coût affiché provient du Compiler, jamais de count×prix dans React. Il est masqué pendant le réglage/Preview ; le coût restant après consommation est libellé comme tel.

### C — Mois préinformé

- Draft puis Plan actif du même mois : mécanismes de reprise existants préservés.
- Les références déjà publiées par Baseline/CardKnowledge restent des références. Aucun nouveau lecteur, médiane, cache ou propriétaire de préférence.
- « Reprendre mon mois habituel » dans Options : liste préalable avec owner, période et couverture ; sélection explicite ; OFFER_PREFILL uniquement ; une seule étape Undo ; aucun écrasement d’une décision existante ni d’épargne ; aucun Apply.
- Le bouton discret n’impose aucune invitation répétée. Le refus ferme la proposition ; aucune préférence durable cross-device fictive.
- Dernière décision d’un autre mois et préférence réutilisable : non créées faute de lecteur/owner déjà admissible dans ce chemin. Les repères disponibles restent utiles.
- Portée explicite : budget du mois entier, distinct du reste réel à dépenser ; aucun calcul Plan→Réel.

### D — Charges fixes

- Projection read-only des obligations existantes : factKey, montant/UNKNOWN, échéance, source et provenance.
- Aucun total de charges ajouté : nombres de valeurs connues/inconnues uniquement, sans rapprochement financier improvisé.
- Détachement/rattachement par factKey. Une charge est dans le groupe OU seule. Préférence locale au navigateur/mois, contenant seulement les identités de présentation.
- Aucun changement de Draft, coût, PlanRevision ou Preview. Le parcours navigateur a conservé le même digest ; ses compteurs finaux sont conservés.

### E — Petits achats

- Les presets purchase simples ouvrent le budget puis l’enveloppe admissible. Article/vendeur, date, lieu et trajet restent accessibles, facultatifs et secondaires.
- Produit et defaults L3.2 conservés. Un seul composant de coût ; pas de coût parent, trajet implicite ou nouvelle enveloppe.
- Rattachement existant validé par le Compiler ; quantité/unité, identité, financement et binding conservés en réédition.
- Achats complexes et moteur général de questions restent L4.

### F — Lisibilité

- Pagination absente sur une page et rétablie au besoin, avec focus/navigation préservés.
- À piloter groupé en habitudes/enveloppes/réservations/autres références ; valeur et vrai motif d’accès, révélation de la carte existante.
- Groupes renommés naturellement ; modale compacte. **Deux variantes React réelles ont été comparées sur fixture**, pas une maquette : la variante intégrée consomme 556 px et réduit le plateau à 137 px à 1440×900, avec recomposition en quatre pages. La modale compacte de 876×580 n’occupe pas le plateau ; elle est retenue. Le prototype intégré reste exclusivement dans le script de fixture.
- Détails de provenance dans l’inspecteur, résumé court sur les cartes. Le HUD distingue actualisation et informations incomplètes. `unresolvedRefs` ne détermine pas l’admission Apply.
- Barre d’épargne : réservation par rapport au repère initial, jamais objectif atteint.
- Sept presets restent visibles lorsqu’il n’en manquerait qu’un après les six premiers ; intentions libres secondaires. 47 presets, 13 génériques et 114 options inchangés, illustrations byte-identiques.

## D. Parcours et preuves

Dossier : [preuves L3.3](evidence/l3-3-composer-workshop/).

- `contract-tests.log/json` : véritables services Compiler/Finance et PGlite synthétique, aucune authentification réelle revendiquée.
- `browser-fixture-draft.json` : décision Café conservée à 16 occurrences / 2,10 €, identité de contrôle stable, petit achat et enveloppes conservés après reload.
- `browser-fixture-evidence.json` : 0 Plan, 0 PlanRevision, 0 RPC Apply, 0 écriture distante, 0 mutation des canaris historiques.
- `desktop-checks.json` : largeurs **effectivement mesurées** 1440, 1728, 1920 ; aucun débordement horizontal global ni débordement de carte dans les cellules vérifiées.
- Captures finales : `board-final-1440-native.jpg`, `board-final-1728.jpg`, `board-final-1920.jpg`, `cluster-compact-final-1440.jpg`, `cluster-board-expansion-trial.jpg`.
- Autres preuves : Café zéro/prix/erreur, édition Vêtements, proposition de reprise, charges ouvertes/détachées/rattachées, achat et À préciser.
- Les premières captures `.png` contiennent des octets JPEG, parfois limités par le panneau IAB : ce sont des preuves intermédiaires, **pas une certification de capture intégrale**. Les captures finales utilisent une capture complète quand disponible, ou la capture native 1440×900 ; les métadonnées d’image sont conservées.
- Protection de fermeture : une saisie brute « 5 » a été observée avec `data-inline-dirty=true` dans le groupe, sans changement du Draft. Le navigateur automatisé n’a pas exposé de confirmation native exploitable et la fermeture a continué ; le scénario « refuser la confirmation » reste **NOT_RUN** au navigateur. Le retour booléen du garde arrête désormais aussi les actions Détails/Éditer lorsque la fermeture est refusée ; TypeScript et build contrôlent cette correction ciblée. Aucun PASS navigateur n’est revendiqué pour ce refus.

## E/F. Tests d’acceptation

`EXECUTED_PASS` signifie uniquement le périmètre indiqué. Aucun Apply/Reload de finances personnelles.

| Test | Verdict | Preuve / limite |
|---|---|---|
| T01 | EXECUTED_PASS | Zéro connu/UNKNOWN via vrais Compiler et services, PGlite ; zéro et sauvegarde navigateur fixture |
| T02 | EXECUTED_PASS | 12×1,80=21,60 puis 12×2,10=25,20 officiels |
| T03 | EXECUTED_PASS | Prix puis count, identités, sérialisation, Apply/Reload synthétique ; Undo/Redo et reload navigateur |
| T04 | EXECUTED_PASS | Coiffeur 1, prix UNKNOWN ; matrice par champ et rendu navigateur |
| T05 | EXECUTED_PASS | Épargne protégée, source externe, floor réel : refus serveur ; aucune édition financière réelle |
| T06 | EXECUTED_PASS | Ancienne décision count seul, parité et relecture P13/C8 |
| T07 | EXECUTED_PASS | Normalisation française ; Enter/Escape/Tab/erreur ; Vêtements testé au navigateur, contrôles partagés Courses/Maison |
| T08 | EXECUTED_PASS | Vraie double activation groupée, Undo/Redo ; absence de transport au hover par code ; pas de campagne dédiée de survol matériel |
| T09 | EXECUTED_PASS | À piloter révèle la même identité, aucun ajout économique |
| T10 | EXECUTED_PASS / NOT_RUN | Page suivante/retour : saisie 99,90 gardée, même digest ; drag natif pendant une saisie NOT_RUN |
| T11 | EXECUTED_PASS | Références sans adoption/mutation et nouveau Draft vide |
| T12 | EXECUTED_PASS | OFFER_PREFILL strict, REFERENCE_ONLY jamais adopté |
| T13 | EXECUTED_PASS | Proposition sélective Courses au navigateur, Café/Vêtements préservés ; mutations groupées, round-trip |
| T14 | NOT_RUN | Pas de campagne authentifiée mois courant/futur ; portée du mois et refus d’une réconciliation réelle conservés par contrats/tests existants |
| T15 | EXECUTED_PASS | Charge connue au navigateur ; charge UNKNOWN + échéance/source en rendu réel synthétique |
| T16 | EXECUTED_PASS | Même factKey, représentation exclusive et même digest au navigateur |
| T17 | EXECUTED_PASS | Sacs-poubelle 4 € sans date/lieu/trajet, bibliothèque immédiate ; Éponges couvert par mêmes contrats et L3.2 |
| T18 | EXECUTED_PASS | Consommation/extra, un seul coût, réédition sans perte de binding, services réels sur fixture |
| T19 | EXECUTED_PASS / NOT_RUN | Ouverture/clavier/enfants/absence de somme ; palette existante et régressions ; campagne native drag du groupe NOT_RUN |
| T20 | EXECUTED_PASS | SSR 1/plusieurs pages et navigateur 1/2 pages selon résolution |
| T21 | EXECUTED_PASS | Précision ≠ blocage ; readiness et guards C8/P13 ; aucune règle de bloqueurs depuis unresolvedRefs |
| T22 | EXECUTED_PASS | Sémantique de jauge et montants C8/parité inchangés |
| T23 | EXECUTED_PASS | 47/13/114, anciennes clés/favoris, hashes des 47 illustrations ; pas de nouvelle image |
| T24 | EXECUTED_PASS | 15 suites ciblées, dont L2B restant, L3/L3.1/L3.2, Kernel, Draft HTTP, scheduler, 22×9, P13/C8 et conservation |
| T25 | EXECUTED_PASS limité fixture | Dimensions réelles et géométrie des trois desktops ; principales interactions 1440, groupe 1728/1920 ; pas une certification E2E authentifiée de chaque geste aux trois tailles |
| T26 | EXECUTED_PASS compteurs / NOT_RUN latence certifiée | DOM/images/ressources et gestes bornés ; double-rAF anormalement ralenti dans IAB, même affiché : non exploitable comme latence produit |

Régressions détaillées : [regressions.json](evidence/l3-3-composer-workshop/regressions.json), journaux associés. L2B est exécuté en mode REMAINING_ONLY : ses six contrôles restants sont rejoués ; les 26 boucles historiques gardent leurs preuves antérieures, les 21 nouveaux presets sont rejoués par L3.2. Aucune nouvelle certification des 26 anciens parcours n’est inventée.

Golden : **22 empreintes capabilities seules** changent, pour la publication de champs/actions. Les 176 autres empreintes (8×22) sont strictement identiques. Avant/après exact dans `golden-capability-delta.json`. Le golden Séjour court financier n’est pas retouché. Les gardes de périmètre purement visuel L3/L3.1 sont bornés à leur livraison historique ; le nouveau garde L3.3 impose une allowlist exacte des chemins serveur/domaine, sans autoriser Compiler, adapter financier, SNAP-3, DB, Draft HTTP ou scheduler. Le garde de densité tient compte des cartes à deux dimensions ; géométrie, couverture sans doublon et nombre de pages restent contrôlés.

## G. Performance et build

- Pas de nouvelle lecture World, statistique, RPC, cache, snapshot ou publication pour les nouvelles surfaces. Charges, références et groupes utilisent le modèle déjà admis.
- Une session locale après reload : 2019 nœuds DOM, 7 images, 2 ressources métier initiales (GET Draft et READ de simulation) ; les ouvertures/annulations d’édition n’ajoutent aucune ressource métier dans cette sonde.
- Les échantillons double-rAF de l’IAB sont gardés dans `perf-background-excluded.json` et `perf-visible-limited.json`. Ils restent proches de deux secondes malgré la commande d’affichage : **ils ne sont pas attribués à React ni certifiés comme latence de l’application**. Pas de P95 Production, pas de gain utilisateur chiffré, pas de cible 100 ms revendiquée. Pas de comparaison à L3.2 sur des mois/workloads différents.
- TypeScript local : exit 0. Build fixture React production : PASS.
- Tentative Next locale `node node_modules/next/dist/bin/next build --webpack` : exit 1, `node:crypto` dans la chaîne History V2 / Exploration existante, hors des fichiers L3.3. Pas de correction hors périmètre.
- **Build Next complet Vercel du commit 053d741 : PASS**, compilation, TypeScript, collecte, génération et déploiement terminés ; journal intégral `build-vercel-preview.log`. Ce résultat ne transforme pas le build webpack local en PASS et ne certifie pas une installation fraîche des dépendances (cache Vercel réutilisé).

## H. Livraison et rollback

PR #49 ouverte ; merge et Production à compléter après les derniers contrôles. Configuration Vercel/Supabase inchangée. SNAP-3, Compiler, Finance V2, Apply autoritaire, CAS et idempotence préservés. Aucune migration.

Rollback : revert de présentation en conservant l’admission serveur des décisions L3.3 déjà enregistrées, par le workflow normal. Aucune restauration de base ni suppression de Draft/Plan. Un retour intégral à L3.2 exige de vérifier la compatibilité des nouveaux overrides unitAmount avant toute réédition ; ne pas réécrire ni éliminer ces décisions pour faciliter un rollback. Conserver les JSON et utiliser un lecteur compatible.

## I. Limites et suite

- E2E authentifiés d’écriture et Apply réel : NOT_RUN, conformément au périmètre read-only.
- Latence P95 réelle, second appareil, drag natif pendant saisie : non certifiés.
- Prix Canonical/history, préférences cross-device et dernier mois réutilisable sans owner : aucun nouveau système inventé.
- L4/L5/L6/L7/L8 : aucun développement. Aucune nouvelle architecture, migration ou vague d’illustrations.

## J. Verdict

`L3_3_IMPLEMENTED_NOT_RELEASED` à ce point de préparation. Verdict et SHA de Production remplacés après le workflow de livraison autorisé ; les limites ci-dessus restent explicites.
