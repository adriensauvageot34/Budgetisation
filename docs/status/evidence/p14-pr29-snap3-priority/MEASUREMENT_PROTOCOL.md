# Protocole exécuté / restant — 14 octobre 2026

## Deux étapes et arbres de code

- PR #29 : HEAD 9bb35730286286226d3952c284a7f0efc679a47c ; arbre produit égal à 512e771384eccf614b1fc210819bb169d3d8b74a.
- A/B : conserver les deux Previews existantes, OFF dpl_DPjL3dem2ctP8NGr5zuVBkzaAtHU et ON dpl_3cjNbRSqvPn7N2XihiDzzsemhTqA, toutes deux en iad1.
- Chronologie : branche locale codex/composer-p14-pr29-world-trace ; commit source a2f05189448754c2f0b2d325c77a6c2f776b159e, exclusion des sorties locales 5231c74. Preview dpl_9JNV1PWqjVJjhT8Ecb6Dh9xJTGkS, iad1, protégée. Cette instrumentation n'entre pas dans la PR de production.

## A/B

Même mois 2026-10, même état mémoire initial, compte/foyer, cutoff, génération, région et instrumentation. Vérifier les dimensions DOM 1920×1080 avant chaque série. Alterner les rechargements OFF/ON puis ON/OFF ; ne pas qualifier un essai de froid sans preuve de cache/cold start. Conserver les deux anciennes paires compatibles séparément, et le troisième ON non apparié. Aucun échantillon défavorable n'est supprimé.

FRESH est mesuré dans le produit après commit puis double requestAnimationFrame, uniquement lorsque le digest et la séquence courants sont frais. Board utilisable et FRESH sont deux marques distinctes. Les durées d'appel Codex ne sont pas des métriques produit. P50/P95 : rang supérieur ; P95 descriptif, non robuste sur ces petits effectifs.

Pour les modifications et SUGGESTIONS : conserver exactement le même montant/état sémantique dans les deux variantes ; comparer les digests. Autosave OFF, aucun Apply, aucune donnée financière créée.

## Cycle de vie sans mutation financière

Après les mesures de référence seulement : invalider les artifacts par la configuration/version de leur propre owner, sans modifier une source financière. Vérifier le refus d'admission et le fallback autoritaire, puis réactiver la configuration, republier par le chemin authentifié existant et vérifier un nouveau HIT. Ne pas prétendre que ce cycle de configuration remplace le test des vrais writers : leurs mutations adversariales restent testées sur base native isolée.

Soirée et montant : état mémoire uniquement, puis relecture Preview. Les modifications vivantes et Apply/CHECK_APPLY sont couverts sur l'environnement isolé, pas par un Apply réel de production.

## Chronologie World

Un UUID technique par READ, horloge performance.now() unique côté serveur. Début/fin relatifs pour les spans et les appels HTTP ; parent par AsyncLocalStorage pour chaque branche parallèle. Aucun paramètre de requête, corps de source, identité utilisateur, secret ou montant observé exporté.

Groupes : Bootstrap, évidence Forecast/Baseline, publications existantes, achats Canonical, Mobility M7 et ses présences/lieux/événements, habitudes/Persona, MonthInputs/PlannedExpenses, Plan/Draft, préparation, construction Baseline, Compiler/Finance et modèle UI.

Les durées de spans sont inclusives. Ne pas les sommer. Rapporter la chronologie de la barrière Promise.all, son dernier groupe et sa marge par rapport aux autres groupes. Une suppression à coût nul est une estimation contrefactuelle, pas un gain exécuté. Dépendances partagées à prendre en compte : Forecast attend l'évidence ; Baseline attend Forecast ; M7 peut attendre les mêmes occurrences que C1.

SYNC_WALL mesure une durée synchrone écoulée, pas le CPU exclusif. HTTP mesure réseau/serveur/attente jusqu'aux headers ; la fin du corps cloné est séparée. Cette instrumentation ne sépare pas le temps SQL exclusif du réseau/PostgREST. Octets : JSON décodé, pas trafic compressé. Aucun mélange d'horloges client/serveur pour reconstruire des dates absolues.

## Limites et arrêt

La limite de revue navigateur antérieure doit être respectée jusqu'à 15:16 Europe/Paris. Aucune voie alternative pour réaliser l'action refusée. Une nouvelle répétition d'un timeout entraîne l'arrêt des essais lourds. Ne pas implémenter SNAP-3 ; sélectionner un seul périmètre à partir des barrières réellement observées.
