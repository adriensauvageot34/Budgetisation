# Global V2 — contrat commun d’exécution

Ce document conserve la charte C01–C14 du pack d’implémentation. Il gouverne l’exécution des prompts sans créer de nouvelle doctrine métier. Le Master Global FINAL EXHAUSTIF demeure l’autorité normative.

## C01 — Autorités et lecture ciblée

Lire `AGENTS.md`, le Master Global FINAL EXHAUSTIF, ses registres verrouillés, les décisions humaines et les rapports post-History concernés. Le Master prévaut sur ses résumés et le pack. Le schéma et les données Canonical réels déterminent ce qui est physiquement disponible. Un conflit métier entre ces autorités est documenté et soumis à arbitrage. Une ancienne hypothèse technique déjà réfutée par une preuve plus récente est corrigée sans rouvrir tout le projet.

Lire complètement les sections et contrats nécessaires au lot. Réutiliser les lectures déjà prouvées lorsque leurs digests n’ont pas changé. Ne pas relire tous les documents ni interroger toutes les tables à chaque mission. Localiser les chemins réels ; ne pas créer de copie concurrente d’un rapport existant.

## C02 — Traçabilité exhaustive

Le Master fourni contient 2 047 exigences, 364 capacités et 2 302 tests conceptuels dans les annexes A, B et D. Ces inventaires sont distincts. Vérifier leurs versions et cardinalités lors de l’import initial des références ; si le document change, recalculer l’inventaire et expliquer le delta.

Chaque exigence reçoit un propriétaire de mission, une source exacte, un statut et une preuve. Chaque test conceptuel est relié à un cas exécutable, une fixture, une mesure UX ou une vérification documentaire appropriée. Un test paramétré peut couvrir plusieurs IDs, si les assertions démontrent réellement les comportements. Un compteur de lignes, une regex de présence ou un rapport auto-déclaré ne prouve pas la conformité.

Aucune exigence MUST n’est oubliée. CONDITIONAL, DATA_GATED, AUTHORITY_GATED, LATER et FORBIDDEN gardent leur sens normatif. Une capacité DATA_GATED exige toujours son implémentation et ses tests de données absentes ; elle ne peut pas être sautée comme une autorité fermée.

## C03 — Reprise de la réalité

Au début de chaque mission relever HEAD, branche, statut Git, dernier rapport, fichiers déjà modifiés et entrées pertinentes. Préserver les changements existants. Ne pas imposer éternellement le SHA de ce pack : le checkpoint de la mission précédente est la nouvelle baseline. Un travail déjà PASS n’est rejoué que si sa source, ses dépendances, sa version ou le code testé ont changé.

Tenir `docs/global-v2/GLOBAL_EXECUTION_STATE.md` à jour avec le lot, ses sous-gates, le commit, les digests pertinents, les tests, les limites et le prochain lot autorisé. Conserver la chronologie des corrections ; ne pas réécrire un ancien FAIL en ancien PASS.

## C04 — Autorité de production

Canonical → Facts → Analytics officiels et spécialisés → artifacts → ReadModels → snapshots → React. Réutiliser les moteurs existants compatibles. Ne jamais fabriquer Global en agrégeant les douze ReadModels History. Ne pas moyenner des Typical, quantiles, rangs ou ratios mensuels comme s’ils étaient additifs.

EXPECTED, les certificats Minimal current ou legacy et les oracles interviennent après production, en comparaison seulement. Aucune preuve compare-only ne peut devenir FactSource, MetricProductionSource, entrée de builder ou payload. Un écart déclenche un diagnostic de cause ; on ne modifie ni l’oracle ni le moteur pour masquer l’autre.

## C05 — Temps et connaissances

Pas de filtre temporel universel Global. Chaque calcul déclare grain naturel, corpus, fenêtre, lookback, exposition et intersection comparable. CERTIFIED_HISTORY et LIVE_TAIL restent distincts. LIVE_TAIL ne crée ni référence structurelle, ni tendance certifiée, ni rupture historique. Respecter `asOf`, le fuseau Household, les trous et l’absence de lookahead.

KNOWN, PARTIAL, UNKNOWN, NOT_APPLICABLE et CONFLICT restent distincts du support et de la capability. Un zéro connu a une preuve ; une absence n’est pas zéro. Les dénominateurs de coverage sont prouvés ; effectiveCoverage utilise le minimum des dimensions obligatoires, jamais leur moyenne. Aucun ratio 100 % n’est inventé depuis un montant ou une table non vide.

## C06 — Autorités fermées

Les 31 gates AG001 à AG031 sont fermés dans GA0. Leur ouverture nécessite une source et une doctrine vérifiables, pas un nom de colonne ou une heuristique. Un état de repli explicitement autorisé peut être certifié, en indiquant que la capacité n’est pas active. Si l’autorité existe désormais, implémenter la capacité devenue exigible ; ne pas la laisser arbitrairement désactivée.

Une dépendance obligatoire non couverte ou une contradiction reste BLOCKED. Payer n’est pas beneficiary ; présence n’est pas visite financière ; répétition d’un libellé n’est pas routine ; opération bancaire n’est pas PurchaseEvent ; spentDuring n’est pas causalCost. Ne créer aucune donnée pour rendre les tests verts.

## C07 — Liberté technique et fermeture du lot

Faire le preflight ciblé, figer les choix techniques conformes, implémenter, tester, corriger et clôturer dans la même mission. Ne pas s’arrêter après un simple plan lorsqu’un résultat est autorisé. Un échec technique corrigeable dans le périmètre doit être traité jusqu’à sa cause. Ne pas ouvrir le lot suivant pour contourner un défaut du lot courant.

Paralléliser les sous-tâches indépendantes avec des fichiers ou responsabilités distincts lorsque cela aide. L’agent principal intègre les résultats et répond de la preuve finale. Une revue indépendante des diffs ou des tests sensibles est utile ; elle ne remplace pas les tests exécutés.

## C08 — Dépendances et versions

Chaque moteur déclare tous ses inputs, Facts, entités, Analytics amont, scopes, fenêtres, policies, outputs et invalidations. Modifier une dépendance significative doit changer le hash attendu ; un changement sans effet sémantique ne doit pas créer de faux changement métier.

Préserver les identités V1 tant que leurs consommateurs existent. Toute évolution sémantique possède une version explicite. Une version attendue ne se devine pas à partir d’un payload ancien. Lorsqu’un contrat partagé change, recertifier son propriétaire puis ses consommateurs par closure. Documenter les incompatibilités de génération.

## C09 — History et legacy

HC1–HC6 sont acquis. Réutiliser les doctrines et les primitives compatibles sans modifier les publications History actives. Des enrichissements Facts peuvent modifier les hashes de futures générations ; les montants Household communs doivent rester réconciliés. Aucun rebuild History implicite n’est autorisé dans ces missions.

Les neuf familles Global legacy sont un existant à inventorier, pas une autorité V2. Ne les retirer qu’après couverture des consommateurs et du rollback. Un test de compatibilité legacy ne devient pas le gate M1–M10. Respecter `AGENTS.md` concernant les scripts V1 interdits ; distinguer ces scripts des tests actuels de compatibilité.

## C10 — Données et opérations live

P01–P17 : aucune écriture Supabase live, aucun Begin, stage, attach, finalize ou rollback réel. Les lectures nécessaires sont autorisées et minimisées. Aucune nouvelle authentification utilisateur pour un travail serveur. Un accès insuffisant produit un blocker précis ; ne pas chercher de secrets ou de mots de passe.

Préparer une migration ciblée si elle est indispensable et dans le périmètre autorisé du lot. Tester les contrats SQL sans reset et sans Supabase local, sauf autorisation explicite. N’appliquer aucune migration live avant P18 ou T01 avec son autorisation particulière. Protéger les données privées ; seuls fixtures synthétiques, références techniques et résultats agrégés nécessaires entrent dans Git.

## C11 — Publication et cache

Une nouvelle vérité crée une nouvelle génération. Aucun patch d’un payload publié. Construire hors navigation, stage inactif, manifest fermé, read-back et certification avant activation atomique. Une génération Global cohérente ne correspond pas artificiellement à douze publications mensuelles.

La Query sert des snapshots compatibles, sans calcul métier à la demande. Un miss ou une invalidation produit un état local explicite. Les modules affichés partagent l’identité de publication commune ; leurs `policyVersions` et `contractVersions` peuvent être spécifiques aux ressources. Pendant une lecture, ne pas mélanger les générations ni les remplacer silencieusement module par module. Le rafraîchissement explicite bascule de manière cohérente et ignore les réponses tardives de l’ancienne génération.

## C12 — Tests proportionnés mais probants

Chaque mission exécute ses tests discriminants, le typecheck et `git diff --check` ; l’architecture est vérifiée lorsque le code ou ses imports changent. Exécuter les régressions des dépendances réellement touchées. Les modifications runtime, Query, schéma, SSR, React ou de configuration requièrent un build de production.

Ne pas rejouer sans raison les 947 anciens payloads, les 12 mois History ou HC3–HC5 à chaque étape. La certification finale P17 exécute le catalogue Global applicable sur le code enregistré, avec les régressions partagées nécessaires. Si un défaut est corrigé, invalider et rejouer les preuves affectées, puis clôturer sur un seul état final cohérent.

## C13 — Checkpoint et compte rendu

Créer un rapport de mission dans `docs/global-v2/execution/Pxx-report.md`, sauf chemin existant explicitement réutilisé. Conserver les gates d’origine sous forme de sous-gates pour la continuité. La preuve inclut commande, résultat, cardinalité, code testé, données ou fixtures, versions et limitations.

Après PASS, créer un commit local borné aux fichiers légitimes du lot et de sa documentation. Vérifier les non-suivis et les secrets avant de stage. Aucun push ni merge automatique. Si un changement préexistant est hors lot, le préserver et l’exclure ; ne pas prétendre que le worktree est propre. Ne jamais utiliser `git add` globalement sans avoir identifié son contenu.

## C14 — Verdict et arrêt

Rapporter CURRENT_PROMPT, BASELINE_HEAD, FINAL_HEAD, IMPLEMENTATION_GATE, CONTRACT_GATE, TEST_GATE, LIVE_GATE, CAPABILITIES_ACTIVE, CAPABILITIES_GATED, UNRESOLVED_REQUIREMENTS, LIVE_WRITES et NEXT_PERMITTED_PROMPT. Employer PASS, PARTIAL ou BLOCKED avec cause ; NOT_RUN n’est jamais PASS.

Le prochain prompt est autorisé lorsque les sous-gates exigibles à la sortie du lot sont PASS. Une recertification explicitement affectée au lot suivant reste PENDING avec owner et échéance ; elle doit être exécutée avant tout consommateur qui exige sa fermeture. P07 peut ainsi ouvrir P08, mais P09 reste interdit tant que la recertification E requise est ouverte. Une revue ChatGPT supplémentaire peut être demandée pour un choix ou un écart réel ; elle n’est pas nécessaire après chaque détail technique déjà prouvé. S’arrêter après le lot demandé, même si la suite est prête.
