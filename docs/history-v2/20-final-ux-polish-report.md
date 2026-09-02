# History V2 — final UX polish

## Périmètre

Ce lot est strictement frontend/code-only. Il ne modifie aucun moteur Analytics, ReadModel, RuntimeSchema, contrat de publication, `factsHash`, `policyVersions`, migration, snapshot ou donnée Supabase.

## Header et navigation

- Le toggle local `Calendrier / Bilan` est restauré sous forme de `tablist` avec deux `tab` et `aria-selected`.
- L'URL canonique Calendar reste `/historique/YYYY-MM` ; le Bilan utilise `/historique/YYYY-MM?view=balance`.
- `view=calendar` est accepté puis canonisé sans paramètre `view`.
- Le changement de mois conserve la vue ; le changement de vue conserve les filtres Calendar dans l'URL.
- Les lectures serveur restent conditionnelles : Calendar/Week charge la ressource demandée et Overview ; Bilan charge Overview et les quatre ressources M1–M4. Minimal Preview et les autres détails restent lazy.
- Débits et dépenses sont empilés verticalement entre le toggle et la navigation mensuelle.

## Filtres Calendar

- Le bouton/icône `Filtres` séparé est retiré.
- Le titre du mois Calendar est le déclencheur sémantique du panneau (`aria-haspopup="dialog"`, `aria-expanded`, libellé contextuel).
- Le mois du Bilan reste un titre non interactif.
- Le panneau expose uniquement les cinq presets du registre partagé : Tout, Sans charges fixes, Quotidien, Temps forts et Dépenses.
- Un preset s'applique immédiatement via `router.replace(..., { scroll: false })`, ferme le panneau et restaure le focus au titre du mois.
- Escape et clic extérieur ferment également le panneau avec restauration du focus.
- Un ancien `show=` reste sérialisé comme sélection custom et ne sélectionne visuellement aucun preset.

## Calendar et carrousel

- Le bandeau visible `UnassignedTiming` est retiré sans supprimer la donnée du ReadModel ni le tag autoritaire.
- Le carrousel possède des colonnes de contrôle distinctes, une zone icône, une zone texte `minmax(0, 1fr)` et une zone montant `max-content` non sécable.
- Les titres sont limités à deux lignes et les sous-titres à une ligne.
- `compactNarrativeTitle()` retire uniquement le suffixe temporel exact construit avec les dates publiées ; aucune analyse sémantique du nom n'est effectuée.
- Un montant est rendu uniquement lorsqu'il est publié `VISIBLE` et `KNOWN`/`PARTIAL`. Les états UNKNOWN, NOT_APPLICABLE, HIDDEN et PLACEHOLDER ne rendent aucun faux zéro ni libellé technique.

## Audits read-only ciblés

### Coûts des événements

- `Visite famille de Manon à Servian` : carte et Moment Detail exposent le même coût causal connu (`30,80 €`).
- `Journée kayak / Pont Suspendu` : carte et Moment Detail exposent le même coût causal connu (`63,00 €`).
- `Sortie au JAM`, `Sortie Comptoir de l'Arc` et `Déplacement professionnel` : la carte et le détail autoritaire ne publient pas de coût individuel applicable. L'UI n'en invente aucun.
- Aucun cas où le détail connaît un coût perdu par la carte n'a été constaté : `DEFERRED_SERVER_CAROUSEL_SEMANTICS` n'est pas requis sur cet échantillon.

### Sélection des lieux

Les payloads Overview et Place Detail publiés ne contiennent pas de propriété autoritaire distinguant un lieu narratif d'un lieu retail. Écarter Carrefour à partir du nom, du marchand, du montant, du score ou d'un seuil serait heuristique et est interdit. La carte est donc conservée.

`DEFERRED_SERVER_CAROUSEL_PLACE_SELECTION` : un futur contrat serveur devra porter explicitement cette qualification si la sélection doit changer.

## Vérifications

- `scripts/check-history-v2-frontend.mjs` : PASS — 15/15 ressources consommées, 15/15 contrats et 15/15 exigences UX ciblées.
- Helpers de route et de présentation : PASS — URLs Calendar/Bilan, conservation `show=`, canonisation, suffixe temporel exact.
- History V2 ReadModels : PASS — 27/27.
- History V2 Month Balance : PASS — 74/74.
- `tsc --noEmit` : PASS.
- `next build` : PASS.
- Revue React ciblée : PASS — hooks/listeners, accessibilité, focus, structure et absence de calcul métier React.
- Smoke visuel automatisé : non exécuté conformément au périmètre.

## Gates

HISTORY_UX_BALANCE_RESTORE_GATE = PASS

HISTORY_UX_HEADER_LAYOUT_GATE = PASS

HISTORY_UX_MONTH_FILTER_TRIGGER_GATE = PASS

HISTORY_UX_SIMPLE_FILTERS_GATE = PASS

HISTORY_UX_UNASSIGNED_HIDDEN_GATE = PASS

HISTORY_UX_CAROUSEL_LAYOUT_GATE = PASS

HISTORY_UX_CAROUSEL_TITLE_GATE = PASS

HISTORY_UX_CAROUSEL_AMOUNT_GATE = PASS

HISTORY_UX_NO_HEURISTIC_GATE = PASS

SNAPSHOT_REBUILD = NO

SNAPSHOT_REPUBLICATION = NO

USER_ACCEPTANCE_VISUAL = PENDING
