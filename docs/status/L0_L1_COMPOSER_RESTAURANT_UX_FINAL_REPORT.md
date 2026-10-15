# L0 + L1 — Restaurant guidé dans Composer V3

Date : 15 octobre 2026. Verdict final : **`L1_RELEASED_WITH_VALIDATION_LIMITATIONS`**.

Restaurant L1 est disponible sur [Budgetisation Production](https://budgetisation-tan.vercel.app/mois-a-venir/composer). La [PR #43](https://github.com/adriensauvageot34/Budgetisation/pull/43) est fusionnée. Production sert le commit **`3e4eaa7352b33fb094fc83ddd639c0693ef2950a`**, déploiement **`dpl_3W66NxNQYAk3BUnbQ3Um4GSt2BfC`**, `READY`. Le domaine utilisateur a été résolu vers ce même déploiement.

La sauvegarde, la reprise après rechargement, la réédition et l'archivage ont été réellement exécutés avec une session authentifiée de production, exclusivement sur un Draft de test. Une première lecture a expiré ; le Draft confirmé en base a été repris lors de la nouvelle ouverture bornée. Les timeouts Canonical restent une réserve de fiabilité distincte de L1. Aucun Apply réel n'a été exécuté.

## A. État initial et commits

Base : `d965d54713c20d3ab614e3fe730ee70af2876ea8`. Développement L1 : `322a5e13192e5670c97031ff099861281c518b9a`, correction des références de trajet et de l'en-tête : `4d85b74351c5a6d40a1d5e4f8c690260a56ca9d5`, premier rapport : `8d8a6530f4415e797397135c04fac2bdbd9c6088`. La reprise de livraison a corrigé uniquement trois scripts de tests dans `805b05038442dbe56fd2d455348ae0fb4a5fe43f`. Aucun code produit supplémentaire n'a été nécessaire pendant cette reprise.

Le merge `3e4eaa7352b33fb094fc83ddd639c0693ef2950a` contient exactement l'arbre de `805b050` (`git diff --exit-code` réussi). La branche de travail reste `codex/composer-v3-l1-restaurant` ; ce rapport et ses nouvelles preuves sont conservés sur cette branche après livraison.

## B. L0 — écarts ciblés

| Capacité | État initial | Réalisation L1 |
|---|---|---|
| Context Restaurant et slots | Existant | Réutilisation de `meal`, `extras`, `transport` et des identités. |
| Participants, lieu, date | Partiel | Questions guidées ; absence et UNKNOWN conservés. |
| Addition globale | Partiel | Une ligne partagée de quantité 1 ; les participants ne multiplient pas le montant. |
| Détail et compléments | Partiel | Composants existants ; changement de représentation confirmé et atomique. |
| Transport | Partiel | Options et éditeur publiés ; remplacement du mode incompatible. |
| Enveloppe / supplément | Existant dans le Compiler | Choix explicite, admission financière par Compiler/V2. |
| Palette conditionnelle | Manquant | Choix de configuration, compléments et autres options. |
| Réédition rapide | Manquant | Résumé des choix ; une rubrique peut être modifiée seule. |
| Draft, Undo/Redo, Preview | Existant | Même pipeline d'admission, autosauvegarde et scheduler. |
| SNAP-3 et CardKnowledge | Existant | Aucun nouveau lecteur historique ni artifact. |

## C. Parcours Restaurant livré

L'ajout affiche immédiatement la carte et ouvre son éditeur chargé à la demande. Le Restaurant reste visible lorsqu'un cluster est présent. La configuration couvre les participants, le lieu/date facultatifs, le budget, sa relation à l'enveloppe et le trajet facultatif. Fermer le panneau conserve les décisions admises dans le Draft.

Le budget global et le détail utilisent les slots existants. Le remplacement d'une représentation par l'autre retire atomiquement les lignes remplacées ; aucun total parent ne s'ajoute aux enfants. Le résumé permet de rééditer un seul champ. La palette suit la question active puis propose les compléments admissibles. Un montant CardKnowledge ne devient une décision qu'après une action explicite.

## D. Réutilisations

`PlannedContactField`, `PlannedPlaceField`, `ComponentRow` et ses adaptateurs, Library/sockets, CardKnowledge, le Draft local/durable, le scheduler, le Compiler et Finance V2 sont réutilisés. La navigation entre questions partage la logique existante de prochaine réponse manquante.

La mutation pure `EDIT_RESTAURANT` conserve le JSON accepté et `context-fields@v2`. Elle passe par le service Composer et ses contrôles de scope, références et protections. Les devis et identités de trajet compatibles sont conservés ; changer de mode écarte les coûts incompatibles. Aucun owner financier ou writer PlannedExpense n'a été créé.

## E. UX, navigateur et desktop

La fixture navigateur a couvert création, deux participants, lieu/date inconnus, 60 €, supplément, réédition à 70 €, repas 40 € et complément 20 €, sauvegarde et rechargement. Captures initiales : [Board](evidence/l0-l1-composer-restaurant/01-board-before.png), [participants](evidence/l0-l1-composer-restaurant/02-participants.png), [palette](evidence/l0-l1-composer-restaurant/03-place-palette.png), [total](evidence/l0-l1-composer-restaurant/04-budget-total.png), [composants](evidence/l0-l1-composer-restaurant/05-components.png), [résumé](evidence/l0-l1-composer-restaurant/06-reedit-summary.png), [Board configuré](evidence/l0-l1-composer-restaurant/07-board-configured.png).

Sur la vraie Preview authentifiée, création, 60 → 70 €, Undo à 60 €, Redo à 70 € et fermeture par Échap ont été exécutés. Les réponses indépendantes sont restées présentes. La simulation s'est terminée `BLOCKED` sur ce mois réel incomplet et Apply est resté désactivé, conformément à son état. [Preuve authentifiée](evidence/l0-l1-composer-restaurant/release-preview-auth.json), [capture sans données personnelles](evidence/l0-l1-composer-restaurant/release-auth-summary.png).

Les largeurs **effectives**, mesurées dans le DOM, sont 1440, 1728 et 1920 px : absence de débordement horizontal, panneau de 350 px dans le viewport et fermeture accessible. Les observations 768 et 375 px ont également été enregistrées : à 375 px la palette basse ne dispose que de 24 px. La précision utilisateur finale confirme un produit **desktop uniquement** ; cette limite mobile n'a entraîné aucun développement responsive. [Mesures réelles](evidence/l0-l1-composer-restaurant/release-viewport-checks.json).

Le premier fichier `viewport-checks.json` reste une trace historique de tentatives où toutes les largeurs effectives étaient 1728 px. Il ne sert pas à certifier les nouvelles tailles.

## F. Finance, conservation et permissions

Les 15 groupes Restaurant sur PGlite synthétique passent : intention unique pour deux personnes, 60 € globaux, 40 € + 20 € sans parent additionnel, remplacement 60 → 70 €, UNKNOWN distinct de zéro, relations couverte/supplémentaire, Restaurant enfant d'un Séjour, changement voiture → train, conservation des champs et refus des références étrangères/cartes préservées. Les manifests, scénarios et digests restent identiques pour une même intention. La parité historique **22 × 9** passe.

La lecture des anciennes révisions reste compatible. Aucune modification du Compiler, de Finance V2, de Canonical, des règles de financement ou des migrations n'a été nécessaire.

## G. Draft et Apply — preuves de production

Le mois de test n'avait pas de Draft actif au départ ; une archive antérieure était présente et a été conservée.

1. Restaurant synthétique créé avec participants/lieu/date à préciser, addition 60 €, relation `EXTRA_TO_SLOT`.
2. Le navigateur a confirmé `SAVED`. Une relecture SQL bornée a confirmé la version 2, les champs et le montant.
3. Après une première expiration de lecture, une nouvelle ouverture explicite du même mois a repris le Draft : digest sémantique **identique**, statut `SAVED`, révision officielle 0. L'éditeur a restitué les 60 € et les champs inconnus.
4. La réédition à 70 € a conservé ces champs et obtenu `SAVED`.
5. « Abandonner mes essais » a été confirmé : le seul Draft créé par ce smoke est `ABANDONED`, version 4, montant 70 € conservé. Il n'y a plus de Draft actif sur ce mois ; les deux archives (ancienne + test) sont récupérables. L'UI est revenue au Centre de contrôle du mois.
6. Révision officielle avant/après : **0**. Aucun clic Apply, aucune création de PlanRevision, aucune saisie dans les finances réelles.

[Smoke de production](evidence/l0-l1-composer-restaurant/release-production-smoke.json), [résumé Restaurant après reprise](evidence/l0-l1-composer-restaurant/release-production-summary.png). Les assertions de concurrence et Apply/CAS ont été rejouées sur fixtures ; aucun Apply authentifié réel ni nouveau test sur un deuxième appareil physique n'est revendiqué. Les tables financières réelles n'ont pas fait l'objet d'un hachage exhaustif pendant ce smoke.

## H. SNAP-3, performance et incident de lecture

Les lecteurs, publications, règles d'admission, triggers et paramètres SNAP-3 n'ont pas été modifiés. Aucune préparation ou republication n'a été déclenchée. Les données de CardKnowledge proviennent du modèle déjà disponible. La preuve d'un HIT Canonical/M7 sur le nouveau déploiement n'a pas été capturée ; elle reste `NOT_RUN`.

L'assemblage client de fixture passe de 107 726 à 101 118 octets gzip initiaux ; Restaurant est un chunk à la demande de 20 872 octets bruts. Cela ne représente ni la taille totale de Next ni un gain utilisateur certifié. Les premières observations d'ouverture ont des conditions d'initialisation différentes : aucun gain réel, P50 ou P95 nouveau n'est attribué à L1.

Un incident a été rencontré durant le smoke : GET Composer interrompu par `TimeoutError`, digest `3838116570@E394`, et deux POST Preview avec `canonical_read_error`, source `timing`, code `57014`. Cette signature Canonical est documentée avant L1. La cause précise de l'expiration du GET n'est pas prouvée par ces seuls logs. La nouvelle ouverture a réussi ; la sauvegarde était déjà durable. Aucun `statement_timeout`, index ou chemin Canonical n'a été modifié. Le bouton de rechargement de la page d'erreur avait retiré le paramètre de mois ; le mois de test a été réouvert explicitement et le mois courant n'a pas été édité. [Incident borné](evidence/l0-l1-composer-restaurant/release-reload-incident.json).

La Preview standard conserve son instrumentation de benchmark en lecture seule et son autosauvegarde inactive. La revue automatique a refusé deux propositions de Preview avec désactivation de cette garde, d'abord pour un périmètre `all`, puis même avec le compte canari car d'autres writers auraient été permis. **Aucun de ces déploiements n'a été exécuté et aucune configuration globale n'a changé.** La sauvegarde Preview reste `NOT_RUN` ; le smoke de production utilise la configuration P07 existante et l'autorisation de test Draft de cette mission.

## I. Qualification des trois échecs et tests finaux

Deux checkouts ont été utilisés : produit de base `d965d54`, et L1. Même Node 22.18.0, mêmes dépendances installées, bases PGlite synthétiques indépendantes. Les trois scripts originaux échouent de manière identique sur les deux produits. Les scripts corrigés ont ensuite été exécutés sur les deux produits, sans modifier leur code métier.

| Suite | Échec initial sur les deux versions | Correction ciblée | Résultat sur les deux |
|---|---|---|---|
| C8 | `MONTH_WRITE_FAILED` au lieu de `PLAN_V3_ACTIVE_READ_ONLY` | Fournir le runtime authentifié de fixture B3, figer la date et transmettre le digest de concurrence. Vérifier aussi le refus `STALE_PREVIEW` sans digest. Adapter la casse du libellé de date inconnue dans le contrôle suivant. | **35 contrôles PASS** |
| P11 | « tarif par nuit » absent | Vérifier les libellés B2 « Tarif par nuit » et « Date non fixée », sans modifier les assertions financières. | **21 contrôles PASS** |
| P05-B | Ancien libellé concaténé Cadeau absent | Vérifier le fait structuré Type d'objet = Livre ; pour une référence retirée, vérifier le message explicite et la clé historique conservée. | **9 contrôles PASS** |

La première correction a également révélé deux assertions de copie ultérieures obsolètes (date inconnue C8 et référence retirée P05-B), visibles dans les journaux intermédiaires ; elles ont été corrigées et rejouées sur les deux produits. Aucun calcul financier n'a été changé pour satisfaire ces tests. [Synthèse comparative](evidence/l0-l1-composer-restaurant/release-comparison-summary.json).

| Gate final | Statut | Preuve |
|---|---|---|
| Restaurant L1 | PASS synthétique | [Restaurant](evidence/l0-l1-composer-restaurant/release-final-restaurant.log) |
| Parité 22 × 9 | PASS | [Parité](evidence/l0-l1-composer-restaurant/release-final-parity.log) |
| TypeScript | PASS | [Typecheck](evidence/l0-l1-composer-restaurant/release-final-typecheck.log) |
| C8 / P11 / P05-B | PASS sur base et L1 après qualification | Fichiers `release-final-c8-*`, `release-fixed-*-p11`, `release-final-p05b-*` |
| Draft HTTP / scheduler / Apply-CAS | PASS fixtures | [Synthèse](evidence/l0-l1-composer-restaurant/release-foundations-results.json) |
| Build Next Preview et Production | PASS / READY | [Build Production](evidence/l0-l1-composer-restaurant/release-production-build.json) |
| UX authentifiée desktop | PASS ciblé | [Largeurs](evidence/l0-l1-composer-restaurant/release-viewport-checks.json) |
| Sauvegarde/reprise/réédition/archive Production | PASS après une nouvelle lecture bornée | [Smoke](evidence/l0-l1-composer-restaurant/release-production-smoke.json) |
| Apply personnel / seconde machine physique | NOT_RUN | Hors test autorisé / limite conservée |
| Performance réelle P95 / stabilité Canonical globale | NOT_CERTIFIED | Incident et conditions non comparables |

Les régressions P02, Kernel, catalogue P12, B3 et P13 exécutées pendant L1 restent dans le même dossier. Les anciens journaux FAIL sont conservés comme preuves historiques ; leur qualification comparative ci-dessus remplace le blocage initial.

## J. Livraison et rollback

PR #43 passée en Ready for Review, contrôles Vercel et Preview Comments `success`, aucune review bloquante ni workflow GitHub Actions signalé. Fusion autorisée avec HEAD attendu `805b050`, sans force push. `main` : `3e4eaa7352b33fb094fc83ddd639c0693ef2950a`, arbre identique au candidat validé.

Déploiement Production : `dpl_3W66NxNQYAk3BUnbQ3Um4GSt2BfC`, source Git `main`, Next 16.2.6, build complet et déploiement terminés, domaine utilisateur résolu vers le SHA attendu. L'authentification, le nouveau panneau, la sauvegarde et la reprise ont été réellement contrôlés sur ce domaine.

En cas de régression attribuable à L1, le rollback applicatif peut rétablir le déploiement précédent `dpl_53LsSQKsXqV1sBU6W5wVxW3ZJfHw` / `d965d54`, puis réverter le merge selon le workflow du dépôt. Les Drafts et archives conservent leurs contrats existants ; aucun rollback SQL ni suppression n'est nécessaire. Aucun rollback n'a été déclenché : aucune nouvelle régression produit L1 n'a été démontrée.

## K. Suite L2

Le patron questions guidées, palette contextuelle, résumé rééditable et mutation atomique des slots est réutilisable pour les prochains Contexts. **L2 n'a pas été commencé.**

**Verdict : `L1_RELEASED_WITH_VALIDATION_LIMITATIONS`.** Restaurant L1 est livré et le cycle Draft authentifié fonctionne. Les réserves portent sur les lectures Canonical intermittentes, les performances non certifiées et les contrôles explicitement NOT_RUN.
