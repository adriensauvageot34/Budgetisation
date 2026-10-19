# Bar / Apéro — réception des 23 résidus desktop

## Verdict : NOT_READY

Le navigateur Codex fonctionne de nouveau. Sept résidus locaux sont fermés au niveau **navigateur desktop sur fixture synthétique**. La réception UI authentifiée avec World/FRESH reste bloquée ; aucun PASS général ni fournisseur réel n'est revendiqué.

| Repère | Résultat |
|---|---|
| Base locale/début de mission | `8998ba8f82a3ab72e7d60619bc8c0c81174ce15a` |
| Dernier produit antérieur | `ba949a65796850ecfaec83e0aba03566b82b9058` |
| Produit corrigé et testé | `661bd754699d490dfe3fa9fb9723f807cee3725e` |
| Branche / PR Draft | `codex/bar-apero-350-effective-closure` / [#67](https://github.com/adriensauvageot34/Budgetisation/pull/67) |
| Dépendance conservée | [#66](https://github.com/adriensauvageot34/Budgetisation/pull/66), `d25ead9f3c8b2033c038491ce9262fa82e787171` |
| Production/main | Inchangés ; base distante observée `bd97a33d0e4280b7796e941148057b7693af0229` |
| Preview exacte | [Ouvrir le candidat](https://budgetisation-ma10l6rq1-adriensauvageot34-6137s-projects.vercel.app), `dpl_4YS7ubjuSZ7cdZbNCjTrXnE19Zi2`, SHA `661bd75`, **READY** |

Les commits de réception suivants modifient uniquement documentation et contrôles de preuve. La Preview de produit ci-dessus reste la référence ; aucune promotion Production.

## Corrections réalisées

- **Dépôt rapide sur la corbeille** : la trace native montrait `dragenter` sur la cible, puis relâche sans `dragover` et aucun `drop`. La cible admet maintenant l'entrée native si elle est disponible et non protégée. Le même geste produit un vrai `drop`, un retrait, puis Undo avec contenu riche intact. Les décisions restent traitées par le résolveur existant.
- **Focus** : Undo d'une carte fermée restaure sa page et son titre ; une recomposition qui détache un contrôle peut rendre le focus à l'éditeur Bar. Un input survivant ou un dialogue ouvert garde son focus.
- **Lisibilité** : aides de trajet, en-tête et légendes des tuiles ciblées à 12 px ; couleur `#595363`. Contrastes calculés sur les fonds rendus : **6,16 à 7,27:1**. Les petits textes gris/beiges du témoin étaient à 10–11 px. Les montants, UNKNOWN et fraîcheur conservent leurs contrats.
- **Mesure opt-in** : sonde bornée `barProbe=1`, événements natifs, Event Timing, états et temps réseau séparés ; aucune valeur saisie, identité, interception réseau, nouvelle lecture financière ou persistance de télémétrie.

Fichiers produit : `composer-shell.tsx`, `composer-board.tsx`, `board-carousel.tsx`, `composer.module.css`, `bar-reception-probe.ts`, dans `src/app/mois-a-venir/composer/`. Aucun owner financier, writer, contrat, migration ou golden modifié.

## Tests réellement exécutés

| Contrôle | Résultat et portée |
|---|---|
| P1, P2, P3, P4, waves React, C8 | PASS sur `661bd75` ; logs conservés |
| TypeScript | PASS sur `661bd75` |
| Parité financière | **198/198**, 22 cas × 9 empreintes, goldens inchangés, zéro écriture distante |
| Build Vercel | `npm run build`, Next 16.2.6 : compilation 31,2 s, TypeScript 31,8 s, statiques 8/8, Build Completed et Deployment completed |
| Souris / clavier local | Drop natif, annulation, Undo fermé, RAW `8,`, Escape/Continuer, abandon explicite, Apply indisponible pendant RAW, récupération de focus |
| Desktop | Synthèse riche, 15 boissons paginées et calendrier à **1152×720, 1440×900, 1920×1080**, largeurs effectives relevées ; neuf états sans collision ni scroll interne carte/dock |
| Zoom natif 125 % | **NOT_VERIFIABLE** : raccourci officiel sans effet mesurable, aucune capacité de zoom ni autre navigateur desktop connecté. Aucun DPR artificiel compté comme preuve |
| Preview navigateur | Page de connexion réellement accessible ; **pas de PASS UI Auth** dérivé de READY |
| Tactile/mobile | **OUT_OF_SCOPE_USER_APPROVED**, aucun test ni PASS tactile |

Le bundle physique local est minifié avec React en mode production et un backend synthétique interdisant les appels externes. Ce n'est pas une exécution Next authentifiée. Les neuf scènes ont les mêmes octets UI que le produit final ; l'ultime changement de sonde concerne seulement la corrélation des événements dont le bouton a été détaché. Cette réutilisation est explicitée dans la pièce de réception.

## Mesures comparables, avec leurs limites

- **Prix : 40 frappes natives**, capture non saturée, Event Timing P50 **24 ms**, P95 descriptif **48 ms**, maximum **48 ms**. Aucune requête financière pendant ces saisies RAW. Event Timing mesure jusqu'à la prochaine mise à jour de rendu, avec quantification de 8 ms ; ce n'est ni le premier rAF ni une mesure photonique. Le premier relevé saturé est conservé mais exclu des statistiques.
- **Retrait riche : 6 cycles avant et 6 après**, même fixture, 1440×900, même sonde. Médiane clic→prochain rendu **48→48 ms** ; plages **32–216→40–56 ms**. DOM absent/FRESH médian **142,3→159,4 ms** ; SAVED synthétique médian **1160,3→1181,8 ms**, debounce inclus. **Aucun gain de vitesse démontré.** Séries séquentielles, pas de crossover randomisé ni P95 robuste sur six mesures.
- Temps des requêtes, observation DOM, FRESH et SAVED sont conservés séparément. Aucun temps SQL isolé ou résultat de performance authentifié n'est inventé. R314 reste ouvert pour cette corrélation complète.

## État des 350 recommandations

**350 IDs, textes intacts, aucun doublon ; 327 acquis antérieurs inchangés.** Contrôle automatique PASS, dont sept contrôles négatifs contre les fausses preuves.

- **334 clôturées au niveau de preuve annoncé** : 155 existantes vérifiées, 70 statiques, 108 navigateur fixture, 1 HTTP Auth. R030 est clôturée uniquement pour le desktop ; son volet tactile est explicitement exclu, pas vérifié.
- **7 nouvelles clôtures desktop** : R030, R084, R307, R308, R315, R328, R343.
- **11 PARTIAL** : R214, R255, R257, R276, R282, R314, R335, R336, R338, R342, R348.
- **2 BLOCKED_ENV** : R345, R346.
- **3 BLOCKED_OWNER** : R208, R209, R210.

R337 HTTP authentifié est conservée sans retest inutile. La couverture, les réponses hors ordre, RAW/Undo, les droits, Apply/CAS et le writer durable inchangés conservent leurs preuves antérieures ; celles-ci ne sont pas présentées comme de nouveaux tests authentifiés.

## Blocage précis et prochaine action

L'autorisation de préparer **H1 exclusivement fictif** a été reçue. Les lectures bornées ont confirmé : aucune publication Global publiée pour H1 ; aucune période close admissible certifiée ; `canonical_household_scope_control` est READY mais ne désigne pas H1. Le producteur officiel exige ces préconditions (`GLOBAL_CERTIFIED_THROUGH_MISSING` et contrôle du scope Canonical).

**Arrêt avant publication et réactivation de A** : ni fabrication de périodes certifiées, ni changement de scope, ni remplacement par le foyer personnel. Aucune nouvelle écriture Supabase, aucun Apply ni Plan. L'ancien incident personnel de sauvegarde reste inexpliqué ; il n'est pas attribué à cette dépendance H1.

Prochaine action minimale : les owners Global/Canonical doivent fournir un World synthétique H1 officiellement admissible, puis sa publication par le producteur existant. Les contrats manquants Google/admission, relation trajet↔bar, couverture économique versionnée et libellé structuré du véhicule sont précisément décrits dans la pièce owners. Aucun nouveau framework ni writer de contournement.

## Pièces

- [Matrice des 23 résidus](evidence/bar-apero-350/residual23/matrix-23.md)
- [Réception, méthodes et limites](evidence/bar-apero-350/residual23/receipt.md)
- [Mesures brutes et synthèse](evidence/bar-apero-350/residual23/metrics.json)
- [Demandes propriétaires](evidence/bar-apero-350/residual23/owners.md)
- [Tests et commandes exacts](evidence/bar-apero-350/residual23/tests.json)
- [Build Vercel complet](evidence/bar-apero-350/residual23/vercel-build.log)
- [Registre intégral](evidence/bar-apero-350/requirements.json)

Rollback local : revert du commit produit `661bd75`, sans modification du stockage. Les archives, Drafts et Plans existants ne sont pas affectés. PR #67 conservée Draft ; aucune fusion ou Production.
