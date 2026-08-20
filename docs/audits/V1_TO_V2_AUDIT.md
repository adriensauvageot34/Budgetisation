# Audit V1 vers V2

L’audit du nettoyage est validé. Aucun fichier V1 supprimé ne doit être restauré
tel quel.

## KEEP

- Stack Next.js, React et TypeScript ;
- Supabase SSR et configuration publique ;
- `PageHeader` et socle technique générique.

## ADAPT

- Auth, proxy/session et écrans associés ;
- AppShell et layout ;
- bootstrap serveur provisoire ;
- `globals.css` et README.

## REPLACE

- dashboards, tableau d’opérations et filtres ;
- formatters, navigation mensuelle et primitives dataviz métier.

Le concept est parfois utile, mais l’implémentation V1 ne doit pas être restaurée.

## DELETE

- repositories et modèles métier V1 ;
- calculs analytiques V1 ;
- import V1 ;
- migrations, bootstrap et seeds V1.

## RESTORE

Aucun.
