const fs=require('node:fs'),cp=require('node:child_process');
const files=['composer-shell.tsx','composer-board.tsx','board-carousel.tsx','composer.module.css'].map(n=>'src/app/mois-a-venir/composer/'+n);
const saved=new Map(files.map(p=>[p,fs.readFileSync(p)]));
try { for(const p of files)fs.writeFileSync(p,cp.execFileSync('git',['show','8998ba8f82a3ab72e7d60619bc8c0c81174ce15a:'+p]));
cp.execFileSync(process.execPath,['scripts/serve-phase2-planner-composer-fixture.mjs'],{stdio:['ignore',fs.openSync('outputs/bar-350/residual-baseline-bundle.log','w'),fs.openSync('outputs/bar-350/residual-baseline-bundle-error.log','w')],env:{...process.env,PLANNER_C8_BROWSER_OUTPUT:'outputs/bar-350/residual-baseline',PLANNER_C8_GLOBAL_CSS:'outputs/l4-a1-browser/global.css',PLANNER_L1_SPLIT:'1',PLANNER_BROWSER_TOOLS:'C:/Users/AdrienSauvageot/Documents/Codex/p14-c4-tools',PLANNER_C8_BUILD_ONLY:'1'}});
}finally{for(const [p,bytes]of saved)fs.writeFileSync(p,bytes);}
console.log('Baseline bundle: 8998 UI; identical current opt-in DOM timing probe; candidate bytes restored.');
