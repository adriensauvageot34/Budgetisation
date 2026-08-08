# Budgetisation

Application Next.js privée pour analyser le budget historique d’un foyer partagé.

## Architecture

Les pages utilisent `SupabaseBudgetRepository`, qui lit PostgreSQL via Supabase. Le
schéma relationnel couvre le foyer, ses membres, les comptes, les imports, la
taxonomie et les opérations. Supabase Auth protège les routes et les politiques
RLS limitent chaque lecture/écriture aux membres du foyer concerné.

## Configuration

Copier `.env.example` vers `.env.local`, puis renseigner :

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Ne jamais ajouter de clé `service_role` au navigateur.

## Initialisation Supabase

Exécuter une seule fois `supabase/bootstrap.sql` dans Supabase SQL Editor. Ce
fichier crée le schéma, les politiques RLS, le foyer `Budgetisation` et les 481
opérations historiques issues du XLSX fourni. Aucune ligne n’est supprimée sur
la seule base de valeurs identiques ; les fingerprints servent uniquement à
signaler des doublons potentiels.

Un seul compte Supabase Auth partagé est actuellement utilisé par Adrien et
Manon. Dans **Authentication > Users**, créer ou sélectionner cet utilisateur,
copier son UUID, puis exécuter dans SQL Editor :

```sql
select public.attach_user_to_budgetisation(
  '<UUID_COMPTE_PARTAGE>',
  'Adrien et Manon',
  'owner'
);
```

Le rattachement utilise les UUID Auth, jamais les e-mails. L’architecture Auth
et RLS reste compatible avec plusieurs membres : un second utilisateur pourra
être créé et rattaché plus tard avec la même fonction et le rôle `member`.

## Démarrage local

```bash
npm install
npm run dev
```

Les migrations versionnées se trouvent dans `supabase/migrations`. Le script
`scripts/generate_historical_seed.py` permet de régénérer le seed à partir du
fichier source, sans déduire de compte ni de personne.
