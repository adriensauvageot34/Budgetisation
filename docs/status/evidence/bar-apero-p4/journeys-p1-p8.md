# P1–P8 — réception intégrée P4

Code final : `ccfefe0f4ee06e76c02eeaeb74e824cb587ebacf`. Réception React/Compiler/PGlite, HTTP loopback et navigateur **synthétiques** ; aucun PASS Auth ou fournisseur réel. Les huit lignes ci-dessous ne sont pas huit E2E authentifiés.

| Parcours | Résultat / niveau réellement exécuté | Identités, coût officiel et preuve | Étapes / limite UX |
|---|---|---|---|
| P1 Deux bières seulement | PASS_REACT, PARTIAL parcours complet | P2 `V2-02_BEER_THEN_STEPPER_ADMITTED_IN_TWO_GESTURES` : Bière UNKNOWN, même sélection, quantité2 ; ni lieu ni date ni leg exigé | Deux gestes dans l’éditeur : Bière puis +. Création Library en plus. Sauvegarde UNKNOWN testée HTTP séparément ; pas de compteur de clics E2E inventé |
| P2 Bar connu, date, deux legs, Bière | PARTIAL intégré ; sous-chemins PASS_REACT/PGLITE | P3 `P3_15_17...`, P2 `V2-04...`, Mobility `BAR_TWO_LEGS_APPLY_RELOAD_C0_IDENTITIES_NO_OWNER_WRITES` ; endpoints et IDs autonomes ; coût selon summary Mobility officiel | Pas de nouveau leg au choix du Bar. Pas de campagne unique combinant toutes les étapes et une nouvelle session Auth |
| P3 Date et trois amis | PASS_REACT | P2 `V2-04_DATE_THREE_PEOPLE_NO_TRAILING_CONFIRMATION` : date17/11, trois références explicites ; aucun composant économique | Date + jour + Personnes +3 choix ; pas de validation finale obligatoire. Six clics de contrôle React, hors création Library ; pas une mesure de durée |
| P4 Consommations différentes | PASS_REACT + PASS_COMPILER | `P4_P4_ITEM_PERSON_SHARED_PRESENTS_INDEPENDENT_AND_ZERO` ; ITEM12, PERSON32 (2×2×8), SHARED25 ; officiel69.00, six présents indépendants. IDs/digest dans `states.json:item-person-shared` | Chemin court ITEM/SHARED ; éditeur d’unité existant pour PERSON. Les choix d’unité restent nécessaires ; aucune multiplication générique par les invités |
| P5 Before riche + bar + trajets | PARTIAL intégré ; Before PASS_REACT/PGLITE/BROWSER_FIXTURE | `rich-before`: 39.00 = lot26 +diluant4 +snack3 +Bière6, identité child/link/bottle stable ; même produit Bar40 indépendant =>79.00 ; Apply/Reload isolé79.00. Navigateur : lot25→26 et autres postes inchangés, total39.00 | Ajout Before depuis dock, puis tuiles directement éditables. Aucun panneau externe. Deux niveaux parent/enfant conservés. Legs couverts séparément par Mobility ; lieu propre Before BLOCKED_OWNER |
| P6 Voiture Aller / Taxi Retour / autre Bar | PASS_DOMAIN/PGLITE et React, PARTIAL parcours utilisateur complet | P1 endpoints/fare et P3 indépendance ; `BAR_RETURN_TAXI_ONLY_REMOVES_RETURN_FUEL` ; seul Retour perd le carburant. Changer le Bar seul conserve les legs indépendants | Nouveau tarif seulement après choix explicite sur le leg ciblé. Lien durable Bar→endpoint absent : pas de synchronisation silencieuse. Aucun prix fournisseur réel certifié |
| P7 Google non promu / panne | PASS_REACT_SIMULATED_FALLBACK ; BLOCKED_OWNER durable | P3 Google429, HTML, ambiguïté, détail invalide, retard et démontage ; TEXT explicite sans coordonnées. Panne Mobility simulée garde les intentions et UNKNOWN | Recherche/Rechercher encore/Texte/Plus tard ; aucune invitation ni mutation Canonical. NOT_RUN_PROVIDER ; pas de nouveau Google Place persistant |
| P8 RAW / Undo / Preview tardive / Reload | PASS_REACT et HTTP ; PARTIAL circuit simultané complet | P4 Before RAW rejeté puis sauvé ; gate D1 refusé sousD2 ; HTTP réponse503 après commit, résolution par READ, replay sans nouvelle version, CAS concurrent,4 SAVE au total ; navigateur retrait/Undo/Redo/retraitUndo et Reload | Dialogue réel Continuer/Enregistrer testé sur Before ; abandon et rejet testés en React. Un timeout d’outil sur Undo a été suivi d’une lecture, puis un seul Undo admis. Pas de test Auth ni course simultanée Back+reload+Undo certifiée |

## Clics observés du Before riche (navigateur fixture)

Chemin construit : Library Bar → Autre → Before → Vodka → prix25 → Enregistrer → Diluant → prix4 → Enregistrer → Snack → prix3 → Enregistrer → Au bar → Bière → prix6 → Enregistrer. Réédition directe de Vodka → RAW26 → Date → Continuer → Date → Enregistrer26. Le choix Date reprend après la sauvegarde du bon enfant.

Il s’agit d’un relevé d’actions, sans P95. Les saisies ne sont pas comptées comme un seul clic arbitraire. Les erreurs de sélecteur automatisé (libellé incluant la description, deux boutons de même nom dans un dialogue) ne sont pas ajoutées aux clics produit. Un garde RAW apparu pendant le premier essai de sauvegarde Diluant a été résolu par Continuer puis Enregistrer ; saisie4 conservée. Sa cause précise n’est pas attribuée au produit faute de reproduction après stabilisation.

## Interprétation des preuves

- `states.json` : snapshots sémantiques et summaries **Compiler/V2**, pas des sommes calculées en React. Le digest des snapshots riches est inclus ; les UUID sont synthétiques.
- `http-results.json` : scénario isolé distinct du navigateur ;4 écritures admises, relecture de chaque version, aucune écriture distante ni Apply. Known38.00 +incomplet parce que Snack UNKNOWN ; le coût parent n’est pas ajouté.
- `browser-before-reload.json` et `browser-after-reload.json` : mêmes IDs, version et digest autour d’un vrai rechargement. Proof loopback seulement.
- Captures/`geometry.json` : bundle navigateur48a552f. Diff versf3591ef dans `browser-final-label-diff.patch` : seule formulation du retrait. Le garde RAW Before-extra ajouté ensuite surccfefe0 est retesté séparément ; les anciennes captures ne le certifient pas.
- Mon Plan : données officielles persistées intégralement et relues via repository/READ ; aucune capture authentifiée de la page Mon Plan P4, ne pas la déclarer certifiée.
- Retrait d’un complément Before avec RAW : défaut reproduit dans `before-extra-raw-red.log`, corrigé surccfefe0 et revalidé React. Retest navigateur final impossible : usage local désactivé dans Work. Les premières preuves navigateur48a552f ne sont pas présentées comme validation de ce dernier garde.

Conclusion : huit parcours **classifiés**, niveaux variables et limites explicites ; aucune prétention de huit parcours universellement certifiés.
