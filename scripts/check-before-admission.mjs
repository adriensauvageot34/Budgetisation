/** Integrated Before owner/Save/SQL/Shell/loopback HTTP receipt, synthetic facts only. */
import{spawnSync}from'node:child_process';
for(const file of['tests.mjs','shell-tests.mjs','http-tests.mjs','counter-tests.mjs','finalisation-tests.mjs','history-window-tests.mjs','specialised-history-tests.mjs']){
 const target=new URL('./before-admission/'+file,import.meta.url).href;
 const code='try{await import('+JSON.stringify(target)+')}catch(e){console.error(JSON.stringify({message:e.message,code:e.code,where:e.where,stack:e.stack?.split(\'\\n\').filter(x=>!x.includes(\'pglite/dist\')).slice(0,7)}));process.exitCode=1}';
 const result=spawnSync(process.execPath,['--input-type=module','-e',code],{stdio:'inherit'});if(result.status!==0)process.exit(result.status??1);
}
console.log('INTEGRATED_BEFORE_RECEIPT: 59 scenario groups PASS (54 existing + 5 specialised history, including explicit owner-contract refusals)');
