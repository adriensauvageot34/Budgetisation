# Index des preuves — Bar final

Code produit : `841219d2ab57164d5e7879a257e62a8aa6b97c49`, issu de #64. Les deux extensions de tests ajoutées après ce SHA ne modifient aucun fichier `src/`.

- `ux-results.json`, `ux-participant-final.log` : huit groupes React, dont contrôle du vrai Shell avec réseau différé et RAW. Ni capture ni mesure de peinture.
- `maps-results.json` : même lot de huit observations passé à VENUE/RESTAURANT/BAR_APERO, fetch propriétaire simulé.
- `v8-results.json`, `v8-final.log` : 16 groupes, dont 401/403/429/HTML, tardif et Details non admissible, en processus.
- `http-results.json`, `http-isolated-final.log` : protocole HTTP loopback, stockage synthétique, CAS/réponse perdue/versions et conservation. Le serveur a été arrêté à la fin.
- `check-*-final.log`, `check-l4-*.log`, `check-planner-performance-parity.log` : régressions réellement exécutées. Parité : 22×9=198, goldens non modifiés.
- `typecheck-final.log` : vide car TypeScript a terminé avec code0 ; ce fichier vide n'est pas une preuve de navigateur.
- `vercel-build-product.log`, `preview.json` : build Next complet, SHA et cible Preview READY.
- `preview-smoke.json` : GET officiel Vercel, HTTP200 vers connexion applicative ; pas de session Budgetisation.
- `preview-draft-protocol-smoke.json` : refus409 attendu sans version de protocole, pas un test RLS.
- `browser-limits.json` : refus officiel du navigateur dans les réglages Work. Aucun contournement, aucune capture revendiquée.
- `ideas-135.json` : index de toutes les propositions annexées, **pas 135 PASS**. Voir statuts de développement et réserves individuelles.
- `first-*-harness-failure.log` : échecs initiaux conservés. Les sélecteurs historiques tentaient d'ouvrir des objets hors de la scène ; les harnais naviguent maintenant via les contrôles publiés, sans supprimer leurs oracles économiques.
- `http-sandbox-blocked.log` : EACCES initial ; exécution autorisée ultérieure séparée dans le journal final.

## Limites de collecte

Aucune donnée personnelle, clé, JWT, trace réseau authentifiée ou snapshot de production n'est copié ici. Tous les noms, coordonnées et UUID économiques des fixtures sont synthétiques. Aucun Apply distant. Aucun PASS_AUTH/PASS_PROVIDER/PASS_BROWSER ne doit être déduit de ces fichiers.

La recette visuelle restante et le protocole de mesures sont dans `BAR_APERO_LAST_UX_FUNCTIONAL_RECEPTION.md`. Production/main sont inchangés.
