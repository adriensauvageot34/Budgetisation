"""A0 documentation only: classify the user's exact 128-item source inventory."""
import collections, hashlib, json
from pathlib import Path
out=Path('docs/status/evidence/pre-l4-audit')
source=json.loads((out/'source-av-inventory.json').read_text(encoding='utf-8-sig'))
proof={
 'E00': {'path':'baseline.json','scope':'Git/main/Production et absence de diff produit A0'},
 'E01': {'path':'targeted-contracts.json','scope':'7 contrôles services réels + PGlite synthétique ; pas de JWT réel'},
 'E02': {'path':'browser-checks.json','scope':'React production local synthétique ; confirmation native remplacée explicitement dans ce seul host'},
 'E03': {'path':'admission-boundary.json','scope':'MUTATE borne 9999 vs materialize + READ count10000, sans Apply ni SQL'},
 'E04': {'path':'../l3-3-composer-workshop/contract-tests.json','scope':'Preuves héritées L3.3, code produit identique'},
 'E05': {'path':'../l3-3-composer-workshop/regressions.json','scope':'15 suites héritées PASS, pas rejouées en bloc par A0'},
 'E06': {'path':'../l3-3-composer-workshop/golden-capability-delta.json','scope':'22 capabilities seules ; 176 autres empreintes inchangées'},
 'E07': {'path':'l4-contracts-published.json','scope':'5 vrais presets + templates/version/champs/slots/capabilities'},
 'E08': {'path':'preview-save-recovery-server.json','scope':'503 Preview seq2, reprise seq4, un SAVE par version, compteurs sources0'},
 'E09': {'path':'../../L3_3_COMPOSER_WORKSHOP_FINAL_REPORT.md','scope':'Clôture documentaire locale b38161b ; héritage explicitement limité'},
 'E10': {'path':'../../P14_A2_A3_FINAL_PERFORMANCE_AND_CLOSURE_REPORT.md','scope':'Draft A→B authentifié historique ; aucune nouvelle certification Auth L3.3'},
 'E11': {'path':'../../L3_1_COMPOSER_UX_FINISH_FINAL_REPORT.md','scope':'Navigation/palette/groupes historiques ; gestes natifs non certifiés'},
 'E12': {'path':'../../B3_TRANSVERSE_PLAN_FINANCIAL_COHERENCE_REPORT.md','scope':'Avec Plan : fixtures ; vrai JWT + Plan NOT_RUN'},
 'E13': {'path':'inspector-undecided.html','scope':'Rendu réel SSR références sans décisions ; recoupé au navigateur'},
 'E14': {'path':'../../L3_2_COMPOSER_LIBRARY_RATIONALIZATION_FINAL_REPORT.md','scope':'47 presets / 13 génériques / 114 options et recherche ; preuves réutilisées'},
 'E15': {'path':'source-review.json','scope':'Chemins et lignes effectivement examinés ; sans prétendre exécuter les branches non testées'},
}
groups={
 'ALREADY_CORRECT_WITH_EVIDENCE':[9,10,19,24,30,31,39,41,42,44,45,46,52,53,54,55,56,57,58,60,61,62,63,64,67,71,72,73,74,76,77,78,79,80,82,83,85,86,88,89,91,93,94,95,103,104,105,108,110,111,114,116,117,118,119,121,123],
 'CONFIRMED_DEFECT':[11,12,26,33,37,47,48,92],
 'PARTIAL_OR_LIMITED':[1,2,3,6,7,8,20,22,23,25,27,28,29,32,34,35,38,49,50,51,59,65,75,84,87,90,99,101,102,106,109,115,125],
 'NOT_TESTED':[4,5,13,14,15,16,17,18,21],
 'USEFUL_IMPROVEMENT_NOT_DEFECT':[36,40,43,68,69,81,107,112,113,120,122,124,126,128],
 'OUT_OF_SCOPE_OR_DEFERRED':[66,70,96,97,98,100,127],
}
assigned={}
for status,nums in groups.items():
 for n in nums:
  assert n not in assigned,n
  assigned[n]=status
assert set(assigned)==set(range(1,129)),set(range(1,129))-set(assigned)
notes={
1:'Refus observé : texte 5, groupe ouvert, digest inchangé. Stub confirm=false, pas un clic dans une confirmation native réelle.',
2:'Acceptation observée : saisie 6 abandonnée, groupe fermé et digest inchangé. Stub confirm=true, pas une preuve native.',
3:'Détails après refus : aucun inspecteur ouvert, texte intact. Retour booléen Éditer lu dans le code ; sélection et tous chemins combinés non exécutés.',
4:'Drag natif maintenu pendant édition non exécuté. Le code startDrag ne consulte pas le dirty inline ; cela reste un risque, pas une perte démontrée.',
5:'Geste natif enfant→destination non exécuté en A0 ; contrats de rattachement et alternative clic existants.',
6:'Page suivante/retour avec saisie : preuve L3.3. CaptureDirty et pin de page lus ; maintien en drag non exécuté.',
7:'Raw Jeux 88,80 conservé après inspecteur et resize1728→1440 ; raw Maison55,50 conservé sur40objets après inspecteur. Pas une preuve de toutes recompositions.',
8:'Sélection Manon dans groupe laisse raw Adrien5 présent. Changements entraînant un remontage React non couverts exhaustivement.',
9:'Vraie double activation L3.3 :14→16, Undo14, Redo16. Ne pas assimiler des clics espacés par l’outil à une seule rafale.',
10:'2,345 rejeté au navigateur sans zéro ; correction300 admise. Normalisation française/espaces/fractions couverte par E04.',
11:'D04 : max publié9999 ; validateControlValue refuse10000, materializePlanSlots et READ du Draft entier acceptent10000 pour Restaurants.',
12:'D01 : après250 SAVED/FRESH, texte300 non validé ; Apply demeure enabled. Aucun Apply cliqué, seule la décision250 reste autoritaire.',
13:'Modification authentifiée nouvelle count : NOT_RUN. Les comptes F0 désactivés n’ont pas été réactivés sous A0.',
14:'Prix/count nouveaux ensemble : services+fixture PASS, nouvelle sauvegarde authentifiée NOT_RUN.',
15:'SAVED de la fixture n’est pas une preuve de PostgREST/RPC/RLS avec JWT pour les nouveaux overrides.',
16:'Reload fixture et Plan PGlite hérités PASS ; cycle authentifié L3.3 après reload non exécuté.',
17:'count aprèsprix via vrais services PASS, mais aucune réédition authentifiée de nouveau Draft L3.3.',
18:'Undo/Redo fixture PASS ; la piste est dans le cycle authentifié demandé, qui n’est pas exécuté.',
19:'Baseline inchangée ; count sans override ne stocke aucun prix ;8 hashes non-capability par scénario conservés.',
20:'A0_BROWSER : deux saves et aucune PlanRevision. Aucun nouveau cycle durable authentifié ni Apply personnel.',
21:'Aucun Draft distant de test créé par A0 ; archivage récupérable du futur canari à prévoir en C1.',
22:'Vraie PlanRevision créée/relue dans PGlite par E01. Pas de JWT réel ni Plan personnel modifié.',
23:'Même mois2026-11 interrogé avec asOf2026-10-16 puis11-15, montant/digest conservés. Pas de corpus réel partiellement consommé.',
24:'Savings/floors/prix non admis : E04/E05. D04 concerne la borne count, pas une preuve de contournement de ces protections.',
25:'40 éléments de fixture, socle/habitudes/épargne/achats/groupe Food. Beauty et tous composites simultanés : preuves historiques, pas nouvelle campagne complète.',
26:'D03 reproduit au groupe1440 : label inconnu170,29px dans bouton124,40px, chevauche +. Aucun overflow global ne clôt ce défaut.',
27:'Dense effectivement1440×900 /1728×900 /1920×1080 :4/3/2 pages sans overflow global. Tous gestes non répétés à chaque taille.',
28:'Inspecteur observé1440 avec40éléments ; plateau reste praticable mais peu de cartes visibles. Pas d’étude utilisateur de compréhension.',
29:'114 options publiées conservées ; palette contextuelle inchangée/contrats historiques. Pas de passage manuel des114 options A0.',
30:'40objets : pagination4/3/2 selon surface. Page2 et retour à sélection observés à1920.',
31:'Page2→Voir Maison petit page1 : active0 et identité focused=true, sans ajout de contrôle.',
32:'Food5enfants observé ; Beauty et fortes cardinalités via preuves L3/L3.1, pas tout rejoué A0.',
33:'D03 montre une valeur masquée par l’action+, malgré des cartes/icônes globalement contenues.',
34:'Titres avec personne séparés et title natif ; longues chaînes extrêmes à revoir dans la correction ciblée de géométrie.',
35:'Source technique/provenance parfois brute en détail ; diagnostics avancés assumés. Aucun nouveau défaut financier démontré.',
36:'Gestes observables ; temps de compréhension par utilisateur humain non mesuré. Pas de refonte induite.',
37:'D01 : vieux FRESH/SAVED visibles pendant raw300 ; pending sémantique correctement STALE/PENDING après validation.',
38:'Enter/Escape/Tab/pagination et retour de focus : preuves partielles. Drag continu/confirmation native réelle non exécutés.',
39:'503seq2→FAILED et SAVED, Board éditable, Apply disabled ; nouvelle éditionseq4→FRESH/SAVED.',
40:'Pas de test utilisateur A/B L3→L3.3 comparable. Les anciennes captures restent historiques, pas une mesure d’efficacité.',
41:'Coût du mois issu Compiler ; aucune multiplication financière React. Coût2,10≠25,20≠impact consolidé.',
42:'Enveloppe Restaurants distinct du Context Restaurant dans read-model et groupe actuel.',
43:'Résumé dit Consomme l’enveloppe retenue, sans nom. Amélioration locale si identité de slot publiée, jamais déduire un slot du libellé.',
44:'Libellé humain de consommation, pas de code CONSUMES_SLOT dans le résumé ; pas d’économie calculée localement.',
45:'Résumé EXTRA_TO_SLOT : En plus de l’enveloppe ; conséquence calculée par Compiler seulement.',
46:'Les composants conservent leurs montants et UNKNOWN. Somme globale inconnue n’autorise pas à inventer un total ; cf B1/B3.',
47:'D02 : Vêtements sans décision est À définir sur carte mais Choix de ce mois0,00 dans inspecteur.',
48:'D03 : compteur inconnu trop large avec +/- ; prix connu reste distinct mais affordance count illisible au focus.',
49:'ReferenceValue/decisionValue distincts dans modèle ; provenance par dimension surtout en détail, pas clairement à côté de chaque champ.',
50:'count explicite ne stocke pas prix historique (E01). Libellé global votre choix peut manquer de précision pour le prix encore de référence.',
51:'Protection/absence capability distinguées via popover/Àpiloter ; disponibilité moins visible sur certaines cartes externes.',
52:'Compteur utilise unresolvedRefs pour navigation, pas pour autoriser Apply. Options facultatives ne deviennent pas automatiquement des contraintes.',
53:'Apply suit readiness/digest/relecture/CAS ; E05 et code. D01 est une séparation de saisie brute à ajouter à ce garde.',
54:'Jauge explicitement réservation/repère initial, pas objectif atteint ; aucune mutation bancaire.',
55:'Carte fixe ne crée ni PlanSlot ni total HUD ; digest détachement/rattachement prouvé en L3.3.',
56:'FRESH et montants incomplets coexistent explicitement. Sauvegarde ERROR avec FRESH a été observée A0.',
57:'Tickets de réponse liés digest/mois/version World ; comparatifs non frais non réutilisés ; aucun nouveau comparatif financier A0.',
58:'Budget entier ; règles observed-reconciliation-required conservées. Aucune inférence depuis un solde bancaire.',
59:'OFFER_PREFILL et couverture owner admis ; pas de certification statistique globale des vrais mois A0.',
60:'Proposition/panneau affichent période et effectif en mois comparables ; aucune confiance universelle inventée.',
61:'Courses seule retenue en L3.3, Café/Vêtements conservés. A0 ne rejoue pas inutilement la même adoption.',
62:'Refus A0 : proposition fermée, digest identique ; entrée manuelle, aucune réapparition automatique.',
63:'Test E01 exclut la décision Courses250 déjà présente ; ne remplace pas ses choix.',
64:'REFERENCE_ONLY jamais adopté par monthReuseProposals ; panneau CardKnowledge conserve l’information.',
65:'Période/couverture accessibles ; owner technique peut être simplifié sans renforcer la certitude de la source.',
66:'Dernier choix comparable exige un lecteur/owner non présent ; différé, aucune nouvelle vérité statistique.',
67:'Identités PERSON distinctes Adrien/Manon et HOUSEHOLD ; pas de conversion implicite dans monthReuseProposals.',
68:'Copie qualité mieux calibrée envisageable ; pas de score ni inférence nouvelle sous A0.',
69:'Utilité subjective non mesurée ; pas de télémétrie personnelle créée pour cet audit.',
70:'Préférences cross-device hors périmètre, ne bloque pas L4.',
71:'47 presets conservés, catégories/recherche contractées L3.2 ; pas nouvelle revue subjective de chaque illustration.',
72:'13 templates génériques secondaires conservés par registre et bibliothèque ; aucun nouveau type.',
73:'Normalisation accents/synonymes et anciennes clés testées L3.2, sources inchangées.',
74:'Favoris localStorage, aucune mutation sémantique/Preview déclenchée.',
75:'Favoris annoncés locaux ; disposition charges documentée mais mention locale peu visible, clé par navigateur/mois sans scope compte.',
76:'Recette concrete et générique créent le même type officiel ; ils ne sont pas des doublons financiers automatiques.',
77:'Sacs-poubelle garde productLabel/budgetDomain et démarre montant/enveloppe ; preuve L3.3.',
78:'Identités selectionId et remplacement ONE_OF conservés ; REPEATING autorise des ajouts distincts explicites. Pas supprimer les vrais doublons volontaires.',
79:'Palette issue des sockets du focusedContext et capacités publiées ; aucune liste globale financière reconstruite.',
80:'Dense40 :6 images initialement montées, pas47 ; éditeurs paresseux et catégories fermées conservés.',
81:'Recherche vide propose explication et accès secondaire ; amélioration de raccourci générique envisageable sans créer de faux résultat.',
82:'Àpiloter utilise capabilityRef de la vraie carte ; retour ciblé A0 par identité, pas ADD_CONTEXT.',
83:'E00 baseline figée et empreintes fichiers ; code produit identique à Production.',
84:'Legacy count-only + nouveaux overrides PGlite PASS ; code antérieur L3.2 ne doit pas réécrire les nouveaux champs lors de rollback.',
85:'check-l3-3-workshop permanent couvre ordre prix/count, zéro et legacy ; ne pas dupliquer ces tests dans un nouvel engine.',
86:'Matrice20 contrôles L3.3 conserve actions/champs/bornes/scope ; C1 doit corriger uniquement l’incohérence D04.',
87:'Foyer et auteur dérivés serveur, scopes PERSON/HOUSEHOLD ; pas de campagne JWT multi-auteurs A0.',
88:'Savings/Renewal/floors gardés côté Compiler/ConstraintEngine ; aucune modification A0.',
89:'Golden22×9 de L3.3 conservé ; seules22 capabilities changées précédemment, aucune empreinte actualisée A0.',
90:'ERROR/FRESH, retry visible et perte-réponse récupérée dans fixture. Draft HTTP réel et CAS : suite historique, nouveau JWT NOT_RUN.',
91:'Scheduler vérifie sequence/digest/mois/World ; tests P14-P2 hors ordre hérités PASS ; ni cache global ni acceptation tardive ajoutés.',
92:'D01 : états sémantiques sont distincts, mais un raw inline n’est pas reflété dans le statut/Apply.',
93:'Aucun appel World dans Inline/FixedCharges/MonthReuse/Library ; validation économique repasse par Preview officielle.',
94:'editor-chunks et EditorBoundary conservés ; montage de tous les47 éditeurs non présent.',
95:'Compteurs DOM/images4/3/2pages conservés, pas de P95 ni gain calculé à partir de IAB.',
96:'Pas de changement SQL/cache/SNAP sous A0.',
97:'Incident Canonical57014 conservé comme dette opérationnelle ; pas réapparu dans la lecture de session A0, pas de scan SQL.',
98:'Maintenance SNAP distincte ; pas de vérification fraîche des artifacts ni de republication A0.',
99:'Next Vercel complet READY ; webpack local node:crypto préexistant, aucun build nouveau nécessaire avec code produit inchangé.',
100:'Pas de P95 global requis pour des retouches ; mesure seulement si risque démontré.',
101:'Validateur knownContextReferences et auth runtime à réutiliser ; refus de références d’un autre owner à éprouver sur compte isolé pour L4.',
102:'Rollback présentation compatible avec nouveaux champs ; protocole de conservation à tester en C3, aucune suppression JSON.',
103:'night-out, short-stay, family-visit, purchase, gift réellement publiés ; versions capturées E07.',
104:'Champs et cardinalités exacts E07 ; pas de champ jacuzzi-inclus ni payeur distinct publiés.',
105:'guided-context-edit/restaurant-editor mutualisent total/détail, personnes, bindings et relecture ; pas de nouveau questionnaire A0.',
106:'Defaults des presets capturés E07. Noms techno/Fontès ne prouvent ni lieu, participants ni trajet ; informations minimales proposées sur papier.',
107:'Questions minimales préparées dans la matrice L4 du rapport ; aucun éditeur implémenté.',
108:'Delivery sans trajet du foyer ; domicile/preset ne fabrique pas de Mobility. Questions ignorées listées dans le rapport.',
109:'Dépendances sur papier ; changements lieu/mode doivent invalider les seules réponses incompatibles avec validation propriétaire, pas purge globale.',
110:'PATCH champs et omission sockets préservent les données compatibles ; identités parent/enfant préservées, tests P02–P11 hérités.',
111:'Transport remplacé par union valide dans edits Visit/Stay ; ancien coût automobile non transféré à un billet, P10 couvert.',
112:'Création courte puis réédition résumé à définir en L4 ; pas motif de refaire L3.',
113:'Réutiliser normalisation/validation par dimension, jamais appliquer les droits d’un contrôle mensuel à tous composants.',
114:'parentContextOccurrenceId/child selectionId + graph validation ; parent non additif, pas de clone au rattachement.',
115:'Participants/quantité et Funding BANK existent ; identité payeur/bénéficiaire et paiement partagé arbitraire non publiés. Ne pas recueillir de champs perdus.',
116:'SHARED1×20 vs PERSON2×10 explicites ; quantity économique issue des helpers/Compiler, pas total doublé depuis participantRefs.',
117:'Bindings explicites et effets contextualisés CONSUMES/EXTRA/UNRESOLVED ; scénarios oracles recensés.',
118:'MobilityIntent/route/quote/journey propriétaires ; coût usage carburant distinct de paiement ; indisponible conserve UNKNOWN.',
119:'Dates absentes/coût UNKNOWN/équipement vide sauvegardables selon C0 ; absence de READY n’interdit pas Draft.',
120:'Erreurs actionnables par champ à concevoir en L4 avec codes existants ; pas de nouveau moteur.',
121:'ContextOccurrenceId/selectionId/decisionId restent stables en édition ; mutation de montant ≠ création.',
122:'Duplication volontaire future : nouveaux IDs et remapping du sous-graphe ; fonctionnalité non implémentée.',
123:'Oracles parent non additif, bouteille partagée, achat couvert et voyage partagé listés ; vrais services hérités, aucun nouveau total React.',
124:'Gate L4 création→SAVED→reload→réédition défini ; nouveau cycle authentifié dépend C1-03.',
125:'Gardes réutilisables partiellement certifiés ; fermeture native et drag continu restent gates ciblés, pas une nouvelle architecture.',
126:'Budget de questions sur papier pour5 familles ; étude de compréhension humaine non exécutée.',
127:'Framework général de questionnaire refusé sans besoin démontré ; différé.',
128:'Ordre proposé Soirée pilote, puis Cadeau/Achat, Visite, Séjour composite. Pas de lancement automatique L4.',
}
assert set(notes)==set(range(1,129))
def location(n,status):
 if n in [11]:return 'HIGH','C1','C1-02','Valeur admise selon un chemin mais refusée par un autre.'
 if n in [12,37,92]:return 'HIGH','C1','C1-01','L’utilisateur peut confondre texte visible et décision applicable.'
 if n in [47]:return 'MEDIUM','C2','C2-01','Référence/zéro non décidé présenté comme choix explicite.'
 if n in [26,33,48]:return 'MEDIUM','C2','C2-02','Libellé financier masqué par une action de réglage.'
 if n in [1,2,3,4,6,7,8]:return 'HIGH','C1','C1-01','Saisie locale à conserver ou abandonner explicitement.'
 if 13<=n<=24 or n in [84,87,90,101]:return 'HIGH','C1','C1-03','Persistance, autorisation ou compatibilité non certifiée avec les nouveaux champs.'
 if n in [5,38,125]:return 'MEDIUM','C3','C3-02','Geste natif ou focus non certifié, défaut non démontré.'
 if status=='OUT_OF_SCOPE_OR_DEFERRED':return 'LOW','REPORTÉ','REPORTÉ','Élargissement de périmètre ou chantier opérationnel distinct.'
 if 103<=n<=128:return 'LOW','C3','C3-03','Collecter une réponse non persistable ou mal interpréter les relations à L4.'
 if n in [49,50,51,65,75]:return 'MEDIUM','C2','C2-01','Portée d’une référence ou préférence insuffisamment visible.'
 if n in [28,29,32,34]:return 'MEDIUM','C2','C2-02','Actions ou contenu moins lisibles sur surface dense.'
 if status=='USEFUL_IMPROVEMENT_NOT_DEFECT':return 'LOW','REPORTÉ','C2-03','Amélioration de confort sans régression démontrée.'
 if status=='ALREADY_CORRECT_WITH_EVIDENCE':return 'LOW','C3','C3-01','Garde à préserver ; aucun ticket correctif autonome.'
 return 'MEDIUM','C3','C3-01','Couverture limitée à compléter de façon ciblée, sans réaudit général.'
def evidence(n):
 if n==11:return ['E03','E15']
 if n in [12,26,33,37,48,92]:return ['E02','E15']
 if n==47:return ['E13','E02','E15']
 if n in [1,2,3,7,8,27,28,30,31,39,62,80,95]:return ['E02','E15']
 if n in [4,5,13,14,15,16,17,18,21]:return ['E09','E15']
 if n in [19,22,23,63]:return ['E01','E04']
 if n in [9,10,24,41,55,61,64,84,85,86,88]:return ['E04','E05','E15']
 if 71<=n<=82:return ['E14','E05','E15']
 if n>=103:return ['E07','E15']
 if n==89:return ['E06','E05']
 if n==90:return ['E02','E08','E10']
 if n==83:return ['E00','E06']
 return ['E09','E05','E15']
rows=[]
for original in source['rows']:
 n=original['number'];status=assigned[n];severity,dest,ticket,risk=location(n,status)
 rows.append({**original,'status':status,'severity':severity,'destination':dest,'ticket':ticket,'evidence':evidence(n),'observation':notes[n],'userRisk':risk})
counts=dict(collections.Counter(r['status'] for r in rows))
(out/'av-coverage.json').write_text(json.dumps({'sourceSha256':source['sha256'],'mapping':'ORIGINAL_EXACT_128_UNIQUE','classificationIsNot128ExecutedTests':True,'statusCounts':counts,'evidence':proof,'rows':rows},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
lines=['# AV-01 à AV-128 — couverture A0','','Source originale fournie par l’utilisateur, 128 IDs uniques vérifiés. Cette matrice classe les pistes ; elle ne prétend pas contenir 128 tests exécutés. Les preuves héritées sont explicitement identifiées.','', '| ID | Piste originale | Classe | Sévérité / lot | Preuve | Conclusion et limite |','|---|---|---|---|---|---|']
for r in rows:
 esc=lambda text:text.replace('|','\\|').replace('\n',' ')
 lines.append('| '+ ' | '.join([r['id'],esc(r['original']),r['status'],r['severity']+' · '+r['destination']+' · '+r['ticket'],', '.join(r['evidence']),esc(r['observation'])])+' |')
lines+=['','## Index de preuves','']+[f"- **{k}** : [{v['path']}]({v['path']}) — {v['scope']}" for k,v in proof.items()]
(out/'AV_01_128_COVERAGE.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
print(json.dumps({'sourceCount':len(rows),'statusCounts':counts},ensure_ascii=False))
