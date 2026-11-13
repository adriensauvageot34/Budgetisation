# PR #123 — Corrections finales ciblées

Mission du 13 novembre 2026, limitée aux deux échecs de `P21_PR123_VALIDATION.md`.

## Références et périmètre

- Dépôt : `adriensauvageot34/Budgetisation`, PR https://github.com/adriensauvageot34/Budgetisation/pull/123 (OPEN / Draft).
- Branche : `codex/p21-mega-run-composer-v22`.
- SHA de départ local et GitHub confirmé : `23818b394e237a6130a52c46caa5b17e18367498`.
- Deux fichiers Cadeau conservés hors des corrections : `catalog-context-editor.tsx` et `check-composer-project-completion.mjs`. Patch initial enregistré localement pour comparaison finale.
- Aucun nouveau chantier, changement Finance V2/Compiler/SQL/Auth/RLS, donnée réelle, Apply, fusion, Production ou reconstruction Vercel forcée. Aucun test distant avec écriture.

## Défauts et résultats

| Défaut | Correction prévue | État |
| --- | --- | --- |
| Entrée avec plusieurs Mascara existants donne le focus au modèle Shopping | Priorité aux occurrences existantes visibles pour Entrée ; ordre DOM et navigation par flèches conservés | PASS A2 et navigateur local |
| Fixture Mobility transmet `catalogChoice.kind = 'slot'` | Variante publiée `socket` dans le seul banc ; aucun changement de propriétaire | PASS — trois groupes |

## Contrôles nouvellement prévus

| Contrôle | État |
| --- | --- |
| Bibliothèque A2 complète, dont A2-03 et scénarios suivants | PASS — douze groupes, exit 0 |
| Mobility : champs/RAW, trajet obsolète, train et frais propres/partagés | PASS — trois groupes, exit 0 |
| TypeScript | PASS — exit 0 |
| `git diff --check` | PASS |
| Navigateur local C8 : deux Mascara, focus sur la première occurrence, choix exact du second, digest inchangé en consultation | PASS — Chrome 1280 × 720, cinq vérifications ciblées |
| Non-régression ciblée des modes bibliothèque, filtres, IME et clavier si nécessaire | PASS — cinq groupes navigation, exit 0 |
| Préservation finale Cadeau | PASS — patch initial/final strictement identique, hors commit |

Les PASS antérieurs restent attachés au SHA de leur exécution. Les 21 parcours navigateur et les seize modèles ne seront pas rejoués sans nécessité liée à cette correction.

## Détails et preuves

### Focus — correction locale

`focusActions(preferExisting)` ne choisit que parmi les actions activées et visibles. Pour Entrée, la première occurrence existante visible précède les actions de modèle et d'ajout. Le comportement de repli reste celui de l'ordre DOM ; ArrowDown conserve son comportement antérieur. Ouverture d'une occurrence unique, ajout explicite, filtres, consultation, IME et état occupé utilisent leurs gardes existantes inchangées.

Le banc A2 est renforcé sur le seul cas A2-03 : présence du modèle Shopping concurrent, première occurrence visible, première occurrence masquée puis focus sur la seconde, choix exact de la seconde et digest inchangé. Le faux nœud DOM implémente `hasAttribute`, employé par la priorité de focus. Aucun test ne choisit automatiquement un homonyme.

`node scripts/check-composer-v22-a2-library.mjs` : PASS, douze groupes, exit 0. A2-01/02 valident zéro/une occurrence ; A2-03 valide les homonymes et le modèle concurrent ; A2-04 à A2-12 passent également (ajout distinct, éditeurs exacts, consultation et droits, mois/ancien format, création bloquée, alias, RAW, état occupé et retour du focus). Preuve locale : `outputs/pr123-fixes/a2.log`. Cette preuve porte sur les handlers React et les éditeurs simulés, pas encore sur un navigateur.

### Mobility — correction du banc

Un seul discriminant de fixture est modifié, `slot` vers `socket`, conformément à `GuidedCatalogChoice`. Aucun code applicatif Mobility, Compiler, Finance V2 ou writer n'est modifié.

`node scripts/check-composer-mobility-fields.mjs` : PASS, trois groupes, exit 0 :

- MF-01 : champs publiés, parking 5,00 €, conservation du RAW entre rubriques et adoption explicite sur la sélection exacte.
- MF-02 : trajet devenu obsolète refusé, saisie partielle `7,` conservée, aucune opération acceptée.
- MF-03 : train 10,00 € pour le trajet complet, aller-retour sans multiplication ; frais/financement du trajet partagé sur leur propriétaire ; mode gratuit sans billet ajouté.

Preuve : `outputs/pr123-fixes/mobility.log`. Aucun nouveau défaut métier reproduit après correction de la fixture.

### Contrôles transverses ciblés

- `node node_modules/typescript/bin/tsc --noEmit` : exit 0 ; `outputs/pr123-fixes/typescript.log` vide, succès confirmé par le code de sortie.
- `node scripts/check-composer-month-intentions.mjs` : PASS, cinq groupes, exit 0. Identités exactes, consultation, filtres de projets/paniers/lecture seule, résultats périmés, clavier, IME et état occupé. Preuve : `outputs/pr123-fixes/navigation.log`.
- `git diff --check` : PASS après les trois modifications de source et de bancs.

### Navigateur ciblé — PASS

Le serveur C8 existant est reconstruit depuis le worktree de validation à la base `23818b3…` avec les seules corrections décrites. Playwright et Chrome headless existants, 1280 × 720, réseau de page limité à localhost, fournisseurs live désactivés. Aucun nouveau banc d'infrastructure ni session personnelle. Sources testées : `composer-library.tsx`, banc A2 renforcé et discriminant du banc Mobility ; le commit final contient ces mêmes corrections.

Cinq vérifications acquises :

1. Zéro occurrence : Entrée déclenche l'ajout explicite d'un seul Mascara.
2. Une occurrence : Entrée rouvre exactement ce Mascara, sans changement du digest ni du reçu durable local.
3. Deux occurrences et modèle Shopping concurrent : ArrowDown conserve l'ordre DOM, le modèle reste disponible.
4. Entrée place le focus sur la première occurrence existante ; aucun éditeur ne s'ouvre automatiquement, digest, version et état durable inchangés.
5. La seconde occurrence est sélectionnée au clavier et son éditeur exact s'ouvre ; mêmes deux identités, même digest et même reçu durable. Aucune confusion entre homonymes.

Digest de consultation : `2228d0123454084b489f490ed768749fc01a25248e548f0088fbeb65e7ea9b8f`, version locale 2. Plans = 0, révisions = 0, écritures distantes = 0, aucune erreur JavaScript. Preuves locales non publiées : `outputs/pr123-fixes/browser-result.json`, `browser.log`, `focus-first.png` et `second-mascara.png`. Serveur arrêté après le contrôle.

## Clôture

**TARGETED_FIX_PASS**.

Les deux défauts sont corrigés et les contrôles nouvellement exécutés passent : A2 douze groupes, Mobility trois groupes, navigation cinq groupes, TypeScript, diff et cinq vérifications navigateur ciblées. Aucun autre banc global ni les 21 parcours ou les seize modèles n'a été relancé. Les anciennes preuves restent datées, notamment la validation `e067ab8…` et son rapport documentaire `23818b3…` ; elles ne deviennent pas des exécutions sur ce correctif.

Fichiers exclusivement prévus dans le commit :

- `src/app/mois-a-venir/composer/composer-library.tsx` : priorité de focus.
- `scripts/check-composer-v22-a2-library.mjs` : régression ciblée et support du faux DOM.
- `scripts/check-composer-mobility-fields.mjs` : contrat `socket` dans la fixture.
- `docs/status/P21_PR123_FIX_REPORT.md` : présent rapport.

Les trois fichiers testés ont été transférés du worktree isolé vers la branche de la PR avec comparaison SHA-256 identique, sans toucher aux fichiers Cadeau. Empreintes des sources testées (octets locaux) :

| Fichier | SHA-256 |
| --- | --- |
| composer-library.tsx | `2247ad61a1a29c6c2ea1760e213a7b6e07e85c29751a3a6bb913ceec8b142478` |
| check-composer-v22-a2-library.mjs | `3591322c7e26ac566dc19ce06abd78d0799f7ce84395aa35f50949328af2dca9` |
| check-composer-mobility-fields.mjs | `49345b5de327c4a361fa910ef63cdc19eea978898d02b2d968412a29d60cd3cb` |

Le commit de clôture contient ce rapport et ces trois fichiers. Son SHA et la vérification du HEAD GitHub sont fournis dans le compte rendu final après le push normal de la branche existante.

La PR reste Draft. Ce verdict certifie uniquement les deux corrections ciblées ; les réserves de Preview exacte et de recette authentifiée restent ouvertes. Aucun déploiement Vercel forcé, aucun changement Production, aucune écriture financière distante et aucun Apply/PlanRevision. Les captures et les journaux restent dans `outputs/pr123-fixes/`, hors commit. Les deux modifications Cadeau restent en attente d'une autre décision et ne sont pas certifiées ici.

Après publication du rapport et vérification du SHA GitHub : arrêt immédiat de cette mission, sans reprise du méga-run.
