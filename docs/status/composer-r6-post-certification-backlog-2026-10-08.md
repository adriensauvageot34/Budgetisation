# Composer R6 — backlog après certification

Ce backlog consigne uniquement les quatre dettes non bloquantes retenues par la certification R6. Il n'ouvre pas une nouvelle passe UI.

## R6-VISUAL-DEBT-01 — Upgrade Clay illustrations toward true 2.5D

- **Statut :** `OPEN_NON_BLOCKING` ; **priorité :** LOW.
- **Constat :** illustrations cohérentes, reconnaissables, colorées, avec registre stable, mais plus plates que les sculptures Clay 2.5D du mockup. `CLAY_SCORE = 3/5`.
- **Résolution future :** passe purement artistique sur les volumes, faces, lumière et ombres, sans changer la typologie des objets, les interactions, les contrats métier ni l'architecture de présentation verrouillée.
- **Impact R6 :** ne bloque pas Composer, compréhension, interactions, accessibilité, performance ou T0–T8.

## R6-DATA-GAP-01 — Stable Bowling visual identity

- **Statut :** `NON_BLOCKING_FOR_R6` ; **owner futur :** contrat de présentation/domaine amont.
- **Constat :** le Context Bowling ne publie que `activity`. Il manque une clé ou un subtype stable pour sélectionner boule et quilles.
- **Résolution future :** publier une identité visuelle autoritaire ; la Presentation Layer pourra alors choisir l'icône existante. Aucun matching par texte utilisateur tel que `label.includes("Bowling")`.

## R6-DATA-GAP-02 — Trusted Saving display label

- **Statut :** `NON_BLOCKING_FOR_R6` ; **owner futur :** données de présentation publiées en amont.
- **Constat :** la fixture expose `Synthetic adjustable saving` sans `displayLabel` fiable destiné à l'utilisateur.
- **Résolution future :** publier un libellé autoritaire, que l'UI affichera sans l'inventer.

## R6-DATA-GAP-03 — Certified Compare delta

- **Statut :** `NON_BLOCKING_FOR_R6` ; **owner futur :** projection financière autoritaire après décision produit, éventuellement liée à T7.
- **Constat :** Compare présente `Actuel` et `Variante`, mais aucun Δ certifié n'est publié pour cette surface.
- **Résolution future :** si le produit exige ce chiffre, le publier depuis l'owner métier approprié ; aucun calcul financier React.
