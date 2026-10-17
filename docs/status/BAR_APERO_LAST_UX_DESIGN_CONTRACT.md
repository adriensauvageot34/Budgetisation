# Bar / Apéro — contrat de présentation

## Trois niveaux

1. **Carte fermée : raconter la sortie.** Illustration du catalogue, coût connu publié, réserves de fraîcheur, lieu/date/groupe, deux trajets indépendants, miniature réelle du Before et deux postes du bar. Un `+N` ouvre la section complète. Aucun montant n'est additionné par React.
2. **Ma sortie : organiser.** Synthèse, accès directs Date/Lieu/Personnes/Aller/Retour/Before/Au bar. Les liens sont des cibles libres, pas les étapes obligatoires d'un wizard.
3. **Scène ciblée : une chose à modifier.** Date affiche son calendrier ; Lieu sa recherche ; un poste affiche uniquement sa tuile active et ses champs courts. Le bouton « ← Ma sortie » revient sans mutation financière. Les métadonnées demeurent accessibles.

## Pages et géométrie

- Consommations et Before : quatre objets par page ; synthèse et compact : deux objets par groupe. Les IDs restent dans le Draft complet, seule leur projection change.
- Personnes retenues : quatre par page. Lieux locaux/Google : trois résultats par page. Aucun résultat n'est supprimé par cette pagination.
- Dock : une grille de choix entiers, avec précédent/suivant et numéro de page ; capacité calculée sur sa largeur (1–6, pas une largeur mobile supposée). Les touches gauche/droite sur le conteneur changent la page. Les autres presets gardent leur comportement existant.
- Zéro barre Y créée dans la carte, son éditeur ou son montage. Aucun `overflow:hidden` ajouté pour masquer un problème. Le Board global peut défiler verticalement. Son packing réserve les pistes nécessaires au seul Bar vivant, y compris au-delà de la hauteur d'une étagère.
- Le portail éphémère et le système existant de mesure/focus sont conservés. Une page de tuiles n'est pas un nouveau contexte métier. Les données ne sont jamais tronquées au nombre visible.
- **Contrat visuel à recevoir sur navigateur** : mesurer rectangles, hauteurs réellement allouées, overflow calculé, focus et chevauchements ; absence d'overflow CSS ne suffit pas à certifier la géométrie.

## Hiérarchie et actions

- Le montant et les objets passent avant les réglages. Les illustrations de boissons proviennent du catalogue existant ; un fallback reste possible.
- Provenance détaillée dans une divulgation secondaire ; inconnu, précédent et partagé restent explicites. Un participant n'est jamais un multiplicateur économique implicite.
- Les détails unité/financement/nom restent accessibles sous « Détails du poste ».
- Gestion de la sortie et retrait du Before dans des menus secondaires. Le retrait d'un Bar équipé affiche une attente ciblée avant la réponse serveur ; il ne simule ni admission ni sauvegarde.
- RAW protégé avant navigation/retrait. Annuler conserve le buffer ; abandonner consent seulement au buffer concerné. Les protections propriétaires et Undo restent autoritaires.

## Lieu et contrats propriétaires

- Découverte `BAR_APERO` : établissements compatibles Restaurant ou bar/night_club ; filtres historiques des autres parcours inchangés. Ville visible et modifiable ; recherche hors ville explicite.
- Details Google reste transitoire. Seule une correspondance exacte avec un lieu Canonical déjà publié peut devenir `KNOWN`. À défaut, seul le nom explicitement retenu est conservé comme texte ; aucune coordonnée ou nouvelle identité n'est inventée.
- Ce contrat est documenté pour réutilisation future ; **aucun des 46 autres presets n'est converti dans cette mission**.
