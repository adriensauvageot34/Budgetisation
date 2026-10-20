# R6.3 — transport exact du preset dans le drag natif

Base main réelle0a4cd6ba1d70700f9575d6a5704796003a539e04 vérifiée par fetch. Branche codex/composer-r6-3-preset-drag-fix. Le relevé R6.2 local68520b5 reste conservé sur son ancienne branche ; outputs/ antérieur hors lot.

## Correctif ciblé

- Library : vignette preset complète draggable si sa source publiée et BOARD_ZONE sont admis, busy et provenance respectés. Clic inchangé ; image décorative draggable=false.
- Session de drag UI typée ComposerDragSession, extension locale du source publié. Le preset est validé par catalogue/template/capacité BOARD_ZONE, puis porté avec le label exact dans le ref et le state du drag. Aucune variable globale, aucun nouveau champ persistant ou moteur.
- preparedDrop transporte presetKey ; place appelle choose avec la clé typée capturée avant endDrag. Les presets ne sont pas admis sur une cible autre que BOARD_ZONE. Les sources et cibles restent recontrôlées au dépôt.
- Le fallback dataTransfer générique conserve son comportement pour les assets ordinaires sans provider. Un preset sans session officielle est explicitement refusé, jamais réduit silencieusement au template générique. Board privilégie la session officielle même avant le rendu d'un grabbed et stoppe la propagation du drop. Le ref est consommé par endDrag avant toute création, donc pas de seconde mutation de la même session.
- Recette Preview/Auth existante : ?r63=1 expose seulement identités/templates/presets des contextes renvoyés par les vraies réponses du serveur synthétique. Aucun intercept réseau de navigateur ni lecture de React interne. Aucun writer distant/Apply. Production ne peut pas accéder à cette route de recette.

## Contrôles locaux exécutés

9 contrôles ciblés PASS : transport Bar/techno/Mascara ; même état sémantique complet obtenu par DROP clic et DROP préparé DnD à identité identique ; presetForContext exact ; même identité jamais dupliquée dans l'état ; mauvais preset/template et BLOCKED refusés ; handlers Library transmettent une fois la bonne clé ; images non draggables ; fallback preset sans provider refusé. Niveau SYNTHETIC_TRANSPORT_COMPILER_REACT, remoteWrites0, Applyfalse. Ce n'est pas une certification de geste natif. TypeScript final exit0. Une erreur de typage intermédiaire (clé string du contrat DROP versus union du catalogue) a été corrigée en utilisant la clé typée de la session déjà validée, sans cast ni fallback générique.

La carte fermée, sa mise en page, le hook de maintien180ms R6.2, la carte ouverte, les sources financières et la sérialisation ne sont pas modifiés. Finance198 : **UNCHANGED_NOT_RERUN**. Les preuves natives, build Vercel, PR et décision de livraison restent à renseigner après exécution. Pas de merge si le geste natif essentiel n'est pas démontré conformément au cahier R6.3.
