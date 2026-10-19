# Bar / Apéro — réconciliation des 350 recommandations et réception

## Verdict

**NOT_READY pour réplication et intégration générale.** Le code sûr est proposé dans la PR Draft [#66](https://github.com/adriensauvageot34/Budgetisation/pull/66). Les gates financiers/RAW locaux passent ; la réception de géométrie finale et la sauvegarde riche Auth restent ouvertes. Aucune fusion, migration ou Production.

## Git et base réelle

- Dépôt : adriensauvageot34/Budgetisation ; workspace p14-a2-a3-performance.
- Branche : codex/bar-apero-350-reconciliation.
- HEAD de départ : a2e2aec30c9228cde12ebf26eedec6b5ebcbbc71.
- Main vérifié : bd97a33d0e4280b7796e941148057b7693af0229.
- SHA produit final testé : **4e0dc25987f43fb6a086871d2d3f55bb2b37baec**. Les commits de réception ultérieurs ne changent que les preuves et outils de contrôle ; HEAD de livraison indiqué dans le compte rendu.
- a2e2aec est descendant de 55900176cf7c140ac897f24d3fca180b035ce008. Leur diff ne contient que 98 lignes du rapport compact : **produit identique**. Le premier commit visuel 0235599 et le correctif de remount 5590017 sont conservés.
- PR63 fusionnée ; PR64 fermée non fusionnée directement, filiation incluse dans PR65 fusionnée. Aucun travail antérieur réécrit.
- outputs/ préexistant et les preuves personnelles restent hors commit. Aucun secret ni dump.

## 350 textes exacts et niveaux

Les formulations originales sont conservées une fois chacune dans requirements.json et confrontées à source-master.md et source-grouped.md. Statuts au niveau réellement acquis :

| Chantier | Total | Existant confirmé | Réalisé maintenant | Partiel | Bloqué environnement | Bloqué owner |
|---|---:|---:|---:|---:|---:|---:|
| A | 20 | 7 | 6 | 7 | 0 | 0 |
| B | 27 | 11 | 8 | 5 | 0 | 3 |
| C | 22 | 17 | 5 | 0 | 0 | 0 |
| D | 43 | 34 | 7 | 2 | 0 | 0 |
| E | 26 | 16 | 6 | 4 | 0 | 0 |
| F | 39 | 14 | 17 | 6 | 2 | 0 |
| G | 34 | 9 | 17 | 4 | 4 | 0 |
| H | 31 | 11 | 0 | 2 | 18 | 0 |
| I | 25 | 8 | 6 | 0 | 11 | 0 |
| J | 33 | 12 | 7 | 1 | 13 | 0 |
| K | 18 | 0 | 1 | 0 | 17 | 0 |
| L | 22 | 13 | 0 | 3 | 6 | 0 |
| M | 10 | 3 | 0 | 0 | 7 | 0 |

| Vague | Total | Existant confirmé | Réalisé maintenant | Partiel | Bloqué environnement | Bloqué owner |
|---|---:|---:|---:|---:|---:|---:|
| 1 | 69 | 35 | 19 | 12 | 0 | 3 |
| 2 | 69 | 50 | 13 | 6 | 0 | 0 |
| 3 | 73 | 23 | 34 | 10 | 6 | 0 |
| 4 | 89 | 31 | 13 | 3 | 42 | 0 |
| 5 | 40 | 13 | 1 | 3 | 23 | 0 |
| 6 | 10 | 3 | 0 | 0 | 7 | 0 |

Le total est 350 ; « réalisé » inclut un niveau React/statique explicitement indiqué, pas une réception physique ou Auth. Zéro PLANNED résiduel et zéro régression connue dans les tests finaux ; les limites sont listées individuellement dans unresolved.md. Les preuves historiques ne deviennent pas automatiquement des preuves finales.

## Développement réellement réalisé

| Avant | Maintenant | Limite |
|---|---|---|
| Clic vide revenant au résumé ; Date/Plus tard/montant renvoyant aux boissons | Clic neutre, scènes ciblées et retour neutre ; calendrier à tabstop unique et flèches bornées | Focus global/zoom final non certifié |
| Recherche locale dupliquée, termes perdus ; homonymes peu distinguables | Une recherche locale, reprise par cible, accent/casse/adresse, provenance visible ; fiche Google isolée | Provider/admission durable non certifiés |
| Montant accessible par navigation de dock | Accès depuis en-tête ; périmètre consommations explicite ; détails remplacés avec consentement | Poste multi-unités/multi-main refusé avec explication et édition par tuile |
| Premier objet Before toujours SHARED | Unité issue du catalogue publié ; décisions anciennes conservées ; compléments contextuels après Vodka, accès à tout le catalogue | Aucun prix catalogue adopté silencieusement |
| Deux lignes Bière visuellement confondues avec l’ajout | Nouvelle ligne marquée + Bière ; identité de chaque tuile et prix indépendante | Géométrie finale à recevoir |
| RAW concurrencé par catalogue complet | Accès explicite aux autres consommations sans perdre la saisie ; garde de sauvegarde/abandon inchangée | Pas de faux PASS natif |
| Tous les lieux proposés pour tout endpoint | Suggestions selon Aller/Retour et origine/destination ; Maison prioritaire si admissible ; autres lieux par recherche ou demande explicite | Aucun choix, véhicule ou trajet automatiquement retenu |
| Route monolithique | Points et coût ciblables, menu rare, inversion explicite et modes indépendants ; reprise inverse distincte de même mode ; prix UNKNOWN | Capsule véhicule courte pas finalisée ; fournisseurs réels non exécutés |
| Dock répétant les portes de navigation | Carte en premier ; choix de composition, poursuite par champ manquant ; pages mémorisées par cible/question | Focus lors de resize réel non certifié |
| Dernière page étirant ses rares cartes | Nombre de colonnes stable ; ancien effet de reset supprimé après test reproduit | Preuve React, pas mesure de pixels actuelle |
| Produits sans image en emoji/étoile | Miniatures existantes partagées dock/carte et icônes vectorielles pour cocktail/snack/bouteille | Illustration éditoriale existante conservée |
| Tous les coûts compacts sous Au bar | Repas, consommations regroupées, contributions et Before distincts ; pas d’invitation de carte vide sur carte déjà précisée | Réception visuelle riche non certifiée |
| Mesures de scroll sur dock paginé | Mesures et observer de scroll évités pour Bar uniquement | 40 rendus synthétiques : 0 lecture de scroll, 1 observer ; aucun gain P95 réel revendiqué |

### Défauts corrigés pendant réception

- Test initial P2 de clic vide obsolète : il attendait le retour au résumé, contraire à R022 ; désormais neutralité et conservation sont assertées.
- Oracles P4 de nouvelle Vodka/Snack utilisent la bonne unité issue du catalogue. Les oracles 39/79/69 euros restent inchangés, ainsi que les 198 goldens.
- La nouvelle fin de montant en synthèse exige une navigation explicite vers la bouteille ; les helpers de test suivent le nouveau chemin sans retirer les assertions financières.
- Le test de mémoire de pagination a réellement détecté l’ancien reset résiduel : échec observé et extrait dans final/intermediate-failures.json, corrigé dans le commit 4e0dc25. Le journal final-waves.log a été remplacé par le rerun réussi ; cet extrait ne se prétend pas journal brut original.
- Une saisie rapide de montant préservait mal financement/champs supplémentaires : reprise de fromSelection, protection des unités complexes et des multi-postes ; le test de conservation passe.

## Tests réellement exécutés

Commandes lancées depuis le dépôt avec Node 22.18.0 et les dépendances locales déjà installées. Aucun nouvel installateur.

| Commande | Résultat | Niveau |
|---|---|---|
| node scripts/check-bar-apero-350-waves.mjs | 22 groupes PASS | React et owners synthétiques ; pas navigateur |
| node scripts/check-bar-apero-p1.mjs | 25 PASS | React |
| node scripts/check-bar-apero-p2.mjs | 20 PASS | React et layout pur |
| node scripts/check-bar-apero-p3.mjs | 12 PASS | React, Google mock et PGlite |
| node scripts/check-bar-apero-p4.mjs | 14 PASS | React et Apply/Reload PGlite synthétique |
| node scripts/check-bar-apero-last.mjs | 8 PASS | Scènes riches et vrai shell/transport simulé |
| node scripts/check-planner-performance-parity.mjs | 22 × 9 = 198 empreintes identiques | Compiler/Finance V2 fixture |
| node scripts/check-composer-p14-p2-durable.mjs | 7 PASS | Hook déterministe, CAS, perte de réponse, archives |
| node scripts/check-phase2-planner-p13.mjs | 8 PASS ;3 révisions synthétiques | Apply/CAS/idempotence et échec après commit |
| node scripts/check-pre-l4-c2-c8-source.mjs | C8-017 PASS, garde original inchangé | Statique |
| node node_modules/typescript/bin/tsc --noEmit | Code sortie 0 | TypeScript complet |
| BAR_P4_FIXTURE_ORIGIN=http://127.0.0.1:3234 + node scripts/check-bar-apero-p4-http.mjs | 7 contrôles PASS ; 4 sauvegardes ; v4 ; 38 euros connus+incomplet | Vrai HTTP local synthétique ; pas Auth |
| node scripts/check-bar-apero-350.mjs | 350/350 textes présents et intacts | Intégrité de registre, pas validation fonctionnelle de 350 exigences |
| node scripts/check-bar-apero-350-integrity.mjs | 7 falsifications refusées | Ligne manquante, doublon, texte altéré, faux DONE/Auth/Preview, preuve altérée |

Les logs complets autorisés et synthétiques sont versionnés dans evidence/bar-apero-350/final/. Les échecs intermédiaires sont conservés dans outputs/bar-350 ; aucun golden financier modifié pour les masquer.

### Navigateur et build

- G1 : vrai navigateur fixture, recherche unique/reprise, calendrier flèches, Date restant ciblée, homonymes et sources visibles.
- G2 : vrai navigateur fixture, largeur effective 1159 px, en-tête→60euros→Bière→Détailler : prix vide et coût à préciser après Preview. Ce n’est pas une certification aux trois largeurs desktop.
- Après G2 : outil répond « Local browser use is disabled in Work settings ». Pas de relance contournée par Playwright externe ou un navigateur utilisateur. G3/G4/G5, zoom 125, drag natif, collisions animées et focus réel : NOT_RUN_BLOCKED_ENV.
- Next local : node_modules est toujours une jonction vers p14-c4-candidate/node_modules ; le problème Turbopack et la chaîne node:crypto historique ne sont pas maquillés. Aucun nouveau PASS local déclaré et aucune retouche Analytics.
- Preview G3 : [4sx3h8j3c](https://budgetisation-4sx3h8j3c-adriensauvageot34-6137s-projects.vercel.app), dpl_29Ky4vsCJS3BQMwJeVuVeWmVEY7J, SHA 83ac6e1, **READY**, build complet, 2 min.
- Preview G5 : [candidat final](https://budgetisation-ailn1aojl-adriensauvageot34-6137s-projects.vercel.app), dpl_8eyZkEiapaEkpwe8ZfVoyJixAd5a, SHA 4e0dc25, **READY**, build Next complet 1 min. La trace de fin de build est conservée dans final/g5-preview.json ; ce fichier ne se prétend pas journal intégral.
- Auth Supabase et Google réel : NOT_RUN. Aucun environnement d’écriture isolé établi ; pas de canari sur Draft personnel.

## Propriété et données

Aucun nouveau moteur, migration, table, writer de finance ou dépendance. Changements produit limités aux fichiers Bar et à la palette/pagination avec branche conditionnelle Bar ; le travail compact Board existant est conservé. Compiler/V2, schéma Draft/RPC et relecture autoritaire Apply restent inchangés. Les tests Apply utilisent PGlite uniquement. Aucun Apply distant, Plan officiel, dépense, compte ou artifact Supabase modifié. Aucune preuve de performance réelle supplémentaire.

## Gates et décision

Voir wave-gates.md. G0 PASS limité ; G1 PARTIAL ; G2 PASS_FIXTURE_ONLY ; G3 PARTIAL ; G4 PARTIAL_BLOCKED_ENV ; G5 PARTIAL ; G6 PARTIAL_NOT_READY_FOR_REPLICATION.

La prochaine vérification utile est la réception du candidat exact dans un navigateur autorisé, suivie d’une unique traversée riche Auth isolée autorisée. Elle doit distinguer les réponses Draft et Preview pour diagnostiquer R335. Pas de nouvelle tournée d’audit, pas de reprise des198 goldens déjà identiques pour un simple test visuel. Google reste une limite owner distincte.

La PR reste Draft pour revue ; aucune intégration main ni Production effectuée.
