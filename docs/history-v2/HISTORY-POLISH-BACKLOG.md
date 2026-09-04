# History — Polish backlog indépendant du Core

Date : 2026-09-04. HC6, préflight seulement.

Ce registre reprend les sujets explicitement différés par le prompt HC6.
Il ne prétend pas qu'un nouveau smoke les a reproduits ni qu'ils constituent
tous des défauts de l'interface actuelle. Aucun de ces éléments n'est implémenté
dans HC6. Une incohérence métier/contractuelle/runtime démontrée ne doit jamais
être dissimulée comme simple polish.

CORE_IMPACT n'utilise que NONE ou POSSIBLE_CONTRACT_CHANGE.
REPUBLISH_REQUIRED indique une condition à vérifier, pas une autorisation.
Les dépendances de ReadModel ne sont pas qualifiées arbitrairement de UI-only.

| ID | AREA | DESCRIPTION | WHY_DEFERRED | CORE_IMPACT | REPUBLISH_REQUIRED | TARGET_PHASE |
| --- | --- | --- | --- | --- | --- | --- | --- |
| HP01 | Calendar | Nombre de markers 3/6 | Hors gate Core ; vérifier ordre/topN et payload avant changement | POSSIBLE_CONTRACT_CHANGE | POSSIBLE si contrat/artifact/RM change | History produit, arbitrage contrat préalable |
| HP02 | Calendar | Densité et cell design | Présentation ; aucune modification de membership/ordre serveur autorisée | NONE | NO dans ce périmètre CSS | History UI polish |
| HP03 | Hover | Interactions tactiles | Ergonomie différée, sans calcul économique client | NONE | NO à payload inchangé | History interaction polish |
| HP04 | Week | Découvrabilité et bouton d'accès | Navigation produit ; aucun changement de calendrier serveur | NONE | NO à contrat inchangé | History navigation polish |
| HP05 | Design | Couleurs et spacing | Finition visuelle non bloquante | NONE | NO | History design polish |
| HP06 | Motion | Animations et transitions | Aucun effet sur vérité ou ordre serveur | NONE | NO | History motion polish |
| HP07 | Responsive | Responsive complet et mobile polish | Finitions de layout différées | NONE | NO à contrat inchangé | History mobile polish |
| HP08 | Accessibility | Accessibilité fine, focus et affordances | Travail ergonomique distinct ; un blocage runtime reste à traiter comme tel | NONE | NO à contrat inchangé | History accessibility polish |
| HP09 | Journal | Redesign Journal | Un redesign pouvant réclamer d'autres regroupements/champs exige revue RM | POSSIBLE_CONTRACT_CHANGE | POSSIBLE selon contrat requis | History Journal, revue de contrat préalable |
| HP10 | Quality | Présentation PARTIAL | Changer le rendu, pas les règles de connaissance/visibilité | NONE | NO tant que Quality/Visibility inchangées | History Quality presentation |
| HP11 | Overview | bankInflows visible | Vérifier disponibilité et sémantique du champ avant affichage | POSSIBLE_CONTRACT_CHANGE | POSSIBLE si ressource/visibility ne fournit pas le champ | History Overview, revue payload |
| HP12 | Place | Voir tous les lieux | Ne pas supposer que top6 expose toute la collection/capacité requise | POSSIBLE_CONTRACT_CHANGE | POSSIBLE si liste/détail/RM change | History Place, revue contrat |
| HP13 | Activity | Participants d'affichage | Aucune donnée absente ne peut être fabriquée pour enrichir la carte | POSSIBLE_CONTRACT_CHANGE | POSSIBLE si Canonical/Facts/RM doivent être enrichis | History Activity, disponibilité des données |
| HP14 | Labels | Labels et affordances cosmétiques | Aucun renommage qui change le sens métier | NONE | NO pour texte purement frontend | History wording polish |
| HP15 | Bridge | Wording Bank→Economy | Présentation seulement ; formules et temporalité conservées | NONE | NO pour libellés frontend | History wording polish |
| HP16 | Autres CAN_WAIT | Finitions explicitement différées, à détailler lors de leur instruction | Aucun nouvel audit produit dans HC6 ; impact non présumé | POSSIBLE_CONTRACT_CHANGE | À DÉTERMINER avant toute évolution | History produit après qualification |

Les champs d'affichage absents ne deviennent pas automatiquement des enjeux
Core : conserver l'état explicite UNKNOWN/PARTIAL/absence autorisé tant que
leur implémentation produit n'est pas demandée.

Le backlog ne remplace pas la Definition of Ready produit. Un futur PASS Core
autorise seulement l'entrée dans l'audit post-History de l'Analyse Globale,
sans implémenter celui-ci et sans déclarer History entièrement terminé.
