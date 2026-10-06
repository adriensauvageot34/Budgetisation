# Composer — correction de l'ouverture en production

| Champ | Résultat |
| --- | --- |
| HEAD_BEFORE | `ba14b418d763d098c2f3f72b8be724f6db3ab0c8` |
| HEAD_AFTER | `git log -1 --format=%H -- docs/status/planner-composer-live-fix-2026-10-06.md` |
| Migration / modification du schéma | Aucune |
| Écriture métier Supabase distante / RPC distante | 0 / 0 |

## Erreur reproduite

Le déploiement `dpl_4X8Fg4dvUsjYhFhnpF4zjQ4v2Hws` était READY et contenait
le commit C8 attendu. Le CSV fourni et les logs Vercel montraient des réponses
500 sur `/mois-a-venir/composer`, avec
`PLANNER_WORLD_AUTHORITIES_CHANGED_DURING_READ`. Le navigateur authentifié
affichait « This page couldn’t load ».

Une lecture des vrais propriétaires, limitée techniquement aux requêtes GET/HEAD,
a montré que les publications, source revisions et analytics revisions étaient
identiques. Les différences concernaient `reserve.amount` et les trois champs
`freeToSpend`. Le snapshot mensuel avait été publié le 28 septembre ; la seconde
lecture reconstruisait la prévision sous une politique de réserve plus récente.
Le contrôle ajouté au Planner traitait donc une différence de reconstruction
comme un changement concurrent d'autorité.

## Corrections

Le world-reader lit d'abord la prévision validée par `readPlanningMonthForecast()`
puis fournit exactement cette prévision à l'adapter de Baseline. Les faits C1 et
le propriétaire financier partagent désormais le même forecast admis. Le
snapshot publié n'est pas recalculé silencieusement sous la politique actuelle.
Le flux direct V2 et le propriétaire mensuel restent inchangés.

`admitPlanningForecast()` refuse toujours un changement de targetMonth,
publication, source revision ou analytics revision pendant la lecture des
autorités. Le cutoff reste figé. Le builder C1 autonome conserve son chemin
existant lorsque l'appelant ne fournit pas de prévision publiée.

Après cette correction, la lecture réelle a révélé un second blocage,
`RENEWAL_NEED_SUBJECT_CONFLICT` : des observations anciennes avaient des clés
sans Need canonique correspondant. Elles étaient absentes de la fenêtre courte
de références financières mais présentes dans le corpus complet C6.

Ces observations sont désormais conservées comme références/diagnostics
`BASELINE_NEED_MAPPING_UNAVAILABLE` et `RENEWAL_NEED_MAPPING_UNAVAILABLE`.
Elles ne créent ni Need fictif, ni habitude, ni AcquisitionEpisode attribué,
ni cadence, ni due window, ni montant zéro. Les Needs existants poursuivent leur
traitement normal. Un conflit entre le sujet d'une observation et celui d'un
Need existant reste une erreur ; les vérifications de Household et de Person
hors scope restent bloquantes.

Les modèles habits et renewals passent à `@v2`, afin que leurs preuves et
digests reflètent la nouvelle admission explicite. Aucun achat, produit,
observation, Need, Bank debit, MonthInputs ou Plan distant n'a été modifié.

## Vérification

| Vérification | Résultat |
| --- | --- |
| C1 Baseline | 14 groupes PASS, dont observation sans mapping, sujet conflictuel et snapshot admis sans reconstruction |
| C2 kernel | 40 groupes PASS ; une seule prévision réutilisée et quatre changements d'identité toujours refusés |
| C6 renewals | 32 groupes PASS ; observation non mappée sans renouvellement inventé, conflit de Person toujours refusé |
| C7 headless | 34 groupes PASS ; parité Preview/Apply/reload dans PGlite isolé |
| C8 serveur | 33 groupes PASS ; garde stale, ancienne écriture protégée et Apply/reload isolé |
| Build et vérification TypeScript | PASS |
| Lecture réelle octobre 2026 | PASS : 15 slots, projection `READY_WITH_WARNINGS`, 311 requêtes readonly, aucune RPC |

Les warnings réels conservent les inconnues : fréquence du repas travail Manon,
couverture récente de renouvellement, références locales, mobilité, réserves,
financement, timing et cash. Ils ne sont pas remplacés par des zéros ou des dates
inventées. Le diagnostic readonly n'appelle aucun Apply.

La certification C8 sur fixtures n'avait pas couvert la coexistence de politiques
entre un snapshot publié et sa reconstruction, ni les observations anciennes
sans Need canonique. Ces cas sont maintenant intégrés aux régressions du lecteur,
de l'adapter et des builders.

Les vérifications distantes restent des lectures. Les tests qui utilisent la
RPC C0 s'exécutent exclusivement dans PGlite synthétique, comme avant.
Le contrôle final du déploiement et ses captures navigateur sont conservés hors
du dépôt dans le workspace de la conversation, sous
`outputs/planner-live-fix/`.

Une URL Vercel de déploiement identifie un build précis. Le correctif est publié
par le workflow Git existant ; l'entrée stable est
`https://budgetisation-tan.vercel.app/mois-a-venir/composer`.
