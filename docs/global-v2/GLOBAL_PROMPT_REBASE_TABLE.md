# Global Prompt Rebase Table — post-History GA0

## Règle

Le pack pré-History n'est plus exécutable directement. Cette table est une décision de planification : les prompts `REWRITE`, `MERGE_WITH`, `SPLIT_INTO` ou `CONDITIONAL` doivent être régénérés depuis le Master, GA0 et le contrat History final avant exécution. Aucun lot suivant n'est exécuté ici.

| Prompt | Décision | Pourquoi / changement requis | Nouvelles préconditions et dépendances | Owner |
|---|---|---|---|---|
| GA0 | `DELETE_NOT_NEEDED` | Ce prompt est consommé par le présent audit; le rejouer créerait une baseline concurrente. | Rapport GA0 validé. | GA0 |
| A1 | `REWRITE` | Intégrer la frontière History certifiée, l'absence de fenêtre universelle, la projection personne partielle et le choix H1 différé. | `POST_HISTORY_ENTRY_GATE=PASS`, GA0 PASS. | A1 |
| A2 | `REWRITE` | N'implémenter que les deltas de contrats : temps Global, capability scopes, dépendances et extensions de versions. | A1 contract freeze; aucune métrique produit. | A2 |
| A3 | `REWRITE` | Centrer la certification sur natural windows, no-lookahead, états, hashes et non-régression History. | A2 PASS. | A3 |
| B1 | `MERGE_WITH` A1 | L'audit physique Actual/Typical/Minimal/classifications est déjà acquis par History et GA0; garder seulement le delta M1/M2. | A1 doit enregistrer les décisions B pertinentes. | A1/B |
| B2 | `REWRITE` | Réutiliser Actual, adapter Typical/Minimal pour références Global et créer seulement bridge/résidual/équivalents structurels. | Phase A PASS; aucun oracle productif. | B2 |
| B3 | `REWRITE` | M2 core sans PurchaseEvent; déclarer l'enrichissement achat/merchant différé plutôt que le simuler. | B2; classifications History; anti-cycle B↔F. | B3 |
| B4 | `REWRITE` | Ajouter closure/manifests Global et preuve que le core M2 reste complet sans M8. | B2/B3 PASS. | B4 |
| C1 | `REWRITE` | Geler les politiques robustes et les grains naturels; interdire explicitement LT comme autorité structurelle. | Phase B PASS; séries certifiées. | C1 |
| C2 | `REWRITE` | Créer Trend/Stability/ChangePoint sans reprendre le calcul dynamique legacy. | C1 policy freeze. | C2 |
| C3 | `SPLIT_INTO` | Séparer cadence Activity fondée sur occurrences/exposition et routine Place conditionnelle à une autorité absente; saisonnalité reste support-gated. | C2; données Activity disponibles; Place routine gated. | C3a/C3b |
| C4 | `REWRITE` | Certifier grains, gaps, no-lookahead, LT boundary et capacités bornées. | C2/C3a; C3b peut être explicitement indisponible. | C4 |
| D1 | `REWRITE` | Utiliser le catalogue de familles réellement disponibles B/C et figer matching/FDR/robustesse sans causalité implicite. | Phase C PASS. | D1 |
| D2 | `REWRITE` | Implémenter seulement M5 core B/C; garder des points d'extension explicites pour E/F. | D1 PASS. | D2 |
| D3 | `REWRITE` | Ajouter preuves de confounding, multiplicité, materiality, evidence refs et closure. | D2 PASS. | D3 |
| E1 | `REWRITE` | Revalidation courte des doctrines HC2, disponibilité live et capability gates; pas de nouvel audit History. | D core PASS; GA0 Place/Moment. | E1 |
| E2 | `REWRITE` | Réutiliser causalCost/spentDuring officiels, créer les agrégats Global de comparabilité et répétition. | E1; AOF/AOCF/ECF. | E2 |
| E3 | `SPLIT_INTO` | Un lot Place core exécutable et un lot Mobility/route/fuel bloqué tant que les autorités AG001/006-011/023 manquent. | E1; Place core disponible. | E3a/E3b |
| E4 | `KEEP_AS_IS` | La décision de recertification ciblée D après nouvelles familles E reste correcte. | E2/E3a PASS; dependency matrix. | E4 |
| F1 | `REWRITE` | Constater les tables PurchaseEvent vides, la séparation purchase/funding/operation et les gates produits. | Phase E + éventuelle recert D. | F1 |
| F2 | `CONDITIONAL` | Le moteur est légitime mais sa production doit attendre un peuplement Canonical PurchaseEvent autorisé et certifié. | `NEW_DATA` PurchaseEvent; aucune déduction bancaire. | F2 |
| F3 | `BLOCKED` | ProductLine/family/variant/format/unit/cycle/index personnel n'ont pas d'autorité complète; les observations brutes ne suffisent pas. | Décisions/données AG002-004 et AG012-022. | F3 |
| F4 | `CONDITIONAL` | Certifier M8 core seulement si F2 devient disponible; sinon publier une capacité explicitement indisponible, sans faux PASS produit. | F2 outcome; recerts B/D déterminées par closure. | F4 |
| G1 | `REWRITE` | Partir des participations disponibles et des 128 liens financiers explicites; enregistrer la projection ECF à adapter et les contacts absents. | A2 person scope; sorties B-F stables. | G1 |
| G2 | `CONDITIONAL` | Persona peut démarrer pour les familles à support comparable; les finances personne restent limitées par la couverture réelle. | Projection/person coverage certifiée; aucune attribution implicite. | G2 |
| G3 | `SPLIT_INTO` | Séparer shared Activity/Place/Moment prouvable et extensions Contact/social bloquées AG024-031. | G1/G2; evidence tiers. | G3a/G3b |
| G4 | `CONDITIONAL` | Certifier uniquement les capacités disponibles, avec états explicites pour finance/contact insuffisants. | G2/G3a PASS. | G4 |
| H1 | `REWRITE` | Inventorier les vraies sorties A-G, décider familles Query et arbitrer `FULL RESTAGE` vs reuse immutable cross-generation. | Phases applicables PASS + recerts. | H1 |
| H2 | `REWRITE` | Généraliser publication/manifests/immutabilité/cache au profil Global; les guards actuels sont History-spécifiques. | Décision H1, autorisation humaine si migration nécessaire. | H2 |
| H3 | `REWRITE` | Créer de nouveaux RMs Global compacts; aucun assemblage des RMs History ni des types v1. | H2 contractVersion/profile gelés; A-G stables. | H3 |
| H4 | `REWRITE` | Définir des details bornés et le nouveau registre; retirer progressivement les 9 ressources v1 seulement après preuve consommateurs. | H3; cutover map H1. | H4 |
| H5 | `REWRITE` | React présentation pure sur snapshots Global; conserver les primitives UI utiles mais remplacer la route/les composants v1. | H3/H4 RuntimeSchemas PASS. | H5 |
| H6 | `REWRITE` | Ajouter snapshot-only/fail-closed, cache générationnel, fermeture consumers legacy et budgets réels. | H2-H5 PASS. | H6 |
| GC1 | `REWRITE` | Recertification exhaustive sur le DAG réellement disponible, avec capacité/gates et closures Global. | H PASS, recerts ciblées PASS. | GC1 |
| GC2 | `CONDITIONAL` | Publication seulement après GC1 et autorisation humaine; les modules gated restent explicitement indisponibles, jamais remplis par fallback. | GC1 PASS, préflight live, autorisation humaine. | GC2 |

## Nouvel ordre exécutable

```text
History final
  → GA0
  → A1/A2/A3
  → B2/B3/B4
  → C1/C2/C3a/C4
  → D1/D2/D3
  → E1/E2/E3a/E4
  → F1 → F2/F4 seulement après données PurchaseEvent
  → recertifications B/D ciblées
  → G1/G2/G3a/G4
  → H1/H2/H3/H4/H5/H6
  → GC1
  → GC2 sous autorisation humaine
```

Branches conditionnelles non bloquantes pour le core : `C3b` Place routine, `E3b` mobilité, `F3` produit/cycles, `G3b` contacts/social. Elles ne sont ouvertes qu'après fermeture de leurs authority gates.
