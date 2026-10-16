// Read-only published contracts and carried AV register. No network or DB.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {require} from './lib/phase2-ts-loader.mjs';
const out='docs/status/evidence/pre-l4-final';
const {resolveContextTemplate}=require('@/server/phase2/planner/context-registry');
const {COMPOSER_PRESETS}=require('@/domain/phase2/planner/composer-presets');
const prior=JSON.parse(fs.readFileSync('docs/status/evidence/pre-l4-audit/l4-contracts-published.json'));
for(const row of prior){assert.deepEqual(COMPOSER_PRESETS.find(p=>p.presetKey===row.preset.presetKey),row.preset);assert.deepEqual(resolveContextTemplate(row.template.templateKey),row.template);}
const servian=COMPOSER_PRESETS.find(p=>p.presetKey==='servian-family-visit');
assert.equal(servian.templateKey,'family-visit');
const files=['src/server/phase2/planner/context-registry.ts','src/domain/phase2/planner/composer-presets.ts','src/domain/phase2/planner/semantic-state.ts','src/domain/phase2/planner/component-contract.ts','src/domain/phase2/planner/component-quantity.ts'];
fs.writeFileSync(out+'/l4-contract-identity.json',JSON.stringify({publishedMatchesA0:true,scenarioCount:prior.length,servian,files:files.map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))},null,2)+'\n');
const source=JSON.parse(fs.readFileSync('docs/status/evidence/pre-l4-audit/av-coverage.json'));
assert.equal(source.rows.length,128);
const c1=new Set([11,12,37,92]),c2=new Set([26,33,47,48,49,50]);
const doc=new Set([103,104,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119,120,121,122,123,124,126,128]);
const rows=source.rows.map(r=>{
 let status=r.status==='ALREADY_CORRECT_WITH_EVIDENCE'?'ALREADY_CORRECT_WITH_EVIDENCE':r.status==='PARTIAL_OR_LIMITED'?'VERIFIED_WITH_LIMITATION':r.status==='NOT_TESTED'?'NOT_EXECUTED':'DEFERRED_VOLUNTARILY';
 let proof='A0: '+r.evidence.join(', ')+'; observation originale conservée.';
 if(c1.has(r.number)){status='FIXED_C1';proof='C1: six groupes d’admission/compatibilité; C3: check-pre-l4-c1.log, browser-checks.json (RAW/Apply).';}
 if(c2.has(r.number)){status='FIXED_C2';proof='C2: contracts.json, geometry-after.json et captures des trois tailles; C3: check-pre-l4-c2.log et parcours intégré. Sources produit inchangées.';}
 if(doc.has(r.number)){status='VERIFIED_WITH_LIMITATION';proof='L4_COMPOSER_CONTRACTS_AND_SCENARIO_ORACLES.md; l4-contract-identity.json. Contrat et oracle écrits, aucun éditeur L4 développé ou certifié.';}
 if([1,2,3,4,5,6,7,8,38,125].includes(r.number)){status='VERIFIED_WITH_LIMITATION';proof='C1/C2: gardes et clavier/SSR/fixtures. C3: navigateur DOM; confirm/beforeunload et drag natifs NOT_RUN_NATIVE, protocole manuel dans le rapport.';}
 if([4,5].includes(r.number))status='NOT_EXECUTED';
 if([13,14,15,16,17,18,21].includes(r.number)){status='NOT_EXECUTED';proof='NOT_RUN_AUTH: aucun compte isolé actif admissible disponible; F0 non réactivé, aucun Draft personnel écrit.';}
 if([19,24,85,88,89,91].includes(r.number))proof+=' Rejeu C3: suites critiques et 198 empreintes inchangées.';
 if([20,22,23,84,87,90,101].includes(r.number)){status='VERIFIED_WITH_LIMITATION';proof+=' C1/L3.3/P13/B3 et parcours C3 synthétiques; aucun nouveau JWT isolé.';}
 if([25,27,28,29,30,31,32,34,39,80,93,94,95].includes(r.number)){status='VERIFIED_WITH_LIMITATION';proof+=' C2 géométrie réutilisée; C3 browser-checks/geometry/browser-server-state. Échantillon local, pas toutes les combinaisons possibles.';}
 if(r.number===99){status='VERIFIED_WITH_LIMITATION';proof='Build Next complet C2 sur8978ac1 réutilisable (src inchangé); résultat du build Preview C3 indiqué dans le rapport final, sans généraliser le build local bloqué.';}
 if(r.number===102){status='VERIFIED_WITH_LIMITATION';proof='Rollback conservateur documenté: garder C1/C2 pour rollback C3, ne pas retourner à une UI qui réécrit les nouveaux overrides. Compatibilité historique C1/L3.3 rejouée; downgrade d’une session réelle NOT_RUN.';}
 return {...r,priorStatus:r.status,status,evidence:r.evidence,finalEvidence:proof};
});
assert.deepEqual(rows.map(r=>r.id),source.rows.map(r=>r.id));
const counts=Object.fromEntries([...new Set(rows.map(r=>r.status))].map(s=>[s,rows.filter(r=>r.status===s).length]));
fs.writeFileSync(out+'/av-coverage.json',JSON.stringify({...source,classificationIsNot128ExecutedTests:true,statusCounts:counts,rows},null,2)+'\n');
const esc=s=>String(s).replaceAll('|','/').replaceAll('\n',' ');
fs.writeFileSync(out+'/AV_01_128_FINAL_COVERAGE.md','# AV-01…128 — réception C3\n\nMême registre et empreinte source que A0; aucune renumérotation. **128 pistes classées, pas128 tests exécutés.** Les preuves A0/C1/C2 restent historiques; seuls les journaux C3 marquent de nouvelles exécutions. Amélioration optionnelle différée ≠ défaut bloquant.\n\nStatuts: '+Object.entries(counts).map(([s,n])=>s+'='+n).join('; ')+'.\n\n| Piste | Demande originale | Statut final | Preuve / limite |\n|---|---|---|---|\n'+rows.map(r=>'| '+r.id+' | '+esc(r.original)+' | '+r.status+' | '+esc(r.finalEvidence)+' |').join('\n')+'\n');
console.log(JSON.stringify({publishedContractIdentity:'PASS',avRows:128,counts}));
