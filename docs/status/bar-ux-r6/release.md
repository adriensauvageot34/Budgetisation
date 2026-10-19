# R6 — livraison en cours

Base main aef5c03a7eaa2d5696231a9c08168700ae71bfdf. Branche codex/bar-apero-r6-user-experience. PR Draft https://github.com/adriensauvageot34/Budgetisation/pull/70.

Phase A f1cd1e3 : Preview READY, regroupement et substitutions/RAW/moments observés en navigateur. Tests P1=25,P2=23,groupes=13,Finance=198/198,packer=17,dock25/120/150 PASS (fixtures). Phase B : routes compactes, Google contextualisé, illustration Before et copie financière courte. TypeScript PASS, Google mocks et sept contrôles de legs PASS. Initiales, portraits et variantes restent dans les reports R5.

Les échecs initiaux P4 provenaient d'assertions de navigation devenues obsolètes : le test attendait Before simultanément dans le résumé Au bar et un accès implicite aux boissons après un montant direct. Les tests empruntent désormais les contrôles de moment/mode réellement visibles ; aucune assertion financière supprimée. P4 quinze contrôles PASS après adaptation. Journaux FAIL initiaux conservés.

After : report explicite accepté par l'utilisateur pendant R6. Aucun contrat After créé, aucun faux bouton. GO_MAIN=NO tant que Google réel, build complet final et réception visuelle B ne sont pas établis. Production inchangée.
