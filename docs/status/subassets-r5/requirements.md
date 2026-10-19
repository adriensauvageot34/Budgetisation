# Registre R5 — 222 exigences

R5 arbitre la formulation source ; ces statuts ne constituent pas une certification.

## UI-001 — B

**Source :** Supprimer les confirmations inutiles. Une sélection valide doit être enregistrée immédiatement, sans bouton « Valider » ou « Enregistrer » supplémentaire.

**Statut normatif :** RETENU — INTERPRÉTATION R5

**Précision R5 :** Un clic ne vaut admission qu'après validation métier. Aucun second bouton rituel ; maintenir garde RAW et arbitrages financiers légitimes.

**Décisions R5 dominantes :** R5-D13…D27.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-002 — A

**Source :** Différencier une saisie d'une décision. Écrire « Chupitos » dans un champ lance une recherche ; sélectionner le résultat crée le choix définitif.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Autocomplétion et frappe n'engagent rien. Le clic sur une suggestion vérifiée peut lancer Details puis une seule mutation propriétaire.

**Décisions R5 dominantes :** R5-D13…D27.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-003 — B

**Source :** Revenir automatiquement à la vue de la soirée après une décision simple, notamment après le choix d'un lieu ou d'une date.

**Statut normatif :** RETENU — INTERPRÉTATION R5

**Précision R5 :** Retour après succès effectif vers le **mode d'origine** (fermé/ouvert, scène, page et focus), pas fermeture prématurée.

**Décisions R5 dominantes :** R5-D13…D27.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-004 — A

**Source :** Conserver l'éditeur ouvert uniquement pour les décisions multiples, par exemple sélectionner plusieurs participants ou régler plusieurs paramètres de financement.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Personnes, partage et ajouts répétés restent ouverts ; un choix atomique revient. Pas de règle d'auto-fermeture universelle.

**Décisions R5 dominantes :** R5-D13…D27.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-005 — A

**Source :** Éliminer les étapes « Plus tard » lorsque quitter la scène sans choisir produit déjà exactement le même résultat.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Supprimer seulement les faux reports : ne pas retirer un vrai refus ou report porteur d'un sens métier distinct.

**Décisions R5 dominantes :** R5-D13…D27.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-006 — A

**Source :** Supprimer les états « À préciser » présentés comme des choix. Une information non renseignée doit rester absente, et non devenir un faux objet.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Absence d'information = donnée non choisie, jamais ligne fictive, mode de transport ou coût à 0 €.

**Décisions R5 dominantes :** R5-D13…D27.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-007 — A

**Source :** Limiter les opérations principales à un seul emplacement intuitif. Modifier le lieu sur la capsule Lieu, la date sur Date, les participants sur leurs avatars, le montant sur le prix.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** La valeur visible est la porte canonique de modification. Les sous-assets restent des **choix** lorsque l'utilisateur les demande, pas des doublons de navigation.

**Décisions R5 dominantes :** R5-D13…D27.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-008 — B

**Source :** Garder les options avancées disponibles sans les afficher en permanence. Elles apparaissent uniquement lorsqu'on en a besoin, avec un menu contextuel ou un petit bouton secondaire.

**Statut normatif :** RETENU — INTERPRÉTATION R5

**Précision R5 :** Les options avancées restent identifiables au clavier et dans le détail ; ne pas cacher un choix économique essentiel.

**Décisions R5 dominantes :** R5-D13…D27.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-009 — B

**Source :** Faire correspondre le retour arrière à une véritable transition de scène. Une flèche ne doit pas apparaître sans que l'utilisateur comprenne ce qu'il va retrouver.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Retour à l'origine et au focus ; Échap ferme une couche à la fois, arrêté par une garde RAW dirty.

**Décisions R5 dominantes :** R5-D13…D27.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-010 — B

**Source :** Garantir un Undo immédiat pour les suppressions, afin de pouvoir enlever facilement les boutons explicatifs et confirmations redondantes.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Undo exact des décisions admises, avec IDs, finances, relation de moment et endpoints ; pas simple animation de restauration.

**Décisions R5 dominantes :** R5-D13…D27.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-011 — A

**Source :** Faire que les clics sur une capsule, une tuile ou un résultat accomplissent directement l’action attendue ; ne pas demander une validation supplémentaire pour une action déjà explicite.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Le clic accomplit l'intention unique, mais une vérification serveur, Canonical ou un arbitrage réel reste possible.

**Décisions R5 dominantes :** R5-D13…D27.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-012 — B

**Source :** Permettre de retirer un élément par une croix contextuelle ou par le geste de corbeille déjà présent sur le Board, plutôt que multiplier les actions « Retirer ce moment ».

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Corbeille du Board pour **la carte entière** ; retrait ciblé depuis capsule/tuile/menu pour un poste ou une valeur. Éviter un second CTA 'Retirer ce moment' redondant, sans confondre les portées.

**Décisions R5 dominantes :** R5-D13…D27.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-013 — A

**Source :** Conserver un retour explicite et immédiat après chaque décision : nouvel objet dans la bonne section, capsule actualisée, montant mis à jour si calculable.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Valeur retenue visible rapidement ; agrégat mis à jour seulement après projection fraîche, sans présenter l'ancien prix comme actuel.

**Décisions R5 dominantes :** R5-D13…D27.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-014 — A

**Source :** Éviter les scènes vides ou sans action ; revenir à la carte dès qu’une scène n’a plus de raison d’être affichée.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Ne pas conserver des étapes creuses ; respecter les retours explicites et garder une scène si erreur ou arbitrage en cours.

**Décisions R5 dominantes :** R5-D13…D27.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-015 — C

**Source :** Adapter la largeur de la carte à la scène active et non à un format ouvert universel.

**Statut normatif :** RETENU — INTERPRÉTATION R5

**Précision R5 :** Faire varier **le span réservé par le Board et la largeur visuelle ensemble**, pas seulement une propriété CSS.

**Décisions R5 dominantes :** R5-D01…D12.

**Exécution :** OUT_OF_SCOPE_NEXT_STAGE ; preuve NONE.

## UI-016 — C

**Source :** Donner à la carte vide une largeur proche de celle de deux petites cartes, ou moins si le Board le permet.

**Statut normatif :** RETENU — INTERPRÉTATION R5

**Précision R5 :** Ordre de grandeur, non largeur imposée ; maximiser la lisibilité sans fabriquer des grands blancs.

**Décisions R5 dominantes :** R5-D01…D12.

**Exécution :** OUT_OF_SCOPE_NEXT_STAGE ; preuve NONE.

## UI-017 — C

**Source :** Réserver les grandes largeurs aux situations où plusieurs blocs peuvent véritablement être disposés côte à côte.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Aucune précision supplémentaire ; invariants généraux applicables.

**Décisions R5 dominantes :** R5-D01…D12.

**Exécution :** OUT_OF_SCOPE_NEXT_STAGE ; preuve NONE.

## UI-018 — C

**Source :** Permettre au Board de récupérer l'espace libéré par une carte devenue plus étroite, sans créer un trou invisible dans sa grille.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Réutiliser l'espace au repack **stabilisé**, sans sauts pendant frappe ou drag ; pas de place fantôme permanente.

**Décisions R5 dominantes :** R5-D01…D12.

**Exécution :** OUT_OF_SCOPE_NEXT_STAGE ; preuve NONE.

## UI-019 — C

**Source :** Rapprocher « Bar / Apéro » et le montant, actuellement séparés par une distance excessive.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Aucune précision supplémentaire ; invariants généraux applicables.

**Décisions R5 dominantes :** R5-D01…D12.

**Exécution :** OUT_OF_SCOPE_NEXT_STAGE ; preuve NONE.

## UI-020 — C

**Source :** Éviter de réserver une ligne entière pour un seul bouton situé à l'extrémité droite.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Aucune précision supplémentaire ; invariants généraux applicables.

**Décisions R5 dominantes :** R5-D01…D12.

**Exécution :** OUT_OF_SCOPE_NEXT_STAGE ; preuve NONE.

## UI-021 — C

**Source :** Regrouper Lieu, Date, Personnes et Trajet sur une même ligne quand la place le permet, mais ne pas forcer leur compression.

**Statut normatif :** RETENU — INTERPRÉTATION R5

**Précision R5 :** Une ligne seulement si elle reste utilisable ; sinon deux lignes denses ou capsules compactes. Ne pas diminuer excessivement les hitboxes.

**Décisions R5 dominantes :** R5-D01…D12.

**Exécution :** OUT_OF_SCOPE_NEXT_STAGE ; preuve NONE.

## UI-022 — C

**Source :** Réduire les marges verticales des états vides, surtout sous « Au bar ».

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Aucune précision supplémentaire ; invariants généraux applicables.

**Décisions R5 dominantes :** R5-D01…D12.

**Exécution :** OUT_OF_SCOPE_NEXT_STAGE ; preuve NONE.

## UI-023 — C

**Source :** Faire disparaître une section vide non essentielle lorsque son seul contenu est son titre.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Aucune précision supplémentaire ; invariants généraux applicables.

**Décisions R5 dominantes :** R5-D01…D12.

**Exécution :** OUT_OF_SCOPE_NEXT_STAGE ; preuve NONE.

## UI-024 — C

**Source :** Utiliser l'espace horizontal pour présenter des informations complémentaires, mais pas pour étirer inutilement les champs de saisie.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Aucune précision supplémentaire ; invariants généraux applicables.

**Décisions R5 dominantes :** R5-D01…D12.

**Exécution :** OUT_OF_SCOPE_NEXT_STAGE ; preuve NONE.

## UI-025 — C

**Source :** Ne jamais conserver une hauteur artificielle après la fermeture d'une scène ou le retrait d'un objet.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** La réduction de hauteur intrinsèque doit aussi être reflétée dans l'empreinte réservée.

**Décisions R5 dominantes :** R5-D01…D12.

**Exécution :** OUT_OF_SCOPE_NEXT_STAGE ; preuve NONE.

## UI-026 — B

**Source :** Stabiliser la largeur pendant une saisie : une liste Google qui arrive ne doit pas provoquer un redimensionnement permanent.

**Statut normatif :** RETENU — INTERPRÉTATION R5

**Précision R5 :** Geler largeur et page durant frappe Google, chargement d'image/Results/Details et saisie RAW.

**Décisions R5 dominantes :** R5-D01…D12.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-027 — B

**Source :** Éviter toute barre de défilement verticale à l'intérieur d'une carte. Utiliser des scènes courtes, des vues détaillées ou un résumé suivi d'un accès aux éléments supplémentaires.

**Statut normatif :** RETENU — INTERPRÉTATION R5

**Précision R5 :** Aucun scroll vertical dans la carte, popover ou sous-panneau ; vue synthèse + détails sémantiquement navigables. Scroll de document seulement filet de sécurité en tout petit viewport.

**Décisions R5 dominantes :** R5-D01…D12.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-028 — B

**Source :** Faire évoluer la carte sans déplacer brutalement les autres cartes du Board à chaque clic.

**Statut normatif :** RETENU — INTERPRÉTATION R5

**Précision R5 :** Reflow seulement lors de transitions stabilisées ; ancre et identité de la carte active d'abord, packing maximal ensuite.

**Décisions R5 dominantes :** R5-D01…D12.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-029 — C

**Source :** Prévoir une taille optimale spécifique aux scènes Lieu, Date, Personnes, Consommation et Trajet.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Gabarits de scène et contenu utile, non matrice CSS rigide par preset.

**Décisions R5 dominantes :** R5-D01…D12.

**Exécution :** OUT_OF_SCOPE_NEXT_STAGE ; preuve NONE.

## UI-030 — C

**Source :** Ajuster la largeur au niveau de contenu : compacte pour une soirée vide, intermédiaire pour Lieu/Date/Personnes et édition simple, étendue pour plusieurs moments ou trajets.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Préférence de surface, mesure intrinsèque et empreinte accordée sont trois variables distinctes.

**Décisions R5 dominantes :** R5-D01…D12.

**Exécution :** OUT_OF_SCOPE_NEXT_STAGE ; preuve NONE.

## UI-031 — C

**Source :** Employer des fourchettes de travail indicatives desktop (à valider sur navigateur) : fermé 350–480 px ; ouvert vide 480–600 px ; recherche/date 560–680 px ; consommation 560–700 px ; soirée riche 720–900 px.

**Statut normatif :** HYPOTHÈSE À MESURER

**Précision R5 :** **Non contractuel** : les fourchettes historiques sont des hypothèses à corriger selon scénario/viewport. Date peut être plus étroite ; riche ne devient L que si utile.

**Décisions R5 dominantes :** R5-D01…D12.

**Exécution :** OUT_OF_SCOPE_NEXT_STAGE ; preuve NONE.

## UI-032 — C

**Source :** Ne pas imposer la même grille aux formulaires courts, consommations, trajectoires et résumés ; choisir la disposition verticale ou horizontale selon le contenu.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Aucune précision supplémentaire ; invariants généraux applicables.

**Décisions R5 dominantes :** R5-D01…D12.

**Exécution :** OUT_OF_SCOPE_NEXT_STAGE ; preuve NONE.

## UI-033 — C

**Source :** Répartir les consommations sur plusieurs colonnes si utile, sans écraser leur lisibilité pour gagner quelques pixels.

**Statut normatif :** RETENU — INTERPRÉTATION R5

**Précision R5 :** Deux colonnes uniquement si chaque objet conserve nom, quantité, prix, unité et cible éditable lisibles.

**Décisions R5 dominantes :** R5-D01…D12.

**Exécution :** OUT_OF_SCOPE_NEXT_STAGE ; preuve NONE.

## UI-034 — B

**Source :** En cas de forte densité, privilégier une page ou une scène interne réellement différente, une synthèse et un accès au détail, sans créer de défilement vertical dans la carte.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Paginable = **détail d'objets déjà ajoutés**, pas le catalogue des propositions ; tous les postes restent atteignables.

**Décisions R5 dominantes :** R5-D01…D12.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-035 — A

**Source :** Faire de Google Places le moteur principal de recherche des établissements lorsqu'il est disponible.

**Statut normatif :** SOUS CONTRAT MÉTIER/PROVIDER

**Précision R5 :** Si API réellement disponible. Les lieux canoniques/favoris demeurent accessibles et nom libre en repli ; aucun blocage total si provider absent.

**Décisions R5 dominantes :** R5-D15…D19, D53, D61.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-036 — A

**Source :** Remplacer les recherches « Lieux enregistrés » et « Chercher un bar » par une seule zone de saisie.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Une seule recherche visible : Google pendant frappe, favoris proposés au dock lorsque champ initialement vide.

**Décisions R5 dominantes :** R5-D15…D19, D53, D61.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-037 — A

**Source :** Lancer la recherche après une courte temporisation de frappe, sans bouton de validation.

**Statut normatif :** SOUS CONTRAT MÉTIER/PROVIDER

**Précision R5 :** Debounce, anti-réponses périmées, aucune mutation à la simple frappe.

**Décisions R5 dominantes :** R5-D15…D19, D53, D61.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-038 — A

**Source :** Continuer à proposer les lieux enregistrés par défaut dans le dock, même lorsqu'aucune recherche n'a été saisie.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Favoris **si utiles**, pas bande dock vide permanente ; résultats actifs Google proches du champ, non forcés dans le dock.

**Décisions R5 dominantes :** R5-D15…D19, D53, D61.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-039 — A

**Source :** Afficher les résultats Google à proximité immédiate du champ, plutôt que de forcer un déplacement visuel vers le bas du Board.

**Statut normatif :** SOUS CONTRAT MÉTIER/PROVIDER

**Précision R5 :** Limiter la liste visible et réserver sa place : la hauteur de Bar ne doit pas suivre le nombre de résultats.

**Décisions R5 dominantes :** R5-D15…D19, D53, D61.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-040 — A

**Source :** Reconnaître les lieux déjà enregistrés et éviter de présenter deux fois le même établissement.

**Statut normatif :** SOUS CONTRAT MÉTIER/PROVIDER

**Précision R5 :** Fusion/déduplication **uniquement si identité Canonical/Google autoritairement reliée**, jamais fuzzy sur nom/photo/coordonnées seules.

**Décisions R5 dominantes :** R5-D15…D19, D53, D61.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-041 — A

**Source :** Supprimer « Autres possibilités » et les autres intitulés techniques lorsqu'aucune action distincte ne les justifie.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Aucune précision supplémentaire ; invariants généraux applicables.

**Décisions R5 dominantes :** R5-D15…D19, D53, D61.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-042 — A

**Source :** Supprimer « 3 lieu(x) correspondant(s) · choisissez une proposition dans le dock ». Les résultats visibles suffisent.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Aucune précision supplémentaire ; invariants généraux applicables.

**Décisions R5 dominantes :** R5-D15…D19, D53, D61.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-043 — B

**Source :** Mettre « Historique et sources » dans les informations secondaires, pas dans le parcours principal.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Aucune précision supplémentaire ; invariants généraux applicables.

**Décisions R5 dominantes :** R5-D15…D19, D53, D61.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-044 — B

**Source :** Déplacer les dates d'historique, le nombre de visites et la couverture des données vers un détail facultatif.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Ne pas supprimer les sources du domaine ; les garder en second niveau pour audit.

**Décisions R5 dominantes :** R5-D15…D19, D53, D61.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-045 — A

**Source :** Présenter les suggestions sous la forme nom + ville, avec éventuellement une courte catégorie.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Nom + ville (si attestée) et catégorie courte ; nom complet accessible si tronqué.

**Décisions R5 dominantes :** R5-D15…D19, D53, D61.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-046 — A

**Source :** Donner aux propositions de lieux une hauteur stable et empêcher tout texte de déborder ou d'être coupé.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Gabarit fixé avant arrivée de la photo/résultat. Si nom long, révélation du nom complet sans croissance verticale.

**Décisions R5 dominantes :** R5-D15…D19, D53, D61.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-047 — B

**Source :** Utiliser une photo Google Places ou Street View si elle est exploitable et autorisée, avec une illustration neutre lorsque ce n'est pas le cas.

**Statut normatif :** SOUS CONTRAT MÉTIER/PROVIDER

**Précision R5 :** Photo **du lieu** facultative, droits/attribution/contraste contrôlés ; jamais source d'identité ni fond obligatoire de la carte.

**Décisions R5 dominantes :** R5-D15…D19, D53, D61.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-048 — B

**Source :** Permettre de retirer un lieu par une croix directement sur sa capsule, sans ouvrir un autre écran.

**Statut normatif :** SOUS CONTRAT MÉTIER/PROVIDER

**Précision R5 :** Retrait du **lieu central uniquement**, préservation des endpoints personnalisés ; arbitrage si liaison Mobility réelle.

**Décisions R5 dominantes :** R5-D15…D19, D53, D61.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-049 — B

**Source :** Un clic sur la capsule sélectionnée doit rouvrir la recherche pour changer de bar.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Focus rétabli immédiatement dans la recherche de remplacement.

**Décisions R5 dominantes :** R5-D15…D19, D53, D61.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-050 — B

**Source :** Après sélection, refermer automatiquement la recherche et revenir à la soirée, tout en conservant les liens de mobilité cohérents.

**Statut normatif :** SOUS CONTRAT MÉTIER/PROVIDER

**Précision R5 :** Retour après admission effective ; retarget uniquement endpoints liés, estimation marquée périmée si trajet changé.

**Décisions R5 dominantes :** R5-D15…D19, D53, D61.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-051 — A

**Source :** Faire disparaître les portes « Lieux enregistrés », « Chercher un bar », « Nom libre » et « Plus tard » du niveau principal lorsque ces fonctions sont déjà couvertes par la recherche et ses états de secours.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Aucune précision supplémentaire ; invariants généraux applicables.

**Décisions R5 dominantes :** R5-D15…D19, D53, D61.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-052 — A

**Source :** Dans le dock, rendre chaque lieu enregistré identifiable avec le nom et la ville ; réserver les détails d’historique et de provenance aux détails secondaires.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Aucune précision supplémentaire ; invariants généraux applicables.

**Décisions R5 dominantes :** R5-D15…D19, D53, D61.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-053 — B

**Source :** Étudier la reprise de la sélection de photo Google My Business / Places déjà proposée dans « Déclarer une dépense » pour illustrer les tuiles de bars connus.

**Statut normatif :** SOUS CONTRAT MÉTIER/PROVIDER

**Précision R5 :** Réutiliser le pipeline de photo existant sous contrat et attribution ; ne pas copier un fichier fournisseur dans Clay/Draft.

**Décisions R5 dominantes :** R5-D15…D19, D53, D61.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-054 — C

**Source :** Pour les tuiles de lieux, étudier une photographie d’établissement utilisée comme image de fond recadrée, avec le nom du bar et la ville en surcouche lisible, plutôt qu’un long texte.

**Statut normatif :** EXPÉRIMENTAL

**Précision R5 :** **Expérimental** pour tuile de lieu seulement. Si texte sur photo illisible, texte hors image sur surface opaque.

**Décisions R5 dominantes :** R5-D15…D19, D53, D61.

**Exécution :** OUT_OF_SCOPE_NEXT_STAGE ; preuve NONE.

## UI-055 — B

**Source :** Si l’image réelle est mal cadrée, peu lisible, indisponible ou non utilisable selon les règles du fournisseur, revenir à une illustration contextuelle homogène.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** La photo manquante ne change ni dimensions, ni sélection, ni coût, ni identité.

**Décisions R5 dominantes :** R5-D15…D19, D53, D61.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-056 — A

**Source :** Conserver la saisie libre comme véritable solution de secours lorsqu’aucun établissement Google ou enregistré ne correspond, sans la proposer comme détour obligatoire.

**Statut normatif :** SOUS CONTRAT MÉTIER/PROVIDER

**Précision R5 :** Nom libre sélectionné explicitement ; pas de Google ID, coordonnées ou lieu Canonical inventés.

**Décisions R5 dominantes :** R5-D15…D19, D53, D61.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-057 — B

**Source :** Donner à la capsule d’un lieu sélectionné une action directe de retrait, et préserver avec prudence les trajets personnalisés déjà associés.

**Statut normatif :** SOUS CONTRAT MÉTIER/PROVIDER

**Précision R5 :** Même règle que UI-048 : dépendances prouvées et Undo ciblé ; pas de substitution par ressemblance de nom.

**Décisions R5 dominantes :** R5-D15…D19, D53, D61.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-058 — B

**Source :** Lorsque la recherche est rouverte pour changer de lieu, donner immédiatement le focus au champ, sans imposer l’effacement manuel de l’ancien nom.

**Statut normatif :** SOUS CONTRAT MÉTIER/PROVIDER

**Précision R5 :** Préserver contexte de retour ; pas de préremplissage à effacer manuellement.

**Décisions R5 dominantes :** R5-D15…D19, D53, D61.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-059 — C

**Source :** Réduire la largeur de la carte à celle d'une véritable scène calendrier, plutôt que de garder une énorme carte presque vide.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Scène M calendrier, pas '760 px + minuscule widget'.

**Décisions R5 dominantes :** R5-D20…D22.

**Exécution :** OUT_OF_SCOPE_NEXT_STAGE ; preuve NONE.

## UI-060 — C

**Source :** Faire occuper au calendrier la majorité de la largeur disponible dans sa scène.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Utiliser l'enveloppe utile pour les 7 colonnes, sans élargir artificiellement la carte.

**Décisions R5 dominantes :** R5-D20…D22.

**Exécution :** OUT_OF_SCOPE_NEXT_STAGE ; preuve NONE.

## UI-061 — B

**Source :** Intégrer les flèches de changement de mois dans l'en-tête du calendrier.

**Statut normatif :** SOUS CONTRAT MÉTIER/PROVIDER

**Précision R5 :** **Conditionnel** : flèches seulement si jours/mois hors période sont **admissibles** par le contrat de projection.

**Décisions R5 dominantes :** R5-D20…D22.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-062 — B

**Source :** Supprimer le bouton « Retirer la date ».

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Aucune précision supplémentaire ; invariants généraux applicables.

**Décisions R5 dominantes :** R5-D20…D22.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-063 — B

**Source :** Cliquer sur une date déjà sélectionnée doit permettre de la désélectionner.

**Statut normatif :** SOUS CONTRAT MÉTIER/PROVIDER

**Précision R5 :** Cliquer **dans le calendrier** le jour déjà choisi retire cette date ; cliquer la capsule doit ouvrir le calendrier et non retirer instantanément.

**Décisions R5 dominantes :** R5-D20…D22.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-064 — B

**Source :** Cliquer sur une autre date doit immédiatement remplacer l'ancienne.

**Statut normatif :** SOUS CONTRAT MÉTIER/PROVIDER

**Précision R5 :** Mutation atomique uniquement si nouvelle date autorisée.

**Décisions R5 dominantes :** R5-D20…D22.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-065 — B

**Source :** Refermer automatiquement le calendrier après une nouvelle sélection, sauf si l'utilisateur choisit de continuer à naviguer.

**Statut normatif :** SOUS CONTRAT MÉTIER/PROVIDER

**Précision R5 :** Retour après admission ; échec garde calendrier, focus et choix actuel.

**Décisions R5 dominantes :** R5-D20…D22.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-066 — A

**Source :** Éviter de réafficher des sous-assets de date lorsque l'utilisateur est déjà dans le calendrier.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Aucune précision supplémentaire ; invariants généraux applicables.

**Décisions R5 dominantes :** R5-D20…D22.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-067 — B

**Source :** Mettre davantage en valeur la date sélectionnée et ne pas la confondre avec la date du jour.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Aucune précision supplémentaire ; invariants généraux applicables.

**Décisions R5 dominantes :** R5-D20…D22.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-068 — C

**Source :** Proposer éventuellement de petits raccourcis contextuels comme « Ce week-end », uniquement s'ils sont pertinents pour le mois prévu.

**Statut normatif :** EXPÉRIMENTAL

**Précision R5 :** Raccourci week-end facultatif **seulement** si compatible période et utile ; pas de nouvelle surface permanente.

**Décisions R5 dominantes :** R5-D20…D22.

**Exécution :** OUT_OF_SCOPE_NEXT_STAGE ; preuve NONE.

## UI-069 — A

**Source :** Ne pas conserver un dock vide sous le Board pendant l'édition de la date.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Aucune précision supplémentaire ; invariants généraux applicables.

**Décisions R5 dominantes :** R5-D20…D22.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-070 — B

**Source :** Préserver une navigation clavier claire et vérifier les mois limites, les changements d'année et les dates hors période admissible.

**Statut normatif :** SOUS CONTRAT MÉTIER/PROVIDER

**Précision R5 :** Ne pas afficher navigation hors mois si le domaine fixe `targetMonth`.

**Décisions R5 dominantes :** R5-D20…D22.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-071 — B

**Source :** Concevoir le calendrier comme la totalité du mini-module Date, sans espace latéral disproportionné ni section de navigation redondante.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Aucune précision supplémentaire ; invariants généraux applicables.

**Décisions R5 dominantes :** R5-D20…D22.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-072 — A

**Source :** Éviter que la scène Date affiche un dock générique, vide ou sans rapport avec le calendrier.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Aucune précision supplémentaire ; invariants généraux applicables.

**Décisions R5 dominantes :** R5-D20…D22.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-073 — A

**Source :** Afficher en priorité les personnes existantes dans le dock, plutôt qu'un champ « Autre prénom » au milieu de la carte.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Contacts dans le dock ; avatars choisis sur la carte ; aucune boîte 'Autre prénom' au milieu du résumé.

**Décisions R5 dominantes :** R5-D23…D26, D48…D49.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-074 — A

**Source :** Déplacer la recherche de personnes dans le dock, près des propositions.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Aucune précision supplémentaire ; invariants généraux applicables.

**Décisions R5 dominantes :** R5-D23…D26, D48…D49.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-075 — A

**Source :** Permettre de sélectionner plusieurs personnes à la suite, sans fermer la scène après chaque ajout.

**Statut normatif :** RETENU — INTERPRÉTATION R5

**Précision R5 :** Le dock et le focus restent sur les participants pour sélectionner plusieurs personnes.

**Décisions R5 dominantes :** R5-D23…D26, D48…D49.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-076 — A

**Source :** Afficher immédiatement les personnes choisies dans la carte.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Aucune précision supplémentaire ; invariants généraux applicables.

**Décisions R5 dominantes :** R5-D23…D26, D48…D49.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-077 — C

**Source :** Utiliser ultérieurement les portraits PNG que tu prépares, mais garder des initiales élégantes en attendant.

**Statut normatif :** DIFFÉRÉ

**Précision R5 :** **Différé** : portraits PNG personnalisés non présumés disponibles. Initiales correctement présentées dès maintenant.

**Décisions R5 dominantes :** R5-D23…D26, D48…D49.

**Exécution :** OUT_OF_SCOPE_NEXT_STAGE ; preuve NONE.

## UI-078 — A

**Source :** Limiter le nombre de noms visibles dans la carte et afficher `+3` lorsque les participants deviennent nombreux.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Aucune précision supplémentaire ; invariants généraux applicables.

**Décisions R5 dominantes :** R5-D23…D26, D48…D49.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-079 — A

**Source :** Permettre de retirer une personne en la désélectionnant depuis le dock ou par son avatar.

**Statut normatif :** SOUS CONTRAT MÉTIER/PROVIDER

**Précision R5 :** La désélection de présence ne retire **pas** silencieusement une allocation financière de ce contact.

**Décisions R5 dominantes :** R5-D23…D26, D48…D49.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-080 — A

**Source :** Ne proposer « Ajouter un prénom libre » que lorsqu'une recherche n'a pas trouvé la personne souhaitée.

**Statut normatif :** SOUS CONTRAT MÉTIER/PROVIDER

**Précision R5 :** Ajouter un prénom libre est une action explicite lorsque la recherche ne donne aucun match fiable.

**Décisions R5 dominantes :** R5-D23…D26, D48…D49.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-081 — A

**Source :** Supprimer le gros bouton « Ajouter ce prénom » lorsqu'il ne fait que répéter une action évidente.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Aucune précision supplémentaire ; invariants généraux applicables.

**Décisions R5 dominantes :** R5-D23…D26, D48…D49.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-082 — B

**Source :** Distinguer la présence à la soirée de la participation financière : sélectionner une personne n'implique aucun partage automatique.

**Statut normatif :** SOUS CONTRAT MÉTIER/PROVIDER

**Précision R5 :** Présence et financement sont deux relations métier différentes ; avatars similaires, statuts distincts.

**Décisions R5 dominantes :** R5-D23…D26, D48…D49.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-083 — C

**Source :** Préparer des portraits détourés PNG pour les personnes connues, utilisés dans les sous-assets, la carte et le partage des frais avec la même charte graphique.

**Statut normatif :** DIFFÉRÉ

**Précision R5 :** **Différé à la fourniture d'images**. Identité déterminée par l'ID personne, jamais par le PNG.

**Décisions R5 dominantes :** R5-D23…D26, D48…D49.

**Exécution :** OUT_OF_SCOPE_NEXT_STAGE ; preuve NONE.

## UI-084 — A

**Source :** Dans le dock des participants, conserver les contacts les plus pertinents visibles immédiatement et le champ de recherche à côté ; ne pas afficher un formulaire vide comme premier écran.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Aucune précision supplémentaire ; invariants généraux applicables.

**Décisions R5 dominantes :** R5-D23…D26, D48…D49.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-085 — A

**Source :** Conserver une décision réversible par simple sélection / désélection, sans bouton « Enregistrer les participants ».

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Aucune précision supplémentaire ; invariants généraux applicables.

**Décisions R5 dominantes :** R5-D23…D26, D48…D49.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-086 — A

**Source :** Ne jamais afficher un dock sans fonction utile pour la scène active.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Aucun dock pour Date et montant seul ; masquer réellement sa réserve spatiale à transition stable.

**Décisions R5 dominantes :** R5-D28…D35.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-087 — A

**Source :** Adapter systématiquement son titre et son contenu à la décision en cours.

**Statut normatif :** RETENU — INTERPRÉTATION R5

**Précision R5 :** Aucune précision supplémentaire ; invariants généraux applicables.

**Décisions R5 dominantes :** R5-D28…D35.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-088 — A

**Source :** Éviter « Composer », « Compléter ta sortie » et « Choisir ce qui compte » lorsque des intitulés plus précis sont possibles.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Aucune précision supplémentaire ; invariants généraux applicables.

**Décisions R5 dominantes :** R5-D28…D35.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-089 — A

**Source :** Ne jamais mélanger dans une même ligne des catégories, des objets concrets et des commandes de navigation.

**Statut normatif :** RETENU — INTERPRÉTATION R5

**Précision R5 :** Une rangée = une nature de choix : catégories OU objets OU contacts OU modes OU lieux OU financement.

**Décisions R5 dominantes :** R5-D28…D35.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-090 — A

**Source :** Ne pas reproposer une fonction déjà accessible directement depuis la carte, sauf si elle constitue une véritable suggestion contextuelle.

**Statut normatif :** RETENU — INTERPRÉTATION R5

**Précision R5 :** Le dock propose des options nouvelles ; carte édite les faits existants. Ne pas redonner 'Lieu' et 'Montant direct' en faux raccourcis.

**Décisions R5 dominantes :** R5-D28…D35.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-091 — A

**Source :** Supprimer « Montant direct » du catalogue : le montant se manipule en cliquant sur le chiffre affiché sur la carte.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Aucune précision supplémentaire ; invariants généraux applicables.

**Décisions R5 dominantes :** R5-D28…D35.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-092 — A

**Source :** Remplacer les pages successives du dock par un défilement horizontal fluide, avec flèches toujours visibles.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Rail horizontal continu. Flèches **si overflow** ; ne pas imposer toujours deux flèches inertes.

**Décisions R5 dominantes :** R5-D28…D35.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-093 — A

**Source :** Prévoir une légère ombre ou un fondu sur le bord droit pour indiquer que d'autres éléments existent.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Aucune précision supplémentaire ; invariants généraux applicables.

**Décisions R5 dominantes :** R5-D28…D35.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-094 — C

**Source :** Tester un défilement doux au survol prolongé des extrémités, sans déplacement inattendu lorsque la souris traverse le dock.

**Statut normatif :** EXPÉRIMENTAL — INACTIF PAR DÉFAUT

**Précision R5 :** **EXPÉRIMENTAL OFF** : ne pas activer le défilement au survol avant recette souris/drag.

**Décisions R5 dominantes :** R5-D28…D35.

**Exécution :** OUT_OF_SCOPE_NEXT_STAGE ; preuve NONE.

## UI-095 — A

**Source :** Conserver une largeur de tuile homogène selon la famille d'objets, tout en permettant davantage de place pour les noms longs.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Aucune précision supplémentaire ; invariants généraux applicables.

**Décisions R5 dominantes :** R5-D28…D35.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-096 — A

**Source :** Éviter les textes coupés dans les tuiles ; réduire le contenu avant de réduire sa taille de police.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Aucune précision supplémentaire ; invariants généraux applicables.

**Décisions R5 dominantes :** R5-D28…D35.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-097 — A

**Source :** Positionner les suggestions les plus pertinentes au début, selon le contexte et l'historique exploitable.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Historique peut prioriser une suggestion seulement avec preuve suffisante ; n'admet aucune décision automatiquement.

**Décisions R5 dominantes :** R5-D28…D35.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-098 — A

**Source :** Conserver les choix déjà sélectionnés identifiables, sans les reproposer comme des objets à ajouter une seconde fois.

**Statut normatif :** RETENU — MODIFIÉ PAR R5

**Précision R5 :** Un **type de produit** peut rester ajoutable dans le dock ; une **ligne déjà ajoutée** se modifie sur la carte, sans fusion/doublon accidentel.

**Décisions R5 dominantes :** R5-D28…D35.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-099 — A

**Source :** Prévoir une recherche intégrée lorsque le catalogue contient beaucoup d'options, plutôt que des pages interminables.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Catalogue > dizaines d'options : sous-ensemble pertinent + recherche/filtres ; ne pas afficher 150 vignettes d'un coup.

**Décisions R5 dominantes :** R5-D28…D35.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-100 — A

**Source :** Éviter que le dock saute d'une hauteur à l'autre à chaque modification mineure.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Aucune précision supplémentaire ; invariants généraux applicables.

**Décisions R5 dominantes :** R5-D28…D35.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-101 — A

**Source :** Supprimer les tuiles « Autre », « Plus tard » et « À préciser » lorsqu'elles n'apportent pas une possibilité réellement distincte.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Conserver uniquement une option 'autre mode/produit' qui permet réellement de créer un objet différent ; pas de 'Plus tard' substituable au retour naturel.

**Décisions R5 dominantes :** R5-D28…D35.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-102 — A

**Source :** Occuper l’espace horizontal réellement disponible avec les propositions utiles avant d’en cacher derrière « Autre » ou une deuxième page.

**Statut normatif :** RETENU — INTERPRÉTATION R5

**Précision R5 :** Rendre utiles les espaces existants avant d'ajouter 'Autres' ou pager ; sans tuiles trop étirées.

**Décisions R5 dominantes :** R5-D28…D35.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-103 — C

**Source :** Faire glisser les catégories et objets horizontalement dans une seule rangée à la souris, avec des flèches accessibles et, si pertinent, un auto-défilement modéré au bord après délai.

**Statut normatif :** EXPÉRIMENTAL — INACTIF PAR DÉFAUT

**Précision R5 :** Scroll natif horizontal, souris/molette selon support, flèches et focus ; survol bord OFF par défaut.

**Décisions R5 dominantes :** R5-D28…D35.

**Exécution :** OUT_OF_SCOPE_NEXT_STAGE ; preuve NONE.

## UI-104 — A

**Source :** Garder un seul vocabulaire et une même logique de retour dans tous les docks, sans faire réapparaître des portes de navigation déjà supprimées ailleurs.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Aucune précision supplémentaire ; invariants généraux applicables.

**Décisions R5 dominantes :** R5-D28…D35.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-105 — A

**Source :** Dans un dock de recherche de lieux, garder les suggestions localement connues visibles même avant la première frappe, sans imposer la recherche Google pour les consulter.

**Statut normatif :** RETENU — INTERPRÉTATION R5

**Précision R5 :** Lieux locaux suggérés au repos ; résultats Google frappés à proximité immédiate du champ.

**Décisions R5 dominantes :** R5-D28…D35.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-106 — A

**Source :** Organiser les sous-assets selon la logique Événement → Moment → Famille → Objet.

**Statut normatif :** RETENU — MODIFIÉ PAR R5

**Précision R5 :** Ontologie sémantique, **pas cinq écrans imposés** pour ajouter une boisson.

**Décisions R5 dominantes :** R5-D36…D38.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-107 — A

**Source :** Donner à Before et Au bar un véritable statut de moment, plutôt que de les présenter comme deux boissons ou deux objets.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Before/Au bar ont des owners/sections propres ; ils ne figurent pas dans la liste des produits Boissons.

**Décisions R5 dominantes :** R5-D36…D38.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-108 — C

**Source :** Créer une illustration spécifique au Before : petite table, verres, cartes et ambiance de début de soirée.

**Statut normatif :** RETENU — INTERPRÉTATION R5

**Précision R5 :** Illustration **d'ambiance** de moment, non preuve de Chips/Vodka/etc. sélectionnés.

**Décisions R5 dominantes :** R5-D36…D38.

**Exécution :** OUT_OF_SCOPE_NEXT_STAGE ; preuve NONE.

## UI-109 — A

**Source :** Lorsqu'une boisson est ajoutée, montrer son résultat immédiatement dans le bon moment et conserver le dock Boissons si l'utilisateur veut en ajouter d'autres.

**Statut normatif :** SOUS CONTRAT MÉTIER/PROVIDER

**Précision R5 :** Mutation via owner du **bon moment**, le dock reste sur Boissons pour d'autres ajouts.

**Décisions R5 dominantes :** R5-D36…D38.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-110 — A

**Source :** Afficher Before comme un moment facultatif « Avant de sortir », au même niveau conceptuel qu’« Au bar », et non comme un objet du catalogue Boissons.

**Statut normatif :** RETENU — INTERPRÉTATION R5

**Précision R5 :** Before est un moment optionnel ; son objet principal technique actuel ne doit pas dicter la nomenclature visuelle.

**Décisions R5 dominantes :** R5-D36…D38.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-111 — A

**Source :** Ne créer la section Before que lorsqu’elle est demandée ; conserver une petite action « + Avant de sortir » sur la carte lorsqu’elle est absente.

**Statut normatif :** SOUS CONTRAT MÉTIER/PROVIDER

**Précision R5 :** Cliquer '+ Avant de sortir' peut ouvrir le choix ; **pas de Before persisté vide**. Admission après premier poste réel sous owner.

**Décisions R5 dominantes :** R5-D36…D38.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-112 — C

**Source :** Doter Before d’une illustration contextuelle de table basse avec cartes, verres, bouteille et quelques snacks, dans la même direction artistique que Bar.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** L'ambiance illustrée peut inclure verres/cartes/table, mais une bouteille spécifique ne doit pas sembler une consommation retenue.

**Décisions R5 dominantes :** R5-D36…D38.

**Exécution :** OUT_OF_SCOPE_NEXT_STAGE ; preuve NONE.

## UI-113 — A

**Source :** Quand « + Ajouter » est utilisé dans Before, afficher directement les familles d’objets adaptées à ce moment, sans reproposer « Before ».

**Statut normatif :** RETENU — INTERPRÉTATION R5

**Précision R5 :** Dès le moment actif, accéder familles/objets de Before directement, sans repasser par la porte Before.

**Décisions R5 dominantes :** R5-D36…D38.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-114 — A

**Source :** Associer chaque boisson, aliment et coût au moment auquel il a été ajouté ; ne pas déplacer implicitement un objet d’« Au bar » vers Before.

**Statut normatif :** SOUS CONTRAT MÉTIER/PROVIDER

**Précision R5 :** `selectionId`/owner du Before distinct du parent Au bar ; aucun déplacement tacite de poste.

**Décisions R5 dominantes :** R5-D36…D38.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-115 — A

**Source :** Afficher les différents moments comme sections reconnaissables sans transformer Before en seconde carte ou en événement séparé.

**Statut normatif :** RETENU — INTERPRÉTATION R5

**Précision R5 :** Moment visuel ≠ nouvelle carte indépendante du Board.

**Décisions R5 dominantes :** R5-D36…D38.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-116 — A

**Source :** Afficher des catalogues Boissons et Restauration distincts.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Aucune précision supplémentaire ; invariants généraux applicables.

**Décisions R5 dominantes :** R5-D39…D43.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-117 — A

**Source :** Réserver Bière, Vin, Cocktail, Shot, Soft, Eau et Bouteille au catalogue Boissons.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Aucune précision supplémentaire ; invariants généraux applicables.

**Décisions R5 dominantes :** R5-D39…D43.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-118 — A

**Source :** Réserver Tapas, Planche, Snack, Repas et autres aliments au catalogue Restauration.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Aucune précision supplémentaire ; invariants généraux applicables.

**Décisions R5 dominantes :** R5-D39…D43.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-119 — A

**Source :** Réutiliser les catalogues existants d'autres modules sans ouvrir leurs formulaires complets ni perdre le contexte Bar.

**Statut normatif :** SOUS CONTRAT MÉTIER/PROVIDER

**Précision R5 :** Réemployer asset/métier compatible, **pas** le wizard Restaurant/Repas et pas un nouveau owner universel.

**Décisions R5 dominantes :** R5-D39…D43.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-120 — A

**Source :** Ne pas multiplier les objets identiques sans conserver leurs prix et règles de financement distincts.

**Statut normatif :** SOUS CONTRAT MÉTIER/PROVIDER

**Précision R5 :** Deux lignes identiques peuvent coexister si prix, scope ou financement diffèrent. Ne pas les fusionner par libellé.

**Décisions R5 dominantes :** R5-D39…D43.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-121 — A

**Source :** Regrouper toutes les boissons dans leur famille : Bière, Vin, Cocktail, Shot, Soft, Eau, Bouteille et éventuellement Boisson personnalisée.

**Statut normatif :** SOUS CONTRAT MÉTIER/PROVIDER

**Précision R5 :** Boissons réellement admissibles seulement ; pas 'Before', 'Repas' ni 'Montant direct'.

**Décisions R5 dominantes :** R5-D39…D43.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-122 — A

**Source :** Retirer du catalogue Boissons les entrées Before, Montant direct, « Repas, before et autres choix » et Planche / tapas.

**Statut normatif :** RETENU — INTERPRÉTATION R5

**Précision R5 :** Contrat strict de famille : Before = moment ; Planche/Tapas = Restauration ; global = clic sur montant.

**Décisions R5 dominantes :** R5-D39…D43.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-123 — A

**Source :** Regrouper dans Restauration les catégories Snack, Tapas, Planche, Sandwich, Repas et aliment personnalisé, selon ce que le module sait réellement créer.

**Statut normatif :** SOUS CONTRAT MÉTIER/PROVIDER

**Précision R5 :** Inclure produit personnalisé seulement si une opération métier réelle sait créer ce poste.

**Décisions R5 dominantes :** R5-D39…D43.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-124 — A

**Source :** Dans la soirée, importer le catalogue et ses règles d’un sous-module existant sans ouvrir le scénario complet « Restaurant » ou « Repas » comme un autre événement.

**Statut normatif :** SOUS CONTRAT MÉTIER/PROVIDER

**Précision R5 :** Réutilisation d'un sous-module dans **l'événement parent**, sans seconde demande date/lieu/personnes.

**Décisions R5 dominantes :** R5-D39…D43.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-125 — B

**Source :** Permettre de réutiliser une définition de boisson, repas ou snack dans Bar, Soirée techno, Festival, Voyage et Déclarer une dépense tout en conservant l’événement et le moment propriétaires.

**Statut normatif :** SOUS CONTRAT MÉTIER/PROVIDER

**Précision R5 :** Transfert de grammaire graphique et catalogue sous adaptateur de domaine ; **ne pas généraliser** `EDIT_NIGHT_OUT` à Voyage.

**Décisions R5 dominantes :** R5-D39…D43.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-126 — A

**Source :** Empêcher le retour non sollicité vers une porte générique « Lieu », « Date » ou « Personnes » après avoir sélectionné « Repas » ou « Boissons ».

**Statut normatif :** RETENU — INTERPRÉTATION R5

**Précision R5 :** Après ajout d'un objet, rester dans la même famille/moment ; ne pas déclencher une sous-application.

**Décisions R5 dominantes :** R5-D39…D43.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-127 — A

**Source :** Conserver deux lignes distinctes pour deux bières de prix différents, sauf fusion explicitement choisie et financièrement correcte.

**Statut normatif :** SOUS CONTRAT MÉTIER/PROVIDER

**Précision R5 :** Conserver identités et couvertures distinctes, Undo exact.

**Décisions R5 dominantes :** R5-D39…D43.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-128 — A

**Source :** Supprimer « Bouteille partagée » comme catégorie : une bouteille est un objet, le partage est une propriété financière.

**Statut normatif :** RETENU — MODIFIÉ PAR R5

**Précision R5 :** Bouteille = objet ; `SHARED` désigne une base/unité et **n'est pas** une dette ni une répartition entre personnes.

**Décisions R5 dominantes :** R5-D44…D50.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-129 — A

**Source :** Permettre de configurer qui partage le coût directement depuis la tuile de la bouteille ou des tapas.

**Statut normatif :** SOUS CONTRAT MÉTIER/PROVIDER

**Précision R5 :** Afficher/activer partage effectif **seulement** si l'owner Finance sait persister les parts du poste.

**Décisions R5 dominantes :** R5-D44…D50.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-130 — A

**Source :** Faire apparaître les personnes de la soirée dans le dock lorsqu'on choisit une répartition de frais.

**Statut normatif :** SOUS CONTRAT MÉTIER/PROVIDER

**Précision R5 :** Dock d'avatars lié au **poste ciblé**, pas à tous les coûts de la soirée.

**Décisions R5 dominantes :** R5-D44…D50.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-131 — B

**Source :** Permettre d'ajouter une personne absente de la soirée, avec confirmation de son association à l'événement.

**Statut normatif :** SOUS CONTRAT MÉTIER/PROVIDER

**Précision R5 :** Nouvel invité proposé au partage : association explicite à l'événement si requise ; présence et dette ne sont pas synonymes.

**Décisions R5 dominantes :** R5-D44…D50.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-132 — A

**Source :** Rendre le montant global cliquable directement dans l'en-tête de Bar.

**Statut normatif :** RETENU — MODIFIÉ PAR R5

**Précision R5 :** Le clic sur montant ouvre son **périmètre réellement éditable**, jamais un agrégat calculé librement écrasable.

**Décisions R5 dominantes :** R5-D44…D50.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-133 — A

**Source :** Ouvrir un petit éditeur de montant à proximité du chiffre, plutôt qu'un nouveau catalogue ou un long formulaire.

**Statut normatif :** RETENU — MODIFIÉ PAR R5

**Précision R5 :** Popover ancré près du montant ; si plusieurs scopes, arbitrage précis plutôt qu'un champ total général trompeur.

**Décisions R5 dominantes :** R5-D44…D50.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-134 — B

**Source :** Distinguer visuellement « Aucun montant défini », « Coûts connus partiels » et « Total prévisionnel complet ».

**Statut normatif :** SOUS CONTRAT MÉTIER/PROVIDER

**Précision R5 :** Coût inconnu, zéro reconnu, connu partiel, complet, référence historique et estimation périmée sont six cas distincts.

**Décisions R5 dominantes :** R5-D44…D50.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-135 — B

**Source :** Ne jamais présenter `0,00 €` comme un coût connu lorsque rien n'a été décidé.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** UNKNOWN ≠ 0 explicite ; ne pas 'remettre à zéro' lors d'un passage global → détail.

**Décisions R5 dominantes :** R5-D44…D50.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-136 — B

**Source :** Éviter les répétitions de type « À définir · aucun choix retenu ».

**Statut normatif :** RETENU — INTERPRÉTATION R5

**Précision R5 :** Aucune précision supplémentaire ; invariants généraux applicables.

**Décisions R5 dominantes :** R5-D44…D50.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-137 — B

**Source :** Montrer les prix unitaires uniquement lorsqu'ils sont utiles à la compréhension d'un objet ; privilégier autrement son coût prévu.

**Statut normatif :** RETENU — INTERPRÉTATION R5

**Précision R5 :** Présenter `€/u` quand nécessaire pour éviter l'ambiguïté quantité × base ; ne pas masquer l'unité financière critique.

**Décisions R5 dominantes :** R5-D44…D50.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-138 — B

**Source :** Donner au choix « Total global » et « Détail des consommations » une interaction explicite de remplacement, pour éviter le double comptage.

**Statut normatif :** SOUS CONTRAT MÉTIER/PROVIDER

**Précision R5 :** Global substitutif remplacé seulement dans sa couverture ; entrée additive indépendante conservée ; arbitrage en cas de chevauchement.

**Décisions R5 dominantes :** R5-D44…D50.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-139 — B

**Source :** Conserver les protections RAW et les règles de financement, même si l'interface devient beaucoup plus légère.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Garde RAW/Undo/Finance V2 non négociable même si labels et boutons disparaissent.

**Décisions R5 dominantes :** R5-D44…D50.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-140 — A

**Source :** Remplacer « Bouteille partagée » par « Bouteille » (ou type précis : Vodka, Rhum, etc.), sans préjuger d’un partage.

**Statut normatif :** RETENU — MODIFIÉ PAR R5

**Précision R5 :** Objets neutres ; partage est une action avancée autoritaire sur l'objet, pas un type de bouteille.

**Décisions R5 dominantes :** R5-D44…D50.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-141 — A

**Source :** Après ajout d’une bouteille, permettre de choisir librement quantité, prix, unité et répartition financière depuis l’objet lui-même.

**Statut normatif :** SOUS CONTRAT MÉTIER/PROVIDER

**Précision R5 :** Options avancées ouvertes à la demande ; part personnelle et remboursements seulement sous contrat Finance prouvé.

**Décisions R5 dominantes :** R5-D44…D50.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-142 — A

**Source :** Lorsque « Partager les frais » est activé, proposer d’abord les participants déjà associés à la soirée.

**Statut normatif :** SOUS CONTRAT MÉTIER/PROVIDER

**Précision R5 :** Prioriser contacts déjà présents, sans supposer qu'ils partagent les coûts.

**Décisions R5 dominantes :** R5-D44…D50.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-143 — B

**Source :** Si une nouvelle personne est choisie pour un partage, prévoir explicitement son rattachement à la soirée, sans déduire qu’elle paie d’autres postes.

**Statut normatif :** SOUS CONTRAT MÉTIER/PROVIDER

**Précision R5 :** Ne faire payer aucun autre poste automatiquement quand un contact rejoint un partage.

**Décisions R5 dominantes :** R5-D44…D50.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-144 — B

**Source :** Conserver le coût total de l’objet distinct de la part individuelle et d’un éventuel remboursement attendu ; ne pas diviser le coût total de l’événement par défaut.

**Statut normatif :** SOUS CONTRAT MÉTIER/PROVIDER

**Précision R5 :** Montant bouteille complet ≠ part individuelle ≠ payé par portefeuille ≠ dette/remboursement.

**Décisions R5 dominantes :** R5-D44…D50.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-145 — B

**Source :** Réutiliser les règles de partage et de financement existantes lorsqu’elles s’appliquent, y compris les cas de type Swile, sans inventer une prise en charge.

**Statut normatif :** SOUS CONTRAT MÉTIER/PROVIDER

**Précision R5 :** Swile/Edenred : uniquement si éligibilité **du poste et de la transaction** démontrée ; pas de badge implicite sur alcool.

**Décisions R5 dominantes :** R5-D44…D50.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-146 — B

**Source :** Lorsque l’utilisateur saisit d’abord un montant global puis détaille ses consommations, remplacer le global par le détail selon une règle explicitée, sans cumul accidentel et sans effacer silencieusement du RAW.

**Statut normatif :** SOUS CONTRAT MÉTIER/PROVIDER

**Précision R5 :** Pas `50 + 8 = 58` si couvertures se chevauchent ; pas `0` inventé ; remplacement ciblé undoable avec IDs/funding.

**Décisions R5 dominantes :** R5-D44…D50.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-147 — A

**Source :** Concevoir des mini-éditeurs propres à chaque objet : quantités, prix et options sur une seule petite surface.

**Statut normatif :** SOUS CONTRAT MÉTIER/PROVIDER

**Précision R5 :** Mini-éditeur court et spécifique, mutation propriétaire ; prix RAW différent du Draft admis.

**Décisions R5 dominantes :** R5-D25…D27, D41…D42.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-148 — A

**Source :** Faire varier ces mini-éditeurs selon le type de donnée : compteur pour une quantité, choix illustrés pour une boisson, sélection d'avatars pour le partage.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Le même style de tuile peut contenir des contrôles différents selon l'objet et le moment.

**Décisions R5 dominantes :** R5-D25…D27, D41…D42.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-149 — A

**Source :** Éviter de transformer chaque mini-module en formulaire avec cinq labels et quatre boutons.

**Statut normatif :** RETENU — INTERPRÉTATION R5

**Précision R5 :** Aucune précision supplémentaire ; invariants généraux applicables.

**Décisions R5 dominantes :** R5-D25…D27, D41…D42.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-150 — A

**Source :** Garder les unités, noms personnalisés et détails de financement accessibles dans un niveau secondaire.

**Statut normatif :** SOUS CONTRAT MÉTIER/PROVIDER

**Précision R5 :** Menu ⋯ accessible au clavier, détails de provenance/financement non détruits.

**Décisions R5 dominantes :** R5-D25…D27, D41…D42.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-151 — A

**Source :** Éditer quantité, prix et options par interaction directe sur une petite tuile, plutôt que déployer une fiche complète sous l’objet.

**Statut normatif :** SOUS CONTRAT MÉTIER/PROVIDER

**Précision R5 :** La tuile Bière déjà admise se modifie sur place, sans injecter une grande fiche longue.

**Décisions R5 dominantes :** R5-D25…D27, D41…D42.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-152 — A

**Source :** Alléger les libellés tels que « Quantité totale », « Prix unitaire (€) », « Détails du poste », « Unité, financement et nom » ; conserver seulement les indices indispensables et ouvrir les détails à la demande.

**Statut normatif :** RETENU — INTERPRÉTATION R5

**Précision R5 :** Aucune précision supplémentaire ; invariants généraux applicables.

**Décisions R5 dominantes :** R5-D25…D27, D41…D42.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-153 — A

**Source :** Si la valeur a déjà été saisie, ne pas imposer de clic supplémentaire sur « Enregistrer » lorsque l’action peut être appliquée sans ambiguïté.

**Statut normatif :** SOUS CONTRAT MÉTIER/PROVIDER

**Précision R5 :** Entrée, ou blur **démontré sûr** seulement ; jamais autosave caractère ni garde RAW supprimée.

**Décisions R5 dominantes :** R5-D25…D27, D41…D42.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-154 — A

**Source :** Utiliser icônes compréhensibles, compteurs et sélecteurs contextuels sans créer de menus incompréhensibles ou de contrôle sans retour visible.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Aucune précision supplémentaire ; invariants généraux applicables.

**Décisions R5 dominantes :** R5-D25…D27, D41…D42.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-155 — A

**Source :** Séparer les propositions de trajets habituels des choix de mode de transport.

**Statut normatif :** RETENU — MODIFIÉ PAR R5

**Précision R5 :** Modes et trajets complets appartiennent à deux catalogues/sous-étapes différents.

**Décisions R5 dominantes :** R5-D51…D54.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-156 — A

**Source :** Présenter les modes Voiture, Tram/Train, Bus, Taxi/Uber et À pied avec des illustrations de même style et de même taille.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Illustration À pied nécessaire ; modes courts et pertinents, pas 'Autre transport' ambigu en façade.

**Décisions R5 dominantes :** R5-D51…D54.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-157 — A

**Source :** Afficher les trajets déjà connus sous une forme compacte : `Maison → Le Café Riche · Peugeot 207`.

**Statut normatif :** SOUS CONTRAT MÉTIER/PROVIDER

**Précision R5 :** Suggestion de route ≠ trajet décidé ; nom véhicule compact, coût seulement après estimation.

**Décisions R5 dominantes :** R5-D51…D54.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-158 — B

**Source :** Garder la fiche technique détaillée du véhicule dans une information secondaire.

**Statut normatif :** SOUS CONTRAT MÉTIER/PROVIDER

**Précision R5 :** Détails véhicule en seconde lecture, `Peugeot 207` au premier niveau.

**Décisions R5 dominantes :** R5-D51…D54.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-159 — A

**Source :** Ne pas afficher les choix « Plus tard » et « À préciser » comme modes de transport.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Aucune précision supplémentaire ; invariants généraux applicables.

**Décisions R5 dominantes :** R5-D51…D54.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-160 — A

**Source :** Prévoir un mode personnalisé dans les options avancées pour les transports non couverts.

**Statut normatif :** SOUS CONTRAT MÉTIER/PROVIDER

**Précision R5 :** Transport libre dans détails uniquement si le contrat permet réellement sa description.

**Décisions R5 dominantes :** R5-D51…D54.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-161 — B

**Source :** Rendre l'Aller et le Retour visuellement distincts, tout en leur donnant la même structure graphique.

**Statut normatif :** RETENU — INTERPRÉTATION R5

**Précision R5 :** Aller et Retour indépendants par sens/identité ; Retour peut être décidé en premier.

**Décisions R5 dominantes :** R5-D51…D54.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-162 — B

**Source :** Afficher distance, carburant et péages uniquement lorsqu'une estimation correspondante est réellement disponible.

**Statut normatif :** SOUS CONTRAT MÉTIER/PROVIDER

**Précision R5 :** Distance/carburant/péages affichés si owner et digest **frais et correspondants** à ce trajet, pas valeur obsolète.

**Décisions R5 dominantes :** R5-D51…D54.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-163 — B

**Source :** Transformer les longs textes d'indisponibilité Mobility en une indication courte comme « Estimation indisponible », avec explication accessible au besoin.

**Statut normatif :** SOUS CONTRAT MÉTIER/PROVIDER

**Précision R5 :** Explication longue à la demande ; la valeur inconnue n'est pas 0 €.

**Décisions R5 dominantes :** R5-D51…D54.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-164 — B

**Source :** Proposer un ajustement lorsque le bar change, sans remplacer automatiquement les lieux de départ ou de retour personnalisés.

**Statut normatif :** SOUS CONTRAT MÉTIER/PROVIDER

**Précision R5 :** Ne mettre à jour que les endpoints **explicitement liés** au bar. Ne jamais déduire un lien via nom ou distance.

**Décisions R5 dominantes :** R5-D51…D54.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-165 — A

**Source :** Ne pas mêler dans la même rangée un trajet habituel long avec les simples modes de transport ; afficher le trajet connu comme suggestion distincte et courte.

**Statut normatif :** RETENU — INTERPRÉTATION R5

**Précision R5 :** Aucune précision supplémentaire ; invariants généraux applicables.

**Décisions R5 dominantes :** R5-D51…D54.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-166 — A

**Source :** Prévoir pour « À pied » et les autres modes une illustration visible et harmonisée, y compris à petite taille.

**Statut normatif :** RETENU — INTERPRÉTATION R5

**Précision R5 :** Aucune précision supplémentaire ; invariants généraux applicables.

**Décisions R5 dominantes :** R5-D51…D54.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-167 — B

**Source :** Réutiliser le calculateur existant de « Déclarer une dépense » pour les distances, carburants, péages et illustrations de trajets lorsque leurs contrats sont compatibles.

**Statut normatif :** SOUS CONTRAT MÉTIER/PROVIDER

**Précision R5 :** Réutiliser le fournisseur/calculateur déjà disponible, **aucun second moteur de route ni calcul front improvisé**.

**Décisions R5 dominantes :** R5-D51…D54.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-168 — A

**Source :** Garder le choix de transport facultatif : ne pas ajouter « Plus tard » si l’utilisateur peut simplement ne rien choisir.

**Statut normatif :** SOUS CONTRAT MÉTIER/PROVIDER

**Précision R5 :** Absence de choix = transport non décidé, pas option 'On verra plus tard'.

**Décisions R5 dominantes :** R5-D51…D54.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-169 — B

**Source :** Éviter d’afficher en première ligne le nom technique complet du véhicule ; privilégier « Peugeot 207 » avec ses spécifications en second niveau.

**Statut normatif :** SOUS CONTRAT MÉTIER/PROVIDER

**Précision R5 :** N'afficher constructeur/modèle court ; motorisation/carburant/BVM accessibles au détail.

**Décisions R5 dominantes :** R5-D51…D54.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-170 — C

**Source :** Réduire la hauteur des cartes simples qui n'ont encore aucun choix utilisateur.

**Statut normatif :** RETENU — INTERPRÉTATION R5

**Précision R5 :** Compacter également l'empreinte de grille et non seulement l'intérieur de la petite carte.

**Décisions R5 dominantes :** R5-D03…D12, D63.

**Exécution :** OUT_OF_SCOPE_NEXT_STAGE ; preuve NONE.

## UI-171 — C

**Source :** Afficher un seul état « À prévoir » ou « À définir », plutôt que plusieurs formulations équivalentes.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** N'afficher qu'un seul état utile sans prix fictif à 0 €.

**Décisions R5 dominantes :** R5-D03…D12, D63.

**Exécution :** OUT_OF_SCOPE_NEXT_STAGE ; preuve NONE.

## UI-172 — C

**Source :** Ne pas utiliser une énorme taille de police pour une absence de décision, au détriment du nom de l'objet.

**Statut normatif :** RETENU — INTERPRÉTATION R5

**Précision R5 :** Typographie de l'objet et de la décision prioritaire à celle de l'absence.

**Décisions R5 dominantes :** R5-D03…D12, D63.

**Exécution :** OUT_OF_SCOPE_NEXT_STAGE ; preuve NONE.

## UI-173 — C

**Source :** Faire de l'illustration et du titre les deux éléments les plus importants des cartes non configurées.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Illustration d'univers **décorative** clairement distincte d'un poste économique ajouté.

**Décisions R5 dominantes :** R5-D03…D12, D63.

**Exécution :** OUT_OF_SCOPE_NEXT_STAGE ; preuve NONE.

## UI-174 — C

**Source :** Afficher les détails économiques uniquement lorsque des informations suffisantes existent.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Aucune précision supplémentaire ; invariants généraux applicables.

**Décisions R5 dominantes :** R5-D03…D12, D63.

**Exécution :** OUT_OF_SCOPE_NEXT_STAGE ; preuve NONE.

## UI-175 — C

**Source :** Rendre chaque carte voisine directement manipulable depuis son information principale : fréquence, prix, quantité ou destination, selon sa nature.

**Statut normatif :** SOUS CONTRAT MÉTIER/PROVIDER

**Précision R5 :** Clic sur le prix/fréquence visible du preset correspondant ; ne pas copier de force l'éditeur Bar.

**Décisions R5 dominantes :** R5-D03…D12, D63.

**Exécution :** OUT_OF_SCOPE_NEXT_STAGE ; preuve NONE.

## UI-176 — B

**Source :** Permettre à la carte Bar fermée de présenter une synthèse de sa soirée : lieu, date, personnes, quelques consommations et éventuels trajets.

**Statut normatif :** SOUS CONTRAT MÉTIER/PROVIDER

**Précision R5 :** Synthèse **bornée** : groupes et +N ; accès réel aux deux trajets et à tous les postes, pas liste complète forcée.

**Décisions R5 dominantes :** R5-D03…D12, D63.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-177 — C

**Source :** Préserver un alignement cohérent des cartes entre elles, même lorsque certaines contiennent beaucoup plus de données.

**Statut normatif :** RETENU — INTERPRÉTATION R5

**Précision R5 :** Alignement calme sans imposer une hauteur commune artificielle.

**Décisions R5 dominantes :** R5-D03…D12, D63.

**Exécution :** OUT_OF_SCOPE_NEXT_STAGE ; preuve NONE.

## UI-178 — C

**Source :** Éviter de forcer toutes les cartes fermées dans un format dont la hauteur dépend de la carte voisine la plus dense.

**Statut normatif :** RETENU — INTERPRÉTATION R5

**Précision R5 :** Hauteur intrinsèque propre à chaque carte, malgré CSS Grid voisin.

**Décisions R5 dominantes :** R5-D03…D12, D63.

**Exécution :** OUT_OF_SCOPE_NEXT_STAGE ; preuve NONE.

## UI-179 — B

**Source :** Dans la carte Bar fermée, réutiliser l’espace disponible pour faire ressortir le contexte réellement choisi et ses objets, plutôt que laisser une grande zone vide.

**Statut normatif :** RETENU — INTERPRÉTATION R5

**Précision R5 :** Placer les informations **réelles** dans l'espace présent, pas agrandir la cellule pour meubler.

**Décisions R5 dominantes :** R5-D03…D12, D63.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-180 — C

**Source :** Ne pas grossir artificiellement une carte fermée avec du texte explicatif ; remplir la surface par une composition graphique sobre et des contenus réels.

**Statut normatif :** RETENU — INTERPRÉTATION R5

**Précision R5 :** Décor à empreinte constante ; si le Board réserve 760px inutilement, corriger le packer d'abord.

**Décisions R5 dominantes :** R5-D03…D12, D63.

**Exécution :** OUT_OF_SCOPE_NEXT_STAGE ; preuve NONE.

## UI-181 — C

**Source :** Rationaliser les cartes Mascara, Sourcils, Vêtements et Maison petit qui répètent « À définir » et « Aucun choix retenu » sur plusieurs lignes.

**Statut normatif :** RETENU — INTERPRÉTATION R5

**Précision R5 :** Un seul 'À prévoir' au lieu de lignes redondantes ; garder prix de référence seulement si qualifié et pertinent.

**Décisions R5 dominantes :** R5-D03…D12, D63.

**Exécution :** OUT_OF_SCOPE_NEXT_STAGE ; preuve NONE.

## UI-182 — C

**Source :** Éviter qu’une carte détaillée oblige ses voisines à s’étirer verticalement et à afficher des zones blanches inutiles.

**Statut normatif :** RETENU — INTERPRÉTATION R5

**Précision R5 :** Ne jamais étirer les petites voisines par la grande carte sur leur rangée.

**Décisions R5 dominantes :** R5-D03…D12, D63.

**Exécution :** OUT_OF_SCOPE_NEXT_STAGE ; preuve NONE.

## UI-183 — C

**Source :** Lorsque Bar est vide, utiliser une illustration d'ambiance plus présente plutôt qu'une grande surface blanche.

**Statut normatif :** RETENU — INTERPRÉTATION R5

**Précision R5 :** Ambiance Clay douce **dans** l'espace déjà utile, jamais surlargeur/surhauteur pour décor.

**Décisions R5 dominantes :** R5-D56…D68.

**Exécution :** OUT_OF_SCOPE_NEXT_STAGE ; preuve NONE.

## UI-184 — C

**Source :** Lorsque Bar est riche, diminuer le décor et donner la priorité aux véritables éléments sélectionnés.

**Statut normatif :** RETENU — INTERPRÉTATION R5

**Précision R5 :** Densité de la **scène affichée** gouverne la quantité de décor, pas seulement total de postes en arrière-plan.

**Décisions R5 dominantes :** R5-D56…D68.

**Exécution :** OUT_OF_SCOPE_NEXT_STAGE ; preuve NONE.

## UI-185 — C

**Source :** Introduire des ombres, reflets ou motifs contextuels discrets propres à chaque catégorie d'asset, avec une bibliothèque graphique réutilisable.

**Statut normatif :** EXPÉRIMENTAL

**Précision R5 :** Fonds matière/reflet ultra discrets, sans lire un halo comme statut de prix.

**Décisions R5 dominantes :** R5-D56…D68.

**Exécution :** OUT_OF_SCOPE_NEXT_STAGE ; preuve NONE.

## UI-186 — A

**Source :** Utiliser une seule famille d'illustrations 3D pour les objets, transports, moments et catégories, avec des miniatures réellement lisibles.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Réutiliser d'abord bibliothèque Clay du Builder ; vérifier cadrage WebP 2:1 et lisibilité petit format.

**Décisions R5 dominantes :** R5-D56…D68.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-187 — A

**Source :** Supprimer les pictogrammes génériques violets lorsqu'une illustration contextuelle claire existe.

**Statut normatif :** RETENU — INTERPRÉTATION R5

**Précision R5 :** Remplacer les icônes génériques uniquement quand une vraie image Clay reconnaissable existe ; garder icônes fonctionnelles pour action.

**Décisions R5 dominantes :** R5-D56…D68.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-188 — C

**Source :** Créer une identité visuelle commune à toutes les cartes de Budgetisation, déclinée par univers : bar, soirée, voyage, maison, vêtements, tabac/vape, etc.

**Statut normatif :** RETENU — INTERPRÉTATION R5

**Précision R5 :** Design system commun, accent Bar ambre, Soirée prune, Voyage horizon, Maison sauge, etc. ; même focus et état financier partout.

**Décisions R5 dominantes :** R5-D56…D68.

**Exécution :** OUT_OF_SCOPE_NEXT_STAGE ; preuve NONE.

## UI-189 — C

**Source :** Favoriser des fonds très discrets : ombres projetées, reflets de verres, lumière d’ambiance, matières ou silhouettes contextuelles, plutôt qu’une grande photo derrière les textes.

**Statut normatif :** RETENU — INTERPRÉTATION R5

**Précision R5 :** Effet décoratif stable et non interactif ; supprimer si concurrence avec prix/nom/objets.

**Décisions R5 dominantes :** R5-D56…D68.

**Exécution :** OUT_OF_SCOPE_NEXT_STAGE ; preuve NONE.

## UI-190 — C

**Source :** Pour Bar, explorer une palette crème/ambre avec ombres de verres, silhouette de comptoir et reflets dorés ; pour Soirée des lumières violettes ; pour Voyage des ombres d’horizon ou de végétation.

**Statut normatif :** HYPOTHÈSE À MESURER

**Précision R5 :** **Hypothèses visuelles**, pas palette validée ; calibrer sur Board complet, contrastes et 125% natif.

**Décisions R5 dominantes :** R5-D56…D68.

**Exécution :** OUT_OF_SCOPE_NEXT_STAGE ; preuve NONE.

## UI-191 — C

**Source :** Associer au thème un accent décoratif 3D facultatif sur la carte vide ; le réduire à mesure que les consommations et informations réelles occupent la carte.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Clay décoratif ≠ achat ; ambiance s'efface quand les vrais objets occupent la carte.

**Décisions R5 dominantes :** R5-D56…D68.

**Exécution :** OUT_OF_SCOPE_NEXT_STAGE ; preuve NONE.

## UI-192 — C

**Source :** Définir une banque de variantes limitées pour chaque univers (par exemple trois ambiances Bar cohérentes), sans changer aléatoirement l’image à chaque rendu.

**Statut normatif :** DIFFÉRÉ

**Précision R5 :** **Différé** : démarrer avec UNE ambiance Bar stable. Jusqu'à 3 variantes seulement après besoin démontré ; pas 10 variantes d'emblée.

**Décisions R5 dominantes :** R5-D56…D68.

**Exécution :** OUT_OF_SCOPE_NEXT_STAGE ; preuve NONE.

## UI-193 — C

**Source :** Si une variante est choisie à la création, la stabiliser durablement pour la carte afin d’éviter un décor différent après chaque rechargement.

**Statut normatif :** SOUS CONTRAT MÉTIER/PROVIDER

**Précision R5 :** Variante future déterministe par carte, pas de nouveau schéma de persistance sans propriétaire explicite.

**Décisions R5 dominantes :** R5-D56…D68.

**Exécution :** OUT_OF_SCOPE_NEXT_STAGE ; preuve NONE.

## UI-194 — C

**Source :** N’utiliser une sous-catégorie de bar (cocktails, pub/brasserie, vin) pour le décor que si elle est étayée par une classification fiable ; sinon conserver le thème Bar générique.

**Statut normatif :** SOUS CONTRAT MÉTIER/PROVIDER

**Précision R5 :** Catégorie de bar uniquement si source/owner fiable ; aucun classification par guessing du nom ou photo.

**Décisions R5 dominantes :** R5-D56…D68.

**Exécution :** OUT_OF_SCOPE_NEXT_STAGE ; preuve NONE.

## UI-195 — C

**Source :** Ne jamais ajouter de question obligatoire « Quel type de bar ? » uniquement pour choisir le décor.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Aucune précision supplémentaire ; invariants généraux applicables.

**Décisions R5 dominantes :** R5-D56…D68.

**Exécution :** OUT_OF_SCOPE_NEXT_STAGE ; preuve NONE.

## UI-196 — C

**Source :** Envisager une personnalisation facultative « Changer l’ambiance » dans les options secondaires de la carte.

**Statut normatif :** DIFFÉRÉ

**Précision R5 :** **Différé** : pas d'action 'Changer l'ambiance' dans le premier périmètre.

**Décisions R5 dominantes :** R5-D56…D68.

**Exécution :** OUT_OF_SCOPE_NEXT_STAGE ; preuve NONE.

## UI-197 — B

**Source :** Ne pas utiliser les photos Google/My Business comme fond principal obligatoire de Bar : réserver de préférence la photo réelle à la tuile du lieu, à son aperçu ou à son détail.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Photo fournisseur = illustration **du lieu**, jamais fond identitaire obligatoire de l'événement.

**Décisions R5 dominantes :** R5-D56…D68.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-198 — A

**Source :** Rendre les images de lieux, boissons et transports reconnaissables sur de petites tuiles ; remplacer les miniatures blanches ou quasiment invisibles.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Tester la miniature réellement rendue à 30–40px, corriger cadrage 2:1 ou fallback : un fichier présent n'est pas preuve lisible.

**Décisions R5 dominantes :** R5-D56…D68.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-199 — A

**Source :** Préserver une différence nette entre décoration et objets réellement ajoutés à la soirée.

**Statut normatif :** À VALIDATION VISUELLE

**Précision R5 :** Quatre états distincts : décor, proposition au dock, objet sélectionné sur carte, statut financier.

**Décisions R5 dominantes :** R5-D56…D68.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-200 — C

**Source :** Réduire les espaces verticaux inutiles entre les cartes, la pagination du Board et le dock.

**Statut normatif :** RETENU — INTERPRÉTATION R5

**Précision R5 :** Réduire la réserve passive Board/dock sans déplacer la carte à chaque réponse asynchrone.

**Décisions R5 dominantes :** R5-D01…D12, D31…D35.

**Exécution :** OUT_OF_SCOPE_NEXT_STAGE ; preuve NONE.

## UI-201 — A

**Source :** Conserver une séparation claire entre la pagination du Board et le défilement horizontal des catalogues.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Trois navigations distinctes : pagination Board, rail de proposition, pagination sémantique de groupes possédés.

**Décisions R5 dominantes :** R5-D01…D12, D31…D35.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-202 — A

**Source :** Ne jamais présenter deux systèmes de navigation numérotée simultanément si l'un peut devenir un carrousel.

**Statut normatif :** RETENU — MODIFIÉ PAR R5

**Précision R5 :** Dock jamais paginé ; le détail de 20 postes peut l'être ; ne pas cloner une seconde pagination Board.

**Décisions R5 dominantes :** R5-D01…D12, D31…D35.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-203 — A

**Source :** Garantir que les propositions de dock sont entièrement visibles, sans être coupées par le bas de la fenêtre.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Vérifier bas d'écran à 1152×720 et zoom 125% ; pas de tuile inaccessible.

**Décisions R5 dominantes :** R5-D01…D12, D31…D35.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-204 — A

**Source :** Positionner le dock de manière stable pendant l'édition, avec une hauteur maîtrisée.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Dock fait partie du viewport utile et se masque lorsqu'inutile à transition stable.

**Décisions R5 dominantes :** R5-D01…D12, D31…D35.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-205 — C

**Source :** Décorréler la largeur visuelle de la carte et l’empreinte réservée dans le moteur de placement, pour que la place libérée serve réellement à d’autres cartes.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Clarification R5 : la largeur rendue ET le `columnSpan` réservé doivent diminuer ensemble ; pas de dissociation durable des deux.

**Décisions R5 dominantes :** R5-D01…D12, D31…D35.

**Exécution :** OUT_OF_SCOPE_NEXT_STAGE ; preuve NONE.

## UI-206 — C

**Source :** Ne pas laisser un grand trou vide dans le Board simplement parce qu’une carte compactée conserve un grand emplacement virtuel.

**Statut normatif :** RETENU — INTERPRÉTATION R5

**Précision R5 :** Le packer récupère physiquement l'espace, sans densification agressive pendant saisie.

**Décisions R5 dominantes :** R5-D01…D12, D31…D35.

**Exécution :** OUT_OF_SCOPE_NEXT_STAGE ; preuve NONE.

## UI-207 — C

**Source :** Rendre la transition compact ↔ détaillé stable, sans chevauchement, collision ou déplacement disproportionné des cartes voisines.

**Statut normatif :** SOUS CONTRAT MÉTIER/PROVIDER

**Précision R5 :** Conserver ancre/carte active, gel pendant focus/drag et repack lors de transition explicite.

**Décisions R5 dominantes :** R5-D01…D12, D31…D35.

**Exécution :** OUT_OF_SCOPE_NEXT_STAGE ; preuve NONE.

## UI-208 — C

**Source :** Conserver des éléments de navigation de Board reconnaissables sans multiplier les libellés redondants autour de « Précédente / Page 2 sur 3 / 1 2 3 / Suivante ».

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Une seule pagination Board reconnaissable ; titre/label court, pas 5 variantes de précédent/suivant.

**Décisions R5 dominantes :** R5-D01…D12, D31…D35.

**Exécution :** OUT_OF_SCOPE_NEXT_STAGE ; preuve NONE.

## UI-209 — B

**Source :** Utiliser des animations très courtes pour matérialiser le passage d'une scène à l'autre, sans ralentir les actions répétées.

**Statut normatif :** RETENU — INTERPRÉTATION R5

**Précision R5 :** Transitions courtes et non bloquantes ; aucun délai supplémentaire entre deux ajouts rapides.

**Décisions R5 dominantes :** R5-D55, D64…D76.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-210 — B

**Source :** Faire apparaître les résultats économiques immédiatement après une modification, et distinguer une éventuelle actualisation serveur encore en cours.

**Statut normatif :** SOUS CONTRAT MÉTIER/PROVIDER

**Précision R5 :** Décision admise visible immédiatement, total agrégé seulement lorsqu'il est recalculé/frais ; ne pas confondre SAVED/FRESH/APPLIED.

**Décisions R5 dominantes :** R5-D55, D64…D76.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-211 — B

**Source :** Conserver des zones cliquables confortables, même lorsque le texte visible est réduit.

**Statut normatif :** RETENU — INTERPRÉTATION R5

**Précision R5 :** Ne pas gagner de compacité en réduisant les zones de clic à 16 px ; prioriser moins de mots.

**Décisions R5 dominantes :** R5-D55, D64…D76.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-212 — B

**Source :** Utiliser des infobulles seulement pour les fonctions peu évidentes ; ne pas remplacer une interaction incompréhensible par davantage de texte caché.

**Statut normatif :** RETENU — INTERPRÉTATION R5

**Précision R5 :** Tooltip n'est pas un substitut à affordance incohérente ; accessible au clavier si nécessaire.

**Décisions R5 dominantes :** R5-D55, D64…D76.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-213 — B

**Source :** Ne pas montrer les termes techniques `Compiler/V2`, `projection FRESH`, `RAW` ou les sources de données dans l'interface courante.

**Statut normatif :** RETENU — INTERPRÉTATION R5

**Précision R5 :** Cacher le jargon du premier niveau, mais garder états et traçabilité pour l'audit financier.

**Décisions R5 dominantes :** R5-D55, D64…D76.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-214 — B

**Source :** Conserver les informations de provenance et d'incertitude dans les détails accessibles, sans les supprimer du système ni encombrer les tuiles.

**Statut normatif :** SOUS CONTRAT MÉTIER/PROVIDER

**Précision R5 :** Les sources et la provenance existent au niveau secondaire, pas dans la tuile compacte.

**Décisions R5 dominantes :** R5-D55, D64…D76.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-215 — B

**Source :** Vérifier systématiquement les transitions avec la souris et le clavier sur desktop, aux résolutions prévues et au zoom navigateur 125 %, sans scroll vertical dans les cartes.

**Statut normatif :** CRITÈRE DE RECETTE

**Précision R5 :** Validation **desktop souris + clavier**, 1152×720, 1440×900, 1920×1080, **zoom natif 125%**, reduced motion ; pas de campagne tactile.

**Décisions R5 dominantes :** R5-D55, D64…D76.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-216 — A

**Source :** Supprimer les phrases qui expliquent des actions évidentes : « 3 lieu(x) correspondant(s) · choisissez une proposition dans le dock », « Choisir dans les lieux enregistrés » ou « Toutes les précisions restent facultatives » si la scène suffit.

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Aucune précision supplémentaire ; invariants généraux applicables.

**Décisions R5 dominantes :** R5-D55, D64…D76.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-217 — A

**Source :** Transformer les titres redondants en intitulés contextuels courts ; ne pas afficher successivement « Chercher dans les lieux enregistrés », « Lieux enregistrés · Chercher un bar », « Autres possibilités » et « Historique et sources ».

**Statut normatif :** RETENU — CIBLE UX

**Précision R5 :** Aucune précision supplémentaire ; invariants généraux applicables.

**Décisions R5 dominantes :** R5-D55, D64…D76.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-218 — B

**Source :** Ne pas afficher de termes internes comme « Brouillon simulé par le Compiler/V2 » dans le parcours normal.

**Statut normatif :** SOUS CONTRAT MÉTIER/PROVIDER

**Précision R5 :** Diagnostic Compiler/V2 réservé à l'outil technique, jamais collé à la carte.

**Décisions R5 dominantes :** R5-D55, D64…D76.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-219 — C

**Source :** Raccourcir les statuts financiers des petites cartes, sans réduire la distinction entre un prix de référence, un choix validé, une inconnue et un coût réel.

**Statut normatif :** SOUS CONTRAT MÉTIER/PROVIDER

**Précision R5 :** Ne pas faire passer `Référence 32€` pour `32€ retenus`; qualifier historique/UNKNOWN/usage.

**Décisions R5 dominantes :** R5-D55, D64…D76.

**Exécution :** OUT_OF_SCOPE_NEXT_STAGE ; preuve NONE.

## UI-220 — B

**Source :** Protéger l’accessibilité clavier, le focus et la lisibilité malgré la suppression de textes explicatifs.

**Statut normatif :** SOUS CONTRAT MÉTIER/PROVIDER

**Précision R5 :** Tab/Espace/Entrée/Échap et focus restauré ; noms accessibles même si icône sans texte.

**Décisions R5 dominantes :** R5-D55, D64…D76.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-221 — B

**Source :** Limiter la validation navigateur au desktop réellement utilisé : souris, clavier, largeurs prévues et zoom natif, sans campagne tactile hors périmètre.

**Statut normatif :** CRITÈRE DE RECETTE

**Précision R5 :** **Périmètre explicitement desktop** ; tests tactiles/mobile non exigés pour cette phase.

**Décisions R5 dominantes :** R5-D55, D64…D76.

**Exécution :** NOT_RUN ; preuve NONE.

## UI-222 — B

**Source :** Vérifier dans des états vides et riches qu’aucun dock, résultat Google, calendrier ou tuile de sélection n’est coupé par le bas de la fenêtre.

**Statut normatif :** CRITÈRE DE RECETTE

**Précision R5 :** Scènes représentatives vides/partielles/riches, avec dock et Google chargés/échoués, aucune commande coupée.

**Décisions R5 dominantes :** R5-D55, D64…D76.

**Exécution :** NOT_RUN ; preuve NONE.
