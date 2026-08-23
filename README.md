# Budgetisation V2

Budgetisation V2 est une application privée d’exploration du budget et de la
vie du foyer. Elle publie des observations traçables et leurs limites de
couverture ; elle ne transforme jamais une donnée absente en valeur supposée.

## Stack et architecture

Next.js 16, React 19, TypeScript, App Router, Supabase SSR, Tailwind CSS et
Recharts.

```text
Relationnel Supabase
→ projections canoniques server-only
→ facts
→ Analytics et Metric Registry
→ Query API / read models
→ React
```

Le navigateur consomme uniquement la Query API publique. Les lectures
canoniques privilégiées et les secrets Supabase restent côté serveur.

## Surfaces V2 Preview

- Calendrier mensuel et détail d’une journée ;
- Analyse d’un mois ;
- Analyse globale par fenêtre d’observation ;
- navigation Opérations avec recherche, tri, filtres et preuve ;
- Exploration des entités, analyses ciblées, méthodologies et galeries.

Les routes `imports` et `parametres` sont volontairement différées. La route
legacy `/categorie/[slug]` est neutralisée tant qu’aucune résolution canonique
non ambiguë n’existe.

## Configuration

Copier `.env.example` vers `.env.local`, puis renseigner les valeurs de
l’environnement cible :

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_URL=
SUPABASE_SECRET_KEY=
```

`SUPABASE_URL` et `SUPABASE_SECRET_KEY` sont strictement server-only. Aucune
clé secrète ou service role ne doit être exposée au navigateur ou au dépôt.

## Commandes

```bash
npm install
npm run dev
npm run check:architecture
npm run check:product-completeness
npm run typecheck
npm run verify
```

`npm run verify` enchaîne architecture, complétude produit, typecheck et build
de production.

## Supabase et éléments différés

La base distante existe déjà. Aucun reset automatique, aucune migration
implicite et aucune écriture distante ne font partie du démarrage ou des
commandes de validation.

La migration d’identité Purchase Event est versionnée mais différée à une
phase de migration explicite. La projection de données Minimal, la taxonomie
Financial Family et le mapping Necessity restent respectivement bloqués par
une source distante manquante et par des contrats normatifs manquants. Le
profiling SQL, les index, les vues matérialisées, le monitoring et le hardening
de production restent différés.

Voir [le plan d’exécution](docs/plans/V2_EXECUTION_PLAN.md) pour l’état courant
et [le rapport Preview](docs/status/V2_PREVIEW_VALIDATION.md) pour les gates.
