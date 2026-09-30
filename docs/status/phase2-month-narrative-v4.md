# Mois à venir V4 — parcours et prévisions restantes

## Implémentation

- Ordre : ressources → charges certaines → projets → calendrier → effet marginal des projets → essentiel → marge après essentiel → extras facultatifs → trois scénarios finaux → précision.
- `MonthScenario` conserve l'autorité économique. Le nouveau modèle pur est calculé côté serveur et partagé par la page, Preview, Save et rechargement.
- Aucune table, migration ni nouvelle donnée persistée. Les observations canoniques sont attachées à la lecture du snapshot, jamais matérialisées avec celui-ci.
- Les lectures des opérations sans household_id sont conditionnées au contrôle canonique singleton READY, puis au foyer autorisé. Les composants et opérations sont paginés et ordonnés.

## Méthode explicable

- Essentiel : six mois récents disponibles, rythme quotidien et quantiles P25/P50/P75 ; jours restants et trajets de travail sur jours ouvrés restants.
- Extras : calme à zéro ; fréquence récente pondérée × occasions restantes × prix médian conditionnel. Scénario actif : fréquence plausible et P75 conditionnel, jamais un maximum brut.
- Un root/module représente une occurrence, même après une ventilation des coûts. Le projet habituel consomme sa prévision ; le projet supplémentaire conserve la fréquence habituelle. Le repas daté occupe le créneau de la personne concernée.
- Le jalon après projets utilise l'impact marginal. Les provisions conservent la portion habituelle déplacée ; la soustraire avec l'impact marginal compte le projet une fois. Les cartes affichent le reste effectivement non couvert, et les détails distinguent imports, projets et projection totale.
- Un projet moins coûteux que l'habitude remplacée peut réduire l'estimation : impact signé conservé ; couverture affichée plafonnée au coût brut du projet.
- Lifecycle économiquement neutre à contenu identique. Page et actions utilisent le jour civil du foyer, y compris près de minuit.

## Vérifications exécutées

Commandes lancées avec le runtime Node fourni au poste :

```text
node scripts/check-phase2-month-narrative.mjs
node scripts/check-phase2-post-v1-fixes.mjs
node scripts/check-phase2-planned-calendar.mjs
node scripts/check-phase2-planned-finance.mjs
node node_modules/typescript/bin/tsc --noEmit
node node_modules/next/dist/bin/next build
```

Résultats : PASS. Le test finance a été actualisé pour le libellé « Effet sur le mois ».

Le lot teste aussi les quantiles face à un mois atypique, la réduction au 20 du mois, l'exclusion des observations futures, le split sans double occurrence, les projets habituels/extra, l'occupation du repas par personne, les scénarios monotones, le faible échantillon, la pagination au-delà de 1000, le refus cross-household avant lecture des opérations, Preview/Save/reload et les écritures limitées au prospectif dans le transport de test en mémoire.

## Limites explicites

- Les mois historiques récents sont ceux réellement importés ; aucun historique manquant n'est inventé. Le petit échantillon déclenche une référence plus ancienne/publiée et une précision réduite.
- L'absence d'import du mois courant masque la projection complète par « À affiner » ; les estimations restantes restent lisibles. Un import partiel n'est pas une certification exhaustive des dépenses réalisées.
- Présence au travail et attribution des cafés : hypothèses déclarées existantes. Pas de congés, météo, vacances complexes ou apprentissage personnel ajoutés.
- Un shim côté serveur conserve l'ancien calcul pour les fixtures/snapshots fournis sans observations. Les lecteurs de production attachent toujours les observations ; React ne possède aucun calcul de remplacement.
- Pas d'appariement silencieux entre une dépense prospective déclarée et une opération bancaire importée : ces faits gardent leurs autorités distinctes.
- Aucun test live avec écriture Supabase dans ce lot. Le navigateur de production vérifie la présentation en lecture seule après le déploiement Git.

## Production

- Déploiement Git V4 prêt ; session navigateur authentifiée contrôlée en lecture seule.
- Nouvel ordre, jalons, trois scénarios, extras calmes à zéro, détails de la prévision et calendrier conservé : constatés sur la page déployée.
- Aucune erreur console observée. Période historique explicitée dans les explications afin de distinguer récence disponible et mois courant.
- Le script live autonome `check-phase2-month-forecast.mjs` n'a pas démarré : ses paramètres de foyer/mois et son environnement serveur étaient absents. Aucun résultat PASS ne lui est attribué ; la lecture réelle a été vérifiée via la page de production.
