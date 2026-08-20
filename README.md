# Budgetisation V2

Application privée construite avec Next.js 16, React 19, TypeScript, App Router,
Supabase SSR, Tailwind CSS et Recharts.

## Configuration

Copier `.env.example` vers `.env.local`, puis renseigner uniquement les valeurs
publiques du projet distant :

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Ne jamais ajouter de clé `service_role` au navigateur ou au dépôt.

## État du projet

Étape 0 — legacy V1 nettoyé, bootstrap technique V2 en cours de validation.
Ce bootstrap vérifie uniquement Auth, RLS et les lectures minimales du contexte
Household. Il ne constitue pas l’Architecture Core de l’application.

La Supabase distante est déjà initialisée et validée en V2. Ne jamais exécuter
les anciens scripts V1 ni lancer de reset automatique.

```bash
npm install
npm run dev
```

Prochaine grande étape après validation humaine du Gate 0 : Architecture Core V2.
