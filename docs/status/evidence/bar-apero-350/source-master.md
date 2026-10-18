# CODEX — Bar / Apéro : exécution des 350 recommandations par vagues avec recette à coût maîtrisé

**Mission : implémentation réelle et clôture produit — document autonome.**  
**Référentiel : 350 recommandations R001–R350, reproduites intégralement et textuellement en annexe.**  
**Périmètre : Bar / Apéro (Composer / Board / Dock), propriétaires existants Canonical, Mobility et Finance V2 uniquement lorsque leur contrat autorise les opérations.**  
**Statut initial : à vérifier par Codex sur le dépôt et la branche à la date d’exécution ; ne pas supposer qu’un ancien SHA ou qu’un ancien rapport décrit encore HEAD.**

> **Tu es Codex, responsable du chantier de bout en bout. Exécute les vagues ci-dessous dans l’ordre de dépendance, avec une preuve au bon niveau à chaque porte. Le document est la consigne d’implémentation : il ne faut pas demander un autre prompt pour lancer chaque catégorie.**
>
> **But majeur : ne pas lancer des tests navigateur/Vercel après chaque modification ; ne pas non plus coder 350 recommandations avant la première vérification intégrée.**

## 0. Contrat de mission et invariants

1. Appliquer les **350 recommandations** intégralement, chacune avec un résultat prouvé ou un blocage explicitement documenté ; **jamais de « PASS » administratif** sur un point dont l’effet utilisateur n’a pas été vérifié au bon niveau.
2. Réutiliser l’architecture déjà en place ; ne pas refaire les moteurs Canonical, Mobility ou Finance V2, ni généraliser Bar aux autres presets. Le besoin est une **amélioration ciblée et cohérente**, pas une suringénierie.
3. Une suggestion n’est **jamais une décision retenue**. Respecter source, identité, possession, prix, unité, provenance et incertitude : `UNKNOWN ≠ MANUAL 0`, `ITEM / PERSON / SHARED`, Aller ≠ Retour, Google transitoire ≠ Canonical durable.
4. **Pas de scroll à l’intérieur de la carte ni du dock**, ni vertical ni horizontal ; le contenu doit rester accessible par composition adaptative, pages internes ou recherche, et non par occultation CSS.
5. Lieu, Date, Personnes et Montant sont **directement accessibles depuis leur représentation sur la carte** ; ne pas remettre quatre portes d’entrée redondantes dans le dock. La carte montre les décisions ; le dock propose les choix contextuels.
6. RAW, Undo, ids stables, absence de double comptage, sauvegarde durable, retour arrière et compatibilité avec le Compiler officiel sont **des invariants non négociables**.
7. Les limitations propriétaire ne se contournent jamais par de faux IDs, coordonnées, distances ou prix. Si un writer Canonical officiellement autorisé est absent, **implémenter tout le reste et classer précisément les recommandations concernées en `BLOCKED_OWNER`**.
8. Aucune fusion vers `main`, aucun déploiement Production, aucune mutation d’un Draft personnel, aucun Apply financier et aucune réplication aux autres assets sans accord explicite de l’utilisateur pour ces actions. Travailler sur une branche dédiée et livrer une PR Draft ou son équivalent selon les accès disponibles.
9. Un commit vert, un build READY et un test fixture **ne prouvent pas** une recherche Google authentifiée, une sauvegarde Supabase réelle, un comportement à zoom natif ou un trajet avec fournisseur Mobility. Toujours qualifier les preuves.
10. Ne jamais maquiller une impossibilité de tester : `NOT_RUN` accompagné de la cause exacte, des preuves alternatives et de ce qu’il reste à valider.

### 0.1 Sources et autorité

- Les **R001–R350 en annexe** sont le référentiel des besoins. Leur texte est **préservé à l’identique** depuis le regroupement du 18 octobre 2026 ; ne pas les réécrire silencieusement.
- Les 13 groupes A–M sont des **lots de propriété de code**, non des étapes utilisateur.
- Avant toute action, relire les derniers rapports de réception, les tests déjà présents et les contrats effectivement exposés dans la branche choisie ; ne pas réutiliser aveuglément le statut des anciennes PR.
- En cas de conflit entre deux interprétations de Rxxx, respecter en priorité les invariants métier ci-dessus, la formulation exacte de la recommandation et l’usage observé ; consigner l’arbitrage au lieu de prendre une décision destructrice implicite.

## 1. Pourquoi les vérifications sont placées à ces moments

### Trois étages de vérification, trois coûts distincts

| Niveau | Usage | Quand le lancer | Ce qu’il prouve |
|---|---|---|---|
| **T0 — contrôles ciblés dans le code** | tests de fonctions pures, invariants de DTO, tests React ciblés, TypeScript pertinent, scripts déjà existants | Pendant chaque vague, **une fois après un ensemble cohérent** et après une correction qui affecte le comportement vérifié | Transitions, opérations, stabilité d’identité, propriétés métier, calculs officiels aux fixtures |
| **T1 — navigateur local instrumenté** | 1 à 4 parcours représentatifs à données contrôlées, géométrie réelle, focus, absence de scroll et feedback | Après une tranche utilisable : **fin des vagues 1, 2 (courte), 3, 4 et 5**, non après chaque composant | UX observable et intégration navigateur sur la version exécutée |
| **T2 — Preview Vercel au SHA exact** | build déployé, parity serveur, routes réelles si les credentials de l’environnement sont autorisés | **Deux passages planifiés** : après l’intégration fonctionnelle (vague 3), après stabilisation (vague 5). Un déploiement conditionnel anticipé peut remplacer le premier si Google le nécessite ; tout nouveau SHA après la dernière Preview exige une nouvelle preuve finale | Application déployable et tests réellement possibles dans cet environnement |
| **T3 — navigateur authentifié/fournisseurs réels** | Supabase Draft save/reload, Google reconnu, Mobility live, cas réellement autorisés | **Une campagne ciblée en vague 6**, après stabilisation, sauf si une panne de sauvegarde bloquante apparaît au préflight | Persistance et intégrations réelles, pas seulement fixture |

**Convention importante :** T0, T1, T2, T3 sont des *niveaux de preuve*, pas quatre batteries à exécuter systématiquement ensemble. Un même test fiable peut soutenir plusieurs recommandations : lier les IDs Rxxx à la même preuve plutôt que recréer 350 scénarios distincts.

### Cadence cible

- **Jamais** de build complet, de publication Preview ou de recette navigateur à chaque commit CSS ou à chaque ajout de tuile.
- **Jamais** de passage à la vague suivante si son invariant métier bloquant échoue (sauvegarde existante, mutation erronée, couverture financière, perte de RAW, mapping de lieu mensonger).
- Au maximum **une petite session navigateur de contrôle par vague utile**, complétée d’une session géométrique approfondie en vague 4 et d’une intégration complète en vague 5/6.
- À l’intérieur d’une vague, grouper les modifications par **sous-système propriétaire** ; ne tester que les contrats touchés et leurs voisins immédiats. Les corrections issues d’un échec de porte sont retestées **sur leur scénario échoué**, sans redéployer toute l’application à chaque itération.
- Le **seul passage systématique** des suites de non-régression larges, de la parité financière globale, du `next build` et de la revue R001–R350 complète a lieu en fin de réalisation (vague 6), avec un passage plus restreint de parité au franchissement de la vague financière.

## 2. Préflight — avant de coder quoi que ce soit (G0)

**Durée et coût : courts ; objectif = éviter de développer sur une baseline invalide.**

1. Détecter le dépôt, l’état Git, les branches, le HEAD, les changements de travail non committés, la filiation des PR P1–P4 et de la dernière correction UX. Choisir une **branche isolée** à partir de la bonne base. Ne pas écraser un travail présent et ne pas rebaser une PR ouverte sans nécessité.
2. Inspecter une fois les zones réelles : `bar-living-editor.tsx`, `bar-living-card.tsx`, `bar-living-details.tsx`, `bar-place-search.tsx`, `bar-place-knowledge.ts`, `bar-living-operations.ts`, `bar-before.ts`, `context-palette.tsx`, `composer-shell.tsx`, `board-carousel.tsx`, CSS de Composer, services Canonical/Mobility, DTO et Compiler Finance V2. Les chemins ne sont **qu’indicatifs** et peuvent avoir évolué : les découvrir.
3. Lire les scripts présents dans `package.json`. À titre de pistes actuellement attestées dans le dépôt : `check:phase2-planner-composer`, `check:phase2-planner-mobility`, `check:phase2-planned-finance`, `build`, et des `scripts/check-bar-apero-*.mjs` dont l’existence **doit être revérifiée**. Ne jamais lancer un nom de script inventé.
4. Lire les incidents documentés, notamment l’ancienne réception de sauvegarde enrichie et les erreurs de timeout Canonical ; distinguer **incident ancien**, reproduction actuelle et hypothèse. Vérifier **au minimum le contrat save/read/draft en fixture** avant d'ajouter de nouveaux états. Si le Draft durable est déjà cassé sur la baseline, traiter cette panne comme un **bloqueur G0** : diagnostic ciblé et correction minimale, même si le reste de L est réservé à la vague 5.
5. Faire **un seul smoke navigateur local de départ** si un navigateur peut être lancé : carte ouverte/fermée, Date, un changement de scène et un choix de consommation. Capturer 2–3 captures et un éventuel débordement. Si l’environnement local est indisponible, le consigner ; ne pas lancer Vercel uniquement pour une capture de référence.
6. Détecter les intégrations Google/Canonical/Mobility disponibles, leurs owners, leurs credentials et les restrictions réelles sans afficher de secrets ni exploiter des données personnelles hors de ce qui est autorisé.
7. Créer le registre de suivi `docs/status/evidence/bar-apero-350/requirements.csv` (ou JSON), **prérempli automatiquement depuis R001–R350** et non reconstitué de mémoire. Colonnes obligatoires : `id`, `chantier`, `vague`, `description_originale`, `fichiers_touchés`, `statut`, `niveau_preuve`, `preuve`, `sha_preuve`, `blocage`, `retouche_necessaire`.
8. Ajouter un contrôle automatique d’intégrité : **350 IDs distincts, R001–R350 complets, exactement un chantier, exactement une vague, texte égal à la source**. L’échec bloque toute prétention de clôture ; il ne nécessite pas de navigateur.
9. Préparer quelques fixtures **minimales et représentatives**, notamment : carte vide, une Bière, Before enrichi, montant global remplacé, Google connu/nouveau, origine Maison connue, trajet aller voiture/retour taxi, sauvegarde rejetée. Réutiliser les fixtures existantes si elles couvrent déjà le besoin.

**Sortie G0** : baseline reproductible, registre 350/350, map fichier → chantier, script(s) de vérification exact(s) et risques externes identifiés. **Ne pas consommer de nouvelle Preview** pour les points déjà démontrés par le code.

## 3. Ordre de travail — six vagues, pas treize micro-projets

La répartition des recommandations **reste identique à celle du fichier regroupé**. Chaque groupe a une *vague propriétaire* unique ; une interface partagée peut être stabilisée lors d’une autre vague sans transférer l’ownership ni oublier l’ID.

| Vague | Groupes propriétaires | Rxxx à traiter | Type de code principalement travaillé | Contrôle de fin |
|---|---|---:|---|---|
| **1** | **A + B + C** | **69** | logique de scène / ciblage / lieux / Google / date / participants | **G1** tests d’état + petit smoke local |
| **2** | **D + E** | **69** | éditeur de consommation/Before + finance de couverture | **G2** tests métier + Compiler + mini-recette d’édition |
| **3** | **F + G** | **73** | Mobility, endpoints, décisions et hiérarchie du dock | **G3** première recette fonctionnelle complète + Preview de mi-parcours |
| **4** | **H + I + J** | **89** | composants visuels carte ouverte/fermée, miniatures, compacité et style | **G4** vraie revue de géométrie/UX en navigateur local |
| **5** | **K + L** | **40** | Board, collisions, suppression, async, performance ciblée, sauvegarde | **G5** épreuve intégrée et Preview finale candidate |
| **6** | **M** | **10** | tests d’acceptation, accès réels autorisés, traçabilité et bilan | **G6** verdict vérifiable pour les 350 recommandations |
| | **TOTAL** | **350** | | |

### Discipline de modification : éviter de rouvrir dix fois les mêmes fichiers

- **Avant G1**, définir les signatures et contrats de scène/ciblage dont auront besoin D/E/F/G ; ne pas encore écrire toutes les suggestions. Isoler si nécessaire les règles déterministes dans des fonctions testables plutôt que dans un JSX monolithique.
- **Vague 1** possède les règles de scène et les surfaces Lieu/Date/Personnes ; **vague 2** possède les opérations économiques et la tuilerie comportementale ; **vague 3** possède la politique de suggestions et les trajets ; **vague 4** possède la composition visuelle ; **vague 5** possède le packing Board et le feedback durable. Ne pas procéder par « un Rxxx = un commit + un test navigateur ».
- Quand plusieurs recommandations ciblent le même fichier, les implémenter **dans le même passage d'édition de ce sous-système**. Des passages ultérieurs sur `bar-living-editor.tsx` peuvent être légitimes pour intégrer des fonctions nouvelles ; limiter les réouvertures à l’intégration et aux regressions avérées.
- Chaque vague conserve un **journal de modifications par propriétaire** et un registre de changement transversal. Un changement tardif d’API sur les vagues déjà closes demande le retest de la **frontière** concernée, non de toutes les anciennes scènes.
- **Pas de nettoyage ou de refactoring décoratif** de fichiers adjacents « pendant qu’on y est ».
- Identifier clairement les dépendances **B→F**, **D↔E**, **A→G**, **F→G**, **H/I/J→K** et **tous→L/M**. Ne pas « achever » une recommandation dépendante avant la preuve de son propriétaire.

## 4. Vague 1 — A + B + C : décider et cibler au bon endroit (69 R)

**Coder ensemble** : l’architecture des scènes, la capsule Lieu, la recherche locale/Google, la fiche de résultat et l’état date/contacts. Préparer les points d’entrée de la carte sans encore polir toutes les tuiles ni construire la stratégie finale de suggestions (vague 3).

**Exigences fonctionnelles spécifiques :**
- Interactions directes carte→Lieu, carte→Date, carte→Personnes ; éviter les portes redondantes. Scène immédiatement pertinente, pas de « retour au résumé » sur clic dans le vide. « Plus tard » ne part jamais automatiquement vers Boissons. Date sélectionnée ne force pas une autre scène.
- Une seule source de vérité des termes recherchés/ville/page, qui reste cohérente si l’utilisateur passe de la carte au dock puis revient ; pas de réponse Google obsolète acceptée.
- Séparer découverte Google, correspondance Canonical et admission durable du lieu. Autoriser les vrais propriétaires, bloquer honnêtement l’absence d’owner. Comparer le même établissement avec « Déclarer une dépense » **dès que des données fournisseur sont disponibles**.
- Date dans le premier espace visible, sélection directe et clavier ; contacts sélectionnés vs proposés, pas d’addition silencieuse de participants.

**G1 — vérifier une fois la tranche complète :**
1. T0 : tests ciblés de transition scène (Date→admission, Plus tard→neutre, clic vide, retour et recherche conservée), suggestion de contact, séparation Google connu/nouveau, requête obsolète ; lint/types si pertinents.
2. T1 local : **deux mini-parcours** seulement : `ouvrir Lieu → rechercher → revenir` et `ouvrir Date → sélectionner → rouvrir` ; contrôler focus et cible visible. Vérifier une collision grave si observée.
3. **Pas de déploiement Vercel systématique à G1**. **Exception contrôlée** : si Google ne peut pas être testé localement, et que son résultat conditionne tout F, faire un seul déploiement de diagnostic ou utiliser une Preview existante au **SHA exact de cette branche**. Le considérer comme l’un des passages Vercel prévus ; ne pas le répéter par réflexe.
4. Dans le registre : 69 R évaluées (DONE ciblé, PARTIAL, BLOCKED_OWNER…) ; les autres marquées `PLANNED`, jamais `DONE` par anticipation.

**Porte G1** : pas de transition forcée, aucune identité géographique mensongère, navigation contexte réversible. Si l’owner Google manque : ne pas bloquer toute la suite ; ouvrir un blocage circonscrit avec repli fonctionnel et limites Mobility explicites.

## 5. Vague 2 — D + E : économie et composants, traités ensemble (69 R)

**Coder ensemble** : création/édition des objets du Before et du Bar, unités ITEM/PERSON/SHARED, RAW, identité d’objet, quantité/prix, représentation du montant officiel et substitutivité montant regroupé↔détail. L’économie et ses tuiles doivent être traitées **en une seule campagne**, pas dans deux chantiers indépendants.

**Exigences fonctionnelles spécifiques :**
- La Bière déjà présente ne doit pas être confondue avec « Nouvelle Bière ». Ne pas transformer toute première bière/snack de Before en lot SHARED sans contrat légitime.
- Le montant de l’en-tête, lorsqu’il correspond à une estimation regroupée éditable, devient son point d’entrée. Si le total provient déjà des lignes, une modification doit déclencher une **conversion explicitement substitutive**, et non ajouter un nouveau coût direct.
- Montant regroupé 60 € → « détailler à la place » → nouveaux postes sans prix : l’ancien 60 € cesse de contribuer, mais **le résultat doit rester incomplet/UNKNOWN**, jamais une soirée prétendument à 0 € ; Undo restitue le montant et les identités antérieures.
- Ne pas toucher aux trajets ni aux coûts indépendants lors de cette substitution ; préserver le Compiler Finance V2 comme autorité du coût.
- Éditer une tuile sans effacer RAW sur un clic dans le vide, un changement de scène ou un retrait de Before ; ne pas multiplier un lot SHARED selon les personnes présentes.

**G2 — vérifier après le bloc métier entier :**
1. T0 : tests d’opérations de composants, identités, bases économiques, couverture global/détail, RAW/Undo et non-double comptage. Réutiliser une suite Finance V2 existante ; **faire ici un premier contrôle de parité financière**, pas une campagne navigateur complète.
2. T1 local : **deux tests courts** : (a) Bière → prix → quantité → repli/réouverture ; (b) montant global → conversion au détail → UNKNOWN → Undo. Si un scénario est déjà couvert et visible à G1, ne pas le rejouer inutilement.
3. Pas de nouveau Vercel tant qu’aucun contrat serveur externe ni migration n’exige de vraie validation déployée.
4. Rendre visible la preuve que `UNKNOWN`, `MANUAL 0`, `QUOTE` et estimation officielle ne sont pas confondus.

**Porte G2** : aucun double comptage, aucune perte RAW, identité durable d’un enfant et pas de coût indépendant involontaire. Un échec bloque le passage à la vague mobilité.

## 6. Vague 3 — F + G : trajets et dock décisionnel final (73 R)

**Coder ensemble** : Aller/Retour, endpoints, véhicule, prix légitime, raccourcis de trajet inverse et **politique complète du dock**. C’est à ce stade que les choix Before/Boissons/Montant/Lieu/Date déjà disponibles se raccordent **dans une seule passe de hiérarchisation du dock**.

**Exigences fonctionnelles spécifiques :**
- Modèle de proposition `CHOISIR / COMPLÉTER / SUITE` fondé sur rôle de la cible, réponses déjà retenues, endpoints manquants, admissibilité, preuve de Maison, et statut RAW.
- Ne plus mettre la destination d’Aller devant Maison comme origine de ce même Aller. Pas de 28 pages de lieux en guise d’action principale : quelques bons candidats et vraie recherche « Autre lieu ».
- Après le choix de Voiture, proposer **le point manquant**, pas le même catalogue de modes. Retour : `trajet inverse`, `même mode`, `autre retour` représentent trois décisions distinctes et explicites.
- Aucun endpoint, véhicule, coût et participant n’est copié ou choisi silencieusement. Le champ TEXT doit rester non routable ; les clés Google ne deviennent pas Canonical par magie.
- Réduire le dock si aucune proposition n’est utile. La Date et les montants éditables directement dans la carte ne doivent pas avoir de doublons de porte dans le dock. Distinguer « ajouter une autre consommation » de « modifier l’existante ».
- Tous les choix avancés restent trouvables ; l’UX compacte ne doit pas supprimer financements/arrêts/variantes légitimes.

**G3 — première réception intégrée obligatoire :**
1. T0 : tables de décision du dock (source→choix→effet→suite), tests de rôles de lieux et véhicules, pas d’auto-confirmation, coût Aller/Retour indépendants, retour taxi après voiture, préférences contextuelles non inventées. Tests des **211 recommandations affectées aux vagues 1–3** par couverture ciblée, pas 211 scripts individuels.
2. T1 local : **quatre parcours courts assemblés** sur le même jeu de fixtures : `Lieu → date`, `Before Vodka → proposition diluant`, `Aller Voiture → origine Maison explicite`, `Retour trajet inverse puis autre mode`. Vérifier également le passage carte↔dock et le retour de cible.
3. T2 : **première Preview Vercel sur le SHA final de la vague 3** si nécessaire pour tester l’intégration serveur, la comparaison Google ou des routes indisponibles localement. Si une Preview a été consommée à G1, **réutiliser une Preview compatible uniquement si elle correspond encore au SHA testé** ; sinon autoriser un second passage justifié en expliquant sa valeur, sans déployer quotidiennement. Ne déclarer Google/Mobility réels testés que si la route et l’auth réellement requises étaient accessibles.
4. Vérifier le registre : **211 recommandations affectées** (69+69+73) avec statut et preuve propres, pas « 211 PASS » supposés.

**Porte G3** : les parcours importants fonctionnent ensemble, les suggestions suivent la décision manquante et le résultat utilisateur ne ment pas sur les capacités Google/Mobility. Si les fournisseurs sont inaccessibles, distinguer blocage externe et logique interne validée, puis poursuivre dans ce périmètre.

## 7. Vague 4 — H + I + J : une seule campagne de composition et de design (89 R)

**Coder ensemble** : carte ouverte, carte fermée, illustrations, iconographie, surfaces d’édition, CSS et tokens graphiques. C’est **maintenant** que l’on fait la passe UI massive, sur des comportements stabilisés en G3. Ne pas refaire les mêmes tuiles en trois vagues séparées.

**Exigences de composition spécifiques :**
- **Ouvert** : scène pertinente immédiatement visible, en-tête compact, métadonnées sur une bande horizontale lorsque c’est possible, `+ Déplacement` à droite, titre de section et `+ Ajouter` sur une ligne, prix et stepper alignés. Aucun texte technique permanent, aucune ligne entière pour un bouton mineur.
- **Fermé** : vraies miniatures de Before et Au bar, montants officiels correctement qualifiés, trajets indépendants, contacts, groupes visibles, pas de bande « Retirer ce moment ». Trois variantes déterministes `VIDE / PARTIEL / RICHE`.
- **Art** : identité stable Bar/Apéro ; illustration d’ambiance contenue dans une zone dédiée + fond tonal discret ; ne pas générer une nouvelle image à chaque sélection. Priorité aux miniatures réelles ; fallback homogène, aucun emoji natif comme unique iconographie finale. Réutiliser les assets existants ; n’ajouter des illustrations nouvelles que si les moyens autorisés les rendent réellement disponibles, sans bloquer la fonctionnalité.
- **Sans scroll** : aucun conteneur interne ne gagne du `overflow:auto` pour résoudre une surcharge ; pagination ou refonte locale. Sur mobile, conserver des commandes tactiles lisibles et des polices confortables.

**G4 — vérifier une fois après stabilisation de la composition (pas à chaque CSS) :**
1. T0 : vérifications des conditions et modèles de rendu (`VIDE/PARTIEL/RICHE`, classement Before/Au bar, descriptions monétaires officielles, `+N`, menus accessibles).
2. T1 navigateur : **une session de revue visuelle structurée**, avec les **six écrans témoins** : carte vide ouverte, carte riche fermée, Bière en édition, Before riche, Date, trajets Aller/Retour ; mesurer à **deux largeurs desktop** et **zoom 125 %** ; ajouter un écran étroit pertinent si l’app est utilisée dans cette configuration.
3. À chaque écran : capture, `scrollHeight/clientHeight`, `scrollWidth/clientWidth`, rects de la cible/du dock, focus, absence de masque par les cartes voisines. Une **petite boucle corrective UI** est autorisée puis refaire **uniquement les témoins touchés**, pas les six à chaque marge changée.
4. Ne pas déployer Vercel pour chaque retouche visuelle. Les images illustratives fournissent une preuve visuelle de composition, mais pas une preuve de source Canonical ni de persistance.

**Porte G4** : la carte éditée tient sans scroll interne, les objets ne sont pas cachés, les cartes fermées sont riches et lisibles et l’identité visuelle est cohérente. Les collisions globales de Board sont définitivement traitées à la vague 5 ; **une collision bloquante observée à G4 doit toutefois être enregistrée et neutralisée sans attendre la livraison finale**.

## 8. Vague 5 — K + L : géométrie du Board et temps de réponse (40 R)

**Coder ensemble** : layout Board, réservation de hauteur, interactions cartes voisines, drag/corbeille, suppression avec feedback immédiat, états async Preview/Draft, reprise sur erreur, lisibilité de statut et optimisations **seulement si mesurées**.

**Exigences spécifiques :**
- Préserver la composition réalisée en G4 : aucune carte voisine ne doit recouvrir Bar ni pendant une animation ni après stabilisation ; aucune action n’est masquée et la pagination reste atteignable.
- Utiliser des mesures réelles de hauteur et de stabilité : limiter les repackings inutiles **seulement si** les traces montrent qu’ils sont excessifs. Ne pas déclencher un grand chantier React ou serveur pour une hypothèse non reproduite.
- Suppression : feedback visuel rapide, état **pending** honnête, confirmation/rollback si refus, Undo fiable, sans indiquer `SAVED` tant que le serveur n’a pas confirmé.
- Distinguer local, Preview, `SAVED` et `FRESH` ; conserver le RAW et un mécanisme de reprise ciblé après échec Draft, sans réessai ambigu dupliquant une opération.
- La sauvegarde riche complète identifiée comme fragile dans les anciennes réceptions reste un **risque P0** : les tests ciblés G0/G5 doivent en établir le statut réel ; toute panne reproduite est corrigée à son propriétaire, pas maquillée par un loader permanent.

**G5 — vérifier la tranche intégrée stabilisée :**
1. T0 : tests de rollback, idempotence, persistance fixture, supprimé/undo, non-perte RAW, performance mesurée seulement sur le scénario reproduit. Rejouer les tests de la frontière UI/Mobility/Finance impactée par un changement L, pas tout le dépôt.
2. T1 : **une session navigateur intégrée** pour (a) carte ouverte/réorganisations multiples, (b) retrait d’une carte riche + refus + Undo, (c) saisie rapide prix + navigation + retour, (d) parcours social + Before + Aller/Retour ; mesurer temps geste→feedback vs réponse serveur.
3. Vérifier réellement les collisions et le placement avec animation et après stabilisation, aux largeurs problématiques. Pas de simulation qui écrase les données personnelles de l’utilisateur.
4. T2 : **Preview candidate finale** sur SHA explicite une fois G5 stable. Faire `npm run build` complet **une fois** pour ce candidat (et le refaire seulement si un patch ultérieur invalide ce SHA). Attendre READY et vérifier les routes explicitement autorisées.
5. Si la Preview est inutilisable pour Auth/fournisseurs, conserver `NOT_RUN_EXTERNAL` et ses raisons : un build Vercel READY ne valide pas les trajets réels ni Supabase.

**Porte G5** : plus de collision visible, aucun scroll interne, suppression percevablement réactive et honnête, pas de perte RAW, candidat final déployable. Si la sauvegarde riche réelle échoue encore, **pas de « READY pour réplication »** même si les captures sont parfaites.

## 9. Vague 6 — M : recette finale sans campagne inutile de 350 tests navigateur (10 R)

**Objectif : clôturer le registre R001–R350 avec des preuves suffisantes ; pas ouvrir un chantier supplémentaire de réécriture.**

1. Lancer **une fois sur le SHA final** les suites larges pertinentes (tests Composer/Bar, Mobility ciblée, couverture économique/Finance V2, TypeScript, build). Utiliser les scripts existants, signaler leurs noms et résultats ; ne pas revendiquer par défaut `198/198` tant que la parité n’a pas été effectivement rejouée sur ce SHA.
2. Faire **un dernier parcours bout-en-bout sur le navigateur candidat** : `Bar → Lieu → Date → Personnes → Before → Consommations → montant global/détail → Aller → Retour → replier → rouvrir → enregistrer → recharger`. Inclure une vérification RAW/Undo et les états financiers officiels. **Ne pas rejouer indépendamment toutes les sous-scènes déjà prouvées** sauf échec récent.
3. Réaliser un **test authentifié isolé** Supabase/Google/Mobility **uniquement dans l’environnement disponible et explicitement autorisé**, sur un Draft de test nouveau ; pas de mutation de Draft personnel, pas d’Apply et pas de Production sans accord. Vérifier création, sauvegarde, réouverture et identité exacte des composants, ou classer honnêtement les étapes `NOT_RUN_AUTH`/`BLOCKED_OWNER`.
4. Vérifier les invariants visuels de référence à un jeu minimal de largeurs représentatives et zoom 125 %, sans réouvrir 350 navigateurs : zéro scroll interne masqué, zéro collision, commandes accessibles, bon focus et dock pertinent.
5. Vérifier que chaque recommandation dispose d’une **preuve traçable au niveau adéquat**, puis que la somme des statuts fait exactement 350. Une preuve peut couvrir plusieurs R, mais doit être pertinente pour chacun.
6. Vérifier qu’aucun `DONE_STATIC` n’a été présenté comme `DONE_BROWSER`, qu’une Preview READY n’est pas confondue avec Auth et qu’un `BLOCKED_OWNER` n’est pas transformé en PASS.
7. Produire un **rapport final court en tête et détaillé en annexes**, une PR Draft avec SHA, Preview exacte, table de 350 statuts, points bloqués, preuves et changements réellement apportés, plus un avis explicite : `PRÊT POUR REVUE HUMAINE`, `PRÊT POUR RÉPLICATION` (uniquement si réellement justifié) ou `NON PRÊT`.
8. Arrêter le chantier : aucune fusion, aucun déploiement Production, aucune duplication vers d’autres presets sans décision humaine.

### Format du registre R001–R350

Statuts distincts : `PLANNED`, `IN_PROGRESS`, `DONE_STATIC`, `DONE_BROWSER_FIXTURE`, `DONE_PREVIEW`, `DONE_AUTH_REAL`, `PARTIAL`, `BLOCKED_OWNER`, `BLOCKED_ENV`, `NOT_RUN`, `DEFERRED_USER`, `REGRESSION`.

- `DONE_STATIC` = code/test ciblé probant, pas une affirmation de bonne UX réelle.
- `DONE_BROWSER_FIXTURE` = comportement UI constaté en navigateur local contrôlé.
- `DONE_PREVIEW` = comportement constaté sur une URL Preview liée à un SHA, pas nécessairement authentifié.
- `DONE_AUTH_REAL` = parcours réellement authentifié et persistance confirmée.
- `PARTIAL` = seule une partie du R est satisfaite ; lister précisément le reste.
- `BLOCKED_OWNER` = capacité propriétaire manquante et démontrée ; définir le repli et le responsable.
- `BLOCKED_ENV` / `NOT_RUN` = test non exécuté avec justification et alternative.
- `DEFERRED_USER` = arbitrage explicitement demandé à l’utilisateur, jamais un abandon silencieux.
- `REGRESSION` = succès d’une vague ultérieure annulant une garantie déjà admise : bloque la clôture.

**Ne pas forcer toutes les recommandations à avoir le même niveau de preuve** : les détails iconographiques peuvent être démontrés par capture, le rôle des endpoints par contrat métier, la vraie persistance par Auth et les montants Finance par le Compiler.

## 10. Pilotage quotidien : contrôles, budget, arrêts

### Sorties attendues **à chaque porte** (G0 → G6)

Tenir le journal de bord de façon **compacte** :

```text
Gx | SHA | catégories touchées | R traitées / R totales
Tests T0 (noms exacts et PASS/FAIL) | T1 (scénarios + captures ou NOT_RUN)
T2 (Preview SHA / NOT_NEEDED / NOT_RUN) | T3 (Auth/provider / NOT_RUN)
Blocages factuels | Régressions détectées | Retouches restantes
Décision: CONTINUER / CORRIGER_CETTE_VAGUE / STOP_OWNER
```

**Ne pas rédiger un rapport de dix pages à chaque petite correction.** Les preuves brutes (logs, captures, traces, diff et hashes) sont conservées ; le rapport consolidé est rédigé en G6. La table R001–R350 évolue en continu.

### Règle de répétition des tests

- Changement d’un libellé ou d’un style **sans impact de logique** : capture/témoin ciblé à la prochaine session UI ; pas de suite Finance, pas de Vercel.
- Changement de sélection/ranking du dock : tests de table de décision de la cible concernée ; un navigateur à la porte suivante.
- Changement d’opération Before/prix/global : tests métier + RAW/Undo + couverture financière ; pas de full build immédiat.
- Changement de Google/CANONICAL : tests identités et stale result ; fournisseur réel **une fois** si nécessaire et disponible.
- Changement Mobility : tests Aller/Retour, endpoints, coûts, droits ; pas de tous les scénarios de tenue graphique.
- Changement layout/Board : navigateur avec rects, scroll metrics et collisions ; pas de parité Finance si domaine inchangé.
- Changement save/async : test refus/timeout/idempotence + une persistance candidate quand autorisée ; pas de 350 actions manuelles.
- Toute correction faite **après la dernière Preview** : nouveau SHA → preuve Preview/Build à refaire sur ce nouveau SHA avant toute affirmation finale relative à Vercel.

### Arrêts impératifs et exceptions

- **Arrêt local immédiat** sur perte RAW, mutation du mauvais enfant, copie du prix Aller→Retour, double comptage, suppression non réversible annoncée comme réussie, ou défaut de provenance Canonical : corriger et retester cette cause **avant** de poursuivre.
- **Escalade `BLOCKED_OWNER`** si l’admission Google durable exige un writer ou un droit absent : ne pas implémenter de writer parallèle ; poursuivre les fonctionnalités indépendantes et exposer clairement la frontière.
- **Environnement navigateur indisponible** : ne pas multiplier les tentatives identiques ; faire T0, laisser T1/3 NOT_RUN, et ne pas prétendre satisfaire un gate visuel sans preuve. Proposer le plus petit protocole à exécuter ensuite.
- **Sauvegarde Auth refusée ou timeout** : ne pas insister sur un Draft personnel ; arrêter l’auth, conserver preuves/logs expurgés et diagnostiquer le chemin autorisé.
- **Écart produit arbitré** : si certaines R ne peuvent être réalisées sans casser un owner ou sans généraliser d'autres assets, présenter une option réaliste ou demander l'arbitrage utilisateur ; ne pas sortir « 350/350 PASS » par commodité.

## 11. Livraison finale demandée

1. Une branche/PR Draft au **SHA réellement testé**, code complet, pas uniquement des notes.
2. Un rapport `docs/status/BAR_APERO_350_FINAL_RECEPTION.md` avec résumé clair, livraisons de chaque vague, compromis, preuves T0–T3 et statut par recommandation.
3. Le registre R001–R350 sous forme machine-lisible, vérifiable automatiquement (exactement 350 lignes/objets distincts et textes inchangés).
4. Un manifeste des scénarios minimaux exécutés, leurs SHA, logs et captures ; préciser local/fixture/Preview/Auth/provider.
5. Une comparaison courte avant/après pour les principales interactions : date sans scène arbitraire, montant global→détails, dock après Voiture, Maison pertinente, Before éditable, carte fermée illustrative, zéro scroll interne, suppression et sauvegarde.
6. Un bilan des limites Canonical/Google, coût d’usage vs cash, risques serveur et points non vérifiés.
7. Une recommandation argumentée de **revue humaine** et une phrase sans ambiguïté sur la réplication : **pas de réplication automatique**.

---

# ANNEXE — Référentiel des 350 recommandations, classées par propriétaire de code

Cette annexe est reprise **sans modification des formulations ni des identifiants** du document `BAR_APERO_350_RECOMMANDATIONS_PAR_CHANTIERS_CODEX_2026-10-18(1).md`. Elle fait foi pour la couverture. Les chantiers A–M sont affectés aux vagues comme suit : A/B/C→1 ; D/E→2 ; F/G→3 ; H/I/J→4 ; K/L→5 ; M→6.

## A. Pilotage des scènes, ciblage et navigation dans la carte — 20 recommandations

*Zone de travail indicative : `bar-living-editor.tsx` · état des scènes · mutations déclenchées depuis la carte.*

- **R001** — Faire de la carte Bar / Apéro l'interface principale de consultation et de modification.
- **R012** — Ne pas présenter le lieu, la date et les participants comme des objets économiques.
- **R013** — Supprimer les écrans intermédiaires qui ne servent qu'à rejoindre une commande déjà présente dans la carte.
- **R014** — Ne pas imposer d'ordre obligatoire de composition de la soirée.
- **R015** — Préserver un accès direct à chaque partie de la soirée depuis sa représentation sur la carte.
- **R016** — Garder une page de synthèse générale distincte des scènes d'édition ciblées.
- **R017** — N'afficher sur une scène que le contenu pertinent pour l'action active.
- **R018** — Placer systématiquement la cible éditée dans la première zone visible de la carte.
- **R019** — Garder l'en-tête de la carte stable lors des changements de scène.
- **R020** — Utiliser un retour discret vers la sortie uniquement lorsqu'une sous-page en a besoin.
- **R021** — Ne pas répéter une action « Ma sortie » à la fois dans la carte et dans le dock.
- **R022** — Faire d'un clic dans le vide de la carte une action neutre, sans retour forcé au résumé.
- **R164** — Ne pas imposer « Boissons » comme destination générique de « Plus tard ».
- **R165** — Faire revenir « Plus tard » à un état neutre adapté à la décision ajournée.
- **R166** — Ne pas ouvrir automatiquement Boissons après la sélection d'une date.
- **R167** — Ne pas ouvrir automatiquement Boissons après l'admission d'un montant direct.
- **R168** — Supprimer les choix du dock qui renvoient exactement à la page déjà active.
- **R169** — Conserver la recherche et la pagination transitoires lorsqu'on revient au même travail interrompu.
- **R170** — Réinitialiser une recherche seulement si sa cible a changé ou si l'utilisateur l'efface.
- **R172** — Préserver l'identité de l'objet ciblé quand on passe de la carte au dock puis à la carte.

---

## B. Lieux, recherche Google et identité Canonical — 27 recommandations

*Zone de travail indicative : `bar-place-search.tsx` · `bar-place-knowledge.ts` · raccordement propriétaire des lieux.*

- **R002** — Rendre le lieu directement modifiable en cliquant sur sa capsule dans la carte.
- **R143** — Respecter la recherche textuelle active dans toutes les propositions de lieux.
- **R151** — Ne pas reproduire une recherche de lieu simultanément dans la carte et dans le dock.
- **R171** — Éviter qu'un résultat Google ancien reste sélectionnable après un changement de recherche ou de ville.
- **R192** — Proposer une recherche de bar unifiée exploitant les lieux enregistrés et Google lorsque les capacités le permettent.
- **R193** — S'inspirer des composants de recherche déjà éprouvés dans « Déclarer une dépense ».
- **R194** — Afficher la ville de recherche comme un contexte visible et modifiable, non comme un filtre caché.
- **R195** — Autoriser une recherche plus large sans contrainte de ville.
- **R196** — Ne pas donner à « Chercher ailleurs » une taille et une priorité supérieures aux résultats utiles.
- **R197** — Distinguer « Déjà fréquenté », « Enregistré » et « Google Maps » avec une provenance vérifiable.
- **R198** — Présenter les résultats connus les plus pertinents avant les autres lieux.
- **R199** — Afficher nom, commune et adresse courte pour départager les homonymes.
- **R200** — Rechercher également par adresse lorsque la recherche vise des endpoints.
- **R201** — Normaliser les recherches pertinentes pour les accents et variantes de casse.
- **R202** — Conserver les cafés-bars pertinents même s'ils sont catégorisés café ou restaurant par Google.
- **R203** — Prévoir des résultats ou des replis utiles lorsque la recherche Google échoue ou ne répond pas.
- **R204** — Conserver un retry ciblé après une erreur Google sans effacer le travail en cours.
- **R205** — Quand un résultat Google est sélectionné, présenter une fiche de lieu claire plutôt qu'une simple ligne.
- **R206** — Ne pas afficher en parallèle un second catalogue de recherche pendant qu'une fiche Google est ouverte.
- **R207** — Faire disparaître le formulaire de recherche principal après admission du lieu choisi.
- **R208** — Ne pas présenter « Retenir comme nom libre » comme l'issue normale d'un établissement Google reconnu.
- **R209** — Permettre à un établissement Google nouveau d'acquérir une identité durable exploitable uniquement via le propriétaire officiel autorisé.
- **R210** — Préserver une correspondance Canonical exacte lorsque le googlePlaceId existe déjà.
- **R211** — Ne jamais inventer un lieu KNOWN, une coordonnée admise ou une distance routable.
- **R212** — Indiquer brièvement quand un lieu reste textuel et ne permet pas encore de calculer un trajet.
- **R213** — Permettre de changer de bar sans réécrire automatiquement les endpoints personnalisés des trajets existants.
- **R214** — Proposer l'adaptation des trajets après changement de lieu seulement lorsqu'un lien autorisé est prouvé.

---

## C. Métadonnées Date et Personnes — 22 recommandations

*Zone de travail indicative : calendrier · contacts · capsules de métadonnées · édition ciblée.*

- **R003** — Rendre la date directement modifiable en cliquant sur sa capsule dans la carte.
- **R004** — Rendre les participants directement modifiables en cliquant sur leurs pastilles dans la carte.
- **R011** — Conserver des capsules explicites « + Lieu », « + Date » et « + Personnes » lorsque ces valeurs sont absentes.
- **R173** — Faire apparaître immédiatement le calendrier en cliquant sur la date.
- **R174** — Afficher le calendrier dans le premier tiers visible de la carte.
- **R175** — Dimensionner le calendrier en fonction de la largeur disponible sans l'étirer artificiellement.
- **R176** — Mettre nettement en évidence le jour sélectionné.
- **R177** — Sélectionner une date par un seul clic lorsque sa valeur est admissible.
- **R178** — Afficher la date retenue dans l'en-tête après validation.
- **R179** — Placer « Retirer la date » dans la scène Date et non dans le dock générique.
- **R180** — Gérer les jours hors du mois uniquement lorsque le contrat de planification l'autorise.
- **R181** — Rendre le calendrier navigable au clavier avec un modèle cohérent de navigation par flèches.
- **R182** — Éviter d'imposer 31 appuis sur Tab pour choisir un jour.
- **R183** — Éviter les interactions concurrentes entre les flèches clavier du calendrier, du dock et du Board.
- **R184** — Proposer en premier les participants du foyer ou contacts pertinents réellement connus.
- **R185** — Différencier clairement les participants déjà retenus des contacts simplement suggérés.
- **R186** — Permettre de rechercher les autres contacts sans parcourir un catalogue interminable.
- **R187** — Afficher les participants sélectionnés dans une rangée claire sur leur scène dédiée.
- **R188** — Permettre de retirer un participant depuis sa pastille si l'opération est sans risque particulier.
- **R189** — Conserver la possibilité d'ajouter un prénom libre sans lui attribuer une fausse identité de contact.
- **R190** — Ne jamais ajouter automatiquement un contact parce qu'il accompagne souvent l'utilisateur.
- **R191** — Ne jamais déduire un nombre de consommations ou une répartition financière du seul nombre de participants.

---

## D. Before et consommations : création, édition et unités — 43 recommandations

*Zone de travail indicative : `bar-before.ts` · tuiles de consommation · sous-éditeur de poste.*

- **R007** — Rendre chaque consommation directement modifiable en cliquant sur sa tuile.
- **R008** — Rendre chaque composant du Before directement modifiable en cliquant sur sa tuile.
- **R035** — Afficher une consommation au repos avec son identité, sa quantité, son prix et son unité pertinente.
- **R036** — Afficher les commandes de quantité et de prix seulement lorsque la consommation est sélectionnée.
- **R037** — Afficher les paramètres avancés d'une consommation uniquement sur demande.
- **R038** — Limiter les boutons visibles en permanence sur les tuiles d'édition.
- **R047** — Présenter les contrôles d'une consommation sur une disposition horizontale quand la carte est large.
- **R048** — Placer le stepper de quantité et le champ de prix sur une même ligne quand c'est possible.
- **R049** — Supprimer le grand libellé « Quantité totale » lorsque le stepper est suffisamment intelligible.
- **R050** — Remplacer le libellé surdimensionné « Prix unitaire (€) » par une indication courte proche du prix.
- **R051** — Permettre l'édition du prix directement à son emplacement dans la tuile.
- **R052** — Permettre la modification de quantité par un stepper « − quantité + » immédiatement compréhensible.
- **R053** — Ne pas ouvrir de formulaire séparé pour une simple modification de prix ou de quantité.
- **R071** — Paginer les grands ensembles de consommations et de composants du Before.
- **R215** — Séparer le Before des consommations faites au bar dans le modèle d'édition et dans l'affichage.
- **R216** — Permettre d'ajouter et d'éditer individuellement les composants du Before.
- **R217** — Afficher bouteille, diluant, soft et snacks comme une composition commune lorsque présents.
- **R218** — Proposer un Before vide avec des familles d'objets clairement reconnaissables.
- **R219** — Lorsque Vodka a été retenue, suggérer diluant, soft et snacks avant de réciter le catalogue complet.
- **R220** — Adapter les compléments proposés au contenu réellement présent du Before.
- **R221** — Conserver un accès explicite au catalogue complet du Before sur demande.
- **R222** — Ne pas créer automatiquement une quantité, un prix ou un achat lorsqu'on suggère un complément.
- **R223** — Ne pas attribuer automatiquement la base SHARED à n'importe quel premier composant du Before sans contrat légitime.
- **R224** — Clarifier la portée ITEM ou SHARED d'un premier snack ou d'une première bière du Before.
- **R225** — Ne pas multiplier une bouteille partagée par le nombre de personnes présentes.
- **R226** — Garder les identités du Before et de ses composants stables à travers modification, suppression et réouverture.
- **R227** — Déplacer « Compléter le Before » vers un petit « + Ajouter » dans la bonne section.
- **R228** — Déplacer « Retirer le Before » dans son menu de contexte.
- **R229** — Protéger les saisies RAW avant de retirer un Before enrichi.
- **R230** — Rendre les consommations Bière, Cocktail, Shot, Vin, Soft et Bouteille immédiatement identifiables.
- **R231** — Afficher la quantité à côté du nom de consommation.
- **R232** — Afficher le prix et son unité selon le sens économique réel : verre, bouteille, lot, personne ou unité.
- **R233** — Différencier le prix unitaire du montant total retenu.
- **R234** — Éviter qu'un prix total officiel soit remplacé visuellement par un prix unitaire trompeur.
- **R235** — Distinguer une nouvelle Bière de l'augmentation de la Bière existante.
- **R236** — Ne pas fusionner deux lignes portant le même nom si leurs identités ou leurs prix diffèrent.
- **R237** — Lorsqu'une consommation est en édition RAW, alléger les propositions concurrentes du dock.
- **R238** — Préserver la valeur RAW exacte en cas de changement de scène demandé.
- **R239** — Ne pas perdre une saisie lors d'un clic sur une autre tuile ou un autre contrôle.
- **R240** — Faire apparaître les réglages d'un poste dans un menu compact : nom, unité, financement, retrait.
- **R241** — Conserver une édition avancée pour les cas PERSON, SHARED, financements et relations complexes.
- **R242** — Éviter que l'éditeur historique avancé réintroduise du scroll interne ou une interface contradictoire.
- **R243** — Conserver une option « + Ajouter » dans Au bar pour les nouveaux objets économiques.

---

## E. Montant global, couverture économique et affichage des coûts — 26 recommandations

*Zone de travail indicative : Composer / Finance V2 · montant direct · Compiler et résumés de prix.*

- **R005** — Rendre le montant affiché directement modifiable en cliquant dessus lorsqu'il représente une estimation globale éditable.
- **R244** — Faire du montant affiché dans l'en-tête l'entrée de modification de l'estimation globale.
- **R245** — Permettre de saisir une estimation globale des consommations sans ouvrir un sous-asset « Montant direct ».
- **R246** — Permettre de remplacer explicitement cette estimation globale par des consommations détaillées.
- **R247** — Faire cesser la contribution du montant global couvert dès que son remplacement par le détail est accepté.
- **R248** — Ne jamais additionner silencieusement une estimation regroupée aux consommations qui la remplacent.
- **R249** — Ne jamais afficher un faux total de 0 € lorsqu'un montant global vient d'être remplacé par des postes sans prix.
- **R250** — Conserver les nouveaux prix manquants en UNKNOWN et non en MANUAL 0.
- **R251** — Préserver les autres coûts indépendants, notamment les transports, lors du passage global → détaillé.
- **R252** — Rendre le passage global → détaillé atomique, réversible et couvert par Undo.
- **R253** — Permettre le passage inverse du détail à une estimation globale uniquement avec un remplacement explicite des détails concernés.
- **R254** — Ne pas rendre le montant calculé à partir des détails éditable comme une ligne indépendante supplémentaire.
- **R255** — Distinguer l'estimation regroupée des contributions ou entrées additives.
- **R256** — Rendre le choix « Ajouter en plus » explicite lorsqu'il crée une dépense indépendante.
- **R257** — Rendre le choix « Détailler à la place » explicite sur les postes réellement remplacés.
- **R258** — Montrer l'impact économique admissible avant une confirmation de couverture.
- **R259** — Préserver les identités et les décisions RAW non incluses dans l'opération de remplacement.
- **R260** — Ne jamais faire de calcul financier parallèle en React à la place de Finance V2.
- **R261** — Fonder le montant affiché sur le Compiler ou ses résumés officiels.
- **R262** — Présenter séparément les montants connus et les inconnues non additives.
- **R263** — Distinguer MANUAL, QUOTE, UNKNOWN et estimation officielle lorsque cela modifie la confiance affichée.
- **R264** — Distinguer clairement coût d'usage voiture et paiement réellement engagé.
- **R265** — Ne pas dissimuler les composantes péage, parking, fare ou transport cash lorsqu'elles existent dans les résumés officiels.
- **R266** — Afficher les montants et unités avec un format monétaire homogène.
- **R267** — Classer les coûts directs, repas, consommations et contributions dans des rubriques économiques fidèles.
- **R268** — Ne pas appliquer de multiplication financière sur le simple nombre de personnes présentes.

---

## F. Mobilité Aller / Retour : endpoints, modes, véhicules, coûts — 39 recommandations

*Zone de travail indicative : `bar-living-operations.ts` · éditeur de trajets · `BarRouteLine`.*

- **R006** — Rendre chaque trajet directement modifiable en cliquant sur sa ligne ou sur ses informations.
- **R142** — Ne pas afficher une destination d'Aller comme premier choix d'origine du même Aller.
- **R269** — Afficher des parcours Aller et Retour sous forme de deux modules compacts directement manipulables.
- **R270** — Afficher les deux endpoints du trajet comme éléments visuels principaux.
- **R271** — Permettre de modifier l'origine en touchant directement le point de départ.
- **R272** — Permettre de modifier la destination en touchant directement le point d'arrivée.
- **R273** — Permettre de modifier mode ou véhicule depuis leur capsule dans la ligne de trajet.
- **R274** — Permettre de préciser ou consulter le coût en touchant le montant du trajet.
- **R275** — Placer le coût connu ou « À estimer » à droite de la ligne de trajet lorsque la largeur le permet.
- **R276** — Réduire le nom principal du véhicule à « Peugeot 207 » et placer sa version technique dans les détails.
- **R277** — Déplacer « Retirer ce trajet », financements et relations détaillées dans un menu ⋯ de trajet.
- **R278** — Permettre d'inverser volontairement les endpoints d'un trajet quand le contrat l'autorise.
- **R279** — Distinguer visuellement Aller et Retour tout en gardant une grammaire graphique commune.
- **R280** — Après sélection d'un mode, mettre en tête le prochain endpoint réellement manquant.
- **R281** — Après sélection d'une origine, proposer la destination manquante si elle l'est réellement.
- **R282** — Après sélection des endpoints, proposer le véhicule nécessaire ou l'estimation légitime.
- **R283** — Mettre Maison en première suggestion d'origine Aller lorsqu'elle est connue, pertinente et admissible.
- **R284** — Ne jamais sélectionner Maison automatiquement comme origine sans choix explicite.
- **R285** — Ne pas préfixer le bar de destination dans les propositions ordinaires d'origine Aller.
- **R286** — Adapter la liste des endpoints à la direction et au rôle exact du point recherché.
- **R287** — Écarter ou déprioriser un candidat identique à l'autre endpoint sauf trajet volontaire particulier.
- **R288** — Ne pas afficher indistinctement aéroports, magasins et arrêts de tram avant les origines pertinentes.
- **R289** — Conserver les autres lieux accessibles par une recherche dédiée plutôt que par 28 pages du dock.
- **R290** — Garder un raccourci « Depuis Maison » même lorsqu'un véhicule unique n'est pas disponible, sans choisir le véhicule à la place de l'utilisateur.
- **R291** — Proposer explicitement une reprise du trajet inverse après un Aller connu.
- **R292** — Distinguer « Reprendre le trajet inverse », « Même mode qu'à l'aller » et « Autre retour ».
- **R293** — Ne pas copier automatiquement le coût de l'Aller sur le Retour.
- **R294** — Ne pas fusionner les identités, prix ou financements d'Aller et Retour.
- **R295** — Permettre un retour en taxi après un aller en voiture sans rendre les deux modes dépendants.
- **R296** — Afficher les données réellement manquantes à un trajet plutôt qu'un simple « À estimer » générique.
- **R297** — Ne pas créer l'impression qu'un trajet est calculable lorsque son lieu n'est que TEXT.
- **R298** — Distinguer un tarif de taxi ou train d'une estimation d'usage voiture.
- **R299** — Éviter la formulation redondante « Coût d'usage estimé · à estimer ».
- **R300** — Ne pas offrir « Prix du billet ou de la course » comme commande principale d'une voiture personnelle ordinaire.
- **R301** — Corriger « N arrêts » pour ne pas compter les endpoints comme des étapes intermédiaires.
- **R302** — Conserver les contrôles avancés pour arrêts intermédiaires, financements et relations externes légitimes.
- **R303** — Conserver les coûts et identités du sens non modifié lors d'une édition Aller ou Retour.
- **R304** — Conserver une clarification explicite quand changer endpoint, mode ou véhicule invalide un prix déjà admis.
- **R305** — Ne jamais transformer une suggestion de trajet en choix automatiquement retenu.

---

## G. Dock : moteur de suggestions, hiérarchie et pagination — 34 recommandations

*Zone de travail indicative : `context-palette.tsx` · questions proposées par l’éditeur · classement et recherche.*

- **R009** — Retirer du dock d'accueil les sous-assets de navigation redondants « Lieu », « Date », « Personnes » et « Montant direct ».
- **R010** — Conserver l'affichage des lieux et personnes pertinents dans le dock après un clic sur leur champ de la carte.
- **R057** — Ne jamais introduire de scroll vertical interne dans le dock.
- **R058** — Ne jamais introduire de scroll horizontal continu dans le dock.
- **R059** — Remplacer les listes trop longues par des pages ou une recherche réelle, sans masquer de fonctionnalité.
- **R132** — Faire du dock une palette de choix contextuels, et non un inventaire de toutes les fonctions disponibles.
- **R133** — Sélectionner les propositions du dock selon la décision active, les valeurs connues et les champs manquants.
- **R134** — Distinguer les états du dock « choisir », « compléter » et « suggérer la suite ».
- **R135** — Proposer d'abord les décisions utiles plutôt que répéter les réponses déjà données.
- **R136** — Ne pas réafficher immédiatement les modes de transport après le choix d'un mode si un endpoint manque.
- **R137** — Réserver la modification d'une décision déjà retenue à une action secondaire claire.
- **R138** — Afficher seulement quatre à six propositions prioritaires avant un éventuel accès aux autres choix.
- **R139** — Laisser les options secondaires accessibles par une vraie recherche ou « Autres ».
- **R140** — Éviter les catalogues de dizaines de pages comme chemin principal de sélection.
- **R141** — Garantir un ordre de suggestion stable, compréhensible et dépendant du rôle de la cible.
- **R144** — Exploiter les raisons de suggestion prouvées, sans inventer de fréquentation ni de préférence.
- **R145** — Rendre visible la raison déterminante d'une suggestion quand elle aide réellement au choix.
- **R146** — Ne pas réserver les informations essentielles de provenance aux seules infobulles de survol.
- **R147** — Distinguer graphiquement une valeur proposée d'une valeur réellement retenue.
- **R148** — Différencier les actions de création d'objet et les actions de navigation entre sections.
- **R149** — Ne pas mélanger établissements proposés, recherche, nom libre et « Plus tard » dans une même liste indifférenciée.
- **R150** — Séparer les choix principaux des options de repli par leur hiérarchie visuelle.
- **R152** — Ne pas répéter dans le dock une commande « Ma sortie » déjà présente dans la carte.
- **R153** — Réduire ou masquer le dock lorsqu'il n'a aucune proposition réellement utile.
- **R154** — Ne pas inventer de raccourcis pour occuper artificiellement un dock vide.
- **R155** — Adapter le titre du dock à la question exacte en cours, sans le confondre avec le titre de la scène.
- **R156** — Limiter les textes des propositions à un ou deux niveaux typographiques lisibles.
- **R157** — Conserver les choix sélectionnés clairement identifiables dans le dock.
- **R158** — Paginer les options du dock par cartes entières, sans découpe de vignette à droite.
- **R159** — Afficher un indicateur de page simple et des flèches de navigation effectives.
- **R160** — Conserver une largeur stable des propositions pendant les changements de page.
- **R161** — Conserver la bonne page ou la réinitialiser selon l'identité réelle de la question, pas seulement selon son titre.
- **R162** — Préserver le focus clavier lors d'un changement de page du dock.
- **R163** — Afficher la nouvelle réponse dans la carte immédiatement après son admission, sans confirmation de confort.

---

## H. Carte ouverte : disposition compacte, commandes et lisibilité — 31 recommandations

*Zone de travail indicative : composants de la carte ouverte · CSS Bar · mise en page des éditions.*

- **R023** — Réduire les textes d'instruction permanents au strict nécessaire.
- **R024** — Ne jamais présenter une limitation technique sous forme de phrase de contrat interne.
- **R025** — Employer des verbes et noms compréhensibles plutôt que « main », « socket », « composant principal » ou « contrat ».
- **R026** — Réserver les textes explicatifs longs aux situations ambiguës ou risquées.
- **R027** — Conserver une aide accessible à la demande pour les notions réellement complexes.
- **R028** — Déplacer les réglages rares dans un menu contextuel discret.
- **R029** — Conserver les actions destructives dans un menu secondaire, sans les promouvoir au rang d'action principale.
- **R030** — Préserver la possibilité de tout réaliser au clavier et au tactile malgré la réduction des boutons.
- **R031** — Maintenir des zones de clic suffisamment grandes pour chaque commande compacte.
- **R032** — Maintenir des noms accessibles explicites pour les commandes réduites à des icônes.
- **R033** — Garder des intitulés visibles lorsqu'une icône seule serait ambiguë.
- **R034** — Simplifier la hiérarchie visuelle autour de trois niveaux : voir, modifier, options avancées.
- **R039** — Réduire la hauteur totale de la carte en édition simple en exploitant davantage la largeur disponible.
- **R040** — Viser une édition simple proportionnée au contenu plutôt qu'une grande carte quasi vide.
- **R041** — Réunir illustration, titre et montant sur une ligne d'en-tête compacte quand la largeur le permet.
- **R042** — Réduire l'espace vertical entre l'en-tête et les capsules de métadonnées.
- **R043** — Placer Lieu, Date, Personnes et l'action d'ajout de déplacement sur une même bande horizontale à grande largeur.
- **R044** — Placer « + Déplacement » à droite des métadonnées quand la composition le permet.
- **R045** — Placer le titre de section à gauche et « + Ajouter » à droite sur la même ligne.
- **R046** — Supprimer les lignes réservées uniquement à un petit bouton d'action.
- **R054** — Utiliser une sous-page dédiée pour une édition avancée qui ne tient pas dans la tuile.
- **R061** — Adapter la hauteur de la carte ouverte à la scène réellement active.
- **R063** — Ne pas réserver une hauteur fixe excessive pour une seule consommation ou un petit calendrier.
- **R066** — Ne pas empiler synthèse, catalogue et édition complète sur une même page.
- **R067** — Permettre des présentations distinctes pour carte fermée étroite et carte ouverte large.
- **R068** — Éviter d'étirer une tuile unique sur toute la largeur quand une carte plus courte serait préférable.
- **R069** — Utiliser des tuiles équilibrées sur la largeur pour deux consommations.
- **R070** — Adapter le nombre de colonnes de consommation à la largeur effective et au nombre d'objets.
- **R072** — Garder la tuile active plus expressive tout en laissant les autres composants compacts.
- **R073** — Réduire les espaces blancs qui n'assurent aucune respiration utile.
- **R074** — Ne pas compenser les surfaces vides par des textes ou des objets fictifs.

---

## I. Carte fermée : synthèse riche, sections et miniatures — 25 recommandations

*Zone de travail indicative : `bar-living-card.tsx` · `bar-living-details.tsx` · résumé compact.*

- **R062** — Adapter la hauteur de la carte fermée à la quantité réelle d'informations.
- **R108** — Faire de la carte fermée une synthèse illustrative de la soirée plutôt qu'une miniature du formulaire.
- **R109** — Faire ressortir clairement le lieu sélectionné dans la carte fermée.
- **R110** — Afficher les participants en pastilles lisibles avec initiales ou portraits autorisés.
- **R111** — Limiter les participants affichés en compact à quelques pastilles puis « +N ».
- **R112** — Afficher la date retenue dans un format court, stable et lisible.
- **R113** — Garder le montant officiel parmi les éléments visuellement dominants de la carte fermée.
- **R114** — Afficher distinctement les coûts connus et les parties encore à préciser.
- **R115** — Ne jamais présenter un montant partiel comme un total exhaustif.
- **R116** — Masquer les rubriques réellement vides dans la carte fermée.
- **R117** — Afficher une invitation à composer uniquement lorsque la carte est réellement vide.
- **R118** — Faire apparaître les moments « Avant de sortir » et « Au bar » comme deux zones distinctes lorsqu'ils existent.
- **R119** — Conserver la distinction Avant de sortir / Au bar lors du passage ouvert → fermé.
- **R120** — Classer les repas, entrées, contributions et autres coûts directs dans leurs rubriques exactes, pas sous « Au bar » par défaut.
- **R121** — Afficher deux ou trois miniatures pertinentes par moment puis « +N » pour le contenu masqué.
- **R122** — Afficher la quantité directement sur les miniatures quand elle est utile à la compréhension.
- **R123** — Permettre de rouvrir un composant précis depuis sa miniature compacte.
- **R124** — Faire ouvrir directement le groupe Before par sa miniature, sans détour par un menu générique.
- **R125** — Afficher Aller et Retour sous forme de lignes compactes indépendantes en mode fermé.
- **R126** — Placer Aller et Retour sur une seule ligne quand la largeur suffit, sans mélanger leurs coûts.
- **R127** — Rendre les tuiles compactes plus denses et supprimer les espaces morts sous les objets.
- **R128** — Conserver une représentation cohérente du même objet entre vue ouverte et vue fermée.
- **R129** — Afficher les modes de transport et les coûts inconnus dans une synthèse honnête, sans inventer de tarif.
- **R130** — Réduire les microtextes permanents dans la carte fermée.
- **R131** — Construire une composition visuelle propre pour les états vide, partiel et riche.

---

## J. Direction artistique, illustrations et composants visuels — 33 recommandations

*Zone de travail indicative : assets visuels · iconographie · tokens de styles · finitions graphiques.*

- **R075** — Ne pas augmenter la hauteur de la carte uniquement pour ajouter une décoration.
- **R076** — Mieux aligner les marges, espacements et largeurs des éléments sur une échelle commune.
- **R077** — Limiter les différences arbitraires de rayon de bordure.
- **R078** — Réduire le nombre de bordures et de boutons pointillés.
- **R079** — Réserver les contours pointillés aux emplacements vides ou actions dont ce traitement a un sens.
- **R080** — Utiliser un état actif subtil et homogène sur les tuiles sélectionnées.
- **R081** — Éviter les effets de survol qui agrandissent les tuiles ou déplacent leurs voisines.
- **R082** — Prévoir des transitions internes brèves sans déplacement du contenu hors écran.
- **R083** — Conserver une hiérarchie typographique stable entre titre, montant, contexte et détails.
- **R084** — Renforcer le contraste des petits textes gris et beiges.
- **R085** — Limiter le nombre de variantes de tailles de texte dans les cartes.
- **R086** — Conserver une palette cohérente ivoire, blanc, beige chaleureux et violet d'interaction.
- **R087** — Éviter que toutes les cartes du Board répètent de grands textes « À définir » ou « Occurrences à définir » au détriment de leur identité visuelle.
- **R088** — Créer une illustration éditoriale stable et spécifique à la famille Bar / Apéro.
- **R089** — Éviter d'utiliser systématiquement une simple chope de bière comme illustration de toute sortie Bar / Apéro.
- **R090** — Ne pas utiliser de photographie riche en plein fond derrière les textes du Board.
- **R091** — Placer l'illustration d'ambiance dans une zone dédiée, éventuellement sur un côté de la carte.
- **R092** — Associer à cette illustration un fond tonal ou graphique très discret.
- **R093** — Ne pas rendre la carte entière sous forme d'image : garder de vrais composants interactifs.
- **R094** — Conserver une illustration d'ambiance indépendante des consommations particulières ajoutées.
- **R095** — Ne pas regénérer une illustration principale à chaque ajout ou modification d'asset.
- **R096** — Faire évoluer la place occupée par l'illustration selon que la carte est vide, partielle ou riche.
- **R097** — Accorder davantage d'espace à l'illustration lorsque la carte est vide.
- **R098** — Réduire progressivement la présence de l'illustration quand les informations réelles occupent la carte.
- **R099** — Donner la priorité visuelle aux objets et montants réels dans une carte riche.
- **R100** — Afficher de vraies miniatures des consommations et composants du Before dans la carte fermée.
- **R101** — Harmoniser le style, les dimensions et le cadrage des miniatures entre bibliothèque, dock et carte.
- **R102** — Utiliser un fallback iconographique cohérent lorsqu'un asset ne possède pas d'image dédiée.
- **R103** — Éviter les symboles génériques comme « ✦ » ou les images minuscules pour représenter une bouteille identifiable.
- **R104** — Utiliser des icônes distinctes et cohérentes pour bière, vodka, cocktail, shot, vin, soft, tapas et snacks.
- **R105** — Ne pas dépendre des emojis natifs comme iconographie finale principale.
- **R106** — Ne pas employer la même illustration générique pour tous les lieux proposés.
- **R107** — Distinguer visuellement les modes voiture, tram, bus, taxi et marche.

---

## K. Board, géométrie, responsive, scroll et animations — 18 recommandations

*Zone de travail indicative : `board-carousel.tsx` · `inventory-layout.ts` · dimensions et mesure du DOM.*

- **R055** — Ne jamais ajouter de défilement vertical interne pour faire tenir davantage de contrôles.
- **R056** — Ne jamais introduire de scroll horizontal interne dans la carte.
- **R060** — Ne jamais masquer une action indispensable uniquement par `overflow:hidden`.
- **R064** — Conserver une hauteur maximale compatible avec le viewport et le Board.
- **R065** — Conserver l'édition ciblée dans la carte sans pousser les éléments actifs sous la ligne de flottaison.
- **R316** — Empêcher les cartes voisines de recouvrir un formulaire actif pendant les animations du Board.
- **R317** — Empêcher les cartes voisines de recouvrir Bar / Apéro après stabilisation du Board.
- **R318** — Réserver à la carte ouverte une surface correspondant à sa hauteur réellement utile.
- **R319** — Éviter les grandes réservations vides du Board après changement de scène.
- **R320** — Stabiliser l'emplacement des cartes voisines pendant les éditions rapides.
- **R321** — Contrôler les superpositions et la priorité de clic au cours de chaque transition.
- **R322** — Éviter les animations spatiales qui font traverser une carte active par une autre carte.
- **R323** — Mieux relier visuellement le dock à la carte qu'il modifie, malgré la pagination du Board.
- **R324** — Préserver un ancrage spatial stable lorsque l'utilisateur change de scène interne.
- **R325** — Limiter les recalculs de hauteur et les repackings aux variations réellement utiles, après mesure.
- **R326** — Instrumenter les MutationObserver et ResizeObserver pendant une saisie rapide.
- **R327** — Éviter les mesures de scroll inutiles dans le dock paginé si elles n'apportent aucune information.
- **R329** — Mesurer les déplacements et collisions des cartes à différentes étapes de leurs animations.

---

## L. Suppression, sauvegarde, états asynchrones et latence — 22 recommandations

*Zone de travail indicative : `composer-shell.tsx` · Preview · `durable-draft.ts` · feedback et reprise.*

- **R306** — Retirer la grande bande « Retirer ce moment » de la carte fermée.
- **R307** — Garder le drag-and-drop vers la corbeille comme geste visuel de retrait des cartes.
- **R308** — Afficher la corbeille uniquement durant le déplacement d'un objet admissible.
- **R309** — Maintenir un retrait accessible via ⋯ pour les usages sans drag-and-drop.
- **R310** — Distinguer clairement replier une carte et supprimer une carte.
- **R311** — Faire réagir l'interface immédiatement au lancement d'une suppression.
- **R312** — Afficher un état transitoire de retrait sans annoncer sa réussite durable avant confirmation.
- **R313** — Conserver Undo après retrait, sans confirmation générique lorsque l'opération est réversible et sûre.
- **R314** — Mesurer séparément le temps clic→feedback, l'opération serveur, la Preview et la sauvegarde durable.
- **R315** — Vérifier la latence de retrait d'une carte riche avec les mêmes données avant et après correction.
- **R328** — Mesurer la latence frappe→affichage lors de l'édition d'un prix.
- **R330** — Séparer clairement « choix retenu localement », « simulation actualisée » et « brouillon sauvegardé ».
- **R331** — Ne pas afficher « Sauvegardé » avant la confirmation effective de persistance.
- **R332** — Rendre accessible une reprise ciblée lorsqu'une sauvegarde Draft échoue.
- **R333** — Conserver les données et saisies locales après refus ou timeout de sauvegarde.
- **R334** — Ne pas réessayer une opération ambiguë au risque de la dupliquer.
- **R335** — Identifier la cause de l'échec de sauvegarde riche indépendamment des timeouts Canonical de Preview.
- **R336** — Valider une soirée riche avec Before, boissons, date, participants et trajets en session authentifiée.
- **R337** — Relire la même soirée après rechargement avec ses identités, quantités, prix et liens inchangés.
- **R338** — Vérifier la cohérence entre Draft, Preview, Finance V2 et application finale sans confondre ces statuts.
- **R339** — Conserver les gardes RAW, les confirmations de perte et la protection des relations externes.
- **R340** — Conserver le comportement idempotent et ciblé des mutations de composants et trajets.

---

## M. Recettes, accessibilité vérifiée et décision de réplication — 10 recommandations

*Zone de travail indicative : tests unitaires, React, navigateur, authentifiés et fournisseurs réels.*

- **R341** — Vérifier l'absence de scroll interne sur toutes les sous-scènes, y compris les pages avancées héritées.
- **R342** — Tester les états vide, partiel et riche à plusieurs largeurs desktop et au zoom 125 %.
- **R343** — Tester l'accessibilité clavier et la restauration du focus à chaque transition de scène.
- **R344** — Tester la pagination des choix au redimensionnement sans page fantôme ni focus perdu.
- **R345** — Vérifier la recherche Google et sa reprise dans un environnement fournisseur réellement autorisé.
- **R346** — Vérifier la recherche du même établissement depuis Composer et « Déclarer une dépense ».
- **R347** — Vérifier la séparation et la non-duplication des dépenses entre montant global, consommations et déplacements.
- **R348** — Valider un parcours complet Bar → Lieu → Date → Personnes → Before → Consommations → Aller → Retour → Enregistrer → Relire.
- **R349** — Ne pas répliquer l'interface Bar / Apéro aux autres assets avant validation du parcours complet et de la géométrie.
- **R350** — Ne pas lancer une refonte générale de Finance V2, de Mobility ou des performances pour corriger des défauts localisés.

---

---

**Note finale d’intégrité :** le registre source comporte 350 textes Rxxx distincts ; le document d’exécution les reprend une fois chacun en annexe. Les tableaux de vagues sont un index de lots, pas une réécriture du périmètre.
