# C3 Adaptive Builder — vérification du 30 septembre 2026

Base : C1 `1661945`, C2 `f6555cc`, branche `main`.

Le Builder utilise le resolver et les règles de lieux partagés. L’entrée propose Restaurant,
Courses, Soirée, Voir quelqu’un, Activité, Achat et Autre. Les questions, coûts, détails
et compléments sont dévoilés progressivement. Les clés internes ne sont pas affichées.

La readiness est dérivée dans `planned-builder.ts`. Ses problèmes portent un code,
une portée, une sévérité et une cible de réparation. Un financement incomplet permet
une simulation économique mais bloque Save. Les réservations de financement ne sont
pas affichées tant que la répartition est incomplète. Une date nullable reste autorisée.

Le total rapide utilise un CostItem personnalisé (`assetKey: null`). La ventilation
restaurant produit des catégories économiques réelles : repas sans alcool et alcool.
Les agrégats et leurs détails de remplacement ne peuvent pas être actifs ensemble.
La fusion d’une ligne cataloguée ou financée est refusée pour conserver sa sémantique.

Les saisies incompatibles explicites sont suspendues localement avec réparation ou Undo.
Les valeurs dérivées peuvent être recalculées ou retirées. Un changement de projet conserve
le brouillon précédent pour confirmation et Undo. Une révision locale invalide l’aperçu.
Les résultats de calcul asynchrones devenus obsolètes ne remplacent pas le trajet courant.

Preview et Save utilisent le même parsing structurel et le même resolver serveur. Preview
peut omettre les références requises uniquement pour Save ; les références fournies sont
toujours validées. Save revalide les faits live, recalcule et utilise le contrat d’écriture C2.
Readiness, provenance locale, buffers suspendus et Undo ne sont jamais persistés.

Vérifications exécutées :

- `check-phase2-planned-builder.mjs` : AB-01..12, COST-ADAPT-01..06, DRAFT-01..05,
  META-01, META-02, META-14 ; tests négatifs de payload et de pertes de financement.
- C1 domain et C2 server contract : PASS.
- Planned Expenses goldens et synchronisation liste/calendrier/prévision : PASS.
- TypeScript, architecture des imports et build Next.js de production : PASS.
- Navigateur localhost avec session existante : sept intentions, restaurant rapide 60 €,
  conversion 45 + 15, recalcul serveur 50 + 15 = 65, fusion incompatible refusée,
  changement vers Courses puis Undo restaurant 65 avec exactement deux lignes.
- Navigateur localhost : financement incomplet, Preview économique 65 et Save désactivé.

Les contrôles navigateur ont simulé des brouillons ; aucune dépense de test n’a été sauvée.
Les tests CRUD utilisent les fixtures existantes. Aucune migration ni modification du moteur
financier ou des authorities historiques. Aucun contrôle Vercel dans ce lot.

```ini
C3_ADAPTIVE_BUILDER = PASS
READINESS = PASS
QUICK_SPLIT_ITEMIZED = PASS
DRAFT_INVALIDATION = PASS
UNDO = PASS
SILENT_EXPLICIT_DATA_LOSS = 0
```

Ces résultats couvrent le lot C3 et ses cas DD6 ; ils ne constituent pas la certification
transversale des futurs lots C4/C5.
