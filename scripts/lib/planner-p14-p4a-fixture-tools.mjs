import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';
export const p4Measuring=process.env.PLANNER_P14_P4A_MEASURE==='1';
const base='aed99461ee006654eb5a8d4a265e641f6e25d3fb';
export function p4FixturePlugin(){return{name:'p4-production-ui-probes',setup(b){if(!p4Measuring)return;
  if(process.env.PLANNER_P14_P4A_DIAGNOSTICS==='1')b.onResolve({filter:/^react-dom\/client$/},()=>({path:path.join(process.cwd(),'node_modules/react-dom/profiling.js')}));
  b.onLoad({filter:/\.(ts|tsx|css)$/},args=>{const rel=path.relative(process.cwd(),args.path).replaceAll('\\','/');
    if(!rel.startsWith('src/app/mois-a-venir/composer/'))return;
    let source=process.env.PLANNER_P14_P4A_VARIANT==='P3'?execFileSync('git',['show',`${base}:${rel}`],{encoding:'utf8'}):fs.readFileSync(args.path,'utf8');
    if(rel.endsWith('.css'))return{contents:source,loader:'local-css'};
    const diagnostics=process.env.PLANNER_P14_P4A_DIAGNOSTICS==='1';
    const timingNames=['stage','inventoryLayoutPages','composePresentationNodes'];
    const renders=['ComposerShell','ComposerBoard','BoardCarousel','ComposerCard','ContextCard','ContextSocket','ContextSatellite','ComposerLibrary','ComposerLibraryView','VisualClusterCard'];
    const ast=ts.createSourceFile(args.path,source,ts.ScriptTarget.Latest,true),edits=[];
    const visit=node=>{if(ts.isFunctionDeclaration(node)&&node.body&&node.name){const name=node.name.getText(ast),insert=[];
      if(diagnostics&&renders.includes(name))insert.push(`p4Rendered(${JSON.stringify(name)});`);
      if(name==='BoardCarousel')insert.push('ReactP4Commit("carousel","");');
      if(timingNames.includes(name)){const body=source.slice(node.body.getStart(ast)+1,node.body.getEnd()-1);edits.push([node.body.getStart(ast)+1,node.body.getEnd()-1,`${insert.join('')}const p4End=p4Span(${JSON.stringify(name)});try{${body}}finally{p4End();}`]);return;}
      if(insert.length)edits.push([node.body.getStart(ast)+1,node.body.getStart(ast)+1,insert.join('')]);
    }ts.forEachChild(node,visit);};visit(ast);
    for(const[start,end,text]of edits.sort((a,b)=>b[0]-a[0]))source=source.slice(0,start)+text+source.slice(end);
    if(rel.endsWith('/composer-shell.tsx'))source=source.replace('  return <ComposerInteractionContext.Provider',
      '  ReactP4Commit(shown.board.draft.semanticStateDigest,previewStatus);\n  return <ComposerInteractionContext.Provider');
    source=`import {p4Span,p4Rendered,ReactP4Commit} from ${JSON.stringify(path.resolve('scripts/lib/planner-p14-p4a-probe.ts'))};\n`+source;
    return{contents:source,loader:rel.endsWith('.tsx')?'tsx':'ts'};
  });
}};}
